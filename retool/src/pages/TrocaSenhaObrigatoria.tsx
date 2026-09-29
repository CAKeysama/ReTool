import React, { useState } from 'react';
import { KeyRound, Check, Circle } from 'lucide-react';
import { useAuth, traduzirErroAuth } from '../context/AuthContext';
import { TelaAcessoRestrito } from '../components/TelaAcessoRestrito';
import { Aviso } from '../components/Feedback';
import { TAMANHO_MINIMO_SENHA } from '../domain/services/senhaTemporaria';

/**
 * Primeiro acesso de conta criada pela Administração: a senha temporária
 * precisa ser substituída antes de qualquer outra tela (o Firestore também
 * recusa leituras/escritas enquanto `trocaSenhaObrigatoria` estiver ativo).
 */
export function TrocaSenhaObrigatoria() {
  const { concluirTrocaSenha } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const requisitos = [
    { ok: novaSenha.length >= TAMANHO_MINIMO_SENHA, texto: `Mínimo de ${TAMANHO_MINIMO_SENHA} caracteres` },
    { ok: /[A-Za-z]/.test(novaSenha) && /\d/.test(novaSenha), texto: 'Letras e números' },
    { ok: !!novaSenha && novaSenha === confirmacao, texto: 'Confirmação igual à nova senha' },
    { ok: !!novaSenha && novaSenha !== senhaAtual, texto: 'Diferente da senha temporária' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await concluirTrocaSenha(senhaAtual, novaSenha, confirmacao);
      // O perfil atualizado libera o sistema automaticamente.
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setErro(code === 'auth/invalid-credential' || code === 'auth/wrong-password'
        ? 'A senha temporária informada está incorreta.'
        : traduzirErroAuth(err));
      setSalvando(false);
    }
  };

  const campo = (id: string, rotulo: string, valor: string, set: (v: string) => void, autoComplete: string) => (
    <div>
      <label className="input-label" htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        type="password"
        required
        autoComplete={autoComplete}
        value={valor}
        onChange={e => set(e.target.value)}
        className="input-field"
      />
    </div>
  );

  return (
    <TelaAcessoRestrito
      icone={<KeyRound size={20} />}
      titulo="Defina sua nova senha"
      subtitulo="Esta conta foi criada pela Administração com uma senha temporária. Para continuar, substitua-a por uma senha pessoal — ela não será exibida nem registrada em nenhum lugar."
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {campo('senha-temporaria', 'Senha temporária', senhaAtual, setSenhaAtual, 'current-password')}
        {campo('nova-senha', 'Nova senha', novaSenha, setNovaSenha, 'new-password')}
        {campo('confirmar-senha', 'Confirmar nova senha', confirmacao, setConfirmacao, 'new-password')}

        <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px' }}>
          {requisitos.map(r => (
            <li key={r.texto} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: r.ok ? '#15803d' : '#64748b' }}>
              {r.ok ? <Check size={14} /> : <Circle size={12} />}
              {r.texto}
            </li>
          ))}
        </ul>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={salvando || requisitos.some(r => !r.ok) || !senhaAtual}
          style={{ width: '100%', fontWeight: 700, opacity: salvando || requisitos.some(r => !r.ok) || !senhaAtual ? 0.6 : 1 }}
        >
          {salvando ? 'Salvando nova senha...' : 'Salvar nova senha e continuar'}
        </button>
      </form>
    </TelaAcessoRestrito>
  );
}
