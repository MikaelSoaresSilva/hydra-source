import { useState } from 'preact/hooks';
import { LESSONS, AREAS, COMPETENCIES } from '../data';
import type { Step } from '../data/types';
import { resourcesForLesson } from '../data/resources';
import { update, useAppState } from '../engine/store';
import { lessonExercises } from '../engine/progress';
import { exScore } from '../engine/state';
import { Header, CodeBlock, ResourceCard, Bar, go, useStudyTimer, openUrl } from './components';
import { JsPlayground, PyPlayground, SqlPlayground, HtmlLab, HttpDiagram } from './playgrounds';
import { ExerciseView } from './exercise';

const STEP_ICON: Record<string, string> = { analogy: '🧩 Analogia', text: '📖 Explicação', tip: '💡 Dica', warning: '⚠️ Atenção', code: '💻 Código', table: '📋 Resumo', 'diagram-http': '🔄 Diagrama', html: '🧪 Laboratório HTML', python: '🐍 Python', sql: '🗄️ SQL' };

function Explain8({ e }: { e: NonNullable<Step['explain8']> }) {
  const rows: [string, string | undefined][] = [['O que faz', e.what], ['Por que funciona', e.why], ['Partes', e.parts], ['Como rodar', e.run], ['Saída esperada', e.expected], ['Erros comuns', e.errors], ['Teste você', e.test], ['Modifique', e.modify]];
  return (
    <details class="explain8"><summary>Entenda este código linha a linha</summary>
      {rows.filter(([, v]) => v).map(([k, v]) => <div class="e8"><strong>{k}:</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{v}</span></div>)}
    </details>
  );
}

export function StepView({ s }: { s: Step }) {
  return (
    <div class={'step step-' + s.kind}>
      <div class="step-kind">{STEP_ICON[s.kind] ?? s.kind}</div>
      <h3>{s.title}</h3>
      {s.body && <p class="pre">{s.body}</p>}
      {s.kind === 'code' && s.code && (s.runnable && (s.lang ?? 'js') === 'js' ? <JsPlayground code={s.code} /> : <CodeBlock code={s.code} lang={s.lang} />)}
      {s.kind === 'python' && s.code && <PyPlayground code={s.code} />}
      {s.kind === 'sql' && s.code && <SqlPlayground code={s.code} setup={s.setup} />}
      {s.kind === 'html' && s.code && <HtmlLab code={s.code} />}
      {s.kind === 'diagram-http' && <HttpDiagram />}
      {s.table && (
        <div class="table-wrap"><table class="info-table"><thead><tr>{s.table.headers.map((h) => <th>{h}</th>)}</tr></thead>
          <tbody>{s.table.rows.map((r) => <tr>{r.map((c) => <td>{c}</td>)}</tr>)}</tbody></table></div>
      )}
      {s.explain8 && <Explain8 e={s.explain8} />}
    </div>
  );
}

