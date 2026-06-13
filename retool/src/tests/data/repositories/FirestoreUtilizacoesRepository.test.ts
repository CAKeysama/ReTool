import '../../mocks/firebaseMock';
import { FirestoreUtilizacoesRepository } from '../../../data/repositories/FirestoreUtilizacoesRepository';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { describe, beforeEach, test, expect } from '@jest/globals';

describe('FirestoreUtilizacoesRepository', () => {
  let repository: FirestoreUtilizacoesRepository;

  beforeEach(() => {
    resetMockDb();
    repository = new FirestoreUtilizacoesRepository();
  });

  test('should subscribe to all utilizations', () => {
    const mockUtil = { id: 'u1', dispositivoId: 'd1', setor: 'Setor 1' };
    mockDbState.utilizacoes.push(mockUtil);

    let result: any[] = [];
    repository.subscribeAll(data => { result = data; });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockUtil);
  });

  test('should add an utilization with a new uuid and dataCriacao', async () => {
    const id = await repository.add({ dispositivoId: 'd1', setor: 'Montagem' });
    expect(id).toBeDefined();
    expect(mockDbState.utilizacoes).toHaveLength(1);
    expect(mockDbState.utilizacoes[0].id).toBe(id);
    expect(mockDbState.utilizacoes[0].dataCriacao).toBeDefined();
  });

  test('should update an utilization', async () => {
    mockDbState.utilizacoes.push({ id: 'u1', dispositivoId: 'd1', setor: 'Solda' });
    await repository.update('u1', { setor: 'Corte' });
    expect(mockDbState.utilizacoes[0].setor).toBe('Corte');
  });

  test('should delete an utilization', async () => {
    mockDbState.utilizacoes.push({ id: 'u1', dispositivoId: 'd1' });
    await repository.delete('u1');
    expect(mockDbState.utilizacoes).toHaveLength(0);
  });
});
