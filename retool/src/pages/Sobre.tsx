import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';

import baldanLogo from '../assets/logotipo - preferencial_horizontal (aplicação positiva).png';
import fatecLogo from '../assets/fatec-matao-luiz-marchesan.svg';

export function Sobre() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100%', padding: 'var(--spacing-2xl) var(--spacing-xl)' }}>
      
      {/* Botão Voltar - Top Left */}
      <div style={{ position: 'absolute', top: 'var(--spacing-xl)', left: 'var(--spacing-xl)' }}>
        <button 
          className="btn" 
          onClick={() => navigate('/')} 
          style={{ 
            borderRadius: '50%', width: '40px', height: '40px', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-body)', border: '1px solid var(--color-border)', backgroundColor: 'transparent' 
          }}
          aria-label="Voltar para a página inicial"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Título Principal estilo Home */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-2xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
          <Info size={28} color="var(--color-primary)" />
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1px', marginBottom: '4px' }}>
          <span style={{ color: 'var(--color-gray-steel)' }}>Sobre o</span>
          <span style={{ color: 'var(--color-primary)' }}> Projeto</span>
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', fontWeight: 500 }}>
          Identificação, Contexto e Objetivos do ReTool
        </p>
      </div>

      {/* Conteúdo Textual Clean */}
      <div style={{ width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', color: 'var(--color-text-dark)', fontSize: '1rem', lineHeight: '1.6' }}>
        
        <section>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-gray-steel)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>
            1. Identificação
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.95rem' }}>
            <div><span style={{ color: '#9ca3af', fontWeight: 600 }}>Nome:</span> ReTool</div>
            <div><span style={{ color: '#9ca3af', fontWeight: 600 }}>Curso:</span> DSM</div>
            <div><span style={{ color: '#9ca3af', fontWeight: 600 }}>Instituição:</span> Fatec Matão</div>
            <div><span style={{ color: '#9ca3af', fontWeight: 600 }}>Parceira:</span> Baldan</div>
          </div>
          
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <span style={{ color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: '4px', fontSize: '0.95rem' }}>Significado:</span>
            <p>
              O nome <strong>ReTool</strong> associa o prefixo "Re" à ideia de reorganização, reutilização e revisão, juntamente ao termo "Tool" (ferramenta). O projeto visa estruturar informações que hoje podem estar dispersas ou depender de conhecimento tácito das equipes.
            </p>
          </div>

          <div style={{ marginTop: 'var(--spacing-md)', padding: 'var(--spacing-md)', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid var(--color-border)', textAlign: 'center', fontStyle: 'italic', color: 'var(--color-primary)', fontWeight: 500 }}>
            "Onde o dispositivo atual vira o ponto de partida do futuro."
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-gray-steel)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>
            2. Contexto
          </h2>
          <p style={{ marginBottom: '12px' }}>
            No ambiente industrial, a organização de ferramentas e peças é vital para a eficiência, preservação do conhecimento e redução de retrabalho. O <strong>ReTool</strong> centraliza essas informações para facilitar a consulta, atualização e rastreabilidade na Baldan.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-gray-steel)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>
            3. Objetivos
          </h2>
          <ul style={{ listStyleType: 'disc', paddingLeft: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Estruturar o cadastro inicial das peças da ferramentaria.</li>
            <li>Registrar a utilização de cada peça e sua aplicação.</li>
            <li>Apoiar a padronização dos dados com evolução contínua, orientada pelas áreas técnicas (TI e Ferramentaria).</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-gray-steel)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>
            4. Equipe (Fatec)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--color-primary)', marginBottom: '8px' }}>Desenvolvedores</h3>
              <ul style={{ listStyleType: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.95rem', color: 'var(--color-text-dark)' }}>
                <li>• Gustavo Domingues</li>
                <li>• Miguel Moura</li>
                <li>• Guilherme Pedroso</li>
                <li>• Luiz Ramos</li>
                <li>• Pedro Henrique</li>
              </ul>
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--color-primary)', marginBottom: '8px' }}>Orientador</h3>
              <ul style={{ listStyleType: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.95rem', color: 'var(--color-text-dark)' }}>
                <li>• Douglas Ribeiro</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-gray-steel)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', marginBottom: '12px' }}>
            5. Envolvidos (Baldan)
          </h2>
          <ul style={{ listStyleType: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.95rem', color: 'var(--color-text-dark)' }}>
            <li>• Rodrigo Vidrich</li>
            <li>• Gabriela Carvalho</li>
            <li>• Viniccius</li>
          </ul>
        </section>
      </div>

      {/* Logos no Rodapé */}
      <div style={{ marginTop: 'var(--spacing-xl)', paddingTop: 'var(--spacing-xl)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-2xl)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Empresa Parceira</span>
          <img src={baldanLogo} alt="Baldan Implementos Agrícolas" style={{ height: '50px', objectFit: 'contain', opacity: 0.8 }} />
        </div>
        
        <div style={{ height: '40px', width: '1px', backgroundColor: 'var(--color-border)' }}></div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Instituição de Ensino</span>
          <img src={fatecLogo} alt="Fatec Matão - Luiz Marchesan" style={{ height: '50px', objectFit: 'contain', opacity: 0.8 }} />
        </div>
      </div>

    </div>
  );
}