export function LessonView({ id }: { id: string }) {
  const st = useAppState();
  const l = LESSONS[id];
  useStudyTimer(!!l);
  const exs = l ? lessonExercises(l) : [];
  const total = (l?.steps.length ?? 0) + 1 + exs.length + 1; // passos + "outro jeito/materiais" + exercícios + resumo
  const saved = st.lessons[id];
  const [pos, setPos] = useState(saved?.status === 'done' ? 0 : Math.min(saved?.step ?? 0, total - 1));
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  if (!l) return <div><Header title="Aula não encontrada" back /></div>;
  const area = AREAS.find((a) => a.id === l.area);
  const resources = resourcesForLesson(id);

  const goTo = (p: number) => {
    setPos(p); window.scrollTo(0, 0);
    update((s) => { const cur = s.lessons[id]; s.lessons[id] = { ...(cur ?? { status: 'started', startedAt: Date.now(), step: 0 }), step: Math.max(p, cur?.step ?? 0) }; });
  };
  const finish = () => {
    const scores = exs.map((e) => exScore(st.exercises[e.id]) ?? 0);
    const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
    update((s) => { s.lessons[id] = { ...(s.lessons[id] ?? { startedAt: Date.now(), step: 0 }), status: 'done', step: total - 1, doneAt: Date.now(), score }; });
  };

  const nSteps = l.steps.length;
  let content;
  if (pos < nSteps) content = <StepView s={l.steps[pos]} />;
  else if (pos === nSteps) content = (
    <div class="step">
      <div class="step-kind">🔁 Revisão e materiais</div>
      <h3>Entendeu? Veja de outro jeito</h3>
      {l.simpler && <div class="callout"><strong>Em uma frase:</strong> {l.simpler}</div>}
      {l.otherWay && <div class="callout"><strong>Outra forma de pensar:</strong> {l.otherWay}</div>}
      {l.realExample && <div class="callout"><strong>No mundo real:</strong> {l.realExample}</div>}
      {l.lab && <div class="callout lab"><strong>🖥️ Prática no computador:</strong> {l.lab}</div>}
      {resources.length > 0 && <><h4>🎬 Vídeos e materiais recomendados</h4>{resources.slice(0, 4).map((r) => <ResourceCard r={r} compact />)}</>}
      {l.docs && l.docs.length > 0 && <><h4>📘 Documentação</h4>{l.docs.map((d) => <button class="link-btn" onClick={() => openUrl(d.url)}>{d.label} ↗</button>)}</>}
    </div>
  );
  else if (pos < nSteps + 1 + exs.length) {
    const e = exs[pos - nSteps - 1];
    content = <div><div class="muted small">Exercício {pos - nSteps} de {exs.length}</div><ExerciseView key={e.id} ex={e} onDone={(ok) => setAnswered({ ...answered, [e.id]: ok })} /></div>;
  } else {
    const scores = exs.map((e) => exScore(st.exercises[e.id]));
    const tried = scores.filter((x) => x !== null) as number[];
    const avg = tried.length ? tried.reduce((a, b) => a + b, 0) / tried.length : 0;
    const pct = Math.round(Math.min(1, avg) * 100);
    content = (
      <div class="step">
        <div class="step-kind">🏁 Fim da aula</div>
        <h3>{l.title}</h3>
        <p>Exercícios tentados: <strong>{tried.length} de {exs.length}</strong> · Aproveitamento: <strong>{pct}%</strong></p>
        <Bar value={pct} color={pct >= 70 ? 'var(--good)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)'} />
        {pct < 60 && tried.length > 0 && <div class="callout warn">Recomendação do professor: antes de seguir, releia o resumo "de outro jeito" e refaça os exercícios que errou. Eles também voltarão na sua revisão automática.</div>}
        {pct >= 80 && <div class="callout good">Excelente! Você domina este conteúdo. Ele voltará em revisões espaçadas para não esquecer.</div>}
        <p class="small muted">Habilidades trabalhadas: {l.competencies.map((c) => COMPETENCIES[c]?.name ?? c).join(', ')}</p>
        <div class="row gap wrap">
          <button class="btn btn-primary" onClick={() => { finish(); history.back(); }}>✓ Concluir aula</button>
          <button class="btn btn-ghost" onClick={() => goTo(nSteps + 1)}>Refazer exercícios</button>
        </div>
      </div>
    );
  }

  return (
    <div class="lesson">
      <Header title={l.title} back sub={`${area?.icon ?? ''} ${area?.name ?? ''} · ~${l.minutes} min de leitura${l.optional ? ' · aprofundamento opcional' : ''}`} />
      <div class="lesson-progress"><Bar value={(100 * pos) / (total - 1)} /></div>
      {pos === 0 && <div class="goal">🎯 <strong>Objetivo:</strong> {l.goal}</div>}
      {content}
      <div class="lesson-nav">
        <button class="btn btn-ghost" disabled={pos === 0} onClick={() => goTo(pos - 1)}>← Anterior</button>
        <span class="muted small">{pos + 1}/{total}</span>
        {pos < total - 1 ? <button class="btn btn-primary" onClick={() => goTo(pos + 1)}>Próximo →</button> : <button class="btn btn-ghost" onClick={() => go('/trilha')}>Trilha</button>}
      </div>
    </div>
  );
}
