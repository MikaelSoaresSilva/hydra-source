import { addDays, todayISO } from './domain/dates';
import { getExercise, resolveExercise } from './domain/exercises';
import { calculateTargets } from './domain/nutrition';
import { generateProgram, phaseFor, prescribeDay, warmupFor } from './domain/program';
import { OLYMPIA_WEEKS } from './domain/olympia';
import { JKK_WEEKS, generateJkk } from './domain/jkk';
import { groupHistory, suggestProgression } from './domain/progression';
import { applyReadiness } from './domain/science';
import type { DataStore } from './data/store';
import { uuid } from './data/store';
import type {
  CheckinRow, OverrideRow, PlannedExercise, Profile, ProgramRow, SessionRow, SetLogRow, TargetRow,
} from './domain/types';

export function overridesMap(rows: OverrideRow[]) {
  const map: Record<string, string> = {};
  const blocked = new Set<string>();
  rows.forEach((r) => { map[r.exercise_key] = r.replacement_key; if (r.replacement_key !== r.exercise_key) blocked.add(r.exercise_key); });
  return { map, blocked };
}

export async function createProgram(store: DataStore, profile: Profile, startDate = todayISO(), protocol?: 'olympia' | 'jkk'): Promise<ProgramRow> {
  const old = await store.list<ProgramRow>('programs', { eq: { status: 'active' } });
  for (const p of old) await store.upsert('programs', { ...p, status: 'archived' });
  let row: ProgramRow;
  if (protocol === 'jkk') {
    row = { id: uuid(), user_id: store.userId, name: 'Protocolo JKK', start_date: startDate, weeks: JKK_WEEKS, config: generateJkk(), status: 'active' };
  } else {
    // Protocolo travado: trocas pessoais antigas não entram no plano.
    const ov = protocol === 'olympia' ? { map: {}, blocked: new Set<string>() } : overridesMap(await store.list<OverrideRow>('exercise_overrides'));
    const config = generateProgram({ training: profile.training, overrides: ov.map, blocked: ov.blocked, protocol });
    row = protocol === 'olympia'
      ? { id: uuid(), user_id: store.userId, name: 'Protocolo Olympia — 60 dias', start_date: startDate, weeks: OLYMPIA_WEEKS, config, status: 'active' }
      : { id: uuid(), user_id: store.userId, name: 'Ciclo de hipertrofia — 8 semanas', start_date: startDate, weeks: 8, config, status: 'active' };
  }
  await store.upsert('programs', row as unknown as Record<string, unknown>);
  return row;
}

export function profileReadyForTargets(p: Profile | null): string[] {
  const missing: string[] = [];
  if (!p?.nutrition.weightKg) missing.push('peso');
  if (!p?.height_cm) missing.push('altura');
  if (!p?.age) missing.push('idade');
  if (!p?.sex) missing.push('sexo');
  return missing;
}

export async function createTargets(store: DataStore, p: Profile, reason?: string, kcalOverride?: number): Promise<TargetRow> {
  const t = calculateTargets({
    weightKg: p.nutrition.weightKg!, heightCm: p.height_cm!, age: p.age!, sex: p.sex!,
    activityLevel: p.nutrition.activityLevel ?? 'moderate', experienceMonths: p.training.experienceMonths,
  });
  let { kcal, carbsG } = t;
  if (kcalOverride) {
    carbsG = Math.max(0, carbsG + Math.round((kcalOverride - kcal) / 4));
    kcal = kcalOverride;
  }
  const row: TargetRow = {
    id: uuid(), user_id: store.userId, effective_from: todayISO(), kcal, protein_g: t.proteinG, carbs_g: carbsG, fat_g: t.fatG,
    rationale: reason ?? t.explanation.join('\n'),
    inputs: { weightKg: p.nutrition.weightKg, heightCm: p.height_cm, age: p.age, activity: p.nutrition.activityLevel ?? 'moderate', weeklyGainKg: t.weeklyGainKg, tdee: t.tdee, tdeeRange: t.tdeeRange, surplus: t.surplus },
  };
  await store.upsert('nutrition_targets', row as unknown as Record<string, unknown>);
  return row;
}

export function recoveryScore(checkins: CheckinRow[], today = todayISO()): number | null {
  const recent = checkins.filter((c) => c.date > addDays(today, -4) && c.recovery !== null);
  return recent.length ? recent.reduce((s, c) => s + (c.recovery ?? 0), 0) / recent.length : null;
}

