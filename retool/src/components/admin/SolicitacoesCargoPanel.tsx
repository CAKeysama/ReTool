import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { useAuth, traduzirErroAuth } from '../../context/AuthContext';
import { ROLES_CONFIG, configDoPerfil } from '../../domain/entities/user';
import { SolicitacaoCargo, SolicitacaoCargoStatus } from '../../domain/entities/solicitacaoCargo';
import { EmptyState } from '../Tabs';
import { Aviso, EstadoCarregando, EstadoErro } from '../Feedback';
import { RoleBadge, SolicitacaoStatusBadge, formatarDataHora } from '../Badges';
import { cartaoAdmin, estiloBotaoAcao, tabelaAdmin } from './estilos';

/**
 * Fluxo B: pedidos de alteração de cargo feitos pelos próprios usuários.
 * O cargo só muda na aprovação; a rejeição mantém o cargo atual.
 */
export function SolicitacoesCargoPanel({ destacarId }: { destacarId?: string }) {
  const { solicitacoesCargo, estadoSolicitacoesCargo, decidirSolicitacaoCargo, users, userProfile } = useAuth();
  const [decidindo, setDecidindo] = useState<{ id: string; aprovar: boolean } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | Exclude<SolicitacaoCargoStatus, 'pendente'>>('todos');

  const perfilAtualPorUid = useMemo(() => new Map(users.map(u => [u.uid, u.perfil])), [users]);

  const pendentes = useMemo(
    () => solicitacoesCargo
      .filter(s => s.status === 'pendente')
      .sort((a, b) => a.dataSolicitacao.localeCompare(b.dataSolicitacao)),
    [solicitacoesCargo]
  );
  const historico = useMemo(
    () => solicitacoesCargo.filter(s => s.status !== 'pendente' && (filtroStatus === 'todos' || s.status === filtroStatus)),
    [solicitacoesCargo, filtroStatus]
  );

  if (estadoSolicitacoesCargo === 'carregando') return <EstadoCarregando mensagem="Carregando solicitações de cargo..." />;
  if (estadoSolicitacoesCargo === 'erro') {
    return <EstadoErro mensagem="Não foi possível carregar as solicitações de cargo. Verifique sua conexão e se as regras do Firestore foram publicadas." />;
  }

  const confirmar = async (s: SolicitacaoCargo, aprovar: boolean) => {
    setProcessandoId(s.id);
    setAviso(null);
    try {
      await decidirSolicitacaoCargo(s.id, aprovar, motivo);
      setAviso({
        tipo: 'sucesso',
        texto: aprovar
          ? `Cargo de ${s.usuarioNome} alterado para ${ROLES_CONFIG[s.perfilSolicitado].titulo}.`
          : `Solicitação de ${s.usuarioNome} rejeitada; o cargo atual foi mantido.`
      });
      setDecidindo(null);
      setMotivo('');
    } catch (e) {
      setAviso({ tipo: 'erro', texto: traduzirErroAuth(e) });
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <div>
      {aviso && <Aviso tipo={aviso.tipo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso>}

      <h3 style={{ fontSize: '0.95rem', marginBottom: 'var(--spacing-sm)' }}>Pendentes ({pendentes.length})</h3>
      {pendentes.length === 0 ? (
        <EmptyState message="Nenhuma solicitação de alteração de cargo pendente." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pendentes.map(s => {
            const ocupado = processandoId === s.id;
            const emDecisao = decidindo?.id === s.id;
            const propria = s.usuarioUid === userProfile?.uid;
            const perfilAgora = perfilAtualPorUid.get(s.usuarioUid);
            return (
              <div key={s.id} style={{ ...cartaoAdmin, ...(s.id === destacarId ? { boxShadow: '0 0 0 2px var(--color-primary)' } : {}) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#111827' }}>{s.usuarioNome}</h4>
                      <SolicitacaoStatusBadge status="pendente" />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', overflowWrap: 'anywhere' }}>
                      {s.usuarioEmail} · Solicitado em {formatarDataHora(s.dataSolicitacao)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <RoleBadge perfil={s.perfilAtual} />
                      <ArrowRight size={14} color="#6b7280" aria-label="para" />
                      <RoleBadge perfil={s.perfilSolicitado} />
                    </div>
                    {perfilAgora && perfilAgora !== s.perfilAtual && (
                      <div style={{ fontSize: '0.74rem', color: '#b45309', marginTop: '6px' }}>
                        O cargo atual do usuário mudou desde o pedido: {configDoPerfil(perfilAgora).titulo}.
                      </div>
                    )}
                    {s.justificativa && (
                      <div style={{ fontSize: '0.8rem', color: '#374151', marginTop: '8px', lineHeight: 1.45 }}>
                        <strong>Justificativa:</strong> {s.justificativa}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={ocupado || propria}
                      title={propria ? 'O próprio solicitante não decide a sua solicitação' : undefined}
                      onClick={() => { setDecidindo({ id: s.id, aprovar: true }); setMotivo(''); }}
                      style={estiloBotaoAcao('success')}
                    >
                      <Check size={14} /> Aprovar
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={ocupado || propria}
                      onClick={() => { setDecidindo({ id: s.id, aprovar: false }); setMotivo(''); }}
                      style={estiloBotaoAcao('danger')}
                    >
                      <X size={14} /> Rejeitar
                    </button>
                  </div>
                </div>

                {emDecisao && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#374151' }}>
                      {decidindo!.aprovar
                        ? <>Confirmar a alteração do cargo de <strong>{s.usuarioNome}</strong> para <strong>{ROLES_CONFIG[s.perfilSolicitado].titulo}</strong>?</>
                        : <>Rejeitar a solicitação de <strong>{s.usuarioNome}</strong>? O cargo atual será mantido.</>}
                    </div>
                    <label className="input-label" htmlFor={`motivo-cargo-${s.id}`}>Observação (opcional — enviada ao usuário)</label>
                    <textarea
                      id={`motivo-cargo-${s.id}`}
                      className="input-field"
                      rows={2}
                      maxLength={500}
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn" disabled={ocupado} onClick={() => setDecidindo(null)} style={estiloBotaoAcao('neutro')}>
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={ocupado}
                        onClick={() => confirmar(s, decidindo!.aprovar)}
                        style={estiloBotaoAcao(decidindo!.aprovar ? 'success' : 'danger')}
                      >
                        {ocupado ? 'Salvando...' : decidindo!.aprovar ? 'Confirmar aprovação' : 'Confirmar rejeição'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: 'var(--spacing-sm)' }}>
          <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Histórico de decisões</h3>
          <select
            className="input-field"
            aria-label="Filtrar histórico por status"
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="todos">Todas as decisões</option>
            <option value="aprovada">Aprovadas</option>
            <option value="rejeitada">Rejeitadas</option>
          </select>
        </div>
        {historico.length === 0 ? (
          <EmptyState message="Nenhuma decisão registrada." />
        ) : (
          <div style={tabelaAdmin.moldura}>
            <div style={{ overflowX: 'auto' }}>
              <table style={tabelaAdmin.tabela}>
                <thead>
                  <tr style={tabelaAdmin.cabecalho}>
                    <th style={tabelaAdmin.th}>Solicitado em</th>
                    <th style={tabelaAdmin.th}>Usuário</th>
                    <th style={tabelaAdmin.th}>Alteração</th>
                    <th style={tabelaAdmin.th}>Status</th>
                    <th style={tabelaAdmin.th}>Decidido por</th>
                    <th style={tabelaAdmin.th}>Decisão em</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map(s => (
                    <tr key={s.id} style={tabelaAdmin.linha}>
                      <td style={{ ...tabelaAdmin.td, whiteSpace: 'nowrap' }}>{formatarDataHora(s.dataSolicitacao)}</td>
                      <td style={tabelaAdmin.td}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{s.usuarioNome}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.usuarioEmail}</div>
                      </td>
                      <td style={tabelaAdmin.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <RoleBadge perfil={s.perfilAtual} curto />
                          <ArrowRight size={12} color="#6b7280" />
                          <RoleBadge perfil={s.perfilSolicitado} curto />
                        </div>
                      </td>
                      <td style={tabelaAdmin.td}>
                        <SolicitacaoStatusBadge status={s.status} />
                        {s.motivoDecisao && (
                          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>{s.motivoDecisao}</div>
                        )}
                      </td>
                      <td style={tabelaAdmin.td}>{s.decididoPorNome || '—'}</td>
                      <td style={{ ...tabelaAdmin.td, whiteSpace: 'nowrap' }}>{formatarDataHora(s.dataDecisao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
