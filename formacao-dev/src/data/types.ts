// Tipos do conteúdo educacional. Todo o conteúdo do app segue estes formatos.

export type Lang = 'js' | 'ts' | 'py' | 'sql' | 'html' | 'css' | 'bash' | 'kotlin' | 'dart' | 'gdscript' | 'csharp' | 'json' | 'text';

export interface Explain8 {
  what?: string; why?: string; parts?: string; run?: string;
  expected?: string; errors?: string; test?: string; modify?: string;
}

export interface Step {
  kind: 'text' | 'analogy' | 'tip' | 'warning' | 'code' | 'table' | 'diagram-http' | 'html' | 'python' | 'sql';
  title: string;
  body?: string;
  code?: string;
  lang?: Lang;
  runnable?: boolean;
  explain8?: Explain8;
  table?: { headers: string[]; rows: string[][] };
  /** Para passos SQL: script que cria as tabelas antes da consulta. */
  setup?: string;
}

interface ExBase {
  id: string;
  competency: string;
  prompt: string;
  hints?: string[];
  solution: string;
  explanation: string;
  errorKind?: 'conhecimento' | 'logica' | 'sintaxe' | 'interpretacao' | 'atencao';
  wrongFeedback?: Record<string, string>;
  similar?: string;
}

export interface McqEx extends ExBase { type: 'mcq'; options: string[]; answer: number; code?: string; lang?: Lang }
export interface PredictEx extends ExBase { type: 'predict'; code: string; expected: string; lang?: Lang; run?: boolean }
export interface CodeEx extends ExBase { type: 'code'; starter: string; tests: { call: string; expect: unknown; desc: string }[] }
export interface ExplainEx extends ExBase { type: 'explain'; keywords: string[][]; minGroups: number }
/** Exercício de Python. tests: expressões Python cujo str() deve ser igual a expect; stdout: saída exata esperada. */
export interface PyEx extends ExBase { type: 'py'; starter: string; tests?: { call: string; expect: string; desc: string }[]; stdout?: string }
/** Exercício de SQL: a consulta do aluno deve devolver exatamente estas linhas. */
export interface SqlEx extends ExBase { type: 'sql'; setup?: string; starter?: string; expected: (string | number | null)[][]; ordered?: boolean }
/** Exercício de HTML/CSS: verificações feitas na página que o aluno montou. */
export interface HtmlEx extends ExBase {
  type: 'html'; starter: string;
  checks: { selector: string; desc: string; count?: number; text?: string; attr?: [string, string]; style?: [string, string] }[];
}

export type Exercise = McqEx | PredictEx | CodeEx | ExplainEx | PyEx | SqlEx | HtmlEx;

export type AreaId = 'fund' | 'ferramentas' | 'front' | 'back' | 'mobile' | 'desktop' | 'ia' | 'dados' | 'jogos' | 'outras' | 'carreira';

export interface Lesson {
  id: string;
  area?: AreaId;
  phase?: number;
  title: string;
  goal: string;
  minutes: number;
  competencies: string[];
  prereqs: string[];
  steps: Step[];
  simpler?: string;
  otherWay?: string;
  realExample?: string;
  exercises: Exercise[];
  transfer?: Exercise;
  docs?: { label: string; url: string }[];
  lab?: string;
  /** Aula de aprofundamento: não é obrigatória para concluir a formação. */
  optional?: boolean;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  kind: 'playlist' | 'video' | 'curso' | 'site' | 'doc' | 'exercicios' | 'simulador' | 'projeto' | 'vagas';
  lang: 'pt' | 'en' | 'es';
  level: 'iniciante' | 'intermediário' | 'avançado';
  area: AreaId;
  author?: string;
  desc: string;
  /** O que exatamente fazer com o material. */
  guide: string;
  lessons: string[];
  minutes?: number;
}

export interface Project {
  id: string;
  level: number;
  area?: AreaId;
  title: string;
  summary: string;
  competencies: string[];
  requirements: string[];
  steps: string[];
  acceptance: string[];
  structure?: string;
  tech: string[];
  tests?: string[];
  improvements?: string[];
  portfolioPitch?: string;
  final?: boolean;
}
