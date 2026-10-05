import { FileAttachment } from './fileAttachment';

export interface Dispositivo {
  id: string;
  nome?: string;
  codigo?: string;
  categoriaId?: string;
  peso?: string;
  familiaId?: string;
  descricao?: string;
  observacoes?: string;
  produtoId?: string;
  palavrasChave?: string[];
  imagemPeca?: string;
  imagemDispositivo?: string;
  anexos?: FileAttachment[];
  dataCriacao?: string;
  ativo?: boolean;
}

export type CampoImagemDispositivo = 'imagemPeca' | 'imagemDispositivo';

export const CAMPOS_IMAGEM_DISPOSITIVO: CampoImagemDispositivo[] = ['imagemPeca', 'imagemDispositivo'];

/** Normaliza o Número da Peça usado como chave da linha (ignora caixa e espaços). */
export function normalizarNumeroPeca(codigo?: string): string {
  return (codigo || '').trim().toLowerCase();
}

// Caracteres invisíveis comuns em planilhas: zero-width (U+200B–U+200D),
// BOM/ZWNBSP (U+FEFF), soft hyphen (U+00AD), word joiner (U+2060) e controles C0/C1.
// eslint-disable-next-line no-control-regex
export const INVISIVEIS = /[​-‍﻿­⁠\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * Normaliza um valor de Código ou Dispositivo para compor a chave de unicidade.
 *
 * Equivalentes (mesma chave): espaços nas pontas, espaços repetidos/NBSP/tab,
 * caracteres invisíveis, forma Unicode (NFC) e maiúsculas/minúsculas — mesmo
 * critério de `normalizarNumeroPeca()` e do "Remover Duplicatas" do Excel.
 *
 * Distintos (chaves diferentes): zeros à esquerda ("0041" ≠ "41"), casas
 * decimais ("1.10" ≠ "1.1"), acentuação ("PEÇA" ≠ "PECA") e qualquer outro
 * caractere visível. O valor numérico 123 e o texto "123" geram a mesma chave.
 */
export function normalizarValorChave(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .normalize('NFC')
    .replace(INVISIVEIS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Identidade lógica de um dispositivo importado: Código + Dispositivo (`nome`).
 * Mesma combinação = um registro; mesmo Código com Dispositivo diferente =
 * registros distintos. Serializada como tupla JSON para que nenhum separador
 * possa colidir ("A|B"+"C" ≠ "A"+"B|C").
 */
export function chaveCodigoDispositivo(codigo: unknown, nome: unknown): string {
  return JSON.stringify([normalizarValorChave(codigo), normalizarValorChave(nome)]);
}

export interface PatchPropagacaoImagem {
  /** Dispositivo que deve receber a imagem. */
  id: string;
  patch: Partial<Dispositivo>;
  /** 'propagacao' = upload da origem preencheu célula vazia da linha; 'heranca' = registro novo herdou imagem já existente na linha. */
  origem: 'propagacao' | 'heranca';
}

/**
 * Propagação automática de imagens por Número da Peça (Part Number).
 *
 * - Gatilho: upload bem-sucedido salvo na origem (`payload` com imagem preenchida).
 * - A imagem preenche apenas células VAZIAS dos demais dispositivos da mesma
 *   linha (mesmo número de peça) — nunca sobrescreve imagens existentes e
 *   nunca toca dispositivos de outras linhas.
 * - Na criação (`isNew`), células vazias da origem herdam a imagem que já
 *   exista na linha, mantendo a linha visualmente íntegra.
 * - Limpeza intencional (payload vazio em edição) não dispara nada.
 */
export function calcularPropagacaoImagens(
  linha: Dispositivo[],
  origemId: string,
  codigoOrigem: string | undefined,
  payload: Partial<Dispositivo>,
  isNew: boolean
): PatchPropagacaoImagem[] {
  // Sem Número da Peça não existe linha a propagar; isola apenas os
  // dispositivos cuja chave é idêntica à da origem (nunca cruza linhas).
  const chave = normalizarNumeroPeca(codigoOrigem);
  if (!chave) return [];
  const mesmaLinha = linha.filter(d => normalizarNumeroPeca(d.codigo) === chave);

  const resultados: PatchPropagacaoImagem[] = [];

  for (const campo of CAMPOS_IMAGEM_DISPOSITIVO) {
    const novaImagem = payload[campo];

    if (novaImagem) {
      for (const alvo of mesmaLinha) {
        if (alvo.id === origemId || alvo[campo]) continue;
        const patch: Partial<Dispositivo> = {};
        patch[campo] = novaImagem;
        resultados.push({ id: alvo.id, patch, origem: 'propagacao' });
      }
    } else if (isNew) {
      const fonte = mesmaLinha.find(d => d.id !== origemId && !!d[campo]);
      if (fonte && fonte[campo]) {
        const patch: Partial<Dispositivo> = {};
        patch[campo] = fonte[campo];
        resultados.push({ id: origemId, patch, origem: 'heranca' });
      }
    }
  }

  return resultados;
}


export interface GrupoDuplicado {
  chave: string;
  codigo?: string;
  nome?: string;
  /** Documento mantido (o primeiro com vínculos; senão o mais antigo). */
  manter: Dispositivo;
  /** Repetidos sem nenhum vínculo: podem ser removidos com segurança. */
  remover: Dispositivo[];
  /** Repetidos com vínculos (reutilizações, imagens, anexos, observações): só revisão manual. */
  revisar: Dispositivo[];
}

export interface PlanoLimpezaDuplicados {
  grupos: GrupoDuplicado[];
  totalDocumentos: number;
  combinacoesDistintas: number;
  totalRemover: number;
  totalRevisar: number;
}

/**
 * Planeja a limpeza de documentos que repetem a mesma combinação
 * Código + Dispositivo (resíduo de importações antigas que casavam só pelo
 * Código). Não apaga nada: apenas diz o que é seguro remover. Um documento
 * com qualquer vínculo nunca entra em `remover`.
 */
export function planejarLimpezaDuplicados(
  dispositivos: Dispositivo[],
  idsComReutilizacao: Set<string>
): PlanoLimpezaDuplicados {
  const temVinculo = (d: Dispositivo) =>
    idsComReutilizacao.has(d.id) ||
    !!d.imagemPeca || !!d.imagemDispositivo ||
    (d.anexos?.length ?? 0) > 0 ||
    !!d.observacoes?.trim();

  const porChave = new Map<string, Dispositivo[]>();
  for (const d of dispositivos) {
    const chave = chaveCodigoDispositivo(d.codigo, d.nome);
    const lista = porChave.get(chave);
    if (lista) lista.push(d); else porChave.set(chave, [d]);
  }

  const grupos: GrupoDuplicado[] = [];
  for (const [chave, lista] of porChave) {
    if (lista.length < 2) continue;
    const ordenada = [...lista].sort((a, b) =>
      (a.dataCriacao || '').localeCompare(b.dataCriacao || '') || a.id.localeCompare(b.id)
    );
    const manter = ordenada.find(temVinculo) ?? ordenada[0];
    const outros = ordenada.filter(d => d !== manter);
    grupos.push({
      chave,
      codigo: manter.codigo,
      nome: manter.nome,
      manter,
      remover: outros.filter(d => !temVinculo(d)),
      revisar: outros.filter(temVinculo),
    });
  }

  return {
    grupos,
    totalDocumentos: dispositivos.length,
    combinacoesDistintas: porChave.size,
    totalRemover: grupos.reduce((n, g) => n + g.remover.length, 0),
    totalRevisar: grupos.reduce((n, g) => n + g.revisar.length, 0),
  };
}
