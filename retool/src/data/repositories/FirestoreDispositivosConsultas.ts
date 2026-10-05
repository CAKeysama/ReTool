import { db } from '../datasources/firebase';
import {
  collection, doc, query, where, orderBy, limit, startAfter, documentId,
  getDocs, getDoc, onSnapshot, getCountFromServer,
  QueryDocumentSnapshot, DocumentData, QueryConstraint
} from 'firebase/firestore';
import { Dispositivo } from '../../domain/entities/dispositivo';
import { medirConsulta, registrarConsulta } from '../observabilidade/metricas';

/**
 * Consultas de leitura de dispositivos, sempre limitadas.
 *
 * Regra: nenhuma tela lê a coleção inteira. Listas usam paginação por
 * cursor (startAfter) ordenada pelo id do documento, que é a mesma ordem em
 * que a coleção era listada antes; contagens usam count() (1 leitura por
 * 1.000 documentos); detalhes leem 1 documento.
 */

export const TAMANHO_PAGINA_MAX = 100;
/** Limite do operador `in` do Firestore. */
const MAX_IN = 30;

export type CursorDispositivo = QueryDocumentSnapshot<DocumentData>;

export interface PaginaDispositivos {
  itens: Dispositivo[];
  /** Cursor para a próxima página (último documento lido). */
  cursor: CursorDispositivo | null;
  temMais: boolean;
}

const col = () => collection(db, 'dispositivos');
const paraDispositivo = (d: { id: string; data: () => DocumentData }) => ({ id: d.id, ...d.data() } as Dispositivo);

function filtros(categoriaId?: string): QueryConstraint[] {
  return categoriaId ? [where('categoriaId', '==', categoriaId)] : [];
}

/** Uma página de dispositivos (filtro de categoria no servidor). Lê `tamanho + 1` documentos no máximo. */
export async function listarPaginaDispositivos(opts: {
  tamanho: number;
  categoriaId?: string;
  depoisDe?: CursorDispositivo | null;
}): Promise<PaginaDispositivos> {
  const tamanho = Math.min(Math.max(1, opts.tamanho), TAMANHO_PAGINA_MAX);
  const q = query(
    col(),
    ...filtros(opts.categoriaId),
    orderBy(documentId()),
    ...(opts.depoisDe ? [startAfter(opts.depoisDe)] : []),
    limit(tamanho + 1)
  );
  const snap = await medirConsulta('dispositivos:pagina', () => getDocs(q), s => s.size);
  const docs = snap.docs.slice(0, tamanho);
  return {
    itens: docs.map(paraDispositivo),
    cursor: docs.length ? docs[docs.length - 1] : null,
    temMais: snap.size > tamanho,
  };
}

/** Total de dispositivos (agregação no servidor; não baixa documentos). */
export async function contarDispositivos(categoriaId?: string): Promise<number> {
  const q = query(col(), ...filtros(categoriaId));
  const snap = await medirConsulta('dispositivos:count', () => getCountFromServer(q), () => 0);
  return snap.data().count;
}

export async function obterDispositivo(id: string): Promise<Dispositivo | null> {
  const snap = await medirConsulta('dispositivos:get', () => getDoc(doc(db, 'dispositivos', id)), () => 1);
  return snap.exists() ? paraDispositivo(snap) : null;
}

/** Acompanha um único dispositivo em tempo real (tela de detalhes). */
export function assinarDispositivo(
  id: string,
  cb: (d: Dispositivo | null) => void,
  erro: (e: unknown) => void
): () => void {
  const t0 = performance.now();
  let primeira = true;
  return onSnapshot(doc(db, 'dispositivos', id), snap => {
    if (primeira) { registrarConsulta('dispositivos:assinar-um', 1, performance.now() - t0); primeira = false; }
    cb(snap.exists() ? paraDispositivo(snap) : null);
  }, e => { registrarConsulta('dispositivos:assinar-um', 0, performance.now() - t0, e); erro(e); });
}

/** Lê dispositivos por id em blocos de 30 (limite do `in`), 2 consultas por vez. Preserva a ordem pedida. */
export async function obterDispositivosPorIds(ids: string[]): Promise<Dispositivo[]> {
  const unicos = Array.from(new Set(ids.filter(Boolean)));
  if (unicos.length === 0) return [];
  const blocos: string[][] = [];
  for (let i = 0; i < unicos.length; i += MAX_IN) blocos.push(unicos.slice(i, i + MAX_IN));
  const porId = new Map<string, Dispositivo>();
  for (let i = 0; i < blocos.length; i += 2) {
    const snaps = await Promise.all(blocos.slice(i, i + 2).map(b =>
      medirConsulta('dispositivos:por-ids', () => getDocs(query(col(), where(documentId(), 'in', b))), s => s.size)
    ));
    for (const s of snaps) for (const d of s.docs) porId.set(d.id, paraDispositivo(d));
  }
  return ids.map(id => porId.get(id)).filter((d): d is Dispositivo => !!d);
}

/**
 * Dispositivos da mesma linha (mesmo Número da Peça) sem varrer a coleção:
 * igualdade no servidor com as variações de caixa/espaço do código.
 */
export async function obterDispositivosPorCodigo(codigo: string): Promise<Dispositivo[]> {
  const bruto = codigo || '';
  const variantes = Array.from(new Set([bruto, bruto.trim(), bruto.trim().toUpperCase(), bruto.trim().toLowerCase()]))
    .filter(v => v !== '');
  if (variantes.length === 0) return [];
  const snap = await medirConsulta(
    'dispositivos:por-codigo',
    () => getDocs(query(col(), where('codigo', 'in', variantes), limit(500))),
    s => s.size
  );
  return snap.docs.map(paraDispositivo);
}

export interface ProgressoVarredura { lidos: number; total: number | null }

/**
 * Varredura completa e explícita (ações administrativas: verificar
 * duplicados, reconstruir o índice de busca, apagar tudo). Lê em páginas de
 * 1.000 com progresso real e pode ser cancelada entre páginas.
 */
export async function varrerDispositivos(
  onProgresso?: (p: ProgressoVarredura) => void,
  sinal?: AbortSignal
): Promise<Dispositivo[]> {
  return varrerColecao<Dispositivo>('dispositivos', paraDispositivo, onProgresso, sinal);
}

export async function varrerColecao<T>(
  nome: string,
  converter: (d: QueryDocumentSnapshot<DocumentData>) => T,
  onProgresso?: (p: ProgressoVarredura) => void,
  sinal?: AbortSignal,
  pagina = 1000
): Promise<T[]> {
  const ref = collection(db, nome);
  let total: number | null = null;
  try {
    total = (await getCountFromServer(ref)).data().count;
  } catch {
    total = null;
  }
  const out: T[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  onProgresso?.({ lidos: 0, total });
  for (;;) {
    if (sinal?.aborted) throw new DOMException('Operação cancelada', 'AbortError');
    const q = query(ref, orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(pagina));
    const snap = await medirConsulta(`${nome}:varredura`, () => getDocs(q), s => s.size);
    for (const d of snap.docs) out.push(converter(d));
    onProgresso?.({ lidos: out.length, total });
    if (snap.size < pagina) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return out;
}
