// Tipos centrais do jogo. Tudo aqui é serializável em JSON (salvamento/sincronização).

export const ATTR_KEYS = [
  'forca', 'resistencia', 'condicionamento', 'inteligencia', 'conhecimento', 'disciplina',
  'concentracao', 'consistencia', 'organizacao', 'comunicacao', 'autocuidado', 'financas',
] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];
export type AttrWeights = Partial<Record<AttrKey, number>>;

export const RARITIES = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico'] as const;
export type Rarity = (typeof RARITIES)[number];

export const MISSION_TYPES = ['rapida', 'principal', 'secundaria', 'dominio', 'epica', 'lendaria', 'surpresa'] as const;
export type MissionType = (typeof MISSION_TYPES)[number];
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type Recurrence = 'unica' | 'diaria' | 'semanal' | 'mensal';
export type MissionStatus = 'ativa' | 'concluida' | 'cancelada';

export interface MissionStep { id: string; title: string; done: boolean }
export interface HistoryEvent { at: string; event: string }

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  difficulty: Difficulty;
  recurrence: Recurrence;
  attrs: AttrWeights;
  deadline?: string; // YYYY-MM-DD
  steps: MissionStep[];
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  /** períodos já concluídos (missões recorrentes): "2026-10-19", "2026-W42", "2026-10" */
  completedPeriods: string[];
  campaignId?: string;
  bossId?: string;
  phaseId?: string;
  optional?: boolean;
  history: HistoryEvent[];
}

/** Registro imutável de cada ganho de XP. O id é a chave de idempotência. */
export interface LedgerEntry {
  id: string;
  at: string;
  day: string;
  xp: number;
  attrs: AttrWeights; // XP de atributo efetivamente concedido
  source: 'missao' | 'etapa' | 'treino' | 'estudo' | 'financas' | 'autocuidado' | 'chefe' | 'conquista' | 'campanha' | 'temporada' | 'arena' | 'sequencia';
  label: string;
}

export type Slot = 'arma' | 'armadura' | 'luvas' | 'botas' | 'acessorio' | 'traje' | 'emblema' | 'aura' | 'animacao' | 'companheiro';
export const SLOTS: Slot[] = ['arma', 'armadura', 'luvas', 'botas', 'acessorio', 'traje', 'emblema', 'aura', 'animacao', 'companheiro'];

export interface Appearance {
  skin: string;
  hair: string;
  hairStyle: 'curto' | 'espetado' | 'longo' | 'raspado' | 'cacheado' | 'coque';
  eyes: string;
  brows: number; // espessura 0..1
  beard: 'nenhuma' | 'rala' | 'cheia' | 'cavanhaque';
  mustache: boolean;
  height: number; // 0.85..1.15
  build: number; // 0.8..1.3 (largura)
  muscle: number; // 0..1
  headSize: number; // 0.9..1.1
  photo?: string; // dataURL, somente local
}

export interface Character {
  name: string;
  classId: string;
  appearance: Appearance;
  equipped: Partial<Record<Slot, string>>;
  outfits: { id: string; name: string; equipped: Partial<Record<Slot, string>> }[];
  titleId?: string;
}

