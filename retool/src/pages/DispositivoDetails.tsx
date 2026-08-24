import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReTool } from '../context/ReToolContext';
import { ArrowLeft, Edit, Plus, Box, Key, Trash } from 'lucide-react';
import { AccessibleModal } from '../components/AccessibleModal';

export function DispositivoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dispositivos, categorias, reutilizacoes, familias, produtos, addReutilizacao, deleteReutilizacao, addProduto, openDispForm } = useReTool();
  
  const disp = dispositivos.find(p => p.id === id);
  const dispReutilizacoes = reutilizacoes.filter(u => u.dispositivoId === id);
  const categoria = categorias.find(c => c.id === disp?.categoriaId);
  const familia = familias.find(f => f.id === disp?.familiaId);
  const produto = produtos.find(p => p.id === disp?.produtoId);

  const [isModalOpen, setIsModalOpen] = useState(false);
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

  if (!disp) {
    return (
      <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>
        <p>Dispositivo não encontrado.</p>
        <button className="btn btn-primary" onClick={() => navigate('/dispositivos')}>Voltar</button>
      </div>
    );
  }

  const openModal = () => {
    const defaultPeso = disp.peso ? parseFloat(disp.peso.replace(',', '.')) : 0;
    setNovaReutilizacao({
      data: new Date().toISOString().split('T')[0],
      codigoPeca: disp.codigo || '',
      descricaoPeca: disp.nome || '',
      produtoId: disp.produtoId || '',
      pesoPeca: isNaN(defaultPeso) ? 0 : defaultPeso,
      hardSaving: 0,
      responsavel: '',
      numeroOs: '',
      descricaoAlteracao: ''
    });
    setProdutoCustomizado('');
    setIsModalOpen(true);
  };

  const handleCreateReutilizacao = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalProdutoId = novaReutilizacao.produtoId;
    
    if (finalProdutoId === 'custom') {
      if (!produtoCustomizado.trim()) {
        alert('Por favor, digite o nome do novo produto.');
        return;
      }
      finalProdutoId = await addProduto({ nome: produtoCustomizado.trim() });
    }

    await addReutilizacao({
      dispositivoId: disp.id,
      data: novaReutilizacao.data,
      codigoPeca: novaReutilizacao.codigoPeca,
      descricaoPeca: novaReutilizacao.descricaoPeca,
      produtoId: finalProdutoId,
      pesoPeca: Number(novaReutilizacao.pesoPeca),
      hardSaving: Number(novaReutilizacao.hardSaving),
      responsavel: novaReutilizacao.responsavel,
      numeroOs: novaReutilizacao.numeroOs,
      descricaoAlteracao: novaReutilizacao.descricaoAlteracao
    });

    setIsModalOpen(false);
  };

  const getBadgeColor = (text: string) => {
    if (!text) return 'badge';
    const c = text.charCodeAt(0) % 4;
    return c === 0 ? 'badge badge-pink' : c === 1 ? 'badge badge-teal' : c === 2 ? 'badge badge-yellow' : 'badge badge-blue';
  };

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
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{disp.nome || 'Sem Nome'}</h2>
            <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{disp.codigo || 'S/C'}</div>
          </div>
        </div>
        <button 
          className="btn" 
          onClick={() => openDispForm(disp.id)}
          style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem' }}
        >
          <Edit size={14} /> Editar
        </button>
      </div>

      <div className="details-grid">
        
        {/* CARTÃO: DADOS DO DISPOSITIVO */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-lg)' }}>
            <Box size={16} color="var(--color-primary)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Dados da Peça e Dispositivo</h3>
          </div>

          <div className="form-row-grid" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Nº dispositivo</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.nome || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>CÓDIGO PEÇA</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.codigo || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
          </div>

          <div className="form-row-grid" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>PESO dispositivo</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.peso ? `${disp.peso}` : <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>PALAVRAS CHAVE</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(disp.palavrasChave || []).map(tag => (
                  <span key={tag} className="badge badge-pink">{tag}</span>
                ))}
                {(disp.palavrasChave || []).length === 0 && <span style={{color: '#d1d5db'}}>Não info.</span>}
              </div>
            </div>
          </div>

          <div className="form-row-grid" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Família do Produto</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{familia?.nome || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Produto</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{produto?.nome || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
          </div>

          <div className="form-row-grid" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>CATEGORIA</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{categoria?.nome || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
          </div>

          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>DESCRIÇÃO PEÇA</div>
            <div style={{ color: 'var(--color-text-dark)', fontSize: '0.9rem', lineHeight: 1.6 }}>{disp.descricao || <span style={{color: '#d1d5db'}}>Não informada.</span>}</div>
          </div>

          {disp.observacoes && (
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Observações (Legado)</div>
              <div style={{ color: 'var(--color-text-dark)', fontSize: '0.9rem', lineHeight: 1.6 }}>{disp.observacoes}</div>
            </div>
          )}

          {/* Seção de Mídia Relacionada */}
          {(disp.imagemPeca || disp.imagemDispositivo) && (
            <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-md)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 'var(--spacing-sm)' }}>Mídia Relacionada</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                {disp.imagemPeca && (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', backgroundColor: '#f9fafb' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>IMAGEM PEÇA</span>
                    <img src={disp.imagemPeca} alt="Imagem da peça" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }} />
                  </div>
                )}
                {disp.imagemDispositivo && (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', backgroundColor: '#f9fafb' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Imagem dispositivo</span>
                    <img src={disp.imagemDispositivo} alt="Imagem do dispositivo" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)' }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CARTÃO: RESUMO */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, marginBottom: 'var(--spacing-lg)' }}>Resumo do Dispositivo</h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Reutilizações</span>
            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{dispReutilizacoes.length}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Hard Saving Total</span>
            <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>R$ {totalHardSaving.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Primeira Reutilização</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.85rem' }}>
              {primeiraReutilizacao ? formatDisplayDate(primeiraReutilizacao.data || primeiraReutilizacao.dataCriacao || '') : 'N/A'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Última Reutilização</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.85rem' }}>
              {ultimaReutilizacao ? formatDisplayDate(ultimaReutilizacao.data || ultimaReutilizacao.dataCriacao || '') : 'N/A'}
            </span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Categoria</span>
            {categoria?.nome ? <span className={getBadgeColor(categoria.nome)}>{categoria.nome}</span> : <span style={{color: '#d1d5db', fontSize: '0.85rem'}}>N/A</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Família</span>
            {familia?.nome ? <span className={getBadgeColor(familia.nome)}>{familia.nome}</span> : <span style={{color: '#d1d5db', fontSize: '0.85rem'}}>N/A</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Cadastro</span>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{new Date(disp.dataCriacao || '').toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

      </div>

      {/* HISTÓRICO DE REUTILIZAÇÕES EM FORMATO DE TABELA */}
      <div className="card" style={{ padding: 0, marginTop: 'var(--spacing-lg)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Histórico de Reutilizações</h3>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Todas as reutilizações registradas para este dispositivo.</p>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={openModal}
            aria-label="Registrar Nova Reutilização"
          >
            <Plus size={16} /> Nova Reutilização
          </button>
        </div>
        
        {dispReutilizacoes.length === 0 ? (
          <div style={{ padding: 'var(--spacing-lg)', color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center' }}>
            Nenhuma reutilização registrada ainda.
          </div>
        ) : (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', width: '45px', textAlign: 'center' }}>Nº</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', width: '85px', whiteSpace: 'nowrap' }}>Data</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', width: '110px', whiteSpace: 'nowrap' }}>Código da Peça</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', width: '135px', whiteSpace: 'nowrap' }}>Descrição da Peça</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', width: '90px', whiteSpace: 'nowrap' }}>Produto</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', width: '90px', whiteSpace: 'nowrap' }}>Peso Peça (kg)</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', width: '110px', whiteSpace: 'nowrap' }}>Hard Saving (R$)</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', width: '100px', whiteSpace: 'nowrap' }}>Responsável</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', width: '80px', whiteSpace: 'nowrap' }}>Nº OS</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Descrição da Alteração Realizada</th>
                  <th style={{ padding: '10px 8px', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedReutilizacoes.map((u, idx) => {
                  const itemNumber = sortedReutilizacoes.length - idx;
                  const isMostRecent = idx === 0;
                  const p = produtos.find(prod => prod.id === u.produtoId);
                  const displayProduto = p ? p.nome : (u.produtoId || 'N/A');

                  // Formatação de data
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

                  // Estilos dinâmicos com destaque para o mais recente
                  const cellTextColor = isMostRecent ? 'var(--color-primary)' : 'var(--color-text-dark)';
                  const normalCellColor = 'var(--color-text-dark)';
                  const fontWeightVal = isMostRecent ? 600 : 400;

                  return (
                    <tr 
                      key={u.id} 
                      style={{ 
                        borderBottom: '1px solid #f3f4f6', 
                        backgroundColor: isMostRecent ? 'rgba(228, 13, 44, 0.02)' : 'transparent',
                        borderLeft: isMostRecent ? '4px solid var(--color-primary)' : 'none'
                      }}
                    >
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
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
                      <td style={{ padding: '12px 8px', color: cellTextColor, fontWeight: fontWeightVal, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayDate}</td>
                      <td style={{ padding: '12px 8px', color: cellTextColor, fontWeight: fontWeightVal, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.codigoPeca || 'N/A'}</td>
                      <td style={{ padding: '12px 8px', color: normalCellColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.descricaoPeca}>{u.descricaoPeca || 'N/A'}</td>
                      <td style={{ padding: '12px 8px', color: cellTextColor, fontWeight: fontWeightVal, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayProduto}</td>
                      <td style={{ padding: '12px 8px', color: normalCellColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.pesoPeca?.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) || '0,000'}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--color-success)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.hardSaving?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}</td>
                      <td style={{ padding: '12px 8px', color: normalCellColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.responsavel}>{u.responsavel || 'N/A'}</td>
                      <td style={{ padding: '12px 8px', color: normalCellColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.numeroOs || 'N/A'}</td>
                      <td style={{ padding: '12px 8px', color: '#4A4A4A', lineHeight: 1.4, wordBreak: 'break-word' }}>{u.descricaoAlteracao || 'N/A'}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <button 
                          className="btn" 
                          style={{ border: 'none', padding: 0, color: 'var(--color-danger)', background: 'transparent', boxShadow: 'none', minHeight: 'unset', height: 'auto' }}
                          onClick={() => confirm('Apagar esta reutilização?') && deleteReutilizacao(u.id)}
                        >
                          <Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Rodapé da Tabela */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: '#f9fafb', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4A4A4A', fontWeight: 500 }}>
                <Edit size={16} />
                <span>Total de reutilizações: <strong>{sortedReutilizacoes.length}</strong></span>
              </div>
              <div style={{ fontSize: '0.95rem', color: '#4A4A4A', fontWeight: 500 }}>
                Hard Saving acumulado: <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>R$ {totalHardSaving.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <AccessibleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Reutilização" maxWidth="650px">
        <form onSubmit={handleCreateReutilizacao} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', maxWidth: '100%', width: '100%' }}>
          
          <div className="form-row-grid">
            <div>
              <label htmlFor="u_data" className="input-label">Data da Reutilização</label>
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
              <label htmlFor="u_cod" className="input-label">Código da Peça</label>
              <input 
                id="u_cod" type="text" className="input-field" placeholder="Ex: 51500101580" required
                value={novaReutilizacao.codigoPeca} 
                onChange={e => setNovaReutilizacao({...novaReutilizacao, codigoPeca: e.target.value})} 
              />
            </div>
            <div>
              <label htmlFor="u_desc_peca" className="input-label">Descrição da Peça</label>
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
                <option value="custom">Outro (cadastrar novo)...</option>
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
              <label htmlFor="u_custom_prod" className="input-label">Nome do Novo Produto</label>
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
                id="u_resp" type="text" className="input-field" placeholder="Ex: João Silva" required
                value={novaReutilizacao.responsavel} 
                onChange={e => setNovaReutilizacao({...novaReutilizacao, responsavel: e.target.value})} 
              />
            </div>
          </div>

          <div>
            <label htmlFor="u_desc_alt" className="input-label">Descrição da Alteração Realizada</label>
            <textarea 
              id="u_desc_alt" className="input-field" style={{ minHeight: '80px' }} placeholder="Descreva as adaptações no dispositivo..." required
              value={novaReutilizacao.descricaoAlteracao} 
              onChange={e => setNovaReutilizacao({...novaReutilizacao, descricaoAlteracao: e.target.value})} 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
            <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: 'white' }}>Registrar Reutilização</button>
          </div>
        </form>
      </AccessibleModal>
    </>
  );
}
