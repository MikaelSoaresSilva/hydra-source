// Datas e horários sem depender do fuso do aparelho para a lógica: datas ISO (AAAA-MM-DD)
// e horários em minutos desde a meia-noite (podem passar de 1440 quando o sono vira o dia).

export const pad = (n: number) => String(n).padStart(2, '0');

/** 450 → "07:30"; 1470 → "00:30". */
export function hm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** "07:30" → 450. Retorna null se inválido. */
export function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]); const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 0 = domingo … 6 = sábado. */
export function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const isWeekend = (iso: string) => [0, 6].includes(weekday(iso));

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAY_LONG[weekday(iso)]}, ${d} de ${MONTHS[m - 1]} de ${y}`;
}

export const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Minutos desde a meia-noite (local) de um Date. */
export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** Date local para (data ISO, minutos — pode passar de 1440). */
export function dateAt(iso: string, min: number): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 0, min, 0, 0);
}

/** Dias da semana da data (seg = 1) até domingo, no formato ISO. */
export function weekDates(iso: string): string[] {
  const wd = weekday(iso);
  const monday = addDays(iso, wd === 0 ? -6 : 1 - wd);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
