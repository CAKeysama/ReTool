import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

export interface Categoria {
  id: string;
  nome?: string;
  ativo?: boolean;
}

export interface Tipo {
  id: string;
  nome: string;
  ativo?: boolean;
}

export interface Familia {
  id: string;
  nome: string;
  ativo?: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  ativo?: boolean;
}

export interface Dispositivo {
  id: string;
  nome?: string;
  codigo?: string;
  categoriaId?: string;
  peso?: string;
  familiaId?: string;
  descricao?: string;
  observacoes?: string;
  produtoId?: string;
  palavrasChave?: string[];
  imagemPeca?: string;
  imagemDispositivo?: string;
  dataCriacao?: string;
}

export interface Utilizacao {
  id: string;
  dispositivoId: string;
  descricao?: string;
  setor?: string;
  observacoes?: string;
  dataCriacao?: string;
}

interface ReToolContextType {
  dispositivos: Dispositivo[];
  categorias: Categoria[];
  tipos: Tipo[];
  familias: Familia[];
  produtos: Produto[];
  utilizacoes: Utilizacao[];
  addDispositivo: (data: Omit<Dispositivo, 'id' | 'dataCriacao'>) => void;
  updateDispositivo: (id: string, data: Partial<Dispositivo>) => void;
  deleteDispositivo: (id: string) => void;
  addCategoria: (data: Omit<Categoria, 'id'>) => Promise<string>;
  updateCategoria: (id: string, data: Partial<Categoria>) => void;
  deleteCategoria: (id: string) => void;
  addTipo: (data: Omit<Tipo, 'id'>) => void;
  updateTipo: (id: string, data: Partial<Tipo>) => void;
  deleteTipo: (id: string) => void;
  addFamilia: (data: Omit<Familia, 'id'>) => Promise<string>;
  updateFamilia: (id: string, data: Partial<Familia>) => void;
  deleteFamilia: (id: string) => void;
  addProduto: (data: Omit<Produto, 'id'>) => Promise<string>;
  updateProduto: (id: string, data: Partial<Produto>) => void;
  deleteProduto: (id: string) => void;
  addUtilizacao: (data: Omit<Utilizacao, 'id' | 'dataCriacao'>) => void;
  updateUtilizacao: (id: string, data: Partial<Utilizacao>) => void;
  deleteUtilizacao: (id: string) => void;
  importarDispositivosEmLote: (novosDispositivos: Partial<Dispositivo>[], newCategoriasNomes: string[], newFamiliasNomes: string[], newProdutosNomes: string[]) => Promise<{ sucesso: number, erros: number }>;
  deleteAllData: () => Promise<void>;
  announce: (message: string, showToast?: boolean) => void;
  announcement: string;
  isDispFormOpen: boolean;
  editingDispId: string | null;
  openDispForm: (id?: string) => void;
  closeDispForm: () => void;
}

const ReToolContext = createContext<ReToolContextType | undefined>(undefined);

