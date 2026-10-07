import { v4 as uuidv4 } from 'uuid';
import { ROLES_CONFIG, UserProfile, UserRole } from '../../domain/entities/user';
import { SolicitacaoCargo, validarNovaSolicitacaoCargo, JUSTIFICATIVA_MAX } from '../../domain/entities/solicitacaoCargo';
import { idNotificacao } from '../../domain/entities/notificacao';
import {
  IAuditLogRepository, INotificationsRepository, ISolicitacoesCargoRepository, IUsersRepository
} from '../../domain/repositories/IAcessosRepositories';
import { ErroValidacao, autorAuditoria, limparTexto, notificarAdministradores, registrarAuditoriaSemFalhar } from './acessosComum';

export interface DadosSolicitacaoCargo {
  usuario: UserProfile | null;
  perfilSolicitado: UserRole;
  justificativa?: string;
}

/**
 * Fluxo B (início): o próprio usuário pede outro cargo. Nada muda no
 * perfil agora — a solicitação fica pendente até a decisão da Administração.
 */
export class SolicitarAlteracaoCargoUseCase {
  constructor(
    private solicitacoesRepo: ISolicitacoesCargoRepository,
    private usersRepo: IUsersRepository,
    private auditRepo: IAuditLogRepository,
    private notificationsRepo: INotificationsRepository
  ) {}

  async execute({ usuario, perfilSolicitado, justificativa }: DadosSolicitacaoCargo): Promise<SolicitacaoCargo> {
    const justificativaLimpa = limparTexto(justificativa, JUSTIFICATIVA_MAX + 1);
    const pendente = usuario ? await this.solicitacoesRepo.obterPendenteDoUsuario(usuario.uid) : null;
    const erro = validarNovaSolicitacaoCargo(usuario, perfilSolicitado, pendente, justificativaLimpa);
    if (erro) throw new ErroValidacao(erro);

    const solicitacao: SolicitacaoCargo = {
      id: uuidv4(),
      usuarioUid: usuario!.uid,
      usuarioNome: usuario!.nome,
      usuarioEmail: usuario!.email,
      perfilAtual: usuario!.perfil as UserRole,
      perfilSolicitado,
      ...(justificativaLimpa ? { justificativa: justificativaLimpa } : {}),
      status: 'pendente',
      dataSolicitacao: new Date().toISOString()
    };
    await this.solicitacoesRepo.criar(solicitacao);

    const notificados = await notificarAdministradores(this.usersRepo, this.notificationsRepo, admin => ({
      id: idNotificacao('cargo_solicitado', solicitacao.id, admin.uid),
      tipo: 'cargo_solicitado',
      destinatarioUid: admin.uid,
      remetenteUid: solicitacao.usuarioUid,
      titulo: 'Solicitação de alteração de cargo',
      descricao: `${solicitacao.usuarioNome} solicitou mudar de ${ROLES_CONFIG[solicitacao.perfilAtual].titulo} para ${ROLES_CONFIG[perfilSolicitado].titulo}.`,
      dataHora: solicitacao.dataSolicitacao,
      lida: false,
      entidadeId: solicitacao.id,
      perfilSolicitado
    }), solicitacao.usuarioUid);

    await registrarAuditoriaSemFalhar(this.auditRepo, {
      ...autorAuditoria(usuario!),
      acao: 'solicitacao_cargo',
      acaoDescricao: `Solicitou alteração de cargo para ${ROLES_CONFIG[perfilSolicitado].titulo}`,
      tipoEntidade: 'solicitacao_cargo',
      entidadeId: solicitacao.id,
      entidadeNome: solicitacao.usuarioNome,
      conteudo: {
        perfilAtual: solicitacao.perfilAtual,
        perfilSolicitado,
        justificativa: solicitacao.justificativa,
        administradoresNotificados: notificados
      }
    });

    return solicitacao;
  }
}
