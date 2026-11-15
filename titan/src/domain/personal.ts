// Código Titan — o perfil que só vale para você.
// Tudo aqui é calculado a partir dos SEUS registros (medidas, séries, sono, comida, peso).
// O app não lê DNA: "genética", na prática, é como o seu corpo responde — e isso dá para medir.
// Regra: sem dado suficiente, o módulo diz o que falta em vez de inventar um resultado.
import { addDays } from './dates';
import { EXERCISE_BY_KEY } from './exercises';
import { bestE1RM, groupHistory } from './progression';
import { weeklyVolume } from './volume';
import { MUSCLE_LABEL, type CheckinRow, type FoodLogRow, type MetricRow, type Muscle, type SetLogRow } from './types';

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ------------------------------------------------------------------ 1. Proporções

export interface Proportion {
  id: 'vtaper' | 'chest' | 'arm_calf' | 'arm_sym';
  label: string;
  current: number;
  target: number;
  unit: string;
  /** 0–1: quanto do caminho até a referência já foi feito. */
  progress: number;
  text: string;
}

const latest = (metrics: MetricRow[], key: keyof MetricRow): number | null => {
  const m = [...metrics].sort((a, b) => (a.date < b.date ? 1 : -1)).find((x) => num(x[key]) !== null);
  return m ? num(m[key]) : null;
};

/**
 * Proporções do seu corpo contra referências clássicas de estética (não são regra científica:
 * servem para decidir onde colocar o esforço). Só calcula com as suas medidas.
 */
export function proportions(metrics: MetricRow[]): Proportion[] {
  const out: Proportion[] = [];
  const sh = latest(metrics, 'shoulders_cm'); const waist = latest(metrics, 'waist_cm'); const chest = latest(metrics, 'chest_cm');
  const armR = latest(metrics, 'arm_right_cm'); const armL = latest(metrics, 'arm_left_cm');
  const calfR = latest(metrics, 'calf_right_cm'); const calfL = latest(metrics, 'calf_left_cm');
  if (sh && waist) {
    const cur = sh / waist;
    const needSh = r1(waist * 1.618 - sh);
    out.push({
      id: 'vtaper', label: 'Ombro ÷ cintura (formato em V)', current: Math.round(cur * 100) / 100, target: 1.62, unit: '', progress: Math.min(1, cur / 1.618),
      text: cur >= 1.618 ? 'Você já está na proporção áurea. Agora é manter a cintura e seguir crescendo.'
        : `Faltam ${String(needSh).replace('.', ',')} cm de ombro com a cintura atual — ou cada 1 cm a menos de cintura vale ~1,6 cm de ombro. Por isso o seu plano junta deltoide lateral e costas com controle da cintura.`,
    });
  }
  if (chest && waist) {
    const cur = chest / waist;
    out.push({
      id: 'chest', label: 'Peito ÷ cintura', current: Math.round(cur * 100) / 100, target: 1.33, unit: '', progress: Math.min(1, cur / 1.333),
      text: cur >= 1.333 ? 'Peito já domina a cintura. Prioridade continua sendo a parte de cima (clavicular).' : `Para chegar a 1,33 com a cintura atual: peito de ${String(r1(waist * 1.333)).replace('.', ',')} cm.`,
    });
  }
  const arm = armR && armL ? Math.max(armR, armL) : armR ?? armL;
  const calf = calfR && calfL ? Math.max(calfR, calfL) : calfR ?? calfL;
  if (arm && calf) {
    const diff = r1(arm - calf);
    out.push({
      id: 'arm_calf', label: 'Braço × panturrilha (simetria clássica)', current: arm, target: calf, unit: 'cm', progress: Math.min(1, Math.min(arm, calf) / Math.max(arm, calf)),
      text: Math.abs(diff) <= 1 ? 'Braço e panturrilha estão equilibrados.' : diff < 0 ? `O braço está ${String(Math.abs(diff)).replace('.', ',')} cm abaixo da panturrilha: braço é a sua prioridade de membros.` : `A panturrilha está ${String(diff).replace('.', ',')} cm abaixo do braço: não pule panturrilha.`,
    });
  }
  if (armR && armL) {
    const diff = r1(Math.abs(armR - armL));
    out.push({
      id: 'arm_sym', label: 'Simetria dos braços (dir. × esq.)', current: armR, target: armL, unit: 'cm', progress: Math.min(armR, armL) / Math.max(armR, armL),
      text: diff < 0.5 ? 'Braços simétricos (diferença dentro do erro da fita).' : `Diferença de ${String(diff).replace('.', ',')} cm: comece os exercícios unilaterais pelo braço ${armR < armL ? 'direito' : 'esquerdo'} e repita no outro só o que ele fez.`,
    });
  }
  return out;
}

