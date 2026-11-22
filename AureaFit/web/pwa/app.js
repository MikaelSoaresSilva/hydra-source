// Áurea — versão web instalável (PWA) para iPhone e qualquer navegador.
// As regras (treino, dieta, segurança, ajustes) vêm do mesmo código Kotlin do app Android.
import { api, EX, EXERCISES, FOOD, FOOD_CHOICES, RECIPES, OPTIONS, label, itemMacros, mealMacros, dayMacros, WEEKDAY, WD, minutesOf, buildSchedule } from './core.js';
import { loadState, getState, save as rawSave, saveNow, replaceState, uid, today, epochLabel, weekdayOf, dateOfEpoch, newSalt, hashPassword, photoGet, photoSet, photoDel, clearAll } from './store.js';
import { mountAnimations } from './anim.js';
import { lineChart, barChart, bindCharts } from './charts.js';

let S; // estado
const ONLINE_HOST = !['localhost', '127.0.0.1'].includes(location.hostname);
if (location.hostname.endsWith('netlify.app')) document.documentElement.classList.add('nl-host');
function save() { rawSave(); maybeSyncPush(); }
const app = document.getElementById('app');
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r0 = (v) => Math.round(v);
const dec = (v, n = 1) => (v == null || isNaN(v) ? '—' : (Math.round(v * 10 ** n) / 10 ** n).toFixed(n).replace('.', ','));
const fmt1 = (v) => (v == null ? '—' : (v % 1 === 0 ? String(v) : dec(v, 1)));
const brl = (v) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// App nativo de iPhone (Capacitor): plugins nativos disponíveis em window.Capacitor.Plugins
const NATIVE = !!window.Capacitor?.isNativePlatform?.();
const CAP = window.Capacitor?.Plugins || {};
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/* ======================================================================== ações e navegação */
let actions = {};
let actSeq = 0;
function act(fn) { const k = 'a' + (++actSeq); actions[k] = fn; return `data-act="${k}"`; }
function go(route) { if (location.hash !== '#/' + route) location.hash = '#/' + route; else render(); }
function back() { if (history.length > 1) history.back(); else go('home'); }
let toastTimer;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ''), 3200);
}
function confirmBox(title, text, okLabel = 'Confirmar', danger = false) {
  return new Promise((resolve) => {
    const d = document.createElement('div');
    d.className = 'modal-bg';
    d.innerHTML = `<div class="modal"><h3>${h(title)}</h3><p>${h(text)}</p><div class="row end"><button class="btn text" data-r="0">Cancelar</button><button class="btn ${danger ? 'danger' : ''}" data-r="1">${h(okLabel)}</button></div></div>`;
    d.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b || e.target === d) { d.remove(); resolve(b?.dataset.r === '1'); } });
    document.body.appendChild(d);
  });
}
function sheet(title, html, after) {
  const d = document.createElement('div');
  d.className = 'modal-bg';
  d.innerHTML = `<div class="modal sheet"><div class="row"><h3 class="grow">${h(title)}</h3><button class="icon" data-close aria-label="Fechar">✕</button></div><div class="sheet-body">${html}</div></div>`;
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.remove(); });
  document.body.appendChild(d);
  after?.(d, () => d.remove());
  return d;
}

/* ======================================================================== planos */
function activePlan(kind) { const e = [...S.plans].reverse().find((p) => p.kind === kind && p.active); return e ? JSON.parse(e.json) : null; }
function savePlan(kind, obj, reason) {
  S.plans.forEach((p) => { if (p.kind === kind) p.active = false; });
  S.plans.push({ id: uid(), kind, json: JSON.stringify(obj), reason, createdAt: Date.now(), active: true });
  if (S.plans.length > 60) S.plans.splice(0, S.plans.length - 60);
}
function saveProfile(p, reason, regenerate = true) {
  S.profile = p;
  if (regenerate) {
    const w = activePlan('WORKOUT'), d = activePlan('DIET');
    const workout = api.workout(p, w?.setsDelta || 0);
    savePlan('WORKOUT', workout, reason);
    savePlan('DIET', api.diet(p, d?.calorieOffset || 0), reason);
    S.schedule = buildSchedule(p, workout);
  }
  save();
}
const waterGoal = () => S.settings.waterGoalOverride || activePlan('DIET')?.targets?.waterMl || 2000;

/* ======================================================================== componentes */
const top = (title, opts = {}) => `<header class="top">${opts.back !== false && opts.back !== undefined ? `<button class="icon" ${act(back)} aria-label="Voltar">‹</button>` : ''}<h1 class="grow">${h(title)}</h1>${opts.actions || ''}</header>`;
const card = (inner, cls = '', extra = '') => `<section class="card ${cls}" ${extra}>${inner}</section>`;
const pill = (t, cls = '') => `<span class="pill ${cls}">${h(t)}</span>`;
const macroPills = (m, hide = S.settings.hideCalories) => `<div class="pills">${hide ? '' : pill(r0(m.kcal) + ' kcal', 'p1')}${pill('P ' + r0(m.protein) + 'g', 'p2')}${pill('C ' + r0(m.carbs) + 'g', 'p3')}${pill('G ' + r0(m.fat) + 'g', 'p4')}</div>`;
const banner = (t, warn = false) => `<div class="banner ${warn ? 'warn' : ''}">${warn ? '⚠️' : 'ℹ️'} <span>${h(t)}</span></div>`;
const meter = (labelTxt, v, target, unit, cls = '') => `<div class="meter ${cls}"><div class="row"><b class="grow">${h(labelTxt)}</b><small>${r0(v)} / ${r0(target)} ${unit}</small></div><div class="bar"><i style="width:${Math.min(100, target ? v / target * 100 : 0)}%"></i></div></div>`;
const ring = (p, inner, cls = '', size = 92) => { const c = 2 * Math.PI * 42; return `<div class="ring ${cls}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" class="trk"/><circle cx="50" cy="50" r="42" class="val" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, Math.max(0, p)))}"/></svg><div class="ring-in">${inner}</div></div>`; };
const animCanvas = (anim, live = false, cls = '') => `<canvas class="anim ${cls}" data-anim="${anim}" ${live ? 'data-live="1"' : ''} aria-label="Animação demonstrativa do exercício"></canvas>`;

function chips(options, selected, onToggle, multi) {
  return `<div class="chips">${options.map((o) => {
    const on = multi ? selected.includes(o.id) : selected === o.id;
    return `<button class="chip ${on ? 'on' : ''}" ${act(() => onToggle(o.id))}>${on ? '✓ ' : ''}${h(o.label)}</button>`;
  }).join('')}</div>`;
}
function optionCards(options, selected, onPick) {
  return options.map((o) => `<button class="opt ${selected === o.id ? 'on' : ''}" ${act(() => onPick(o.id))}><span class="grow"><b>${h(o.label)}</b>${o.description ? `<small>${h(o.description)}</small>` : ''}</span><i class="radio"></i></button>`).join('');
}
function stepper(labelTxt, value, min, max, onChange, step = 1, fmt = (v) => v) {
  return `<div class="stepper"><span class="grow">${h(labelTxt)}</span><button class="icon tonal" ${act(() => onChange(Math.max(min, value - step)))} ${value - step < min ? 'disabled' : ''}>−</button><b>${fmt(value)}</b><button class="icon tonal" ${act(() => onChange(Math.min(max, value + step)))} ${value + step > max ? 'disabled' : ''}>+</button></div>`;
}
const field = (lbl, attrs) => `<label class="field"><span>${h(lbl)}</span><input ${attrs}></label>`;

/* ======================================================================== telas */
const routes = {};

/* ---- 1. abertura */
routes.splash = () => {
  setTimeout(() => {
    if (!S.account) go('auth/register');
    else if (!S.loggedIn) go('auth/login');
    else if (!S.profile) go('onboarding');
    else go('home');
  }, 1300);
  return `<div class="splash"><div class="logo-anim">${logoSvg(150)}</div><h1>Áurea</h1><p>Treino • Nutrição • Evolução</p></div>`;
};

function logoSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 108 108" aria-hidden="true"><path class="logo-a" d="M34,76 C38,52 46,32 54,32 C62,32 70,52 74,76" fill="none" stroke="#E9C49A" stroke-width="6" stroke-linecap="round"/><path class="logo-b" d="M42,62 L66,62" stroke="#F3A6C0" stroke-width="5" stroke-linecap="round"/><circle class="logo-c" cx="54" cy="22" r="4" fill="#E9C49A"/></svg>`;
}

function installHint() {
  if (NATIVE) return '';
  if (!isIOS || standalone()) return '';
  return card(`<b>📲 Instale no seu iPhone</b><p>No <b>Safari</b>, toque em <b>Compartilhar</b> (quadrado com seta ↑) e depois em <b>“Adicionar à Tela de Início”</b>. O Áurea vira um ícone e funciona como app, inclusive sem internet.</p>`, 'tint');
}

/* ---- 2. cadastro e login */
routes.auth = (mode) => {
  const reg = mode !== 'login';
  const submit = async () => {
    const f = Object.fromEntries(new FormData(document.getElementById('authForm')));
    const err = document.getElementById('authErr');
    const email = (f.email || '').trim().toLowerCase();
    try {
      if (reg) {
        if (!f.name?.trim()) throw 'Informe seu nome.';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw 'E-mail inválido.';
        if ((f.password || '').length < 6) throw 'A senha precisa ter pelo menos 6 caracteres.';
        if (S.account) throw 'Já existe uma conta neste aparelho. Faça login.';
        const salt = newSalt();
        S.account = { name: f.name.trim(), email, salt, hash: await hashPassword(f.password, salt), createdAt: Date.now() };
      } else {
        if (!S.account) throw 'Nenhuma conta encontrada. Crie sua conta.';
        if (S.account.email !== email || (await hashPassword(f.password || '', S.account.salt)) !== S.account.hash) throw 'E-mail ou senha incorretos.';
      }
      S.loggedIn = true; await saveNow();
      try { navigator.storage?.persist?.(); } catch (e) {}
      go(S.profile ? 'home' : 'onboarding');
    } catch (e) { err.textContent = typeof e === 'string' ? e : 'Não foi possível concluir. Tente novamente.'; }
  };
  return `<div class="auth">
    <div class="logo-box">${logoSvg(96)}</div>
    <h1 class="brand">Áurea</h1>
    <p class="muted center">Seu treinador pessoal e guia de alimentação, para construir a melhor versão do seu corpo.</p>
    ${installHint()}
    <h2>${reg ? 'Criar conta' : 'Entrar'}</h2>
    <form id="authForm" onsubmit="return false">
      ${reg ? field('Seu nome', 'name="name" autocomplete="name" required') : ''}
      ${field('E-mail', 'name="email" type="email" autocomplete="email" inputmode="email" required')}
      ${field('Senha (mín. 6 caracteres)', `name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required`)}
      <p id="authErr" class="err"></p>
      <button class="btn big" ${act(submit)}>${reg ? 'Criar minha conta' : 'Entrar'}</button>
    </form>
    <button class="btn text" ${act(() => go(reg ? 'auth/login' : 'auth/register'))}>${reg ? 'Já tenho conta neste aparelho — entrar' : 'Ainda não tenho conta — criar'}</button>
    <p class="small muted center">Seus dados ficam guardados somente neste aparelho. Nada é enviado para servidores.</p>
  </div>`;
};

/* ---- 3. questionário (12 etapas) */
let draft = null, stepIdx = 0, editing = false;
const STEPS = ['Boas-vindas', 'Sobre você', 'Seu objetivo', 'Experiência', 'Objetivo corporal', 'Seus treinos', 'Exercícios e limitações', 'Alimentação', 'Preferências alimentares', 'Rotina e recuperação', 'Saúde e segurança', 'Avaliação física inicial'];

