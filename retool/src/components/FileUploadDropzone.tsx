import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, Trash2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { CategoriaAnexo, FileAttachment } from '../domain/entities/fileAttachment';
import { storageService } from '../data/services/FirebaseStorageService';
import { formatFileSize, validateFile } from '../utils/fileValidators';

interface FileUploadDropzoneProps {
  categoria: CategoriaAnexo;
  label: string;
  helperText?: string;
  accept?: string;
  currentValue?: string; // Para imagem única (URL)
  currentAttachments?: FileAttachment[]; // Para lista de PDFs
  deviceStorageId: string;
  onUploadSuccess: (attachment: FileAttachment) => void;
  onRemoveImage?: () => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  disabled?: boolean;
}

export const FileUploadDropzone: React.FC<FileUploadDropzoneProps> = ({
  categoria,
  label,
  helperText,
  accept = categoria === 'documento_pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp',
  currentValue,
  currentAttachments,
  deviceStorageId,
  onUploadSuccess,
  onRemoveImage,
  onRemoveAttachment,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImage = categoria === 'imagem_peca' || categoria === 'imagem_dispositivo';

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);

    const validation = validateFile(file, categoria);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Arquivo inválido.');
      return;
    }

    try {
      setIsUploading(true);
      setProgress(0);

      const baseStoragePath = `retool/dispositivos/${deviceStorageId}`;
      const attachment = await storageService.uploadFile(
        baseStoragePath,
        file,
        categoria,
        (currentProgress) => {
          setProgress(currentProgress);
        }
      );

      onUploadSuccess(attachment);
    } catch (err: any) {
      console.error('Erro no upload de arquivo:', err);
      setErrorMessage(err.message || 'Falha ao enviar o arquivo para o servidor.');
    } finally {
      setIsUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleProcessFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleProcessFile(file);
    }
  };

  const handleTriggerClick = () => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="input-label" style={{ marginBottom: 0 }}>{label}</span>
        {helperText && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{helperText}</span>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept={accept}
        disabled={disabled || isUploading}
        onChange={handleFileChange}
      />

      {/* Se for Imagem e já tiver valor preenchido */}
      {isImage && currentValue ? (
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-surface)',
            minHeight: '160px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <img
            src={currentValue}
            alt={label}
            style={{
              maxWidth: '100%',
              maxHeight: '140px',
              objectFit: 'contain',
              borderRadius: 'var(--radius-sm)',
            }}
          />

          {!disabled && onRemoveImage && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={onRemoveImage}
              title="Remover imagem"
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                padding: '4px 8px',
                fontSize: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderColor: 'var(--color-danger, #ef4444)',
                color: 'var(--color-danger, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Trash2 size={13} />
              <span>Remover</span>
            </button>
          )}
        </div>
      ) : (
        /* Área de Dropzone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleTriggerClick}
          style={{
            border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius)',
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDragging ? 'rgba(227, 6, 19, 0.05)' : 'rgba(0, 0, 0, 0.02)',
            minHeight: '140px',
            cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '80%' }}>
              <Loader2 size={28} className="spin" style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                Enviando arquivo... {progress}%
              </span>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: 'var(--color-border)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    backgroundColor: 'var(--color-primary)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
              {isImage ? (
                <ImageIcon size={28} style={{ color: isDragging ? 'var(--color-primary)' : '#9ca3af' }} />
              ) : (
                <UploadCloud size={28} style={{ color: isDragging ? 'var(--color-primary)' : '#9ca3af' }} />
              )}
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-dark)' }}>
                {isDragging ? 'Solte o arquivo aqui' : 'Clique ou arraste o arquivo aqui'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {isImage ? 'Suporta JPG, PNG ou WEBP (máx 10MB)' : 'Suporta documentos PDF (máx 25MB)'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Alerta de erro de validação/upload */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-danger, #ef4444)',
            fontSize: '0.75rem',
            marginTop: '2px',
          }}
        >
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lista de anexos existentes (para PDFs) */}
      {!isImage && currentAttachments && currentAttachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-dark)' }}>
            Documentos anexados ({currentAttachments.length}):
          </span>
          {currentAttachments.map((anexo) => (
            <div
              key={anexo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <FileText size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span
                    style={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '240px',
                    }}
                    title={anexo.originalName}
                  >
                    {anexo.originalName}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {formatFileSize(anexo.size)} • {new Date(anexo.uploadedAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={anexo.downloadURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm"
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'none',
                  }}
                  title="Abrir ou baixar PDF"
                >
                  <ExternalLink size={13} />
                  <span>Visualizar</span>
                </a>

                {!disabled && onRemoveAttachment && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onRemoveAttachment(anexo.id)}
                    title="Excluir anexo"
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      color: 'var(--color-danger, #ef4444)',
                      borderColor: 'var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
