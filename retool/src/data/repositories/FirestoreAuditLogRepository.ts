import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from '../../domain/entities/auditLog';

type AuditLogInput = Omit<AuditLog, 'id' | 'dataHora'> & { dataHora?: string };

/** Converte o campo dataHora vindo do Firestore (Timestamp ou ISO legado) em string ISO. */
function normalizarDataHora(raw: any): string {
  if (raw instanceof Timestamp) return raw.toDate().toISOString();
  if (raw && typeof raw === 'object' && typeof raw.toDate === 'function') {
    try { return raw.toDate().toISOString(); } catch { /* ignore */ }
  }
  return typeof raw === 'string' ? raw : new Date().toISOString();
}

export class FirestoreAuditLogRepository {
  /**
   * Insere um registro de auditoria (equivalente à query `insert_log`).
   * O momento exato da operação é carimbado pelo próprio servidor
   * (serverTimestamp), evitando adulteração ou dessincronização de relógio.
   */
  async registrarLog(logData: AuditLogInput): Promise<string> {
    const id = uuidv4();
    await setDoc(doc(db, 'audit_logs', id), {
      ...logData,
      id,
      dataHora: serverTimestamp()
    });
    return id;
  }

  /** Assinatura em tempo real, sempre do registro mais recente para o mais antigo. */
  subscribeLogs(callback: (logs: AuditLog[]) => void, maxCount = 100): () => void {
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('dataHora', 'desc'),
      limit(maxCount)
    );

    const emitir = (snap: { docs: { id: string; data: () => any }[] }) => {
      const list = snap.docs.map(d => ({
        ...(d.data() as Omit<AuditLog, 'id' | 'dataHora'>),
        id: d.id,
        dataHora: normalizarDataHora(d.data().dataHora)
      })) as AuditLog[];
      // Reordenação defensiva: mistura de Timestamps novos com ISOs legados.
      list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      callback(list.slice(0, maxCount));
    };

    return onSnapshot(q, emitir, (error) => {
      console.warn('Fallback na ordenação de audit_logs:', error);
      // Caso o índice do Firestore ainda não esteja criado, faz snapshot simples
      return onSnapshot(collection(db, 'audit_logs'), emitir);
    });
  }
}
