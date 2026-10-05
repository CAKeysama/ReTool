import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReTool } from '../../context/ReToolContext';
import { indiceBusca, SnapshotIndice } from '../../data/repositories/IndiceBuscaStore';
import {
  EntradaIndice, EntradaPreparada, FiltroBusca, NomesClassificacao,
  filtrarEntradas, prepararEntradas
} from '../../domain/services/buscaDispositivos';
import { medirTrabalho, registrarConsulta } from '../../data/observabilidade/metricas';

/**
 * Preparação compartilhada entre telas (Home, lista, ações em massa):
 * normaliza o catálogo uma vez por versão e em fatias de 2.000 entradas,
 * devolvendo o controle ao navegador entre as fatias (sem tarefa longa).
 */
let cache: { revisao: number; nomes: NomesClassificacao; preparadas: EntradaPreparada[] } | null = null;
let emAndamento: { revisao: number; nomes: NomesClassificacao; promessa: Promise<EntradaPreparada[]> } | null = null;

const FATIA = 2000;
const ceder = () => new Promise<void>(r => setTimeout(r, 0));

function preparar(snap: SnapshotIndice, nomes: NomesClassificacao): Promise<EntradaPreparada[]> {
  if (cache && cache.revisao === snap.revisao && cache.nomes === nomes) return Promise.resolve(cache.preparadas);
  if (emAndamento && emAndamento.revisao === snap.revisao && emAndamento.nomes === nomes) return emAndamento.promessa;
  const entradas = snap.entradas;
  const promessa = (async () => {
    const t0 = performance.now();
    const out: EntradaPreparada[] = [];
    for (let i = 0; i < entradas.length; i += FATIA) {
      const parte = prepararEntradas(entradas.slice(i, i + FATIA), nomes);
      for (const p of parte) out.push(p);
      if (i + FATIA < entradas.length) await ceder();
    }
    registrarConsulta('cpu:indice-preparar', entradas.length, performance.now() - t0);
    cache = { revisao: snap.revisao, nomes, preparadas: out };
    return out;
  })();
  emAndamento = { revisao: snap.revisao, nomes, promessa };
  return promessa;
}

let nomesCache: { chave: unknown[]; nomes: NomesClassificacao } | null = null;
function nomesDe(categorias: { id: string; nome?: string }[], familias: { id: string; nome?: string }[], produtos: { id: string; nome?: string }[]): NomesClassificacao {
  if (nomesCache && nomesCache.chave[0] === categorias && nomesCache.chave[1] === familias && nomesCache.chave[2] === produtos) return nomesCache.nomes;
  const mapa = (l: { id: string; nome?: string }[]) => new Map(l.map(x => [x.id, x.nome || ''] as [string, string]));
  const nomes = { categorias: mapa(categorias), familias: mapa(familias), produtos: mapa(produtos) };
  nomesCache = { chave: [categorias, familias, produtos], nomes };
  return nomes;
}

export interface IndiceBuscaApi {
  estado: SnapshotIndice['estado'];
  /** true quando a busca por trecho está disponível. */
  pronto: boolean;
  progresso: SnapshotIndice['progresso'];
  erro: string | null;
  totalNoIndice: number;
  metaTotal: number | null;
  metaPartes: number | null;
  /** O catálogo está sendo acompanhado em tempo real. */
  acompanhando: boolean;
  revisao: number;
  /** Busca no catálogo (null enquanto não estiver pronto). */
  buscar: (filtro: FiltroBusca, limite?: number) => EntradaIndice[] | null;
  /** Entrada do catálogo por id (null enquanto não estiver pronto). */
  porId: (id: string) => EntradaIndice | undefined;
  reiniciar: () => void;
}

/** @param ativo começa a baixar/acompanhar o catálogo só quando a tela precisa de busca. */
export function useIndiceBusca(ativo = true): IndiceBuscaApi {
  const { categorias, familias, produtos } = useReTool();
  const [snap, setSnap] = useState<SnapshotIndice>(() => indiceBusca.obter());
  const nomes = nomesDe(categorias, familias, produtos);
  const [preparadas, setPreparadas] = useState<EntradaPreparada[] | null>(() =>
    cache && cache.revisao === indiceBusca.obter().revisao && cache.nomes === nomes ? cache.preparadas : null
  );

  useEffect(() => {
    const parar = indiceBusca.assinar(setSnap);
    if (ativo) indiceBusca.usar();
    setSnap(indiceBusca.obter());
    return () => { parar(); if (ativo) indiceBusca.liberar(); };
  }, [ativo]);

  useEffect(() => {
    if (snap.estado !== 'pronto') { if (snap.estado !== 'carregando') setPreparadas(null); return; }
    let vivo = true;
    preparar(snap, nomes).then(p => { if (vivo) setPreparadas(p); });
    return () => { vivo = false; };
  }, [snap, nomes]);

  const porIdMapa = useMemo(() => {
    if (!preparadas) return null;
    const m = new Map<string, EntradaIndice>();
    for (const p of preparadas) m.set(p.entrada.id, p.entrada);
    return m;
  }, [preparadas]);

  const buscar = useCallback((filtro: FiltroBusca, limite?: number) => {
    if (!preparadas) return null;
    return medirTrabalho('busca', () => filtrarEntradas(preparadas, filtro, limite), preparadas.length);
  }, [preparadas]);

  const porId = useCallback((id: string) => porIdMapa?.get(id), [porIdMapa]);
  const reiniciar = useCallback(() => indiceBusca.reiniciar(), []);

  return {
    estado: snap.estado,
    pronto: snap.estado === 'pronto' && !!preparadas,
    progresso: snap.progresso,
    erro: snap.erro,
    totalNoIndice: snap.entradas.length,
    metaTotal: snap.meta?.total ?? null,
    metaPartes: snap.meta?.partes ?? null,
    acompanhando: indiceBusca.acompanhando(),
    revisao: snap.revisao,
    buscar,
    porId,
    reiniciar,
  };
}
