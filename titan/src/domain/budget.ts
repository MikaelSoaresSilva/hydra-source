// Cardápio econômico: bater proteína e calorias com até R$ 500 por mês, calculado pelo
// PREÇO MAIS CARO encontrado de cada alimento (teto). Preços são referências públicas com data e
// fonte — conferir no seu mercado. O custo real do app continua sendo o dos preços que você registra.
export const BUDGET_LIMIT = 500;
export const DAYS_PER_MONTH = 30;

export interface RefPrice {
  key: BudgetFood;
  name: string;
  /** Preço teto (o mais caro encontrado) por embalagem. */
  price: number;
  /** Tamanho da embalagem em g/ml (ovos: unidades). */
  pkg: number;
  pkgLabel: string;
  where: string;
  url: string;
}

export type BudgetFood = 'arroz' | 'feijao' | 'frango' | 'ovo' | 'leite' | 'banana' | 'oleo' | 'aveia';

export const REF_PRICES: Record<BudgetFood, RefPrice> = {
  arroz: { key: 'arroz', name: 'Arroz tipo 1', price: 16.99, pkg: 5000, pkgLabel: 'pacote 5 kg', where: 'Maior preço da pesquisa da cesta básica, Anápolis (GO), mar/2026', url: 'https://www.anapolis.go.gov.br/wp-content/uploads/2026/03/plan-e-rel-cesta-basica-26..pdf' },
  feijao: { key: 'feijao', name: 'Feijão carioca', price: 7.99, pkg: 1000, pkgLabel: 'pacote 1 kg', where: 'Maior preço da pesquisa da cesta básica, Anápolis (GO), mar/2026', url: 'https://www.anapolis.go.gov.br/wp-content/uploads/2026/03/plan-e-rel-cesta-basica-26..pdf' },
  frango: { key: 'frango', name: 'Peito de frango sem osso', price: 24.99, pkg: 1000, pkgLabel: 'kg', where: 'Maior preço encontrado em supermercado online, 2026', url: 'https://supermercadobomdemais.com.br/produto/sobre-coxa-de-frango-kg/' },
  ovo: { key: 'ovo', name: 'Ovos', price: 29.42, pkg: 30, pkgLabel: 'bandeja 30', where: 'Preço médio de supermercado em Belém (PA), mai/2026 — o mais alto entre as médias encontradas', url: 'https://diariodopara.com.br/seu-bolso/preco-dos-ovos-cai-em-junho-mas-sobe-ate-2034-no-semestre-em-belem-confira/' },
  leite: { key: 'leite', name: 'Leite integral', price: 5.99, pkg: 1000, pkgLabel: 'caixa 1 L', where: 'Maior preço da pesquisa da cesta básica, Anápolis (GO), mar/2026', url: 'https://www.anapolis.go.gov.br/wp-content/uploads/2026/03/plan-e-rel-cesta-basica-26..pdf' },
  banana: { key: 'banana', name: 'Banana prata', price: 8.79, pkg: 1000, pkgLabel: 'kg', where: 'Maior preço da pesquisa da cesta básica, Anápolis (GO), fev/2026', url: 'https://www.anapolis.go.gov.br/wp-content/uploads/2026/03/plan-e-rel-cesta-basica-26..pdf' },
  oleo: { key: 'oleo', name: 'Óleo de soja', price: 6.89, pkg: 828, pkgLabel: 'garrafa 900 ml (~828 g)', where: 'Pesquisa de preços da Prefeitura de Curitiba (PR), jan/2026', url: 'https://mid.curitiba.pr.gov.br/2026/00462728.pdf' },
  aveia: { key: 'aveia', name: 'Aveia em flocos', price: 17.25, pkg: 500, pkgLabel: 'pacote 500 g', where: 'Maior preço encontrado em loja online, 2026', url: 'https://lista.mercadolivre.com.br/aveia-flocos-finos-com-500-gramas' },
};

