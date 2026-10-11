import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode, useSyncExternalStore } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../data/datasources/firebase';
import { Categoria, Tipo } from '../domain/entities/categoria';
import { Familia } from '../domain/entities/familia';
import { Produto } from '../domain/entities/produto';
import { Dispositivo, calcularPropagacaoImagens, normalizarNumeroPeca, planejarLimpezaDuplicados } from '../domain/entities/dispositivo';
import { Reutilizacao, ReutilizacaoStatus, transicaoReutilizacaoPermitida } from '../domain/entities/reutilizacao';
import { AuditLog } from '../domain/entities/auditLog';

import { FirestoreDispositivosRepository } from '../data/repositories/FirestoreDispositivosRepository';
import { FirestoreCategoriasRepository } from '../data/repositories/FirestoreCategoriasRepository';
import { FirestoreFamiliasRepository } from '../data/repositories/FirestoreFamiliasRepository';
import { FirestoreProdutosRepository } from '../data/repositories/FirestoreProdutosRepository';
import { FirestoreReutilizacoesRepository } from '../data/repositories/FirestoreReutilizacoesRepository';
import { FirestoreAuditLogRepository } from '../data/repositories/FirestoreAuditLogRepository';
import {
  obterDispositivo, obterDispositivosPorIds, obterDispositivosPorCodigo, varrerDispositivos, varrerColecao, ProgressoVarredura, contarDispositivos
} from '../data/repositories/FirestoreDispositivosConsultas';
import { ITENS_POR_PARTE } from '../domain/services/buscaDispositivos';
import { contarComChave, prepararChavesImportacao, ResultadoPreparoChaves } from '../data/repositories/importacaoDispositivosFirestore';
import { MetaIndice, lerMetaIndiceDoServidor, reconstruirIndice, metaRef, parteRef } from '../data/repositories/FirestoreIndiceDispositivos';
import { indiceBusca } from '../data/repositories/IndiceBuscaStore';
import {
  assinarCatalogoClassificacoes, catalogoClassificacoesRef, contarClassificacoes, criarCatalogoClassificacoes, gravarClassificacao, listasDoCatalogo,
} from '../data/repositories/FirestoreClassificacoes';
import { limparCache } from '../data/cache/cacheLocal';
import { ImportarLoteUseCase } from '../application/usecases/ImportarLoteUseCase';
import { OpcoesImportacaoLote, ResultadoImportacaoLote } from '../domain/repositories/IDispositivosRepository';
import { idNotificacao } from '../domain/entities/notificacao';
import { useAuth } from './AuthContext';

// Inicialização de Repositórios e Casos de Uso (Interface Adapters / Application Layer)
const dispositivosRepo = new FirestoreDispositivosRepository();
const categoriasRepo = new FirestoreCategoriasRepository();
const familiasRepo = new FirestoreFamiliasRepository();
const produtosRepo = new FirestoreProdutosRepository();
const reutilizacoesRepo = new FirestoreReutilizacoesRepository();
const auditRepo = new FirestoreAuditLogRepository();
const importarLoteUseCase = new ImportarLoteUseCase(dispositivosRepo);

/** Progresso das ações em massa: itens feitos, total e o nome da etapa atual. */
/** Já existe uma classificação com o mesmo nome; `idExistente` aponta qual. */
export class ErroNomeDuplicado extends Error {
  constructor(mensagem: string, public idExistente: string) {
    super(mensagem);
    this.name = 'ErroNomeDuplicado';
  }
}

export type ProgressoEmMassa = (feitos: number, total: number, etapa?: string) => void;
export interface ResultadoEmMassa { sucesso: number; erros: number; cancelado?: boolean }

interface ReToolContextType {
  /** Dados de referência (pequenos): carregados em tempo real só após o login. */
  categorias: Categoria[];
  tipos: Tipo[];
  familias: Familia[];
  produtos: Produto[];
  referenciasProntas: boolean;
  erroReferencias: string | null;
  /** Reabre as consultas dos dados de referência depois de um erro. */
  recarregarReferencias: () => void;
  /** Muda a cada alteração de dispositivos feita nesta sessão (telas que contam/listam recarregam). */
  revisaoDispositivos: number;
  addDispositivo: (data: Omit<Dispositivo, 'id' | 'dataCriacao'> & { id?: string }) => Promise<void>;
  updateDispositivo: (id: string, data: Partial<Dispositivo>, silent?: boolean) => Promise<void>;
  deleteDispositivo: (id: string, silent?: boolean) => Promise<void>;
  desativarDispositivosEmLote: (ids: string[], onProgresso?: ProgressoEmMassa, sinal?: AbortSignal) => Promise<ResultadoEmMassa>;
  excluirDispositivosEmLote: (ids: string[], onProgresso?: ProgressoEmMassa, sinal?: AbortSignal) => Promise<ResultadoEmMassa>;
  addCategoria: (data: Omit<Categoria, 'id'>) => Promise<string>;
  updateCategoria: (id: string, data: Partial<Categoria>, silent?: boolean) => Promise<void>;
  deleteCategoria: (id: string, silent?: boolean) => Promise<void>;
  addTipo: (data: Omit<Tipo, 'id'>) => Promise<void>;
  updateTipo: (id: string, data: Partial<Tipo>) => Promise<void>;
  deleteTipo: (id: string) => Promise<void>;
  addFamilia: (data: Omit<Familia, 'id'>) => Promise<string>;
  updateFamilia: (id: string, data: Partial<Familia>, silent?: boolean) => Promise<void>;
  deleteFamilia: (id: string, silent?: boolean) => Promise<void>;
  addProduto: (data: Omit<Produto, 'id'>) => Promise<string>;
  updateProduto: (id: string, data: Partial<Produto>, silent?: boolean) => Promise<void>;
  deleteProduto: (id: string, silent?: boolean) => Promise<void>;
  addReutilizacao: (data: Omit<Reutilizacao, 'id' | 'dataCriacao'>) => Promise<void>;
  solicitarReutilizacao: (data: Omit<Reutilizacao, 'id' | 'dataCriacao' | 'status'>, solicitanteNome: string, solicitanteId?: string) => Promise<void>;
  transicionarReutilizacao: (id: string, para: ReutilizacaoStatus, opts?: { motivo?: string; numeroOs?: string }) => Promise<void>;
  updateReutilizacao: (id: string, data: Partial<Reutilizacao>) => Promise<void>;
  deleteReutilizacao: (id: string, silent?: boolean) => Promise<void>;
  importarDispositivosEmLote: (novosDispositivos: Partial<Dispositivo>[], newCategoriasNomes: string[], newFamiliasNomes: string[], newProdutosNomes: string[], opcoes?: OpcoesImportacaoLote) => Promise<ResultadoImportacaoLote>;
  deleteAllData: (onProgresso?: (p: { etapa: string; feitos: number; total: number | null }) => void) => Promise<void>;
  /** `base` = varredura completa recém-feita em DuplicadosModal; tudo é conferido de novo antes de apagar. */
  limparDispositivosDuplicados: (
    ids: string[],
    base: Dispositivo[],
    onProgresso?: (p: { etapa: string; feitos: number; total: number | null }) => void,
    sinal?: AbortSignal
  ) => Promise<{ excluidos: number; erros: number; falhas: string[]; cancelado?: boolean }>;
  /** Recria o catálogo de busca lendo a coleção em páginas (ação administrativa explícita). */
  reconstruirIndiceBusca: (onProgresso?: (p: ProgressoVarredura) => void, sinal?: AbortSignal) => Promise<number>;
  /** Quantos dispositivos existem e quantos já têm a chave da importação rápida (2 count()). */
  estadoImportacaoRapida: () => Promise<{ total: number; comChave: number }>;
  /** Grava a chave Código + Dispositivo nos que faltam (Administração; retoma de onde parou). */
  prepararImportacaoRapida: (onProgresso?: (p: { lidos: number; gravados: number }) => void, sinal?: AbortSignal) => Promise<ResultadoPreparoChaves>;
  announce: (message: string, showToast?: boolean) => void;
  isDispFormOpen: boolean;
  editingDispId: string | null;
  openDispForm: (id?: string) => void;
  closeDispForm: () => void;
}

