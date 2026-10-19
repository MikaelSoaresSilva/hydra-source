// Sincronização com a nuvem (Supabase: Auth + PostgREST). Opcional: sem configuração,
// o jogo funciona 100% local. A chave "anon" do Supabase é pública por design; a proteção
// real vem das políticas RLS em supabase/schema.sql (cada usuário só acessa o próprio save).
import type { GameState } from '../core/types';
import { forCloud, mergeStates, migrate } from '../core/save';

export type CloudResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

type Cloud = GameState['settings']['cloud'];

function base(c: Cloud) { return c.url.trim().replace(/\/+$/, ''); }

async function req(c: Cloud, path: string, init: RequestInit & { auth?: boolean } = {}): Promise<Response> {
  if (!c.url || !c.anonKey) throw new Error('Nuvem não configurada (URL e chave pública).');
  if (!/^https:\/\//i.test(c.url)) throw new Error('A URL da nuvem precisa usar https://');
  const headers: Record<string, string> = { apikey: c.anonKey, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (init.auth !== false && c.accessToken) headers.Authorization = `Bearer ${c.accessToken}`;
  return fetch(base(c) + path, { ...init, headers });
}

async function errorText(r: Response) {
  try { const j = await r.json(); return j.msg || j.error_description || j.message || j.error || `HTTP ${r.status}`; } catch { return `HTTP ${r.status}`; }
}

export async function signUp(c: Cloud, email: string, password: string): Promise<CloudResult<Partial<Cloud>>> {
  try {
    const r = await req(c, '/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }), auth: false });
    if (!r.ok) return { ok: false, error: await errorText(r) };
    const j = await r.json();
    if (!j.access_token) return { ok: true, value: { email } }; // confirmação por e-mail exigida
    return { ok: true, value: { email, accessToken: j.access_token, refreshToken: j.refresh_token, userId: j.user?.id } };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function signIn(c: Cloud, email: string, password: string): Promise<CloudResult<Partial<Cloud>>> {
  try {
    const r = await req(c, '/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }), auth: false });
    if (!r.ok) return { ok: false, error: await errorText(r) };
    const j = await r.json();
    return { ok: true, value: { email, accessToken: j.access_token, refreshToken: j.refresh_token, userId: j.user?.id } };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

async function refresh(c: Cloud): Promise<Partial<Cloud> | null> {
  if (!c.refreshToken) return null;
  const r = await req(c, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: c.refreshToken }), auth: false });
  if (!r.ok) return null;
  const j = await r.json();
  return { accessToken: j.access_token, refreshToken: j.refresh_token, userId: j.user?.id ?? c.userId };
}

/** Puxa o save da nuvem, mescla com o local (sem duplicar XP) e envia o resultado. */
export async function syncNow(local: GameState): Promise<CloudResult<{ merged: GameState; tokens: Partial<Cloud> }>> {
  let c = local.settings.cloud;
  if (!c.userId || !c.accessToken) return { ok: false, error: 'Entre na sua conta para sincronizar.' };
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, error: 'Sem internet. O progresso continua salvo no aparelho e será sincronizado depois.' };
  try {
    let tokens: Partial<Cloud> = {};
    let r = await req(c, `/rest/v1/saves?user_id=eq.${c.userId}&select=data,updated_at`);
    if (r.status === 401) {
      const t = await refresh(c);
      if (!t) return { ok: false, error: 'Sessão expirada. Entre novamente.' };
      tokens = t; c = { ...c, ...t };
      r = await req(c, `/rest/v1/saves?user_id=eq.${c.userId}&select=data,updated_at`);
    }
    if (!r.ok) return { ok: false, error: await errorText(r) };
    const rows = (await r.json()) as { data: unknown }[];
    const merged = rows[0] ? mergeStates(local, migrate(rows[0].data)) : local;
    const up = await req(c, '/rest/v1/saves', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: c.userId, data: forCloud(merged), version: merged.version }),
    });
    if (!up.ok) return { ok: false, error: await errorText(up) };
    return { ok: true, value: { merged, tokens: { ...tokens, lastSync: new Date().toISOString() } } };
  } catch (e) {
    return { ok: false, error: `Falha de rede: ${(e as Error).message}` };
  }
}

export async function deleteCloudAccount(c: Cloud): Promise<CloudResult> {
  try {
    const r = await req(c, '/rest/v1/rpc/delete_my_account', { method: 'POST', body: '{}' });
    if (!r.ok) return { ok: false, error: await errorText(r) };
    return { ok: true, value: undefined };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
