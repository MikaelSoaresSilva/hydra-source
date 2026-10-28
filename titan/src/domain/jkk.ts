// Protocolo JKK — transcrição fiel do PDF "Protocolo JKK" (plano de hipertrofia, 5 dias, out/2026).
// Textos, séries, repetições, descansos e ordem dos exercícios são os do documento.
import { EXERCISE_BY_KEY } from './exercises';
import type { Equipment, Muscle, ProgramConfig, ProgramDay, SlotPrescription } from './types';
import type { WeekPhase } from './program';

export const JKK_WEEKS = 8;
export const JKK_TRAINING_DAYS = [1, 2, 3, 5, 6]; // seg, ter, qua, sex, sáb

export const JKK_INTRO = {
  kicker: 'PLANO DE HIPERTROFIA · 5 DIAS · OUT/2026',
  title: 'PROTOCOLO JKK',
  text: 'Treino montado a partir dos 7 vídeos da pasta PROJETO JKK, das suas 5 fotos e das suas respostas. Onde os vídeos não cobriam um músculo (peito, bíceps, ombros, glúteo), completei com exercícios que têm boa evidência para hipertrofia.',
  tags: ['Hipertrofia', 'Intermediário', '5 dias / semana', 'Braços (prioridade nº 1)', 'Pico do bíceps', 'Peito superior e central', 'Pernas', 'Flancos'],
  week: [
    ['SEG', 'Peito sup. + Tríceps'], ['TER', 'Pernas A'], ['QUA', 'Costas + Bíceps'], ['QUI', 'Descanso'],
    ['SEX', 'Pernas B'], ['SÁB', 'Braços + Peito'], ['DOM', 'Descanso'],
  ] as [string, string][],
  weekNote: 'Por semana: bíceps e tríceps 2x com cerca de 13 séries diretas cada, peito 2x (16 séries, 10 delas focadas na parte superior), pernas 2x, costas 1x com volume alto e mais trabalho indireto nos dias de braço.',
};

export const JKK_PHOTOS = {
  note: 'É uma avaliação visual, não um exame. Serve para decidir onde colocar mais volume.',
  items: [
    { title: 'Braços', text: 'Bíceps e tríceps ainda estão pequenos em relação aos ombros. O tríceps é cerca de 2/3 do braço, então é o caminho mais rápido para o braço crescer. Por isso ele tem 2 dias com ênfase na cabeça longa, como os dois vídeos de tríceps mostram.' },
    { title: 'Pico do bíceps', text: 'O formato do pico (comprimento do músculo e ponto de inserção) é genético e não muda. O que muda é a altura: cabeça longa maior, braquial maior (ele "empurra" o bíceps para cima) e menos gordura no braço. O plano ataca os três.' },
    { title: 'Peito', text: 'A parte superior (clavicular) tem pouco volume, e a parte de baixo do peito acumula gordura, o que deixa o contorno arredondado. Mais inclinado de 30° e menos gordura corporal resolvem as duas coisas.' },
    { title: 'Pernas', text: 'Coxas e panturrilhas estão finas em relação ao tronco. Por isso são 2 dias de perna, com quadríceps e posterior separados e panturrilha nos dois.' },
    { title: 'Cintura e flancos', text: 'Nas fotos de lado e de costas aparece gordura na cintura, nos flancos e na lombar. Minha estimativa visual é entre 17% e 20% de gordura. Flanco é gordura, não músculo, então só sai com déficit calórico. Abdominal e oblíquo não queimam gordura no local.' },
    { title: 'Pontos fortes', text: 'Ombros com bom formato e boa base de trapézio. Elevação lateral entra 2x por semana: ombro mais largo faz a cintura parecer menor e ajuda no visual em V.' },
  ],
};

/** [chave do exercício no app, nome no PDF, séries, faixa, descanso (s) para o cronômetro, descanso como no PDF, orientação, origem, unidade] */
type Row = [key: string, label: string, sets: number, range: [number, number], restSec: number, restText: string, note: string, tag: string, unit?: 's'];
interface JkkDay { dayIndex: number; name: string; meta: string; intro: string; rows: Row[] }

