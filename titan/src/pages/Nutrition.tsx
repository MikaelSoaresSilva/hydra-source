import { useMemo, useState } from 'react';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { addDays, formatBR, todayISO } from '../domain/dates';
import { alternativesForFood, equivalentGrams, FOOD_BY_KEY, FOODS, macrosFor, type Food } from '../domain/foods';
import { estimateCost, generateDayPlan, roundMacros, shoppingList, type DayPlan } from '../domain/mealplan';
import { adjustCalories, movingAverage, weeklyAverages } from '../domain/trend';
import { foodAdherence } from '../domain/recommendations';
import type { FoodLogRow, FoodPriceRow, MetricRow, TargetRow, UserFoodRow } from '../domain/types';
import { createTargets, profileReadyForTargets } from '../services';
import { TrendChart } from '../ui/charts';
import { Card, Empty, ErrorBox, Field, Loading, NumberInput, Progress, Tabs, fmt, useToast } from '../ui/components';

type Tab = 'hoje' | 'plano' | 'compras' | 'metas';

const userFoodToFood = (u: UserFoodRow): Food => ({
  key: `user:${u.id}`, name: u.name, role: 'carb', kcal: Number(u.kcal_100g), protein: Number(u.protein_100g), carbs: Number(u.carbs_100g), fat: Number(u.fat_100g),
  rawFactor: 1, maxGrams: 1000, source: u.source ?? 'cadastro próprio',
});

export function usePlan(target: TargetRow | undefined) {
  const { profile } = useProfile();
  return useMemo<DayPlan | null>(() => {
    if (!target) return null;
    const plan = generateDayPlan({ kcal: target.kcal, protein: target.protein_g, carbs: target.carbs_g, fat: target.fat_g }, {
      mealsPerDay: profile?.nutrition.mealsPerDay, excluded: profile?.nutrition.excludedFoods, hasKitchen: profile?.nutrition.hasKitchen,
    });
    const swaps = profile?.nutrition.planSwaps ?? {};
    plan.meals.forEach((m, mi) => {
      m.items = m.items.map((it) => {
        const to = swaps[`${mi}:${it.foodKey}`];
        return to && FOOD_BY_KEY[to] ? { foodKey: to, grams: equivalentGrams(FOOD_BY_KEY[it.foodKey], it.grams, FOOD_BY_KEY[to]).grams } : it;
      });
    });
    plan.totals = roundMacros(plan.meals.flatMap((m) => m.items).reduce((a, i) => {
      const x = macrosFor(FOOD_BY_KEY[i.foodKey], i.grams);
      return { kcal: a.kcal + x.kcal, protein: a.protein + x.protein, carbs: a.carbs + x.carbs, fat: a.fat + x.fat };
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 }));
    return plan;
  }, [target, profile]);
}

