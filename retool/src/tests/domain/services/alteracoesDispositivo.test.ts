import { alteraImagem, camposAlterados } from '../../../domain/services/alteracoesDispositivo';
import { Dispositivo } from '../../../domain/entities/dispositivo';

const original: Dispositivo = {
  id: 'd1',
  nome: 'Dispositivo 12',
  codigo: 'DMP00011',
  categoriaId: 'c1',
  peso: '1000',
  palavrasChave: ['solda', 'gabarito'],
  imagemPeca: 'https://img/peca.png',
  anexos: [{
    id: 'a1', originalName: 'manual.pdf', fileName: 'a1_manual.pdf', contentType: 'application/pdf',
    size: 10, storagePath: 'p/a1', downloadURL: 'https://x/a1', uploadedAt: '2026-01-01T00:00:00.000Z', categoria: 'documento_pdf'
  }],
  dataCriacao: '2026-01-01T00:00:00.000Z',
  chaveCD: 'dmp00011|dispositivo 12',
};

describe('camposAlterados', () => {
  it('formulário sem mudanças não grava nada', () => {
    // O formulário completa listas ausentes com [] e textos com ''.
    const editado = { ...original, observacoes: '', palavrasChave: [...original.palavrasChave!], anexos: original.anexos!.map(a => ({ ...a })) };
    expect(camposAlterados({ ...original, observacoes: undefined }, editado)).toEqual({});
  });

  it('devolve só os campos alterados', () => {
    const editado = { ...original, nome: 'Dispositivo 13', peso: '1200' };
    expect(camposAlterados(original, editado)).toEqual({ nome: 'Dispositivo 13', peso: '1200' });
  });

  it('não envia campos que outra pessoa mudou e o formulário não tocou', () => {
    // A imagem do dispositivo foi propagada depois da abertura do formulário:
    // como o formulário não a tem, ela não aparece no diff e não é apagada.
    const editado = { ...original, descricao: 'Nova descrição' };
    const r = camposAlterados(original, editado);
    expect(r).toEqual({ descricao: 'Nova descrição' });
    expect('imagemDispositivo' in r).toBe(false);
  });

  it('detecta campo apagado, lista alterada e anexo novo', () => {
    const novoAnexo = { ...original.anexos![0], id: 'a2', storagePath: 'p/a2' };
    const editado = {
      ...original,
      imagemPeca: '',
      palavrasChave: ['solda'],
      anexos: [...original.anexos!, novoAnexo],
    };
    const r = camposAlterados(original, editado);
    expect(r.imagemPeca).toBe('');
    expect(r.palavrasChave).toEqual(['solda']);
    expect(r.anexos).toHaveLength(2);
    expect(Object.keys(r).sort()).toEqual(['anexos', 'imagemPeca', 'palavrasChave']);
  });

  it('ignora id, dataCriacao, chaveCD e valores undefined', () => {
    const editado = { ...original, id: 'outro', dataCriacao: 'x', chaveCD: 'y', descricao: undefined };
    expect(camposAlterados(original, editado)).toEqual({});
  });

  it('sem original (documento não encontrado) devolve os campos preenchidos', () => {
    expect(camposAlterados(null, { nome: 'A', codigo: '' })).toEqual({ nome: 'A' });
  });
});

describe('alteraImagem', () => {
  it('só quando a alteração inclui a imagem do dispositivo (a da peça não é propagada)', () => {
    expect(alteraImagem({ nome: 'x' })).toBe(false);
    expect(alteraImagem({ imagemPeca: 'https://img' })).toBe(false);
    expect(alteraImagem({ imagemDispositivo: '' })).toBe(true);
    expect(alteraImagem({ imagemPeca: 'https://img', imagemDispositivo: 'https://d' })).toBe(true);
  });
});
