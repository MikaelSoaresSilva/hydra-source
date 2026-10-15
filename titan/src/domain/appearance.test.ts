import { describe, expect, test, vi } from 'vitest';
import { classifyFace, cutSuggestions, parseAppearanceResult, appearanceProfileFrom, type AppearanceResult } from './appearance';
import {
  APPEARANCE_MODEL, APPEARANCE_SCHEMA, FALLBACK_BETA, buildAppearanceRequest, extractJsonText, validateImages,
} from '../../supabase/functions/_shared/appearance';
import { analyzeWithKey } from '../appearanceClient';
import { EMPTY_PROFILE } from '../data/AppContext';

export const SAMPLE: AppearanceResult = {
  photo_quality: { usable: true, issues: [] },
  face_shape: { estimate: 'oval', confidence: 'media', reasoning: 'Comprimento um pouco maior que a largura.' },
  hair: { type_estimate: '2C–3A', confidence: 'media', observations: ['Cachos abertos no topo'] },
  haircuts: [{ name: 'Low fade com cachos', why: 'Valoriza os cachos', ask_barber: 'Pente 2 na nuca', maintenance: '3 semanas', avoid_if: 'Quiser volume lateral' }],
  skin: { observations: ['Brilho na zona T'], routine: [{ when: 'manha', step: 'Protetor FPS 30+', why: 'Fotoproteção' }], ingredients: [{ name: 'Niacinamida', purpose: 'Oleosidade', caution: 'Teste de contato' }] },
  beard_brows: ['Defina a linha do pescoço'],
  facial_massage: { suitable_now: true, steps: ['Pressão leve'], evidence_note: 'Efeito temporário' },
  habits: ['Durma 7–9 h'],
  see_professional: [],
  limitations: ['Foto 2D'],
};

describe('questionário de formato do rosto', () => {
  test('classificações típicas', () => {
    expect(classifyFace({ length: 'similar', widest: 'cheekbones', jaw: 'rounded' }).shape).toBe('redondo');
    expect(classifyFace({ length: 'similar', widest: 'equal', jaw: 'angular' }).shape).toBe('quadrado');
    expect(classifyFace({ length: 'much_longer', widest: 'equal', jaw: 'angular' }).shape).toBe('retangular');
    expect(classifyFace({ length: 'slightly_longer', widest: 'jaw', jaw: 'angular' }).shape).toBe('triangular');
    expect(classifyFace({ length: 'slightly_longer', widest: 'cheekbones', jaw: 'narrow_chin' })).toMatchObject({ shape: 'oval', confidence: 'alta' });
  });
  test('regras do PDF de corte', () => {
    expect(cutSuggestions('oval', { curlType: '2C–3A' })[0].name).toMatch(/Graduado/);
    expect(cutSuggestions('redondo', { curlType: '2C–3A' })[0].name).toMatch(/Desfiado/);
    const quad = cutSuggestions('quadrado', { curlType: '2C–3A' });
    expect(quad[0].name).toMatch(/Assimétrico/);
    expect(quad.some((c) => /Graduado/.test(c.name))).toBe(false);
    expect(cutSuggestions('triangular', { curlType: '2C–3A' })[0].name).toMatch(/Camadas/);
  });
  test('cabelo crespo: sem camadas e sem navalha', () => {
    const tri = cutSuggestions('triangular', { curlType: '4b' });
    expect(tri.some((c) => c.name === 'Camadas (médio)')).toBe(false);
    expect(tri.some((c) => /Evite: corte em camadas/.test(c.name))).toBe(true);
    expect(tri[0].askBarber).toMatch(/NÃO usar navalha/);
  });
  test('retangular é marcado como princípio geral, não como regra do PDF', () => {
    expect(cutSuggestions('retangular')[0].source).toMatch(/não consta nos PDFs/);
  });
});

