import { db } from '../datasources/firebase';
import { collection, doc, writeBatch, onSnapshot, setDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Dispositivo, CAMPOS_IMAGEM_DISPOSITIVO, chaveCodigoDispositivo } from '../../domain/entities/dispositivo';
import { Categoria } from '../../domain/entities/categoria';
import { Familia } from '../../domain/entities/familia';
import { Produto } from '../../domain/entities/produto';
import { storageService } from '../services/FirebaseStorageService';
import { IDispositivosRepository, ResultadoImportacaoLote } from '../../domain/repositories/IDispositivosRepository';

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
  ): Promise<ResultadoImportacaoLote> {
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

    // 2. Dispositivos: identidade = Código + Dispositivo (chaveCodigoDispositivo).
    // Um registro existente só é atualizado se tiver a MESMA combinação; mesmo
    // Código com outro Dispositivo (ou vice-versa) gera um documento novo.
    const dispSnapshot = await getDocs(collection(db, 'dispositivos'));
    const idPorChave = new Map<string, string>();
    for (const d of dispSnapshot.docs) {
      const data = d.data() as Dispositivo;
      const chave = chaveCodigoDispositivo(data.codigo, data.nome);
      if (!idPorChave.has(chave)) idPorChave.set(chave, d.id);
    }

    const resolverId = (valor: string | undefined, criados: Map<string, string>) => {
      if (!valor) return valor;
      if (criados.has(valor)) return criados.get(valor);
      for (const [nome, id] of criados.entries()) {
        if (nome.toLowerCase().trim() === valor.toLowerCase().trim()) return id;
      }
      return valor;
    };

    let batch = writeBatch(db);
    let pendentes: { novo: boolean }[] = [];
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const falhas: string[] = [];
    const criadosNestaImportacao = new Set<string>();

    // Falha num lote não interrompe os demais nem some: os registros do lote
    // entram em `erros`. Como a chave é idempotente, reimportar o mesmo arquivo
    // grava apenas o que faltou, sem duplicar.
    const commitLote = async () => {
      if (pendentes.length === 0) return;
      const lote = pendentes;
      pendentes = [];
      const atual = batch;
      batch = writeBatch(db);
      try {
        await atual.commit();
        for (const op of lote) {
          if (op.novo) inseridos++; else atualizados++;
        }
      } catch (error) {
        erros += lote.length;
        falhas.push(error instanceof Error ? error.message : String(error));
        console.error('Falha ao gravar lote de dispositivos:', error);
      }
    };

    for (const original of novosDispositivos) {
      const disp = { ...original };
      if (disp.categoriaId) disp.categoriaId = resolverId(disp.categoriaId, categoriasCriadas);
      if (disp.familiaId) disp.familiaId = resolverId(disp.familiaId, familiasCriadas);
      if (disp.produtoId) disp.produtoId = resolverId(disp.produtoId, produtosCriados);

      const chave = chaveCodigoDispositivo(disp.codigo, disp.nome);
      const existenteId = idPorChave.get(chave);
      const id = existenteId ?? uuidv4();
      // Mesma combinação repetida na própria lista reaproveita o documento.
      idPorChave.set(chave, id);
      if (!existenteId) criadosNestaImportacao.add(id);

      let dataToSave: Partial<Dispositivo>;
      if (existenteId && !criadosNestaImportacao.has(existenteId)) {
        // A planilha não traz imagens: campos de imagem vazios não podem apagar
        // as imagens já cadastradas no dispositivo existente.
        dataToSave = { ...disp };
        for (const campo of CAMPOS_IMAGEM_DISPOSITIVO) {
          if (!dataToSave[campo]) delete dataToSave[campo];
        }
      } else {
        dataToSave = { ...disp, id, dataCriacao: new Date().toISOString() };
      }

      batch.set(doc(db, 'dispositivos', id), dataToSave, { merge: true });
      pendentes.push({ novo: !existenteId });

      if (pendentes.length === 500) await commitLote();
    }
    await commitLote(); // último lote (incompleto)

    return { sucesso: inseridos + atualizados, erros, inseridos, atualizados, falhas };
  }
}
