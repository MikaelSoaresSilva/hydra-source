// Simulação de combate em tempo real (independente de renderização → testável).
// Coordenadas no plano XZ. Ângulo 0 = olhando para +Z.
import type { GameState } from './types';
import { attrLevel, levelFromXp, totals } from './progression';
import { ITEM_MAP } from '../data/items';
import { SKILL_MAP, type SkillDef } from '../data/skills';

export interface V2 { x: number; z: number }
export type EnemyKind = 'sombra' | 'bruto' | 'atirador' | 'chefe';
export type PlayerAction = 'idle' | 'run' | 'attack' | 'heavy' | 'dodge' | 'skill' | 'hit' | 'dead' | 'victory';

export interface CombatStats { hp: number; atk: number; def: number; spd: number; crit: number; energyRegen: number; maxEnergy: number }

export interface SkillSlot { id: string; kind: NonNullable<SkillDef['active']>['kind']; name: string; rank: number; energy: number; cooldown: number }

export interface Enemy {
  id: number; kind: EnemyKind; pos: V2; facing: number; hp: number; maxHp: number; atk: number; spd: number;
  state: 'chase' | 'windup' | 'attack' | 'recover' | 'dead'; stateT: number; rootedT: number; hitFlash: number;
  attackKind?: 'melee' | 'slam' | 'shot' | 'ring' | 'summon'; summonT: number; deadT: number;
}

export interface Projectile { id: number; pos: V2; vel: V2; dmg: number; from: 'player' | 'enemy'; life: number; pierce: boolean; hit: number[]; radius: number }
export interface Fx { id: number; kind: 'slash' | 'ring' | 'burst' | 'heal' | 'shield' | 'telegraph' | 'dash' | 'root'; pos: V2; t: number; life: number; radius: number; color: string; angle?: number }
export interface FloatText { id: number; pos: V2; text: string; t: number; color: string; big?: boolean }

export interface DungeonDef {
  id: string; name: string; desc: string; minRankIndex: number; firstXp: number; rewardItemId?: string;
  waves: { kind: EnemyKind; n: number }[][]; bossScale?: number;
}

export const DUNGEONS: DungeonDef[] = [
  { id: 'fenda1', name: 'Fenda I — Eco das Sombras', desc: 'Sombras menores escapam da primeira rachadura. Ideal para aprender os controles.', minRankIndex: 0, firstXp: 40, rewardItemId: 'arma_arena', waves: [[{ kind: 'sombra', n: 3 }], [{ kind: 'sombra', n: 5 }]] },
  { id: 'fenda2', name: 'Fenda II — Os Brutos', desc: 'Criaturas pesadas e lentas. Leia o aviso vermelho e esquive.', minRankIndex: 0, firstXp: 60, waves: [[{ kind: 'sombra', n: 4 }], [{ kind: 'bruto', n: 1 }, { kind: 'sombra', n: 3 }], [{ kind: 'bruto', n: 2 }]] },
  { id: 'fenda3', name: 'Fenda III — O Guardião', desc: 'Atiradores e o Guardião da Fenda, um chefe com 3 fases.', minRankIndex: 1, firstXp: 120, rewardItemId: 'companheiro_sombra', waves: [[{ kind: 'atirador', n: 2 }, { kind: 'sombra', n: 3 }], [{ kind: 'chefe', n: 1 }]], bossScale: 1 },
  { id: 'fenda4', name: 'Fenda IV — Monarca de Cinzas', desc: 'Exige rank C. Um chefe enfurecido e ondas mistas.', minRankIndex: 2, firstXp: 250, waves: [[{ kind: 'bruto', n: 2 }, { kind: 'atirador', n: 2 }], [{ kind: 'sombra', n: 6 }, { kind: 'atirador', n: 2 }], [{ kind: 'chefe', n: 1 }]], bossScale: 2.2 },
];

export const ARENA_RADIUS = 13;

