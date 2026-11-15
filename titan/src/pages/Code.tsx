import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { addDays, formatBR, todayISO } from '../domain/dates';
import { JKK_PHOTOS } from '../domain/jkk';
import {
  CODE_TRUTH, RESPONSE_LABEL, calibration, exerciseResponses, proportions, realTdee, regionResponses, sleepEffect, topInsight,
  type ResponseLevel,
} from '../domain/personal';
import type { CheckinRow, FoodLogRow, MetricRow, SetLogRow, TargetRow } from '../domain/types';
import { applyNutritionPhase } from '../services';
import { Card, Loading, Progress, useToast } from '../ui/components';
import { currentGoal } from './GoalSwitch';

const LEVEL_TAG: Record<ResponseLevel, string> = { fast: 'tag accent', normal: 'tag', slow: 'tag warn', waiting: 'tag' };
const br = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });

/** Carrega os registros e calcula o Código (compartilhado com a tela Hoje). */
export function usePersonalCode() {
  const today = todayISO();
  const metrics = useRows<MetricRow>('body_metrics', { order: { col: 'date' } });
  const logs = useRows<SetLogRow>('set_logs');
  const checkins = useRows<CheckinRow>('daily_checkins', { gte: { date: addDays(today, -120) } });
  const food = useRows<FoodLogRow>('food_logs', { gte: { date: addDays(today, -28) } });
  const targets = useRows<TargetRow>('nutrition_targets', { order: { col: 'effective_from', asc: false } });
  const loading = metrics.loading || logs.loading || checkins.loading || food.loading || targets.loading;
  const code = useMemo(() => {
    const props = proportions(metrics.data);
    const regions = regionResponses(metrics.data, logs.data, today);
    const exercises = exerciseResponses(logs.data);
    const sleep = sleepEffect(logs.data, checkins.data);
    const tdee = realTdee(food.data, metrics.data, today);
    const target = [...targets.data].sort((a, b) => (a.effective_from + (a.created_at ?? '') < b.effective_from + (b.created_at ?? '') ? 1 : -1))[0];
    const inputs = (target?.inputs ?? {}) as { tdee?: number; formulaTdee?: number; tdeeSource?: string };
    const formulaTdee = inputs.formulaTdee ?? (inputs.tdeeSource === 'real' ? null : inputs.tdee ?? null);
    const slept = checkins.data.find((c) => c.date === today)?.sleep_hours ?? null;
    return {
      props, regions, exercises, sleep, tdee, target, formulaTdee, usingReal: inputs.tdeeSource === 'real',
      cal: calibration({ proportions: props, regions, exercises, sleep, tdee }),
      insight: topInsight({ regions, exercises, sleep, tdee, formulaTdee: inputs.tdeeSource === 'real' ? null : formulaTdee, sleptLastNight: slept === null ? null : Number(slept) }),
    };
  }, [metrics.data, logs.data, checkins.data, food.data, targets.data, today]);
  return { loading, code };
}

