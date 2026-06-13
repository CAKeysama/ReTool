export interface Dispositivo {
  id: string;
  nome?: string;
  codigo?: string;
  categoriaId?: string;
  peso?: string;
  familiaId?: string;
  descricao?: string;
  observacoes?: string;
  produtoId?: string;
  palavrasChave?: string[];
  imagemPeca?: string;
  imagemDispositivo?: string;
  dataCriacao?: string;
}
