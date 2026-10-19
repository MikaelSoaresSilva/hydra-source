import type { AttrKey, AttrWeights, Difficulty, GameState, LedgerEntry, MissionType, RankRule } from './types';
import { ATTR_KEYS } from './types';
import { clamp } from './util';

// ───────────── Curva de níveis ─────────────
// XP para ir do nível L ao L+1. Começa rápido (150, 190, 240...) e cresce de forma suave:
// nível 10 ≈ 600 XP, nível 30 ≈ 2.300 XP, nível 60 ≈ 5.900 XP. Assim há recompensas
// frequentes no começo e marcos com significado depois, sem "paredes" de meses.
export function xpToNext(level: number): number {
  return Math.round(110 + 40 * Math.pow(level, 1.35));
}

export const MAX_LEVEL = 100;

export function levelFromXp(totalXp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp));
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, need: xpToNext(level) };
}

export function totalXpForLevel(level: number): number {
  let t = 0;
  for (let l = 1; l < level; l++) t += xpToNext(l);
  return t;
}

// ───────────── XP de missão ─────────────
export const DIFFICULTY_XP: Record<Difficulty, number> = { 1: 10, 2: 20, 3: 35, 4: 55, 5: 80 };
export const TYPE_MULT: Record<MissionType, number> = {
  rapida: 0.6, secundaria: 0.8, principal: 1, surpresa: 1.1, dominio: 1.4, epica: 2.5, lendaria: 4,
};
export const TYPE_LABEL: Record<MissionType, string> = {
  rapida: 'Rápida', principal: 'Principal', secundaria: 'Secundária', dominio: 'Domínio', epica: 'Épica', lendaria: 'Lendária', surpresa: 'Surpresa',
};

/** Bônus de consistência: +2% por dia de sequência, limitado a +20%. */
export function streakBonus(streak: number): number {
  return clamp(streak, 0, 10) * 0.02;
}

export function missionBaseXp(type: MissionType, difficulty: Difficulty): number {
  return Math.round(DIFFICULTY_XP[difficulty] * TYPE_MULT[type]);
}

export function missionXp(type: MissionType, difficulty: Difficulty, streak: number, stepsCount = 0): { base: number; bonus: number; total: number } {
  const base = missionBaseXp(type, difficulty);
  // Etapas dão XP próprio ao serem concluídas, então a conclusão final vale 60% se houver etapas.
  const finalBase = stepsCount > 0 ? Math.round(base * 0.6) : base;
  const bonus = Math.round(finalBase * streakBonus(streak));
  return { base: finalBase, bonus, total: finalBase + bonus };
}

export function stepXp(type: MissionType, difficulty: Difficulty, stepsCount: number): number {
  if (stepsCount <= 0) return 0;
  return Math.max(2, Math.round((missionBaseXp(type, difficulty) * 0.4) / stepsCount));
}

/**
 * Distribui o XP entre atributos de acordo com os pesos da missão.
 * Uma missão só pode afetar no máximo 3 atributos: nenhuma atividade evolui tudo de uma vez.
 */
