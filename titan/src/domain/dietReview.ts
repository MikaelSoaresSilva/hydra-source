// Revisão automática da dieta — roda quando você registra medidas ou adiciona uma foto.
// Muda a meta SÓ com evidência nos seus registros; caso contrário mantém e diz por quê.
import { addDays } from './dates';
import { foodAdherence } from './recommendations';
import { adjustCalories, weeklyAverages } from './trend';
import type { FoodLogRow, MetricRow, TargetRow } from './types';

export const DIET_COOLDOWN_DAYS = 14;
export const WEIGHT_SHIFT_KG = 2;
export const WAIST_GAIN_CM = 1.5;
export const MAX_DEFICIT = 500;
export const MAX_SURPLUS = 400;

export interface DietReview {
  date: string;
  changed: boolean;
  kcal: number; protein: number; carbs: number; fat: number;
  /** O que mudou e por quê. */
  changes: string[];
  /** O que foi avaliado e mantido. */
  kept: string[];
  /** Peso de referência novo (quando a proteína foi recalculada). */
  newWeightKg?: number;
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const br = (v: number, d = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: d });

function change(metrics: MetricRow[], keys: (keyof MetricRow)[], today: string, minDays = 28): { delta: number; days: number } | null {
  const pts = metrics.filter((m) => m.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((m) => { const v = keys.map((k) => num(m[k])).filter((x): x is number => x !== null); return v.length ? { date: m.date, v: v.reduce((a, b) => a + b, 0) / v.length } : null; })
    .filter((x): x is { date: string; v: number } => !!x);
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1];
  const old = [...pts].reverse().find((p) => p.date <= addDays(last.date, -minDays));
  if (!old) return null;
  return { delta: Math.round((last.v - old.v) * 10) / 10, days: Math.round((Date.parse(last.date) - Date.parse(old.date)) / 86400000) };
}

