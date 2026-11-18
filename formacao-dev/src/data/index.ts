import type { AreaId, Lesson, Project } from './types';
import oldLessons from './old/lessons.json';
import oldProjects from './old/projects.json';
import oldLibs from './old/libs.json';
import { fundamentosNovos } from './lessons/fundamentos';
import { frontend } from './lessons/frontend';
import { python } from './lessons/python';
import { backendNovos } from './lessons/backend';
import { exploracao } from './lessons/exploracao';
import { carreira } from './lessons/carreira';
import { projetosNovos } from './projects-new';

export interface Area { id: AreaId; name: string; icon: string; color: string; desc: string; focus?: boolean; jobs: string }

export const AREAS: Area[] = [
  { id: 'fund', name: 'Fundamentos e lógica', icon: '🧠', color: '#8b5cf6', desc: 'Algoritmos, variáveis, condicionais, laços, funções, estruturas de dados, orientação a objetos e Python.', jobs: 'Base de todas as carreiras' },
  { id: 'ferramentas', name: 'Ferramentas profissionais', icon: '🧰', color: '#64748b', desc: 'Terminal, VS Code, Git e GitHub, Linux e Docker.', jobs: 'Usadas por todos os devs' },
  { id: 'front', name: 'Frontend', icon: '🎨', color: '#ec4899', desc: 'HTML, CSS, layout responsivo, DOM, TypeScript e consumo de APIs.', jobs: 'Dev Frontend, Full Stack' },
  { id: 'back', name: 'Backend (foco)', icon: '⚙️', color: '#22c55e', focus: true, desc: 'Node.js, TypeScript, HTTP, APIs REST, PostgreSQL, autenticação, segurança, testes, arquitetura e deploy.', jobs: 'Dev Backend, Full Stack, Engenheiro de Software' },
  { id: 'mobile', name: 'Mobile', icon: '📱', color: '#f97316', desc: 'Android, iOS, Kotlin, Flutter/Dart e apps multiplataforma.', jobs: 'Dev Android, iOS, Flutter, React Native' },
  { id: 'desktop', name: 'Desktop', icon: '🖥️', color: '#0ea5e9', desc: 'Programas para Windows, Linux e macOS: Electron, Tauri, .NET, Qt.', jobs: 'Dev Desktop, .NET' },
  { id: 'ia', name: 'IA e automação', icon: '🤖', color: '#eab308', desc: 'Como modelos de IA funcionam, APIs de IA, RAG e automação com Python.', jobs: 'Dev de IA, Engenheiro de automação' },
  { id: 'dados', name: 'Ciência de dados', icon: '📊', color: '#14b8a6', desc: 'Análise de dados, estatística básica, pandas e visualização.', jobs: 'Analista/Cientista/Engenheiro de dados' },
  { id: 'jogos', name: 'Jogos', icon: '🎮', color: '#ef4444', desc: 'Game loop, colisões, motores (Godot, Unity, Unreal), 2D e 3D.', jobs: 'Dev de jogos, Backend de jogos' },
  { id: 'outras', name: 'Nuvem, segurança e mais', icon: '☁️', color: '#6366f1', desc: 'Computação em nuvem, segurança da informação, embarcados, QA, DevOps.', jobs: 'DevOps, Cloud, Segurança, QA, Embarcados' },
  { id: 'carreira', name: 'Carreira', icon: '💼', color: '#a16207', desc: 'Portfólio, currículo, GitHub, entrevistas e busca de vagas.', jobs: 'Para conquistar a primeira vaga' },
];

/** Área de cada aula da versão anterior do app. */
const OLD_AREA: Record<string, AreaId> = {
  'l-prog': 'fund', 'l-files': 'ferramentas', 'l-terminal': 'ferramentas', 'l-vars': 'fund', 'l-ops': 'fund', 'l-cond': 'fund',
  'l-loops': 'fund', 'l-func': 'fund', 'l-data': 'fund', 'l-errors': 'fund', 'l-english': 'carreira', 'l-algo': 'fund',
  'l-node': 'back', 'l-async': 'back', 'l-runtime': 'back', 'l-ts': 'back', 'l-git': 'ferramentas', 'l-http': 'back', 'l-network': 'back',
  'l-json': 'back', 'l-env': 'back', 'l-arch': 'back', 'l-first-api': 'back', 'l-crud': 'back', 'l-api-design': 'back', 'l-auth': 'back',
  'l-realtime': 'back', 'l-api-styles': 'back', 'l-db': 'back', 'l-joins': 'back', 'l-db-adv': 'back', 'l-cache': 'back', 'l-nosql': 'back',
  'l-security': 'back', 'l-web-sec': 'back', 'l-testing': 'back', 'l-ai-api': 'ia', 'l-automation': 'ia', 'l-rag': 'ia',
  'l-messaging': 'back', 'l-devops': 'ferramentas', 'l-linux': 'ferramentas', 'l-observability': 'back', 'l-system-design': 'back',
  'l-portfolio': 'carreira', 'l-interview': 'carreira',
};