export const JKK_DAYS: JkkDay[] = [
  {
    dayIndex: 1, name: 'Dia 1 · Peito superior + Ombros + Tríceps', meta: 'SEG · ~70 min · 20 séries',
    intro: 'Comece pelo peito superior, quando você está mais forte.',
    rows: [
      ['incline_db_press', 'Supino inclinado com halteres (30°)', 4, [6, 10], 120, '2–3 min', 'Banco a 30° pega mais o peito superior do que a 45°. Desça em 3 segundos até alongar bem.', 'ADICIONADO · PEITO SUPERIOR'],
      ['incline_smith_press', 'Supino inclinado no Smith ou máquina', 3, [8, 12], 120, '2 min', 'Mais estável, então dá para chegar mais perto da falha com segurança.', 'ADICIONADO · PEITO SUPERIOR'],
      ['low_high_cable_fly', 'Crucifixo no cabo de baixo para cima', 3, [12, 15], 90, '90 s', 'Polias embaixo, mãos sobem até a altura do queixo. Isola o peito superior.', 'ADICIONADO · PEITO SUPERIOR'],
      ['cable_lateral_raise', 'Elevação lateral no cabo', 4, [12, 15], 60, '60–90 s', 'Tensão constante, inclusive na parte de baixo do movimento.', 'ADICIONADO · OMBRO'],
      ['overhead_cable_extension', 'Tríceps francês no cabo (corda, acima da cabeça)', 3, [10, 12], 90, '90 s', 'Braço acima da cabeça alonga a cabeça longa. Mantenha os cotovelos fechados, sem abrir para fora, como mostra o vídeo.', 'VÍDEOS TRÍCEPS 1 e 2'],
      ['skull_crusher_ez', 'Tríceps testa com barra W', 3, [8, 12], 90, '90 s', 'Leve a barra um pouco atrás da cabeça para alongar mais o tríceps.', 'VÍDEO TRÍCEPS 1'],
    ],
  },
  {
    dayIndex: 2, name: 'Dia 2 · Pernas A (quadríceps)', meta: 'TER · ~70 min · 22 séries',
    intro: 'Baseado no vídeo PERNA 1: agachamento, leg press, búlgaro, extensora, flexora e panturrilha.',
    rows: [
      ['back_squat', 'Agachamento livre (ou hack / Smith)', 4, [6, 10], 120, '2–3 min', 'Desça o máximo que conseguir mantendo a coluna neutra. Amplitude completa cresce mais.', 'VÍDEO PERNA 1'],
      ['leg_press', 'Leg press 45°', 3, [10, 12], 120, '2 min', 'Pés no meio da plataforma. Joelhos bem flexionados embaixo, sem tirar o quadril do banco.', 'VÍDEO PERNA 1'],
      ['bulgarian_split_squat', 'Agachamento búlgaro', 3, [8, 12], 90, 'cada perna · 90 s', 'Tronco mais em pé pega mais quadríceps. Comece pela perna mais fraca.', 'VÍDEO PERNA 1'],
      ['leg_extension', 'Cadeira extensora', 3, [12, 15], 90, '90 s', 'Pausa de 1 s em cima. Na última série, faça um drop set (tire 30% do peso e continue até a falha).', 'VÍDEO PERNA 1'],
      ['seated_leg_curl', 'Cadeira flexora sentada', 2, [10, 12], 90, '90 s', 'A versão sentada alonga mais o posterior e gerou mais crescimento do que a deitada em estudo de 2021.', 'VÍDEO PERNA 1 · TROCADO'],
      ['standing_calf_raise', 'Panturrilha em pé (máquina ou Smith)', 4, [10, 15], 60, '60 s', 'Pausa de 2 s embaixo, bem alongada. Sem quicar.', 'VÍDEO PERNA 1'],
      ['hanging_leg_raise', 'Elevação de pernas (abdômen infra)', 3, [12, 15], 60, '60 s', 'Fortalece o abdômen e ajuda a controlar a curvatura da lombar.', 'ADICIONADO · CORE'],
    ],
  },
  {
    dayIndex: 3, name: 'Dia 3 · Costas + Bíceps + Antebraço', meta: 'QUA · ~75 min · 22 séries',
    intro: 'Costas a partir de COSTAS 2 e COSTAS JORLAN; antebraço a partir do vídeo ANTEBRAÇO. O vídeo COSTAS 3 é aula teórica e foi usado para a escolha dos ângulos: puxada para largura, remada para espessura.',
    rows: [
      ['lat_pulldown', 'Puxada frontal (pegada aberta)', 3, [8, 12], 120, '2 min', 'Puxe o cotovelo em direção ao quadril, peito para cima. Largura das costas.', 'VÍDEO COSTAS 2'],
      ['chest_supported_row', 'Remada unilateral na máquina (peito apoiado)', 3, [8, 12], 90, 'cada lado · 90 s', 'Apoiar o peito tira a lombar da jogada. Alongue bem na frente, como no vídeo.', 'VÍDEO COSTAS JORLAN'],
      ['seated_cable_row', 'Remada sentada com triângulo', 3, [10, 12], 90, '90 s', 'Espessura do meio das costas. Junte as escápulas no fim do movimento.', 'VÍDEO COSTAS 2'],
      ['straight_arm_pulldown', 'Pulldown com braço estendido (corda)', 2, [12, 15], 60, '60 s', 'Isola o grande dorsal sem cansar o bíceps antes da hora.', 'VÍDEO COSTAS 2'],
      ['incline_db_curl', 'Rosca inclinada com halteres', 3, [8, 12], 90, '90 s', 'Banco a 45–60°, braços atrás do corpo. Alonga a cabeça longa, que é a principal responsável pela altura do pico.', 'ADICIONADO · PICO DO BÍCEPS'],
      ['reverse_curl_ez', 'Rosca inversa com barra W', 3, [10, 12], 60, '60–90 s', 'Trabalha o braquial e o braquiorradial. O braquial fica embaixo do bíceps e o empurra para cima.', 'VÍDEO ANTEBRAÇO'],
      ['wrist_curl', 'Rosca de punho + rosca de punho invertida (bi-set) — rosca de punho', 2, [15, 20], 0, 'sem descanso → invertida', 'Antebraço apoiado no banco, como no vídeo. Faça uma série de cada, sem descanso entre elas.', 'VÍDEO ANTEBRAÇO'],
      ['reverse_wrist_curl', 'Rosca de punho + rosca de punho invertida (bi-set) — rosca de punho invertida', 2, [15, 20], 60, '60 s', 'Antebraço apoiado no banco, como no vídeo. Faça uma série de cada, sem descanso entre elas.', 'VÍDEO ANTEBRAÇO'],
    ],
  },
  {
    dayIndex: 5, name: 'Dia 4 · Pernas B (posterior + glúteo)', meta: 'SEX · ~65 min · 21 séries',
    intro: 'Completa as pernas com posterior, glúteo e um segundo estímulo de quadríceps e panturrilha.',
    rows: [
      ['romanian_deadlift', 'Stiff com barra ou halteres', 4, [6, 10], 120, '2–3 min', 'Quadril para trás, joelho levemente flexionado. Desça até sentir o posterior alongar, sem arredondar a lombar.', 'ADICIONADO · POSTERIOR'],
      ['standing_leg_curl', 'Flexora em pé unilateral', 3, [10, 12], 60, 'cada perna · 60 s', 'Uma perna de cada vez, ajuda a corrigir diferenças entre os lados.', 'VÍDEO PERNA 1'],
      ['hack_squat', 'Hack ou leg press (pés no meio)', 3, [10, 12], 120, '2 min', 'Segundo estímulo de quadríceps na semana.', 'VÍDEO PERNA 1'],
      ['hip_thrust', 'Elevação pélvica (hip thrust)', 3, [8, 12], 90, '90 s', 'Glúteo forte ajuda a postura e a lombar. Pausa de 1 s em cima.', 'ADICIONADO · GLÚTEO'],
      ['seated_calf_raise', 'Panturrilha sentado', 4, [12, 20], 60, '60 s', 'Com o joelho dobrado, pega mais o sóleo. Complementa a panturrilha em pé.', 'ADICIONADO · PANTURRILHA'],
      ['cable_crunch', 'Abdominal no cabo (crunch ajoelhado)', 2, [10, 15], 60, '60 s', 'Abdômen com carga, progredindo como qualquer outro músculo.', 'ADICIONADO · CORE'],
      ['side_plank', 'Prancha lateral', 2, [30, 45], 60, 'cada lado', 'Fortalece os oblíquos e estabiliza a coluna. Não queima a gordura do flanco.', 'ADICIONADO · CORE', 's'],
    ],
  },
  {
    dayIndex: 6, name: 'Dia 5 · Braços + Peito central', meta: 'SÁB · ~75 min · 23 séries',
    intro: 'Braço é a sua prioridade nº 1, então ele vem primeiro, com você descansado. Bíceps e tríceps alternados: enquanto um trabalha, o outro descansa.',
    rows: [
      ['preacher_curl_machine', 'Rosca Scott (ou rosca spider)', 3, [8, 12], 90, '90 s', 'Ênfase na cabeça curta e na contração máxima. Desça controlando até quase estender o braço.', 'ADICIONADO · BÍCEPS'],
      ['db_overhead_extension', 'Tríceps acima da cabeça unilateral (halter ou cabo)', 3, [10, 12], 60, 'cada braço · 60 s', 'Um braço por vez para alongar ao máximo a cabeça longa. É a variação mais bem avaliada no vídeo TRÍCEPS 2.', 'VÍDEO TRÍCEPS 2'],
      ['bayesian_cable_curl', 'Rosca Bayesian no cabo', 3, [10, 12], 60, 'cada braço · 60 s', 'De costas para a polia, braço atrás do corpo. Tensão na cabeça longa alongada, ideal para o pico.', 'ADICIONADO · PICO DO BÍCEPS'],
      ['rope_pushdown', 'Tríceps na polia com corda (pushdown)', 3, [10, 15], 60, '60 s', 'Cabeças lateral e medial, que dão a "ferradura" do tríceps visto de lado.', 'VÍDEO TRÍCEPS 2'],
      ['hammer_curl', 'Rosca martelo cruzada', 2, [10, 12], 60, '60 s', 'Mais braquial, que levanta o bíceps.', 'VÍDEO ANTEBRAÇO'],
      ['db_bench_press', 'Supino reto com halteres', 3, [6, 10], 120, '2 min', 'Peito central. Os halteres permitem descer mais do que a barra.', 'ADICIONADO · PEITO CENTRAL'],
      ['cable_fly', 'Crossover na altura do peito (ou peck deck)', 3, [12, 15], 60, '60–90 s', 'Mãos se encontram na frente do esterno. Aperte 1 s no meio.', 'ADICIONADO · PEITO CENTRAL'],
      ['db_lateral_raise', 'Elevação lateral com halteres', 3, [15, 20], 60, '60 s', 'Leve, controlado, até a falha.', 'ADICIONADO · OMBRO'],
    ],
  },
];

