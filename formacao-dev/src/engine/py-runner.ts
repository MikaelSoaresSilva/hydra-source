// Executa Python no próprio aparelho (offline) com o interpretador Skulpt.
// Os arquivos do Skulpt ficam em public/vendor e só são carregados quando necessários.

import type { TestResult } from './js-runner';

declare global { interface Window { Sk: any } }

let loading: Promise<void> | null = null;
function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('Falha ao carregar ' + src));
    document.head.appendChild(s);
  });
}
export function loadSkulpt() {
  if (!loading) loading = loadScript('vendor/skulpt.min.js').then(() => loadScript('vendor/skulpt-stdlib.js'));
  return loading;
}

const MARK = '\u241eT';

export interface PyResult { stdout: string; error?: string; tests?: TestResult[] }

export async function runPython(code: string, tests?: { call: string; expect: string; desc: string }[], timeoutMs = 5000): Promise<PyResult> {
  await loadSkulpt();
  const Sk = window.Sk;
  let out = '';
  Sk.configure({
    output: (t: string) => { out += t; },
    read: (f: string) => { if (Sk.builtinFiles?.files[f] === undefined) throw new Error("Arquivo não encontrado: '" + f + "'"); return Sk.builtinFiles.files[f]; },
    __future__: Sk.python3,
    execLimit: timeoutMs,
    yieldLimit: 100,
    inputfun: () => '',
    inputfunTakesPrompt: true,
  });
  let full = code;
  if (tests?.length) {
    full += '\n\n' + tests.map((t, i) => `try:\n    print("${MARK}${i}:" + str(${t.call}))\nexcept Exception as __e:\n    print("${MARK}${i}!" + type(__e).__name__ + ": " + str(__e))`).join('\n');
  }
  let error: string | undefined;
  try {
    await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<stdin>', false, full, true));
  } catch (e: any) {
    error = e?.toString?.() ?? String(e);
    if (/TimeLimitError/.test(error!)) error = 'Tempo esgotado: o programa demorou demais. Provavelmente há um laço infinito.';
  }
  const lines = out.split('\n');
  const user: string[] = [];
  const got: Record<number, { ok: boolean; v: string }> = {};
  for (const ln of lines) {
    if (ln.startsWith(MARK)) {
      const m = ln.slice(MARK.length).match(/^(\d+)([:!])([\s\S]*)$/);
      if (m) got[+m[1]] = { ok: m[2] === ':', v: m[3] };
    } else user.push(ln);
  }
  const stdout = user.join('\n').replace(/\n+$/, '');
  const results = tests?.map((t, i) => {
    const g = got[i];
    if (!g) return { desc: t.desc, pass: false, got: '', error: error ?? 'não executado' };
    if (!g.ok) return { desc: t.desc, pass: false, got: '', error: g.v };
    return { desc: t.desc, pass: g.v.trim() === t.expect.trim(), got: g.v };
  });
  return { stdout, error, tests: results };
}

export function explainPyError(msg: string): string | null {
  const rules: [RegExp, string][] = [
    [/NameError: name '(\w+)' is not defined/, 'O nome "$1" não existe. Confira se criou a variável/função antes de usar e se escreveu igual (maiúsculas contam).'],
    [/IndentationError|unexpected indent|expected an indented block/, 'Problema de indentação: em Python os espaços no início da linha definem os blocos. Use 4 espaços dentro de if/for/def.'],
    [/SyntaxError/, 'Erro de escrita: confira dois-pontos (:) no fim de if/for/def/else, parênteses e aspas.'],
    [/TypeError: cannot concatenate|unsupported operand type|must be str, not int|can only concatenate/, 'Você misturou texto com número. Converta com str(numero) ou int(texto).'],
    [/IndexError/, 'Você tentou acessar uma posição da lista que não existe. Lembre: a primeira posição é 0.'],
    [/KeyError/, 'Essa chave não existe no dicionário. Use dicionario.get("chave") para evitar o erro.'],
    [/ZeroDivisionError/, 'Divisão por zero! Confira se o divisor pode ser 0 (ex.: lista vazia).'],
    [/Tempo esgotado/, 'Confira a condição do seu while: ela precisa ficar falsa em algum momento.'],
  ];
  for (const [re, txt] of rules) { const m = msg.match(re); if (m) return txt.replace('$1', m[1] ?? ''); }
  return null;
}
