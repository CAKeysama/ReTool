import '../../mocks/firebaseMock';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { FirestoreAuditLogRepository } from '../../../data/repositories/FirestoreAuditLogRepository';

const repo = new FirestoreAuditLogRepository();

function log(id: string, minuto: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    dataHora: `2026-09-10T10:${String(minuto).padStart(2, '0')}:00.000Z`,
    usuarioUid: 'eng',
    usuarioNome: 'Eng',
    usuarioEmail: 'eng@retool.test',
    usuarioPerfil: 'engenharia',
    acao: 'edicao',
    tipoEntidade: 'dispositivo',
    entidadeId: 'd1',
    ...extra
  };
}

beforeEach(() => {
  resetMockDb();
  mockDbState.audit_logs.push(
    log('l1', 1, { acao: 'login', tipoEntidade: 'sessao' }),
    log('l2', 2),
    log('l3', 3, { usuarioUid: 'admin', acao: 'aprovacao_usuario', tipoEntidade: 'usuario', resultado: 'sucesso', categoria: 'usuarios' }),
    log('l4', 4, { acao: 'login', tipoEntidade: 'sessao', resultado: 'negado' }),
    log('l5', 5, { usuarioUid: 'admin', acao: 'criacao_usuario', tipoEntidade: 'usuario', resultado: 'falha' }),
  );
});

describe('Histórico de ações: registro', () => {
  test('grava categoria, resultado padrão e remove segredos', async () => {
    await repo.registrarLog({
      usuarioUid: 'admin', usuarioNome: 'Admin', usuarioEmail: 'admin@retool.test', usuarioPerfil: 'admin',
      acao: 'criacao_usuario', tipoEntidade: 'usuario', entidadeId: 'u9',
      conteudo: { email: 'u9@retool.test', senhaTemporaria: 'Abc123!xyz', trocaSenhaObrigatoria: true, extra: undefined }
    });
    const salvo = mockDbState.audit_logs[mockDbState.audit_logs.length - 1];
    expect(salvo).toMatchObject({ categoria: 'usuarios', resultado: 'sucesso' });
    expect(salvo.conteudo).toEqual({ email: 'u9@retool.test', trocaSenhaObrigatoria: true });
    expect(JSON.stringify(salvo)).not.toContain('Abc123!xyz');
  });

  test('não grava campos indefinidos (o Firestore os recusaria)', async () => {
    await repo.registrarLog({
      usuarioUid: 'eng', usuarioNome: 'Eng', usuarioEmail: '', usuarioPerfil: 'engenharia',
      acao: 'edicao', tipoEntidade: 'dispositivo', entidadeId: 'd1', dadosAnteriores: undefined, entidadeNome: undefined
    });
    const salvo = mockDbState.audit_logs[mockDbState.audit_logs.length - 1];
    expect('dadosAnteriores' in salvo).toBe(false);
    expect('entidadeNome' in salvo).toBe(false);
  });
});

describe('Histórico de ações: consulta paginada (tela da Administração)', () => {
  test('pagina do mais recente para o mais antigo com cursor', async () => {
    const p1 = await repo.listarPagina({}, 2);
    expect(p1.logs.map(l => l.id)).toEqual(['l5', 'l4']);
    expect(p1.temMais).toBe(true);

    const p2 = await repo.listarPagina({}, 2, p1.cursor);
    expect(p2.logs.map(l => l.id)).toEqual(['l3', 'l2']);
    expect(p2.temMais).toBe(true);

    const p3 = await repo.listarPagina({}, 2, p2.cursor);
    expect(p3.logs.map(l => l.id)).toEqual(['l1']);
    expect(p3.temMais).toBe(false);
  });

  test('normaliza registros legados (categoria e resultado ausentes)', async () => {
    const { logs } = await repo.listarPagina({ acao: 'login' }, 10);
    expect(logs.find(l => l.id === 'l1')).toMatchObject({ categoria: 'autenticacao', resultado: 'sucesso' });
  });

  test.each([
    [{ acao: 'login' as const }, ['l4', 'l1']],
    [{ categoria: 'usuarios' as const }, ['l5', 'l3']],
    [{ usuarioUid: 'admin' }, ['l5', 'l3']],
    [{ tipoEntidade: 'dispositivo' as const }, ['l2']],
    [{ somenteFalhas: true }, ['l5', 'l4']],
    [{ de: '2026-09-10T10:02:00.000Z', ate: '2026-09-10T10:04:00.000Z' }, ['l4', 'l3', 'l2']],
    [{ categoria: 'autenticacao' as const, somenteFalhas: true }, ['l4']],
  ])('filtra por %o', async (filtros, esperado) => {
    const { logs } = await repo.listarPagina(filtros, 10);
    expect(logs.map(l => l.id)).toEqual(esperado);
  });

  test('contagem total respeita os filtros e ignora a paginação', async () => {
    expect(await repo.contar({})).toBe(5);
    expect(await repo.contar({ usuarioUid: 'admin' })).toBe(2);
    expect(await repo.contar({ somenteFalhas: true })).toBe(2);
  });
});
