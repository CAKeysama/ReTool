import React, { useState } from 'react';
import { useReTool } from '../context/ReToolContext';
import { FocusableList } from '../components/FocusableList';
import { AccessibleModal } from '../components/AccessibleModal';
import { Plus, Trash, Edit } from 'lucide-react';

export function Categorias() {
  const { categorias, addCategoria, updateCategoria, deleteCategoria } = useReTool();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');

  const openForm = (id?: string, currentName?: string) => {
    setEditingCatId(id || null);
    setCatName(currentName || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCatId) {
      updateCategoria(editingCatId, { nome: catName });
    } else {
      addCategoria({ nome: catName });
    }
    setIsModalOpen(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <h2>Gestão de Categorias</h2>
        <button className="btn btn-primary" onClick={() => openForm()} aria-label="Criar nova categoria (Atalho: N)">
          <Plus size={18} /> Nova Categoria
        </button>
      </div>

      <FocusableList 
        items={categorias}
        ariaLabel="Lista de categorias. Use setas para navegar e Enter para editar."
        onItemAction={(c) => openForm(c.id, c.nome)}
        renderItem={(c, idx, isFocused) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontWeight: 500 }}>{c.nome || 'Sem Nome'}</span>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button 
                className="btn" 
                tabIndex={isFocused ? 0 : -1} 
                onClick={(e) => { e.stopPropagation(); openForm(c.id, c.nome); }}
                aria-label={`Editar categoria ${c.nome}`}
              >
                <Edit size={16} />
              </button>
              <button 
                className="btn" 
                style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                tabIndex={isFocused ? 0 : -1} 
                onClick={(e) => {
                  e.stopPropagation();
                  if(confirm('Tem certeza?')) deleteCategoria(c.id);
                }}
                aria-label={`Excluir categoria ${c.nome}`}
              >
                <Trash size={16} />
              </button>
            </div>
          </div>
        )}
      />

      <AccessibleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCatId ? 'Editar Categoria' : 'Nova Categoria'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label htmlFor="catName" style={{ display: 'block', marginBottom: '4px' }}>Nome da Categoria</label>
            <input 
              id="catName"
              className="input-field" 
              value={catName} 
              autoFocus
              onChange={(e) => setCatName(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
            <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar (Enter)</button>
          </div>
        </form>
      </AccessibleModal>
    </div>
  );
}
