// Dispositivos: cadastro manual, busca e importação de planilha.
import { test, expect } from '@playwright/test';
import { entrarComoAdmin } from './apoio';

test('cadastra um dispositivo e o encontra na busca', async ({ page }) => {
  await entrarComoAdmin(page);
  const codigo = `E2E${Date.now()}`;

  await page.getByRole('button', { name: /Cadastrar novo dispositivo/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Novo dispositivo' });
  await dialogo.getByLabel('Nº dispositivo *').fill('Dispositivo E2E');
  await dialogo.getByLabel('Código da peça *').fill(codigo);
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
  await page.getByRole('button', { name: 'Processar planilha' }).click();
  await page.getByRole('button', { name: /Salvar importação \(2\)/ }).click();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();

  await page.getByLabel('Filtro de busca por nome ou código').fill(codigo);
  await expect(page.getByRole('main')).toContainText('Dispositivo A');
  await expect(page.getByRole('main')).toContainText('Dispositivo B');
});

test('filtra por Código e por Descrição da peça, combinando os dois', async ({ page }) => {
  await entrarComoAdmin(page);
  const marca = Date.now();
  const codigo = `FIL${marca}`;
  const csv = `Código,Dispositivo,Descrição\n${codigo},Disp Filtro A,Alfa${marca} chapa\n${codigo},Disp Filtro B,Beta${marca} chapa\n`;

  await page.getByRole('button', { name: 'Importar planilha de dispositivos' }).click();
  await page.getByLabel('Buscar arquivo da planilha (.csv ou .xlsx)').setInputFiles({
    name: 'filtros-e2e.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8'),
  });
  await page.getByRole('button', { name: 'Processar planilha' }).click();
  await page.getByRole('button', { name: /Salvar importação \(2\)/ }).click();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();

  const main = page.getByRole('main');
  await page.getByRole('button', { name: /Filtros/ }).click();
  await page.getByLabel('Código da peça').fill(codigo);
  await expect(main).toContainText('Disp Filtro A');
  await expect(main).toContainText('Disp Filtro B');

  await page.getByLabel('Descrição da peça').fill(`ALFA${marca}`);
  await expect(main).toContainText('Disp Filtro A');
  await expect(main).not.toContainText('Disp Filtro B');
  // Os filtros ficam na URL (voltar dos detalhes restaura a lista).
  await expect(page).toHaveURL(new RegExp(`cod=${codigo}`));
});
