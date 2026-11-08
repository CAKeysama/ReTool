// Reutilizações: a Engenharia de Processo vê o Hard Saving (só não o informa ao solicitar).
import { test, expect } from '@playwright/test';
import { entrar, ENGENHARIA, SENHA_DEMO } from './apoio';

test('Engenharia vê a coluna Hard Saving no Histórico geral', async ({ page }) => {
  await entrar(page, ENGENHARIA, SENHA_DEMO);
  await expect(page.getByRole('heading', { name: 'Dispositivos', level: 2, exact: true })).toBeVisible();
  await page.goto('/reutilizacoes');
  await page.getByRole('tab', { name: /Histórico geral/ }).click();
  await expect(page.locator('thead th', { hasText: 'Hard Saving' })).toBeVisible();
});