describe('requisição à API', () => {
  const img = { kind: 'face_front' as const, mediaType: 'image/jpeg' as const, base64: 'AAAA' };
  test('valida fotos', () => {
    expect(validateImages([])).toMatch(/pelo menos 1/);
    expect(validateImages([img, img, img, img])).toMatch(/no máximo 3/);
    expect(validateImages([{ ...img, mediaType: 'image/gif' as 'image/jpeg' }])).toMatch(/Formato/);
    expect(validateImages([img])).toBeNull();
  });
  test('modelo, pensamento adaptativo, saída estruturada e fallback', () => {
    const r = buildAppearanceRequest([img], { age: 19, curlType: '2C–3A', skinType: '' });
    expect(r.model).toBe(APPEARANCE_MODEL);
    expect(r.thinking).toEqual({ type: 'adaptive' });
    expect(r.output_config.effort).toBe('medium');
    expect(r.output_config.format.schema).toBe(APPEARANCE_SCHEMA);
    expect(r.fallbacks).toBe('default');
    expect(r.betas).toEqual([FALLBACK_BETA]);
    const content = r.messages[0].content;
    expect(content.filter((b) => b.type === 'image')).toHaveLength(1);
    const text = content.at(-1)!.text as string;
    expect(text).toContain('2C–3A');
    expect(text).not.toContain('skinType'); // campos vazios removidos
  });
  test('esquema: todo objeto fecha additionalProperties e exige todos os campos', () => {
    const walk = (s: Record<string, unknown>) => {
      if (s.type === 'object') {
        expect(s.additionalProperties).toBe(false);
        expect([...(s.required as string[])].sort()).toEqual(Object.keys(s.properties as object).sort());
        Object.values(s.properties as Record<string, Record<string, unknown>>).forEach(walk);
      }
      if (s.type === 'array') walk(s.items as Record<string, unknown>);
    };
    walk(APPEARANCE_SCHEMA as unknown as Record<string, unknown>);
  });
  test('perfil enviado não leva nome, peso nem medidas', () => {
    const p = appearanceProfileFrom({ ...EMPTY_PROFILE('u'), display_name: 'Fulano', nutrition: { weightKg: 80 } });
    expect(JSON.stringify(p)).not.toMatch(/Fulano|80|weight/);
  });
  test('extrai texto e trata recusa/corte', () => {
    expect(extractJsonText({ stop_reason: 'end_turn', content: [{ type: 'thinking' }, { type: 'text', text: '{}' }] })).toEqual({ text: '{}', error: null });
    expect(extractJsonText({ stop_reason: 'refusal', content: [] }).error).toMatch(/recusou/);
    expect(extractJsonText({ stop_reason: 'max_tokens', content: [] }).error).toMatch(/cortada/);
  });
});

describe('validação da resposta', () => {
  test('aceita o formato e rejeita fora do esquema', () => {
    expect(parseAppearanceResult(JSON.stringify(SAMPLE)).ok).toBe(true);
    expect(parseAppearanceResult('{"x":1}').ok).toBe(false);
    expect(parseAppearanceResult('não é json').ok).toBe(false);
  });
  test('remove itens que citam medicamentos/hormônios', () => {
    const bad = { ...SAMPLE, habits: ['Use minoxidil na barba', 'Durma bem'], skin: { ...SAMPLE.skin, ingredients: [...SAMPLE.skin.ingredients, { name: 'Isotretinoína', purpose: 'acne', caution: '' }] } };
    const r = parseAppearanceResult(bad);
    expect(r.ok && r.value.habits).toEqual(['Durma bem']);
    expect(r.ok && r.value.skin.ingredients.map((i) => i.name)).toEqual(['Niacinamida']);
    expect(r.ok && r.removed).toBe(2);
  });
});

describe('analyzeWithKey (API simulada)', () => {
  const img = { kind: 'face_front' as const, mediaType: 'image/jpeg' as const, base64: 'AAAA' };
  function fakeClient(message: unknown) {
    const stream = vi.fn(() => ({ finalMessage: () => Promise.resolve(message) }));
    return { client: { beta: { messages: { stream } } } as never, stream };
  }
  test('sucesso: envia a requisição montada e valida o JSON', async () => {
    const { client, stream } = fakeClient({ model: APPEARANCE_MODEL, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(SAMPLE) }] });
    const out = await analyzeWithKey('sk-ant-test', [img], { age: 19 }, { client });
    expect(out.ok).toBe(true);
    const params = (stream.mock.calls[0] as unknown[])[0] as { fallbacks: string; model: string };
    expect(params.fallbacks).toBe('default');
    expect(params.model).toBe(APPEARANCE_MODEL);
  });
  test('recusa vira mensagem amigável', async () => {
    const { client } = fakeClient({ model: APPEARANCE_MODEL, stop_reason: 'refusal', content: [] });
    const out = await analyzeWithKey('sk-ant-test', [img], {}, { client });
    expect(out).toEqual({ ok: false, error: expect.stringMatching(/recusou/) });
  });
  test('não chama a API com foto inválida', async () => {
    const { client, stream } = fakeClient({});
    const out = await analyzeWithKey('k', [], {}, { client });
    expect(out.ok).toBe(false);
    expect(stream).not.toHaveBeenCalled();
  });
});
