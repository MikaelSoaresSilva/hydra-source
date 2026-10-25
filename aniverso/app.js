/* AniVerso — catálogo de animes (AniList) com informação de dublagem (MyDubList). */
'use strict';

const API = 'https://graphql.anilist.co';
const DUB_URLS = {
  pt: 'https://raw.githubusercontent.com/Joelis57/MyDubList/main/dubs/confidence/normal/dubbed_portuguese.json',
  en: 'https://raw.githubusercontent.com/Joelis57/MyDubList/main/dubs/confidence/normal/dubbed_english.json',
};
const DUB_TTL = 3 * 24 * 3600 * 1000;
const PER_PAGE = 30;

const GENRES = {
  Action: 'Ação', Adventure: 'Aventura', Comedy: 'Comédia', Drama: 'Drama', Ecchi: 'Ecchi',
  Fantasy: 'Fantasia', Horror: 'Terror', 'Mahou Shoujo': 'Garota mágica', Mecha: 'Mecha',
  Music: 'Música', Mystery: 'Mistério', Psychological: 'Psicológico', Romance: 'Romance',
  'Sci-Fi': 'Ficção científica', 'Slice of Life': 'Cotidiano', Sports: 'Esportes',
  Supernatural: 'Sobrenatural', Thriller: 'Suspense',
};
const FORMATS = { TV: 'Série de TV', TV_SHORT: 'TV curta', MOVIE: 'Filme', SPECIAL: 'Especial', OVA: 'OVA', ONA: 'ONA (web)', MUSIC: 'Clipe musical' };
const FORMAT_SHORT = { TV: 'TV', TV_SHORT: 'TV curta', MOVIE: 'Filme', SPECIAL: 'Especial', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Clipe' };
const STATUS = { FINISHED: 'Finalizado', RELEASING: 'Em lançamento', NOT_YET_RELEASED: 'Ainda não lançado', CANCELLED: 'Cancelado', HIATUS: 'Em hiato' };
const SEASONS = { WINTER: 'Inverno', SPRING: 'Primavera', SUMMER: 'Verão', FALL: 'Outono' };
const SORTS = {
  POPULARITY_DESC: 'Mais populares', TRENDING_DESC: 'Em alta agora', SCORE_DESC: 'Melhor avaliados',
  START_DATE_DESC: 'Mais recentes', START_DATE: 'Mais antigos', TITLE_ROMAJI: 'Ordem alfabética',
};
const AUDIO = { all: 'Todos', pt: 'Dublado PT-BR', en: 'Dublado em inglês', sub: 'Só legendado (sem dub PT-BR)' };
const RELATIONS = {
  PREQUEL: 'Anterior', SEQUEL: 'Continuação', PARENT: 'História principal', SIDE_STORY: 'História paralela',
  SPIN_OFF: 'Spin-off', ALTERNATIVE: 'Versão alternativa', SUMMARY: 'Resumo', ADAPTATION: 'Adaptação',
  CHARACTER: 'Mesmos personagens', OTHER: 'Relacionado', SOURCE: 'Obra original', COMPILATION: 'Compilação', CONTAINS: 'Contém',
};
const LIST_STATUS = { watching: 'Assistindo', planning: 'Quero ver', completed: 'Concluído', paused: 'Pausado', dropped: 'Abandonado' };

// plataformas cujo site toca o vídeo dentro do app; as demais (Netflix, Prime Video…) abrem no app oficial
const PLAY_INSIDE = new Set(['Crunchyroll', 'YouTube', 'Bilibili TV', 'HIDIVE', 'Tubi TV', 'RetroCrush', 'Pluto TV', 'iQ', 'iQIYI',
  'WeTV', 'Viki', 'Hoopla', 'Midnight Pulp', 'AsianCrush', 'Crackle', 'Vimeo', 'Cineverse', 'Bilibili']);
const FREE_SITES = new Set(['YouTube', 'Tubi TV', 'RetroCrush', 'Pluto TV', 'Crackle', 'Midnight Pulp', 'AsianCrush']);
const EP_PREVIEW = 24;

const CARD = `id idMal title { romaji english } coverImage { large color } format episodes seasonYear averageScore status`;

/* ---------- utilidades ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.());
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
const titleOf = (m) => m.title.english || m.title.romaji || 'Sem título';
const fmtScore = (n) => (n ? (n / 10).toFixed(1).replace('.', ',') : '');
const fmtNum = (n) => Number(n || 0).toLocaleString('pt-BR');

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* armazenamento indisponível */ }
  },
};

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function currentSeason(d = new Date()) {
  const m = d.getMonth();
  const season = m < 3 ? 'WINTER' : m < 6 ? 'SPRING' : m < 9 ? 'SUMMER' : 'FALL';
  return { season, year: d.getFullYear() };
}

