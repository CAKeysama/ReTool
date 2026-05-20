import React, { useState } from 'react';
import { useReTool, Categoria, Tipo } from '../context/ReToolContext';
import { FocusableList } from '../components/FocusableList';
import { AccessibleModal } from '../components/AccessibleModal';
import { Plus, Trash, Edit, Info, Check } from 'lucide-react';

export function Categorias() {
  const { 
    categorias, addCategoria, updateCategoria, deleteCategoria,
    tipos, addTipo, updateTipo, deleteTipo
  } = useReTool();
  
  // States for Categoria
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [showCatInfo, setShowCatInfo] = useState(false);

  // States for Tipo
  const [isTipoModalOpen, setIsTipoModalOpen] = useState(false);
  const [editingTipoId, setEditingTipoId] = useState<string | null>(null);
  const [tipoName, setTipoName] = useState('');
  const [showTipoInfo, setShowTipoInfo] = useState(false);

  // States for Category & Type Deactivation/Delete Confirmation
  const [catConfirmAction, setCatConfirmAction] = useState<Categoria | null>(null);
  const [tipoConfirmAction, setTipoConfirmAction] = useState<Tipo | null>(null);

  const openCatForm = (id?: string, currentName?: string) => {
    setEditingCatId(id || null);
    setCatName(currentName || '');
    setIsCatModalOpen(true);
  };

  const openTipoForm = (id?: string, currentName?: string) => {
    setEditingTipoId(id || null);
    setTipoName(currentName || '');
    setIsTipoModalOpen(true);
  };

  const handleCatSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCatId) {
      updateCategoria(editingCatId, { nome: catName });
    } else {
      addCategoria({ nome: catName });
    }
    setIsCatModalOpen(false);
  };

  const handleTipoSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTipoId) {
      updateTipo(editingTipoId, { nome: tipoName });
    } else {
      addTipo({ nome: tipoName });
    }
    setIsTipoModalOpen(false);
  };

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--spacing-xl)' }}>Gestão de Classificações</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-2xl)' }}>
        
        {/* Painel Categorias */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Categorias</h3>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                onMouseEnter={() => setShowCatInfo(true)}
                onMouseLeave={() => setShowCatInfo(false)}
              >
                <button 
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: showCatInfo ? 'var(--color-primary)' : '#9ca3af', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}
                  aria-label="O que são categorias?"
                >
                  <Info size={16} />
                </button>
                {showCatInfo && (
                  <div style={{ position: 'absolute', top: '100%', left: '0', marginTop: '8px', padding: '12px', backgroundColor: '#f9fafb', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--color-text-dark)', width: '300px', zIndex: 50, boxShadow: 'var(--shadow-lg)', lineHeight: 1.5 }}>
                    <strong>Grupos macro</strong> para classificar os dispositivos de forma geral.<br/>
                    <em>Exemplos:</em> Ferramentas de Corte, EPIs, Gabaritos, Equipamentos de Medição.
                  </div>
                )}
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => openCatForm()} aria-label="Criar nova categoria" style={{ width: '40px', height: '40px', padding: 0 }}>
              <Plus size={20} />
            </button>
          </div>

          <FocusableList 
            items={categorias}
            ariaLabel="Lista de categorias. Use setas para navegar e Enter para editar."
            onItemAction={(c) => openCatForm(c.id, c.nome)}
            renderItem={(c, idx, isFocused) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', opacity: c.ativo === false ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontWeight: 500, wordBreak: 'break-word', paddingRight: '8px' }}>{c.nome || 'Sem Nome'}</span>
                  {c.ativo === false && (
                    <span className="badge" style={{ backgroundColor: 'var(--gray02)', color: 'var(--gray00)', fontSize: '0.7rem', padding: '1px 6px' }}>Inativo</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  <button 
                    className="btn" 
                    tabIndex={isFocused ? 0 : -1} 
                    onClick={(e) => { e.stopPropagation(); openCatForm(c.id, c.nome); }}
                    aria-label={`Editar categoria ${c.nome}`}
                  >
                    <Edit size={16} />
                  </button>
                  {c.ativo === false && (
                    <button 
                      className="btn" 
                      style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                      tabIndex={isFocused ? 0 : -1} 
                      onClick={(e) => { e.stopPropagation(); updateCategoria(c.id, { ativo: true }); }}
                      aria-label={`Ativar categoria ${c.nome}`}
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button 
                    className="btn" 
                    style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                    tabIndex={isFocused ? 0 : -1} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCatConfirmAction(c);
                    }}
                    aria-label={c.ativo === false ? `Excluir categoria ${c.nome}` : `Excluir ou desativar categoria ${c.nome}`}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            )}
          />
        </div>

        {/* Painel Tipos */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Tipos</h3>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                onMouseEnter={() => setShowTipoInfo(true)}
                onMouseLeave={() => setShowTipoInfo(false)}
              >
                <button 
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: showTipoInfo ? 'var(--color-primary)' : '#9ca3af', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}
                  aria-label="O que são tipos?"
                >
                  <Info size={16} />
                </button>
                {showTipoInfo && (
                  <div style={{ position: 'absolute', top: '100%', left: '0', marginTop: '8px', padding: '12px', backgroundColor: '#f9fafb', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--color-text-dark)', width: '300px', zIndex: 50, boxShadow: 'var(--shadow-lg)', lineHeight: 1.5 }}>
                    <strong>Classificação técnica</strong> ou funcional do dispositivo.<br/>
                    <em>Exemplos:</em> Elétrica, Hidráulica, Pneumática, Manual.
                  </div>
                )}
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => openTipoForm()} aria-label="Criar novo tipo" style={{ width: '40px', height: '40px', padding: 0 }}>
              <Plus size={20} />
            </button>
          </div>

          <FocusableList 
            items={tipos}
            ariaLabel="Lista de tipos. Use setas para navegar e Enter para editar."
            onItemAction={(t) => openTipoForm(t.id, t.nome)}
            renderItem={(t, idx, isFocused) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', opacity: t.ativo === false ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontWeight: 500, wordBreak: 'break-word', paddingRight: '8px' }}>{t.nome || 'Sem Nome'}</span>
                  {t.ativo === false && (
                    <span className="badge" style={{ backgroundColor: 'var(--gray02)', color: 'var(--gray00)', fontSize: '0.7rem', padding: '1px 6px' }}>Inativo</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  <button 
                    className="btn" 
                    tabIndex={isFocused ? 0 : -1} 
                    onClick={(e) => { e.stopPropagation(); openTipoForm(t.id, t.nome); }}
                    aria-label={`Editar tipo ${t.nome}`}
                  >
                    <Edit size={16} />
                  </button>
                  {t.ativo === false && (
                    <button 
                      className="btn" 
                      style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                      tabIndex={isFocused ? 0 : -1} 
                      onClick={(e) => { e.stopPropagation(); updateTipo(t.id, { ativo: true }); }}
                      aria-label={`Ativar tipo ${t.nome}`}
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button 
                    className="btn" 
                    style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                    tabIndex={isFocused ? 0 : -1} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTipoConfirmAction(t);
                    }}
                    aria-label={t.ativo === false ? `Excluir tipo ${t.nome}` : `Excluir ou desativar tipo ${t.nome}`}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            )}
          />
        </div>

      </div>

      {/* Modal Categoria */}
      <AccessibleModal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title={editingCatId ? 'Editar Categoria' : 'Nova Categoria'}>
        <form onSubmit={handleCatSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
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
            <button type="button" className="btn" onClick={() => setIsCatModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar (Enter)</button>
          </div>
        </form>
      </AccessibleModal>

      {/* Modal Tipo */}
      <AccessibleModal isOpen={isTipoModalOpen} onClose={() => setIsTipoModalOpen(false)} title={editingTipoId ? 'Editar Tipo' : 'Novo Tipo'}>
        <form onSubmit={handleTipoSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label htmlFor="tipoName" style={{ display: 'block', marginBottom: '4px' }}>Nome do Tipo</label>
            <input 
              id="tipoName"
              className="input-field" 
              value={tipoName} 
              autoFocus
              onChange={(e) => setTipoName(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
            <button type="button" className="btn" onClick={() => setIsTipoModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar (Enter)</button>
          </div>
        </form>
      </AccessibleModal>

      {/* Modal de Confirmação de Exclusão/Desativação de Categoria */}
      <AccessibleModal 
        isOpen={!!catConfirmAction} 
        onClose={() => setCatConfirmAction(null)} 
        title={catConfirmAction?.ativo === false ? "Excluir Categoria" : "Gerenciar Categoria"}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {catConfirmAction?.ativo === false ? (
            <>
              <p style={{ fontSize: '0.95rem', color: 'var(--color-text-dark)', lineHeight: 1.5 }}>
                Deseja excluir permanentemente a categoria <strong>{catConfirmAction?.nome}</strong>? Esta ação não poderá ser desfeita.
              </p>
              
              <div style={{ 
                padding: '12px', 
                backgroundColor: 'var(--gray03)', 
                border: '1px solid var(--color-border)', 
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                color: 'var(--color-text-body)',
                lineHeight: 1.4
              }}>
                <strong>Atenção:</strong> Como a categoria já está desativada, a exclusão permanente removerá o registro definitivamente do banco de dados.
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: '0.95rem', color: 'var(--color-text-dark)', lineHeight: 1.5 }}>
                Deseja excluir permanentemente a categoria <strong>{catConfirmAction?.nome}</strong> ou prefere apenas desativá-la temporariamente?
              </p>
              
              <div style={{ 
                padding: '12px', 
                backgroundColor: 'var(--gray03)', 
                border: '1px solid var(--color-border)', 
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                color: 'var(--color-text-body)',
                lineHeight: 1.4
              }}>
                <strong>Atenção:</strong> Excluir a categoria removerá o registro de forma permanente. Desativar ocultará a categoria de novos cadastros de dispositivos, mas preservará a associação nos dispositivos existentes.
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', flexWrap: 'wrap', marginTop: 'var(--spacing-sm)' }}>
            <button 
              type="button" 
              className="btn" 
              onClick={() => setCatConfirmAction(null)}
            >
              Cancelar
            </button>
            <button 
              type="button" 
              className="btn"
              style={
                catConfirmAction?.ativo === false 
                  ? { color: 'var(--color-success)', borderColor: 'var(--color-success)' }
                  : { color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }
              }
              onClick={() => {
                if (catConfirmAction) {
                  const novoStatus = catConfirmAction.ativo !== false ? false : true;
                  updateCategoria(catConfirmAction.id, { ativo: novoStatus });
                  setCatConfirmAction(null);
                }
              }}
            >
              {catConfirmAction?.ativo !== false ? 'Desativar Categoria' : 'Ativar Categoria'}
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={() => {
                if (catConfirmAction) {
                  deleteCategoria(catConfirmAction.id);
                  setCatConfirmAction(null);
                }
              }}
            >
              Excluir Permanente
            </button>
          </div>
        </div>
      </AccessibleModal>

      {/* Modal de Confirmação de Exclusão/Desativação de Tipo */}
      <AccessibleModal 
        isOpen={!!tipoConfirmAction} 
        onClose={() => setTipoConfirmAction(null)} 
        title={tipoConfirmAction?.ativo === false ? "Excluir Tipo" : "Gerenciar Tipo"}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {tipoConfirmAction?.ativo === false ? (
            <>
              <p style={{ fontSize: '0.95rem', color: 'var(--color-text-dark)', lineHeight: 1.5 }}>
                Deseja excluir permanentemente o tipo <strong>{tipoConfirmAction?.nome}</strong>? Esta ação não poderá ser desfeita.
              </p>
              
              <div style={{ 
                padding: '12px', 
                backgroundColor: 'var(--gray03)', 
                border: '1px solid var(--color-border)', 
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                color: 'var(--color-text-body)',
                lineHeight: 1.4
              }}>
                <strong>Atenção:</strong> Como o tipo já está desativado, a exclusão permanente removerá o registro definitivamente do banco de dados.
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: '0.95rem', color: 'var(--color-text-dark)', lineHeight: 1.5 }}>
                Deseja excluir permanentemente o tipo <strong>{tipoConfirmAction?.nome}</strong> ou prefere apenas desativá-lo temporariamente?
              </p>
              
              <div style={{ 
                padding: '12px', 
                backgroundColor: 'var(--gray03)', 
                border: '1px solid var(--color-border)', 
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                color: 'var(--color-text-body)',
                lineHeight: 1.4
              }}>
                <strong>Atenção:</strong> Excluir o tipo removerá o registro de forma permanente. Desativar ocultará o tipo de novos cadastros de dispositivos, mas preservará a associação nos dispositivos existentes.
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', flexWrap: 'wrap', marginTop: 'var(--spacing-sm)' }}>
            <button 
              type="button" 
              className="btn" 
              onClick={() => setTipoConfirmAction(null)}
            >
              Cancelar
            </button>
            <button 
              type="button" 
              className="btn"
              style={
                tipoConfirmAction?.ativo === false 
                  ? { color: 'var(--color-success)', borderColor: 'var(--color-success)' }
                  : { color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }
              }
              onClick={() => {
                if (tipoConfirmAction) {
                  const novoStatus = tipoConfirmAction.ativo !== false ? false : true;
                  updateTipo(tipoConfirmAction.id, { ativo: novoStatus });
                  setTipoConfirmAction(null);
                }
              }}
            >
              {tipoConfirmAction?.ativo !== false ? 'Desativar Tipo' : 'Ativar Tipo'}
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={() => {
                if (tipoConfirmAction) {
                  deleteTipo(tipoConfirmAction.id);
                  setTipoConfirmAction(null);
                }
              }}
            >
              Excluir Permanente
            </button>
          </div>
        </div>
      </AccessibleModal>

    </div>
  );
}
