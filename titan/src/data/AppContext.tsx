import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudConfigured, supabase } from './supabase';
import { CloudStore, LocalStore, type DataStore, type Query, type Table } from './store';
import type { Profile } from '../domain/types';

const LOCAL_USER_KEY = 'titan-local-user';

interface AuthState {
  ready: boolean;
  store: DataStore | null;
  email: string | null;
  cloud: boolean;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  startLocal(): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

function translateAuthError(msg: string): string {
  if (/Invalid login/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(msg)) return 'Este e-mail já tem conta. Use "Entrar".';
  if (/Password should be/i.test(msg)) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link enviado antes de entrar.';
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos.';
  return msg;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<DataStore | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const attach = useCallback(async (session: Session | null) => {
    if (!session || !supabase) { setStore(null); setEmail(null); return; }
    setStore(await CloudStore.open(session.user.id, supabase));
    setEmail(session.user.email ?? null);
  }, []);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      if (cloudConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        await attach(data.session);
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { void attach(s); });
        unsub = () => sub.subscription.unsubscribe();
      } else {
        const id = localStorage.getItem(LOCAL_USER_KEY);
        if (id) setStore(await LocalStore.open(id));
      }
      setReady(true);
    })();
    return () => unsub();
  }, [attach]);

  const value = useMemo<AuthState>(() => ({
    ready, store, email, cloud: cloudConfigured,
    async signUp(e, p) {
      if (!supabase) throw new Error('Nuvem não configurada');
      const { data, error } = await supabase.auth.signUp({ email: e, password: p, options: { emailRedirectTo: window.location.href.split('#')[0] } });
      if (error) throw new Error(translateAuthError(error.message));
      return { needsConfirmation: !data.session };
    },
    async signIn(e, p) {
      if (!supabase) throw new Error('Nuvem não configurada');
      const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
      if (error) throw new Error(translateAuthError(error.message));
    },
    async resetPassword(e) {
      if (!supabase) throw new Error('Nuvem não configurada');
      const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: window.location.href.split('#')[0] });
      if (error) throw new Error(translateAuthError(error.message));
    },
    async startLocal() {
      const id = localStorage.getItem(LOCAL_USER_KEY) ?? `local-${crypto.randomUUID()}`;
      localStorage.setItem(LOCAL_USER_KEY, id);
      setStore(await LocalStore.open(id));
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
      else localStorage.removeItem(LOCAL_USER_KEY);
      setStore(null);
    },
  }), [ready, store, email]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AppProvider ausente');
  return c;
}

export function useStore(): DataStore {
  const { store } = useApp();
  if (!store) throw new Error('Não autenticado');
  return store;
}

/** Lê linhas de uma tabela e recarrega automaticamente quando a tabela muda. */
export function useRows<T>(table: Table, q?: Query) {
  const store = useStore();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(q ?? {});
  const qRef = useRef(q);
  qRef.current = q;
  const load = useCallback(async () => {
    try {
      setData(await store.list<T>(table, qRef.current));
      setError(null);
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [store, table]);
  useEffect(() => { void load(); }, [load, key]);
  useEffect(() => store.subscribe((t) => { if (t === table) void load(); }), [store, table, load]);
  return { data, loading, error, reload: load };
}

export const EMPTY_PROFILE = (userId: string): Profile => ({
  user_id: userId, display_name: null, age: null, sex: null, height_cm: null,
  training: {}, nutrition: {}, skin: {}, hair: {}, grooming: {}, preferences: { theme: 'dark' }, onboarding_completed_at: null,
});

export function useProfile() {
  const store = useStore();
  const { data, loading, error, reload } = useRows<Profile>('profiles');
  const profile = data[0] ?? null;
  const save = useCallback(async (patch: Partial<Profile>) => {
    const base = profile ?? EMPTY_PROFILE(store.userId);
    await store.upsert('profiles', { ...base, ...patch, user_id: store.userId } as unknown as Record<string, unknown>);
  }, [profile, store]);
  return { profile, loading, error, save, reload };
}
