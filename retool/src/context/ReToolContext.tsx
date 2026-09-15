import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Categoria, Tipo } from '../domain/entities/categoria';
import { Familia } from '../domain/entities/familia';
import { Produto } from '../domain/entities/produto';
import { Dispositivo } from '../domain/entities/dispositivo';
import { Reutilizacao } from '../domain/entities/reutilizacao';

import { FirestoreDispositivosRepository } from '../data/repositories/FirestoreDispositivosRepository';
import { FirestoreCategoriasRepository } from '../data/repositories/FirestoreCategoriasRepository';
import { FirestoreFamiliasRepository } from '../data/repositories/FirestoreFamiliasRepository';
import { FirestoreProdutosRepository } from '../data/repositories/FirestoreProdutosRepository';
import { FirestoreReutilizacoesRepository } from '../data/repositories/FirestoreReutilizacoesRepository';
import { FirestoreAuditLogRepository } from '../data/repositories/FirestoreAuditLogRepository';
import { ImportarLoteUseCase } from '../application/usecases/ImportarLoteUseCase';
import { useAuth } from './AuthContext';

// Inicialização de Repositórios e Casos de Uso (Interface Adapters / Application Layer)
const dispositivosRepo = new FirestoreDispositivosRepository();
const categoriasRepo = new FirestoreCategoriasRepository();
const familiasRepo = new FirestoreFamiliasRepository();
const produtosRepo = new FirestoreProdutosRepository();
const reutilizacoesRepo = new FirestoreReutilizacoesRepository();
const auditRepo = new FirestoreAuditLogRepository();
const importarLoteUseCase = new ImportarLoteUseCase(dispositivosRepo);

interface ReToolContextType {
  dispositivos: Dispositivo[];
  categorias: Categoria[];
  tipos: Tipo[];
  familias: Familia[];
  produtos: Produto[];
  reutilizacoes: Reutilizacao[];
  addDispositivo: (data: Omit<Dispositivo, 'id' | 'dataCriacao'> & { id?: string }) => Promise<void>;
  updateDispositivo: (id: string, data: Partial<Dispositivo>, silent?: boolean) => Promise<void>;
  deleteDispositivo: (id: string, silent?: boolean) => Promise<void>;
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
  addReutilizacao: (data: Omit<Reutilizacao, 'id' | 'dataCriacao'>) => Promise<void>;
  solicitarReutilizacao: (data: Omit<Reutilizacao, 'id' | 'dataCriacao' | 'status'>, solicitanteNome: string, solicitanteId?: string) => Promise<void>;
  aprovarReutilizacao: (id: string, aprovadorNome: string, aprovadorId?: string) => Promise<void>;
  rejeitarReutilizacao: (id: string, motivo: string, aprovadorNome: string, aprovadorId?: string) => Promise<void>;
  updateReutilizacao: (id: string, data: Partial<Reutilizacao>) => Promise<void>;
  deleteReutilizacao: (id: string, silent?: boolean) => Promise<void>;
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
  const { userProfile, currentRole } = useAuth();
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [reutilizacoes, setReutilizacoes] = useState<Reutilizacao[]>([]);

  const [announcement, setAnnouncement] = useState('');
  const [toasts, setToasts] = useState<{id: string; text: string}[]>([]);

  const [isDispFormOpen, setIsDispFormOpen] = useState(false);
  const [editingDispId, setEditingDispId] = useState<string | null>(null);

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

  const openDispForm = useCallback((id?: string) => {
    if (id) {
      if (currentRole !== 'admin' && currentRole !== 'projetista') {
        announce('Acesso negado: seu perfil não possui permissão para editar dispositivos.');
        return;
      }
    } else {
      if (currentRole !== 'admin' && currentRole !== 'projetista') {
        announce('Acesso negado: seu perfil não possui permissão para cadastrar dispositivos.');
        return;
      }
    }
    setEditingDispId(id || null);
    setIsDispFormOpen(true);
  }, [currentRole, announce]);

  const closeDispForm = useCallback(() => {
    setIsDispFormOpen(false);
    setEditingDispId(null);
  }, []);

