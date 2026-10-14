import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EMPTY_PROFILE, useProfile, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { FOODS } from '../domain/foods';
import { ACTIVITY_LABEL } from '../domain/nutrition';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, type Equipment, type Muscle, type Profile } from '../domain/types';
import { WEEKDAY_SHORT, todayISO } from '../domain/dates';
import { createProgram, createTargets, profileReadyForTargets } from '../services';
import { Card, Chips, ErrorBox, Field, NumberInput, Scale } from '../ui/components';

const STEPS = ['Você', 'Treino', 'Nutrição', 'Pele', 'Cabelo e barba', 'Resumo'];

const REFERENCE: Partial<Profile> = { age: 19, sex: 'male', height_cm: 180 };
const MENTIONED_PRODUCTS = ['Principia GL-02', 'Niacinamida', 'MIX-01', 'Hidratante Principia', 'Protetor solar FPS 60', 'NC-10'];
const SKIN_CONCERNS = ['acne', 'cravos', 'poros aparentes', 'textura irregular', 'manchas', 'oleosidade', 'linhas finas', 'aparência cansada', 'flacidez'];
const HAIR_CONCERNS = ['oleosidade', 'ressecamento', 'volume excessivo', 'frizz', 'coceira', 'queda'];
const HAIR_GOALS = ['caimento mais solto', 'alinhamento', 'menos frizz', 'controle de volume', 'usar franja'];