export function Nutrition() {
  const store = useStore();
  const { profile, save } = useProfile();
  const [tab, setTab] = useState<Tab>('hoje');
  const targets = useRows<TargetRow>('nutrition_targets', { order: { col: 'effective_from', asc: false } });
  const today = todayISO();
  const logs = useRows<FoodLogRow>('food_logs', { gte: { date: addDays(today, -21) } });
  const metrics = useRows<MetricRow>('body_metrics', { order: { col: 'date' } });
  const prices = useRows<FoodPriceRow>('food_prices');
  const userFoods = useRows<UserFoodRow>('user_foods');
  const target = [...targets.data].sort((a, b) => (a.effective_from + (a.created_at ?? '') < b.effective_from + (b.created_at ?? '') ? 1 : -1))[0];
  const plan = usePlan(target);
  const { toast, node } = useToast();
  const [error, setError] = useState<string | null>(null);
  const allFoods = useMemo(() => [...FOODS, ...userFoods.data.map(userFoodToFood)], [userFoods.data]);
  const foodOf = (k: string) => allFoods.find((f) => f.key === k);

  // Registro do dia
  const [meal, setMeal] = useState('');
  const [query, setQuery] = useState('');
  const [foodKey, setFoodKey] = useState('');
  const [grams, setGrams] = useState<number | null>(null);
  const todayLogs = logs.data.filter((l) => l.date === today);
  const eaten = todayLogs.reduce((a, l) => ({ kcal: a.kcal + Number(l.kcal), protein: a.protein + Number(l.protein_g), carbs: a.carbs + Number(l.carbs_g), fat: a.fat + Number(l.fat_g) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  async function addLog(fk: string, g: number, mealName: string) {
    const f = foodOf(fk);
    if (!f || g <= 0 || g > 5000) { setError('Escolha um alimento e uma quantidade válida.'); return; }
    const m = macrosFor(f, g);
    await store.upsert('food_logs', { id: uuid(), date: today, meal: mealName || 'Outro', food_key: f.key, food_name: f.name, grams: g,
      kcal: Math.round(m.kcal * 10) / 10, protein_g: Math.round(m.protein * 10) / 10, carbs_g: Math.round(m.carbs * 10) / 10, fat_g: Math.round(m.fat * 10) / 10 });
  }

  // Metas
  const missing = profileReadyForTargets(profile);
  const weights = metrics.data.filter((m) => m.weight_kg !== null).map((m) => ({ date: m.date, weight: Number(m.weight_kg) }));
  const weekly = weeklyAverages(weights);
  const adherence = foodAdherence(logs.data, target ?? null, today);
  const adj = target ? adjustCalories({ currentKcal: target.kcal, weekly, targetWeeklyGainKg: Number((target.inputs as { weeklyGainKg?: number }).weeklyGainKg ?? 0.2), adherence: adherence.value }) : null;

  // Compras/preços
  const [price, setPrice] = useState({ food: '', price: null as number | null, pkg: null as number | null, store: '', source: '', date: today });
  const [uf, setUf] = useState({ name: '', kcal: null as number | null, p: null as number | null, c: null as number | null, f: null as number | null, source: '' });

  if (targets.loading) return <Loading />;
  const mealsLeft = plan?.meals.filter((m) => !todayLogs.some((l) => l.meal === m.name)) ?? [];

  return (
    <div className="stack">
      {node}
      <h1>Nutrição</h1>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'hoje', label: 'Hoje' }, { value: 'plano', label: 'Plano' }, { value: 'compras', label: 'Compras' }, { value: 'metas', label: 'Metas' }]} />
      <ErrorBox error={error} />

      {!target && (
        <Card title="Meta ainda não calculada">
          {missing.length ? <p>Complete no Perfil: {missing.join(', ')}.</p> : (
            <button className="btn primary" onClick={() => void createTargets(store, profile!)}>Calcular minha meta</button>
          )}
        </Card>
      )}

      {tab === 'hoje' && target && (
        <>
          <Card title="Hoje">
            {[
              ['Calorias', eaten.kcal, target.kcal, 'kcal'], ['Proteína', eaten.protein, target.protein_g, 'g'],
              ['Carboidratos', eaten.carbs, target.carbs_g, 'g'], ['Gorduras', eaten.fat, target.fat_g, 'g'],
            ].map(([l, v, t, u]) => (
              <div key={l as string} style={{ marginBottom: 8 }}>
                <div className="row between"><span>{l}</span><span>{fmt(v as number, 0)} / {t} {u}</span></div>
                <Progress value={v as number} max={t as number} label={l as string} />
              </div>
            ))}
            <p className="hint">Refeições do plano ainda não registradas: {mealsLeft.length ? mealsLeft.map((m) => `${m.name} (${m.time})`).join(', ') : 'nenhuma 🎉'}</p>
          </Card>
          <Card title="Registrar alimento">
            <div className="stack">
              <Field label="Refeição">
                <select value={meal} onChange={(e) => setMeal(e.target.value)}>
                  <option value="">Outro</option>
                  {plan?.meals.map((m) => <option key={m.name}>{m.name}</option>)}
                </select>
              </Field>
              <Field label="Buscar alimento"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="arroz, frango, ovo…" /></Field>
              <select value={foodKey} onChange={(e) => setFoodKey(e.target.value)} aria-label="Alimento">
                <option value="">Escolha…</option>
                {allFoods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())).map((f) => <option key={f.key} value={f.key}>{f.name} ({f.kcal} kcal/100 g)</option>)}
              </select>
              <Field label="Quantidade (g)" hint={foodOf(foodKey)?.unitGrams ? `1 ${foodOf(foodKey)!.unitName} ≈ ${foodOf(foodKey)!.unitGrams} g` : undefined}>
                <NumberInput value={grams} min={0} max={5000} onChange={setGrams} />
              </Field>
              {foodKey && grams ? <p className="hint">≈ {fmt(macrosFor(foodOf(foodKey)!, grams).kcal, 0)} kcal · {fmt(macrosFor(foodOf(foodKey)!, grams).protein, 0)} g proteína</p> : null}
              <button className="btn primary" onClick={async () => { setError(null); await addLog(foodKey, grams ?? 0, meal); setGrams(null); toast('Registrado.'); }}>Adicionar</button>
            </div>
          </Card>
          <Card title="Registrado hoje">
            {todayLogs.length === 0 ? <Empty>Nada registrado hoje.</Empty> : (
              <ul className="list">{todayLogs.map((l) => (
                <li key={l.id} className="row between"><span>{l.food_name} · {fmt(Number(l.grams), 0)} g<br /><small>{l.meal} · {fmt(Number(l.kcal), 0)} kcal · P {fmt(Number(l.protein_g), 0)} g</small></span>
                  <button className="btn ghost sm" aria-label={`Excluir ${l.food_name}`} onClick={() => void store.remove('food_logs', [l.id])}>Excluir</button></li>
              ))}</ul>
            )}
          </Card>
        </>
      )}

      {tab === 'plano' && plan && (
        <>
          <Card title="Plano do dia" action={<span className="tag">{plan.totals.kcal} kcal · P {plan.totals.protein} · C {plan.totals.carbs} · G {plan.totals.fat}</span>}>
            <p className="hint">Meta: {target!.kcal} kcal · P {target!.protein_g} g · C {target!.carbs_g} g · G {target!.fat_g} g. Quantidades do alimento pronto (cozido/grelhado). Troque itens mantendo o macro principal.</p>
            {plan.notes.map((n) => <p key={n} className="hint">• {n}</p>)}
          </Card>
          {plan.meals.map((m, mi) => (
            <Card key={m.name} title={`${m.time} · ${m.name}`} action={
              <button className="btn sm" onClick={async () => { for (const it of m.items) await addLog(it.foodKey, it.grams, m.name); toast(`${m.name} registrada.`); }}>Comi isso</button>}>
              <ul className="list">
                {m.items.map((it) => {
                  const f = FOOD_BY_KEY[it.foodKey];
                  const alts = alternativesForFood(it.foodKey).filter((a) => !(profile?.nutrition.excludedFoods ?? []).includes(a.key));
                  return (
                    <li key={it.foodKey} className="row between">
                      <span>{f.name} — <strong>{it.grams} g</strong>{f.unitGrams ? <small> (~{fmt(it.grams / f.unitGrams)} {f.unitName})</small> : null}<br /><small>{fmt(macrosFor(f, it.grams).kcal, 0)} kcal · P {fmt(macrosFor(f, it.grams).protein, 0)} g</small></span>
                      {alts.length > 0 && (
                        <select aria-label={`Trocar ${f.name}`} style={{ width: 'auto', maxWidth: 160 }} value="" onChange={async (e) => {
                          const orig = Object.entries(profile?.nutrition.planSwaps ?? {}).find(([k, v]) => k.startsWith(`${mi}:`) && v === it.foodKey)?.[0] ?? `${mi}:${it.foodKey}`;
                          await save({ nutrition: { ...profile!.nutrition, planSwaps: { ...profile!.nutrition.planSwaps, [orig]: e.target.value } } });
                        }}>
                          <option value="">Trocar…</option>
                          {alts.map((a) => <option key={a.key} value={a.key}>{a.name} ({equivalentGrams(f, it.grams, a).grams} g, {equivalentGrams(f, it.grams, a).kcalDiff >= 0 ? '+' : ''}{equivalentGrams(f, it.grams, a).kcalDiff} kcal)</option>)}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
          {profile?.nutrition.planSwaps && Object.keys(profile.nutrition.planSwaps).length > 0 && (
            <button className="btn ghost sm" onClick={() => void save({ nutrition: { ...profile.nutrition, planSwaps: {} } })}>Desfazer trocas</button>
          )}
          <Card title="Suplementos (opcionais)">
            <ul className="list">
              <li><strong>Creatina monoidratada</strong> 3–5 g/dia: a evidência mais sólida para força e massa magra; barata. Pode reter um pouco de água (afeta a balança).</li>
              <li><strong>Whey protein</strong>: só conveniência para fechar a proteína; comida resolve igual.</li>
              <li>Nada de estimulantes de apetite, hormônios ou "pró-hormônios". Com condição renal, hepática ou uso de medicamentos, consulte um profissional antes.</li>
            </ul>
            {profile?.nutrition.supplements && <p className="hint">Você informou: {profile.nutrition.supplements}</p>}
          </Card>
        </>
      )}

      {tab === 'compras' && plan && (() => {
        const items = shoppingList(plan);
        const cost = estimateCost(items, prices.data.map((p) => ({ ...p, price_brl: Number(p.price_brl), package_g: Number(p.package_g) })));
        const budget = profile?.nutrition.budgetMonthlyBrl;
        return (
          <>
            <Card title="Lista de compras" action={cost.month > 0 ? <span className="tag">~R$ {fmt(cost.month, 2)}/mês</span> : null}>
              <p className="hint">Peso de compra (cru/seco) estimado com fatores de cocção aproximados.</p>
              <div className="scroll-x"><table className="t">
                <thead><tr><th>Item</th><th>Semana</th><th>Mês</th><th>Custo/mês</th></tr></thead>
                <tbody>{cost.lines.map((l) => (
                  <tr key={l.foodKey}><td>{l.name}{l.unitsWeek ? <small><br />{l.unitsWeek}/sem</small> : null}</td><td>{fmt(l.buyGramsWeek / 1000, 2)} kg</td><td>{fmt(l.buyGramsMonth / 1000, 2)} kg</td>
                    <td>{l.costMonth !== null ? <>R$ {fmt(l.costMonth, 2)}<small><br />{formatBR(l.price!.observed_on)}{l.price!.store ? ` · ${l.price!.store}` : ''}</small></> : <small>sem preço</small>}</td></tr>
                ))}</tbody>
              </table></div>
              {cost.missing.length > 0 && <p className="hint">Sem preço registrado: {cost.missing.join(', ')}. O custo só usa preços que você informar, com data e fonte.</p>}
              {budget && cost.month > 0 && <p className={cost.month > budget ? 'error' : 'hint'}>Orçamento informado: R$ {fmt(budget, 2)}/mês{cost.month > budget ? ' — o plano estimado passa do orçamento: troque proteínas por ovos/frango/sardinha e carboidratos por arroz/feijão/mandioca.' : '.'}</p>}
            </Card>
            <Card title="Registrar preço">
              <div className="grid two">
                <Field label="Alimento"><select value={price.food} onChange={(e) => setPrice({ ...price, food: e.target.value })}><option value="">—</option>{FOODS.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}</select></Field>
                <Field label="Preço (R$)"><NumberInput value={price.price} min={0} onChange={(v) => setPrice({ ...price, price: v })} /></Field>
                <Field label="Tamanho da embalagem (g ou ml)" hint="Ovos: 12 un ≈ 600 g"><NumberInput value={price.pkg} min={0} onChange={(v) => setPrice({ ...price, pkg: v })} /></Field>
                <Field label="Data da observação"><input type="date" value={price.date} onChange={(e) => setPrice({ ...price, date: e.target.value })} /></Field>
                <Field label="Loja"><input value={price.store} onChange={(e) => setPrice({ ...price, store: e.target.value })} /></Field>
                <Field label="Fonte (nota fiscal, site, encarte)"><input value={price.source} onChange={(e) => setPrice({ ...price, source: e.target.value })} /></Field>
              </div>
              <button className="btn primary" style={{ marginTop: 8 }} onClick={async () => {
                if (!price.food || !price.price || !price.pkg) { setError('Preencha alimento, preço e embalagem.'); return; }
                await store.upsert('food_prices', { id: uuid(), food_key: price.food, price_brl: price.price, package_g: price.pkg, store: price.store || null, source: price.source || null, observed_on: price.date });
                setPrice({ ...price, price: null, pkg: null }); toast('Preço salvo.');
              }}>Salvar preço</button>
            </Card>
            <Card title="Cadastrar alimento próprio (rótulo)">
              <div className="grid two">
                <Field label="Nome"><input value={uf.name} onChange={(e) => setUf({ ...uf, name: e.target.value })} /></Field>
                <Field label="kcal/100 g"><NumberInput value={uf.kcal} min={0} max={950} onChange={(v) => setUf({ ...uf, kcal: v })} /></Field>
                <Field label="Proteína/100 g"><NumberInput value={uf.p} min={0} max={100} onChange={(v) => setUf({ ...uf, p: v })} /></Field>
                <Field label="Carboidrato/100 g"><NumberInput value={uf.c} min={0} max={100} onChange={(v) => setUf({ ...uf, c: v })} /></Field>
                <Field label="Gordura/100 g"><NumberInput value={uf.f} min={0} max={100} onChange={(v) => setUf({ ...uf, f: v })} /></Field>
                <Field label="Fonte"><input value={uf.source} onChange={(e) => setUf({ ...uf, source: e.target.value })} placeholder="rótulo da marca X" /></Field>
              </div>
              <button className="btn" style={{ marginTop: 8 }} onClick={async () => {
                if (!uf.name || uf.kcal === null || uf.p === null || uf.c === null || uf.f === null) { setError('Preencha nome e os 4 valores.'); return; }
                await store.upsert('user_foods', { id: uuid(), name: uf.name, kcal_100g: uf.kcal, protein_100g: uf.p, carbs_100g: uf.c, fat_100g: uf.f, source: uf.source || null });
                setUf({ name: '', kcal: null, p: null, c: null, f: null, source: '' }); toast('Alimento cadastrado.');
              }}>Salvar alimento</button>
            </Card>
          </>
        );
      })()}

      {tab === 'metas' && target && (
        <>
          <Card title="Meta atual" action={<span className="tag">desde {formatBR(target.effective_from)}</span>}>
            <div className="stats">
              <div className="stat"><span className="stat-l">Calorias</span><strong className="stat-v">{target.kcal}</strong></div>
              <div className="stat"><span className="stat-l">Proteína</span><strong className="stat-v">{target.protein_g} g</strong></div>
              <div className="stat"><span className="stat-l">Carboidratos</span><strong className="stat-v">{target.carbs_g} g</strong></div>
              <div className="stat"><span className="stat-l">Gorduras</span><strong className="stat-v">{target.fat_g} g</strong></div>
            </div>
            <ul className="list" style={{ marginTop: 8 }}>{(target.rationale ?? '').split('\n').filter(Boolean).map((l) => <li key={l}><small>{l}</small></li>)}</ul>
            <button className="btn ghost sm" style={{ marginTop: 8 }} disabled={missing.length > 0} onClick={async () => { await createTargets(store, profile!); toast('Meta recalculada com o perfil atual.'); }}>Recalcular a partir do perfil</button>
          </Card>
          <Card title="Ajuste pela tendência">
            {adj && (
              <>
                <p><strong>{adj.action === 'increase' ? `Sugestão: +${adj.deltaKcal} kcal` : adj.action === 'decrease' ? `Sugestão: ${adj.deltaKcal} kcal` : adj.action === 'maintain' ? 'Manter a meta' : adj.action === 'improve_adherence' ? 'Melhorar a adesão primeiro' : 'Dados insuficientes'}</strong></p>
                <p className="hint">{adj.reason}</p>
                {(adj.action === 'increase' || adj.action === 'decrease') && (
                  <button className="btn primary" onClick={async () => { await createTargets(store, profile!, `Ajuste pela tendência de peso: ${adj.reason}`, adj.newKcal); toast('Nova meta aplicada.'); }}>Aplicar {adj.newKcal} kcal</button>
                )}
              </>
            )}
            <p className="hint">Peso diário oscila com água, sal, carboidrato e intestino. O app só ajusta pela média semanal (3+ pesagens/semana) e exige 2 semanas consistentes.</p>
          </Card>
          <Card title="Peso: diário × média de 7 dias">
            {weights.length ? <TrendChart label="Peso corporal" data={movingAverage(weights)} xKey="date" series={[{ key: 'weight', label: 'Pesagem (kg)', dotsOnly: true }, { key: 'avg', label: 'Média 7 dias (kg)' }]} />
              : <Empty>Registre pesagens em Evolução.</Empty>}
            {weekly.length > 0 && <p className="hint">Médias semanais: {weekly.slice(-4).map((w) => `${formatBR(w.weekStart).slice(0, 5)}: ${fmt(w.avg, 2)} kg`).join(' · ')}</p>}
          </Card>
        </>
      )}
    </div>
  );
}
