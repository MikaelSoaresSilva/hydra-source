import type { ActivityLevel } from './types';

export interface EnergyInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  activityLevel: ActivityLevel;
  experienceMonths?: number;
}

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentário (sem treino e pouco movimento)',
  light: 'Leve (treino 1–3×/semana ou trabalho em pé)',
  moderate: 'Moderado (treino 3–5×/semana, rotina pouco ativa fora dele)',
  high: 'Alto (treino 5–6×/semana + rotina fisicamente ativa)',
};

/** Mifflin-St Jeor (kcal/dia). */
export function bmrMifflin({ weightKg, heightCm, age, sex }: Pick<EnergyInput, 'weightKg' | 'heightCm' | 'age' | 'sex'>): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** Ritmo-alvo de ganho de peso por mês, em % do peso corporal, conforme experiência. */
export function monthlyGainPct(experienceMonths = 12): number {
  if (experienceMonths < 12) return 1.0;
  if (experienceMonths < 36) return 0.75;
  return 0.5;
}

export interface Targets {
  bmr: number;
  tdee: number;
  tdeeRange: [number, number];
  surplus: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  monthlyGainKg: number;
  weeklyGainKg: number;
  explanation: string[];
}

const round = (n: number, step: number) => Math.round(n / step) * step;

export function calculateTargets(input: EnergyInput): Targets {
  const bmr = bmrMifflin(input);
  const tdee = bmr * ACTIVITY_FACTOR[input.activityLevel];
  const pct = monthlyGainPct(input.experienceMonths);
  const monthlyGainKg = (input.weightKg * pct) / 100;
  // ~7700 kcal/kg é uma aproximação; o ajuste real virá da tendência de peso.
  const surplus = Math.min(350, Math.max(150, round((monthlyGainKg * 7700) / 30, 50)));
  const kcal = round(tdee + surplus, 50);
  const proteinG = Math.round(input.weightKg * 1.8);
  let fatG = Math.round(input.weightKg * 0.9);
  fatG = Math.max(fatG, Math.round((kcal * 0.2) / 9));
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    tdeeRange: [Math.round(tdee * 0.9), Math.round(tdee * 1.1)],
    surplus,
    kcal,
    proteinG,
    fatG,
    carbsG,
    monthlyGainKg: Math.round(monthlyGainKg * 100) / 100,
    weeklyGainKg: Math.round((monthlyGainKg / 4.33) * 100) / 100,
    explanation: [
      `Metabolismo basal (Mifflin-St Jeor): ~${Math.round(bmr)} kcal.`,
      `Gasto total estimado: ~${Math.round(tdee)} kcal (fator ${ACTIVITY_FACTOR[input.activityLevel]}). Fórmulas erram com frequência ±10% ou mais: faixa provável ${Math.round(tdee * 0.9)}–${Math.round(tdee * 1.1)} kcal.`,
      `Superávit inicial conservador de ${surplus} kcal (teto de 350 kcal recomendado para hipertrofia, CREF4/SC 2018), mirando ~${pct}% do peso por mês (~${(Math.round(monthlyGainKg * 100) / 100).toLocaleString('pt-BR')} kg/mês).`,
      `Proteína 1,8 g/kg (faixa útil 1,6–2,2), gordura ≥0,9 g/kg e ≥20% das calorias, carboidratos completam o restante para sustentar o treino.`,
      'A meta será revisada pela tendência semanal de peso, não por pesagens isoladas.',
    ],
  };
}

export const macroKcal = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;
