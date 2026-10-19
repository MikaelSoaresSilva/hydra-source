// SISTEMA — Mestre de Jogo offline. Só usa dados registrados; separa FATOS de RECOMENDAÇÕES.
import type { AttrKey, GameState, Mission, Settings } from './types';
import { ATTR_KEYS } from './types';
import { attrLevel, computeRank, levelFromXp, missionXp, rankChecks, rankContext, totals, TYPE_LABEL, DIFFICULTY_XP, TYPE_MULT } from './progression';
import { achCtx, bossProgress, effectiveStreak, isDoneThisPeriod } from './engine';
import { ACHIEVEMENTS } from '../data/achievements';
import { ATTRS } from '../data/attributes';
import { dayKey, diffDays } from './util';
import { pickTemplate, type CampaignTemplate, type MissionSeed } from '../data/campaigns';
import { MISSION_TYPES } from './types';

type Style = Settings['gmStyle'];

export function priorityMission(s: GameState, now = new Date()): Mission | undefined {
  const today = dayKey(now);
  const order = { principal: 0, dominio: 1, epica: 2, lendaria: 3, secundaria: 4, rapida: 5, surpresa: 6 } as const;
  return s.missions
    .filter((m) => m.status === 'ativa' && !isDoneThisPeriod(m, now))
    .sort((a, b) => {
      const da = a.deadline ?? (a.recurrence !== 'unica' ? today : '9999');
      const db = b.deadline ?? (b.recurrence !== 'unica' ? today : '9999');
      return (da > today ? 1 : 0) - (db > today ? 1 : 0) || order[a.type] - order[b.type] || da.localeCompare(db);
    })[0];
}

export function neglected(s: GameState, now = new Date(), days = 10): AttrKey[] {
  const today = dayKey(now);
  const recent = totals(s.ledger.filter((e) => diffDays(e.day, today) <= days)).attrs;
  const relevant = new Set<AttrKey>(s.missions.filter((m) => m.status === 'ativa').flatMap((m) => Object.keys(m.attrs) as AttrKey[]));
  return ATTR_KEYS.filter((k) => relevant.has(k) && recent[k] === 0);
}

export function closestAchievement(s: GameState) {
  const ctx = achCtx(s);
  return ACHIEVEMENTS.filter((a) => !a.secret && !s.achievements[a.id] && a.progress)
    .map((a) => { const [c, t] = a.progress!(ctx); return { a, c, t, pct: t ? c / t : 0 }; })
    .filter((x) => x.pct < 1)
    .sort((x, y) => y.pct - x.pct)[0];
}

function frame(style: Style, lines: string[]): string {
  if (style === 'sistema') return lines.map((l) => (l.startsWith('[') ? l : `» ${l}`)).join('\n');
  return lines.join('\n');
}

export function dailyBriefing(s: GameState, style: Style, now = new Date()): string {
  const t = totals(s.ledger);
  const lv = levelFromXp(t.xp);
  const pm = priorityMission(s, now);
  const streak = effectiveStreak(s, now);
  const neg = neglected(s, now);
  const close = closestAchievement(s);
  const name = s.character.name || 'Desperto';
  const xpLeft = lv.need - lv.into;

  if (style === 'sistema') {
    return frame(style, [
      '[ SISTEMA ]',
      `Jogador: ${name}. Nível ${lv.level}. Faltam ${xpLeft} XP para o próximo nível.`,
      streak ? `Sequência ativa: ${streak} dia(s).` : 'Sequência: inativa. Uma missão a reacende.',
      pm ? `Missão prioritária: ${pm.title}.` : 'Nenhuma missão pendente. Crie um objetivo.',
      close ? `Conquista próxima: ${close.a.name} (${close.c}/${close.t}).` : '',
      neg.length ? `Atributo(s) sem evolução recente: ${neg.map((k) => ATTRS[k].name).join(', ')}.` : '',
    ].filter(Boolean));
  }
  if (style === 'mentor') {
    return [
      `Bom te ver, ${name}. Vamos olhar com calma o seu dia.`,
      pm ? `O mais importante agora é "${pm.title}". Se parecer grande, comece pela primeira etapa — só ela.` : 'Você não tem missões pendentes. Que tal transformar um objetivo em campanha? Escreva "criar campanha: <objetivo>".',
      streak >= 3 ? `Você está há ${streak} dias em sequência. Isso é consistência de verdade.` : 'Não se preocupe com sequência agora: um passo hoje já é progresso.',
      neg.length ? `Percebi que ${neg.map((k) => ATTRS[k].name).join(' e ')} não recebeu atenção nos últimos dias. Uma missão rápida nessa área equilibraria sua evolução.` : '',
    ].filter(Boolean).join('\n\n');
  }
  if (style === 'narrador') {
    return [
      `O Santuário desperta com a sua presença, ${name}. As runas do painel brilham no nível ${lv.level}.`,
      pm ? `Uma Fenda pulsa no horizonte: "${pm.title}". Ela não vai se fechar sozinha.` : 'Por ora, as Fendas estão silenciosas. Mas o Véu sempre espera por um novo juramento.',
      streak ? `O fogo da consistência queima há ${streak} dia(s).` : 'As brasas estão frias. Basta uma faísca.',
    ].join('\n\n');
  }
  // estrategista
  const due = s.missions.filter((m) => m.status === 'ativa' && !isDoneThisPeriod(m, now) && (!m.deadline || m.deadline <= dayKey(now)));
  return [
    'ANÁLISE TÁTICA',
    `Fatos: ${due.length} missão(ões) para hoje · nível ${lv.level} (${lv.into}/${lv.need} XP) · sequência ${streak}.`,
    pm ? `Recomendação 1: executar "${pm.title}" primeiro (prioridade ${TYPE_LABEL[pm.type]}).` : 'Recomendação 1: criar uma campanha para seu objetivo principal.',
    due.length > s.settings.dailyCapacity ? `Recomendação 2: você tem mais missões que sua capacidade (${s.settings.dailyCapacity}). Adie as secundárias — eu reorganizo sem penalidade.` : 'Recomendação 2: carga do dia dentro da capacidade.',
    neg.length ? `Recomendação 3: inserir uma ação de ${ATTRS[neg[0]].name} para evitar desequilíbrio.` : '',
    '(Recomendações são sugestões; os fatos vêm do que você registrou.)',
  ].filter(Boolean).join('\n');
}

