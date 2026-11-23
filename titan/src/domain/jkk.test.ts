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

describe('JKK em 4 dias', () => {
  test('seg, ter, qui, sex; travado; mesmo texto do PDF em cada exercício', async () => {
    const { JKK4_DAYS, JKK4_TRAINING_DAYS } = await import('./jkk');
    const c = generateJkk('jkk4');
    expect(c.protocol).toBe('jkk4');
    expect(c.locked).toBe(true);
    expect(c.days.map((d) => d.dayIndex)).toEqual(JKK4_TRAINING_DAYS);
    expect(JKK4_TRAINING_DAYS).toEqual([1, 2, 4, 5]);
    const original = new Map(JKK_DAYS.flatMap((d) => d.rows).map((r) => [r[0], r]));
    JKK4_DAYS.flatMap((d) => d.rows).forEach((r) => {
      const o = original.get(r[0])!;
      expect([r[1], r[3], r[5], r[6], r[7]]).toEqual([o[1], o[3], o[5], o[6], o[7]]); // nome, faixa, descanso, orientação, origem
    });
  });
  test('todo exercício do JKK de 5 dias está no de 4 dias', async () => {
    const { JKK4_DAYS } = await import('./jkk');
    const four = new Set(JKK4_DAYS.flatMap((d) => d.rows.map((r) => r[0])));
    JKK_DAYS.flatMap((d) => d.rows).forEach((r) => expect(four.has(r[0]), r[0]).toBe(true));
  });
  test('volume semanal e frequência de cada músculo ≥ ao JKK de 5 dias; costas sobem para 2x', async () => {
    const { JKK4_DAYS, weeklyDirect } = await import('./jkk');
    const five = weeklyDirect(JKK_DAYS);
    const four = weeklyDirect(JKK4_DAYS);
    for (const m of Object.keys(five)) {
      expect(four[m].sets, m).toBeGreaterThanOrEqual(five[m].sets);
      expect(four[m].days, m).toBeGreaterThanOrEqual(five[m].days);
    }
    expect([five.back.days, four.back.days]).toEqual([1, 2]);
    expect(four.side_delts.sets).toBe(8);
  });
  test('mesmas regras do PDF: deload na semana 8 com metade das séries e mesmas cargas', () => {
    const c = generateJkk('jkk4');
    expect(phaseFor(c, 8, JKK_WEEKS).deload).toBe(true);
    expect(phaseFor(c, 3, JKK_WEEKS).deload).toBe(false);
    const plan = buildSessionPlan({ id: 'p', weeks: JKK_WEEKS, config: c } as never, 1, 0, [], [], null);
    expect(plan[0].name).toBe('Supino inclinado com halteres (30°)');
    expect(plan[0].warmup).toMatch(/2 séries leves/);
  });
});

describe('guardar e voltar ao JKK de 5 dias', () => {
  test('ao voltar, o ciclo arquivado é reativado na mesma semana (não começa do zero)', async () => {
    const { LocalStore } = await import('../data/store');
    const { activateProtocol } = await import('../services');
    const { EMPTY_PROFILE } = await import('../data/AppContext');
    const store = await LocalStore.open(`u-${Math.random()}`);
    const profile = EMPTY_PROFILE(store.userId);
    const five = await activateProtocol(store, profile, 'jkk');
    await store.upsert('workout_sessions', { id: 's1', program_id: five.id, week: 1, day_index: 1, sequence: 0, status: 'done', exercises: [] });
    const four = await activateProtocol(store, profile, 'jkk4');
    expect(four.config.protocol).toBe('jkk4');
    const back = await activateProtocol(store, profile, 'jkk');
    expect(back.id).toBe(five.id); // mesmo ciclo, com o histórico
    const active = await store.list<{ id: string }>('programs', { eq: { status: 'active' } });
    expect(active.map((p) => p.id)).toEqual([five.id]);
  });
});

