import { useState } from 'react';
import { askClaude, apiKeyStore } from '../ai';
import { useApp } from '../data/AppContext';
import { interpret } from '../domain/interpreter';
import { applyOps, describeOp, preview, type Op, type Preview } from '../domain/ops';
import { hm, longDate } from '../domain/time';
import { Card } from '../ui/components';

const EXAMPLES = [
  'Vou começar a trabalhar às 8h.',
  'Hoje só vou conseguir ir à academia às 18h.',
  'Quero dormir mais cedo.',
  'Preciso adicionar 1 hora de estudos.',
  'Quero mudar meu horário de acordar para 6h.',
  'Hoje não vou conseguir realizar o cardio.',
  'Adicionar inglês às 14h por 45 min.',
  'No fim de semana quero acordar às 9h.',
];

const KIND_LABEL = { moved: 'Mudou de horário', added: 'Entrou', removed: 'Saiu', resized: 'Mudou a duração', unplaced: 'Não coube' } as const;

export function Assistant() {
  const { state, update, day, toast, undo, setUndo } = useApp();
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ ops: Op[]; pv: Preview; source: 'local' | 'claude'; summary: string; unknown: string[] } | null>(null);
  const [unknown, setUnknown] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const today = day.date;
  const canClaude = state.settings.aiEnabled && !!apiKeyStore.get();

  function run() {
    setError(''); setResult(null); setUnknown(null);
    if (!text.trim()) { setError('Escreva o que você precisa mudar.'); return; }
    const r = interpret(text, state, today);
    if (!r.ops.length) { setUnknown(r.unknown.length ? r.unknown : [text]); return; }
    setResult({ ops: r.ops, pv: preview(state, r.ops, today), source: 'local', summary: r.ops.map((o) => describeOp(state, o, today)).join(' '), unknown: r.unknown });
  }

  async function runClaude() {
    const key = apiKeyStore.get();
    if (!key) return;
    setBusy(true); setError('');
    const r = await askClaude(key, text, state, today);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    if (!r.ops.length) { setError(r.summary || 'A IA não encontrou nada para mudar na rotina.'); return; }
    setUnknown(null);
    setResult({ ops: r.ops, pv: preview(state, r.ops, today), source: 'claude', summary: r.summary + (r.dropped ? ` (${r.dropped} sugestão(ões) inválida(s) descartada(s))` : ''), unknown: [] });
  }

  function apply() {
    if (!result) return;
    setUndo(state);
    const next = applyOps(state, result.ops);
    update(() => ({ ...next, aiLog: [{ at: new Date().toISOString(), text, summary: result.summary, source: result.source, applied: true }, ...next.aiLog].slice(0, 50) }));
    toast('✨ Rotina reorganizada');
    setResult(null); setText('');
  }

  return (
    <div className="stack">
      <div><span className="kicker">Inteligência</span><h1>Ajustar rotina</h1><p className="muted" style={{ margin: 0 }}>Escreva do seu jeito. O app entende, mostra a nova rotina e só muda depois que você confirmar.</p></div>

      <Card>
        <label className="field" htmlFor="need">Descreva sua necessidade</label>
        <textarea id="need" aria-label="Descreva sua necessidade" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Hoje só vou conseguir ir à academia às 18h e quero dormir mais cedo." style={{ marginTop: 6 }} />
        <div className="chips scroll-x" style={{ marginTop: 8 }}>
          {EXAMPLES.map((e) => <button key={e} className="chip" onClick={() => setText(e)}>{e}</button>)}
        </div>
        <button className="btn primary block" style={{ marginTop: 10 }} onClick={run}>✨ Reorganizar</button>
        {error && <div className="banner danger" role="alert" style={{ marginTop: 10 }}>{error}</div>}
        {undo && !result && <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={undo}>↩️ Desfazer a última alteração</button>}
      </Card>

      {unknown && (
        <Card title="Não entendi tudo">
          <p style={{ marginTop: 0 }}>Não consegui transformar isto em mudança na rotina: <em>"{unknown.join('", "')}"</em>.</p>
          <p className="muted">Tente citar a atividade e o horário, por exemplo: "estudos às 19h", "hoje sem cardio", "acordar às 6h30", "adicionar meditação por 10 min".</p>
          {canClaude
            ? <button className="btn gold" disabled={busy} onClick={() => void runClaude()}>{busy ? 'Perguntando ao Claude…' : '🤖 Perguntar ao Claude'}</button>
            : <p className="muted"><small>Para pedidos mais livres, ative a IA do Claude em Ajustes (usa a sua chave; só a rotina é enviada).</small></p>}
          {canClaude && <p className="muted"><small>Será enviado à Anthropic: o seu pedido e a lista de atividades (nomes, horários, durações). Nada de histórico, nome ou e-mail.</small></p>}
        </Card>
      )}

      {result && (
        <Card title="Prévia da nova rotina" className="accent">
          <span className="pill violet">{result.source === 'claude' ? '🤖 Interpretado pelo Claude' : '⚡ Interpretado no aparelho'}</span>
          <h3>O que entendi</h3>
          <ul className="list" data-testid="ops">{result.ops.map((o, i) => <li key={i}>{describeOp(state, o, today)}</li>)}</ul>
          {result.unknown.length > 0 && <p className="muted"><small>Ignorado (não entendi): "{result.unknown.join('", "')}"</small></p>}
          <h3>Mudanças em {longDate(result.pv.date)}</h3>
          {result.pv.changes.length ? (
            <ul className="list" data-testid="changes">{result.pv.changes.map((c, i) => (
              <li key={i} className="row between"><span><strong>{c.title}</strong><br /><small>{KIND_LABEL[c.kind]}</small></span>
                <small style={{ textAlign: 'right' }}>{c.before && <s>{c.before}</s>}{c.before && c.after && <br />}{c.after}</small></li>
            ))}</ul>
          ) : <p className="muted">Nenhum horário deste dia muda (a alteração vale para outros dias).</p>}
          {result.pv.warnings.map((w) => <div key={w} className="banner warn" style={{ marginTop: 8 }}>{w}</div>)}
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Ver a rotina completa depois da mudança</summary>
            <ul className="list" style={{ marginTop: 8 }}>{result.pv.after.items.map((i) => <li key={i.activity.id} className="row between"><span>{i.activity.title}</span><small>{hm(i.start)}{i.end > i.start ? `–${hm(i.end)}` : ''}</small></li>)}</ul>
          </details>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" style={{ flex: 1 }} onClick={apply}>Aplicar mudanças</button>
            <button className="btn" onClick={() => setResult(null)}>Cancelar</button>
          </div>
        </Card>
      )}

      {state.aiLog.length > 0 && (
        <Card title="Pedidos anteriores">
          <ul className="list">{state.aiLog.slice(0, 10).map((l) => (
            <li key={l.at}><strong>"{l.text}"</strong><br /><small>{new Date(l.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {l.source === 'claude' ? 'Claude' : 'no aparelho'}</small><br /><small>{l.summary}</small></li>
          ))}</ul>
        </Card>
      )}
    </div>
  );
}
