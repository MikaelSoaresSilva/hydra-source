// Luta em casa — fundamentos de Boxe e MMA para sábado e domingo, no máximo 90 minutos.
// Treino solo (sem parceiro e sem saco obrigatório): técnica, pés, reflexo, sentidos,
// oportunidade de golpe e "aprender a apanhar" do jeito seguro — defesa, pescoço, tronco e quedas.
// Nada aqui substitui um professor: sparring (luta com contato) só em academia, com proteção.
import { weekday } from './dates';
import { ropeFor, ropeSession, type RopeKind } from './recomp';
import type { JkkProtocol } from './types';

export const FIGHT_MAX_MIN = 90;
export const FIGHT_WEEKS = 8;
export type FightDay = 'sat' | 'sun';

export type BlockKind = 'warmup' | 'rounds' | 'reflex' | 'rope' | 'strength' | 'cooldown';
export interface FightBlock {
  id: string;
  title: string;
  kind: BlockKind;
  /** Minutos do bloco (inclui os descansos entre rounds). */
  minutes: number;
  rounds?: number;
  workSec?: number;
  restSec?: number;
  /** O que fazer em cada round (round 1 = item 0; se houver menos itens que rounds, repete o último). */
  drills: string[];
  cues?: string[];
}

export interface FightSession {
  day: FightDay;
  title: string;
  focus: string;
  week: number;
  blocks: FightBlock[];
  totalMinutes: number;
  rope: RopeKind | null;
  note?: string;
}

/** Semana do treino de luta (1–8, depois recomeça com tudo um pouco mais rápido na sua cabeça e nos pés). */
export function fightWeek(start: string | undefined, today: string): number {
  if (!start) return 1;
  const w = Math.floor((Date.parse(today) - Date.parse(start)) / (7 * 86400000));
  return (((w % FIGHT_WEEKS) + FIGHT_WEEKS) % FIGHT_WEEKS) + 1;
}

export const fightDayOf = (dateIso: string): FightDay | null => {
  const d = weekday(dateIso);
  return d === 6 ? 'sat' : d === 0 ? 'sun' : null;
};

const roundsMin = (rounds: number, work: number, rest: number) => Math.round((rounds * work + (rounds - 1) * rest) / 60);

function rounds(id: string, title: string, n: number, work: number, rest: number, drills: string[], cues?: string[]): FightBlock {
  return { id, title, kind: id === 'reflex' ? 'reflex' : 'rounds', rounds: n, workSec: work, restSec: rest, minutes: roundsMin(n, work, rest) + 1, drills, cues };
}

/** Intervalo entre os sinais do treino de reflexo: fica mais curto (mais difícil) a cada 2 semanas. */
export function reflexGap(week: number): [number, number] {
  const w = Math.max(1, Math.min(FIGHT_WEEKS, week));
  return w <= 2 ? [3, 6] : w <= 4 ? [2.5, 5] : w <= 6 ? [2, 4] : [1.5, 3.5];
}

/** Comandos do treino de reflexo: o app apita N vezes (e mostra o número) e você reage. */
export const REFLEX_CUES: { beeps: number; label: string; text: string }[] = [
  { beeps: 1, label: '1', text: 'Jab-direto e volta para a guarda' },
  { beeps: 2, label: '2', text: 'Esquiva para fora + direto (contra-ataque)' },
  { beeps: 3, label: '3', text: 'Sprawl (joga as pernas para trás) e volta em base' },
];

const WARMUP: FightBlock = {
  id: 'warmup', title: 'Aquecimento e mobilidade', kind: 'warmup', minutes: 7,
  drills: [
    'Polichinelo ou trote parado: 1 min.',
    'Pescoço: sim/não/inclinação, 5 lentos de cada (nunca girar rápido).',
    'Ombros e quadril: círculos 10 de cada lado; rotação de tronco com guarda alta 20×.',
    'Tornozelos e punhos: círculos 10 de cada lado (é onde se machuca mais no boxe e na corda).',
    'Sombra bem leve, só deslocando: 2 min, soltando os braços.',
  ],
};

