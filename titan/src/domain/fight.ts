// Luta em casa — Boxe + MMA, sábado e domingo, no máximo 90 min.
// Pensado para quem já treinou luta (Muay Thai 2 anos, boxe 1 ano) e está voltando depois de 1 ano parado.
// Tudo tem cronômetro: aquecimento, cada exercício, cada round, cada descanso e as trocas entre blocos.
import { weekday } from './dates';
import { ropeFor, ropeSession, type RopeKind } from './recomp';
import type { JkkProtocol } from './types';

export const FIGHT_MAX_MIN = 90;
export const FIGHT_WEEKS = 8;
/** Semanas 1–2: retorno (técnica a 60–70%, sem força máxima nos chutes). */
export const RETURN_WEEKS = 2;
export const PREP_SEC = 10;
export const BETWEEN_EXERCISES_SEC = 15;
export const BETWEEN_BLOCKS_SEC = 25;
export type FightDay = 'sat' | 'sun';

// ------------------------------------------------------------------ golpes e movimentos (explicação simples)

export interface Move { id: string; name: string; group: 'Boxe' | 'Defesa' | 'MMA' | 'Quedas'; steps: string[]; error: string }

export const MOVES: Move[] = [
  { id: 'base', name: 'Base e guarda', group: 'Boxe', steps: ['Pés na largura dos ombros, pé de trás virado uns 45°.', 'Joelhos levemente dobrados, peso nas pontas dos pés.', 'Mãos na altura das bochechas, cotovelos colados no corpo, queixo baixo.'], error: 'Queixo alto e cotovelos abertos: deixa o rosto e as costelas expostos.' },
  { id: 'jab', name: 'Jab (1)', group: 'Boxe', steps: ['Estique a mão da frente reto até o alvo, girando o punho no fim.', 'O ombro da frente sobe para proteger o queixo.', 'Volte a mão pelo mesmo caminho, rápido, até o rosto.'], error: 'Baixar a mão antes de bater ou deixar o braço esticado lá na frente.' },
  { id: 'direto', name: 'Direto (2)', group: 'Boxe', steps: ['Gire o pé de trás (como quem apaga um cigarro) e o quadril.', 'A mão de trás vai reta, o corpo inteiro empurra o golpe.', 'A outra mão fica colada no rosto o tempo todo.'], error: 'Bater só com o braço, sem girar o pé e o quadril: perde metade da força.' },
  { id: 'cruzado', name: 'Cruzado / gancho (3)', group: 'Boxe', steps: ['Cotovelo na altura do punho, braço em "L".', 'Gire o pé da frente e o tronco juntos; o braço só acompanha.', 'Termine com a mão de volta ao rosto.'], error: 'Abrir o braço antes de bater (o golpe fica lento e avisado).' },
  { id: 'uppercut', name: 'Uppercut (5 e 6)', group: 'Boxe', steps: ['Dobre um pouco os joelhos do lado que vai bater.', 'Suba com as pernas e o quadril, punho virado para você.', 'Golpe curto, de baixo para cima, e volta para a guarda.'], error: 'Baixar a mão para "pegar impulso": abre a guarda.' },
  { id: 'lowkick', name: 'Chute baixo (na coxa)', group: 'MMA', steps: ['Dê um pequeno passo para fora com o pé da frente.', 'Gire na ponta do pé de apoio e o quadril; acerte a coxa com a canela.', 'Mãos na guarda o tempo todo; volte para a base.'], error: 'Chutar sem girar o pé de apoio (perde força e machuca o joelho).' },
  { id: 'bodykick', name: 'Chute no corpo', group: 'MMA', steps: ['Mesmo movimento do chute baixo, mais alto, na altura das costelas.', 'Gire o quadril inteiro, o braço do mesmo lado desce para equilibrar.', 'Recolha a perna rápido: no MMA, chute alto dá chance de queda.'], error: 'Deixar a perna lá: o adversário segura e derruba.' },
  { id: 'knee', name: 'Joelhada', group: 'MMA', steps: ['Mãos à frente, como se segurasse o adversário.', 'Leve o quadril para a frente e suba o joelho.', 'Pé de apoio na ponta; volte para a base.'], error: 'Subir só a perna, sem empurrar o quadril.' },
  { id: 'elbow', name: 'Cotovelada curta', group: 'MMA', steps: ['Golpe de curta distância: o cotovelo passa na altura do rosto.', 'Gire o tronco e o pé do mesmo lado.', 'A outra mão protege o rosto.'], error: 'Tentar cotovelada de longe: é golpe colado.' },
  { id: 'shot', name: 'Entrada de queda (penetration step)', group: 'MMA', steps: ['Mude de nível (dobre os joelhos, costas retas).', 'Dê um passo longo para a frente, o joelho de trás quase encosta no chão.', 'Cabeça erguida, mãos abraçando as pernas imaginárias; volte para a base.'], error: 'Abaixar a cabeça e olhar para o chão (leva joelhada).' },
  { id: 'underhook', name: 'Clinch de MMA (pegada por baixo)', group: 'MMA', steps: ['Passe o braço por baixo da axila do adversário (underhook).', 'Cabeça colada no peito/ombro dele, quadril para a frente.', 'Daqui: joelhada, se soltar com cotovelada ou empurrar e sair.'], error: 'Ficar de quadril para trás: fica fácil de derrubar.' },
  { id: 'shrimp', name: 'Fuga de quadril (shrimp)', group: 'MMA', steps: ['Deitado de lado, apoie o pé no chão.', 'Empurre o quadril para trás, como um camarão, criando espaço.', 'Mãos protegendo o rosto; repita para o outro lado.'], error: 'Empurrar com as mãos em vez de mover o quadril.' },
  { id: 'upa', name: 'Ponte (upa)', group: 'MMA', steps: ['Deitado de costas, pés perto do quadril.', 'Suba o quadril com força e gire o ombro para um lado.', 'É assim que se tira alguém montado em você.'], error: 'Ponte sem girar: o adversário só volta para o lugar.' },
  { id: 'gnp', name: 'Ground and pound (de joelhos)', group: 'MMA', steps: ['De joelhos, quadril baixo, postura firme.', 'Golpes curtos para baixo, alternando as mãos.', 'Volte a postura entre os golpes, sem cair para a frente.'], error: 'Inclinar demais para a frente e perder a base.' },
  { id: 'block', name: 'Bloqueio', group: 'Defesa', steps: ['Contra gancho: luva colada na têmpora, cotovelo protegendo a lateral.', 'Contra golpe no corpo: cotovelos para baixo, fechando as costelas.', 'Contra jab: aparar com a palma da mão de trás.'], error: 'Fechar os olhos ou virar o rosto ao bloquear.' },
  { id: 'slip', name: 'Esquiva (slip)', group: 'Defesa', steps: ['Gire um pouco o tronco e dobre o joelho do mesmo lado.', 'A cabeça sai só um palmo para fora da linha do golpe.', 'Olhe para a frente o tempo todo, nunca para o chão.'], error: 'Esquivar demais (curvado), sem conseguir devolver.' },
  { id: 'roll', name: 'Pêndulo (roll)', group: 'Defesa', steps: ['Dobre os joelhos e passe a cabeça por baixo do gancho, fazendo um "U".', 'Mantenha as mãos no rosto.', 'Saia do outro lado já pronto para bater.'], error: 'Abaixar só a cabeça, curvando as costas.' },
  { id: 'check', name: 'Checar o chute baixo', group: 'Defesa', steps: ['Levante o joelho do lado do chute, canela apontada para fora.', 'Mãos na guarda, tronco firme.', 'Volte o pé para a base rápido.'], error: 'Levantar o joelho reto para a frente (o chute passa por fora).' },
  { id: 'sprawl', name: 'Sprawl', group: 'MMA', steps: ['Jogue as duas pernas para trás e para fora.', 'Quadril no chão, peito pesado, mãos no chão à frente.', 'Volte para a base o mais rápido possível.'], error: 'Cair de joelhos (o adversário agarra as pernas).' },
  { id: 'level', name: 'Mudança de nível', group: 'MMA', steps: ['Dobre os joelhos para baixar o corpo, costas retas.', 'Cabeça erguida, olhos para a frente.', 'É a base da queda e da defesa de queda.'], error: 'Curvar as costas em vez de dobrar os joelhos.' },
  { id: 'standup', name: 'Levantar em base', group: 'MMA', steps: ['Sentado, uma mão no chão atrás e o outro braço na frente protegendo o rosto.', 'Passe a perna por baixo do corpo, para trás.', 'Levante já em guarda, sem dar as costas.'], error: 'Ficar com as duas mãos no chão e de costas.' },
  { id: 'breakfall', name: 'Queda para trás (ukemi)', group: 'Quedas', steps: ['Queixo no peito durante toda a queda.', 'Role nas costas, sem bater a cabeça.', 'Bata os dois braços no chão a 45° antes das costas chegarem.'], error: 'Pôr a mão para trás para "segurar" a queda (risco de punho e cotovelo).' },
  { id: 'sidefall', name: 'Queda lateral', group: 'Quedas', steps: ['De cócoras, deixe uma perna escorregar para o lado.', 'Caia de lado, queixo no peito.', 'Bata o braço daquele lado no chão.'], error: 'Cair em cima do ombro ou da cabeça.' },
];
export const MOVE_BY_ID: Record<string, Move> = Object.fromEntries(MOVES.map((m) => [m.id, m]));

