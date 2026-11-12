// Plano do rosto: o que realmente afina, define e limpa o rosto — e o que é mito.
// Tudo aqui é cuidado e hábito, não diagnóstico. Sem promessa de mudar osso.

export const FACE_TRUTH = [
  'Não existe perder gordura só do rosto. Nenhum exercício, massagem, creme ou aparelho queima a gordura de um lugar escolhido: o rosto afina quando a gordura do corpo todo cai.',
  'O formato dos ossos (mandíbula, maçãs, queixo) não muda com exercício em adultos. O que muda: gordura, inchaço, pele, cabelo, barba, postura e pescoço.',
  'Todo rosto é assimétrico. Dá para reduzir a assimetria que se vê (cabelo, barba, sobrancelha, postura), não a dos ossos.',
];

export interface FaceStep { title: string; how: string; dose: string; evidence: 'boa' | 'limitada' | 'postura/aparência'; caution?: string }

/** Treino facial de 5–6 minutos por dia. Entra na Missão como "Treino facial de 5 min". */
export const FACE_ROUTINE: FaceStep[] = [
  {
    title: '1. Queixo recolhido (chin tuck)',
    how: 'Em pé, encostado na parede. Olhe para a frente e leve a cabeça para trás, como se fizesse um "queixo duplo", sem inclinar. Segure e solte.',
    dose: '2 séries de 10 repetições, segurando 5 s',
    evidence: 'postura/aparência',
    caution: 'Sem dor nem formigamento; se aparecer, pare.',
  },
  {
    title: '2. Pescoço isométrico (4 direções)',
    how: 'Mão na testa: empurre a cabeça contra a mão sem mexer. Repita com a mão atrás da cabeça e em cada lateral. Força moderada (uns 50–70%).',
    dose: '2 voltas de 15–20 s em cada direção',
    evidence: 'boa',
    caution: 'É músculo de verdade: um pescoço mais forte e a cabeça bem posicionada emolduram a mandíbula. Nunca force no limite nem gire a cabeça com carga.',
  },
  {
    title: '3. Abertura de peito na parede',
    how: 'Costas na parede, braços em "W"; deslize para cima e para baixo mantendo cotovelos e punhos encostados. Ombros para trás tiram a cabeça da frente do corpo.',
    dose: '2 séries de 10 repetições lentas',
    evidence: 'postura/aparência',
  },
  {
    title: '4. Drenagem do rosto (de manhã)',
    how: 'Com hidratante e mãos limpas, pressão leve: do meio da testa para as têmporas, do nariz para as orelhas, do queixo para as orelhas; depois desça pelas laterais do pescoço até a clavícula.',
    dose: '1–2 min, 5 passadas em cada trajeto',
    evidence: 'limitada',
    caution: 'Só reduz o inchaço da manhã por algumas horas. Não passe sobre espinha inflamada.',
  },
  {
    title: '5. Língua no céu da boca, boca fechada, respirar pelo nariz',
    how: 'Ao longo do dia: lábios fechados, dentes levemente afastados, língua inteira apoiada no céu da boca.',
    dose: 'Hábito, não série',
    evidence: 'postura/aparência',
    caution: 'Melhora a postura da boca e do queixo na hora. Não há evidência de que mude o osso em adultos ("mewing").',
  },
];

export const FACE_SKIP = [
  { what: 'Exercícios de bochecha ("yoga facial") para afinar', why: 'O único estudo conhecido (pequeno, com mulheres de 40–65 anos, 30 min por dia por 20 semanas) mostrou bochechas MAIS cheias, não mais finas. Para quem quer rosto mais magro, não ajuda.' },
  { what: 'Chiclete duro e aparelhos de morder para "definir a mandíbula"', why: 'Aumentam o músculo da mastigação, o que alarga a parte de baixo do rosto, e podem causar dor e estalo na articulação da mandíbula.' },
  { what: 'Cintas, rolos e cremes "redutores" para o rosto', why: 'Não queimam gordura. No máximo desincham por algumas horas.' },
  { what: 'Termogênicos', why: 'Efeito mínimo na gordura e nenhum efeito localizado; podem tirar o sono, que é o que mais desincha o rosto.' },
];