/** Macros por 100 g do alimento PRONTO (TACO) e fator cru/pronto para a compra. */
const MACROS: Record<BudgetFood, { kcal: number; p: number; c: number; f: number; raw: number; label: string }> = {
  arroz: { kcal: 128, p: 2.5, c: 28.1, f: 0.2, raw: 0.36, label: 'Arroz branco cozido' },
  feijao: { kcal: 76, p: 4.8, c: 13.6, f: 0.5, raw: 0.42, label: 'Feijão carioca cozido' },
  frango: { kcal: 159, p: 32, c: 0, f: 2.5, raw: 1.33, label: 'Peito de frango grelhado' },
  ovo: { kcal: 146, p: 13.3, c: 0.6, f: 9.5, raw: 1, label: 'Ovo cozido/mexido' },
  leite: { kcal: 60, p: 3, c: 4.5, f: 3, raw: 1, label: 'Leite integral' },
  banana: { kcal: 98, p: 1.3, c: 26, f: 0.1, raw: 1.5, label: 'Banana prata (sem casca)' },
  oleo: { kcal: 884, p: 0, c: 0, f: 100, raw: 1, label: 'Óleo de soja' },
  aveia: { kcal: 394, p: 13.9, c: 66.6, f: 8.5, raw: 1, label: 'Aveia em flocos' },
};

