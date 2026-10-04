import * as XLSX from 'xlsx';
import { Dispositivo, chaveCodigoDispositivo } from '../../domain/entities/dispositivo';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';

/**
 * Célula lida: o texto exibido (usado para Código, Dispositivo e demais textos)
 * ou, para células numéricas, também o valor bruto (usado no Peso, para que um
 * formato "0.00" não arredonde o peso gravado).
 */
export type CelulaPlanilha = string | { texto: string; numero: number };

/** Uma aba da planilha: cabeçalho + linhas de dados. */
export interface AbaPlanilha {
  nome: string;
  cabecalhos: string[];
  linhas: CelulaPlanilha[][];
}

export const textoCelula = (c: CelulaPlanilha | undefined): string =>
  c === undefined || c === null ? '' : typeof c === 'string' ? c : c.texto;

export interface ResumoAba {
  nome: string;
  linhas: number;
  colunaCodigo: string | null;
  colunaDispositivo: string | null;
  /** Aba ignorada por não ter nenhuma das colunas-chave (Código / Dispositivo). */
  ignorada: boolean;
}

export interface ResumoImportacao {
  /** Linhas de dados lidas nas abas importáveis (linhas totalmente vazias não contam). */
  linhasLidas: number;
  /** Combinações Código + Dispositivo distintas = registros que serão gravados. */
  combinacoesUnicas: number;
  /** Linhas descartadas por repetirem uma combinação já vista. */
  duplicadasRemovidas: number;
  /** Linhas sem Código e sem Dispositivo (não identificáveis). */
  linhasSemChave: number;
  linhasSemCodigo: number;
  linhasSemDispositivo: number;
  abas: ResumoAba[];
  avisos: string[];
}

export interface ResultadoProcessamento {
  dispositivos: Partial<Dispositivo>[];
  novasCategorias: string[];
  novasFamilias: string[];
  novosProdutos: string[];
  resumo: ResumoImportacao;
}

export interface ContextoProcessamento {
  categorias: Pick<Categoria, 'id' | 'nome'>[];
  familias: Pick<Familia, 'id' | 'nome'>[];
  produtos: Pick<Produto, 'id' | 'nome'>[];
  defaultCategoriaId?: string;
}

// ---------------------------------------------------------------------------
// Leitura do arquivo
// ---------------------------------------------------------------------------

/**
 * Decodifica um CSV: UTF-8 (com ou sem BOM) e, se os bytes não forem UTF-8
 * válido, Windows-1252 (padrão do Excel pt-BR em "CSV separado por vírgulas").
 */
