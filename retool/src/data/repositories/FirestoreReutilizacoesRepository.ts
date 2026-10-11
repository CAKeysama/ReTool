import { db } from '../datasources/firebase';
import {
  collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, documentId, getCountFromServer,
  orderBy, limit, startAfter, writeBatch, Query, QueryConstraint, QueryDocumentSnapshot
} from 'firebase/firestore';
import { medirConsulta, registrarConsulta } from '../observabilidade/metricas';
import { v4 as uuidv4 } from 'uuid';
import { comTimeout, MENSAGEM_GRAVACAO_SEM_RESPOSTA } from '../../utils/tempo';
import { Reutilizacao, ReutilizacaoStatus, REUTILIZACAO_STATUS, normalizarStatusReutilizacao } from '../../domain/entities/reutilizacao';
import { ContagensProntidao, PlanoNormalizacao, emLotes } from '../../domain/services/consultaReutilizacoes';
import { IReutilizacoesRepository } from '../../domain/repositories/IReutilizacoesRepository';

/** Filtros do histórico aplicados no servidor (ver firestore.indexes.json). */
export interface FiltrosHistoricoReutilizacoes {
  status?: ReutilizacaoStatus;
  dispositivoId?: string;
}

/** Página do histórico (ou janela de uma fila): itens, se há mais e o cursor da próxima. */
export interface PaginaReutilizacoes {
  itens: Reutilizacao[];
  temMais: boolean;
  /** Último documento da página (startAfter da próxima). */
  cursor: QueryDocumentSnapshot | null;
  doCache: boolean;
  /** O servidor avisou inclusão/remoção (o total contado pode ter mudado). */
  mudouComposicao: boolean;
}

const filtrosHistorico = (f: FiltrosHistoricoReutilizacoes): QueryConstraint[] => [
  ...(f.status ? [where('status', '==', f.status)] : []),
  ...(f.dispositivoId ? [where('dispositivoId', '==', f.dispositivoId)] : []),
];

const normalizar = (d: { id: string; data: () => Record<string, unknown> }): Reutilizacao => {
  const item = { id: d.id, ...d.data() } as Reutilizacao;
  return { ...item, status: normalizarStatusReutilizacao(item.status) };
};

export class FirestoreReutilizacoesRepository implements IReutilizacoesRepository {
  /**
   * Coleção inteira em tempo real (1 leitura por documento). A tela de
   * Reutilizações só a usa no modo legado (acervo ainda não normalizado) ou
   * por ação explícita (buscar texto em todo o histórico, ações em massa).
   */
  subscribeAll(callback: (reutilizacoes: Reutilizacao[], doCache: boolean) => void, onError?: (e: unknown) => void): () => void {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    let primeira = true;
    // Com metadados: o app sabe quando a lista veio só do cache local (sem
    // conexão) e não a mostra como "sem pendências".
    return onSnapshot(collection(db, 'reutilizacoes'), { includeMetadataChanges: true }, (snapshot) => {
      if (primeira && !snapshot.metadata.fromCache && typeof performance !== 'undefined') { registrarConsulta('reutilizacoes:todas', snapshot.docs.length, performance.now() - t0); primeira = false; }
      callback(snapshot.docs.map(normalizar), snapshot.metadata.fromCache);
    }, (e) => {
      registrarConsulta('reutilizacoes:todas', 0, 0, e);
      onError?.(e);
    });
  }

