import type { Activity, Category, Profile, Settings, SleepSettings, State } from './types';

export const CATEGORIES: Category[] = [
  { id: 'face', name: 'FACE', emoji: '✨', color: '#f472b6', builtin: true },
  { id: 'body', name: 'BODY', emoji: '💪', color: '#f97316', builtin: true },
  { id: 'nutrition', name: 'NUTRITION', emoji: '🍽️', color: '#22c55e', builtin: true },
  { id: 'hair', name: 'HAIR', emoji: '💈', color: '#eab308', builtin: true },
  { id: 'mind', name: 'MIND', emoji: '🧠', color: '#60a5fa', builtin: true },
  { id: 'sleep', name: 'SLEEP', emoji: '🌙', color: '#a78bfa', builtin: true },
  { id: 'work', name: 'WORK', emoji: '💼', color: '#94a3b8', builtin: true },
  { id: 'life', name: 'LIFE', emoji: '🎮', color: '#2dd4bf', builtin: true },
];

export const CATEGORY_HINT: Record<string, string> = {
  face: 'Cuidados faciais', body: 'Desenvolvimento físico', nutrition: 'Alimentação', hair: 'Cabelo e barba',
  mind: 'Desenvolvimento pessoal', sleep: 'Sono e recuperação', work: 'Trabalho e compromissos', life: 'Lazer e organização',
};

const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const GYM = [1, 2, 4, 5]; // treino de 4 dias (seg, ter, qui, sex)

let n = 0;
const A = (title: string, categoryId: string, duration: number, anchor: Activity['anchor'], description: string, extra: Partial<Activity> = {}): Activity => ({
  id: `a${++n}`, title, categoryId, description, duration, anchor, fixed: false, priority: 2, days: ALL, paused: false, notify: true, kind: 'normal', ...extra,
});

