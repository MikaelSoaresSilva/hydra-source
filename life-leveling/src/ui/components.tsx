import type { ReactNode } from 'react';
import type { AttrKey, Boss, Slot } from '../core/types';
import { ATTR_KEYS } from '../core/types';
import { ATTRS } from '../data/attributes';
import { ITEM_MAP, RARITY_INFO, type ItemDef } from '../data/items';
import { seeded } from '../core/util';
import { sfx } from '../services/audio';

export function Modal({ onClose, children, title }: { onClose: () => void; children: ReactNode; title?: string }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="row between" style={{ marginBottom: 8 }}>
          {title ? <h2 style={{ margin: 0 }}>{title}</h2> : <span />}
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function XpBar({ value, max }: { value: number; max: number }) {
  return <div className="xpbar" role="progressbar" aria-valuenow={value} aria-valuemax={max}><i style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%` }} /></div>;
}

export function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return <div className="mini-bar"><i style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: color, boxShadow: `0 0 8px ${color}` }} /></div>;
}

export function Panel({ title, right, children, className = '' }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {title && <div className="panel-title"><span>{title}</span>{right}</div>}
      {children}
    </section>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={v === value} className={`tab ${v === value ? 'on' : ''}`} onClick={() => { sfx('click'); onChange(v); }}>{label}</button>
      ))}
    </div>
  );
}

/** Radar de atributos (SVG). */
export function Radar({ levels, size = 280 }: { levels: Record<AttrKey, number>; size?: number }) {
  const n = ATTR_KEYS.length;
  const cx = size / 2; const cy = size / 2; const R = size * 0.36;
  const max = Math.max(5, ...Object.values(levels));
  const pt = (i: number, r: number) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  const poly = ATTR_KEYS.map((k, i) => pt(i, (levels[k] / max) * R).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="chart" role="img" aria-label="Radar de atributos">
      <defs>
        <radialGradient id="rg"><stop offset="0%" stopColor="#8b6cff" stopOpacity="0.55" /><stop offset="100%" stopColor="#4cc9ff" stopOpacity="0.25" /></radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ATTR_KEYS.map((_, i) => pt(i, R * f).join(',')).join(' ')} fill="none" stroke="rgba(76,201,255,0.18)" />
      ))}
      {ATTR_KEYS.map((k, i) => { const [x, y] = pt(i, R); return <line key={k} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(76,201,255,0.12)" />; })}
      <polygon points={poly} fill="url(#rg)" stroke="#4cc9ff" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px #4cc9ff)' }} />
      {ATTR_KEYS.map((k, i) => {
        const [x, y] = pt(i, R + 18);
        const [px, py] = pt(i, (levels[k] / max) * R);
        return (
          <g key={k}>
            <circle cx={px} cy={py} r="3" fill={ATTRS[k].color} />
            <text x={x} y={y} fill="#8b97b5" fontSize="10" textAnchor="middle" dominantBaseline="middle" fontFamily="Share Tech Mono, monospace">{ATTRS[k].short} {levels[k]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Gráfico de linha simples com eixo. */
export function LineChart({ series, height = 140, unit = '' }: { series: { name: string; color: string; points: { x: string; y: number }[] }[]; height?: number; unit?: string }) {
  const W = 320; const H = height; const pad = { l: 34, r: 8, t: 10, b: 20 };
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort();
  const ys = series.flatMap((s) => s.points.map((p) => p.y));
  if (!xs.length) return <p className="muted small">Sem dados ainda. Registre atividades para ver o gráfico.</p>;
  const ymax = Math.max(1, ...ys); const ymin = Math.min(0, ...ys);
  const X = (x: string) => pad.l + (xs.length === 1 ? (W - pad.l - pad.r) / 2 : (xs.indexOf(x) / (xs.length - 1)) * (W - pad.l - pad.r));
  const Y = (y: number) => pad.t + (1 - (y - ymin) / (ymax - ymin || 1)) * (H - pad.t - pad.b);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
        {[0, 0.5, 1].map((f) => { const v = ymin + (ymax - ymin) * f; return <g key={f}><line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,0.07)" /><text x={pad.l - 4} y={Y(v)} fill="#8b97b5" fontSize="9" textAnchor="end" dominantBaseline="middle">{Math.round(v)}{unit}</text></g>; })}
        <text x={pad.l} y={H - 4} fill="#8b97b5" fontSize="9">{xs[0]?.slice(5)}</text>
        <text x={W - pad.r} y={H - 4} fill="#8b97b5" fontSize="9" textAnchor="end">{xs[xs.length - 1]?.slice(5)}</text>
        {series.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" points={s.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} style={{ filter: `drop-shadow(0 0 4px ${s.color})` }} />
            {s.points.map((p) => <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r="2.5" fill={s.color}><title>{`${p.x}: ${p.y}${unit}`}</title></circle>)}
          </g>
        ))}
      </svg>
      {series.length > 1 && <div className="legend">{series.map((s) => <span key={s.name}><b style={{ color: s.color }}>●</b> {s.name}</span>)}</div>}
    </div>
  );
}

export function Bars({ data, color = '#4cc9ff', height = 110 }: { data: { label: string; value: number }[]; color?: string; height?: number }) {
  const W = 320; const max = Math.max(1, ...data.map((d) => d.value)); const bw = (W - 10) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart">
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 22);
        return <g key={d.label}><rect x={5 + i * bw + 2} y={height - 14 - h} width={bw - 4} height={h} rx="3" fill={color} opacity={0.85}><title>{`${d.label}: ${d.value}`}</title></rect><text x={5 + i * bw + bw / 2} y={height - 3} fontSize="8" fill="#8b97b5" textAnchor="middle">{d.label}</text></g>;
      })}
    </svg>
  );
}

/** Ícones originais de itens (SVG vetorial por tipo de slot e variante). */
export function ItemIcon({ item, size }: { item: ItemDef; size?: number }) {
  const c = item.visual.color; const e = item.visual.emissive ?? RARITY_INFO[item.rarity].color;
  const st = size ? { width: size, height: size } : undefined;
  const common = { fill: c, stroke: e, strokeWidth: 2, strokeLinejoin: 'round' as const };
  let body: ReactNode;
  switch (item.slot) {
    case 'arma':
      body = item.visual.variant === 'foice'
        ? <><path d="M30 92 L58 20" stroke="#6b4a2e" strokeWidth="6" /><path d="M58 20 C 80 14, 92 30, 88 48 C 80 34, 70 30, 56 32 Z" {...common} /></>
        : <><path d={item.visual.variant === 'adaga' ? 'M50 14 L58 60 L50 66 L42 60 Z' : 'M50 6 L57 66 L50 72 L43 66 Z'} {...common} /><rect x="34" y="66" width="32" height="6" rx="2" fill={e} /><rect x="46" y="72" width="8" height="18" rx="2" fill="#5b3a29" /><circle cx="50" cy="93" r="4" fill={e} /></>;
      break;
    case 'armadura': body = <path d="M30 22 L42 16 Q50 24 58 16 L70 22 L80 40 L70 46 L70 86 L30 86 L30 46 L20 40 Z" {...common} />; break;
    case 'luvas': body = <path d="M34 86 L34 44 Q34 36 40 36 L40 22 Q44 18 47 22 L47 34 L50 18 Q54 14 57 18 L57 34 L60 22 Q64 18 67 22 L67 50 L74 42 Q80 42 78 50 L66 72 L66 86 Z" {...common} />; break;
    case 'botas': body = <path d="M34 14 L56 14 L56 62 L82 72 Q86 86 78 88 L30 88 L30 70 Z" {...common} />; break;
    case 'acessorio': body = item.visual.variant === 'anel' ? <><circle cx="50" cy="56" r="24" fill="none" stroke={c} strokeWidth="8" /><path d="M42 30 L50 18 L58 30 Z" fill={e} /></> : <><path d="M30 20 Q50 46 70 20" fill="none" stroke={c} strokeWidth="3" /><path d="M50 44 L64 64 L50 88 L36 64 Z" {...common} /></>; break;
    case 'traje': body = <path d="M36 14 L64 14 L76 30 L84 90 L50 80 L16 90 L24 30 Z" {...common} />; break;
    case 'emblema': body = item.visual.variant === 'escudo' ? <path d="M50 12 L82 24 Q82 66 50 90 Q18 66 18 24 Z" {...common} /> : item.visual.variant === 'presa' ? <path d="M30 18 Q50 30 70 18 Q64 60 50 90 Q36 60 30 18 Z" {...common} /> : <path d="M50 10 L86 50 L50 90 L14 50 Z" {...common} />; break;
    case 'aura': body = <><circle cx="50" cy="50" r="30" fill="none" stroke={c} strokeWidth="4" opacity="0.7" /><circle cx="50" cy="50" r="18" fill={c} opacity="0.6" /><path d="M50 8 L56 32 L50 26 L44 32 Z M50 92 L56 68 L50 74 L44 68 Z M8 50 L32 44 L26 50 L32 56 Z M92 50 L68 44 L74 50 L68 56 Z" fill={c} /></>; break;
    case 'animacao': body = <><circle cx="50" cy="22" r="9" fill={c} /><path d="M50 32 L50 62 M50 40 L70 18 M50 40 L32 52 M50 62 L36 88 M50 62 L64 88" stroke={c} strokeWidth="6" strokeLinecap="round" /></>; break;
    case 'companheiro': body = item.visual.variant === 'corvo' ? <path d="M20 56 Q40 30 60 40 L84 30 L70 50 Q76 70 52 72 L40 86 L42 70 Q26 68 20 56 Z" fill="#20152e" stroke={e} strokeWidth="2" /> : <><circle cx="50" cy="50" r="20" fill={c} /><circle cx="50" cy="50" r="32" fill="none" stroke={c} strokeOpacity="0.4" strokeWidth="3" strokeDasharray="6 6" /></>; break;
  }
  return <svg viewBox="0 0 100 100" style={st} aria-label={item.name}>{body}</svg>;
}

export function ItemCell({ itemId, owned, equipped, onClick }: { itemId: string; owned: boolean; equipped?: boolean; onClick?: () => void }) {
  const it = ITEM_MAP[itemId];
  if (!it) return null;
  return (
    <button className={`item-cell ${equipped ? 'eq' : ''} ${owned ? '' : 'locked'}`} style={{ '--rc': RARITY_INFO[it.rarity].color } as React.CSSProperties} onClick={onClick} title={it.name}>
      <ItemIcon item={it} />
    </button>
  );
}

export function SlotIcon({ slot, itemId, onClick }: { slot: Slot; itemId?: string; onClick?: () => void }) {
  const it = itemId ? ITEM_MAP[itemId] : undefined;
  return (
    <button className={`slot ${it ? 'filled' : ''}`} style={{ '--rc': it ? RARITY_INFO[it.rarity].color : undefined } as React.CSSProperties} onClick={onClick} title={it?.name ?? slot}>
      {it ? <ItemIcon item={it} /> : null}
      <small>{slot}</small>
    </button>
  );
}

const BOSS_PALETTE: Record<Boss['theme'], [string, string]> = {
  codigo: ['#4cc9ff', '#0a1a2e'], forca: ['#ff7a3d', '#200e06'], caos: ['#c06bff', '#140a20'], ouro: ['#ffd166', '#1e1606'],
  sombra: ['#8b6cff', '#0c0a1c'], espelho: ['#c8d3e6', '#0e1218'], tempo: ['#5fd38d', '#061612'],
};

/** Arte original e procedural de chefe (silhueta + sigilo), única por chefe. */
export function BossArt({ boss, hp = 1, height = 150 }: { boss: Boss; hp?: number; height?: number }) {
  const [c, bg] = BOSS_PALETTE[boss.theme];
  const r = seeded(boss.name);
  const spikes = 5 + Math.floor(r() * 5);
  const horns = r() > 0.4;
  const eyes = 1 + Math.floor(r() * 3);
  const crack = 1 - hp;
  return (
    <svg viewBox="0 0 320 150" className="boss-art" style={{ height }} role="img" aria-label={boss.name}>
      <defs>
        <radialGradient id={`bg-${boss.id}`} cx="50%" cy="60%"><stop offset="0%" stopColor={c} stopOpacity="0.35" /><stop offset="70%" stopColor={bg} /></radialGradient>
        <filter id={`gl-${boss.id}`}><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="320" height="150" fill={`url(#bg-${boss.id})`} />
      <g opacity="0.35" stroke={c} fill="none">
        <circle cx="160" cy="80" r="62" strokeDasharray="4 8" />
        <circle cx="160" cy="80" r="48" />
        {Array.from({ length: spikes }).map((_, i) => { const a = (i / spikes) * Math.PI * 2; return <line key={i} x1={160 + Math.cos(a) * 48} y1={80 + Math.sin(a) * 48} x2={160 + Math.cos(a) * 70} y2={80 + Math.sin(a) * 70} />; })}
      </g>
      <g filter={`url(#gl-${boss.id})`}>
        <path d={`M110 150 Q118 96 136 84 Q132 60 148 44 ${horns ? 'L138 18 L156 38' : ''} Q160 34 164 38 ${horns ? 'L182 18 L172 44' : ''} Q188 60 184 84 Q202 96 210 150 Z`} fill="#05050a" stroke={c} strokeWidth="1.5" />
        {Array.from({ length: eyes }).map((_, i) => <ellipse key={i} cx={160 + (i - (eyes - 1) / 2) * 12} cy={60} rx="3.5" ry="2" fill={c} />)}
        {crack > 0 && Array.from({ length: Math.ceil(crack * 6) }).map((_, i) => <path key={i} d={`M${140 + i * 8} ${90 + (i % 2) * 10} l${6 - i} ${12} l-4 ${10}`} stroke={c} strokeWidth="1.5" fill="none" opacity="0.9" />)}
      </g>
      {boss.defeatedAt && <text x="160" y="85" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="800" letterSpacing="4" style={{ filter: 'drop-shadow(0 0 6px #fff)' }}>DERROTADO</text>}
    </svg>
  );
}

export function AttrPicker({ value, onChange }: { value: Partial<Record<AttrKey, number>>; onChange: (v: Partial<Record<AttrKey, number>>) => void }) {
  const count = Object.values(value).filter((v) => (v ?? 0) > 0).length;
  return (
    <div className="row wrap gap">
      {ATTR_KEYS.map((k) => {
        const w = value[k] ?? 0;
        return (
          <button key={k} type="button" className={`chip ${w ? 'sel' : ''}`} style={w ? { borderColor: ATTRS[k].color, color: ATTRS[k].color } : undefined}
            onClick={() => {
              const next = { ...value };
              if (!w) { if (count >= 3) return; next[k] = 2; }
              else if (w < 3) next[k] = w + 1;
              else delete next[k];
              onChange(next);
            }}>
            {ATTRS[k].name}{w ? ` ×${w}` : ''}
          </button>
        );
      })}
    </div>
  );
}
