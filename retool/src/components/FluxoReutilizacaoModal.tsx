import React from 'react';
import { AccessibleModal } from './AccessibleModal';
import { ArrowDown, CornerDownRight, Check, X, Bell } from 'lucide-react';
import {
  ReutilizacaoStatus,
  corDoStatusReutilizacao,
  rotuloCurtoStatusReutilizacao
} from '../domain/entities/reutilizacao';

interface FluxoReutilizacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Chip({ status }: { status: ReutilizacaoStatus }) {
  const cor = corDoStatusReutilizacao(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: '10px',
      fontSize: '0.72rem', fontWeight: 700,
      backgroundColor: cor.fundo, color: cor.texto, whiteSpace: 'nowrap'
    }}>
      {rotuloCurtoStatusReutilizacao(status)}
    </span>
  );
}

function Conector() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0', color: '#9ca3af' }}>
      <ArrowDown size={16} />
    </div>
  );
}

const tituloEtapa: React.CSSProperties = { margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#111827' };
const textoEtapa: React.CSSProperties = { margin: '4px 0 0', fontSize: '0.8rem', color: '#4b5563', lineHeight: 1.5 };
const cartao: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: '12px 14px',
  backgroundColor: '#fafafa'
};
const secao: React.CSSProperties = {
  marginTop: 'var(--spacing-lg)',
  paddingTop: 'var(--spacing-md)',
  borderTop: '1px solid var(--color-border)'
};
const tituloSecao: React.CSSProperties = { margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 700, color: '#111827' };

