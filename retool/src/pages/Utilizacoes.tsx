import React, { useState, useMemo } from 'react';
import { useReTool } from '../context/ReToolContext';
import { FocusableList } from '../components/FocusableList';
import { BulkActionModal, BulkItem } from '../components/BulkActionModal';
import { Search, Eye, ListChecks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBulkProgress } from '../hooks/useBulkProgress';

export function Utilizacoes() {
  const { utilizacoes, dispositivos, deleteUtilizacao, announce } = useReTool();
  const BULK_THRESHOLD = 20;
  const { progress: bulkProgress, runWithProgress } = useBulkProgress();
  const navigate = useNavigate();
  const [filterDispId, setFilterDispId] = useState('');
  const [filterText, setFilterText] = useState('');

  // Bulk state
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState<'disable' | 'delete' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const filteredUtilizacoes = useMemo(() => {
    return utilizacoes.filter(u => {
      const matchPeca = filterDispId === '' || u.dispositivoId === filterDispId;
      const matchText = filterText === '' || 
        (u.descricao?.toLowerCase().includes(filterText.toLowerCase())) ||
        (u.setor?.toLowerCase().includes(filterText.toLowerCase()));
      return matchPeca && matchText;
    });
  }, [utilizacoes, filterDispId, filterText]);

  // Filtered list inside the bulk modal
  const bulkFiltered = useMemo(() => {
    if (!bulkSearch.trim()) return utilizacoes;
    const q = bulkSearch.toLowerCase();
    return utilizacoes.filter(u => {
      const disp = dispositivos.find(d => d.id === u.dispositivoId);
      return (
        u.descricao?.toLowerCase().includes(q) ||
        u.setor?.toLowerCase().includes(q) ||
        disp?.nome?.toLowerCase().includes(q)
      );
    });
  }, [utilizacoes, dispositivos, bulkSearch]);

  const bulkItems: BulkItem[] = bulkFiltered.map(u => {
    const disp = dispositivos.find(d => d.id === u.dispositivoId);
    return {
      id: u.id,
      label: u.descricao || 'Sem descrição',
      sublabel: disp?.nome ? `${disp.nome} · ${u.setor || 'S/Setor'}` : u.setor,
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
      await runWithProgress(ids, id => deleteUtilizacao(id, useSilent));
      if (useSilent) announce(`${ids.length} utilizações excluídas com sucesso`);
    } finally {
      setBulkLoading(false);
      closeBulk();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-lg)' }}>
        <div>
          <h2>Últimas Utilizações</h2>
          <p style={{ color: 'var(--color-text-body)' }}>Registro histórico de uso e movimentação de dispositivos.</p>
        </div>
        <button
          className="btn"
          onClick={() => setIsBulkOpen(true)}
          aria-label="Ações em massa"
          style={{ height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
        >
          <ListChecks size={18} />
          <span className="hide-on-mobile">Ações em Massa</span>
        </button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
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
          placeholder="Buscar por descrição ou setor..." 
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        
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
        items={filteredUtilizacoes}
        ariaLabel="Lista de histórico de utilizações"
        onItemAction={(u) => navigate(`/dispositivos/${u.dispositivoId}`)}
        renderItem={(u, idx, isFocused) => {
          const disp = dispositivos.find(p => p.id === u.dispositivoId);
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{u.descricao || 'Descrição não informada'}</h4>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-body)', marginTop: '4px' }}>
                  <strong>Dispositivo:</strong> {disp?.nome || 'Desconhecido'} | <strong>Setor:</strong> {u.setor || 'N/A'} | <strong>Data:</strong> {new Date(u.dataCriacao || '').toLocaleDateString('pt-BR')}
                </div>
              </div>
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
          )
        }}
      />

      {/* Modal de Ações em Massa — sem desativar (utilizações só podem ser excluídas) */}
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