describe('JKK em 3 dias (corpo inteiro)', () => {
  test('seg, qua, sex; travado; 28 séries e ~95 min por treino; texto do PDF em cada exercício', async () => {
    const { JKK3_DAYS, JKK3_TRAINING_DAYS } = await import('./jkk');
    const c = generateJkk('jkk3');
    expect([c.protocol, c.locked, c.sessionMinutes]).toEqual(['jkk3', true, 95]);
    expect(c.days.map((d) => d.dayIndex)).toEqual(JKK3_TRAINING_DAYS);
    expect(JKK3_TRAINING_DAYS).toEqual([1, 3, 5]);
    expect(c.days.map((d) => d.slots.reduce((t, s) => t + s.sets, 0))).toEqual([28, 28, 28]);
    JKK3_DAYS.forEach((d) => expect(d.meta).toMatch(/~95 min · 28 séries/));
    const original = new Map(JKK_DAYS.flatMap((d) => d.rows).map((r) => [r[0], r]));
    JKK3_DAYS.flatMap((d) => d.rows).forEach((r) => {
      const o = original.get(r[0])!;
      expect([r[1], r[3], r[5], r[6], r[7]]).toEqual([o[1], o[3], o[5], o[6], o[7]]);
    });
    // nenhum exercício repetido no mesmo dia
    c.days.forEach((d) => expect(new Set(d.slots.map((s) => s.exerciseKey)).size).toBe(d.slots.length));
  });
  test('prioridades (braços, ombro, peito superior) com o mesmo volume do plano de 5 dias e mais frequência', async () => {
    const { JKK3_DAYS, weeklyDirect } = await import('./jkk');
    const five = weeklyDirect(JKK_DAYS);
    const three = weeklyDirect(JKK3_DAYS);
    for (const m of ['biceps', 'triceps', 'brachialis', 'side_delts']) {
      expect(three[m].sets, m).toBeGreaterThanOrEqual(five[m].sets);
    }
    for (const m of ['biceps', 'triceps', 'chest', 'back', 'quads']) expect(three[m].days, m).toBe(3);
    // peito superior: inclinado halteres + inclinado Smith + crucifixo de baixo para cima = 10 séries, como no PDF
    const upper = JKK3_DAYS.flatMap((d) => d.rows).filter((r) => ['incline_db_press', 'incline_smith_press', 'low_high_cable_fly'].includes(r[0])).reduce((t, r) => t + r[2], 0);
    expect(upper).toBe(10);
    // pernas continuam com volume útil (≥ 10 séries de quadríceps)
    expect(three.quads.sets).toBeGreaterThanOrEqual(10);
  });
  test('bíceps em 3 posições (alongado, Scott, Bayesian) e tríceps acima da cabeça em 2 dias', async () => {
    const { JKK3_DAYS } = await import('./jkk');
    const keys = JKK3_DAYS.map((d) => d.rows.map((r) => r[0]));
    expect(keys[0]).toContain('incline_db_curl');
    expect(keys[1]).toContain('preacher_curl_machine');
    expect(keys[2]).toContain('bayesian_cable_curl');
    expect(keys.filter((k) => k.includes('overhead_cable_extension') || k.includes('db_overhead_extension'))).toHaveLength(2);
  });
  test('mesmas regras do PDF e treino em casa para cada dia', async () => {
    const { HOME_SESSIONS } = await import('./home');
    const c = generateJkk('jkk3');
    expect(phaseFor(c, 8, JKK_WEEKS).deload).toBe(true);
    expect(HOME_SESSIONS.jkk3).toHaveLength(3);
    const plan = buildSessionPlan({ id: 'p', weeks: JKK_WEEKS, config: c } as never, 1, 2, [], [], null);
    expect(plan[0].name).toBe('Rosca Bayesian no cabo');
    expect(plan[0].warmup).toMatch(/2 séries leves/);
  });
});

describe('alternar entre 3, 4 e 5 dias', () => {
  test('cada plano guarda o próprio ciclo; a revisão automática vale para 3 e 4 dias', async () => {
    const { LocalStore } = await import('../data/store');
    const { activateProtocol, reviewAfterMeasurement } = await import('../services');
    const { EMPTY_PROFILE } = await import('../data/AppContext');
    const store = await LocalStore.open(`t3-${Math.random()}`);
    const profile = EMPTY_PROFILE(store.userId);
    const four = await activateProtocol(store, profile, 'jkk4');
    const three = await activateProtocol(store, profile, 'jkk3');
    expect(three.name).toBe('Protocolo JKK — 3 dias');
    expect(await reviewAfterMeasurement(store, null, '2026-11-12')).not.toBeNull();
    const five = await activateProtocol(store, profile, 'jkk');
    expect(await reviewAfterMeasurement(store, null, '2026-11-12')).toBeNull();
    expect((await activateProtocol(store, profile, 'jkk3')).id).toBe(three.id);
    expect((await activateProtocol(store, profile, 'jkk4')).id).toBe(four.id);
    expect((await activateProtocol(store, profile, 'jkk')).id).toBe(five.id);
  });
});