export function FluxoReutilizacaoModal({ isOpen, onClose }: FluxoReutilizacaoModalProps) {
  return (
    <AccessibleModal isOpen={isOpen} onClose={onClose} title="Como funciona o fluxo de aceite" maxWidth="780px">
      {/* ETAPAS DO FLUXO */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Etapa 1 */}
        <div style={cartao}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={tituloEtapa}>1. Solicitação</h3>
            <Chip status="Em análise (Engenharia)" />
          </div>
          <p style={textoEtapa}>
            A Engenharia cria a solicitação no formulário &quot;Nova Solicitação&quot; (peça, descrição da alteração, hard saving).
            O registro nasce neste status e fica na <strong>Fila da Engenharia</strong>.
          </p>
        </div>
        <Conector />

        {/* Etapa 2 */}
        <div style={cartao}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={tituloEtapa}>2. Envio para análise (1º filtro)</h3>
            <Chip status="Em análise (Projetista)" />
          </div>
          <p style={textoEtapa}>
            Ainda na Fila da Engenharia, a solicitação é enviada com o botão <strong>&quot;Solicitar Análise&quot;</strong>.
            Ela passa para a <strong>Fila do Projetista</strong>, e o Projetista e o Admin são notificados.
          </p>
        </div>
        <Conector />

        {/* Etapa 3: decisão do 1º filtro */}
        <div style={cartao}>
          <h3 style={tituloEtapa}>3. Decisão do Projetista</h3>
          <p style={textoEtapa}>
            Na Fila do Projetista, a solicitação é avaliada e o resultado segue por um dos caminhos:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginTop: '10px' }}>
            <div style={{ ...cartao, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Check size={15} style={{ color: 'var(--color-success)' }} />
                <strong style={{ fontSize: '0.82rem' }}>Aprovada</strong>
                <Chip status="Reutilização aprovada" />
              </div>
              <p style={textoEtapa}>
                O solicitante é notificado e o dispositivo está liberado para reutilização — fluxo encerrado.
              </p>
            </div>
            <div style={{ ...cartao, backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <X size={15} style={{ color: 'var(--color-danger)' }} />
                <strong style={{ fontSize: '0.82rem' }}>Não aprovada</strong>
                <Chip status="Reutilização não aprovada" />
              </div>
              <p style={textoEtapa}>
                O motivo é registrado e o solicitante é notificado. A Engenharia pode
                <strong> solicitar um dispositivo novo</strong> (2º filtro).
              </p>
            </div>
          </div>
        </div>
        <Conector />

        {/* Etapa 4: 2º filtro */}
        <div style={cartao}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={tituloEtapa}>4. Novo dispositivo (2º filtro)</h3>
            <Chip status="Aguardando novo filtro (Projetista)" />
          </div>
          <p style={textoEtapa}>
            Quando um dispositivo novo é solicitado, o registro volta à <strong>Fila do Projetista</strong> para verificação de similares:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', fontSize: '0.8rem', color: '#4b5563' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <CornerDownRight size={14} style={{ color: '#9ca3af' }} />
              <strong>Similar encontrado:</strong> retorna à análise do Projetista (etapa 3) e o solicitante é avisado.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <CornerDownRight size={14} style={{ color: '#9ca3af' }} />
              <strong>Sem similar:</strong>
              <Chip status="Liberado para fabricação (novo dispositivo)" />
              fabricação do dispositivo novo liberada — fluxo encerrado.
            </div>
          </div>
        </div>
      </div>

      {/* TODOS OS ESTADOS */}
      <div style={secao}>
        <h3 style={tituloSecao}>Todos os estados</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px', fontWeight: 600, color: '#4b5563' }}>Status</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, color: '#4b5563' }}>O que significa</th>
              <th style={{ padding: '6px 8px', fontWeight: 600, color: '#4b5563' }}>Quem avança</th>
            </tr>
          </thead>
          <tbody>
            {[
              { st: 'Em análise (Engenharia)' as ReutilizacaoStatus, desc: 'Rascunho criado pela Engenharia, aguardando envio ao 1º filtro.', quem: 'Engenharia / Admin' },
              { st: 'Em análise (Projetista)' as ReutilizacaoStatus, desc: 'Em avaliação pelo Projetista (1º filtro).', quem: 'Projetista / Admin' },
              { st: 'Reutilização aprovada' as ReutilizacaoStatus, desc: 'Aprovada no 1º filtro — estado final.', quem: '—' },
              { st: 'Reutilização não aprovada' as ReutilizacaoStatus, desc: 'Reprovada com motivo; pode ser enviado para solicitação de dispositivo novo.', quem: 'Engenharia / Admin' },
              { st: 'Aguardando novo filtro (Projetista)' as ReutilizacaoStatus, desc: 'Dispositivo novo solicitado; Projetista verifica similares (2º filtro).', quem: 'Projetista / Admin' },
              { st: 'Liberado para fabricação (novo dispositivo)' as ReutilizacaoStatus, desc: 'Novo dispositivo liberado — estado final.', quem: '—' }
            ].map(({ st, desc, quem }) => (
              <tr key={st} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px' }}><Chip status={st} /></td>
                <td style={{ padding: '8px', color: '#4b5563' }}>{desc}</td>
                <td style={{ padding: '8px', color: '#4b5563', whiteSpace: 'nowrap' }}>{quem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PERMISSÕES */}
      <div style={secao}>
        <h3 style={tituloSecao}>Permissões por perfil</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', fontSize: '0.8rem', color: '#4b5563' }}>
          <div style={cartao}><strong>Engenharia:</strong> solicita, envia ao 1º filtro e solicita dispositivo novo.</div>
          <div style={cartao}><strong>Projetista:</strong> aprova/reprova no 1º filtro e decide similar/liberação no 2º filtro.</div>
          <div style={cartao}><strong>Admin:</strong> todas as transições do fluxo.</div>
          <div style={cartao}><strong>Gerência:</strong> somente leitura (consulta o histórico).</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '10px', fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.5 }}>
          <Bell size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Notificações: Projetista e Admin recebem as entradas nas filas; o solicitante é avisado nas decisões
            (aprovação, não aprovação, similar encontrado e liberação de fabricação).
          </span>
        </div>
      </div>

      <div style={{ marginTop: 'var(--spacing-lg)', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={onClose} style={{ padding: '8px 20px' }}>
          Entendi
        </button>
      </div>
    </AccessibleModal>
  );
}
