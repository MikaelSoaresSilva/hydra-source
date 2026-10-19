// Motor do jogo: funções puras que alteram um rascunho (draft) do estado e emitem eventos
// para a interface (cinemáticas, toasts). Todo ganho de XP passa por grantXp(), que usa o id
// do registro como chave de idempotência: a mesma conclusão nunca concede XP duas vezes.

import type {
  AttrKey, AttrWeights, Boss, Campaign, Difficulty, Evidence, FinanceEntry, GameState, KnowledgeNode,
  LedgerEntry, Mission, MissionType, Recurrence, SelfCareLog, StudySession, Workout,
} from './types';
import { ATTR_KEYS } from './types';
import {
  DEFAULT_RANK_RULES, RANKS, attrLevel, computeRank, distributeAttrXp, levelFromXp, missionXp, rankContext, stepXp, totals,
} from './progression';
import { addDays, dayKey, diffDays, monthKey, uid, weekKey } from './util';
import { ITEM_MAP, LEVEL_REWARDS, SETS, STARTER_ITEMS } from '../data/items';
import { ACHIEVEMENTS, type AchCtx } from '../data/achievements';
import { SKILL_MAP } from '../data/skills';
import { CHAPTERS, type StoryCtx } from '../data/story';
import { KNOWLEDGE_SEEDS, masteryLevel } from '../data/knowledge';
import { SURPRISE_POOL, pickTemplate, type CampaignTemplate, type MissionSeed } from '../data/campaigns';

export const SAVE_VERSION = 1;

export type GameEvent =
  | { kind: 'xp'; amount: number; label: string; attrs: AttrWeights }
  | { kind: 'levelup'; level: number; from: number; itemIds: string[] }
  | { kind: 'item'; itemId: string; reason: string }
  | { kind: 'achievement'; id: string }
  | { kind: 'rank'; rank: string }
  | { kind: 'boss_phase'; bossId: string; phase: string }
  | { kind: 'boss_defeated'; bossId: string }
  | { kind: 'chapter'; id: string }
  | { kind: 'campaign_done'; id: string }
  | { kind: 'streak'; days: number; shieldUsed?: boolean }
  | { kind: 'pr'; exercise: string; kg: number }
  | { kind: 'info'; text: string }
  | { kind: 'error'; text: string };

export type Ev = GameEvent[];

// ───────────────────────── Estado inicial ─────────────────────────
export function newGame(now = new Date()): GameState {
  const iso = now.toISOString();
  return {
    version: SAVE_VERSION,
    createdAt: iso,
    updatedAt: iso,
    onboarded: false,
    character: {
      name: '',
      classId: 'guerreiro',
      appearance: { skin: '#c68e6a', hair: '#1a1410', hairStyle: 'espetado', eyes: '#3b2a1e', brows: 0.5, beard: 'nenhuma', mustache: false, height: 1, build: 1, muscle: 0.4, headSize: 1 },
      equipped: { arma: 'adaga_iniciado', armadura: 'jaqueta_desperto', botas: 'botas_trilha' },
      outfits: [],
    },
    goals: [],
    missions: [],
    ledger: [],
    inventory: STARTER_ITEMS.map((itemId) => ({ itemId, at: iso })),
    achievements: {},
    skills: {},
    campaigns: [],
    bosses: [],
    workouts: [],
    body: [],
    knowledge: KNOWLEDGE_SEEDS.map((k) => ({ ...k, evidence: [] })),
    study: [],
    finance: { goals: [], entries: [] },
    selfcare: [],
    streak: { current: 0, best: 0, shields: 0 },
    seasons: [],
    storySeen: [],
    rankSeen: 'E',
    levelSeen: 1,
    chat: [],
    arena: [],
    deleted: [],
    settings: {
      graphics: 'medio', reducedMotion: false, sound: true, music: true, volume: 0.6, gmStyle: 'sistema',
      notifications: { enabled: false, studyTime: '19:00', digestTime: '08:30', quietStart: '22:30', quietEnd: '07:30', categories: { missoes: true, estudo: true, conquistas: true, campanhas: true } },
      surprise: true,
      dailyCapacity: 5,
      ai: { enabled: false, apiKey: '', model: 'claude-opus-5-5', dailyLimit: 20, usedToday: 0, usedDay: '' },
      cloud: { url: '', anonKey: '', email: '', auto: true },
      rankRules: DEFAULT_RANK_RULES.map((r) => ({ ...r })),
    },
  };
}

// ───────────────────────── Derivados ─────────────────────────
export function playerLevel(s: GameState): number {
  return levelFromXp(totals(s.ledger).xp).level;
}

export function owns(s: GameState, itemId: string): boolean {
  return s.inventory.some((i) => i.itemId === itemId);
}

export function periodKey(rec: Recurrence, now: Date): string {
  if (rec === 'diaria') return dayKey(now);
  if (rec === 'semanal') return weekKey(now);
  if (rec === 'mensal') return monthKey(now);
  return 'unica';
}

export function isDoneThisPeriod(m: Mission, now = new Date()): boolean {
  if (m.recurrence === 'unica') return m.status === 'concluida';
  return m.completedPeriods.includes(periodKey(m.recurrence, now));
}

export function missionDoneEver(m: Mission): boolean {
  return m.recurrence === 'unica' ? m.status === 'concluida' : m.completedPeriods.length > 0;
}

export function skillPoints(s: GameState): { total: number; spent: number; free: number } {
  const lvl = playerLevel(s);
  const mastery = s.missions.filter((m) => m.type === 'dominio' && missionDoneEver(m)).length;
  const total = lvl - 1 + mastery + 1; // 1 ponto inicial
  let spent = 0;
  for (const [id, rank] of Object.entries(s.skills)) spent += (SKILL_MAP[id]?.cost ?? 1) * rank;
  return { total, spent, free: total - spent };
}

export function setsCompleted(s: GameState): string[] {
  return Object.keys(SETS).filter((setId) => {
    const pieces = Object.values(ITEM_MAP).filter((i) => i.set === setId);
    return pieces.length > 0 && pieces.every((p) => owns(s, p.id));
  });
}

