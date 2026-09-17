import React, { useState } from 'react';
import { useAuth, traduzirErroAuth } from '../context/AuthContext';
import { ROLES_CONFIG, UserRole } from '../domain/entities/user';
import { useNavigate } from 'react-router-dom';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight,
  AlertCircle,
  Info,
  CheckCircle2
} from 'lucide-react';

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');
  const [perfilSolicitado, setPerfilSolicitado] = useState<UserRole>('gerencia');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setSucesso('');

    try {
      if (isRegistering) {
        if (!nome.trim()) throw new Error('Por favor, informe seu nome completo.');
        if (password.length < 6) throw new Error('A senha deve conter no mínimo 6 caracteres.');
        if (password !== confirmPassword) throw new Error('As senhas informadas não coincidem.');
        await register(email, password, nome, perfilSolicitado);
        setSucesso('Conta criada com sucesso! Seu acesso está aguardando aprovação da Administradora — você poderá entrar assim que for liberado.');
        setIsRegistering(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        await login(email, password);
        navigate('/dispositivos');
      }
    } catch (err: unknown) {
      console.error(err);
      setErro(traduzirErroAuth(err));
    } finally {
      setLoading(false);
    }
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
        borderRadius: 'var(--radius-lg)',
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
                borderRadius: 'var(--radius-sm)',
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
              Gestão de Dispositivos e Reutilização Industrial
            </h2>
            <p style={{ 
              color: '#cbd5e1', 
              fontSize: '0.88rem', 
              lineHeight: 1.55, 
              marginBottom: '28px' 
            }}>
              O ReTool centraliza o cadastro de dispositivos, famílias, categorias e produtos da ferramentaria e o fluxo de reutilização de peças, com rastreabilidade das operações.
            </p>

            {/* SOBRE O PROJETO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Cadastro e consulta de dispositivos da ferramentaria',
                'Solicitação e aprovação de reutilização de peças',
                'Histórico e auditoria das operações'
              ].map(item => (
                <div key={item} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)'
                }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 900, fontSize: '0.9rem' }}>•</span>
                  <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{item}</span>
                </div>
              ))}
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
                ? 'Cadastre seu usuário institucional. O acesso é liberado após aprovação da Administradora.' 
                : 'Informe seu e-mail institucional e senha para entrar.'}
            </p>
          </div>

          {/* AVISO INSTITUCIONAL DE PROVISIONAMENTO */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '18px'
          }}>
            <Info size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.5 }}>
              Contas institucionais são provisionadas e aprovadas pela Administração do sistema.
              Novos cadastros entram com acesso restrito até a liberação.
            </div>
          </div>

          {sucesso && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 14px',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              marginBottom: '18px'
            }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{sucesso}</span>
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
              borderRadius: 'var(--radius-sm)',
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
                <label className="input-label">
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
                    className="input-field"
                    style={{ paddingLeft: '38px' }}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="input-label">
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
                    borderRadius: 'var(--radius-sm)', 
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
              <label className="input-label">
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
                    borderRadius: 'var(--radius-sm)', 
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
                <label className="input-label">
                  Confirmar Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    required
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '38px' }}
                  />
                </div>
              </div>
            )}

            {isRegistering && (
              <div>
                <label className="input-label">
                  Perfil Solicitado
                </label>
                <select
                  value={perfilSolicitado}
                  onChange={e => setPerfilSolicitado(e.target.value as UserRole)}
                  className="input-field"
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
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700 }}
            >
              <span>{loading ? 'Processando autenticação...' : (isRegistering ? 'Cadastrar e Aguardar Aprovação' : 'Entrar no ReTool')}</span>
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
