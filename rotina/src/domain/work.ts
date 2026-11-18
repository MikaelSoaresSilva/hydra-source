// Trabalho conectado: quando o horário do trabalho muda, o resto da rotina acompanha.
// - Manhã: o horário de acordar anda junto com o início do trabalho (dormir acompanha, mesmas horas de sono),
//   e nunca fica tarde demais para a rotina da manhã + o deslocamento caberem antes do expediente.
// - Deslocamento: "Ida para o trabalho" e "Volta para casa" grudadas no Trabalho (se você informar o tempo).
// - Tarde/noite: academia, banho, jantar… são reencaixados pelo montador do dia (encadeadas e flexíveis).
import { linkWorkLunch } from './migrate';
import { norm } from './interpreter';
import { hm } from './time';
import { emptyOverride, type Activity, type SleepWindow, type State } from './types';

export const COMMUTE_IN = 'commute_in';
export const COMMUTE_OUT = 'commute_out';
export const MIN_WAKE = 4 * 60;

export const isWork = (a: Activity) => /^trabalho/.test(norm(a.title)) && a.anchor.type === 'time' && !a.paused && a.id !== COMMUTE_IN && a.id !== COMMUTE_OUT;
export const findWork = (s: State) => s.activities.find(isWork);
const mod = (m: number) => ((m % 1440) + 1440) % 1440;
const r5 = (m: number) => Math.floor(m / 5) * 5;

/** Assinatura do trabalho: muda quando muda horário, duração, dias, deslocamento ou um ajuste "só hoje" dele. */
export function workSignature(s: State): string {
  const w = findWork(s);
  if (!w) return '';
  const dayChanges = Object.entries(s.overrides).filter(([, o]) => w.id in o.move || w.id in o.duration).map(([d, o]) => `${d}:${o.move[w.id] ?? ''}/${o.duration[w.id] ?? ''}`).sort();
  return JSON.stringify([w.id, w.anchor, w.duration, w.days, s.profile.commuteMin, dayChanges]);
}

/** Quanto tempo a rotina da manhã ocupa (do acordar até o fim do último passo "depois de acordar") nos dias de trabalho. */
export function morningSpan(s: State, days: number[]): number {
  let span = 0;
  for (const a of s.activities) {
    if (a.paused || !a.days.some((d) => days.includes(d))) continue;
    if (a.anchor.type === 'wake') span = Math.max(span, a.anchor.offset + a.duration);
  }
  return span;
}

/** Horário mais tarde para acordar e ainda caber a manhã + deslocamento antes do trabalho. */
export function latestWake(s: State, workStart: number, days: number[]): number {
  return r5(workStart - s.profile.commuteMin - morningSpan(s, days));
}

function moveWindow(w: SleepWindow, newWake: number): SleepWindow {
  const delta = newWake - w.wake;
  return { wake: mod(newWake), bed: mod(w.bed + delta) };
}

export interface WorkSync { state: State; notes: string[] }

export const MIN_SLEEP = 7 * 60;

/** Do fim do trabalho até dormir: deslocamento + jantar + passos "antes de dormir" (skincare, desacelerar). */
export function eveningSpan(s: State, days: number[]): number {
  let bedSpan = 0; let dinner = 0;
  for (const a of s.activities) {
    if (a.paused || !a.days.some((d) => days.includes(d))) continue;
    if (a.anchor.type === 'bed') bedSpan = Math.max(bedSpan, a.anchor.offset);
    if (/^jantar/.test(norm(a.title))) dinner = a.duration;
  }
  return s.profile.commuteMin + dinner + bedSpan;
}

/**
 * Encaixa acordar/dormir no dia de trabalho, mantendo as horas de sono de `from`:
 * acordar até `latestWake` (manhã antes do trabalho) e dormir só depois de caber a noite pós-trabalho.
 * Se o dia for longo demais, prioriza a manhã e encurta o sono até no mínimo 7 h, com aviso.
 */
/**
 * Tempo acordado que o dia exige só com o essencial e o prioritário (prioridade 0 e 1: refeições, academia,
 * trabalho e deslocamento, estudos no dia de estudo, higiene, banho, skincare, desacelerar). Atividades "junto"
 * com outra não contam (acontecem dentro dela). Para o trabalho, usa a duração informada.
 */
