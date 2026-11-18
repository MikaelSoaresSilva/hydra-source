import { LESSONS, AREAS, COMPETENCIES } from '../data';
import { SESSIONS, MONTHS, blocksFor, type Session } from '../data/schedule';
import { RESOURCE_BY_ID } from '../data/resources';
import { PROJECTS } from '../data';
import { update, useAppState } from '../engine/store';
import { calendarPos, dueReviews, parseYmd } from '../engine/state';
import { overview, EX_BY_ID } from '../engine/progress';
import { Header, Card, Bar, Ring, go, fmtDate, ResourceCard, useStudyTimer } from './components';

const lessonTitle = (id: string) => LESSONS[id]?.title ?? id;

export function sessionDate(startDate: string, s: Session) {
  const d = parseYmd(startDate); d.setDate(d.getDate() + (s.week - 1) * 7 + (s.day === 'dom' ? 1 : 0)); return d;
}

function LessonRow({ id, optional }: { id: string; optional?: boolean }) {
  const st = useAppState();
  const l = LESSONS[id]; if (!l) return null;
  const ls = st.lessons[id];
  const area = AREAS.find((a) => a.id === l.area);
  return (
    <button class={'lesson-row' + (ls?.status === 'done' ? ' done' : '')} onClick={() => go('/aula/' + id)}>
      <span class="lr-icon">{ls?.status === 'done' ? '✅' : ls ? '▶️' : area?.icon}</span>
      <span class="lr-text"><strong>{l.title}</strong><span class="muted small">{area?.name} · ~{l.minutes} min + exercícios{optional ? ' · opcional' : ''}</span></span>
    </button>
  );
}

export function Today() {
  const st = useAppState();
  const pos = calendarPos(st.startDate);
  const o = overview(st);
  const reviews = dueReviews(st.exercises);
  const firstPending = SESSIONS.find((s) => !st.sessions[s.id]?.done);
  const todays = pos.sessionN ? SESSIONS[pos.sessionN - 1] : null;
  const next = SESSIONS[pos.nextN - 1];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const behind = firstPending && todays && firstPending.n < todays.n;

  return (
    <div>
      <Header title={`${hello}${st.name ? ', ' + st.name : ''}! 👋`} sub={fmtDate(new Date())} />
      <Card class="hero">
        <div class="row gap center-v">
          <Ring value={o.percent} label="formação" />
          <div class="grow">
            <div class="small muted">Semana {Math.min(12, Math.max(1, pos.week))} de 12{pos.before ? ' (ainda não começou)' : ''}</div>
            <div><strong>{o.lessonsDone}/{o.lessonsTotal}</strong> aulas · <strong>{o.sessionsDone}/24</strong> sessões</div>
            <div><strong>{o.hours.toFixed(1)} h</strong> estudadas · <strong>{o.exercisesCorrect}</strong> exercícios certos</div>
          </div>
        </div>
      </Card>

      {todays ? (
        <Card class="today-card">
          <div class="tag accent">HOJE · Sessão {todays.n} de 24 · 13h30–16h30</div>
          <h2>{todays.title}</h2>
          <p class="small">{todays.goal}</p>
          {st.sessions[todays.id]?.done ? <p class="good-text">✅ Sessão concluída. Ótimo trabalho!</p> : <button class="btn btn-primary big" onClick={() => go('/sessao/' + todays.id)}>Começar a sessão de hoje →</button>}
        </Card>
      ) : (
        <Card>
          <div class="tag">{pos.after ? 'Formação concluída no calendário' : 'Próxima sessão'}</div>
          {pos.after ? <p>As 12 semanas do calendário terminaram. Conclua o que faltar e siga o plano de continuidade na aba Carreira.</p> : next && (
            <>
              <h2>{next.title}</h2>
              <p class="small">📅 {fmtDate(pos.nextDate)}, às 13h30 · Sessão {next.n}</p>
              <p class="small muted">Hoje não é dia de sessão. Você pode revisar, praticar ou adiantar (sem pular as revisões!).</p>
              <button class="btn btn-ghost" onClick={() => go('/sessao/' + next.id)}>Ver o que vou estudar</button>
            </>
          )}
        </Card>
      )}

      {behind && firstPending && (
        <Card class="warn-card" onClick={() => go('/sessao/' + firstPending.id)}>
          <strong>⏳ Sessão pendente: {firstPending.n}. {firstPending.title}</strong>
          <p class="small">Tudo bem atrasar! Faça esta antes da de hoje — o conteúdo é progressivo. Se precisar, use as próximas sessões para recuperar.</p>
        </Card>
      )}

      <div class="grid2">
        <Card onClick={() => go('/revisao')}>
          <div class="big-num">{reviews.length}</div><div class="small">exercícios para revisar</div>
          <div class="muted small">{reviews.length ? 'Toque para revisar agora' : 'Nada vencido hoje 🎉'}</div>
        </Card>
        <Card onClick={() => go('/progresso')}>
          <div class="big-num">{o.weak.length}</div><div class="small">pontos a melhorar</div>
          <div class="muted small">{o.skills.length} habilidades dominadas</div>
        </Card>
      </div>

      {o.weak.length > 0 && (
        <Card class="warn-card">
          <strong>🧑‍🏫 O professor recomenda reforçar:</strong>
          {o.weak.slice(0, 3).map((w) => (
            <div class="row between center-v weak-row"><span>{COMPETENCIES[w.id]?.name ?? w.id} <span class="muted small">({Math.round(w.score * 100)}%)</span></span>
              <button class="btn btn-sm" onClick={() => go('/reforco/' + w.id)}>Praticar</button></div>
          ))}
        </Card>
      )}

      {firstPending && !todays && (
        <Card onClick={() => go('/sessao/' + firstPending.id)}>
          <div class="tag">Continuar de onde parou</div>
          <strong>Sessão {firstPending.n}: {firstPending.title}</strong>
        </Card>
      )}

      <div class="quick">
        <button onClick={() => go('/labs')}>🧪<span>Laboratórios</span></button>
        <button onClick={() => go('/recursos')}>🎬<span>Vídeos e sites</span></button>
        <button onClick={() => go('/projetos')}>🛠<span>Projetos</span></button>
        <button onClick={() => go('/carreira')}>💼<span>Carreira</span></button>
      </div>
    </div>
  );
}

