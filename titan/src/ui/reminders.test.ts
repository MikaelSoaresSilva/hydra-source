import { describe, expect, it } from 'vitest';
import { REMINDER_ID_BASE, plannedReminders, type ReminderInput } from './reminders';

const base: ReminderInput = { enabled: true, morning: '06:45', trainingDays: [1, 2, 4, 5], trainingTime: '16:00', lastMeasure: '2026-11-01', today: '2026-11-15' };

describe('lembretes do Titan', () => {
  it('desligado = nenhum lembrete', () => { expect(plannedReminders({ ...base, enabled: false })).toEqual([]); });
  it('check-in todo dia; peso em jejum seg/qua/sex, no horário da manhã', () => {
    const r = plannedReminders(base).filter((x) => x.id < REMINDER_ID_BASE + 10);
    expect(r).toHaveLength(7);
    expect(r.every((x) => x.hour === 6 && x.minute === 45)).toBe(true);
    expect(r.filter((x) => /Pesar/.test(x.title)).map((x) => x.weekday)).toEqual([1, 3, 5]);
  });
  it('treino 30 min antes, só nos dias de treino', () => {
    const r = plannedReminders(base).filter((x) => /Treino/.test(x.title));
    expect(r.map((x) => x.weekday)).toEqual([1, 2, 4, 5]);
    expect(r.every((x) => x.hour === 15 && x.minute === 30)).toBe(true);
    expect(plannedReminders({ ...base, trainingTime: null }).some((x) => /Treino/.test(x.title))).toBe(false);
    expect(plannedReminders({ ...base, trainingTime: '00:10' }).find((x) => /Treino/.test(x.title))).toMatchObject({ hour: 23, minute: 40 });
  });
  it('dia de medir: 28 dias depois da última; se atrasou ou nunca mediu, amanhã', () => {
    const m = (i: Partial<ReminderInput>) => plannedReminders({ ...base, ...i }).find((x) => x.title === 'Dia de medir')!;
    expect(m({}).date).toBe('2026-11-29');
    expect(m({ lastMeasure: '2026-09-01' }).date).toBe('2026-11-16');
    expect(m({ lastMeasure: null }).date).toBe('2026-11-16');
    expect(m({ lastMeasure: null }).body).toMatch(/primeiras medidas/);
  });
  it('ids únicos dentro da faixa reservada', () => {
    const ids = plannedReminders(base).map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id >= REMINDER_ID_BASE && id < REMINDER_ID_BASE + 100)).toBe(true);
  });
});
