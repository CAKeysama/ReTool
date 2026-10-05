import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot, query, collection, where, orderBy, documentId, startAfter, limit } from 'firebase/firestore';
import { db } from '../../data/datasources/firebase';
import { Dispositivo } from '../../domain/entities/dispositivo';
import { EntradaIndice, ITENS_POR_PARTE } from '../../domain/services/buscaDispositivos';

/** ~60% do limite de 1 MiB por documento: avisa com folga para continuar gravando até alguém atualizar o índice. */
const BYTES_ALERTA_PARTE = 600_000;
import { contarDispositivos, CursorDispositivo, TAMANHO_PAGINA_MAX } from '../../data/repositories/FirestoreDispositivosConsultas';
import { registrarConsulta } from '../../data/observabilidade/metricas';
import { MetaIndice, lerMetaIndiceDoServidor } from '../../data/repositories/FirestoreIndiceDispositivos';
import { useReTool } from '../../context/ReToolContext';
import { useIndiceBusca } from './useIndiceBusca';

/**
 * Contagens já feitas nesta sessão (count() custa 1 leitura a cada 1.000
 * documentos). Reaproveitadas por até 1 minuto ou até uma gravação feita
 * aqui mesmo; a lista em tempo real refaz a contagem quando a página muda.
 */
const paginasGuardadas = new Map<string, { pagina: number; cursores: (string | null)[] }>();
const cacheContagem = new Map<string, { n: number; em: number; rev: number }>();
const VALIDADE_CONTAGEM_MS = 60_000;

/**
 * Lista paginada de dispositivos.
 *
 * - Sem texto de busca: consulta no servidor, ordenada pelo id do documento,
 *   com cursor (startAfter) e `limit(tamanho + 1)`; filtro de categoria no
 *   servidor; total via count(). A página atual é acompanhada em tempo real
 *   (só os documentos dela).
 * - Com texto/processo: busca por trecho no catálogo compacto (ver
 *   useIndiceBusca); a página é fatiada dos resultados, sem ler dispositivos.
 *
 * Respostas antigas nunca sobrescrevem a consulta atual (id de requisição).
 */
export interface FiltroLista {
  texto: string;
  categoriaId: string;
  processo: string;
}

export type EstadoLista = 'carregando' | 'atualizando' | 'pronto' | 'erro' | 'preparando-busca';

export interface ListaDispositivos {
  itens: Dispositivo[];
  estado: EstadoLista;
  erro: unknown;
  /** Total para os filtros atuais (null enquanto não se sabe). */
  total: number | null;
  pagina: number;
  totalPaginas: number | null;
  temAnterior: boolean;
  temProxima: boolean;
  proxima: () => void;
  anterior: () => void;
  irParaInicio: () => void;
  tentarNovamente: () => void;
  modo: 'servidor' | 'indice';
  /** Progresso de download do catálogo na primeira busca. */
  progressoIndice: { partes: number; total: number } | null;
  /** Catálogo de busca ainda não foi criado (admin pode criar). */
  indiceAusente: boolean;
  /** Total do catálogo difere do banco (alguém gravou fora do app). */
  indiceDesatualizado: boolean;
  /** Página vinda do cache do aparelho (sem conexão): pode estar incompleta. */
  doCache: boolean;
}

const entradaParaDispositivo = (e: EntradaIndice): Dispositivo => ({
  id: e.id, codigo: e.codigo, nome: e.nome, descricao: e.descricao, categoriaId: e.categoriaId,
  familiaId: e.familiaId, produtoId: e.produtoId, peso: e.peso, palavrasChave: e.palavrasChave, ativo: e.ativo,
});

/**
 * @param prepararBusca a pessoa está prestes a buscar (campo de busca em foco):
 *   começa a baixar/acompanhar o catálogo antes da primeira tecla.
 */