routes.onboarding = (mode) => {
  if (!draft) { editing = mode === 'edit'; draft = editing && S.profile ? JSON.parse(JSON.stringify(S.profile)) : { ...api.defaultProfile(), name: S.account?.name || '' }; stepIdx = editing ? 1 : 0; }
  const p = draft;
  const set = (k, v, rerender = true) => { p[k] = v; if (rerender) render(); };
  const toggle = (k, v) => { const a = new Set(p[k]); a.has(v) ? a.delete(v) : a.add(v); set(k, [...a]); };
  const err = validate(stepIdx, p);
  const steps = editing ? STEPS.slice(1) : STEPS;
  const shown = editing ? stepIdx - 1 : stepIdx;
  const finish = () => {
    saveProfile(p, editing ? 'Perfil atualizado' : 'Plano inicial criado a partir do questionário');
    const ed = editing; draft = null;
    if (ed) back(); else { go('home'); askNotifications(); }
  };
  const next = () => { if (stepIdx < STEPS.length - 1) { stepIdx++; render(); window.scrollTo(0, 0); } else finish(); };
  const prev = () => { if ((editing && stepIdx > 1) || (!editing && stepIdx > 0)) { stepIdx--; render(); } else if (editing) { draft = null; back(); } };
  const bind = (k, type = 'num') => `data-bind="${k}" data-type="${type}" value="${h(p[k] ?? '')}"`;
  let body = '';
  switch (stepIdx) {
    case 0: body = `${card(`<h2>Olá! Eu sou a Áurea.</h2><p>Vou montar seu treino, sua alimentação e sua rotina com base nas suas respostas. Leva cerca de 5 minutos.</p>`, 'hero')}
      ${card(`<h3>A Meta Áurea</h3><p>Nossa referência estética é um físico atlético e equilibrado: glúteos desenvolvidos e arredondados, pernas fortes (quadríceps, posteriores e panturrilhas), cintura marcada, costas definidas e abdômen firme. Por isso o app dá atenção especial a glúteos, pernas, abdômen e costas — sem deixar de treinar o corpo todo.</p>${banner('Cada corpo é único: genética, estrutura óssea e rotina influenciam o resultado. O objetivo é a melhor versão do SEU corpo — não uma cópia de fotos. Abdômen muito definido, por exemplo, exige gordura corporal baixa, que nem sempre é saudável ou sustentável para todas.')}`)}
      ${card(`<h3>Importante</h3><p>O Áurea é uma ferramenta educativa. Ele não substitui médico(a), nutricionista ou educador(a) físico(a). Em caso de dor, doença, gestação ou dúvidas, procure um profissional.</p>`)}`; break;
    case 1: body = `${field('Como podemos te chamar?', `${bind('name', 'text')} maxlength="40"`)}
      ${field('Idade (anos)', `${bind('age', 'int')} inputmode="numeric"`)}
      ${field('Altura (cm)', `${bind('heightCm')} inputmode="decimal"`)}
      ${field('Peso atual (kg)', `${bind('weightKg')} inputmode="decimal"`)}
      <h4>Sexo biológico (usado apenas na fórmula de gasto calórico)</h4>${chips(OPTIONS.sex, p.sex, (v) => set('sex', v))}`; break;
    case 2: body = `<p>Escolha o objetivo principal. Você pode mudar quando quiser.</p>${optionCards(OPTIONS.goal, p.goal, (v) => set('goal', v))}${banner('Ganho de massa muscular ≠ ganho de peso: o primeiro foca em construir músculo com superávit pequeno; o segundo aumenta o peso total (músculo e reservas).')}`; break;
    case 3: body = `${optionCards(OPTIONS.experience, p.experience, (v) => set('experience', v))}<h4>Você já treinou anteriormente?</h4>${chips([{ id: true, label: 'Sim' }, { id: false, label: 'Não' }], p.trainedBefore, (v) => { p.trainedBefore = v; if (!v) p.trainingMonths = 0; render(); })}
      ${p.trainedBefore ? stepper('Há quanto tempo treina (meses)', p.trainingMonths, 0, 240, (v) => set('trainingMonths', v)) : ''}`; break;
    case 4: body = `<h4>O que você deseja? (pode escolher várias)</h4>${chips(OPTIONS.bodyGoal, p.bodyGoals, (v) => toggle('bodyGoals', v), true)}
      <h4>Quais regiões deseja priorizar?</h4>${chips(OPTIONS.muscle, p.priorityMuscles, (v) => toggle('priorityMuscles', v), true)}
      ${card(`<label class="switch-row"><span class="grow"><b>Usar a Meta Áurea como referência</b><small>Ênfase em glúteos, pernas, abdômen e costas, com treino equilibrado.</small></span><input type="checkbox" ${p.aureaReference ? 'checked' : ''} ${act(() => set('aureaReference', !p.aureaReference))}></label>`)}`; break;
    case 5: body = `${stepper('Dias de treino por semana', p.daysPerWeek, 1, 6, (v) => set('daysPerWeek', v))}
      <h4>Quais dias estão disponíveis?</h4>${chips([1, 2, 3, 4, 5, 6, 7].map((d) => ({ id: d, label: WD[d] })), p.availableDays, (v) => toggle('availableDays', v), true)}
      ${p.availableDays.length < p.daysPerWeek ? '<p class="small">Você marcou menos dias que o número de treinos; vamos completar com dias espaçados.</p>' : ''}
      <h4>Tempo disponível por treino</h4>${chips([30, 45, 60, 75, 90].map((m) => ({ id: m, label: m + ' min' })), p.minutesPerSession, (v) => set('minutesPerSession', v))}
      <h4>Onde você treina?</h4>${chips(OPTIONS.location, p.location, (v) => set('location', v))}
      ${p.location === 'HOME' ? `<h4>Quais equipamentos você tem em casa?</h4>${chips(OPTIONS.equipment, p.homeEquipment, (v) => toggle('homeEquipment', v), true)}` : ''}`; break;
    case 6: {
      const main = ['hip_thrust_barra', 'agachamento_livre', 'leg_press_45', 'cadeira_extensora', 'mesa_flexora', 'cadeira_flexora', 'stiff_barra', 'rdl_halter', 'cadeira_abdutora', 'coice_cabo', 'afundo_halter', 'bulgaro', 'panturrilha_pe', 'panturrilha_sentada', 'prancha', 'abdominal_polia', 'puxada_alta', 'remada_baixa', 'desenvolvimento_halter', 'elevacao_lateral'].map((id) => ({ id, label: EX[id].name }));
      body = `<h4>Possui dores, lesões ou limitações de movimento?</h4>${chips(OPTIONS.limitation, p.limitations, (v) => toggle('limitations', v), true)}
      ${field('Detalhes (opcional)', `${bind('limitationNotes', 'text')} maxlength="300"`)}
      <h4>Exercícios preferidos (opcional)</h4>${chips(main, p.preferredExercises, (v) => { p.excludedExercises = p.excludedExercises.filter((x) => x !== v); toggle('preferredExercises', v); }, true)}
      <h4>Exercícios que você NÃO consegue ou não quer fazer</h4>${chips(main, p.excludedExercises, (v) => { p.preferredExercises = p.preferredExercises.filter((x) => x !== v); toggle('excludedExercises', v); }, true)}`; break;
    }
    case 7: body = `${stepper('Refeições por dia', p.mealsPerDay, 3, 6, (v) => set('mealsPerDay', v))}
      ${field('Orçamento mensal para alimentação (R$)', `${bind('monthlyBudget', 'int')} inputmode="numeric"`)}
      <h4>Sabe cozinhar?</h4>${chips(OPTIONS.cook, p.cookSkill, (v) => set('cookSkill', v))}
      <h4>Tempo para preparar refeições (por dia)</h4>${chips([10, 15, 30, 45, 60].map((m) => ({ id: m, label: m + ' min' })), p.prepMinutes, (v) => set('prepMinutes', v))}
      ${switchRow('Quero uma dieta econômica', p.economic, () => set('economic', !p.economic))}
      ${switchRow('Prefiro alimentos comuns de supermercados brasileiros', p.brazilianCommon, () => set('brazilianCommon', !p.brazilianCommon))}`; break;
    case 8: body = `<h4>Restrição alimentar</h4>${chips(OPTIONS.restriction, p.restriction, (v) => set('restriction', v))}
      <h4>Alergias ou intolerâncias</h4>${chips(OPTIONS.allergy, p.allergies, (v) => toggle('allergies', v), true)}
      <h4>Alimentos que você costuma consumir (terão prioridade)</h4>${chips(FOOD_CHOICES, p.usualFoods, (v) => { p.dislikedFoods = p.dislikedFoods.filter((x) => x !== v); toggle('usualFoods', v); }, true)}
      <h4>Alimentos que você NÃO gosta (não aparecerão)</h4>${chips(FOOD_CHOICES, p.dislikedFoods, (v) => { p.usualFoods = p.usualFoods.filter((x) => x !== v); toggle('dislikedFoods', v); }, true)}`; break;
    case 9: body = `${field('Costumo acordar às', `${bind('wakeTime', 'text')} type="time"`)}
      ${field('Costumo dormir às', `${bind('sleepTime', 'text')} type="time"`)}
      ${field('Prefiro treinar às', `${bind('trainTime', 'text')} type="time"`)}
      <h4>Trabalha ou estuda?</h4>${chips(OPTIONS.occupation, p.occupation, (v) => set('occupation', v))}
      <h4>Nível de atividade durante o dia (fora do treino)</h4>${optionCards(OPTIONS.activity, p.activityLevel, (v) => set('activityLevel', v))}
      ${stepper('Horas de sono por noite', p.sleepHours * 2, 6, 24, (v) => set('sleepHours', v / 2), 1, (v) => fmt1(v / 2) + ' h')}
      ${p.sleepHours < 7 ? banner('Dormir menos de 7 horas atrapalha a recuperação muscular e aumenta a fome. Tente, aos poucos, dormir mais.', true) : ''}`; break;
    case 10: body = `${banner('Todas as perguntas desta etapa são opcionais. As respostas ficam somente no seu aparelho e servem apenas para deixar o plano mais seguro.')}
      <h4>Condições de saúde relevantes</h4>${chips(OPTIONS.condition, p.conditions, (v) => toggle('conditions', v), true)}
      ${field('Medicamentos que podem interferir no exercício (opcional)', `${bind('medications', 'text')} maxlength="200"`)}
      ${p.sex === 'FEMALE' ? switchRow('Estou grávida', p.pregnant, () => set('pregnant', !p.pregnant)) + switchRow('Estou amamentando', p.breastfeeding, () => set('breastfeeding', !p.breastfeeding)) : ''}
      ${switchRow('Tenho ou tive transtorno alimentar (anorexia, bulimia, compulsão)', p.eatingDisorderHistory, () => set('eatingDisorderHistory', !p.eatingDisorderHistory))}
      ${field('Outras observações (opcional)', `${bind('healthNotes', 'text')} maxlength="300"`)}
      ${api.safety(p).warnings.map((w) => banner(w, true)).join('')}`; break;
    case 11: {
      const t = api.targets(p), bmi = api.bmi(p);
      body = `<p>Medidas iniciais (opcional). Use uma fita métrica, sem apertar, sempre no mesmo horário.</p>
      ${field('Cintura (cm) — na altura do umbigo', `${bind('waistCm', 'opt')} inputmode="decimal"`)}
      ${field('Quadril (cm) — parte mais larga dos glúteos', `${bind('hipCm', 'opt')} inputmode="decimal"`)}
      ${field('Coxa (cm) — meio da coxa', `${bind('thighCm', 'opt')} inputmode="decimal"`)}
      ${field('Braço (cm) — meio do braço, relaxado', `${bind('armCm', 'opt')} inputmode="decimal"`)}
      ${card(`<h3>Seu resumo</h3><p>IMC: ${dec(bmi)} (${bmiLabel(bmi)}) — o IMC é só uma referência e não mede composição corporal.</p><p>Objetivo: ${h(label('goal', p.goal))}</p><p><b>Meta diária estimada: ${t.calories} kcal • ${t.proteinG} g de proteína • ${dec(t.waterMl / 1000)} L de água</b></p>`)}`; break;
    }
  }
  const lastStep = stepIdx === STEPS.length - 1;
  return `<div class="onb">
    <div class="onb-top"><div class="row">${(editing ? stepIdx > 0 : stepIdx > 0) ? `<button class="btn text" ${act(prev)}>Voltar</button>` : ''}<span class="grow"></span><small>${shown + 1} de ${steps.length}</small></div>
    <div class="progress"><i style="width:${(shown + 1) / steps.length * 100}%"></i></div></div>
    ${stepIdx > 0 ? `<h1>${STEPS[stepIdx]}</h1>` : ''}
    <div class="stack">${body}</div>
    <div class="onb-bottom">${err ? `<p class="err">${h(err)}</p>` : ''}<button class="btn big" id="nextBtn" ${err ? 'disabled' : ''} ${act(next)}>${lastStep ? (editing ? 'Salvar e atualizar meu plano' : 'Criar meu plano personalizado') : stepIdx === 0 ? 'Começar avaliação' : 'Continuar'}</button></div>
  </div>`;
};
function validate(i, p) {
  if (i === 1) {
    if (!p.name?.trim()) return 'Informe seu nome.';
    if (!(p.age >= 12 && p.age <= 90)) return 'Idade deve estar entre 12 e 90 anos.';
    if (!(p.heightCm >= 120 && p.heightCm <= 220)) return 'Altura deve estar entre 120 e 220 cm.';
    if (!(p.weightKg >= 30 && p.weightKg <= 250)) return 'Peso deve estar entre 30 e 250 kg.';
  }
  if (i === 5 && p.location === 'HOME' && !p.homeEquipment.length) return 'Selecione pelo menos uma opção de equipamento.';
  if (i === 9 && minutesOf(p.wakeTime) === minutesOf(p.sleepTime)) return 'Os horários de acordar e dormir precisam ser diferentes.';
  return null;
}
const bmiLabel = (b) => (b < 18.5 ? 'abaixo do recomendado' : b < 25 ? 'adequado' : b < 30 ? 'sobrepeso' : 'obesidade');
const switchRow = (text, on, fn) => `<label class="switch-row"><span class="grow">${h(text)}</span><input type="checkbox" ${on ? 'checked' : ''} ${act(fn)}></label>`;

