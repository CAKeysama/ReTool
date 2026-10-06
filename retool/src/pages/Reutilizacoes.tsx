import React, { useState, useMemo, useEffect, Suspense, lazy } from 'react';
import { useReTool } from '../context/ReToolContext';
import { usePermissions } from '../hooks/usePermissions';
import { Tabs, EmptyState } from '../components/Tabs';
import type { BulkItem } from '../components/BulkActionModal';
import { FluxoReutilizacaoModal } from '../components/FluxoReutilizacaoModal';
import { SeletorDispositivo } from '../components/SeletorDispositivo';
import { LimiteDeErro, CarregandoModal } from '../components/LimiteDeErro';
import { EstadoDados, SkeletonLista, SkeletonTabela, classificarErro, mensagemDeErro } from '../components/feedback';
import { gravarComPrazo } from '../utils/tempo';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  useReutilizacoes, useNomesDispositivos, useModoReutilizacoes, useFilaReutilizacoes, useHistoricoReutilizacoes, obterReutilizacao
} from '../presentation/hooks/useReutilizacoes';
import { NormalizarReutilizacoes } from '../components/NormalizarReutilizacoes';
import { documentosLegados } from '../domain/services/consultaReutilizacoes';
import { ListChecks, ChevronDown, Check, X, Clock, Factory, Send, Wrench, ExternalLink, Info } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBulkProgress } from '../hooks/useBulkProgress';
import { useAvisoAoSair } from '../hooks/useAvisoAoSair';
import {
  Reutilizacao,
  ReutilizacaoStatus,
  REUTILIZACAO_STATUS,
  corDoStatusReutilizacao,
  rotuloCurtoStatusReutilizacao,
  transicaoReutilizacaoPermitida
} from '../domain/entities/reutilizacao';

const BulkActionModal = lazy(() => import('../components/BulkActionModal').then(m => ({ default: m.BulkActionModal })));

/** Registros por página no histórico e cartões por vez nas filas. */
const POR_PAGINA = 25;
const CARTOES_POR_VEZ = 50;

const FILA_PROJETISTA: ReutilizacaoStatus[] = ['Em análise (Projetista)', 'Aguardando novo filtro (Projetista)'];
const FILA_ENGENHARIA: ReutilizacaoStatus[] = ['Em análise (Engenharia)', 'Reutilização aprovada', 'Reutilização não aprovada'];

/** Data usada na ordenação do histórico (a mesma do orderBy no servidor). */
const chaveData = (u: Reutilizacao) => u.dataCriacao || u.data || '';

/**
 * Busca de texto do histórico (o Firestore não busca por trecho: no modo
 * servidor ela age só na página atual, ou na coleção carregada sob demanda).
 */
const casaTexto = (u: Reutilizacao, q: string) =>
  !!(u.descricaoAlteracao?.toLowerCase().includes(q) ||
    u.responsavel?.toLowerCase().includes(q) ||
    u.solicitanteNome?.toLowerCase().includes(q) ||
    u.codigoPeca?.toLowerCase().includes(q) ||
    u.numeroOs?.toLowerCase().includes(q) ||
    u.descricaoPeca?.toLowerCase().includes(q));

/**
 * Dois modos de leitura (ver PERFORMANCE.md):
 * - servidor (acervo normalizado): cada fila é contada no servidor e só a
 *   aba aberta assina seus 50 cartões mais recentes (`status in` + limit;
 *   "Mostrar mais" amplia); o histórico assina só a página atual (orderBy
 *   dataCriacao + limit + cursor), com total por count(). A coleção inteira
 *   só é lida por ação explícita (buscar texto em todo o histórico, ações
 *   em massa).
 * - legado (há registros com status antigo ou sem dataCriacao): coleção
 *   inteira em tempo real, como antes; a Administração vê o aviso para
 *   normalizar.
 */
