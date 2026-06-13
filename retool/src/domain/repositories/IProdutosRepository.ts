import { Produto } from '../entities/produto';

export interface IProdutosRepository {
  subscribeAll(callback: (produtos: Produto[]) => void): () => void;
  add(produto: Omit<Produto, 'id'>): Promise<string>;
  update(id: string, data: Partial<Produto>): Promise<void>;
  delete(id: string): Promise<void>;
}
