import '../../mocks/firebaseMock';
import { FirestoreCategoriasRepository } from '../../../data/repositories/FirestoreCategoriasRepository';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { describe, beforeEach, test, expect } from '@jest/globals';

describe('FirestoreCategoriasRepository', () => {
  let repository: FirestoreCategoriasRepository;

  beforeEach(() => {
    resetMockDb();
    repository = new FirestoreCategoriasRepository();
  });

  test('should subscribe to categorias', () => {
    mockDbState.categorias.push({ id: 'c1', nome: 'Cat 1' });
    let result: any[] = [];
    repository.subscribeCategorias(data => { result = data; });
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe('Cat 1');
  });

  test('should subscribe to tipos', () => {
    mockDbState.tipos.push({ id: 't1', nome: 'Tipo 1' });
    let result: any[] = [];
    repository.subscribeTipos(data => { result = data; });
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe('Tipo 1');
  });

  test('should add a category', async () => {
    const id = await repository.addCategoria({ nome: 'Nova Categoria' });
    expect(id).toBeDefined();
    expect(mockDbState.categorias).toHaveLength(1);
    expect(mockDbState.categorias[0].nome).toBe('Nova Categoria');
  });

  test('should update a category', async () => {
    mockDbState.categorias.push({ id: 'c1', nome: 'Velha' });
    await repository.updateCategoria('c1', { nome: 'Nova' });
    expect(mockDbState.categorias[0].nome).toBe('Nova');
  });

  test('should delete a category', async () => {
    mockDbState.categorias.push({ id: 'c1', nome: 'Apagar' });
    await repository.deleteCategoria('c1');
    expect(mockDbState.categorias).toHaveLength(0);
  });

  test('should add a tipo', async () => {
    const id = await repository.addTipo({ nome: 'Novo Tipo' });
    expect(id).toBeDefined();
    expect(mockDbState.tipos).toHaveLength(1);
  });

  test('should update a tipo', async () => {
    mockDbState.tipos.push({ id: 't1', nome: 'Velho' });
    await repository.updateTipo('t1', { nome: 'Novo' });
    expect(mockDbState.tipos[0].nome).toBe('Novo');
  });

  test('should delete a tipo', async () => {
    mockDbState.tipos.push({ id: 't1', nome: 'Apagar' });
    await repository.deleteTipo('t1');
    expect(mockDbState.tipos).toHaveLength(0);
  });
});
