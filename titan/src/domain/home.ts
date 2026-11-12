// Treino em casa, só com o peso do corpo — versão de cada dia do Protocolo JKK (4 ou 5 dias)
// para quando não der para ir à academia. Mesmo foco muscular do dia; a sessão conta no ciclo.
//
// Base: cargas leves geram hipertrofia quando a série chega perto da falha (ver Biblioteca →
// "Intensidade, falha e amplitude"). Por isso aqui o que progride é repetição, tempo de descida e
// a variação do exercício — não o peso.
import { EXERCISE_BY_KEY } from './exercises';
import { isJkk, type JkkProtocol, type ProgramConfig, type SlotPrescription } from './types';

type HomeRow = [exerciseKey: string, sets: number, restSec: number];
interface HomeSession { name: string; intro: string; rows: HomeRow[] }

/** Como deixar cada exercício mais difícil quando bater o topo da faixa em todas as séries. */
export const HOME_PROGRESSION: Record<string, string> = {
  hb_decline_push_up: 'pés mais altos → descida de 4 s → mochila com livros nas costas',
  hb_pike_push_up: 'pés na cadeira → mãos em dois apoios para descer mais',
  hb_pause_push_up: 'pausa de 3 s → flexão declinada → mochila nas costas',
  push_up: 'mãos mais abertas com pausa de 2 s → mochila nas costas',
  hb_diamond_push_up: 'descida de 4 s → pés na cadeira',
  hb_bw_triceps_extension: 'apoio mais baixo (da mesa para a cadeira) → um pé só no chão',
  hb_chair_dip: 'pernas esticadas → pés em outra cadeira',
  hb_table_row: 'pernas esticadas → pés numa cadeira → pausa de 2 s com o peito na mesa',
  hb_table_row_supinated: 'pernas esticadas → descida de 4 s → pés numa cadeira',
  hb_floor_lat_pull: 'descida de 3 s → braços mais esticados → só um braço puxando',
  hb_prone_y_raise: 'pausa de 3 s em cima → garrafa de água em cada mão',
  hb_towel_curl: 'empurre mais com a perna → descida de 5 s → um braço por vez',
  hb_towel_hammer_curl: 'empurre mais com a perna → descida de 5 s',
  hb_towel_wring: 'toalha mais grossa/molhada → mais segundos',
  hb_door_lateral_iso: 'mais força contra o batente → mais segundos',
  hb_bulgarian_squat: 'descida de 4 s → pausa de 2 s embaixo → mochila com peso',
  hb_tempo_squat: 'pausa de 3 s embaixo → agachamento búlgaro',
  hb_step_up: 'cadeira mais alta → descida de 5 s → mochila com peso',
  hb_sissy_squat: 'incline mais para trás → menos ajuda das mãos',
  hb_nordic_curl: 'desça mais devagar → menos ajuda das mãos na volta',
  hb_sliding_leg_curl: 'uma perna por vez → pausa de 2 s com os pés perto do quadril',
  hb_single_leg_rdl: 'descida de 4 s → mochila com peso na mão',
  hb_single_leg_hip_thrust: 'pausa de 3 s em cima → mochila com peso no quadril',
  hb_single_leg_bridge: 'pé apoiado na cadeira → pausa de 3 s em cima',
  hb_single_leg_calf_raise: 'pausa de 3 s embaixo → mochila com peso',
  hb_bent_knee_calf_raise: 'pausa de 3 s embaixo → mochila com peso',
  hb_lying_leg_raise: 'pernas mais esticadas → descida de 5 s',
  hb_reverse_crunch: 'descida de 4 s → elevação de pernas deitado',
  side_plank: 'mais segundos → pé de cima elevado',
};

