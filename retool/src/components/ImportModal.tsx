import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { AccessibleModal } from './AccessibleModal';
import { useReTool, Dispositivo } from '../context/ReToolContext';
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
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [defaultCategoriaId, setDefaultCategoriaId] = useState<string>('');

  const resetState = () => {
    setFile(null);
    setParsedData([]);
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

  const processFile = () => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        const devices: Partial<Dispositivo>[] = [];
        const missingCategories = new Set<string>();
        const missingFamilias = new Set<string>();
        const missingProdutos = new Set<string>();

        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet) as any[];
            if (json.length === 0) return;
               
            const getColName = (row: any, ...possibilities: string[]) => {
                const keys = Object.keys(row);
                for (const p of possibilities) {
                    const found = keys.find(k => k.trim().toLowerCase() === p.toLowerCase());
                    if (found) return found;
                }
                return null;
            };

            json.forEach((row, index) => {
              try {
                const getStr = (val: any) => val ? String(val).trim() : '';
                
                const colPeso = getColName(row, 'Peso', 'Peso ', 'Peso (Kg)', 'Peso Dispositivo (Kg)');
                const colFamilia = getColName(row, 'Familia', 'Familia_do_Produto', 'Familia do Produto');
                const colProduto = getColName(row, 'Produto', 'PRODUTO');
                // Usuário pediu para trocar Categoria por Tipo de Dispositivo
                const colCategoria = getColName(row, 'Categoria', 'CATEGORIA', 'Tipo de Dispositivo', 'Tipo Dispositivo', 'Tipo');
                const colCodigo = getColName(row, 'Código', 'Codigo', 'Código da Peça', 'Codigo da Peca');
                const colDescricao = getColName(row, 'Descrição', 'Descricao', 'Descrição da Peça', 'Descricao da Peca');
                const colNome = getColName(row, 'Dispositivo', 'Nº Dispositivo', 'N Dispositivo', 'Nome');
                const colPalavraChave = getColName(row, 'Palavra chave', 'Palavras chaves', 'Palavras-chave', 'Palavras chave');

                if (!colCodigo && !colNome) return;

                const rawPeso = colPeso ? getStr(row[colPeso]) : '';
                const pesoConvertido = rawPeso ? parseFloat(rawPeso.replace(',', '.')) : 0;

                const familia = colFamilia ? getStr(row[colFamilia]) : '';
                const produto = colProduto ? getStr(row[colProduto]) : '';
                const categoriaNome = colCategoria ? getStr(row[colCategoria]) : '';
                const codigo = colCodigo ? getStr(row[colCodigo]) : '';
                const descricao = colDescricao ? getStr(row[colDescricao]).replace(/[\r\n]+/g, ' ') : '';
                const nome = colNome ? getStr(row[colNome]) : '';
                const palavrasRaw = colPalavraChave ? getStr(row[colPalavraChave]) : '';

                let catId = defaultCategoriaId; 
                if (categoriaNome) {
                  const catExists = categorias.find(c => c.nome?.toLowerCase() === categoriaNome.toLowerCase());
                  if (catExists) {
                    catId = catExists.id;
                  } else {
                    missingCategories.add(categoriaNome);
                    catId = categoriaNome;
                  }
                }

                let famId = '';
                if (familia) {
                  const famExists = familias.find(f => f.nome?.toLowerCase() === familia.toLowerCase());
                  if (famExists) {
                    famId = famExists.id;
                  } else {
                    missingFamilias.add(familia);
                    famId = familia;
                  }
                }

                let prodId = '';
                if (produto) {
                  const prodExists = produtos.find(p => p.nome?.toLowerCase() === produto.toLowerCase());
                  if (prodExists) {
                    prodId = prodExists.id;
                  } else {
                    missingProdutos.add(produto);
                    prodId = produto;
                  }
                }

                const palavrasChave = palavrasRaw 
                  ? palavrasRaw.split(',').map(p => p.trim()).filter(Boolean)
                  : [];

                if (codigo || nome) {
                  const existingIdx = devices.findIndex(d => d.codigo === codigo && d.nome === nome);
                  
                  const deviceObj = {
                    familiaId: famId,
                    produtoId: prodId,
                    categoriaId: catId,
                    codigo: codigo,
                    descricao: descricao,
                    nome: nome,
                    peso: isNaN(pesoConvertido) ? '' : String(pesoConvertido),
                    palavrasChave: palavrasChave,
                    imagemPeca: '',
                    imagemDispositivo: ''
                  };

                  if (existingIdx >= 0) {
                     devices[existingIdx] = { ...devices[existingIdx], ...deviceObj };
                  } else {
                     devices.push(deviceObj);
                  }
                }
              } catch (rowErr) {
                console.warn(`Erro ao processar linha Tabular ${index + 2} na aba ${sheetName}:`, rowErr);
              }
            });
        });

        const finalDevices = devices.filter(d => d.codigo || d.nome);

        if (finalDevices.length === 0) {
           setErrorMsg('Nenhum registro válido encontrado. Verifique o formato do arquivo.');
        } else {
           setParsedData(finalDevices);
           setNewCategorias(Array.from(missingCategories));
           setNewFamilias(Array.from(missingFamilias));
           setNewProdutos(Array.from(missingProdutos));
           setErrorMsg('');
        }
      } catch (err) {
        console.error('Erro ao ler planilha:', err);
        setErrorMsg('Ocorreu um erro ao ler o arquivo. Verifique o formato.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirm = async () => {
    if (parsedData.length === 0) return;
    
    setIsProcessing(true);
    try {
      await importarDispositivosEmLote(parsedData, newCategorias, newFamilias, newProdutos);
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

                  <button className="btn" onClick={processFile} disabled={isProcessing} style={{ width: '100%' }}>
                    Processar Planilha
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

        {parsedData.length > 0 && !errorMsg && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-md)' }}>
              <CheckCircle2 size={20} color="var(--color-success)" />
              <span style={{ fontWeight: 600 }}>{parsedData.length} registros válidos encontrados</span>
              {newCategorias.length > 0 && (
                <span style={{ fontSize: '0.85rem', color: '#eab308', marginLeft: 'auto' }}>
                  ({newCategorias.length} novas categorias serão criadas)
                </span>
              )}
            </div>

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
                        E mais {parsedData.length - 10} registros...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'var(--spacing-lg)' }}>
              <button className="btn" onClick={() => { setParsedData([]); setErrorMsg(''); }} disabled={isProcessing}>
                Voltar e Alterar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleConfirm} 
                disabled={isProcessing}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isProcessing ? 'Importando...' : `Salvar Importação (${parsedData.length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </AccessibleModal>
  );
}
