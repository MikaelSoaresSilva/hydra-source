import { describe, it, expect } from 'vitest';
import { calendarPos, defaultStart, recordAnswer, dueReviews, exScore, migrate, initialState, DEFAULT_SLOTS, MSG_INICIO, MSG_CONTINUA, weakPoints, masteryByCompetency } from '../src/engine/state';
import { buildNotifications } from '../src/engine/notifications';

describe('notificações de sábado e domingo', () => {
  const list = buildNotifications(DEFAULT_SLOTS, true);
  it('4 lembretes semanais: sáb/dom às 13h30 e 15h15', () => {
    expect(list).toHaveLength(4);
    const when = list.map((n) => (n.schedule as any).on);
    // padrão do plugin: weekday 7 = sábado, 1 = domingo
    expect(when).toEqual([
      { weekday: 7, hour: 13, minute: 30 }, { weekday: 7, hour: 15, minute: 15 },
      { weekday: 1, hour: 13, minute: 30 }, { weekday: 1, hour: 15, minute: 15 },
    ]);
  });
  it('mensagens exatamente como pedido', () => {
    expect(list[0].body).toBe('Hora de estudar! Mais um passo para desenvolver suas habilidades e construir seu futuro na programação.');
    expect(list[1].body).toBe('Continue firme! Pratique o que aprendeu e avance mais uma etapa da sua formação.');
    expect(list[2].body).toBe(MSG_INICIO); expect(list[3].body).toBe(MSG_CONTINUA);
  });
  it('IDs fixos e únicos (reagendar não duplica) e funcionam em modo ocioso (Doze)', () => {
    expect(new Set(list.map((n) => n.id)).size).toBe(4);
    expect(list.map((n) => n.id)).toEqual([1001, 1002, 1003, 1004]);
    for (const n of list) { expect((n.schedule as any).allowWhileIdle).toBe(true); expect(n.channelId).toBe('estudos'); expect(n.smallIcon).toBe('ic_stat_icon'); }
  });
  it('desativar geral ou individualmente', () => {
    expect(buildNotifications(DEFAULT_SLOTS, false)).toHaveLength(0);
    const s = DEFAULT_SLOTS.map((x) => ({ ...x }));
    s[1].enabled = false;
    expect(buildNotifications(s, true).map((n) => n.id)).toEqual([1001, 1003, 1004]);
  });
  it('horário personalizado é respeitado', () => {
    const s = DEFAULT_SLOTS.map((x) => ({ ...x })); s[0].hour = 9; s[0].minute = 5;
    expect((buildNotifications(s, true)[0].schedule as any).on).toEqual({ weekday: 7, hour: 9, minute: 5 });
  });
});

describe('calendário de 12 semanas', () => {
  it('início padrão é o próximo sábado', () => {
    expect(defaultStart(new Date(2026, 10, 18))).toBe('2026-11-21'); // quarta → sábado 21/11
    expect(defaultStart(new Date(2026, 10, 21))).toBe('2026-11-21'); // sábado → hoje
    expect(defaultStart(new Date(2026, 10, 22))).toBe('2026-11-21'); // domingo → sábado de ontem
  });
  it('mapeia datas para sessões', () => {
    const s = '2026-11-21';
    expect(calendarPos(s, new Date(2026, 10, 21, 14)).sessionN).toBe(1);
    expect(calendarPos(s, new Date(2026, 10, 22, 14)).sessionN).toBe(2);
    expect(calendarPos(s, new Date(2026, 10, 28, 14)).sessionN).toBe(3);
    const mid = calendarPos(s, new Date(2026, 10, 25));
    expect(mid.sessionN).toBeNull(); expect(mid.nextN).toBe(3); expect(mid.nextDate.getDate()).toBe(28);
    const sat = calendarPos(s, new Date(2026, 10, 21));
    expect(sat.nextN).toBe(2);
    // semana 12, domingo = sessão 24
    const last = new Date(2026, 10, 22); last.setDate(last.getDate() + 77);
    expect(calendarPos(s, last).sessionN).toBe(24);
    const after = new Date(2026, 10, 21); after.setDate(after.getDate() + 84);
    expect(calendarPos(s, after).sessionN).toBeNull(); expect(calendarPos(s, after).after).toBe(true);
    const before = calendarPos(s, new Date(2026, 10, 19));
    expect(before.before).toBe(true); expect(before.nextN).toBe(1);
  });
});

describe('revisão espaçada e domínio', () => {
  const t0 = 1_700_000_000_000, D = 86400000;
  it('acerto aumenta o intervalo; erro volta para hoje', () => {
    let s = recordAnswer(undefined, true, 0, t0);
    expect(s.box).toBe(1); expect(s.due).toBe(t0 + 1 * D); expect(s.firstTry).toBe(true);
    s = recordAnswer(s, true, 0, t0 + D); expect(s.box).toBe(2); expect(s.due).toBe(t0 + D + 3 * D);
    s = recordAnswer(s, false, 0, t0 + 5 * D); expect(s.box).toBe(0); expect(s.due).toBe(t0 + 5 * D);
    expect(s.correct).toBe(true); // já acertou alguma vez
  });
  it('fila de revisão traz só os vencidos', () => {
    const ex = { a: recordAnswer(undefined, false, 0, t0), b: recordAnswer(undefined, true, 0, t0) };
    expect(dueReviews(ex, t0 + 1000)).toEqual(['a']);
    expect(dueReviews(ex, t0 + 2 * D).sort()).toEqual(['a', 'b']);
  });
  it('nota: de primeira vale mais que com dicas', () => {
    const first = exScore(recordAnswer(undefined, true, 0, t0))!;
    const hinted = exScore(recordAnswer(recordAnswer(undefined, false, 1, t0), true, 1, t0))!;
    expect(first).toBe(1); expect(hinted).toBeLessThan(first); expect(exScore(recordAnswer(undefined, false, 0, t0))).toBe(0);
  });
  it('detecta pontos fracos', () => {
    const exs = [1, 2, 3].map((i) => ({ ex: { id: 'x' + i, competency: 'loops' } as any }));
    const st = { x1: recordAnswer(undefined, false, 0, t0), x2: recordAnswer(undefined, false, 0, t0) };
    const m = masteryByCompetency(exs, st);
    expect(weakPoints(m).map((w) => w.id)).toEqual(['loops']);
  });
});

describe('backup e migração', () => {
  it('estado corrompido ou vazio vira estado inicial válido', () => {
    expect(migrate(null).reminders.slots).toHaveLength(4);
    expect(migrate('lixo').version).toBe(1);
    const m = migrate({ name: 'Ana', lessons: { 'l-prog': { status: 'done', step: 3, startedAt: 1 } }, startDate: 'xx' });
    expect(m.name).toBe('Ana'); expect(m.lessons['l-prog'].status).toBe('done'); expect(m.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(m.exercises).toEqual({});
  });
  it('estado inicial: lembretes ligados e não configurado', () => {
    const s = initialState(); expect(s.reminders.enabled).toBe(true); expect(s.onboarded).toBe(false);
  });
});