export function essentialDemand(s: State, wd: number, workDuration?: number): number {
  const present = new Set(s.activities.filter((a) => !a.paused && a.days.includes(wd)).map((a) => a.id));
  let need = 0;
  for (const a of s.activities) {
    if (!present.has(a.id) || a.kind === 'bed') continue;
    if (a.join && present.has(a.join.parentId)) continue;
    const pr = a.focusDays?.includes(wd) ? 0 : a.priority;
    if (pr > 1 || a.optional && pr !== 0) continue;
    need += isWork(a) && workDuration ? workDuration : a.duration;
  }
  return need;
}

export function fitDay(s: State, from: SleepWindow, wanted: number, start: number, duration: number, days: number[]): { wake: number; bed: number; keptSleep: boolean; note?: string } {
  let len = (from.wake + 1440 - (from.bed <= from.wake ? from.bed + 1440 : from.bed)) % 1440 || 1440; // horas de sono (min)
  // Se o essencial do dia não cabe acordado, o sono encurta — nunca abaixo da meta mínima (8 h).
  const demand = Math.max(...days.map((d) => essentialDemand(s, d, duration)));
  const floor = Math.min(len, s.sleep.goalMin);
  let shortened = false;
  if (1440 - len < demand) { const nl = Math.max(floor, 1440 - demand); shortened = nl < len; len = nl; }
  const hi = latestWake(s, start, days);
  const reqBed = start + duration + eveningSpan(s, days); // minutos do dia (pode passar de 1440)
  const lo = reqBed - 1440 + len; // acordar mais cedo que isso deixaria a noite sem espaço
  let note: string | undefined;
  let wake = Math.min(wanted, hi);
  if (wake < lo) wake = lo;
  if (lo > hi) {
    // não cabe tudo mantendo o sono: manhã primeiro, sono encurta (mín. 7 h)
    wake = Math.max(hi, MIN_WAKE);
    const bed = Math.min(reqBed, wake + 1440 - MIN_SLEEP);
    note = `Com trabalho das ${hm(start)} às ${hm(start + duration)}, não cabem a manhã, a noite e ${Math.round(len / 6) / 10} h de sono. Acordar às ${hm(wake)} e dormir às ${hm(bed)}${bed < reqBed ? ': ainda falta tempo à noite — encurte o jantar, o skincare ou o deslocamento' : ''}.`;
    return { wake: mod(wake), bed: mod(bed), keptSleep: false, note };
  }
  if (wake < MIN_WAKE) {
    note = `Para caber a manhã antes do trabalho às ${hm(start)} seria preciso acordar às ${hm(wake)}. Ficou ${hm(MIN_WAKE)} (o mais cedo que o app usa): encurte a rotina da manhã ou o deslocamento.`;
    wake = MIN_WAKE;
  }
  wake = r5(wake);
  if (shortened) {
    const bed = mod(wake + 1440 - len);
    return { wake: mod(wake), bed, keptSleep: false, note: `Para caber trabalho, refeições, academia e o essencial, o sono desses dias ficou em ${Math.round(len / 6) / 10} h (o mínimo da sua meta).` };
  }
  const nw = moveWindow(from, wake);
  return { ...nw, keptSleep: true, note };
}

/**
 * Ajusta a rotina ao trabalho. `prev` = estado antes da mudança (para saber quanto o trabalho andou).
 * Idempotente: rodar de novo sem mudança no trabalho não altera nada.
 */
