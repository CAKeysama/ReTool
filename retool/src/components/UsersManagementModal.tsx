import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES_CONFIG, UserRole, UserProfile } from '../domain/entities/user';
import { 
  X, 
  Users, 
  UserPlus,
  AlertCircle,
  Trash2
} from 'lucide-react';

interface UsersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UsersManagementModal({ isOpen, onClose }: UsersManagementModalProps) {
  const { users, updateUserRole, toggleUserStatus, createUserByAdmin, deleteUser, userProfile } = useAuth();
  
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
    if (!userToDelete) return;
    setDeleting(true);
    setErroLista('');
    const alvo = userToDelete;
    try {
      await deleteUser(alvo.uid);
      setSucessoMsg(`Usuário ${alvo.nome} excluído do sistema.`);
      setUserToDelete(null);
    } catch (err: unknown) {
      console.error(err);
      setErroLista('Não foi possível excluir o usuário. Tente novamente.');
      setUserToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setErroAdd(err.message || 'Erro ao cadastrar usuário.');
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
          <div style={{ padding: '10px 24px', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.85rem', fontWeight: 600 }}>
            {sucessoMsg}
          </div>
        )}
        {erroLista && (
          <div style={{ padding: '10px 24px', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>
            {erroLista}
          </div>
        )}

        {/* CORPO / LISTA DE USUÁRIOS */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151' }}>
              Usuários Registrados ({users.length})
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '0.8rem' }}>
                  <AlertCircle size={16} />
                  <span>{erroAdd}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  className="btn"
                  style={{
                    backgroundColor: '#7c3aed',
                    borderColor: '#7c3aed',
                    color: 'white',
                    fontWeight: 600,
                    cursor: loadingAdd ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loadingAdd ? 'Cadastrando...' : 'Confirmar e Salvar'}
                </button>
              </div>
            </form>
          )}

          {/* TABELA DE USUÁRIOS */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4b5563' }}>Colaborador</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4b5563' }}>Perfil de Acesso</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4b5563' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4b5563', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const roleConf = ROLES_CONFIG[user.perfil] || ROLES_CONFIG.gerencia;
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
                          onChange={e => updateUserRole(user.uid, e.target.value as UserRole)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: `1.5px solid ${roleConf.borderColor}`,
                            backgroundColor: roleConf.badgeBg,
                            color: roleConf.badgeText,
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer'
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
                          onClick={() => toggleUserStatus(user.uid, !user.ativo)}
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
                          {user.ativo ? 'Bloquear Acesso' : 'Aprovar Acesso'}
                        </button>

                        <button
                          type="button"
                          onClick={() => { setErroLista(''); setSucessoMsg(''); setUserToDelete(user); }}
                          disabled={user.uid === userProfile?.uid}
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

                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                      Nenhum usuário cadastrado no Firestore. Use o botão acima para cadastrar os colaboradores da equipe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                className="btn btn-primary"
                style={{ fontWeight: 600, fontSize: '0.82rem', cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
