import { db } from '../datasources/firebase';
import { collection, doc, writeBatch, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Dispositivo } from '../../domain/entities/dispositivo';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';
import { storageService } from '../services/FirebaseStorageService';
import { IDispositivosRepository } from '../../domain/repositories/IDispositivosRepository';

export class FirestoreDispositivosRepository implements IDispositivosRepository {
  subscribeAll(callback: (dispositivos: Dispositivo[]) => void): () => void {
    return onSnapshot(collection(db, 'dispositivos'), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispositivo)));
    });
  }

  async add(data: Omit<Dispositivo, 'id' | 'dataCriacao'> & { id?: string }): Promise<string> {
    const id = data.id || uuidv4();
    const newDevice = { ...data, id, dataCriacao: new Date().toISOString() };
    await setDoc(doc(db, 'dispositivos', id), newDevice);
    return id;
  }

  async update(id: string, data: Partial<Dispositivo>): Promise<void> {
    await updateDoc(doc(db, 'dispositivos', id), data);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'dispositivos', id));
    await storageService.deleteFolder(`retool/dispositivos/${id}`);
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

    // 2. Processar dispositivos em lotes de 500
    let batch = writeBatch(db);
    let opCount = 0;
    let sucesso = 0;
    
    // Pegar dispositivos atuais para atualizar se existir
    let currentDispositivos: Dispositivo[] = [];
    const unsub = onSnapshot(collection(db, 'dispositivos'), (snapshot) => {
      currentDispositivos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispositivo));
    });
    // Wait briefly or query manually (to be safe and pure since onSnapshot is async, but we can query it)
    // Actually, since this runs in the context provider or we already have the state passed down, we don't need a new onSnapshot inside!
    // Wait, the parameter "novosDispositivos" can match against the "dispositivos" array in the db.
    // Let's pass the current devices from the call! Wait, can we? Let's check. Yes, it's already a parameter: we can add `currentDispositivos` as an argument or query it.
    // Let's look at the method signature:
    // importarLote(novosDispositivos, newCategoriasNomes, newFamiliasNomes, newProdutosNomes, categoriasExistentes, familiasExistentes, produtosExistentes)
    // Let's just fetch all devices once using a simple getDocs query or pass currentDispositivos from the UI.
    // Passing currentDispositivos from UI or another snapshot listener is very easy and aligns with current architecture. Let's update the signature to pass currentDispositivos as well!
    unsub(); // Clean up dummy onSnapshot

    // Wait! Let's get the list of current devices from the parameter or by querying. Let's query them using getDocs to make the repository call self-contained and not depend on UI state!
    // Yes, querying via getDocs is much cleaner and avoids passing large arrays from React state.
    // Wait, let's import getDocs and query from firebase.
    // Let's do that!
    
    const { getDocs } = await import('firebase/firestore');
    const dispSnapshot = await getDocs(collection(db, 'dispositivos'));
    const dbDispositivos = dispSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dispositivo));

    for (const disp of novosDispositivos) {
      if (disp.categoriaId) {
        if (categoriasCriadas.has(disp.categoriaId)) {
          disp.categoriaId = categoriasCriadas.get(disp.categoriaId);
        } else {
          let foundId = null;
          for (const [nomeCat, catId] of categoriasCriadas.entries()) {
            if (nomeCat.toLowerCase().trim() === disp.categoriaId.toLowerCase().trim()) {
              foundId = catId;
              break;
            }
          }
          if (foundId) disp.categoriaId = foundId;
        }
      }
      
      if (disp.familiaId) {
        if (familiasCriadas.has(disp.familiaId)) {
          disp.familiaId = familiasCriadas.get(disp.familiaId);
        } else {
          let foundId = null;
          for (const [nomeFam, famId] of familiasCriadas.entries()) {
            if (nomeFam.toLowerCase().trim() === disp.familiaId.toLowerCase().trim()) {
              foundId = famId;
              break;
            }
          }
          if (foundId) disp.familiaId = foundId;
        }
      }

      if (disp.produtoId) {
        if (produtosCriados.has(disp.produtoId)) {
          disp.produtoId = produtosCriados.get(disp.produtoId);
        } else {
          let foundId = null;
          for (const [nomeProd, prodId] of produtosCriados.entries()) {
            if (nomeProd.toLowerCase().trim() === disp.produtoId.toLowerCase().trim()) {
              foundId = prodId;
              break;
            }
          }
          if (foundId) disp.produtoId = foundId;
        }
      }

      let existingDisp = null;
      if (disp.codigo) {
        existingDisp = dbDispositivos.find(d => d.codigo === disp.codigo);
      }
      if (!existingDisp && disp.nome) {
        existingDisp = dbDispositivos.find(d => d.nome === disp.nome);
      }

      const docRef = existingDisp 
        ? doc(db, 'dispositivos', existingDisp.id)
        : doc(db, 'dispositivos', uuidv4());
        
      const dataToSave = existingDisp 
        ? { ...disp } 
        : { ...disp, dataCriacao: new Date().toISOString() };

      if (!existingDisp) {
        (dataToSave as any).id = docRef.id;
      }

      batch.set(docRef, dataToSave, { merge: true });
      opCount++;
      sucesso++;

      if (opCount === 500) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    return { sucesso, erros: 0 };
  }
}
