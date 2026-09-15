import { describe, it, expect } from '@jest/globals';
import { ROLES_CONFIG } from '../../../domain/entities/user';

describe('RBAC - Permissões por Perfil de Usuário', () => {
  it('deve conceder permissões totais para a Programadora / Administradora', () => {
    const admin = ROLES_CONFIG.admin;
    expect(admin.canConsultar).toBe(true);
    expect(admin.canCadastrar).toBe(true);
    expect(admin.canEditar).toBe(true);
    expect(admin.canExcluir).toBe(true);
    expect(admin.canAprovar).toBe(true);
    expect(admin.canGerenciarUsuarios).toBe(true);
    expect(admin.canVerLogs).toBe(true);
  });

  it('deve permitir cadastro/edição e aprovação para o Projetista, mas PROIBIR exclusão', () => {
    const projetista = ROLES_CONFIG.projetista;
    expect(projetista.canConsultar).toBe(true);
    expect(projetista.canCadastrar).toBe(true);
    expect(projetista.canEditar).toBe(true);
    expect(projetista.canExcluir).toBe(false); // Não pode excluir registros
    expect(projetista.canAprovar).toBe(true);   // Aprova solicitações
    expect(projetista.canGerenciarUsuarios).toBe(false);
  });

  it('deve permitir consulta e solicitação para a Engenharia, proibindo cadastro direto, edição e exclusão', () => {
    const engenharia = ROLES_CONFIG.engenharia;
    expect(engenharia.canConsultar).toBe(true);
    expect(engenharia.canCadastrar).toBe(false); // Não cadastra dispositivos diretamente
    expect(engenharia.canEditar).toBe(false);    // Não edita
    expect(engenharia.canExcluir).toBe(false);   // Não exclui
    expect(engenharia.canAprovar).toBe(false);   // Não aprova (apenas solicita)
    expect(engenharia.canSolicitar).toBe(true);  // Solicita reutilização
  });

  it('deve configurar perfil de Gerência como estritamente somente leitura', () => {
    const gerencia = ROLES_CONFIG.gerencia;
    expect(gerencia.canConsultar).toBe(true);
    expect(gerencia.canCadastrar).toBe(false);
    expect(gerencia.canEditar).toBe(false);
    expect(gerencia.canExcluir).toBe(false);
    expect(gerencia.canAprovar).toBe(false);
    expect(gerencia.canSolicitar).toBe(false);
    expect(gerencia.canVerLogs).toBe(true);     // Consulta histórico e movimentações
  });
});
