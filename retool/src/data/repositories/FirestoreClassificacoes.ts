import { db } from '../datasources/firebase';
import {
  doc, collection, onSnapshot, setDoc, writeBatch, WriteBatch, FieldPath, deleteField, getCountFromServer,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';
import { medirConsulta } from '../observabilidade/metricas';

/**
 * Catálogo das classificações (categorias, famílias e produtos) num único
 * documento: `indices/classificacoes`.
 *
 * Antes, cada abertura do app assinava as três coleções inteiras (~520
 * leituras com 12 categorias, 110 famílias e 400 produtos). Com o catálogo,
 * abrir o app custa 1 leitura do documento + 3 contagens para conferir que
 * ele bate com as coleções. Toda gravação feita pelo app atualiza a coleção e
 * o catálogo no mesmo writeBatch. Se o catálogo não existir ou não bater
 * (alguém gravou fora do app), o app volta a ler as coleções e quem pode
 * editar recria o catálogo.
 */

export type ColecaoClassificacao = 'categorias' | 'familias' | 'produtos';

export interface CatalogoClassificacoes {
  categorias: Record<string, Categoria>;
  familias: Record<string, Familia>;
  produtos: Record<string, Produto>;
  atualizadoEm: string;
}

export const catalogoClassificacoesRef = () => doc(db, 'indices', 'classificacoes');

export function assinarCatalogoClassificacoes(
  cb: (c: CatalogoClassificacoes | null) => void,
  erro: (e: unknown) => void
): () => void {
  return onSnapshot(catalogoClassificacoesRef(), s => cb(s.exists() ? (s.data() as CatalogoClassificacoes) : null), erro);
}

/** Total de documentos de cada coleção (count: 1 leitura por coleção até 1.000 itens). */
export async function contarClassificacoes(): Promise<Record<ColecaoClassificacao, number>> {
  const contar = (c: ColecaoClassificacao) =>
    medirConsulta(`${c}:count`, () => getCountFromServer(collection(db, c)), () => 1).then(s => s.data().count);
  const [categorias, familias, produtos] = await Promise.all([contar('categorias'), contar('familias'), contar('produtos')]);
  return { categorias, familias, produtos };
}

const porId = <T extends { id: string }>(l: T[]) => Object.fromEntries(l.map(x => [x.id, x])) as Record<string, T>;

export async function criarCatalogoClassificacoes(categorias: Categoria[], familias: Familia[], produtos: Produto[]): Promise<void> {
  const c: CatalogoClassificacoes = {
    categorias: porId(categorias),
    familias: porId(familias),
    produtos: porId(produtos),
    atualizadoEm: new Date().toISOString(),
  };
  await setDoc(catalogoClassificacoesRef(), JSON.parse(JSON.stringify(c)));
}

export function listasDoCatalogo(c: CatalogoClassificacoes) {
  const porNome = <T extends { nome?: string }>(a: T, b: T) => (a.nome || '').localeCompare(b.nome || '');
  return {
    categorias: Object.values(c.categorias || {}),
    familias: Object.values(c.familias || {}).sort(porNome),
    produtos: Object.values(c.produtos || {}).sort(porNome),
  };
}

/** Acrescenta ao lote a mesma alteração no catálogo (uma operação, vários campos). */
export function registrarNoCatalogo(
  batch: WriteBatch,
  alteracoes: { colecao: ColecaoClassificacao; id: string; dados: Record<string, unknown> | null; parcial?: boolean }[]
): void {
  if (alteracoes.length === 0) return;
  const campos: unknown[] = [];
  for (const a of alteracoes) {
    if (a.dados === null) campos.push(new FieldPath(a.colecao, a.id), deleteField());
    else if (a.parcial) for (const [k, v] of Object.entries(a.dados)) campos.push(new FieldPath(a.colecao, a.id, k), v);
    else campos.push(new FieldPath(a.colecao, a.id), a.dados);
  }
  campos.push('atualizadoEm', new Date().toISOString());
  const [campo, valor, ...resto] = campos;
  batch.update(catalogoClassificacoesRef(), campo as FieldPath, valor, ...resto);
}

/**
 * Cria, altera ou exclui uma classificação. Com `comCatalogo`, o documento e
 * o catálogo mudam juntos (ou nenhum muda).
 */
export async function gravarClassificacao(
  colecao: ColecaoClassificacao,
  operacao: 'criar' | 'alterar' | 'excluir',
  id: string | null,
  dados: Record<string, unknown> | null,
  comCatalogo: boolean
): Promise<string> {
  const docId = id || uuidv4();
  const ref = doc(db, colecao, docId);
  const batch = writeBatch(db);
  if (operacao === 'criar') {
    const completo = { ...dados, id: docId };
    batch.set(ref, completo);
    if (comCatalogo) registrarNoCatalogo(batch, [{ colecao, id: docId, dados: completo }]);
  } else if (operacao === 'alterar') {
    batch.update(ref, dados || {});
    if (comCatalogo && dados && Object.keys(dados).length) registrarNoCatalogo(batch, [{ colecao, id: docId, dados, parcial: true }]);
  } else {
    batch.delete(ref);
    if (comCatalogo) registrarNoCatalogo(batch, [{ colecao, id: docId, dados: null }]);
  }
  await batch.commit();
  return docId;
}
