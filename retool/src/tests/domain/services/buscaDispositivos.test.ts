import {
  serializarEntrada, desserializarEntrada, prepararEntradas, filtrarEntradas,
  normalizarBusca, parteDoId, partesParaTotal, EntradaIndice, NomesClassificacao
} from '../../../domain/services/buscaDispositivos';

/** Filtro original (useDispositivosController antes da paginação), copiado para comparar. */
const normalizeStr = (str: string | undefined | null) => {
  if (!str) return '';
  let res = str.toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  res = res.replace(/,/g, '.');
  if (res.includes('avula')) res = res.replace(/avula/g, 'avola');
  return res;
};
function filtroOriginal(lista: EntradaIndice[], nomes: NomesClassificacao, filterQuery: string, filterCategoria: string, filterProcesso: string, comPeso = false) {
  const q = normalizeStr(filterQuery).trim();
  const proc = normalizeStr(filterProcesso).trim();
  return lista.filter(p => {
    const nome = normalizeStr(p.nome);
    const codigo = normalizeStr(p.codigo);
    const descricao = normalizeStr(p.descricao);
    const familia = normalizeStr(nomes.familias.get(p.familiaId));
    const produto = normalizeStr(nomes.produtos.get(p.produtoId));
    const categoriaNome = normalizeStr(nomes.categorias.get(p.categoriaId));
    const matchText = filterQuery === '' || nome.includes(q) || codigo.includes(q) || descricao.includes(q) ||
      familia.includes(q) || produto.includes(q) || categoriaNome.includes(q) ||
      (comPeso && normalizeStr(p.peso).includes(q)) ||
      (p.palavrasChave || []).some(tag => normalizeStr(tag).includes(q));
    const matchCat = filterCategoria === '' || p.categoriaId === filterCategoria;
    const matchProcesso = filterProcesso === '' || descricao.includes(proc) || nome.includes(proc) ||
      (p.palavrasChave || []).some(tag => normalizeStr(tag).includes(proc));
    return matchText && matchCat && matchProcesso;
  });
}

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALAVRAS = ['Barra', 'Avulsa', 'avula', 'Solda', 'Prensa', 'Ação', 'Furação', 'Estampo', 'Dobra', 'Corte', '1,5', 'Gabarito', 'Pinça', 'Usinagem'];
const nomes: NomesClassificacao = {
  categorias: new Map([['c1', 'Soldagem'], ['c2', 'Estampagem'], ['c3', 'Montagem']]),
  familias: new Map([['f1', 'Família Ação'], ['f2', 'Linha Pesada']]),
  produtos: new Map([['p1', 'Produto Avulso'], ['p2', 'Chassi']]),
};

function gerar(n: number, seed = 42): EntradaIndice[] {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  return Array.from({ length: n }, (_, i) => desserializarEntrada(`id${String(i).padStart(5, '0')}`, serializarEntrada({
    codigo: String(Math.floor(r() * 1e11)).padStart(11, '0'),
    nome: `DAF${String(i).padStart(5, '0')}`,
    descricao: `${pick(PALAVRAS)} ${pick(PALAVRAS)}`,
    categoriaId: pick(['c1', 'c2', 'c3', '']),
    familiaId: pick(['f1', 'f2', '']),
    produtoId: pick(['p1', 'p2', '']),
    peso: r() < 0.5 ? `${Math.floor(r() * 9)},${Math.floor(r() * 99)}` : '',
    palavrasChave: r() < 0.5 ? [pick(PALAVRAS), pick(PALAVRAS)] : [],
    ativo: r() > 0.1,
  })));
}

describe('buscaDispositivos', () => {
  it('serializa e desserializa sem perder campos (inclui separadores no texto)', () => {
    const d = { codigo: ' 0123 ', nome: 'Disp\u001fA', descricao: 'Desc, com vírgula', categoriaId: 'c', familiaId: 'f', produtoId: 'p', peso: '1,5', palavrasChave: ['a', 'b c'], ativo: false };
    const e = desserializarEntrada('x', serializarEntrada(d));
    expect(e).toEqual({ ...d, id: 'x', nome: 'Disp A' });
    expect(desserializarEntrada('y', serializarEntrada({})).ativo).toBe(true);
    expect(desserializarEntrada('y', serializarEntrada({})).palavrasChave).toEqual([]);
  });

  it('normaliza como a busca original (acento, caixa, vírgula, avula)', () => {
    expect(normalizarBusca('Ação AVULA 1,5')).toBe('acao avola 1.5');
    expect(normalizarBusca(undefined)).toBe('');
  });

  it('dá exatamente o mesmo resultado do filtro original em 3.000 dispositivos', () => {
    const lista = gerar(3000);
    const prep = prepararEntradas(lista, nomes);
    const consultas = ['', 'barra', 'AVULSA', 'avula', 'acao', 'Ação', '1,5', '1.5', 'daf0001', 'solda', 'família', 'chassi', 'xyz-nada', '  prensa  ', '0', 'montagem'];
    for (const q of consultas) {
      for (const cat of ['', 'c1', 'c3']) {
        for (const proc of ['', 'dobra', 'pinça']) {
          const esperado = filtroOriginal(lista, nomes, q, cat, proc).map(e => e.id);
          const obtido = filtrarEntradas(prep, { texto: q, categoriaId: cat, processo: proc }).map(e => e.id);
          expect(obtido).toEqual(esperado);
        }
      }
      // Autocomplete da Home (inclui peso)
      expect(filtrarEntradas(prep, { texto: q, incluirPeso: true }).map(e => e.id))
        .toEqual(filtroOriginal(lista, nomes, q, '', '', true).map(e => e.id));
    }
  });

  it('para no limite pedido', () => {
    const prep = prepararEntradas(gerar(500), nomes);
    expect(filtrarEntradas(prep, { texto: 'daf' }, 8)).toHaveLength(8);
  });

  it('distribui ids entre as partes de forma estável e equilibrada', () => {
    expect(parteDoId('abc', 7)).toBe(parteDoId('abc', 7));
    const partes = 14;
    const contagem = new Array(partes).fill(0);
    for (let i = 0; i < 20000; i++) contagem[parteDoId(`mocked-uuid-${i.toString(36)}`, partes)]++;
    const media = 20000 / partes;
    for (const c of contagem) expect(Math.abs(c - media) / media).toBeLessThan(0.15);
  });

  it('calcula partes suficientes para manter cada documento abaixo de 1 MiB', () => {
    expect(partesParaTotal(0)).toBe(4);
    expect(partesParaTotal(13400)).toBe(18);
    expect(partesParaTotal(19621)).toBe(27);
    expect(partesParaTotal(100000)).toBe(134);
    expect(partesParaTotal(10_000_000)).toBe(200);
    // Medido: ~200 bytes por entrada × 750 ≈ 150 KB por parte.
  });
});
