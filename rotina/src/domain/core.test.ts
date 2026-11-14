import { describe, expect, it } from 'vitest';
import { defaultState } from './defaults';
import { interpret, parseDuration, parseTimes, norm } from './interpreter';
import { applyOps, preview } from './ops';
import { buildDay } from './scheduler';
import { hm } from './time';
import type { State } from './types';
import { linkWorkLunch, migrateToV2, migrateToV3 } from './migrate';

const MON = '2026-11-16';
const SAT = '2026-11-14';
const s0 = () => defaultState(new Date('2026-11-14T10:00:00'));
const at = (s: State, date: string, title: RegExp) => buildDay(s, date).items.find((i) => title.test(i.activity.title));
const noOverlap = (s: State, date: string) => {
  const items = buildDay(s, date).items.filter((i) => i.end > i.start && !i.parentId);
  for (let i = 1; i < items.length; i++) expect(items[i].start, `${items[i - 1].activity.title} x ${items[i].activity.title}`).toBeGreaterThanOrEqual(items[i - 1].end);
};

describe('montador do dia', () => {
  it('rotina padrão sem conflito, entre acordar e dormir, com 8–9 h de sono', () => {
    const s = s0();
    for (const d of [MON, '2026-11-17', '2026-11-18', SAT, '2026-11-15']) {
      noOverlap(s, d);
      const p = buildDay(s, d);
      expect(p.unplaced).toEqual([]);
      for (const i of p.items) { expect(i.start).toBeGreaterThanOrEqual(p.wake); expect(i.end).toBeLessThanOrEqual(p.bed); }
    }
    const p = buildDay(s, MON);
    expect(hm(p.wake)).toBe('07:00');
    expect(hm(p.bed)).toBe('22:30');
    expect(p.sleepMinutes).toBe(8 * 60 + 30);
    expect(at(s, MON, /Academia/)).toBeTruthy();
    expect(at(s, '2026-11-18', /Academia/)).toBeFalsy(); // quarta sem academia
    expect(at(s, SAT, /luta/i)).toBeTruthy();
  });
  it('rotina da manhã acompanha o horário de acordar', () => {
    const s = s0();
    expect(hm(at(s, MON, /Skincare matinal/)!.start)).toBe('07:20');
    s.sleep.weekday.wake = 6 * 60;
    expect(hm(at(s, MON, /Skincare matinal/)!.start)).toBe('06:20');
  });
  it('dormir depois da meia-noite funciona', () => {
    const s = s0();
    s.sleep.weekday = { wake: 8 * 60 + 30, bed: 30 };
    const p = buildDay(s, MON);
    expect(p.bed).toBe(1470);
    expect(hm(at(s, MON, /^Dormir/)!.start)).toBe('00:30');
    noOverlap(s, MON);
  });
});

describe('leitura de horários e durações', () => {
  it('horários', () => {
    expect(parseTimes(norm('às 18h'))).toEqual([1080]);
    expect(parseTimes(norm('6:30'))).toEqual([390]);
    expect(parseTimes(norm('18h30'))).toEqual([1110]);
    expect(parseTimes(norm('às 8 da noite'))).toEqual([1200]);
    expect(parseTimes(norm('das 8 às 17h'))).toEqual([480, 1020]);
    expect(parseTimes(norm('adicionar 1 hora de estudos'))).toEqual([]);
    expect(parseTimes(norm('ao meio-dia'))).toEqual([720]);
  });
  it('durações', () => {
    expect(parseDuration(norm('adicionar 1 hora de estudos'))?.minutes).toBe(60);
    expect(parseDuration(norm('mais 45 min'))?.minutes).toBe(45);
    expect(parseDuration(norm('uma hora e meia'))?.minutes).toBe(90);
    expect(parseDuration(norm('1h30 de treino'))?.minutes).toBe(90);
    expect(parseDuration(norm('academia às 18h'))).toBeNull();
  });
});