/** Aulas de aprofundamento: ótimas, mas não obrigatórias nas 72 h. */
const OPTIONAL = new Set(['l-runtime', 'l-realtime', 'l-api-styles', 'l-messaging', 'l-rag', 'l-observability', 'l-system-design', 'l-cache', 'l-linux', 'l-algo']);

const all: Lesson[] = [
  ...(oldLessons as unknown as Lesson[]).map((l) => ({ ...l, area: OLD_AREA[l.id] ?? 'back', optional: OPTIONAL.has(l.id) })),
  ...fundamentosNovos, ...frontend, ...python, ...backendNovos, ...exploracao, ...carreira,
];

export const LESSONS: Record<string, Lesson> = Object.fromEntries(all.map((l) => [l.id, l]));
export const ALL_LESSONS = all;

/** Ordem recomendada da trilha (a mesma do cronograma de 12 semanas). */
export const TRACK_ORDER: string[] = [
  // Mês 1
  'l-welcome', 'l-prog', 'l-areas', 'l-files',
  'l-terminal', 'l-tools', 'l-vars',
  'l-ops', 'l-cond', 'l-loops',
  'l-func', 'l-logic', 'l-english',
  'l-data', 'l-errors', 'l-oop',
  'l-html', 'l-css', 'l-css-layout',
  'l-dom', 'l-git',
  'l-langs', 'l-python-1', 'l-python-2',
  // Mês 2
  'l-json', 'l-fetch-front', 'l-ts',
  'l-node', 'l-async', 'l-runtime',
  'l-http', 'l-network', 'l-env',
  'l-first-api', 'l-crud',
  'l-db', 'l-sql-lab', 'l-postgres',
  'l-joins', 'l-nosql',
  'l-mobile', 'l-mobile-dev', 'l-desktop',
  'l-python-auto', 'l-data-science', 'l-games', 'l-other-areas',
  // Mês 3
  'l-arch', 'l-api-design',
  'l-auth',
  'l-security', 'l-web-sec', 'l-db-adv',
  'l-testing', 'l-fullstack', 'l-cache',
  'l-devops', 'l-cloud', 'l-linux',
  'l-ai-intro', 'l-ai-api', 'l-automation', 'l-rag',
  'l-realtime', 'l-api-styles', 'l-observability',
  'l-portfolio', 'l-career', 'l-interview',
  // Aprofundamento pós-curso
  'l-algo', 'l-messaging', 'l-system-design',
];

export const PROJECTS: Project[] = [
  ...projetosNovos.filter((p) => p.level === 1),
  ...(oldProjects as Project[]).map((p) => ({ ...p, area: (p.level >= 4 && p.id !== 'p-saas' ? 'ia' : 'back') as AreaId })),
  ...projetosNovos.filter((p) => p.level > 1),
].sort((a, b) => a.level - b.level);

export interface LibItem { id: string; title: string; level: string; summary: string; full: string; docs: { label: string; url: string }[] }
export const LIBRARY = oldLibs as LibItem[];