// ------------------------------------------------------------------ 2. Resposta de cada região

export type ResponseLevel = 'fast' | 'normal' | 'slow' | 'waiting';
export const RESPONSE_LABEL: Record<ResponseLevel, string> = { fast: 'Responde rápido', normal: 'Responde no ritmo esperado', slow: 'Responde devagar', waiting: 'Aguardando dados' };

interface RegionDef { id: string; label: string; keys: (keyof MetricRow)[]; muscles: Muscle[]; /** cm em 4 semanas considerados bons para a região */ good: number }
const REGIONS: RegionDef[] = [
  { id: 'arm', label: 'Braço', keys: ['arm_right_cm', 'arm_left_cm'], muscles: ['biceps', 'triceps', 'brachialis'], good: 0.5 },
  { id: 'shoulders', label: 'Ombros', keys: ['shoulders_cm'], muscles: ['side_delts', 'rear_delts', 'back'], good: 1 },
  { id: 'chest', label: 'Peito', keys: ['chest_cm'], muscles: ['chest'], good: 1 },
  { id: 'thigh', label: 'Coxa', keys: ['thigh_cm', 'thigh_left_cm'], muscles: ['quads', 'hamstrings'], good: 0.7 },
  { id: 'calf', label: 'Panturrilha', keys: ['calf_right_cm', 'calf_left_cm'], muscles: ['calves'], good: 0.4 },
  { id: 'forearm', label: 'Antebraço', keys: ['forearm_right_cm', 'forearm_left_cm'], muscles: ['forearms', 'brachialis'], good: 0.3 },
];
export const MIN_SPAN_DAYS = 28;

export interface RegionResponse {
  id: string; label: string; level: ResponseLevel;
  /** cm por 4 semanas (média do período medido). */
  per4w: number | null;
  spanDays: number | null;
  weeklySets: number | null;
  /** cm por 4 semanas a cada 10 séries semanais — a "eficiência" da região. */
  per10sets: number | null;
  text: string;
}