/* ---- 6. painel principal */
routes.home = () => {
  const p = S.profile; const plan = activePlan('WORKOUT'); const diet = activePlan('DIET');
  const wd = weekdayOf(); const tw = plan?.days.find((d) => d.weekday === wd);
  const done = S.sessions.some((s) => s.epochDay === today());
  const dietDay = diet?.days[wd - 1];
  const checks = S.mealChecks[today()] || [];
  const eaten = dietDay ? dietDay.meals.filter((_, i) => checks.includes(i)).reduce((a, m) => { const x = mealMacros(m); return { kcal: a.kcal + x.kcal, protein: a.protein + x.protein }; }, { kcal: 0, protein: 0 }) : { kcal: 0, protein: 0 };
  const waterMl = S.water.filter((w) => w.epochDay === today()).reduce((a, w) => a + w.ml, 0);
  const weekStart = today() - (wd - 1);
  const weekSessions = S.sessions.filter((s) => s.epochDay >= weekStart).length;
  const hour = new Date().getHours();
  const greet = hour >= 5 && hour < 12 ? 'Bom dia' : hour < 18 && hour >= 12 ? 'Boa tarde' : 'Boa noite';
  const nowMin = hour * 60 + new Date().getMinutes();
  const next = S.schedule.filter((s) => s.enabled && (s.daysMask & (1 << (wd - 1))) && minutesOf(s.time) > nowMin).sort((a, b) => minutesOf(a.time) - minutesOf(b.time))[0];
  const lastCheck = S.checkins[S.checkins.length - 1];
  const checkDue = (!lastCheck && S.sessions.length >= 3) || (lastCheck && today() - lastCheck.epochDay >= 7);
  const unread = S.notifications.filter((n) => !n.read).length;
  const lastW = [...S.measurements].reverse().find((m) => m.weightKg)?.weightKg ?? p.weightKg;
  const d = new Date();
  return `${`<header class="top"><div class="grow"><h1>${greet}, ${h(p.name.split(' ')[0])}</h1><small>${WEEKDAY[wd]}, ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}</small></div>
    <button class="icon badge-wrap" ${act(() => go('notifications'))} aria-label="Notificações">🔔${unread ? `<b class="badge">${unread}</b>` : ''}</button><button class="icon" ${act(() => go('profile'))} aria-label="Perfil">👤</button></header>`}
  <main class="stack">
    ${installHint()}
    ${pushStatus() === 'off' || pushStatus() === 'denied' ? pushCard(true) : ''}
    ${backupDue() ? card(`<div class="row"><span class="grow"><b>💾 Faça um backup dos seus dados</b><small>Seus registros ficam só neste aparelho. Guarde uma cópia no iCloud Drive ou Arquivos.</small></span>›</div>`, 'tint click', act(() => go('settings'))) : ''}
    ${card(tw ? `<small>Treino de hoje</small><h2>${h(tw.title)}</h2><p>${h(tw.focus)} • ~${api.minutes(tw)} min</p>${done ? '<p><b>✓ Treino concluído hoje. Parabéns!</b></p>' : `<button class="btn white" ${act(() => go('session/' + tw.index))}>▶ Começar treino</button>`}`
      : `<small>Treino de hoje</small><h2>Dia de descanso</h2><p>Descansar também faz o músculo crescer. Caminhe, alongue-se e hidrate-se.</p><button class="btn outline-white" ${act(() => go('workout'))}>Ver minha ficha</button>`, 'hero')}
    ${checkDue ? card(`<div class="row"><span class="grow"><b>💗 Hora do check-in semanal</b><small>Conte como você está para ajustarmos seu plano.</small></span>›</div>`, 'tint click', act(() => go('checkin'))) : ''}
    <h3>Metas de hoje</h3>
    ${card(`<div class="row">${ring(waterMl / waterGoal(), `💧<b>${dec(waterMl / 1000)} L</b>`, 'water')}<div class="grow"><b>Água: ${waterMl} / ${waterGoal()} ml</b><div class="row wrap"><button class="btn tonal" ${act(() => { addWater(S.settings.glassMl); })}>+ ${S.settings.glassMl} ml</button><button class="btn text" ${act(() => go('water'))}>Ver detalhes</button></div></div></div>`)}
    ${diet ? card(`<b>Alimentação (refeições marcadas como feitas)</b>${S.settings.hideCalories ? '' : meter('Calorias', eaten.kcal, diet.targets.calories, 'kcal')}${meter('Proteína', eaten.protein, diet.targets.proteinG, 'g', 'plum')}<small class="muted">${checks.length} de ${dietDay?.meals.length || 0} refeições feitas • toque para ver o cardápio</small>`, 'click', act(() => go('diet'))) : ''}
    <div class="grid2">${tile('treinos nesta semana', `${weekSessions}/${plan?.days.length || p.daysPerWeek}`, '🏋️', 'workout')}${tile('peso atual (kg)', fmt1(lastW), '⚖️', 'evolution')}</div>
    ${next ? card(`<div class="row"><span class="grow"><small>Próximo na sua rotina</small><b>${next.time} — ${h(next.label)}</b></span>›</div>`, 'click', act(() => go('calendar'))) : ''}
    <h3>Atalhos</h3>
    <div class="grid3">${tile('Biblioteca de exercícios', '', '📖', 'library')}${tile('Lista de compras', '', '🛒', 'shopping')}${tile('Check-in', '', '💗', 'checkin')}</div>
    ${api.safety(p).warnings.map((w) => banner(w, true)).join('')}
    <p class="small muted">Lembrete: o Áurea é educativo e não substitui profissionais de saúde.</p>
  </main>`;
};
function backupDue() {
  const hasData = S.sessions.length + S.measurements.length + S.photos.length > 0;
  return hasData && (!S.lastBackupAt || Date.now() - S.lastBackupAt > 30 * 86400000) && Date.now() - (S.account?.createdAt || 0) > 7 * 86400000;
}
const tile = (lbl, value, icon, route) => `<button class="tile" ${act(() => go(route))}><span>${icon}</span>${value ? `<b>${h(value)}</b>` : ''}<small>${h(lbl)}</small></button>`;
function addWater(ml) { if (ml > 0) { S.water.push({ id: uid(), epochDay: today(), ml, time: Date.now() }); save(); render(); } }

/* ---- 7. ficha de treino */
let workoutDaySel = -1;
routes.workout = () => {
  const plan = activePlan('WORKOUT');
  if (!plan) return top('Meu treino') + `<main>${card('<p>Responda o questionário para gerar sua ficha.</p>')}</main>`;
  const wd = weekdayOf();
  const idx = workoutDaySel >= 0 ? Math.min(workoutDaySel, plan.days.length - 1) : Math.max(0, plan.days.findIndex((d) => d.weekday === wd));
  const day = plan.days[idx];
  const swap = (pe) => {
    const opts = api.swapOptions(pe, S.profile);
    sheet('Trocar exercício', opts.length ? opts.map((id) => `<button class="list-row" data-id="${id}"><b>${h(EX[id].name)}</b><small>${h(EX[id].equipment.join(', '))}</small></button>`).join('') : '<p>Não há alternativas compatíveis com seus equipamentos e limitações.</p>', (d, close) => {
      d.addEventListener('click', (e) => {
        const b = e.target.closest('[data-id]'); if (!b) return;
        const newId = b.dataset.id;
        const days = plan.days.map((x) => x.index !== day.index ? x : { ...x, exercises: x.exercises.map((q) => q.exerciseId === pe.exerciseId ? api.prescribe(newId, S.profile, plan.setsDelta) : q) });
        savePlan('WORKOUT', { ...plan, days }, `Troca de exercício: ${EX[pe.exerciseId].name} → ${EX[newId].name}`); save(); close(); render();
      });
    });
  };
  return `${top('Meu treino', { actions: `<button class="icon" ${act(() => go('library'))} aria-label="Biblioteca">📖</button><button class="icon" ${act(() => go('history'))} aria-label="Histórico de planos">🕘</button>` })}
  <main class="stack">
    <div class="hscroll">${plan.days.map((d, i) => `<button class="chip ${i === idx ? 'on' : ''}" ${act(() => { workoutDaySel = i; render(); })}>${d.weekday === wd ? '📅 ' : ''}${WD[d.weekday]} • ${h(d.title)}</button>`).join('')}</div>
    ${card(`<h2>${h(day.title)}</h2><p>${WEEKDAY[day.weekday]} • ${h(day.focus)} • ~${api.minutes(day)} min</p>${day.extra ? `<p>${h(day.extra)}</p>` : ''}
      ${plan.setsDelta ? banner(plan.setsDelta < 0 ? `Volume reduzido (${plan.setsDelta} série) após seu check-in, para recuperação.` : `Volume aumentado (+${plan.setsDelta} série) após seu check-in.`) : ''}
      <button class="btn big" ${act(() => go('session/' + day.index))}>▶ Iniciar e registrar este treino</button>`)}
    ${day.exercises.map((pe, i) => { const e = EX[pe.exerciseId]; if (!e) return ''; return card(`<div class="row ex-row">${animCanvas(e.anim, false, 'thumb')}<span class="grow click" ${act(() => go('exercise/' + e.id))}><b>${i + 1}. ${h(e.name)}</b><small class="accent">${h(e.primaryLabel)}</small><small>${pe.sets} séries × ${repsLabel(pe)} • descanso ${pe.restSec}s</small>${pe.note ? `<small>${h(pe.note)}</small>` : ''}</span><button class="icon" ${act(() => swap(pe))} aria-label="Trocar exercício">⇄</button></div>`); }).join('')}
    <h3>Cardio e atividade diária</h3>${card(`<p>${h(plan.cardio)}</p>`)}
    <h3>Orientações</h3>${card(plan.notes.map((n) => `<p>• ${h(n)}</p>`).join(''))}
    <h3>Histórico de treinos</h3>
    ${S.sessions.length ? [...S.sessions].reverse().slice(0, 15).map((s) => `<div class="row list-row"><span>✅</span><span class="grow"><b>${h(s.title)}</b><small>${epochLabel(s.epochDay)} • ${s.durationMin} min</small></span><button class="icon" ${act(async () => { if (await confirmBox('Apagar registro?', 'Este treino será removido do histórico.', 'Apagar', true)) { S.sessions = S.sessions.filter((x) => x.id !== s.id); save(); render(); } })} aria-label="Apagar">🗑</button></div>`).join('') : '<p class="muted">Nenhum treino registrado ainda.</p>'}
  </main>`;
};
const repsLabel = (pe) => pe.timeBased ? `${pe.repMin}–${pe.repMax} s` : `${pe.repMin}–${pe.repMax}`;

