import { describe, it, test, expect } from '@jest/globals';
import {
  Dispositivo,
  calcularPropagacaoImagens,
  normalizarNumeroPeca,
  planejarLimpezaDuplicados
} from '../../../domain/entities/dispositivo';

const disp = (id: string, codigo: string | undefined, imagens: Partial<Dispositivo> = {}): Dispositivo => ({
  id,
  nome: `Disp ${id}`,
  codigo,
  ...imagens
});

describe('Propagação de imagens por Número da Peça', () => {
  it('normaliza a chave da linha (caixa e espaços)', () => {
    expect(normalizarNumeroPeca('  51500101580 ')).toBe('51500101580');
    expect(normalizarNumeroPeca('ABC-123')).toBe('abc-123');
    expect(normalizarNumeroPeca(undefined)).toBe('');
  });

  it('upload bem-sucedido preenche apenas células vazias da mesma linha', () => {
    const url = 'https://storage/img-peca.png';
    const linha = [
      disp('a', '51500101580'),
      disp('b', '51500101580', { imagemPeca: 'https://storage/existente.png' }), // já tem imagem
      disp('c', '51500101580'),
      disp('d', '99999999999') // outra linha
    ];

    const patches = calcularPropagacaoImagens(linha, 'a', '51500101580', { imagemPeca: url }, false);

    expect(patches).toHaveLength(1);
    expect(patches[0]).toEqual({ id: 'c', patch: { imagemPeca: url }, origem: 'propagacao' });
    // Nunca sobrescreve imagem existente (b) nem toca outra linha (d).
  });

  it('propaga os dois campos de imagem de forma independente', () => {
    const urlPeca = 'https://storage/peca.png';
    const urlDisp = 'https://storage/disp.png';
    const linha = [
      disp('a', 'ABC-1'),
      disp('b', 'abc-1', { imagemPeca: 'https://storage/ja-tem.png' })
    ];

    const patches = calcularPropagacaoImagens(
      linha,
      'a',
      'ABC-1',
      { imagemPeca: urlPeca, imagemDispositivo: urlDisp },
      false
    );

    // imagemPeca de 'b' permanece; imagemDispositivo de 'b' é preenchida.
    expect(patches).toHaveLength(1);
    expect(patches[0].id).toBe('b');
    expect(patches[0].patch).toEqual({ imagemDispositivo: urlDisp });
  });

  it('não dispara propagação sem número de peça', () => {
    const linha = [disp('a', undefined), disp('b', '  ')];
    const patches = calcularPropagacaoImagens(
      linha,
      'a',
      undefined,
      { imagemPeca: 'https://storage/x.png' },
      false
    );
    expect(patches).toHaveLength(0);
  });

  it('edição que limpa a imagem NÃO re-preenche nem propaga', () => {
    const linha = [disp('a', 'ABC-1'), disp('b', 'ABC-1')];
    const patches = calcularPropagacaoImagens(linha, 'a', 'ABC-1', { imagemPeca: '' }, false);
    expect(patches).toHaveLength(0);
  });

  it('na criação, células vazias da origem herdam a imagem existente na linha', () => {
    const existente = 'https://storage/linha.png';
    const linha = [disp('b', 'ABC-1', { imagemDispositivo: existente })];

    const patches = calcularPropagacaoImagens(linha, 'a-novo', 'ABC-1', { imagemPeca: '' }, true);

    expect(patches).toHaveLength(1);
    expect(patches[0]).toEqual({
      id: 'a-novo',
      patch: { imagemDispositivo: existente },
      origem: 'heranca'
    });
  });

  it('na edição (isNew=false) não há herança inversa', () => {
    const linha = [disp('b', 'ABC-1', { imagemDispositivo: 'https://storage/x.png' })];
    const patches = calcularPropagacaoImagens(linha, 'a', 'ABC-1', {}, false);
    expect(patches).toHaveLength(0);
  });
});

describe('planejarLimpezaDuplicados', () => {
  const d = (id: string, codigo: string, nome: string, extra: Record<string, unknown> = {}) =>
    ({ id, codigo, nome, dataCriacao: `2026-01-0${id.slice(-1)}`, ...extra });

  test('sem repetidos não planeja nada', () => {
    const plano = planejarLimpezaDuplicados([d('a1', 'A', '1'), d('a2', 'A', '2')], new Set());
    expect(plano).toMatchObject({ grupos: [], totalDocumentos: 2, combinacoesDistintas: 2, totalRemover: 0 });
  });

  test('mantém o mais antigo e remove só repetidos sem vínculo (caixa/espaços iguais)', () => {
    const plano = planejarLimpezaDuplicados([d('x3', 'A', '1'), d('x1', 'a ', '1'), d('x2', 'A', '1'), d('y1', 'B', '1')], new Set());
    expect(plano.grupos).toHaveLength(1);
    expect(plano.grupos[0].manter.id).toBe('x1');
    expect(plano.grupos[0].remover.map(r => r.id)).toEqual(['x2', 'x3']);
    expect(plano).toMatchObject({ totalDocumentos: 4, combinacoesDistintas: 2, totalRemover: 2, totalRevisar: 0 });
  });

  test('documentos com reutilização, imagem, anexo ou observação nunca são removidos', () => {
    const plano = planejarLimpezaDuplicados(
      [
        d('x1', 'A', '1'),
        d('x2', 'A', '1'),
        d('x3', 'A', '1', { imagemPeca: 'img.png' }),
        d('x4', 'A', '1', { anexos: [{ id: 'f' }] }),
        d('x5', 'A', '1', { observacoes: 'ver' }),
        d('x6', 'A', '1'),
      ] as never,
      new Set(['x2'])
    );
    const g = plano.grupos[0];
    expect(g.manter.id).toBe('x2'); // primeiro com vínculo
    expect(g.remover.map(r => r.id)).toEqual(['x1', 'x6']);
    expect(g.revisar.map(r => r.id)).toEqual(['x3', 'x4', 'x5']);
  });
});
