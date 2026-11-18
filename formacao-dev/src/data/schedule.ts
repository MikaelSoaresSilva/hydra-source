// Cronograma de 12 semanas: 24 sessões de 3 horas (sábado e domingo, 13h30–16h30).

export interface Session {
  id: string;
  n: number;              // 1..24
  week: number;           // 1..12
  day: 'sab' | 'dom';
  month: 1 | 2 | 3;
  title: string;
  goal: string;
  lessons: string[];      // aulas obrigatórias, na ordem
  optional?: string[];    // aulas extras se sobrar tempo
  resources: string[];    // vídeos/sites recomendados para o bloco de prática
  practice: string[];     // o que praticar
  project?: { id: string; step: string };
  challenge: string;      // desafio para resolver sozinho
  assessment?: 1 | 2 | 3; // avaliação mensal nesta sessão
  next: string;           // próximo objetivo
}

export const MONTHS = [
  { n: 1, title: 'Fundamentos e exploração', goal: 'Aprender a pensar como programador e conhecer as diferentes áreas.' },
  { n: 2, title: 'Tecnologias e desenvolvimento', goal: 'Entender como aplicações reais são construídas: frontend, backend, APIs e bancos de dados.' },
  { n: 3, title: 'Aprofundamento em Backend e preparação profissional', goal: 'Construir um backend completo e seguro, publicar o projeto final e se preparar para o mercado.' },
];

