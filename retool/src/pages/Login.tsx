import React, { useState } from 'react';
import { useAuth, traduzirErroAuth } from '../context/AuthContext';
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export function Login() {
  const { login, register, solicitarRedefinicaoSenha } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [enviandoRedefinicao, setEnviandoRedefinicao] = useState(false);

  const handleEsqueciSenha = async () => {
    setErro('');
    setSucesso('');
    if (!email.trim()) {
      setErro('Informe seu e-mail acima para receber o link de redefinição de senha.');
      return;
    }
    setEnviandoRedefinicao(true);
    try {
      await solicitarRedefinicaoSenha(email);
      // Mesma mensagem exista ou não a conta (não revela e-mails cadastrados).
      setSucesso(`Se houver uma conta com ${email.trim().toLowerCase()}, você receberá um e-mail com o link para definir uma nova senha. Confira também a caixa de spam.`);
    } catch (err: unknown) {
      setErro(traduzirErroAuth(err));
    } finally {
      setEnviandoRedefinicao(false);
    }
  };

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
        // O cargo nunca é escolhido aqui: a conta nasce como Convidado e a
        // sessão segue para a tela "Cadastro em análise".
        await register(email, password, nome);
      } else {
        // Após o login a rota pública redireciona conforme a situação da conta.
        await login(email, password);
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
      <div className="login-cartao" style={{
        maxWidth: '1020px',
        width: '100%',
        display: 'grid',
        backgroundColor: 'white',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.15)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* LADO ESQUERDO: APRESENTAÇÃO DOS PERFIS INSTITUCIONAIS */}
        <div className="login-apresentacao" style={{
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
            </div>

            <h2 style={{ 
              fontSize: '1.45rem', 
              fontWeight: 800, 
              lineHeight: 1.35, 
              marginBottom: '24px',
              color: '#ffffff' 
            }}>
              Gestão de dispositivos e reutilização industrial
            </h2>

            {/* SOBRE O PROJETO */}
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                'Cadastro e consulta de dispositivos',
                'Solicitação e aprovação de reutilizações',
                'Histórico e auditoria'
              ].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#e2e8f0' }}>
                  <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '28px' }}>
            ReTool · 2026
          </div>
        </div>

        {/* LADO DIREITO: FORMULÁRIO DE AUTENTICAÇÃO REAL */}
        <div className="login-formulario" style={{ padding: '44px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {isRegistering ? 'Criar conta' : 'Entrar'}
            </h2>
            {isRegistering && (
              <p style={{ color: '#64748b', fontSize: '0.86rem', marginTop: '6px' }}>
                Sua conta fica sem acesso aos dados até a Administração aprovar e definir seu cargo.
              </p>
            )}
          </div>

          {erro && (
            <div role="alert" style={{
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

          {sucesso && (
            <div role="status" style={{
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isRegistering && (
              <div>
                <label className="input-label">
                  Nome completo
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
                E-mail institucional
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
              {!isRegistering && (
                <div style={{ textAlign: 'right', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={handleEsqueciSenha}
                    disabled={enviandoRedefinicao}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: enviandoRedefinicao ? 'not-allowed' : 'pointer', textDecoration: 'underline' }}
                  >
                    {enviandoRedefinicao ? 'Enviando…' : 'Esqueci minha senha'}
                  </button>
                </div>
              )}
            </div>

            {isRegistering && (
              <div>
                <label className="input-label">
                  Confirmar senha
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

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700 }}
            >
              <span>{loading ? (isRegistering ? 'Criando conta…' : 'Entrando…') : (isRegistering ? 'Criar conta' : 'Entrar')}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          {/* ALTERNAR CADASTRO / LOGIN */}
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.84rem', color: '#64748b' }}>
            {isRegistering ? 'Já tem conta?' : 'Primeiro acesso?'}
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErro('');
                setSucesso('');
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
              {isRegistering ? 'Entrar' : 'Cadastre-se'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