// ------------------------------------------------------------------ estrutura dos treinos

export interface FightExercise {
  id: string;
  name: string;
  /** Como fazer, em passos simples. */
  how: string[];
  sets: number;
  workSec: number;
  /** Descanso entre as séries/rounds (s). */
  restSec: number;
  /** Repetições sugeridas dentro do tempo (ex.: "12–15"). */
  reps?: string;
  /** Faz um lado, troca, faz o outro (cada lado tem o tempo de trabalho). */
  perSide?: boolean;
  /** Foco de cada round (round 1 = item 0; se faltar, repete o último). */
  roundFocus?: string[];
  moves?: string[];
  /** Treino de reflexo: o celular dá sinais aleatórios durante o trabalho. */
  reflex?: boolean;
  muscles?: string[];
}

export type BlockKind = 'warmup' | 'rounds' | 'reflex' | 'rope' | 'strength' | 'abs' | 'cooldown';
export interface FightBlock { id: string; title: string; kind: BlockKind; goal: string; exercises: FightExercise[]; minutes: number }

export interface FightSession {
  day: FightDay;
  title: string;
  focus: string;
  week: number;
  returnPhase: boolean;
  blocks: FightBlock[];
  totalMinutes: number;
  rope: RopeKind | null;
  abs: AbsWorkoutId;
  note?: string;
}

export const SIDE_SWITCH_SEC = 5;

