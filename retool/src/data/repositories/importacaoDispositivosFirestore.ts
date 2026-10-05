import { db } from '../datasources/firebase';
import {
  collection, doc, writeBatch, getDocsFromServer, getCountFromServer, query, orderBy, limit, startAfter, documentId,
  QueryConstraint,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Dispositivo } from '../../domain/entities/dispositivo';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';
import {
  OpcoesImportacaoLote, ProgressoImportacao, ResultadoImportacaoLote,
} from '../../domain/repositories/IDispositivosRepository';
import { MetaIndice, registrarNoIndice } from './FirestoreIndiceDispositivos';
import { registrarNoCatalogo } from './FirestoreClassificacoes';
import {
  TAMANHO_LOTE_DISPOSITIVOS, TAMANHO_PAGINA_LEITURA, ehErroDeCota, emLotes, planejarGravacao,
} from '../../application/importacao/gravacaoDispositivos';

/** Interrupção da importação (cancelamento pelo usuário ou cota diária esgotada). */
class InterrupcaoImportacao extends Error {
  constructor(public motivo: 'cancelado' | 'cota', public causa?: unknown) {
    super(motivo === 'cota' ? 'Cota diária do Firestore esgotada.' : 'Importação cancelada.');
  }
}

const mensagemDe = (erro: unknown) => (erro instanceof Error ? erro.message : String(erro));
const chaveNome = (v: string) => v.toLowerCase().trim();

/**
 * Lê todos os dispositivos e confere com count() no servidor. Uma leitura
 * que volta incompleta (página curta antes do fim, cache sem conexão)
 * faria linhas já existentes parecerem novas e serem gravadas em
 * duplicidade; por isso, se faltar algo, lê de novo uma vez e, se ainda
 * faltar, interrompe antes de qualquer escrita.
 */
async function lerExistentesConferido(
  sinal: AbortSignal | undefined,
  avisar: (lidos: number, total: number) => void
): Promise<Map<string, Dispositivo>> {
  for (let tentativa = 1; ; tentativa++) {
    // O count() vem antes: dá o total real da barra de progresso e é a
    // referência da conferência.
    let esperado: number;
    try {
      esperado = (await getCountFromServer(collection(db, 'dispositivos'))).data().count;
    } catch (erro) {
      if (ehErroDeCota(erro)) throw new InterrupcaoImportacao('cota', erro);
      throw erro;
    }
    avisar(0, esperado);
    const existentes = await lerExistentesPaginado(sinal, lidos => avisar(lidos, Math.max(esperado, lidos)));
    if (existentes.size >= esperado) return existentes;
    if (tentativa >= 2) {
      throw new Error(
        `A leitura dos dispositivos existentes veio incompleta (${existentes.size.toLocaleString('pt-BR')} de ${esperado.toLocaleString('pt-BR')}). `
        + 'Nada foi gravado. Verifique a conexão e importe de novo.'
      );
    }
  }
}

/**
 * Lê todos os dispositivos em páginas de `TAMANHO_PAGINA_LEITURA`, ordenadas
 * pelo id do documento (orderBy(documentId()) + limit + startAfter), avisando
 * o progresso a cada página. O consumo é o mesmo de um getDocs da coleção
 * inteira (1 leitura por documento), mas sem uma única resposta gigante, com
 * progresso real e com cancelamento entre páginas.
 */
async function lerExistentesPaginado(
  sinal: AbortSignal | undefined,
  avisar: (lidos: number) => void
): Promise<Map<string, Dispositivo>> {
  const existentes = new Map<string, Dispositivo>();
  let ultimoId: string | null = null;
  for (;;) {
    if (sinal?.aborted) throw new InterrupcaoImportacao('cancelado');
    const restricoes: QueryConstraint[] = [orderBy(documentId()), limit(TAMANHO_PAGINA_LEITURA)];
    if (ultimoId !== null) restricoes.push(startAfter(ultimoId));
    let pagina;
    try {
      // Sempre do servidor: sem conexão, getDocs devolveria só o que está em cache.
      pagina = await getDocsFromServer(query(collection(db, 'dispositivos'), ...restricoes));
    } catch (erro) {
      if (ehErroDeCota(erro)) throw new InterrupcaoImportacao('cota', erro);
      throw erro;
    }
    // Mesmo formato de subscribeAll: { id: doc.id, ...doc.data() }.
    for (const d of pagina.docs) existentes.set(d.id, { id: d.id, ...d.data() } as Dispositivo);
    avisar(existentes.size);
    if (pagina.docs.length < TAMANHO_PAGINA_LEITURA) break;
    ultimoId = pagina.docs[pagina.docs.length - 1].id;
  }
  return existentes;
}

/**
 * Cria as classificações (categorias/famílias/produtos) que ainda não existem,
 * comparando nomes sem diferenciar caixa/espaços. Devolve nome → id.
 */
