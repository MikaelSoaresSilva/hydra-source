import { z } from 'zod';
import type { Profile } from './types';
import type { AppearanceProfile } from '../../supabase/functions/_shared/appearance';

// ------------------------------------------------------------ resposta da IA (validada no cliente)

const conf = z.enum(['baixa', 'media', 'alta']);
export const AppearanceResultSchema = z.object({
  photo_quality: z.object({ usable: z.boolean(), issues: z.array(z.string()) }),
  face_shape: z.object({ estimate: z.enum(['oval', 'redondo', 'quadrado', 'triangular', 'retangular', 'indefinido']), confidence: conf, reasoning: z.string() }),
  hair: z.object({ type_estimate: z.string(), confidence: conf, observations: z.array(z.string()) }),
  haircuts: z.array(z.object({ name: z.string(), why: z.string(), ask_barber: z.string(), maintenance: z.string(), avoid_if: z.string() })),
  skin: z.object({
    observations: z.array(z.string()),
    routine: z.array(z.object({ when: z.enum(['manha', 'noite', 'semanal']), step: z.string(), why: z.string() })),
    ingredients: z.array(z.object({ name: z.string(), purpose: z.string(), caution: z.string() })),
  }),
  beard_brows: z.array(z.string()),
  facial_massage: z.object({ suitable_now: z.boolean(), steps: z.array(z.string()), evidence_note: z.string() }),
  habits: z.array(z.string()),
  see_professional: z.array(z.string()),
  limitations: z.array(z.string()),
});
export type AppearanceResult = z.infer<typeof AppearanceResultSchema>;

/** Palavras que o app nunca deve exibir como recomendação (medicamentos/hormônios) — defesa extra. */
const FORBIDDEN = /\b(minoxidil|finasterida|dutasterida|isotretino[ií]na|roacutan|testosterona|anabolizante|esteroide|oxandrolona|antibi[oó]tico)\b/i;

export function parseAppearanceResult(raw: unknown): { ok: true; value: AppearanceResult; removed: number } | { ok: false; error: string } {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { return { ok: false, error: 'Resposta da IA não é JSON válido.' }; }
  }
  const r = AppearanceResultSchema.safeParse(data);
  if (!r.success) return { ok: false, error: 'Resposta da IA fora do formato esperado.' };
  // Remove qualquer item que cite medicamento/hormônio (o prompt já proíbe; isto é a rede de segurança).
  let removed = 0;
  const keep = (s: string) => { if (FORBIDDEN.test(s)) { removed++; return false; } return true; };
  const v = r.data;
  const value: AppearanceResult = {
    ...v,
    haircuts: v.haircuts.filter((h) => keep(`${h.name} ${h.why} ${h.ask_barber}`)).slice(0, 4),
    skin: {
      observations: v.skin.observations.filter(keep),
      routine: v.skin.routine.filter((x) => keep(`${x.step} ${x.why}`)),
      ingredients: v.skin.ingredients.filter((x) => keep(`${x.name} ${x.purpose}`)),
    },
    beard_brows: v.beard_brows.filter(keep),
    habits: v.habits.filter(keep),
    facial_massage: { ...v.facial_massage, steps: v.facial_massage.steps.filter(keep) },
  };
  return { ok: true, value, removed };
}

/** Perfil mínimo enviado junto com as fotos (sem nome, e-mail, peso ou medidas). */
export function appearanceProfileFrom(p: Profile | null, userGoal?: string): AppearanceProfile {
  return {
    age: p?.age ?? null,
    sex: p?.sex ?? null,
    skinType: p?.skin.type,
    skinConcerns: p?.skin.concerns,
    skinSensitivities: p?.skin.sensitivities,
    curlType: p?.hair.curlType,
    hairLength: p?.hair.length,
    scalp: p?.hair.scalp,
    hairGoals: p?.hair.goals,
    beardGoal: p?.grooming.beardGoal,
    browsGoal: p?.grooming.browsGoal,
    userGoal,
  };
}

