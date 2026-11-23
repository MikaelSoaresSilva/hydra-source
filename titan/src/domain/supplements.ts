// Suplementos: o que tem evidência, quanto ajuda de verdade e o que não vale o dinheiro.
// Nenhum suplemento multiplica resultado: os melhores somam poucos pontos percentuais a um treino,
// dieta e sono que já estão em ordem. Doses de referência para adultos saudáveis; confirme com
// nutricionista ou médico, principalmente se tiver doença renal, cardíaca, pressão alta ou usar remédios.

export type Tier = 'A' | 'B' | 'C';
export const TIER_LABEL: Record<Tier, string> = {
  A: 'Funciona (efeito pequeno, mas real)',
  B: 'Talvez ajude (efeito pequeno ou só em casos específicos)',
  C: 'Não vale o dinheiro (ou tem risco)',
};

export interface Supplement {
  id: string;
  tier: Tier;
  name: string;
  /** O que esperar, em números honestos. */
  effect: string;
  dose: (weightKg: number | null) => string;
  when: string;
  cautions: string[];
  evidence: string;
  /** Pode entrar no "meu protocolo" (checklist diário). */
  trackable?: boolean;
}

const kg = (w: number | null, perKgLow: number, perKgHigh: number, unit: string) =>
  (w ? `${Math.round(w * perKgLow)}–${Math.round(w * perKgHigh)} ${unit} (${perKgLow}–${perKgHigh} ${unit}/kg para ${w.toLocaleString('pt-BR')} kg)` : `${perKgLow}–${perKgHigh} ${unit} por kg de peso`);

