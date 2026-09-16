import React, { useState, useMemo, useEffect } from 'react';
import { useReTool } from '../context/ReToolContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { FocusableList } from '../components/FocusableList';
import { BulkActionModal, BulkItem } from '../components/BulkActionModal';
import { Search, Eye, ListChecks, Check, X, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBulkProgress } from '../hooks/useBulkProgress';

export function Reutilizacoes() {
  const { reutilizacoes, dispositivos, deleteReutilizacao, aprovarReutilizacao, rejeitarReutilizacao, announce } = useReTool();
  const { userProfile } = useAuth();
  const { canAprovar, canExcluir, isProjetista, isEngenharia } = usePermissions();
  const BULK_THRESHOLD = 20;
  const { progress: bulkProgress, runWithProgress } = useBulkProgress();
  const navigate = useNavigate();
  const location = useLocation();
  const [destacarId, setDestacarId] = useState('');
  const [filterDispId, setFilterDispId] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'aprovado' | 'rejeitado'>('todos');

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

  const filteredReutilizacoes = useMemo(() => {
    return reutilizacoes.filter(u => {
      const matchPeca = filterDispId === '' || u.dispositivoId === filterDispId;
      const statusU = u.status || 'aprovado';
      const matchStatus = filterStatus === 'todos' || statusU === filterStatus;
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
  }, [reutilizacoes, dispositivos, bulkSearch]);

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

  const pendentes = reutilizacoes.filter(u => (u.status || 'aprovado') === 'pendente');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-lg)' }}>
        <div>
          <h2>Histórico & Solicitações de Reutilização</h2>
          <p style={{ color: 'var(--color-text-body)' }}>Fluxo de solicitação da Engenharia, aprovação pela Ferramentaria e histórico consolidado.</p>
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

      {/* BANNER DE SOLICITAÇÕES PENDENTES PARA PROJETISTA / ADMIN */}
      {canAprovar && pendentes.length > 0 && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1.5px solid #f59e0b',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          marginBottom: 'var(--spacing-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={20} color="#d97706" />
            <div>
              <strong style={{ color: '#b45309', fontSize: '0.95rem' }}>
                {pendentes.length} {pendentes.length === 1 ? 'solicitação pendente' : 'solicitações pendentes'} de reutilização!
              </strong>
              <div style={{ color: '#78350f', fontSize: '0.8rem' }}>
                A Engenharia enviou solicitações aguardando sua análise e aprovação técnica.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => setFilterStatus('pendente')}
            style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '6px 14px'
            }}
          >
            Filtrar Pendentes
          </button>
        </div>
      )}

      {/* FILTROS */}
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
          <option value="pendente">Apenas Pendentes ({pendentes.length})</option>
          <option value="aprovado">Apenas Aprovados</option>
          <option value="rejeitado">Apenas Rejeitados</option>
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

          const statusU = u.status || 'aprovado';
          const isPendente = statusU === 'pendente';
          const isRejeitado = statusU === 'rejeitado';

          return (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px',
              ...(u.id === destacarId ? { boxShadow: '0 0 0 2px var(--color-primary)', borderRadius: '8px', padding: '8px' } : {})
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    backgroundColor: isPendente ? '#fef3c7' : isRejeitado ? '#fee2e2' : '#dcfce7',
                    color: isPendente ? '#b45309' : isRejeitado ? '#b91c1c' : '#15803d'
                  }}>
                    {isPendente && <Clock size={12} />}
                    {statusU === 'aprovado' && <CheckCircle2 size={12} />}
                    {isRejeitado && <XCircle size={12} />}
                    {isPendente ? 'Pendente' : isRejeitado ? 'Rejeitado' : 'Aprovado'}
                  </span>

                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#111827' }}>
                    {u.descricaoAlteracao || 'Descrição não informada'}
                  </h4>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.4 }}>
                  <strong>Dispositivo:</strong> {disp?.nome || 'Desconhecido'} | <strong>Peça:</strong> {u.codigoPeca || 'N/A'} - {u.descricaoPeca || 'N/A'} | <strong>Responsável / Solicitante:</strong> {u.solicitanteNome || u.responsavel || 'N/A'} | <strong>Hard Saving:</strong> R$ {u.hardSaving?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'} | <strong>Data:</strong> {displayDate}
                </div>

                {isRejeitado && u.motivoRejeicao && (
                  <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '4px' }}>
                    <strong>Motivo da rejeição:</strong> {u.motivoRejeicao}
                  </div>
                )}
              </div>

              {/* AÇÕES: APROVAÇÃO (PROJETISTA / ADMIN) E VISUALIZAÇÃO */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {canAprovar && isPendente && (
                  <>
                    <button
                      type="button"
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        aprovarReutilizacao(u.id, userProfile?.nome || 'Projetista', userProfile?.uid);
                      }}
                      style={{
                        backgroundColor: '#16a34a',
                        color: 'white',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                      title="Aprovar reutilização"
                    >
                      <Check size={14} /> Aprovar
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const motivo = prompt('Informe o motivo da rejeição:');
                        if (motivo !== null) {
                          rejeitarReutilizacao(u.id, motivo || 'Não justificado', userProfile?.nome || 'Projetista', userProfile?.uid);
                        }
                      }}
                      style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                      title="Rejeitar reutilização"
                    >
                      <X size={14} /> Rejeitar
                    </button>
                  </>
                )}

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
          )
        }}
      />

      {/* Modal de Ações em Massa — sem desativar (reutilizações só podem ser excluídas) */}
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
