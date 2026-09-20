import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReTool } from '../context/ReToolContext';
import { Notificacao } from '../domain/entities/notificacao';
import { corDoStatusReutilizacao, normalizarStatusReutilizacao, rotuloCurtoStatusReutilizacao } from '../domain/entities/reutilizacao';

interface NotificationsMenuProps {
  onOpenUsersModal?: () => void;
  /** Ancoragem do painel: 'left' (sidebar) abre para a direita; 'right' abre para a esquerda. */
  align?: 'left' | 'right';
}

function formatarData(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Status "vivo" da notificação, derivado da entidade referenciada. */
function statusDaNotificacao(n: Notificacao, reutilizacoes: { id: string; status?: string }[], usuariosAtivos: Map<string, boolean>): { label: string; cor: string; fundo: string } {
  if (n.tipo === 'reutilizacao_nova' || n.tipo === 'reutilizacao_decidida') {
    const reu = reutilizacoes.find(r => r.id === n.entidadeId);
    if (!reu) return { label: 'Removida', cor: '#6b7280', fundo: '#f3f4f6' };
    const st = normalizarStatusReutilizacao(reu.status);
    const cor = corDoStatusReutilizacao(st);
    return { label: rotuloCurtoStatusReutilizacao(st), cor: cor.texto, fundo: cor.fundo };
  }

  if (n.tipo === 'conta_nova') {
    const ativo = usuariosAtivos.get(n.entidadeId || '');
    if (ativo === undefined) return { label: 'Recusada', cor: '#b91c1c', fundo: '#fee2e2' };
    return ativo
      ? { label: 'Aprovada', cor: '#15803d', fundo: '#dcfce7' }
      : { label: 'Pendente', cor: '#b45309', fundo: '#fef3c7' };
  }

  // conta_decidida
  return n.decisao === 'aprovada'
    ? { label: 'Aprovada', cor: '#15803d', fundo: '#dcfce7' }
    : { label: 'Recusada', cor: '#b91c1c', fundo: '#fee2e2' };
}

export function NotificationsMenu({ onOpenUsersModal, align = 'right' }: NotificationsMenuProps) {
  const { notifications, marcarNotificacaoLida, marcarNotificacaoResolvida, decidirSolicitacaoConta, users, currentRole } = useAuth();
  const { reutilizacoes } = useReTool();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const naoLidas = notifications.filter(n => !n.lida).length;
  const usuariosAtivos = new Map(users.map(u => [u.uid, u.ativo]));

  const aoClicar = async (n: Notificacao) => {
    if (!n.lida) await marcarNotificacaoLida(n.id, true);

    if (n.tipo === 'reutilizacao_nova' || n.tipo === 'reutilizacao_decidida') {
      setIsOpen(false);
      navigate('/reutilizacoes', { state: { reutilizacaoId: n.entidadeId, dispositivoId: n.dispositivoId } });
      return;
    }

    if (n.tipo === 'conta_nova' && currentRole === 'admin') {
      setIsOpen(false);
      onOpenUsersModal?.();
    }
  };

  const decidir = async (n: Notificacao, aprovar: boolean) => {
    setProcessando(n.id);
    try {
      await decidirSolicitacaoConta(n.entidadeId!, aprovar);
      if (!n.lida) await marcarNotificacaoLida(n.id, true);
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="btn btn-icon"
        aria-label={`Notificações${naoLidas > 0 ? ` (${naoLidas} não lidas)` : ''}`}
        aria-expanded={isOpen}
        style={{
          position: 'relative',
          width: '50px',
          height: '50px'
        }}
      >
        <Bell size={18} />
        {naoLidas > 0 && (
          <span style={{
            position: 'absolute',
            top: '-6px',
            right: '-6px',
            minWidth: '18px',
            height: '18px',
            padding: '0 4px',
            borderRadius: '9px',
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            fontSize: '0.66rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box'
          }}>
            {naoLidas}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          ...(align === 'left' ? { left: 0 } : { right: 0 }),
          width: '330px',
          maxHeight: '440px',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1200,
          padding: 'var(--spacing-sm)'
        }}>
          <div style={{ padding: '4px 8px 8px', borderBottom: '1px solid var(--color-hover)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-dark)' }}>
            Notificações
          </div>

          {notifications.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>
              Sem notificações.
            </div>
          )}

          {notifications.map(n => {
            const st = statusDaNotificacao(n, reutilizacoes, usuariosAtivos);
            const pendenteAcao = n.tipo === 'conta_nova' && currentRole === 'admin' && !n.resolvida && usuariosAtivos.get(n.entidadeId || '') === false;
            return (
              <div
                key={n.id}
                onClick={() => aoClicar(n)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') aoClicar(n); }}
                style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '10px 8px',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  backgroundColor: n.lida ? 'transparent' : '#f8f7ff',
                  borderRadius: '6px'
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: n.lida ? '#d1d5db' : 'var(--color-primary)',
                  marginTop: '6px',
                  flexShrink: 0
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827' }}>{n.titulo}</span>
                    <span style={{
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '10px',
                      backgroundColor: st.fundo,
                      color: st.cor,
                      flexShrink: 0
                    }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#4b5563', marginTop: '2px', lineHeight: 1.4 }}>
                    {n.descricao}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#9ca3af', marginTop: '4px' }}>
                    {formatarData(n.dataHora)}
                  </div>

                  {pendenteAcao && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn"
                        disabled={processando === n.id}
                        onClick={() => decidir(n, true)}
                        style={{
                          backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', color: 'white',
                          padding: '4px 12px', minHeight: 28, fontSize: '0.72rem', fontWeight: 700
                        }}
                      >
                        <Check size={12} /> Aprovar
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={processando === n.id}
                        onClick={() => decidir(n, false)}
                        style={{
                          backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)', color: 'white',
                          padding: '4px 12px', minHeight: 28, fontSize: '0.72rem', fontWeight: 700
                        }}
                      >
                        <X size={12} /> Recusar
                      </button>
                    </div>
                  )}
                </div>

                {!n.lida && (
                  <button
                    type="button"
                    title="Marcar como lida"
                    aria-label="Marcar como lida"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await marcarNotificacaoLida(n.id, true);
                      if (n.resolvida === false) await marcarNotificacaoResolvida(n.id, true);
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#9ca3af', padding: '2px', flexShrink: 0
                    }}
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