async function criarClassificacoes(
  colecao: 'categorias' | 'familias' | 'produtos',
  nomes: string[],
  existentes: { id: string; nome?: string }[],
  sinal: AbortSignal | undefined,
  avisar: (feitos: number) => void,
  comCatalogo = false
): Promise<Map<string, string>> {
  const idPorNome = new Map<string, string>(); // nome normalizado -> id
  for (const e of existentes) if (e.nome && !idPorNome.has(chaveNome(e.nome))) idPorNome.set(chaveNome(e.nome), e.id);
  const resolvidos = new Map<string, string>(); // nome original -> id
  const novos: { id: string; nome: string }[] = [];
  for (const nome of nomes) {
    const k = chaveNome(nome);
    let id = idPorNome.get(k);
    if (!id) {
      id = uuidv4();
      idPorNome.set(k, id);
      novos.push({ id, nome });
    }
    resolvidos.set(nome, id);
  }

  let feitos = 0;
  for (const lote of emLotes(novos, TAMANHO_LOTE_DISPOSITIVOS - 1)) {
    if (sinal?.aborted) throw new InterrupcaoImportacao('cancelado');
    const batch = writeBatch(db);
    for (const { id, nome } of lote) batch.set(doc(db, colecao, id), { id, nome, ativo: true });
    if (comCatalogo) registrarNoCatalogo(batch, lote.map(({ id, nome }) => ({ colecao, id, dados: { id, nome, ativo: true } })));
    try {
      await batch.commit();
    } catch (erro) {
      if (ehErroDeCota(erro)) throw new InterrupcaoImportacao('cota', erro);
      throw erro;
    }
    feitos += lote.length;
    avisar(feitos);
  }
  return resolvidos;
}

/**
 * Gravação de uma importação em lote no Firestore (regra Código + Dispositivo).
 *
 * 1. Lê os dispositivos existentes, paginado (com progresso e cancelamento).
 * 2. Cria as classificações novas.
 * 3. Planeja (`planejarGravacao`): cria, atualiza a MESMA combinação Código +
 *    Dispositivo ou pula o documento que já está igual (economia de cota).
 * 4. Grava em lotes de `TAMANHO_LOTE_DISPOSITIVOS`, com progresso a cada lote,
 *    cancelamento entre lotes e parada imediata se a cota diária acabar
 *    (`resource-exhausted`). Falha de outro tipo num lote não interrompe os
 *    demais e entra em `erros`.
 *
 * Contagem: inseridos + atualizados + ignoradosSemAlteracao + erros +
 * naoGravados = registros enviados. Reimportar o mesmo arquivo grava só o que
 * faltou (a chave é idempotente e o que está igual é pulado).
 */