describe('Descreva sua necessidade (exemplos do pedido)', () => {
  const run = (text: string, s = s0(), today = MON) => {
    const r = interpret(text, s, today);
    expect(r.ops.length, `não entendeu: ${text}`).toBeGreaterThan(0);
    return { r, next: applyOps(s, r.ops), pv: preview(s, r.ops, today) };
  };

  it('"Vou começar a trabalhar às 8h." → Trabalho 08:00–17:00 com o almoço junto (11:30–12:50)', () => {
    const { next } = run('Vou começar a trabalhar às 8h.');
    const items = buildDay(next, MON).items;
    const work = items.filter((i) => /Trabalho/.test(i.activity.title));
    expect(work.length).toBe(1);
    expect(hm(work[0].start)).toBe('08:00');
    expect(hm(work[0].end)).toBe('17:00');
    const lunch = at(next, MON, /Almoço/)!;
    expect(hm(lunch.start)).toBe('11:30');
    expect(hm(lunch.end)).toBe('12:50');
    expect(lunch.parentId).toBe(work[0].activity.id);
    expect(at(next, MON, /Academia/)!.start).toBeGreaterThanOrEqual(17 * 60);
    noOverlap(next, MON);
    expect(buildDay(next, SAT).items.some((i) => /Trabalho/.test(i.activity.title))).toBe(false);
    expect(hm(at(next, SAT, /Almoço/)!.start)).toBe('12:00');
    expect(at(next, SAT, /Almoço/)!.parentId).toBeUndefined();
  });
  it('"Hoje só vou conseguir ir à academia às 18h." → só hoje', () => {
    const { next, pv } = run('Hoje só vou conseguir ir à academia às 18h.');
    expect(hm(at(next, MON, /Academia/)!.start)).toBe('18:00');
    expect(hm(at(next, '2026-11-17', /Academia/)!.start)).toBe('16:00');
    expect(pv.changes.some((c) => c.kind === 'moved' && /Academia/.test(c.title))).toBe(true);
    noOverlap(next, MON);
  });
  it('"Quero dormir mais cedo." → 30 min antes, sem passar de 9 h', () => {
    const { next } = run('Quero dormir mais cedo.');
    const p = buildDay(next, MON);
    expect(hm(p.bed)).toBe('22:00');
    expect(p.sleepMinutes).toBe(9 * 60);
    const { next: n2 } = run('Quero dormir mais cedo.', next);
    const p2 = buildDay(n2, MON);
    expect(hm(p2.bed)).toBe('21:30');
    expect(hm(p2.wake)).toBe('06:30'); // acordar acompanha para manter 9 h
  });
  it('"Preciso adicionar 1 hora de estudos." → estudos passa de 90 para 150 min', () => {
    const { next } = run('Preciso adicionar 1 hora de estudos.');
    expect(next.activities.find((a) => a.title === 'Estudos')!.duration).toBe(150);
    noOverlap(next, MON);
  });
  it('"Quero mudar meu horário de acordar para 6h." → acorda 6h e dormir acompanha', () => {
    const { next } = run('Quero mudar meu horário de acordar para 6h.');
    const p = buildDay(next, MON);
    expect(hm(p.wake)).toBe('06:00');
    expect(hm(p.bed)).toBe('21:30');
    expect(hm(at(next, MON, /Café da manhã/)!.start)).toBe('06:45');
  });
  it('"Hoje não vou conseguir realizar o cardio." → pula só hoje', () => {
    const s = s0();
    const tue = '2026-11-17';
    const { next } = run('Hoje não vou conseguir realizar o cardio.', s, tue);
    expect(at(next, tue, /Cardio/)).toBeFalsy();
    expect(at(next, '2026-11-20', /Cardio/)).toBeTruthy();
  });
  it('vários pedidos de uma vez e atividade nova', () => {
    const { r, next } = run('Quero acordar às 6h30 e adicionar inglês às 14h por 45 min. Amanhã sem leitura.');
    expect(r.unknown).toEqual([]);
    expect(hm(buildDay(next, MON).wake)).toBe('06:30');
    const ing = at(next, MON, /Ingles/i)!;
    expect(hm(ing.start)).toBe('14:00');
    expect(ing.end - ing.start).toBe(45);
    expect(at(next, '2026-11-17', /Leitura/)).toBeFalsy();
    expect(at(next, MON, /Leitura/)).toBeTruthy();
  });
  it('fim de semana separado', () => {
    const { next } = run('No fim de semana quero acordar às 9h');
    expect(hm(buildDay(next, SAT).wake)).toBe('09:00');
    expect(hm(buildDay(next, MON).wake)).toBe('07:00');
  });
  it('dormir tarde demais gera aviso de sono na prévia', () => {
    const { pv } = run('Quero dormir à meia-noite');
    expect(pv.warnings.join(' ')).toMatch(/abaixo da meta/);
  });
  it('não inventa: texto sem sentido não gera mudança', () => {
    expect(interpret('banana azul', s0(), MON).ops).toEqual([]);
  });
  it('excluir e pausar', () => {
    const { next } = run('Remover a leitura');
    expect(next.activities.some((a) => a.title === 'Leitura')).toBe(false);
    const { next: n2 } = run('Pausar o cardio');
    expect(n2.activities.find((a) => a.title === 'Cardio')!.paused).toBe(true);
  });
});

