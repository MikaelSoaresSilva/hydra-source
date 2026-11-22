// Carrega o núcleo de regras (compilado do Kotlin do app Android) e expõe funções práticas.
import { AureaCore } from './core/AureaFit-web.mjs';

export const core = typeof AureaCore.getInstance === 'function' ? AureaCore.getInstance() : AureaCore;
const J = (s) => JSON.parse(s);
const S = (o) => JSON.stringify(o);

export const EXERCISES = J(core.exercises());
export const EX = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
export const FOODS = J(core.foods());
export const FOOD = Object.fromEntries(FOODS.map((f) => [f.id, f]));
export const RECIPES = J(core.recipes());
export const OPTIONS = J(core.options());
export const FOOD_CHOICES = J(core.foodChoices());
export const label = (group, id) => (OPTIONS[group] || []).find((o) => o.id === id)?.label ?? id;

export const api = {
  defaultProfile: () => J(core.defaultProfile()),
  workout: (p, setsDelta = 0) => J(core.workout(S(p), setsDelta)),
  diet: (p, calorieOffset = 0) => J(core.diet(S(p), calorieOffset)),
  targets: (p, offset = 0) => J(core.targets(S(p), offset)),
  safety: (p) => J(core.safety(S(p))),
  bmi: (p) => core.bmi(S(p)),
  alternatives: (id, p) => J(core.alternatives(id, S(p))),
  swapOptions: (planned, p) => J(core.swapOptions(S(planned), S(p))),
  prescribe: (id, p, setsDelta) => J(core.prescribe(id, S(p), setsDelta)),
  minutes: (day) => core.estimatedMinutes(S(day)),
  suggest: (planned, lastSets, rpe, goodForm, pain, recovered, loadStep) => J(core.suggest(S(planned), S(lastSets), rpe || 0, goodForm, pain, recovered, loadStep)),
  measure: (id, g) => core.measure(id, g),
  substitutes: (item, p) => J(core.substitutes(S(item), S(p))),
  shopping: (days) => J(core.shopping(S(days))),
  mealStructure: (p) => J(core.mealStructure(S(p))),
  recommend: (answers, p, weights, setsDelta) => J(core.recommend(S(answers), S(p), S(weights), setsDelta))
};

export function itemMacros(it) {
  const f = FOOD[it.foodId]; if (!f) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const k = it.grams / 100;
  return { kcal: f.kcal * k, protein: f.protein * k, carbs: f.carbs * k, fat: f.fat * k };
}
export function sumMacros(items) {
  return items.reduce((a, it) => { const m = itemMacros(it); return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }; }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}
export const mealMacros = (meal) => sumMacros(meal.items);
export const dayMacros = (day) => sumMacros(day.meals.flatMap((m) => m.items));

export const WEEKDAY = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const WD = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const minutesOf = (t) => { const [h, m] = (t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const fmtMin = (total) => { const m = ((total % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/** Agenda diária (mesma regra do app Android). */
export function buildSchedule(p, workout) {
  const id = () => Math.random().toString(36).slice(2, 10);
  const list = [{ id: id(), type: 'WAKE', label: 'Acordar — beba um copo de água', time: p.wakeTime, daysMask: 127, enabled: true }];
  api.mealStructure(p).forEach((m) => list.push({ id: id(), type: 'MEAL', label: m.label, time: m.time, daysMask: 127, enabled: true }));
  const days = workout ? workout.days.map((d) => d.weekday) : [1, 3, 5];
  list.push({ id: id(), type: 'TRAINING', label: 'Hora do treino!', time: p.trainTime, daysMask: days.reduce((a, d) => a | (1 << (d - 1)), 0), enabled: true });
  const wake = minutesOf(p.wakeTime); let sleep = minutesOf(p.sleepTime); if (sleep <= wake) sleep += 1440;
  for (let t = wake + 90; t < sleep - 60; t += 120) list.push({ id: id(), type: 'WATER', label: 'Hidratação — 1 copo de água', time: fmtMin(t), daysMask: 127, enabled: true });
  list.push({ id: id(), type: 'REST', label: 'Pausa: levante, alongue e respire', time: fmtMin(wake + Math.floor((sleep - wake) / 2) + 30), daysMask: 127, enabled: true });
  list.push({ id: id(), type: 'SLEEP', label: 'Prepare-se para dormir (desligue as telas)', time: fmtMin(sleep - 30), daysMask: 127, enabled: true });
  list.push({ id: id(), type: 'CHECKIN', label: 'Check-in semanal: como você está?', time: '19:30', daysMask: 64, enabled: true });
  return list;
}
