import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES_CONFIG, UserRole } from '../domain/entities/user';
import { 
  X, 
  FileText, 
  Trash2, 
  UserCog, 
  CheckCircle, 
  XCircle, 
  Search, 
  Calendar, 
  ShieldAlert,
  PlusCircle,
  Pencil,
  Repeat2,
  Upload
} from 'lucide-react';

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuditLogsModal({ isOpen, onClose }: AuditLogsModalProps) {
  const { auditLogs, currentRole } = useAuth();
  const [filterText, setFilterText] = useState('');
  const [filterAcao, setFilterAcao] = useState<string>('todos');

  if (!isOpen) return null;
  // Bloqueio de visualização: a trilha de auditoria é exclusiva da Administração.
  if (currentRole !== 'admin') return null;

  const filteredLogs = auditLogs.filter(log => {
    const q = filterText.toLowerCase();
    const matchText = filterText === '' ||
      (log.usuarioNome?.toLowerCase().includes(q)) ||
      (log.usuarioEmail?.toLowerCase().includes(q)) ||
      (log.entidadeNome?.toLowerCase().includes(q)) ||
      (log.detalhes?.toLowerCase().includes(q)) ||
      (log.acaoDescricao?.toLowerCase().includes(q)) ||
      (log.tipoEntidade?.toLowerCase().includes(q));

    const matchAcao = filterAcao === 'todos' || log.acao === filterAcao;
    return matchText && matchAcao;
  });

  const getActionBadge = (acao: string) => {
    switch (acao) {
      case 'criacao':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
            <PlusCircle size={12} /> Criação
          </span>
        );
      case 'edicao':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#fef3c7', color: '#92400e' }}>
            <Pencil size={12} /> Edição
          </span>
        );
      case 'transicao':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#ccfbf1', color: '#0f766e' }}>
            <Repeat2 size={12} /> Transição
          </span>
        );
      case 'importacao':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#e0e7ff', color: '#3730a3' }}>
            <Upload size={12} /> Importação
          </span>
        );
      case 'exclusao':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#fee2e2', color: '#b91c1c' }}>
            <Trash2 size={12} /> Exclusão
          </span>
        );
      case 'aprovacao':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d' }}>
            <CheckCircle size={12} /> Aprovação
          </span>
        );
      case 'rejeicao':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#fef3c7', color: '#b45309' }}>
            <XCircle size={12} /> Rejeição
          </span>
        );
      case 'alteracao_perfil':
      case 'bloqueio_usuario':
      case 'desbloqueio_usuario':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#f3e8ff', color: '#6b21a8' }}>
            <UserCog size={12} /> Acesso
          </span>
        );
      default:
        return <span>{acao}</span>;
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
    } catch {
      return iso;
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
    >
      <div style={{
        backgroundColor: 'white',
        borderRadius: 'var(--radius)',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#eff6ff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 id="audit-modal-title" style={{ margin: 0, fontSize: '1.2rem', color: '#1e3a8a', fontWeight: 700 }}>
                Rastreabilidade & Histórico de Auditoria
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#1d4ed8' }}>
                Registro imutável de todas as exclusões, aprovações e alterações críticas de sistema.
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '6px',
              borderRadius: '6px'
            }}
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* FILTROS */}
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por usuário, item, entidade ou detalhe..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <select
            value={filterAcao}
            onChange={e => setFilterAcao(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '0.85rem',
              backgroundColor: 'white'
            }}
          >
            <option value="todos">Todas as Ações</option>
            <option value="criacao">Criações</option>
            <option value="edicao">Edições</option>
            <option value="exclusao">Exclusões</option>
            <option value="transicao">Transições de Fluxo</option>
            <option value="aprovacao">Aprovações</option>
            <option value="rejeicao">Rejeições</option>
            <option value="importacao">Importações</option>
            <option value="alteracao_perfil">Alterações de Acesso</option>
            <option value="bloqueio_usuario">Bloqueios</option>
            <option value="desbloqueio_usuario">Desbloqueios</option>
          </select>
        </div>

        {/* LISTA DE REGISTROS */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
              <FileText size={36} color="#9ca3af" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Nenhum log de auditoria encontrado</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Ações de exclusão e aprovação realizadas no sistema aparecerão listadas aqui automaticamente.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredLogs.map(log => {
                const userRoleConf = ROLES_CONFIG[log.usuarioPerfil] || ROLES_CONFIG.gerencia;
                return (
                  <div
                    key={log.id}
                    style={{
                      padding: '12px 16px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'white',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getActionBadge(log.acao)}
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 700, 
                          color: userRoleConf.badgeText, 
                          backgroundColor: userRoleConf.badgeBg, 
                          padding: '2px 8px', 
                          borderRadius: '10px' 
                        }}>
                          {userRoleConf.titulo}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                          {log.usuarioNome}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          ({log.usuarioEmail || 'sistema'})
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} />
                        {formatTimestamp(log.dataHora)}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#111827', fontWeight: 500 }}>
                      {log.acaoDescricao || log.detalhes || `Ação em [${log.tipoEntidade}] ${log.entidadeNome}`}
                    </div>

                    {log.entidadeId && (
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                        ID do Registro: {log.entidadeId}
                      </div>
                    )}

                    {(log.conteudo || log.dadosAnteriores) && (
                      <details style={{ fontSize: '0.75rem' }}>
                        <summary style={{ cursor: 'pointer', color: '#2563eb', fontWeight: 600, userSelect: 'none' }}>
                          Ver conteúdo da operação (JSON)
                        </summary>
                        <pre style={{
                          margin: '6px 0 0', padding: '10px 12px',
                          backgroundColor: '#f3f4f6', border: '1px solid var(--color-border)',
                          borderRadius: '6px', fontSize: '0.72rem',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '220px', overflowY: 'auto'
                        }}>
                          {JSON.stringify({ conteudo: log.conteudo, dadosAnteriores: log.dadosAnteriores }, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#fafafa'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Total de registros: {filteredLogs.length}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              color: '#374151',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
