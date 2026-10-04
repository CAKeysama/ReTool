import '../../mocks/firebaseMock';
import { FirestoreDispositivosRepository } from '../../../data/repositories/FirestoreDispositivosRepository';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { Categoria } from '../../../domain/entities/categoria';
import { Familia } from '../../../domain/entities/familia';
import { Produto } from '../../../domain/entities/produto';
import { Dispositivo } from '../../../domain/entities/dispositivo';
import { describe, beforeEach, test, expect, jest } from '@jest/globals';

describe('FirestoreDispositivosRepository', () => {
  let repository: FirestoreDispositivosRepository;

  beforeEach(() => {
    resetMockDb();
    repository = new FirestoreDispositivosRepository();
  });

  test('should subscribe to all devices', () => {
    const mockDevice = { id: 'd1', nome: 'Device 1' };
    mockDbState.dispositivos.push(mockDevice);

    let result: Dispositivo[] = [];
    const unsub = repository.subscribeAll((data) => {
      result = data;
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockDevice);
    expect(typeof unsub).toBe('function');
  });

  test('should add a device with a new uuid and dataCriacao', async () => {
    const deviceData = { nome: 'New Device', codigo: 'COD1' };
    const id = await repository.add(deviceData);

    expect(id).toBeDefined();
    expect(mockDbState.dispositivos).toHaveLength(1);
    expect(mockDbState.dispositivos[0].nome).toBe('New Device');
    expect(mockDbState.dispositivos[0].id).toBe(id);
    expect(mockDbState.dispositivos[0].dataCriacao).toBeDefined();
  });

  test('should update a device', async () => {
    mockDbState.dispositivos.push({ id: 'd1', nome: 'Old Name', codigo: 'COD1' });
    await repository.update('d1', { nome: 'Updated Name' });

    expect(mockDbState.dispositivos[0].nome).toBe('Updated Name');
    expect(mockDbState.dispositivos[0].codigo).toBe('COD1');
  });

  test('should delete a device', async () => {
    mockDbState.dispositivos.push({ id: 'd1', nome: 'Device' });
    await repository.delete('d1');

    expect(mockDbState.dispositivos).toHaveLength(0);
  });

  test('should batch import devices and create missing categories/families/products case-insensitively', async () => {
    // DB starts with:
    // Categoria: "GABARITO"
    // Familia: "Corte"
    // Produto: "Avola 2500"
    mockDbState.categorias.push({ id: 'cat1', nome: 'GABARITO', ativo: true });
    mockDbState.familias.push({ id: 'fam1', nome: 'Corte', ativo: true });
    mockDbState.produtos.push({ id: 'prod1', nome: 'Avola 2500', ativo: true });

    // Existing devices in DB (should be queried inside importarLote)
    mockDbState.dispositivos.push({ id: 'disp1', nome: 'Disp Antigo', codigo: 'COD_EXISTENTE' });

    // Spreadsheet new items to create (missing list built by frontend):
    // 1. Categoria "FERRAMENTA DE CORTE" (new)
    // 2. Familia "Montagem" (new)
    // 3. Produto "Saw XP" (new)
    // Also "gabarito" (duplicate, but case-insensitive so it should reuse "cat1")
    const novosDispositivos: Partial<Dispositivo>[] = [
      {
        nome: 'Novo Disp 1',
        codigo: 'COD_NOVO_1',
        categoriaId: 'FERRAMENTA DE CORTE',
        familiaId: 'Montagem',
        produtoId: 'Saw XP'
      },
      {
        nome: 'Novo Disp 2',
        codigo: 'COD_NOVO_2',
        categoriaId: 'gabarito', // Case-insensitive matching should reuse existing cat1
        familiaId: 'corte',      // Case-insensitive matching should reuse existing fam1
        produtoId: 'avola 2500'  // Case-insensitive matching should reuse existing prod1
      },
      {
        nome: 'Disp Antigo',     // Matches name with disp1, should merge/update
        codigo: 'COD_EXISTENTE',
        categoriaId: 'cat1'
      }
    ];

    const result = await repository.importarLote(
      novosDispositivos,
      ['FERRAMENTA DE CORTE', 'gabarito'],
      ['Montagem', 'corte'],
      ['Saw XP', 'avola 2500'],
      mockDbState.categorias,
      mockDbState.familias,
      mockDbState.produtos
    );

    expect(result.sucesso).toBe(3);

    // Assert that new entities were created in mockDbState
    expect(mockDbState.categorias).toHaveLength(2); // "GABARITO" and "FERRAMENTA DE CORTE" (gabarito was reused!)
    expect(mockDbState.familias).toHaveLength(2); // "Corte" and "Montagem"
    expect(mockDbState.produtos).toHaveLength(2); // "Avola 2500" and "Saw XP"

    // Verify IDs mapped on created devices
    const createdDisp1 = mockDbState.dispositivos.find(d => d.codigo === 'COD_NOVO_1');
    expect(createdDisp1).toBeDefined();
    expect(createdDisp1.categoriaId).not.toBe('FERRAMENTA DE CORTE'); // Should be resolved to a uuid
    expect(createdDisp1.familiaId).not.toBe('Montagem');
    expect(createdDisp1.produtoId).not.toBe('Saw XP');

    const createdDisp2 = mockDbState.dispositivos.find(d => d.codigo === 'COD_NOVO_2');
    expect(createdDisp2).toBeDefined();
    expect(createdDisp2.categoriaId).toBe('cat1'); // Reused gabarito case-insensitively
    expect(createdDisp2.familiaId).toBe('fam1');   // Reused Corte
    expect(createdDisp2.produtoId).toBe('prod1');   // Reused Avola 2500

    const updatedDisp = mockDbState.dispositivos.find(d => d.codigo === 'COD_EXISTENTE');
    expect(updatedDisp).toBeDefined();
    expect(updatedDisp.id).toBe('disp1'); // Reused the same ID
    expect(updatedDisp.categoriaId).toBe('cat1');
  });

  test('should skip duplicate creations if they are already in the batch list case-insensitively', async () => {
    const result = await repository.importarLote(
      [
        { nome: 'D1', codigo: 'C1', categoriaId: 'Novo Gabarito', familiaId: 'Nova Familia', produtoId: 'Novo Produto' },
        { nome: 'D2', codigo: 'C2', categoriaId: 'novo gabarito', familiaId: 'nova familia', produtoId: 'novo produto' }
      ],
      ['Novo Gabarito', 'novo gabarito'],
      ['Nova Familia', 'nova familia'],
      ['Novo Produto', 'novo produto'],
      [],
      [],
      []
    );

    expect(result.sucesso).toBe(2);
    expect(mockDbState.categorias).toHaveLength(1); // Should only create 1 new category instead of 2
    expect(mockDbState.familias).toHaveLength(1);
    expect(mockDbState.produtos).toHaveLength(1);
  });

  describe('importarLote — chave Código + Dispositivo', () => {
    const importar = (lista: Partial<Dispositivo>[]) => repository.importarLote(lista, [], [], [], [], [], []);

    test('mesmo Código com Dispositivo diferente de um registro existente cria novo documento (não sobrescreve)', async () => {
      mockDbState.dispositivos.push({ id: 'disp1', codigo: 'ABC', nome: 'D01', imagemPeca: 'img.png' });

      const result = await importar([
        { codigo: 'ABC', nome: 'D02' },
        { codigo: 'ABC', nome: 'D03' },
        { codigo: 'XYZ', nome: 'D01' },
      ]);

      expect(result).toMatchObject({ sucesso: 3, inseridos: 3, atualizados: 0, erros: 0 });
      expect(mockDbState.dispositivos).toHaveLength(4);
      expect(mockDbState.dispositivos.find(d => d.id === 'disp1')).toMatchObject({ codigo: 'ABC', nome: 'D01' });
    });

    test('mesma combinação (ignorando caixa/espaços) atualiza o existente e preserva imagens', async () => {
      mockDbState.dispositivos.push({ id: 'disp1', codigo: 'ABC', nome: 'D01', descricao: 'antiga', imagemPeca: 'img.png' });

      const result = await importar([{ codigo: ' abc ', nome: 'd01', descricao: 'nova', imagemPeca: '', imagemDispositivo: '' }]);

      expect(result).toMatchObject({ sucesso: 1, inseridos: 0, atualizados: 1 });
      expect(mockDbState.dispositivos).toHaveLength(1);
      expect(mockDbState.dispositivos[0]).toMatchObject({ id: 'disp1', descricao: 'nova', imagemPeca: 'img.png' });
    });

    test('combinação repetida na própria lista reaproveita o mesmo documento', async () => {
      await importar([{ codigo: 'A', nome: '1' }, { codigo: 'a', nome: '1 ' }, { codigo: 'A', nome: '2' }]);
      expect(mockDbState.dispositivos).toHaveLength(2);
      for (const d of mockDbState.dispositivos) expect(d).toEqual(expect.objectContaining({ id: expect.any(String), dataCriacao: expect.any(String) }));
    });

    test('reprocessar o mesmo arquivo não duplica nem perde registros', async () => {
      const lista = Array.from({ length: 1200 }, (_, i) => ({ codigo: `C${i % 400}`, nome: `D${Math.floor(i / 400)}` }));
      const primeira = await importar(lista);
      const segunda = await importar(lista);
      expect(primeira).toMatchObject({ inseridos: 1200, atualizados: 0, erros: 0 });
      expect(segunda).toMatchObject({ inseridos: 0, atualizados: 1200, erros: 0 });
      expect(mockDbState.dispositivos).toHaveLength(1200);
    });

    test('grava todos os lotes de 500, inclusive o último incompleto', async () => {
      const { writeBatch } = jest.requireMock('firebase/firestore') as { writeBatch: jest.Mock };
      writeBatch.mockClear();
      const lista = Array.from({ length: 1234 }, (_, i) => ({ codigo: `C${i}`, nome: 'D' }));
      const result = await importar(lista);
      expect(result).toMatchObject({ sucesso: 1234, erros: 0 });
      expect(mockDbState.dispositivos).toHaveLength(1234);
      const commits = writeBatch.mock.results
        .map(r => (r.value as { commit: jest.Mock }).commit.mock.calls.length)
        .reduce((a, b) => a + b, 0);
      expect(commits).toBe(3); // 500 + 500 + 234
    });

    test('falha num lote é reportada em erros (sem perda silenciosa) e os demais lotes continuam', async () => {
      const firestore = jest.requireMock('firebase/firestore') as { writeBatch: jest.Mock };
      const original = firestore.writeBatch.getMockImplementation()!;
      let chamadas = 0;
      firestore.writeBatch.mockImplementation((...args: unknown[]) => {
        const batch = original(...args) as { commit: jest.Mock };
        chamadas++;
        if (chamadas === 2) batch.commit.mockImplementation(async () => { throw new Error('DEADLINE_EXCEEDED'); });
        return batch;
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const lista = Array.from({ length: 1100 }, (_, i) => ({ codigo: `C${i}`, nome: 'D' }));
        const result = await importar(lista);
        expect(result).toMatchObject({ sucesso: 600, erros: 500, falhas: ['DEADLINE_EXCEEDED'] });
        expect(mockDbState.dispositivos).toHaveLength(600);

        // Reimportar grava só o que faltou.
        firestore.writeBatch.mockImplementation(original);
        const retry = await importar(lista);
        expect(retry).toMatchObject({ inseridos: 500, atualizados: 600, erros: 0 });
        expect(mockDbState.dispositivos).toHaveLength(1100);
      } finally {
        firestore.writeBatch.mockImplementation(original);
        (console.error as jest.Mock).mockRestore();
      }
    });
  });
});
