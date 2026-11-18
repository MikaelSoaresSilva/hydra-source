// Revisão automática do treino de 4 dias após cada medição.
// Princípio: MUDAR SÓ SE NECESSÁRIO, e só o exercício (séries, faixas, descansos e dias ficam iguais).
//
// Um exercício só é trocado quando há motivo concreto nos registros:
//  1. Dor ≥ 4/10 em duas sessões seguidas com ele (segurança).
//  2. Estagnação: o 1RM estimado não subiu em 4 sessões (sem ser fadiga — fadiga é caso de deload)
//     E a medida da região que ele trabalha não cresceu em ≥ 28 dias (crescimento < 0,5 cm = erro de medida).
//     Se a região está crescendo, o exercício fica, mesmo parado na carga: o resultado está vindo.
// Limites: no máximo 2 trocas por revisão (prioridade: dor > músculos prioritários > demais),
// e um exercício trocado não é trocado de novo antes de 28 dias.
import { addDays } from './dates';
import { EXERCISE_BY_KEY } from './exercises';
import { decliningExercises, groupHistory, stalledExercises } from './progression';
import type { ExerciseChange, MetricRow, Muscle, ProgramConfig, ProgramRevision, SetLogRow } from './types';

/** Variações equivalentes (mesmo músculo e papel no treino), em ordem de preferência. */
export const VARIATIONS: Record<string, string[]> = {
  incline_db_press: ['incline_bench_press', 'incline_smith_press'],
  incline_smith_press: ['incline_bench_press', 'incline_db_press'],
  low_high_cable_fly: ['pec_deck', 'db_fly'],
  db_bench_press: ['bench_press', 'machine_chest_press'],
  cable_fly: ['pec_deck', 'db_fly'],
  lat_pulldown: ['pull_up', 'machine_pulldown'],
  chest_supported_row: ['db_row', 'seated_cable_row'],
  seated_cable_row: ['barbell_row', 'db_row'],
  straight_arm_pulldown: ['machine_pulldown', 'lat_pulldown'],
  cable_lateral_raise: ['machine_lateral_raise', 'db_lateral_raise'],
  db_lateral_raise: ['machine_lateral_raise', 'cable_lateral_raise'],
  overhead_cable_extension: ['db_overhead_extension', 'skull_crusher_ez'],
  skull_crusher_ez: ['close_grip_bench', 'bar_pushdown'],
  db_overhead_extension: ['overhead_cable_extension', 'skull_crusher_ez'],
  rope_pushdown: ['bar_pushdown', 'machine_dip'],
  incline_db_curl: ['bayesian_cable_curl', 'db_curl'],
  preacher_curl_machine: ['cable_curl', 'ez_bar_curl'],
  bayesian_cable_curl: ['incline_db_curl', 'cable_curl'],
  hammer_curl: ['rope_hammer_curl'],
  reverse_curl_ez: ['rope_hammer_curl', 'hammer_curl'],
  back_squat: ['hack_squat', 'smith_squat'],
  leg_press: ['hack_squat', 'smith_squat'],
  hack_squat: ['leg_press', 'smith_squat'],
  bulgarian_split_squat: ['leg_press', 'smith_squat'],
  seated_leg_curl: ['lying_leg_curl'],
  standing_leg_curl: ['lying_leg_curl', 'seated_leg_curl'],
  romanian_deadlift: ['db_rdl'],
  standing_calf_raise: ['leg_press_calf', 'db_calf_raise'],
  seated_calf_raise: ['leg_press_calf', 'standing_calf_raise'],
  hanging_leg_raise: ['crunch'],
  cable_crunch: ['crunch'],
};

/** Medida que mostra se o músculo está crescendo (null = sem medida confiável: só dor troca). */
type MetricKey = keyof MetricRow;
const REGION: Partial<Record<Muscle, { label: string; keys: MetricKey[] }>> = {
  biceps: { label: 'braço', keys: ['arm_right_cm', 'arm_left_cm', 'arm_right_relaxed_cm', 'arm_left_relaxed_cm'] },
  brachialis: { label: 'braço', keys: ['arm_right_cm', 'arm_left_cm', 'arm_right_relaxed_cm', 'arm_left_relaxed_cm'] },
  triceps: { label: 'braço', keys: ['arm_right_relaxed_cm', 'arm_left_relaxed_cm', 'arm_right_cm', 'arm_left_cm'] },
  forearms: { label: 'antebraço', keys: ['forearm_right_cm', 'forearm_left_cm'] },
  chest: { label: 'peitoral', keys: ['chest_cm'] },
  side_delts: { label: 'ombros', keys: ['shoulders_cm'] },
  back: { label: 'ombros/costas', keys: ['shoulders_cm', 'chest_cm'] },
  quads: { label: 'coxa', keys: ['thigh_cm', 'thigh_left_cm'] },
  hamstrings: { label: 'coxa', keys: ['thigh_cm', 'thigh_left_cm'] },
  glutes: { label: 'quadril', keys: ['hip_cm'] },
  calves: { label: 'panturrilha', keys: ['calf_right_cm', 'calf_left_cm'] },
};

