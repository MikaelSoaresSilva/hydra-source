import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { calibration, exerciseResponses, proportions, realTdee, regionResponses, sleepEffect, topInsight } from './personal';
import type { CheckinRow, FoodLogRow, MetricRow, SetLogRow } from './types';

const T = '2026-11-15';
const metric = (date: string, p: Partial<MetricRow>) => ({ id: date, user_id: 'u', date, weight_kg: null, arm_right_cm: null, arm_left_cm: null, chest_cm: null, waist_cm: null, thigh_cm: null, shoulders_cm: null, conditions: {}, notes: null, ...p }) as MetricRow;
let n = 0;
const set = (session: string, date: string, key: string, load: number, reps: number, muscle = 'biceps'): SetLogRow => ({ id: `s${++n}`, user_id: 'u', session_id: session, exercise_key: key, exercise_name: key, muscle, set_index: 1, kind: 'working', load_kg: load, reps, rir: 1, technique_ok: true, pain: 0, notes: null, logged_at: `${date}T18:00:00Z` });

describe('Meu Código · proporções', () => {
  it('usa só as medidas do usuário (118/80 = 1,48; faltam ~11,4 cm de ombro)', () => {
    const p = proportions([metric(T, { shoulders_cm: 118, waist_cm: 80, chest_cm: 100, arm_right_cm: 35, arm_left_cm: 35, calf_right_cm: 37 })]);
    const v = p.find((x) => x.id === 'vtaper')!;
    expect(v.current).toBe(1.48);
    expect(v.text).toMatch(/11,4 cm de ombro/);
    expect(p.find((x) => x.id === 'chest')!.current).toBe(1.25);
    expect(p.find((x) => x.id === 'arm_calf')!.text).toMatch(/braço está 2 cm abaixo/);
    expect(p.find((x) => x.id === 'arm_sym')!.text).toMatch(/simétricos/);
  });
  it('sem medidas não inventa nada', () => { expect(proportions([])).toEqual([]); });
});

describe('Meu Código · resposta por região', () => {
  it('espera 28 dias entre medidas', () => {
    const r = regionResponses([metric(addDays(T, -10), { arm_right_cm: 35 }), metric(T, { arm_right_cm: 35.5 })], [], T);
    const arm = r.find((x) => x.id === 'arm')!;
    expect(arm.level).toBe('waiting');
    expect(arm.text).toMatch(/Faltam 18 dia/);
  });
  it('classifica rápido / devagar e separa falta de volume de resposta lenta', () => {
    const logs: SetLogRow[] = [];
    for (let w = 0; w < 8; w++) for (let i = 0; i < 12; i++) logs.push(set(`a${w}`, addDays(T, -56 + w * 7), 'barbell_curl', 30, 10));
    const m = [metric(addDays(T, -56), { arm_right_cm: 35, arm_left_cm: 35, chest_cm: 100, calf_right_cm: 37 }), metric(T, { arm_right_cm: 36.2, arm_left_cm: 36.2, chest_cm: 100.2, calf_right_cm: 37 })];
    const r = regionResponses(m, logs, T);
    const arm = r.find((x) => x.id === 'arm')!;
    expect(arm.level).toBe('fast');
    expect(arm.per4w).toBe(0.6);
    expect(arm.weeklySets).toBeGreaterThanOrEqual(10);
    const chest = r.find((x) => x.id === 'chest')!;
    expect(chest.level).toBe('slow');
    expect(chest.text).toMatch(/Antes de culpar a genética/); // quase nenhuma série de peito registrada
    expect(r.find((x) => x.id === 'thigh')!.level).toBe('waiting');
  });
});

describe('Meu Código · exercícios', () => {
  it('ordena pelo ganho de força por semana; precisa de 4 sessões', () => {
    const logs: SetLogRow[] = [];
    [30, 31, 32.5, 34, 35].forEach((kg, i) => logs.push(set(`c${i}`, addDays(T, -28 + i * 7), 'barbell_curl', kg, 10)));
    [60, 60, 60, 60].forEach((kg, i) => logs.push(set(`b${i}`, addDays(T, -21 + i * 7), 'bench_press', kg, 8, 'chest')));
    [20, 21].forEach((kg, i) => logs.push(set(`x${i}`, addDays(T, -7 + i * 7), 'lateral_raise', kg, 12, 'side_delts')));
    const r = exerciseResponses(logs);
    expect(r.map((e) => e.key)).toEqual(['barbell_curl', 'bench_press']);
    expect(r[0].pctPerWeek).toBeGreaterThan(2);
    expect(r[1].pctPerWeek).toBe(0);
  });
});

