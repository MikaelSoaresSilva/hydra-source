import { useState, type ReactNode } from 'react';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { addDays, todayISO, WEEKDAY_SHORT, weekday } from '../domain/dates';
import { cutSuggestions, GROOMING_GUIDE, isWashDay, NON_WASH_DAY_STEPS, scalpStatus, WASH_DAY_STEPS, washDays } from '../domain/hair';
import {
  ACTIVE_LABEL, activeIntroduction, baseSkinRoutine, checkSlot, DERM_REFERRAL, detectActives, evaluateReactions, introductionDays, STOP_SIGNS, type Active,
} from '../domain/skincare';
import type { CareArea, CareLogRow, CareSlot, ProductRow, RoutineItemRow } from '../domain/types';
import { Card, Chips, Empty, ErrorBox, Field, Loading, Tabs, useToast } from '../ui/components';

type Tab = 'skin' | 'hair' | 'grooming';
const SLOT_LABEL: Record<CareSlot, string> = { am: 'Manhã', pm: 'Noite', wash: 'Dia de lavagem', non_wash: 'Dia sem lavagem', scalp: 'Couro cabeludo', weekly: 'Semanal' };
const STATUS_LABEL: Record<ProductRow['status'], string> = { active: 'em uso', introducing: 'em introdução', paused: 'pausado', suspended: 'suspenso' };
const CATEGORIES: Record<CareArea, string[]> = {
  skin: ['cleanser', 'treatment', 'moisturizer', 'sunscreen', 'other'],
  hair: ['shampoo', 'conditioner', 'leave-in', 'gel', 'cream', 'oil', 'scalp', 'other'],
  beard: ['cleanser', 'oil', 'balm', 'trimmer', 'other'],
  brows: ['gel', 'tool', 'other'],
};
const CAT_LABEL: Record<string, string> = { cleanser: 'Limpeza', treatment: 'Tratamento/ativo', moisturizer: 'Hidratante', sunscreen: 'Protetor solar', other: 'Outro', shampoo: 'Shampoo', conditioner: 'Condicionador', 'leave-in': 'Leave-in', gel: 'Gel', cream: 'Creme', oil: 'Óleo', scalp: 'Couro cabeludo', balm: 'Balm', trimmer: 'Aparador', tool: 'Ferramenta' };

export function Care() {
  const [tab, setTab] = useState<Tab>('skin');
  const products = useRows<ProductRow>('care_products');
  const items = useRows<RoutineItemRow>('routine_items', { order: { col: 'step_order' } });
  const logs = useRows<CareLogRow>('care_logs', { gte: { date: addDays(todayISO(), -40) } });
  if (products.loading || items.loading) return <Loading />;
  return (
    <div className="stack">
      <h1>Cuidados</h1>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'skin', label: 'Pele' }, { value: 'hair', label: 'Cabelo' }, { value: 'grooming', label: 'Barba e sobrancelhas' }]} />
      {tab === 'skin' && <Skin products={products.data} items={items.data} logs={logs.data} />}
      {tab === 'hair' && <Hair products={products.data} items={items.data} logs={logs.data} />}
      {tab === 'grooming' && <Grooming products={products.data} items={items.data} logs={logs.data} />}
    </div>
  );
}

interface Props { products: ProductRow[]; items: RoutineItemRow[]; logs: CareLogRow[] }

function usable(p: ProductRow | undefined) { return !p || (p.status !== 'suspended' && p.status !== 'paused'); }

