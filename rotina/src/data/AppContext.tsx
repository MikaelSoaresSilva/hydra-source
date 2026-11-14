import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { buildDay, normBed, windowFor } from '../domain/scheduler';
import { addDays, minutesOf, todayISO } from '../domain/time';
import { syncDayLog, toggleDone, unlockAchievements, type Achievement } from '../domain/progress';
import type { State } from '../domain/types';
import { loadState, saveState } from './store';
import { reschedule, setupNotifications } from './notify';

/**
 * "Dia da rotina" de agora: depois da meia-noite, se você ainda está no horário antes de dormir
 * de ontem (ex.: dorme à 00:30), o dia ainda é ontem e os minutos passam de 1440.
 */
export function planDayFor(state: State, now: Date): { date: string; nowMin: number } {
  const today = todayISO(now);
  const m = minutesOf(now);
  const y = addDays(today, -1);
  const ybed = normBed(windowFor(state, y));
  if (ybed > 1440 && m + 1440 < ybed && m < windowFor(state, today).wake) return { date: y, nowMin: m + 1440 };
  return { date: today, nowMin: m };
}

interface Ctx {
  state: State;
  update: (fn: (s: State) => State) => void;
  now: Date;
  day: { date: string; nowMin: number };
  toast: (msg: string, gold?: boolean) => void;
  toggle: (date: string, activityId: string) => void;
  snooze: (date: string, activityId: string) => void;
  undo: (() => void) | null;
  setUndo: (s: State | null) => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('sem AppProvider'); return c; };

export function AppProvider({ children, initial }: { children: ReactNode; initial?: State }) {
  const [state, setState] = useState<State | null>(initial ?? null);
  const [now, setNow] = useState(() => new Date());
  const [toastMsg, setToastMsg] = useState<{ msg: string; gold: boolean } | null>(null);
  const [undoState, setUndoState] = useState<State | null>(null);
  const stateRef = useRef<State | null>(state);
  stateRef.current = state;

  const toast = useCallback((msg: string, gold = false) => {
    setToastMsg({ msg, gold });
    setTimeout(() => setToastMsg((t) => (t?.msg === msg ? null : t)), 3200);
  }, []);

  const commit = useCallback((next: State) => {
    const today = planDayFor(next, new Date()).date;
    let s = syncDayLog(next, today);
    const r = unlockAchievements(s, today);
    s = r.state;
    r.unlocked.forEach((a: Achievement, i) => setTimeout(() => toast(`🏆 Conquista: ${a.title} (+50 XP)`, true), 400 + i * 3300));
    stateRef.current = s;
    setState(s);
    void saveState(s);
  }, [toast]);

  const update = useCallback((fn: (s: State) => State) => {
    const cur = stateRef.current;
    if (cur) commit(fn(cur));
  }, [commit]);

  // Carrega do aparelho.
  useEffect(() => {
    if (state) return;
    void loadState().then((s) => commit(s));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Relógio (atualiza a cada 15 s e ao voltar para o app).
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    const vis = () => { if (document.visibilityState === 'visible') setNow(new Date()); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);

  const toggle = useCallback((date: string, activityId: string) => {
    const s = stateRef.current;
    if (!s) return;
    const item = buildDay(s, date).items.find((i) => i.activity.id === activityId);
    if (!item) return;
    const d = new Date();
    const pd = planDayFor(s, d);
    const nowMin = pd.date === date ? pd.nowMin : date < pd.date ? 9999 : -9999;
    const wasDone = !!s.completions[date]?.[activityId];
    const next = toggleDone(s, date, item, d, nowMin);
    const key = `${date}|${activityId}`;
    if (next.snoozes[key]) { const sn = { ...next.snoozes }; delete sn[key]; next.snoozes = sn; }
    commit(next);
    if (!wasDone) toast(`✅ ${item.activity.title} · +${next.completions[date][activityId].xp} XP`);
  }, [commit, toast]);

  const snooze = useCallback((date: string, activityId: string) => {
    const s = stateRef.current;
    if (!s) return;
    const at = Date.now() + s.settings.snoozeMin * 60000;
    commit({ ...s, snoozes: { ...s.snoozes, [`${date}|${activityId}`]: at } });
    toast(`⏰ Lembro de novo em ${s.settings.snoozeMin} min`);
  }, [commit, toast]);

  // Botões da notificação (Concluir / Adiar) funcionam mesmo com o app fechado: o Android abre o app e entrega a ação.
  // Se o app foi aberto pelo botão da notificação, a ação pode chegar antes de a rotina carregar: fica na fila.
  const queue = useRef<{ actionId: string; date: string; activityId: string }[]>([]);
  const handle = useCallback((a: { actionId: string; date: string; activityId: string }) => {
    if (!stateRef.current) { queue.current.push(a); return; }
    if (a.actionId === 'done') { if (!stateRef.current.completions[a.date]?.[a.activityId]) toggle(a.date, a.activityId); }
    else if (a.actionId === 'snooze') snooze(a.date, a.activityId);
  }, [toggle, snooze]);
  const handleRef = useRef(handle);
  handleRef.current = handle;
  useEffect(() => { void setupNotifications((a) => handleRef.current(a)); }, []);
  useEffect(() => {
    if (!state || !queue.current.length) return;
    const q = queue.current; queue.current = [];
    q.forEach((a) => handle(a));
  }, [state, handle]);

  // Reagenda os lembretes quando a rotina muda (com uma pequena espera para juntar várias mudanças).
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => { void reschedule(state); }, Capacitor.isNativePlatform() ? 800 : 200);
    return () => clearTimeout(t);
  }, [state]);

  // Virou o dia / atualizou o planejado de hoje.
  const day = useMemo(() => (state ? planDayFor(state, now) : { date: todayISO(now), nowMin: minutesOf(now) }), [state, now]);
  useEffect(() => {
    if (!state) return;
    const s = syncDayLog(state, day.date);
    if (s !== state) commit(s);
  }, [day.date]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <div className="main"><p className="muted">Carregando sua rotina…</p></div>;
  const value: Ctx = {
    state, update, now, day, toast, toggle, snooze,
    undo: undoState ? () => { commit(undoState); setUndoState(null); toast('↩️ Alteração desfeita'); } : null,
    setUndo: setUndoState,
  };
  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastMsg && <div className={`toast ${toastMsg.gold ? 'gold' : ''}`} role="status">{toastMsg.msg}</div>}
    </AppCtx.Provider>
  );
}