  // Inscrição em tempo real usando os Repositórios do Domínio
  useEffect(() => {
    const unsubCat = categoriasRepo.subscribeCategorias(setCategorias);
    const unsubTipos = categoriasRepo.subscribeTipos(setTipos);
    const unsubDisp = dispositivosRepo.subscribeAll(setDispositivos);
    const unsubUtil = reutilizacoesRepo.subscribeAll(setReutilizacoes);
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

  const logAuditExclusao = async (tipoEntidade: any, id: string, nome?: string, dadosAnteriores?: any) => {
    try {
      await auditRepo.registrarLog({
        dataHora: new Date().toISOString(),
        usuarioUid: userProfile?.uid || 'sistema',
        usuarioNome: userProfile?.nome || 'Administradora',
        usuarioEmail: userProfile?.email || '',
        usuarioPerfil: currentRole,
        acao: 'exclusao',
        tipoEntidade,
        entidadeId: id,
        entidadeNome: nome || id,
        detalhes: `Exclusão de ${tipoEntidade}: ${nome || id}`,
        dadosAnteriores
      });
    } catch (e) {
      console.warn('Erro ao registrar log de auditoria da exclusão:', e);
    }
  };

  const addDispositivo = async (data: Omit<Dispositivo, 'id' | 'dataCriacao'> & { id?: string }) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar dispositivos.');
      return;
    }
    await dispositivosRepo.add(data);
    announce('Dispositivo adicionado com sucesso');
  };