/** Checklist do dia para um slot, com conclusão salva em care_logs. */
function TodaySlot({ area, slot, items, products, logs, extra }: { area: CareArea; slot: CareSlot; items: RoutineItemRow[]; products: ProductRow[]; logs: CareLogRow[]; extra?: ReactNode }) {
  const store = useStore();
  const today = todayISO();
  const wd = weekday(today);
  const steps = items.filter((i) => i.area === area && i.slot === slot && i.enabled && i.days.includes(wd));
  const done = logs.find((l) => l.date === today && l.area === area && l.slot === slot && l.completed && !l.product_id);
  const [itch, setItch] = useState<number | null>(null);
  const conflicts = checkSlot(steps.map((s) => products.find((p) => p.id === s.product_id)).filter((p): p is ProductRow => !!p && usable(p)));
  return (
    <Card title={SLOT_LABEL[slot]} action={done ? <span className="tag ok">feito</span> : null}>
      {steps.length === 0 ? <Empty>Nenhum passo para hoje neste momento.</Empty> : (
        <ol className="list">
          {steps.map((s) => {
            const p = products.find((x) => x.id === s.product_id);
            const blocked = p && !usable(p);
            return (
              <li key={s.id}>
                <strong style={{ textDecoration: blocked ? 'line-through' : undefined }}>{s.step}</strong>{p ? ` — ${p.name}` : ''}
                {blocked && <span className="tag danger"> {STATUS_LABEL[p!.status]}: pular</span>}
                {s.amount && <><br /><small>Quantidade: {s.amount}</small></>}
                {s.notes && <><br /><small className="muted">{s.notes}</small></>}
              </li>
            );
          })}
        </ol>
      )}
      {conflicts.map((c, i) => <p key={i} className={c.conflict.level === 'avoid' ? 'error' : 'hint'}>⚠ {c.pair.join(' + ')}: {c.conflict.why}</p>)}
      {extra}
      {area === 'hair' && (
        <label className="field" style={{ marginTop: 8 }}><span className="field-l">Coceira no couro cabeludo hoje (0–10)</span>
          <select value={itch ?? ''} onChange={(e) => setItch(e.target.value === '' ? null : Number(e.target.value))}><option value="">não registrar</option>{Array.from({ length: 11 }, (_, k) => <option key={k}>{k}</option>)}</select>
        </label>
      )}
      {steps.length > 0 && (
        <button className="btn primary" style={{ marginTop: 8, width: '100%' }} disabled={!!done}
          onClick={() => void store.upsert('care_logs', { id: uuid(), date: today, area, slot, completed: true, product_id: null, reaction: 'none', itch, notes: null })}>
          {done ? 'Concluído hoje' : 'Marcar como feito'}
        </button>
      )}
    </Card>
  );
}

