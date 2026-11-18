import { Link } from 'react-router-dom';
import { formatBR } from '../domain/dates';
import type { ProgramRevision } from '../domain/types';
import type { DietReview } from '../domain/dietReview';
import type { FullReview } from '../services';
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

/** Resultado da revisão da dieta: o que mudou (com o motivo) ou por que ficou igual. */
export function DietReviewCard({ d }: { d: DietReview }) {
  return (
    <Card title={`Avaliação da dieta · ${formatBR(d.date)}`} className={d.changed ? 'accent' : ''} action={<Link className="btn sm" to="/nutricao">Ver dieta</Link>}>
      {d.changed ? (
        <>
          <p style={{ marginTop: 0 }}><strong>Dieta ajustada:</strong> {d.kcal} kcal · P {d.protein} g · C {d.carbs} g · G {d.fat} g</p>
          <ul className="list">{d.changes.map((c) => <li key={c}><small>{c}</small></li>)}</ul>
        </>
      ) : <p style={{ marginTop: 0 }}><strong>Nenhuma mudança necessária.</strong> A dieta continua igual ({d.kcal} kcal · P {d.protein} g).</p>}
      {d.kept.length > 0 && <details open={!d.changed}><summary>Avaliado e mantido ({d.kept.length})</summary><ul>{d.kept.map((k) => <li key={k}><small>{k}</small></li>)}</ul></details>}
      <p className="hint">A dieta só muda com motivo nos seus registros: 2 semanas seguidas fora do ritmo de peso (com a comida registrada), cintura subindo sem o braço crescer, ou peso mudando 2 kg ou mais. No máximo uma mudança a cada 14 dias, de 100 a 150 kcal por vez.</p>
    </Card>
  );
}

/** Revisão completa (treino + dieta) depois de medidas ou foto. */
export function FullReviewCards({ r }: { r: FullReview }) {
  return (
    <div className="stack" data-testid="full-review">
      {r.notes.length > 0 && <div className="banner info">{r.notes.map((n) => <div key={n}>{n}</div>)}</div>}
      {r.training ? <RevisionResultCard r={r.training} /> : <Card title="Avaliação do treino"><p className="hint" style={{ margin: 0 }}>O plano ativo não é ajustado automaticamente (só as versões de 4 e 3 dias trocam exercícios; a de 5 dias segue o documento original).</p></Card>}
      {r.diet ? <DietReviewCard d={r.diet} /> : <Card title="Avaliação da dieta"><p className="hint" style={{ margin: 0 }}>Ainda não há meta de nutrição calculada. Abra Nutrição para calcular.</p></Card>}
    </div>
  );
}
