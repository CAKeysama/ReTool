/// <reference types="node" />
import * as XLSX from 'xlsx';
import { describe, test, expect } from '@jest/globals';
import {
  AbaPlanilha, CelulaPlanilha, ProgressoPlanilha, lerPlanilha, processarPlanilhaDispositivos,
} from '../../../application/importacao/planilhaDispositivos';
import {
  MensagemWorkerPlanilha, contextoSerializavel, executarProcessamentoPlanilha, tratarPedidoPlanilha,
} from '../../../application/importacao/processamentoPlanilha';

/**
 * Paridade: o caminho do Web Worker (tratarPedidoPlanilha, protocolo de
 * mensagens) e o fallback na thread principal (executarProcessamentoPlanilha)
 * devem dar exatamente o mesmo resultado que o processamento anterior
 * (leitura esparsa com texto formatado da biblioteca).
 */

const ctx = {
  categorias: [{ id: 'cat-gab', nome: 'GABARITO' }],
  familias: [{ id: 'fam-1', nome: 'Corte' }],
  produtos: [],
  defaultCategoriaId: '',
};

/** Planilha sintética com os casos de formato que importam (zeros à esquerda, Geral longo, Peso com casas, textos, vazios, repetidos). */
function planilhaSintetica(linhas: number): Uint8Array {
  const ws: XLSX.WorkSheet = {};
  const cab = ['Código', 'Dispositivo', 'Peso (kg)', 'Família do Produto', 'Produto', 'Tipo de Dispositivo', 'Descrição', 'Palavras-chave'];
  cab.forEach((h, c) => { ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h }; });
  for (let i = 1; i <= linhas; i++) {
    const r = i;
    const set = (c: number, cell: XLSX.CellObject) => { ws[XLSX.utils.encode_cell({ r, c })] = cell; };
    if (i % 97 === 0) continue; // linha totalmente vazia
    const k = i % 1500; // gera repetições da mesma combinação
    if (k % 3 === 0) set(0, { t: 'n', v: 50400111380 + k }); // Geral longo
    else if (k % 3 === 1) set(0, { t: 'n', v: k, z: '000000' }); // zeros à esquerda
    else set(0, { t: 's', v: ` c-${k} ` });
    set(1, { t: 's', v: k % 5 === 0 ? `daf${k % 40}` : `DAF${k % 40}` });
    if (k % 4) set(2, { t: 'n', v: k / 7, z: '0.00' });
    set(3, { t: 's', v: k % 2 ? 'corte' : 'Montagem' });
    set(4, { t: 's', v: `Produto ${k % 9}` });
    if (k % 6) set(5, { t: 's', v: k % 2 ? 'gabarito' : 'Ferramenta' });
    set(6, { t: 's', v: `Descrição ${i}` });
    set(7, { t: 's', v: 'a, b ,c' });
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas, c: cab.length - 1 } });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DADOS');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

/** Leitura como era antes da otimização (modo esparso, `w` calculado pela biblioteca). */
function lerPlanilhaReferencia(bytes: Uint8Array): AbaPlanilha[] {
  const wb = XLSX.read(bytes, { type: 'array', cellNF: true, cellDates: false });
  return wb.SheetNames.map(nome => {
    const sheet = wb.Sheets[nome];
    const range = XLSX.utils.decode_range(sheet['!ref']!);
    const texto = (cell: XLSX.CellObject | undefined): string => {
      if (!cell || cell.v === undefined || cell.v === null) return '';
      if (cell.t === 'n') {
        const formato = typeof cell.z === 'string' ? cell.z : 'General';
        if (formato === 'General' || formato === '@' || cell.w === undefined) return String(cell.v);
        return cell.w;
      }
      return String(cell.v);
    };
    const lerLinha = (r: number): CelulaPlanilha[] => {
      const out: CelulaPlanilha[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        const t = texto(cell);
        out.push(cell && cell.t === 'n' ? { texto: t, numero: cell.v as number } : t);
      }
      return out;
    };
    const cabecalhos = lerLinha(range.s.r).map(c => (typeof c === 'string' ? c : c.texto));
    const linhas: CelulaPlanilha[][] = [];
    for (let r = range.s.r + 1; r <= range.e.r; r++) linhas.push(lerLinha(r));
    return { nome, cabecalhos, linhas };
  });
}

