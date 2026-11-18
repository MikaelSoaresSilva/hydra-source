import { useMemo, useState } from 'preact/hooks';
import { COMPETENCIES, LESSONS } from '../data';
import type { Exercise } from '../data/types';
import { update, useAppState, getState } from '../engine/store';
import { dueReviews } from '../engine/state';
import { ALL_EXERCISES, EX_BY_ID, buildAssessment, mastery } from '../engine/progress';
import { Header, Card, Bar, go, Empty, useStudyTimer } from './components';
import { ExerciseView } from './exercise';
import { JsPlayground, PyPlayground, SqlPlayground, HtmlLab } from './playgrounds';

function Runner({ ids, title, emptyMsg }: { ids: string[]; title: string; emptyMsg: string }) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  useStudyTimer(true);
  if (!ids.length) return <div><Header title={title} back /><Empty>{emptyMsg}</Empty></div>;
  if (i >= ids.length) {
    const ok = results.filter(Boolean).length;
    return (
      <div><Header title={title} back />
        <Card class="hero"><h2>Rodada concluída!</h2><p>{ok} de {ids.length} certos de primeira nesta rodada.</p><Bar value={(100 * ok) / ids.length} />
          <p class="small muted">Os que você errou voltam na próxima revisão. Os que acertou voltam em intervalos cada vez maiores (1, 3, 7, 14, 30 dias…).</p>
          <button class="btn btn-primary" onClick={() => history.back()}>Voltar</button></Card>
      </div>
    );
  }
  const item = EX_BY_ID[ids[i]];
  return (
    <div>
      <Header title={title} back sub={`${i + 1} de ${ids.length} · da aula: ${LESSONS[item.lesson]?.title ?? ''}`} />
      <Bar value={(100 * i) / ids.length} />
      <ExerciseView key={item.ex.id + i} ex={item.ex} mode="review" onDone={(ok) => setResults((r) => { const n = [...r]; n[i] = n[i] ?? ok; return n; })} />
      <div class="lesson-nav"><span /><button class="btn btn-primary" onClick={() => setI(i + 1)}>{i + 1 < ids.length ? 'Próximo →' : 'Finalizar'}</button></div>
    </div>
  );
}

export function Review() {
  const ids = useMemo(() => dueReviews(getState().exercises, Date.now(), 10), []);
  return <Runner ids={ids} title="Revisão espaçada" emptyMsg="Nenhuma revisão vencida agora. Faça aulas e exercícios: o app agenda as revisões automaticamente nos dias certos." />;
}

/** Reforço adaptativo: exercícios da competência com dificuldade (errados primeiro, depois inéditos). */
export function Reinforce({ comp }: { comp: string }) {
  const ids = useMemo(() => {
    const st = getState().exercises;
    const pool = ALL_EXERCISES.filter((x) => x.ex.competency === comp);
    const wrong = pool.filter((x) => st[x.ex.id] && !st[x.ex.id].firstTry);
    const fresh = pool.filter((x) => !st[x.ex.id]);
    return [...wrong, ...fresh].slice(0, 8).map((x) => x.ex.id);
  }, [comp]);
  const lesson = Object.values(LESSONS).find((l) => l.competencies.includes(comp));
  return (
    <div>
      {lesson && <div class="callout pad-top">📖 Antes de praticar, releia o resumo: <strong>{lesson.simpler ?? lesson.goal}</strong> <button class="link-btn" onClick={() => go('/aula/' + lesson.id)}>Abrir a aula</button></div>}
      <Runner ids={ids} title={'Reforço: ' + (COMPETENCIES[comp]?.name ?? comp)} emptyMsg="Sem exercícios para esta habilidade." />
    </div>
  );
}

