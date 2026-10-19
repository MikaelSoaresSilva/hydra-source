import { useMemo, useState } from 'react';
import { useDerived } from './hooks';
import { Showcase } from '../three/Stage';
import { MiniBar, Panel, XpBar } from './components';
import { MissionCard } from './Missions';
import { dailyBriefing, priorityMission, closestAchievement } from '../core/gm';
import { effectiveStreak, unlockedChapters, isDoneThisPeriod } from '../core/engine';
import { ATTRS } from '../data/attributes';
import { ATTR_KEYS } from '../core/types';
import { CHAPTERS, SCENES, type SceneId } from '../data/story';
import { attrLevel } from '../core/progression';
import { dayKey } from '../core/util';
import type { Tab } from './App';

export function Home({ go }: { go: (t: Tab) => void }) {
  const d = useDerived();
  const s = d.s;
  const unlocked = unlockedChapters(s);
  const scenes = [...new Set(CHAPTERS.filter((c) => unlocked.includes(c.id)).map((c) => c.region))] as SceneId[];
  const [scene, setScene] = useState<SceneId>('santuario');
  const [anim, setAnim] = useState<'idle' | 'victory' | 'pose'>('idle');
  const pm = priorityMission(s);
  const streak = effectiveStreak(s);
  const brief = useMemo(() => dailyBriefing(s, s.settings.gmStyle), [s]);
  const close = closestAchievement(s);
  const today = dayKey();
  const todays = s.missions.filter((m) => m.status === 'ativa' && (m.recurrence === 'diaria' || m.deadline === today));
  const doneToday = todays.filter((m) => isDoneThisPeriod(m)).length;
  const topAttrs = [...ATTR_KEYS].sort((a, b) => d.attrXp[b] - d.attrXp[a]).slice(0, 6);
  const activeBoss = s.bosses.find((b) => !b.defeatedAt);

  return (
    <div className="screen-inner">
      <Panel>
        <div className="player-hud">
          <div className="rank-badge" style={{ color: d.rankColor }} title="Rank">{d.rank}</div>
          <div className="grow">
            <div className="row between"><b style={{ fontSize: '1.15rem' }} data-testid="player-name">{s.character.name}</b><span className="small muted">{d.title ?? d.cls.name}</span></div>
            <div className="row between small muted mono" style={{ margin: '4px 0' }}><span data-testid="xp-text">XP {d.lv.into} / {d.lv.need}</span><span>Total {d.xp}</span></div>
            <XpBar value={d.lv.into} max={d.lv.need} />
          </div>
          <div className="lvl center"><small>LEVEL</small><span data-testid="level">{d.lv.level}</span></div>
        </div>
      </Panel>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Showcase character={s.character} classColor={d.cls.color} scene={scene} anim={anim} rankGlow={d.rankGlow} quality={s.settings.graphics} height="min(52vh, 420px)" />
        <div className="stage-top">
          <span className="chip" style={{ background: 'rgba(0,0,0,0.5)' }}>{SCENES[scene].name}</span>
          <span className="chip" style={{ background: 'rgba(0,0,0,0.5)' }}>🔥 {streak} dia(s){s.streak.shields ? ` · 🛡${s.streak.shields}` : ''}</span>
        </div>
        <div className="stage-ui">
          {scenes.map((sc) => <button key={sc} className={`chip ${scene === sc ? 'sel' : ''}`} style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setScene(sc)}>{SCENES[sc].name.split(' ')[0] === 'O' || SCENES[sc].name.split(' ')[0] === 'A' ? SCENES[sc].name : SCENES[sc].name.split(' ')[0]}</button>)}
          <button className="chip" style={{ background: 'rgba(0,0,0,0.55)', marginLeft: 'auto' }} onClick={() => setAnim(anim === 'victory' ? 'idle' : anim === 'idle' ? 'pose' : 'victory')}>Pose</button>
        </div>
      </div>

      <Panel title="SISTEMA" right={<button className="chip" onClick={() => go('sistema')}>conversar</button>}>
        <p className={`small ${s.settings.gmStyle === 'sistema' ? 'mono' : ''}`} style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{brief}</p>
      </Panel>

      <Panel title="Missão prioritária" right={<span className="small muted">{doneToday}/{todays.length} de hoje</span>}>
        {pm ? <MissionCard m={pm} /> : <p className="muted">Nenhuma missão ativa. <button className="chip" onClick={() => go('mundo')}>Criar campanha</button> <button className="chip" onClick={() => go('missoes')}>Nova missão</button></p>}
        <button className="btn small ghost" onClick={() => go('missoes')}>Ver todas as missões →</button>
      </Panel>

      <div className="stat-tiles" style={{ marginBottom: 12 }}>
        <div className="tile"><b>{d.lv.level}</b><span>NÍVEL</span></div>
        <div className="tile"><b style={{ color: d.rankColor }}>{d.rank}</b><span>RANK</span></div>
        <div className="tile"><b>{streak}</b><span>SEQUÊNCIA</span></div>
        <div className="tile"><b>{s.streak.best}</b><span>RECORDE</span></div>
        <div className="tile"><b>{Object.keys(s.achievements).length}</b><span>CONQUISTAS</span></div>
        <div className="tile"><b>{s.bosses.filter((b) => b.defeatedAt).length}</b><span>CHEFES</span></div>
      </div>

      <Panel title="Atributos principais" right={<button className="chip" onClick={() => go('heroi')}>status completo</button>}>
        <div className="attr-grid">
          {topAttrs.map((k) => { const al = attrLevel(d.attrXp[k]); return (
            <div className="attr" key={k}><div className="top"><span>{ATTRS[k].name}</span><b style={{ color: ATTRS[k].color }}>{al.level}</b></div><MiniBar value={al.into} max={al.need} color={ATTRS[k].color} /></div>
          ); })}
        </div>
      </Panel>

      {activeBoss && (
        <Panel title="Chefe ativo" right={<button className="chip" onClick={() => go('mundo')}>ver</button>}>
          <b>{activeBoss.name}</b> <span className="muted small">— {activeBoss.epithet}</span>
        </Panel>
      )}
      {close && (
        <Panel title="Próxima conquista">
          <div className="row between"><b>{close.a.name}</b><span className="mono small">{close.c}/{close.t}</span></div>
          <p className="small muted" style={{ margin: '4px 0 6px' }}>{close.a.desc}</p>
          <MiniBar value={close.c} max={close.t} color="#ffd166" />
        </Panel>
      )}
      {!s.settings.notifications.enabled && (
        <Panel><p className="small muted" style={{ margin: 0 }}>Dica: ative lembretes do SISTEMA em <button className="chip" onClick={() => go('config')}>Configurações</button>. Você controla horários e frequência.</p></Panel>
      )}
    </div>
  );
}