// ------------------------------------------------------------ questionário (sem IA)

export type FaceShape = 'oval' | 'redondo' | 'quadrado' | 'triangular' | 'retangular';
export const FACE_LABEL: Record<FaceShape, string> = {
  oval: 'Oval', redondo: 'Redondo', quadrado: 'Quadrado', triangular: 'Triangular', retangular: 'Retangular',
};

export interface FaceAnswers {
  /** Comprimento (testa→queixo) comparado à largura (maçãs do rosto). */
  length: 'much_longer' | 'slightly_longer' | 'similar';
  /** Parte mais larga do rosto. */
  widest: 'forehead' | 'cheekbones' | 'jaw' | 'equal';
  /** Contorno da mandíbula. */
  jaw: 'angular' | 'rounded' | 'narrow_chin';
}

export const FACE_QUESTIONS = {
  length: {
    q: 'Com uma fita métrica ou um barbante, em frente ao espelho: o comprimento do rosto (início do cabelo até o queixo) comparado à largura (de uma maçã do rosto à outra) é…',
    options: { much_longer: 'Bem maior (≈1,5× ou mais)', slightly_longer: 'Um pouco maior', similar: 'Parecido' },
  },
  widest: {
    q: 'Qual parte do rosto é a mais larga?',
    options: { forehead: 'Testa', cheekbones: 'Maçãs do rosto', jaw: 'Mandíbula', equal: 'Tudo parecido' },
  },
  jaw: {
    q: 'Como é o contorno da mandíbula e do queixo?',
    options: { angular: 'Reto/anguloso, ângulos marcados', rounded: 'Arredondado, suave', narrow_chin: 'Afina até um queixo estreito' },
  },
} as const;

/** Classificação por pontuação. A confiança cai quando duas formas empatam ou ficam próximas. */
export function classifyFace(a: FaceAnswers): { shape: FaceShape; confidence: 'baixa' | 'media' | 'alta'; runnerUp: FaceShape | null } {
  const s: Record<FaceShape, number> = { oval: 0, redondo: 0, quadrado: 0, triangular: 0, retangular: 0 };
  if (a.length === 'similar') { s.redondo += 2; s.quadrado += 2; }
  if (a.length === 'slightly_longer') { s.oval += 2; s.triangular += 1; }
  if (a.length === 'much_longer') { s.retangular += 3; s.oval += 1; }
  if (a.widest === 'cheekbones') { s.oval += 2; s.redondo += 1; }
  if (a.widest === 'jaw') { s.triangular += 3; s.quadrado += 1; }
  if (a.widest === 'forehead') { s.oval += 1; s.quadrado += 1; }
  if (a.widest === 'equal') { s.quadrado += 2; s.retangular += 2; }
  if (a.jaw === 'angular') { s.quadrado += 2; s.retangular += 1; s.triangular += 1; }
  if (a.jaw === 'rounded') { s.redondo += 2; s.oval += 1; }
  if (a.jaw === 'narrow_chin') { s.oval += 2; }
  const ranked = (Object.entries(s) as [FaceShape, number][]).sort((x, y) => y[1] - x[1]);
  const margin = ranked[0][1] - ranked[1][1];
  return { shape: ranked[0][0], confidence: margin >= 3 ? 'alta' : margin >= 1 ? 'media' : 'baixa', runnerUp: margin <= 1 ? ranked[1][0] : null };
}

export interface CutSuggestion { name: string; why: string; askBarber: string; maintenance: string; source: string }

const SRC_CORTE = 'Corte de Cabelo Masculino (PDF)';
const SRC_GERAL = 'Princípio geral de visagismo (não consta nos PDFs) — use como ponto de partida';

/** Tipos de curvatura em que a navalha deve ser evitada e camadas são contraindicadas. */
const isKinky = (curl?: string) => /^4|crespo/i.test(curl ?? '');

