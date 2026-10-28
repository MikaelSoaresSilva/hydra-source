// Bipe de fim de descanso gerado pelo próprio app (Web Audio), sem arquivo de áudio.
// O Android só libera áudio depois de um toque do usuário: `unlockAudio` é chamado no toque
// que registra a série, e o bipe toca quando o descanso termina.

type Ctx = AudioContext;
let ctx: Ctx | null = null;

function audioCtx(): Ctx | null {
  if (typeof window === 'undefined') return null;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  if (!ctx) {
    try { ctx = new C(); } catch { return null; }
  }
  return ctx;
}

/** Desbloqueia o áudio dentro de um gesto do usuário (toque/clique). */
export function unlockAudio(): void {
  const c = audioCtx();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
}

/** Notas do bipe: dois toques curtos e agudos ("bip-bip"), como nos apps de treino. */
export const REST_BEEP = [
  { at: 0, freq: 880, dur: 0.12 },
  { at: 0.18, freq: 1320, dur: 0.16 },
] as const;

/** Toca o bipe de fim de descanso. Retorna false se o aparelho não suportar áudio. */
export function playRestBeep(volume = 0.7): boolean {
  const c = audioCtx();
  if (!c) return false;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  const t0 = c.currentTime + 0.02;
  for (const n of REST_BEEP) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = n.freq;
    // Envelope curto (ataque/queda rápidos) para não "estalar".
    gain.gain.setValueAtTime(0.0001, t0 + n.at);
    gain.gain.exponentialRampToValueAtTime(volume * 0.35, t0 + n.at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.02);
  }
  return true;
}

type WakeLockSentinelLike = { release(): Promise<void> };
/** Mantém a tela acesa enquanto o descanso corre (o Android pausa o app com a tela apagada). */
export async function keepScreenOn(): Promise<WakeLockSentinelLike | null> {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
    return wl ? await wl.request('screen') : null;
  } catch { return null; }
}
