// Operações que mudam a rotina. O interpretador (local ou Claude) só produz operações;
// quem decide os horários finais é sempre o montador do dia — por isso nunca há conflito.
import { buildDay, normBed, sleepMinutes, windowFor, type DayPlan } from './scheduler';
import { durationLabel, hm, isWeekend } from './time';
import { emptyOverride, type Activity, type DayOverride, type State } from './types';

export type Scope = { kind: 'always'; dayType?: 'weekday' | 'weekend' | 'both' } | { kind: 'date'; date: string };

export type Op =
  | { type: 'setWake'; at: number; scope: Scope; keepSleep: boolean }
  | { type: 'setBed'; at: number; scope: Scope }
  | { type: 'shiftSleep'; bedDelta: number; scope: Scope }
  | { type: 'move'; id: string; at: number; scope: Scope }
  | { type: 'skip'; id: string; date: string }
  | { type: 'unskip'; id: string; date: string }
  | { type: 'duration'; id: string; minutes: number; scope: Scope }
  | { type: 'add'; activity: Activity; scope: Scope }
  | { type: 'remove'; id: string }
  | { type: 'pause'; id: string; paused: boolean }
  | { type: 'join'; id: string; parentId: string; at: number; duration: number }
  | { type: 'unjoin'; id: string };

const ov = (s: State, date: string): DayOverride => (s.overrides[date] ??= emptyOverride());

function dayTypes(scope: Scope): ('weekday' | 'weekend')[] {
  if (scope.kind !== 'always') return [];
  const t = scope.dayType ?? 'weekday';
  return t === 'both' ? ['weekday', 'weekend'] : [t];
}

/** Aplica as operações numa CÓPIA do estado. */
export function applyOps(state: State, ops: Op[]): State {
  const s: State = structuredClone(state);
  for (const op of ops) {
    switch (op.type) {
      case 'setWake': {
        if (op.scope.kind === 'date') {
          const w = windowFor(s, op.scope.date);
          const delta = op.at - w.wake;
          const o = ov(s, op.scope.date);
          o.wake = op.at;
          if (op.keepSleep) o.bed = ((w.bed + delta) % 1440 + 1440) % 1440;
        } else {
          for (const t of dayTypes(op.scope)) {
            const w = s.sleep[t];
            const delta = op.at - w.wake;
            w.wake = op.at;
            if (op.keepSleep) w.bed = ((w.bed + delta) % 1440 + 1440) % 1440;
          }
        }
        break;
      }
      case 'setBed': {
        if (op.scope.kind === 'date') ov(s, op.scope.date).bed = op.at;
        else for (const t of dayTypes(op.scope)) s.sleep[t].bed = op.at;
        break;
      }
      case 'shiftSleep': {
        const shift = (w: { wake: number; bed: number }) => {
          w.bed = ((w.bed + op.bedDelta) % 1440 + 1440) % 1440;
          // Dormir mais cedo sem passar de 9 h de sono: o acordar acompanha.
          const sleep = sleepMinutes(normBed(w), w.wake);
          if (sleep > s.sleep.goalMax) w.wake = ((w.wake - (sleep - s.sleep.goalMax)) % 1440 + 1440) % 1440;
        };
        if (op.scope.kind === 'date') {
          const w = { ...windowFor(s, op.scope.date) };
          shift(w);
          const o = ov(s, op.scope.date); o.bed = w.bed; o.wake = w.wake;
        } else for (const t of dayTypes(op.scope)) shift(s.sleep[t]);
        break;
      }
      case 'move': {
        if (op.scope.kind === 'date') ov(s, op.scope.date).move[op.id] = op.at;
        else {
          const a = s.activities.find((x) => x.id === op.id);
          if (a) { a.anchor = { type: 'time', at: op.at }; a.fixed = true; }
        }
        break;
      }
      case 'skip': { const o = ov(s, op.date); if (!o.skip.includes(op.id)) o.skip.push(op.id); break; }
      case 'unskip': { const o = ov(s, op.date); o.skip = o.skip.filter((x) => x !== op.id); break; }
      case 'duration': {
        if (op.scope.kind === 'date') ov(s, op.scope.date).duration[op.id] = op.minutes;
        else { const a = s.activities.find((x) => x.id === op.id); if (a) a.duration = op.minutes; }
        break;
      }
      case 'add': {
        if (op.scope.kind === 'date') ov(s, op.scope.date).add.push(op.activity);
        else s.activities.push(op.activity);
        break;
      }
      case 'remove': s.activities = s.activities.filter((a) => a.id !== op.id); break;
      case 'pause': { const a = s.activities.find((x) => x.id === op.id); if (a) a.paused = op.paused; break; }
      case 'join': { const a = s.activities.find((x) => x.id === op.id); if (a && op.parentId !== op.id) a.join = { parentId: op.parentId, at: op.at, duration: op.duration }; break; }
      case 'unjoin': { const a = s.activities.find((x) => x.id === op.id); if (a) delete a.join; break; }
    }
  }
  return s;
}

