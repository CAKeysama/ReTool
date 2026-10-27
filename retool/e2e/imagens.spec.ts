// Propagação da imagem do dispositivo por Nº dispositivo, de ponta a ponta:
// upload real no emulador do Storage, propagação, herança, troca de imagem e
// exclusão. A imagem da peça não se propaga (é alimentada um a um).
import { test, expect, type Locator, type Page } from '@playwright/test';
import { entrarComoAdmin } from './apoio';

// PNG 1×1 válido (o conteúdo não importa: cada upload ganha um caminho próprio).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const arquivo = (nome: string) => ({ name: nome, mimeType: 'image/png', buffer: PNG });

async function enviarImagemPeca(dialogo: Locator, nomeArquivo: string) {
  // O primeiro seletor de arquivo do formulário é o da IMAGEM PEÇA.
  await dialogo.locator('input[type="file"]').nth(0).setInputFiles(arquivo(nomeArquivo));
  await expect(dialogo.getByRole('img', { name: 'IMAGEM PEÇA' })).toBeVisible();
}

async function enviarImagemDispositivo(dialogo: Locator, nomeArquivo: string) {
  // O segundo seletor de arquivo do formulário é o da Imagem dispositivo.
  await dialogo.locator('input[type="file"]').nth(1).setInputFiles(arquivo(nomeArquivo));
  await expect(dialogo.getByRole('img', { name: 'Imagem dispositivo' })).toBeVisible();
}

async function cadastrar(page: Page, numero: string, codigo: string, imagens: { peca?: string; dispositivo?: string } = {}) {
  await page.goto('/dispositivos');
  await page.getByRole('button', { name: /Cadastrar novo dispositivo/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Novo dispositivo' });
  await dialogo.getByLabel('Nº dispositivo *').fill(numero);
  await dialogo.getByLabel('CÓDIGO PEÇA *').fill(codigo);
  if (imagens.peca) await enviarImagemPeca(dialogo, imagens.peca);
  if (imagens.dispositivo) await enviarImagemDispositivo(dialogo, imagens.dispositivo);
  await dialogo.getByRole('button', { name: 'Salvar registro do dispositivo' }).click();
  await expect(dialogo).toBeHidden();
}

/** Abre os detalhes pelo código (único por dispositivo; o Nº é compartilhado pela linha). */
async function abrirDetalhes(page: Page, codigo: string) {
  await page.goto('/dispositivos');
  await page.getByLabel('Filtro de busca por nome ou código').fill(codigo);
  await page.getByRole('option', { name: new RegExp(codigo) }).click();
  await expect(page.getByText(codigo).first()).toBeVisible();
}

/** Links das imagens exibidas nos detalhes (null = sem imagem). */
async function imagens(page: Page, codigo: string): Promise<{ peca: string | null; dispositivo: string | null }> {
  await abrirDetalhes(page, codigo);
  const src = async (alt: string) => {
    const img = page.getByRole('img', { name: alt, exact: true });
    return (await img.count()) ? img.getAttribute('src') : null;
  };
  return { peca: await src('Imagem da peça'), dispositivo: await src('Imagem do dispositivo') };
}

test('imagem do dispositivo se propaga pelo Nº dispositivo, acompanha a troca e sobrevive à exclusão da origem', async ({ page }) => {
  test.setTimeout(120_000);
  await entrarComoAdmin(page);
  const base = `IMG${Date.now()}`;
  const numero = `MAT-${base}`;
  const [irmao, origem, novo, outroNumero] = ['A', 'B', 'C', 'D'].map(s => `${base}-${s}`);

  // 1. Dispositivo com o Nº, ainda sem imagem, e outro Nº qualquer.
  await cadastrar(page, numero, irmao);
  await cadastrar(page, `OUTRO-${base}`, outroNumero);

  // 2. Outro dispositivo com o mesmo Nº (com outra grafia e outro código) recebe as fotos:
  //    a do dispositivo chega ao irmão; a da peça, não.
  await cadastrar(page, ` ${numero.toLowerCase()} `, origem, { peca: 'peca.png', dispositivo: 'primeira.png' });
  await expect(page.getByText(/Imagem do dispositivo copiada para 1 outro\(s\) dispositivo/)).toBeVisible();
  const daOrigem = await imagens(page, origem);
  const primeira = daOrigem.dispositivo;
  expect(primeira).toContain('primeira.png');
  expect(daOrigem.peca).toContain('peca.png');
  expect(await imagens(page, irmao)).toEqual({ peca: null, dispositivo: primeira });
  expect(await imagens(page, outroNumero)).toEqual({ peca: null, dispositivo: null });

  // 3. Um dispositivo novo com o mesmo Nº herda a imagem do dispositivo.
  await cadastrar(page, numero, novo);
  await expect(page.getByText(/O dispositivo recebeu a imagem já usada pelo Nº dispositivo/)).toBeVisible();
  expect(await imagens(page, novo)).toEqual({ peca: null, dispositivo: primeira });

  // 4. A origem troca a foto do dispositivo: quem seguia a anterior acompanha.
  await abrirDetalhes(page, origem);
  await page.getByRole('button', { name: /Editar/ }).first().click();
  const edicao = page.getByRole('dialog', { name: 'Editar dispositivo' });
  // Botões "Remover": o 1º é da imagem da peça, o 2º da imagem do dispositivo.
  await edicao.getByRole('button', { name: 'Remover' }).nth(1).click();
  await enviarImagemDispositivo(edicao, 'segunda.png');
  await edicao.getByRole('button', { name: 'Salvar registro do dispositivo' }).click();
  await expect(edicao).toBeHidden();
  await expect(page.getByText(/Imagem do dispositivo copiada para 2 outro\(s\) dispositivo/)).toBeVisible();
  const segunda = (await imagens(page, origem)).dispositivo;
  expect(segunda).toContain('segunda.png');
  expect((await imagens(page, irmao)).dispositivo).toBe(segunda);
  expect((await imagens(page, novo)).dispositivo).toBe(segunda);

  // 5. Excluir a origem não quebra a imagem dos outros; a foto que ninguém usa mais sai do Storage.
  await page.goto('/dispositivos');
  await page.getByLabel('Filtro de busca por nome ou código').fill(origem);
  const item = page.getByRole('option', { name: new RegExp(origem) });
  await item.focus();
  await item.press('d');
  await page.getByRole('dialog', { name: 'Confirmar exclusão' }).getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirmar exclusão' })).toBeHidden();
  await expect(page.getByRole('option', { name: new RegExp(origem) })).toHaveCount(0);

  expect((await page.request.get(segunda!)).status()).toBe(200);
  await expect.poll(async () => (await page.request.get(primeira!)).status()).not.toBe(200);
  expect((await imagens(page, irmao)).dispositivo).toBe(segunda);
});
