import { ROLES_CONFIG, UserProfile, UserRole, isAdministrador, isPerfilAtribuivel, situacaoDoUsuario } from '../../domain/entities/user';
import { idNotificacao } from '../../domain/entities/notificacao';
import { IAuditLogRepository, INotificationsRepository, IUsersRepository } from '../../domain/repositories/IAcessosRepositories';
import { ErroPermissao, ErroValidacao, autorAuditoria, limparTexto, registrarAuditoriaSemFalhar } from './acessosComum';

export interface DecisaoCadastro {
  admin: UserProfile | null;
  alvoUid: string;
  aprovar: boolean;
  /** Cargo definido pela Administração (obrigatório na aprovação). */
  perfil?: UserRole;
  motivo?: string;
}

/**
 * Fluxo A (decisão): a Administração aprova — definindo o cargo — ou
 * rejeita um cadastro pendente. A rejeição preserva o registro com
 * `statusAprovacao: 'rejeitado'` e `ativo: false`, impedindo novo acesso.
 */
export class DecidirCadastroUseCase {
  constructor(
    private usersRepo: IUsersRepository,
    private auditRepo: IAuditLogRepository,
    private notificationsRepo: INotificationsRepository
  ) {}

  async execute({ admin, alvoUid, aprovar, perfil, motivo }: DecisaoCadastro): Promise<UserProfile> {
    const acao = aprovar ? 'aprovacao_usuario' : 'rejeicao_usuario';

    if (!isAdministrador(admin)) {
      if (admin) {
        await registrarAuditoriaSemFalhar(this.auditRepo, {
          ...autorAuditoria(admin),
          acao,
          resultado: 'negado',
          acaoDescricao: 'Tentativa de decidir cadastro sem permissão',
          tipoEntidade: 'usuario',
          entidadeId: alvoUid
        });
      }
      throw new ErroPermissao();
    }

    const alvo = await this.usersRepo.getProfile(alvoUid);
    if (!alvo) throw new ErroValidacao('Cadastro não encontrado.');
    if (situacaoDoUsuario(alvo) !== 'pendente') {
      throw new ErroValidacao('Este cadastro já foi analisado.');
    }
    if (aprovar && !isPerfilAtribuivel(perfil)) {
      throw new ErroValidacao('Defina o cargo do usuário para aprovar o cadastro.');
    }

    const agora = new Date().toISOString();
    const motivoLimpo = limparTexto(motivo, 500);
    const alteracoes: Partial<UserProfile> = aprovar
      ? { perfil: perfil!, ativo: true, statusAprovacao: 'aprovado', aprovadoPorUid: admin!.uid, aprovadoEm: agora, atualizadoEm: agora }
      : {
          ativo: false,
          statusAprovacao: 'rejeitado',
          rejeitadoPorUid: admin!.uid,
          rejeitadoEm: agora,
          atualizadoEm: agora,
          ...(motivoLimpo ? { motivoRejeicao: motivoLimpo } : {})
        };

    try {
      await this.usersRepo.updateProfile(alvoUid, alteracoes);
    } catch (e) {
      await registrarAuditoriaSemFalhar(this.auditRepo, {
        ...autorAuditoria(admin!),
        acao,
        resultado: 'falha',
        acaoDescricao: aprovar ? 'Falha ao aprovar cadastro' : 'Falha ao rejeitar cadastro',
        tipoEntidade: 'usuario',
        entidadeId: alvoUid,
        entidadeNome: alvo.nome,
        conteudo: { erro: (e as Error)?.message }
      });
      throw e;
    }

    // Comunica a decisão ao solicitante.
    try {
      await this.notificationsRepo.criar({
        id: idNotificacao('conta_decidida', alvoUid, alvoUid),
        tipo: 'conta_decidida',
        destinatarioUid: alvoUid,
        remetenteUid: admin!.uid,
        titulo: aprovar ? 'Cadastro aprovado' : 'Cadastro recusado',
        descricao: aprovar
          ? `Seu acesso foi liberado com o cargo ${ROLES_CONFIG[perfil!].titulo}.`
          : `Sua solicitação de cadastro foi recusada pela Administração.${motivoLimpo ? ` Motivo: ${motivoLimpo}` : ''}`,
        dataHora: agora,
        lida: false,
        entidadeId: alvoUid,
        ...(aprovar ? { perfilSolicitado: perfil } : {}),
        decisao: aprovar ? 'aprovada' : 'recusada'
      });
    } catch (e) {
      console.warn('Falha ao notificar o solicitante:', e);
    }

    // A notificação de "novo cadastro" desta administradora deixa de exigir ação.
    await this.notificationsRepo
      .marcarResolvida(idNotificacao('conta_nova', alvoUid, admin!.uid), true)
      .catch(() => undefined);

    await registrarAuditoriaSemFalhar(this.auditRepo, {
      ...autorAuditoria(admin!),
      acao,
      acaoDescricao: aprovar
        ? `Aprovou o cadastro de ${alvo.nome} com o cargo ${ROLES_CONFIG[perfil!].titulo}`
        : `Rejeitou o cadastro de ${alvo.nome}`,
      tipoEntidade: 'usuario',
      entidadeId: alvoUid,
      entidadeNome: alvo.nome,
      conteudo: aprovar
        ? { perfilDefinido: perfil, email: alvo.email }
        : { motivo: motivoLimpo || undefined, email: alvo.email },
      dadosAnteriores: { perfil: alvo.perfil, ativo: alvo.ativo, statusAprovacao: alvo.statusAprovacao || 'pendente' }
    });

    return { ...alvo, ...alteracoes };
  }
}
