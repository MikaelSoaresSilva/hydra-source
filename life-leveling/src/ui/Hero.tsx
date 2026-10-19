import { useMemo, useState } from 'react';
import { useGame } from '../store/game';
import { useDerived } from './hooks';
import { ItemCell, ItemIcon, LineChart, MiniBar, Modal, Panel, Radar, SlotIcon, Tabs } from './components';
import { ATTRS } from '../data/attributes';
import { ATTR_KEYS, SLOTS, type AttrKey, type Slot } from '../core/types';
import { attrLevel, rankChecks, DEFAULT_RANK_RULES } from '../core/progression';
import { ITEMS, ITEM_MAP, RARITY_INFO, SETS, SLOT_INFO, type ItemDef } from '../data/items';
import { BRANCHES, SKILLS } from '../data/skills';
import { ACHIEVEMENTS } from '../data/achievements';
import { achCtx, equipItem, learnSkill, owns, playerLevel, resetSkills, setsCompleted, skillPoints, unequipSlot } from '../core/engine';
import { Creator } from './Creator';
import { addDays, dayKey, uid } from '../core/util';
import { sfx } from '../services/audio';

type HeroTab = 'status' | 'equip' | 'talentos' | 'colecao' | 'conquistas' | 'aparencia' | 'rank';

export function HeroScreen() {
  const [tab, setTab] = useState<HeroTab>('status');
  return (
    <div className="screen-inner">
      <h1>Herói</h1>
      <Tabs value={tab} onChange={setTab} options={[['status', 'Status'], ['equip', 'Equipamentos'], ['talentos', 'Talentos'], ['colecao', 'Coleção'], ['conquistas', 'Conquistas'], ['rank', 'Rank'], ['aparencia', 'Aparência']]} />
      {tab === 'status' && <Status />}
      {tab === 'equip' && <Equipment />}
      {tab === 'talentos' && <Talents />}
      {tab === 'colecao' && <Collection />}
      {tab === 'conquistas' && <Achievements />}
      {tab === 'rank' && <RankView />}
      {tab === 'aparencia' && <Appearance />}
    </div>
  );
}

function Status() {
  const d = useDerived();
  const s = d.s;
  const [open, setOpen] = useState<AttrKey | null>(null);
  const history = useMemo(() => {
    // XP total acumulado nos últimos 30 dias (indicador do jogo)
    const days = Array.from({ length: 30 }).map((_, i) => addDays(dayKey(), i - 29));
    let acc = s.ledger.filter((e) => e.day < days[0]).reduce((t, e) => t + e.xp, 0);
    return days.map((day) => { acc += s.ledger.filter((e) => e.day === day).reduce((t, e) => t + e.xp, 0); return { x: day, y: acc }; });
  }, [s.ledger]);
  const recent = useMemo(() => {
    const out = Object.fromEntries(ATTR_KEYS.map((k) => [k, 0])) as Record<AttrKey, number>;
    const from = addDays(dayKey(), -13);
    for (const e of s.ledger) if (e.day >= from) for (const [k, v] of Object.entries(e.attrs)) out[k as AttrKey] += v ?? 0;
    return out;
  }, [s.ledger]);
  return (
    <>
      <Panel title="Painel de status">
        <div className="mono small" style={{ lineHeight: 1.8 }}>
          <div>JOGADOR: <b>{s.character.name}</b></div>
          <div>LEVEL: <b>{d.lv.level}</b> · RANK: <b style={{ color: d.rankColor }}>{d.rank}</b></div>
          <div>CLASSE: <b>{d.cls.name.toUpperCase()}</b>{d.title ? ` · TÍTULO: ${d.title}` : ''}</div>
          <div>XP: {d.lv.into} / {d.lv.need}</div>
        </div>
        <Radar levels={d.attrLevels} />
        <p className="small muted">Os números de atributo são <b>indicadores do jogo</b>, não diagnósticos nem medições científicas. Dados reais (cargas, horas, valores) ficam no módulo Vida.</p>
      </Panel>
      <Panel title="Atributos" right={<span className="small muted">toque para detalhes</span>}>
        {ATTR_KEYS.map((k) => {
          const al = attrLevel(d.attrXp[k]);
          const neglected = recent[k] === 0;
          return (
            <div key={k} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => setOpen(open === k ? null : k)}>
              <div className="row between"><span>{ATTRS[k].name} {neglected && d.attrXp[k] > 0 && <span className="chip" style={{ color: 'var(--warn)' }}>parado há 14d</span>}{recent[k] > 0 && <span className="chip" style={{ color: 'var(--good)' }}>+{recent[k]} recente</span>}</span><b className="mono" style={{ color: ATTRS[k].color }}>Nv {al.level}</b></div>
              <MiniBar value={al.into} max={al.need} color={ATTRS[k].color} />
              {open === k && (
                <div className="small" style={{ marginTop: 6 }}>
                  <p><b>Como evoluir:</b> {ATTRS[k].how}</p>
                  <p className="muted">Dado real relacionado: {ATTRS[k].real}. XP de atributo: {d.attrXp[k]} ({al.into}/{al.need} para o próximo nível).</p>
                  <AttrHistory attr={k} />
                </div>
              )}
            </div>
          );
        })}
      </Panel>
      <Panel title="Evolução de XP (30 dias)"><LineChart series={[{ name: 'XP total', color: '#4cc9ff', points: history }]} /></Panel>
    </>
  );
}

