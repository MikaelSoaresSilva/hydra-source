// Garante a integridade do conteúdo: referências, IDs, e que TODA solução passa nos próprios testes.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { ALL_LESSONS, LESSONS, TRACK_ORDER, COMPETENCIES, PROJECTS, AREAS } from '../src/data';
import { SESSIONS, blocksFor } from '../src/data/schedule';
import { RESOURCES, RESOURCE_BY_ID } from '../src/data/resources';
import { LOJA_SQL } from '../src/data/lessons/backend';
import { lessonExercises, buildAssessment, REQUIRED_LESSONS } from '../src/engine/progress';
import { sameRows } from '../src/engine/sql-runner';
import type { Exercise } from '../src/data/types';

const require = createRequire(import.meta.url);
const allEx: Exercise[] = ALL_LESSONS.flatMap(lessonExercises);

describe('estrutura do conteúdo', () => {
  it('tem as aulas antigas preservadas e as novas', () => {
    expect(ALL_LESSONS.length).toBeGreaterThanOrEqual(70);
    for (const id of ['l-prog', 'l-crud', 'l-auth', 'l-interview', 'l-system-design']) expect(LESSONS[id]).toBeTruthy();
    expect(allEx.length).toBeGreaterThanOrEqual(600);
  });
  it('IDs de aulas e exercícios são únicos', () => {
    expect(new Set(ALL_LESSONS.map((l) => l.id)).size).toBe(ALL_LESSONS.length);
    const ids = allEx.map((e) => e.id);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    expect(dup).toEqual([]);
  });
  it('toda aula está na trilha e toda aula da trilha existe', () => {
    for (const id of TRACK_ORDER) expect(LESSONS[id], id).toBeTruthy();
    for (const l of ALL_LESSONS) expect(TRACK_ORDER, l.id).toContain(l.id);
  });
  it('toda aula tem área, competências conhecidas e pré-requisitos válidos', () => {
    const areas = new Set(AREAS.map((a) => a.id));
    for (const l of ALL_LESSONS) {
      expect(areas.has(l.area!), l.id).toBe(true);
      for (const c of l.competencies) expect(COMPETENCIES[c], `${l.id} → ${c}`).toBeTruthy();
      for (const p of l.prereqs) expect(LESSONS[p], `${l.id} prereq ${p}`).toBeTruthy();
    }
    for (const e of allEx) expect(COMPETENCIES[e.competency], `${e.id} → ${e.competency}`).toBeTruthy();
  });
  it('múltipla escolha: resposta dentro das opções', () => {
    for (const e of allEx) if (e.type === 'mcq') { expect(e.answer, e.id).toBeGreaterThanOrEqual(0); expect(e.answer, e.id).toBeLessThan(e.options.length); }
  });
});

describe('cronograma de 12 semanas', () => {
  it('24 sessões, sábado e domingo, 12 semanas, 3 meses', () => {
    expect(SESSIONS).toHaveLength(24);
    SESSIONS.forEach((s, i) => { expect(s.n).toBe(i + 1); expect(s.week).toBe(Math.floor(i / 2) + 1); expect(s.day).toBe(i % 2 ? 'dom' : 'sab'); });
    expect(SESSIONS.filter((s) => s.assessment).map((s) => s.n)).toEqual([8, 16, 24]);
  });
  it('referências de aulas, recursos e projetos existem', () => {
    const pids = new Set(PROJECTS.map((p) => p.id));
    for (const s of SESSIONS) {
      for (const l of [...s.lessons, ...(s.optional ?? [])]) expect(LESSONS[l], `${s.id} ${l}`).toBeTruthy();
      for (const r of s.resources) expect(RESOURCE_BY_ID[r], `${s.id} ${r}`).toBeTruthy();
      if (s.project) expect(pids.has(s.project.id), s.project.id).toBe(true);
    }
  });
  it('cada sessão soma exatamente 180 minutos (13h30–16h30)', () => {
    for (const s of SESSIONS) {
      const b = blocksFor(s, (id) => id);
      expect(b.reduce((a, x) => a + x.minutes, 0), s.id).toBe(180);
      expect(b[0].start).toBe('13:30');
      // blocos encadeados sem buracos
      let t = 13 * 60 + 30;
      for (const x of b) { const [h, m] = x.start.split(':').map(Number); expect(h * 60 + m, `${s.id} ${x.title}`).toBe(t); t += x.minutes; }
      expect(t).toBe(16 * 60 + 30);
    }
  });
  it('todas as áreas pedidas aparecem nas aulas obrigatórias', () => {
    const areas = new Set(REQUIRED_LESSONS.map((id) => LESSONS[id].area));
    for (const a of ['fund', 'ferramentas', 'front', 'back', 'mobile', 'desktop', 'ia', 'dados', 'jogos', 'outras', 'carreira']) expect(areas.has(a as never), a).toBe(true);
  });
  it('Backend é a área com mais aulas obrigatórias (foco principal)', () => {
    const count: Record<string, number> = {};
    for (const id of REQUIRED_LESSONS) count[LESSONS[id].area!] = (count[LESSONS[id].area!] ?? 0) + 1;
    const max = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
    expect(max).toBe('back');
  });
});

