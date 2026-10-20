import { EXERCISE_BY_KEY, getExercise, resolveExercise } from './exercises';
import { MIN_WEEKLY_SETS } from './science';
import { OLYMPIA_DAYS, OLYMPIA_PRIORITIES, olympiaPhase } from './olympia';
import { MUSCLE_LABEL, type Muscle, type ProgramConfig, type ProgramDay, type SlotPrescription, type TrainingProfile } from './types';

type SlotTpl = [exerciseKey: string, sets: number, restSec: number];
interface DayTpl { name: string; focus: string; slots: SlotTpl[] }

// Modelos de divisão. Volume moderado por padrão: o objetivo é estímulo suficiente
// com boa recuperação, não o plano "mais difícil".
const TEMPLATES: Record<number, DayTpl[]> = {
  5: [
    { name: 'Superior A', focus: 'Peito, costas, ombros e braços', slots: [
      ['bench_press', 3, 180], ['lat_pulldown', 3, 150], ['incline_db_press', 2, 120], ['chest_supported_row', 3, 120],
      ['db_lateral_raise', 3, 75], ['ez_bar_curl', 3, 90], ['overhead_cable_extension', 3, 90]] },
    { name: 'Inferior A', focus: 'Quadríceps, posteriores, panturrilha e abdômen', slots: [
      ['back_squat', 3, 180], ['romanian_deadlift', 3, 150], ['leg_extension', 2, 90], ['lying_leg_curl', 3, 90],
      ['standing_calf_raise', 3, 75], ['cable_crunch', 3, 75]] },
    { name: 'Braços e ombros', focus: 'Especialização de braços + deltoides', slots: [
      ['incline_db_curl', 3, 90], ['skull_crusher_ez', 3, 90], ['hammer_curl', 3, 90], ['rope_pushdown', 3, 75],
      ['cable_lateral_raise', 4, 60], ['reverse_pec_deck', 3, 60]] },
    { name: 'Superior B', focus: 'Costas, peito e braços', slots: [
      ['incline_smith_press', 3, 150], ['pull_up', 3, 150], ['seated_cable_row', 3, 120], ['cable_fly', 2, 90],
      ['db_shoulder_press', 2, 120], ['bayesian_cable_curl', 3, 75], ['machine_dip', 2, 90]] },
    { name: 'Inferior B + braços', focus: 'Pernas e volume extra de braço', slots: [
      ['hack_squat', 3, 150], ['seated_leg_curl', 3, 90], ['bulgarian_split_squat', 2, 120], ['leg_press_calf', 3, 60],
      ['hanging_leg_raise', 2, 60], ['rope_hammer_curl', 2, 75], ['db_overhead_extension', 2, 75]] },
  ],
  4: [
    { name: 'Superior A', focus: 'Peito, costas, ombros e braços', slots: [
      ['bench_press', 3, 180], ['lat_pulldown', 3, 150], ['incline_db_press', 2, 120], ['chest_supported_row', 3, 120],
      ['db_lateral_raise', 3, 75], ['ez_bar_curl', 3, 90], ['overhead_cable_extension', 3, 90]] },
    { name: 'Inferior A', focus: 'Pernas e abdômen', slots: [
      ['back_squat', 3, 180], ['romanian_deadlift', 3, 150], ['leg_extension', 2, 90], ['lying_leg_curl', 3, 90],
      ['standing_calf_raise', 3, 75], ['cable_crunch', 3, 75]] },
    { name: 'Superior B + braços', focus: 'Costas, peito, deltoides e braços', slots: [
      ['incline_smith_press', 3, 150], ['pull_up', 3, 150], ['seated_cable_row', 2, 120], ['cable_lateral_raise', 3, 60],
      ['incline_db_curl', 3, 90], ['skull_crusher_ez', 3, 90], ['hammer_curl', 2, 75], ['rope_pushdown', 2, 75]] },
    { name: 'Inferior B', focus: 'Pernas', slots: [
      ['hack_squat', 3, 150], ['seated_leg_curl', 3, 90], ['bulgarian_split_squat', 2, 120], ['leg_press_calf', 3, 60],
      ['reverse_pec_deck', 3, 60], ['hanging_leg_raise', 2, 60]] },
  ],
  3: [
    { name: 'Corpo inteiro A', focus: 'Ênfase em peito e braços', slots: [
      ['bench_press', 3, 180], ['back_squat', 3, 180], ['lat_pulldown', 3, 150], ['db_lateral_raise', 3, 75],
      ['ez_bar_curl', 3, 90], ['overhead_cable_extension', 3, 90]] },
    { name: 'Corpo inteiro B', focus: 'Ênfase em costas e posteriores', slots: [
      ['incline_db_press', 3, 120], ['romanian_deadlift', 3, 150], ['seated_cable_row', 3, 120], ['reverse_pec_deck', 2, 60],
      ['hammer_curl', 3, 90], ['rope_pushdown', 3, 75]] },
    { name: 'Corpo inteiro C', focus: 'Ênfase em pernas e ombros', slots: [
      ['hack_squat', 3, 150], ['pull_up', 3, 150], ['machine_chest_press', 2, 120], ['cable_lateral_raise', 3, 60],
      ['incline_db_curl', 3, 90], ['skull_crusher_ez', 3, 90], ['lying_leg_curl', 2, 90]] },
  ],
};

