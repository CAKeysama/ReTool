import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, Outlet } from 'react-router-dom';
import { useReTool, Dispositivo } from '../context/ReToolContext';
import { FocusableList } from '../components/FocusableList';
import { Plus, Search, Box, Filter, ChevronDown } from 'lucide-react';
import { AccessibleModal } from '../components/AccessibleModal';
import { useHotkeys } from '../hooks/useHotkeys';

export function Dispositivos() {
  const { dispositivos, categorias, deleteDispositivo, openDispForm } = useReTool();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const queryParam = searchParams.get('q') || '';
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  useHotkeys({
    onSearchFocus: () => searchInputRef.current?.focus(),
    onNewRecord: () => openDispForm()
  });

  const [filterQuery, setFilterQuery] = useState(queryParam);
  const [filterCategoria, setFilterCategoria] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Paginação
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(5);
  const [currentPage, setCurrentPage] = useState(1);

  const [dispToDelete, setDispToDelete] = useState<string | null>(null);

  const filteredDispositivos = useMemo(() => {
    return dispositivos.filter(p => {
      const matchText = filterQuery === '' || 
        (p.nome?.toLowerCase().includes(filterQuery.toLowerCase())) ||
        (p.codigo?.toLowerCase().includes(filterQuery.toLowerCase())) ||
        (p.descricao?.toLowerCase().includes(filterQuery.toLowerCase()));

      const matchCat = filterCategoria === '' || p.categoriaId === filterCategoria;
      return matchText && matchCat;
    });
  }, [dispositivos, filterQuery, filterCategoria]);

  // Resetar página ao filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [filterQuery, filterCategoria, itemsPerPage]);

  const paginatedDispositivos = useMemo(() => {
    if (itemsPerPage === 'all') return filteredDispositivos;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDispositivos.slice(start, start + itemsPerPage);
  }, [filteredDispositivos, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === 'all' ? 1 : Math.max(1, Math.ceil(filteredDispositivos.length / itemsPerPage));

  const handleDelete = () => {
    if (dispToDelete) {
      deleteDispositivo(dispToDelete);
      setDispToDelete(null);
    }
  };

  const getBadgeColor = (text: string) => {
    if (!text) return 'badge';
    const c = text.charCodeAt(0) % 4;
    return c === 0 ? 'badge badge-pink' : c === 1 ? 'badge badge-teal' : c === 2 ? 'badge badge-yellow' : 'badge badge-blue';
  };

  return (
    <>
      <div>
        <div className="flex-responsive-header">
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Dispositivos</h2>
            <div className="subtitle">{filteredDispositivos.length} dispositivos encontrados</div>
          </div>
          <button 
            className="btn btn-primary hide-on-mobile" 
            onClick={() => openDispForm()}
            aria-label="Cadastrar novo dispositivo (Atalho: N)"
            style={{ fontWeight: 600, padding: '8px 20px', borderRadius: '20px' }}
          >
            <Plus size={16} /> Novo dispositivo
          </button>
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
              onChange={(e) => {
                setFilterQuery(e.target.value);
                setSearchParams(e.target.value ? { q: e.target.value } : {});
              }}
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
                boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border)', width: '250px'
              }}>
                <label className="input-label">Categoria</label>
                <select className="input-field" value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
                  <option value="">Todas</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        <FocusableList
          items={paginatedDispositivos}
          ariaLabel="Lista de dispositivos. Use setas para navegar e Enter para abrir detalhes."
          onItemAction={(disp) => navigate(`/dispositivos/${disp.id}`)}
          renderItem={(disp, idx, isFocused) => {
            const cat = categorias.find(c => c.id === disp.categoriaId);
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
                    {disp.familiaProduto && <span className={getBadgeColor(disp.familiaProduto)}>{disp.familiaProduto}</span>}
                    {disp.peso && <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 500 }}>{disp.peso}</span>}
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
                  className="btn" 
                  style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  Anterior
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dark)', fontWeight: 600 }}>
                  {currentPage} de {totalPages}
                </span>
                <button 
                  className="btn" 
                  style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        )}

        <AccessibleModal isOpen={!!dispToDelete} onClose={() => setDispToDelete(null)} title="Confirmar exclusão">
          <p>Tem certeza que deseja remover este dispositivo?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
            <button className="btn" onClick={() => setDispToDelete(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleDelete}>Confirmar</button>
          </div>
        </AccessibleModal>
      </div>

      <button className="fab-button" onClick={() => openDispForm()} aria-label="Cadastrar novo dispositivo">
        <Plus size={24} />
      </button>
    </>
  );
}
