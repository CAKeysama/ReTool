import { Familia } from '../entities/familia';

export interface IFamiliasRepository {
  subscribeAll(callback: (familias: Familia[]) => void): () => void;
  add(familia: Omit<Familia, 'id'>): Promise<string>;
  update(id: string, data: Partial<Familia>): Promise<void>;
  delete(id: string): Promise<void>;
}
