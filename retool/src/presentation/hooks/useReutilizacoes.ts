import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Reutilizacao, ReutilizacaoStatus } from '../../domain/entities/reutilizacao';
import { ContagensProntidao, ModoReutilizacoes, decidirModoReutilizacoes } from '../../domain/services/consultaReutilizacoes';
import {
  FirestoreReutilizacoesRepository, FiltrosHistoricoReutilizacoes, PaginaReutilizacoes
} from '../../data/repositories/FirestoreReutilizacoesRepository';
import { comTimeout } from '../../utils/tempo';
import { obterDispositivosPorIds } from '../../data/repositories/FirestoreDispositivosConsultas';
import { useIndiceBusca } from './useIndiceBusca';

const repo = new FirestoreReutilizacoesRepository();

/** Sem resposta do servidor neste prazo: erro de conexão (não "sem pendências"). */
const PRAZO_PRIMEIRA_RESPOSTA_MS = 12_000;

/**
 * Coleção inteira em tempo real enquanto `ativo` (modo legado, busca de
 * texto em todo o histórico ou ações em massa); desligada não lê nada.
 */
export function useReutilizacoes(ativo = true) {
  const [itens, setItens] = useState<Reutilizacao[] | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [doCache, setDoCache] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    setErro(null);
    if (!ativo) { setItens(null); setDoCache(false); return; }
    let confirmado = false;
    const prazo = setTimeout(() => { if (!confirmado) setErro({ code: 'unavailable' }); }, PRAZO_PRIMEIRA_RESPOSTA_MS);
    const parar = repo.subscribeAll((lista, cache) => {
      setDoCache(cache);
      // Lista só do cache local antes da 1ª resposta do servidor pode estar
      // vazia ou incompleta: continua "carregando".
      if (cache && !confirmado) return;
      confirmado = true;
      setItens(lista);
      setErro(null);
    }, e => setErro(e));
    return () => { clearTimeout(prazo); parar(); };
  }, [ativo, tentativa]);

  const tentarNovamente = useCallback(() => setTentativa(t => t + 1), []);
  const estado: 'carregando' | 'pronto' | 'erro' = erro && !itens ? 'erro' : itens ? 'pronto' : 'carregando';
  return { itens: itens || [], estado, erro, doCache: doCache && !!itens, tentarNovamente };
}

/**
 * Uma fila no modo servidor: `total` por count() sempre que `ativo` (contador
 * da aba) e, só com a aba `aberta`, os `limite` mais recentes em tempo real.
 * Inclusão/remoção vista pelo listener refaz a contagem (1 leitura).
 */
