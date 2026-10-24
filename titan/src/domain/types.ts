export type Muscle =
  | 'chest' | 'back' | 'side_delts' | 'front_delts' | 'rear_delts'
  | 'biceps' | 'brachialis' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs';

export type Equipment =
  | 'barbell' | 'ez_bar' | 'dumbbell' | 'bench' | 'rack' | 'cable' | 'machine'
  | 'smith' | 'pullup_bar' | 'dip_station' | 'leg_press' | 'hack_squat';

export type Level = 1 | 2 | 3 | 4 | 5;

export interface TrainingProfile {
  experienceMonths?: number;
  currentSplit?: string;
  currentExercises?: string;
  currentLoads?: string;
  priorities?: Muscle[];
  injuries?: string;
  painAreas?: string;
  sleepHours?: number;
  sleepQuality?: Level;
  trainingDays?: number[]; // 0=dom … 6=sáb
  trainingTime?: string;
  sessionMinutes?: number;
  equipment?: Equipment[];
  equipmentConfirmed?: boolean;
  unableExercises?: string;
  likes?: string;
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high';

export interface NutritionProfile {
  weightKg?: number;
  recentWeightChange?: string;
  usualIntake?: string;
  meals?: { name: string; time: string }[];
  mealsPerDay?: number;
  appetite?: 'low' | 'normal' | 'high';
  eatingDifficulties?: string;
  foodPreferences?: string;
  restrictions?: string;
  allergies?: string;
  budgetMonthlyBrl?: number;
  hasKitchen?: boolean;
  hasFridge?: boolean;
  supplements?: string;
  conditions?: string;
  activityLevel?: ActivityLevel;
  excludedFoods?: string[];
  planSwaps?: Record<string, string>;
}

export interface SkinProfile {
  type?: 'oily' | 'combination' | 'normal' | 'dry' | 'sensitive';
  concerns?: string[];
  areas?: string;
  sensitivities?: string;
  pastReactions?: string;
  budgetMonthlyBrl?: number;
  mentionedProducts?: string[];
}

export interface HairProfile {
  curlType?: string;
  length?: string;
  scalp?: 'oily' | 'normal' | 'dry';
  concerns?: string[];
  washesPerWeek?: number;
  washDays?: number[];
  goals?: string[];
  cutGoal?: string;
  wantsFringe?: boolean;
  budgetMonthlyBrl?: number;
}

export interface GroomingProfile {
  beardGoal?: string;
  beardLength?: string;
  mustacheGoal?: string;
  browsGoal?: string;
  acneInBeardArea?: boolean;
  ingrownHairs?: boolean;
}

export interface Preferences {
  theme?: 'dark' | 'light' | 'system';
  restTimerSound?: boolean;
  /** Análise de aparência por IA (envia fotos à Anthropic). Desligada por padrão. */
  aiAppearance?: boolean;
  /** Data de início da Missão Titan (12 semanas). */
  missionStart?: string;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  age: number | null;
  sex: 'male' | 'female' | null;
  height_cm: number | null;
  training: TrainingProfile;
  nutrition: NutritionProfile;
  skin: SkinProfile;
  hair: HairProfile;
  grooming: GroomingProfile;
  preferences: Preferences;
  onboarding_completed_at: string | null;
  updated_at?: string;
}

export interface Row { id: string; user_id: string; created_at?: string; updated_at?: string }

export interface SlotPrescription {
  slotId: string;
  exerciseKey: string;
  sets: number;
  repRange: [number, number];
  restSec: number;
  rir: number;
  /** Protocolos importados: nome, orientação e descanso exatamente como no documento. */
  label?: string;
  note?: string;
  tag?: string;
  restText?: string;
  /** 's' = séries por tempo (segundos) em vez de repetições. */
  unit?: 'reps' | 's';
}

export interface ProgramDay { dayIndex: number; name: string; focus: string; slots: SlotPrescription[] }

export interface ProgramConfig {
  version: 1;
  trainingDays: number[];
  sessionMinutes: number;
  priorities: Muscle[];
  equipment: Equipment[];
  days: ProgramDay[];
  notes: string[];
  /** Protocolo usado para gerar o ciclo (padrão: modelo de 8 semanas do Titan). */
  protocol?: 'olympia' | 'jkk';
  /** Semanas em que o deload foi aplicado por decisão baseada em dados. */
  deloadWeeks?: number[];
  /** Plano fechado: o usuário só registra; trocas apenas por dor ou aparelho indisponível. */
  locked?: boolean;
  olympiaVersion?: number;
}

export interface ProgramRow extends Row {
  name: string;
  start_date: string;
  weeks: number;
  config: ProgramConfig;
  status: 'active' | 'archived';
}

export interface PlannedExercise extends SlotPrescription {
  name: string;
  muscle: Muscle;
  loadSuggestion: number | null;
  suggestionReason: string;
  warmup: string;
}

export interface SessionRow extends Row {
  program_id: string;
  week: number;
  day_index: number;
  sequence: number;
  scheduled_date: string | null;
  status: 'in_progress' | 'done' | 'skipped';
  started_at: string | null;
  completed_at: string | null;
  fatigue: number | null;
  session_rpe: number | null;
  pain_notes: string | null;
  notes: string | null;
  exercises: PlannedExercise[];
  readiness?: Readiness | null;
}

/** Prontidão pré-treino pela escala TQR (6–20) de Kenttä & Hassmén. */
export interface Readiness { tqr: number; adjusted: boolean; note: string }

export interface SetLogRow extends Row {
  session_id: string;
  exercise_key: string;
  exercise_name: string;
  muscle: string;
  set_index: number;
  kind: 'warmup' | 'working';
  load_kg: number;
  reps: number;
  rir: number | null;
  technique_ok: boolean;
  pain: number;
  notes: string | null;
  logged_at: string;
}

export interface OverrideRow extends Row { exercise_key: string; replacement_key: string; reason: string | null }

export interface CheckinRow extends Row {
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  recovery: number | null;
  soreness: number | null;
  stress: number | null;
  water_l?: number | null;
  /** Hábitos manuais marcados no dia (id → feito). */
  habits?: Record<string, boolean>;
  notes: string | null;
}

export interface MetricConditions { fasted?: boolean; morning?: boolean; afterTraining?: boolean; flexed?: boolean }

export interface MetricRow extends Row {
  date: string;
  weight_kg: number | null;
  arm_right_cm: number | null;
  arm_left_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  thigh_cm: number | null;
  shoulders_cm: number | null;
  thigh_left_cm?: number | null;
  arm_right_relaxed_cm?: number | null;
  arm_left_relaxed_cm?: number | null;
  forearm_right_cm?: number | null;
  forearm_left_cm?: number | null;
  calf_right_cm?: number | null;
  calf_left_cm?: number | null;
  hip_cm?: number | null;
  conditions: MetricConditions;
  notes: string | null;
}

export interface TargetRow extends Row {
  effective_from: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  rationale: string | null;
  inputs: Record<string, unknown>;
}

export interface UserFoodRow extends Row {
  name: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  source: string | null;
}

export interface FoodLogRow extends Row {
  date: string;
  meal: string;
  food_key: string;
  food_name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface FoodPriceRow extends Row {
  food_key: string;
  price_brl: number;
  package_g: number;
  store: string | null;
  source: string | null;
  observed_on: string;
}

export type CareArea = 'skin' | 'hair' | 'beard' | 'brows';
export type CareSlot = 'am' | 'pm' | 'wash' | 'non_wash' | 'scalp' | 'weekly';

export interface ProductRow extends Row {
  area: CareArea;
  name: string;
  brand: string | null;
  category: string;
  ingredients: string | null;
  actives: string[];
  concentration: string | null;
  status: 'active' | 'introducing' | 'paused' | 'suspended';
  started_on: string | null;
  notes: string | null;
}

export interface RoutineItemRow extends Row {
  area: CareArea;
  slot: CareSlot;
  product_id: string | null;
  step: string;
  step_order: number;
  days: number[];
  amount: string | null;
  notes: string | null;
  enabled: boolean;
}

export interface CareLogRow extends Row {
  date: string;
  area: CareArea;
  slot: string;
  completed: boolean;
  product_id: string | null;
  reaction: 'none' | 'mild' | 'moderate' | 'severe';
  itch: number | null;
  notes: string | null;
}

export interface PhotoRow extends Row {
  category: 'face' | 'hair' | 'physique' | 'label' | 'other';
  storage_path: string;
  taken_at: string;
  lighting: string | null;
  distance: string | null;
  pose: string | null;
  time_of_day: string | null;
  pump: boolean;
  notes: string | null;
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Peitoral',
  back: 'Costas',
  side_delts: 'Deltoide lateral',
  front_delts: 'Deltoide anterior',
  rear_delts: 'Deltoide posterior',
  biceps: 'Bíceps',
  brachialis: 'Braquial',
  triceps: 'Tríceps',
  forearms: 'Antebraço',
  quads: 'Quadríceps',
  hamstrings: 'Posteriores de coxa',
  glutes: 'Glúteos',
  calves: 'Panturrilhas',
  abs: 'Abdômen',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barra olímpica + anilhas',
  ez_bar: 'Barra W',
  dumbbell: 'Halteres',
  bench: 'Banco regulável',
  rack: 'Rack / gaiola de agachamento',
  cable: 'Polia / crossover',
  machine: 'Máquinas guiadas (peck deck, extensora, flexora…)',
  smith: 'Smith',
  pullup_bar: 'Barra fixa',
  dip_station: 'Paralelas',
  leg_press: 'Leg press',
  hack_squat: 'Hack squat',
};

export interface AppearanceRow extends Row {
  source: 'ai' | 'questionnaire';
  model: string | null;
  photo_path: string | null;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
}
