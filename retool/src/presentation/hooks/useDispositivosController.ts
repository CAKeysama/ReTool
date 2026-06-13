import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReTool } from '../../context/ReToolContext';
import { useHotkeys } from '../../hooks/useHotkeys';

export function useDispositivosController() {
  const { dispositivos, categorias, familias, produtos, deleteDispositivo, openDispForm, deleteAllData } = useReTool();
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

    // Modais
    dispToDelete,
    setDispToDelete,
    isImportOpen,
    setIsImportOpen,
    isNukeModalOpen,
    setIsNukeModalOpen,

    // Ações
    handleDelete,
    getBadgeColor
  };
}