export const SUPPLEMENTS: Supplement[] = [
  {
    id: 'creatine', tier: 'A', name: 'Creatina monohidratada', trackable: true,
    effect: 'O suplemento com mais evidência para força e massa magra. Em média, 5–10% a mais de força/repetições em esforços intensos e ~1–2 kg a mais de massa magra ao longo de semanas a meses de treino — parte disso é água dentro do músculo.',
    dose: () => '3–5 g por dia, todos os dias (inclusive sem treino). Não precisa de "fase de saturação" nem de ciclos.',
    when: 'Qualquer horário; o que importa é tomar todo dia. Junto de uma refeição facilita lembrar.',
    cautions: [
      'O peso pode subir 0,5–1,5 kg nas primeiras semanas (água no músculo, não gordura): leve isso em conta na média de peso.',
      'Doença renal ou exame de rim alterado: só com orientação médica. A creatinina no exame de sangue pode subir um pouco sem significar lesão — avise o médico que você usa.',
      'Compre a versão simples (monohidratada, sem misturas), de marca com laudo de pureza.',
    ],
    evidence: 'Posição da International Society of Sports Nutrition (Kreider et al., 2017).',
  },
  {
    id: 'protein', tier: 'A', name: 'Proteína em pó (whey, caseína ou vegetal)', trackable: true,
    effect: 'Não tem efeito especial: é comida em pó. Ajuda só se a sua comida não fecha a meta de proteína do dia. Acima de ~1,6 g/kg/dia, mais proteína quase não acrescenta músculo.',
    dose: (w) => `O que faltar para a meta do dia (${kg(w, 1.6, 2.2, 'g')}). Em geral, 1 dose de 25–30 g.`,
    when: 'Em qualquer refeição que esteja fraca em proteína. O horário em volta do treino pesa pouco; o total do dia pesa muito.',
    cautions: ['Compare o preço por grama de proteína com ovo, frango e leite: muitas vezes a comida sai mais barata.', 'Intolerância à lactose: prefira whey isolado ou proteína vegetal.'],
    evidence: 'Meta-análise de Morton et al., 2018 (British Journal of Sports Medicine).',
  },
  {
    id: 'caffeine', tier: 'A', name: 'Cafeína (café ou cápsula)',
    effect: 'Melhora um pouco o desempenho no treino (poucos pontos percentuais em força e resistência) e a disposição. Não constrói músculo por si só.',
    dose: (w) => `${kg(w, 3, 6, 'mg')}. Comece pelo mínimo (ou menos: 100–200 mg, 1–2 cafés).`,
    when: '30–60 min antes do treino.',
    cautions: [
      'Você treina às 16h: cafeína nesse horário pode atrapalhar o sono, e sono vale mais que o pré-treino. Se demorar a dormir, corte ou reduza.',
      'Não passe de ~400 mg por dia somando café, energético e refrigerante. Pressão alta, arritmia ou ansiedade: evite.',
    ],
    evidence: 'Posição da ISSN sobre cafeína (Guest et al., 2021).',
  },
  {
    id: 'beta_alanine', tier: 'B', name: 'Beta-alanina',
    effect: 'Ajuda em esforços contínuos de 1 a 4 minutos. Em musculação comum (séries de 20–40 s), o ganho é pequeno.',
    dose: () => '3,2–6,4 g por dia, divididos em doses de até 1,6 g, por pelo menos 4 semanas.',
    when: 'Qualquer horário, todo dia.',
    cautions: ['Causa formigamento na pele (inofensivo), menor com doses divididas.'],
    evidence: 'Posição da ISSN (Trexler et al., 2015).',
  },
  {
    id: 'citrulline', tier: 'B', name: 'Citrulina malato',
    effect: 'Alguns estudos mostram 1–2 repetições a mais em séries longas; outros não mostram nada. Resultado inconsistente.',
    dose: () => '6–8 g cerca de 1 hora antes do treino.',
    when: 'Antes do treino.',
    cautions: ['Pode dar desconforto no estômago.'],
    evidence: 'Estudos pequenos com resultados mistos.',
  },
  {
    id: 'vitamin_d', tier: 'B', name: 'Vitamina D, ômega-3 e multivitamínico',
    effect: 'Não aumentam músculo em quem não tem deficiência. Corrigem falta — o que só um exame de sangue ou uma dieta muito restrita indicam.',
    dose: () => 'Só com exame e orientação profissional.',
    when: '—',
    cautions: ['Vitamina D em excesso faz mal: não tome dose alta por conta própria.'],
    evidence: 'Revisões sobre suplementação em pessoas sem deficiência.',
  },
  {
    id: 'bcaa', tier: 'C', name: 'BCAA, glutamina e HMB',
    effect: 'Se você já come proteína suficiente, não acrescentam nada mensurável.',
    dose: () => 'Não recomendado.', when: '—', cautions: [],
    evidence: 'Revisões e posições da ISSN: sem benefício adicional com proteína adequada.',
  },
  {
    id: 'boosters', tier: 'C', name: '"Boosters de testosterona" (tribulus, ZMA, maca etc.)',
    effect: 'Não aumentam testosterona de forma relevante nem a massa muscular em homens saudáveis.',
    dose: () => 'Não recomendado.', when: '—', cautions: [],
    evidence: 'Ensaios clínicos sem efeito sobre hormônios ou composição corporal.',
  },
  {
    id: 'preworkout', tier: 'C', name: 'Pré-treinos com "mistura proprietária" e termogênicos',
    effect: 'O que funciona neles é a cafeína — mais barata no café. Termogênicos queimam pouquíssimo e não tiram gordura do rosto nem do flanco.',
    dose: () => 'Não recomendado.', when: '—',
    cautions: ['Doses escondidas de estimulantes: risco de taquicardia, pressão alta e insônia.'],
    evidence: 'Análises de rótulo e relatos de eventos adversos.',
  },
  {
    id: 'hormones', tier: 'C', name: 'Anabolizantes, pró-hormonais e SARMs',
    effect: 'Funcionam, e cobram caro: queda da própria testosterona, infertilidade, acne grave, queda de cabelo, ginecomastia, problemas no coração e no fígado. SARMs são vendidos sem controle do que há no frasco.',
    dose: () => 'Fora de questão.', when: '—',
    cautions: ['Aos 19 anos, o seu corpo ainda responde muito bem ao treino natural. Não troque isso por um atalho com conta para a vida toda.'],
    evidence: 'Diretrizes médicas e de endocrinologia.',
  },
];

export const SUPPLEMENT_TRUTH = [
  'Nenhum suplemento dá 1000%, 100% nem 20% a mais de músculo. O melhor deles (creatina) soma alguns pontos percentuais.',
  'A ordem do que mais pesa: treino progressivo registrado → proteína e calorias certas → sono de 7–9 h → constância por meses → só então suplemento.',
  'Suplemento pode vir contaminado ou com dose diferente do rótulo: prefira marcas com laudo de laboratório independente e registro regular.',
];

/** Protocolo simples e barato que faz sentido para ganho de massa (o usuário marca o que usa). */
export const SUGGESTED_STACK = ['creatine', 'protein'];

export function trackable(): Supplement[] { return SUPPLEMENTS.filter((s) => s.trackable); }
