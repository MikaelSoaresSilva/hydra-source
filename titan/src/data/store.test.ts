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

describe('backup: exportar de um aparelho e restaurar em outro', () => {
  it('leva todos os registros para o novo usuário, mantendo ids e vínculos', async () => {
    const a = await LocalStore.open(`bk-a-${Math.random()}`);
    await a.upsert('profiles', { user_id: a.userId, display_name: 'Eu', age: 19, preferences: { trainingProtocol: 'jkk3' } });
    await a.upsert('programs', { id: 'p1', name: 'Protocolo JKK — 3 dias', status: 'active', config: { protocol: 'jkk3' } });
    await a.upsert('workout_sessions', { id: 's1', program_id: 'p1', sequence: 0, status: 'done' });
    await a.upsert('set_logs', [{ id: 'l1', session_id: 's1', exercise_key: 'incline_db_press', load_kg: 24, reps: 8 }, { id: 'l2', session_id: 's1', exercise_key: 'incline_db_press', load_kg: 24, reps: 7 }]);
    await a.upsert('body_metrics', { id: 'm1', date: '2026-11-13', weight_kg: 75, shoulders_cm: 118 });
    const backup = JSON.parse(JSON.stringify(await a.exportAll()));

    const b = await LocalStore.open(`bk-b-${Math.random()}`);
    const r = await b.importAll(backup);
    expect(r).toEqual({ rows: 6, tables: 5 });
    expect((await b.list<{ display_name: string; user_id: string }>('profiles'))[0]).toMatchObject({ display_name: 'Eu', user_id: b.userId });
    expect((await b.list<{ id: string }>('set_logs', { eq: { session_id: 's1' } })).map((x) => x.id).sort()).toEqual(['l1', 'l2']);
    expect((await b.list<{ weight_kg: number }>('body_metrics'))[0].weight_kg).toBe(75);
    // restaurar duas vezes não duplica
    await b.importAll(backup);
    expect(await b.list('set_logs')).toHaveLength(2);
  });
  it('recusa arquivo que não é backup do Titan', async () => {
    const b = await LocalStore.open(`bk-c-${Math.random()}`);
    await expect(b.importAll({ qualquer: [1, 2] })).rejects.toThrow(/não é um backup do Titan/);
    await expect(b.importAll([] as never)).rejects.toThrow(/inválido/);
  });
});