/* ---- registro do treino */
let session = null, sessionTimer = null;
function lastSetsFor(exId) {
  for (let i = S.sessions.length - 1; i >= 0; i--) {
    const sets = S.sessions[i].sets.filter((x) => x.exerciseId === exId);
    if (sets.length) return { sets: sets.map((x) => ({ weightKg: x.weightKg, reps: x.reps })), fb: S.sessions[i].feedback.find((f) => f.exerciseId === exId) };
  }
  return { sets: [], fb: null };
}
routes.session = (dayIndexStr) => {
  const plan = activePlan('WORKOUT');
  const day = plan?.days.find((d) => d.index === Number(dayIndexStr));
  if (!day) return top('Treino', { back: true }) + '<main><p>Treino não encontrado.</p></main>';
  if (!session || session.dayIndex !== day.index) {
    const last = S.checkins[S.checkins.length - 1];
    const recovered = !last || (last.answers.recovery >= 3 && last.answers.sleep >= 3);
    session = { dayIndex: day.index, start: Date.now(), rest: 0, items: day.exercises.filter((pe) => EX[pe.exerciseId]).map((pe) => {
      const e = EX[pe.exerciseId]; const { sets, fb } = lastSetsFor(e.id);
      const sug = api.suggest(pe, sets, fb?.rpe || 0, fb ? fb.goodForm : true, fb ? fb.pain : false, recovered, e.loadStep);
      return { pe, e, sug, rpe: 8, form: true, pain: false, sets: Array.from({ length: pe.sets }, () => ({ w: sug.weightKg != null ? fmt1(sug.weightKg).replace(',', '.') : '', r: String(pe.timeBased ? pe.repMin : sug.targetReps), done: false })) };
    }) };
  }
  clearInterval(sessionTimer);
  sessionTimer = setInterval(() => {
    const el = document.getElementById('sessTime'); if (!el) { clearInterval(sessionTimer); return; }
    const s = Math.floor((Date.now() - session.start) / 1000);
    el.textContent = `Tempo: ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const rest = document.getElementById('sessRest');
    const left = Math.max(0, Math.ceil((session.rest - Date.now()) / 1000));
    if (rest) rest.textContent = left > 0 ? `Descanso: ${left}s` : '';
  }, 500);
  const anyDone = session.items.some((it) => it.sets.some((s) => s.done));
  const finish = () => {
    const sets = [], feedback = [];
    session.items.forEach((it) => {
      const done = it.sets.filter((s) => s.done && Number(s.r) > 0);
      if (!done.length) return;
      done.forEach((s) => sets.push({ exerciseId: it.e.id, weightKg: Number(String(s.w).replace(',', '.')) || 0, reps: Number(s.r) }));
      feedback.push({ exerciseId: it.e.id, rpe: it.rpe, goodForm: it.form, pain: it.pain });
    });
    S.sessions.push({ id: uid(), epochDay: today(), dayIndex: day.index, title: day.title, durationMin: Math.max(1, Math.round((Date.now() - session.start) / 60000)), sets, feedback });
    session = null; save(); toast('Treino salvo! 💪'); go('workout');
  };
  const exit = async () => { if (!anyDone || await confirmBox('Sair do treino?', 'Os registros desta sessão não concluída serão descartados.', 'Sair', true)) { session = null; back(); } };
  return `<header class="top"><button class="icon" ${act(exit)} aria-label="Voltar">‹</button><h1 class="grow">${h(day.title)}</h1></header>
  <main class="stack pb">
    ${banner('Marque ✓ em cada série concluída. A sugestão de carga usa seu último registro, o esforço percebido e a qualidade da execução.')}
    ${session.items.map((it, ei) => card(`<div class="row">${animCanvas(it.e.anim, true, 'mid')}<span class="grow"><b>${h(it.e.name)}</b><small>${it.pe.sets} × ${repsLabel(it.pe)} • descanso ${it.pe.restSec}s</small></span></div>
      <p class="small accent2">💡 ${h(it.sug.message)}</p>
      ${it.sets.map((s, si) => `<div class="set-row"><b>${si + 1}</b><label class="mini"><span>kg</span><input inputmode="decimal" value="${h(s.w)}" data-sess="${ei}.${si}.w"></label><label class="mini"><span>${it.pe.timeBased ? 'seg' : 'reps'}</span><input inputmode="numeric" value="${h(s.r)}" data-sess="${ei}.${si}.r"></label><button class="check ${s.done ? 'on' : ''}" aria-label="Série concluída" ${act(() => { s.done = !s.done; if (s.done) session.rest = Date.now() + it.pe.restSec * 1000; render(); })}>✓</button></div>`).join('')}
      <label class="field"><span>Esforço percebido: <b id="rpe${ei}">${it.rpe}/10 ${rpeLabel(it.rpe)}</b></span><input type="range" min="1" max="10" value="${it.rpe}" data-rpe="${ei}"></label>
      <div class="row wrap"><label class="cb"><input type="checkbox" ${it.form ? 'checked' : ''} ${act(() => { it.form = !it.form; })}> Boa execução</label><label class="cb"><input type="checkbox" ${it.pain ? 'checked' : ''} ${act(() => { it.pain = !it.pain; render(); })}> Senti dor</label></div>
      ${it.pain ? banner('Dor articular ou aguda não é normal. Reduza a carga, troque o exercício e, se persistir, procure um profissional.', true) : ''}`)).join('')}
  </main>
  <footer class="bottom-action"><span class="grow"><b id="sessTime">Tempo: 00:00</b><small id="sessRest" class="accent"></small></span><button class="btn" ${anyDone ? '' : 'disabled'} ${act(finish)}>Concluir treino</button></footer>`;
};
const rpeLabel = (r) => (r <= 4 ? '(fácil)' : r <= 6 ? '(moderado)' : r <= 8 ? '(difícil, 2–3 reps sobrando)' : r === 9 ? '(1 rep sobrando)' : '(máximo)');

/* ---- 8. biblioteca */
let libQuery = '', libMuscle = '', libHome = false;
routes.library = () => {
  const list = EXERCISES.filter((e) => (!libQuery || (e.name + ' ' + e.primaryLabel).toLowerCase().includes(libQuery.toLowerCase())) && (!libMuscle || e.muscles.includes(libMuscle)) && (!libHome || !e.gymOnly));
  return `${top('Biblioteca de exercícios', { back: true })}<main class="stack">
    <label class="field"><span>Buscar exercício ou músculo</span><input type="search" id="libq" value="${h(libQuery)}" placeholder="ex.: glúteo, agachamento"></label>
    <div class="hscroll"><button class="chip ${libHome ? 'on' : ''}" ${act(() => { libHome = !libHome; render(); })}>Dá para fazer em casa</button><button class="chip ${!libMuscle ? 'on' : ''}" ${act(() => { libMuscle = ''; render(); })}>Todos</button>${OPTIONS.muscle.map((m) => `<button class="chip ${libMuscle === m.label ? 'on' : ''}" ${act(() => { libMuscle = libMuscle === m.label ? '' : m.label; render(); })}>${h(m.label)}</button>`).join('')}</div>
    <small>${list.length} exercícios</small>
    ${list.map((e) => card(`<div class="row ex-row">${animCanvas(e.anim, false, 'thumb')}<span class="grow"><b>${h(e.name)}</b><small class="muted">${h(e.muscles.join(', '))}</small><small class="accent">${h(e.equipment.join(', '))}</small></span></div>`, 'click', act(() => go('exercise/' + e.id)))).join('')}
  </main>`;
};

/* ---- detalhe do exercício */
routes.exercise = (id) => {
  const e = EX[id]; if (!e) return top('Exercício', { back: true }) + '<main><p>Não encontrado.</p></main>';
  const plan = activePlan('WORKOUT');
  const pe = plan?.days.flatMap((d) => d.exercises).find((x) => x.exerciseId === id);
  const hist = {};
  S.sessions.forEach((s) => s.sets.filter((x) => x.exerciseId === id).forEach((x) => { hist[s.epochDay] = Math.max(hist[s.epochDay] || 0, x.weightKg); }));
  const alts = S.profile ? api.alternatives(id, S.profile) : e.alternatives;
  return `${top(e.name, { back: true })}<main class="stack">
    ${card(animCanvas(e.anim, true, 'big'))}
    <div class="pills">${pill('Principal: ' + e.primaryLabel, 'p1')}${e.muscles.slice(1).map((m) => pill(m, 'p2')).join('')}${e.equipment.map((q) => pill(q, 'p4')).join('')}</div>
    ${pe ? card(`<b>Na sua ficha</b><p>${pe.sets} séries • ${repsLabel(pe)} ${pe.timeBased ? '' : 'repetições'} • descanso de ${pe.restSec} s</p>${pe.note ? `<small>${h(pe.note)}</small>` : ''}`, 'tint') : ''}
    ${card(`<h3>Execução correta</h3>${e.steps.map((s, i) => `<p>${i + 1}. ${h(s)}</p>`).join('')}`)}
    ${card(`<h3>Dicas de técnica</h3>${e.tips.map((s) => `<p>• ${h(s)}</p>`).join('')}${e.avoidIf.length ? `<p class="err small">Cuidado se você tem limitação em: ${h(e.avoidIf.join(', ').toLowerCase())}.</p>` : ''}`)}
    <a class="btn outline" href="https://www.youtube.com/results?search_query=${encodeURIComponent(e.videoQuery)}" target="_blank" rel="noopener">▶ Ver vídeos de execução (requer internet)</a>
    <h3>Alternativas (sem o equipamento)</h3>
    ${alts.map((a) => EX[a] ? `<button class="list-row" ${act(() => go('exercise/' + a))}>⇄ <span class="grow"><b>${h(EX[a].name)}</b><small>${h(EX[a].equipment.join(', '))}</small></span></button>` : '').join('')}
    <h3>Sua evolução de carga</h3>${card(lineChart(Object.entries(hist).map(([d, w]) => ({ x: Number(d), y: w })), 'kg'))}
  </main>`;
};

/* ---- 9. dieta */
let dietDaySel = -1;
routes.diet = () => {
  const plan = activePlan('DIET');
  if (!plan) return top('Minha dieta') + '<main><p>Responda o questionário para gerar seu cardápio.</p></main>';
  const todayIdx = weekdayOf() - 1;
  const di = dietDaySel >= 0 ? dietDaySel : todayIdx;
  const day = plan.days[di];
  const t = plan.targets;
  const checks = S.mealChecks[today()] || [];
  const swap = (mi, ii, item) => {
    const subs = api.substitutes(item, S.profile);
    sheet('Substituir ' + FOOD[item.foodId].name, `<p class="small">Quantidades equivalentes calculadas pelo nutriente principal.</p><label class="cb"><input type="checkbox" id="allDays"> Trocar em todos os dias</label>
      ${subs.length ? subs.map((s, k) => `<button class="list-row" data-k="${k}"><span class="grow"><b>${h(FOOD[s.foodId].name)}</b><small>${s.grams} g • ${h(api.measure(s.foodId, s.grams))} • ${r0(itemMacros(s).kcal)} kcal</small></span></button>`).join('') : '<p>Nenhuma substituição compatível com suas restrições.</p>'}`, (d, close) => {
      d.addEventListener('click', (e) => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        const newItem = { ...subs[Number(b.dataset.k)], role: item.role };
        const all = d.querySelector('#allDays').checked;
        const days = plan.days.map((dd) => (!all && dd.dayIndex !== di) ? dd : { ...dd, meals: dd.meals.map((m, x) => x !== mi ? m : { ...m, items: m.items.map((it, y) => ((all && it.foodId === item.foodId) || (!all && y === ii)) ? newItem : it) }) });
        const weekly = api.shopping(days).reduce((a, s) => a + s.cost, 0);
        savePlan('DIET', { ...plan, days, weeklyCost: weekly, monthlyCost: weekly * 4.3 }, `Substituição: ${FOOD[item.foodId].name} → ${FOOD[newItem.foodId].name}`); save(); close(); render();
      });
    });
  };
  const toggleMeal = (i) => { const l = new Set(S.mealChecks[today()] || []); l.has(i) ? l.delete(i) : l.add(i); S.mealChecks[today()] = [...l]; save(); render(); };
  let showWhy = false;
  return `${top('Minha dieta', { actions: `<button class="icon" ${act(() => go('recipes'))} aria-label="Receitas">🍽</button><button class="icon" ${act(() => go('shopping'))} aria-label="Lista de compras">🛒</button>` })}
  <main class="stack">
    ${card(`<small>Meta diária</small>${S.settings.hideCalories ? '' : `<h2 class="xl">${t.calories} kcal</h2>`}<p>Proteína ${t.proteinG} g • Carboidratos ${t.carbsG} g • Gorduras ${t.fatG} g</p><p>Água ${dec(t.waterMl / 1000, 2)} L</p>
      <details><summary>Como isso foi calculado?</summary>${t.explanation.map((x) => `<p class="small">• ${h(x)}</p>`).join('')}</details>`, 'hero')}
    <div class="hscroll">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<button class="chip ${i === di ? 'on' : ''}" ${act(() => { dietDaySel = i; render(); })}>${WD[i + 1]}${i === todayIdx ? ' (hoje)' : ''}</button>`).join('')}</div>
    ${card(`<small>Total do dia (cardápio)</small>${macroPills(dayMacros(day))}`)}
    ${day.meals.map((m, mi) => { const done = di === todayIdx && checks.includes(mi); return card(`<div class="row"><span class="grow"><b>${m.time} • ${h(m.title)}</b>${m.note ? `<small class="muted">${h(m.note)}</small>` : ''}</span>${di === todayIdx ? `<button class="chip ${done ? 'on' : ''}" ${act(() => toggleMeal(mi))}>${done ? '✓ Feita' : 'Marcar'}</button>` : ''}</div>
      ${m.items.map((it, ii) => { const f = FOOD[it.foodId]; return f ? `<div class="row food ${done ? 'done' : ''}"><span class="grow"><span>${h(f.name)}</span><small class="muted">${it.grams} g • ${h(api.measure(it.foodId, it.grams))}</small></span><button class="icon" ${act(() => swap(mi, ii, it))} aria-label="Substituir">⇄</button></div>` : ''; }).join('')}
      ${macroPills(mealMacros(m))}`); }).join('')}
    ${card(`<b>💰 Custo estimado: ${brl(plan.monthlyCost)}/mês</b><small>Orçamento informado: ${brl(plan.budget)}. Preços médios aproximados; variam por região.</small>`)}
    ${plan.notes.map((n) => banner(n)).join('')}
    <div class="grid3">${tile('Receitas e substituições', '', '🍽', 'recipes')}${tile('Lista de compras', '', '🛒', 'shopping')}${tile('Água', '', '💧', 'water')}</div>
  </main>`;
};

/* ---- 10. receitas e substituições */
let recTab = 0, recFilter = '';
routes.recipes = () => {
  const tags = ['Sem fogão', 'Dias corridos', 'Econômica', 'Café da manhã', 'Almoço', 'Lanche', 'Vegana'];
  let body;
  if (recTab === 0) {
    const list = RECIPES.filter((r) => !recFilter || r.tags.includes(recFilter) || (recFilter === 'Sem fogão' && r.noCook));
    body = `<div class="hscroll"><button class="chip ${!recFilter ? 'on' : ''}" ${act(() => { recFilter = ''; render(); })}>Todas</button>${tags.map((t) => `<button class="chip ${recFilter === t ? 'on' : ''}" ${act(() => { recFilter = recFilter === t ? '' : t; render(); })}>${t}</button>`).join('')}</div>
      ${list.map((r) => card(`<b>${h(r.title)}</b><small>${r.minutes} min • ~${r.kcal} kcal • ${r.protein} g proteína/porção</small><small class="accent">${h(r.tags.join(' • '))}</small>`, 'click', act(() => sheet(r.title, `<p><b>${r.minutes} min • ~${r.kcal} kcal • ${r.protein} g de proteína por porção</b></p><h4>Ingredientes</h4>${r.ingredients.map((x) => `<p>• ${h(x)}</p>`).join('')}<h4>Modo de preparo</h4>${r.steps.map((x, i) => `<p>${i + 1}. ${h(x)}</p>`).join('')}`)))).join('')}`;
  } else {
    const groups = [['Proteínas (≈ 30 g de proteína)', { foodId: 'frango_peito', grams: 100, role: 'MAIN_PROTEIN' }], ['Carboidratos do almoço (≈ 40 g)', { foodId: 'arroz', grams: 140, role: 'MAIN_CARB' }], ['Carboidratos do café/lanche (≈ 30 g)', { foodId: 'pao_frances', grams: 50, role: 'BK_CARB' }], ['Proteínas do café/lanche (≈ 13 g)', { foodId: 'ovo', grams: 100, role: 'SNACK_PROTEIN' }], ['Frutas (≈ 18 g de carboidrato)', { foodId: 'banana', grams: 70, role: 'FRUIT' }], ['Gorduras (≈ 8 g de gordura)', { foodId: 'azeite', grams: 8, role: 'FAT' }]];
    body = banner('Troque alimentos do mesmo grupo mantendo o plano coerente. As quantidades abaixo equivalem à porção de referência.') + groups.map(([title, ref]) => card(`<b>${title}</b><p>• ${h(FOOD[ref.foodId].name)}: ${ref.grams} g (${h(api.measure(ref.foodId, ref.grams))})</p>${api.substitutes(ref, S.profile).slice(0, 8).map((s) => `<p>• ${h(FOOD[s.foodId].name)}: ${s.grams} g (${h(api.measure(s.foodId, s.grams))})</p>`).join('')}`)).join('');
  }
  return `${top('Receitas e substituições', { back: true })}<div class="tabs"><button class="${recTab === 0 ? 'on' : ''}" ${act(() => { recTab = 0; render(); })}>Receitas</button><button class="${recTab === 1 ? 'on' : ''}" ${act(() => { recTab = 1; render(); })}>Substituições</button></div><main class="stack">${body}</main>`;
};

/* ---- 11. lista de compras */
let shopChecked = {};
routes.shopping = () => {
  const plan = activePlan('DIET');
  const items = plan ? api.shopping(plan.days) : [];
  const total = items.reduce((a, i) => a + i.cost, 0);
  const share = async () => {
    const text = `Lista de compras da semana — Áurea\n${items.map((i) => `☐ ${i.name}: ${i.quantity}`).join('\n')}\nCusto estimado: ${brl(total)}`;
    try { if (NATIVE && CAP.Share) await CAP.Share.share({ title: 'Lista de compras', text }); else if (navigator.share) await navigator.share({ title: 'Lista de compras', text }); else { await navigator.clipboard.writeText(text); toast('Lista copiada!'); } } catch (e) {}
  };
  return `${top('Lista de compras', { back: true, actions: `<button class="icon" ${act(share)} aria-label="Compartilhar">⤴</button>` })}<main class="stack">
    ${card(`<h2>Semana: ${brl(total)}</h2><b>Mês (≈ 4,3 semanas): ${brl(total * 4.3)}</b><small>Estimativa com preços médios de supermercado. Quantidades já convertidas para o peso cru/seco quando necessário.</small>`)}
    ${items.map((i) => `<label class="row list-row ${shopChecked[i.foodId] ? 'done' : ''}"><input type="checkbox" ${shopChecked[i.foodId] ? 'checked' : ''} ${act(() => { shopChecked[i.foodId] = !shopChecked[i.foodId]; render(); })}><span class="grow"><span>${h(i.name)}</span><small class="muted">${h(i.quantity)}</small></span><b>${brl(i.cost)}</b></label>`).join('')}
    ${banner('Dicas para economizar: compre frutas da estação, carnes em promoção para congelar, arroz e feijão em pacotes maiores e prepare marmitas no fim de semana.')}
  </main>`;
};

/* ---- 12. água */
routes.water = () => {
  const list = S.water.filter((w) => w.epochDay === today()).sort((a, b) => b.time - a.time);
  const total = list.reduce((a, w) => a + w.ml, 0), goal = waterGoal();
  const start = today() - 6;
  const vals = [0, 1, 2, 3, 4, 5, 6].map((d) => S.water.filter((w) => w.epochDay === start + d).reduce((a, w) => a + w.ml, 0) / 1000);
  const labels = [0, 1, 2, 3, 4, 5, 6].map((d) => WD[weekdayOf(dateOfEpoch(start + d))]);
  return `${top('Controle de água', { back: true })}<main class="stack center-items">
    ${ring(total / goal, `<b class="xl">${total} ml</b><small>de ${goal} ml</small>${total >= goal ? '<small class="accent">Meta batida! 🎉</small>' : ''}`, 'water', 200)}
    <div class="row wrap center">${[...new Set([150, S.settings.glassMl, 500])].map((ml) => `<button class="btn water" ${act(() => addWater(ml))}>+${ml} ml</button>`).join('')}</div>
    <div class="row"><label class="field grow"><span>Outra quantidade (ml)</span><input id="customWater" inputmode="numeric"></label><button class="btn tonal" ${act(() => { const v = Number(document.getElementById('customWater').value); if (v > 0 && v <= 3000) addWater(v); })}>Adicionar</button></div>
    ${card(`<b>Últimos 7 dias</b>${barChart(labels, vals, 'L', 'var(--water)', goal / 1000)}`)}
    ${card(`<b>Meta diária</b><small>Calculada como 35 ml por kg de peso. Em dias quentes ou de treino intenso, beba um pouco mais.</small>
      ${stepper('Meta (ml)', goal, 1000, 5000, (v) => { S.settings.waterGoalOverride = v; save(); render(); }, 250)}
      ${stepper('Tamanho do seu copo', S.settings.glassMl, 100, 1000, (v) => { S.settings.glassMl = v; save(); render(); }, 50, (v) => v + ' ml')}
      ${S.settings.waterGoalOverride ? `<button class="btn text" ${act(() => { S.settings.waterGoalOverride = 0; save(); render(); })}>Voltar para a meta automática</button>` : ''}`)}
    <h3>Registros de hoje</h3>
    ${list.length ? list.map((w) => `<div class="row list-row"><span>💧</span><b class="grow">${w.ml} ml</b><small>${new Date(w.time).toTimeString().slice(0, 5)}</small><button class="icon" ${act(() => { S.water = S.water.filter((x) => x.id !== w.id); save(); render(); })} aria-label="Apagar">🗑</button></div>`).join('') : '<p class="muted">Nenhum registro hoje.</p>'}
  </main>`;
};

/* ---- 13. calendário e rotina */
let calMonth = null, calSel = null;
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ICON = { WAKE: '☀️', MEAL: '🍽', TRAINING: '🏋️', WATER: '💧', REST: '🧘', SLEEP: '🌙', CHECKIN: '💗', CUSTOM: '📌' };
routes.calendar = () => {
  const now = new Date();
  if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!calSel) calSel = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plan = activePlan('WORKOUT');
  const trainDays = new Set(plan?.days.map((d) => d.weekday) || []);
  const doneDays = new Set(S.sessions.map((s) => s.epochDay));
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const first = weekdayOf(new Date(y, m, 1)) - 1, len = new Date(y, m + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<span></span>';
  for (let d = 1; d <= len; d++) {
    const date = new Date(y, m, d), ep = Math.floor(Date.UTC(y, m, d) / 86400000);
    const sel = date.getTime() === calSel.getTime();
    cells += `<button class="day ${sel ? 'sel' : ''} ${doneDays.has(ep) ? 'done' : ''}" ${act(() => { calSel = date; render(); })}>${d}${trainDays.has(weekdayOf(date)) ? '<i></i>' : ''}</button>`;
  }
  const dow = weekdayOf(calSel);
  const items = S.schedule.filter((s) => s.daysMask & (1 << (dow - 1))).sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
  const w = plan?.days.find((d) => d.weekday === dow);
  const edit = (item, isNew) => {
    const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => item.daysMask & (1 << (d - 1)));
    sheet(isNew ? 'Novo lembrete' : 'Editar lembrete', `${field('Texto', `id="schLabel" value="${h(item.label)}" maxlength="60"`)}${field('Horário', `id="schTime" type="time" value="${item.time}"`)}
      <h4>Dias</h4><div class="chips">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<label class="chip"><input type="checkbox" class="schDay" value="${d}" ${days.includes(d) ? 'checked' : ''}> ${WD[d]}</label>`).join('')}</div>
      <div class="row end">${isNew ? '' : '<button class="btn text danger-text" data-del>Excluir</button>'}<button class="btn" data-ok>Salvar</button></div>`, (d, close) => {
      d.addEventListener('click', (e) => {
        if (e.target.closest('[data-del]')) { S.schedule = S.schedule.filter((x) => x.id !== item.id); save(); close(); render(); }
        if (e.target.closest('[data-ok]')) {
          const mask = [...d.querySelectorAll('.schDay:checked')].reduce((a, c) => a | (1 << (Number(c.value) - 1)), 0);
          if (!mask) return toast('Escolha pelo menos um dia.');
          Object.assign(item, { label: d.querySelector('#schLabel').value || 'Lembrete', time: d.querySelector('#schTime').value || item.time, daysMask: mask });
          if (isNew) S.schedule.push(item);
          save(); close(); render();
        }
      });
    });
  };
  return `${top('Calendário e rotina', { back: true, actions: `<button class="icon" ${act(async () => { if (await confirmBox('Recriar rotina?', 'Os horários voltam a ser calculados a partir do seu perfil. Suas edições serão substituídas.', 'Recriar')) { S.schedule = buildSchedule(S.profile, plan); save(); render(); } })} aria-label="Recriar rotina">↺</button>` })}
  <main class="stack">
    ${card(`<div class="row"><button class="icon" ${act(() => { calMonth = new Date(y, m - 1, 1); render(); })} aria-label="Mês anterior">‹</button><b class="grow center">${MONTHS[m]} ${y}</b><button class="icon" ${act(() => { calMonth = new Date(y, m + 1, 1); render(); })} aria-label="Próximo mês">›</button></div>
      <div class="cal">${WD.slice(1).map((d) => `<small>${d}</small>`).join('')}${cells}</div><small class="muted">• dia de treino   ■ treino concluído</small>`)}
    <h3>${WEEKDAY[dow]}, ${calSel.getDate()}/${String(calSel.getMonth() + 1).padStart(2, '0')} • ${w ? h(w.title) : 'descanso'}</h3>
    ${items.length ? items.map((s) => card(`<div class="row"><span class="ic">${ICON[s.type] || '📌'}</span><span class="grow click" ${act(() => edit(s, false))}><b>${s.time}</b><small>${h(s.label)}</small></span><input type="checkbox" class="toggle" ${s.enabled ? 'checked' : ''} ${act(() => { s.enabled = !s.enabled; save(); })} aria-label="Ativar"></div>`)).join('') : '<p class="muted">Nenhum compromisso neste dia.</p>'}
    <button class="btn tonal" ${act(() => edit({ id: uid(), type: 'CUSTOM', label: 'Novo lembrete', time: '12:00', daysMask: 127, enabled: true }, true))}>+ Adicionar lembrete</button>
    ${pushCard()}
    ${card(`<b>📅 Também no Calendário (opcional)</b><p class="small">Copia a rotina para o app Calendário com alertas — funciona até sem internet depois de adicionada. No iPhone, toque em <b>Adicionar Todos</b>.</p><button class="btn tonal" ${act(exportIcs)}>Adicionar rotina ao Calendário</button>`)}
  </main>`;
};

/** Exporta a rotina como arquivo .ics (eventos semanais com alerta) para o app Calendário. */
/** Rotina no formato de calendário (.ics), com alerta no horário de cada lembrete. */
function buildIcs() {
  const BY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const d = new Date(); const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const esc = (s) => s.replace(/[,;\\]/g, (c) => '\\' + c);
  const events = S.schedule.filter((s) => s.enabled).map((s) => {
    const days = [1, 2, 3, 4, 5, 6, 7].filter((x) => s.daysMask & (1 << (x - 1))).map((x) => BY[x]).join(',');
    const [hh, mm] = s.time.split(':');
    return ['BEGIN:VEVENT', `UID:aurea-${s.id}@aurea.app`, `DTSTAMP:${stamp}`, `DTSTART:${ymd}T${hh}${mm}00`, 'DURATION:PT10M', `RRULE:FREQ=WEEKLY;BYDAY=${days}`, `SUMMARY:${esc('Áurea: ' + s.label)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(s.label)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aurea//Rotina//PT', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Áurea — Rotina', ...events, 'END:VCALENDAR'].join('\r\n');
}

async function exportIcs() {
  if (NATIVE) { try { await nativeShareFile('aurea-rotina.ics', buildIcs()); } catch (e) { if (!String(e).includes('cancel')) toast('Não foi possível compartilhar.'); } return; }
  if (ONLINE_HOST && navigator.onLine) { location.href = icsLink(); return; }
  const ics = buildIcs();
  const file = new File([ics], 'aurea-rotina.ics', { type: 'text/calendar' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Rotina Áurea' }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = 'aurea-rotina.ics'; document.body.appendChild(a); a.click(); a.remove();
  toast('Abra o arquivo baixado e toque em “Adicionar todos”.');
}

/* ---- 14. minha evolução */
routes.evolution = () => {
  const ms = [...S.measurements].sort((a, b) => a.epochDay - b.epochDay);
  const delta = (k) => { const a = ms.find((m) => m[k] != null)?.[k], b = [...ms].reverse().find((m) => m[k] != null)?.[k]; if (a == null || b == null) return '—'; const d = b - a; return (d > 0 ? '+' : '') + fmt1(Math.round(d * 10) / 10); };
  const addPhoto = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const blob = await resizeImage(f, 1600);
        const id = uid(); await photoSet(id, blob);
        S.photos.push({ id, epochDay: today(), note: document.getElementById('photoNote')?.value || '' }); save(); toast('Foto salva com privacidade no aparelho.'); render();
      } catch (e) { toast('Não foi possível salvar a foto.'); }
    };
    inp.click();
  };
  return `${top('Minha evolução', { actions: `<button class="icon" ${act(() => go('charts'))} aria-label="Gráficos">📈</button>` })}<main class="stack">
    <div class="grid3">${stat('peso (kg) desde o início', delta('weightKg'))}${stat('cintura (cm)', delta('waistCm'))}${stat('quadril (cm)', delta('hipCm'))}${stat('treinos registrados', S.sessions.length)}${stat('coxa (cm)', delta('thighCm'))}${stat('braço (cm)', delta('armCm'))}</div>
    <button class="btn big" ${act(() => measureSheet())}>+ Registrar medidas</button>
    ${card(`<b>Peso ao longo do tempo</b>${lineChart(ms.filter((m) => m.weightKg != null).map((m) => ({ x: m.epochDay, y: m.weightKg })), 'kg')}<button class="btn text" ${act(() => go('charts'))}>Ver todos os gráficos</button>`)}
    ${banner('O peso oscila no dia a dia (água, sal, ciclo menstrual). Pese-se pela manhã, em jejum, e observe a tendência das semanas. Medidas e cargas também mostram evolução.')}
    <h3>Fotos de progresso (privadas)</h3>
    ${card(`<p class="small">As fotos são opcionais, ficam somente neste aparelho e nunca são enviadas a servidores. Elas não são usadas para avaliar saúde ou composição corporal.</p>${field('Legenda (opcional), ex.: frente, lado', 'id="photoNote" maxlength="60"')}<button class="btn" ${act(addPhoto)}>📷 Adicionar foto</button><div class="photos" id="photoStrip">${[...S.photos].reverse().map((p) => `<button class="photo" data-photo="${p.id}" ${act(() => viewPhoto(p))}><img alt="Foto de progresso" data-photo-img="${p.id}"><small>${epochLabel(p.epochDay)}</small></button>`).join('')}</div>`)}
    <h3>Histórico de medidas</h3>
    ${ms.length ? [...ms].reverse().map((m) => card(`<div class="row"><span class="grow"><b>${epochLabel(m.epochDay)}</b><small>${[m.weightKg != null && `Peso ${fmt1(m.weightKg)} kg`, m.waistCm != null && `Cintura ${fmt1(m.waistCm)}`, m.hipCm != null && `Quadril ${fmt1(m.hipCm)}`, m.thighCm != null && `Coxa ${fmt1(m.thighCm)}`, m.armCm != null && `Braço ${fmt1(m.armCm)}`].filter(Boolean).join(' • ')}</small></span><button class="icon" ${act(() => { S.measurements = S.measurements.filter((x) => x.id !== m.id); save(); render(); })} aria-label="Apagar">🗑</button></div>`)).join('') : card('<p>Nenhuma medida ainda. Registre seu peso e suas medidas para acompanhar a evolução.</p>')}
  </main>`;
};
const stat = (lbl, v) => `<div class="tile"><b>${h(v)}</b><small>${h(lbl)}</small></div>`;
function measureSheet() {
  const last = [...S.measurements].reverse().find((m) => m.weightKg != null);
  sheet('Registrar medidas de hoje', `${field('Peso (kg)', `id="mW" inputmode="decimal" value="${last?.weightKg ?? ''}"`)}${field('Cintura (cm)', 'id="mWa" inputmode="decimal"')}${field('Quadril (cm)', 'id="mH" inputmode="decimal"')}${field('Coxa (cm)', 'id="mT" inputmode="decimal"')}${field('Braço (cm)', 'id="mA" inputmode="decimal"')}<button class="btn big" data-ok>Salvar</button>`, (d, close) => {
    d.querySelector('[data-ok]').onclick = () => {
      const v = (id, lo, hi) => { const x = Number(String(d.querySelector(id).value).replace(',', '.')); return x >= lo && x <= hi ? x : null; };
      const m = { id: uid(), epochDay: today(), weightKg: v('#mW', 30, 250), waistCm: v('#mWa', 30, 200), hipCm: v('#mH', 30, 200), thighCm: v('#mT', 20, 120), armCm: v('#mA', 10, 80) };
      if ([m.weightKg, m.waistCm, m.hipCm, m.thighCm, m.armCm].every((x) => x == null)) return toast('Preencha pelo menos uma medida válida.');
      S.measurements.push(m);
      if (m.weightKg != null) S.profile.weightKg = m.weightKg;
      save(); close(); toast('Medidas registradas!'); render();
    };
  });
}
async function viewPhoto(p) {
  const blob = await photoGet(p.id); const url = blob ? URL.createObjectURL(blob) : '';
  sheet(`${epochLabel(p.epochDay)} ${p.note || ''}`, `<img class="photo-big" src="${url}" alt="Foto de progresso"><button class="btn text danger-text" data-del>Excluir foto</button>`, (d, close) => {
    d.querySelector('[data-del]').onclick = async () => { if (await confirmBox('Excluir foto?', 'A foto será apagada definitivamente do aparelho.', 'Excluir', true)) { await photoDel(p.id); S.photos = S.photos.filter((x) => x.id !== p.id); save(); close(); render(); } };
  });
}
function resizeImage(file, maxSide) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject()), 'image/jpeg', 0.88);
    };
    img.onerror = reject; img.src = url;
  });
}
async function loadPhotoThumbs() {
  for (const img of document.querySelectorAll('[data-photo-img]')) {
    const b = await photoGet(img.dataset.photoImg); if (b) img.src = URL.createObjectURL(b);
  }
}

