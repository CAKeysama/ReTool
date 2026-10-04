import { Dispositivo } from '../entities/dispositivo';
import { Categoria } from '../entities/categoria';
import { Familia } from '../entities/familia';
import { Produto } from '../entities/produto';

export interface ResultadoImportacaoLote {
  /** Registros gravados com sucesso (inseridos + atualizados). */
  sucesso: number;
  /** Registros de lotes cuja gravação falhou. */
  erros: number;
  inseridos?: number;
  atualizados?: number;
  /** Mensagens das falhas de gravação, se houver. */
  falhas?: string[];
}

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
  ): Promise<ResultadoImportacaoLote>;
  /** Exclui documentos em lotes de 500; falhas de lote são devolvidas, não lançadas. */
  excluirEmLote(ids: string[]): Promise<{ excluidos: number; erros: number; falhas: string[] }>;
}
