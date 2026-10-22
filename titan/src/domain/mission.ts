// Missão Titan — plano de 12 semanas com o que mais muda rosto e corpo, gastando pouco.
// Princípio: poucos hábitos de alto impacto, feitos todo dia, medidos pelo próprio app.
import { addDays } from './dates';
import { isTrainingDay } from './schedule';
import type { CareLogRow, CheckinRow, FoodLogRow, ProgramRow, SessionRow, TargetRow } from './types';

export const MISSION_WEEKS = 12;

export interface MissionData {
  program: ProgramRow | null;
  sessions: SessionRow[];
  foodLogs: FoodLogRow[];
  target: TargetRow | null;
  careLogs: CareLogRow[];
  checkins: CheckinRow[];
  /** Rotina de pele cadastrada? Sem rotina, os itens de pele aparecem como pendentes de configuração. */
  hasSkinRoutine: boolean;
}

export type HabitArea = 'corpo' | 'rosto' | 'base';
export interface Habit {
  id: string;
  area: HabitArea;
  label: string;
  why: string;
  /** Onde fazer/registrar no app (itens automáticos). */
  to?: string;
  /** true/false = avaliado pelos registros; null = não se aplica no dia; undefined = item manual. */
  auto?: (d: MissionData, date: string) => boolean | null;
}

const checkinOf = (d: MissionData, date: string) => d.checkins.find((c) => c.date === date);

export const HABITS: Habit[] = [
  {
    id: 'train', area: 'corpo', label: 'Treino do dia concluído', to: '/treino',
    why: 'É o estímulo que faz o músculo crescer. Dia de descanso conta como cumprido.',
    auto: (d, date) => {
      if (!d.program) return null;
      if (d.sessions.some((s) => s.status === 'done' && (s.completed_at ?? '').slice(0, 10) === date)) return true;
      return isTrainingDay(d.program, date) ? false : null;
    },
  },
  {
    id: 'protein', area: 'corpo', label: 'Proteína do dia batida (≥ 90% da meta)', to: '/nutricao',
    why: 'Sem proteína suficiente, o treino não vira músculo. É o item de dieta com maior retorno.',
    auto: (d, date) => {
      if (!d.target) return null;
      const p = d.foodLogs.filter((l) => l.date === date).reduce((s, l) => s + Number(l.protein_g), 0);
      return p >= d.target.protein_g * 0.9;
    },
  },
  {
    id: 'kcal', area: 'corpo', label: 'Calorias dentro da meta (±10%)', to: '/nutricao',
    why: 'Superávit pequeno = músculo com pouca gordura. Comer muito acima engorda o rosto e a cintura.',
    auto: (d, date) => {
      if (!d.target) return null;
      const k = d.foodLogs.filter((l) => l.date === date).reduce((s, l) => s + Number(l.kcal), 0);
      if (k === 0) return false;
      return Math.abs(k - d.target.kcal) <= d.target.kcal * 0.1;
    },
  },
  {
    id: 'sleep', area: 'base', label: 'Dormiu 7–9 h', to: '/',
    why: 'Sono curto reduz o ganho de massa e piora pele e olheiras. É grátis.',
    auto: (d, date) => {
      const c = checkinOf(d, date);
      return c?.sleep_hours === null || c?.sleep_hours === undefined ? false : Number(c.sleep_hours) >= 7;
    },
  },
  {
    id: 'water', area: 'base', label: 'Água ≥ 2 L', to: '/',
    why: 'Desempenho no treino e pele. Garrafa à vista resolve.',
    auto: (d, date) => {
      const c = checkinOf(d, date);
      return c?.water_l === null || c?.water_l === undefined ? false : Number(c.water_l) >= 2;
    },
  },
  {
    id: 'skin_am', area: 'rosto', label: 'Pele de manhã: limpeza + protetor solar', to: '/cuidados',
    why: 'Protetor diário é o cosmético com mais evidência para manchas e textura; limpeza controla a oleosidade.',
    auto: (d, date) => (d.hasSkinRoutine ? d.careLogs.some((l) => l.date === date && l.area === 'skin' && l.slot === 'am' && l.completed && !l.product_id) : false),
  },
  {
    id: 'skin_pm', area: 'rosto', label: 'Pele à noite: limpeza + hidratante', to: '/cuidados',
    why: 'Tira suor e protetor do dia; pele oleosa também precisa de hidratante leve.',
    auto: (d, date) => (d.hasSkinRoutine ? d.careLogs.some((l) => l.date === date && l.area === 'skin' && l.slot === 'pm' && l.completed && !l.product_id) : false),
  },
  { id: 'teeth', area: 'rosto', label: 'Dentes: escovar 2× + fio dental', why: 'Sorriso e hálito pesam muito na aparência e custam quase nada.' },
  { id: 'posture', area: 'rosto', label: '5 min de postura (queixo recolhido + abertura de peito)', why: 'Cabeça projetada à frente deixa queixo e pescoço com aspecto pior nas fotos. Sem promessa de mudar osso: é postura.' },
  { id: 'hands_off', area: 'rosto', label: 'Não espremi espinhas nem mexi no rosto', why: 'Espremer inflama, mancha e deixa cicatriz — a marca dura bem mais que a espinha.' },
  { id: 'prep', area: 'base', label: 'Comida do dia planejada/preparada (marmita)', why: 'Cozinhar em casa é o jeito mais barato de bater proteína e calorias — e o que mais garante adesão.' },
];