  /** Reutilizações de um dispositivo em tempo real (tela de detalhes). */
  subscribeDoDispositivo(dispositivoId: string, callback: (r: Reutilizacao[], doCache: boolean) => void, onError?: (e: unknown) => void): () => void {
    const q = query(collection(db, 'reutilizacoes'), where('dispositivoId', '==', dispositivoId));
    return onSnapshot(q, { includeMetadataChanges: true }, s => callback(s.docs.map(normalizar), s.metadata.fromCache), e => onError?.(e));
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

  /**
   * Contagens que dizem se o acervo pode ser consultado no servidor
   * (3 count(), ~1 leitura por 1.000 documentos cada). `dataCriacao > ''`
   * só conta strings não vazias: Timestamp, número ou campo ausente ficam
   * de fora, como ficariam de um orderBy('dataCriacao') sobre strings.
   */
  async contarProntidao(): Promise<ContagensProntidao> {
    const col = collection(db, 'reutilizacoes');
    const contar = (nome: string, q: Parameters<typeof getCountFromServer>[0]) =>
      medirConsulta(nome, () => getCountFromServer(q), () => 0).then(s => s.data().count);
    const [total, comStatusCanonico, comDataCriacao] = await Promise.all([
      contar('reutilizacoes:count', col),
      contar('reutilizacoes:count-status', query(col, where('status', 'in', REUTILIZACAO_STATUS))),
      contar('reutilizacoes:count-data', query(col, where('dataCriacao', '>', ''))),
    ]);
    return { total, comStatusCanonico, comDataCriacao };
  }

  /**
   * Fila (reutilizações nos status informados), mais recentes primeiro, até
   * `limite` itens em tempo real (lê limite+1 para saber se há mais). A Fila
   * da Engenharia inclui as aprovadas, que crescem sem parar: sem o limite
   * ela seria quase a coleção inteira. Usa o índice (status, dataCriacao desc).
   */
  subscribeFila(
    status: ReutilizacaoStatus[],
    limite: number,
    callback: (p: PaginaReutilizacoes) => void,
    onError?: (e: unknown) => void
  ): () => void {
    const nome = 'reutilizacoes:fila';
    const q = query(collection(db, 'reutilizacoes'), where('status', 'in', status), orderBy('dataCriacao', 'desc'), limit(limite + 1));
    return this.assinarPagina(nome, q, limite, callback, onError);
  }

  /** Tamanho de uma fila (count no servidor, ~1 leitura). */
  async contarPorStatus(status: ReutilizacaoStatus[]): Promise<number> {
    const q = query(collection(db, 'reutilizacoes'), where('status', 'in', status));
    const s = await medirConsulta('reutilizacoes:count-fila', () => getCountFromServer(q), () => 0);
    return s.data().count;
  }

  /**
   * Uma página do histórico em tempo real: mais recentes primeiro, `tamanho`
   * itens a partir do cursor. Lê tamanho+1 para saber se há próxima página
   * sem contar a coleção. Status e dispositivo filtram no servidor.
   */
  subscribePaginaHistorico(
    filtros: FiltrosHistoricoReutilizacoes,
    cursor: QueryDocumentSnapshot | null,
    tamanho: number,
    callback: (p: PaginaReutilizacoes) => void,
    onError?: (e: unknown) => void
  ): () => void {
    const q = query(
      collection(db, 'reutilizacoes'),
      ...filtrosHistorico(filtros),
      orderBy('dataCriacao', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(tamanho + 1)
    );
    return this.assinarPagina('reutilizacoes:historico', q, tamanho, callback, onError);
  }

  /** Listener de uma consulta com limit(tamanho+1): entrega até `tamanho` itens e se há mais. */
  private assinarPagina(
    nome: string,
    q: Query,
    tamanho: number,
    callback: (p: PaginaReutilizacoes) => void,
    onError?: (e: unknown) => void
  ): () => void {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    let primeira = true;
    return onSnapshot(q, { includeMetadataChanges: true }, s => {
      const servidor = !s.metadata.fromCache;
      if (primeira && servidor && typeof performance !== 'undefined') registrarConsulta(nome, s.docs.length, performance.now() - t0);
      const docs = s.docs.slice(0, tamanho);
      const mudouComposicao = !primeira && servidor && s.docChanges().some(c => c.type !== 'modified');
      if (servidor) primeira = false;
      callback({
        itens: docs.map(normalizar),
        temMais: s.docs.length > tamanho,
        cursor: docs.length ? docs[docs.length - 1] : null,
        doCache: s.metadata.fromCache,
        mudouComposicao,
      });
    }, e => { registrarConsulta(nome, 0, 0, e); onError?.(e); });
  }

  /** Total do histórico com os mesmos filtros da página (count no servidor). */
  async contarHistorico(filtros: FiltrosHistoricoReutilizacoes): Promise<number> {
    const q = query(collection(db, 'reutilizacoes'), ...filtrosHistorico(filtros));
    const s = await medirConsulta('reutilizacoes:count-historico', () => getCountFromServer(q), () => 0);
    return s.data().count;
  }

  /** Documentos crus (sem normalizar), para planejar a normalização do acervo. */
  async listarDocumentosCrus(): Promise<{ id: string; dados: Record<string, unknown> }[]> {
    const s = await medirConsulta('reutilizacoes:crus', () => getDocs(collection(db, 'reutilizacoes')), r => r.docs.length);
    return s.docs.map(d => ({ id: d.id, dados: d.data() as Record<string, unknown> }));
  }

  /**
   * Grava o plano de normalização em lotes de até 500 (writeBatch). Só os
   * campos do plano mudam; um lote que falha interrompe (os anteriores ficam
   * gravados e a normalização pode ser repetida: o plano é refeito do zero).
   */
  async aplicarNormalizacao(
    plano: PlanoNormalizacao,
    onProgresso?: (feitos: number, total: number) => void,
    prazoPorLoteMs = 60_000
  ): Promise<void> {
    let feitos = 0;
    const total = plano.itens.length;
    onProgresso?.(0, total);
    for (const lote of emLotes(plano.itens, 500)) {
      const b = writeBatch(db);
      for (const it of lote) b.update(doc(db, 'reutilizacoes', it.id), { ...it.alteracoes });
      // Sem resposta no prazo: para (o lote pode ser gravado quando a conexão voltar).
      await comTimeout(b.commit(), prazoPorLoteMs, MENSAGEM_GRAVACAO_SEM_RESPOSTA);
      feitos += lote.length;
      onProgresso?.(feitos, total);
    }
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
