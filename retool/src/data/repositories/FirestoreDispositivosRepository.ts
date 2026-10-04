import { db } from '../datasources/firebase';
import { collection, doc, writeBatch, onSnapshot, setDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Dispositivo, CAMPOS_IMAGEM_DISPOSITIVO, chaveCodigoDispositivo } from '../../domain/entities/dispositivo';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';
import { storageService } from '../services/FirebaseStorageService';
import { IDispositivosRepository, OpcoesImportacaoLote, ResultadoImportacaoLote } from '../../domain/repositories/IDispositivosRepository';
import { importarLoteFirestore } from './importacaoDispositivosFirestore';

export class FirestoreDispositivosRepository implements IDispositivosRepository {
  subscribeAll(callback: (dispositivos: Dispositivo[]) => void): () => void {
    return onSnapshot(collection(db, 'dispositivos'), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispositivo)));
    });
  }

  async add(data: Omit<Dispositivo, 'id' | 'dataCriacao'> & { id?: string }): Promise<string> {
    const id = data.id || uuidv4();
    const newDevice = { ...data, id, dataCriacao: new Date().toISOString() };
    await setDoc(doc(db, 'dispositivos', id), newDevice);
    return id;
  }

  async update(id: string, data: Partial<Dispositivo>): Promise<void> {
    await updateDoc(doc(db, 'dispositivos', id), data);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'dispositivos', id));
    await storageService.deleteFolder(`retool/dispositivos/${id}`);
  }

  importarLote(
    novosDispositivos: Partial<Dispositivo>[],
    newCategoriasNomes: string[],
    newFamiliasNomes: string[],
    newProdutosNomes: string[],
    categoriasExistentes: Categoria[],
    familiasExistentes: Familia[],
    produtosExistentes: Produto[],
    opcoes?: OpcoesImportacaoLote
  ): Promise<ResultadoImportacaoLote> {
    return importarLoteFirestore(
      novosDispositivos, newCategoriasNomes, newFamiliasNomes, newProdutosNomes,
      categoriasExistentes, familiasExistentes, produtosExistentes, opcoes
    );
  }

  async excluirEmLote(ids: string[]): Promise<{ excluidos: number; erros: number; falhas: string[] }> {
    let excluidos = 0;
    let erros = 0;
    const falhas: string[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      const lote = ids.slice(i, i + 500);
      const batch = writeBatch(db);
      for (const id of lote) batch.delete(doc(db, 'dispositivos', id));
      try {
        await batch.commit();
        excluidos += lote.length;
      } catch (error) {
        erros += lote.length;
        falhas.push(error instanceof Error ? error.message : String(error));
        console.error('Falha ao excluir lote de dispositivos:', error);
      }
    }
    return { excluidos, erros, falhas };
  }
}