/** Monta a sessão do dia: exercício efetivo, prescrição da semana e sugestão de carga pelo histórico. */
export function buildSessionPlan(
  program: ProgramRow, week: number, dayPos: number, overrides: OverrideRow[], logs: SetLogRow[], recScore: number | null,
): PlannedExercise[] {
  const ov = program.config.locked ? { map: {}, blocked: new Set<string>() } : overridesMap(overrides);
  let firstCompound = true;
  const jkk = program.config.protocol === 'jkk';
  return prescribeDay(program.config, dayPos, week, program.weeks).map((s, idx) => {
    const ex = resolveExercise(s.exerciseKey, program.config.equipment, ov.map, ov.blocked);
    // Protocolo importado: a faixa de repetições é a do documento, não a padrão do exercício.
    const repRange = jkk ? s.repRange : ex.repRange;
    const sug = suggestProgression({ ...ex, repRange }, s.rir, groupHistory(logs, ex.key), { recoveryScore: recScore });
    const warmup = jkk
      ? (idx === 0 ? 'Antes do primeiro exercício de cada dia, faça 2 séries leves (50% e 75% da carga).' : '')
      : warmupFor(ex.key, ex.kind === 'compound' && firstCompound);
    if (ex.kind === 'compound') firstCompound = false;
    const deload = phaseFor(program.config, week, program.weeks).deload;
    // JKK: deload com metade das séries e as MESMAS cargas; demais protocolos: ~85% da carga.
    const load = sug.load !== null && deload && !jkk ? Math.round((sug.load * 0.85) / (ex.increment || 0.5)) * (ex.increment || 0.5) : sug.load;
    return {
      ...s, exerciseKey: ex.key, repRange, name: s.label && ex.key === s.exerciseKey ? s.label : ex.name, muscle: ex.primary,
      loadSuggestion: load,
      suggestionReason: deload ? (jkk ? `Deload: metade das séries, mesmas cargas. ${sug.reason}` : `Deload: ~85% da carga habitual, longe da falha. ${sug.reason}`) : sug.reason,
      warmup,
    };
  });
}

export async function startSession(store: DataStore, program: ProgramRow, sequence: number, overrides: OverrideRow[], logs: SetLogRow[], recScore: number | null, tqr: number | null = null): Promise<SessionRow> {
  const perWeek = program.config.days.length;
  const week = Math.floor(sequence / perWeek) + 1;
  const dayPos = sequence % perWeek;
  const existing = (await store.list<SessionRow>('workout_sessions', { eq: { program_id: program.id, sequence } }))[0];
  if (existing) return existing;
  const row: SessionRow = {
    id: uuid(), user_id: store.userId, program_id: program.id, week, day_index: program.config.days[dayPos].dayIndex, sequence,
    scheduled_date: todayISO(), status: 'in_progress', started_at: new Date().toISOString(), completed_at: null,
    fatigue: null, session_rpe: null, pain_notes: null, notes: null,
    exercises: buildSessionPlan(program, week, dayPos, overrides, logs, recScore),
    readiness: null,
  };
  if (tqr !== null) {
    const adj = applyReadiness(row.exercises, tqr);
    row.exercises = adj.slots.map((e) => (adj.readiness.adjusted ? { ...e, suggestionReason: `Prontidão baixa (TQR ${adj.readiness.tqr}): −1 série, +1 RIR hoje. ${e.suggestionReason}` } : e));
    row.readiness = adj.readiness;
  }
  await store.upsert('workout_sessions', row as unknown as Record<string, unknown>);
  return row;
}

export function exerciseName(key: string) {
  try { return getExercise(key).name; } catch { return key; }
}

/** Remove metadados (EXIF/GPS) e reduz a imagem re-codificando via canvas. */
export async function sanitizeImage(file: File, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao processar a imagem'))), 'image/jpeg', 0.85));
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Marca a semana como deload (decisão baseada em fadiga/desempenho, não no calendário). */
export async function applyDeload(store: DataStore, program: ProgramRow, week: number): Promise<void> {
  const weeks = Array.from(new Set([...(program.config.deloadWeeks ?? []), week])).sort((a, b) => a - b);
  await store.upsert('programs', { ...program, config: { ...program.config, deloadWeeks: weeks } } as unknown as Record<string, unknown>);
}

/** Atualiza um Protocolo Olympia antigo para a versão atual no mesmo ciclo (mantém semana, histórico e deloads). */
export async function upgradeOlympia(store: DataStore, program: ProgramRow, profile: Profile): Promise<void> {
  const config = generateProgram({ training: profile.training, protocol: 'olympia' });
  await store.upsert('programs', { ...program, config: { ...config, deloadWeeks: program.config.deloadWeeks ?? [] } } as unknown as Record<string, unknown>);
}