describe('prévia', () => {
  it('mudança só dos dias de semana, pedida no sábado, mostra a segunda', () => {
    const s = s0();
    const r = interpret('Quero mudar meu horário de acordar para 6h.', s, SAT);
    const pv = preview(s, r.ops, SAT);
    expect(pv.date).toBe(MON);
    expect(pv.changes.some((c) => c.kind === 'moved' && c.title === 'Acordar')).toBe(true);
  });
});

describe('contexto entre frases', () => {
  it('"hoje" vale para a frase seguinte sem data', () => {
    const s = s0();
    const r = interpret('Hoje só vou conseguir ir à academia às 18h e quero dormir mais cedo.', s, MON);
    const next = applyOps(s, r.ops);
    expect(hm(buildDay(next, MON).bed)).toBe('22:00');
    expect(hm(buildDay(next, '2026-11-17').bed)).toBe('22:30');
  });
  it('sem "hoje", continua permanente', () => {
    const s = s0();
    const next = applyOps(s, interpret('Quero dormir mais cedo', s, MON).ops);
    expect(hm(buildDay(next, '2026-11-17').bed)).toBe('22:00');
  });
});

describe('atividades juntas e unidas', () => {
  const work = (s: State) => applyOps(s, interpret('Vou trabalhar das 8h às 17h', s, MON).ops);
  it('faltar ao trabalho hoje: almoço volta ao horário normal', () => {
    const s = work(s0());
    const next = applyOps(s, interpret('Hoje não vou trabalhar', s, MON).ops);
    expect(at(next, MON, /Trabalho/)).toBeFalsy();
    expect(hm(at(next, MON, /Almoço/)!.start)).toBe('12:00');
  });
  it('"podcast junto com o cardio": junta qualquer atividade', () => {
    let s = s0();
    s = applyOps(s, interpret('Adicionar podcast às 15h por 20 min', s, MON).ops);
    s = applyOps(s, interpret('Podcast junto com o cardio das 17h55 às 18h10', s, MON).ops);
    const tue = '2026-11-17';
    const cardio = at(s, tue, /^Cardio/)!;
    const pod = at(s, tue, /Podcast/)!;
    expect(pod.parentId).toBe(cardio.activity.id);
    expect(pod.start).toBeGreaterThanOrEqual(cardio.start);
    expect(pod.end).toBeLessThanOrEqual(cardio.end);
    expect(hm(at(s, MON, /Podcast/)!.start)).toBe('15:00');
    noOverlap(s, tue);
  });
  it('migração da v1: manhã+tarde viram um Trabalho e o almoço entra junto às 11:30–12:50', () => {
    const v1 = s0();
    v1.version = 1;
    const mk = (title: string, at: number, duration: number) => ({ ...v1.activities[0], id: title, title, categoryId: 'work', kind: 'normal' as const, anchor: { type: 'time' as const, at }, duration, fixed: true, days: [1, 2, 3, 4, 5] });
    v1.activities.push(mk('Trabalho (manhã)', 480, 240), mk('Trabalho (tarde)', 760, 260));
    const v2 = migrateToV2(v1);
    expect(v2.version).toBe(2);
    expect(v2.activities.filter((a) => /^Trabalho/.test(a.title)).map((w) => w.title)).toEqual(['Trabalho']);
    expect(hm(at(v2, MON, /Almoço/)!.start)).toBe('11:30');
    expect(hm(at(v2, MON, /Almoço/)!.end)).toBe('12:50');
    expect(hm(at(v2, MON, /Trabalho/)!.end)).toBe('17:00');
    expect(migrateToV2(v2)).toBe(v2);
  });
  it('ligar almoço ao trabalho criado à mão; não liga se o almoço cai fora do expediente', () => {
    const s = s0();
    s.activities.push({ ...s.activities[0], id: 'w', title: 'Trabalho', categoryId: 'work', kind: 'normal', anchor: { type: 'time', at: 7 * 60 + 30 }, duration: 9 * 60, fixed: true, days: [1, 2, 3, 4, 5] });
    const r = linkWorkLunch(s);
    expect(r.linked).toBe(true);
    expect(hm(at(r.state, MON, /Almoço/)!.start)).toBe('11:30');
    noOverlap(r.state, MON);
    expect(linkWorkLunch({ ...s, profile: { ...s.profile, workLunch: { at: 17 * 60, duration: 60 } } }).linked).toBe(false);
  });
});

