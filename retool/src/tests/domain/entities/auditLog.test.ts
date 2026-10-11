import { describe, it, expect } from '@jest/globals';
import {
  ACOES_POR_CATEGORIA, AuditLogAcao, ROTULO_ACAO,
  categoriaDaAcao, isCampoSensivel, sanitizarDadosAuditoria
} from '../../../domain/entities/auditLog';

describe('Categorias de ação da auditoria', () => {
  it('toda ação pertence a exatamente uma categoria', () => {
    const todas = Object.keys(ROTULO_ACAO) as AuditLogAcao[];
    const categorizadas = Object.values(ACOES_POR_CATEGORIA).flat();
    expect(new Set(categorizadas).size).toBe(categorizadas.length);
    expect([...categorizadas].sort()).toEqual([...todas].sort());
  });

  it.each([
    ['login', 'autenticacao'],
    ['logout', 'autenticacao'],
    ['cadastro', 'autenticacao'],
    ['troca_senha', 'autenticacao'],
    ['aprovacao_usuario', 'usuarios'],
    ['rejeicao_usuario', 'usuarios'],
    ['criacao_usuario', 'usuarios'],
    ['solicitacao_cargo', 'usuarios'],
    ['aprovacao_cargo', 'usuarios'],
    ['rejeicao_cargo', 'usuarios'],
    ['alteracao_perfil', 'usuarios'],
    ['edicao', 'dados'],
    ['transicao', 'fluxo'],
  ] as const)('%s → %s', (acao, categoria) => {
    expect(categoriaDaAcao(acao)).toBe(categoria);
  });
});

describe('Sanitização: segredos nunca chegam à auditoria', () => {
  it.each(['senha', 'senhaTemporaria', 'novaSenha', 'password', 'userPassword', 'idToken', 'refresh_token', 'apiKey', 'senhaHash', 'secret'])(
    'campo "%s" é sensível', (campo) => {
      expect(isCampoSensivel(campo)).toBe(true);
    }
  );

  it.each(['nome', 'email', 'perfil', 'motivo', 'secretaria', 'hashtagCampanha'])(
    'campo "%s" não é sensível', (campo) => {
      expect(isCampoSensivel(campo)).toBe(false);
    }
  );

  it('remove segredos em qualquer nível e preserva o restante', () => {
    const limpo = sanitizarDadosAuditoria({
      email: 'a@b.c',
      senha: '123456',
      senhaTemporaria: 'Xy7!abcDEF',
      trocaSenhaObrigatoria: true,
      conteudo: {
        perfil: 'engenharia',
        credenciais: { password: 'segredo', usuario: 'ana' },
        lista: [{ token: 'abc', id: 1 }, { novaSenha: 'x', id: 2 }]
      },
      vazio: undefined
    });
    expect(limpo).toEqual({
      email: 'a@b.c',
      trocaSenhaObrigatoria: true,
      conteudo: {
        perfil: 'engenharia',
        credenciais: { usuario: 'ana' },
        lista: [{ id: 1 }, { id: 2 }]
      }
    });
    expect(JSON.stringify(limpo)).not.toMatch(/123456|Xy7!abcDEF|segredo|"abc"/);
  });

  it('valores não-objeto (ex.: carimbos do servidor) passam intactos', () => {
    class Carimbo { constructor(public s: number) {} }
    const c = new Carimbo(10);
    expect(sanitizarDadosAuditoria({ quando: c }).quando).toBe(c);
  });
});