export function bossProgress(b: Boss, missions: Mission[]) {
  const phases = b.phases.map((p) => {
    const ms = p.missionIds.map((id) => missions.find((m) => m.id === id)).filter(Boolean) as Mission[];
    const active = ms.filter((m) => m.status !== 'cancelada');
    const done = active.filter(missionDoneEver).length;
    return { ...p, total: active.length, done, cleared: active.length > 0 && done === active.length };
  });
  const total = phases.reduce((s, p) => s + p.total, 0);
  const done = phases.reduce((s, p) => s + p.done, 0);
  const hp = total ? 1 - done / total : 1;
  const current = phases.findIndex((p) => !p.cleared);
  return { phases, total, done, hp, current, defeated: phases.length > 0 && phases.every((p) => p.cleared) };
}

export function storyCtx(s: GameState): StoryCtx {
  const rc = rankContext(s);
  const { rank } = computeRank(s.settings.rankRules, rc);
  return {
    level: rc.level,
    missionsDone: s.ledger.filter((e) => e.source === 'missao').length,
    bosses: rc.bosses,
    bestStreak: s.streak.best,
    mastered: s.knowledge.filter((k) => masteryLevel(k) >= 4).length,
    campaignsDone: s.campaigns.filter((c) => c.status === 'concluida').length,
    rankIndex: RANKS.indexOf(rank as (typeof RANKS)[number]),
  };
}

export function unlockedChapters(s: GameState): string[] {
  const c = storyCtx(s);
  return CHAPTERS.filter((ch) => ch.unlock(c)).map((ch) => ch.id);
}

/** Recordes pessoais: maior carga por exercício. */
export function personalRecords(workouts: Workout[]): Record<string, { kg: number; date: string; reps: number }> {
  const pr: Record<string, { kg: number; date: string; reps: number }> = {};
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const ex of w.exercises) {
      const key = ex.name.trim().toLowerCase();
      for (const set of ex.sets) {
        if (!pr[key] || set.kg > pr[key].kg) pr[key] = { kg: set.kg, date: w.date, reps: set.reps };
      }
    }
  }
  return pr;
}

export function countPRs(workouts: Workout[]): number {
  let count = 0;
  const best: Record<string, number> = {};
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const ex of w.exercises) {
      const key = ex.name.trim().toLowerCase();
      const max = Math.max(0, ...ex.sets.map((x) => x.kg));
      if (key in best && max > best[key]) count++;
      best[key] = Math.max(best[key] ?? 0, max);
    }
  }
  return count;
}

export function financeSaved(s: GameState, goalId?: string): number {
  return s.finance.entries.filter((e) => e.kind === 'economia' && (!goalId || e.goalId === goalId)).reduce((t, e) => t + e.amount, 0);
}

export function achCtx(s: GameState): AchCtx {
  const t = totals(s.ledger);
  const rc = rankContext(s);
  const { rank } = computeRank(s.settings.rankRules, rc);
  const missionEntries = s.ledger.filter((e) => e.source === 'missao');
  const hours = missionEntries.map((e) => new Date(e.at).getHours());
  const days = [...new Set(s.ledger.map((e) => e.day))].sort();
  let comeback = false;
  for (let i = 1; i < days.length; i++) if (diffDays(days[i - 1], days[i]) >= 4) comeback = true;
  return {
    missionsDone: missionEntries.length,
    mainDone: s.missions.reduce((n, m) => n + (m.type === 'principal' ? (m.recurrence === 'unica' ? (m.status === 'concluida' ? 1 : 0) : m.completedPeriods.length) : 0), 0),
    level: rc.level,
    bestStreak: s.streak.best,
    bosses: rc.bosses,
    workouts: s.workouts.length,
    prs: countPRs(s.workouts),
    studyMinutes: s.study.reduce((n, x) => n + x.minutes, 0),
    mastered: s.knowledge.filter((k) => masteryLevel(k) >= 4).length,
    saved: financeSaved(s),
    financeGoalsDone: s.finance.goals.filter((g) => financeSaved(s, g.id) >= g.target).length,
    selfcareDays: new Set(s.selfcare.map((x) => x.date)).size,
    campaignsDone: s.campaigns.filter((c) => c.status === 'concluida').length,
    arenaWins: s.arena.reduce((n, a) => n + a.wins, 0),
    arenaClears: s.arena.filter((a) => a.wins > 0).length,
    items: new Set(s.inventory.map((i) => i.itemId)).size,
    setsDone: setsCompleted(s).length,
    skillsLearned: Object.values(s.skills).filter((r) => r > 0).length,
    rankIndex: RANKS.indexOf(rank as (typeof RANKS)[number]),
    nightOwl: hours.some((h) => h >= 0 && h < 4),
    earlyBird: hours.some((h) => h >= 4 && h < 6),
    comeback,
    seasonsDone: s.seasons.filter((x) => x.endedAt && x.claimedTiers.includes(3)).length,
    epicDone: s.missions.filter((m) => (m.type === 'epica' || m.type === 'lendaria') && missionDoneEver(m)).length,
    attrsAt5: ATTR_KEYS.filter((k) => attrLevel(t.attrs[k]).level >= 5).length,
  };
}

// ───────────────────────── Núcleo: concessão de XP ─────────────────────────
export interface Grant {
  id: string;
  xp: number;
  weights: AttrWeights;
  source: LedgerEntry['source'];
  label: string;
  now: Date;
}

/** Concede XP de forma idempotente. Retorna false se esse id já foi concedido. */
export function grantXp(s: GameState, ev: Ev, g: Grant): boolean {
  if (s.ledger.some((e) => e.id === g.id)) return false;
  const xp = Math.max(0, Math.round(g.xp));
  const attrs = distributeAttrXp(xp, g.weights);
  // Bônus de itens equipados (pequenos e específicos de um atributo)
  for (const itemId of Object.values(s.character.equipped)) {
    const b = itemId ? ITEM_MAP[itemId]?.effect?.attrBonus : undefined;
    if (b && attrs[b.attr]) attrs[b.attr] = Math.round(attrs[b.attr]! * (1 + b.pct / 100));
  }
  const before = playerLevel(s);
  s.ledger.push({ id: g.id, at: g.now.toISOString(), day: dayKey(g.now), xp, attrs, source: g.source, label: g.label });
  if (xp > 0) ev.push({ kind: 'xp', amount: xp, label: g.label, attrs });
  afterProgress(s, ev, before, g.now);
  return true;
}