export function xpExplanation(s: GameState, now = new Date()): string {
  const streak = effectiveStreak(s, now);
  const rows = MISSION_TYPES.map((t) => `• ${TYPE_LABEL[t]}: ×${TYPE_MULT[t]}`).join('\n');
  const ex = missionXp('principal', 3, streak);
  return [
    'COMO O XP É CALCULADO',
    `Base por dificuldade: ${Object.entries(DIFFICULTY_XP).map(([d, x]) => `D${d}=${x}`).join(' · ')}`,
    `Multiplicador por tipo:\n${rows}`,
    `Bônus de consistência: +2% por dia de sequência (máx. +20%). Sua sequência hoje: ${streak} → +${Math.min(streak, 10) * 2}%.`,
    'Missões com etapas: cada etapa concede uma parte do XP (40% no total) e a conclusão final concede 60%.',
    `Exemplo: Principal D3 hoje = ${ex.base} + ${ex.bonus} de bônus = ${ex.total} XP.`,
    'O XP de atributo vai apenas para os atributos da missão (até 3), proporcional aos pesos.',
    'Cada conclusão tem um identificador único: a mesma missão no mesmo período nunca dá XP duas vezes.',
  ].join('\n\n');
}

export function progressReport(s: GameState, now = new Date(), days = 7): string {
  const today = dayKey(now);
  const recent = s.ledger.filter((e) => diffDays(e.day, today) < days);
  const prev = s.ledger.filter((e) => { const d = diffDays(e.day, today); return d >= days && d < days * 2; });
  const xp = recent.reduce((t, e) => t + e.xp, 0);
  const xpPrev = prev.reduce((t, e) => t + e.xp, 0);
  const at = totals(recent).attrs;
  const top = ATTR_KEYS.filter((k) => at[k] > 0).sort((a, b) => at[b] - at[a]).slice(0, 3);
  const active = new Set(recent.map((e) => e.day)).size;
  const missions = recent.filter((e) => e.source === 'missao').length;
  const study = s.study.filter((x) => diffDays(x.date, today) < days).reduce((t, x) => t + x.minutes, 0);
  const workouts = s.workouts.filter((w) => diffDays(w.date, today) < days).length;
  const rc = rankContext(s);
  const { rank, next } = computeRank(s.settings.rankRules, rc);
  const nextTxt = next ? rankChecks(next, rc).filter((c) => !c.ok).map((c) => `${c.label} (${c.cur}/${c.req})`).join('; ') : 'rank máximo';
  const trend = xpPrev ? Math.round(((xp - xpPrev) / xpPrev) * 100) : null;
  return [
    `RELATÓRIO DOS ÚLTIMOS ${days} DIAS`,
    `XP: ${xp}${trend !== null ? ` (${trend >= 0 ? '+' : ''}${trend}% vs. período anterior)` : ''}`,
    `Dias ativos: ${active}/${days} · Missões: ${missions} · Treinos: ${workouts} · Estudo: ${Math.round(study / 6) / 10} h`,
    top.length ? `Atributos que mais evoluíram: ${top.map((k) => `${ATTRS[k].name} (+${at[k]})`).join(', ')}` : 'Nenhum atributo evoluiu neste período.',
    `Rank atual: ${rank}. Para o próximo: ${nextTxt}.`,
    ...s.bosses.filter((b) => !b.defeatedAt).slice(0, 3).map((b) => { const p = bossProgress(b, s.missions); return `Chefe ${b.name}: ${Math.round((1 - p.hp) * 100)}% derrotado.`; }),
  ].join('\n');
}

