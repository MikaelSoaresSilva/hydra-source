// Produtos de rosto: os mais baratos de marcas conhecidas de farmácia que cumprem cada etapa da rotina.
// Regras: preço e link só de fonte pública consultada (com data); onde não há preço pesquisado, o app
// diz o que procurar. Não é diagnóstico nem prescrição: é escolha por função e por ingrediente.
import type { SkinProfile } from './types';

export const FACE_BUDGET = 300;
export const PRICES_CHECKED_ON = '2026-11-16';

export type SkinKit = 'oily' | 'gentle';
export type Step = 'cleanser' | 'moisturizer' | 'sunscreen' | 'treatment';
export const STEP_LABEL: Record<Step, string> = { cleanser: 'Limpeza', moisturizer: 'Hidratante', sunscreen: 'Protetor solar', treatment: 'Tratamento (opcional)' };

export interface CareProduct {
  id: string;
  step: Step;
  kits: SkinKit[];
  brand: string;
  name: string;
  size: string;
  /** Por que serve para esse tipo de pele (função / ingrediente). */
  why: string;
  how: string;
  /** Faixa de preço encontrada (menor–maior) e onde; null = não pesquisado. */
  price: { min: number; max: number; where: string } | null;
  /** Páginas reais consultadas (loja ou comparador). */
  links: { label: string; url: string }[];
  /** O que digitar na busca ou pedir no balcão da farmácia. */
  search: string;
  /** Quanto tempo dura, em meses (estimativa de uso diário no rosto). */
  lastsMonths: number;
  essential: boolean;
  caution?: string;
}