const push: HomeSession = {
  name: 'Em casa · Peito superior + Ombros + Tríceps',
  intro: 'Pés elevados levam o esforço para o peito superior; a flexão pike faz o papel do desenvolvimento.',
  rows: [['hb_decline_push_up', 4, 90], ['hb_pike_push_up', 3, 90], ['hb_pause_push_up', 3, 75], ['hb_door_lateral_iso', 4, 45], ['hb_bw_triceps_extension', 3, 75], ['hb_diamond_push_up', 3, 75]],
};
const legsA: HomeSession = {
  name: 'Em casa · Pernas A (quadríceps)',
  intro: 'Sem carga, a perna trabalha uma de cada vez e com descida lenta: é isso que deixa pesado.',
  rows: [['hb_bulgarian_squat', 4, 90], ['hb_tempo_squat', 3, 90], ['hb_step_up', 3, 75], ['hb_sissy_squat', 3, 75], ['hb_sliding_leg_curl', 2, 75], ['hb_single_leg_calf_raise', 4, 45], ['hb_lying_leg_raise', 3, 45]],
};
const pull: HomeSession = {
  name: 'Em casa · Costas + Bíceps + Antebraço',
  intro: 'Costas é o grupo mais difícil sem equipamento: a remada sob uma mesa firme é a base. Se tiver uma barra fixa por perto (praça, porta), faça barra no lugar da remada.',
  rows: [['hb_table_row', 4, 90], ['hb_floor_lat_pull', 3, 75], ['hb_prone_y_raise', 3, 60], ['hb_table_row_supinated', 3, 90], ['hb_towel_curl', 3, 60], ['hb_towel_hammer_curl', 3, 60], ['hb_towel_wring', 2, 45]],
};
const legsB: HomeSession = {
  name: 'Em casa · Pernas B (posterior + glúteo)',
  intro: 'A flexão nórdica e a flexora deslizando treinam o posterior de coxa com força de verdade, sem máquina.',
  rows: [['hb_nordic_curl', 4, 90], ['hb_sliding_leg_curl', 3, 75], ['hb_bulgarian_squat', 3, 90], ['hb_single_leg_hip_thrust', 3, 75], ['hb_bent_knee_calf_raise', 4, 45], ['hb_reverse_crunch', 2, 45], ['side_plank', 2, 45]],
};
const arms: HomeSession = {
  name: 'Em casa · Braços + Peito central',
  intro: 'Braço primeiro, descansado. Bíceps e tríceps alternados: enquanto um trabalha, o outro descansa.',
  rows: [['hb_towel_curl', 3, 60], ['hb_bw_triceps_extension', 3, 60], ['hb_table_row_supinated', 3, 75], ['hb_diamond_push_up', 3, 75], ['hb_towel_hammer_curl', 2, 60], ['hb_pause_push_up', 3, 75], ['push_up', 3, 75], ['hb_door_lateral_iso', 3, 45]],
};
const upperA: HomeSession = {
  name: 'Em casa · Superior A — Peito superior + Costas + Ombro + Tríceps',
  intro: 'Alterne empurrar e puxar: enquanto o peito descansa, as costas trabalham.',
  rows: [['hb_decline_push_up', 4, 90], ['hb_table_row', 3, 90], ['hb_pike_push_up', 3, 90], ['hb_floor_lat_pull', 3, 75], ['hb_door_lateral_iso', 4, 45], ['hb_bw_triceps_extension', 3, 75], ['hb_towel_curl', 3, 60], ['hb_diamond_push_up', 3, 75]],
};
const legsA4: HomeSession = {
  name: 'Em casa · Inferior A — Quadríceps + Antebraço',
  intro: legsA.intro,
  rows: [...legsA.rows, ['hb_towel_hammer_curl', 2, 60], ['hb_towel_wring', 2, 45]],
};
const upperB: HomeSession = {
  name: 'Em casa · Superior B — Braços + Peito central + Costas',
  intro: arms.intro,
  rows: [['hb_towel_curl', 3, 60], ['hb_bw_triceps_extension', 3, 60], ['hb_table_row_supinated', 3, 75], ['hb_diamond_push_up', 3, 75], ['hb_pause_push_up', 3, 75], ['push_up', 3, 75], ['hb_table_row', 3, 90], ['hb_prone_y_raise', 2, 60], ['hb_door_lateral_iso', 4, 45]],
};
const legsB4: HomeSession = {
  name: 'Em casa · Inferior B — Posterior + Glúteo + Braquial',
  intro: legsB.intro,
  rows: [...legsB.rows, ['hb_towel_hammer_curl', 3, 60]],
};

