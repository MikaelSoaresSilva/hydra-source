// Gera o APK expandido do Backend Mastery AI.
//
// Uso:
//   node backend-mastery/build.mjs <apk-original> [--out caminho.apk] [--build-tools pasta] [--check]
//
// Passos:
//   1. extrai o APK original e lê as aulas que já existem no bundle JS;
//   2. carrega o conteúdo novo de backend-mastery/content/*.cjs;
//   3. VALIDA tudo (ids únicos, ≥10 exercícios por aula, soluções de código
//      passando nos testes, saídas de "preveja a saída" conferidas executando o código);
//   4. gera assets/public/bma-extra.js e faz dois pequenos "ganchos" no bundle;
//   5. reempacota, alinha (zipalign) e assina (apksigner).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const MIN_EXERCISES = 10;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const withValue = ['--out', '--build-tools', '--keystore'];
const apkIn = args.find((a, i) => !a.startsWith('--') && !withValue.includes(args[i - 1]));
const checkOnly = args.includes('--check');
const apkOut = opt('--out', path.join(HERE, 'dist', 'BackendMastery-expandido.apk'));
const buildTools = opt('--build-tools', process.env.ANDROID_BUILD_TOOLS || '');
const keystore = opt('--keystore', path.join(HERE, 'signing', 'backend-mastery.keystore'));
if (!apkIn) {
  console.error('informe o APK original');
  process.exit(1);
}

// ---------- 1. extrair ----------
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'bma-'));
const ex = path.join(work, 'x');
execFileSync('unzip', ['-q', apkIn, '-d', ex]);
const pub = path.join(ex, 'assets', 'public');
const bundleName = fs.readdirSync(path.join(pub, 'assets')).find((f) => /^index-.*\.js$/.test(f));
const bundlePath = path.join(pub, 'assets', bundleName);
let bundle = fs.readFileSync(bundlePath, 'utf8');

// Lê as aulas originais avaliando os três arrays literais (nh, rh, ah).
function sliceArray(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('marcador não encontrado: ' + marker);
  let i = start + marker.length - 1; // posição do "["
  let depth = 0;
  let str = null;
  let tpl = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (str) {
      if (ch === '\\') { i++; continue; }
      if (ch === str) str = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === '[' || ch === '{' || ch === '(') depth++;
    if (ch === ']' || ch === '}' || ch === ')') {
      depth--;
      if (depth === 0) return src.slice(start + marker.length - 1, i + 1);
    }
  }
  throw new Error('array não terminou: ' + marker);
}
const Ge = 'https://developer.mozilla.org/pt-BR/docs/Web/JavaScript'; // usado dentro das aulas originais
const original = [];
for (const m of ['nh=[', 'rh=[', 'ah=[']) original.push(...eval('(' + sliceArray(bundle, m) + ')'));
void Ge;

// ---------- 2. conteúdo novo ----------
const contentDir = path.join(HERE, 'content');
const extras = {};
const newLessons = [];
const competencies = [];
for (const f of fs.readdirSync(contentDir).filter((f) => f.endsWith('.cjs')).sort()) {
  const mod = require(path.join(contentDir, f));
  for (const [id, list] of Object.entries(mod.extras || {})) {
    extras[id] = (extras[id] || []).concat(list);
  }
  newLessons.push(...(mod.lessons || []));
  competencies.push(...(mod.competencies || []));
}

// ---------- 3. validar ----------
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