function giveItem(s: GameState, ev: Ev, itemId: string, reason: string, now: Date) {
  if (!ITEM_MAP[itemId] || owns(s, itemId)) return;
  s.inventory.push({ itemId, at: now.toISOString() });
  ev.push({ kind: 'item', itemId, reason });
}

/** Garante recompensas de nível já merecidas (idempotente; útil após sincronização). */
export function reconcileRewards(s: GameState, now = new Date()) {
  const lvl = playerLevel(s);
  for (const [l, itemId] of Object.entries(LEVEL_REWARDS)) {
    if (Number(l) <= lvl && !owns(s, itemId)) s.inventory.push({ itemId, at: now.toISOString() });
  }
}

function afterProgress(s: GameState, ev: Ev, before: number, now: Date) {
  const after = playerLevel(s);
  if (after > before) {
    const itemIds: string[] = [];
    for (let l = before + 1; l <= after; l++) {
      const it = LEVEL_REWARDS[l];
      if (it && !owns(s, it)) {
        s.inventory.push({ itemId: it, at: now.toISOString() });
        itemIds.push(it);
      }
    }
    ev.push({ kind: 'levelup', level: after, from: before, itemIds });
  }
  checkAchievements(s, ev, now);
  const { rank } = computeRank(s.settings.rankRules, rankContext(s));
  if (RANKS.indexOf(rank as never) > RANKS.indexOf(s.rankSeen as never)) {
    s.rankSeen = rank;
    ev.push({ kind: 'rank', rank });
  }
  const chapters = unlockedChapters(s);
  for (const id of chapters) if (!s.storySeen.includes(id) && !ev.some((e) => e.kind === 'chapter' && e.id === id)) ev.push({ kind: 'chapter', id });
}

export function checkAchievements(s: GameState, ev: Ev, now: Date) {
  // Loop: o XP de uma conquista pode liberar outra (ex.: nível 10).
  for (let guard = 0; guard < 5; guard++) {
    const ctx = achCtx(s);
    const fresh = ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && a.check(ctx));
    if (!fresh.length) return;
    for (const a of fresh) {
      s.achievements[a.id] = now.toISOString();
      ev.push({ kind: 'achievement', id: a.id });
      if (a.itemId) giveItem(s, ev, a.itemId, `Conquista: ${a.name}`, now);
      const before = playerLevel(s);
      const id = `ach:${a.id}`;
      if (!s.ledger.some((e) => e.id === id)) {
        s.ledger.push({ id, at: now.toISOString(), day: dayKey(now), xp: a.xp, attrs: {}, source: 'conquista', label: a.name });
        ev.push({ kind: 'xp', amount: a.xp, label: `Conquista: ${a.name}`, attrs: {} });
      }
      const after = playerLevel(s);
      if (after > before) {
        const itemIds: string[] = [];
        for (let l = before + 1; l <= after; l++) {
          const it = LEVEL_REWARDS[l];
          if (it && !owns(s, it)) { s.inventory.push({ itemId: it, at: now.toISOString() }); itemIds.push(it); }
        }
        ev.push({ kind: 'levelup', level: after, from: before, itemIds });
      }
    }
  }
}

// ───────────────────────── Sequência (sem punição permanente) ─────────────────────────
export function registerActivity(s: GameState, ev: Ev, now: Date) {
  const today = dayKey(now);
  const st = s.streak;
  if (st.lastActiveDay === today) return;
  if (!st.lastActiveDay) {
    st.current = 1;
  } else {
    const gap = diffDays(st.lastActiveDay, today);
    if (gap <= 0) return; // relógio voltou: ignora
    if (gap === 1) st.current += 1;
    else if (gap === 2 && st.shields > 0) {
      st.shields -= 1;
      st.current += 1;
      ev.push({ kind: 'streak', days: st.current, shieldUsed: true });
    } else {
      // Sequência reinicia, mas NADA conquistado é perdido (melhor sequência, itens, níveis).
      st.brokenAt = today;
      st.current = 1;
      ev.push({ kind: 'info', text: 'O fogo diminuiu, mas não apagou. Sua melhor sequência e tudo que conquistou continuam seus.' });
    }
  }
  st.lastActiveDay = today;
  if (st.current > 0 && st.current % 7 === 0 && st.shields < 2) {
    st.shields += 1;
    ev.push({ kind: 'info', text: 'Escudo de Consistência obtido: ele protege sua sequência se você perder um dia.' });
  }
  st.best = Math.max(st.best, st.current);
  if ([3, 7, 14, 30, 60, 90, 120, 180, 365].includes(st.current)) ev.push({ kind: 'streak', days: st.current });
}

/** Sequência efetiva hoje (considera escudos), sem alterar nada. */
export function effectiveStreak(s: GameState, now = new Date()): number {
  const st = s.streak;
  if (!st.lastActiveDay) return 0;
  const gap = diffDays(st.lastActiveDay, dayKey(now));
  if (gap <= 1) return st.current;
  if (gap === 2 && st.shields > 0) return st.current;
  return 0;
}

// ───────────────────────── Missões ─────────────────────────
export interface MissionInput {
  title: string;
  description?: string;
  type: MissionType;
  difficulty: Difficulty;
  recurrence: Recurrence;
  attrs: AttrWeights;
  deadline?: string;
  steps?: string[];
  campaignId?: string;
  bossId?: string;
  phaseId?: string;
  optional?: boolean;
}

export function validateMissionInput(m: MissionInput): string | null {
  if (!m.title || m.title.trim().length < 2) return 'Dê um nome à missão (mínimo 2 letras).';
  if (m.title.length > 90) return 'Nome muito longo (máximo 90 caracteres).';
  if (![1, 2, 3, 4, 5].includes(m.difficulty)) return 'Dificuldade inválida.';
  const weights = Object.values(m.attrs).filter((v) => (v ?? 0) > 0);
  if (!weights.length) return 'Escolha pelo menos um atributo que essa missão desenvolve.';
  if (weights.length > 3) return 'Uma missão pode desenvolver no máximo 3 atributos.';
  if (m.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(m.deadline)) return 'Prazo inválido.';
  if ((m.steps?.length ?? 0) > 12) return 'Máximo de 12 etapas por missão.';
  return null;
}

