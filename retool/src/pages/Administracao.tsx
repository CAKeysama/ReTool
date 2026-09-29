import React, { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { situacaoDoUsuario } from '../domain/entities/user';
import { Tabs } from '../components/Tabs';
import { AprovacoesCadastroPanel } from '../components/admin/AprovacoesCadastroPanel';
import { SolicitacoesCargoPanel } from '../components/admin/SolicitacoesCargoPanel';
import { UsuariosPanel } from '../components/admin/UsuariosPanel';
import { HistoricoAcoesPanel } from '../components/admin/HistoricoAcoesPanel';

const ABAS = ['cadastros', 'cargos', 'usuarios', 'logs'] as const;
type Aba = typeof ABAS[number];

/**
 * Área exclusiva da Administração (rota protegida por RoleRoute + regras
 * do Firestore): aprovação de cadastros, solicitações de cargo, gestão de
 * contas com senha temporária e histórico completo de ações.
 */
export function Administracao() {
  const { aba } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { users, solicitacoesCargo } = useAuth();

  const pendentesCadastro = useMemo(() => users.filter(u => situacaoDoUsuario(u) === 'pendente').length, [users]);
  const pendentesCargo = useMemo(() => solicitacoesCargo.filter(s => s.status === 'pendente').length, [solicitacoesCargo]);

  const tabs = [
    { id: 'cadastros', label: 'Cadastros pendentes', count: pendentesCadastro },
    { id: 'cargos', label: 'Solicitações de cargo', count: pendentesCargo },
    { id: 'usuarios', label: 'Usuários', count: users.length },
    { id: 'logs', label: 'Histórico de ações' },
  ];

  // Sem aba na URL: abre onde há pendências; senão, a gestão de usuários.
  const abaAtiva: Aba = (ABAS as readonly string[]).includes(aba || '')
    ? (aba as Aba)
    : pendentesCadastro > 0 ? 'cadastros' : pendentesCargo > 0 ? 'cargos' : 'usuarios';

  const destacarId = (location.state as { destacarId?: string } | null)?.destacarId;

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h2>Administração</h2>
        <p style={{ color: 'var(--color-text-body)' }}>
          Aprovação de novos cadastros, solicitações de alteração de cargo, contas de acesso e histórico de ações do sistema.
        </p>
      </div>

      <Tabs tabs={tabs} active={abaAtiva} onChange={id => navigate(`/administracao/${id}`)} />

      {abaAtiva === 'cadastros' && <AprovacoesCadastroPanel destacarId={destacarId} />}
      {abaAtiva === 'cargos' && <SolicitacoesCargoPanel destacarId={destacarId} />}
      {abaAtiva === 'usuarios' && <UsuariosPanel />}
      {abaAtiva === 'logs' && <HistoricoAcoesPanel />}
    </div>
  );
}
