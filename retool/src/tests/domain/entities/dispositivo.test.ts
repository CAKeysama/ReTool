import { describe, it, test, expect } from '@jest/globals';
import {
  Dispositivo,
  calcularPropagacaoImagens,
  chaveCodigoDispositivo,
  ehCaminhoDeImagem,
  herdarImagensDaLinha,
  imagemDaLinha,
  normalizarNumeroDispositivo,
  patchAindaAplicavel,
  planejarLimpezaDuplicados,
  urlSemToken
} from '../../../domain/entities/dispositivo';

/** Dispositivo com o Nº dispositivo (`nome`) informado; o código varia para provar que não é a chave. */
const disp = (id: string, nome: string | undefined, imagens: Partial<Dispositivo> = {}): Dispositivo => ({
  id,
  nome,
  codigo: `PECA-${id}`,
  ...imagens
});

describe('Propagação da imagem do dispositivo por Nº dispositivo', () => {
  it('normaliza a chave da linha (caixa e espaços)', () => {
    expect(normalizarNumeroDispositivo('  MAT04670 ')).toBe('mat04670');
    expect(normalizarNumeroDispositivo('MAT-04670')).toBe('mat-04670');
    expect(normalizarNumeroDispositivo(undefined)).toBe('');
  });

  it('upload preenche a imagem do dispositivo de quem tem o mesmo Nº, mesmo com Número da Peça diferente', () => {
    const url = 'https://storage/img-disp.png';
    const linha = [
      disp('a', 'MAT04670'),
      disp('b', 'MAT04670', { imagemDispositivo: 'https://storage/existente.png' }), // já tem imagem
      disp('c', 'MAT04670'),
      disp('d', 'MAT99999') // outro Nº
    ];

    const patches = calcularPropagacaoImagens(linha, 'a', 'MAT04670', { imagemDispositivo: url }, false);

    // Nunca sobrescreve imagem existente (b) nem toca outro Nº (d).
    expect(patches).toEqual([{ id: 'c', patch: { imagemDispositivo: url }, origem: 'propagacao' }]);
  });

  it('a imagem da peça não é propagada (é alimentada um a um)', () => {
    const linha = [disp('a', 'MAT04670'), disp('b', 'MAT04670')];
    expect(calcularPropagacaoImagens(linha, 'a', 'MAT04670', { imagemPeca: 'https://storage/peca.png' }, false)).toEqual([]);
    const patches = calcularPropagacaoImagens(
      linha, 'a', 'MAT04670', { imagemPeca: 'https://storage/peca.png', imagemDispositivo: 'https://storage/disp.png' }, false
    );
    expect(patches).toEqual([{ id: 'b', patch: { imagemDispositivo: 'https://storage/disp.png' }, origem: 'propagacao' }]);
  });

  it('não dispara propagação sem Nº dispositivo', () => {
    const linha = [disp('a', undefined), disp('b', '  ')];
    const patches = calcularPropagacaoImagens(linha, 'a', undefined, { imagemDispositivo: 'https://storage/x.png' }, false);
    expect(patches).toHaveLength(0);
  });

  it('edição que limpa a imagem NÃO re-preenche nem propaga', () => {
    const linha = [disp('a', 'MAT04670'), disp('b', 'MAT04670')];
    const patches = calcularPropagacaoImagens(linha, 'a', 'MAT04670', { imagemDispositivo: '' }, false);
    expect(patches).toHaveLength(0);
  });

  it('na criação, a imagem do dispositivo vazia herda a imagem existente do mesmo Nº (a da peça, não)', () => {
    const existente = 'https://storage/linha.png';
    const linha = [disp('b', 'MAT04670', { imagemDispositivo: existente, imagemPeca: 'https://storage/peca-b.png' })];

    const patches = calcularPropagacaoImagens(linha, 'a-novo', 'MAT04670', { imagemDispositivo: '' }, true);

    expect(patches).toEqual([{ id: 'a-novo', patch: { imagemDispositivo: existente }, origem: 'heranca' }]);
  });

  it('na edição (isNew=false) não há herança inversa', () => {
    const linha = [disp('b', 'MAT04670', { imagemDispositivo: 'https://storage/x.png' })];
    const patches = calcularPropagacaoImagens(linha, 'a', 'MAT04670', {}, false);
    expect(patches).toHaveLength(0);
  });

  it('linha usa a mesma normalização da chave Código + Dispositivo (espaços internos, invisíveis, caixa)', () => {
    expect(normalizarNumeroDispositivo('MAT  04670')).toBe('mat 04670');
    const espacoZero = String.fromCharCode(0x200b);
    const bom = String.fromCharCode(0xfeff);
    expect(normalizarNumeroDispositivo(`${espacoZero}MAT 04670${bom}`)).toBe('mat 04670');
    const linha = [disp('a', 'MAT 04670'), disp('b', 'mat  04670'), disp('c', `${espacoZero}Mat 04670`), disp('d', 'MAT 046701')];
    const patches = calcularPropagacaoImagens(linha, 'a', 'MAT 04670', { imagemDispositivo: 'u.png' }, false);
    expect(patches.map(p => p.id).sort()).toEqual(['b', 'c']);
  });

  it('troca da imagem da origem atualiza quem seguia a imagem antiga e preserva imagens próprias', () => {
    const antiga = 'https://storage/antiga.png';
    const nova = 'https://storage/nova.png';
    const linha = [
      disp('a', 'MAT04670', { imagemDispositivo: nova }),
      disp('b', 'MAT04670', { imagemDispositivo: antiga }),                       // seguia a da origem
      disp('c', 'MAT04670', { imagemDispositivo: 'https://storage/propria.png' }), // escolhida para ele
      disp('d', 'MAT04670'),                                                       // vazio
    ];
    const patches = calcularPropagacaoImagens(linha, 'a', 'MAT04670', { imagemDispositivo: nova }, false, { imagemDispositivo: antiga });
    expect(patches).toEqual([
      { id: 'b', patch: { imagemDispositivo: nova }, origem: 'propagacao', substitui: { imagemDispositivo: antiga } },
      { id: 'd', patch: { imagemDispositivo: nova }, origem: 'propagacao' },
    ]);
  });

  it('herança escolhe a imagem mais usada na linha (empate: menor id), independente da ordem', () => {
    const linha = [
      disp('z', 'MAT04670', { imagemDispositivo: 'rara.png' }),
      disp('m', 'MAT04670', { imagemDispositivo: 'comum.png' }),
      disp('n', 'MAT04670', { imagemDispositivo: 'comum.png' }),
    ];
    expect(imagemDaLinha(linha, 'imagemDispositivo')).toBe('comum.png');
    expect(imagemDaLinha([...linha].reverse(), 'imagemDispositivo')).toBe('comum.png');
    expect(imagemDaLinha([disp('b', 'X', { imagemDispositivo: 'b.png' }), disp('a', 'X', { imagemDispositivo: 'a.png' })], 'imagemDispositivo')).toBe('a.png');
    const patches = calcularPropagacaoImagens(linha, 'novo', 'MAT04670', {}, true);
    expect(patches).toEqual([{ id: 'novo', patch: { imagemDispositivo: 'comum.png' }, origem: 'heranca' }]);
  });
});

