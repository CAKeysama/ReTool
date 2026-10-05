import { db } from '../datasources/firebase';
import { doc, writeBatch, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Dispositivo } from '../../domain/entities/dispositivo';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';
import { IDispositivosRepository, OpcoesImportacaoLote, ResultadoImportacaoLote } from '../../domain/repositories/IDispositivosRepository';
import { importarLoteFirestore } from './importacaoDispositivosFirestore';
import { MetaIndice, registrarNoIndice } from './FirestoreIndiceDispositivos';

// O Storage só é carregado quando um dispositivo é excluído (fora do bundle inicial).
const apagarPastaDoDispositivo = async (id: string) => {
  const { storageService } = await import('../services/FirebaseStorageService');
  await storageService.deleteFolder(`retool/dispositivos/${id}`);
};

/** Itens por writeBatch nas operações em massa: cada item gera até 3 escritas (documento, auditoria, índice) e o limite é 500. */
export const ITENS_POR_LOTE_EM_MASSA = 150;

/**
 * Escrita de dispositivos. Quando o catálogo de busca existe (`meta`), o
 * documento e sua entrada no catálogo são gravados no MESMO writeBatch.
 * Leituras ficam em FirestoreDispositivosConsultas.ts.
 */
export class FirestoreDispositivosRepository implements IDispositivosRepository {
  async add(data: Omit<Dispositivo, 'id' | 'dataCriacao'> & { id?: string }, meta: MetaIndice | null = null): Promise<string> {
    const id = data.id || uuidv4();
    const newDevice = { ...data, id, dataCriacao: new Date().toISOString() };
    if (!meta) {
      await setDoc(doc(db, 'dispositivos', id), newDevice);
      return id;
    }
    const b = writeBatch(db);
    b.set(doc(db, 'dispositivos', id), newDevice);
    registrarNoIndice(b, meta, [{ id, dados: newDevice, novo: true }]);
    await b.commit();
    return id;
  }

  /** `atual` (documento antes da alteração) é necessário para manter o catálogo completo. */
  async update(id: string, data: Partial<Dispositivo>, atual: Dispositivo | null = null, meta: MetaIndice | null = null): Promise<void> {
    if (!meta || !atual) {
      await updateDoc(doc(db, 'dispositivos', id), data);
      return;
    }
    const b = writeBatch(db);
    b.update(doc(db, 'dispositivos', id), data);
    registrarNoIndice(b, meta, [{ id, dados: { ...atual, ...data } }]);
    await b.commit();
  }

  /** Exclui o dispositivo, as reutilizações informadas e a entrada do catálogo de uma só vez. */
  async delete(id: string, reutilizacaoIds: string[] = [], meta: MetaIndice | null = null): Promise<void> {
    if (!meta && reutilizacaoIds.length === 0) {
      await deleteDoc(doc(db, 'dispositivos', id));
    } else {
      const b = writeBatch(db);
      b.delete(doc(db, 'dispositivos', id));
      for (const r of reutilizacaoIds) b.delete(doc(db, 'reutilizacoes', r));
      registrarNoIndice(b, meta, [{ id, dados: null }]);
      await b.commit();
    }
    await apagarPastaDoDispositivo(id);
  }

  /**
   * Altera vários dispositivos em lotes (ex.: desativar em massa).
   * `extras(batch, item)` permite gravar a auditoria no mesmo lote.
   */
  async atualizarEmLote(
    atuais: Dispositivo[],
    patch: Partial<Dispositivo>,
    meta: MetaIndice | null,
    extras?: (b: ReturnType<typeof writeBatch>, d: Dispositivo) => void,
    onProgresso?: (feitos: number, total: number) => void
  ): Promise<{ sucesso: number; erros: number; falhas: string[] }> {
    let sucesso = 0, erros = 0;
    const falhas: string[] = [];
    for (let i = 0; i < atuais.length; i += ITENS_POR_LOTE_EM_MASSA) {
      const lote = atuais.slice(i, i + ITENS_POR_LOTE_EM_MASSA);
      const b = writeBatch(db);
      for (const d of lote) {
        b.update(doc(db, 'dispositivos', d.id), patch);
        extras?.(b, d);
      }
      registrarNoIndice(b, meta, lote.map(d => ({ id: d.id, dados: { ...d, ...patch } })));
      try {
        await b.commit();
        sucesso += lote.length;
      } catch (error) {
        erros += lote.length;
        falhas.push(error instanceof Error ? error.message : String(error));
        if ((error as { code?: string })?.code === 'resource-exhausted') { erros += atuais.length - i - lote.length; break; }
      }
      onProgresso?.(Math.min(atuais.length, i + lote.length), atuais.length);
    }
    return { sucesso, erros, falhas };
  }

