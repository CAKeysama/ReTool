import { Dispositivo } from '../entities/dispositivo';
import { Categoria } from '../entities/categoria';
import { Familia } from '../entities/familia';
import { Produto } from '../entities/produto';

export interface IDispositivosRepository {
  subscribeAll(callback: (dispositivos: Dispositivo[]) => void): () => void;
  add(dispositivo: Omit<Dispositivo, 'id' | 'dataCriacao'> & { id?: string }): Promise<string>;
  update(id: string, data: Partial<Dispositivo>): Promise<void>;
  delete(id: string): Promise<void>;
  importarLote(
    novosDispositivos: Partial<Dispositivo>[],
    newCategoriasNomes: string[],
    newFamiliasNomes: string[],
    newProdutosNomes: string[],
    categoriasExistentes: Categoria[],
    familiasExistentes: Familia[],
    produtosExistentes: Produto[]
  ): Promise<{ sucesso: number; erros: number }>;
}
