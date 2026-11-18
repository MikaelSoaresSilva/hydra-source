import { useRef, useState } from 'preact/hooks';
import { runJs, explainJsError, type RunResult } from '../engine/js-runner';
import { runPython, explainPyError, type PyResult } from '../engine/py-runner';
import { runSql, explainSqlError, type SqlResult } from '../engine/sql-runner';
import { previewDoc } from '../engine/html-check';

const SYMBOLS: Record<string, string[]> = {
  js: ['{', '}', '(', ')', '[', ']', ';', '"', "'", '`', '=', '=>', '<', '>', '+', '.', ',', ':', '!', '&&', '||', '$'],
  py: [':', '(', ')', '[', ']', '{', '}', '"', "'", '=', '==', '<', '>', '+', '.', ',', '#', '_', 'f"'],
  sql: ['*', ',', '(', ')', "'", '=', '<', '>', ';', '.', 'SELECT ', 'FROM ', 'WHERE ', 'JOIN ', 'ON ', 'GROUP BY ', 'ORDER BY '],
  html: ['<', '>', '/', '"', '=', '{', '}', ':', ';', '#', '.', '(', ')'],
};

export function Editor({ value, onInput, lang = 'js', rows = 8 }: { value: string; onInput: (v: string) => void; lang?: string; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (t: string) => {
    const el = ref.current!; const s = el.selectionStart, e = el.selectionEnd;
    const v = el.value.slice(0, s) + t + el.value.slice(e);
    onInput(v);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + t.length; });
  };
  return (
    <div class="editor">
      <textarea ref={ref} class="code-input" value={value} rows={Math.max(rows, Math.min(18, value.split('\n').length + 1))}
        spellcheck={false} autocapitalize="off" autocomplete="off" {...{ autocorrect: 'off' }}
        onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
        onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); insert(lang === 'py' ? '    ' : '  '); } }} />
      <div class="symbols" aria-label="Símbolos">
        {(SYMBOLS[lang] ?? SYMBOLS.js).map((s) => <button type="button" onClick={() => insert(s)}>{s.trim()}</button>)}
        <button type="button" onClick={() => insert(lang === 'py' ? '    ' : '  ')}>⇥</button>
      </div>
    </div>
  );
}

export function Output({ lines, error, hint }: { lines: string[]; error?: string; hint?: string | null }) {
  return (
    <div class="output" aria-live="polite">
      {lines.length === 0 && !error && <span class="muted">(nenhuma saída)</span>}
      {lines.map((l) => <div>{l}</div>)}
      {error && <div class="out-error">⚠ {error}</div>}
      {hint && <div class="out-hint">💡 {hint}</div>}
    </div>
  );
}

export function JsPlayground({ code: initial, editable = true }: { code: string; editable?: boolean }) {
  const [code, setCode] = useState(initial);
  const [res, setRes] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); setRes(await runJs(code)); setBusy(false); };
  return (
    <div class="playground">
      {editable ? <Editor value={code} onInput={setCode} /> : <pre class="code"><code>{code}</code></pre>}
      <div class="row gap">
        <button class="btn btn-run" onClick={run} disabled={busy}>{busy ? 'Executando…' : '▶ Executar'}</button>
        {code !== initial && <button class="btn btn-ghost btn-sm" onClick={() => { setCode(initial); setRes(null); }}>↺ Restaurar</button>}
      </div>
      {res && <Output lines={res.logs} error={res.error} hint={res.error ? explainJsError(res.error) : null} />}
    </div>
  );
}

export function PyPlayground({ code: initial }: { code: string }) {
  const [code, setCode] = useState(initial);
  const [res, setRes] = useState<PyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); try { setRes(await runPython(code)); } catch (e: any) { setRes({ stdout: '', error: String(e?.message ?? e) }); } setBusy(false); };
  return (
    <div class="playground">
      <Editor value={code} onInput={setCode} lang="py" />
      <div class="row gap">
        <button class="btn btn-run" onClick={run} disabled={busy}>{busy ? 'Executando…' : '▶ Executar Python'}</button>
        {code !== initial && <button class="btn btn-ghost btn-sm" onClick={() => { setCode(initial); setRes(null); }}>↺ Restaurar</button>}
      </div>
      {res && <Output lines={res.stdout ? res.stdout.split('\n') : []} error={res.error} hint={res.error ? explainPyError(res.error) : null} />}
    </div>
  );
}

