import type { Equipment, Muscle } from './types';

export interface Exercise {
  key: string;
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  equipment: Equipment[]; // todos necessários
  kind: 'compound' | 'isolation';
  repRange: [number, number];
  /** incremento de carga em kg (por halter quando unilateral com halteres) */
  increment: number;
  cues: string;
  substitutes: string[];
}

const E = (
  key: string, name: string, primary: Muscle, secondary: Muscle[], equipment: Equipment[],
  kind: Exercise['kind'], repRange: [number, number], increment: number, cues: string, substitutes: string[],
): Exercise => ({ key, name, primary, secondary, equipment, kind, repRange, increment, cues, substitutes });

export const EXERCISES: Exercise[] = [
  // Peitoral
  E('bench_press', 'Supino reto com barra', 'chest', ['triceps', 'front_delts'], ['barbell', 'bench', 'rack'], 'compound', [6, 10], 2.5,
    'Escápulas retraídas e deprimidas, pés firmes, barra desce na linha do esterno inferior com controle.', ['machine_chest_press', 'db_bench_press', 'smith_bench_press', 'push_up']),
  E('db_bench_press', 'Supino reto com halteres', 'chest', ['triceps', 'front_delts'], ['dumbbell', 'bench'], 'compound', [8, 12], 2,
    'Cotovelos ~45° do tronco, amplitude confortável no ombro, sem bater os halteres.', ['machine_chest_press', 'bench_press', 'push_up']),
  E('smith_bench_press', 'Supino no Smith', 'chest', ['triceps', 'front_delts'], ['smith', 'bench'], 'compound', [8, 12], 2.5,
    'Posicione o banco para a barra descer sobre a parte inferior do peito.', ['machine_chest_press', 'db_bench_press']),
  E('incline_db_press', 'Supino inclinado com halteres', 'chest', ['front_delts', 'triceps'], ['dumbbell', 'bench'], 'compound', [8, 12], 2,
    'Banco a 30°, descida controlada até alongar o peitoral sem dor no ombro.', ['incline_smith_press', 'machine_chest_press', 'incline_bench_press']),
  E('incline_smith_press', 'Supino inclinado no Smith', 'chest', ['front_delts', 'triceps'], ['smith', 'bench'], 'compound', [8, 12], 2.5,
    'Banco a 30°, barra toca a parte superior do peito.', ['incline_db_press', 'machine_chest_press']),
  E('incline_bench_press', 'Supino inclinado com barra', 'chest', ['front_delts', 'triceps'], ['barbell', 'bench', 'rack'], 'compound', [6, 10], 2.5,
    'Banco a 30°, escápulas firmes, controle na descida.', ['incline_db_press', 'incline_smith_press']),
  E('machine_chest_press', 'Supino máquina', 'chest', ['triceps', 'front_delts'], ['machine'], 'compound', [8, 12], 5,
    'Ajuste o banco para as pegadas ficarem na linha do meio do peito.', ['db_bench_press', 'push_up']),
  E('cable_fly', 'Crucifixo na polia', 'chest', [], ['cable'], 'isolation', [10, 15], 2.5,
    'Cotovelos levemente flexionados e fixos; foque no alongamento e na adução.', ['pec_deck', 'db_fly']),
  E('pec_deck', 'Peck deck (voador)', 'chest', [], ['machine'], 'isolation', [10, 15], 5,
    'Ombros para trás, movimento em arco, sem perder a postura.', ['cable_fly', 'db_fly']),
  E('db_fly', 'Crucifixo com halteres', 'chest', [], ['dumbbell', 'bench'], 'isolation', [10, 15], 2,
    'Amplitude controlada; pare antes de desconforto no ombro.', ['cable_fly', 'pec_deck']),
  E('push_up', 'Flexão de braços', 'chest', ['triceps', 'front_delts'], [], 'compound', [8, 20], 0,
    'Corpo alinhado; progrida com repetições, pausa ou carga nas costas.', ['machine_chest_press']),
  // Costas
  E('lat_pulldown', 'Puxada alta (pulldown)', 'back', ['biceps', 'brachialis'], ['cable'], 'compound', [8, 12], 2.5,
    'Peito para cima, puxe os cotovelos em direção ao quadril, controle a volta até alongar.', ['pull_up', 'machine_pulldown']),
  E('straight_arm_pulldown', 'Pulldown com braços estendidos (pullover na polia)', 'back', [], ['cable'], 'isolation', [10, 15], 2.5,
    'Braços quase retos, leve inclinação do tronco; leve a barra/corda até a coxa usando as dorsais, sem dobrar os cotovelos. Alongue bem na volta.', ['lat_pulldown', 'machine_pulldown']),
  E('low_high_cable_fly', 'Crucifixo no cabo de baixo para cima', 'chest', ['front_delts'], ['cable'], 'isolation', [12, 15], 2.5,
    'Polias embaixo, mãos sobem até a altura do queixo.', ['cable_fly', 'incline_db_press']),
  E('wrist_curl', 'Rosca de punho', 'forearms', [], ['dumbbell', 'bench'], 'isolation', [15, 20], 1,
    'Antebraço apoiado no banco, só o punho se move.', ['reverse_curl_ez']),
  E('reverse_wrist_curl', 'Rosca de punho invertida', 'forearms', [], ['dumbbell', 'bench'], 'isolation', [15, 20], 1,
    'Antebraço apoiado no banco, palma para baixo, só o punho se move.', ['reverse_curl_ez']),
  E('standing_leg_curl', 'Flexora em pé unilateral', 'hamstrings', [], ['machine'], 'isolation', [10, 12], 2.5,
    'Uma perna de cada vez, quadril parado.', ['seated_leg_curl', 'lying_leg_curl']),
  E('seated_calf_raise', 'Panturrilha sentado', 'calves', [], ['machine'], 'isolation', [12, 20], 5,
    'Joelho dobrado; desça alongando bem e suba sem quicar.', ['leg_press_calf', 'standing_calf_raise']),
  E('side_plank', 'Prancha lateral', 'abs', [], [], 'isolation', [30, 45], 0,
    'Corpo alinhado da cabeça aos pés, quadril alto.', ['crunch']),
  E('machine_pulldown', 'Puxada articulada (máquina)', 'back', ['biceps'], ['machine'], 'compound', [8, 12], 5,
    'Puxe com os cotovelos, sem balançar o tronco.', ['lat_pulldown', 'pull_up']),
  E('pull_up', 'Barra fixa', 'back', ['biceps', 'brachialis'], ['pullup_bar'], 'compound', [5, 10], 2.5,
    'Saia de braço estendido, suba o peito em direção à barra; adicione carga quando passar de 10.', ['lat_pulldown', 'machine_pulldown']),
  E('chest_supported_row', 'Remada com apoio no peito', 'back', ['rear_delts', 'biceps'], ['machine'], 'compound', [8, 12], 5,
    'Peito apoiado, puxe os cotovelos para trás e para baixo, pausa breve.', ['seated_cable_row', 'db_row']),
  E('seated_cable_row', 'Remada sentada na polia', 'back', ['rear_delts', 'biceps'], ['cable'], 'compound', [8, 12], 2.5,
    'Tronco estável, alongue as escápulas à frente e puxe até o abdômen.', ['chest_supported_row', 'db_row']),
  E('db_row', 'Remada unilateral com halter', 'back', ['rear_delts', 'biceps'], ['dumbbell', 'bench'], 'compound', [8, 12], 2,
    'Apoio firme no banco, puxe o halter em direção ao quadril.', ['seated_cable_row', 'chest_supported_row']),
  E('barbell_row', 'Remada curvada com barra', 'back', ['rear_delts', 'biceps'], ['barbell'], 'compound', [6, 10], 2.5,
    'Tronco inclinado e estável, coluna neutra; evite se houver dor lombar.', ['chest_supported_row', 'seated_cable_row']),
  // Ombros
  E('db_shoulder_press', 'Desenvolvimento com halteres', 'front_delts', ['side_delts', 'triceps'], ['dumbbell', 'bench'], 'compound', [8, 12], 2,
    'Banco a ~80°, cotovelos levemente à frente do tronco.', ['machine_shoulder_press']),
  E('machine_shoulder_press', 'Desenvolvimento máquina', 'front_delts', ['side_delts', 'triceps'], ['machine'], 'compound', [8, 12], 5,
    'Ajuste o assento para as pegadas iniciarem na altura do queixo.', ['db_shoulder_press']),
  E('db_lateral_raise', 'Elevação lateral com halteres', 'side_delts', [], ['dumbbell'], 'isolation', [12, 20], 1,
    'Leve inclinação do tronco à frente, suba em direção às laterais até a linha dos ombros, sem impulso.', ['cable_lateral_raise', 'machine_lateral_raise']),
  E('cable_lateral_raise', 'Elevação lateral na polia', 'side_delts', [], ['cable'], 'isolation', [12, 20], 1.25,
    'Polia baixa atrás do corpo, tensão constante, sem encolher os ombros.', ['db_lateral_raise', 'machine_lateral_raise']),
  E('machine_lateral_raise', 'Elevação lateral máquina', 'side_delts', [], ['machine'], 'isolation', [12, 20], 2.5,
    'Ombro alinhado ao eixo da máquina, controle a descida.', ['cable_lateral_raise', 'db_lateral_raise']),
  E('reverse_pec_deck', 'Crucifixo inverso no peck deck', 'rear_delts', [], ['machine'], 'isolation', [12, 20], 2.5,
    'Braços quase estendidos, abra em direção às laterais sem retrair muito as escápulas.', ['face_pull', 'rear_delt_db_fly']),
  E('face_pull', 'Face pull na polia', 'rear_delts', [], ['cable'], 'isolation', [12, 20], 2.5,
    'Corda na altura do rosto, cotovelos altos, rotação externa no final.', ['reverse_pec_deck', 'rear_delt_db_fly']),
  E('rear_delt_db_fly', 'Crucifixo inverso com halteres', 'rear_delts', [], ['dumbbell'], 'isolation', [12, 20], 1,
    'Tronco inclinado, braços abrem para os lados com cotovelos levemente flexionados.', ['reverse_pec_deck', 'face_pull']),
  // Bíceps / braquial
  E('ez_bar_curl', 'Rosca direta com barra W', 'biceps', ['brachialis', 'forearms'], ['ez_bar'], 'isolation', [8, 12], 2,
    'Cotovelos fixos ao lado do tronco, sem balanço; desça até estender quase por completo.', ['db_curl', 'cable_curl', 'barbell_curl']),
  E('barbell_curl', 'Rosca direta com barra reta', 'biceps', ['brachialis', 'forearms'], ['barbell'], 'isolation', [8, 12], 2,
    'Se o punho incomodar, prefira barra W.', ['ez_bar_curl', 'db_curl', 'cable_curl']),
  E('db_curl', 'Rosca alternada com halteres', 'biceps', ['brachialis'], ['dumbbell'], 'isolation', [8, 12], 1,
    'Supine o punho ao subir, controle a descida.', ['ez_bar_curl', 'cable_curl']),
  E('incline_db_curl', 'Rosca inclinada com halteres', 'biceps', [], ['dumbbell', 'bench'], 'isolation', [10, 15], 1,
    'Banco a 45–60°, braços pendurados atrás do tronco para alongar a cabeça longa.', ['bayesian_cable_curl', 'db_curl']),
  E('bayesian_cable_curl', 'Rosca bayesiana na polia', 'biceps', [], ['cable'], 'isolation', [10, 15], 1.25,
    'De costas para a polia, braço levemente atrás do corpo, flexione sem mover o cotovelo.', ['incline_db_curl', 'cable_curl']),
  E('cable_curl', 'Rosca na polia baixa', 'biceps', ['brachialis'], ['cable'], 'isolation', [10, 15], 2.5,
    'Tensão constante, cotovelos parados, pausa breve no topo.', ['db_curl', 'ez_bar_curl']),
  E('preacher_curl_machine', 'Rosca Scott máquina', 'biceps', [], ['machine'], 'isolation', [10, 15], 2.5,
    'Axila encostada no apoio, controle a fase excêntrica até estender sem bater.', ['cable_curl', 'db_curl']),
  E('hammer_curl', 'Rosca martelo com halteres', 'brachialis', ['biceps', 'forearms'], ['dumbbell'], 'isolation', [8, 12], 1,
    'Pegada neutra, cotovelos fixos, sem girar o tronco.', ['rope_hammer_curl', 'reverse_curl_ez']),
  E('rope_hammer_curl', 'Rosca martelo na corda (polia)', 'brachialis', ['biceps', 'forearms'], ['cable'], 'isolation', [10, 15], 2.5,
    'Pegada neutra na corda, cotovelos colados ao tronco.', ['hammer_curl', 'reverse_curl_ez']),
  E('reverse_curl_ez', 'Rosca inversa com barra W', 'brachialis', ['forearms'], ['ez_bar'], 'isolation', [10, 15], 2,
    'Pegada pronada, punhos neutros; carga moderada.', ['hammer_curl', 'rope_hammer_curl']),
  // Tríceps
  E('overhead_cable_extension', 'Tríceps francês na polia', 'triceps', [], ['cable'], 'isolation', [10, 15], 2.5,
    'De costas para a polia, braços acima da cabeça; alongue bem a cabeça longa.', ['db_overhead_extension', 'skull_crusher_ez']),
  E('db_overhead_extension', 'Tríceps francês com halter', 'triceps', [], ['dumbbell'], 'isolation', [10, 15], 2,
    'Sentado com apoio nas costas, cotovelos apontando para frente/cima.', ['overhead_cable_extension', 'skull_crusher_ez']),
  E('rope_pushdown', 'Tríceps corda na polia', 'triceps', [], ['cable'], 'isolation', [10, 15], 2.5,
    'Cotovelos fixos ao lado do tronco, abra a corda no final.', ['bar_pushdown', 'machine_dip']),
  E('bar_pushdown', 'Tríceps pulley com barra', 'triceps', [], ['cable'], 'isolation', [10, 15], 2.5,
    'Cotovelos fixos, estenda completamente sem inclinar demais o tronco.', ['rope_pushdown', 'machine_dip']),
  E('skull_crusher_ez', 'Tríceps testa com barra W', 'triceps', [], ['ez_bar', 'bench'], 'isolation', [8, 12], 2,
    'Leve a barra para trás da cabeça para alongar; evite se doer o cotovelo.', ['overhead_cable_extension', 'db_overhead_extension']),
  E('close_grip_bench', 'Supino fechado', 'triceps', ['chest', 'front_delts'], ['barbell', 'bench', 'rack'], 'compound', [6, 10], 2.5,
    'Pegada na largura dos ombros, cotovelos próximos ao tronco.', ['machine_dip', 'dips']),
  E('machine_dip', 'Mergulho máquina', 'triceps', ['chest'], ['machine'], 'compound', [8, 12], 5,
    'Tronco ereto para enfatizar tríceps.', ['dips', 'close_grip_bench']),
  E('dips', 'Paralelas', 'triceps', ['chest', 'front_delts'], ['dip_station'], 'compound', [6, 12], 2.5,
    'Desça só até onde o ombro fica confortável; adicione carga após 12 reps.', ['machine_dip', 'close_grip_bench']),
  // Pernas
  E('back_squat', 'Agachamento livre', 'quads', ['glutes'], ['barbell', 'rack'], 'compound', [6, 10], 2.5,
    'Pés firmes, joelhos acompanham os pés, profundidade com coluna neutra.', ['hack_squat', 'smith_squat', 'leg_press']),
  E('hack_squat', 'Hack squat', 'quads', ['glutes'], ['hack_squat'], 'compound', [8, 12], 5,
    'Pés mais baixos na plataforma para ênfase em quadríceps, amplitude completa controlada.', ['back_squat', 'leg_press', 'smith_squat']),
  E('smith_squat', 'Agachamento no Smith', 'quads', ['glutes'], ['smith'], 'compound', [8, 12], 2.5,
    'Pés levemente à frente, desça controlando.', ['hack_squat', 'leg_press']),
  E('leg_press', 'Leg press 45°', 'quads', ['glutes'], ['leg_press'], 'compound', [10, 15], 10,
    'Lombar apoiada o tempo todo; não descole o quadril no fundo.', ['hack_squat', 'smith_squat']),
  E('bulgarian_split_squat', 'Agachamento búlgaro', 'quads', ['glutes'], ['dumbbell', 'bench'], 'compound', [8, 12], 2,
    'Passo longo, tronco levemente inclinado, joelho da frente controlado.', ['leg_press', 'smith_squat']),
  E('leg_extension', 'Cadeira extensora', 'quads', [], ['machine'], 'isolation', [12, 15], 5,
    'Eixo do joelho alinhado ao da máquina, pausa breve no topo.', ['bulgarian_split_squat']),
  E('romanian_deadlift', 'Stiff / levantamento romeno', 'hamstrings', ['glutes'], ['barbell'], 'compound', [6, 10], 2.5,
    'Quadril vai para trás, coluna neutra, barra rente às pernas; pare no alongamento.', ['db_rdl', 'lying_leg_curl']),
  E('db_rdl', 'Stiff com halteres', 'hamstrings', ['glutes'], ['dumbbell'], 'compound', [8, 12], 2,
    'Quadril para trás, halteres rentes às pernas.', ['romanian_deadlift', 'seated_leg_curl']),
  E('lying_leg_curl', 'Mesa flexora', 'hamstrings', [], ['machine'], 'isolation', [10, 15], 5,
    'Quadril colado no banco, controle a volta.', ['seated_leg_curl', 'db_rdl']),
  E('seated_leg_curl', 'Cadeira flexora', 'hamstrings', [], ['machine'], 'isolation', [10, 15], 5,
    'Tronco levemente inclinado à frente para alongar mais os posteriores.', ['lying_leg_curl', 'db_rdl']),
  E('hip_thrust', 'Elevação de quadril com barra', 'glutes', ['hamstrings'], ['barbell', 'bench'], 'compound', [8, 12], 2.5,
    'Queixo recolhido, pausa no topo com glúteos contraídos.', ['bulgarian_split_squat', 'leg_press']),
  E('standing_calf_raise', 'Panturrilha em pé (máquina)', 'calves', [], ['machine'], 'isolation', [10, 15], 5,
    'Pausa de 1–2 s no alongamento, amplitude completa.', ['leg_press_calf', 'db_calf_raise']),
  E('leg_press_calf', 'Panturrilha no leg press', 'calves', [], ['leg_press'], 'isolation', [12, 20], 10,
    'Ponta dos pés na borda, pausa no alongamento.', ['standing_calf_raise', 'db_calf_raise']),
  E('db_calf_raise', 'Panturrilha unilateral com halter', 'calves', [], ['dumbbell'], 'isolation', [12, 20], 2,
    'Em um degrau, pausa embaixo.', ['standing_calf_raise', 'leg_press_calf']),
  // Abdômen
  E('cable_crunch', 'Abdominal na polia (ajoelhado)', 'abs', [], ['cable'], 'isolation', [10, 15], 2.5,
    'Flexione a coluna, não o quadril; expire ao contrair.', ['hanging_leg_raise', 'crunch']),
  E('hanging_leg_raise', 'Elevação de pernas na barra', 'abs', [], ['pullup_bar'], 'isolation', [8, 15], 0,
    'Retroverta a pelve ao subir; evite balanço.', ['cable_crunch', 'crunch']),
  E('crunch', 'Abdominal no solo', 'abs', [], [], 'isolation', [12, 20], 0,
    'Movimento curto e controlado; segure carga no peito quando ficar fácil.', ['cable_crunch']),
];

