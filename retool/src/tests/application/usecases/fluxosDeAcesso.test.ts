import '../../mocks/firebaseMock';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { FirestoreUsersRepository } from '../../../data/repositories/FirestoreUsersRepository';
import { FirestoreAuditLogRepository } from '../../../data/repositories/FirestoreAuditLogRepository';
import { FirestoreNotificationsRepository } from '../../../data/repositories/FirestoreNotificationsRepository';
import { FirestoreSolicitacoesCargoRepository } from '../../../data/repositories/FirestoreSolicitacoesCargoRepository';
import { SolicitarCadastroUseCase } from '../../../application/usecases/SolicitarCadastroUseCase';
import { DecidirCadastroUseCase } from '../../../application/usecases/DecidirCadastroUseCase';
import { SolicitarAlteracaoCargoUseCase } from '../../../application/usecases/SolicitarAlteracaoCargoUseCase';
import { DecidirSolicitacaoCargoUseCase } from '../../../application/usecases/DecidirSolicitacaoCargoUseCase';
import { CriarContaAdministrativaUseCase, ContaAuthCriada } from '../../../application/usecases/CriarContaAdministrativaUseCase';
import { ConcluirTrocaSenhaUseCase } from '../../../application/usecases/ConcluirTrocaSenhaUseCase';
import { ErroPermissao, ErroValidacao } from '../../../application/usecases/acessosComum';
import { UserProfile, isContaOperacional, podeManterSessao, situacaoDoUsuario, telaDaSessao } from '../../../domain/entities/user';

const usersRepo = new FirestoreUsersRepository();
const auditRepo = new FirestoreAuditLogRepository();
const notificationsRepo = new FirestoreNotificationsRepository();
const solicitacoesRepo = new FirestoreSolicitacoesCargoRepository();

const solicitarCadastro = new SolicitarCadastroUseCase(usersRepo, auditRepo, notificationsRepo);
const decidirCadastro = new DecidirCadastroUseCase(usersRepo, auditRepo, notificationsRepo);
const solicitarCargo = new SolicitarAlteracaoCargoUseCase(solicitacoesRepo, usersRepo, auditRepo, notificationsRepo);
const decidirCargo = new DecidirSolicitacaoCargoUseCase(solicitacoesRepo, usersRepo, auditRepo, notificationsRepo);

function semear(uid: string, dados: Partial<UserProfile>): UserProfile {
  const perfil: UserProfile = {
    uid, email: `${uid}@retool.test`, nome: uid.toUpperCase(), perfil: 'engenharia',
    ativo: true, statusAprovacao: 'aprovado', criadoEm: '2026-09-01T00:00:00.000Z', ...dados
  };
  mockDbState.users.push({ ...perfil, id: uid });
  return perfil;
}

const usuarioNoBanco = (uid: string) => mockDbState.users.find(u => u.id === uid);
const logsDa = (acao: string) => mockDbState.audit_logs.filter(l => l.acao === acao);
const notificacoesDo = (tipo: string) => mockDbState.notifications.filter(n => n.tipo === tipo);
/** Nenhum documento do banco (perfil, auditoria, notificação...) contém o texto. */
const bancoContem = (texto: string) => JSON.stringify(mockDbState).includes(texto);

let admin: UserProfile;
let admin2: UserProfile;
let eng: UserProfile;
let proj: UserProfile;

beforeEach(() => {
  resetMockDb();
  admin = semear('admin', { perfil: 'admin' });
  admin2 = semear('admin2', { perfil: 'admin' });
  semear('adminbloqueado', { perfil: 'admin', ativo: false });
  eng = semear('eng', { perfil: 'engenharia' });
  proj = semear('proj', { perfil: 'projetista' });
});

