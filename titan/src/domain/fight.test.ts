import { describe, expect, it } from 'vitest';
import { ABSORB_TRUTH, FIGHT_MAX_MIN, fightDayOf, fightSession, fightWeek, reflexGap } from './fight';

describe('Luta em casa', () => {
  it('nenhuma sessão passa de 90 minutos, em qualquer plano e semana', () => {
    for (const protocol of ['jkk', 'jkk4', 'jkk3'] as const)
      for (let w = 1; w <= 8; w++)
        for (const day of ['sat', 'sun'] as const)
          for (const withRope of [true, false]) {
            const s = fightSession(day, { week: w, gymWeek: w, protocol, withRope, date: day === 'sat' ? '2026-11-14' : '2026-11-15' });
            expect(s.totalMinutes).toBeLessThanOrEqual(FIGHT_MAX_MIN);
            expect(s.totalMinutes).toBeGreaterThanOrEqual(45);
          }
  });
  it('só existe treino no sábado e no domingo', () => {
    expect(fightDayOf('2026-11-14')).toBe('sat');
    expect(fightDayOf('2026-11-15')).toBe('sun');
    expect(fightDayOf('2026-11-16')).toBeNull();
    expect(fightDayOf('2026-11-13')).toBeNull();
  });
  it('a corda do fim de semana fica dentro da luta (intervalada no sábado, contínua no domingo)', () => {
    expect(fightSession('sat', { week: 1, protocol: 'jkk4', date: '2026-11-14' }).rope).toBe('interval');
    expect(fightSession('sun', { week: 1, protocol: 'jkk4', date: '2026-11-15' }).rope).toBe('steady');
    // plano de 5 dias: sábado já tem academia, a corda vai para o domingo e o sábado ganha o aviso
    const sat5 = fightSession('sat', { week: 1, protocol: 'jkk', date: '2026-11-14' });
    expect(sat5.rope).toBeNull();
    expect(sat5.note).toMatch(/academia no sábado/);
    expect(fightSession('sun', { week: 1, protocol: 'jkk', date: '2026-11-15' }).rope).toBe('interval');
    expect(fightSession('sat', { week: 1, protocol: 'jkk4', withRope: false }).blocks.some((b) => b.id === 'rope')).toBe(false);
  });
  it('cobre fundamentos, pés, reflexo, oportunidade, defesa, MMA, aprender a apanhar e sentidos', () => {
    const ids = [...fightSession('sat', { week: 3 }).blocks, ...fightSession('sun', { week: 3 }).blocks].map((b) => b.id);
    for (const id of ['fund', 'feet', 'reflex', 'counter', 'defense', 'mma', 'absorb', 'senses']) expect(ids).toContain(id);
  });
  it('progressão: semanas 5–8 trazem combinações maiores e reflexo mais rápido', () => {
    const early = fightSession('sat', { week: 2 }).blocks.find((b) => b.id === 'fund')!.drills.join(' ');
    const late = fightSession('sat', { week: 6 }).blocks.find((b) => b.id === 'fund')!.drills.join(' ');
    expect(early).not.toMatch(/uppercut/);
    expect(late).toMatch(/uppercut/);
    expect(reflexGap(7)[1]).toBeLessThan(reflexGap(1)[1]);
  });
  it('semana da luta conta a partir do início e recomeça depois de 8', () => {
    expect(fightWeek(undefined, '2026-11-14')).toBe(1);
    expect(fightWeek('2026-11-14', '2026-11-14')).toBe(1);
    expect(fightWeek('2026-11-14', '2026-11-22')).toBe(2);
    expect(fightWeek('2026-11-14', '2027-01-09')).toBe(1);
  });
  it('aprender a apanhar é seguro: sem levar pancada de propósito, com sinais de alerta', () => {
    expect(ABSORB_TRUTH.points.join(' ')).toMatch(/nunca para levar pancada de propósito/);
    expect(ABSORB_TRUTH.stop).toMatch(/visão dupla/);
    const absorb = fightSession('sun', { week: 1 }).blocks.find((b) => b.id === 'absorb')!;
    expect(absorb.drills.join(' ')).toMatch(/queixo NO PEITO/);
  });
});
