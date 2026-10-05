import { Dispositivo, CAMPOS_IMAGEM_DISPOSITIVO, chaveCodigoDispositivo } from '../../domain/entities/dispositivo';

/**
 * Planejamento da gravação de uma importação (sem Firestore — testável e
 * reaproveitado pela prévia do modal).
 *
 * Economia de cota: um documento existente cujos campos importados não
 * mudaram NÃO é gravado (`ignoradosSemAlteracao`). Numa reimportação da
 * mesma planilha isso leva as escritas de ~19,6 mil para ~0.
 */

/**
 * Operações por `writeBatch`. O Firestore limita um lote a 500 operações e
 * cobra por documento gravado (não por lote), então o tamanho do lote não
 * muda o consumo de cota: 500 = menos ida-e-volta (40 commits para 19.621
 * registros). Um documento importado tem < 2 KB, logo 500 × 2 KB ≈ 1 MB,
 * bem abaixo do limite de 10 MiB por requisição. O cancelamento é verificado
 * entre lotes; se a cota acabar, o lote recusado não é gravado (é atômico) e
 * entra em "não gravados".
 */
export const TAMANHO_LOTE_DISPOSITIVOS = 500;

/** Documentos por página na leitura dos existentes (orderBy(documentId()) + limit + startAfter). */
export const TAMANHO_PAGINA_LEITURA = 1000;

/** Campos que a importação compara para decidir se um documento existente mudou. */
const CAMPOS_IGNORADOS_NA_COMPARACAO = new Set(['id', 'dataCriacao']);

/** Valor normalizado para comparação: vazio, null, undefined e [] são equivalentes. */
function comparavel(valor: unknown): string {
  if (valor === undefined || valor === null) return '';
  if (Array.isArray(valor)) return valor.length === 0 ? '' : JSON.stringify(valor.map(v => String(v ?? '')));
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

/**
 * Dados que a importação grava num documento. Para um existente, imagens
 * vazias da planilha são retiradas (não podem apagar imagens já cadastradas);
 * para um novo, recebe `id` e `dataCriacao`.
 */
export function dadosParaGravar(
  disp: Partial<Dispositivo>,
  existente: boolean,
  id: string,
  agora: string
): Partial<Dispositivo> {
  if (existente) {
    const dados: Partial<Dispositivo> = { ...disp };
    for (const campo of CAMPOS_IMAGEM_DISPOSITIVO) {
      if (!dados[campo]) delete dados[campo];
    }
    return dados;
  }
  return { ...disp, id, dataCriacao: agora };
}

/**
 * `true` se gravar `dados` com merge alteraria algum campo de `atual`
 * (comparando só os campos que a importação grava). Diferença só de
 * vazio × ausente não conta; diferença de caixa/espaço no Código ou no
 * Dispositivo conta (o texto gravado mudaria, embora a chave seja a mesma).
 */
export function alteraDocumento(dados: Partial<Dispositivo>, atual: Partial<Dispositivo>): boolean {
  for (const campo of Object.keys(dados) as (keyof Dispositivo)[]) {
    if (CAMPOS_IGNORADOS_NA_COMPARACAO.has(campo)) continue;
    if (comparavel(dados[campo]) !== comparavel(atual[campo])) return true;
  }
  return false;
}

export interface OperacaoGravacao {
  id: string;
  dados: Partial<Dispositivo>;
  /** Documento criado por esta importação. */
  novo: boolean;
  /** Quantos registros da lista caíram neste documento (combinação repetida na própria lista). */
  registros: number;
}

export interface PlanoGravacao {
  operacoes: OperacaoGravacao[];
  /** Registros que já estão iguais no banco (nenhuma escrita). */
  ignoradosSemAlteracao: number;
  /** Total de registros a gravar (soma de `registros` das operações). */
  registrosAGravar: number;
}

/**
 * Decide, para cada registro, se cria um documento, atualiza um existente
 * (mesma combinação Código + Dispositivo — `chaveCodigoDispositivo`) ou pula
 * por não haver alteração. Mesmo Código com outro Dispositivo (ou vice-versa)
 * gera documento novo. Combinação repetida na própria lista é fundida numa
 * única operação (uma escrita só).
 */
export function planejarGravacao(
  novos: Partial<Dispositivo>[],
  existentes: Iterable<Dispositivo>,
  gerarId: () => string,
  agora: string = new Date().toISOString()
): PlanoGravacao {
  const idPorChave = new Map<string, string>();
  const estado = new Map<string, Partial<Dispositivo>>();
  for (const d of existentes) {
    const chave = chaveCodigoDispositivo(d.codigo, d.nome);
    if (!idPorChave.has(chave)) idPorChave.set(chave, d.id);
    estado.set(d.id, d);
  }

  const operacoes = new Map<string, OperacaoGravacao>();
  let ignoradosSemAlteracao = 0;
  let registrosAGravar = 0;

  for (const disp of novos) {
    const chave = chaveCodigoDispositivo(disp.codigo, disp.nome);
    const existenteId = idPorChave.get(chave);
    const id = existenteId ?? gerarId();
    if (!existenteId) idPorChave.set(chave, id);

    const op = operacoes.get(id);
    const jaExistia = !!existenteId && !(op?.novo);
    const dados = dadosParaGravar(disp, !!existenteId, id, agora);
    const atual = estado.get(id);

    if (atual && !alteraDocumento(dados, atual)) {
      ignoradosSemAlteracao++;
      continue;
    }
    registrosAGravar++;
    if (op) {
      op.dados = { ...op.dados, ...dados, ...(op.novo ? { id: op.dados.id, dataCriacao: op.dados.dataCriacao } : {}) };
      op.registros++;
    } else {
      operacoes.set(id, { id, dados, novo: !jaExistia, registros: 1 });
    }
    estado.set(id, { ...atual, ...dados });
  }

  return { operacoes: Array.from(operacoes.values()), ignoradosSemAlteracao, registrosAGravar };
}

/** Divide em lotes de até `tamanho` itens. */
export function emLotes<T>(itens: T[], tamanho: number = TAMANHO_LOTE_DISPOSITIVOS): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

/** Erro de cota diária esgotada do Firestore (`resource-exhausted`). */
export function ehErroDeCota(erro: unknown): boolean {
  const e = erro as { code?: unknown; message?: unknown } | null;
  const codigo = typeof e?.code === 'string' ? e.code.toLowerCase() : '';
  if (codigo === 'resource-exhausted' || codigo === 'resource_exhausted' || codigo === '8') return true;
  const mensagem = typeof e?.message === 'string' ? e.message : String(erro ?? '');
  return /resource[-_ ]exhausted|quota exceeded/i.test(mensagem);
}

export interface EstimativaGravacao {
  novos: number;
  alterados: number;
  semAlteracao: number;
}

/**
 * Estimativa para a prévia do modal, com os dispositivos já carregados na
 * tela: quantos registros serão criados, atualizados e ignorados por já
 * estarem iguais. A gravação refaz a conta com a leitura do banco.
 */
export function estimarGravacao(novos: Partial<Dispositivo>[], existentes: Dispositivo[]): EstimativaGravacao {
  let seq = 0;
  const plano = planejarGravacao(novos, existentes, () => `__estimativa-${seq++}`, '');
  let novosDocs = 0;
  let alterados = 0;
  for (const op of plano.operacoes) {
    if (op.novo) novosDocs += op.registros; else alterados += op.registros;
  }
  return { novos: novosDocs, alterados, semAlteracao: plano.ignoradosSemAlteracao };
}
