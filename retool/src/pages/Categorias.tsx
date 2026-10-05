import React, { useState, useMemo } from 'react';
import { useCategoriasController, EstadoEntidadeClassificacao } from '../presentation/hooks/useCategoriasController';
import { FocusableList } from '../components/FocusableList';
import { AccessibleModal } from '../components/AccessibleModal';
import { BulkActionModal, BulkItem } from '../components/BulkActionModal';
import { Plus, Trash, Edit, Info, Check, ListChecks, Search, X, LoaderCircle } from 'lucide-react';
import { useReTool } from '../context/ReToolContext';
import { useBulkProgress } from '../hooks/useBulkProgress';
import { usePermissions } from '../hooks/usePermissions';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { EstadoDados, SkeletonLinha } from '../components/feedback';

const estiloBtnLinha: React.CSSProperties = {
  width: 28,
  height: 28,
  minHeight: 'unset',
  padding: 0,
  border: 'none',
  backgroundColor: 'transparent',
  boxShadow: 'none',
  color: '#6b7280'
};

/** Acima disso a lista é renderizada em blocos ("Mostrar mais"). */
const LIMITE_INICIAL = 100;
const DEBOUNCE_BUSCA_MS = 250;

type ItemClassificacao = { id: string; nome?: string; ativo?: boolean };