export function Onboarding() {
  const store = useStore();
  const { profile, save } = useProfile();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [p, setP] = useState<Profile>(() => {
    const base = profile ?? EMPTY_PROFILE(store.userId);
    if (profile) return base;
    return {
      ...base, ...REFERENCE,
      training: { trainingDays: [1, 2, 3, 4, 5], trainingTime: '16:00', sessionMinutes: 100, priorities: ['biceps', 'triceps', 'brachialis', 'side_delts', 'back', 'chest'] },
      nutrition: { weightKg: 80, activityLevel: 'moderate', mealsPerDay: 5, hasKitchen: true, hasFridge: true },
      skin: { type: 'oily', concerns: ['acne', 'cravos', 'poros aparentes', 'textura irregular', 'manchas', 'oleosidade', 'linhas finas', 'aparência cansada', 'flacidez'], areas: 'bochechas, testa, entre as sobrancelhas, sulcos nasolabiais' },
      hair: { curlType: '2C–3A (a confirmar)', length: 'médio', scalp: 'oily', concerns: ['oleosidade', 'ressecamento', 'volume excessivo', 'frizz', 'coceira'], washesPerWeek: 3, goals: ['caimento mais solto', 'alinhamento', 'menos frizz', 'controle de volume', 'usar franja'], wantsFringe: true },
      grooming: { beardGoal: 'barba e bigode mais alinhados e definidos', browsGoal: 'mais organizadas sem mudar o formato natural' },
    };
  });
  const [confirmed, setConfirmed] = useState(!!profile);
  const [stillUsing, setStillUsing] = useState<string[]>([]);

  const T = p.training; const N = p.nutrition; const S = p.skin; const H = p.hair; const G = p.grooming;
  const setT = (x: Partial<Profile['training']>) => setP({ ...p, training: { ...T, ...x } });
  const setN = (x: Partial<Profile['nutrition']>) => setP({ ...p, nutrition: { ...N, ...x } });
  const setS = (x: Partial<Profile['skin']>) => setP({ ...p, skin: { ...S, ...x } });
  const setH = (x: Partial<Profile['hair']>) => setP({ ...p, hair: { ...H, ...x } });
  const setG = (x: Partial<Profile['grooming']>) => setP({ ...p, grooming: { ...G, ...x } });

  async function next(skip = false) {
    setError(null);
    if (step === 0 && !skip && !confirmed) { setError('Confirme que os dados estão atuais (ou corrija-os) antes de continuar.'); return; }
    setBusy(true);
    try {
      if (!skip) await save(p);
      if (step === 3 && !skip && stillUsing.length) {
        const existing = await store.list<{ name: string }>('care_products');
        const rows = stillUsing.filter((n) => !existing.some((e) => e.name === n)).map((name) => ({
          id: uuid(), area: 'skin', name, brand: null, category: /protetor/i.test(name) ? 'sunscreen' : /hidratante/i.test(name) ? 'moisturizer' : 'treatment',
          ingredients: null, actives: /protetor/i.test(name) ? ['sunscreen'] : ['unknown'], concentration: null, status: 'paused', started_on: null,
          notes: 'Cadastrado no onboarding. Composição não confirmada: envie a foto do rótulo ou a lista de ingredientes antes de usar em combinação.',
        }));
        if (rows.length) await store.upsert('care_products', rows);
      }
      setStep(step + 1);
      window.scrollTo(0, 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true); setError(null);
    try {
      const done: Profile = { ...p, onboarding_completed_at: new Date().toISOString() };
      await save(done);
      const programs = await store.list('programs', { eq: { status: 'active' } });
      if (!programs.length) await createProgram(store, done, todayISO());
      if (!profileReadyForTargets(done).length) {
        const t = await store.list('nutrition_targets');
        if (!t.length) await createTargets(store, done);
      }
      nav('/');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div>
        <span className="muted">Etapa {step + 1} de {STEPS.length}</span>
        <h1>{STEPS[step]}</h1>
        <div className="progress" aria-hidden><div style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      </div>

      {step === 0 && (
        <Card>
          <p className="muted">Pré-preenchido com os dados que você informou. <strong>Confirme ou corrija</strong> — eles alimentam os cálculos.</p>
          <div className="grid two">
            <Field label="Como quer ser chamado?"><input value={p.display_name ?? ''} onChange={(e) => setP({ ...p, display_name: e.target.value })} /></Field>
            <Field label="Idade"><NumberInput value={p.age} min={13} max={100} onChange={(v) => setP({ ...p, age: v === null ? null : Math.round(v) })} /></Field>
            <Field label="Sexo (para a fórmula de gasto energético)">
              <select value={p.sex ?? ''} onChange={(e) => setP({ ...p, sex: (e.target.value || null) as Profile['sex'] })}>
                <option value="">—</option><option value="male">Masculino</option><option value="female">Feminino</option>
              </select>
            </Field>
            <Field label="Altura (cm)"><NumberInput value={p.height_cm} min={120} max={230} onChange={(v) => setP({ ...p, height_cm: v })} /></Field>
            <Field label="Peso atual (kg)" hint="Pesagem em jejum, ao acordar, de preferência."><NumberInput value={N.weightKg} min={30} max={300} onChange={(v) => setN({ weightKg: v ?? undefined })} /></Field>
            <Field label="Lesões, dores ou limitações atuais"><textarea value={T.injuries ?? ''} onChange={(e) => setT({ injuries: e.target.value })} placeholder="Ex.: incômodo no ombro direito no supino" /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Confirmo que estes dados estão atuais.</label>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <div className="grid two">
            <Field label="Tempo de musculação (meses)"><NumberInput value={T.experienceMonths} min={0} max={600} onChange={(v) => setT({ experienceMonths: v ?? undefined })} /></Field>
            <Field label="Divisão de treino atual"><input value={T.currentSplit ?? ''} onChange={(e) => setT({ currentSplit: e.target.value })} placeholder="Ex.: ABCDE" /></Field>
          </div>
          <Field label="Exercícios, cargas, séries e repetições atuais" hint="Texto livre. Ajuda a calibrar as primeiras cargas; o app passa a usar seus registros reais."><textarea value={T.currentLoads ?? ''} onChange={(e) => setT({ currentLoads: e.target.value })} placeholder="Rosca direta W 30 kg 3×10; Supino 70 kg 3×8…" /></Field>
          <h3>Grupos prioritários</h3>
          <Chips multiple label="Prioridades" value={T.priorities ?? []} onChange={(v) => setT({ priorities: v as Muscle[] })}
            options={(Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => ({ value: m, label: MUSCLE_LABEL[m] }))} />
          <p className="hint">Bíceps, tríceps e braquial já recebem volume extra por padrão.</p>
          <h3>Dias de treino</h3>
          <Chips multiple label="Dias" value={T.trainingDays ?? []} onChange={(v) => setT({ trainingDays: (v as number[]).sort() })}
            options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: WEEKDAY_SHORT[d] }))} />
          <div className="grid two" style={{ marginTop: 8 }}>
            <Field label="Horário habitual"><input type="time" value={T.trainingTime ?? '16:00'} onChange={(e) => setT({ trainingTime: e.target.value })} /></Field>
            <Field label="Tempo disponível por sessão (min)"><NumberInput value={T.sessionMinutes} min={30} max={180} onChange={(v) => setT({ sessionMinutes: v ?? undefined })} /></Field>
            <Field label="Horas de sono por noite"><NumberInput value={T.sleepHours} min={0} max={14} onChange={(v) => setT({ sleepHours: v ?? undefined })} /></Field>
          </div>
          <Scale label="Qualidade do sono / recuperação" value={T.sleepQuality ?? null} onChange={(v) => setT({ sleepQuality: v as 1 })} low="péssima" high="excelente" />
          <h3>Equipamentos da sua academia</h3>
          <Chips multiple label="Equipamentos" value={T.equipment ?? []} onChange={(v) => setT({ equipment: v as Equipment[] })}
            options={(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => ({ value: e, label: EQUIPMENT_LABEL[e] }))} />
          <label className="check"><input type="checkbox" checked={!!T.equipmentConfirmed} onChange={(e) => setT({ equipmentConfirmed: e.target.checked })} /> Conferi a lista (sem marcar nada, o plano assume uma academia completa).</label>
          <Field label="Exercícios que não consegue ou não quer fazer"><textarea value={T.unableExercises ?? ''} onChange={(e) => setT({ unableExercises: e.target.value })} /></Field>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <Field label="Nível de atividade (incluindo o treino)">
            <select value={N.activityLevel ?? 'moderate'} onChange={(e) => setN({ activityLevel: e.target.value as 'moderate' })}>
              {Object.entries(ACTIVITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <div className="grid two">
            <Field label="Refeições por dia"><select value={N.mealsPerDay ?? 5} onChange={(e) => setN({ mealsPerDay: Number(e.target.value) })}>{[3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></Field>
            <Field label="Apetite"><select value={N.appetite ?? 'normal'} onChange={(e) => setN({ appetite: e.target.value as 'normal' })}><option value="low">Baixo</option><option value="normal">Normal</option><option value="high">Alto</option></select></Field>
            <Field label="Orçamento mensal para alimentação (R$)"><NumberInput value={N.budgetMonthlyBrl} min={0} onChange={(v) => setN({ budgetMonthlyBrl: v ?? undefined })} /></Field>
            <Field label="Mudança de peso recente"><input value={N.recentWeightChange ?? ''} onChange={(e) => setN({ recentWeightChange: e.target.value })} placeholder="Ex.: estável nos últimos 2 meses" /></Field>
          </div>
          <Field label="O que você come num dia normal"><textarea value={N.usualIntake ?? ''} onChange={(e) => setN({ usualIntake: e.target.value })} /></Field>
          <Field label="Dificuldades para comer"><input value={N.eatingDifficulties ?? ''} onChange={(e) => setN({ eatingDifficulties: e.target.value })} /></Field>
          <Field label="Restrições alimentares"><input value={N.restrictions ?? ''} onChange={(e) => setN({ restrictions: e.target.value })} /></Field>
          <Field label="Alergias / intolerâncias"><input value={N.allergies ?? ''} onChange={(e) => setN({ allergies: e.target.value })} /></Field>
          <Field label="Condições de saúde relevantes"><input value={N.conditions ?? ''} onChange={(e) => setN({ conditions: e.target.value })} /></Field>
          <Field label="Suplementos que usa"><input value={N.supplements ?? ''} onChange={(e) => setN({ supplements: e.target.value })} /></Field>
          <div className="row">
            <label className="check"><input type="checkbox" checked={N.hasKitchen !== false} onChange={(e) => setN({ hasKitchen: e.target.checked })} /> Tenho cozinha</label>
            <label className="check"><input type="checkbox" checked={N.hasFridge !== false} onChange={(e) => setN({ hasFridge: e.target.checked })} /> Tenho geladeira</label>
          </div>
          <h3>Alimentos que você NÃO come</h3>
          <Chips multiple label="Excluir alimentos" value={N.excludedFoods ?? []} onChange={(v) => setN({ excludedFoods: v })} options={FOODS.map((f) => ({ value: f.key, label: f.name }))} />
        </Card>
      )}

      {step === 3 && (
        <Card>
          <Field label="Tipo de pele"><select value={S.type ?? ''} onChange={(e) => setS({ type: e.target.value as 'oily' })}>
            <option value="">—</option><option value="oily">Oleosa</option><option value="combination">Mista</option><option value="normal">Normal</option><option value="dry">Seca</option><option value="sensitive">Sensível</option></select></Field>
          <h3>Preocupações</h3>
          <Chips multiple label="Preocupações da pele" value={S.concerns ?? []} onChange={(v) => setS({ concerns: v })} options={SKIN_CONCERNS.map((c) => ({ value: c, label: c }))} />
          <Field label="Áreas"><input value={S.areas ?? ''} onChange={(e) => setS({ areas: e.target.value })} /></Field>
          <Field label="Sensibilidades e reações anteriores"><textarea value={S.pastReactions ?? ''} onChange={(e) => setS({ pastReactions: e.target.value })} /></Field>
          <Field label="Orçamento mensal para skincare (R$)"><NumberInput value={S.budgetMonthlyBrl} min={0} onChange={(v) => setS({ budgetMonthlyBrl: v ?? undefined })} /></Field>
          <h3>Produtos mencionados antes — ainda usa?</h3>
          <p className="hint">Serão cadastrados como "pausados" com composição desconhecida. Nada é combinado até você registrar o rótulo.</p>
          <Chips multiple label="Produtos" value={stillUsing} onChange={setStillUsing} options={MENTIONED_PRODUCTS.map((n) => ({ value: n, label: n }))} />
        </Card>
      )}

      {step === 4 && (
        <Card>
          <div className="grid two">
            <Field label="Curvatura (a confirmar com fotos)"><input value={H.curlType ?? ''} onChange={(e) => setH({ curlType: e.target.value })} /></Field>
            <Field label="Comprimento"><input value={H.length ?? ''} onChange={(e) => setH({ length: e.target.value })} /></Field>
            <Field label="Couro cabeludo"><select value={H.scalp ?? ''} onChange={(e) => setH({ scalp: e.target.value as 'oily' })}><option value="">—</option><option value="oily">Oleoso</option><option value="normal">Normal</option><option value="dry">Seco</option></select></Field>
            <Field label="Lavagens por semana"><NumberInput value={H.washesPerWeek} min={1} max={7} onChange={(v) => setH({ washesPerWeek: v ?? undefined })} /></Field>
          </div>
          <h3>Características</h3>
          <Chips multiple label="Características do cabelo" value={H.concerns ?? []} onChange={(v) => setH({ concerns: v })} options={HAIR_CONCERNS.map((c) => ({ value: c, label: c }))} />
          <h3>Objetivos</h3>
          <Chips multiple label="Objetivos do cabelo" value={H.goals ?? []} onChange={(v) => setH({ goals: v, wantsFringe: v.includes('usar franja') })} options={HAIR_GOALS.map((c) => ({ value: c, label: c }))} />
          <Field label="Orçamento mensal para cabelo (R$)"><NumberInput value={H.budgetMonthlyBrl} min={0} onChange={(v) => setH({ budgetMonthlyBrl: v ?? undefined })} /></Field>
          <h3>Barba, bigode e sobrancelhas</h3>
          <Field label="Objetivo para barba e bigode"><input value={G.beardGoal ?? ''} onChange={(e) => setG({ beardGoal: e.target.value })} /></Field>
          <Field label="Objetivo para sobrancelhas"><input value={G.browsGoal ?? ''} onChange={(e) => setG({ browsGoal: e.target.value })} /></Field>
          <label className="check"><input type="checkbox" checked={!!G.acneInBeardArea} onChange={(e) => setG({ acneInBeardArea: e.target.checked })} /> Tenho acne na região da barba</label>
          <label className="check"><input type="checkbox" checked={!!G.ingrownHairs} onChange={(e) => setG({ ingrownHairs: e.target.checked })} /> Tenho pelos encravados</label>
        </Card>
      )}

      {step === 5 && (
        <Card title="Pronto para gerar seu plano">
          <ul className="list">
            <li>Treino: ciclo de 8 semanas, {(T.trainingDays ?? [1, 2, 3, 4, 5]).length} dias ({(T.trainingDays ?? [1, 2, 3, 4, 5]).map((d) => WEEKDAY_SHORT[d]).join(', ')}), até {T.sessionMinutes ?? 100} min.</li>
            <li>Nutrição: {profileReadyForTargets(p).length ? `faltam ${profileReadyForTargets(p).join(', ')} para calcular a meta (complete depois em Perfil).` : 'meta calórica e de macros calculada a partir de peso, altura, idade e atividade.'}</li>
            <li>Pele, cabelo e barba: rotinas editáveis em Cuidados.</li>
          </ul>
          <p className="hint">Tudo pode ser corrigido depois em Perfil.</p>
        </Card>
      )}

      <ErrorBox error={error} />
      <div className="row between">
        <button className="btn ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Voltar</button>
        {step < STEPS.length - 1 ? (
          <div className="row">
            {step > 0 && <button className="btn ghost" disabled={busy} onClick={() => void next(true)}>Pular</button>}
            <button className="btn primary" disabled={busy} onClick={() => void next()}>Salvar e continuar</button>
          </div>
        ) : (
          <button className="btn primary" disabled={busy} onClick={() => void finish()}>{busy ? 'Gerando…' : 'Gerar meu plano'}</button>
        )}
      </div>
    </div>
  );
}