function AttrHistory({ attr }: { attr: AttrKey }) {
  const s = useGame((x) => x.s);
  const rows = s.ledger.filter((e) => (e.attrs[attr] ?? 0) > 0).slice(-6).reverse();
  if (!rows.length) return <p className="muted">Sem histórico ainda.</p>;
  return <ul className="muted" style={{ paddingLeft: 16, margin: 0 }}>{rows.map((r) => <li key={r.id}>{r.day.split('-').reverse().slice(0, 2).join('/')} · {r.label} (+{r.attrs[attr]})</li>)}</ul>;
}

function statLine(it?: ItemDef) {
  const e = it?.effect;
  if (!e) return 'Cosmético';
  return [e.atk && `ATK +${e.atk}`, e.def && `DEF +${e.def}`, e.hp && `HP +${e.hp}`, e.spd && `VEL +${e.spd}`, e.energy && `Energia +${e.energy}`, e.attrBonus && `+${e.attrBonus.pct}% XP de ${ATTRS[e.attrBonus.attr].name}`].filter(Boolean).join(' · ') || 'Cosmético';
}

function Equipment() {
  const d = useDerived();
  const s = d.s;
  const act = useGame((x) => x.act);
  const [sel, setSel] = useState<string | null>(null);
  const [slotFilter, setSlotFilter] = useState<Slot | 'todos'>('todos');
  const [outfitName, setOutfitName] = useState('');
  const owned = [...new Set(s.inventory.map((i) => i.itemId))].filter((id) => ITEM_MAP[id]);
  const list = owned.filter((id) => slotFilter === 'todos' || ITEM_MAP[id].slot === slotFilter);
  const item = sel ? ITEM_MAP[sel] : undefined;
  const current = item ? ITEM_MAP[s.character.equipped[item.slot] ?? ''] : undefined;
  return (
    <>
      <Panel title="Equipado">
        <div className="slot-row">{SLOTS.map((sl) => <SlotIcon key={sl} slot={SLOT_INFO[sl] as Slot} itemId={s.character.equipped[sl]} onClick={() => s.character.equipped[sl] ? setSel(s.character.equipped[sl]!) : setSlotFilter(sl)} />)}</div>
        <div className="row gap wrap" style={{ marginTop: 10 }}>
          <input type="text" placeholder="Nome do visual" value={outfitName} onChange={(e) => setOutfitName(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <button className="btn small" disabled={!outfitName.trim()} onClick={() => { act((dr) => { dr.character.outfits.push({ id: uid('o'), name: outfitName.trim(), equipped: { ...dr.character.equipped } }); }); setOutfitName(''); }}>Salvar visual</button>
        </div>
        {s.character.outfits.length > 0 && <div className="row gap wrap" style={{ marginTop: 8 }}>{s.character.outfits.map((o) => (
          <span key={o.id} className="chip"><button className="chip" style={{ border: 'none' }} onClick={() => act((dr) => { dr.character.equipped = Object.fromEntries(Object.entries(o.equipped).filter(([, id]) => id && owns(dr, id))); })}>★ {o.name}</button><button className="chip" style={{ border: 'none' }} onClick={() => act((dr) => { dr.character.outfits = dr.character.outfits.filter((x) => x.id !== o.id); })}>✕</button></span>
        ))}</div>}
      </Panel>
      <Panel title={`Inventário (${owned.length})`}>
        <div className="tabs">{(['todos', ...SLOTS] as const).map((sl) => <button key={sl} className={`tab ${slotFilter === sl ? 'on' : ''}`} onClick={() => setSlotFilter(sl)}>{sl === 'todos' ? 'Todos' : SLOT_INFO[sl]}</button>)}</div>
        <div className="inv-grid">{list.map((id) => <ItemCell key={id} itemId={id} owned equipped={Object.values(s.character.equipped).includes(id)} onClick={() => setSel(id)} />)}</div>
        {!list.length && <p className="muted small">Nenhum item nesta categoria. Itens vêm de níveis, conquistas, chefes, sequências e da Arena.</p>}
      </Panel>
      {item && (
        <Modal onClose={() => setSel(null)} title={item.name}>
          <div className="row gap2">
            <div style={{ width: 90, height: 90, flex: '0 0 auto' }} className="item-cell" data-r={item.rarity}><ItemIcon item={item} /></div>
            <div>
              <span className="chip" style={{ color: RARITY_INFO[item.rarity].color, borderColor: RARITY_INFO[item.rarity].color }}>{RARITY_INFO[item.rarity].name}</span> <span className="chip">{SLOT_INFO[item.slot]}</span>
              <p style={{ marginTop: 6 }}>{item.desc}</p>
              <p className="small mono">{statLine(item)}</p>
              {item.set && <p className="small" style={{ color: 'var(--gold)' }}>Conjunto: {SETS[item.set].name}</p>}
              <p className="small muted">Origem: {item.source}{item.req?.level ? ` · requer nível ${item.req.level}` : ''}</p>
            </div>
          </div>
          {current && current.id !== item.id && <p className="small muted" style={{ marginTop: 8 }}>Comparar com equipado ({current.name}): {statLine(current)}</p>}
          <div className="row gap" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            {s.character.equipped[item.slot] === item.id
              ? <button className="btn" onClick={() => act((dr) => unequipSlot(dr, item.slot))}>Desequipar</button>
              : <button className="btn primary" disabled={!owns(s, item.id)} onClick={() => { sfx('item'); act((dr, ev) => equipItem(dr, ev, item.id)); setSel(null); }} data-testid="equip">Equipar</button>}
          </div>
        </Modal>
      )}
    </>
  );
}

function Talents() {
  const d = useDerived();
  const s = d.s;
  const act = useGame((x) => x.act);
  const pts = skillPoints(s);
  const lvl = playerLevel(s);
  return (
    <>
      <Panel title="Pontos de talento" right={<button className="chip" onClick={() => { if (confirm('Redistribuir todos os pontos?')) act((dr) => resetSkills(dr)); }}>redistribuir</button>}>
        <p><b className="mono" style={{ fontSize: '1.4rem', color: 'var(--blue)' }}>{pts.free}</b> livres de {pts.total}. Você ganha 1 ponto por nível e 1 por missão de domínio concluída.</p>
        <p className="small muted">Talentos ativos aparecem como botões de habilidade na Arena (as 2 de maior rank). Passivos melhoram seus atributos de combate.</p>
      </Panel>
      {Object.entries(BRANCHES).map(([bid, b]) => (
        <div key={bid} className="branch" style={{ '--bc': b.color } as React.CSSProperties}>
          <h3 style={{ color: b.color }}>{b.name} <span className="small muted">— {b.desc}</span>{d.cls.branch === bid && <span className="chip" style={{ marginLeft: 6 }}>classe</span>}</h3>
          {SKILLS.filter((sk) => sk.branch === bid).map((sk) => {
            const r = s.skills[sk.id] ?? 0;
            const prereqOk = !sk.prereq || (s.skills[sk.prereq] ?? 0) > 0;
            const can = r < sk.maxRank && lvl >= sk.reqLevel && prereqOk && pts.free >= sk.cost;
            return (
              <div key={sk.id} className={`skill ${r ? 'learned' : ''}`}>
                <div className="grow">
                  <div className="row between"><b>{sk.name}{sk.active ? ' ⚡' : ''}</b><div className="pips">{Array.from({ length: sk.maxRank }).map((_, i) => <i key={i} className={i < r ? 'on' : ''} />)}</div></div>
                  <p className="small muted" style={{ margin: '2px 0' }}>{sk.desc}{sk.active ? ` Custo ${sk.active.energy} energia, recarga ${sk.active.cooldown}s.` : ''}</p>
                  <p className="small" style={{ margin: 0, color: lvl < sk.reqLevel || !prereqOk ? 'var(--warn)' : 'var(--muted)' }}>Nível {sk.reqLevel}{sk.prereq ? ` · requer ${SKILLS.find((x) => x.id === sk.prereq)!.name}` : ''} · custa {sk.cost} ponto(s)</p>
                </div>
                <button className="btn small" disabled={!can} onClick={() => { sfx('skill'); act((dr, ev) => learnSkill(dr, ev, sk.id)); }}>{r ? '+1' : 'Aprender'}</button>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function Collection() {
  const s = useGame((x) => x.s);
  const [sel, setSel] = useState<ItemDef | null>(null);
  const done = setsCompleted(s);
  const ownedCount = ITEMS.filter((i) => owns(s, i.id)).length;
  return (
    <>
      <Panel title={`Catálogo · ${ownedCount}/${ITEMS.length} descobertos`}>
        <MiniBar value={ownedCount} max={ITEMS.length} color="#ffd166" />
        <div className="inv-grid" style={{ marginTop: 10 }}>{ITEMS.map((i) => <ItemCell key={i.id} itemId={i.id} owned={owns(s, i.id)} onClick={() => setSel(i)} />)}</div>
      </Panel>
      <Panel title="Conjuntos">
        {Object.entries(SETS).map(([id, set]) => {
          const pieces = ITEMS.filter((i) => i.set === id);
          const have = pieces.filter((p) => owns(s, p.id)).length;
          return (
            <div key={id} style={{ marginBottom: 10 }}>
              <div className="row between"><b style={{ color: done.includes(id) ? 'var(--gold)' : undefined }}>{set.name}</b><span className="mono small">{have}/{pieces.length}</span></div>
              <p className="small muted" style={{ margin: '2px 0' }}>{set.desc} Bônus visual: {set.bonus}.</p>
              <MiniBar value={have} max={pieces.length} color="#ffd166" />
            </div>
          );
        })}
      </Panel>
      {sel && <Modal onClose={() => setSel(null)} title={owns(s, sel.id) ? sel.name : '???'}>
        <p>{owns(s, sel.id) ? sel.desc : 'Item ainda não descoberto.'}</p>
        <p className="small"><span className="chip" style={{ color: RARITY_INFO[sel.rarity].color }}>{RARITY_INFO[sel.rarity].name}</span> <span className="chip">{SLOT_INFO[sel.slot]}</span></p>
        <p className="small muted">Como obter: {sel.source}</p>
      </Modal>}
    </>
  );
}

function Achievements() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const ctx = achCtx(s);
  const unlocked = ACHIEVEMENTS.filter((a) => s.achievements[a.id]);
  return (
    <>
      <Panel title={`Conquistas · ${unlocked.length}/${ACHIEVEMENTS.length}`}>
        <label className="field">Título exibido
          <select value={s.character.titleId ?? ''} onChange={(e) => act((d) => { d.character.titleId = e.target.value || undefined; })}>
            <option value="">Nome da classe</option>
            {unlocked.filter((a) => a.title).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </label>
      </Panel>
      {ACHIEVEMENTS.map((a) => {
        const on = !!s.achievements[a.id];
        const hidden = a.secret && !on;
        const pr = a.progress?.(ctx);
        return (
          <div key={a.id} className={`ach ${on ? 'on' : ''}`}>
            <div className="medal">{on ? '★' : hidden ? '?' : '☆'}</div>
            <div className="grow">
              <b>{hidden ? 'Conquista secreta' : a.name}</b>
              <p className="small muted" style={{ margin: 0 }}>{hidden ? 'Continue jogando para descobrir.' : a.desc} {!hidden && <span className="mono">+{a.xp} XP</span>}{a.title && !hidden ? ` · título “${a.title}”` : ''}{a.itemId && !hidden ? ` · ${ITEM_MAP[a.itemId].name}` : ''}</p>
              {!on && !hidden && pr && <MiniBar value={pr[0]} max={pr[1]} color="#ffd166" />}
              {on && <p className="small muted" style={{ margin: 0 }}>Obtida em {new Date(s.achievements[a.id]).toLocaleDateString('pt-BR')}</p>}
            </div>
          </div>
        );
      })}
    </>
  );
}

function RankView() {
  const d = useDerived();
  const s = d.s;
  const act = useGame((x) => x.act);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Panel title="Rank atual">
        <div className="row gap2"><div className="rank-badge" style={{ color: d.rankColor }}>{d.rank}</div><p className="small muted" style={{ margin: 0 }}>A promoção usa critérios objetivos: nível, melhor sequência (nunca diminui), chefes de objetivo derrotados e equilíbrio de atributos. Você pode ajustar os critérios.</p></div>
      </Panel>
      {s.settings.rankRules.slice(1).map((rule) => {
        const checks = rankChecks(rule, d.rc);
        const ok = checks.every((c) => c.ok);
        return (
          <Panel key={rule.rank} title={`Rank ${rule.rank}`} right={ok ? <span className="chip" style={{ color: 'var(--good)' }}>alcançado</span> : undefined}>
            {checks.map((c) => <div key={c.label} className="row between small"><span>{c.ok ? '✔' : '○'} {c.label}</span><span className="mono">{c.cur}/{c.req}</span></div>)}
          </Panel>
        );
      })}
      <button className="btn" onClick={() => setEditing(true)}>Configurar critérios</button>
      {editing && (
        <Modal onClose={() => setEditing(false)} title="Critérios de rank">
          {s.settings.rankRules.slice(1).map((rule, i) => (
            <div key={rule.rank} className="panel" style={{ padding: 10 }}>
              <b>Rank {rule.rank}</b>
              <div className="row gap wrap">
                {(['minLevel', 'minBestStreak', 'minBosses', 'minAttrLevel', 'minAttrCount'] as const).map((f) => (
                  <label key={f} className="field" style={{ width: 120 }}>{{ minLevel: 'Nível', minBestStreak: 'Sequência', minBosses: 'Chefes', minAttrLevel: 'Nv atributo', minAttrCount: 'Qtd atributos' }[f]}
                    <input type="number" min={0} value={rule[f]} onChange={(e) => act((dr) => { dr.settings.rankRules[i + 1][f] = Math.max(0, Number(e.target.value) || 0); })} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button className="btn ghost" onClick={() => act((dr) => { dr.settings.rankRules = DEFAULT_RANK_RULES.map((r) => ({ ...r })); })}>Restaurar padrão</button>
        </Modal>
      )}
    </>
  );
}

function Appearance() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  return <Creator character={s.character} onChange={(a) => act((d) => { d.character.appearance = a; })} quality={s.settings.graphics} />;
}
