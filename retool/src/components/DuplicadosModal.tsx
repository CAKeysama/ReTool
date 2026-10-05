import { useMemo, useState } from 'react';
import { AccessibleModal } from './AccessibleModal';
import { useReTool } from '../context/ReToolContext';
import { planejarLimpezaDuplicados } from '../domain/entities/dispositivo';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';

interface DuplicadosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const csvCampo = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * Verificação de dispositivos repetidos (mesma combinação Código + Dispositivo),
 * resíduo de importações antigas. Lista primeiro; só apaga depois que a
 * administradora baixa/revisa a lista e confirma. Documentos com vínculos
 * (reutilizações, imagens, anexos, observações) nunca são apagados.
 */
export function DuplicadosModal({ isOpen, onClose }: DuplicadosModalProps) {
  const { dispositivos, reutilizacoes, limparDispositivosDuplicados } = useReTool();
  const [confirmado, setConfirmado] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultado, setResultado] = useState<{ excluidos: number; erros: number } | null>(null);

  const plano = useMemo(
    () => planejarLimpezaDuplicados(dispositivos, new Set(reutilizacoes.map(u => u.dispositivoId))),
    [dispositivos, reutilizacoes]
  );
  const idsRemover = useMemo(() => plano.grupos.flatMap(g => g.remover.map(d => d.id)), [plano]);

  const baixarLista = () => {
    const linhas = [['acao', 'codigo', 'dispositivo', 'id', 'dataCriacao', 'motivo'].join(';')];
    for (const g of plano.grupos) {
      linhas.push(['manter', g.manter.codigo, g.manter.nome, g.manter.id, g.manter.dataCriacao, 'documento mantido'].map(csvCampo).join(';'));
      for (const d of g.remover) linhas.push(['remover', d.codigo, d.nome, d.id, d.dataCriacao, 'repetido sem vínculos'].map(csvCampo).join(';'));
      for (const d of g.revisar) linhas.push(['revisar', d.codigo, d.nome, d.id, d.dataCriacao, 'repetido com vínculos (não será apagado)'].map(csvCampo).join(';'));
    }
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retool-duplicados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRemover = async () => {
    setIsProcessing(true);
    try {
      const r = await limparDispositivosDuplicados(idsRemover);
      setResultado(r);
      setConfirmado(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setConfirmado(false);
    setResultado(null);
    onClose();
  };

  const fmt = (n: number) => n.toLocaleString('pt-BR');

  return (
    <AccessibleModal isOpen={isOpen} onClose={handleClose} title="Dispositivos duplicados" maxWidth="800px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-body)' }}>
          {fmt(plano.totalDocumentos)} documentos · {fmt(plano.combinacoesDistintas)} combinações Código + Dispositivo distintas ·{' '}
          {fmt(plano.grupos.length)} combinações repetidas
        </p>

        {resultado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: 'var(--radius)', fontSize: '0.9rem',
            backgroundColor: resultado.erros ? '#fee2e2' : '#dcfce7', color: resultado.erros ? '#b91c1c' : 'var(--color-success)' }}>
            {resultado.erros ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {fmt(resultado.excluidos)} removidos{resultado.erros ? `, ${fmt(resultado.erros)} com erro` : ''}.
          </div>
        )}

        {plano.grupos.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <CheckCircle2 size={20} color="var(--color-success)" /> Nenhuma combinação repetida.
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.9rem' }}>
              <strong>{fmt(plano.totalRemover)}</strong> repetidos sem vínculos podem ser removidos.
              {plano.totalRevisar > 0 && (
                <> <strong>{fmt(plano.totalRevisar)}</strong> repetidos têm reutilizações, imagens, anexos ou observações e <strong>não</strong> serão apagados (revise manualmente).</>
              )}
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)' }}>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Código</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Dispositivo</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Documentos</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Remover</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Revisar</th>
                  </tr>
                </thead>
                <tbody>
                  {plano.grupos.slice(0, 50).map(g => (
                    <tr key={g.chave} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px' }}>{g.codigo}</td>
                      <td style={{ padding: '8px' }}>{g.nome}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{1 + g.remover.length + g.revisar.length}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{g.remover.length}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{g.revisar.length}</td>
                    </tr>
                  ))}
                  {plano.grupos.length > 50 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-body)' }}>
                        E mais {fmt(plano.grupos.length - 50)} combinações — baixe a lista completa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <button className="btn" onClick={baixarLista} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={16} /> Baixar lista (.csv)
              </button>
              {plano.totalRemover > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} disabled={isProcessing} />
                    Revisei a lista
                  </label>
                  <button className="btn btn-primary" onClick={handleRemover} disabled={!confirmado || isProcessing}>
                    {isProcessing ? 'Removendo...' : `Remover ${fmt(plano.totalRemover)} duplicados`}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AccessibleModal>
  );
}
