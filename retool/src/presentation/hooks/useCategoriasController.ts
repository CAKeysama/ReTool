import { useCallback, useState } from 'react';
import { useReTool } from '../../context/ReToolContext';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { mensagemDeErro } from '../../components/feedback/EstadoDados';

export type Registro = { id: string; nome?: string; ativo?: boolean };

interface OperacoesEntidade<T extends Registro> {
  add: (data: { nome: string }) => Promise<unknown>;
  update: (id: string, data: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Estado de formulário + confirmação de uma entidade de classificação.
 * Toda gravação aguarda a confirmação do servidor antes de fechar o modal
 * (a mensagem de sucesso vem do contexto, depois do await), e a trava de
 * useAsyncAction impede clique duplo em Salvar/Excluir/Desativar.
 */
function useEntidadeClassificacao<T extends Registro>({ add, update, remove }: OperacoesEntidade<T>) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [confirmAction, setConfirmActionState] = useState<T | null>(null);
  const [erroConfirm, setErroConfirm] = useState<string | null>(null);
  const [reativandoIds, setReativandoIds] = useState<Set<string>>(() => new Set());

  const salvar = useAsyncAction(async (id: string | null, valor: string) => {
    if (id) await update(id, { nome: valor } as Partial<T>);
    else await add({ nome: valor });
  });

  const acaoConfirm = useAsyncAction(async (tipo: 'alternar' | 'excluir', item: T) => {
    if (tipo === 'excluir') await remove(item.id);
    else await update(item.id, { ativo: item.ativo === false } as Partial<T>);
  });

  const openForm = useCallback((id?: string, currentName?: string) => {
    setEditingId(id || null);
    setNome(currentName || '');
    setErroForm(null);
    setIsModalOpen(true);
  }, []);

  const fecharForm = useCallback(() => {
    // Não fecha no meio da gravação: o usuário perderia o retorno da operação.
    if (salvar.emAndamento) return;
    setIsModalOpen(false);
  }, [salvar.emAndamento]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = nome.trim();
    if (!valor) {
      setErroForm('Informe um nome.');
      return;
    }
    setErroForm(null);
    const r = await salvar.executar(editingId, valor);
    if (r.ok) setIsModalOpen(false);
    else if (!r.ignorado) setErroForm(mensagemDeErro(r.erro, 'Não foi possível salvar. Tente novamente.'));
  };

  const setConfirmAction = useCallback((item: T | null) => {
    if (item === null && acaoConfirm.emAndamento) return;
    setErroConfirm(null);
    setConfirmActionState(item);
  }, [acaoConfirm.emAndamento]);

  const executarConfirm = async (tipo: 'alternar' | 'excluir') => {
    if (!confirmAction) return;
    setErroConfirm(null);
    const r = await acaoConfirm.executar(tipo, confirmAction);
    if (r.ok) setConfirmActionState(null);
    else if (!r.ignorado) setErroConfirm(mensagemDeErro(r.erro));
  };

  /** Reativação direto na linha, com trava por item. */
  const reativar = async (item: T) => {
    if (reativandoIds.has(item.id)) return;
    setReativandoIds(prev => new Set(prev).add(item.id));
    try {
      await update(item.id, { ativo: true } as Partial<T>);
    } catch {
      // O erro já é anunciado pelo contexto/console; a linha volta ao estado anterior.
    } finally {
      setReativandoIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  };

  return {
    isModalOpen, setIsModalOpen, fecharForm, editingId, nome, setNome, erroForm,
    openForm, handleSave, salvando: salvar.emAndamento,
    confirmAction, setConfirmAction, executarConfirm, erroConfirm,
    confirmEmAndamento: acaoConfirm.emAndamento,
    reativar, reativandoIds
  };
}

/** Estado exposto por entidade (cat, fam, prod). */
export type EstadoEntidadeClassificacao<T extends Registro = Registro> = ReturnType<typeof useEntidadeClassificacao<T>>;

export function useCategoriasController() {
  const {
    categorias, addCategoria, updateCategoria, deleteCategoria,
    familias, addFamilia, updateFamilia, deleteFamilia,
    produtos, addProduto, updateProduto, deleteProduto,
    referenciasProntas, erroReferencias
  } = useReTool();

  const cat = useEntidadeClassificacao<Categoria>({
    add: (d) => addCategoria(d),
    update: (id, d) => updateCategoria(id, d),
    remove: (id) => deleteCategoria(id)
  });
  const fam = useEntidadeClassificacao<Familia>({
    add: (d) => addFamilia({ ...d, ativo: true }),
    update: (id, d) => updateFamilia(id, d),
    remove: (id) => deleteFamilia(id)
  });
  const prod = useEntidadeClassificacao<Produto>({
    add: (d) => addProduto({ ...d, ativo: true }),
    update: (id, d) => updateProduto(id, d),
    remove: (id) => deleteProduto(id)
  });

  // States for tooltips
  const [showCatInfo, setShowCatInfo] = useState(false);
  const [showFamInfo, setShowFamInfo] = useState(false);
  const [showProdInfo, setShowProdInfo] = useState(false);

  return {
    categorias,
    familias,
    produtos,
    referenciasProntas: referenciasProntas as boolean,
    erroReferencias: erroReferencias as string | null,

    // Estado completo por entidade (formulário, confirmação, processamento)
    cat,
    fam,
    prod,

    // Usados pelas ações em massa
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
  };
}