export function reviewDiet({ target, metrics, food, today }: { target: TargetRow; metrics: MetricRow[]; food: FoodLogRow[]; today: string }): DietReview {
  const inputs = target.inputs as { weightKg?: number; weeklyGainKg?: number; tdee?: number; phase?: string };
  const phase = inputs.phase === 'recomp' ? 'recomp' : 'gain';
  const out: DietReview = { date: today, changed: false, kcal: target.kcal, protein: target.protein_g, carbs: target.carbs_g, fat: target.fat_g, changes: [], kept: [] };
  let kcal = target.kcal;

  // 1) Calorias: só com tendência de peso clara, comida registrada e meta já "assentada".
  const sinceChange = Math.round((Date.parse(today) - Date.parse(target.effective_from)) / 86400000);
  const weights = metrics.filter((m) => num(m.weight_kg) !== null && m.date <= today).map((m) => ({ date: m.date, weight: Number(m.weight_kg) }));
  const adherence = foodAdherence(food, target, today);
  const adj = adjustCalories({ currentKcal: target.kcal, weekly: weeklyAverages(weights), targetWeeklyGainKg: Number(inputs.weeklyGainKg ?? (phase === 'recomp' ? -0.32 : 0.2)), adherence: adherence.value });
  if (sinceChange < DIET_COOLDOWN_DAYS) {
    out.kept.push(`Calorias: a meta atual tem ${sinceChange} dia(s). Espero ${DIET_COOLDOWN_DAYS} dias para ver o efeito antes de mexer de novo.`);
  } else if (adj.action === 'insufficient_data') {
    out.kept.push(`Calorias: ${adj.reason}`);
  } else if (adherence.value === null) {
    out.kept.push(`Calorias: só ${adherence.loggedDays} dia(s) de comida registrada nas últimas 2 semanas. Sem saber o que você comeu, mudar a meta seria chute.`);
  } else if (adj.action === 'improve_adherence' || adj.action === 'maintain') {
    out.kept.push(`Calorias: ${adj.reason}`);
  } else {
    kcal += adj.deltaKcal;
    out.changes.push(`Calorias ${adj.deltaKcal > 0 ? '+' : ''}${adj.deltaKcal} kcal. ${adj.reason}`);
  }

  // 2) Cintura (fase de ganho): subiu 1,5 cm+ em 4 semanas sem o braço crescer = gordura, não músculo.
  if (phase === 'gain' && sinceChange >= DIET_COOLDOWN_DAYS && kcal >= target.kcal) {
    const waist = change(metrics, ['waist_cm'], today);
    const arm = change(metrics, ['arm_right_cm', 'arm_left_cm'], today);
    if (waist && waist.delta >= WAIST_GAIN_CM && (!arm || arm.delta < 0.5)) {
      const back = kcal - target.kcal; // desfaz um aumento desta mesma revisão, se houver
      kcal = target.kcal - 150;
      out.changes = out.changes.filter((c) => !c.startsWith('Calorias +'));
      out.changes.push(`Calorias −150 kcal${back > 0 ? ' (em vez de aumentar)' : ''}. Cintura +${br(waist.delta)} cm em ${waist.days} dias${arm ? ` e braço ${arm.delta >= 0 ? '+' : ''}${br(arm.delta)} cm` : ''}: o excedente está virando gordura, não músculo.`);
    } else if (waist) {
      out.kept.push(`Cintura ${waist.delta >= 0 ? '+' : ''}${br(waist.delta)} cm em ${waist.days} dias: dentro do limite de ${br(WAIST_GAIN_CM)} cm.`);
    }
  }
  if (phase === 'recomp') {
    const waist = change(metrics, ['waist_cm'], today);
    if (waist) out.kept.push(`Cintura ${waist.delta >= 0 ? '+' : ''}${br(waist.delta)} cm em ${waist.days} dias${waist.delta <= -0.5 ? ': a gordura está saindo, o déficit está funcionando.' : ': ainda sem queda clara; a balança decide o ajuste, não uma medida isolada.'}`);
  }

  // Limites de segurança: nunca déficit maior que 500 nem excedente maior que 400 sobre o gasto estimado.
  if (inputs.tdee && kcal !== target.kcal) {
    const clamped = Math.max(inputs.tdee - MAX_DEFICIT, Math.min(inputs.tdee + MAX_SURPLUS, kcal));
    if (clamped !== kcal) {
      out.kept.push(`Limite de segurança: a meta fica entre ${inputs.tdee - MAX_DEFICIT} e ${inputs.tdee + MAX_SURPLUS} kcal (gasto estimado ${inputs.tdee}).`);
      kcal = clamped;
      if (kcal === target.kcal) out.changes = out.changes.filter((c) => !c.startsWith('Calorias'));
    }
  }

  // 3) Proteína e gordura acompanham o peso quando ele muda 2 kg+ (média das pesagens dos últimos 7 dias).
  let protein = target.protein_g; let fat = target.fat_g;
  const recent = weights.filter((w) => w.date > addDays(today, -7));
  const refW = num(inputs.weightKg);
  if (recent.length && refW) {
    const cur = Math.round((recent.reduce((a, w) => a + w.weight, 0) / recent.length) * 10) / 10;
    if (Math.abs(cur - refW) >= WEIGHT_SHIFT_KG) {
      const perKg = phase === 'recomp' ? 2.0 : 1.8;
      protein = Math.round(cur * perKg);
      fat = Math.max(Math.round(cur * 0.8), Math.round((kcal * 0.2) / 9));
      out.newWeightKg = cur;
      out.changes.push(`Proteína ${target.protein_g} → ${protein} g (${br(perKg)} g/kg): seu peso foi de ${br(refW)} para ${br(cur)} kg.`);
    } else out.kept.push(`Proteína: peso atual ${br(cur)} kg, a menos de ${WEIGHT_SHIFT_KG} kg do peso usado na meta (${br(refW)} kg).`);
  }

  if (kcal !== target.kcal || protein !== target.protein_g) {
    out.changed = true;
    out.kcal = kcal; out.protein = protein; out.fat = fat;
    out.carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  }
  return out;
}