export const DEFAULT_PRIORITIES: Muscle[] = ['biceps', 'triceps', 'brachialis'];

export interface WeekPhase { week: number; label: string; rirCompound: number; rirIsolation: number; prioritySetBonus: number; deload: boolean; assessment: boolean }

/**
 * Ciclo de 8 semanas: entrada conservadora (RIR maior), aproximação gradual da falha,
 * volume extra moderado nos grupos prioritários e deload/reavaliação na semana 8.
 */
export function weekPhase(week: number, totalWeeks = 8): WeekPhase {
  if (week >= totalWeeks) return { week, label: 'Deload e reavaliação', rirCompound: 4, rirIsolation: 3, prioritySetBonus: 0, deload: true, assessment: true };
  const table: Omit<WeekPhase, 'week'>[] = [
    { label: 'Adaptação técnica', rirCompound: 3, rirIsolation: 2, prioritySetBonus: 0, deload: false, assessment: true },
    { label: 'Acumulação', rirCompound: 2, rirIsolation: 2, prioritySetBonus: 0, deload: false, assessment: false },
    { label: 'Acumulação', rirCompound: 2, rirIsolation: 1, prioritySetBonus: 0, deload: false, assessment: false },
    { label: 'Acumulação + avaliação intermediária', rirCompound: 2, rirIsolation: 1, prioritySetBonus: 1, deload: false, assessment: true },
    { label: 'Intensificação', rirCompound: 1, rirIsolation: 1, prioritySetBonus: 1, deload: false, assessment: false },
    { label: 'Intensificação', rirCompound: 1, rirIsolation: 1, prioritySetBonus: 1, deload: false, assessment: false },
    { label: 'Pico de esforço', rirCompound: 1, rirIsolation: 0, prioritySetBonus: 1, deload: false, assessment: false },
  ];
  return { week, ...table[Math.min(week, table.length) - 1] };
}

/** Fase da semana conforme o protocolo do ciclo. */
export function phaseFor(config: Pick<ProgramConfig, 'protocol' | 'deloadWeeks'>, week: number, totalWeeks = 8): WeekPhase {
  if (config.protocol === 'olympia') return olympiaPhase(week, config.deloadWeeks);
  if (config.deloadWeeks?.includes(week)) return { ...weekPhase(totalWeeks, totalWeeks), week, label: 'Deload (aplicado por fadiga/desempenho)', assessment: false };
  return weekPhase(week, totalWeeks);
}

export interface GenerateInput {
  protocol?: 'olympia';
  training: TrainingProfile;
  overrides?: Record<string, string>;
  blocked?: Set<string>;
}

const DEFAULT_DAYS = [1, 2, 3, 4, 5];

export function estimateMinutes(slots: { exerciseKey: string; sets: number; restSec: number }[]): number {
  let total = 5; // aquecimento geral
  let compounds = 0;
  for (const s of slots) {
    const ex = EXERCISE_BY_KEY[s.exerciseKey];
    if (ex?.kind === 'compound') total += compounds++ === 0 ? 4 : 2; // séries de aproximação
    total += (s.sets * (s.restSec + 40)) / 60 + 1;
  }
  return Math.round(total);
}

