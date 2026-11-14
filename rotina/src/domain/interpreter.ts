// Interpretador local (funciona sem internet): entende pedidos em português sobre a rotina
// e transforma em operações. O que ele não entender pode ir para o Claude (se você ativar).
import { uid } from './defaults';
import type { Op, Scope } from './ops';
import { addDays, isWeekend, spanMinutes } from './time';
import type { Activity, State } from './types';

export interface Interpretation {
  ops: Op[];
  /** Frases que o app entendeu. */
  understood: string[];
  /** Trechos que não deu para entender. */
  unknown: string[];
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

const NUM_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, meia: 0.5 };
const numVal = (s: string) => (s in NUM_WORDS ? NUM_WORDS[s] : Number(s.replace(',', '.')));

/** Palavras que identificam cada atividade (procuradas no título e na categoria). */
const SYNONYMS: { words: RegExp; match: (a: Activity) => boolean }[] = [
  { words: /\b(academia|musculacao|malhar|malhacao|gym|treino de forca|treinar|treino)\b/, match: (a) => /academia|muscula/i.test(norm(a.title)) },
  { words: /\b(cardio|esteira|bike|bicicleta|corrida|correr|aerobico)\b/, match: (a) => /cardio/.test(norm(a.title)) },
  { words: /\b(luta|boxe|mma)\b/, match: (a) => /luta|boxe|mma/.test(norm(a.title)) },
  { words: /\b(estudo|estudos|estudar|faculdade|curso)\b/, match: (a) => /estud/.test(norm(a.title)) },
  { words: /\b(leitura|ler|livro)\b/, match: (a) => /leitura|ler\b/.test(norm(a.title)) },
  { words: /\b(skincare|pele|rosto)\b.*\b(noite|noturno)\b|\b(noite|noturno)\b.*\b(skincare|pele)\b/, match: (a) => /skincare noturno/.test(norm(a.title)) },
  { words: /\b(skincare|pele)\b/, match: (a) => /skincare matinal/.test(norm(a.title)) },
  { words: /\b(higiene|banho)\b/, match: (a) => /higiene/.test(norm(a.title)) },
  { words: /\b(cafe da manha|cafe)\b/, match: (a) => /cafe da manha/.test(norm(a.title)) },
  { words: /\b(almoco|almocar)\b/, match: (a) => /almoco/.test(norm(a.title)) },
  { words: /\b(janta|jantar)\b/, match: (a) => /jantar/.test(norm(a.title)) },
  { words: /\bpos[- ]?treino\b/, match: (a) => /pos-treino/.test(norm(a.title)) },
  { words: /\blanche\b/, match: (a) => /lanche da tarde/.test(norm(a.title)) },
  { words: /\b(alongamento|alongar|mobilidade)\b/, match: (a) => /alongamento/.test(norm(a.title)) },
  { words: /\b(abdomen|abdominal|abdominais|core)\b/, match: (a) => /abdomen/.test(norm(a.title)) },
  { words: /\b(lavar|hidratar|hidratacao)\b.*\bcabelo\b/, match: (a) => /lavar/.test(norm(a.title)) },
  { words: /\b(cabelo|barba)\b/, match: (a) => /cabelo e barba/.test(norm(a.title)) },
  { words: /\b(lazer|tempo livre|descansar|jogar|videogame)\b/, match: (a) => /tempo livre|lazer/.test(norm(a.title)) },
  { words: /\b(organizacao|organizar|arrumar)\b/, match: (a) => /organiza/.test(norm(a.title)) },
  { words: /\b(recuperacao|caminhada)\b/, match: (a) => /recupera/.test(norm(a.title)) },
  { words: /\b(trabalho|trabalhar|expediente|servico|emprego)\b/, match: (a) => /trabalho/.test(norm(a.title)) },
  { words: /\b(desacelerar|preparar para dormir|preparacao)\b/, match: (a) => /preparar para dormir/.test(norm(a.title)) },
];

