// Persistência: migração de versões, validação de backups e mesclagem para sincronização.
import type { GameState } from './types';
import { SAVE_VERSION, newGame } from './engine';

/** Completa campos ausentes (saves antigos) sem perder dados. */
export function migrate(raw: unknown): GameState {
  const base = newGame();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<GameState>;
  const out = { ...base, ...s } as GameState;
  out.character = { ...base.character, ...(s.character ?? {}), appearance: { ...base.character.appearance, ...(s.character?.appearance ?? {}) } };
  out.settings = {
    ...base.settings, ...(s.settings ?? {}),
    notifications: { ...base.settings.notifications, ...(s.settings?.notifications ?? {}), categories: { ...base.settings.notifications.categories, ...(s.settings?.notifications?.categories ?? {}) } },
    ai: { ...base.settings.ai, ...(s.settings?.ai ?? {}) },
    cloud: { ...base.settings.cloud, ...(s.settings?.cloud ?? {}) },
    rankRules: s.settings?.rankRules?.length ? s.settings.rankRules : base.settings.rankRules,
  };
  out.streak = { ...base.streak, ...(s.streak ?? {}) };
  out.finance = { goals: s.finance?.goals ?? [], entries: s.finance?.entries ?? [] };
  // Novos nós de conhecimento adicionados em versões futuras aparecem sem apagar evidências.
  const known = new Set((s.knowledge ?? []).map((k) => k.id));
  out.knowledge = [...(s.knowledge ?? []), ...base.knowledge.filter((k) => !known.has(k.id))];
  for (const m of out.missions) { m.completedPeriods ??= []; m.history ??= []; m.steps ??= []; }
  out.version = SAVE_VERSION;
  return out;
}

export function validateBackup(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'Arquivo inválido.';
  const s = raw as Record<string, unknown>;
  if (typeof s.version !== 'number') return 'Este arquivo não parece um backup do Life Leveling.';
  if (!Array.isArray(s.ledger) || !Array.isArray(s.missions)) return 'Backup incompleto ou corrompido.';
  if ((s.version as number) > SAVE_VERSION) return 'Backup de uma versão mais nova do aplicativo. Atualize o app.';
  return null;
}

type WithId = { id: string; updatedAt?: string; createdAt?: string; at?: string };
function stamp(x: WithId) { return x.updatedAt ?? x.createdAt ?? x.at ?? ''; }

function mergeById<T extends WithId>(a: T[], b: T[], deleted: Set<string>): T[] {
  const map = new Map<string, T>();
  for (const x of a) if (!deleted.has(x.id)) map.set(x.id, x);
  for (const x of b) {
    if (deleted.has(x.id)) continue;
    const cur = map.get(x.id);
    if (!cur || stamp(x) > stamp(cur)) map.set(x.id, x);
  }
  return [...map.values()];
}

/**
 * Mescla dois saves (ex.: celular offline × nuvem).
 * - Registro de XP (ledger): união por id → nunca duplica nem perde XP.
 * - Entidades: última alteração vence (por updatedAt).
 * - Conquistas/itens: união.
 * - Personagem/configurações: do save alterado mais recentemente (credenciais locais preservadas).
 */