/* ---- 15. gráficos */
let chMetric = 'Peso', chEx = null;
routes.charts = () => {
  const ms = [...S.measurements].sort((a, b) => a.epochDay - b.epochDay);
  const key = { Peso: 'weightKg', Cintura: 'waistCm', Quadril: 'hipCm', Coxa: 'thighCm', 'Braço': 'armCm' };
  const pts = ms.map((m) => ({ x: m.epochDay, y: chMetric === 'Cintura/Quadril' ? (m.waistCm && m.hipCm ? m.waistCm / m.hipCm : null) : m[key[chMetric]] })).filter((p) => p.y != null);
  const t = today();
  const weeks = [7, 6, 5, 4, 3, 2, 1, 0].map((w) => S.sessions.filter((s) => s.epochDay > t - (w + 1) * 7 && s.epochDay <= t - w * 7).length);
  const logged = [...new Set(S.sessions.flatMap((s) => s.sets.map((x) => x.exerciseId)))];
  if (!chEx || !logged.includes(chEx)) chEx = logged[0];
  const load = {}, vol = {};
  S.sessions.forEach((s) => s.sets.filter((x) => x.exerciseId === chEx).forEach((x) => { load[s.epochDay] = Math.max(load[s.epochDay] || 0, x.weightKg); vol[s.epochDay] = (vol[s.epochDay] || 0) + x.weightKg * x.reps; }));
  const toPts = (o) => Object.entries(o).map(([d, v]) => ({ x: Number(d), y: v }));
  return `${top('Gráficos de progresso', { back: true })}<main class="stack">
    ${card(`<h3>Medidas corporais</h3>${chips(['Peso', 'Cintura', 'Quadril', 'Coxa', 'Braço', 'Cintura/Quadril'].map((x) => ({ id: x, label: x })), chMetric, (v) => { chMetric = v; render(); })}${lineChart(pts, chMetric === 'Peso' ? 'kg' : chMetric === 'Cintura/Quadril' ? '' : 'cm')}`)}
    ${card(`<h3>Frequência de treino (últimas 8 semanas)</h3>${barChart(['-7', '-6', '-5', '-4', '-3', '-2', '-1', 'atual'], weeks, 'treinos')}`)}
    ${card(`<h3>Evolução de desempenho (carga)</h3>${logged.length ? chips(logged.map((id) => ({ id, label: EX[id]?.name || id })), chEx, (v) => { chEx = v; render(); }) + lineChart(toPts(load), 'kg') + '<h4>Volume total (carga × repetições)</h4>' + lineChart(toPts(vol), 'kg', 'var(--plum)') : '<p>Registre treinos para ver a evolução das cargas.</p>'}`)}
  </main>`;
};

