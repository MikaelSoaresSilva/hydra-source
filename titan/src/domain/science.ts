// Ferramentas quantitativas tiradas dos materiais estudados (CREF4/SC 2018 e 2019,
// "Musculação Aplicada"). Cada função cita de onde vem a regra.
import { addDays } from './dates';
import type { Readiness, SessionRow, SetLogRow, SlotPrescription } from './types';

/** Tabela %1RM × repetições máximas (Baechle & Earle, citada em "Musculação: estruturação…", CREF4/SC 2018). */
export const BAECHLE_TABLE: [pct: number, reps: number][] = [
  [100, 1], [95, 2], [93, 3], [90, 4], [87, 5], [85, 6], [83, 7], [80, 8], [77, 9], [75, 10], [70, 11], [67, 12], [65, 15],
];

/** %1RM correspondente a N repetições máximas (interpola entre 12 e 15). null fora de 1–15. */
export function percentForReps(reps: number): number | null {
  if (!Number.isFinite(reps) || reps < 1 || reps > 15) return null;
  const r = Math.round(reps);
  const exact = BAECHLE_TABLE.find(([, n]) => n === r);
  if (exact) return exact[0];
  // 13 e 14 RM: interpolação linear entre 67% (12) e 65% (15)
  return Math.round((67 - ((r - 12) * 2) / 3) * 10) / 10;
}

/**
 * 1RM estimado a partir de uma série. Se a série parou antes da falha, as repetições
 * em reserva (RIR) entram como repetições possíveis. null quando passa de 15 RM (tabela não cobre).
 */
export function estimate1RM(loadKg: number, reps: number, rir = 0): number | null {
  if (loadKg <= 0 || reps < 1) return null;
  const pct = percentForReps(reps + Math.max(0, rir));
  return pct ? Math.round((loadKg / (pct / 100)) * 10) / 10 : null;
}

/** Carga para N repetições máximas a partir de um 1RM (estimado ou medido). */
export function loadForReps(oneRmKg: number, reps: number): number | null {
  const pct = percentForReps(reps);
  return pct ? Math.round(oneRmKg * pct) / 100 : null;
}

/** Manifestações da força (Uchida et al., citado em CREF4/SC 2018). */
export const STRENGTH_MANIFESTATIONS = [
  { key: 'endurance', name: 'Resistência (endurance)', reps: '> 25', pct: '< 55%', sets: 'I–III', rest: '< 45 s' },
  { key: 'rml', name: 'Resistência muscular localizada', reps: '15–25', pct: '55–65%', sets: 'I–III', rest: '< 45 s' },
  { key: 'explosive', name: 'Força explosiva', reps: '—', pct: '30–60%', sets: '—', rest: '2–5 min' },
  { key: 'hypertrophy', name: 'Força hipertrófica', reps: '8–12', pct: '70–85%', sets: 'II–VI', rest: '1–2 min' },
  { key: 'max', name: 'Força máxima', reps: '1–6', pct: '90–100%', sets: 'V–XX', rest: '3–5 min' },
] as const;

