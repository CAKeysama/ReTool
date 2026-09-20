import React, { useState, useMemo, useEffect } from 'react';
import { useReTool } from '../context/ReToolContext';
import { usePermissions } from '../hooks/usePermissions';
import { FocusableList } from '../components/FocusableList';
import { BulkActionModal, BulkItem } from '../components/BulkActionModal';
import { Search, Eye, ListChecks, Check, X, Clock, Factory, FilePlus2, Send, Wrench } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBulkProgress } from '../hooks/useBulkProgress';
import {
  Reutilizacao,
  ReutilizacaoStatus,
  REUTILIZACAO_STATUS,
  corDoStatusReutilizacao,
  transicaoReutilizacaoPermitida
} from '../domain/entities/reutilizacao';

export function Reutilizacoes() {
  const { reutilizacoes, dispositivos, deleteReutilizacao, transicionarReutilizacao, announce } = useReTool();
  const { canExcluir, isProjetista, isEngenharia, isAdmin, currentRole } = usePermissions();
  const BULK_THRESHOLD = 20;
  const { progress: bulkProgress, runWithProgress } = useBulkProgress();
  const navigate = useNavigate();
  const location = useLocation();
  const [destacarId, setDestacarId] = useState('');
  const [filterDispId, setFilterDispId] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | ReutilizacaoStatus>('todos');

  // Bulk state
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState<'disable' | 'delete' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Navegação vinda de uma notificação: filtra o dispositivo e destaca a solicitação.
  useEffect(() => {
    const st = location.state as { reutilizacaoId?: string; dispositivoId?: string } | null;
    if (st?.reutilizacaoId) {
      setDestacarId(st.reutilizacaoId);
      if (st.dispositivoId) setFilterDispId(st.dispositivoId);
    }
  }, [location.state]);

  const statusDe = (u: Reutilizacao): ReutilizacaoStatus => u.status || 'Em análise (Projetista)';

  const filteredReutilizacoes = useMemo(() => {
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

  // ---------------- FILAS DE TRABALHO ----------------
  const filaProjetista = useMemo(
    () => reutilizacoes.filter(u => ['Em análise (Projetista)', 'Aguardando novo filtro (Projetista)'].includes(statusDe(u))),
    [reutilizacoes]
  );
  const filaEngenharia = useMemo(
    () => reutilizacoes.filter(u => ['Em análise (Engenharia)', 'Reutilização aprovada', 'Reutilização não aprovada'].includes(statusDe(u))),
    [reutilizacoes]
  );

  // Filtered list inside the bulk modal
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

  const toggleAll = () => {
    const allIds = bulkFiltered.map(u => u.id);
    const allSelected = allIds.length > 0 && allIds.every(id => bulkSelected.has(id));
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach(id => next.delete(id));
      else allIds.forEach(id => next.add(id));
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

  // ---------------- TRANSIÇÕES (ações por status e perfil) ----------------
  const gerarOs = (u: Reutilizacao) => {
    const numero = window.prompt('Número da OS para esta solicitação:', u.numeroOs || '');
    if (numero === null) return;
    transicionarReutilizacao(u.id, 'Em andamento - OS', { numeroOs: numero.trim() });
  };

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
      if (pode('Em andamento - OS')) acoes.push(btn('Gerar OS', () => gerarOs(u), 'neutro', <FilePlus2 size={14} />));
    }
    if (st === 'Reutilização aprovada' && pode('Em andamento - OS')) {
      acoes.push(btn('Gerar OS', () => gerarOs(u), 'neutro', <FilePlus2 size={14} />));
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
        backgroundColor: cor.fundo, color: cor.texto
      }}>
        {st === 'Em análise (Projetista)' || st === 'Aguardando novo filtro (Projetista)' ? <Clock size={12} /> : null}
        {st}
      </span>
    );
  };

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
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-lg)' }}>
        <div>
          <h2>Histórico & Solicitações de Reutilização</h2>
          <p style={{ color: 'var(--color-text-body)' }}>Fluxo de solicitação da Engenharia, análise da Ferramentaria e histórico consolidado.</p>
        </div>
        {canExcluir && (
          <button
            className="btn"
            onClick={() => setIsBulkOpen(true)}
            aria-label="Ações em massa"
            style={{ height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
          >
            <ListChecks size={18} />
            <span className="hide-on-mobile">Ações em Massa</span>
          </button>
        )}
      </div>

      {/* FILA DO PROJETISTA (1º e 2º filtros) */}
      {(isProjetista || isAdmin) && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--color-text-dark)', marginBottom: 'var(--spacing-sm)' }}>
            Fila do Projetista ({filaProjetista.length})
          </h3>
          {filaProjetista.length === 0 ? (
            <div style={{ padding: '14px 16px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius)', color: '#9ca3af', fontSize: '0.82rem' }}>
              Nenhuma solicitação aguardando análise ou verificação de similares.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filaProjetista.map(cartaoFila)}
            </div>
          )}
        </div>
      )}

      {/* FILA DA ENGENHARIA (rascunhos e retornos para OS) */}
      {(isEngenharia || isAdmin) && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--color-text-dark)', marginBottom: 'var(--spacing-sm)' }}>
            Fila da Engenharia ({filaEngenharia.length})
          </h3>
          {filaEngenharia.length === 0 ? (
            <div style={{ padding: '14px 16px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius)', color: '#9ca3af', fontSize: '0.82rem' }}>
              Nenhuma solicitação em elaboração ou aguardando geração de OS.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filaEngenharia.map(cartaoFila)}
            </div>
          )}
        </div>
      )}

      {/* FILTROS DO HISTÓRICO */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--color-border)'
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

      <FocusableList
        items={filteredReutilizacoes}
        ariaLabel="Lista de histórico de reutilizações"
        onItemAction={(u) => navigate(`/dispositivos/${u.dispositivoId}`)}
        renderItem={(u, idx, isFocused) => {
          const disp = dispositivos.find(p => p.id === u.dispositivoId);
          const rawDate = u.data || u.dataCriacao || '';
          let displayDate = 'N/A';
          if (rawDate) {
            if (rawDate.includes('-') && rawDate.length === 10) {
              const [year, month, day] = rawDate.split('-');
              displayDate = `${day}/${month}/${year}`;
            } else {
              displayDate = new Date(rawDate).toLocaleDateString('pt-BR');
            }
          }

          return (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px',
              ...(u.id === destacarId ? { boxShadow: '0 0 0 2px var(--color-primary)', borderRadius: '8px', padding: '8px' } : {})
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  {chipDeStatus(u)}
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#111827' }}>
                    {u.descricaoAlteracao || 'Descrição não informada'}
                  </h4>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.4 }}>
                  <strong>Dispositivo:</strong> {disp?.nome || 'Desconhecido'} | <strong>Peça:</strong> {u.codigoPeca || 'N/A'} - {u.descricaoPeca || 'N/A'} | <strong>Responsável / Solicitante:</strong> {u.solicitanteNome || u.responsavel || 'N/A'} | <strong>Hard Saving:</strong> R$ {u.hardSaving?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'} | <strong>Data:</strong> {displayDate}{u.numeroOs ? <> | <strong>OS:</strong> {u.numeroOs}</> : null}
                </div>

                {statusDe(u) === 'Reutilização não aprovada' && u.motivoRejeicao && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginTop: '4px' }}>
                    <strong>Motivo da não aprovação:</strong> {u.motivoRejeicao}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {botoesDeAcao(u)}
                <button
                  className="btn"
                  tabIndex={isFocused ? 0 : -1}
                  aria-label={`Ver dispositivo associado ${disp?.nome}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/dispositivos/${u.dispositivoId}`);
                  }}
                >
                  <Eye size={16} /> <span className="hide-on-mobile">Ver Dispositivo</span>
                </button>
              </div>
            </div>
          );
        }}
      />

      {/* Modal de Ações em Massa — reutilizações só podem ser excluídas */}
      <BulkActionModal
        isOpen={isBulkOpen}
        onClose={closeBulk}
        items={bulkItems}
        selected={bulkSelected}
        search={bulkSearch}
        onSearchChange={setBulkSearch}
        onToggleItem={toggleItem}
        onToggleAll={toggleAll}
        confirmAction={bulkConfirm}
        onSetConfirmAction={setBulkConfirm}
        onDelete={handleBulkDelete}
        isLoading={bulkLoading}
        progress={bulkProgress}
        canDisable={false}
      />
    </div>
  );
}