export function syncWork(prev: State | null, next: State): WorkSync {
  const notes: string[] = [];
  const changed = !prev || workSignature(prev) !== workSignature(next);
  let s: State = structuredClone(next);
  const work = findWork(s);

  // Deslocamento grudado no trabalho.
  const commute = s.profile.commuteMin;
  const legs = s.activities.filter((a) => a.id === COMMUTE_IN || a.id === COMMUTE_OUT);
  if (!work || commute <= 0) {
    if (legs.length) { s.activities = s.activities.filter((a) => a.id !== COMMUTE_IN && a.id !== COMMUTE_OUT); notes.push('Deslocamento removido da rotina.'); }
  } else {
    const leg = (id: string, title: string, side: 'before' | 'after'): Activity => ({
      id, title, categoryId: 'work', description: side === 'before' ? 'Caminho até o trabalho. Bom momento para podcast ou revisar o dia.' : 'Caminho de volta. Desacelere: o resto da rotina começa quando você chega.',
      duration: commute, anchor: { type: 'rel', ids: [work.id], side, gap: 0, fallback: side === 'before' ? (work.anchor as { at: number }).at - commute : (work.anchor as { at: number }).at + work.duration },
      fixed: false, priority: 1, days: [...work.days], paused: false, notify: true, kind: 'normal',
    });
    const want = [leg(COMMUTE_IN, 'Ida para o trabalho', 'before'), leg(COMMUTE_OUT, 'Volta para casa', 'after')];
    for (const w of want) {
      const cur = s.activities.find((a) => a.id === w.id);
      if (!cur) { s.activities.push(w); if (w.id === COMMUTE_IN) notes.push(`Deslocamento de ${commute} min incluído antes e depois do trabalho.`); }
      else if (cur.duration !== w.duration || JSON.stringify(cur.anchor) !== JSON.stringify(w.anchor) || cur.days.join() !== w.days.join()) {
        s.activities = s.activities.map((a) => (a.id === w.id ? { ...a, duration: w.duration, anchor: w.anchor, days: w.days } : a));
      }
    }
  }
  if (!work) return { state: s, notes };

  // Almoço do trabalho dentro do expediente.
  const lunch = linkWorkLunch(s);
  if (lunch.linked && !s.activities.find((a) => /almoco/.test(norm(a.title)))?.join) { s = lunch.state; notes.push(`Almoço junto com o Trabalho (${hm(s.profile.workLunch.at)}–${hm(s.profile.workLunch.at + s.profile.workLunch.duration)}).`); }
  else if (lunch.linked) s = lunch.state;

  // Lanche da tarde e jantar: se o horário deles cai dentro do expediente, acontecem no trabalho (junto).
  const wStart = (work.anchor as { at: number }).at;
  const wEnd = wStart + work.duration;
  const lunchJoin = s.activities.find((a) => /almoco/.test(norm(a.title)))?.join;
  for (const re of [/^lanche da tarde/, /^jantar/]) {
    const meal = s.activities.find((a) => re.test(norm(a.title)));
    if (!meal) continue;
    const own = meal.anchor.type === 'time' ? meal.anchor.at : null;
    const at = meal.join?.parentId === work.id ? meal.join.at : own;
    const clashesLunch = lunchJoin && at !== null && at < lunchJoin.at + lunchJoin.duration && lunchJoin.at < at + meal.duration;
    const inside = at !== null && at >= wStart && at + meal.duration <= wEnd && !clashesLunch;
    if (inside && meal.join?.parentId !== work.id) {
      s.activities = s.activities.map((a) => (a.id === meal.id ? { ...a, join: { parentId: work.id, at: at!, duration: meal.duration } } : a));
      notes.push(`${meal.title} junto com o Trabalho às ${hm(at!)} (é uma das 4 refeições prioritárias).`);
    } else if (!inside && meal.join?.parentId === work.id) {
      s.activities = s.activities.map((a) => { if (a.id !== meal.id) return a; const { join: _j, ...rest } = a; void _j; return rest; });
    }
  }

  // Manhã: acordar acompanha o trabalho.
  const start = (work.anchor as { at: number }).at;
  const prevWork = prev ? findWork(prev) : undefined;
  const prevStart = prevWork && prevWork.id === work.id && prevWork.anchor.type === 'time' ? prevWork.anchor.at : null;
  const types: ('weekday' | 'weekend')[] = [];
  if (work.days.some((d) => d >= 1 && d <= 5)) types.push('weekday');
  if (work.days.some((d) => d === 0 || d === 6)) types.push('weekend');
  for (const t of types) {
    const days = t === 'weekday' ? work.days.filter((d) => d >= 1 && d <= 5) : work.days.filter((d) => d === 0 || d === 6);
    const w = s.sleep[t];
    // O deslocamento parte do estado ANTERIOR: rodar de novo não move em dobro.
    const from = prevStart !== null && prevStart !== start && prev ? prev.sleep[t] : w;
    const wanted = from === w ? w.wake : from.wake + (start - prevStart!);
    const fit = fitDay(s, from, wanted, start, work.duration, days);
    if (fit.note && changed) notes.push(fit.note);
    if (fit.wake !== w.wake || fit.bed !== w.bed) {
      notes.push(`${t === 'weekday' ? 'Dias de semana' : 'Fim de semana'}: acordar ${hm(w.wake)} → ${hm(fit.wake)} e dormir ${hm(w.bed)} → ${hm(fit.bed)}${fit.keptSleep ? ' (mesmas horas de sono)' : ''}, para a manhã caber antes do trabalho (${hm(start)}) e a noite depois dele.`);
      s.sleep[t] = { wake: fit.wake, bed: fit.bed };
    }
  }

  // Trabalho mudado só em um dia: acordar daquele dia acompanha (também calculado a partir do estado anterior).
  for (const [date, o] of Object.entries(s.overrides)) {
    if (!(work.id in o.move)) continue;
    const dayStart = o.move[work.id];
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    const baseOf = (st: State) => (wd === 0 || wd === 6 ? st.sleep.weekend : st.sleep.weekday);
    const winOf = (st: State) => ({ wake: st.overrides[date]?.wake ?? baseOf(st).wake, bed: st.overrides[date]?.bed ?? baseOf(st).bed });
    const cur = winOf(s);
    const p0 = prev ?? s;
    const prevDay = p0.overrides[date]?.move[work.id];
    const prevStartBase = prevStart ?? start;
    let from = cur; let target = cur.wake;
    if (prevDay === undefined) { from = winOf(p0); target = from.wake + (dayStart - prevStartBase); }
    else if (prevDay !== dayStart) { from = winOf(p0); target = from.wake + (dayStart - prevDay); }
    const fit = fitDay(s, from, target, dayStart, o.duration[work.id] ?? work.duration, [wd]);
    if (fit.wake !== cur.wake || fit.bed !== cur.bed) {
      s.overrides[date] = { ...(s.overrides[date] ?? emptyOverride()), wake: fit.wake, bed: fit.bed };
      notes.push(`Em ${date.slice(8, 10)}/${date.slice(5, 7)}: acordar às ${hm(fit.wake)} e dormir às ${hm(fit.bed)}, por causa do trabalho às ${hm(dayStart)}.`);
    }
  }
  return { state: s, notes };
}

