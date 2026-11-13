import { Capacitor } from '@capacitor/core';
import { addDays, todayISO } from './domain/dates';
import { getExercise, resolveExercise } from './domain/exercises';
import { calculateTargets } from './domain/nutrition';
import { generateProgram, phaseFor, prescribeDay, warmupFor } from './domain/program';
import { OLYMPIA_WEEKS } from './domain/olympia';
import { JKK_WEEKS, generateJkk } from './domain/jkk';
import { reviewProgram } from './domain/autoReview';
import { hasHomeVersion, homeSession } from './domain/home';
import { groupHistory, suggestProgression } from './domain/progression';
import { applyReadiness } from './domain/science';
import type { DataStore } from './data/store';
import { uuid } from './data/store';
import { isJkk } from './domain/types';
import type {
  CheckinRow, JkkProtocol, MetricRow, OverrideRow, PlannedExercise, Profile, ProgramRevision, ProgramRow, SessionRow, SetLogRow, TargetRow,
} from './domain/types';

export function overridesMap(rows: OverrideRow[]) {
  const map: Record<string, string> = {};
  const blocked = new Set<string>();
  rows.forEach((r) => { map[r.exercise_key] = r.replacement_key; if (r.replacement_key !== r.exercise_key) blocked.add(r.exercise_key); });
  return { map, blocked };
}

