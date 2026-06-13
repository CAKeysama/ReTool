import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Familia } from '../../domain/entities/familia';
import { IFamiliasRepository } from '../../domain/repositories/IFamiliasRepository';

export class FirestoreFamiliasRepository implements IFamiliasRepository {
  subscribeAll(callback: (familias: Familia[]) => void): () => void {
    return onSnapshot(collection(db, 'familias'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Familia));
      callback(data.sort((a, b) => a.nome.localeCompare(b.nome)));
    });
  }

  async add(data: Omit<Familia, 'id'>): Promise<string> {
    const id = uuidv4();
    await setDoc(doc(db, 'familias', id), { ...data, id });
    return id;
  }

  async update(id: string, data: Partial<Familia>): Promise<void> {
    await updateDoc(doc(db, 'familias', id), data);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'familias', id));
  }
}
