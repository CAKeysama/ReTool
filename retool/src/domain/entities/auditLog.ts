import { UserRole } from './user';

export interface AuditLog {
  id: string;
  dataHora: string;
  usuarioUid: string;
  usuarioNome: string;
  usuarioEmail: string;
  usuarioPerfil: UserRole;
  acao: 'exclusao' | 'aprovacao' | 'rejeicao' | 'alteracao_perfil' | 'bloqueio_usuario' | 'desbloqueio_usuario';
  tipoEntidade: 'dispositivo' | 'categoria' | 'tipo' | 'familia' | 'produto' | 'reutilizacao' | 'usuario';
  entidadeId: string;
  entidadeNome?: string;
  detalhes?: string;
  dadosAnteriores?: Record<string, any>;
}
