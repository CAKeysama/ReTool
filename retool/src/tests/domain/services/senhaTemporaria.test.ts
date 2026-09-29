import { describe, it, expect, jest } from '@jest/globals';
import {
  gerarSenhaTemporaria, validarNovaSenha, TAMANHO_SENHA_TEMPORARIA, TAMANHO_MINIMO_SENHA
} from '../../../domain/services/senhaTemporaria';

describe('Senha temporária', () => {
  it('tem o tamanho padrão e todas as classes de caracteres', () => {
    for (let i = 0; i < 200; i++) {
      const senha = gerarSenhaTemporaria();
      expect(senha).toHaveLength(TAMANHO_SENHA_TEMPORARIA);
      expect(senha).toMatch(/[A-Z]/);
      expect(senha).toMatch(/[a-z]/);
      expect(senha).toMatch(/[2-9]/);
      expect(senha).toMatch(/[!@#$%*\-_+?]/);
      // Sem caracteres ambíguos para repasse ao colaborador.
      expect(senha).not.toMatch(/[0O1lI]/);
    }
  });

  it('não repete senhas (não é uma senha fixa)', () => {
    const geradas = new Set(Array.from({ length: 500 }, () => gerarSenhaTemporaria()));
    expect(geradas.size).toBe(500);
  });

  it('usa o gerador criptográfico (crypto.getRandomValues)', () => {
    const espiao = jest.spyOn(globalThis.crypto, 'getRandomValues');
    gerarSenhaTemporaria();
    expect(espiao).toHaveBeenCalled();
    espiao.mockRestore();
  });

  it('é determinística com uma fonte injetada (sem Math.random)', () => {
    const fonteFixa = () => (buf: Uint32Array<ArrayBuffer>) => { buf[0] = 7; return buf; };
    expect(gerarSenhaTemporaria(12, fonteFixa())).toBe(gerarSenhaTemporaria(12, fonteFixa()));
  });

  it('recusa tamanhos inseguros', () => {
    expect(() => gerarSenhaTemporaria(TAMANHO_MINIMO_SENHA - 1)).toThrow();
  });
});

describe('Política da nova senha (primeiro acesso)', () => {
  it.each([
    ['curta', 'ab12', 'ab12', undefined, /mínimo/],
    ['sem números', 'abcdefghij', 'abcdefghij', undefined, /letras e números/],
    ['sem letras', '1234567890', '1234567890', undefined, /letras e números/],
    ['confirmação diferente', 'Segura123', 'Segura124', undefined, /confirmação/],
    ['igual à temporária', 'Temp1234!x', 'Temp1234!x', 'Temp1234!x', /diferente/],
  ])('recusa senha %s', (_d, nova, confirmacao, atual, erro) => {
    expect(validarNovaSenha(nova, confirmacao, atual)).toMatch(erro);
  });

  it('aceita senha válida', () => {
    expect(validarNovaSenha('MinhaSenha2026', 'MinhaSenha2026', 'Temp1234!x')).toBeNull();
  });
});