/** Rotina inicial pensada para os objetivos do Titan (físico, rosto, cabelo, sono 8–9 h). Tudo é editável. */
export function defaultActivities(): Activity[] {
  n = 0;
  return [
    A('Acordar', 'sleep', 5, { type: 'wake', offset: 0 }, 'Levante no primeiro alarme, abra a janela e beba um copo de água. Luz natural cedo ajuda a regular o sono.', { fixed: true, priority: 1, kind: 'wake' }),
    A('Higiene pessoal', 'face', 15, { type: 'wake', offset: 5 }, 'Banho rápido, escovar os dentes (2 min) e fio dental.', { priority: 1 }),
    A('Skincare matinal', 'face', 10, { type: 'wake', offset: 20 }, '1) Limpeza com sabonete facial suave. 2) Hidratante leve. 3) Protetor solar FPS 30+ em rosto, orelhas e pescoço (2 dedos de produto).', { priority: 1 }),
    A('Cabelo e barba', 'hair', 10, { type: 'wake', offset: 30 }, 'Finalização do cabelo (creme/pomada) e acabamento da barba. Nos dias de lavagem, use o bloco "Lavar e hidratar cabelo".'),
    A('Café da manhã', 'nutrition', 20, { type: 'wake', offset: 45 }, 'Proteína + carboidrato: ex. 2–3 ovos, pão ou cuscuz, fruta e leite. Comece o dia com 1 copo de água.', { priority: 1 }),
    A('Estudos', 'mind', 90, { type: 'time', at: 8 * 60 + 30 }, 'Bloco de foco profundo: celular longe, 2 × 45 min com 5 min de pausa. Defina antes o que vai terminar.', { priority: 2, days: WEEKDAYS }),
    A('Organização pessoal', 'life', 15, { type: 'time', at: 10 * 60 + 15 }, 'Revisar tarefas do dia, arrumar o quarto e a mochila, responder mensagens pendentes.', { priority: 3 }),
    A('Leitura', 'mind', 30, { type: 'time', at: 10 * 60 + 40 }, 'Leitura sem tela: 10–20 páginas. Anote uma ideia útil.', { priority: 3 }),
    A('Almoço', 'nutrition', 40, { type: 'time', at: 12 * 60 }, 'Prato: metade arroz/feijão, 1/4 proteína (frango, carne, ovos), 1/4 salada. Mastigue devagar.', { priority: 1 }),
    A('Lanche da tarde', 'nutrition', 15, { type: 'time', at: 15 * 60 }, 'Pré-treino leve: fruta + fonte de proteína (iogurte, ovos, leite).', { priority: 2 }),
    A('Academia — musculação', 'body', 105, { type: 'time', at: 16 * 60 }, 'Treino do dia (divisão de 4 dias: Superior A, Inferior A, Superior B, Inferior B). Aquecimento, séries principais, abdômen no fim. Leve água e registre as cargas.', { priority: 1, days: GYM }),
    A('Cardio', 'body', 20, { type: 'time', at: 17 * 60 + 50 }, 'Esteira inclinada (5–6 km/h, inclinação 8–10%) ou bike 80–90 rpm, em ritmo em que dá para falar frases curtas.', { priority: 2, days: [2, 5] }),
    A('Abdômen e core', 'body', 15, { type: 'time', at: 17 * 60 }, 'Prancha 3 × 40 s, prancha lateral 2 × 30 s cada lado, elevação de pernas 3 × 12.', { priority: 3, days: [3] }),
    A('Recuperação ativa', 'body', 30, { type: 'time', at: 17 * 60 + 20 }, 'Caminhada leve ou mobilidade. Dia sem academia: deixe o músculo crescer.', { priority: 3, days: [3] }),
    A('Treino de luta (Boxe + MMA)', 'body', 85, { type: 'time', at: 10 * 60 }, 'Sábado: ataque, pés e reflexo. Domingo: defesa, MMA e aprender a apanhar. A corda do fim de semana fica dentro do treino.', { priority: 2, days: [0, 6] }),
    A('Lanche pós-treino', 'nutrition', 15, { type: 'time', at: 18 * 60 + 15 }, 'Proteína + carboidrato até 2 h depois do treino.', { priority: 2 }),
    A('Lavar e hidratar cabelo', 'hair', 20, { type: 'time', at: 18 * 60 + 35 }, 'Shampoo só no couro cabeludo, condicionador nas pontas; hidratação 1× por semana (domingo).', { priority: 3, days: [1, 3, 5, 0] }),
    A('Alongamento e mobilidade', 'body', 15, { type: 'time', at: 19 * 60 }, 'Peitoral, ombros, quadril, posterior e panturrilha: 30–45 s cada. Respiração lenta.', { priority: 2 }),
    A('Jantar', 'nutrition', 30, { type: 'time', at: 19 * 60 + 30 }, 'Refeição completa com proteína. Evite comer pesado nas 2 h antes de dormir.', { priority: 1 }),
    A('Tempo livre', 'life', 60, { type: 'time', at: 20 * 60 + 5 }, 'Lazer de verdade: jogo, série, amigos, família. Sem culpa — faz parte da rotina.', { priority: 3 }),
    A('Skincare noturno', 'face', 10, { type: 'bed', offset: 50 }, '1) Limpeza para tirar protetor e oleosidade. 2) Hidratante. Não esprema espinhas.', { priority: 1 }),
    A('Preparar para dormir', 'sleep', 30, { type: 'bed', offset: 30 }, 'Desacelerar: luz baixa, celular longe da cama, separar a roupa de amanhã, respiração 4-7-8. Quarto escuro e fresco.', { priority: 1, fixed: true }),
    A('Dormir', 'sleep', 0, { type: 'bed', offset: 0 }, 'Hora de apagar a luz. Meta: 8–9 h de sono.', { priority: 1, fixed: true, kind: 'bed' }),
  ];
}

export const DEFAULT_SLEEP: SleepSettings = {
  weekday: { wake: 7 * 60, bed: 22 * 60 + 30 },
  weekend: { wake: 8 * 60, bed: 23 * 60 + 30 },
  windDownMin: 30,
  goalMin: 8 * 60,
  goalMax: 9 * 60,
};

export const DEFAULT_PROFILE: Profile = { name: '', weightKg: 75, kcal: 2450, protein: 150, carbs: 325, fat: 60, waterMl: 2600, workLunch: { at: 11 * 60 + 30, duration: 80 } };

export const DEFAULT_SETTINGS: Settings = { notifications: true, lateAlerts: true, lateAfterMin: 15, snoozeMin: 10, aiEnabled: false, theme: 'dark' };

export function defaultState(now = new Date()): State {
  return {
    version: STATE_VERSION,
    createdAt: now.toISOString(),
    profile: { ...DEFAULT_PROFILE, workLunch: { ...DEFAULT_PROFILE.workLunch } },
    categories: CATEGORIES.map((c) => ({ ...c })),
    activities: defaultActivities(),
    sleep: structuredClone(DEFAULT_SLEEP),
    overrides: {},
    completions: {},
    water: {},
    food: {},
    dayLog: {},
    achievements: {},
    settings: { ...DEFAULT_SETTINGS },
    aiLog: [],
    snoozes: {},
  };
}

export const STATE_VERSION = 2;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
