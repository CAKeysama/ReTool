/// <reference types="node" />
/**
 * Testes das regras de segurança do Firestore (a camada "backend" do ReTool)
 * executados contra o emulador oficial:
 *
 *   npm run test:rules
 *
 * Cobrem as garantias server-side: nenhum cliente eleva o próprio cargo,
 * aprova o próprio cadastro/solicitação, lê ou altera auditoria sem ser
 * Administração, nem opera com senha temporária pendente.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
  writeBatch, serverTimestamp, Timestamp, setLogLevel
} from 'firebase/firestore';
import { describe, test, beforeAll, afterAll, beforeEach } from '@jest/globals';

let env: RulesTestEnvironment;

const USUARIOS: Record<string, Record<string, unknown>> = {
  admin: { perfil: 'admin', ativo: true, statusAprovacao: 'aprovado' },
  admin2: { perfil: 'admin', ativo: true, statusAprovacao: 'aprovado' },
  proj: { perfil: 'projetista', ativo: true, statusAprovacao: 'aprovado' },
  eng: { perfil: 'engenharia', ativo: true, statusAprovacao: 'aprovado' },
  ger: { perfil: 'gerencia', ativo: true },                              // legado sem statusAprovacao
  convidado: { perfil: 'convidado', ativo: false, statusAprovacao: 'pendente' },
  legado: { perfil: 'gerencia', ativo: false, perfilSolicitado: 'engenharia' }, // pendente no formato antigo
  temp: { perfil: 'projetista', ativo: true, statusAprovacao: 'aprovado', trocaSenhaObrigatoria: true },
  bloqueado: { perfil: 'engenharia', ativo: false, statusAprovacao: 'aprovado' },
  rejeitado: { perfil: 'convidado', ativo: false, statusAprovacao: 'rejeitado' },
};

const emailDe = (uid: string) => `${uid}@retool.test`;
const db = (uid: string) => env.authenticatedContext(uid, { email: emailDe(uid) }).firestore();

function logValido(uid: string, extra: Record<string, unknown> = {}) {
  const id = `log-${uid}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    dados: {
      id,
      usuarioUid: uid,
      usuarioNome: uid,
      usuarioEmail: emailDe(uid),
      usuarioPerfil: 'engenharia',
      acao: 'login',
      categoria: 'autenticacao',
      resultado: 'sucesso',
      tipoEntidade: 'sessao',
      entidadeId: uid,
      dataHora: new Date().toISOString(),
      dataHoraServidor: serverTimestamp(),
      ...extra
    }
  };
}

function novaSolicitacao(uid: string, perfilAtual: string, perfilSolicitado: string, id = `sol-${uid}`) {
  return {
    id,
    usuarioUid: uid,
    usuarioNome: uid,
    usuarioEmail: emailDe(uid),
    perfilAtual,
    perfilSolicitado,
    status: 'pendente',
    dataSolicitacao: new Date().toISOString()
  };
}

async function criarSolicitacaoComTrava(uid: string, perfilAtual: string, perfilSolicitado: string, id = `sol-${uid}`) {
  const fs = db(uid);
  const batch = writeBatch(fs);
  batch.set(doc(fs, 'solicitacoes_cargo', id), novaSolicitacao(uid, perfilAtual, perfilSolicitado, id));
  batch.set(doc(fs, 'pendencias_cargo', uid), { solicitacaoId: id, criadoEm: new Date().toISOString() });
  return batch.commit();
}

beforeAll(async () => {
  // As negações esperadas não precisam poluir a saída do teste.
  setLogLevel('silent');
  env = await initializeTestEnvironment({
    projectId: 'demo-retool',
    firestore: { rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8') }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    for (const [uid, dados] of Object.entries(USUARIOS)) {
      await setDoc(doc(fs, 'users', uid), { uid, email: emailDe(uid), nome: uid, criadoEm: '2026-09-01T00:00:00.000Z', ...dados });
    }
    await setDoc(doc(fs, 'dispositivos', 'd1'), { id: 'd1', nome: 'Dispositivo 1' });
    await setDoc(doc(fs, 'audit_logs', 'log-1'), { id: 'log-1', usuarioUid: 'eng', acao: 'login', dataHora: '2026-09-01T00:00:00.000Z' });
  });
});

describe('Cadastro público: sempre Convidado aguardando aprovação', () => {
  const perfilNovo = (extra: Record<string, unknown> = {}) => ({
    uid: 'novo', email: emailDe('novo'), nome: 'Nova Pessoa',
    perfil: 'convidado', ativo: false, statusAprovacao: 'pendente', criadoEm: new Date().toISOString(),
    ...extra
  });

  test('autocadastro como Convidado pendente é aceito', async () => {
    await assertSucceeds(setDoc(doc(db('novo'), 'users', 'novo'), perfilNovo()));
  });

  test.each([
    ['cargo escolhido pelo visitante (admin)', { perfil: 'admin' }],
    ['cargo escolhido pelo visitante (engenharia)', { perfil: 'engenharia' }],
    ['conta já ativa', { ativo: true }],
    ['cadastro já aprovado', { statusAprovacao: 'aprovado' }],
    ['campo extra de cargo solicitado', { perfilSolicitado: 'admin' }],
    ['e-mail de outra pessoa', { email: 'outra@retool.test' }],
  ])('recusa autocadastro com %s', async (_desc, extra) => {
    await assertFails(setDoc(doc(db('novo'), 'users', 'novo'), perfilNovo(extra)));
  });

  test('ninguém cria o perfil de outra pessoa pelo autocadastro', async () => {
    await assertFails(setDoc(doc(db('novo'), 'users', 'outro'), { ...perfilNovo(), uid: 'outro' }));
  });

  test('convidado não lê dados do sistema, mas lê o próprio perfil', async () => {
    await assertFails(getDoc(doc(db('convidado'), 'dispositivos', 'd1')));
    await assertFails(getDocs(collection(db('convidado'), 'dispositivos')));
    await assertSucceeds(getDoc(doc(db('convidado'), 'users', 'convidado')));
    await assertFails(getDoc(doc(db('convidado'), 'users', 'eng')));
  });

  test('convidado localiza somente a Administração (para notificá-la)', async () => {
    await assertSucceeds(getDocs(query(collection(db('convidado'), 'users'), where('perfil', '==', 'admin'))));
    await assertFails(getDocs(collection(db('convidado'), 'users')));
    await assertFails(getDocs(query(collection(db('bloqueado'), 'users'), where('perfil', '==', 'admin'))));
  });

  test('convidado notifica a Administração sobre o novo cadastro', async () => {
    const fs = db('convidado');
    const notif = (dest: string) => ({
      id: `conta_nova_convidado_${dest}`, tipo: 'conta_nova', destinatarioUid: dest, remetenteUid: 'convidado',
      titulo: 'Novo cadastro', descricao: '...', dataHora: new Date().toISOString(), lida: false, entidadeId: 'convidado'
    });
    await assertSucceeds(setDoc(doc(fs, 'notifications', 'conta_nova_convidado_admin'), notif('admin')));
    // Somente administradores são destinatários válidos.
    await assertFails(setDoc(doc(fs, 'notifications', 'conta_nova_convidado_eng'), notif('eng')));
    // Conta operacional não finge ser um novo cadastro.
    await assertFails(setDoc(doc(db('eng'), 'notifications', 'conta_nova_eng_admin'), {
      ...notif('admin'), id: 'conta_nova_eng_admin', remetenteUid: 'eng', entidadeId: 'eng'
    }));
  });

  test('convidado não aprova nem ativa o próprio cadastro', async () => {
    const ref = doc(db('convidado'), 'users', 'convidado');
    await assertFails(updateDoc(ref, { statusAprovacao: 'aprovado', ativo: true, perfil: 'engenharia' }));
    await assertFails(updateDoc(ref, { ativo: true }));
    await assertFails(updateDoc(ref, { perfil: 'admin' }));
  });
});

describe('Aprovação de usuário pela Administração', () => {
  test('Administração aprova definindo um cargo operacional', async () => {
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'convidado'), {
      perfil: 'engenharia', ativo: true, statusAprovacao: 'aprovado', aprovadoPorUid: 'admin', aprovadoEm: new Date().toISOString()
    }));
  });

  test('cadastro pendente no formato legado também pode ser aprovado', async () => {
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'legado'), {
      perfil: 'engenharia', ativo: true, statusAprovacao: 'aprovado'
    }));
  });

  test('Administração rejeita mantendo a conta inativa', async () => {
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'convidado'), {
      ativo: false, statusAprovacao: 'rejeitado', rejeitadoPorUid: 'admin', motivoRejeicao: 'Fora do escopo'
    }));
  });

  test('aprovação sem cargo operacional ou sem ativar é recusada', async () => {
    const ref = doc(db('admin'), 'users', 'convidado');
    await assertFails(updateDoc(ref, { ativo: true, statusAprovacao: 'aprovado' })); // continua convidado
    await assertFails(updateDoc(ref, { perfil: 'engenharia', statusAprovacao: 'aprovado', ativo: false }));
  });

  test('"desbloquear" um convidado sem aprovação é recusado', async () => {
    await assertFails(updateDoc(doc(db('admin'), 'users', 'convidado'), { ativo: true }));
  });

  test('decisão só vale para cadastros pendentes', async () => {
    await assertFails(updateDoc(doc(db('admin'), 'users', 'eng'), { statusAprovacao: 'rejeitado', ativo: false }));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'rejeitado'), { statusAprovacao: 'aprovado', ativo: true, perfil: 'gerencia' }));
  });

  test.each(['proj', 'eng', 'ger', 'temp'])('%s não aprova cadastros', async (uid) => {
    await assertFails(updateDoc(doc(db(uid), 'users', 'convidado'), {
      perfil: 'engenharia', ativo: true, statusAprovacao: 'aprovado'
    }));
  });

  test('notificação da decisão só parte da Administração', async () => {
    const notif = (rem: string) => ({
      id: 'conta_decidida_convidado_convidado', tipo: 'conta_decidida', destinatarioUid: 'convidado', remetenteUid: rem,
      titulo: 'Cadastro aprovado', descricao: '...', dataHora: new Date().toISOString(), lida: false, entidadeId: 'convidado', decisao: 'aprovada'
    });
    await assertFails(setDoc(doc(db('eng'), 'notifications', 'conta_decidida_convidado_convidado'), notif('eng')));
    await assertSucceeds(setDoc(doc(db('admin'), 'notifications', 'conta_decidida_convidado_convidado'), notif('admin')));
  });
});

describe('Alteração de cargo: só por solicitação aprovada pela Administração', () => {
  test.each([
    ['perfil', { perfil: 'admin' }],
    ['status', { ativo: false }],
    ['aprovação', { statusAprovacao: 'pendente' }],
  ])('usuário não altera diretamente o próprio %s', async (_d, patch) => {
    await assertFails(updateDoc(doc(db('eng'), 'users', 'eng'), patch));
  });

  test('usuário altera o próprio nome', async () => {
    await assertSucceeds(updateDoc(doc(db('eng'), 'users', 'eng'), { nome: 'Engenheira Chefe' }));
  });

  test('solicitação com trava no mesmo lote é aceita', async () => {
    await assertSucceeds(criarSolicitacaoComTrava('eng', 'engenharia', 'projetista'));
  });

  test('segunda solicitação enquanto há uma pendente é recusada', async () => {
    await criarSolicitacaoComTrava('eng', 'engenharia', 'projetista');
    await assertFails(criarSolicitacaoComTrava('eng', 'engenharia', 'admin', 'sol-eng-2'));
  });

  test('solicitação sem trava, com cargo atual forjado ou para o mesmo cargo é recusada', async () => {
    const fs = db('eng');
    await assertFails(setDoc(doc(fs, 'solicitacoes_cargo', 'sol-eng'), novaSolicitacao('eng', 'engenharia', 'projetista')));
    await assertFails(criarSolicitacaoComTrava('eng', 'gerencia', 'projetista'));
    await assertFails(criarSolicitacaoComTrava('eng', 'engenharia', 'engenharia'));
    await assertFails(criarSolicitacaoComTrava('eng', 'engenharia', 'convidado'));
  });

  test('convidado, conta bloqueada e senha temporária não solicitam cargo', async () => {
    await assertFails(criarSolicitacaoComTrava('convidado', 'convidado', 'admin'));
    await assertFails(criarSolicitacaoComTrava('bloqueado', 'engenharia', 'admin'));
    await assertFails(criarSolicitacaoComTrava('temp', 'projetista', 'admin'));
  });

  test('solicitante lê a própria solicitação; outros usuários não', async () => {
    await criarSolicitacaoComTrava('eng', 'engenharia', 'projetista');
    await assertSucceeds(getDoc(doc(db('eng'), 'solicitacoes_cargo', 'sol-eng')));
    await assertFails(getDoc(doc(db('ger'), 'solicitacoes_cargo', 'sol-eng')));
    await assertSucceeds(getDoc(doc(db('admin'), 'solicitacoes_cargo', 'sol-eng')));
  });

  test('solicitante notifica a Administração da própria solicitação', async () => {
    await criarSolicitacaoComTrava('eng', 'engenharia', 'projetista');
    const notif = (rem: string) => ({
      id: `cargo_solicitado_sol-eng_admin`, tipo: 'cargo_solicitado', destinatarioUid: 'admin', remetenteUid: rem,
      titulo: 'Solicitação de cargo', descricao: '...', dataHora: new Date().toISOString(), lida: false, entidadeId: 'sol-eng'
    });
    await assertFails(setDoc(doc(db('ger'), 'notifications', 'cargo_solicitado_sol-eng_admin'), notif('ger')));
    await assertSucceeds(setDoc(doc(db('eng'), 'notifications', 'cargo_solicitado_sol-eng_admin'), notif('eng')));
  });

  test('solicitante não aprova a própria solicitação', async () => {
    await criarSolicitacaoComTrava('eng', 'engenharia', 'projetista');
    const fs = db('eng');
    const batch = writeBatch(fs);
    batch.update(doc(fs, 'solicitacoes_cargo', 'sol-eng'), { status: 'aprovada', decididoPorUid: 'eng', decididoPorNome: 'eng', dataDecisao: new Date().toISOString() });
    batch.update(doc(fs, 'users', 'eng'), { perfil: 'projetista' });
    batch.delete(doc(fs, 'pendencias_cargo', 'eng'));
    await assertFails(batch.commit());
  });

  test('aprovação altera o cargo no mesmo lote', async () => {
    await criarSolicitacaoComTrava('eng', 'engenharia', 'projetista');
    const fs = db('admin');
    const batch = writeBatch(fs);
    batch.update(doc(fs, 'solicitacoes_cargo', 'sol-eng'), { status: 'aprovada', decididoPorUid: 'admin', decididoPorNome: 'admin', dataDecisao: new Date().toISOString() });
    batch.update(doc(fs, 'users', 'eng'), { perfil: 'projetista', atualizadoEm: new Date().toISOString() });
    batch.delete(doc(fs, 'pendencias_cargo', 'eng'));
    await assertSucceeds(batch.commit());

    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), 'users', 'eng'));
      if (snap.data()?.perfil !== 'projetista') throw new Error('cargo não foi alterado');
    });
    // Liberada a trava, uma nova solicitação é possível.
    await assertSucceeds(criarSolicitacaoComTrava('eng', 'projetista', 'admin', 'sol-eng-2'));
  });

  test('aprovação sem aplicar o cargo solicitado é recusada', async () => {
    await criarSolicitacaoComTrava('eng', 'engenharia', 'projetista');
    const fs = db('admin');
    const batch = writeBatch(fs);
    batch.update(doc(fs, 'solicitacoes_cargo', 'sol-eng'), { status: 'aprovada', decididoPorUid: 'admin', decididoPorNome: 'admin', dataDecisao: new Date().toISOString() });
    batch.delete(doc(fs, 'pendencias_cargo', 'eng'));
    await assertFails(batch.commit());
  });

  test('rejeição mantém o cargo e libera a trava', async () => {
    await criarSolicitacaoComTrava('eng', 'engenharia', 'projetista');
    const fs = db('admin');
    const batch = writeBatch(fs);
    batch.update(doc(fs, 'solicitacoes_cargo', 'sol-eng'), { status: 'rejeitada', decididoPorUid: 'admin', decididoPorNome: 'admin', dataDecisao: new Date().toISOString(), motivoDecisao: 'Sem necessidade' });
    batch.delete(doc(fs, 'pendencias_cargo', 'eng'));
    await assertSucceeds(batch.commit());

    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), 'users', 'eng'));
      if (snap.data()?.perfil !== 'engenharia') throw new Error('cargo foi alterado na rejeição');
    });
  });

  test('projetista não decide solicitações de cargo', async () => {
    await criarSolicitacaoComTrava('eng', 'engenharia', 'gerencia');
    const fs = db('proj');
    const batch = writeBatch(fs);
    batch.update(doc(fs, 'solicitacoes_cargo', 'sol-eng'), { status: 'rejeitada', decididoPorUid: 'proj', decididoPorNome: 'proj', dataDecisao: new Date().toISOString() });
    batch.delete(doc(fs, 'pendencias_cargo', 'eng'));
    await assertFails(batch.commit());
  });
});

describe('Criação administrativa com senha temporária', () => {
  const contaNova = (extra: Record<string, unknown> = {}) => ({
    uid: 'criado', email: emailDe('criado'), nome: 'Criado', perfil: 'engenharia', ativo: true,
    statusAprovacao: 'aprovado', trocaSenhaObrigatoria: true, criadoEm: new Date().toISOString(), criadoPorUid: 'admin',
    ...extra
  });

  test('Administração cria conta com troca de senha obrigatória', async () => {
    await assertSucceeds(setDoc(doc(db('admin'), 'users', 'criado'), contaNova()));
  });

  test('conta criada sem exigir troca de senha é recusada', async () => {
    await assertFails(setDoc(doc(db('admin'), 'users', 'criado'), contaNova({ trocaSenhaObrigatoria: false })));
  });

  test('senha nunca é gravada no perfil', async () => {
    await assertFails(setDoc(doc(db('admin'), 'users', 'criado'), contaNova({ senhaTemporaria: 'Abc12345!' })));
  });

  test.each(['proj', 'eng', 'ger', 'convidado'])('%s não cria contas de terceiros', async (uid) => {
    await assertFails(setDoc(doc(db(uid), 'users', 'criado'), contaNova({ criadoPorUid: uid })));
  });

  test('senha temporária bloqueia o acesso aos dados até a troca', async () => {
    await assertFails(getDoc(doc(db('temp'), 'dispositivos', 'd1')));
    await assertFails(setDoc(doc(db('temp'), 'dispositivos', 'd2'), { id: 'd2', nome: 'x' }));
  });

  test('troca de senha concluída libera o acesso', async () => {
    await assertSucceeds(updateDoc(doc(db('temp'), 'users', 'temp'), {
      trocaSenhaObrigatoria: false, senhaAlteradaEm: new Date().toISOString()
    }));
    await assertSucceeds(getDoc(doc(db('temp'), 'dispositivos', 'd1')));
  });

  test('conclusão da troca não permite alterar cargo junto', async () => {
    await assertFails(updateDoc(doc(db('temp'), 'users', 'temp'), { trocaSenhaObrigatoria: false, perfil: 'admin' }));
  });

  test('usuário comum não liga nem desliga a exigência por conta própria', async () => {
    await assertFails(updateDoc(doc(db('eng'), 'users', 'eng'), { trocaSenhaObrigatoria: false }));
    await assertFails(updateDoc(doc(db('eng'), 'users', 'eng'), { trocaSenhaObrigatoria: true }));
  });
});

describe('Histórico de ações (auditoria)', () => {
  test('somente a Administração consulta os logs', async () => {
    await assertSucceeds(getDocs(collection(db('admin'), 'audit_logs')));
    for (const uid of ['proj', 'eng', 'ger', 'convidado', 'temp', 'bloqueado']) {
      await assertFails(getDocs(collection(db(uid), 'audit_logs')));
      await assertFails(getDoc(doc(db(uid), 'audit_logs', 'log-1')));
    }
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'audit_logs')));
  });

  test('qualquer usuário autenticado registra as próprias ações', async () => {
    for (const uid of ['eng', 'convidado', 'admin']) {
      const { id, dados } = logValido(uid);
      await assertSucceeds(setDoc(doc(db(uid), 'audit_logs', id), dados));
    }
  });

  test('não é possível registrar em nome de outro usuário', async () => {
    const { id, dados } = logValido('eng', { usuarioUid: 'admin' });
    await assertFails(setDoc(doc(db('eng'), 'audit_logs', id), dados));
  });

  test('não é possível antedatar o registro', async () => {
    const { id, dados } = logValido('eng', { dataHoraServidor: Timestamp.fromDate(new Date('2020-01-01')) });
    await assertFails(setDoc(doc(db('eng'), 'audit_logs', id), dados));
  });

  test('campos de senha são recusados na auditoria', async () => {
    const { id, dados } = logValido('eng', { senha: '123456' });
    await assertFails(setDoc(doc(db('eng'), 'audit_logs', id), dados));
  });

  test('logs são imutáveis e indeléveis, inclusive para a Administração', async () => {
    for (const uid of ['admin', 'eng']) {
      await assertFails(updateDoc(doc(db(uid), 'audit_logs', 'log-1'), { acao: 'logout' }));
      await assertFails(deleteDoc(doc(db(uid), 'audit_logs', 'log-1')));
    }
  });
});

describe('Operações administrativas exigem Administração', () => {
  test('somente a Administração altera cargo ou bloqueia terceiros', async () => {
    await assertFails(updateDoc(doc(db('proj'), 'users', 'eng'), { perfil: 'admin' }));
    await assertFails(updateDoc(doc(db('proj'), 'users', 'eng'), { ativo: false }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'eng'), { perfil: 'projetista' }));
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'eng'), { ativo: false }));
  });

  test('Administração não altera o próprio cargo nem se bloqueia', async () => {
    await assertFails(updateDoc(doc(db('admin'), 'users', 'admin'), { perfil: 'gerencia' }));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'admin'), { ativo: false }));
  });

  test('exclusão de usuários: só Administração e nunca a própria conta', async () => {
    await assertFails(deleteDoc(doc(db('proj'), 'users', 'eng')));
    await assertFails(deleteDoc(doc(db('admin'), 'users', 'admin')));
    await assertSucceeds(deleteDoc(doc(db('admin'), 'users', 'eng')));
  });

  test('conta bloqueada ou rejeitada não acessa dados', async () => {
    await assertFails(getDoc(doc(db('bloqueado'), 'dispositivos', 'd1')));
    await assertFails(getDoc(doc(db('rejeitado'), 'dispositivos', 'd1')));
    await assertSucceeds(getDoc(doc(db('ger'), 'dispositivos', 'd1')));
  });

  test('gerência e engenharia não escrevem nas coleções industriais', async () => {
    await assertFails(setDoc(doc(db('ger'), 'dispositivos', 'd9'), { id: 'd9' }));
    await assertFails(setDoc(doc(db('eng'), 'dispositivos', 'd9'), { id: 'd9' }));
    await assertSucceeds(setDoc(doc(db('proj'), 'dispositivos', 'd9'), { id: 'd9' }));
    await assertFails(deleteDoc(doc(db('proj'), 'dispositivos', 'd1')));
  });
});