describe('Fluxo A — cadastro público e aprovação', () => {
  test('cadastro sem cargo: entra como Convidado aguardando aprovação', async () => {
    // Mesmo que um cliente malicioso envie campos extras, o caso de uso não os aceita.
    const dados = { uid: 'novo', email: ' Novo@Retool.Test ', nome: '  Nova Pessoa ', perfil: 'admin', ativo: true } as any;
    const perfil = await solicitarCadastro.execute(dados);

    expect(perfil).toMatchObject({ perfil: 'convidado', ativo: false, statusAprovacao: 'pendente', email: 'novo@retool.test', nome: 'Nova Pessoa' });
    expect(usuarioNoBanco('novo')).toMatchObject({ perfil: 'convidado', ativo: false, statusAprovacao: 'pendente' });
    expect(situacaoDoUsuario(perfil)).toBe('pendente');
    expect(isContaOperacional(perfil)).toBe(false);
    expect(telaDaSessao(perfil)).toBe('aguardando_aprovacao');
  });

  test('novo cadastro notifica cada administrador ativo (e só eles)', async () => {
    await solicitarCadastro.execute({ uid: 'novo', email: 'novo@retool.test', nome: 'Nova' });

    const notifs = notificacoesDo('conta_nova');
    expect(notifs.map(n => n.destinatarioUid).sort()).toEqual(['admin', 'admin2']);
    notifs.forEach(n => {
      expect(n).toMatchObject({ remetenteUid: 'novo', entidadeId: 'novo', lida: false });
    });
  });

  test('cadastro é registrado na auditoria', async () => {
    await solicitarCadastro.execute({ uid: 'novo', email: 'novo@retool.test', nome: 'Nova' });
    const [log] = logsDa('cadastro');
    expect(log).toMatchObject({
      usuarioUid: 'novo', usuarioPerfil: 'convidado', categoria: 'autenticacao', resultado: 'sucesso',
      tipoEntidade: 'usuario', entidadeId: 'novo'
    });
    expect(log.conteudo.administradoresNotificados).toBe(2);
  });

  test('cadastro sem nome é recusado', async () => {
    await expect(solicitarCadastro.execute({ uid: 'novo', email: 'n@r.t', nome: '   ' })).rejects.toBeInstanceOf(ErroValidacao);
    expect(usuarioNoBanco('novo')).toBeUndefined();
  });

  test('aprovação define o cargo, ativa a conta, notifica e audita', async () => {
    await solicitarCadastro.execute({ uid: 'novo', email: 'novo@retool.test', nome: 'Nova' });
    await decidirCadastro.execute({ admin, alvoUid: 'novo', aprovar: true, perfil: 'projetista' });

    const u = usuarioNoBanco('novo');
    expect(u).toMatchObject({ perfil: 'projetista', ativo: true, statusAprovacao: 'aprovado', aprovadoPorUid: 'admin' });
    expect(telaDaSessao(u)).toBe('sistema');

    expect(notificacoesDo('conta_decidida')).toEqual([
      expect.objectContaining({ destinatarioUid: 'novo', remetenteUid: 'admin', decisao: 'aprovada' })
    ]);
    // A notificação desta administradora deixa de exigir ação.
    expect(mockDbState.notifications.find(n => n.id === 'conta_nova_novo_admin')?.resolvida).toBe(true);

    const [log] = logsDa('aprovacao_usuario');
    expect(log).toMatchObject({ usuarioUid: 'admin', entidadeId: 'novo', resultado: 'sucesso', categoria: 'usuarios' });
    expect(log.conteudo.perfilDefinido).toBe('projetista');
    expect(log.dadosAnteriores).toMatchObject({ perfil: 'convidado', statusAprovacao: 'pendente' });
  });

  test('aprovação exige um cargo atribuível', async () => {
    await solicitarCadastro.execute({ uid: 'novo', email: 'novo@retool.test', nome: 'Nova' });
    await expect(decidirCadastro.execute({ admin, alvoUid: 'novo', aprovar: true })).rejects.toBeInstanceOf(ErroValidacao);
    await expect(decidirCadastro.execute({ admin, alvoUid: 'novo', aprovar: true, perfil: 'convidado' as any })).rejects.toBeInstanceOf(ErroValidacao);
    expect(usuarioNoBanco('novo')).toMatchObject({ perfil: 'convidado', ativo: false, statusAprovacao: 'pendente' });
  });

  test('rejeição mantém a conta inativa, registra o motivo e impede o acesso', async () => {
    await solicitarCadastro.execute({ uid: 'novo', email: 'novo@retool.test', nome: 'Nova' });
    await decidirCadastro.execute({ admin, alvoUid: 'novo', aprovar: false, motivo: 'Fora do escopo' });

    const u = usuarioNoBanco('novo');
    expect(u).toMatchObject({ perfil: 'convidado', ativo: false, statusAprovacao: 'rejeitado', motivoRejeicao: 'Fora do escopo' });
    expect(podeManterSessao(u)).toBe(false);
    expect(telaDaSessao(u)).toBe('login');
    expect(notificacoesDo('conta_decidida')[0]).toMatchObject({ decisao: 'recusada', destinatarioUid: 'novo' });
    expect(logsDa('rejeicao_usuario')[0]).toMatchObject({ usuarioUid: 'admin', entidadeId: 'novo', conteudo: { motivo: 'Fora do escopo' } });
  });

  test('cadastro já decidido não é decidido de novo', async () => {
    await solicitarCadastro.execute({ uid: 'novo', email: 'novo@retool.test', nome: 'Nova' });
    await decidirCadastro.execute({ admin, alvoUid: 'novo', aprovar: false });
    await expect(decidirCadastro.execute({ admin: admin2, alvoUid: 'novo', aprovar: true, perfil: 'admin' }))
      .rejects.toBeInstanceOf(ErroValidacao);
    expect(usuarioNoBanco('novo')).toMatchObject({ statusAprovacao: 'rejeitado', ativo: false });
  });

  test.each(['eng', 'proj'])('%s não aprova usuários (tentativa auditada como negada)', async (uid) => {
    await solicitarCadastro.execute({ uid: 'novo', email: 'novo@retool.test', nome: 'Nova' });
    const ator = uid === 'eng' ? eng : proj;
    await expect(decidirCadastro.execute({ admin: ator, alvoUid: 'novo', aprovar: true, perfil: 'admin' }))
      .rejects.toBeInstanceOf(ErroPermissao);
    expect(usuarioNoBanco('novo')).toMatchObject({ perfil: 'convidado', ativo: false });
    expect(logsDa('aprovacao_usuario')).toEqual([expect.objectContaining({ usuarioUid: uid, resultado: 'negado' })]);
  });

  test('convidado não aprova o próprio cadastro', async () => {
    const convidado = await solicitarCadastro.execute({ uid: 'novo', email: 'novo@retool.test', nome: 'Nova' });
    await expect(decidirCadastro.execute({ admin: convidado, alvoUid: 'novo', aprovar: true, perfil: 'admin' }))
      .rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('Fluxo B — solicitação de alteração de cargo', () => {
  test('solicitação é persistida, notifica a Administração e é auditada — sem mudar o cargo', async () => {
    const s = await solicitarCargo.execute({ usuario: eng, perfilSolicitado: 'projetista', justificativa: 'Assumi projetos' });

    expect(mockDbState.solicitacoes_cargo).toEqual([expect.objectContaining({
      id: s.id, usuarioUid: 'eng', perfilAtual: 'engenharia', perfilSolicitado: 'projetista', status: 'pendente', justificativa: 'Assumi projetos'
    })]);
    expect(mockDbState.pendencias_cargo).toEqual([expect.objectContaining({ id: 'eng', solicitacaoId: s.id })]);
    expect(usuarioNoBanco('eng').perfil).toBe('engenharia');

    expect(notificacoesDo('cargo_solicitado').map(n => n.destinatarioUid).sort()).toEqual(['admin', 'admin2']);
    expect(logsDa('solicitacao_cargo')[0]).toMatchObject({
      usuarioUid: 'eng', tipoEntidade: 'solicitacao_cargo', entidadeId: s.id,
      conteudo: { perfilAtual: 'engenharia', perfilSolicitado: 'projetista', administradoresNotificados: 2 }
    });
  });

  test('não permite solicitações conflitantes para o mesmo usuário', async () => {
    await solicitarCargo.execute({ usuario: eng, perfilSolicitado: 'projetista' });
    await expect(solicitarCargo.execute({ usuario: eng, perfilSolicitado: 'admin' })).rejects.toThrow(/pendente/);
    expect(mockDbState.solicitacoes_cargo).toHaveLength(1);
  });

  test('cargo igual ao atual ou inexistente é recusado', async () => {
    await expect(solicitarCargo.execute({ usuario: eng, perfilSolicitado: 'engenharia' })).rejects.toBeInstanceOf(ErroValidacao);
    await expect(solicitarCargo.execute({ usuario: eng, perfilSolicitado: 'convidado' as any })).rejects.toBeInstanceOf(ErroValidacao);
  });

  test('Administração não usa o fluxo de solicitação (altera cargos diretamente)', async () => {
    await expect(solicitarCargo.execute({ usuario: admin, perfilSolicitado: 'gerencia' })).rejects.toBeInstanceOf(ErroValidacao);
  });

  test('aprovação altera o cargo, fecha a solicitação, libera nova solicitação, notifica e audita', async () => {
    const s = await solicitarCargo.execute({ usuario: eng, perfilSolicitado: 'projetista' });
    await decidirCargo.execute({ admin, solicitacaoId: s.id, aprovar: true });

    expect(usuarioNoBanco('eng').perfil).toBe('projetista');
    expect(mockDbState.solicitacoes_cargo[0]).toMatchObject({ status: 'aprovada', decididoPorUid: 'admin' });
    expect(mockDbState.pendencias_cargo).toHaveLength(0);
    expect(notificacoesDo('cargo_decidido')[0]).toMatchObject({ destinatarioUid: 'eng', decisao: 'aprovada' });
    expect(mockDbState.notifications.find(n => n.id === `cargo_solicitado_${s.id}_admin`)?.resolvida).toBe(true);
    expect(logsDa('aprovacao_cargo')[0]).toMatchObject({
      usuarioUid: 'admin', entidadeId: s.id, resultado: 'sucesso',
      conteudo: { usuarioUid: 'eng', perfilAnterior: 'engenharia', perfilResultante: 'projetista' }
    });

    // Com a trava liberada, o usuário pode fazer uma nova solicitação.
    const atualizado = { ...eng, perfil: 'projetista' as const };
    await expect(solicitarCargo.execute({ usuario: atualizado, perfilSolicitado: 'admin' })).resolves.toMatchObject({ status: 'pendente' });
  });

  test('rejeição não altera o cargo', async () => {
    const s = await solicitarCargo.execute({ usuario: eng, perfilSolicitado: 'admin' });
    await decidirCargo.execute({ admin, solicitacaoId: s.id, aprovar: false, motivo: 'Sem necessidade' });

    expect(usuarioNoBanco('eng').perfil).toBe('engenharia');
    expect(mockDbState.solicitacoes_cargo[0]).toMatchObject({ status: 'rejeitada', motivoDecisao: 'Sem necessidade' });
    expect(mockDbState.pendencias_cargo).toHaveLength(0);
    expect(notificacoesDo('cargo_decidido')[0]).toMatchObject({ decisao: 'rejeitada' });
    expect(logsDa('rejeicao_cargo')[0].conteudo).toMatchObject({ perfilResultante: 'engenharia', motivo: 'Sem necessidade' });
  });

  test('solicitação já decidida não é decidida de novo', async () => {
    const s = await solicitarCargo.execute({ usuario: eng, perfilSolicitado: 'projetista' });
    await decidirCargo.execute({ admin, solicitacaoId: s.id, aprovar: false });
    await expect(decidirCargo.execute({ admin: admin2, solicitacaoId: s.id, aprovar: true })).rejects.toBeInstanceOf(ErroValidacao);
    expect(usuarioNoBanco('eng').perfil).toBe('engenharia');
  });

  test('usuário comum não aprova solicitações — nem a própria', async () => {
    const s = await solicitarCargo.execute({ usuario: eng, perfilSolicitado: 'admin' });
    await expect(decidirCargo.execute({ admin: eng, solicitacaoId: s.id, aprovar: true })).rejects.toBeInstanceOf(ErroPermissao);
    await expect(decidirCargo.execute({ admin: proj, solicitacaoId: s.id, aprovar: true })).rejects.toBeInstanceOf(ErroPermissao);
    expect(usuarioNoBanco('eng').perfil).toBe('engenharia');
    expect(mockDbState.solicitacoes_cargo[0].status).toBe('pendente');
    expect(logsDa('aprovacao_cargo').every(l => l.resultado === 'negado')).toBe(true);
  });

  test('nem a Administração decide uma solicitação feita por ela mesma', async () => {
    mockDbState.solicitacoes_cargo.push({
      id: 'sol-admin', usuarioUid: 'admin', usuarioNome: 'ADMIN', usuarioEmail: 'admin@retool.test',
      perfilAtual: 'admin', perfilSolicitado: 'gerencia', status: 'pendente', dataSolicitacao: '2026-09-01T00:00:00.000Z'
    });
    await expect(decidirCargo.execute({ admin, solicitacaoId: 'sol-admin', aprovar: true })).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe('Fluxo C — conta criada pela Administração com senha temporária', () => {
  function authFalso() {
    const contas: { email: string; senha: string }[] = [];
    const desfazer = jest.fn(async () => undefined);
    const finalizar = jest.fn(async () => undefined);
    const criar = jest.fn(async (email: string, senha: string): Promise<ContaAuthCriada> => {
      contas.push({ email, senha });
      return { uid: `uid-${contas.length}`, desfazer, finalizar };
    });
    return { contas, criar, desfazer, finalizar };
  }

  test('gera senha temporária segura, guarda só no provedor de autenticação e exige troca', async () => {
    const auth = authFalso();
    const uc = new CriarContaAdministrativaUseCase(usersRepo, auditRepo, auth.criar);
    const { perfil, senhaTemporaria } = await uc.execute({ admin, nome: 'Ana', email: 'Ana@Retool.Test', perfil: 'engenharia' });

    expect(senhaTemporaria.length).toBeGreaterThanOrEqual(12);
    expect(auth.contas).toEqual([{ email: 'ana@retool.test', senha: senhaTemporaria }]);
    expect(auth.finalizar).toHaveBeenCalled();
    expect(perfil).toMatchObject({ perfil: 'engenharia', ativo: true, statusAprovacao: 'aprovado', trocaSenhaObrigatoria: true, criadoPorUid: 'admin' });
    expect(usuarioNoBanco(perfil.uid)).toMatchObject({ trocaSenhaObrigatoria: true });
    expect(telaDaSessao(usuarioNoBanco(perfil.uid))).toBe('troca_senha');

    // A senha não está em texto puro em lugar nenhum do banco (perfil, auditoria...).
    expect(bancoContem(senhaTemporaria)).toBe(false);
    const [log] = logsDa('criacao_usuario');
    expect(log).toMatchObject({ usuarioUid: 'admin', entidadeId: perfil.uid, resultado: 'sucesso', conteudo: { trocaSenhaObrigatoria: true } });
  });

  test('cada conta recebe uma senha diferente', async () => {
    const auth = authFalso();
    const uc = new CriarContaAdministrativaUseCase(usersRepo, auditRepo, auth.criar);
    const a = await uc.execute({ admin, nome: 'A', email: 'a@retool.test', perfil: 'gerencia' });
    const b = await uc.execute({ admin, nome: 'B', email: 'b@retool.test', perfil: 'gerencia' });
    expect(a.senhaTemporaria).not.toBe(b.senhaTemporaria);
  });

  test('somente a Administração cria contas', async () => {
    const auth = authFalso();
    const uc = new CriarContaAdministrativaUseCase(usersRepo, auditRepo, auth.criar);
    await expect(uc.execute({ admin: proj, nome: 'X', email: 'x@retool.test', perfil: 'admin' })).rejects.toBeInstanceOf(ErroPermissao);
    expect(auth.criar).not.toHaveBeenCalled();
    expect(logsDa('criacao_usuario')).toEqual([expect.objectContaining({ usuarioUid: 'proj', resultado: 'negado' })]);
  });

  test('dados inválidos são recusados antes de criar a autenticação', async () => {
    const auth = authFalso();
    const uc = new CriarContaAdministrativaUseCase(usersRepo, auditRepo, auth.criar);
    await expect(uc.execute({ admin, nome: '', email: 'x@retool.test', perfil: 'gerencia' })).rejects.toBeInstanceOf(ErroValidacao);
    await expect(uc.execute({ admin, nome: 'X', email: 'invalido', perfil: 'gerencia' })).rejects.toBeInstanceOf(ErroValidacao);
    await expect(uc.execute({ admin, nome: 'X', email: 'x@retool.test', perfil: 'convidado' as any })).rejects.toBeInstanceOf(ErroValidacao);
    expect(auth.criar).not.toHaveBeenCalled();
  });

  test('falha ao gravar o perfil desfaz a conta de autenticação e registra a falha', async () => {
    const auth = authFalso();
    const repoComFalha = Object.create(usersRepo);
    repoComFalha.setProfile = jest.fn(async () => { throw Object.assign(new Error('negado'), { code: 'permission-denied' }); });
    const uc = new CriarContaAdministrativaUseCase(repoComFalha, auditRepo, auth.criar);

    await expect(uc.execute({ admin, nome: 'Ana', email: 'ana@retool.test', perfil: 'engenharia' })).rejects.toThrow('negado');
    expect(auth.desfazer).toHaveBeenCalled();
    expect(auth.finalizar).toHaveBeenCalled();
    expect(logsDa('criacao_usuario')).toEqual([expect.objectContaining({ resultado: 'falha' })]);
    expect(bancoContem(auth.contas[0].senha)).toBe(false);
  });

  describe('primeiro acesso', () => {
    let senhaTemporaria: string;
    let usuario: UserProfile;
    let atualizarSenha: jest.Mock<(atual: string, nova: string) => Promise<void>>;
    let trocaSenha: ConcluirTrocaSenhaUseCase;

    beforeEach(async () => {
      const auth = authFalso();
      const criada = await new CriarContaAdministrativaUseCase(usersRepo, auditRepo, auth.criar)
        .execute({ admin, nome: 'Ana', email: 'ana@retool.test', perfil: 'engenharia' });
      senhaTemporaria = criada.senhaTemporaria;
      usuario = criada.perfil;
      atualizarSenha = jest.fn(async (atual: string) => {
        if (atual !== senhaTemporaria) throw Object.assign(new Error('senha incorreta'), { code: 'auth/invalid-credential' });
      });
      trocaSenha = new ConcluirTrocaSenhaUseCase(usersRepo, auditRepo, atualizarSenha);
    });

    test('é obrigatório trocar a senha antes de operar', () => {
      expect(isContaOperacional(usuario)).toBe(false);
      expect(telaDaSessao(usuario)).toBe('troca_senha');
    });

    test('nova senha fora da política é recusada sem tocar no provedor', async () => {
      await expect(trocaSenha.execute({ usuario, senhaAtual: senhaTemporaria, novaSenha: 'curta1', confirmacao: 'curta1' }))
        .rejects.toBeInstanceOf(ErroValidacao);
      await expect(trocaSenha.execute({ usuario, senhaAtual: senhaTemporaria, novaSenha: senhaTemporaria, confirmacao: senhaTemporaria }))
        .rejects.toBeInstanceOf(ErroValidacao);
      expect(atualizarSenha).not.toHaveBeenCalled();
      expect(usuarioNoBanco(usuario.uid).trocaSenhaObrigatoria).toBe(true);
    });

    test('senha temporária incorreta mantém a exigência e registra a falha', async () => {
      await expect(trocaSenha.execute({ usuario, senhaAtual: 'errada', novaSenha: 'NovaSenha2026', confirmacao: 'NovaSenha2026' }))
        .rejects.toThrow('senha incorreta');
      expect(usuarioNoBanco(usuario.uid).trocaSenhaObrigatoria).toBe(true);
      expect(logsDa('troca_senha')).toEqual([expect.objectContaining({ resultado: 'falha', usuarioUid: usuario.uid })]);
    });

    test('troca concluída remove a exigência e libera o login normal', async () => {
      await trocaSenha.execute({ usuario, senhaAtual: senhaTemporaria, novaSenha: 'NovaSenha2026', confirmacao: 'NovaSenha2026' });

      expect(atualizarSenha).toHaveBeenCalledWith(senhaTemporaria, 'NovaSenha2026');
      const atualizado = usuarioNoBanco(usuario.uid);
      expect(atualizado.trocaSenhaObrigatoria).toBe(false);
      expect(atualizado.senhaAlteradaEm).toBeTruthy();
      expect(isContaOperacional(atualizado)).toBe(true);
      expect(telaDaSessao(atualizado)).toBe('sistema');

      expect(logsDa('troca_senha')).toEqual([expect.objectContaining({ resultado: 'sucesso', categoria: 'autenticacao' })]);
      expect(bancoContem('NovaSenha2026')).toBe(false);
      expect(bancoContem(senhaTemporaria)).toBe(false);
    });
  });
});