export function createMission(s: GameState, ev: Ev, input: MissionInput, now = new Date()): Mission | null {
  const err = validateMissionInput(input);
  if (err) { ev.push({ kind: 'error', text: err }); return null; }
  const iso = now.toISOString();
  const m: Mission = {
    id: uid('m'),
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    type: input.type,
    difficulty: input.difficulty,
    recurrence: input.recurrence,
    attrs: input.attrs,
    deadline: input.deadline,
    steps: (input.steps ?? []).filter((t) => t.trim()).map((t) => ({ id: uid('st'), title: t.trim(), done: false })),
    status: 'ativa',
    createdAt: iso,
    updatedAt: iso,
    completedPeriods: [],
    campaignId: input.campaignId,
    bossId: input.bossId,
    phaseId: input.phaseId,
    optional: input.optional,
    history: [{ at: iso, event: 'Criada' }],
  };
  s.missions.push(m);
  return m;
}

export function editMission(s: GameState, ev: Ev, id: string, patch: Partial<MissionInput>, now = new Date()) {
  const m = s.missions.find((x) => x.id === id);
  if (!m) return;
  const merged: MissionInput = { title: m.title, description: m.description, type: m.type, difficulty: m.difficulty, recurrence: m.recurrence, attrs: m.attrs, deadline: m.deadline, ...patch };
  const err = validateMissionInput(merged);
  if (err) { ev.push({ kind: 'error', text: err }); return; }
  Object.assign(m, { title: merged.title.trim(), description: merged.description ?? '', type: merged.type, difficulty: merged.difficulty, recurrence: merged.recurrence, attrs: merged.attrs, deadline: merged.deadline });
  if (patch.steps) {
    m.steps = patch.steps.filter((t) => t.trim()).map((t) => m.steps.find((st) => st.title === t.trim()) ?? { id: uid('st'), title: t.trim(), done: false });
  }
  m.updatedAt = now.toISOString();
  m.history.push({ at: m.updatedAt, event: 'Editada' });
}

export function postponeMission(s: GameState, id: string, days: number, now = new Date()) {
  const m = s.missions.find((x) => x.id === id);
  if (!m) return;
  const base = m.deadline && m.deadline > dayKey(now) ? m.deadline : dayKey(now);
  m.deadline = addDays(base, days);
  m.updatedAt = now.toISOString();
  m.history.push({ at: m.updatedAt, event: `Adiada para ${m.deadline}` });
}

export function cancelMission(s: GameState, id: string, now = new Date()) {
  const m = s.missions.find((x) => x.id === id);
  if (!m) return;
  m.status = 'cancelada';
  m.updatedAt = now.toISOString();
  m.history.push({ at: m.updatedAt, event: 'Cancelada' });
}

export function deleteMission(s: GameState, id: string) {
  s.missions = s.missions.filter((m) => m.id !== id);
  s.deleted.push(id);
}

/** Etapas de missões recorrentes reiniciam a cada novo período. */
function stepsPeriodTag(m: Mission, now: Date) {
  return m.recurrence === 'unica' ? '' : `:${periodKey(m.recurrence, now)}`;
}

export function refreshRecurringSteps(s: GameState, now = new Date()) {
  for (const m of s.missions) {
    if (m.recurrence === 'unica' || !m.steps.length || m.status !== 'ativa') continue;
    const tag = periodKey(m.recurrence, now);
    const last = [...m.history].reverse().find((h) => h.event.startsWith('Período:'))?.event.slice(8);
    if (last !== tag) {
      m.steps.forEach((st) => (st.done = false));
      m.history.push({ at: now.toISOString(), event: `Período:${tag}` });
    }
  }
}

export function toggleStep(s: GameState, ev: Ev, missionId: string, stepId: string, now = new Date()) {
  const m = s.missions.find((x) => x.id === missionId);
  const st = m?.steps.find((x) => x.id === stepId);
  if (!m || !st || m.status !== 'ativa' || isDoneThisPeriod(m, now)) return;
  st.done = !st.done;
  m.updatedAt = now.toISOString();
  if (st.done) {
    grantXp(s, ev, {
      id: `step:${m.id}:${st.id}${stepsPeriodTag(m, now)}`,
      xp: stepXp(m.type, m.difficulty, m.steps.length),
      weights: m.attrs, source: 'etapa', label: `Etapa: ${st.title}`, now,
    });
    registerActivity(s, ev, now);
  }
}

export function completeMission(s: GameState, ev: Ev, id: string, now = new Date()): boolean {
  const m = s.missions.find((x) => x.id === id);
  if (!m) { ev.push({ kind: 'error', text: 'Missão não encontrada.' }); return false; }
  if (m.status === 'cancelada') { ev.push({ kind: 'error', text: 'Esta missão foi cancelada.' }); return false; }
  const period = periodKey(m.recurrence, now);
  if (isDoneThisPeriod(m, now)) { ev.push({ kind: 'error', text: 'Esta missão já foi concluída neste período. XP não é concedido duas vezes.' }); return false; }
  const pending = m.steps.filter((x) => !x.done);
  if (pending.length) { ev.push({ kind: 'error', text: `Faltam ${pending.length} etapa(s) para concluir esta missão.` }); return false; }

  const streak = effectiveStreak(s, now);
  const { total } = missionXp(m.type, m.difficulty, streak, m.steps.length);
  const ok = grantXp(s, ev, { id: `mission:${m.id}:${period}`, xp: total, weights: m.attrs, source: 'missao', label: m.title, now });
  if (!ok) { ev.push({ kind: 'error', text: 'Conclusão já registrada.' }); return false; }

  const iso = now.toISOString();
  if (m.recurrence === 'unica') { m.status = 'concluida'; m.completedAt = iso; }
  m.completedPeriods.push(period);
  m.updatedAt = iso;
  m.history.push({ at: iso, event: `Concluída (+${total} XP)` });

  registerActivity(s, ev, now);
  // Consistência sempre cresce com dias ativos (atributo separado, XP pequeno, 1x por dia)
  grantXp(s, ev, { id: `streakday:${dayKey(now)}`, xp: 5, weights: { consistencia: 1 }, source: 'sequencia', label: 'Dia ativo', now });
  checkBosses(s, ev, now);
  checkCampaigns(s, ev, now);
  checkAchievements(s, ev, now);
  return true;
}

