import { expect, type Browser, type Page } from '@playwright/test';

// Credenciais do semeador (scripts/semearEmulador.mjs): só existem no emulador.
export const SENHA_DEMO = 'Demo!Retool2026';
export const ADMIN = 'admin@retool.test';
export const ENGENHARIA = 'engenharia@retool.test';

let sequencia = 0;
/** E-mail único por execução: os testes não dependem do estado deixado por outros. */
export function emailUnico(prefixo: string) {
  sequencia += 1;
  return `${prefixo}-${Date.now()}-${sequencia}@retool.test`;
}

export async function entrar(page: Page, email: string, senha: string) {
  await page.goto('/login');
  await page.getByPlaceholder('usuario@empresa.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

export async function entrarComoAdmin(page: Page) {
  await entrar(page, ADMIN, SENHA_DEMO);
  await expect(page.getByRole('heading', { name: 'Dispositivos', level: 2, exact: true })).toBeVisible();
}

/** Abre uma sessão separada (outro navegador), como um segundo usuário. */
export async function novaSessao(browser: Browser) {
  const contexto = await browser.newContext();
  return contexto.newPage();
}

/** Admin cria uma conta e devolve a senha temporária exibida uma única vez. */
export async function criarContaComSenhaTemporaria(admin: Page, nome: string, email: string) {
  await admin.goto('/administracao');
  await admin.getByRole('button', { name: 'Nova conta' }).click();
  await admin.getByLabel('Nome completo').fill(nome);
  await admin.getByLabel('E-mail institucional').fill(email);
  await admin.getByLabel('Cargo', { exact: true }).selectOption({ label: 'Engenharia de Processo / Industrial' });
  await admin.getByRole('button', { name: 'Criar conta e gerar senha' }).click();
  const campo = admin.locator('code[aria-label="Senha temporária"]');
  await expect(campo).toBeVisible();
  const senha = ((await campo.textContent()) || '').trim();
  expect(senha.length).toBeGreaterThanOrEqual(12);
  return senha;
}

/** Primeiro acesso de conta criada pela Administração: troca a senha temporária. */
export async function trocarSenhaTemporaria(page: Page, temporaria: string, nova: string) {
  await expect(page.getByRole('heading', { name: 'Defina sua nova senha' })).toBeVisible();
  await page.getByLabel('Senha temporária').fill(temporaria);
  await page.getByLabel('Nova senha', { exact: true }).fill(nova);
  await page.getByLabel('Confirmar nova senha').fill(nova);
  await page.getByRole('button', { name: 'Salvar nova senha e continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Dispositivos', level: 2, exact: true })).toBeVisible();
}
