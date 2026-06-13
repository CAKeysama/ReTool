import { Utilizacao } from '../entities/utilizacao';

export interface IUtilizacoesRepository {
  subscribeAll(callback: (utilizacoes: Utilizacao[]) => void): () => void;
  add(utilizacao: Omit<Utilizacao, 'id' | 'dataCriacao'>): Promise<string>;
  update(id: string, data: Partial<Utilizacao>): Promise<void>;
  delete(id: string): Promise<void>;
}
