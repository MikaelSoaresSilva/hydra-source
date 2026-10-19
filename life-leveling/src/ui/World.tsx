import { useState } from 'react';
import { useGame } from '../store/game';
import { useDerived } from './hooks';
import { BossArt, MiniBar, Modal, Panel, Tabs } from './components';
import { bossProgress, createCampaign, recordArenaWin, repeatCampaign, seasonProgress, startSeason, storyCtx, unlockedChapters } from '../core/engine';
import { CHAPTERS, SCENES, type Chapter } from '../data/story';
import { DUNGEONS, activeSkills, computeCombatStats, type DungeonDef } from '../core/combat';
import { ArenaGame } from '../three/ArenaGame';
import { MissionCard } from './Missions';
import { aiCampaign, markUsage } from '../services/ai';
import { pickTemplate } from '../data/campaigns';
import { RANKS } from '../core/progression';
import { ITEM_MAP } from '../data/items';
import { sfx } from '../services/audio';
import type { Boss } from '../core/types';

export function StoryReader({ chapter, onClose }: { chapter: Chapter; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const last = page >= chapter.pages.length - 1;
  return (
    <div className="cine" style={{ '--cc': '#8b6cff', cursor: 'default' } as React.CSSProperties}>
      <div className="burst" />
      <div className="content" style={{ maxWidth: 560 }}>
        <div className="label">CAPÍTULO {chapter.num}</div>
        <div className="big" style={{ fontSize: 'clamp(2rem, 9vw, 3.6rem)' }}>{chapter.title}</div>
        <p className="story-page" key={page} style={{ marginTop: 18 }}>{chapter.pages[page]}</p>
        <p className="small muted">Região: {SCENES[chapter.region].name} · Objetivo: {chapter.objective}</p>
        <div className="row gap" style={{ justifyContent: 'center', marginTop: 14 }}>
          {page > 0 && <button className="btn ghost" onClick={() => setPage(page - 1)}>Voltar</button>}
          <button className="btn primary" onClick={() => { sfx('click'); if (last) onClose(); else setPage(page + 1); }}>{last ? 'Continuar' : 'Próximo'}</button>
        </div>
      </div>
    </div>
  );
}

function BossIntro({ boss, onClose }: { boss: Boss; onClose: () => void }) {
  return (
    <div className="cine" style={{ '--cc': '#ff2a6a' } as React.CSSProperties} onClick={onClose}>
      <div className="burst" /><div className="ringfx" />
      <div className="content" style={{ maxWidth: 560 }}>
        <div className="label">[ UMA PRESENÇA HOSTIL FOI DETECTADA ]</div>
        <BossArt boss={boss} height={170} />
        <div className="big" style={{ fontSize: 'clamp(2rem, 9vw, 3.4rem)' }}>{boss.name}</div>
        <div className="sub">{boss.epithet}</div>
        <p style={{ marginTop: 12 }}>{boss.lore}</p>
        <p className="small muted">Este é um chefe de objetivo pessoal: ele só perde vida quando você conclui etapas reais.</p>
      </div>
      <div className="tap">TOQUE PARA ENFRENTAR</div>
    </div>
  );
}

export function WorldScreen() {
  const [tab, setTab] = useState<'capitulos' | 'campanhas' | 'chefes' | 'arena' | 'temporadas'>('campanhas');
  return (
    <div className="screen-inner">
      <h1>Mundo</h1>
      <Tabs value={tab} onChange={setTab} options={[['campanhas', 'Campanhas'], ['chefes', 'Chefes'], ['arena', 'Arena 3D'], ['capitulos', 'História'], ['temporadas', 'Temporadas']]} />
      {tab === 'capitulos' && <Chapters />}
      {tab === 'campanhas' && <Campaigns />}
      {tab === 'chefes' && <Bosses />}
      {tab === 'arena' && <Arena />}
      {tab === 'temporadas' && <Seasons />}
    </div>
  );
}

function Chapters() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [reading, setReading] = useState<Chapter | null>(null);
  const unlocked = unlockedChapters(s);
  const ctx = storyCtx(s);
  return (
    <>
      {CHAPTERS.map((ch) => {
        const open = unlocked.includes(ch.id);
        const [c, t] = ch.progress(ctx);
        return (
          <div key={ch.id} className={`chapter ${open ? '' : 'locked'}`} onClick={() => open && setReading(ch)}>
            <div className="num">CAPÍTULO {ch.num}{!s.storySeen.includes(ch.id) && open ? ' · NOVO' : ''}</div>
            <h3 style={{ margin: '2px 0' }}>{open ? ch.title : '???'}</h3>
            <p className="small muted" style={{ margin: '0 0 6px' }}>{open ? ch.objective : 'Continue evoluindo para desbloquear.'}</p>
            {open && <MiniBar value={c} max={t} color="#8b6cff" />}
          </div>
        );
      })}
      {reading && <StoryReader chapter={reading} onClose={() => { act((d) => { if (!d.storySeen.includes(reading.id)) d.storySeen.push(reading.id); }); setReading(null); }} />}
    </>
  );
}

