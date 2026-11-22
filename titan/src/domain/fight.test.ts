import { describe, expect, it } from 'vitest';
import {
  ABSORB_TRUTH, ABS_MUSCLES, ABS_WORKOUTS, FIGHT_MAX_MIN, MOVES, MOVE_BY_ID, RETURN_WEEKS, absWorkout, blockSteps, exerciseSeconds, fightDayOf, fightSession,
  fightWeek, reflexGap, sessionSteps, stepsSeconds,
} from './fight';

const all = () => {
  const out = [];
  for (const protocol of ['jkk', 'jkk4', 'jkk3'] as const) for (let w = 1; w <= 8; w++) for (const day of ['sat', 'sun'] as const) for (const withRope of [true, false]) {
    out.push(fightSession(day, { week: w, gymWeek: w, protocol, withRope, date: day === 'sat' ? '2026-11-14' : '2026-11-15' }));
  }
  return out;
};

describe('Luta em casa', () => {
  it('nenhuma sessão passa de 90 minutos, em qualquer plano e semana (contando todos os descansos e trocas)', () => {
    for (const s of all()) {
      expect(s.totalMinutes).toBeLessThanOrEqual(FIGHT_MAX_MIN);
      expect(s.totalMinutes).toBeGreaterThanOrEqual(45);
      expect(Math.round(stepsSeconds(sessionSteps(s)) / 60)).toBe(s.totalMinutes);
    }
  });
  it('TUDO tem cronômetro: cada passo (aquecimento, série, round, descanso, troca) tem segundos > 0', () => {
    for (const s of all()) {
      const steps = sessionSteps(s);
      expect(steps.every((x) => x.seconds > 0)).toBe(true);
      // cada exercício de cada bloco aparece no cronômetro guiado, com todas as séries
      for (const b of s.blocks) for (const e of b.exercises) {
        const work = steps.filter((x) => x.exerciseId === e.id && x.phase === 'work').length;
        expect(work, `${b.id}/${e.id}`).toBe(e.sets * (e.perSide ? 2 : 1));
      }
      expect(steps[0].phase).toBe('prep');
    }
  });
  it('descansos entre séries e trocas de lado e de bloco entram no cronômetro', () => {
    const s = fightSession('sat', { week: 3 });
    const steps = sessionSteps(s);
    const boxing = steps.filter((x) => x.exerciseId === 'boxing');
    expect(boxing.map((x) => `${x.phase}${x.seconds}`)).toEqual(['rest25', 'work180', 'rest60', 'work180', 'rest60', 'work180']);
    const chest = steps.filter((x) => x.exerciseId === 'chest');
    expect(chest.map((x) => x.side ?? x.phase)).toEqual(['rest', 'direito', 'esquerdo', 'esquerdo']);
    expect(steps.some((x) => x.title.startsWith('Próximo bloco'))).toBe(true);
  });
  it('só existe treino no sábado e no domingo', () => {
    expect(fightDayOf('2026-11-14')).toBe('sat');
    expect(fightDayOf('2026-11-15')).toBe('sun');
    expect(fightDayOf('2026-11-16')).toBeNull();
  });
  it('a corda do fim de semana fica dentro da luta (intervalada no sábado, contínua no domingo)', () => {
    expect(fightSession('sat', { week: 1, protocol: 'jkk4', date: '2026-11-14' }).rope).toBe('interval');
    expect(fightSession('sun', { week: 1, protocol: 'jkk4', date: '2026-11-15' }).rope).toBe('steady');
    const sat5 = fightSession('sat', { week: 1, protocol: 'jkk', date: '2026-11-14' });
    expect(sat5.rope).toBeNull();
    expect(sat5.note).toMatch(/academia no sábado/);
    expect(fightSession('sat', { week: 1, protocol: 'jkk4', withRope: false }).blocks.some((b) => b.id === 'rope')).toBe(false);
  });
  it('cobre boxe, Muay Thai, pés, reflexo, contra-ataque, defesa, clinch/MMA, aprender a apanhar, sentidos e abdômen', () => {
    const ids = [...fightSession('sat', { week: 3 }).blocks, ...fightSession('sun', { week: 3 }).blocks].map((b) => b.id);
    for (const id of ['warmup', 'boxing', 'muaythai', 'feet', 'reflex', 'counter', 'defense', 'clinch', 'absorb', 'senses', 'absA', 'absB', 'cooldown']) expect(ids).toContain(id);
  });
  it('retorno (semanas 1–2): técnica a 60–70%, chutes devagar; depois progride', () => {
    const w1 = fightSession('sat', { week: 1 });
    expect(w1.returnPhase).toBe(true);
    expect(w1.blocks.find((b) => b.id === 'muaythai')!.goal).toMatch(/Nada de força máxima/);
    expect(fightSession('sat', { week: RETURN_WEEKS + 1 }).returnPhase).toBe(false);
    const late = fightSession('sat', { week: 6 }).blocks.find((b) => b.id === 'boxing')!.exercises[0];
    expect(late.moves).toContain('uppercut');
    expect(reflexGap(7)[1]).toBeLessThan(reflexGap(1)[1]);
  });
  it('todo golpe citado nos treinos tem explicação simples (3 passos + erro comum)', () => {
    for (const s of all()) for (const b of s.blocks) for (const e of b.exercises) {
      expect(e.how.length, e.id).toBeGreaterThanOrEqual(1);
      for (const m of e.moves ?? []) expect(MOVE_BY_ID[m], m).toBeTruthy();
    }
    for (const m of MOVES) { expect(m.steps.length).toBe(3); expect(m.error.length).toBeGreaterThan(10); }
    expect(MOVES.filter((m) => m.group === 'Muay Thai').map((m) => m.id)).toEqual(expect.arrayContaining(['teep', 'roundhouse', 'knee', 'elbow', 'clinch']));
  });
  it('semana da luta conta a partir do início e recomeça depois de 8', () => {
    expect(fightWeek(undefined, '2026-11-14')).toBe(1);
    expect(fightWeek('2026-11-14', '2026-11-22')).toBe(2);
    expect(fightWeek('2026-11-14', '2027-01-09')).toBe(1);
  });
  it('aprender a apanhar é seguro: sem levar pancada de propósito, com sinais de alerta', () => {
    expect(ABSORB_TRUTH.points.join(' ')).toMatch(/nunca para levar pancada de propósito/);
    expect(ABSORB_TRUTH.stop).toMatch(/visão dupla/);
    const absorb = fightSession('sun', { week: 1 }).blocks.find((b) => b.id === 'absorb')!;
    expect(absorb.exercises.map((e) => e.id)).toEqual(['breakfall', 'sidefall', 'neckiso', 'composure']);
  });
});

