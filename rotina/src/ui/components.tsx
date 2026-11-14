import { useEffect, type ReactNode } from 'react';

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && <header className="card-h">{title ? <h2>{title}</h2> : <span />}{action}</header>}
      {children}
    </section>
  );
}

export function Ring({ value, size = 96, stroke = 10, color = 'var(--accent)', children, label }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" role="img" aria-label={label} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--accent-2)" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color === 'grad' ? 'url(#rg)' : color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      <div className="ring-c">{children}</div>
    </div>
  );
}

export function Bar({ value, thin, label }: { value: number; thin?: boolean; label: string }) {
  return <div className={`bar ${thin ? 'thin' : ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}><i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Fechar" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Chips<T extends string | number>({ options, value, onChange, label, scroll }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; scroll?: boolean }) {
  return (
    <div className={`chips ${scroll ? 'scroll-x' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={`chip ${o.value === value ? 'on' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export const fmt = (n: number, d = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
