import { CAMPOS_IMAGEM_DISPOSITIVO, Dispositivo } from '../entities/dispositivo';

/** Campos que a edição nunca grava (identidade, criação e chave derivada). */
const CAMPOS_IGNORADOS = new Set<string>(['id', 'dataCriacao', 'chaveCD']);

/** Ausente, nulo, texto vazio e lista vazia contam como "sem valor". */
function vazio(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Igualdade de valores simples do Firestore (texto, número, listas e objetos planos). */
function iguais(a: unknown, b: unknown): boolean {
  if (vazio(a) && vazio(b)) return true;
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => iguais(item, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ca = Object.keys(a as object).filter(k => (a as Record<string, unknown>)[k] !== undefined);
    const cb = Object.keys(b as object).filter(k => (b as Record<string, unknown>)[k] !== undefined);
    if (ca.length !== cb.length) return false;
    return ca.every(k => iguais((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/**
 * Só os campos de `editado` que diferem de `original`. A edição grava
 * apenas isso: gravar o documento inteiro carregado na abertura do
 * formulário apagaria alterações feitas por outra pessoa nesse meio tempo
 * (ex.: uma imagem propagada) e repropagaria imagens em qualquer edição.
 */
export function camposAlterados(original: Partial<Dispositivo> | null | undefined, editado: Partial<Dispositivo>): Partial<Dispositivo> {
  const base = (original || {}) as Record<string, unknown>;
  const resultado: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(editado)) {
    if (CAMPOS_IGNORADOS.has(campo) || valor === undefined) continue;
    if (!iguais(base[campo], valor)) resultado[campo] = valor;
  }
  return resultado as Partial<Dispositivo>;
}

/** A alteração mexe em alguma imagem (a única coisa que a propagação por número de peça copia)? */
export function alteraImagem(alteracoes: Partial<Dispositivo>): boolean {
  return CAMPOS_IMAGEM_DISPOSITIVO.some(c => c in alteracoes);
}
