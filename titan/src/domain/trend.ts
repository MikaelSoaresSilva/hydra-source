import { startOfWeek } from './dates';

export interface WeightPoint { date: string; weight: number }

export interface WeeklyAverage { weekStart: string; avg: number; count: number }

/** Média móvel de 7 dias (por data, considerando só os dias com pesagem). */
export function movingAverage(points: WeightPoint[], window = 7): { date: string; weight: number; avg: number }[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((p, i) => {
    const slice = sorted.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((s, x) => s + x.weight, 0) / slice.length;
    return { ...p, avg: Math.round(avg * 100) / 100 };
  });
}

/** Média semanal (semana começa na segunda). Só conta semanas com >= minCount pesagens. */
export function weeklyAverages(points: WeightPoint[], minCount = 3): WeeklyAverage[] {
  const by = new Map<string, number[]>();
  for (const p of points) {
    const w = startOfWeek(p.date);
    by.set(w, [...(by.get(w) ?? []), p.weight]);
  }
  return [...by.entries()]
    .map(([weekStart, ws]) => ({ weekStart, avg: Math.round((ws.reduce((a, b) => a + b, 0) / ws.length) * 100) / 100, count: ws.length }))
    .filter((w) => w.count >= minCount)
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

export interface AdjustInput {
  currentKcal: number;
  weekly: WeeklyAverage[]; // ordenado, já filtrado
  targetWeeklyGainKg: number;
  adherence: number | null; // 0–1: fração dos dias com registro alimentar próximo da meta
}

export interface AdjustResult {
  action: 'insufficient_data' | 'improve_adherence' | 'increase' | 'decrease' | 'maintain';
  deltaKcal: number;
  newKcal: number;
  rates: number[];
  reason: string;
}

/**
 * Ajuste gradual: exige duas variações semanais consecutivas na mesma direção antes de mudar.
 * Nunca muda calorias por uma pesagem isolada.
 */
export function adjustCalories({ currentKcal, weekly, targetWeeklyGainKg, adherence }: AdjustInput): AdjustResult {
  const last = weekly.slice(-3);
  const rates = last.slice(1).map((w, i) => Math.round((w.avg - last[i].avg) * 100) / 100);
  const base = { deltaKcal: 0, newKcal: currentKcal, rates };
  if (rates.length < 2) {
    return { ...base, action: 'insufficient_data', reason: 'São necessárias 3 semanas com pelo menos 3 pesagens cada para avaliar a tendência.' };
  }
  if (adherence !== null && adherence < 0.7) {
    return { ...base, action: 'improve_adherence',
      reason: `Adesão alimentar de ${Math.round(adherence * 100)}%: antes de mudar calorias, aproxime o consumo real da meta atual.` };
  }
  const low = targetWeeklyGainKg * 0.5;
  const high = targetWeeklyGainKg * 2;
  if (rates.every((r) => r < low)) {
    const delta = rates.every((r) => r <= 0) ? 150 : 100;
    return { action: 'increase', deltaKcal: delta, newKcal: currentKcal + delta, rates,
      reason: `Duas semanas seguidas abaixo do ritmo-alvo (${rates.map(fmt).join(' e ')} kg/sem vs alvo ${fmt(targetWeeklyGainKg)}): +${delta} kcal.` };
  }
  if (rates.every((r) => r > high)) {
    return { action: 'decrease', deltaKcal: -100, newKcal: currentKcal - 100, rates,
      reason: `Duas semanas seguidas bem acima do ritmo-alvo (${rates.map(fmt).join(' e ')} kg/sem): −100 kcal para limitar ganho de gordura.` };
  }
  return { ...base, action: 'maintain', reason: `Ritmo dentro do esperado (${rates.map(fmt).join(' e ')} kg/sem): manter.` };
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
