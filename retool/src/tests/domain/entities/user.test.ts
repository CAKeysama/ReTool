import { describe, it, expect } from '@jest/globals';
import { ROLES_CONFIG, UserRole } from '../../../domain/entities/user';

// Matriz oficial de permissões (imagem "Retool ADM – Controle de Acesso").
// A coluna "Solicitar" da Engenharia aparece nas colunas Cadastrar/Aprovar
// da imagem como a ação de *solicitar reutilização* (canSolicitar).
const MATRIZ_OFICIAL: Record<UserRole, {
  consultar: boolean; cadastrar: boolean; editar: boolean;
  excluir: boolean; aprovar: boolean; solicitar?: boolean;
}> = {
  admin:      { consultar: true,  cadastrar: true,  editar: true,  excluir: true,  aprovar: true  },
  projetista: { consultar: true,  cadastrar: true,  editar: true,  excluir: false, aprovar: true  },
  engenharia: { consultar: true,  cadastrar: false, editar: false, excluir: false, aprovar: false, solicitar: true  },
  gerencia:   { consultar: true,  cadastrar: false, editar: false, excluir: false, aprovar: false, solicitar: false },
};

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

  it('deve refletir exatamente a matriz oficial da imagem de Controle de Acesso', () => {
    (Object.keys(MATRIZ_OFICIAL) as UserRole[]).forEach(perfil => {
      const esperado = MATRIZ_OFICIAL[perfil];
      const config = ROLES_CONFIG[perfil];

      expect(config.canConsultar).toBe(esperado.consultar);
      expect(config.canCadastrar).toBe(esperado.cadastrar);
      expect(config.canEditar).toBe(esperado.editar);
      expect(config.canExcluir).toBe(esperado.excluir);
      expect(config.canAprovar).toBe(esperado.aprovar);

      if (esperado.solicitar !== undefined) {
        expect(config.canSolicitar).toBe(esperado.solicitar);
      }
    });
  });

  it('deve reservar gestão de usuários e auditoria completa apenas para Administração/Gerência', () => {
    expect(ROLES_CONFIG.admin.canGerenciarUsuarios).toBe(true);
    expect(ROLES_CONFIG.projetista.canGerenciarUsuarios).toBe(false);
    expect(ROLES_CONFIG.engenharia.canGerenciarUsuarios).toBe(false);
    expect(ROLES_CONFIG.gerencia.canGerenciarUsuarios).toBe(false);

    expect(ROLES_CONFIG.admin.canVerLogs).toBe(true);
    expect(ROLES_CONFIG.gerencia.canVerLogs).toBe(true);   // Histórico e movimentações
    expect(ROLES_CONFIG.projetista.canVerLogs).toBe(false);
    expect(ROLES_CONFIG.engenharia.canVerLogs).toBe(false);
  });
});
