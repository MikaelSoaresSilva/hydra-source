import { create } from 'zustand';
import type { GameState } from '../core/types';
import { dailyTick, maybeSurprise, newGame, type Ev, type GameEvent } from '../core/engine';
import { migrate } from '../core/save';

const KEY = 'life-leveling:save';
const BACKUP_KEY = 'life-leveling:backups';

export function loadSave(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.error('Falha ao ler o save', e);
    // Tenta o backup automático mais recente
    try {
      const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]') as { at: string; data: string }[];
      if (backups[0]) return migrate(JSON.parse(backups[0].data));
    } catch { /* sem backup */ }
  }
  return newGame();
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastBackupDay = '';
export function persist(s: GameState) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeNow(s), 150);
}

export function writeNow(s: GameState) {
  try {
    const json = JSON.stringify(s);
    localStorage.setItem(KEY, json);
    // Backup automático diário (mantém os 3 últimos)
    const day = new Date().toDateString();
    if (day !== lastBackupDay) {
      lastBackupDay = day;
      const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]') as { at: string; data: string }[];
      if (!backups[0] || backups[0].at.slice(0, 10) !== new Date().toISOString().slice(0, 10)) {
        backups.unshift({ at: new Date().toISOString(), data: json });
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, 3)));
      }
    }
  } catch (e) {
    console.error('Falha ao salvar', e);
    useGame.getState().pushEvents([{ kind: 'error', text: 'Não foi possível salvar no dispositivo (armazenamento cheio?). Exporte um backup em Configurações.' }]);
  }
}

export function listBackups(): { at: string; data: string }[] {
  try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch { return []; }
}

interface Store {
  s: GameState;
  events: (GameEvent & { uid: number })[];
  /** Executa uma ação do motor sobre um rascunho e salva. Retorna os eventos gerados. */
  act: (fn: (draft: GameState, ev: Ev) => void) => GameEvent[];
  pushEvents: (ev: GameEvent[]) => void;
  shiftEvent: () => void;
  replace: (s: GameState) => void;
}

let evUid = 1;

export const useGame = create<Store>((set, get) => ({
  s: loadSave(),
  events: [],
  act: (fn) => {
    const draft = structuredClone(get().s);
    const ev: Ev = [];
    fn(draft, ev);
    draft.updatedAt = new Date().toISOString();
    set({ s: draft });
    persist(draft);
    if (ev.length) get().pushEvents(ev);
    return ev;
  },
  pushEvents: (ev) => set({ events: [...get().events, ...ev.map((e) => ({ ...e, uid: evUid++ }))] }),
  shiftEvent: () => set({ events: get().events.slice(1) }),
  replace: (s) => { set({ s }); writeNow(s); },
}));

export function runDaily() {
  useGame.getState().act((d, ev) => {
    dailyTick(d, ev);
    maybeSurprise(d, ev);
  });
}

export const getState = () => useGame.getState().s;
