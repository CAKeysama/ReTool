import { describe, it, expect } from '@jest/globals';
import { UserProfile } from '../../../domain/entities/user';
import { SolicitacaoCargo, podeSolicitarAlteracaoCargo, validarNovaSolicitacaoCargo } from '../../../domain/entities/solicitacaoCargo';

const usuario = (extra: Partial<UserProfile> = {}): UserProfile => ({
  uid: 'eng', email: 'eng@retool.test', nome: 'Eng', perfil: 'engenharia', ativo: true, statusAprovacao: 'aprovado', ...extra
});

const pendente: SolicitacaoCargo = {
  id: 's1', usuarioUid: 'eng', usuarioNome: 'Eng', usuarioEmail: 'eng@retool.test',
  perfilAtual: 'engenharia', perfilSolicitado: 'projetista', status: 'pendente', dataSolicitacao: '2026-09-01T00:00:00.000Z'
};

describe('Solicitação de alteração de cargo (regras de domínio)', () => {
  it('contas operacionais não-administradoras podem solicitar', () => {
    expect(podeSolicitarAlteracaoCargo(usuario())).toBe(true);
    expect(podeSolicitarAlteracaoCargo(usuario({ perfil: 'gerencia' }))).toBe(true);
  });

  it.each([
    ['Administração (altera cargos diretamente)', { perfil: 'admin' as const }],
    ['convidado pendente', { perfil: 'convidado' as const, ativo: false, statusAprovacao: 'pendente' as const }],
    ['conta bloqueada', { ativo: false }],
    ['senha temporária pendente', { trocaSenhaObrigatoria: true }],
  ])('%s não solicita', (_d, extra) => {
    expect(podeSolicitarAlteracaoCargo(usuario(extra))).toBe(false);
  });

  it('valida cargo solicitado, duplicidade e justificativa', () => {
    expect(validarNovaSolicitacaoCargo(usuario(), 'projetista', null)).toBeNull();
    expect(validarNovaSolicitacaoCargo(usuario(), 'engenharia', null)).toMatch(/diferente/);
    expect(validarNovaSolicitacaoCargo(usuario(), 'convidado', null)).toMatch(/válido/);
    expect(validarNovaSolicitacaoCargo(usuario(), 'root', null)).toMatch(/válido/);
    expect(validarNovaSolicitacaoCargo(usuario(), 'projetista', pendente)).toMatch(/pendente/);
    expect(validarNovaSolicitacaoCargo(usuario(), 'projetista', null, 'x'.repeat(501))).toMatch(/500/);
    expect(validarNovaSolicitacaoCargo(null, 'projetista', null)).toMatch(/não pode/);
  });
});
