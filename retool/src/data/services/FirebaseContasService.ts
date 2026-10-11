import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../datasources/firebase';

/**
 * Operações de conta feitas pelo próprio Firebase Authentication, sem
 * Cloud Functions (o projeto fica no plano gratuito).
 */
export class FirebaseContasService {
  /**
   * Envia o e-mail de redefinição de senha do Firebase. A pessoa define a
   * nova senha pelo link: ninguém mais a vê, e nada é gravado no Firestore.
   */
  async enviarEmailRedefinicaoSenha(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  }
}
