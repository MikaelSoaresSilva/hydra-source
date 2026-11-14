import { describe, expect, it } from 'vitest';
import { SUGGESTED_STACK, SUPPLEMENTS, SUPPLEMENT_TRUTH, trackable } from './supplements';
import { adjustCalories } from './trend';
import { FACE_ROUTINE, FACE_SKIP, FACE_TRUTH } from './facePlan';

describe('suplementos', () => {
  it('creatina e proteína são nível A; hormônios e boosters são nível C e nunca rastreáveis', () => {
    const by = Object.fromEntries(SUPPLEMENTS.map((s) => [s.id, s]));
    expect(by.creatine.tier).toBe('A');
    expect(by.protein.tier).toBe('A');
    for (const id of ['hormones', 'boosters', 'bcaa', 'preworkout']) {
      expect(by[id].tier).toBe('C');
      expect(by[id].trackable).toBeFalsy();
    }
    expect(trackable().map((s) => s.id)).toEqual(['creatine', 'protein']);
    expect(SUGGESTED_STACK.every((id) => by[id].tier === 'A')).toBe(true);
  });
  it('doses calculadas pelo peso e sempre com fonte', () => {
    const caffeine = SUPPLEMENTS.find((s) => s.id === 'caffeine')!;
    expect(caffeine.dose(75)).toMatch(/225–450 mg/);
    expect(caffeine.dose(null)).toMatch(/3–6 mg por kg/);
    expect(SUPPLEMENTS.find((s) => s.id === 'protein')!.dose(75)).toMatch(/120–165 g/);
    expect(SUPPLEMENTS.find((s) => s.id === 'creatine')!.dose(75)).toMatch(/3–5 g por dia/);
    SUPPLEMENTS.forEach((s) => expect(s.evidence.length, s.id).toBeGreaterThan(10));
  });
  it('não promete multiplicar resultado', () => {
    expect(SUPPLEMENT_TRUTH.join(' ')).toMatch(/Nenhum suplemento dá 1000%/);
    expect(SUPPLEMENTS.map((s) => s.effect).join(' ')).not.toMatch(/garant|milagr/i);
  });
});

describe('plano do rosto: honesto', () => {
  it('deixa claro que não existe emagrecimento localizado nem mudança de osso', () => {
    expect(FACE_TRUTH.join(' ')).toMatch(/Não existe perder gordura só do rosto/);
    expect(FACE_TRUTH.join(' ')).toMatch(/não muda com exercício em adultos/);
  });
  it('o treino facial não inclui exercícios de bochecha nem aparelho de mandíbula (estão em "não fazer")', () => {
    expect(FACE_ROUTINE.map((s) => s.title).join(' ')).not.toMatch(/bochecha|chiclete|mandíbula/i);
    expect(FACE_SKIP.map((s) => s.what).join(' ')).toMatch(/bochecha/);
    expect(FACE_SKIP.map((s) => s.what).join(' ')).toMatch(/Chiclete duro/);
    FACE_ROUTINE.forEach((s) => expect(s.dose.length).toBeGreaterThan(5));
  });
});

describe('ajuste de calorias na recomposição (alvo negativo)', () => {
  const weekly = (a: number, b: number, c: number) => [{ week: '1', avg: a, count: 4 }, { week: '2', avg: b, count: 4 }, { week: '3', avg: c, count: 4 }] as never;
  const base = { currentKcal: 2400, targetWeeklyGainKg: -0.32, adherence: 0.9 };
  it('perdendo no ritmo → mantém', () => {
    expect(adjustCalories({ ...base, weekly: weekly(75, 74.7, 74.4) }).action).toBe('maintain');
  });
  it('sem perder por 2 semanas → −100 kcal', () => {
    const r = adjustCalories({ ...base, weekly: weekly(75, 75, 75.1) });
    expect([r.action, r.newKcal]).toEqual(['decrease', 2300]);
  });
  it('perdendo rápido demais → +100 kcal para proteger o músculo', () => {
    const r = adjustCalories({ ...base, weekly: weekly(75, 74.2, 73.4) });
    expect([r.action, r.newKcal]).toEqual(['increase', 2500]);
    expect(r.reason).toMatch(/proteger o músculo/);
  });
  it('ganho (alvo positivo) continua como antes', () => {
    expect(adjustCalories({ currentKcal: 2900, targetWeeklyGainKg: 0.15, adherence: 0.9, weekly: weekly(75, 75, 75) }).action).toBe('increase');
  });
});

describe('fase da dieta', () => {
  it('recomposição: −350 kcal sobre o gasto, proteína 2,0 g/kg, alvo semanal negativo', async () => {
    const { LocalStore } = await import('../data/store');
    const { applyNutritionPhase } = await import('../services');
    const { EMPTY_PROFILE } = await import('../data/AppContext');
    const { calculateTargets } = await import('./nutrition');
    const store = await LocalStore.open(`n-${Math.random()}`);
    const profile = { ...EMPTY_PROFILE(store.userId), age: 19, sex: 'male' as const, height_cm: 180, nutrition: { weightKg: 75, activityLevel: 'moderate' as const } };
    const tdee = calculateTargets({ weightKg: 75, heightCm: 180, age: 19, sex: 'male', activityLevel: 'moderate' }).tdee;
    const t = await applyNutritionPhase(store, profile, 'recomp');
    expect(t.kcal).toBe(Math.round((tdee - 350) / 50) * 50);
    expect(t.protein_g).toBe(150);
    expect((t.inputs as { weeklyGainKg: number; phase: string })).toMatchObject({ weeklyGainKg: -0.32, phase: 'recomp' });
    expect(t.kcal * 1).toBeGreaterThan(2200); // déficit leve, nunca agressivo
    const g = await applyNutritionPhase(store, profile, 'lean_gain');
    expect(g.kcal).toBe(Math.round((tdee + 250) / 50) * 50);
    expect(g.protein_g).toBe(135);
  });
});