export function computeCombatStats(s: GameState): CombatStats {
  const t = totals(s.ledger);
  const level = levelFromXp(t.xp).level;
  const a = (k: keyof typeof t.attrs) => attrLevel(t.attrs[k]).level;
  const st: CombatStats = {
    hp: 120 + level * 6 + a('resistencia') * 4 + a('autocuidado') * 2,
    atk: 12 + level * 1.2 + a('forca') * 1.5 + a('inteligencia') * 0.5,
    def: 2 + level * 0.4 + a('resistencia') * 0.8,
    spd: 6 + Math.min(2, a('condicionamento') * 0.08),
    crit: 0.05 + Math.min(0.15, a('concentracao') * 0.01),
    energyRegen: 4 + a('disciplina') * 0.2,
    maxEnergy: 100,
  };
  for (const id of Object.values(s.character.equipped)) {
    const e = id ? ITEM_MAP[id]?.effect : undefined;
    if (!e) continue;
    st.atk += e.atk ?? 0; st.def += e.def ?? 0; st.hp += e.hp ?? 0; st.spd += (e.spd ?? 0) * 0.15; st.maxEnergy += e.energy ?? 0;
  }
  for (const [id, rank] of Object.entries(s.skills)) {
    const p = SKILL_MAP[id]?.passive;
    if (!p || !rank) continue;
    st.atk += (p.atk ?? 0) * rank; st.def += (p.def ?? 0) * rank; st.hp += (p.hp ?? 0) * rank;
    st.spd *= 1 + ((p.spd ?? 0) * rank) / 100; st.crit += ((p.crit ?? 0) * rank) / 100; st.energyRegen *= 1 + ((p.energyRegen ?? 0) * rank) / 100;
  }
  st.hp = Math.round(st.hp); st.atk = Math.round(st.atk); st.def = Math.round(st.def);
  return st;
}

export function activeSkills(s: GameState): SkillSlot[] {
  return Object.entries(s.skills)
    .filter(([id, r]) => r > 0 && SKILL_MAP[id]?.active)
    .map(([id, rank]) => { const d = SKILL_MAP[id]; return { id, kind: d.active!.kind, name: d.name, rank, energy: d.active!.energy, cooldown: d.active!.cooldown }; })
    .sort((a, b) => b.rank - a.rank || SKILL_MAP[b.id].reqLevel - SKILL_MAP[a.id].reqLevel)
    .slice(0, 2);
}

export interface Input { moveX: number; moveZ: number; attack?: boolean; heavy?: boolean; dodge?: boolean; skill1?: boolean; skill2?: boolean }

export interface CombatState {
  t: number; status: 'playing' | 'won' | 'lost'; dungeon: DungeonDef; wave: number; waveDelay: number;
  stats: CombatStats; skills: SkillSlot[];
  player: { pos: V2; facing: number; hp: number; energy: number; action: PlayerAction; actionT: number; actionDur: number; combo: number; comboWindow: number; iframes: number; shieldT: number; dodgeCd: number; hitDone: boolean; cooldowns: number[]; dashDir: V2; skillKind?: SkillSlot['kind'] };
  enemies: Enemy[]; projectiles: Projectile[]; fx: Fx[]; texts: FloatText[];
  kills: number; damageDealt: number; damageTaken: number; nextId: number; rng: () => number; shake: number;
  log: string[];
}

const len = (v: V2) => Math.hypot(v.x, v.z);
const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, z: a.z - b.z });
const angleTo = (from: V2, to: V2) => Math.atan2(to.x - from.x, to.z - from.z);
const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
const fwd = (ang: number): V2 => ({ x: Math.sin(ang), z: Math.cos(ang) });

const ENEMY_BASE: Record<EnemyKind, { hp: number; atk: number; spd: number }> = {
  sombra: { hp: 45, atk: 9, spd: 3.3 },
  bruto: { hp: 150, atk: 20, spd: 2.1 },
  atirador: { hp: 55, atk: 11, spd: 2.6 },
  chefe: { hp: 700, atk: 22, spd: 2.6 },
};

export function createCombat(dungeon: DungeonDef, stats: CombatStats, skills: SkillSlot[], seed = 1): CombatState {
  let h = seed >>> 0 || 1;
  const rng = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  const s: CombatState = {
    t: 0, status: 'playing', dungeon, wave: -1, waveDelay: 1.2, stats, skills,
    player: { pos: { x: 0, z: -4 }, facing: 0, hp: stats.hp, energy: 30, action: 'idle', actionT: 0, actionDur: 0, combo: 0, comboWindow: 0, iframes: 0, shieldT: 0, dodgeCd: 0, hitDone: false, cooldowns: skills.map(() => 0), dashDir: { x: 0, z: 1 } },
    enemies: [], projectiles: [], fx: [], texts: [], kills: 0, damageDealt: 0, damageTaken: 0, nextId: 1, rng, shake: 0, log: [],
  };
  return s;
}

