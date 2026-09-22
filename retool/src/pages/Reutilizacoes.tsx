import React, { useState, useMemo, useEffect } from 'react';
import { useReTool } from '../context/ReToolContext';
import { usePermissions } from '../hooks/usePermissions';
import { Tabs, EmptyState } from '../components/Tabs';
import { BulkActionModal, BulkItem } from '../components/BulkActionModal';
import { FluxoReutilizacaoModal } from '../components/FluxoReutilizacaoModal';
import { ListChecks, ChevronDown, Check, X, Clock, Factory, Send, Wrench, ExternalLink, Info } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBulkProgress } from '../hooks/useBulkProgress';
import {
  Reutilizacao,
  ReutilizacaoStatus,
  REUTILIZACAO_STATUS,
  corDoStatusReutilizacao,
  rotuloCurtoStatusReutilizacao,
  transicaoReutilizacaoPermitida
} from '../domain/entities/reutilizacao';

const FILA_PROJETISTA: ReutilizacaoStatus[] = ['Em análise (Projetista)', 'Aguardando novo filtro (Projetista)'];
const FILA_ENGENHARIA: ReutilizacaoStatus[] = ['Em análise (Engenharia)', 'Reutilização aprovada', 'Reutilização não aprovada'];

export function Reutilizacoes() {
  const { reutilizacoes, dispositivos, deleteReutilizacao, transicionarReutilizacao, announce } = useReTool();
  const { canExcluir, isProjetista, isEngenharia, isAdmin, currentRole } = usePermissions();
  const BULK_THRESHOLD = 20;
  const { progress: bulkProgress, runWithProgress } = useBulkProgress();
  const navigate = useNavigate();
  const location = useLocation();

  const [destacarId, setDestacarId] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isFluxoOpen, setIsFluxoOpen] = useState(false);

  // Filtros vinculados estritamente à tabela de histórico
  const [filterDispId, setFilterDispId] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | ReutilizacaoStatus>('todos');

  // Seleção da tabela (Ações em Massa)
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState<'disable' | 'delete' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const statusDe = (u: Reutilizacao): ReutilizacaoStatus => u.status || 'Em análise (Projetista)';

  // ---------------- ABAS DISPONÍVEIS POR PERFIL ----------------
  const filaProjetista = useMemo(
    () => reutilizacoes.filter(u => FILA_PROJETISTA.includes(statusDe(u))),
    [reutilizacoes]
  );
  const filaEngenharia = useMemo(
    () => reutilizacoes.filter(u => FILA_ENGENHARIA.includes(statusDe(u))),
    [reutilizacoes]
  );

  const tabs = useMemo(() => {
    const t: { id: string; label: string; count?: number }[] = [];
    if (isProjetista || isAdmin) t.push({ id: 'filaProjetista', label: 'Fila do Projetista', count: filaProjetista.length });
    if (isEngenharia || isAdmin) t.push({ id: 'filaEngenharia', label: 'Fila da Engenharia', count: filaEngenharia.length });
    t.push({ id: 'historico', label: 'Histórico Geral' });
    return t;
  }, [isProjetista, isEngenharia, isAdmin, filaProjetista.length, filaEngenharia.length]);

  const tabAtiva = activeTab && tabs.some(t => t.id === activeTab) ? activeTab : tabs[0].id;

  // Navegação vinda de uma notificação: abre a aba certa e destaca o registro.
  useEffect(() => {
    const st = location.state as { reutilizacaoId?: string; dispositivoId?: string } | null;
    if (!st?.reutilizacaoId) return;
    const alvo = reutilizacoes.find(u => u.id === st.reutilizacaoId);
    setDestacarId(st.reutilizacaoId);
    if (!alvo) return;
    const s = statusDe(alvo);
    if (FILA_PROJETISTA.includes(s) && (isProjetista || isAdmin)) setActiveTab('filaProjetista');
    else if (FILA_ENGENHARIA.includes(s) && (isEngenharia || isAdmin)) setActiveTab('filaEngenharia');
    else setActiveTab('historico');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // ---------------- HISTÓRICO (tabela) ----------------
  const historicoFiltrado = useMemo(() => {
    return reutilizacoes.filter(u => {
      const matchPeca = filterDispId === '' || u.dispositivoId === filterDispId;
      const matchStatus = filterStatus === 'todos' || statusDe(u) === filterStatus;
      const q = filterText.toLowerCase();
      const matchText = filterText === '' ||
        (u.descricaoAlteracao?.toLowerCase().includes(q)) ||
        (u.responsavel?.toLowerCase().includes(q)) ||
        (u.solicitanteNome?.toLowerCase().includes(q)) ||
        (u.codigoPeca?.toLowerCase().includes(q)) ||
        (u.numeroOs?.toLowerCase().includes(q)) ||
        (u.descricaoPeca?.toLowerCase().includes(q));
      return matchPeca && matchStatus && matchText;
    });
  }, [reutilizacoes, filterDispId, filterText, filterStatus]);

  // ---------------- AÇÕES EM MASSA ----------------
  const bulkFiltered = useMemo(() => {
    if (!bulkSearch.trim()) return reutilizacoes;
    const q = bulkSearch.toLowerCase();
    return reutilizacoes.filter(u => {
      const disp = dispositivos.find(d => d.id === u.dispositivoId);
      return (
        u.descricaoAlteracao?.toLowerCase().includes(q) ||
        u.responsavel?.toLowerCase().includes(q) ||
        u.codigoPeca?.toLowerCase().includes(q) ||
        u.numeroOs?.toLowerCase().includes(q) ||
        disp?.nome?.toLowerCase().includes(q)
      );
    });
  }, [reutilizacoes, bulkSearch]);

  const bulkItems: BulkItem[] = bulkFiltered.map(u => {
    const disp = dispositivos.find(d => d.id === u.dispositivoId);
    return {
      id: u.id,
      label: u.descricaoAlteracao || 'Sem descrição',
      sublabel: disp?.nome ? `${disp.nome} · OS: ${u.numeroOs || 'S/OS'}` : `OS: ${u.numeroOs || 'S/OS'}`,
    };
  });

  const toggleItem = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = historicoFiltrado.length > 0 && historicoFiltrado.every(u => bulkSelected.has(u.id));
  const toggleAllVisible = () => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) historicoFiltrado.forEach(u => next.delete(u.id));
      else historicoFiltrado.forEach(u => next.add(u.id));
      return next;
    });
  };

  const closeBulk = () => {
    setIsBulkOpen(false);
    setBulkSelected(new Set());
    setBulkSearch('');
    setBulkConfirm(null);
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    const ids = Array.from(bulkSelected);
    const useSilent = ids.length > BULK_THRESHOLD;
    try {
      await runWithProgress(ids, id => deleteReutilizacao(id, useSilent));
      if (useSilent) announce(`${ids.length} reutilizações excluídas com sucesso`);
    } finally {
      setBulkLoading(false);
      closeBulk();
    }
  };

  // ---------------- TRANSIÇÕES (somente nas abas de fila) ----------------
  const naoAprovar = (u: Reutilizacao) => {
    const motivo = window.prompt('Informe o motivo da não aprovação:');
    if (motivo === null) return;
    transicionarReutilizacao(u.id, 'Reutilização não aprovada', { motivo: motivo || 'Não justificado' });
  };

  const botoesDeAcao = (u: Reutilizacao) => {
    const st = statusDe(u);
    const pode = (para: ReutilizacaoStatus) => transicaoReutilizacaoPermitida(currentRole, st, para);
    const btn = (
      label: string,
      onClick: () => void,
      cor: 'success' | 'danger' | 'primary' | 'neutro',
      icon?: React.ReactNode
    ) => (
      <button
        type="button"
        className="btn"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={cor === 'neutro'
          ? { padding: '6px 12px', minHeight: 32, fontSize: '0.78rem', fontWeight: 600 }
          : {
              padding: '6px 12px', minHeight: 32, fontSize: '0.78rem', fontWeight: 600,
              backgroundColor: cor === 'success' ? 'var(--color-success)' : cor === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)',
              borderColor: cor === 'success' ? 'var(--color-success)' : cor === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)',
              color: 'white'
            }}
      >
        {icon}{label}
      </button>
    );

    const acoes: React.ReactNode[] = [];

    if (st === 'Em análise (Engenharia)' && pode('Em análise (Projetista)')) {
      acoes.push(btn('Solicitar Análise (1º Filtro)', () => transicionarReutilizacao(u.id, 'Em análise (Projetista)'), 'primary', <Send size={14} />));
    }
    if (st === 'Em análise (Projetista)') {
      if (pode('Reutilização aprovada')) acoes.push(btn('Aprovar', () => transicionarReutilizacao(u.id, 'Reutilização aprovada'), 'success', <Check size={14} />));
      if (pode('Reutilização não aprovada')) acoes.push(btn('Não Aprovar', () => naoAprovar(u), 'danger', <X size={14} />));
    }
    if (st === 'Reutilização não aprovada') {
      if (pode('Aguardando novo filtro (Projetista)')) acoes.push(btn('Solicitar Dispositivo Novo', () => transicionarReutilizacao(u.id, 'Aguardando novo filtro (Projetista)'), 'primary', <Factory size={14} />));
    }
    if (st === 'Aguardando novo filtro (Projetista)') {
      if (pode('Em análise (Projetista)')) acoes.push(btn('Similar Encontrado', () => transicionarReutilizacao(u.id, 'Em análise (Projetista)'), 'primary', <Wrench size={14} />));
      if (pode('Liberado para fabricação (novo dispositivo)')) acoes.push(btn('Liberar Fabricação', () => transicionarReutilizacao(u.id, 'Liberado para fabricação (novo dispositivo)'), 'success', <Factory size={14} />));
    }

    return acoes;
  };

  const chipDeStatus = (u: Reutilizacao) => {
    const st = statusDe(u);
    const cor = corDoStatusReutilizacao(st);
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px', borderRadius: '10px',
        fontSize: '0.72rem', fontWeight: 700,
        backgroundColor: cor.fundo, color: cor.texto, whiteSpace: 'nowrap'
      }}>
        {st === 'Em análise (Projetista)' || st === 'Aguardando novo filtro (Projetista)' ? <Clock size={12} /> : null}
        {rotuloCurtoStatusReutilizacao(st)}
      </span>
    );
  };

  const formatarData = (u: Reutilizacao) => {
    const rawDate = u.data || u.dataCriacao || '';
    if (!rawDate) return 'N/A';
    if (rawDate.includes('-') && rawDate.length === 10) {
      const [y, m, d] = rawDate.split('-');
      return `${d}/${m}/${y}`;
    }
    return new Date(rawDate).toLocaleDateString('pt-BR');
  };

  // ---------------- CARDS DAS FILAS (abas 1 e 2) ----------------
  const cartaoFila = (u: Reutilizacao) => {
    const disp = dispositivos.find(p => p.id === u.dispositivoId);
    return (
      <div
        key={u.id}
        onClick={() => navigate(`/dispositivos/${u.dispositivoId}`)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') navigate(`/dispositivos/${u.dispositivoId}`); }}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
          padding: '12px 16px', backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
          ...(u.id === destacarId ? { boxShadow: '0 0 0 2px var(--color-primary)' } : {})
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            {chipDeStatus(u)}
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#111827' }}>{u.descricaoAlteracao || 'Descrição não informada'}</h4>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            <strong>Dispositivo:</strong> {disp?.nome || 'Desconhecido'} | <strong>Peça:</strong> {u.codigoPeca || 'N/A'} | <strong>Solicitante:</strong> {u.solicitanteNome || u.responsavel || 'N/A'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {botoesDeAcao(u)}
        </div>
      </div>
    );
  };

  const colunaCount = 9 + (canExcluir ? 1 : 0);

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-md)' }}>
        <div>
          <h2>Histórico & Solicitações de Reutilização</h2>
          <p style={{ color: 'var(--color-text-body)' }}>Fluxo de solicitação da Engenharia, análise da Ferramentaria e histórico consolidado.</p>
        </div>
        <button
          className="btn"
          onClick={() => setIsFluxoOpen(true)}
          style={{ flexShrink: 0, height: '36px', padding: '0 14px', fontSize: '0.82rem' }}
        >
          <Info size={16} />
          Como funciona o fluxo
        </button>
      </div>

      <Tabs tabs={tabs} active={tabAtiva} onChange={setActiveTab} />

      {/* ---------- ABA 1: FILA DO PROJETISTA ---------- */}
      {tabAtiva === 'filaProjetista' && (
        filaProjetista.length === 0 ? (
          <EmptyState message="Sem pendências no momento." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filaProjetista.map(cartaoFila)}
          </div>
        )
      )}

      {/* ---------- ABA 2: FILA DA ENGENHARIA ---------- */}
      {tabAtiva === 'filaEngenharia' && (
        filaEngenharia.length === 0 ? (
          <EmptyState message="Sem pendências no momento." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filaEngenharia.map(cartaoFila)}
          </div>
        )
      )}

      {/* ---------- ABA 3: HISTÓRICO GERAL (tabela) ---------- */}
      {tabAtiva === 'historico' && (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden'
        }}>
          {/* Toolbar da tabela */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 'var(--spacing-md)', padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)', backgroundColor: '#fafafa'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
              {historicoFiltrado.length} {historicoFiltrado.length === 1 ? 'registro' : 'registros'}
              {bulkSelected.size > 0 && <> · <span style={{ color: 'var(--color-primary)' }}>{bulkSelected.size} selecionado(s)</span></>}
            </div>
            {canExcluir && (
              <button
                className="btn"
                onClick={() => setIsBulkOpen(true)}
                style={{ height: '36px', padding: '0 14px', fontSize: '0.82rem' }}
              >
                <ListChecks size={16} />
                Ações em Massa
              </button>
            )}
          </div>

          {/* Filtros vinculados à tabela */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-sm)',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)'
          }}>
            <input
              type="text"
              className="input-field"
              placeholder="Buscar por descrição, peça, solicitante ou OS..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <select
              className="input-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="todos">Todos os Status</option>
              {REUTILIZACAO_STATUS.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            <select
              className="input-field"
              value={filterDispId}
              onChange={(e) => setFilterDispId(e.target.value)}
            >
              <option value="">Todos os Dispositivos</option>
              {dispositivos.map(p => (
                <option key={p.id} value={p.id}>{p.nome || 'Dispositivo Sem Nome'} ({p.codigo || 'S/C'})</option>
              ))}
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  {canExcluir && (
                    <th style={{ padding: '10px 8px', width: '36px' }}>
                      <input
                        type="checkbox"
                        aria-label="Selecionar todos os registros visíveis"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                      />
                    </th>
                  )}
                  <th style={{ padding: '10px 8px', width: '36px' }} aria-label="Expandir detalhes" />
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Data</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Status</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Dispositivo</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Peça</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Solicitante</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Hard Saving</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>OS</th>
                </tr>
              </thead>
              <tbody>
                {historicoFiltrado.map(u => {
                  const disp = dispositivos.find(p => p.id === u.dispositivoId);
                  const aberto = expandedId === u.id;
                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        onClick={() => setExpandedId(aberto ? null : u.id)}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                          backgroundColor: u.id === destacarId ? 'rgba(228, 13, 44, 0.06)' : aberto ? '#fafafa' : 'transparent'
                        }}
                      >
                        {canExcluir && (
                          <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${u.descricaoAlteracao || u.id}`}
                              checked={bulkSelected.has(u.id)}
                              onChange={() => toggleItem(u.id)}
                            />
                          </td>
                        )}
                        <td style={{ padding: '10px 8px', color: '#9ca3af' }}>
                          <ChevronDown size={16} style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', color: '#374151' }}>{formatarData(u)}</td>
                        <td style={{ padding: '10px 8px' }}>{chipDeStatus(u)}</td>
                        <td style={{ padding: '10px 8px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={disp?.nome}>{disp?.nome || 'Desconhecido'}</td>
                        <td style={{ padding: '10px 8px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.codigoPeca}>{u.codigoPeca || 'N/A'}</td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{u.solicitanteNome || u.responsavel || 'N/A'}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--color-success)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          R$ {u.hardSaving?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{u.numeroOs || '—'}</td>
                      </tr>
                      {aberto && (
                        <tr style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fafafa' }}>
                          <td colSpan={colunaCount} style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.5 }}>
                              <div><strong>Descrição da alteração:</strong> {u.descricaoAlteracao || 'N/A'}</div>
                              <div><strong>Peça:</strong> {u.codigoPeca || 'N/A'} — {u.descricaoPeca || 'N/A'} | <strong>Peso:</strong> {u.pesoPeca?.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) || '0,000'} kg</div>
                              <div><strong>Responsável:</strong> {u.responsavel || 'N/A'} | <strong>Solicitante:</strong> {u.solicitanteNome || 'N/A'}</div>
                              {statusDe(u) === 'Reutilização não aprovada' && u.motivoRejeicao && (
                                <div style={{ color: 'var(--color-danger)' }}><strong>Motivo da não aprovação:</strong> {u.motivoRejeicao}</div>
                              )}
                              {u.aprovadorNome && (
                                <div><strong>Análise:</strong> {u.aprovadorNome}{u.dataAprovacao ? ` em ${new Date(u.dataAprovacao).toLocaleString('pt-BR')}` : ''}</div>
                              )}
                              <div>
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => navigate(`/dispositivos/${u.dispositivoId}`)}
                                  style={{ padding: '4px 12px', minHeight: 28, fontSize: '0.75rem' }}
                                >
                                  <ExternalLink size={13} /> Ver Dispositivo
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {historicoFiltrado.length === 0 && (
                  <tr>
                    <td colSpan={colunaCount} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                      Nenhum registro encontrado para os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Ações em Massa da tabela de histórico */}
      <BulkActionModal
        isOpen={isBulkOpen}
        onClose={closeBulk}
        items={bulkItems}
        selected={bulkSelected}
        search={bulkSearch}
        onSearchChange={setBulkSearch}
        onToggleItem={toggleItem}
        onToggleAll={() => {
          const allIds = bulkFiltered.map(u => u.id);
          const allSelected = allIds.length > 0 && allIds.every(id => bulkSelected.has(id));
          setBulkSelected(prev => {
            const next = new Set(prev);
            if (allSelected) allIds.forEach(id => next.delete(id));
            else allIds.forEach(id => next.add(id));
            return next;
          });
        }}
        confirmAction={bulkConfirm}
        onSetConfirmAction={setBulkConfirm}
        onDelete={handleBulkDelete}
        isLoading={bulkLoading}
        progress={bulkProgress}
        canDisable={false}
      />

      {/* Modal explicativo do fluxo de aceite */}
      <FluxoReutilizacaoModal isOpen={isFluxoOpen} onClose={() => setIsFluxoOpen(false)} />
    </div>
  );
}