const fullA: HomeSession = {
  name: 'Em casa · Corpo inteiro A — Peito superior + Costas + Quadríceps + Braços',
  intro: 'Empurrar, puxar e perna se alternam: um descansa enquanto o outro trabalha.',
  rows: [['hb_decline_push_up', 4, 90], ['hb_table_row', 3, 90], ['hb_bulgarian_squat', 3, 90], ['hb_door_lateral_iso', 4, 45], ['hb_sissy_squat', 3, 75], ['hb_towel_curl', 3, 60], ['hb_bw_triceps_extension', 3, 75], ['hb_sliding_leg_curl', 2, 75], ['hb_single_leg_calf_raise', 3, 45]],
};
const fullB: HomeSession = {
  name: 'Em casa · Corpo inteiro B — Posterior + Peito superior + Costas + Braços',
  intro: 'Posterior de coxa primeiro (flexão nórdica), depois peito superior e remada.',
  rows: [['hb_nordic_curl', 3, 90], ['hb_decline_push_up', 3, 90], ['hb_table_row', 3, 90], ['hb_tempo_squat', 3, 90], ['hb_door_lateral_iso', 4, 45], ['hb_table_row_supinated', 3, 90], ['hb_diamond_push_up', 3, 75], ['hb_towel_hammer_curl', 3, 60], ['hb_reverse_crunch', 3, 45]],
};
const fullC: HomeSession = {
  name: 'Em casa · Corpo inteiro C — Braços primeiro + Peito + Costas + Pernas',
  intro: arms.intro,
  rows: [['hb_towel_curl', 3, 60], ['hb_bw_triceps_extension', 3, 60], ['hb_pause_push_up', 3, 75], ['hb_table_row', 3, 90], ['hb_step_up', 3, 75], ['push_up', 3, 75], ['hb_towel_hammer_curl', 2, 60], ['hb_chair_dip', 3, 75], ['hb_sliding_leg_curl', 2, 75], ['hb_bent_knee_calf_raise', 3, 45]],
};

/** Sessão em casa equivalente a cada dia do protocolo, na mesma ordem dos dias. */
export const HOME_SESSIONS: Record<JkkProtocol, HomeSession[]> = {
  jkk: [push, legsA, pull, legsB, arms],
  jkk4: [upperA, legsA4, upperB, legsB4],
  jkk3: [fullA, fullB, fullC],
};

/** Exercícios contados por tempo (segundos) em vez de repetições. */
const TIMED = new Set(['hb_door_lateral_iso', 'hb_towel_wring', 'side_plank']);

export const HOME_TAG = 'EM CASA · PESO DO CORPO';
export const HOME_RULES = [
  'Vá até sobrar 1 repetição (RIR 1); na última série de cada exercício, vá até não conseguir mais com boa técnica.',
  'Descida sempre controlada (3 s). Sem peso, é o tempo sob tensão que faz a série valer.',
  'Bateu o topo da faixa em todas as séries? Não some repetições sem fim: passe para a variação mais difícil indicada.',
  'No campo "Peso", deixe 0 (peso do corpo). Se usar mochila com livros ou garrafas, anote os kg.',
  'Teste a cadeira e a mesa antes de usar: firmes, pesadas e sem rodinhas.',
];
export const HOME_HONEST = 'Em casa dá para manter e até ganhar músculo em peito, ombros, tríceps e pernas. Costas e bíceps são mais limitados sem barra ou peso, então use como plano B — para o seu objetivo, a academia continua sendo o plano A.';

export function hasHomeVersion(config: ProgramConfig): config is ProgramConfig & { protocol: JkkProtocol } {
  return isJkk(config.protocol);
}

export function homeSession(config: ProgramConfig, dayPos: number): { name: string; intro: string; slots: SlotPrescription[] } | null {
  if (!hasHomeVersion(config)) return null;
  const s = HOME_SESSIONS[config.protocol][dayPos];
  if (!s) return null;
  return {
    name: s.name,
    intro: s.intro,
    slots: s.rows.map(([key, sets, restSec], j) => {
      const ex = EXERCISE_BY_KEY[key];
      return {
        slotId: `h${dayPos}s${j}`, exerciseKey: key, sets, repRange: ex.repRange, restSec, rir: 1,
        label: ex.name, note: `${ex.cues} Para progredir: ${HOME_PROGRESSION[key] ?? 'descida mais lenta e mais repetições'}.`,
        tag: HOME_TAG, restText: `${restSec} s`, unit: TIMED.has(key) ? 's' : 'reps',
      };
    }),
  };
}
