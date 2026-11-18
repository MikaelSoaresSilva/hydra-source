// Lembretes semanais (sábado e domingo). Usam o plugin oficial de notificações locais do Capacitor:
// o Android dispara o alarme mesmo com o app fechado e o plugin reagenda tudo após reiniciar o aparelho.
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { isNative } from './store';
import type { Slot } from './state';

export const CHANNEL_ID = 'estudos';
const OUR_IDS = (n: number) => n >= 1000 && n < 2000;
export const TEST_ID = 1999;

export interface NotifStatus { native: boolean; permission: string; exact: string; pending: { id: number; title: string; schedule?: unknown }[] }

/** Monta as notificações (função pura, testada em tests/). */
export function buildNotifications(slots: Slot[], enabled: boolean): LocalNotificationSchema[] {
  if (!enabled) return [];
  return slots.filter((s) => s.enabled).map((s) => ({
    id: s.id,
    title: s.id % 2 === 1 ? '📚 Hora de estudar!' : '💪 Continue firme!',
    body: s.body,
    channelId: CHANNEL_ID,
    smallIcon: 'ic_stat_icon',
    iconColor: '#22c55e',
    schedule: { on: { weekday: s.weekday, hour: s.hour, minute: s.minute }, allowWhileIdle: true },
    extra: { route: '#/hoje' },
  }));
}

export async function ensureChannel() {
  if (!isNative()) return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID, name: 'Lembretes de estudo', description: 'Avisos de sábado e domingo para começar e continuar os estudos',
    importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#22c55e',
  });
}

export async function requestPermission(): Promise<string> {
  if (!isNative()) {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  }
  let p = await LocalNotifications.checkPermissions();
  if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await LocalNotifications.requestPermissions();
  return p.display;
}

/** Cancela os lembretes antigos e agenda os atuais (sem duplicar: IDs fixos). */
export async function syncReminders(slots: Slot[], enabled: boolean): Promise<{ ok: boolean; scheduled: number; message: string }> {
  if (!isNative()) return { ok: false, scheduled: 0, message: 'No navegador os lembretes não ficam agendados com o app fechado. Instale o APK no Android.' };
  try {
    await ensureChannel();
    const pend = await LocalNotifications.getPending();
    const toCancel = pend.notifications.filter((n) => OUR_IDS(n.id) && n.id !== TEST_ID).map((n) => ({ id: n.id }));
    if (toCancel.length) await LocalNotifications.cancel({ notifications: toCancel });
    const list = buildNotifications(slots, enabled);
    if (!list.length) return { ok: true, scheduled: 0, message: 'Lembretes desativados.' };
    const perm = await requestPermission();
    if (perm !== 'granted') return { ok: false, scheduled: 0, message: 'Permissão de notificações negada. Ative em Configurações do Android → Apps → Formação Dev → Notificações.' };
    await LocalNotifications.schedule({ notifications: list });
    return { ok: true, scheduled: list.length, message: list.length + ' lembretes semanais agendados.' };
  } catch (e: any) {
    return { ok: false, scheduled: 0, message: 'Erro ao agendar: ' + (e?.message ?? e) };
  }
}

export async function testNotification(): Promise<string> {
  if (!isNative()) {
    const p = await requestPermission();
    if (p === 'granted') { new Notification('📚 Teste de lembrete', { body: 'Assim chegará o aviso de sábado e domingo.' }); return 'Notificação de teste exibida.'; }
    return 'O navegador não permitiu notificações.';
  }
  await ensureChannel();
  const perm = await requestPermission();
  if (perm !== 'granted') return 'Permissão negada. Ative as notificações do app nas configurações do Android.';
  await LocalNotifications.schedule({ notifications: [{ id: TEST_ID, title: '📚 Teste de lembrete', body: 'Funcionou! Assim chegarão os avisos de sábado e domingo.', channelId: CHANNEL_ID, smallIcon: 'ic_stat_icon', iconColor: '#22c55e', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
  return 'Teste agendado: a notificação deve aparecer em 5 segundos (pode fechar o app para testar).';
}

export async function getStatus(): Promise<NotifStatus> {
  if (!isNative()) return { native: false, permission: 'Notification' in window ? Notification.permission : 'unsupported', exact: 'n/a', pending: [] };
  const [perm, pend] = await Promise.all([LocalNotifications.checkPermissions(), LocalNotifications.getPending()]);
  let exact = 'desconhecido';
  try { exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm; } catch { /* Android < 12 */ exact = 'granted'; }
  return { native: true, permission: perm.display, exact, pending: pend.notifications.map((n) => ({ id: n.id, title: n.title, schedule: n.schedule })) };
}

export async function openExactAlarmSettings() {
  if (isNative()) await LocalNotifications.changeExactNotificationSetting();
}

export function onNotificationTap(cb: (route: string) => void) {
  if (!isNative()) return;
  LocalNotifications.addListener('localNotificationActionPerformed', (a) => cb((a.notification.extra?.route as string) ?? '#/hoje'));
}
