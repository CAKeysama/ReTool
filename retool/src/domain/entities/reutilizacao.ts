export interface Reutilizacao {
  id: string;
  dispositivoId: string;
  data: string;
  codigoPeca: string;
  descricaoPeca: string;
  produtoId: string;
  pesoPeca: number;
  hardSaving: number;
  responsavel: string;
  numeroOs: string;
  descricaoAlteracao: string;
  dataCriacao?: string;
}
