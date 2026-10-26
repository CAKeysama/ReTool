import { describe, test, expect } from '@jest/globals';
import {
  decidirModoReutilizacoes,
  documentosLegados,
  derivarDataCriacao,
  planejarNormalizacaoReutilizacoes,
  emLotes
} from '../../../domain/services/consultaReutilizacoes';

const AGORA = new Date('2026-10-05T15:00:00.000Z');

describe('decidirModoReutilizacoes', () => {
  test('servidor quando status e dataCriacao cobrem toda a coleção', () => {
    expect(decidirModoReutilizacoes({ total: 300, comStatusCanonico: 300, comDataCriacao: 300 })).toBe('servidor');
  });

  test('coleção vazia também é servidor (nada a perder nas consultas)', () => {
    expect(decidirModoReutilizacoes({ total: 0, comStatusCanonico: 0, comDataCriacao: 0 })).toBe('servidor');
  });

  test('legado se algum documento tem status antigo/ausente', () => {
    expect(decidirModoReutilizacoes({ total: 300, comStatusCanonico: 299, comDataCriacao: 300 })).toBe('legado');
  });

  test('legado se algum documento não tem dataCriacao string', () => {
    expect(decidirModoReutilizacoes({ total: 300, comStatusCanonico: 300, comDataCriacao: 250 })).toBe('legado');
  });

  test('documentosLegados é o maior dos dois faltantes', () => {
    expect(documentosLegados({ total: 300, comStatusCanonico: 280, comDataCriacao: 250 })).toBe(50);
    expect(documentosLegados({ total: 300, comStatusCanonico: 300, comDataCriacao: 300 })).toBe(0);
  });
});

describe('derivarDataCriacao', () => {
  test('dia do campo data vira meio-dia UTC (mesmo dia em Brasília)', () => {
    expect(derivarDataCriacao({ data: '2025-03-04' }, AGORA)).toEqual({ valor: '2025-03-04T12:00:00.000Z', atual: false });
  });

  test('Timestamp em dataCriacao é convertido para ISO', () => {
    const ts = { toDate: () => new Date('2024-01-02T03:04:05.000Z') };
    expect(derivarDataCriacao({ dataCriacao: ts, data: '2025-03-04' }, AGORA)).toEqual({ valor: '2024-01-02T03:04:05.000Z', atual: false });
  });

  test('número (epoch ms) em dataCriacao é convertido', () => {
    expect(derivarDataCriacao({ dataCriacao: Date.UTC(2023, 0, 1) }, AGORA).valor).toBe('2023-01-01T00:00:00.000Z');
  });

  test('sem nenhuma data válida usa o momento atual e sinaliza', () => {
    expect(derivarDataCriacao({ data: 'ontem' }, AGORA)).toEqual({ valor: AGORA.toISOString(), atual: true });
    expect(derivarDataCriacao({}, AGORA)).toEqual({ valor: AGORA.toISOString(), atual: true });
  });
});

describe('planejarNormalizacaoReutilizacoes', () => {
  const docs = [
    { id: 'ok', dados: { status: 'Reutilização aprovada', dataCriacao: '2026-01-01T00:00:00.000Z', data: '2026-01-01' } },
    { id: 'pendente', dados: { status: 'pendente', dataCriacao: '2026-01-02T00:00:00.000Z' } },
    { id: 'aprovado', dados: { status: 'aprovado', dataCriacao: '2026-01-02T00:00:00.000Z' } },
    { id: 'rejeitado', dados: { status: 'rejeitado', dataCriacao: '2026-01-02T00:00:00.000Z' } },
    { id: 'os', dados: { status: 'Em andamento - OS', dataCriacao: '2026-01-02T00:00:00.000Z' } },
    { id: 'semStatus', dados: { dataCriacao: '2026-01-02T00:00:00.000Z' } },
    { id: 'statusEstranho', dados: { status: 42, dataCriacao: '2026-01-02T00:00:00.000Z' } },
    { id: 'semData', dados: { status: 'Em análise (Engenharia)', data: '2025-05-06' } },
    { id: 'dataVazia', dados: { status: 'Em análise (Engenharia)', dataCriacao: '' } },
    { id: 'nadaDeData', dados: { status: 'aprovado' } },
  ];

  const plano = planejarNormalizacaoReutilizacoes(docs, AGORA);
  const por = (id: string) => plano.itens.find(i => i.id === id)?.alteracoes;

  test('documentos já canônicos ficam fora do plano', () => {
    expect(por('ok')).toBeUndefined();
    expect(plano.analisados).toBe(docs.length);
    expect(plano.itens).toHaveLength(docs.length - 1);
  });

  test('status legado vira o canônico equivalente (mesma regra da exibição)', () => {
    expect(por('pendente')).toEqual({ status: 'Em análise (Projetista)' });
    expect(por('aprovado')).toEqual({ status: 'Reutilização aprovada' });
    expect(por('rejeitado')).toEqual({ status: 'Reutilização não aprovada' });
    expect(por('os')).toEqual({ status: 'Reutilização aprovada' });
    expect(por('semStatus')).toEqual({ status: 'Em análise (Projetista)' });
    expect(por('statusEstranho')).toEqual({ status: 'Em análise (Projetista)' });
  });

  test('dataCriacao ausente ou vazia é preenchida sem tocar no status canônico', () => {
    expect(por('semData')).toEqual({ dataCriacao: '2025-05-06T12:00:00.000Z' });
    expect(por('dataVazia')).toEqual({ dataCriacao: AGORA.toISOString() });
  });

  test('status e data juntos quando faltam os dois', () => {
    expect(por('nadaDeData')).toEqual({ status: 'Reutilização aprovada', dataCriacao: AGORA.toISOString() });
  });

  test('contadores do resumo', () => {
    expect(plano.comStatusAlterado).toBe(7);
    expect(plano.comDataCriacaoAlterada).toBe(3);
    expect(plano.comDataCriacaoAtual).toBe(2);
  });
});

describe('emLotes', () => {
  test('divide em lotes de no máximo 500', () => {
    const itens = Array.from({ length: 1201 }, (_, i) => i);
    const lotes = emLotes(itens);
    expect(lotes.map(l => l.length)).toEqual([500, 500, 201]);
    expect(lotes.flat()).toEqual(itens);
  });

  test('lista vazia não gera lotes', () => {
    expect(emLotes([])).toEqual([]);
  });
});
