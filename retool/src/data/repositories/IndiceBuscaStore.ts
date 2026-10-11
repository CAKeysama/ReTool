import { EntradaIndice, MAX_PARTES, bytesDoItem, desserializarEntrada, parteDoId } from '../../domain/services/buscaDispositivos';
import { MetaIndice, assinarMetaIndice, lerParteIndice } from './FirestoreIndiceDispositivos';
import { lerCache, gravarCache } from '../cache/cacheLocal';
import { registrarConsulta } from '../observabilidade/metricas';
import { db } from '../datasources/firebase';

/**
 * Estado do catálogo de busca no navegador (singleton).
 *
 * Começa só quando alguma tela precisa de busca, assina 1 documento (meta)
 * e baixa apenas as partes cuja versão mudou; as demais vêm do IndexedDB.
 * Quando nenhuma tela usa a busca por 30 s, o acompanhamento para (os dados
 * ficam em memória): gravações de outras pessoas não custam leituras a quem
 * não está buscando. Ao voltar, só as partes alteradas são baixadas.
 */
export type EstadoIndice = 'inativo' | 'carregando' | 'pronto' | 'ausente' | 'erro';

export interface SnapshotIndice {
  estado: EstadoIndice;
  /** Entradas ordenadas pelo id do documento (mesma ordem da coleção). */
  entradas: EntradaIndice[];
  meta: MetaIndice | null;
  progresso: { partes: number; total: number } | null;
  erro: string | null;
  /** Incrementa a cada atualização de dados (para memoização nos hooks). */
  revisao: number;
  /**
   * Tamanho estimado (bytes) da maior parte carregada. Cada documento do
   * Firestore aceita até 1 MiB e as partes só são redivididas quando o
   * catálogo é reconstruído: perto do limite, gravar dispositivos daquela
   * parte falharia. A tela sugere "Atualizar índice" bem antes disso.
   */
  maiorParteBytes: number;
}

type Ouvinte = (s: SnapshotIndice) => void;

interface ParteCache { v: number; itens: Record<string, string> }

// A chave inclui o projeto para nunca misturar o banco principal com o reserva.
const ESPERA_PARA_PARAR_MS = 30_000;
const FATIA_MONTAGEM = 2000;
const ceder = () => new Promise<void>(r => setTimeout(r, 0));

const chaveCache = (n: number) => `indice:${(db as { app?: { options?: { projectId?: string } } })?.app?.options?.projectId || 'retool'}:${n}`;

class IndiceBusca {
  private snap: SnapshotIndice = { estado: 'inativo', entradas: [], meta: null, progresso: null, erro: null, revisao: 0, maiorParteBytes: 0 };
  private ouvintes = new Set<Ouvinte>();
  private pararMeta: (() => void) | null = null;
  private partes = new Map<number, ParteCache>();
  private fila: Promise<void> = Promise.resolve();
  private usuarios = 0;
  private timerParar: ReturnType<typeof setTimeout> | null = null;
  /** Meta mais recente ainda não processada (várias mudanças seguidas = uma sincronização). */
  private metaPendente: { meta: MetaIndice | null } | null = null;

  obter(): SnapshotIndice {
    return this.snap;
  }

  assinar(o: Ouvinte): () => void {
    this.ouvintes.add(o);
    return () => this.ouvintes.delete(o);
  }

  private emitir(parcial: Partial<SnapshotIndice>) {
    this.snap = { ...this.snap, ...parcial };
    for (const o of this.ouvintes) o(this.snap);
  }

  /** true enquanto a meta está sendo acompanhada em tempo real (meta em memória é a atual). */
  acompanhando(): boolean {
    return !!this.pararMeta;
  }

  /** Uma tela passou a precisar da busca (pareie com `liberar`). */
  usar(): void {
    this.usuarios++;
    if (this.timerParar) { clearTimeout(this.timerParar); this.timerParar = null; }
    this.iniciar();
  }

  /** A tela não precisa mais da busca; para de acompanhar depois de um tempo sem uso. */
  liberar(): void {
    this.usuarios = Math.max(0, this.usuarios - 1);
    if (this.usuarios > 0 || this.timerParar) return;
    this.timerParar = setTimeout(() => {
      this.timerParar = null;
      if (this.usuarios === 0) this.pausar();
    }, ESPERA_PARA_PARAR_MS);
  }

  /** Para o listener e mantém os dados (retomado por `usar`). */
  private pausar(): void {
    this.pararMeta?.();
    this.pararMeta = null;
  }

  /** Começa a acompanhar o catálogo (idempotente). */
  iniciar(): void {
    if (this.pararMeta) return;
    this.emitir({ estado: this.snap.entradas.length ? this.snap.estado : 'carregando', erro: null });
    this.pararMeta = assinarMetaIndice(
      meta => {
        const jaAgendado = !!this.metaPendente;
        this.metaPendente = { meta };
        if (jaAgendado) return;
        this.fila = this.fila
          .then(() => {
            const p = this.metaPendente;
            this.metaPendente = null;
            return p ? this.sincronizar(p.meta) : undefined;
          })
          .catch(() => undefined);
      },
      e => {
        this.pararMeta = null;
        this.emitir({ estado: this.snap.entradas.length ? 'pronto' : 'erro', erro: String((e as { code?: string })?.code || e) });
      }
    );
  }

