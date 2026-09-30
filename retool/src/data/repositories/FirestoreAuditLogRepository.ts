import { db } from '../datasources/firebase';
import {
  collection, onSnapshot, doc, setDoc, query, orderBy, limit, where, startAfter,
  getDocs, getCountFromServer, serverTimestamp, Timestamp, QueryConstraint
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditLog, AuditLogAcao, AuditLogCategoria, AuditLogTipoEntidade,
  categoriaDaAcao, sanitizarDadosAuditoria
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

/**
 * Campos de igualdade filtráveis na tela de histórico, na ORDEM CANÔNICA em
 * que entram na consulta e nos índices compostos. É a fonte única da
 * verdade: `firestore.indexes.json` precisa de um índice para cada
 * combinação válida destes campos seguida de `dataHora DESC` (verificado em
 * teste). `categoria` e `acao` nunca aparecem juntos: a ação específica já
 * determina a categoria.
 */
export const CAMPOS_FILTRO_AUDITORIA = ['categoria', 'acao', 'usuarioUid', 'tipoEntidade', 'resultado'] as const;
export type CampoFiltroAuditoria = typeof CAMPOS_FILTRO_AUDITORIA[number];

/**
 * Filtros de igualdade de cada campo, conforme os filtros da tela.
 *
 * A categoria é filtrada pelo campo `categoria` gravado em todo registro, e
 * não por `acao in [...]`: o Firestore expande cada `in` em sub-consultas e
 * multiplica as expansões (10 ações × 2 resultados = 20), estourando o
 * limite de filtros por consulta. Assim o único `in` é o de resultado
 * (no máximo 2 sub-consultas). Registros anteriores ao campo `categoria`
 * seguem acessíveis sem filtro de categoria ou pelo filtro de ação.
 */
function filtrosDeIgualdade(f: FiltrosAuditoria): Partial<Record<CampoFiltroAuditoria, QueryConstraint>> {
  return {
    ...(f.acao
      ? { acao: where('acao', '==', f.acao) }
      : f.categoria ? { categoria: where('categoria', '==', f.categoria) } : {}),
    ...(f.usuarioUid ? { usuarioUid: where('usuarioUid', '==', f.usuarioUid) } : {}),
    ...(f.tipoEntidade ? { tipoEntidade: where('tipoEntidade', '==', f.tipoEntidade) } : {}),
    ...(f.somenteFalhas ? { resultado: where('resultado', 'in', ['falha', 'negado']) } : {}),
  };
}

/** Campos de igualdade usados por um conjunto de filtros (ordem canônica). */
export function camposFiltradosAuditoria(f: FiltrosAuditoria): CampoFiltroAuditoria[] {
  const usados = filtrosDeIgualdade(f);
  return CAMPOS_FILTRO_AUDITORIA.filter(c => usados[c]);
}

function restricoesDosFiltros(f: FiltrosAuditoria): QueryConstraint[] {
  const usados = filtrosDeIgualdade(f);
  return [
    ...CAMPOS_FILTRO_AUDITORIA.flatMap(c => (usados[c] ? [usados[c]!] : [])),
    // O período filtra o mesmo campo da ordenação: cabe em qualquer índice abaixo.
    ...(f.de ? [where('dataHora', '>=', f.de)] : []),
    ...(f.ate ? [where('dataHora', '<=', f.ate)] : []),
  ];
}

export interface IndiceComposto {
  collectionGroup: string;
  queryScope: 'COLLECTION';
  fields: { fieldPath: string; order: 'ASCENDING' | 'DESCENDING' }[];
}

/**
 * Índices compostos exigidos pelas consultas do histórico: um por combinação
 * não vazia dos campos de igualdade (sem `categoria` e `acao` juntos) +
 * `dataHora DESC` (ordenação e período). O Firestore só funde índices em
 * consultas apenas de igualdade; com o filtro de período isso não se aplica,
 * então cada combinação precisa do seu índice. Sem filtros de igualdade, o
 * índice automático de campo único de `dataHora` basta.
 */
export function indicesNecessariosAuditoria(): IndiceComposto[] {
  const combinacoes: CampoFiltroAuditoria[][] = [];
  for (let mascara = 1; mascara < 1 << CAMPOS_FILTRO_AUDITORIA.length; mascara++) {
    const campos = CAMPOS_FILTRO_AUDITORIA.filter((_, i) => mascara & (1 << i));
    if (campos.includes('categoria') && campos.includes('acao')) continue;
    combinacoes.push(campos);
  }
  combinacoes.sort((a, b) => a.length - b.length);
  return combinacoes.map(campos => ({
    collectionGroup: 'audit_logs',
    queryScope: 'COLLECTION',
    fields: [
      ...campos.map(fieldPath => ({ fieldPath, order: 'ASCENDING' as const })),
      { fieldPath: 'dataHora', order: 'DESCENDING' as const }
    ]
  }));
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

  /** Projeto Firebase consultado (informado nas mensagens de índice ausente). */
  get projetoId(): string | undefined {
    return (db as { app?: { options?: { projectId?: string } } })?.app?.options?.projectId;
  }

  /**
   * Página do histórico completo (paginação por cursor no servidor), do mais
   * recente para o mais antigo. Filtros combinados usam os índices de
   * `indicesNecessariosAuditoria()`, declarados em `firestore.indexes.json`.
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
