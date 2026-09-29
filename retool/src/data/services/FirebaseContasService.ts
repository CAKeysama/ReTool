import { httpsCallable } from 'firebase/functions';
import { functions } from '../datasources/firebase';

/**
 * Operações de conta que exigem o Admin SDK e, por isso, rodam em Cloud
 * Functions (functions/src/index.ts). Toda a autorização é refeita no
 * servidor; o cliente apenas encaminha o pedido.
 */
export class FirebaseContasService {
  /** Gera nova senha temporária para outra conta; devolvida uma única vez. */
  async redefinirSenhaTemporaria(uid: string): Promise<string> {
    const chamar = httpsCallable<{ uid: string }, { senhaTemporaria: string }>(functions, 'redefinirSenhaTemporaria');
    const { data } = await chamar({ uid });
    return data.senhaTemporaria;
  }
}

/**
 * Mensagens das Cloud Functions. Erros de negócio já chegam em português
 * (HttpsError); erros genéricos indicam função indisponível/não publicada.
 */
export function traduzirErroFuncao(err: unknown): string | null {
  const { code = '', message = '' } = (err as { code?: string; message?: string }) || {};
  if (!code.startsWith('functions/')) return null;
  const generico = !message || /^(internal|not[-_ ]found|unavailable)$/i.test(message.trim());
  if (code === 'functions/unavailable' || (generico && (code === 'functions/internal' || code === 'functions/not-found'))) {
    return 'Serviço de redefinição de senha indisponível. Verifique se as Cloud Functions foram publicadas (requer o plano Blaze do Firebase).';
  }
  return message;
}