  /**
   * Exclusão em massa com cascata: cada dispositivo sai junto com suas
   * reutilizações e sua entrada no catálogo, em lotes. Pastas de anexos são
   * apagadas depois, em segundo plano (3 por vez), sem segurar o retorno.
   */
  async excluirComVinculosEmLote(
    itens: { dispositivo: Dispositivo; reutilizacaoIds: string[] }[],
    meta: MetaIndice | null,
    extras?: (b: ReturnType<typeof writeBatch>, d: Dispositivo) => void,
    onProgresso?: (feitos: number, total: number) => void
  ): Promise<{ excluidos: number; erros: number; falhas: string[] }> {
    let excluidos = 0, erros = 0;
    const falhas: string[] = [];
    const apagados: string[] = [];
    let i = 0;
    while (i < itens.length) {
      // Monta um lote respeitando o limite de 500 escritas por commit.
      const b = writeBatch(db);
      const lote: typeof itens = [];
      // meta + no máximo uma operação por parte do índice tocada
      let escritas = meta ? Math.min(meta.partes, ITENS_POR_LOTE_EM_MASSA) + 1 : 0;
      while (i < itens.length && lote.length < ITENS_POR_LOTE_EM_MASSA) {
        const custo = 3 + itens[i].reutilizacaoIds.length;
        if (lote.length && escritas + custo > 480) break;
        lote.push(itens[i]); escritas += custo; i++;
      }
      for (const it of lote) {
        b.delete(doc(db, 'dispositivos', it.dispositivo.id));
        for (const r of it.reutilizacaoIds) b.delete(doc(db, 'reutilizacoes', r));
        extras?.(b, it.dispositivo);
      }
      registrarNoIndice(b, meta, lote.map(it => ({ id: it.dispositivo.id, dados: null })));
      try {
        await b.commit();
        excluidos += lote.length;
        apagados.push(...lote.map(it => it.dispositivo.id));
      } catch (error) {
        erros += lote.length;
        falhas.push(error instanceof Error ? error.message : String(error));
        if ((error as { code?: string })?.code === 'resource-exhausted') { erros += itens.length - i; break; }
      }
      onProgresso?.(excluidos + erros, itens.length);
    }
    // Os anexos saem em segundo plano: a exclusão já foi gravada e a tela não
    // precisa esperar o Storage (pode levar minutos com milhares de pastas).
    void (async () => {
      for (let j = 0; j < apagados.length; j += 3) {
        await Promise.all(apagados.slice(j, j + 3).map(id => apagarPastaDoDispositivo(id).catch(() => undefined)));
      }
    })();
    return { excluidos, erros, falhas };
  }

  importarLote(
    novosDispositivos: Partial<Dispositivo>[],
    newCategoriasNomes: string[],
    newFamiliasNomes: string[],
    newProdutosNomes: string[],
    categoriasExistentes: Categoria[],
    familiasExistentes: Familia[],
    produtosExistentes: Produto[],
    opcoes?: OpcoesImportacaoLote
  ): Promise<ResultadoImportacaoLote> {
    return importarLoteFirestore(
      novosDispositivos, newCategoriasNomes, newFamiliasNomes, newProdutosNomes,
      categoriasExistentes, familiasExistentes, produtosExistentes, opcoes
    );
  }

  async excluirEmLote(ids: string[], meta: MetaIndice | null = null): Promise<{ excluidos: number; erros: number; falhas: string[] }> {
    let excluidos = 0;
    let erros = 0;
    const falhas: string[] = [];
    // Com o catálogo, cada exclusão também remove a entrada (1 escrita a mais por item + a meta).
    const porLote = meta ? 240 : 500;
    for (let i = 0; i < ids.length; i += porLote) {
      const lote = ids.slice(i, i + porLote);
      const batch = writeBatch(db);
      for (const id of lote) batch.delete(doc(db, 'dispositivos', id));
      registrarNoIndice(batch, meta, lote.map(id => ({ id, dados: null })));
      try {
        await batch.commit();
        excluidos += lote.length;
      } catch (error) {
        erros += lote.length;
        falhas.push(error instanceof Error ? error.message : String(error));
        console.error('Falha ao excluir lote de dispositivos:', error);
      }
    }
    return { excluidos, erros, falhas };
  }
}
