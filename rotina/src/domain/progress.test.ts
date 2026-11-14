import { describe, expect, it } from 'vitest';
import { defaultState } from './defaults';
import { ACHIEVEMENTS, bestStreak, levelInfo, sleepRegularity, streak, syncDayLog, toggleDone, totalXp, unlockAchievements, weekProgress, xpFor } from './progress';
import { buildDay } from './scheduler';
import { addDays } from './time';
import type { State } from './types';

const MON = '2026-11-16';
const s0 = () => defaultState(new Date('2026-11-14T10:00:00'));
function completeAll(s: State, date: string, frac = 1): State {
  const plan = buildDay(s, date);
  let x = s;
  plan.items.slice(0, Math.ceil(plan.items.length * frac)).forEach((it) => { x = toggleDone(x, date, it, new Date(`${date}T12:00:00`), it.start); });
  return x;
}

describe('XP e níveis', () => {
  it('XP por prioridade + bônus no horário', () => {
    const it = buildDay(s0(), MON).items.find((i) => i.activity.title === 'Almoço')!;
    expect(xpFor(it, it.start + 5)).toEqual({ xp: 25, onTime: true });
    expect(xpFor(it, it.start + 300)).toEqual({ xp: 20, onTime: false });
  });
  it('marcar e desmarcar', () => {
    const s = s0();
    const it = buildDay(s, MON).items[0];
    const a = toggleDone(s, MON, it, new Date(), it.start);
    expect(totalXp(a)).toBeGreaterThan(0);
    expect(a.dayLog[MON].done).toBe(1);
    const b = toggleDone(a, MON, it, new Date(), it.start);
    expect(totalXp(b)).toBe(0);
    expect(b.dayLog[MON].done).toBe(0);
  });
  it('níveis', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(300).level).toBe(3);
    expect(levelInfo(1000).level).toBe(5);
    expect(levelInfo(150).pct).toBeCloseTo(0.25);
  });
});

describe('sequência e metas', () => {
  it('dias seguidos com 80%+', () => {
    let s = s0();
    for (let i = 0; i < 4; i++) s = completeAll(s, addDays(MON, i));
    expect(streak(s, addDays(MON, 3))).toBe(4);
    // hoje em andamento não quebra
    expect(streak(s, addDays(MON, 4))).toBe(4);
    s = completeAll(s, addDays(MON, 5), 0.5); // dia fraco
    expect(streak(s, addDays(MON, 6))).toBe(0);
    expect(bestStreak(s)).toBe(4);
    expect(weekProgress(s, addDays(MON, 6)).hit).toBe(4);
  });
  it('conquistas desbloqueiam uma vez e dão +50 XP', () => {
    let s = completeAll(s0(), MON);
    const before = totalXp(s);
    const r = unlockAchievements(s, MON);
    expect(r.unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(['first', 'perfect']));
    s = r.state;
    expect(totalXp(s)).toBe(before + 50 * r.unlocked.length);
    expect(unlockAchievements(s, MON).unlocked).toEqual([]);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(12);
  });
  it('registro do dia guarda planejado/feito por categoria', () => {
    const s = syncDayLog(s0(), MON);
    expect(s.dayLog[MON].planned).toBe(buildDay(s, MON).items.length);
    expect(s.dayLog[MON].cats.nutrition[0]).toBeGreaterThanOrEqual(4);
  });
});

describe('sono', () => {
  it('regularidade pelos horários reais de acordar', () => {
    let s = s0();
    const wake = s.activities.find((a) => a.kind === 'wake')!;
    const bed = s.activities.find((a) => a.kind === 'bed')!;
    for (let i = 0; i < 6; i++) {
      const d = addDays(MON, i);
      s = { ...s, completions: { ...s.completions, [d]: { ...s.completions[d], [wake.id]: { at: new Date(`${d}T07:0${i % 3}:00`).toISOString(), xp: 25, onTime: true }, [bed.id]: { at: new Date(`${d}T22:30:00`).toISOString(), xp: 20, onTime: true } } } };
    }
    const r = sleepRegularity(s, addDays(MON, 6));
    expect(r.score).toBeGreaterThan(90);
    expect(r.avgSleep).toBeGreaterThan(8 * 60);
    expect(r.avgSleep).toBeLessThan(9 * 60);
  });
});