export function generateProgram({ training, overrides = {}, blocked = new Set(), protocol }: GenerateInput): ProgramConfig {
  const trainingDays = (training.trainingDays?.length ? [...training.trainingDays] : DEFAULT_DAYS).sort((a, b) => a - b);
  const n = protocol === 'olympia' ? 5 : Math.max(3, Math.min(5, trainingDays.length));
  const sessionMinutes = training.sessionMinutes ?? 100;
  const priorities = Array.from(new Set([...(protocol === 'olympia' ? OLYMPIA_PRIORITIES : DEFAULT_PRIORITIES), ...(training.priorities ?? [])]));
  const equipment = training.equipment ?? [];
  const notes: string[] = [];
  if (protocol === 'olympia' && trainingDays.length !== 5) notes.push('O Protocolo Olympia foi desenhado para 5 sessões (seg–sex). Com outros dias, a ordem das sessões é mantida e o ciclo só avança quando cada sessão é feita.');
  if (trainingDays.length > 5) notes.push('Mais de 5 dias informados: o plano usa 5 sessões e os demais dias ficam livres para recuperação.');
  if (!training.equipmentConfirmed) notes.push('Equipamentos ainda não confirmados: exercícios podem ser substituídos na tela de treino.');

  const templates = protocol === 'olympia' ? OLYMPIA_DAYS : TEMPLATES[n];
  const days: ProgramDay[] = templates.map((tpl, i) => {
    let slots: SlotPrescription[] = tpl.slots.map(([key, sets, restSec], j) => {
      const ex = resolveExercise(key, equipment, overrides, blocked);
      return { slotId: `d${i}s${j}`, exerciseKey: ex.key, sets, repRange: ex.repRange, restSec, rir: 2 };
    });
    // Ajuste ao tempo disponível: corta primeiro séries de isoladores não prioritários.
    const fits = () => estimateMinutes(slots) <= sessionMinutes;
    let guard = 0;
    while (!fits() && guard++ < 40) {
      const isPrio = (s: SlotPrescription) => priorities.includes(getExercise(s.exerciseKey).primary);
      const reducible = [...slots].reverse().find((s) => !isPrio(s) && s.sets > 2)
        ?? [...slots].reverse().find((s) => isPrio(s) && s.sets > 2);
      if (reducible) { reducible.sets -= 1; continue; }
      const removable = [...slots].reverse().find((s) => !isPrio(s) && getExercise(s.exerciseKey).kind === 'isolation');
      if (removable) { slots = slots.filter((s) => s !== removable); continue; }
      break;
    }
    return { dayIndex: trainingDays[i % trainingDays.length] ?? i + 1, name: tpl.name, focus: tpl.focus, slots };
  });
  ensurePriorityVolume(days, priorities, sessionMinutes, notes);
  const longest = Math.max(...days.map((d) => estimateMinutes(d.slots)));
  if (longest < sessionMinutes - 15) {
    notes.push(`Sessões estimadas em até ${longest} min (você tem ~${sessionMinutes}). É proposital: o volume já é suficiente e mais séries tendem a piorar a recuperação. Use a sobra para aquecimento, mobilidade ou descanso completo entre séries.`);
  }
  if (days.some((d) => estimateMinutes(d.slots) > sessionMinutes)) {
    notes.push('Mesmo reduzido, algum dia passa do tempo disponível; considere aumentar o tempo ou aceitar menos exercícios.');
  }
  return { version: 1, trainingDays: Array.from(new Set(days.map((d) => d.dayIndex))), sessionMinutes, priorities, equipment, days, notes, ...(protocol ? { protocol, deloadWeeks: [] } : {}) };
}

/** Séries semanais base (sem bônus de fase): direto = 1, secundário = 0,5. */
export function baseWeeklySets(days: ProgramDay[]): Partial<Record<Muscle, number>> {
  const vol: Partial<Record<Muscle, number>> = {};
  days.forEach((d) => d.slots.forEach((s) => {
    const ex = getExercise(s.exerciseKey);
    vol[ex.primary] = (vol[ex.primary] ?? 0) + s.sets;
    ex.secondary.forEach((m) => { vol[m] = (vol[m] ?? 0) + s.sets * 0.5; });
  }));
  return vol;
}