/** Segundos de um exercício, com descansos entre séries (sem a troca para o próximo exercício). */
export function exerciseSeconds(e: FightExercise): number {
  const perSet = e.perSide ? e.workSec * 2 + SIDE_SWITCH_SEC : e.workSec;
  return e.sets * perSet + (e.sets - 1) * e.restSec;
}
const blockSeconds = (b: Omit<FightBlock, 'minutes'>) => b.exercises.reduce((a, e) => a + exerciseSeconds(e), 0) + (b.exercises.length - 1) * BETWEEN_EXERCISES_SEC;
const mkBlock = (b: Omit<FightBlock, 'minutes'>): FightBlock => ({ ...b, minutes: Math.round(blockSeconds(b) / 60) });

// ------------------------------------------------------------------ passos do cronômetro guiado

export type StepPhase = 'prep' | 'work' | 'rest';
export interface FightStep {
  phase: StepPhase;
  seconds: number;
  title: string;
  /** O que fazer agora (foco do round, lado, ou "Respire, beba água"). */
  cue: string;
  blockId: string;
  blockTitle: string;
  exerciseId: string;
  set?: { i: number; n: number };
  side?: 'direito' | 'esquerdo';
  reflex?: boolean;
}

/** Transforma blocos em passos com tempo: preparar, cada série/lado, descansos e trocas. */
export function blockSteps(blocks: FightBlock[], withPrep = true): FightStep[] {
  const out: FightStep[] = [];
  blocks.forEach((b, bi) => {
    b.exercises.forEach((e, ei) => {
      const first = bi === 0 && ei === 0;
      if (first && withPrep) out.push({ phase: 'prep', seconds: PREP_SEC, title: `Prepare-se: ${e.name}`, cue: e.how[0], blockId: b.id, blockTitle: b.title, exerciseId: e.id });
      else if (ei > 0) out.push({ phase: 'rest', seconds: BETWEEN_EXERCISES_SEC, title: `Próximo: ${e.name}`, cue: e.how[0], blockId: b.id, blockTitle: b.title, exerciseId: e.id });
      else out.push({ phase: 'rest', seconds: BETWEEN_BLOCKS_SEC, title: `Próximo bloco: ${b.title}`, cue: `Beba água. Depois: ${e.name}.`, blockId: b.id, blockTitle: b.title, exerciseId: e.id });
      for (let s = 1; s <= e.sets; s++) {
        const focus = e.roundFocus ? e.roundFocus[Math.min(s - 1, e.roundFocus.length - 1)] : (e.reps ? `${e.reps} repetições, sem pressa` : e.how[0]);
        const base = { blockId: b.id, blockTitle: b.title, exerciseId: e.id, set: { i: s, n: e.sets }, reflex: e.reflex };
        if (e.perSide) {
          out.push({ ...base, phase: 'work', seconds: e.workSec, title: e.name, cue: focus, side: 'direito' });
          out.push({ ...base, phase: 'rest', seconds: SIDE_SWITCH_SEC, title: 'Troque de lado', cue: 'Lado esquerdo', side: 'esquerdo' });
          out.push({ ...base, phase: 'work', seconds: e.workSec, title: e.name, cue: focus, side: 'esquerdo' });
        } else out.push({ ...base, phase: 'work', seconds: e.workSec, title: e.name, cue: focus });
        if (s < e.sets) out.push({ ...base, phase: 'rest', seconds: e.restSec, title: 'Descanso', cue: s + 1 <= e.sets && e.roundFocus ? `Próximo round: ${e.roundFocus[Math.min(s, e.roundFocus.length - 1)]}` : 'Respire fundo e solte os braços.' });
      }
    });
  });
  return out;
}

export const sessionSteps = (s: FightSession) => blockSteps(s.blocks);
export const stepsSeconds = (steps: FightStep[]) => steps.reduce((a, x) => a + x.seconds, 0);

// ------------------------------------------------------------------ semana, dia

export function fightWeek(start: string | undefined, today: string): number {
  if (!start) return 1;
  const w = Math.floor((Date.parse(today) - Date.parse(start)) / (7 * 86400000));
  return (((w % FIGHT_WEEKS) + FIGHT_WEEKS) % FIGHT_WEEKS) + 1;
}

export const fightDayOf = (dateIso: string): FightDay | null => {
  const d = weekday(dateIso);
  return d === 6 ? 'sat' : d === 0 ? 'sun' : null;
};

/** Intervalo entre os sinais do treino de reflexo: fica mais curto a cada 2 semanas. */
export function reflexGap(week: number): [number, number] {
  const w = Math.max(1, Math.min(FIGHT_WEEKS, week));
  return w <= 2 ? [3, 6] : w <= 4 ? [2.5, 5] : w <= 6 ? [2, 4] : [1.5, 3.5];
}

export const REFLEX_CUES: { beeps: number; label: string; text: string }[] = [
  { beeps: 1, label: '1', text: 'Jab-direto e volta para a guarda' },
  { beeps: 2, label: '2', text: 'Esquiva para fora + direto (contra-ataque)' },
  { beeps: 3, label: '3', text: 'Chute baixo (ou sprawl) e volta em base' },
];

// ------------------------------------------------------------------ blocos

