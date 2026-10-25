#!/usr/bin/env node
/*
 * Gera aniverso/gratis.json: episódios completos publicados de graça em canais OFICIAIS do YouTube,
 * já ligados ao anime certo do AniList. Rode de tempos em tempos para atualizar:
 *
 *   node ferramentas/catalogo-gratis.mjs
 *
 * Só lê páginas públicas dos canais (como um navegador) e a API pública do AniList.
 */
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../aniverso/gratis.json', import.meta.url);
const UA = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

// Canais oficiais verificados. "lang" é o idioma padrão quando o título do vídeo não diz.
const CHANNELS = [
  { handle: 'CrunchyrollBR', name: 'Crunchyroll Brasil', lang: 'leg',
    searches: ['Episódio 1', 'Episódio 2', 'Episódio', 'Dublado', 'Legendado', 'Dublado e Legendado', 'Filme'] },
  { handle: 'yugiohportuguesbrasileir', name: 'Yu-Gi-Oh! Brasil', lang: 'dub', pages: ['', '/videos'],
    searches: ['Português do Brasil', 'Episódio', 'Temporada', 'Yu-Gi-Oh! GX', 'Duel Monsters', "5D's"] },
  { handle: 'pokemon', name: 'Pokémon (canal oficial)', lang: 'en',
    searches: ['Full Episode', 'FULL EPISODE Indigo League', 'FULL EPISODE Horizons', 'FULL EPISODE Journeys', 'Episode 1'],
    playlistTitle: /full episodes?/i, onlyTitle: /full episode|episode \d/i, skipTitle: /^UK:/i },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const walk = (o, fn) => { if (o && typeof o === 'object') { fn(o); for (const v of Object.values(o)) walk(v, fn); } };

async function ytPage(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const html = await (await fetch(url, { headers: UA })).text();
      const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
      return { data: m ? JSON.parse(m[1]) : null, ver: html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] };
    } catch { await sleep(2000 * (i + 1)); }
  }
  return { data: null };
}
async function ytMore(token, ver, endpoint = 'browse') {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST', headers: { ...UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: ver, hl: 'pt', gl: 'BR' } }, continuation: token }),
  });
  return r.json();
}
const toSec = (t) => (t || '').split(':').map(Number).reduce((a, n) => a * 60 + n, 0);