export function distributeAttrXp(xp: number, weights: AttrWeights): AttrWeights {
  const entries = Object.entries(weights)
    .filter(([k, w]) => (ATTR_KEYS as readonly string[]).includes(k) && (w ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3) as [AttrKey, number][];
  const sum = entries.reduce((s, [, w]) => s + w, 0);
  const out: AttrWeights = {};
  if (!sum) return out;
  for (const [k, w] of entries) out[k] = Math.max(1, Math.round((xp * w) / sum));
  return out;
}

// ───────────── Atributos ─────────────
export function attrXpToNext(level: number): number {
  return Math.round(40 + 18 * Math.pow(level, 1.3));
}

export function attrLevel(xp: number): { level: number; into: number; need: number } {
  let level = 0;
  let rest = Math.max(0, Math.floor(xp));
  while (level < 99 && rest >= attrXpToNext(level)) {
    rest -= attrXpToNext(level);
    level++;
  }
  return { level, into: rest, need: attrXpToNext(level) };
}

export function totals(ledger: LedgerEntry[]): { xp: number; attrs: Record<AttrKey, number> } {
  const attrs = Object.fromEntries(ATTR_KEYS.map((k) => [k, 0])) as Record<AttrKey, number>;
  let xp = 0;
  for (const e of ledger) {
    xp += e.xp;
    for (const [k, v] of Object.entries(e.attrs)) attrs[k as AttrKey] += v ?? 0;
  }
  return { xp, attrs };
}

// ───────────── Ranks (E → SSS), critérios objetivos e configuráveis ─────────────
export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const;
export type Rank = (typeof RANKS)[number];

export const DEFAULT_RANK_RULES: RankRule[] = [
  { rank: 'E', minLevel: 1, minBestStreak: 0, minBosses: 0, minAttrLevel: 0, minAttrCount: 0 },
  { rank: 'D', minLevel: 5, minBestStreak: 3, minBosses: 0, minAttrLevel: 2, minAttrCount: 2 },
  { rank: 'C', minLevel: 12, minBestStreak: 7, minBosses: 1, minAttrLevel: 4, minAttrCount: 3 },
  { rank: 'B', minLevel: 20, minBestStreak: 14, minBosses: 2, minAttrLevel: 6, minAttrCount: 4 },
  { rank: 'A', minLevel: 30, minBestStreak: 30, minBosses: 4, minAttrLevel: 9, minAttrCount: 5 },
  { rank: 'S', minLevel: 45, minBestStreak: 60, minBosses: 7, minAttrLevel: 12, minAttrCount: 6 },
  { rank: 'SS', minLevel: 65, minBestStreak: 90, minBosses: 10, minAttrLevel: 15, minAttrCount: 8 },
  { rank: 'SSS', minLevel: 85, minBestStreak: 120, minBosses: 15, minAttrLevel: 18, minAttrCount: 10 },
];

export interface RankContext { level: number; bestStreak: number; bosses: number; attrLevels: number[] }

export function rankChecks(rule: RankRule, ctx: RankContext) {
  const attrOk = ctx.attrLevels.filter((l) => l >= rule.minAttrLevel).length;
  return [
    { label: `Nível ${rule.minLevel}`, ok: ctx.level >= rule.minLevel, cur: ctx.level, req: rule.minLevel },
    { label: `Melhor sequência de ${rule.minBestStreak} dias`, ok: ctx.bestStreak >= rule.minBestStreak, cur: ctx.bestStreak, req: rule.minBestStreak },
    { label: `${rule.minBosses} chefe(s) derrotado(s)`, ok: ctx.bosses >= rule.minBosses, cur: ctx.bosses, req: rule.minBosses },
    { label: `${rule.minAttrCount} atributos no nível ${rule.minAttrLevel}+`, ok: attrOk >= rule.minAttrCount, cur: attrOk, req: rule.minAttrCount },
  ];
}

export function computeRank(rules: RankRule[], ctx: RankContext): { rank: string; next?: RankRule } {
  let rank = rules[0]?.rank ?? 'E';
  let next: RankRule | undefined;
  for (const rule of rules) {
    if (rankChecks(rule, ctx).every((c) => c.ok)) rank = rule.rank;
    else { next = rule; break; }
  }
  return { rank, next };
}

export function rankContext(s: GameState): RankContext {
  const t = totals(s.ledger);
  return {
    level: levelFromXp(t.xp).level,
    bestStreak: s.streak.best,
    bosses: s.bosses.filter((b) => b.defeatedAt).length,
    attrLevels: ATTR_KEYS.map((k) => attrLevel(t.attrs[k]).level),
  };
}

export const RANK_COLORS: Record<string, string> = {
  E: '#8a94a6', D: '#5fd38d', C: '#4cc9ff', B: '#7b6cff', A: '#c06bff', S: '#ffb547', SS: '#ff6b8b', SSS: '#ffffff',
};
