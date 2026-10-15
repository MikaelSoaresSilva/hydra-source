import { describe, expect, it } from 'vitest';
import { checkSlot, detectActives, evaluateReactions, introductionDays } from './skincare';
import { scalpStatus, washDays } from './hair';
import { buildRecommendations, consistencyBlocker, photoComparability, type RecContext } from './recommendations';
import type { CareLogRow, ProductRow } from './types';

const product = (over: Partial<ProductRow>): ProductRow => ({
  id: 'p1', user_id: 'u', area: 'skin', name: 'Produto', brand: null, category: 'treatment', ingredients: null,
  actives: [], concentration: null, status: 'active', started_on: null, notes: null, ...over });
const careLog = (over: Partial<CareLogRow>): CareLogRow => ({
  id: Math.random().toString(), user_id: 'u', date: '2026-10-14', area: 'skin', slot: 'pm', completed: true, product_id: null,
  reaction: 'none', itch: null, notes: null, ...over });

describe('skincare', () => {
  it('detecta ativos por INCI e por nome em português', () => {
    expect(detectActives('Aqua, Niacinamide, Zinc PCA')).toEqual(['niacinamide', 'zinc']);
    expect(detectActives('Água, Ácido Glicólico 10%')).toEqual(['aha']);
    expect(detectActives('')).toEqual(['unknown']);
  });
  it('bloqueia retinoide + AHA e composição desconhecida com ativos', () => {
    const r = checkSlot([{ name: 'A', actives: ['retinoid'] }, { name: 'B', actives: ['aha'] }]);
    expect(r[0].conflict.level).toBe('avoid');
    const u = checkSlot([{ name: 'X', actives: ['unknown'] }, { name: 'B', actives: ['bha'] }]);
    expect(u[0].conflict.a).toBe('unknown');
    expect(checkSlot([{ name: 'N', actives: ['niacinamide'] }, { name: 'S', actives: ['sunscreen'] }])).toHaveLength(0);
  });
  it('introdução gradual 2× → 3× → uso pleno', () => {
    expect(introductionDays('2026-10-01', '2026-10-05').days).toHaveLength(2);
    expect(introductionDays('2026-10-01', '2026-10-20').days).toHaveLength(3);
    expect(introductionDays('2026-09-01', '2026-10-20').days).toHaveLength(7);
  });
  it('reação moderada suspende o produto; duas leves pausam', () => {
    const p = product({});
    expect(evaluateReactions(p, [careLog({ product_id: 'p1', reaction: 'moderate' })], '2026-10-14').newStatus).toBe('suspended');
    expect(evaluateReactions(p, [careLog({ product_id: 'p1', reaction: 'mild' }), careLog({ product_id: 'p1', reaction: 'mild', date: '2026-10-12' })], '2026-10-14').newStatus).toBe('paused');
    expect(evaluateReactions(p, [careLog({ product_id: 'p1', reaction: 'mild' })], '2026-10-14').newStatus).toBeNull();
  });
});

describe('cabelo', () => {
  it('3 lavagens/semana → seg, qua, sex', () => {
    expect(washDays({ washesPerWeek: 3 })).toEqual([1, 3, 5]);
  });
  it('coceira persistente prioriza couro cabeludo', () => {
    const logs = ['2026-10-02', '2026-10-06', '2026-10-10'].map((date) => careLog({ area: 'hair', slot: 'wash', itch: 6, date }));
    expect(scalpStatus(logs, '2026-10-14').persistentItch).toBe(true);
    expect(scalpStatus(logs.slice(0, 2), '2026-10-14').persistentItch).toBe(false);
  });
});

describe('motor de recomendações', () => {
  const empty: RecContext = { today: '2026-10-14', profile: null, program: null, sessions: [], setLogs: [], checkins: [], metrics: [], target: null, foodLogs: [], products: [], careLogs: [] };
  it('cada recomendação explica motivo, dados e o que monitorar', () => {
    const recs = buildRecommendations({ ...empty, products: [product({ status: 'suspended', name: 'Ácido X' }), product({ id: 'p2', status: 'paused', actives: ['unknown'] })],
      careLogs: [careLog({ product_id: 'p1', reaction: 'moderate' })] });
    expect(recs.find((r) => r.id === 'label-p2')?.reason).not.toMatch(/reação/);
    expect(recs.length).toBeGreaterThan(0);
    recs.forEach((r) => { expect(r.reason.length).toBeGreaterThan(10); expect(r.monitor.length).toBeGreaterThan(5); });
    expect(recs.find((r) => r.id.startsWith('product-'))?.priority).toBe(1);
  });
  it('sem dados não inventa bloqueador de consistência', () => {
    expect(consistencyBlocker(empty)).toBeNull();
  });
  it('fotos com condições diferentes são sinalizadas', () => {
    const a = { lighting: 'janela', distance: '2 m', pose: 'frente', time_of_day: 'manhã', pump: false, taken_at: '' };
    expect(photoComparability(a, { ...a })).toHaveLength(0);
    expect(photoComparability(a, { ...a, pump: true, lighting: 'lâmpada' })).toHaveLength(2);
  });
});
