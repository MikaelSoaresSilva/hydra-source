import { Link } from 'react-router-dom';
import { formatBR } from '../domain/dates';
import type { ProgramRevision } from '../domain/types';
import { Card } from '../ui/components';

/** Relatório de uma revisão automática do treino (após uma medição). */
export function RevisionView({ r }: { r: ProgramRevision }) {
  return (
    <div className="stack">
      {r.changes.length ? (
        <>
          <p><strong>{r.changes.length} exercício(s) trocado(s):</strong></p>
          <ul className="list">{r.changes.map((c) => (
            <li key={c.slotId}><strong>{c.fromName} → {c.toName}</strong><br /><small className="muted">{c.day} · motivo: {c.reason}. Séries, repetições e descanso continuam os mesmos.</small></li>
          ))}</ul>
        </>
      ) : <p><strong>Nenhuma troca necessária.</strong> O treino continua igual.</p>}
      {r.kept.length > 0 && <details><summary>Avaliados e mantidos ({r.kept.length})</summary><ul>{r.kept.map((k) => <li key={k}><small>{k}</small></li>)}</ul></details>}
      {r.notes.length > 0 && <ul>{r.notes.map((n) => <li key={n}><small>{n}</small></li>)}</ul>}
    </div>
  );
}

export function RevisionResultCard({ r }: { r: ProgramRevision }) {
  return (
    <Card title={`Avaliação do treino · ${formatBR(r.date)}`} className={r.changes.length ? 'accent' : ''} action={<Link className="btn sm" to="/treino">Ver treino</Link>}>
      <RevisionView r={r} />
      <p className="hint">O app troca um exercício só com motivo nos seus registros: dor repetida, ou carga parada há 4 sessões com a medida da região sem crescer em 28 dias. No máximo 2 trocas por vez.</p>
    </Card>
  );
}

export function RevisionHistoryCard({ revisions }: { revisions: ProgramRevision[] }) {
  if (!revisions.length) {
    return (
      <Card title="Revisões automáticas">
        <p className="hint" style={{ marginTop: 0 }}>Toda vez que você registrar medidas em <Link to="/evolucao">Evolução</Link>, o app reavalia o treino e troca exercícios só se for necessário. Séries, faixas, descansos e dias não mudam.</p>
      </Card>
    );
  }
  const [last, ...older] = [...revisions].reverse();
  return (
    <Card title="Revisões automáticas">
      <p className="hint" style={{ marginTop: 0 }}>Última: {formatBR(last.date)}</p>
      <RevisionView r={last} />
      {older.length > 0 && (
        <details><summary>Revisões anteriores ({older.length})</summary>
          {older.map((r, i) => <div key={i} style={{ marginTop: 8 }}><p className="hint">{formatBR(r.date)}</p><RevisionView r={r} /></div>)}
        </details>
      )}
    </Card>
  );
}