export const CARE_PRODUCTS: CareProduct[] = [
  {
    id: 'actine_bar', step: 'cleanser', kits: ['oily'], brand: 'Darrow', name: 'Actine Sabonete em Barra (pele acneica)', size: '70 g',
    why: 'Sabonete dermatológico indicado pelo fabricante para pele oleosa e acneica. Em barra custa bem menos que a versão líquida e dura mais. Confira os ativos no rótulo.',
    how: 'Manhã e noite, 30 segundos de espuma, enxágue com água fria ou morna. Não esfregue.',
    price: { min: 28.8, max: 44.99, where: 'Comparador CliqueFarma (R$ 28,80–42,99), Drogaria São Paulo (R$ 33,99), Extrafarma (R$ 34,99), Preço Popular (R$ 44,99)' },
    links: [
      { label: 'Drogaria São Paulo', url: 'https://www.drogariasaopaulo.com.br/sabonete-em-barra-facial-darrow-pele-acneica-70g/p' },
      { label: 'Comparar preços (CliqueFarma)', url: 'https://www.cliquefarma.com.br/dermocosmeticos/rosto-e-olhos/acne/sabonete-em-barra-actine-pele-acneica-com-70g' },
    ],
    search: 'Actine sabonete barra 70g', lastsMonths: 2, essential: true,
    caution: 'Se a pele repuxar ou descamar, use só à noite.',
  },
  {
    id: 'facecare_matte', step: 'moisturizer', kits: ['oily'], brand: 'Neutrogena', name: 'Face Care Intensive Hidratante Matte 3 em 1', size: '100 g',
    why: 'Hidratante leve de toque seco (matte), vendido para pele oleosa: hidrata sem aumentar o brilho. É o hidratante facial mais barato por grama entre os que pesquisei.',
    how: 'Uma camada fina depois de lavar o rosto, manhã e noite.',
    price: { min: 29.9, max: 40.79, where: 'Preço Popular (R$ 29,90), Buscapé (R$ 31,90), Drogarias Pacheco (R$ 32,50), Drogaria São Paulo (R$ 37,43), Drogasil (R$ 38,59), Droga Raia (R$ 38,49–40,79)' },
    links: [
      { label: 'Drogarias Pacheco', url: 'https://www.drogariaspacheco.com.br/creme-neutrogena-hidratante-face-care-intensive-matte-3-em-1-100g/p' },
      { label: 'Comparar preços (Buscapé)', url: 'https://www.buscape.com.br/hidratante/neutrogena-face-care-intensive-matte-3-em-1-hidratante-facial-100g' },
    ],
    search: 'Neutrogena Face Care Intensive Matte 3 em 1 100g', lastsMonths: 3, essential: true,
  },
  {
    id: 'nivea_sun_oily', step: 'sunscreen', kits: ['oily'], brand: 'Nivea Sun', name: 'Beauty Expert Facial Pele Oleosa FPS 50', size: '50 g',
    why: 'Protetor facial de toque seco para pele oleosa, o mais barato que encontrei com FPS 50. Protetor diário é o passo que mais protege de manchas de acne.',
    how: 'Toda manhã, por último: dois dedos de produto para rosto e pescoço. Reaplique se ficar no sol.',
    price: { min: 39.05, max: 49.99, where: 'Comparador CliqueFarma (R$ 39,05–49,99) e Buscapé (R$ 39,49). Há versões FPS 60 mais caras: confira o rótulo.' },
    links: [
      { label: 'Comparar preços (Buscapé)', url: 'https://www.buscape.com.br/protetor-solar/protetor-solar-nivea-sun-beauty-expert-facial-pele-oleosa-fps50-50g' },
      { label: 'Comparar preços (CliqueFarma)', url: 'https://www.cliquefarma.com.br/beleza/pele/protecao-solar-e-bronzeador/protetor-solar-nivea-sun-beauty-pele-oleosa-fps50-50g' },
    ],
    search: 'Nivea Sun Beauty Expert facial pele oleosa FPS 50 50g', lastsMonths: 1, essential: true,
  },
  {
    id: 'sunfresh70', step: 'sunscreen', kits: ['oily', 'gentle'], brand: 'Neutrogena', name: 'Sun Fresh Facial FPS 70 (sem cor)', size: '40 g',
    why: 'Alternativa de protetor leve com FPS mais alto, fácil de achar em qualquer farmácia.',
    how: 'Toda manhã, por último: dois dedos de produto para rosto e pescoço.',
    price: { min: 48.74, max: 67.99, where: 'Pague Menos via CliqueFarma (R$ 48,74), Drogaria São Paulo (R$ 49,91; cheio R$ 67,99), Drogasil (R$ 59,99)' },
    links: [
      { label: 'Drogaria São Paulo', url: 'https://www.drogariasaopaulo.com.br/protetor-solar-facial-neutrogena-sun-fresh-fps70-40g/p' },
      { label: 'Comparar preços (CliqueFarma)', url: 'https://www.cliquefarma.com.br/dermocosmeticos/protecao-solar-dermo/facial/protetor-solar-facial-neutrogena-sun-fresh-fps70-40g' },
    ],
    search: 'Neutrogena Sun Fresh facial FPS 70 40g sem cor', lastsMonths: 1, essential: true,
    caution: 'Existem versões com cor (mais caras): escolha "sem cor" se não quiser base.',
  },
  {
    id: 'principia_nc10', step: 'treatment', kits: ['oily'], brand: 'Principia', name: 'NC-10 Sérum 10% Niacinamida + Zinco PCA', size: '30 ml',
    why: 'Niacinamida ajuda a controlar oleosidade e a clarear marcas de espinha; é um dos ativos com boa evidência e é dos séruns mais baratos da categoria.',
    how: 'Só depois de 2–3 semanas com a rotina básica estável: 3 gotas à noite, antes do hidratante. Comece em dias alternados.',
    price: { min: 51.62, max: 61.9, where: 'Drogal (R$ 58,99; R$ 51,62 levando 2), Extrafarma (R$ 58,99), Drogaria São Paulo e Droga Raia (R$ 59,00), Preço Popular (R$ 61,90)' },
    links: [
      { label: 'Drogal', url: 'https://www.drogal.com.br/serum-facial-principia-nc-10-niacinamida--zinco-pca-30ml/p' },
      { label: 'Drogaria São Paulo', url: 'https://www.drogariasaopaulo.com.br/serum-principia-nc-10-10-niacinamida--zinco-pca-30ml-/p' },
    ],
    search: 'Principia NC-10 niacinamida 30ml', lastsMonths: 3, essential: false,
    caution: 'Um ativo novo por vez. Se você já usa outro ácido (glicólico, salicílico em sérum), não some os dois na mesma noite.',
  },
  {
    id: 'cerave_cleanser', step: 'cleanser', kits: ['gentle'], brand: 'CeraVe', name: 'Loção de Limpeza Hidratante (pele normal a seca)', size: '200 ml',
    why: 'Limpa sem espuma agressiva e sem perfume, com ceramidas: não resseca nem arde em pele seca ou sensível.',
    how: 'Manhã e noite; em pele muito seca, de manhã pode ser só água.',
    price: { min: 80.91, max: 86.99, where: 'Drogasil (R$ 80,91), Drogarias Pacheco (R$ 86,99)' },
    links: [{ label: 'Drogasil', url: 'https://www.drogasil.com.br/locao-de-limpeza-hidratante-pele-normal-e-seca-200ml-cerave-910295.html' }],
    search: 'CeraVe loção de limpeza hidratante 200ml', lastsMonths: 3, essential: true,
    caution: 'Mais barato, sem preço pesquisado: peça no balcão um "sabonete líquido facial suave, sem perfume, para pele seca/sensível" e compare.',
  },
  {
    id: 'hydroboost', step: 'moisturizer', kits: ['gentle'], brand: 'Neutrogena', name: 'Hydro Boost Water Gel', size: '50 g',
    why: 'Gel com ácido hialurônico: hidrata bem pele normal, seca ou sensível sem pesar. O refil de 50 g costuma ser mais barato que o pote.',
    how: 'Manhã e noite, com o rosto ainda levemente úmido.',
    price: { min: 53.2, max: 89.9, where: 'Refil na Drogarias Pacheco (R$ 53,20), Drogal via CliqueFarma (R$ 59,89), Drogaria São Paulo e Pague Menos (R$ 66,49), Drogasil (R$ 89,90)' },
    links: [
      { label: 'Drogaria São Paulo', url: 'https://www.drogariasaopaulo.com.br/hidratante-facial-neutrogena-hydro-boost-water-gel-50g/p' },
      { label: 'Refil (Drogarias Pacheco)', url: 'https://www.drogariaspacheco.com.br/hidratante-facial-neutrogena-hydro-boost-water-gel-refil-50g/p' },
      { label: 'Comparar preços (CliqueFarma)', url: 'https://www.cliquefarma.com.br/dermocosmeticos/rosto-e-olhos/hidratante-facial/neutrogena-hydro-boost-water-gel' },
    ],
    search: 'Neutrogena Hydro Boost Water Gel 50g refil', lastsMonths: 2, essential: true,
  },
];

