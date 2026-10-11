import React, { useState } from 'react';
import { ArrowRight, Send } from 'lucide-react';
import { AccessibleModal } from './AccessibleModal';
import { useAuth, traduzirErroAuth } from '../context/AuthContext';
import { PERFIS_ATRIBUIVEIS, ROLES_CONFIG, UserRole } from '../domain/entities/user';
import { JUSTIFICATIVA_MAX } from '../domain/entities/solicitacaoCargo';
import { Aviso, EstadoCarregando, EstadoErro } from './Feedback';
import { RoleBadge, SolicitacaoStatusBadge, formatarDataHora } from './Badges';

/**
 * Fluxo B (usuário): pedido de alteração do próprio cargo. O cargo não muda
 * aqui — a solicitação vai para a Administração, que aprova ou rejeita.
 */
export function SolicitarAlteracaoCargoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { userProfile, solicitacoesCargo, estadoSolicitacoesCargo, solicitarAlteracaoCargo } = useAuth();
  const [perfil, setPerfil] = useState<UserRole | ''>('');
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  if (!isOpen || !userProfile) return null;

  const minhas = solicitacoesCargo.filter(s => s.usuarioUid === userProfile.uid);
  const pendente = minhas.find(s => s.status === 'pendente');
  const decididas = minhas.filter(s => s.status !== 'pendente').slice(0, 5);
  const opcoes = PERFIS_ATRIBUIVEIS.filter(r => r !== userProfile.perfil);

  const fechar = () => {
    setAviso(null);
    setPerfil('');
    setJustificativa('');
    onClose();
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil) return;
    setEnviando(true);
    setAviso(null);
    try {
      await solicitarAlteracaoCargo(perfil, justificativa);
      setAviso({ tipo: 'sucesso', texto: `Solicitação enviada. A Administração foi notificada e decidirá sobre o cargo ${ROLES_CONFIG[perfil].titulo}.` });
      setPerfil('');
      setJustificativa('');
    } catch (err) {
      setAviso({ tipo: 'erro', texto: traduzirErroAuth(err) });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AccessibleModal isOpen={isOpen} onClose={fechar} title="Alteração de cargo" maxWidth="520px">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-md)', fontSize: '0.85rem', color: '#374151' }}>
        Cargo atual: <RoleBadge perfil={userProfile.perfil} />
      </div>

      {aviso && <Aviso tipo={aviso.tipo} onClose={() => setAviso(null)}>{aviso.texto}</Aviso>}

      {estadoSolicitacoesCargo === 'carregando' && <EstadoCarregando mensagem="Consultando suas solicitações..." />}
      {estadoSolicitacoesCargo === 'erro' && <EstadoErro mensagem="Não foi possível consultar suas solicitações de cargo." />}

      {estadoSolicitacoesCargo === 'pronto' && (pendente ? (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <SolicitacaoStatusBadge status="pendente" />
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>enviada em {formatarDataHora(pendente.dataSolicitacao)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <RoleBadge perfil={pendente.perfilAtual} />
            <ArrowRight size={14} color="#6b7280" />
            <RoleBadge perfil={pendente.perfilSolicitado} />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '10px', lineHeight: 1.5 }}>
            Sua solicitação está aguardando a decisão da Administração. Uma nova solicitação só pode ser feita depois dessa análise.
          </p>
        </div>
      ) : (
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="input-label" htmlFor="cargo-solicitado">Cargo solicitado</label>
            <select id="cargo-solicitado" className="input-field" required value={perfil} onChange={e => setPerfil(e.target.value as UserRole | '')}>
              <option value="">Selecione...</option>
              {opcoes.map(r => <option key={r} value={r}>{ROLES_CONFIG[r].titulo}</option>)}
            </select>
            {perfil && <div className="input-helper">{ROLES_CONFIG[perfil].descricao}</div>}
          </div>
          <div>
            <label className="input-label" htmlFor="justificativa-cargo">Justificativa (opcional)</label>
            <textarea
              id="justificativa-cargo"
              className="input-field"
              rows={3}
              maxLength={JUSTIFICATIVA_MAX}
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              placeholder="Explique por que precisa do novo cargo."
            />
            <div className="input-helper" style={{ textAlign: 'right' }}>{justificativa.length}/{JUSTIFICATIVA_MAX}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn" onClick={fechar}>Fechar</button>
            <button type="submit" className="btn btn-primary" disabled={!perfil || enviando} style={{ opacity: !perfil || enviando ? 0.6 : 1 }}>
              <Send size={14} /> {enviando ? 'Enviando...' : 'Enviar solicitação'}
            </button>
          </div>
        </form>
      ))}

      {estadoSolicitacoesCargo === 'pronto' && decididas.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>Solicitações anteriores</div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {decididas.map(s => (
              <li key={s.id} style={{ fontSize: '0.78rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <SolicitacaoStatusBadge status={s.status} />
                {ROLES_CONFIG[s.perfilSolicitado].titulo} · {formatarDataHora(s.dataDecisao || s.dataSolicitacao)}
                {s.motivoDecisao && <span style={{ color: '#6b7280' }}>— {s.motivoDecisao}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </AccessibleModal>
  );
}
