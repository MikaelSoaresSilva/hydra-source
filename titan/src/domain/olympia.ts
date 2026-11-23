// Protocolo Olympia — ciclo de 60 dias (9 semanas) para hipertrofia natural com foco estético
// (Classic Physique): braços em prioridade, largura (dorsais + deltoide lateral), peitoral superior
// e pernas completas. Frequência ~2×/semana por músculo, volume inicial moderado e ajustado por dados.
import type { Muscle, MetricRow } from './types';
import type { WeekPhase } from './program';

export type SlotTpl = [exerciseKey: string, sets: number, restSec: number];
export interface DayTpl { name: string; focus: string; slots: SlotTpl[] }

export const OLYMPIA_WEEKS = 9;
export const OLYMPIA_PRIORITIES: Muscle[] = ['biceps', 'triceps', 'brachialis', 'side_delts', 'back', 'quads'];

/**
 * Segunda a sexta. Prioridades primeiro no dia (sistema prioritário) e grupos que competem
 * separados por ≥48 h quando possível. Braço direto aparece em 4 dos 5 dias, com volume
 * distribuído para que nenhuma sessão de braço passe de ~8 séries diretas.
 */
export const OLYMPIA_DAYS: DayTpl[] = [
  { name: 'Superior A — largura', focus: 'Dorsais (largura), deltoide lateral, peitoral superior e braços em posição alongada', slots: [
    ['lat_pulldown', 3, 150], ['incline_db_press', 3, 150], ['chest_supported_row', 3, 120], ['db_lateral_raise', 4, 75],
    ['straight_arm_pulldown', 2, 75], ['incline_db_curl', 3, 90], ['overhead_cable_extension', 3, 90]] },
  { name: 'Inferior A — quadríceps', focus: 'Quadríceps, posteriores, panturrilhas e abdômen', slots: [
    ['back_squat', 3, 180], ['romanian_deadlift', 3, 150], ['leg_press', 2, 150], ['leg_extension', 3, 90],
    ['lying_leg_curl', 2, 90], ['standing_calf_raise', 4, 75], ['cable_crunch', 3, 75]] },
  { name: 'Braços e ombros', focus: 'Especialização: bíceps, braquial, tríceps, deltoides lateral e posterior', slots: [
    ['ez_bar_curl', 3, 120], ['skull_crusher_ez', 3, 120], ['hammer_curl', 3, 90], ['rope_pushdown', 3, 75],
    ['bayesian_cable_curl', 3, 75], ['cable_lateral_raise', 4, 60], ['reverse_pec_deck', 3, 60]] },
  { name: 'Superior B — peitoral superior e espessura', focus: 'Peitoral superior primeiro, costas (espessura), deltoide lateral e tríceps', slots: [
    ['incline_smith_press', 3, 150], ['pull_up', 3, 150], ['bench_press', 2, 180], ['seated_cable_row', 3, 120],
    ['cable_fly', 2, 90], ['db_lateral_raise', 4, 75], ['machine_dip', 2, 90]] },
  { name: 'Inferior B + braços', focus: 'Quadríceps, posteriores, glúteos, panturrilhas e volume extra de braço e ombro', slots: [
    ['hack_squat', 3, 150], ['seated_leg_curl', 3, 90], ['bulgarian_split_squat', 2, 120], ['leg_press_calf', 4, 60],
    ['cable_lateral_raise', 3, 60], ['rope_hammer_curl', 2, 75], ['db_overhead_extension', 2, 75], ['hanging_leg_raise', 2, 60]] },
];

/** Versão do protocolo: ciclos antigos são atualizados no lugar (mantendo semana e histórico). */
export const OLYMPIA_VERSION = 2;

/**
 * Critério de deload (aplicado automaticamente no protocolo travado): queda de desempenho em
 * ≥ 2 exercícios nas 3 últimas sessões E recuperação baixa (média ≤ 2,5/5 ou TQR < 13 nas 2 últimas sessões).
 */
export function deloadCriteria(decliningCount: number, recovery: number | null, lastTqrs: number[]): boolean {
  const poor = (recovery !== null && recovery <= 2.5) || (lastTqrs.length >= 2 && lastTqrs.slice(-2).every((t) => t < 13));
  return decliningCount >= 2 && poor;
}

/**
 * Fases por dias do plano (sem deload automático — só quando os dados indicarem):
 *  dias 1–7 linha de base (RIR alto, técnica e cargas iniciais), 8–14 tolerância ao volume,
 *  15–30 progressão, 31–60 continuidade com ajustes condicionados aos resultados.
 */
