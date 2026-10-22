import type { Exercise } from './exercises';
import type { SetLogRow } from './types';

export interface SessionPerformance { sessionId: string; date: string; sets: Pick<SetLogRow, 'load_kg' | 'reps' | 'rir' | 'technique_ok' | 'pain' | 'kind'>[] }

export type ProgressionAction = 'first_time' | 'increase' | 'maintain' | 'reduce' | 'hold_pain' | 'hold_recovery' | 'hold_technique';

export interface ProgressionSuggestion {
  action: ProgressionAction;
  load: number | null;
  reason: string;
  suggestSubstitution: boolean;
}

export interface RecoveryContext { recoveryScore: number | null } // 1–5, média recente; null = sem dados

export function roundToStep(value: number, step: number): number {
  if (step <= 0) return Math.round(value * 10) / 10;
  return Math.round(value / step) * step;
}

/** Estimativa de 1RM (Epley) considerando repetições em reserva. */
export function estimated1RM(load: number, reps: number, rir: number | null = 0): number {
  if (reps <= 0) return 0;
  return load * (1 + (reps + (rir ?? 0)) / 30);
}

export function bestE1RM(perf: SessionPerformance): number {
  return Math.max(0, ...perf.sets.filter((s) => s.kind === 'working').map((s) => estimated1RM(s.load_kg, s.reps, s.rir)));
}

/**
 * Progressão dupla.
 * - Todas as séries efetivas no topo da faixa, com o esforço prescrito, técnica ok e sem dor → aumenta a carga.
 * - Dor (≥4/10) → não aumenta; reduz se a dor se repetir e sugere substituição.
 * - Técnica comprometida → mantém.
 * - Recuperação ruim → mantém mesmo que o topo tenha sido atingido.
 * - Abaixo do mínimo da faixa em 2 sessões seguidas com a mesma carga → reduz ~7,5%.
 * - Caso contrário → mantém a carga e busca mais repetições.
 */
export function suggestProgression(
  ex: Pick<Exercise, 'repRange' | 'increment'>,
  rirTarget: number,
  history: SessionPerformance[], // mais recente primeiro
  recovery: RecoveryContext = { recoveryScore: null },
): ProgressionSuggestion {
  const [min, max] = ex.repRange;
  const last = history.find((h) => h.sets.some((s) => s.kind === 'working'));
  if (!last) {
    return { action: 'first_time', load: null, suggestSubstitution: false,
      reason: `Primeira vez: escolha uma carga que permita ${min}–${max} repetições deixando ~${rirTarget} na reserva.` };
  }
  const working = last.sets.filter((s) => s.kind === 'working');
  const load = Math.max(...working.map((s) => s.load_kg));
  const topSets = working.filter((s) => s.load_kg === load);
  const painful = working.some((s) => s.pain >= 4);
  if (painful) {
    const prev = history.filter((h) => h !== last).find((h) => h.sets.some((s) => s.kind === 'working'));
    const repeated = !!prev?.sets.some((s) => s.kind === 'working' && s.pain >= 4);
    return {
      action: 'hold_pain',
      load: repeated ? roundToStep(load * 0.9, ex.increment || 0.5) : load,
      suggestSubstitution: repeated,
      reason: repeated
        ? 'Dor registrada em duas sessões seguidas: carga reduzida e substituição recomendada. Se a dor persistir, procure avaliação profissional.'
        : 'Dor registrada na última sessão: a carga não sobe até um treino sem dor.',
    };
  }
  if (working.some((s) => !s.technique_ok)) {
    return { action: 'hold_technique', load, suggestSubstitution: false, reason: 'Técnica marcada como comprometida: mantenha a carga e consolide a execução.' };
  }
  const allTop = topSets.length > 0 && topSets.every((s) => s.reps >= max && (s.rir === null || s.rir >= rirTarget - 1));
  if (allTop) {
    if (recovery.recoveryScore !== null && recovery.recoveryScore < 3) {
      return { action: 'hold_recovery', load, suggestSubstitution: false,
        reason: 'Você atingiu o topo da faixa, mas a recuperação recente está baixa: mantenha a carga até recuperar.' };
    }
    const next = roundToStep(load + ex.increment, ex.increment || 0.5);
    const jump = load > 0 ? (next - load) / load : 0;
    return { action: 'increase', load: next, suggestSubstitution: false,
      reason: `Topo da faixa (${max} reps) em todas as séries com o esforço prescrito → +${ex.increment} kg.`
        + (jump > 0.1 ? ' Salto relativo grande: se não alcançar o mínimo da faixa, volte e progrida em repetições.' : '') };
  }
  const prev = history.filter((h) => h !== last).find((h) => h.sets.some((s) => s.kind === 'working'));
  const belowMin = (p: SessionPerformance, l: number) => {
    const ws = p.sets.filter((s) => s.kind === 'working' && s.load_kg === l);
    return ws.length > 0 && ws[0].reps < min;
  };
  if (prev && belowMin(last, load) && belowMin(prev, load)) {
    return { action: 'reduce', load: roundToStep(load * 0.925, ex.increment || 0.5), suggestSubstitution: false,
      reason: `Abaixo de ${min} reps em duas sessões com ${load} kg: carga reduzida para voltar à faixa.` };
  }
  return { action: 'maintain', load, suggestSubstitution: false, reason: `Mantenha ${load} kg e busque mais repetições até ${max} em todas as séries.` };
}

