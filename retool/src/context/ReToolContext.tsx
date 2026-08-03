import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Categoria, Tipo } from '../domain/entities/categoria';
import { Familia } from '../domain/entities/familia';
import { Produto } from '../domain/entities/produto';
import { Dispositivo } from '../domain/entities/dispositivo';
import { Utilizacao } from '../domain/entities/utilizacao';

import { FirestoreDispositivosRepository } from '../data/repositories/FirestoreDispositivosRepository';
import { FirestoreCategoriasRepository } from '../data/repositories/FirestoreCategoriasRepository';
import { FirestoreFamiliasRepository } from '../data/repositories/FirestoreFamiliasRepository';
import { FirestoreProdutosRepository } from '../data/repositories/FirestoreProdutosRepository';
import { FirestoreUtilizacoesRepository } from '../data/repositories/FirestoreUtilizacoesRepository';
import { ImportarLoteUseCase } from '../application/usecases/ImportarLoteUseCase';

// Inicialização de Repositórios e Casos de Uso (Interface Adapters / Application Layer)
const dispositivosRepo = new FirestoreDispositivosRepository();
const categoriasRepo = new FirestoreCategoriasRepository();
const familiasRepo = new FirestoreFamiliasRepository();
const produtosRepo = new FirestoreProdutosRepository();
const utilizacoesRepo = new FirestoreUtilizacoesRepository();
const importarLoteUseCase = new ImportarLoteUseCase(dispositivosRepo);

interface ReToolContextType {
  dispositivos: Dispositivo[];
  categorias: Categoria[];
  tipos: Tipo[];
  familias: Familia[];
  produtos: Produto[];
  utilizacoes: Utilizacao[];
  addDispositivo: (data: Omit<Dispositivo, 'id' | 'dataCriacao'>) => Promise<void>;
  updateDispositivo: (id: string, data: Partial<Dispositivo>, silent?: boolean) => Promise<void>;
  deleteDispositivo: (id: string, silent?: boolean) => Promise<void>;
  deletarDispositivosEmLote: (ids: string[], onProgress?: (done: number, total: number) => void) => Promise<void>;
  addCategoria: (data: Omit<Categoria, 'id'>) => Promise<string>;
  updateCategoria: (id: string, data: Partial<Categoria>, silent?: boolean) => Promise<void>;
  deleteCategoria: (id: string, silent?: boolean) => Promise<void>;
  addTipo: (data: Omit<Tipo, 'id'>) => Promise<void>;
  updateTipo: (id: string, data: Partial<Tipo>) => Promise<void>;
  deleteTipo: (id: string) => Promise<void>;
  addFamilia: (data: Omit<Familia, 'id'>) => Promise<string>;
  updateFamilia: (id: string, data: Partial<Familia>, silent?: boolean) => Promise<void>;
  deleteFamilia: (id: string, silent?: boolean) => Promise<void>;
  addProduto: (data: Omit<Produto, 'id'>) => Promise<string>;
  updateProduto: (id: string, data: Partial<Produto>, silent?: boolean) => Promise<void>;
  deleteProduto: (id: string, silent?: boolean) => Promise<void>;
  addUtilizacao: (data: Omit<Utilizacao, 'id' | 'dataCriacao'>) => Promise<void>;
  updateUtilizacao: (id: string, data: Partial<Utilizacao>) => Promise<void>;
  deleteUtilizacao: (id: string, silent?: boolean) => Promise<void>;
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

  // Inscrição em tempo real usando os Repositórios do Domínio
  useEffect(() => {
    const unsubCat = categoriasRepo.subscribeCategorias(setCategorias);
    const unsubTipos = categoriasRepo.subscribeTipos(setTipos);
    const unsubDisp = dispositivosRepo.subscribeAll(setDispositivos);
    const unsubUtil = utilizacoesRepo.subscribeAll(setUtilizacoes);
    const unsubFam = familiasRepo.subscribeAll(setFamilias);
    const unsubProd = produtosRepo.subscribeAll(setProdutos);

    return () => {
      unsubCat();
      unsubTipos();
      unsubDisp();
      unsubUtil();
      unsubFam();
      unsubProd();
    };
  }, []);

  const addDispositivo = async (data: Omit<Dispositivo, 'id' | 'dataCriacao'>) => {
    await dispositivosRepo.add(data);
    announce('Dispositivo adicionado com sucesso');
  };

  const updateDispositivo = async (id: string, data: Partial<Dispositivo>, silent = false) => {
    await dispositivosRepo.update(id, data);
    if (!silent) announce('Dispositivo atualizado com sucesso');
  };

  const deleteDispositivo = async (id: string, silent = false) => {
    await dispositivosRepo.delete(id);
    
    // Deletar relações de utilização associadas
    const relacoes = utilizacoes.filter(u => u.dispositivoId === id);
    if (relacoes.length > 0) {
      await Promise.all(relacoes.map(u => utilizacoesRepo.delete(u.id)));
    }
    if (!silent) announce('Dispositivo removido com sucesso');
  };

