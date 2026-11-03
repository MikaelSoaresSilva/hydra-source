import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && <header className="card-h">{title && <h2>{title}</h2>}{action}</header>}
      {children}
    </section>
  );
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return <div className="loading" role="status" aria-live="polite"><span className="spinner" aria-hidden />{label}</div>;
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="error" role="alert">{error}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-l">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function NumberInput({ value, onChange, step = 'any', min, max, placeholder, ...rest }: {
  value: number | null | undefined; onChange: (v: number | null) => void; step?: string | number; min?: number; max?: number; placeholder?: string;
  'aria-label'?: string; id?: string; className?: string;
}) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value).replace('.', ','));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) { setText(value === null || value === undefined ? '' : String(value).replace('.', ',')); last.current = value; }
  }, [value]);
  return (
    <input
      {...rest}
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,-]/g, '');
        setText(t);
        const n = t === '' ? null : Number(t.replace(',', '.'));
        const v = n === null || Number.isNaN(n) ? null : n;
        if (v !== null && ((min !== undefined && v < min) || (max !== undefined && v > max))) return;
        last.current = v;
        onChange(v);
      }}
      data-step={step}
    />
  );
}

export function Chips<T extends string | number>({ options, value, onChange, multiple = false, label }: {
  options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; multiple?: boolean; label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button type="button" key={String(o.value)} className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
            onClick={() => onChange(multiple ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Scale({ value, onChange, label, low, high }: { value: number | null; onChange: (v: number) => void; label: string; low: string; high: string }) {
  return (
    <div className="scale">
      <span className="field-l">{label}</span>
      <div className="scale-row" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" role="radio" aria-checked={value === n} key={n} className={`chip ${value === n ? 'on' : ''}`} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
      <span className="hint">1 = {low} · 5 = {high}</span>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={value === t.value ? 'on' : ''} onClick={() => onChange(t.value)}>{t.label}</button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="stat"><span className="stat-l">{label}</span><strong className="stat-v">{value}</strong>{sub && <span className="stat-s">{sub}</span>}</div>;
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(t); }, [msg]);
  return { toast: setMsg, node: msg ? <div className="toast" role="status">{msg}</div> : null };
}

export const fmt = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: d });