export function Reutilizacoes() {
  const { deleteReutilizacao, transicionarReutilizacao, announce } = useReTool();
  const { canExcluir, isProjetista, isEngenharia, isAdmin, currentRole } = usePermissions();
  const BULK_THRESHOLD = 20;
  const { progress: bulkProgress, runWithProgress } = useBulkProgress();
  const navigate = useNavigate();
  const location = useLocation();

  const [destacarId, setDestacarId] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isFluxoOpen, setIsFluxoOpen] = useState(false);

  // Filtros vinculados estritamente à tabela de histórico
  const [filterDispId, setFilterDispId] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | ReutilizacaoStatus>('todos');
  const textoBusca = useDebouncedValue(filterText, 200);
  const [pagina, setPagina] = useState(1);
  const [limiteCartoes, setLimiteCartoes] = useState(CARTOES_POR_VEZ);
  // Uma transição por registro de cada vez (evita clique duplo gerar duas).
  const [transicionando, setTransicionando] = useState<Set<string>>(new Set());

  // Seleção da tabela (Ações em Massa)
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState<'disable' | 'delete' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  useAvisoAoSair(bulkLoading);
  // Busca de texto em todo o histórico (carrega a coleção; só com clique).
  const [buscaCompleta, setBuscaCompleta] = useState(false);

  const statusDe = (u: Reutilizacao): ReutilizacaoStatus => u.status || 'Em análise (Projetista)';

  // ---------------- FONTES DE DADOS (modo servidor x legado) ----------------
  const { modo, contagens, reverificar } = useModoReutilizacoes();
  const [indiceIndisponivel, setIndiceIndisponivel] = useState(false);
  const servidor = modo === 'servidor' && !indiceIndisponivel;
  const legado = modo === 'legado' || indiceIndisponivel;
  const todas = useReutilizacoes(legado || (servidor && (buscaCompleta || isBulkOpen)));
  const reutilizacoes = todas.itens;
  // Histórico no cliente: modo legado ou busca de texto em todo o histórico.
  const historicoNoCliente = legado || buscaCompleta;

  // ---------------- ABAS DISPONÍVEIS POR PERFIL ----------------
  const filaProjetistaLegado = useMemo(
    () => (legado ? reutilizacoes.filter(u => FILA_PROJETISTA.includes(statusDe(u))) : []),
    [legado, reutilizacoes]
  );
  const filaEngenhariaLegado = useMemo(
    () => (legado ? reutilizacoes.filter(u => FILA_ENGENHARIA.includes(statusDe(u))) : []),
    [legado, reutilizacoes]
  );
  const veFilaP = isProjetista || isAdmin;
  const veFilaE = isEngenharia || isAdmin;
  // A aba ativa sai do estado (o hook de cada fila precisa dela antes das abas existirem).
  const abaPadrao = veFilaP ? 'filaProjetista' : veFilaE ? 'filaEngenharia' : 'historico';
  const tabAtiva = activeTab && ((activeTab === 'filaProjetista' && veFilaP) || (activeTab === 'filaEngenharia' && veFilaE) || activeTab === 'historico')
    ? activeTab : abaPadrao;
  // Filas no servidor: count() para os contadores; listener só da aba aberta.
  const filaP = useFilaReutilizacoes(FILA_PROJETISTA, limiteCartoes, servidor && veFilaP, tabAtiva === 'filaProjetista');
  const filaE = useFilaReutilizacoes(FILA_ENGENHARIA, limiteCartoes, servidor && veFilaE, tabAtiva === 'filaEngenharia');

  const hist = useHistoricoReutilizacoes(
    { status: filterStatus === 'todos' ? undefined : filterStatus, dispositivoId: filterDispId || undefined },
    POR_PAGINA,
    servidor && tabAtiva === 'historico' && !buscaCompleta
  );

  // Se qualquer consulta no servidor falhar por índice do Firestore ausente ou em construção (failed-precondition),
  // faz fallback transparente para o modo legado em memória para não bloquear o usuário.
  useEffect(() => {
    if (indiceIndisponivel) return;
    const isPrecondition = (err: unknown) =>
      Boolean(err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'failed-precondition');
    if (isPrecondition(filaP.erro) || isPrecondition(filaE.erro) || isPrecondition(hist.erro)) {
      console.warn('Índice composto do Firestore indisponível ou em construção. Alternando para modo em memória temporariamente.');
      setIndiceIndisponivel(true);
    }
  }, [filaP.erro, filaE.erro, hist.erro, indiceIndisponivel]);

  const filaProjetista = servidor ? filaP.itens : filaProjetistaLegado;
  const filaEngenharia = servidor ? filaE.itens : filaEngenhariaLegado;
  // Contadores só quando conhecidos (0 durante o carregamento enganaria).
  const contaFilaP = servidor ? filaP.total ?? undefined : todas.estado === 'pronto' ? filaProjetistaLegado.length : undefined;
  const contaFilaE = servidor ? filaE.total ?? undefined : todas.estado === 'pronto' ? filaEngenhariaLegado.length : undefined;
  const totalGeral = legado && todas.estado === 'pronto' ? reutilizacoes.length : contagens?.total;

  const tabs = useMemo(() => {
    const t: { id: string; label: string; count?: number }[] = [];
    if (veFilaP) t.push({ id: 'filaProjetista', label: 'Fila do Projetista', count: contaFilaP });
    if (veFilaE) t.push({ id: 'filaEngenharia', label: 'Fila da Engenharia', count: contaFilaE });
    t.push({ id: 'historico', label: 'Histórico Geral', count: totalGeral });
    return t;
  }, [veFilaP, veFilaE, contaFilaP, contaFilaE, totalGeral]);

  // Estado da fonte que a aba ativa mostra.
  const fonte = modo === 'verificando'
    ? { estado: 'carregando' as const, erro: null as unknown, doCache: false, tentarNovamente: reverificar }
    : legado ? todas
    : tabAtiva === 'filaProjetista' ? filaP
    : tabAtiva === 'filaEngenharia' ? filaE
    : buscaCompleta ? todas : hist;
  const { estado: estadoDados, erro: erroDados, doCache, tentarNovamente } = fonte;

  // Navegação vinda de uma notificação: abre a aba certa e destaca o registro.
  // No modo servidor o registro é lido sozinho (1 leitura) para escolher a aba.
  useEffect(() => {
    const st = location.state as { reutilizacaoId?: string; dispositivoId?: string } | null;
    if (!st?.reutilizacaoId || modo === 'verificando') return;
    if (legado && todas.estado !== 'pronto') return;
    setDestacarId(st.reutilizacaoId);
    const abrirAba = (alvo: Reutilizacao | null | undefined) => {
      if (!alvo) return;
      const s = statusDe(alvo);
      if (FILA_PROJETISTA.includes(s) && (isProjetista || isAdmin)) setActiveTab('filaProjetista');
      else if (FILA_ENGENHARIA.includes(s) && (isEngenharia || isAdmin)) setActiveTab('filaEngenharia');
      else setActiveTab('historico');
    };
    if (legado) { abrirAba(reutilizacoes.find(u => u.id === st.reutilizacaoId)); return; }
    let vivo = true;
    obterReutilizacao(st.reutilizacaoId).then(a => { if (vivo) abrirAba(a); }).catch(() => { /* sem destino: fica na aba padrão */ });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, modo, todas.estado]);

  // ---------------- HISTÓRICO (tabela) ----------------
  // No cliente (legado ou busca completa): filtros e paginação em memória.
  const historicoFiltrado = useMemo(() => {
    if (!historicoNoCliente) return [];
    const q = textoBusca.toLowerCase();
    return reutilizacoes.filter(u => {
      const matchPeca = filterDispId === '' || u.dispositivoId === filterDispId;
      const matchStatus = filterStatus === 'todos' || statusDe(u) === filterStatus;
      const matchText = textoBusca === '' || casaTexto(u, q);
      return matchPeca && matchStatus && matchText;
    }).sort((a, b) => (chaveData(a) < chaveData(b) ? 1 : chaveData(a) > chaveData(b) ? -1 : 0));
  }, [historicoNoCliente, reutilizacoes, filterDispId, textoBusca, filterStatus]);

  // Filtro mudou: volta à primeira página.
  useEffect(() => { setPagina(1); }, [filterDispId, textoBusca, filterStatus]);
  const totalPaginasCliente = Math.max(1, Math.ceil(historicoFiltrado.length / POR_PAGINA));
  const paginaCliente = Math.min(pagina, totalPaginasCliente);

  // No servidor: a página atual; o texto filtra só ela (aviso na tela).
  const textoSoNaPagina = servidor && !buscaCompleta && textoBusca !== '';
  const historicoPagina = useMemo(() => {
    if (historicoNoCliente) return historicoFiltrado.slice((paginaCliente - 1) * POR_PAGINA, paginaCliente * POR_PAGINA);
    if (!textoBusca) return hist.itens;
    const q = textoBusca.toLowerCase();
    return hist.itens.filter(u => casaTexto(u, q));
  }, [historicoNoCliente, historicoFiltrado, paginaCliente, hist.itens, textoBusca]);

  // Total, página e navegação do histórico, nos dois modos.
  const totalHistorico: number | null = historicoNoCliente ? historicoFiltrado.length : hist.total;
  const paginaAtual = historicoNoCliente ? paginaCliente : hist.pagina;
  const totalPaginas = historicoNoCliente
    ? totalPaginasCliente
    : totalHistorico !== null ? Math.max(1, Math.ceil(totalHistorico / POR_PAGINA)) : null;
  const temAnterior = paginaAtual > 1;
  const temProxima = historicoNoCliente ? paginaCliente < totalPaginasCliente : hist.temMais;
  const irAnterior = () => (historicoNoCliente ? setPagina(paginaCliente - 1) : hist.anterior());
  const irProxima = () => (historicoNoCliente ? setPagina(paginaCliente + 1) : hist.proxima());

  // Nomes só dos dispositivos que aparecem na tela.
  const filaVisivel = tabAtiva === 'filaProjetista' ? filaProjetista : tabAtiva === 'filaEngenharia' ? filaEngenharia : [];
  const idsVisiveis = useMemo(() => [
    ...(tabAtiva === 'historico' ? historicoPagina : filaVisivel.slice(0, limiteCartoes)).map(u => u.dispositivoId),
    filterDispId,
  ], [tabAtiva, historicoPagina, filaVisivel, limiteCartoes, filterDispId]);
  // Com as ações em massa abertas, o catálogo dá o nome de todos os dispositivos (busca por nome).
  const nomeDispositivo = useNomesDispositivos(idsVisiveis, isBulkOpen);
  const rotuloDisp = (id: string) => {
    const d = nomeDispositivo(id);
    if (d === undefined) return 'Carregando…';
    if (d === null) return 'Desconhecido';
    if (d.erro) return 'Nome indisponível (sem conexão)';
    return d.nome || 'Sem nome';
  };

  // ---------------- AÇÕES EM MASSA ----------------
  const bulkBusca = useDebouncedValue(bulkSearch, 200);
  const bulkFiltered = useMemo(() => {
    if (!isBulkOpen || todas.estado !== 'pronto') return [];
    if (!bulkBusca.trim()) return reutilizacoes;
    const q = bulkBusca.toLowerCase();
    return reutilizacoes.filter(u => {
      const disp = nomeDispositivo(u.dispositivoId);
      return (
        u.descricaoAlteracao?.toLowerCase().includes(q) ||
        u.responsavel?.toLowerCase().includes(q) ||
        u.codigoPeca?.toLowerCase().includes(q) ||
        u.numeroOs?.toLowerCase().includes(q) ||
        disp?.nome?.toLowerCase().includes(q)
      );
    });
  }, [isBulkOpen, todas.estado, reutilizacoes, bulkBusca, nomeDispositivo]);

  const bulkItems: BulkItem[] = useMemo(() => bulkFiltered.map(u => {
    const disp = nomeDispositivo(u.dispositivoId);
    return {
      id: u.id,
      label: u.descricaoAlteracao || 'Sem descrição',
      sublabel: disp?.nome ? `${disp.nome} · OS: ${u.numeroOs || 'S/OS'}` : `OS: ${u.numeroOs || 'S/OS'}`,
    };
  }), [bulkFiltered, nomeDispositivo]);

  const toggleItem = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = historicoPagina.length > 0 && historicoPagina.every(u => bulkSelected.has(u.id));
  const toggleAllVisible = () => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) historicoPagina.forEach(u => next.delete(u.id));
      else historicoPagina.forEach(u => next.add(u.id));
      return next;
    });
  };

  const closeBulk = () => {
    setIsBulkOpen(false);
    setBulkSelected(new Set());
    setBulkSearch('');
    setBulkConfirm(null);
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    const ids = Array.from(bulkSelected);
    const useSilent = ids.length > BULK_THRESHOLD;
    try {
      await runWithProgress(ids, id => gravarComPrazo(deleteReutilizacao(id, useSilent)));
      if (useSilent) announce(`${ids.length} reutilizações excluídas com sucesso`);
    } catch (e) {
      console.error(e);
      announce(mensagemDeErro(e, 'Não foi possível excluir todas as reutilizações selecionadas. Confira a lista e tente de novo.'));
    } finally {
      setBulkLoading(false);
      closeBulk();
      // Recontagem: total da aba Histórico e prontidão do acervo.
      reverificar();
    }
  };

  // ---------------- TRANSIÇÕES (somente nas abas de fila) ----------------
  const transicionar = async (id: string, para: ReutilizacaoStatus, opts?: { motivo?: string }) => {
    if (transicionando.has(id)) return;
    setTransicionando(prev => new Set(prev).add(id));
    try {
      await gravarComPrazo(transicionarReutilizacao(id, para, opts));
    } catch (e) {
      console.error(e);
      announce(mensagemDeErro(e, 'Não foi possível atualizar a reutilização. Tente novamente.'));
    } finally {
      setTransicionando(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const naoAprovar = (u: Reutilizacao) => {
    const motivo = window.prompt('Informe o motivo da não aprovação:');
    if (motivo === null) return;
    transicionar(u.id, 'Reutilização não aprovada', { motivo: motivo || 'Não justificado' });
  };

  const botoesDeAcao = (u: Reutilizacao) => {
    const st = statusDe(u);
    const pode = (para: ReutilizacaoStatus) => transicaoReutilizacaoPermitida(currentRole, st, para);
    const btn = (
      label: string,
      onClick: () => void,
      cor: 'success' | 'danger' | 'primary' | 'neutro',
      icon?: React.ReactNode
    ) => (
      <button
        type="button"
        className="btn"
        disabled={transicionando.has(u.id)}
        aria-busy={transicionando.has(u.id)}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={cor === 'neutro'
          ? { padding: '6px 12px', minHeight: 32, fontSize: '0.78rem', fontWeight: 600 }
          : {
              padding: '6px 12px', minHeight: 32, fontSize: '0.78rem', fontWeight: 600,
              backgroundColor: cor === 'success' ? 'var(--color-success)' : cor === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)',
              borderColor: cor === 'success' ? 'var(--color-success)' : cor === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)',
              color: 'white'
            }}
      >
        {icon}{label}
      </button>
    );

    const acoes: React.ReactNode[] = [];

    if (st === 'Em análise (Engenharia)' && pode('Em análise (Projetista)')) {
      acoes.push(btn('Solicitar Análise (1º Filtro)', () => transicionar(u.id, 'Em análise (Projetista)'), 'primary', <Send size={14} />));
    }
    if (st === 'Em análise (Projetista)') {
      if (pode('Reutilização aprovada')) acoes.push(btn('Aprovar', () => transicionar(u.id, 'Reutilização aprovada'), 'success', <Check size={14} />));
      if (pode('Reutilização não aprovada')) acoes.push(btn('Não Aprovar', () => naoAprovar(u), 'danger', <X size={14} />));
    }
    if (st === 'Reutilização não aprovada') {
      if (pode('Aguardando novo filtro (Projetista)')) acoes.push(btn('Solicitar Dispositivo Novo', () => transicionar(u.id, 'Aguardando novo filtro (Projetista)'), 'primary', <Factory size={14} />));
    }
    if (st === 'Aguardando novo filtro (Projetista)') {
      if (pode('Em análise (Projetista)')) acoes.push(btn('Similar Encontrado', () => transicionar(u.id, 'Em análise (Projetista)'), 'primary', <Wrench size={14} />));
      if (pode('Liberado para fabricação (novo dispositivo)')) acoes.push(btn('Liberar Fabricação', () => transicionar(u.id, 'Liberado para fabricação (novo dispositivo)'), 'success', <Factory size={14} />));
    }

    return acoes;
  };

  const chipDeStatus = (u: Reutilizacao) => {
    const st = statusDe(u);
    const cor = corDoStatusReutilizacao(st);
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px', borderRadius: '10px',
        fontSize: '0.72rem', fontWeight: 700,
        backgroundColor: cor.fundo, color: cor.texto, whiteSpace: 'nowrap'
      }}>
        {st === 'Em análise (Projetista)' || st === 'Aguardando novo filtro (Projetista)' ? <Clock size={12} /> : null}
        {rotuloCurtoStatusReutilizacao(st)}
      </span>
    );
  };

  const formatarData = (u: Reutilizacao) => {
    const rawDate = u.data || u.dataCriacao || '';
    if (!rawDate) return 'N/A';
    if (rawDate.includes('-') && rawDate.length === 10) {
      const [y, m, d] = rawDate.split('-');
      return `${d}/${m}/${y}`;
    }
    return new Date(rawDate).toLocaleDateString('pt-BR');
  };

  // ---------------- CARDS DAS FILAS (abas 1 e 2) ----------------
  const cartaoFila = (u: Reutilizacao) => {
    return (
      <div
        key={u.id}
        onClick={() => navigate(`/dispositivos/${u.dispositivoId}`)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') navigate(`/dispositivos/${u.dispositivoId}`); }}
        style={{
          // Quebra linha em telas estreitas: os botões descem em vez de sobrepor o texto.
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
          padding: '12px 16px', backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
          ...(u.id === destacarId ? { boxShadow: '0 0 0 2px var(--color-primary)' } : {})
        }}
      >
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            {chipDeStatus(u)}
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#111827' }}>{u.descricaoAlteracao || 'Descrição não informada'}</h4>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            <strong>Dispositivo:</strong> {rotuloDisp(u.dispositivoId)} | <strong>Peça:</strong> {u.codigoPeca || 'N/A'} | <strong>Solicitante:</strong> {u.solicitanteNome || u.responsavel || 'N/A'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
          {botoesDeAcao(u)}
        </div>
      </div>
    );
  };

  const colunaCount = 9 + (canExcluir ? 1 : 0);

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-md)' }}>
        <div>
          <h2>Histórico & Solicitações de Reutilização</h2>
          <p style={{ color: 'var(--color-text-body)' }}>Fluxo de solicitação da Engenharia, análise da Ferramentaria e histórico consolidado.</p>
        </div>
        <button
          className="btn"
          onClick={() => setIsFluxoOpen(true)}
          style={{ flexShrink: 0, height: '36px', padding: '0 14px', fontSize: '0.82rem' }}
        >
          <Info size={16} />
          Como funciona o fluxo
        </button>
      </div>

      {isAdmin && legado && contagens && documentosLegados(contagens) > 0 && (
        <NormalizarReutilizacoes
          legados={documentosLegados(contagens)}
          total={contagens.total}
          onConcluido={n => {
            if (n > 0) announce(`${n.toLocaleString('pt-BR')} reutilizações antigas normalizadas.`);
            reverificar();
          }}
        />
      )}

      <Tabs tabs={tabs} active={tabAtiva} onChange={t => { setActiveTab(t); setLimiteCartoes(CARTOES_POR_VEZ); }} />

      {doCache && estadoDados === 'pronto' && (
        <div role="status" style={{ background: '#fff7e6', border: '1px solid #f0c36d', color: '#5c4400', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: '8px', fontSize: '0.85rem' }}>
          Sem conexão com o servidor: mostrando os dados da última atualização, que podem estar desatualizados.
        </div>
      )}
      {estadoDados === 'carregando' && tabAtiva !== 'historico' && (
        <div aria-busy="true"><SkeletonLista linhas={4} alturaLinha={74} /></div>
      )}
      {estadoDados === 'erro' && tabAtiva !== 'historico' && (
        <EstadoDados estado={classificarErro(erroDados)} onTentarNovamente={tentarNovamente} />
      )}

      {/* ---------- ABA 1: FILA DO PROJETISTA ---------- */}
      {tabAtiva === 'filaProjetista' && estadoDados === 'pronto' && (
        filaProjetista.length === 0 ? (
          <EmptyState message="Sem pendências no momento." />
        ) : (
          <ListaCartoes itens={filaProjetista} limite={limiteCartoes} onMais={() => setLimiteCartoes(l => l + CARTOES_POR_VEZ)} render={cartaoFila}
            restantesServidor={servidor ? restantes(filaP) : undefined} />
        )
      )}

      {/* ---------- ABA 2: FILA DA ENGENHARIA ---------- */}
      {tabAtiva === 'filaEngenharia' && estadoDados === 'pronto' && (
        filaEngenharia.length === 0 ? (
          <EmptyState message="Sem pendências no momento." />
        ) : (
          <ListaCartoes itens={filaEngenharia} limite={limiteCartoes} onMais={() => setLimiteCartoes(l => l + CARTOES_POR_VEZ)} render={cartaoFila}
            restantesServidor={servidor ? restantes(filaE) : undefined} />
        )
      )}

      {/* ---------- ABA 3: HISTÓRICO GERAL (tabela) ---------- */}
      {/* Erro no histórico fica dentro do quadro: os filtros continuam à mão (ex.: trocar um filtro que falhou). */}
      {tabAtiva === 'historico' && (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden'
        }}>
          {/* Toolbar da tabela */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 'var(--spacing-md)', padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)', backgroundColor: '#fafafa'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
              {estadoDados === 'erro' ? 'Registros indisponíveis'
                : estadoDados === 'carregando' ? 'Carregando registros…'
                : totalHistorico === null ? 'Contando registros…'
                : <>{totalHistorico.toLocaleString('pt-BR')} {totalHistorico === 1 ? 'registro' : 'registros'}</>}
              {bulkSelected.size > 0 && <> · <span style={{ color: 'var(--color-primary)' }}>{bulkSelected.size.toLocaleString('pt-BR')} selecionado(s)</span></>}
              {/* Selecionar o filtro inteiro só com a lista em memória (no servidor, pelas Ações em Massa). */}
              {canExcluir && historicoNoCliente && allVisibleSelected && historicoFiltrado.length > historicoPagina.length && bulkSelected.size < historicoFiltrado.length && (
                <> · <button type="button" className="btn-link" style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                  onClick={() => setBulkSelected(new Set(historicoFiltrado.map(u => u.id)))}>
                  Selecionar todos os {historicoFiltrado.length.toLocaleString('pt-BR')} do filtro
                </button></>
              )}
            </div>
            {canExcluir && (
              <button
                className="btn"
                onClick={() => setIsBulkOpen(true)}
                style={{ height: '36px', padding: '0 14px', fontSize: '0.82rem' }}
              >
                <ListChecks size={16} />
                Ações em Massa
              </button>
            )}
          </div>

          {/* Filtros vinculados à tabela */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-sm)',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)'
          }}>
            <input
              type="text"
              className="input-field"
              placeholder="Buscar por descrição, peça, solicitante ou OS..."
              aria-label="Buscar no histórico"
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                // Texto apagado: volta a ler só a página atual no servidor.
                if (!e.target.value) setBuscaCompleta(false);
              }}
            />
            <select
              className="input-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="todos">Todos os Status</option>
              {REUTILIZACAO_STATUS.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            <SeletorDispositivo
              valor={filterDispId}
              rotuloValor={filterDispId ? `${rotuloDisp(filterDispId)} (${nomeDispositivo(filterDispId)?.codigo || 'S/C'})` : undefined}
              onChange={setFilterDispId}
            />
          </div>

          {/* Texto livre no modo servidor: só a página atual, ou a coleção inteira por clique. */}
          {textoSoNaPagina && (
            <div role="status" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', padding: '8px 16px', borderBottom: '1px solid var(--color-border)', background: '#fff7e6', color: '#5c4400', fontSize: '0.82rem' }}>
              <span>A busca por texto está filtrando só os registros desta página ({hist.itens.length.toLocaleString('pt-BR')}).</span>
              <button type="button" className="btn" style={{ padding: '4px 12px', minHeight: 28, fontSize: '0.78rem' }} onClick={() => setBuscaCompleta(true)}>
                Buscar em todo o histórico{contagens ? ` (lê ${contagens.total.toLocaleString('pt-BR')} registros)` : ''}
              </button>
            </div>
          )}
          {servidor && buscaCompleta && (
            <div role="status" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', padding: '8px 16px', borderBottom: '1px solid var(--color-border)', fontSize: '0.82rem', color: '#374151' }}>
              <span>{todas.estado === 'carregando' ? 'Carregando todo o histórico…' : 'Buscando em todo o histórico.'}</span>
              <button type="button" className="btn" style={{ padding: '4px 12px', minHeight: 28, fontSize: '0.78rem' }} onClick={() => setBuscaCompleta(false)}>
                Buscar só na página atual
              </button>
            </div>
          )}

          {estadoDados === 'erro' ? (
            <EstadoDados estado={classificarErro(erroDados)} onTentarNovamente={tentarNovamente} compacto />
          ) : estadoDados === 'carregando' ? (
            <div aria-busy="true" style={{ padding: '12px 16px' }}><SkeletonTabela linhas={8} colunas={6} /></div>
          ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  {canExcluir && (
                    <th style={{ padding: '10px 8px', width: '36px' }}>
                      <input
                        type="checkbox"
                        aria-label="Selecionar os registros desta página"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                      />
                    </th>
                  )}
                  <th style={{ padding: '10px 8px', width: '36px' }} aria-label="Expandir detalhes" />
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Data</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Status</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Dispositivo</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Peça</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Solicitante</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>Hard Saving</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#4b5563' }}>OS</th>
                </tr>
              </thead>
              <tbody>
                {historicoPagina.map(u => {
                  const nomeDisp = rotuloDisp(u.dispositivoId);
                  const aberto = expandedId === u.id;
                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        onClick={() => setExpandedId(aberto ? null : u.id)}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                          backgroundColor: u.id === destacarId ? 'rgba(228, 13, 44, 0.06)' : aberto ? '#fafafa' : 'transparent'
                        }}
                      >
                        {canExcluir && (
                          <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${u.descricaoAlteracao || u.id}`}
                              checked={bulkSelected.has(u.id)}
                              onChange={() => toggleItem(u.id)}
                            />
                          </td>
                        )}
                        <td style={{ padding: '10px 8px', color: '#6b7280' }}>
                          <ChevronDown size={16} style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', color: '#374151' }}>{formatarData(u)}</td>
                        <td style={{ padding: '10px 8px' }}>{chipDeStatus(u)}</td>
                        <td style={{ padding: '10px 8px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nomeDisp}>{nomeDisp}</td>
                        <td style={{ padding: '10px 8px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.codigoPeca}>{u.codigoPeca || 'N/A'}</td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{u.solicitanteNome || u.responsavel || 'N/A'}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--color-success)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          R$ {u.hardSaving?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{u.numeroOs || '—'}</td>
                      </tr>
                      {aberto && (
                        <tr style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fafafa' }}>
                          <td colSpan={colunaCount} style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.5 }}>
                              <div><strong>Descrição da alteração:</strong> {u.descricaoAlteracao || 'N/A'}</div>
                              <div><strong>Peça:</strong> {u.codigoPeca || 'N/A'} — {u.descricaoPeca || 'N/A'} | <strong>Peso:</strong> {u.pesoPeca?.toLocaleString('pt-BR', { minimumFractionDigits: 3 }) || '0,000'} kg</div>
                              <div><strong>Responsável:</strong> {u.responsavel || 'N/A'} | <strong>Solicitante:</strong> {u.solicitanteNome || 'N/A'}</div>
                              {statusDe(u) === 'Reutilização não aprovada' && u.motivoRejeicao && (
                                <div style={{ color: 'var(--color-danger)' }}><strong>Motivo da não aprovação:</strong> {u.motivoRejeicao}</div>
                              )}
                              {u.aprovadorNome && (
                                <div><strong>Análise:</strong> {u.aprovadorNome}{u.dataAprovacao ? ` em ${new Date(u.dataAprovacao).toLocaleString('pt-BR')}` : ''}</div>
                              )}
                              <div>
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => navigate(`/dispositivos/${u.dispositivoId}`)}
                                  style={{ padding: '4px 12px', minHeight: 28, fontSize: '0.75rem' }}
                                >
                                  <ExternalLink size={13} /> Ver Dispositivo
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {historicoPagina.length === 0 && (
                  <tr>
                    <td colSpan={colunaCount} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                      {(historicoNoCliente ? reutilizacoes.length === 0 : totalGeral === 0)
                        ? 'Nenhuma reutilização registrada ainda.'
                        : textoSoNaPagina
                          ? 'Nenhum registro desta página corresponde ao texto. Use "Buscar em todo o histórico" para procurar nos demais.'
                          : 'Nenhum registro encontrado para os filtros atuais.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}

          {estadoDados === 'pronto' && (temAnterior || temProxima) && (
            <nav aria-label="Paginação do histórico" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 16px', borderTop: '1px solid var(--color-border)', fontSize: '0.83rem', flexWrap: 'wrap' }}>
              <span>
                {((paginaAtual - 1) * POR_PAGINA + 1).toLocaleString('pt-BR')}–{((paginaAtual - 1) * POR_PAGINA + (historicoNoCliente ? historicoPagina.length : hist.itens.length)).toLocaleString('pt-BR')}
                {totalHistorico !== null && <> de {totalHistorico.toLocaleString('pt-BR')}</>}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button type="button" className="btn" disabled={!temAnterior} onClick={irAnterior}>Anterior</button>
                <span aria-live="polite">Página {paginaAtual}{totalPaginas !== null && <> de {totalPaginas}</>}</span>
                <button type="button" className="btn" disabled={!temProxima} onClick={irProxima}>Próxima</button>
              </div>
            </nav>
          )}
        </div>
      )}

      {/* Modal de Ações em Massa da tabela de histórico (baixado só ao abrir) */}
      {isBulkOpen && (
      <LimiteDeErro compacto onFechar={closeBulk}>
      <Suspense fallback={<CarregandoModal />}>
      <BulkActionModal
        isOpen={isBulkOpen}
        onClose={closeBulk}
        items={bulkItems}
        selected={bulkSelected}
        search={bulkSearch}
        onSearchChange={setBulkSearch}
        onToggleItem={toggleItem}
        onToggleAll={() => {
          const allIds = bulkFiltered.map(u => u.id);
          const allSelected = allIds.length > 0 && allIds.every(id => bulkSelected.has(id));
          setBulkSelected(prev => {
            const next = new Set(prev);
            if (allSelected) allIds.forEach(id => next.delete(id));
            else allIds.forEach(id => next.add(id));
            return next;
          });
        }}
        confirmAction={bulkConfirm}
        onSetConfirmAction={setBulkConfirm}
        onDelete={handleBulkDelete}
        isLoading={bulkLoading}
        progress={bulkProgress}
        canDisable={false}
        emptyMessage={todas.estado === 'carregando'
          ? `Carregando todas as reutilizações${contagens ? ` (${contagens.total.toLocaleString('pt-BR')} registros)` : ''}…`
          : todas.estado === 'erro'
            ? mensagemDeErro(todas.erro, 'Não foi possível carregar as reutilizações. Feche e tente de novo.')
            : undefined}
      />
      </Suspense>
      </LimiteDeErro>
      )}

      {/* Modal explicativo do fluxo de aceite */}
      <FluxoReutilizacaoModal isOpen={isFluxoOpen} onClose={() => setIsFluxoOpen(false)} />
    </div>
  );
}

/** Cartões da fila no servidor que ainda não vieram (null = há mais, total desconhecido). */
const restantes = (f: { itens: Reutilizacao[]; temMais: boolean; total: number | null }): number | null =>
  !f.temMais ? 0 : f.total !== null ? Math.max(1, f.total - f.itens.length) : null;

/**
 * Cartões das filas, `limite` por vez. No modo legado a lista está toda em
 * memória; no servidor (`restantesServidor`) só os carregados, e "Mostrar
 * mais" amplia o limite da consulta.
 */
function ListaCartoes({ itens, limite, onMais, render, restantesServidor }: {
  itens: Reutilizacao[]; limite: number; onMais: () => void; render: (u: Reutilizacao) => React.ReactNode;
  restantesServidor?: number | null;
}) {
  const faltam = restantesServidor !== undefined ? restantesServidor : Math.max(0, itens.length - limite);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {itens.slice(0, limite).map(render)}
      {faltam !== 0 && (
        <button type="button" className="btn" onClick={onMais} style={{ alignSelf: 'center' }}>
          Mostrar mais{faltam !== null ? ` (${faltam.toLocaleString('pt-BR')} restantes)` : ''}
        </button>
      )}
    </div>
  );
}