export function useListaDispositivos(filtro: FiltroLista, tamanhoPagina: number, prepararBusca = false): ListaDispositivos {
  const tamanho = Math.min(Math.max(1, tamanhoPagina), TAMANHO_PAGINA_MAX);
  const usarIndice = !!(filtro.texto.trim() || filtro.processo.trim());
  // O catálogo só é acompanhado enquanto há busca (ou o campo está em foco):
  // navegar pela lista não paga leituras pelas gravações de outras pessoas.
  const indice = useIndiceBusca(usarIndice || prepararBusca);
  const { revisaoDispositivos } = useReTool();

  // Filtros/tamanho mudaram: volta à primeira página.
  const chaveFiltro = `${usarIndice ? 'i' : 's'}|${filtro.texto}|${filtro.categoriaId}|${filtro.processo}|${tamanho}`;
  // Página e cursores guardados por filtro: voltar dos detalhes reabre a mesma página.
  const guardado = paginasGuardadas.get(chaveFiltro);
  const [pagina, setPaginaBruta] = useState(guardado?.pagina ?? 1);
  // cursores[i] = id do último documento da página i (página i+1 começa depois dele)
  const cursores = useRef<(string | null)[]>(guardado ? [...guardado.cursores] : [null]);
  const setPagina = useCallback((p: number | ((a: number) => number)) => {
    setPaginaBruta(atual => {
      const nova = typeof p === 'function' ? p(atual) : p;
      paginasGuardadas.set(chaveAnterior.current, { pagina: nova, cursores: [...cursores.current] });
      return nova;
    });
  }, []);
  const [itensServidor, setItensServidor] = useState<Dispositivo[] | null>(null);
  const [temMaisServidor, setTemMaisServidor] = useState(false);
  const [estadoServidor, setEstadoServidor] = useState<'carregando' | 'atualizando' | 'pronto' | 'erro'>('carregando');
  const [erro, setErro] = useState<unknown>(null);
  const [totalServidor, setTotalServidor] = useState<number | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [revisaoDados, setRevisaoDados] = useState(0);

  const chaveAnterior = useRef(chaveFiltro);
  if (chaveAnterior.current !== chaveFiltro) {
    chaveAnterior.current = chaveFiltro;
    const g = paginasGuardadas.get(chaveFiltro);
    cursores.current = g ? [...g.cursores] : [null];
    if (pagina !== (g?.pagina ?? 1)) setPaginaBruta(g?.pagina ?? 1);
  }
  const [doCache, setDoCache] = useState(false);

  // ---------- Modo servidor: página atual em tempo real ----------
  useEffect(() => {
    if (usarIndice) return;
    let vivo = true;
    const t0 = performance.now();
    setEstadoServidor(s => (s === 'pronto' || s === 'atualizando' ? 'atualizando' : 'carregando'));
    setErro(null);
    const depoisDe = cursores.current[pagina - 1] ?? null;
    // Sem cursor para esta página (não deveria acontecer: `proxima` só avança
    // com cursor): volta para a última página conhecida, nunca para a 1ª em silêncio.
    if (pagina > 1 && !depoisDe) {
      let ultima = pagina - 1;
      while (ultima > 1 && !cursores.current[ultima - 1]) ultima--;
      setPagina(ultima);
      return;
    }
    const q = query(
      collection(db, 'dispositivos'),
      ...(filtro.categoriaId ? [where('categoriaId', '==', filtro.categoriaId)] : []),
      orderBy(documentId()),
      ...(depoisDe ? [startAfter(depoisDe)] : []),
      limit(tamanho + 1)
    );
    let primeira = true;
    const parar = onSnapshot(q, snap => {
      if (!vivo) return;
      const eraPrimeira = primeira;
      if (primeira) { registrarConsulta('dispositivos:pagina', snap.size, performance.now() - t0); primeira = false; }
      else registrarConsulta('dispositivos:pagina-mudanca', snap.docChanges().length, 0);
      const docs = snap.docs.slice(0, tamanho);
      cursores.current[pagina] = docs.length ? docs[docs.length - 1].id : null;
      cursores.current.length = pagina + 1;
      paginasGuardadas.set(chaveAnterior.current, { pagina, cursores: [...cursores.current] });
      setDoCache(snap.metadata.fromCache);
      setItensServidor(docs.map(d => ({ id: d.id, ...d.data() } as Dispositivo)));
      setTemMaisServidor(snap.size > tamanho);
      setEstadoServidor('pronto');
      // Documento entrou/saiu da página depois da primeira resposta: refaz a contagem.
      if (!eraPrimeira && snap.docChanges().some(c => c.type !== 'modified') && !snap.metadata.hasPendingWrites) setRevisaoDados(r => r + 1);
    }, e => {
      if (!vivo) return;
      registrarConsulta('dispositivos:pagina', 0, performance.now() - t0, e);
      setErro(e);
      setEstadoServidor('erro');
    });
    return () => { vivo = false; parar(); };
  }, [usarIndice, pagina, tamanho, filtro.categoriaId, tentativa]);

  // Total no servidor (count): ao mudar o filtro e quando a página ganha/perde documentos.
  const ultimaChaveContagem = useRef('');
  useEffect(() => {
    if (usarIndice) return;
    const chave = `${filtro.categoriaId}`;
    const marca = `${chave}|${revisaoDados}|${revisaoDispositivos}|${tentativa}`;
    const mudouAlgo = ultimaChaveContagem.current !== '' && ultimaChaveContagem.current.split('|')[0] === chave
      && ultimaChaveContagem.current !== marca;
    ultimaChaveContagem.current = marca;
    const emCache = cacheContagem.get(chave);
    // Só vale se nenhuma gravação do app aconteceu depois (rev) e tem menos de 60 s.
    if (!mudouAlgo && revisaoDados === 0 && emCache && emCache.rev === revisaoDispositivos && Date.now() - emCache.em < VALIDADE_CONTAGEM_MS) {
      setTotalServidor(emCache.n);
      return;
    }
    let vivo = true;
    contarDispositivos(filtro.categoriaId || undefined)
      .then(n => { cacheContagem.set(chave, { n, em: Date.now(), rev: revisaoDispositivos }); if (vivo) setTotalServidor(n); })
      .catch(() => { if (vivo) setTotalServidor(null); });
    return () => { vivo = false; };
  }, [usarIndice, filtro.categoriaId, revisaoDados, tentativa, revisaoDispositivos]);

  // Meta do catálogo (1 leitura por visita) só para avisar se o índice falta
  // ou está desatualizado, sem baixar o catálogo.
  const [metaAvulsa, setMetaAvulsa] = useState<{ meta: MetaIndice | null } | null>(null);
  useEffect(() => {
    if (usarIndice || indice.acompanhando) return;
    let vivo = true;
    lerMetaIndiceDoServidor()
      .then(meta => { if (vivo) setMetaAvulsa({ meta }); })
      .catch(() => undefined);
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usarIndice, revisaoDispositivos]);

  // ---------- Modo índice: busca por trecho no catálogo ----------
  const resultadoIndice = useMemo(() => {
    if (!usarIndice || !indice.pronto) return null;
    return indice.buscar({ texto: filtro.texto, categoriaId: filtro.categoriaId, processo: filtro.processo }) || [];
  }, [usarIndice, indice.pronto, indice.buscar, filtro.texto, filtro.categoriaId, filtro.processo]);

  const itensIndice = useMemo(() => {
    if (!resultadoIndice) return null;
    const ini = (pagina - 1) * tamanho;
    return resultadoIndice.slice(ini, ini + tamanho).map(entradaParaDispositivo);
  }, [resultadoIndice, pagina, tamanho]);

  // Só avança quando a página atual já tem cursor (clique duplo não pula páginas).
  const proxima = useCallback(() => setPagina(p => (usarIndice || cursores.current[p] ? p + 1 : p)), [usarIndice, setPagina]);
  const anterior = useCallback(() => setPagina(p => Math.max(1, p - 1)), [setPagina]);
  const irParaInicio = useCallback(() => { cursores.current = [null]; setPagina(1); }, [setPagina]);
  const tentarNovamente = useCallback(() => { if (usarIndice) indice.reiniciar(); setTentativa(t => t + 1); }, [usarIndice, indice]);

  if (usarIndice) {
    const total = resultadoIndice ? resultadoIndice.length : null;
    const totalPaginas = total === null ? null : Math.max(1, Math.ceil(total / tamanho));
    const estado: EstadoLista = indice.estado === 'erro' && !indice.pronto ? 'erro'
      : resultadoIndice ? 'pronto' : 'preparando-busca';
    return {
      itens: itensIndice || [],
      estado,
      erro: indice.estado === 'erro' ? indice.erro : null,
      total,
      pagina,
      totalPaginas,
      temAnterior: pagina > 1,
      temProxima: totalPaginas !== null && pagina < totalPaginas,
      proxima, anterior, irParaInicio, tentarNovamente,
      modo: 'indice',
      progressoIndice: indice.progresso,
      indiceAusente: indice.estado === 'ausente',
      indiceDesatualizado: false,
      doCache: false,
    };
  }

  const totalPaginas = totalServidor === null ? null : Math.max(1, Math.ceil(totalServidor / tamanho));
  const metaAtual = indice.acompanhando && indice.estado !== 'carregando'
    ? (indice.estado === 'ausente' ? { meta: null } : indice.metaTotal !== null ? { meta: { total: indice.metaTotal, partes: indice.metaPartes ?? 1 } } : null)
    : metaAvulsa ? { meta: metaAvulsa.meta ? { total: metaAvulsa.meta.total, partes: metaAvulsa.meta.partes } : null } : null;
  return {
    itens: itensServidor || [],
    estado: estadoServidor === 'pronto' && itensServidor === null ? 'carregando' : estadoServidor,
    erro,
    total: totalServidor,
    pagina,
    totalPaginas,
    temAnterior: pagina > 1,
    temProxima: temMaisServidor,
    proxima, anterior, irParaInicio, tentarNovamente,
    modo: 'servidor',
    doCache,
    progressoIndice: null,
    indiceAusente: !!metaAtual && metaAtual.meta === null,
    // Total diferente do banco (gravação fora do app) ou partes cheias demais
    // (cresceu muito desde a última reconstrução, em itens ou em bytes; cada
    // parte é um documento de no máximo 1 MiB): sugere "Atualizar índice".
    indiceDesatualizado: (!!metaAtual?.meta && totalServidor !== null && !filtro.categoriaId
      && (metaAtual.meta.total !== totalServidor || metaAtual.meta.total > metaAtual.meta.partes * ITENS_POR_PARTE * 2))
      || indice.maiorParteBytes > BYTES_ALERTA_PARTE,
  };
}