export interface DayStatus { date: string; items: { habit: Habit; done: boolean | null }[]; done: number; total: number; score: number }

export function dayStatus(d: MissionData, date: string): DayStatus {
  const manual = checkinOf(d, date)?.habits ?? {};
  const items = HABITS.map((h) => ({ habit: h, done: h.auto ? h.auto(d, date) : !!manual[h.id] }));
  const applicable = items.filter((i) => i.done !== null);
  const done = applicable.filter((i) => i.done).length;
  return { date, items, done, total: applicable.length, score: applicable.length ? done / applicable.length : 0 };
}

/** Dia "cumprido" = ≥ 80% dos itens aplicáveis. */
export const DAY_PASS = 0.8;

/** Sequência atual de dias cumpridos (hoje só conta se já estiver cumprido; não quebra a sequência se ainda está em andamento). */
export function streak(d: MissionData, today: string, maxDays = 120): number {
  let n = 0;
  const todayPass = dayStatus(d, today).score >= DAY_PASS;
  if (todayPass) n++;
  for (let i = 1; i <= maxDays; i++) {
    if (dayStatus(d, addDays(today, -i)).score >= DAY_PASS) n++;
    else break;
  }
  return n;
}

/** Nota média dos últimos 7 dias (0–100), sem contar hoje. */
export function weekScore(d: MissionData, today: string): number {
  const days = Array.from({ length: 7 }, (_, i) => dayStatus(d, addDays(today, -(i + 1))).score);
  return Math.round((days.reduce((a, b) => a + b, 0) / 7) * 100);
}

export interface Phase { weeks: [number, number]; title: string; focus: string[]; expect: string[] }

