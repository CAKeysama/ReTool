import React, { useEffect, useRef, useState } from 'react';
import { useAvisoAoSair } from '../hooks/useAvisoAoSair';
import { AccessibleModal } from './AccessibleModal';
import { useReTool } from '../context/ReToolContext';
import { Dispositivo } from '../domain/entities/dispositivo';
import type { ProgressoPlanilha, ResumoImportacao } from '../application/importacao/planilhaDispositivos';
import { contextoSerializavel } from '../application/importacao/contextoPlanilha';
import {
  ProcessamentoCancelado, TarefaPlanilha, processarPlanilhaNoWorker,
} from '../application/importacao/processarPlanilhaNoWorker';
import type { ProgressoImportacao, ResultadoImportacaoLote } from '../domain/repositories/IDispositivosRepository';
import { BarraProgresso } from './feedback';
import { Upload, AlertCircle, CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Fases do modal. A leitura/processamento da planilha roda num Web Worker
 * (a tela continua respondendo) e a gravação em lotes no Firestore; as duas
 * mostram progresso real e podem ser canceladas.
 */
type Fase = 'selecao' | 'processando' | 'previa' | 'importando' | 'resumo';

/** Etapas visíveis, na ordem em que acontecem. */
const ETAPAS = [
  { id: 'lendo-arquivo', rotulo: 'Lendo arquivo' },
  { id: 'processando', rotulo: 'Processando planilha' },
  { id: 'lendo-existentes', rotulo: 'Lendo dispositivos existentes' },
  { id: 'gravando', rotulo: 'Gravando' },
] as const;
type EtapaVisivel = typeof ETAPAS[number]['id'];

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('pt-BR');

function etapaDaPlanilha(p: ProgressoPlanilha | null): EtapaVisivel {
  return !p || p.etapa === 'lendo-arquivo' ? 'lendo-arquivo' : 'processando';
}

function etapaDaImportacao(p: ProgressoImportacao | null): EtapaVisivel {
  if (!p || p.etapa === 'lendo-existentes') return 'lendo-existentes';
  return 'gravando';
}

function rotuloPlanilha(p: ProgressoPlanilha | null): string {
  if (!p || p.etapa === 'lendo-arquivo') return 'Lendo arquivo';
  if (p.etapa === 'convertendo') return p.aba ? `Lendo linhas da aba "${p.aba}"` : 'Lendo linhas';
  return 'Aplicando a regra Código + Dispositivo';
}

function rotuloImportacao(p: ProgressoImportacao | null): string {
  if (!p || p.etapa === 'lendo-existentes') return 'Lendo dispositivos existentes';
  if (p.etapa === 'classificacoes') return 'Criando categorias, famílias e produtos';
  if (p.etapa === 'concluido') return 'Concluído';
  return 'Gravando registros alterados e novos';
}

function ListaEtapas({ atual }: { atual: EtapaVisivel }) {
  const idxAtual = ETAPAS.findIndex(e => e.id === atual);
  return (
    <ol aria-label="Etapas da importação" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.85rem' }}>
      {ETAPAS.map((e, i) => {
        const estado = i < idxAtual ? 'feita' : i === idxAtual ? 'atual' : 'pendente';
        return (
          <li
            key={e.id}
            aria-current={estado === 'atual' ? 'step' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              color: estado === 'pendente' ? 'var(--color-text-body)' : 'var(--color-text-dark)',
              fontWeight: estado === 'atual' ? 600 : 400,
            }}
          >
            {estado === 'feita' && <CheckCircle2 size={14} color="var(--color-success)" aria-hidden />}
            {estado === 'atual' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />}
            {estado === 'pendente' && <Circle size={14} aria-hidden />}
            {e.rotulo}
            <span className="sr-only">{estado === 'feita' ? ' (concluída)' : estado === 'atual' ? ' (em andamento)' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ResumoFinal({ resultado, enviados }: { resultado: ResultadoImportacaoLote; enviados: number }) {
  const { interrompido } = resultado;
  const ignorados = resultado.ignoradosSemAlteracao ?? 0;
  const naoGravados = resultado.naoGravados ?? 0;
  const parcial = !interrompido && resultado.erros > 0;
  const nadaAGravar = !interrompido && resultado.sucesso === 0 && resultado.erros === 0 && naoGravados === 0 && ignorados > 0;

  const titulo = interrompido === 'cota'
    ? 'Cota diária do Firebase esgotada'
    : interrompido === 'cancelado'
      ? 'Importação cancelada'
      : parcial ? 'Importação parcial' : nadaAGravar ? 'Nada a gravar' : 'Importação concluída';
  const cor = interrompido === 'cota' || parcial ? '#b45309' : interrompido === 'cancelado' ? 'var(--color-text-dark)' : 'var(--color-success)';
  const Icone = interrompido || parcial ? (interrompido === 'cancelado' ? XCircle : AlertCircle) : CheckCircle2;

  return (
    <div role="status" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 'var(--spacing-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: cor, marginBottom: '8px' }}>
        <Icone size={20} aria-hidden /> {titulo}
      </div>
      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', lineHeight: 1.6 }}>
        {nadaAGravar
          ? <li>Nada a gravar: os <strong>{fmt(ignorados)}</strong> registros já estavam iguais no banco</li>
          : <>
            <li><strong>{fmt(resultado.sucesso)}</strong> de {fmt(Math.max(resultado.sucesso, enviados - ignorados))} registros com mudanças gravados ({fmt(resultado.inseridos)} novos, {fmt(resultado.atualizados)} atualizados)</li>
            {ignorados > 0 && <li><strong>{fmt(ignorados)}</strong> já estavam iguais no banco e não foram regravados</li>}
          </>}
        {naoGravados > 0 && <li><strong>{fmt(naoGravados)}</strong> não gravados</li>}
        {resultado.erros > 0 && <li><strong>{fmt(resultado.erros)}</strong> com erro de gravação</li>}
        {resultado.documentosLidos !== undefined && (
          <li style={{ color: 'var(--color-text-body)' }}>
            {resultado.documentosLidos === 0
              ? 'Comparação feita com o catálogo de busca (nenhum dispositivo relido do banco)'
              : `${fmt(resultado.documentosLidos)} dispositivos existentes lidos para comparar`}
          </li>
        )}
      </ul>
      <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--color-text-body)' }}>
        {interrompido === 'cota' && 'O limite diário de operações do plano gratuito foi atingido. O que já foi gravado continua salvo; importe o mesmo arquivo amanhã para gravar o restante (nada será duplicado e o que já estiver igual será pulado).'}
        {interrompido === 'cancelado' && 'O que já foi gravado continua salvo. Importe o mesmo arquivo novamente para completar (nada será duplicado).'}
        {parcial && 'Importe o mesmo arquivo novamente para gravar os restantes (os já gravados não serão duplicados).'}
      </p>
      {resultado.falhas && resultado.falhas.length > 0 && (
        <details style={{ marginTop: '8px', fontSize: '0.8rem' }}>
          <summary>Detalhes técnicos</summary>
          <ul>{resultado.falhas.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { categorias, familias, produtos, importarDispositivosEmLote } = useReTool();
  const [file, setFile] = useState<File | null>(null);
  const [fase, setFase] = useState<Fase>('selecao');
  useAvisoAoSair(fase === 'processando' || fase === 'importando');
  const [parsedData, setParsedData] = useState<Partial<Dispositivo>[]>([]);
  const [newCategorias, setNewCategorias] = useState<string[]>([]);
  const [newFamilias, setNewFamilias] = useState<string[]>([]);
  const [newProdutos, setNewProdutos] = useState<string[]>([]);
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [defaultCategoriaId, setDefaultCategoriaId] = useState<string>('');
  const [progPlanilha, setProgPlanilha] = useState<ProgressoPlanilha | null>(null);
  const [progImportacao, setProgImportacao] = useState<ProgressoImportacao | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacaoLote | null>(null);

  const tarefaRef = useRef<TarefaPlanilha | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Evita disparar duas importações (duplo clique antes do re-render).
  const emExecucaoRef = useRef(false);

  // Fechar/desmontar no meio do processamento encerra o Worker.
  useEffect(() => () => { tarefaRef.current?.cancelar(); }, []);

  const ocupado = fase === 'processando' || fase === 'importando';

  const resetState = () => {
    tarefaRef.current?.cancelar();
    tarefaRef.current = null;
    setFile(null);
    setFase('selecao');
    setParsedData([]);
    setResumo(null);
    setErrorMsg('');
    setNewCategorias([]);
    setNewFamilias([]);
    setNewProdutos([]);
    setDefaultCategoriaId('');
    setProgPlanilha(null);
    setProgImportacao(null);
    setResultado(null);
    setCancelando(false);
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
    setParsedData([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    resetState();
    if (e.target.files && e.target.files.length > 0) validateAndSetFile(e.target.files[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); if (!ocupado) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (ocupado) return;
    resetState();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const processFile = async () => {
    if (!file || ocupado) return;
    setFase('processando');
    setErrorMsg('');
    setProgPlanilha({ etapa: 'lendo-arquivo', feitos: 0, total: 0 });
    try {
      const conteudo = await file.arrayBuffer();
      const tarefa = processarPlanilhaNoWorker(
        conteudo,
        file.name,
        contextoSerializavel({ categorias, familias, produtos, defaultCategoriaId }),
        setProgPlanilha,
        () => file.arrayBuffer()
      );
      tarefaRef.current = tarefa;
      const r = await tarefa.resultado;
      tarefaRef.current = null;

      setResumo(r.resumo);
      if (r.dispositivos.length === 0) {
        setErrorMsg('Nenhum registro válido encontrado. Verifique se a planilha tem as colunas Código e Dispositivo.');
        setFase('selecao');
      } else {
        setParsedData(r.dispositivos);
        setNewCategorias(r.novasCategorias);
        setNewFamilias(r.novasFamilias);
        setNewProdutos(r.novosProdutos);
        setFase('previa');
      }
    } catch (err) {
      tarefaRef.current = null;
      setFase('selecao');
      if (err instanceof ProcessamentoCancelado) return;
      console.error('Erro ao ler planilha:', err);
      setErrorMsg('Ocorreu um erro ao ler o arquivo. Verifique o formato.');
    } finally {
      setProgPlanilha(null);
    }
  };

  const cancelarProcessamento = () => {
    tarefaRef.current?.cancelar();
    tarefaRef.current = null;
    setFase('selecao');
    setProgPlanilha(null);
  };

  const handleConfirm = async () => {
    if (parsedData.length === 0 || emExecucaoRef.current) return;
    emExecucaoRef.current = true;
    const controle = new AbortController();
    abortRef.current = controle;
    setFase('importando');
    setCancelando(false);
    setErrorMsg('');
    // A barra de leitura fica indeterminada até o count() do servidor dar o total real.
    setProgImportacao({ etapa: 'lendo-existentes', feitos: 0, total: 0 });
    try {
      const r = await importarDispositivosEmLote(parsedData, newCategorias, newFamilias, newProdutos, {
        onProgresso: setProgImportacao,
        sinal: controle.signal,
      });
      setResultado(r);
      setFase('resumo');
    } catch (err) {
      console.error('Falha ao importar registros:', err);
      setErrorMsg('Falha ao importar registros.');
      setFase('previa');
    } finally {
      abortRef.current = null;
      emExecucaoRef.current = false;
      setCancelando(false);
    }
  };

  const cancelarImportacao = () => {
    if (!abortRef.current || cancelando) return;
    abortRef.current.abort();
    setCancelando(true);
  };

  const handleClose = () => {
    if (fase === 'importando') return; // use "Cancelar importação"
    resetState();
    onClose();
  };

  const renderProgresso = () => {
    if (fase === 'processando') {
      const p = progPlanilha;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ListaEtapas atual={etapaDaPlanilha(p)} />
          <BarraProgresso
            rotulo={rotuloPlanilha(p)}
            feitos={p?.feitos ?? 0}
            total={p && p.total > 0 ? p.total : undefined}
            detalhe={p?.etapa === 'lendo-arquivo' ? 'Descompactando o arquivo (o total de linhas ainda não é conhecido).' : 'A tela continua respondendo durante o processamento.'}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={cancelarProcessamento}>Cancelar</button>
          </div>
        </div>
      );
    }
    if (fase === 'importando') {
      const p = progImportacao;
      const comLote = p?.etapa === 'gravando' && p.totalLotes ? `Lote ${fmt(p.lote ?? 0)} / ${fmt(p.totalLotes)}` : undefined;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ListaEtapas atual={etapaDaImportacao(p)} />
          <BarraProgresso
            rotulo={rotuloImportacao(p)}
            feitos={p?.feitos ?? 0}
            total={p && p.total > 0 ? p.total : undefined}
            detalhe={cancelando ? 'Cancelando… aguardando o lote atual terminar.' : comLote}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={cancelarImportacao} disabled={cancelando}>
              {cancelando ? 'Cancelando…' : 'Cancelar importação'}
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <AccessibleModal isOpen={isOpen} onClose={handleClose} title="Importação em Lote" maxWidth="800px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>

        {(fase === 'selecao' || fase === 'processando') && (
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
            <label className="btn btn-primary seletor-arquivo" style={{ cursor: ocupado ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: ocupado ? 0.6 : 1 }}>
              Buscar Arquivo
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                // Escondido só visualmente: continua alcançável por Tab e Enter/Espaço.
                className="sr-only"
                aria-label="Buscar arquivo da planilha (.csv ou .xlsx)"
                disabled={ocupado}
              />
            </label>

            {file && (
              <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '0.95rem', color: 'var(--color-text-dark)', fontWeight: 600 }}>
                  Arquivo carregado: <span style={{ color: 'var(--color-primary)' }}>{file.name}</span>
                </div>

                {fase === 'selecao' && !errorMsg && (
                  <div style={{ width: '100%', maxWidth: '300px', textAlign: 'left' }}>
                    <label htmlFor="import-categoria-padrao" style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', fontWeight: 600 }}>
                      Categoria Padrão (Opcional)
                    </label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-body)', marginBottom: '8px' }}>
                      Será aplicada a todos os registros que não tiverem uma coluna "Categoria".
                    </p>
                    <select
                      id="import-categoria-padrao"
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

                    <button className="btn" onClick={processFile} style={{ width: '100%' }}>
                      Processar Planilha
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {renderProgresso()}

        {errorMsg && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 'var(--radius)', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            {errorMsg}
          </div>
        )}

        {fase === 'resumo' && resultado && (
          <>
            <ResumoFinal resultado={resultado} enviados={parsedData.length} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              {(resultado.interrompido || resultado.erros > 0) && (
                <button className="btn" onClick={() => { setResultado(null); setFase('previa'); }}>
                  Voltar à prévia
                </button>
              )}
              <button className="btn btn-primary" onClick={handleClose}>Fechar</button>
            </div>
          </>
        )}

        {(fase === 'previa' || fase === 'importando') && parsedData.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-md)' }}>
              <CheckCircle2 size={20} color="var(--color-success)" />
              <span style={{ fontWeight: 600 }}>{fmt(parsedData.length)} combinações únicas Código + Dispositivo</span>
              {newCategorias.length > 0 && (
                <span style={{ fontSize: '0.85rem', color: '#eab308', marginLeft: 'auto' }}>
                  ({newCategorias.length} novas categorias serão criadas)
                </span>
              )}
            </div>

            {resumo && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-body)', marginBottom: 'var(--spacing-md)' }}>
                <div>
                  {fmt(resumo.linhasLidas)} linhas lidas · {fmt(resumo.duplicadasRemovidas)} repetições da mesma combinação removidas
                  {resumo.linhasSemChave > 0 && <> · {fmt(resumo.linhasSemChave)} linhas sem Código e Dispositivo ignoradas</>}
                </div>
                {resumo.abas.filter(a => !a.ignorada).map(a => (
                  <div key={a.nome}>
                    Aba "{a.nome}": {fmt(a.linhas)} linhas · Código = {a.colunaCodigo ? `"${a.colunaCodigo}"` : 'não encontrada'} · Dispositivo = {a.colunaDispositivo ? `"${a.colunaDispositivo}"` : 'não encontrada'}
                  </div>
                ))}
                {resumo.avisos.map((aviso, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#b45309', fontWeight: 600 }}>
                    <AlertCircle size={16} /> {aviso}
                  </div>
                ))}
                <div style={{ marginTop: '6px' }}>
                  Registros já iguais no banco não são regravados (economia da cota diária do Firebase).
                </div>
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
                          : <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Sem Categoria</span>
                        }
                      </td>
                      <td style={{ padding: '8px' }}>{disp.peso}</td>
                    </tr>
                  ))}
                  {parsedData.length > 10 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-body)' }}>
                        E mais {fmt(parsedData.length - 10)} registros...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'var(--spacing-lg)' }}>
              <button className="btn" onClick={() => { setParsedData([]); setResumo(null); setErrorMsg(''); setFase('selecao'); }} disabled={ocupado}>
                Voltar e Alterar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={ocupado}
                aria-busy={fase === 'importando'}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {fase === 'importando' ? 'Importando...' : `Salvar Importação (${fmt(parsedData.length)})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </AccessibleModal>
  );
}