  /**
   * Espera o catálogo em memória ficar igual à `meta` informada (lida do
   * servidor agora). Devolve as entradas, ou null se não convergir a tempo.
   * Quem chama deve ter chamado `usar()` antes.
   */
  aguardarSincronizado(meta: MetaIndice, timeoutMs = 60_000): Promise<EntradaIndice[] | null> {
    const igual = (s: SnapshotIndice) => s.estado === 'pronto' && !!s.meta && s.meta.geracao === meta.geracao
      && s.meta.partes === meta.partes
      && Object.keys(meta.versoes || {}).every(k => (s.meta!.versoes?.[k] ?? 0) >= (meta.versoes[k] ?? 0));
    if (igual(this.snap)) return Promise.resolve(this.snap.entradas);
    return new Promise(resolve => {
      const t = setTimeout(() => { parar(); resolve(null); }, timeoutMs);
      const parar = this.assinar(s => {
        if (igual(s)) { clearTimeout(t); parar(); resolve(s.entradas); }
        else if (s.estado === 'erro' || s.estado === 'ausente') { clearTimeout(t); parar(); resolve(null); }
      });
    });
  }

  /** Para de acompanhar e esquece tudo (logout). */
  parar(): void {
    this.pararMeta?.();
    this.pararMeta = null;
    if (this.timerParar) { clearTimeout(this.timerParar); this.timerParar = null; }
    this.metaPendente = null;
    this.partes.clear();
    this.snap = { estado: 'inativo', entradas: [], meta: null, progresso: null, erro: null, revisao: this.snap.revisao + 1, maiorParteBytes: 0 };
    for (const o of this.ouvintes) o(this.snap);
  }

  /** Tenta de novo depois de um erro. */
  reiniciar(): void {
    this.pararMeta?.();
    this.pararMeta = null;
    this.iniciar();
  }

  private async sincronizar(meta: MetaIndice | null): Promise<void> {
    if (!meta) {
      this.partes.clear();
      this.emitir({ estado: 'ausente', meta: null, entradas: [], progresso: null, revisao: this.snap.revisao + 1 });
      return;
    }
    if (!Number.isInteger(meta.partes) || meta.partes < 1 || meta.partes > MAX_PARTES || !(meta.total >= 0)) {
      this.emitir({ estado: this.snap.entradas.length ? 'pronto' : 'erro', erro: 'indice-invalido' });
      return;
    }
    const t0 = performance.now();
    try {
      const pendentes: number[] = [];
      for (let n = 0; n < meta.partes; n++) {
        const v = meta.versoes?.[String(n)] ?? 0;
        const emMemoria = this.partes.get(n);
        if (emMemoria && emMemoria.v === v) continue;
        const local = await lerCache<ParteCache>(chaveCache(n));
        if (local && local.v === v) { this.partes.set(n, local); continue; }
        pendentes.push(n);
      }
      for (const n of Array.from(this.partes.keys())) if (n >= meta.partes) this.partes.delete(n);

      if (pendentes.length) {
        let feitas = 0;
        if (!this.snap.entradas.length) this.emitir({ estado: 'carregando', progresso: { partes: 0, total: pendentes.length } });
        // 3 partes por vez: rápido sem abrir dezenas de requisições simultâneas.
        for (let i = 0; i < pendentes.length; i += 3) {
          await Promise.all(pendentes.slice(i, i + 3).map(async n => {
            const itens = await lerParteIndice(n);
            const parte = { v: meta.versoes?.[String(n)] ?? 0, itens };
            this.partes.set(n, parte);
            void gravarCache(chaveCache(n), parte);
            feitas++;
          }));
          if (!this.snap.entradas.length) this.emitir({ progresso: { partes: feitas, total: pendentes.length } });
        }
      }

      const entradas: EntradaIndice[] = [];
      // Só aceita cada id na parte que o hash indica: se uma gravação usou a
      // divisão antiga enquanto o catálogo era reconstruído, a cópia fora do
      // lugar é ignorada (sem duplicados na busca).
      // Montagem em fatias, devolvendo o controle ao navegador entre elas
      // (sem uma tarefa longa única com dezenas de milhares de entradas).
      let desdeCeder = 0;
      let msCpu = 0;
      let t = performance.now();
      let maiorParteBytes = 0;
      for (const [n, parte] of this.partes) {
        let bytesParte = 0;
        for (const id in parte.itens) {
          bytesParte += bytesDoItem(id, parte.itens[id]);
          if (parteDoId(id, meta.partes) !== n) continue;
          entradas.push(desserializarEntrada(id, parte.itens[id]));
          if (++desdeCeder >= FATIA_MONTAGEM) {
            desdeCeder = 0;
            msCpu += performance.now() - t;
            await ceder();
            t = performance.now();
          }
        }
        if (bytesParte > maiorParteBytes) maiorParteBytes = bytesParte;
      }
      entradas.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      msCpu += performance.now() - t;
      registrarConsulta('cpu:indice-montagem', entradas.length, msCpu);
      void t0;
      this.emitir({ estado: 'pronto', meta, entradas, progresso: null, erro: null, revisao: this.snap.revisao + 1, maiorParteBytes });
    } catch (e) {
      this.emitir({ estado: this.snap.entradas.length ? 'pronto' : 'erro', erro: String((e as { code?: string })?.code || e) });
    }
  }
}

export const indiceBusca = new IndiceBusca();