export interface BudgetItem { key: BudgetFood; label: string; gramsDay: number; unitsDay?: number; buyMonth: string; costMonth: number }
export interface BudgetMeal { name: string; text: string; items: [BudgetFood, number][] }
/** Alimento equivalente na tabela do app (para o botão "Comi isso"); óleo entra no preparo. */
export const BUDGET_FOOD_KEY: Partial<Record<BudgetFood, string>> = {
  arroz: 'arroz_branco_cozido', feijao: 'feijao_carioca_cozido', frango: 'frango_peito_grelhado', ovo: 'ovo_cozido', leite: 'leite_integral', banana: 'banana_prata', aveia: 'aveia_flocos',
};
export interface BudgetPlan {
  items: BudgetItem[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  costMonth: number;
  reserve: number;
  meals: BudgetMeal[];
  fits: boolean;
  proteinTarget: number;
  /** Proteína usada no cálculo (menor que a meta só se a meta não coubesse no teto). */
  proteinUsed: number;
}

const r5 = (g: number) => Math.max(0, Math.round(g / 5) * 5);

function costOf(key: BudgetFood, gramsDay: number): number {
  const ref = REF_PRICES[key];
  const m = MACROS[key];
  const qty = key === 'ovo' ? gramsDay / 50 : gramsDay * m.raw; // ovos em unidades; resto em g/ml de compra
  return (qty * DAYS_PER_MONTH / ref.pkg) * ref.price;
}

function buyLabel(key: BudgetFood, gramsDay: number): string {
  const ref = REF_PRICES[key];
  const qty = (key === 'ovo' ? gramsDay / 50 : gramsDay * MACROS[key].raw) * DAYS_PER_MONTH;
  const packs = Math.ceil((qty / ref.pkg) * 10) / 10;
  if (key === 'ovo') return `${Math.ceil(qty)} ovos (~${packs.toLocaleString('pt-BR')} bandejas de 30)`;
  if (ref.pkg === 1000 && ref.pkgLabel === 'kg') return `${(Math.ceil(qty / 100) / 10).toLocaleString('pt-BR')} kg`;
  return `${Math.ceil(qty / ref.pkg)} × ${ref.pkgLabel}`;
}

/**
 * Monta o dia econômico para a meta: base fixa barata (3 ovos, 200 ml de leite, 1 banana, 30 g de óleo,
 * 500 g de feijão cozido — a proteína mais barata por grama), frango para completar a proteína e arroz para completar as calorias.
 * Proteína mínima = a meta, limitada a 2,0 g/kg (acima disso não há ganho comprovado e só encarece).
 */
export function budgetPlan(kcal: number, proteinG: number): BudgetPlan {
  // Se a meta de proteína estourar o teto, desce de 5 em 5 g até 90% da meta (2,0 g/kg → 1,8 g/kg, ainda na faixa do protocolo).
  let p = proteinG;
  let plan = solveBudget(kcal, p);
  while (!plan.fits && p - 5 >= proteinG * 0.9) { p -= 5; plan = solveBudget(kcal, p); }
  return { ...plan, proteinTarget: proteinG, proteinUsed: p };
}

function solveBudget(kcal: number, proteinG: number): Omit<BudgetPlan, 'proteinTarget' | 'proteinUsed'> {
  const base: Partial<Record<BudgetFood, number>> = { ovo: 150, leite: 200, banana: 100, oleo: 30, feijao: 500 };
  const sum = (g: Partial<Record<BudgetFood, number>>, f: 'kcal' | 'p' | 'c' | 'f') =>
    (Object.entries(g) as [BudgetFood, number][]).reduce((a, [k, v]) => a + (MACROS[k][f] * v) / 100, 0);
  // Resolve frango (C) e arroz (A): proteína e calorias restantes.
  const restP = proteinG - sum(base, 'p');
  const restK = kcal - sum(base, 'kcal');
  const a = MACROS.arroz; const c = MACROS.frango;
  const det = (a.p / 100) * (c.kcal / 100) - (c.p / 100) * (a.kcal / 100);
  let A = (restP * (c.kcal / 100) - (c.p / 100) * restK) / det;
  let C = ((a.p / 100) * restK - (a.kcal / 100) * restP) / det;
  if (C < 0) { C = 0; A = restK / (a.kcal / 100); }
  if (A < 0) { A = 0; C = restP / (c.p / 100); }
  const grams: Record<BudgetFood, number> = { ...{ arroz: 0, feijao: 0, frango: 0, ovo: 0, leite: 0, banana: 0, oleo: 0, aveia: 0 }, ...base, arroz: r5(A), frango: r5(C) } as Record<BudgetFood, number>;
  const items: BudgetItem[] = (Object.keys(grams) as BudgetFood[]).filter((k) => grams[k] > 0).map((k) => ({
    key: k, label: MACROS[k].label, gramsDay: grams[k], unitsDay: k === 'ovo' ? grams[k] / 50 : undefined,
    buyMonth: buyLabel(k, grams[k]), costMonth: Math.round(costOf(k, grams[k]) * 100) / 100,
  }));
  const costMonth = Math.round(items.reduce((s, i) => s + i.costMonth, 0) * 100) / 100;
  const totals = {
    kcal: Math.round(sum(grams, 'kcal')), protein: Math.round(sum(grams, 'p')), carbs: Math.round(sum(grams, 'c')), fat: Math.round(sum(grams, 'f')),
  };
  const third = r5(grams.arroz / 3);
  const fe = r5(grams.feijao / 2); const fr = r5(grams.frango / 2);
  const meals: BudgetMeal[] = [
    { name: 'Café da manhã', items: [['ovo', 100], ['leite', 200], ['banana', grams.banana]], text: '2 ovos mexidos (com um fio do óleo) + 200 ml de leite + 1 banana' },
    { name: 'Almoço', items: [['arroz', third], ['feijao', fe], ['frango', fr]], text: `${third} g de arroz + ${fe} g de feijão + ${fr} g de frango` },
    { name: 'Lanche (antes ou depois do treino)', items: [['arroz', grams.arroz - 2 * third], ['ovo', 50]], text: `${grams.arroz - 2 * third} g de arroz (ou o equivalente em cuscuz/macarrão) + 1 ovo cozido` },
    { name: 'Jantar', items: [['arroz', third], ['feijao', grams.feijao - fe], ['frango', grams.frango - fr]], text: `${third} g de arroz + ${grams.feijao - fe} g de feijão + ${grams.frango - fr} g de frango` },
  ];
  return { items, totals, costMonth, reserve: Math.round((BUDGET_LIMIT - costMonth) * 100) / 100, meals, fits: costMonth <= BUDGET_LIMIT };
}

export const BUDGET_RULES = [
  'Os valores usam o preço MAIS CARO que encontrei de cada alimento em pesquisas de 2026. No seu mercado deve sair igual ou mais barato — e o que sobra cobre tempero, cebola, alho, tomate e sal.',
  'Compre o frango em bandeja grande ou congelado e o arroz e o feijão em pacotes grandes: é onde mais se economiza.',
  'Cozinhe 2× por semana (domingo e quarta) e separe em marmitas: é o que garante comer tudo e não gastar com lanche.',
  'Trocas que costumam baratear sem perder proteína: peito por coxa/sobrecoxa sem pele (conte ~1,9 kg cru para 1 kg pronto, por causa do osso), arroz por macarrão, banana por fruta da estação.',
  'Whey, pasta de amendoim e azeite ficam fora do orçamento: não são necessários para bater a meta. Creatina continua opcional (veja Suplementos).',
  'Registre em Compras os preços que você paga: o custo real do mês passa a usar os seus preços.',
];
