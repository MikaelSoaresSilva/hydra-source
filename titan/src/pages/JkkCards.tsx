import { JKK_DAYS, JKK_FLANKS, JKK_HOW, JKK_INTRO, JKK_PHOTOS, JKK_SOURCES } from '../domain/jkk';
import { Card } from '../ui/components';

/** Cabeçalho do Protocolo JKK: resumo, etiquetas e semana — texto do documento. */
export function JkkHeader() {
  return (
    <Card title={JKK_INTRO.title} className="accent">
      <p className="hint" style={{ marginTop: 0 }}>{JKK_INTRO.kicker}</p>
      <p>{JKK_INTRO.text}</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>{JKK_INTRO.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
      <div className="scroll-x" style={{ marginTop: 10 }}><table className="t">
        <thead><tr>{JKK_INTRO.week.map(([d]) => <th key={d}>{d}</th>)}</tr></thead>
        <tbody><tr>{JKK_INTRO.week.map(([d, w]) => <td key={d}><small>{w}</small></td>)}</tr></tbody>
      </table></div>
      <p className="hint">{JKK_INTRO.weekNote}</p>
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

export function JkkWorkouts() {
  return (
    <Card title="Treino">
      {JKK_DAYS.map((d) => (
        <details key={d.name}>
          <summary><strong>{d.name}</strong> · <small>{d.meta}</small></summary>
          <p className="hint">{d.intro}</p>
          <ul className="list">
            {d.rows.map(([key, label, sets, [a, b], , restText, note, tag, unit]) => (
              <li key={key + label}>
                <div className="row between"><strong>{label}</strong><span>{sets} × {a}–{b}{unit === 's' ? ' s' : ''}</span></div>
                <small>{note}</small>
                <div className="row between"><small className="muted">{tag}</small><small className="muted">{restText}</small></div>
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
