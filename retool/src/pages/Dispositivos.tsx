import React from 'react';
import { useDispositivosController } from '../presentation/hooks/useDispositivosController';
import { FocusableList } from '../components/FocusableList';
import { BulkActionModal, BulkItem } from '../components/BulkActionModal';
import { Plus, Search, Box, Filter, ChevronDown, ChevronLeft, ChevronRight, Upload, ListChecks } from 'lucide-react';
import { AccessibleModal } from '../components/AccessibleModal';
import { ImportModal } from '../components/ImportModal';

export function Dispositivos() {
  const {
    categorias,
    familias,
    produtos,
    navigate,
    searchInputRef,

    // Filtros
    filterQuery,
    handleSearchChange,
    filterCategoria,
    setFilterCategoria,
    filterProcesso,
    setFilterProcesso,
    showFilters,
    setShowFilters,

    // Paginação
    itemsPerPage,
    setItemsPerPage,
    currentPage,
    setCurrentPage,
    totalPages,
    filteredDispositivos,
    paginatedDispositivos,

    // Modais individuais
    dispToDelete,
    setDispToDelete,
    isImportOpen,
    setIsImportOpen,

    // Bulk Actions
    isBulkModalOpen,
    setIsBulkModalOpen,
    bulkSelected,
    bulkSearch,
    setBulkSearch,
    isBulkConfirmOpen,
    setIsBulkConfirmOpen,
    isBulkLoading,
    bulkProgress,
    bulkFilteredDispositivos,
    toggleBulkSelect,
    toggleSelectAll,
    closeBulkModal,
    handleBulkDisable,
    handleBulkDelete,

    // Ações
    handleDelete,
    getBadgeColor,
    openDispForm
  } = useDispositivosController();

  const bulkItems: BulkItem[] = bulkFilteredDispositivos.map(d => ({
    id: d.id,
    label: d.nome || 'Sem nome',
    sublabel: d.codigo,
    inactive: d.ativo === false
  }));

  return (
    <>
      <div>
        <div className="flex-responsive-header">
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Dispositivos</h2>
            <div className="subtitle">{filteredDispositivos.length} dispositivos encontrados</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>

            <button 
              className="btn hide-on-mobile" 
              onClick={() => setIsImportOpen(true)}
              aria-label="Importar planilha de dispositivos"
              style={{ height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Upload size={18} />
              <span className="hide-on-mobile">Importar</span>
            </button>

            <button
              className="btn hide-on-mobile"
              onClick={() => setIsBulkModalOpen(true)}
              aria-label="Ações em massa"
              style={{ height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ListChecks size={18} />
              <span className="hide-on-mobile">Ações em Massa</span>
            </button>

            <button
              className="btn btn-primary btn-icon"
              onClick={() => openDispForm()}
              aria-label="Cadastrar novo dispositivo (Atalho: N)"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="flex-responsive-row" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              ref={searchInputRef}
              type="text" 
              className="input-field" 
              placeholder="Buscar por nome ou código..." 
              value={filterQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ paddingLeft: '44px', paddingRight: '16px', height: '44px', borderRadius: 'var(--radius)', borderColor: filterQuery ? 'var(--color-primary)' : 'var(--color-border)' }}
              aria-label="Filtro de busca por nome ou código"
            />
          </div>

          <div style={{ position: 'relative' }}>
            <button 
              className="btn" 
              style={{ height: '44px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-body)' }}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} /> Filtros <ChevronDown size={14} />
            </button>
            {showFilters && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 20,
                backgroundColor: 'white', padding: 'var(--spacing-md)', borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border)', width: '250px',
                display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)'
              }}>
                <div>
                  <label className="input-label">Categoria</label>
                  <select className="input-field" value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
                    <option value="">Todas</option>
                    {categorias
                      .filter(c => c.ativo !== false || c.id === filterCategoria)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome}{c.ativo === false ? ' (Inativo)' : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Processo Industrial</label>
                  <select className="input-field" value={filterProcesso} onChange={(e) => setFilterProcesso(e.target.value)}>
                    <option value="">Todos os Processos</option>
                    <option value="Shotblaster">Shotblaster</option>
                    <option value="Coping">Coping</option>
                    <option value="Sawing">Sawing</option>
                    <option value="Drilling">Drilling</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <FocusableList
          items={paginatedDispositivos}
          ariaLabel="Lista de dispositivos. Use setas para navegar, Enter para detalhes, D para excluir e E para editar."
          onItemAction={(disp) => navigate(`/dispositivos/${disp.id}`)}
          onDeleteItem={(disp) => setDispToDelete(disp.id)}
          onEditItem={(disp) => openDispForm(disp.id)}
          renderItem={(disp, idx, isFocused) => {
            const cat = categorias.find(c => c.id === disp.categoriaId);
            const fam = familias.find(f => f.id === disp.familiaId);
            const prod = produtos.find(p => p.id === disp.produtoId);
            return (
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 'var(--spacing-lg)' }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', 
                  backgroundColor: 'var(--color-hover)', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', color: '#9ca3af' 
                }}>
                  <Box size={20} />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '1.05rem' }}>
                      {disp.nome || 'Nome não informado'}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                      {disp.codigo || ''}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {cat?.nome && <span className={getBadgeColor(cat.nome)}>{cat.nome}</span>}
                    {fam?.nome && <span className={getBadgeColor(fam.nome)}>{fam.nome}</span>}
                    {prod?.nome && <span className="badge badge-blue">{prod.nome}</span>}
                    {disp.peso && <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 500 }}>{disp.peso}g</span>}
                    {(disp.palavrasChave || []).map(tag => (
                      <span key={tag} className="badge badge-pink" style={{ fontSize: '0.75rem' }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            )
          }}
        />

        {/* CONTROLES DE PAGINAÇÃO */}
        {filteredDispositivos.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-body)' }}>Itens por página:</span>
              <select 
                className="input-field" 
                style={{ width: 'auto', padding: '4px 8px', height: 'auto', fontSize: '0.85rem' }}
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value="all">Tudo</option>
              </select>
            </div>

            {itemsPerPage !== 'all' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-icon"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dark)', fontWeight: 600, minWidth: '45px', textAlign: 'center' }}>
                  {currentPage} de {totalPages}
                </span>
                <button
                  className="btn btn-icon"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  aria-label="Próxima página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal confirmação exclusão individual */}
        <AccessibleModal isOpen={!!dispToDelete} onClose={() => setDispToDelete(null)} title="Confirmar exclusão">
          <p>Tem certeza que deseja remover este dispositivo?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
            <button className="btn" onClick={() => setDispToDelete(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleDelete}>Confirmar</button>
          </div>
        </AccessibleModal>

      </div>

      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />

      {/* Modal de Ações em Massa */}
      <BulkActionModal
        isOpen={isBulkModalOpen}
        onClose={closeBulkModal}
        items={bulkItems}
        selected={bulkSelected}
        search={bulkSearch}
        onSearchChange={setBulkSearch}
        onToggleItem={toggleBulkSelect}
        onToggleAll={toggleSelectAll}
        confirmAction={isBulkConfirmOpen}
        onSetConfirmAction={setIsBulkConfirmOpen}
        onDisable={handleBulkDisable}
        onDelete={handleBulkDelete}
        isLoading={isBulkLoading}
        progress={bulkProgress}
        canDisable={true}
      />

      <button className="fab-button" onClick={() => openDispForm()} aria-label="Cadastrar novo dispositivo">
        <Plus size={24} />
      </button>
    </>
  );
}
