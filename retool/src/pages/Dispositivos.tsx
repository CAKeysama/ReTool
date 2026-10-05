import React, { Suspense, lazy } from 'react';
import { LimiteDeErro, CarregandoModal } from '../components/LimiteDeErro';
import { TAMANHOS_PAGINA, useDispositivosController } from '../presentation/hooks/useDispositivosController';
import { FocusableList } from '../components/FocusableList';
import { Plus, Search, Box, Filter, ChevronDown, ChevronLeft, ChevronRight, Upload, ListChecks, CopyX, RefreshCw } from 'lucide-react';
import { AccessibleModal } from '../components/AccessibleModal';
import { usePermissions } from '../hooks/usePermissions';
import { useReTool } from '../context/ReToolContext';
import { SkeletonLista, EstadoDados, ConteudoAtualizavel, IndicadorAtualizacao, BarraProgresso, classificarErro } from '../components/feedback';

// Modais pesados só são baixados quando abertos (a importação traz o leitor de planilhas).
const ImportModal = lazy(() => import('../components/ImportModal').then(m => ({ default: m.ImportModal })));
const DuplicadosModal = lazy(() => import('../components/DuplicadosModal').then(m => ({ default: m.DuplicadosModal })));
const BulkActionModal = lazy(() => import('../components/BulkActionModal').then(m => ({ default: m.BulkActionModal })));

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Posição de rolagem da lista ao sair (para voltar no mesmo ponto). */
let rolagemGuardada = 0;

