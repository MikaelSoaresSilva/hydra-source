import { describe, expect, it } from 'vitest';
import { MAX_CHANGES, VARIATIONS, regionGrowth, reviewProgram } from './autoReview';
import { EXERCISE_BY_KEY } from './exercises';
import { generateJkk } from './jkk';
import type { MetricRow, SetLogRow } from './types';

const TODAY = '2026-11-09';
const config = generateJkk('jkk4');
const metric = (date: string, v: Partial<MetricRow>) => ({ id: date, date, weight_kg: null, arm_right_cm: null, arm_left_cm: null, chest_cm: null, waist_cm: null, thigh_cm: null, shoulders_cm: null, conditions: {}, notes: null, ...v }) as MetricRow;
/** 4 sessões do exercício sem progredir (mesma carga e reps), uma por semana. */
function flat(key: string, pain = 0, reps = 10): SetLogRow[] {
  return ['2026-10-13', '2026-10-20', '2026-10-27', '2026-11-03'].map((d, i) => ({
    id: `${key}${i}`, session_id: `${key}-s${i}`, exercise_key: key, exercise_name: key, muscle: '', set_index: 0, kind: 'working',
    load_kg: 20, reps, rir: 2, technique_ok: true, pain, notes: null, logged_at: `${d}T17:00:00Z`,
  })) as unknown as SetLogRow[];
}
/** Progredindo: +1 rep por semana. */
function progressing(key: string): SetLogRow[] {
  return flat(key).map((l, i) => ({ ...l, reps: 8 + i }));
}
const slotOf = (cfg: typeof config, key: string) => cfg.days.flatMap((d) => d.slots).find((s) => s.exerciseKey === key);

