// Conteúdo da área de Carreira: mercado, checklist, plano de continuidade e honestidade.

export const MARKET: { title: string; body: string }[] = [
  { title: 'Como o mercado funciona', body: 'Empresas de todos os setores (bancos, varejo, saúde, governo, startups, consultorias) contratam desenvolvedores. Há vagas presenciais, híbridas e remotas, como CLT, PJ ou estágio. Vagas de entrada são as mais disputadas: por isso projetos bem feitos e constância fazem diferença.' },
  { title: 'Funções em uma equipe de software', body: 'Desenvolvedores (frontend, backend, mobile, full stack), QA (qualidade), DevOps/SRE (infraestrutura), dados, designers UX/UI, Product Manager/Owner (decide o que construir) e Tech Lead (lidera tecnicamente). Backend conversa com quase todos.' },
  { title: 'Competências técnicas pedidas no júnior backend', body: 'Lógica; uma linguagem (JavaScript/TypeScript com Node.js, Java, C#, Python, PHP ou Go); APIs REST; HTTP; SQL e um banco relacional; Git; noções de testes, Docker e nuvem; leitura de documentação em inglês.' },
  { title: 'Competências comportamentais', body: 'Comunicação clara, saber pedir ajuda depois de tentar, organização, aprender rápido, receber feedback, trabalhar em equipe. Em entrevistas júnior, isso pesa tanto quanto o técnico.' },
  { title: 'Entrevista técnica: o que esperar', body: '1) Conversa com RH. 2) Teste técnico (desafio para casa ou ao vivo, como uma API pequena). 3) Entrevista técnica: explicar seu projeto, conceitos (HTTP, SQL, REST, Git), resolver um problema pensando em voz alta. 4) Conversa final. Treine explicar seu raciocínio — errar com bom raciocínio costuma valer mais que acertar em silêncio.' },
  { title: 'Como identificar lacunas', body: 'Pegue 10 vagas júnior reais, liste os requisitos que mais se repetem e marque o que você sabe. O que falta e aparece muito é o que estudar primeiro. A aba Progresso mostra seus pontos fracos no curso.' },
];

export const CHECKLIST: { id: string; text: string }[] = [
  { id: 'gh-perfil', text: 'GitHub com foto, bio ("Backend Developer em formação") e README de perfil' },
  { id: 'gh-pins', text: '3 a 6 melhores projetos fixados no GitHub' },
  { id: 'proj-final', text: 'Projeto final publicado (link /health funcionando) e com README completo' },
  { id: 'proj-readme', text: 'Todos os projetos com README: o que é, como rodar, tecnologias, prints' },
  { id: 'cv', text: 'Currículo de 1 página com resumo, habilidades e projetos com links' },
  { id: 'linkedin', text: 'LinkedIn atualizado (título, sobre, projetos em destaque, GitHub)' },
  { id: 'pitch', text: 'Explicação do projeto final em 3 minutos ensaiada em voz alta' },
  { id: 'perguntas', text: 'Respostas para "fale sobre você", "por que backend?" e "maior desafio do projeto"' },
  { id: 'vagas', text: 'Planilha de candidaturas criada (empresa, vaga, data, status)' },
  { id: 'alertas', text: 'Alertas de vaga ativos (LinkedIn, Gupy) para "backend júnior" e "estágio"' },
  { id: 'comunidade', text: 'Participando de pelo menos 1 comunidade (Discord, meetup, grupo local)' },
];

export const NEXT_90_DAYS: { period: string; focus: string; items: string[] }[] = [
  { period: 'Meses 4 e 5', focus: 'Profundidade em Backend', items: ['TypeScript de verdade em todos os projetos', 'Um framework: NestJS (Node) — ou Spring Boot (Java) / .NET (C#) se as vagas da sua região pedirem', 'ORM (Prisma ou Drizzle) + migrations', 'Docker Compose (API + PostgreSQL) e GitHub Actions rodando testes', '1 desafio do backend-br/desafios por mês no GitHub'] },
  { period: 'Mês 6', focus: 'Qualidade e mercado', items: ['Testes de integração e cobertura', 'Cache com Redis e filas (aulas opcionais do app)', 'Algoritmos e estruturas de dados para entrevistas (aula de Big O + beecrowd)', 'Inglês técnico: ler documentação sem tradutor', '5–10 candidaturas por semana + pedir feedback'] },
  { period: 'Sempre', focus: 'Hábitos', items: ['Manter as 6 h semanais de estudo (os lembretes continuam!)', 'Commits frequentes no GitHub', 'Ensinar o que aprendeu (posts no LinkedIn/TabNews) — consolida o conhecimento e dá visibilidade', 'Networking: eventos, comunidades, contribuir com projetos open source'] },
];

export const HONESTY = `72 horas de estudo bem feito colocam você num patamar sólido de INICIANTE: você entende como sistemas funcionam, programa em JavaScript/TypeScript e Python, cria APIs com banco de dados, autenticação e testes, publica projetos e conhece as principais áreas da tecnologia.

Isso NÃO é o mesmo que estar plenamente qualificado. Para comparação: um curso técnico tem centenas de horas e uma graduação, milhares. A maioria das pessoas que consegue a primeira vaga júnior estuda de 6 a 12 meses (ou mais) e constrói vários projetos. O mercado de entrada é competitivo.

O que este curso garante, se você fizer tudo: base consistente, direção clara (Backend), um portfólio inicial de verdade e um plano para continuar. Com mais 3 a 6 meses mantendo o ritmo, suas chances de conquistar estágio ou vaga júnior aumentam muito.`;