/** Atividades citadas no texto. */
export function findActivities(text: string, state: State): Activity[] {
  const t = norm(text);
  const found: Activity[] = [];
  for (const s of SYNONYMS) {
    if (!s.words.test(t)) continue;
    const a = state.activities.find(s.match);
    if (a && !found.includes(a)) { found.push(a); if (s.words.source.includes('noturno')) break; }
  }
  // Título exato de atividade criada pelo usuário.
  for (const a of state.activities) {
    const title = norm(a.title);
    if (title.length >= 4 && t.includes(title) && !found.includes(a)) found.push(a);
  }
  return found;
}

/** Durações: "1 hora", "1h30", "45 min", "meia hora", "uma hora e meia". */
export function parseDuration(t: string): { minutes: number; span: [number, number] } | null {
  const re = /\b(\d+(?:[.,]\d+)?|uma|um|duas|dois|tres|meia)\s*(horas?|h(?![a-z]))(\d{2})?(?:\s*e\s*(meia|\d+\s*(?:min|minutos)))?|\b(\d+)\s*(?:min|minutos)\b/g;
  for (const m of t.matchAll(re)) {
    // "às 18h" / "as 8h30" são horários, não duração.
    const before = t.slice(Math.max(0, m.index - 6), m.index);
    if (m[1] && /\b(as|a|ate|das|para|pras?)\s*$/.test(before)) continue;
    let minutes: number;
    if (m[5]) minutes = Number(m[5]);
    else {
      minutes = Math.round(numVal(m[1]) * 60) + (m[3] ? Number(m[3]) : 0);
      if (m[4]) minutes += m[4] === 'meia' ? 30 : Number(m[4].replace(/\D/g, ''));
    }
    if (minutes > 0 && minutes <= 16 * 60) return { minutes, span: [m.index, m.index + m[0].length] };
  }
  return null;
}

/** Horários: "às 18h", "6h", "6:30", "18h30", "7 da manhã", "8 da noite", "meio-dia". */
export function parseTimes(t: string): number[] {
  const out: number[] = [];
  if (/\bmeio[- ]dia\b/.test(t)) out.push(12 * 60);
  if (/\bmeia[- ]noite\b/.test(t)) out.push(0);
  const re = /(?:\b(?:as|a|das|ate|para|pras?|de)\s+)?\b(\d{1,2})(?:(?::|h)(\d{2})|\s*(h|horas?)(?![a-z]))(?:\s*(da manha|da tarde|da noite|da madrugada))?|\b(?:as|das|ate)\s+(\d{1,2})\b(?:\s*(da manha|da tarde|da noite|da madrugada))?/g;
  for (const m of t.matchAll(re)) {
    const prefixHasTime = /\b(as|das|ate|para|pras?)\s+$/.test(m[0].slice(0, m[0].search(/\d/)));
    const h = Number(m[1] ?? m[5]);
    const mm = Number(m[2] ?? 0);
    const period = m[4] ?? m[6];
    // "1 hora", "2 horas" sem "às" = duração, não horário.
    if (m[3] && /^hora/.test(m[3]) && !prefixHasTime && !period) continue;
    if (h > 23 || mm > 59) continue;
    let hh = h;
    if ((period === 'da tarde' || period === 'da noite') && hh < 12) hh += 12;
    if (period === 'da manha' && hh === 12) hh = 0;
    out.push(hh * 60 + mm);
  }
  return out;
}

function scopeOf(t: string, today: string, forDate = false): Scope {
  if (/\bamanha\b/.test(t)) return { kind: 'date', date: addDays(today, 1) };
  if (/\b(hoje|agora|esta noite|essa noite|hj)\b/.test(t) && !/\ba partir de hoje\b/.test(t)) return { kind: 'date', date: today };
  if (forDate) return { kind: 'date', date: today };
  if (/\b(fim de semana|fins de semana|final de semana|sabado e domingo)\b/.test(t)) return { kind: 'always', dayType: 'weekend' };
  if (/\b(todos os dias|todo dia|sempre|todos os dias da semana)\b/.test(t)) return { kind: 'always', dayType: 'both' };
  return { kind: 'always', dayType: 'weekday' };
}

