import '../../mocks/firebaseMock';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { onSnapshot } from 'firebase/firestore';
import { FirestoreUsersRepository } from '../../../data/repositories/FirestoreUsersRepository';

const repo = new FirestoreUsersRepository();

beforeEach(() => {
  resetMockDb();
  mockDbState.users.push(
    { id: 'a1', uid: 'a1', nome: 'Admin Ativa', perfil: 'admin', ativo: true },
    { id: 'a2', uid: 'a2', nome: 'Admin Bloqueada', perfil: 'admin', ativo: false },
    { id: 'e1', uid: 'e1', nome: 'Engenharia', perfil: 'engenharia', ativo: true },
  );
});

describe('FirestoreUsersRepository', () => {
  test('lista somente administradores ativos (destinatários das notificações)', async () => {
    const admins = await repo.listarAdministradoresAtivos();
    expect(admins.map(a => a.uid)).toEqual(['a1']);
  });

  test('não grava campos indefinidos no perfil', async () => {
    await repo.setProfile({ uid: 'n1', email: 'n1@retool.test', nome: 'N1', perfil: 'convidado', ativo: false, statusAprovacao: 'pendente', motivoRejeicao: undefined });
    expect('motivoRejeicao' in mockDbState.users.find(u => u.id === 'n1')).toBe(false);
  });

  test('perfil em tempo real ignora escritas locais ainda não confirmadas pelo servidor', () => {
    const snapshot = (pendente: boolean) => ({
      id: 'e1', exists: () => true, data: () => ({ perfil: 'engenharia', ativo: true }),
      metadata: { hasPendingWrites: pendente }
    });
    (onSnapshot as unknown as jest.Mock).mockImplementationOnce((_ref: any, opcoes: any, cb: any) => {
      expect(opcoes).toEqual({ includeMetadataChanges: true });
      cb(snapshot(true));
      cb(snapshot(false));
      return () => {};
    });

    const recebidos: unknown[] = [];
    repo.subscribeProfile('e1', p => recebidos.push(p));
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0]).toMatchObject({ uid: 'e1', perfil: 'engenharia' });
  });
});
