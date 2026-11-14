export type Priority = 1 | 2 | 3; // 1 = essencial, 2 = importante, 3 = flexível
export const PRIORITY_LABEL: Record<Priority, string> = { 1: 'Essencial', 2: 'Importante', 3: 'Flexível' };

export interface Category { id: string; name: string; emoji: string; color: string; builtin?: boolean }

/**
 * Âncora do horário preferido:
 * - time: horário fixo do relógio (min desde 00:00)
 * - wake: X minutos depois de acordar
 * - bed: começa X minutos antes do horário de dormir
 */
export type Anchor = { type: 'time'; at: number } | { type: 'wake'; offset: number } | { type: 'bed'; offset: number };

export type ActivityKind = 'wake' | 'bed' | 'normal';

export interface Activity {
  id: string;
  title: string;
  categoryId: string;
  description: string;
  /** Minutos. */
  duration: number;
  anchor: Anchor;
  /** Fixo = sempre exatamente no horário; flexível = o app encaixa o mais perto possível. */
  fixed: boolean;
  priority: Priority;
  /** 0 = domingo … 6 = sábado. */
  days: number[];
  paused: boolean;
  notify: boolean;
  kind?: ActivityKind;
  /**
   * "Junto com outra atividade": nos dias em que a atividade-mãe acontece, esta fica DENTRO dela,
   * no horário `at` com `duration` minutos (ex.: Almoço 11:30–12:50 dentro do Trabalho).
   * Nos outros dias, usa a âncora e a duração normais.
   */
  join?: { parentId: string; at: number; duration: number };
  /** Pode encurtar até estes minutos quando o dia está cheio. */
  minDuration?: number;
  /** Opcional: entra só se sobrar espaço (no fim), sem aviso quando não cabe. */
  optional?: boolean;
}

export interface SleepWindow { wake: number; bed: number }
export interface SleepSettings { weekday: SleepWindow; weekend: SleepWindow; windDownMin: number; goalMin: number; goalMax: number }

export interface DayOverride {
  wake?: number;
  bed?: number;
  skip: string[];
  /** Novo horário só neste dia (vira fixo no dia). */
  move: Record<string, number>;
  duration: Record<string, number>;
  add: Activity[];
}

export interface Completion { at: string; xp: number; onTime: boolean }
export interface FoodEntry { id: string; label: string; kcal: number; protein: number; carbs: number; fat: number }
export interface DayLog { planned: number; done: number; cats: Record<string, [number, number]> }

export interface Settings {
  notifications: boolean;
  lateAlerts: boolean;
  lateAfterMin: number;
  snoozeMin: number;
  aiEnabled: boolean;
  theme: 'dark' | 'light';
}

export interface Profile {
  name: string; weightKg: number; kcal: number; protein: number; carbs: number; fat: number; waterMl: number;
  /** Almoço nos dias de trabalho (min desde 00:00 e duração). */
  workLunch: { at: number; duration: number };
}

export interface AiLogEntry { at: string; text: string; summary: string; source: 'local' | 'claude'; applied: boolean }

export interface State {
  version: number;
  createdAt: string;
  profile: Profile;
  categories: Category[];
  activities: Activity[];
  sleep: SleepSettings;
  overrides: Record<string, DayOverride>;
  completions: Record<string, Record<string, Completion>>;
  water: Record<string, number>;
  food: Record<string, FoodEntry[]>;
  dayLog: Record<string, DayLog>;
  achievements: Record<string, string>;
  settings: Settings;
  aiLog: AiLogEntry[];
  /** Adiamentos: chave "data|atividade" → horário (ms) do novo lembrete. */
  snoozes: Record<string, number>;
}

export const emptyOverride = (): DayOverride => ({ skip: [], move: {}, duration: {}, add: [] });