// extrai vídeos e playlists de qualquer formato que o YouTube use na página
function extract(data) {
  const videos = [], playlists = [];
  let token = null;
  walk(data, (o) => {
    const v = o.videoRenderer || o.playlistVideoRenderer || o.compactVideoRenderer || o.gridVideoRenderer;
    if (v?.videoId) videos.push({ id: v.videoId, title: v.title?.runs?.map((r) => r.text).join('') || v.title?.simpleText || '', dur: toSec(v.lengthText?.simpleText) });
    const l = o.lockupViewModel;
    if (l?.contentId) {
      const title = l.metadata?.lockupMetadataViewModel?.title?.content || '';
      const badge = [];
      walk(l.contentImage, (x) => { if (x.thumbnailBadgeViewModel?.text) badge.push(x.thumbnailBadgeViewModel.text); });
      if (l.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST') playlists.push({ id: l.contentId, title });
      else if (l.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') videos.push({ id: l.contentId, title, dur: toSec(badge.find((b) => /^\d+(:\d+)+$/.test(b))) });
    }
    if (o.gridPlaylistRenderer?.playlistId) playlists.push({ id: o.gridPlaylistRenderer.playlistId, title: o.gridPlaylistRenderer.title?.runs?.[0]?.text || '' });
    if (o.continuationCommand?.token) token = o.continuationCommand.token;
  });
  return { videos, playlists, token };
}

async function collect(url, { max = 600, endpoint = 'browse' } = {}) {
  const { data, ver } = await ytPage(url);
  if (!data) return { videos: [], playlists: [] };
  let { videos, playlists, token } = extract(data);
  let guard = 0;
  while (token && videos.length + playlists.length < max && guard++ < 40) {
    await sleep(400);
    const more = extract(await ytMore(token, ver, endpoint).catch(() => ({})));
    if (!more.videos.length && !more.playlists.length) break;
    videos.push(...more.videos); playlists.push(...more.playlists); token = more.token;
  }
  return { videos, playlists };
}

/* ---------- interpretar títulos ---------- */
const clean = (s) => s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
const PT_WORDS = /epis[óo]dio|temporada|portugu[eê]s|dublad|legendad/i;

function parseTitle(title, defaultLang) {
  const t = clean(title);
  const ep = Number((t.match(/epis[óo]dio\s*(\d+)/i) || t.match(/\bepisode\s*(\d+)/i) || t.match(/\bep\.?\s*(\d+)/i) || t.match(/\b\d+x(\d+)\b/) || [])[1]) || null;
  let lang = /dublado e legendado/i.test(t) ? 'dub-leg' : /dublad/i.test(t) ? 'dub' : /legendad/i.test(t) ? 'leg' : /portugu[eê]s/i.test(t) ? 'dub' : null;
  // canal brasileiro com título todo em inglês: provavelmente versão em inglês
  if (!lang && defaultLang === 'dub' && !PT_WORDS.test(t)) lang = 'en';
  const movie = /\bfilme\b|\bmovie\b/i.test(t);
  return { ep, lang: lang || defaultLang, movie, ...seriesOf(t) };
}

function seriesOf(t) {
  let s = t;
  // Pokémon: "Nome do episódio | Pokémon: Indigo League Episode 1"
  const parts = s.split(/\s\|\s/);
  if (parts.length > 1 && /pok[eé]mon/i.test(parts[parts.length - 1])) s = parts[parts.length - 1];
  s = s.replace(/\s*[-–|:]?\s*(?:epis[óo]dio|episode|ep\.?)\s*\d+.*$/i, '')
    .replace(/\s+\d+x\d+.*$/i, '')
    .replace(/\s*\[full episode\].*$/i, '')
    .replace(/\s*[-–|]\s*(?:filme|movie)\b.*$/i, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '');
  let season = null;
  s = s.replace(/\s*[-–,:]?\s*(?:temporada|season)\s*(\d+)\s*[,:-]?\s*$/i, (_, n) => { season = Number(n); return ''; });
  s = s.replace(/[\s:,\-–|]+$/, '').trim();
  return { series: s, season };
}
const seriesFromPlaylist = (title) => seriesOf(clean(title).replace(/\|\s*full episodes?/i, ''));

/* ---------- AniList ---------- */
// nomes que a busca do AniList não reconhece sozinha (títulos em português ou nomes de temporada)
const ALIASES = {
  // número = ID do anime no AniList (quando a busca por nome confunde)
  'pokémon: indigo league': 527, 'pokémon: the johto journeys': 527, 'pokémon: johto league champions': 527,
  'pokémon: orange islands': 527, 'pokémon advanced': 1564, 'pokémon the series: ruby and sapphire': 1564,
  'pokémon: diamond and pearl': 1565, 'pokémon the series: diamond and pearl': 1565, 'pokémon: black & white': 9107,
  'pokémon the series: xy': 19291, 'pokémon the series: xyz': 21356, 'pokémon the series: sun & moon': 97634,
  'pokémon journeys: the series': 112153, 'pokémon horizons: the series': 158871, 'pokémon horizons': 158871,
  'hanako-kun e os mistérios do colégio kamome': 'Toilet-bound Hanako-kun',
};
const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((w) => w.length > 1 && !['the', 'of', 'a', 'no', 'wa', 'to'].includes(w));
function score(query, m) {
  const q = tokens(query);
  if (!q.length) return 0;
  let best = 0;
  for (const name of [m.title.english, m.title.romaji, ...(m.synonyms || [])]) {
    if (!name) continue;
    if (norm(name) === norm(query)) return 2;
    const n = new Set(tokens(name));
    best = Math.max(best, q.filter((w) => n.has(w)).length / q.length);
  }
  return best;
}

const anilistCache = new Map();
async function anilistSearch(q) {
  if (anilistCache.has(q)) return anilistCache.get(q);
  let list = [];
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: 'query($s:String){ Page(perPage:8){ media(search:$s, type:ANIME, isAdult:false, sort:[SEARCH_MATCH, POPULARITY_DESC]){ id title{romaji english} synonyms format popularity } } }', variables: { s: q } }),
    }).catch(() => null);
    if (!r) { await sleep(3000); continue; }
    if (r.status === 429) { await sleep((Number(r.headers.get('retry-after')) || 30) * 1000); continue; }
    list = (await r.json().catch(() => null))?.data?.Page?.media || [];
    break;
  }
  await sleep(2200); // respeita o limite de ~30 pedidos por minuto
  anilistCache.set(q, list);
  return list;
}
const FORMAT_RANK = { TV: 0, ONA: 1, MOVIE: 2, TV_SHORT: 3, OVA: 4, SPECIAL: 5 };
function pick(query, list, minScore = 0.75) {
  const scored = list.map((m, i) => ({ m, s: score(query, m), i })).filter((x) => x.s >= minScore);
  scored.sort((a, b) => b.s - a.s || (FORMAT_RANK[a.m.format] ?? 9) - (FORMAT_RANK[b.m.format] ?? 9) || a.i - b.i);
  return scored[0]?.m || null;
}
async function anilistById(id) {
  const r = await fetch('https://graphql.anilist.co', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: 'query($id:Int){ Media(id:$id){ id title{romaji english} synonyms format } }', variables: { id } }),
  });
  await sleep(2200);
  return (await r.json().catch(() => null))?.data?.Media || null;
}
async function findAnime(series, season) {
  const alias = ALIASES[series.toLowerCase()];
  if (typeof alias === 'number') return anilistById(alias);
  const base = alias || series;
  if (season && season > 1) {
    for (const q of [`${base} Season ${season}`, `${base} ${season}`]) {
      const m = pick(q, await anilistSearch(q), 0.9);
      if (m) return m;
    }
  }
  for (const q of [base, norm(base)]) {
    const m = pick(base, await anilistSearch(q));
    if (m) return m;
  }
  return null;
}

