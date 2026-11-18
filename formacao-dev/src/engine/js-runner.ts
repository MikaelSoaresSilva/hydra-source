// Executa JavaScript do aluno num Web Worker isolado, com limite de tempo
// (laços infinitos não travam o app) e captura do console.log.

export interface TestSpec { call: string; expect: unknown; desc: string }
export interface TestResult { desc: string; pass: boolean; got: string; error?: string }
export interface RunResult { logs: string[]; error?: string; tests?: TestResult[]; timedOut?: boolean }

const WORKER_SRC = `
const inspect = (v, depth = 0, top = true) => {
  if (typeof v === 'string') return top ? v : "'" + v + "'";
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'function') return '[Function: ' + (v.name || '(anônima)') + ']';
  if (typeof v === 'symbol') return v.toString();
  if (v instanceof Error) return v.name + ': ' + v.message;
  if (v instanceof Promise) return 'Promise { <pending> }';
  if (depth > 3) return Array.isArray(v) ? '[Array]' : '[Object]';
  if (Array.isArray(v)) return v.length ? '[ ' + v.map(x => inspect(x, depth + 1, false)).join(', ') + ' ]' : '[]';
  if (v instanceof Map) return 'Map(' + v.size + ') {' + (v.size ? ' ' + [...v].map(([k, x]) => inspect(k, depth + 1, false) + ' => ' + inspect(x, depth + 1, false)).join(', ') + ' ' : '') + '}';
  if (v instanceof Set) return 'Set(' + v.size + ') {' + (v.size ? ' ' + [...v].map(x => inspect(x, depth + 1, false)).join(', ') + ' ' : '') + '}';
  if (v instanceof Date) return v.toISOString();
  const keys = Object.keys(v);
  const name = v.constructor && v.constructor !== Object && v.constructor.name ? v.constructor.name + ' ' : '';
  if (!keys.length) return name + '{}';
  return name + '{ ' + keys.map(k => (/^[A-Za-z_$][\\w$]*$/.test(k) ? k : "'" + k + "'") + ': ' + inspect(v[k], depth + 1, false)).join(', ') + ' }';
};
const eq = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9 || (Number.isNaN(a) && Number.isNaN(b));
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => eq(a[k], b[k]));
};
self.onmessage = async (e) => {
  const { code, tests } = e.data;
  const logs = [];
  const out = (...a) => logs.push(a.map(x => inspect(x)).join(' '));
  const con = { log: out, info: out, warn: out, error: out, table: out, debug: out };
  let pending = 0;
  const _st = self.setTimeout.bind(self), _ct = self.clearTimeout.bind(self), _si = self.setInterval.bind(self), _ci = self.clearInterval.bind(self);
  const timers = new Set();
  const sT = (fn, ms, ...args) => { pending++; const id = _st(() => { pending--; timers.delete(id); try { fn(...args); } catch (err) { logs.push('Uncaught ' + inspect(err)); } }, ms); timers.add(id); return id; };
  const cT = (id) => { if (timers.has(id)) { pending--; timers.delete(id); } _ct(id); };
  const intervals = new Set();
  const sI = (fn, ms, ...args) => { const id = _si(() => { try { fn(...args); } catch (err) { logs.push('Uncaught ' + inspect(err)); } }, ms); intervals.add(id); return id; };
  const cI = (id) => { intervals.delete(id); _ci(id); };
  const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
  const testCode = (tests || []).map((t, i) => 'try { __r[' + i + '] = { ok: true, v: await (' + t.call + ') }; } catch (__e) { __r[' + i + '] = { ok: false, e: (__e && __e.message) || String(__e) }; }').join('\\n');
  let fn;
  try {
    fn = new AsyncFn('console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', '__code', code + '\\n;const __r = [];\\n' + testCode + '\\nreturn __r;');
  } catch (err) {
    self.postMessage({ logs, error: (err && err.name ? err.name + ': ' : '') + (err && err.message || String(err)) });
    return;
  }
  let error, r = [];
  try { r = await fn(con, sT, cT, sI, cI, code); } catch (err) { error = inspect(err); }
  const t0 = Date.now();
  while ((pending > 0) && Date.now() - t0 < 2500) await new Promise(res => _st(res, 20));
  intervals.forEach(id => _ci(id));
  const results = (tests || []).map((t, i) => {
    const x = r[i];
    if (!x) return { desc: t.desc, pass: false, got: '', error: error || 'não executado' };
    if (!x.ok) return { desc: t.desc, pass: false, got: '', error: x.e };
    return { desc: t.desc, pass: eq(x.v, t.expect), got: inspect(x.v, 0, false) };
  });
  self.postMessage({ logs, error, tests: tests ? results : undefined });
};
`;

let workerUrl: string | null = null;

export function runJs(code: string, tests?: TestSpec[], timeoutMs = 4000): Promise<RunResult> {
  if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
  return new Promise((resolve) => {
    const w = new Worker(workerUrl!);
    const timer = setTimeout(() => {
      w.terminate();
      resolve({ logs: [], timedOut: true, error: 'Tempo esgotado: o código demorou mais de ' + timeoutMs / 1000 + ' s. Provavelmente há um laço infinito (um while/for que nunca termina).', tests: tests?.map((t) => ({ desc: t.desc, pass: false, got: '', error: 'tempo esgotado' })) });
    }, timeoutMs);
    w.onmessage = (e) => { clearTimeout(timer); w.terminate(); resolve(e.data as RunResult); };
    w.onerror = (e) => { clearTimeout(timer); w.terminate(); resolve({ logs: [], error: e.message }); };
    w.postMessage({ code, tests });
  });
}

/** Traduz mensagens de erro comuns do JavaScript para português simples. */
export function explainJsError(msg: string): string | null {
  const rules: [RegExp, string][] = [
    [/(\w+) is not defined/, 'O nome "$1" não existe neste ponto do código. Confira se você criou a variável/função com esse nome exato (maiúsculas contam!) e antes de usá-la.'],
    [/Unexpected token|Unexpected end of input|missing \) after|Invalid or unexpected token/, 'Erro de escrita (sintaxe): falta ou sobra algum símbolo — parênteses ( ), chaves { }, aspas ou vírgula. Confira se tudo que abre também fecha.'],
    [/Assignment to constant variable/, 'Você tentou mudar uma variável criada com const. Use let se o valor precisa mudar.'],
    [/Cannot read propert(y|ies) of (undefined|null)/, 'Você tentou ler algo de um valor vazio (undefined/null). Provavelmente a variável não tem o valor que você imagina — use console.log para conferir.'],
    [/is not a function/, 'Você tentou chamar com () algo que não é uma função. Confira o nome e se ela foi criada.'],
    [/has already been declared/, 'Você criou duas variáveis com o mesmo nome. Use outro nome ou remova o let/const da segunda vez.'],
    [/Maximum call stack size exceeded/, 'Uma função está chamando a si mesma sem parar (recursão infinita). Falta uma condição de parada.'],
    [/await is only valid/, 'await só pode ser usado dentro de uma função async.'],
    [/Tempo esgotado/, 'Confira a condição do seu laço: ela precisa ficar falsa em algum momento.'],
  ];
  for (const [re, txt] of rules) { const m = msg.match(re); if (m) return txt.replace('$1', m[1] ?? ''); }
  return null;
}
