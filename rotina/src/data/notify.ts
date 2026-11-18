// Lembretes reais. No APK: notificações locais do Android agendadas para os próximos 3 dias
// (tocam com o app fechado e a tela bloqueada), com botões "Concluir" e "Adiar".
// No navegador: avisos enquanto a página está aberta (Notification API), se você permitir.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ActionPerformed, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { buildDay, type PlanItem } from '../domain/scheduler';
import { addDays, dateAt, hm, todayISO } from '../domain/time';
import type { State } from '../domain/types';

export const CH_ROUTINE = 'rotina_v1';
export const CH_ALARM = 'alarme_v1';
export const ACTION_TYPE = 'ROTINA';
export const DAYS_AHEAD = 3;

export const native = () => Capacitor.isNativePlatform();

export interface Planned { id: number; at: Date; title: string; body: string; channel: string; extra: { date: string; activityId: string; kind: 'start' | 'late' | 'snooze' } }

export function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) % 2_000_000_000 + 1;
}

/** Lista o que deve ser avisado (função pura: testada sem celular). */
export function plannedNotifications(state: State, now: Date, days = DAYS_AHEAD): Planned[] {
  if (!state.settings.notifications) return [];
  const out: Planned[] = [];
  const today = todayISO(now);
  for (let k = 0; k < days; k++) {
    const date = addDays(today, k);
    const plan = buildDay(state, date);
    const done = state.completions[date] ?? {};
    const items = plan.items.filter((i) => i.activity.notify);
    items.forEach((it: PlanItem, idx) => {
      if (done[it.activity.id]) return;
      const next = items.slice(idx + 1).find((x) => x.start > it.start);
      const nextText = next ? ` Próxima: ${next.activity.title} às ${hm(next.start)}.` : '';
      const at = dateAt(date, it.start);
      const isWake = it.activity.kind === 'wake';
      const isBed = it.activity.kind === 'bed';
      if (at > now) {
        out.push({
          id: hashId(`${date}|${it.activity.id}|start`), at, channel: isWake ? CH_ALARM : CH_ROUTINE,
          title: isWake ? `⏰ ${hm(it.start)} · Hora de acordar` : `${hm(it.start)} · ${it.activity.title}`,
          body: isBed ? 'Luz apagada, celular longe. Boa noite!' : `${it.end > it.start ? `Até ${hm(it.end)}. ` : ''}${it.activity.description.slice(0, 90)}${nextText}`,
          extra: { date, activityId: it.activity.id, kind: 'start' },
        });
      }
      const lateAt = dateAt(date, it.start + state.settings.lateAfterMin);
      if (state.settings.lateAlerts && !isBed && it.end - it.start >= 5 && lateAt > now) {
        out.push({
          id: hashId(`${date}|${it.activity.id}|late`), at: lateAt, channel: CH_ROUTINE,
          title: `⚠️ Atrasada: ${it.activity.title}`, body: `Era para começar às ${hm(it.start)}. Conclua ou adie.${nextText}`,
          extra: { date, activityId: it.activity.id, kind: 'late' },
        });
      }
    });
  }
  for (const [key, ms] of Object.entries(state.snoozes)) {
    const [date, activityId] = key.split('|');
    if (ms <= now.getTime() || state.completions[date]?.[activityId]) continue;
    const a = state.activities.find((x) => x.id === activityId) ?? state.overrides[date]?.add.find((x) => x.id === activityId);
    if (!a) continue;
    out.push({ id: hashId(`${key}|snooze`), at: new Date(ms), channel: CH_ROUTINE, title: `🔁 Lembrete: ${a.title}`, body: 'Você adiou esta atividade. Bora?', extra: { date, activityId, kind: 'snooze' } });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 400);
}

let setupDone: Promise<void> | null = null;

