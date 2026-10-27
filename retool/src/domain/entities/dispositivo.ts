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
  /**
   * Chave Código + Dispositivo normalizada (`chaveCodigoDispositivo`),
   * gravada pelo app em toda criação/alteração. Permite à importação
   * consultar só as combinações do arquivo (`where chaveCD in`).
   */
  chaveCD?: string;
}

export type CampoImagemDispositivo = 'imagemPeca' | 'imagemDispositivo';

export const CAMPOS_IMAGEM_DISPOSITIVO: CampoImagemDispositivo[] = ['imagemPeca', 'imagemDispositivo'];

/**
 * Só a imagem do dispositivo é compartilhada pela linha (mesmo Nº
 * dispositivo). A imagem da peça é alimentada manualmente, um a um.
 */
export const CAMPOS_IMAGEM_PROPAGADOS: CampoImagemDispositivo[] = ['imagemDispositivo'];

/**
 * Normaliza o Nº dispositivo (campo `nome`) usado como chave da linha de
 * imagens. É o mesmo critério do Dispositivo na chave Código + Dispositivo
 * (`normalizarValorChave`): "MAT04670", " mat04670 " e "MAT04670" com
 * caractere invisível de planilha são a mesma linha.
 */
export function normalizarNumeroDispositivo(nome?: string): string {
  return normalizarValorChave(nome);
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
 * critério do "Remover Duplicatas" do Excel (e da linha de imagens, `normalizarNumeroDispositivo()`).
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
  /** 'propagacao' = upload da origem chegou a outro dispositivo da linha; 'heranca' = registro novo herdou imagem já existente na linha. */
  origem: 'propagacao' | 'heranca';
  /**
   * Por campo, o valor que o alvo pode ter (além de vazio) e ainda assim
   * receber o patch: a imagem anterior da origem, que o alvo seguia. A
   * gravação confere de novo, em transação (`patchAindaAplicavel`).
   */
  substitui?: Partial<Record<CampoImagemDispositivo, string>>;
}

/**
 * Imagem que representa a linha num campo: a mais usada entre os
 * dispositivos informados (empate: a do dispositivo de menor id, para o
 * resultado não depender da ordem da consulta).
 */
export function imagemDaLinha(dispositivos: Partial<Dispositivo>[], campo: CampoImagemDispositivo): string | undefined {
  const usos = new Map<string, { n: number; primeiroId: string }>();
  for (const d of dispositivos) {
    const url = d[campo];
    if (!url) continue;
    const id = d.id || '';
    const u = usos.get(url);
    if (u) {
      u.n++;
      if (id < u.primeiroId) u.primeiroId = id;
    } else {
      usos.set(url, { n: 1, primeiroId: id });
    }
  }
  let melhor: { url: string; n: number; primeiroId: string } | undefined;
  for (const [url, u] of usos) {
    if (!melhor || u.n > melhor.n || (u.n === melhor.n && u.primeiroId < melhor.primeiroId)) melhor = { url, ...u };
  }
  return melhor?.url;
}

/**
 * Propagação automática da imagem do dispositivo por Nº dispositivo (`nome`).
 * A imagem da peça não é propagada (`CAMPOS_IMAGEM_PROPAGADOS`).
 *
 * - Gatilho: imagem nova gravada na origem (`payload` com o campo preenchido).
 *   A edição passa só os campos que mudaram (`camposAlterados`), então salvar
 *   outros campos de um dispositivo com imagem não repropaga nada.
 * - A imagem chega aos demais dispositivos da mesma linha que estão VAZIOS
 *   naquele campo ou que ainda usam a imagem anterior da origem (`anteriores`:
 *   seguiam a imagem da linha e acompanham a troca). Uma imagem diferente,
 *   escolhida para aquele dispositivo, nunca é sobrescrita; outra linha
 *   nunca é tocada.
 * - Na criação (`isNew`), campos vazios da origem herdam a imagem da linha
 *   (`imagemDaLinha`), mantendo a linha visualmente íntegra.
 * - Limpeza intencional (payload vazio em edição) não dispara nada.
 *
 * Um patch por dispositivo (os dois campos juntos), para uma única gravação.
 */
