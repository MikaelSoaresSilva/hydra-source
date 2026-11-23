// Teste de estresse: muitas combinações de trabalho/deslocamento × todos os dias da semana.
// Regras que nunca podem quebrar, em nenhuma combinação.
import { describe, expect, it } from 'vitest';
import { defaultState } from './defaults';
import { interpret } from './interpreter';
import { applyOps } from './ops';
import { buildDay } from './scheduler';
import { addDays, hm } from './time';
import type { State } from './types';
import { essentialDemand, findWork, latestWake, syncWork } from './work';

const MON = '2026-11-16';
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(MON, i));
const TOP = /^(Academia|Café da manhã|Almoço|Lanche da tarde|Jantar|Trabalho)/;

function scenario(start: number, hours: number, commute: number): State {
  let s = defaultState(new Date('2026-11-15T10:00:00'));
  const end = start + hours * 60;
  const txt = `Vou trabalhar das ${Math.floor(start / 60)}h${start % 60 ? String(start % 60).padStart(2, '0') : ''} às ${Math.floor((end % 1440) / 60)}h${end % 60 ? String(end % 60).padStart(2, '0') : ''}`;
  s = syncWork(s, applyOps(s, interpret(txt, s, MON).ops)).state;
  if (commute) s = syncWork(s, { ...s, profile: { ...s.profile, commuteMin: commute } }).state;
  return s;
}

const cases: [number, number, number][] = [];
for (let start = 6 * 60; start <= 13 * 60; start += 60) for (const hours of [4, 6, 8, 9]) for (const commute of [0, 30, 60]) cases.push([start, hours, commute]);

