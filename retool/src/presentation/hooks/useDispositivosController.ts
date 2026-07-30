import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReTool } from '../../context/ReToolContext';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useBulkProgress } from '../../hooks/useBulkProgress';

export function useDispositivosController() {
  const { dispositivos, categorias, familias, produtos, deleteDispositivo, updateDispositivo, openDispForm, deleteAllData, announce } = useReTool();
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

  // Paginação
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(5);
  const [currentPage, setCurrentPage] = useState(1);

  const [dispToDelete, setDispToDelete] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNukeModalOpen, setIsNukeModalOpen] = useState(false);

  // --- Bulk Actions ---
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState<'disable' | 'delete' | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const { progress: bulkProgress, runWithProgress } = useBulkProgress();

  // Filtro interno do modal de bulk
  const bulkFilteredDispositivos = useMemo(() => {
    if (!bulkSearch.trim()) return dispositivos;
    const q = bulkSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return dispositivos.filter(d => {
      const nome = (d.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const codigo = (d.codigo || '').toLowerCase();
      return nome.includes(q) || codigo.includes(q);
    });
  }, [dispositivos, bulkSearch]);

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = bulkFilteredDispositivos.map(d => d.id);
    const allSelected = allIds.length > 0 && allIds.every(id => bulkSelected.has(id));
    if (allSelected) {
      setBulkSelected(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setBulkSelected(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const BULK_THRESHOLD = 20;

  const closeBulkModal = () => {
    setIsBulkModalOpen(false);
    setBulkSelected(new Set());
    setBulkSearch('');
    setIsBulkConfirmOpen(null);
  };

  const handleBulkDisable = async () => {
    setIsBulkLoading(true);
    const ids = Array.from(bulkSelected);
    const useSilent = ids.length > BULK_THRESHOLD;
    try {
      await runWithProgress(ids, id => updateDispositivo(id, { ativo: false }, useSilent));
      if (useSilent) announce(`${ids.length} dispositivos desativados com sucesso`);
    } finally {
      setIsBulkLoading(false);
      setIsBulkConfirmOpen(null);
      closeBulkModal();
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkLoading(true);
    const ids = Array.from(bulkSelected);
    const useSilent = ids.length > BULK_THRESHOLD;
    try {
      await runWithProgress(ids, id => deleteDispositivo(id, useSilent));
      if (useSilent) announce(`${ids.length} dispositivos excluídos com sucesso`);
    } finally {
      setIsBulkLoading(false);
      setIsBulkConfirmOpen(null);
      closeBulkModal();
    }
  };

  const filteredDispositivos = useMemo(() => {
    const normalizeStr = (str: string | undefined | null) => {
      if (!str) return '';
      let res = str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      res = res.replace(/,/g, ".");
      if (res.includes("avula")) {
        res = res.replace(/avula/g, "avola");
      }
      return res;
    };

    const q = normalizeStr(filterQuery).trim();
    const proc = normalizeStr(filterProcesso).trim();

    return dispositivos.filter(p => {
      const nome = normalizeStr(p.nome);
      const codigo = normalizeStr(p.codigo);
      const descricao = normalizeStr(p.descricao);
      const fam = familias.find(f => f.id === p.familiaId);
      const familia = normalizeStr(fam?.nome);

      const prod = produtos.find(pr => pr.id === p.produtoId);
      const produto = normalizeStr(prod?.nome);

      const cat = categorias.find(c => c.id === p.categoriaId);
      const categoriaNome = normalizeStr(cat?.nome);

      const matchText = filterQuery === '' || 
        nome.includes(q) ||
        codigo.includes(q) ||
        descricao.includes(q) ||
        familia.includes(q) ||
        produto.includes(q) ||
        categoriaNome.includes(q) ||
        (p.palavrasChave || []).some(tag => normalizeStr(tag).includes(q));

      const matchCat = filterCategoria === '' || p.categoriaId === filterCategoria;
      
      const matchProcesso = filterProcesso === '' || 
        descricao.includes(proc) ||
        nome.includes(proc) ||
        (p.palavrasChave || []).some(tag => normalizeStr(tag).includes(proc));

      return matchText && matchCat && matchProcesso;
    });
  }, [dispositivos, categorias, familias, produtos, filterQuery, filterCategoria, filterProcesso]);

  // Resetar página ao filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [filterQuery, filterCategoria, filterProcesso, itemsPerPage]);

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

  const handleSearchChange = (val: string) => {
    setFilterQuery(val);
    setSearchParams(val ? { q: val } : {});
  };

  return {
    dispositivos,
    categorias,
    familias,
    produtos,
    deleteDispositivo,
    openDispForm,
    deleteAllData,
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
    bulkFilteredDispositivos,
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