describe('patchAindaAplicavel (conferência na transação)', () => {
  const chave = normalizarNumeroDispositivo('MAT04670');
  const p = { id: 'b', patch: { imagemDispositivo: 'nova.png' }, origem: 'propagacao' as const, substitui: { imagemDispositivo: 'antiga.png' } };

  it('aplica só se a imagem do dispositivo continua vazia ou com a imagem substituída', () => {
    expect(patchAindaAplicavel(disp('b', 'MAT04670'), p, chave)).toEqual({ imagemDispositivo: 'nova.png' });
    expect(patchAindaAplicavel(disp('b', 'MAT04670', { imagemDispositivo: 'antiga.png' }), p, chave)).toEqual({ imagemDispositivo: 'nova.png' });
    // Alguém gravou outra imagem entre a leitura e a gravação: não sobrescreve.
    expect(patchAindaAplicavel(disp('b', 'MAT04670', { imagemDispositivo: 'outra.png' }), p, chave)).toBeNull();
  });

  it('nunca grava a imagem da peça, mesmo se vier no patch', () => {
    const comPeca = { id: 'b', patch: { imagemPeca: 'peca.png', imagemDispositivo: 'd.png' }, origem: 'propagacao' as const };
    expect(patchAindaAplicavel(disp('b', 'MAT04670'), comPeca, chave)).toEqual({ imagemDispositivo: 'd.png' });
  });

  it('não grava se o documento sumiu, mudou de Nº ou já tem a imagem', () => {
    expect(patchAindaAplicavel(null, p, chave)).toBeNull();
    expect(patchAindaAplicavel(disp('b', 'OUTRO'), p, chave)).toBeNull();
    expect(patchAindaAplicavel(disp('b', 'MAT04670', { imagemDispositivo: 'nova.png' }), p, chave)).toBeNull();
  });
});

describe('herdarImagensDaLinha (importação)', () => {
  it('novos herdam só a imagem do dispositivo do mesmo Nº; imagem própria e outros Nº ficam como estão', () => {
    const fontes = [
      disp('e1', 'MAT04670', { imagemPeca: 'peca.png', imagemDispositivo: 'linha-d.png' }),
      disp('e2', 'mat04670 ', { imagemPeca: 'peca.png' }),
      disp('e3', 'XYZ'),
    ];
    const novos: Partial<Dispositivo>[] = [
      { codigo: 'C1', nome: 'MAT04670', imagemPeca: '', imagemDispositivo: '' },
      { codigo: 'C2', nome: 'Mat04670', imagemDispositivo: 'propria-d.png' },
      { codigo: 'C3', nome: 'XYZ', imagemDispositivo: '' },
      { codigo: 'C4', nome: 'SEM-LINHA', imagemDispositivo: '' },
    ];
    expect(herdarImagensDaLinha(novos, fontes)).toBe(1);
    expect(novos[0]).toMatchObject({ imagemPeca: '', imagemDispositivo: 'linha-d.png' });
    expect(novos[1].imagemDispositivo).toBe('propria-d.png');
    expect(novos[2].imagemDispositivo).toBe('');
    expect(novos[3].imagemDispositivo).toBe('');
  });
});

describe('arquivos de imagem no Storage', () => {
  it('reconhece caminhos de imagem e ignora PDFs', () => {
    expect(ehCaminhoDeImagem('retool/dispositivos/d1/imagem_peca/u_foto.png')).toBe(true);
    expect(ehCaminhoDeImagem('retool/dispositivos/d1/imagem_dispositivo/u_foto.png')).toBe(true);
    expect(ehCaminhoDeImagem('retool/dispositivos/d1/documento_pdf/u_manual.pdf')).toBe(false);
  });

  it('urlSemToken remove só a parte de consulta (token)', () => {
    const base = 'https://firebasestorage.googleapis.com/v0/b/b/o/retool%2Fdispositivos%2Fd1%2Fimagem_peca%2Fx.png';
    expect(urlSemToken(`${base}?alt=media&token=abc`)).toBe(base);
    expect(urlSemToken(base)).toBe(base);
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
