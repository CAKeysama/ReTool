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
  /** Registros que já estavam iguais no banco e não foram regravados (economia de cota). */
  ignoradosSemAlteracao?: number;
  /** Motivo da interrupção antes do fim: cancelamento pelo usuário ou cota diária esgotada. */
  interrompido?: 'cancelado' | 'cota';
  /** Registros que ficaram sem gravar por causa da interrupção (reimportar completa). */
  naoGravados?: number;
  /** Documentos de dispositivos lidos do banco para comparar (custo em leituras). */
  documentosLidos?: number;
  /** Estado final dos dispositivos ({ id, ...dados }) após a importação — reconstrói o índice de busca sem reler a coleção. */
  documentosFinais?: Dispositivo[];
  /** Documentos efetivamente gravados (combinações repetidas na lista contam 1). */
  documentosGravados?: number;
}

/** Progresso real de uma importação (contado pelo trabalho já feito). */
export interface ProgressoImportacao {
  etapa: 'classificacoes' | 'lendo-existentes' | 'gravando' | 'concluido';
  feitos: number;
  total: number;
  lote?: number;
  totalLotes?: number;
}

export interface OpcoesImportacaoLote {
  onProgresso?: (p: ProgressoImportacao) => void;
  /** Cancela entre lotes; o que já foi gravado continua gravado (reimportar completa). */
  sinal?: AbortSignal;
  /**
   * Dispositivos existentes já lidos do servidor por quem chama (dispensa
   * a leitura). O app NÃO passa o catálogo de busca aqui: ele é gravável por
   * quem edita e não prova o conteúdo atual (ver PERFORMANCE.md). Precisam
   * ter todos os campos que a importação compara.
   */
  existentesConhecidos?: Partial<Dispositivo>[];
  /**
   * Meta do catálogo de busca: cada lote atualiza também as partes do
   * catálogo (no mesmo commit), sem reconstruir tudo no fim.
   */
  indice?: { partes: number } | null;
  /** O catálogo de classificações existe: classificações novas também entram nele. */
  catalogoClassificacoes?: boolean;
}

export interface IDispositivosRepository {
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
    produtosExistentes: Produto[],
    opcoes?: OpcoesImportacaoLote
  ): Promise<ResultadoImportacaoLote>;
  /** Exclui documentos em lotes de 500; falhas de lote são devolvidas, não lançadas. */
  excluirEmLote(
    ids: string[],
    meta?: { partes: number } | null,
    onProgresso?: (feitos: number, total: number) => void,
    sinal?: AbortSignal
  ): Promise<{ excluidos: number; erros: number; falhas: string[]; cancelado?: boolean }>;
}