const ReToolContext = createContext<ReToolContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Avisos (toasts + leitor de tela) num store próprio: um aviso não re-renderiza
// o provedor nem as telas, só o contêiner de toasts e a região aria-live.
// ---------------------------------------------------------------------------
type Toast = { id: string; text: string };
const avisos = {
  anuncio: '',
  toasts: [] as Toast[],
  ouvintes: new Set<() => void>(),
  emitir() { for (const o of this.ouvintes) o(); },
};
const assinarAvisos = (o: () => void) => { avisos.ouvintes.add(o); return () => { avisos.ouvintes.delete(o); }; };

function anunciar(message: string, showToast = true) {
  avisos.anuncio = '';
  avisos.emitir();
  setTimeout(() => { avisos.anuncio = message; avisos.emitir(); }, 50);
  if (showToast) {
    const id = uuidv4();
    avisos.toasts = [...avisos.toasts, { id, text: message }];
    avisos.emitir();
    setTimeout(() => {
      avisos.toasts = avisos.toasts.filter(t => t.id !== id);
      avisos.emitir();
    }, 3500);
  }
}

/** Texto atual da região aria-live (Layout). */
export function useAnuncio(): string {
  return useSyncExternalStore(assinarAvisos, () => avisos.anuncio, () => '');
}

function ToastsGlobais() {
  const toasts = useSyncExternalStore(assinarAvisos, () => avisos.toasts, () => avisos.toasts);
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: 'var(--spacing-xl)',
        right: 'var(--spacing-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      {toasts.map(t => (
        <div key={t.id} className="toast-notification" style={{
          backgroundColor: '#1f2937',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)',
          fontSize: '0.9rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
          {t.text}
        </div>
      ))}
    </div>
  );
}

/**
 * Meta do catálogo para gravar junto com um dispositivo (null = catálogo
 * ainda não existe). Usa a meta acompanhada em tempo real quando há; senão
 * lê do servidor (1 leitura). Se a leitura falhar, a gravação NÃO acontece:
 * gravar sem atualizar o catálogo deixaria a busca desatualizada em silêncio.
 */
async function metaParaEscrita(): Promise<MetaIndice | null> {
  const s = indiceBusca.obter();
  if (indiceBusca.acompanhando() && s.estado === 'pronto' && s.meta) return s.meta;
  try {
    return await lerMetaIndiceDoServidor();
  } catch (e) {
    console.error('Não foi possível ler o índice de busca antes de gravar:', e);
    throw new Error('Não foi possível confirmar o índice de busca. Verifique a conexão e tente novamente.');
  }
}