/**
 * Sugestões de corte por formato do rosto, adaptadas à curvatura informada.
 * Regras do PDF: graduado ideal p/ oval e inadequado p/ quadrado; desfiado recomendado p/ redondo
 * (evitar em oval com fio fino); camadas p/ triangular (contraindicado em crespo); quadrado: assimétrico
 * com pontas desiguais puxadas para a testa.
 */
export function cutSuggestions(shape: FaceShape, opts: { curlType?: string; fineHair?: boolean } = {}): CutSuggestion[] {
  const kinky = isKinky(opts.curlType);
  const curly = /^(2c|3|cachead)/i.test(opts.curlType ?? '') || /^2[ab]/i.test(opts.curlType ?? '');
  const blade = kinky ? 'Peça para NÃO usar navalha (fio crespo).' : 'Prefira tesoura a navalha: dura 2–3 meses, a navalha ~45 dias.';
  const out: CutSuggestion[] = [];
  const fadeLow: CutSuggestion = {
    name: 'Low fade (degradê baixo) ou taper com cachos no topo',
    why: 'Mantém o volume dos cachos em cima e deixa as laterais limpas com transição suave; o low fade é muito indicado para fios crespos/cacheados.',
    askBarber: `"Degradê baixo (low fade) começando no pente 1 ou 2 só na nuca e em volta da orelha, subindo até o pente 4 nas laterais; em cima, só tesoura, tirando pouco do comprimento e respeitando o cacho." Se não quiser marcas entre os pentes, peça os pentes de disfarce ½ e 1½. ${blade}`,
    maintenance: 'Laterais a cada 2–3 semanas; topo a cada 1–2 meses.',
    source: SRC_CORTE,
  };
  switch (shape) {
    case 'oval':
      out.push({
        name: 'Graduado (curto) com textura natural',
        why: 'O PDF indica o graduado como ideal para rosto oval: curto atrás, mais comprido na frente.',
        askBarber: `"Graduado, mais curto na nuca e alongando para a frente, com o topo aparado e alinhado." ${opts.fineHair ? 'Fio fino: evite desfiado.' : ''} ${blade}`.trim(),
        maintenance: 'Revisão a cada 2 meses para não perder o formato.',
        source: SRC_CORTE,
      });
      out.push(fadeLow);
      break;
    case 'redondo':
      out.push({
        name: 'Desfiado sutil (com tesoura) com mais altura no topo',
        why: 'O PDF recomenda o desfiado para rosto redondo; pontas desiguais quebram a forma circular. Em cacheados, o desfiado também tira volume lateral.',
        askBarber: `"Desfiado sutil só para tirar volume das laterais, mantendo comprimento e altura em cima." ${blade}`,
        maintenance: 'Revisão a cada 2 meses (curto: ~1 mês).',
        source: SRC_CORTE,
      });
      out.push({ ...fadeLow, why: `${fadeLow.why} Laterais mais baixas e altura no topo alongam visualmente o rosto redondo.`, source: `${SRC_CORTE} + ${SRC_GERAL}` });
      break;
    case 'quadrado':
      out.push({
        name: 'Assimétrico com pontas desiguais puxadas para a testa',
        why: 'Segundo o PDF, quebra as linhas duras do rosto quadrado e suaviza o semblante. Evite o graduado, apontado como inadequado para esse formato.',
        askBarber: `"Topo com pontas irregulares, sem linha reta, com os cachos caindo para a testa; laterais curtas mas não raspadas." ${blade}`,
        maintenance: 'Revisão a cada 1–2 meses.',
        source: SRC_CORTE,
      });
      out.push(fadeLow);
      break;
    case 'triangular':
      if (!kinky) {
        out.push({
          name: 'Camadas (médio)',
          why: 'O PDF recomenda camadas para rosto triangular: dão movimento e volume em cima, equilibrando a mandíbula mais larga.',
          askBarber: `"Camadas com mais volume no topo e laterais sem raspar; tire pouco em cada camada." ${curly ? 'Peça corte a seco ou cacho a cacho, para ver como o cacho cai.' : ''} ${blade}`.trim(),
          maintenance: 'Aparar as pontas a cada 3 meses.',
          source: SRC_CORTE,
        });
      }
      out.push({ ...fadeLow, why: `${fadeLow.why} Evite raspar demais as laterais, para não destacar ainda mais a mandíbula.`, source: `${SRC_CORTE} + ${SRC_GERAL}` });
      break;
    case 'retangular':
      out.push({
        name: 'Taper (disfarce baixo) com cachos médios e sem topete alto',
        why: 'O PDF não traz regra para rosto retangular. Princípio geral: evitar altura excessiva no topo e manter algum volume nas laterais, para não alongar mais o rosto.',
        askBarber: `"Taper só no pezinho e costeletas, laterais com tesoura ou pente alto (4 ou mais) e topo médio com os cachos soltos para a frente/lado." ${blade}`,
        maintenance: 'Revisão a cada 1–2 meses.',
        source: SRC_GERAL,
      });
      break;
  }
  if (kinky && shape === 'triangular') {
    out.push({ name: 'Evite: corte em camadas', why: 'O PDF contraindica camadas para cabelo crespo.', askBarber: '—', maintenance: '—', source: SRC_CORTE });
  }
  return out;
}