/**
 * Garante ≥10 séries semanais nos músculos prioritários (Tabela 6.1, CREF4/SC 2019), somando
 * 1 série por vez ao exercício direto com menos séries (máx. 4 por exercício) enquanto couber no tempo.
 */
export function ensurePriorityVolume(days: ProgramDay[], priorities: Muscle[], sessionMinutes: number, notes: string[]): void {
  for (const m of priorities) {
    let guard = 0;
    while ((baseWeeklySets(days)[m] ?? 0) < MIN_WEEKLY_SETS && guard++ < 20) {
      const cands = days.flatMap((d) => d.slots.filter((s) => getExercise(s.exerciseKey).primary === m && s.sets < 4).map((s) => ({ d, s })))
        .filter(({ d, s }) => { s.sets += 1; const ok = estimateMinutes(d.slots) <= sessionMinutes; s.sets -= 1; return ok; })
        .sort((a, b) => a.s.sets - b.s.sets);
      if (!cands.length) break;
      cands[0].s.sets += 1;
    }
    const v = baseWeeklySets(days)[m] ?? 0;
    const hasDirect = days.some((d) => d.slots.some((s) => getExercise(s.exerciseKey).primary === m));
    if (hasDirect && v < MIN_WEEKLY_SETS) {
      notes.push(`${MUSCLE_LABEL[m]} ficou com ~${v.toLocaleString('pt-BR')} séries semanais (meta ≥${MIN_WEEKLY_SETS}): o tempo da sessão ou o teto de 4 séries por exercício limitou. Mais minutos por sessão ou mais dias de treino permitiriam completar.`);
    }
  }
}

/** Prescrição da semana: aplica RIR da fase, bônus de séries nos prioritários e deload. */
export function prescribeDay(config: ProgramConfig, dayPos: number, week: number, totalWeeks = 8): SlotPrescription[] {
  const phase = phaseFor(config, week, totalWeeks);
  const seenPriority = new Set<Muscle>();
  // O bônus vai para a 1ª ocorrência de cada músculo prioritário na semana (+1 série/semana/músculo).
  const firstOccurrence = new Set<string>();
  config.days.forEach((d) => d.slots.forEach((s) => {
    const m = getExercise(s.exerciseKey).primary;
    if (config.priorities.includes(m) && !seenPriority.has(m)) { seenPriority.add(m); firstOccurrence.add(s.slotId); }
  }));
  return config.days[dayPos].slots.map((s) => {
    const ex = getExercise(s.exerciseKey);
    let sets = s.sets + (firstOccurrence.has(s.slotId) ? phase.prioritySetBonus : 0);
    if (phase.deload) sets = Math.max(1, Math.ceil(s.sets / 2));
    return { ...s, sets, rir: ex.kind === 'compound' ? phase.rirCompound : phase.rirIsolation };
  });
}

/** Volume semanal planejado (séries diretas = 1, músculo secundário = 0,5). */
export function plannedWeeklyVolume(config: ProgramConfig, week: number, totalWeeks = 8): Partial<Record<Muscle, number>> {
  const vol: Partial<Record<Muscle, number>> = {};
  config.days.forEach((_, i) => prescribeDay(config, i, week, totalWeeks).forEach((s) => {
    const ex = getExercise(s.exerciseKey);
    vol[ex.primary] = (vol[ex.primary] ?? 0) + s.sets;
    ex.secondary.forEach((m) => { vol[m] = (vol[m] ?? 0) + s.sets * 0.5; });
  }));
  return vol;
}

export function warmupFor(exKey: string, isFirstCompound: boolean): string {
  const ex = getExercise(exKey);
  if (ex.kind === 'compound' && isFirstCompound) return '5–15 min de aquecimento geral (bike/esteira + mobilidade) + específico: ~40% × 8, ~60% × 5, ~80% × 2–3 da carga de trabalho.';
  if (ex.kind === 'compound') return 'Aproximação: ~60% × 5 e ~80% × 2 da carga de trabalho.';
  return '1 série leve de 10–12 se for o primeiro exercício desse músculo hoje.';
}