export function decodificarTexto(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function numeroParaTexto(v: number): string {
  // String(n) só usa notação científica acima de 1e21 — preserva códigos longos.
  return String(v);
}

/**
 * Texto de uma célula como o usuário o vê, sem perder informação:
 * - número com formato explícito ("00000", "0.00", data) → texto formatado
 *   (preserva zeros à esquerda e casas decimais exibidos);
 * - número em formato Geral → valor completo (o texto formatado do Geral
 *   abrevia códigos longos para "5.04001E+13", o que colidiria códigos);
 * - texto → como está.
 */
export function textoDaCelula(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return '';
  if (cell.t === 'n') {
    const formato = typeof cell.z === 'string' ? cell.z : 'General';
    if (formato === 'General' || formato === '@' || cell.w === undefined) {
      return numeroParaTexto(cell.v as number);
    }
    return cell.w;
  }
  if (cell.t === 'e') return cell.w ?? '';
  if (cell.t === 'd') return cell.w ?? (cell.v as Date).toISOString();
  if (cell.t === 'b') return cell.w ?? String(cell.v);
  return String(cell.v);
}

/**
 * Intervalo real ocupado pela aba, calculado a partir das células existentes.
 * Não confia apenas em `!ref` (tag <dimension> do arquivo), que pode estar
 * desatualizada e cortaria linhas silenciosamente.
 */
function intervaloReal(sheet: XLSX.WorkSheet): XLSX.Range | null {
  let range: XLSX.Range | null = null;
  for (const endereco of Object.keys(sheet)) {
    if (endereco[0] === '!') continue;
    const c = XLSX.utils.decode_cell(endereco);
    if (!range) {
      range = { s: { r: c.r, c: c.c }, e: { r: c.r, c: c.c } };
    } else {
      if (c.r < range.s.r) range.s.r = c.r;
      if (c.c < range.s.c) range.s.c = c.c;
      if (c.r > range.e.r) range.e.r = c.r;
      if (c.c > range.e.c) range.e.c = c.c;
    }
  }
  return range;
}

function ehCsv(nomeArquivo: string): boolean {
  return /\.(csv|txt)$/i.test(nomeArquivo);
}

/**
 * Lê .xlsx/.xls/.csv e devolve cada aba como texto. CSV é decodificado
 * explicitamente (UTF-8/Windows-1252) e lido com `raw: true`, para que
 * "0041" continue "0041" e o cabeçalho "Código" não vire "CÃ³digo".
 */
export function lerPlanilha(conteudo: ArrayBuffer | Uint8Array, nomeArquivo: string): AbaPlanilha[] {
  const bytes = conteudo instanceof Uint8Array ? conteudo : new Uint8Array(conteudo);
  const workbook = ehCsv(nomeArquivo)
    ? XLSX.read(decodificarTexto(bytes), { type: 'string', raw: true })
    : XLSX.read(bytes, { type: 'array', cellNF: true, cellDates: false });

  return workbook.SheetNames.map(nome => {
    const sheet = workbook.Sheets[nome];
    const range = intervaloReal(sheet);
    if (!range) return { nome, cabecalhos: [], linhas: [] };

    const lerLinha = (r: number): CelulaPlanilha[] => {
      const valores: CelulaPlanilha[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        const texto = textoDaCelula(cell);
        valores.push(cell && cell.t === 'n' ? { texto, numero: cell.v as number } : texto);
      }
      return valores;
    };

    const cabecalhos = lerLinha(range.s.r).map(textoCelula);
    const linhas: CelulaPlanilha[][] = [];
    for (let r = range.s.r + 1; r <= range.e.r; r++) linhas.push(lerLinha(r));
    return { nome, cabecalhos, linhas };
  });
}

// ---------------------------------------------------------------------------
// Processamento (regra Código + Dispositivo)
// ---------------------------------------------------------------------------

/** Normaliza um cabeçalho: sem acento, caixa, pontuação ou espaços extras. */
export function normalizarCabecalho(cabecalho: string): string {
  return String(cabecalho ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const COLUNAS = {
  codigo: ['codigo', 'codigo da peca', 'codigo peca'],
  nome: ['dispositivo', 'n dispositivo', 'nome'],
  peso: ['peso', 'peso kg', 'peso dispositivo kg'],
  familia: ['familia', 'familia do produto'],
  produto: ['produto'],
  // Usuário pediu para trocar Categoria por Tipo de Dispositivo
  categoria: ['categoria', 'tipo de dispositivo', 'tipo dispositivo', 'tipo'],
  descricao: ['descricao', 'descricao da peca'],
  palavrasChave: ['palavra chave', 'palavras chaves', 'palavras chave'],
} as const;

type CampoColuna = keyof typeof COLUNAS;

function mapearColunas(cabecalhos: string[]): Record<CampoColuna, number> {
  const normalizados = cabecalhos.map(normalizarCabecalho);
  const mapa = {} as Record<CampoColuna, number>;
  for (const campo of Object.keys(COLUNAS) as CampoColuna[]) {
    mapa[campo] = -1;
    for (const alias of COLUNAS[campo]) {
      const idx = normalizados.indexOf(alias);
      if (idx >= 0) { mapa[campo] = idx; break; }
    }
  }
  return mapa;
}

const limparTexto = (v: string | undefined) => (v ?? '').replace(/\s+/g, ' ').trim();
const chaveNome = (v: string) => v.toLowerCase().trim();

/**
 * Resolve um nome de classificação (categoria/família/produto) para o id
 * existente ou, se ainda não existir, para o próprio nome (que o repositório
 * cria e substitui pelo id). Busca O(1) e insensível a caixa/espaços.
 */
function criarResolvedor(existentes: Pick<Categoria, 'id' | 'nome'>[]) {
  const porNome = new Map<string, string>();
  for (const e of existentes) if (e.nome) porNome.set(chaveNome(e.nome), e.id);
  const novos = new Map<string, string>();
  return {
    resolver(nome: string): string {
      const k = chaveNome(nome);
      const existente = porNome.get(k);
      if (existente) return existente;
      if (!novos.has(k)) novos.set(k, nome);
      return novos.get(k)!;
    },
    novos: () => Array.from(novos.values()),
  };
}

/**
 * Converte as abas lidas em dispositivos, aplicando a regra de unicidade
 * Código + Dispositivo (`chaveCodigoDispositivo`). Linhas com a mesma
 * combinação geram um único registro (os demais campos vêm da última linha);
 * combinações diferentes nunca são fundidas. Tudo o que é descartado é
 * contabilizado em `resumo`.
 */
export function processarPlanilhaDispositivos(
  abas: AbaPlanilha[],
  ctx: ContextoProcessamento
): ResultadoProcessamento {
  const categorias = criarResolvedor(ctx.categorias);
  const familias = criarResolvedor(ctx.familias);
  const produtos = criarResolvedor(ctx.produtos);

  const porChave = new Map<string, Partial<Dispositivo>>();
  const resumo: ResumoImportacao = {
    linhasLidas: 0,
    combinacoesUnicas: 0,
    duplicadasRemovidas: 0,
    linhasSemChave: 0,
    linhasSemCodigo: 0,
    linhasSemDispositivo: 0,
    abas: [],
    avisos: [],
  };

  for (const aba of abas) {
    const col = mapearColunas(aba.cabecalhos);
    const resumoAba: ResumoAba = {
      nome: aba.nome,
      linhas: 0,
      colunaCodigo: col.codigo >= 0 ? aba.cabecalhos[col.codigo] : null,
      colunaDispositivo: col.nome >= 0 ? aba.cabecalhos[col.nome] : null,
      ignorada: col.codigo < 0 && col.nome < 0,
    };
    resumo.abas.push(resumoAba);
    if (resumoAba.ignorada) continue;

    if (col.codigo < 0) {
      resumo.avisos.push(`Aba "${aba.nome}": coluna Código não encontrada — os registros dessa aba ficarão sem Código.`);
    }
    if (col.nome < 0) {
      resumo.avisos.push(`Aba "${aba.nome}": coluna Dispositivo não encontrada — os registros dessa aba ficarão sem Dispositivo.`);
    }

    const valor = (linha: CelulaPlanilha[], idx: number) => (idx >= 0 ? limparTexto(textoCelula(linha[idx])) : '');

    for (const linha of aba.linhas) {
      if (linha.every(c => !textoCelula(c).trim())) continue; // linha totalmente vazia
      resumoAba.linhas++;
      resumo.linhasLidas++;

      const codigo = valor(linha, col.codigo);
      const nome = valor(linha, col.nome);
      if (!codigo && !nome) { resumo.linhasSemChave++; continue; }
      if (!codigo) resumo.linhasSemCodigo++;
      if (!nome) resumo.linhasSemDispositivo++;

      const celulaPeso = col.peso >= 0 ? linha[col.peso] : undefined;
      const rawPeso = valor(linha, col.peso);
      const pesoConvertido = celulaPeso && typeof celulaPeso !== 'string'
        ? celulaPeso.numero
        : rawPeso ? parseFloat(rawPeso.replace(',', '.')) : 0;
      const categoriaNome = valor(linha, col.categoria);
      const familiaNome = valor(linha, col.familia);
      const produtoNome = valor(linha, col.produto);
      const palavrasRaw = valor(linha, col.palavrasChave);

      const dispositivo: Partial<Dispositivo> = {
        familiaId: familiaNome ? familias.resolver(familiaNome) : '',
        produtoId: produtoNome ? produtos.resolver(produtoNome) : '',
        categoriaId: categoriaNome ? categorias.resolver(categoriaNome) : (ctx.defaultCategoriaId || ''),
        codigo,
        descricao: valor(linha, col.descricao),
        nome,
        peso: isNaN(pesoConvertido) ? '' : String(pesoConvertido),
        palavrasChave: palavrasRaw ? palavrasRaw.split(',').map(p => p.trim()).filter(Boolean) : [],
        imagemPeca: '',
        imagemDispositivo: '',
      };

      const chave = chaveCodigoDispositivo(codigo, nome);
      const anterior = porChave.get(chave);
      if (anterior) {
        resumo.duplicadasRemovidas++;
        // Mantém Código/Dispositivo da primeira ocorrência; demais campos da última.
        porChave.set(chave, { ...anterior, ...dispositivo, codigo: anterior.codigo, nome: anterior.nome });
      } else {
        porChave.set(chave, dispositivo);
      }
    }
  }

  const dispositivos = Array.from(porChave.values());
  resumo.combinacoesUnicas = dispositivos.length;
  if (resumo.linhasSemChave > 0) {
    resumo.avisos.push(`${resumo.linhasSemChave} linha(s) sem Código e sem Dispositivo foram ignoradas.`);
  }

  return {
    dispositivos,
    novasCategorias: categorias.novos(),
    novasFamilias: familias.novos(),
    novosProdutos: produtos.novos(),
    resumo,
  };
}