export function useFilaReutilizacoes(status: ReutilizacaoStatus[], limite: number, ativo: boolean, aberta: boolean) {
  const chave = status.join('|');
  const [resultado, setResultado] = useState<PaginaReutilizacoes | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [tentativa, setTentativa] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [versaoTotal, setVersaoTotal] = useState(0);
  const escutar = ativo && aberta;

  useEffect(() => {
    setErro(null);
    if (!escutar) { setResultado(null); return; }
    let confirmado = false;
    const prazo = setTimeout(() => { if (!confirmado) setErro({ code: 'unavailable' }); }, PRAZO_PRIMEIRA_RESPOSTA_MS);
    const parar = repo.subscribeFila(status, limite, p => {
      if (p.doCache && !confirmado) return;
      confirmado = true;
      setResultado(p);
      setErro(null);
      if (p.mudouComposicao) setVersaoTotal(v => v + 1);
    }, e => setErro(e));
    return () => { clearTimeout(prazo); parar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escutar, chave, limite, tentativa]);

  const contou = useRef(false);
  useEffect(() => {
    if (!ativo) { contou.current = false; setTotal(null); return; }
    // Recontar ao abrir a aba (sem listener, mudanças desta fila não são vistas);
    // ao fechar, não.
    if (!aberta && contou.current) return;
    let vivo = true;
    repo.contarPorStatus(status)
      .then(n => { if (vivo) { contou.current = true; setTotal(n); } })
      .catch(() => { /* sem conexão: mantém o último total */ });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, aberta, chave, versaoTotal, tentativa]);

  const tentarNovamente = useCallback(() => setTentativa(t => t + 1), []);
  const estado: 'carregando' | 'pronto' | 'erro' = erro && !resultado ? 'erro' : resultado ? 'pronto' : 'carregando';
  return {
    itens: resultado?.itens || [],
    estado,
    erro,
    doCache: !!resultado?.doCache,
    temMais: !!resultado?.temMais,
    /** Tamanho da fila (null enquanto conta ou sem conexão). */
    total,
    tentarNovamente,
  };
}

/** Uma reutilização (1 leitura): destino de uma notificação no modo servidor. */
export const obterReutilizacao = (id: string) => repo.obter(id);

/** Chave (localStorage) do último modo confirmado: usado quando o count falha (sem conexão). */
const CHAVE_MODO = 'retool:reutilizacoes:modo';
const lerModoSalvo = (): ModoReutilizacoes | null => {
  try { const v = localStorage.getItem(CHAVE_MODO); return v === 'servidor' || v === 'legado' ? v : null; } catch { return null; }
};
const salvarModo = (m: ModoReutilizacoes) => { try { localStorage.setItem(CHAVE_MODO, m); } catch { /* sem armazenamento */ } };

/**
 * Decide, a cada abertura da tela, se as reutilizações podem ser consultadas
 * no servidor (3 count(), ~3 leituras) ou se ainda há registros legados
 * (modo legado: coleção inteira, como antes). Sem conexão, usa o último modo
 * confirmado neste navegador; sem ele, o legado (que funciona com o cache).
 */
export function useModoReutilizacoes() {
  const [modo, setModo] = useState<ModoReutilizacoes | 'verificando'>('verificando');
  const [contagens, setContagens] = useState<ContagensProntidao | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    comTimeout(repo.contarProntidao(), PRAZO_PRIMEIRA_RESPOSTA_MS)
      .then(c => {
        if (!vivo) return;
        const m = decidirModoReutilizacoes(c);
        salvarModo(m);
        setContagens(c);
        setModo(m);
      })
      .catch(e => {
        if (!vivo) return;
        console.warn('Não foi possível contar as reutilizações no servidor:', e);
        setModo(atual => (atual === 'verificando' ? lerModoSalvo() || 'legado' : atual));
      });
    return () => { vivo = false; };
  }, [versao]);

  /** Refaz as contagens (após normalizar ou excluir em massa). */
  const reverificar = useCallback(() => setVersao(v => v + 1), []);
  return { modo, contagens, reverificar };
}

/** Cursores das páginas já visitadas (startAfter de cada uma). */
type Cursor = QueryDocumentSnapshot | null;

/**
 * Histórico paginado no servidor: só a página atual em tempo real (25+1
 * leituras), total por count() com os mesmos filtros. Filtros mudaram: volta
 * à 1ª página. Desligado (`ativo` false) não lê nada.
 */
