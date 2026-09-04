import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useReTool } from '../context/ReToolContext';
import { Dispositivo } from '../domain/entities/dispositivo';
import { FileAttachment } from '../domain/entities/fileAttachment';
import { AccessibleModal } from '../components/AccessibleModal';
import { FileUploadDropzone } from '../components/FileUploadDropzone';
import { Plus, X, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function DispositivoForm() {
  const { dispositivos, categorias, familias, produtos, addDispositivo, updateDispositivo, addCategoria, addFamilia, addProduto, announce, editingDispId, closeDispForm } = useReTool();
  
  const isEditing = Boolean(editingDispId);
  const dispEdicao = isEditing ? dispositivos.find(p => p.id === editingDispId) : null;

  // Garante um ID único estável para o dispositivo e sua pasta no Storage
  const deviceStorageId = useMemo(() => editingDispId || uuidv4(), [editingDispId]);

  const [formData, setFormData] = useState<Partial<Dispositivo>>({
    nome: '',
    codigo: '',
    categoriaId: '',
    peso: '',
    familiaId: '',
    produtoId: '',
    descricao: '',
    observacoes: '',
    palavrasChave: [],
    imagemPeca: '',
    imagemDispositivo: '',
    anexos: [],
  });

  const [tagInput, setTagInput] = useState('');
  
  // Categorias inline states
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Famílias inline states
  const [showNewFamForm, setShowNewFamForm] = useState(false);
  const [newFamName, setNewFamName] = useState('');
  const [isAddingFam, setIsAddingFam] = useState(false);

  // Produtos inline states
  const [showNewProdForm, setShowNewProdForm] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [isAddingProd, setIsAddingProd] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && dispEdicao) {
      setFormData({
        ...dispEdicao,
        palavrasChave: dispEdicao.palavrasChave || [],
        anexos: dispEdicao.anexos || []
      });
    }
  }, [isEditing, dispEdicao]);

  useEffect(() => {
    firstInputRef.current?.focus();
    announce(isEditing ? 'Modo de edição habilitado.' : 'Modo de cadastro habilitado.', false);
  }, [isEditing, announce]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    closeDispForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && editingDispId) {
      updateDispositivo(editingDispId, formData);
      closeDispForm();
    } else {
      addDispositivo({
        ...formData,
        id: deviceStorageId
      });
      closeDispForm();
    }
  };

  // Tags logic
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/,$/, '');
      if (val && !formData.palavrasChave?.includes(val)) {
        setFormData(prev => ({
          ...prev,
          palavrasChave: [...(prev.palavrasChave || []), val]
        }));
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      palavrasChave: (prev.palavrasChave || []).filter(t => t !== tagToRemove)
    }));
  };

  // Categoria inline logic
  const handleAddCatInline = async (e: React.MouseEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    setIsAddingCat(true);
    try {
      const newId = await addCategoria({ nome: name, ativo: true });
      setFormData(prev => ({ ...prev, categoriaId: newId }));
      setNewCatName('');
      setShowNewCatForm(false);
    } catch (err) {
      console.error(err);
      announce('Erro ao cadastrar nova categoria.', true);
    } finally {
      setIsAddingCat(false);
    }
  };

  // Família inline logic
  const handleAddFamInline = async (e: React.MouseEvent) => {
    e.preventDefault();
    const name = newFamName.trim();
    if (!name) return;
    setIsAddingFam(true);
    try {
      const newId = await addFamilia({ nome: name, ativo: true });
      setFormData(prev => ({ ...prev, familiaId: newId }));
      setNewFamName('');
      setShowNewFamForm(false);
    } catch (err) {
      console.error(err);
      announce('Erro ao cadastrar nova família.', true);
    } finally {
      setIsAddingFam(false);
    }
  };

  // Produto inline logic
  const handleAddProdInline = async (e: React.MouseEvent) => {
    e.preventDefault();
    const name = newProdName.trim();
    if (!name) return;
    setIsAddingProd(true);
    try {
      const newId = await addProduto({ nome: name, ativo: true });
      setFormData(prev => ({ ...prev, produtoId: newId }));
      setNewProdName('');
      setShowNewProdForm(false);
    } catch (err) {
      console.error(err);
      announce('Erro ao cadastrar novo produto.', true);
    } finally {
      setIsAddingProd(false);
    }
  };

  return (
    <AccessibleModal isOpen={true} onClose={handleClose} title={isEditing ? 'Editar dispositivo' : 'Novo dispositivo'} maxWidth="780px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Painel de Reestruturação Visual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Linha 1: Nº Dispositivo e Código Peça */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label htmlFor="inputNumeroDispositivo" className="input-label">Nº dispositivo</label>
              <input 
                ref={firstInputRef}
                id="inputNumeroDispositivo" name="nome"
                className="input-field" 
                placeholder="Ex: Dispositivo 12"
                value={formData.nome || ''} 
                onChange={handleChange}
              />
              <div className="input-helper">Nome ou identificação do dispositivo</div>
            </div>

            <div>
              <label htmlFor="inputCodigoPeca" className="input-label">CÓDIGO PEÇA</label>
              <input 
                id="inputCodigoPeca" name="codigo"
                className="input-field" 
                placeholder="Ex: DMP00011"
                value={formData.codigo || ''} 
                onChange={handleChange}
              />
              <div className="input-helper">Código único de fabricação ou catálogo</div>
            </div>
          </div>

          {/* Linha 2: Família do Produto (com Inline Creation) e Produto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label htmlFor="selectFamilia" className="input-label" style={{ margin: 0 }}>Família do Produto</label>
                <button 
                  type="button" 
                  onClick={() => setShowNewFamForm(!showNewFamForm)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--color-primary)', 
                    fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', 
                    gap: '2px', cursor: 'pointer', padding: 0
                  }}
                >
                  <Plus size={12} /> Nova Família
                </button>
              </div>

              {showNewFamForm ? (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', animation: 'cloudFadeIn 0.2s ease' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Nome da família..." 
                    value={newFamName}
                    autoFocus
                    onChange={(e) => setNewFamName(e.target.value)}
                    style={{ flex: 1, minHeight: '34px', height: '34px', padding: '6px 10px', fontSize: '0.85rem' }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    disabled={isAddingFam || !newFamName.trim()}
                    onClick={handleAddFamInline}
                    style={{ height: '34px', minHeight: 'auto', fontSize: '0.8rem', padding: '0 12px' }}
                  >
                    Salvar
                  </button>
                  <button 
                    type="button" 
                    className="btn"
                    onClick={() => { setShowNewFamForm(false); setNewFamName(''); }}
                    style={{ height: '34px', minHeight: 'auto', fontSize: '0.8rem', padding: '0 12px' }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}

              <select 
                id="selectFamilia" name="familiaId"
                className="input-field"
                value={formData.familiaId || ''}
                onChange={handleChange}
              >
                <option value="">Selecione a Família</option>
                {familias
                  .filter(f => f.ativo !== false || f.id === formData.familiaId)
                  .map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nome}{f.ativo === false ? ' (Inativo)' : ''}
                    </option>
                  ))}
              </select>
              <div className="input-helper">Grupo de manufatura da peça (Substitui "Grupo")</div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label htmlFor="selectProduto" className="input-label" style={{ margin: 0 }}>Produto</label>
                <button 
                  type="button" 
                  onClick={() => setShowNewProdForm(!showNewProdForm)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--color-primary)', 
                    fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', 
                    gap: '2px', cursor: 'pointer', padding: 0
                  }}
                >
                  <Plus size={12} /> Novo Produto
                </button>
              </div>

              {showNewProdForm ? (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', animation: 'cloudFadeIn 0.2s ease' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Nome do produto..." 
                    value={newProdName}
                    autoFocus
                    onChange={(e) => setNewProdName(e.target.value)}
                    style={{ flex: 1, minHeight: '34px', height: '34px', padding: '6px 10px', fontSize: '0.85rem' }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    disabled={isAddingProd || !newProdName.trim()}
                    onClick={handleAddProdInline}
                    style={{ height: '34px', minHeight: 'auto', fontSize: '0.8rem', padding: '0 12px' }}
                  >
                    Salvar
                  </button>
                  <button 
                    type="button" 
                    className="btn"
                    onClick={() => { setShowNewProdForm(false); setNewProdName(''); }}
                    style={{ height: '34px', minHeight: 'auto', fontSize: '0.8rem', padding: '0 12px' }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}

              <select 
                id="selectProduto" name="produtoId"
                className="input-field" 
                value={formData.produtoId || ''} 
                onChange={handleChange}
              >
                <option value="">Selecione o Produto</option>
                {produtos
                  .filter(p => p.ativo !== false || p.id === formData.produtoId)
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{p.ativo === false ? ' (Inativo)' : ''}
                    </option>
                  ))}
              </select>
              <div className="input-helper">Nome comercial/modelo do produto associado</div>
            </div>
          </div>

          {/* Linha 3: Categoria (com Inline Creation) e Peso dispositivo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label htmlFor="selectCategoria" className="input-label" style={{ margin: 0 }}>CATEGORIA</label>
                <button 
                  type="button" 
                  onClick={() => setShowNewCatForm(!showNewCatForm)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--color-primary)', 
                    fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', 
                    gap: '2px', cursor: 'pointer', padding: 0
                  }}
                >
                  <Plus size={12} /> Nova Categoria
                </button>
              </div>

              {showNewCatForm ? (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', animation: 'cloudFadeIn 0.2s ease' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Nome da categoria..." 
                    value={newCatName}
                    autoFocus
                    onChange={(e) => setNewCatName(e.target.value)}
                    style={{ flex: 1, minHeight: '34px', height: '34px', padding: '6px 10px', fontSize: '0.85rem' }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    disabled={isAddingCat || !newCatName.trim()}
                    onClick={handleAddCatInline}
                    style={{ height: '34px', minHeight: 'auto', fontSize: '0.8rem', padding: '0 12px' }}
                  >
                    Salvar
                  </button>
                  <button 
                    type="button" 
                    className="btn"
                    onClick={() => { setShowNewCatForm(false); setNewCatName(''); }}
                    style={{ height: '34px', minHeight: 'auto', fontSize: '0.8rem', padding: '0 12px' }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}

              <select 
                id="selectCategoria" name="categoriaId"
                className="input-field" 
                value={formData.categoriaId || ''} 
                onChange={handleChange}
              >
                <option value="">Selecione a Categoria</option>
                {categorias
                  .filter(c => c.ativo !== false || c.id === formData.categoriaId)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome}{c.ativo === false ? ' (Inativo)' : ''}
                    </option>
                  ))}
              </select>
              <div className="input-helper">Almoxarifado ou tipo de ativo</div>
            </div>

            <div>
              <label htmlFor="inputPesoDispositivo" className="input-label">PESO dispositivo</label>
              <input 
                id="inputPesoDispositivo" name="peso"
                className="input-field" 
                placeholder="Ex: 35000"
                value={formData.peso || ''} 
                onChange={handleChange}
              />
              <div className="input-helper">Peso em gramas (Ex: 1000)</div>
            </div>
          </div>

          {/* Linha 4: Palavras-chave como Tags */}
          <div>
            <label htmlFor="inputPalavrasChave" className="input-label">PALAVRAS CHAVE</label>
            <input 
              id="inputPalavrasChave" 
              className="input-field" 
              placeholder="Digite uma palavra-chave e aperte Enter ou vírgula..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
            
            {/* Renderização das Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {(formData.palavrasChave || []).map(tag => (
                <span 
                  key={tag} 
                  className="badge badge-pink"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '16px', fontSize: '0.8rem' }}
                >
                  {tag}
                  <button 
                    type="button" 
                    onClick={() => removeTag(tag)}
                    style={{ background: 'none', border: 'none', display: 'inline-flex', cursor: 'pointer', padding: 0, color: 'inherit' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {(formData.palavrasChave || []).length === 0 && (
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>Nenhuma palavra-chave adicionada ainda.</span>
              )}
            </div>
          </div>

          {/* Linha 5: Descrição Peça (Textarea) */}
          <div>
            <label htmlFor="inputDescricaoPeca" className="input-label">DESCRIÇÃO PEÇA</label>
            <textarea 
              id="inputDescricaoPeca" name="descricao"
              className="input-field" 
              placeholder="Descreva fisicamente a peça, seu formato, dimensões ou finalidade..."
              style={{ minHeight: '80px', resize: 'vertical' }}
              value={formData.descricao || ''} 
              onChange={handleChange}
            />
          </div>

          {/* Seção de Mídias e Arquivos (Firebase Storage) */}
          <div style={{ marginTop: '8px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', marginBottom: '12px' }}>
              Arquivos Físicos e Fotos (Firebase Storage)
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* IMAGEM PEÇA Dropzone */}
              <FileUploadDropzone
                categoria="imagem_peca"
                label="IMAGEM PEÇA"
                currentValue={formData.imagemPeca}
                deviceStorageId={deviceStorageId}
                onUploadSuccess={(attachment) => {
                  setFormData(prev => ({
                    ...prev,
                    imagemPeca: attachment.downloadURL
                  }));
                  announce('Imagem da peça enviada com sucesso.');
                }}
                onRemoveImage={() => {
                  setFormData(prev => ({
                    ...prev,
                    imagemPeca: ''
                  }));
                  announce('Imagem da peça removida.');
                }}
              />

              {/* IMAGEM DISPOSITIVO Dropzone */}
              <FileUploadDropzone
                categoria="imagem_dispositivo"
                label="Imagem dispositivo"
                currentValue={formData.imagemDispositivo}
                deviceStorageId={deviceStorageId}
                onUploadSuccess={(attachment) => {
                  setFormData(prev => ({
                    ...prev,
                    imagemDispositivo: attachment.downloadURL
                  }));
                  announce('Imagem do dispositivo enviada com sucesso.');
                }}
                onRemoveImage={() => {
                  setFormData(prev => ({
                    ...prev,
                    imagemDispositivo: ''
                  }));
                  announce('Imagem do dispositivo removida.');
                }}
              />
            </div>

            {/* Documentos e Manuais Técnicos (PDF) */}
            <div style={{ marginTop: '16px' }}>
              <FileUploadDropzone
                categoria="documento_pdf"
                label="Documentos Técnicos e Manuais (PDF)"
                helperText="Anexe ordens de serviço, manuais e desenhos técnicos"
                currentAttachments={formData.anexos || []}
                deviceStorageId={deviceStorageId}
                onUploadSuccess={(attachment) => {
                  setFormData(prev => ({
                    ...prev,
                    anexos: [...(prev.anexos || []), attachment]
                  }));
                  announce(`Documento ${attachment.originalName} anexado com sucesso.`);
                }}
                onRemoveAttachment={(attachmentId) => {
                  setFormData(prev => ({
                    ...prev,
                    anexos: (prev.anexos || []).filter(a => a.id !== attachmentId)
                  }));
                  announce('Documento removido dos anexos.');
                }}
              />
            </div>
          </div>

        </div>

        {/* Botões */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
          <button type="button" className="btn" onClick={handleClose}>
            Cancelar
          </button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            aria-label="Salvar registro do dispositivo"
          >
            {isEditing ? 'Salvar alterações' : 'Cadastrar dispositivo'}
          </button>
        </div>

      </form>
    </AccessibleModal>
  );
}
