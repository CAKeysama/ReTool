/// <reference types="node" />
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, test, expect } from '@jest/globals';
import {
  AbaPlanilha,
  CelulaPlanilha,
  decodificarTexto,
  lerPlanilha,
  normalizarCabecalho,
  processarPlanilhaDispositivos,
  textoDaCelula,
} from '../../../application/importacao/planilhaDispositivos';
import { chaveCodigoDispositivo, normalizarValorChave } from '../../../domain/entities/dispositivo';

const ctxVazio = { categorias: [], familias: [], produtos: [] };

const aba = (linhas: CelulaPlanilha[][], cabecalhos = ['Código', 'Dispositivo'], nome = 'DADOS'): AbaPlanilha => ({
  nome,
  cabecalhos,
  linhas,
});

const processar = (linhas: CelulaPlanilha[][], cabecalhos?: string[]) =>
  processarPlanilhaDispositivos([aba(linhas, cabecalhos)], ctxVazio);

const pares = (r: ReturnType<typeof processar>) => r.dispositivos.map(d => [d.codigo, d.nome]);

/** Gera um .xlsx em memória a partir de células já tipadas (como o Excel salvaria). */
function xlsxDe(celulas: Record<string, XLSX.CellObject>, ref: string): Uint8Array {
  const ws: XLSX.WorkSheet = { ...celulas, '!ref': ref };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DADOS');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

describe('chave Código + Dispositivo', () => {
  test('mesma combinação gera a mesma chave; Dispositivo diferente gera outra', () => {
    expect(chaveCodigoDispositivo('ABC', 'D01')).toBe(chaveCodigoDispositivo('ABC', 'D01'));
    expect(chaveCodigoDispositivo('ABC', 'D01')).not.toBe(chaveCodigoDispositivo('ABC', 'D02'));
    expect(chaveCodigoDispositivo('ABC', 'D01')).not.toBe(chaveCodigoDispositivo('XYZ', 'D01'));
  });

  test('separador não colide entre campos', () => {
    expect(chaveCodigoDispositivo('A|B', 'C')).not.toBe(chaveCodigoDispositivo('A', 'B|C'));
    expect(chaveCodigoDispositivo('A', '')).not.toBe(chaveCodigoDispositivo('', 'A'));
  });

  test('normalização: espaços, invisíveis, NBSP, Unicode e caixa são equivalentes', () => {
    expect(normalizarValorChave('  abc  ')).toBe('abc');
    expect(normalizarValorChave('A  B\tC')).toBe('a b c');
    expect(normalizarValorChave('A B')).toBe('a b');
    expect(normalizarValorChave('AB​C﻿')).toBe('abc');
    expect(normalizarValorChave('PEÇA')).toBe(normalizarValorChave('PEÇA')); // NFD x NFC
    expect(normalizarValorChave('daf00041')).toBe(normalizarValorChave('DAF00041'));
  });

  test('normalização NÃO funde valores semanticamente diferentes', () => {
    expect(normalizarValorChave('0041')).not.toBe(normalizarValorChave('41'));
    expect(normalizarValorChave('1.10')).not.toBe(normalizarValorChave('1.1'));
    expect(normalizarValorChave('PEÇA')).not.toBe(normalizarValorChave('PECA'));
    expect(normalizarValorChave(123)).toBe(normalizarValorChave('123'));
    expect(normalizarValorChave(0)).toBe('0');
    expect(normalizarValorChave(null)).toBe('');
  });
});

describe('processarPlanilhaDispositivos — regra de unicidade', () => {
  test('duas linhas exatamente iguais → uma ocorrência', () => {
    const r = processar([['ABC', 'D01'], ['ABC', 'D01']]);
    expect(pares(r)).toEqual([['ABC', 'D01']]);
    expect(r.resumo).toMatchObject({ linhasLidas: 2, combinacoesUnicas: 1, duplicadasRemovidas: 1 });
  });

  test('mesmo Código com Dispositivo diferente → duas ocorrências', () => {
    const r = processar([['ABC', 'D01'], ['ABC', 'D02']]);
    expect(pares(r)).toEqual([['ABC', 'D01'], ['ABC', 'D02']]);
  });

  test('Código diferente com mesmo Dispositivo → duas ocorrências', () => {
    const r = processar([['ABC', 'D01'], ['XYZ', 'D01']]);
    expect(pares(r)).toEqual([['ABC', 'D01'], ['XYZ', 'D01']]);
  });

  test('múltiplas duplicatas misturadas', () => {
    const r = processar([
      ['A', '1'], ['A', '2'], ['A', '1'], ['B', '1'], ['A', '2'], ['B', '1'], ['A', '1'], ['C', '3'],
    ]);
    expect(r.resumo).toMatchObject({ linhasLidas: 8, combinacoesUnicas: 4, duplicadasRemovidas: 4 });
    expect(r.resumo.linhasLidas).toBe(r.resumo.combinacoesUnicas + r.resumo.duplicadasRemovidas);
  });

  test('valores com espaços e diferença de capitalização são a mesma combinação', () => {
    const r = processar([['ABC', 'D01'], ['  abc ', 'd01  '], ['A B C', 'D01'], ['A  B  C', 'D01']]);
    expect(pares(r)).toEqual([['ABC', 'D01'], ['A B C', 'D01']]);
  });

  test('valores numéricos e com zeros à esquerda são preservados', () => {
    const r = processar([
      [{ texto: '123', numero: 123 }, 'D1'],
      ['123', 'D1'],            // texto "123" = número 123
      ['00123', 'D1'],          // zeros à esquerda → outra combinação
      ['0123', 'D1'],
      [{ texto: '0', numero: 0 }, 'D1'], // zero não pode virar vazio
    ]);
    expect(pares(r)).toEqual([['123', 'D1'], ['00123', 'D1'], ['0123', 'D1'], ['0', 'D1']]);
  });

  test('arquivo vazio e aba só com cabeçalho', () => {
    expect(processarPlanilhaDispositivos([], ctxVazio).dispositivos).toEqual([]);
    const r = processar([]);
    expect(r.dispositivos).toEqual([]);
    expect(r.resumo.linhasLidas).toBe(0);
  });

  test('linhas totalmente vazias não contam; linhas sem chave são contadas e avisadas', () => {
    const r = processarPlanilhaDispositivos(
      [aba([['', '', ''], ['ABC', 'D01', 'x'], ['', '', 'só descrição']], ['Código', 'Dispositivo', 'Descrição'])],
      ctxVazio
    );
    expect(r.resumo).toMatchObject({ linhasLidas: 2, linhasSemChave: 1, combinacoesUnicas: 1 });
    expect(r.resumo.avisos.join(' ')).toMatch(/sem Código e sem Dispositivo/);
  });

  test('cabeçalhos com acento/caixa/pontuação diferentes são reconhecidos', () => {
    expect(normalizarCabecalho(' CÓDIGO ')).toBe('codigo');
    expect(normalizarCabecalho('Nº Dispositivo')).toBe('n dispositivo');
    expect(normalizarCabecalho('Familia_do_Produto')).toBe('familia do produto');
    const r = processar([['ABC', 'D01']], ['codigo', 'DISPOSITIVO']);
    expect(pares(r)).toEqual([['ABC', 'D01']]);
    expect(processar([['ABC', 'D01']], ['Código Peça', 'Nº Dispositivo']).dispositivos).toHaveLength(1);
  });

  test('coluna Código ausente gera aviso explícito (não reduz em silêncio ao Dispositivo)', () => {
    const r = processar([['D01'], ['D02']], ['Dispositivo']);
    expect(r.resumo.avisos.join(' ')).toMatch(/coluna Código não encontrada/);
    expect(r.resumo.linhasSemCodigo).toBe(2);
  });

  test('abas sem colunas-chave são ignoradas e as demais somam', () => {
    const r = processarPlanilhaDispositivos(
      [
        aba([['x', 'y']], ['Família', 'P'], 'FAMILIAS'),
        aba([['A', '1'], ['A', '2']], ['Código', 'Dispositivo'], 'ABA1'),
        aba([['A', '1'], ['B', '1']], ['Código', 'Dispositivo'], 'ABA2'),
      ],
      ctxVazio
    );
    expect(r.resumo.abas.find(a => a.nome === 'FAMILIAS')?.ignorada).toBe(true);
    expect(r.resumo).toMatchObject({ linhasLidas: 4, combinacoesUnicas: 3, duplicadasRemovidas: 1 });
  });

  test('duplicata mantém Código/Dispositivo da 1ª ocorrência e demais campos da última', () => {
    const r = processarPlanilhaDispositivos(
      [aba([['ABC', 'D01', '1'], ['abc', 'd01', '2,5']], ['Código', 'Dispositivo', 'Peso'])],
      ctxVazio
    );
    expect(r.dispositivos).toEqual([expect.objectContaining({ codigo: 'ABC', nome: 'D01', peso: '2.5' })]);
  });

  test('classificações: reaproveita existentes e lista novas sem repetir (caixa/espaços)', () => {
    const r = processarPlanilhaDispositivos(
      [aba(
        [['A', '1', 'gabarito', 'Nova Fam'], ['B', '2', 'Novo Tipo', 'nova fam '], ['C', '3', 'novo tipo', '']],
        ['Código', 'Dispositivo', 'Tipo de Dispositivo', 'Familia']
      )],
      { categorias: [{ id: 'cat1', nome: 'GABARITO' }], familias: [], produtos: [], defaultCategoriaId: 'padrao' }
    );
    expect(r.dispositivos.map(d => d.categoriaId)).toEqual(['cat1', 'Novo Tipo', 'Novo Tipo']);
    expect(r.novasCategorias).toEqual(['Novo Tipo']);
    expect(r.novasFamilias).toEqual(['Nova Fam']);
    expect(r.dispositivos[2].familiaId).toBe('');
  });

  test('categoria padrão só vale para linhas sem categoria', () => {
    const r = processarPlanilhaDispositivos(
      [aba([['A', '1', ''], ['B', '2', 'GABARITO']], ['Código', 'Dispositivo', 'Categoria'])],
      { categorias: [{ id: 'cat1', nome: 'GABARITO' }], familias: [], produtos: [], defaultCategoriaId: 'padrao' }
    );
    expect(r.dispositivos.map(d => d.categoriaId)).toEqual(['padrao', 'cat1']);
  });

  test('arquivo grande: contagem exata de combinações sem perdas', () => {
    // 6.000 combinações (300 códigos × 20 dispositivos), cada uma repetida
    // de 1 a 4 vezes com variações de caixa/espaço, embaralhadas.
    const linhas: string[][] = [];
    let esperadasDuplicadas = 0;
    for (let c = 0; c < 300; c++) {
      for (let d = 0; d < 20; d++) {
        const codigo = String(c).padStart(6, '0');
        const disp = `DAF${String(d).padStart(5, '0')}`;
        const reps = 1 + ((c * 20 + d) % 4);
        esperadasDuplicadas += reps - 1;
        for (let k = 0; k < reps; k++) linhas.push([k % 2 ? ` ${codigo} ` : codigo, k === 2 ? disp.toLowerCase() : disp]);
      }
    }
    for (let i = linhas.length - 1; i > 0; i--) {
      const j = (i * 7919) % (i + 1);
      [linhas[i], linhas[j]] = [linhas[j], linhas[i]];
    }
    const r = processar(linhas);
    expect(r.resumo.linhasLidas).toBe(linhas.length);
    expect(r.resumo.combinacoesUnicas).toBe(6000);
    expect(r.resumo.duplicadasRemovidas).toBe(esperadasDuplicadas);
  });

  test('reprocessar o mesmo arquivo dá o mesmo resultado', () => {
    const linhas = [['A', '1'], ['A', '2'], ['a', '1']];
    expect(pares(processar(linhas))).toEqual(pares(processar(linhas)));
  });
});

describe('lerPlanilha — leitura sem perda de representação', () => {
  test('CSV UTF-8 sem BOM: cabeçalho "Código" reconhecido e zeros à esquerda preservados', () => {
    const csv = 'Código;Dispositivo\n0041;D1\n041;D1\n41;D1\n1.10;D3\n1.1;D3\n';
    const abas = lerPlanilha(new TextEncoder().encode(csv), 'base.csv');
    expect(abas[0].cabecalhos).toEqual(['Código', 'Dispositivo']);
    const r = processarPlanilhaDispositivos(abas, ctxVazio);
    expect(pares(r)).toEqual([['0041', 'D1'], ['041', 'D1'], ['41', 'D1'], ['1.10', 'D3'], ['1.1', 'D3']]);
  });

  test('CSV Windows-1252 (Excel pt-BR) também é decodificado', () => {
    const bytes = Uint8Array.from([...'C', 0xf3, ...'digo,Dispositivo\nABC,PE', 0xc7, ...'A\n'].map(x => (typeof x === 'string' ? x.charCodeAt(0) : x)));
    expect(decodificarTexto(bytes)).toBe('Código,Dispositivo\nABC,PEÇA\n');
    const r = processarPlanilhaDispositivos(lerPlanilha(bytes, 'base.CSV'), ctxVazio);
    expect(pares(r)).toEqual([['ABC', 'PEÇA']]);
  });

  test('xlsx: número formatado usa o texto exibido; número Geral usa o valor completo', () => {
    const bytes = xlsxDe(
      {
        A1: { t: 's', v: 'Código' }, B1: { t: 's', v: 'Dispositivo' }, C1: { t: 's', v: 'Peso' },
        A2: { t: 'n', v: 41, z: '00000' }, B2: { t: 's', v: 'X' },
        A3: { t: 'n', v: 41, z: '0000' }, B3: { t: 's', v: 'X' },
        A4: { t: 'n', v: 50400111380123 }, B4: { t: 's', v: 'Y' }, C4: { t: 'n', v: 4.988, z: '0.00' },
        A5: { t: 'n', v: 50400111380124 }, B5: { t: 's', v: 'Y' },
        A6: { t: 's', v: '00041' }, B6: { t: 's', v: 'X' }, // texto igual ao exibido em A2
      },
      'A1:C6'
    );
    const r = processarPlanilhaDispositivos(lerPlanilha(bytes, 'base.xlsx'), ctxVazio);
    expect(pares(r)).toEqual([['00041', 'X'], ['0041', 'X'], ['50400111380123', 'Y'], ['50400111380124', 'Y']]);
    expect(r.dispositivos[2].peso).toBe('4.988'); // peso bruto, não o arredondado "4.99"
    expect(r.resumo.duplicadasRemovidas).toBe(1);
  });

  test('xlsx com dimensão (<dimension>) desatualizada não perde as últimas linhas', () => {
    const ws = XLSX.utils.aoa_to_sheet([['Código', 'Dispositivo'], ['A', '1'], ['B', '2'], ['C', '3']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DADOS');
    // Reescreve a tag <dimension> do arquivo como alguns geradores de planilha fazem:
    // declara só 1 linha de dados, mas as células das linhas 3 e 4 existem.
    const zip = XLSX.CFB.read(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), { type: 'array' });
    const entrada = zip.FileIndex[zip.FullPaths.findIndex(p => /sheet1\.xml$/.test(p))];
    const xml = new TextDecoder().decode(entrada.content as Uint8Array).replace(/<dimension ref="[^"]*"/, '<dimension ref="A1:B2"');
    entrada.content = new TextEncoder().encode(xml);
    entrada.size = entrada.content.length;
    const bytes = new Uint8Array(XLSX.CFB.write(zip, { type: 'array', fileType: 'zip' }) as ArrayLike<number>);

    // Leitura ingênua (sheet_to_json) perde as linhas fora da dimensão declarada.
    expect(XLSX.utils.sheet_to_json(XLSX.read(bytes, { type: 'array' }).Sheets.DADOS)).toHaveLength(1);
    const r = processarPlanilhaDispositivos(lerPlanilha(bytes, 'x.xlsx'), ctxVazio);
    expect(r.resumo.combinacoesUnicas).toBe(3);
  });

  test('arquivo vazio', () => {
    expect(lerPlanilha(new Uint8Array(0), 'x.csv')[0].linhas).toEqual([]);
  });

  test('textoDaCelula cobre vazios, booleanos, erros e datas', () => {
    expect(textoDaCelula(undefined)).toBe('');
    expect(textoDaCelula({ t: 'z' } as XLSX.CellObject)).toBe('');
    expect(textoDaCelula({ t: 'b', v: true })).toBe('true');
    expect(textoDaCelula({ t: 'e', v: 7, w: '#DIV/0!' })).toBe('#DIV/0!');
    expect(textoDaCelula({ t: 'd', v: new Date('2026-01-02T00:00:00.000Z') })).toBe('2026-01-02T00:00:00.000Z');
    expect(textoDaCelula({ t: 'n', v: 7, z: '@' })).toBe('7');
  });

  test('planilha de exemplo do repositório (docs/RETOOL import test.xlsx)', () => {
    const bytes = readFileSync(join(__dirname, '../../../../docs/RETOOL import test.xlsx'));
    const r = processarPlanilhaDispositivos(lerPlanilha(new Uint8Array(bytes), 'RETOOL import test.xlsx'), ctxVazio);
    expect(r.resumo.abas.filter(a => !a.ignorada).map(a => a.nome)).toEqual(['DADOS']);
    expect(pares(r)).toEqual([
      ['50400111380', 'DAF00041'],
      ['50400111399', 'DAF00041'],
      ['51070100111', 'DAF00040'],
      ['51360261798', 'DAF00040'],
    ]);
  });
});