const WARMUP = (short = false): FightBlock => mkBlock({
  id: 'warmup', title: 'Aquecimento', kind: 'warmup', goal: 'Acordar as articulações e subir a temperatura antes de bater.',
  exercises: [
    ...(short ? [] : [{ id: 'jacks', name: 'Polichinelo', how: ['Pule abrindo braços e pernas, depois feche.', 'Ritmo leve, respirando pelo nariz.'], sets: 1, workSec: 60, restSec: 0 }]),
    { id: 'neck', name: 'Pescoço: sim, não e inclinação', how: ['Movimentos LENTOS: sim (cima-baixo), não (lado-lado), orelha no ombro.', 'Nunca gire a cabeça rápido.'], sets: 1, workSec: 45, restSec: 0 },
    { id: 'joints', name: 'Ombros e quadril em círculos', how: ['Círculos grandes com os ombros, para trás e para a frente.', 'Mãos na cintura, círculos com o quadril.'], sets: 1, workSec: 60, restSec: 0 },
    { id: 'trunk', name: 'Rotação de tronco em guarda', how: ['Em base, gire o tronco de um lado para o outro.', 'Os pés giram junto, como num cruzado leve.'], sets: 1, workSec: 45, restSec: 0 },
    { id: 'ankles', name: 'Tornozelos, punhos e joelhos', how: ['Círculos com cada tornozelo e com os punhos.', 'Joelhos juntos, pequenos círculos.'], sets: 1, workSec: 45, restSec: 0 },
    ...(short ? [] : [{ id: 'easyshadow', name: 'Sombra leve só deslocando', how: ['Ande em base para a frente, para trás e para os lados.', 'Solte jabs leves, sem força.'], sets: 1, workSec: 90, restSec: 0, moves: ['base', 'jab'] }]),
  ],
});

const COOLDOWN = mkBlock({
  id: 'cooldown', title: 'Volta à calma', kind: 'cooldown', goal: 'Baixar o ritmo e alongar o que mais trabalhou.',
  exercises: [
    { id: 'breath', name: 'Respiração 4-4-6', how: ['Inspire em 4 s, segure 4 s, solte em 6 s.', 'Ombros soltos.'], sets: 1, workSec: 60, restSec: 0 },
    { id: 'chest', name: 'Alongar peitoral na parede', how: ['Antebraço apoiado na parede, gire o corpo para o outro lado.', 'Sem dor, só tensão leve.'], sets: 1, workSec: 30, restSec: 0, perSide: true },
    { id: 'hipflexor', name: 'Alongar quadril (afundo)', how: ['Um joelho no chão, o outro pé à frente.', 'Empurre o quadril para a frente, tronco reto.'], sets: 1, workSec: 30, restSec: 0, perSide: true },
    { id: 'hams', name: 'Alongar posterior e panturrilha', how: ['Calcanhar apoiado à frente, joelho esticado.', 'Incline o tronco com a coluna reta.'], sets: 1, workSec: 30, restSec: 0, perSide: true },
  ],
});

function ropeBlock(kind: RopeKind, week: number): FightBlock {
  const r = ropeSession(kind, week);
  return mkBlock({
    id: 'rope', title: kind === 'interval' ? 'Corda intervalada' : 'Corda contínua leve', kind: 'rope',
    goal: kind === 'interval' ? 'Cardio forte do fim de semana (o mesmo plano da página Cardio).' : 'Cardio leve: dá para falar frases curtas pulando.',
    exercises: [{
      id: 'rope', name: kind === 'interval' ? 'Pular corda forte' : 'Pular corda leve', sets: r.rounds, workSec: r.workSec, restSec: r.restSec,
      how: ['Pule na ponta dos pés, joelhos levemente dobrados.', 'Gire a corda com os punhos, não com os braços.', 'É o mesmo "quique" da base de luta.'],
    }],
  });
}