export function Dispositivos() {
  const { canCadastrar, canEditar, canExcluir, isAdmin } = usePermissions();
  const [isDuplicadosOpen, setIsDuplicadosOpen] = React.useState(false);
  const {
    categorias,
    nomesCategoria,
    nomesFamilia,
    nomesProduto,
    navigate,
    searchInputRef,

    // Filtros
    filterQuery,
    handleSearchChange,
    limparBusca,
    setBuscaFocada,
    buscaPendente,
    filterCategoria,
    setFilterCategoria,
    filterProcesso,
    setFilterProcesso,
    showFilters,
    setShowFilters,

    // Paginação / dados
    itemsPerPage,
    setItemsPerPage,
    lista,

    // Modais individuais
    dispToDelete,
    setDispToDelete,
    isDeleting,
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
    bulkItems,
    bulkEmptyMessage,
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
  const { reconstruirIndiceBusca, announce } = useReTool();
  const [indiceProgresso, setIndiceProgresso] = React.useState<{ lidos: number; total: number | null } | null>(null);

  const atualizarIndice = async () => {
    if (indiceProgresso) return;
    setIndiceProgresso({ lidos: 0, total: null });
    try {
      await reconstruirIndiceBusca(p => setIndiceProgresso(p));
    } catch (e) {
      console.error(e);
      if ((e as Error)?.message !== 'indice-alterado-durante-varredura') {
        announce('Não foi possível atualizar o índice de busca. Tente novamente.');
      }
    } finally {
      setIndiceProgresso(null);
    }
  };

  // Busca preparando há muito tempo (rede lenta): oferece voltar para a lista.
  const [preparoLento, setPreparoLento] = React.useState(false);
  React.useEffect(() => {
    if (lista.estado !== 'preparando-busca') { setPreparoLento(false); return; }
    const t = setTimeout(() => setPreparoLento(true), 10_000);
    return () => clearTimeout(t);
  }, [lista.estado]);

  // Volta dos detalhes na mesma posição da lista.
  const restaurouRolagem = React.useRef(false);
  React.useEffect(() => {
    if (restaurouRolagem.current || lista.estado !== 'pronto') return;
    restaurouRolagem.current = true;
    if (rolagemGuardada > 0) requestAnimationFrame(() => window.scrollTo(0, rolagemGuardada));
  }, [lista.estado]);
  React.useEffect(() => () => { rolagemGuardada = window.scrollY; }, []);

  const botaoFiltrosRef = React.useRef<HTMLButtonElement>(null);
  const filtrando = !!(filterQuery.trim() || filterCategoria || filterProcesso);
  const carregandoPrimeira = lista.estado === 'carregando' || lista.estado === 'preparando-busca';
  const subtitulo = lista.total === null
    ? (carregandoPrimeira ? 'Carregando dispositivos…' : '')
    : `${fmt(lista.total)} dispositivo${lista.total === 1 ? '' : 's'} ${filtrando ? 'encontrado' + (lista.total === 1 ? '' : 's') : 'cadastrado' + (lista.total === 1 ? '' : 's')}`;

  return (
    <>
      <div>
        <div className="flex-responsive-header">
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Dispositivos</h2>
            <div className="subtitle" aria-live="polite">{subtitulo}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>

            {canCadastrar && (
              <button 
                className="btn hide-on-mobile" 
                onClick={() => setIsImportOpen(true)}
                aria-label="Importar planilha de dispositivos"
                style={{ height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Upload size={18} />
                <span className="hide-on-mobile">Importar</span>
              </button>
            )}

            {canEditar && (lista.indiceAusente || lista.indiceDesatualizado || indiceProgresso) && (
              <button
                className="btn"
                onClick={atualizarIndice}
                disabled={!!indiceProgresso}
                aria-label="Atualizar o índice de busca de dispositivos"
                title={lista.indiceAusente ? 'A busca por trecho precisa do índice. Criá-lo lê todos os dispositivos uma vez.' : 'O índice de busca difere do banco (alguém gravou fora do app). Atualizar lê todos os dispositivos uma vez.'}
                style={{ height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <RefreshCw size={18} className={indiceProgresso ? 'spin' : undefined} />
                <span className="hide-on-mobile">
                  {indiceProgresso
                    ? `Atualizando índice${indiceProgresso.total ? ` ${Math.round((indiceProgresso.lidos / indiceProgresso.total) * 100)}%` : '…'}`
                    : lista.indiceAusente ? 'Criar índice de busca' : 'Atualizar índice'}
                </span>
              </button>
            )}

            {isAdmin && (
              <button
                className="btn"
                onClick={() => setIsDuplicadosOpen(true)}
                aria-label="Verificar dispositivos duplicados"
                style={{ height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <CopyX size={18} />
                <span className="hide-on-mobile">Duplicados</span>
              </button>
            )}

            {canExcluir && (
              <button
                className="btn"
                onClick={() => setIsBulkModalOpen(true)}
                aria-label="Ações em massa"
                style={{ height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <ListChecks size={18} />
                <span className="hide-on-mobile">Ações em Massa</span>
              </button>
            )}

            {canCadastrar && (
              <button
                className="btn btn-primary btn-icon"
                onClick={() => openDispForm()}
                aria-label="Cadastrar novo dispositivo (Atalho: N)"
              >
                <Plus size={20} />
              </button>
            )}
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
              onFocus={() => setBuscaFocada(true)}
              onBlur={() => setBuscaFocada(false)}
              style={{ paddingLeft: '44px', paddingRight: '16px', height: '44px', borderRadius: 'var(--radius)', borderColor: filterQuery ? 'var(--color-primary)' : 'var(--color-border)' }}
              aria-label="Filtro de busca por nome ou código"
              aria-busy={buscaPendente || carregandoPrimeira}
            />
          </div>

          <div
            style={{ position: 'relative' }}
            onKeyDown={e => {
              if (e.key === 'Escape' && showFilters) { e.stopPropagation(); setShowFilters(false); botaoFiltrosRef.current?.focus(); }
            }}
          >
            <button 
              ref={botaoFiltrosRef}
              className="btn" 
              style={{ height: '44px', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-body)' }}
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              aria-controls="painel-filtros"
            >
              <Filter size={16} /> Filtros <ChevronDown size={14} />
            </button>
            {showFilters && (
              <div id="painel-filtros" role="group" aria-label="Filtros" style={{
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

        {/* Estados da lista: carregando ≠ vazio ≠ sem resultados ≠ erro */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', minHeight: '20px', marginBottom: '4px' }}>
          <IndicadorAtualizacao ativo={buscaPendente || lista.estado === 'atualizando'} texto={buscaPendente ? 'Buscando…' : 'Atualizando…'} />
        </div>
        {lista.doCache && lista.itens.length > 0 && (
          <div role="status" style={{ background: '#fff7e6', border: '1px solid #f0c36d', color: '#5c4400', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: '8px', fontSize: '0.85rem' }}>
            Sem conexão com o servidor: mostrando dados guardados neste navegador, que podem estar incompletos ou desatualizados.
          </div>
        )}
        {lista.estado === 'erro' && lista.itens.length === 0 ? (
          <EstadoDados estado={classificarErro(lista.erro)} onTentarNovamente={lista.tentarNovamente} />
        ) : lista.estado === 'preparando-busca' ? (
          <div>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              {lista.indiceAusente ? (
                <EstadoDados
                  estado="vazio"
                  compacto
                  titulo="Busca por trecho indisponível"
                  descricao={canEditar
                    ? 'O índice de busca ainda não foi criado. Use "Criar índice de busca" (lê todos os dispositivos uma única vez).'
                    : 'O índice de busca ainda não foi criado. Peça a uma Administradora ou Projetista para criá-lo.'}
                />
              ) : lista.progressoIndice ? (
                <BarraProgresso
                  feitos={lista.progressoIndice.partes}
                  total={lista.progressoIndice.total}
                  rotulo="Preparando a busca"
                  detalhe={preparoLento
                    ? 'A conexão está lenta. A busca continua baixando; você pode limpar a busca para voltar à lista.'
                    : 'Primeiro acesso neste navegador: as próximas buscas serão imediatas.'}
                />
              ) : null}
              {preparoLento && (
                <button type="button" className="btn" style={{ marginTop: '8px' }} onClick={limparBusca}>Limpar busca e voltar à lista</button>
              )}
            </div>
            {!lista.indiceAusente && <SkeletonLista linhas={Math.min(itemsPerPage, 6)} />}
          </div>
        ) : lista.estado === 'carregando' ? (
          <SkeletonLista linhas={Math.min(itemsPerPage, 6)} />
        ) : lista.itens.length === 0 ? (
          filtrando
            ? <EstadoDados estado="sem-resultados" descricao="Nenhum dispositivo corresponde à busca ou aos filtros." />
            : <EstadoDados estado="vazio" titulo="Nenhum dispositivo cadastrado" descricao="Cadastre um dispositivo ou importe uma planilha." />
        ) : (
        <ConteudoAtualizavel atualizando={buscaPendente || lista.estado === 'atualizando'}>
        <FocusableList
          items={lista.itens}
          getKey={(disp) => disp.id}
          ariaLabel="Lista de dispositivos. Use setas para navegar, Enter para detalhes."
          onItemAction={(disp) => navigate(`/dispositivos/${disp.id}`)}
          onDeleteItem={canExcluir ? (disp) => setDispToDelete(disp.id) : undefined}
          onEditItem={canEditar ? (disp) => openDispForm(disp.id) : undefined}
          renderItem={(disp) => {
            const catNome = nomesCategoria.get(disp.categoriaId || '');
            const famNome = nomesFamilia.get(disp.familiaId || '');
            const prodNome = nomesProduto.get(disp.produtoId || '');
            return (
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 'var(--spacing-lg)' }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', 
                  backgroundColor: 'var(--color-hover)', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0
                }}>
                  <Box size={20} />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '1.05rem' }}>
                      {disp.nome || 'Nome não informado'}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                      {disp.codigo || ''}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {catNome && <span className={getBadgeColor(catNome)}>{catNome}</span>}
                    {famNome && <span className={getBadgeColor(famNome)}>{famNome}</span>}
                    {prodNome && <span className="badge badge-blue">{prodNome}</span>}
                    {disp.peso && <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>{disp.peso}g</span>}
                    {(disp.palavrasChave || []).map(tag => (
                      <span key={tag} className="badge badge-pink" style={{ fontSize: '0.75rem' }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            )
          }}
        />
        </ConteudoAtualizavel>
        )}

        {/* CONTROLES DE PAGINAÇÃO (cursor no servidor; sem opção "Tudo") */}
        {(lista.itens.length > 0 || lista.pagina > 1) && (
          <div className="paginacao" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="itens-por-pagina" style={{ fontSize: '0.85rem', color: 'var(--color-text-body)' }}>Itens por página:</label>
              <select 
                id="itens-por-pagina"
                className="input-field" 
                style={{ width: 'auto', padding: '4px 8px', height: 'auto', fontSize: '0.85rem' }}
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
              >
                {TAMANHOS_PAGINA.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-icon"
                disabled={!lista.temAnterior || lista.estado === 'atualizando'}
                onClick={lista.anterior}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dark)', fontWeight: 600, minWidth: '45px', textAlign: 'center' }} aria-live="polite">
                {lista.pagina}{lista.totalPaginas !== null ? ` de ${fmt(lista.totalPaginas)}` : ''}
              </span>
              <button
                className="btn btn-icon"
                disabled={!lista.temProxima || lista.estado === 'atualizando'}
                onClick={lista.proxima}
                aria-label="Próxima página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Modal confirmação exclusão individual */}
        <AccessibleModal isOpen={!!dispToDelete} onClose={() => setDispToDelete(null)} title="Confirmar exclusão">
          <p>Tem certeza que deseja remover este dispositivo?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
            <button className="btn" onClick={() => setDispToDelete(null)} disabled={isDeleting}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleDelete} disabled={isDeleting} aria-busy={isDeleting}>
              {isDeleting ? 'Excluindo…' : 'Confirmar'}
            </button>
          </div>
        </AccessibleModal>

      </div>

      <LimiteDeErro compacto onFechar={() => { setIsImportOpen(false); setIsDuplicadosOpen(false); closeBulkModal(); }}>
      <Suspense fallback={<CarregandoModal />}>
      {isImportOpen && <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />}
      {isDuplicadosOpen && <DuplicadosModal isOpen={isDuplicadosOpen} onClose={() => setIsDuplicadosOpen(false)} />}

      {/* Modal de Ações em Massa */}
      {isBulkModalOpen && <BulkActionModal
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
        emptyMessage={bulkEmptyMessage}
      />}
      </Suspense>
      </LimiteDeErro>

      {canCadastrar && (
        <button className="fab-button" onClick={() => openDispForm()} aria-label="Cadastrar novo dispositivo">
          <Plus size={24} />
        </button>
      )}
    </>
  );
}