/* ---- check-in */
let ci = null;
routes.checkin = () => {
  if (!ci) ci = { a: { trainingAdherence: 3, pain: false, painArea: null, dietAdherence: 3, sleep: 3, recovery: 3, satisfaction: 3, dietDifficulty: 3, hunger: 3, difficulty: 3 }, recs: null, sel: {}, applied: null, id: null };
  const a = ci.a;
  const scale = (q, k, lo, hi) => `<div class="scale"><b>${q}</b><div class="row">${[1, 2, 3, 4, 5].map((n) => `<button class="dot ${a[k] === n ? 'on' : ''}" ${act(() => { a[k] = n; render(); })}>${n}</button>`).join('')}</div><div class="row"><small class="grow">${lo}</small><small>${hi}</small></div></div>`;
  let body;
  if (!ci.recs) {
    body = `<h2>Como foi sua última semana?</h2>
      ${scale('Está conseguindo cumprir os treinos?', 'trainingAdherence', 'quase nenhum', 'todos')}${scale('Os exercícios estão…', 'difficulty', 'muito fáceis', 'muito difíceis')}
      ${scale('Está conseguindo recuperar os músculos?', 'recovery', 'muito dolorida/cansada', 'bem recuperada')}${scale('Está dormindo bem?', 'sleep', 'muito mal', 'muito bem')}
      ${scale('Está conseguindo se alimentar adequadamente?', 'dietAdherence', 'não', 'sim, sempre')}${scale('Seguir a dieta está…', 'dietDifficulty', 'muito difícil', 'fácil')}
      ${scale('Como está sua fome?', 'hunger', 'pouca', 'muita')}${scale('Está satisfeita com a evolução?', 'satisfaction', 'nada', 'muito')}
      ${switchRow('Está sentindo dores (articulares/lesão)?', a.pain, () => { a.pain = !a.pain; if (!a.pain) a.painArea = null; render(); })}
      ${a.pain ? chips(OPTIONS.limitation, a.painArea, (v) => { a.painArea = v; render(); }) : ''}
      <button class="btn big" ${act(submitCheckin)}>Ver recomendações</button>`;
  } else {
    body = `<h2>Recomendações</h2><p>Escolha quais ajustes aplicar. Cada alteração cria uma nova versão do plano e a anterior fica no histórico.</p>
      ${ci.recs.map((r, i) => { const actionable = r.action !== 'NONE' && r.action !== 'SEE_PROFESSIONAL'; return card(`<label class="row top-align">${actionable && !ci.applied ? `<input type="checkbox" ${ci.sel[i] ? 'checked' : ''} ${act(() => { ci.sel[i] = !ci.sel[i]; })}>` : ''}<span class="grow"><b>${h(r.title)}</b><small>${h(r.reason)}</small></span></label>`); }).join('')}
      ${ci.applied == null ? `<button class="btn big" ${act(applyCheckin)}>Aplicar selecionadas</button>` : `${banner('Feito: ' + ci.applied)}<button class="btn big" ${act(() => { ci = null; go('home'); })}>Voltar ao início</button>`}`;
  }
  return `${top('Check-in', { back: true })}<main class="stack">${body}
    ${S.checkins.length ? '<h3>Check-ins anteriores</h3>' + [...S.checkins].reverse().slice(0, 10).map((c) => `<div class="list-row">💗 <span class="grow"><b>${epochLabel(c.epochDay)}</b><small>${h(c.applied || 'Sem ajustes aplicados')}</small></span></div>`).join('') : ''}</main>`;
};
function submitCheckin() {
  const w = S.measurements.filter((m) => m.weightKg != null && m.epochDay >= today() - 35).map((m) => ({ x: m.epochDay, y: m.weightKg }));
  ci.recs = api.recommend(ci.a, S.profile, w, activePlan('WORKOUT')?.setsDelta || 0);
  ci.recs.forEach((r, i) => { ci.sel[i] = r.action !== 'NONE' && r.action !== 'SEE_PROFESSIONAL'; });
  ci.id = uid();
  S.checkins.push({ id: ci.id, epochDay: today(), answers: ci.a, recs: ci.recs, applied: '' });
  save(); render();
}
/** Mesma regra do app Android (Repository.applyRecommendations). */
function applyCheckin() {
  const chosen = ci.recs.filter((_, i) => ci.sel[i]);
  const p = { ...S.profile };
  const workout = activePlan('WORKOUT'), diet = activePlan('DIET');
  let setsDelta = workout?.setsDelta || 0, cal = diet?.calorieOffset || 0, cw = false, cd = false;
  const reasons = [];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  for (const r of chosen) {
    switch (r.action) {
      case 'DELOAD': case 'REDUCE_SETS': setsDelta = clamp(setsDelta + r.value, -2, 2); cw = true; reasons.push(r.title); break;
      case 'ADD_SETS': setsDelta = clamp(setsDelta + r.value, -2, 1); cw = true; reasons.push(r.title); break;
      case 'ADD_LIMITATION': if (r.limitation) { p.limitations = [...new Set([...p.limitations, r.limitation])]; cw = true; reasons.push(r.title); } break;
      case 'REDUCE_DAYS': p.daysPerWeek = Math.max(2, p.daysPerWeek - 1); cw = true; reasons.push(r.title); break;
      case 'SHORTER_SESSIONS': p.minutesPerSession = Math.max(30, p.minutesPerSession + r.value); cw = true; reasons.push(r.title); break;
      case 'CALORIES_UP': case 'CALORIES_DOWN': cal = clamp(cal + r.value, -300, 400); cd = true; reasons.push(r.title); break;
      case 'SIMPLIFY_DIET': p.mealsPerDay = Math.max(3, p.mealsPerDay - 1); p.economic = true; p.prepMinutes = Math.min(p.prepMinutes, 15); cd = true; reasons.push(r.title); break;
    }
  }
  const summary = reasons.join('; ');
  S.profile = p;
  if (cw) { const wk = api.workout(p, setsDelta); savePlan('WORKOUT', wk, 'Check-in: ' + summary); const tr = S.schedule.find((s) => s.type === 'TRAINING'); if (tr) tr.daysMask = wk.days.reduce((a, d) => a | (1 << (d.weekday - 1)), 0); }
  if (cd) savePlan('DIET', api.diet(p, cal), 'Check-in: ' + summary);
  const rec = S.checkins.find((c) => c.id === ci.id); if (rec) rec.applied = summary || 'Nenhuma alteração';
  ci.applied = summary || 'Nenhuma alteração aplicada.';
  save(); render();
}

/* ---- histórico de planos */
routes.history = () => `${top('Histórico de planos', { back: true })}<main class="stack"><p>Cada alteração gera uma versão com o motivo. Você pode consultar ou voltar para qualquer uma.</p>
  ${[...S.plans].reverse().map((e) => card(`<small class="accent">${e.kind === 'WORKOUT' ? 'Treino' : 'Dieta'}${e.active ? ' • ATIVO' : ''}</small><b>${h(e.reason || 'Atualização')}</b><small>${new Date(e.createdAt).toLocaleString('pt-BR')}</small>`, e.active ? 'tint click' : 'click', act(() => {
    const o = JSON.parse(e.json);
    const txt = e.kind === 'WORKOUT' ? o.days.map((d) => `<p><b>${WD[d.weekday]} — ${h(d.title)}</b>: ${d.exercises.map((x) => `${h(EX[x.exerciseId]?.name)} ${x.sets}×${repsLabel(x)}`).join(', ')}</p>`).join('') : `<p><b>${o.targets.calories} kcal • P ${o.targets.proteinG} g • C ${o.targets.carbsG} g • G ${o.targets.fatG} g</b></p>${o.targets.explanation.map((x) => `<p class="small">${h(x)}</p>`).join('')}`;
    sheet(e.reason || 'Plano', txt + (e.active ? '' : '<button class="btn big" data-restore>Restaurar este plano</button>'), (d, close) => {
      d.querySelector('[data-restore]')?.addEventListener('click', () => { S.plans.forEach((p) => { if (p.kind === e.kind) p.active = p.id === e.id; }); save(); close(); render(); toast('Plano restaurado.'); });
    });
  }))).join('')}</main>`;

