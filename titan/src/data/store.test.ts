import { describe, expect, it, vi } from 'vitest';
import { applyQuery, CloudStore, LocalStore } from './store';

describe('LocalStore', () => {
  it('salva, filtra, ordena e exclui', async () => {
    const s = await LocalStore.open('t1');
    await s.upsert('body_metrics', [{ id: 'a', date: '2026-10-01', weight_kg: 80 }, { id: 'b', date: '2026-10-03', weight_kg: 80.4 }]);
    await s.upsert('body_metrics', { id: 'a', weight_kg: 79.8 });
    const rows = await s.list<{ id: string; weight_kg: number; date: string }>('body_metrics', { order: { col: 'date', asc: false } });
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
    expect(rows[1].weight_kg).toBe(79.8);
    expect(rows[1].date).toBe('2026-10-01'); // merge preserva campos
    await s.remove('body_metrics', ['a']);
    expect(await s.list('body_metrics')).toHaveLength(1);
  });
  it('isola por usuário', async () => {
    const a = await LocalStore.open('ua');
    const b = await LocalStore.open('ub');
    await a.upsert('daily_checkins', { id: 'x', date: '2026-10-01' });
    expect(await b.list('daily_checkins')).toHaveLength(0);
  });
});

describe('applyQuery', () => {
  it('eq, gte, lte e limit', () => {
    const rows = [{ d: '2026-01-01', k: 'x' }, { d: '2026-02-01', k: 'x' }, { d: '2026-03-01', k: 'y' }];
    expect(applyQuery(rows, { eq: { k: 'x' }, gte: { d: '2026-01-15' } })).toHaveLength(1);
    expect(applyQuery(rows, { lte: { d: '2026-02-01' }, limit: 1 })).toHaveLength(1);
  });
});

/** Supabase falso: permite simular queda de rede e rejeição do servidor. */
function fakeSupabase() {
  const tables: Record<string, Record<string, Record<string, unknown>>> = {};
  const state = { offline: false, reject: false };
  const chain = (table: string) => {
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q; },
      gte: () => q, lte: () => q, order: () => q, limit: () => q,
      then: (res: (v: unknown) => void, rej: (e: unknown) => void) => {
        if (state.offline) return rej(new TypeError('Failed to fetch'));
        res({ data: Object.values(tables[table] ?? {}).filter((r) => filters.every((f) => f(r))), error: null });
      },
      upsert: async (row: Record<string, unknown>) => {
        if (state.offline) throw new TypeError('Failed to fetch');
        if (state.reject) return { error: { message: 'violates check constraint', code: '23514' } };
        tables[table] = { ...tables[table], [row.id as string]: row };
        return { error: null };
      },
      delete: () => ({ in: async (_k: string, ids: string[]) => {
        if (state.offline) throw new TypeError('Failed to fetch');
        ids.forEach((id) => delete tables[table]?.[id]);
        return { error: null };
      } }),
    };
    return q;
  };
  return { sb: { from: chain } as never, tables, state };
}

describe('CloudStore com fila offline', () => {
  it('sem rede: série fica na fila, aparece na leitura e sincroniza ao voltar', async () => {
    const { sb, tables, state } = fakeSupabase();
    const s = await CloudStore.open('cloud-u1', sb);
    state.offline = true;
    const r = await s.upsert('set_logs', { id: 'set1', reps: 10 });
    expect(r.queued).toBe(true);
    expect(await s.pendingCount()).toBe(1);
    expect((await s.list<{ id: string }>('set_logs')).map((x) => x.id)).toEqual(['set1']);
    state.offline = false;
    await s.flush();
    expect(await s.pendingCount()).toBe(0);
    expect(tables.set_logs.set1).toMatchObject({ id: 'set1', reps: 10, user_id: 'cloud-u1' });
  });
  it('fila sobrevive a "fechar a página" (nova instância)', async () => {
    const { sb, state, tables } = fakeSupabase();
    state.offline = true;
    const s1 = await CloudStore.open('cloud-u2', sb);
    await s1.upsert('set_logs', { id: 'set2', reps: 8 });
    const s2 = await CloudStore.open('cloud-u2', sb);
    expect(await s2.pendingCount()).toBe(1);
    state.offline = false;
    await s2.flush();
    expect(tables.set_logs.set2).toBeTruthy();
  });
  it('rejeição do servidor não trava a fila e é reportada', async () => {
    const { sb, state } = fakeSupabase();
    const s = await CloudStore.open('cloud-u3', sb);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    state.reject = true;
    await s.upsert('set_logs', { id: 'bad', reps: 999 });
    expect(await s.pendingCount()).toBe(0);
    expect(s.lastError).toMatch(/set_logs/);
    err.mockRestore();
  });
});