export function calcularPropagacaoImagens(
  linha: Dispositivo[],
  origemId: string,
  numeroOrigem: string | undefined,
  payload: Partial<Dispositivo>,
  isNew: boolean,
  anteriores: Partial<Dispositivo> = {}
): PatchPropagacaoImagem[] {
  // Sem Nº dispositivo não existe linha a propagar; isola apenas os
  // dispositivos cuja chave é idêntica à da origem (nunca cruza linhas).
  const chave = normalizarNumeroDispositivo(numeroOrigem);
  if (!chave) return [];
  const outros = linha.filter(d => d.id !== origemId && normalizarNumeroDispositivo(d.nome) === chave);

  const porAlvo = new Map<string, PatchPropagacaoImagem>();
  const incluir = (
    id: string,
    campo: CampoImagemDispositivo,
    url: string,
    origem: PatchPropagacaoImagem['origem'],
    substitui?: string
  ) => {
    const p = porAlvo.get(id) ?? { id, patch: {}, origem };
    p.patch[campo] = url;
    if (substitui) p.substitui = { ...p.substitui, [campo]: substitui };
    porAlvo.set(id, p);
  };

  for (const campo of CAMPOS_IMAGEM_PROPAGADOS) {
    const novaImagem = payload[campo];

    if (novaImagem) {
      const antiga = anteriores[campo] && anteriores[campo] !== novaImagem ? anteriores[campo] : undefined;
      for (const alvo of outros) {
        const atual = alvo[campo];
        if (!atual) incluir(alvo.id, campo, novaImagem, 'propagacao');
        else if (antiga && atual === antiga) incluir(alvo.id, campo, novaImagem, 'propagacao', antiga);
      }
    } else if (isNew) {
      const daLinha = imagemDaLinha(outros, campo);
      if (daLinha) incluir(origemId, campo, daLinha, 'heranca');
    }
  }

  return Array.from(porAlvo.values());
}

/**
 * Confere um patch contra o documento lido na hora de gravar (dentro da
 * transação): só ficam os campos que continuam vazios ou com a imagem que o
 * patch substitui, e só se o dispositivo ainda pertence à linha. Protege
 * contra alterações feitas por outra pessoa entre a leitura da linha e a
 * gravação. `null` = nada a gravar.
 */
export function patchAindaAplicavel(
  atual: Partial<Dispositivo> | null,
  p: PatchPropagacaoImagem,
  numeroNormalizado: string
): Partial<Dispositivo> | null {
  if (!atual || normalizarNumeroDispositivo(atual.nome) !== numeroNormalizado) return null;
  const aplicavel: Partial<Dispositivo> = {};
  for (const campo of CAMPOS_IMAGEM_PROPAGADOS) {
    const nova = p.patch[campo];
    if (!nova) continue;
    const valor = atual[campo];
    if (valor === nova) continue;
    if (!valor || (p.substitui?.[campo] && valor === p.substitui[campo])) aplicavel[campo] = nova;
  }
  return Object.keys(aplicavel).length ? aplicavel : null;
}

/**
 * Importação: dispositivos NOVOS sem imagem herdam a imagem da sua linha
 * (mesmo critério do cadastro manual), a partir das `fontes` já conhecidas
 * (documentos do banco). Altera `novos` no lugar e devolve quantos
 * receberam alguma imagem. Dispositivos existentes nunca são tocados.
 */
export function herdarImagensDaLinha(novos: Partial<Dispositivo>[], fontes: Iterable<Partial<Dispositivo>>): number {
  const porLinha = new Map<string, Partial<Dispositivo>[]>();
  for (const f of fontes) {
    if (!CAMPOS_IMAGEM_PROPAGADOS.some(c => f[c])) continue;
    const chave = normalizarNumeroDispositivo(f.nome);
    if (!chave) continue;
    const lista = porLinha.get(chave);
    if (lista) lista.push(f); else porLinha.set(chave, [f]);
  }
  let herdaram = 0;
  for (const novo of novos) {
    const linha = porLinha.get(normalizarNumeroDispositivo(novo.nome));
    if (!linha) continue;
    let mudou = false;
    for (const campo of CAMPOS_IMAGEM_PROPAGADOS) {
      if (novo[campo]) continue;
      const url = imagemDaLinha(linha, campo);
      if (url) {
        novo[campo] = url;
        mudou = true;
      }
    }
    if (mudou) herdaram++;
  }
  return herdaram;
}

/** Arquivo de imagem de dispositivo no Storage (`.../imagem_peca/...` ou `.../imagem_dispositivo/...`). */
export function ehCaminhoDeImagem(caminhoStorage: string): boolean {
  return /\/(imagem_peca|imagem_dispositivo)\//.test(caminhoStorage);
}

/**
 * Link de download sem o token: o token de um arquivo pode ser trocado
 * (ex.: revogado no Console) sem mudar o caminho. Comparar por este prefixo
 * acha quem ainda usa o arquivo.
 */
export function urlSemToken(url: string): string {
  const i = url.indexOf('?');
  return i < 0 ? url : url.slice(0, i);
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
