import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getAuth,
  deleteUser as deleteAuthUser,
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth, getSecondaryAuthApp } from '../data/datasources/firebase';
import {
  UserProfile, UserRole, PerfilUsuario, RoleConfig,
  ROLES_CONFIG, configDoPerfil, situacaoDoUsuario, podeManterSessao, isContaOperacional,
  isAdministrador, mensagemAcessoNegado
} from '../domain/entities/user';
import { Notificacao } from '../domain/entities/notificacao';
import { SolicitacaoCargo } from '../domain/entities/solicitacaoCargo';
import { FirestoreUsersRepository } from '../data/repositories/FirestoreUsersRepository';
import { FirestoreAuditLogRepository } from '../data/repositories/FirestoreAuditLogRepository';
import { FirestoreNotificationsRepository } from '../data/repositories/FirestoreNotificationsRepository';
import { FirestoreSolicitacoesCargoRepository } from '../data/repositories/FirestoreSolicitacoesCargoRepository';
import { FirebaseContasService, traduzirErroFuncao } from '../data/services/FirebaseContasService';
import { SolicitarCadastroUseCase } from '../application/usecases/SolicitarCadastroUseCase';
import { DecidirCadastroUseCase } from '../application/usecases/DecidirCadastroUseCase';
import { CriarContaAdministrativaUseCase, ContaAuthCriada, ContaCriada } from '../application/usecases/CriarContaAdministrativaUseCase';
import { ConcluirTrocaSenhaUseCase } from '../application/usecases/ConcluirTrocaSenhaUseCase';
import { SolicitarAlteracaoCargoUseCase } from '../application/usecases/SolicitarAlteracaoCargoUseCase';
import { DecidirSolicitacaoCargoUseCase } from '../application/usecases/DecidirSolicitacaoCargoUseCase';
import { ErroPermissao, ErroValidacao, autorAuditoria, registrarAuditoriaSemFalhar } from '../application/usecases/acessosComum';

const usersRepo = new FirestoreUsersRepository();
const auditRepo = new FirestoreAuditLogRepository();
const notificationsRepo = new FirestoreNotificationsRepository();
const solicitacoesCargoRepo = new FirestoreSolicitacoesCargoRepository();
const contasService = new FirebaseContasService();

/**
 * Cria a conta de autenticação num app Firebase secundário: a sessão da
 * administradora não é substituída. O Firebase Auth guarda só o hash da senha.
 */
async function criarContaNoAuthSecundario(email: string, senha: string): Promise<ContaAuthCriada> {
  const secondaryAuth = getAuth(getSecondaryAuthApp());
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);
  return {
    uid: cred.user.uid,
    desfazer: () => deleteAuthUser(cred.user),
    finalizar: () => firebaseSignOut(secondaryAuth)
  };
}

/** Reautentica com a senha atual (temporária) e grava a nova no Firebase Auth. */
async function atualizarSenhaNoAuth(senhaAtual: string, novaSenha: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Sua sessão expirou. Entre novamente para trocar a senha.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, senhaAtual));
  await updatePassword(user, novaSenha);
}

const solicitarCadastroUseCase = new SolicitarCadastroUseCase(usersRepo, auditRepo, notificationsRepo);
const decidirCadastroUseCase = new DecidirCadastroUseCase(usersRepo, auditRepo, notificationsRepo);
const criarContaUseCase = new CriarContaAdministrativaUseCase(usersRepo, auditRepo, criarContaNoAuthSecundario);
const concluirTrocaSenhaUseCase = new ConcluirTrocaSenhaUseCase(usersRepo, auditRepo, atualizarSenhaNoAuth);
const solicitarCargoUseCase = new SolicitarAlteracaoCargoUseCase(solicitacoesCargoRepo, usersRepo, auditRepo, notificationsRepo);
const decidirCargoUseCase = new DecidirSolicitacaoCargoUseCase(solicitacoesCargoRepo, usersRepo, auditRepo, notificationsRepo);

