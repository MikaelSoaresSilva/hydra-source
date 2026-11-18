import type { Lesson } from '../types';

export const carreira: Lesson[] = [
  {
    id: 'l-career', area: 'carreira', phase: 3,
    title: 'Mercado de trabalho: vagas, currículo, GitHub e candidaturas',
    goal: 'Saber o que as vagas de entrada pedem, montar currículo e GitHub e organizar a busca por estágio/júnior.',
    minutes: 20, competencies: ['career'], prereqs: ['l-portfolio'],
    steps: [
      { kind: 'table', title: 'Níveis de carreira', body: 'Os nomes variam entre empresas, mas a ideia geral é esta:', table: { headers: ['Nível', 'Expectativa'], rows: [
        ['Estágio', 'Estudante (técnico/faculdade) aprendendo com supervisão. Exige matrícula ativa.'],
        ['Trainee / Júnior', 'Resolve tarefas bem definidas, com ajuda. Sabe o básico e aprende rápido.'],
        ['Pleno', 'Trabalha com autonomia, entrega funcionalidades completas.'],
        ['Sênior', 'Decide arquitetura, orienta outras pessoas, resolve problemas difíceis.'],
      ] } },
      { kind: 'table', title: 'O que vagas de backend júnior costumam pedir', body: 'Compare com o que você aprendeu (✓ = coberto no curso):', table: { headers: ['Requisito', 'No curso'], rows: [
        ['Lógica de programação', '✓ Mês 1'],
        ['Uma linguagem backend (Node.js/TS, Java, C#, Python, PHP, Go)', '✓ Node.js + TypeScript (base)'],
        ['APIs REST e HTTP', '✓ Mês 2 e 3'],
        ['SQL e banco relacional (PostgreSQL/MySQL)', '✓ Mês 2'],
        ['Git e GitHub', '✓ Mês 1'],
        ['Noções de testes automatizados', '✓ Mês 3 (introdução)'],
        ['Docker, nuvem, CI/CD', '◐ introdução — aprofunde depois'],
        ['Inglês para leitura', '◐ glossário — continue praticando'],
        ['Framework (NestJS, Spring, .NET)', '✗ próximo passo após o curso'],
      ] } },
      { kind: 'text', title: 'Currículo de dev iniciante (1 página)', body: '1. Nome, cidade, LinkedIn, GitHub, e-mail.\n2. Resumo (3 linhas): "Desenvolvedor backend em formação, com projetos em Node.js, TypeScript e PostgreSQL…"\n3. Habilidades técnicas: só o que você consegue explicar numa entrevista.\n4. Projetos (a parte mais importante para quem não tem experiência): nome, o que faz, tecnologias, link do GitHub e do deploy.\n5. Formação e cursos.\n6. Experiências anteriores (mesmo fora de TI): mostram responsabilidade, trabalho em equipe e comunicação.' },
      { kind: 'text', title: 'GitHub que chama atenção', body: '• Foto e bio clara ("Backend Developer em formação | Node.js · TypeScript · PostgreSQL").\n• README de perfil (repositório com o seu nome de usuário).\n• Fixe (pin) seus 3–6 melhores projetos.\n• Cada projeto com README: o que é, prints, como rodar, rotas da API, tecnologias, o que aprendeu.\n• Commits frequentes e com mensagens claras ("adiciona validação no cadastro").' },
      { kind: 'table', title: 'Onde procurar vagas', body: 'Estes canais aparecem na aba Carreira com links:', table: { headers: ['Canal', 'Dica'], rows: [
        ['LinkedIn Vagas', 'Filtre por "Júnior", "Estágio" e "Remoto"; ative alertas'],
        ['Gupy e portais de empresas', 'Muitas empresas brasileiras recrutam por lá'],
        ['GitHub backend-br/vagas', 'Vagas de backend publicadas como issues'],
        ['CIEE e agências de estágio', 'Para quem estuda em curso técnico/faculdade'],
        ['Programathor, GeekHunter', 'Plataformas focadas em tecnologia'],
        ['Comunidades e eventos', 'Meetups, Discord, grupos locais: indicação abre portas'],
      ] } },
      { kind: 'tip', title: 'Estratégia semanal de candidaturas', body: 'Depois do curso: candidate-se a 5–10 vagas por semana, adapte o resumo para cada vaga, anote tudo numa planilha (empresa, data, status) e peça feedback quando reprovar. Vagas pedindo "2 anos de experiência" para júnior muitas vezes aceitam projetos sólidos — candidate-se mesmo assim.' },
    ],
    simpler: 'Vagas de entrada pedem lógica, uma linguagem backend, APIs, SQL e Git. Sem experiência, seus PROJETOS no GitHub são a prova do que você sabe.',
    otherWay: 'Procurar a primeira vaga é como vender um produto novo: o currículo é a embalagem, o GitHub é a amostra grátis e a entrevista é a demonstração.',
    realExample: 'Um recrutador abre seu GitHub, vê uma API publicada com autenticação, testes e um README bem explicado — isso pesa mais do que uma lista de 20 tecnologias no currículo.',
    exercises: [
      { id: 'e-career-1', type: 'mcq', competency: 'career', prompt: 'Para quem não tem experiência profissional, qual é a parte mais importante do currículo de dev?', options: ['Lista enorme de tecnologias', 'Projetos com link para o código e para a versão publicada', 'Foto profissional', 'Hobbies'], answer: 1, hints: ['O que prova que você sabe fazer?'], solution: 'Projetos com link para o código e para a versão publicada', explanation: 'Projetos demonstram na prática o que você sabe. Coloque só tecnologias que consegue explicar.', errorKind: 'conhecimento' },
      { id: 'e-career-2', type: 'mcq', competency: 'career', prompt: 'Uma vaga júnior pede "1 ano de experiência". Você tem projetos sólidos, mas nenhum emprego na área. O que fazer?', options: ['Não se candidatar nunca', 'Se candidatar mesmo assim, destacando os projetos', 'Mentir no currículo', 'Esperar 1 ano parado'], answer: 1, hints: ['Requisitos costumam ser uma lista de desejos.'], solution: 'Se candidatar mesmo assim, destacando os projetos', explanation: 'Muitas vagas são flexíveis. Projetos bem feitos compensam parte da experiência. Nunca minta — isso aparece na entrevista.', errorKind: 'conhecimento' },
      { id: 'e-career-3', type: 'mcq', competency: 'career', prompt: 'O que um bom README de projeto deve ter?', options: ['Só o nome do projeto', 'O que o projeto faz, como rodar, tecnologias, rotas/prints e link do deploy', 'A senha do banco', 'Nada, o código fala por si'], answer: 1, hints: ['Pense em quem nunca viu o projeto.'], solution: 'O que o projeto faz, como rodar, tecnologias, rotas/prints e link do deploy', explanation: 'O README é a vitrine. Recrutadores passam poucos minutos em cada perfil.', errorKind: 'conhecimento' },
      { id: 'e-career-4', type: 'mcq', competency: 'career', prompt: 'Para vagas de ESTÁGIO, normalmente é exigido…', options: ['Ser sênior', 'Estar matriculado em curso técnico ou superior', 'Ter 10 anos de experiência', 'Ter certificação internacional'], answer: 1, hints: ['A lei de estágio exige vínculo com instituição de ensino.'], solution: 'Estar matriculado em curso técnico ou superior', explanation: 'No Brasil, o estágio é regido pela Lei 11.788/2008 e exige matrícula. Sem isso, procure vagas de júnior ou trainee.', errorKind: 'conhecimento' },
      { id: 'e-career-5', type: 'explain', competency: 'career', prompt: 'Escreva o resumo (2–3 frases) que você colocaria no topo do seu currículo ao terminar o curso.', keywords: [['backend', 'back-end', 'desenvolvedor', 'desenvolvedora', 'programador', 'programadora'], ['node', 'typescript', 'javascript', 'postgres', 'sql', 'api', 'python']], minGroups: 2, hints: ['Cite sua direção (backend) e as tecnologias principais.'], solution: 'Exemplo: "Desenvolvedor backend em formação, com projetos de APIs REST em Node.js, TypeScript e PostgreSQL, incluindo autenticação JWT, testes e deploy. Busco minha primeira oportunidade como júnior ou estágio."', explanation: 'Um bom resumo diz quem você é, o que sabe fazer (com tecnologias) e o que busca.', errorKind: 'conhecimento' },
    ],
    docs: [{ label: 'GitHub: vagas de backend (backend-br)', url: 'https://github.com/backend-br/vagas' }, { label: 'GitHub Docs: README de perfil', url: 'https://docs.github.com/pt/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme' }],
  },
];