export function comebackAdvice(s: GameState, now = new Date()): string {
  const last = s.streak.lastActiveDay;
  const gap = last ? diffDays(last, dayKey(now)) : 0;
  return [
    gap >= 2 ? `Você ficou ${gap} dia(s) sem registrar atividade. Isso acontece com todo mundo — e nada do que conquistou foi perdido.` : 'Você está em dia. Se a rotina estiver pesada, vamos deixá-la mais leve.',
    'Plano de retorno em 3 passos:',
    '1. Hoje: escolha UMA missão rápida (5–10 min) e conclua.',
    '2. Amanhã: uma missão principal pequena, ou a primeira etapa de uma.',
    '3. Depois: volte ao ritmo normal. Eu reorganizo as missões atrasadas automaticamente, sem penalidade.',
    `Capacidade diária atual: ${s.settings.dailyCapacity} missões. Você pode reduzir em Configurações se precisar.`,
  ].join('\n');
}

/** Interpretação simples de pedidos em português (funciona sem internet). */
export function offlineReply(s: GameState, text: string, style: Style, now = new Date()): { reply: string; createCampaign?: string } {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const m = text.match(/(?:criar|nova|gerar)\s+campanha\s*[:\-]?\s*(.+)/i) || text.match(/^quero\s+(.+)/i);
  if (m && m[1].trim().length >= 3) {
    const goal = m[1].trim();
    const tpl = pickTemplate(goal);
    return { reply: `Objetivo recebido: "${goal}".\nCampanha proposta: ${tpl.title} — ${tpl.summary}\nChefe: ${tpl.boss.name}. Fases: ${tpl.phases.map((p) => p.name).join(' · ')}.\nConfirme abaixo para publicar.`, createCampaign: goal };
  }
  if (/(xp|experiencia|calcul|recompens)/.test(t)) return { reply: xpExplanation(s, now) };
  if (/(relatorio|resumo|progresso|evolu)/.test(t)) return { reply: progressReport(s, now) };
  if (/(retom|voltar|parei|desanim|dificil|cansad|atras)/.test(t)) return { reply: comebackAdvice(s, now) };
  if (/(rank|promo)/.test(t)) {
    const rc = rankContext(s);
    const { rank, next } = computeRank(s.settings.rankRules, rc);
    return { reply: next ? `Rank atual: ${rank}. Requisitos para ${next.rank}:\n${rankChecks(next, rc).map((c) => `${c.ok ? '✔' : '✖'} ${c.label} (${c.cur}/${c.req})`).join('\n')}` : `Rank ${rank}: o mais alto.` };
  }
  if (/(atribut|equilibr|neglig)/.test(t)) {
    const at = totals(s.ledger).attrs;
    const neg = neglected(s, now);
    return { reply: `Níveis de atributo:\n${ATTR_KEYS.map((k) => `${ATTRS[k].name}: ${attrLevel(at[k]).level}`).join('\n')}${neg.length ? `\n\nSem evolução recente: ${neg.map((k) => ATTRS[k].name).join(', ')}.` : ''}` };
  }
  if (/(proxim|missao|fazer|hoje|prioridad)/.test(t)) return { reply: dailyBriefing(s, style, now) };
  return {
    reply: style === 'sistema'
      ? '[ SISTEMA ]\nComandos reconhecidos: "próxima missão", "relatório", "como o XP é calculado", "como retomar", "rank", "atributos", "criar campanha: <objetivo>".'
      : 'Posso ajudar com: sua próxima missão, um relatório da semana, como o XP é calculado, como retomar a rotina, seu rank, seus atributos ou criar uma campanha (escreva "criar campanha: <seu objetivo>").',
  };
}

// ───────────── Validação de campanhas geradas por IA ─────────────
const ATTR_SET = new Set<string>(ATTR_KEYS);
const THEMES = new Set(['codigo', 'forca', 'caos', 'ouro', 'sombra', 'espelho', 'tempo']);
const str = (v: unknown, max: number, fb = '') => (typeof v === 'string' ? v.trim().slice(0, max) : fb);

