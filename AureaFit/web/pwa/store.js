// Armazenamento local (IndexedDB). Nada é enviado a servidores.
const DB_NAME = 'aurea';
const DB_VERSION = 1;
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));
export const photoGet = (k) => tx('photos', 'readonly', (s) => s.get(k));
export const photoSet = (k, blob) => tx('photos', 'readwrite', (s) => s.put(blob, k));
export const photoDel = (k) => tx('photos', 'readwrite', (s) => s.delete(k));
export async function photoKeys() { return tx('photos', 'readonly', (s) => s.getAllKeys()); }
export async function clearAll() {
  await tx('kv', 'readwrite', (s) => s.clear());
  await tx('photos', 'readwrite', (s) => s.clear());
}

/** Estado inicial do aplicativo. */
export function emptyState() {
  return {
    version: 1,
    account: null,          // {name,email,hash,salt,createdAt}
    loggedIn: false,
    profile: null,          // UserProfile (mesmo formato do app Android)
    plans: [],              // {id,kind:'WORKOUT'|'DIET',json,reason,createdAt,active}
    sessions: [],           // {id,epochDay,dayIndex,title,durationMin,sets:[{exerciseId,weightKg,reps}],feedback:[{exerciseId,rpe,goodForm,pain}]}
    measurements: [],       // {id,epochDay,weightKg,waistCm,hipCm,thighCm,armCm}
    photos: [],             // {id,epochDay,note}
    water: [],              // {id,epochDay,ml,time}
    schedule: [],           // {id,type,label,time,daysMask,enabled}
    notifications: [],      // {id,time,title,body,read}
    checkins: [],           // {id,epochDay,answers,recs,applied}
    mealChecks: {},         // {epochDay: [mealIndex,...]}
    settings: { themeMode: 0, hideCalories: false, notifications: true, waterGoalOverride: 0, glassMl: 250 },
    lastReminder: {}        // {scheduleId: 'YYYY-MM-DDTHH:MM'} evita repetir lembrete
  };
}

let state = null;
let saveTimer = null;

export async function loadState() {
  try {
    const s = await kvGet('state');
    state = Object.assign(emptyState(), s || {});
    state.settings = Object.assign(emptyState().settings, state.settings || {});
  } catch (e) {
    console.error(e);
    state = emptyState();
  }
  return state;
}

export function getState() { return state; }

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => kvSet('state', JSON.parse(JSON.stringify(state))).catch(console.error), 150);
}

export async function saveNow() {
  clearTimeout(saveTimer);
  await kvSet('state', JSON.parse(JSON.stringify(state)));
}

export function replaceState(s) { state = Object.assign(emptyState(), s); }

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Dia atual como "epochDay" (dias desde 1970), igual ao Android. */
export function today() {
  const d = new Date();
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
export function dateOfEpoch(day) { const d = new Date(day * 86400000); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
export function epochLabel(day) { const d = dateOfEpoch(day); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }
export function weekdayOf(date = new Date()) { const w = date.getDay(); return w === 0 ? 7 : w; } // 1=segunda ... 7=domingo

/* ------------------------------------------------------------ Senha (PBKDF2 / WebCrypto) */
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array(h.match(/.{2}/g).map((x) => parseInt(x, 16)));

export function newSalt() { return toHex(crypto.getRandomValues(new Uint8Array(16))); }

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}
