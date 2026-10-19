import { describe, expect, it } from 'vitest';
import {
  addEvidence, addFinanceEntry, addFinanceGoal, addWorkout, completeMission, createCampaign, createMission, equipItem,
  effectiveStreak, learnSkill, newGame, owns, playerLevel, registerActivity, replanOverdue, skillPoints, toggleStep, bossProgress,
  type Ev,
} from '../../src/core/engine';
import { levelFromXp, missionXp, totals, xpToNext, computeRank, rankContext, distributeAttrXp } from '../../src/core/progression';
import { mergeStates, migrate, forCloud } from '../../src/core/save';
import { validateAiCampaign, offlineReply } from '../../src/core/gm';
import { masteryLevel } from '../../src/data/knowledge';
import { LEVEL_REWARDS } from '../../src/data/items';
import { createCombat, stepCombat, DUNGEONS, computeCombatStats } from '../../src/core/combat';
import type { GameState } from '../../src/core/types';

const D = (s: string, h = 12) => new Date(`${s}T${String(h).padStart(2, '0')}:00:00`);

function game(): GameState {
  const s = newGame(D('2026-10-01'));
  s.onboarded = true;
  return s;
}

describe('XP e níveis', () => {
  it('curva de níveis cresce e é coerente', () => {
    expect(xpToNext(1)).toBe(150);
    expect(xpToNext(10)).toBeGreaterThan(xpToNext(5));
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(150).level).toBe(2);
    expect(levelFromXp(149).level).toBe(1);
  });

  it('calcula XP de missão com bônus de consistência limitado', () => {
    expect(missionXp('principal', 3, 0).total).toBe(35);
    expect(missionXp('principal', 3, 5).total).toBe(35 + Math.round(35 * 0.1));
    expect(missionXp('principal', 3, 50).bonus).toBe(Math.round(35 * 0.2)); // teto 20%
    expect(missionXp('rapida', 1, 0).total).toBe(6);
    expect(missionXp('lendaria', 5, 0).total).toBe(320);
  });

  it('uma atividade afeta no máximo 3 atributos', () => {
    const out = distributeAttrXp(100, { forca: 3, resistencia: 2, disciplina: 1, organizacao: 1, financas: 1 });
    expect(Object.keys(out)).toHaveLength(3);
    expect(out.forca).toBeGreaterThan(out.resistencia!);
  });

  it('concluir missão concede XP correto ao jogador e aos atributos certos', () => {
    const s = game(); const ev: Ev = [];
    const m = createMission(s, ev, { title: 'Treino A', type: 'principal', difficulty: 3, recurrence: 'unica', attrs: { forca: 2, resistencia: 1 } })!;
    expect(completeMission(s, ev, m.id, D('2026-10-02'))).toBe(true);
    const missionEntry = s.ledger.find((e) => e.id.startsWith('mission:'))!;
    expect(missionEntry.xp).toBe(35);
    expect(missionEntry.attrs.forca).toBe(23);
    expect(missionEntry.attrs.resistencia).toBe(12);
    expect(missionEntry.attrs.inteligencia).toBeUndefined();
  });

  it('NÃO concede XP duplicado pela mesma conclusão', () => {
    const s = game(); const ev: Ev = [];
    const m = createMission(s, ev, { title: 'Ler', type: 'rapida', difficulty: 1, recurrence: 'unica', attrs: { conhecimento: 1 } })!;
    completeMission(s, ev, m.id, D('2026-10-02'));
    const xp1 = totals(s.ledger).xp;
    expect(completeMission(s, ev, m.id, D('2026-10-02'))).toBe(false);
    expect(completeMission(s, ev, m.id, D('2026-10-05'))).toBe(false);
    expect(totals(s.ledger).xp).toBe(xp1);
  });

  it('missão diária: 1 vez por dia, de novo no dia seguinte', () => {
    const s = game(); const ev: Ev = [];
    const m = createMission(s, ev, { title: 'Água', type: 'rapida', difficulty: 1, recurrence: 'diaria', attrs: { autocuidado: 1 } })!;
    expect(completeMission(s, ev, m.id, D('2026-10-02'))).toBe(true);
    expect(completeMission(s, ev, m.id, D('2026-10-02', 20))).toBe(false);
    expect(completeMission(s, ev, m.id, D('2026-10-03'))).toBe(true);
    expect(s.ledger.filter((e) => e.id.startsWith(`mission:${m.id}`))).toHaveLength(2);
  });

  it('etapas: marcar/desmarcar/marcar não gera XP repetido', () => {
    const s = game(); const ev: Ev = [];
    const m = createMission(s, ev, { title: 'Projeto', type: 'principal', difficulty: 4, recurrence: 'unica', attrs: { inteligencia: 2 }, steps: ['a', 'b'] })!;
    const st = m.steps[0].id;
    toggleStep(s, ev, m.id, st, D('2026-10-02'));
    toggleStep(s, ev, m.id, st, D('2026-10-02'));
    toggleStep(s, ev, m.id, st, D('2026-10-02'));
    expect(s.ledger.filter((e) => e.source === 'etapa')).toHaveLength(1);
    expect(completeMission(s, ev, m.id, D('2026-10-02'))).toBe(false); // falta etapa b
  });

  it('subir de nível entrega a recompensa prevista (nível 2 → Luvas da Forja)', () => {
    const s = game(); const ev: Ev = [];
    expect(LEVEL_REWARDS[2]).toBe('luvas_forja');
    expect(owns(s, 'luvas_forja')).toBe(false);
    for (let i = 0; i < 6; i++) {
      const m = createMission(s, ev, { title: `M${i}`, type: 'principal', difficulty: 4, recurrence: 'unica', attrs: { disciplina: 1 } })!;
      completeMission(s, ev, m.id, D('2026-10-02'));
    }
    expect(playerLevel(s)).toBeGreaterThanOrEqual(2);
    expect(owns(s, 'luvas_forja')).toBe(true);
    expect(ev.some((e) => e.kind === 'levelup')).toBe(true);
    equipItem(s, ev, 'luvas_forja');
    expect(s.character.equipped.luvas).toBe('luvas_forja');
  });

  it('não permite equipar item que não possui', () => {
    const s = game(); const ev: Ev = [];
    equipItem(s, ev, 'espada_aurora');
    expect(s.character.equipped.arma).toBe('adaga_iniciado');
    expect(ev.at(-1)?.kind).toBe('error');
  });
});

