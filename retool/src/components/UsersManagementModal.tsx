import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES_CONFIG, UserRole, UserProfile } from '../domain/entities/user';
import { 
  X, 
  Users, 
  UserPlus,
  AlertCircle,
  Trash2,
  Search,
  LoaderCircle
} from 'lucide-react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { EstadoDados, SkeletonTabela, mensagemDeErro } from './feedback';

/** Linhas renderizadas por bloco; o restante entra com "Mostrar mais". */
const LIMITE_LINHAS = 50;
/** Sem sinal de "pronto" do contexto, desiste do skeleton depois disso. */

function normalizar(texto: string | undefined): string {
  return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

interface UsersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UsersManagementModal({ isOpen, onClose }: UsersManagementModalProps) {
  const { users, usuariosProntos, updateUserRole, toggleUserStatus, createUserByAdmin, deleteUser, userProfile } = useAuth();
  const carregandoUsuarios = !usuariosProntos;

  // Filtro (com debounce) e renderização limitada
  const [filtro, setFiltroBruto] = useState('');
  const filtroAplicado = useDebouncedValue(filtro, 250);
  const [limite, setLimite] = useState(LIMITE_LINHAS);
  const setFiltro = (v: string) => { setFiltroBruto(v); setLimite(LIMITE_LINHAS); };

  const usuariosFiltrados = useMemo(() => {
    const q = normalizar(filtroAplicado.trim());
    if (!q) return users;
    return users.filter(u => normalizar(u.nome).includes(q) || normalizar(u.email).includes(q));
  }, [users, filtroAplicado]);
  const usuariosVisiveis = useMemo(() => usuariosFiltrados.slice(0, limite), [usuariosFiltrados, limite]);

  // Ações por linha (perfil / bloqueio) com trava por usuário
  const [processando, setProcessando] = useState<Record<string, 'perfil' | 'status'>>({});
  const executarNaLinha = async (user: UserProfile, tipo: 'perfil' | 'status', acao: () => Promise<void>, sucesso: string) => {
    if (processando[user.uid]) return;
    setProcessando(prev => ({ ...prev, [user.uid]: tipo }));
    setErroLista('');
    setSucessoMsg('');
    try {
      await acao();
      setSucessoMsg(sucesso);
    } catch (err: unknown) {
      console.error(err);
      setErroLista(`${user.nome}: ${mensagemDeErro(err, 'não foi possível concluir a alteração.')}`);
    } finally {
      setProcessando(prev => { const n = { ...prev }; delete n[user.uid]; return n; });
    }
  };
  
  // Estado para criar novo usuário diretamente pela administradora
  const [showAddForm, setShowAddForm] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<UserRole>('engenharia');
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [erroAdd, setErroAdd] = useState('');
  const [sucessoMsg, setSucessoMsg] = useState('');

  // Estado da exclusão de usuário (com confirmação)
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [erroLista, setErroLista] = useState('');

  const handleConfirmDelete = async () => {
    if (!userToDelete || deleting) return;
    setDeleting(true);
    setErroLista('');
    const alvo = userToDelete;
    try {
      await deleteUser(alvo.uid);
      setSucessoMsg(`Usuário ${alvo.nome} excluído do sistema.`);
      setUserToDelete(null);
    } catch (err: unknown) {
      console.error(err);
      setErroLista(mensagemDeErro(err, 'Não foi possível excluir o usuário. Tente novamente.'));
      setUserToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // Esc fecha a confirmação (se não estiver excluindo) ou o próprio modal.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (userToDelete) { if (!deleting) setUserToDelete(null); }
      else if (!loadingAdd) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, userToDelete, deleting, loadingAdd, onClose]);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingAdd) return;
    setLoadingAdd(true);
    setErroAdd('');
    setSucessoMsg('');

    try {
      if (novaSenha.length < 6) {
        throw new Error('A senha deve conter no mínimo 6 caracteres.');
      }
      await createUserByAdmin(novoEmail, novaSenha, novoNome, novoPerfil);
      setSucessoMsg(`Usuário ${novoNome} cadastrado com sucesso com o perfil ${ROLES_CONFIG[novoPerfil].titulo}!`);
      setNovoEmail('');
      setNovoNome('');
      setNovaSenha('');
      setShowAddForm(false);
    } catch (err: any) {
      setErroAdd(mensagemDeErro(err, 'Erro ao cadastrar usuário.'));
    } finally {
      setLoadingAdd(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="users-modal-title"
    >
      <div style={{
        backgroundColor: 'white',
        borderRadius: 'var(--radius)',
        maxWidth: '850px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#faf5ff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: '#7c3aed',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={20} />
            </div>
            <div>
              <h2 id="users-modal-title" style={{ margin: 0, fontSize: '1.2rem', color: '#581c87', fontWeight: 700 }}>
                Gerenciamento de Acessos & Perfis
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#7e22ce' }}>
                Crie colaboradores, atribua papéis e gerencie acessos.
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '6px',
              borderRadius: '6px'
            }}
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* MENSAGENS DE STATUS */}
        {sucessoMsg && (
          <div role="status" style={{ padding: '10px 24px', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.85rem', fontWeight: 600 }}>
            {sucessoMsg}
          </div>
        )}
        {erroLista && (
          <div role="alert" style={{ padding: '10px 24px', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>
            {erroLista}
          </div>
        )}

        {/* CORPO / LISTA DE USUÁRIOS */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151' }}>
              Usuários Registrados ({carregandoUsuarios ? '…' : users.length})
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(prev => !prev)}
              className="btn"
              style={{
                backgroundColor: showAddForm ? 'var(--color-hover)' : '#7c3aed',
                borderColor: showAddForm ? 'var(--color-border)' : '#7c3aed',
                color: showAddForm ? 'var(--color-text-dark)' : 'white',
                fontWeight: 600,
                fontSize: '0.82rem'
              }}
            >
              <UserPlus size={16} />
              <span>{showAddForm ? 'Cancelar Cadastro' : '+ Cadastrar Novo Usuário'}</span>
            </button>
          </div>

          {/* FORMULÁRIO DE NOVO USUÁRIO */}
          {showAddForm && (
            <form onSubmit={handleCreateUser} style={{
              backgroundColor: 'var(--color-hover)',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1f2937' }}>
                Criar Novo Usuário no Sistema
              </div>

              {erroAdd && (
                <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '0.8rem' }}>
                  <AlertCircle size={16} />
                  <span>{erroAdd}</span>
                </div>
              )}

              <div className="form-row-grid" style={{ gap: '12px' }}>
                <div>
                  <label className="input-label">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={novoNome}
                    onChange={e => setNovoNome(e.target.value)}
                    placeholder="Ex: Ana Beatriz"
                    className="input-field"
                    disabled={loadingAdd}
                  />
                </div>
                <div>
                  <label className="input-label">
                    E-mail Institucional
                  </label>
                  <input
                    type="email"
                    required
                    value={novoEmail}
                    onChange={e => setNovoEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="input-field"
                    disabled={loadingAdd}
                  />
                </div>
              </div>

              <div className="form-row-grid" style={{ gap: '12px' }}>
                <div>
                  <label className="input-label">
                    Senha Inicial (mín. 6 dígitos)
                  </label>
                  <input
                    type="password"
                    required
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    placeholder="••••••••"
                    className="input-field"
                    disabled={loadingAdd}
                  />
                </div>
                <div>
                  <label className="input-label">
                    Perfil de Acesso
                  </label>
                  <select
                    value={novoPerfil}
                    onChange={e => setNovoPerfil(e.target.value as UserRole)}
                    className="input-field"
                    disabled={loadingAdd}
                  >
                    {(Object.keys(ROLES_CONFIG) as UserRole[]).map(role => (
                      <option key={role} value={role}>
                        {ROLES_CONFIG[role].titulo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={loadingAdd}
                  aria-busy={loadingAdd || undefined}
                  className="btn"
                  style={{
                    backgroundColor: '#7c3aed',
                    borderColor: '#7c3aed',
                    color: 'white',
                    fontWeight: 600,
                    cursor: loadingAdd ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loadingAdd && <LoaderCircle size={16} className="estado-dados-girando" aria-hidden="true" />}
                  {loadingAdd ? 'Cadastrando…' : 'Confirmar e Salvar'}
                </button>
              </div>
            </form>
          )}

          {/* FILTRO */}
          {users.length > 0 && (
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <label htmlFor="filtro-usuarios" className="sr-only">Filtrar usuários por nome ou e-mail</label>
              <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
              <input
                id="filtro-usuarios"
                type="search"
                className="input-field"
                placeholder="Filtrar por nome ou e-mail…"
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
                autoComplete="off"
                style={{ paddingLeft: 32, minHeight: 36, fontSize: '0.88rem' }}
              />
            </div>
          )}

          {/* TABELA DE USUÁRIOS */}
          {carregandoUsuarios ? (
            <>
              <span className="sr-only" role="status">Carregando usuários…</span>
              <SkeletonTabela linhas={5} colunas={4} />
            </>
          ) : users.length === 0 ? (
            <EstadoDados
              estado="vazio"
              compacto
              titulo="Nenhum usuário encontrado"
              descricao="Use o botão acima para cadastrar os colaboradores da equipe."
            />
          ) : usuariosFiltrados.length === 0 ? (
            <EstadoDados estado="sem-resultados" compacto titulo={`Nenhum usuário corresponde a “${filtroAplicado.trim()}”`} descricao="">
              <button type="button" className="btn" onClick={() => setFiltro('')}>Limpar filtro</button>
            </EstadoDados>
          ) : (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4b5563' }}>Colaborador</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4b5563' }}>Perfil de Acesso</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4b5563' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuariosVisiveis.map(user => {
                  const roleConf = ROLES_CONFIG[user.perfil] || ROLES_CONFIG.gerencia;
                  const emAndamento = processando[user.uid];
                  return (
                    <tr key={user.uid} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{user.nome}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{user.email}</div>
                        {!user.ativo && user.perfilSolicitado && user.perfilSolicitado !== 'gerencia' && (
                          <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                            Solicitou: {ROLES_CONFIG[user.perfilSolicitado].titulo}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <select
                          value={user.perfil}
                          disabled={!!emAndamento}
                          aria-busy={emAndamento === 'perfil' || undefined}
                          aria-label={`Perfil de acesso de ${user.nome}`}
                          onChange={e => {
                            const perfil = e.target.value as UserRole;
                            executarNaLinha(user, 'perfil', () => updateUserRole(user.uid, perfil),
                              `Perfil de ${user.nome} alterado para ${ROLES_CONFIG[perfil].titulo}.`);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: `1.5px solid ${roleConf.borderColor}`,
                            backgroundColor: roleConf.badgeBg,
                            color: roleConf.badgeText,
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: emAndamento ? 'progress' : 'pointer',
                            opacity: emAndamento === 'perfil' ? 0.6 : 1
                          }}
                        >
                          {(Object.keys(ROLES_CONFIG) as UserRole[]).map(r => (
                            <option key={r} value={r}>
                              {ROLES_CONFIG[r].titulo}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {(() => {
                          const isPendente = !user.ativo && user.perfil === 'gerencia';
                          const label = user.ativo ? '● Ativo' : isPendente ? '● Aguardando Aprovação' : '● Bloqueado';
                          return (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              backgroundColor: user.ativo ? '#dcfce7' : isPendente ? '#fef3c7' : '#fee2e2',
                              color: user.ativo ? '#15803d' : isPendente ? '#b45309' : '#b91c1c'
                            }}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => executarNaLinha(user, 'status', () => toggleUserStatus(user.uid, !user.ativo),
                            user.ativo ? `Acesso de ${user.nome} bloqueado.` : `Acesso de ${user.nome} aprovado.`)}
                          disabled={!!emAndamento}
                          aria-busy={emAndamento === 'status' || undefined}
                          title={user.ativo ? 'Bloquear usuário no ReTool' : 'Aprovar/desbloquear usuário'}
                          className="btn"
                          style={{
                            borderColor: user.ativo ? '#fca5a5' : '#86efac',
                            backgroundColor: user.ativo ? '#fef2f2' : '#f0fdf4',
                            color: user.ativo ? '#b91c1c' : '#15803d',
                            padding: '4px 12px',
                            minHeight: 30,
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          {emAndamento === 'status' && <LoaderCircle size={12} className="estado-dados-girando" aria-hidden="true" />}
                          {emAndamento === 'status' ? 'Salvando…' : user.ativo ? 'Bloquear Acesso' : 'Aprovar Acesso'}
                        </button>

                        <button
                          type="button"
                          onClick={() => { setErroLista(''); setSucessoMsg(''); setUserToDelete(user); }}
                          disabled={user.uid === userProfile?.uid || !!emAndamento}
                          title={user.uid === userProfile?.uid ? 'Não é possível excluir a própria conta' : 'Excluir usuário'}
                          aria-label={`Excluir usuário ${user.nome}`}
                          className="btn btn-icon"
                          style={{
                            width: 30, height: 30, minHeight: 30, marginLeft: '6px',
                            borderColor: '#fca5a5',
                            backgroundColor: '#fef2f2',
                            color: '#b91c1c',
                            cursor: user.uid === userProfile?.uid ? 'not-allowed' : 'pointer',
                            opacity: user.uid === userProfile?.uid ? 0.4 : 1
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
          {!carregandoUsuarios && usuariosFiltrados.length > usuariosVisiveis.length && (
            <div className="lista-mostrar-mais">
              <span>Exibindo {usuariosVisiveis.length} de {usuariosFiltrados.length}</span>
              <button type="button" className="btn" onClick={() => setLimite(l => l + LIMITE_LINHAS)}>Mostrar mais</button>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#fafafa'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn"
            style={{ fontWeight: 600, fontSize: '0.85rem' }}
          >
            Concluir
          </button>
        </div>
      </div>

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      {userToDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: 'var(--radius)',
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                backgroundColor: '#fee2e2', color: '#b91c1c',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Trash2 size={18} />
              </div>
              <h3 id="delete-user-title" style={{ margin: 0, fontSize: '1rem', color: '#111827', fontWeight: 700 }}>
                Excluir usuário
              </h3>
            </div>

            <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5 }}>
              Remover <strong>{userToDelete.nome}</strong> ({userToDelete.email}) do sistema?
              Esta ação não pode ser desfeita.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={deleting}
                className="btn"
                style={{ fontWeight: 600, fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                aria-busy={deleting || undefined}
                className="btn btn-primary"
                style={{ fontWeight: 600, fontSize: '0.82rem', cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                {deleting && <LoaderCircle size={16} className="estado-dados-girando" aria-hidden="true" />}
                {deleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