const COOLDOWN: FightBlock = {
  id: 'cooldown', title: 'Volta à calma', kind: 'cooldown', minutes: 5,
  drills: [
    'Respiração 4-4-6 (inspira 4 s, segura 4 s, solta em 6 s) por 1 min.',
    'Alongar peitoral na parede, panturrilha e posterior de coxa: 30 s cada.',
    'Anote no fim: o que saiu bem e qual erro apareceu mais (ex.: mão de trás baixando).',
  ],
};

function ropeBlock(kind: RopeKind, week: number): FightBlock {
  const r = ropeSession(kind, week);
  return {
    id: 'rope', title: kind === 'interval' ? 'Corda intervalada (o cardio de sábado)' : 'Corda contínua leve (o cardio de domingo)', kind: 'rope',
    minutes: r.mainMinutes + 1, rounds: r.rounds, workSec: r.workSec, restSec: r.restSec,
    drills: [kind === 'interval'
      ? `${r.rounds} séries de ${r.workSec} s forte com ${r.restSec} s de descanso — é o mesmo plano da página Cardio, aqui ele já está dentro da luta.`
      : `${r.rounds} séries de ${r.workSec / 60} min em ritmo leve com ${r.restSec} s de descanso: dá para falar frases curtas pulando.`,
    'Pule na ponta dos pés, joelho levemente dobrado: é o mesmo "quique" da base de luta.'],
  };
}

function saturday(week: number, rope: RopeKind | null, gymDay: boolean): FightSession {
  const late = week >= 5;
  const blocks: FightBlock[] = [
    WARMUP,
    rounds('fund', 'Fundamentos de ataque (no espelho)', 4, 180, 60, [
      'Base e guarda: pés na largura dos ombros, pé de trás 45°, calcanhar de trás levemente fora do chão, queixo baixo, mãos na altura das bochechas, cotovelos fechados. 3 min só entrando e saindo da base.',
      'Jab (mão da frente) e direto (mão de trás): girar o pé de trás e o quadril no direto; a outra mão SEMPRE no rosto; o braço volta pelo mesmo caminho.',
      late ? 'Cruzado e uppercut: cruzado com cotovelo na altura do punho e giro do pé da frente; uppercut curto, dobrando o joelho, sem abaixar a mão antes.' : 'Cruzado (gancho) de frente: cotovelo na altura do punho, gira o pé da frente; sem "abrir" o braço antes de soltar.',
      late ? 'Combinações 1-2-3, 1-2-3-2 e 1-1-2 com saída lateral no fim. Devagar e perfeito > rápido e feio.' : 'Combinações 1-2 e 1-2-3, saindo para o lado depois de cada uma (nunca fique parado na frente).',
    ], ['Expire pelo nariz/boca a cada golpe ("tss").', 'Golpe sai e volta: a volta é a defesa.', 'Olhe para o peito do "adversário" no espelho, não para a sua mão.']),
    rounds('feet', 'Pés e agilidade', 4, 120, 45, [
      'Passo-arrasta nas 4 direções (frente, trás, esquerda, direita): o pé que está mais perto da direção sai primeiro; os pés nunca se cruzam nem se juntam.',
      'Escada no chão (fita ou riscos, 8 casas de ~40 cm): 2 pés em cada casa, lateral dentro-fora, e "in-out" (entra com jab, sai com passo atrás).',
      'Pivô: com o pé da frente fixo, gire o pé de trás 90° e volte em guarda. 6 de cada lado + 1-2 e pivô para sair do ângulo.',
      late ? 'Jogo de ângulos: 1-2, passo lateral, 1-2, passo atrás em diagonal. Ritmo de luta, leve na ponta dos pés.' : 'Quadrado de 4 marcações no chão: tocar cada marcação em base de luta, o mais rápido possível sem perder a guarda.',
    ], ['Peso na ponta dos pés, joelhos dobrados, passos curtos.', 'Cabeça não sobe e desce: quem quica muito alto gasta perna e avisa o golpe.']),
    rounds('reflex', 'Reflexo por som e visão', 4, 120, 45, [
      'Rodada com os OLHOS ABERTOS: o celular apita 1, 2 ou 3 vezes e mostra o número — reaja (1 = jab-direto, 2 = esquiva + direto, 3 = sprawl).',
      'Mesma coisa, olhando para a parede e não para a tela: só pelo SOM.',
      'Bolinha de tênis na parede: jogue com uma mão e pegue com a outra, em base de luta, a ~1,5 m. Entre os pegas, reaja aos apitos.',
      late ? 'Só pelo som, de OLHOS FECHADOS e parado em base (sem andar): reação mais rápida, e o corpo aprende a se orientar sem a visão.' : 'Só pelo som de novo, agora andando em base entre os apitos.',
    ], ['Reaja e volte para a guarda — a volta conta tanto quanto o golpe.', 'Não antecipe: espere o apito.']),
    rounds('counter', 'Oportunidade de golpe: sombra com cenários', 3, 180, 60, [
      'Janela 1 — o adversário jabeia: esquiva para fora (cabeça para fora da linha do jab) e devolve o direto. Janela 2 — ele erra um golpe largo: ele fica aberto, entre com 1-2.',
      'Janela 3 — ele baixa a mão depois de bater: gancho por cima dessa mão. Janela 4 — ele vem andando para frente sem bater: jab parando ele + saída lateral.',
      'Sombra livre usando as 4 janelas. Regra: toda vez que você bater, saia do lugar ou defenda logo depois (ninguém bate e fica parado).',
    ], ['A oportunidade quase sempre aparece logo DEPOIS que o outro bate.', 'Quem ataca abre um buraco: treine ver o buraco, não só bater.']),
  ];
  if (rope) blocks.push(ropeBlock(rope, week));
  blocks.push(COOLDOWN);
  return finish({ day: 'sat', week, rope, blocks, title: 'Sábado · Ataque, pés e reflexo', focus: 'Fundamentos de golpe, deslocamento, reação por som e onde está a oportunidade de bater.',
    note: gymDay ? 'Seu plano de 5 dias tem academia no sábado: faça a luta em outro horário (de preferência 6 h depois) e, se as pernas estiverem destruídas, faça só fundamentos + reflexo.' : undefined });
}