/** Canais, botões e pedido de permissão. */
export function setupNotifications(onAction: (a: { actionId: string; date: string; activityId: string }) => void): Promise<void> {
  if (!native()) return Promise.resolve();
  setupDone ??= (async () => {
    try {
      await LocalNotifications.createChannel({ id: CH_ROUTINE, name: 'Rotina', description: 'Início das atividades e atrasos', importance: 4, visibility: 1, vibration: true });
      await LocalNotifications.createChannel({ id: CH_ALARM, name: 'Despertador', description: 'Hora de acordar', importance: 5, visibility: 1, vibration: true });
      await LocalNotifications.registerActionTypes({ types: [{ id: ACTION_TYPE, actions: [{ id: 'done', title: '✅ Concluir' }, { id: 'snooze', title: '⏰ Adiar' }] }] });
      await LocalNotifications.addListener('localNotificationActionPerformed', (e: ActionPerformed) => {
        const x = e.notification.extra as { date?: string; activityId?: string } | undefined;
        if (x?.date && x.activityId) onAction({ actionId: e.actionId, date: x.date, activityId: x.activityId });
      });
    } catch { /* plugin indisponível */ }
  })();
  return setupDone;
}

export type PermissionInfo = { display: 'granted' | 'denied' | 'prompt' | 'unsupported'; exact: 'granted' | 'denied' | 'unsupported' };

export async function permissionInfo(): Promise<PermissionInfo> {
  if (!native()) {
    const p = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission === 'default' ? 'prompt' : Notification.permission;
    return { display: p as PermissionInfo['display'], exact: 'unsupported' };
  }
  try {
    const p = await LocalNotifications.checkPermissions();
    let exact: PermissionInfo['exact'] = 'unsupported';
    try { exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted' ? 'granted' : 'denied'; } catch { /* Android < 12 */ }
    return { display: p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt', exact };
  } catch { return { display: 'unsupported', exact: 'unsupported' }; }
}

export async function requestPermission(): Promise<PermissionInfo> {
  if (!native()) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
    return permissionInfo();
  }
  try { await LocalNotifications.requestPermissions(); } catch { /* sem plugin */ }
  return permissionInfo();
}

/** Abre a tela do Android para permitir "Alarmes e lembretes" (horário exato). */
export async function openExactAlarmSettings(): Promise<void> {
  if (!native()) return;
  try { await LocalNotifications.changeExactNotificationSetting(); } catch { /* Android < 12 */ }
}

let webTimers: ReturnType<typeof setTimeout>[] = [];

/** Reagenda tudo (chamado a cada mudança da rotina e ao abrir o app). */
export async function reschedule(state: State, now = new Date()): Promise<number> {
  const list = plannedNotifications(state, now);
  if (!native()) {
    webTimers.forEach(clearTimeout);
    webTimers = [];
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 0;
    for (const p of list) {
      const ms = p.at.getTime() - now.getTime();
      if (ms > 0 && ms < 24 * 3600 * 1000) webTimers.push(setTimeout(() => { try { new Notification(p.title, { body: p.body, tag: String(p.id) }); } catch { /* bloqueado */ } }, ms));
    }
    return webTimers.length;
  }
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return 0;
    const notifications: LocalNotificationSchema[] = list.map((p) => ({
      id: p.id, title: p.title, body: p.body, channelId: p.channel, actionTypeId: ACTION_TYPE, extra: p.extra, autoCancel: true,
      schedule: { at: p.at, allowWhileIdle: true },
    }));
    for (let i = 0; i < notifications.length; i += 60) await LocalNotifications.schedule({ notifications: notifications.slice(i, i + 60) });
    return notifications.length;
  } catch { return 0; }
}

/** Notificação de teste em 5 segundos. */
export async function testNotification(): Promise<boolean> {
  const at = new Date(Date.now() + 5000);
  if (!native()) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    setTimeout(() => new Notification('Titan Rotina', { body: 'Os lembretes estão funcionando ✅' }), 5000);
    return true;
  }
  try {
    await LocalNotifications.schedule({ notifications: [{ id: 99, title: 'Titan Rotina', body: 'Os lembretes estão funcionando ✅', channelId: CH_ROUTINE, actionTypeId: ACTION_TYPE, schedule: { at, allowWhileIdle: true } }] });
    return true;
  } catch { return false; }
}
