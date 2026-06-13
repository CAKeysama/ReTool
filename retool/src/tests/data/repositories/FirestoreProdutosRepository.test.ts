import '../../mocks/firebaseMock';
import { FirestoreProdutosRepository } from '../../../data/repositories/FirestoreProdutosRepository';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { describe, beforeEach, test, expect } from '@jest/globals';

describe('FirestoreProdutosRepository', () => {
  let repository: FirestoreProdutosRepository;

  beforeEach(() => {
    resetMockDb();
    repository = new FirestoreProdutosRepository();
  });

  test('should subscribe to all products sorted by name', () => {
    mockDbState.produtos.push({ id: 'p2', nome: 'Beta' });
    mockDbState.produtos.push({ id: 'p1', nome: 'Alpha' });

    let result: any[] = [];
    repository.subscribeAll(data => { result = data; });

    expect(result).toHaveLength(2);
    expect(result[0].nome).toBe('Alpha'); // Sorted!
    expect(result[1].nome).toBe('Beta');
  });

  test('should add a product', async () => {
    const id = await repository.add({ nome: 'Produto 1' });
    expect(id).toBeDefined();
    expect(mockDbState.produtos).toHaveLength(1);
  });

  test('should update a product', async () => {
    mockDbState.produtos.push({ id: 'p1', nome: 'Velho' });
    await repository.update('p1', { nome: 'Novo' });
    expect(mockDbState.produtos[0].nome).toBe('Novo');
  });

  test('should delete a product', async () => {
    mockDbState.produtos.push({ id: 'p1', nome: 'Apagar' });
    await repository.delete('p1');
    expect(mockDbState.produtos).toHaveLength(0);
  });
});
