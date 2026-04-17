import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

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

const mockCategorias: Categoria[] = [
  { id: 'cat-hidraulica', nome: 'Hidráulica' },
  { id: 'cat-eletrica', nome: 'Elétrica' },
  { id: 'cat-mecanica', nome: 'Mecânica' },
  { id: 'cat-pneumatica', nome: 'Pneumática' },
  { id: 'cat-sensores', nome: 'Sensores e Instrumentação' }
];

const mockDispositivos: Dispositivo[] = [
  { id: 'disp-1', nome: 'Válvula Solenóide Direcional', codigo: 'VS-001', categoriaId: 'cat-hidraulica', peso: '2.5', familiaProduto: 'Válvulas', descricao: 'Válvula direcional 4/3 vias', observacoes: 'Troca de selo frequente' },
  { id: 'disp-2', nome: 'Cilindro Hidráulico de Dupla Ação', codigo: 'CH-400', categoriaId: 'cat-hidraulica', peso: '15.0', familiaProduto: 'Cilindros', descricao: 'Cilindro padrão iso, haste 40mm', observacoes: '' },
  { id: 'disp-3', nome: 'Inversor de Frequência 10CV', codigo: 'INV-10', categoriaId: 'cat-eletrica', peso: '4.2', familiaProduto: 'Drives', descricao: 'Inversor trifásico 380V', observacoes: 'Checar refrigeração painel' },
  { id: 'disp-4', nome: 'Contator de Potência 40A', codigo: 'CT-40A', categoriaId: 'cat-eletrica', peso: '0.8', familiaProduto: 'Manobra', descricao: 'Contator tripolar bobina 24V', observacoes: '' },
  { id: 'disp-5', nome: 'Bomba Centrífuga Multiestágio', codigo: 'BC-200', categoriaId: 'cat-mecanica', peso: '45.0', familiaProduto: 'Bombas', descricao: 'Bomba para água de alta pressão', observacoes: 'Atenção aos rolamentos' },
  { id: 'disp-6', nome: 'Redutor Coroa Sem Fim', codigo: 'RED-60', categoriaId: 'cat-mecanica', peso: '12.0', familiaProduto: 'Transmissão', descricao: 'Redutor 1:60 vazado', observacoes: 'Lubrificar anualmente' },
  { id: 'disp-7', nome: 'Válvula Borboleta Pneumática', codigo: 'VB-PN', categoriaId: 'cat-pneumatica', peso: '3.1', familiaProduto: 'Válvulas', descricao: 'Válvula borboleta atuador duplo', observacoes: '' },
  { id: 'disp-8', nome: 'Filtro Regulador de Ar 1/2"', codigo: 'FRL-12', categoriaId: 'cat-pneumatica', peso: '0.5', familiaProduto: 'Filtros', descricao: 'Conjunto FRL para pré tubulação', observacoes: 'Drenar água regularmente' },
  { id: 'disp-9', nome: 'Sensor Indutivo PNP M18', codigo: 'SN-I-M18', categoriaId: 'cat-sensores', peso: '0.1', familiaProduto: 'Sensores', descricao: 'Sensor indutivo face nivelada 5mm', observacoes: '' },
  { id: 'disp-10', nome: 'Sensor Fotoelétrico Reflexivo', codigo: 'SN-F-REF', categoriaId: 'cat-sensores', peso: '0.15', familiaProduto: 'Sensores', descricao: 'Alcance 3 metros, com espelho', observacoes: 'Lente suja em áreas de pó' },
  { id: 'disp-11', nome: 'Motor Trifásico 5CV Alto Rendimento', codigo: 'MT-5CV-AR', categoriaId: 'cat-eletrica', peso: '25.0', familiaProduto: 'Motores', descricao: 'Frequência 60Hz 1750RPM', observacoes: '' },
  { id: 'disp-12', nome: 'CLP Principal Linha XP', codigo: 'CLP-XP200', categoriaId: 'cat-eletrica', peso: '1.2', familiaProduto: 'CLPs', descricao: 'Controlador de automação primário', observacoes: 'Backup de firmware pendente' },
  { id: 'disp-13', nome: 'Termopar Tipo J', codigo: 'TM-J-100', categoriaId: 'cat-sensores', peso: '0.05', familiaProduto: 'Sensores de Temperatura', descricao: 'Sensor com haste inox 10cm', observacoes: '' },
  { id: 'disp-14', nome: 'Acoplamento de Correia de Poliuretano', codigo: 'ACP-PU', categoriaId: 'cat-mecanica', peso: '0.2', familiaProduto: 'Transmissão', descricao: 'Correia p/ redução de ruído', observacoes: '' },
  { id: 'disp-15', nome: 'Bomba de Lubrificação Automática', codigo: 'BMB-LUB', categoriaId: 'cat-hidraulica', peso: '3.4', familiaProduto: 'Bombas', descricao: 'Bomba de graxa em linha de precisão', observacoes: '' },
  { id: 'disp-16', nome: 'Painel IHM Touch 10"', codigo: 'IHM-T10', categoriaId: 'cat-eletrica', peso: '2.0', familiaProduto: 'IHMs', descricao: 'Interface Homem Máquina colorida', observacoes: 'Tela suscetível a riscos' },
  { id: 'disp-17', nome: 'Rolo Transportador Emborrachado', codigo: 'RL-TRP', categoriaId: 'cat-mecanica', peso: '8.0', familiaProduto: 'Transporte', descricao: 'Rolo para esteira modelo 1', observacoes: '' },
  { id: 'disp-18', nome: 'Pressostato Digital Hidráulico', codigo: 'PR-DIG', categoriaId: 'cat-sensores', peso: '0.3', familiaProduto: 'Instrumentação', descricao: 'Com display, 0-400 bar', observacoes: 'Calibração em dia' },
  { id: 'disp-19', nome: 'Atuador Rotativo Pneumático', codigo: 'AT-RP', categoriaId: 'cat-pneumatica', peso: '1.8', familiaProduto: 'Atuadores', descricao: 'Giro 180 graus compacto', observacoes: '' },
  { id: 'disp-20', nome: 'Guia Linear de Esferas', codigo: 'GL-ESF', categoriaId: 'cat-mecanica', peso: '5.0', familiaProduto: 'Guias', descricao: 'Comprimento 1000mm classe N', observacoes: 'Verificar alinhamento da fixação' }
].map(d => ({ ...d, dataCriacao: new Date('2026-04-10T08:00:00Z').toISOString() }));

