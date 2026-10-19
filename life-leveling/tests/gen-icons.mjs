import { chromium } from 'playwright';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const svg = readFileSync('public/icon.svg', 'utf8');
const fg = svg.replace('<rect width="512" height="512" rx="96" fill="url(#g)"/>', '').replace('viewBox="0 0 512 512"', 'viewBox="-128 -128 768 768"');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
async function render(content, w, h, out, bg = 'transparent') {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<html><body style="margin:0;background:${bg};width:${w}px;height:${h}px;display:grid;place-items:center">${content}</body></html>`);
  await p.screenshot({ path: out, omitBackground: bg === 'transparent' });
}
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const R = 'android/app/src/main/res';
for (const [d, k] of Object.entries(dens)) {
  const s = Math.round(48 * k), f = Math.round(108 * k);
  const sized = (x, n) => x.replace('<svg ', `<svg width="${n}" height="${n}" `);
  await render(sized(svg, s), s, s, `${R}/mipmap-${d}/ic_launcher.png`);
  await render(`<div style="width:${s}px;height:${s}px;border-radius:50%;overflow:hidden">${sized(svg, s)}</div>`, s, s, `${R}/mipmap-${d}/ic_launcher_round.png`);
  await render(sized(fg, f), f, f, `${R}/mipmap-${d}/ic_launcher_foreground.png`);
}
for (const dir of readdirSync(R).filter((x) => x.startsWith('drawable'))) {
  const file = `${R}/${dir}/splash.png`;
  if (!existsSync(file)) continue;
  const buf = readFileSync(file);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const n = Math.round(Math.min(w, h) * 0.35);
  await render(`<div style="text-align:center">${svg.replace('<svg ', `<svg width="${n}" height="${n}" `)}<div style="font-family:sans-serif;color:#4cc9ff;letter-spacing:.3em;font-size:${Math.round(n/9)}px;margin-top:${Math.round(n/8)}px">LIFE LEVELING</div></div>`, w, h, file, '#05060c');
}
await b.close();
console.log('ok');
