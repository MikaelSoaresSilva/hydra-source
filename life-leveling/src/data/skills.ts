// Árvore de talentos de combate/poder. Pontos vêm de níveis (1 por nível) e desafios de domínio.

export interface SkillDef {
  id: string;
  branch: string;
  name: string;
  desc: string;
  maxRank: number;
  cost: number;
  reqLevel: number;
  prereq?: string;
  active?: { energy: number; cooldown: number; kind: 'investida' | 'giro' | 'lanca' | 'escudo' | 'explosao' | 'sombra' | 'cura' | 'armadilha' };
  passive?: { atk?: number; def?: number; hp?: number; spd?: number; energyRegen?: number; crit?: number };
}

export const BRANCHES: Record<string, { name: string; color: string; desc: string }> = {
  lamina: { name: 'Lâmina', color: '#ff5d73', desc: 'Força e combate corpo a corpo.' },
  sombra: { name: 'Sombra', color: '#9b7bff', desc: 'Velocidade e precisão.' },
  arcano: { name: 'Arcano', color: '#4cc9ff', desc: 'Magia e habilidades especiais.' },
  bastiao: { name: 'Bastião', color: '#5fd38d', desc: 'Defesa e resistência.' },
  estrategia: { name: 'Estratégia', color: '#ffd166', desc: 'Suporte, controle e planejamento.' },
};

export const SKILLS: SkillDef[] = [
  { id: 'lamina_afiada', branch: 'lamina', name: 'Lâmina Afiada', desc: '+3 ATK por rank.', maxRank: 3, cost: 1, reqLevel: 1, passive: { atk: 3 } },
  { id: 'investida', branch: 'lamina', name: 'Investida Rubra', desc: 'Avança e golpeia tudo à frente. Ativa.', maxRank: 3, cost: 2, reqLevel: 3, prereq: 'lamina_afiada', active: { energy: 30, cooldown: 4, kind: 'investida' } },
  { id: 'redemoinho', branch: 'lamina', name: 'Redemoinho de Aço', desc: 'Giro que acerta inimigos ao redor. Ativa.', maxRank: 3, cost: 3, reqLevel: 10, prereq: 'investida', active: { energy: 45, cooldown: 7, kind: 'giro' } },

  { id: 'passo_leve', branch: 'sombra', name: 'Passo Leve', desc: '+6% velocidade por rank.', maxRank: 3, cost: 1, reqLevel: 1, passive: { spd: 6 } },
  { id: 'olho_falcao', branch: 'sombra', name: 'Olho de Falcão', desc: '+5% chance de crítico por rank.', maxRank: 3, cost: 1, reqLevel: 4, prereq: 'passo_leve', passive: { crit: 5 } },
  { id: 'danca_sombras', branch: 'sombra', name: 'Dança das Sombras', desc: 'Teleporta atrás do alvo e golpeia. Ativa.', maxRank: 3, cost: 3, reqLevel: 8, prereq: 'olho_falcao', active: { energy: 35, cooldown: 5, kind: 'sombra' } },

  { id: 'mente_clara', branch: 'arcano', name: 'Mente Clara', desc: '+20% regeneração de energia por rank.', maxRank: 3, cost: 1, reqLevel: 1, passive: { energyRegen: 20 } },
  { id: 'lanca_arcana', branch: 'arcano', name: 'Lança Arcana', desc: 'Projétil de energia que atravessa inimigos. Ativa.', maxRank: 3, cost: 2, reqLevel: 3, prereq: 'mente_clara', active: { energy: 25, cooldown: 3, kind: 'lanca' } },
  { id: 'nova', branch: 'arcano', name: 'Nova do Véu', desc: 'Explosão massiva ao redor. Ativa.', maxRank: 3, cost: 3, reqLevel: 12, prereq: 'lanca_arcana', active: { energy: 60, cooldown: 10, kind: 'explosao' } },

  { id: 'pele_ferro', branch: 'bastiao', name: 'Pele de Ferro', desc: '+3 DEF por rank.', maxRank: 3, cost: 1, reqLevel: 1, passive: { def: 3 } },
  { id: 'vitalidade', branch: 'bastiao', name: 'Vitalidade', desc: '+20 HP por rank.', maxRank: 3, cost: 1, reqLevel: 4, prereq: 'pele_ferro', passive: { hp: 20 } },
  { id: 'baluarte', branch: 'bastiao', name: 'Baluarte', desc: 'Escudo que bloqueia dano por alguns segundos. Ativa.', maxRank: 3, cost: 2, reqLevel: 6, prereq: 'vitalidade', active: { energy: 30, cooldown: 9, kind: 'escudo' } },

  { id: 'leitura', branch: 'estrategia', name: 'Leitura de Combate', desc: '+1 DEF e +1 ATK por rank.', maxRank: 3, cost: 1, reqLevel: 1, passive: { def: 1, atk: 1 } },
  { id: 'armadilha', branch: 'estrategia', name: 'Selo de Contenção', desc: 'Prende inimigos próximos no lugar. Ativa.', maxRank: 3, cost: 2, reqLevel: 5, prereq: 'leitura', active: { energy: 30, cooldown: 8, kind: 'armadilha' } },
  { id: 'segundo_folego', branch: 'estrategia', name: 'Segundo Fôlego', desc: 'Recupera vida instantaneamente. Ativa.', maxRank: 3, cost: 3, reqLevel: 9, prereq: 'armadilha', active: { energy: 50, cooldown: 14, kind: 'cura' } },
];

export const SKILL_MAP: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
