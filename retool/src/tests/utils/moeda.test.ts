import { lerValorMonetario } from '../../utils/moeda';

describe('lerValorMonetario', () => {
  it('lê o formato brasileiro, com e sem milhar', () => {
    expect(lerValorMonetario('1.500,50')).toBe(1500.5);
    expect(lerValorMonetario('1500,50')).toBe(1500.5);
    expect(lerValorMonetario('1.500')).toBe(1500);
    expect(lerValorMonetario('1.234.567,89')).toBe(1234567.89);
    expect(lerValorMonetario('R$ 2.000,00')).toBe(2000);
  });

  it('lê o ponto decimal e números inteiros', () => {
    expect(lerValorMonetario('1500.50')).toBe(1500.5);
    expect(lerValorMonetario('12.5')).toBe(12.5);
    expect(lerValorMonetario(' 22300 ')).toBe(22300);
  });

  it('vazio é zero; negativo ou texto inválido é recusado', () => {
    expect(lerValorMonetario('')).toBe(0);
    expect(lerValorMonetario('   ')).toBe(0);
    expect(lerValorMonetario('-10')).toBeNull();
    expect(lerValorMonetario('abc')).toBeNull();
    expect(lerValorMonetario('1,2,3')).toBeNull();
  });
});
