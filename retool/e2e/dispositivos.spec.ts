// Dispositivos: cadastro manual, busca e importação de planilha.
import { test, expect } from '@playwright/test';
import { entrarComoAdmin } from './apoio';

test('cadastra um dispositivo e o encontra na busca', async ({ page }) => {
  await entrarComoAdmin(page);
  const codigo = `E2E${Date.now()}`;

  await page.getByRole('button', { name: /Cadastrar novo dispositivo/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Novo dispositivo' });
  await dialogo.getByLabel('Nº dispositivo *').fill('Dispositivo E2E');
  await dialogo.getByLabel('CÓDIGO PEÇA *').fill(codigo);
  await dialogo.getByRole('button', { name: 'Salvar registro do dispositivo' }).click();
  await expect(dialogo).toBeHidden();

  await page.getByLabel('Filtro de busca por nome ou código').fill(codigo);
  await expect(page.getByRole('main')).toContainText(codigo);
});

test('importa planilha mantendo combinações Código + Dispositivo distintas', async ({ page }) => {
  await entrarComoAdmin(page);
  const codigo = `IMP${Date.now()}`;
  // Mesmo código com dois dispositivos diferentes: os dois precisam existir.
  const csv = `Código,Dispositivo,Peso\n${codigo},Dispositivo A,1000\n${codigo},Dispositivo B,2000\n`;

  await page.getByRole('button', { name: 'Importar planilha de dispositivos' }).click();
  await page.getByLabel('Buscar arquivo da planilha (.csv ou .xlsx)').setInputFiles({
    name: 'importacao-e2e.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8'),
  });
  await page.getByRole('button', { name: 'Processar Planilha' }).click();
  await page.getByRole('button', { name: /Salvar Importação \(2\)/ }).click();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();

  await page.getByLabel('Filtro de busca por nome ou código').fill(codigo);
  await expect(page.getByRole('main')).toContainText('Dispositivo A');
  await expect(page.getByRole('main')).toContainText('Dispositivo B');
});