function saturday(week: number, rope: RopeKind | null, gymDay: boolean): FightSession {
  const back = week <= RETURN_WEEKS;
  const late = week >= 5;
  const blocks: FightBlock[] = [
    WARMUP(),
    mkBlock({
      id: 'boxing', title: 'Boxe: fundamentos', kind: 'rounds', goal: back ? 'Relembrar a técnica a 60–70% de força. Bonito e solto antes de rápido.' : 'Golpes com o corpo inteiro e saída depois de cada combinação.',
      exercises: [{
        id: 'boxing', name: 'Sombra de boxe (no espelho)', sets: 3, workSec: 180, restSec: 60, moves: late ? ['base', 'jab', 'direto', 'cruzado', 'uppercut'] : ['base', 'jab', 'direto', 'cruzado'],
        how: ['Em frente ao espelho, em base.', 'Cada golpe sai e VOLTA para o rosto.', 'Depois de cada combinação, saia para o lado.'],
        roundFocus: back
          ? ['Base, guarda e jab: só o jab, entrando e saindo.', 'Jab-direto (1-2), girando o pé de trás no direto.', '1-2-3 devagar, perfeito, saindo para o lado.']
          : late ? ['1-2-3 e 1-2-3-2 com saída lateral.', 'Jab duplo + direto (1-1-2) e uppercut de trás (6).', 'Livre: todas as combinações, ritmo de luta.']
            : ['1-2 e 1-2-3, saindo depois de cada uma.', 'Jab no corpo + direto no rosto (1b-2).', 'Livre: combinações curtas, ritmo moderado.'],
      }],
    }),
    mkBlock({
      id: 'mma', title: 'MMA em pé: chutes, joelhada e entrada de queda', kind: 'rounds', goal: back ? 'Chutes baixos e devagar no ar, entrada de queda sem explosão. Nada de força máxima nas primeiras 2 semanas.' : 'Misturar mãos, chutes e entrada de queda: o adversário não sabe o que vem.',
      exercises: [{
        id: 'mma', name: 'Sombra de MMA', sets: 3, workSec: 180, restSec: 60, moves: ['lowkick', 'bodykick', 'knee', 'shot', 'sprawl'],
        how: ['Base de MMA: um pouco mais larga e baixa que a do boxe, mãos um pouco mais abertas.', 'Gire no pé de apoio em todo chute e recolha a perna rápido.', 'Depois de cada ação, volte para a base.'],
        roundFocus: back
          ? ['Chute baixo devagar, alternando as pernas.', 'Mudança de nível + entrada de queda, devagar.', '1-2 + joelhada, sem força.']
          : late ? ['1-2 + chute baixo + saída lateral.', '1-2 + entrada de queda (finta de soco, desce na perna).', 'Livre: mãos, chutes, joelhada, queda e sprawl.']
            : ['Chute baixo e chute no corpo, alternando.', 'Jab + entrada de queda + volta para a base.', '1-2 + joelhada + sprawl.'],
      }],
    }),
    mkBlock({
      id: 'feet', title: 'Pés e agilidade', kind: 'rounds', goal: 'Mexer os pés sem perder a base: quem se move bem apanha menos.',
      exercises: [{
        id: 'feet', name: 'Deslocamento em base', sets: 3, workSec: 120, restSec: 30, moves: ['base'],
        how: ['Passos curtos: o pé do lado para onde vai sai primeiro.', 'Os pés nunca se cruzam nem se juntam.', 'A cabeça não sobe e desce.'],
        roundFocus: ['Passo-arrasta nas 4 direções.', 'Pivô: pé da frente fixo, gire o de trás 90° e volte.', late ? 'Ângulos: 1-2, passo lateral, 1-2, saída em diagonal.' : 'Entra com jab, sai com passo atrás (in-out).'],
      }],
    }),
    mkBlock({
      id: 'reflex', title: 'Reflexo por som e visão', kind: 'reflex', goal: 'Reagir rápido ao sinal e voltar para a guarda.',
      exercises: [{
        id: 'reflex', name: 'Reaja aos sinais', sets: 3, workSec: 120, restSec: 30, reflex: true, moves: ['jab', 'direto', 'slip', 'lowkick', 'sprawl'],
        how: ['O celular apita 1, 2 ou 3 vezes e mostra o número.', '1 = jab-direto · 2 = esquiva + direto · 3 = chute baixo (ou sprawl).', 'Espere o sinal: não antecipe.'],
        roundFocus: ['Olhando a tela.', 'Só pelo som, olhando a parede.', late ? 'Olhos fechados, parado em base.' : 'Só pelo som, andando em base entre os sinais.'],
      }],
    }),
    mkBlock({
      id: 'counter', title: 'Oportunidade de golpe', kind: 'rounds', goal: 'Ver o buraco que o adversário deixa ao atacar.',
      exercises: [{
        id: 'counter', name: 'Sombra com contra-ataques', sets: 2, workSec: 180, restSec: 60, moves: ['slip', 'direto', 'check', 'sprawl'],
        how: ['Imagine o adversário atacando.', 'Defenda e devolva NA HORA.', 'Bateu, saiu do lugar.'],
        roundFocus: ['Ele jabeia → esquiva para fora + direto. Ele baixa a mão → cruzado por cima.', 'Ele chuta baixo → checa + 1-2. Ele tenta queda → sprawl + volta com 1-2.'],
      }],
    }),
  ];
  if (rope) blocks.push(ropeBlock(rope, week));
  blocks.push(absBlock('A', week));
  blocks.push(COOLDOWN);
  return finish({ day: 'sat', week, returnPhase: back, rope, abs: 'A', blocks, title: 'Sábado · Ataque, pés e reflexo', focus: 'Boxe e MMA na sombra, deslocamento, reflexo e contra-ataque. Fecha com abdômen A.',
    note: gymDay ? 'Seu plano de 5 dias tem academia no sábado: faça a luta em outro horário (de preferência 6 h depois).' : undefined });
}