export const EXERCISE_BY_KEY: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.key, e]));

export function getExercise(key: string): Exercise {
  const ex = EXERCISE_BY_KEY[key];
  if (!ex) throw new Error(`Exercício desconhecido: ${key}`);
  return ex;
}

export function isAvailable(ex: Exercise, equipment: Equipment[] | undefined): boolean {
  if (!equipment || equipment.length === 0) return true; // não informado → não restringe
  return ex.equipment.every((e) => equipment.includes(e));
}

/** Link de BUSCA (não um vídeo específico) para o usuário escolher uma demonstração confiável. */
export function demoSearchUrl(ex: Exercise): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} execução técnica`)}`;
}

/**
 * Resolve o exercício efetivo de um slot: respeita substituições definidas pelo usuário,
 * exercícios marcados como indisponíveis e equipamentos disponíveis.
 */
export function resolveExercise(
  key: string,
  equipment: Equipment[] | undefined,
  overrides: Record<string, string> = {},
  blocked: Set<string> = new Set(),
): Exercise {
  const seen = new Set<string>();
  const ok = (k: string) => !blocked.has(k) && EXERCISE_BY_KEY[k] && isAvailable(EXERCISE_BY_KEY[k], equipment);
  const override = overrides[key];
  if (override && ok(override)) return EXERCISE_BY_KEY[override];
  if (ok(key)) return EXERCISE_BY_KEY[key];
  const queue = [...getExercise(key).substitutes];
  while (queue.length) {
    const k = queue.shift()!;
    if (seen.has(k)) continue;
    seen.add(k);
    if (ok(k)) return EXERCISE_BY_KEY[k];
    queue.push(...(EXERCISE_BY_KEY[k]?.substitutes ?? []));
  }
  return getExercise(key); // nenhuma alternativa: mantém e a UI sinaliza
}

/** Alternativas compatíveis com o mesmo músculo principal, para a tela de substituição. */
export function alternativesFor(key: string, equipment: Equipment[] | undefined): Exercise[] {
  const base = getExercise(key);
  const direct = base.substitutes.map((k) => EXERCISE_BY_KEY[k]).filter(Boolean);
  const sameMuscle = EXERCISES.filter((e) => e.primary === base.primary && e.key !== key && !base.substitutes.includes(e.key));
  return [...direct, ...sameMuscle].filter((e) => isAvailable(e, equipment));
}