/* ---- 4. objetivo */
let goalSel = null;
routes.goal = () => {
  const p = S.profile; if (!goalSel) goalSel = p.goal;
  const prev = api.targets({ ...p, goal: goalSel }), safety = api.safety({ ...p, goal: goalSel });
  return `${top('Seu objetivo', { back: true })}<main class="stack">${optionCards(OPTIONS.goal, goalSel, (v) => { goalSel = v; render(); })}
    ${card(`<b>Prévia do novo plano</b><p>${prev.calories} kcal • ${prev.proteinG} g proteína • ${prev.carbsG} g carboidratos • ${prev.fatG} g gorduras</p><small>${h(prev.explanation[2] || '')}</small>`)}
    ${safety.warnings.map((w) => banner(w, true)).join('')}
    <button class="btn big" ${goalSel === p.goal ? 'disabled' : ''} ${act(() => { saveProfile({ ...p, goal: goalSel }, 'Objetivo alterado para ' + label('goal', goalSel)); goalSel = null; toast('Novo plano gerado!'); back(); })}>Aplicar e gerar novo plano</button>
    <small class="muted">Seu plano anterior fica salvo no histórico.</small></main>`;
};

/* ---- 5. avaliação física */
routes.assessment = () => {
  const p = S.profile; const bmi = api.bmi(p);
  const last = [...S.measurements].reverse()[0];
  const waist = last?.waistCm ?? p.waistCm, hip = last?.hipCm ?? p.hipCm;
  return `${top('Avaliação física', { back: true })}<main class="stack">
    ${card(`<h3>Situação atual</h3><p>Peso ${fmt1(p.weightKg)} kg • Altura ${fmt1(p.heightCm)} cm</p><p>IMC ${dec(bmi)} — ${bmiLabel(bmi)}</p>${waist ? `<p>Cintura ${fmt1(waist)} cm${waist / p.heightCm > 0.5 ? ' (relação cintura/altura acima de 0,5)' : ''}</p>` : ''}${waist && hip ? `<p>Relação cintura/quadril ${dec(waist / hip, 2)}</p>` : ''}<small>Estes indicadores são apenas referências populacionais e não substituem uma avaliação profissional (bioimpedância, dobras cutâneas, exames).</small>`)}
    ${card(`<h3>Como medir</h3>${['Pela manhã, em jejum, após ir ao banheiro.', 'Fita métrica firme, sem apertar a pele.', 'Cintura: na altura do umbigo, relaxada.', 'Quadril: na parte mais larga dos glúteos.', 'Coxa e braço: no ponto médio, sempre do mesmo lado.', 'Meça a cada 2–4 semanas.'].map((x) => `<p>• ${x}</p>`).join('')}`)}
    <button class="btn big" ${act(measureSheet)}>Registrar nova avaliação</button>
    <button class="btn outline" ${act(() => { saveProfile(p, `Plano recalculado com o peso atual (${fmt1(p.weightKg)} kg)`); toast('Plano recalculado!'); })}>Recalcular meu plano com o peso atual</button>
  </main>`;
};

/* ---- 17. perfil */
routes.profile = () => {
  const p = S.profile; const info = (l, v) => `<div class="info"><b>${l}</b><span>${h(v)}</span></div>`;
  return `${top('Meu perfil', { back: true })}<main class="stack">
    ${card(`<h2>${h(p.name)}</h2><p>${h(S.account?.email)}</p><b>${h(label('goal', p.goal))} • ${h(label('experience', p.experience))}</b>`, 'hero')}
    ${card(info('Idade', p.age + ' anos') + info('Altura', fmt1(p.heightCm) + ' cm') + info('Peso', fmt1(p.weightKg) + ' kg') + info('IMC', `${dec(api.bmi(p))} (${bmiLabel(api.bmi(p))})`) +
      info('Treinos', `${p.daysPerWeek}x/semana • ${p.minutesPerSession} min • ${label('location', p.location)}`) + info('Dias', [...p.availableDays].sort().map((d) => WD[d]).join(', ')) +
      info('Prioridades', [...p.bodyGoals.map((x) => label('bodyGoal', x)), ...p.priorityMuscles.map((x) => label('muscle', x))].join(', ') || '—') +
      info('Limitações', p.limitations.map((x) => label('limitation', x)).join(', ') || 'nenhuma') + info('Refeições', `${p.mealsPerDay}/dia • orçamento R$ ${p.monthlyBudget}/mês`) +
      info('Restrição', label('restriction', p.restriction)) + info('Alergias', p.allergies.map((x) => label('allergy', x)).join(', ') || 'nenhuma') + info('Rotina', `acorda ${p.wakeTime} • dorme ${p.sleepTime} • treina ${p.trainTime}`))}
    <button class="btn big" ${act(() => { draft = null; go('onboarding/edit'); })}>✏️ Refazer questionário / editar</button>
    <button class="btn outline" ${act(() => go('goal'))}>Alterar apenas o objetivo</button>
  </main>`;
};

/* ---- 18. notificações */
routes.notifications = () => {
  setTimeout(() => { if (S.notifications.some((n) => !n.read)) { S.notifications.forEach((n) => (n.read = true)); save(); } }, 600);
  return `${top('Notificações', { back: true, actions: `<button class="icon" ${act(() => go('calendar'))} aria-label="Configurar lembretes">⚙️</button>${S.notifications.length ? `<button class="icon" ${act(() => { S.notifications = []; save(); render(); })} aria-label="Limpar">🧹</button>` : ''}` })}<main class="stack">
    ${S.notifications.length ? [...S.notifications].reverse().map((n) => card(`<b>${h(n.title)}</b><p>${h(n.body)}</p><small class="muted">${new Date(n.time).toLocaleString('pt-BR')}</small>`, n.read ? '' : 'tint')).join('')
      : card(`<p><b>Nenhuma notificação ainda.</b></p><p class="small">Os lembretes da sua rotina aparecem aqui quando o app está aberto. Para recebê-los com o app fechado, ative os lembretes em Configurações.</p><button class="btn" ${act(testNotification)}>Enviar notificação de teste</button>`)}
  </main>`;
};

/* ---- menu Mais */
routes.more = () => {
  const row = (icon, t, sub, route) => `<button class="list-row" ${act(() => go(route))}><span class="ic">${icon}</span><span class="grow"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>›</button>`;
  const unread = S.notifications.filter((n) => !n.read).length;
  return `${top('Mais')}<main class="stack">
    <h3>Rotina</h3>${row('📅', 'Calendário e rotina diária', 'Horários de refeições, treino, água e sono', 'calendar')}${row('💧', 'Controle de água', '', 'water')}${row('🔔', 'Central de notificações', unread ? unread + ' nova(s)' : '', 'notifications')}
    <h3>Plano</h3>${row('💗', 'Check-in semanal', 'Ajuste seu plano conforme você se sente', 'checkin')}${row('🎯', 'Alterar objetivo', 'Emagrecer, ganhar massa, recompor…', 'goal')}${row('📏', 'Avaliação física', 'Atualizar peso e medidas', 'assessment')}${row('🕘', 'Histórico de planos', 'Consulte e restaure planos anteriores', 'history')}${row('📖', 'Biblioteca de exercícios', '', 'library')}${row('🍽', 'Receitas e substituições', '', 'recipes')}${row('🛒', 'Lista de compras', '', 'shopping')}${row('📈', 'Gráficos de progresso', '', 'charts')}
    <h3>Conta</h3>${row('👤', 'Meu perfil', 'Dados pessoais e respostas do questionário', 'profile')}${row('⚙️', 'Configurações', 'Tema, lembretes, privacidade, backup', 'settings')}
  </main>`;
};