function cleanDescription(html) {
  if (!html) return '';
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n');
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function timeUntil(sec) {
  const s = Math.max(0, sec);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}min`;
  return `${m}min`;
}

/* ---------- API AniList ---------- */
const memo = new Map();
async function gql(query, variables = {}, { tries = 4 } = {}) {
  const key = query + JSON.stringify(variables);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < 5 * 60 * 1000) return hit.data;

  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
    } catch (err) {
      if (attempt >= tries) throw new Error('Sem conexão com o catálogo. Verifique sua internet e tente de novo.');
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= tries) throw new Error('O catálogo está ocupado agora. Aguarde alguns segundos e tente de novo.');
      const wait = Number(res.headers.get('Retry-After')) || 2 * attempt;
      if (res.status === 429) toast(`Muitas buscas seguidas. Tentando de novo em ${wait}s…`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    const json = await res.json();
    if (json.errors && !json.data) throw new Error(json.errors[0]?.message || 'Erro ao consultar o catálogo.');
    memo.set(key, { t: Date.now(), data: json.data });
    return json.data;
  }
}

/* ---------- dados de dublagem ---------- */
const dubs = { pt: new Set(), en: new Set(), ready: false };
const dubsReady = loadDubs();

async function loadDubs() {
  const cached = store.get('aniverso:dubs', null);
  if (cached && Date.now() - cached.t < DUB_TTL && cached.pt?.length) {
    dubs.pt = new Set(cached.pt); dubs.en = new Set(cached.en); dubs.ready = true;
    return;
  }
  try {
    const [pt, en] = await Promise.all(Object.values(DUB_URLS).map((u) => fetch(u).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })));
    dubs.pt = new Set(pt.dubbed); dubs.en = new Set(en.dubbed); dubs.ready = true;
    store.set('aniverso:dubs', { t: Date.now(), pt: pt.dubbed, en: en.dubbed });
  } catch {
    if (cached?.pt?.length) { dubs.pt = new Set(cached.pt); dubs.en = new Set(cached.en); dubs.ready = true; }
  }
}
const hasDub = (lang, m) => Boolean(m.idMal && dubs[lang].has(m.idMal));

/* ---------- Minha lista ---------- */
const myList = {
  all() { return store.get('aniverso:list', {}); },
  get(id) { return this.all()[id]; },
  set(m, status) {
    const all = this.all();
    if (!status) delete all[m.id];
    else all[m.id] = {
      id: m.id, idMal: m.idMal, status, addedAt: all[m.id]?.addedAt || Date.now(),
      title: { english: m.title.english, romaji: m.title.romaji },
      coverImage: { large: m.coverImage?.large || m.coverImage?.extraLarge, color: m.coverImage?.color },
      format: m.format, episodes: m.episodes, seasonYear: m.seasonYear, averageScore: m.averageScore,
    };
    store.set('aniverso:list', all);
  },
};

/* ---------- Progresso (episódios vistos) ---------- */
const cardSnapshot = (m) => ({
  id: m.id, idMal: m.idMal, title: { english: m.title.english, romaji: m.title.romaji },
  coverImage: { large: m.coverImage?.large || m.coverImage?.extraLarge, color: m.coverImage?.color },
  format: m.format, episodes: m.episodes, seasonYear: m.seasonYear, averageScore: m.averageScore,
});
const progress = {
  all() { return store.get('aniverso:progress', {}); },
  get(id) { return this.all()[id]; },
  save(m, watched, last) {
    const all = this.all();
    if (!watched.length) delete all[m.id];
    else all[m.id] = { ...cardSnapshot(m), watched: [...new Set(watched)].sort((a, b) => a - b), last, t: Date.now() };
    store.set('aniverso:progress', all);
  },
  open(m, ep) {
    const cur = this.get(m.id)?.watched || [];
    this.save(m, [...cur, ep], ep);
  },
  toggle(m, ep) {
    const p = this.get(m.id);
    const cur = p?.watched || [];
    const has = cur.includes(ep);
    const next = has ? cur.filter((n) => n !== ep) : [...cur, ep];
    this.save(m, next, Math.max(...next));
    return !has;
  },
};

/* ---------- Assistir dentro do app ---------- */
function watchUrl(url) {
  let u = String(url).replace(/^http:\/\//i, 'https://');
  // páginas da Crunchyroll em português (o áudio dublado ou legendado é escolhido no player dela)
  u = u.replace(/^https:\/\/(www\.)?crunchyroll\.com\/(?!pt-br\/)/i, 'https://www.crunchyroll.com/pt-br/');
  return u;
}
async function openInside(url) {
  const u = watchUrl(url);
  if (isNativeApp) {
    try {
      await window.Capacitor.nativePromise('Browser', 'open', { url: u, toolbarColor: '#120f1c' });
      return;
    } catch { /* plugin indisponível: cai para o link normal */ }
  }
  window.open(u, '_blank', 'noopener');
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-inside]');
  if (!a || e.defaultPrevented) return;
  e.preventDefault();
  openInside(a.href);
});

/* ---------- componentes ---------- */
function cardHTML(m) {
  const meta = [m.seasonYear, FORMAT_SHORT[m.format], m.episodes ? `${m.episodes} ep` : ''].filter(Boolean).join(' · ');
  const badges = (hasDub('pt', m) ? '<span class="badge pt">DUB PT</span>' : '') + (hasDub('en', m) ? '<span class="badge en">DUB EN</span>' : '');
  const color = /^#[0-9a-f]{3,8}$/i.test(m.coverImage?.color || '') ? ` style="--c:${m.coverImage.color}"` : '';
  return `<a class="card" href="#/anime/${m.id}">
    <div class="poster"${color}>
      ${m.coverImage?.large ? `<img loading="lazy" decoding="async" src="${esc(m.coverImage.large)}" alt="">` : ''}
      ${m.averageScore ? `<span class="score">★ ${fmtScore(m.averageScore)}</span>` : ''}
      ${badges ? `<div class="badges">${badges}</div>` : ''}
    </div>
    <div class="card-t">${esc(titleOf(m))}</div>
    ${meta ? `<div class="card-m">${esc(meta)}</div>` : ''}
  </a>`;
}
const skeletons = (n) => Array.from({ length: n }, () => '<div class="card skeleton"><div class="poster"></div><div class="card-t"></div></div>').join('');

function errorHTML(msg, retryId) {
  return `<div class="empty error-box"><strong>Não foi possível carregar</strong>${esc(msg)}<br><br>
    <button class="btn small" id="${retryId}" type="button">Tentar de novo</button></div>`;
}

/* ---------- Início ---------- */
let homeLoaded = false;
async function renderHome() {
  const view = $('#view-home');
  if (homeLoaded) return;
  const { season, year } = currentSeason();
  const rows = [
    { key: 'trending', title: 'Em alta agora', more: '#/explorar?sort=TRENDING_DESC' },
    { key: 'season', title: `Temporada de ${SEASONS[season].toLowerCase()} ${year}`, more: `#/explorar?year=${year}&sort=POPULARITY_DESC` },
    { key: 'dubbed', title: 'Dublados em português', more: '#/explorar?audio=pt' },
    { key: 'top', title: 'Mais bem avaliados de todos os tempos', more: '#/explorar?sort=SCORE_DESC' },
    { key: 'popular', title: 'Os mais populares', more: '#/explorar' },
    { key: 'movies', title: 'Filmes', more: '#/explorar?format=MOVIE' },
  ];
  view.innerHTML = `<div class="hero" id="hero"><div class="wrap hero-in" style="min-height:240px"></div></div>
    <div class="wrap"><div id="continue-row"></div>${rows.map((r) => `<div class="section" data-row="${r.key}">
      <div class="section-head"><h2>${esc(r.title)}</h2><a href="${r.more}">Ver todos →</a></div>
      <div class="rail">${skeletons(8)}</div></div>`).join('')}</div>`;

  renderContinueRow();
  await Promise.race([dubsReady, new Promise((r) => setTimeout(r, 5000))]);
  const useDub = dubs.ready && dubs.pt.size > 0;
  const query = `query($season: MediaSeason, $year: Int${useDub ? ', $dub: [Int]' : ''}) {
    trending: Page(perPage: 20) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${CARD} bannerImage description genres coverImage { extraLarge } } }
    season: Page(perPage: 20) { media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC, isAdult: false) { ${CARD} } }
    ${useDub ? `dubbed: Page(perPage: 20) { media(type: ANIME, idMal_in: $dub, sort: TRENDING_DESC, isAdult: false) { ${CARD} } }` : ''}
    top: Page(perPage: 20) { media(type: ANIME, sort: SCORE_DESC, isAdult: false) { ${CARD} } }
    popular: Page(perPage: 20) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${CARD} } }
    movies: Page(perPage: 20) { media(type: ANIME, format: MOVIE, sort: TRENDING_DESC, isAdult: false) { ${CARD} } }
  }`;
  try {
    const data = await gql(query, { season, year, ...(useDub ? { dub: [...dubs.pt] } : {}) });
    for (const r of rows) {
      const sec = view.querySelector(`[data-row="${r.key}"]`);
      const list = data[r.key]?.media || [];
      if (!list.length) { sec.remove(); continue; }
      sec.querySelector('.rail').innerHTML = list.map(cardHTML).join('');
    }
    renderHero(data.trending.media.find((m) => m.bannerImage) || data.trending.media[0]);
    homeLoaded = true;
  } catch (err) {
    view.innerHTML = `<div class="wrap">${errorHTML(err.message, 'home-retry')}</div>`;
    $('#home-retry').onclick = () => renderHome();
  }
}