export async function importarLoteFirestore(
  novosDispositivos: Partial<Dispositivo>[],
  newCategoriasNomes: string[],
  newFamiliasNomes: string[],
  newProdutosNomes: string[],
  categoriasExistentes: Categoria[],
  familiasExistentes: Familia[],
  produtosExistentes: Produto[],
  opcoes?: OpcoesImportacaoLote
): Promise<ResultadoImportacaoLote> {
  const sinal = opcoes?.sinal;
  const progresso = (p: ProgressoImportacao) => {
    try { opcoes?.onProgresso?.(p); } catch (erro) { console.error('Falha no aviso de progresso da importação:', erro); }
  };

  const resultado: ResultadoImportacaoLote = {
    sucesso: 0,
    erros: 0,
    inseridos: 0,
    atualizados: 0,
    falhas: [],
    ignoradosSemAlteracao: 0,
    naoGravados: 0,
    documentosLidos: 0,
    documentosGravados: 0,
  };
  const interromper = (i: InterrupcaoImportacao, naoGravados: number) => {
    resultado.interrompido = i.motivo;
    resultado.naoGravados = naoGravados;
    if (i.causa !== undefined) resultado.falhas!.push(mensagemDe(i.causa));
    resultado.sucesso = resultado.inseridos! + resultado.atualizados!;
    return resultado;
  };

  // 1. Dispositivos existentes (antes de qualquer escrita: se a leitura for
  // cancelada ou faltar cota, nada é gravado).
  let existentes: Map<string, Dispositivo>;
  if (opcoes?.existentesConhecidos) {
    // Já lidos do servidor por quem chamou: 0 leituras de dispositivos.
    existentes = new Map(opcoes.existentesConhecidos.map(d => [d.id as string, d as Dispositivo]));
    resultado.documentosLidos = 0;
  } else {
    try {
      // Total desconhecido (0 = barra indeterminada) até o count() responder.
      progresso({ etapa: 'lendo-existentes', feitos: 0, total: 0 });
      existentes = await lerExistentesConferido(sinal, (lidos, total) => {
        progresso({ etapa: 'lendo-existentes', feitos: lidos, total });
      });
    } catch (erro) {
      if (erro instanceof InterrupcaoImportacao) return interromper(erro, novosDispositivos.length);
      throw erro;
    }
    resultado.documentosLidos = existentes.size;
  }
  const metaIndice = (opcoes?.indice ?? null) as MetaIndice | null;
  // Estado final = existentes + o que for efetivamente gravado.
  const finais = new Map(existentes);
  resultado.documentosFinais = [];

  // 2. Classificações novas.
  const totalClassificacoes = newCategoriasNomes.length + newFamiliasNomes.length + newProdutosNomes.length;
  let categoriasCriadas: Map<string, string>;
  let familiasCriadas: Map<string, string>;
  let produtosCriados: Map<string, string>;
  try {
    let base = 0;
    const avisar = (feitos: number) => progresso({ etapa: 'classificacoes', feitos: base + feitos, total: totalClassificacoes });
    categoriasCriadas = await criarClassificacoes('categorias', newCategoriasNomes, categoriasExistentes, sinal, avisar, !!opcoes?.catalogoClassificacoes);
    base += newCategoriasNomes.length;
    familiasCriadas = await criarClassificacoes('familias', newFamiliasNomes, familiasExistentes, sinal, avisar, !!opcoes?.catalogoClassificacoes);
    base += newFamiliasNomes.length;
    produtosCriados = await criarClassificacoes('produtos', newProdutosNomes, produtosExistentes, sinal, avisar, !!opcoes?.catalogoClassificacoes);
  } catch (erro) {
    if (erro instanceof InterrupcaoImportacao) {
      resultado.documentosFinais = Array.from(finais.values());
      return interromper(erro, novosDispositivos.length);
    }
    throw erro;
  }

  const resolverId = (valor: string | undefined, criados: Map<string, string>) => {
    if (!valor) return valor;
    const direto = criados.get(valor);
    if (direto) return direto;
    for (const [nome, id] of criados) if (chaveNome(nome) === chaveNome(valor)) return id;
    return valor;
  };
  const resolvidos = novosDispositivos.map(original => {
    const disp = { ...original };
    if (disp.categoriaId) disp.categoriaId = resolverId(disp.categoriaId, categoriasCriadas);
    if (disp.familiaId) disp.familiaId = resolverId(disp.familiaId, familiasCriadas);
    if (disp.produtoId) disp.produtoId = resolverId(disp.produtoId, produtosCriados);
    return disp;
  });

  // 3. Plano: identidade = Código + Dispositivo; documento igual não é gravado.
  const plano = planejarGravacao(resolvidos, existentes.values(), uuidv4);
  resultado.ignoradosSemAlteracao = plano.ignoradosSemAlteracao;

  // 4. Gravação em lotes.
  // Com o catálogo, cada lote leva também até 1 operação por parte tocada + a
  // meta: o lote encolhe para caber no limite de 500 operações por commit.
  const tamanhoLote = metaIndice
    ? Math.max(1, Math.min(TAMANHO_LOTE_DISPOSITIVOS, metaIndice.partes >= 249 ? 249 : 499 - metaIndice.partes))
    : TAMANHO_LOTE_DISPOSITIVOS;
  const lotes = emLotes(plano.operacoes, tamanhoLote);
  const total = plano.registrosAGravar;
  let feitos = 0;
  progresso({ etapa: 'gravando', feitos: 0, total, lote: 0, totalLotes: lotes.length });

  for (let i = 0; i < lotes.length; i++) {
    const lote = lotes[i];
    const registrosDoLote = lote.reduce((n, op) => n + op.registros, 0);
    const restantes = () => total - feitos;

    if (sinal?.aborted) {
      resultado.documentosFinais = Array.from(finais.values());
      return interromper(new InterrupcaoImportacao('cancelado'), restantes());
    }

    const batch = writeBatch(db);
    for (const op of lote) batch.set(doc(db, 'dispositivos', op.id), op.dados, { merge: true });
    registrarNoIndice(batch, metaIndice, lote.map(op => ({
      id: op.id, dados: { ...finais.get(op.id), ...op.dados, id: op.id }, novo: op.novo,
    })));
    try {
      await batch.commit();
      resultado.documentosGravados! += lote.length;
      for (const op of lote) {
        if (op.novo) { resultado.inseridos!++; resultado.atualizados! += op.registros - 1; }
        else resultado.atualizados! += op.registros;
        finais.set(op.id, { ...finais.get(op.id), ...op.dados, id: op.id } as Dispositivo);
      }
    } catch (erro) {
      if (ehErroDeCota(erro)) {
        // Cota diária esgotada: os próximos lotes também falhariam. Para aqui;
        // este lote (atômico, não gravado) e os restantes ficam para amanhã.
        console.error('Cota do Firestore esgotada durante a importação:', erro);
        resultado.documentosFinais = Array.from(finais.values());
        return interromper(new InterrupcaoImportacao('cota', erro), restantes());
      }
      // Outra falha: o lote entra em `erros` e os demais continuam.
      resultado.erros += registrosDoLote;
      resultado.falhas!.push(mensagemDe(erro));
      console.error('Falha ao gravar lote de dispositivos:', erro);
    }
    feitos += registrosDoLote;
    progresso({ etapa: 'gravando', feitos, total, lote: i + 1, totalLotes: lotes.length });
  }

  resultado.sucesso = resultado.inseridos! + resultado.atualizados!;
  resultado.documentosFinais = Array.from(finais.values());
  progresso({ etapa: 'concluido', feitos: total, total });
  return resultado;
}
