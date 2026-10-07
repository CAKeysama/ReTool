import { db } from '../datasources/firebase';
import {
  collection, onSnapshot, doc, setDoc, query, orderBy, limit, where, startAfter,
  getDocs, getCountFromServer, serverTimestamp, Timestamp, QueryConstraint
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditLog, AuditLogAcao, AuditLogCategoria, AuditLogTipoEntidade,
  ACOES_POR_CATEGORIA, categoriaDaAcao, sanitizarDadosAuditoria
} from '../../domain/entities/auditLog';
import { AuditLogInput, IAuditLogRepository } from '../../domain/repositories/IAcessosRepositories';

/** Converte um valor vindo do Firestore (Timestamp ou ISO legado) em string ISO. */
function normalizarDataHora(raw: any): string {
  if (raw instanceof Timestamp) return raw.toDate().toISOString();
  if (raw && typeof raw === 'object' && typeof raw.toDate === 'function') {
    try { return raw.toDate().toISOString(); } catch { /* ignore */ }
  }
  return typeof raw === 'string' ? raw : new Date().toISOString();
}

/** Documento do Firestore -> AuditLog (normaliza carimbos e campos do acervo legado). */
function mapearLog(d: { id: string; data: () => any }): AuditLog {
  const dados = d.data();
  return {
    ...(dados as Omit<AuditLog, 'id' | 'dataHora'>),
    id: d.id,
    // Exibe o carimbo do servidor quando existir; senão o campo legado.
    dataHora: dados.dataHoraServidor
      ? normalizarDataHora(dados.dataHoraServidor)
      : normalizarDataHora(dados.dataHora),
    categoria: dados.categoria || categoriaDaAcao(dados.acao),
    resultado: dados.resultado || 'sucesso'
  };
}

export interface FiltrosAuditoria {
  categoria?: AuditLogCategoria;
  acao?: AuditLogAcao;
  usuarioUid?: string;
  tipoEntidade?: AuditLogTipoEntidade;
  /** Somente operações com falha ou acesso negado. */
  somenteFalhas?: boolean;
  /** Limites do período (ISO, inclusivos). */
  de?: string;
  ate?: string;
}

export interface PaginaAuditoria {
  logs: AuditLog[];
  /** Cursor opaco para a próxima página (último documento lido). */
  cursor: unknown | null;
  temMais: boolean;
}

function restricoesDosFiltros(f: FiltrosAuditoria): QueryConstraint[] {
  const r: QueryConstraint[] = [];
  if (f.acao) r.push(where('acao', '==', f.acao));
  else if (f.categoria) r.push(where('acao', 'in', ACOES_POR_CATEGORIA[f.categoria]));
  if (f.usuarioUid) r.push(where('usuarioUid', '==', f.usuarioUid));
  if (f.tipoEntidade) r.push(where('tipoEntidade', '==', f.tipoEntidade));
  if (f.somenteFalhas) r.push(where('resultado', 'in', ['falha', 'negado']));
  if (f.de) r.push(where('dataHora', '>=', f.de));
  if (f.ate) r.push(where('dataHora', '<=', f.ate));
  return r;
}

export class FirestoreAuditLogRepository implements IAuditLogRepository {
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
   *
   * Segredos (senhas, tokens, hashes) são removidos antes da gravação.
   */
  async registrarLog(logData: AuditLogInput): Promise<string> {
    const id = uuidv4();
    const { conteudo, dadosAnteriores, ...base } = logData;
    await setDoc(doc(db, 'audit_logs', id), sanitizarDadosAuditoria({
      ...base,
      ...(conteudo ? { conteudo } : {}),
      ...(dadosAnteriores ? { dadosAnteriores } : {}),
      id,
      categoria: logData.categoria || categoriaDaAcao(logData.acao),
      resultado: logData.resultado || 'sucesso',
      dataHora: logData.dataHora || new Date().toISOString(),
      dataHoraServidor: serverTimestamp()
    }));
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
      const list = snap.docs.map(mapearLog);
      // Reordenação defensiva contra qualquer resíduo de tipos mistos.
      list.sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
      callback(list.slice(0, maxCount));
    };

    return onSnapshot(q, emitir, (error) => {
      console.warn('Fallback na ordenação de audit_logs:', error);
      // Caso o índice do Firestore ainda não esteja criado, faz snapshot simples
      return onSnapshot(collection(db, 'audit_logs'), emitir);
    });
  }

  /**
   * Página do histórico completo (paginação por cursor no servidor), do mais
   * recente para o mais antigo. Filtros combinados exigem os índices
   * declarados em `firestore.indexes.json`.
   */
  async listarPagina(filtros: FiltrosAuditoria, tamanho: number, apos?: unknown): Promise<PaginaAuditoria> {
    const restricoes: QueryConstraint[] = [
      ...restricoesDosFiltros(filtros),
      orderBy('dataHora', 'desc'),
      ...(apos ? [startAfter(apos)] : []),
      limit(tamanho + 1)
    ];
    const snap = await getDocs(query(collection(db, 'audit_logs'), ...restricoes));
    const docs = snap.docs.slice(0, tamanho);
    return {
      logs: docs.map(mapearLog),
      cursor: docs.length > 0 ? docs[docs.length - 1] : null,
      temMais: snap.docs.length > tamanho
    };
  }

  /** Total de registros que atendem aos filtros (agregação no servidor). */
  async contar(filtros: FiltrosAuditoria): Promise<number> {
    const snap = await getCountFromServer(query(collection(db, 'audit_logs'), ...restricoesDosFiltros(filtros)));
    return snap.data().count;
  }
}
