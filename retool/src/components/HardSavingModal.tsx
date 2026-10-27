import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { AccessibleModal } from './AccessibleModal';
import { useReTool } from '../context/ReToolContext';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { mensagemDeErro } from './feedback/EstadoDados';
import { gravarComPrazo } from '../utils/tempo';
import { lerValorMonetario } from '../utils/moeda';
import { Reutilizacao } from '../domain/entities/reutilizacao';

interface HardSavingModalProps {
  /** Reutilização em edição; null = fechado. */
  reutilizacao: Reutilizacao | null;
  /** Nome do dispositivo, só para contexto no título. */
  nomeDispositivo?: string;
  onClose: () => void;
}

/** Projetista/Administração definem o Hard Saving de uma reutilização (a Engenharia não o informa). */
export function HardSavingModal({ reutilizacao, nomeDispositivo, onClose }: HardSavingModalProps) {
  const { definirHardSaving } = useReTool();
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const campoId = useId();

  useEffect(() => {
    if (!reutilizacao) return;
    setValor(reutilizacao.hardSaving ? String(reutilizacao.hardSaving) : '');
    setErro('');
  }, [reutilizacao]);

  const salvar = useAsyncAction(async (id: string, numero: number) => {
    await gravarComPrazo(definirHardSaving(id, numero));
  });

  const fechar = () => { if (!salvar.emAndamento) onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reutilizacao || salvar.emAndamento) return;
    const numero = lerValorMonetario(valor);
    if (numero === null) {
      setErro('Informe um valor válido, zero ou maior.');
      return;
    }
    setErro('');
    const r = await salvar.executar(reutilizacao.id, numero);
    if (r.ok) onClose();
    else if (!r.ignorado) setErro(mensagemDeErro(r.erro, 'Não foi possível salvar o Hard Saving. Tente novamente.'));
  };

  return (
    <AccessibleModal isOpen={!!reutilizacao} onClose={fechar} title="Hard Saving da reutilização" maxWidth="420px">
      <form onSubmit={handleSubmit} noValidate aria-busy={salvar.emAndamento || undefined}>
        <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.5 }}>
          {nomeDispositivo && <><strong>Dispositivo:</strong> {nomeDispositivo}<br /></>}
          <strong>Alteração:</strong> {reutilizacao?.descricaoAlteracao || 'Descrição não informada'}
        </p>

        {erro && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontSize: '0.82rem', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>{erro}</span>
          </div>
        )}

        <label htmlFor={campoId} style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
          Hard Saving (R$)
        </label>
        <input
          id={campoId}
          type="text"
          inputMode="decimal"
          autoFocus
          value={valor}
          disabled={salvar.emAndamento}
          onChange={e => setValor(e.target.value)}
          placeholder="0,00"
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button type="button" className="btn" onClick={fechar} disabled={salvar.emAndamento}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvar.emAndamento} aria-busy={salvar.emAndamento || undefined}>
            {salvar.emAndamento && <LoaderCircle size={16} className="estado-dados-girando" aria-hidden="true" />}
            {salvar.emAndamento ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </AccessibleModal>
  );
}