export function Track() {
  const st = useAppState();
  const pos = calendarPos(st.startDate);
  return (
    <div>
      <Header title="Trilha de 12 semanas" sub="Sábados e domingos, 13h30–16h30 · 72 horas" />
      {MONTHS.map((m) => (
        <section>
          <h2 class="section-title">Mês {m.n}: {m.title}</h2>
          <p class="small muted pad-x">{m.goal}</p>
          {SESSIONS.filter((s) => s.month === m.n).map((s) => {
            const done = st.sessions[s.id]?.done;
            const lessonsDone = s.lessons.filter((id) => st.lessons[id]?.status === 'done').length;
            const isToday = pos.sessionN === s.n;
            return (
              <Card class={'session-card' + (done ? ' done' : '') + (isToday ? ' today' : '')} onClick={() => go('/sessao/' + s.id)}>
                <div class="row between"><span class="tag">Semana {s.week} · {s.day === 'sab' ? 'Sábado' : 'Domingo'} · {sessionDate(st.startDate, s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>{done ? <span class="tag ok">✓ concluída</span> : isToday ? <span class="tag accent">hoje</span> : null}</div>
                <strong>{s.n}. {s.title}</strong>
                <div class="small muted">{s.lessons.length} aulas{s.project ? ' + projeto' : ''}{s.assessment ? ' + avaliação' : ''}</div>
                <Bar value={(100 * lessonsDone) / s.lessons.length} />
              </Card>
            );
          })}
        </section>
      ))}
      <section>
        <h2 class="section-title">Aprofundamento (depois do curso)</h2>
        <p class="small muted pad-x">Aulas opcionais para quem quer ir além: algoritmos, mensageria, system design e mais.</p>
        {['l-algo', 'l-runtime', 'l-cache', 'l-linux', 'l-realtime', 'l-api-styles', 'l-rag', 'l-observability', 'l-messaging', 'l-system-design'].map((id) => <LessonRow id={id} optional />)}
      </section>
      <Card onClick={() => go('/aulas')}><strong>📚 Ver todas as aulas por área</strong></Card>
    </div>
  );
}

export function SessionView({ id }: { id: string }) {
  const st = useAppState();
  const s = SESSIONS.find((x) => x.id === id);
  useStudyTimer(!!s);
  if (!s) return <div><Header title="Sessão não encontrada" back /></div>;
  const blocks = blocksFor(s, lessonTitle);
  const ss = st.sessions[id] ?? { blocks: [], done: false };
  const toggle = (k: string) => update((x) => {
    const cur = x.sessions[id] ?? { blocks: [], done: false };
    cur.blocks = cur.blocks.includes(k) ? cur.blocks.filter((b) => b !== k) : [...cur.blocks, k];
    x.sessions[id] = cur;
  });
  const allLessons = s.lessons.every((l) => st.lessons[l]?.status === 'done');
  const project = s.project ? PROJECTS.find((p) => p.id === s.project!.id) : null;
  const reviews = dueReviews(st.exercises);
  const weakLessons = s.lessons.filter((l) => (st.lessons[l]?.score ?? 1) < 0.6);

  return (
    <div>
      <Header title={`Sessão ${s.n}`} back sub={`Semana ${s.week} · ${s.day === 'sab' ? 'Sábado' : 'Domingo'}, ${sessionDate(st.startDate, s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} · 13h30–16h30`} />
      <Card class="hero">
        <h2>{s.title}</h2>
        <p>🎯 {s.goal}</p>
      </Card>

      <h3 class="section-title">⏱ Roteiro de hoje (3 horas)</h3>
      <div class="timeline">
        {blocks.map((b, i) => {
          const k = 'b' + i; const on = ss.blocks.includes(k);
          return (
            <div class={'tl-item tl-' + b.kind + (on ? ' on' : '')}>
              <button class="tl-check" aria-label="Marcar bloco como feito" onClick={() => toggle(k)}>{on ? '✓' : ''}</button>
              <div class="tl-body">
                <div class="row between"><strong>{b.start} · {b.title}</strong><span class="muted small">{b.minutes} min</span></div>
                <div class="small">{b.detail}</div>
                {b.kind === 'revisao' && <button class="btn btn-sm" onClick={() => go('/revisao')}>Revisar agora ({reviews.length})</button>}
              </div>
            </div>
          );
        })}
      </div>

      <h3 class="section-title">📚 Aulas desta sessão</h3>
      {s.lessons.map((l) => <LessonRow id={l} />)}
      {s.optional?.map((l) => <LessonRow id={l} optional />)}
      {weakLessons.length > 0 && <div class="callout warn">Você teve dificuldade em: {weakLessons.map(lessonTitle).join(', ')}. Refaça os exercícios dessa aula antes de avançar.</div>}

      <h3 class="section-title">🎬 Prática guiada: vídeos e sites</h3>
      <ul class="practice-list">{s.practice.map((p) => <li>{p}</li>)}</ul>
      {s.resources.map((r) => RESOURCE_BY_ID[r] && <ResourceCard r={RESOURCE_BY_ID[r]} compact />)}

      {project && (
        <>
          <h3 class="section-title">🛠 Projeto</h3>
          <Card onClick={() => go('/projeto/' + project.id)}><strong>{project.title}</strong><p class="small">Etapa de hoje: {s.project!.step}</p></Card>
        </>
      )}

      <h3 class="section-title">🏆 Desafio sem consulta</h3>
      <div class="callout">{s.challenge}</div>
      {s.assessment && <Card class="accent-card" onClick={() => go('/avaliacao/' + s.assessment)}><strong>📝 Avaliação do {s.assessment === 3 ? 'curso (final)' : 'Mês ' + s.assessment}</strong><p class="small">Teste seus conhecimentos. Você pode refazer quantas vezes quiser.</p></Card>}

      <h3 class="section-title">📝 Minhas anotações</h3>
      <textarea class="text-input" rows={3} placeholder="O que aprendi hoje? O que ficou difícil?" value={ss.note ?? ''} onInput={(e) => update((x) => { x.sessions[id] = { ...(x.sessions[id] ?? { blocks: [], done: false }), note: (e.target as HTMLTextAreaElement).value }; })} />

      <div class="callout">➡️ <strong>Próximo objetivo:</strong> {s.next}</div>
      {!ss.done ? (
        <button class="btn btn-primary big" onClick={() => update((x) => { x.sessions[id] = { ...(x.sessions[id] ?? { blocks: [] }), done: true, doneAt: Date.now() } as any; })}>
          {allLessons ? '✓ Concluir sessão' : '✓ Concluir sessão (ainda há aulas pendentes)'}
        </button>
      ) : <p class="good-text center">✅ Sessão concluída</p>}
    </div>
  );
}

export function AllLessons() {
  useAppState();
  return (
    <div>
      <Header title="Todas as aulas" back />
      {AREAS.map((a) => {
        const ids = Object.values(LESSONS).filter((l) => l.area === a.id).map((l) => l.id);
        if (!ids.length) return null;
        return <section><h2 class="section-title">{a.icon} {a.name}</h2>{ids.map((id) => <LessonRow id={id} optional={LESSONS[id].optional} />)}</section>;
      })}
    </div>
  );
}

export { EX_BY_ID };
