import '../../mocks/firebaseMock';
import { FirestoreAuditLogRepository } from '../../../data/repositories/FirestoreAuditLogRepository';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { describe, beforeEach, test, expect } from '@jest/globals';

describe('FirestoreAuditLogRepository', () => {
  let repository: FirestoreAuditLogRepository;

  beforeEach(() => {
    resetMockDb();
    repository = new FirestoreAuditLogRepository();
  });

  test('registrarLog grava autoria, ação, conteúdo JSON e carimbo do servidor', async () => {
    const id = await repository.registrarLog({
      usuarioUid: 'uid-123',
      usuarioNome: 'Maria Admin',
      usuarioEmail: 'maria@retool.com',
      usuarioPerfil: 'admin',
      acao: 'criacao',
      acaoDescricao: 'Solicitou reutilização',
      tipoEntidade: 'reutilizacao',
      entidadeId: 'reu-1',
      entidadeNome: 'Dispositivo D1',
      detalhes: 'Solicitou reutilização',
      conteudo: { dispositivoId: 'd1', codigoPeca: 'ABC-123' }
    });

    expect(id).toBeTruthy();
    expect(mockDbState.audit_logs).toHaveLength(1);

    const salvo = mockDbState.audit_logs[0];
    expect(salvo.usuarioUid).toBe('uid-123');
    expect(salvo.usuarioNome).toBe('Maria Admin');
    expect(salvo.usuarioPerfil).toBe('admin');
    expect(salvo.acao).toBe('criacao');
    expect(salvo.acaoDescricao).toBe('Solicitou reutilização');
    expect(salvo.conteudo).toEqual({ dispositivoId: 'd1', codigoPeca: 'ABC-123' });

    // dataHora deve ser string ISO (ordena junto com o acervo legado)…
    expect(typeof salvo.dataHora).toBe('string');
    expect(new Date(salvo.dataHora).getTime()).not.toBeNaN();
    // …e o momento nativo do servidor fica registrado em dataHoraServidor.
    expect(salvo.dataHoraServidor?.__serverTimestampMock).toBe(true);
  });

  test('subscribeLogs retorna do mais recente para o mais antigo, normalizando Timestamps', () => {
    // Legado: apenas string ISO em dataHora.
    mockDbState.audit_logs.push({
      id: 'legado-1',
      dataHora: '2026-09-01T10:00:00.000Z',
      usuarioUid: 'admin',
      usuarioNome: 'Admin',
      usuarioEmail: '',
      usuarioPerfil: 'admin',
      acao: 'exclusao',
      tipoEntidade: 'dispositivo',
      entidadeId: 'd9'
    });
    // Registro novo: carimbo do servidor em dataHoraServidor.
    mockDbState.audit_logs.push({
      id: 'novo-1',
      dataHora: '2026-01-01T00:00:00.000Z', // valor "errado" de propósito
      dataHoraServidor: { toDate: () => new Date('2026-09-15T09:30:00.000Z') },
      usuarioUid: 'eng-1',
      usuarioNome: 'Engenheira',
      usuarioEmail: '',
      usuarioPerfil: 'engenharia',
      acao: 'criacao',
      tipoEntidade: 'reutilizacao',
      entidadeId: 'reu-1'
    });

    let resultado: any[] = [];
    repository.subscribeLogs(logs => { resultado = logs; });

    expect(resultado).toHaveLength(2);
    // Mais recente primeiro: o registro novo (15/09) antecede o legado (01/09).
    expect(resultado[0].id).toBe('novo-1');
    expect(resultado[0].dataHora).toBe('2026-09-15T09:30:00.000Z');
    expect(resultado[1].id).toBe('legado-1');
    expect(resultado[1].dataHora).toBe('2026-09-01T10:00:00.000Z');
  });
});
