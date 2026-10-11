/**
 * Catálogo de busca e catálogo de classificações: o que vai em cada lote.
 * Mock próprio do Firestore que só registra as operações dos lotes.
 */
const lotes: { ops: { tipo: string; ref: string; args: unknown[] }[]; commit: jest.Mock }[] = [];
const getDocsMock = jest.fn();

jest.mock('uuid', () => {
  let n = 0;
  return { v4: jest.fn(() => `novo-${String(++n).padStart(5, '0')}`) };
});
jest.mock('../../../data/datasources/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => {
  class FieldPath { segs: string[]; constructor(...s: string[]) { this.segs = s; } toString() { return this.segs.join('.'); } }
  return {
    FieldPath,
    doc: jest.fn((_db: unknown, ...p: string[]) => p.join('/')),
    collection: jest.fn((_db: unknown, nome: string) => ({ nome })),
    query: jest.fn((c: unknown) => c),
    orderBy: jest.fn(), limit: jest.fn(), startAfter: jest.fn(), documentId: jest.fn(),
    increment: jest.fn((n: number) => ({ inc: n })),
    deleteField: jest.fn(() => 'DEL'),
    getDocs: (...a: unknown[]) => getDocsMock(...a),
    getDoc: jest.fn(), getDocFromServer: jest.fn(), onSnapshot: jest.fn(), setDoc: jest.fn(), getCountFromServer: jest.fn(),
    writeBatch: jest.fn(() => {
      const lote = { ops: [] as { tipo: string; ref: string; args: unknown[] }[], commit: jest.fn(async () => undefined) };
      lotes.push(lote);
      return {
        set: (ref: string, ...args: unknown[]) => lote.ops.push({ tipo: 'set', ref, args }),
        update: (ref: string, ...args: unknown[]) => lote.ops.push({ tipo: 'update', ref, args }),
        delete: (ref: string) => lote.ops.push({ tipo: 'delete', ref, args: [] }),
        commit: lote.commit,
      };
    }),
  };
});

import { writeBatch } from 'firebase/firestore';
import { registrarNoIndice, operacoesNoIndice, MetaIndice } from '../../../data/repositories/FirestoreIndiceDispositivos';
import { registrarNoCatalogo } from '../../../data/repositories/FirestoreClassificacoes';
import { importarLoteFirestore } from '../../../data/repositories/importacaoDispositivosFirestore';
import { parteDoId } from '../../../domain/services/buscaDispositivos';

const meta: MetaIndice = { partes: 18, versoes: {}, total: 0, geracao: 'g', atualizadoEm: '' };
const campos = (args: unknown[]) => {
  const out: [string, unknown][] = [];
  for (let i = 0; i < args.length; i += 2) out.push([String(args[i]), args[i + 1]]);
  return out;
};

beforeEach(() => { lotes.length = 0; getDocsMock.mockReset(); });

describe('registrarNoIndice', () => {
  it('faz uma única operação por parte tocada (+ meta), com todas as entradas', () => {
    const b = writeBatch({} as never);
    const ids = Array.from({ length: 150 }, (_, i) => `disp-${i}`);
    registrarNoIndice(b, meta, ids.map((id, i) => ({ id, dados: { codigo: `C${i}`, nome: `N${i}` }, novo: i < 10 })));
    const ops = lotes[0].ops;
    const partesTocadas = new Set(ids.map(id => parteDoId(id, meta.partes)));
    expect(ops).toHaveLength(partesTocadas.size + 1);
    expect(operacoesNoIndice(meta, ids)).toBe(partesTocadas.size + 1);

    const gravados = ops.filter(o => o.ref.includes('/partes/')).flatMap(o => campos(o.args).map(([k]) => k));
    expect(gravados.sort()).toEqual(ids.map(id => `itens.${id}`).sort());
    for (const o of ops.filter(o => o.ref.includes('/partes/'))) {
      const n = Number(o.ref.split('/').pop());
      for (const [k] of campos(o.args)) expect(parteDoId(k.slice('itens.'.length), meta.partes)).toBe(n);
    }
    const metaOp = ops.find(o => o.ref === 'indices/dispositivos')!;
    const m = Object.fromEntries(campos(metaOp.args));
    const somaVersoes = Object.entries(m).filter(([k]) => k.startsWith('versoes.')).reduce((a, [, v]) => a + (v as { inc: number }).inc, 0);
    expect(somaVersoes).toBe(150);
    expect(m.total).toEqual({ inc: 10 });
  });

  it('não faz nada sem catálogo', () => {
    const b = writeBatch({} as never);
    registrarNoIndice(b, null, [{ id: 'x', dados: {} }]);
    expect(lotes[0].ops).toHaveLength(0);
    expect(operacoesNoIndice(null, ['x'])).toBe(0);
  });
});

describe('registrarNoCatalogo', () => {
  it('altera só os campos enviados de uma classificação e remove itens excluídos', () => {
    const b = writeBatch({} as never);
    registrarNoCatalogo(b, [
      { colecao: 'familias', id: 'f1', dados: { nome: 'Nova' }, parcial: true },
      { colecao: 'produtos', id: 'p1', dados: null },
      { colecao: 'categorias', id: 'c1', dados: { id: 'c1', nome: 'Cat' } },
    ]);
    const [op] = lotes[0].ops;
    expect(op.ref).toBe('indices/classificacoes');
    const m = Object.fromEntries(campos(op.args));
    expect(m['familias.f1.nome']).toBe('Nova');
    expect(m['produtos.p1']).toBe('DEL');
    expect(m['categorias.c1']).toEqual({ id: 'c1', nome: 'Cat' });
  });
});

describe('importação com o catálogo como fonte dos existentes', () => {
  const existentes = Array.from({ length: 2000 }, (_, i) => ({
    id: `e${String(i).padStart(5, '0')}`, codigo: `C${i}`, nome: `D${i}`, descricao: 'x', categoriaId: 'c', familiaId: '', produtoId: '',
    peso: '', palavrasChave: [],
  }));

  it('não lê a coleção e grava catálogo no mesmo lote, sem passar de 500 operações', async () => {
    const novos = [
      ...existentes.map(e => ({ ...e, id: undefined })),                     // iguais: ignorados
      ...existentes.slice(0, 30).map(e => ({ ...e, id: undefined, descricao: 'mudou' })), // alterados
      ...Array.from({ length: 1000 }, (_, i) => ({ codigo: `N${i}`, nome: `ND${i}`, descricao: '', categoriaId: 'c', familiaId: '', produtoId: '', peso: '', palavrasChave: [] })),
    ];
    const r = await importarLoteFirestore(novos, [], [], [], [], [], [], { existentesConhecidos: existentes, indice: meta });
    expect(getDocsMock).not.toHaveBeenCalled();
    expect(r.documentosLidos).toBe(0);
    expect(r.inseridos).toBe(1000);
    expect(r.atualizados).toBe(30);
    expect(r.documentosGravados).toBe(1030);
    expect(r.ignoradosSemAlteracao).toBe(2000);
    let entradasNoIndice = 0;
    for (const l of lotes) {
      expect(l.ops.length).toBeLessThanOrEqual(500);
      const gravadosNoLote = l.ops.filter(o => o.ref.startsWith('dispositivos/')).map(o => o.ref.split('/')[1]);
      const noIndice = l.ops.filter(o => o.ref.includes('/partes/')).flatMap(o => campos(o.args).map(([k]) => k.slice(6)));
      expect(noIndice.sort()).toEqual(gravadosNoLote.sort());
      entradasNoIndice += noIndice.length;
    }
    expect(entradasNoIndice).toBe(1030);
  });
});
