import { FOOD_BY_KEY, macrosFor, sumMacros, type Food, type Macros } from './foods';

export interface MealItem { foodKey: string; grams: number }
export interface Meal { name: string; time: string; items: MealItem[] }
export interface DayPlan { meals: Meal[]; totals: Macros; target: Macros; notes: string[] }

interface MealTpl {
  id: string; name: string; time: string; proteinShare: number; carbShare: number;
  protein: string[]; carb: string[]; fixed: [string, number][]; minProteinGrams?: number;
}

const TEMPLATES: MealTpl[] = [
  { id: 'cafe', name: 'Café da manhã', time: '07:00', proteinShare: 0.17, carbShare: 0.2,
    protein: ['ovo_cozido', 'queijo_mussarela'], carb: ['pao_frances', 'cuscuz_milho', 'aveia_flocos'], fixed: [['leite_integral', 200]] },
  { id: 'lanche_manha', name: 'Lanche da manhã', time: '10:00', proteinShare: 0.1, carbShare: 0.1,
    protein: ['iogurte_natural'], carb: ['maca', 'banana_prata'], fixed: [] },
  { id: 'almoco', name: 'Almoço', time: '12:00', proteinShare: 0.3, carbShare: 0.25, minProteinGrams: 100,
    protein: ['frango_peito_grelhado', 'patinho_grelhado', 'ovo_cozido', 'atum_lata_agua'], carb: ['arroz_branco_cozido', 'arroz_integral_cozido', 'macarrao_cozido', 'mandioca_cozida'],
    fixed: [['feijao_carioca_cozido', 140], ['brocolis_cozido', 80]] },
  { id: 'pre', name: 'Pré-treino', time: '14:45', proteinShare: 0.13, carbShare: 0.2,
    protein: ['ovo_cozido', 'atum_lata_agua', 'frango_peito_grelhado'], carb: ['pao_frances', 'aveia_flocos'], fixed: [['banana_prata', 100]] },
  { id: 'jantar', name: 'Pós-treino / Jantar', time: '18:45', proteinShare: 0.3, carbShare: 0.25, minProteinGrams: 100,
    protein: ['patinho_grelhado', 'frango_peito_grelhado', 'sardinha_lata_oleo', 'ovo_cozido'], carb: ['arroz_branco_cozido', 'batata_inglesa_cozida', 'batata_doce_cozida', 'macarrao_cozido'],
    fixed: [['feijao_carioca_cozido', 140]] },
  { id: 'ceia', name: 'Ceia', time: '21:30', proteinShare: 0.1, carbShare: 0.08,
    protein: ['iogurte_natural', 'leite_integral'], carb: ['aveia_flocos'], fixed: [['mamao_papaya', 150]] },
];

const BY_COUNT: Record<number, string[]> = {
  3: ['cafe', 'almoco', 'jantar'],
  4: ['cafe', 'almoco', 'pre', 'jantar'],
  5: ['cafe', 'almoco', 'pre', 'jantar', 'ceia'],
  6: ['cafe', 'lanche_manha', 'almoco', 'pre', 'jantar', 'ceia'],
};

const r5 = (n: number) => Math.max(0, Math.round(n / 5) * 5);

export interface PlanOptions {
  mealsPerDay?: number;
  excluded?: string[];
  times?: Record<string, string>;
  hasKitchen?: boolean;
}

/**
 * Gera um dia alimentar: resolve, por refeição, um sistema 2×2 (proteína × carboidrato)
 * para a fonte proteica e a fonte de carboidrato; a gordura restante entra como azeite.
 * O resultado mostra os totais REAIS (podem diferir levemente da meta pelos arredondamentos).
 */
