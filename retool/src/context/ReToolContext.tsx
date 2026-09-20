import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Categoria, Tipo } from '../domain/entities/categoria';
import { Familia } from '../domain/entities/familia';
import { Produto } from '../domain/entities/produto';
import { Dispositivo } from '../domain/entities/dispositivo';
import { Reutilizacao, ReutilizacaoStatus, transicaoReutilizacaoPermitida } from '../domain/entities/reutilizacao';
import { AuditLog } from '../domain/entities/auditLog';

import { FirestoreDispositivosRepository } from '../data/repositories/FirestoreDispositivosRepository';
import { FirestoreCategoriasRepository } from '../data/repositories/FirestoreCategoriasRepository';
import { FirestoreFamiliasRepository } from '../data/repositories/FirestoreFamiliasRepository';
import { FirestoreProdutosRepository } from '../data/repositories/FirestoreProdutosRepository';
import { FirestoreReutilizacoesRepository } from '../data/repositories/FirestoreReutilizacoesRepository';
import { FirestoreAuditLogRepository } from '../data/repositories/FirestoreAuditLogRepository';
import { ImportarLoteUseCase } from '../application/usecases/ImportarLoteUseCase';
import { idNotificacao } from '../domain/entities/notificacao';
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
  transicionarReutilizacao: (id: string, para: ReutilizacaoStatus, opts?: { motivo?: string; numeroOs?: string }) => Promise<void>;
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
  const { userProfile, currentRole, users, criarNotificacao } = useAuth();
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

  // "Event Handler" central de auditoria: acionado no sucesso de cada mutação.
  // A falha no registro nunca derruba a operação principal.
  const registrarAuditoria = async (
    acao: AuditLog['acao'],
    tipoEntidade: AuditLog['tipoEntidade'],
    entidadeId: string,
    entidadeNome: string,
    acaoDescricao: string,
    conteudo?: Record<string, any>,
    dadosAnteriores?: Record<string, any>
  ) => {
    try {
      await auditRepo.registrarLog({
        usuarioUid: userProfile?.uid || 'sistema',
        usuarioNome: userProfile?.nome || 'Desconhecido',
        usuarioEmail: userProfile?.email || '',
        usuarioPerfil: currentRole,
        acao,
        acaoDescricao,
        tipoEntidade,
        entidadeId,
        entidadeNome,
        detalhes: acaoDescricao,
        conteudo,
        dadosAnteriores
      });
    } catch (e) {
      console.warn('Erro ao registrar log de auditoria:', e);
    }
  };

  const logAuditExclusao = async (tipoEntidade: any, id: string, nome?: string, dadosAnteriores?: any) => {
    await registrarAuditoria(
      'exclusao',
      tipoEntidade,
      id,
      nome || id,
      `Exclusão de ${tipoEntidade}: ${nome || id}`,
      dadosAnteriores,
      dadosAnteriores
    );
  };

  const addDispositivo = async (data: Omit<Dispositivo, 'id' | 'dataCriacao'> & { id?: string }) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para cadastrar dispositivos.');
      return;
    }
    const novoId = await dispositivosRepo.add(data);
    await registrarAuditoria('criacao', 'dispositivo', novoId, data.nome, 'Cadastrou dispositivo', { ...data });
    announce('Dispositivo adicionado com sucesso');
  };

  const updateDispositivo = async (id: string, data: Partial<Dispositivo>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar dispositivos.');
      return;
    }
    const atual = dispositivos.find(d => d.id === id);
    await dispositivosRepo.update(id, data);
    await registrarAuditoria('edicao', 'dispositivo', id, atual?.nome || id, 'Editou dispositivo', { valoresAlterados: data }, atual);
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
    await registrarAuditoria('criacao', 'categoria', id, data.nome, 'Cadastrou categoria', { ...data });
    announce('Categoria adicionada com sucesso');
    return id;
  };

  const updateCategoria = async (id: string, data: Partial<Categoria>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar categorias.');
      return;
    }
    const atual = categorias.find(c => c.id === id);
    await categoriasRepo.updateCategoria(id, data);
    await registrarAuditoria('edicao', 'categoria', id, atual?.nome || id, 'Editou categoria', { valoresAlterados: data }, atual);
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
    const novoId = await categoriasRepo.addTipo(data);
    await registrarAuditoria('criacao', 'tipo', novoId, data.nome, 'Cadastrou tipo', { ...data });
    announce('Tipo adicionado com sucesso');
  };

  const updateTipo = async (id: string, data: Partial<Tipo>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para editar tipos.');
      return;
    }
    const atual = tipos.find(t => t.id === id);
    await categoriasRepo.updateTipo(id, data);
    await registrarAuditoria('edicao', 'tipo', id, atual?.nome || id, 'Editou tipo', { valoresAlterados: data }, atual);
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
    await registrarAuditoria('criacao', 'familia', id, data.nome, 'Cadastrou família', { ...data });
    announce('Família adicionada com sucesso');
    return id;
  };

  const updateFamilia = async (id: string, data: Partial<Familia>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar famílias.');
      return;
    }
    const atual = familias.find(f => f.id === id);
    await familiasRepo.update(id, data);
    await registrarAuditoria('edicao', 'familia', id, atual?.nome || id, 'Editou família', { valoresAlterados: data }, atual);
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
    await registrarAuditoria('criacao', 'produto', id, data.nome, 'Cadastrou produto', { ...data });
    announce('Produto adicionado com sucesso');
    return id;
  };

  const updateProduto = async (id: string, data: Partial<Produto>, silent = false) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      if (!silent) announce('Acesso negado: seu perfil não possui permissão para editar produtos.');
      return;
    }
    const atual = produtos.find(p => p.id === id);
    await produtosRepo.update(id, data);
    await registrarAuditoria('edicao', 'produto', id, atual?.nome || id, 'Editou produto', { valoresAlterados: data }, atual);
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
    const novoId = await reutilizacoesRepo.add({
      ...data,
      status: data.status || 'Reutilização aprovada'
    });
    const dispNome = dispositivos.find(d => d.id === data.dispositivoId)?.nome || data.dispositivoId;
    await registrarAuditoria('criacao', 'reutilizacao', novoId, dispNome, 'Cadastrou reutilização', { dispositivoId: data.dispositivoId, codigoPeca: data.codigoPeca, hardSaving: data.hardSaving });
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
    const solicitanteUid = solicitanteId || userProfile?.uid || 'eng';
    const novoId = await reutilizacoesRepo.add({
      ...data,
      status: 'Em análise (Engenharia)',
      solicitanteNome,
      solicitanteId: solicitanteUid
    });
    const dispNome = dispositivos.find(d => d.id === data.dispositivoId)?.nome || data.dispositivoId;
    await registrarAuditoria('criacao', 'reutilizacao', novoId, dispNome, 'Solicitou reutilização', { dispositivoId: data.dispositivoId, codigoPeca: data.codigoPeca, descricaoAlteracao: data.descricaoAlteracao, hardSaving: data.hardSaving });
    announce('Solicitação registrada. Envie para a análise do Projetista na Fila da Engenharia.');
  };

  const notificarFilaProjetista = async (reu: Reutilizacao, descricao: string) => {
    const aprovadores = users.filter(
      u => u.ativo && (u.perfil === 'admin' || u.perfil === 'projetista') && u.uid !== userProfile?.uid
    );
    for (const aprovador of aprovadores) {
      try {
        await criarNotificacao({
          id: idNotificacao('reutilizacao_nova', reu.id, aprovador.uid),
          tipo: 'reutilizacao_nova',
          destinatarioUid: aprovador.uid,
          remetenteUid: userProfile?.uid || '',
          titulo: 'Nova tarefa na Fila do Projetista',
          descricao,
          dataHora: new Date().toISOString(),
          lida: false,
          entidadeId: reu.id,
          dispositivoId: reu.dispositivoId
        });
      } catch (e) {
        console.warn('Falha ao notificar Fila do Projetista:', e);
      }
    }
  };

  const notificarSolicitante = async (reu: Reutilizacao, titulo: string, descricao: string) => {
    if (!reu.solicitanteId || reu.solicitanteId === userProfile?.uid) return;
    try {
      await criarNotificacao({
        id: idNotificacao('reutilizacao_decidida', `${reu.id}:${titulo}`, reu.solicitanteId),
        tipo: 'reutilizacao_decidida',
        destinatarioUid: reu.solicitanteId,
        remetenteUid: userProfile?.uid || '',
        titulo,
        descricao,
        dataHora: new Date().toISOString(),
        lida: false,
        entidadeId: reu.id,
        dispositivoId: reu.dispositivoId
      });
    } catch (e) {
      console.warn('Falha ao notificar solicitante:', e);
    }
  };

  const transicionarReutilizacao = async (
    id: string,
    para: ReutilizacaoStatus,
    opts?: { motivo?: string; numeroOs?: string }
  ) => {
    const reu = reutilizacoes.find(u => u.id === id);
    if (!reu) return;
    const de = reu.status || 'Em análise (Projetista)';

    if (!transicaoReutilizacaoPermitida(currentRole, de, para)) {
      announce('Acesso negado: seu perfil não executa essa etapa do fluxo.');
      return;
    }

    const dados: Partial<Reutilizacao> = { status: para };
    const decisaoProjetista =
      (de === 'Em análise (Projetista)' && (para === 'Reutilização aprovada' || para === 'Reutilização não aprovada')) ||
      (de === 'Aguardando novo filtro (Projetista)' && (para === 'Em análise (Projetista)' || para === 'Liberado para fabricação (novo dispositivo)'));
    if (decisaoProjetista) {
      dados.aprovadorNome = userProfile?.nome || 'Projetista';
      dados.aprovadorId = userProfile?.uid;
      dados.dataAprovacao = new Date().toISOString();
      if (para === 'Reutilização não aprovada' && opts?.motivo) dados.motivoRejeicao = opts.motivo;
    }
    if (opts?.numeroOs !== undefined) dados.numeroOs = opts.numeroOs;

    await reutilizacoesRepo.update(id, dados);

    const nomeDisp = dispositivos.find(d => d.id === reu.dispositivoId)?.nome || 'um dispositivo';

    // Auditoria da mudança de estado (ação legível conforme a transição executada)
    const descricaoTransicao = (() => {
      if (de === 'Em análise (Engenharia)' && para === 'Em análise (Projetista)') return 'Solicitou análise do Projetista (1º filtro)';
      if (para === 'Reutilização aprovada') return 'Aprovou Reutilização';
      if (para === 'Reutilização não aprovada') return 'Reprovou Reutilização';
      if (de === 'Reutilização aprovada' && para === 'Em andamento - OS') return 'Gerou OS';
      if (de === 'Reutilização não aprovada' && para === 'Em andamento - OS') return 'Gerou OS (após não aprovação)';
      if (para === 'Aguardando novo filtro (Projetista)') return 'Solicitou Novo Filtro (dispositivo novo)';
      if (de === 'Aguardando novo filtro (Projetista)' && para === 'Em análise (Projetista)') return 'Marcou similar encontrado (análise retomada)';
      if (para === 'Liberado para fabricação (novo dispositivo)') return 'Liberou fabricação de novo dispositivo';
      return `Alterou status de "${de}" para "${para}"`;
    })();
    await registrarAuditoria(
      para === 'Reutilização aprovada' ? 'aprovacao'
        : para === 'Reutilização não aprovada' ? 'rejeicao'
        : 'transicao',
      'reutilizacao',
      id,
      nomeDisp,
      descricaoTransicao,
      { statusDe: de, statusPara: para, dispositivoId: reu.dispositivoId, motivo: opts?.motivo, numeroOs: opts?.numeroOs },
      { status: de }
    );

    if (para === 'Em análise (Projetista)' && de === 'Em análise (Engenharia)') {
      await notificarFilaProjetista(reu, `${userProfile?.nome || 'A Engenharia'} solicitou análise de reutilização de ${nomeDisp} (1º filtro).`);
    } else if (para === 'Em análise (Projetista)' && de === 'Aguardando novo filtro (Projetista)') {
      await notificarFilaProjetista(reu, `Similar encontrado para ${nomeDisp}: análise de reutilização retomada.`);
      await notificarSolicitante(reu, 'Similar encontrado', `O Projetista encontrou um similar para ${nomeDisp}; a análise de reutilização foi retomada.`);
    } else if (para === 'Reutilização aprovada') {
      await notificarSolicitante(reu, 'Reutilização aprovada', `Sua solicitação de reutilização de ${nomeDisp} foi aprovada. Gere a OS com os códigos da reutilização.`);
    } else if (para === 'Reutilização não aprovada') {
      await notificarSolicitante(reu, 'Reutilização não aprovada', `Sua solicitação de reutilização de ${nomeDisp} não foi aprovada.${opts?.motivo ? ` Motivo: ${opts.motivo}` : ''}`);
    } else if (para === 'Aguardando novo filtro (Projetista)') {
      await notificarFilaProjetista(reu, `A Engenharia solicitou dispositivo novo para ${nomeDisp} (verificação de similares).`);
    } else if (para === 'Liberado para fabricação (novo dispositivo)') {
      await notificarSolicitante(reu, 'Liberado para fabricação', `Nenhum similar encontrado para ${nomeDisp}: novo dispositivo liberado para fabricação.`);
    }

    announce(`Status atualizado: ${para}`);
  };

  const updateReutilizacao = async (id: string, data: Partial<Reutilizacao>) => {
    if (currentRole !== 'admin' && currentRole !== 'projetista') {
      announce('Acesso negado: seu perfil não possui permissão para editar reutilizações.');
      return;
    }
    const atual = reutilizacoes.find(u => u.id === id);
    await reutilizacoesRepo.update(id, data);
    await registrarAuditoria('edicao', 'reutilizacao', id, atual?.descricaoAlteracao || id, 'Editou reutilização', { valoresAlterados: data }, atual);
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
      await registrarAuditoria(
        'importacao',
        'dispositivo',
        'importacao-lote',
        'Importação em lote',
        `Importação em lote: ${result.sucesso} registro(s) inserido(s)/atualizado(s), ${result.erros} erro(s)`,
        { enviados: novosDispositivos.length, sucesso: result.sucesso, erros: result.erros }
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

      await registrarAuditoria(
        'exclusao',
        'dispositivo',
        'limpeza-total',
        'Base de dados',
        'Exclusão em massa: todos os dados do sistema foram removidos',
        { dispositivos: dispositivos.length, categorias: categorias.length, tipos: tipos.length, familias: familias.length, produtos: produtos.length, reutilizacoes: reutilizacoes.length }
      );
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
      solicitarReutilizacao, transicionarReutilizacao,
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
