import { useState, type FormEvent } from 'react';
import { useApp } from '../data/AppContext';
import { ErrorBox, Field } from '../ui/components';

export function Login() {
  const { cloud, signIn, signUp, resetPassword, startLocal } = useApp();
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    if (mode !== 'reset' && password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email.trim(), password);
      else if (mode === 'up') {
        const r = await signUp(email.trim(), password);
        if (r.needsConfirmation) setInfo('Conta criada. Abra o link de confirmação enviado ao seu e-mail e depois entre.');
      } else {
        await resetPassword(email.trim());
        setInfo('Se o e-mail existir, você receberá um link para redefinir a senha.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <h1 style={{ letterSpacing: '0.1em' }}>TITAN</h1>
      <p className="muted">Treino, nutrição, pele, cabelo e evolução — com seus dados reais.</p>
      {cloud ? (
        <form className="card stack" onSubmit={submit} style={{ marginTop: 16 }}>
          <h2>{mode === 'in' ? 'Entrar' : mode === 'up' ? 'Criar conta' : 'Recuperar senha'}</h2>
          <Field label="E-mail"><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {mode !== 'reset' && (
            <Field label="Senha" hint={mode === 'up' ? 'Mínimo de 8 caracteres.' : undefined}>
              <input type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
          <ErrorBox error={error} />
          {info && <div className="banner info" role="status">{info}</div>}
          <button className="btn primary big" disabled={busy}>{busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : mode === 'up' ? 'Criar conta' : 'Enviar link'}</button>
          <div className="row between">
            {mode !== 'in' && <button type="button" className="btn ghost sm" onClick={() => setMode('in')}>Já tenho conta</button>}
            {mode !== 'up' && <button type="button" className="btn ghost sm" onClick={() => setMode('up')}>Criar conta</button>}
            {mode === 'in' && <button type="button" className="btn ghost sm" onClick={() => setMode('reset')}>Esqueci a senha</button>}
          </div>
          <p className="hint">Senha armazenada com hash pelo Supabase Auth; o app nunca vê nem guarda sua senha em texto.</p>
        </form>
      ) : (
        <div className="card stack" style={{ marginTop: 16 }}>
          <h2>Nuvem não configurada</h2>
          <p className="muted">Esta instalação não tem as chaves do Supabase. Você pode usar em <strong>modo local</strong> (dados apenas neste navegador) para testar. Para conta, sincronização entre celular e PC e backup, configure o Supabase conforme o README.</p>
          <button className="btn primary big" onClick={() => void startLocal()}>Usar em modo local</button>
        </div>
      )}
    </main>
  );
}
