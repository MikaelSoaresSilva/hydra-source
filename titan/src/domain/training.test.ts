import { describe, expect, it } from 'vitest';
import { generateProgram, estimateMinutes, plannedWeeklyVolume, prescribeDay, weekPhase } from './program';
import { decliningExercises, estimated1RM, groupHistory, suggestProgression, type SessionPerformance } from './progression';
import { resolveExercise, getExercise } from './exercises';
import { missedCount, nextSession, projectSchedule } from './schedule';
import { weeklyVolume } from './volume';
import type { ProgramRow, SessionRow, SetLogRow } from './types';

const ws = (load: number, reps: number, extra: Partial<SessionPerformance['sets'][number]> = {}) =>
  ({ load_kg: load, reps, rir: 2, technique_ok: true, pain: 0, kind: 'working' as const, ...extra });
const perf = (sets: SessionPerformance['sets'], date = '2026-10-10'): SessionPerformance => ({ sessionId: date, date, sets });
const curl = { repRange: [8, 12] as [number, number], increment: 2 };

describe('progressão dupla', () => {
  it('sem histórico pede carga para a faixa e o RIR', () => {
    expect(suggestProgression(curl, 2, []).action).toBe('first_time');
  });
  it('topo da faixa em todas as séries → aumenta o incremento', () => {
    const s = suggestProgression(curl, 2, [perf([ws(30, 12), ws(30, 12), ws(30, 12)])]);
    expect(s.action).toBe('increase');
    expect(s.load).toBe(32);
  });
  it('topo em só parte das séries → mantém', () => {
    expect(suggestProgression(curl, 2, [perf([ws(30, 12), ws(30, 10), ws(30, 9)])]).action).toBe('maintain');
  });
  it('não aumenta com dor', () => {
    const s = suggestProgression(curl, 2, [perf([ws(30, 12), ws(30, 12, { pain: 5 })])]);
    expect(s.action).toBe('hold_pain');
    expect(s.load).toBe(30);
  });
  it('dor repetida reduz carga e sugere substituição', () => {
    const s = suggestProgression(curl, 2, [perf([ws(30, 10, { pain: 5 })], '2026-10-10'), perf([ws(30, 10, { pain: 4 })], '2026-10-07')]);
    expect(s.suggestSubstitution).toBe(true);
    expect(s.load).toBeLessThan(30);
  });
  it('não aumenta com técnica comprometida', () => {
    expect(suggestProgression(curl, 2, [perf([ws(30, 12), ws(30, 12, { technique_ok: false })])]).action).toBe('hold_technique');
  });
  it('não aumenta com recuperação ruim', () => {
    expect(suggestProgression(curl, 2, [perf([ws(30, 12), ws(30, 12)])], { recoveryScore: 2 }).action).toBe('hold_recovery');
  });
  it('abaixo do mínimo em 2 sessões → reduz', () => {
    const s = suggestProgression(curl, 2, [perf([ws(30, 6)], '2026-10-10'), perf([ws(30, 7)], '2026-10-07')]);
    expect(s.action).toBe('reduce');
    expect(s.load).toBeLessThan(30);
  });
  it('topo atingido mas muito além do esforço prescrito (RIR 0 vs alvo 3) → mantém', () => {
    expect(suggestProgression(curl, 3, [perf([ws(30, 12, { rir: 0 }), ws(30, 12, { rir: 0 })])]).action).toBe('maintain');
  });
  it('e1RM considera RIR', () => {
    expect(estimated1RM(100, 5, 0)).toBeCloseTo(116.67, 1);
    expect(estimated1RM(100, 5, 2)).toBeGreaterThan(estimated1RM(100, 5, 0));
  });
});

