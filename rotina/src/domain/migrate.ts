// Atualizações dos dados salvos entre versões do app.
import { DEFAULT_PROFILE, STATE_VERSION, WEEKDAY_STUDY_DESC, WEEKEND_STUDY_DESC, uid } from './defaults';
import { norm } from './interpreter';
import type { Activity, State } from './types';

/**
 * v2: almoço junto com o trabalho.
 * - "Trabalho (manhã)" + "Trabalho (tarde)" (criados pela v1 em volta do almoço) viram um bloco "Trabalho" só;
 * - o almoço passa a acontecer dentro do Trabalho, das 11:30 às 12:50, nos dias de trabalho.
 */
export function migrateToV2(s: State): State {
  if ((s.version ?? 1) >= 2) return s;
  const out: State = structuredClone(s);
  out.profile.workLunch ??= { ...DEFAULT_PROFILE.workLunch };
  const isWork = (a: Activity) => /^trabalho/.test(norm(a.title)) && a.anchor.type === 'time';
  const works = out.activities.filter(isWork);
  const morning = works.find((a) => /manha/.test(norm(a.title)));
  const afternoon = works.find((a) => /tarde/.test(norm(a.title)));
  let work: Activity | undefined;
  if (morning && afternoon && morning.anchor.type === 'time' && afternoon.anchor.type === 'time') {
    const start = morning.anchor.at;
    const end = afternoon.anchor.at + afternoon.duration;
    work = { ...morning, id: uid(), title: 'Trabalho', duration: end - start, days: [...new Set([...morning.days, ...afternoon.days])].sort(), description: 'Horário de trabalho. O almoço do trabalho acontece dentro dele; o resto se reorganiza em volta.' };
    out.activities = [...out.activities.filter((a) => a.id !== morning.id && a.id !== afternoon.id), work];
  } else work = works.find((a) => !/manha|tarde/.test(norm(a.title)));
  const lunch = out.activities.find((a) => /almoco/.test(norm(a.title)));
  if (work && lunch && !lunch.join && work.anchor.type === 'time') {
    const wl = out.profile.workLunch;
    if (wl.at >= work.anchor.at && wl.at + wl.duration <= work.anchor.at + work.duration) lunch.join = { parentId: work.id, at: wl.at, duration: wl.duration };
  }
  out.version = 2;
  return out;
}

/**
 * v3: estudos.
 * - dias de semana: opcional (encaixa se der, encurta até 30 min, sem aviso se não couber);
 * - fim de semana: bloco obrigatório de estudos (1 h 30, encurta até 45 min).
 */
export function migrateToV3(s: State): State {
  if ((s.version ?? 1) >= 3) return s;
  const out: State = structuredClone(s);
  const studies = out.activities.filter((a) => /^estud/.test(norm(a.title)));
  for (const a of studies) {
    const weekdaysOnly = a.days.every((d) => d >= 1 && d <= 5);
    if (weekdaysOnly) { a.optional = true; a.minDuration ??= 30; if (a.description === '' || /Bloco de foco profundo/.test(a.description)) a.description = WEEKDAY_STUDY_DESC; }
  }
  const weekendCovered = studies.some((a) => !a.paused && a.days.includes(0) && a.days.includes(6) && !a.optional);
  if (!weekendCovered) {
    out.activities.push({
      id: uid(), title: 'Estudos (fim de semana)', categoryId: out.categories.some((c) => c.id === 'mind') ? 'mind' : out.categories[0].id,
      description: WEEKEND_STUDY_DESC, duration: 90, anchor: { type: 'time', at: 14 * 60 }, fixed: false, priority: 1, days: [0, 6],
      paused: false, notify: true, kind: 'normal', minDuration: 45,
    });
  }
  out.version = STATE_VERSION;
  return out;
}

export const migrateAll = (s: State) => migrateToV3(migrateToV2(s));

export const isWorkActivity = (a: Activity) => /^trabalho/.test(norm(a.title)) && a.anchor.type === 'time' && !a.paused;
export const isLunchActivity = (a: Activity) => /almoco/.test(norm(a.title));

/**
 * Coloca o almoço junto com o Trabalho no horário de almoço do trabalho (perfil.workLunch).
 * Retorna o estado novo e se ligou; não liga se o horário do almoço cair fora do expediente.
 */
export function linkWorkLunch(s: State): { state: State; linked: boolean; reason?: string } {
  const work = s.activities.find(isWorkActivity);
  const lunch = s.activities.find(isLunchActivity);
  if (!work) return { state: s, linked: false, reason: 'Crie uma atividade "Trabalho" com início e término (ex.: 08:00–17:00).' };
  if (!lunch) return { state: s, linked: false, reason: 'Não há atividade de almoço na rotina.' };
  if (work.anchor.type !== 'time') return { state: s, linked: false };
  const wl = s.profile.workLunch;
  if (wl.at < work.anchor.at || wl.at + wl.duration > work.anchor.at + work.duration) return { state: s, linked: false, reason: 'O horário de almoço fica fora do horário do Trabalho.' };
  return { state: { ...s, activities: s.activities.map((a) => (a.id === lunch.id ? { ...a, join: { parentId: work.id, at: wl.at, duration: wl.duration } } : a)) }, linked: true };
}
