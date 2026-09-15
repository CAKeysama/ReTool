import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES_CONFIG, UserRole, DEFAULT_SUPERUSER } from '../domain/entities/user';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, 
  Mail, 
  User, 
  SlidersHorizontal, 
  HardHat, 
  Cpu, 
  Building2, 
  ArrowRight,
  AlertCircle,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [perfil, setPerfil] = useState<UserRole>('engenharia');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    try {
      if (isRegistering) {
        if (!nome.trim()) throw new Error('Por favor, informe seu nome completo.');
        if (password.length < 6) throw new Error('A senha deve conter no mínimo 6 caracteres.');
        await register(email, password, nome, perfil);
      } else {
        await login(email, password);
      }
      navigate('/dispositivos');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setErro('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErro('Este e-mail já está cadastrado no sistema.');
      } else {
        setErro(err.message || 'Erro ao processar autenticação.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFillSuperUser = () => {
    setEmail(DEFAULT_SUPERUSER.email);
    setPassword(DEFAULT_SUPERUSER.senha);
    setIsRegistering(false);
    setErro('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f1f5f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{
        maxWidth: '1020px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1.25fr 1fr',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.15)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* LADO ESQUERDO: APRESENTAÇÃO DOS PERFIS INSTITUCIONAIS */}
        <div style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '44px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                color: '#ffffff',
                fontSize: '1.2rem',
                boxShadow: '0 4px 10px rgba(225, 29, 72, 0.4)'
              }}>
                R
              </div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>
                <span style={{ color: '#ffffff' }}>Re</span><span style={{ color: 'var(--color-primary)' }}>Tool</span>
              </h1>
              <span style={{ 
                fontSize: '0.72rem', 
                fontWeight: 700,
                color: '#f8fafc',
                backgroundColor: 'rgba(255,255,255,0.15)', 
                padding: '3px 10px', 
                borderRadius: '6px', 
                marginLeft: '6px',
                letterSpacing: '0.05em'
              }}>
                GESTAO INDUSTRIAL
              </span>
            </div>

            <h2 style={{ 
              fontSize: '1.45rem', 
              fontWeight: 800, 
              lineHeight: 1.35, 
              marginBottom: '12px',
              color: '#ffffff' 
            }}>
              Controle de Acesso por Perfil de Usuário
            </h2>
            <p style={{ 
              color: '#cbd5e1', 
              fontSize: '0.88rem', 
              lineHeight: 1.55, 
              marginBottom: '28px' 
            }}>
              Cada área possui estritamente as permissões necessárias para suas atividades industriais, assegurando integridade e rastreabilidade total das operações.
            </p>

            {/* LISTA DOS 4 PERFIS DE ACESSO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(168, 85, 247, 0.35)'
              }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <SlidersHorizontal size={18} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e9d5ff' }}>Programadora / Administradora</div>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '2px' }}>Acesso total, gestão de usuários e logs de exclusão.</div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(34, 197, 94, 0.35)'
              }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HardHat size={18} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#bbf7d0' }}>Projetista – Ferramentaria</div>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '2px' }}>Cadastra, edita e aprova reutilizações (não exclui).</div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(249, 115, 22, 0.35)'
              }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Cpu size={18} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fed7aa' }}>Engenharia de Processo / Industrial</div>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '2px' }}>Consulta dispositivos e solicita reutilizações.</div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(59, 130, 246, 0.35)'
              }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={18} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#bfdbfe' }}>Gerência</div>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '2px' }}>Consulta indicadores, projetos e histórico de movimentações.</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '28px' }}>
            ReTool Gestão Industrial · 2026
          </div>
        </div>

        {/* LADO DIREITO: FORMULÁRIO DE AUTENTICAÇÃO REAL */}
        <div style={{ padding: '44px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {isRegistering ? 'Criar Nova Conta' : 'Acesse o Sistema'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.86rem', marginTop: '6px' }}>
              {isRegistering 
                ? 'Cadastre seu usuário institucional com seu perfil de atuação.' 
                : 'Informe seu e-mail institucional e senha para entrar.'}
            </p>
          </div>

          {/* BANNER INSTITUCIONAL DO SUPER USUÁRIO */}
          {!isRegistering && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#7c3aed" />
                <div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#1e293b' }}>Super Administrador</div>
                  <div style={{ fontSize: '0.70rem', color: '#64748b' }}>admin@retool.com · admin123</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleFillSuperUser}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#f3e8ff',
                  color: '#6b21a8',
                  border: '1px solid #d8b4fe',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <KeyRound size={12} />
                <span>Preencher</span>
              </button>
            </div>
          )}

          {erro && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              borderRadius: '8px',
              fontSize: '0.82rem',
              marginBottom: '18px'
            }}>
              <AlertCircle size={16} />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isRegistering && (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Nome Completo
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    required
                    placeholder="Seu nome completo"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '11px 12px 11px 38px', 
                      borderRadius: '8px', 
                      border: '1.5px solid #cbd5e1', 
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                E-mail Institucional
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  required
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '11px 12px 11px 38px', 
                    borderRadius: '8px', 
                    border: '1.5px solid #cbd5e1', 
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '11px 12px 11px 38px', 
                    borderRadius: '8px', 
                    border: '1.5px solid #cbd5e1', 
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {isRegistering && (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Perfil Institucional Solicitado
                </label>
                <select
                  value={perfil}
                  onChange={e => setPerfil(e.target.value as UserRole)}
                  style={{ 
                    width: '100%', 
                    padding: '11px 12px', 
                    borderRadius: '8px', 
                    border: '1.5px solid #cbd5e1', 
                    backgroundColor: '#ffffff', 
                    color: '#0f172a',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box'
                  }}
                >
                  {(Object.keys(ROLES_CONFIG) as UserRole[]).map(r => (
                    <option key={r} value={r}>
                      {ROLES_CONFIG[r].titulo}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.94rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '6px',
                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)'
              }}
            >
              <span>{loading ? 'Processando autenticação...' : (isRegistering ? 'Cadastrar e Entrar' : 'Entrar no ReTool')}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          {/* ALTERNAR CADASTRO / LOGIN */}
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.84rem', color: '#64748b' }}>
            {isRegistering ? 'Já possui uma conta institucional?' : 'Novo colaborador na indústria?'}
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErro('');
              }}
              style={{
                marginLeft: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isRegistering ? 'Faça login' : 'Cadastre-se aqui'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
