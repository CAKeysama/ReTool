import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReTool } from '../../context/ReToolContext';
import { useHotkeys } from '../../hooks/useHotkeys';
import { BulkProgress } from '../../hooks/useBulkProgress';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useListaDispositivos } from './useListaDispositivos';
import { useIndiceBusca } from './useIndiceBusca';
import { BulkItem } from '../../components/BulkActionModal';

/** Tamanhos de página oferecidos (o máximo é limitado também na consulta). */
export const TAMANHOS_PAGINA = [10, 25, 50, 100] as const;
/** Espera após a última tecla antes de buscar (evita uma busca por caractere). */
const ATRASO_BUSCA_MS = 250;

export function useDispositivosController() {
  const {
    categorias, familias, produtos, deleteDispositivo, openDispForm, deleteAllData, announce,
    desativarDispositivosEmLote, excluirDispositivosEmLote
  } = useReTool();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryParam = searchParams.get('q') || '';
  const searchInputRef = useRef<HTMLInputElement>(null);

  useHotkeys({
    onSearchFocus: () => searchInputRef.current?.focus(),
    onNewRecord: () => openDispForm()
  });

  const [filterQuery, setFilterQuery] = useState(queryParam);
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterProcesso, setFilterProcesso] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [buscaFocada, setBuscaFocada] = useState(false);
  const textoBusca = useDebouncedValue(filterQuery, ATRASO_BUSCA_MS);
  const buscaPendente = filterQuery !== textoBusca;

  // A URL acompanha a busca já estabilizada (não a cada tecla).
  useEffect(() => {
    const atual = searchParams.get('q') || '';
    if (atual !== textoBusca) setSearchParams(textoBusca ? { q: textoBusca } : {}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoBusca]);

  // Paginação (servidor com cursor ou fatias da busca no índice)
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const lista = useListaDispositivos(
    { texto: textoBusca, categoriaId: filterCategoria, processo: filterProcesso },
    itemsPerPage,
    buscaFocada || showFilters
  );

  const [dispToDelete, setDispToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNukeModalOpen, setIsNukeModalOpen] = useState(false);

  // --- Ações em massa (lista vem do catálogo de busca, renderizada virtualizada) ---
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const bulkBusca = useDebouncedValue(bulkSearch, ATRASO_BUSCA_MS);
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState<'disable' | 'delete' | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const indice = useIndiceBusca(isBulkModalOpen);

  const bulkItems: BulkItem[] = useMemo(() => {
    if (!isBulkModalOpen || !indice.pronto) return [];
    const r = indice.buscar({ texto: bulkBusca }) || [];
    return r.map(e => ({ id: e.id, label: e.nome || 'Sem nome', sublabel: e.codigo, inactive: e.ativo === false }));
  }, [isBulkModalOpen, indice.pronto, indice.buscar, bulkBusca]);

  const bulkEmptyMessage = !indice.pronto
    ? (indice.estado === 'ausente'
      ? 'O índice de busca ainda não foi criado. Use "Atualizar índice" para criá-lo.'
      : indice.progresso
        ? `Carregando lista… (${indice.progresso.partes} de ${indice.progresso.total} partes)`
        : 'Carregando lista…')
    : bulkBusca ? 'Nenhum dispositivo corresponde à busca' : 'Nenhum dispositivo cadastrado';

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = bulkItems.map(d => d.id);
    const allSelected = allIds.length > 0 && allIds.every(id => bulkSelected.has(id));
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (allSelected) allIds.forEach(id => next.delete(id));
      else allIds.forEach(id => next.add(id));
      return next;
    });
  };

  const closeBulkModal = () => {
    setIsBulkModalOpen(false);
    setBulkSelected(new Set());
    setBulkSearch('');
    setIsBulkConfirmOpen(null);
  };

  const executarEmMassa = async (
    acao: (ids: string[], onProgresso: (feitos: number, total: number) => void) => Promise<{ sucesso: number; erros: number }>,
    verbo: string
  ) => {
    setIsBulkLoading(true);
    const ids = Array.from(bulkSelected);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      const r = await acao(ids, (feitos, total) => setBulkProgress({ done: feitos, total }));
      announce(r.erros > 0
        ? `${r.sucesso} dispositivos ${verbo}, ${r.erros} com erro. Tente novamente para os restantes.`
        : `${r.sucesso} dispositivos ${verbo} com sucesso`);
    } catch (e) {
      console.error(e);
      announce(`Não foi possível concluir: nenhum dispositivo ${verbo} além dos já informados.`);
    } finally {
      setBulkProgress(null);
      setIsBulkLoading(false);
      setIsBulkConfirmOpen(null);
      closeBulkModal();
    }
  };

  const handleBulkDisable = () => executarEmMassa(desativarDispositivosEmLote, 'desativados');
  const handleBulkDelete = () => executarEmMassa(excluirDispositivosEmLote, 'excluídos');

  const handleDelete = async () => {
    if (!dispToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteDispositivo(dispToDelete);
      setDispToDelete(null);
    } catch (e) {
      console.error(e);
      announce('Não foi possível excluir o dispositivo. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getBadgeColor = (text: string) => {
    if (!text) return 'badge';
    const c = text.charCodeAt(0) % 4;
    return c === 0 ? 'badge badge-pink' : c === 1 ? 'badge badge-teal' : c === 2 ? 'badge badge-yellow' : 'badge badge-blue';
  };

  const handleSearchChange = (val: string) => setFilterQuery(val);

  // Mapas id → nome (O(1) por linha em vez de .find em cada render).
  const nomesCategoria = useMemo(() => new Map(categorias.map(c => [c.id, c.nome])), [categorias]);
  const nomesFamilia = useMemo(() => new Map(familias.map(f => [f.id, f.nome])), [familias]);
  const nomesProduto = useMemo(() => new Map(produtos.map(p => [p.id, p.nome])), [produtos]);

  return {
    categorias,
    nomesCategoria,
    nomesFamilia,
    nomesProduto,
    deleteDispositivo,
    openDispForm,
    deleteAllData,
    navigate,
    searchInputRef,

    // Filtros
    filterQuery,
    handleSearchChange,
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
    isNukeModalOpen,
    setIsNukeModalOpen,

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
    getBadgeColor
  };
}
