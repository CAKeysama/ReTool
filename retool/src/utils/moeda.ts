/**
 * Lê um valor em reais digitado pela pessoa. Aceita o formato brasileiro
 * ("1.500,50", "1500,50", "1.500" = mil e quinhentos), o ponto decimal
 * ("1500.50") e o prefixo "R$". Vazio = 0. Devolve null se não for um
 * número válido, zero ou maior.
 */
export function lerValorMonetario(digitado: string): number | null {
  const texto = digitado.trim().replace(/^R\$\s*/i, '');
  if (texto === '') return 0;
  const comMilhar = texto.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(texto);
  const numero = Number(comMilhar ? texto.replace(/\./g, '').replace(',', '.') : texto);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}
