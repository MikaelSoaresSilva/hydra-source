// Utilidades comuns às funções (validação e textos dos lembretes).
export const TYPES = ['WAKE', 'MEAL', 'TRAINING', 'WATER', 'REST', 'SLEEP', 'CHECKIN', 'CUSTOM'];

/** Aceita somente os campos necessários de cada lembrete (nada de dados pessoais). */
export function cleanSchedule(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 60).map((s) => ({
    id: String(s.id ?? '').slice(0, 24),
    type: TYPES.includes(s.type) ? s.type : 'CUSTOM',
    label: String(s.label ?? '').slice(0, 80),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) ? s.time : null,
    daysMask: Number.isInteger(s.daysMask) ? s.daysMask & 127 : 0,
    enabled: s.enabled !== false
  })).filter((s) => s.id && s.time && s.daysMask);
}

export function reminderText(type, label) {
  switch (type) {
    case 'WAKE': return ['Bom dia! ☀️', label];
    case 'MEAL': return ['Hora da refeição: ' + label, 'Confira o que está no seu cardápio de hoje.'];
    case 'TRAINING': return ['Hora do treino! 💪', 'Seu treino de hoje está pronto. Cada sessão conta.'];
    case 'WATER': return ['Hidratação 💧', 'Beba um copo de água e registre no app.'];
    case 'REST': return ['Pausa', label];
    case 'SLEEP': return ['Hora de desacelerar 🌙', 'Dormir bem ajuda na recuperação muscular e no controle da fome.'];
    case 'CHECKIN': return ['Check-in semanal', 'Conte como foi sua semana para ajustarmos seu plano.'];
    default: return ['Áurea', label];
  }
}

export function validTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** Data/hora local num fuso: { date:'2026-11-22', minutes: 450, weekday: 1..7 } */
export function localNow(tz, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23'
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday: wd };
}

/** Lembretes que devem tocar agora (janela de 10 min, uma vez por dia). */
export function dueItems(record, now = new Date()) {
  const { date, minutes, weekday } = localNow(record.tz, now);
  const sent = record.sent || {};
  return record.schedule.filter((s) => {
    if (!s.enabled || !(s.daysMask & (1 << (weekday - 1)))) return false;
    const [h, m] = s.time.split(':').map(Number);
    const t = h * 60 + m;
    return minutes >= t && minutes - t < 10 && sent[s.id] !== date;
  }).map((s) => ({ ...s, date }));
}