function ReactionForm({ area, products }: { area: CareArea; products: ProductRow[] }) {
  const store = useStore();
  const [pid, setPid] = useState('');
  const [sev, setSev] = useState<CareLogRow['reaction']>('mild');
  const [notes, setNotes] = useState('');
  const { toast, node } = useToast();
  const [msg, setMsg] = useState<string | null>(null);
  const mine = products.filter((p) => p.area === area);
  return (
    <Card title="Registrar reação a produto">
      {node}
      <div className="grid two">
        <Field label="Produto"><select value={pid} onChange={(e) => setPid(e.target.value)}><option value="">—</option>{mine.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Intensidade"><select value={sev} onChange={(e) => setSev(e.target.value as 'mild')}><option value="mild">Leve (ardência breve, leve vermelhidão)</option><option value="moderate">Moderada (vermelhidão/descamação persistente)</option><option value="severe">Grave (inchaço, bolhas, dor)</option></select></Field>
      </div>
      <Field label="O que aconteceu"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button className="btn" style={{ marginTop: 8 }} disabled={!pid} onClick={async () => {
        const log: CareLogRow = { id: uuid(), user_id: store.userId, date: todayISO(), area, slot: 'reaction', completed: false, product_id: pid, reaction: sev, itch: null, notes: notes || null };
        await store.upsert('care_logs', log as unknown as Record<string, unknown>);
        const p = mine.find((x) => x.id === pid)!;
        const history = await store.list<CareLogRow>('care_logs', { eq: { product_id: pid } });
        const d = evaluateReactions(p, history, todayISO());
        if (d.newStatus) { await store.upsert('care_products', { ...p, status: d.newStatus } as unknown as Record<string, unknown>); setMsg(d.message); }
        else setMsg('Reação registrada. Se repetir, o produto será pausado automaticamente.');
        toast('Reação registrada'); setNotes('');
      }}>Registrar</button>
      {msg && <p className="banner" role="alert" style={{ marginTop: 8 }}>{msg}</p>}
      {sev === 'severe' && <p className="error">Reação grave: lave o rosto com água, suspenda o produto e procure atendimento médico se houver inchaço, falta de ar ou bolhas.</p>}
    </Card>
  );
}

function ProductManager({ area, products }: { area: CareArea; products: ProductRow[] }) {
  const store = useStore();
  const empty = { id: '', name: '', brand: '', category: CATEGORIES[area][0], ingredients: '', concentration: '', notes: '' };
  const [f, setF] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const mine = products.filter((p) => p.area === area);
  const intro = activeIntroduction(products.filter((p) => p.area === 'skin'), todayISO());
  const actives = detectActives(f.ingredients);
  return (
    <Card title="Produtos">
      {mine.length === 0 ? <Empty>Nenhum produto cadastrado.</Empty> : (
        <ul className="list">
          {mine.map((p) => (
            <li key={p.id}>
              <div className="row between">
                <span><strong>{p.name}</strong>{p.brand ? ` · ${p.brand}` : ''} <span className={`tag ${p.status === 'suspended' ? 'danger' : p.status === 'paused' ? 'warn' : p.status === 'introducing' ? 'accent' : 'ok'}`}>{STATUS_LABEL[p.status]}</span></span>
                <button className="btn ghost sm" onClick={() => setF({ id: p.id, name: p.name, brand: p.brand ?? '', category: p.category, ingredients: p.ingredients ?? '', concentration: p.concentration ?? '', notes: p.notes ?? '' })}>Editar</button>
              </div>
              <small>{CAT_LABEL[p.category] ?? p.category} · Ativos: {(p.actives as Active[]).map((a) => ACTIVE_LABEL[a] ?? a).join(', ') || 'nenhum identificado'}{p.concentration ? ` · ${p.concentration}` : ''}</small>
              {p.status === 'introducing' && p.started_on && <><br /><small>{introductionDays(p.started_on, todayISO()).phase}</small></>}
              {p.notes && <><br /><small className="muted">{p.notes}</small></>}
              <div className="row" style={{ marginTop: 6 }}>
                {p.status !== 'active' && p.status !== 'suspended' && !p.actives.includes('unknown') && <button className="btn sm" onClick={() => void store.upsert('care_products', { ...p, status: 'active' } as unknown as Record<string, unknown>)}>Marcar em uso</button>}
                {area === 'skin' && p.status !== 'introducing' && p.category === 'treatment' && !p.actives.includes('unknown') && (
                  <button className="btn sm" disabled={!!intro && intro.id !== p.id} title={intro ? `Já há um ativo em introdução: ${intro.name}` : ''}
                    onClick={() => void store.upsert('care_products', { ...p, status: 'introducing', started_on: todayISO() } as unknown as Record<string, unknown>)}>Iniciar introdução gradual</button>
                )}
                {p.status === 'suspended' && <button className="btn sm" onClick={() => { if (confirm('Reativar produto que causou reação? Recomece em baixa frequência.')) void store.upsert('care_products', { ...p, status: 'paused' } as unknown as Record<string, unknown>); }}>Reavaliar</button>}
                <button className="btn ghost sm" onClick={() => { if (confirm(`Excluir ${p.name}?`)) void store.remove('care_products', [p.id]); }}>Excluir</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {intro && area === 'skin' && <p className="hint">Introduzindo {intro.name}: aguarde 2 semanas antes de começar outro ativo, para saber o que causa qualquer reação.</p>}
      <h3>{f.id ? 'Editar produto' : 'Adicionar produto'}</h3>
      <div className="grid two">
        <Field label="Nome completo"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Marca"><input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></Field>
        <Field label="Categoria"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES[area].map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select></Field>
        <Field label="Concentração (se informada)"><input value={f.concentration} onChange={(e) => setF({ ...f, concentration: e.target.value })} placeholder="ex.: 10%" /></Field>
      </div>
      <Field label="Ingredientes (copie do rótulo/INCI)" hint={`Detectado: ${actives.map((a) => ACTIVE_LABEL[a]).join(', ') || 'nenhum ativo conhecido'}`}>
        <textarea value={f.ingredients} onChange={(e) => setF({ ...f, ingredients: e.target.value })} placeholder="Aqua, Niacinamide, ..." />
      </Field>
      <Field label="Observações"><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <ErrorBox error={error} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={async () => {
          if (!f.name.trim()) { setError('Informe o nome.'); return; }
          setError(null);
          const prev = mine.find((p) => p.id === f.id);
          await store.upsert('care_products', {
            id: f.id || uuid(), area, name: f.name.trim(), brand: f.brand || null, category: f.category, ingredients: f.ingredients || null,
            actives: actives.length ? actives : [], concentration: f.concentration || null,
            status: prev?.status ?? (actives.includes('unknown') ? 'paused' : 'active'), started_on: prev?.started_on ?? null, notes: f.notes || null,
          });
          setF(empty);
        }}>{f.id ? 'Salvar' : 'Adicionar'}</button>
        {f.id && <button className="btn ghost" onClick={() => setF(empty)}>Cancelar</button>}
      </div>
      <p className="hint">Sem ingredientes, o produto fica "pausado" com composição desconhecida e nunca é combinado automaticamente com ativos.</p>
    </Card>
  );
}

function RoutineEditor({ area, slots, items, products }: { area: CareArea; slots: CareSlot[]; items: RoutineItemRow[]; products: ProductRow[] }) {
  const store = useStore();
  const mine = items.filter((i) => i.area === area);
  const [edit, setEdit] = useState<RoutineItemRow | null>(null);
  const newItem = (slot: CareSlot): RoutineItemRow => ({ id: uuid(), user_id: store.userId, area, slot, product_id: null, step: '', step_order: mine.filter((i) => i.slot === slot).length + 1, days: [0, 1, 2, 3, 4, 5, 6], amount: '', notes: '', enabled: true });
  return (
    <Card title="Editar rotina">
      {slots.map((slot) => (
        <div key={slot}>
          <h3>{SLOT_LABEL[slot]}</h3>
          <ul className="list">
            {mine.filter((i) => i.slot === slot).sort((a, b) => a.step_order - b.step_order).map((i) => (
              <li key={i.id} className="row between">
                <span style={{ opacity: i.enabled ? 1 : 0.5 }}>{i.step_order}. {i.step}<br /><small>{i.days.length === 7 ? 'todos os dias' : i.days.map((d) => WEEKDAY_SHORT[d]).join(', ')}{i.product_id ? ` · ${products.find((p) => p.id === i.product_id)?.name ?? ''}` : ''}</small></span>
                <button className="btn ghost sm" onClick={() => setEdit(i)}>Editar</button>
              </li>
            ))}
          </ul>
          <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setEdit(newItem(slot))}>+ passo</button>
        </div>
      ))}
      {edit && (
        <div className="card" style={{ marginTop: 12 }}>
          <Field label="Passo"><input value={edit.step} onChange={(e) => setEdit({ ...edit, step: e.target.value })} /></Field>
          <Field label="Produto"><select value={edit.product_id ?? ''} onChange={(e) => setEdit({ ...edit, product_id: e.target.value || null })}><option value="">— (genérico)</option>{products.filter((p) => p.area === area).map((p) => <option key={p.id} value={p.id}>{p.name} ({STATUS_LABEL[p.status]})</option>)}</select></Field>
          <div className="grid two">
            <Field label="Quantidade"><input value={edit.amount ?? ''} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
            <Field label="Ordem"><input type="number" min={0} max={50} value={edit.step_order} onChange={(e) => setEdit({ ...edit, step_order: Number(e.target.value) })} /></Field>
          </div>
          <span className="field-l">Dias</span>
          <Chips multiple label="Dias" value={edit.days} onChange={(v) => setEdit({ ...edit, days: v })} options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: WEEKDAY_SHORT[d] }))} />
          <Field label="Observações"><input value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          <label className="check"><input type="checkbox" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} /> Ativo</label>
          <div className="row">
            <button className="btn primary" disabled={!edit.step.trim() || edit.days.length === 0} onClick={async () => { await store.upsert('routine_items', edit as unknown as Record<string, unknown>); setEdit(null); }}>Salvar</button>
            <button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button>
            {items.some((i) => i.id === edit.id) && <button className="btn danger" onClick={async () => { await store.remove('routine_items', [edit.id]); setEdit(null); }}>Excluir</button>}
          </div>
        </div>
      )}
    </Card>
  );
}

