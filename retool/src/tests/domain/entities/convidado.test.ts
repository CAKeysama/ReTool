import { describe, it, expect } from '@jest/globals';
import {
  CONVIDADO_CONFIG, PERFIS_ATRIBUIVEIS, ROLES_CONFIG, UserProfile,
  configDoPerfil, isAdministrador, isContaOperacional, isPerfilAtribuivel,
  mensagemAcessoNegado, podeManterSessao, situacaoDoUsuario, telaDaSessao
} from '../../../domain/entities/user';

const perfil = (extra: Partial<UserProfile>): UserProfile => ({
  uid: 'u1', email: 'u1@retool.test', nome: 'U1', perfil: 'engenharia', ativo: true, ...extra
});

describe('Convidado: autocadastro sem permissões', () => {
  it('não concede nenhuma permissão', () => {
    const permissoes = [
      'canConsultar', 'canCadastrar', 'canEditar', 'canExcluir',
      'canAprovar', 'canSolicitar', 'canGerenciarUsuarios', 'canVerLogs'
    ] as const;
    permissoes.forEach(p => expect(CONVIDADO_CONFIG[p]).toBe(false));
  });

  it('não é um cargo atribuível pela Administração', () => {
    expect(PERFIS_ATRIBUIVEIS).toEqual(['admin', 'projetista', 'engenharia', 'gerencia']);
    expect(isPerfilAtribuivel('convidado')).toBe(false);
    expect(isPerfilAtribuivel('superadmin')).toBe(false);
    expect(isPerfilAtribuivel('projetista')).toBe(true);
  });

  it('perfil desconhecido cai no menor privilégio', () => {
    expect(configDoPerfil('convidado')).toBe(CONVIDADO_CONFIG);
    expect(configDoPerfil(undefined)).toBe(CONVIDADO_CONFIG);
    expect(configDoPerfil('root')).toBe(CONVIDADO_CONFIG);
    expect(configDoPerfil('admin')).toBe(ROLES_CONFIG.admin);
  });
});

describe('Situação da conta', () => {
  it.each([
    ['convidado pendente', { perfil: 'convidado', ativo: false, statusAprovacao: 'pendente' }, 'pendente'],
    ['cadastro rejeitado', { perfil: 'convidado', ativo: false, statusAprovacao: 'rejeitado' }, 'rejeitado'],
    ['conta aprovada ativa', { ativo: true, statusAprovacao: 'aprovado' }, 'ativo'],
    ['conta aprovada bloqueada', { ativo: false, statusAprovacao: 'aprovado' }, 'bloqueado'],
    ['conta legada ativa', { ativo: true }, 'ativo'],
    ['conta legada bloqueada', { ativo: false }, 'bloqueado'],
    ['pendente legado (tier solicitado)', { perfil: 'gerencia', ativo: false, perfilSolicitado: 'engenharia' }, 'pendente'],
    ['convidado ativo inconsistente', { perfil: 'convidado', ativo: true }, 'pendente'],
  ] as const)('%s', (_desc, dados, esperado) => {
    expect(situacaoDoUsuario(perfil(dados as Partial<UserProfile>))).toBe(esperado);
  });

  it('usuário pendente não opera, mas mantém a sessão na área do convidado', () => {
    const convidado = perfil({ perfil: 'convidado', ativo: false, statusAprovacao: 'pendente' });
    expect(isContaOperacional(convidado)).toBe(false);
    expect(podeManterSessao(convidado)).toBe(true);
    expect(telaDaSessao(convidado)).toBe('aguardando_aprovacao');
  });

  it('senha temporária obriga a troca antes de operar', () => {
    const temp = perfil({ statusAprovacao: 'aprovado', trocaSenhaObrigatoria: true });
    expect(isContaOperacional(temp)).toBe(false);
    expect(telaDaSessao(temp)).toBe('troca_senha');
    expect(telaDaSessao({ ...temp, trocaSenhaObrigatoria: false })).toBe('sistema');
  });

  it('bloqueados, rejeitados e sessões sem perfil voltam ao login', () => {
    expect(telaDaSessao(null)).toBe('login');
    expect(telaDaSessao(perfil({ ativo: false, statusAprovacao: 'aprovado' }))).toBe('login');
    expect(telaDaSessao(perfil({ perfil: 'convidado', ativo: false, statusAprovacao: 'rejeitado' }))).toBe('login');
  });

  it('administração só é reconhecida em conta operacional', () => {
    expect(isAdministrador(perfil({ perfil: 'admin' }))).toBe(true);
    expect(isAdministrador(perfil({ perfil: 'admin', ativo: false }))).toBe(false);
    expect(isAdministrador(perfil({ perfil: 'admin', trocaSenhaObrigatoria: true }))).toBe(false);
    expect(isAdministrador(perfil({ perfil: 'projetista' }))).toBe(false);
  });

  it('mensagem de acesso negado informa o motivo da rejeição', () => {
    const rejeitado = perfil({ perfil: 'convidado', ativo: false, statusAprovacao: 'rejeitado', motivoRejeicao: 'Fora do escopo' });
    expect(mensagemAcessoNegado(rejeitado)).toContain('recusada');
    expect(mensagemAcessoNegado(rejeitado)).toContain('Fora do escopo');
    expect(mensagemAcessoNegado(perfil({ ativo: false }))).toContain('desativado');
  });
});