/* ---- 16. configurações */
routes.settings = () => {
  const st = S.settings;
  const exportData = async () => {
    const photos = {};
    for (const p of S.photos) { const b = await photoGet(p.id); if (b) photos[p.id] = await blobToDataUrl(b); }
    const data = JSON.stringify({ app: 'aurea', version: 1, exportedAt: Date.now(), state: S, photos });
    if (NATIVE) { S.lastBackupAt = Date.now(); save(); try { await nativeShareFile(`aurea-backup-${new Date().toISOString().slice(0, 10)}.json`, data); } catch (e) {} return; }
    S.lastBackupAt = Date.now(); save();
    const file = new File([data], `aurea-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
    try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Backup Áurea' }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); toast('Backup gerado.');
  };
  const importData = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      try {
        const o = JSON.parse(await inp.files[0].text());
        if (o.app !== 'aurea' || !o.state) throw 0;
        if (!(await confirmBox('Restaurar backup?', 'Os dados atuais deste aparelho serão substituídos pelos do arquivo.', 'Restaurar', true))) return;
        await clearAll();
        for (const [id, url] of Object.entries(o.photos || {})) await photoSet(id, await (await fetch(url)).blob());
        replaceState(o.state); S = getState(); await saveNow(); toast('Backup restaurado.'); go('home');
      } catch (e) { toast('Arquivo de backup inválido.'); }
    };
    inp.click();
  };
  const changePw = () => sheet('Alterar senha', `${field('Senha atual', 'id="pwOld" type="password"')}${field('Nova senha', 'id="pwNew" type="password"')}<p class="err" id="pwErr"></p><button class="btn big" data-ok>Salvar</button>`, (d, close) => {
    d.querySelector('[data-ok]').onclick = async () => {
      const o = d.querySelector('#pwOld').value, n = d.querySelector('#pwNew').value;
      if ((await hashPassword(o, S.account.salt)) !== S.account.hash) return (d.querySelector('#pwErr').textContent = 'Senha atual incorreta.');
      if (n.length < 6) return (d.querySelector('#pwErr').textContent = 'A nova senha precisa ter pelo menos 6 caracteres.');
      const salt = newSalt(); S.account.salt = salt; S.account.hash = await hashPassword(n, salt); await saveNow(); close(); toast('Senha alterada.');
    };
  });
  const row = (icon, t, sub, fn, trailing = '') => `<div class="list-row ${fn ? 'click' : ''}" ${fn ? act(fn) : ''}><span class="ic">${icon}</span><span class="grow"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>${trailing}</div>`;
  return `${top('Configurações', { back: true })}<main class="stack">
    <h3>Aparência</h3>${chips([{ id: 0, label: 'Automático' }, { id: 1, label: 'Claro' }, { id: 2, label: 'Escuro' }], st.themeMode, (v) => { st.themeMode = v; applyTheme(); save(); render(); })}
    <h3>Lembretes</h3>
    ${pushCard()}
    ${row('🔔', 'Avisos com o app aberto', 'Mostra os lembretes dentro do app quando ele está aberto', null, `<input type="checkbox" class="toggle" ${st.notifications ? 'checked' : ''} ${act(() => { st.notifications = !st.notifications; save(); if (st.notifications) askNotifications(); })}>`)}
    ${row('📅', 'Adicionar rotina ao Calendário', 'Cópia da rotina com alertas no app Calendário', exportIcs)}
    
    <h3>Privacidade e bem-estar</h3>
    ${row('🙈', 'Ocultar calorias', 'Mostra só porções e macronutrientes', null, `<input type="checkbox" class="toggle" ${st.hideCalories ? 'checked' : ''} ${act(() => { st.hideCalories = !st.hideCalories; save(); })}>`)}
    <h3>Backup e exportação</h3>
    ${card(`<p class="small">Seus dados ficam só neste aparelho. Para ter uma cópia de segurança, exporte um arquivo e salve onde quiser (Arquivos, iCloud Drive, Google Drive…). Nenhum envio automático é feito.</p><button class="btn" ${act(exportData)}>💾 Exportar meus dados / fazer backup</button><button class="btn outline" ${act(importData)}>♻️ Restaurar backup</button>`)}
    <p class="small muted" id="persistInfo"></p>
    <h3>Conta</h3>
    ${row('🔑', 'Alterar senha', '', changePw)}
    ${row('🚪', 'Sair da conta', 'Seus dados continuam salvos neste aparelho', () => { S.loggedIn = false; save(); go('auth/login'); })}
    ${row('🗑', 'Excluir conta e todos os dados', 'Apaga permanentemente perfil, planos, registros, fotos e lembretes', async () => {
      if (await confirmBox('Excluir tudo?', 'Esta ação não pode ser desfeita. Faça um backup antes, se quiser guardar seus dados.', 'Excluir definitivamente', true)) { if (S.push?.enabled) await disablePush(); await clearAll(); location.hash = ''; location.reload(); }
    })}
    <h3>Sobre</h3><p class="small muted">Áurea 1.0 (web) — aplicativo educativo de treino e alimentação. Não substitui médico(a), nutricionista ou educador(a) físico(a). Cálculos: Mifflin-St Jeor (gasto basal), proteína 1,6–2,0 g/kg, tabela TACO (alimentos). Mesmas regras do app Android.</p>
  </main>`;
};
const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });


/* ======================================================================== lembretes push (iPhone 16.4+) */
const isPushCapable = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function pushStatus() {
  if (NATIVE) return S.push?.enabled && S.push?.native ? 'active' : S.push?.denied ? 'denied' : 'off';
  if (S.push?.enabled && isPushCapable() && Notification.permission === 'granted') return 'active';
  if (isIOS && !standalone()) return 'install';
  if (!isPushCapable()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'off';
}
const b64uToBytes = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const pushPayload = (extra = {}) => ({ id: S.push.id, subscription: S.push.subscription, schedule: S.schedule, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo', ...extra });
async function enablePush() {
  if (NATIVE) return enableNative();
  try {
    const perm = await Notification.requestPermission(); // precisa vir direto do toque (regra do iPhone)
    if (perm !== 'granted') { toast('Permissão negada. Ative em Ajustes → Notificações → Áurea.'); render(); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await (await fetch('/api/push')).json();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(publicKey) });
    }
    S.push = { enabled: true, id: S.push?.id || (uid() + uid()).replace(/[^a-z0-9]/g, '').slice(0, 24), subscription: sub.toJSON(), lastSync: JSON.stringify(S.schedule) };
    const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pushPayload({ test: true })) });
    if (!r.ok) { S.push.enabled = false; throw new Error('servidor ' + r.status); }
    rawSave();
    toast('Lembretes ativados! Você vai receber uma notificação de teste agora.');
  } catch (e) { console.error(e); toast('Não foi possível ativar os lembretes (' + (e.message || e) + '). Verifique a internet e tente novamente.'); }
  render();
}
async function disablePush() {
  if (NATIVE) { try { await cancelNative(); } catch (e) {} S.push = { enabled: false }; rawSave(); toast('Lembretes desativados.'); render(); return; }
  try { await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: S.push.id }) }); } catch (e) {}
  try { const reg = await navigator.serviceWorker.ready; (await reg.pushManager.getSubscription())?.unsubscribe(); } catch (e) {}
  S.push = { enabled: false, id: S.push?.id }; rawSave(); toast('Lembretes com o app fechado desativados.'); render();
}
async function testPush() {
  if (NATIVE) { await nativeTest(); return; }
  try { const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pushPayload({ test: true })) }); toast(r.ok ? 'Teste enviado — a notificação chega em alguns segundos.' : 'Falha no teste (' + r.status + ').'); } catch (e) { toast('Sem internet para enviar o teste.'); }
}
let pushTimer;
function maybeSyncPush() {
  if (!S?.push?.enabled) return;
  if (NATIVE) { clearTimeout(pushTimer); pushTimer = setTimeout(() => { if (JSON.stringify(S.schedule) !== S.push.lastSync) scheduleNative().catch(console.error); }, 800); return; }
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const snap = JSON.stringify(S.schedule);
    if (snap === S.push.lastSync) return;
    try { const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pushPayload()) }); if (r.ok) { S.push.lastSync = snap; rawSave(); } } catch (e) { /* sincroniza na próxima vez que houver internet */ }
  }, 1500);
}
window.addEventListener('online', () => { if (S?.push) { S.push.lastSync = ''; maybeSyncPush(); } });

/** Cartão explicando e ativando os lembretes, conforme a situação do aparelho. */
function pushCard(compact = false) {
  const st = pushStatus();
  const body = {
    active: `<b>✅ Lembretes ativos, mesmo com o app fechado</b><p class="small">Refeições, treino, água, pausa, sono e check-in chegam como notificação no horário da sua rotina. Ao editar horários no Calendário, os lembretes são atualizados${NATIVE ? ' automaticamente — funcionam até sem internet' : ' (precisa de internet)'}.</p><div class="row wrap"><button class="btn tonal" ${act(testPush)}>Enviar teste</button><button class="btn text" ${act(disablePush)}>Desativar</button></div>`,
    off: `<b>🔔 Receba os lembretes da sua rotina</b><p class="small">Ative para receber notificações de refeições, treino, água e sono — inclusive com o app fechado.</p><button class="btn" ${act(enablePush)}>Ativar lembretes</button>`,
    install: `<b>🔔 Para receber lembretes no iPhone</b><p class="small">1. No <b>Safari</b>, toque em <b>Compartilhar</b> (↑) → <b>Adicionar à Tela de Início</b>.<br>2. Abra o Áurea pelo <b>ícone</b> criado.<br>3. Volte aqui e toque em <b>Ativar lembretes</b>.</p><p class="small muted">O iPhone só permite notificações de apps instalados na Tela de Início (iOS 16.4 ou mais novo). Seus dados continuam neste aparelho.</p>`,
    unsupported: `<b>🔔 Lembretes</b><p class="small">Este aparelho/navegador não aceita notificações de web apps. No iPhone, atualize para o <b>iOS 16.4 ou mais novo</b> e use o app pela Tela de Início. Enquanto isso, use <b>Adicionar rotina ao Calendário</b>.</p>`,
    denied: `<b>🔕 Notificações bloqueadas</b><p class="small">Abra <b>Ajustes → Notificações → Áurea</b> e ative <b>Permitir Notificações</b>. Depois volte aqui e toque em Ativar.</p><button class="btn tonal" ${act(enablePush)}>Tentar novamente</button>`
  }[st];
  if (compact && st === 'active') return '';
  return card(body, st === 'active' ? '' : 'tint');
}


/* ======================================================================== lembretes nativos (app de iPhone) */
const nativeWeekday = (d) => (d % 7) + 1; // nosso 1=segunda..7=domingo → iOS 1=domingo..7=sábado
async function cancelNative() {
  const LN = CAP.LocalNotifications; if (!LN) return;
  const pend = await LN.getPending();
  if (pend?.notifications?.length) await LN.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
}
async function scheduleNative() {
  const LN = CAP.LocalNotifications; if (!LN) return;
  await cancelNative();
  const list = []; let id = 1;
  for (const s of S.schedule) {
    if (!s.enabled) continue;
    const [hour, minute] = s.time.split(':').map(Number);
    const [title, body] = (REM[s.type] || ((l) => ['Áurea', l]))(s.label);
    if ((s.daysMask & 127) === 127) list.push({ id: id++, title, body, schedule: { on: { hour, minute }, allowWhileIdle: true } });
    else for (let d = 1; d <= 7; d++) if (s.daysMask & (1 << (d - 1))) list.push({ id: id++, title, body, schedule: { on: { weekday: nativeWeekday(d), hour, minute }, allowWhileIdle: true } });
  }
  if (list.length > 60) list.length = 60; // o iOS guarda até 64 lembretes agendados por app
  if (list.length) await LN.schedule({ notifications: list });
  S.push.lastSync = JSON.stringify(S.schedule); rawSave();
}
async function nativeTest() {
  await CAP.LocalNotifications?.schedule({ notifications: [{ id: 9001, title: 'Lembretes ativados ✨', body: 'É assim que o Áurea vai lembrar você das refeições, treinos e hidratação.', schedule: { at: new Date(Date.now() + 4000) } }] });
  toast('Teste agendado — chega em alguns segundos.');
}
async function enableNative() {
  const LN = CAP.LocalNotifications;
  if (!LN) { toast('Lembretes indisponíveis neste aparelho.'); return; }
  try {
    const perm = await LN.requestPermissions();
    if (perm.display !== 'granted') { S.push = { enabled: false, denied: true }; rawSave(); toast('Permissão negada. Ative em Ajustes → Notificações → Áurea.'); render(); return; }
    S.push = { enabled: true, native: true, lastSync: '' };
    await scheduleNative();
    await nativeTest();
    toast('Lembretes ativados! Funcionam mesmo sem internet.');
  } catch (e) { console.error(e); toast('Não foi possível ativar os lembretes: ' + (e.message || e)); }
  render();
}
/** Compartilha um arquivo pelo menu do iOS (Salvar em Arquivos, iCloud Drive, AirDrop, Calendário…). */
async function nativeShareFile(name, text) {
  const r = await CAP.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
  await CAP.Share.share({ title: name, url: r.uri, dialogTitle: name });
}

/** Abre a rotina no app Calendário (no iPhone, o Safari oferece "Adicionar Todos"). */
function icsLink() {
  const json = JSON.stringify(S.schedule.map(({ id, type, label, time, daysMask, enabled }) => ({ id, type, label, time, daysMask, enabled })));
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return '/api/ics?d=' + b64;
}

/* ======================================================================== lembretes (app aberto) */
async function askNotifications() {
  try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) {}
}
const REM = {
  WAKE: (l) => ['Bom dia! ☀️', l], MEAL: (l) => ['Hora da refeição: ' + l, 'Confira o que está no seu cardápio de hoje.'],
  TRAINING: () => ['Hora do treino! 💪', 'Seu treino de hoje está pronto. Cada sessão conta.'], WATER: () => ['Hidratação 💧', 'Beba um copo de água e registre no app.'],
  REST: (l) => ['Pausa', l], SLEEP: () => ['Hora de desacelerar 🌙', 'Dormir bem ajuda na recuperação muscular e no controle da fome.'],
  CHECKIN: () => ['Check-in semanal', 'Conte como foi sua semana para ajustarmos seu plano.']
};
async function notify(title, body) {
  S.notifications.push({ id: uid(), time: Date.now(), title, body, read: false });
  if (S.notifications.length > 200) S.notifications.splice(0, S.notifications.length - 200);
  save();
  toast(title + ' — ' + body);
  try {
    if ('Notification' in window && Notification.permission === 'granted' && pushStatus() !== 'active') {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
      else new Notification(title, { body });
    }
  } catch (e) {}
}
function testNotification() { askNotifications().then(() => notify('Lembretes ativados ✨', 'É assim que o Áurea vai lembrar você das refeições, treinos e hidratação.')); }
function checkReminders() {
  if (!S?.profile || !S.settings.notifications) return;
  const now = new Date(), wd = weekdayOf(now), nowMin = now.getHours() * 60 + now.getMinutes();
  const dayKey = now.toISOString().slice(0, 10);
  for (const s of S.schedule) {
    if (!s.enabled || !(s.daysMask & (1 << (wd - 1)))) continue;
    const t = minutesOf(s.time);
    if (nowMin >= t && nowMin - t <= 5 && S.lastReminder[s.id] !== dayKey) {
      S.lastReminder[s.id] = dayKey;
      const [title, body] = (REM[s.type] || ((l) => ['Áurea', l]))(s.label);
      notify(title, body);
    }
  }
}

/* ======================================================================== renderização */
const TABS = [['home', '🏠', 'Início'], ['workout', '🏋️', 'Treino'], ['diet', '🍽', 'Dieta'], ['evolution', '📈', 'Evolução'], ['more', '☰', 'Mais']];
function render() {
  actions = {}; actSeq = 0;
  const [name, ...args] = (location.hash.replace(/^#\/?/, '') || 'splash').split('/');
  const guard = !S.account ? ['auth', 'splash'] : !S.loggedIn ? ['auth', 'splash'] : !S.profile ? ['onboarding', 'splash', 'auth'] : null;
  if (guard && !guard.includes(name)) return go(guard[0] === 'auth' ? (S.account ? 'auth/login' : 'auth/register') : guard[0]);
  const fn = routes[name] || routes.home;
  let html;
  try { html = fn(...args); } catch (e) { console.error(e); html = `${top('Ops', { back: true })}<main>${card(`<p>Algo deu errado ao abrir esta tela.</p><small>${h(e.message)}</small>`)}</main>`; }
  const showTabs = TABS.some((t) => t[0] === name);
  app.innerHTML = `<div class="screen ${showTabs ? 'with-tabs' : ''}">${html}</div>${showTabs ? `<nav class="tabs-bar">${TABS.map(([r, i, l]) => `<button class="${r === name ? 'on' : ''}" ${act(() => go(r))}><span>${i}</span><small>${l}</small></button>`).join('')}</nav>` : ''}`;
  mountAnimations(app);
  if (name === 'evolution') loadPhotoThumbs();
  if (name === 'settings') navigator.storage?.persisted?.().then((ok) => { const el = document.getElementById('persistInfo'); if (el) el.textContent = ok ? '🔒 Armazenamento protegido: o iPhone não apaga seus dados automaticamente.' : 'Dica: use o app pela Tela de Início e faça backups de vez em quando para proteger seus dados.'; });
}

// Delegação de eventos (cliques e campos)
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) { if (el.tagName === 'BUTTON') e.preventDefault(); actions[el.dataset.act](e); }
});
app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.bind && draft) {
    const v = t.value;
    draft[t.dataset.bind] = t.dataset.type === 'text' ? v : t.dataset.type === 'opt' ? (v === '' ? null : Number(v.replace(',', '.')) || null) : t.dataset.type === 'int' ? parseInt(v, 10) || 0 : Number(v.replace(',', '.')) || 0;
    const err = validate(stepIdx, draft); const btn = document.getElementById('nextBtn');
    if (btn) btn.disabled = !!err;
    const errEl = document.querySelector('.onb-bottom .err'); if (errEl) errEl.textContent = err || '';
  }
  if (t.dataset.sess && session) { const [ei, si, k] = t.dataset.sess.split('.'); session.items[ei].sets[si][k] = t.value; }
  if (t.dataset.rpe && session) { const it = session.items[t.dataset.rpe]; it.rpe = Number(t.value); document.getElementById('rpe' + t.dataset.rpe).textContent = `${it.rpe}/10 ${rpeLabel(it.rpe)}`; }
  if (t.id === 'libq') { libQuery = t.value; clearTimeout(t._tm); t._tm = setTimeout(() => { render(); const q = document.getElementById('libq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 350); }
});
app.addEventListener('change', (e) => { if (e.target.dataset.bind && draft && e.target.type === 'time') render(); });
bindCharts(app);

function applyTheme() { document.documentElement.dataset.theme = ['auto', 'light', 'dark'][S.settings.themeMode] || 'auto'; }

async function start() {
  S = await loadState();
  applyTheme();
  window.addEventListener('hashchange', render);
  render();
  setInterval(checkReminders, 30000); checkReminders();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(); if (['home', 'diet', 'water'].includes(location.hash.split('/')[1])) render(); } });
  if (!NATIVE && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  try { if (S.account) navigator.storage?.persist?.(); } catch (e) {}
  maybeSyncPush();
}
start();