export interface BossPhase { id: string; name: string; missionIds: string[] }
export interface Boss {
  id: string;
  name: string;
  epithet: string;
  lore: string;
  theme: 'codigo' | 'forca' | 'caos' | 'ouro' | 'sombra' | 'espelho' | 'tempo';
  phases: BossPhase[];
  campaignId?: string;
  rewardItemId?: string;
  createdAt: string;
  updatedAt: string;
  defeatedAt?: string;
  introSeen?: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  goal: string;
  summary: string;
  source: 'modelo' | 'ia' | 'manual';
  missionIds: string[];
  bossId?: string;
  status: 'ativa' | 'concluida' | 'arquivada';
  repeatCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WorkoutSet { reps: number; kg: number }
export interface WorkoutExercise { name: string; sets: WorkoutSet[]; restSec?: number }
export interface Workout { id: string; date: string; exercises: WorkoutExercise[]; durationMin: number; rpe: number; notes: string; createdAt: string }
export interface BodyLog { id: string; date: string; weightKg?: number; waistCm?: number; chestCm?: number; armCm?: number; photo?: string }

export type EvidenceType = 'licao' | 'exercicio' | 'teste' | 'projeto' | 'revisao' | 'link';
export interface Evidence { id: string; type: EvidenceType; note: string; url?: string; at: string; score?: number }
export interface KnowledgeNode {
  id: string;
  tree: string;
  name: string;
  description: string;
  prereqs: string[];
  evidence: Evidence[];
  custom?: boolean;
}

export interface FinanceGoal { id: string; name: string; target: number; createdAt: string }
export interface FinanceEntry { id: string; date: string; amount: number; kind: 'economia' | 'gasto' | 'renda'; goalId?: string; note: string }
export interface SelfCareLog { id: string; date: string; kind: 'sono' | 'agua' | 'alimentacao' | 'higiene' | 'descanso' | 'meditacao'; value: number; note: string }
export interface StudySession { id: string; date: string; minutes: number; nodeId?: string; note: string }

export interface Season { id: string; length: 30 | 60 | 90; startDay: string; theme: string; targets: { xp: number; missions: number; activeDays: number }; claimedTiers: number[]; endedAt?: string; summary?: string }

export interface RankRule { rank: string; minLevel: number; minBestStreak: number; minBosses: number; minAttrLevel: number; minAttrCount: number }

export interface Settings {
  graphics: 'alto' | 'medio' | 'baixo';
  reducedMotion: boolean;
  sound: boolean;
  music: boolean;
  volume: number;
  gmStyle: 'sistema' | 'mentor' | 'narrador' | 'estrategista';
  notifications: { enabled: boolean; studyTime: string; digestTime: string; quietStart: string; quietEnd: string; categories: { missoes: boolean; estudo: boolean; conquistas: boolean; campanhas: boolean } };
  surprise: boolean;
  dailyCapacity: number; // missões por dia antes de reorganizar
  energy?: 'baixa' | 'media' | 'alta';
  availableMinutes?: number;
  ai: { enabled: boolean; apiKey: string; model: string; dailyLimit: number; usedToday: number; usedDay: string };
  cloud: { url: string; anonKey: string; email: string; accessToken?: string; refreshToken?: string; userId?: string; lastSync?: string; auto: boolean };
  rankRules: RankRule[];
}

export interface Streak { current: number; best: number; lastActiveDay?: string; shields: number; brokenAt?: string; comebackOffered?: string }

export interface ChatMessage { id: string; from: 'sistema' | 'jogador'; style: Settings['gmStyle']; text: string; at: string; ai?: boolean }

export interface ArenaRecord { dungeonId: string; wins: number; bestTimeSec?: number; firstClearAt?: string }

export interface GameState {
  version: number;
  createdAt: string;
  updatedAt: string;
  onboarded: boolean;
  character: Character;
  goals: string[];
  missions: Mission[];
  ledger: LedgerEntry[];
  inventory: { itemId: string; at: string }[];
  achievements: Record<string, string>;
  skills: Record<string, number>; // skillId -> rank
  campaigns: Campaign[];
  bosses: Boss[];
  workouts: Workout[];
  body: BodyLog[];
  knowledge: KnowledgeNode[];
  study: StudySession[];
  finance: { goals: FinanceGoal[]; entries: FinanceEntry[] };
  selfcare: SelfCareLog[];
  streak: Streak;
  seasons: Season[];
  storySeen: string[];
  rankSeen: string; // último rank cuja cerimônia foi exibida
  levelSeen: number;
  chat: ChatMessage[];
  arena: ArenaRecord[];
  surpriseDay?: string;
  lastReplanDay?: string;
  deleted: string[]; // ids removidos (para sincronização)
  settings: Settings;
}