function seedFrom(raw: unknown): MissionSeed | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 90);
  if (title.length < 2) return null;
  const type = (MISSION_TYPES as readonly string[]).includes(r.type as string) ? (r.type as MissionSeed['type']) : 'principal';
  const difficulty = Math.min(5, Math.max(1, Math.round(Number(r.difficulty) || 2))) as MissionSeed['difficulty'];
  const recurrence = ['unica', 'diaria', 'semanal', 'mensal'].includes(r.recurrence as string) ? (r.recurrence as MissionSeed['recurrence']) : 'unica';
  const attrs: MissionSeed['attrs'] = {};
  if (r.attrs && typeof r.attrs === 'object') {
    for (const [k, v] of Object.entries(r.attrs as Record<string, unknown>)) if (ATTR_SET.has(k) && Number(v) > 0) attrs[k as AttrKey] = Math.min(3, Math.round(Number(v)));
  }
  const keys = Object.keys(attrs);
  if (!keys.length) attrs.disciplina = 1;
  if (keys.length > 3) for (const k of keys.slice(3)) delete attrs[k as AttrKey];
  const steps = Array.isArray(r.steps) ? r.steps.map((x) => str(x, 60)).filter((x) => x.length > 1).slice(0, 8) : undefined;
  const days = Math.min(180, Math.max(1, Math.round(Number(r.days) || 7)));
  // Tipos lendários exigem missões grandes: rebaixa se a IA exagerar em prazos curtos.
  const safeType = (type === 'lendaria' && days < 30) || (type === 'epica' && days < 7) ? 'principal' : type;
  return { title, description: str(r.description, 240), type: safeType, difficulty, recurrence, attrs, steps, days };
}

/**
 * Valida o JSON de campanha vindo da IA. O XP NÃO vem da IA: é sempre calculado pelo motor
 * a partir de tipo/dificuldade, então a IA não consegue inflar recompensas.
 */
export function validateAiCampaign(raw: unknown, goal: string): { ok: true; tpl: CampaignTemplate } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Resposta da IA não é um objeto.' };
  const r = raw as Record<string, unknown>;
  const boss = (r.boss ?? {}) as Record<string, unknown>;
  const phasesRaw = Array.isArray(r.phases) ? r.phases.slice(0, 5) : [];
  const phases = phasesRaw.map((p, i) => {
    const pr = (p ?? {}) as Record<string, unknown>;
    const missions = (Array.isArray(pr.missions) ? pr.missions : []).slice(0, 5).map(seedFrom).filter((x): x is MissionSeed => !!x);
    return { name: str(pr.name, 60, `Fase ${i + 1}`), missions };
  }).filter((p) => p.missions.length > 0);
  if (phases.length < 1) return { ok: false, error: 'A campanha precisa de pelo menos uma fase com missões válidas.' };
  const dailies = (Array.isArray(r.dailies) ? r.dailies : []).slice(0, 3).map(seedFrom).filter((x): x is MissionSeed => !!x).map((d) => ({ ...d, recurrence: 'diaria' as const, type: d.type === 'lendaria' || d.type === 'epica' ? 'rapida' as const : d.type }));
  return {
    ok: true,
    tpl: {
      id: 'ia', match: /.*/,
      title: str(r.title, 60, pickTemplate(goal).title),
      summary: str(r.summary, 240, `Campanha personalizada para: ${goal}`),
      boss: { name: str(boss.name, 40, 'Sentinela do Limiar'), epithet: str(boss.epithet, 60, 'Guardião do Objetivo'), theme: THEMES.has(boss.theme as string) ? (boss.theme as CampaignTemplate['boss']['theme']) : 'tempo', lore: str(boss.lore, 300, 'Uma presença que só cede a etapas reais concluídas.') },
      dailies,
      phases,
    },
  };
}

export function aiContext(s: GameState, now = new Date()): string {
  const t = totals(s.ledger);
  const lv = levelFromXp(t.xp);
  const rc = rankContext(s);
  const { rank } = computeRank(s.settings.rankRules, rc);
  const active = s.missions.filter((m) => m.status === 'ativa' && !isDoneThisPeriod(m, now)).slice(0, 15).map((m) => `- ${m.title} [${m.type}, D${m.difficulty}${m.deadline ? `, prazo ${m.deadline}` : ''}]`);
  return [
    `Nome: ${s.character.name}. Nível ${lv.level}, rank ${rank}, sequência ${effectiveStreak(s, now)} dias (melhor ${s.streak.best}).`,
    `Objetivos registrados: ${s.goals.join('; ') || 'nenhum'}.`,
    `Atributos (nível): ${ATTR_KEYS.map((k) => `${ATTRS[k].name}=${attrLevel(t.attrs[k]).level}`).join(', ')}.`,
    `Energia informada: ${s.settings.energy ?? 'não informada'}. Minutos disponíveis hoje: ${s.settings.availableMinutes ?? 'não informado'}.`,
    `Missões pendentes:\n${active.join('\n') || 'nenhuma'}`,
    progressReport(s, now),
  ].join('\n');
}
