// Propagação de imagens por Número da Peça, de ponta a ponta: upload real
// no emulador do Storage, propagação, herança, troca de imagem e exclusão.
import { test, expect, type Locator, type Page } from '@playwright/test';
import { entrarComoAdmin } from './apoio';

// PNG 1×1 válido (o conteúdo não importa: cada upload ganha um caminho próprio).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function enviarImagemPeca(dialogo: Locator, nomeArquivo: string) {
  // O primeiro seletor de arquivo do formulário é o da IMAGEM PEÇA.
  await dialogo.locator('input[type="file"]').first().setInputFiles({ name: nomeArquivo, mimeType: 'image/png', buffer: PNG });
  await expect(dialogo.getByRole('img', { name: 'IMAGEM PEÇA' })).toBeVisible();
}

async function cadastrar(page: Page, nome: string, codigo: string, imagem?: string) {
  await page.goto('/dispositivos');
  await page.getByRole('button', { name: /Cadastrar novo dispositivo/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Novo dispositivo' });
  await dialogo.getByLabel('Nº dispositivo *').fill(nome);
  await dialogo.getByLabel('CÓDIGO PEÇA *').fill(codigo);
  if (imagem) await enviarImagemPeca(dialogo, imagem);
  await dialogo.getByRole('button', { name: 'Salvar registro do dispositivo' }).click();
  await expect(dialogo).toBeHidden();
}

async function abrirDetalhes(page: Page, nome: string, codigo: string) {
  await page.goto('/dispositivos');
  await page.getByLabel('Filtro de busca por nome ou código').fill(codigo);
  await page.getByRole('option', { name: new RegExp(nome) }).click();
  await expect(page.getByRole('heading', { name: nome })).toBeVisible();
}

/** Link da imagem da peça exibida nos detalhes (null = sem imagem). */
async function imagemPeca(page: Page, nome: string, codigo: string): Promise<string | null> {
  await abrirDetalhes(page, nome, codigo);
  const img = page.getByRole('img', { name: 'Imagem da peça' });
  return (await img.count()) ? img.getAttribute('src') : null;
}

test('imagem da peça se propaga pela linha, acompanha a troca e sobrevive à exclusão da origem', async ({ page }) => {
  test.setTimeout(120_000);
  await entrarComoAdmin(page);
  const codigo = `IMG-${Date.now()}`;
  const [irmao, origem, novo] = ['Irmão', 'Origem', 'Novo'].map(n => `${n} ${codigo}`);

  // 1. Dispositivo da linha ainda sem imagem.
  await cadastrar(page, irmao, codigo);

  // 2. Outro dispositivo da mesma linha (código com outra grafia) recebe uma foto: ela chega ao irmão.
  await cadastrar(page, origem, ` ${codigo.toLowerCase()} `, 'primeira.png');
  await expect(page.getByText(/Imagem copiada para 1 outro\(s\) dispositivo/)).toBeVisible();
  const primeira = await imagemPeca(page, origem, codigo);
  expect(primeira).toContain('primeira.png');
  expect(await imagemPeca(page, irmao, codigo)).toBe(primeira);

  // 3. Um dispositivo novo na linha herda a imagem.
  await cadastrar(page, novo, codigo);
  await expect(page.getByText(/O dispositivo recebeu a imagem já usada na linha/)).toBeVisible();
  expect(await imagemPeca(page, novo, codigo)).toBe(primeira);

  // 4. A origem troca a foto: quem seguia a anterior acompanha.
  await abrirDetalhes(page, origem, codigo);
  await page.getByRole('button', { name: /Editar/ }).first().click();
  const edicao = page.getByRole('dialog', { name: 'Editar dispositivo' });
  await edicao.getByRole('button', { name: 'Remover' }).first().click();
  await enviarImagemPeca(edicao, 'segunda.png');
  await edicao.getByRole('button', { name: 'Salvar registro do dispositivo' }).click();
  await expect(edicao).toBeHidden();
  await expect(page.getByText(/Imagem copiada para 2 outro\(s\) dispositivo/)).toBeVisible();
  const segunda = await imagemPeca(page, origem, codigo);
  expect(segunda).toContain('segunda.png');
  expect(await imagemPeca(page, irmao, codigo)).toBe(segunda);
  expect(await imagemPeca(page, novo, codigo)).toBe(segunda);

  // 5. Excluir a origem não quebra a imagem dos outros; a foto que ninguém usa mais sai do Storage.
  await page.goto('/dispositivos');
  await page.getByLabel('Filtro de busca por nome ou código').fill(codigo);
  const item = page.getByRole('option', { name: new RegExp(origem) });
  await item.focus();
  await item.press('d');
  await page.getByRole('dialog', { name: 'Confirmar exclusão' }).getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirmar exclusão' })).toBeHidden();
  await expect(page.getByRole('option', { name: new RegExp(origem) })).toHaveCount(0);

  expect((await page.request.get(segunda!)).status()).toBe(200);
  await expect.poll(async () => (await page.request.get(primeira!)).status()).not.toBe(200);
  expect(await imagemPeca(page, irmao, codigo)).toBe(segunda);
});
