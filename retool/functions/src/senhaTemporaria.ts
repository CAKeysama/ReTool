import { randomInt } from 'node:crypto';

/**
 * Senha temporária gerada no servidor com o CSPRNG do Node (`randomInt`,
 * uniforme e sem viés de módulo). Mesmo alfabeto e regras do cliente
 * (src/domain/services/senhaTemporaria.ts): sem caracteres ambíguos e com
 * ao menos uma maiúscula, minúscula, dígito e símbolo.
 */
const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const DIGITOS = '23456789';
const SIMBOLOS = '!@#$%*-_+?';
const TODOS = MAIUSCULAS + MINUSCULAS + DIGITOS + SIMBOLOS;

export const TAMANHO_SENHA_TEMPORARIA = 14;

const escolher = (alfabeto: string) => alfabeto[randomInt(alfabeto.length)];

export function gerarSenhaTemporaria(tamanho = TAMANHO_SENHA_TEMPORARIA): string {
  const chars = [escolher(MAIUSCULAS), escolher(MINUSCULAS), escolher(DIGITOS), escolher(SIMBOLOS)];
  while (chars.length < tamanho) chars.push(escolher(TODOS));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
