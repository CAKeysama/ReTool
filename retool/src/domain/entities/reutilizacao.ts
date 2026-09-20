import { UserRole } from './user';

/** Máquina de estados do fluxo de reutilização de dispositivos. */
export type ReutilizacaoStatus =
  | 'Em análise (Engenharia)'
  | 'Em análise (Projetista)'
  | 'Reutilização aprovada'
  | 'Reutilização não aprovada'
  | 'Liberado para fabricação (novo dispositivo)'
  | 'Aguardando novo filtro (Projetista)'
  | 'Em andamento - OS';

export const REUTILIZACAO_STATUS: ReutilizacaoStatus[] = [
  'Em análise (Engenharia)',
  'Em análise (Projetista)',
  'Reutilização aprovada',
  'Reutilização não aprovada',
  'Liberado para fabricação (novo dispositivo)',
  'Aguardando novo filtro (Projetista)',
  'Em andamento - OS'
];

/** Compatibilidade com registros antigos (pendente/aprovado/rejeitado). */
export function normalizarStatusReutilizacao(status?: string): ReutilizacaoStatus {
  switch (status) {
    case 'pendente': return 'Em análise (Projetista)';
    case 'aprovado': return 'Reutilização aprovada';
    case 'rejeitado': return 'Reutilização não aprovada';
    default:
      return (REUTILIZACAO_STATUS as string[]).includes(status || '')
        ? (status as ReutilizacaoStatus)
        : 'Em análise (Projetista)';
  }
}

/**
 * Transições permitidas por perfil (espelhadas em firestore.rules):
 * - Engenharia: inicia (1º filtro), gera OS e solicita dispositivo novo.
 * - Projetista: análise técnica (1º filtro) e verificação de similares (2º filtro).
 * - Administração: todas as transições.
 * - Gerência: nenhuma (somente leitura).
 */
export const TRANSICOES_REUTILIZACAO: Record<UserRole, Partial<Record<ReutilizacaoStatus, ReutilizacaoStatus[]>>> = {
  admin: {
    'Em análise (Engenharia)': ['Em análise (Projetista)'],
    'Em análise (Projetista)': ['Reutilização aprovada', 'Reutilização não aprovada'],
    'Reutilização aprovada': ['Em andamento - OS'],
    'Reutilização não aprovada': ['Em andamento - OS', 'Aguardando novo filtro (Projetista)'],
    'Aguardando novo filtro (Projetista)': ['Em análise (Projetista)', 'Liberado para fabricação (novo dispositivo)']
  },
  projetista: {
    'Em análise (Projetista)': ['Reutilização aprovada', 'Reutilização não aprovada'],
    'Aguardando novo filtro (Projetista)': ['Em análise (Projetista)', 'Liberado para fabricação (novo dispositivo)']
  },
  engenharia: {
    'Em análise (Engenharia)': ['Em análise (Projetista)'],
    'Reutilização aprovada': ['Em andamento - OS'],
    'Reutilização não aprovada': ['Em andamento - OS', 'Aguardando novo filtro (Projetista)']
  },
  gerencia: {}
};

export function transicaoReutilizacaoPermitida(perfil: UserRole, de: ReutilizacaoStatus, para: ReutilizacaoStatus): boolean {
  return (TRANSICOES_REUTILIZACAO[perfil]?.[de] || []).includes(para);
}

/** Rótulo compacto para chips/tabelas. */
export function rotuloCurtoStatusReutilizacao(status: ReutilizacaoStatus): string {
  switch (status) {
    case 'Em análise (Engenharia)': return 'Análise Engenharia';
    case 'Em análise (Projetista)': return 'Em análise';
    case 'Reutilização aprovada': return 'Aprovada';
    case 'Reutilização não aprovada': return 'Não aprovada';
    case 'Liberado para fabricação (novo dispositivo)': return 'Liberado p/ fabricação';
    case 'Aguardando novo filtro (Projetista)': return 'Novo filtro';
    case 'Em andamento - OS': return 'Em andamento OS';
  }
}

/** Cores de exibição por status (padrão visual do sistema). */
export function corDoStatusReutilizacao(status: ReutilizacaoStatus): { fundo: string; texto: string } {
  switch (status) {
    case 'Em análise (Engenharia)': return { fundo: '#e0e7ff', texto: '#3730a3' };
    case 'Em análise (Projetista)': return { fundo: 'var(--color-box-yellow-bg)', texto: '#b45309' };
    case 'Aguardando novo filtro (Projetista)': return { fundo: 'var(--color-box-blue-bg)', texto: 'var(--color-box-blue-text)' };
    case 'Reutilização aprovada':
    case 'Liberado para fabricação (novo dispositivo)': return { fundo: '#dcfce7', texto: 'var(--color-success)' };
    case 'Reutilização não aprovada': return { fundo: '#fee2e2', texto: 'var(--color-danger)' };
    case 'Em andamento - OS': return { fundo: 'var(--color-box-teal-bg)', texto: 'var(--color-box-teal-text)' };
  }
}

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
  status?: ReutilizacaoStatus;
  solicitanteId?: string;
  solicitanteNome?: string;
  aprovadorId?: string;
  aprovadorNome?: string;
  dataAprovacao?: string;
  motivoRejeicao?: string;
}
