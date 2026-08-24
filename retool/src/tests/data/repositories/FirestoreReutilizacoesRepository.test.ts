import '../../mocks/firebaseMock';
import { FirestoreReutilizacoesRepository } from '../../../data/repositories/FirestoreReutilizacoesRepository';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { describe, beforeEach, test, expect } from '@jest/globals';

describe('FirestoreReutilizacoesRepository', () => {
  let repository: FirestoreReutilizacoesRepository;

  beforeEach(() => {
    resetMockDb();
    repository = new FirestoreReutilizacoesRepository();
  });

  test('should subscribe to all reutilizations', () => {
    const mockUtil = {
      id: 'u1',
      dispositivoId: 'd1',
      data: '2026-08-24',
      codigoPeca: '51500101580',
      descricaoPeca: 'SUP DIR LONGO DIANT',
      produtoId: 'p1',
      pesoPeca: 2.15,
      hardSaving: 22300,
      responsavel: 'João Silva',
      numeroOs: 'OS-24567',
      descricaoAlteracao: 'Adaptado dispositivo para novo produto SPE5500. Inclusão de 2 pinos guia e reforço na base.'
    };
    mockDbState.reutilizacoes.push(mockUtil);

    let result: any[] = [];
    repository.subscribeAll(data => { result = data; });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockUtil);
  });

  test('should add a reutilization with a new uuid and dataCriacao', async () => {
    const id = await repository.add({
      dispositivoId: 'd1',
      data: '2026-08-24',
      codigoPeca: '51500101580',
      descricaoPeca: 'SUP DIR LONGO DIANT',
      produtoId: 'p1',
      pesoPeca: 2.15,
      hardSaving: 22300,
      responsavel: 'João Silva',
      numeroOs: 'OS-24567',
      descricaoAlteracao: 'Adaptado dispositivo para novo produto SPE5500. Inclusão de 2 pinos guia e reforço na base.'
    });
    expect(id).toBeDefined();
    expect(mockDbState.reutilizacoes).toHaveLength(1);
    expect(mockDbState.reutilizacoes[0].id).toBe(id);
    expect(mockDbState.reutilizacoes[0].dataCriacao).toBeDefined();
  });

  test('should update a reutilization', async () => {
    mockDbState.reutilizacoes.push({
      id: 'u1',
      dispositivoId: 'd1',
      data: '2026-08-24',
      codigoPeca: '51500101580',
      descricaoPeca: 'SUP DIR LONGO DIANT',
      produtoId: 'p1',
      pesoPeca: 2.15,
      hardSaving: 22300,
      responsavel: 'João Silva',
      numeroOs: 'OS-24567',
      descricaoAlteracao: 'Original'
    });
    await repository.update('u1', { descricaoAlteracao: 'Corte' });
    expect(mockDbState.reutilizacoes[0].descricaoAlteracao).toBe('Corte');
  });

  test('should delete a reutilization', async () => {
    mockDbState.reutilizacoes.push({ id: 'u1', dispositivoId: 'd1' });
    await repository.delete('u1');
    expect(mockDbState.reutilizacoes).toHaveLength(0);
  });
});
