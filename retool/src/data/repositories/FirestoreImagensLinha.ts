import { db } from '../datasources/firebase';
import {
  collection, doc, query, where, orderBy, startAfter, limit, documentId, getDocs, runTransaction,
  QueryConstraint, QueryDocumentSnapshot, DocumentData, Transaction
} from 'firebase/firestore';
import {
  Dispositivo, PatchPropagacaoImagem, normalizarNumeroDispositivo, patchAindaAplicavel
} from '../../domain/entities/dispositivo';
import { medirConsulta } from '../observabilidade/metricas';

/**
 * Leitura e gravação da "linha" de imagens (dispositivos com o mesmo Nº
 * dispositivo) para a propagação automática. Regra em domain/entities/dispositivo.ts.
 */

const PAGINA = 500;
/** Dispositivos por transação: cada um custa 1 leitura + até 2 escritas (documento e auditoria). */
export const ALVOS_POR_TRANSACAO = 100;

const col = () => collection(db, 'dispositivos');
const paraDispositivo = (d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() } as Dispositivo);

/** Todas as páginas de uma consulta (sem o limite silencioso de uma página só). */
async function lerTodas(filtros: QueryConstraint[], ordem: QueryConstraint, rotulo: string): Promise<Dispositivo[]> {
  const out: Dispositivo[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  for (;;) {
    const q = query(col(), ...filtros, ordem, ...(cursor ? [startAfter(cursor)] : []), limit(PAGINA));
    const snap = await medirConsulta(rotulo, () => getDocs(q), s => s.size);
    out.push(...snap.docs.map(paraDispositivo));
    if (snap.size < PAGINA) return out;
    cursor = snap.docs[snap.size - 1];
  }
}

/**
 * Todos os dispositivos da linha do Nº dispositivo (`nome`), lidos no
 * servidor pelas grafias exatas (original, sem espaços nas pontas,
 * MAIÚSCULA, minúscula). Grafias mistas ("Mat04670") são completadas pelo
 * catálogo de busca por quem chama. O resultado é filtrado pela mesma
 * normalização da regra de domínio.
 */
export async function obterLinhaPorNumero(nome: string | undefined): Promise<Dispositivo[]> {
  const chave = normalizarNumeroDispositivo(nome);
  if (!chave) return [];
  const bruto = nome || '';
  const grafias = Array.from(new Set([bruto, bruto.trim(), bruto.trim().toUpperCase(), bruto.trim().toLowerCase()]))
    .filter(v => v !== '');
  const resultados = await Promise.all(
    grafias.map(g => lerTodas([where('nome', '==', g)], orderBy(documentId()), 'dispositivos:linha-numero'))
  );
  const porId = new Map<string, Dispositivo>();
  for (const lista of resultados) for (const d of lista) porId.set(d.id, d);
  return Array.from(porId.values()).filter(d => normalizarNumeroDispositivo(d.nome) === chave);
}

/** Linhas de vários Nº dispositivo (importação), 3 consultas por vez; números repetidos são lidos uma vez. */
export async function obterLinhasPorNumeros(nomes: (string | undefined)[]): Promise<Dispositivo[]> {
  const porChave = new Map<string, string>();
  for (const n of nomes) {
    const chave = normalizarNumeroDispositivo(n);
    if (chave && !porChave.has(chave)) porChave.set(chave, n as string);
  }
  const unicos = Array.from(porChave.values());
  const out: Dispositivo[] = [];
  for (let i = 0; i < unicos.length; i += 3) {
    const lotes = await Promise.all(unicos.slice(i, i + 3).map(obterLinhaPorNumero));
    for (const l of lotes) out.push(...l);
  }
  return out;
}

export interface ResultadoAplicacaoImagens {
  /** Dispositivos que receberam a imagem. */
  aplicados: string[];
  /** Dispositivos pulados: mudaram entre a leitura da linha e a gravação (outra imagem, outra linha, excluídos). */
  ignorados: number;
}

/**
 * Grava os patches em transações de até `ALVOS_POR_TRANSACAO` dispositivos.
 * Cada dispositivo é relido dentro da transação e só recebe os campos que
 * continuam vazios (ou com a imagem que o patch substitui): uma imagem
 * gravada por outra pessoa no meio tempo nunca é sobrescrita. `auditar`
 * grava o registro de cada dispositivo na mesma transação.
 *
 * O catálogo de busca não guarda imagens: não precisa ser atualizado.
 */
export async function aplicarPatchesDeImagem(
  patches: PatchPropagacaoImagem[],
  numeroDaLinha: string | undefined,
  auditar: (tx: Transaction, p: PatchPropagacaoImagem, aplicado: Partial<Dispositivo>, atual: Dispositivo) => void
): Promise<ResultadoAplicacaoImagens> {
  const chave = normalizarNumeroDispositivo(numeroDaLinha);
  const total: ResultadoAplicacaoImagens = { aplicados: [], ignorados: 0 };
  if (!chave) return { aplicados: [], ignorados: patches.length };
  for (let i = 0; i < patches.length; i += ALVOS_POR_TRANSACAO) {
    const lote = patches.slice(i, i + ALVOS_POR_TRANSACAO);
    // A função da transação pode rodar de novo (conflito): o resultado vem do retorno.
    const r = await runTransaction(db, async tx => {
      const snaps = await Promise.all(lote.map(p => tx.get(doc(db, 'dispositivos', p.id))));
      const aplicados: string[] = [];
      let ignorados = 0;
      lote.forEach((p, j) => {
        const s = snaps[j];
        const atual = s.exists() ? ({ id: s.id, ...s.data() } as Dispositivo) : null;
        const aplicavel = patchAindaAplicavel(atual, p, chave);
        if (!aplicavel || !atual) { ignorados++; return; }
        tx.update(s.ref, aplicavel);
        auditar(tx, p, aplicavel, atual);
        aplicados.push(p.id);
      });
      return { aplicados, ignorados };
    });
    total.aplicados.push(...r.aplicados);
    total.ignorados += r.ignorados;
  }
  return total;
}
