export type UserRole = 'admin' | 'projetista' | 'engenharia' | 'gerencia';

export interface UserProfile {
  uid: string;
  email: string;
  nome: string;
  perfil: UserRole;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
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
    descricao: 'Responsável pelo sistema, permissões, cadastros, aprovações e exclusões com rastreabilidade.',
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
    descricao: 'Atua na análise e aprovação das solicitações, cadastro e edição. Não pode excluir registros.',
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
    descricao: 'Consulta dispositivos existentes e solicita reutilizações. Não pode cadastrar, editar ou excluir.',
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
    descricao: 'Acompanha indicadores, resultados, consultas e movimentações do sistema (somente leitura).',
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
    canVerLogs: true,
  },
};

export const DEFAULT_SUPERUSER = {
  email: 'admin@retool.com',
  senha: 'admin123',
  nome: 'Super Administradora',
  perfil: 'admin' as UserRole
};

