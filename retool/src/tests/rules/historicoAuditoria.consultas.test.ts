/// <reference types="node" />
/**
 * Consultas reais do Histórico de Ações no emulador do Firestore (com as
 * regras de segurança ativas), para todas as combinações de filtros da tela:
 * resultado, ordem, paginação por cursor e total.
 *
 *   npm run test:rules
 *
 * O emulador não exige índices compostos; a cobertura dos índices é
 * verificada em FirestoreAuditLogRepository.indices.test.ts.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, setLogLevel } from 'firebase/firestore';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// O repositório usa `db` de datasources/firebase (import.meta.env): aqui ele
// aponta para a sessão de teste corrente no emulador.
jest.mock('../../data/datasources/firebase', () => ({
  get db() { return (globalThis as any).__dbHistorico; }
}));
jest.mock('uuid', () => ({ v4: () => require('crypto').randomUUID() }));

import { FirestoreAuditLogRepository, FiltrosAuditoria } from '../../data/repositories/FirestoreAuditLogRepository';
import { ACOES_POR_CATEGORIA, AuditLogAcao, AuditLogCategoria, categoriaDaAcao } from '../../domain/entities/auditLog';

let env: RulesTestEnvironment;
const repo = new FirestoreAuditLogRepository();

const ACOES = ['login', 'logout', 'cadastro', 'edicao', 'criacao', 'exclusao', 'aprovacao_usuario', 'solicitacao_cargo', 'transicao', 'redefinicao_senha'];
const USUARIOS = ['uid-1', 'uid-2', 'uid-3'];
const TIPOS = ['usuario', 'dispositivo', 'sessao'];
const RESULTADOS: (string | undefined)[] = ['sucesso', 'falha', 'negado', undefined]; // undefined = acervo legado

interface LogSemente {
  id: string;
  acao: string;
  /** Ausente nos registros legados (anteriores ao campo). */
  categoria?: string;
  usuarioUid: string;
  tipoEntidade: string;
  resultado?: string;
  dataHora: string;
}

const SEMENTES: LogSemente[] = Array.from({ length: 60 }, (_, i) => {
  const acao = ACOES[i % ACOES.length];
  const legado = i % 11 === 0; // alguns registros do formato antigo, sem categoria/resultado
  return {
    id: `log-${String(i).padStart(2, '0')}`,
    acao,
    ...(legado ? {} : { categoria: categoriaDaAcao(acao as AuditLogAcao) }),
    usuarioUid: USUARIOS[i % USUARIOS.length],
    tipoEntidade: TIPOS[(i * 7) % TIPOS.length],
    resultado: legado ? undefined : RESULTADOS[(i * 3) % RESULTADOS.length],
    // 12 h entre registros, de 20/08 a 18/09/2026
    dataHora: new Date(Date.UTC(2026, 7, 20) + i * 12 * 3600 * 1000).toISOString()
  };
});

const PERIODO = { de: '2026-09-01T00:00:00.000Z', ate: '2026-09-10T23:59:59.999Z' };

function esperado(f: FiltrosAuditoria): string[] {
  return SEMENTES
    .filter(s => (f.acao ? s.acao === f.acao : !f.categoria || s.categoria === f.categoria))
    .filter(s => !f.usuarioUid || s.usuarioUid === f.usuarioUid)
    .filter(s => !f.tipoEntidade || s.tipoEntidade === f.tipoEntidade)
    .filter(s => !f.somenteFalhas || s.resultado === 'falha' || s.resultado === 'negado')
    .filter(s => !f.de || s.dataHora >= f.de)
    .filter(s => !f.ate || s.dataHora <= f.ate)
    .sort((a, b) => b.dataHora.localeCompare(a.dataHora))
    .map(s => s.id);
}