export const MIN_GROWTH_CM = 0.5; // abaixo disso é erro de medida
export const WINDOW_DAYS = 28;
export const MAX_CHANGES = 2;
const PRIORITY: Muscle[] = ['biceps', 'triceps', 'brachialis', 'side_delts', 'back', 'chest', 'quads'];

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

/** Crescimento (cm) da região entre a medição mais recente e uma de ≥ 28 dias antes; null se não dá para comparar. */
export function regionGrowth(metrics: MetricRow[], muscle: Muscle, today: string): { growth: number; label: string; from: string; to: string } | null {
  const region = REGION[muscle];
  if (!region) return null;
  const sorted = [...metrics].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const key of region.keys) {
    const withKey = sorted.filter((m) => num(m[key]) !== null && m.date <= today);
    const latest = withKey[0];
    if (!latest) continue;
    const old = withKey.find((m) => m.date <= addDays(latest.date, -WINDOW_DAYS));
    if (!old) continue;
    return { growth: Math.round((num(latest[key])! - num(old[key])!) * 10) / 10, label: region.label, from: old.date, to: latest.date };
  }
  return null;
}

function recurringPain(logs: SetLogRow[], key: string): boolean {
  const h = groupHistory(logs, key).slice(0, 2);
  return h.length === 2 && h.every((p) => p.sets.some((s) => s.pain >= 4));
}

export interface ReviewInput { config: ProgramConfig; metrics: MetricRow[]; logs: SetLogRow[]; today: string; metricId?: string | null }