function Skin({ products, items, logs }: Props) {
  const store = useStore();
  const skinItems = items.filter((i) => i.area === 'skin');
  async function generate() {
    const byCat = (c: string) => products.find((p) => p.area === 'skin' && p.category === c && usable(p) && !p.actives.includes('unknown'));
    await store.upsert('routine_items', baseSkinRoutine().map((s) => ({
      id: uuid(), area: 'skin', slot: s.slot, product_id: byCat(s.category)?.id ?? null, step: s.step, step_order: s.order, days: s.days, amount: s.amount, notes: s.notes ?? null, enabled: true,
    })));
  }
  return (
    <>
      {skinItems.length === 0 ? (
        <Card title="Rotina de pele" className="accent">
          <p>Gere uma rotina base para pele oleosa com tendência à acne (limpeza, hidratação leve, protetor e um ativo noturno introduzido aos poucos). Depois edite à vontade.</p>
          <button className="btn primary" onClick={() => void generate()}>Gerar rotina base</button>
        </Card>
      ) : (
        <div className="grid two">
          <TodaySlot area="skin" slot="am" items={items} products={products} logs={logs} />
          <TodaySlot area="skin" slot="pm" items={items} products={products} logs={logs} />
        </div>
      )}
      <ReactionForm area="skin" products={products} />
      <ProductManager area="skin" products={products} />
      {skinItems.length > 0 && <RoutineEditor area="skin" slots={['am', 'pm']} items={items} products={products} />}
      <Card title="Segurança">
        <p><strong>Pare o produto se houver:</strong></p>
        <ul>{STOP_SIGNS.map((s) => <li key={s}><small>{s}</small></li>)}</ul>
        <p className="hint">{DERM_REFERRAL}</p>
        <p className="hint">Nenhum cosmético fecha poros, elimina flacidez ou muda a estrutura do rosto. Alegações de marketing sem estudo clínico são tratadas como alegações. O que tem boa evidência para acne/oleosidade: limpeza suave, protetor diário, ácido salicílico, peróxido de benzoíla, ácido azelaico, retinoides (alguns só com prescrição) e niacinamida.</p>
      </Card>
    </>
  );
}

