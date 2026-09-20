import { UserRole } from './user';

/**
 * Tipos de ação auditável.
 * Tokens de máquina (estáveis para filtros/regras); o rótulo legível
 * correspondente vai em `acaoDescricao` (ex.: "Aprovou Reutilização").
 */
export type AuditLogAcao =
  | 'criacao'
  | 'edicao'
  | 'exclusao'
  | 'transicao'
  | 'importacao'
  | 'aprovacao'
  | 'rejeicao'
  | 'alteracao_perfil'
  | 'bloqueio_usuario'
  | 'desbloqueio_usuario';

export interface AuditLog {
  id: string;
  /** Gerado pelo servidor (Firestore serverTimestamp) e normalizado para ISO na leitura. */
  dataHora: string;
  usuarioUid: string;
  usuarioNome: string;
  usuarioEmail: string;
  usuarioPerfil: UserRole;
  acao: AuditLogAcao;
  /** Rótulo humano da ação, ex.: "Aprovou Reutilização", "Gerou OS". */
  acaoDescricao?: string;
  tipoEntidade: 'dispositivo' | 'categoria' | 'tipo' | 'familia' | 'produto' | 'reutilizacao' | 'usuario';
  entidadeId: string;
  entidadeNome?: string;
  detalhes?: string;
  /** Detalhes estruturados da operação (JSON): ids, motivos, valores alterados. */
  conteudo?: Record<string, any>;
  dadosAnteriores?: Record<string, any>;
}