describe('Sequência sem punição permanente', () => {
  it('quebrar sequência mantém a melhor e não remove XP/itens', () => {
    const s = game(); const ev: Ev = [];
    for (let d = 1; d <= 5; d++) registerActivity(s, ev, D(`2026-10-0${d}`));
    expect(s.streak.current).toBe(5);
    const xp = totals(s.ledger).xp;
    registerActivity(s, ev, D('2026-10-12'));
    expect(s.streak.current).toBe(1);
    expect(s.streak.best).toBe(5);
    expect(totals(s.ledger).xp).toBe(xp);
  });

  it('escudo de consistência protege um dia perdido', () => {
    const s = game(); const ev: Ev = [];
    for (let d = 1; d <= 7; d++) registerActivity(s, ev, D(`2026-10-0${d}`));
    expect(s.streak.shields).toBe(1);
    registerActivity(s, ev, D('2026-10-09')); // pulou dia 8
    expect(s.streak.current).toBe(8);
    expect(s.streak.shields).toBe(0);
    expect(effectiveStreak(s, D('2026-10-10'))).toBe(8);
  });
});

describe('Reorganização de missões atrasadas', () => {
  it('redistribui atrasadas respeitando capacidade diária', () => {
    const s = game(); const ev: Ev = [];
    s.settings.dailyCapacity = 2;
    for (let i = 0; i < 5; i++) createMission(s, ev, { title: `Atrasada ${i}`, type: 'principal', difficulty: 2, recurrence: 'unica', attrs: { disciplina: 1 }, deadline: '2026-10-01' });
    const n = replanOverdue(s, ev, D('2026-10-10'));
    expect(n).toBe(5);
    const byDay: Record<string, number> = {};
    for (const m of s.missions) byDay[m.deadline!] = (byDay[m.deadline!] ?? 0) + 1;
    expect(Object.values(byDay).every((c) => c <= 2)).toBe(true);
    expect(s.missions.every((m) => m.deadline! >= '2026-10-10')).toBe(true);
  });
});

describe('Campanhas e chefes', () => {
  it('cria campanha a partir de objetivo livre e derrota o chefe só com etapas reais', () => {
    const s = game(); const ev: Ev = [];
    const c = createCampaign(s, ev, 'Quero aprender programação backend', D('2026-10-02'))!;
    expect(c.title).toBe('O Guardião do Código');
    const boss = s.bosses.find((b) => b.id === c.bossId)!;
    expect(bossProgress(boss, s.missions).hp).toBe(1);
    const phaseMissions = boss.phases.flatMap((p) => p.missionIds);
    for (const id of phaseMissions) {
      const m = s.missions.find((x) => x.id === id)!;
      for (const st of m.steps) toggleStep(s, ev, m.id, st.id, D('2026-10-03'));
      completeMission(s, ev, id, D('2026-10-03'));
    }
    expect(s.bosses[0].defeatedAt).toBeTruthy();
    expect(s.campaigns[0].status).toBe('concluida');
    expect(ev.some((e) => e.kind === 'boss_defeated')).toBe(true);
    expect(s.achievements['chefe_1']).toBeTruthy();
  });

  it('objetivo genérico também vira campanha', () => {
    const s = game(); const ev: Ev = [];
    const c = createCampaign(s, ev, 'Quero tocar violão', D('2026-10-02'))!;
    expect(c.missionIds.length).toBeGreaterThan(3);
  });
});