function Campaigns() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const preview = goal.trim().length >= 3 ? pickTemplate(goal) : null;

  const create = async (useAi: boolean) => {
    setMsg('');
    if (useAi) {
      setBusy(true);
      const r = await aiCampaign(useGame.getState().s, goal);
      setBusy(false);
      if (!r.ok) { setMsg(`IA indisponível (${r.error}). Usando o gerador offline.`); act((d, ev) => createCampaign(d, ev, goal)); }
      else act((d, ev) => { markUsage(d); createCampaign(d, ev, goal, new Date(), r.value, 'ia'); });
    } else act((d, ev) => createCampaign(d, ev, goal));
    setGoal('');
  };

  return (
    <>
      <Panel title="Novo objetivo → nova campanha">
        <p className="small muted">Escreva qualquer objetivo. O SISTEMA divide em fases, missões com prazos realistas e um chefe.</p>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder='Ex.: "Quero economizar R$ 3.000 para um notebook"' aria-label="Objetivo" />
        {preview && <p className="small" style={{ marginTop: 6 }}>Prévia offline: <b>{preview.title}</b> · Chefe <b>{preview.boss.name}</b> · {preview.phases.length} fases</p>}
        <div className="row gap wrap" style={{ marginTop: 8 }}>
          <button className="btn primary" disabled={!preview || busy} onClick={() => create(false)} data-testid="create-campaign">Criar campanha</button>
          {s.settings.ai.enabled && s.settings.ai.apiKey && <button className="btn" disabled={!preview || busy} onClick={() => create(true)}>{busy ? 'Gerando com IA…' : 'Gerar personalizada com IA'}</button>}
        </div>
        {msg && <p className="small" style={{ color: 'var(--warn)', marginTop: 6 }}>{msg}</p>}
      </Panel>
      {s.campaigns.length === 0 && <p className="muted center">Nenhuma campanha ainda.</p>}
      {[...s.campaigns].reverse().map((c) => {
        const ms = c.missionIds.map((id) => s.missions.find((m) => m.id === id)).filter(Boolean);
        const core = ms.filter((m) => m!.recurrence === 'unica' && m!.status !== 'cancelada');
        const done = core.filter((m) => m!.status === 'concluida').length;
        const boss = s.bosses.find((b) => b.id === c.bossId);
        return (
          <Panel key={c.id} title={c.status === 'concluida' ? 'Campanha concluída' : c.source === 'ia' ? 'Campanha (IA validada)' : 'Campanha'} right={c.repeatCount ? <span className="chip">+{c.repeatCount}</span> : undefined}>
            <h3>{c.title}</h3>
            <p className="small muted">{c.summary}</p>
            <div className="row between small mono"><span>{done}/{core.length} missões principais</span>{boss && <span style={{ color: '#ff8aa8' }}>⚔ {boss.name}</span>}</div>
            <MiniBar value={done} max={core.length} color={c.status === 'concluida' ? '#ffd166' : '#4cc9ff'} />
            <div className="row gap wrap" style={{ marginTop: 8 }}>
              <button className="btn small" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Ocultar missões' : 'Ver missões'}</button>
              {c.status === 'concluida' && <button className="btn small" onClick={() => act((d, ev) => repeatCampaign(d, ev, c.id))}>Repetir com dificuldade maior</button>}
              {c.status === 'ativa' && <button className="btn small ghost" onClick={() => { if (confirm('Arquivar campanha? As missões continuam no histórico.')) act((d) => { const x = d.campaigns.find((y) => y.id === c.id)!; x.status = 'arquivada'; x.updatedAt = new Date().toISOString(); }); }}>Arquivar</button>}
            </div>
            {open === c.id && <div style={{ marginTop: 10 }}>{ms.map((m) => <MissionCard key={m!.id} m={m!} compact />)}</div>}
          </Panel>
        );
      })}
    </>
  );
}