export function Practice() {
  const st = useAppState();
  const reviews = dueReviews(st.exercises);
  const m = mastery(st);
  const comps = Object.values(m).filter((x) => x.attempted > 0).sort((a, b) => a.score - b.score);
  return (
    <div>
      <Header title="Prática" sub="Revisões, reforço e laboratórios" />
      <Card class="hero" onClick={() => go('/revisao')}>
        <h2>🔁 Revisão de hoje: {reviews.length} exercício(s)</h2>
        <p class="small">A revisão espaçada traz de volta o que você está perto de esquecer. Comece cada sessão por aqui (10 min).</p>
      </Card>
      <h3 class="section-title">🧪 Laboratórios livres</h3>
      <div class="grid2">
        <Card onClick={() => go('/lab/js')}><div class="big-icon">🟨</div><strong>JavaScript</strong><div class="small muted">Rode qualquer código</div></Card>
        <Card onClick={() => go('/lab/py')}><div class="big-icon">🐍</div><strong>Python</strong><div class="small muted">Funciona offline</div></Card>
        <Card onClick={() => go('/lab/sql')}><div class="big-icon">🗄️</div><strong>SQL</strong><div class="small muted">Banco "Loja" de exemplo</div></Card>
        <Card onClick={() => go('/lab/html')}><div class="big-icon">🎨</div><strong>HTML/CSS/JS</strong><div class="small muted">Veja a página na hora</div></Card>
      </div>
      <h3 class="section-title">📝 Avaliações</h3>
      {[1, 2, 3].map((n) => {
        const runs = st.assessments[String(n)] ?? [];
        const best = runs.length ? Math.max(...runs.map((r) => Math.round((100 * r.score) / r.total))) : null;
        return <Card onClick={() => go('/avaliacao/' + n)}><div class="row between"><strong>{n === 3 ? 'Avaliação final (todo o curso)' : 'Avaliação do Mês ' + n}</strong><span class="tag">{best === null ? 'não feita' : 'melhor: ' + best + '%'}</span></div></Card>;
      })}
      <h3 class="section-title">🎯 Praticar por habilidade</h3>
      {comps.length === 0 && <Empty>Faça exercícios nas aulas para ver suas habilidades aqui.</Empty>}
      {comps.map((c) => (
        <div class="skill-row" onClick={() => go('/reforco/' + c.id)} role="button">
          <div class="row between"><span>{COMPETENCIES[c.id]?.name ?? c.id}</span><span class="small muted">{Math.round(c.score * 100)}% · {c.attempted}/{c.total}</span></div>
          <Bar value={c.score * 100} color={c.score >= 0.8 ? 'var(--good)' : c.score >= 0.6 ? 'var(--warn)' : 'var(--bad)'} />
        </div>
      ))}
    </div>
  );
}

const LAB_DEFAULT: Record<string, string> = {
  js: '// Laboratório livre de JavaScript\nconst nomes = ["Ana", "Bruno", "Carla"];\nfor (const n of nomes) {\n  console.log("Olá, " + n + "!");\n}\n',
  py: '# Laboratório livre de Python\nnomes = ["Ana", "Bruno", "Carla"]\nfor n in nomes:\n    print(f"Olá, {n}!")\n',
  sql: 'SELECT * FROM clientes;',
  html: '<h1>Laboratório</h1>\n<p>Escreva HTML, CSS (<style>) e JavaScript (<script>) aqui.</p>\n<button onclick="this.textContent = \'Clicou!\'">Clique</button>',
};
export function Lab({ kind }: { kind: string }) {
  useStudyTimer(true);
  const title = ({ js: 'Laboratório JavaScript', py: 'Laboratório Python', sql: 'Laboratório SQL', html: 'Laboratório HTML/CSS' } as Record<string, string>)[kind] ?? 'Laboratório';
  return (
    <div>
      <Header title={title} back />
      {kind === 'sql' && <p class="small muted pad-x">Tabelas: clientes(id, nome, cidade, idade), produtos(id, nome, preco, categoria), pedidos(id, cliente_id, data, status), itens(pedido_id, produto_id, qtd). O banco é recriado a cada execução.</p>}
      {kind === 'js' && <JsPlayground code={LAB_DEFAULT.js} />}
      {kind === 'py' && <PyPlayground code={LAB_DEFAULT.py} />}
      {kind === 'sql' && <SqlPlayground code={LAB_DEFAULT.sql} />}
      {kind === 'html' && <HtmlLab code={LAB_DEFAULT.html} />}
    </div>
  );
}