function spawnWave(s: CombatState) {
  s.wave += 1;
  const def = s.dungeon.waves[s.wave];
  if (!def) return;
  const scale = 1 + s.wave * 0.08;
  for (const group of def) {
    for (let i = 0; i < group.n; i++) {
      const b = ENEMY_BASE[group.kind];
      const bossMul = group.kind === 'chefe' ? (s.dungeon.bossScale ?? 1) : 1;
      const ang = s.rng() * Math.PI * 2;
      const r = group.kind === 'chefe' ? 7 : 8 + s.rng() * 3;
      const hp = Math.round(b.hp * scale * bossMul);
      s.enemies.push({ id: s.nextId++, kind: group.kind, pos: { x: Math.sin(ang) * r, z: Math.cos(ang) * r + 2 }, facing: 0, hp, maxHp: hp, atk: b.atk * (group.kind === 'chefe' ? Math.sqrt(bossMul) : scale), spd: b.spd, state: 'recover', stateT: 0.6 + s.rng() * 0.6, rootedT: 0, hitFlash: 0, summonT: 6, deadT: 0 });
    }
  }
  s.log.push(def.some((g) => g.kind === 'chefe') ? 'Um CHEFE emerge da Fenda!' : `Onda ${s.wave + 1}/${s.dungeon.waves.length}`);
}

function addFx(s: CombatState, fx: Omit<Fx, 'id' | 't'>) { s.fx.push({ ...fx, id: s.nextId++, t: 0 }); }
function addText(s: CombatState, pos: V2, text: string, color: string, big = false) { s.texts.push({ id: s.nextId++, pos: { ...pos }, text, t: 0, color, big }); }

