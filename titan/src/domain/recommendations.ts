import { addDays } from './dates';
import { scalpStatus } from './hair';
import { decliningExercises, estimated1RM, groupHistory, stalledExercises } from './progression';
import { missedCount, projectedEnd } from './schedule';
import { adjustCalories, weeklyAverages } from './trend';
import { EXERCISE_BY_KEY } from './exercises';
import { MIN_WATER_L, waistRisk } from './science';
import type {
  CareLogRow, CheckinRow, FoodLogRow, MetricRow, ProductRow, Profile, ProgramRow, SessionRow, SetLogRow, TargetRow,
} from './types';

export interface RecContext {
  today: string;
  profile: Profile | null;
  program: ProgramRow | null;
  sessions: SessionRow[];
  setLogs: SetLogRow[];
  checkins: CheckinRow[];
  metrics: MetricRow[];
  target: TargetRow | null;
  foodLogs: FoodLogRow[];
  products: ProductRow[];
  careLogs: CareLogRow[];
}

export interface Recommendation {
  id: string;
  module: 'muscle' | 'nutrition' | 'skin' | 'hair' | 'evolution';
  priority: 1 | 2 | 3; // 1 = mais importante
  title: string;
  reason: string;
  data: string[];
  monitor: string;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const f1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function recentRecovery(checkins: CheckinRow[], today: string) {
  const last7 = checkins.filter((c) => c.date > addDays(today, -7) && c.date <= today);
  return {
    recovery: avg(last7.map((c) => c.recovery).filter((x): x is number => x !== null)),
    sleep: avg(last7.map((c) => c.sleep_hours).filter((x): x is number => x !== null)),
    count: last7.length,
  };
}

/** Adesão alimentar: fração dos dias registrados (últimos 14) com calorias a ±15% da meta. null se <5 dias registrados. */
export function foodAdherence(foodLogs: FoodLogRow[], target: TargetRow | null, today: string): { value: number | null; loggedDays: number; avgKcal: number | null; avgProtein: number | null } {
  const from = addDays(today, -14);
  const byDay = new Map<string, { kcal: number; protein: number }>();
  foodLogs.filter((l) => l.date > from && l.date < today).forEach((l) => {
    const d = byDay.get(l.date) ?? { kcal: 0, protein: 0 };
    d.kcal += Number(l.kcal); d.protein += Number(l.protein_g);
    byDay.set(l.date, d);
  });
  const days = [...byDay.values()];
  const avgKcal = avg(days.map((d) => d.kcal));
  const avgProtein = avg(days.map((d) => d.protein));
  if (!target || days.length < 5) return { value: null, loggedDays: days.length, avgKcal, avgProtein };
  const ok = days.filter((d) => Math.abs(d.kcal - target.kcal) <= target.kcal * 0.15).length;
  return { value: ok / days.length, loggedDays: days.length, avgKcal, avgProtein };
}

export function buildRecommendations(ctx: RecContext): Recommendation[] {
  const out: Recommendation[] = [];
  const { today } = ctx;
  const rec = recentRecovery(ctx.checkins, today);

  // 1. Desempenho em queda + recuperação
  const recentLogs = ctx.setLogs.filter((l) => l.logged_at.slice(0, 10) >= addDays(today, -28));
  const declining = decliningExercises(recentLogs);
  if (declining.length >= 2) {
    const poor = (rec.recovery !== null && rec.recovery < 3) || (rec.sleep !== null && rec.sleep < 6.5);
    out.push({
      id: 'fatigue', module: 'muscle', priority: poor ? 1 : 2,
      title: poor ? 'Investigue fadiga antes de aumentar volume' : 'Desempenho em queda em vários exercícios',
      reason: poor
        ? 'O desempenho caiu em sessões consecutivas e a recuperação recente está baixa. Adicionar séries agora tende a piorar. Considere antecipar o deload (semana com metade das séries) e priorizar sono e alimentação.'
        : 'Queda consecutiva sem sinal claro de má recuperação nos registros. Revise sono, alimentação e técnica; se continuar na próxima semana, antecipe o deload.',
      data: [
        `Exercícios em queda (e1RM nas 3 últimas sessões): ${declining.map((k) => EXERCISE_BY_KEY[k]?.name ?? k).join(', ')}`,
        rec.recovery !== null ? `Recuperação média 7 dias: ${f1(rec.recovery)}/5` : 'Sem check-ins de recuperação nos últimos 7 dias',
        rec.sleep !== null ? `Sono médio: ${f1(rec.sleep)} h` : 'Sem registro de sono',
      ],
      monitor: 'e1RM desses exercícios nas próximas 2 sessões e a recuperação diária.',
    });
  }

  // 1b. Estagnação (sem fadiga): mudar alguma variável, não insistir igual
  const stalled = stalledExercises(ctx.setLogs.filter((l) => l.logged_at.slice(0, 10) >= addDays(today, -56))).filter((k) => !declining.includes(k));
  for (const k of stalled.slice(0, 3)) {
    const ex = EXERCISE_BY_KEY[k];
    const prio = !!ex && !!ctx.program?.config.priorities.includes(ex.primary);
    const good = rec.recovery === null || rec.recovery >= 3;
    out.push({
      id: `stall-${k}`, module: 'muscle', priority: 2,
      title: `${ex?.name ?? k} parou de progredir`,
      reason: prio && good
        ? 'O 1RM estimado não sobe há 4 sessões e a recuperação está boa. Como é músculo prioritário: some 1 série semanal nele OU troque por uma variação (Treino → Trocar) — mude só uma coisa por vez e reavalie em 2 semanas.'
        : 'O 1RM estimado não sobe há 4 sessões. Antes de somar séries, revise sono, alimentação e se o RIR registrado está honesto; se continuar, troque por uma variação (Treino → Trocar).',
      data: groupHistory(ctx.setLogs, k).slice(0, 4).reverse().map((p) => `${p.date.slice(0, 10)}: melhor série ${(() => { const b = p.sets.filter((x) => x.kind === 'working').sort((a, c) => estimated1RM(Number(c.load_kg), c.reps, c.rir) - estimated1RM(Number(a.load_kg), a.reps, a.rir))[0]; return b ? `${Number(b.load_kg)} kg × ${b.reps}` : '—'; })()}`),
      monitor: 'e1RM do exercício nas próximas 2 semanas.',
    });
  }

  // 2. Dor recorrente no mesmo exercício
  const keys = Array.from(new Set(recentLogs.map((l) => l.exercise_key)));
  for (const k of keys) {
    const h = groupHistory(recentLogs, k).slice(0, 2);
    if (h.length === 2 && h.every((p) => p.sets.some((s) => s.pain >= 4))) {
      out.push({
        id: `pain-${k}`, module: 'muscle', priority: 1,
        title: `Dor recorrente: substitua ${EXERCISE_BY_KEY[k]?.name ?? k}`,
        reason: 'Dor ≥4/10 em duas sessões seguidas. A carga não será aumentada e uma variação deve ser usada. Regra prática: o exercício deve ser indolor e não piorar a dor no dia seguinte; se piorar, reduza a carga ou a amplitude. Dor que persiste fora do treino merece avaliação de fisioterapeuta ou médico.',
        data: h.map((p) => `${p.date.slice(0, 10)}: dor máx ${Math.max(...p.sets.map((s) => s.pain))}/10`),
        monitor: 'Dor nas próximas sessões com o exercício substituto.',
      });
    }
  }

  // 3. Peso x meta
  const weights = ctx.metrics.filter((m) => m.weight_kg !== null).map((m) => ({ date: m.date, weight: Number(m.weight_kg) }));
  const weekly = weeklyAverages(weights);
  const adherence = foodAdherence(ctx.foodLogs, ctx.target, today);
  if (ctx.target) {
    const targetWeekly = Number((ctx.target.inputs as { weeklyGainKg?: number }).weeklyGainKg ?? 0.2);
    const adj = adjustCalories({ currentKcal: ctx.target.kcal, weekly, targetWeeklyGainKg: targetWeekly, adherence: adherence.value });
    if (adj.action !== 'maintain') {
      out.push({
        id: 'calories', module: 'nutrition', priority: adj.action === 'increase' || adj.action === 'decrease' ? 1 : 3,
        title: adj.action === 'increase' ? `Aumentar meta para ${adj.newKcal} kcal`
          : adj.action === 'decrease' ? `Reduzir meta para ${adj.newKcal} kcal`
            : adj.action === 'improve_adherence' ? 'Aproximar a alimentação real da meta' : 'Registre o peso para avaliar a meta calórica',
        reason: adj.reason,
        data: [
          weekly.length ? `Médias semanais: ${weekly.slice(-3).map((w) => `${f1(w.avg)} kg`).join(' → ')}` : 'Nenhuma semana com 3+ pesagens',
          adherence.value !== null ? `Adesão alimentar: ${Math.round(adherence.value * 100)}% (${adherence.loggedDays} dias registrados)` : `Dias com registro alimentar (14 d): ${adherence.loggedDays}`,
          `Meta atual: ${ctx.target.kcal} kcal`,
        ],
        monitor: 'Média de peso semanal das próximas 2 semanas.',
      });
    }
    if (adherence.avgProtein !== null && adherence.avgProtein < ctx.target.protein_g * 0.85 && adherence.loggedDays >= 3) {
      out.push({
        id: 'protein', module: 'nutrition', priority: 2,
        title: 'Proteína abaixo da meta',
        reason: 'A ingestão média registrada de proteína está mais de 15% abaixo da meta. Distribua uma fonte proteica em cada refeição.',
        data: [`Média registrada: ${Math.round(adherence.avgProtein)} g/dia`, `Meta: ${ctx.target.protein_g} g/dia`],
        monitor: 'Média de proteína nos próximos 7 dias.',
      });
    }
  }
  if (!weights.some((w) => w.date > addDays(today, -7))) {
    out.push({
      id: 'weigh', module: 'evolution', priority: 2,
      title: 'Registre seu peso (3–7× por semana)',
      reason: 'Sem pesagens recentes não dá para avaliar a tendência nem ajustar calorias com segurança. Pese-se ao acordar, após ir ao banheiro, antes de comer.',
      data: [weights.length ? `Última pesagem: ${weights.sort((a, b) => (a.date < b.date ? 1 : -1))[0].date}` : 'Nenhuma pesagem registrada'],
      monitor: 'Número de pesagens por semana.',
    });
  }

  // 4. Produtos suspensos/pausados — o motivo vem dos registros, nunca presumido
  ctx.products.filter((p) => p.status === 'suspended' || p.status === 'paused').forEach((p) => {
    const reactions = ctx.careLogs.filter((l) => l.product_id === p.id && l.reaction !== 'none');
    const module = p.area === 'skin' ? 'skin' : 'hair';
    if (reactions.length) {
      out.push({
        id: `product-${p.id}`, module, priority: p.status === 'suspended' ? 1 : 2,
        title: `${p.name} está ${p.status === 'suspended' ? 'suspenso' : 'pausado'}`,
        reason: 'Houve reação registrada. O produto saiu da rotina automática; a rotina continua com limpeza suave, hidratação e fotoproteção.',
        data: reactions.slice(-3).map((l) => `${l.date}: reação ${l.reaction}`),
        monitor: 'Sinais de irritação nos próximos 7 dias sem o produto.',
      });
    } else if (p.actives.includes('unknown')) {
      out.push({
        id: `label-${p.id}`, module, priority: 3,
        title: `Confirme o rótulo de ${p.name}`,
        reason: 'A composição não foi informada, então o produto não entra em combinações com outros ativos. Cadastre os ingredientes (Cuidados → Produtos → Editar).',
        data: ['Ingredientes: não informados'],
        monitor: 'Conflitos de ativos assim que o rótulo for cadastrado.',
      });
    }
  });

  // 5. Couro cabeludo
  const scalp = scalpStatus(ctx.careLogs, today);
  if (scalp.persistentItch) {
    out.push({
      id: 'scalp', module: 'hair', priority: 1,
      title: 'Priorize a saúde do couro cabeludo',
      reason: scalp.message,
      data: [`Coceira média (14 d): ${scalp.avgItch}/10 em ${scalp.entries} registros`],
      monitor: 'Coceira registrada após cada lavagem.',
    });
  }

  // 6. Sessões perdidas
  if (ctx.program) {
    const missed = missedCount(ctx.program, ctx.sessions, today);
    if (missed > 0) {
      const end = projectedEnd(ctx.program, ctx.sessions, today);
      out.push({
        id: 'missed', module: 'muscle', priority: 2,
        title: `${missed} sessão(ões) não realizada(s)`,
        reason: 'O ciclo continua da próxima sessão pendente, sem acumular treinos no mesmo dia. A data de término foi recalculada.',
        data: [`Fim previsto do ciclo: ${end ?? '—'}`],
        monitor: 'Sessões concluídas por semana.',
      });
    }
    if (!ctx.profile?.training.equipmentConfirmed) {
      out.push({
        id: 'equipment', module: 'muscle', priority: 3,
        title: 'Confirme os equipamentos da sua academia',
        reason: 'O plano assume equipamentos comuns. Confirmando a lista, os exercícios indisponíveis são substituídos automaticamente.',
        data: [], monitor: 'Substituições necessárias durante os treinos.',
      });
    }
  }

  // 6b. Prontidão (TQR) baixa em sessões seguidas
  const lastTwo = [...ctx.sessions].filter((x) => x.readiness).sort((a, b) => (a.started_at ?? '') < (b.started_at ?? '') ? 1 : -1).slice(0, 2);
  if (lastTwo.length === 2 && lastTwo.every((x) => x.readiness!.tqr < 13)) {
    out.push({
      id: 'tqr', module: 'muscle', priority: 1,
      title: 'Recuperação baixa antes de dois treinos seguidos',
      reason: 'A escala TQR ficou abaixo de 13 nas duas últimas sessões. O volume já foi reduzido nesses dias; se continuar, antecipe o deload e revise sono, alimentação e estresse.',
      data: lastTwo.map((x) => `${(x.started_at ?? '').slice(0, 10)}: TQR ${x.readiness!.tqr}`),
      monitor: 'TQR antes das próximas sessões.',
    });
  }

  // 6c. Hidratação
  const water = ctx.checkins.filter((c) => c.date > addDays(today, -7) && c.water_l !== null && c.water_l !== undefined).map((c) => Number(c.water_l));
  if (water.length >= 3 && (avg(water) ?? 0) < MIN_WATER_L) {
    out.push({
      id: 'water', module: 'evolution', priority: 3,
      title: 'Água abaixo de 2 L por dia',
      reason: 'Hidratação baixa prejudica o desempenho e a pele. Deixe uma garrafa à vista e beba nas refeições e no treino. Urina escura indica que falta água.',
      data: [`Média: ${f1(avg(water)!)} L em ${water.length} dias registrados`], monitor: 'Água registrada no check-in.',
    });
  }

  // 6d. Cintura (OMS)
  const waists = ctx.metrics.filter((m) => m.waist_cm !== null).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (waists.length && ctx.profile?.sex) {
    const w = Number(waists[0].waist_cm);
    const risk = waistRisk(w, ctx.profile.sex);
    if (risk !== 'normal') {
      out.push({
        id: 'waist', module: 'evolution', priority: risk === 'high' ? 1 : 2,
        title: risk === 'high' ? 'Cintura em faixa de risco muito aumentado' : 'Cintura em faixa de risco aumentado',
        reason: 'A circunferência da cintura passou do limite da OMS. Durante o ganho de massa, se a cintura sobe rápido, o superávit está alto: o Titan prioriza o ajuste pela tendência de peso, e vale conversar com um médico ou nutricionista.',
        data: [`Última medida: ${f1(w)} cm em ${waists[0].date}`, ctx.profile.sex === 'male' ? 'Referência (homens): >94 cm aumentado, >102 cm muito aumentado' : 'Referência (mulheres): >80 cm aumentado, >88 cm muito aumentado'],
        monitor: 'Cintura a cada 2 semanas, junto com o peso.',
      });
    }
  }

  // 7. Sono
  if (rec.sleep !== null && rec.sleep < 7 && rec.count >= 3) {
    out.push({
      id: 'sleep', module: 'evolution', priority: 2,
      title: 'Sono abaixo de 7 h',
      reason: 'Sono curto prejudica recuperação e desempenho. Tente horário fixo para dormir e evitar telas na última hora.',
      data: [`Média: ${f1(rec.sleep)} h em ${rec.count} dias`], monitor: 'Média de sono semanal.',
    });
  }

  // 8. Protetor solar
  const amLogs = ctx.careLogs.filter((l) => l.area === 'skin' && l.slot === 'am' && l.completed && l.date > addDays(today, -7));
  if (ctx.careLogs.some((l) => l.area === 'skin') && amLogs.length < 4) {
    out.push({
      id: 'sunscreen', module: 'skin', priority: 2,
      title: 'Rotina da manhã (com protetor) pouco frequente',
      reason: 'Fotoproteção diária é a base para manchas e textura; sem ela, ativos noturnos rendem menos e podem sensibilizar.',
      data: [`Manhãs concluídas nos últimos 7 dias: ${amLogs.length}`], monitor: 'Manhãs concluídas por semana.',
    });
  }

  return out.sort((a, b) => a.priority - b.priority);
}

export interface Blocker { label: string; value: string; detail: string }

/** Qual hábito mais está prejudicando a consistência (somente com dados registrados). */
export function consistencyBlocker(ctx: RecContext): Blocker | null {
  const cands: { score: number; b: Blocker }[] = [];
  const from = addDays(ctx.today, -14);
  if (ctx.program) {
    let expected = 0;
    for (let d = from > ctx.program.start_date ? from : ctx.program.start_date; d < ctx.today; d = addDays(d, 1)) {
      if (ctx.program.config.trainingDays.includes(new Date(d + 'T12:00:00').getDay())) expected++;
    }
    const done = ctx.sessions.filter((s) => s.status === 'done' && (s.completed_at ?? '').slice(0, 10) >= from).length;
    if (expected > 0) cands.push({ score: Math.min(1, done / expected), b: { label: 'Treinos', value: `${done}/${expected}`, detail: 'sessões concluídas nos últimos 14 dias' } });
  }
  const logged = new Set(ctx.foodLogs.filter((l) => l.date >= from && l.date < ctx.today).map((l) => l.date)).size;
  if (ctx.target) cands.push({ score: logged / 14, b: { label: 'Registro alimentar', value: `${logged}/14`, detail: 'dias com alimentação registrada' } });
  const rec = recentRecovery(ctx.checkins, ctx.today);
  if (rec.sleep !== null) cands.push({ score: Math.min(1, rec.sleep / 7.5), b: { label: 'Sono', value: `${f1(rec.sleep)} h`, detail: 'média dos últimos 7 dias (meta 7–9 h)' } });
  const skinDays = new Set(ctx.careLogs.filter((l) => l.area === 'skin' && l.completed && l.date >= from).map((l) => l.date)).size;
  if (ctx.careLogs.some((l) => l.area === 'skin')) cands.push({ score: skinDays / 14, b: { label: 'Skincare', value: `${skinDays}/14`, detail: 'dias com rotina registrada' } });
  if (!cands.length) return null;
  const worst = cands.sort((a, b) => a.score - b.score)[0];
  return worst.score >= 0.85 ? null : worst.b;
}

export interface PhotoConditions { lighting: string | null; distance: string | null; pose: string | null; time_of_day: string | null; pump: boolean; taken_at: string }

/** Diferenças de condição que tornam a comparação de fotos pouco confiável. */
export function photoComparability(a: PhotoConditions, b: PhotoConditions): string[] {
  const issues: string[] = [];
  const cmp = (x: string | null, y: string | null, label: string) => {
    if (!x || !y) issues.push(`${label} não registrada em uma das fotos`);
    else if (x !== y) issues.push(`${label} diferente (${x} × ${y})`);
  };
  cmp(a.lighting, b.lighting, 'Iluminação');
  cmp(a.distance, b.distance, 'Distância');
  cmp(a.pose, b.pose, 'Pose');
  cmp(a.time_of_day, b.time_of_day, 'Horário');
  if (a.pump !== b.pump) issues.push('Uma foto foi tirada com pump (pós-treino) e a outra não');
  return issues;
}
