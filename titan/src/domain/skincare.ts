import { addDays, daysBetween } from './dates';
import type { CareLogRow, ProductRow } from './types';

export type Active =
  | 'retinoid' | 'aha' | 'bha' | 'bpo' | 'vitamin_c' | 'niacinamide' | 'azelaic'
  | 'zinc' | 'tranexamic' | 'arbutin' | 'sunscreen' | 'unknown';

export const ACTIVE_LABEL: Record<Active, string> = {
  retinoid: 'Retinoide (retinol/retinal/adapaleno/tretinoína)',
  aha: 'Alfa-hidroxiácido (glicólico, lático, mandélico)',
  bha: 'Ácido salicílico (BHA)',
  bpo: 'Peróxido de benzoíla',
  vitamin_c: 'Vitamina C (ácido ascórbico e derivados)',
  niacinamide: 'Niacinamida',
  azelaic: 'Ácido azelaico',
  zinc: 'Zinco (PCA/sulfato)',
  tranexamic: 'Ácido tranexâmico',
  arbutin: 'Alfa-arbutin',
  sunscreen: 'Filtro solar',
  unknown: 'Composição desconhecida',
};

const PATTERNS: [Active, RegExp][] = [
  ['retinoid', /\b(retinol|retinal|retinaldehyde|retinyl|adapalen|tretino|hydroxypinacolone retinoate)/i],
  ['aha', /\b(glycolic|glic[oó]lico|lactic acid|[aá]cido l[aá]tico|mandelic|mand[eé]lico)/i],
  ['bha', /\b(salicylic|salic[ií]lico|betaine salicylate)/i],
  ['bpo', /\b(benzoyl peroxide|per[oó]xido de benzo[ií]la)/i],
  ['vitamin_c', /\b(ascorbic|asc[oó]rbico|ascorbyl|ascorbil|vitamina c)/i],
  ['niacinamide', /\b(niacinamid)/i],
  ['azelaic', /\b(azelaic|azelaico)/i],
  ['zinc', /\b(zinc pca|zinco|zinc sulfate|zinc gluconate)/i],
  ['tranexamic', /\b(tranexamic|tranex[aâ]mico)/i],
  ['arbutin', /\b(arbutin)/i],
  ['sunscreen', /\b(fps|spf|avobenzone|octocrylene|bemotrizinol|tinosorb|uvinul|zinc oxide|titanium dioxide|ethylhexyl methoxycinnamate)/i],
];

/** Detecta ativos em uma lista de ingredientes. Sem ingredientes → 'unknown'. */
export function detectActives(ingredients: string | null | undefined): Active[] {
  if (!ingredients || ingredients.trim().length < 3) return ['unknown'];
  const found = PATTERNS.filter(([, re]) => re.test(ingredients)).map(([a]) => a);
  return found;
}

export interface Conflict { a: Active; b: Active; level: 'avoid' | 'caution'; why: string }

const RULES: Conflict[] = [
  { a: 'retinoid', b: 'aha', level: 'avoid', why: 'Retinoide + ácido esfoliante na mesma aplicação aumenta muito o risco de irritação. Use em noites alternadas.' },
  { a: 'retinoid', b: 'bha', level: 'avoid', why: 'Retinoide + ácido salicílico na mesma aplicação tende a irritar. Alterne as noites.' },
  { a: 'retinoid', b: 'bpo', level: 'avoid', why: 'Peróxido de benzoíla pode degradar alguns retinoides e somar irritação. Separe manhã/noite ou dias.' },
  { a: 'aha', b: 'bha', level: 'caution', why: 'Dois esfoliantes químicos juntos podem sensibilizar; comece em dias diferentes.' },
  { a: 'aha', b: 'aha', level: 'caution', why: 'Mais de um AHA na mesma rotina soma esfoliação.' },
  { a: 'vitamin_c', b: 'bpo', level: 'caution', why: 'Peróxido de benzoíla é oxidante e pode reduzir a eficácia da vitamina C.' },
  { a: 'vitamin_c', b: 'aha', level: 'caution', why: 'Ácidos juntos podem irritar pele sensível; prefira vitamina C de manhã e ácidos à noite.' },
  { a: 'bpo', b: 'aha', level: 'caution', why: 'Ressecamento e irritação somados.' },
  { a: 'bpo', b: 'bha', level: 'caution', why: 'Ressecamento e irritação somados; avalie tolerância.' },
];

const STRONG: Active[] = ['retinoid', 'aha', 'bha', 'bpo', 'vitamin_c', 'azelaic'];