/** O que fazer e o que é realista esperar em cada fase (sem promessas de prazo mágico). */
export const PHASES: Phase[] = [
  {
    weeks: [1, 2], title: 'Fundação',
    focus: ['Cadastrar rotina de pele (3 produtos) e fazer todo dia', 'Treinar com RIR alto e aprender as cargas', 'Registrar comida e peso para o app calibrar a meta', 'Cortar o cabelo pelo formato do rosto (Aparência)'],
    expect: ['Força sobe rápido (aprendizado do movimento)', 'Peso pode subir 0,5–1 kg de água e glicogênio — não é gordura', 'Corte novo e barba alinhada já mudam o rosto na hora'],
  },
  {
    weeks: [3, 6], title: 'Consistência',
    focus: ['Bater proteína todo dia', 'Progredir carga/repetições série a série', 'Missão ≥ 80% em 6 de 7 dias'],
    expect: ['Pele mais uniforme e menos oleosa com a rotina constante (acne inflamada leva mais tempo; grau alto → dermatologista)', 'Primeiros centímetros no braço e ombro (fita, não espelho)', 'Fotos da semana 5 já costumam mostrar diferença em relação à semana 1'],
  },
  {
    weeks: [7, 12], title: 'Aceleração com dados',
    focus: ['Ajustar volume nas revisões (dias 45 e 60)', 'Ajustar calorias pela média de peso e cintura', 'Manter o que funciona; mudar uma coisa por vez'],
    expect: ['Ombros e braços visivelmente mais cheios nas fotos padronizadas', 'Rosto: definição depende mais da gordura corporal que de qualquer exercício facial — cintura estável = rosto definido', 'Força bem acima da semana 1 em todos os exercícios principais'],
  },
];

/** O que comprar, o que é opcional e o que não vale o dinheiro (sem preços: o app não inventa valores). */
export const BUDGET = {
  essential: [
    'Comida: ovos, frango (peito ou coxa), carne moída magra, sardinha em lata, leite, feijão, arroz, aveia, banana, legumes da estação — as proteínas mais baratas por grama no mercado comum.',
    'Pele: 1 sabonete para pele oleosa/acneica, 1 hidratante em gel/gel-creme, 1 protetor solar FPS 30+ toque seco. Só isso.',
    'Barbeiro a cada 3–4 semanas (ou 2–3 se usar fade baixo). Pinça para sobrancelha.',
    'Escova, pasta com flúor e fio dental.',
  ],
  optional: [
    'Creatina monohidratada 3–5 g/dia: o suplemento com evidência mais forte para força e massa — confirme com nutricionista.',
    'Whey: só se o custo por grama de proteína for menor que o da comida (compare no rótulo).',
    'Máquina de cortar com pentes, para manter o pezinho entre idas ao barbeiro.',
  ],
  skip: [
    'BCAA, glutamina, "pré-hormonal", "booster de testosterona" — sem resultado relevante, alguns com risco.',
    'Aparelhos de mandíbula, "mewing" para mudar o osso, rolinho facial caro — não há evidência de mudança estrutural.',
    'Skincare com 8 passos e ativos fortes misturados — mais irritação, não mais resultado.',
    'Anabolizantes e qualquer hormônio: risco real à saúde e à fertilidade. Fora de questão.',
  ],
};

export const FACE_PLAN = [
  { title: 'Corte certo para o seu rosto', detail: 'Faça o questionário em Aparência e leve a descrição (com o número do pente) ao barbeiro. É a mudança mais rápida do rosto.', to: '/aparencia' },
  { title: 'Pele limpa e uniforme', detail: 'Rotina de 3 produtos todo dia, um ativo novo por vez, nunca espremer. Acne inflamada ou que deixa marca → dermatologista (pelo SUS, comece pela UBS).', to: '/cuidados' },
  { title: 'Barba e sobrancelha alinhadas', detail: 'Linha do pescoço 1–2 dedos acima do pomo de adão, bochecha no desenho natural; sobrancelha só tirar pelos soltos. Revisar 1×/semana.', to: '/cuidados' },
  { title: 'Rosto mais definido', detail: 'Vem de gordura corporal controlada (superávit pequeno), sono e água — não de exercício facial. Acompanhe a cintura: se ela sobe rápido, o rosto também arredonda.', to: '/evolucao' },
  { title: 'Postura e sorriso', detail: 'Queixo recolhido e ombros para trás mudam o perfil nas fotos na hora; dentes limpos e fio dental todo dia.', to: undefined },
];
