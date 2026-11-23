// Lembretes do Titan (APK): notificações locais semanais para manter os registros que calibram o
// "Meu Código" — check-in e peso de manhã, treino, e o dia de medir a cada 4 semanas.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { addDays } from '../domain/dates';

export const REMINDER_CHANNEL = 'titan_lembretes_v1';
export const REMINDER_ID_BASE = 5000; // 5000–5099 reservados
export const MEASURE_EVERY_DAYS = 28;
export const WEIGH_DAYS = [1, 3, 5]; // seg, qua, sex

export interface ReminderInput {
  enabled: boolean;
  /** Horário da manhã "HH:MM" (check-in e peso). */
  morning: string;
  /** Dias de treino (0 = dom … 6 = sáb) e horário "HH:MM". */
  trainingDays: number[];
  trainingTime?: string | null;
  /** Data (AAAA-MM-DD) da última medição com fita; null = nunca mediu. */
  lastMeasure: string | null;
  today: string;
}

export interface Reminder {
  id: number;
  title: string;
  body: string;
  /** Semanal: dia da semana (0 = dom … 6 = sáb). */
  weekday?: number;
  /** Uma vez: data AAAA-MM-DD. */
  date?: string;
  hour: number;
  minute: number;
}

const hm = (s: string | null | undefined, fallback: [number, number]): [number, number] => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? '');
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? [Number(m[1]), Number(m[2])] : fallback;
};

/** Lista os lembretes (função pura, testada sem celular). */
export function plannedReminders(i: ReminderInput): Reminder[] {
  if (!i.enabled) return [];
  const out: Reminder[] = [];
  const [mh, mm] = hm(i.morning, [7, 0]);
  for (let wd = 0; wd < 7; wd++) {
    const weigh = WEIGH_DAYS.includes(wd);
    out.push({ id: REMINDER_ID_BASE + wd, weekday: wd, hour: mh, minute: mm,
      title: weigh ? 'Pesar em jejum + check-in' : 'Check-in de sono',
      body: weigh ? 'Peso depois do banheiro, antes de comer. Depois registre como dormiu.' : 'Como você dormiu? 10 segundos e o Meu Código fica mais preciso.' });
  }
  if (i.trainingTime) {
    const [th, tm] = hm(i.trainingTime, [16, 0]);
    const total = ((th * 60 + tm - 30) % 1440 + 1440) % 1440;
    for (const wd of i.trainingDays) {
      out.push({ id: REMINDER_ID_BASE + 10 + wd, weekday: wd, hour: Math.floor(total / 60), minute: total % 60, title: 'Treino em 30 minutos', body: 'Separe a água e abra o Titan para ver a sessão de hoje.' });
    }
  }
  const due = i.lastMeasure ? addDays(i.lastMeasure, MEASURE_EVERY_DAYS) : i.today;
  const date = due <= i.today ? addDays(i.today, 1) : due;
  out.push({ id: REMINDER_ID_BASE + 30, date, hour: mh, minute: mm, title: 'Dia de medir', body: i.lastMeasure ? 'Faz 4 semanas da última medição: fita em braço, peito, cintura, coxa, panturrilha e ombros, em jejum.' : 'Registre suas primeiras medidas com fita para o Meu Código começar a calibrar.' });
  return out;
}

const native = () => Capacitor.isNativePlatform();

export async function remindersPermission(request = false): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!native()) return 'unsupported';
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted' && request) p = await LocalNotifications.requestPermissions();
    return p.display === 'granted' ? 'granted' : 'denied';
  } catch { return 'unsupported'; }
}

/** Reagenda os lembretes no Android. Retorna quantos ficaram programados (0 fora do APK). */
export async function syncReminders(i: ReminderInput): Promise<number> {
  if (!native()) return 0;
  try {
    const pending = await LocalNotifications.getPending();
    const mine = pending.notifications.filter((n) => n.id >= REMINDER_ID_BASE && n.id < REMINDER_ID_BASE + 100);
    if (mine.length) await LocalNotifications.cancel({ notifications: mine.map((n) => ({ id: n.id })) });
    const list = plannedReminders(i);
    if (!list.length || (await remindersPermission()) !== 'granted') return 0;
    await LocalNotifications.createChannel({ id: REMINDER_CHANNEL, name: 'Lembretes', description: 'Check-in, peso, treino e medidas', importance: 4, visibility: 1, vibration: true });
    const notifications: LocalNotificationSchema[] = list.map((r) => ({
      id: r.id, title: r.title, body: r.body, channelId: REMINDER_CHANNEL, autoCancel: true,
      schedule: r.date
        ? { at: new Date(Number(r.date.slice(0, 4)), Number(r.date.slice(5, 7)) - 1, Number(r.date.slice(8, 10)), r.hour, r.minute), allowWhileIdle: true }
        : { on: { weekday: r.weekday! + 1, hour: r.hour, minute: r.minute }, allowWhileIdle: true }, // plugin: 1 = domingo
    }));
    await LocalNotifications.schedule({ notifications });
    return notifications.length;
  } catch { return 0; }
}
