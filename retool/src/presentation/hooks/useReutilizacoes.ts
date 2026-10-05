import { useCallback, useEffect, useRef, useState } from 'react';
import { Reutilizacao } from '../../domain/entities/reutilizacao';
import { FirestoreReutilizacoesRepository } from '../../data/repositories/FirestoreReutilizacoesRepository';
import { obterDispositivosPorIds } from '../../data/repositories/FirestoreDispositivosConsultas';
import { useIndiceBusca } from './useIndiceBusca';

const repo = new FirestoreReutilizacoesRepository();

/**
 * Reutilizações em tempo real enquanto a tela estiver aberta (antes o
 * listener era global, aberto desde o login em todas as telas).
 */
export function useReutilizacoes() {
  const [itens, setItens] = useState<Reutilizacao[] | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [doCache, setDoCache] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    setErro(null);
    let confirmado = false;
    // Sem resposta do servidor em 12 s: erro de conexão (não "sem pendências").
    const prazo = setTimeout(() => { if (!confirmado) setErro({ code: 'unavailable' }); }, 12_000);
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
  }, [tentativa]);

  const tentarNovamente = useCallback(() => setTentativa(t => t + 1), []);
  const estado: 'carregando' | 'pronto' | 'erro' = erro && !itens ? 'erro' : itens ? 'pronto' : 'carregando';
  return { itens: itens || [], estado, erro, doCache: doCache && !!itens, tentarNovamente };
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