/** Regras gerais de corte e máquina do PDF, sempre exibidas. */
export const CUT_RULES = [
  'Máquina: pente nº 1 ≈ 3 mm e cada número soma ≈ 3 mm. Abaixo do pente 4 o couro cabeludo aparece: use protetor solar ou boné no sol.',
  'Nunca passe máquina no cabelo molhado. Desfiado com tesoura pode ser feito a seco; navalha só em cabelo úmido (a seco, puxa e machuca).',
  'Corte militar (muito curto) exige manutenção a cada ~15 dias.',
  'Repicar define o cacho de ondulados; desfiar tira volume de cacheados (sempre sutil, senão arrepia); picotar é para liso grosso; perfilar é para liso ou ondulado.',
  'Leve uma foto de referência ao barbeiro e diga o número do pente: evita surpresas.',
];

export const FACIAL_MASSAGE = {
  evidence: 'Evidência científica limitada. Pode reduzir o inchaço da manhã de forma temporária (horas) e é relaxante. Não fecha poros, não trata flacidez e não muda o formato do rosto.',
  steps: [
    'Lave as mãos e aplique o hidratante (textura gel/gel-creme) para a pele deslizar sem puxar.',
    'Pressão leve. Do centro do rosto para fora: testa (do meio para as têmporas), maçãs (do nariz para as orelhas) e mandíbula (do queixo para as orelhas), 5× cada.',
    'Desça com os dedos atrás da orelha até a clavícula pelas laterais do pescoço, 5× bem leve.',
    'Ao redor dos olhos, só toques leves com o anelar, sem arrastar.',
    'Ao todo, 1–3 minutos, de preferência de manhã.',
  ],
  avoid: [
    'Sobre espinhas inflamadas, feridas, pele irritada ou queimada de sol: pule a área ou o dia.',
    'Rolos ou pedras (gua sha) com pressão forte: podem irritar a pele acneica. Se usar, higienize antes e depois.',
    'Massagem forte no couro cabeludo oleoso estimula o rebote de oleosidade (Almanaque); no rosto, prefira toques leves.',
  ],
};

export const BEARD_BROWS = [
  'Barba: defina a linha do pescoço cerca de 1–2 dedos acima do pomo de adão e a linha da bochecha seguindo o desenho natural; apare com pente, nunca molhada se usar máquina.',
  'Acne ou pelos encravados na região da barba: lâmina nova, barbear a favor dos pelos e máquina com pente curto em vez de "zerar". Não esprema.',
  'Sobrancelhas: só retire os pelos soltos entre elas e os muito fora do desenho; não afine. Uma pinça limpa resolve.',
];
