// Guarda o progresso no aparelho (Capacitor Preferences no Android; localStorage no navegador).
import { useEffect, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { type AppState, initialState, migrate } from './state';

const KEY = 'formacao-dev-state-v1';
let state: AppState = initialState();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const isNative = () => Capacitor.isNativePlatform();

export async function loadState(): Promise<AppState> {
  let raw: string | null = null;
  try {
    raw = isNative() ? (await Preferences.get({ key: KEY })).value : localStorage.getItem(KEY);
  } catch { raw = null; }
  try { state = migrate(raw ? JSON.parse(raw) : null); } catch { state = initialState(); }
  listeners.forEach((l) => l());
  return state;
}

async function persist() {
  const json = JSON.stringify(state);
  try {
    if (isNative()) await Preferences.set({ key: KEY, value: json });
    else localStorage.setItem(KEY, json);
  } catch (e) { console.warn('Falha ao salvar', e); }
}

export function getState() { return state; }

export function update(fn: (s: AppState) => AppState | void) {
  const draft = structuredClone(state);
  const res = fn(draft);
  state = (res ?? draft) as AppState;
  listeners.forEach((l) => l());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 300);
}

export function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } return persist(); }

export function replaceState(next: AppState) { state = next; listeners.forEach((l) => l()); return persist(); }

export function useAppState(): AppState {
  const [, setTick] = useState(0);
  useEffect(() => { const l = () => setTick((t) => t + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return state;
}
