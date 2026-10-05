import { ImportarLoteUseCase } from '../../../application/usecases/ImportarLoteUseCase';
import { IDispositivosRepository } from '../../../domain/repositories/IDispositivosRepository';
import { Dispositivo } from '../../../domain/entities/dispositivo';
import { Categoria } from '../../../domain/entities/categoria';
import { Familia } from '../../../domain/entities/familia';
import { Produto } from '../../../domain/entities/produto';
import { jest, describe, test, expect } from '@jest/globals';

describe('ImportarLoteUseCase', () => {
  test('should delegate importing to the devices repository', async () => {
    // Arrange
    const mockResult = { sucesso: 5, erros: 0 };
    const mockRepo: jest.Mocked<IDispositivosRepository> = {
      add: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      importarLote: jest.fn(async () => mockResult),
    } as any;

    const useCase = new ImportarLoteUseCase(mockRepo);

    const novosDispositivos: Partial<Dispositivo>[] = [{ nome: 'Disp 1', codigo: 'COD1' }];
    const newCategoriasNomes = ['Cat 1'];
    const newFamiliasNomes = ['Fam 1'];
    const newProdutosNomes = ['Prod 1'];
    const categoriasExistentes: Categoria[] = [{ id: '1', nome: 'Cat 1' }];
    const familiasExistentes: Familia[] = [{ id: '2', nome: 'Fam 1' }];
    const produtosExistentes: Produto[] = [{ id: '3', nome: 'Prod 1' }];

    // Act
    const result = await useCase.execute(
      novosDispositivos,
      newCategoriasNomes,
      newFamiliasNomes,
      newProdutosNomes,
      categoriasExistentes,
      familiasExistentes,
      produtosExistentes
    );

    // Assert
    expect(mockRepo.importarLote).toHaveBeenCalledWith(
      novosDispositivos,
      newCategoriasNomes,
      newFamiliasNomes,
      newProdutosNomes,
      categoriasExistentes,
      familiasExistentes,
      produtosExistentes,
      undefined
    );
    expect(result).toEqual(mockResult);
  });

  test('repassa as opções (progresso, cancelamento, total estimado) ao repositório', async () => {
    const mockResult = { sucesso: 0, erros: 0, interrompido: 'cancelado' as const, naoGravados: 3 };
    const importarLote = jest.fn(async (..._args: unknown[]) => mockResult);
    const useCase = new ImportarLoteUseCase({ importarLote } as unknown as IDispositivosRepository);
    const controle = new AbortController();
    const onProgresso = jest.fn();
    const opcoes = { onProgresso, sinal: controle.signal };

    const result = await useCase.execute([{ codigo: 'A', nome: '1' }], [], [], [], [], [], [], opcoes);

    expect(importarLote).toHaveBeenCalledTimes(1);
    expect(importarLote.mock.calls[0][7]).toBe(opcoes);
    expect(result).toBe(mockResult);
  });
});