function sunday(week: number, rope: RopeKind | null): FightSession {
  const back = week <= RETURN_WEEKS;
  const late = week >= 5;
  const blocks: FightBlock[] = [];
  if (rope === 'steady') blocks.push(ropeBlock(rope, week));
  blocks.push(WARMUP(rope === 'steady'));
  blocks.push(
    mkBlock({
      id: 'defense', title: 'Defesa: não ser acertado em cheio', kind: 'rounds', goal: 'Bloquear, esquivar e checar, sempre respondendo.',
      exercises: [{
        id: 'defense', name: 'Defesas na sombra', sets: 3, workSec: 180, restSec: 60, moves: ['block', 'slip', 'roll', 'check'],
        how: ['Olhos abertos o tempo todo.', 'Queixo baixo, mãos no rosto.', 'Depois de cada defesa, devolva um golpe.'],
        roundFocus: [
          'Bloqueios: gancho (luva na têmpora), corpo (cotovelos) e jab (palma).',
          'Esquiva + pêndulo: use uma corda esticada na altura do queixo como guia.',
          late ? 'Defesa + contra: esquiva-direto, pêndulo-cruzado, checa-chute.' : 'Checar chute baixo dos dois lados + passo atrás.',
        ],
      }],
    }),
    mkBlock({
      id: 'clinch', title: 'MMA: clinch, quedas e chão', kind: 'rounds', goal: back ? 'Relembrar posições, sem explosão.' : 'Defender queda, sair de baixo e voltar a ficar de pé rápido.',
      exercises: [{
        id: 'clinch', name: 'Clinch, sprawl e chão', sets: 3, workSec: 180, restSec: 60, moves: ['underhook', 'knee', 'sprawl', 'shrimp', 'upa', 'standup'],
        how: ['No colchonete ou na cama para a parte do chão.', 'No sprawl, quadril no chão e volta rápido para a base.', 'No chão: mexa o quadril e levante sem dar as costas.'],
        roundFocus: ['Clinch com pegada por baixo + joelhadas alternadas.', back ? 'Sprawl devagar + volta para a base.' : 'Sprawl + volta para a base + 1-2.', 'Chão: fuga de quadril dos dois lados, ponte e levantar em base.'],
      }],
    }),
    mkBlock({
      id: 'absorb', title: 'Aprender a apanhar (seguro)', kind: 'strength', goal: 'Cair sem bater a cabeça, pescoço e tronco fortes e não travar quando for tocado.',
      exercises: [
        { id: 'breakfall', name: 'Queda para trás (ukemi)', sets: 3, workSec: 40, restSec: 20, reps: '5 quedas', moves: ['breakfall'], how: ['Em colchonete ou na cama. Comece sentado, depois de cócoras.', 'Queixo no peito, role nas costas.', 'Bata os braços no chão a 45°.'] },
        { id: 'sidefall', name: 'Queda lateral', sets: 2, workSec: 30, restSec: 15, perSide: true, reps: '4 quedas', moves: ['sidefall'], how: ['De cócoras, escorregue uma perna para o lado.', 'Caia de lado, queixo no peito.', 'Bata o braço daquele lado.'] },
        { id: 'neckiso', name: 'Pescoço isométrico (4 direções)', sets: 2, workSec: 60, restSec: 20, how: ['Mão na testa: empurre e resista sem mexer a cabeça, 15 s.', 'Repita atrás e nos dois lados (15 s cada).', 'Força moderada, sem dor.'] },
        { id: 'composure', name: 'Compostura', sets: 2, workSec: 45, restSec: 15, how: ['Em guarda, dê tapinhas no próprio antebraço e ombro (como se fosse tocado).', 'Responda na hora com jab e saia do lugar.', 'Não feche os olhos, não vire de costas.'] },
      ],
    }),
    mkBlock({
      id: 'senses', title: 'Equilíbrio e guarda sem olhar', kind: 'rounds', goal: 'Sentir a posição do corpo sem ver: é o que mantém você de pé.',
      exercises: [{
        id: 'senses', name: 'Base de olhos fechados', sets: 2, workSec: 90, restSec: 30, moves: ['base'],
        how: ['Em base, feche os olhos.', 'Solte um 1-2 devagar e abra: a guarda ainda está no rosto?', 'Corrija e repita.'],
        roundFocus: ['Base e 1-2 de olhos fechados.', 'Equilíbrio numa perna (troque na metade) + chute baixo lento.'],
      }],
    }),
  );
  if (rope === 'interval') blocks.push(ropeBlock(rope, week));
  blocks.push(absBlock('B', week));
  blocks.push(COOLDOWN);
  return finish({ day: 'sun', week, returnPhase: back, rope, abs: 'B', blocks, title: 'Domingo · Defesa, MMA e aprender a apanhar', focus: 'Defesas de boxe e MMA, clinch, sprawl, chão, quedas seguras e equilíbrio. Fecha com abdômen B.' });
}

function finish(s: Omit<FightSession, 'totalMinutes'>): FightSession {
  return { ...s, totalMinutes: Math.round(stepsSeconds(blockSteps(s.blocks)) / 60) };
}

/**
 * Sessão de luta do fim de semana. A corda do objetivo "perder gordura e ganhar massa" entra DENTRO da luta
 * (mesmo plano e semana da página Cardio) para não somar dois treinos no mesmo dia.
 */
export function fightSession(day: FightDay, opts: { week: number; gymWeek?: number; protocol?: JkkProtocol | null; withRope?: boolean; date?: string }): FightSession {
  const week = Math.max(1, Math.min(FIGHT_WEEKS, Math.round(opts.week)));
  const protocol = opts.protocol ?? 'jkk4';
  const ref = opts.date ?? (day === 'sat' ? '2026-11-14' : '2026-11-15');
  const rope = opts.withRope === false ? null : ropeFor(protocol, ref);
  const s = day === 'sat' ? saturday(week, rope, protocol === 'jkk') : sunday(week, rope);
  if (s.rope) {
    const i = s.blocks.findIndex((b) => b.id === 'rope');
    s.blocks[i] = ropeBlock(s.rope, opts.gymWeek ?? week);
    return finish(s);
  }
  return s;
}

// ------------------------------------------------------------------ abdômen

export type AbsWorkoutId = 'A' | 'B' | 'C';
export const ABS_MUSCLES: Record<string, string> = {
  reto: 'Reto abdominal (o "tanquinho")', infra: 'Parte de baixo do reto (infra)', obliquos: 'Oblíquos (laterais da cintura)',
  transverso: 'Transverso (a "cinta" por dentro)', lombar: 'Lombar e eretores (o outro lado do core)',
};

interface AbsDef { id: AbsWorkoutId; title: string; when: string; focus: string; exercises: FightExercise[] }