function Hair({ products, items, logs }: Props) {
  const store = useStore();
  const { profile, save } = useProfile();
  const hp = profile?.hair ?? {};
  const today = todayISO();
  const wash = isWashDay(hp, today);
  const scalp = scalpStatus(logs, today);
  const hairItems = items.filter((i) => i.area === 'hair');
  async function generate() {
    const prod = (c: string) => products.find((p) => p.area === 'hair' && p.category === c && usable(p))?.id ?? null;
    const cats = ['shampoo', 'conditioner', 'leave-in', 'gel', null, null, null];
    await store.upsert('routine_items', [
      ...WASH_DAY_STEPS.map((s, i) => ({ id: uuid(), area: 'hair', slot: 'wash', product_id: cats[i] ? prod(cats[i]!) : null, step: s.step, step_order: i + 1, days: [0, 1, 2, 3, 4, 5, 6], amount: s.amount, notes: s.notes ?? null, enabled: true })),
      ...NON_WASH_DAY_STEPS.map((s, i) => ({ id: uuid(), area: 'hair', slot: 'non_wash', product_id: null, step: s.step, step_order: i + 1, days: [0, 1, 2, 3, 4, 5, 6], amount: s.amount, notes: null, enabled: true })),
    ]);
  }
  return (
    <>
      <Card title={wash ? 'Hoje é dia de lavar' : 'Hoje não é dia de lavar'} className={wash ? 'accent' : ''}>
        <p className="muted">Dias de lavagem: {washDays(hp).map((d) => WEEKDAY_SHORT[d]).join(', ')}</p>
        <Chips multiple label="Dias de lavagem" value={washDays(hp)} onChange={(v) => void save({ hair: { ...hp, washDays: v, washesPerWeek: v.length } })} options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: WEEKDAY_SHORT[d] }))} />
        <p className="hint">Treinando às 16h, lavar à noite nos dias de lavagem evita dormir com suor no couro cabeludo.</p>
      </Card>
      <Card title="Couro cabeludo" className={scalp.persistentItch ? 'rec p1' : ''}>
        <p>{scalp.message}</p>
        {scalp.avgItch !== null && <p className="hint">Coceira média (14 dias): {scalp.avgItch}/10 em {scalp.entries} registros.</p>}
        <p className="hint">Coceira persistente, descamação, vermelhidão, feridas ou queda acentuada → dermatologista. O app não recomenda medicamentos capilares sem avaliação.</p>
      </Card>
      {hairItems.length === 0 ? (
        <Card title="Rotina de cabelo"><p>Gerar rotina para cacheado com oleosidade, frizz e volume (editável).</p><button className="btn primary" onClick={() => void generate()}>Gerar rotina</button></Card>
      ) : (
        <TodaySlot area="hair" slot={wash ? 'wash' : 'non_wash'} items={scalp.persistentItch ? items.filter((i) => !/gel|creme|leave-in/i.test(i.step) || i.slot !== 'wash') : items} products={products} logs={logs}
          extra={scalp.persistentItch ? <p className="hint">Finalizadores ocultados enquanto a coceira estiver frequente.</p> : null} />
      )}
      <Card title="Corte e finalização">
        <ul className="list">{cutSuggestions(hp).map((c) => <li key={c}><small>{c}</small></li>)}</ul>
      </Card>
      <ReactionForm area="hair" products={products} />
      <ProductManager area="hair" products={products} />
      {hairItems.length > 0 && <RoutineEditor area="hair" slots={['wash', 'non_wash', 'scalp']} items={items} products={products} />}
    </>
  );
}