describe('Abdômen', () => {
  it('A, B e C juntos cobrem todos os músculos do abdômen (reto, infra, oblíquos, transverso e lombar)', () => {
    const covered = new Set(ABS_WORKOUTS.flatMap((w) => w.exercises.flatMap((e) => e.muscles ?? [])));
    for (const m of Object.keys(ABS_MUSCLES)) expect(covered.has(m), m).toBe(true);
  });
  it('cada exercício tem séries, tempo (cronômetro), descanso e explicação', () => {
    for (const w of ABS_WORKOUTS) for (const e of w.exercises) {
      expect(e.sets).toBeGreaterThanOrEqual(2);
      expect(e.workSec).toBeGreaterThanOrEqual(20);
      expect(e.restSec).toBeGreaterThanOrEqual(15);
      expect(e.how.length).toBeGreaterThanOrEqual(2);
      expect(exerciseSeconds(e)).toBeGreaterThan(0);
    }
  });
  it('treinos de 10 a 16 min e progridem (+tempo nas semanas 3–4, +tempo e +1 série a partir da 5)', () => {
    for (const id of ['A', 'B', 'C'] as const) {
      const w1 = absWorkout(id, 1); const w3 = absWorkout(id, 3); const w5 = absWorkout(id, 5);
      const min = (b: typeof w1) => Math.round(stepsSeconds(blockSteps([b])) / 60);
      expect(min(w1)).toBeGreaterThanOrEqual(10);
      expect(min(w5)).toBeLessThanOrEqual(16);
      expect(w3.exercises[0].workSec).toBe(w1.exercises[0].workSec + 5);
      expect(w5.exercises[0].sets).toBe(w1.exercises[0].sets + 1);
    }
  });
  it('abdômen A no sábado e B no domingo, dentro da luta', () => {
    expect(fightSession('sat', { week: 1 }).abs).toBe('A');
    expect(fightSession('sun', { week: 1 }).blocks.some((b) => b.id === 'absB')).toBe(true);
  });
});