/** Como a gordura do rosto realmente sai. */
export const FACE_FAT_PLAN = [
  { title: 'Déficit leve de calorias', detail: 'Ative a fase de Recomposição em Nutrição → Metas (cerca de −350 kcal/dia, proteína alta) e mantenha o treino pesado. É o mesmo plano que tira o flanco.', to: '/nutricao' },
  { title: 'Passos e cardio leve', detail: '8 a 10 mil passos por dia e, se quiser, 2–3 sessões de 20–30 min de cardio leve. Ajudam o déficit sem atrapalhar o treino.', to: undefined },
  { title: 'Acompanhe a cintura, não o espelho', detail: 'O rosto muda devagar e você se vê todo dia. Meça a cintura a cada 2 semanas e tire uma foto do rosto por mês, na mesma luz e distância.', to: '/evolucao' },
  { title: 'Quando aparece', detail: 'Num estudo de percepção de rostos (Re e Rule, 2016), a diferença só ficou visível para os outros a partir de cerca de 4 kg a menos para alguém da sua altura. No ritmo saudável de ~0,3 kg por semana, isso leva uns 3 meses. É uma média: varia de pessoa para pessoa.', to: undefined },
];

/** Inchaço não é gordura: some em dias, não em meses. */
export const FACE_PUFFINESS = [
  'Dormir 7–9 h, de preferência de barriga para cima ou alternando os lados.',
  'Menos sal e ultraprocessados à noite (salgadinho, embutidos, miojo, fast food).',
  'Álcool incha o rosto no dia seguinte.',
  'Beber água ao longo do dia (≥ 2 L): pouca água faz o corpo reter mais.',
  'De manhã: água fria no rosto e a drenagem de 1–2 min do treino facial.',
];

export const FACE_SYMMETRY = [
  { title: 'Cabelo', detail: 'O corte e o lado da risca disfarçam ou destacam o lado mais "cheio" do rosto. Faça o questionário de corte e teste a risca dos dois lados em fotos.' },
  { title: 'Barba e sobrancelhas', detail: 'Linhas da barba na mesma altura dos dois lados (confira com o rosto reto no espelho) e sobrancelhas só limpas, sem afinar.' },
  { title: 'Postura da cabeça', detail: 'Cabeça inclinada ou projetada para a frente parece assimetria e queixo fraco. O treino facial corrige o hábito.' },
  { title: 'Mastigar dos dois lados', detail: 'Mastigar sempre do mesmo lado pode deixar um lado da mandíbula mais forte. Alternar é um hábito sem custo (evidência limitada).' },
  { title: 'Dentes e mordida', detail: 'Mordida torta, estalo ou dor na mandíbula: dentista ou ortodontista. É a única forma real de corrigir assimetria que vem dos dentes.' },
  { title: 'Selfie engana', detail: 'A câmera frontal perto do rosto (30 cm) aumenta o nariz e distorce as proporções. Avalie o rosto em fotos tiradas a 1,5 m ou mais.' },
];

export const FACE_CLEAN = [
  'Rotina de 3 passos todo dia: limpar (manhã e noite), hidratar com gel ou gel-creme e protetor solar de manhã.',
  'Lave o rosto logo depois do treino: suor parado piora cravos e espinhas.',
  'Não esprema: inflama, mancha e pode deixar cicatriz.',
  'Troque a fronha 1–2 vezes por semana e limpe a tela do celular.',
  'Barba: lâmina nova, a favor dos pelos; pelos encravados melhoram sem "zerar" a pele.',
  'Acne com caroços doloridos, muita inflamação ou marcas: dermatologista (pelo SUS, comece pela UBS).',
];