export const ReToolProvider = ({ children }: { children: ReactNode }) => {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [utilizacoes, setUtilizacoes] = useState<Utilizacao[]>([]);

  const [announcement, setAnnouncement] = useState('');
  const [toasts, setToasts] = useState<{id: string; text: string}[]>([]);

  const [isDispFormOpen, setIsDispFormOpen] = useState(false);
  const [editingDispId, setEditingDispId] = useState<string | null>(null);

  const openDispForm = useCallback((id?: string) => {
    setEditingDispId(id || null);
    setIsDispFormOpen(true);
  }, []);

  const closeDispForm = useCallback(() => {
    setIsDispFormOpen(false);
    setEditingDispId(null);
  }, []);

  const announce = useCallback((message: string, showToast = true) => {
    setAnnouncement('');
    setTimeout(() => setAnnouncement(message), 50); 
    
    if (showToast) {
      const id = uuidv4();
      setToasts(prev => [...prev, { id, text: message }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3500);
    }
  }, []);

  useEffect(() => {
    const unsubCat = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Categoria)));
    });
    
    const unsubDisp = onSnapshot(collection(db, 'dispositivos'), (snapshot) => {
      setDispositivos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispositivo)));
    });

    const unsubTipos = onSnapshot(collection(db, 'tipos'), (snapshot) => {
      setTipos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tipo)));
    });

    const unsubUtil = onSnapshot(collection(db, 'utilizacoes'), (snapshot) => {
      setUtilizacoes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Utilizacao)));
    });

    const unsubFam = onSnapshot(collection(db, 'familias'), (snapshot) => {
      setFamilias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Familia)).sort((a, b) => a.nome.localeCompare(b.nome)));
    });

    const unsubProd = onSnapshot(collection(db, 'produtos'), (snapshot) => {
      setProdutos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Produto)).sort((a, b) => a.nome.localeCompare(b.nome)));
    });

    return () => {
      unsubCat();
      unsubDisp();
      unsubTipos();
      unsubUtil();
      unsubFam();
      unsubProd();
    };
  }, []);

  const addDispositivo = async (data: Omit<Dispositivo, 'id' | 'dataCriacao'>) => {
    const id = uuidv4();
    const nova = { ...data, id, dataCriacao: new Date().toISOString() };
    await setDoc(doc(db, 'dispositivos', id), nova);
    announce('Dispositivo adicionado com sucesso');
  };

  const updateDispositivo = async (id: string, data: Partial<Dispositivo>) => {
    await updateDoc(doc(db, 'dispositivos', id), data);
    announce('Dispositivo atualizado com sucesso');
  };

  const deleteDispositivo = async (id: string) => {
    await deleteDoc(doc(db, 'dispositivos', id));
    
    const relacoes = utilizacoes.filter(u => u.dispositivoId === id);
    if (relacoes.length > 0) {
      const batch = writeBatch(db);
      relacoes.forEach(u => {
        batch.delete(doc(db, 'utilizacoes', u.id));
      });
      await batch.commit();
    }
    announce('Dispositivo removido com sucesso');
  };

  const addCategoria = async (data: Omit<Categoria, 'id'>) => {
    const id = uuidv4();
    await setDoc(doc(db, 'categorias', id), { ...data, id });
    announce('Categoria adicionada com sucesso');
    return id;
  };

  const updateCategoria = async (id: string, data: Partial<Categoria>) => {
    await updateDoc(doc(db, 'categorias', id), data);
    announce('Categoria atualizada com sucesso');
  };

  const deleteCategoria = async (id: string) => {
    await deleteDoc(doc(db, 'categorias', id));
    announce('Categoria removida com sucesso');
  };

  const addTipo = async (data: Omit<Tipo, 'id'>) => {
    const id = uuidv4();
    await setDoc(doc(db, 'tipos', id), { ...data, id });
    announce('Tipo adicionado com sucesso');
  };

  const updateTipo = async (id: string, data: Partial<Tipo>) => {
    await updateDoc(doc(db, 'tipos', id), data);
    announce('Tipo atualizado com sucesso');
  };

  const deleteTipo = async (id: string) => {
    await deleteDoc(doc(db, 'tipos', id));
    announce('Tipo removido com sucesso');
  };

  const addFamilia = async (data: Omit<Familia, 'id'>) => {
    const id = uuidv4();
    await setDoc(doc(db, 'familias', id), { ...data, id });
    announce('Família adicionada com sucesso');
    return id;
  };

  const updateFamilia = async (id: string, data: Partial<Familia>) => {
    await updateDoc(doc(db, 'familias', id), data);
    announce('Família atualizada com sucesso');
  };

  const deleteFamilia = async (id: string) => {
    await deleteDoc(doc(db, 'familias', id));
    announce('Família removida com sucesso');
  };

  const addProduto = async (data: Omit<Produto, 'id'>) => {
    const id = uuidv4();
    await setDoc(doc(db, 'produtos', id), { ...data, id });
    announce('Produto adicionado com sucesso');
    return id;
  };

  const updateProduto = async (id: string, data: Partial<Produto>) => {
    await updateDoc(doc(db, 'produtos', id), data);
    announce('Produto atualizado com sucesso');
  };

  const deleteProduto = async (id: string) => {
    await deleteDoc(doc(db, 'produtos', id));
    announce('Produto removido com sucesso');
  };

  const addUtilizacao = async (data: Omit<Utilizacao, 'id' | 'dataCriacao'>) => {
    const id = uuidv4();
    await setDoc(doc(db, 'utilizacoes', id), { ...data, id, dataCriacao: new Date().toISOString() });
    announce('Utilização adicionada com sucesso');
  };

  const updateUtilizacao = async (id: string, data: Partial<Utilizacao>) => {
    await updateDoc(doc(db, 'utilizacoes', id), data);
    announce('Utilização atualizada com sucesso');
  };

  const deleteUtilizacao = async (id: string) => {
    await deleteDoc(doc(db, 'utilizacoes', id));
    announce('Utilização removida com sucesso');
  };

  const importarDispositivosEmLote = async (novosDispositivos: Partial<Dispositivo>[], newCategoriasNomes: string[], newFamiliasNomes: string[], newProdutosNomes: string[]) => {
    try {
      // 1. Criar novas entidades dinamicamente
      const categoriasCriadas = new Map<string, string>(); // nome -> id
      const familiasCriadas = new Map<string, string>();
      const produtosCriados = new Map<string, string>();

      if (newCategoriasNomes.length > 0) {
        let catBatch = writeBatch(db);
        let catCount = 0;
        
        for (const nomeCat of newCategoriasNomes) {
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

      if (newFamiliasNomes.length > 0) {
        let famBatch = writeBatch(db);
        let famCount = 0;
        for (const nomeFam of newFamiliasNomes) {
          const famId = uuidv4();
          famBatch.set(doc(db, 'familias', famId), { id: famId, nome: nomeFam, ativo: true });
          familiasCriadas.set(nomeFam, famId);
          famCount++;
          if (famCount === 500) { await famBatch.commit(); famBatch = writeBatch(db); famCount = 0; }
        }
        if (famCount > 0) await famBatch.commit();
      }

      if (newProdutosNomes.length > 0) {
        let prodBatch = writeBatch(db);
        let prodCount = 0;
        for (const nomeProd of newProdutosNomes) {
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
      
      for (const disp of novosDispositivos) {
        // Mapear Nomes Dinâmicos para IDs criados
        if (disp.categoriaId && categoriasCriadas.has(disp.categoriaId)) {
          disp.categoriaId = categoriasCriadas.get(disp.categoriaId);
        }
        if (disp.familiaId && familiasCriadas.has(disp.familiaId)) {
          disp.familiaId = familiasCriadas.get(disp.familiaId);
        }
        if (disp.produtoId && produtosCriados.has(disp.produtoId)) {
          disp.produtoId = produtosCriados.get(disp.produtoId);
        }

        // Tenta encontrar existente pelo código ou pelo nome
        let existingDisp = null;
        if (disp.codigo) {
          existingDisp = dispositivos.find(d => d.codigo === disp.codigo);
        }
        if (!existingDisp && disp.nome) {
          existingDisp = dispositivos.find(d => d.nome === disp.nome);
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

      announce(`Importação concluída! ${sucesso} registros inseridos ou atualizados.`);
      return { sucesso, erros: 0 };
    } catch (error) {
      console.error('Erro na importação em lote:', error);
      announce('Erro ao processar importação em lote.');
      return { sucesso: 0, erros: novosDispositivos.length };
    }
  };

  const deleteAllData = async () => {
    try {
      const allDocs = [
        ...dispositivos.map(d => ({ col: 'dispositivos', id: d.id })),
        ...categorias.map(c => ({ col: 'categorias', id: c.id })),
        ...tipos.map(t => ({ col: 'tipos', id: t.id })),
        ...familias.map(f => ({ col: 'familias', id: f.id })),
        ...produtos.map(p => ({ col: 'produtos', id: p.id })),
        ...utilizacoes.map(u => ({ col: 'utilizacoes', id: u.id }))
      ];

      let batch = writeBatch(db);
      let opCount = 0;
      
      for (const docInfo of allDocs) {
        batch.delete(doc(db, docInfo.col, docInfo.id));
        opCount++;
        
        if (opCount === 500) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
      
      if (opCount > 0) {
        await batch.commit();
      }
      
      announce('Banco de dados completamente limpo com sucesso.');
    } catch (error) {
      console.error('Erro ao limpar banco de dados:', error);
      announce('Erro ao tentar limpar o banco de dados.');
    }
  };

  return (
    <ReToolContext.Provider value={{
      dispositivos, categorias, tipos, familias, produtos, utilizacoes,
      addDispositivo, updateDispositivo, deleteDispositivo,
      addCategoria, updateCategoria, deleteCategoria,
      addTipo, updateTipo, deleteTipo,
      addFamilia, updateFamilia, deleteFamilia,
      addProduto, updateProduto, deleteProduto,
      addUtilizacao, updateUtilizacao, deleteUtilizacao,
      importarDispositivosEmLote, deleteAllData,
      announce, announcement,
      isDispFormOpen, editingDispId, openDispForm, closeDispForm
    }}>
      {children}
      
      {/* Container Global de Toasts */}
      <div 
        aria-hidden="true"
        style={{
          position: 'fixed',
          bottom: 'var(--spacing-xl)',
          right: 'var(--spacing-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 9999,
          pointerEvents: 'none'
        }}
      >
        {toasts.map(t => (
          <div key={t.id} className="toast-notification" style={{
            backgroundColor: '#1f2937',
            color: 'white',
            padding: '12px 24px',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
            {t.text}
          </div>
        ))}
      </div>
    </ReToolContext.Provider>
  );
};

export const useReTool = () => {
  const context = useContext(ReToolContext);
  if (context === undefined) {
    throw new Error('useReTool must be used within a ReToolProvider');
  }
  return context;
};