function renderContinueRow() {
  const el = $('#continue-row');
  if (!el) return;
  const items = Object.values(progress.all()).sort((a, b) => b.t - a.t).slice(0, 20);
  el.innerHTML = items.length ? `<div class="section"><div class="section-head"><h2>Continuar assistindo</h2></div>
    <div class="rail">${items.map((i) => cardHTML(i).replace('<div class="card-t">', `<div class="card-m accent">Parou no ep. ${esc(i.last)}</div><div class="card-t">`)).join('')}</div></div>` : '';
}

function renderHero(m) {
  if (!m) return;
  const chips = [
    m.averageScore ? `<span class="chip">★ ${fmtScore(m.averageScore)}</span>` : '',
    ...(m.genres || []).slice(0, 3).map((g) => `<span class="chip">${esc(GENRES[g] || g)}</span>`),
    hasDub('pt', m) ? '<span class="chip pt">Dublado PT-BR</span>' : '',
    '<span class="chip live">Legendado</span>',
  ].join('');
  $('#hero').innerHTML = `
    ${m.bannerImage ? `<div class="hero-bg" style="background-image:url('${esc(m.bannerImage)}')"></div>` : ''}
    <div class="wrap hero-in">
      <img class="hero-cover" src="${esc(m.coverImage.extraLarge || m.coverImage.large)}" alt="">
      <div class="hero-text">
        <div class="eyebrow">Nº 1 em alta hoje</div>
        <h1>${esc(titleOf(m))}</h1>
        <div class="chips">${chips}</div>
        <p>${esc(cleanDescription(m.description))}</p>
        <div class="btns">
          <a class="btn primary" href="#/anime/${m.id}">Ver detalhes e onde assistir</a>
          <button class="btn" type="button" id="hero-random">Me surpreenda</button>
        </div>
      </div>
    </div>`;
  $('#hero-random').onclick = randomAnime;
}

async function randomAnime() {
  toast('Sorteando um anime…');
  try {
    const page = 1 + Math.floor(Math.random() * 1500);
    const data = await gql(`query($p: Int) { Page(page: $p, perPage: 1) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { id } } }`, { p: page });
    const id = data.Page.media[0]?.id;
    if (id) location.hash = `#/anime/${id}`;
  } catch (err) { toast(err.message); }
}

/* ---------- Explorar ---------- */
const explore = { key: '', page: 0, hasNext: true, loading: false, total: 0, observer: null };