export function useHistoricoReutilizacoes(filtros: FiltrosHistoricoReutilizacoes, tamanho: number, ativo: boolean) {
  const chaveFiltros = `${filtros.status || ''}|${filtros.dispositivoId || ''}`;
  // Página guardada junto com os filtros: filtros mudaram = volta à 1ª página.
  const [posicao, setPosicao] = useState({ chave: chaveFiltros, pagina: 1 });
  const pagina = posicao.chave === chaveFiltros ? posicao.pagina : 1;
  // startAfter de cada página já visitada (os de outros filtros não valem).
  const cursores = useRef<{ chave: string; lista: Cursor[] }>({ chave: chaveFiltros, lista: [null] });
  const [resultado, setResultado] = useState<PaginaReutilizacoes | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [tentativa, setTentativa] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [versaoTotal, setVersaoTotal] = useState(0);

  useEffect(() => {
    setResultado(null);
    setErro(null);
    if (!ativo) return;
    let confirmado = false;
    const prazo = setTimeout(() => { if (!confirmado) setErro({ code: 'unavailable' }); }, PRAZO_PRIMEIRA_RESPOSTA_MS);
    if (cursores.current.chave !== chaveFiltros) cursores.current = { chave: chaveFiltros, lista: [null] };
    const lista = cursores.current.lista;
    const parar = repo.subscribePaginaHistorico(filtros, lista[pagina - 1] ?? null, tamanho, p => {
      if (p.doCache && !confirmado) return;
      confirmado = true;
      lista[pagina] = p.cursor;
      setResultado(p);
      setErro(null);
      // Inclusão/remoção na página (nova solicitação, exclusão): recontar.
      if (p.mudouComposicao) setVersaoTotal(v => v + 1);
    }, e => setErro(e));
    return () => { clearTimeout(prazo); parar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, chaveFiltros, pagina, tamanho, tentativa]);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    repo.contarHistorico(filtros)
      .then(n => { if (vivo) setTotal(n); })
      .catch(() => { if (vivo) setTotal(null); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, chaveFiltros, versaoTotal, tentativa]);

  const tentarNovamente = useCallback(() => setTentativa(t => t + 1), []);
  const estado: 'carregando' | 'pronto' | 'erro' = erro && !resultado ? 'erro' : resultado ? 'pronto' : 'carregando';
  const temMais = !!resultado?.temMais;
  return {
    itens: resultado?.itens || [],
    estado,
    erro,
    doCache: !!resultado?.doCache,
    pagina,
    temMais,
    /** Total com os filtros (null enquanto conta ou sem conexão). */
    total,
    anterior: () => setPosicao({ chave: chaveFiltros, pagina: Math.max(1, pagina - 1) }),
    proxima: () => { if (temMais) setPosicao({ chave: chaveFiltros, pagina: pagina + 1 }); },
    tentarNovamente,
  };
}

/** Nomes já resolvidos nesta sessão (id → nome/código), compartilhados entre telas. */
const cacheNomes = new Map<string, { nome?: string; codigo?: string } | null>();

/**
 * Nome/código dos dispositivos citados pelas linhas visíveis. Usa o catálogo
 * de busca quando já está em memória; senão lê só os ids que faltam
 * (consultas `in` de 30), nunca a coleção inteira.
 */
/** Ids cuja leitura falhou recentemente (evita repetir a leitura a cada render). */
const falhasNomes = new Set<string>();

export function useNomesDispositivos(ids: string[], usarCatalogo = false) {
  const indice = useIndiceBusca(usarCatalogo);
  const [versao, setVersao] = useState(0);
  const pedidos = useRef(new Set<string>());
  const chave = Array.from(new Set(ids.filter(Boolean))).sort().join(',');

  useEffect(() => {
    if (!chave) return;
    const faltando = chave.split(',').filter(id => !cacheNomes.has(id) && !pedidos.current.has(id) && !falhasNomes.has(id) && !indice.porId(id));
    if (faltando.length === 0) return;
    faltando.forEach(id => pedidos.current.add(id));
    let vivo = true;
    obterDispositivosPorIds(faltando)
      .then(lista => {
        const achados = new Map(lista.map(d => [d.id, d]));
        for (const id of faltando) {
          const d = achados.get(id);
          cacheNomes.set(id, d ? { nome: d.nome, codigo: d.codigo } : null);
        }
      })
      .catch(() => {
        // Marca como falha (a tela mostra "indisponível") e tenta de novo em 15 s.
        faltando.forEach(id => falhasNomes.add(id));
        setTimeout(() => { faltando.forEach(id => falhasNomes.delete(id)); setVersao(v => v + 1); }, 15_000);
      })
      .finally(() => {
        faltando.forEach(id => pedidos.current.delete(id));
        if (vivo) setVersao(v => v + 1);
      });
    return () => { vivo = false; };
  }, [chave, indice.porId, versao]);

  return useCallback((id: string): { nome?: string; codigo?: string; erro?: boolean } | null | undefined => {
    const e = indice.porId(id);
    if (e) return { nome: e.nome, codigo: e.codigo };
    if (falhasNomes.has(id) && !cacheNomes.has(id)) return { erro: true };
    return cacheNomes.get(id); // undefined = ainda carregando; null = não existe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice.porId, chave, cacheNomes.size, versao]);
}