function Bosses() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [intro, setIntro] = useState<Boss | null>(null);
  const [view, setView] = useState<string | null>(null);
  if (!s.bosses.length) return <p className="muted center">Chefes aparecem quando você cria campanhas a partir de objetivos.</p>;
  return (
    <>
      <p className="small muted">Chefes de objetivo são desafios gamificados: a barra de vida representa etapas reais. Para combate em tempo real, use a aba Arena 3D.</p>
      {[...s.bosses].sort((a, b) => Number(!!a.defeatedAt) - Number(!!b.defeatedAt)).map((b) => {
        const p = bossProgress(b, s.missions);
        return (
          <Panel key={b.id} className="boss-card" title={b.defeatedAt ? 'Derrotado' : `Fase ${Math.max(1, p.current + 1)}/${b.phases.length}`}>
            <div onClick={() => { if (!b.introSeen && !b.defeatedAt) setIntro(b); else setView(view === b.id ? null : b.id); }} style={{ cursor: 'pointer' }}>
              <BossArt boss={b} hp={p.hp} />
              <div className="row between" style={{ marginTop: 8 }}><h3 style={{ margin: 0 }}>{b.name}</h3><span className="mono small">{Math.round(p.hp * 100)}% HP</span></div>
              <p className="small muted" style={{ margin: '2px 0 6px' }}>{b.epithet}</p>
              <div className="boss-hp"><i style={{ width: `${p.hp * 100}%` }} />{b.phases.slice(1).map((_, i) => <span key={i} className="seg" style={{ left: `${((i + 1) / b.phases.length) * 100}%` }} />)}</div>
            </div>
            {(view === b.id || (!b.defeatedAt && b.introSeen)) && (
              <div style={{ marginTop: 8 }}>
                {p.phases.map((ph, i) => (
                  <div key={ph.id} className={`phase ${ph.cleared ? 'cleared' : i === p.current ? 'current' : ''}`}>
                    <div className="row between"><b>{ph.name}</b><span className="small mono">{ph.cleared ? 'VENCIDA' : `${ph.done}/${ph.total}`}</span></div>
                    {i === p.current && ph.missionIds.map((id) => { const m = s.missions.find((x) => x.id === id); return m && m.status === 'ativa' ? <MissionCard key={id} m={m} compact /> : null; })}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        );
      })}
      {intro && <BossIntro boss={intro} onClose={() => { sfx('boss'); act((d) => { const x = d.bosses.find((y) => y.id === intro.id); if (x) x.introSeen = true; }); setView(intro.id); setIntro(null); }} />}
    </>
  );
}

function Arena() {
  const d = useDerived();
  const s = d.s;
  const act = useGame((x) => x.act);
  const [playing, setPlaying] = useState<DungeonDef | null>(null);
  const stats = computeCombatStats(s);
  const skills = activeSkills(s);
  return (
    <>
      <Panel title="Seus atributos de combate">
        <div className="stat-tiles">
          <div className="tile"><b>{stats.hp}</b><span>VIDA</span></div>
          <div className="tile"><b>{stats.atk}</b><span>ATAQUE</span></div>
          <div className="tile"><b>{stats.def}</b><span>DEFESA</span></div>
          <div className="tile"><b>{stats.spd.toFixed(1)}</b><span>VELOC.</span></div>
          <div className="tile"><b>{Math.round(stats.crit * 100)}%</b><span>CRÍTICO</span></div>
          <div className="tile"><b>{skills.length}</b><span>HABILIDADES</span></div>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Ataque, golpe pesado, combo e esquiva estão sempre liberados. A evolução real (nível, atributos, itens e talentos) deixa você mais forte. Derrotas não tiram progresso.</p>
      </Panel>
      {DUNGEONS.map((dg) => {
        const locked = d.rankIndex < dg.minRankIndex;
        const rec = s.arena.find((a) => a.dungeonId === dg.id);
        return (
          <Panel key={dg.id} title={locked ? `Requer rank ${RANKS[dg.minRankIndex]}` : rec?.wins ? `Vencida ${rec.wins}x · melhor ${rec.bestTimeSec}s` : 'Disponível'}>
            <h3>{dg.name}</h3>
            <p className="small muted">{dg.desc}</p>
            <p className="small">Primeira vitória: +{dg.firstXp} XP{dg.rewardItemId ? ` · ${ITEM_MAP[dg.rewardItemId].name}` : ''}</p>
            <button className="btn primary" disabled={locked} onClick={() => { sfx('open'); setPlaying(dg); }} data-testid={`play-${dg.id}`}>Entrar na Fenda</button>
          </Panel>
        );
      })}
      {playing && (
        <ArenaGame dungeon={playing} stats={stats} skills={skills} character={s.character} classColor={d.cls.color} quality={s.settings.graphics}
          onEnd={(won, c) => { if (won) act((dr, ev) => recordArenaWin(dr, ev, playing.id, c.t, playing.rewardItemId, playing.firstXp)); }}
          onExit={() => setPlaying(null)} />
      )}
    </>
  );
}

function Seasons() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [summary, setSummary] = useState<string | null>(null);
  const active = s.seasons.find((x) => !x.endedAt);
  const weekend = [0, 5, 6].includes(new Date().getDay());
  return (
    <>
      {active ? (() => {
        const p = seasonProgress(s, active.id);
        return (
          <Panel title={`Temporada ativa · ${p.daysLeft} dia(s) restantes`}>
            <h3>{active.theme}</h3>
            <p className="small muted">Metas baseadas no seu próprio ritmo recente, com folga: dá para alcançar mesmo ficando alguns dias sem entrar.</p>
            <Line label="XP" c={p.xp} t={active.targets.xp} color="#4cc9ff" />
            <Line label="Missões" c={p.missions} t={active.targets.missions} color="#c06bff" />
            <Line label="Dias ativos" c={p.activeDays} t={active.targets.activeDays} color="#5fd38d" />
            <p className="small" style={{ marginTop: 8 }}>Recompensas: {[1, 2, 3].map((t) => <span key={t} className="chip" style={active.claimedTiers.includes(t) ? { borderColor: '#ffd166', color: '#ffd166' } : undefined}>Nível {t}{t === 3 ? ' + Insígnia' : ''}</span>)}</p>
          </Panel>
        );
      })() : (
        <Panel title="Iniciar temporada pessoal">
          <p className="small muted">Uma temporada é um ciclo com metas, recompensas em 3 níveis e um resumo final. Escolha a duração:</p>
          <div className="row gap">{([30, 60, 90] as const).map((n) => <button key={n} className="btn" onClick={() => act((d, ev) => startSeason(d, ev, n))}>{n} dias</button>)}</div>
        </Panel>
      )}
      <Panel title="Evento">
        {weekend ? <><h3>Desafio de Fim de Semana: Brasas do Descanso</h3><p className="small muted">Evento opcional: conclua qualquer 2 missões e 1 registro de autocuidado neste fim de semana. Não há perda por não participar.</p></>
          : <><h3>Próximo evento: fim de semana</h3><p className="small muted">Eventos são sempre opcionais e nunca escondem recompensas importantes atrás de prazos curtos.</p></>}
      </Panel>
      {s.seasons.filter((x) => x.endedAt).length > 0 && (
        <Panel title="Temporadas anteriores">
          {s.seasons.filter((x) => x.endedAt).map((x) => <div key={x.id} className="row between small" style={{ padding: '4px 0' }}><span>{x.theme} ({x.length}d)</span><button className="chip" onClick={() => setSummary(x.summary ?? '')}>resumo</button></div>)}
        </Panel>
      )}
      {summary !== null && <Modal onClose={() => setSummary(null)} title="Resumo da temporada"><p>{summary}</p></Modal>}
    </>
  );
}

function Line({ label, c, t, color }: { label: string; c: number; t: number; color: string }) {
  return <div style={{ marginBottom: 6 }}><div className="row between small"><span>{label}</span><span className="mono">{c}/{t}</span></div><MiniBar value={c} max={t} color={color} /></div>;
}