/** Avalia o treino com os dados atuais. Não altera nada: devolve o novo config (ou o mesmo) e o relatório. */
export function reviewProgram({ config, metrics, logs, today, metricId = null }: ReviewInput): { config: ProgramConfig; revision: ProgramRevision } {
  const recent = logs.filter((l) => l.logged_at.slice(0, 10) >= addDays(today, -120));
  const stalled = new Set(stalledExercises(recent));
  const declining = new Set(decliningExercises(recent.filter((l) => l.logged_at.slice(0, 10) >= addDays(today, -28))));
  const kept: string[] = [];
  const notes: string[] = [];
  type Cand = { dayIdx: number; slotIdx: number; reason: string; rank: number };
  const cands: Cand[] = [];

  config.days.forEach((d, dayIdx) => d.slots.forEach((s, slotIdx) => {
    const ex = EXERCISE_BY_KEY[s.exerciseKey];
    if (!ex) return;
    const name = s.label ?? ex.name;
    if (s.changedOn && s.changedOn > addDays(today, -WINDOW_DAYS)) return; // trocado há pouco: dar tempo
    if (recurringPain(recent, s.exerciseKey)) {
      cands.push({ dayIdx, slotIdx, rank: 0, reason: 'dor ≥ 4/10 em duas sessões seguidas' });
      return;
    }
    if (!stalled.has(s.exerciseKey)) return;
    if (declining.has(s.exerciseKey)) { kept.push(`${name}: carga caindo junto com outros sinais de fadiga — é caso de recuperação/deload, não de trocar exercício.`); return; }
    const g = regionGrowth(metrics, ex.primary, today);
    if (!g) { kept.push(`${name}: parado há 4 sessões, mas ainda não há medida de ${REGION[ex.primary]?.label ?? 'região'} com 28 dias de intervalo para comparar — mantido.`); return; }
    if (g.growth >= MIN_GROWTH_CM) { kept.push(`${name}: carga parada, mas ${g.label} cresceu ${g.growth.toLocaleString('pt-BR')} cm desde ${g.from.split('-').reverse().join('/')} — o resultado está vindo, mantido.`); return; }
    const prio = PRIORITY.indexOf(ex.primary);
    cands.push({ dayIdx, slotIdx, rank: prio >= 0 ? 1 + prio : 20, reason: `sem progresso em 4 sessões e ${g.label} sem crescer (${g.growth >= 0 ? '+' : ''}${g.growth.toLocaleString('pt-BR')} cm em ${WINDOW_DAYS}+ dias)` });
  }));

  cands.sort((a, b) => a.rank - b.rank);
  const days = config.days.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s })) }));
  const changes: ExerciseChange[] = [];
  for (const c of cands) {
    if (changes.length >= MAX_CHANGES) {
      const s = days[c.dayIdx].slots[c.slotIdx];
      kept.push(`${s.label ?? EXERCISE_BY_KEY[s.exerciseKey]?.name}: também precisaria trocar (${c.reason}), mas o limite é ${MAX_CHANGES} trocas por vez — revisado na próxima medição.`);
      continue;
    }
    const day = days[c.dayIdx];
    const slot = day.slots[c.slotIdx];
    const inDay = new Set(day.slots.map((x) => x.exerciseKey));
    const to = (VARIATIONS[slot.exerciseKey] ?? []).find((k) => EXERCISE_BY_KEY[k] && !inDay.has(k));
    const fromName = slot.label ?? EXERCISE_BY_KEY[slot.exerciseKey].name;
    if (!to) { kept.push(`${fromName}: ${c.reason}, mas não há variação equivalente disponível — mantido; use "Aparelho indisponível" se precisar.`); continue; }
    const next = EXERCISE_BY_KEY[to];
    changes.push({ slotId: slot.slotId, day: day.name, from: slot.exerciseKey, to, fromName, toName: next.name, reason: c.reason });
    day.slots[c.slotIdx] = {
      ...slot, exerciseKey: to, label: next.name, originalKey: slot.originalKey ?? slot.exerciseKey, changedOn: today,
      note: `${next.cues} (Troca automática no lugar de "${fromName}": ${c.reason}.)`, tag: 'TROCA AUTOMÁTICA',
    };
  }

  if (!changes.length && !kept.length) notes.push('Todos os exercícios estão progredindo ou ainda não há dados suficientes para justificar mudança. Treino mantido.');
  // Peso e cintura: avaliados, mas mudam a dieta, não os exercícios.
  const byDate = [...metrics].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latestWaist = byDate.find((m) => num(m.waist_cm) !== null);
  const oldWaist = latestWaist && byDate.find((m) => num(m.waist_cm) !== null && m.date <= addDays(latestWaist.date, -WINDOW_DAYS));
  const arm = regionGrowth(metrics, 'biceps', today);
  if (latestWaist && oldWaist) {
    const dw = Math.round((num(latestWaist.waist_cm)! - num(oldWaist.waist_cm)!) * 10) / 10;
    if (dw >= 1.5 && (!arm || arm.growth < MIN_GROWTH_CM)) notes.push(`Cintura +${dw.toLocaleString('pt-BR')} cm em ${WINDOW_DAYS}+ dias sem o braço crescer: isso é dieta, não exercício — reduza 100–150 kcal/dia.`);
    else if (dw <= -1) notes.push(`Cintura ${dw.toLocaleString('pt-BR')} cm: o flanco está saindo. Se as cargas seguem subindo, mantenha a dieta.`);
  }
  const weights = byDate.filter((m) => num(m.weight_kg) !== null);
  if (weights.length >= 2) {
    const oldW = weights.find((m) => m.date <= addDays(weights[0].date, -WINDOW_DAYS));
    if (oldW) {
      const dkg = Math.round((num(weights[0].weight_kg)! - num(oldW.weight_kg)!) * 10) / 10;
      notes.push(`Peso: ${dkg >= 0 ? '+' : ''}${dkg.toLocaleString('pt-BR')} kg desde ${oldW.date.split('-').reverse().join('/')}.`);
    }
  }
  if (!byDate.some((m) => m.date <= addDays(byDate[0]?.date ?? today, -WINDOW_DAYS))) {
    notes.push('Ainda não há duas medições com 28 dias de intervalo: esta serve de linha de base. Meça de novo daqui a 2–4 semanas, nas mesmas condições.');
  }

  const revision: ProgramRevision = { date: today, metricId, changes, kept, notes };
  return { config: changes.length ? { ...config, days } : config, revision };
}
