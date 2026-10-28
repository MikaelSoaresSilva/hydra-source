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
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); created.length = 0; });

describe('bipe de fim de descanso', () => {
  it('toca dois bipes curtos e agudos (880 Hz e 1320 Hz) e destrava o áudio', async () => {
    vi.stubGlobal('AudioContext', FakeCtx);
    const { playRestBeep, REST_BEEP } = await import('./sound');
    expect(playRestBeep()).toBe(true);
    expect(created.map((c) => c.freq)).toEqual([880, 1320]);
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
