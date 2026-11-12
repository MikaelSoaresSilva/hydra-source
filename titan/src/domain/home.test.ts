import { describe, expect, it } from 'vitest';
import { EXERCISE_BY_KEY, bodyweightAlternativesFor, isBodyweight } from './exercises';
import { HOME_PROGRESSION, HOME_SESSIONS, homeSession } from './home';
import { JKK4_DAYS, JKK_DAYS, JKK_WEEKS, generateJkk } from './jkk';
import { adjustNextSet, suggestProgression } from './progression';
import { buildHomePlan } from '../services';
import type { Muscle } from './types';

describe('treino em casa (peso do corpo)', () => {
  it('existe uma sessão em casa para cada dia dos dois planos', () => {
    expect(HOME_SESSIONS.jkk).toHaveLength(JKK_DAYS.length);
    expect(HOME_SESSIONS.jkk4).toHaveLength(JKK4_DAYS.length);
  });
  it('todo exercício é sem equipamento, existe na biblioteca e tem como progredir', () => {
    for (const s of [...HOME_SESSIONS.jkk, ...HOME_SESSIONS.jkk4]) {
      for (const [key] of s.rows) {
        expect(EXERCISE_BY_KEY[key], key).toBeDefined();
        expect(isBodyweight(EXERCISE_BY_KEY[key]), key).toBe(true);
        expect(HOME_PROGRESSION[key], key).toBeTruthy();
      }
    }
  });
  it('cada sessão em casa treina os mesmos músculos principais do dia da academia', () => {
    const main = (keys: string[]) => new Set(keys.map((k) => EXERCISE_BY_KEY[k].primary));
    // músculos que só dá para treinar de forma indireta/isométrica sem equipamento
    const same: Partial<Record<Muscle, Muscle>> = { side_delts: 'side_delts', forearms: 'forearms' };
    for (const [protocol, days] of [['jkk', JKK_DAYS], ['jkk4', JKK4_DAYS]] as const) {
      days.forEach((d, i) => {
        const gym = main(d.rows.map((r) => r[0]));
        const home = main(HOME_SESSIONS[protocol][i].rows.map((r) => r[0]));
        for (const m of gym) expect(home.has(same[m] ?? m), `${protocol} dia ${i + 1}: ${m}`).toBe(true);
      });
    }
  });
  it('volume em casa perto do dia da academia (≥ 85% das séries)', () => {
    for (const [protocol, days] of [['jkk', JKK_DAYS], ['jkk4', JKK4_DAYS]] as const) {
      days.forEach((d, i) => {
        const gym = d.rows.reduce((t, r) => t + r[2], 0);
        const home = HOME_SESSIONS[protocol][i].rows.reduce((t, r) => t + r[1], 0);
        expect(home, `${protocol} dia ${i + 1}`).toBeGreaterThanOrEqual(Math.floor(gym * 0.85));
      });
    }
  });
  it('monta a sessão com peso 0, RIR 1, aquecimento no 1º exercício e isométricos em segundos', () => {
    const program = { id: 'p', weeks: JKK_WEEKS, config: generateJkk('jkk4') } as never;
    const plan = buildHomePlan(program, 1, 0, [])!;
    expect(plan[0].name).toBe('Flexão declinada (pés na cadeira)');
    expect(plan.every((p) => p.loadSuggestion === 0 && p.rir === 1)).toBe(true);
    expect(plan[0].warmup).toMatch(/5 min de aquecimento/);
    expect(plan.find((p) => p.exerciseKey === 'hb_door_lateral_iso')?.unit).toBe('s');
    expect(plan[0].note).toMatch(/Para progredir:/);
  });
  it('em semana de deload, metade das séries também em casa', () => {
    const program = { id: 'p', weeks: JKK_WEEKS, config: generateJkk('jkk') } as never;
    const normal = buildHomePlan(program, 3, 0, [])!;
    const deload = buildHomePlan(program, 8, 0, [])!;
    deload.forEach((p, i) => expect(p.sets).toBe(Math.max(1, Math.ceil(normal[i].sets / 2))));
  });
  it('protocolo sem versão em casa devolve null', () => {
    expect(homeSession({ ...generateJkk('jkk'), protocol: 'olympia' }, 0)).toBeNull();
  });
  it('progressão sem carga: topo da faixa pede variação mais difícil, não "+0 kg"', () => {
    const ex = EXERCISE_BY_KEY.hb_decline_push_up;
    const top = { sessionId: 's', date: '2026-11-10', sets: [1, 2, 3, 4].map(() => ({ load_kg: 0, reps: 15, rir: 1, technique_ok: true, pain: 0, kind: 'working' as const })) };
    const sug = suggestProgression(ex, 1, [top]);
    expect(sug.action).toBe('increase');
    expect(sug.reason).toMatch(/mais difícil/);
    expect(sug.reason).not.toMatch(/\+0 kg/);
    expect(adjustNextSet(ex, 1, { load: 0, reps: 20, rir: 4 }).message).toMatch(/desça mais devagar|variação mais difícil/);
    expect(adjustNextSet(ex, 1, { load: 0, reps: 3, rir: 0 }).message).toMatch(/versão mais fácil/);
  });
  it('troca em casa só oferece exercícios sem equipamento', () => {
    const alts = bodyweightAlternativesFor('hb_table_row');
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every(isBodyweight)).toBe(true);
  });
});
