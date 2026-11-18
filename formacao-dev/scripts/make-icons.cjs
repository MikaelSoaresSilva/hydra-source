// Gera os ícones do app Android a partir de SVG (usa o Chromium do Playwright).
const { chromium } = require('playwright');
const path = require('path');
const RES = path.join(__dirname, '../android/app/src/main/res');
const SYMBOL = (s) => `<path d="M${22*s} ${20*s} ${10*s} ${32*s}l${12*s} ${12*s}M${42*s} ${20*s}l${12*s} ${12*s}-${12*s} ${12*s}" fill="none" stroke="#22c55e" stroke-width="${6*s}" stroke-linecap="round" stroke-linejoin="round"/><path d="M${36*s} ${14*s} ${28*s} ${50*s}" stroke="#38bdf8" stroke-width="${5*s}" stroke-linecap="round"/>`;
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b1220"/>${SYMBOL(1)}</svg>`;
const round = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#0b1220"/>${SYMBOL(1)}</svg>`;
// foreground adaptativo: 108 unidades, símbolo dentro da zona segura central (~66)
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate(22 22)">${SYMBOL(1)}</g></svg>`;
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  async function render(svg, size, file) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }
  for (const [d, k] of Object.entries(D)) {
    await render(square, 48 * k, `${RES}/mipmap-${d}/ic_launcher.png`);
    await render(round, 48 * k, `${RES}/mipmap-${d}/ic_launcher_round.png`);
    await render(fg, 108 * k, `${RES}/mipmap-${d}/ic_launcher_foreground.png`);
  }
  await b.close(); console.log('ícones gerados');
})();
