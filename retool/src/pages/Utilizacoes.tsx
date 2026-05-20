import React, { useState, useMemo } from 'react';
import { useReTool } from '../context/ReToolContext';
import { FocusableList } from '../components/FocusableList';
import { Search, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Utilizacoes() {
  const { utilizacoes, dispositivos } = useReTool();
  const navigate = useNavigate();
  const [filterDispId, setFilterDispId] = useState('');
  const [filterText, setFilterText] = useState('');

  const filteredUtilizacoes = useMemo(() => {
    return utilizacoes.filter(u => {
      const matchPeca = filterDispId === '' || u.dispositivoId === filterDispId;
      const matchText = filterText === '' || 
        (u.descricao?.toLowerCase().includes(filterText.toLowerCase())) ||
        (u.setor?.toLowerCase().includes(filterText.toLowerCase()));
      return matchPeca && matchText;
    });
  }, [utilizacoes, filterDispId, filterText]);

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h2>Últimas Utilizações</h2>
        <p style={{ color: 'var(--color-text-body)' }}>Registro histórico de uso e movimentação de dispositivos.</p>
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
    </div>
  );
}
