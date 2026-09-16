import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getAuth,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth, getSecondaryAuthApp } from '../data/datasources/firebase';
import { UserProfile, UserRole, ROLES_CONFIG, RoleConfig } from '../domain/entities/user';
import { AuditLog } from '../domain/entities/auditLog';
import { FirestoreUsersRepository } from '../data/repositories/FirestoreUsersRepository';
import { FirestoreAuditLogRepository } from '../data/repositories/FirestoreAuditLogRepository';

const usersRepo = new FirestoreUsersRepository();
const auditRepo = new FirestoreAuditLogRepository();

/** Traduz códigos do Firebase Auth para mensagens amigáveis. */
export function traduzirErroAuth(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado no sistema.';
    case 'auth/weak-password':
      return 'A senha deve conter no mínimo 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
    case 'auth/invalid-email':
      return 'Informe um e-mail válido.';
    case 'auth/network-request-failed':
      return 'Falha de conexão. Verifique sua internet e tente novamente.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada pela Administradora. Contate o suporte.';
    default:
      return (err as Error)?.message || 'Erro ao processar autenticação.';
  }
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  currentRole: UserRole;
  roleConfig: RoleConfig;
  loading: boolean;
  users: UserProfile[];
  auditLogs: AuditLog[];
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, nome: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Exclusivo da Administração: cria conta com o perfil indicado via app
   *  secundário do Firebase, preservando a sessão da administradora. */
  createUserByAdmin: (email: string, pass: string, nome: string, perfil: UserRole) => Promise<void>;
  updateUserRole: (uid: string, perfil: UserRole) => Promise<void>;
  toggleUserStatus: (uid: string, ativo: boolean) => Promise<void>;
  registrarExclusaoComAuditoria: (
    tipoEntidade: AuditLog['tipoEntidade'],
    entidadeId: string,
    entidadeNome?: string,
    dadosAnteriores?: Record<string, any>
  ) => Promise<void>;
  // Atalhos de permissão
  canConsultar: boolean;
  canCadastrar: boolean;
  canEditar: boolean;
  canExcluir: boolean;
  canAprovar: boolean;
  canSolicitar: boolean;
  canGerenciarUsuarios: boolean;
  canVerLogs: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Criação de conta pública: SEMPRE gera um perfil restrito (Gerência) e
 * inativo, aguardando aprovação da Administração. Jamais aceita um perfil
 * escolhido pelo próprio visitante — e as regras do Firestore também
 * recusam qualquer tentativa direta de escrita diferente disso.
 */