describe('estresse: trabalho de 06h a 13h, 4–9 h, deslocamento 0–60 min, 7 dias', () => {
  it(`${cases.length} combinações × 7 dias sem quebrar as regras`, () => {
    const problems: string[] = [];
    for (const [start, hours, commute] of cases) {
      const tag = `trabalho ${hm(start)} +${hours}h, desloc. ${commute}`;
      const s = scenario(start, hours, commute);
      const work = findWork(s);
      if (!work) { problems.push(`${tag}: trabalho não criado`); continue; }
      if ((work.anchor as { at: number }).at !== start) problems.push(`${tag}: trabalho começou ${hm((work.anchor as { at: number }).at)}`);
      // acordar a tempo da manhã + deslocamento (ou aviso de que não dá)
      const latest = latestWake(s, start, [1, 2, 3, 4, 5]);
      if (latest >= 4 * 60 && s.sleep.weekday.wake > latest) problems.push(`${tag}: acorda ${hm(s.sleep.weekday.wake)} mas precisava até ${hm(latest)}`);
      // idempotente
      if (syncWork(s, s).notes.length) problems.push(`${tag}: ajuste não é idempotente (${syncWork(s, s).notes[0]})`);
      for (const d of WEEK) {
        const p = buildDay(s, d);
        const main = p.items.filter((i) => i.end > i.start && !i.parentId);
        for (let i = 1; i < main.length; i++) if (main[i].start < main[i - 1].end) problems.push(`${tag} ${d}: ${main[i - 1].activity.title} sobrepõe ${main[i].activity.title}`);
        for (const i of p.items) if (i.start < p.wake || i.end > p.bed) problems.push(`${tag} ${d}: ${i.activity.title} fora de acordar–dormir`);
        for (const i of p.items.filter((x) => x.parentId)) {
          const par = p.items.find((x) => x.activity.id === i.parentId)!;
          if (i.start < par.start || i.end > par.end) problems.push(`${tag} ${d}: ${i.activity.title} fora de ${par.activity.title}`);
        }
        // prioridade máxima precisa caber sempre que o dia comporta o essencial (8 h de sono mínimo)
        const feasible = essentialDemand(s, new Date(`${d}T12:00:00Z`).getUTCDay(), work.duration) <= p.bed - p.wake;
        if (feasible) for (const u of p.unplaced) if (TOP.test(u.activity.title) || u.activity.priority === 0) problems.push(`${tag} ${d}: prioridade máxima não coube: ${u.activity.title}`);
        const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
        if (wd >= 1 && wd <= 5) {
          for (const m of ['Café da manhã', 'Almoço', 'Lanche da tarde', 'Jantar']) if (!p.items.some((i) => i.activity.title === m)) problems.push(`${tag} ${d}: faltou ${m}`);
          if (feasible && [1, 2, 4, 5].includes(wd) && !p.items.some((i) => /^Academia/.test(i.activity.title))) problems.push(`${tag} ${d}: faltou academia`);
          if (feasible && [1, 3, 5].includes(wd) && !p.items.some((i) => i.activity.title === 'Estudos')) problems.push(`${tag} ${d}: dia de estudo sem estudos`);
        }
        if (p.sleepMinutes < 8 * 60) problems.push(`${tag} ${d}: só ${Math.round(p.sleepMinutes / 6) / 10} h de sono`);
        const find = (re: RegExp) => p.items.find((i) => re.test(i.activity.title));
        const cafe = find(/^Café da manhã/); const jantar = find(/^Jantar/); const gym = find(/^(Academia|Treino de luta|Recuperação ativa)/); const bath = find(/^Banho/); const pos = find(/pós-treino/);
        if (cafe && cafe.start > 12 * 60) problems.push(`${tag} ${d}: café da manhã às ${hm(cafe.start)}`);
        if (jantar && jantar.start < 16 * 60 + 30) problems.push(`${tag} ${d}: jantar às ${hm(jantar.start)}`);
        if (gym && bath && bath.start < gym.end) problems.push(`${tag} ${d}: banho (${hm(bath.start)}) antes do fim do treino (${hm(gym.end)})`);
        if (gym && pos && pos.start < gym.end) problems.push(`${tag} ${d}: pós-treino antes do treino`);
        if (pos && jantar && gym && gym.end <= jantar.start && pos.start > jantar.start) problems.push(`${tag} ${d}: pós-treino (${hm(pos.start)}) depois do jantar (${hm(jantar.start)})`);
      }
    }
    expect([...new Set(problems)].slice(0, 25)).toEqual([]);
  });
});

describe('estresse: trocar o horário do trabalho de um valor para outro', () => {
  it('acordar acompanha, o ajuste é idempotente e o essencial continua no dia', () => {
    const problems: string[] = [];
    const starts = [6 * 60 + 30, 8 * 60, 9 * 60 + 30, 11 * 60, 13 * 60];
    for (const a of starts) for (const b of starts) {
      if (a === b) continue;
      const s1 = scenario(a, 8, 30);
      const work = findWork(s1)!;
      const moved = { ...s1, activities: s1.activities.map((x) => (x.id === work.id ? { ...x, anchor: { type: 'time' as const, at: b } } : x)) };
      const s2 = syncWork(s1, moved).state;
      if (syncWork(s1, s2).state.sleep.weekday.wake !== s2.sleep.weekday.wake) problems.push(`${hm(a)}→${hm(b)}: não idempotente`);
      const latest = latestWake(s2, b, [1, 2, 3, 4, 5]);
      if (s2.sleep.weekday.wake > latest) problems.push(`${hm(a)}→${hm(b)}: acorda ${hm(s2.sleep.weekday.wake)}, precisava até ${hm(latest)}`);
      for (const d of WEEK.slice(0, 5)) {
        const p = buildDay(s2, d);
        const feasible = essentialDemand(s2, new Date(`${d}T12:00:00Z`).getUTCDay(), 8 * 60) <= p.bed - p.wake;
        if (feasible) for (const u of p.unplaced) if (u.activity.priority === 0) problems.push(`${hm(a)}→${hm(b)} ${d}: ${u.activity.title} não coube`);
      }
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });
});
