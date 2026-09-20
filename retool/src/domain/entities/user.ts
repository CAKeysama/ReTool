export type UserRole = 'admin' | 'projetista' | 'engenharia' | 'gerencia';

export interface UserProfile {
  uid: string;
  email: string;
  nome: string;
  perfil: UserRole;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
  /** Tier solicitado no cadastro, quando diferente do padrão (Gerência). */
  perfilSolicitado?: UserRole;
}

export interface RoleConfig {
  id: UserRole;
  titulo: string;
  descricao: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  iconColor: string;
  canConsultar: boolean;
  canCadastrar: boolean;
  canEditar: boolean;
  canExcluir: boolean;
  canAprovar: boolean;
  canSolicitar: boolean;
  canGerenciarUsuarios: boolean;
  canVerLogs: boolean;
}

export const ROLES_CONFIG: Record<UserRole, RoleConfig> = {
  admin: {
    id: 'admin',
    titulo: 'Programadora / Administradora',
    descricao: 'Responsável pelo sistema: cria e bloqueia usuários, define perfis de acesso, cadastra, edita e exclui registros, aprova solicitações e administra permissões. Todas as exclusões são registradas em histórico/log.',
    badgeBg: '#f3e8ff',
    badgeText: '#6b21a8',
    borderColor: '#a855f7',
    iconColor: '#7c3aed',
    canConsultar: true,
    canCadastrar: true,
    canEditar: true,
    canExcluir: true,
    canAprovar: true,
    canSolicitar: true,
    canGerenciarUsuarios: true,
    canVerLogs: true,
  },
  projetista: {
    id: 'projetista',
    titulo: 'Projetista – Ferramentaria',
    descricao: 'Atua na análise e aprovação das solicitações: consulta dispositivos e projetos, cadastra e edita informações, aprova solicitações de reutilização e atualiza status e andamento. Não pode excluir registros.',
    badgeBg: '#dcfce7',
    badgeText: '#15803d',
    borderColor: '#22c55e',
    iconColor: '#16a34a',
    canConsultar: true,
    canCadastrar: true,
    canEditar: true,
    canExcluir: false,
    canAprovar: true,
    canSolicitar: true,
    canGerenciarUsuarios: false,
    canVerLogs: false,
  },
  engenharia: {
    id: 'engenharia',
    titulo: 'Engenharia de Processo / Industrial',
    descricao: 'Faz a consulta e solicita reutilização de dispositivos: consulta dispositivos existentes, verifica possibilidade de reutilização, solicita reutilização e acompanha o status da solicitação. Não pode cadastrar, editar ou excluir registros.',
    badgeBg: '#ffedd5',
    badgeText: '#c2410c',
    borderColor: '#f97316',
    iconColor: '#ea580c',
    canConsultar: true,
    canCadastrar: false,
    canEditar: false,
    canExcluir: false,
    canAprovar: false,
    canSolicitar: true,
    canGerenciarUsuarios: false,
    canVerLogs: false,
  },
  gerencia: {
    id: 'gerencia',
    titulo: 'Gerência',
    descricao: 'Acompanha e consulta as informações do sistema: consulta projetos, dispositivos e reutilizações, acompanha indicadores e resultados e visualiza histórico e movimentações. Não pode cadastrar, editar, excluir ou aprovar.',
    badgeBg: '#dbeafe',
    badgeText: '#1e40af',
    borderColor: '#3b82f6',
    iconColor: '#2563eb',
    canConsultar: true,
    canCadastrar: false,
    canEditar: false,
    canExcluir: false,
    canAprovar: false,
    canSolicitar: false,
    canGerenciarUsuarios: false,
    // Auditoria é exclusiva da Administração; Gerência segue somente leitura nos dados.
    canVerLogs: false,
  },
};


