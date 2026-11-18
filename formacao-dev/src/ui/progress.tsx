import { AREAS, COMPETENCIES, LESSONS, TRACK_ORDER } from '../data';
import { RESOURCES } from '../data/resources';
import type { AreaId } from '../data/types';
import { update, useAppState } from '../engine/store';
import { overview, areaProgress, directionSuggestion, weekMinutes, mastery, PROJECTS, REQUIRED_PROJECTS } from '../engine/progress';
import { Header, Card, Bar, Ring, go, ResourceCard } from './components';

/** Mapa visual: as áreas como "bairros" de uma cidade, coloridos conforme o avanço. */
export function AreaMap() {
  const st = useAppState();
  const ap = areaProgress(st);
  return (
    <div class="area-map" role="list">
      {AREAS.map((a) => {
        const p = ap.find((x) => x.id === a.id)!;
        return (
          <button role="listitem" class={'area-tile' + (a.focus ? ' focus' : '')} style={{ '--c': a.color, '--p': p.percent + '%' } as any} onClick={() => go('/area/' + a.id)}>
            <span class="area-fill" />
            <span class="area-icon">{a.icon}</span>
            <span class="area-name">{a.name}</span>
            <span class="area-pct">{p.percent}% · {p.done}/{p.total}</span>
            {p.mastery !== null && <span class="area-mast">domínio {Math.round(p.mastery * 100)}%</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Progress() {
  const st = useAppState();
  const o = overview(st);
  const week = weekMinutes(st);
  const maxW = Math.max(30, ...week.map((w) => w.minutes));
  const dir = directionSuggestion(st);
  return (
    <div>
      <Header title="Seu progresso" sub="Desempenho, habilidades e pontos a melhorar" />
      <Card class="hero">
        <div class="row gap center-v">
          <Ring value={o.percent} size={100} label="formação" />
          <div class="grow small">
            <div>📚 Aulas obrigatórias: <strong>{o.lessonsDone}/{o.lessonsTotal}</strong></div>
            <div>🗓 Sessões: <strong>{o.sessionsDone}/24</strong></div>
            <div>🛠 Projetos principais: <strong>{o.projectsDone}/{o.projectsTotal}</strong></div>
            <div>⏱ Horas estudadas: <strong>{o.hours.toFixed(1)} h</strong> de 72</div>
            <div>✍️ Exercícios: <strong>{o.exercisesCorrect}</strong> certos / {o.exercisesDone} feitos ({o.exercisesTotal} no total)</div>
            <div>📝 Média das avaliações: <strong>{o.assessmentsAvg === null ? '—' : Math.round(o.assessmentsAvg * 100) + '%'}</strong></div>
          </div>
        </div>
        <p class="muted tiny">Cálculo da porcentagem: 70% aulas obrigatórias + 20% projetos principais + 10% melhor nota de cada avaliação.</p>
      </Card>

      <h3 class="section-title">🗺 Mapa das áreas da programação</h3>
      <p class="small muted pad-x">A cor preenche cada área conforme você estuda. Toque para ver aulas, vídeos e carreiras.</p>
      <AreaMap />

      <h3 class="section-title">⏱ Últimos 7 dias</h3>
      <div class="week-chart">{week.map((w) => <div class="wk"><div class="wk-bar" style={{ height: (100 * w.minutes) / maxW + '%' }} title={w.minutes + ' min'} /><span>{w.label}</span><span class="tiny">{w.minutes}m</span></div>)}</div>

      <h3 class="section-title">🏅 Habilidades adquiridas ({o.skills.length})</h3>
      <div class="chips">{o.skills.length ? o.skills.map((s) => <span class="chip ok">{COMPETENCIES[s.id]?.name ?? s.id}</span>) : <span class="muted small">Habilidades com 3+ exercícios e 80%+ de domínio aparecem aqui.</span>}</div>

      <h3 class="section-title">🎯 Pontos que precisam melhorar ({o.weak.length})</h3>
      {o.weak.length ? o.weak.map((w) => (
        <div class="skill-row" role="button" onClick={() => go('/reforco/' + w.id)}>
          <div class="row between"><span>{COMPETENCIES[w.id]?.name ?? w.id}</span><span class="small">{Math.round(w.score * 100)}% → praticar</span></div>
          <Bar value={w.score * 100} color="var(--bad)" />
        </div>
      )) : <p class="muted small pad-x">Nenhum ponto fraco detectado até agora. 👏</p>}

      <h3 class="section-title">🛠 Projetos</h3>
      {PROJECTS.filter((p) => REQUIRED_PROJECTS.includes(p.id)).map((p) => (
        <div class="row between pad-x small proj-line"><span>{st.projects[p.id]?.done ? '✅' : '⬜'} {p.title}</span></div>
      ))}

      <h3 class="section-title">🧭 Sua direção profissional</h3>
      <Card>
        <p class="small">Combinação do seu desempenho com o quanto você gostou de cada área (avalie na página de cada área):</p>
        {dir.slice(0, 4).map((d, i) => { const a = AREAS.find((x) => x.id === d.id)!; return <div class="row between small"><span>{i + 1}. {a.icon} {a.name}</span><span class="muted">gosto {d.like}/5 · domínio {d.perf === null ? '—' : Math.round(d.perf * 100) + '%'}</span></div>; })}
        <p class="tiny muted">O Backend recebe um pequeno bônus por ser o seu foco declarado.</p>
      </Card>
    </div>
  );
}

export function AreaView({ id }: { id: AreaId }) {
  const st = useAppState();
  const a = AREAS.find((x) => x.id === id);
  if (!a) return <div><Header title="Área" back /></div>;
  const ids = [...TRACK_ORDER.filter((l) => LESSONS[l]?.area === id), ...Object.keys(LESSONS).filter((l) => LESSONS[l].area === id && !TRACK_ORDER.includes(l))];
  const p = areaProgress(st).find((x) => x.id === id)!;
  const m = mastery(st);
  const comps = Object.entries(COMPETENCIES).filter(([, c]) => c.area === id).map(([k, c]) => ({ k, name: c.name, m: m[k] }));
  const res = RESOURCES.filter((r) => r.area === id);
  const rating = st.areaRatings[id] ?? 0;
  return (
    <div>
      <Header title={a.icon + ' ' + a.name} back />
      <Card class="hero"><p>{a.desc}</p><p class="small"><strong>Carreiras:</strong> {a.jobs}</p><Bar value={p.percent} color={a.color} /><p class="small muted">{p.done} de {p.total} aulas concluídas</p></Card>
      <Card>
        <strong>Quanto você gostou desta área?</strong>
        <div class="stars">{[1, 2, 3, 4, 5].map((n) => <button aria-label={n + ' estrelas'} class={n <= rating ? 'on' : ''} onClick={() => update((s) => { s.areaRatings[id] = n; })}>★</button>)}</div>
        <p class="tiny muted">Sua opinião entra no cálculo da sua direção profissional.</p>
      </Card>
      <h3 class="section-title">Aulas</h3>
      {ids.map((l) => (
        <button class={'lesson-row' + (st.lessons[l]?.status === 'done' ? ' done' : '')} onClick={() => go('/aula/' + l)}>
          <span class="lr-icon">{st.lessons[l]?.status === 'done' ? '✅' : '○'}</span>
          <span class="lr-text"><strong>{LESSONS[l].title}</strong><span class="muted small">~{LESSONS[l].minutes} min{LESSONS[l].optional ? ' · opcional' : ''}</span></span>
        </button>
      ))}
      <h3 class="section-title">Habilidades</h3>
      {comps.map((c) => <div class="skill-row"><div class="row between small"><span>{c.name}</span><span class="muted">{c.m?.attempted ? Math.round(c.m.score * 100) + '%' : 'não praticada'}</span></div><Bar value={(c.m?.score ?? 0) * 100} color={a.color} /></div>)}
      <h3 class="section-title">Vídeos e materiais ({res.length})</h3>
      {res.map((r) => <ResourceCard r={r} compact />)}
    </div>
  );
}