// ───────────────────────── Reorganização (sem pilha infinita de atrasos) ─────────────────────────
const PRIORITY: Record<MissionType, number> = { principal: 0, dominio: 1, epica: 2, lendaria: 3, secundaria: 4, rapida: 5, surpresa: 6 };

export function replanOverdue(s: GameState, ev: Ev, now = new Date()): number {
  const today = dayKey(now);
  // Missões surpresa vencidas simplesmente expiram, sem penalidade.
  for (const m of s.missions) {
    if (m.optional && m.status === 'ativa' && m.deadline && m.deadline < today) {
      m.status = 'cancelada';
      m.history.push({ at: now.toISOString(), event: 'Expirou (opcional, sem penalidade)' });
    }
  }
  const overdue = s.missions
    .filter((m) => m.status === 'ativa' && m.recurrence === 'unica' && m.deadline && m.deadline < today)
    .sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type] || b.difficulty - a.difficulty);
  if (!overdue.length) return 0;
  const load: Record<string, number> = {};
  for (const m of s.missions) if (m.status === 'ativa' && m.deadline && m.deadline >= today) load[m.deadline] = (load[m.deadline] ?? 0) + 1;
  const cap = Math.max(1, s.settings.dailyCapacity);
  let day = today;
  for (const m of overdue) {
    while ((load[day] ?? 0) >= cap) day = addDays(day, 1);
    load[day] = (load[day] ?? 0) + 1;
    m.deadline = day;
    m.updatedAt = now.toISOString();
    m.history.push({ at: m.updatedAt, event: `Reorganizada pelo SISTEMA para ${day}` });
  }
  ev.push({ kind: 'info', text: `${overdue.length} missão(ões) atrasada(s) foram redistribuídas a partir de hoje, respeitando seu limite de ${cap} por dia. Sem penalidade.` });
  s.lastReplanDay = today;
  return overdue.length;
}

function minutesOf(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); }

export function inQuietHours(s: GameState, now: Date): boolean {
  const n = now.getHours() * 60 + now.getMinutes();
  const a = minutesOf(s.settings.notifications.quietStart);
  const b = minutesOf(s.settings.notifications.quietEnd);
  return a < b ? n >= a && n < b : n >= a || n < b;
}

/** No máximo 1 missão surpresa por dia, opcional, fora do horário de silêncio, nunca se já houver muitas pendentes. */
export function maybeSurprise(s: GameState, ev: Ev, now = new Date()): Mission | null {
  const today = dayKey(now);
  if (!s.settings.surprise || s.surpriseDay === today || !s.onboarded) return null;
  if (inQuietHours(s, now) || now.getHours() < 8 || now.getHours() >= 21) return null;
  const dueToday = s.missions.filter((m) => m.status === 'ativa' && (!m.deadline || m.deadline <= today) && !isDoneThisPeriod(m, now)).length;
  if (dueToday >= s.settings.dailyCapacity + 3) return null;
  // Prefere atributos negligenciados
  const t = totals(s.ledger.filter((e) => diffDays(e.day, today) <= 7));
  const pool = [...SURPRISE_POOL].sort((a, b) => sumAttr(t.attrs, a.attrs) - sumAttr(t.attrs, b.attrs));
  const seed: MissionSeed = pool[now.getDate() % 3] ?? pool[0];
  s.surpriseDay = today;
  const m = createMission(s, ev, { ...seed, deadline: today, optional: true }, now);
  if (m) ev.push({ kind: 'info', text: `Missão surpresa disponível: ${m.title} (opcional).` });
  return m;
}

function sumAttr(cur: Record<AttrKey, number>, w: AttrWeights) {
  return Object.keys(w).reduce((n, k) => n + (cur[k as AttrKey] ?? 0), 0);
}

// ───────────────────────── Campanhas e Chefes ─────────────────────────
export function createCampaign(s: GameState, ev: Ev, goal: string, now = new Date(), tpl?: CampaignTemplate, source: Campaign['source'] = 'modelo'): Campaign | null {
  const g = goal.trim();
  if (g.length < 3) { ev.push({ kind: 'error', text: 'Descreva o objetivo com um pouco mais de detalhe.' }); return null; }
  const t = tpl ?? pickTemplate(g);
  const iso = now.toISOString();
  const today = dayKey(now);
  const campaign: Campaign = { id: uid('c'), title: t.title, goal: g, summary: t.summary, source, missionIds: [], status: 'ativa', repeatCount: 0, createdAt: iso, updatedAt: iso };
  const boss: Boss = { id: uid('b'), name: t.boss.name, epithet: t.boss.epithet, lore: t.boss.lore, theme: t.boss.theme, phases: [], campaignId: campaign.id, createdAt: iso, updatedAt: iso };
  campaign.bossId = boss.id;
  for (const d of t.dailies) {
    const m = createMission(s, ev, { ...d, campaignId: campaign.id }, now);
    if (m) campaign.missionIds.push(m.id);
  }
  let offset = 0;
  for (const ph of t.phases) {
    const phase = { id: uid('ph'), name: ph.name, missionIds: [] as string[] };
    for (const seed of ph.missions) {
      offset = Math.max(offset, seed.days ?? 7);
      const m = createMission(s, ev, { ...seed, deadline: seed.recurrence === 'unica' ? addDays(today, seed.days ?? 7) : undefined, campaignId: campaign.id, bossId: boss.id, phaseId: phase.id }, now);
      if (m) { phase.missionIds.push(m.id); campaign.missionIds.push(m.id); }
    }
    boss.phases.push(phase);
  }
  s.campaigns.push(campaign);
  s.bosses.push(boss);
  if (!s.goals.includes(g)) s.goals.push(g);
  ev.push({ kind: 'info', text: `Campanha criada: ${campaign.title}. Chefe: ${boss.name}.` });
  return campaign;
}

