// Modo "Perder gordura e ganhar massa ao mesmo tempo" (recomposição).
// O que faz a recomposição funcionar: (1) musculação pesada e progressiva — é ela que manda o corpo
// manter e construir músculo; (2) déficit leve de calorias com proteína alta; (3) gasto extra com
// passos e cardio curto, sem roubar a recuperação do treino de força.
// Por isso o treino de força continua o Protocolo JKK (3, 4 ou 5 dias) e o modo acrescenta:
// cardio leve (esteira inclinada ou bike) depois de alguns treinos e pular corda no fim de semana.
import { weekday } from './dates';
import type { JkkProtocol } from './types';

export type Goal = 'recomp' | 'gain';
export const GOAL_LABEL: Record<Goal, { label: string; sub: string }> = {
  recomp: { label: 'Perder gordura e ganhar massa', sub: 'déficit leve + força + cardio' },
  gain: { label: 'Ganhar massa', sub: 'superávit leve + força' },
};

export const RECOMP_TRUTH = [
  'Funciona melhor para quem é intermediário e tem gordura para perder — o seu caso. O ritmo é mais lento que só emagrecer ou só ganhar: conte com 8 a 12 semanas.',
  'O sinal de que está dando certo: cintura diminuindo e cargas subindo (ou pelo menos se mantendo). O peso na balança cai devagar, cerca de 0,3 kg por semana.',
  'Não corte calorias além da meta nem some cardio por conta própria: déficit grande demais faz perder músculo junto.',
];

// ------------------------------------------------------------------ cardio depois do treino

export interface Finisher { name: string; format: string; minutes: number; moves: string[]; note: string }

/** Minutos por semana do ciclo: sobe aos poucos (12 → 15 → 18 → 20). */
export function cardioMinutes(week: number): number {
  const w = Math.max(1, Math.round(week));
  return w <= 2 ? 12 : w <= 4 ? 15 : w <= 6 ? 18 : 20;
}

/**
 * Cardio leve e de baixo impacto, feito DEPOIS da musculação (nunca antes).
 * Padrão: caminhada na esteira inclinada. A bike é a alternativa equivalente — e a escolha certa
 * quando a canela ou o joelho estiverem sentindo a corda do fim de semana.
 */
export function postWorkoutCardio(week: number): Finisher {
  const min = cardioMinutes(week);
  return {
    name: 'Cardio: esteira inclinada (ou bike)',
    format: `${min} minutos em ritmo constante, esforço 5–6 de 10: respiração acelerada, mas ainda dá para falar frases curtas`,
    minutes: min,
    moves: [
      `Esteira (padrão): caminhada a 5–6 km/h com inclinação de 8–10%, sem segurar no apoio. Comece com 2 min a 5 km/h e 4% para aquecer; os ${min} min contam a partir daí.`,
      `Bike (alternativa): ${min} min pedalando a 80–90 rotações por minuto, com carga que deixe a respiração acelerada. Banco na altura do quadril.`,
      'Para subir a dificuldade, aumente a inclinação (esteira) ou a carga (bike) — não corra: correr depois do treino rouba recuperação das pernas.',
      'Termine com 1–2 min bem leves até a respiração baixar.',
    ],
    note: 'Pode alternar: esteira num dia, bike no outro. Os dois valem igual; escolha o que você consegue manter.',
  };
}

/** Uma sessão de referência (semana 1), para listagens e testes. */
export const FINISHERS: Finisher[] = [postWorkoutCardio(1)];

export const FINISHER_RULES = [
  'Sempre depois da musculação. O treino de força é a prioridade: não poupe energia para o cardio.',
  'Ritmo constante e confortável (5–6 de 10). Não é tiro nem corrida: o objetivo é gastar calorias sem atrapalhar a recuperação.',
  'O tempo sobe aos poucos: 12 min nas semanas 1–2, 15 nas 3–4, 18 nas 5–6 e 20 nas 7–8.',
  'Não entra nos dias de perna (já são os mais pesados) nem em semana de deload. Dormiu mal? Faça metade ou pule.',
  'Canela, tendão ou joelho doloridos por causa da corda: vá de bike nesse dia.',
];

/** Em quais dias do plano entra o cardio pós-treino (posição do dia no ciclo). Máximo de 3 por semana. */
const FINISHER_DAYS: Record<JkkProtocol, number[]> = {
  jkk3: [0, 1, 2], // corpo inteiro: os três dias
  jkk4: [0, 2], // Superior A e Superior B
  jkk: [0, 2, 4], // peito/tríceps, costas/bíceps, braços
};

export function finisherFor(protocol: JkkProtocol, dayPos: number, deload = false, week = 1): Finisher | null {
  if (deload) return null;
  return FINISHER_DAYS[protocol].includes(dayPos) ? postWorkoutCardio(week) : null;
}

// ------------------------------------------------------------------ pular corda (fim de semana)

export type RopeKind = 'interval' | 'steady';
export interface RopeSession {
  kind: RopeKind;
  title: string;
  rounds: number;
  workSec: number;
  restSec: number;
  /** Esforço alvo (0–10). */
  effort: string;
  /** Minutos totais do bloco principal (trabalho + descanso). */
  mainMinutes: number;
  totalJumpMinutes: number;
}

/** Progressão de 8 semanas: [séries, segundos pulando, segundos de descanso]. */
const INTERVAL: [number, number, number][] = [[8, 30, 60], [8, 30, 60], [10, 40, 50], [10, 40, 50], [10, 45, 45], [10, 45, 45], [12, 60, 30], [12, 60, 30]];
const STEADY: [number, number, number][] = [[4, 120, 60], [4, 120, 60], [5, 120, 60], [5, 120, 60], [4, 180, 60], [4, 180, 60], [5, 180, 60], [5, 180, 60]];

