import { openDB, type IDBPDatabase } from 'idb';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_BUCKET } from './supabase';

export const TABLES = [
  'profiles', 'programs', 'workout_sessions', 'set_logs', 'exercise_overrides', 'daily_checkins', 'body_metrics',
  'nutrition_targets', 'user_foods', 'food_logs', 'food_prices', 'care_products', 'routine_items', 'care_logs', 'photos',
  'appearance_analyses',
] as const;
export type Table = (typeof TABLES)[number];

export const keyOf = (t: Table) => (t === 'profiles' ? 'user_id' : 'id');

export interface Query {
  eq?: Record<string, string | number | boolean>;
  gte?: Record<string, string | number>;
  lte?: Record<string, string | number>;
  order?: { col: string; asc?: boolean };
  limit?: number;
}

type AnyRow = Record<string, unknown>;

export interface DataStore {
  readonly mode: 'cloud' | 'local';
  readonly userId: string;
  list<T>(table: Table, q?: Query): Promise<T[]>;
  upsert(table: Table, rows: AnyRow | AnyRow[]): Promise<{ queued: boolean }>;
  remove(table: Table, ids: string[]): Promise<void>;
  uploadPhoto(path: string, blob: Blob): Promise<void>;
  photoUrl(path: string): Promise<string>;
  deletePhoto(path: string): Promise<void>;
  pendingCount(): Promise<number>;
  flush(): Promise<void>;
  exportAll(): Promise<Record<string, unknown[]>>;
  deleteEverything(): Promise<void>;
  subscribe(fn: (table: Table) => void): () => void;
}

/** Aplica um Query em memória (modo local, cache offline e mescla da fila). */
export function applyQuery<T extends AnyRow>(rows: T[], q: Query = {}): T[] {
  let out = rows.filter((r) =>
    Object.entries(q.eq ?? {}).every(([k, v]) => r[k] === v)
    && Object.entries(q.gte ?? {}).every(([k, v]) => (r[k] as string | number) >= v)
    && Object.entries(q.lte ?? {}).every(([k, v]) => (r[k] as string | number) <= v));
  if (q.order) {
    const { col, asc = true } = q.order;
    out = [...out].sort((a, b) => {
      const x = a[col] as string | number; const y = b[col] as string | number;
      return x === y ? 0 : (x < y ? -1 : 1) * (asc ? 1 : -1);
    });
  }
  return q.limit ? out.slice(0, q.limit) : out;
}

function dbName(userId: string) { return `titan-${userId}`; }

async function openUserDB(userId: string): Promise<IDBPDatabase> {
  return openDB(dbName(userId), 3, {
    upgrade(db) {
      for (const t of TABLES) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: keyOf(t) });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
    },
  });
}

class Emitter {
  private fns = new Set<(t: Table) => void>();
  on(fn: (t: Table) => void) { this.fns.add(fn); return () => { this.fns.delete(fn); }; }
  emit(t: Table) { this.fns.forEach((f) => f(t)); }
}

const now = () => new Date().toISOString();

// ------------------------------------------------------------------ modo local
/** Modo local: dados SOMENTE neste navegador (IndexedDB). Útil para testar sem conta. */
export class LocalStore implements DataStore {
  readonly mode = 'local' as const;
  private ev = new Emitter();
  private constructor(readonly userId: string, private db: IDBPDatabase) {}
  static async open(userId: string) { return new LocalStore(userId, await openUserDB(userId)); }

  async list<T>(table: Table, q?: Query): Promise<T[]> {
    const all = (await this.db.getAll(table)) as AnyRow[];
    return applyQuery(all.filter((r) => r.user_id === this.userId), q) as T[];
  }
  async upsert(table: Table, rows: AnyRow | AnyRow[]) {
    const tx = this.db.transaction(table, 'readwrite');
    for (const r of Array.isArray(rows) ? rows : [rows]) {
      const key = r[keyOf(table)] as string;
      const prev = key ? ((await tx.store.get(key)) as AnyRow | undefined) : undefined;
      await tx.store.put({ created_at: now(), ...prev, ...r, user_id: this.userId, updated_at: now() });
    }
    await tx.done;
    this.ev.emit(table);
    return { queued: false };
  }
  async remove(table: Table, ids: string[]) {
    const tx = this.db.transaction(table, 'readwrite');
    for (const id of ids) await tx.store.delete(id);
    await tx.done;
    this.ev.emit(table);
  }
  async uploadPhoto(path: string, blob: Blob) { await this.db.put('files', blob, path); }
  async photoUrl(path: string) {
    const blob = (await this.db.get('files', path)) as Blob | undefined;
    return blob ? URL.createObjectURL(blob) : '';
  }
  async deletePhoto(path: string) { await this.db.delete('files', path); }
  async pendingCount() { return 0; }
  async flush() {}
  async exportAll() {
    const out: Record<string, unknown[]> = {};
    for (const t of TABLES) out[t] = await this.list(t);
    return out;
  }
  async deleteEverything() {
    this.db.close();
    await new Promise<void>((res, rej) => { const r = indexedDB.deleteDatabase(dbName(this.userId)); r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res(); });
  }
  subscribe(fn: (t: Table) => void) { return this.ev.on(fn); }
}

// ------------------------------------------------------------------ modo nuvem
interface OutboxItem { seq?: number; table: Table; op: 'upsert' | 'delete'; row?: AnyRow; ids?: string[]; at: string }

export class NetworkError extends Error {}