describe('estudos', () => {
  const withWork = (s: State) => applyOps(s, interpret('Vou trabalhar das 8h às 17h', s, MON).ops);
  it('dias de semana sem trabalho: 1 h 30 de estudos', () => {
    const st = at(s0(), MON, /^Estudos$/)!;
    expect(st.end - st.start).toBe(90);
  });
  it('dia de semana cheio: estudos encurtam ou saem, sem aviso de "não coube"', () => {
    const s = withWork(s0());
    const p = buildDay(s, MON);
    const st = p.items.find((i) => i.activity.title === 'Estudos');
    if (st) { expect(st.end - st.start).toBeGreaterThanOrEqual(30); }
    else expect(p.optionalOut.map((a) => a.title)).toContain('Estudos');
    expect(p.unplaced.some((u) => u.activity.title === 'Estudos')).toBe(false);
    noOverlap(s, MON);
  });
  it('estudos opcionais não tiram refeições nem treino do lugar', () => {
    const s = withWork(s0());
    const p = buildDay(s, MON);
    for (const t of [/Academia/, /Jantar/, /pós-treino/, /Alongamento/]) expect(p.items.some((i) => t.test(i.activity.title)), String(t)).toBe(true);
  });
  it('dia lotado: estudos opcionais encurtam até 30 min no maior espaço', () => {
    const s = s0();
    s.activities.push({ ...s.activities[0], id: 'x', title: 'Curso', kind: 'normal', categoryId: 'work', anchor: { type: 'time', at: 8 * 60 }, duration: 12 * 60 + 20, fixed: true, days: [1] });
    const p = buildDay(s, MON);
    const st = p.items.find((i) => i.activity.title === 'Estudos');
    expect(st?.shortenedFrom === 90 || p.optionalOut.some((a) => a.title === 'Estudos')).toBe(true);
    if (st) expect(st.end - st.start).toBeGreaterThanOrEqual(30);
  });
  it('fim de semana sempre tem estudos (mesmo apertado, encurta até 45 min)', () => {
    for (const d of [SAT, '2026-11-15']) {
      const st = at(s0(), d, /^Estudos/)!;
      expect(st.activity.title).toBe('Estudos (fim de semana)');
      expect(st.end - st.start).toBe(90);
    }
    const s = s0();
    s.activities.push({ ...s.activities[0], id: 'y', title: 'Evento', kind: 'normal', categoryId: 'life', anchor: { type: 'time', at: 11 * 60 + 30 }, duration: 8 * 60 + 30, fixed: true, days: [6] });
    const st = at(s, SAT, /^Estudos/)!;
    expect(st).toBeTruthy();
    expect(st.end - st.start).toBeGreaterThanOrEqual(45);
    noOverlap(s, SAT);
  });
  it('migração v3: estudos de semana viram opcionais e o fim de semana ganha estudos', () => {
    const v2 = s0();
    v2.version = 2;
    v2.activities = v2.activities.filter((a) => a.title !== 'Estudos (fim de semana)').map((a) => (a.title === 'Estudos' ? { ...a, optional: undefined, minDuration: undefined } : a));
    const v3 = migrateToV3(v2);
    expect(v3.version).toBe(3);
    expect(v3.activities.find((a) => a.title === 'Estudos')!.optional).toBe(true);
    expect(v3.activities.find((a) => a.title === 'Estudos (fim de semana)')!.days).toEqual([0, 6]);
    expect(at(v3, SAT, /^Estudos/)).toBeTruthy();
    expect(migrateToV3(v3)).toBe(v3);
  });
});

describe('estudos pelo pedido', () => {
  it('"hoje sem estudos" no sábado pula o estudo do fim de semana', () => {
    const s = s0();
    const next = applyOps(s, interpret('Hoje sem estudos', s, SAT).ops);
    expect(at(next, SAT, /^Estudos/)).toBeFalsy();
    expect(at(next, '2026-11-15', /^Estudos/)).toBeTruthy();
  });
  it('"preciso adicionar 1 hora de estudos" num dia de semana mexe no estudo de semana', () => {
    const s = s0();
    const next = applyOps(s, interpret('Preciso adicionar 1 hora de estudos.', s, MON).ops);
    expect(next.activities.find((a) => a.title === 'Estudos')!.duration).toBe(150);
    expect(next.activities.find((a) => a.title === 'Estudos (fim de semana)')!.duration).toBe(90);
  });
});