/** Todas as combinações que a tela oferece. */
function combinacoes(): [string, FiltrosAuditoria][] {
  const porAcao: [string, Partial<FiltrosAuditoria>][] = [
    ['sem ação', {}],
    ...(Object.keys(ACOES_POR_CATEGORIA) as AuditLogCategoria[]).map(c => [`categoria ${c}`, { categoria: c }] as [string, Partial<FiltrosAuditoria>]),
    ['ação login', { categoria: 'autenticacao', acao: 'login' }],
    ['ação edicao', { acao: 'edicao' }],
  ];
  const lista: [string, FiltrosAuditoria][] = [];
  for (const [nomeAcao, a] of porAcao)
    for (const usuarioUid of [undefined, 'uid-1'])
      for (const tipoEntidade of [undefined, 'usuario' as const])
        for (const somenteFalhas of [false, true])
          for (const comPeriodo of [false, true]) {
            const nome = [nomeAcao, usuarioUid && 'usuário', tipoEntidade && 'recurso', somenteFalhas && 'falhas', comPeriodo && 'período']
              .filter(Boolean).join(' + ');
            lista.push([nome, { ...a, usuarioUid, tipoEntidade, somenteFalhas, ...(comPeriodo ? PERIODO : {}) }]);
          }
  return lista;
}

async function lerTodasAsPaginas(f: FiltrosAuditoria, tamanho: number): Promise<string[]> {
  const ids: string[] = [];
  let cursor: unknown = undefined;
  for (let pagina = 0; pagina < 100; pagina++) {
    const r = await repo.listarPagina(f, tamanho, cursor);
    ids.push(...r.logs.map(l => l.id));
    expect(r.logs.length).toBeLessThanOrEqual(tamanho);
    if (!r.temMais) return ids;
    cursor = r.cursor;
  }
  throw new Error('paginação não terminou');
}

beforeAll(async () => {
  setLogLevel('silent');
  env = await initializeTestEnvironment({
    projectId: 'demo-retool',
    firestore: { rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8') }
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, 'users', 'admin'), { uid: 'admin', email: 'admin@retool.test', nome: 'Admin', perfil: 'admin', ativo: true, statusAprovacao: 'aprovado' });
    await setDoc(doc(fs, 'users', 'eng'), { uid: 'eng', email: 'eng@retool.test', nome: 'Eng', perfil: 'engenharia', ativo: true, statusAprovacao: 'aprovado' });
    for (const s of SEMENTES) {
      const { resultado, ...resto } = s;
      await setDoc(doc(fs, 'audit_logs', s.id), {
        ...resto, ...(resultado ? { resultado } : {}),
        usuarioNome: s.usuarioUid, usuarioEmail: `${s.usuarioUid}@retool.test`, usuarioPerfil: 'admin', entidadeId: 'x'
      });
    }
  });
  (globalThis as any).__dbHistorico = env.authenticatedContext('admin', { email: 'admin@retool.test' }).firestore();
});

afterAll(async () => {
  await env?.cleanup();
});

describe('Histórico de ações: todas as combinações de filtros', () => {
  test('o conjunto de combinações cobre filtros isolados, pares, trios e todos juntos', () => {
    // (sem ação + 4 categorias + 2 ações) × usuário × recurso × falhas × período
    expect(combinacoes()).toHaveLength(7 * 2 * 2 * 2 * 2);
  });

  test.each(combinacoes())('%s', async (_nome, filtros) => {
    const ids = esperado(filtros);
    // Página pequena para exercitar o cursor em quase todas as combinações.
    expect(await lerTodasAsPaginas(filtros, 4)).toEqual(ids);
    expect(await repo.contar(filtros)).toBe(ids.length);
  });

  test('sem filtros (filtros limpos) traz todo o histórico, do mais recente ao mais antigo', async () => {
    const primeira = await repo.listarPagina({}, 25);
    expect(primeira.logs.map(l => l.id)).toEqual(esperado({}).slice(0, 25));
    expect(primeira.temMais).toBe(true);
    expect(await repo.contar({})).toBe(SEMENTES.length);
  });

  test('registros legados (sem categoria) seguem acessíveis pelo filtro de ação e sem filtros', async () => {
    const legado = SEMENTES.find(s => !s.categoria)!;
    const porAcao = await lerTodasAsPaginas({ acao: legado.acao as AuditLogAcao }, 50);
    expect(porAcao).toContain(legado.id);
    expect(await lerTodasAsPaginas({}, 50)).toContain(legado.id);
  });

  test('o histórico continua exclusivo da Administração', async () => {
    const admin = (globalThis as any).__dbHistorico;
    (globalThis as any).__dbHistorico = env.authenticatedContext('eng', { email: 'eng@retool.test' }).firestore();
    try {
      await expect(repo.listarPagina({ categoria: 'dados' }, 10)).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(repo.contar({})).rejects.toMatchObject({ code: 'permission-denied' });
    } finally {
      (globalThis as any).__dbHistorico = admin;
    }
  });
});