export function olympiaPhase(week: number, deloadWeeks: number[] = []): WeekPhase {
  if (deloadWeeks.includes(week)) {
    return { week, label: 'Deload (aplicado por fadiga/desempenho)', rirCompound: 4, rirIsolation: 3, prioritySetBonus: 0, deload: true, assessment: false };
  }
  if (week <= 1) return { week, label: 'Dias 1–7 · Linha de base e técnica', rirCompound: 3, rirIsolation: 2, prioritySetBonus: 0, deload: false, assessment: true };
  if (week === 2) return { week, label: 'Dias 8–14 · Tolerância ao volume', rirCompound: 2, rirIsolation: 2, prioritySetBonus: 0, deload: false, assessment: false };
  if (week <= 4) return { week, label: 'Dias 15–30 · Progressão', rirCompound: 2, rirIsolation: 1, prioritySetBonus: 0, deload: false, assessment: week % 2 === 1 };
  return { week, label: 'Dias 31–60 · Continuidade com ajustes por dados', rirCompound: 1, rirIsolation: 1, prioritySetBonus: 0, deload: false, assessment: week % 2 === 1 };
}

/** Faixa inicial de séries semanais por músculo (direto = 1, secundário = 0,5) e teto do ciclo. */
export const OLYMPIA_VOLUME: Partial<Record<Muscle, { start: [number, number]; ceiling: number; why: string }>> = {
  biceps: { start: [14, 18], ceiling: 22, why: 'Prioridade estética; 35 cm contraído é o menor perímetro relativo da ficha.' },
  triceps: { start: [14, 19], ceiling: 22, why: 'Maior parte do volume do braço; prioridade junto com o bíceps.' },
  brachialis: { start: [8, 12], ceiling: 14, why: 'Contribui para a espessura do braço; recebe também trabalho indireto das roscas.' },
  side_delts: { start: [14, 18], ceiling: 22, why: 'Largura de ombro é o principal motor da silhueta em V; recupera rápido.' },
  rear_delts: { start: [5, 9], ceiling: 12, why: 'Volume 3D do ombro e equilíbrio postural com o trabalho de empurrar.' },
  back: { start: [12, 16], ceiling: 20, why: 'Largura das dorsais para o V; costas pouco avaliáveis nas fotos enviadas.' },
  chest: { start: [10, 14], ceiling: 16, why: 'Peitoral com ênfase no superior, sem roubar recuperação dos ombros.' },
  quads: { start: [12, 16], ceiling: 18, why: 'Coxa de 60 cm em 180 cm de altura: pernas precisam acompanhar o tronco no Classic.' },
  hamstrings: { start: [8, 12], ceiling: 14, why: 'Perfil lateral da coxa e equilíbrio com quadríceps.' },
  calves: { start: [8, 10], ceiling: 12, why: 'Manutenção com progressão; 37 cm está proporcional à coxa atual.' },
  abs: { start: [5, 8], ceiling: 8, why: 'Controle de cintura e core; sem foco em hipertrofia do oblíquo.' },
};

export const OLYMPIA_RULES = {
  progression: [
    'Dupla progressão: mantenha a carga até completar o topo da faixa de repetições em TODAS as séries com o RIR alvo; então suba o menor incremento (2–2,5% em compostos, 1–2 kg em isolados).',
    'Não suba carga se a técnica não ficou ok, se houve dor ≥ 4/10 ou se o RIR real foi menor que o alvo em mais de 1.',
    'Se cair abaixo do piso da faixa de repetições com a mesma carga em 2 sessões seguidas: reduza 5–10% e reconstrua.',
  ],
  addVolume: [
    'Revisão nos dias 14, 30 e 45 (não antes): para cada músculo prioritário, +1 a 2 séries semanais SOMENTE se: (a) repetições ou carga subiram nos exercícios do músculo, (b) TQR médio ≥ 13 e dor muscular resolvida antes da sessão seguinte do grupo, e (c) a medida/fotos do grupo não mudaram em 4 semanas.',
    'Nunca some mais de 2 séries por músculo por revisão nem ultrapasse o teto do ciclo.',
  ],
  reduceVolume: [
    'Corte 1/3 do volume do músculo (ou aplique deload) se houver queda de desempenho em ≥ 2 exercícios por 2 sessões seguidas com TQR < 13, ou dor articular que persiste no dia seguinte.',
    'Deload não segue o calendário: o app aplica sozinho na semana em que o critério (queda de desempenho + recuperação baixa) for atingido.',
  ],
  weight: [
    'Use a média semanal (3–7 pesagens), nunca uma pesagem isolada.',
    'Meta para 1–3 anos de treino: ≈ +0,1 a +0,25% do peso por semana (≈ 0,1–0,2 kg/semana em 75 kg; ~0,5–0,75 kg/mês). Abaixo disso por 2 semanas seguidas: +100 a 150 kcal. Acima de 0,35%/semana por 2 semanas, ou cintura +1,5 cm em 4 semanas sem aumento dos braços: −100 a 150 kcal.',
  ],
};