function sunday(week: number, rope: RopeKind | null): FightSession {
  const late = week >= 5;
  const blocks: FightBlock[] = [];
  // Domingo: a corda leve abre a sessão (aquecimento + cardio); se o plano pede intervalada, ela fica no fim.
  if (rope === 'steady') blocks.push(ropeBlock(rope, week));
  blocks.push({ ...WARMUP, minutes: rope === 'steady' ? 4 : WARMUP.minutes, drills: rope === 'steady' ? WARMUP.drills.slice(1, 4) : WARMUP.drills });
  blocks.push(
    rounds('defense', 'Defesa: não ser acertado em cheio', 4, 180, 60, [
      'Bloqueio: luva colada na têmpora contra o gancho; antebraços fechados contra golpes no corpo; "parar" o jab com a palma da mão de trás.',
      'Esquiva (slip): a cabeça sai só um palmo para fora da linha do golpe, girando o tronco e dobrando o joelho — sem olhar para o chão.',
      'Pêndulo (roll): passe por baixo de um gancho imaginário fazendo um "U" com os joelhos. Use uma corda/fita esticada na altura do queixo como guia.',
      late ? 'Defesa + contra em sequência: esquiva-direto, pêndulo-gancho, bloqueio-1-2. Sempre terminando em guarda.' : 'Passo atrás + guarda alta: o jeito mais simples de não levar o golpe é não estar lá quando ele chega.',
    ], ['Olhos abertos sempre: quem fecha o olho não vê o próximo golpe.', 'Queixo baixo e ombro da frente levemente alto protegem o queixo.']),
    rounds('mma', 'Fundamentos de MMA', 4, 180, 60, [
      'Sprawl: quando alguém mergulha nas suas pernas, jogue as pernas para trás, quadril no chão, peito pesado e volte em base. 3 min alternando sprawl e base.',
      'Mudança de nível: dobre os joelhos para baixar o corpo (sem curvar as costas) após um 1-2, e volte. É a base da queda e da defesa de queda.',
      'Chute baixo (na coxa) e checagem: gira o pé de apoio, chuta com a canela, volta em guarda; para defender, levante a canela (checar) na direção do chute. Lento e no ar.',
      late ? 'Levantar em base (technical stand-up) do chão + 1-2: sentado, mão de apoio atrás, perna passa por baixo, levanta já em guarda. Depois sprawl → levantar → combinação.' : 'Levantar em base (technical stand-up): do chão até a guarda, sem dar as costas e sem ficar com as duas mãos no chão. 6 de cada lado.',
    ], ['No MMA a guarda fica um pouco mais larga e mais baixa que no boxe por causa das quedas.', 'Nada de chutar com força no ar sem aquecer: o posterior de coxa é o primeiro a reclamar.']),
    {
      id: 'absorb', title: 'Aprender a apanhar (do jeito seguro)', kind: 'strength', minutes: 14,
      drills: [
        'Quedas (ukemi), no colchonete ou na cama: sentado → role para trás com o queixo NO PEITO e bata os dois braços no chão a 45°. Depois de cócoras, depois de pé. 3 × 5. A cabeça nunca toca o chão.',
        'Queda lateral: de cócoras, deixe a perna escorregar e caia de lado, batendo o braço daquele lado no chão. 3 × 4 de cada lado.',
        'Pescoço (isometria, sem peso): mão na testa empurrando e a cabeça resistindo, 3 × 15 s; o mesmo atrás e dos lados. Mais "chin tuck" (queixo para trás) 2 × 12. Pescoço forte segura melhor o impacto do golpe.',
        `Tronco que absorve golpe no corpo: prancha ${late ? '3 × 50 s' : '3 × 40 s'}; prancha lateral 2 × 30 s de cada lado; "hollow hold" 3 × 20 s. Expire forte e trave o abdômen como se fosse levar um soco.`,
        'Compostura: em guarda, dê um tapinha no próprio antebraço/ombro (simulando ser tocado) e imediatamente responda com jab + saída. O objetivo é não travar nem virar de costas quando for tocado.',
      ],
      cues: ['Na queda: queixo no peito, braço bate antes do corpo chegar, expira.', 'Sentiu tontura, dor de cabeça ou náusea em qualquer treino: pare na hora.'],
    },
    rounds('senses', 'Sentidos: equilíbrio e guarda sem olhar', 2, 150, 45, [
      'Em base de luta, OLHOS FECHADOS por 30 s, depois 1-2 devagar de olhos fechados e abra: a guarda ainda está no rosto? Os pés ainda estão na largura certa? Corrija e repita.',
      'Equilíbrio numa perna (30 s cada lado), olhos abertos e depois fechados; termine com 5 chutes baixos lentos de cada lado sem apoiar o pé.',
    ], ['Sentir a posição do corpo sem ver (propriocepção) é o que mantém você em pé quando leva um golpe.']),
  );
  if (rope === 'interval') blocks.push(ropeBlock(rope, week));
  blocks.push(COOLDOWN);
  return finish({ day: 'sun', week, rope, blocks, title: 'Domingo · Defesa, MMA e aprender a apanhar', focus: 'Não ser acertado em cheio, quedas sem bater a cabeça, pescoço e tronco que seguram o impacto, e base de MMA.' });
}

