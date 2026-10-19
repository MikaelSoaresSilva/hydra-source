import { useMemo } from 'react';
import { useGame } from '../store/game';
import { ATTR_KEYS, type AttrKey, type GameState } from '../core/types';
import { RANKS, RANK_COLORS, attrLevel, computeRank, levelFromXp, rankContext, totals } from '../core/progression';
import { CLASSES } from '../data/attributes';
import { ACH_MAP } from '../data/achievements';

export function derive(s: GameState) {
  const t = totals(s.ledger);
  const lv = levelFromXp(t.xp);
  const rc = rankContext(s);
  const { rank, next } = computeRank(s.settings.rankRules, rc);
  const attrLevels = Object.fromEntries(ATTR_KEYS.map((k) => [k, attrLevel(t.attrs[k]).level])) as Record<AttrKey, number>;
  const cls = CLASSES.find((c) => c.id === s.character.classId) ?? CLASSES[0];
  const rankIndex = RANKS.indexOf(rank as (typeof RANKS)[number]);
  const title = s.character.titleId ? ACH_MAP[s.character.titleId]?.title : undefined;
  return { xp: t.xp, attrXp: t.attrs, lv, rank, nextRank: next, rankColor: RANK_COLORS[rank] ?? '#fff', rankIndex, rankGlow: rankIndex / 7, attrLevels, cls, rc, title };
}

export function useDerived() {
  const s = useGame((x) => x.s);
  return useMemo(() => ({ s, ...derive(s) }), [s]);
}