function Grooming({ products, items, logs }: Props) {
  const { profile } = useProfile();
  const g = profile?.grooming ?? {};
  return (
    <>
      <Card title="Barba">
        {g.beardGoal && <p className="muted">Objetivo: {g.beardGoal}</p>}
        <ul className="list">{GROOMING_GUIDE.beard.map((t) => <li key={t}><small>{t}</small></li>)}</ul>
        {g.acneInBeardArea && <p className="hint">Com acne na região da barba: troque/limpe a lâmina com frequência, evite óleos pesados e mantenha a barba limpa diariamente.</p>}
      </Card>
      <Card title="Bigode"><ul className="list">{GROOMING_GUIDE.mustache.map((t) => <li key={t}><small>{t}</small></li>)}</ul></Card>
      <Card title="Sobrancelhas">
        {g.browsGoal && <p className="muted">Objetivo: {g.browsGoal}</p>}
        <ul className="list">{GROOMING_GUIDE.brows.map((t) => <li key={t}><small>{t}</small></li>)}</ul>
      </Card>
      <TodaySlot area="beard" slot="weekly" items={items} products={products} logs={logs} />
      <RoutineEditor area="beard" slots={['weekly']} items={items} products={products} />
      <ProductManager area="beard" products={products} />
    </>
  );
}