/* ---------- principal ---------- */
const MIN_EPISODE = 12 * 60; // episódios completos têm pelo menos ~12 minutos

async function main() {
  const found = new Map(); // videoId -> { ...video, series, channel }
  for (const ch of CHANNELS) {
    const base = `https://www.youtube.com/@${ch.handle}`;
    const add = (v, seriesHint) => {
      if (found.has(v.id) || v.dur < MIN_EPISODE) return;
      if (ch.onlyTitle && !ch.onlyTitle.test(v.title) && !seriesHint) return;
      if (ch.skipTitle && ch.skipTitle.test(v.title)) return;
      const p = parseTitle(v.title, ch.lang);
      if (!p.ep && !p.movie) return;
      const hint = seriesHint || {};
      found.set(v.id, { id: v.id, title: clean(v.title), dur: v.dur, ep: p.ep, movie: p.movie, lang: p.lang,
        series: hint.series || p.series, season: hint.season ?? p.season, ch: ch.name });
    };
    // 1) playlists do canal (uma por anime, normalmente)
    const { playlists } = await collect(`${base}/playlists`, { max: 300 });
    console.error(`${ch.name}: ${playlists.length} playlists`);
    for (const pl of playlists) {
      if (ch.playlistTitle && !ch.playlistTitle.test(pl.title)) continue;
      const { videos } = await collect(`https://www.youtube.com/playlist?list=${pl.id}`, { max: 400 });
      const hint = seriesFromPlaylist(pl.title);
      videos.forEach((v) => add(v, /trailer|abertura|resenha|awards|temporada\b(?!\s*\d)/i.test(hint.series) ? null : hint));
      await sleep(300);
    }
    // 2) páginas do canal (para canais sem playlists)
    for (const pg of ch.pages || []) {
      const { videos } = await collect(`${base}${pg}`, { max: 400 });
      videos.forEach((v) => add(v, null));
    }
    // 3) buscas dentro do canal (pega episódios soltos, fora de playlists)
    for (const q of ch.searches) {
      const { videos } = await collect(`${base}/search?query=${encodeURIComponent(q)}`, { max: 200 });
      videos.forEach((v) => add(v, null));
      await sleep(300);
    }
    console.error(`${ch.name}: ${[...found.values()].filter((v) => v.ch === ch.name).length} episódios completos`);
  }

  // liga cada série ao AniList
  const anime = {};
  const bySeries = new Map();
  for (const v of found.values()) {
    const k = `${v.series.toLowerCase()}|${v.season || 1}`;
    if (!bySeries.has(k)) bySeries.set(k, []);
    bySeries.get(k).push(v);
  }
  let i = 0;
  for (const [, vids] of bySeries) {
    const name = vids[0].series, season = vids[0].season;
    const m = await findAnime(name, season);
    console.error(`[${++i}/${bySeries.size}] ${name}${season ? ` T${season}` : ''} -> ${m ? `${m.id} ${m.title.english || m.title.romaji}` : 'NÃO ACHOU'}`);
    if (!m) continue;
    const entry = anime[m.id] || (anime[m.id] = { title: m.title.english || m.title.romaji, videos: [] });
    for (const v of vids) if (!entry.videos.some((x) => x.id === v.id)) entry.videos.push({ id: v.id, title: v.title, ep: v.ep, movie: v.movie || undefined, lang: v.lang, dur: v.dur, ch: v.ch });
  }
  for (const a of Object.values(anime)) a.videos.sort((x, y) => (x.ep ?? 1e9) - (y.ep ?? 1e9) || x.lang.localeCompare(y.lang));

  const out = {
    updated: new Date().toISOString(),
    note: 'Episódios completos publicados de graça pelos próprios donos dos direitos em canais oficiais do YouTube.',
    channels: CHANNELS.map((c) => ({ name: c.name, url: `https://www.youtube.com/@${c.handle}` })),
    anime,
  };
  await writeFile(OUT, JSON.stringify(out));
  const total = Object.values(anime).reduce((n, a) => n + a.videos.length, 0);
  console.error(`OK: ${Object.keys(anime).length} animes, ${total} episódios -> ${OUT.pathname}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