const mockUtilizacoes: Utilizacao[] = [
  { id: 'util-1', dispositivoId: 'disp-1', descricao: 'Substituição preventiva de selo', setor: 'Prensa 1', observacoes: 'Operação padrão de manutenção', dataCriacao: '2026-04-11T14:30:00Z' },
  { id: 'util-2', dispositivoId: 'disp-3', descricao: 'Ajuste de rampa de aceleração', setor: 'Esteira Transportadora A', observacoes: 'Para evitar queda de produto', dataCriacao: '2026-04-12T09:15:00Z' },
  { id: 'util-3', dispositivoId: 'disp-9', descricao: 'Limpeza do sensor coberto de estilhaços', setor: 'Guilhotina Central', observacoes: 'Sensor estava falhando por pó', dataCriacao: '2026-04-13T16:45:00Z' },
  { id: 'util-4', dispositivoId: 'disp-5', descricao: 'Instalação de novo rolamento SKF', setor: 'Sistema de Refrigeração', observacoes: 'Vibração excessiva estava sendo ouvida', dataCriacao: '2026-04-14T11:00:00Z' },
  { id: 'util-5', dispositivoId: 'disp-12', descricao: 'Update de firmware C++ v3.2', setor: 'Painel Central Comando', observacoes: 'Corrigidos bugs de timeout', dataCriacao: '2026-04-14T15:20:00Z' },
  { id: 'util-6', dispositivoId: 'disp-18', descricao: 'Ajuste de detecção threshold', setor: 'Injetora 12', observacoes: 'Colocado limite em 200 bar', dataCriacao: '2026-04-15T08:05:00Z' }
];

const ReToolContext = createContext<ReToolContextType | undefined>(undefined);

export const ReToolProvider = ({ children }: { children: ReactNode }) => {
  // Limpando o localStorage cache antigo e injetando a nova base "dispositivos"
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>(() => {
    localStorage.removeItem('retool-pecas'); // Remove antigo db key se existir (cleanup cache global)
    const saved = localStorage.getItem('retool-dispositivos');
    return saved ? JSON.parse(saved) : mockDispositivos;
  });

  const [categorias, setCategorias] = useState<Categoria[]>(() => {
    const saved = localStorage.getItem('retool-categorias');
    return saved ? JSON.parse(saved) : mockCategorias;
  });

  const [utilizacoes, setUtilizacoes] = useState<Utilizacao[]>(() => {
    localStorage.removeItem('retool-utilizacoes'); // Refresha utilizacoes passadas para forçar o mock "rico"
    const saved = localStorage.getItem('retool-utilizacoes-v2');
    return saved ? JSON.parse(saved) : mockUtilizacoes;
  });

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
    localStorage.setItem('retool-dispositivos', JSON.stringify(dispositivos));
  }, [dispositivos]);

  useEffect(() => {
    localStorage.setItem('retool-categorias', JSON.stringify(categorias));
  }, [categorias]);

  useEffect(() => {
    localStorage.setItem('retool-utilizacoes-v2', JSON.stringify(utilizacoes));
  }, [utilizacoes]);

  const addDispositivo = (data: Omit<Dispositivo, 'id' | 'dataCriacao'>) => {
    const nova = { ...data, id: uuidv4(), dataCriacao: new Date().toISOString() };
    setDispositivos((prev) => [...prev, nova]);
    announce('Dispositivo adicionado com sucesso');
  };

  const updateDispositivo = (id: string, data: Partial<Dispositivo>) => {
    setDispositivos((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    announce('Dispositivo atualizado com sucesso');
  };

  const deleteDispositivo = (id: string) => {
    setDispositivos((prev) => prev.map((p) => p.id !== id ? p : p).filter(p => p.id !== id));
    setUtilizacoes((prev) => prev.filter((u) => u.dispositivoId !== id));
    announce('Dispositivo removido com sucesso');
  };

  const addCategoria = (data: Omit<Categoria, 'id'>) => {
    setCategorias((prev) => [...prev, { ...data, id: uuidv4() }]);
    announce('Categoria adicionada com sucesso');
  };

  const updateCategoria = (id: string, data: Partial<Categoria>) => {
    setCategorias((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    announce('Categoria atualizada com sucesso');
  };

  const deleteCategoria = (id: string) => {
    setCategorias((prev) => prev.filter((c) => c.id !== id));
    announce('Categoria removida com sucesso');
  };

  const addUtilizacao = (data: Omit<Utilizacao, 'id' | 'dataCriacao'>) => {
    setUtilizacoes((prev) => [...prev, { ...data, id: uuidv4(), dataCriacao: new Date().toISOString() }]);
    announce('Utilização adicionada com sucesso');
  };

  const updateUtilizacao = (id: string, data: Partial<Utilizacao>) => {
    setUtilizacoes((prev) => prev.map((u) => (u.id === id ? { ...u, ...data } : u)));
    announce('Utilização atualizada com sucesso');
  };

  const deleteUtilizacao = (id: string) => {
    setUtilizacoes((prev) => prev.filter((u) => u.id !== id));
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
