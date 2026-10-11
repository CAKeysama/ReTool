import { UserProfile, UserRole, isContaOperacional, isPerfilAtribuivel } from './user';

export type SolicitacaoCargoStatus = 'pendente' | 'aprovada' | 'rejeitada';

/** Pedido do próprio usuário para mudar de cargo; só a Administração decide. */
export interface SolicitacaoCargo {
  id: string;
  usuarioUid: string;
  usuarioNome: string;
  usuarioEmail: string;
  perfilAtual: UserRole;
  perfilSolicitado: UserRole;
  justificativa?: string;
  status: SolicitacaoCargoStatus;
  dataSolicitacao: string;
  decididoPorUid?: string;
  decididoPorNome?: string;
  dataDecisao?: string;
  motivoDecisao?: string;
}

export const JUSTIFICATIVA_MAX = 500;

export const ROTULO_STATUS_SOLICITACAO: Record<SolicitacaoCargoStatus, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
};

/**
 * Quem pode pedir alteração de cargo: contas operacionais que não são da
 * Administração (a Administração altera cargos diretamente).
 */
export function podeSolicitarAlteracaoCargo(usuario: UserProfile | null | undefined): boolean {
  return isContaOperacional(usuario) && usuario!.perfil !== 'admin';
}

/** Valida uma nova solicitação; retorna a mensagem de erro ou null. */
export function validarNovaSolicitacaoCargo(
  usuario: UserProfile | null | undefined,
  perfilSolicitado: unknown,
  pendenteExistente: SolicitacaoCargo | null,
  justificativa?: string
): string | null {
  if (!podeSolicitarAlteracaoCargo(usuario)) {
    return 'Sua conta não pode solicitar alteração de cargo.';
  }
  if (!isPerfilAtribuivel(perfilSolicitado)) {
    return 'Selecione um cargo válido.';
  }
  if (perfilSolicitado === usuario!.perfil) {
    return 'O cargo solicitado deve ser diferente do cargo atual.';
  }
  if (pendenteExistente) {
    return 'Você já possui uma solicitação de alteração de cargo pendente.';
  }
  if (justificativa && justificativa.length > JUSTIFICATIVA_MAX) {
    return `A justificativa deve ter no máximo ${JUSTIFICATIVA_MAX} caracteres.`;
  }
  return null;
}