/** Traduz códigos do Firebase Auth para mensagens amigáveis. */
export function traduzirErroAuth(err: unknown): string {
  const erroFuncao = traduzirErroFuncao(err);
  if (erroFuncao) return erroFuncao;
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
    case 'auth/requires-recent-login':
      return 'Por segurança, entre novamente e repita a operação.';
    case 'permission-denied':
      return 'Operação recusada pelas regras de segurança do servidor.';
    default:
      return (err as Error)?.message || 'Erro ao processar autenticação.';
  }
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  currentRole: PerfilUsuario;
  roleConfig: RoleConfig;
  /** Conta ativa, aprovada e sem troca de senha pendente. */
  isOperacional: boolean;
  loading: boolean;
  users: UserProfile[];
  estadoUsuarios: EstadoSincronizacao;
  /** Administração: todas as solicitações de cargo; demais perfis: as próprias. */
  solicitacoesCargo: SolicitacaoCargo[];
  estadoSolicitacoesCargo: EstadoSincronizacao;
  login: (email: string, pass: string) => Promise<void>;
  /** Autocadastro: sempre Convidado aguardando aprovação (sem escolha de cargo). */
  register: (email: string, pass: string, nome: string) => Promise<void>;
  logout: () => Promise<void>;
  decidirCadastro: (uid: string, aprovar: boolean, perfil?: UserRole, motivo?: string) => Promise<void>;
  /** Exclusivo da Administração: cria a conta com senha temporária (retornada uma única vez). */
  criarContaComSenhaTemporaria: (nome: string, email: string, perfil: UserRole) => Promise<ContaCriada>;
  concluirTrocaSenha: (senhaAtual: string, novaSenha: string, confirmacao: string) => Promise<void>;
  /** Exclusivo da Administração (Cloud Function): nova senha temporária para outra conta, devolvida uma única vez. */
  redefinirSenhaTemporaria: (uid: string) => Promise<string>;
  solicitarAlteracaoCargo: (perfil: UserRole, justificativa?: string) => Promise<void>;
  decidirSolicitacaoCargo: (id: string, aprovar: boolean, motivo?: string) => Promise<void>;
  // Notificações do usuário autenticado
  notifications: Notificacao[];
  criarNotificacao: (n: Notificacao) => Promise<void>;
  marcarNotificacaoLida: (id: string, lida: boolean) => Promise<void>;
  marcarNotificacaoResolvida: (id: string, resolvida: boolean) => Promise<void>;
  updateUserRole: (uid: string, perfil: UserRole) => Promise<void>;
  toggleUserStatus: (uid: string, ativo: boolean) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
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