describe('Conhecimento real', () => {
  it('assistir aula não domina habilidade; exige prática + projeto', () => {
    const s = game(); const ev: Ev = [];
    for (let i = 0; i < 10; i++) addEvidence(s, ev, 'k_logica', { type: 'licao', note: 'vídeo' }, D('2026-10-02'));
    const n = () => s.knowledge.find((k) => k.id === 'k_logica')!;
    expect(masteryLevel(n())).toBe(1);
    addEvidence(s, ev, 'k_logica', { type: 'projeto', note: 'calculadora' }, D('2026-10-03'));
    expect(masteryLevel(n())).toBe(1);
    addEvidence(s, ev, 'k_logica', { type: 'teste', note: 'prova', score: 85 }, D('2026-10-04'));
    expect(masteryLevel(n())).toBe(4);
    expect(s.ledger.some((e) => e.id === 'mastery:k_logica')).toBe(true);
  });
});

describe('Treino e finanças', () => {
  it('registra treino, detecta recorde e limita XP diário', () => {
    const s = game(); const ev: Ev = [];
    addWorkout(s, ev, { date: '2026-10-02', exercises: [{ name: 'Supino', sets: [{ reps: 8, kg: 40 }] }], durationMin: 45, rpe: 7, notes: '' }, D('2026-10-02'));
    ev.length = 0;
    addWorkout(s, ev, { date: '2026-10-04', exercises: [{ name: 'supino', sets: [{ reps: 6, kg: 45 }] }], durationMin: 45, rpe: 8, notes: '' }, D('2026-10-04'));
    expect(ev.some((e) => e.kind === 'pr')).toBe(true);
    addWorkout(s, ev, { date: '2026-10-04', exercises: [{ name: 'Remada', sets: [{ reps: 6, kg: 45 }] }], durationMin: 30, rpe: 8, notes: '' }, D('2026-10-04', 14));
    addWorkout(s, ev, { date: '2026-10-04', exercises: [{ name: 'Rosca', sets: [{ reps: 6, kg: 10 }] }], durationMin: 30, rpe: 9, notes: '' }, D('2026-10-04', 16));
    expect(s.ledger.filter((e) => e.source === 'treino' && e.day === '2026-10-04')).toHaveLength(2);
  });

  it('meta financeira concluída concede bônus uma única vez', () => {
    const s = game(); const ev: Ev = [];
    addFinanceGoal(s, ev, 'Notebook', 1000);
    const g = s.finance.goals[0].id;
    addFinanceEntry(s, ev, { date: '2026-10-02', amount: 600, kind: 'economia', goalId: g, note: '' }, D('2026-10-02'));
    addFinanceEntry(s, ev, { date: '2026-10-03', amount: 500, kind: 'economia', goalId: g, note: '' }, D('2026-10-03'));
    addFinanceEntry(s, ev, { date: '2026-10-04', amount: 10, kind: 'economia', goalId: g, note: '' }, D('2026-10-04'));
    expect(s.ledger.filter((e) => e.id === `fingoal:${g}`)).toHaveLength(1);
  });
});

describe('Ranks e talentos', () => {
  it('rank E no início e critérios objetivos', () => {
    const s = game();
    expect(computeRank(s.settings.rankRules, rankContext(s)).rank).toBe('E');
  });

  it('talentos respeitam pontos, nível e pré-requisito', () => {
    const s = game(); const ev: Ev = [];
    expect(skillPoints(s).free).toBe(1);
    learnSkill(s, ev, 'investida');
    expect(s.skills.investida).toBeUndefined();
    learnSkill(s, ev, 'lamina_afiada');
    expect(s.skills.lamina_afiada).toBe(1);
    learnSkill(s, ev, 'lamina_afiada');
    expect(s.skills.lamina_afiada).toBe(1); // sem pontos
  });
});

