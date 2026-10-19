// Notificações locais (Android via Capacitor). Agendadas no próprio aparelho: funcionam offline.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { GameState } from '../core/types';
import { priorityMission } from '../core/gm';

const IDS = { digest: 1001, study: 1002, campaign: 1003 };

function hm(s: string) { const [h, m] = s.split(':').map(Number); return { hour: h || 0, minute: m || 0 }; }

function inQuiet(h: number, m: number, s: GameState) {
  const n = h * 60 + m;
  const a = hm(s.settings.notifications.quietStart); const b = hm(s.settings.notifications.quietEnd);
  const A = a.hour * 60 + a.minute; const B = b.hour * 60 + b.minute;
  return A < B ? n >= A && n < B : n >= A || n < B;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    if (!('Notification' in window)) return false;
    return (await Notification.requestPermission()) === 'granted';
  }
  const r = await LocalNotifications.requestPermissions();
  return r.display === 'granted';
}

/** Reagenda tudo (idempotente). No máximo 3 lembretes por dia, nunca no horário de silêncio. */
export async function scheduleNotifications(s: GameState): Promise<string> {
  if (!Capacitor.isNativePlatform()) return 'No navegador, lembretes agendados não são suportados. No APK Android eles funcionam.';
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    const n = s.settings.notifications;
    if (!n.enabled) return 'Notificações desativadas.';
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return 'Permissão de notificação não concedida. Ative nas configurações do Android.';
    const list: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];
    const pm = priorityMission(s);
    const d = hm(n.digestTime);
    if (n.categories.missoes && !inQuiet(d.hour, d.minute, s)) {
      list.push({ id: IDS.digest, title: '[ SISTEMA ]', body: pm ? `Uma nova missão está disponível: ${pm.title}` : 'O Sistema aguarda seus próximos objetivos.', schedule: { on: d, allowWhileIdle: true }, channelId: 'sistema' });
    }
    const st = hm(n.studyTime);
    if (n.categories.estudo && !inQuiet(st.hour, st.minute, s)) {
      list.push({ id: IDS.study, title: '[ SISTEMA ]', body: 'Está na hora da sessão de estudo que você programou.', schedule: { on: st, allowWhileIdle: true }, channelId: 'sistema' });
    }
    const activeBoss = s.bosses.find((b) => !b.defeatedAt);
    if (n.categories.campanhas && activeBoss) {
      list.push({ id: IDS.campaign, title: '[ SISTEMA ]', body: `${activeBoss.name} aguarda sua próxima jogada.`, schedule: { on: { weekday: 7, hour: 10, minute: 0 }, allowWhileIdle: true }, channelId: 'sistema' });
    }
    await LocalNotifications.createChannel({ id: 'sistema', name: 'Mensagens do Sistema', description: 'Lembretes de missões e estudos', importance: 3, vibration: true });
    if (list.length) await LocalNotifications.schedule({ notifications: list });
    return `${list.length} lembrete(s) agendado(s).`;
  } catch (e) {
    return `Não foi possível agendar: ${(e as Error).message}`;
  }
}

export async function notifyNow(title: string, body: string) {
  if (Capacitor.isNativePlatform()) {
    try { await LocalNotifications.schedule({ notifications: [{ id: Math.floor(Math.random() * 100000) + 2000, title, body, channelId: 'sistema' }] }); } catch { /* */ }
  }
}