export const ABS_WORKOUTS: AbsDef[] = [
  {
    id: 'A', title: 'Abdômen A · Reto e infra', when: 'Sábado, no fim da luta', focus: 'A parte da frente: em cima e embaixo.',
    exercises: [
      { id: 'crunch', name: 'Abdominal curto (crunch)', sets: 3, workSec: 40, restSec: 20, reps: '15–20', muscles: ['reto'], how: ['Deitado, joelhos dobrados, mãos cruzadas no peito.', 'Suba só as escápulas do chão, soltando o ar.', 'Desça devagar, sem relaxar totalmente.'] },
      { id: 'legraise', name: 'Elevação de pernas deitado', sets: 3, workSec: 40, restSec: 20, reps: '10–15', muscles: ['infra'], how: ['Deitado, mãos sob o quadril, lombar colada no chão.', 'Suba as pernas esticadas até 90°.', 'Desça em 3 s sem encostar os pés no chão.'] },
      { id: 'hollow', name: 'Hollow hold (canoa)', sets: 3, workSec: 30, restSec: 30, muscles: ['reto', 'transverso'], how: ['Lombar colada no chão, braços e pernas estendidos no ar.', 'Fica parado, como uma canoa.', 'Mais fácil: joelhos dobrados.'] },
      { id: 'deadbug', name: 'Dead bug', sets: 2, workSec: 45, restSec: 15, reps: '8 de cada lado', muscles: ['transverso', 'reto'], how: ['Deitado, braços para o teto, joelhos a 90°.', 'Estique o braço direito e a perna esquerda juntos, sem tirar a lombar do chão.', 'Volte e troque o lado.'] },
    ],
  },
  {
    id: 'B', title: 'Abdômen B · Oblíquos e transverso', when: 'Domingo, no fim da luta', focus: 'As laterais da cintura e a "cinta" interna (rotação e anti-rotação, como no chute e no cruzado).',
    exercises: [
      { id: 'bicycle', name: 'Bicicleta', sets: 3, workSec: 40, restSec: 20, reps: '20 toques (10 cada lado)', muscles: ['obliquos', 'reto'], how: ['Mãos atrás da cabeça, sem puxar o pescoço.', 'Leve o cotovelo em direção ao joelho oposto, girando o tronco.', 'Devagar: a torção é que trabalha.'] },
      { id: 'sideplank', name: 'Prancha lateral', sets: 2, workSec: 30, restSec: 15, perSide: true, muscles: ['obliquos', 'transverso'], how: ['Apoie no antebraço, cotovelo embaixo do ombro.', 'Quadril alto, corpo reto da cabeça aos pés.', 'Mais fácil: joelhos no chão.'] },
      { id: 'twist', name: 'Russian twist (sem peso)', sets: 3, workSec: 30, restSec: 20, reps: '20 toques', muscles: ['obliquos'], how: ['Sentado, tronco inclinado para trás, pés no chão (ou no ar, mais difícil).', 'Gire o tronco e toque o chão de um lado e do outro.', 'Coluna reta, não curve.'] },
      { id: 'shouldertap', name: 'Prancha com toque no ombro', sets: 2, workSec: 40, restSec: 20, reps: '20 toques', muscles: ['transverso', 'obliquos'], how: ['Em prancha alta (braços esticados), pés afastados.', 'Toque o ombro oposto com uma mão, alternando.', 'O quadril NÃO balança: é isso que trabalha.'] },
      { id: 'vacuum', name: 'Vácuo abdominal', sets: 3, workSec: 20, restSec: 20, muscles: ['transverso'], how: ['Em pé ou de quatro apoios, solte todo o ar.', 'Puxe o umbigo para dentro e para cima e segure.', 'Respire curto se precisar; não prenda até ficar tonto.'] },
    ],
  },
  {
    id: 'C', title: 'Abdômen C · Força e lombar', when: 'Quarta-feira (dia sem academia) ou qualquer dia livre', focus: 'Abdômen mais forte para chutar e aguentar golpe no corpo, e lombar protegida.',
    exercises: [
      { id: 'plank', name: 'Prancha frontal', sets: 3, workSec: 45, restSec: 20, muscles: ['transverso', 'reto'], how: ['Antebraços no chão, corpo reto.', 'Contraia glúteo e abdômen como se fosse levar um soco.', 'Não deixe o quadril cair.'] },
      { id: 'climbers', name: 'Mountain climber', sets: 3, workSec: 30, restSec: 20, muscles: ['reto', 'infra'], how: ['Em prancha alta, traga um joelho ao peito e troque rápido.', 'Quadril baixo, ombros em cima das mãos.'] },
      { id: 'reversecrunch', name: 'Abdominal invertido', sets: 3, workSec: 40, restSec: 20, reps: '12–15', muscles: ['infra'], how: ['Deitado, joelhos dobrados no ar.', 'Leve os joelhos ao peito tirando o quadril do chão.', 'Desça devagar.'] },
      { id: 'birddog', name: 'Bird dog', sets: 2, workSec: 40, restSec: 15, reps: '8 de cada lado', muscles: ['lombar', 'transverso'], how: ['De quatro apoios, estique o braço direito e a perna esquerda.', 'Segure 2 s com a coluna reta e troque.', 'Sem girar o quadril.'] },
      { id: 'superman', name: 'Superman', sets: 2, workSec: 30, restSec: 20, reps: '12', muscles: ['lombar'], how: ['De barriga para baixo, braços à frente.', 'Tire braços e pernas do chão juntos, segure 2 s.', 'Desça devagar.'] },
    ],
  },
];