export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';
export const LEVEL_LABEL: Record<TrainingLevel, string> = { beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado' };

/** Nível pelo tempo de treino contínuo ("Musculação Aplicada": <6 meses, ~6–12 meses, >1 ano). */
export function trainingLevel(experienceMonths?: number): TrainingLevel {
  if (experienceMonths === undefined || experienceMonths < 6) return 'beginner';
  if (experienceMonths <= 12) return 'intermediate';
  return 'advanced';
}

/** Recomendações do ACSM (2009) para hipertrofia, reproduzidas em "Musculação Aplicada". */
export const ACSM_HYPERTROPHY: Record<TrainingLevel, { reps: string; sets: string; pct: string; rest: string; freq: string }> = {
  beginner: { reps: '8–12', sets: '1–3', pct: '70–85%', rest: '1–2 min', freq: '2–3×/semana (corpo todo)' },
  intermediate: { reps: '8–12', sets: '1–3', pct: '70–85%', rest: '1–2 min', freq: '2–4×/semana' },
  advanced: { reps: '1–12 (ênfase 6–12)', sets: '3–6', pct: '70–100%', rest: '2–3 min (pesado) · 1–2 min (moderado)', freq: '4–6×/semana' },
};

/** Volume semanal por grupo segundo Ratamess (CREF4/SC 2018) — séries por sessão do grupo. */
export const RATAMESS_VOLUME: Record<TrainingLevel, { setsPerGroup: string; exercisesPerGroup: string }> = {
  beginner: { setsPerGroup: '1–3', exercisesPerGroup: '1' },
  intermediate: { setsPerGroup: '6–8', exercisesPerGroup: '2' },
  advanced: { setsPerGroup: '9–16', exercisesPerGroup: '3–4' },
};

/** Mínimo de séries semanais por grupo para hipertrofia (Tabela 6.1, "Treinamento de força", CREF4/SC 2019). */
export const MIN_WEEKLY_SETS = 10;

// ------------------------------------------------------------ prontidão (TQR)

/** Escala de Qualidade Total de Recuperação (Kenttä & Hassmén), 6–20. */
export const TQR_SCALE: [number, string][] = [
  [6, 'Nada recuperado'], [7, 'Extremamente mal recuperado'], [9, 'Muito mal recuperado'], [11, 'Mal recuperado'],
  [13, 'Razoavelmente recuperado'], [15, 'Bem recuperado'], [17, 'Muito bem recuperado'], [19, 'Extremamente bem recuperado'], [20, 'Totalmente recuperado'],
];

export function tqrLabel(v: number): string {
  let label = TQR_SCALE[0][1];
  for (const [n, l] of TQR_SCALE) if (v >= n) label = l;
  return label;
}

/**
 * Periodização ondulatória flexível (McNamara & Stearne 2010, citada em CREF4/SC 2019): a sessão
 * se adapta ao estado do dia. TQR < 13 → recuperação insuficiente: −1 série por exercício
 * (mínimo 1) e +1 RIR. A ordem e os exercícios não mudam.
 */
export function applyReadiness<T extends Pick<SlotPrescription, 'sets' | 'rir'>>(slots: T[], tqr: number): { slots: T[]; readiness: Readiness } {
  const v = Math.max(6, Math.min(20, Math.round(tqr)));
  if (v >= 13) {
    return { slots, readiness: { tqr: v, adjusted: false, note: `TQR ${v} (${tqrLabel(v)}): sessão mantida como planejada.` } };
  }
  return {
    slots: slots.map((s) => ({ ...s, sets: Math.max(1, s.sets - 1), rir: s.rir + 1 })),
    readiness: { tqr: v, adjusted: true, note: `TQR ${v} (${tqrLabel(v)}): abaixo de 13, então cada exercício perdeu 1 série e o RIR alvo subiu 1. Treinar leve é melhor do que faltar, mas não force.` },
  };
}

// ------------------------------------------------------------ carga interna e externa

/** Duração da sessão em minutos a partir de início/fim; null se faltar dado ou for implausível. */
export function sessionMinutes(s: Pick<SessionRow, 'started_at' | 'completed_at'>): number | null {
  if (!s.started_at || !s.completed_at) return null;
  const min = (Date.parse(s.completed_at) - Date.parse(s.started_at)) / 60000;
  return min > 5 && min < 300 ? Math.round(min) : null;
}

/** Carga interna da sessão (método PSE da sessão, Foster): PSE (CR10) × minutos = unidades arbitrárias (UA). */
export function sessionLoad(s: Pick<SessionRow, 'session_rpe' | 'started_at' | 'completed_at'>): number | null {
  const min = sessionMinutes(s);
  return s.session_rpe && min ? Math.round(Number(s.session_rpe) * min) : null;
}

/** Tonelagem (volume-carga): Σ séries × repetições × kg das séries de trabalho. */
export function tonnage(logs: Pick<SetLogRow, 'kind' | 'load_kg' | 'reps'>[]): number {
  return Math.round(logs.filter((l) => l.kind === 'working').reduce((t, l) => t + Number(l.load_kg) * l.reps, 0));
}

export interface WeekLoad { weekStart: string; sessions: number; load: number; tonnage: number; loadMissing: number }

/** Segunda-feira da semana (ISO) de uma data AAAA-MM-DD. */
export function weekStartOf(iso: string): string {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7;
  return addDays(iso.slice(0, 10), -dow);
}

/** Carga semanal (PSE×min) e tonelagem das sessões concluídas, em ordem cronológica. */
export function weeklyLoads(sessions: SessionRow[], logs: SetLogRow[]): WeekLoad[] {
  const map = new Map<string, WeekLoad>();
  const bySession = new Map<string, SetLogRow[]>();
  logs.forEach((l) => { const a = bySession.get(l.session_id) ?? []; a.push(l); bySession.set(l.session_id, a); });
  sessions.filter((s) => s.status === 'done' && s.completed_at).forEach((s) => {
    const ws = weekStartOf(s.completed_at!);
    const w = map.get(ws) ?? { weekStart: ws, sessions: 0, load: 0, tonnage: 0, loadMissing: 0 };
    w.sessions += 1;
    const l = sessionLoad(s);
    if (l === null) w.loadMissing += 1; else w.load += l;
    w.tonnage += tonnage(bySession.get(s.id) ?? []);
    map.set(ws, w);
  });
  return [...map.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

// ------------------------------------------------------------ saúde e nutrição

/** Risco pela circunferência da cintura (OMS, reproduzido em "Musculação Aplicada"). */
export function waistRisk(cm: number, sex: 'male' | 'female'): 'normal' | 'raised' | 'high' {
  const [a, b] = sex === 'male' ? [94, 102] : [80, 88];
  if (cm > b) return 'high';
  if (cm > a) return 'raised';
  return 'normal';
}

/**
 * Proteína mínima por refeição: ~0,25 g/kg de massa magra (Moore et al. 2015, citado em CREF4/SC 2019).
 * Sem medida de massa magra, usamos o peso total — superestima um pouco a meta, o que é seguro.
 */
export function proteinPerMealTarget(weightKg: number, leanMassKg?: number | null): { grams: number; basis: 'lean' | 'total' } {
  const base = leanMassKg && leanMassKg > 0 ? leanMassKg : weightKg;
  return { grams: Math.round(base * 0.25), basis: leanMassKg ? 'lean' : 'total' };
}

/** Refeições do dia (agrupadas pelo nome da refeição) abaixo da meta de proteína por refeição. */
export function mealsBelowProtein(logs: { meal: string; protein_g: number }[], perMealG: number): { meal: string; protein: number }[] {
  const by = new Map<string, number>();
  logs.forEach((l) => by.set(l.meal, (by.get(l.meal) ?? 0) + Number(l.protein_g)));
  return [...by.entries()].filter(([, p]) => p < perMealG).map(([meal, p]) => ({ meal, protein: Math.round(p) }));
}

/** Meta mínima de água: ≥ 2 L/dia (orientação do material do DATASUS sobre pele), mais em dias de treino/calor. */
export const MIN_WATER_L = 2;
