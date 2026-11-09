import { JKK4_DAYS, JKK4_INTRO, JKK_DAYS, JKK_FLANKS, JKK_HOW, JKK_INTRO, JKK_PHOTOS, JKK_SOURCES, weeklyDirect } from '../domain/jkk';
import { MUSCLE_LABEL, type Muscle, type ProgramConfig } from '../domain/types';
import { Card } from '../ui/components';

/** Cabeçalho do Protocolo JKK: resumo, etiquetas e semana — texto do documento. */
export function JkkHeader({ four = false }: { four?: boolean }) {
  const intro = four ? { ...JKK_INTRO, ...JKK4_INTRO } : JKK_INTRO;
  return (
    <Card title={intro.title} className="accent">
      <p className="hint" style={{ marginTop: 0 }}>{intro.kicker}</p>
      <p>{intro.text}</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{JKK_INTRO.tags.map((t) => <span key={t} className="tag">{four && t === '5 dias / semana' ? '4 dias / semana' : t}</span>)}</div>
      <div className="scroll-x" style={{ marginTop: 10 }}><table className="t">
        <thead><tr>{intro.week.map(([d]) => <th key={d}>{d}</th>)}</tr></thead>
        <tbody><tr>{intro.week.map(([d, w]) => <td key={d}><small>{w}</small></td>)}</tr></tbody>
      </table></div>
      {!four && <p className="hint">{JKK_INTRO.weekNote}</p>}
    </Card>
  );
}

/** Por que a versão de 4 dias entrega o mesmo resultado (ou melhor): comparação calculada dos dois planos. */
export function Jkk4Why() {
  const five = weeklyDirect(JKK_DAYS);
  const four = weeklyDirect(JKK4_DAYS);
  const muscles = Object.keys(five) as Muscle[];
  return (
    <Card title="Por que 4 dias dá o mesmo resultado (ou melhor)">
      <ul className="list">{JKK4_INTRO.why.map((w) => <li key={w}><small>{w}</small></li>)}</ul>
      <div className="scroll-x"><table className="t">
        <thead><tr><th>Músculo</th><th>JKK 5 dias</th><th>JKK 4 dias</th></tr></thead>
        <tbody>{muscles.map((m) => (
          <tr key={m}><td>{MUSCLE_LABEL[m]}</td><td>{five[m].sets} séries · {five[m].days}x</td>
            <td><strong>{four[m]?.sets ?? 0} séries · {four[m]?.days ?? 0}x</strong>{(four[m]?.sets ?? 0) > five[m].sets || (four[m]?.days ?? 0) > five[m].days ? ' ↑' : ''}</td></tr>
        ))}</tbody>
      </table></div>
      <p className="hint">Séries diretas por semana (exercício em que o músculo é o alvo principal) e quantos dias ele é treinado.</p>
    </Card>
  );
}

export function JkkPhotos() {
  return (
    <Card title="O que vi nas fotos">
      <p className="hint" style={{ marginTop: 0 }}>{JKK_PHOTOS.note}</p>
      <div className="grid two">
        {JKK_PHOTOS.items.map((i) => <div key={i.title}><strong>{i.title}</strong><p className="hint" style={{ marginTop: 4 }}>{i.text}</p></div>)}
      </div>
    </Card>
  );
}

export function JkkWorkouts({ four = false, config }: { four?: boolean; config?: ProgramConfig }) {
  // Com o ciclo ativo, mostra o plano atual (inclui trocas automáticas); senão, o texto do documento.
  const days = config
    ? config.days.map((d) => {
      const [meta, ...intro] = d.focus.split(' — ');
      return { name: d.name, meta, intro: intro.join(' — '), rows: d.slots.map((s) => ({ key: s.slotId, label: s.label ?? s.exerciseKey, sets: s.sets, range: s.repRange, restText: s.restText ?? `${s.restSec}s`, note: s.note ?? '', tag: s.tag ?? '', unit: s.unit })) };
    })
    : (four ? JKK4_DAYS : JKK_DAYS).map((d) => ({ name: d.name, meta: d.meta, intro: d.intro, rows: d.rows.map(([key, label, sets, range, , restText, note, tag, unit]) => ({ key: key + label, label, sets, range, restText, note, tag, unit })) }));
  return (
    <Card title="Treino">
      {days.map((d) => (
        <details key={d.name}>
          <summary><strong>{d.name}</strong> · <small>{d.meta}</small></summary>
          <p className="hint">{d.intro}</p>
          <ul className="list">
            {d.rows.map((r) => (
              <li key={r.key}>
                <div className="row between"><strong>{r.label}</strong><span>{r.sets} × {r.range[0]}–{r.range[1]}{r.unit === 's' ? ' s' : ''}</span></div>
                <small>{r.note}</small>
                <div className="row between"><small className={r.tag === 'TROCA AUTOMÁTICA' ? '' : 'muted'}>{r.tag === 'TROCA AUTOMÁTICA' ? <span className="tag accent">TROCA AUTOMÁTICA</span> : r.tag}</small><small className="muted">{r.restText}</small></div>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </Card>
  );
}

export function JkkHow() {
  return (
    <Card title="Como treinar">
      <ul className="list">{JKK_HOW.map((h) => <li key={h.title}><small><strong>{h.title}</strong> {h.text}</small></li>)}</ul>
    </Card>
  );
}

export function JkkFlanks() {
  return (
    <Card title={JKK_FLANKS.title}>
      <p>{JKK_FLANKS.intro}</p>
      <div className="scroll-x"><table className="t">
        <thead><tr><th>Fase</th><th>Duração</th><th>Calorias</th><th>Objetivo</th></tr></thead>
        <tbody>{JKK_FLANKS.phases.map((p) => <tr key={p.phase}><td>{p.phase}</td><td>{p.duration}</td><td>{p.kcal}</td><td><small>{p.goal}</small></td></tr>)}</tbody>
      </table></div>
      <ul className="list">{JKK_FLANKS.bullets.map((b) => <li key={b.title}><small><strong>{b.title}</strong> {b.text}</small></li>)}</ul>
      <p className="hint">{JKK_FLANKS.footer}</p>
    </Card>
  );
}

export function JkkSources() {
  return (
    <Card title="De onde veio cada coisa">
      <div className="scroll-x"><table className="t">
        <thead><tr><th>Vídeo da pasta</th><th>O que mostra</th><th>Como entrou no plano</th></tr></thead>
        <tbody>{JKK_SOURCES.rows.map(([v, w, h]) => <tr key={v}><td><strong>{v}</strong></td><td><small>{w}</small></td><td><small>{h}</small></td></tr>)}</tbody>
      </table></div>
      <ul>{JKK_SOURCES.notes.map((n) => <li key={n}><small>{n}</small></li>)}</ul>
      <p className="hint">{JKK_SOURCES.footer}</p>
    </Card>
  );
}
