import { describe, it, test, expect } from '@jest/globals';
import {
  Dispositivo,
  calcularPropagacaoImagens,
  chaveCodigoDispositivo,
  ehCaminhoDeImagem,
  herdarImagensDaLinha,
  imagemDaLinha,
  normalizarNumeroPeca,
  patchAindaAplicavel,
  planejarLimpezaDuplicados,
  prefixoChaveDaLinha,
  urlSemToken
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

  it('linha usa a mesma normalização da chave Código + Dispositivo (espaços internos, invisíveis, caixa)', () => {
    expect(normalizarNumeroPeca('ABC  123')).toBe('abc 123');
    const espacoZero = String.fromCharCode(0x200b);
    const bom = String.fromCharCode(0xfeff);
    expect(normalizarNumeroPeca(`${espacoZero}ABC 123${bom}`)).toBe('abc 123');
    const linha = [disp('a', 'ABC 123'), disp('b', 'abc  123'), disp('c', `${espacoZero}Abc 123`), disp('d', 'ABC 1234')];
    const patches = calcularPropagacaoImagens(linha, 'a', 'ABC 123', { imagemPeca: 'u.png' }, false);
    expect(patches.map(p => p.id).sort()).toEqual(['b', 'c']);
  });

  it('prefixoChaveDaLinha é o início exato da chaveCD da linha, sem pegar outro código', () => {
    const prefixo = prefixoChaveDaLinha(normalizarNumeroPeca('ABC 123'));
    expect(chaveCodigoDispositivo('abc 123', 'Disp 9').startsWith(prefixo)).toBe(true);
    expect(chaveCodigoDispositivo('ABC 1234', 'Disp 9').startsWith(prefixo)).toBe(false);
    // Aspas no código são escapadas pelo JSON: não colidem com o fim do prefixo.
    expect(chaveCodigoDispositivo('abc 123"', 'x').startsWith(prefixo)).toBe(false);
  });

  it('troca da imagem da origem atualiza quem seguia a imagem antiga e preserva imagens próprias', () => {
    const antiga = 'https://storage/antiga.png';
    const nova = 'https://storage/nova.png';
    const linha = [
      disp('a', 'ABC-1', { imagemPeca: nova }),
      disp('b', 'ABC-1', { imagemPeca: antiga }),                  // seguia a da origem
      disp('c', 'ABC-1', { imagemPeca: 'https://storage/propria.png' }), // escolhida para ele
      disp('d', 'ABC-1'),                                          // vazio
    ];
    const patches = calcularPropagacaoImagens(linha, 'a', 'ABC-1', { imagemPeca: nova }, false, { imagemPeca: antiga });
    expect(patches).toEqual([
      { id: 'b', patch: { imagemPeca: nova }, origem: 'propagacao', substitui: { imagemPeca: antiga } },
      { id: 'd', patch: { imagemPeca: nova }, origem: 'propagacao' },
    ]);
  });

  it('junta os dois campos num único patch por dispositivo', () => {
    const linha = [disp('a', 'ABC-1'), disp('b', 'ABC-1')];
    const patches = calcularPropagacaoImagens(linha, 'a', 'ABC-1', { imagemPeca: 'p.png', imagemDispositivo: 'd.png' }, false);
    expect(patches).toEqual([{ id: 'b', patch: { imagemPeca: 'p.png', imagemDispositivo: 'd.png' }, origem: 'propagacao' }]);
  });

  it('herança escolhe a imagem mais usada na linha (empate: menor id), independente da ordem', () => {
    const linha = [
      disp('z', 'ABC-1', { imagemPeca: 'rara.png' }),
      disp('m', 'ABC-1', { imagemPeca: 'comum.png' }),
      disp('n', 'ABC-1', { imagemPeca: 'comum.png' }),
    ];
    expect(imagemDaLinha(linha, 'imagemPeca')).toBe('comum.png');
    expect(imagemDaLinha([...linha].reverse(), 'imagemPeca')).toBe('comum.png');
    expect(imagemDaLinha([disp('b', 'X', { imagemPeca: 'b.png' }), disp('a', 'X', { imagemPeca: 'a.png' })], 'imagemPeca')).toBe('a.png');
    const patches = calcularPropagacaoImagens(linha, 'novo', 'ABC-1', {}, true);
    expect(patches).toEqual([{ id: 'novo', patch: { imagemPeca: 'comum.png' }, origem: 'heranca' }]);
  });
});

describe('patchAindaAplicavel (conferência na transação)', () => {
  const chave = normalizarNumeroPeca('ABC-1');
  const p = { id: 'b', patch: { imagemPeca: 'nova.png', imagemDispositivo: 'd.png' }, origem: 'propagacao' as const, substitui: { imagemPeca: 'antiga.png' } };

  it('aplica só os campos que continuam vazios ou com a imagem substituída', () => {
    expect(patchAindaAplicavel(disp('b', 'ABC-1'), p, chave)).toEqual({ imagemPeca: 'nova.png', imagemDispositivo: 'd.png' });
    expect(patchAindaAplicavel(disp('b', 'ABC-1', { imagemPeca: 'antiga.png' }), p, chave)).toEqual({ imagemPeca: 'nova.png', imagemDispositivo: 'd.png' });
    // Alguém gravou outra imagem entre a leitura e a gravação: não sobrescreve.
    expect(patchAindaAplicavel(disp('b', 'ABC-1', { imagemPeca: 'outra.png', imagemDispositivo: 'outra-d.png' }), p, chave)).toBeNull();
    expect(patchAindaAplicavel(disp('b', 'ABC-1', { imagemPeca: 'outra.png' }), p, chave)).toEqual({ imagemDispositivo: 'd.png' });
  });

  it('não grava se o documento sumiu, mudou de linha ou já tem a imagem', () => {
    expect(patchAindaAplicavel(null, p, chave)).toBeNull();
    expect(patchAindaAplicavel(disp('b', 'OUTRA'), p, chave)).toBeNull();
    expect(patchAindaAplicavel(disp('b', 'ABC-1', { imagemPeca: 'nova.png', imagemDispositivo: 'd.png' }), p, chave)).toBeNull();
  });
});

describe('herdarImagensDaLinha (importação)', () => {
  it('novos sem imagem herdam a imagem da linha; imagem própria e outras linhas ficam como estão', () => {
    const fontes = [
      disp('e1', 'ABC-1', { imagemPeca: 'linha.png', imagemDispositivo: 'linha-d.png' }),
      disp('e2', 'abc-1 ', { imagemPeca: 'linha.png' }),
      disp('e3', 'XYZ'),
    ];
    const novos: Partial<Dispositivo>[] = [
      { codigo: 'ABC-1', nome: 'N1', imagemPeca: '', imagemDispositivo: '' },
      { codigo: 'ABC-1', nome: 'N2', imagemPeca: 'propria.png', imagemDispositivo: '' },
      { codigo: 'XYZ', nome: 'N3', imagemPeca: '' },
      { codigo: 'SEM-LINHA', nome: 'N4', imagemPeca: '' },
    ];
    expect(herdarImagensDaLinha(novos, fontes)).toBe(2);
    expect(novos[0]).toMatchObject({ imagemPeca: 'linha.png', imagemDispositivo: 'linha-d.png' });
    expect(novos[1]).toMatchObject({ imagemPeca: 'propria.png', imagemDispositivo: 'linha-d.png' });
    expect(novos[2].imagemPeca).toBe('');
    expect(novos[3].imagemPeca).toBe('');
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
