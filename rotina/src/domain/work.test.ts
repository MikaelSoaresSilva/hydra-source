import { describe, expect, it } from 'vitest';
import { defaultState } from './defaults';
import { interpret } from './interpreter';
import { migrateAll } from './migrate';
import { applyOps, preview } from './ops';
import { buildDay } from './scheduler';
import { hm } from './time';
import type { State } from './types';
import { COMMUTE_IN, COMMUTE_OUT, findWork, syncWork } from './work';

const MON = '2026-11-16'; const WED = '2026-11-18'; const SAT = '2026-11-21';
const s0 = () => defaultState(new Date('2026-11-17T10:00:00'));
const at = (s: State, d: string, t: RegExp) => buildDay(s, d).items.find((i) => t.test(i.activity.title));
const noOverlap = (s: State, d: string) => {
  const items = buildDay(s, d).items.filter((i) => i.end > i.start && !i.parentId);
  for (let i = 1; i < items.length; i++) expect(items[i].start, `${items[i - 1].activity.title} x ${items[i].activity.title}`).toBeGreaterThanOrEqual(items[i - 1].end);
};
/** Simula o app: aplica a mudança e o ajuste automático do trabalho (como o commit faz). */
const change = (s: State, fn: (x: State) => State) => syncWork(s, fn(s));
const withWork = (start = '8h', end = '17h') => change(s0(), (s) => applyOps(s, interpret(`Vou trabalhar das ${start} às ${end}`, s, MON).ops));

describe('banho', () => {
  it('logo depois do treino do dia; lanche pós-treino logo depois do banho', () => {
    const s = s0();
    const gym = at(s, MON, /Academia/)!; const bath = at(s, MON, /^Banho/)!; const snack = at(s, MON, /pós-treino/)!;
    expect(bath.start).toBe(gym.end);
    expect(bath.end - bath.start).toBe(15);
    expect(snack.start).toBe(bath.end);
    const fight = at(s, SAT, /luta/i)!;
    expect(at(s, SAT, /^Banho/)!.start).toBe(fight.end);
    for (const d of [MON, WED, SAT]) noOverlap(s, d);
  });
  it('dia sem treino: banho à noite (21:00), antes do skincare noturno', () => {
    const s = s0();
    s.activities = s.activities.map((a) => (/Recuperação/.test(a.title) ? { ...a, paused: true } : a));
    const bath = at(s, WED, /^Banho/)!;
    expect(hm(bath.start)).toBe('21:00');
    expect(bath.end).toBeLessThanOrEqual(at(s, WED, /Skincare noturno/)!.start);
  });
  it('higiene da manhã não fala mais em banho; "hoje sem banho" pula o banho', () => {
    const s = s0();
    expect(s.activities.find((a) => a.title === 'Higiene pessoal')!.description).not.toMatch(/Banho rápido/);
    const next = applyOps(s, interpret('Hoje sem banho', s, MON).ops);
    expect(at(next, MON, /^Banho/)).toBeFalsy();
  });
});

