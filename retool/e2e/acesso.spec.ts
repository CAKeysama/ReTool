// Acesso: login, autocadastro com aprovação, senha temporária, bloqueio,
// restrição por cargo, "Esqueci minha senha" e histórico de ações.
import { test, expect } from '@playwright/test';
import {
  ENGENHARIA, SENHA_DEMO, emailUnico, entrar, entrarComoAdmin, novaSessao,
  criarContaComSenhaTemporaria, trocarSenhaTemporaria,
} from './apoio';

test('admin entra e chega à lista de dispositivos', async ({ page }) => {
  await entrarComoAdmin(page);
  await expect(page).toHaveURL(/\/dispositivos$/);
});

test('senha errada mostra erro e não entra', async ({ page }) => {
  await entrar(page, ENGENHARIA, 'senha-errada-123');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('autocadastro aguarda aprovação e é liberado em tempo real com o cargo escolhido', async ({ page, browser }) => {
  const email = emailUnico('convidado');
  const nome = `Convidado ${Date.now()}`;

  await page.goto('/login');
  await page.getByRole('button', { name: 'Cadastre-se aqui' }).click();
  await page.getByPlaceholder('Seu nome completo').fill(nome);
  await page.getByPlaceholder('usuario@empresa.com').fill(email);
  await page.getByPlaceholder('••••••••').fill('Convidado123');
  await page.getByPlaceholder('Repita a senha').fill('Convidado123');
  await page.getByRole('button', { name: 'Cadastrar e Aguardar Aprovação' }).click();
  await expect(page.getByRole('heading', { name: 'Cadastro em análise' })).toBeVisible();

  const admin = await novaSessao(browser);
  await entrarComoAdmin(admin);
  await admin.goto('/administracao');
  await admin.getByRole('tab', { name: /Cadastros pendentes/ }).click();
  await admin.getByLabel(`Cargo de ${nome}`).selectOption({ label: 'Engenharia de Processo / Industrial' });
  await admin.getByRole('button', { name: 'Aprovar' }).click();

  // A tela do convidado libera o sistema sem recarregar.
  await expect(page.getByRole('heading', { name: 'Dispositivos', level: 2 })).toBeVisible();
  await admin.context().close();
});

test('conta criada pela Administração exige trocar a senha temporária no 1º acesso', async ({ page, browser }) => {
  const admin = await novaSessao(browser);
  await entrarComoAdmin(admin);
  const email = emailUnico('provisionada');
  const temporaria = await criarContaComSenhaTemporaria(admin, `Provisionada ${Date.now()}`, email);
  await admin.context().close();

  await entrar(page, email, temporaria);
  await trocarSenhaTemporaria(page, temporaria, 'NovaSenha2026');

  // A nova senha passa a valer num login seguinte.
  const outra = await novaSessao(browser);
  await entrar(outra, email, 'NovaSenha2026');
  await expect(outra.getByRole('heading', { name: 'Dispositivos', level: 2 })).toBeVisible();
  await outra.context().close();
});

test('bloquear um usuário derruba a sessão aberta dele', async ({ page, browser }) => {
  const admin = await novaSessao(browser);
  await entrarComoAdmin(admin);
  const nome = `Bloqueavel ${Date.now()}`;
  const email = emailUnico('bloqueavel');
  const temporaria = await criarContaComSenhaTemporaria(admin, nome, email);

  await entrar(page, email, temporaria);
  await trocarSenhaTemporaria(page, temporaria, 'Bloqueio2026');

  await admin.goto('/administracao');
  await admin.getByLabel('Buscar usuário').fill(email);
  await admin.getByRole('row', { name: new RegExp(nome) }).getByRole('button', { name: 'Bloquear acesso' }).click();
  await expect(admin.getByRole('row', { name: new RegExp(nome) }).getByRole('button', { name: 'Desbloquear' })).toBeVisible();

  await expect(page).toHaveURL(/\/login$/);
  await admin.context().close();
});

test('Engenharia não acessa a Administração', async ({ page }) => {
  await entrar(page, ENGENHARIA, SENHA_DEMO);
  await expect(page.getByRole('heading', { name: 'Dispositivos', level: 2 })).toBeVisible();
  await expect(page.getByRole('link', { name: /Administração/ })).toHaveCount(0);
  await page.goto('/administracao');
  await expect(page).toHaveURL(/\/dispositivos$/);
});

test('"Esqueci minha senha" confirma o envio sem revelar se a conta existe', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('usuario@empresa.com').fill('ninguem@retool.test');
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await expect(page.getByRole('status')).toContainText('Se houver uma conta com ninguem@retool.test');
});

test('o histórico de ações lista os registros de auditoria', async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto('/administracao');
  await page.getByRole('tab', { name: 'Histórico de ações' }).click();
  // O login da própria admin acabou de ser auditado.
  await expect(page.getByRole('row').filter({ hasText: 'admin@retool.test' }).filter({ hasText: 'Entrou no sistema' }).first()).toBeVisible();
});
