import { describe, expect, test } from 'vitest';
import { baseWeeklySets, estimateMinutes, generateProgram, phaseFor, prescribeDay } from './program';
import { OLYMPIA_DAYS, OLYMPIA_VOLUME, OLYMPIA_WEEKS, anthropometry, olympiaPhase } from './olympia';
import { getExercise } from './exercises';
import type { Muscle } from './types';

const equipment = ['barbell', 'ez_bar', 'dumbbell', 'bench', 'rack', 'cable', 'machine', 'smith', 'pullup_bar', 'dip_station', 'leg_press', 'hack_squat'] as const;
const gen = (min = 100) => generateProgram({ protocol: 'olympia', training: { trainingDays: [1, 2, 3, 4, 5], sessionMinutes: min, equipment: [...equipment], equipmentConfirmed: true } });

describe('Protocolo Olympia', () => {
  test('5 sessões seg–sex e todos os exercícios existem', () => {
    const c = gen();
    expect(c.protocol).toBe('olympia');
    expect(c.days.map((d) => d.dayIndex)).toEqual([1, 2, 3, 4, 5]);
    OLYMPIA_DAYS.forEach((d) => d.slots.forEach(([k]) => expect(() => getExercise(k)).not.toThrow()));
  });
  test('volume semanal inicial dentro da faixa planejada para cada músculo com meta', () => {
    const v = baseWeeklySets(gen().days);
    for (const [m, t] of Object.entries(OLYMPIA_VOLUME) as [Muscle, NonNullable<(typeof OLYMPIA_VOLUME)[Muscle]>][]) {
      expect(v[m] ?? 0, m).toBeGreaterThanOrEqual(t.start[0]);
      expect(v[m] ?? 0, m).toBeLessThanOrEqual(t.start[1]);
    }
  });
  test('cada músculo grande treinado ≥2×/semana', () => {
    const c = gen();
    for (const m of ['chest', 'back', 'side_delts', 'biceps', 'triceps', 'quads', 'hamstrings', 'calves'] as Muscle[]) {
      const days = c.days.filter((d) => d.slots.some((s) => getExercise(s.exerciseKey).primary === m)).length;
      expect(days, m).toBeGreaterThanOrEqual(2);
    }
  });
  test('sessões cabem em 90 min (estimativa) e nenhum exercício passa de 4 séries', () => {
    const c = gen(90);
    c.days.forEach((d) => { expect(estimateMinutes(d.slots)).toBeLessThanOrEqual(90); d.slots.forEach((s) => expect(s.sets).toBeLessThanOrEqual(4)); });
  });
  test('fases por dias e sem deload automático', () => {
    expect(olympiaPhase(1)).toMatchObject({ rirCompound: 3, rirIsolation: 2, assessment: true });
    expect(olympiaPhase(2)).toMatchObject({ rirCompound: 2, rirIsolation: 2 });
    expect(olympiaPhase(4)).toMatchObject({ rirCompound: 2, rirIsolation: 1 });
    for (let w = 1; w <= OLYMPIA_WEEKS; w++) expect(olympiaPhase(w).deload).toBe(false);
    expect(olympiaPhase(5, [5]).deload).toBe(true);
  });
  test('deload aplicado por decisão corta as séries pela metade', () => {
    const c = { ...gen(), deloadWeeks: [6] };
    expect(phaseFor(c, 6, OLYMPIA_WEEKS).deload).toBe(true);
    const normal = prescribeDay(c, 0, 5, OLYMPIA_WEEKS);
    const deload = prescribeDay(c, 0, 6, OLYMPIA_WEEKS);
    deload.forEach((s, i) => expect(s.sets).toBe(Math.max(1, Math.ceil(normal[i].sets / 2))));
  });
  test('ciclo padrão continua com deload na última semana', () => {
    const c = generateProgram({ training: { trainingDays: [1, 2, 3, 4, 5], sessionMinutes: 100, equipment: [...equipment] } });
    expect(phaseFor(c, 8, 8).deload).toBe(true);
  });
});

test('antropometria com a ficha informada', () => {
  const r = anthropometry({ weight_kg: 75, waist_cm: 80, arm_right_cm: 35, arm_left_cm: 35, forearm_right_cm: 28, forearm_left_cm: 28, chest_cm: 100, thigh_cm: 60, thigh_left_cm: 60, calf_right_cm: 37, calf_left_cm: 37 }, 180);
  const get = (l: string) => r.find((x) => x.label === l)?.value;
  expect(get('Braço / cintura')).toBe('0,44');
  expect(get('Peitoral / cintura')).toBe('1,25');
  expect(get('Coxa / panturrilha')).toBe('1,62');
  expect(get('Braço contraído / antebraço')).toBe('1,25');
  expect(get('Cintura / altura')).toBe('0,44');
  expect(get('IMC')).toBe('23,1');
  expect(get('Braço: diferença D/E')).toBe('0 cm');
  expect(r.some((x) => x.label === 'Ombros / cintura')).toBe(false); // ombro não informado
});