export function checkBosses(s: GameState, ev: Ev, now: Date) {
  for (const b of s.bosses) {
    if (b.defeatedAt) continue;
    const p = bossProgress(b, s.missions);
    for (const ph of p.phases) {
      const key = `bossphase:${b.id}:${ph.id}`;
      if (ph.cleared && !s.ledger.some((e) => e.id === key)) {
        grantXp(s, ev, { id: key, xp: 40, weights: { disciplina: 1 }, source: 'chefe', label: `${b.name}: ${ph.name} vencida`, now });
        ev.push({ kind: 'boss_phase', bossId: b.id, phase: ph.name });
      }
    }
    if (p.defeated) {
      b.defeatedAt = now.toISOString();
      b.updatedAt = b.defeatedAt;
      grantXp(s, ev, { id: `boss:${b.id}`, xp: 120 + 40 * b.phases.length, weights: { disciplina: 2, consistencia: 1 }, source: 'chefe', label: `Chefe derrotado: ${b.name}`, now });
      ev.push({ kind: 'boss_defeated', bossId: b.id });
      if (b.rewardItemId) giveItem(s, ev, b.rewardItemId, `Chefe: ${b.name}`, now);
    }
  }
}

export function checkCampaigns(s: GameState, ev: Ev, now: Date) {
  for (const c of s.campaigns) {
    if (c.status !== 'ativa') continue;
    const core = c.missionIds.map((id) => s.missions.find((m) => m.id === id)).filter((m): m is Mission => !!m && m.recurrence === 'unica' && m.status !== 'cancelada');
    if (core.length && core.every((m) => m.status === 'concluida')) {
      c.status = 'concluida';
      c.completedAt = now.toISOString();
      c.updatedAt = c.completedAt;
      grantXp(s, ev, { id: `campaign:${c.id}:${c.repeatCount}`, xp: 150 + 25 * c.repeatCount, weights: { disciplina: 1, organizacao: 1 }, source: 'campanha', label: `Campanha concluída: ${c.title}`, now });
      ev.push({ kind: 'campaign_done', id: c.id });
    }
  }
}

/** Repetir campanha com dificuldade +1 (máx. 5) para comparar com o próprio histórico. */
export function repeatCampaign(s: GameState, ev: Ev, campaignId: string, now = new Date()) {
  const c = s.campaigns.find((x) => x.id === campaignId);
  if (!c || c.status !== 'concluida') return;
  const old = c.missionIds.map((id) => s.missions.find((m) => m.id === id)).filter(Boolean) as Mission[];
  const boss = s.bosses.find((b) => b.id === c.bossId);
  c.repeatCount += 1;
  c.status = 'ativa';
  c.updatedAt = now.toISOString();
  const idMap: Record<string, string> = {};
  const today = dayKey(now);
  c.missionIds = [];
  for (const m of old) {
    if (m.recurrence !== 'unica') { c.missionIds.push(m.id); continue; }
    const span = m.deadline ? Math.max(1, diffDays(m.createdAt.slice(0, 10), m.deadline)) : 7;
    const nm = createMission(s, ev, { title: m.title, description: m.description, type: m.type, difficulty: Math.min(5, m.difficulty + 1) as Difficulty, recurrence: m.recurrence, attrs: m.attrs, deadline: addDays(today, span), steps: m.steps.map((x) => x.title), campaignId: c.id, bossId: m.bossId, phaseId: m.phaseId }, now);
    if (nm) { idMap[m.id] = nm.id; c.missionIds.push(nm.id); }
  }
  if (boss) {
    const nb: Boss = { ...structuredClone(boss), id: uid('b'), name: `${boss.name} +${c.repeatCount}`, defeatedAt: undefined, introSeen: false, createdAt: now.toISOString(), updatedAt: now.toISOString() };
    nb.phases = boss.phases.map((p) => ({ id: uid('ph'), name: p.name, missionIds: p.missionIds.map((id) => idMap[id]).filter(Boolean) }));
    s.bosses.push(nb);
    c.bossId = nb.id;
  }
  ev.push({ kind: 'info', text: `Campanha reiniciada com dificuldade maior (${c.repeatCount}ª repetição).` });
}

// ───────────────────────── Equipamentos e Talentos ─────────────────────────
export function equipItem(s: GameState, ev: Ev, itemId: string) {
  const it = ITEM_MAP[itemId];
  if (!it || !owns(s, itemId)) { ev.push({ kind: 'error', text: 'Você ainda não possui este item.' }); return; }
  if (it.req?.level && playerLevel(s) < it.req.level) { ev.push({ kind: 'error', text: `Requer nível ${it.req.level}.` }); return; }
  s.character.equipped[it.slot] = itemId;
}

export function unequipSlot(s: GameState, slot: keyof GameState['character']['equipped']) {
  delete s.character.equipped[slot];
}

export function learnSkill(s: GameState, ev: Ev, skillId: string) {
  const sk = SKILL_MAP[skillId];
  if (!sk) return;
  const rank = s.skills[skillId] ?? 0;
  if (rank >= sk.maxRank) { ev.push({ kind: 'error', text: 'Talento já está no rank máximo.' }); return; }
  if (playerLevel(s) < sk.reqLevel) { ev.push({ kind: 'error', text: `Requer nível ${sk.reqLevel}.` }); return; }
  if (sk.prereq && !(s.skills[sk.prereq] > 0)) { ev.push({ kind: 'error', text: `Requer ${SKILL_MAP[sk.prereq].name}.` }); return; }
  if (skillPoints(s).free < sk.cost) { ev.push({ kind: 'error', text: `Pontos insuficientes (custa ${sk.cost}).` }); return; }
  s.skills[skillId] = rank + 1;
  ev.push({ kind: 'info', text: `Talento aprendido: ${sk.name} (rank ${rank + 1}).` });
  checkAchievements(s, ev, new Date());
}

export function resetSkills(s: GameState) { s.skills = {}; }

