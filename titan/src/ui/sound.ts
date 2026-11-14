// Bipe de fim de descanso.
// - Com o app aberto: toca o arquivo `sounds/rest_beep.wav` (bip-bip-bip agudo, volume máximo)
//   pelo Web Audio; se o arquivo não carregar, gera o mesmo bipe por síntese.
// - Em segundo plano / tela bloqueada (APK): uma notificação local agendada para o fim exato do
//   descanso toca o mesmo som pelo canal "Fim do descanso" (prioridade máxima).
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;

function audioCtx(): Ctx | null {
  if (typeof window === 'undefined') return null;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  if (!ctx) {
    try { ctx = new C(); } catch { return null; }
  }
  return ctx;
}

function loadBeep(c: Ctx) {
  if (buffer || loading || typeof fetch === 'undefined') return;
  loading = fetch('sounds/rest_beep.wav')
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('sem arquivo'))))
    .then((data) => c.decodeAudioData(data))
    .then((b) => { buffer = b; })
    .catch(() => { loading = null; });
}

/** Desbloqueia o áudio dentro de um gesto do usuário (toque/clique) e pré-carrega o bipe. */
export function unlockAudio(): void {
  const c = audioCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  loadBeep(c);
}

/** Bipe sintetizado (reserva): três toques curtos a 2400 Hz, onda quadrada, volume máximo. */
export const REST_BEEP = [
  { at: 0, freq: 2400, dur: 0.12 },
  { at: 0.18, freq: 2400, dur: 0.12 },
  { at: 0.36, freq: 2400, dur: 0.2 },
] as const;

/** Toca o bipe de fim de descanso. Retorna false se o aparelho não suportar áudio. */
export function playRestBeep(): boolean {
  const c = audioCtx();
  if (!c) return false;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  // Compressor + ganho alto = o bipe mais alto possível sem distorcer (o teto é o volume de mídia do celular).
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.ratio.value = 12;
  comp.connect(c.destination);
  if (buffer) {
    const src = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.value = 1;
    src.buffer = buffer;
    src.connect(gain).connect(comp);
    src.start();
    return true;
  }
  const t0 = c.currentTime + 0.02;
  for (const n of REST_BEEP) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = n.freq;
    gain.gain.setValueAtTime(0.0001, t0 + n.at);
    gain.gain.exponentialRampToValueAtTime(1, t0 + n.at + 0.005);
    gain.gain.setValueAtTime(1, t0 + n.at + n.dur - 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(gain).connect(comp);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.02);
  }
  return true;
}

/** Sinal do treino de reflexo: N bipes curtos e graves (diferentes do bipe de fim de round). */
export function playCue(n: number): boolean {
  const c = audioCtx();
  if (!c) return false;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  const t0 = c.currentTime + 0.02;
  for (let i = 0; i < n; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = 1200;
    const at = t0 + i * 0.22;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.9, at + 0.005);
    gain.gain.setValueAtTime(0.9, at + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + 0.14);
  }
  return true;
}

type WakeLockSentinelLike = { release(): Promise<void> };
/** Mantém a tela acesa enquanto o descanso corre. */
export async function keepScreenOn(): Promise<WakeLockSentinelLike | null> {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
    return wl ? await wl.request('screen') : null;
  } catch { return null; }
}

// ------------------------------------------------------------------ segundo plano (APK)

/** Canal com o som do bipe. O som de um canal não muda depois de criado: nova versão = novo id. */
export const REST_CHANNEL = 'rest_end_v1';
export const REST_NOTIFICATION_ID = 4242;
const native = () => Capacitor.isNativePlatform();
let ready: Promise<boolean> | null = null;

/** Cria o canal e pede permissão de notificação (Android 13+ mostra o pedido uma vez). */
export function ensureRestAlerts(): Promise<boolean> {
  if (!native()) return Promise.resolve(false);
  ready ??= (async () => {
    try {
      await LocalNotifications.createChannel({
        id: REST_CHANNEL, name: 'Fim do descanso', description: 'Bipe quando o tempo de descanso termina',
        importance: 5, visibility: 1, sound: 'rest_beep.wav', vibration: true,
      });
      const p = await LocalNotifications.checkPermissions();
      const granted = p.display === 'granted' || (await LocalNotifications.requestPermissions()).display === 'granted';
      return granted;
    } catch { return false; }
  })();
  return ready;
}

/** Agenda o bipe do fim do descanso no sistema (toca mesmo com a tela bloqueada ou em outro app). */
export async function scheduleRestAlert(endsAt: number): Promise<void> {
  if (!native() || endsAt <= Date.now()) return;
  if (!(await ensureRestAlerts())) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [{
        id: REST_NOTIFICATION_ID, title: 'Descanso concluído', body: 'Hora da próxima série.',
        channelId: REST_CHANNEL, sound: 'rest_beep.wav', autoCancel: true,
        schedule: { at: new Date(endsAt), allowWhileIdle: true },
      }],
    });
  } catch { /* sem permissão: fica só o bipe com o app aberto */ }
}

/** Cancela o bipe agendado (pulou o descanso, ou o app está aberto e vai tocar ele mesmo). */
export async function cancelRestAlert(): Promise<void> {
  if (!native()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    await LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: REST_NOTIFICATION_ID, title: '', body: '' }] });
  } catch { /* nada agendado */ }
}
