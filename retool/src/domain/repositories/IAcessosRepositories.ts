import { UserProfile } from '../entities/user';
import { AuditLog } from '../entities/auditLog';
import { Notificacao } from '../entities/notificacao';
import { SolicitacaoCargo } from '../entities/solicitacaoCargo';

/** Contratos usados pelos casos de uso de gestão de acessos. */

export interface IUsersRepository {
  getProfile(uid: string): Promise<UserProfile | null>;
  setProfile(profile: UserProfile): Promise<void>;
  updateProfile(uid: string, data: Partial<UserProfile>): Promise<void>;
  listarAdministradoresAtivos(): Promise<UserProfile[]>;
}

export type AuditLogInput = Omit<AuditLog, 'id' | 'dataHora' | 'dataHoraServidor'> & { dataHora?: string };

export interface IAuditLogRepository {
  registrarLog(logData: AuditLogInput): Promise<string>;
}

export interface INotificationsRepository {
  criar(notificacao: Notificacao): Promise<void>;
  marcarResolvida(id: string, resolvida: boolean): Promise<void>;
}

export interface DecisaoSolicitacaoCargo {
  status: 'aprovada' | 'rejeitada';
  decididoPorUid: string;
  decididoPorNome: string;
  dataDecisao: string;
  motivoDecisao?: string;
}

export interface ISolicitacoesCargoRepository {
  obter(id: string): Promise<SolicitacaoCargo | null>;
  obterPendenteDoUsuario(uid: string): Promise<SolicitacaoCargo | null>;
  /** Grava a solicitação e a trava de pendência do usuário no mesmo lote atômico. */
  criar(solicitacao: SolicitacaoCargo): Promise<void>;
  /** Registra a decisão, aplica o novo cargo (se aprovada) e libera a trava — atomicamente. */
  decidir(solicitacao: SolicitacaoCargo, decisao: DecisaoSolicitacaoCargo): Promise<void>;
}
