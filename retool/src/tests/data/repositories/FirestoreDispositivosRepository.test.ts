import '../../mocks/firebaseMock';
import { FirestoreDispositivosRepository } from '../../../data/repositories/FirestoreDispositivosRepository';
import { mockDbState, resetMockDb } from '../../mocks/firebaseMock';
import { Categoria } from '../../../domain/entities/categoria';
import { Familia } from '../../../domain/entities/familia';
import { Produto } from '../../../domain/entities/produto';
import { Dispositivo, chaveCodigoDispositivo } from '../../../domain/entities/dispositivo';
import { prepararChavesImportacao, contarComChave } from '../../../data/repositories/importacaoDispositivosFirestore';
import { ProgressoImportacao } from '../../../domain/repositories/IDispositivosRepository';
import { describe, beforeEach, test, expect, jest } from '@jest/globals';

describe('FirestoreDispositivosRepository', () => {
  let repository: FirestoreDispositivosRepository;

  beforeEach(() => {
    resetMockDb();
    repository = new FirestoreDispositivosRepository();
  });

  test('should add a device with a new uuid and dataCriacao', async () => {
    const deviceData = { nome: 'New Device', codigo: 'COD1' };
    const id = await repository.add(deviceData);

    expect(id).toBeDefined();
    expect(mockDbState.dispositivos).toHaveLength(1);
    expect(mockDbState.dispositivos[0].nome).toBe('New Device');
    expect(mockDbState.dispositivos[0].id).toBe(id);
    expect(mockDbState.dispositivos[0].dataCriacao).toBeDefined();
  });

  test('should update a device', async () => {
    mockDbState.dispositivos.push({ id: 'd1', nome: 'Old Name', codigo: 'COD1' });
    await repository.update('d1', { nome: 'Updated Name' });

    expect(mockDbState.dispositivos[0].nome).toBe('Updated Name');
    expect(mockDbState.dispositivos[0].codigo).toBe('COD1');
  });

  test('chave Código + Dispositivo acompanha o cadastro e a edição', async () => {
    const id = await repository.add({ nome: ' Disp  A ', codigo: 'C1' } as any);
    const salvo = () => mockDbState.dispositivos.find((d: any) => d.id === id);
    expect(salvo().chaveCD).toBe(chaveCodigoDispositivo('c1', 'disp a'));

    // Com o documento atual: a chave é recalculada.
    await repository.update(id, { nome: 'Disp B' }, { ...salvo() });
    expect(salvo().chaveCD).toBe(chaveCodigoDispositivo('C1', 'Disp B'));
    // Alterar outro campo não mexe na chave; uma chave enviada pela tela é ignorada.
    await repository.update(id, { peso: '2', chaveCD: 'forjada' } as any, { ...salvo() });
    expect(salvo().chaveCD).toBe(chaveCodigoDispositivo('C1', 'Disp B'));
    // Sem o documento atual não dá para calcular: a chave sai (a importação volta a ler tudo).
    await repository.update(id, { codigo: 'C2' });
    expect(salvo().chaveCD).toBeUndefined();
  });

  test('should delete a device', async () => {
    mockDbState.dispositivos.push({ id: 'd1', nome: 'Device' });
    await repository.delete('d1');

    expect(mockDbState.dispositivos).toHaveLength(0);
  });

  test('should batch import devices and create missing categories/families/products case-insensitively', async () => {
    // DB starts with:
    // Categoria: "GABARITO"
    // Familia: "Corte"
    // Produto: "Avola 2500"
    mockDbState.categorias.push({ id: 'cat1', nome: 'GABARITO', ativo: true });
    mockDbState.familias.push({ id: 'fam1', nome: 'Corte', ativo: true });
    mockDbState.produtos.push({ id: 'prod1', nome: 'Avola 2500', ativo: true });

    // Existing devices in DB (should be queried inside importarLote)
    mockDbState.dispositivos.push({ id: 'disp1', nome: 'Disp Antigo', codigo: 'COD_EXISTENTE' });

    // Spreadsheet new items to create (missing list built by frontend):
    // 1. Categoria "FERRAMENTA DE CORTE" (new)
    // 2. Familia "Montagem" (new)
    // 3. Produto "Saw XP" (new)
    // Also "gabarito" (duplicate, but case-insensitive so it should reuse "cat1")
    const novosDispositivos: Partial<Dispositivo>[] = [
      {
        nome: 'Novo Disp 1',
        codigo: 'COD_NOVO_1',
        categoriaId: 'FERRAMENTA DE CORTE',
        familiaId: 'Montagem',
        produtoId: 'Saw XP'
      },
      {
        nome: 'Novo Disp 2',
        codigo: 'COD_NOVO_2',
        categoriaId: 'gabarito', // Case-insensitive matching should reuse existing cat1
        familiaId: 'corte',      // Case-insensitive matching should reuse existing fam1
        produtoId: 'avola 2500'  // Case-insensitive matching should reuse existing prod1
      },
      {
        nome: 'Disp Antigo',     // Matches name with disp1, should merge/update
        codigo: 'COD_EXISTENTE',
        categoriaId: 'cat1'
      }
    ];

    const result = await repository.importarLote(
      novosDispositivos,
      ['FERRAMENTA DE CORTE', 'gabarito'],
      ['Montagem', 'corte'],
      ['Saw XP', 'avola 2500'],
      mockDbState.categorias,
      mockDbState.familias,
      mockDbState.produtos
    );

    expect(result.sucesso).toBe(3);

    // Assert that new entities were created in mockDbState
    expect(mockDbState.categorias).toHaveLength(2); // "GABARITO" and "FERRAMENTA DE CORTE" (gabarito was reused!)
    expect(mockDbState.familias).toHaveLength(2); // "Corte" and "Montagem"
    expect(mockDbState.produtos).toHaveLength(2); // "Avola 2500" and "Saw XP"

    // Verify IDs mapped on created devices
    const createdDisp1 = mockDbState.dispositivos.find(d => d.codigo === 'COD_NOVO_1');
    expect(createdDisp1).toBeDefined();
    expect(createdDisp1.categoriaId).not.toBe('FERRAMENTA DE CORTE'); // Should be resolved to a uuid
    expect(createdDisp1.familiaId).not.toBe('Montagem');
    expect(createdDisp1.produtoId).not.toBe('Saw XP');

    const createdDisp2 = mockDbState.dispositivos.find(d => d.codigo === 'COD_NOVO_2');
    expect(createdDisp2).toBeDefined();
    expect(createdDisp2.categoriaId).toBe('cat1'); // Reused gabarito case-insensitively
    expect(createdDisp2.familiaId).toBe('fam1');   // Reused Corte
    expect(createdDisp2.produtoId).toBe('prod1');   // Reused Avola 2500

    const updatedDisp = mockDbState.dispositivos.find(d => d.codigo === 'COD_EXISTENTE');
    expect(updatedDisp).toBeDefined();
    expect(updatedDisp.id).toBe('disp1'); // Reused the same ID
    expect(updatedDisp.categoriaId).toBe('cat1');
  });

  test('should skip duplicate creations if they are already in the batch list case-insensitively', async () => {
    const result = await repository.importarLote(
      [
        { nome: 'D1', codigo: 'C1', categoriaId: 'Novo Gabarito', familiaId: 'Nova Familia', produtoId: 'Novo Produto' },
        { nome: 'D2', codigo: 'C2', categoriaId: 'novo gabarito', familiaId: 'nova familia', produtoId: 'novo produto' }
      ],
      ['Novo Gabarito', 'novo gabarito'],
      ['Nova Familia', 'nova familia'],
      ['Novo Produto', 'novo produto'],
      [],
      [],
      []
    );

    expect(result.sucesso).toBe(2);
    expect(mockDbState.categorias).toHaveLength(1); // Should only create 1 new category instead of 2
    expect(mockDbState.familias).toHaveLength(1);
    expect(mockDbState.produtos).toHaveLength(1);
  });

  describe('importarLote — chave Código + Dispositivo', () => {
    const importar = (lista: Partial<Dispositivo>[]) => repository.importarLote(lista, [], [], [], [], [], []);

    test('mesmo Código com Dispositivo diferente de um registro existente cria novo documento (não sobrescreve)', async () => {
      mockDbState.dispositivos.push({ id: 'disp1', codigo: 'ABC', nome: 'D01', imagemPeca: 'img.png' });

      const result = await importar([
        { codigo: 'ABC', nome: 'D02' },
        { codigo: 'ABC', nome: 'D03' },
        { codigo: 'XYZ', nome: 'D01' },
      ]);

      expect(result).toMatchObject({ sucesso: 3, inseridos: 3, atualizados: 0, erros: 0 });
      expect(mockDbState.dispositivos).toHaveLength(4);
      expect(mockDbState.dispositivos.find(d => d.id === 'disp1')).toMatchObject({ codigo: 'ABC', nome: 'D01' });
    });

    test('mesma combinação (ignorando caixa/espaços) atualiza o existente e preserva imagens', async () => {
      mockDbState.dispositivos.push({ id: 'disp1', codigo: 'ABC', nome: 'D01', descricao: 'antiga', imagemPeca: 'img.png' });

      const result = await importar([{ codigo: ' abc ', nome: 'd01', descricao: 'nova', imagemPeca: '', imagemDispositivo: '' }]);

      expect(result).toMatchObject({ sucesso: 1, inseridos: 0, atualizados: 1 });
      expect(mockDbState.dispositivos).toHaveLength(1);
      expect(mockDbState.dispositivos[0]).toMatchObject({ id: 'disp1', descricao: 'nova', imagemPeca: 'img.png' });
    });

    test('combinação repetida na própria lista reaproveita o mesmo documento', async () => {
      await importar([{ codigo: 'A', nome: '1' }, { codigo: 'a', nome: '1 ' }, { codigo: 'A', nome: '2' }]);
      expect(mockDbState.dispositivos).toHaveLength(2);
      for (const d of mockDbState.dispositivos) expect(d).toEqual(expect.objectContaining({ id: expect.any(String), dataCriacao: expect.any(String) }));
    });

    test('reprocessar o mesmo arquivo não duplica nem perde registros', async () => {
      const lista = Array.from({ length: 1200 }, (_, i) => ({ codigo: `C${i % 400}`, nome: `D${Math.floor(i / 400)}` }));
      const primeira = await importar(lista);
      const segunda = await importar(lista);
      expect(primeira).toMatchObject({ inseridos: 1200, atualizados: 0, erros: 0 });
      // Nada mudou: nenhuma escrita na segunda vez (economia de cota).
      expect(segunda).toMatchObject({ sucesso: 0, inseridos: 0, atualizados: 0, ignoradosSemAlteracao: 1200, erros: 0 });
      expect(mockDbState.dispositivos).toHaveLength(1200);
    });

    test('grava todos os lotes de 500, inclusive o último incompleto', async () => {
      const { writeBatch } = jest.requireMock('firebase/firestore') as { writeBatch: jest.Mock };
      writeBatch.mockClear();
      const lista = Array.from({ length: 1234 }, (_, i) => ({ codigo: `C${i}`, nome: 'D' }));
      const result = await importar(lista);
      expect(result).toMatchObject({ sucesso: 1234, erros: 0 });
      expect(mockDbState.dispositivos).toHaveLength(1234);
      const commits = writeBatch.mock.results
        .map(r => (r.value as { commit: jest.Mock }).commit.mock.calls.length)
        .reduce((a, b) => a + b, 0);
      expect(commits).toBe(3); // 500 + 500 + 234
    });

    test('falha num lote é reportada em erros (sem perda silenciosa) e os demais lotes continuam', async () => {
      const firestore = jest.requireMock('firebase/firestore') as { writeBatch: jest.Mock };
      const original = firestore.writeBatch.getMockImplementation()!;
      let chamadas = 0;
      firestore.writeBatch.mockImplementation((...args: unknown[]) => {
        const batch = original(...args) as { commit: jest.Mock };
        chamadas++;
        if (chamadas === 2) batch.commit.mockImplementation(async () => { throw new Error('DEADLINE_EXCEEDED'); });
        return batch;
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        const lista = Array.from({ length: 1100 }, (_, i) => ({ codigo: `C${i}`, nome: 'D' }));
        const result = await importar(lista);
        expect(result).toMatchObject({ sucesso: 600, erros: 500, falhas: ['DEADLINE_EXCEEDED'] });
        expect(mockDbState.dispositivos).toHaveLength(600);

        // Reimportar grava só o que faltou.
        firestore.writeBatch.mockImplementation(original);
        const retry = await importar(lista);
        expect(retry).toMatchObject({ inseridos: 500, atualizados: 0, ignoradosSemAlteracao: 600, erros: 0 });
        expect(mockDbState.dispositivos).toHaveLength(1100);
      } finally {
        firestore.writeBatch.mockImplementation(original);
        (console.error as jest.Mock).mockRestore();
      }
    });
  });

  describe('importarLote — desempenho, progresso, cancelamento e cota', () => {
    const firestore = () => jest.requireMock('firebase/firestore') as { writeBatch: jest.Mock; getDocs: jest.Mock };
    const lista = (n: number, peso = '1') => Array.from({ length: n }, (_, i) => ({ codigo: `C${String(i).padStart(5, '0')}`, nome: 'D', peso }));
    const commitsFeitos = () => firestore().writeBatch.mock.results
      .map(r => (r.value as { commit: jest.Mock }).commit.mock.calls.length)
      .reduce((a, b) => a + b, 0);

    test('reimportar sobre banco igual: 0 escritas, só leituras paginadas (páginas de 1000)', async () => {
      await repository.importarLote(lista(2500), [], [], [], [], [], []);
      firestore().writeBatch.mockClear();
      firestore().getDocs.mockClear();

      const r = await repository.importarLote(lista(2500), [], [], [], [], [], []);

      expect(r).toMatchObject({ sucesso: 0, inseridos: 0, atualizados: 0, ignoradosSemAlteracao: 2500, erros: 0, documentosLidos: 2500 });
      expect(r.interrompido).toBeUndefined();
      expect(commitsFeitos()).toBe(0);
      expect(firestore().getDocs).toHaveBeenCalledTimes(3); // 1000 + 1000 + 500
      expect(r.documentosFinais).toHaveLength(2500);
    });

    test('só os alterados e novos são gravados; documentosFinais reflete o estado final', async () => {
      await repository.importarLote(lista(1000), [], [], [], [], [], []);
      firestore().writeBatch.mockClear();
      const nova = lista(1200).map((d, i) => (i < 10 ? { ...d, peso: '2' } : d));

      const r = await repository.importarLote(nova, [], [], [], [], [], []);

      expect(r).toMatchObject({ inseridos: 200, atualizados: 10, ignoradosSemAlteracao: 990, sucesso: 210 });
      expect(commitsFeitos()).toBe(1); // 210 operações cabem num lote
      expect(r.documentosFinais).toHaveLength(1200);
      expect(r.documentosFinais!.find(d => d.codigo === 'C00000')).toMatchObject({ peso: '2' });
    });

    test('progresso real: lendo-existentes → gravando (lote / totalLotes) → concluido', async () => {
      mockDbState.dispositivos.push({ id: 'x1', codigo: 'Z', nome: 'Z' });
      const eventos: ProgressoImportacao[] = [];
      await repository.importarLote(lista(1234), [], [], [], [], [], [], {
        onProgresso: p => eventos.push({ ...p }),
      });

      // Indeterminada até o count() responder; depois, o total real do banco.
      expect(eventos[0]).toEqual({ etapa: 'lendo-existentes', feitos: 0, total: 0 });
      expect(eventos[1]).toEqual({ etapa: 'lendo-existentes', feitos: 0, total: 1 });
      expect(eventos).toContainEqual({ etapa: 'lendo-existentes', feitos: 1, total: 1 });
      const gravando = eventos.filter(e => e.etapa === 'gravando');
      expect(gravando.map(e => [e.feitos, e.lote, e.totalLotes])).toEqual([[0, 0, 3], [500, 1, 3], [1000, 2, 3], [1234, 3, 3]]);
      expect(gravando.every(e => e.total === 1234)).toBe(true);
      expect(eventos[eventos.length - 1]).toEqual({ etapa: 'concluido', feitos: 1234, total: 1234 });
    });

    // Documentos antigos (gravados antes da chave), com grafias que a busca exata por código não acha.
    const antigos = () => [
      { id: 'antigo-num', codigo: 12345, nome: 'D' },
      { id: 'antigo-caixa', codigo: 'abc-1', nome: 'Disp X' },
      { id: 'antigo-vazio', codigo: '', nome: 'Sem Código' },
      { id: 'antigo-espacos', codigo: '  X  1 ', nome: 'A' },
    ];
    const arquivoPequeno = () => [
      ...lista(10),                                      // iguais ao banco
      { codigo: '12345', nome: 'D', peso: '1' },         // mesmo que o código numérico
      { codigo: ' ABC-1 ', nome: 'disp  x', peso: '1' }, // mesma chave, outra grafia
      { codigo: '', nome: 'SEM CÓDIGO', peso: '1' },     // código vazio
      { codigo: 'x 1', nome: 'a', peso: '1' },           // espaços nas pontas e repetidos
      ...Array.from({ length: 5 }, (_, i) => ({ codigo: `NOVO${i}`, nome: 'D', peso: '1' })),
    ];
    const conferirSemDuplicar = (r: any) => {
      expect(r).toMatchObject({ inseridos: 5, ignoradosSemAlteracao: 10, erros: 0 });
      expect(mockDbState.dispositivos).toHaveLength(3004 + 5);
      // As linhas com outra grafia atualizaram os documentos antigos (peso novo), sem duplicar.
      for (const a of antigos()) {
        expect(mockDbState.dispositivos.find((d: any) => d.id === a.id)).toMatchObject({ peso: '1' });
      }
    };

    test('arquivo pequeno com dispositivos ainda sem a chave: lê o banco inteiro e não duplica', async () => {
      await repository.importarLote(lista(3000), [], [], [], [], [], []);
      mockDbState.dispositivos.push(...antigos());
      const r = await repository.importarLote(arquivoPequeno(), [], [], [], [], [], []);

      expect(r.leituraParcial).toBeFalsy();
      expect(r.documentosLidos).toBe(3004);
      conferirSemDuplicar(r);
    });

    test('arquivo pequeno com todos preparados: lê só os candidatos pela chave e não duplica', async () => {
      await repository.importarLote(lista(3000), [], [], [], [], [], []);
      mockDbState.dispositivos.push(...antigos());
      const prep = await prepararChavesImportacao(null, () => undefined);
      expect(prep).toMatchObject({ lidos: 3004, gravados: 4 });
      expect(prep.interrompido).toBeUndefined();

      const fs = jest.requireMock('firebase/firestore') as { getDocsFromServer: jest.Mock<any> };
      fs.getDocsFromServer.mockClear();
      const r = await repository.importarLote(arquivoPequeno(), [], [], [], [], [], []);

      expect(r.leituraParcial).toBe(true);
      expect(r.documentosFinais).toBeUndefined();
      // Só os candidatos (19 chaves = 1 consulta 'in'), não os 3.004.
      expect(fs.getDocsFromServer.mock.calls.length).toBeLessThan(5);
      expect(r.documentosLidos).toBe(14);
      conferirSemDuplicar(r);
      // Os novos já nascem com a chave: a próxima importação continua rápida.
      expect(mockDbState.dispositivos.every((d: any) => typeof d.chaveCD === 'string')).toBe(true);
    });

    test('preparo da chave: grava só os que faltam, retoma de onde parou e respeita o cancelamento', async () => {
      await repository.importarLote(lista(2500), [], [], [], [], [], []);
      // Sem chave e com chave desatualizada (nome alterado por uma versão antiga do app).
      for (const d of mockDbState.dispositivos.slice(0, 1200)) delete d.chaveCD;
      mockDbState.dispositivos[2400].nome = 'Renomeado';

      const ctl = new AbortController();
      const parcial = await prepararChavesImportacao(null, p => { if (p.lidos >= 1000) ctl.abort(); }, ctl.signal);
      expect(parcial).toMatchObject({ interrompido: 'cancelado', lidos: 1000 });
      expect(parcial.ultimoId).not.toBeNull();

      const resto = await prepararChavesImportacao(parcial.ultimoId, () => undefined);
      expect(resto.interrompido).toBeUndefined();
      expect(resto.lidos).toBe(1500);
      expect(parcial.gravados + resto.gravados).toBe(1201);
      for (const d of mockDbState.dispositivos) {
        expect(d.chaveCD).toBe(chaveCodigoDispositivo(d.codigo, d.nome));
      }
      expect(await contarComChave()).toBe(2500);
      // Rodar de novo não grava nada.
      expect(await prepararChavesImportacao(null, () => undefined)).toMatchObject({ lidos: 2500, gravados: 0 });
    });

    test('leitura dos existentes incompleta: lê de novo; se ainda faltar, não grava nada', async () => {
      const existentes = lista(1200);
      await repository.importarLote(existentes, [], [], [], [], [], []);
      expect(mockDbState.dispositivos).toHaveLength(1200);

      const fs = jest.requireMock('firebase/firestore') as { getDocsFromServer: jest.Mock<any> };
      const original = fs.getDocsFromServer.getMockImplementation()!;
      // Toda leitura devolve uma página curta (como uma resposta truncada ou o cache sem conexão).
      fs.getDocsFromServer.mockImplementation(async (q: any) => {
        const r: any = await original(q);
        const docs = r.docs.slice(0, 198);
        return { docs, size: docs.length, empty: docs.length === 0 };
      });
      try {
        await expect(repository.importarLote(lista(1500), [], [], [], [], [], []))
          .rejects.toThrow(/incompleta \(198 de 1\.200\)/);
        expect(mockDbState.dispositivos).toHaveLength(1200); // nenhuma duplicata gravada

        // Falha só na primeira tentativa: a segunda leitura completa segue normalmente.
        let chamadas = 0;
        fs.getDocsFromServer.mockImplementation(async (q: any) => {
          const r: any = await original(q);
          if (chamadas++ > 0) return r;
          const docs = r.docs.slice(0, 198);
          return { docs, size: docs.length, empty: docs.length === 0 };
        });
        const r = await repository.importarLote(lista(1500), [], [], [], [], [], []);
        expect(r).toMatchObject({ inseridos: 300, ignoradosSemAlteracao: 1200 });
        expect(mockDbState.dispositivos).toHaveLength(1500);
      } finally {
        fs.getDocsFromServer.mockImplementation(original);
      }
    });

    test('cancelamento entre lotes: para, informa naoGravados e o já gravado fica', async () => {
      const controle = new AbortController();
      const r = await repository.importarLote(lista(1500), [], [], [], [], [], [], {
        sinal: controle.signal,
        onProgresso: p => { if (p.etapa === 'gravando' && p.lote === 1) controle.abort(); },
      });

      expect(r).toMatchObject({ interrompido: 'cancelado', sucesso: 500, inseridos: 500, naoGravados: 1000, erros: 0 });
      expect(mockDbState.dispositivos).toHaveLength(500);
      expect(r.documentosFinais).toHaveLength(500);

      // Reimportar completa sem duplicar e sem regravar os 500.
      const retry = await repository.importarLote(lista(1500), [], [], [], [], [], []);
      expect(retry).toMatchObject({ inseridos: 1000, ignoradosSemAlteracao: 500 });
      expect(mockDbState.dispositivos).toHaveLength(1500);
    });

    test('cancelado antes de começar: nenhuma leitura nem escrita', async () => {
      const controle = new AbortController();
      controle.abort();
      firestore().getDocs.mockClear();
      firestore().writeBatch.mockClear();
      const r = await repository.importarLote(lista(10), [], [], [], [], [], [], { sinal: controle.signal });
      expect(r).toMatchObject({ interrompido: 'cancelado', sucesso: 0, naoGravados: 10 });
      expect(firestore().getDocs).not.toHaveBeenCalled();
      expect(commitsFeitos()).toBe(0);
    });

    test('cota esgotada (resource-exhausted): para no lote recusado, sem tentar os seguintes', async () => {
      const original = firestore().writeBatch.getMockImplementation()!;
      let chamadas = 0;
      const commitsTentados: number[] = [];
      firestore().writeBatch.mockImplementation((...args: unknown[]) => {
        const batch = original(...args) as { commit: jest.Mock };
        const n = ++chamadas;
        const commitOriginal = batch.commit.getMockImplementation()!;
        batch.commit.mockImplementation(async () => {
          commitsTentados.push(n);
          if (n === 2) throw Object.assign(new Error('Quota exceeded.'), { code: 'resource-exhausted' });
          return commitOriginal();
        });
        return batch;
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const r = await repository.importarLote(lista(2000), [], [], [], [], [], []);
        expect(r).toMatchObject({ interrompido: 'cota', sucesso: 500, naoGravados: 1500, erros: 0 });
        expect(r.falhas).toEqual(['Quota exceeded.']);
        expect(commitsTentados).toEqual([1, 2]); // não insiste nos lotes 3 e 4
        expect(mockDbState.dispositivos).toHaveLength(500);
      } finally {
        firestore().writeBatch.mockImplementation(original);
        (console.error as jest.Mock).mockRestore();
      }
    });

    test('cota esgotada já na leitura dos existentes: nada é gravado', async () => {
      mockDbState.dispositivos.push({ id: 'x1', codigo: 'Z', nome: 'Z' });
      firestore().getDocs.mockImplementationOnce(async () => { throw Object.assign(new Error('quota'), { code: 'resource-exhausted' }); });
      firestore().writeBatch.mockClear();
      const r = await repository.importarLote(lista(10), [], [], [], [], [], []);
      expect(r).toMatchObject({ interrompido: 'cota', sucesso: 0, naoGravados: 10 });
      expect(commitsFeitos()).toBe(0);
      expect(mockDbState.dispositivos).toHaveLength(1);
    });
  });

  test('excluirEmLote remove todos os ids em lotes de 500 (inclusive o último)', async () => {
    for (let i = 0; i < 1203; i++) mockDbState.dispositivos.push({ id: `d${i}`, codigo: 'A', nome: String(i) });
    const ids = Array.from({ length: 1201 }, (_, i) => `d${i}`);
    const result = await repository.excluirEmLote(ids);
    expect(result).toEqual({ excluidos: 1201, erros: 0, falhas: [] });
    expect(mockDbState.dispositivos.map(d => d.id)).toEqual(['d1201', 'd1202']);
  });
});
