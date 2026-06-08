import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useReTool, Dispositivo } from '../context/ReToolContext';
import { AccessibleModal } from '../components/AccessibleModal';
import { Upload, ImageIcon, Plus, X, Loader2 } from 'lucide-react';
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';

export function DispositivoForm() {
  const { dispositivos, categorias, addDispositivo, updateDispositivo, addCategoria, announce, editingDispId, closeDispForm } = useReTool();
  
  const isEditing = Boolean(editingDispId);
  const dispEdicao = isEditing ? dispositivos.find(p => p.id === editingDispId) : null;

  const [formData, setFormData] = useState<Partial<Dispositivo>>({
    nome: '',
    codigo: '',
    categoriaId: '',
    tipo: '',
    peso: '',
    familiaProduto: '',
    produto: '',
    descricao: '',
    observacoes: '',
    palavrasChave: [],
    imagemPeca: '',
    imagemDispositivo: '',
  });

  const [tagInput, setTagInput] = useState('');
  
  // Categorias inline states
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Famílias inline states
  const [showNewFamForm, setShowNewFamForm] = useState(false);
  const [newFamName, setNewFamName] = useState('');
  const [customFamilias, setCustomFamilias] = useState<string[]>([]);

  // Uploading states (legacy/kept for safety, though disabled)
  const [uploadingPeca, setUploadingPeca] = useState(false);
  const [uploadingDispositivo, setUploadingDispositivo] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const fileInputPecaRef = useRef<HTMLInputElement>(null);
  const fileInputDispRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && dispEdicao) {
      setFormData({
        ...dispEdicao,
        palavrasChave: dispEdicao.palavrasChave || []
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
      addDispositivo(formData as Omit<Dispositivo, 'id' | 'dataCriacao'>);
      closeDispForm();
    }
  };

  // Carregar opções dinâmicas para a Família do Produto (incluindo as adicionadas inline)
  const familias = useMemo(() => {
    const set = new Set(dispositivos.map(d => d.familiaProduto).filter(Boolean));
    ['AVOLA', 'Plantadeira', 'Válvulas', 'Sensores', 'Motores', 'CLPs'].forEach(f => set.add(f));
    customFamilias.forEach(f => set.add(f));
    return Array.from(set).sort();
  }, [dispositivos, customFamilias]);

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
  const handleAddFamInline = (e: React.MouseEvent) => {
    e.preventDefault();
    const name = newFamName.trim();
    if (!name) return;
    setCustomFamilias(prev => [...prev, name]);
    setFormData(prev => ({ ...prev, familiaProduto: name }));
    setNewFamName('');
    setShowNewFamForm(false);
    announce(`Família '${name}' criada e selecionada.`);
  };

  // Upload físico real desativado temporariamente conforme solicitação do usuário
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'imagemPeca' | 'imagemDispositivo') => {
    // Desativado
    return;
  };

  const removeImage = (field: 'imagemPeca' | 'imagemDispositivo') => {
    // Desativado
    return;
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
                    disabled={!newFamName.trim()}
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
                id="selectFamilia" name="familiaProduto"
                className="input-field"
                value={formData.familiaProduto || ''}
                onChange={handleChange}
              >
                <option value="">Selecione a Família</option>
                {familias.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <div className="input-helper">Grupo de manufatura da peça (Substitui "Grupo")</div>
            </div>

            <div>
              <label htmlFor="inputProduto" className="input-label">Produto</label>
              <input 
                id="inputProduto" name="produto"
                className="input-field" 
                placeholder="Ex: AVOLA 2500"
                value={formData.produto || ''} 
                onChange={handleChange}
              />
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

          {/* Seção Inferior: Mídias (Upload Real de Arquivos Desativado Temporariamente) */}
          <div style={{ marginTop: '8px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', marginBottom: '12px' }}>
              Upload de Arquivos Físicos (Imagens)
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              
              {/* IMAGEM PEÇA Dropzone */}
              <div>
                <span className="input-label">IMAGEM PEÇA</span>
                <input 
                  type="file" 
                  ref={fileInputPecaRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  disabled={true}
                  onChange={(e) => handleFileUpload(e, 'imagemPeca')}
                />
                <div 
                  style={{
                    border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.02)',
                    minHeight: '160px',
                    cursor: 'not-allowed',
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: 0.7,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {formData.imagemPeca ? (
                    <>
                      <img 
                        src={formData.imagemPeca} 
                        alt="Peça" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '130px' }} 
                      />
                      <button 
                        type="button" 
                        className="btn" 
                        disabled={true}
                        style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 8px', fontSize: '0.75rem', height: 'auto', minHeight: 'auto', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'var(--color-border)', cursor: 'not-allowed' }}
                      >
                        Excluir
                      </button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9ca3af', gap: '6px', textAlign: 'center' }}>
                      <ImageIcon size={24} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Upload desativado</span>
                      <span style={{ fontSize: '0.7rem' }}>Aguardando ativação do Firebase Storage</span>
                    </div>
                  )}
                </div>
                <input 
                  type="text" 
                  name="imagemPeca"
                  className="input-field" 
                  placeholder="Upload de imagem desabilitado"
                  style={{ fontSize: '0.8rem', marginTop: '4px', cursor: 'not-allowed', backgroundColor: 'var(--color-hover)' }}
                  value={formData.imagemPeca || ''} 
                  disabled={true}
                  onChange={handleChange}
                />
              </div>

              {/* Imagem Dispositivo Dropzone */}
              <div>
                <span className="input-label">Imagem dispositivo</span>
                <input 
                  type="file" 
                  ref={fileInputDispRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  disabled={true}
                  onChange={(e) => handleFileUpload(e, 'imagemDispositivo')}
                />
                <div 
                  style={{
                    border: '2px dashed var(--color-border)',
                    borderRadius: 'var(--radius)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.02)',
                    minHeight: '160px',
                    cursor: 'not-allowed',
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: 0.7,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {formData.imagemDispositivo ? (
                    <>
                      <img 
                        src={formData.imagemDispositivo} 
                        alt="Dispositivo" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '130px' }} 
                      />
                      <button 
                        type="button" 
                        className="btn" 
                        disabled={true}
                        style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 8px', fontSize: '0.75rem', height: 'auto', minHeight: 'auto', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: 'var(--color-border)', cursor: 'not-allowed' }}
                      >
                        Excluir
                      </button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9ca3af', gap: '6px', textAlign: 'center' }}>
                      <ImageIcon size={24} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Upload desativado</span>
                      <span style={{ fontSize: '0.7rem' }}>Aguardando ativação do Firebase Storage</span>
                    </div>
                  )}
                </div>
                <input 
                  type="text" 
                  name="imagemDispositivo"
                  className="input-field" 
                  placeholder="Upload de imagem desabilitado"
                  style={{ fontSize: '0.8rem', marginTop: '4px', cursor: 'not-allowed', backgroundColor: 'var(--color-hover)' }}
                  value={formData.imagemDispositivo || ''} 
                  disabled={true}
                  onChange={handleChange}
                />
              </div>

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
