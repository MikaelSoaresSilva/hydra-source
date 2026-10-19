import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/game';
import { offlineReply, progressReport, xpExplanation, comebackAdvice, dailyBriefing } from '../core/gm';
import { createCampaign } from '../core/engine';
import { aiChat, aiCampaign, markUsage } from '../services/ai';
import { Panel } from './components';
import { uid } from '../core/util';
import type { Settings } from '../core/types';

const STYLES: [Settings['gmStyle'], string][] = [['sistema', 'Sistema'], ['mentor', 'Mentor'], ['narrador', 'Narrador'], ['estrategista', 'Estrategista']];

export function SystemChat() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingGoal, setPendingGoal] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const style = s.settings.gmStyle;
  const aiReady = s.settings.ai.enabled && !!s.settings.ai.apiKey;

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [s.chat.length, busy]);
  useEffect(() => {
    if (!s.chat.length) say(dailyBriefing(s, style));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function say(t: string, ai = false) {
    act((d) => { d.chat.push({ id: uid('ch'), from: 'sistema', style: d.settings.gmStyle, text: t, at: new Date().toISOString(), ai }); d.chat = d.chat.slice(-200); });
  }

  const send = async (q: string) => {
    if (!q.trim()) return;
    act((d) => { d.chat.push({ id: uid('ch'), from: 'jogador', style, text: q.trim(), at: new Date().toISOString() }); });
    setText('');
    const off = offlineReply(useGame.getState().s, q, style);
    if (off.createCampaign) { say(off.reply); setPendingGoal(off.createCampaign); return; }
    if (aiReady) {
      setBusy(true);
      const r = await aiChat(useGame.getState().s, q);
      setBusy(false);
      if (r.ok) { act((d) => markUsage(d)); say(r.value, true); return; }
      say(`${off.reply}\n\n(IA indisponível: ${r.error} Resposta gerada offline.)`);
      return;
    }
    say(off.reply);
  };

  const confirmCampaign = async (useAi: boolean) => {
    const goal = pendingGoal!;
    setPendingGoal(null);
    if (useAi) {
      setBusy(true);
      const r = await aiCampaign(useGame.getState().s, goal);
      setBusy(false);
      if (r.ok) { act((d, ev) => { markUsage(d); createCampaign(d, ev, goal, new Date(), r.value, 'ia'); }); say(`Campanha "${r.value.title}" publicada após validação das regras. Veja em Mundo → Campanhas.`); return; }
      say(`Não foi possível gerar com IA (${r.error}). Usei o gerador offline.`);
    }
    act((d, ev) => createCampaign(d, ev, goal));
    say('Campanha publicada. Veja em Mundo → Campanhas e Chefes.');
  };

  return (
    <div className="screen-inner">
      <h1>SISTEMA</h1>
      <Panel title="Modo de fala" right={<span className="small muted">{aiReady ? `IA ativa · ${s.settings.ai.usedDay === new Date().toISOString().slice(0, 10) ? s.settings.ai.usedToday : 0}/${s.settings.ai.dailyLimit} hoje` : 'modo offline'}</span>}>
        <div className="row gap wrap">{STYLES.map(([k, l]) => <button key={k} className={`chip ${style === k ? 'sel' : ''}`} onClick={() => act((d) => { d.settings.gmStyle = k; })}>{l}</button>)}</div>
        <div className="row gap wrap" style={{ marginTop: 8 }}>
          <button className="chip" onClick={() => say(dailyBriefing(s, style))}>Próxima missão</button>
          <button className="chip" onClick={() => say(progressReport(s))}>Relatório semanal</button>
          <button className="chip" onClick={() => say(progressReport(s, new Date(), 30))}>Relatório 30 dias</button>
          <button className="chip" onClick={() => say(xpExplanation(s))}>Como o XP é calculado</button>
          <button className="chip" onClick={() => say(comebackAdvice(s))}>Retomar rotina</button>
        </div>
      </Panel>
      <div className="chat" data-testid="chat">
        {s.chat.map((m) => <div key={m.id} className={`msg ${m.from} style-${m.style}`}>{m.from === 'sistema' && m.ai && <div className="small muted">IA · recomendações, não fatos</div>}{m.text}</div>)}
        {busy && <div className="msg sistema">…</div>}
        {pendingGoal && (
          <div className="msg sistema">
            Publicar campanha para “{pendingGoal}”?
            <div className="row gap wrap" style={{ marginTop: 8 }}>
              <button className="btn small primary" onClick={() => confirmCampaign(false)}>Publicar (offline)</button>
              {aiReady && <button className="btn small" onClick={() => confirmCampaign(true)}>Personalizar com IA</button>}
              <button className="btn small ghost" onClick={() => setPendingGoal(null)}>Cancelar</button>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="row gap" style={{ position: 'sticky', bottom: 0, paddingTop: 10, background: 'linear-gradient(transparent, var(--bg) 30%)' }}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder='Pergunte algo ou "criar campanha: ..."' onKeyDown={(e) => { if (e.key === 'Enter') send(text); }} aria-label="Mensagem" />
        <button className="btn primary" onClick={() => send(text)} disabled={busy}>Enviar</button>
      </div>
      <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => act((d) => { d.chat = []; })}>Limpar conversa</button>
    </div>
  );
}
