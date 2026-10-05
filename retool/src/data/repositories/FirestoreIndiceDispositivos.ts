import { db } from '../datasources/firebase';
import {
  doc, getDoc, getDocFromServer, onSnapshot, writeBatch, WriteBatch, FieldPath, increment, deleteField
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Dispositivo } from '../../domain/entities/dispositivo';
import { parteDoId, partesParaTotal, serializarEntrada } from '../../domain/services/buscaDispositivos';
import { medirConsulta } from '../observabilidade/metricas';

/**
 * Catálogo de busca de dispositivos persistido no Firestore.
 *
 *   indices/dispositivos                 → meta { partes, versoes{n: v}, total, geracao, atualizadoEm }
 *   indices/dispositivos/partes/{n}      → { itens: { [idDispositivo]: entradaSerializada } }
 *
 * Abrir o app lê 1 documento (meta) e só as partes que mudaram desde a última
 * visita (o resto vem do cache local). Toda escrita de dispositivo feita pelo
 * app atualiza a parte correspondente NO MESMO writeBatch do documento, então
 * dispositivo e catálogo mudam juntos ou não mudam.
 */

export interface MetaIndice {
  partes: number;
  versoes: Record<string, number>;
  total: number;
  geracao: string;
  atualizadoEm: string;
}

export const metaRef = () => doc(db, 'indices', 'dispositivos');
export const parteRef = (n: number) => doc(db, 'indices', 'dispositivos', 'partes', String(n));

export function lerMetaIndiceDoServidor(): Promise<MetaIndice | null> {
  return medirConsulta('indice:meta', () => getDocFromServer(metaRef()), () => 1)
    .then(s => (s.exists() ? (s.data() as MetaIndice) : null));
}

export function assinarMetaIndice(cb: (m: MetaIndice | null) => void, erro: (e: unknown) => void): () => void {
  return onSnapshot(metaRef(), s => cb(s.exists() ? (s.data() as MetaIndice) : null), erro);
}

export async function lerParteIndice(n: number): Promise<Record<string, string>> {
  const s = await medirConsulta(`indice:parte`, () => getDoc(parteRef(n)), () => 1);
  return ((s.exists() ? s.data().itens : null) || {}) as Record<string, string>;
}

/**
 * Acrescenta ao `batch` a atualização do catálogo para um dispositivo
 * criado/alterado (`dados` completos) ou removido (`dados` = null).
 * Sem meta (índice ainda não criado) não faz nada: o índice será criado
 * depois a partir do banco.
 */
/** Quantas operações `registrarNoIndice` acrescenta a um lote (para respeitar o limite de 500). */
export function operacoesNoIndice(meta: MetaIndice | null, ids: string[]): number {
  if (!meta || ids.length === 0) return 0;
  return new Set(ids.map(id => parteDoId(id, meta.partes))).size + 1;
}

export function registrarNoIndice(
  batch: WriteBatch,
  meta: MetaIndice | null,
  alteracoes: { id: string; dados: Partial<Dispositivo> | null; novo?: boolean }[]
): void {
  if (!meta || alteracoes.length === 0) return;
  // Uma única operação por parte (vários campos no mesmo update): 150
  // dispositivos numa ação em massa custam ~1 escrita por parte tocada, não 150.
  const porParte = new Map<number, unknown[]>();
  const qtdPorParte = new Map<number, number>();
  let deltaTotal = 0;
  for (const a of alteracoes) {
    const n = parteDoId(a.id, meta.partes);
    const campos = porParte.get(n) || [];
    campos.push(new FieldPath('itens', a.id), a.dados ? serializarEntrada(a.dados) : deleteField());
    porParte.set(n, campos);
    qtdPorParte.set(n, (qtdPorParte.get(n) || 0) + 1);
    if (a.dados === null) deltaTotal--;
    else if (a.novo) deltaTotal++;
  }
  for (const [n, campos] of porParte) {
    const [campo, valor, ...resto] = campos;
    batch.update(parteRef(n), campo as FieldPath, valor, ...resto);
  }
  const campos: unknown[] = [];
  for (const [n, qtd] of qtdPorParte) campos.push(new FieldPath('versoes', String(n)), increment(qtd));
  if (deltaTotal !== 0) campos.push('total', increment(deltaTotal));
  campos.push('atualizadoEm', new Date().toISOString());
  const [primeiro, valor, ...resto] = campos;
  batch.update(metaRef(), primeiro as FieldPath, valor, ...resto);
}

/**
 * Reconstrói o catálogo inteiro a partir de uma lista completa de
 * dispositivos (já lida por uma varredura ou ao fim de uma importação).
 * Custo: (partes + 1) escritas. Não lê nada.
 */
const BYTES_ALVO_POR_PARTE = 250_000;

export async function reconstruirIndice(dispositivos: Dispositivo[]): Promise<MetaIndice> {
  const serializados = dispositivos.map(d => serializarEntrada(d));
  // Partes pelo volume e pelo tamanho real: cada documento do Firestore tem
  // limite de 1 MiB, então o alvo é ~400 KB por parte (folga para crescer
  // entre reconstruções). Bytes estimados com folga para acentos em UTF-8.
  let bytes = 0;
  for (let i = 0; i < dispositivos.length; i++) bytes += dispositivos[i].id.length + serializados[i].length * 1.2 + 16;
  const partes = Math.max(partesParaTotal(dispositivos.length), Math.ceil(bytes / BYTES_ALVO_POR_PARTE));
  const itensPorParte: Record<string, string>[] = Array.from({ length: partes }, () => ({}));
  dispositivos.forEach((d, i) => { itensPorParte[parteDoId(d.id, partes)][d.id] = serializados[i]; });

  const versaoBase = Date.now();
  const meta: MetaIndice = {
    partes,
    versoes: Object.fromEntries(itensPorParte.map((_, n) => [String(n), versaoBase])),
    total: dispositivos.length,
    geracao: uuidv4(),
    atualizadoEm: new Date().toISOString(),
  };
  // Cada parte tem até ~1 MiB; 4 partes por commit ficam abaixo do limite de 10 MiB por requisição.
  for (let i = 0; i < partes; i += 4) {
    const b = writeBatch(db);
    for (let n = i; n < Math.min(partes, i + 4); n++) b.set(parteRef(n), { itens: itensPorParte[n] });
    await b.commit();
  }
  const b = writeBatch(db);
  b.set(metaRef(), meta);
  await b.commit();
  return meta;
}