const CAT_GUESS: [RegExp, string][] = [
  [/\b(estud|ler|leitura|curso|idioma|ingles|meditar|meditacao|programar|foco|habilidade|aula)/, 'mind'],
  [/\b(treino|correr|corrida|caminhada|alongamento|yoga|natacao|futebol|abdominal|flexao|luta)/, 'body'],
  [/\b(comer|refeicao|lanche|agua|cozinhar|marmita|suplemento|creatina)/, 'nutrition'],
  [/\b(pele|skincare|rosto|protetor)/, 'face'],
  [/\b(cabelo|barba|corte)/, 'hair'],
  [/\b(dormir|sono|cochilo|soneca)/, 'sleep'],
  [/\b(trabalh|reuniao|compromisso|medico|dentista|consulta|prova|entrevista)/, 'work'],
];

function guessTitle(clause: string, verbs: RegExp): string {
  let t = clause.replace(verbs, ' ')
    .replace(/\b(\d+(?:[.,]\d+)?|uma|um|duas|dois|meia)\s*(horas?|h|min|minutos)\b(\s*e\s*(meia|\d+\s*min(utos)?))?/g, ' ')
    .replace(/\b(as|das|ate|para)\s+\d{1,2}(:\d{2}|h\d{0,2})?\b/g, ' ')
    .replace(/\b\d{1,2}(:\d{2}|h\d{0,2})\b/g, ' ')
    .replace(/\b(hoje|amanha|todo dia|todos os dias|sempre|por dia|diariamente|a rotina|na rotina|minha rotina|na minha rotina|de|do|da|para|pra|por|um|uma|o|a|os|as|mais|eu|quero|preciso|vou|tambem)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function splitClauses(text: string): string[] {
  return text
    .split(/[.;!\n]+|,\s*(?=e\s)|\s+e\s+(?=(?:quero|preciso|vou|hoje|amanha|nao|adicionar|adiciona|mudar|muda|dormir|acordar|tirar|remover|colocar|incluir)\b)/)
    .map((c) => c.trim().replace(/^e\s+/, ''))
    .filter(Boolean);
}

export function interpret(text: string, state: State, today: string): Interpretation {
  const ops: Op[] = [];
  const understood: string[] = [];
  const unknown: string[] = [];
  // "Hoje ... e quero dormir mais cedo": o "hoje" vale para as frases seguintes que não dizem quando.
  const SCOPE_WORD = /\b(hoje|amanha|hj|sempre|todo dia|todos os dias|a partir de|fim de semana|fins de semana|final de semana|dias de semana|durante a semana)\b/;
  let carry: string | null = null;
  for (const raw0 of splitClauses(norm(text))) {
    const m = /\b(hoje|amanha|hj)\b/.exec(raw0);
    const raw = !SCOPE_WORD.test(raw0) && carry ? `${carry} ${raw0}` : raw0;
    if (m && !/\ba partir de hoje\b/.test(raw0)) carry = m[1];
    else if (SCOPE_WORD.test(raw0)) carry = null;
    const before = ops.length;
    clause(raw, state, today, ops);
    if (ops.length > before) understood.push(raw0); else unknown.push(raw0);
  }
  return { ops, understood, unknown };
}

function clause(t: string, state: State, today: string, ops: Op[]) {
  const dur = parseDuration(t);
  const timeText = dur ? t.slice(0, dur.span[0]) + ' '.repeat(dur.span[1] - dur.span[0]) + t.slice(dur.span[1]) : t;
  const times = parseTimes(timeText);
  const acts = findActivities(t, state);
  const negative = /\b(nao (vou|irei|vai dar|tenho)\b|nao consigo|nao da|sem tempo|sem|pular|pula|cancelar|cancela|desmarcar|folga de|nao (vou )?fazer)\b/.test(t);

  // ACORDAR
  if (/\b(acordar|acordo|despertar|levantar|acorda)\b/.test(t)) {
    const scope = scopeOf(t, today);
    if (times.length) { ops.push({ type: 'setWake', at: times[times.length - 1], scope, keepSleep: true }); return; }
    const d = dur?.minutes ?? 30;
    if (/\bmais cedo\b/.test(t)) { ops.push({ type: 'setWake', at: wakeOf(state, scope) - d, scope, keepSleep: true }); return; }
    if (/\bmais tarde\b/.test(t)) { ops.push({ type: 'setWake', at: wakeOf(state, scope) + d, scope, keepSleep: true }); return; }
  }

  // DORMIR
  if (/\b(dormir|deitar|durmo|me deitar|apagar a luz)\b/.test(t) && !acts.some((a) => /preparar/.test(norm(a.title)) && /preparar|desacelerar/.test(t))) {
    const scope = scopeOf(t, today);
    if (times.length) { ops.push({ type: 'setBed', at: times[times.length - 1], scope }); return; }
    const d = dur?.minutes ?? 30;
    if (/\bmais cedo\b/.test(t)) { ops.push({ type: 'shiftSleep', bedDelta: -d, scope }); return; }
    if (/\bmais tarde\b/.test(t)) { ops.push({ type: 'shiftSleep', bedDelta: d, scope }); return; }
  }

  // TRABALHO: "vou começar a trabalhar às 8h", "trabalho das 8 às 17h"
  if (/\b(trabalh|expediente|servico|emprego|estagio)/.test(t) && times.length && !negative) {
    const scope = scopeOf(t, today);
    const start = times[0];
    const end = times[1] && times[1] > start ? times[1] : start + (dur?.minutes ?? 9 * 60);
    workOps(state, start, end, scope, ops);
    return;
  }

  // JUNTAR: "almoço junto com o trabalho", "podcast durante o cardio das 17h às 17h20"
  const joinRe = /\b(junto com|junto ao|junto do|junto da|durante|dentro d[oa]|ao mesmo tempo que|no meio d[oa])\b/;
  const jm = joinRe.exec(t);
  if (jm) {
    const child = findActivities(t.slice(0, jm.index), state)[0];
    const parent = findActivities(t.slice(jm.index + jm[0].length), state)[0];
    if (child && parent && child.id !== parent.id) {
      const at = times[0] ?? (parent.anchor.type === 'time' ? parent.anchor.at : 12 * 60);
      const duration = times[1] !== undefined ? spanMinutes(times[0], times[1]) : dur?.minutes ?? child.duration;
      ops.push({ type: 'join', id: child.id, parentId: parent.id, at, duration: Math.max(5, duration) });
      return;
    }
    if (child && /\b(separar|separado|horario proprio)\b/.test(t)) { ops.push({ type: 'unjoin', id: child.id }); return; }
  }
  if (/\b(separar|separa|horario proprio)\b/.test(t) && acts.length) { for (const a of acts) if (a.join) ops.push({ type: 'unjoin', id: a.id }); if (acts.some((a) => a.join)) return; }

  // PULAR / NÃO FAZER
  if (negative && acts.length) {
    const scope = scopeOf(t, today, true);
    const date = scope.kind === 'date' ? scope.date : today;
    for (const a of acts) ops.push({ type: 'skip', id: a.id, date });
    return;
  }

  // REMOVER
  if (/\b(remover|remove|excluir|exclui|tirar|tira|apagar|apaga|deletar)\b/.test(t) && acts.length) {
    if (/\b(hoje|amanha)\b/.test(t)) { const sc = scopeOf(t, today, true); for (const a of acts) ops.push({ type: 'skip', id: a.id, date: sc.kind === 'date' ? sc.date : today }); }
    else for (const a of acts) ops.push({ type: 'remove', id: a.id });
    return;
  }

  // PAUSAR / RETOMAR
  if (/\b(pausar|pausa|suspender|parar de fazer)\b/.test(t) && acts.length) { for (const a of acts) ops.push({ type: 'pause', id: a.id, paused: true }); return; }
  if (/\b(retomar|reativar|despausar|voltar a fazer|voltar com)\b/.test(t) && acts.length) {
    for (const a of acts) {
      if (a.paused) ops.push({ type: 'pause', id: a.id, paused: false });
      else ops.push({ type: 'unskip', id: a.id, date: today });
    }
    return;
  }
  if (/\b(vou conseguir|consigo sim|vai dar)\b/.test(t) && acts.length && !times.length) { for (const a of acts) ops.push({ type: 'unskip', id: a.id, date: today }); return; }

  // MAIS TEMPO / ADICIONAR
  const addVerb = /\b(adicionar|adiciona|acrescentar|acrescenta|incluir|inclui|colocar|coloca|botar|bota|criar|cria|preciso de|quero|mais|novo|nova|agendar|marcar|tenho)\b/;
  if (addVerb.test(t) && (dur || times.length)) {
    const scope = scopeOf(t, today);
    const existing = acts[0];
    if (existing && dur && /\b(mais|adicionar|adiciona|acrescentar|acrescenta|extra)\b/.test(t) && !times.length) {
      ops.push({ type: 'duration', id: existing.id, minutes: existing.duration + dur.minutes, scope });
      return;
    }
    if (existing && times.length) {
      ops.push({ type: 'move', id: existing.id, at: times[0], scope });
      if (dur) ops.push({ type: 'duration', id: existing.id, minutes: dur.minutes, scope });
      return;
    }
    const title = guessTitle(t, addVerb);
    if (title) {
      const cat = CAT_GUESS.find(([re]) => re.test(t))?.[1] ?? 'life';
      const at = times[0];
      const activity: Activity = {
        id: uid(), title, categoryId: cat, description: `Criado pelo pedido: "${t}"`, duration: dur?.minutes ?? 30,
        anchor: at !== undefined ? { type: 'time', at } : { type: 'time', at: 15 * 60 }, fixed: at !== undefined,
        priority: 2, days: scope.kind === 'always' && scope.dayType === 'weekend' ? [0, 6] : [0, 1, 2, 3, 4, 5, 6],
        paused: false, notify: true, kind: 'normal',
      };
      ops.push({ type: 'add', activity, scope: scope.kind === 'date' ? scope : { kind: 'always', dayType: 'both' } });
      return;
    }
  }

  // MUDAR HORÁRIO de uma atividade: "academia às 18h", "hoje só vou conseguir ir à academia às 18h"
  if (acts.length && times.length) {
    const scope = scopeOf(t, today);
    ops.push({ type: 'move', id: acts[0].id, at: times[0], scope });
    if (dur) ops.push({ type: 'duration', id: acts[0].id, minutes: dur.minutes, scope });
    return;
  }

  // DURAÇÃO: "estudos por 2 horas", "academia vai durar 1h30", "menos 15 min de leitura"
  if (acts.length && dur) {
    const scope = scopeOf(t, today);
    const a = acts[0];
    const minutes = /\bmenos\b/.test(t) ? Math.max(5, a.duration - dur.minutes) : /\bmais\b/.test(t) ? a.duration + dur.minutes : dur.minutes;
    ops.push({ type: 'duration', id: a.id, minutes, scope });
  }
}

function wakeOf(state: State, scope: Scope): number {
  if (scope.kind === 'date') return state.overrides[scope.date]?.wake ?? (isWeekend(scope.date) ? state.sleep.weekend.wake : state.sleep.weekday.wake);
  return scope.dayType === 'weekend' ? state.sleep.weekend.wake : state.sleep.weekday.wake;
}

/** Trabalho vira um bloco fixo; o almoço fica JUNTO com ele no horário de almoço do trabalho. */
function workOps(state: State, start: number, end: number, scope: Scope, ops: Op[]) {
  const lunch = state.activities.find((a) => /almoco/.test(norm(a.title)));
  const days = scope.kind === 'always' && scope.dayType === 'weekend' ? [0, 6] : [1, 2, 3, 4, 5];
  for (const a of state.activities.filter((x) => /^trabalho/.test(norm(x.title)))) {
    ops.push(scope.kind === 'always' ? { type: 'remove', id: a.id } : { type: 'skip', id: a.id, date: scope.date });
  }
  const work: Activity = {
    id: uid(), title: 'Trabalho', categoryId: 'work', description: 'Horário de trabalho. O almoço do trabalho acontece dentro dele; o resto se reorganiza em volta.', duration: spanMinutes(start, end) || 9 * 60,
    anchor: { type: 'time', at: start }, fixed: true, priority: 1, days: scope.kind === 'date' ? [0, 1, 2, 3, 4, 5, 6] : days, paused: false, notify: true, kind: 'normal',
  };
  ops.push({ type: 'add', activity: work, scope: scope.kind === 'date' ? scope : { kind: 'always', dayType: 'both' } });
  const wl = state.profile.workLunch;
  if (lunch && scope.kind === 'always' && wl.at >= start && wl.at + wl.duration <= start + work.duration) {
    ops.push({ type: 'join', id: lunch.id, parentId: work.id, at: wl.at, duration: wl.duration });
  }
}
