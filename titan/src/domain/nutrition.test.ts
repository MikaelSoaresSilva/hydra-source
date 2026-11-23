import { describe, expect, it } from 'vitest';
import { bmrMifflin, calculateTargets, macroKcal } from './nutrition';
import { adjustCalories, movingAverage, weeklyAverages } from './trend';
import { equivalentGrams, FOOD_BY_KEY } from './foods';
import { estimateCost, generateDayPlan, shoppingList } from './mealplan';

const me = { weightKg: 80, heightCm: 180, age: 19, sex: 'male' as const, activityLevel: 'moderate' as const, experienceMonths: 24 };

describe('energia e macros', () => {
  it('Mifflin-St Jeor para 80 kg, 180 cm, 19 anos, homem = 1835 kcal', () => {
    expect(bmrMifflin(me)).toBe(1835);
  });

  it('metas: superávit conservador, proteína 1,8 g/kg, macros fecham as calorias', () => {
    const t = calculateTargets(me);
    expect(t.tdee).toBe(Math.round(1835 * 1.55));
    expect(t.tdeeRange[0]).toBeLessThan(t.tdee);
    expect(t.surplus).toBeGreaterThanOrEqual(150);
    expect(t.surplus).toBeLessThanOrEqual(350);
    expect(t.proteinG).toBe(144);
    expect(t.fatG).toBeGreaterThanOrEqual(72);
    expect(Math.abs(macroKcal(t.proteinG, t.carbsG, t.fatG) - t.kcal)).toBeLessThanOrEqual(4);
    expect(t.kcal % 50).toBe(0);
  });

  it('iniciante mira ganho maior que avançado', () => {
    const novice = calculateTargets({ ...me, experienceMonths: 6 });
    const adv = calculateTargets({ ...me, experienceMonths: 60 });
    expect(novice.monthlyGainKg).toBeGreaterThan(adv.monthlyGainKg);
    expect(novice.surplus).toBeGreaterThanOrEqual(adv.surplus);
  });
});

describe('tendência de peso', () => {
  const day = (i: number) => `2026-09-${String(7 + i).padStart(2, '0')}`; // 07/09/2026 é segunda
  it('média móvel suaviza oscilações diárias', () => {
    const ma = movingAverage([80, 81, 79.5, 80.5].map((w, i) => ({ date: day(i), weight: w })));
    expect(ma[3].avg).toBe(80.25);
  });

  it('agrupa por semana e ignora semanas com poucas pesagens', () => {
    const pts = [
      ...[0, 1, 2].map((i) => ({ date: day(i), weight: 80 })),
      { date: day(7), weight: 81 }, // semana com 1 pesagem
    ];
    const w = weeklyAverages(pts);
    expect(w).toHaveLength(1);
    expect(w[0].weekStart).toBe('2026-09-07');
  });

  const weeks = (avgs: number[]) => avgs.map((avg, i) => ({ weekStart: `w${i}`, avg, count: 4 }));

  it('não ajusta com dados insuficientes', () => {
    expect(adjustCalories({ currentKcal: 3000, weekly: weeks([80, 80]), targetWeeklyGainKg: 0.15, adherence: 1 }).action).toBe('insufficient_data');
  });
  it('pede adesão antes de mudar calorias', () => {
    expect(adjustCalories({ currentKcal: 3000, weekly: weeks([80, 80, 80]), targetWeeklyGainKg: 0.15, adherence: 0.5 }).action).toBe('improve_adherence');
  });
  it('aumenta gradualmente após 2 semanas abaixo do ritmo', () => {
    const r = adjustCalories({ currentKcal: 3000, weekly: weeks([80, 80, 79.9]), targetWeeklyGainKg: 0.15, adherence: 0.9 });
    expect(r.action).toBe('increase');
    expect(r.newKcal).toBe(3150);
  });
  it('não reage a uma única semana fora do ritmo', () => {
    const r = adjustCalories({ currentKcal: 3000, weekly: weeks([80, 80.2, 80.2]), targetWeeklyGainKg: 0.15, adherence: 0.9 });
    expect(r.action).toBe('maintain');
  });
  it('reduz quando ganha rápido demais por 2 semanas', () => {
    const r = adjustCalories({ currentKcal: 3000, weekly: weeks([80, 80.5, 81]), targetWeeklyGainKg: 0.15, adherence: 0.9 });
    expect(r.action).toBe('decrease');
    expect(r.newKcal).toBe(2900);
  });
});

describe('plano alimentar', () => {
  const target = { kcal: 3050, protein: 144, carbs: 456, fat: 72 };
  it('gera refeições que se aproximam da meta (±10% kcal e proteína)', () => {
    const plan = generateDayPlan(target, { mealsPerDay: 5 });
    expect(plan.meals).toHaveLength(5);
    expect(Math.abs(plan.totals.kcal - target.kcal) / target.kcal).toBeLessThan(0.1);
    expect(Math.abs(plan.totals.protein - target.protein) / target.protein).toBeLessThan(0.1);
    plan.meals.forEach((m) => m.items.forEach((i) => expect(i.grams).toBeGreaterThan(0)));
  });
  it('respeita alimentos excluídos', () => {
    const plan = generateDayPlan(target, { excluded: ['frango_peito_grelhado', 'pao_frances'] });
    const keys = plan.meals.flatMap((m) => m.items.map((i) => i.foodKey));
    expect(keys).not.toContain('frango_peito_grelhado');
    expect(keys).not.toContain('pao_frances');
  });
  it('substituição equivalente iguala o macro dominante', () => {
    const r = equivalentGrams(FOOD_BY_KEY.frango_peito_grelhado, 150, FOOD_BY_KEY.patinho_grelhado);
    expect(Math.abs(r.grams * 0.359 - 150 * 0.32)).toBeLessThan(2);
  });
  it('custo usa só preços registrados e lista os que faltam', () => {
    const items = shoppingList(generateDayPlan(target));
    const rice = items.find((i) => i.foodKey === 'arroz_branco_cozido')!;
    const cost = estimateCost(items, [{ food_key: 'arroz_branco_cozido', price_brl: 25, package_g: 5000, observed_on: '2026-10-01', store: 'Mercado X', source: 'nota fiscal' }]);
    const line = cost.lines.find((l) => l.foodKey === 'arroz_branco_cozido')!;
    expect(line.costWeek).toBeCloseTo((rice.buyGramsWeek / 5000) * 25, 1);
    expect(cost.missing.length).toBe(items.length - 1);
  });
});
