import '../../mocks/firebaseMock';
import { FirestoreDispositivosRepository } from '../../../data/repositories/FirestoreDispositivosRepository';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { Categoria } from '../../../domain/entities/categoria';
import { Familia } from '../../../domain/entities/familia';
import { Produto } from '../../../domain/entities/produto';
import { Dispositivo } from '../../../domain/entities/dispositivo';
import { describe, beforeEach, test, expect } from '@jest/globals';

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
});
