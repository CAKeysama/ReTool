import { UserRole } from './user';

export type NotificacaoTipo =
  | 'reutilizacao_nova'      // nova solicitação de reutilização aguardando análise
  | 'reutilizacao_decidida'  // solicitação de reutilização aprovada/rejeitada
  | 'conta_nova'             // solicitação de conta com tier diferente de Gerência
  | 'conta_decidida';        // solicitação de conta aprovada/recusada

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
  /** id da reutilização ou uid do usuário solicitante, conforme o tipo */
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
