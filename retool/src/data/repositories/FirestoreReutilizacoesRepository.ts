import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, documentId, getCountFromServer } from 'firebase/firestore';
import { medirConsulta, registrarConsulta } from '../observabilidade/metricas';
import { v4 as uuidv4 } from 'uuid';
import { Reutilizacao, normalizarStatusReutilizacao } from '../../domain/entities/reutilizacao';
import { IReutilizacoesRepository } from '../../domain/repositories/IReutilizacoesRepository';

const normalizar = (d: { id: string; data: () => Record<string, unknown> }): Reutilizacao => {
  const item = { id: d.id, ...d.data() } as Reutilizacao;
  return { ...item, status: normalizarStatusReutilizacao(item.status) };
};

export class FirestoreReutilizacoesRepository implements IReutilizacoesRepository {
  /**
   * Coleção inteira em tempo real. Usada só pela tela de Reutilizações
   * (filas de trabalho), enquanto ela estiver aberta; a coleção é pequena
   * (registros manuais). Ver PERFORMANCE.md para o limite de revisão.
   */
  subscribeAll(callback: (reutilizacoes: Reutilizacao[]) => void, onError?: (e: unknown) => void): () => void {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    let primeira = true;
    return onSnapshot(collection(db, 'reutilizacoes'), (snapshot) => {
      if (primeira && typeof performance !== 'undefined') { registrarConsulta('reutilizacoes:todas', snapshot.docs.length, performance.now() - t0); primeira = false; }
      callback(snapshot.docs.map(normalizar));
    }, (e) => {
      registrarConsulta('reutilizacoes:todas', 0, 0, e);
      onError?.(e);
    });
  }

  /** Reutilizações de um dispositivo em tempo real (tela de detalhes). */
  subscribeDoDispositivo(dispositivoId: string, callback: (r: Reutilizacao[]) => void, onError?: (e: unknown) => void): () => void {
    const q = query(collection(db, 'reutilizacoes'), where('dispositivoId', '==', dispositivoId));
    return onSnapshot(q, s => callback(s.docs.map(normalizar)), e => onError?.(e));
  }

  async listarDoDispositivo(dispositivoId: string): Promise<Reutilizacao[]> {
    const q = query(collection(db, 'reutilizacoes'), where('dispositivoId', '==', dispositivoId));
    const s = await medirConsulta('reutilizacoes:do-dispositivo', () => getDocs(q), r => r.docs.length);
    return s.docs.map(normalizar);
  }

  /** Reutilizações que referenciam qualquer um dos dispositivos (blocos de 30). */
  async listarDosDispositivos(dispositivoIds: string[]): Promise<Reutilizacao[]> {
    const out: Reutilizacao[] = [];
    for (let i = 0; i < dispositivoIds.length; i += 30) {
      const q = query(collection(db, 'reutilizacoes'), where('dispositivoId', 'in', dispositivoIds.slice(i, i + 30)));
      const s = await medirConsulta('reutilizacoes:dos-dispositivos', () => getDocs(q), r => r.docs.length);
      out.push(...s.docs.map(normalizar));
    }
    return out;
  }

  async obter(id: string): Promise<Reutilizacao | null> {
    const s = await medirConsulta('reutilizacoes:get', () => getDoc(doc(db, 'reutilizacoes', id)), () => 1);
    return s.exists() ? normalizar(s) : null;
  }

  async obterPorIds(ids: string[]): Promise<Reutilizacao[]> {
    const unicos = Array.from(new Set(ids.filter(Boolean)));
    const out: Reutilizacao[] = [];
    for (let i = 0; i < unicos.length; i += 30) {
      const q = query(collection(db, 'reutilizacoes'), where(documentId(), 'in', unicos.slice(i, i + 30)));
      const s = await medirConsulta('reutilizacoes:por-ids', () => getDocs(q), r => r.docs.length);
      out.push(...s.docs.map(normalizar));
    }
    return out;
  }

  /** Total sem baixar documentos (count no servidor). */
  async contar(): Promise<number> {
    const s = await medirConsulta('reutilizacoes:count', () => getCountFromServer(collection(db, 'reutilizacoes')), () => 0);
    return s.data().count;
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
