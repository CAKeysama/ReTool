import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReTool } from '../context/ReToolContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { corDoStatusReutilizacao, rotuloCurtoStatusReutilizacao } from '../domain/entities/reutilizacao';
import { ArrowLeft, Edit, Plus, Box, Key, Trash, FileText, ExternalLink, Send, ChevronDown } from 'lucide-react';
import { AccessibleModal } from '../components/AccessibleModal';
import { SolicitarReutilizacaoModal } from '../components/SolicitarReutilizacaoModal';
import { formatFileSize } from '../utils/fileValidators';
import { useDispositivo, useReutilizacoesDoDispositivo } from '../presentation/hooks/useDispositivo';
import { EstadoDados, SkeletonLinha, SkeletonTabela, classificarErro, mensagemDeErro } from '../components/feedback';
import { gravarComPrazo } from '../utils/tempo';

export function DispositivoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canCadastrar, canEditar, canExcluir, canSolicitar, isEngenharia } = usePermissions();
  const { categorias, familias, produtos, addReutilizacao, deleteReutilizacao, addProduto, openDispForm, announce } = useReTool();
  const { userProfile } = useAuth();
  // O responsável é sempre quem está registrando (não editável).
  const nomeUsuario = userProfile?.nome || userProfile?.email || '';

  // Só o documento exibido e as reutilizações dele (antes: coleções inteiras).
  const { dispositivo: disp, estado: estadoDisp, erro: erroDisp, tentarNovamente } = useDispositivo(id);
  const { reutilizacoes: dispReutilizacoes, estado: estadoReu, erro: erroReu, tentarNovamente: tentarReu } = useReutilizacoesDoDispositivo(id);
  const categoria = categorias.find(c => c.id === disp?.categoriaId);
  const familia = familias.find(f => f.id === disp?.familiaId);
  const produto = produtos.find(p => p.id === disp?.produtoId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSolicitarOpen, setIsSolicitarOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [novaReutilizacao, setNovaReutilizacao] = useState({
    data: '',
    codigoPeca: '',
    descricaoPeca: '',
    produtoId: '',
    pesoPeca: 0,
    hardSaving: 0,
    responsavel: '',
    numeroOs: '',
    descricaoAlteracao: ''
  });
  const [produtoCustomizado, setProdutoCustomizado] = useState('');
  const [salvandoReutilizacao, setSalvandoReutilizacao] = useState(false);

  if (estadoDisp === 'carregando') {
    return (
      <div aria-busy="true" aria-label="Carregando dispositivo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: 'var(--spacing-xl)' }}>
          <SkeletonLinha largura={260} altura={24} />
          <SkeletonLinha largura={140} altura={14} />
        </div>
        <SkeletonTabela linhas={4} colunas={3} />
      </div>
    );
  }

  if (estadoDisp === 'erro') {
    return <EstadoDados estado={classificarErro(erroDisp)} onTentarNovamente={tentarNovamente} />;
  }

  if (!disp) {
    return (
      <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>
        <p>Dispositivo não encontrado.</p>
        <button className="btn btn-primary" onClick={() => navigate('/dispositivos')}>Voltar</button>
      </div>
    );
  }

  const openModal = () => {
    if (!canCadastrar) {
      announce('Acesso negado: seu perfil não tem permissão para cadastrar reutilizações diretamente.');
      return;
    }
    const defaultPeso = disp.peso ? parseFloat(disp.peso.replace(',', '.')) : 0;
    setNovaReutilizacao({
      data: new Date().toISOString().split('T')[0],
      codigoPeca: disp.codigo || '',
      descricaoPeca: '',
      produtoId: disp.produtoId || '',
      pesoPeca: isNaN(defaultPeso) ? 0 : defaultPeso,
      hardSaving: 0,
      responsavel: nomeUsuario,
      numeroOs: '',
      descricaoAlteracao: ''
    });
    setProdutoCustomizado('');
    setIsModalOpen(true);
  };

  const handleCreateReutilizacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvandoReutilizacao) return;
    if (!canCadastrar) {
      announce('Acesso negado: seu perfil não tem permissão para cadastrar reutilizações diretamente.');
      return;
    }
    let finalProdutoId = novaReutilizacao.produtoId;
    
    if (finalProdutoId === 'custom' && !produtoCustomizado.trim()) {
      alert('Por favor, digite o nome do novo produto.');
      return;
    }
    setSalvandoReutilizacao(true);
    try {
    if (finalProdutoId === 'custom') {
      finalProdutoId = await gravarComPrazo(addProduto({ nome: produtoCustomizado.trim() }));
    }

    await gravarComPrazo(addReutilizacao({
      dispositivoId: disp.id,
      data: novaReutilizacao.data,
      codigoPeca: novaReutilizacao.codigoPeca,
      descricaoPeca: novaReutilizacao.descricaoPeca,
      produtoId: finalProdutoId,
      pesoPeca: Number(novaReutilizacao.pesoPeca),
      hardSaving: Number(novaReutilizacao.hardSaving),
      responsavel: nomeUsuario,
      numeroOs: novaReutilizacao.numeroOs,
      descricaoAlteracao: novaReutilizacao.descricaoAlteracao
    }));

    setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      announce(mensagemDeErro(err, 'Não foi possível salvar a reutilização. Tente novamente.'));
    } finally {
      setSalvandoReutilizacao(false);
    }
  };

  const getBadgeColor = (text: string) => {
    if (!text) return 'badge';
    const c = text.charCodeAt(0) % 4;
    return c === 0 ? 'badge badge-pink' : c === 1 ? 'badge badge-teal' : c === 2 ? 'badge badge-yellow' : 'badge badge-blue';
  };

  // Enquanto as reutilizações não chegaram (ou falharam), o resumo mostra "…"/"—" em vez de zeros.
  const resumoPronto = estadoReu === 'pronto';
  const resumoVazio = estadoReu === 'erro' ? '—' : '…';
  const totalHardSaving = dispReutilizacoes.reduce((acc, curr) => acc + (curr.hardSaving || 0), 0);
  const sortedReutilizacoes = [...dispReutilizacoes].sort((a, b) => new Date(b.data || b.dataCriacao || '').getTime() - new Date(a.data || a.dataCriacao || '').getTime());

  const primeiraReutilizacao = sortedReutilizacoes[sortedReutilizacoes.length - 1];
  const ultimaReutilizacao = sortedReutilizacoes[0];

  const formatDisplayDate = (rawDate: string) => {
    if (!rawDate) return 'N/A';
    if (rawDate.includes('-') && rawDate.length === 10) {
      const [year, month, day] = rawDate.split('-');
      return `${day}/${month}/${year}`;
    }
    return new Date(rawDate).toLocaleDateString('pt-BR');
  };

  return (
    <>
      {/* HEADER DA PÁGINA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <button 
            className="btn" 
            onClick={() => navigate('/dispositivos')}
            aria-label="Voltar para lista de dispositivos"
            style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: 0 }}
          >
            <ArrowLeft size={20} color="#9ca3af" />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{disp.nome || 'Sem nome'}</h2>
            <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{disp.codigo || 'Sem código'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>

          {canEditar && (
            <button 
              className="btn" 
              onClick={() => openDispForm(disp.id)}
              style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem' }}
            >
              <Edit size={14} /> Editar
            </button>
          )}
        </div>
      </div>

      <div className="details-grid">
        
        {/* CARTÃO: DADOS DO DISPOSITIVO */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-lg)' }}>
            <Box size={16} color="var(--color-primary)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Dados do dispositivo</h3>
          </div>

          <div className="form-row-grid" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Nº dispositivo</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.nome || <span style={{color: 'var(--gray01)'}}>—</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Código da peça</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.codigo || <span style={{color: 'var(--gray01)'}}>—</span>}</div>
            </div>
          </div>

          <div className="form-row-grid" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Peso</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.peso ? `${disp.peso} g` : <span style={{color: 'var(--gray01)'}}>—</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Palavras-chave</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(disp.palavrasChave || []).map(tag => (
                  <span key={tag} className="badge badge-pink">{tag}</span>
                ))}
                {(disp.palavrasChave || []).length === 0 && <span style={{color: 'var(--gray01)'}}>—</span>}
              </div>
            </div>
          </div>

          <div className="form-row-grid" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Família do produto</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{familia?.nome || <span style={{color: 'var(--gray01)'}}>—</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Produto</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{produto?.nome || <span style={{color: 'var(--gray01)'}}>—</span>}</div>
            </div>
          </div>

          <div className="form-row-grid" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Categoria</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{categoria?.nome || <span style={{color: 'var(--gray01)'}}>—</span>}</div>
            </div>
          </div>

          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Descrição da peça</div>
            <div style={{ color: 'var(--color-text-dark)', fontSize: '0.9rem', lineHeight: 1.6 }}>{disp.descricao || <span style={{color: 'var(--gray01)'}}>—</span>}</div>
          </div>

          {disp.observacoes && (
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Observações (legado)</div>
              <div style={{ color: 'var(--color-text-dark)', fontSize: '0.9rem', lineHeight: 1.6 }}>{disp.observacoes}</div>
            </div>
          )}

          {/* Seção de Mídia Relacionada (Imagens e Documentos) */}
          {(disp.imagemPeca || disp.imagemDispositivo || (disp.anexos && disp.anexos.length > 0)) && (
            <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-md)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 'var(--spacing-sm)' }}>
                Anexos
              </div>

              {/* Fotos da Peça e Dispositivo */}
              {(disp.imagemPeca || disp.imagemDispositivo) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: (disp.anexos && disp.anexos.length > 0) ? 'var(--spacing-md)' : '0' }}>
                  {disp.imagemPeca && (
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', backgroundColor: '#f9fafb' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Imagem da peça</span>
                      <a href={disp.imagemPeca} target="_blank" rel="noopener noreferrer" title="Abrir imagem original">
                        <img src={disp.imagemPeca} alt="Imagem da peça" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }} />
                      </a>
                    </div>
                  )}
                  {disp.imagemDispositivo && (
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', backgroundColor: '#f9fafb' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Imagem do dispositivo</span>
                      <a href={disp.imagemDispositivo} target="_blank" rel="noopener noreferrer" title="Abrir imagem original">
                        <img src={disp.imagemDispositivo} alt="Imagem do dispositivo" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }} />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Lista de Documentos e Manuais Técnicos (PDF) */}
              {disp.anexos && disp.anexos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: (disp.imagemPeca || disp.imagemDispositivo) ? 'var(--spacing-sm)' : '0' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    DOCUMENTOS TÉCNICOS & MANUAIS (PDF)
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                    {disp.anexos.map((anexo) => (
                      <div
                        key={anexo.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: '#f9fafb',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <FileText size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span
                              style={{
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '160px',
                                color: 'var(--color-text-dark)',
                              }}
                              title={anexo.originalName}
                            >
                              {anexo.originalName}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                              {formatFileSize(anexo.size)} • {new Date(anexo.uploadedAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        <a
                          href={anexo.downloadURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm"
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            textDecoration: 'none',
                          }}
                          title="Visualizar ou baixar PDF"
                        >
                          <ExternalLink size={13} />
                          <span>Abrir</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CARTÃO: RESUMO */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, marginBottom: 'var(--spacing-lg)' }}>Resumo</h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Reutilizações</span>
            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{resumoPronto ? dispReutilizacoes.length : resumoVazio}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Hard Saving total</span>
            <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{resumoPronto ? `R$ ${totalHardSaving.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : resumoVazio}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Primeira reutilização</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.85rem' }}>
              {!resumoPronto ? resumoVazio : primeiraReutilizacao ? formatDisplayDate(primeiraReutilizacao.data || primeiraReutilizacao.dataCriacao || '') : 'N/A'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Última reutilização</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.85rem' }}>
              {!resumoPronto ? resumoVazio : ultimaReutilizacao ? formatDisplayDate(ultimaReutilizacao.data || ultimaReutilizacao.dataCriacao || '') : 'N/A'}
            </span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Cadastro</span>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{new Date(disp.dataCriacao || '').toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

      </div>

      {/* HISTÓRICO DE REUTILIZAÇÕES EM FORMATO DE TABELA */}
      <div className="card" style={{ padding: 0, marginTop: 'var(--spacing-lg)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Reutilizações</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {canCadastrar && (
              <button className="btn btn-primary" onClick={openModal}>
                <Plus size={16} /> Nova reutilização
              </button>
            )}

            {canSolicitar && isEngenharia && (
              <button className="btn btn-primary" onClick={() => setIsSolicitarOpen(true)}>
                <Send size={16} /> Solicitar reutilização
              </button>
            )}
          </div>
        </div>
        
        {estadoReu === 'carregando' ? (
          <SkeletonTabela linhas={3} colunas={6} />
        ) : estadoReu === 'erro' ? (
          <EstadoDados estado={classificarErro(erroReu)} compacto onTentarNovamente={tentarReu} />
        ) : dispReutilizacoes.length === 0 ? (
          <div style={{ padding: 'var(--spacing-lg)', color: '#6b7280', fontSize: '0.9rem', textAlign: 'center' }}>
            Nenhuma reutilização registrada ainda.
          </div>
        ) : (
          <div className="tabela-rolavel" role="region" aria-label="Histórico de reutilizações" tabIndex={0}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', width: '45px', textAlign: 'center' }}>Nº</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Data</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Peça</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'right' }}>Hard Saving</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Responsável</th>
                  <th style={{ padding: '10px 8px', width: '36px' }} aria-label="Expandir detalhes" />
                  {canExcluir && <th style={{ padding: '10px 8px', width: '40px' }} aria-label="Excluir" />}
                </tr>
              </thead>
              <tbody>
                {sortedReutilizacoes.map((u, idx) => {
                  const itemNumber = sortedReutilizacoes.length - idx;
                  const isMostRecent = idx === 0;
                  const aberto = expandedId === u.id;

                  const rawDate = u.data || u.dataCriacao || '';
                  let displayDate = 'N/A';
                  if (rawDate) {
                    if (rawDate.includes('-') && rawDate.length === 10) {
                      const [year, month, day] = rawDate.split('-');
                      displayDate = `${day}/${month}/${year}`;
                    } else {
                      displayDate = new Date(rawDate).toLocaleDateString('pt-BR');
                    }
                  }

                  const statusU = u.status || 'Reutilização aprovada';
                  const corStatus = corDoStatusReutilizacao(statusU);
                  const corDestaque = 'var(--color-text-dark)';

                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        onClick={() => setExpandedId(aberto ? null : u.id)}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                          backgroundColor: isMostRecent ? 'rgba(228, 13, 44, 0.03)' : aberto ? '#fafafa' : 'transparent',
                          borderLeft: isMostRecent ? '4px solid var(--color-primary)' : 'none'
                        }}
                        title="Clique para ver os detalhes completos"
                      >
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            margin: '0 auto',
                            borderRadius: '50%',
                            backgroundColor: isMostRecent ? 'var(--color-primary)' : '#f3f4f6',
                            color: isMostRecent ? 'white' : '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.8rem'
                          }}>
                            {itemNumber}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', color: isMostRecent ? 'var(--color-primary)' : 'var(--color-text-dark)', fontWeight: isMostRecent ? 600 : 400, whiteSpace: 'nowrap' }}>{displayDate}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: corStatus.fundo,
                            color: corStatus.texto,
                            whiteSpace: 'nowrap'
                          }} title={statusU}>
                            {rotuloCurtoStatusReutilizacao(statusU)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', maxWidth: '220px' }}>
                          <div style={{ fontWeight: 600, color: corDestaque, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.codigoPeca}>{u.codigoPeca || 'N/A'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.descricaoPeca}>{u.descricaoPeca || ''}</div>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--color-success)', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'right' }}>
                          R$ {(u.hardSaving || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '12px 8px', color: corDestaque, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.responsavel}>{u.responsavel || u.solicitanteNome || 'N/A'}</td>
                        <td style={{ padding: '12px 8px', color: '#6b7280' }}>
                          <ChevronDown size={16} style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'block' }} />
                        </td>
                        {canExcluir && (
                          <td style={{ padding: '12px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <button
                              className="btn"
                              style={{ border: 'none', padding: 0, color: 'var(--color-danger)', background: 'transparent', boxShadow: 'none', minHeight: 'unset', height: 'auto' }}
                              onClick={() => confirm('Apagar esta reutilização?') && deleteReutilizacao(u.id)}
                              title="Excluir reutilização"
                              aria-label="Excluir reutilização"
                            >
                              <Trash size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                      {aberto && (
                        <tr style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fafafa' }}>
                          <td colSpan={7 + (canExcluir ? 1 : 0)} style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px 24px', fontSize: '0.8rem', color: '#4b5563' }}>
                              <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '3px' }}>Descrição da alteração realizada</div>
                                <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{u.descricaoAlteracao || 'N/A'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '3px' }}>Descrição da peça</div>
                                <div>{u.descricaoPeca || 'N/A'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '3px' }}>Produto</div>
                                <div>{produtos.find(p => p.id === u.produtoId)?.nome || u.produtoId || 'N/A'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '3px' }}>Peso da peça</div>
                                <div>{(u.pesoPeca || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '3px' }}>Nº OS</div>
                                <div>{u.numeroOs || '—'}</div>
                              </div>
                              {u.solicitanteNome && (
                                <div>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '3px' }}>Solicitante</div>
                                  <div>{u.solicitanteNome}</div>
                                </div>
                              )}
                              {u.aprovadorNome && (
                                <div>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '3px' }}>Análise</div>
                                  <div>{u.aprovadorNome}{u.dataAprovacao ? ` em ${new Date(u.dataAprovacao).toLocaleDateString('pt-BR')}` : ''}</div>
                                </div>
                              )}
                              {statusU === 'Reutilização não aprovada' && u.motivoRejeicao && (
                                <div>
                                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-danger)', textTransform: 'uppercase', marginBottom: '3px' }}>Motivo da não aprovação</div>
                                  <div style={{ color: 'var(--color-danger)' }}>{u.motivoRejeicao}</div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

          </div>
        )}
      </div>

      <AccessibleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova reutilização" maxWidth="650px">
        <form onSubmit={handleCreateReutilizacao} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', maxWidth: '100%', width: '100%' }}>
          
          <div className="form-row-grid">
            <div>
              <label htmlFor="u_data" className="input-label">Data da reutilização</label>
              <input 
                id="u_data" type="date" className="input-field" required
                value={novaReutilizacao.data} 
                onChange={e => setNovaReutilizacao({...novaReutilizacao, data: e.target.value})} 
              />
            </div>
            <div>
              <label htmlFor="u_os" className="input-label">Nº OS (Ordem de Serviço)</label>
              <input 
                id="u_os" type="text" className="input-field" placeholder="Ex: OS-24567" required
                value={novaReutilizacao.numeroOs} 
                onChange={e => setNovaReutilizacao({...novaReutilizacao, numeroOs: e.target.value})} 
              />
            </div>
          </div>

          <div className="form-row-grid">
            <div>
              <label htmlFor="u_cod" className="input-label">Código da peça</label>
              <input 
                id="u_cod" type="text" className="input-field" placeholder="Ex: 51500101580" required
                value={novaReutilizacao.codigoPeca} 
                onChange={e => setNovaReutilizacao({...novaReutilizacao, codigoPeca: e.target.value})} 
              />
            </div>
            <div>
              <label htmlFor="u_desc_peca" className="input-label">Descrição da peça</label>
              <input 
                id="u_desc_peca" type="text" className="input-field" placeholder="Ex: SUP DIR LONGO DIANT" required
                value={novaReutilizacao.descricaoPeca} 
                onChange={e => setNovaReutilizacao({...novaReutilizacao, descricaoPeca: e.target.value})} 
              />
            </div>
          </div>

          <div className="form-row-grid">
            <div>
              <label htmlFor="u_prod" className="input-label">Produto</label>
              <select 
                id="u_prod" className="input-field" required
                value={novaReutilizacao.produtoId}
                onChange={e => setNovaReutilizacao({...novaReutilizacao, produtoId: e.target.value})}
              >
                <option value="">Selecione um produto</option>
                {produtos.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
                <option value="custom">Outro (cadastrar novo)…</option>
              </select>
            </div>
            <div>
              <label htmlFor="u_peso" className="input-label">Peso da Peça (kg)</label>
              <input 
                id="u_peso" type="number" step="0.001" className="input-field" placeholder="Ex: 2,150" required
                value={novaReutilizacao.pesoPeca || ''} 
                onChange={e => setNovaReutilizacao({...novaReutilizacao, pesoPeca: parseFloat(e.target.value) || 0})} 
              />
            </div>
          </div>

          {novaReutilizacao.produtoId === 'custom' && (
            <div style={{ border: '1px solid var(--color-border)', padding: '12px', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
              <label htmlFor="u_custom_prod" className="input-label">Nome do novo produto</label>
              <input 
                id="u_custom_prod" type="text" className="input-field" placeholder="Ex: SPE5500" required
                value={produtoCustomizado}
                onChange={e => setProdutoCustomizado(e.target.value)}
              />
            </div>
          )}

          <div className="form-row-grid">
            <div>
              <label htmlFor="u_saving" className="input-label">Hard Saving (R$)</label>
              <input 
                id="u_saving" type="number" step="0.01" className="input-field" placeholder="Ex: 22300.00" required
                value={novaReutilizacao.hardSaving || ''} 
                onChange={e => setNovaReutilizacao({...novaReutilizacao, hardSaving: parseFloat(e.target.value) || 0})} 
              />
            </div>
            <div>
              <label htmlFor="u_resp" className="input-label">Responsável</label>
              <input
                id="u_resp" type="text" className="input-field" readOnly aria-readonly="true"
                aria-describedby="u_resp_ajuda"
                value={nomeUsuario}
              />
              <div id="u_resp_ajuda" className="input-helper">Preenchido com o seu usuário.</div>
            </div>
          </div>

          <div>
            <label htmlFor="u_desc_alt" className="input-label">Descrição da alteração</label>
            <textarea 
              id="u_desc_alt" className="input-field" style={{ minHeight: '80px' }} placeholder="Descreva as adaptações no dispositivo…" required
              value={novaReutilizacao.descricaoAlteracao} 
              onChange={e => setNovaReutilizacao({...novaReutilizacao, descricaoAlteracao: e.target.value})} 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
            <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={salvandoReutilizacao} aria-busy={salvandoReutilizacao} style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: 'white' }}>{salvandoReutilizacao ? 'Registrando…' : 'Registrar reutilização'}</button>
          </div>
        </form>
      </AccessibleModal>

      <SolicitarReutilizacaoModal
        dispositivo={disp}
        isOpen={isSolicitarOpen}
        onClose={() => setIsSolicitarOpen(false)}
      />
    </>
  );
}