export type EstadoSincronizacao = 'carregando' | 'pronto' | 'erro';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [solicitacoesCargo, setSolicitacoesCargo] = useState<SolicitacaoCargo[]>([]);
  // Estados de sincronização exibidos nas telas administrativas.
  const [estadoUsuarios, setEstadoUsuarios] = useState<EstadoSincronizacao>('carregando');
  const [estadoSolicitacoesCargo, setEstadoSolicitacoesCargo] = useState<EstadoSincronizacao>('carregando');

  const unsubProfileRef = useRef<(() => void) | null>(null);
  // register()/login() conduzem a própria sessão; o listener não interfere.
  const registrandoRef = useRef(false);
  const loginEmAndamentoRef = useRef(false);

  const isOperacional = isContaOperacional(userProfile);
  const isAdmin = isAdministrador(userProfile);

  const encerrarAssinaturaPerfil = useCallback(() => {
    unsubProfileRef.current?.();
    unsubProfileRef.current = null;
  }, []);

  /**
   * Acompanha o perfil em tempo real: aprovação do convidado, troca de
   * cargo, bloqueio ou exclusão pela Administração refletem na hora.
   */
  const acompanharPerfil = useCallback((uid: string) => {
    encerrarAssinaturaPerfil();
    unsubProfileRef.current = usersRepo.subscribeProfile(uid, (atualizado) => {
      if (!podeManterSessao(atualizado)) {
        encerrarAssinaturaPerfil();
        firebaseSignOut(auth).catch(() => undefined);
        setUserProfile(null);
        return;
      }
      setUserProfile(atualizado);
    });
  }, [encerrarAssinaturaPerfil]);

  // Lista de usuários: apenas contas operacionais (convidados não enxergam colegas).
  useEffect(() => {
    if (!isOperacional) {
      setUsers([]);
      setEstadoUsuarios('carregando');
      return;
    }
    setEstadoUsuarios('carregando');
    return usersRepo.subscribeAll(
      (lista) => { setUsers(lista); setEstadoUsuarios('pronto'); },
      () => setEstadoUsuarios('erro')
    );
  }, [isOperacional]);

  // Solicitações de cargo: Administração vê todas; os demais, só as próprias.
  useEffect(() => {
    if (!isOperacional || !userProfile?.uid) {
      setSolicitacoesCargo([]);
      setEstadoSolicitacoesCargo('carregando');
      return;
    }
    setEstadoSolicitacoesCargo('carregando');
    const aoReceber = (lista: SolicitacaoCargo[]) => { setSolicitacoesCargo(lista); setEstadoSolicitacoesCargo('pronto'); };
    const aoFalhar = () => setEstadoSolicitacoesCargo('erro');
    return isAdmin
      ? solicitacoesCargoRepo.subscribeTodas(aoReceber, aoFalhar)
      : solicitacoesCargoRepo.subscribeDoUsuario(userProfile.uid, aoReceber, aoFalhar);
  }, [isOperacional, isAdmin, userProfile?.uid]);

  // Notificações do usuário autenticado, em tempo real
  useEffect(() => {
    if (!userProfile?.uid) {
      setNotifications([]);
      return;
    }
    return notificationsRepo.subscribeParaUsuario(userProfile.uid, setNotifications);
  }, [userProfile?.uid]);

  // Monitora autenticação do Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      encerrarAssinaturaPerfil();

      if (!fbUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }
      if (registrandoRef.current) return;

      setLoading(true);
      try {
        let profile = await usersRepo.getProfile(fbUser.uid);

        if (!profile) {
          // Autenticado sem perfil (conta criada fora do app ou cadastro
          // interrompido): entra como Convidado aguardando aprovação.
          profile = await solicitarCadastroUseCase.execute({
            uid: fbUser.uid,
            email: fbUser.email || '',
            nome: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário'
          });
        }

        if (!podeManterSessao(profile)) {
          // Bloqueado/recusado: login() exibe o motivo e encerra a sessão.
          if (!loginEmAndamentoRef.current) await firebaseSignOut(auth);
          setUserProfile(null);
          return;
        }

        setUserProfile(profile);
        acompanharPerfil(fbUser.uid);
      } catch (err) {
        console.error('Erro ao sincronizar perfil do usuário no Firestore:', err);
        await firebaseSignOut(auth).catch(() => undefined);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      encerrarAssinaturaPerfil();
    };
  }, [acompanharPerfil, encerrarAssinaturaPerfil]);

  const login = async (email: string, pass: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    loginEmAndamentoRef.current = true;
    try {
      const cred = await signInWithEmailAndPassword(auth, normalizedEmail, pass);
      const profile = await usersRepo.getProfile(cred.user.uid).catch(() => null);

      if (profile && !podeManterSessao(profile)) {
        await registrarAuditoriaSemFalhar(auditRepo, {
          ...autorAuditoria(profile),
          acao: 'login',
          resultado: 'negado',
          acaoDescricao: situacaoDoUsuario(profile) === 'rejeitado'
            ? 'Acesso recusado: cadastro rejeitado pela Administração'
            : 'Acesso recusado: conta bloqueada',
          tipoEntidade: 'sessao',
          entidadeId: profile.uid,
          entidadeNome: profile.nome
        });
        await firebaseSignOut(auth);
        throw new Error(mensagemAcessoNegado(profile));
      }

      const situacao = profile ? situacaoDoUsuario(profile) : 'pendente';
      await registrarAuditoriaSemFalhar(auditRepo, {
        usuarioUid: cred.user.uid,
        usuarioNome: profile?.nome || normalizedEmail,
        usuarioEmail: normalizedEmail,
        usuarioPerfil: profile?.perfil || 'convidado',
        acao: 'login',
        acaoDescricao: profile?.trocaSenhaObrigatoria
          ? 'Entrou com senha temporária (troca obrigatória pendente)'
          : situacao === 'pendente'
            ? 'Entrou como Convidado (cadastro aguardando aprovação)'
            : 'Entrou no sistema',
        tipoEntidade: 'sessao',
        entidadeId: cred.user.uid,
        entidadeNome: profile?.nome || normalizedEmail,
        conteudo: { situacao, trocaSenhaObrigatoria: !!profile?.trocaSenhaObrigatoria }
      });
    } finally {
      loginEmAndamentoRef.current = false;
    }
  };

  const register = async (email: string, pass: string, nome: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!nome.trim()) throw new ErroValidacao('Por favor, informe seu nome completo.');

    registrandoRef.current = true;
    let criado: FirebaseUser | null = null;
    try {
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);
      criado = cred.user;
      const profile = await solicitarCadastroUseCase.execute({ uid: cred.user.uid, email: normalizedEmail, nome });
      // A sessão continua aberta como Convidado: o app exibe a tela de
      // "aguardando aprovação" e libera o acesso assim que houver decisão.
      setUserProfile(profile);
      acompanharPerfil(cred.user.uid);
    } catch (e) {
      // Cadastro incompleto não deixa conta de autenticação órfã.
      if (criado) await deleteAuthUser(criado).catch(() => firebaseSignOut(auth).catch(() => undefined));
      throw e;
    } finally {
      registrandoRef.current = false;
      setLoading(false);
    }
  };

  const logout = async () => {
    if (userProfile) {
      await registrarAuditoriaSemFalhar(auditRepo, {
        ...autorAuditoria(userProfile),
        acao: 'logout',
        acaoDescricao: 'Saiu do sistema',
        tipoEntidade: 'sessao',
        entidadeId: userProfile.uid,
        entidadeNome: userProfile.nome
      });
    }
    encerrarAssinaturaPerfil();
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Erro ao deslogar do Firebase Auth:', e);
    }
    setFirebaseUser(null);
    setUserProfile(null);
  };

  const exigirAdministracao = () => {
    if (!isAdministrador(userProfile)) throw new ErroPermissao();
  };

  const decidirCadastro = async (uid: string, aprovar: boolean, perfil?: UserRole, motivo?: string) => {
    await decidirCadastroUseCase.execute({ admin: userProfile, alvoUid: uid, aprovar, perfil, motivo });
  };

  const criarContaComSenhaTemporaria = (nome: string, email: string, perfil: UserRole) =>
    criarContaUseCase.execute({ admin: userProfile, nome, email, perfil });

  const concluirTrocaSenha = async (senhaAtual: string, novaSenha: string, confirmacao: string) => {
    if (!userProfile) throw new Error('Sua sessão expirou. Entre novamente.');
    await concluirTrocaSenhaUseCase.execute({ usuario: userProfile, senhaAtual, novaSenha, confirmacao });
    setUserProfile({ ...userProfile, trocaSenhaObrigatoria: false });
  };

  const redefinirSenhaTemporaria = async (uid: string) => {
    // Pré-checagem de UX; a autorização real é refeita na Cloud Function.
    exigirAdministracao();
    if (uid === userProfile!.uid) throw new ErroPermissao('A própria senha não é redefinida por aqui.');
    return contasService.redefinirSenhaTemporaria(uid);
  };

  const solicitarAlteracaoCargo = async (perfil: UserRole, justificativa?: string) => {
    await solicitarCargoUseCase.execute({ usuario: userProfile, perfilSolicitado: perfil, justificativa });
  };

  const decidirSolicitacaoCargo = async (id: string, aprovar: boolean, motivo?: string) => {
    await decidirCargoUseCase.execute({ admin: userProfile, solicitacaoId: id, aprovar, motivo });
  };

  const registrarAcaoAdministrativa = (input: Omit<Parameters<typeof auditRepo.registrarLog>[0], 'usuarioUid' | 'usuarioNome' | 'usuarioEmail' | 'usuarioPerfil'>) =>
    registrarAuditoriaSemFalhar(auditRepo, { ...autorAuditoria(userProfile!), ...input });

  const updateUserRole = async (uid: string, perfil: UserRole) => {
    exigirAdministracao();
    if (uid === userProfile!.uid) throw new ErroPermissao('A Administração não altera o próprio cargo.');
    const targetUser = users.find(u => u.uid === uid);
    await usersRepo.updateRole(uid, perfil);
    await registrarAcaoAdministrativa({
      acao: 'alteracao_perfil',
      acaoDescricao: `Alterou o cargo de ${targetUser?.nome || uid} para ${ROLES_CONFIG[perfil].titulo}`,
      tipoEntidade: 'usuario',
      entidadeId: uid,
      entidadeNome: targetUser?.nome || uid,
      detalhes: `Perfil de ${targetUser?.nome || uid} alterado para ${ROLES_CONFIG[perfil].titulo}`,
      conteudo: { perfilNovo: perfil },
      dadosAnteriores: targetUser ? { perfil: targetUser.perfil } : undefined
    });
  };

  const toggleUserStatus = async (uid: string, ativo: boolean) => {
    exigirAdministracao();
    if (uid === userProfile!.uid) throw new ErroPermissao('A Administração não bloqueia a própria conta.');
    const targetUser = users.find(u => u.uid === uid);
    if (targetUser && situacaoDoUsuario(targetUser) === 'pendente') {
      throw new ErroValidacao('Cadastros pendentes são liberados pela aprovação, com definição de cargo.');
    }
    await usersRepo.updateStatus(uid, ativo);
    await registrarAcaoAdministrativa({
      acao: ativo ? 'desbloqueio_usuario' : 'bloqueio_usuario',
      acaoDescricao: ativo ? `Desbloqueou ${targetUser?.nome || uid}` : `Bloqueou ${targetUser?.nome || uid}`,
      tipoEntidade: 'usuario',
      entidadeId: uid,
      entidadeNome: targetUser?.nome || uid,
      detalhes: ativo ? 'Usuário desbloqueado' : 'Usuário bloqueado no sistema',
      dadosAnteriores: targetUser ? { ativo: targetUser.ativo } : undefined
    });
  };

  const deleteUser = async (uid: string) => {
    exigirAdministracao();
    if (uid === userProfile!.uid) throw new ErroPermissao('A própria conta não pode ser excluída.');
    const targetUser = users.find(u => u.uid === uid);
    await usersRepo.deleteProfile(uid);
    await registrarAcaoAdministrativa({
      acao: 'exclusao',
      acaoDescricao: `Excluiu o usuário ${targetUser?.nome || uid}`,
      tipoEntidade: 'usuario',
      entidadeId: uid,
      entidadeNome: targetUser?.nome || uid,
      detalhes: `Exclusão do registro [USUARIO]: ${targetUser?.nome || uid}`,
      dadosAnteriores: targetUser
        ? { nome: targetUser.nome, email: targetUser.email, perfil: targetUser.perfil, ativo: targetUser.ativo }
        : undefined
    });
  };

  const criarNotificacao = useCallback(async (n: Notificacao) => {
    await notificationsRepo.criar(n);
  }, []);

  const marcarNotificacaoLida = useCallback(async (id: string, lida: boolean) => {
    await notificationsRepo.marcarLida(id, lida);
  }, []);

  const marcarNotificacaoResolvida = useCallback(async (id: string, resolvida: boolean) => {
    await notificationsRepo.marcarResolvida(id, resolvida);
  }, []);

  // Perfil efetivo em execução: sem conta operacional, menor privilégio (Convidado).
  const currentRole: PerfilUsuario = userProfile?.perfil || 'convidado';
  const roleConfig = isOperacional ? configDoPerfil(currentRole) : configDoPerfil('convidado');

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        currentRole: isOperacional ? currentRole : 'convidado',
        roleConfig,
        isOperacional,
        loading,
        users,
        estadoUsuarios,
        solicitacoesCargo,
        estadoSolicitacoesCargo,
        login,
        register,
        logout,
        decidirCadastro,
        criarContaComSenhaTemporaria,
        concluirTrocaSenha,
        redefinirSenhaTemporaria,
        solicitarAlteracaoCargo,
        decidirSolicitacaoCargo,
        updateUserRole,
        toggleUserStatus,
        deleteUser,
        notifications,
        criarNotificacao,
        marcarNotificacaoLida,
        marcarNotificacaoResolvida,
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

