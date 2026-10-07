import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth, traduzirErroAuth } from '../../context/AuthContext';
import { PERFIS_ATRIBUIVEIS, ROLES_CONFIG, UserProfile, UserRole, situacaoDoUsuario } from '../../domain/entities/user';
import { EmptyState } from '../Tabs';
import { Aviso, EstadoCarregando, EstadoErro } from '../Feedback';
import { Pill, RoleBadge, SituacaoBadge, formatarDataHora } from '../Badges';
import { cartaoAdmin, estiloBotaoAcao, tabelaAdmin } from './estilos';

/**
 * Fluxo A: cadastros públicos (Convidados) aguardando decisão. A aprovação
 * exige a escolha explícita do cargo; a rejeição aceita um motivo opcional.
 */
export function AprovacoesCadastroPanel({ destacarId }: { destacarId?: string }) {
  const { users, estadoUsuarios, decidirCadastro } = useAuth();
  const [cargoEscolhido, setCargoEscolhido] = useState<Record<string, UserRole | ''>>({});
  const [rejeitandoUid, setRejeitandoUid] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [processandoUid, setProcessandoUid] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const nomePorUid = useMemo(() => new Map(users.map(u => [u.uid, u.nome])), [users]);

  const pendentes = useMemo(
    () => users
      .filter(u => situacaoDoUsuario(u) === 'pendente')
      .sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || '')),
    [users]
  );

  const decididosRecentes = useMemo(
    () => users
      .filter(u => u.aprovadoEm || u.rejeitadoEm)
      .sort((a, b) => (b.aprovadoEm || b.rejeitadoEm || '').localeCompare(a.aprovadoEm || a.rejeitadoEm || ''))
      .slice(0, 10),
    [users]
  );

  if (estadoUsuarios === 'carregando') return <EstadoCarregando mensagem="Carregando cadastros..." />;
  if (estadoUsuarios === 'erro') {
    return <EstadoErro mensagem="Não foi possível carregar os cadastros. Verifique sua conexão e se as regras do Firestore foram publicadas." />;
  }

  const decidir = async (u: UserProfile, aprovar: boolean) => {
    const cargo = cargoEscolhido[u.uid];
    if (aprovar && !cargo) {
      setAviso({ tipo: 'erro', texto: `Selecione o cargo de ${u.nome} antes de aprovar.` });
      return;
    }
    setProcessandoUid(u.uid);
    setAviso(null);
    try {
      await decidirCadastro(u.uid, aprovar, aprovar ? (cargo as UserRole) : undefined, aprovar ? undefined : motivo);
      setAviso({
        tipo: 'sucesso',
        texto: aprovar
          ? `Cadastro de ${u.nome} aprovado com o cargo ${ROLES_CONFIG[cargo as UserRole].titulo}.`
          : `Cadastro de ${u.nome} rejeitado.`
      });
      setRejeitandoUid(null);
      setMotivo('');
    } catch (e) {
      setAviso({ tipo: 'erro', texto: traduzirErroAuth(e) });
    } finally {
      setProcessandoUid(null);
    }
  };

  return (
    <div>
      {aviso && <Aviso tipo={aviso.tipo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso>}

      {pendentes.length === 0 ? (
        <EmptyState message="Nenhum cadastro aguardando aprovação." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pendentes.map(u => {
            const ocupado = processandoUid === u.uid;
            const rejeitando = rejeitandoUid === u.uid;
            return (
              <div
                key={u.uid}
                style={{ ...cartaoAdmin, ...(u.uid === destacarId ? { boxShadow: '0 0 0 2px var(--color-primary)' } : {}) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#111827' }}>{u.nome}</h4>
                  <RoleBadge perfil="convidado" />
                  <SituacaoBadge situacao="pendente" />
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', overflowWrap: 'anywhere' }}>
                  {u.email} · Cadastro em {formatarDataHora(u.criadoEm)}
                  {u.perfilSolicitado && u.perfilSolicitado !== 'gerencia' && (
                    <> · <span style={{ color: '#b45309', fontWeight: 600 }}>Indicou no cadastro antigo: {ROLES_CONFIG[u.perfilSolicitado].titulo}</span></>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px' }}>
                  <label className="sr-only" htmlFor={`cargo-${u.uid}`}>Cargo de {u.nome}</label>
                  <select
                    id={`cargo-${u.uid}`}
                    className="input-field"
                    value={cargoEscolhido[u.uid] || ''}
                    disabled={ocupado}
                    onChange={e => setCargoEscolhido(prev => ({ ...prev, [u.uid]: e.target.value as UserRole | '' }))}
                    style={{ width: 'auto', minWidth: '240px', flex: '1 1 240px', maxWidth: '360px' }}
                  >
                    <option value="">Selecione o cargo...</option>
                    {PERFIS_ATRIBUIVEIS.map(r => (
                      <option key={r} value={r}>{ROLES_CONFIG[r].titulo}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn"
                    disabled={ocupado || !cargoEscolhido[u.uid]}
                    onClick={() => decidir(u, true)}
                    title={!cargoEscolhido[u.uid] ? 'Selecione o cargo para aprovar' : undefined}
                    style={{ ...estiloBotaoAcao('success'), opacity: ocupado || !cargoEscolhido[u.uid] ? 0.55 : 1 }}
                  >
                    <Check size={14} /> Aprovar
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={ocupado}
                    onClick={() => { setRejeitandoUid(rejeitando ? null : u.uid); setMotivo(''); }}
                    style={estiloBotaoAcao('danger')}
                  >
                    <X size={14} /> Rejeitar
                  </button>
                </div>

                {rejeitando && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="input-label" htmlFor={`motivo-${u.uid}`}>Motivo da rejeição (opcional — exibido ao usuário)</label>
                    <textarea
                      id={`motivo-${u.uid}`}
                      className="input-field"
                      rows={2}
                      maxLength={500}
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn" onClick={() => setRejeitandoUid(null)} disabled={ocupado} style={estiloBotaoAcao('neutro')}>
                        Cancelar
                      </button>
                      <button type="button" className="btn" onClick={() => decidir(u, false)} disabled={ocupado} style={estiloBotaoAcao('danger')}>
                        {ocupado ? 'Rejeitando...' : 'Confirmar rejeição'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {decididosRecentes.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-xl)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 'var(--spacing-sm)' }}>Decisões recentes</h3>
          <div style={tabelaAdmin.moldura}>
            <div style={{ overflowX: 'auto' }}>
              <table style={tabelaAdmin.tabela}>
                <thead>
                  <tr style={tabelaAdmin.cabecalho}>
                    <th style={tabelaAdmin.th}>Colaborador</th>
                    <th style={tabelaAdmin.th}>Decisão</th>
                    <th style={tabelaAdmin.th}>Cargo definido</th>
                    <th style={tabelaAdmin.th}>Por</th>
                    <th style={tabelaAdmin.th}>Em</th>
                  </tr>
                </thead>
                <tbody>
                  {decididosRecentes.map(u => {
                    const rejeitado = situacaoDoUsuario(u) === 'rejeitado';
                    return (
                      <tr key={u.uid} style={tabelaAdmin.linha}>
                        <td style={tabelaAdmin.td}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{u.nome}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{u.email}</div>
                        </td>
                        <td style={tabelaAdmin.td}>
                          {rejeitado
                            ? <SituacaoBadge situacao="rejeitado" />
                            : <Pill label="● Aprovado" fundo="#dcfce7" texto="#15803d" />}
                          {rejeitado && u.motivoRejeicao && (
                            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>Motivo: {u.motivoRejeicao}</div>
                          )}
                        </td>
                        <td style={tabelaAdmin.td}>{rejeitado ? '—' : <RoleBadge perfil={u.perfil} />}</td>
                        <td style={tabelaAdmin.td}>{nomePorUid.get((rejeitado ? u.rejeitadoPorUid : u.aprovadoPorUid) || '') || '—'}</td>
                        <td style={{ ...tabelaAdmin.td, whiteSpace: 'nowrap' }}>{formatarDataHora(rejeitado ? u.rejeitadoEm : u.aprovadoEm)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
