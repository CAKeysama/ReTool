import { Dispositivo } from '../entities/dispositivo';

/**
 * Índice de busca de dispositivos (catálogo compacto).
 *
 * O Firestore não faz busca por trecho de texto ("contém"), e a busca do
 * ReTool sempre foi por trecho em vários campos (nome, código, descrição,
 * família, produto, categoria, palavras-chave), sem acento e sem caixa.
 * Para manter exatamente esse comportamento sem baixar a coleção inteira
 * de dispositivos, o app mantém um catálogo compacto (só os campos usados
 * na busca e na listagem) dividido em poucas "partes" no Firestore.
 *
 * Este módulo é puro (sem Firebase): serializa as entradas do catálogo e
 * executa a busca sobre elas. Ver PERFORMANCE.md.
 */

/** Campos de um dispositivo guardados no catálogo, na ordem serializada. */
export interface EntradaIndice {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  categoriaId: string;
  familiaId: string;
  produtoId: string;
  peso: string;
  palavrasChave: string[];
  ativo: boolean;
}

const SEP = '\u001f';
/**
 * Limite por campo no catálogo: protege o limite de 1 MiB por documento do
 * Firestore contra um texto muito longo colado na descrição. A busca por
 * trecho só deixa de ver o que passar de 2.000 caracteres num campo.
 */
export const MAX_CAMPO = 2000;
const SEP_TAG = '\u001e';

/** Serializa os campos de busca de um dispositivo numa única string compacta. */
export function serializarEntrada(d: Partial<Dispositivo>): string {
  return [
    d.codigo ?? '',
    d.nome ?? '',
    d.descricao ?? '',
    d.categoriaId ?? '',
    d.familiaId ?? '',
    d.produtoId ?? '',
    d.peso ?? '',
    (d.palavrasChave ?? []).join(SEP_TAG),
    d.ativo === false ? '0' : '1',
  ].map(v => String(v).split(SEP).join(' ').slice(0, MAX_CAMPO)).join(SEP);
}

export function desserializarEntrada(id: string, valor: string): EntradaIndice {
  const p = valor.split(SEP);
  return {
    id,
    codigo: p[0] ?? '',
    nome: p[1] ?? '',
    descricao: p[2] ?? '',
    categoriaId: p[3] ?? '',
    familiaId: p[4] ?? '',
    produtoId: p[5] ?? '',
    peso: p[6] ?? '',
    palavrasChave: p[7] ? p[7].split(SEP_TAG) : [],
    ativo: p[8] !== '0',
  };
}

/**
 * Normalização usada pela busca desde a primeira versão do ReTool
 * (Home e lista de dispositivos): sem acento, minúsculas, vírgula vira
 * ponto e "avula" vira "avola".
 */
export function normalizarBusca(str: string | undefined | null): string {
  if (!str) return '';
  let res = str.toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  res = res.replace(/,/g, '.');
  if (res.includes('avula')) res = res.replace(/avula/g, 'avola');
  return res;
}

/** Busca da partição/linha de imagens: mesmo critério de normalizarNumeroPeca(). */
export const normalizarCodigoLinha = (codigo?: string) => (codigo || '').trim().toLowerCase();

export interface NomesClassificacao {
  categorias: Map<string, string>;
  familias: Map<string, string>;
  produtos: Map<string, string>;
}

/** Entrada já preparada para busca (textos normalizados uma única vez). */
export interface EntradaPreparada {
  entrada: EntradaIndice;
  /** Texto pesquisável da busca geral (campos separados por um caractere que nunca aparece na consulta). */
  texto: string;
  /** Texto pesquisável do filtro de processo (descrição, nome e palavras-chave). */
  processo: string;
  /** Texto pesquisável do autocomplete da Home (inclui o peso). */
  textoHome: string;
}

const J = '\u0001';

export function prepararEntradas(entradas: EntradaIndice[], nomes: NomesClassificacao): EntradaPreparada[] {
  const out: EntradaPreparada[] = new Array(entradas.length);
  for (let i = 0; i < entradas.length; i++) {
    const e = entradas[i];
    const tags = e.palavrasChave.map(normalizarBusca);
    const nome = normalizarBusca(e.nome);
    const descricao = normalizarBusca(e.descricao);
    const base = [
      nome,
      normalizarBusca(e.codigo),
      descricao,
      normalizarBusca(nomes.familias.get(e.familiaId)),
      normalizarBusca(nomes.produtos.get(e.produtoId)),
      normalizarBusca(nomes.categorias.get(e.categoriaId)),
      ...tags,
    ].join(J);
    out[i] = {
      entrada: e,
      texto: base,
      processo: [descricao, nome, ...tags].join(J),
      textoHome: base + J + normalizarBusca(e.peso),
    };
  }
  return out;
}

export interface FiltroBusca {
  /** Texto livre (busca por trecho em todos os campos). */
  texto?: string;
  categoriaId?: string;
  /** Processo industrial (trecho em descrição, nome ou palavras-chave). */
  processo?: string;
  /** Autocomplete da Home: também procura no peso. */
  incluirPeso?: boolean;
}

/**
 * Filtra as entradas preparadas com o mesmo critério da busca original
 * (useDispositivosController / Home). Devolve na ordem do catálogo
 * (id do documento), a mesma ordem em que o Firestore lista a coleção.
 * `limite` interrompe a varredura assim que encontrar resultados suficientes.
 */
export function filtrarEntradas(
  preparadas: EntradaPreparada[],
  filtro: FiltroBusca,
  limite = Infinity
): EntradaIndice[] {
  // Espaços repetidos ("barra  porta") contam como um só.
  const q = normalizarBusca(filtro.texto).replace(/\s+/g, ' ').trim();
  const proc = normalizarBusca(filtro.processo).trim();
  const cat = filtro.categoriaId || '';
  const out: EntradaIndice[] = [];
  for (let i = 0; i < preparadas.length; i++) {
    const p = preparadas[i];
    if (cat && p.entrada.categoriaId !== cat) continue;
    if (q && (filtro.incluirPeso ? p.textoHome : p.texto).indexOf(q) < 0) continue;
    if (proc && p.processo.indexOf(proc) < 0) continue;
    out.push(p.entrada);
    if (out.length >= limite) break;
  }
  return out;
}

/** Shard (parte) do catálogo de um documento: hash estável do id. */
export function parteDoId(id: string, partes: number): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % partes;
}

/**
 * Quantidade de partes para um total de dispositivos (~750 por parte, mínimo 4).
 * Partes menores = menos dados baixados quando uma muda; cada uma fica em
 * ~150 KB, com folga de ~6x até o limite de 1 MiB por documento.
 */
export const ITENS_POR_PARTE = 750;
/** Estimativa conservadora do tamanho de um item numa parte (UTF-8 com acentos + overhead do campo). */
export const bytesDoItem = (id: string, valor: string) => id.length + valor.length * 1.2 + 16;
/**
 * Teto de partes aceito pelo app e pelas regras. 200 partes comportam ~150
 * mil dispositivos pela contagem (muito além do que o plano gratuito consegue
 * reconstruir) e limitam o estrago de uma meta adulterada a 200 leituras.
 */
export const MAX_PARTES = 200;
export function partesParaTotal(total: number): number {
  return Math.min(MAX_PARTES, Math.max(4, Math.ceil(total / ITENS_POR_PARTE)));
}
