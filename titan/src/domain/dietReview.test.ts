import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { reviewDiet } from './dietReview';
import type { FoodLogRow, MetricRow, TargetRow } from './types';

const T = '2026-11-15'; // domingo
const target = (p: Partial<TargetRow> = {}, inputs: Record<string, unknown> = {}): TargetRow => ({
  id: 't', user_id: 'u', effective_from: addDays(T, -30), kcal: 2450, protein_g: 150, carbs_g: 320, fat_g: 60, rationale: '',
  inputs: { weightKg: 75, weeklyGainKg: -0.32, tdee: 2800, phase: 'recomp', ...inputs }, ...p,
} as TargetRow);
const metric = (date: string, p: Partial<MetricRow>) => ({ id: date + JSON.stringify(p), user_id: 'u', date, weight_kg: null, arm_right_cm: null, arm_left_cm: null, chest_cm: null, waist_cm: null, thigh_cm: null, shoulders_cm: null, conditions: {}, notes: null, ...p }) as MetricRow;
/** 4 semanas de pesagens (4 por semana), variando `perWeek` kg por semana. */
const weights = (start: number, perWeek: number) => Array.from({ length: 16 }, (_, i) => metric(addDays(T, -27 + Math.floor(i / 4) * 7 + (i % 4)), { weight_kg: start + perWeek * Math.floor(i / 4) }));
const food = (kcal: number, days = 12): FoodLogRow[] => Array.from({ length: days }, (_, i) => ({ id: `f${i}`, user_id: 'u', date: addDays(T, -1 - i), meal: 'x', food_key: 'x', food_name: 'x', grams: 1, kcal, protein_g: 150, carbs_g: 0, fat_g: 0 }) as FoodLogRow);

describe('revisão automática da dieta', () => {
  it('ritmo dentro do esperado: nada muda', () => {
    const r = reviewDiet({ target: target(), metrics: weights(76, -0.3), food: food(2450), today: T });
    expect(r.changed).toBe(false);
    expect(r.kcal).toBe(2450);
    expect(r.kept.join(' ')).toMatch(/dentro do esperado/);
  });
  it('recomposição parada 2 semanas, comendo a meta: −100 kcal', () => {
    const r = reviewDiet({ target: target(), metrics: weights(75, 0), food: food(2450), today: T });
    expect(r.changed).toBe(true);
    expect(r.kcal).toBe(2350);
    expect(r.protein).toBe(150);
    expect(r.carbs).toBe(Math.round((2350 - 150 * 4 - 60 * 9) / 4));
    expect(r.changes[0]).toMatch(/−100|-100/);
  });
  it('perdendo rápido demais: +100 kcal para proteger o músculo', () => {
    const r = reviewDiet({ target: target(), metrics: weights(78, -0.9), food: food(2450), today: T });
    expect(r.kcal).toBe(2550);
  });
  it('sem comida registrada: não mexe (seria chute)', () => {
    const r = reviewDiet({ target: target(), metrics: weights(75, 0), food: [], today: T });
    expect(r.changed).toBe(false);
    expect(r.kept.join(' ')).toMatch(/seria chute/);
  });
  it('comendo fora da meta: pede adesão antes de mudar', () => {
    const r = reviewDiet({ target: target(), metrics: weights(75, 0), food: food(3200), today: T });
    expect(r.changed).toBe(false);
    expect(r.kept.join(' ')).toMatch(/Adesão alimentar/);
  });
  it('meta mudou há menos de 14 dias: espera', () => {
    const r = reviewDiet({ target: target({ effective_from: addDays(T, -5) }), metrics: weights(75, 0), food: food(2450), today: T });
    expect(r.changed).toBe(false);
    expect(r.kept.join(' ')).toMatch(/Espero 14 dias/);
  });
  it('poucas pesagens: não muda por uma medida isolada', () => {
    const r = reviewDiet({ target: target(), metrics: [metric(T, { weight_kg: 77 })], food: food(2450), today: T });
    expect(r.kcal).toBe(2450);
    expect(r.kept.join(' ')).toMatch(/3 semanas/);
  });
  it('peso mudou 2 kg+: proteína acompanha (2,0 g/kg) mesmo sem mexer nas calorias', () => {
    const r = reviewDiet({ target: target({}, { weightKg: 79 }), metrics: weights(76.2, -0.3), food: food(2450), today: T });
    expect(r.newWeightKg).toBeCloseTo(75.3, 1);
    expect(r.protein).toBe(151);
    expect(r.kcal).toBe(2450);
    expect(r.changed).toBe(true);
  });
  it('ganho: cintura +2 cm em 4 semanas sem braço crescer → −150 kcal', () => {
    const t = target({ kcal: 3050 }, { phase: 'lean_gain', weeklyGainKg: 0.23, tdee: 2800 });
    const m = [...weights(75, 0.25), metric(addDays(T, -30), { waist_cm: 80, arm_right_cm: 35 }), metric(T, { waist_cm: 82, arm_right_cm: 35.2 })];
    const r = reviewDiet({ target: t, metrics: m, food: food(3050), today: T });
    expect(r.kcal).toBe(2900);
    expect(r.changes.join(' ')).toMatch(/virando gordura/);
  });
  it('ganho: cintura estável → mantém', () => {
    const t = target({ kcal: 3050 }, { phase: 'lean_gain', weeklyGainKg: 0.23, tdee: 2800 });
    const m = [...weights(75, 0.25), metric(addDays(T, -30), { waist_cm: 80 }), metric(T, { waist_cm: 80.5 })];
    const r = reviewDiet({ target: t, metrics: m, food: food(3050), today: T });
    expect(r.changed).toBe(false);
    expect(r.kept.join(' ')).toMatch(/dentro do limite/);
  });
  it('limite de segurança: nunca déficit maior que 500 kcal', () => {
    const r = reviewDiet({ target: target({ kcal: 2300 }), metrics: weights(75, 0), food: food(2300), today: T });
    expect(r.kcal).toBe(2300); // 2200 passaria do limite (2800 − 500)
    expect(r.changed).toBe(false);
    expect(r.kept.join(' ')).toMatch(/Limite de segurança/);
  });
});
