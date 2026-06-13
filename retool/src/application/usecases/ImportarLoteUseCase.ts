import { IDispositivosRepository } from '../../domain/repositories/IDispositivosRepository';
import { Dispositivo } from '../../domain/entities/dispositivo';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';

export class ImportarLoteUseCase {
  constructor(private dispositivosRepository: IDispositivosRepository) {}

  async execute(
    novosDispositivos: Partial<Dispositivo>[],
    newCategoriasNomes: string[],
    newFamiliasNomes: string[],
    newProdutosNomes: string[],
    categoriasExistentes: Categoria[],
    familiasExistentes: Familia[],
    produtosExistentes: Produto[]
  ): Promise<{ sucesso: number; erros: number }> {
    return this.dispositivosRepository.importarLote(
      novosDispositivos,
      newCategoriasNomes,
      newFamiliasNomes,
      newProdutosNomes,
      categoriasExistentes,
      familiasExistentes,
      produtosExistentes
    );
  }
}
