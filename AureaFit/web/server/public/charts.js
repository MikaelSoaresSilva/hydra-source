// Gráficos SVG leves e interativos (toque em um ponto/barra para ver o valor).
import { epochLabel } from './store.js';

const fmt = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toString().replace('.', ','));
let seq = 0;

export function lineChart(points, unit, color = 'var(--primary)') {
  if (!points.length) return `<p class="muted">Sem dados ainda. Registre para ver o gráfico.</p>`;
  const id = 'c' + (++seq);
  const pts = [...points].sort((a, b) => a.x - b.x);
  const W = 320, H = 180, L = 36, R = 8, T = 10, B = 22;
  let minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
  if (maxY - minY < 1e-6) { minY -= 1; maxY += 1; }
  const pad = (maxY - minY) * 0.12; minY -= pad; maxY += pad;
  const minX = pts[0].x, maxX = pts[pts.length - 1].x;
  const px = (x) => L + (maxX === minX ? (W - L - R) / 2 : (x - minX) / (maxX - minX) * (W - L - R));
  const py = (y) => T + (H - T - B) - (y - minY) / (maxY - minY) * (H - T - B);
  const grid = [0, 1, 2, 3].map((i) => { const v = minY + (maxY - minY) * i / 3; return `<line x1="${L}" x2="${W - R}" y1="${py(v)}" y2="${py(v)}" class="grid"/><text x="2" y="${py(v) + 4}" class="axis">${fmt(v)}</text>`; }).join('');
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${px(pts[pts.length - 1].x)},${H - B} L${px(pts[0].x)},${H - B} Z`;
  const last = pts[pts.length - 1];
  const dots = pts.map((p) => `<circle cx="${px(p.x)}" cy="${py(p.y)}" r="9" fill="transparent" data-tip="${fmt(p.y)} ${unit} • ${epochLabel(p.x)}" data-chart="${id}"/><circle cx="${px(p.x)}" cy="${py(p.y)}" r="3.5" fill="${color}" pointer-events="none"/>`).join('');
  return `<div class="chart"><div class="chart-tip" id="${id}" style="color:${color}">${fmt(last.y)} ${unit} • ${epochLabel(last.x)}</div>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico com ${pts.length} registros">
  <defs><linearGradient id="g${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
  ${grid}<path d="${area}" fill="url(#g${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}
  <text x="${L}" y="${H - 6}" class="axis">${epochLabel(minX)}</text>${maxX !== minX ? `<text x="${W - R - 30}" y="${H - 6}" class="axis">${epochLabel(maxX)}</text>` : ''}
  </svg></div>`;
}

export function barChart(labels, values, unit, color = 'var(--primary)', goal = null) {
  const id = 'c' + (++seq);
  const W = 320, H = 150, B = 20;
  const maxV = Math.max(...values, goal || 0, 1);
  const slot = W / values.length, bw = slot * 0.6;
  const bars = values.map((v, i) => {
    const x = i * slot + (slot - bw) / 2, bh = v / maxV * (H - B);
    return `<rect x="${x}" y="0" width="${bw}" height="${H - B}" rx="6" class="track"/>
      <rect x="${x}" y="${H - B - bh}" width="${bw}" height="${bh}" rx="6" fill="${color}" opacity="${i === values.length - 1 ? 1 : .6}"/>
      <rect x="${i * slot}" y="0" width="${slot}" height="${H}" fill="transparent" data-tip="${labels[i]}: ${fmt(v)} ${unit}" data-chart="${id}"/>
      <text x="${i * slot + slot / 2}" y="${H - 5}" text-anchor="middle" class="axis">${labels[i]}</text>`;
  }).join('');
  const g = goal ? `<line x1="0" x2="${W}" y1="${H - B - goal / maxV * (H - B)}" y2="${H - B - goal / maxV * (H - B)}" stroke="${color}" stroke-dasharray="6 5"/>` : '';
  return `<div class="chart"><div class="chart-tip" id="${id}" style="color:${color}">${labels[labels.length - 1]}: ${fmt(values[values.length - 1])} ${unit}</div>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras">${bars}${g}</svg></div>`;
}

/** Liga os toques dos gráficos (delegação de eventos). */
export function bindCharts(root) {
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    const tip = document.getElementById(t.dataset.chart);
    if (tip) tip.textContent = t.dataset.tip;
  });
}
