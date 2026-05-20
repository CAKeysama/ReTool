import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReTool } from '../context/ReToolContext';
import { Search, Box, Wrench, Tag, Info, Plus } from 'lucide-react';
import { useHotkeys } from '../hooks/useHotkeys';
import baldanWatermark from '../assets/logotipo - preferencial_horizontal (aplicação monocromática positiva).png';

export function Home() {
  const { dispositivos, utilizacoes, categorias, openDispForm } = useReTool();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState(dispositivos);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useHotkeys({
    onSearchFocus: () => inputRef.current?.focus()
  });

  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      return;
    }
    const q = query.toLowerCase();
    const filtered = dispositivos.filter(p => 
      (p.nome && p.nome.toLowerCase().includes(q)) || 
      (p.codigo && p.codigo.toLowerCase().includes(q))
    );
    setSuggestions(filtered);
    setActiveIndex(-1);
  }, [query, dispositivos]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        navigate(`/dispositivos/${suggestions[activeIndex].id}`);
      } else {
        navigate(`/dispositivos?q=${encodeURIComponent(query)}`);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100%', position: 'relative', overflow: 'hidden', zIndex: 1 }}>
      
      {/* Marca d'água Baldan */}
      <img 
        src={baldanWatermark} 
        alt="" 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '120vw',
          maxWidth: '1500px',
          opacity: 0.05,
          pointerEvents: 'none',
          zIndex: -1
        }} 
      />

      {/* Botão Institucional - Top Right */}
      <div style={{ position: 'absolute', top: 'var(--spacing-xl)', right: 'var(--spacing-xl)' }}>
        <button 
          className="btn" 
          onClick={() => navigate('/sobre')} 
          style={{ 
            borderRadius: '20px', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600, 
            color: 'var(--color-text-body)', border: '1px solid transparent', backgroundColor: 'transparent' 
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-hover)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
        >
          <Info size={16} /> Sobre o Projeto
        </button>
      </div>

      {/* Título */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1px', marginBottom: '4px' }}>
          <span style={{ color: 'var(--color-gray-steel)' }}>Re</span>
          <span style={{ color: 'var(--color-primary)' }}>Tool</span>
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', fontWeight: 500 }}>
          Gestão de Dispositivos e Ferramentas Industriais
        </p>
      </div>

      {/* Busca Principal */}
      <div style={{ width: '100%', maxWidth: '650px', position: 'relative', marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: '20px' }} />
          <input
            ref={inputRef}
            type="text"
            style={{ 
              width: '100%',
              padding: '16px 20px 16px 48px', 
              fontSize: '1rem',
              borderRadius: '30px',
              border: '1px solid var(--color-border)',
              boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
              outline: 'none',
              transition: 'all 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.boxShadow = '0 6px 12px rgba(228, 13, 44, 0.08)';
              e.target.style.borderColor = 'var(--color-primary)';
              setShowSuggestions(true);
            }}
            onBlur={(e) => {
              e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.02)';
              e.target.style.borderColor = 'var(--color-border)';
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder="Buscar dispositivos por nome, código, descrição..."
            aria-label="Buscar dispositivos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Sugestões do Autocomplete */}
        {showSuggestions && suggestions.length > 0 && (
          <ul 
            role="listbox"
            style={{ 
              position: 'absolute', top: '65px', left: 0, right: 0,
              backgroundColor: 'white', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
              listStyle: 'none', padding: 'var(--spacing-sm) 0',
              zIndex: 10, maxHeight: '300px', overflowY: 'auto'
            }}
          >
            {suggestions.map((peca, idx) => (
              <li 
                key={peca.id}
                role="option"
                aria-selected={activeIndex === idx}
                style={{
                  padding: '10px 20px', cursor: 'pointer',
                  backgroundColor: activeIndex === idx ? 'var(--color-hover)' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
                onClick={() => navigate(`/dispositivos/${peca.id}`)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={14} color="#9ca3af" />
                  <strong style={{ color: 'var(--color-text-dark)', fontWeight: 500 }}>{peca.nome || 'Nome não informado'}</strong>
                </div>
                <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{peca.codigo || ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Botões Centrais */}
      <div className="flex-wrap-container" style={{ marginBottom: 'var(--spacing-2xl)' }}>
        <button className="btn" onClick={() => navigate(`/dispositivos?q=${encodeURIComponent(query)}`)} style={{ borderRadius: '20px', padding: '8px 20px' }}>
          Buscar dispositivos
        </button>
        <button className="btn btn-primary" aria-label="Cadastrar novo dispositivo" onClick={() => openDispForm()} style={{ width: '40px', height: '40px', padding: 0 }}>
          <Plus size={20} />
        </button>
      </div>

      {/* Cartões Coloridos */}
      <div style={{ 
        display: 'flex', 
        gap: 'var(--spacing-md)', 
        overflowX: 'auto', 
        paddingBottom: '8px',
        width: '100%',
        maxWidth: '100vw',
        padding: '0 var(--spacing-lg)', /* Para dar uma borda de respiro na rolagem */
        WebkitOverflowScrolling: 'touch' /* Suavidade no iOS */
      }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', margin: '0 auto' }}>
          <HomeCard count={dispositivos.length} label="Dispositivos" colorType="pink" icon={<Box size={20} />} onClick={() => navigate('/dispositivos')} shortcut="D" />
          <HomeCard count={utilizacoes.length} label="Utilizações" colorType="teal" icon={<Wrench size={20} />} onClick={() => navigate('/utilizacoes')} shortcut="U" />
          <HomeCard count={categorias.length} label="Categorias" colorType="yellow" icon={<Tag size={20} />} onClick={() => navigate('/categorias')} shortcut="C" />
        </div>
      </div>

      {/* Texto de Atalho Footer */}
      <div style={{ position: 'absolute', bottom: 'var(--spacing-xl)', color: '#d1d5db', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
        Pressione <span style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', color: '#9ca3af', fontWeight: 600 }}>/</span> para focar a busca de qualquer tela
      </div>
    </div>
  );
}

function HomeCard({ count, label, colorType, icon, onClick, shortcut }: { count: number, label: string, colorType: 'pink' | 'teal' | 'yellow', icon: React.ReactNode, onClick: () => void, shortcut: string }) {
  const isPink = colorType === 'pink';
  const isTeal = colorType === 'teal';

  const bgColor = 'rgba(228, 13, 44, 0.1)';
  const textColor = 'var(--color-primary)';

  return (
    <div 
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      style={{
        backgroundColor: bgColor,
        padding: 'var(--spacing-lg)',
        borderRadius: '16px',
        width: '140px',
        height: '140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'transform 0.2s',
        position: 'relative'
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        backgroundColor: 'white', color: textColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {icon}
      </div>
      
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: textColor, lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: '0.8rem', color: textColor, fontWeight: 500, marginTop: '2px' }}>{label}</div>
      </div>

      <div style={{ position: 'absolute', bottom: '12px', right: '12px', fontSize: '0.6rem', color: textColor, opacity: 0.5, fontWeight: 'bold' }}>
        {shortcut}
      </div>
    </div>
  )
}