export const ReToolProvider = ({ children }: { children: ReactNode }) => {
  const { userProfile, currentRole, users, criarNotificacao } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregadas, setCarregadas] = useState({ cat: false, fam: false, prod: false });
  const [erroReferencias, setErroReferencias] = useState<string | null>(null);
  const [revisaoDispositivos, setRevisaoDispositivos] = useState(0);
  const tocarDispositivos = useCallback(() => setRevisaoDispositivos(r => r + 1), []);

  const [isDispFormOpen, setIsDispFormOpen] = useState(false);
  const [editingDispId, setEditingDispId] = useState<string | null>(null);

  const announce = useCallback((message: string, showToast = true) => anunciar(message, showToast), []);

  const openDispForm = useCallback((id?: string) => {
    if (id) {
      if (currentRole !== 'admin' && currentRole !== 'projetista') {
        announce('Acesso negado: seu perfil não possui permissão para editar dispositivos.');
        return;
      }
    } else {
      if (currentRole !== 'admin' && currentRole !== 'projetista') {
        announce('Acesso negado: seu perfil não possui permissão para cadastrar dispositivos.');
        return;
      }
    }
    setEditingDispId(id || null);
    setIsDispFormOpen(true);
  }, [currentRole, announce]);

  const closeDispForm = useCallback(() => {
    setIsDispFormOpen(false);
    setEditingDispId(null);
  }, []);

  // Dados de referência (categorias, tipos, famílias, produtos) em tempo real,
  // SOMENTE com usuário autenticado e ativo: antes do login as regras negam a
  // leitura e o listener morria sem voltar (lista vazia até recarregar a página).
  // Dispositivos e reutilizações NÃO são mais assinados aqui: cada tela consulta
  // só o que exibe (ver PERFORMANCE.md).
  const uid = userProfile?.uid;
  const [tentativaRef, setTentativaRef] = useState(0);
  /** O catálogo `indices/classificacoes` existe e confere: gravações o mantêm. */
  const catalogoClassifAtivo = useRef(false);
  const currentRoleRef = useRef(currentRole);
  currentRoleRef.current = currentRole;
  const recarregarReferencias = useCallback(() => {
    setCarregadas({ cat: false, fam: false, prod: false });
    setTentativaRef(t => t + 1);
  }, []);
  useEffect(() => {
    if (!uid) {
      setCategorias([]); setTipos([]); setFamilias([]); setProdutos([]);
      setCarregadas({ cat: false, fam: false, prod: false });
      return;
    }
    setErroReferencias(null);
    let vivo = true;
    const marcar = (k: 'cat' | 'fam' | 'prod') => setCarregadas(c => (c[k] ? c : { ...c, [k]: true }));
    const falhou = (e: unknown) => setErroReferencias(String((e as { code?: string })?.code || 'erro'));
    // `tipos` não é assinada: não tem regra no firestore.rules (toda leitura
    // era negada, um erro 403 a cada abertura) e nenhuma tela a usa.

    // Plano B: as três coleções em tempo real (catálogo ausente ou divergente).
    // Quem pode editar recria o catálogo assim que as três chegam.
    let pararColecoes: (() => void) | null = null;
    const usarColecoes = () => {
      if (pararColecoes || !vivo) return;
      catalogoClassifAtivo.current = false;
      const chegou = { cat: null as Categoria[] | null, fam: null as Familia[] | null, prod: null as Produto[] | null };
      let recriado = false;
      const talvezRecriar = () => {
        if (recriado || !chegou.cat || !chegou.fam || !chegou.prod) return;
        recriado = true;
        if (currentRoleRef.current !== 'admin' && currentRoleRef.current !== 'projetista') return;
        criarCatalogoClassificacoes(chegou.cat, chegou.fam, chegou.prod)
          .then(() => { if (vivo) catalogoClassifAtivo.current = true; })
          .catch(e => console.warn('Não foi possível criar o catálogo de classificações:', e));
      };
      const a = categoriasRepo.subscribeCategorias(l => { setCategorias(l); marcar('cat'); chegou.cat = l; talvezRecriar(); }, falhou);
      const b = familiasRepo.subscribeAll(l => { setFamilias(l); marcar('fam'); chegou.fam = l; talvezRecriar(); }, falhou);
      const c = produtosRepo.subscribeAll(l => { setProdutos(l); marcar('prod'); chegou.prod = l; talvezRecriar(); }, falhou);
      pararColecoes = () => { a(); b(); c(); };
    };

    // Plano A: 1 documento com as três listas, conferido por contagem.
    let conferido = false;
    const pararCatalogo = assinarCatalogoClassificacoes(async cat => {
      if (!vivo || pararColecoes) return;
      if (!cat) { usarColecoes(); return; }
      const listas = listasDoCatalogo(cat);
      if (!conferido) {
        try {
          const n = await contarClassificacoes();
          if (!vivo || pararColecoes) return;
          if (n.categorias !== listas.categorias.length || n.familias !== listas.familias.length || n.produtos !== listas.produtos.length) {
            usarColecoes();
            return;
          }
          conferido = true;
        } catch (e) {
          falhou(e);
          usarColecoes();
          return;
        }
      }
      catalogoClassifAtivo.current = true;
      setCategorias(listas.categorias);
      setFamilias(listas.familias);
      setProdutos(listas.produtos);
      marcar('cat'); marcar('fam'); marcar('prod');
    }, () => usarColecoes());

    return () => {
      vivo = false;
      pararCatalogo();
      pararColecoes?.();
    };
  }, [uid, tentativaRef]);

  // Logout: esquece o catálogo de busca em memória e no disco.
  const uidAnterior = useRef<string | undefined>(uid);
  useEffect(() => {
    if (uidAnterior.current && !uid) {
      indiceBusca.parar();
      void limparCache();
    }
    uidAnterior.current = uid;
  }, [uid]);

  const referenciasProntas = carregadas.cat && carregadas.fam && carregadas.prod;
  useEffect(() => {
    if (!uid || referenciasProntas) return;
    // Sem resposta em 20 s: informa em vez de deixar "carregando" para sempre.
    const t = setTimeout(() => setErroReferencias(e => e || 'timeout'), 20000);
    return () => clearTimeout(t);
  }, [uid, referenciasProntas, tentativaRef]);

  // O Firestore recusa campos `undefined` (ex.: dadosAnteriores ausente em
  // importações e solicitações), o que fazia o registro de auditoria falhar.
  // JSON.stringify omite propriedades undefined (inclusive aninhadas).
  const semIndefinidos = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

  // "Event Handler" central de auditoria: acionado no sucesso de cada mutação.
  // A falha no registro nunca derruba a operação principal.
  const dadosAuditoria = (
    acao: AuditLog['acao'],
    tipoEntidade: AuditLog['tipoEntidade'],
    entidadeId: string,
    entidadeNome: string,
    acaoDescricao: string,
    conteudo?: Record<string, any>,
    dadosAnteriores?: Record<string, any>
  ) => semIndefinidos({
    usuarioUid: userProfile?.uid || 'sistema',
    usuarioNome: userProfile?.nome || 'Desconhecido',
    usuarioEmail: userProfile?.email || '',
    usuarioPerfil: currentRole,
    acao,
    acaoDescricao,
    tipoEntidade,
    entidadeId,
    entidadeNome,
    detalhes: acaoDescricao,
    conteudo,
    dadosAnteriores
  });

  const registrarAuditoria = async (...args: Parameters<typeof dadosAuditoria>) => {
    try {
      await auditRepo.registrarLog(dadosAuditoria(...args));
    } catch (e) {
      console.warn('Erro ao registrar log de auditoria:', e);
    }
  };

  const logAuditExclusao = async (tipoEntidade: any, id: string, nome?: string, dadosAnteriores?: any) => {
    await registrarAuditoria(
      'exclusao',
      tipoEntidade,
      id,
      nome || id,
      `Exclusão de ${tipoEntidade}: ${nome || id}`,
      dadosAnteriores,
      dadosAnteriores
    );
  };

  // Propagação automática de imagens por Número da Peça: um único upload
  // alimenta todas as células vazias da mesma linha (nunca sobrescreve
  // imagens existentes nem toca dispositivos de outras linhas). A linha é
  // consultada no servidor pelo código (não há mais a coleção em memória).
  const propagarImagensPorCodigo = async (
    origemId: string,
    codigo: string | undefined,
    payload: Partial<Dispositivo>,
    isNew: boolean
  ) => {
    const chave = normalizarNumeroPeca(codigo);
    if (!chave) return;
    const temImagem = !!(payload.imagemPeca || payload.imagemDispositivo);
    if (!temImagem && !isNew) return; // nada a propagar (evita a consulta)
    const linha = (await obterDispositivosPorCodigo(codigo || '')).filter(d => normalizarNumeroPeca(d.codigo) === chave);
    // A consulta acima só acha as grafias exatas (original, sem espaços,
    // MAIÚSCULA, minúscula). Se o catálogo de busca já está carregado nesta
    // sessão, ele aponta também as grafias mistas ("Abc", " abc ") sem custo
    // extra de consulta; os documentos que faltarem são lidos por id.
    const snapIndice = indiceBusca.obter();
    if (indiceBusca.acompanhando() && snapIndice.estado === 'pronto') {
      const conhecidos = new Set(linha.map(d => d.id));
      const faltantes = snapIndice.entradas
        .filter(e => !conhecidos.has(e.id) && normalizarNumeroPeca(e.codigo) === chave)
        .map(e => e.id);
      if (faltantes.length) {
        const extras = await obterDispositivosPorIds(faltantes);
        linha.push(...extras.filter(d => normalizarNumeroPeca(d.codigo) === chave));
      }
    }
    const patches = calcularPropagacaoImagens(linha, origemId, codigo, payload, isNew);
    if (patches.length === 0) return;

    const meta = await metaParaEscrita();
    for (const p of patches) {
      const alvo = linha.find(d => d.id === p.id) || null;
      await dispositivosRepo.update(p.id, p.patch, alvo, meta);
      await registrarAuditoria(
        'edicao',
        'dispositivo',
        p.id,
        alvo?.nome || alvo?.codigo || p.id,
        p.origem === 'propagacao'
          ? 'Imagem propagada automaticamente (mesmo número de peça)'
          : 'Imagem herdada automaticamente da linha (mesmo número de peça)',
        { origemId, numeroPeca: codigo, campos: Object.keys(p.patch) }
      );
    }
    announce(`Imagens sincronizadas em ${patches.length} dispositivo(s) da linha ${codigo}.`);
  };

  const addDispositivo = async (data: Omit<Dispositivo, 'id' | 'dataCriacao'> & { id?: string }) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar dispositivos.');
      return;
    }
    const novoId = await dispositivosRepo.add(data, await metaParaEscrita());
    await registrarAuditoria('criacao', 'dispositivo', novoId, data.nome, 'Cadastrou dispositivo', { ...data });
    await propagarImagensPorCodigo(novoId, data.codigo, data, true);
    tocarDispositivos();
    announce('Dispositivo adicionado com sucesso');
  };

  const updateDispositivo = async (id: string, data: Partial<Dispositivo>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar dispositivos.');
      return;
    }
    const atual = await obterDispositivo(id);
    await dispositivosRepo.update(id, data, atual, await metaParaEscrita());
    await registrarAuditoria('edicao', 'dispositivo', id, atual?.nome || id, 'Editou dispositivo', { valoresAlterados: data }, atual || undefined);
    await propagarImagensPorCodigo(id, data.codigo ?? atual?.codigo, data, false);
    tocarDispositivos();
    if (!silent) announce('Dispositivo atualizado com sucesso');
  };

  const deleteDispositivo = async (id: string, silent = false) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir dispositivos.');
      return;
    }
    const [disp, relacoes] = await Promise.all([obterDispositivo(id), reutilizacoesRepo.listarDoDispositivo(id)]);
    // Dispositivo, reutilizações associadas e entrada do catálogo saem juntos.
    await dispositivosRepo.delete(id, relacoes.map(u => u.id), await metaParaEscrita());
    await logAuditExclusao('dispositivo', id, disp?.nome, disp || undefined);
    tocarDispositivos();
    if (!silent) announce('Dispositivo removido com sucesso');
  };

  const desativarDispositivosEmLote = async (ids: string[], onProgresso?: ProgressoEmMassa, sinal?: AbortSignal): Promise<ResultadoEmMassa> => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para editar dispositivos.');
      return { sucesso: 0, erros: ids.length };
    }
    onProgresso?.(0, ids.length, 'Preparando');
    const patch: Partial<Dispositivo> = { ativo: false };
    const meta = await metaParaEscrita();
    // Lê e grava em blocos de 150: o estado usado no catálogo é o de segundos
    // antes da gravação (não o do início de uma operação de minutos).
    let sucesso = 0, erros = 0;
    const blocos = Math.ceil(ids.length / 150);
    for (let i = 0; i < ids.length; i += 150) {
      // Cancelamento entre lotes: o que já foi gravado fica.
      if (sinal?.aborted) { tocarDispositivos(); return { sucesso, erros, cancelado: true }; }
      const bloco = ids.slice(i, i + 150);
      const lote = `lote ${i / 150 + 1} de ${blocos}`;
      onProgresso?.(i, ids.length, `Lendo dados atuais (${lote})`);
      let atuais: Dispositivo[];
      try {
        atuais = await obterDispositivosPorIds(bloco, (lidos, total) =>
          onProgresso?.(i, ids.length, `Lendo dados atuais: ${lidos} de ${total} (${lote})`));
        onProgresso?.(i, ids.length, `Gravando ${lote}`);
      } catch (e) {
        erros += ids.length - i;
        console.error(e);
        break;
      }
      const r = await dispositivosRepo.atualizarEmLote(
        atuais, patch, meta,
        (b, d) => auditRepo.adicionarAoBatch(b, dadosAuditoria('edicao', 'dispositivo', d.id, d.nome || d.id, 'Editou dispositivo', { valoresAlterados: patch }, d))
      );
      sucesso += r.sucesso;
      erros += r.erros + (bloco.length - atuais.length);
      onProgresso?.(Math.min(ids.length, i + bloco.length), ids.length, `Gravado ${lote}`);
      if (r.falhas.some(f => /resource-exhausted|quota/i.test(f))) { erros += ids.length - i - bloco.length; break; }
    }
    tocarDispositivos();
    return { sucesso, erros };
  };

  const excluirDispositivosEmLote = async (ids: string[], onProgresso?: ProgressoEmMassa, sinal?: AbortSignal): Promise<ResultadoEmMassa> => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir dispositivos.');
      return { sucesso: 0, erros: ids.length };
    }
    // Lotes de 150: lê os dados atuais e as reutilizações vinculadas do lote,
    // exclui e só então passa ao próximo. O progresso anda desde o primeiro
    // lote e o cancelamento vale entre lotes (o que já foi excluído fica).
    const meta = await metaParaEscrita();
    let sucesso = 0, erros = 0;
    const tam = 150;
    const blocos = Math.ceil(ids.length / tam);
    for (let i = 0; i < ids.length; i += tam) {
      if (sinal?.aborted) { tocarDispositivos(); return { sucesso, erros, cancelado: true }; }
      const bloco = ids.slice(i, i + tam);
      const lote = `lote ${i / tam + 1} de ${blocos}`;
      onProgresso?.(i, ids.length, `Lendo dados atuais (${lote})`);
      let atuais: Dispositivo[], relacoes: { id: string; dispositivoId: string }[];
      try {
        atuais = await obterDispositivosPorIds(bloco, (lidos, total) =>
          onProgresso?.(i, ids.length, `Lendo dados atuais: ${lidos} de ${total} (${lote})`));
        onProgresso?.(i, ids.length, `Lendo reutilizações vinculadas (${lote})`);
        relacoes = await reutilizacoesRepo.listarDosDispositivos(bloco);
      } catch (e) {
        console.error(e);
        erros += ids.length - i;
        break;
      }
      const porDisp = new Map<string, string[]>();
      for (const u of relacoes) porDisp.set(u.dispositivoId, [...(porDisp.get(u.dispositivoId) || []), u.id]);
      const r = await dispositivosRepo.excluirComVinculosEmLote(
        atuais.map(d => ({ dispositivo: d, reutilizacaoIds: porDisp.get(d.id) || [] })),
        meta,
        (b, d) => auditRepo.adicionarAoBatch(b, dadosAuditoria('exclusao', 'dispositivo', d.id, d.nome || d.id, `Exclusão de dispositivo: ${d.nome || d.id}`, d, d)),
        (feitos) => onProgresso?.(i + feitos, ids.length, `Excluindo (${lote})`)
      );
      sucesso += r.excluidos;
      erros += r.erros + (bloco.length - atuais.length);
      onProgresso?.(Math.min(ids.length, i + bloco.length), ids.length, `Excluído ${lote}`);
      if (r.falhas.some(f => /resource-exhausted|quota/i.test(f))) { erros += ids.length - i - bloco.length; break; }
    }
    tocarDispositivos();
    return { sucesso, erros };
  };

  // Nomes de classificação não se repetem (ignora caixa e espaços): o
  // primeiro cadastrado vale e o erro informa qual é (para a tela selecioná-lo).
  const exigirNomeNovo = (lista: { id: string; nome?: string }[], nome: string, rotulo: string) => {
    const chave = (nome || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const existente = lista.find(i => (i.nome || '').trim().replace(/\s+/g, ' ').toLowerCase() === chave);
    if (existente) throw new ErroNomeDuplicado(`Já existe ${rotulo} com o nome "${existente.nome}".`, existente.id);
  };

  const addCategoria = async (data: Omit<Categoria, 'id'>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar categorias.');
      return '';
    }
    exigirNomeNovo(categorias, data.nome, 'uma categoria');
    const id = await gravarClassificacao('categorias', 'criar', null, data as Record<string, unknown>, catalogoClassifAtivo.current);
    await registrarAuditoria('criacao', 'categoria', id, data.nome, 'Cadastrou categoria', { ...data });
    announce('Categoria adicionada com sucesso');
    return id;
  };

  const updateCategoria = async (id: string, data: Partial<Categoria>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar categorias.');
      return;
    }
    const atual = categorias.find(c => c.id === id);
    if (typeof data.nome === 'string' && data.nome.trim() !== (categorias.find(i => i.id === id)?.nome || '').trim()) exigirNomeNovo(categorias.filter(i => i.id !== id), data.nome, 'uma categoria');
    await gravarClassificacao('categorias', 'alterar', id, data as Record<string, unknown>, catalogoClassifAtivo.current);
    await registrarAuditoria('edicao', 'categoria', id, atual?.nome || id, 'Editou categoria', { valoresAlterados: data }, atual);
    if (!silent) announce('Categoria atualizada com sucesso');
  };

  const deleteCategoria = async (id: string, silent = false) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir categorias.');
      return;
    }
    const cat = categorias.find(c => c.id === id);
    await gravarClassificacao('categorias', 'excluir', id, null, catalogoClassifAtivo.current);
    await logAuditExclusao('categoria', id, cat?.nome, cat);
    if (!silent) announce('Categoria removida com sucesso');
  };

  const addTipo = async (data: Omit<Tipo, 'id'>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar tipos.');
      return;
    }
    const novoId = await categoriasRepo.addTipo(data);
    await registrarAuditoria('criacao', 'tipo', novoId, data.nome, 'Cadastrou tipo', { ...data });
    announce('Tipo adicionado com sucesso');
  };

  const updateTipo = async (id: string, data: Partial<Tipo>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para editar tipos.');
      return;
    }
    const atual = tipos.find(t => t.id === id);
    await categoriasRepo.updateTipo(id, data);
    await registrarAuditoria('edicao', 'tipo', id, atual?.nome || id, 'Editou tipo', { valoresAlterados: data }, atual);
    announce('Tipo atualizado com sucesso');
  };

  const deleteTipo = async (id: string) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir tipos.');
      return;
    }
    const tip = tipos.find(t => t.id === id);
    await categoriasRepo.deleteTipo(id);
    await logAuditExclusao('tipo', id, tip?.nome, tip);
    announce('Tipo removido com sucesso');
  };

  const addFamilia = async (data: Omit<Familia, 'id'>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar famílias.');
      return '';
    }
    exigirNomeNovo(familias, data.nome, 'uma família');
    const id = await gravarClassificacao('familias', 'criar', null, data as Record<string, unknown>, catalogoClassifAtivo.current);
    await registrarAuditoria('criacao', 'familia', id, data.nome, 'Cadastrou família', { ...data });
    announce('Família adicionada com sucesso');
    return id;
  };

  const updateFamilia = async (id: string, data: Partial<Familia>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar famílias.');
      return;
    }
    const atual = familias.find(f => f.id === id);
    if (typeof data.nome === 'string' && data.nome.trim() !== (familias.find(i => i.id === id)?.nome || '').trim()) exigirNomeNovo(familias.filter(i => i.id !== id), data.nome, 'uma família');
    await gravarClassificacao('familias', 'alterar', id, data as Record<string, unknown>, catalogoClassifAtivo.current);
    await registrarAuditoria('edicao', 'familia', id, atual?.nome || id, 'Editou família', { valoresAlterados: data }, atual);
    if (!silent) announce('Família atualizada com sucesso');
  };

  const deleteFamilia = async (id: string, silent = false) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir famílias.');
      return;
    }
    const fam = familias.find(f => f.id === id);
    await gravarClassificacao('familias', 'excluir', id, null, catalogoClassifAtivo.current);
    await logAuditExclusao('familia', id, fam?.nome, fam);
    if (!silent) announce('Família removida com sucesso');
  };

  const addProduto = async (data: Omit<Produto, 'id'>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar produtos.');
      return '';
    }
    exigirNomeNovo(produtos, data.nome, 'um produto');
    const id = await gravarClassificacao('produtos', 'criar', null, data as Record<string, unknown>, catalogoClassifAtivo.current);
    await registrarAuditoria('criacao', 'produto', id, data.nome, 'Cadastrou produto', { ...data });
    announce('Produto adicionado com sucesso');
    return id;
  };

  const updateProduto = async (id: string, data: Partial<Produto>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar produtos.');
      return;
    }
    const atual = produtos.find(p => p.id === id);
    if (typeof data.nome === 'string' && data.nome.trim() !== (produtos.find(i => i.id === id)?.nome || '').trim()) exigirNomeNovo(produtos.filter(i => i.id !== id), data.nome, 'um produto');
    await gravarClassificacao('produtos', 'alterar', id, data as Record<string, unknown>, catalogoClassifAtivo.current);
    await registrarAuditoria('edicao', 'produto', id, atual?.nome || id, 'Editou produto', { valoresAlterados: data }, atual);
    if (!silent) announce('Produto atualizado com sucesso');
  };

  const deleteProduto = async (id: string, silent = false) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir produtos.');
      return;
    }
    const prod = produtos.find(p => p.id === id);
    await gravarClassificacao('produtos', 'excluir', id, null, catalogoClassifAtivo.current);
    await logAuditExclusao('produto', id, prod?.nome, prod);
    if (!silent) announce('Produto removido com sucesso');
  };

  const nomeDoDispositivo = async (id: string) => {
    try {
      return (await obterDispositivo(id))?.nome;
    } catch {
      return undefined;
    }
  };

  const addReutilizacao = async (data: Omit<Reutilizacao, 'id' | 'dataCriacao'>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: Engenharia deve utilizar a opção Solicitar Reutilização.');
      return;
    }
    const novoId = await reutilizacoesRepo.add({
      ...data,
      status: data.status || 'Reutilização aprovada'
    });
    const dispNome = (await nomeDoDispositivo(data.dispositivoId)) || data.dispositivoId;
    await registrarAuditoria('criacao', 'reutilizacao', novoId, dispNome, 'Cadastrou reutilização', { dispositivoId: data.dispositivoId, codigoPeca: data.codigoPeca, hardSaving: data.hardSaving });
    announce('Reutilização adicionada com sucesso');
  };

  const solicitarReutilizacao = async (
    data: Omit<Reutilizacao, 'id' | 'dataCriacao' | 'status'>,
    solicitanteNome: string,
    solicitanteId?: string
  ) => {
    if (currentRole === 'gerencia') {
      announce('Acesso negado: perfil de Gerência possui acesso somente de consulta.');
      return;
    }
    const solicitanteUid = solicitanteId || userProfile?.uid || 'eng';
    const novoId = await reutilizacoesRepo.add({
      ...data,
      status: 'Em análise (Engenharia)',
      solicitanteNome,
      solicitanteId: solicitanteUid
    });
    const dispNome = (await nomeDoDispositivo(data.dispositivoId)) || data.dispositivoId;
    await registrarAuditoria('criacao', 'reutilizacao', novoId, dispNome, 'Solicitou reutilização', { dispositivoId: data.dispositivoId, codigoPeca: data.codigoPeca, descricaoAlteracao: data.descricaoAlteracao, hardSaving: data.hardSaving });
    announce('Solicitação registrada. Envie para a análise do Projetista na Fila da Engenharia.');
  };

  const notificarFilaProjetista = async (reu: Reutilizacao, descricao: string) => {
    const aprovadores = users.filter(
      u => u.ativo && (u.perfil === 'admin' || u.perfil === 'projetista') && u.uid !== userProfile?.uid
    );
    for (const aprovador of aprovadores) {
      try {
        await criarNotificacao({
          id: idNotificacao('reutilizacao_nova', reu.id, aprovador.uid),
          tipo: 'reutilizacao_nova',
          destinatarioUid: aprovador.uid,
          remetenteUid: userProfile?.uid || '',
          titulo: 'Nova tarefa na Fila do Projetista',
          descricao,
          dataHora: new Date().toISOString(),
          lida: false,
          entidadeId: reu.id,
          dispositivoId: reu.dispositivoId
        });
      } catch (e) {
        console.warn('Falha ao notificar Fila do Projetista:', e);
      }
    }
  };

  const notificarSolicitante = async (reu: Reutilizacao, titulo: string, descricao: string) => {
    if (!reu.solicitanteId || reu.solicitanteId === userProfile?.uid) return;
    try {
      await criarNotificacao({
        id: idNotificacao('reutilizacao_decidida', `${reu.id}:${titulo}`, reu.solicitanteId),
        tipo: 'reutilizacao_decidida',
        destinatarioUid: reu.solicitanteId,
        remetenteUid: userProfile?.uid || '',
        titulo,
        descricao,
        dataHora: new Date().toISOString(),
        lida: false,
        entidadeId: reu.id,
        dispositivoId: reu.dispositivoId
      });
    } catch (e) {
      console.warn('Falha ao notificar solicitante:', e);
    }
  };

  const transicionarReutilizacao = async (
    id: string,
    para: ReutilizacaoStatus,
    opts?: { motivo?: string; numeroOs?: string }
  ) => {
    const reu = await reutilizacoesRepo.obter(id);
    if (!reu) return;
    const de = reu.status || 'Em análise (Projetista)';

    if (!transicaoReutilizacaoPermitida(currentRole, de, para)) {
      announce('Acesso negado: seu perfil não executa essa etapa do fluxo.');
      return;
    }

    const dados: Partial<Reutilizacao> = { status: para };
    const decisaoProjetista =
      (de === 'Em análise (Projetista)' && (para === 'Reutilização aprovada' || para === 'Reutilização não aprovada')) ||
      (de === 'Aguardando novo filtro (Projetista)' && (para === 'Em análise (Projetista)' || para === 'Liberado para fabricação (novo dispositivo)'));
    if (decisaoProjetista) {
      dados.aprovadorNome = userProfile?.nome || 'Projetista';
      dados.aprovadorId = userProfile?.uid;
      dados.dataAprovacao = new Date().toISOString();
      if (para === 'Reutilização não aprovada' && opts?.motivo) dados.motivoRejeicao = opts.motivo;
    }
    if (opts?.numeroOs !== undefined) dados.numeroOs = opts.numeroOs;

    await reutilizacoesRepo.update(id, dados);

    const nomeDisp = (await nomeDoDispositivo(reu.dispositivoId)) || 'um dispositivo';

    // Auditoria da mudança de estado (ação legível conforme a transição executada)
    const descricaoTransicao = (() => {
      if (de === 'Em análise (Engenharia)' && para === 'Em análise (Projetista)') return 'Solicitou análise do Projetista (1º filtro)';
      if (para === 'Reutilização aprovada') return 'Aprovou Reutilização';
      if (para === 'Reutilização não aprovada') return 'Reprovou Reutilização';
      if (para === 'Aguardando novo filtro (Projetista)') return 'Solicitou Novo Filtro (dispositivo novo)';
      if (de === 'Aguardando novo filtro (Projetista)' && para === 'Em análise (Projetista)') return 'Marcou similar encontrado (análise retomada)';
      if (para === 'Liberado para fabricação (novo dispositivo)') return 'Liberou fabricação de novo dispositivo';
      return `Alterou status de "${de}" para "${para}"`;
    })();
    await registrarAuditoria(
      para === 'Reutilização aprovada' ? 'aprovacao'
        : para === 'Reutilização não aprovada' ? 'rejeicao'
        : 'transicao',
      'reutilizacao',
      id,
      nomeDisp,
      descricaoTransicao,
      { statusDe: de, statusPara: para, dispositivoId: reu.dispositivoId, motivo: opts?.motivo, numeroOs: opts?.numeroOs },
      { status: de }
    );

    if (para === 'Em análise (Projetista)' && de === 'Em análise (Engenharia)') {
      await notificarFilaProjetista(reu, `${userProfile?.nome || 'A Engenharia'} solicitou análise de reutilização de ${nomeDisp} (1º filtro).`);
    } else if (para === 'Em análise (Projetista)' && de === 'Aguardando novo filtro (Projetista)') {
      await notificarFilaProjetista(reu, `Similar encontrado para ${nomeDisp}: análise de reutilização retomada.`);
      await notificarSolicitante(reu, 'Similar encontrado', `O Projetista encontrou um similar para ${nomeDisp}; a análise de reutilização foi retomada.`);
    } else if (para === 'Reutilização aprovada') {
      await notificarSolicitante(reu, 'Reutilização aprovada', `Sua solicitação de reutilização de ${nomeDisp} foi aprovada.`);
    } else if (para === 'Reutilização não aprovada') {
      await notificarSolicitante(reu, 'Reutilização não aprovada', `Sua solicitação de reutilização de ${nomeDisp} não foi aprovada.${opts?.motivo ? ` Motivo: ${opts.motivo}` : ''}`);
    } else if (para === 'Aguardando novo filtro (Projetista)') {
      await notificarFilaProjetista(reu, `A Engenharia solicitou dispositivo novo para ${nomeDisp} (verificação de similares).`);
    } else if (para === 'Liberado para fabricação (novo dispositivo)') {
      await notificarSolicitante(reu, 'Liberado para fabricação', `Nenhum similar encontrado para ${nomeDisp}: novo dispositivo liberado para fabricação.`);
    }

    announce(`Status atualizado: ${para}`);
  };

  const updateReutilizacao = async (id: string, data: Partial<Reutilizacao>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para editar reutilizações.');
      return;
    }
    const atual = await reutilizacoesRepo.obter(id);
    await reutilizacoesRepo.update(id, data);
    await registrarAuditoria('edicao', 'reutilizacao', id, atual?.descricaoAlteracao || id, 'Editou reutilização', { valoresAlterados: data }, atual || undefined);
    announce('Reutilização atualizada com sucesso');
  };

  const deleteReutilizacao = async (id: string, silent = false) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir reutilizações.');
      return;
    }
    const reu = await reutilizacoesRepo.obter(id);
    await reutilizacoesRepo.delete(id);
    await logAuditExclusao('reutilizacao', id, reu?.descricaoAlteracao || id, reu || undefined);
    if (!silent) announce('Reutilização removida com sucesso');
  };

  const importarDispositivosEmLote = async (
    novosDispositivos: Partial<Dispositivo>[],
    newCategoriasNomes: string[],
    newFamiliasNomes: string[],
    newProdutosNomes: string[],
    opcoes?: OpcoesImportacaoLote
  ): Promise<ResultadoImportacaoLote> => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: apenas Administradoras e Projetistas podem importar dispositivos.');
      return { sucesso: 0, erros: novosDispositivos.length };
    }
    try {
      // Os existentes são sempre lidos do banco (paginado, 1 leitura por
      // dispositivo). O catálogo de busca não serve de fonte: ele pode estar
      // diferente do banco com o mesmo total (edição pelo Console, abas com
      // versão antiga do app) e a importação pularia atualizações achando
      // que "já estavam iguais". A economia continua nas escritas: só o que
      // mudou é gravado.
      const metaInicial = await lerMetaIndiceDoServidor();
      const result = await importarLoteUseCase.execute(
        novosDispositivos,
        newCategoriasNomes,
        newFamiliasNomes,
        newProdutosNomes,
        categorias,
        familias,
        produtos,
        { ...opcoes, indice: metaInicial, catalogoClassificacoes: catalogoClassifAtivo.current }
      );
      const inseridos = result.inseridos ?? result.sucesso;
      const atualizados = result.atualizados ?? 0;
      await registrarAuditoria(
        'importacao',
        'dispositivo',
        'importacao-lote',
        'Importação em lote',
        `Importação em lote: ${inseridos} inserido(s), ${atualizados} atualizado(s), ${result.erros} erro(s) de ${novosDispositivos.length} enviado(s)`,
        { enviados: novosDispositivos.length, sucesso: result.sucesso, inseridos, atualizados, erros: result.erros, ignoradosSemAlteracao: result.ignoradosSemAlteracao ?? 0, interrompido: result.interrompido ?? null }
      );
      // Cada lote já atualizou o catálogo. Ele só é refeito (a partir do que
      // a importação acabou de ler do banco inteiro: sem leitura extra, ~1
      // escrita por parte) quando precisa: total diferente do banco
      // (divergência antiga) ou partes cheias demais para o volume novo.
      // Refazer sem precisar mudaria todas as versões e faria todo navegador
      // baixar o catálogo de novo. Só se ninguém gravou no catálogo durante a
      // importação (senão a reconstrução apagaria essas alterações).
      if (result.documentosFinais && !result.interrompido && result.documentosLidos) {
        try {
          const metaAgora = await lerMetaIndiceDoServidor();
          const versoesSomadas = (m: MetaIndice | null) => Object.values(m?.versoes || {}).reduce((a, b) => a + b, 0);
          const tocadoSoPorEsta = !metaInicial || (metaAgora && metaAgora.geracao === metaInicial.geracao
            && versoesSomadas(metaAgora) - versoesSomadas(metaInicial) === (result.documentosGravados ?? 0));
          const n = result.documentosFinais.length;
          const precisa = !metaAgora || metaAgora.total !== n || n > metaAgora.partes * ITENS_POR_PARTE * 1.5;
          if (tocadoSoPorEsta && precisa) {
            const { alteradoNoMeio } = await reconstruirIndice(result.documentosFinais, metaAgora);
            if (alteradoNoMeio) console.warn('Índice de busca: houve gravação durante a reconstrução; atualize o índice para incluí-la.');
          }
        } catch (e) {
          console.warn('Falha ao atualizar o índice de busca após a importação:', e);
        }
      }
      tocarDispositivos();
      if (result.interrompido === 'cota') {
        announce(`Cota diária do Firebase atingida: ${result.sucesso} de ${novosDispositivos.length} registros gravados. Importe o mesmo arquivo amanhã para gravar o restante (sem duplicar).`);
      } else if (result.interrompido === 'cancelado') {
        announce(`Importação cancelada: ${result.sucesso} registros já gravados continuam salvos.`);
      } else if (result.erros > 0) {
        announce(`Importação parcial: ${result.sucesso} de ${novosDispositivos.length} registros gravados, ${result.erros} com erro. Importe o arquivo novamente para gravar os restantes.`);
      } else {
        const iguais = result.ignoradosSemAlteracao ?? 0;
        if (result.sucesso === 0 && iguais > 0) announce(`Nada a gravar: os ${iguais.toLocaleString('pt-BR')} registros já estavam iguais no banco.`);
        else announce(`Importação concluída! ${inseridos.toLocaleString('pt-BR')} inseridos, ${atualizados.toLocaleString('pt-BR')} atualizados`
          + (iguais ? ` e ${iguais.toLocaleString('pt-BR')} já estavam iguais (não regravados)` : '') + '.');
      }
      return result;
    } catch (error) {
      console.error('Erro na importação em lote:', error);
      announce('Erro ao processar importação em lote.');
      return { sucesso: 0, erros: novosDispositivos.length, falhas: [error instanceof Error ? error.message : String(error)] };
    }
  };

  /**
   * Remove documentos repetidos (mesma combinação Código + Dispositivo) já
   * revisados pela administradora em DuplicadosModal, a partir da varredura
   * que o modal acabou de fazer. Antes de apagar, confere de novo: o plano é
   * refeito com as reutilizações atuais e cada alvo é relido do banco; quem
   * ganhou vínculo (reutilização, imagem, anexo, observação) não é apagado.
   */
  const limparDispositivosDuplicados = async (
    ids: string[],
    base: Dispositivo[],
    onProgresso?: (p: { etapa: string; feitos: number; total: number | null }) => void,
    sinal?: AbortSignal
  ) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras podem remover dispositivos duplicados.');
      return { excluidos: 0, erros: 0, falhas: ['acesso negado'] };
    }
    const reutilizacoesAtuais = await varrerColecao(
      'reutilizacoes', d => String(d.data().dispositivoId || ''),
      p => onProgresso?.({ etapa: 'Conferindo reutilizações vinculadas', feitos: p.lidos, total: p.total }), sinal
    );
    const idsComReutilizacao = new Set(reutilizacoesAtuais);
    const plano = planejarLimpezaDuplicados(base, idsComReutilizacao);
    const seguros = new Set(plano.grupos.flatMap(g => g.remover.map(d => d.id)));
    const candidatos = ids.filter(id => seguros.has(id));
    const frescos = await obterDispositivosPorIds(candidatos, (lidos, total) =>
      onProgresso?.({ etapa: 'Conferindo dados atuais dos duplicados', feitos: lidos, total }));
    if (sinal?.aborted) return { excluidos: 0, erros: 0, falhas: [], cancelado: true };
    const temVinculo = (d: Dispositivo) =>
      idsComReutilizacao.has(d.id) || !!d.imagemPeca || !!d.imagemDispositivo || (d.anexos?.length ?? 0) > 0 || !!d.observacoes?.trim();
    const alvo = frescos.filter(d => !temVinculo(d)).map(d => d.id);
    const result = await dispositivosRepo.excluirEmLote(alvo, await metaParaEscrita(),
      (feitos, total) => onProgresso?.({ etapa: 'Removendo duplicados', feitos, total }), sinal);
    await registrarAuditoria(
      'exclusao',
      'dispositivo',
      'limpeza-duplicados',
      'Dispositivos duplicados',
      `Limpeza de duplicados Código + Dispositivo: ${result.excluidos} removido(s), ${result.erros} erro(s)`,
      { solicitados: ids.length, removidos: result.excluidos, erros: result.erros, ids: alvo }
    );
    tocarDispositivos();
    announce(result.cancelado
      ? `Remoção cancelada: ${result.excluidos} duplicados já removidos; os demais continuam no banco.`
      : result.erros > 0
      ? `Limpeza parcial: ${result.excluidos} duplicados removidos, ${result.erros} com erro. Rode a verificação de novo.`
      : `${result.excluidos} dispositivos duplicados removidos.`);
    return result;
  };

  const estadoImportacaoRapida = async () => {
    const [total, comChave] = await Promise.all([contarDispositivos(), contarComChave()]);
    return { total, comChave };
  };

  // Retomada guardada neste navegador (só o último id processado, nada de conteúdo).
  const chaveRetomada = `retool:preparo-chaves:${(db as { app?: { options?: { projectId?: string } } })?.app?.options?.projectId || 'retool'}`;
  const prepararImportacaoRapida = async (onProgresso?: (p: { lidos: number; gravados: number }) => void, sinal?: AbortSignal) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras podem preparar a importação rápida.');
      return { lidos: 0, gravados: 0, ultimoId: null };
    }
    let depoisDe: string | null = null;
    try { depoisDe = localStorage.getItem(chaveRetomada); } catch { depoisDe = null; }
    const r = await prepararChavesImportacao(depoisDe, p => onProgresso?.(p), sinal);
    try {
      if (r.interrompido && r.ultimoId) localStorage.setItem(chaveRetomada, r.ultimoId);
      else localStorage.removeItem(chaveRetomada);
    } catch { /* sem armazenamento local: a próxima rodada recomeça do início */ }
    await registrarAuditoria('edicao', 'dispositivo', 'chave-importacao', 'Chave da importação rápida',
      `Preparo da importação rápida: ${r.gravados} dispositivo(s) receberam a chave Código + Dispositivo`,
      { lidos: r.lidos, gravados: r.gravados, interrompido: r.interrompido ?? null });
    announce(r.interrompido === 'erro'
      ? `Preparo interrompido por uma falha: ${r.gravados} dispositivos preparados. Rode de novo para continuar de onde parou.`
      : r.interrompido === 'cota'
      ? `Cota diária atingida: ${r.gravados} dispositivos preparados. Rode de novo amanhã para continuar de onde parou.`
      : r.interrompido === 'cancelado'
        ? `Preparo cancelado: ${r.gravados} dispositivos preparados; rodar de novo continua de onde parou.`
        : `Importação rápida pronta: ${r.gravados} dispositivos receberam a chave.`);
    return r;
  };

  const reconstruirIndiceBusca = async (onProgresso?: (p: ProgressoVarredura) => void, sinal?: AbortSignal) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Apenas Administradoras e Projetistas podem atualizar o índice de busca.');
      return 0;
    }
    // Se alguém gravar dispositivos durante a varredura, a reconstrução
    // apagaria essa alteração do catálogo: nesse caso não grava e pede para
    // tentar de novo.
    const antes = await lerMetaIndiceDoServidor();
    const todos = await varrerDispositivos(onProgresso, sinal);
    const depois = await lerMetaIndiceDoServidor();
    if (antes && depois && JSON.stringify(antes.versoes) !== JSON.stringify(depois.versoes)) {
      announce('Dispositivos foram alterados durante a atualização do índice. Tente de novo em instantes.');
      throw new Error('indice-alterado-durante-varredura');
    }
    const { alteradoNoMeio } = await reconstruirIndice(todos, depois);
    // Telas que leram a meta uma vez (aviso "Criar índice") releem.
    tocarDispositivos();
    if (alteradoNoMeio) {
      announce('Índice atualizado, mas alguém gravou dispositivos enquanto ele era gravado. Atualize o índice de novo para incluir essa alteração.');
    } else {
      announce(`Índice de busca atualizado com ${todos.length.toLocaleString('pt-BR')} dispositivos.`);
    }
    return todos.length;
  };

  const deleteAllData = async (onProgresso?: (p: { etapa: string; feitos: number; total: number | null }) => void) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para apagar todo o banco de dados.');
      return;
    }
    try {
      const colecoes = ['dispositivos', 'categorias', 'tipos', 'familias', 'produtos', 'reutilizacoes'] as const;
      const contagem: Record<string, number> = {};
      // Catálogo de classificações primeiro (senão ficaria com itens já apagados).
      await deleteDoc(catalogoClassificacoesRef()).catch(() => undefined);
      catalogoClassifAtivo.current = false;
      for (const col of colecoes) {
        const ids = await varrerColecao(col, d => d.id, p => onProgresso?.({ etapa: `Lendo ${col}`, feitos: p.lidos, total: p.total }));
        contagem[col] = ids.length;
        for (let i = 0; i < ids.length; i += 500) {
          const batch = writeBatch(db);
          for (const id of ids.slice(i, i + 500)) batch.delete(doc(db, col, id));
          await batch.commit();
          onProgresso?.({ etapa: `Apagando ${col}`, feitos: Math.min(ids.length, i + 500), total: ids.length });
        }
      }
      // Catálogo de busca: a meta some (as partes ficam órfãs e são sobrescritas na próxima criação).
      const meta = await lerMetaIndiceDoServidor().catch(() => null);
      if (meta) {
        const batch = writeBatch(db);
        batch.delete(metaRef());
        await batch.commit();
        for (let n = 0; n < meta.partes; n += 450) {
          const b = writeBatch(db);
          for (let k = n; k < Math.min(meta.partes, n + 450); k++) b.delete(parteRef(k));
          await b.commit();
        }
      }

      await registrarAuditoria(
        'exclusao',
        'dispositivo',
        'limpeza-total',
        'Base de dados',
        'Exclusão em massa: todos os dados do sistema foram removidos',
        contagem
      );
      tocarDispositivos();
      announce('Banco de dados completamente limpo com sucesso.');
    } catch (error) {
      console.error('Erro ao limpar banco de dados:', error);
      announce('Erro ao tentar limpar o banco de dados.');
    }
  };

  // O valor só muda quando dados de referência, permissões ou o formulário
  // mudam (antes mudava a cada snapshot da coleção inteira e a cada toast,
  // re-renderizando toda a aplicação).
  const value = useMemo<ReToolContextType>(() => ({
    categorias, tipos, familias, produtos,
    referenciasProntas, erroReferencias, recarregarReferencias, revisaoDispositivos,
    addDispositivo, updateDispositivo, deleteDispositivo,
    desativarDispositivosEmLote, excluirDispositivosEmLote,
    addCategoria, updateCategoria, deleteCategoria,
    addTipo, updateTipo, deleteTipo,
    addFamilia, updateFamilia, deleteFamilia,
    addProduto, updateProduto, deleteProduto,
    addReutilizacao, updateReutilizacao, deleteReutilizacao,
    solicitarReutilizacao, transicionarReutilizacao,
    importarDispositivosEmLote, deleteAllData, limparDispositivosDuplicados, reconstruirIndiceBusca,
    estadoImportacaoRapida, prepararImportacaoRapida,
    announce,
    isDispFormOpen, editingDispId, openDispForm, closeDispForm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [categorias, tipos, familias, produtos, referenciasProntas, erroReferencias, revisaoDispositivos,
    currentRole, userProfile, users, criarNotificacao, isDispFormOpen, editingDispId, openDispForm, closeDispForm, announce]);

  return (
    <ReToolContext.Provider value={value}>
      {children}
      <ToastsGlobais />
    </ReToolContext.Provider>
  );
};

export const useReTool = () => {
  const context = useContext(ReToolContext);
  if (context === undefined) {
    throw new Error('useReTool must be used within a ReToolProvider');
  }
  return context;
};
