import { useState } from 'react';
import { useReTool } from '../../context/ReToolContext';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';

export function useCategoriasController() {
  const { 
    categorias, addCategoria, updateCategoria, deleteCategoria,
    familias, addFamilia, updateFamilia, deleteFamilia,
    produtos, addProduto, updateProduto, deleteProduto
  } = useReTool();

  // --- States para Categoria ---
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catConfirmAction, setCatConfirmAction] = useState<Categoria | null>(null);

  // --- States para Familia ---
  const [isFamModalOpen, setIsFamModalOpen] = useState(false);
  const [editingFamId, setEditingFamId] = useState<string | null>(null);
  const [famName, setFamName] = useState('');
  const [famConfirmAction, setFamConfirmAction] = useState<Familia | null>(null);

  // --- States para Produto ---
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodConfirmAction, setProdConfirmAction] = useState<Produto | null>(null);

  // States for tooltips
  const [showCatInfo, setShowCatInfo] = useState(false);
  const [showFamInfo, setShowFamInfo] = useState(false);
  const [showProdInfo, setShowProdInfo] = useState(false);

  // --- Actions Categoria ---
  const openCatForm = (id?: string, currentName?: string) => {
    setEditingCatId(id || null);
    setCatName(currentName || '');
    setIsCatModalOpen(true);
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

  // --- Actions Família ---
  const openFamForm = (id?: string, currentName?: string) => {
    setEditingFamId(id || null);
    setFamName(currentName || '');
    setIsFamModalOpen(true);
  };

  const handleFamSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFamId) {
      updateFamilia(editingFamId, { nome: famName });
    } else {
      addFamilia({ nome: famName, ativo: true });
    }
    setIsFamModalOpen(false);
  };

  // --- Actions Produto ---
  const openProdForm = (id?: string, currentName?: string) => {
    setEditingProdId(id || null);
    setProdName(currentName || '');
    setIsProdModalOpen(true);
  };

  const handleProdSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProdId) {
      updateProduto(editingProdId, { nome: prodName });
    } else {
      addProduto({ nome: prodName, ativo: true });
    }
    setIsProdModalOpen(false);
  };

  return {
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
  };
}