export const MEASURING_GUIDE = [
  'Mesma fita métrica não elástica, mesmo horário (manhã, em jejum, antes do treino), sem pump; idealmente a mesma pessoa medindo.',
  'Braço relaxado: braço ao lado do corpo, no ponto médio entre ombro (acrômio) e cotovelo. Contraído: cotovelo a 90°, punho fechado, no ponto mais volumoso do bíceps.',
  'Antebraço: maior perímetro logo abaixo do cotovelo, mão aberta e relaxada.',
  'Peitoral: na linha dos mamilos, braços relaxados, ao fim de uma expiração normal.',
  'Cintura: na altura do umbigo, abdômen relaxado (não encolhido), ao fim da expiração.',
  'Quadril: maior perímetro dos glúteos, pés juntos.',
  'Coxa: logo abaixo da prega glútea (ou ponto médio entre virilha e joelho — escolha um e mantenha), peso nas duas pernas.',
  'Panturrilha: maior perímetro, em pé, peso distribuído.',
  'Ombros: em pé, braços relaxados, fita passando pelo ponto mais largo dos deltoides; é a medida menos reprodutível — repita 3× e use a média.',
  'Faça cada medida 2× e anote a média; diferença > 0,5 cm entre as duas → meça a terceira.',
];

export interface RatioReport { label: string; value: string; note: string }

const r2 = (n: number) => (Math.round(n * 100) / 100).toLocaleString('pt-BR');
const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));

/** Relações calculáveis a partir da medição mais recente (cada uma com sua limitação). */
export function anthropometry(m: Partial<MetricRow> & Record<string, unknown>, heightCm?: number | null): RatioReport[] {
  const out: RatioReport[] = [];
  const arm = Math.max(num(m.arm_right_cm) ?? 0, num(m.arm_left_cm) ?? 0) || null;
  const fore = Math.max(num(m.forearm_right_cm) ?? 0, num(m.forearm_left_cm) ?? 0) || null;
  const waist = num(m.waist_cm);
  const chest = num(m.chest_cm);
  const thigh = Math.max(num(m.thigh_cm) ?? 0, num(m.thigh_left_cm) ?? 0) || null;
  const calf = Math.max(num(m.calf_right_cm) ?? 0, num(m.calf_left_cm) ?? 0) || null;
  const shoulders = num(m.shoulders_cm);
  const weight = num(m.weight_kg);
  if (arm && waist) out.push({ label: 'Braço / cintura', value: `${r2(arm / waist)}`, note: 'Sobe quando o braço cresce ou a cintura cai. Circunferência inclui gordura, água e osso — não é medida direta de músculo.' });
  if (chest && waist) out.push({ label: 'Peitoral / cintura', value: `${r2(chest / waist)}`, note: 'Indicador grosseiro de silhueta em V; depende de dorsais, peitoral e técnica de medida.' });
  if (shoulders && waist) out.push({ label: 'Ombros / cintura', value: `${r2(shoulders / waist)}`, note: 'Só compare consigo mesmo: a medida de ombro varia muito com o método.' });
  if (thigh && calf) out.push({ label: 'Coxa / panturrilha', value: `${r2(thigh / calf)}`, note: 'Ajuda a acompanhar o equilíbrio das pernas ao longo do tempo.' });
  if (arm && fore) out.push({ label: 'Braço contraído / antebraço', value: `${r2(arm / fore)}`, note: 'Mostra se o braço cresce mais que o antebraço; sem valor “ideal” universal.' });
  if (waist && heightCm) out.push({ label: 'Cintura / altura', value: `${r2(waist / heightCm)}`, note: 'Abaixo de 0,5 é a faixa usada em saúde para menor risco cardiometabólico; não mede estética.' });
  if (weight && heightCm) out.push({ label: 'IMC', value: (Math.round((weight / (heightCm / 100) ** 2) * 10) / 10).toLocaleString('pt-BR'), note: 'Não distingue músculo de gordura; útil só como contexto.' });
  const pairs: [string, unknown, unknown][] = [
    ['Braço', m.arm_right_cm, m.arm_left_cm], ['Antebraço', m.forearm_right_cm, m.forearm_left_cm],
    ['Coxa', m.thigh_cm, m.thigh_left_cm], ['Panturrilha', m.calf_right_cm, m.calf_left_cm],
  ];
  for (const [label, a, b] of pairs) {
    const x = num(a); const y = num(b);
    if (x && y) {
      const d = Math.abs(x - y);
      out.push({ label: `${label}: diferença D/E`, value: `${r2(d)} cm`, note: d <= 1 ? 'Dentro do erro típico de medida (~0,5–1 cm).' : 'Acima do erro típico: confirme medindo de novo antes de mudar o treino.' });
    }
  }
  return out;
}