export const JKK_HOW = [
  { title: 'Intensidade.', text: 'Termine cada série com 1 a 2 repetições sobrando. Nos exercícios isolados (rosca, extensora, elevação lateral), a última série vai até a falha.' },
  { title: 'Progressão dupla.', text: 'Quando você fizer todas as séries no topo da faixa (ex.: 3 × 12 numa faixa de 8–12), aumente a carga e volte para o início da faixa. Anote as cargas.' },
  { title: 'Técnica antes de carga.', text: 'Descida controlada (2 a 3 s) e amplitude completa. Roubar no bíceps tira o trabalho do bíceps.' },
  { title: 'Aquecimento.', text: 'Antes do primeiro exercício de cada dia, faça 2 séries leves (50% e 75% da carga).' },
  { title: 'Deload.', text: 'A cada 6 a 8 semanas, faça uma semana com metade das séries e as mesmas cargas.' },
  { title: 'Dias de descanso.', text: 'Quinta e domingo: descanso ou caminhada. Se precisar mudar o dia, mantenha a ordem dos treinos.' },
];

export const JKK_FLANKS = {
  title: 'FLANCOS: O QUE FUNCIONA DE VERDADE',
  intro: 'Pelas fotos, você tem músculo para mostrar, mas ele está coberto. A estratégia que dá conta de ganhar massa e perder o flanco ao mesmo tempo é a recomposição corporal. Ela funciona bem para quem é intermediário e está nessa faixa de gordura.',
  phases: [
    { phase: '1 · Recomposição', duration: '8–12 sem.', kcal: '−300 a −400 kcal/dia', goal: 'Tirar o flanco mantendo e ganhando músculo com o treino pesado' },
    { phase: '2 · Ganho limpo', duration: 'depois', kcal: '+200 a +300 kcal/dia', goal: 'Crescer com a cintura sob controle' },
  ],
  bullets: [
    { title: 'Proteína:', text: 'de 1,8 a 2,2 g por kg de peso por dia, dividida em 3 a 5 refeições. Se você pesa 75 kg, isso dá de 135 a 165 g.' },
    { title: 'Passos:', text: 'de 8 a 10 mil por dia. Sozinho, isso queima mais do que muito cardio.' },
    { title: 'Cardio:', text: '2 a 3 vezes por semana, de 20 a 30 min, leve a moderado (esteira inclinada ou bike), depois do treino ou em outro horário.' },
    { title: 'Medida certa:', text: 'pese-se em jejum de 3 a 4 vezes por semana e use a média. Meça a cintura na altura do umbigo a cada 2 semanas. Se a cintura diminui e as cargas sobem, está funcionando.' },
    { title: 'Sono:', text: 'de 7 a 9 horas. Dormir pouco aumenta a fome e atrapalha a recuperação.' },
  ],
  footer: 'Valores de referência gerais. Para um plano alimentar com calorias exatas, procure um nutricionista.',
};