export function Labs() {
  return (
    <div><Header title="Laboratórios" back />
      {(['js', 'py', 'sql', 'html'] as const).map((k) => <Card onClick={() => go('/lab/' + k)}><strong>{({ js: '🟨 JavaScript', py: '🐍 Python', sql: '🗄️ SQL', html: '🎨 HTML/CSS/JS' })[k]}</strong></Card>)}
    </div>
  );
}

export function Assessment({ n }: { n: 1 | 2 | 3 }) {
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const questions: Exercise[] = useMemo(() => buildAssessment(n, seed), [n, seed]);
  const [i, setI] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  useStudyTimer(i >= 0);
  const st = useAppState();
  const runs = st.assessments[String(n)] ?? [];
  const title = n === 3 ? 'Avaliação final' : 'Avaliação do Mês ' + n;

  if (i < 0) return (
    <div><Header title={title} back />
      <Card class="hero">
        <h2>{questions.length} perguntas</h2>
        <p class="small">Sem dicas e sem ver a solução antes de responder. Ao final você vê a nota e a explicação do que errou. Aprovação recomendada: 70%.</p>
        {runs.length > 0 && <p class="small">Tentativas anteriores: {runs.map((r) => Math.round((100 * r.score) / r.total) + '%').join(' · ')}</p>}
        <button class="btn btn-primary big" onClick={() => setI(0)}>Começar</button>
      </Card>
    </div>
  );
  if (i >= questions.length) {
    const score = Object.values(answers).filter(Boolean).length;
    const pct = Math.round((100 * score) / questions.length);
    const wrongIds = questions.filter((q) => !answers[q.id]).map((q) => q.id);
    return (
      <div><Header title={title} back />
        <Card class="hero">
          <h2>Nota: {pct}%</h2><p>{score} de {questions.length} corretas.</p>
          <Bar value={pct} color={pct >= 70 ? 'var(--good)' : 'var(--warn)'} />
          <p class="small">{pct >= 70 ? '✅ Aprovado(a)! Siga em frente.' : 'Ainda abaixo de 70%. Use "Praticar por habilidade" para reforçar os pontos fracos e refaça a avaliação.'}</p>
          <div class="row gap wrap">
            <button class="btn btn-primary" onClick={() => go('/praticar')}>Ir para a prática</button>
            <button class="btn btn-ghost" onClick={() => { setSeed(seed + 1); setAnswers({}); setI(-1); }}>Refazer (novas perguntas)</button>
          </div>
        </Card>
        {wrongIds.length > 0 && <h3 class="section-title">Revise o que errou</h3>}
        {wrongIds.map((id) => { const q = EX_BY_ID[id].ex; return <Card><p class="small"><strong>{q.prompt}</strong></p><p class="small">✔ {q.solution}</p><p class="small muted">{q.explanation}</p></Card>; })}
      </div>
    );
  }
  const q = questions[i];
  return (
    <div><Header title={title} back sub={`Pergunta ${i + 1} de ${questions.length}`} />
      <Bar value={(100 * i) / questions.length} />
      <ExerciseView key={q.id + seed} ex={q} mode="exam" onDone={(ok) => setAnswers((a) => (q.id in a ? a : { ...a, [q.id]: ok }))} />
      <div class="lesson-nav"><span />
        <button class="btn btn-primary" disabled={!(q.id in answers)} onClick={() => {
          if (i + 1 >= questions.length) {
            const score = Object.values(answers).filter(Boolean).length;
            update((s) => { (s.assessments[String(n)] ??= []).push({ score, total: questions.length, date: Date.now(), wrong: questions.filter((x) => !answers[x.id]).map((x) => x.id) }); });
          }
          setI(i + 1);
        }}>{i + 1 < questions.length ? 'Próxima →' : 'Ver resultado'}</button>
      </div>
    </div>
  );
}
