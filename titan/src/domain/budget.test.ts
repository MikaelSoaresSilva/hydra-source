import { describe, expect, it } from 'vitest';
import { BUDGET_LIMIT, REF_PRICES, budgetPlan } from './budget';

describe('Cardápio econômico (R$ 500/mês, preço teto)', () => {
  it('cabe em R$ 500 nas metas de recomposição e de ganho do usuário', () => {
    for (const [kcal, p] of [[2450, 150], [2500, 150], [2900, 135], [3100, 135]]) {
      const b = budgetPlan(kcal, p);
      expect(b.costMonth).toBeLessThanOrEqual(BUDGET_LIMIT);
      expect(b.fits).toBe(true);
      expect(Math.abs(b.totals.kcal - kcal)).toBeLessThanOrEqual(kcal * 0.03);
      expect(b.totals.protein).toBeGreaterThanOrEqual(b.proteinUsed - 2);
    }
  });
  it('mantém a proteína da meta quando cabe; só desce até 90% se não couber', () => {
    expect(budgetPlan(2500, 150).proteinUsed).toBe(150);
    const low = budgetPlan(2200, 150);
    expect(low.proteinUsed).toBeLessThan(150);
    expect(low.proteinUsed).toBeGreaterThanOrEqual(135);
  });
  it('custo bate com os preços teto', () => {
    const b = budgetPlan(2500, 150);
    const ovo = b.items.find((i) => i.key === 'ovo')!;
    expect(ovo.costMonth).toBeCloseTo((ovo.unitsDay! * 30 / 30) * REF_PRICES.ovo.price, 1);
    expect(b.costMonth).toBeCloseTo(b.items.reduce((s, i) => s + i.costMonth, 0), 1);
    expect(b.reserve).toBeCloseTo(BUDGET_LIMIT - b.costMonth, 1);
  });
  it('as refeições somam o dia inteiro', () => {
    const b = budgetPlan(2500, 150);
    for (const it of b.items.filter((i) => i.key !== 'oleo')) {
      const total = b.meals.flatMap((m) => m.items).filter(([k]) => k === it.key).reduce((s, [, g]) => s + g, 0);
      expect(total).toBe(it.gramsDay);
    }
  });
  it('todo preço tem fonte (URL) e local/data', () => {
    for (const r of Object.values(REF_PRICES)) { expect(r.url).toMatch(/^https:\/\//); expect(r.where).toMatch(/2026/); expect(r.price).toBeGreaterThan(0); }
  });
});