export function mergeStates(local: GameState, remote: GameState): GameState {
  const newer = remote.updatedAt > local.updatedAt ? remote : local;
  const deleted = new Set([...local.deleted, ...remote.deleted]);
  const ledgerMap = new Map(local.ledger.map((e) => [e.id, e]));
  for (const e of remote.ledger) if (!ledgerMap.has(e.id)) ledgerMap.set(e.id, e);
  const achievements = { ...remote.achievements };
  for (const [k, v] of Object.entries(local.achievements)) if (!achievements[k] || v < achievements[k]) achievements[k] = v;
  const inv = new Map(remote.inventory.map((i) => [i.itemId, i]));
  for (const i of local.inventory) if (!inv.has(i.itemId)) inv.set(i.itemId, i);
  const knowledge = mergeById(
    local.knowledge.map((k) => ({ ...k, id: k.id })),
    remote.knowledge,
    deleted,
  ).map((k) => {
    const l = local.knowledge.find((x) => x.id === k.id);
    const r = remote.knowledge.find((x) => x.id === k.id);
    const ev = new Map([...(l?.evidence ?? []), ...(r?.evidence ?? [])].map((e) => [e.id, e]));
    return { ...k, evidence: [...ev.values()] };
  });
  const missions = mergeById(local.missions, remote.missions, deleted).map((m) => {
    const l = local.missions.find((x) => x.id === m.id);
    const r = remote.missions.find((x) => x.id === m.id);
    const periods = [...new Set([...(l?.completedPeriods ?? []), ...(r?.completedPeriods ?? [])])];
    const done = l?.status === 'concluida' || r?.status === 'concluida';
    return { ...m, completedPeriods: periods, status: done ? 'concluida' : m.status } as typeof m;
  });
  return {
    ...newer,
    updatedAt: newer.updatedAt,
    onboarded: local.onboarded || remote.onboarded,
    goals: [...new Set([...local.goals, ...remote.goals])],
    ledger: [...ledgerMap.values()].sort((a, b) => a.at.localeCompare(b.at)),
    missions,
    inventory: [...inv.values()],
    achievements,
    campaigns: mergeById(local.campaigns, remote.campaigns, deleted),
    bosses: mergeById(local.bosses, remote.bosses, deleted),
    workouts: mergeById(local.workouts, remote.workouts, deleted),
    body: mergeById(local.body, remote.body, deleted),
    knowledge,
    study: mergeById(local.study.map((x) => ({ ...x, at: x.date })), remote.study.map((x) => ({ ...x, at: x.date })), deleted).map(({ at: _at, ...x }) => x),
    finance: {
      goals: mergeById(local.finance.goals, remote.finance.goals, deleted),
      entries: mergeById(local.finance.entries.map((x) => ({ ...x, at: x.date })), remote.finance.entries.map((x) => ({ ...x, at: x.date })), deleted).map(({ at: _at, ...x }) => x),
    },
    selfcare: mergeById(local.selfcare.map((x) => ({ ...x, at: x.date })), remote.selfcare.map((x) => ({ ...x, at: x.date })), deleted).map(({ at: _at, ...x }) => x),
    seasons: mergeById(local.seasons.map((x) => ({ ...x, at: x.startDay })), remote.seasons.map((x) => ({ ...x, at: x.startDay })), deleted).map(({ at: _at, ...x }) => x),
    streak: { ...newer.streak, best: Math.max(local.streak.best, remote.streak.best) },
    storySeen: [...new Set([...local.storySeen, ...remote.storySeen])],
    arena: mergeById(local.arena.map((a) => ({ ...a, id: a.dungeonId })), remote.arena.map((a) => ({ ...a, id: a.dungeonId })), deleted).map(({ id: _id, ...a }) => a),
    chat: mergeById(local.chat, remote.chat, deleted).sort((a, b) => a.at.localeCompare(b.at)).slice(-200),
    deleted: [...deleted],
    // Fotos e credenciais nunca vêm da nuvem para sobrescrever o local.
    settings: { ...newer.settings, cloud: local.settings.cloud, ai: { ...newer.settings.ai, apiKey: local.settings.ai.apiKey } },
    character: { ...newer.character, appearance: { ...newer.character.appearance, photo: local.character.appearance.photo } },
  };
}

/** Remove dados sensíveis antes de enviar para a nuvem. */
export function forCloud(s: GameState): GameState {
  const c = structuredClone(s);
  delete c.character.appearance.photo;
  c.body = c.body.map(({ photo: _p, ...b }) => b);
  c.settings.ai.apiKey = '';
  c.settings.cloud = { ...c.settings.cloud, accessToken: undefined, refreshToken: undefined, anonKey: '' };
  return c;
}
