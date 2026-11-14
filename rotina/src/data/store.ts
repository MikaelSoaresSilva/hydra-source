// Armazenamento permanente no aparelho (IndexedDB). Funciona offline e sobrevive a fechar o app.
import { Capacitor } from '@capacitor/core';
import { openDB, type IDBPDatabase } from 'idb';
import { defaultState } from '../domain/defaults';
import type { State } from '../domain/types';

const DB = 'titan-rotina';
const STORE = 'kv';
const KEY = 'state';
export const BACKUP_APP = 'titan-rotina';

let dbp: Promise<IDBPDatabase> | null = null;
const db = () => (dbp ??= openDB(DB, 1, { upgrade(d) { d.createObjectStore(STORE); } }));

/** Completa campos que versões futuras/antigas possam não ter. */
export function migrate(raw: Partial<State>): State {
  const base = defaultState();
  const s = { ...base, ...raw } as State;
  s.profile = { ...base.profile, ...raw.profile };
  s.settings = { ...base.settings, ...raw.settings };
  s.sleep = { ...base.sleep, ...raw.sleep, weekday: { ...base.sleep.weekday, ...raw.sleep?.weekday }, weekend: { ...base.sleep.weekend, ...raw.sleep?.weekend } };
  for (const k of ['overrides', 'completions', 'water', 'food', 'dayLog', 'achievements', 'snoozes'] as const) (s as unknown as Record<string, unknown>)[k] = raw[k] ?? {};
  s.aiLog = raw.aiLog ?? [];
  s.categories = raw.categories?.length ? raw.categories : base.categories;
  s.activities = raw.activities ?? base.activities;
  return s;
}

export async function loadState(): Promise<State> {
  const raw = (await (await db()).get(STORE, KEY)) as Partial<State> | undefined;
  return raw ? migrate(raw) : defaultState();
}

export async function saveState(s: State): Promise<void> {
  await (await db()).put(STORE, s, KEY);
}

export interface Backup { app: typeof BACKUP_APP; version: 1; exportedAt: string; state: State }

export function makeBackup(s: State): Backup {
  return { app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), state: s };
}

export function parseBackup(text: string): { ok: true; state: State } | { ok: false; error: string } {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'O arquivo não é um JSON válido.' }; }
  const b = data as Partial<Backup>;
  if (!b || b.app !== BACKUP_APP || !b.state || !Array.isArray(b.state.activities)) return { ok: false, error: 'Este arquivo não é um backup do Titan Rotina.' };
  return { ok: true, state: migrate(b.state) };
}

/** No APK o arquivo vai para a folha de compartilhar do Android (Arquivos, Drive, WhatsApp…); no navegador, baixa. */
export async function exportBackup(s: State): Promise<'shared' | 'downloaded'> {
  const name = `titan-rotina-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const text = JSON.stringify(makeBackup(s), null, 2);
  if (!Capacitor.isNativePlatform()) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return 'downloaded';
  }
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const res = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: 'Backup do Titan Rotina', text: 'Backup da sua rotina', files: [res.uri], dialogTitle: 'Salvar o backup em…' });
  return 'shared';
}
