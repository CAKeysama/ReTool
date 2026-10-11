import '../../mocks/firebaseMock';
import { FirestoreReutilizacoesRepository } from '../../../data/repositories/FirestoreReutilizacoesRepository';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { describe, beforeEach, test, expect } from '@jest/globals';
import { planejarNormalizacaoReutilizacoes } from '../../../domain/services/consultaReutilizacoes';

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
    // Status legado/ausente é normalizado para o estado inicial da fila do Projetista.
    expect(result[0]).toEqual({ ...mockUtil, status: 'Em análise (Projetista)' });
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

  test('contarProntidao conta total, status canônicos e dataCriacao string', async () => {
    mockDbState.reutilizacoes.push(
      { id: 'a', status: 'Reutilização aprovada', dataCriacao: '2026-01-01T00:00:00.000Z' },
      { id: 'b', status: 'pendente', dataCriacao: '2026-01-01T00:00:00.000Z' },
      { id: 'c', status: 'Em análise (Engenharia)' },
      { id: 'd', status: 'Em análise (Projetista)', dataCriacao: '' }
    );
    expect(await repository.contarProntidao()).toEqual({ total: 4, comStatusCanonico: 3, comDataCriacao: 2 });
  });

  test('aplicarNormalizacao grava só os campos do plano, em lotes, com progresso', async () => {
    for (let i = 0; i < 501; i++) mockDbState.reutilizacoes.push({ id: `r${i}`, status: 'pendente', descricaoAlteracao: `x${i}` });
    const plano = planejarNormalizacaoReutilizacoes(
      (await repository.listarDocumentosCrus()),
      new Date('2026-10-05T00:00:00.000Z')
    );
    const progresso: number[] = [];
    await repository.aplicarNormalizacao(plano, f => progresso.push(f));
    expect(progresso).toEqual([0, 500, 501]);
    expect(mockDbState.reutilizacoes[0]).toEqual({
      id: 'r0', status: 'Em análise (Projetista)', descricaoAlteracao: 'x0', dataCriacao: '2026-10-05T00:00:00.000Z'
    });
    expect(await repository.contarProntidao()).toEqual({ total: 501, comStatusCanonico: 501, comDataCriacao: 501 });
  });
});