/** Verifica conflitos entre produtos de um mesmo momento (manhã ou noite). */
export function checkSlot(products: Pick<ProductRow, 'name' | 'actives'>[]): { pair: [string, string]; conflict: Conflict }[] {
  const out: { pair: [string, string]; conflict: Conflict }[] = [];
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const A = products[i].actives as Active[];
      const B = products[j].actives as Active[];
      // Composição desconhecida nunca é combinada com outro ativo forte.
      if ((A.includes('unknown') && B.some((b) => STRONG.includes(b))) || (B.includes('unknown') && A.some((a) => STRONG.includes(a))) || (A.includes('unknown') && B.includes('unknown'))) {
        out.push({ pair: [products[i].name, products[j].name], conflict: { a: 'unknown', b: 'unknown', level: 'avoid',
          why: 'Pelo menos um produto tem composição desconhecida. Cadastre o rótulo antes de combinar.' } });
        continue;
      }
      for (const r of RULES) {
        if ((A.includes(r.a) && B.includes(r.b)) || (A.includes(r.b) && B.includes(r.a))) {
          out.push({ pair: [products[i].name, products[j].name], conflict: r });
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Introdução gradual de um ativo: semanas 1–2 → 2×/semana; 3–4 → 3×/semana (dias alternados);
 * a partir da semana 5 → uso pleno conforme tolerância.
 */
export function introductionDays(startedOn: string, todayIso: string): { phase: string; days: number[] } {
  const w = Math.floor(daysBetween(startedOn, todayIso) / 7) + 1;
  if (w <= 2) return { phase: `Semana ${w} de introdução: 2×/semana`, days: [1, 4] };
  if (w <= 4) return { phase: `Semana ${w} de introdução: 3×/semana`, days: [1, 3, 5] };
  return { phase: 'Introdução concluída: uso conforme tolerância', days: [0, 1, 2, 3, 4, 5, 6] };
}

/** Só um ativo novo por vez: retorna produto em introdução há menos de 14 dias, se houver. */
export function activeIntroduction(products: ProductRow[], todayIso: string): ProductRow | undefined {
  return products.find((p) => p.status === 'introducing' && p.started_on && daysBetween(p.started_on, todayIso) < 14);
}

export interface ReactionDecision { productId: string; newStatus: ProductRow['status'] | null; message: string }

/**
 * Reação moderada/grave → suspende o produto (sai das recomendações automáticas).
 * Duas reações leves em 7 dias → pausa e revisão.
 */
export function evaluateReactions(product: ProductRow, logs: CareLogRow[], todayIso: string): ReactionDecision {
  const recent = logs.filter((l) => l.product_id === product.id && l.date >= addDays(todayIso, -7) && l.reaction !== 'none');
  if (recent.some((l) => l.reaction === 'moderate' || l.reaction === 'severe')) {
    return { productId: product.id, newStatus: 'suspended',
      message: `${product.name} foi suspenso por reação moderada/grave. Suspenda o uso, mantenha só limpeza suave, hidratante e protetor. Se houver inchaço, bolhas, dor ou piora que não cede em poucos dias, procure um dermatologista.` };
  }
  if (recent.filter((l) => l.reaction === 'mild').length >= 2) {
    return { productId: product.id, newStatus: 'paused',
      message: `${product.name}: duas reações leves em 7 dias. Pausado; retome com frequência menor depois que a pele acalmar.` };
  }
  return { productId: product.id, newStatus: null, message: '' };
}

export const STOP_SIGNS = [
  'Ardência que dura mais de alguns minutos após aplicar',
  'Vermelhidão persistente, descamação intensa ou fissuras',
  'Inchaço, bolhas, coceira intensa ou urticária (pare e procure atendimento)',
  'Piora progressiva da acne após 6–8 semanas de uso correto',
];

export const DERM_REFERRAL = 'Procure um dermatologista em caso de acne inflamatória persistente ou dolorosa, cicatrizes, manchas que não melhoram em ~3 meses, irritação importante ou qualquer lesão que mude de aspecto. O app não diagnostica doenças por fotos.';

export interface BaseStep { slot: 'am' | 'pm'; order: number; step: string; category: string; amount: string; days: number[]; notes?: string }

/** Rotina base para pele oleosa com tendência à acne — simples e sustentável. */
export function baseSkinRoutine(): BaseStep[] {
  const all = [0, 1, 2, 3, 4, 5, 6];
  return [
    { slot: 'am', order: 1, step: 'Limpeza com gel/sabonete facial suave', category: 'cleanser', amount: '1 aplicação, ~30 s de massagem', days: all },
    { slot: 'am', order: 2, step: 'Niacinamida (opcional, se já tolerada)', category: 'treatment', amount: '2–3 gotas', days: all, notes: 'Ajuda em oleosidade e marcas; boa tolerância na maioria das pessoas.' },
    { slot: 'am', order: 3, step: 'Hidratante leve oil-free', category: 'moisturizer', amount: 'Tamanho de uma ervilha', days: all },
    { slot: 'am', order: 4, step: 'Protetor solar FPS 30+ (toque seco)', category: 'sunscreen', amount: '1 colher de chá (≈ 2 dedos, indicador e médio) para rosto e pescoço', days: all, notes: 'Reaplicar a cada ~2 h de exposição e após suor intenso.' },
    { slot: 'pm', order: 1, step: 'Limpeza com gel/sabonete facial suave', category: 'cleanser', amount: '1 aplicação', days: all },
    { slot: 'pm', order: 2, step: 'Ativo para acne (um por vez, com introdução gradual)', category: 'treatment', amount: 'Camada fina / tamanho de ervilha', days: [1, 4],
      notes: 'Ex.: ácido salicílico, ácido azelaico ou retinoide. Comece 2×/semana. Retinoides de prescrição exigem orientação médica.' },
    { slot: 'pm', order: 3, step: 'Hidratante leve', category: 'moisturizer', amount: 'Tamanho de uma ervilha', days: all },
  ];
}