export const SESSIONS: Session[] = [
  // ════════ MÊS 1 ════════
  { id: 's1', n: 1, week: 1, day: 'sab', month: 1, title: 'Primeiro dia: o que é programar e o mapa da tecnologia',
    goal: 'Entender o que é um programa, conhecer as áreas da programação e o plano do curso.',
    lessons: ['l-welcome', 'l-prog', 'l-areas', 'l-files'], resources: ['r-cdf-fullstack', 'r-cdf-dicionario', 'r-cev-algo'],
    practice: ['Rode todos os exemplos de código das aulas e mude os valores', 'Assista ao vídeo sobre dev full stack', 'Escreva num papel 3 áreas que mais chamaram sua atenção'],
    challenge: 'Escreva, em português, o "algoritmo" de fazer um café com 8 passos. Depois procure um passo ambíguo e corrija.',
    next: 'Amanhã: terminal, ferramentas e suas primeiras variáveis.' },
  { id: 's2', n: 2, week: 1, day: 'dom', month: 1, title: 'Terminal, ferramentas e variáveis',
    goal: 'Usar o terminal, preparar o computador e guardar informações em variáveis.',
    lessons: ['l-terminal', 'l-tools', 'l-vars'], resources: ['r-vscode', 'r-cev-js', 'r-node-docs'],
    practice: ['No computador: instale VS Code e Node.js e confira as versões', 'Crie a pasta "estudos" e rode seu primeiro arquivo .js', 'Exercícios de variáveis no app'],
    challenge: 'Crie variáveis com seu nome, idade e cidade e mostre a frase "Eu sou X, tenho Y anos e moro em Z".',
    next: 'Semana 2: operadores, decisões (if) e repetições (laços).' },
  { id: 's3', n: 3, week: 2, day: 'sab', month: 1, title: 'Operadores, decisões e repetições',
    goal: 'Fazer contas, comparar valores, tomar decisões com if e repetir tarefas com laços.',
    lessons: ['l-ops', 'l-cond', 'l-loops'], resources: ['r-cev-algo', 'r-cev-js', 'r-pythontutor'],
    practice: ['Exercícios de condicionais e laços no app', 'Assista às aulas de condições e repetições do Curso em Vídeo', 'Use o Python Tutor para ver um laço rodando passo a passo'],
    challenge: 'Mostre a tabuada do 7 (7 x 1 = 7 até 7 x 10 = 70) usando um laço.',
    next: 'Amanhã: funções e o método para resolver qualquer problema.' },
  { id: 's4', n: 4, week: 2, day: 'dom', month: 1, title: 'Funções e resolução de problemas',
    goal: 'Criar funções reutilizáveis e aplicar o método de 5 passos para resolver problemas.',
    lessons: ['l-func', 'l-logic', 'l-english'], resources: ['r-beecrowd', 'r-exercism-js', 'r-cev-js'],
    practice: ['Exercícios de funções e lógica no app', 'Resolva 2 problemas iniciantes no beecrowd (ex.: 1001 e 1003)', 'Monte seu glossário de inglês técnico'],
    challenge: 'Crie a função ehPar(n) e use-a num laço que mostra só os pares de 1 a 20.',
    next: 'Semana 3: listas, objetos, erros e orientação a objetos.' },
  { id: 's5', n: 5, week: 3, day: 'sab', month: 1, title: 'Arrays, objetos, erros e classes',
    goal: 'Organizar dados em listas e objetos, entender mensagens de erro e criar classes.',
    lessons: ['l-data', 'l-errors', 'l-oop'], resources: ['r-cdf-poo', 'r-mdn-js', 'r-pythontutor'],
    practice: ['Exercícios de arrays e objetos', 'Provoque erros de propósito e leia as mensagens', 'Assista ao vídeo de POO e faça a classe Carrinho'],
    challenge: 'Crie uma lista de 5 produtos {nome, preco} e mostre o mais caro e a soma de todos.',
    next: 'Amanhã: você vai criar suas primeiras páginas web com HTML e CSS.' },
  { id: 's6', n: 6, week: 3, day: 'dom', month: 1, title: 'Frontend 1: HTML, CSS e layout',
    goal: 'Montar páginas com HTML, estilizar com CSS e posicionar elementos com Flexbox e Grid.',
    lessons: ['l-html', 'l-css', 'l-css-layout'], resources: ['r-cev-html1', 'r-kich-flex', 'r-froggy', 'r-gridgarden'],
    practice: ['Laboratórios HTML do app (edite e veja o resultado)', 'Flexbox Froggy até o nível 12', 'Comece o projeto "Página pessoal": só o HTML'],
    project: { id: 'p-landing', step: 'Crie o index.html com as seções Sobre, Habilidades, Projetos e Contato.' },
    challenge: 'Faça um cartão de produto (imagem, nome, preço, botão) centralizado na tela com Flexbox.',
    next: 'Semana 4: JavaScript no navegador, Git/GitHub e Python.' },
  { id: 's7', n: 7, week: 4, day: 'sab', month: 1, title: 'Frontend 2: DOM, eventos e Git/GitHub',
    goal: 'Deixar a página interativa com JavaScript e guardar seu código no GitHub.',
    lessons: ['l-dom', 'l-git'], resources: ['r-cdf-dom', 'r-devclub-dom', 'r-cev-git', 'r-learngit'],
    practice: ['Laboratório: lista de tarefas com DOM', 'Learn Git Branching: nível Introdução', 'Crie sua conta no GitHub e seu primeiro repositório'],
    project: { id: 'p-landing', step: 'Termine o CSS responsivo, adicione o botão de tema com JavaScript e publique no GitHub Pages.' },
    challenge: 'Crie um contador com botões + e − que não deixa o número ficar negativo.',
    next: 'Amanhã: sua segunda linguagem — Python — e avaliação do Mês 1.' },
  { id: 's8', n: 8, week: 4, day: 'dom', month: 1, title: 'Python e avaliação do Mês 1',
    goal: 'Comparar linguagens, programar em Python e medir o que você aprendeu no mês.',
    lessons: ['l-langs', 'l-python-1', 'l-python-2'], resources: ['r-hashtag-py10', 'r-cev-py1', 'r-cev-py2', 'r-colab'],
    practice: ['Rode os exemplos de Python no app', 'Refaça em Python 2 exercícios que você fez em JavaScript', 'Faça a avaliação do Mês 1 (aba Progresso)'],
    project: { id: 'p-relatorio-py', step: 'Opcional: comece o relatório de vendas em Python (no Google Colab).' },
    challenge: 'Em Python: dada uma lista de notas, mostre a média e quantas notas ficaram acima dela.',
    assessment: 1,
    next: 'Mês 2: como aplicações reais funcionam — frontend falando com backend.' },

  // ════════ MÊS 2 ════════
  { id: 's9', n: 9, week: 5, day: 'sab', month: 2, title: 'JSON, consumo de APIs e TypeScript',
    goal: 'Entender o formato de dados da web, buscar dados de APIs reais e escrever código com tipos.',
    lessons: ['l-json', 'l-fetch-front', 'l-ts'], resources: ['r-devzito-fetch', 'r-cdf-ts', 'r-hoppscotch'],
    practice: ['Laboratório: buscador de CEP (precisa de internet)', 'Teste a API ViaCEP no Hoppscotch', 'Exercícios de TypeScript'],
    challenge: 'Busque 3 CEPs diferentes e mostre só as cidades, em ordem alfabética.',
    next: 'Amanhã: Node.js — JavaScript no servidor.' },
  { id: 's10', n: 10, week: 5, day: 'dom', month: 2, title: 'Node.js, npm e programação assíncrona',
    goal: 'Rodar JavaScript no servidor, usar pacotes npm e entender async/await.',
    lessons: ['l-node', 'l-async'], optional: ['l-runtime'], resources: ['r-cdf-node', 'r-node-docs'],
    practice: ['No computador: npm init e instale um pacote', 'Exercícios de Promises e async/await', 'Opcional: aula de event loop'],
    project: { id: 'p-tarefas-cli', step: 'Faça o gerenciador de tarefas no terminal (Node.js + arquivo JSON).' },
    challenge: 'Crie uma função esperar(ms) com Promise e mostre "1", "2", "3" com 1 segundo de intervalo.',
    next: 'Semana 6: como a internet funciona — HTTP, redes e configuração.' },
  { id: 's11', n: 11, week: 6, day: 'sab', month: 2, title: 'HTTP, redes e configuração',
    goal: 'Entender requisições e respostas HTTP, status codes, DNS e variáveis de ambiente.',
    lessons: ['l-http', 'l-network', 'l-env'], resources: ['r-cdf-http', 'r-battisti-api', 'r-12factor'],
    practice: ['Abra o DevTools (aba Network) num site e observe as requisições', 'Exercícios de HTTP e status', 'Crie um arquivo .env de exemplo e leia com process.env'],
    challenge: 'Liste 5 status HTTP de memória (200, 201, 400, 401, 404, 500…) e quando usar cada um.',
    next: 'Amanhã: sua primeira API de verdade!' },
  { id: 's12', n: 12, week: 6, day: 'dom', month: 2, title: 'Sua primeira API: rotas e CRUD',
    goal: 'Criar uma API com Express com rotas GET, POST, PUT/PATCH e DELETE e validação.',
    lessons: ['l-first-api', 'l-crud'], resources: ['r-cdf-rest', 'r-hashtag-api16', 'r-battisti-node', 'r-express-pt'],
    practice: ['No computador: crie a API com Express e teste no Hoppscotch', 'Exercícios de CRUD e validação no app'],
    project: { id: 'p-api-tarefas', step: 'API de tarefas em memória: listar, criar (com validação), concluir e remover.' },
    challenge: 'Adicione à API a rota GET /tarefas?status=pendente que filtra as tarefas.',
    next: 'Semana 7: bancos de dados, SQL e PostgreSQL.' },
  { id: 's13', n: 13, week: 7, day: 'sab', month: 2, title: 'Bancos de dados e SQL na prática',
    goal: 'Criar tabelas e fazer consultas SQL de verdade: filtros, ordenação, agregação e JOIN.',
    lessons: ['l-db', 'l-sql-lab'], resources: ['r-cdf-sql', 'r-sqlbolt', 'r-cev-mysql'],
    practice: ['Laboratório SQL do app: todos os exercícios', 'SQLBolt lições 1 a 6', 'Minicurso de SQL do Código Fonte TV (pause e teste)'],
    challenge: 'Escreva uma consulta que mostre a cidade com mais clientes no banco Loja.',
    next: 'Amanhã: PostgreSQL de verdade conectado à sua API.' },
  { id: 's14', n: 14, week: 7, day: 'dom', month: 2, title: 'PostgreSQL com Node.js',
    goal: 'Criar um banco PostgreSQL (Neon) e conectar sua API com consultas parametrizadas.',
    lessons: ['l-postgres'], optional: ['l-nosql'], resources: ['r-ilustradev-pg', 'r-luiztools-pg', 'r-neon', 'r-dbfiddle'],
    practice: ['Crie conta no Neon e a tabela tarefas', 'Troque o array da API de tarefas pelo PostgreSQL', 'Teste todas as rotas no Hoppscotch'],
    project: { id: 'p-api-tarefas', step: 'Migre a API de tarefas para o PostgreSQL usando o pacote pg e $1, $2.' },
    challenge: 'Faça a rota DELETE responder 404 quando a tarefa não existir.',
    next: 'Semana 8: relacionamentos entre tabelas e um passeio por mobile, desktop, dados e jogos.' },
  { id: 's15', n: 15, week: 8, day: 'sab', month: 2, title: 'Relacionamentos, modelagem e projeto com 2 tabelas',
    goal: 'Modelar tabelas relacionadas, usar chaves estrangeiras e JOINs numa API.',
    lessons: ['l-joins', 'l-nosql'], resources: ['r-letsdata-join', 'r-cdf-mongo', 'r-devclub-api'],
    practice: ['Desenhe as tabelas do seu projeto em dbdiagram.io ou no papel', 'Exercícios de JOIN', 'Compare SQL × NoSQL'],
    project: { id: 'p-api-postgres', step: 'API de produtos e categorias com PostgreSQL (2 tabelas relacionadas + JOIN).' },
    challenge: 'Crie a rota GET /categorias/:id/produtos com JOIN.',
    next: 'Amanhã: dia de exploração — mobile, desktop, automação, dados, jogos e mais.' },
  { id: 's16', n: 16, week: 8, day: 'dom', month: 2, title: 'Exploração: mobile, desktop, automação, dados e jogos + avaliação do Mês 2',
    goal: 'Experimentar outras áreas da programação e medir seu progresso do Mês 2.',
    lessons: ['l-mobile', 'l-mobile-dev', 'l-desktop', 'l-python-auto', 'l-data-science', 'l-games', 'l-other-areas'],
    resources: ['r-cdf-flutter', 'r-dartpad', 'r-cdf-electron', 'r-cdf-pandas', 'r-godot-next', 'r-cdf-seg', 'r-wokwi'],
    practice: ['Leia cada aula e faça os exercícios (20–25 min por área)', 'Rode o mini jogo e mude a velocidade do jogador', 'Avalie de 1 a 5 o quanto gostou de cada área (aba Áreas)', 'Faça a avaliação do Mês 2'],
    challenge: 'No mini jogo, faça a estrela valer 2 pontos e o jogo mostrar "Você venceu!" ao chegar a 10.',
    assessment: 2,
    next: 'Mês 3: aprofundamento em Backend — arquitetura, autenticação, segurança, testes, deploy e projeto final.' },

  // ════════ MÊS 3 ════════
  { id: 's17', n: 17, week: 9, day: 'sab', month: 3, title: 'Arquitetura e design de APIs + planejamento do projeto final',
    goal: 'Organizar o código em camadas, desenhar APIs profissionais e planejar o projeto final.',
    lessons: ['l-arch', 'l-api-design'], resources: ['r-cdf-arq', 'r-cdf-rest', 'r-roadmap-back'],
    practice: ['Exercícios de arquitetura e design de APIs', 'Escreva a lista de rotas do projeto final (método + caminho + resposta)'],
    project: { id: 'p-final', step: 'Planejamento: rotas, tabelas (users, projects, tasks) e estrutura de pastas.' },
    challenge: 'Desenhe o diagrama das tabelas do TaskFlow com as chaves estrangeiras.',
    next: 'Amanhã: autenticação e autorização — login de verdade.' },
  { id: 's18', n: 18, week: 9, day: 'dom', month: 3, title: 'Autenticação e autorização (JWT)',
    goal: 'Criar cadastro e login com senha protegida (bcrypt), tokens JWT e rotas protegidas.',
    lessons: ['l-auth'], resources: ['r-cdf-jwt', 'r-luiztools-jwt'],
    practice: ['Exercícios de middleware e autenticação', 'Crie o repositório do projeto final com Express + /health + conexão com o Neon', 'Implemente POST /auth/register e POST /auth/login'],
    project: { id: 'p-final', step: 'Repositório, estrutura de pastas, /health, cadastro e login com bcrypt + JWT.' },
    challenge: 'Faça o login responder 401 tanto para e-mail inexistente quanto para senha errada (com a mesma mensagem). Por quê?',
    next: 'Semana 10: segurança de aplicações e performance do banco.' },
  { id: 's19', n: 19, week: 10, day: 'sab', month: 3, title: 'Segurança de aplicações',
    goal: 'Proteger a API contra SQL injection, XSS, CSRF e abusos; guardar segredos corretamente.',
    lessons: ['l-security', 'l-web-sec'], resources: ['r-owasp', 'r-cdf-seg'],
    practice: ['Exercícios de segurança', 'Revise o projeto final: todas as consultas usam $1? Senhas com bcrypt? .env no .gitignore?'],
    project: { id: 'p-final', step: 'Middleware de autenticação e CRUD de tasks com autorização por dono/papel.' },
    challenge: 'Teste: o usuário A consegue apagar uma tarefa do usuário B? Se sim, corrija.',
    next: 'Amanhã: índices, transações e organização final da API.' },
  { id: 's20', n: 20, week: 10, day: 'dom', month: 3, title: 'Banco de dados avançado + integração front/back',
    goal: 'Usar índices e transações e juntar frontend, API e banco numa aplicação completa.',
    lessons: ['l-db-adv', 'l-fullstack'], optional: ['l-cache'], resources: ['r-pgtutorial', 'r-dbfiddle'],
    practice: ['Exercícios de transações e índices', 'Adicione filtros e paginação em GET /tasks', 'Centralize o tratamento de erros'],
    project: { id: 'p-final', step: 'Filtros, paginação, validação e tratamento de erros centralizado.' },
    challenge: 'Crie um índice para a coluna usada no filtro mais comum e explique por quê.',
    next: 'Semana 11: testes automatizados e deploy na nuvem.' },
  { id: 's21', n: 21, week: 11, day: 'sab', month: 3, title: 'Testes automatizados e correção de erros',
    goal: 'Escrever testes que provam que a API funciona e depurar problemas com método.',
    lessons: ['l-testing'], resources: ['r-kipper-jest'],
    practice: ['Exercícios de testes e casos extremos', 'Escreva pelo menos 8 testes no projeto final (register, login, tasks, permissões)'],
    project: { id: 'p-final', step: 'Testes automatizados com node:test ou Vitest + supertest.' },
    challenge: 'Escreva um teste que FALHA, entenda a mensagem e faça ele passar corrigindo o código.',
    next: 'Amanhã: colocar tudo no ar — Docker, nuvem e deploy.' },
  { id: 's22', n: 22, week: 11, day: 'dom', month: 3, title: 'Docker, nuvem e deploy',
    goal: 'Entender containers e CI/CD e publicar a API e o banco gratuitamente.',
    lessons: ['l-devops', 'l-cloud'], optional: ['l-linux'], resources: ['r-cdf-containers', 'r-cdf-cloud', 'r-render-node', 'r-neon'],
    practice: ['Exercícios de DevOps e nuvem', 'Publique a API no Render com o banco no Neon', 'Teste /health pelo celular'],
    project: { id: 'p-final', step: 'Deploy: Render (API) + Neon (banco) + variáveis de ambiente.' },
    challenge: 'Coloque no README o link público da API e um exemplo de requisição com curl.',
    next: 'Semana 12: IA no backend, projeto final pronto e preparação para o mercado.' },
  { id: 's23', n: 23, week: 12, day: 'sab', month: 3, title: 'IA e automação no backend + interface do projeto',
    goal: 'Entender como modelos de IA funcionam, integrar APIs de IA com segurança e terminar a interface do projeto.',
    lessons: ['l-ai-intro', 'l-ai-api', 'l-automation'], optional: ['l-rag', 'l-realtime', 'l-api-styles'], resources: ['r-cdf-ia', 'r-cev-llm', 'r-cdf-ml'],
    practice: ['Exercícios de IA e automação', 'Interface web do projeto final: login + lista + criar tarefa via fetch', 'Libere CORS só para o endereço do seu frontend'],
    project: { id: 'p-final', step: 'Interface web (HTML/CSS/JS) consumindo a API publicada.' },
    challenge: 'Pense numa funcionalidade de IA para o TaskFlow (ex.: resumo semanal) e escreva como validaria a resposta do modelo.',
    next: 'Amanhã: último dia — portfólio, currículo, entrevistas e avaliação final.' },
  { id: 's24', n: 24, week: 12, day: 'dom', month: 3, title: 'Portfólio, carreira, entrevistas e avaliação final',
    goal: 'Deixar o GitHub e o currículo prontos, treinar entrevistas e avaliar honestamente sua preparação.',
    lessons: ['l-portfolio', 'l-career', 'l-interview'], resources: ['r-kich-github', 'r-curriculo-magro', 'r-kipper-entrevista', 'r-vagas-backend'],
    practice: ['README do projeto final com prints, diagrama, rotas e links', 'README de perfil no GitHub e projetos fixados', 'Currículo de 1 página', 'Avaliação final e relatório de preparação (aba Carreira)'],
    project: { id: 'p-final', step: 'Documentação final, README e apresentação do projeto em 3 minutos.' },
    challenge: 'Grave (ou ensaie em voz alta) uma explicação de 3 minutos do seu projeto final: problema, solução, tecnologias, desafios.',
    assessment: 3,
    next: 'Parabéns! Siga o plano de continuidade na aba Carreira para os próximos 3 meses.' },
];

