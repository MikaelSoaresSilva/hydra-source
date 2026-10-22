import { describe, expect, it } from 'vitest';
import { DAY_PASS, HABITS, dayStatus, streak, weekScore, type MissionData } from './mission';
import type { CareLogRow, CheckinRow, FoodLogRow, ProgramRow, SessionRow, TargetRow } from './types';

const program = { id: 'p', start_date: '2026-10-01', weeks: 9, config: { trainingDays: [1, 2, 3, 4, 5], days: [] } } as unknown as ProgramRow;
const target = { kcal: 2900, protein_g: 135 } as TargetRow;
const base: MissionData = { program, sessions: [], foodLogs: [], target, careLogs: [], checkins: [], hasSkinRoutine: true };
const ALL_MANUAL = Object.fromEntries(HABITS.filter((h) => !h.auto).map((h) => [h.id, true]));

function perfectDay(date: string, training = true): Partial<MissionData> {
  return {
    sessions: training ? [{ status: 'done', completed_at: `${date}T18:00:00Z` } as SessionRow] : [],
    foodLogs: [{ date, kcal: 2900, protein_g: 140 } as FoodLogRow],
    careLogs: (['am', 'pm'] as const).map((slot) => ({ date, area: 'skin', slot, completed: true, product_id: null }) as unknown as CareLogRow),
    checkins: [{ date, sleep_hours: 8, water_l: 2.5, habits: ALL_MANUAL } as unknown as CheckinRow],
  };
}
const merge = (...parts: Partial<MissionData>[]): MissionData => parts.reduce<MissionData>((acc, p) => ({
  ...acc,
  sessions: [...acc.sessions, ...(p.sessions ?? [])], foodLogs: [...acc.foodLogs, ...(p.foodLogs ?? [])],
  careLogs: [...acc.careLogs, ...(p.careLogs ?? [])], checkins: [...acc.checkins, ...(p.checkins ?? [])],
}), base);

describe('Missão Titan', () => {
  it('dia perfeito = 100%', () => {
    const st = dayStatus(merge(perfectDay('2026-10-20')), '2026-10-20');
    expect(st.score).toBe(1);
    expect(st.total).toBe(HABITS.length);
  });
  it('dia sem nada registrado = 0% e treino pendente', () => {
    const st = dayStatus(base, '2026-10-20');
    expect(st.score).toBe(0);
    expect(st.items.find((i) => i.habit.id === 'train')?.done).toBe(false);
  });
  it('domingo (descanso) não conta o treino', () => {
    const st = dayStatus(merge(perfectDay('2026-10-18', false)), '2026-10-18');
    expect(st.items.find((i) => i.habit.id === 'train')?.done).toBeNull();
    expect(st.score).toBe(1);
  });
  it('proteína abaixo de 90% da meta não conta; calorias fora de ±10% não contam', () => {
    const d = merge({ foodLogs: [{ date: '2026-10-20', kcal: 2000, protein_g: 100 } as FoodLogRow] });
    const st = dayStatus(d, '2026-10-20');
    expect(st.items.find((i) => i.habit.id === 'protein')?.done).toBe(false);
    expect(st.items.find((i) => i.habit.id === 'kcal')?.done).toBe(false);
  });
  it('sem meta nutricional os itens de dieta não se aplicam', () => {
    const st = dayStatus({ ...base, target: null }, '2026-10-20');
    expect(st.items.find((i) => i.habit.id === 'protein')?.done).toBeNull();
  });
  it('sequência conta dias ≥80% seguidos e não quebra com hoje em andamento', () => {
    const d = merge(perfectDay('2026-10-16'), perfectDay('2026-10-17', false), perfectDay('2026-10-18', false), perfectDay('2026-10-19'));
    expect(streak(d, '2026-10-20')).toBe(4);
    expect(streak(merge(perfectDay('2026-10-20'), perfectDay('2026-10-19')), '2026-10-20')).toBe(2);
    expect(DAY_PASS).toBe(0.8);
  });
  it('nota semanal', () => {
    const d = merge(...['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map((x) => perfectDay(x)));
    expect(weekScore(d, '2026-10-20')).toBe(57); // 4 de 7 dias perfeitos
  });
});