const nameOf = (s: State, id: string) => s.activities.find((a) => a.id === id)?.title ?? Object.values(s.overrides).flatMap((o) => o.add).find((a) => a.id === id)?.title ?? id;
const scopeText = (sc: Scope, today: string) => sc.kind === 'date'
  ? (sc.date === today ? 'só hoje' : `só em ${sc.date.slice(8, 10)}/${sc.date.slice(5, 7)}`)
  : sc.dayType === 'weekend' ? 'nos fins de semana' : sc.dayType === 'both' ? 'todos os dias' : 'nos dias de semana';

/** Frase em português para cada operação (aparece na prévia). */
export function describeOp(s: State, op: Op, today: string): string {
  switch (op.type) {
    case 'setWake': return `Acordar às ${hm(op.at)} ${scopeText(op.scope, today)}${op.keepSleep ? ' (o horário de dormir acompanha para manter o mesmo tempo de sono)' : ''}.`;
    case 'setBed': return `Dormir às ${hm(op.at)} ${scopeText(op.scope, today)}.`;
    case 'shiftSleep': return `Dormir ${Math.abs(op.bedDelta)} min mais ${op.bedDelta < 0 ? 'cedo' : 'tarde'} ${scopeText(op.scope, today)}.`;
    case 'move': return `${nameOf(s, op.id)} às ${hm(op.at)} ${scopeText(op.scope, today)}.`;
    case 'skip': return `Sem ${nameOf(s, op.id)} ${op.date === today ? 'hoje' : `em ${op.date.slice(8, 10)}/${op.date.slice(5, 7)}`} (o espaço é reaproveitado).`;
    case 'unskip': return `${nameOf(s, op.id)} volta para a rotina do dia.`;
    case 'duration': return `${nameOf(s, op.id)} passa a durar ${durationLabel(op.minutes)} ${scopeText(op.scope, today)}.`;
    case 'add': return `Nova atividade: ${op.activity.title} (${durationLabel(op.activity.duration)}${op.activity.anchor.type === 'time' ? `, às ${hm(op.activity.anchor.at)}` : ''}) ${scopeText(op.scope, today)}.`;
    case 'remove': return `Remover ${nameOf(s, op.id)} da rotina.`;
    case 'pause': return `${op.paused ? 'Pausar' : 'Retomar'} ${nameOf(s, op.id)}.`;
    case 'join': return `${nameOf(s, op.id)} junto com ${nameOf(s, op.parentId)}, das ${hm(op.at)} às ${hm(op.at + op.duration)} (nos dias em que ${nameOf(s, op.parentId)} acontece; nos outros, horário normal).`;
    case 'unjoin': return `${nameOf(s, op.id)} volta a ter horário próprio.`;
  }
}

export interface Change { kind: 'moved' | 'added' | 'removed' | 'resized' | 'unplaced'; title: string; before?: string; after?: string }
export interface Preview {
  date: string;
  before: DayPlan;
  after: DayPlan;
  changes: Change[];
  warnings: string[];
}

/** Dia que melhor mostra o efeito das operações. */
export function previewDate(ops: Op[], today: string): string {
  const d = ops.find((o) => ('scope' in o && o.scope.kind === 'date') || o.type === 'skip' || o.type === 'unskip');
  if (d) return d.type === 'skip' || d.type === 'unskip' ? d.date : (d as { scope: { date: string } }).scope.date;
  const always = ops.filter((o) => 'scope' in o && o.scope.kind === 'always') as { scope: { kind: 'always'; dayType?: string } }[];
  const types = new Set(always.map((o) => o.scope.dayType ?? 'weekday'));
  if (always.length && !types.has('both') && types.size === 1) {
    const wantWeekend = types.has('weekend');
    let x = today;
    for (let i = 0; i < 7 && isWeekend(x) !== wantWeekend; i++) x = addDay(x);
    return x;
  }
  return today;
}

function addDay(iso: string) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }

export function preview(state: State, ops: Op[], today: string): Preview {
  const date = previewDate(ops, today);
  const next = applyOps(state, ops);
  const before = buildDay(state, date);
  const after = buildDay(next, date);
  const changes: Change[] = [];
  const range = (i: { start: number; end: number }) => `${hm(i.start)}–${hm(i.end)}`;
  for (const a of after.items) {
    const b = before.items.find((x) => x.activity.id === a.activity.id);
    if (!b) changes.push({ kind: 'added', title: a.activity.title, after: range(a) });
    else if (b.start !== a.start) changes.push({ kind: 'moved', title: a.activity.title, before: range(b), after: range(a) });
    else if (b.end !== a.end) changes.push({ kind: 'resized', title: a.activity.title, before: range(b), after: range(a) });
  }
  for (const b of before.items) if (!after.items.some((x) => x.activity.id === b.activity.id)) changes.push({ kind: 'removed', title: b.activity.title, before: range(b) });
  for (const u of after.unplaced) if (!before.unplaced.some((x) => x.activity.id === u.activity.id)) changes.push({ kind: 'unplaced', title: u.activity.title, after: u.reason });
  const warnings: string[] = [];
  if (after.sleepMinutes < next.sleep.goalMin) warnings.push(`Sono previsto de ${durationLabel(after.sleepMinutes)}: abaixo da meta de 8–9 h.`);
  if (after.sleepMinutes > next.sleep.goalMax + 30) warnings.push(`Sono previsto de ${durationLabel(after.sleepMinutes)}: acima de 9 h.`);
  warnings.push(...after.conflicts);
  return { date, before, after, changes, warnings };
}