export function Code() {
  const store = useStore();
  const { profile } = useProfile();
  const { loading, code } = usePersonalCode();
  const { toast, node } = useToast();
  if (loading || !profile) return <Loading />;
  const { props, regions, exercises, sleep, tdee, cal, formulaTdee, usingReal } = code;
  const goal = currentGoal(profile);
  const best = exercises.filter((e) => e.pctPerWeek > 0).slice(0, 3);
  const worst = [...exercises].reverse().filter((e) => e.pctPerWeek <= 0.1).slice(0, 3);
  const diff = tdee.ready && formulaTdee ? tdee.tdee! - formulaTdee : null;

  return (
    <div className="stack">
      {node}
      <div className="page-head">
        <div>
          <span className="kicker">Feito só para você</span>
          <h1>Meu Código</h1>
          <p className="muted" style={{ margin: 0 }}>O que o Titan aprendeu sobre o SEU corpo, a partir dos seus registros.</p>
        </div>
        <Link to="/evolucao" className="btn ghost sm">Medidas</Link>
      </div>

      <section className="hero" aria-label="Calibração do Código">
        <span className="pill accent">Código {cal.pct}% calibrado</span>
        <div style={{ margin: '10px 0' }}><Progress value={cal.pct} max={100} label="Calibração do Código" /></div>
        {code.insight && <p style={{ margin: '0 0 8px' }} data-testid="code-insight"><strong>Hoje:</strong> {code.insight}</p>}
        <ul className="list">
          {cal.parts.map((p) => <li key={p.label} className="row between"><span>{p.done ? '✅' : '⏳'} <strong>{p.label}</strong>{!p.done && <><br /><small className="muted">{p.hint}</small></>}</span></li>)}
        </ul>
      </section>

      <Card title="Suas proporções">
        {props.length === 0 ? <p className="hint">Registre suas medidas em <Link to="/evolucao">Evolução</Link> (ombros, cintura, peito, braços, panturrilhas) para ver as suas proporções.</p> : (
          <div className="stack">
            {props.map((p) => (
              <div key={p.id} data-testid={`prop-${p.id}`}>
                <div className="row between"><strong>{p.label}</strong><span>{br(p.current, 2)}{p.unit ? ` ${p.unit}` : ''} <small className="muted">/ {br(p.target, 2)}{p.unit ? ` ${p.unit}` : ''}</small></span></div>
                <Progress value={p.progress * 100} max={100} label={p.label} />
                <small className="muted">{p.text}</small>
              </div>
            ))}
          </div>
        )}
        <p className="hint">Referências clássicas de estética (proporção áurea, peito/cintura, simetria braço-panturrilha). Não são regra científica: servem para decidir onde colocar o esforço.</p>
      </Card>

      <Card title="Como cada região responde em você">
        <ul className="list">
          {regions.map((r) => (
            <li key={r.id} data-testid={`region-${r.id}`}>
              <div className="row between"><strong>{r.label}</strong><span className={LEVEL_TAG[r.level]}>{RESPONSE_LABEL[r.level]}</span></div>
              <small>{r.text}</small>
              {r.per10sets !== null && <><br /><small className="muted">Eficiência: {r.per10sets >= 0 ? '+' : ''}{br(r.per10sets)} cm por 4 semanas a cada 10 séries semanais · período de {r.spanDays} dias.</small></>}
            </li>
          ))}
        </ul>
        <p className="hint">Compara a primeira e a última medida (mínimo de 28 dias entre elas) com as séries que você realmente registrou. Meça sempre de manhã, em jejum, no mesmo ponto.</p>
      </Card>

      <Card title="Exercícios que mais rendem em você">
        {exercises.length === 0 ? <p className="hint">Aparece quando um exercício tiver 4 sessões registradas. Registre carga e repetições de todas as séries.</p> : (
          <>
            {best.length > 0 && <><p style={{ marginTop: 0 }}><strong>Seus melhores</strong> (força subindo mais rápido)</p>
              <ul className="list">{best.map((e) => <li key={e.key} className="row between"><span>{e.name}<br /><small className="muted">{e.muscle} · {e.sessions} sessões · 1RM estimado {br(e.from)} → {br(e.to)} kg</small></span><span className="tag accent">+{br(e.pctPerWeek)}%/sem</span></li>)}</ul></>}
            {worst.length > 0 && <><p><strong>Travados em você</strong></p>
              <ul className="list">{worst.map((e) => <li key={e.key} className="row between"><span>{e.name}<br /><small className="muted">{e.muscle} · {e.sessions} sessões · {br(e.from)} → {br(e.to)} kg</small></span><span className="tag warn">{e.pctPerWeek > 0 ? '+' : ''}{br(e.pctPerWeek)}%/sem</span></li>)}</ul>
              <p className="hint">Exercício travado por 4 sessões, com a região sem crescer, é trocado sozinho na revisão automática (quando você registra as medidas).</p></>}
          </>
        )}
      </Card>

      <Card title="Seu sono × seu treino">
        <p style={{ marginTop: 0 }}>{sleep.text}</p>
        {sleep.good && sleep.bad && <p className="hint">Noites boas: {sleep.good.n} treinos · noites curtas: {sleep.bad.n} treinos.</p>}
      </Card>

      <Card title="Seu gasto calórico real">
        <p style={{ marginTop: 0 }} data-testid="tdee-text">{tdee.text}</p>
        {tdee.ready && (
          <>
            {formulaTdee && <p>Fórmula (genérica): <strong>{formulaTdee} kcal</strong> · Seu corpo: <strong>{tdee.tdee} kcal</strong>{diff !== null && <> · diferença de {diff > 0 ? '+' : ''}{diff} kcal</>}</p>}
            {usingReal ? <div className="banner info">Suas metas já usam o gasto medido. Recalcule quando quiser, com os dados mais recentes.</div> : null}
            <button className="btn primary" onClick={async () => {
              if (!confirm(`Recalcular as metas de nutrição usando o seu gasto real (${tdee.tdee} kcal)?`)) return;
              await applyNutritionPhase(store, profile, goal === 'recomp' ? 'recomp' : 'lean_gain', tdee.tdee!);
              toast('Metas recalculadas com o seu gasto real.');
            }}>Usar o meu gasto real nas metas</button>
          </>
        )}
        <p className="hint">Conta: calorias que você comeu − energia que virou peso (≈ 7.700 kcal por kg), nos últimos {tdee.days} dias. Mais preciso que qualquer fórmula, porque é o seu corpo — mas depende de registrar tudo o que come.</p>
      </Card>

      <Card title="O que é fixo em você (avaliação das fotos)">
        <p className="hint" style={{ marginTop: 0 }}>{JKK_PHOTOS.note}</p>
        <ul className="list">{JKK_PHOTOS.items.map((i) => <li key={i.title}><small><strong>{i.title}:</strong> {i.text}</small></li>)}</ul>
      </Card>

      <Card title="Como ler esta tela">
        <ul>{CODE_TRUTH.map((t) => <li key={t}><small>{t}</small></li>)}</ul>
        {code.target && <p className="hint">Metas atuais desde {formatBR(code.target.effective_from)}.</p>}
      </Card>
    </div>
  );
}