/** Texto do horário de uma atividade (lista da rotina, IA). */
export function anchorLabel(a: Activity, all: Activity[]): string {
  if (a.kind === 'wake') return 'no horário de acordar';
  if (a.kind === 'bed') return 'no horário de dormir';
  const an = a.anchor;
  if (an.type === 'time') return `${a.fixed ? '' : 'perto de '}${hm(an.at)}–${hm(an.at + a.duration)}`;
  if (an.type === 'wake') return `${an.offset} min após acordar`;
  if (an.type === 'bed') return `${an.offset} min antes de dormir`;
  const names = an.ids.map((id) => all.find((x) => x.id === id)?.title).filter(Boolean).join(' ou ');
  return `${an.side === 'after' ? 'logo depois de' : 'logo antes de'} ${names || '—'}${an.gap ? ` (+${an.gap} min)` : ''}; nos outros dias perto de ${hm(an.fallback)}`;
}

/** Minuto usado para ordenar a lista da rotina. */
export function anchorSortKey(a: Activity, all: Activity[]): number {
  if (a.kind === 'wake') return -1;
  if (a.kind === 'bed') return 3000;
  const an = a.anchor;
  if (an.type === 'time') return an.at;
  if (an.type === 'wake') return an.offset;
  if (an.type === 'bed') return 2000 - an.offset;
  const p = all.find((x) => an.ids.includes(x.id) && x.anchor.type === 'time');
  return p && p.anchor.type === 'time' ? p.anchor.at + (an.side === 'after' ? p.duration + an.gap : -an.gap - a.duration) : an.fallback;
}
