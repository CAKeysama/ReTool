import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReTool } from '../context/ReToolContext';
import { ArrowLeft, Edit, Plus, Box, Key, Trash } from 'lucide-react';
import { AccessibleModal } from '../components/AccessibleModal';

export function DispositivoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dispositivos, categorias, tipos, utilizacoes, addUtilizacao, deleteUtilizacao, openDispForm } = useReTool();
  
  const disp = dispositivos.find(p => p.id === id);
  const dispUtilizacoes = utilizacoes.filter(u => u.dispositivoId === id);
  const categoria = categorias.find(c => c.id === disp?.categoriaId);
  const tipo = tipos.find(t => t.id === disp?.tipo);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novaUtilizacao, setNovaUtilizacao] = useState({ descricao: '', setor: '', observacoes: '' });

  if (!disp) {
    return (
      <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>
        <p>Dispositivo não encontrado.</p>
        <button className="btn btn-primary" onClick={() => navigate('/dispositivos')}>Voltar</button>
      </div>
    );
  }

  const handleCreateUtilizacao = (e: React.FormEvent) => {
    e.preventDefault();
    addUtilizacao({
      dispositivoId: disp.id,
      ...novaUtilizacao
    });
    setIsModalOpen(false);
    setNovaUtilizacao({ descricao: '', setor: '', observacoes: '' });
  };

  const getBadgeColor = (text: string) => {
    if (!text) return 'badge';
    const c = text.charCodeAt(0) % 4;
    return c === 0 ? 'badge badge-pink' : c === 1 ? 'badge badge-teal' : c === 2 ? 'badge badge-yellow' : 'badge badge-blue';
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
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.familiaProduto || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Produto</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.produto || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
          </div>

          <div className="form-row-grid" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>CATEGORIA</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{categoria?.nome || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
            {tipo?.nome && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Tipo (Legado)</div>
                <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{tipo.nome}</div>
              </div>
            )}
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
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, marginBottom: 'var(--spacing-lg)' }}>Resumo</h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Utilizações</span>
            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{dispUtilizacoes.length}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Categoria</span>
            {categoria?.nome ? <span className={getBadgeColor(categoria.nome)}>{categoria.nome}</span> : <span style={{color: '#d1d5db', fontSize: '0.85rem'}}>N/A</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Família</span>
            {disp.familiaProduto ? <span className={getBadgeColor(disp.familiaProduto)}>{disp.familiaProduto}</span> : <span style={{color: '#d1d5db', fontSize: '0.85rem'}}>N/A</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Cadastro</span>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{new Date(disp.dataCriacao || '').toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

      </div>

      {/* CARTÃO COM LISTA: UTILIZAÇÕES */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={16} color="var(--color-primary)" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Utilizações ({dispUtilizacoes.length})</h3>
          </div>
          <button 
            className="btn" 
            onClick={() => setIsModalOpen(true)}
            aria-label="Adicionar Utilização"
            style={{ width: '32px', height: '32px', padding: 0 }}
          >
            <Plus size={16} />
          </button>
        </div>
        
        <div style={{ padding: 'var(--spacing-lg)' }}>
           {dispUtilizacoes.length === 0 ? (
             <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Nenhuma utilização registrada ainda.</div>
           ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {dispUtilizacoes.map(u => (
                <li key={u.id} style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ marginTop: '6px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-box-teal-text)' }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-text-dark)' }}>{u.descricao || 'Sem descrição'}</div>
                       <button 
                          className="btn" 
                          style={{ border: 'none', padding: 0, color: 'var(--color-danger)' }}
                          onClick={() => confirm('Apagar?') && deleteUtilizacao(u.id)}
                        >
                          <Trash size={14} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {u.setor || 'Setor N/A'} • {u.observacoes && <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>{u.observacoes}</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginTop: '4px' }}>
                      Registrado em {new Date(u.dataCriacao || '').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
           )}
        </div>
      </div>

      <AccessibleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Adicionar Utilização">
        <form onSubmit={handleCreateUtilizacao} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
           <div>
            <label htmlFor="u_desc" className="input-label">Descrição da ação / evento</label>
            <input 
              id="u_desc" className="input-field" autoFocus
              value={novaUtilizacao.descricao} 
              onChange={e => setNovaUtilizacao({...novaUtilizacao, descricao: e.target.value})} 
            />
          </div>
          <div>
            <label htmlFor="u_setor" className="input-label">Linha / Setor</label>
            <input 
              id="u_setor" className="input-field" 
              value={novaUtilizacao.setor} 
              onChange={e => setNovaUtilizacao({...novaUtilizacao, setor: e.target.value})} 
            />
          </div>
          <div>
            <label htmlFor="u_obs" className="input-label">Observação adicional</label>
            <textarea 
              id="u_obs" className="input-field" 
              value={novaUtilizacao.observacoes} 
              onChange={e => setNovaUtilizacao({...novaUtilizacao, observacoes: e.target.value})} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
             <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
             <button type="submit" className="btn btn-primary">Registrar</button>
          </div>
        </form>
      </AccessibleModal>

    </>
  );
}
