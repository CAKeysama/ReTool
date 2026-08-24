import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Reutilizacao } from '../../domain/entities/reutilizacao';
import { IReutilizacoesRepository } from '../../domain/repositories/IReutilizacoesRepository';

export class FirestoreReutilizacoesRepository implements IReutilizacoesRepository {
  subscribeAll(callback: (reutilizacoes: Reutilizacao[]) => void): () => void {
    return onSnapshot(collection(db, 'reutilizacoes'), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reutilizacao)));
    });
  }

  async add(data: Omit<Reutilizacao, 'id' | 'dataCriacao'>): Promise<string> {
    const id = uuidv4();
    const newReutil = { ...data, id, dataCriacao: new Date().toISOString() };
    await setDoc(doc(db, 'reutilizacoes', id), newReutil);
    return id;
  }

  async update(id: string, data: Partial<Reutilizacao>): Promise<void> {
    await updateDoc(doc(db, 'reutilizacoes', id), data);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'reutilizacoes', id));
  }
}