function finish(s: Omit<FightSession, 'totalMinutes'>): FightSession {
  const totalMinutes = s.blocks.reduce((a, b) => a + b.minutes, 0);
  return { ...s, totalMinutes };
}

/**
 * Sessão de luta do fim de semana. A corda do objetivo "perder gordura e ganhar massa" entra DENTRO da luta
 * (mesmo plano e semana da página Cardio) para não somar dois treinos no mesmo dia.
 * `gymWeek` = semana do ciclo de musculação (controla a corda); `week` = semana da luta (controla os exercícios).
 */
export function fightSession(day: FightDay, opts: { week: number; gymWeek?: number; protocol?: JkkProtocol | null; withRope?: boolean; date?: string }): FightSession {
  const week = Math.max(1, Math.min(FIGHT_WEEKS, Math.round(opts.week)));
  const protocol = opts.protocol ?? 'jkk4';
  // Data de referência só para consultar o dia da corda no seu plano.
  const ref = opts.date ?? (day === 'sat' ? '2026-11-14' : '2026-11-15');
  const rope = opts.withRope === false ? null : ropeFor(protocol, ref);
  const gymWeek = opts.gymWeek ?? week;
  const s = day === 'sat' ? saturday(week, rope, protocol === 'jkk') : sunday(week, rope);
  if (s.rope) {
    const r = s.blocks.find((b) => b.id === 'rope')!;
    const fresh = ropeBlock(s.rope, gymWeek);
    Object.assign(r, fresh);
    return finish(s);
  }
  return s;
}