/** Busca sem diferenciar maiúsculas nem acentos. */
function normalizar(texto: string | undefined): string {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Linhas fantasma no mesmo formato dos itens do FocusableList. */
function SkeletonItensClassificacao({ linhas = 6 }: { linhas?: number }) {
  const larguras = ['58%', '42%', '66%', '50%', '38%', '61%'];
  return (
    <ul aria-hidden="true" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {Array.from({ length: linhas }, (_, i) => (
        <li key={i} style={{
          padding: 'var(--spacing-md) var(--spacing-lg)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', minHeight: '54px'
        }}>
          <SkeletonLinha largura={larguras[i % larguras.length]} altura={12} />
        </li>
      ))}
    </ul>
  );
}

interface PainelClassificacaoProps<T extends ItemClassificacao> {
  titulo: string;
  /** Substantivo no plural e minúsculo, para os textos ("categorias"). */
  nomePlural: string;
  /** "Nenhuma categoria cadastrada" etc. */
  textoVazio: string;
  itens: T[];
  carregando: boolean;
  erro: string | null;
  onTentarNovamente?: () => void;
  infoAberta: boolean;
  onInfo: (v: boolean) => void;
  infoTexto: React.ReactNode;
  infoAria: string;
  onBulk?: () => void;
  onAdd?: () => void;
  onItemAction?: (item: T) => void;
  renderItem: (item: T, index: number, isFocused: boolean) => React.ReactNode;
}

function PainelClassificacao<T extends ItemClassificacao>({
  titulo, nomePlural, textoVazio, itens, carregando, erro, onTentarNovamente,
  infoAberta, onInfo, infoTexto, infoAria, onBulk, onAdd, onItemAction, renderItem
}: PainelClassificacaoProps<T>) {
  const [busca, setBuscaBruta] = useState('');
  const buscaAplicada = useDebouncedValue(busca, DEBOUNCE_BUSCA_MS);
  const [limite, setLimite] = useState(LIMITE_INICIAL);
  const idBusca = `busca-${nomePlural.replace(/\s+/g, '-')}`;

  // Nova busca recomeça do primeiro bloco.
  const setBusca = (v: string) => { setBuscaBruta(v); setLimite(LIMITE_INICIAL); };

  const filtrados = useMemo(() => {
    const q = normalizar(buscaAplicada.trim());
    if (!q) return itens;
    return itens.filter(i => normalizar(i.nome).includes(q));
  }, [itens, buscaAplicada]);

  const visiveis = useMemo(() => filtrados.slice(0, limite), [filtrados, limite]);
  const restantes = filtrados.length - visiveis.length;
  const buscando = busca !== buscaAplicada;
  const temFiltro = buscaAplicada.trim().length > 0;

  let conteudo: React.ReactNode;
  if (itens.length === 0 && carregando) {
    conteudo = (
      <>
        <span className="sr-only" role="status">Carregando {nomePlural}…</span>
        <SkeletonItensClassificacao />
      </>
    );
  } else if (itens.length === 0 && erro) {
    conteudo = (
      <EstadoDados
        estado="erro"
        compacto
        titulo={`Não foi possível carregar ${nomePlural}`}
        descricao={erro}
        onTentarNovamente={onTentarNovamente}
      />
    );
  } else if (itens.length === 0) {
    conteudo = (
      <EstadoDados estado="vazio" compacto titulo={textoVazio} descricao={onAdd ? 'Use o botão + para cadastrar o primeiro.' : ''}>
        {onAdd && (
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            <Plus size={16} aria-hidden="true" /> Cadastrar
          </button>
        )}
      </EstadoDados>
    );
  } else if (filtrados.length === 0) {
    conteudo = (
      <EstadoDados estado="sem-resultados" compacto titulo={`Nenhum resultado para “${buscaAplicada.trim()}”`} descricao="">
        <button type="button" className="btn" onClick={() => setBusca('')}>Limpar busca</button>
      </EstadoDados>
    );
  } else {
    conteudo = (
      <>
        <FocusableList
          items={visiveis}
          ariaLabel={`Lista de ${nomePlural}.`}
          onItemAction={onItemAction}
          renderItem={renderItem}
        />
        {restantes > 0 && (
          <div className="lista-mostrar-mais">
            <span>Exibindo {visiveis.length.toLocaleString('pt-BR')} de {filtrados.length.toLocaleString('pt-BR')}</span>
            <button type="button" className="btn" onClick={() => setLimite(l => l + LIMITE_INICIAL)}>
              Mostrar mais {Math.min(LIMITE_INICIAL, restantes).toLocaleString('pt-BR')}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', backgroundColor: '#fafafa',
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{titulo}</h3>
          <span
            style={{
              fontSize: '0.7rem', fontWeight: 700, color: '#6b7280',
              backgroundColor: '#f3f4f6', border: '1px solid var(--color-border)',
              padding: '1px 8px', borderRadius: '10px', fontVariantNumeric: 'tabular-nums'
            }}
            aria-label={temFiltro ? `${filtrados.length} de ${itens.length} ${nomePlural}` : `${itens.length} ${nomePlural}`}
          >
            {carregando && itens.length === 0 ? '…' : temFiltro ? `${filtrados.length}/${itens.length}` : itens.length}
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
              <div style={{ position: 'absolute', top: '100%', left: '0', marginTop: '8px', padding: '12px', backgroundColor: '#f9fafb', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--color-text-dark)', width: 'min(300px, 80vw)', zIndex: 50, boxShadow: 'var(--shadow-lg)', lineHeight: 1.5 }}>
                {infoTexto}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {onBulk && (
            <button className="btn btn-icon" onClick={onBulk} aria-label={`Ações em massa para ${titulo}`} title="Ações em Massa" disabled={itens.length === 0}>
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

      {itens.length > 0 && (
        <div style={{ padding: '12px 12px 0', position: 'relative' }}>
          <label htmlFor={idBusca} className="sr-only">Buscar {nomePlural}</label>
          <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(calc(-50% + 6px))', color: '#6b7280', pointerEvents: 'none' }} />
          <input
            id={idBusca}
            type="search"
            className="input-field"
            placeholder={`Buscar ${nomePlural}…`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoComplete="off"
            style={{ paddingLeft: 32, paddingRight: 36, minHeight: 36, fontSize: '0.88rem' }}
          />
          {busca && (
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              style={{ ...estiloBtnLinha, position: 'absolute', right: 18, top: '50%', transform: 'translateY(calc(-50% + 6px))' }}
            >
              {buscando ? <LoaderCircle size={14} className="estado-dados-girando" aria-hidden="true" /> : <X size={14} />}
            </button>
          )}
        </div>
      )}

      <div style={{ maxHeight: '440px', overflowY: 'auto', padding: '12px' }} className="custom-scrollbar">
        {conteudo}
      </div>
    </div>
  );
}

interface LinhaClassificacaoProps {
  item: ItemClassificacao;
  /** "categoria", "família", "produto" */
  rotulo: string;
  isFocused: boolean;
  canEditar: boolean;
  canExcluir: boolean;
  reativando: boolean;
  onEditar: () => void;
  onReativar: () => void;
  onExcluir: () => void;
}

const badgeInativo = (
  <span className="badge" style={{ backgroundColor: 'var(--gray02)', color: 'var(--gray00)', fontSize: '0.7rem', padding: '1px 6px', flexShrink: 0 }}>Inativo</span>
);

function LinhaClassificacao({ item, rotulo, isFocused, canEditar, canExcluir, reativando, onEditar, onReativar, onExcluir }: LinhaClassificacaoProps) {
  const inativo = item.ativo === false;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px', opacity: inativo ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.nome}>{item.nome || 'Sem Nome'}</span>
        {inativo && badgeInativo}
      </div>
      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
        {canEditar && (
          <button
            className="btn btn-icon"
            style={estiloBtnLinha}
            tabIndex={isFocused ? 0 : -1}
            onClick={(e) => { e.stopPropagation(); onEditar(); }}
            aria-label={`Editar ${rotulo} ${item.nome}`}
            title="Editar"
          >
            <Edit size={14} />
          </button>
        )}
        {canEditar && inativo && (
          <button
            className="btn btn-icon"
            style={{ ...estiloBtnLinha, color: 'var(--color-success)' }}
            tabIndex={isFocused ? 0 : -1}
            disabled={reativando}
            aria-busy={reativando || undefined}
            onClick={(e) => { e.stopPropagation(); onReativar(); }}
            aria-label={reativando ? `Ativando ${rotulo} ${item.nome}…` : `Ativar ${rotulo} ${item.nome}`}
            title={reativando ? 'Ativando…' : 'Ativar'}
          >
            {reativando ? <LoaderCircle size={14} className="estado-dados-girando" /> : <Check size={14} />}
          </button>
        )}
        {canExcluir && (
          <button
            className="btn btn-icon"
            style={{ ...estiloBtnLinha, color: 'var(--color-danger)' }}
            tabIndex={isFocused ? 0 : -1}
            onClick={(e) => { e.stopPropagation(); onExcluir(); }}
            aria-label={inativo ? `Excluir ${rotulo} ${item.nome}` : `Excluir ou desativar ${rotulo} ${item.nome}`}
            title="Excluir / desativar"
          >
            <Trash size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Mensagem de erro inline em modais (anunciada por leitores de tela). */
function ErroInline({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;
  return (
    <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem', fontWeight: 500 }}>{mensagem}</p>
  );
}


interface ModaisEntidadeProps {
  entidade: EstadoEntidadeClassificacao<any>;
  /** "Categoria", "Família", "Produto" */
  nome: string;
  /** artigo definido: "a" | "o" */
  artigo: 'a' | 'o';
  campoId: string;
}

/** Formulário (criar/editar) e confirmação (desativar/ativar/excluir) de uma entidade. */
function ModaisEntidade({ entidade: e, nome, artigo, campoId }: ModaisEntidadeProps) {
  const minusculo = nome.toLowerCase();
  const alvo = e.confirmAction;
  const inativo = alvo?.ativo === false;
  const pronome = artigo === 'a' ? 'desativá-la' : 'desativá-lo';
  const novo = artigo === 'a' ? `Nova ${nome}` : `Novo ${nome}`;

  return (
    <>
      <AccessibleModal isOpen={e.isModalOpen} onClose={e.fecharForm} title={e.editingId ? `Editar ${nome}` : novo}>
        <form onSubmit={e.handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }} aria-busy={e.salvando || undefined} noValidate>
          <div>
            <label htmlFor={campoId} style={{ display: 'block', marginBottom: '4px' }}>Nome d{artigo} {nome}</label>
            <input
              id={campoId} className="input-field" value={e.nome} autoFocus
              disabled={e.salvando}
              aria-invalid={!!e.erroForm || undefined}
              aria-describedby={e.erroForm ? `${campoId}-erro` : undefined}
              onChange={(ev) => e.setNome(ev.target.value)}
            />
          </div>
          <div id={`${campoId}-erro`}><ErroInline mensagem={e.erroForm} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={e.fecharForm} disabled={e.salvando}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={e.salvando} aria-busy={e.salvando || undefined}>
              {e.salvando && <LoaderCircle size={16} className="estado-dados-girando" aria-hidden="true" />}
              {e.salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </AccessibleModal>

      <AccessibleModal isOpen={!!alvo} onClose={() => e.setConfirmAction(null)} title={inativo ? `Excluir ${nome}` : `Gerenciar ${nome}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }} aria-busy={e.confirmEmAndamento || undefined}>
          {inativo ? (
            <p>Deseja excluir permanentemente {artigo} {minusculo} <strong>{alvo?.nome}</strong>?</p>
          ) : (
            <p>Deseja excluir permanentemente {artigo} {minusculo} <strong>{alvo?.nome}</strong> ou prefere apenas {pronome}?</p>
          )}
          <ErroInline mensagem={e.erroConfirm} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => e.setConfirmAction(null)} disabled={e.confirmEmAndamento}>Cancelar</button>
            <button
              type="button" className="btn"
              style={inativo ? { color: 'var(--color-success)', borderColor: 'var(--color-success)' } : { color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
              disabled={e.confirmEmAndamento}
              onClick={() => e.executarConfirm('alternar')}
            >
              {inativo ? 'Ativar' : 'Desativar'}
            </button>
            <button
              type="button" className="btn btn-primary" style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              disabled={e.confirmEmAndamento}
              aria-busy={e.confirmEmAndamento || undefined}
              onClick={() => e.executarConfirm('excluir')}
            >
              {e.confirmEmAndamento && <LoaderCircle size={16} className="estado-dados-girando" aria-hidden="true" />}
              {e.confirmEmAndamento ? 'Processando…' : 'Excluir Permanente'}
            </button>
          </div>
        </div>
      </AccessibleModal>
    </>
  );
}

export function Categorias() {
  const { canCadastrar, canEditar, canExcluir } = usePermissions();
  const {
    categorias,
    familias,
    produtos,
    referenciasProntas,
    erroReferencias,
    cat,
    fam,
    prod,
    updateCategoria,
    deleteCategoria,
    updateFamilia,
    deleteFamilia,
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

  const { recarregarReferencias } = useReTool();
  const tentarNovamente = () => recarregarReferencias();
  const carregando = !referenciasProntas;
  const temAlgumDado = categorias.length + familias.length + produtos.length > 0;

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2 style={{ marginBottom: 'var(--spacing-xs)' }}>Gestão de Classificações</h2>
        <p style={{ color: 'var(--color-text-body)' }}>Gerencie e visualize todas as estruturas de classificação usadas no sistema.</p>
      </div>

      {erroReferencias && temAlgumDado && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-sm)', flexWrap: 'wrap',
          padding: '10px 14px', marginBottom: 'var(--spacing-lg)', borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--color-box-pink-bg)', color: 'var(--color-box-pink-text)', fontSize: '0.85rem'
        }}>
          <span>Não foi possível atualizar as classificações. Os dados exibidos podem estar desatualizados.</span>
          <button type="button" className="btn" onClick={tentarNovamente} style={{ minHeight: 32, padding: '4px 12px' }}>Tentar novamente</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 'var(--spacing-lg)', alignItems: 'start' }}>

        {/* Painel Categorias */}
        <PainelClassificacao
          titulo="Categorias"
          nomePlural="categorias"
          textoVazio="Nenhuma categoria cadastrada"
          itens={categorias}
          carregando={carregando}
          erro={erroReferencias}
          onTentarNovamente={tentarNovamente}
          infoAberta={showCatInfo}
          onInfo={setShowCatInfo}
          infoAria="O que são categorias?"
          infoTexto={<><strong>Grupos macro</strong> para classificar os dispositivos de forma geral.<br /><em>Exemplos: Ferramentas de Corte, EPIs, Gabaritos.</em></>}
          onBulk={canExcluir ? () => setIsCatBulkOpen(true) : undefined}
          onAdd={canCadastrar ? () => cat.openForm() : undefined}
          onItemAction={canEditar ? (c) => cat.openForm(c.id, c.nome) : undefined}
          renderItem={(c, _idx, isFocused) => (
            <LinhaClassificacao
              item={c} rotulo="categoria" isFocused={isFocused}
              canEditar={canEditar} canExcluir={canExcluir}
              reativando={cat.reativandoIds.has(c.id)}
              onEditar={() => cat.openForm(c.id, c.nome)}
              onReativar={() => cat.reativar(c)}
              onExcluir={() => cat.setConfirmAction(c)}
            />
          )}
        />

        {/* Painel Famílias */}
        <PainelClassificacao
          titulo="Famílias de Produto"
          nomePlural="famílias"
          textoVazio="Nenhuma família cadastrada"
          itens={familias}
          carregando={carregando}
          erro={erroReferencias}
          onTentarNovamente={tentarNovamente}
          infoAberta={showFamInfo}
          onInfo={setShowFamInfo}
          infoAria="O que são famílias de produto?"
          infoTexto={<><strong>Grupo de manufatura</strong> da peça.<br /><em>Exemplos: Preparo de Solo, Colheita, Transporte.</em></>}
          onBulk={canExcluir ? () => setIsFamBulkOpen(true) : undefined}
          onAdd={canCadastrar ? () => fam.openForm() : undefined}
          onItemAction={canEditar ? (f) => fam.openForm(f.id, f.nome) : undefined}
          renderItem={(f, _idx, isFocused) => (
            <LinhaClassificacao
              item={f} rotulo="família" isFocused={isFocused}
              canEditar={canEditar} canExcluir={canExcluir}
              reativando={fam.reativandoIds.has(f.id)}
              onEditar={() => fam.openForm(f.id, f.nome)}
              onReativar={() => fam.reativar(f)}
              onExcluir={() => fam.setConfirmAction(f)}
            />
          )}
        />

        {/* Painel Produtos */}
        <PainelClassificacao
          titulo="Produtos"
          nomePlural="produtos"
          textoVazio="Nenhum produto cadastrado"
          itens={produtos}
          carregando={carregando}
          erro={erroReferencias}
          onTentarNovamente={tentarNovamente}
          infoAberta={showProdInfo}
          onInfo={setShowProdInfo}
          infoAria="O que são produtos?"
          infoTexto={<><strong>Nome comercial ou modelo</strong> do produto associado.<br /><em>Exemplos: AVOLA 2500, Semeadeira XP.</em></>}
          onBulk={canExcluir ? () => setIsProdBulkOpen(true) : undefined}
          onAdd={canCadastrar ? () => prod.openForm() : undefined}
          onItemAction={canEditar ? (p) => prod.openForm(p.id, p.nome) : undefined}
          renderItem={(p, _idx, isFocused) => (
            <LinhaClassificacao
              item={p} rotulo="produto" isFocused={isFocused}
              canEditar={canEditar} canExcluir={canExcluir}
              reativando={prod.reativandoIds.has(p.id)}
              onEditar={() => prod.openForm(p.id, p.nome)}
              onReativar={() => prod.reativar(p)}
              onExcluir={() => prod.setConfirmAction(p)}
            />
          )}
        />

      </div>

      <ModaisEntidade entidade={cat} nome="Categoria" artigo="a" campoId="catName" />
      <ModaisEntidade entidade={fam} nome="Família" artigo="a" campoId="famName" />
      <ModaisEntidade entidade={prod} nome="Produto" artigo="o" campoId="prodName" />

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
