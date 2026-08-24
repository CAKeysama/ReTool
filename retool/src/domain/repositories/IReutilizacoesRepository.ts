import { Reutilizacao } from '../entities/reutilizacao';

export interface IReutilizacoesRepository {
  subscribeAll(callback: (reutilizacoes: Reutilizacao[]) => void): () => void;
  add(reutilizacao: Omit<Reutilizacao, 'id' | 'dataCriacao'>): Promise<string>;
  update(id: string, data: Partial<Reutilizacao>): Promise<void>;
  delete(id: string): Promise<void>;
}