describe('gerador de programa', () => {
  const training = { trainingDays: [1, 2, 3, 4, 5], sessionMinutes: 100, equipmentConfirmed: true };
  it('5 dias seg–sex, todas as sessões dentro do tempo', () => {
    const p = generateProgram({ training });
    expect(p.days).toHaveLength(5);
    expect(p.trainingDays).toEqual([1, 2, 3, 4, 5]);
    p.days.forEach((d) => expect(estimateMinutes(d.slots)).toBeLessThanOrEqual(100));
  });
  it('tempo curto reduz o volume sem eliminar braços', () => {
    const p = generateProgram({ training: { ...training, sessionMinutes: 50 } });
    const full = generateProgram({ training });
    const sets = (c: typeof p) => c.days.flatMap((d) => d.slots).reduce((s, x) => s + x.sets, 0);
    expect(sets(p)).toBeLessThan(sets(full));
    const v = plannedWeeklyVolume(p, 1);
    expect(v.biceps ?? 0).toBeGreaterThanOrEqual(6);
  });
  it('braços recebem volume prioritário e o deload reduz séries', () => {
    const p = generateProgram({ training });
    const w1 = plannedWeeklyVolume(p, 1);
    const w5 = plannedWeeklyVolume(p, 5);
    const w8 = plannedWeeklyVolume(p, 8);
    expect(w5.biceps!).toBeGreaterThan(w1.biceps!);
    expect(w8.biceps!).toBeLessThan(w1.biceps!);
    expect(w1.biceps!).toBeGreaterThanOrEqual(8);
    expect(w1.triceps!).toBeGreaterThanOrEqual(8);
    expect(w1.chest!).toBeLessThanOrEqual(20);
  });
  it('RIR se aproxima da falha ao longo do ciclo e reabre no deload', () => {
    expect(weekPhase(1).rirCompound).toBeGreaterThan(weekPhase(6).rirCompound);
    expect(weekPhase(8).deload).toBe(true);
    const p = generateProgram({ training });
    expect(prescribeDay(p, 0, 8)[0].rir).toBe(4);
  });
  it('sem barra/rack, troca supino e agachamento por alternativas disponíveis', () => {
    const p = generateProgram({ training: { ...training, equipment: ['dumbbell', 'bench', 'cable', 'machine', 'leg_press'] } });
    const keys = p.days.flatMap((d) => d.slots.map((s) => s.exerciseKey));
    expect(keys).not.toContain('bench_press');
    expect(keys).not.toContain('back_squat');
    keys.forEach((k) => expect(getExercise(k).equipment.every((e) => ['dumbbell', 'bench', 'cable', 'machine', 'leg_press'].includes(e))).toBe(true));
  });
  it('respeita substituição escolhida pelo usuário', () => {
    expect(resolveExercise('ez_bar_curl', [], { ez_bar_curl: 'cable_curl' }).key).toBe('cable_curl');
  });
});

describe('agenda sem duplicar sessões', () => {
  const config = generateProgram({ training: { trainingDays: [1, 2, 3, 4, 5] } });
  const program: ProgramRow = { id: 'p', user_id: 'u', name: 'x', start_date: '2026-10-12', weeks: 8, config, status: 'active' };
  const sess = (sequence: number, status: SessionRow['status'] = 'done'): SessionRow => ({
    id: `s${sequence}`, user_id: 'u', program_id: 'p', week: 1, day_index: 1, sequence, scheduled_date: null, status,
    started_at: null, completed_at: '2026-10-12T18:00:00Z', fatigue: null, session_rpe: null, pain_notes: null, notes: null, exercises: [] });
  it('próxima sessão é a primeira pendente', () => {
    expect(nextSession(program, [sess(0), sess(1)]).sequence).toBe(2);
  });
  it('perder segunda: terça recebe a sessão 1, não duas', () => {
    const sched = projectSchedule(program, [], '2026-10-13', 2); // terça
    expect(sched[0]).toMatchObject({ date: '2026-10-13', sequence: 0 });
    expect(sched[1]).toMatchObject({ date: '2026-10-14', sequence: 1 });
    expect(missedCount(program, [], '2026-10-13')).toBe(1);
  });
  it('sessão em andamento não conta como concluída', () => {
    expect(nextSession(program, [sess(0, 'in_progress')]).sequence).toBe(0);
  });
});

describe('volume e tendências', () => {
  const log = (key: string, session: string, date: string, load: number, reps: number): SetLogRow => ({
    id: `${session}${key}${load}${reps}${Math.random()}`, user_id: 'u', session_id: session, exercise_key: key, exercise_name: key,
    muscle: getExercise(key).primary, set_index: 0, kind: 'working', load_kg: load, reps, rir: 1, technique_ok: true, pain: 0, notes: null, logged_at: `${date}T17:00:00Z` });
  it('conta séries diretas e indiretas', () => {
    const v = weeklyVolume([log('ez_bar_curl', 'a', '2026-10-12', 30, 10), log('lat_pulldown', 'a', '2026-10-12', 60, 10)], '2026-10-12', '2026-10-18');
    expect(v.biceps).toBe(1.5);
    expect(v.back).toBe(1);
  });
  it('detecta queda consecutiva de desempenho', () => {
    const logs = [
      log('ez_bar_curl', 'a', '2026-10-01', 30, 12), log('ez_bar_curl', 'b', '2026-10-05', 30, 10), log('ez_bar_curl', 'c', '2026-10-09', 30, 8),
      log('bench_press', 'a', '2026-10-01', 80, 10), log('bench_press', 'b', '2026-10-05', 80, 8), log('bench_press', 'c', '2026-10-09', 80, 6),
    ];
    expect(decliningExercises(logs).sort()).toEqual(['bench_press', 'ez_bar_curl']);
    expect(groupHistory(logs, 'bench_press')[0].sessionId).toBe('c');
  });
});