/** Agrupa séries por sessão (mais recente primeiro). */
export function groupHistory(logs: SetLogRow[], exerciseKey: string): SessionPerformance[] {
  const by = new Map<string, SessionPerformance>();
  for (const l of logs) {
    if (l.exercise_key !== exerciseKey) continue;
    const p = by.get(l.session_id) ?? { sessionId: l.session_id, date: l.logged_at, sets: [] };
    if (l.logged_at > p.date) p.date = l.logged_at;
    p.sets.push(l);
    by.set(l.session_id, p);
  }
  return [...by.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Tendência de desempenho: queda em sessões consecutivas (e1RM) por exercício.
 * Retorna os exercícios em queda nas 3 últimas sessões.
 */
export function decliningExercises(logs: SetLogRow[]): string[] {
  const keys = Array.from(new Set(logs.map((l) => l.exercise_key)));
  return keys.filter((k) => {
    const h = groupHistory(logs, k).slice(0, 3).map(bestE1RM);
    return h.length === 3 && h[0] < h[1] * 0.98 && h[1] < h[2] * 0.98;
  });
}

export type SetAdjustAction = 'up' | 'keep' | 'down' | 'stop';
export interface SetAdjustment { action: SetAdjustAction; load: number; message: string }

const fmtKg = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;

/**
 * Ajuste série a série (autorregulação dentro da sessão), a partir do que foi registrado.
 * - Dentro da faixa e com RIR até 1 do alvo → mantém (queda de 1–2 reps entre séries é fadiga normal).
 * - Passou do topo da faixa ou sobrou esforço (RIR ≥ alvo+2) → sobe.
 * - Abaixo do mínimo ou mais perto da falha que o alvo (RIR < alvo−1) → desce.
 * A nova carga vem do 1RM estimado da série (Epley) para o meio da faixa com o RIR alvo,
 * arredondada ao incremento do exercício, com no máx. ±15% de mudança.
 * - Dor ≥ 4/10 → parar o exercício hoje. Técnica comprometida → nunca sobe.
 */
export function adjustNextSet(
  ex: Pick<Exercise, 'repRange' | 'increment'>,
  rirTarget: number,
  set: { load: number; reps: number; rir: number | null; pain?: number; techniqueOk?: boolean },
): SetAdjustment {
  const [min, max] = ex.repRange;
  const step = ex.increment || 0.5;
  const { load, reps } = set;
  const rir = set.rir ?? rirTarget;
  if ((set.pain ?? 0) >= 4) {
    return { action: 'stop', load, message: `Dor ${set.pain}/10: encerre este exercício hoje (ou troque por uma variação sem dor). A carga não sobe no próximo treino.` };
  }
  const tooEasy = reps > max || (reps >= max && rir >= rirTarget + 1) || (reps >= min && rir >= rirTarget + 2);
  const tooHard = reps < min || rir < rirTarget - 1;
  if (!tooEasy && !tooHard) {
    return { action: 'keep', load, message: `${reps} reps com RIR ${rir}: dentro do alvo (${min}–${max}, RIR ${rirTarget}). Mantenha ${fmtKg(load)}.` };
  }
  if (load <= 0) {
    return { action: tooEasy ? 'up' : 'keep', load, message: tooEasy ? `Ficou fácil: acrescente carga (ou repetições, se for peso do corpo).` : 'Abaixo da faixa: diminua a amplitude de dificuldade ou use assistência.' };
  }
  const e1rm = load * (1 + (reps + rir) / 30);
  const target = e1rm / (1 + ((min + max) / 2 + rirTarget) / 30);
  let next = roundToStep(Math.min(load * 1.15, Math.max(load * 0.85, target)), step);
  if (tooEasy) {
    if (set.techniqueOk === false) return { action: 'keep', load, message: 'Ficou leve, mas a técnica foi marcada como comprometida: mantenha a carga e acerte a execução.' };
    if (next <= load) next = roundToStep(load + step, step);
    return { action: 'up', load: next, message: `${reps} reps com RIR ${rir}: acima do alvo. Próxima série: ${fmtKg(next)} (+${fmtKg(next - load)}).` };
  }
  if (next >= load) next = Math.max(0, roundToStep(load - step, step));
  return { action: 'down', load: next, message: `${reps} reps com RIR ${rir}: ${reps < min ? `abaixo de ${min} reps` : 'perto demais da falha'}. Próxima série: ${fmtKg(next)} (−${fmtKg(load - next)}).` };
}

/**
 * Estagnação: melhor e1RM das 4 últimas sessões do exercício não subiu mais que 1% em relação
 * à sessão mais antiga das 4 (e não está em queda forte, que é tratada como fadiga).
 */
export function stalledExercises(logs: SetLogRow[]): string[] {
  const keys = Array.from(new Set(logs.map((l) => l.exercise_key)));
  return keys.filter((k) => {
    const h = groupHistory(logs, k).slice(0, 4).map(bestE1RM);
    if (h.length < 4 || h.some((x) => x <= 0)) return false;
    const best = Math.max(...h.slice(0, 3));
    return best <= h[3] * 1.01 && h[0] >= h[3] * 0.95;
  });
}

/** Recorde: a série supera o melhor 1RM estimado de todas as sessões anteriores do exercício. */
export function isPersonalRecord(previous: SessionPerformance[], set: { load: number; reps: number; rir: number | null }): boolean {
  if (!previous.length || set.load <= 0) return false;
  const best = Math.max(...previous.map(bestE1RM));
  return best > 0 && estimated1RM(set.load, set.reps, set.rir) > best * 1.005;
}
