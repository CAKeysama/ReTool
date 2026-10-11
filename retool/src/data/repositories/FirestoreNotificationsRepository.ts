import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, where, orderBy, limit } from 'firebase/firestore';

/** Notificações mais recentes carregadas por pessoa (antes: todas, a cada abertura do app). */
export const LIMITE_NOTIFICACOES = 50;
import { Notificacao } from '../../domain/entities/notificacao';

export class FirestoreNotificationsRepository {
  /** Criação idempotente (id determinístico) — nunca duplica. */
  async criar(notificacao: Notificacao): Promise<void> {
    await setDoc(doc(db, 'notifications', notificacao.id), notificacao);
  }

  async marcarLida(id: string, lida: boolean): Promise<void> {
    await updateDoc(doc(db, 'notifications', id), { lida });
  }

  async marcarResolvida(id: string, resolvida: boolean): Promise<void> {
    await updateDoc(doc(db, 'notifications', id), { resolvida });
  }

  subscribeParaUsuario(uid: string, callback: (notificacoes: Notificacao[]) => void): () => void {
    // Índice composto destinatarioUid + dataHora (firestore.indexes.json).
    const q = query(collection(db, 'notifications'), where('destinatarioUid', '==', uid), orderBy('dataHora', 'desc'), limit(LIMITE_NOTIFICACOES));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notificacao));
      list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      callback(list);
    }, () => {
      callback([]);
    });
  }
}
