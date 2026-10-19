// Som 100% sintetizado (Web Audio): sem arquivos de terceiros, sem direitos autorais.
type Sfx = 'click' | 'complete' | 'levelup' | 'rank' | 'item' | 'boss' | 'hit' | 'heavy' | 'dodge' | 'skill' | 'hurt' | 'error' | 'achievement' | 'open';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicNodes: AudioNode[] = [];
let musicTimer: ReturnType<typeof setInterval> | undefined;
let enabled = true;
let musicOn = true;
let volume = 0.6;

function ac(): AudioContext | null {
  if (!enabled && !musicOn) return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function configureAudio(opts: { sound: boolean; music: boolean; volume: number }) {
  enabled = opts.sound;
  volume = opts.volume;
  if (master) master.gain.value = volume;
  if (opts.music !== musicOn) { musicOn = opts.music; if (!musicOn) stopMusic(); }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.2, when = 0, slide?: number) {
  const c = ac(); if (!c || !master || !enabled) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, gain = 0.15, when = 0, filter = 1200) {
  const c = ac(); if (!c || !master || !enabled) return;
  const t = c.currentTime + when;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filter;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function sfx(name: Sfx) {
  if (!enabled) return;
  switch (name) {
    case 'click': tone(880, 0.05, 'triangle', 0.06); break;
    case 'open': tone(440, 0.12, 'sine', 0.08, 0, 880); break;
    case 'complete': tone(660, 0.1, 'triangle', 0.15); tone(990, 0.18, 'triangle', 0.12, 0.08); break;
    case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.07, i * 0.08)); tone(130, 1.2, 'sine', 0.2, 0, 65); break;
    case 'rank': [392, 523, 659, 784, 1047, 1568].forEach((f, i) => tone(f, 0.6, 'square', 0.05, i * 0.12)); noise(1.2, 0.08, 0, 600); tone(98, 2, 'sine', 0.25, 0, 49); break;
    case 'item': tone(1200, 0.08, 'sine', 0.1); tone(1600, 0.2, 'sine', 0.08, 0.06); break;
    case 'achievement': [784, 988, 1175].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, i * 0.1)); break;
    case 'boss': tone(80, 1.5, 'sawtooth', 0.15, 0, 40); noise(1, 0.15, 0, 300); break;
    case 'hit': noise(0.08, 0.2, 0, 2500); tone(220, 0.06, 'square', 0.05, 0, 110); break;
    case 'heavy': noise(0.18, 0.3, 0, 900); tone(110, 0.2, 'sawtooth', 0.1, 0, 55); break;
    case 'dodge': noise(0.15, 0.08, 0, 4000); break;
    case 'skill': tone(300, 0.3, 'sawtooth', 0.08, 0, 1200); noise(0.3, 0.1, 0.05, 3000); break;
    case 'hurt': tone(180, 0.15, 'square', 0.1, 0, 90); break;
    case 'error': tone(220, 0.12, 'square', 0.06); tone(180, 0.15, 'square', 0.06, 0.1); break;
  }
}

/** Trilha ambiente generativa: pad grave + arpejos esparsos em modo menor. */
export function startMusic(mood: 'calmo' | 'combate' = 'calmo') {
  if (!musicOn) return;
  const c = ac(); if (!c || !master) return;
  stopMusic();
  musicGain = c.createGain();
  musicGain.gain.value = 0;
  musicGain.gain.linearRampToValueAtTime(mood === 'combate' ? 0.22 : 0.16, c.currentTime + 3);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = mood === 'combate' ? 1400 : 700;
  musicGain.connect(lp).connect(master);
  const root = mood === 'combate' ? 55 : 49;
  for (const mul of [1, 1.5, 2, 2.38]) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = root * mul;
    o.detune.value = (Math.random() - 0.5) * 12;
    const g = c.createGain(); g.gain.value = 0.05;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.1;
    const lg = c.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(musicGain);
    o.start(); lfo.start();
    musicNodes.push(o, lfo);
  }
  const scale = [0, 3, 5, 7, 10, 12, 15];
  let step = 0;
  musicTimer = setInterval(() => {
    if (!ctx || !musicGain) return;
    step++;
    if (mood === 'calmo' && Math.random() < 0.45) return;
    const n = scale[Math.floor(Math.random() * scale.length)];
    const f = root * 4 * Math.pow(2, n / 12);
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = mood === 'combate' ? 'square' : 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(mood === 'combate' ? 0.04 : 0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (mood === 'combate' ? 0.25 : 1.6));
    o.connect(g).connect(musicGain);
    o.start(t); o.stop(t + 2);
    if (mood === 'combate' && step % 4 === 0) noise(0.1, 0.05, 0, 200);
  }, mood === 'combate' ? 220 : 700);
}

export function stopMusic() {
  clearInterval(musicTimer);
  for (const n of musicNodes) try { (n as OscillatorNode).stop(); } catch { /* já parado */ }
  musicNodes = [];
  if (musicGain) { try { musicGain.disconnect(); } catch { /* */ } musicGain = null; }
}
