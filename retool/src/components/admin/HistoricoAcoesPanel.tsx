import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  AuditLog, AuditLogAcao, AuditLogCategoria, AuditLogResultado, AuditLogTipoEntidade,
  ACOES_POR_CATEGORIA, ROTULO_ACAO, ROTULO_CATEGORIA, ROTULO_TIPO_ENTIDADE, categoriaDaAcao
} from '../../domain/entities/auditLog';
import { useHistoricoAuditoriaController } from '../../presentation/hooks/useHistoricoAuditoriaController';
import { Aviso, EstadoCarregando, EstadoErro } from '../Feedback';
import { Pill, RoleBadge } from '../Badges';
import { tabelaAdmin } from './estilos';

const CORES_CATEGORIA: Record<AuditLogCategoria, { fundo: string; texto: string }> = {
  autenticacao: { fundo: '#e0f2fe', texto: '#0369a1' },
  usuarios: { fundo: '#f3e8ff', texto: '#6b21a8' },
  dados: { fundo: '#fef3c7', texto: '#92400e' },
  fluxo: { fundo: '#ccfbf1', texto: '#0f766e' },
};

const CORES_RESULTADO: Record<AuditLogResultado, { label: string; fundo: string; texto: string }> = {
  sucesso: { label: 'Sucesso', fundo: '#dcfce7', texto: '#15803d' },
  falha: { label: 'Falha', fundo: '#fee2e2', texto: '#b91c1c' },
  negado: { label: 'Negado', fundo: '#ffedd5', texto: '#c2410c' },
};

/** Início/fim do dia local em ISO (limites inclusivos do período). */
function inicioDoDia(data: string): string {
  return new Date(`${data}T00:00:00`).toISOString();
}
function fimDoDia(data: string): string {
  return new Date(`${data}T23:59:59.999`).toISOString();
}