function damageEnemy(s: CombatState, e: Enemy, raw: number, forceCrit = false) {
  if (e.state === 'dead') return;
  const crit = forceCrit || s.rng() < s.stats.crit;
  const dmg = Math.max(1, Math.round(raw * (crit ? 1.8 : 1) * (0.92 + s.rng() * 0.16)));
  e.hp -= dmg;
  e.hitFlash = 0.15;
  s.damageDealt += dmg;
  s.player.energy = Math.min(s.stats.maxEnergy, s.player.energy + (crit ? 6 : 4));
  addText(s, e.pos, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd166' : '#ffffff', crit);
  // Interrompe inimigos comuns no meio do ataque (chefes têm "super armor")
  if (e.kind === 'sombra' && e.state === 'windup' && dmg > e.maxHp * 0.25) { e.state = 'recover'; e.stateT = 0.5; }
  if (e.hp <= 0) {
    e.hp = 0; e.state = 'dead'; e.deadT = 0; s.kills += 1;
    addFx(s, { kind: 'burst', pos: { ...e.pos }, life: 0.6, radius: e.kind === 'chefe' ? 4 : 1.5, color: e.kind === 'chefe' ? '#ff4d8d' : '#9b7bff' });
    if (e.kind === 'chefe') { s.shake = 0.8; s.log.push('CHEFE DERROTADO'); }
  }
}

function damagePlayer(s: CombatState, raw: number) {
  const p = s.player;
  if (p.iframes > 0 || p.action === 'dead' || s.status !== 'playing') return;
  let dmg = raw * (1 - s.stats.def / (s.stats.def + 45));
  if (p.shieldT > 0) dmg *= 0.3;
  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg;
  s.damageTaken += dmg;
  s.shake = Math.max(s.shake, 0.25);
  addText(s, p.pos, `-${dmg}`, '#ff5d73');
  if (p.hp <= 0) { p.hp = 0; p.action = 'dead'; p.actionT = 0; s.status = 'lost'; s.log.push('Você caiu. Levante-se e tente de novo.'); return; }
  if (p.action === 'idle' || p.action === 'run') { p.action = 'hit'; p.actionT = 0; p.actionDur = 0.25; }
  p.iframes = 0.35;
}

function meleeHit(s: CombatState, range: number, arc: number, mult: number) {
  const p = s.player;
  for (const e of s.enemies) {
    if (e.state === 'dead') continue;
    const d = len(sub(e.pos, p.pos));
    const r = range + (e.kind === 'chefe' ? 0.9 : e.kind === 'bruto' ? 0.4 : 0);
    if (d <= r && (d < 0.8 || angDiff(angleTo(p.pos, e.pos), p.facing) <= arc / 2)) damageEnemy(s, e, s.stats.atk * mult);
  }
}

function nearestEnemy(s: CombatState, maxDist = 99): Enemy | undefined {
  let best: Enemy | undefined; let bd = maxDist;
  for (const e of s.enemies) { if (e.state === 'dead') continue; const d = len(sub(e.pos, s.player.pos)); if (d < bd) { bd = d; best = e; } }
  return best;
}

function useSkill(s: CombatState, idx: number) {
  const p = s.player;
  const sk = s.skills[idx];
  if (!sk || p.cooldowns[idx] > 0 || p.energy < sk.energy) return;
  p.energy -= sk.energy;
  p.cooldowns[idx] = sk.cooldown;
  const mult = 1 + 0.25 * (sk.rank - 1);
  p.action = 'skill'; p.actionT = 0; p.actionDur = 0.45; p.skillKind = sk.kind; p.hitDone = true;
  const atk = s.stats.atk;
  switch (sk.kind) {
    case 'investida': {
      const dir = fwd(p.facing);
      const start = { ...p.pos };
      const end = clampArena({ x: p.pos.x + dir.x * 5.5, z: p.pos.z + dir.z * 5.5 });
      for (const e of s.enemies) {
        if (e.state === 'dead') continue;
        const ap = sub(e.pos, start); const ab = sub(end, start); const l2 = ab.x * ab.x + ab.z * ab.z || 1;
        const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.z * ab.z) / l2));
        const closest = { x: start.x + ab.x * t, z: start.z + ab.z * t };
        if (len(sub(e.pos, closest)) < 1.5) damageEnemy(s, e, atk * 3 * mult);
      }
      p.pos = end; p.iframes = 0.45;
      addFx(s, { kind: 'dash', pos: start, life: 0.4, radius: 5.5, color: '#ff5d73', angle: p.facing });
      break;
    }
    case 'giro':
      for (const e of s.enemies) if (e.state !== 'dead' && len(sub(e.pos, p.pos)) < 3.4) damageEnemy(s, e, atk * 2.6 * mult);
      addFx(s, { kind: 'ring', pos: { ...p.pos }, life: 0.45, radius: 3.4, color: '#ff5d73' });
      break;
    case 'lanca': {
      const t = nearestEnemy(s, 14);
      if (t) p.facing = angleTo(p.pos, t.pos);
      const dir = fwd(p.facing);
      s.projectiles.push({ id: s.nextId++, pos: { x: p.pos.x + dir.x, z: p.pos.z + dir.z }, vel: { x: dir.x * 20, z: dir.z * 20 }, dmg: atk * 2.3 * mult, from: 'player', life: 1.2, pierce: true, hit: [], radius: 0.8 });
      break;
    }
    case 'escudo':
      p.shieldT = 3.5 + sk.rank * 0.5;
      addFx(s, { kind: 'shield', pos: { ...p.pos }, life: p.shieldT, radius: 1.4, color: '#5fd38d' });
      break;
    case 'explosao':
      for (const e of s.enemies) if (e.state !== 'dead' && len(sub(e.pos, p.pos)) < 5.5) damageEnemy(s, e, atk * 4 * mult);
      addFx(s, { kind: 'ring', pos: { ...p.pos }, life: 0.7, radius: 5.5, color: '#4cc9ff' });
      s.shake = 0.4;
      break;
    case 'sombra': {
      const t = nearestEnemy(s, 10);
      if (t) {
        const back = fwd(t.facing);
        addFx(s, { kind: 'burst', pos: { ...p.pos }, life: 0.35, radius: 1, color: '#9b7bff' });
        p.pos = clampArena({ x: t.pos.x - back.x * 1.4, z: t.pos.z - back.z * 1.4 });
        p.facing = angleTo(p.pos, t.pos);
        damageEnemy(s, t, atk * 3.5 * mult, true);
        p.iframes = 0.4;
      }
      break;
    }
    case 'cura': {
      const heal = Math.round(s.stats.hp * (0.3 + 0.05 * sk.rank));
      p.hp = Math.min(s.stats.hp, p.hp + heal);
      addText(s, p.pos, `+${heal}`, '#5fd38d', true);
      addFx(s, { kind: 'heal', pos: { ...p.pos }, life: 0.8, radius: 1.6, color: '#5fd38d' });
      break;
    }
    case 'armadilha':
      for (const e of s.enemies) if (e.state !== 'dead' && len(sub(e.pos, p.pos)) < 4.5) { e.rootedT = 2.5 + sk.rank * 0.5; damageEnemy(s, e, atk * 0.8 * mult); }
      addFx(s, { kind: 'root', pos: { ...p.pos }, life: 0.8, radius: 4.5, color: '#ffd166' });
      break;
  }
}