describe('Meu Código · sono × treino', () => {
  it('compara treinos depois de noites boas e curtas', () => {
    const logs: SetLogRow[] = []; const checkins: CheckinRow[] = [];
    let kg = 30;
    for (let i = 0; i < 9; i++) {
      const d = addDays(T, -40 + i * 4);
      const good = i % 2 === 0;
      if (i > 0) kg = good ? kg * 1.03 : kg * 0.99;
      logs.push(set(`s${i}`, d, 'barbell_curl', kg, 10));
      checkins.push({ id: d, user_id: 'u', date: d, sleep_hours: good ? 8.5 : 6, sleep_quality: null, recovery: null, soreness: null, stress: null, notes: null });
    }
    const e = sleepEffect(logs, checkins);
    expect(e.ready).toBe(true);
    expect(e.gap).toBeGreaterThan(3);
    expect(e.text).toMatch(/sono vale/);
    expect(topInsight({ regions: [], exercises: [], sleep: e, tdee: realTdee([], [], T), sleptLastNight: 6 })).toMatch(/Você dormiu 6 h/);
  });
  it('sem dados suficientes, diz o que falta', () => {
    const e = sleepEffect([], []);
    expect(e.ready).toBe(false);
    expect(e.text).toMatch(/Preciso de pelo menos 3 treinos/);
  });
});

describe('Meu Código · gasto real', () => {
  const food = (kcal: number, days: number): FoodLogRow[] => Array.from({ length: days }, (_, i) => ({ id: `f${i}`, user_id: 'u', date: addDays(T, -i), meal: 'x', food_key: 'x', food_name: 'x', grams: 100, kcal, protein_g: 0, carbs_g: 0, fat_g: 0 }) as FoodLogRow);
  const weights = (start: number, perDay: number) => Array.from({ length: 10 }, (_, i) => metric(addDays(T, -27 + i * 3), { weight_kg: start + perDay * i * 3 }));
  it('peso estável: gasto = o que comeu', () => {
    const r = realTdee(food(2700, 20), weights(75, 0), T);
    expect(r.ready).toBe(true);
    expect(r.tdee).toBe(2700);
  });
  it('perdendo 0,35 kg/semana comendo 2.400: gasto ≈ 2.785', () => {
    const r = realTdee(food(2400, 20), weights(76, -0.05), T);
    expect(r.kgPerWeek).toBe(-0.35);
    expect(r.tdee).toBeGreaterThanOrEqual(2770);
    expect(r.tdee).toBeLessThanOrEqual(2800);
  });
  it('poucos registros: não calcula e explica', () => {
    const r = realTdee(food(2400, 5), weights(75, 0), T);
    expect(r.ready).toBe(false);
    expect(r.text).toMatch(/você tem 5/);
    // dias com registro incompleto (< 1.000 kcal) não contam
    expect(realTdee(food(600, 20), weights(75, 0), T).ready).toBe(false);
  });
  it('aviso quando o gasto real difere da fórmula', () => {
    const tdee = realTdee(food(2700, 20), weights(75, 0), T);
    expect(topInsight({ regions: [], exercises: [], sleep: sleepEffect([], []), tdee, formulaTdee: 2950 })).toMatch(/menor que o da fórmula/);
  });
});

describe('Meu Código · calibração', () => {
  it('começa em 0% e sobe com os registros', () => {
    const empty = { proportions: [], regions: regionResponses([], [], T), exercises: [], sleep: sleepEffect([], []), tdee: realTdee([], [], T) };
    expect(calibration(empty).pct).toBe(0);
    const p = proportions([metric(T, { shoulders_cm: 118, waist_cm: 80, chest_cm: 100, arm_right_cm: 35, arm_left_cm: 35, calf_right_cm: 37 })]);
    expect(calibration({ ...empty, proportions: p }).pct).toBe(20);
  });
});
