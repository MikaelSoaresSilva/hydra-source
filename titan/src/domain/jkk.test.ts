import { describe, expect, test } from 'vitest';
import { JKK_DAYS, JKK_WEEKS, generateJkk, jkkPhase } from './jkk';
import { EXERCISE_BY_KEY } from './exercises';
import { phaseFor, prescribeDay } from './program';
import { buildSessionPlan } from '../services';

describe('Protocolo JKK (fiel ao PDF)', () => {
  const c = generateJkk();
  test('5 dias na ordem do documento: seg, ter, qua, sex, sáb', () => {
    expect(c.days.map((d) => d.dayIndex)).toEqual([1, 2, 3, 5, 6]);
    expect(c.days.map((d) => d.name)).toEqual([
      'Dia 1 · Peito superior + Ombros + Tríceps', 'Dia 2 · Pernas A (quadríceps)', 'Dia 3 · Costas + Bíceps + Antebraço',
      'Dia 4 · Pernas B (posterior + glúteo)', 'Dia 5 · Braços + Peito central',
    ]);
    expect(c.locked).toBe(true);
  });
  // O cabeçalho do Dia 3 no PDF diz "22 séries", mas os exercícios listados somam 21 (bi-set de punho = 2 × 2).
  // O app segue os exercícios listados, sem inventar uma série a mais.
  test('total de séries por dia igual à soma dos exercícios do documento (20, 22, 21, 21, 23)', () => {
    expect(c.days.map((d) => d.slots.reduce((s, x) => s + x.sets, 0))).toEqual([20, 22, 21, 21, 23]);
  });
  test('todo exercício existe na biblioteca e mantém nome, faixa e orientação do PDF', () => {
    JKK_DAYS.forEach((d, i) => d.rows.forEach(([key, label, sets, range, , restText, note], j) => {
      expect(EXERCISE_BY_KEY[key], key).toBeDefined();
      const s = c.days[i].slots[j];
      expect([s.label, s.sets, s.repRange, s.restText, s.note]).toEqual([label, sets, range, restText, note]);
    }));
  });
  test('sessão montada usa o nome e a faixa do PDF (não os padrões do app) e aquecimento só no 1º exercício', () => {
    const program = { id: 'p', weeks: JKK_WEEKS, config: c } as never;
    const plan = buildSessionPlan(program, 1, 0, [], [], null);
    expect(plan[0].name).toBe('Supino inclinado com halteres (30°)');
    expect(plan[0].repRange).toEqual([6, 10]);
    expect(plan[0].warmup).toMatch(/2 séries leves \(50% e 75% da carga\)/);
    expect(plan[1].warmup).toBe('');
    expect(plan.map((p) => p.sets)).toEqual([4, 3, 3, 4, 3, 3]);
  });
  test('deload: metade das séries e MESMAS cargas, na semana 8 ou antes (6–7) se aplicado', () => {
    expect(jkkPhase(5).deload).toBe(false);
    expect(jkkPhase(8).deload).toBe(true);
    expect(jkkPhase(6, [6]).deload).toBe(true);
    expect(jkkPhase(8, [6]).deload).toBe(false);
    const cfg = { ...c, deloadWeeks: [7] };
    expect(phaseFor(cfg, 7, JKK_WEEKS).deload).toBe(true);
    expect(prescribeDay(cfg, 0, 7, JKK_WEEKS).map((s) => s.sets)).toEqual([2, 2, 2, 2, 2, 2]);
    const logs = [{ session_id: 'x', exercise_key: 'incline_db_press', logged_at: '2026-10-20T17:00:00Z', load_kg: 24, reps: 8, rir: 2, kind: 'working', technique_ok: true, pain: 0 }] as never;
    const plan = buildSessionPlan({ id: 'p', weeks: JKK_WEEKS, config: cfg } as never, 7, 0, [], logs, null);
    expect(plan[0].loadSuggestion).toBe(24);
  });
  test('prancha lateral em segundos', () => {
    const plank = c.days[3].slots.find((s) => s.exerciseKey === 'side_plank')!;
    expect([plank.unit, plank.repRange, plank.restText]).toEqual(['s', [30, 45], 'cada lado']);
  });
});
