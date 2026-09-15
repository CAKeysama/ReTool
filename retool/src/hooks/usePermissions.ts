import { useAuth } from '../context/AuthContext';
import { ROLES_CONFIG, UserRole } from '../domain/entities/user';

export function usePermissions() {
  const { 
    currentRole, 
    roleConfig, 
    canConsultar, 
    canCadastrar, 
    canEditar, 
    canExcluir, 
    canAprovar, 
    canSolicitar, 
    canGerenciarUsuarios, 
    canVerLogs,
    userProfile,
  } = useAuth();

  return {
    currentRole,
    roleConfig,
    roleTitle: roleConfig.titulo,
    roleDescription: roleConfig.descricao,
    badgeBg: roleConfig.badgeBg,
    badgeText: roleConfig.badgeText,
    borderColor: roleConfig.borderColor,
    iconColor: roleConfig.iconColor,
    canConsultar,
    canCadastrar,
    canEditar,
    canExcluir,
    canAprovar,
    canSolicitar,
    canGerenciarUsuarios,
    canVerLogs,
    isAdmin: currentRole === 'admin',
    isProjetista: currentRole === 'projetista',
    isEngenharia: currentRole === 'engenharia',
    isGerencia: currentRole === 'gerencia',
    userProfile,
    allRoles: Object.values(ROLES_CONFIG)
  };
}
