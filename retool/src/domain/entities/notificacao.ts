import { UserRole } from './user';

export type NotificacaoTipo =
  | 'reutilizacao_nova'      // nova solicitação de reutilização aguardando análise
  | 'reutilizacao_decidida'  // solicitação de reutilização aprovada/rejeitada
  | 'conta_nova'             // novo cadastro (Convidado) aguardando aprovação -> Administração
  | 'conta_decidida'         // cadastro aprovado/recusado -> solicitante
  | 'cargo_solicitado'       // solicitação de alteração de cargo -> Administração
  | 'cargo_decidido';        // alteração de cargo aprovada/rejeitada -> solicitante

export interface Notificacao {
  id: string;
  tipo: NotificacaoTipo;
  destinatarioUid: string;
  remetenteUid: string;
  titulo: string;
  descricao: string;
  dataHora: string;
  lida: boolean;
  resolvida?: boolean;
  /** id da reutilização, uid do usuário ou id da solicitação de cargo, conforme o tipo */
  entidadeId?: string;
  /** para navegação direta à tela relacionada */
  dispositivoId?: string;
  perfilSolicitado?: UserRole;
  decisao?: 'aprovada' | 'rejeitada' | 'recusada';
}

/** Id determinístico: impede notificações duplicadas para o mesmo evento. */
export function idNotificacao(tipo: NotificacaoTipo, entidadeId: string, destinatarioUid: string): string {
  return `${tipo}_${entidadeId}_${destinatarioUid}`;
}
