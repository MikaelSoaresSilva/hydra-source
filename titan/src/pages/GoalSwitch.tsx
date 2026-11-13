import { useProfile, useStore } from '../data/AppContext';
import { GOAL_LABEL, type Goal } from '../domain/recomp';
import type { Profile } from '../domain/types';
import { applyNutritionPhase, profileReadyForTargets } from '../services';
import { Segmented, useToast } from '../ui/components';

export function currentGoal(p: Profile | null): Goal {
  return p?.preferences.goal ?? (p?.nutrition.phase === 'recomp' ? 'recomp' : 'gain');
}

/**
 * Objetivo do momento, o mesmo no Treino e na Nutrição. Trocar o objetivo muda a meta de calorias
 * (déficit leve ou superávit leve) e liga/desliga o cardio depois do treino (esteira ou bike) e a corda do fim de semana.
 */
export function GoalSwitch() {
  const store = useStore();
  const { profile, save } = useProfile();
  const { toast, node } = useToast();
  if (!profile) return null;
  const goal = currentGoal(profile);
  return (
    <div className="stack">
      {node}
      <Segmented<Goal>
        label="Objetivo"
        value={goal}
        onChange={async (g) => {
          if (g === goal && profile.preferences.goal) return;
          if (!confirm(g === 'recomp'
            ? 'Ativar "Perder gordura e ganhar massa"? A meta passa para cerca de −350 kcal/dia com proteína de 2,0 g/kg, e o treino ganha cardio de esteira ou bike no fim e corda no fim de semana.'
            : 'Ativar "Ganhar massa"? A meta passa para cerca de +250 kcal/dia e saem o cardio pós-treino e a corda.')) return;
          const phase = g === 'recomp' ? 'recomp' as const : 'lean_gain' as const;
          const next = { ...profile, preferences: { ...profile.preferences, goal: g }, nutrition: { ...profile.nutrition, phase } };
          await save({ preferences: next.preferences, nutrition: next.nutrition });
          const missing = profileReadyForTargets(next);
          if (missing.length) { toast(`Objetivo salvo. Para calcular a meta, complete no Perfil: ${missing.join(', ')}.`); return; }
          const t = await applyNutritionPhase(store, next, phase);
          toast(`Objetivo salvo. Nova meta: ${t.kcal} kcal e ${t.protein_g} g de proteína.`);
        }}
        options={(['recomp', 'gain'] as Goal[]).map((g) => ({ value: g, label: GOAL_LABEL[g].label, sub: GOAL_LABEL[g].sub }))}
      />
    </div>
  );
}
