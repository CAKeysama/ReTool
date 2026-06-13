import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Categoria, Tipo } from '../../domain/entities/categoria';
import { ICategoriasRepository } from '../../domain/repositories/ICategoriasRepository';

export class FirestoreCategoriasRepository implements ICategoriasRepository {
  subscribeCategorias(callback: (categorias: Categoria[]) => void): () => void {
    return onSnapshot(collection(db, 'categorias'), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Categoria)));
    });
  }

  subscribeTipos(callback: (tipos: Tipo[]) => void): () => void {
    return onSnapshot(collection(db, 'tipos'), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tipo)));
    });
  }

  async addCategoria(data: Omit<Categoria, 'id'>): Promise<string> {
    const id = uuidv4();
    await setDoc(doc(db, 'categorias', id), { ...data, id });
    return id;
  }

  async updateCategoria(id: string, data: Partial<Categoria>): Promise<void> {
    await updateDoc(doc(db, 'categorias', id), data);
  }

  async deleteCategoria(id: string): Promise<void> {
    await deleteDoc(doc(db, 'categorias', id));
  }

  async addTipo(data: Omit<Tipo, 'id'>): Promise<string> {
    const id = uuidv4();
    await setDoc(doc(db, 'tipos', id), { ...data, id });
    return id;
  }

  async updateTipo(id: string, data: Partial<Tipo>): Promise<void> {
    await updateDoc(doc(db, 'tipos', id), data);
  }

  async deleteTipo(id: string): Promise<void> {
    await deleteDoc(doc(db, 'tipos', id));
  }
}
