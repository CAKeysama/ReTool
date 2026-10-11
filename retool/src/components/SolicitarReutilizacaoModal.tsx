import React, { useEffect, useId, useState } from 'react';
import { useReTool } from '../context/ReToolContext';
import { useAuth } from '../context/AuthContext';
import { Dispositivo } from '../domain/entities/dispositivo';
import { X, Send, Cpu, AlertCircle, LoaderCircle } from 'lucide-react';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { mensagemDeErro } from './feedback/EstadoDados';
import { gravarComPrazo } from '../utils/tempo';

interface SolicitarReutilizacaoModalProps {
  dispositivo: Dispositivo;
  isOpen: boolean;
  onClose: () => void;
}

export function SolicitarReutilizacaoModal({ dispositivo, isOpen, onClose }: SolicitarReutilizacaoModalProps) {
  const { produtos, solicitarReutilizacao } = useReTool();
  const { userProfile } = useAuth();

  const [codigoPeca, setCodigoPeca] = useState('');
  const [descricaoPeca, setDescricaoPeca] = useState('');
  const [produtoId, setProdutoId] = useState(produtos[0]?.id || '');
  const [numeroOs, setNumeroOs] = useState('');
  const [pesoPeca, setPesoPeca] = useState<number | ''>('');
  const [hardSaving, setHardSaving] = useState<number | ''>('');
  const [descricaoAlteracao, setDescricaoAlteracao] = useState('');
  const [erro, setErro] = useState('');
  const tituloId = useId();

  // Envio com trava contra clique duplo; o sucesso só é anunciado depois da gravação.
  const envio = useAsyncAction(async () => {
    const solicitante = userProfile?.nome || 'Engenharia de Processo';

    await gravarComPrazo(solicitarReutilizacao(
      {
        dispositivoId: dispositivo.id,
        data: new Date().toISOString().split('T')[0],
        codigoPeca: codigoPeca.trim(),
        descricaoPeca: descricaoPeca.trim() || dispositivo.nome,
        produtoId: produtoId || produtos[0]?.id || 'padrao',
        pesoPeca: Number(pesoPeca) || 0,
        hardSaving: Number(hardSaving) || 0,
        responsavel: solicitante,
        numeroOs: numeroOs.trim(),
        descricaoAlteracao: descricaoAlteracao.trim()
      },
      solicitante,
      userProfile?.uid
    ));
  });
  const loading = envio.emAndamento;

  const fechar = () => { if (!loading) onClose(); };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErro('');
    if (!codigoPeca.trim() || !descricaoAlteracao.trim()) {
      setErro('Preencha o código da peça e a descrição da alteração pretendida.');
      return;
    }
    const r = await envio.executar();
    if (r.ok) {
      // A mensagem de sucesso é anunciada pelo contexto, após a gravação e a auditoria.
      onClose();
    } else if (!r.ignorado) {
      setErro(mensagemDeErro(r.erro, 'Erro ao enviar solicitação.'));
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
    >
      <div style={{
        backgroundColor: 'white',
        borderRadius: 'var(--radius)',
        maxWidth: '650px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden'
      }}>
        {/* HEADER */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fff7ed'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: '#ea580c',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Cpu size={20} />
            </div>
            <div>
              <h2 id={tituloId} style={{ margin: 0, fontSize: '1.15rem', color: '#9a3412', fontWeight: 700 }}>
                Solicitar Reutilização de Dispositivo
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#c2410c' }}>
                Dispositivo: <strong>{dispositivo.nome}</strong> (ID: {dispositivo.id.substring(0, 8)})
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={fechar}
            disabled={loading}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} noValidate aria-busy={loading || undefined} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* A rolagem fica num <div>: o Chrome não rola um <fieldset> com overflow. */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <fieldset disabled={loading} style={{ border: 'none', minWidth: 0, margin: 0, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {erro && (
              <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '0.82rem', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '6px' }}>
                <AlertCircle size={16} />
                <span>{erro}</span>
              </div>
            )}

            <div style={{ padding: '10px 14px', backgroundColor: '#fef3c7', borderRadius: '6px', fontSize: '0.78rem', color: '#92400e', lineHeight: 1.4 }}>
              <strong>Fluxo de Aprovação:</strong> A Engenharia formula a solicitação de reutilização. Ela entrará com status <strong>Pendente</strong> e será analisada e aprovada pelo <strong>Projetista</strong> da Ferramentaria.
            </div>

            <div className="form-row-grid" style={{ gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Código da Nova Peça *
                </label>
                <input
                  type="text"
                  required
                  value={codigoPeca}
                  onChange={e => setCodigoPeca(e.target.value)}
                  placeholder="Ex: PC-9842"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Número da O.S. (Ordem de Serviço)
                </label>
                <input
                  type="text"
                  value={numeroOs}
                  onChange={e => setNumeroOs(e.target.value)}
                  placeholder="Ex: OS-2026-104"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>

            <div className="form-row-grid" style={{ gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Descrição da Peça
                </label>
                <input
                  type="text"
                  value={descricaoPeca}
                  onChange={e => setDescricaoPeca(e.target.value)}
                  placeholder="Descrição da nova peça ou modelo"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Produto / Projeto Destino
                </label>
                <select
                  value={produtoId}
                  onChange={e => setProdutoId(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                >
                  {produtos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                  {produtos.length === 0 && <option value="">Nenhum produto cadastrado</option>}
                </select>
              </div>
            </div>

            <div className="form-row-grid" style={{ gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Peso Estimado (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={pesoPeca}
                  onChange={e => setPesoPeca(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                  Hard Saving Estimado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={hardSaving}
                  onChange={e => setHardSaving(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Descrição da Alteração / Justificativa Técnica *
              </label>
              <textarea
                required
                rows={3}
                value={descricaoAlteracao}
                onChange={e => setDescricaoAlteracao(e.target.value)}
                placeholder="Descreva as modificações mecânicas/elétricas necessárias para reaproveitar este dispositivo..."
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontFamily: 'inherit' }}
              />
            </div>
          </fieldset>
          </div>

          {/* FOOTER */}
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: '#fafafa'
          }}>
            <button
              type="button"
              onClick={fechar}
              disabled={loading}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                color: '#374151',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading || undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: '#ea580c',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: loading ? 'progress' : 'pointer',
                opacity: loading ? 0.8 : 1
              }}
            >
              {loading ? <LoaderCircle size={16} className="estado-dados-girando" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
              <span>{loading ? 'Enviando…' : 'Enviar Solicitação'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