describe('recursos externos', () => {
  it('ids únicos, aulas válidas e campos obrigatórios', () => {
    expect(new Set(RESOURCES.map((r) => r.id)).size).toBe(RESOURCES.length);
    for (const r of RESOURCES) {
      expect(r.url, r.id).toMatch(/^https:\/\//);
      expect(r.guide.length, r.id).toBeGreaterThan(5);
      for (const l of r.lessons) expect(LESSONS[l], `${r.id} → ${l}`).toBeTruthy();
    }
    expect(RESOURCES.filter((r) => r.lang === 'pt').length / RESOURCES.length).toBeGreaterThan(0.6);
  });
});

// ─── Soluções passam nos próprios testes ───
const eq = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  return ka.length === kb.length && ka.every((k) => eq((a as any)[k], (b as any)[k]));
};
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;

describe('soluções JavaScript', () => {
  const codeEx = allEx.filter((e) => e.type === 'code');
  it(`há exercícios de código (${codeEx.length})`, () => expect(codeEx.length).toBeGreaterThan(130));
  for (const e of codeEx) {
    if (e.type !== 'code') continue;
    it(e.id, async () => {
      const calls = e.tests.map((t, i) => `try { __r[${i}] = { ok: true, v: await (${t.call}) }; } catch (__e) { __r[${i}] = { ok: false, e: __e?.message }; }`).join('\n');
      const fn = new AsyncFn('console', '__code', e.solution + '\n;const __r=[];\n' + calls + '\nreturn __r;');
      const r = await fn({ log() {}, error() {}, warn() {}, info() {} }, e.solution);
      e.tests.forEach((t, i) => { expect(r[i].ok, `${t.desc}: ${r[i].e}`).toBe(true); expect(eq(r[i].v, t.expect), `${t.desc} → ${JSON.stringify(r[i].v)}`).toBe(true); });
    });
  }
});

describe('soluções Python (Skulpt)', () => {
  (globalThis as any).window = globalThis;
  require('../node_modules/skulpt/dist/skulpt.min.js');
  require('../node_modules/skulpt/dist/skulpt-stdlib.js');
  const Sk = (globalThis as any).Sk;
  const run = async (code: string) => {
    let out = '';
    Sk.configure({ output: (t: string) => { out += t; }, read: (f: string) => Sk.builtinFiles.files[f], __future__: Sk.python3, execLimit: 5000 });
    await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<stdin>', false, code, true));
    return out;
  };
  for (const e of allEx) {
    if (e.type !== 'py') continue;
    it(e.id, async () => {
      if (e.tests?.length) {
        const code = e.solution + '\n' + e.tests.map((t, i) => `print("@@${i}:" + str(${t.call}))`).join('\n');
        const out = await run(code);
        e.tests.forEach((t, i) => { const m = out.split('\n').find((l) => l.startsWith(`@@${i}:`)); expect(m?.slice(`@@${i}:`.length), t.desc).toBe(t.expect); });
      } else {
        expect((await run(e.solution)).trim()).toBe(e.stdout?.trim());
      }
    });
  }
  it('exemplos Python das aulas executam sem erro', async () => {
    for (const l of ALL_LESSONS) for (const s of l.steps) if (s.kind === 'python' && s.code) await expect(run(s.code), l.id + ' ' + s.title).resolves.toBeTypeOf('string');
  });
  it('predições Python conferem com a execução real', async () => {
    for (const e of allEx) if (e.type === 'predict' && e.lang === 'py') expect((await run(e.code)).trim(), e.id).toBe(e.expected);
  });
});

describe('soluções SQL (sql.js)', async () => {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const exec = (q: string) => { const db = new SQL.Database(); db.run(LOJA_SQL); const r = db.exec(q); db.close(); return r; };
  for (const e of allEx) {
    if (e.type !== 'sql') continue;
    it(e.id, () => { const r = exec(e.solution); expect(sameRows(r[r.length - 1].values, e.expected, e.ordered), JSON.stringify(r[r.length - 1].values)).toBe(true); });
  }
  it('exemplos SQL das aulas executam sem erro', () => {
    for (const l of ALL_LESSONS) for (const s of l.steps) if (s.kind === 'sql' && s.code) expect(() => exec(s.code!), l.id).not.toThrow();
  });
});

describe('predições JavaScript conferem com a execução', () => {
  for (const e of allEx) {
    if (e.type !== 'predict' || (e.lang ?? 'js') !== 'js' || !e.run) continue;
    it(e.id, async () => {
      const logs: string[] = [];
      const fmt = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || typeof v === 'number' || typeof v === 'boolean' || v === null ? String(v) : Array.isArray(v) ? (v.length ? '[ ' + v.map((x) => (typeof x === 'string' ? `'${x}'` : fmt(x))).join(', ') + ' ]' : '[]') : JSON.stringify(v));
      const con = { log: (...a: unknown[]) => logs.push(a.map(fmt).join(' ')) };
      const fn = new AsyncFn('console', e.code);
      await fn(con);
      await new Promise((r) => setTimeout(r, 50));
      const norm = (s: string) => s.split('\n').map((x) => x.trim()).join('\n').trim();
      expect(norm(logs.join('\n'))).toBe(norm(e.expected));
    });
  }
});

describe('avaliações', () => {
  it('mês 1 e 2 com 15 perguntas, final com 25, sem repetir', () => {
    for (const n of [1, 2, 3] as const) {
      const q = buildAssessment(n, 42);
      expect(q.length).toBe(n === 3 ? 25 : 15);
      expect(new Set(q.map((x) => x.id)).size).toBe(q.length);
    }
  });
});
