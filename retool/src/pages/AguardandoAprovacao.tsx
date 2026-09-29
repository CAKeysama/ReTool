import React from 'react';
import { Hourglass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TelaAcessoRestrito } from '../components/TelaAcessoRestrito';
import { RoleBadge, SituacaoBadge, formatarDataHora } from '../components/Badges';

/**
 * Área do Convidado: o autocadastro entra no sistema apenas nesta tela até
 * a Administração decidir. A aprovação chega em tempo real (assinatura do
 * perfil) e libera o acesso automaticamente, já com o cargo definido.
 */
export function AguardandoAprovacao() {
  const { userProfile } = useAuth();
  if (!userProfile) return null;

  const linha = (rotulo: string, valor: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{rotulo}</span>
      <span style={{ fontSize: '0.85rem', color: '#0f172a', textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{valor}</span>
    </div>
  );

  return (
    <TelaAcessoRestrito
      icone={<Hourglass size={20} />}
      titulo="Cadastro em análise"
      subtitulo="Sua conta foi criada como Convidado. A Administração já foi notificada e vai definir o seu cargo. Enquanto isso, o acesso aos dados do sistema permanece bloqueado."
    >
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 'var(--radius)', padding: '4px 16px', marginBottom: '18px' }}>
        {linha('Nome', userProfile.nome)}
        {linha('E-mail', userProfile.email)}
        {linha('Cargo atual', <RoleBadge perfil={userProfile.perfil} />)}
        {linha('Situação', <SituacaoBadge situacao="pendente" />)}
        {linha('Cadastro em', formatarDataHora(userProfile.criadoEm))}
      </div>

      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>O que acontece agora</div>
        <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: '#475569', lineHeight: 1.6 }}>
          <li>A Administração analisa o seu cadastro.</li>
          <li>Se aprovado, você recebe o cargo adequado e esta tela libera o sistema automaticamente.</li>
          <li>Se recusado, o acesso permanece bloqueado e o motivo é exibido no próximo login.</li>
        </ol>
      </div>
    </TelaAcessoRestrito>
  );
}