/** Blocos de tempo padrão de uma sessão (13h30–16h30). */
export interface Block { start: string; minutes: number; kind: 'revisao' | 'aula' | 'pausa' | 'pratica' | 'projeto' | 'desafio' | 'fechamento'; title: string; detail: string }

export function blocksFor(s: Session, lessonTitle: (id: string) => string): Block[] {
  const [a, ...rest] = s.lessons;
  const b = rest.length ? rest.map(lessonTitle).join(' + ') : '';
  const blocks: Block[] = [
    { start: '13:30', minutes: 10, kind: 'revisao', title: 'Revisão', detail: 'Refaça os exercícios que o app separou para revisão (botão "Revisar agora").' },
    { start: '13:40', minutes: 50, kind: 'aula', title: 'Aula: ' + lessonTitle(a), detail: 'Leia cada passo, rode os exemplos, mude o código e faça os exercícios.' },
    { start: '14:30', minutes: 10, kind: 'pausa', title: 'Pausa', detail: 'Levante, beba água, descanse os olhos longe de telas.' },
    { start: '14:40', minutes: 35, kind: 'pratica', title: 'Prática guiada', detail: s.practice.slice(0, 2).join(' • ') },
  ];
  if (b) blocks.push({ start: '15:15', minutes: s.project ? 35 : 50, kind: 'aula', title: 'Aula: ' + b, detail: 'Continue no mesmo ritmo: entender, rodar, praticar.' });
  if (s.project) blocks.push({ start: b ? '15:50' : '15:15', minutes: b ? 15 : 50, kind: 'projeto', title: 'Projeto', detail: s.project.step });
  blocks.push({ start: '16:05', minutes: 15, kind: 'desafio', title: 'Desafio sem consulta', detail: s.challenge });
  blocks.push({ start: '16:20', minutes: 10, kind: 'fechamento', title: 'Fechamento', detail: 'Anote: o que aprendi hoje? O que ficou difícil? ' + s.next });
  return blocks;
}