export const JKK_SOURCES = {
  rows: [
    ['PERNA 1', 'Leg press, agachamento, búlgaro, extensora, flexoras, panturrilha', 'Base dos dias 2 e 4'],
    ['COSTAS JORLAN', 'Remadas e puxadas em máquinas articuladas', 'Remada unilateral na máquina'],
    ['COSTAS 2', 'Puxada frontal, puxada supinada, remada sentada, pulldown (4 × 15)', 'Puxada, remada sentada e pulldown'],
    ['COSTAS 3', 'Aula teórica de anatomia das costas no quadro', 'Divisão entre largura (puxadas) e espessura (remadas)'],
    ['TRÍCEPS 1', 'Cabeça longa, tensão mecânica, execução certa e errada da extensão acima da cabeça, tríceps testa', 'Extensões acima da cabeça e tríceps testa'],
    ['TRÍCEPS 2', 'Ranking (tier list) dos exercícios de tríceps', 'Escolha das variações mais bem avaliadas'],
    ['ANTEBRAÇO', 'Braquiorradial, rosca inversa, rosca de punho', 'Rosca inversa, rosca de punho e martelo'],
  ] as [string, string, string][],
  notes: [
    'Troca: a flexora deitada do vídeo PERNA 1 virou flexora sentada no dia 2, porque a versão sentada alonga mais o posterior e cresce mais.',
    'Troca: no vídeo TRÍCEPS 1 aparecem extensões com os cotovelos abertos. O plano usa a execução marcada como certa, com os cotovelos fechados.',
    'Adicionado: peito, bíceps, ombro, glúteo e abdômen não estavam nos vídeos e foram completados com exercícios bem estudados para hipertrofia.',
    'Mantido de fora: a puxada supinada do vídeo COSTAS 2 ficou fora para não repetir a puxada frontal. Use-a no lugar da puxada frontal se preferir.',
  ],
  footer: 'Analisei os vídeos pelas imagens, quadro a quadro; o áudio não foi transcrito. Os exercícios marcados como "adicionado" vêm de pesquisas sobre hipertrofia, como Maeo et al. 2021 e 2022 sobre flexora sentada e tríceps acima da cabeça.',
};

