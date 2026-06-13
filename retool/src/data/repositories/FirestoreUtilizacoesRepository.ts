import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Utilizacao } from '../../domain/entities/utilizacao';
import { IUtilizacoesRepository } from '../../domain/repositories/IUtilizacoesRepository';

export class FirestoreUtilizacoesRepository implements IUtilizacoesRepository {
  subscribeAll(callback: (utilizacoes: Utilizacao[]) => void): () => void {
    return onSnapshot(collection(db, 'utilizacoes'), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Utilizacao)));
    });
  }

  async add(data: Omit<Utilizacao, 'id' | 'dataCriacao'>): Promise<string> {
    const id = uuidv4();
    const newUtil = { ...data, id, dataCriacao: new Date().toISOString() };
    await setDoc(doc(db, 'utilizacoes', id), newUtil);
    return id;
  }

  async update(id: string, data: Partial<Utilizacao>): Promise<void> {
    await updateDoc(doc(db, 'utilizacoes', id), data);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'utilizacoes', id));
  }
}