function readExploreParams(qs) {
  const p = new URLSearchParams(qs);
  return {
    q: p.get('q') || '', audio: AUDIO[p.get('audio')] ? p.get('audio') : 'all',
    genre: GENRES[p.get('genre')] ? p.get('genre') : '', format: FORMATS[p.get('format')] ? p.get('format') : '',
    status: STATUS[p.get('status')] ? p.get('status') : '', year: /^\d{4}$/.test(p.get('year') || '') ? p.get('year') : '',
    sort: SORTS[p.get('sort')] ? p.get('sort') : 'POPULARITY_DESC',
  };
}
function exploreHash(f) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v && !(k === 'audio' && v === 'all') && !(k === 'sort' && v === 'POPULARITY_DESC')) p.set(k, v);
  const s = p.toString();
  return '#/explorar' + (s ? '?' + s : '');
}
const options = (obj, sel, blank) => (blank ? `<option value="">${blank}</option>` : '') +
  Object.entries(obj).map(([v, l]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('');

function renderExplore(qs) {
  const f = readExploreParams(qs);
  const key = JSON.stringify(f);
  const view = $('#view-explore');
  if (key === explore.key && view.innerHTML) return; // mesma busca: mantém resultados e rolagem
  explore.key = key;

  const thisYear = new Date().getFullYear();
  const years = {};
  for (let y = thisYear + 1; y >= 1940; y--) years[y] = String(y);

  view.innerHTML = `<div class="wrap">
    <div class="explore-head">
      <h1>Explorar animes</h1>
      <p>Todo o catálogo do AniList, com filtro de dublagem. Combine os filtros como quiser.</p>
    </div>
    <form class="filters" id="filters">
      <div class="field search"><label for="f-q">Nome</label><input id="f-q" name="q" type="search" placeholder="Ex.: Naruto, One Piece, Frieren…" value="${esc(f.q)}" autocomplete="off"></div>
      <div class="field"><label for="f-audio">Áudio</label><select id="f-audio" name="audio">${options(AUDIO, f.audio)}</select></div>
      <div class="field"><label for="f-genre">Gênero</label><select id="f-genre" name="genre">${options(GENRES, f.genre, 'Todos')}</select></div>
      <div class="field"><label for="f-format">Formato</label><select id="f-format" name="format">${options(FORMATS, f.format, 'Todos')}</select></div>
      <div class="field"><label for="f-status">Situação</label><select id="f-status" name="status">${options(STATUS, f.status, 'Todas')}</select></div>
      <div class="field"><label for="f-year">Ano</label><select id="f-year" name="year">${options(years, f.year, 'Todos')}</select></div>
      <div class="field"><label for="f-sort">Ordenar por</label><select id="f-sort" name="sort">${options(SORTS, f.sort)}</select></div>
    </form>
    <div class="result-bar"><span id="result-count">Buscando…</span>
      ${key !== JSON.stringify(readExploreParams('')) ? '<a class="linkish" href="#/explorar">Limpar filtros</a>' : ''}</div>
    <div class="grid" id="results">${skeletons(12)}</div>
    <div class="loading-more" id="loading-more" hidden>Carregando mais…</div>
    <div class="sentinel" id="sentinel"></div>
  </div>`;

  const form = $('#filters');
  const apply = () => {
    const fd = Object.fromEntries(new FormData(form));
    const next = exploreHash({ ...f, ...fd });
    if (next !== location.hash) location.hash = next;
  };
  form.addEventListener('change', (e) => { if (e.target.name !== 'q') apply(); });
  let t;
  $('#f-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 450); });
  form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(t); apply(); });
  if (f.q) { const i = $('#f-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }

  explore.page = 0; explore.hasNext = true; explore.loading = false; explore.filters = f;
  explore.observer?.disconnect();
  explore.observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadMoreExplore();
  }, { rootMargin: '800px' });
  explore.observer.observe($('#sentinel'));
  loadMoreExplore(true);
}

async function loadMoreExplore(first = false) {
  if (explore.loading || !explore.hasNext) return;
  explore.loading = true;
  const f = explore.filters;
  const myKey = explore.key;
  if (!first) $('#loading-more').hidden = false;

  if (f.audio !== 'all') await dubsReady;
  const vars = { page: explore.page + 1, perPage: PER_PAGE };
  const args = ['type: ANIME', 'isAdult: false'];
  const defs = ['$page: Int', '$perPage: Int'];
  const add = (name, type, value, arg) => { defs.push(`$${name}: ${type}`); vars[name] = value; args.push(arg || `${name}: $${name}`); };
  if (f.q) add('search', 'String', f.q);
  if (f.genre) add('genre', 'String', f.genre);
  if (f.format) add('format', 'MediaFormat', f.format);
  if (f.status) add('status', 'MediaStatus', f.status);
  if (f.year) add('seasonYear', 'Int', Number(f.year));
  add('sort', '[MediaSort]', f.q ? ['SEARCH_MATCH', f.sort] : [f.sort, 'ID_DESC']);

  const resultsEl = $('#results');
  if (f.audio !== 'all') {
    if (!dubs.ready) {
      explore.loading = false;
      resultsEl.innerHTML = errorHTML('A lista de dublagens não carregou. Verifique sua internet.', 'explore-retry');
      $('#result-count').textContent = '';
      $('#explore-retry').onclick = () => { location.reload(); };
      return;
    }
    if (f.audio === 'pt') add('dub', '[Int]', [...dubs.pt], 'idMal_in: $dub');
    if (f.audio === 'en') add('dub', '[Int]', [...dubs.en], 'idMal_in: $dub');
    if (f.audio === 'sub') add('dub', '[Int]', [...dubs.pt], 'idMal_not_in: $dub');
  }

  const query = `query(${defs.join(', ')}) { Page(page: $page, perPage: $perPage) {
    pageInfo { total hasNextPage } media(${args.join(', ')}) { ${CARD} } } }`;
  try {
    const data = await gql(query, vars);
    if (myKey !== explore.key) return; // filtros mudaram enquanto carregava
    const { media, pageInfo } = data.Page;
    explore.page += 1;
    explore.hasNext = pageInfo.hasNextPage;
    const html = media.map(cardHTML).join('');
    if (first) resultsEl.innerHTML = html; else resultsEl.insertAdjacentHTML('beforeend', html);
    // o AniList limita o total informado a 5.000, então mostramos quantos já estão na tela
    const shown = resultsEl.querySelectorAll('.card').length;
    $('#result-count').textContent = shown
      ? `${fmtNum(shown)} ${shown === 1 ? 'anime' : 'animes'}${explore.hasNext ? ' até agora · role para ver mais' : ''}`
      : '';
    if (first && !media.length) {
      resultsEl.innerHTML = `<div class="empty" style="grid-column:1/-1"><strong>Nenhum anime com esses filtros</strong>
        Tente outro nome (em inglês ou japonês também funciona) ou remova algum filtro.</div>`;
    }
  } catch (err) {
    if (first) {
      resultsEl.innerHTML = `<div style="grid-column:1/-1">${errorHTML(err.message, 'explore-retry')}</div>`;
      $('#result-count').textContent = '';
      $('#explore-retry').onclick = () => { explore.key = ''; renderExplore(location.hash.split('?')[1] || ''); };
    } else toast(err.message);
  } finally {
    if (myKey === explore.key) {
      explore.loading = false;
      $('#loading-more').hidden = true;
      // se a tela ainda não estiver cheia, carrega a próxima página
      const s = $('#sentinel');
      if (explore.hasNext && s && s.getBoundingClientRect().top < innerHeight + 800) setTimeout(() => loadMoreExplore(), 300);
    }
  }
}

/* ---------- Página do anime ---------- */
const DETAIL = `query($id: Int) { Media(id: $id, type: ANIME) {
  ${CARD} title { native } coverImage { extraLarge } bannerImage description synonyms
  duration season startDate { year month day } endDate { year month day } popularity favourites
  genres countryOfOrigin source studios(isMain: true) { nodes { name } }
  nextAiringEpisode { episode airingAt timeUntilAiring }
  trailer { id site thumbnail }
  externalLinks { site url type language color icon }
  streamingEpisodes { title url site thumbnail }
  relations { edges { relationType node { ${CARD} type } } }
  recommendations(perPage: 12, sort: RATING_DESC) { nodes { mediaRecommendation { ${CARD} } } }
} }`;
const SOURCES = { ORIGINAL: 'Original', MANGA: 'Mangá', LIGHT_NOVEL: 'Light novel', VISUAL_NOVEL: 'Visual novel', VIDEO_GAME: 'Videogame', NOVEL: 'Livro', WEB_NOVEL: 'Web novel', DOUJINSHI: 'Doujinshi', ANIME: 'Anime', WEB_MANGA: 'Mangá on-line', OTHER: 'Outro', LIVE_ACTION: 'Live action', GAME: 'Jogo', COMIC: 'Quadrinho', MULTIMEDIA_PROJECT: 'Projeto multimídia', PICTURE_BOOK: 'Livro ilustrado' };
const LANG_PT = { Portuguese: 'Português', English: 'Inglês', Japanese: 'Japonês', Spanish: 'Espanhol', French: 'Francês', German: 'Alemão', Italian: 'Italiano', Korean: 'Coreano', Chinese: 'Chinês' };

function parseEpisodes(list) {
  const seen = new Set();
  return (list || []).map((e) => {
    const mm = /^Episode\s+(\d+(?:\.\d+)?)\s*[-–:]?\s*(.*)$/i.exec(e.title || '');
    return { n: mm ? Number(mm[1]) : null, name: mm ? mm[2] : (e.title || ''), url: safeUrl(e.url), site: e.site, thumb: safeUrl(e.thumbnail) };
  }).filter((e) => e.url && !seen.has(e.url) && seen.add(e.url))
    .map((e, i) => ({ ...e, n: e.n ?? i + 1 }))
    .sort((a, b) => a.n - b.n);
}

function episodeHTML(e, watched) {
  return `<div class="ep${watched ? ' seen' : ''}" data-ep="${e.n}">
    <a class="ep-play" href="${esc(e.url)}" data-inside data-epn="${e.n}">
      <span class="ep-thumb">${e.thumb ? `<img src="${esc(e.thumb)}" alt="" loading="lazy">` : ''}<span class="ep-badge">▶</span></span>
      <span class="ep-txt"><span class="ep-n">Episódio ${esc(String(e.n).replace('.', ','))}</span><span class="ep-t">${esc(e.name)}</span></span>
    </a>
    <button class="ep-check" type="button" data-check="${e.n}" aria-pressed="${watched}" aria-label="Marcar episódio ${e.n} como visto">✓</button>
  </div>`;
}

const fmtDate = (d) => (d?.year ? [d.day, d.month, d.year].filter(Boolean).map((n) => String(n).padStart(2, '0')).join('/') : '');

async function renderAnime(id) {
  const view = $('#view-anime');
  view.innerHTML = `<div class="banner"></div><div class="wrap"><div class="detail-top">
    <div class="detail-cover-wrap"><div class="detail-cover skeleton"></div></div>
    <div class="detail-main"><h1>Carregando…</h1></div></div></div>`;
  try {
    const [data] = await Promise.all([gql(DETAIL, { id: Number(id) }), Promise.race([dubsReady, new Promise((r) => setTimeout(r, 4000))])]);
    const m = data.Media;
    if (!m) throw new Error('Anime não encontrado.');
    if (location.hash !== `#/anime/${id}`) return;
    document.title = `${titleOf(m)} · AniVerso`;
    view.innerHTML = animeHTML(m);
    bindAnime(m);
  } catch (err) {
    view.innerHTML = `<div class="wrap">${errorHTML(err.message, 'anime-retry')}</div>`;
    $('#anime-retry').onclick = () => renderAnime(id);
  }
}

function animeHTML(m) {
  const title = titleOf(m);
  const alt = [...new Set([m.title.romaji, m.title.native])].filter((t) => t && t !== title).join(' · ');
  const desc = cleanDescription(m.description);
  const studios = m.studios.nodes.map((s) => s.name).join(', ');
  const ptDub = hasDub('pt', m), enDub = hasDub('en', m);
  const color = /^#[0-9a-f]{3,8}$/i.test(m.coverImage?.color || '') ? ` style="--c:${m.coverImage.color}"` : '';
  const facts = [
    ['Formato', FORMATS[m.format]],
    ['Episódios', m.episodes ? `${m.episodes}${m.duration ? ` × ${m.duration} min` : ''}` : (m.status === 'RELEASING' ? 'Em andamento' : '')],
    ['Situação', STATUS[m.status]],
    ['Temporada', m.season ? `${SEASONS[m.season]} ${m.seasonYear || ''}` : ''],
    ['Estreia', fmtDate(m.startDate)],
    ['Fim', fmtDate(m.endDate)],
    ['Estúdio', studios],
    ['Origem', SOURCES[m.source] || ''],
    ['Nota média', m.averageScore ? `${fmtScore(m.averageScore)} / 10` : ''],
    ['Popularidade', m.popularity ? `${fmtNum(m.popularity)} pessoas` : ''],
  ].filter(([, v]) => v);
  const factsHTML = `<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;

  const chips = [
    m.averageScore ? `<span class="chip">★ ${fmtScore(m.averageScore)}</span>` : '',
    m.seasonYear ? `<span class="chip">${m.seasonYear}</span>` : '',
    FORMAT_SHORT[m.format] ? `<span class="chip">${FORMAT_SHORT[m.format]}</span>` : '',
    ...m.genres.map((g) => `<a class="chip" href="#/explorar?genre=${encodeURIComponent(g)}" style="text-decoration:none">${esc(GENRES[g] || g)}</a>`),
    m.nextAiringEpisode ? `<span class="chip live">Ep. ${m.nextAiringEpisode.episode} em ${timeUntil(m.nextAiringEpisode.timeUntilAiring)}</span>` : '',
  ].join('');

  const audio = `<div class="panel"><h3>Dublado ou legendado?</h3><div class="audio-grid">
    <div class="audio yes sub"><div class="flag">LEG</div><div><strong>Legendado</strong>
      <span>Áudio original em japonês com legendas. É como quase todo anime chega às plataformas.</span></div></div>
    <div class="audio pt ${ptDub ? 'yes' : 'no'}"><div class="flag">PT</div><div><strong>${ptDub ? 'Tem dublagem brasileira' : 'Sem dublagem brasileira registrada'}</strong>
      <span>${ptDub ? 'Existe versão dublada em português do Brasil.' : (dubs.ready ? 'Ainda não consta na base de dublagens.' : 'Não foi possível verificar agora.')}</span></div></div>
    <div class="audio en ${enDub ? 'yes' : 'no'}"><div class="flag">EN</div><div><strong>${enDub ? 'Tem dublagem em inglês' : 'Sem dublagem em inglês registrada'}</strong>
      <span>${enDub ? 'Existe versão dublada em inglês.' : (dubs.ready ? 'Ainda não consta na base de dublagens.' : 'Não foi possível verificar agora.')}</span></div></div>
  </div><p class="note">A dublagem pode estar disponível só em algumas plataformas ou países. Confira na plataforma antes de assinar.</p></div>`;

  const streams = m.externalLinks.filter((l) => l.type === 'STREAMING' && safeUrl(l.url));
  const linkHTML = (l, sub, inside = false) => {
    const lc = /^#[0-9a-f]{3,8}$/i.test(l.color || '') ? ` style="--lc:${l.color}"` : '';
    const free = FREE_SITES.has(l.site) ? '<span class="free">Grátis</span>' : '';
    return `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener"${inside ? ' data-inside' : ''}${lc}>
      <span class="ico">${l.icon ? `<img src="${esc(l.icon)}" alt="" loading="lazy">` : ''}</span>
      <span class="txt">${esc(l.site)}${free}<small>${esc(sub)}</small></span></a>`;
  };
  const insideLabel = isNativeApp ? 'Assistir aqui no app' : 'Assistir no site oficial';
  const streamSub = (l) => {
    const lang = l.language ? ` · ${LANG_PT[l.language] || l.language}` : '';
    return (PLAY_INSIDE.has(l.site) ? insideLabel : (isNativeApp ? 'Abre no app oficial' : 'Abrir na plataforma')) + lang;
  };
  const q = encodeURIComponent(m.title.english || m.title.romaji);
  const where = `<div class="panel" id="onde-assistir"><h3>Onde assistir legalmente</h3>
    <div class="where">
      ${streams.map((l) => linkHTML(l, streamSub(l), PLAY_INSIDE.has(l.site))).join('')}
      ${linkHTML({ site: 'JustWatch Brasil', url: `https://www.justwatch.com/br/busca?q=${q}`, color: '#FBC500' }, 'Ver onde está no Brasil')}
      ${streams.some((l) => l.site === 'Crunchyroll') ? '' : linkHTML({ site: 'Crunchyroll', url: `https://www.crunchyroll.com/pt-br/search?q=${q}`, color: '#F47521' }, 'Procurar no catálogo BR', true)}
    </div>
    <p class="note">${streams.length ? 'Plataformas oficiais cadastradas no AniList.' : 'Nenhuma plataforma oficial cadastrada para este anime ainda.'}
      ${isNativeApp ? '"Assistir aqui no app" abre o player da plataforma sem sair do AniVerso; feche no X para voltar. ' : ''}Plataformas pagas pedem login na sua conta.
      O JustWatch mostra em quais serviços o anime está no Brasil e se tem áudio em português.</p></div>`;

  const eps = parseEpisodes(m.streamingEpisodes);
  const prog = progress.get(m.id);
  const seen = new Set(prog?.watched || []);
  const nextEp = eps.length ? (prog ? eps.find((e) => e.n > prog.last) || eps.find((e) => e.n === prog.last) : eps[0]) : null;
  const insideStream = streams.find((l) => PLAY_INSIDE.has(l.site));
  let cta = '';
  if (nextEp) {
    cta = `<a class="btn primary big" href="${esc(nextEp.url)}" data-inside data-epn="${nextEp.n}">▶ ${prog ? 'Continuar' : 'Assistir'}: episódio ${esc(String(nextEp.n).replace('.', ','))}</a>`;
  } else if (insideStream) {
    cta = `<a class="btn primary big" href="${esc(insideStream.url)}" data-inside>▶ Assistir na ${esc(insideStream.site)}</a>`;
  } else if (streams.length) {
    cta = `<a class="btn primary big" href="#onde-assistir" data-scroll>▶ Ver onde assistir</a>`;
  }
  const episodesHTML = eps.length ? `<div class="panel" id="episodios">
    <div class="ep-head"><h3>Episódios <span class="muted">${eps.length}</span></h3>
      <span class="note">${esc(eps[0].site || 'Crunchyroll')} · ${isNativeApp ? 'toque para assistir aqui no app' : 'abre no site oficial'}</span></div>
    <div class="eps">${eps.map((e, i) => episodeHTML(e, seen.has(e.n)).replace('<div class="ep', i >= EP_PREVIEW ? '<div hidden class="ep' : '<div class="ep')).join('')}</div>
    ${eps.length > EP_PREVIEW ? `<button class="btn small" type="button" id="eps-all">Mostrar todos os ${eps.length} episódios</button>` : ''}
    <p class="note">O ✓ marca o episódio como visto. Ele também é marcado quando você toca para assistir.</p>
  </div>` : '';

  const trailer = m.trailer && (m.trailer.site === 'youtube' || m.trailer.site === 'dailymotion')
    ? `<div class="panel"><h3>Trailer</h3><div class="trailer">
        <button class="trailer-btn" type="button" id="trailer-play" aria-label="Assistir trailer"
          style="background-image:url('${esc(m.trailer.site === 'youtube' ? `https://i.ytimg.com/vi/${encodeURIComponent(m.trailer.id)}/hqdefault.jpg` : (m.trailer.thumbnail || ''))}')"></button>
      </div></div>` : '';

  const relations = m.relations.edges.filter((e) => e.node.type === 'ANIME');
  const relHTML = relations.length ? `<div class="section"><div class="section-head"><h2>Temporadas, filmes e relacionados</h2></div>
    <div class="rail">${relations.map((e) => cardHTML(e.node).replace('<div class="card-t">', `<div class="card-m">${esc(RELATIONS[e.relationType] || '')}</div><div class="card-t">`)).join('')}</div></div>` : '';
  const recs = m.recommendations.nodes.map((n) => n.mediaRecommendation).filter(Boolean);
  const recHTML = recs.length ? `<div class="section"><div class="section-head"><h2>Se você gostou, veja também</h2></div>
    <div class="rail">${recs.map(cardHTML).join('')}</div></div>` : '';

  const saved = myList.get(m.id)?.status || '';
  const translate = desc ? `https://translate.google.com/?sl=auto&tl=pt&op=translate&text=${encodeURIComponent(desc.slice(0, 4500))}` : '';

  return `<div class="banner"${m.bannerImage ? ` style="background-image:url('${esc(m.bannerImage)}')"` : ''}></div>
  <div class="wrap">
    <div class="detail-top">
      <div class="detail-cover-wrap"><img class="detail-cover"${color} src="${esc(m.coverImage.extraLarge || m.coverImage.large)}" alt="Capa de ${esc(title)}"></div>
      <div class="detail-main">
        <h1>${esc(title)}</h1>
        ${alt ? `<p class="alt-titles">${esc(alt)}</p>` : ''}
        <div class="chips">${chips}</div>
        ${cta ? `<div class="btns cta-row">${cta}</div>` : ''}
      </div>
      <aside class="detail-side">
        <label class="field"><span class="eyebrow" style="color:var(--muted)">Minha lista</span>
          <select class="mylist-select" id="mylist-status">${options(LIST_STATUS, saved, 'Adicionar à minha lista…')}</select></label>
        ${factsHTML}
      </aside>
    </div>
    <div class="detail-sections">
      ${desc ? `<div><p class="synopsis clamped" id="synopsis">${esc(desc)}</p>
        <div class="btns"><button class="linkish" type="button" id="syn-more">Ler mais</button>
        <a class="linkish" href="${esc(translate)}" target="_blank" rel="noopener">Traduzir sinopse para português</a></div></div>` : ''}
      ${episodesHTML}
      ${audio}
      ${trailer ? `<div class="two-col">${where}${trailer}</div>` : where}
      <div class="panel mobile-facts"><h3>Ficha técnica</h3>${factsHTML}</div>
    </div>
    ${relHTML}${recHTML}
  </div>`;
}

function bindAnime(m) {
  const sel = $('#mylist-status');
  sel.addEventListener('change', () => {
    myList.set(m, sel.value);
    toast(sel.value ? `Salvo em "${LIST_STATUS[sel.value]}"` : 'Removido da sua lista');
    sel.querySelector('option[value=""]').textContent = sel.value ? 'Remover da lista' : 'Adicionar à minha lista…';
  });
  if (sel.value) sel.querySelector('option[value=""]').textContent = 'Remover da lista';

  const view = $('#view-anime');
  view.querySelectorAll('a[data-epn]').forEach((a) => a.addEventListener('click', () => {
    const n = Number(a.dataset.epn);
    progress.open(m, n);
    const row = view.querySelector(`.ep[data-ep="${n}"]`);
    if (row) { row.classList.add('seen'); row.querySelector('.ep-check').setAttribute('aria-pressed', 'true'); }
  }));
  view.querySelectorAll('[data-check]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.check);
    const on = progress.toggle(m, n);
    b.setAttribute('aria-pressed', String(on));
    b.closest('.ep').classList.toggle('seen', on);
    toast(on ? `Episódio ${n} marcado como visto` : `Episódio ${n} desmarcado`);
  }));
  const all = $('#eps-all');
  if (all) all.onclick = () => { view.querySelectorAll('.ep[hidden]').forEach((e) => { e.hidden = false; }); all.remove(); };
  const sc = view.querySelector('[data-scroll]');
  if (sc) sc.onclick = (e) => { e.preventDefault(); $('#onde-assistir').scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const syn = $('#synopsis'), more = $('#syn-more');
  if (syn && more) {
    if (syn.scrollHeight <= syn.clientHeight + 4) more.hidden = true;
    more.onclick = () => { const c = syn.classList.toggle('clamped'); more.textContent = c ? 'Ler mais' : 'Ler menos'; };
  }
  const play = $('#trailer-play');
  if (play && isNativeApp) {
    // no aplicativo Android o trailer abre no player do YouTube dentro do app (o embed não funciona bem em WebView)
    const url = m.trailer.site === 'youtube'
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(m.trailer.id)}`
      : `https://www.dailymotion.com/video/${encodeURIComponent(m.trailer.id)}`;
    const a = document.createElement('a');
    a.className = play.className; a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.dataset.inside = '';
    a.setAttribute('aria-label', 'Assistir trailer'); a.style.cssText = play.style.cssText;
    play.replaceWith(a);
  } else if (play) play.onclick = () => {
    const src = m.trailer.site === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(m.trailer.id)}?autoplay=1&rel=0`
      : `https://www.dailymotion.com/embed/video/${encodeURIComponent(m.trailer.id)}?autoplay=1`;
    play.outerHTML = `<iframe src="${src}" title="Trailer de ${esc(titleOf(m))}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  };
}

/* ---------- Minha lista (tela) ---------- */
let listTab = 'all';
function renderList() {
  const view = $('#view-list');
  const items = Object.values(myList.all()).sort((a, b) => b.addedAt - a.addedAt);
  const counts = { all: items.length };
  for (const k of Object.keys(LIST_STATUS)) counts[k] = items.filter((i) => i.status === k).length;
  const shown = listTab === 'all' ? items : items.filter((i) => i.status === listTab);
  const tabs = { all: 'Todos', ...LIST_STATUS };

  view.innerHTML = `<div class="wrap">
    <div class="explore-head"><h1>Minha lista</h1><p>Fica salva neste aparelho. Abra um anime e escolha um status para adicioná-lo.</p></div>
    <div class="tabs" role="tablist">${Object.entries(tabs).map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === listTab}">${l}<span class="n">${counts[k]}</span></button>`).join('')}</div>
    ${shown.length ? `<div class="grid">${shown.map(cardHTML).join('')}</div>`
      : `<div class="empty"><strong>${items.length ? 'Nada nesta aba ainda' : 'Sua lista está vazia'}</strong>
        Abra qualquer anime e use o campo "Minha lista" para marcar como Assistindo, Quero ver ou Concluído.<br><br>
        <a class="btn small primary" href="#/explorar">Explorar animes</a></div>`}
  </div>`;
  view.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { listTab = b.dataset.tab; renderList(); }; });
}

/* ---------- Player (vídeos do aparelho ou link direto) ---------- */
const player = { ready: false, queue: [], index: -1, key: '', objectUrl: '', subUrl: '' };
const fmtTime = (t) => {
  const s = Math.max(0, Math.floor(t || 0)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(r).padStart(2, '0');
};
const resume = {
  all() { return store.get('aniverso:resume', {}); },
  get(k) { return this.all()[k]; },
  set(k, v) {
    const all = this.all();
    all[k] = v;
    // guarda só os 200 mais recentes
    const keys = Object.keys(all).sort((a, b) => all[b].t - all[a].t);
    for (const old of keys.slice(200)) delete all[old];
    store.set('aniverso:resume', all);
  },
};

function srtToVtt(text) {
  return 'WEBVTT\n\n' + text.replace(/\r/g, '').replace(/^\d+\n(?=\d{2}:\d{2})/gm, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

function renderPlayer() {
  const view = $('#view-player');
  if (player.ready) return;
  player.ready = true;
  view.innerHTML = `<div class="wrap">
    <div class="explore-head"><h1>Player</h1>
      <p>Assista vídeos que estão no seu aparelho ou um link direto de vídeo. O app lembra onde você parou.</p></div>
    <div class="player-layout">
      <div class="player-main">
        <div class="player-shell">
          <video id="pv" controls playsinline preload="metadata"></video>
          <div class="pv-empty" id="pv-empty"><strong>Nenhum vídeo aberto</strong>Escolha um vídeo do aparelho ou cole um link ao lado.</div>
        </div>
        <div class="pv-title" id="pv-title"></div>
        <div class="btns pv-tools">
          <button class="btn small" type="button" data-seek="-10">⟲ 10s</button>
          <button class="btn small" type="button" data-seek="10">10s ⟳</button>
          <button class="btn small" type="button" data-seek="85" title="A abertura de um anime dura cerca de 1min30">Pular abertura</button>
          <label class="pv-speed"><span>Velocidade</span>
            <select id="pv-speed">${['0.75', '1', '1.25', '1.5', '2'].map((v) => `<option value="${v}"${v === '1' ? ' selected' : ''}>${v.replace('.', ',')}×</option>`).join('')}</select></label>
          <button class="btn small" type="button" id="pv-next" disabled>Próximo ▶▶</button>
        </div>
      </div>
      <aside class="player-side">
        <div class="panel">
          <h3>Abrir vídeo</h3>
          <div class="btns">
            <label class="btn primary" for="pv-file">Escolher vídeos do aparelho</label>
            <label class="btn" for="pv-sub">Adicionar legenda (.srt / .vtt)</label>
          </div>
          <input id="pv-file" type="file" accept="video/*,.mkv,.mp4,.webm,.m4v" multiple hidden>
          <input id="pv-sub" type="file" accept=".srt,.vtt,text/vtt" hidden>
          <form id="pv-url-form" class="pv-url">
            <label class="field"><span class="eyebrow" style="color:var(--muted)">Ou cole um link direto</span>
              <input id="pv-url" type="url" inputmode="url" placeholder="https://…/video.mp4 ou .m3u8" autocomplete="off"></label>
            <button class="btn" type="submit">Tocar link</button>
          </form>
          <p class="note">Funciona com MP4, WebM, MKV (na maioria dos aparelhos) e M3U8. Os vídeos não são enviados para lugar nenhum; tocam direto do aparelho.</p>
        </div>
        <div class="panel" id="pv-queue-panel" hidden>
          <h3>Fila</h3>
          <ol class="queue" id="pv-queue"></ol>
        </div>
      </aside>
    </div>
  </div>`;

  const video = $('#pv');
  let lastSave = 0;
  const savePos = (force) => {
    if (!player.key || !video.duration) return;
    const now = Date.now();
    if (!force && now - lastSave < 4000) return;
    lastSave = now;
    resume.set(player.key, { pos: video.currentTime, dur: video.duration, name: player.queue[player.index]?.name || '', t: now });
  };
  video.addEventListener('timeupdate', () => savePos(false));
  video.addEventListener('pause', () => savePos(true));
  video.addEventListener('loadedmetadata', () => {
    const r = resume.get(player.key);
    if (r && r.pos > 10 && r.pos < video.duration - 30) {
      video.currentTime = r.pos;
      toast(`Continuando de ${fmtTime(r.pos)}`);
    }
    video.playbackRate = Number($('#pv-speed').value);
  });
  video.addEventListener('ended', () => {
    resume.set(player.key, { pos: 0, dur: video.duration, name: player.queue[player.index]?.name || '', t: Date.now() });
    if (player.index < player.queue.length - 1) playItem(player.index + 1);
  });
  video.addEventListener('error', () => {
    if (video.getAttribute('src')) toast('Não foi possível tocar este vídeo. O formato pode não ser compatível com o aparelho.');
  });
  // em tela cheia, tenta virar para paisagem
  document.addEventListener('fullscreenchange', () => {
    try {
      if (document.fullscreenElement) screen.orientation?.lock?.('landscape').catch(() => {});
      else screen.orientation?.unlock?.();
    } catch { /* aparelho não permite girar */ }
  });

  view.querySelectorAll('[data-seek]').forEach((b) => b.addEventListener('click', () => {
    if (!video.duration) return;
    video.currentTime = Math.min(video.duration - 1, Math.max(0, video.currentTime + Number(b.dataset.seek)));
  }));
  $('#pv-speed').addEventListener('change', (e) => { video.playbackRate = Number(e.target.value); });
  $('#pv-next').addEventListener('click', () => playItem(player.index + 1));

  $('#pv-file').addEventListener('change', (e) => {
    const files = [...e.target.files].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    if (!files.length) return;
    const start = player.queue.length;
    player.queue.push(...files.map((f) => ({ name: f.name, file: f, key: `file:${f.name}:${f.size}` })));
    renderQueue();
    playItem(start);
    e.target.value = '';
  });
  $('#pv-sub').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!video.getAttribute('src')) { toast('Abra um vídeo antes de adicionar a legenda.'); return; }
    const text = await f.text();
    const vtt = /^﻿?WEBVTT/.test(text) ? text : srtToVtt(text);
    if (player.subUrl) URL.revokeObjectURL(player.subUrl);
    player.subUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
    video.querySelectorAll('track').forEach((t) => t.remove());
    const track = document.createElement('track');
    Object.assign(track, { kind: 'subtitles', label: 'Legenda', srclang: 'pt', src: player.subUrl, default: true });
    video.appendChild(track);
    track.track.mode = 'showing';
    toast('Legenda adicionada');
  });
  $('#pv-url-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = $('#pv-url').value.trim();
    if (!/^https?:\/\//i.test(url)) { toast('Cole um link que comece com http:// ou https://'); return; }
    let name = url;
    try { name = decodeURIComponent(new URL(url).pathname.split('/').pop()) || url; } catch { /* link sem nome */ }
    player.queue.push({ name, url, key: `url:${url}` });
    renderQueue();
    playItem(player.queue.length - 1);
    $('#pv-url').value = '';
  });
}

function playItem(i) {
  const item = player.queue[i];
  if (!item) return;
  const video = $('#pv');
  if (player.objectUrl) { URL.revokeObjectURL(player.objectUrl); player.objectUrl = ''; }
  video.querySelectorAll('track').forEach((t) => t.remove());
  player.index = i;
  player.key = item.key;
  const src = item.file ? (player.objectUrl = URL.createObjectURL(item.file)) : item.url;
  video.src = src;
  $('#pv-empty').hidden = true;
  $('#pv-title').textContent = item.name;
  $('#pv-next').disabled = i >= player.queue.length - 1;
  renderQueue();
  video.play().catch(() => { /* o usuário aperta play */ });
}

function renderQueue() {
  const panel = $('#pv-queue-panel');
  panel.hidden = !player.queue.length;
  $('#pv-queue').innerHTML = player.queue.map((q, i) => {
    const r = resume.get(q.key);
    const pct = r?.dur ? Math.round((r.pos / r.dur) * 100) : 0;
    return `<li><button type="button" data-q="${i}" aria-current="${i === player.index}">
      <span class="q-name">${esc(q.name)}</span>${pct ? `<span class="q-pct">${pct}% visto</span>` : ''}</button></li>`;
  }).join('');
  panel.querySelectorAll('[data-q]').forEach((b) => { b.onclick = () => playItem(Number(b.dataset.q)); });
  $('#pv-next').disabled = player.index >= player.queue.length - 1;
}

/* ---------- rotas ---------- */
const scrollPos = {};
let currentView = null;
function route() {
  const hash = location.hash || '#/';
  const [path, qs = ''] = hash.slice(1).split('?');
  let name = 'home';
  if (path.startsWith('/explorar')) name = 'explore';
  else if (path.startsWith('/lista')) name = 'list';
  else if (path.startsWith('/anime/')) name = 'anime';
  else if (path.startsWith('/player')) name = 'player';

  if (currentView) scrollPos[currentView] = scrollY;
  const prev = currentView;
  currentView = name;
  for (const v of ['home', 'explore', 'list', 'anime', 'player']) $(`#view-${v}`).hidden = v !== name;
  if (name !== 'player') $('#pv')?.pause();
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  if (name !== 'anime') document.title = 'AniVerso';

  if (name === 'home') { renderHome(); renderContinueRow(); }
  if (name === 'player') renderPlayer();
  if (name === 'explore') renderExplore(qs);
  if (name === 'list') renderList();
  if (name === 'anime') renderAnime(path.split('/')[2]);

  const keep = name !== 'anime' && prev !== name && scrollPos[name] != null;
  requestAnimationFrame(() => scrollTo(0, keep ? scrollPos[name] : 0));

  const qi = $('#quicksearch-input');
  if (name !== 'explore' && document.activeElement !== qi) qi.value = '';
}

$('#quicksearch').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#quicksearch-input').value.trim();
  location.hash = exploreHash({ ...readExploreParams(''), q });
  $('#quicksearch-input').blur();
});

window.addEventListener('hashchange', route);

// botão "voltar" do Android: sai da tela cheia, volta uma tela ou fecha o app na tela inicial
if (isNativeApp) {
  try {
    window.Capacitor.nativeCallback('App', 'addListener', { eventName: 'backButton' }, (data) => {
      if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
      if (data?.canGoBack) history.back();
      else window.Capacitor.nativePromise('App', 'exitApp').catch(() => {});
    });
  } catch { /* sem plugin App: o Android usa o comportamento padrão */ }
}
route();

if (!isNativeApp && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
