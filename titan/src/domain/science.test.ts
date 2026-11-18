import { describe, expect, test } from 'vitest';
import {
  applyReadiness, estimate1RM, loadForReps, mealsBelowProtein, percentForReps, proteinPerMealTarget, sessionLoad, tonnage,
  trainingLevel, waistRisk, weekStartOf, weeklyLoads,
} from './science';
import { baseWeeklySets, generateProgram } from './program';
import { calculateTargets } from './nutrition';
import type { SessionRow, SetLogRow } from './types';

describe('%1RM (Baechle)', () => {
  test('tabela exata e interpolação 13–14', () => {
    expect(percentForReps(1)).toBe(100);
    expect(percentForReps(10)).toBe(75);
    expect(percentForReps(15)).toBe(65);
    expect(percentForReps(13)).toBeCloseTo(66.3, 1);
    expect(percentForReps(16)).toBeNull();
  });
  test('1RM estimado soma RIR e volta para a carga', () => {
    expect(estimate1RM(60, 10)).toBe(80);
    expect(estimate1RM(60, 8, 2)).toBe(80); // 8 feitas + 2 em reserva = 10 RM
    expect(estimate1RM(60, 20)).toBeNull();
    expect(loadForReps(80, 10)).toBe(60);
  });
});

test('nível pelo tempo de treino', () => {
  expect(trainingLevel(undefined)).toBe('beginner');
  expect(trainingLevel(3)).toBe('beginner');
  expect(trainingLevel(8)).toBe('intermediate');
  expect(trainingLevel(24)).toBe('advanced');
});

describe('prontidão TQR', () => {
  const slots = [{ sets: 3, rir: 2 }, { sets: 1, rir: 1 }];
  test('≥13 mantém', () => {
    const r = applyReadiness(slots, 15);
    expect(r.readiness.adjusted).toBe(false);
    expect(r.slots).toEqual(slots);
  });
  test('<13 tira 1 série (mín. 1) e soma 1 RIR', () => {
    const r = applyReadiness(slots, 11);
    expect(r.readiness.adjusted).toBe(true);
    expect(r.slots).toEqual([{ sets: 2, rir: 3 }, { sets: 1, rir: 2 }]);
  });
  test('limita à escala 6–20', () => { expect(applyReadiness(slots, 40).readiness.tqr).toBe(20); });
});

describe('carga de treino', () => {
  const s = (id: string, start: string, end: string, rpe: number | null) => ({ id, status: 'done', started_at: start, completed_at: end, session_rpe: rpe } as unknown as SessionRow);
  const log = (session_id: string, load: number, reps: number, kind = 'working') => ({ session_id, load_kg: load, reps, kind } as unknown as SetLogRow);
  test('PSE × minutos e tonelagem', () => {
    expect(sessionLoad(s('a', '2026-10-12T16:00:00Z', '2026-10-12T17:30:00Z', 7))).toBe(630);
    expect(sessionLoad(s('a', '2026-10-12T16:00:00Z', '2026-10-12T16:02:00Z', 7))).toBeNull();
    expect(tonnage([log('a', 60, 10), log('a', 20, 10, 'warmup'), log('a', 62.5, 8)])).toBe(1100);
  });
  test('agrupa por semana (segunda-feira)', () => {
    expect(weekStartOf('2026-10-15')).toBe('2026-10-12');
    expect(weekStartOf('2026-10-12')).toBe('2026-10-12');
    const w = weeklyLoads(
      [s('a', '2026-10-12T16:00:00Z', '2026-10-12T17:00:00Z', 6), s('b', '2026-10-14T16:00:00Z', '2026-10-14T17:00:00Z', null), s('c', '2026-10-19T16:00:00Z', '2026-10-19T17:00:00Z', 8)],
      [log('a', 50, 10), log('c', 50, 10)],
    );
    expect(w).toEqual([
      { weekStart: '2026-10-12', sessions: 2, load: 360, tonnage: 500, loadMissing: 1 },
      { weekStart: '2026-10-19', sessions: 1, load: 480, tonnage: 500, loadMissing: 0 },
    ]);
  });
});

test('cintura (OMS) e proteína por refeição', () => {
  expect(waistRisk(90, 'male')).toBe('normal');
  expect(waistRisk(95, 'male')).toBe('raised');
  expect(waistRisk(103, 'male')).toBe('high');
  expect(proteinPerMealTarget(80)).toEqual({ grams: 20, basis: 'total' });
  expect(proteinPerMealTarget(80, 68)).toEqual({ grams: 17, basis: 'lean' });
  expect(mealsBelowProtein([{ meal: 'Café', protein_g: 8 }, { meal: 'Café', protein_g: 6 }, { meal: 'Almoço', protein_g: 40 }], 20))
    .toEqual([{ meal: 'Café', protein: 14 }]);
});

test('superávit nunca passa de 350 kcal e cita a fonte', () => {
  const t = calculateTargets({ weightKg: 120, heightCm: 190, age: 19, sex: 'male', activityLevel: 'high', experienceMonths: 0 });
  expect(t.surplus).toBeLessThanOrEqual(350);
  expect(t.explanation.join(' ')).toMatch(/350 kcal/);
});

describe('volume mínimo dos prioritários', () => {
  const equipment = ['barbell', 'ez_bar', 'dumbbell', 'bench', 'rack', 'cable', 'machine', 'smith', 'pullup_bar', 'dip_station', 'leg_press', 'hack_squat'] as const;
  test.each([3, 4, 5])('%i dias × 100 min: bíceps e tríceps ≥10 séries/semana', (n) => {
    const c = generateProgram({ training: { trainingDays: [1, 2, 3, 4, 5].slice(0, n), sessionMinutes: 100, equipment: [...equipment], equipmentConfirmed: true } });
    const v = baseWeeklySets(c.days);
    expect(v.biceps).toBeGreaterThanOrEqual(10);
    expect(v.triceps).toBeGreaterThanOrEqual(10);
    c.days.forEach((d) => d.slots.forEach((s) => expect(s.sets).toBeLessThanOrEqual(4)));
  });
  test('com pouco tempo, avisa em vez de estourar o tempo', () => {
    const c = generateProgram({ training: { trainingDays: [1, 3, 5, 6], sessionMinutes: 60, equipment: [...equipment], equipmentConfirmed: true } });
    expect(c.notes.some((n) => /séries semanais \(meta ≥10\)/.test(n))).toBe(true);
  });
});
