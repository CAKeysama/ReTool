/// <reference types="node" />
/**
 * Testes das regras do Storage (anexos e imagens de dispositivos) contra os
 * emuladores do Storage e do Firestore (as regras leem o perfil em users/):
 *
 *   npm run test:rules
 *
 * Garantem que quem pode cadastrar envia imagens e PDFs, que contas
 * operacionais leem, que só a Administração exclui e que ninguém fora disso
 * acessa os arquivos.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, setDoc, setLogLevel } from 'firebase/firestore';
import { ref, uploadBytes, getMetadata, deleteObject } from 'firebase/storage';
import { describe, test, beforeAll, afterAll, beforeEach } from '@jest/globals';

let env: RulesTestEnvironment;

const USUARIOS: Record<string, Record<string, unknown>> = {
  admin: { perfil: 'admin', ativo: true, statusAprovacao: 'aprovado' },
  proj: { perfil: 'projetista', ativo: true, statusAprovacao: 'aprovado' },
  eng: { perfil: 'engenharia', ativo: true, statusAprovacao: 'aprovado' },
  ger: { perfil: 'gerencia', ativo: true },                              // legado sem statusAprovacao
  convidado: { perfil: 'convidado', ativo: false, statusAprovacao: 'pendente' },
  temp: { perfil: 'projetista', ativo: true, statusAprovacao: 'aprovado', trocaSenhaObrigatoria: true },
  bloqueado: { perfil: 'projetista', ativo: false, statusAprovacao: 'aprovado' },
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXISTENTE = 'retool/dispositivos/d1/imagem_peca/existente.png';

const storageDe = (uid: string) => env.authenticatedContext(uid).storage();
const enviar = (uid: string, caminho: string, contentType = 'image/png') =>
  uploadBytes(ref(storageDe(uid), caminho), PNG, { contentType });

beforeAll(async () => {
  setLogLevel('silent');
  env = await initializeTestEnvironment({
    projectId: 'demo-retool',
    firestore: { rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(__dirname, '../../../storage.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, dados] of Object.entries(USUARIOS)) {
      await setDoc(doc(ctx.firestore(), 'users', uid), { uid, email: `${uid}@retool.test`, nome: uid, ...dados });
    }
    await uploadBytes(ref(ctx.storage(), EXISTENTE), PNG, { contentType: 'image/png' });
  });
});

describe('Upload de imagens e PDFs de dispositivos', () => {
  test.each(['admin', 'proj'])('%s envia imagem e PDF', async (uid) => {
    await assertSucceeds(enviar(uid, 'retool/dispositivos/d1/imagem_peca/nova.png'));
    await assertSucceeds(enviar(uid, 'retool/dispositivos/d1/imagem_dispositivo/nova.webp', 'image/webp'));
    await assertSucceeds(enviar(uid, 'retool/dispositivos/d1/documento_pdf/manual.pdf', 'application/pdf'));
  });

  test.each(['eng', 'ger', 'convidado', 'temp', 'bloqueado'])('%s não envia arquivos', async (uid) => {
    await assertFails(enviar(uid, 'retool/dispositivos/d1/imagem_peca/nova.png'));
  });

  test('sem login não envia', async () => {
    await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(), 'retool/dispositivos/d1/imagem_peca/x.png'), PNG, { contentType: 'image/png' }));
  });

  test('tipo de arquivo fora de imagem/PDF é recusado', async () => {
    await assertFails(enviar('admin', 'retool/dispositivos/d1/imagem_peca/script.html', 'text/html'));
  });

  test('fora da pasta de dispositivos nada é aceito', async () => {
    await assertFails(enviar('admin', 'outra-pasta/x.png'));
  });
});

describe('Leitura', () => {
  test.each(['admin', 'proj', 'eng', 'ger'])('%s (conta operacional) lê', async (uid) => {
    await assertSucceeds(getMetadata(ref(storageDe(uid), EXISTENTE)));
  });

  test.each(['convidado', 'temp', 'bloqueado'])('%s não lê', async (uid) => {
    await assertFails(getMetadata(ref(storageDe(uid), EXISTENTE)));
  });

  test('sem login não lê', async () => {
    await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(), EXISTENTE)));
  });
});

describe('Exclusão', () => {
  test('Administração exclui', async () => {
    await assertSucceeds(deleteObject(ref(storageDe('admin'), EXISTENTE)));
  });

  test.each(['proj', 'eng', 'ger'])('%s não exclui', async (uid) => {
    await assertFails(deleteObject(ref(storageDe(uid), EXISTENTE)));
  });
});
