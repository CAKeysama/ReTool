/** Cargos operacionais — os únicos que a Administração pode atribuir. */
export type UserRole = 'admin' | 'projetista' | 'engenharia' | 'gerencia';

/**
 * Perfil efetivo de uma conta: um cargo operacional ou `convidado`
 * (autocadastro aguardando a decisão da Administração, sem permissões).
 */
export type PerfilUsuario = UserRole | 'convidado';

/** Situação do cadastro em relação à aprovação da Administração. */
export type StatusAprovacao = 'pendente' | 'aprovado' | 'rejeitado';

export interface UserProfile {
  uid: string;
  email: string;
  nome: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
  /** Ausente em contas legadas (tratadas por `situacaoDoUsuario`). */
  statusAprovacao?: StatusAprovacao;
  /** Conta criada pela Administração com senha temporária: troca obrigatória no 1º acesso. */
  trocaSenhaObrigatoria?: boolean;
  senhaAlteradaEm?: string;
  /** Última senha temporária gerada pela Administração (Cloud Function). */
  senhaRedefinidaEm?: string;
  senhaRedefinidaPorUid?: string;
  criadoPorUid?: string;
  aprovadoPorUid?: string;
  aprovadoEm?: string;
  rejeitadoPorUid?: string;
  rejeitadoEm?: string;
  motivoRejeicao?: string;
  /** Legado: tier escolhido no antigo formulário de cadastro (não é mais gravado). */
  perfilSolicitado?: UserRole;
}

export interface RoleConfig {
  id: PerfilUsuario;
  titulo: string;
  /** Rótulo compacto para pills/áreas estreitas. */
  tituloCurto: string;
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
    tituloCurto: 'Administração',
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
    tituloCurto: 'Projetista',
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
    tituloCurto: 'Engenharia',
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
    tituloCurto: 'Gerência',
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

/** Convidado: cadastro público aguardando aprovação — nenhuma permissão. */
export const CONVIDADO_CONFIG: RoleConfig = {
  id: 'convidado',
  titulo: 'Convidado',
  tituloCurto: 'Convidado',
  descricao: 'Cadastro realizado pelo próprio colaborador e aguardando a análise da Administração. Não consulta nem altera dados até que um cargo seja definido na aprovação.',
  badgeBg: '#f3f4f6',
  badgeText: '#4b5563',
  borderColor: '#9ca3af',
  iconColor: '#6b7280',
  canConsultar: false,
  canCadastrar: false,
  canEditar: false,
  canExcluir: false,
  canAprovar: false,
  canSolicitar: false,
  canGerenciarUsuarios: false,
  canVerLogs: false,
};

/** Cargos que a Administração pode atribuir (aprovação, criação e alteração de cargo). */
export const PERFIS_ATRIBUIVEIS = Object.keys(ROLES_CONFIG) as UserRole[];

export function isPerfilAtribuivel(perfil: unknown): perfil is UserRole {
  return typeof perfil === 'string' && (PERFIS_ATRIBUIVEIS as string[]).includes(perfil);
}

/** Configuração de permissões do perfil; valores desconhecidos caem no menor privilégio. */
export function configDoPerfil(perfil?: string | null): RoleConfig {
  return isPerfilAtribuivel(perfil) ? ROLES_CONFIG[perfil] : CONVIDADO_CONFIG;
}

/** Situação de acesso derivada do perfil persistido. */
export type SituacaoUsuario = 'pendente' | 'ativo' | 'bloqueado' | 'rejeitado';

export function situacaoDoUsuario(u: Pick<UserProfile, 'ativo' | 'perfil' | 'statusAprovacao' | 'perfilSolicitado'>): SituacaoUsuario {
  if (u.statusAprovacao === 'rejeitado') return 'rejeitado';
  if (u.statusAprovacao === 'pendente') return 'pendente';
  if (u.ativo) return isPerfilAtribuivel(u.perfil) ? 'ativo' : 'pendente';
  // Legado: o autocadastro antigo gravava `perfilSolicitado` numa conta Gerência inativa.
  if (!u.statusAprovacao && u.perfil === 'gerencia' && u.perfilSolicitado) return 'pendente';
  return 'bloqueado';
}

/** Conta liberada para operar no sistema com as permissões do seu cargo. */
export function isContaOperacional(u: UserProfile | null | undefined): boolean {
  return !!u && situacaoDoUsuario(u) === 'ativo' && !u.trocaSenhaObrigatoria;
}

/** Sessões que podem permanecer abertas: operacionais e convidados em análise. */
export function podeManterSessao(u: UserProfile | null | undefined): boolean {
  if (!u) return false;
  const situacao = situacaoDoUsuario(u);
  return situacao === 'ativo' || situacao === 'pendente';
}

/**
 * Para onde a sessão autenticada deve ir: convidados só enxergam a tela
 * de análise; senha temporária só enxerga a troca de senha.
 */
export type TelaDaSessao = 'login' | 'aguardando_aprovacao' | 'troca_senha' | 'sistema';

export function telaDaSessao(u: UserProfile | null | undefined): TelaDaSessao {
  if (!podeManterSessao(u)) return 'login';
  if (situacaoDoUsuario(u!) === 'pendente') return 'aguardando_aprovacao';
  if (u!.trocaSenhaObrigatoria) return 'troca_senha';
  return 'sistema';
}

export function isAdministrador(u: UserProfile | null | undefined): boolean {
  return isContaOperacional(u) && u!.perfil === 'admin';
}

/** Mensagem exibida quando uma conta não pode iniciar sessão. */
export function mensagemAcessoNegado(u: UserProfile): string {
  if (situacaoDoUsuario(u) === 'rejeitado') {
    return `Sua solicitação de cadastro foi recusada pela Administração.${u.motivoRejeicao ? ` Motivo: ${u.motivoRejeicao}` : ''}`;
  }
  return 'Este usuário foi desativado pela Administradora. Contate o suporte.';
}