export const FIGHT_INTRO = {
  title: 'Luta em casa · Boxe + MMA',
  text: 'Dois treinos por semana, sábado e domingo, de até 90 minutos, sem precisar de parceiro nem de saco. Sábado é ataque, pés e reflexo; domingo é defesa, base de MMA e aprender a apanhar sem cair fácil.',
  equipment: ['Espaço de ~2 × 2 m e um espelho (ou a câmera do celular para se filmar).', 'Corda (a mesma do cardio).', 'Fita crepe ou giz para marcar a escada no chão.', 'Uma bolinha de tênis.', 'Colchonete ou a cama para as quedas.', 'Opcional: saco de pancada e luvas — não são necessários para aprender os fundamentos.'],
};

export const FIGHT_PRINCIPLES = [
  { title: 'Técnica antes de força', text: 'Nas primeiras 4 semanas tudo é devagar e perfeito. Velocidade e força vêm sozinhas quando o movimento está certo.' },
  { title: 'Bateu, saiu', text: 'Depois de qualquer golpe: volte a mão para o rosto e saia do lugar (lado ou trás). Isso é o que separa quem apanha de quem não apanha.' },
  { title: 'Filme-se', text: 'Grave 1 round por semana. O erro que você não sente (mão de trás caindo, queixo alto, pés juntos) aparece no vídeo.' },
  { title: 'Não atrapalha a musculação', text: 'A luta em casa é técnica + condicionamento moderado: não tira músculo. A corda do fim de semana já está dentro dela — não faça as duas separadas no mesmo dia.' },
  { title: 'Progressão de 8 semanas', text: 'Semanas 1–4: fundamentos e combinações de 2–3 golpes. Semanas 5–8: cruzado e uppercut nas combinações, defesa + contra, reflexo mais rápido e de olhos fechados. Depois o ciclo recomeça.' },
];

/** "Aprender a apanhar": o que de fato faz alguém aguentar mais e cair menos — sem treinar levando pancada na cabeça. */
export const ABSORB_TRUTH = {
  title: 'Aprender a apanhar: o que funciona de verdade',
  points: [
    'Ninguém "acostuma" a cabeça a levar soco. Cada pancada na cabeça soma dano ao cérebro; por isso o treino aqui é para levar MENOS golpes em cheio e absorver melhor os que passarem — nunca para levar pancada de propósito.',
    'O que derruba é o golpe que você não vê e que pega o queixo com a cabeça solta. Por isso: queixo baixo, olhos abertos, dentes encostados (com protetor bucal quando tiver contato), pescoço forte e guarda que volta.',
    'Golpe no corpo: expire e trave o abdômen na hora do impacto. O abdômen treinado (prancha, hollow) aguenta muito mais.',
    'Saber cair evita a pior parte da luta, que é bater a cabeça no chão. Queixo no peito e braço batendo no chão.',
    'Ser tocado e continuar: o treino de compostura ensina a não travar, não virar de costas e não fechar os olhos — é o que faz você "não cair rápido".',
    'Contato de verdade (sparring) só em academia, com professor, luvas de 14–16 oz, protetor bucal e intensidade leve, depois de alguns meses de técnica. Nunca em casa com amigo sem proteção.',
  ],
  stop: 'Pare e procure atendimento se tiver, depois de qualquer pancada na cabeça: dor de cabeça que não passa, vômito, confusão, visão dupla, sonolência estranha ou perda de memória.',
};

export const FIGHT_GLOSSARY: [string, string][] = [
  ['1', 'Jab (mão da frente)'], ['2', 'Direto (mão de trás)'], ['3', 'Cruzado/gancho da frente'], ['4', 'Gancho de trás'], ['5', 'Uppercut da frente'], ['6', 'Uppercut de trás'],
  ['Sprawl', 'Jogar as pernas para trás para defender a queda'], ['Slip / esquiva', 'Tirar a cabeça da linha do golpe'], ['Pêndulo / roll', 'Passar por baixo do gancho'],
  ['Checar', 'Levantar a canela para bloquear o chute baixo'], ['Ukemi', 'Técnica de cair sem se machucar'],
];