describe('Salvamento e sincronização', () => {
  it('migra save antigo sem perder dados', () => {
    const s = game();
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.settings.ai; delete raw.arena;
    const m = migrate(raw);
    expect(m.settings.ai.dailyLimit).toBe(20);
    expect(m.arena).toEqual([]);
  });

  it('mesclar dois dispositivos não duplica nem perde XP', () => {
    const base = game(); const ev: Ev = [];
    const m = createMission(base, ev, { title: 'Comum', type: 'principal', difficulty: 2, recurrence: 'diaria', attrs: { disciplina: 1 } })!;
    const phone = structuredClone(base); const cloud = structuredClone(base);
    completeMission(phone, ev, m.id, D('2026-10-02'));
    completeMission(cloud, ev, m.id, D('2026-10-02')); // mesmo dia nos dois → mesma chave
    completeMission(cloud, ev, m.id, D('2026-10-03'));
    const merged = mergeStates(phone, cloud);
    const missionEntries = merged.ledger.filter((e) => e.id.startsWith(`mission:${m.id}`));
    expect(missionEntries).toHaveLength(2);
    expect(merged.missions.find((x) => x.id === m.id)!.completedPeriods.sort()).toEqual(['2026-10-02', '2026-10-03']);
  });

  it('dados enviados à nuvem não contêm fotos nem chaves', () => {
    const s = game();
    s.character.appearance.photo = 'data:image/png;base64,AAA';
    s.settings.ai.apiKey = 'sk-secret';
    const c = forCloud(s);
    expect(c.character.appearance.photo).toBeUndefined();
    expect(c.settings.ai.apiKey).toBe('');
  });
});

describe('SISTEMA (IA) — validação', () => {
  it('campanha da IA é saneada: atributos inválidos, tipos e excesso removidos', () => {
    const r = validateAiCampaign({
      title: 'X', boss: { name: 'B', theme: 'inexistente' },
      phases: [{ name: 'F1', missions: [
        { title: 'ok', type: 'lendaria', difficulty: 99, attrs: { forca: 9, hack: 5, a: 1, inteligencia: 1, disciplina: 1, financas: 1 }, days: 2, xp: 999999 },
      ] }],
    }, 'meta');
    expect(r.ok).toBe(true);
    if (r.ok) {
      const m = r.tpl.phases[0].missions[0];
      expect(m.difficulty).toBe(5);
      expect(m.type).toBe('principal'); // lendária com prazo de 2 dias é rebaixada
      expect(Object.keys(m.attrs).length).toBeLessThanOrEqual(3);
      expect((m as unknown as Record<string, unknown>).xp).toBeUndefined();
      expect(r.tpl.boss.theme).toBe('tempo');
    }
    expect(validateAiCampaign({ phases: [] }, 'x').ok).toBe(false);
  });

  it('modo offline responde e propõe campanha', () => {
    const s = game();
    const r = offlineReply(s, 'criar campanha: economizar para uma moto', 'sistema');
    expect(r.createCampaign).toBe('economizar para uma moto');
    expect(offlineReply(s, 'como o xp é calculado?', 'mentor').reply).toContain('XP');
  });
});

describe('Combate', () => {
  function bot(seed: number, dungeon = DUNGEONS[0]) {
    const s = game();
    const stats = computeCombatStats(s);
    const c = createCombat(dungeon, stats, [], seed);
    let frame = 0;
    while (c.status === 'playing' && c.t < 240) {
      const alive = c.enemies.filter((e) => e.state !== 'dead');
      const t = alive.sort((a, b) => Math.hypot(a.pos.x - c.player.pos.x, a.pos.z - c.player.pos.z) - Math.hypot(b.pos.x - c.player.pos.x, b.pos.z - c.player.pos.z))[0];
      let mx = 0, mz = 0, attack = false, dodge = false;
      if (t) {
        const dx = t.pos.x - c.player.pos.x, dz = t.pos.z - c.player.pos.z; const d = Math.hypot(dx, dz);
        if (d > 1.8) { mx = dx / d; mz = dz / d; } else attack = frame % 2 === 0;
        dodge = alive.some((e) => e.state === 'windup' && Math.hypot(e.pos.x - c.player.pos.x, e.pos.z - c.player.pos.z) < 2.5) && frame % 5 === 0;
      }
      stepCombat(c, { moveX: mx, moveZ: mz, attack, dodge }, 1 / 30);
      frame++;
    }
    return c;
  }

  it('um jogador ativo consegue vencer a Fenda I', () => {
    const c = bot(7);
    expect(c.status).toBe('won');
    expect(c.kills).toBe(8);
  });

  it('ficar parado leva à derrota (há perigo real)', () => {
    const s = game();
    const c = createCombat(DUNGEONS[1], computeCombatStats(s), [], 3);
    while (c.status === 'playing' && c.t < 300) stepCombat(c, { moveX: 0, moveZ: 0 }, 1 / 30);
    expect(c.status).toBe('lost');
  });
});
