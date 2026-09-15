import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from '../data/datasources/firebase';
import { UserProfile, UserRole, ROLES_CONFIG, RoleConfig, DEFAULT_SUPERUSER } from '../domain/entities/user';
import { AuditLog } from '../domain/entities/auditLog';
import { FirestoreUsersRepository } from '../data/repositories/FirestoreUsersRepository';
import { FirestoreAuditLogRepository } from '../data/repositories/FirestoreAuditLogRepository';

const usersRepo = new FirestoreUsersRepository();
const auditRepo = new FirestoreAuditLogRepository();

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  currentRole: UserRole;
  roleConfig: RoleConfig;
  loading: boolean;
  users: UserProfile[];
  auditLogs: AuditLog[];
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, nome: string, perfil: UserRole) => Promise<void>;
  logout: () => Promise<void>;
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('retool_user_profile');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });
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
          const profile = await usersRepo.getProfile(fbUser.uid);
          if (profile) {
            if (!profile.ativo) {
              await firebaseSignOut(auth);
              setUserProfile(null);
              localStorage.removeItem('retool_user_profile');
              setLoading(false);
              return;
            }
            setUserProfile(profile);
            localStorage.setItem('retool_user_profile', JSON.stringify(profile));
          } else {
            // Se usuário existe no Auth mas não no Firestore, cria seu perfil inicial
            const isSuper = fbUser.email?.toLowerCase() === DEFAULT_SUPERUSER.email.toLowerCase();
            const newProfile: UserProfile = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              nome: isSuper ? DEFAULT_SUPERUSER.nome : (fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário'),
              perfil: isSuper ? 'admin' : 'gerencia',
              ativo: true,
              criadoEm: new Date().toISOString()
            };
            await usersRepo.setProfile(newProfile);
            setUserProfile(newProfile);
            localStorage.setItem('retool_user_profile', JSON.stringify(newProfile));
          }

          // Inscrição em tempo real para mudanças no perfil (ex: alteração de perfil feita pelo admin)
          unsubProfile = usersRepo.subscribeProfile(fbUser.uid, (updatedProfile) => {
            if (updatedProfile) {
              if (!updatedProfile.ativo) {
                firebaseSignOut(auth);
                setUserProfile(null);
                localStorage.removeItem('retool_user_profile');
              } else {
                setUserProfile(updatedProfile);
                localStorage.setItem('retool_user_profile', JSON.stringify(updatedProfile));
              }
            }
          });
        } catch (err) {
          console.error('Erro ao sincronizar perfil do usuário no Firestore:', err);
        }
      } else {
        setUserProfile(null);
        localStorage.removeItem('retool_user_profile');
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
    const isSuper = normalizedEmail === DEFAULT_SUPERUSER.email.toLowerCase();

    try {
      let cred;
      try {
        cred = await signInWithEmailAndPassword(auth, normalizedEmail, pass);
      } catch (authErr: any) {
        // Se for o Super Usuário institucional e ainda não existir no Firebase Auth, provisiona automaticamente!
        if (isSuper && (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential')) {
          cred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass || DEFAULT_SUPERUSER.senha);
          const superProfile: UserProfile = {
            uid: cred.user.uid,
            email: DEFAULT_SUPERUSER.email,
            nome: DEFAULT_SUPERUSER.nome,
            perfil: 'admin',
            ativo: true,
            criadoEm: new Date().toISOString()
          };
          await usersRepo.setProfile(superProfile);
          setUserProfile(superProfile);
          localStorage.setItem('retool_user_profile', JSON.stringify(superProfile));
          return;
        }
        throw authErr;
      }

      let profile = await usersRepo.getProfile(cred.user.uid);
      if (!profile) {
        profile = {
          uid: cred.user.uid,
          email: cred.user.email || normalizedEmail,
          nome: isSuper ? DEFAULT_SUPERUSER.nome : (cred.user.displayName || normalizedEmail.split('@')[0]),
          perfil: isSuper ? 'admin' : 'gerencia',
          ativo: true,
          criadoEm: new Date().toISOString()
        };
        await usersRepo.setProfile(profile);
      }

      if (!profile.ativo) {
        await firebaseSignOut(auth);
        setUserProfile(null);
        localStorage.removeItem('retool_user_profile');
        throw new Error('Este usuário foi desativado pela Administradora. Contate o suporte.');
      }

      setUserProfile(profile);
      localStorage.setItem('retool_user_profile', JSON.stringify(profile));
      localStorage.removeItem('retool_simulated_role');
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, pass: string, nome: string, perfil: UserRole) => {
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);
      
      // Apenas o e-mail institucional oficial do Super Usuário é forçado para admin
      const isSuperEmail = normalizedEmail === DEFAULT_SUPERUSER.email.toLowerCase();
      const finalRole: UserRole = isSuperEmail ? 'admin' : perfil;

      const newProfile: UserProfile = {
        uid: cred.user.uid,
        email: normalizedEmail,
        nome: nome.trim(),
        perfil: finalRole,
        ativo: true,
        criadoEm: new Date().toISOString()
      };

      await usersRepo.setProfile(newProfile);
      setUserProfile(newProfile);
      localStorage.setItem('retool_user_profile', JSON.stringify(newProfile));
      localStorage.removeItem('retool_simulated_role');

      // Registra log da criação de usuário
      await auditRepo.registrarLog({
        dataHora: new Date().toISOString(),
        usuarioUid: cred.user.uid,
        usuarioNome: nome,
        usuarioEmail: normalizedEmail,
        usuarioPerfil: finalRole,
        acao: 'alteracao_perfil',
        tipoEntidade: 'usuario',
        entidadeId: cred.user.uid,
        entidadeNome: nome,
        detalhes: `Novo usuário registrado com perfil ${ROLES_CONFIG[finalRole].titulo}`
      });
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Erro ao deslogar do Firebase Auth:', e);
    }
    setFirebaseUser(null);
    setUserProfile(null);
    localStorage.removeItem('retool_user_profile');
    localStorage.removeItem('retool_simulated_role');
  };

  const updateUserRole = async (uid: string, perfil: UserRole) => {
    await usersRepo.updateRole(uid, perfil);
    
    // Se o usuário atual teve o próprio perfil alterado, atualiza o estado local
    if (userProfile && userProfile.uid === uid) {
      const updated = { ...userProfile, perfil };
      setUserProfile(updated);
      localStorage.setItem('retool_user_profile', JSON.stringify(updated));
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
