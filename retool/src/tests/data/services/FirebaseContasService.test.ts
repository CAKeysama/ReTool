import '../../mocks/firebaseMock';
import { describe, test, expect } from '@jest/globals';
import { traduzirErroFuncao } from '../../../data/services/FirebaseContasService';

describe('Mensagens das Cloud Functions', () => {
  test('erros de negócio chegam com a mensagem do servidor', () => {
    expect(traduzirErroFuncao({ code: 'functions/permission-denied', message: 'Acesso negado: operação exclusiva da Administração.' }))
      .toBe('Acesso negado: operação exclusiva da Administração.');
    expect(traduzirErroFuncao({ code: 'functions/not-found', message: 'Usuário não encontrado.' })).toBe('Usuário não encontrado.');
  });

  test.each([
    [{ code: 'functions/internal', message: 'internal' }],
    [{ code: 'functions/not-found', message: 'NOT_FOUND' }],
    [{ code: 'functions/unavailable', message: 'qualquer' }],
  ])('função não publicada/indisponível orienta o deploy (%o)', (erro) => {
    expect(traduzirErroFuncao(erro)).toMatch(/Cloud Functions/);
  });

  test('erros que não vêm das Cloud Functions seguem para o tradutor de autenticação', () => {
    expect(traduzirErroFuncao({ code: 'auth/invalid-credential' })).toBeNull();
    expect(traduzirErroFuncao(new Error('x'))).toBeNull();
  });
});
