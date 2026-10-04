import React, { useState } from 'react';
import { AccessibleModal } from './AccessibleModal';
import { useReTool } from '../context/ReToolContext';
import { Dispositivo } from '../domain/entities/dispositivo';
import { lerPlanilha, processarPlanilhaDispositivos, ResumoImportacao } from '../application/importacao/planilhaDispositivos';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { categorias, familias, produtos, importarDispositivosEmLote } = useReTool();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Partial<Dispositivo>[]>([]);
  const [newCategorias, setNewCategorias] = useState<string[]>([]);
  const [newFamilias, setNewFamilias] = useState<string[]>([]);
  const [newProdutos, setNewProdutos] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [defaultCategoriaId, setDefaultCategoriaId] = useState<string>('');

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setResumo(null);
    setErrorMsg('');
    setNewCategorias([]);
    setNewFamilias([]);
    setNewProdutos([]);
    setDefaultCategoriaId('');
  };

  const validateAndSetFile = (selected: File) => {
    const validTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const fileExt = selected.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(selected.type) && fileExt !== 'csv' && fileExt !== 'xlsx') {
      setErrorMsg('Formato inválido. Por favor, envie um arquivo .csv ou .xlsx.');
      setFile(null);
      setParsedData([]);
      return;
    }
    
    setErrorMsg('');
    setFile(selected);
    setParsedData([]); // Reseta o preview ao trocar de arquivo
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    resetState();
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    resetState();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsReading(true);
    try {
      const conteudo = await file.arrayBuffer();
      const abas = lerPlanilha(conteudo, file.name);
      const resultado = processarPlanilhaDispositivos(abas, {
        categorias,
        familias,
        produtos,
        defaultCategoriaId,
      });

      setResumo(resultado.resumo);
      if (resultado.dispositivos.length === 0) {
        setErrorMsg('Nenhum registro válido encontrado. Verifique se a planilha tem as colunas Código e Dispositivo.');
      } else {
        setParsedData(resultado.dispositivos);
        setNewCategorias(resultado.novasCategorias);
        setNewFamilias(resultado.novasFamilias);
        setNewProdutos(resultado.novosProdutos);
        setErrorMsg('');
      }
    } catch (err) {
      console.error('Erro ao ler planilha:', err);
      setErrorMsg('Ocorreu um erro ao ler o arquivo. Verifique o formato.');
    } finally {
      setIsReading(false);
    }
  };

  const handleConfirm = async () => {
    if (parsedData.length === 0) return;
    
    setIsProcessing(true);
    try {
      const result = await importarDispositivosEmLote(parsedData, newCategorias, newFamilias, newProdutos);
      if (result.erros > 0) {
        // Não fecha: o usuário precisa ver que nem tudo foi gravado.
        setErrorMsg(
          `Importação parcial: ${result.sucesso} de ${parsedData.length} registros gravados e ${result.erros} com erro. ` +
          'Clique em "Salvar Importação" novamente para gravar os restantes (os já gravados não serão duplicados).'
        );
        return;
      }
      resetState();
      onClose();
    } catch (err) {
      setErrorMsg('Falha ao importar registros.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    resetState();
    onClose();
  };

  return (
    <AccessibleModal isOpen={isOpen} onClose={handleClose} title="Importação em Lote" maxWidth="800px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius)',
            padding: 'var(--spacing-xl)',
            textAlign: 'center',
            backgroundColor: isDragging ? 'var(--color-hover)' : 'var(--color-surface)',
            transition: 'all 0.2s ease'
          }}
        >
          <Upload size={32} color="var(--color-primary)" style={{ margin: '0 auto', marginBottom: 'var(--spacing-sm)' }} />
          <h3 style={{ margin: '0 0 var(--spacing-xs) 0', fontSize: '1.1rem' }}>Arraste e solte ou selecione um arquivo .csv / .xlsx</h3>
          <p style={{ color: 'var(--color-text-body)', fontSize: '0.9rem', marginBottom: 'var(--spacing-md)' }}>
            As colunas devem seguir o padrão: Familia_do_Produto, PRODUTO, CATEGORIA, etc.
          </p>
          <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Buscar Arquivo
            <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
              disabled={isProcessing}
            />
          </label>
          
          {file && (
            <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '0.95rem', color: 'var(--color-text-dark)', fontWeight: 600 }}>
                Arquivo carregado: <span style={{ color: 'var(--color-primary)' }}>{file.name}</span>
              </div>
              
              {parsedData.length === 0 && !errorMsg && (
                <div style={{ width: '100%', maxWidth: '300px', textAlign: 'left' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', fontWeight: 600 }}>
                    Categoria Padrão (Opcional)
                  </label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-body)', marginBottom: '8px' }}>
                    Será aplicada a todos os registros que não tiverem uma coluna "Categoria".
                  </p>
                  <select 
                    className="form-control" 
                    value={defaultCategoriaId} 
                    onChange={(e) => setDefaultCategoriaId(e.target.value)}
                    style={{ width: '100%', marginBottom: '16px', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  >
                    <option value="">-- Usar apenas da Planilha --</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                  </select>

                  <button className="btn" onClick={processFile} disabled={isProcessing || isReading} style={{ width: '100%' }}>
                    {isReading ? 'Processando planilha...' : 'Processar Planilha'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius)', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            {errorMsg}
          </div>
        )}

        {parsedData.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-md)' }}>
              <CheckCircle2 size={20} color="var(--color-success)" />
              <span style={{ fontWeight: 600 }}>{parsedData.length.toLocaleString('pt-BR')} combinações únicas Código + Dispositivo</span>
              {newCategorias.length > 0 && (
                <span style={{ fontSize: '0.85rem', color: '#eab308', marginLeft: 'auto' }}>
                  ({newCategorias.length} novas categorias serão criadas)
                </span>
              )}
            </div>

            {resumo && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-body)', marginBottom: 'var(--spacing-md)' }}>
                <div>
                  {resumo.linhasLidas.toLocaleString('pt-BR')} linhas lidas · {resumo.duplicadasRemovidas.toLocaleString('pt-BR')} repetições da mesma combinação removidas
                  {resumo.linhasSemChave > 0 && <> · {resumo.linhasSemChave.toLocaleString('pt-BR')} linhas sem Código e Dispositivo ignoradas</>}
                </div>
                {resumo.abas.filter(a => !a.ignorada).map(a => (
                  <div key={a.nome}>
                    Aba "{a.nome}": {a.linhas.toLocaleString('pt-BR')} linhas · Código = {a.colunaCodigo ? `"${a.colunaCodigo}"` : 'não encontrada'} · Dispositivo = {a.colunaDispositivo ? `"${a.colunaDispositivo}"` : 'não encontrada'}
                  </div>
                ))}
                {resumo.avisos.map((aviso, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#b45309', fontWeight: 600 }}>
                    <AlertCircle size={16} /> {aviso}
                  </div>
                ))}
              </div>
            )}

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Nº Dispositivo</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Código</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Categoria (ID/Nome)</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 10).map((disp, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px' }}>{disp.nome}</td>
                      <td style={{ padding: '8px' }}>{disp.codigo}</td>
                      <td style={{ padding: '8px' }}>
                        {disp.categoriaId 
                          ? (categorias.find(c => c.id === disp.categoriaId)?.nome || disp.categoriaId) 
                          : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sem Categoria</span>
                        }
                      </td>
                      <td style={{ padding: '8px' }}>{disp.peso}</td>
                    </tr>
                  ))}
                  {parsedData.length > 10 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-body)' }}>
                        E mais {(parsedData.length - 10).toLocaleString('pt-BR')} registros...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'var(--spacing-lg)' }}>
              <button className="btn" onClick={() => { setParsedData([]); setResumo(null); setErrorMsg(''); }} disabled={isProcessing}>
                Voltar e Alterar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleConfirm} 
                disabled={isProcessing}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isProcessing ? 'Importando...' : `Salvar Importação (${parsedData.length.toLocaleString('pt-BR')})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </AccessibleModal>
  );
}
