import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from '../../domain/entities/auditLog';

export class FirestoreAuditLogRepository {
  async registrarLog(logData: Omit<AuditLog, 'id'>): Promise<string> {
    const id = uuidv4();
    const log: AuditLog = {
      ...logData,
      id,
      dataHora: logData.dataHora || new Date().toISOString()
    };
    await setDoc(doc(db, 'audit_logs', id), log);
    return id;
  }

  subscribeLogs(callback: (logs: AuditLog[]) => void, maxCount = 100): () => void {
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('dataHora', 'desc'),
      limit(maxCount)
    );
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
    }, (error) => {
      console.warn('Fallback na ordenação de audit_logs:', error);
      // Caso o índice do Firestore ainda não esteja criado, faz snapshot simples
      return onSnapshot(collection(db, 'audit_logs'), (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
        list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
        callback(list.slice(0, maxCount));
      });
    });
  }
}