export async function createProgram(store: DataStore, profile: Profile, startDate = todayISO(), protocol?: 'olympia' | JkkProtocol): Promise<ProgramRow> {
  const old = await store.list<ProgramRow>('programs', { eq: { status: 'active' } });
  for (const p of old) await store.upsert('programs', { ...p, status: 'archived' });
  let row: ProgramRow;
  if (isJkk(protocol)) {
    row = { id: uuid(), user_id: store.userId, name: protocol === 'jkk4' ? 'Protocolo JKK — 4 dias' : protocol === 'jkk3' ? 'Protocolo JKK — 3 dias' : 'Protocolo JKK', start_date: startDate, weeks: JKK_WEEKS, config: generateJkk(protocol), status: 'active' };
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
  const jkk = isJkk(program.config.protocol);
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

/** Sessão em casa (peso do corpo) equivalente ao dia do protocolo; null se o protocolo não tem versão em casa. */
export function buildHomePlan(program: ProgramRow, week: number, dayPos: number, logs: SetLogRow[]): PlannedExercise[] | null {
  const home = homeSession(program.config, dayPos);
  if (!home) return null;
  const deload = phaseFor(program.config, week, program.weeks).deload;
  return home.slots.map((s, idx) => {
    const ex = getExercise(s.exerciseKey);
    const history = groupHistory(logs, ex.key);
    const sug = suggestProgression(ex, s.rir, history);
    const lastLoad = history[0] ? Math.max(0, ...history[0].sets.filter((x) => x.kind === 'working').map((x) => Number(x.load_kg))) : 0;
    return {
      ...s, sets: deload ? Math.max(1, Math.ceil(s.sets / 2)) : s.sets, name: ex.name, muscle: ex.primary,
      loadSuggestion: lastLoad, // 0 = só o peso do corpo
      suggestionReason: history.length ? sug.reason : `Primeira vez: faça ${s.repRange[0]}–${s.repRange[1]}${s.unit === 's' ? ' s' : ' repetições'} parando com ~1 sobrando. Se não chegar em ${s.repRange[0]}, use a versão mais fácil.`,
      warmup: idx === 0 ? '5 min de aquecimento: polichinelos, círculos de braço, agachamentos leves e 1 série fácil do primeiro exercício.' : '',
    };
  });
}

export async function startSession(store: DataStore, program: ProgramRow, sequence: number, overrides: OverrideRow[], logs: SetLogRow[], recScore: number | null, tqr: number | null = null, place: 'gym' | 'home' = 'gym'): Promise<SessionRow> {
  const perWeek = program.config.days.length;
  const week = Math.floor(sequence / perWeek) + 1;
  const dayPos = sequence % perWeek;
  const existing = (await store.list<SessionRow>('workout_sessions', { eq: { program_id: program.id, sequence } }))[0];
  if (existing) return existing;
  const row: SessionRow = {
    id: uuid(), user_id: store.userId, program_id: program.id, week, day_index: program.config.days[dayPos].dayIndex, sequence,
    scheduled_date: todayISO(), status: 'in_progress', started_at: new Date().toISOString(), completed_at: null,
    fatigue: null, session_rpe: null, pain_notes: null, notes: null,
    exercises: (place === 'home' ? buildHomePlan(program, week, dayPos, logs) : null) ?? buildSessionPlan(program, week, dayPos, overrides, logs, recScore),
    readiness: null,
    location: place === 'home' && hasHomeVersion(program.config) ? 'home' : 'gym',
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

/**
 * Exporta o backup. No APK, o download por link não funciona dentro do app: o arquivo é gravado
 * e aberto na folha de compartilhamento do Android (salvar em Arquivos, Drive, WhatsApp…).
 */
export async function exportBackup(data: unknown, filename: string): Promise<'shared' | 'downloaded'> {
  if (!Capacitor.isNativePlatform()) { downloadJSON(data, filename); return 'downloaded'; }
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const res = await Filesystem.writeFile({ path: filename, data: JSON.stringify(data), directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: 'Backup do Titan', text: 'Backup dos seus dados do Titan', files: [res.uri], dialogTitle: 'Salvar o backup em…' });
  return 'shared';
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

/**
 * Troca o treino ativo. Se esse protocolo já foi usado antes (ciclo arquivado), ele volta de onde
 * parou — mesma semana e histórico; senão, um ciclo novo começa hoje.
 */
export async function activateProtocol(store: DataStore, profile: Profile, protocol: JkkProtocol): Promise<ProgramRow> {
  const archived = (await store.list<ProgramRow>('programs', { eq: { status: 'archived' } }))
    .filter((p) => p.config.protocol === protocol)
    .sort((a, b) => ((a.updated_at ?? a.created_at ?? '') < (b.updated_at ?? b.created_at ?? '') ? 1 : -1))[0];
  if (!archived) return createProgram(store, profile, todayISO(), protocol);
  const active = await store.list<ProgramRow>('programs', { eq: { status: 'active' } });
  for (const p of active) await store.upsert('programs', { ...p, status: 'archived' });
  const restored = { ...archived, status: 'active' as const };
  await store.upsert('programs', restored as unknown as Record<string, unknown>);
  return restored;
}

/**
 * Depois de cada medição: reavalia o treino de 4 dias e troca exercícios só quando necessário
 * (regras em domain/autoReview). Guarda o relatório no ciclo, mesmo quando nada muda.
 */
export async function reviewAfterMeasurement(store: DataStore, metricId: string | null, today = todayISO()): Promise<ProgramRevision | null> {
  const program = (await store.list<ProgramRow>('programs', { eq: { status: 'active' } }))[0];
  // Só as versões montadas pelo app (4 e 3 dias) são ajustadas; o JKK de 5 dias fica fiel ao PDF.
  if (!program || (program.config.protocol !== 'jkk4' && program.config.protocol !== 'jkk3')) return null;
  const metrics = await store.list<MetricRow>('body_metrics');
  const logs = await store.list<SetLogRow>('set_logs', { gte: { logged_at: addDays(today, -120) } });
  const { config, revision } = reviewProgram({ config: program.config, metrics, logs, today, metricId });
  const revisions = [...(program.config.revisions ?? []), revision].slice(-20);
  await store.upsert('programs', { ...program, config: { ...config, revisions } } as unknown as Record<string, unknown>);
  return revision;
}

/**
 * Fase da dieta (do Protocolo JKK, seção "Flancos"): recomposição = −300 a −400 kcal/dia por 8–12 semanas;
 * ganho limpo = +200 a +300 kcal/dia. Proteína 1,8–2,2 g/kg. A meta continua sendo ajustada pela média de peso.
 */
export async function applyNutritionPhase(store: DataStore, p: Profile, phase: 'recomp' | 'lean_gain'): Promise<TargetRow> {
  const t = calculateTargets({
    weightKg: p.nutrition.weightKg!, heightCm: p.height_cm!, age: p.age!, sex: p.sex!,
    activityLevel: p.nutrition.activityLevel ?? 'moderate', experienceMonths: p.training.experienceMonths,
  });
  const w = p.nutrition.weightKg!;
  const delta = phase === 'recomp' ? -350 : 250;
  const kcal = Math.round((t.tdee + delta) / 50) * 50;
  const proteinG = Math.round(w * (phase === 'recomp' ? 2.0 : 1.8));
  const fatG = Math.max(Math.round(w * 0.8), Math.round((kcal * 0.2) / 9));
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const weeklyGainKg = Math.round(((delta * 7) / 7700) * 100) / 100;
  const rationale = phase === 'recomp'
    ? [
      `Fase 1 · Recomposição: gasto estimado ~${t.tdee} kcal − 350 = ${kcal} kcal (faixa do protocolo: −300 a −400 kcal/dia, por 8–12 semanas).`,
      `Proteína ${proteinG} g (2,0 g/kg) para manter e ganhar músculo em déficit; gordura ${fatG} g; carboidratos ${carbsG} g, concentrados antes e depois do treino.`,
      `Ritmo esperado: cerca de ${Math.abs(weeklyGainKg).toLocaleString('pt-BR')} kg a menos por semana. Mais rápido que o dobro disso por 2 semanas, o app sugere subir as calorias.`,
      'Gordura não sai de um lugar escolhido: flanco e rosto afinam junto com o resto do corpo. Acompanhe a cintura a cada 2 semanas.',
    ]
    : [
      `Fase 2 · Ganho limpo: gasto estimado ~${t.tdee} kcal + 250 = ${kcal} kcal (faixa do protocolo: +200 a +300 kcal/dia).`,
      `Proteína ${proteinG} g (1,8 g/kg); gordura ${fatG} g; carboidratos ${carbsG} g.`,
      'Se a cintura subir 1,5 cm em 4 semanas sem o braço crescer, reduza 100–150 kcal.',
    ];
  const row: TargetRow = {
    id: uuid(), user_id: store.userId, effective_from: todayISO(), kcal, protein_g: proteinG, carbs_g: carbsG, fat_g: fatG,
    rationale: rationale.join('\n'),
    inputs: { weightKg: w, heightCm: p.height_cm, age: p.age, activity: p.nutrition.activityLevel ?? 'moderate', weeklyGainKg, tdee: t.tdee, tdeeRange: t.tdeeRange, surplus: delta, phase },
  };
  await store.upsert('nutrition_targets', row as unknown as Record<string, unknown>);
  return row;
}