describe('revisão automática do treino de 4 dias', () => {
  it('toda variação existe na biblioteca e trabalha o mesmo músculo principal', () => {
    for (const [from, tos] of Object.entries(VARIATIONS)) {
      expect(EXERCISE_BY_KEY[from], from).toBeDefined();
      for (const to of tos) {
        expect(EXERCISE_BY_KEY[to], to).toBeDefined();
        expect(EXERCISE_BY_KEY[to].primary, `${from}→${to}`).toBe(EXERCISE_BY_KEY[from].primary);
      }
    }
  });

  it('sem motivo nos registros, nada muda (mesmo objeto de config)', () => {
    const r = reviewProgram({ config, metrics: [metric(TODAY, { arm_right_cm: 35 })], logs: progressing('preacher_curl_machine'), today: TODAY });
    expect(r.revision.changes).toEqual([]);
    expect(r.config).toBe(config);
    expect(r.revision.notes.join(' ')).toMatch(/linha de base/);
  });

  it('dor ≥4 em duas sessões seguidas troca o exercício (mesmo sem medidas)', () => {
    const r = reviewProgram({ config, metrics: [], logs: flat('skull_crusher_ez', 5).map((l, i) => ({ ...l, reps: 8 + i })), today: TODAY });
    expect(r.revision.changes).toHaveLength(1);
    expect(r.revision.changes[0]).toMatchObject({ from: 'skull_crusher_ez', to: 'close_grip_bench' });
    const s = slotOf(r.config, 'close_grip_bench')!;
    expect([s.sets, s.repRange, s.restText, s.originalKey, s.changedOn, s.tag]).toEqual([3, [8, 12], '90 s', 'skull_crusher_ez', TODAY, 'TROCA AUTOMÁTICA']);
  });

  it('carga parada + braço sem crescer em 28 dias → troca; séries/faixa/descanso iguais', () => {
    const metrics = [metric('2026-10-08', { arm_right_cm: 35 }), metric(TODAY, { arm_right_cm: 35.2 })];
    const r = reviewProgram({ config, metrics, logs: flat('preacher_curl_machine'), today: TODAY });
    expect(r.revision.changes.map((c) => [c.from, c.to])).toEqual([['preacher_curl_machine', 'cable_curl']]);
    const before = slotOf(config, 'preacher_curl_machine')!;
    const after = slotOf(r.config, 'cable_curl')!;
    expect([after.sets, after.repRange, after.restSec, after.slotId]).toEqual([before.sets, before.repRange, before.restSec, before.slotId]);
    expect(r.config.days.map((d) => d.slots.length)).toEqual(config.days.map((d) => d.slots.length));
  });

  it('carga parada mas braço crescendo → mantém (o resultado está vindo)', () => {
    const metrics = [metric('2026-10-08', { arm_right_cm: 35 }), metric(TODAY, { arm_right_cm: 35.8 })];
    const r = reviewProgram({ config, metrics, logs: flat('preacher_curl_machine'), today: TODAY });
    expect(r.revision.changes).toEqual([]);
    expect(r.revision.kept.join(' ')).toMatch(/cresceu 0,8 cm/);
  });

  it('carga parada sem medidas com 28 dias de intervalo → mantém e explica', () => {
    const r = reviewProgram({ config, metrics: [metric(TODAY, { arm_right_cm: 35 })], logs: flat('preacher_curl_machine'), today: TODAY });
    expect(r.revision.changes).toEqual([]);
    expect(r.revision.kept.join(' ')).toMatch(/ainda não há medida/);
  });

  it(`no máximo ${MAX_CHANGES} trocas por vez, prioridade para dor e músculos prioritários`, () => {
    const metrics = [metric('2026-10-01', { arm_right_cm: 35, chest_cm: 100, thigh_cm: 60, calf_right_cm: 37 }), metric(TODAY, { arm_right_cm: 35, chest_cm: 100, thigh_cm: 60, calf_right_cm: 37 })];
    const logs = [...flat('standing_calf_raise'), ...flat('leg_press'), ...flat('db_bench_press'), ...flat('rope_pushdown', 6)];
    const r = reviewProgram({ config, metrics, logs, today: TODAY });
    expect(r.revision.changes).toHaveLength(2);
    expect(r.revision.changes[0].from).toBe('rope_pushdown'); // dor primeiro
    expect(r.revision.changes[1].from).toBe('db_bench_press'); // peitoral é prioridade antes de quadríceps/panturrilha
    expect(r.revision.kept.join(' ')).toMatch(/limite é 2 trocas/);
  });

  it('não troca de novo um exercício trocado há menos de 28 dias', () => {
    const metrics = [metric('2026-10-08', { arm_right_cm: 35 }), metric(TODAY, { arm_right_cm: 35 })];
    const first = reviewProgram({ config, metrics, logs: flat('preacher_curl_machine'), today: '2026-11-01' }).config;
    const again = reviewProgram({ config: first, metrics, logs: flat('cable_curl'), today: TODAY });
    expect(again.revision.changes).toEqual([]);
  });

  it('nunca coloca um exercício que já está no mesmo dia', () => {
    // Dia 3: Scott + Bayesian. Se a Bayesian parar, a 1ª opção (rosca inclinada) não está no dia 3 → pode.
    // Dia 1 tem rosca inclinada; se ela parar, a 1ª opção (Bayesian) não está no dia 1 → pode.
    const metrics = [metric('2026-10-08', { arm_right_cm: 35 }), metric(TODAY, { arm_right_cm: 35 })];
    const r = reviewProgram({ config, metrics, logs: flat('incline_db_curl'), today: TODAY });
    const day = r.config.days.find((d) => d.slots.some((s) => s.changedOn === TODAY))!;
    const keys = day.slots.map((s) => s.exerciseKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('cintura subindo sem o braço crescer vira orientação de dieta, não troca de exercício', () => {
    const metrics = [metric('2026-10-01', { waist_cm: 80, arm_right_cm: 35, weight_kg: 75 }), metric(TODAY, { waist_cm: 82, arm_right_cm: 35, weight_kg: 76.5 })];
    const r = reviewProgram({ config, metrics, logs: [], today: TODAY });
    expect(r.revision.changes).toEqual([]);
    expect(r.revision.notes.join(' ')).toMatch(/Cintura \+2 cm.*reduza 100–150 kcal/);
    expect(r.revision.notes.join(' ')).toMatch(/Peso: \+1,5 kg/);
  });

  it('regionGrowth compara com a medição de pelo menos 28 dias antes', () => {
    const m = [metric('2026-10-01', { arm_right_cm: 34.5 }), metric('2026-10-20', { arm_right_cm: 35 }), metric(TODAY, { arm_right_cm: 35.5 })];
    expect(regionGrowth(m, 'biceps', TODAY)).toMatchObject({ growth: 1, from: '2026-10-01', to: TODAY });
    expect(regionGrowth(m, 'abs', TODAY)).toBeNull();
  });
});

describe('ao salvar medidas (serviço)', () => {
  it('reavalia o ciclo de 4 dias ativo, aplica a troca e guarda o relatório', async () => {
    const { LocalStore } = await import('../data/store');
    const { activateProtocol, reviewAfterMeasurement } = await import('../services');
    const { EMPTY_PROFILE } = await import('../data/AppContext');
    const store = await LocalStore.open(`r-${Math.random()}`);
    const program = await activateProtocol(store, EMPTY_PROFILE(store.userId), 'jkk4');
    await store.upsert('body_metrics', [metric('2026-10-08', { arm_right_cm: 35 }), metric(TODAY, { arm_right_cm: 35 })] as never);
    await store.upsert('set_logs', flat('preacher_curl_machine') as never);
    const rev = await reviewAfterMeasurement(store, TODAY, TODAY);
    expect(rev?.changes.map((c) => c.to)).toEqual(['cable_curl']);
    const saved = (await store.list<{ id: string; config: typeof config }>('programs', { eq: { status: 'active' } }))[0];
    expect(saved.id).toBe(program.id); // mesmo ciclo: semana e histórico continuam
    expect(saved.config.revisions).toHaveLength(1);
    expect(saved.config.days.flatMap((d) => d.slots).some((s) => s.exerciseKey === 'cable_curl')).toBe(true);
  });
  it('no JKK de 5 dias (fiel ao PDF) não mexe em nada', async () => {
    const { LocalStore } = await import('../data/store');
    const { activateProtocol, reviewAfterMeasurement } = await import('../services');
    const { EMPTY_PROFILE } = await import('../data/AppContext');
    const store = await LocalStore.open(`r5-${Math.random()}`);
    await activateProtocol(store, EMPTY_PROFILE(store.userId), 'jkk');
    expect(await reviewAfterMeasurement(store, null, TODAY)).toBeNull();
  });
});