function clampArena(v: V2): V2 {
  const d = len(v);
  if (d <= ARENA_RADIUS) return v;
  return { x: (v.x / d) * ARENA_RADIUS, z: (v.z / d) * ARENA_RADIUS };
}

export function stepCombat(s: CombatState, input: Input, dt: number) {
  dt = Math.min(dt, 0.05);
  s.t += dt;
  s.shake = Math.max(0, s.shake - dt * 2);
  for (const f of s.fx) f.t += dt;
  s.fx = s.fx.filter((f) => f.t < f.life);
  for (const tx of s.texts) tx.t += dt;
  s.texts = s.texts.filter((tx) => tx.t < 0.9);
  const p = s.player;

  if (s.status !== 'playing') {
    p.actionT += dt;
    for (const e of s.enemies) if (e.state === 'dead') e.deadT += dt;
    return;
  }

  // Ondas
  const alive = s.enemies.filter((e) => e.state !== 'dead');
  if (!alive.length) {
    if (s.wave + 1 >= s.dungeon.waves.length) {
      s.status = 'won'; p.action = 'victory'; p.actionT = 0; s.log.push('FENDA FECHADA'); return;
    }
    s.waveDelay -= dt;
    if (s.waveDelay <= 0) { spawnWave(s); s.waveDelay = 1.6; }
  }

  // Jogador
  p.iframes = Math.max(0, p.iframes - dt);
  p.shieldT = Math.max(0, p.shieldT - dt);
  p.dodgeCd = Math.max(0, p.dodgeCd - dt);
  p.comboWindow = Math.max(0, p.comboWindow - dt);
  p.cooldowns = p.cooldowns.map((c) => Math.max(0, c - dt));
  p.energy = Math.min(s.stats.maxEnergy, p.energy + s.stats.energyRegen * dt);
  const mv = { x: input.moveX, z: input.moveZ };
  const ml = Math.min(1, len(mv));
  const busy = ['attack', 'heavy', 'dodge', 'skill', 'hit'].includes(p.action);

  if (busy) {
    p.actionT += dt;
    if (p.action === 'dodge') {
      p.pos = clampArena({ x: p.pos.x + p.dashDir.x * 15 * dt, z: p.pos.z + p.dashDir.z * 15 * dt });
    }
    if ((p.action === 'attack' || p.action === 'heavy') && !p.hitDone && p.actionT >= p.actionDur * (p.action === 'heavy' ? 0.6 : 0.4)) {
      p.hitDone = true;
      if (p.action === 'heavy') { meleeHit(s, 2.9, Math.PI * 0.85, 2.4); addFx(s, { kind: 'slash', pos: { ...p.pos }, life: 0.25, radius: 2.9, color: '#ffb547', angle: p.facing }); s.shake = Math.max(s.shake, 0.15); }
      else { const mult = [1, 1.15, 1.7][p.combo] ?? 1; meleeHit(s, 2.3, Math.PI * 0.6, mult); addFx(s, { kind: 'slash', pos: { ...p.pos }, life: 0.2, radius: 2.3, color: p.combo === 2 ? '#ffd166' : '#9be7ff', angle: p.facing + (p.combo % 2 ? 0.5 : -0.5) }); }
    }
    // pequeno avanço ao atacar
    if (p.action === 'attack' || p.action === 'heavy') {
      const f = fwd(p.facing);
      const push = p.actionT < p.actionDur * 0.4 ? 2.5 : 0;
      p.pos = clampArena({ x: p.pos.x + f.x * push * dt, z: p.pos.z + f.z * push * dt });
    }
    if (p.actionT >= p.actionDur) {
      if (p.action === 'attack') { p.comboWindow = 0.45; p.combo = (p.combo + 1) % 3; }
      p.action = 'idle';
    }
  }

  if (!['attack', 'heavy', 'dodge', 'skill', 'hit'].includes(p.action)) {
    if (input.dodge && p.dodgeCd <= 0) {
      p.action = 'dodge'; p.actionT = 0; p.actionDur = 0.32; p.iframes = 0.38; p.dodgeCd = 0.55;
      p.dashDir = ml > 0.1 ? { x: mv.x / (len(mv) || 1), z: mv.z / (len(mv) || 1) } : fwd(p.facing + Math.PI);
      addFx(s, { kind: 'dash', pos: { ...p.pos }, life: 0.3, radius: 4.5, color: '#9b7bff', angle: Math.atan2(p.dashDir.x, p.dashDir.z) });
    } else if (input.skill1) useSkill(s, 0);
    else if (input.skill2) useSkill(s, 1);
    else if (input.attack || input.heavy) {
      const t = nearestEnemy(s, 4);
      if (ml > 0.1) p.facing = Math.atan2(mv.x, mv.z);
      else if (t) p.facing = angleTo(p.pos, t.pos);
      if (!p.comboWindow) p.combo = 0;
      p.action = input.heavy ? 'heavy' : 'attack';
      p.actionT = 0; p.hitDone = false;
      p.actionDur = input.heavy ? 0.7 : p.combo === 2 ? 0.42 : 0.3;
      if (input.heavy) p.combo = 0;
    } else if (ml > 0.1) {
      p.action = 'run';
      p.facing = Math.atan2(mv.x, mv.z);
      p.pos = clampArena({ x: p.pos.x + (mv.x / Math.max(1, len(mv))) * s.stats.spd * dt, z: p.pos.z + (mv.z / Math.max(1, len(mv))) * s.stats.spd * dt });
    } else p.action = 'idle';
  }

  // Inimigos
  const bossEnraged = (e: Enemy) => e.kind === 'chefe' && e.hp / e.maxHp < 0.3;
  for (const e of s.enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.state === 'dead') { e.deadT += dt; continue; }
    e.rootedT = Math.max(0, e.rootedT - dt);
    e.stateT -= dt;
    const toP = sub(p.pos, e.pos);
    const d = len(toP);
    const speedMul = bossEnraged(e) ? 1.4 : 1;
    const reach = e.kind === 'chefe' ? 3 : e.kind === 'bruto' ? 2.3 : 1.7;
    if (e.state === 'chase') {
      e.facing = angleTo(e.pos, p.pos);
      if (e.kind === 'chefe') {
        e.summonT -= dt;
        const phase2 = e.hp / e.maxHp < 0.6;
        if (phase2 && e.summonT <= 0) { e.state = 'windup'; e.attackKind = s.rng() < 0.5 ? 'summon' : 'ring'; e.stateT = 0.9; e.summonT = 7; addFx(s, { kind: 'telegraph', pos: { ...e.pos }, life: 0.9, radius: 2, color: '#ff4d8d' }); continue; }
      }
      const wantDist = e.kind === 'atirador' ? 7 : reach * 0.85;
      if (e.kind === 'atirador' && d < 12 && e.stateT <= 0) {
        e.state = 'windup'; e.attackKind = 'shot'; e.stateT = 0.7; continue;
      }
      if (e.kind !== 'atirador' && d <= reach) {
        e.state = 'windup';
        e.attackKind = e.kind === 'sombra' ? 'melee' : 'slam';
        e.stateT = (e.kind === 'sombra' ? 0.55 : e.kind === 'bruto' ? 0.95 : 0.8) / speedMul;
        addFx(s, { kind: 'telegraph', pos: { ...e.pos }, life: e.stateT, radius: e.attackKind === 'slam' ? (e.kind === 'chefe' ? 3.4 : 2.7) : 1.9, color: '#ff3355', angle: e.facing });
        continue;
      }
      if (e.rootedT <= 0) {
        const dir = d > 0.001 ? { x: toP.x / d, z: toP.z / d } : { x: 0, z: 0 };
        const sign = e.kind === 'atirador' && d < wantDist ? -1 : 1;
        if (!(e.kind === 'atirador' && Math.abs(d - wantDist) < 0.6)) {
          e.pos = clampArena({ x: e.pos.x + dir.x * e.spd * speedMul * sign * dt, z: e.pos.z + dir.z * e.spd * speedMul * sign * dt });
        }
      }
    } else if (e.state === 'windup' && e.stateT <= 0) {
      e.state = 'attack'; e.stateT = 0.15;
      if (e.attackKind === 'melee') { if (d < 2 && angDiff(angleTo(e.pos, p.pos), e.facing) < 1.1) damagePlayer(s, e.atk); }
      else if (e.attackKind === 'slam') { const r = e.kind === 'chefe' ? 3.4 : 2.7; if (d < r) damagePlayer(s, e.atk * 1.2); addFx(s, { kind: 'ring', pos: { ...e.pos }, life: 0.35, radius: r, color: '#ff5d73' }); s.shake = Math.max(s.shake, 0.2); }
      else if (e.attackKind === 'shot') { const dir = d ? { x: toP.x / d, z: toP.z / d } : { x: 0, z: 1 }; s.projectiles.push({ id: s.nextId++, pos: { ...e.pos }, vel: { x: dir.x * 9, z: dir.z * 9 }, dmg: e.atk, from: 'enemy', life: 2.2, pierce: false, hit: [], radius: 0.5 }); }
      else if (e.attackKind === 'ring') { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; s.projectiles.push({ id: s.nextId++, pos: { ...e.pos }, vel: { x: Math.sin(a) * 7, z: Math.cos(a) * 7 }, dmg: e.atk * 0.7, from: 'enemy', life: 2.5, pierce: false, hit: [], radius: 0.55 }); } }
      else if (e.attackKind === 'summon') { for (let i = 0; i < 2; i++) { const b = ENEMY_BASE.sombra; const a = s.rng() * Math.PI * 2; s.enemies.push({ id: s.nextId++, kind: 'sombra', pos: clampArena({ x: e.pos.x + Math.sin(a) * 3, z: e.pos.z + Math.cos(a) * 3 }), facing: 0, hp: b.hp, maxHp: b.hp, atk: b.atk, spd: b.spd, state: 'recover', stateT: 0.8, rootedT: 0, hitFlash: 0, summonT: 0, deadT: 0 }); } s.log.push('O chefe invoca sombras!'); }
    } else if (e.state === 'attack' && e.stateT <= 0) {
      e.state = 'recover'; e.stateT = (e.kind === 'atirador' ? 1.3 : e.kind === 'chefe' ? 0.7 : 0.75) / speedMul;
    } else if (e.state === 'recover' && e.stateT <= 0) {
      e.state = 'chase'; e.stateT = e.kind === 'atirador' ? 1.2 + s.rng() : 0;
    }
  }
  // Separação entre inimigos e do jogador
  for (const a of s.enemies) {
    if (a.state === 'dead') continue;
    const ra = a.kind === 'chefe' ? 1.6 : a.kind === 'bruto' ? 1 : 0.6;
    for (const b of s.enemies) {
      if (b === a || b.state === 'dead') continue;
      const rb = b.kind === 'chefe' ? 1.6 : b.kind === 'bruto' ? 1 : 0.6;
      const v = sub(a.pos, b.pos); const d = len(v) || 0.01;
      if (d < ra + rb) { const push = (ra + rb - d) * 0.5; a.pos.x += (v.x / d) * push; a.pos.z += (v.z / d) * push; }
    }
    const v = sub(a.pos, p.pos); const d = len(v) || 0.01;
    if (d < ra + 0.5) { a.pos.x += (v.x / d) * (ra + 0.5 - d); a.pos.z += (v.z / d) * (ra + 0.5 - d); }
  }

  // Projéteis
  for (const pr of s.projectiles) {
    pr.life -= dt;
    pr.pos.x += pr.vel.x * dt; pr.pos.z += pr.vel.z * dt;
    if (pr.from === 'player') {
      for (const e of s.enemies) {
        if (e.state === 'dead' || pr.hit.includes(e.id)) continue;
        if (len(sub(e.pos, pr.pos)) < pr.radius + (e.kind === 'chefe' ? 1.5 : 0.7)) { damageEnemy(s, e, pr.dmg); pr.hit.push(e.id); if (!pr.pierce) pr.life = 0; }
      }
    } else if (len(sub(p.pos, pr.pos)) < pr.radius + 0.5) { damagePlayer(s, pr.dmg); pr.life = 0; }
    if (len(pr.pos) > ARENA_RADIUS + 2) pr.life = 0;
  }
  s.projectiles = s.projectiles.filter((x) => x.life > 0);
}