// ───────────────────────── Vida real ─────────────────────────
export function addWorkout(s: GameState, ev: Ev, w: Omit<Workout, 'id' | 'createdAt'>, now = new Date()): Workout | null {
  const exercises = w.exercises.filter((e) => e.name.trim() && e.sets.length);
  if (!exercises.length && w.durationMin <= 0) { ev.push({ kind: 'error', text: 'Registre pelo menos um exercício ou a duração.' }); return null; }
  if (exercises.some((e) => e.sets.some((x) => x.reps < 0 || x.kg < 0 || x.reps > 1000 || x.kg > 1000))) { ev.push({ kind: 'error', text: 'Valores de série inválidos.' }); return null; }
  const prevPR = personalRecords(s.workouts);
  const workout: Workout = { ...w, exercises, id: uid('w'), createdAt: now.toISOString() };
  s.workouts.push(workout);
  const volume = exercises.reduce((t, e) => t + e.sets.reduce((a, x) => a + x.reps * Math.max(1, x.kg), 0), 0);
  const setsCount = exercises.reduce((t, e) => t + e.sets.length, 0);
  const xp = Math.min(70, 15 + setsCount * 2 + Math.round(w.durationMin / 6) + Math.round(Math.log10(1 + volume) * 3));
  const hasLoad = exercises.some((e) => e.sets.some((x) => x.kg > 0));
  const weights: AttrWeights = hasLoad ? { forca: 3, resistencia: 2 } : { condicionamento: 3, resistencia: 2 };
  // No máximo 2 treinos por dia concedem XP (incentiva recuperação).
  const todayCount = s.ledger.filter((e) => e.source === 'treino' && e.day === dayKey(now)).length;
  if (todayCount < 2) grantXp(s, ev, { id: `workout:${workout.id}`, xp, weights, source: 'treino', label: 'Treino registrado', now });
  else ev.push({ kind: 'info', text: 'Treino salvo. Para proteger sua recuperação, só 2 treinos por dia concedem XP.' });
  for (const e of exercises) {
    const key = e.name.trim().toLowerCase();
    const max = Math.max(...e.sets.map((x) => x.kg));
    if (prevPR[key] && max > prevPR[key].kg) ev.push({ kind: 'pr', exercise: e.name, kg: max });
  }
  if (w.rpe >= 9 && todayCount >= 1) ev.push({ kind: 'info', text: 'Esforço muito alto hoje. Descanso também é treino: o SISTEMA recomenda recuperação.' });
  registerActivity(s, ev, now);
  checkAchievements(s, ev, now);
  return workout;
}

export function addBodyLog(s: GameState, log: Omit<import('./types').BodyLog, 'id'>) {
  s.body.push({ ...log, id: uid('bd') });
}

export function addStudy(s: GameState, ev: Ev, x: Omit<StudySession, 'id'>, now = new Date()) {
  if (x.minutes <= 0 || x.minutes > 720) { ev.push({ kind: 'error', text: 'Informe minutos entre 1 e 720.' }); return; }
  const session: StudySession = { ...x, id: uid('ss') };
  s.study.push(session);
  const xp = Math.min(80, Math.round(x.minutes * 0.8));
  grantXp(s, ev, { id: `study:${session.id}`, xp, weights: x.minutes >= 25 ? { conhecimento: 3, concentracao: 2 } : { conhecimento: 1 }, source: 'estudo', label: `Estudo: ${x.minutes} min`, now });
  registerActivity(s, ev, now);
  checkAchievements(s, ev, now);
}

const EVIDENCE_XP: Record<Evidence['type'], number> = { licao: 5, link: 3, revisao: 8, exercicio: 15, teste: 25, projeto: 60 };

