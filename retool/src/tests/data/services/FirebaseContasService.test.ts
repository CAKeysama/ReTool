import '../../mocks/firebaseMock';
import { jest, describe, test, expect } from '@jest/globals';

const sendPasswordResetEmail = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('firebase/auth', () => ({ sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args) }));

import { FirebaseContasService } from '../../../data/services/FirebaseContasService';

describe('E-mail de redefinição de senha', () => {
  test('usa o Firebase Auth com o e-mail normalizado', async () => {
    await new FirebaseContasService().enviarEmailRedefinicaoSenha('  Pessoa@Empresa.COM ');
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail.mock.calls[0][1]).toBe('pessoa@empresa.com');
  });

  test('erros do Firebase chegam a quem chamou', async () => {
    sendPasswordResetEmail.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/invalid-email' }));
    await expect(new FirebaseContasService().enviarEmailRedefinicaoSenha('x')).rejects.toMatchObject({ code: 'auth/invalid-email' });
  });
});
