import { Categoria, Tipo } from '../entities/categoria';

export interface ICategoriasRepository {
  subscribeCategorias(callback: (categorias: Categoria[]) => void): () => void;
  subscribeTipos(callback: (tipos: Tipo[]) => void): () => void;
  addCategoria(categoria: Omit<Categoria, 'id'>): Promise<string>;
  updateCategoria(id: string, data: Partial<Categoria>): Promise<void>;
  deleteCategoria(id: string): Promise<void>;
  addTipo(tipo: Omit<Tipo, 'id'>): Promise<string>;
  updateTipo(id: string, data: Partial<Tipo>): Promise<void>;
  deleteTipo(id: string): Promise<void>;
}