export function ropeSession(kind: RopeKind, week: number): RopeSession {
  const w = Math.max(1, Math.min(8, Math.round(week))) - 1;
  const [rounds, workSec, restSec] = (kind === 'interval' ? INTERVAL : STEADY)[w];
  return {
    kind, rounds, workSec, restSec,
    title: kind === 'interval' ? 'Corda intervalada (forte)' : 'Corda contínua (ritmo leve)',
    effort: kind === 'interval' ? '8 de 10 nos tiros: rápido, quase sem fôlego para falar' : '5–6 de 10: dá para falar frases curtas',
    mainMinutes: Math.round((rounds * (workSec + restSec)) / 60),
    totalJumpMinutes: Math.round(((rounds * workSec) / 60) * 10) / 10,
  };
}

/**
 * Dias de corda por plano (0 = dom … 6 = sáb). Nos planos de 3 e 4 dias: sábado intervalada e
 * domingo contínua. No de 5 dias o sábado já tem treino: só domingo, intervalada.
 */
export function ropeFor(protocol: JkkProtocol, dateIso: string): RopeKind | null {
  const d = weekday(dateIso);
  if (protocol === 'jkk') return d === 0 ? 'interval' : null;
  if (d === 6) return 'interval';
  if (d === 0) return 'steady';
  return null;
}

export const ROPE_WARMUP = ['2 min de polichinelo leve ou corrida parada', '1 min de círculos de tornozelo e panturrilha na ponta dos pés (20 repetições)', '1 min pulando devagar, só para pegar o ritmo'];
export const ROPE_COOLDOWN = ['2–3 min caminhando até a respiração baixar', 'Alongar panturrilhas na parede: 2 × 30 s cada perna'];
export const ROPE_TECHNIQUE = [
  'Corda do tamanho certo: pise no meio dela e as manoplas devem chegar perto das axilas.',
  'Saltos baixos (1–2 cm do chão), na ponta dos pés, joelhos levemente dobrados.',
  'Quem gira a corda é o punho, não o braço. Cotovelos perto do corpo.',
  'Piso que absorve impacto: borracha, madeira ou tapete fino. Evite concreto e use tênis.',
  'Errou o pulo? Continue contando o tempo e volte a pular: o que vale é o tempo de esforço.',
];
export const ROPE_CAUTIONS = [
  'Dor na canela, no tendão de Aquiles ou no joelho: pare e troque por bicicleta ou caminhada inclinada naquele dia.',
  'Aumente só o que a progressão manda. Canela e panturrilha se adaptam mais devagar que o fôlego.',
  'Sem corda? Faça o mesmo tempo com polichinelo ou "corda imaginária".',
  'Tontura, dor no peito ou falta de ar fora do normal: pare e procure um médico.',
];
/** Estimativa grosseira: pular corda forte gasta por volta de 10–13 kcal por minuto para ~75 kg. */
export const ROPE_KCAL_NOTE = 'Gasto aproximado: 10–13 kcal por minuto pulando forte (para ~75 kg). É uma estimativa: o que emagrece é o déficit da semana, não uma sessão.';

// ------------------------------------------------------------------ dieta e regras

export const RECOMP_DIET = [
  { title: 'Calorias', text: 'Cerca de 350 kcal abaixo do seu gasto (a faixa do Protocolo JKK é −300 a −400). O app calcula a meta e ajusta pela média de peso.' },
  { title: 'Proteína', text: '2,0 g por kg de peso por dia, dividida em 3 a 5 refeições com pelo menos 0,25 g/kg cada. É o que segura o músculo no déficit.' },
  { title: 'Carboidrato em volta do treino', text: 'Concentre a maior parte na refeição antes e na depois do treino: é o combustível das séries pesadas.' },
  { title: 'Gordura', text: 'No mínimo 0,8 g por kg: abaixo disso, hormônios e disposição sofrem.' },
  { title: 'Volume de comida', text: 'Legumes, verduras, frutas, feijão e água em todas as refeições: enchem o prato com poucas calorias e seguram a fome.' },
  { title: 'Fim de semana', text: 'É onde o déficit costuma se perder. Uma refeição livre por semana cabe; um fim de semana inteiro livre apaga a semana.' },
];

export const RECOMP_WEEK = [
  'Musculação do plano (3, 4 ou 5 dias), com as mesmas cargas e a mesma progressão.',
  'Cardio leve depois de 2–3 treinos por semana: esteira inclinada ou bike, de 12 a 20 min (nunca em dia de perna).',
  'Pular corda no fim de semana, seguindo a progressão de 8 semanas.',
  '8 a 10 mil passos por dia.',
  'Sono de 7 a 9 horas: dormir pouco aumenta a fome e reduz a perda de gordura.',
];

export const RECOMP_ADJUST = [
  'Peso caindo mais de 0,6 kg por semana por 2 semanas: o app sugere +100 kcal (para proteger o músculo).',
  'Peso parado por 2 semanas com a cintura igual: o app sugere −100 kcal.',
  'Cargas caindo em vários exercícios por 2 treinos seguidos: tire o cardio pós-treino da semana e durma mais antes de mexer nas calorias.',
  'Depois de 8–12 semanas, ou quando a cintura estiver onde você quer: mude o objetivo para "Ganhar massa".',
];
