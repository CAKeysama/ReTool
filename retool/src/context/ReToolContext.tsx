import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

export interface Categoria {
  id: string;
  nome?: string;
}

export interface Dispositivo {
  id: string;
  nome?: string;
  codigo?: string;
  categoriaId?: string;
  peso?: string;
  familiaProduto?: string;
  descricao?: string;
  observacoes?: string;
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
  utilizacoes: Utilizacao[];
  addDispositivo: (data: Omit<Dispositivo, 'id' | 'dataCriacao'>) => void;
  updateDispositivo: (id: string, data: Partial<Dispositivo>) => void;
  deleteDispositivo: (id: string) => void;
  addCategoria: (data: Omit<Categoria, 'id'>) => void;
  updateCategoria: (id: string, data: Partial<Categoria>) => void;
  deleteCategoria: (id: string) => void;
  addUtilizacao: (data: Omit<Utilizacao, 'id' | 'dataCriacao'>) => void;
  updateUtilizacao: (id: string, data: Partial<Utilizacao>) => void;
  deleteUtilizacao: (id: string) => void;
  announce: (message: string, showToast?: boolean) => void;
  announcement: string;
}

const ReToolContext = createContext<ReToolContextType | undefined>(undefined);

export const ReToolProvider = ({ children }: { children: ReactNode }) => {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [utilizacoes, setUtilizacoes] = useState<Utilizacao[]>([]);

  const [announcement, setAnnouncement] = useState('');
  const [toasts, setToasts] = useState<{id: string; text: string}[]>([]);

  const announce = useCallback((message: string, showToast = true) => {
    // Screen reader
    setAnnouncement('');
    setTimeout(() => setAnnouncement(message), 50); 
    
    // Visual Toast
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
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Categoria));
      setCategorias(data);
    });
    
    const unsubDisp = onSnapshot(collection(db, 'dispositivos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dispositivo));
      setDispositivos(data);
    });

    const unsubUtil = onSnapshot(collection(db, 'utilizacoes'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Utilizacao));
      setUtilizacoes(data);
    });

    return () => {
      unsubCat();
      unsubDisp();
      unsubUtil();
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
  };

  const updateCategoria = async (id: string, data: Partial<Categoria>) => {
    await updateDoc(doc(db, 'categorias', id), data);
    announce('Categoria atualizada com sucesso');
  };

  const deleteCategoria = async (id: string) => {
    await deleteDoc(doc(db, 'categorias', id));
    announce('Categoria removida com sucesso');
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

  return (
    <ReToolContext.Provider value={{
      dispositivos, categorias, utilizacoes,
      addDispositivo, updateDispositivo, deleteDispositivo,
      addCategoria, updateCategoria, deleteCategoria,
      addUtilizacao, updateUtilizacao, deleteUtilizacao,
      announce, announcement
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
