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

