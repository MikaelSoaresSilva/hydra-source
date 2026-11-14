import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeParam { setValueAtTime() { return this; } exponentialRampToValueAtTime() { return this; } value = 0 }
const created: { freq: number; type: string; start: number; stop: number }[] = [];
class FakeCtx {
  state = 'suspended';
  currentTime = 10;
  destination = {};
  resume = vi.fn(async () => { this.state = 'running'; });
  createOscillator() {
    const o = { type: '', frequency: new FakeParam(), start: (t: number) => { rec.start = t; }, stop: (t: number) => { rec.stop = t; }, connect: (g: unknown) => g };
    const rec = { freq: 0, type: '', start: 0, stop: 0 };
    created.push(rec);
    return new Proxy(o, { set(t, k, v) { (t as Record<string, unknown>)[k as string] = v; if (k === 'type') rec.type = v; return true; }, get(t, k) { if (k === 'frequency') return { set value(v: number) { rec.freq = v; } }; return (t as Record<string, unknown>)[k as string]; } });
  }
  createGain() { return { gain: new FakeParam(), connect: (d: unknown) => d }; }
  createDynamicsCompressor() { return { threshold: { value: 0 }, ratio: { value: 0 }, connect: (d: unknown) => d }; }
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); created.length = 0; });

describe('bipe de fim de descanso', () => {
  it('sem o arquivo carregado, sintetiza três bipes curtos e agudos (2400 Hz)', async () => {
    vi.stubGlobal('AudioContext', FakeCtx);
    const { playRestBeep, REST_BEEP } = await import('./sound');
    expect(playRestBeep()).toBe(true);
    expect(created.map((c) => c.freq)).toEqual([2400, 2400, 2400]);
    expect(created.every((c) => c.type === 'square')).toBe(true);
    created.forEach((c, i) => {
      expect(c.stop - c.start).toBeLessThan(0.25); // som curto
      expect(c.start).toBeCloseTo(10.02 + REST_BEEP[i].at, 5);
    });
  });
  it('sem suporte a áudio não quebra o app', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { playRestBeep, unlockAudio } = await import('./sound');
    expect(() => unlockAudio()).not.toThrow();
    expect(playRestBeep()).toBe(false);
  });
});

describe('aviso em segundo plano', () => {
  it('fora do APK (navegador) não agenda nada e não quebra', async () => {
    const { ensureRestAlerts, scheduleRestAlert, cancelRestAlert } = await import('./sound');
    await expect(ensureRestAlerts()).resolves.toBe(false);
    await expect(scheduleRestAlert(Date.now() + 5000)).resolves.toBeUndefined();
    await expect(cancelRestAlert()).resolves.toBeUndefined();
  });
  it('no APK cria o canal com o bipe e agenda no horário exato do fim do descanso', async () => {
    const calls: Record<string, unknown[]> = { createChannel: [], schedule: [], cancel: [] };
    vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
    vi.doMock('@capacitor/local-notifications', () => ({
      LocalNotifications: {
        createChannel: async (c: unknown) => { calls.createChannel.push(c); },
        checkPermissions: async () => ({ display: 'granted' }),
        requestPermissions: async () => ({ display: 'granted' }),
        schedule: async (o: unknown) => { calls.schedule.push(o); },
        cancel: async (o: unknown) => { calls.cancel.push(o); },
        removeDeliveredNotifications: async () => {},
      },
    }));
    const { scheduleRestAlert, REST_CHANNEL } = await import('./sound');
    const endsAt = Date.now() + 90_000;
    await scheduleRestAlert(endsAt);
    expect(calls.createChannel[0]).toMatchObject({ id: REST_CHANNEL, importance: 5, sound: 'rest_beep.wav' });
    const n = (calls.schedule[0] as { notifications: { schedule: { at: Date; allowWhileIdle: boolean }; channelId: string }[] }).notifications[0];
    expect(n.schedule.at.getTime()).toBe(endsAt);
    expect(n.schedule.allowWhileIdle).toBe(true);
    expect(n.channelId).toBe(REST_CHANNEL);
    vi.doUnmock('@capacitor/core'); vi.doUnmock('@capacitor/local-notifications');
  });
});