const allLessons = original.map((l) => ({ ...l, exercises: l.exercises.concat(extras[l.id] || []) }));
for (const id of Object.keys(extras)) if (!original.some((l) => l.id === id)) err(id, 'aula inexistente em extras');
const lessonIds = new Set(original.map((l) => l.id));
const compIds = new Set([...bundle.matchAll(/M\("([a-z0-9-]+)",/g)].map((m) => m[1]));
for (const c of competencies) {
  if (compIds.has(c.id)) err(c.id, 'competência duplicada');
  compIds.add(c.id);
  if (!(c.phase >= 1 && c.phase <= 10)) err(c.id, 'fase inválida');
}
for (const c of competencies) for (const p of c.prereqs) if (!compIds.has(p)) err(c.id, 'pré-requisito de competência inexistente: ' + p);
for (const l of newLessons) {
  if (lessonIds.has(l.id)) err(l.id, 'id de aula duplicado');
  lessonIds.add(l.id);
  allLessons.push(l);
}
for (const l of newLessons) {
  if (!lessonIds.has(l.after)) err(l.id, 'after aponta para aula inexistente: ' + l.after);
  for (const p of l.prereqs) if (!lessonIds.has(p)) err(l.id, 'pré-requisito inexistente: ' + p);
  for (const c of l.competencies) if (!compIds.has(c)) err(l.id, 'competência inexistente: ' + c);
  for (const k of ['title', 'goal', 'minutes', 'steps', 'simpler', 'otherWay', 'realExample', 'exercises', 'docs'])
    if (l[k] === undefined) err(l.id, 'campo faltando: ' + k);
}

const exIds = new Set();
const ERROR_KINDS = ['logica', 'sintaxe', 'conhecimento', 'interpretacao', 'ambiente'];
const toCheck = [];
for (const l of allLessons) {
  if (l.exercises.length < MIN_EXERCISES) err(l.id, `só ${l.exercises.length} exercícios`);
  for (const e of [...l.exercises, ...(l.transfer ? [l.transfer] : [])]) {
    const w = `${l.id}/${e.id}`;
    if (exIds.has(e.id)) err(w, 'id de exercício duplicado');
    exIds.add(e.id);
    if (!l.competencies.includes(e.competency)) err(w, 'competência fora da aula: ' + e.competency);
    if (!ERROR_KINDS.includes(e.errorKind)) err(w, 'errorKind inválido');
    if (!Array.isArray(e.hints) || !e.hints.length) err(w, 'sem dicas');
    if (!e.prompt || !e.solution || !e.explanation) err(w, 'prompt/solution/explanation faltando');
    if (e.type === 'mcq') {
      if (!Array.isArray(e.options) || e.options.length < 2) err(w, 'opções inválidas');
      else if (!(Number.isInteger(e.answer) && e.answer >= 0 && e.answer < e.options.length)) err(w, 'answer fora do intervalo');
      else if (new Set(e.options).size !== e.options.length) err(w, 'opções repetidas');
    } else if (e.type === 'predict') {
      if (typeof e.expected !== 'string' || !e.code) err(w, 'predict sem code/expected');
    } else if (e.type === 'explain') {
      if (!Array.isArray(e.keywords) || !e.keywords.length) err(w, 'explain sem keywords');
    } else if (e.type === 'code') {
      if (!Array.isArray(e.tests) || !e.tests.length || typeof e.starter !== 'string') err(w, 'code sem tests/starter');
    } else err(w, 'tipo desconhecido: ' + e.type);
    if (extras[l.id]?.includes(e) || newLessons.includes(l)) toCheck.push([w, e]);
  }
}

// Mesmo algoritmo do app (worker de execução + comparação profunda).
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEq(a[k], b[k]));
}
async function runCode(code, tests) {
  const logs = [];
  // Igual ao formatador do console do app.
  const fmt = (v) => {
    if (typeof v === 'string') return v;
    if (v === undefined) return 'undefined';
    if (typeof v === 'function') return '[Function]';
    if (typeof v === 'number' || typeof v === 'boolean' || v === null) return String(v);
    if (v instanceof Error) return v.name + ': ' + v.message;
    try { return JSON.stringify(v); } catch { return String(v); }
  };
  const con = { log: (...a) => logs.push(a.map(fmt).join(' ')), info: (...a) => logs.push(a.map(fmt).join(' ')), warn: (...a) => logs.push('⚠ ' + a.map(fmt).join(' ')), error: (...a) => logs.push('✖ ' + a.map(fmt).join(' ')), table: () => {} };
  let pending = 0;
  const st = (fn, ms, ...rest) => { pending++; return setTimeout(() => { pending--; try { fn(...rest); } catch (e) { logs.push('✖ ' + e.message); } }, ms); };
  const ct = (h) => { clearTimeout(h); pending = Math.max(0, pending - 1); };
  let results = [];
  let error = null;
  try {
    const fn = new Function('console', '__logs', '__code', '__tests', 'setTimeout', 'clearTimeout', 'setInterval', code +
      '\n;return __tests.map(function (__c) { try { return { ok: true, v: eval(__c) }; } catch (__e) { return { ok: false, err: (__e && __e.name) + ": " + (__e && __e.message) }; } });');
    results = fn(con, logs, code, tests.map((t) => t.call), st, ct, () => { throw new Error('setInterval'); });
  } catch (e) {
    error = e;
  }
  const out = [];
  for (const r of results) {
    if (!r.ok) { out.push({ ok: false, err: r.err }); continue; }
    try {
      const v = r.v && typeof r.v.then === 'function' ? await r.v : r.v;
      out.push({ ok: true, v: v === undefined ? undefined : JSON.parse(JSON.stringify(v) ?? 'null') });
    } catch (e) {
      out.push({ ok: false, err: e.message });
    }
  }
  const t0 = Date.now();
  while (pending > 0 && Date.now() - t0 < 2500) await new Promise((r) => setTimeout(r, 15));
  const pass = tests.map((t, i) => !error && out[i] && out[i].ok && deepEq(out[i].v, t.expect));
  return { logs, error, pass, out };
}
const normLine = (s) => { let t = s.trim().replace(/\s+/g, ' '); if (/^(['"]).*\1$/.test(t)) t = t.slice(1, -1); return t.toLowerCase(); };
const normOut = (s) => s.replace(/\r/g, '').split('\n').map(normLine).filter((x) => x !== '');
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

for (const [w, e] of toCheck) {
  if (e.type === 'code') {
    const good = await runCode(e.solution, e.tests);
    if (good.error || good.pass.some((p) => !p)) err(w, 'SOLUÇÃO NÃO PASSA: ' + (good.error ? good.error.message : JSON.stringify(good.out.map((o, i) => (good.pass[i] ? 'ok' : o)))));
    const bad = await runCode(e.starter, e.tests);
    if (!bad.error && bad.pass.every(Boolean)) err(w, 'o código inicial já passa em todos os testes');
  } else if (e.type === 'predict' && e.run) {
    const r = await runCode(e.code, []);
    const a = normOut(r.logs.join('\n'));
    const b = normOut(e.expected);
    if (r.error || a.length !== b.length || a.some((x, i) => x !== b[i])) err(w, `saída real ${JSON.stringify(r.logs)} ≠ esperada ${JSON.stringify(e.expected)}`);
  } else if (e.type === 'explain') {
    const sol = fold(e.solution);
    const hit = e.keywords.filter((g) => g.some((k) => sol.includes(fold(k)))).length;
    if (hit < (e.minGroups ?? Math.max(1, e.keywords.length - 1))) err(w, 'a resposta-exemplo não passa na correção por palavras-chave');
  }
}

const total = allLessons.reduce((s, l) => s + l.exercises.length + (l.transfer ? 1 : 0), 0);
console.log(`aulas: ${allLessons.length} (${newLessons.length} novas) · exercícios: ${total} · competências novas: ${competencies.length}`);
console.log(`mínimo por aula: ${Math.min(...allLessons.map((l) => l.exercises.length))}`);
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problema(s) — APK não gerado.`);
  process.exit(1);
}
console.log('validação OK: todas as soluções de código passam, todas as saídas conferem.');
if (checkOnly) process.exit(0);

// ---------- 4. gerar e aplicar o patch ----------
const payload = { extras, lessons: newLessons, competencies };
const extraJs = `// Gerado por backend-mastery/build.mjs — conteúdo extra (exercícios e aulas de backend).
window.__BMA_EXTRA__=${JSON.stringify(payload)};
window.__bmaMerge=function(qe){var X=window.__BMA_EXTRA__;if(!X)return qe;
qe.forEach(function(l){var a=X.extras[l.id];if(a)l.exercises=l.exercises.concat(a);});
X.lessons.forEach(function(nl){var i=-1;for(var k=0;k<qe.length;k++)if(qe[k].id===nl.after)i=k;
if(i<0){for(var j=0;j<qe.length;j++)if(qe[j].phase<=nl.phase)i=j;}qe.splice(i+1,0,nl);});return qe;};
`;
fs.writeFileSync(path.join(pub, 'bma-extra.js'), extraJs);

function replaceOnce(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`gancho encontrado ${n} vezes: ${from}`);
  return src.replace(from, to);
}
bundle = replaceOnce(bundle, 'qe=[...nh,...rh,...ah]', 'qe=(window.__bmaMerge||(x=>x))([...nh,...rh,...ah])');
bundle = replaceOnce(bundle, '],Vt=Object.fromEntries(An.map(',
  '].concat(((window.__BMA_EXTRA__||{}).competencies||[]).map(c=>M(c.id,c.name,c.phase,c.weight,c.prereqs,c.why))),Vt=Object.fromEntries(An.map(');
bundle = replaceOnce(bundle, 'Backend Mastery AI v0.1.0', 'Backend Mastery AI v0.2.0 (edição expandida)');
fs.writeFileSync(bundlePath, bundle);

const indexPath = path.join(pub, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = replaceOnce(html, '<script type="module"', '<script src="./bma-extra.js"></script>\n    <script type="module"');
fs.writeFileSync(indexPath, html);
// O service worker guarda cache da versão antiga na versão web; troca o nome do cache.
const swPath = path.join(pub, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace("const CACHE = 'bma-v1'", "const CACHE = 'bma-v2'"));

// ---------- 5. reempacotar e assinar ----------
fs.rmSync(path.join(ex, 'META-INF', 'CERT.SF'), { force: true });
fs.rmSync(path.join(ex, 'META-INF', 'CERT.RSA'), { force: true });
fs.rmSync(path.join(ex, 'META-INF', 'MANIFEST.MF'), { force: true });
const unsigned = path.join(work, 'unsigned.apk');
// resources.arsc e .so precisam ficar sem compressão (stored) para o Android instalar.
const stored = [];
const deflated = [];
for (const f of execFileSync('find', ['.', '-type', 'f'], { cwd: ex, encoding: 'utf8' }).trim().split('\n').map((p) => p.slice(2))) {
  (f === 'resources.arsc' || f.endsWith('.so') || /\.(png|jpg|webp)$/.test(f) ? stored : deflated).push(f);
}
execFileSync('zip', ['-q', '-X', '-D', '-0', unsigned, ...stored], { cwd: ex });
execFileSync('zip', ['-q', '-X', '-D', '-9', unsigned, ...deflated], { cwd: ex });
const tool = (n) => (buildTools ? path.join(buildTools, n) : n);
const aligned = path.join(work, 'aligned.apk');
execFileSync(tool('zipalign'), ['-p', '-f', '4', unsigned, aligned]);
if (!fs.existsSync(keystore)) {
  fs.mkdirSync(path.dirname(keystore), { recursive: true });
  execFileSync('keytool', ['-genkeypair', '-keystore', keystore, '-storepass', 'backendmastery', '-keypass', 'backendmastery', '-alias', 'bma',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Backend Mastery AI, O=Uso pessoal, C=BR'], { stdio: 'ignore' });
}
fs.mkdirSync(path.dirname(apkOut), { recursive: true });
execFileSync(tool('apksigner'), ['sign', '--ks', keystore, '--ks-pass', 'pass:backendmastery', '--ks-key-alias', 'bma', '--out', apkOut, aligned]);
execFileSync(tool('apksigner'), ['verify', apkOut]);
fs.rmSync(work, { recursive: true, force: true });
console.log('APK gerado e assinado: ' + apkOut);
