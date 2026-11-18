// Verifica todos os links do conteúdo. YouTube: via oEmbed (confirma que o vídeo/playlist existe e é público).
// Uso: npx tsx scripts/check-links.mjs
import { RESOURCES } from '../src/data/resources.ts';
import { ALL_LESSONS } from '../src/data/index.ts';
import fs from 'node:fs';

const urls = new Map();
for (const r of RESOURCES) urls.set(r.url, 'recurso ' + r.id);
for (const l of ALL_LESSONS) for (const d of l.docs ?? []) if (!urls.has(d.url)) urls.set(d.url, 'aula ' + l.id);

const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36';
async function check(url) {
  try {
    if (/youtube\.com\/(watch|playlist)/.test(url)) {
      const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url));
      if (r.status !== 200) return { ok: false, status: r.status };
      const j = await r.json();
      return { ok: true, status: 200, info: j.title + ' — ' + j.author_name };
    }
    const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9' }, signal: AbortSignal.timeout(20000) });
    return { ok: r.status < 400, status: r.status, info: r.url !== url ? '→ ' + r.url : '' };
  } catch (e) { return { ok: false, status: 'ERR', info: String(e.cause?.code ?? e.message) }; }
}
const entries = [...urls.entries()];
const results = [];
for (let i = 0; i < entries.length; i += 8) {
  const batch = await Promise.all(entries.slice(i, i + 8).map(async ([u, src]) => ({ url: u, src, ...(await check(u)) })));
  results.push(...batch);
}
let bad = 0;
for (const r of results) { if (!r.ok) bad++; console.log((r.ok ? 'OK  ' : 'FAIL') + ' ' + r.status + ' ' + r.url + ' (' + r.src + ') ' + (r.info ?? '')); }
console.log(`\n${results.length} links verificados, ${bad} com problema.`);
fs.writeFileSync('scripts/link-report.json', JSON.stringify({ date: new Date().toISOString(), results }, null, 1));
