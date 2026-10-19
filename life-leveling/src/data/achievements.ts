export interface AchCtx {
  missionsDone: number;
  mainDone: number;
  level: number;
  bestStreak: number;
  bosses: number;
  workouts: number;
  prs: number;
  studyMinutes: number;
  mastered: number;
  saved: number;
  financeGoalsDone: number;
  selfcareDays: number;
  campaignsDone: number;
  arenaWins: number;
  arenaClears: number;
  items: number;
  setsDone: number;
  skillsLearned: number;
  rankIndex: number;
  nightOwl: boolean; // missão concluída entre 0h e 4h
  earlyBird: boolean; // missão concluída antes das 6h
  comeback: boolean; // voltou após 3+ dias parado
  seasonsDone: number;
  epicDone: number;
  attrsAt5: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  secret?: boolean;
  xp: number;
  title?: string;
  itemId?: string;
  check: (c: AchCtx) => boolean;
  progress?: (c: AchCtx) => [number, number];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'primeiro_passo', name: 'Primeiro Passo', desc: 'Conclua sua primeira missão.', xp: 20, title: 'Recém-Desperto', check: (c) => c.missionsDone >= 1, progress: (c) => [c.missionsDone, 1] },
  { id: 'dez_missoes', name: 'Ritmo de Caçada', desc: 'Conclua 10 missões.', xp: 40, check: (c) => c.missionsDone >= 10, progress: (c) => [c.missionsDone, 10] },
  { id: 'cem_missoes', name: 'Centurião', desc: 'Conclua 100 missões.', xp: 200, title: 'Centurião', check: (c) => c.missionsDone >= 100, progress: (c) => [c.missionsDone, 100] },
  { id: 'quinhentas', name: 'Incansável', desc: 'Conclua 500 missões.', xp: 600, title: 'O Incansável', check: (c) => c.missionsDone >= 500, progress: (c) => [c.missionsDone, 500] },
  { id: 'principal_25', name: 'Foco no Essencial', desc: 'Conclua 25 missões principais.', xp: 120, check: (c) => c.mainDone >= 25, progress: (c) => [c.mainDone, 25] },
  { id: 'epica_1', name: 'Saga Pessoal', desc: 'Conclua uma missão épica ou lendária.', xp: 100, check: (c) => c.epicDone >= 1, progress: (c) => [c.epicDone, 1] },
  { id: 'nivel_10', name: 'Dígito Duplo', desc: 'Alcance o nível 10.', xp: 80, check: (c) => c.level >= 10, progress: (c) => [c.level, 10] },
  { id: 'nivel_25', name: 'Veterano do Véu', desc: 'Alcance o nível 25.', xp: 200, title: 'Veterano do Véu', check: (c) => c.level >= 25, progress: (c) => [c.level, 25] },
  { id: 'nivel_50', name: 'Meio do Caminho', desc: 'Alcance o nível 50.', xp: 500, title: 'Portador da Aurora', check: (c) => c.level >= 50, progress: (c) => [c.level, 50] },
  { id: 'seq_7', name: 'Sete Sóis', desc: 'Alcance uma sequência de 7 dias.', xp: 70, itemId: 'emblema_7', check: (c) => c.bestStreak >= 7, progress: (c) => [c.bestStreak, 7] },
  { id: 'seq_30', name: 'Trinta Sóis', desc: 'Alcance uma sequência de 30 dias.', xp: 250, title: 'Inabalável', itemId: 'acessorio_30', check: (c) => c.bestStreak >= 30, progress: (c) => [c.bestStreak, 30] },
  { id: 'seq_60', name: 'Sessenta Sóis', desc: 'Alcance uma sequência de 60 dias.', xp: 500, itemId: 'traje_60', check: (c) => c.bestStreak >= 60, progress: (c) => [c.bestStreak, 60] },
  { id: 'seq_90', name: 'Noventa Sóis', desc: 'Alcance uma sequência de 90 dias.', xp: 900, title: 'Aquele Que Permanece', itemId: 'animacao_90', check: (c) => c.bestStreak >= 90, progress: (c) => [c.bestStreak, 90] },
  { id: 'chefe_1', name: 'Caçador de Chefes', desc: 'Derrote seu primeiro chefe de objetivo.', xp: 150, title: 'Caçador de Chefes', itemId: 'emblema_chefe', check: (c) => c.bosses >= 1, progress: (c) => [c.bosses, 1] },
  { id: 'chefe_3', name: 'Matador de Gigantes', desc: 'Derrote 3 chefes de objetivo.', xp: 350, itemId: 'acessorio_codigo', check: (c) => c.bosses >= 3, progress: (c) => [c.bosses, 3] },
  { id: 'treino_1', name: 'A Forja Acende', desc: 'Registre seu primeiro treino.', xp: 30, check: (c) => c.workouts >= 1, progress: (c) => [c.workouts, 1] },
  { id: 'treino_20', name: 'Ferro e Suor', desc: 'Registre 20 treinos.', xp: 150, title: 'Forjado', check: (c) => c.workouts >= 20, progress: (c) => [c.workouts, 20] },
  { id: 'recorde_5', name: 'Quebrando Limites', desc: 'Bata 5 recordes pessoais de carga.', xp: 120, check: (c) => c.prs >= 5, progress: (c) => [c.prs, 5] },
  { id: 'estudo_10h', name: 'Dez Horas de Vela', desc: 'Some 10 horas de estudo registradas.', xp: 150, check: (c) => c.studyMinutes >= 600, progress: (c) => [Math.floor(c.studyMinutes / 60), 10] },
  { id: 'estudo_100h', name: 'Biblioteca Viva', desc: 'Some 100 horas de estudo.', xp: 700, title: 'Arquivista', check: (c) => c.studyMinutes >= 6000, progress: (c) => [Math.floor(c.studyMinutes / 60), 100] },
  { id: 'dominio_1', name: 'Competência Real', desc: 'Domine uma habilidade da Árvore de Conhecimento (com prática e projeto).', xp: 200, title: 'Artífice', check: (c) => c.mastered >= 1, progress: (c) => [c.mastered, 1] },
  { id: 'financas_1', name: 'Primeira Reserva', desc: 'Registre uma economia.', xp: 30, check: (c) => c.saved > 0 },
  { id: 'financas_meta', name: 'Meta Alcançada', desc: 'Complete uma meta financeira.', xp: 250, title: 'Senhor do Próprio Ouro', check: (c) => c.financeGoalsDone >= 1, progress: (c) => [c.financeGoalsDone, 1] },
  { id: 'autocuidado_14', name: 'Templo do Corpo', desc: 'Registre autocuidado em 14 dias diferentes.', xp: 120, check: (c) => c.selfcareDays >= 14, progress: (c) => [c.selfcareDays, 14] },
  { id: 'campanha_1', name: 'Capítulo Fechado', desc: 'Conclua uma campanha.', xp: 150, check: (c) => c.campaignsDone >= 1, progress: (c) => [c.campaignsDone, 1] },
  { id: 'arena_1', name: 'Sangue na Areia', desc: 'Vença um combate na Arena.', xp: 40, check: (c) => c.arenaWins >= 1, progress: (c) => [c.arenaWins, 1] },
  { id: 'arena_todas', name: 'Fechador de Fendas', desc: 'Vença todas as Fendas da Arena.', xp: 300, title: 'Fechador de Fendas', check: (c) => c.arenaClears >= 4, progress: (c) => [c.arenaClears, 4] },
  { id: 'colecao_15', name: 'Colecionador', desc: 'Possua 15 itens diferentes.', xp: 120, check: (c) => c.items >= 15, progress: (c) => [c.items, 15] },
  { id: 'conjunto_1', name: 'Conjunto Completo', desc: 'Complete um conjunto de equipamentos.', xp: 200, check: (c) => c.setsDone >= 1, progress: (c) => [c.setsDone, 1] },
  { id: 'polimata', name: 'Polímata', desc: 'Leve 6 atributos ao nível 5.', xp: 300, title: 'Polímata', check: (c) => c.attrsAt5 >= 6, progress: (c) => [c.attrsAt5, 6] },
  { id: 'temporada_1', name: 'Temporada Encerrada', desc: 'Conclua uma temporada pessoal.', xp: 250, itemId: 'traje_temporada', check: (c) => c.seasonsDone >= 1, progress: (c) => [c.seasonsDone, 1] },
  // ── Secretas
  { id: 's_coruja', name: '???  Coruja da Meia-Noite', desc: 'Concluiu uma missão entre meia-noite e 4h. Descanse também.', secret: true, xp: 30, check: (c) => c.nightOwl },
  { id: 's_aurora', name: '???  Antes do Sol', desc: 'Concluiu uma missão antes das 6h.', secret: true, xp: 40, title: 'Madrugador', check: (c) => c.earlyBird },
  { id: 's_retorno', name: '???  O Retorno', desc: 'Voltou depois de dias parado. Recomeçar é a habilidade mais rara.', secret: true, xp: 80, title: 'Aquele Que Retorna', check: (c) => c.comeback },
  { id: 's_rank_c', name: '???  Olhos Sobre Você', desc: 'Alcançou o rank C. Algo no Véu percebeu.', secret: true, xp: 100, check: (c) => c.rankIndex >= 2 },
  { id: 's_talentos', name: '???  Caminho Próprio', desc: 'Aprendeu 8 talentos.', secret: true, xp: 100, check: (c) => c.skillsLearned >= 8 },
];

export const ACH_MAP: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
