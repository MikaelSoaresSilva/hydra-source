import { expect, it } from 'vitest';
import { buildRecommendations, type RecContext } from './recommendations';
import { EMPTY_PROFILE } from '../data/AppContext';
import type { CheckinRow, MetricRow, SessionRow } from './types';

const empty: RecContext = { today: '2026-10-14', profile: null, program: null, sessions: [], setLogs: [], checkins: [], metrics: [], target: null, foodLogs: [], products: [], careLogs: [] };

it('TQR baixo em duas sessões seguidas gera alerta', () => {
  const s = (d: string, tqr: number) => ({ id: d, started_at: `${d}T16:00:00Z`, readiness: { tqr, adjusted: tqr < 13, note: '' } } as unknown as SessionRow);
  expect(buildRecommendations({ ...empty, sessions: [s('2026-10-12', 10), s('2026-10-13', 12)] }).some((r) => r.id === 'tqr')).toBe(true);
  expect(buildRecommendations({ ...empty, sessions: [s('2026-10-12', 10), s('2026-10-13', 15)] }).some((r) => r.id === 'tqr')).toBe(false);
});

it('água média < 2 L com 3+ registros', () => {
  const c = (d: string, w: number) => ({ date: d, water_l: w, recovery: null, sleep_hours: null } as unknown as CheckinRow);
  expect(buildRecommendations({ ...empty, checkins: [c('2026-10-12', 1.2), c('2026-10-13', 1.5), c('2026-10-14', 1)] }).some((r) => r.id === 'water')).toBe(true);
  expect(buildRecommendations({ ...empty, checkins: [c('2026-10-13', 1.5), c('2026-10-14', 1)] }).some((r) => r.id === 'water')).toBe(false);
});

it('cintura acima de 94 cm (homem) usa a última medida', () => {
  const profile = { ...EMPTY_PROFILE('u'), sex: 'male' as const };
  const m = (d: string, w: number) => ({ date: d, waist_cm: w, weight_kg: null } as unknown as MetricRow);
  const r = buildRecommendations({ ...empty, profile, metrics: [m('2026-10-01', 100), m('2026-10-14', 96)] }).find((x) => x.id === 'waist');
  expect(r?.priority).toBe(2);
  expect(buildRecommendations({ ...empty, profile, metrics: [m('2026-10-14', 90)] }).some((x) => x.id === 'waist')).toBe(false);
});

it('exercício estagnado gera recomendação de mudar uma variável', () => {
  const log = (sid: string, date: string, reps: number) => ({ id: sid, session_id: sid, exercise_key: 'ez_bar_curl', logged_at: `${date}T17:00:00Z`, load_kg: 30, reps, rir: 2, kind: 'working', technique_ok: true, pain: 0 });
  const setLogs = [log('a', '2026-09-30', 10), log('b', '2026-10-03', 10), log('c', '2026-10-07', 9), log('d', '2026-10-10', 10)] as never;
  const r = buildRecommendations({ ...empty, setLogs }).find((x) => x.id === 'stall-ez_bar_curl');
  expect(r?.title).toMatch(/parou de progredir/);
  expect(r?.data.at(-1)).toMatch(/30 kg × 10/);
});
