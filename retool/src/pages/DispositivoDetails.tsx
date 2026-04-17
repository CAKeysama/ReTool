import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReTool } from '../context/ReToolContext';
import { ArrowLeft, Edit, Plus, Box, Key, Trash } from 'lucide-react';
import { AccessibleModal } from '../components/AccessibleModal';

export function DispositivoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dispositivos, categorias, utilizacoes, addUtilizacao, deleteUtilizacao } = useReTool();
  
  const disp = dispositivos.find(p => p.id === id);
  const dispUtilizacoes = utilizacoes.filter(u => u.dispositivoId === id);
  const categoria = categorias.find(c => c.id === disp?.categoriaId);

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
          onClick={() => navigate(`/dispositivos/${disp.id}/editar`)}
          style={{ padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem' }}
        >
          <Edit size={14} /> Editar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
        
        {/* CARTÃO: DADOS DO DISPOSITIVO */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-lg)' }}>
            <Box size={16} color="var(--color-primary)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Dados do dispositivo</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Nome</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.nome || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Código</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.codigo || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Categoria</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{categoria?.nome || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Tipo</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{'Não info.'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Família de Produto</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.familiaProduto || <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Peso</div>
              <div style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{disp.peso ? `${disp.peso} kg` : <span style={{color: '#d1d5db'}}>Não info.</span>}</div>
            </div>
          </div>

          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Descrição</div>
            <div style={{ color: 'var(--color-text-dark)', fontSize: '0.9rem', lineHeight: 1.6 }}>{disp.descricao || <span style={{color: '#d1d5db'}}>Não informada.</span>}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Observações</div>
            <div style={{ color: 'var(--color-text-dark)', fontSize: '0.9rem', lineHeight: 1.6 }}>{disp.observacoes || <span style={{color: '#d1d5db'}}>Não informado.</span>}</div>
          </div>
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
            style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '16px' }}
          >
            <Plus size={14} /> Adicionar
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