/** RIR do documento: 1 a 2 sobrando; isolados com a última série até a falha. */
const rirFor = (key: string) => (EXERCISE_BY_KEY[key]?.kind === 'isolation' ? 1 : 2);

const ALL_EQUIPMENT: Equipment[] = ['barbell', 'ez_bar', 'dumbbell', 'bench', 'rack', 'cable', 'machine', 'smith', 'pullup_bar', 'dip_station', 'leg_press', 'hack_squat'];

export function generateJkk(): ProgramConfig {
  const days: ProgramDay[] = JKK_DAYS.map((d, i) => ({
    dayIndex: d.dayIndex,
    name: d.name,
    focus: `${d.meta} — ${d.intro}`,
    slots: d.rows.map(([key, label, sets, range, restSec, restText, note, tag, unit], j): SlotPrescription => ({
      slotId: `j${i}s${j}`, exerciseKey: key, sets, repRange: range, restSec, rir: rirFor(key), label, note, tag, restText, unit: unit ?? 'reps',
    })),
  }));
  const priorities: Muscle[] = ['biceps', 'triceps', 'brachialis', 'chest', 'quads', 'hamstrings', 'calves'];
  return {
    version: 1, trainingDays: JKK_TRAINING_DAYS, sessionMinutes: 75, priorities, equipment: ALL_EQUIPMENT, days,
    notes: [], protocol: 'jkk', deloadWeeks: [], locked: true,
  };
}

/**
 * Fases do JKK: RIR 1–2 o ciclo todo. Deload "a cada 6 a 8 semanas" (metade das séries, mesmas cargas):
 * nas semanas 6–7 entra quando a fadiga pedir; se não entrou, acontece na semana 8.
 */
export function jkkPhase(week: number, deloadWeeks: number[] = []): WeekPhase {
  const normal = { week, rirCompound: 2, rirIsolation: 1, prioritySetBonus: 0, assessment: week % 2 === 1 };
  if (deloadWeeks.includes(week) || (week >= JKK_WEEKS && !deloadWeeks.some((w) => w >= 6 && w < JKK_WEEKS))) {
    return { ...normal, label: 'Deload: metade das séries, mesmas cargas', deload: true, assessment: true };
  }
  if (week >= 6) return { ...normal, label: 'Semanas 6–8 · Janela de deload (entra quando a fadiga pedir)', deload: false };
  return { ...normal, label: 'Treino normal · 1–2 reps sobrando; isolados: última série até a falha', deload: false };
}
