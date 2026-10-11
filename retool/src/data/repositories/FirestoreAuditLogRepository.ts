import { db } from '../datasources/firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, limit, serverTimestamp, Timestamp, WriteBatch } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from '../../domain/entities/auditLog';

type AuditLogInput = Omit<AuditLog, 'id' | 'dataHora' | 'dataHoraServidor'> & { dataHora?: string };

/** Converte um valor vindo do Firestore (Timestamp ou ISO legado) em string ISO. */
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
   *
   * `dataHora` é gravada como string ISO para manter ordenação cronológica
   * homogênea com o acervo legado (o Firestore ordena por tipo antes do
   * valor: misturar Timestamp e string em `orderBy` esconde os registros
   * novos fora da janela do `limit`).
   *
   * `dataHoraServidor` recebe o carimbo nativo do servidor (serverTimestamp),
   * que permanece como a fonte autoritativa/imutável do momento da operação.
   */
  async registrarLog(logData: AuditLogInput): Promise<string> {
    const id = uuidv4();
    await setDoc(doc(db, 'audit_logs', id), {
      ...logData,
      id,
      dataHora: logData.dataHora || new Date().toISOString(),
      dataHoraServidor: serverTimestamp()
    });
    return id;
  }

  /**
   * Acrescenta um registro de auditoria a um writeBatch (operações em massa:
   * cada item continua com seu próprio registro, gravado junto com a alteração).
   */
  adicionarAoBatch(batch: WriteBatch, logData: AuditLogInput): void {
    const id = uuidv4();
    batch.set(doc(db, 'audit_logs', id), {
      ...logData,
      id,
      dataHora: logData.dataHora || new Date().toISOString(),
      dataHoraServidor: serverTimestamp()
    });
  }

  /** Assinatura em tempo real, sempre do registro mais recente para o mais antigo. */
  subscribeLogs(callback: (logs: AuditLog[]) => void, maxCount = 100, onError?: (e: unknown) => void): () => void {
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('dataHora', 'desc'),
      limit(maxCount)
    );

    const emitir = (snap: { docs: { id: string; data: () => any }[] }) => {
      const list = snap.docs.map(d => {
        const dados = d.data();
        return {
          ...(dados as Omit<AuditLog, 'id' | 'dataHora'>),
          id: d.id,
          // Exibe o carimbo do servidor quando existir; senão o campo legado.
          dataHora: dados.dataHoraServidor
            ? normalizarDataHora(dados.dataHoraServidor)
            : normalizarDataHora(dados.dataHora)
        };
      }) as AuditLog[];
      // Reordenação defensiva contra qualquer resíduo de tipos mistos.
      list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      callback(list.slice(0, maxCount));
    };

    // Sem fallback para a coleção inteira: a trilha cresce sem limite e o
    // listener de fallback nunca era encerrado. A ordenação usa o índice
    // automático de campo único (dataHora), que sempre existe.
    return onSnapshot(q, emitir, (error) => {
      console.warn('Falha ao carregar audit_logs:', error);
      onError?.(error);
    });
  }
}