export function regionResponses(metrics: MetricRow[], logs: SetLogRow[], today: string): RegionResponse[] {
  const sorted = [...metrics].filter((m) => m.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  return REGIONS.map((reg): RegionResponse => {
    // média dos lados medidos em cada data
    const pts = sorted.map((m) => { const v = reg.keys.map((k) => num(m[k])).filter((x): x is number => x !== null); return v.length ? { date: m.date, v: avg(v) } : null; }).filter((x): x is { date: string; v: number } => !!x);
    if (pts.length < 2 || daysBetween(pts[0].date, pts[pts.length - 1].date) < MIN_SPAN_DAYS) {
      const have = pts.length >= 2 ? daysBetween(pts[0].date, pts[pts.length - 1].date) : 0;
      return { id: reg.id, label: reg.label, level: 'waiting', per4w: null, spanDays: have || null, weeklySets: null, per10sets: null,
        text: pts.length === 0 ? 'Ainda sem medida registrada.' : `Faltam ${Math.max(1, MIN_SPAN_DAYS - have)} dia(s) entre a primeira e a última medida para comparar (a fita erra ~0,5 cm).` };
    }
    const first = pts[0]; const last = pts[pts.length - 1];
    const span = daysBetween(first.date, last.date);
    const per4w = r1(((last.v - first.v) / span) * 28);
    const weeks = Math.max(1, span / 7);
    const vol = weeklyVolume(logs, first.date, last.date);
    const sets = r1(reg.muscles.reduce((a, m) => a + (vol[m] ?? 0), 0) / weeks);
    const per10 = sets >= 3 ? r1((per4w / sets) * 10) : null;
    const level: ResponseLevel = per4w >= reg.good ? 'fast' : per4w >= reg.good * 0.4 ? 'normal' : 'slow';
    const cm = String(per4w).replace('.', ',');
    const text = level === 'fast' ? `+${cm} cm a cada 4 semanas com ~${String(sets).replace('.', ',')} séries/semana. Mantenha o que está fazendo: não mexa em time que está ganhando.`
      : level === 'normal' ? `${per4w >= 0 ? '+' : ''}${cm} cm a cada 4 semanas com ~${String(sets).replace('.', ',')} séries/semana. Ritmo normal: siga progredindo carga.`
        : sets < 8 ? `${per4w >= 0 ? '+' : ''}${cm} cm a cada 4 semanas, mas com só ~${String(sets).replace('.', ',')} séries/semana registradas. Antes de culpar a genética: complete as séries do plano.`
          : `${per4w >= 0 ? '+' : ''}${cm} cm a cada 4 semanas mesmo com ~${String(sets).replace('.', ',')} séries/semana. Região lenta para você: o app prioriza trocar o exercício (revisão automática) e conferir sono e calorias antes de somar volume.`;
    return { id: reg.id, label: reg.label, level, per4w, spanDays: span, weeklySets: sets, per10sets: per10, text };
  });
}

// ------------------------------------------------------------------ 3. Exercícios que mais rendem em você

export interface ExerciseResponse { key: string; name: string; muscle: string; sessions: number; pctPerWeek: number; from: number; to: number }
export const MIN_EX_SESSIONS = 4;

/** Ganho de força (1RM estimado) por semana em cada exercício com 4+ sessões: média das 2 primeiras × 2 últimas. */
export function exerciseResponses(logs: SetLogRow[]): ExerciseResponse[] {
  const keys = Array.from(new Set(logs.filter((l) => l.kind === 'working').map((l) => l.exercise_key)));
  const out: ExerciseResponse[] = [];
  for (const key of keys) {
    const h = groupHistory(logs, key).filter((p) => bestE1RM(p) > 0).reverse(); // antigo → recente
    if (h.length < MIN_EX_SESSIONS) continue;
    const a = avg(h.slice(0, 2).map(bestE1RM)); const b = avg(h.slice(-2).map(bestE1RM));
    const weeks = Math.max(1, daysBetween(h[0].date.slice(0, 10), h[h.length - 1].date.slice(0, 10)) / 7);
    const ex = EXERCISE_BY_KEY[key];
    const sample = logs.find((l) => l.exercise_key === key)!;
    out.push({ key, name: ex?.name ?? sample.exercise_name, muscle: ex ? MUSCLE_LABEL[ex.primary] : sample.muscle, sessions: h.length, pctPerWeek: r1(((b - a) / a) * 100 / weeks), from: r1(a), to: r1(b) });
  }
  return out.sort((x, y) => y.pctPerWeek - x.pctPerWeek);
}

// ------------------------------------------------------------------ 4. Sono × desempenho (o seu)

export interface SleepEffect {
  ready: boolean;
  good: { n: number; delta: number } | null;
  bad: { n: number; delta: number } | null;
  /** Diferença em pontos percentuais (dormindo bem − dormindo pouco). */
  gap: number | null;
  text: string;
}
export const SLEEP_GOOD_H = 7.5;
export const MIN_SLEEP_SESSIONS = 3;

/**
 * Para cada sessão: variação média do 1RM estimado de cada exercício contra a sessão anterior do mesmo exercício.
 * Depois separa pelas horas dormidas na noite anterior (check-in do dia do treino).
 */
export function sleepEffect(logs: SetLogRow[], checkins: CheckinRow[]): SleepEffect {
  const bySession = new Map<string, { date: string; deltas: number[] }>();
  for (const key of new Set(logs.map((l) => l.exercise_key))) {
    const h = groupHistory(logs, key).reverse();
    for (let i = 1; i < h.length; i++) {
      const prev = bestE1RM(h[i - 1]); const cur = bestE1RM(h[i]);
      if (prev <= 0 || cur <= 0) continue;
      const s = bySession.get(h[i].sessionId) ?? { date: h[i].date.slice(0, 10), deltas: [] };
      s.deltas.push(((cur - prev) / prev) * 100);
      bySession.set(h[i].sessionId, s);
    }
  }
  const good: number[] = []; const bad: number[] = [];
  for (const s of bySession.values()) {
    const sleep = num(checkins.find((c) => c.date === s.date)?.sleep_hours);
    if (sleep === null) continue;
    (sleep >= SLEEP_GOOD_H ? good : bad).push(avg(s.deltas));
  }
  const g = good.length ? { n: good.length, delta: r1(avg(good)) } : null;
  const b = bad.length ? { n: bad.length, delta: r1(avg(bad)) } : null;
  if (!g || !b || g.n < MIN_SLEEP_SESSIONS || b.n < MIN_SLEEP_SESSIONS) {
    return { ready: false, good: g, bad: b, gap: null, text: `Preciso de pelo menos ${MIN_SLEEP_SESSIONS} treinos depois de noites boas (${String(SLEEP_GOOD_H).replace('.', ',')} h ou mais) e ${MIN_SLEEP_SESSIONS} depois de noites curtas, com o check-in de sono preenchido no dia do treino. Até agora: ${g?.n ?? 0} e ${b?.n ?? 0}.` };
  }
  const gap = r1(g.delta - b.delta);
  const f = (v: number) => `${v >= 0 ? '+' : ''}${String(v).replace('.', ',')}%`;
  return { ready: true, good: g, bad: b, gap,
    text: gap >= 1 ? `Depois de dormir ${String(SLEEP_GOOD_H).replace('.', ',')} h ou mais, sua força sobe ${f(g.delta)} por treino; depois de noite curta, ${f(b.delta)}. No seu corpo, sono vale ${String(gap).replace('.', ',')} ponto(s) de progresso por treino.`
      : gap <= -1 ? `Curioso: seus treinos depois de noites curtas foram melhores (${f(b.delta)} × ${f(g.delta)}). Com poucos dados isso costuma ser acaso — continue registrando.`
        : `Até aqui sua força progride parecido com noite boa (${f(g.delta)}) ou curta (${f(b.delta)}). Sono curto cobra mais na recuperação e na fome do que no treino do dia.` };
}

// ------------------------------------------------------------------ 5. Gasto calórico real

export interface RealTdee {
  ready: boolean;
  tdee: number | null;
  avgIntake: number | null;
  kgPerWeek: number | null;
  loggedDays: number;
  days: number;
  text: string;
}
export const TDEE_WINDOW = 28;
export const TDEE_MIN_LOG_DAYS = 14;
export const TDEE_MIN_WEIGHINS = 6;

/**
 * Gasto real = o que você comeu − a energia que virou peso (≈ 7.700 kcal por kg).
 * Usa os últimos 28 dias: precisa de 14+ dias de comida registrada (dias com menos de 1.000 kcal
 * são tratados como registro incompleto e ignorados) e 6+ pesagens espalhadas por 14+ dias.
 */
export function realTdee(food: FoodLogRow[], metrics: MetricRow[], today: string): RealTdee {
  const from = addDays(today, -TDEE_WINDOW + 1);
  const perDay = new Map<string, number>();
  for (const f of food) if (f.date >= from && f.date <= today) perDay.set(f.date, (perDay.get(f.date) ?? 0) + Number(f.kcal));
  const full = [...perDay.values()].filter((k) => k >= 1000);
  const w = metrics.filter((m) => m.date >= from && m.date <= today && num(m.weight_kg) !== null).map((m) => ({ x: daysBetween(from, m.date), y: Number(m.weight_kg) })).sort((a, b) => a.x - b.x);
  const span = w.length ? w[w.length - 1].x - w[0].x : 0;
  if (full.length < TDEE_MIN_LOG_DAYS || w.length < TDEE_MIN_WEIGHINS || span < 14) {
    return { ready: false, tdee: null, avgIntake: full.length ? Math.round(avg(full)) : null, kgPerWeek: null, loggedDays: full.length, days: TDEE_WINDOW,
      text: `Para medir o seu gasto de verdade preciso, nos últimos ${TDEE_WINDOW} dias, de ${TDEE_MIN_LOG_DAYS} dias com a comida registrada (você tem ${full.length}) e ${TDEE_MIN_WEIGHINS} pesagens ao longo de 2 semanas (você tem ${w.length}).` };
  }
  // tendência do peso por regressão linear (menos sensível a um dia fora da curva)
  const mx = avg(w.map((p) => p.x)); const my = avg(w.map((p) => p.y));
  const slope = w.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / w.reduce((a, p) => a + (p.x - mx) ** 2, 0); // kg/dia
  const intake = avg(full);
  const tdee = Math.round((intake - slope * 7700) / 10) * 10;
  const kgWeek = Math.round(slope * 7 * 100) / 100;
  return { ready: true, tdee, avgIntake: Math.round(intake), kgPerWeek: kgWeek, loggedDays: full.length, days: TDEE_WINDOW,
    text: `Você comeu em média ${Math.round(intake)} kcal e o peso ${kgWeek === 0 ? 'ficou estável' : `${kgWeek > 0 ? 'subiu' : 'desceu'} ${String(Math.abs(kgWeek)).replace('.', ',')} kg por semana`}. Logo, o seu corpo gasta cerca de ${tdee} kcal por dia.` };
}

// ------------------------------------------------------------------ Calibração e resumo

export interface Calibration { pct: number; parts: { label: string; done: boolean; hint: string }[] }

export function calibration(p: { proportions: Proportion[]; regions: RegionResponse[]; exercises: ExerciseResponse[]; sleep: SleepEffect; tdee: RealTdee }): Calibration {
  const measured = p.regions.filter((r) => r.level !== 'waiting').length;
  const parts = [
    { label: 'Proporções', done: p.proportions.length >= 3, hint: 'Registre ombros, cintura, peito, braços e panturrilhas em Evolução.' },
    { label: 'Resposta dos músculos', done: measured >= 3, hint: `Meça de novo depois de 4 semanas (${measured}/6 regiões comparáveis).` },
    { label: 'Exercícios que rendem', done: p.exercises.length >= 5, hint: `Registre 4+ sessões de cada exercício (${p.exercises.length} exercícios prontos).` },
    { label: 'Sono × treino', done: p.sleep.ready, hint: 'Preencha o check-in de sono nos dias de treino.' },
    { label: 'Gasto calórico real', done: p.tdee.ready, hint: `Registre a comida (${p.tdee.loggedDays}/${TDEE_MIN_LOG_DAYS} dias) e pese-se 3× por semana.` },
  ];
  return { pct: Math.round((parts.filter((x) => x.done).length / parts.length) * 100), parts };
}

/** Frase mais útil para hoje, tirada só dos seus dados (ou null se ainda não há nada a dizer). */
export function topInsight(p: { regions: RegionResponse[]; exercises: ExerciseResponse[]; sleep: SleepEffect; tdee: RealTdee; formulaTdee?: number | null; sleptLastNight?: number | null }): string | null {
  if (p.sleep.ready && p.sleep.gap !== null && p.sleep.gap >= 1 && p.sleptLastNight !== null && p.sleptLastNight !== undefined && p.sleptLastNight < SLEEP_GOOD_H) {
    return `Você dormiu ${String(p.sleptLastNight).replace('.', ',')} h. No seu histórico, noite curta custa ${String(p.sleep.gap).replace('.', ',')} ponto(s) de progresso: hoje mantenha as cargas e capriche na técnica.`;
  }
  if (p.tdee.ready && p.tdee.tdee && p.formulaTdee && Math.abs(p.tdee.tdee - p.formulaTdee) >= 150) {
    return `Seu gasto real (${p.tdee.tdee} kcal) é ${p.tdee.tdee > p.formulaTdee ? 'maior' : 'menor'} que o da fórmula (${p.formulaTdee} kcal). Vale atualizar as metas pelo seu número.`;
  }
  const slow = p.regions.find((r) => r.level === 'slow');
  if (slow) return `${slow.label}: ${slow.text}`;
  const fast = p.regions.find((r) => r.level === 'fast');
  if (fast) return `${fast.label} é a região que mais responde em você: ${fast.text}`;
  const best = p.exercises[0];
  if (best && best.pctPerWeek > 0) return `Seu exercício que mais rende: ${best.name} (+${String(best.pctPerWeek).replace('.', ',')}% de força por semana).`;
  return null;
}

export const CODE_TRUTH = [
  'O Titan não lê DNA e nenhum app consegue. O que chamamos de genética aparece na prática como resposta: quanto cada região cresce com o volume que você faz, quais exercícios sobem mais rápido, quanto o sono pesa e quanto o seu corpo gasta por dia.',
  'Tudo nesta tela sai só dos seus registros. Os números de outra pessoa dariam resultados diferentes — é isso que faz o plano ser seu.',
  'O que é fixo (formato do pico do bíceps, largura da clavícula, inserções) não muda com treino. O que muda é tamanho de músculo e gordura — e é aí que o app trabalha.',
  'Quanto mais você registra, mais preciso fica. Sem dado suficiente o app avisa o que falta em vez de chutar.',
];
