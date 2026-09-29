import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Trash2, Copy, Check, KeyRound, Search } from 'lucide-react';
import { useAuth, traduzirErroAuth } from '../../context/AuthContext';
import {
  PERFIS_ATRIBUIVEIS, ROLES_CONFIG, UserProfile, UserRole, SituacaoUsuario,
  configDoPerfil, situacaoDoUsuario, isPerfilAtribuivel
} from '../../domain/entities/user';
import { Aviso, EstadoCarregando, EstadoErro } from '../Feedback';
import { Pill, SituacaoBadge, SITUACAO_VISUAL } from '../Badges';
import { estiloBotaoAcao, tabelaAdmin } from './estilos';

interface SenhaExibida {
  titulo: string;
  email: string;
  senhaTemporaria: string;
}

/**
 * Gestão de contas pela Administração: criação com senha temporária
 * gerada pelo sistema, nova senha temporária (Cloud Function), alteração
 * de cargo, bloqueio e exclusão.
 */
export function UsuariosPanel() {
  const { users, estadoUsuarios, userProfile, criarContaComSenhaTemporaria, redefinirSenhaTemporaria, updateUserRole, toggleUserStatus, deleteUser } = useAuth();
  const navigate = useNavigate();

  const [showAddForm, setShowAddForm] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<UserRole>('engenharia');
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [erroAdd, setErroAdd] = useState('');

  // A senha temporária vive apenas neste estado em memória: é exibida uma
  // vez e descartada ao concluir ou ao sair da tela (nunca vai para URL,
  // storage ou auditoria).
  const [senhaExibida, setSenhaExibida] = useState<SenhaExibida | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);

  const [aviso, setAviso] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [processandoUid, setProcessandoUid] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<'todas' | SituacaoUsuario>('todas');

  const listados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return users
      .filter(u => filtroSituacao === 'todas' || situacaoDoUsuario(u) === filtroSituacao)
      .filter(u => !q || u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  }, [users, busca, filtroSituacao]);

  if (estadoUsuarios === 'carregando') return <EstadoCarregando mensagem="Carregando usuários..." />;
  if (estadoUsuarios === 'erro') {
    return <EstadoErro mensagem="Não foi possível carregar os usuários. Verifique sua conexão e se as regras do Firestore foram publicadas." />;
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAdd(true);
    setErroAdd('');
    setAviso(null);
    try {
      const { senhaTemporaria, perfil } = await criarContaComSenhaTemporaria(novoNome, novoEmail, novoPerfil);
      setSenhaExibida({ titulo: `Conta criada: ${perfil.nome} (${ROLES_CONFIG[novoPerfil].titulo})`, email: perfil.email, senhaTemporaria });
      setCopiado(false);
      setNovoEmail('');
      setNovoNome('');
      setShowAddForm(false);
    } catch (err) {
      setErroAdd(traduzirErroAuth(err));
    } finally {
      setLoadingAdd(false);
    }
  };

  const copiarSenha = async () => {
    if (!senhaExibida) return;
    try {
      await navigator.clipboard.writeText(senhaExibida.senhaTemporaria);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  const executar = async (uid: string, acao: () => Promise<void>, sucesso: string) => {
    setProcessandoUid(uid);
    setAviso(null);
    try {
      await acao();
      setAviso({ tipo: 'sucesso', texto: sucesso });
    } catch (err) {
      setAviso({ tipo: 'erro', texto: traduzirErroAuth(err) });
    } finally {
      setProcessandoUid(null);
    }
  };

  const handleConfirmReset = async () => {
    if (!userToReset) return;
    const alvo = userToReset;
    setProcessandoUid(alvo.uid);
    setAviso(null);
    try {
      const senhaTemporaria = await redefinirSenhaTemporaria(alvo.uid);
      setSenhaExibida({ titulo: `Nova senha temporária: ${alvo.nome}`, email: alvo.email, senhaTemporaria });
      setCopiado(false);
    } catch (err) {
      setAviso({ tipo: 'erro', texto: traduzirErroAuth(err) });
    } finally {
      setProcessandoUid(null);
      setUserToReset(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    const alvo = userToDelete;
    await executar(alvo.uid, () => deleteUser(alvo.uid), `Usuário ${alvo.nome} excluído do sistema.`);
    setUserToDelete(null);
  };

  return (
    <div>
      {aviso && <Aviso tipo={aviso.tipo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso>}

      {/* SENHA TEMPORÁRIA — exibida uma única vez */}
      {senhaExibida && (
        <div role="status" style={{
          border: '1px solid #86efac', backgroundColor: '#f0fdf4', borderRadius: 'var(--radius)',
          padding: '14px 16px', marginBottom: 'var(--spacing-md)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: 700, fontSize: '0.9rem' }}>
            <KeyRound size={16} /> {senhaExibida.titulo}
          </div>
          <p style={{ fontSize: '0.8rem', color: '#166534', margin: '6px 0 10px', lineHeight: 1.5 }}>
            Repasse a senha temporária abaixo a <strong>{senhaExibida.email}</strong> por um canal seguro.
            Ela <strong>não será exibida novamente</strong> e deverá ser trocada no primeiro acesso.
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <code
              aria-label="Senha temporária"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '1rem',
                letterSpacing: '0.06em', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                backgroundColor: 'white', border: '1px dashed #22c55e', color: '#111827', userSelect: 'all'
              }}
            >
              {senhaExibida.senhaTemporaria}
            </code>
            <button type="button" className="btn" onClick={copiarSenha} style={estiloBotaoAcao('neutro')}>
              {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? 'Copiada' : 'Copiar'}
            </button>
            <button type="button" className="btn" onClick={() => setSenhaExibida(null)} style={estiloBotaoAcao('success')}>
              Concluir
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: '1 1 320px' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="input-field"
              aria-label="Buscar usuário"
              placeholder="Buscar por nome ou e-mail..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <select
            className="input-field"
            aria-label="Filtrar por situação"
            value={filtroSituacao}
            onChange={e => setFiltroSituacao(e.target.value as typeof filtroSituacao)}
            style={{ width: 'auto', flex: '0 1 220px' }}
          >
            <option value="todas">Todas as situações</option>
            {(Object.keys(SITUACAO_VISUAL) as SituacaoUsuario[]).map(s => (
              <option key={s} value={s}>{SITUACAO_VISUAL[s].label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => { setShowAddForm(prev => !prev); setErroAdd(''); }}
          className={showAddForm ? 'btn' : 'btn btn-primary'}
          style={{ fontWeight: 600, fontSize: '0.84rem' }}
        >
          <UserPlus size={16} />
          <span>{showAddForm ? 'Cancelar cadastro' : 'Nova conta'}</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateUser} className="card" style={{ marginBottom: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1f2937' }}>Criar nova conta</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>
              O sistema gera uma senha temporária segura; o colaborador será obrigado a trocá-la no primeiro acesso.
            </div>
          </div>

          {erroAdd && <Aviso tipo="erro">{erroAdd}</Aviso>}

          <div className="form-row-grid">
            <div>
              <label className="input-label" htmlFor="novo-nome">Nome completo</label>
              <input id="novo-nome" type="text" required value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: Ana Beatriz" className="input-field" />
            </div>
            <div>
              <label className="input-label" htmlFor="novo-email">E-mail institucional</label>
              <input id="novo-email" type="email" required value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="usuario@empresa.com" className="input-field" />
            </div>
          </div>
          <div className="form-row-grid">
            <div>
              <label className="input-label" htmlFor="novo-perfil">Cargo</label>
              <select id="novo-perfil" value={novoPerfil} onChange={e => setNovoPerfil(e.target.value as UserRole)} className="input-field">
                {PERFIS_ATRIBUIVEIS.map(role => (
                  <option key={role} value={role}>{ROLES_CONFIG[role].titulo}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={loadingAdd} className="btn btn-primary" style={{ fontWeight: 600, cursor: loadingAdd ? 'not-allowed' : 'pointer' }}>
                {loadingAdd ? 'Criando conta...' : 'Criar conta e gerar senha'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div style={tabelaAdmin.moldura}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fafafa', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
          {listados.length} de {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tabelaAdmin.tabela}>
            <thead>
              <tr style={tabelaAdmin.cabecalho}>
                <th style={tabelaAdmin.th}>Colaborador</th>
                <th style={tabelaAdmin.th}>Cargo</th>
                <th style={tabelaAdmin.th}>Situação</th>
                <th style={{ ...tabelaAdmin.th, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {listados.map(user => {
                const situacao = situacaoDoUsuario(user);
                const propria = user.uid === userProfile?.uid;
                const ocupado = processandoUid === user.uid;
                const roleConf = configDoPerfil(user.perfil);
                const cargoEditavel = !propria && (situacao === 'ativo' || situacao === 'bloqueado') && isPerfilAtribuivel(user.perfil);
                return (
                  <tr key={user.uid} style={tabelaAdmin.linha}>
                    <td style={tabelaAdmin.td}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>
                        {user.nome}{propria && <span style={{ color: '#9ca3af', fontWeight: 500 }}> (você)</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', overflowWrap: 'anywhere' }}>{user.email}</div>
                      {user.trocaSenhaObrigatoria && (
                        <div style={{ marginTop: '4px' }}>
                          <Pill label="Senha temporária — troca pendente" fundo="#fef3c7" texto="#b45309" icon={<KeyRound size={11} />} />
                        </div>
                      )}
                    </td>
                    <td style={tabelaAdmin.td}>
                      {cargoEditavel ? (
                        <select
                          aria-label={`Cargo de ${user.nome}`}
                          value={user.perfil}
                          disabled={ocupado}
                          onChange={e => {
                            const perfil = e.target.value as UserRole;
                            executar(user.uid, () => updateUserRole(user.uid, perfil), `Cargo de ${user.nome} alterado para ${ROLES_CONFIG[perfil].titulo}.`);
                          }}
                          style={{
                            padding: '6px 10px', borderRadius: '6px', border: `1.5px solid ${roleConf.borderColor}`,
                            backgroundColor: roleConf.badgeBg, color: roleConf.badgeText, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
                          }}
                        >
                          {PERFIS_ATRIBUIVEIS.map(r => (
                            <option key={r} value={r}>{ROLES_CONFIG[r].titulo}</option>
                          ))}
                        </select>
                      ) : (
                        <span title={propria ? 'A Administração não altera o próprio cargo' : undefined}>
                          <Pill label={roleConf.titulo} fundo={roleConf.badgeBg} texto={roleConf.badgeText} />
                        </span>
                      )}
                    </td>
                    <td style={tabelaAdmin.td}><SituacaoBadge situacao={situacao} /></td>
                    <td style={{ ...tabelaAdmin.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {situacao === 'pendente' && (
                        <button type="button" className="btn" onClick={() => navigate('/administracao/cadastros', { state: { destacarId: user.uid } })} style={estiloBotaoAcao('primary')}>
                          Analisar cadastro
                        </button>
                      )}
                      {(situacao === 'ativo' || situacao === 'bloqueado') && !propria && (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => executar(
                            user.uid,
                            () => toggleUserStatus(user.uid, !user.ativo),
                            user.ativo ? `${user.nome} foi bloqueado.` : `${user.nome} foi desbloqueado.`
                          )}
                          className="btn"
                          style={{
                            ...estiloBotaoAcao('neutro'),
                            borderColor: user.ativo ? '#fca5a5' : '#86efac',
                            backgroundColor: user.ativo ? '#fef2f2' : '#f0fdf4',
                            color: user.ativo ? '#b91c1c' : '#15803d'
                          }}
                        >
                          {user.ativo ? 'Bloquear acesso' : 'Desbloquear'}
                        </button>
                      )}
                      {(situacao === 'ativo' || situacao === 'bloqueado') && !propria && (
                        <button
                          type="button"
                          onClick={() => { setAviso(null); setUserToReset(user); }}
                          disabled={ocupado}
                          title="Gerar nova senha temporária"
                          aria-label={`Gerar nova senha temporária para ${user.nome}`}
                          className="btn btn-icon"
                          style={{ width: 30, height: 30, minHeight: 30, marginLeft: '6px', borderColor: '#fcd34d', backgroundColor: '#fffbeb', color: '#b45309' }}
                        >
                          <KeyRound size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setAviso(null); setUserToDelete(user); }}
                        disabled={propria || ocupado}
                        title={propria ? 'Não é possível excluir a própria conta' : 'Excluir usuário'}
                        aria-label={`Excluir usuário ${user.nome}`}
                        className="btn btn-icon"
                        style={{
                          width: 30, height: 30, minHeight: 30, marginLeft: '6px',
                          borderColor: '#fca5a5', backgroundColor: '#fef2f2', color: '#b91c1c',
                          cursor: propria ? 'not-allowed' : 'pointer', opacity: propria ? 0.4 : 1
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {listados.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                    {users.length === 0 ? 'Nenhum usuário cadastrado.' : 'Nenhum usuário encontrado para os filtros atuais.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMAÇÃO DE NOVA SENHA TEMPORÁRIA */}
      {userToReset && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 10000, display: 'flex', justifyContent: 'center', padding: '20px' }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="reset-user-title"
        >
          <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius)', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <h3 id="reset-user-title" style={{ margin: '0 0 12px', fontSize: '1rem', color: '#111827', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} color="#b45309" /> Gerar nova senha temporária
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5 }}>
              A senha atual de <strong>{userToReset.nome}</strong> ({userToReset.email}) deixará de valer, as sessões abertas serão
              encerradas e a troca de senha será obrigatória no próximo acesso.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setUserToReset(null)} disabled={processandoUid === userToReset.uid} className="btn" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmReset} disabled={processandoUid === userToReset.uid} className="btn btn-primary" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                {processandoUid === userToReset.uid ? 'Gerando...' : 'Gerar nova senha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      {userToDelete && (
        <div
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 10000, display: 'flex', justifyContent: 'center', padding: '20px' }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
        >
          <div style={{ backgroundColor: 'white', borderRadius: 'var(--radius)', maxWidth: '420px', width: '100%', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <h3 id="delete-user-title" style={{ margin: '0 0 12px', fontSize: '1rem', color: '#111827', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={18} color="#b91c1c" /> Excluir usuário
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5 }}>
              Remover <strong>{userToDelete.nome}</strong> ({userToDelete.email}) do sistema? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setUserToDelete(null)} disabled={processandoUid === userToDelete.uid} className="btn" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmDelete} disabled={processandoUid === userToDelete.uid} className="btn btn-primary" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                {processandoUid === userToDelete.uid ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