/** Progressão do abdômen: semanas 3–4 +5 s; 5–8 +10 s e +1 série no primeiro exercício. */
export function absWorkout(id: AbsWorkoutId, week: number): FightBlock & { def: AbsDef } {
  const def = ABS_WORKOUTS.find((w) => w.id === id)!;
  const add = week >= 5 ? 10 : week >= 3 ? 5 : 0;
  const exercises = def.exercises.map((e, i) => ({ ...e, workSec: e.workSec + add, sets: e.sets + (week >= 5 && i === 0 ? 1 : 0) }));
  return { ...mkBlock({ id: `abs${id}`, title: def.title, kind: 'abs', goal: def.focus, exercises }), def };
}

function absBlock(id: AbsWorkoutId, week: number): FightBlock {
  const { def: _def, ...block } = absWorkout(id, week);
  void _def;
  return block;
}

export const ABS_TRUTH = [
  'O abdômen fica forte com estes treinos. Para ficar DEFINIDO (aparecer), a gordura da barriga precisa baixar: isso vem da dieta e do cardio, não do abdominal. Nenhum exercício queima a gordura do lugar.',
  'Os treinos A, B e C juntos cobrem todos os músculos: reto (em cima e infra), oblíquos, transverso e lombar.',
  '3 vezes por semana é o suficiente: A no sábado, B no domingo, C na quarta. O treino da academia (Pernas A e B) já tem elevação de pernas, abdominal no cabo e prancha lateral.',
  'Respire: solte o ar na subida. Dor na lombar? Pare e diminua a amplitude.',
];

// ------------------------------------------------------------------ textos

export const FIGHT_INTRO = {
  title: 'Luta em casa · Boxe + MMA',
  text: 'Dois treinos por semana, sábado e domingo, de até 90 minutos, com cronômetro guiado em tudo. Como você já treinou (Muay Thai 2 anos, boxe 1 ano) e está parado há 1 ano, as 2 primeiras semanas são de retorno: técnica a 60–70%, sem força máxima nos chutes.',
  equipment: ['Espaço de ~2 × 2 m e um espelho (ou a câmera do celular para se filmar).', 'Corda (a mesma do cardio).', 'Colchonete ou a cama para as quedas e o abdômen.', 'Opcional: saco de pancada e luvas.'],
};

export const RETURN_TIPS = [
  'Semanas 1 e 2: força a 60–70%. A técnica volta rápido; tendões e articulações demoram mais. É aí que quem volta se machuca.',
  'Chutes: comece baixos e devagar. A canela e o quadril precisam readaptar antes de chutar forte (no saco, só a partir da semana 3).',
  'Fôlego: o primeiro mês cansa mais do que você lembra. Normal: ele volta em 3–4 semanas.',
  'Quer voltar a fazer luta com contato (sparring)? Só em academia, com professor e proteção, depois de 4 semanas destes treinos.',
];

export const FIGHT_PRINCIPLES = [
  { title: 'Técnica antes de força', text: 'Devagar e perfeito primeiro. Velocidade e força vêm quando o movimento está certo.' },
  { title: 'Bateu, saiu', text: 'Depois de qualquer golpe: mão de volta ao rosto e saia do lugar (lado ou trás).' },
  { title: 'Filme-se', text: 'Grave 1 round por semana. O erro que você não sente aparece no vídeo.' },
  { title: 'Não atrapalha a musculação', text: 'Técnica e condicionamento moderado não tiram músculo. A corda do fim de semana já está dentro da luta.' },
  { title: 'Progressão de 8 semanas', text: 'Semanas 1–2: retorno. 3–4: combinações de 2–3 golpes. 5–8: combinações maiores, defesa + contra, reflexo mais rápido e de olhos fechados. Depois recomeça.' },
];

export const ABSORB_TRUTH = {
  title: 'Aprender a apanhar: o que funciona de verdade',
  points: [
    'Ninguém "acostuma" a cabeça a levar soco. Cada pancada na cabeça soma dano ao cérebro; o treino aqui é para levar MENOS golpes em cheio e absorver melhor os que passarem — nunca para levar pancada de propósito.',
    'O que derruba é o golpe que você não vê e que pega o queixo com a cabeça solta: queixo baixo, olhos abertos, dentes encostados (com protetor bucal quando tiver contato), pescoço forte e guarda que volta.',
    'Golpe no corpo: expire e trave o abdômen na hora do impacto. Por isso o abdômen está em todo treino.',
    'Saber cair evita a pior parte: bater a cabeça no chão. Queixo no peito e braço batendo no chão.',
    'Contato de verdade (sparring) só em academia, com professor, luvas de 14–16 oz, protetor bucal e intensidade leve.',
  ],
  stop: 'Pare e procure atendimento se tiver, depois de qualquer pancada na cabeça: dor de cabeça que não passa, vômito, confusão, visão dupla, sonolência estranha ou perda de memória.',
};

export const FIGHT_GLOSSARY: [string, string][] = [
  ['1', 'Jab (mão da frente)'], ['2', 'Direto (mão de trás)'], ['3', 'Cruzado/gancho da frente'], ['4', 'Gancho de trás'], ['5', 'Uppercut da frente'], ['6', 'Uppercut de trás'],
  ['1b', 'Jab no corpo'], ['Checar', 'Bloquear o chute baixo com a canela'], ['Underhook', 'Pegada por baixo da axila no clinch'], ['Shrimp', 'Fuga de quadril no chão'], ['Sprawl', 'Jogar as pernas para trás contra a queda'],
];
