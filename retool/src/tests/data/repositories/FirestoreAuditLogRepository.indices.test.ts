/// <reference types="node" />
import '../../mocks/firebaseMock';
import { resetMockDb } from '../../mocks/firebaseMock';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { query } from 'firebase/firestore';
import {
  FirestoreAuditLogRepository, FiltrosAuditoria, IndiceComposto,
  CAMPOS_FILTRO_AUDITORIA, camposFiltradosAuditoria, indicesNecessariosAuditoria
} from '../../../data/repositories/FirestoreAuditLogRepository';
import { ACOES_POR_CATEGORIA, AuditLogCategoria } from '../../../domain/entities/auditLog';

/**
 * O emulador do Firestore não exige índices compostos — só a nuvem exige.
 * Estes testes garantem, sem depender dela, que toda combinação de filtros
 * oferecida pela tela tem exatamente o índice que a consulta vai pedir.
 */

const indicesPublicados: IndiceComposto[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../firestore.indexes.json'), 'utf8')
).indexes.filter((i: IndiceComposto) => i.collectionGroup === 'audit_logs');

const assinatura = (i: IndiceComposto) => i.fields.map(f => `${f.fieldPath}:${f.order}`).join(',');

/** Todas as combinações que a tela permite (categoria OU ação, usuário, recurso, falhas, período). */
function todasAsCombinacoesDaTela(): FiltrosAuditoria[] {
  const acoes: Partial<FiltrosAuditoria>[] = [
    {},
    ...(Object.keys(ACOES_POR_CATEGORIA) as AuditLogCategoria[]).map(categoria => ({ categoria })),
    { categoria: 'autenticacao', acao: 'login' },
    { acao: 'exclusao' },
  ];
  const combinacoes: FiltrosAuditoria[] = [];
  for (const a of acoes)
    for (const usuarioUid of [undefined, 'uid-1'])
      for (const tipoEntidade of [undefined, 'usuario' as const])
        for (const somenteFalhas of [false, true])
          for (const periodo of [{}, { de: '2026-09-01T03:00:00.000Z' }, { de: '2026-09-01T03:00:00.000Z', ate: '2026-09-30T02:59:59.999Z' }])
            combinacoes.push({ ...a, usuarioUid, tipoEntidade, somenteFalhas, ...periodo });
  return combinacoes;
}

describe('Índices do histórico de ações (firestore.indexes.json)', () => {
  test('publica exatamente os índices exigidos pelas consultas, sem duplicatas', () => {
    const esperados = indicesNecessariosAuditoria().map(assinatura).sort();
    const publicados = indicesPublicados.map(assinatura).sort();
    expect(new Set(publicados).size).toBe(publicados.length);
    expect(publicados).toEqual(esperados);
    // Combinações não vazias dos 5 campos, sem categoria e ação juntas: 2^5 - 1 - 2^3 = 23.
    expect(publicados).toHaveLength(2 ** CAMPOS_FILTRO_AUDITORIA.length - 1 - 2 ** (CAMPOS_FILTRO_AUDITORIA.length - 2));
  });

  test('todo índice termina em dataHora DESC (ordenação e período do histórico)', () => {
    indicesPublicados.forEach(i => {
      expect(i.fields[i.fields.length - 1]).toEqual({ fieldPath: 'dataHora', order: 'DESCENDING' });
      expect(i.queryScope).toBe('COLLECTION');
    });
  });

  test('cada combinação de filtros da tela tem o seu índice', () => {
    const publicados = new Set(indicesPublicados.map(assinatura));
    const combinacoes = todasAsCombinacoesDaTela();
    expect(combinacoes.length).toBeGreaterThan(100);

    for (const filtros of combinacoes) {
      const campos = camposFiltradosAuditoria(filtros);
      if (campos.length === 0) continue; // só dataHora: índice automático de campo único
      const exigido = [...campos.map(c => `${c}:ASCENDING`), 'dataHora:DESCENDING'].join(',');
      expect({ filtros, indice: exigido, publicado: publicados.has(exigido) })
        .toEqual({ filtros, indice: exigido, publicado: true });
    }
  });

  test('nenhuma combinação expande em mais de 2 sub-consultas (limites de disjunções/filtros)', async () => {
    const repo = new FirestoreAuditLogRepository();
    for (const filtros of todasAsCombinacoesDaTela()) {
      (query as unknown as jest.Mock).mockClear();
      await repo.listarPagina(filtros, 5);
      const restricoes = (query as unknown as jest.Mock).mock.calls.at(-1)!.slice(1) as any[];
      const subConsultas = restricoes
        .filter(r => r.tipo === 'where' && r.op === 'in')
        .reduce((total, r) => total * r.valor.length, 1);
      expect({ filtros, subConsultas }).toEqual({ filtros, subConsultas: filtros.somenteFalhas ? 2 : 1 });
    }
  });
});

describe('Consulta do histórico segue a ordem canônica dos índices', () => {
  beforeEach(() => {
    resetMockDb();
    (query as unknown as jest.Mock).mockClear();
  });

  test('filtros de igualdade na ordem do índice, depois período, ordenação e cursor', async () => {
    const repo = new FirestoreAuditLogRepository();
    await repo.listarPagina({
      somenteFalhas: true, tipoEntidade: 'usuario', usuarioUid: 'uid-1', categoria: 'usuarios',
      de: '2026-09-01T03:00:00.000Z', ate: '2026-09-30T02:59:59.999Z'
    }, 10);

    const restricoes = (query as unknown as jest.Mock).mock.calls.at(-1)!.slice(1) as any[];
    expect(restricoes.map(r => [r.tipo, r.campo, r.op])).toEqual([
      ['where', 'categoria', '=='],
      ['where', 'usuarioUid', '=='],
      ['where', 'tipoEntidade', '=='],
      ['where', 'resultado', 'in'],
      ['where', 'dataHora', '>='],
      ['where', 'dataHora', '<='],
      ['orderBy', 'dataHora', undefined],
      ['limit', undefined, undefined],
    ]);
  });

  test('ação específica prevalece sobre a categoria (nunca os dois campos juntos)', () => {
    expect(camposFiltradosAuditoria({ categoria: 'dados', acao: 'edicao' })).toEqual(['acao']);
    expect(camposFiltradosAuditoria({ categoria: 'dados' })).toEqual(['categoria']);
    expect(camposFiltradosAuditoria({})).toEqual([]);
    expect(camposFiltradosAuditoria({ de: '2026-01-01T00:00:00.000Z' })).toEqual([]);
  });
});
