import { useEffect, useState } from 'react';
import { useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { formatBR, todayISO } from '../domain/dates';
import { photoComparability } from '../domain/recommendations';
import { movingAverage } from '../domain/trend';
import { MEASURING_GUIDE } from '../domain/olympia';
import type { CheckinRow, MetricRow, PhotoRow } from '../domain/types';
import { sanitizeImage } from '../services';
import { TrendChart } from '../ui/charts';
import { Card, Empty, ErrorBox, Field, Loading, NumberInput, Scale, Tabs, fmt, useToast } from '../ui/components';

type Tab = 'medidas' | 'graficos' | 'fotos' | 'checkin';

type MetricKey = Exclude<keyof MetricRow, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'date' | 'conditions' | 'notes'>;
/** Campos de medida: chave, rótulo, mínimo e máximo aceitos (iguais às restrições do banco). */
export const METRIC_FIELDS: [MetricKey, string, number, number][] = [
  ['weight_kg', 'Peso (kg)', 30, 300],
  ['arm_right_cm', 'Braço direito contraído (cm)', 15, 80],
  ['arm_left_cm', 'Braço esquerdo contraído (cm)', 15, 80],
  ['arm_right_relaxed_cm', 'Braço direito relaxado (cm)', 15, 80],
  ['arm_left_relaxed_cm', 'Braço esquerdo relaxado (cm)', 15, 80],
  ['forearm_right_cm', 'Antebraço direito (cm)', 15, 60],
  ['forearm_left_cm', 'Antebraço esquerdo (cm)', 15, 60],
  ['shoulders_cm', 'Ombros (cm)', 70, 200],
  ['chest_cm', 'Peitoral (cm)', 50, 200],
  ['waist_cm', 'Cintura (cm, na altura do umbigo)', 40, 200],
  ['hip_cm', 'Quadril (cm)', 50, 200],
  ['thigh_cm', 'Coxa direita (cm)', 30, 110],
  ['thigh_left_cm', 'Coxa esquerda (cm)', 30, 110],
  ['calf_right_cm', 'Panturrilha direita (cm)', 20, 70],
  ['calf_left_cm', 'Panturrilha esquerda (cm)', 20, 70],
];

export function CheckinForm({ compact = false }: { compact?: boolean }) {
  const store = useStore();
  const today = todayISO();
  const rows = useRows<CheckinRow>('daily_checkins', { eq: { date: today } });
  const existing = rows.data[0];
  const [c, setC] = useState<Partial<CheckinRow>>({});
  const { toast, node } = useToast();
  useEffect(() => { if (existing) setC(existing); }, [existing]);
  return (
    <div className="stack">
      {node}
      <Field label="Horas de sono"><NumberInput value={c.sleep_hours ?? null} min={0} max={24} onChange={(v) => setC({ ...c, sleep_hours: v })} /></Field>
      <Scale label="Recuperação" value={c.recovery ?? null} onChange={(v) => setC({ ...c, recovery: v })} low="muito ruim" high="ótima" />
      <Field label="Água hoje (litros)" hint="Meta: ≥2 L; mais em dias de treino e calor. Urina clara = hidratado."><NumberInput value={c.water_l ?? null} min={0} max={15} onChange={(v) => setC({ ...c, water_l: v })} /></Field>
      {!compact && <>
        <Scale label="Qualidade do sono" value={c.sleep_quality ?? null} onChange={(v) => setC({ ...c, sleep_quality: v })} low="péssima" high="excelente" />
        <Scale label="Dor muscular" value={c.soreness ?? null} onChange={(v) => setC({ ...c, soreness: v })} low="nenhuma" high="muita" />
        <Scale label="Estresse" value={c.stress ?? null} onChange={(v) => setC({ ...c, stress: v })} low="baixo" high="alto" />
        <Field label="Observações pessoais"><textarea value={c.notes ?? ''} onChange={(e) => setC({ ...c, notes: e.target.value })} /></Field>
      </>}
      <button className="btn primary" onClick={async () => {
        await store.upsert('daily_checkins', {
          id: existing?.id ?? uuid(), date: today, sleep_hours: c.sleep_hours ?? null, sleep_quality: c.sleep_quality ?? null, recovery: c.recovery ?? null,
          soreness: c.soreness ?? null, stress: c.stress ?? null, water_l: c.water_l ?? null, notes: c.notes ?? null,
        });
        toast('Check-in salvo.');
      }}>{existing ? 'Atualizar check-in' : 'Salvar check-in'}</button>
    </div>
  );
}

function PhotoImg({ path, alt }: { path: string; alt: string }) {
  const store = useStore();
  const [url, setUrl] = useState('');
  useEffect(() => { let on = true; store.photoUrl(path).then((u) => on && setUrl(u)).catch(() => {}); return () => { on = false; }; }, [path, store]);
  return url ? <img src={url} alt={alt} loading="lazy" /> : <div className="loading" style={{ aspectRatio: '3/4' }}>…</div>;
}

const LIGHTING = ['luz natural (janela)', 'lâmpada do banheiro', 'lâmpada do quarto', 'academia'];
const DISTANCE = ['30 cm (rosto)', '1 m', '2 m', '3 m'];
const POSE = ['frente relaxado', 'lado relaxado', 'costas relaxado', 'frente contraído', 'duplo bíceps frente', 'perfil esquerdo', 'perfil direito'];
const TIME = ['manhã', 'tarde', 'noite'];

export function Evolution() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('medidas');
  const metrics = useRows<MetricRow>('body_metrics', { order: { col: 'date', asc: false } });
  const photos = useRows<PhotoRow>('photos', { order: { col: 'taken_at', asc: false } });
  const checkins = useRows<CheckinRow>('daily_checkins', { order: { col: 'date' } });
  const [m, setM] = useState<Partial<MetricRow>>({ date: todayISO(), conditions: { fasted: true, morning: true } });
  const [ph, setPh] = useState({ category: 'physique' as PhotoRow['category'], lighting: LIGHTING[0], distance: DISTANCE[2], pose: POSE[0], time_of_day: 'manhã', pump: false, notes: '' });
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | PhotoRow['category']>('all');
  const { toast, node } = useToast();

  const asc = [...metrics.data].reverse();
  const weights = asc.filter((x) => x.weight_kg !== null).map((x) => ({ date: x.date, weight: Number(x.weight_kg) }));
  const series = (k: keyof MetricRow) => asc.filter((x) => x[k] !== null).map((x) => ({ date: x.date, v: Number(x[k]) }));

  async function saveMetric() {
    setError(null);
    if (!m.date || METRIC_FIELDS.every(([k]) => m[k] === null || m[k] === undefined)) { setError('Informe a data e pelo menos uma medida.'); return; }
    await store.upsert('body_metrics', {
      id: uuid(), date: m.date, ...Object.fromEntries(METRIC_FIELDS.map(([k]) => [k, m[k] ?? null])),
      conditions: m.conditions ?? {}, notes: m.notes ?? null,
    });
    setM({ date: todayISO(), conditions: m.conditions });
    toast('Medidas salvas.');
  }

  async function upload(file: File) {
    setBusy(true); setError(null);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Envie uma imagem.');
      if (file.size > 25 * 1024 * 1024) throw new Error('Imagem maior que 25 MB.');
      const blob = await sanitizeImage(file);
      const id = uuid();
      const path = `${store.userId}/${id}.jpg`;
      await store.uploadPhoto(path, blob);
      await store.upsert('photos', { id, category: ph.category, storage_path: path, taken_at: new Date().toISOString(), lighting: ph.lighting, distance: ph.distance, pose: ph.pose, time_of_day: ph.time_of_day, pump: ph.pump, notes: ph.notes || null });
      toast('Foto salva com privacidade.');
    } catch (e) {
      setError(`Falha ao salvar a foto: ${(e as Error).message}`);
    } finally { setBusy(false); }
  }

  const selected = sel.map((id) => photos.data.find((p) => p.id === id)).filter((p): p is PhotoRow => !!p);
  if (metrics.loading) return <Loading />;
  return (
    <div className="stack">
      {node}
      <h1>Evolução</h1>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'medidas', label: 'Medidas' }, { value: 'graficos', label: 'Gráficos' }, { value: 'fotos', label: 'Fotos' }, { value: 'checkin', label: 'Check-in' }]} />
      <ErrorBox error={error} />

      {tab === 'medidas' && (
        <>
          <Card title="Nova medição">
            <div className="grid two">
              <Field label="Data"><input type="date" value={m.date} max={todayISO()} onChange={(e) => setM({ ...m, date: e.target.value })} /></Field>
              {METRIC_FIELDS.map(([k, label, min, max]) => (
                <Field key={k} label={label}><NumberInput value={(m[k] as number | null | undefined) ?? null} min={min} max={max} onChange={(v) => setM({ ...m, [k]: v })} /></Field>
              ))}
            </div>
            <div className="row">
              {([['fasted', 'Em jejum'], ['morning', 'Pela manhã'], ['afterTraining', 'Após treino (pump)'], ['flexed', 'Braço contraído']] as const).map(([k, l]) => (
                <label key={k} className="check"><input type="checkbox" checked={!!m.conditions?.[k]} onChange={(e) => setM({ ...m, conditions: { ...m.conditions, [k]: e.target.checked } })} /> {l}</label>
              ))}
            </div>
            <Field label="Observações"><input value={m.notes ?? ''} onChange={(e) => setM({ ...m, notes: e.target.value })} /></Field>
            <button className="btn primary" style={{ marginTop: 8 }} onClick={() => void saveMetric()}>Salvar</button>
            <p className="hint">Pese-se 3–7× por semana ao acordar, após o banheiro. Medidas: a cada 2 semanas, sempre nas mesmas condições.</p>
            <details><summary>Como medir cada região (reduz erro)</summary><ul>{MEASURING_GUIDE.map((g) => <li key={g}><small>{g}</small></li>)}</ul></details>
          </Card>
          <Card title="Histórico">
            {metrics.data.length === 0 ? <Empty>Sem medições.</Empty> : (
              <div className="scroll-x"><table className="t">
                <thead><tr><th>Data</th><th>Peso</th><th>Braço D/E</th><th>Cintura</th><th>Peito</th><th /></tr></thead>
                <tbody>{metrics.data.slice(0, 40).map((x) => (
                  <tr key={x.id}><td>{formatBR(x.date)}</td><td>{fmt(x.weight_kg === null ? null : Number(x.weight_kg))}</td><td>{fmt(x.arm_right_cm === null ? null : Number(x.arm_right_cm))}/{fmt(x.arm_left_cm === null ? null : Number(x.arm_left_cm))}</td><td>{fmt(x.waist_cm === null ? null : Number(x.waist_cm))}</td><td>{fmt(x.chest_cm === null ? null : Number(x.chest_cm))}</td>
                    <td><button className="btn ghost sm" aria-label="Excluir medição" onClick={() => { if (confirm('Excluir esta medição?')) void store.remove('body_metrics', [x.id]); }}>×</button></td></tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </>
      )}

      {tab === 'graficos' && (
        <>
          <Card title="Peso">
            {weights.length ? <TrendChart label="Peso" data={movingAverage(weights)} xKey="date" series={[{ key: 'weight', label: 'Pesagem (kg)', dotsOnly: true }, { key: 'avg', label: 'Média 7 dias (kg)' }]} /> : <Empty>Sem pesagens.</Empty>}
          </Card>
          <Card title="Cintura">{series('waist_cm').length ? <TrendChart label="Cintura" data={series('waist_cm')} xKey="date" series={[{ key: 'v', label: 'Cintura (cm)' }]} /> : <Empty>Sem medidas de cintura.</Empty>}
            <p className="hint">Peso subindo com cintura estável sugere ganho predominantemente magro; cintura subindo rápido sugere superávit alto.</p></Card>
          <Card title="Braço direito">{series('arm_right_cm').length ? <TrendChart label="Braço" data={series('arm_right_cm')} xKey="date" series={[{ key: 'v', label: 'Braço D (cm)' }]} /> : <Empty>Sem medidas de braço.</Empty>}</Card>
          <Card title="Recuperação diária">{checkins.data.some((c) => c.recovery !== null) ? <TrendChart label="Recuperação" data={checkins.data.filter((c) => c.recovery !== null).map((c) => ({ date: c.date, v: c.recovery }))} xKey="date" series={[{ key: 'v', label: 'Recuperação (1–5)' }]} /> : <Empty>Sem check-ins.</Empty>}</Card>
          <Card title="Sono">{checkins.data.some((c) => c.sleep_hours !== null) ? <TrendChart label="Sono" data={checkins.data.filter((c) => c.sleep_hours !== null).map((c) => ({ date: c.date, v: Number(c.sleep_hours) }))} xKey="date" series={[{ key: 'v', label: 'Sono (h)' }]} /> : <Empty>Sem registros de sono.</Empty>}</Card>
          <p className="hint">Todos os gráficos usam apenas os seus registros reais.</p>
        </>
      )}

      {tab === 'fotos' && (
        <>
          <Card title="Nova foto (privada)">
            <p className="hint">Fotos ficam em armazenamento privado da sua conta (somente você acessa, via link temporário). Antes de enviar, o app remove metadados como localização GPS e reduz para até 1600 px; a imagem em si não é editada nem "melhorada".</p>
            <div className="grid two">
              <Field label="Tipo"><select value={ph.category} onChange={(e) => setPh({ ...ph, category: e.target.value as 'face' })}><option value="physique">Físico</option><option value="face">Rosto/pele</option><option value="hair">Cabelo</option><option value="label">Rótulo de produto</option><option value="other">Outro</option></select></Field>
              <Field label="Iluminação"><select value={ph.lighting} onChange={(e) => setPh({ ...ph, lighting: e.target.value })}>{LIGHTING.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Distância"><select value={ph.distance} onChange={(e) => setPh({ ...ph, distance: e.target.value })}>{DISTANCE.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Pose"><select value={ph.pose} onChange={(e) => setPh({ ...ph, pose: e.target.value })}>{POSE.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Horário"><select value={ph.time_of_day} onChange={(e) => setPh({ ...ph, time_of_day: e.target.value })}>{TIME.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Observações"><input value={ph.notes} onChange={(e) => setPh({ ...ph, notes: e.target.value })} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={ph.pump} onChange={(e) => setPh({ ...ph, pump: e.target.checked })} /> Tirada após treino (com pump)</label>
            <label className="btn primary big" style={{ marginTop: 8 }}>
              {busy ? 'Enviando…' : 'Tirar / escolher foto'}
              <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
            </label>
          </Card>
          {selected.length === 2 && (
            <Card title="Comparação">
              <div className="compare">{selected.map((p) => <figure key={p.id} style={{ margin: 0 }}><PhotoImg path={p.storage_path} alt={`Foto de ${formatBR(p.taken_at.slice(0, 10))}`} /><figcaption className="hint">{formatBR(p.taken_at.slice(0, 10))} · {p.pose}</figcaption></figure>)}</div>
              {(() => {
                const issues = photoComparability(selected[0], selected[1]);
                return issues.length
                  ? <div className="banner" style={{ marginTop: 8 }}><strong>Comparação pouco confiável:</strong><ul>{issues.map((i) => <li key={i}>{i}</li>)}</ul>Diferenças aparentes podem ser iluminação, ângulo, hidratação ou pump, não mudança real.</div>
                  : <p className="hint">Condições equivalentes registradas. Ainda assim, hidratação, horário da última refeição e expressão facial influenciam.</p>;
              })()}
            </Card>
          )}
          <Card title="Galeria" action={<select style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value as 'all')} aria-label="Filtrar fotos"><option value="all">Todas</option><option value="physique">Físico</option><option value="face">Rosto</option><option value="hair">Cabelo</option><option value="label">Rótulos</option></select>}>
            <p className="hint">Toque em duas fotos para comparar.</p>
            {photos.data.length === 0 ? <Empty>Nenhuma foto.</Empty> : (
              <div className="photo-grid">
                {photos.data.filter((p) => filter === 'all' || p.category === filter).map((p) => (
                  <figure key={p.id} style={{ outline: sel.includes(p.id) ? '3px solid var(--accent)' : undefined, borderRadius: 10 }}>
                    <button className="btn ghost" style={{ padding: 0, width: '100%', border: 0 }} aria-pressed={sel.includes(p.id)}
                      onClick={() => setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel.slice(-1), p.id])}>
                      <PhotoImg path={p.storage_path} alt={`${p.category} em ${formatBR(p.taken_at.slice(0, 10))}`} />
                    </button>
                    <figcaption className="hint row between">{formatBR(p.taken_at.slice(0, 10))}
                      <button className="btn ghost sm" aria-label="Excluir foto" onClick={async () => { if (!confirm('Excluir a foto definitivamente?')) return; await store.deletePhoto(p.storage_path).catch(() => {}); await store.remove('photos', [p.id]); }}>×</button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'checkin' && <Card title={`Check-in de hoje (${formatBR(todayISO())})`}><CheckinForm /></Card>}
    </div>
  );
}
