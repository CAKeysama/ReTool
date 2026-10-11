import React from 'react';
import { PerfilUsuario, SituacaoUsuario, configDoPerfil } from '../domain/entities/user';
import { SolicitacaoCargoStatus, ROTULO_STATUS_SOLICITACAO } from '../domain/entities/solicitacaoCargo';

/** Chip compacto no padrão dos badges do sistema. */
export function Pill({ label, fundo, texto, icon, title }: {
  label: React.ReactNode;
  fundo: string;
  texto: string;
  icon?: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px', borderRadius: '12px',
        fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
        backgroundColor: fundo, color: texto
      }}
    >
      {icon}{label}
    </span>
  );
}

export function RoleBadge({ perfil, curto = false }: { perfil: PerfilUsuario | string; curto?: boolean }) {
  const conf = configDoPerfil(perfil);
  return <Pill label={curto ? conf.tituloCurto : conf.titulo} fundo={conf.badgeBg} texto={conf.badgeText} />;
}

export const SITUACAO_VISUAL: Record<SituacaoUsuario, { label: string; fundo: string; texto: string }> = {
  ativo: { label: 'Ativo', fundo: '#dcfce7', texto: '#15803d' },
  pendente: { label: 'Aguardando aprovação', fundo: '#fef3c7', texto: '#b45309' },
  bloqueado: { label: 'Bloqueado', fundo: '#fee2e2', texto: '#b91c1c' },
  rejeitado: { label: 'Cadastro rejeitado', fundo: '#f3f4f6', texto: '#4b5563' },
};

export function SituacaoBadge({ situacao }: { situacao: SituacaoUsuario }) {
  const v = SITUACAO_VISUAL[situacao];
  return <Pill label={`● ${v.label}`} fundo={v.fundo} texto={v.texto} />;
}

const STATUS_SOLICITACAO_CORES: Record<SolicitacaoCargoStatus, { fundo: string; texto: string }> = {
  pendente: { fundo: '#fef3c7', texto: '#b45309' },
  aprovada: { fundo: '#dcfce7', texto: '#15803d' },
  rejeitada: { fundo: '#fee2e2', texto: '#b91c1c' },
};

export function SolicitacaoStatusBadge({ status }: { status: SolicitacaoCargoStatus }) {
  const c = STATUS_SOLICITACAO_CORES[status];
  return <Pill label={ROTULO_STATUS_SOLICITACAO[status]} fundo={c.fundo} texto={c.texto} />;
}

export function formatarDataHora(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