export function SqlTable({ res }: { res: SqlResult }) {
  if (res.error) return <Output lines={[]} error={res.error} hint={explainSqlError(res.error)} />;
  if (!res.columns.length) return <div class="output">Comando executado. {res.changes ? res.changes + ' linha(s) alterada(s).' : ''}</div>;
  return (
    <div class="table-wrap"><table class="sql-table">
      <thead><tr>{res.columns.map((c) => <th>{c}</th>)}</tr></thead>
      <tbody>{res.rows.map((r) => <tr>{r.map((c) => <td>{c === null ? 'NULL' : typeof c === 'number' ? String(Math.round(c * 100) / 100) : c}</td>)}</tr>)}</tbody>
    </table><div class="muted small">{res.rows.length} linha(s)</div></div>
  );
}

export function SqlPlayground({ code: initial, setup = 'loja' }: { code: string; setup?: string }) {
  const [code, setCode] = useState(initial);
  const [res, setRes] = useState<SqlResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); setRes(await runSql(code, setup)); setBusy(false); };
  return (
    <div class="playground">
      <Editor value={code} onInput={setCode} lang="sql" rows={5} />
      <div class="row gap">
        <button class="btn btn-run" onClick={run} disabled={busy}>{busy ? 'Consultando…' : '▶ Executar SQL'}</button>
        {code !== initial && <button class="btn btn-ghost btn-sm" onClick={() => { setCode(initial); setRes(null); }}>↺ Restaurar</button>}
      </div>
      {res && <SqlTable res={res} />}
    </div>
  );
}

export function HtmlLab({ code: initial }: { code: string }) {
  const [code, setCode] = useState(initial);
  const [shown, setShown] = useState(initial);
  const [k, setK] = useState(0);
  return (
    <div class="playground">
      <Editor value={code} onInput={setCode} lang="html" />
      <div class="row gap">
        <button class="btn btn-run" onClick={() => { setShown(code); setK(k + 1); }}>▶ Ver resultado</button>
        {code !== initial && <button class="btn btn-ghost btn-sm" onClick={() => { setCode(initial); setShown(initial); setK(k + 1); }}>↺ Restaurar</button>}
      </div>
      <div class="preview-label muted small">Resultado:</div>
      <iframe key={k} class="preview" sandbox="allow-scripts" srcdoc={previewDoc(shown)} title="Pré-visualização" />
    </div>
  );
}

const HTTP_STEPS = [
  ['🧑 Cliente', 'Você toca em "Ver pedidos" no app. O app monta a requisição: GET /pedidos com o token no cabeçalho Authorization.'],
  ['🌐 DNS', 'O nome api.loja.com é traduzido para um endereço IP (como procurar um telefone na lista).'],
  ['🔒 HTTPS', 'A requisição viaja criptografada até a porta 443 do servidor.'],
  ['⚙️ Servidor (API)', 'O Express recebe, passa pelos middlewares (log, autenticação) e chega na rota GET /pedidos.'],
  ['🗄️ Banco de dados', 'A rota executa SELECT * FROM pedidos WHERE cliente_id = $1 no PostgreSQL.'],
  ['📦 Resposta', 'A API devolve status 200 e o JSON com os pedidos. O app desenha a lista na tela.'],
];
export function HttpDiagram({ body }: { body?: string }) {
  const [i, setI] = useState(-1);
  return (
    <div class="http-diagram">
      {body && <p class="small">{body}</p>}
      <div class="http-steps">
        {HTTP_STEPS.map(([t, d], n) => (
          <div class={'http-step' + (n <= i ? ' on' : '') + (n === i ? ' current' : '')}><strong>{t}</strong>{n <= i && <p class="small">{d}</p>}</div>
        ))}
      </div>
      <div class="row gap">
        <button class="btn btn-run" onClick={() => setI(i >= HTTP_STEPS.length - 1 ? -1 : i + 1)}>{i < 0 ? '▶ Enviar requisição' : i >= HTTP_STEPS.length - 1 ? '↺ Recomeçar' : 'Próxima etapa →'}</button>
      </div>
    </div>
  );
}
