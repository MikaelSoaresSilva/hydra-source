import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store/game';
import type { GameEvent } from '../core/engine';
import { ITEM_MAP, RARITY_INFO } from '../data/items';
import { ACH_MAP } from '../data/achievements';
import { CHAPTERS } from '../data/story';
import { RANK_COLORS } from '../core/progression';
import { sfx } from '../services/audio';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { ATTRS } from '../data/attributes';
import type { AttrKey } from '../core/types';
import { StoryReader } from './World';

const CINEMATIC = new Set(['levelup', 'rank', 'boss_defeated', 'campaign_done', 'chapter']);

interface Toast { id: number; text: React.ReactNode; kind: string; color?: string }

const LEVEL_LINES = [
  'Sua energia se estabiliza em um novo patamar.',
  'O Sistema registra: limite anterior superado.',
  'Algo dentro de você responde mais rápido agora.',
  'As Fendas sentem a mudança.',
  'Mais um passo. O caminho continua.',
  'A força não veio de graça. Veio de você.',
];

function vibrate(strong = false) {
  if (Capacitor.isNativePlatform()) Haptics.impact({ style: strong ? ImpactStyle.Heavy : ImpactStyle.Light }).catch(() => {});
}

export function Overlay() {
  const events = useGame((x) => x.events);
  const shift = useGame((x) => x.shiftEvent);
  const settings = useGame((x) => x.s.settings);
  const act = useGame((x) => x.act);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cine, setCine] = useState<GameEvent | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const tid = useRef(1);

  const push = (t: Omit<Toast, 'id'>, ms = 2600) => {
    const id = tid.current++;
    setToasts((x) => [...x.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), ms);
  };

  useEffect(() => {
    if (cine || !events.length) return;
    // Agrupa XP consecutivo em um único toast
    let xpSum = 0; const attrs: Partial<Record<AttrKey, number>> = {}; let i = 0;
    while (i < events.length && events[i].kind === 'xp') {
      const e = events[i] as Extract<GameEvent, { kind: 'xp' }>;
      xpSum += e.amount;
      for (const [k, v] of Object.entries(e.attrs)) attrs[k as AttrKey] = (attrs[k as AttrKey] ?? 0) + (v ?? 0);
      i++;
    }
    if (i > 0) {
      for (let j = 0; j < i; j++) shift();
      const attrTxt = Object.entries(attrs).slice(0, 3).map(([k, v]) => `${ATTRS[k as AttrKey].short} +${v}`).join(' · ');
      push({ kind: 'xp', text: <><b>+{xpSum} XP</b>{attrTxt && <span className="muted"> · {attrTxt}</span>}</> }, 2200);
      sfx('complete'); vibrate();
      return;
    }
    const e = events[0];
    shift();
    if (CINEMATIC.has(e.kind)) {
      // Itens recebidos logo depois da subida de nível vão para a mesma tela
      setExtra([]);
      setCine(e);
      if (e.kind === 'rank') sfx('rank'); else if (e.kind === 'boss_defeated') sfx('boss'); else if (e.kind === 'chapter') sfx('open'); else sfx('levelup');
      vibrate(true);
      return;
    }
    switch (e.kind) {
      case 'item': { const it = ITEM_MAP[e.itemId]; push({ kind: 'item', color: RARITY_INFO[it.rarity].color, text: <>Item obtido: <b style={{ color: RARITY_INFO[it.rarity].color }}>{it.name}</b> <span className="muted">({RARITY_INFO[it.rarity].name})</span></> }, 3500); sfx('item'); break; }
      case 'achievement': { const a = ACH_MAP[e.id]; push({ kind: 'item', color: '#ffd166', text: <>🏆 Conquista: <b style={{ color: '#ffd166' }}>{a.name}</b>{a.title && <span className="muted"> · título “{a.title}”</span>}</> }, 3800); sfx('achievement'); break; }
      case 'boss_phase': push({ kind: 'item', color: '#ff5d73', text: <>⚔ {e.phase} vencida!</> }, 3000); sfx('heavy'); break;
      case 'streak': push({ kind: 'info', text: e.shieldUsed ? <>🛡 Escudo usado: sequência de <b>{e.days}</b> dias preservada.</> : <>🔥 Sequência de <b>{e.days}</b> dias!</> }, 3200); break;
      case 'pr': push({ kind: 'item', color: '#ff9f43', text: <>💪 Recorde pessoal: <b>{e.exercise}</b> com {e.kg} kg</> }, 3800); sfx('achievement'); break;
      case 'info': push({ kind: 'info', text: e.text }, 4200); break;
      case 'error': push({ kind: 'error', text: e.text }, 4200); sfx('error'); break;
    }
  }, [events, cine]); // eslint-disable-line react-hooks/exhaustive-deps

  // Junta itens de nível na cinemática atual
  useEffect(() => {
    if (cine?.kind === 'levelup') setExtra(cine.itemIds);
  }, [cine]);

  const quick = settings.reducedMotion || (cine?.kind === 'levelup' && cine.level % 5 !== 0);
  useEffect(() => {
    if (cine && quick && cine.kind === 'levelup') { const t = setTimeout(() => setCine(null), 2600); return () => clearTimeout(t); }
  }, [cine, quick]);

  const shards = useMemo(() => Array.from({ length: settings.graphics === 'baixo' ? 0 : 18 }).map((_, i) => ({ r: `${(i / 18) * 360}deg`, x: `${Math.cos((i / 18) * Math.PI * 2) * 45}vmax`, y: `${Math.sin((i / 18) * Math.PI * 2) * 45}vmax` })), [settings.graphics, cine]);

  let content: React.ReactNode = null;
  let color = '#4cc9ff';
  if (cine) {
    if (cine.kind === 'levelup') {
      color = cine.level % 10 === 0 ? '#ffd166' : cine.level % 5 === 0 ? '#c06bff' : '#4cc9ff';
      content = <>
        <div className="label">[ LEVEL UP ]</div>
        <div className="big">NÍVEL {cine.level}</div>
        <div className="sub">{LEVEL_LINES[cine.level % LEVEL_LINES.length]}{cine.level - cine.from > 1 ? ` (+${cine.level - cine.from} níveis)` : ''}</div>
        <div className="rewards">
          <span className="chip">+1 ponto de talento</span>
          {extra.map((id) => { const it = ITEM_MAP[id]; return <span key={id} className="chip" style={{ borderColor: RARITY_INFO[it.rarity].color, color: RARITY_INFO[it.rarity].color }}>Recompensa: {it.name}</span>; })}
        </div>
      </>;
    } else if (cine.kind === 'rank') {
      color = RANK_COLORS[cine.rank] ?? '#fff';
      content = <>
        <div className="label">[ AVALIAÇÃO DE CAÇADOR CONCLUÍDA ]</div>
        <div className="big">RANK {cine.rank}</div>
        <div className="sub">Seus critérios foram verificados. O Véu reconhece sua nova posição.</div>
        <div className="rewards"><span className="chip">Aura de rank intensificada</span><span className="chip">Novas Fendas podem ter sido liberadas</span></div>
      </>;
    } else if (cine.kind === 'boss_defeated') {
      const b = useGame.getState().s.bosses.find((x) => x.id === cine.bossId);
      color = '#ff2a6a';
      content = <>
        <div className="label">[ CHEFE DERROTADO ]</div>
        <div className="big">{b?.name ?? 'Chefe'}</div>
        <div className="sub">“{b?.epithet}” caiu. Cada fase foi uma etapa real da sua vida.</div>
      </>;
    } else if (cine.kind === 'campaign_done') {
      const c = useGame.getState().s.campaigns.find((x) => x.id === cine.id);
      color = '#ffd166';
      content = <>
        <div className="label">[ CAMPANHA CONCLUÍDA ]</div>
        <div className="big" style={{ fontSize: 'clamp(1.8rem, 8vw, 3.4rem)' }}>{c?.title}</div>
        <div className="sub">Você pode repeti-la com dificuldade maior em Mundo → Campanhas.</div>
      </>;
    }
  }

  if (cine?.kind === 'chapter') {
    const ch = CHAPTERS.find((c) => c.id === cine.id)!;
    return <>
      <StoryReader chapter={ch} onClose={() => { act((d) => { if (!d.storySeen.includes(ch.id)) d.storySeen.push(ch.id); }); setCine(null); }} />
      <Toasts toasts={toasts} />
    </>;
  }

  return (
    <>
      {cine && (
        <div className={`cine ${quick ? 'quick' : ''}`} style={{ '--cc': color } as React.CSSProperties} onClick={() => setCine(null)} role="dialog">
          <div className="burst" />
          <div className="ringfx" />
          {!quick && <div className="shards">{shards.map((s, i) => <i key={i} style={{ '--r': s.r, '--x': s.x, '--y': s.y } as React.CSSProperties} />)}</div>}
          <div className="content">{content}</div>
          <div className="tap">TOQUE PARA CONTINUAR</div>
        </div>
      )}
      <Toasts toasts={toasts} />
    </>
  );
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`} style={t.color ? ({ '--rc': t.color } as React.CSSProperties) : undefined}>{t.text}</div>)}
    </div>
  );
}
