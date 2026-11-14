import { addDays, weekday } from './dates';
import type { CareLogRow, HairProfile } from './types';

/** Dias de lavagem: usa os dias escolhidos ou distribui a frequência pela semana. */
export function washDays(profile: HairProfile): number[] {
  if (profile.washDays?.length) return [...profile.washDays].sort();
  const n = Math.min(7, Math.max(1, profile.washesPerWeek ?? 3));
  const presets: Record<number, number[]> = { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 3, 5, 0], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
  return presets[n].sort();
}

export function isWashDay(profile: HairProfile, iso: string): boolean {
  return washDays(profile).includes(weekday(iso));
}

export interface ScalpStatus { persistentItch: boolean; avgItch: number | null; entries: number; message: string; refer: boolean }

/**
 * Coceira persistente: ≥3 registros com coceira ≥4/10 nos últimos 14 dias → prioriza couro cabeludo
 * (sem adicionar finalizadores novos). Persistindo por 4+ semanas → avaliação profissional.
 */
export function scalpStatus(logs: CareLogRow[], todayIso: string): ScalpStatus {
  const recent = logs.filter((l) => l.area === 'hair' && l.itch !== null && l.date >= addDays(todayIso, -14));
  const older = logs.filter((l) => l.area === 'hair' && l.itch !== null && l.date < addDays(todayIso, -14) && l.date >= addDays(todayIso, -35));
  const high = recent.filter((l) => (l.itch ?? 0) >= 4);
  const avg = recent.length ? recent.reduce((s, l) => s + (l.itch ?? 0), 0) / recent.length : null;
  const persistent = high.length >= 3;
  const refer = persistent && older.filter((l) => (l.itch ?? 0) >= 4).length >= 2;
  return {
    persistentItch: persistent,
    avgItch: avg === null ? null : Math.round(avg * 10) / 10,
    entries: recent.length,
    refer,
    message: !recent.length ? 'Sem registros de coceira nos últimos 14 dias.'
      : persistent
        ? 'Coceira frequente: prioridade é a saúde do couro cabeludo. Não adicione finalizadores novos; enxágue bem, evite produto na raiz e lave após suar muito.'
          + (refer ? ' Persiste há mais de 4 semanas: procure dermatologista (descamação, vermelhidão ou feridas reforçam a necessidade).' : '')
        : 'Coceira sob controle nos registros recentes.',
  };
}

export const WASH_DAY_STEPS = [
  { step: 'Shampoo só no couro cabeludo, massageando com as pontas dos dedos (sem unhas)', amount: '1 colher de chá', notes: 'Com oleosidade, prefira shampoo de limpeza equilibrada; a espuma que escorre limpa o comprimento.' },
  { step: 'Condicionador do comprimento às pontas, desembaraçando com os dedos', amount: '1–2 colheres de sopa', notes: 'Não aplique na raiz. Enxágue parcialmente se o cabelo estiver ressecado.' },
  { step: 'Leave-in leve no cabelo encharcado', amount: '½ a 1 colher de chá', notes: 'Pouca quantidade evita pesar ou deixar oleoso.' },
  { step: 'Gel ou creme de definição em mechas (fitagem ou "praying hands")', amount: '1 colher de chá por região', notes: 'Gel forma um filme que reduz frizz sem alisar a curvatura.' },
  { step: 'Retirar excesso de água com camiseta de algodão (plopping 10–15 min)', amount: '—' },
  { step: 'Secar ao ar ou difusor em temperatura baixa sem mexer nos cachos', amount: '—', notes: 'Mexer durante a secagem gera frizz.' },
  { step: 'Quando seco, amassar suavemente para quebrar o "casquinho" do gel', amount: '—' },
];

export const NON_WASH_DAY_STEPS = [
  { step: 'Reativar com borrifador de água (pode misturar pouco leave-in)', amount: 'O suficiente para umedecer' },
  { step: 'Amassar as mechas e deixar secar sem mexer', amount: '—' },
  { step: 'Após treino com muito suor: enxaguar o couro cabeludo com água, sem necessariamente usar shampoo', amount: '—' },
];

export function cutSuggestions(profile: HairProfile): string[] {
  const out = [
    'Corte em camadas longas, feito a seco ou cacho a cacho, para tirar peso do volume lateral sem encurtar demais.',
    'Laterais mais baixas (degradê/taper discreto) reduzem o aspecto de volume excessivo e alongam o rosto.',
  ];
  if (profile.wantsFringe) out.push('Franja cacheada (curly fringe): só funciona com comprimento suficiente no topo; peça para cortar seca, um pouco mais longa do que o desejado, pois o cacho encolhe.');
  if ((profile.concerns ?? []).includes('frizz')) out.push('Pontas desgastadas aumentam frizz: aparar a cada 8–12 semanas.');
  out.push('Leve 2–3 fotos de referência e fotos do seu cabelo seco e finalizado. Sugestões aqui são gerais: o cabeleireiro avalia densidade, redemoinhos e formato do rosto ao vivo.');
  return out;
}

export const GROOMING_GUIDE = {
  beard: [
    'Defina a linha do pescoço ~1–2 dedos acima do pomo de Adão; abaixo dela, remova os pelos.',
    'Linha da bochecha: siga a linha natural ou abaixe levemente; evite subir demais.',
    'Apare com máquina de pente fixo 1× por semana para manter o formato; tesoura para fios longos.',
    'Pele oleosa/acne: lave a barba com o mesmo limpador do rosto e use hidratante leve; óleos de barba podem piorar a acne — teste em pequena área.',
    'Pelos encravados: barbeie a favor do pelo, com lâmina limpa, sem esticar a pele; evite passar a lâmina várias vezes no mesmo ponto.',
  ],
  mustache: [
    'Apare o excesso que cobre o lábio superior com tesoura pequena, com o pente encostado.',
    'Mantenha simetria conferindo no espelho a partir do centro (filtro labial) para os lados.',
  ],
  brows: [
    'Remova apenas os fios claramente fora do desenho (entre as sobrancelhas e embaixo, isolados).',
    'Penteie para cima e apare com tesoura só as pontas muito longas.',
    'Não afine o arco nem altere o formato natural; prefira pinça a cera se a pele for reativa.',
    'Faça com boa luz e a distância normal do espelho, conferindo os dois lados.',
  ],
};
