import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Produto } from '../../domain/entities/produto';
import { IProdutosRepository } from '../../domain/repositories/IProdutosRepository';

export class FirestoreProdutosRepository implements IProdutosRepository {
  subscribeAll(callback: (produtos: Produto[]) => void): () => void {
    return onSnapshot(collection(db, 'produtos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto));
      callback(data.sort((a, b) => a.nome.localeCompare(b.nome)));
    });
  }

  async add(data: Omit<Produto, 'id'>): Promise<string> {
    const id = uuidv4();
    await setDoc(doc(db, 'produtos', id), { ...data, id });
    return id;
  }

  async update(id: string, data: Partial<Produto>): Promise<void> {
    await updateDoc(doc(db, 'produtos', id), data);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'produtos', id));
  }
}