export const KIT_LABEL: Record<SkinKit, string> = { oily: 'Pele oleosa ou mista, com tendência a cravos e espinhas', gentle: 'Pele normal, seca ou sensível' };

/** Sem tipo informado, o app usa o mesmo padrão da rotina base (oleosa com tendência à acne). */
export function kitFor(skin: Pick<SkinProfile, 'type'> | undefined | null): SkinKit {
  return skin?.type === 'dry' || skin?.type === 'sensitive' || skin?.type === 'normal' ? 'gentle' : 'oily';
}

export interface KitPlan {
  kit: SkinKit;
  /** Um produto por etapa essencial (o mais barato) + opcionais. */
  essentials: CareProduct[];
  alternatives: CareProduct[];
  optional: CareProduct[];
  totalMin: number;
  totalMax: number;
  /** Custo por mês depois da primeira compra (preço máximo ÷ duração estimada). */
  monthlyMax: number;
  withOptionalMax: number;
  fitsBudget: boolean;
}

export function kitPlan(kit: SkinKit, budget = FACE_BUDGET): KitPlan {
  const list = CARE_PRODUCTS.filter((p) => p.kits.includes(kit));
  const essentials: CareProduct[] = [];
  const alternatives: CareProduct[] = [];
  for (const step of ['cleanser', 'moisturizer', 'sunscreen'] as Step[]) {
    const opts = list.filter((p) => p.step === step && p.essential).sort((a, b) => (a.price?.min ?? 1e9) - (b.price?.min ?? 1e9));
    if (opts[0]) essentials.push(opts[0]);
    alternatives.push(...opts.slice(1));
  }
  const optional = list.filter((p) => !p.essential);
  const sum = (ps: CareProduct[], k: 'min' | 'max') => Math.round(ps.reduce((a, p) => a + (p.price?.[k] ?? 0), 0) * 100) / 100;
  const totalMax = sum(essentials, 'max');
  return {
    kit, essentials, alternatives, optional,
    totalMin: sum(essentials, 'min'), totalMax,
    monthlyMax: Math.round(essentials.reduce((a, p) => a + (p.price ? p.price.max / p.lastsMonths : 0), 0) * 100) / 100,
    withOptionalMax: Math.round((totalMax + sum(optional, 'max')) * 100) / 100,
    fitsBudget: totalMax <= budget,
  };
}

/** Link de busca (Google Shopping) para comparar o preço do dia — é uma busca, não um produto específico. */
export const searchUrl = (q: string) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`;

export const CARE_PRODUCT_NOTES = [
  'Escolhi por função e ingrediente, entre marcas fáceis de achar em farmácia, sempre a opção mais barata que cumpre a etapa. Não existe ranking científico de "mais eficiente" entre marcas: o que tem evidência é a rotina (limpar, hidratar, proteger do sol) e alguns ativos.',
  'Os preços são faixas encontradas em sites de farmácias e comparadores na data indicada; mudam por cidade, CEP e promoção. Confira no link antes de comprar.',
  'Comece só com os 3 essenciais. Tratamento entra depois de 2–3 semanas, um ativo por vez.',
  'As fotos ajudam você a acompanhar a pele, mas o app não diagnostica por imagem. Acne inflamada, dolorosa ou que deixa marca: dermatologista (pelo SUS também).',
];