const copiaBuffer = (b: Uint8Array) => b.slice().buffer as ArrayBuffer;

describe('processamento da planilha — paridade Worker × fallback × implementação anterior', () => {
  const bytes = planilhaSintetica(6000);

  test('leitura otimizada (densa, cellText:false) = leitura anterior, célula a célula', () => {
    expect(lerPlanilha(bytes, 'sintetica.xlsx')).toEqual(lerPlanilhaReferencia(bytes));
  });

  test('Worker (protocolo de mensagens) e fallback dão o mesmo resultado do processamento anterior', () => {
    const referencia = processarPlanilhaDispositivos(lerPlanilhaReferencia(bytes), ctx);
    const fallback = executarProcessamentoPlanilha(copiaBuffer(bytes), 'sintetica.xlsx', ctx);

    const mensagens: MensagemWorkerPlanilha[] = [];
    tratarPedidoPlanilha(
      { tipo: 'processar', conteudo: copiaBuffer(bytes), nomeArquivo: 'sintetica.xlsx', ctx: contextoSerializavel(ctx) },
      m => mensagens.push(JSON.parse(JSON.stringify(m))) // simula o structured clone do postMessage
    );
    const final = mensagens[mensagens.length - 1];
    expect(final.tipo).toBe('resultado');
    const doWorker = (final as Extract<MensagemWorkerPlanilha, { tipo: 'resultado' }>).resultado;

    expect(fallback).toEqual(referencia);
    expect(doWorker).toEqual(referencia);
    // Sanidade da regra Código + Dispositivo: 1.500 chaves (com variação de caixa/espaço) viram 1.500 registros.
    expect(referencia.resumo.combinacoesUnicas).toBe(1500);
    expect(referencia.novasCategorias).toEqual(['Ferramenta']);
    expect(referencia.novasFamilias).toEqual(['Montagem']);
  });

  test('progresso real: etapas em ordem, contagem crescente e total conhecido ao processar', () => {
    const eventos: ProgressoPlanilha[] = [];
    executarProcessamentoPlanilha(bytes, 'sintetica.xlsx', ctx, p => eventos.push(p));
    const etapas = eventos.map(e => e.etapa).filter((e, i, a) => a[i - 1] !== e);
    expect(etapas).toEqual(['lendo-arquivo', 'convertendo', 'processando']);
    expect(eventos[0]).toEqual({ etapa: 'lendo-arquivo', feitos: 0, total: 0 }); // total desconhecido: sem % inventada
    const processando = eventos.filter(e => e.etapa === 'processando');
    for (let i = 1; i < processando.length; i++) expect(processando[i].feitos).toBeGreaterThanOrEqual(processando[i - 1].feitos);
    expect(processando[processando.length - 1]).toMatchObject({ feitos: 6000, total: 6000 });
  });

  test('Worker devolve erro como mensagem (não derruba a tela)', () => {
    const mensagens: MensagemWorkerPlanilha[] = [];
    tratarPedidoPlanilha(
      { tipo: 'processar', conteudo: copiaBuffer(bytes), nomeArquivo: 'x.xlsx', ctx: null as never },
      m => mensagens.push(m)
    );
    expect(mensagens[mensagens.length - 1].tipo).toBe('erro');
  });

  test('contexto enviado ao Worker leva só id e nome', () => {
    const enxuto = contextoSerializavel({
      categorias: [{ id: 'c', nome: 'C', ativo: true } as never],
      familias: [], produtos: [], defaultCategoriaId: 'c',
    });
    expect(enxuto).toEqual({ categorias: [{ id: 'c', nome: 'C' }], familias: [], produtos: [], defaultCategoriaId: 'c' });
  });
});
