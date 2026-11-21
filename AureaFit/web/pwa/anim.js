// Animações demonstrativas dos exercícios: mesmas poses do app Android (calculadas pelo núcleo Kotlin).
import { core } from './core.js';

const FRAMES = 32;
const cache = new Map();

function frames(anim) {
  if (!cache.has(anim)) {
    const list = [];
    for (let i = 0; i <= FRAMES; i++) list.push(JSON.parse(core.pose(anim, i / FRAMES)));
    cache.set(anim, list);
  }
  return cache.get(anim);
}

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

/** Curva do ciclo: pausa no início, desce/sobe, pausa no fim, volta (igual ao app Android). */
function cycleT(ms, hold) {
  const dur = hold ? 3000 : 2600;
  const x = ms % dur;
  const ease = (v) => v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
  if (x < 350) return 0;
  if (x < 1250) return (x - 350) / 900;
  if (x < 1650) return 1;
  return 1 - ease((x - 1650) / (dur - 1650));
}

export function drawPose(canvas, anim, t) {
  const list = frames(anim);
  const p = list[Math.round(Math.max(0, Math.min(1, t)) * FRAMES)];
  if (!p) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 290, h = canvas.clientHeight || 200;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const figure = cssVar('--primary') || '#b4436c';
  const prop = cssVar('--prop') || 'rgba(90,68,72,.45)';
  const gold = cssVar('--gold') || '#c9965f';
  const u = h * 0.95, floorY = h * 0.92;
  const ax = w * p.fx, ay = floorY + p.dy * u;
  const X = (pt) => [ax + pt.x * u, ay + pt.y * u];
  const pts = p.pts;
  const J = { HIP: 'hip', WRIST: 'wrist', WRIST2: 'wrist2', ANKLE: 'ankle', ANKLE2: 'ankle2', KNEE: 'knee', KNEE2: 'knee2', SHOULDER: 'shoulder' };
  ctx.lineCap = 'round';
  // chão
  ctx.strokeStyle = cssVar('--outline-v') || '#e2c9cd'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(w * 0.04, floorY); ctx.lineTo(w * 0.96, floorY); ctx.stroke();
  const line = (a, b, color, width) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); };
  const circle = (c, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, Math.PI * 2); ctx.fill(); };
  for (const pr of p.props) {
    if (pr.kind === 'box') { ctx.fillStyle = prop; const [x, y] = X({ x: pr.a, y: pr.b }); roundRect(ctx, x, y, pr.c * u, pr.d * u, 0.02 * u); }
    else if (pr.kind === 'line') line(X({ x: pr.a, y: pr.b }), X({ x: pr.c, y: pr.d }), prop, pr.w * u);
    else if (pr.kind === 'spad') circle(X({ x: pr.a, y: pr.b }), pr.c * u, prop);
    else if (pr.kind === 'cable' && pts[J[pr.joint]]) { const f = X({ x: pr.a, y: pr.b }); line(f, X(pts[J[pr.joint]]), prop, 0.008 * u); circle(f, 0.022 * u, prop); }
  }
  const sw = 0.045 * u;
  const seg = (a, b, color, k = 1) => { if (pts[a] && pts[b]) line(X(pts[a]), X(pts[b]), color, sw * k); };
  const back = hexAlpha(figure, 0.45);
  if (!p.front) {
    seg('hip', 'knee2', back); seg('knee2', 'ankle2', back); seg('ankle2', 'toe2', back, 0.8);
    seg('shoulder', 'elbow2', back); seg('elbow2', 'wrist2', back);
    seg('hip', 'shoulder', figure, 1.35); seg('shoulder', 'neck', figure, 0.9);
    circle(X(pts.head), 0.055 * u, figure);
    seg('hip', 'knee', figure); seg('knee', 'ankle', figure); seg('ankle', 'toe', figure, 0.8);
    seg('shoulder', 'elbow', figure); seg('elbow', 'wrist', figure);
  } else {
    seg('hipL', 'hipR', figure, 1.2); seg('shL', 'shR', figure, 1.2);
    seg('hip', 'shoulder', figure, 1.6); seg('shoulder', 'neck', figure, 0.9);
    circle(X(pts.head), 0.055 * u, figure);
    seg('hipL', 'knee2', figure); seg('knee2', 'ankle2', figure); seg('ankle2', 'toe2', figure, 0.8);
    seg('hipR', 'knee', figure); seg('knee', 'ankle', figure); seg('ankle', 'toe', figure, 0.8);
    seg('shL', 'elbow2', figure); seg('elbow2', 'wrist2', figure);
    seg('shR', 'elbow', figure); seg('elbow', 'wrist', figure);
  }
  for (const pr of p.props) {
    const jp = pts[J[pr.joint]];
    if (pr.kind === 'weight' && jp) {
      const c = X(jp);
      if (pr.weight === 'DUMBBELL') { line([c[0] - 0.035 * u, c[1]], [c[0] + 0.035 * u, c[1]], gold, 0.02 * u); circle([c[0] - 0.035 * u, c[1]], 0.028 * u, gold); circle([c[0] + 0.035 * u, c[1]], 0.028 * u, gold); }
      else if (pr.weight === 'PLATE') { circle([c[0], c[1] - 0.05 * u], 0.075 * u, gold); circle([c[0], c[1] - 0.05 * u], 0.02 * u, prop); }
      else line([c[0] - 0.1 * u, c[1]], [c[0] + 0.1 * u, c[1]], gold, 0.02 * u);
    } else if (pr.kind === 'pad' && jp) circle(X(jp), pr.a * u, hexAlpha(gold, 0.85));
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
}

function hexAlpha(c, a) {
  if (c.startsWith('#') && (c.length === 7)) { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  return c;
}

/** Desenha todos os <canvas data-anim> da tela; os que têm data-live="1" ficam animados. */
let rafId = 0;
export function mountAnimations(root = document) {
  cancelAnimationFrame(rafId);
  const canvases = [...root.querySelectorAll('canvas[data-anim]')];
  canvases.forEach((c) => drawPose(c, c.dataset.anim, c.dataset.live ? 0 : 1));
  const live = canvases.filter((c) => c.dataset.live);
  if (!live.length) return;
  const start = performance.now();
  let last = 0;
  const loop = (now) => {
    if (now - last > 33) { // ~30 fps, leve para celulares modestos
      last = now;
      live.forEach((c) => { if (c.isConnected) drawPose(c, c.dataset.anim, cycleT(now - start, frames(c.dataset.anim)[0].hold)); });
    }
    if (live.some((c) => c.isConnected)) rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}
