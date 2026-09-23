import React, { useState, useMemo } from 'react';
import { useCategoriasController } from '../presentation/hooks/useCategoriasController';
import { FocusableList } from '../components/FocusableList';
import { AccessibleModal } from '../components/AccessibleModal';
import { BulkActionModal, BulkItem } from '../components/BulkActionModal';
import { Plus, Trash, Edit, Info, Check, ListChecks } from 'lucide-react';
import { useReTool } from '../context/ReToolContext';
import { useBulkProgress } from '../hooks/useBulkProgress';
import { usePermissions } from '../hooks/usePermissions';

const estiloBtnLinha: React.CSSProperties = {
  width: 28,
  height: 28,
  minHeight: 'unset',
  padding: 0,
  border: 'none',
  backgroundColor: 'transparent',
  boxShadow: 'none',
  color: '#9ca3af'
};

interface PainelClassificacaoProps {
  titulo: string;
  contagem: number;
  infoAberta: boolean;
  onInfo: (v: boolean) => void;
  infoTexto: React.ReactNode;
  infoAria: string;
  onBulk?: () => void;
  onAdd?: () => void;
  children: React.ReactNode;
}

function PainelClassificacao({
  titulo, contagem, infoAberta, onInfo, infoTexto, infoAria, onBulk, onAdd, children
}: PainelClassificacaoProps) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', backgroundColor: '#fafafa',
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{titulo}</h3>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, color: '#6b7280',
            backgroundColor: '#f3f4f6', border: '1px solid var(--color-border)',
            padding: '1px 8px', borderRadius: '10px'
          }}>
            {contagem}
          </span>
          <div
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            onMouseEnter={() => onInfo(true)}
            onMouseLeave={() => onInfo(false)}
          >
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', color: infoAberta ? 'var(--color-primary)' : '#9ca3af', display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 }}
              aria-label={infoAria}
            >
              <Info size={15} />
            </button>
            {infoAberta && (
              <div style={{ position: 'absolute', top: '100%', left: '0', marginTop: '8px', padding: '12px', backgroundColor: '#f9fafb', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--color-text-dark)', width: '300px', zIndex: 50, boxShadow: 'var(--shadow-lg)', lineHeight: 1.5 }}>
                {infoTexto}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {onBulk && (
            <button className="btn btn-icon" onClick={onBulk} aria-label={`Ações em massa para ${titulo}`} title="Ações em Massa">
              <ListChecks size={16} />
            </button>
          )}
          {onAdd && (
            <button className="btn btn-primary btn-icon" onClick={onAdd} aria-label={`Criar novo registro em ${titulo}`}>
              <Plus size={18} />
            </button>
          )}
        </div>
      </div>
      <div style={{ maxHeight: '440px', overflowY: 'auto', padding: '12px' }} className="custom-scrollbar">
        {children}
      </div>
    </div>
  );
}

export function Categorias() {
  const { canCadastrar, canEditar, canExcluir } = usePermissions();
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

  const { announce } = useReTool();
  const BULK_THRESHOLD = 20;
  const { progress: bulkProgress, runWithProgress } = useBulkProgress();

  // ---- Bulk: Categorias ----
  const [isCatBulkOpen, setIsCatBulkOpen] = useState(false);
  const [catBulkSelected, setCatBulkSelected] = useState<Set<string>>(new Set());
  const [catBulkSearch, setCatBulkSearch] = useState('');
  const [catBulkConfirm, setCatBulkConfirm] = useState<'disable' | 'delete' | null>(null);
  const [catBulkLoading, setCatBulkLoading] = useState(false);

  const catBulkFiltered = useMemo(() => {
    if (!catBulkSearch.trim()) return categorias;
    const q = catBulkSearch.toLowerCase();
    return categorias.filter(c => c.nome?.toLowerCase().includes(q));
  }, [categorias, catBulkSearch]);

  const catBulkItems: BulkItem[] = catBulkFiltered.map(c => ({
    id: c.id,
    label: c.nome || 'Sem nome',
    inactive: c.ativo === false
  }));

  const catToggle = (id: string) => setCatBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const catToggleAll = () => {
    const ids = catBulkFiltered.map(c => c.id);
    const all = ids.length > 0 && ids.every(id => catBulkSelected.has(id));
    setCatBulkSelected(prev => { const n = new Set(prev); all ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id)); return n; });
  };
  const closeCatBulk = () => { setIsCatBulkOpen(false); setCatBulkSelected(new Set()); setCatBulkSearch(''); setCatBulkConfirm(null); };
  const handleCatBulkDisable = async () => {
    setCatBulkLoading(true);
    const ids = Array.from(catBulkSelected);
    const useSilent = ids.length > BULK_THRESHOLD;
    try {
      await runWithProgress(ids, id => updateCategoria(id, { ativo: false }, useSilent));
      if (useSilent) announce(`${ids.length} categorias desativadas com sucesso`);
    } finally { setCatBulkLoading(false); closeCatBulk(); }
  };
  const handleCatBulkDelete = async () => {
    setCatBulkLoading(true);
    const ids = Array.from(catBulkSelected);
    const useSilent = ids.length > BULK_THRESHOLD;
    try {
      await runWithProgress(ids, id => deleteCategoria(id, useSilent));
      if (useSilent) announce(`${ids.length} categorias excluídas com sucesso`);
    } finally { setCatBulkLoading(false); closeCatBulk(); }
  };

  // ---- Bulk: Famílias ----
  const [isFamBulkOpen, setIsFamBulkOpen] = useState(false);
  const [famBulkSelected, setFamBulkSelected] = useState<Set<string>>(new Set());
  const [famBulkSearch, setFamBulkSearch] = useState('');
  const [famBulkConfirm, setFamBulkConfirm] = useState<'disable' | 'delete' | null>(null);
  const [famBulkLoading, setFamBulkLoading] = useState(false);

  const famBulkFiltered = useMemo(() => {
    if (!famBulkSearch.trim()) return familias;
    const q = famBulkSearch.toLowerCase();
    return familias.filter(f => f.nome?.toLowerCase().includes(q));
  }, [familias, famBulkSearch]);

  const famBulkItems: BulkItem[] = famBulkFiltered.map(f => ({
    id: f.id,
    label: f.nome || 'Sem nome',
    inactive: f.ativo === false
  }));

  const famToggle = (id: string) => setFamBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const famToggleAll = () => {
    const ids = famBulkFiltered.map(f => f.id);
    const all = ids.length > 0 && ids.every(id => famBulkSelected.has(id));
    setFamBulkSelected(prev => { const n = new Set(prev); all ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id)); return n; });
  };
  const closeFamBulk = () => { setIsFamBulkOpen(false); setFamBulkSelected(new Set()); setFamBulkSearch(''); setFamBulkConfirm(null); };
  const handleFamBulkDisable = async () => {
    setFamBulkLoading(true);
    const ids = Array.from(famBulkSelected);
    const useSilent = ids.length > BULK_THRESHOLD;
    try {
      await runWithProgress(ids, id => updateFamilia(id, { ativo: false }, useSilent));
      if (useSilent) announce(`${ids.length} famílias desativadas com sucesso`);
    } finally { setFamBulkLoading(false); closeFamBulk(); }
  };
  const handleFamBulkDelete = async () => {
    setFamBulkLoading(true);
    const ids = Array.from(famBulkSelected);
    const useSilent = ids.length > BULK_THRESHOLD;
    try {
      await runWithProgress(ids, id => deleteFamilia(id, useSilent));
      if (useSilent) announce(`${ids.length} famílias excluídas com sucesso`);
    } finally { setFamBulkLoading(false); closeFamBulk(); }
  };

  // ---- Bulk: Produtos ----
  const [isProdBulkOpen, setIsProdBulkOpen] = useState(false);
  const [prodBulkSelected, setProdBulkSelected] = useState<Set<string>>(new Set());
  const [prodBulkSearch, setProdBulkSearch] = useState('');
  const [prodBulkConfirm, setProdBulkConfirm] = useState<'disable' | 'delete' | null>(null);
  const [prodBulkLoading, setProdBulkLoading] = useState(false);

  const prodBulkFiltered = useMemo(() => {
    if (!prodBulkSearch.trim()) return produtos;
    const q = prodBulkSearch.toLowerCase();
    return produtos.filter(p => p.nome?.toLowerCase().includes(q));
  }, [produtos, prodBulkSearch]);

  const prodBulkItems: BulkItem[] = prodBulkFiltered.map(p => ({
    id: p.id,
    label: p.nome || 'Sem nome',
    inactive: p.ativo === false
  }));

  const prodToggle = (id: string) => setProdBulkSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const prodToggleAll = () => {
    const ids = prodBulkFiltered.map(p => p.id);
    const all = ids.length > 0 && ids.every(id => prodBulkSelected.has(id));
    setProdBulkSelected(prev => { const n = new Set(prev); all ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id)); return n; });
  };
  const closeProdBulk = () => { setIsProdBulkOpen(false); setProdBulkSelected(new Set()); setProdBulkSearch(''); setProdBulkConfirm(null); };
  const handleProdBulkDisable = async () => {
    setProdBulkLoading(true);
    const ids = Array.from(prodBulkSelected);
    const useSilent = ids.length > BULK_THRESHOLD;
    try {
      await runWithProgress(ids, id => updateProduto(id, { ativo: false }, useSilent));
      if (useSilent) announce(`${ids.length} produtos desativados com sucesso`);
    } finally { setProdBulkLoading(false); closeProdBulk(); }
  };
  const handleProdBulkDelete = async () => {
    setProdBulkLoading(true);
    const ids = Array.from(prodBulkSelected);
    const useSilent = ids.length > BULK_THRESHOLD;
    try {
      await runWithProgress(ids, id => deleteProduto(id, useSilent));
      if (useSilent) announce(`${ids.length} produtos excluídos com sucesso`);
    } finally { setProdBulkLoading(false); closeProdBulk(); }
  };

  const badgeInativo = (
    <span className="badge" style={{ backgroundColor: 'var(--gray02)', color: 'var(--gray00)', fontSize: '0.7rem', padding: '1px 6px', flexShrink: 0 }}>Inativo</span>
  );

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2 style={{ marginBottom: 'var(--spacing-xs)' }}>Gestão de Classificações</h2>
        <p style={{ color: 'var(--color-text-body)' }}>Gerencie e visualize todas as estruturas de classificação usadas no sistema.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-lg)', alignItems: 'start' }}>

        {/* Painel Categorias */}
        <PainelClassificacao
          titulo="Categorias"
          contagem={categorias.length}
          infoAberta={showCatInfo}
          onInfo={setShowCatInfo}
          infoAria="O que são categorias?"
          infoTexto={<><strong>Grupos macro</strong> para classificar os dispositivos de forma geral.<br /><em>Exemplos: Ferramentas de Corte, EPIs, Gabaritos.</em></>}
          onBulk={canExcluir ? () => setIsCatBulkOpen(true) : undefined}
          onAdd={canCadastrar ? () => openCatForm() : undefined}
        >
          <FocusableList
            items={categorias}
            ariaLabel="Lista de categorias."
            onItemAction={canEditar ? (c) => openCatForm(c.id, c.nome) : undefined}
            renderItem={(c, idx, isFocused) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px', opacity: c.ativo === false ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.nome}>{c.nome || 'Sem Nome'}</span>
                  {c.ativo === false && badgeInativo}
                </div>
                <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                  {canEditar && (
                    <button
                      className="btn btn-icon"
                      style={estiloBtnLinha}
                      tabIndex={isFocused ? 0 : -1}
                      onClick={(e) => { e.stopPropagation(); openCatForm(c.id, c.nome); }}
                      aria-label={`Editar categoria ${c.nome}`}
                      title="Editar"
                    >
                      <Edit size={14} />
                    </button>
                  )}
                  {canEditar && c.ativo === false && (
                    <button
                      className="btn btn-icon"
                      style={{ ...estiloBtnLinha, color: 'var(--color-success)' }}
                      tabIndex={isFocused ? 0 : -1}
                      onClick={(e) => { e.stopPropagation(); updateCategoria(c.id, { ativo: true }); }}
                      aria-label={`Ativar categoria ${c.nome}`}
                      title="Ativar"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  {canExcluir && (
                    <button
                      className="btn btn-icon"
                      style={{ ...estiloBtnLinha, color: 'var(--color-danger)' }}
                      tabIndex={isFocused ? 0 : -1}
                      onClick={(e) => { e.stopPropagation(); setCatConfirmAction(c); }}
                      aria-label={c.ativo === false ? `Excluir categoria ${c.nome}` : `Excluir ou desativar categoria ${c.nome}`}
                      title="Excluir / desativar"
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          />
        </PainelClassificacao>

        {/* Painel Famílias */}
        <PainelClassificacao
          titulo="Famílias de Produto"
          contagem={familias.length}
          infoAberta={showFamInfo}
          onInfo={setShowFamInfo}
          infoAria="O que são famílias de produto?"
          infoTexto={<><strong>Grupo de manufatura</strong> da peça.<br /><em>Exemplos: Preparo de Solo, Colheita, Transporte.</em></>}
          onBulk={canExcluir ? () => setIsFamBulkOpen(true) : undefined}
          onAdd={canCadastrar ? () => openFamForm() : undefined}
        >
          <FocusableList
            items={familias}
            ariaLabel="Lista de famílias."
            onItemAction={canEditar ? (f) => openFamForm(f.id, f.nome) : undefined}
            renderItem={(f, idx, isFocused) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px', opacity: f.ativo === false ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.nome}>{f.nome || 'Sem Nome'}</span>
                  {f.ativo === false && badgeInativo}
                </div>
                <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                  {canEditar && (
                    <button
                      className="btn btn-icon"
                      style={estiloBtnLinha}
                      tabIndex={isFocused ? 0 : -1}
                      onClick={(e) => { e.stopPropagation(); openFamForm(f.id, f.nome); }}
                      aria-label={`Editar família ${f.nome}`}
                      title="Editar"
                    >
                      <Edit size={14} />
                    </button>
                  )}
                  {canEditar && f.ativo === false && (
                    <button
                      className="btn btn-icon"
                      style={{ ...estiloBtnLinha, color: 'var(--color-success)' }}
                      tabIndex={isFocused ? 0 : -1}
                      onClick={(e) => { e.stopPropagation(); updateFamilia(f.id, { ativo: true }); }}
                      aria-label={`Ativar família ${f.nome}`}
                      title="Ativar"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  {canExcluir && (
                    <button
                      className="btn btn-icon"
                      style={{ ...estiloBtnLinha, color: 'var(--color-danger)' }}
                      tabIndex={isFocused ? 0 : -1}
                      onClick={(e) => { e.stopPropagation(); setFamConfirmAction(f); }}
                      aria-label={f.ativo === false ? `Excluir família ${f.nome}` : `Excluir ou desativar família ${f.nome}`}
                      title="Excluir / desativar"
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          />
        </PainelClassificacao>

        {/* Painel Produtos */}
        <PainelClassificacao
          titulo="Produtos"
          contagem={produtos.length}
          infoAberta={showProdInfo}
          onInfo={setShowProdInfo}
          infoAria="O que são produtos?"
          infoTexto={<><strong>Nome comercial ou modelo</strong> do produto associado.<br /><em>Exemplos: AVOLA 2500, Semeadeira XP.</em></>}
          onBulk={canExcluir ? () => setIsProdBulkOpen(true) : undefined}
          onAdd={canCadastrar ? () => openProdForm() : undefined}
        >
          <FocusableList
            items={produtos}
            ariaLabel="Lista de produtos."
            onItemAction={canEditar ? (p) => openProdForm(p.id, p.nome) : undefined}
            renderItem={(p, idx, isFocused) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px', opacity: p.ativo === false ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nome}>{p.nome || 'Sem Nome'}</span>
                  {p.ativo === false && badgeInativo}
                </div>
                <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                  {canEditar && (
                    <button
                      className="btn btn-icon"
                      style={estiloBtnLinha}
                      tabIndex={isFocused ? 0 : -1}
                      onClick={(e) => { e.stopPropagation(); openProdForm(p.id, p.nome); }}
                      aria-label={`Editar produto ${p.nome}`}
                      title="Editar"
                    >
                      <Edit size={14} />
                    </button>
                  )}
                  {canEditar && p.ativo === false && (
                    <button
                      className="btn btn-icon"
                      style={{ ...estiloBtnLinha, color: 'var(--color-success)' }}
                      tabIndex={isFocused ? 0 : -1}
                      onClick={(e) => { e.stopPropagation(); updateProduto(p.id, { ativo: true }); }}
                      aria-label={`Ativar produto ${p.nome}`}
                      title="Ativar"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  {canExcluir && (
                    <button
                      className="btn btn-icon"
                      style={{ ...estiloBtnLinha, color: 'var(--color-danger)' }}
                      tabIndex={isFocused ? 0 : -1}
                      onClick={(e) => { e.stopPropagation(); setProdConfirmAction(p); }}
                      aria-label={p.ativo === false ? `Excluir produto ${p.nome}` : `Excluir ou desativar produto ${p.nome}`}
                      title="Excluir / desativar"
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          />
        </PainelClassificacao>

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

      {/* Bulk Action Modals */}
      <BulkActionModal
        isOpen={isCatBulkOpen}
        onClose={closeCatBulk}
        items={catBulkItems}
        selected={catBulkSelected}
        search={catBulkSearch}
        onSearchChange={setCatBulkSearch}
        onToggleItem={catToggle}
        onToggleAll={catToggleAll}
        confirmAction={catBulkConfirm}
        onSetConfirmAction={setCatBulkConfirm}
        onDisable={handleCatBulkDisable}
        onDelete={handleCatBulkDelete}
        isLoading={catBulkLoading}
        progress={bulkProgress}
        canDisable={true}
      />

      <BulkActionModal
        isOpen={isFamBulkOpen}
        onClose={closeFamBulk}
        items={famBulkItems}
        selected={famBulkSelected}
        search={famBulkSearch}
        onSearchChange={setFamBulkSearch}
        onToggleItem={famToggle}
        onToggleAll={famToggleAll}
        confirmAction={famBulkConfirm}
        onSetConfirmAction={setFamBulkConfirm}
        onDisable={handleFamBulkDisable}
        onDelete={handleFamBulkDelete}
        isLoading={famBulkLoading}
        progress={bulkProgress}
        canDisable={true}
      />

      <BulkActionModal
        isOpen={isProdBulkOpen}
        onClose={closeProdBulk}
        items={prodBulkItems}
        selected={prodBulkSelected}
        search={prodBulkSearch}
        onSearchChange={setProdBulkSearch}
        onToggleItem={prodToggle}
        onToggleAll={prodToggleAll}
        confirmAction={prodBulkConfirm}
        onSetConfirmAction={setProdBulkConfirm}
        onDisable={handleProdBulkDisable}
        onDelete={handleProdBulkDelete}
        isLoading={prodBulkLoading}
        progress={bulkProgress}
        canDisable={true}
      />

    </div>
  );
}
