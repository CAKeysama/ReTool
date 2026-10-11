/**
 * Senhas temporárias para contas criadas pela Administração.
 *
 * Usa `crypto.getRandomValues` (Web Crypto — CSPRNG do navegador/Node),
 * com amostragem por rejeição para não enviesar a escolha dos caracteres.
 * A senha nunca é persistida: o Firebase Auth armazena apenas o hash.
 */

// Sem caracteres ambíguos (0/O, 1/l/I) para facilitar o repasse ao colaborador.
const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const DIGITOS = '23456789';
const SIMBOLOS = '!@#$%*-_+?';
const TODOS = MAIUSCULAS + MINUSCULAS + DIGITOS + SIMBOLOS;

export const TAMANHO_SENHA_TEMPORARIA = 14;
export const TAMANHO_MINIMO_SENHA = 8;

/** Preenche o buffer com bytes aleatórios (injeção permite testes determinísticos). */
export type FonteAleatoria = (bytes: Uint32Array<ArrayBuffer>) => unknown;

function fontePadrao(): FonteAleatoria {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('Gerador seguro de números aleatórios indisponível neste ambiente.');
  }
  return (bytes) => c.getRandomValues(bytes);
}

/** Inteiro uniforme em [0, max) sem viés de módulo. */
function inteiroUniforme(max: number, fonte: FonteAleatoria): number {
  const limite = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    fonte(buf);
    if (buf[0] < limite) return buf[0] % max;
  }
}

function escolher(alfabeto: string, fonte: FonteAleatoria): string {
  return alfabeto[inteiroUniforme(alfabeto.length, fonte)];
}

export function gerarSenhaTemporaria(tamanho = TAMANHO_SENHA_TEMPORARIA, fonte: FonteAleatoria = fontePadrao()): string {
  if (tamanho < TAMANHO_MINIMO_SENHA) {
    throw new Error(`A senha temporária deve ter ao menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
  }
  // Garante ao menos um caractere de cada classe; o restante é uniforme.
  const chars = [
    escolher(MAIUSCULAS, fonte),
    escolher(MINUSCULAS, fonte),
    escolher(DIGITOS, fonte),
    escolher(SIMBOLOS, fonte),
  ];
  while (chars.length < tamanho) chars.push(escolher(TODOS, fonte));

  // Fisher–Yates para que as classes obrigatórias não fiquem no início.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = inteiroUniforme(i + 1, fonte);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Política da nova senha definida no primeiro acesso; retorna o erro ou null. */
export function validarNovaSenha(novaSenha: string, confirmacao: string, senhaAtual?: string): string | null {
  if (!novaSenha || novaSenha.length < TAMANHO_MINIMO_SENHA) {
    return `A nova senha deve ter no mínimo ${TAMANHO_MINIMO_SENHA} caracteres.`;
  }
  if (!/[A-Za-z]/.test(novaSenha) || !/\d/.test(novaSenha)) {
    return 'A nova senha deve conter letras e números.';
  }
  if (novaSenha !== confirmacao) {
    return 'A confirmação não coincide com a nova senha.';
  }
  if (senhaAtual && novaSenha === senhaAtual) {
    return 'A nova senha deve ser diferente da senha temporária.';
  }
  return null;
}