function isNetworkError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e);
  return e instanceof NetworkError || e instanceof TypeError || /fetch|network|Failed to|Load failed|timeout/i.test(msg);
}

/**
 * Supabase + fila offline (outbox) no IndexedDB.
 * - Escrita: grava primeiro na fila local (durável) e tenta enviar. Sem rede → fica na fila e
 *   é reenviada ao voltar a conexão. Erro de validação/permissão do servidor → é descartada e reportada.
 * - Leitura: busca no servidor e mescla o que ainda está na fila; sem rede, usa o último cache.
 */
export class CloudStore implements DataStore {
  readonly mode = 'cloud' as const;
  private ev = new Emitter();
  private flushing: Promise<void> | null = null;
  lastError: string | null = null;
  private constructor(readonly userId: string, private sb: SupabaseClient, private db: IDBPDatabase) {
    if (typeof window !== 'undefined') window.addEventListener('online', () => { void this.flush(); });
  }
  static async open(userId: string, sb: SupabaseClient) { return new CloudStore(userId, sb, await openUserDB(userId)); }

  private async pending(table?: Table): Promise<OutboxItem[]> {
    const all = (await this.db.getAll('outbox')) as OutboxItem[];
    return table ? all.filter((i) => i.table === table) : all;
  }

  async list<T>(table: Table, q: Query = {}): Promise<T[]> {
    const cacheKey = `${table}:${JSON.stringify(q)}`;
    let rows: AnyRow[];
    try {
      let req = this.sb.from(table).select('*').eq('user_id', this.userId);
      for (const [k, v] of Object.entries(q.eq ?? {})) req = req.eq(k, v);
      for (const [k, v] of Object.entries(q.gte ?? {})) req = req.gte(k, v);
      for (const [k, v] of Object.entries(q.lte ?? {})) req = req.lte(k, v);
      if (q.order) req = req.order(q.order.col, { ascending: q.order.asc ?? true });
      if (q.limit) req = req.limit(q.limit);
      const { data, error } = await req;
      if (error) throw error;
      rows = (data ?? []) as AnyRow[];
      await this.db.put('cache', rows, cacheKey);
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      rows = ((await this.db.get('cache', cacheKey)) as AnyRow[] | undefined) ?? [];
    }
    // Mescla alterações ainda não sincronizadas.
    const key = keyOf(table);
    const map = new Map(rows.map((r) => [r[key] as string, r]));
    for (const item of await this.pending(table)) {
      if (item.op === 'upsert' && item.row) map.set(item.row[key] as string, { ...map.get(item.row[key] as string), ...item.row });
      if (item.op === 'delete') item.ids?.forEach((id) => map.delete(id));
    }
    return applyQuery([...map.values()], q) as T[];
  }

  async upsert(table: Table, rows: AnyRow | AnyRow[]) {
    const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, user_id: this.userId }));
    for (const row of list) await this.db.add('outbox', { table, op: 'upsert', row, at: now() } satisfies OutboxItem);
    this.ev.emit(table);
    await this.flush();
    return { queued: (await this.pending()).length > 0 };
  }

  async remove(table: Table, ids: string[]) {
    await this.db.add('outbox', { table, op: 'delete', ids, at: now() } satisfies OutboxItem);
    this.ev.emit(table);
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      try {
        const items = (await this.db.getAll('outbox')) as OutboxItem[];
        for (const item of items) {
          try {
            if (item.op === 'upsert') {
              const { error } = await this.sb.from(item.table).upsert(item.row!, { onConflict: keyOf(item.table) });
              if (error) throw error;
            } else {
              const { error } = await this.sb.from(item.table).delete().in(keyOf(item.table), item.ids!);
              if (error) throw error;
            }
            await this.db.delete('outbox', item.seq!);
          } catch (e) {
            if (isNetworkError(e)) break; // tenta de novo mais tarde, preservando a ordem
            // Rejeitado pelo servidor (validação/RLS): remove da fila e reporta.
            await this.db.delete('outbox', item.seq!);
            this.lastError = `Não foi possível salvar em ${item.table}: ${(e as { message?: string }).message ?? e}`;
            console.error('[titan] registro rejeitado pelo servidor', item.table, (e as { code?: string }).code);
            this.ev.emit(item.table);
          }
        }
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }

  async pendingCount() { return (await this.pending()).length; }

  async uploadPhoto(path: string, blob: Blob) {
    const { error } = await this.sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
    if (error) throw error;
  }
  async photoUrl(path: string) {
    const { data, error } = await this.sb.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }
  async deletePhoto(path: string) {
    const { error } = await this.sb.storage.from(PHOTO_BUCKET).remove([path]);
    if (error) throw error;
  }
  async exportAll() {
    await this.flush();
    const out: Record<string, unknown[]> = {};
    for (const t of TABLES) out[t] = await this.list(t);
    return out;
  }
  async deleteEverything() {
    // 1) arquivos do Storage (não são apagados pela cascata do banco)
    const { data: files } = await this.sb.storage.from(PHOTO_BUCKET).list(this.userId, { limit: 1000 });
    if (files?.length) await this.sb.storage.from(PHOTO_BUCKET).remove(files.map((f) => `${this.userId}/${f.name}`));
    // 2) conta + todas as linhas (cascata)
    const { error } = await this.sb.rpc('delete_my_account');
    if (error) throw error;
    this.db.close();
    indexedDB.deleteDatabase(dbName(this.userId));
  }
  subscribe(fn: (t: Table) => void) { return this.ev.on(fn); }
}

export const uuid = () => crypto.randomUUID();
