import { describe, test, expect } from '@jest/globals';
import {
  TAMANHO_LOTE_DISPOSITIVOS, alteraDocumento, dadosParaGravar, ehErroDeCota, emLotes, estimarGravacao, planejarGravacao,
} from '../../../application/importacao/gravacaoDispositivos';
import { Dispositivo } from '../../../domain/entities/dispositivo';

const existente = (id: string, campos: Partial<Dispositivo>): Dispositivo =>
  ({ id, dataCriacao: '2025-01-01T00:00:00.000Z', ...campos } as Dispositivo);

const linha = (codigo: string, nome: string, extra: Partial<Dispositivo> = {}): Partial<Dispositivo> => ({
  codigo, nome, familiaId: 'f', produtoId: 'p', categoriaId: 'c', descricao: 'd', peso: '1',
  palavrasChave: [], imagemPeca: '', imagemDispositivo: '', ...extra,
});

let seq = 0;
const gerarId = () => `novo-${seq++}`;

describe('planejarGravacao — economia de escritas', () => {
  test('registro igual ao do banco não é gravado (ignoradosSemAlteracao)', () => {
    const banco = [existente('d1', { ...linha('A', '1'), imagemPeca: 'img.png' })];
    const plano = planejarGravacao([linha('A', '1')], banco, gerarId);
    expect(plano).toMatchObject({ operacoes: [], ignoradosSemAlteracao: 1, registrosAGravar: 0 });
  });

  test('vazio × ausente e [] × ausente não contam como alteração', () => {
    const banco = [existente('d1', { codigo: 'A', nome: '1', familiaId: 'f', produtoId: 'p', categoriaId: 'c', descricao: 'd', peso: '1' })];
    expect(planejarGravacao([linha('A', '1')], banco, gerarId).ignoradosSemAlteracao).toBe(1);
  });

  test('qualquer campo gravado diferente gera escrita (só do documento alterado)', () => {
    const banco = [existente('d1', linha('A', '1')), existente('d2', linha('B', '1'))];
    const plano = planejarGravacao([linha('A', '1', { peso: '2' }), linha('B', '1')], banco, gerarId);
    expect(plano.operacoes).toEqual([expect.objectContaining({ id: 'd1', novo: false, registros: 1 })]);
    expect(plano.ignoradosSemAlteracao).toBe(1);
  });

  test('palavras-chave em outra ordem ou caixa do Código diferente contam como alteração', () => {
    const banco = [existente('d1', linha('A', '1', { palavrasChave: ['x', 'y'] }))];
    expect(planejarGravacao([linha('A', '1', { palavrasChave: ['y', 'x'] })], banco, gerarId).operacoes).toHaveLength(1);
    expect(planejarGravacao([linha('a', '1', { palavrasChave: ['x', 'y'] })], banco, gerarId).operacoes[0].id).toBe('d1');
  });

  test('imagem vazia da planilha não apaga nem conta como alteração do existente', () => {
    const dados = dadosParaGravar(linha('A', '1'), true, 'd1', 'agora');
    expect(dados).not.toHaveProperty('imagemPeca');
    expect(alteraDocumento(dados, existente('d1', { ...linha('A', '1'), imagemPeca: 'x.png' }))).toBe(false);
  });
});

describe('planejarGravacao — regra Código + Dispositivo (PR #26)', () => {
  test('nunca casa um existente só pelo Código', () => {
    const banco = [existente('d1', linha('ABC', 'D01'))];
    const plano = planejarGravacao([linha('ABC', 'D02'), linha('XYZ', 'D01')], banco, gerarId);
    expect(plano.operacoes.map(o => o.novo)).toEqual([true, true]);
    expect(plano.operacoes.map(o => o.id)).not.toContain('d1');
  });

  test('mesma combinação ignorando caixa/espaços atualiza o existente', () => {
    const banco = [existente('d1', linha('ABC', 'D01'))];
    const plano = planejarGravacao([linha(' abc ', 'd01', { descricao: 'nova' })], banco, gerarId);
    expect(plano.operacoes).toEqual([expect.objectContaining({ id: 'd1', novo: false })]);
  });

  test('combinação repetida na lista vira uma escrita só; novo recebe id e dataCriacao', () => {
    const plano = planejarGravacao([linha('A', '1'), linha('a', '1 ', { peso: '9' })], [], gerarId, 'T');
    expect(plano.operacoes).toHaveLength(1);
    expect(plano.operacoes[0]).toMatchObject({ novo: true, registros: 2, dados: { peso: '9', dataCriacao: 'T' } });
    expect(plano.operacoes[0].dados.id).toBe(plano.operacoes[0].id);
  });
});

describe('utilitários da gravação', () => {
  test('lotes de até 500 (limite do writeBatch), inclusive o último incompleto', () => {
    expect(TAMANHO_LOTE_DISPOSITIVOS).toBeLessThanOrEqual(500);
    const lotes = emLotes(Array.from({ length: 1234 }, (_, i) => i));
    expect(lotes.map(l => l.length)).toEqual([500, 500, 234]);
    expect(emLotes([])).toEqual([]);
  });

  test('ehErroDeCota reconhece resource-exhausted (código e mensagem) e nada mais', () => {
    expect(ehErroDeCota({ code: 'resource-exhausted', message: 'Quota exceeded.' })).toBe(true);
    expect(ehErroDeCota(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded'))).toBe(true);
    expect(ehErroDeCota({ code: 'permission-denied' })).toBe(false);
    expect(ehErroDeCota(new Error('DEADLINE_EXCEEDED'))).toBe(false);
    expect(ehErroDeCota(null)).toBe(false);
  });

  test('estimarGravacao separa novos, alterados e sem alteração', () => {
    const banco = [existente('d1', linha('A', '1')), existente('d2', linha('B', '1'))];
    expect(estimarGravacao([linha('A', '1'), linha('B', '1', { peso: '3' }), linha('C', '1')], banco))
      .toEqual({ novos: 1, alterados: 1, semAlteracao: 1 });
  });
});