describe('trabalho puxa o resto da rotina', () => {
  it('criar o trabalho: acordar só muda se a manhã não couber antes dele', () => {
    const { state, notes } = withWork('8h', '17h');
    // manhã ocupa 1h05 (acordar → fim do café) → precisa acordar até 06:55
    expect(hm(buildDay(state, MON).wake)).toBe('06:55');
    expect(hm(buildDay(state, MON).bed)).toBe('22:25');
    expect(notes.join(' ')).toMatch(/acordar 07:00 → 06:55/);
    expect(hm(at(state, MON, /Café/)!.end)).toBe('08:00');
    noOverlap(state, MON);
  });
  it('trabalho passa para 9h–18h: acordar e dormir andam 1 h; academia, banho e jantar vão para depois', () => {
    const a = withWork('8h', '17h').state;
    const work = findWork(a)!;
    const { state: b, notes } = change(a, (s) => ({ ...s, activities: s.activities.map((x) => (x.id === work.id ? { ...x, anchor: { type: 'time', at: 9 * 60 }, duration: 9 * 60 } : x)) }));
    const p = buildDay(b, MON);
    expect(hm(p.wake)).toBe('07:55');
    expect(hm(p.bed)).toBe('23:25');
    expect(p.sleepMinutes).toBe(buildDay(a, MON).sleepMinutes); // mesmas horas de sono
    expect(notes.join(' ')).toMatch(/07:55/);
    const gym = at(b, MON, /Academia/)!;
    expect(gym.start).toBeGreaterThanOrEqual(18 * 60);
    expect(at(b, MON, /^Banho/)!.start).toBe(gym.end);
    expect(at(b, MON, /Jantar/)!.start).toBeGreaterThanOrEqual(at(b, MON, /pós-treino/)!.end);
    noOverlap(b, MON);
    // fim de semana não muda
    expect(hm(buildDay(b, SAT).wake)).toBe('08:00');
  });
  it('rodar o ajuste de novo não move em dobro (idempotente)', () => {
    const a = withWork('8h', '17h').state;
    const work = findWork(a)!;
    const moved = { ...a, activities: a.activities.map((x) => (x.id === work.id ? { ...x, anchor: { type: 'time' as const, at: 9 * 60 } } : x)) };
    const once = syncWork(a, moved).state;
    const twice = syncWork(a, once).state;
    expect(twice.sleep).toEqual(once.sleep);
    expect(syncWork(once, once).notes).toEqual([]);
  });
  it('deslocamento: ida e volta grudadas no trabalho e acordar mais cedo para caber', () => {
    const a = withWork('8h', '17h').state;
    const { state: b } = change(a, (s) => ({ ...s, profile: { ...s.profile, commuteMin: 30 } }));
    const p = buildDay(b, MON);
    const work = at(b, MON, /^Trabalho/)!;
    const goIn = p.items.find((i) => i.activity.id === COMMUTE_IN)!;
    const back = p.items.find((i) => i.activity.id === COMMUTE_OUT)!;
    expect(goIn.end).toBe(work.start);
    expect(back.start).toBe(work.end);
    expect(hm(p.wake)).toBe('06:25'); // 08:00 − 30 min − 1h05 de manhã
    expect(at(b, MON, /Academia/)!.start).toBeGreaterThanOrEqual(back.end);
    expect(buildDay(b, SAT).items.some((i) => i.activity.id === COMMUTE_IN || i.activity.id === COMMUTE_OUT)).toBe(false); // sem trabalho, sem deslocamento
    noOverlap(b, MON);
    // tirar o deslocamento remove as atividades
    const { state: c } = change(b, (s) => ({ ...s, profile: { ...s.profile, commuteMin: 0 } }));
    expect(c.activities.some((x) => x.id === COMMUTE_IN || x.id === COMMUTE_OUT)).toBe(false);
  });
  it('trabalho mudado só hoje: acordar daquele dia acompanha, os outros dias não', () => {
    const a = withWork('8h', '17h').state;
    const { state: b } = change(a, (s) => applyOps(s, interpret('Hoje vou trabalhar das 10h às 19h', s, MON).ops));
    // (o pedido "hoje" cria um trabalho só do dia; o ajuste por dia também funciona pela linha do tempo)
    expect(buildDay(b, MON).items.some((i) => /Trabalho/.test(i.activity.title) && hm(i.start) === '10:00')).toBe(true);
    const work = findWork(a)!;
    const { state: c } = change(a, (s) => ({ ...s, overrides: { ...s.overrides, [MON]: { skip: [], move: { [work.id]: 10 * 60 }, duration: {}, add: [] } } }));
    expect(hm(buildDay(c, MON).wake)).toBe('08:55');
    expect(hm(buildDay(c, '2026-11-17').wake)).toBe('06:55');
    noOverlap(c, MON);
  });
  it('a prévia da IA já mostra o ajuste automático', () => {
    const s = s0();
    const r = interpret('Vou trabalhar das 8h às 17h', s, MON);
    const pv = preview(s, r.ops, MON, syncWork);
    expect(pv.auto.join(' ')).toMatch(/06:55/);
    expect(hm(buildDay(pv.next, MON).wake)).toBe('06:55');
  });
});

describe('migração v4', () => {
  it('dados antigos ganham banho encadeado e lanche pós-treino depois dele', () => {
    const v3 = s0();
    v3.version = 3;
    v3.activities = v3.activities.filter((a) => a.title !== 'Banho').map((a) => (a.title === 'Higiene pessoal' ? { ...a, description: 'Banho rápido, escovar os dentes (2 min) e fio dental.' } : /pós-treino/.test(a.title) ? { ...a, anchor: { type: 'time' as const, at: 18 * 60 + 15 } } : a));
    delete (v3.profile as { commuteMin?: number }).commuteMin;
    const v4 = migrateAll(v3);
    expect(v4.version).toBe(4);
    expect(v4.profile.commuteMin).toBe(0);
    expect(at(v4, MON, /^Banho/)!.start).toBe(at(v4, MON, /Academia/)!.end);
    expect(at(v4, MON, /pós-treino/)!.start).toBe(at(v4, MON, /^Banho/)!.end);
    expect(v4.activities.find((a) => a.title === 'Higiene pessoal')!.description).not.toMatch(/Banho rápido/);
    expect(migrateAll(v4)).toBe(v4);
  });
});