  /**
   * Deleta múltiplos dispositivos em lotes de 500 usando writeBatch (muito mais rápido).
   * Também remove as utilizações relacionadas em lote.
   */
  const deletarDispositivosEmLote = async (
    ids: string[],
    onProgress?: (done: number, total: number) => void
  ) => {
    const total = ids.length;

    // Deletar os dispositivos usando writeBatch em paralelo
    await dispositivosRepo.deleteLote(ids, (done) => onProgress?.(done, total));

    // Deletar utilizações associadas em lote
    const idsSet = new Set(ids);
    const utilizacoesRelacionadas = utilizacoes
      .filter(u => idsSet.has(u.dispositivoId))
      .map(u => u.id);

    if (utilizacoesRelacionadas.length > 0) {
      const { db } = await import('../data/datasources/firebase');
      const { writeBatch: wb, doc: d } = await import('firebase/firestore');
      const BATCH_SIZE = 500;
      for (let i = 0; i < utilizacoesRelacionadas.length; i += BATCH_SIZE) {
        const chunk = utilizacoesRelacionadas.slice(i, i + BATCH_SIZE);
        const batch = wb(db);
        chunk.forEach(uid => batch.delete(d(db, 'utilizacoes', uid)));
        await batch.commit();
      }
    }

    announce(`${total} dispositivo${total !== 1 ? 's' : ''} excluído${total !== 1 ? 's' : ''} com sucesso`);
  };

  const addCategoria = async (data: Omit<Categoria, 'id'>) => {
    const id = await categoriasRepo.addCategoria(data);
    announce('Categoria adicionada com sucesso');
    return id;
  };

  const updateCategoria = async (id: string, data: Partial<Categoria>, silent = false) => {
    await categoriasRepo.updateCategoria(id, data);
    if (!silent) announce('Categoria atualizada com sucesso');
  };

  const deleteCategoria = async (id: string, silent = false) => {
    await categoriasRepo.deleteCategoria(id);
    if (!silent) announce('Categoria removida com sucesso');
  };

  const addTipo = async (data: Omit<Tipo, 'id'>) => {
    await categoriasRepo.addTipo(data);
    announce('Tipo adicionado com sucesso');
  };

  const updateTipo = async (id: string, data: Partial<Tipo>) => {
    await categoriasRepo.updateTipo(id, data);
    announce('Tipo atualizado com sucesso');
  };

  const deleteTipo = async (id: string) => {
    await categoriasRepo.deleteTipo(id);
    announce('Tipo removido com sucesso');
  };

  const addFamilia = async (data: Omit<Familia, 'id'>) => {
    const id = await familiasRepo.add(data);
    announce('Família adicionada com sucesso');
    return id;
  };

  const updateFamilia = async (id: string, data: Partial<Familia>, silent = false) => {
    await familiasRepo.update(id, data);
    if (!silent) announce('Família atualizada com sucesso');
  };

  const deleteFamilia = async (id: string, silent = false) => {
    await familiasRepo.delete(id);
    if (!silent) announce('Família removida com sucesso');
  };

  const addProduto = async (data: Omit<Produto, 'id'>) => {
    const id = await produtosRepo.add(data);
    announce('Produto adicionado com sucesso');
    return id;
  };

  const updateProduto = async (id: string, data: Partial<Produto>, silent = false) => {
    await produtosRepo.update(id, data);
    if (!silent) announce('Produto atualizado com sucesso');
  };

  const deleteProduto = async (id: string, silent = false) => {
    await produtosRepo.delete(id);
    if (!silent) announce('Produto removido com sucesso');
  };

  const addUtilizacao = async (data: Omit<Utilizacao, 'id' | 'dataCriacao'>) => {
    await utilizacoesRepo.add(data);
    announce('Utilização adicionada com sucesso');
  };

  const updateUtilizacao = async (id: string, data: Partial<Utilizacao>) => {
    await utilizacoesRepo.update(id, data);
    announce('Utilização atualizada com sucesso');
  };

  const deleteUtilizacao = async (id: string, silent = false) => {
    await utilizacoesRepo.delete(id);
    if (!silent) announce('Utilização removida com sucesso');
  };

  const importarDispositivosEmLote = async (
    novosDispositivos: Partial<Dispositivo>[],
    newCategoriasNomes: string[],
    newFamiliasNomes: string[],
    newProdutosNomes: string[]
  ) => {
    try {
      const result = await importarLoteUseCase.execute(
        novosDispositivos,
        newCategoriasNomes,
        newFamiliasNomes,
        newProdutosNomes,
        categorias,
        familias,
        produtos
      );
      announce(`Importação concluída! ${result.sucesso} registros inseridos ou atualizados.`);
      return result;
    } catch (error) {
      console.error('Erro na importação em lote:', error);
      announce('Erro ao processar importação em lote.');
      return { sucesso: 0, erros: novosDispositivos.length };
    }
  };

  const deleteAllData = async () => {
    try {
      const { db } = await import('../data/datasources/firebase');
      const { writeBatch, doc } = await import('firebase/firestore');

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
      addDispositivo, updateDispositivo, deleteDispositivo, deletarDispositivosEmLote,
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
