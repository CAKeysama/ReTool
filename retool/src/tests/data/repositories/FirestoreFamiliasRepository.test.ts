import '../../mocks/firebaseMock';
import { FirestoreFamiliasRepository } from '../../../data/repositories/FirestoreFamiliasRepository';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { describe, beforeEach, test, expect } from '@jest/globals';

describe('FirestoreFamiliasRepository', () => {
  let repository: FirestoreFamiliasRepository;

  beforeEach(() => {
    resetMockDb();
    repository = new FirestoreFamiliasRepository();
  });

  test('should subscribe to all families sorted by name', () => {
    mockDbState.familias.push({ id: 'f2', nome: 'Zeta' });
    mockDbState.familias.push({ id: 'f1', nome: 'Alpha' });

    let result: any[] = [];
    repository.subscribeAll(data => { result = data; });

    expect(result).toHaveLength(2);
    expect(result[0].nome).toBe('Alpha'); // Sorted!
    expect(result[1].nome).toBe('Zeta');
  });

  test('should add a family', async () => {
    const id = await repository.add({ nome: 'Familia 1' });
    expect(id).toBeDefined();
    expect(mockDbState.familias).toHaveLength(1);
  });

  test('should update a family', async () => {
    mockDbState.familias.push({ id: 'f1', nome: 'Velho' });
    await repository.update('f1', { nome: 'Novo' });
    expect(mockDbState.familias[0].nome).toBe('Novo');
  });

  test('should delete a family', async () => {
    mockDbState.familias.push({ id: 'f1', nome: 'Apagar' });
    await repository.delete('f1');
    expect(mockDbState.familias).toHaveLength(0);
  });
});
