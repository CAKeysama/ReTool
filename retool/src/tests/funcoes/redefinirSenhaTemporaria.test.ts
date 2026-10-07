/// <reference types="node" />
/**
 * Cloud Function `redefinirSenhaTemporaria` executada de verdade nos
 * emuladores de Auth, Firestore e Functions:
 *
 *   npm run test:funcoes
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut, Auth } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable, Functions } from 'firebase/functions';

const PROJETO = 'demo-retool';
const AUTH_REST = 'http://127.0.0.1:9099';
const FIRESTORE_REST = `http://127.0.0.1:8181/v1/projects/${PROJETO}/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner' };
const SENHA_INICIAL = 'Inicial!2026x';

let app: FirebaseApp;
let auth: Auth;
let functions: Functions;
const uids: Record<string, string> = {};

type Valor = string | boolean;

function paraCampos(obj: Record<string, Valor>) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [
    k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: v }
  ]));
}

function deCampos(fields: Record<string, Record<string, unknown>> = {}) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Object.values(v)[0]]));
}

async function criarConta(nome: string, perfil: Record<string, Valor>): Promise<string> {
  const email = `${nome}@retool.test`;
  const r = await fetch(`${AUTH_REST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA_INICIAL, returnSecureToken: true })
  });
  const { localId } = await r.json() as { localId: string };
  await fetch(`${FIRESTORE_REST}/users/${localId}`, {
    method: 'PATCH',
    headers: { ...OWNER, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: paraCampos({ uid: localId, email, nome, criadoEm: '2026-09-01T00:00:00.000Z', ...perfil }) })
  });
  return localId;
}

async function lerUsuario(uid: string) {
  const r = await fetch(`${FIRESTORE_REST}/users/${uid}`, { headers: OWNER });
  return deCampos(((await r.json()) as { fields?: Record<string, Record<string, unknown>> }).fields);
}

async function listarColecao(colecao: string) {
  const r = await fetch(`${FIRESTORE_REST}/${colecao}?pageSize=300`, { headers: OWNER });
  const { documents = [] } = await r.json() as { documents?: { fields: Record<string, Record<string, unknown>> }[] };
  return documents.map(d => deCampos(d.fields));
}

async function bancoInteiroEmTexto() {
  const colecoes = await Promise.all(['users', 'audit_logs', 'notifications'].map(listarColecao));
  return JSON.stringify(colecoes);
}

async function entrarComo(nome: string, senha = SENHA_INICIAL) {
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${nome}@retool.test`, senha);
}

const redefinir = (uid?: unknown) =>
  httpsCallable<unknown, { senhaTemporaria: string }>(functions, 'redefinirSenhaTemporaria')(uid === undefined ? {} : { uid });

async function codigoDoErro(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa;
  } catch (e) {
    return (e as { code?: string }).code || 'sem-codigo';
  }
  throw new Error('A chamada deveria ter falhado.');
}

beforeAll(() => {
  app = initializeApp({ apiKey: 'demo-api-key', projectId: PROJETO, authDomain: `${PROJETO}.firebaseapp.com` }, 'teste-funcoes');
  auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_REST, { disableWarnings: true });
  functions = getFunctions(app, 'southamerica-east1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
});

afterAll(async () => {
  await signOut(auth).catch(() => undefined);
  await deleteApp(app);
});

beforeEach(async () => {
  await signOut(auth);
  await fetch(`${AUTH_REST}/emulator/v1/projects/${PROJETO}/accounts`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:8181/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, { method: 'DELETE' });

  const aprovado = { ativo: true, statusAprovacao: 'aprovado' };
  uids.admin = await criarConta('admin', { perfil: 'admin', ...aprovado });
  uids.admintemp = await criarConta('admintemp', { perfil: 'admin', ...aprovado, trocaSenhaObrigatoria: true });
  uids.eng = await criarConta('eng', { perfil: 'engenharia', ...aprovado });
  uids.bloqueado = await criarConta('bloqueado', { perfil: 'gerencia', ativo: false, statusAprovacao: 'aprovado' });
  uids.convidado = await criarConta('convidado', { perfil: 'convidado', ativo: false, statusAprovacao: 'pendente' });
});

describe('redefinirSenhaTemporaria (Cloud Function)', () => {
  test('Administração gera nova senha temporária: senha antiga deixa de valer e a troca passa a ser obrigatória', async () => {
    await entrarComo('admin');
    const { data } = await redefinir(uids.eng);
    const senha = data.senhaTemporaria;

    expect(senha).toHaveLength(14);
    expect(senha).toMatch(/[A-Z]/);
    expect(senha).toMatch(/[a-z]/);
    expect(senha).toMatch(/[2-9]/);

    expect(await lerUsuario(uids.eng)).toMatchObject({ trocaSenhaObrigatoria: true, senhaRedefinidaPorUid: uids.admin });

    // A senha antiga não entra mais; a temporária sim.
    expect(await codigoDoErro(entrarComo('eng', SENHA_INICIAL))).toMatch(/auth\/(wrong-password|invalid-credential)/);
    await expect(entrarComo('eng', senha)).resolves.toBeUndefined();

    const logs = await listarColecao('audit_logs');
    expect(logs).toEqual([expect.objectContaining({
      acao: 'redefinicao_senha', categoria: 'usuarios', resultado: 'sucesso',
      usuarioUid: uids.admin, entidadeId: uids.eng, tipoEntidade: 'usuario'
    })]);
    // A senha não fica gravada em lugar nenhum do banco.
    expect(await bancoInteiroEmTexto()).not.toContain(senha);
  });

  test('conta bloqueada também pode receber nova senha (para quando for desbloqueada)', async () => {
    await entrarComo('admin');
    await expect(redefinir(uids.bloqueado)).resolves.toBeTruthy();
    expect(await lerUsuario(uids.bloqueado)).toMatchObject({ trocaSenhaObrigatoria: true, ativo: false });
  });

  test('usuário comum não redefine senhas (tentativa auditada como negada)', async () => {
    await entrarComo('eng');
    expect(await codigoDoErro(redefinir(uids.bloqueado))).toBe('functions/permission-denied');
    expect(await lerUsuario(uids.bloqueado)).not.toHaveProperty('trocaSenhaObrigatoria');
    expect(await listarColecao('audit_logs')).toEqual([
      expect.objectContaining({ acao: 'redefinicao_senha', resultado: 'negado', usuarioUid: uids.eng })
    ]);
  });

  test('Administração com senha temporária pendente não opera', async () => {
    await entrarComo('admintemp');
    expect(await codigoDoErro(redefinir(uids.eng))).toBe('functions/permission-denied');
  });

  test('convidado pendente não opera nem pode ter a senha redefinida', async () => {
    await entrarComo('convidado');
    expect(await codigoDoErro(redefinir(uids.eng))).toBe('functions/permission-denied');

    await entrarComo('admin');
    expect(await codigoDoErro(redefinir(uids.convidado))).toBe('functions/failed-precondition');
    expect(await lerUsuario(uids.convidado)).not.toHaveProperty('trocaSenhaObrigatoria');
  });

  test('a Administração não redefine a própria senha por aqui', async () => {
    await entrarComo('admin');
    expect(await codigoDoErro(redefinir(uids.admin))).toBe('functions/failed-precondition');
  });

  test('pedidos inválidos e sem sessão são recusados', async () => {
    expect(await codigoDoErro(redefinir(uids.eng))).toBe('functions/unauthenticated');

    await entrarComo('admin');
    expect(await codigoDoErro(redefinir())).toBe('functions/invalid-argument');
    expect(await codigoDoErro(redefinir('uid-inexistente'))).toBe('functions/not-found');
  });
});
