import { describe, expect, it } from 'vitest';
import { CARE_PRODUCTS, FACE_BUDGET, kitFor, kitPlan, searchUrl } from './careProducts';

describe('produtos de rosto', () => {
  it('kit pelo tipo de pele do perfil; sem tipo = oleosa (padrão da rotina base)', () => {
    expect(kitFor({ type: 'oily' })).toBe('oily');
    expect(kitFor({ type: 'combination' })).toBe('oily');
    expect(kitFor({ type: 'dry' })).toBe('gentle');
    expect(kitFor({ type: 'sensitive' })).toBe('gentle');
    expect(kitFor({})).toBe('oily');
    expect(kitFor(null)).toBe('oily');
  });
  it('os dois kits têm limpeza, hidratante e protetor e cabem em R$ 300 no preço mais alto', () => {
    for (const k of ['oily', 'gentle'] as const) {
      const p = kitPlan(k);
      expect(p.essentials.map((e) => e.step)).toEqual(['cleanser', 'moisturizer', 'sunscreen']);
      expect(p.totalMax).toBeLessThanOrEqual(FACE_BUDGET);
      expect(p.fitsBudget).toBe(true);
      expect(p.totalMin).toBeLessThan(p.totalMax);
    }
  });
  it('pele oleosa: kit essencial abaixo de R$ 140 e completo (com tratamento) abaixo de R$ 200', () => {
    const p = kitPlan('oily');
    expect(p.totalMin).toBeCloseTo(97.75, 2);
    expect(p.totalMax).toBeCloseTo(135.77, 2);
    expect(p.withOptionalMax).toBeLessThan(200);
    expect(p.essentials.map((e) => e.id)).toEqual(['actine_bar', 'facecare_matte', 'nivea_sun_oily']); // o mais barato de cada etapa
    expect(p.alternatives.map((e) => e.id)).toEqual(['sunfresh70']);
    expect(p.monthlyMax).toBeLessThan(100);
  });
  it('pele sensível/seca não recebe sabonete para acne nem niacinamida a 10%', () => {
    const ids = [...kitPlan('gentle').essentials, ...kitPlan('gentle').optional].map((e) => e.id);
    expect(ids).not.toContain('actine_bar');
    expect(ids).not.toContain('principia_nc10');
  });
  it('todo produto tem link real (https), faixa de preço com fonte e termo de busca', () => {
    for (const p of CARE_PRODUCTS) {
      expect(p.links.length).toBeGreaterThan(0);
      for (const l of p.links) expect(l.url).toMatch(/^https:\/\/www\.(drogariasaopaulo|drogariaspacheco|drogasil|drogal|cliquefarma|buscape)\.com(\.br)?\//);
      expect(p.price && p.price.min > 0 && p.price.max >= p.price.min && p.price.where.length > 10).toBeTruthy();
      expect(p.search.length).toBeGreaterThan(8);
    }
    expect(searchUrl('Actine sabonete barra 70g')).toBe('https://www.google.com/search?tbm=shop&q=Actine%20sabonete%20barra%2070g');
  });
});
