import { db } from '../datasources/firebase';
import { collection, doc, writeBatch, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Dispositivo } from '../../domain/entities/dispositivo';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';
import { IDispositivosRepository } from '../../domain/repositories/IDispositivosRepository';

export class FirestoreDispositivosRepository implements IDispositivosRepository {
  // Referência ao callback atual do listener para permitir pausar/retomar
  private _listenerCallback: ((dispositivos: Dispositivo[]) => void) | null = null;
  private _unsubscribe: (() => void) | null = null;

  subscribeAll(callback: (dispositivos: Dispositivo[]) => void): () => void {
    this._listenerCallback = callback;
    const unsub = onSnapshot(collection(db, 'dispositivos'), (snapshot) => {
      if (this._listenerCallback) {
        this._listenerCallback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispositivo)));
      }
    });
    this._unsubscribe = unsub;
    return () => {
      this._unsubscribe?.();
      this._listenerCallback = null;
      this._unsubscribe = null;
    };
  }

  /**
   * Pausa o listener em tempo real para evitar WebChannel 404 durante writes massivos.
   * O Firestore tenta entregar cada documento escrito em tempo real — com 472k docs
   * isso mata a conexão WebChannel. Pausar previne esse problema.
   */
  pauseListener(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  /**
   * Retoma o listener após uma operação em massa.
   * Dispara imediatamente um snapshot completo com o estado atual do banco.
   */
  resumeListener(): void {
    if (!this._listenerCallback) return;
    const cb = this._listenerCallback;
    const unsub = onSnapshot(collection(db, 'dispositivos'), (snapshot) => {
      if (this._listenerCallback) {
        this._listenerCallback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispositivo)));
      }
    });
    this._unsubscribe = unsub;
  }

  async add(data: Omit<Dispositivo, 'id' | 'dataCriacao'>): Promise<string> {
    const id = uuidv4();
    const newDevice = { ...data, id, dataCriacao: new Date().toISOString() };
    await setDoc(doc(db, 'dispositivos', id), newDevice);
    return id;
  }

  async update(id: string, data: Partial<Dispositivo>): Promise<void> {
    await updateDoc(doc(db, 'dispositivos', id), data);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'dispositivos', id));
  }

  /**
   * Deleta múltiplos dispositivos em lotes de 500 (limite do Firestore writeBatch).
   * Executa até 5 lotes em paralelo para maximizar a velocidade.
   * @param ids Lista de IDs a deletar
   * @param onProgress Callback opcional para rastrear progresso (quantos deletados até agora)
   */
  async deleteLote(
    ids: string[],
    onProgress?: (done: number) => void
  ): Promise<void> {
    const BATCH_SIZE = 500;
    const CONCURRENCY = 5; // lotes paralelos simultâneos

    // Monta os lotes de 500
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      chunks.push(ids.slice(i, i + BATCH_SIZE));
    }

    let totalDone = 0;

    // Pausa o listener para evitar WebChannel 404 durante writes massivos
    this.pauseListener();
    try {
      // Processa em grupos de CONCURRENCY lotes simultâneos
      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const group = chunks.slice(i, i + CONCURRENCY);

        await Promise.all(
          group.map(async (chunk) => {
            const batch = writeBatch(db);
            for (const id of chunk) {
              batch.delete(doc(db, 'dispositivos', id));
            }
            await batch.commit();
            totalDone += chunk.length;
            onProgress?.(totalDone);
          })
        );
      }
    } finally {
      // Retoma o listener — dispara um snapshot único com o estado final
      this.resumeListener();
    }
  }

  async importarLote(
    novosDispositivos: Partial<Dispositivo>[],
    newCategoriasNomes: string[],
    newFamiliasNomes: string[],
    newProdutosNomes: string[],
    categoriasExistentes: Categoria[],
    familiasExistentes: Familia[],
    produtosExistentes: Produto[]
  ): Promise<{ sucesso: number; erros: number }> {
    // 1. Criar novas entidades dinamicamente no Firestore
    const categoriasCriadas = new Map<string, string>(); // nome -> id
    const familiasCriadas = new Map<string, string>();
    const produtosCriados = new Map<string, string>();

    // A. Categorias
    if (newCategoriasNomes.length > 0) {
      let catBatch = writeBatch(db);
      let catCount = 0;
      
      for (const nomeCat of newCategoriasNomes) {
        const existingCat = categoriasExistentes.find(c => c.nome?.toLowerCase().trim() === nomeCat.toLowerCase().trim());
        if (existingCat) {
          categoriasCriadas.set(nomeCat, existingCat.id);
          continue;
        }

        let alreadyCreatedId = null;
        for (const [createdNome, createdId] of categoriasCriadas.entries()) {
          if (createdNome.toLowerCase().trim() === nomeCat.toLowerCase().trim()) {
            alreadyCreatedId = createdId;
            break;
          }
        }
        if (alreadyCreatedId) {
          categoriasCriadas.set(nomeCat, alreadyCreatedId);
          continue;
        }

        const catId = uuidv4();
        catBatch.set(doc(db, 'categorias', catId), {
          id: catId,
          nome: nomeCat,
          ativo: true
        });
        categoriasCriadas.set(nomeCat, catId);
        catCount++;
        
        if (catCount === 500) {
          await catBatch.commit();
          catBatch = writeBatch(db);
          catCount = 0;
        }
      }
      if (catCount > 0) await catBatch.commit();
    }

    // B. Famílias
    if (newFamiliasNomes.length > 0) {
      let famBatch = writeBatch(db);
      let famCount = 0;
      for (const nomeFam of newFamiliasNomes) {
        const existingFam = familiasExistentes.find(f => f.nome?.toLowerCase().trim() === nomeFam.toLowerCase().trim());
        if (existingFam) {
          familiasCriadas.set(nomeFam, existingFam.id);
          continue;
        }

        let alreadyCreatedId = null;
        for (const [createdNome, createdId] of familiasCriadas.entries()) {
          if (createdNome.toLowerCase().trim() === nomeFam.toLowerCase().trim()) {
            alreadyCreatedId = createdId;
            break;
          }
        }
        if (alreadyCreatedId) {
          familiasCriadas.set(nomeFam, alreadyCreatedId);
          continue;
        }

        const famId = uuidv4();
        famBatch.set(doc(db, 'familias', famId), { id: famId, nome: nomeFam, ativo: true });
        familiasCriadas.set(nomeFam, famId);
        famCount++;
        if (famCount === 500) { await famBatch.commit(); famBatch = writeBatch(db); famCount = 0; }
      }
      if (famCount > 0) await famBatch.commit();
    }

    // C. Produtos
    if (newProdutosNomes.length > 0) {
      let prodBatch = writeBatch(db);
      let prodCount = 0;
      for (const nomeProd of newProdutosNomes) {
        const existingProd = produtosExistentes.find(p => p.nome?.toLowerCase().trim() === nomeProd.toLowerCase().trim());
        if (existingProd) {
          produtosCriados.set(nomeProd, existingProd.id);
          continue;
        }

        let alreadyCreatedId = null;
        for (const [createdNome, createdId] of produtosCriados.entries()) {
          if (createdNome.toLowerCase().trim() === nomeProd.toLowerCase().trim()) {
            alreadyCreatedId = createdId;
            break;
          }
        }
        if (alreadyCreatedId) {
          produtosCriados.set(nomeProd, alreadyCreatedId);
          continue;
        }

        const prodId = uuidv4();
        prodBatch.set(doc(db, 'produtos', prodId), { id: prodId, nome: nomeProd, ativo: true });
        produtosCriados.set(nomeProd, prodId);
        prodCount++;
        if (prodCount === 500) { await prodBatch.commit(); prodBatch = writeBatch(db); prodCount = 0; }
      }
      if (prodCount > 0) await prodBatch.commit();
    }

    // 2. Processar dispositivos — pausa listener para evitar WebChannel 404
    this.pauseListener();
    try {
      let sucesso = 0;

      // Busca snapshot dos dispositivos atuais uma única vez (para upsert)
      const { getDocs } = await import('firebase/firestore');
      const dispSnapshot = await getDocs(collection(db, 'dispositivos'));
      const dbDispositivos = dispSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dispositivo));

      // Resolve IDs de categorias/famílias/produtos em cada dispositivo
      for (const disp of novosDispositivos) {
        if (disp.categoriaId) {
          if (categoriasCriadas.has(disp.categoriaId)) {
            disp.categoriaId = categoriasCriadas.get(disp.categoriaId);
          } else {
            for (const [nomeCat, catId] of categoriasCriadas.entries()) {
              if (nomeCat.toLowerCase().trim() === disp.categoriaId.toLowerCase().trim()) {
                disp.categoriaId = catId;
                break;
              }
            }
          }
        }

        if (disp.familiaId) {
          if (familiasCriadas.has(disp.familiaId)) {
            disp.familiaId = familiasCriadas.get(disp.familiaId);
          } else {
            for (const [nomeFam, famId] of familiasCriadas.entries()) {
              if (nomeFam.toLowerCase().trim() === disp.familiaId.toLowerCase().trim()) {
                disp.familiaId = famId;
                break;
              }
            }
          }
        }

        if (disp.produtoId) {
          if (produtosCriados.has(disp.produtoId)) {
            disp.produtoId = produtosCriados.get(disp.produtoId);
          } else {
            for (const [nomeProd, prodId] of produtosCriados.entries()) {
              if (nomeProd.toLowerCase().trim() === disp.produtoId.toLowerCase().trim()) {
                disp.produtoId = prodId;
                break;
              }
            }
          }
        }
      }

      // Prepara todos os documentos
      const BATCH_SIZE = 500;
      const CONCURRENCY = 5;

      // Divide em chunks de 500
      const chunks: Partial<Dispositivo>[][] = [];
      for (let i = 0; i < novosDispositivos.length; i += BATCH_SIZE) {
        chunks.push(novosDispositivos.slice(i, i + BATCH_SIZE));
      }

      // Processa em grupos de CONCURRENCY batches paralelos
      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const group = chunks.slice(i, i + CONCURRENCY);
        await Promise.all(
          group.map(async (chunk) => {
            const batch = writeBatch(db);
            for (const disp of chunk) {
              // Cada linha é um dispositivo único — sempre cria novo (sem upsert por código/nome)
              const newId = uuidv4();
              const docRef = doc(db, 'dispositivos', newId);
              batch.set(docRef, {
                ...disp,
                id: newId,
                dataCriacao: new Date().toISOString()
              });
            }
            await batch.commit();
            sucesso += chunk.length;
          })
        );
      }

      return { sucesso, erros: 0 };
    } finally {
      // Retoma o listener — dispara um único snapshot com o estado final
      this.resumeListener();
    }
  }
}
