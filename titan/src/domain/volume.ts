import { EXERCISE_BY_KEY } from './exercises';
import type { Muscle, SetLogRow } from './types';

/** Volume real: séries efetivas (primário = 1, secundário = 0,5) entre datas [from, to]. */
export function weeklyVolume(logs: SetLogRow[], from: string, to: string): Partial<Record<Muscle, number>> {
  const vol: Partial<Record<Muscle, number>> = {};
  for (const l of logs) {
    const d = l.logged_at.slice(0, 10);
    if (l.kind !== 'working' || d < from || d > to) continue;
    const ex = EXERCISE_BY_KEY[l.exercise_key];
    if (!ex) { vol[l.muscle as Muscle] = (vol[l.muscle as Muscle] ?? 0) + 1; continue; }
    vol[ex.primary] = (vol[ex.primary] ?? 0) + 1;
    ex.secondary.forEach((m) => { vol[m] = (vol[m] ?? 0) + 0.5; });
  }
  return vol;
}

/** Em quantos dias distintos o músculo recebeu séries diretas no período. */
export function frequency(logs: SetLogRow[], muscle: Muscle, from: string, to: string): number {
  const days = new Set<string>();
  for (const l of logs) {
    const d = l.logged_at.slice(0, 10);
    if (l.kind === 'working' && d >= from && d <= to && EXERCISE_BY_KEY[l.exercise_key]?.primary === muscle) days.add(d);
  }
  return days.size;
}
