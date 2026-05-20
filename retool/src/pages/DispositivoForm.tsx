import React, { useState, useEffect, useRef } from 'react';
import { useReTool, Dispositivo } from '../context/ReToolContext';
import { AccessibleModal } from '../components/AccessibleModal';

export function DispositivoForm() {
  const { dispositivos, categorias, tipos, addDispositivo, updateDispositivo, announce, editingDispId, closeDispForm } = useReTool();
  
  const isEditing = Boolean(editingDispId);
  const dispEdicao = isEditing ? dispositivos.find(p => p.id === editingDispId) : null;

  const [formData, setFormData] = useState<Partial<Dispositivo>>({
    nome: '',
    codigo: '',
    categoriaId: '',
    tipo: '',
    peso: '',
    familiaProduto: '',
    descricao: '',
    observacoes: '',
  });

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && dispEdicao) {
      setFormData(dispEdicao);
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

  return (
    <AccessibleModal isOpen={true} onClose={handleClose} title={isEditing ? 'Editar dispositivo' : 'Novo dispositivo'} maxWidth="650px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        
        <div className="form-row-grid">
          <div>
            <label htmlFor="nome" className="input-label">Nome</label>
            <input 
              ref={firstInputRef}
              id="nome" name="nome"
              className="input-field" 
              placeholder="Nome do dispositivo"
              value={formData.nome || ''} 
              onChange={handleChange}
            />
            <div className="input-helper">Opcional — deixe em branco se não souber</div>
          </div>

          <div>
            <label htmlFor="codigo" className="input-label">Código</label>
            <input 
              id="codigo" name="codigo"
              className="input-field" 
              placeholder="Ex: VS-24-001"
              value={formData.codigo || ''} 
              onChange={handleChange}
            />
            <div className="input-helper">Código interno ou de fabricante</div>
          </div>
        </div>

        <div className="form-row-grid">
           <div>
            <label htmlFor="categoriaId" className="input-label">Categoria</label>
            <select 
              id="categoriaId" name="categoriaId"
              className="input-field" 
              value={formData.categoriaId || ''} 
              onChange={handleChange}
            >
              <option value="">Selecione ou deixe vazio</option>
              {categorias
                .filter(c => c.ativo !== false || c.id === formData.categoriaId)
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome}{c.ativo === false ? ' (Inativo)' : ''}
                  </option>
                ))}
            </select>
            <div className="input-helper">Grupos macro (Ex: Ferramentas, EPIs, Gabaritos)</div>
          </div>

          <div>
            <label htmlFor="tipo" className="input-label">Tipo</label>
            <select 
              id="tipo" name="tipo" 
              className="input-field"
              value={formData.tipo || ''} 
              onChange={handleChange}
            >
              <option value="">Selecione ou deixe vazio</option>
              {tipos
                .filter(t => t.ativo !== false || t.id === formData.tipo)
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nome}{t.ativo === false ? ' (Inativo)' : ''}
                  </option>
                ))}
            </select>
            <div className="input-helper">Classificação técnica (Ex: Elétrica, Manual)</div>
          </div>
        </div>

        <div className="form-row-grid">
          <div>
            <label htmlFor="familiaProduto" className="input-label">Família de Produto</label>
              <input 
                id="familiaProduto" name="familiaProduto"
                placeholder="Ex: Válvulas, Cilindros..."
                className="input-field" 
                value={formData.familiaProduto || ''} 
                onChange={handleChange}
              />
              <div className="input-helper">Agrupamento por linha de produtos</div>
          </div>
          <div>
            <label htmlFor="peso" className="input-label">Peso (kg)</label>
            <input 
              id="peso" name="peso"
              className="input-field" 
              placeholder="Ex: 1.5"
              value={formData.peso || ''} 
              onChange={handleChange}
            />
            <div className="input-helper">Peso em quilogramas</div>
          </div>
        </div>

        <div>
          <label htmlFor="descricao" className="input-label">Descrição</label>
          <textarea 
            id="descricao" name="descricao"
            placeholder="Descreva o dispositivo, suas características técnicas..."
            className="input-field" 
            style={{ minHeight: '80px', resize: 'vertical' }}
            value={formData.descricao || ''} 
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="observacoes" className="input-label">Observações</label>
          <textarea 
            id="observacoes" name="observacoes"
            placeholder="Instruções de manuseio, cuidados especiais, histórico..."
            className="input-field" 
            style={{ minHeight: '80px', resize: 'vertical' }}
            value={formData.observacoes || ''} 
            onChange={handleChange}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
          <button type="button" className="btn" onClick={handleClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" aria-label="Salvar registro do dispositivo">
            {isEditing ? 'Salvar alterações' : 'Cadastrar dispositivo'}
          </button>
        </div>

      </form>
    </AccessibleModal>
  );
}
