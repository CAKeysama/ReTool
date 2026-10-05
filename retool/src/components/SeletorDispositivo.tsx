import { useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useIndiceBusca } from '../presentation/hooks/useIndiceBusca';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const MAX_SUGESTOES = 8;

interface SeletorDispositivoProps {
  valor: string;
  /** Rótulo do dispositivo selecionado (nome · código). */
  rotuloValor?: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

/**
 * Escolha de um dispositivo por nome ou código com sugestões do catálogo de
 * busca (no máximo 8 por vez). Substitui o <select> com uma opção por
 * dispositivo, que com 13 mil itens travava a tela ao abrir.
 */
export function SeletorDispositivo({ valor, rotuloValor, onChange, placeholder = 'Filtrar por dispositivo (nome ou código)' }: SeletorDispositivoProps) {
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [usado, setUsado] = useState(false);
  const indice = useIndiceBusca(usado);
  const busca = useDebouncedValue(texto, 150);
  const idLista = useId();

  const sugestoes = useMemo(() => {
    if (!indice.pronto || !busca.trim()) return [];
    return indice.buscar({ texto: busca }, MAX_SUGESTOES) || [];
  }, [indice.pronto, indice.buscar, busca]);

  if (valor) {
    return (
      <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rotuloValor}>
          {rotuloValor || 'Dispositivo selecionado'}
        </span>
        <button type="button" className="btn btn-icon" aria-label="Limpar filtro de dispositivo" onClick={() => onChange('')}
          style={{ width: 28, height: 28, minHeight: 28, padding: 0 }}>
          <X size={14} />
        </button>
      </div>
    );
  }

  const escolher = (id: string) => {
    onChange(id);
    setTexto('');
    setAberto(false);
  };

  const status = !usado || !texto.trim() ? null
    : !indice.pronto ? (indice.estado === 'erro' ? 'Não foi possível carregar a lista de dispositivos.' : 'Carregando dispositivos…')
      : texto !== busca ? null
        : sugestoes.length === 0 ? 'Nenhum dispositivo encontrado' : null;

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <input
        type="text"
        className="input-field"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={aberto && (sugestoes.length > 0 || !!status)}
        aria-controls={idLista}
        aria-activedescendant={aberto && sugestoes[ativo] ? `${idLista}-${ativo}` : undefined}
        placeholder={placeholder}
        value={texto}
        onFocus={() => { setUsado(true); setAberto(true); }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onChange={e => { setTexto(e.target.value); setAtivo(0); setAberto(true); setUsado(true); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(a => Math.min(a + 1, sugestoes.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && sugestoes[ativo]) { e.preventDefault(); escolher(sugestoes[ativo].id); }
          else if (e.key === 'Escape') setAberto(false);
        }}
        style={{ width: '100%' }}
      />
      {aberto && (sugestoes.length > 0 || status) && (
        <ul id={idLista} role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, margin: 0, padding: '4px',
          listStyle: 'none', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)'
        }}>
          {status && <li role="status" style={{ padding: '8px 10px', color: '#6b7280', fontSize: '0.82rem' }}>{status}</li>}
          {sugestoes.map((s, i) => (
            <li
              key={s.id}
              id={`${idLista}-${i}`}
              role="option"
              aria-selected={i === ativo}
              onMouseDown={e => { e.preventDefault(); escolher(s.id); }}
              onMouseEnter={() => setAtivo(i)}
              style={{ padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem',
                backgroundColor: i === ativo ? 'var(--color-hover)' : 'transparent' }}
            >
              <strong>{s.nome || 'Sem nome'}</strong> <span style={{ color: '#6b7280' }}>· {s.codigo || 'S/C'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
