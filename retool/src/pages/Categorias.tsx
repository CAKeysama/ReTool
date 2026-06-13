import React from 'react';
import { useCategoriasController } from '../presentation/hooks/useCategoriasController';
import { FocusableList } from '../components/FocusableList';
import { AccessibleModal } from '../components/AccessibleModal';
import { Plus, Trash, Edit, Info, Check } from 'lucide-react';

export function Categorias() {
  const {
    categorias,
    familias,
    produtos,
    
    // Categoria
    isCatModalOpen,
    setIsCatModalOpen,
    editingCatId,
    catName,
    setCatName,
    catConfirmAction,
    setCatConfirmAction,
    openCatForm,
    handleCatSave,
    updateCategoria,
    deleteCategoria,

    // Família
    isFamModalOpen,
    setIsFamModalOpen,
    editingFamId,
    famName,
    setFamName,
    famConfirmAction,
    setFamConfirmAction,
    openFamForm,
    handleFamSave,
    updateFamilia,
    deleteFamilia,

    // Produto
    isProdModalOpen,
    setIsProdModalOpen,
    editingProdId,
    prodName,
    setProdName,
    prodConfirmAction,
    setProdConfirmAction,
    openProdForm,
    handleProdSave,
    updateProduto,
    deleteProduto,

    // Tooltips
    showCatInfo,
    setShowCatInfo,
    showFamInfo,
    setShowFamInfo,
    showProdInfo,
    setShowProdInfo
  } = useCategoriasController();

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2 style={{ marginBottom: 'var(--spacing-xs)' }}>Gestão de Classificações</h2>
        <p style={{ color: 'var(--color-text-body)' }}>Gerencie e visualize todas as estruturas de classificação usadas no sistema.</p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-2xl)' }}>
        
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
                    <em>Exemplos: Ferramentas de Corte, EPIs, Gabaritos.</em>
                  </div>
                )}
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => openCatForm()} aria-label="Criar nova categoria" style={{ width: '36px', height: '36px', padding: 0, flexShrink: 0 }}>
              <Plus size={18} />
            </button>
          </div>

          <div style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
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
                      onClick={(e) => { e.stopPropagation(); setCatConfirmAction(c); }}
                      aria-label={c.ativo === false ? `Excluir categoria ${c.nome}` : `Excluir ou desativar categoria ${c.nome}`}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              )}
            />
          </div>
        </div>

        {/* Painel Famílias */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Famílias de Produto</h3>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                onMouseEnter={() => setShowFamInfo(true)}
                onMouseLeave={() => setShowFamInfo(false)}
              >
                <button 
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: showFamInfo ? 'var(--color-primary)' : '#9ca3af', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}
                  aria-label="O que são famílias de produto?"
                >
                  <Info size={16} />
                </button>
                {showFamInfo && (
                  <div style={{ position: 'absolute', top: '100%', left: '0', marginTop: '8px', padding: '12px', backgroundColor: '#f9fafb', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--color-text-dark)', width: '300px', zIndex: 50, boxShadow: 'var(--shadow-lg)', lineHeight: 1.5 }}>
                    <strong>Grupo de manufatura</strong> da peça.<br/>
                    <em>Exemplos: Preparo de Solo, Colheita, Transporte.</em>
                  </div>
                )}
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => openFamForm()} aria-label="Criar nova família" style={{ width: '36px', height: '36px', padding: 0, flexShrink: 0 }}>
              <Plus size={18} />
            </button>
          </div>

          <div style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
            <FocusableList 
              items={familias}
              ariaLabel="Lista de famílias. Use setas para navegar e Enter para editar."
              onItemAction={(f) => openFamForm(f.id, f.nome)}
              renderItem={(f, idx, isFocused) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', opacity: f.ativo === false ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <span style={{ fontWeight: 500, wordBreak: 'break-word', paddingRight: '8px' }}>{f.nome || 'Sem Nome'}</span>
                    {f.ativo === false && (
                      <span className="badge" style={{ backgroundColor: 'var(--gray02)', color: 'var(--gray00)', fontSize: '0.7rem', padding: '1px 6px' }}>Inativo</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <button 
                      className="btn" 
                      tabIndex={isFocused ? 0 : -1} 
                      onClick={(e) => { e.stopPropagation(); openFamForm(f.id, f.nome); }}
                      aria-label={`Editar família ${f.nome}`}
                    >
                      <Edit size={16} />
                    </button>
                    {f.ativo === false && (
                      <button 
                        className="btn" 
                        style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                        tabIndex={isFocused ? 0 : -1} 
                        onClick={(e) => { e.stopPropagation(); updateFamilia(f.id, { ativo: true }); }}
                        aria-label={`Ativar família ${f.nome}`}
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button 
                      className="btn" 
                      style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                      tabIndex={isFocused ? 0 : -1} 
                      onClick={(e) => { e.stopPropagation(); setFamConfirmAction(f); }}
                      aria-label={f.ativo === false ? `Excluir família ${f.nome}` : `Excluir ou desativar família ${f.nome}`}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              )}
            />
          </div>
        </div>

        {/* Painel Produtos */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Produtos</h3>
              <div 
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                onMouseEnter={() => setShowProdInfo(true)}
                onMouseLeave={() => setShowProdInfo(false)}
              >
                <button 
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: showProdInfo ? 'var(--color-primary)' : '#9ca3af', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}
                  aria-label="O que são produtos?"
                >
                  <Info size={16} />
                </button>
                {showProdInfo && (
                  <div style={{ position: 'absolute', top: '100%', left: '0', marginTop: '8px', padding: '12px', backgroundColor: '#f9fafb', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--color-text-dark)', width: '300px', zIndex: 50, boxShadow: 'var(--shadow-lg)', lineHeight: 1.5 }}>
                    <strong>Nome comercial ou modelo</strong> do produto associado.<br/>
                    <em>Exemplos: AVOLA 2500, Semeadeira XP.</em>
                  </div>
                )}
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => openProdForm()} aria-label="Criar novo produto" style={{ width: '36px', height: '36px', padding: 0, flexShrink: 0 }}>
              <Plus size={18} />
            </button>
          </div>

          <div style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
            <FocusableList 
              items={produtos}
              ariaLabel="Lista de produtos. Use setas para navegar e Enter para editar."
              onItemAction={(p) => openProdForm(p.id, p.nome)}
              renderItem={(p, idx, isFocused) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', opacity: p.ativo === false ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <span style={{ fontWeight: 500, wordBreak: 'break-word', paddingRight: '8px' }}>{p.nome || 'Sem Nome'}</span>
                    {p.ativo === false && (
                      <span className="badge" style={{ backgroundColor: 'var(--gray02)', color: 'var(--gray00)', fontSize: '0.7rem', padding: '1px 6px' }}>Inativo</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <button 
                      className="btn" 
                      tabIndex={isFocused ? 0 : -1} 
                      onClick={(e) => { e.stopPropagation(); openProdForm(p.id, p.nome); }}
                      aria-label={`Editar produto ${p.nome}`}
                    >
                      <Edit size={16} />
                    </button>
                    {p.ativo === false && (
                      <button 
                        className="btn" 
                        style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                        tabIndex={isFocused ? 0 : -1} 
                        onClick={(e) => { e.stopPropagation(); updateProduto(p.id, { ativo: true }); }}
                        aria-label={`Ativar produto ${p.nome}`}
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button 
                      className="btn" 
                      style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                      tabIndex={isFocused ? 0 : -1} 
                      onClick={(e) => { e.stopPropagation(); setProdConfirmAction(p); }}
                      aria-label={p.ativo === false ? `Excluir produto ${p.nome}` : `Excluir ou desativar produto ${p.nome}`}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              )}
            />
          </div>
        </div>

      </div>

      {/* MODAIS CATEGORIA */}
      <AccessibleModal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title={editingCatId ? 'Editar Categoria' : 'Nova Categoria'}>
        <form onSubmit={handleCatSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label htmlFor="catName" style={{ display: 'block', marginBottom: '4px' }}>Nome da Categoria</label>
            <input 
              id="catName" className="input-field" value={catName} autoFocus
              onChange={(e) => setCatName(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
            <button type="button" className="btn" onClick={() => setIsCatModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </AccessibleModal>

      <AccessibleModal isOpen={!!catConfirmAction} onClose={() => setCatConfirmAction(null)} title={catConfirmAction?.ativo === false ? "Excluir Categoria" : "Gerenciar Categoria"}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {catConfirmAction?.ativo === false ? (
            <p>Deseja excluir permanentemente a categoria <strong>{catConfirmAction?.nome}</strong>?</p>
          ) : (
            <p>Deseja excluir permanentemente a categoria <strong>{catConfirmAction?.nome}</strong> ou prefere apenas desativá-la?</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => setCatConfirmAction(null)}>Cancelar</button>
            <button 
              type="button" className="btn" style={catConfirmAction?.ativo === false ? { color: 'var(--color-success)', borderColor: 'var(--color-success)' } : { color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
              onClick={() => {
                if (catConfirmAction) {
                  updateCategoria(catConfirmAction.id, { ativo: catConfirmAction.ativo !== false ? false : true });
                  setCatConfirmAction(null);
                }
              }}
            >
              {catConfirmAction?.ativo !== false ? 'Desativar' : 'Ativar'}
            </button>
            <button 
              type="button" className="btn btn-primary" style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={() => {
                if (catConfirmAction) { deleteCategoria(catConfirmAction.id); setCatConfirmAction(null); }
              }}
            >
              Excluir Permanente
            </button>
          </div>
        </div>
      </AccessibleModal>

      {/* MODAIS FAMILIA */}
      <AccessibleModal isOpen={isFamModalOpen} onClose={() => setIsFamModalOpen(false)} title={editingFamId ? 'Editar Família' : 'Nova Família'}>
        <form onSubmit={handleFamSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label htmlFor="famName" style={{ display: 'block', marginBottom: '4px' }}>Nome da Família</label>
            <input 
              id="famName" className="input-field" value={famName} autoFocus
              onChange={(e) => setFamName(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
            <button type="button" className="btn" onClick={() => setIsFamModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </AccessibleModal>

      <AccessibleModal isOpen={!!famConfirmAction} onClose={() => setFamConfirmAction(null)} title={famConfirmAction?.ativo === false ? "Excluir Família" : "Gerenciar Família"}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {famConfirmAction?.ativo === false ? (
            <p>Deseja excluir permanentemente a família <strong>{famConfirmAction?.nome}</strong>?</p>
          ) : (
            <p>Deseja excluir permanentemente a família <strong>{famConfirmAction?.nome}</strong> ou prefere apenas desativá-la?</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => setFamConfirmAction(null)}>Cancelar</button>
            <button 
              type="button" className="btn" style={famConfirmAction?.ativo === false ? { color: 'var(--color-success)', borderColor: 'var(--color-success)' } : { color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
              onClick={() => {
                if (famConfirmAction) {
                  updateFamilia(famConfirmAction.id, { ativo: famConfirmAction.ativo !== false ? false : true });
                  setFamConfirmAction(null);
                }
              }}
            >
              {famConfirmAction?.ativo !== false ? 'Desativar' : 'Ativar'}
            </button>
            <button 
              type="button" className="btn btn-primary" style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={() => {
                if (famConfirmAction) { deleteFamilia(famConfirmAction.id); setFamConfirmAction(null); }
              }}
            >
              Excluir Permanente
            </button>
          </div>
        </div>
      </AccessibleModal>

      {/* MODAIS PRODUTO */}
      <AccessibleModal isOpen={isProdModalOpen} onClose={() => setIsProdModalOpen(false)} title={editingProdId ? 'Editar Produto' : 'Novo Produto'}>
        <form onSubmit={handleProdSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label htmlFor="prodName" style={{ display: 'block', marginBottom: '4px' }}>Nome do Produto</label>
            <input 
              id="prodName" className="input-field" value={prodName} autoFocus
              onChange={(e) => setProdName(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
            <button type="button" className="btn" onClick={() => setIsProdModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </AccessibleModal>

      <AccessibleModal isOpen={!!prodConfirmAction} onClose={() => setProdConfirmAction(null)} title={prodConfirmAction?.ativo === false ? "Excluir Produto" : "Gerenciar Produto"}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {prodConfirmAction?.ativo === false ? (
            <p>Deseja excluir permanentemente o produto <strong>{prodConfirmAction?.nome}</strong>?</p>
          ) : (
            <p>Deseja excluir permanentemente o produto <strong>{prodConfirmAction?.nome}</strong> ou prefere apenas desativá-la?</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => setProdConfirmAction(null)}>Cancelar</button>
            <button 
              type="button" className="btn" style={prodConfirmAction?.ativo === false ? { color: 'var(--color-success)', borderColor: 'var(--color-success)' } : { color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
              onClick={() => {
                if (prodConfirmAction) {
                  updateProduto(prodConfirmAction.id, { ativo: prodConfirmAction.ativo !== false ? false : true });
                  setProdConfirmAction(null);
                }
              }}
            >
              {prodConfirmAction?.ativo !== false ? 'Desativar' : 'Ativar'}
            </button>
            <button 
              type="button" className="btn btn-primary" style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={() => {
                if (prodConfirmAction) { deleteProduto(prodConfirmAction.id); setProdConfirmAction(null); }
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