async function criarPerfilRestrito(user: FirebaseUser, nome: string): Promise<void> {
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    nome,
    perfil: 'gerencia',
    ativo: false,
    criadoEm: new Date().toISOString()
  };
  await usersRepo.setProfile(profile);
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Carrega lista de usuários em tempo real para administração
  useEffect(() => {
    const unsubUsers = usersRepo.subscribeAll(setUsers);
    const unsubLogs = auditRepo.subscribeLogs(setAuditLogs);
    return () => {
      unsubUsers();
      unsubLogs();
    };
  }, []);

  // Monitora autenticação do Firebase Auth
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (fbUser) {
        try {
          let profile = await usersRepo.getProfile(fbUser.uid);

          if (!profile) {
            // Autenticado sem perfil no Firestore: provisiona conta
            // restrita (Gerência) e pendente de aprovação. Se as regras do
            // Firestore recusarem a escrita, encerra a sessão.
            try {
              await criarPerfilRestrito(
                fbUser,
                fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário'
              );
              profile = await usersRepo.getProfile(fbUser.uid);
            } catch (e) {
              console.warn('Não foi possível provisionar perfil para o usuário:', e);
            }
          }

          if (!profile || !profile.ativo) {
            await firebaseSignOut(auth);
            setUserProfile(null);
            setLoading(false);
            return;
          }

          setUserProfile(profile);

          // Inscrição em tempo real para mudanças no perfil (ex.: alteração
          // de papel ou bloqueio feitos pela Administração).
          unsubProfile = usersRepo.subscribeProfile(fbUser.uid, (updatedProfile) => {
            if (updatedProfile) {
              if (!updatedProfile.ativo) {
                firebaseSignOut(auth);
                setUserProfile(null);
              } else {
                setUserProfile(updatedProfile);
              }
            }
          });
        } catch (err) {
          console.error('Erro ao sincronizar perfil do usuário no Firestore:', err);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const cred = await signInWithEmailAndPassword(auth, normalizedEmail, pass);
      const profile = await usersRepo.getProfile(cred.user.uid);

      if (!profile) {
        // Conta no Auth sem perfil (provisionada fora do fluxo da aplicação).
        await firebaseSignOut(auth);
        throw new Error(
          'Esta conta não possui um perfil vinculado no ReTool. Solicite à Administração a configuração do seu acesso.'
        );
      }

      if (!profile.ativo) {
        await firebaseSignOut(auth);
        setUserProfile(null);
        throw new Error(
          profile.perfil === 'gerencia'
            ? 'Sua conta foi criada e está aguardando aprovação da Administradora.'
            : 'Este usuário foi desativado pela Administradora. Contate o suporte.'
        );
      }

      setUserProfile(profile);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, pass: string, nome: string) => {
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);
      await criarPerfilRestrito(cred.user, nome.trim());

      await auditRepo.registrarLog({
        dataHora: new Date().toISOString(),
        usuarioUid: cred.user.uid,
        usuarioNome: nome.trim(),
        usuarioEmail: normalizedEmail,
        usuarioPerfil: 'gerencia',
        acao: 'alteracao_perfil',
        tipoEntidade: 'usuario',
        entidadeId: cred.user.uid,
        entidadeNome: nome.trim(),
        detalhes: 'Novo usuário registrado com perfil restrito (Gerência), aguardando aprovação da Administradora.'
      });

      // Encerra a sessão: contas pendentes não podem circular pela aplicação
      // nem mesmo com o perfil limitado — o acesso só inicia após aprovação.
      await firebaseSignOut(auth);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const createUserByAdmin = async (email: string, pass: string, nome: string, perfil: UserRole) => {
    const normalizedEmail = email.trim().toLowerCase();

    // App secundário: a conta criada NÃO substitui a sessão da administradora.
    const secondaryAuth = getAuth(getSecondaryAuthApp());
    const cred = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, pass);

    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email: normalizedEmail,
      nome: nome.trim(),
      perfil,
      ativo: true,
      criadoEm: new Date().toISOString()
    };

    try {
      await usersRepo.setProfile(newProfile);
    } finally {
      // Encerra apenas a sessão efêmera do app secundário.
      await firebaseSignOut(secondaryAuth).catch(() => undefined);
    }

    await auditRepo.registrarLog({
      dataHora: new Date().toISOString(),
      usuarioUid: userProfile?.uid || 'desconhecido',
      usuarioNome: userProfile?.nome || 'Administradora',
      usuarioEmail: userProfile?.email || '',
      usuarioPerfil: userProfile?.perfil || 'admin',
      acao: 'alteracao_perfil',
      tipoEntidade: 'usuario',
      entidadeId: cred.user.uid,
      entidadeNome: nome.trim(),
      detalhes: `Usuário provisionado pela Administração com perfil ${ROLES_CONFIG[perfil].titulo}`
    });
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Erro ao deslogar do Firebase Auth:', e);
    }
    setFirebaseUser(null);
    setUserProfile(null);
  };

  const updateUserRole = async (uid: string, perfil: UserRole) => {
    await usersRepo.updateRole(uid, perfil);

    // Se o usuário atual teve o próprio perfil alterado, atualiza o estado local
    if (userProfile && userProfile.uid === uid) {
      setUserProfile({ ...userProfile, perfil });
    }

    const targetUser = users.find(u => u.uid === uid);
    await auditRepo.registrarLog({
      dataHora: new Date().toISOString(),
      usuarioUid: userProfile?.uid || 'desconhecido',
      usuarioNome: userProfile?.nome || 'Administradora',
      usuarioEmail: userProfile?.email || '',
      usuarioPerfil: userProfile?.perfil || 'admin',
      acao: 'alteracao_perfil',
      tipoEntidade: 'usuario',
      entidadeId: uid,
      entidadeNome: targetUser?.nome || uid,
      detalhes: `Perfil de ${targetUser?.nome || uid} alterado para ${ROLES_CONFIG[perfil].titulo}`
    });
  };

  const toggleUserStatus = async (uid: string, ativo: boolean) => {
    await usersRepo.updateStatus(uid, ativo);
    const targetUser = users.find(u => u.uid === uid);
    await auditRepo.registrarLog({
      dataHora: new Date().toISOString(),
      usuarioUid: userProfile?.uid || 'desconhecido',
      usuarioNome: userProfile?.nome || 'Administradora',
      usuarioEmail: userProfile?.email || '',
      usuarioPerfil: userProfile?.perfil || 'admin',
      acao: ativo ? 'desbloqueio_usuario' : 'bloqueio_usuario',
      tipoEntidade: 'usuario',
      entidadeId: uid,
      entidadeNome: targetUser?.nome || uid,
      detalhes: ativo ? 'Usuário desbloqueado' : 'Usuário bloqueado no sistema'
    });
  };

  const registrarExclusaoComAuditoria = useCallback(async (
    tipoEntidade: AuditLog['tipoEntidade'],
    entidadeId: string,
    entidadeNome?: string,
    dadosAnteriores?: Record<string, any>
  ) => {
    await auditRepo.registrarLog({
      dataHora: new Date().toISOString(),
      usuarioUid: userProfile?.uid || 'sistema',
      usuarioNome: userProfile?.nome || 'Administradora',
      usuarioEmail: userProfile?.email || '',
      usuarioPerfil: userProfile?.perfil || 'admin',
      acao: 'exclusao',
      tipoEntidade,
      entidadeId,
      entidadeNome: entidadeNome || entidadeId,
      detalhes: `Exclusão do registro [${tipoEntidade.toUpperCase()}]: ${entidadeNome || entidadeId}`,
      dadosAnteriores
    });
  }, [userProfile]);

  // Perfil efetivo em execução (estritamente do usuário autenticado)
  const currentRole: UserRole = userProfile?.perfil || 'gerencia';
  const roleConfig = ROLES_CONFIG[currentRole] || ROLES_CONFIG.gerencia;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        currentRole,
        roleConfig,
        loading,
        users,
        auditLogs,
        login,
        register,
        logout,
        createUserByAdmin,
        updateUserRole,
        toggleUserStatus,
        registrarExclusaoComAuditoria,
        canConsultar: roleConfig.canConsultar,
        canCadastrar: roleConfig.canCadastrar,
        canEditar: roleConfig.canEditar,
        canExcluir: roleConfig.canExcluir,
        canAprovar: roleConfig.canAprovar,
        canSolicitar: roleConfig.canSolicitar,
        canGerenciarUsuarios: roleConfig.canGerenciarUsuarios,
        canVerLogs: roleConfig.canVerLogs
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
