import { describe, expect, it } from 'vitest';
import { fromAi, aiContext, AI_SCHEMA } from '../ai';
import { defaultState } from '../domain/defaults';
import { applyOps } from '../domain/ops';
import { buildDay } from '../domain/scheduler';
import { hm } from '../domain/time';
import { hashId, plannedNotifications } from './notify';
import { loadState, makeBackup, parseBackup, saveState } from './store';

const s0 = () => defaultState(new Date('2026-11-14T10:00:00'));

describe('notificações planejadas', () => {
  it('avisa o início de cada atividade, com a próxima, e o atraso', () => {
    const now = new Date(2026, 10, 16, 6, 0);
    const list = plannedNotifications(s0(), now, 1);
    const wake = list.find((n) => n.extra.kind === 'start' && n.title.includes('acordar'))!;
    expect(wake.channel).toBe('alarme_v1');
    expect(wake.at.getHours()).toBe(7);
    const lunch = list.find((n) => n.extra.kind === 'start' && n.title.includes('Almoço'))!;
    expect(lunch.title).toBe('12:00 · Almoço');
    expect(lunch.body).toMatch(/Próxima: .+ às \d\d:\d\d/);
    expect(list.some((n) => n.extra.kind === 'late' && n.title.includes('Almoço'))).toBe(true);
    expect(new Set(list.map((n) => n.id)).size).toBe(list.length);
  });
  it('não avisa o que já passou nem o que já foi concluído; respeita desligar', () => {
    const s = s0();
    const now = new Date(2026, 10, 16, 13, 0);
    const list = plannedNotifications(s, now, 1);
    expect(list.every((n) => n.at > now)).toBe(true);
    const gym = buildDay(s, '2026-11-16').items.find((i) => /Academia/.test(i.activity.title))!;
    const done = { ...s, completions: { '2026-11-16': { [gym.activity.id]: { at: now.toISOString(), xp: 20, onTime: false } } } };
    expect(plannedNotifications(done, now, 1).some((n) => n.extra.activityId === gym.activity.id)).toBe(false);
    expect(plannedNotifications({ ...s, settings: { ...s.settings, notifications: false } }, now)).toEqual([]);
  });
  it('adiar cria um novo lembrete', () => {
    const s = s0();
    const now = new Date(2026, 10, 16, 12, 30);
    const id = s.activities.find((a) => a.title === 'Almoço')!.id;
    const list = plannedNotifications({ ...s, snoozes: { [`2026-11-16|${id}`]: now.getTime() + 600000 } }, now, 1);
    expect(list.some((n) => n.extra.kind === 'snooze' && n.extra.activityId === id)).toBe(true);
  });
  it('ids estáveis e positivos', () => {
    expect(hashId('a')).toBe(hashId('a'));
    expect(hashId('b')).toBeGreaterThan(0);
  });
});

describe('IA do Claude: validação das operações', () => {
  it('converte operações válidas e descarta inválidas', () => {
    const s = s0();
    const gym = s.activities.find((a) => /Academia/.test(a.title))!;
    const { ops, dropped } = fromAi([
      { type: 'move', activityId: gym.id, time: '18:30', minutes: null, scope: 'today', title: null, categoryId: null, priority: null },
      { type: 'add', activityId: null, time: '06:30', minutes: 20, scope: 'everyday', title: 'Meditação', categoryId: 'mind', priority: 2 },
      { type: 'move', activityId: 'nao-existe', time: '10:00', minutes: null, scope: 'today', title: null, categoryId: null, priority: null },
      { type: 'setWake', activityId: null, time: '25:00', minutes: null, scope: 'weekdays', title: null, categoryId: null, priority: null },
    ], s, '2026-11-16');
    expect(dropped).toBe(2);
    expect(ops).toHaveLength(2);
    const next = applyOps(s, ops);
    expect(hm(buildDay(next, '2026-11-16').items.find((i) => i.activity.id === gym.id)!.start)).toBe('18:30');
    expect(next.activities.some((a) => a.title === 'Meditação')).toBe(true);
  });
  it('contexto enviado não inclui histórico nem dados pessoais', () => {
    const s = { ...s0(), profile: { ...s0().profile, name: 'Fulano' } };
    const ctx = aiContext(s, '2026-11-16');
    expect(ctx).not.toMatch(/Fulano|completions|achievements/);
    expect(JSON.parse(ctx).atividades.length).toBe(s.activities.length);
    expect(AI_SCHEMA.required).toEqual(['ops', 'summary']);
  });
});

describe('armazenamento e backup', () => {
  it('salva e carrega do IndexedDB', async () => {
    const s = s0();
    s.profile.weightKg = 77;
    await saveState(s);
    expect((await loadState()).profile.weightKg).toBe(77);
  });
  it('backup ida e volta; rejeita arquivo estranho', () => {
    const s = s0();
    const r = parseBackup(JSON.stringify(makeBackup(s)));
    expect(r.ok && r.state.activities.length).toBe(s.activities.length);
    expect(parseBackup('{"a":1}').ok).toBe(false);
    expect(parseBackup('não é json').ok).toBe(false);
  });
});
