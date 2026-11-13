import { describe, expect, it } from 'vitest';
import { FINISHERS, finisherFor, ropeFor, ropeSession } from './recomp';
import { JKK3_DAYS, JKK4_DAYS, JKK_DAYS, generateJkk } from './jkk';
import { EXERCISE_BY_KEY } from './exercises';
import { dayStatus, type MissionData } from './mission';
import type { CheckinRow, ProgramRow } from './types';

describe('finalizador funcional (modo recomposição)', () => {
  it('no máximo 3 por semana e nunca em dia de perna', () => {
    const legs = new Set(['quads', 'hamstrings', 'glutes', 'calves']);
    for (const [p, days] of [['jkk', JKK_DAYS], ['jkk4', JKK4_DAYS]] as const) {
      const withFin = days.map((_, i) => finisherFor(p, i)).filter(Boolean);
      expect(withFin.length).toBeLessThanOrEqual(3);
      days.forEach((d, i) => {
        if (!finisherFor(p, i)) return;
        const first = EXERCISE_BY_KEY[d.rows[0][0]].primary;
        expect(legs.has(first), `${p} dia ${i + 1}`).toBe(false);
      });
    }
    expect(JKK3_DAYS.map((_, i) => finisherFor('jkk3', i)).filter(Boolean)).toHaveLength(3);
  });
  it('some em semana de deload e dura 8 minutos', () => {
    expect(finisherFor('jkk4', 0, true)).toBeNull();
    expect(finisherFor('jkk4', 1)).toBeNull(); // Inferior A
    FINISHERS.forEach((f) => { expect(f.minutes).toBe(8); expect(f.moves.length).toBeGreaterThanOrEqual(3); });
  });
});

describe('pular corda', () => {
  it('progressão de 8 semanas: séries, tempo pulando e descanso', () => {
    expect(ropeSession('interval', 1)).toMatchObject({ rounds: 8, workSec: 30, restSec: 60, mainMinutes: 12, totalJumpMinutes: 4 });
    expect(ropeSession('interval', 4)).toMatchObject({ rounds: 10, workSec: 40, restSec: 50 });
    expect(ropeSession('interval', 8)).toMatchObject({ rounds: 12, workSec: 60, restSec: 30, totalJumpMinutes: 12 });
    expect(ropeSession('steady', 1)).toMatchObject({ rounds: 4, workSec: 120, restSec: 60 });
    expect(ropeSession('steady', 8)).toMatchObject({ rounds: 5, workSec: 180, totalJumpMinutes: 15 });
    expect(ropeSession('interval', 99).rounds).toBe(12); // depois da semana 8 mantém o topo
  });
  it('o tempo pulando nunca diminui de uma semana para a outra', () => {
    for (const k of ['interval', 'steady'] as const) {
      for (let w = 2; w <= 8; w++) expect(ropeSession(k, w).totalJumpMinutes).toBeGreaterThanOrEqual(ropeSession(k, w - 1).totalJumpMinutes);
    }
  });
  it('dias: 3 e 4 dias → sábado intervalada e domingo contínua; 5 dias → só domingo', () => {
    // 2026-11-14 é sábado, 2026-11-15 é domingo, 2026-11-16 é segunda
    expect([ropeFor('jkk4', '2026-11-14'), ropeFor('jkk4', '2026-11-15'), ropeFor('jkk4', '2026-11-16')]).toEqual(['interval', 'steady', null]);
    expect([ropeFor('jkk3', '2026-11-14'), ropeFor('jkk3', '2026-11-15')]).toEqual(['interval', 'steady']);
    expect([ropeFor('jkk', '2026-11-14'), ropeFor('jkk', '2026-11-15')]).toEqual([null, 'interval']);
  });
});

describe('Missão: corda só no modo recomposição e só em dia de corda', () => {
  const program = { id: 'p', config: generateJkk('jkk4') } as unknown as ProgramRow;
  const base: MissionData = { program, sessions: [], foodLogs: [], target: null, careLogs: [], checkins: [], hasSkinRoutine: false };
  it('não aparece no modo ganhar massa', () => {
    expect(dayStatus({ ...base, goal: 'gain' }, '2026-11-14').items.some((i) => i.habit.id === 'rope')).toBe(false);
  });
  it('sábado pendente, marcado quando registrado; segunda não se aplica', () => {
    const d = { ...base, goal: 'recomp' as const };
    expect(dayStatus(d, '2026-11-14').items.find((i) => i.habit.id === 'rope')?.done).toBe(false);
    const done = { ...d, checkins: [{ date: '2026-11-14', habits: { rope: true } } as unknown as CheckinRow] };
    expect(dayStatus(done, '2026-11-14').items.find((i) => i.habit.id === 'rope')?.done).toBe(true);
    expect(dayStatus(d, '2026-11-16').items.find((i) => i.habit.id === 'rope')?.done).toBeNull();
  });
});
