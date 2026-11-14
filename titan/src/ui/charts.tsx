import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt } from './components';

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
  return { s1: v('--series-1', '#3987e5'), s2: v('--series-2', '#d95926'), grid: v('--grid', '#2a3139'), axis: v('--axis', '#9aa5b1'), surface: v('--surface', '#161a1f'), text: v('--text', '#eee') };
}

/** Cores do gráfico a partir dos tokens do tema (atualiza ao trocar tema). */
export function useChartColors() {
  const [c, setC] = useState(readColors);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(readColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

export interface Series { key: string; label: string; unit?: string; dashed?: boolean; dotsOnly?: boolean }

const shortDate = (iso: string) => (typeof iso === 'string' && iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : String(iso));

/** Linha de tendência (1 eixo). Até 2 séries; legenda só quando há 2. Inclui alternância para tabela. */
export function TrendChart({ data, xKey, series, height = 220, label, xFormat = shortDate }: {
  data: Record<string, unknown>[]; xKey: string; series: Series[]; height?: number; label: string; xFormat?: (v: string) => string;
}) {
  const c = useChartColors();
  const [table, setTable] = useState(false);
  const colors = [c.s1, c.s2];
  if (!data.length) return null;
  return (
    <figure style={{ margin: 0 }} aria-label={label}>
      <div className="row between"><span className="sr-only">{label}</span><span /><button className="btn ghost sm" onClick={() => setTable(!table)}>{table ? 'Ver gráfico' : 'Ver tabela'}</button></div>
      {table ? (
        <div className="scroll-x"><table className="t"><thead><tr><th>Data</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
          <tbody>{data.map((d, i) => <tr key={i}><td>{xFormat(String(d[xKey]))}</td>{series.map((s) => <td key={s.key}>{fmt(d[s.key] as number, 2)}{s.unit ? ` ${s.unit}` : ''}</td>)}</tr>)}</tbody></table></div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey={xKey} tickFormatter={xFormat} stroke={c.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis stroke={c.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={48} />
            <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 10, color: c.text }}
              labelFormatter={(v) => xFormat(String(v))} formatter={(v, n) => [`${fmt(Number(v), 2)}`, String(n)]} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: c.text }} />}
            {series.map((s, i) => (
              <Line key={s.key} dataKey={s.key} name={s.label} stroke={colors[i]} strokeWidth={2}
                strokeOpacity={s.dotsOnly ? 0 : 1} strokeDasharray={s.dashed ? '5 4' : undefined}
                dot={s.dotsOnly ? { r: 4, fill: colors[i], stroke: c.surface, strokeWidth: 2 } : false}
                activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </figure>
  );
}

/** Barras (1 ou 2 séries, mesmo eixo). */
export function BarsChart({ data, xKey, series, height = 200, label }: { data: Record<string, unknown>[]; xKey: string; series: Series[]; height?: number; label: string }) {
  const c = useChartColors();
  const [table, setTable] = useState(false);
  const colors = [c.s1, c.s2];
  if (!data.length) return null;
  return (
    <figure style={{ margin: 0 }} aria-label={label}>
      <div className="row between"><span /><button className="btn ghost sm" onClick={() => setTable(!table)}>{table ? 'Ver gráfico' : 'Ver tabela'}</button></div>
      {table ? (
        <div className="scroll-x"><table className="t"><thead><tr><th />{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
          <tbody>{data.map((d, i) => <tr key={i}><td>{String(d[xKey])}</td>{series.map((s) => <td key={s.key}>{fmt(d[s.key] as number)}</td>)}</tr>)}</tbody></table></div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey={xKey} stroke={c.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis stroke={c.axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
            <Tooltip cursor={{ fill: c.grid, opacity: 0.4 }} contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 10, color: c.text }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: c.text }} />}
            {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={colors[i]} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      )}
    </figure>
  );
}
