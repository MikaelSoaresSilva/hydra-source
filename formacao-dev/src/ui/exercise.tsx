import { useMemo, useState } from 'preact/hooks';
import type { Exercise, McqEx } from '../data/types';
import { runJs, explainJsError, type TestResult } from '../engine/js-runner';
import { runPython, explainPyError } from '../engine/py-runner';
import { runSql, sameRows, explainSqlError, type SqlResult } from '../engine/sql-runner';
import { checkHtml, type CheckResult, previewDoc } from '../engine/html-check';
import { recordAnswer } from '../engine/state';
import { update, getState } from '../engine/store';
import { Editor, Output, SqlTable } from './playgrounds';
import { CodeBlock } from './components';

const ERROR_KIND: Record<string, string> = {
  conhecimento: '📖 Tipo de erro: conceito. Releia a explicação da aula ou toque em "Explicar de outro jeito".',
  logica: '🧩 Tipo de erro: lógica. Simule à mão, linha por linha, com um exemplo pequeno.',
  sintaxe: '✏️ Tipo de erro: escrita (sintaxe). Confira parênteses, chaves, aspas, vírgulas e nomes.',
  interpretacao: '🔎 Tipo de erro: interpretação. Leia o enunciado (ou a mensagem de erro) palavra por palavra.',
  atencao: '👀 Tipo de erro: atenção a detalhes. Revise com calma antes de enviar.',
};

