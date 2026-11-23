export type FoodRole = 'protein' | 'carb' | 'fat' | 'fruit' | 'veg' | 'dairy' | 'legume';

export interface Food {
  key: string;
  name: string;
  role: FoodRole;
  kcal: number; // por 100 g (como consumido)
  protein: number;
  carbs: number;
  fat: number;
  /** gramas cruas/secas necessárias para 1 g pronto (aproximação para a lista de compras) */
  rawFactor: number;
  unitName?: string;
  unitGrams?: number;
  maxGrams: number;
  source: string;
}

const TACO = 'TACO 4ª ed. (NEPA/Unicamp) — aproximado';
const USDA = 'USDA FoodData Central — aproximado';
const LABEL = 'Média de rótulos — confira o rótulo do seu produto';

const F = (key: string, name: string, role: FoodRole, kcal: number, protein: number, carbs: number, fat: number,
  rawFactor: number, maxGrams: number, source: string, unitName?: string, unitGrams?: number): Food =>
  ({ key, name, role, kcal, protein, carbs, fat, rawFactor, maxGrams, source, unitName, unitGrams });

// Valores de referência por 100 g. Marcas e preparos variam: o app sempre permite
// cadastrar alimentos próprios com os dados do rótulo.
export const FOODS: Food[] = [
  F('arroz_branco_cozido', 'Arroz branco cozido', 'carb', 128, 2.5, 28.1, 0.2, 0.36, 500, TACO),
  F('arroz_integral_cozido', 'Arroz integral cozido', 'carb', 124, 2.6, 25.8, 1.0, 0.4, 500, TACO),
  F('macarrao_cozido', 'Macarrão cozido', 'carb', 158, 5.8, 30.9, 0.9, 0.43, 500, USDA),
  F('pao_frances', 'Pão francês', 'carb', 300, 8.0, 58.6, 3.1, 1, 250, TACO, 'unidade', 50),
  F('aveia_flocos', 'Aveia em flocos', 'carb', 394, 13.9, 66.6, 8.5, 1, 150, TACO),
  F('cuscuz_milho', 'Cuscuz de milho cozido', 'carb', 113, 2.2, 25.3, 0.7, 0.4, 400, TACO),
  F('batata_inglesa_cozida', 'Batata inglesa cozida', 'carb', 52, 1.2, 11.9, 0.0, 1.05, 800, TACO),
  F('batata_doce_cozida', 'Batata-doce cozida', 'carb', 77, 0.6, 18.4, 0.1, 1.05, 700, TACO),
  F('mandioca_cozida', 'Mandioca cozida', 'carb', 125, 0.6, 30.1, 0.3, 1.1, 500, TACO),
  F('feijao_carioca_cozido', 'Feijão carioca cozido', 'legume', 76, 4.8, 13.6, 0.5, 0.42, 400, TACO),
  F('frango_peito_grelhado', 'Peito de frango grelhado', 'protein', 159, 32.0, 0, 2.5, 1.33, 400, TACO),
  F('patinho_grelhado', 'Carne bovina (patinho) grelhada', 'protein', 219, 35.9, 0, 7.3, 1.35, 400, TACO),
  F('ovo_cozido', 'Ovo de galinha cozido', 'protein', 146, 13.3, 0.6, 9.5, 1, 300, TACO, 'ovo', 50),
  F('atum_lata_agua', 'Atum em lata (em água, drenado)', 'protein', 116, 25.5, 0, 0.8, 1, 300, USDA),
  F('sardinha_lata_oleo', 'Sardinha em lata (em óleo)', 'protein', 285, 15.9, 0, 24.0, 1, 250, TACO),
  F('whey_concentrado', 'Whey protein concentrado', 'protein', 400, 75, 10, 6, 1, 60, LABEL, 'scoop', 30),
  F('iogurte_natural', 'Iogurte natural integral', 'dairy', 51, 4.1, 1.9, 3.0, 1, 400, TACO),
  F('leite_integral', 'Leite integral', 'dairy', 60, 3.0, 4.5, 3.0, 1, 600, LABEL),
  F('queijo_mussarela', 'Queijo muçarela', 'dairy', 330, 22.6, 3.0, 25.2, 1, 80, TACO),
  F('banana_prata', 'Banana prata', 'fruit', 98, 1.3, 26.0, 0.1, 1.5, 300, TACO, 'unidade média', 70),
  F('maca', 'Maçã', 'fruit', 56, 0.3, 15.2, 0.0, 1.1, 300, TACO, 'unidade', 130),
  F('mamao_papaya', 'Mamão papaya', 'fruit', 40, 0.5, 10.4, 0.1, 1.4, 400, TACO),
  F('brocolis_cozido', 'Brócolis cozido', 'veg', 25, 2.1, 4.4, 0.5, 1.2, 300, TACO),
  F('azeite_oliva', 'Azeite de oliva', 'fat', 884, 0, 0, 100, 1, 40, TACO),
  F('pasta_amendoim', 'Pasta de amendoim integral', 'fat', 588, 25, 20, 50, 1, 60, LABEL),
];

export const FOOD_BY_KEY: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.key, f]));

export interface Macros { kcal: number; protein: number; carbs: number; fat: number }

export function macrosFor(food: Pick<Food, 'kcal' | 'protein' | 'carbs' | 'fat'>, grams: number): Macros {
  const k = grams / 100;
  return { kcal: food.kcal * k, protein: food.protein * k, carbs: food.carbs * k, fat: food.fat * k };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

const dominant: Record<FoodRole, keyof Omit<Macros, 'kcal'> | 'kcal'> = {
  protein: 'protein', carb: 'carbs', legume: 'carbs', fruit: 'carbs', fat: 'fat', dairy: 'protein', veg: 'kcal',
};

/** Quantidade equivalente de outro alimento, igualando o macronutriente dominante do original. */
export function equivalentGrams(from: Food, grams: number, to: Food): { grams: number; kcalDiff: number } {
  const key = dominant[from.role];
  const target = macrosFor(from, grams)[key];
  const per100 = key === 'kcal' ? to.kcal : to[key];
  const g = per100 > 0 ? Math.round((target / per100) * 100 / 5) * 5 : grams;
  return { grams: g, kcalDiff: Math.round(macrosFor(to, g).kcal - macrosFor(from, grams).kcal) };
}

/** Alternativas da mesma função nutricional. */
export function alternativesForFood(key: string, extra: Food[] = []): Food[] {
  const f = FOOD_BY_KEY[key] ?? extra.find((x) => x.key === key);
  if (!f) return [];
  return [...FOODS, ...extra].filter((x) => x.key !== key && (x.role === f.role || (f.role === 'protein' && x.role === 'dairy')));
}