function formatarMomento(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

/**
 * Histórico completo de ações (exclusivo da Administração): paginação no
 * servidor, filtros por categoria/ação/usuário/recurso/resultado/período e
 * detalhes estruturados de cada operação.
 */
export function HistoricoAcoesPanel() {
  const { users, canVerLogs } = useAuth();
  const h = useHistoricoAuditoriaController(canVerLogs);
  const [busca, setBusca] = useState('');
  const [periodo, setPeriodo] = useState({ de: '', ate: '' });
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const usuariosOrdenados = useMemo(
    () => [...users].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')),
    [users]
  );

  const acoesDisponiveis = h.filtros.categoria
    ? ACOES_POR_CATEGORIA[h.filtros.categoria]
    : (Object.keys(ROTULO_ACAO) as AuditLogAcao[]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return h.logs;
    return h.logs.filter(l =>
      [l.usuarioNome, l.usuarioEmail, l.entidadeNome, l.entidadeId, l.acaoDescricao, l.detalhes]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [h.logs, busca]);

  if (!canVerLogs) return null;

  const atualizarFiltro = (parcial: Partial<typeof h.filtros>) => {
    h.setFiltros(prev => {
      const proximo = { ...prev, ...parcial };
      (Object.keys(proximo) as (keyof typeof proximo)[]).forEach(k => {
        if (proximo[k] === '' || proximo[k] === undefined || proximo[k] === false) delete proximo[k];
      });
      return proximo;
    });
  };

  const atualizarPeriodo = (campo: 'de' | 'ate', valor: string) => {
    const novo = { ...periodo, [campo]: valor };
    setPeriodo(novo);
    atualizarFiltro({
      de: novo.de ? inicioDoDia(novo.de) : undefined,
      ate: novo.ate ? fimDoDia(novo.ate) : undefined
    });
  };

  const limpar = () => {
    setBusca('');
    setPeriodo({ de: '', ate: '' });
    h.setFiltros({});
  };

  const temFiltros = Object.keys(h.filtros).length > 0 || !!busca;

  const badgeAcao = (log: AuditLog) => {
    const cat = log.categoria || categoriaDaAcao(log.acao);
    const cor = CORES_CATEGORIA[cat];
    return <Pill label={ROTULO_ACAO[log.acao] || log.acao} fundo={cor.fundo} texto={cor.texto} title={ROTULO_CATEGORIA[cat]} />;
  };

  const badgeResultado = (r: AuditLogResultado = 'sucesso') => {
    const c = CORES_RESULTADO[r] || CORES_RESULTADO.sucesso;
    return <Pill label={c.label} fundo={c.fundo} texto={c.texto} />;
  };

  return (
    <div>
      {h.haNovos && (
        <Aviso tipo="info">
          Há novos registros no histórico.{' '}
          <button type="button" onClick={h.recarregar} style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
            Atualizar lista
          </button>
        </Aviso>
      )}

      <div style={tabelaAdmin.moldura}>
        {/* FILTROS */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-sm)',
          padding: '12px 16px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fafafa'
        }}>
          <select className="input-field" aria-label="Filtrar por categoria" value={h.filtros.categoria || ''}
            onChange={e => atualizarFiltro({ categoria: (e.target.value || undefined) as AuditLogCategoria | undefined, acao: undefined })}>
            <option value="">Todas as categorias</option>
            {(Object.keys(ROTULO_CATEGORIA) as AuditLogCategoria[]).map(c => (
              <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>
            ))}
          </select>
          <select className="input-field" aria-label="Filtrar por ação" value={h.filtros.acao || ''}
            onChange={e => atualizarFiltro({ acao: (e.target.value || undefined) as AuditLogAcao | undefined })}>
            <option value="">Todas as ações</option>
            {acoesDisponiveis.map(a => <option key={a} value={a}>{ROTULO_ACAO[a]}</option>)}
          </select>
          <select className="input-field" aria-label="Filtrar por usuário" value={h.filtros.usuarioUid || ''}
            onChange={e => atualizarFiltro({ usuarioUid: e.target.value || undefined })}>
            <option value="">Todos os usuários</option>
            {usuariosOrdenados.map(u => <option key={u.uid} value={u.uid}>{u.nome} ({u.email})</option>)}
          </select>
          <select className="input-field" aria-label="Filtrar por recurso" value={h.filtros.tipoEntidade || ''}
            onChange={e => atualizarFiltro({ tipoEntidade: (e.target.value || undefined) as AuditLogTipoEntidade | undefined })}>
            <option value="">Todos os recursos</option>
            {(Object.keys(ROTULO_TIPO_ENTIDADE) as AuditLogTipoEntidade[]).map(t => (
              <option key={t} value={t}>{ROTULO_TIPO_ENTIDADE[t]}</option>
            ))}
          </select>
          <select className="input-field" aria-label="Filtrar por resultado" value={h.filtros.somenteFalhas ? 'falhas' : ''}
            onChange={e => atualizarFiltro({ somenteFalhas: e.target.value === 'falhas' })}>
            <option value="">Todos os resultados</option>
            <option value="falhas">Somente falhas e acessos negados</option>
          </select>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>
            De
            <input type="date" className="input-field" value={periodo.de} max={periodo.ate || undefined} onChange={e => atualizarPeriodo('de', e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>
            Até
            <input type="date" className="input-field" value={periodo.ate} min={periodo.de || undefined} onChange={e => atualizarPeriodo('ate', e.target.value)} />
          </label>
          <div style={{ position: 'relative', alignSelf: 'end' }}>
            <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" className="input-field" aria-label="Buscar nesta página" placeholder="Buscar nesta página..."
              value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: '36px' }} />
          </div>
        </div>

        {/* BARRA DE INFORMAÇÕES */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          padding: '10px 16px', borderBottom: '1px solid var(--color-border)'
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
            {h.total === null ? 'Contando registros...' : `${h.total} ${h.total === 1 ? 'registro' : 'registros'}`}
            {busca && h.estado === 'pronto' && <span style={{ color: '#6b7280', fontWeight: 500 }}> · {visiveis.length} nesta página após a busca</span>}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {temFiltros && (
              <button type="button" className="btn" onClick={limpar} style={{ minHeight: 32, padding: '4px 12px', fontSize: '0.78rem' }}>
                Limpar filtros
              </button>
            )}
            <select className="input-field" aria-label="Registros por página" value={h.tamanhoPagina}
              onChange={e => h.setTamanhoPagina(Number(e.target.value))} style={{ width: 'auto', minHeight: 32, padding: '4px 10px', fontSize: '0.8rem' }}>
              {[25, 50, 100].map(n => <option key={n} value={n}>{n} por página</option>)}
            </select>
            <button type="button" className="btn" onClick={h.recarregar} aria-label="Atualizar histórico" style={{ minHeight: 32, padding: '4px 12px', fontSize: '0.78rem' }}>
              <RefreshCw size={14} /> Atualizar
            </button>
          </div>
        </div>

        {/* REGISTROS */}
        {h.estado === 'carregando' && <EstadoCarregando mensagem="Carregando histórico de ações..." />}
        {h.estado === 'erro' && <EstadoErro mensagem={h.erro} onTentarNovamente={h.recarregar} />}
        {h.estado === 'pronto' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={tabelaAdmin.tabela}>
              <thead>
                <tr style={tabelaAdmin.cabecalho}>
                  <th style={{ ...tabelaAdmin.th, width: '32px' }} aria-label="Expandir detalhes" />
                  <th style={tabelaAdmin.th}>Data / hora</th>
                  <th style={tabelaAdmin.th}>Usuário</th>
                  <th style={tabelaAdmin.th}>Ação</th>
                  <th style={tabelaAdmin.th}>Recurso afetado</th>
                  <th style={tabelaAdmin.th}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map(log => {
                  const aberto = expandidoId === log.id;
                  const temDetalhes = !!(log.conteudo || log.dadosAnteriores || log.detalhes);
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandidoId(aberto ? null : log.id)}
                        style={{ ...tabelaAdmin.linha, cursor: 'pointer', backgroundColor: aberto ? '#fafafa' : 'transparent' }}
                      >
                        <td style={{ ...tabelaAdmin.td, color: '#9ca3af' }}>
                          <ChevronDown size={16} style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </td>
                        <td style={{ ...tabelaAdmin.td, whiteSpace: 'nowrap', color: '#374151' }}>{formatarMomento(log.dataHora)}</td>
                        <td style={tabelaAdmin.td}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{log.usuarioNome || '—'}</div>
                          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{log.usuarioEmail || 'sistema'}</div>
                          <div style={{ marginTop: '2px' }}><RoleBadge perfil={log.usuarioPerfil} curto /></div>
                        </td>
                        <td style={{ ...tabelaAdmin.td, minWidth: '220px' }}>
                          {badgeAcao(log)}
                          <div style={{ marginTop: '4px', color: '#111827' }}>
                            {log.acaoDescricao || log.detalhes || ROTULO_ACAO[log.acao]}
                          </div>
                        </td>
                        <td style={{ ...tabelaAdmin.td, minWidth: '160px' }}>
                          <div style={{ fontWeight: 600, color: '#374151' }}>{ROTULO_TIPO_ENTIDADE[log.tipoEntidade] || log.tipoEntidade}</div>
                          {log.entidadeNome && <div style={{ color: '#4b5563' }}>{log.entidadeNome}</div>}
                          {log.entidadeId && <div style={{ fontSize: '0.7rem', color: '#9ca3af', overflowWrap: 'anywhere' }}>ID: {log.entidadeId}</div>}
                        </td>
                        <td style={tabelaAdmin.td}>{badgeResultado(log.resultado)}</td>
                      </tr>
                      {aberto && (
                        <tr style={{ ...tabelaAdmin.linha, backgroundColor: '#fafafa' }}>
                          <td colSpan={6} style={{ padding: '10px 16px' }}>
                            {temDetalhes ? (
                              <pre style={{
                                margin: 0, padding: '10px 12px', backgroundColor: '#f3f4f6', border: '1px solid var(--color-border)',
                                borderRadius: '6px', fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                maxHeight: '260px', overflowY: 'auto'
                              }}>
                                {JSON.stringify({
                                  detalhes: log.detalhes,
                                  conteudo: log.conteudo,
                                  dadosAnteriores: log.dadosAnteriores,
                                  registroId: log.id
                                }, null, 2)}
                              </pre>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Sem informações adicionais. ID do registro: {log.id}</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: '#6b7280' }}>
                      {h.logs.length === 0
                        ? (temFiltros ? 'Nenhum registro encontrado para os filtros atuais.' : 'Nenhuma ação registrada até o momento.')
                        : 'Nenhum registro desta página corresponde à busca.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINAÇÃO */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          padding: '10px 16px', borderTop: '1px solid var(--color-border)', backgroundColor: '#fafafa'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            Página {h.paginaAtual + 1}{h.total !== null ? ` de ${Math.max(1, Math.ceil(h.total / h.tamanhoPagina))}` : ''}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn" onClick={h.paginaAnterior} disabled={h.paginaAtual === 0 || h.estado === 'carregando'}
              style={{ minHeight: 32, padding: '4px 12px', fontSize: '0.8rem', opacity: h.paginaAtual === 0 ? 0.5 : 1 }}>
              <ChevronLeft size={14} /> Anterior
            </button>
            <button type="button" className="btn" onClick={h.proximaPagina} disabled={!h.temMais || h.estado === 'carregando'}
              style={{ minHeight: 32, padding: '4px 12px', fontSize: '0.8rem', opacity: h.temMais ? 1 : 0.5 }}>
              Próxima <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