export function addEvidence(s: GameState, ev: Ev, nodeId: string, e: Omit<Evidence, 'id' | 'at'>, now = new Date()) {
  const n = s.knowledge.find((k) => k.id === nodeId);
  if (!n) return;
  if (e.url && !/^https?:\/\//i.test(e.url)) { ev.push({ kind: 'error', text: 'O link precisa começar com http:// ou https://' }); return; }
  if (e.type === 'teste' && (e.score == null || e.score < 0 || e.score > 100)) { ev.push({ kind: 'error', text: 'Informe a nota do teste (0 a 100).' }); return; }
  const before = masteryLevel(n);
  const evidence: Evidence = { ...e, id: uid('e'), at: now.toISOString() };
  n.evidence.push(evidence);
  grantXp(s, ev, { id: `evidence:${evidence.id}`, xp: EVIDENCE_XP[e.type], weights: e.type === 'licao' || e.type === 'link' ? { conhecimento: 1 } : { inteligencia: 2, conhecimento: 1 }, source: 'estudo', label: `${n.name}: ${e.type}`, now });
  const after = masteryLevel(n);
  if (after >= 4 && before < 4) {
    grantXp(s, ev, { id: `mastery:${n.id}`, xp: 150, weights: { inteligencia: 2, conhecimento: 2 }, source: 'estudo', label: `Habilidade dominada: ${n.name}`, now });
    ev.push({ kind: 'info', text: `${n.name} DOMINADA. Prática e projeto comprovados.` });
  }
  registerActivity(s, ev, now);
  checkAchievements(s, ev, now);
}

export function addKnowledgeNode(s: GameState, node: Omit<KnowledgeNode, 'id' | 'evidence' | 'custom'>) {
  s.knowledge.push({ ...node, id: uid('k'), evidence: [], custom: true });
}

export function addFinanceGoal(s: GameState, ev: Ev, name: string, target: number, now = new Date()) {
  if (!name.trim() || !(target > 0)) { ev.push({ kind: 'error', text: 'Informe nome e valor da meta.' }); return; }
  s.finance.goals.push({ id: uid('fg'), name: name.trim(), target, createdAt: now.toISOString() });
}

export function addFinanceEntry(s: GameState, ev: Ev, e: Omit<FinanceEntry, 'id'>, now = new Date()) {
  if (!(e.amount > 0)) { ev.push({ kind: 'error', text: 'Informe um valor maior que zero.' }); return; }
  const entry: FinanceEntry = { ...e, id: uid('fe') };
  s.finance.entries.push(entry);
  const day = dayKey(now);
  const n = s.ledger.filter((x) => x.source === 'financas' && x.day === day).length;
  if (n < 3) grantXp(s, ev, { id: `fin:${entry.id}`, xp: e.kind === 'economia' ? 15 : 6, weights: { financas: 2, organizacao: 1 }, source: 'financas', label: e.kind === 'economia' ? 'Economia registrada' : 'Registro financeiro', now });
  for (const g of s.finance.goals) {
    if (financeSaved(s, g.id) >= g.target) grantXp(s, ev, { id: `fingoal:${g.id}`, xp: 200, weights: { financas: 3, disciplina: 1 }, source: 'financas', label: `Meta financeira: ${g.name}`, now });
  }
  registerActivity(s, ev, now);
  checkAchievements(s, ev, now);
}

export function addSelfCare(s: GameState, ev: Ev, x: Omit<SelfCareLog, 'id'>, now = new Date()) {
  const log: SelfCareLog = { ...x, id: uid('sc') };
  s.selfcare.push(log);
  grantXp(s, ev, { id: `selfcare:${x.date}:${x.kind}`, xp: 6, weights: { autocuidado: 2 }, source: 'autocuidado', label: 'Autocuidado', now });
  registerActivity(s, ev, now);
  checkAchievements(s, ev, now);
}

// ───────────────────────── Temporadas ─────────────────────────
export function startSeason(s: GameState, ev: Ev, length: 30 | 60 | 90, now = new Date()) {
  if (s.seasons.some((x) => !x.endedAt)) { ev.push({ kind: 'error', text: 'Já existe uma temporada ativa.' }); return; }
  const recentXp = s.ledger.filter((e) => diffDays(e.day, dayKey(now)) <= 14).reduce((t, e) => t + e.xp, 0);
  const perDay = Math.max(40, Math.round(recentXp / 14));
  const themes = ['Temporada da Brasa', 'Temporada do Eclipse', 'Temporada da Maré Prateada', 'Temporada do Vento Cortante'];
  s.seasons.push({
    id: uid('sea'), length, startDay: dayKey(now), theme: themes[s.seasons.length % themes.length],
    // Metas baseadas no seu próprio ritmo recente, com folga (≈70% dos dias).
    targets: { xp: Math.round(perDay * length * 0.7), missions: Math.round(length * 1.2), activeDays: Math.round(length * 0.6) },
    claimedTiers: [],
  });
  ev.push({ kind: 'info', text: `Temporada de ${length} dias iniciada.` });
}

export function seasonProgress(s: GameState, seasonId: string, now = new Date()) {
  const sea = s.seasons.find((x) => x.id === seasonId)!;
  const end = addDays(sea.startDay, sea.length);
  const inside = s.ledger.filter((e) => e.day >= sea.startDay && e.day < end);
  const xp = inside.reduce((t, e) => t + e.xp, 0);
  const missions = inside.filter((e) => e.source === 'missao').length;
  const activeDays = new Set(inside.map((e) => e.day)).size;
  const pct = Math.min(1, (xp / sea.targets.xp + missions / sea.targets.missions + activeDays / sea.targets.activeDays) / 3);
  const daysLeft = Math.max(0, diffDays(dayKey(now), end));
  return { xp, missions, activeDays, pct, daysLeft, ended: dayKey(now) >= end };
}

export function updateSeasons(s: GameState, ev: Ev, now = new Date()) {
  for (const sea of s.seasons) {
    if (sea.endedAt) continue;
    const p = seasonProgress(s, sea.id, now);
    const tiers = [1, 2, 3].filter((t) => p.pct >= t / 3);
    for (const t of tiers) {
      if (sea.claimedTiers.includes(t)) continue;
      sea.claimedTiers.push(t);
      grantXp(s, ev, { id: `season:${sea.id}:${t}`, xp: 60 * t, weights: { consistencia: 2 }, source: 'temporada', label: `${sea.theme}: nível ${t}/3`, now });
    }
    if (p.ended) {
      sea.endedAt = now.toISOString();
      sea.summary = `${p.xp} XP, ${p.missions} missões e ${p.activeDays} dias ativos em ${sea.length} dias. Recompensas: ${sea.claimedTiers.length}/3.`;
      ev.push({ kind: 'info', text: `${sea.theme} encerrada. ${sea.summary}` });
      checkAchievements(s, ev, now);
    }
  }
}

// ───────────────────────── Arena ─────────────────────────
export function recordArenaWin(s: GameState, ev: Ev, dungeonId: string, timeSec: number, rewardItemId: string | undefined, firstXp: number, now = new Date()) {
  let r = s.arena.find((a) => a.dungeonId === dungeonId);
  if (!r) { r = { dungeonId, wins: 0 }; s.arena.push(r); }
  r.wins += 1;
  if (!r.bestTimeSec || timeSec < r.bestTimeSec) r.bestTimeSec = Math.round(timeSec);
  if (!r.firstClearAt) {
    r.firstClearAt = now.toISOString();
    if (rewardItemId) giveItem(s, ev, rewardItemId, 'Primeira vitória na Fenda', now);
    grantXp(s, ev, { id: `arena:${dungeonId}:first`, xp: firstXp, weights: { concentracao: 1 }, source: 'arena', label: 'Primeira vitória na Fenda', now });
  }
  checkAchievements(s, ev, now);
}

// ───────────────────────── Rotina diária ao abrir o app ─────────────────────────
export function dailyTick(s: GameState, ev: Ev, now = new Date()) {
  refreshRecurringSteps(s, now);
  if (s.lastReplanDay !== dayKey(now)) replanOverdue(s, ev, now);
  s.lastReplanDay = dayKey(now);
  updateSeasons(s, ev, now);
  reconcileRewards(s, now);
  // Oferece missão de retorno quando a sequência foi quebrada (sem culpa, com bônus).
  const st = s.streak;
  if (st.lastActiveDay && diffDays(st.lastActiveDay, dayKey(now)) >= 3 && st.comebackOffered !== dayKey(now)) {
    st.comebackOffered = dayKey(now);
    createMission(s, ev, { title: 'Retorno do Caçador', description: 'Qualquer passo pequeno conta. Conclua uma ação de 5 minutos para reacender o fogo.', type: 'surpresa', difficulty: 2, recurrence: 'unica', attrs: { consistencia: 2, disciplina: 1 }, deadline: addDays(dayKey(now), 2), optional: true }, now);
    ev.push({ kind: 'info', text: 'Bem-vindo de volta. Nada do que você conquistou foi perdido. Uma missão de retorno está disponível.' });
  }
}

export function finishOnboarding(s: GameState, ev: Ev, name: string, classId: string, goals: string[], now = new Date()) {
  s.character.name = name.trim() || 'Desperto';
  s.character.classId = classId;
  s.onboarded = true;
  for (const g of goals.filter((x) => x.trim())) createCampaign(s, ev, g, now);
  createMission(s, ev, { title: 'Primeiro contato com o SISTEMA', description: 'Abra seu painel de status e conclua esta missão.', type: 'rapida', difficulty: 1, recurrence: 'unica', attrs: { disciplina: 1, organizacao: 1 }, deadline: dayKey(now) }, now);
}

export { ATTR_KEYS };
