import { ROLES_CONFIG, UserProfile, isAdministrador } from '../../domain/entities/user';
import { SolicitacaoCargo } from '../../domain/entities/solicitacaoCargo';
import { idNotificacao } from '../../domain/entities/notificacao';
import {
  DecisaoSolicitacaoCargo, IAuditLogRepository, INotificationsRepository, ISolicitacoesCargoRepository, IUsersRepository
} from '../../domain/repositories/IAcessosRepositories';
import { ErroPermissao, ErroValidacao, autorAuditoria, limparTexto, registrarAuditoriaSemFalhar } from './acessosComum';

export interface DadosDecisaoCargo {
  admin: UserProfile | null;
  solicitacaoId: string;
  aprovar: boolean;
  motivo?: string;
}

/**
 * Fluxo B (decisão): somente a Administração aprova ou rejeita. O cargo
 * muda apenas na aprovação, no mesmo lote atômico que fecha a solicitação.
 */
export class DecidirSolicitacaoCargoUseCase {
  constructor(
    private solicitacoesRepo: ISolicitacoesCargoRepository,
    private usersRepo: IUsersRepository,
    private auditRepo: IAuditLogRepository,
    private notificationsRepo: INotificationsRepository
  ) {}

  async execute({ admin, solicitacaoId, aprovar, motivo }: DadosDecisaoCargo): Promise<SolicitacaoCargo> {
    const acao = aprovar ? 'aprovacao_cargo' : 'rejeicao_cargo';

    if (!isAdministrador(admin)) {
      if (admin) {
        await registrarAuditoriaSemFalhar(this.auditRepo, {
          ...autorAuditoria(admin),
          acao,
          resultado: 'negado',
          acaoDescricao: 'Tentativa de decidir solicitação de cargo sem permissão',
          tipoEntidade: 'solicitacao_cargo',
          entidadeId: solicitacaoId
        });
      }
      throw new ErroPermissao();
    }

    const solicitacao = await this.solicitacoesRepo.obter(solicitacaoId);
    if (!solicitacao) throw new ErroValidacao('Solicitação não encontrada.');
    if (solicitacao.status !== 'pendente') throw new ErroValidacao('Esta solicitação já foi analisada.');
    if (solicitacao.usuarioUid === admin!.uid) {
      throw new ErroPermissao('Uma solicitação não pode ser decidida pelo próprio solicitante.');
    }

    const alvo = await this.usersRepo.getProfile(solicitacao.usuarioUid);
    if (aprovar && !alvo) throw new ErroValidacao('O usuário desta solicitação não existe mais; apenas a rejeição é possível.');

    const motivoLimpo = limparTexto(motivo, 500);
    const decisao: DecisaoSolicitacaoCargo = {
      status: aprovar ? 'aprovada' : 'rejeitada',
      decididoPorUid: admin!.uid,
      decididoPorNome: admin!.nome,
      dataDecisao: new Date().toISOString(),
      ...(motivoLimpo ? { motivoDecisao: motivoLimpo } : {})
    };

    try {
      await this.solicitacoesRepo.decidir(solicitacao, decisao);
    } catch (e) {
      await registrarAuditoriaSemFalhar(this.auditRepo, {
        ...autorAuditoria(admin!),
        acao,
        resultado: 'falha',
        acaoDescricao: aprovar ? 'Falha ao aprovar alteração de cargo' : 'Falha ao rejeitar alteração de cargo',
        tipoEntidade: 'solicitacao_cargo',
        entidadeId: solicitacao.id,
        entidadeNome: solicitacao.usuarioNome,
        conteudo: { erro: (e as Error)?.message }
      });
      throw e;
    }

    const de = ROLES_CONFIG[solicitacao.perfilAtual].titulo;
    const para = ROLES_CONFIG[solicitacao.perfilSolicitado].titulo;

    if (alvo) {
      try {
        await this.notificationsRepo.criar({
          id: idNotificacao('cargo_decidido', solicitacao.id, solicitacao.usuarioUid),
          tipo: 'cargo_decidido',
          destinatarioUid: solicitacao.usuarioUid,
          remetenteUid: admin!.uid,
          titulo: aprovar ? 'Alteração de cargo aprovada' : 'Alteração de cargo rejeitada',
          descricao: aprovar
            ? `Seu cargo foi alterado para ${para}.`
            : `Sua solicitação para ${para} foi rejeitada.${motivoLimpo ? ` Motivo: ${motivoLimpo}` : ''}`,
          dataHora: decisao.dataDecisao,
          lida: false,
          entidadeId: solicitacao.id,
          perfilSolicitado: solicitacao.perfilSolicitado,
          decisao: aprovar ? 'aprovada' : 'rejeitada'
        });
      } catch (e) {
        console.warn('Falha ao notificar o solicitante:', e);
      }
    }

    await this.notificationsRepo
      .marcarResolvida(idNotificacao('cargo_solicitado', solicitacao.id, admin!.uid), true)
      .catch(() => undefined);

    await registrarAuditoriaSemFalhar(this.auditRepo, {
      ...autorAuditoria(admin!),
      acao,
      acaoDescricao: aprovar
        ? `Aprovou a alteração de cargo de ${solicitacao.usuarioNome}: ${de} → ${para}`
        : `Rejeitou a alteração de cargo de ${solicitacao.usuarioNome} (${de} → ${para})`,
      tipoEntidade: 'solicitacao_cargo',
      entidadeId: solicitacao.id,
      entidadeNome: solicitacao.usuarioNome,
      conteudo: {
        usuarioUid: solicitacao.usuarioUid,
        perfilAnterior: alvo?.perfil ?? solicitacao.perfilAtual,
        perfilSolicitado: solicitacao.perfilSolicitado,
        perfilResultante: aprovar ? solicitacao.perfilSolicitado : (alvo?.perfil ?? solicitacao.perfilAtual),
        motivo: motivoLimpo || undefined
      },
      dadosAnteriores: { status: 'pendente' }
    });

    return { ...solicitacao, ...decisao };
  }
}