/** Embaralha as alternativas de forma estável (a resposta certa não fica sempre na mesma posição). */
function shuffledOptions(ex: McqEx) {
  let h = 0; for (const c of ex.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const idx = ex.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

const normOut = (s: string) => s.replace(/\r/g, '').split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).join('\n').trim().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ExerciseView({ ex, onDone, mode = 'lesson' }: { ex: Exercise; onDone?: (correct: boolean) => void; mode?: 'lesson' | 'review' | 'exam' }) {
  const starter = 'starter' in ex ? ex.starter ?? '' : '';
  const [input, setInput] = useState<string>(starter);
  const [choice, setChoice] = useState<number | null>(null);
  const [hints, setHints] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [status, setStatus] = useState<'idle' | 'busy' | 'right' | 'wrong' | 'revealed'>('idle');
  const [feedback, setFeedback] = useState<string>('');
  const [tests, setTests] = useState<(TestResult | CheckResult)[] | null>(null);
  const [out, setOut] = useState<{ lines: string[]; error?: string; hint?: string | null } | null>(null);
  const [sqlRes, setSqlRes] = useState<SqlResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prev] = useState(() => getState().exercises[ex.id]);
  const order = useMemo(() => (ex.type === 'mcq' ? shuffledOptions(ex) : []), [ex.id]);
  const exam = mode === 'exam';
  const finished = status === 'right' || status === 'revealed' || (exam && status === 'wrong');

  const record = (correct: boolean) => {
    update((s) => { s.exercises[ex.id] = recordAnswer(s.exercises[ex.id], correct, hints); });
  };

  const verdict = (ok: boolean, msg: string) => {
    record(ok);
    if (ok) { setStatus('right'); setFeedback(msg); onDone?.(true); }
    else {
      setWrong(wrong + 1); setStatus('wrong'); setFeedback(msg);
      if (exam) onDone?.(false);
    }
  };

  async function check() {
    setStatus('busy'); setTests(null); setOut(null);
    try {
      switch (ex.type) {
        case 'mcq': {
          if (choice === null) { setStatus('idle'); return; }
          const ok = choice === ex.answer;
          verdict(ok, ok ? ex.explanation : (ex.wrongFeedback?.[String(choice)] ?? 'Não é essa. Pense de novo — use uma dica se precisar.'));
          break;
        }
        case 'predict': {
          const ok = normOut(input) === normOut(ex.expected);
          verdict(ok, ok ? ex.explanation : 'A saída não confere. Execute mentalmente linha por linha e anote o valor de cada variável.');
          break;
        }
        case 'explain': {
          const t = stripAccents(input);
          const groups = ex.keywords.filter((g) => g.some((k) => t.includes(stripAccents(k)))).length;
          const ok = input.trim().length >= 15 && groups >= ex.minGroups;
          verdict(ok, ok ? 'Boa explicação! Compare com o exemplo: ' + ex.solution : 'Sua explicação ainda não cobre as ideias principais. ' + ex.explanation);
          break;
        }
        case 'code': {
          const r = await runJs(input, ex.tests);
          setTests(r.tests ?? []);
          setOut({ lines: r.logs, error: r.error, hint: r.error ? explainJsError(r.error) : null });
          const ok = !!r.tests?.length && r.tests.every((t) => t.pass);
          verdict(ok, ok ? ex.explanation : 'Alguns testes não passaram. Veja abaixo qual falhou e o valor que sua função devolveu.');
          break;
        }
        case 'py': {
          const r = await runPython(input, ex.tests);
          setOut({ lines: r.stdout ? r.stdout.split('\n') : [], error: r.error, hint: r.error ? explainPyError(r.error) : null });
          let ok: boolean;
          if (ex.tests?.length) { setTests(r.tests ?? []); ok = !!r.tests?.every((t) => t.pass) && !r.error; }
          else { ok = !r.error && normOut(r.stdout) === normOut(ex.stdout ?? ''); if (!ok && !r.error) setTests([{ desc: 'saída esperada: ' + ex.stdout, pass: false, got: r.stdout }]); }
          verdict(ok, ok ? ex.explanation : 'Ainda não. Compare a saída do seu programa com o que foi pedido.');
          break;
        }
        case 'sql': {
          const r = await runSql(input, ex.setup ?? 'loja');
          setSqlRes(r);
          const ok = !r.error && sameRows(r.rows, ex.expected, ex.ordered);
          verdict(ok, ok ? ex.explanation : r.error ? 'A consulta tem um erro (veja abaixo).' : `O resultado não confere: esperava ${ex.expected.length} linha(s)${ex.ordered ? ' nesta ordem' : ''}. Confira filtros, colunas e ordenação.`);
          if (!ok && r.error) setOut({ lines: [], error: r.error, hint: explainSqlError(r.error) });
          break;
        }
        case 'html': {
          const r = await checkHtml(input, ex.checks);
          setTests(r); setPreview(input);
          const ok = r.every((c) => c.pass);
          verdict(ok, ok ? ex.explanation : 'Algumas verificações falharam (veja abaixo).');
          break;
        }
      }
    } catch (e: any) {
      setStatus('wrong'); setFeedback('Erro inesperado ao corrigir: ' + (e?.message ?? e));
    }
  }

  const reveal = () => {
    if (status !== 'right') record(false);
    setStatus('revealed');
    if (ex.type === 'mcq') setChoice(ex.answer);
    onDone?.(false);
  };

  const hintList = ex.hints ?? [];
  const canReveal = !exam && (wrong >= 2 || hints >= hintList.length);
  const isCode = ex.type === 'code' || ex.type === 'py' || ex.type === 'sql' || ex.type === 'html';

  return (
    <div class={'exercise ex-' + status}>
      <div class="ex-head">
        <span class="tag">{({ mcq: 'Múltipla escolha', predict: 'Qual é a saída?', code: 'Programar (JavaScript)', explain: 'Explique com suas palavras', py: 'Programar (Python)', sql: 'Consulta SQL', html: 'HTML/CSS' } as Record<string, string>)[ex.type]}</span>
        {prev?.correct && mode !== 'exam' && <span class="tag ok">✓ já acertou antes</span>}
      </div>
      <p class="ex-prompt">{ex.prompt}</p>
      {'code' in ex && ex.code && <CodeBlock code={ex.code} lang={'lang' in ex ? ex.lang : 'js'} />}

      {ex.type === 'mcq' && (
        <div class="options" role="radiogroup">
          {order.map((i) => (
            <button type="button" role="radio" aria-checked={choice === i} disabled={finished}
              class={'option' + (choice === i ? ' selected' : '') + (finished && i === ex.answer ? ' correct' : '') + (status === 'wrong' && choice === i ? ' wrong' : '')}
              onClick={() => { setChoice(i); if (status === 'wrong') setStatus('idle'); }}>{ex.options[i]}</button>
          ))}
        </div>
      )}
      {ex.type === 'predict' && <textarea class="code-input small-input" rows={Math.max(2, ex.expected.split('\n').length + 1)} placeholder="Digite exatamente o que aparece na tela…" value={input} disabled={finished} spellcheck={false} autocapitalize="off" onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)} />}
      {ex.type === 'explain' && <textarea class="text-input" rows={4} placeholder="Escreva com suas palavras…" value={input} disabled={finished} onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)} />}
      {isCode && <Editor value={input} onInput={setInput} lang={ex.type === 'py' ? 'py' : ex.type === 'sql' ? 'sql' : ex.type === 'html' ? 'html' : 'js'} rows={ex.type === 'sql' ? 5 : 8} />}
      {ex.type === 'sql' && <p class="muted small">Tabelas: clientes(id, nome, cidade, idade) · produtos(id, nome, preco, categoria) · pedidos(id, cliente_id, data, status) · itens(pedido_id, produto_id, qtd)</p>}

      {hints > 0 && <div class="hints">{hintList.slice(0, hints).map((h, i) => <div class="hint">💡 Dica {i + 1}: {h}</div>)}</div>}

      {!finished && (
        <div class="row gap wrap">
          <button class="btn btn-primary" disabled={status === 'busy' || (ex.type === 'mcq' && choice === null)} onClick={check}>
            {status === 'busy' ? 'Corrigindo…' : isCode ? '▶ Testar' : 'Verificar'}
          </button>
          {!exam && hints < hintList.length && <button class="btn btn-ghost" onClick={() => setHints(hints + 1)}>💡 Dica ({hints + 1}/{hintList.length})</button>}
          {canReveal && <button class="btn btn-ghost" onClick={reveal}>Ver solução</button>}
        </div>
      )}

      {tests && <ul class="tests">{tests.map((t) => <li class={t.pass ? 'pass' : 'fail'}>{t.pass ? '✅' : '❌'} {t.desc}{!t.pass && 'got' in t && t.got !== '' ? <span class="muted"> — sua resposta: {t.got}</span> : null}{!t.pass && 'error' in t && t.error ? <span class="muted"> — erro: {t.error}</span> : null}{!t.pass && 'detail' in t && t.detail ? <span class="muted"> — {t.detail}</span> : null}</li>)}</ul>}
      {out && (out.lines.length > 0 || out.error) && <Output lines={out.lines} error={out.error} hint={out.hint} />}
      {sqlRes && !sqlRes.error && <SqlTable res={sqlRes} />}
      {preview !== null && ex.type === 'html' && <iframe class="preview" sandbox="allow-scripts" srcdoc={previewDoc(preview)} title="Resultado" />}

      {status === 'right' && <div class="feedback good">🎉 Correto! {feedback}</div>}
      {status === 'wrong' && (
        <div class="feedback bad">
          {exam ? '❌ Resposta incorreta.' : '🤔 ' + feedback}
          {!exam && ex.errorKind && wrong >= 1 && <div class="small">{ERROR_KIND[ex.errorKind]}</div>}
          {!exam && wrong >= 2 && ex.similar && <div class="small">Exemplo parecido: <code>{ex.similar}</code></div>}
        </div>
      )}
      {(status === 'revealed' || (exam && status === 'wrong')) && (
        <div class="feedback reveal">
          <strong>Solução:</strong>
          <CodeBlock code={ex.solution} lang={ex.type === 'py' ? 'py' : ex.type === 'sql' ? 'sql' : 'js'} />
          <p class="small">{ex.explanation}</p>
          {!exam && <p class="small muted">Este exercício voltará na sua revisão para você tentar de novo sozinho.</p>}
        </div>
      )}
    </div>
  );
}