/** Nome legível de cada competência (habilidade). */
export const COMPETENCIES: Record<string, { name: string; area: AreaId }> = {
  'study-method': { name: 'Método de estudo', area: 'fund' },
  'tech-map': { name: 'Mapa das áreas', area: 'fund' },
  'prog-basics': { name: 'O que é programação', area: 'fund' },
  'files-paths': { name: 'Arquivos e caminhos', area: 'ferramentas' },
  terminal: { name: 'Terminal', area: 'ferramentas' },
  'dev-tools': { name: 'Ferramentas do dev', area: 'ferramentas' },
  variables: { name: 'Variáveis e tipos', area: 'fund' },
  operators: { name: 'Operadores', area: 'fund' },
  conditionals: { name: 'Condicionais', area: 'fund' },
  loops: { name: 'Laços de repetição', area: 'fund' },
  functions: { name: 'Funções', area: 'fund' },
  'problem-solving': { name: 'Resolução de problemas', area: 'fund' },
  'data-structures': { name: 'Arrays e objetos', area: 'fund' },
  'errors-debug': { name: 'Erros e depuração', area: 'fund' },
  oop: { name: 'Orientação a objetos', area: 'fund' },
  'tech-english': { name: 'Inglês técnico', area: 'carreira' },
  languages: { name: 'Panorama de linguagens', area: 'fund' },
  python: { name: 'Python', area: 'fund' },
  algorithms: { name: 'Algoritmos e Big O', area: 'fund' },
  html: { name: 'HTML', area: 'front' },
  css: { name: 'CSS', area: 'front' },
  'css-layout': { name: 'Layout responsivo', area: 'front' },
  dom: { name: 'DOM e eventos', area: 'front' },
  'frontend-api': { name: 'Front consumindo APIs', area: 'front' },
  'git-basics': { name: 'Git e GitHub', area: 'ferramentas' },
  'node-npm': { name: 'Node.js e npm', area: 'back' },
  async: { name: 'Assincronismo', area: 'back' },
  'node-runtime': { name: 'Event loop e streams', area: 'back' },
  typescript: { name: 'TypeScript', area: 'back' },
  'client-server': { name: 'Cliente-servidor', area: 'back' },
  http: { name: 'HTTP', area: 'back' },
  networking: { name: 'Redes', area: 'back' },
  json: { name: 'JSON', area: 'back' },
  'env-config': { name: 'Configuração e logs', area: 'back' },
  architecture: { name: 'Arquitetura', area: 'back' },
  'first-api': { name: 'Primeira API', area: 'back' },
  'rest-crud': { name: 'REST e CRUD', area: 'back' },
  'api-design': { name: 'Design de APIs', area: 'back' },
  auth: { name: 'Autenticação e autorização', area: 'back' },
  realtime: { name: 'Tempo real', area: 'back' },
  'api-styles': { name: 'GraphQL e gRPC', area: 'back' },
  'db-basics': { name: 'Bancos de dados e SQL', area: 'back' },
  'sql-practice': { name: 'SQL na prática', area: 'back' },
  postgres: { name: 'PostgreSQL com Node', area: 'back' },
  'relations-joins': { name: 'Relacionamentos e JOIN', area: 'back' },
  'db-advanced': { name: 'Índices e transações', area: 'back' },
  cache: { name: 'Cache e Redis', area: 'back' },
  nosql: { name: 'NoSQL / MongoDB', area: 'back' },
  'input-security': { name: 'Segurança de entrada e senhas', area: 'back' },
  'web-security': { name: 'OWASP na prática', area: 'back' },
  testing: { name: 'Testes automatizados', area: 'back' },
  integration: { name: 'Integração front + back', area: 'back' },
  observability: { name: 'Observabilidade', area: 'back' },
  'system-design': { name: 'System design', area: 'back' },
  messaging: { name: 'Mensageria', area: 'back' },
  mobile: { name: 'Mobile', area: 'mobile' },
  desktop: { name: 'Desktop', area: 'desktop' },
  'ai-basics': { name: 'Fundamentos de IA', area: 'ia' },
  'ai-apis': { name: 'APIs de IA', area: 'ia' },
  automation: { name: 'Automação no backend', area: 'ia' },
  'automation-py': { name: 'Automação com Python', area: 'ia' },
  rag: { name: 'RAG e embeddings', area: 'ia' },
  data: { name: 'Análise de dados', area: 'dados' },
  games: { name: 'Lógica de jogos', area: 'jogos' },
  cloud: { name: 'Nuvem e deploy', area: 'outras' },
  devops: { name: 'Docker e CI/CD', area: 'ferramentas' },
  'linux-server': { name: 'Linux', area: 'ferramentas' },
  'other-areas': { name: 'Outras especialidades', area: 'outras' },
  portfolio: { name: 'Portfólio', area: 'carreira' },
  interviews: { name: 'Entrevistas', area: 'carreira' },
  career: { name: 'Mercado de trabalho', area: 'carreira' },
};

export function lessonArea(id: string): AreaId { return LESSONS[id]?.area ?? 'back'; }