  const updateDispositivo = async (id: string, data: Partial<Dispositivo>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar dispositivos.');
      return;
    }
    await dispositivosRepo.update(id, data);
    if (!silent) announce('Dispositivo atualizado com sucesso');
  };

  const deleteDispositivo = async (id: string, silent = false) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir dispositivos.');
      return;
    }
    const disp = dispositivos.find(d => d.id === id);
    await dispositivosRepo.delete(id);
    await logAuditExclusao('dispositivo', id, disp?.nome, disp);
    
    // Deletar relações de reutilização associadas
    const relacoes = reutilizacoes.filter(u => u.dispositivoId === id);
    if (relacoes.length > 0) {
      await Promise.all(relacoes.map(u => reutilizacoesRepo.delete(u.id)));
    }
    if (!silent) announce('Dispositivo removido com sucesso');
  };

  const addCategoria = async (data: Omit<Categoria, 'id'>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar categorias.');
      return '';
    }
    const id = await categoriasRepo.addCategoria(data);
    announce('Categoria adicionada com sucesso');
    return id;
  };

  const updateCategoria = async (id: string, data: Partial<Categoria>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar categorias.');
      return;
    }
    await categoriasRepo.updateCategoria(id, data);
    if (!silent) announce('Categoria atualizada com sucesso');
  };

  const deleteCategoria = async (id: string, silent = false) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir categorias.');
      return;
    }
    const cat = categorias.find(c => c.id === id);
    await categoriasRepo.deleteCategoria(id);
    await logAuditExclusao('categoria', id, cat?.nome, cat);
    if (!silent) announce('Categoria removida com sucesso');
  };

  const addTipo = async (data: Omit<Tipo, 'id'>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar tipos.');
      return;
    }
    await categoriasRepo.addTipo(data);
    announce('Tipo adicionado com sucesso');
  };

  const updateTipo = async (id: string, data: Partial<Tipo>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para editar tipos.');
      return;
    }
    await categoriasRepo.updateTipo(id, data);
    announce('Tipo atualizado com sucesso');
  };

  const deleteTipo = async (id: string) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir tipos.');
      return;
    }
    const tip = tipos.find(t => t.id === id);
    await categoriasRepo.deleteTipo(id);
    await logAuditExclusao('tipo', id, tip?.nome, tip);
    announce('Tipo removido com sucesso');
  };

  const addFamilia = async (data: Omit<Familia, 'id'>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar famílias.');
      return '';
    }
    const id = await familiasRepo.add(data);
    announce('Família adicionada com sucesso');
    return id;
  };

  const updateFamilia = async (id: string, data: Partial<Familia>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar famílias.');
      return;
    }
    await familiasRepo.update(id, data);
    if (!silent) announce('Família atualizada com sucesso');
  };

  const deleteFamilia = async (id: string, silent = false) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir famílias.');
      return;
    }
    const fam = familias.find(f => f.id === id);
    await familiasRepo.delete(id);
    await logAuditExclusao('familia', id, fam?.nome, fam);
    if (!silent) announce('Família removida com sucesso');
  };

  const addProduto = async (data: Omit<Produto, 'id'>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar produtos.');
      return '';
    }
    const id = await produtosRepo.add(data);
    announce('Produto adicionado com sucesso');
    return id;
  };

  const updateProduto = async (id: string, data: Partial<Produto>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar produtos.');
      return;
    }
    await produtosRepo.update(id, data);
    if (!silent) announce('Produto atualizado com sucesso');
  };

  const deleteProduto = async (id: string, silent = false) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir produtos.');
      return;
    }
    const prod = produtos.find(p => p.id === id);
    await produtosRepo.delete(id);
    await logAuditExclusao('produto', id, prod?.nome, prod);
    if (!silent) announce('Produto removido com sucesso');
  };

  const addReutilizacao = async (data: Omit<Reutilizacao, 'id' | 'dataCriacao'>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: Engenharia deve utilizar a opção Solicitar Reutilização.');
      return;
    }
    await reutilizacoesRepo.add({
      ...data,
      status: data.status || 'aprovado'
    });
    announce('Reutilização adicionada com sucesso');
  };

  const solicitarReutilizacao = async (
    data: Omit<Reutilizacao, 'id' | 'dataCriacao' | 'status'>,
    solicitanteNome: string,
    solicitanteId?: string
  ) => {
    if (currentRole === 'gerencia') {
      announce('Acesso negado: perfil de Gerência possui acesso somente de consulta.');
      return;
    }
    await reutilizacoesRepo.add({
      ...data,
      status: 'pendente',
      solicitanteNome,
      solicitanteId: solicitanteId || userProfile?.uid || 'eng'
    });
    announce('Solicitação de reutilização enviada com sucesso');
  };

  const aprovarReutilizacao = async (id: string, aprovadorNome: string, aprovadorId?: string) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Apenas Projetistas ou Administradoras podem aprovar reutilizações.');
      return;
    }
    await reutilizacoesRepo.update(id, {
      status: 'aprovado',
      aprovadorNome: aprovadorNome || userProfile?.nome || 'Projetista',
      aprovadorId: aprovadorId || userProfile?.uid || 'proj',
      dataAprovacao: new Date().toISOString()
    });
    announce('Solicitação de reutilização aprovada com sucesso');
  };

  const rejeitarReutilizacao = async (id: string, motivo: string, aprovadorNome: string, aprovadorId?: string) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Apenas Projetistas ou Administradoras podem rejeitar reutilizações.');
      return;
    }
    await reutilizacoesRepo.update(id, {
      status: 'rejeitado',
      motivoRejeicao: motivo,
      aprovadorNome: aprovadorNome || userProfile?.nome || 'Projetista',
      aprovadorId: aprovadorId || userProfile?.uid || 'proj',
      dataAprovacao: new Date().toISOString()
    });
    announce('Solicitação de reutilização rejeitada');
  };

  const updateReutilizacao = async (id: string, data: Partial<Reutilizacao>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para editar reutilizações.');
      return;
    }
    await reutilizacoesRepo.update(id, data);
    announce('Reutilização atualizada com sucesso');
  };

  const deleteReutilizacao = async (id: string, silent = false) => {
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para excluir reutilizações.');
      return;
    }
    const reu = reutilizacoes.find(u => u.id === id);
    await reutilizacoesRepo.delete(id);
    await logAuditExclusao('reutilizacao', id, reu?.descricaoAlteracao || id, reu);
    if (!silent) announce('Reutilização removida com sucesso');
  };

  const importarDispositivosEmLote = async (
    novosDispositivos: Partial<Dispositivo>[],
    newCategoriasNomes: string[],
    newFamiliasNomes: string[],
    newProdutosNomes: string[]
  ) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: apenas Administradoras e Projetistas podem importar dispositivos.');
      return { sucesso: 0, erros: novosDispositivos.length };
    }
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
    if (currentRole !== 'admin') {
      announce('Apenas Administradoras têm permissão para apagar todo o banco de dados.');
      return;
    }
    try {
      const { db } = await import('../data/datasources/firebase');
      const { writeBatch, doc } = await import('firebase/firestore');

      const allDocs = [
        ...dispositivos.map(d => ({ col: 'dispositivos', id: d.id })),
        ...categorias.map(c => ({ col: 'categorias', id: c.id })),
        ...tipos.map(t => ({ col: 'tipos', id: t.id })),
        ...familias.map(f => ({ col: 'familias', id: f.id })),
        ...produtos.map(p => ({ col: 'produtos', id: p.id })),
        ...reutilizacoes.map(u => ({ col: 'reutilizacoes', id: u.id }))
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
      dispositivos, categorias, tipos, familias, produtos, reutilizacoes,
      addDispositivo, updateDispositivo, deleteDispositivo,
      addCategoria, updateCategoria, deleteCategoria,
      addTipo, updateTipo, deleteTipo,
      addFamilia, updateFamilia, deleteFamilia,
      addProduto, updateProduto, deleteProduto,
      addReutilizacao, updateReutilizacao, deleteReutilizacao,
      solicitarReutilizacao, aprovarReutilizacao, rejeitarReutilizacao,
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