export function generateDayPlan(target: Omit<Macros, 'kcal'> & { kcal: number }, opts: PlanOptions = {}): DayPlan {
  const ids = BY_COUNT[Math.min(6, Math.max(3, opts.mealsPerDay ?? 5))];
  const excluded = new Set(opts.excluded ?? []);
  const notes: string[] = [];
  const tpls = TEMPLATES.filter((t) => ids.includes(t.id));
  const pSum = tpls.reduce((s, t) => s + t.proteinShare, 0);
  const cSum = tpls.reduce((s, t) => s + t.carbShare, 0);
  const pick = (keys: string[]) => keys.find((k) => !excluded.has(k) && (opts.hasKitchen !== false || !k.endsWith('cozido') && !k.endsWith('grelhado') && !k.endsWith('cozida')))
    ?? keys.find((k) => !excluded.has(k));

  const meals: Meal[] = tpls.map((t) => {
    const items: MealItem[] = t.fixed.filter(([k]) => !excluded.has(k)).map(([foodKey, grams]) => ({ foodKey, grams }));
    const fixed = sumMacros(items.map((i) => macrosFor(FOOD_BY_KEY[i.foodKey], i.grams)));
    const Pm = (target.protein * t.proteinShare) / pSum - fixed.protein;
    const Cm = (target.carbs * t.carbShare) / cSum - fixed.carbs;
    const pk = pick(t.protein);
    const ck = pick(t.carb);
    if (pk && ck) {
      const p: Food = FOOD_BY_KEY[pk];
      const c: Food = FOOD_BY_KEY[ck];
      // [p.protein c.protein][x]   [Pm]
      // [p.carbs   c.carbs  ][y] = [Cm]   (por 100 g)
      const det = p.protein * c.carbs - c.protein * p.carbs;
      let x = det !== 0 ? ((Pm * c.carbs - c.protein * Cm) / det) * 100 : 0;
      let y = det !== 0 ? ((p.protein * Cm - Pm * p.carbs) / det) * 100 : 0;
      x = Math.min(p.maxGrams, r5(x));
      if (t.minProteinGrams && x < t.minProteinGrams) {
        // porção mínima de proteína animal nas refeições principais; recalcula o carboidrato
        x = t.minProteinGrams;
        y = ((Cm - (p.carbs * x) / 100) / c.carbs) * 100;
      }
      y = Math.min(c.maxGrams, r5(y));
      if (x > 0) items.push({ foodKey: pk, grams: x });
      if (y > 0) items.push({ foodKey: ck, grams: y });
    }
    return { name: t.name, time: opts.times?.[t.id] ?? t.time, items };
  });

  const before = sumMacros(meals.flatMap((m) => m.items.map((i) => macrosFor(FOOD_BY_KEY[i.foodKey], i.grams))));
  const fatGap = target.fat - before.fat;
  if (fatGap > 3 && !excluded.has('azeite_oliva')) {
    const main = meals.filter((m) => /Almoço|Jantar/.test(m.name));
    const per = Math.round(fatGap / Math.max(1, main.length));
    main.forEach((m) => m.items.push({ foodKey: 'azeite_oliva', grams: Math.min(40, per) }));
  }
  const totals = sumMacros(meals.flatMap((m) => m.items.map((i) => macrosFor(FOOD_BY_KEY[i.foodKey], i.grams))));
  const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : 0);
  const dk = pct(totals.kcal, target.kcal);
  if (Math.abs(dk) > 5) notes.push(`Total do plano difere ${dk}% da meta calórica; ajuste porções conforme a fome e o registro real.`);
  if (opts.hasKitchen === false) notes.push('Sem cozinha: priorize opções prontas (pão, atum, ovos cozidos comprados, iogurte, frutas).');
  return { meals, totals: roundMacros(totals), target, notes };
}

export function roundMacros(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) };
}

export interface ShoppingItem { foodKey: string; name: string; readyGramsPerDay: number; buyGramsWeek: number; buyGramsMonth: number; unitsWeek?: string }

/** Lista de compras: converte porções prontas para peso de compra (cru/seco) com fatores aproximados. */
export function shoppingList(plan: DayPlan): ShoppingItem[] {
  const per = new Map<string, number>();
  plan.meals.forEach((m) => m.items.forEach((i) => per.set(i.foodKey, (per.get(i.foodKey) ?? 0) + i.grams)));
  return [...per.entries()].map(([foodKey, g]) => {
    const f = FOOD_BY_KEY[foodKey];
    const buyDay = g * f.rawFactor;
    const units = f.unitGrams ? `${Math.ceil((g * 7) / f.unitGrams)} ${f.unitName}(s)` : undefined;
    return { foodKey, name: f.name, readyGramsPerDay: g, buyGramsWeek: Math.round(buyDay * 7), buyGramsMonth: Math.round(buyDay * 30), unitsWeek: units };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export interface PriceInfo { food_key: string; price_brl: number; package_g: number; observed_on: string; store: string | null; source: string | null }

/** Custo usando SOMENTE preços registrados pelo usuário (com data e fonte). */
export function estimateCost(items: ShoppingItem[], prices: PriceInfo[]) {
  const latest = new Map<string, PriceInfo>();
  [...prices].sort((a, b) => (a.observed_on < b.observed_on ? -1 : 1)).forEach((p) => latest.set(p.food_key, p));
  let week = 0;
  let month = 0;
  const missing: string[] = [];
  const lines = items.map((it) => {
    const p = latest.get(it.foodKey);
    if (!p) { missing.push(it.name); return { ...it, price: null as PriceInfo | null, costWeek: null as number | null, costMonth: null as number | null }; }
    const cw = (it.buyGramsWeek / p.package_g) * p.price_brl;
    const cm = (it.buyGramsMonth / p.package_g) * p.price_brl;
    week += cw; month += cm;
    return { ...it, price: p, costWeek: Math.round(cw * 100) / 100, costMonth: Math.round(cm * 100) / 100 };
  });
  return { lines, week: Math.round(week * 100) / 100, month: Math.round(month * 100) / 100, missing };
}
