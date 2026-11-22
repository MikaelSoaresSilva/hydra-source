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
    lastReminder: {},       // {scheduleId: 'YYYY-MM-DD'} evita repetir lembrete
    push: { enabled: false }, // {enabled,id,subscription,lastSync} lembretes push
    lastBackupAt: 0
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

export function newSalt() { const b = new Uint8Array(16); (globalThis.crypto?.getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.floor(Math.random() * 256)))); return toHex(b); }

/* SHA-256 em JavaScript puro: usado só se o aparelho não oferecer crypto.subtle. */
function sha256(bytes) {
  const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const len = bytes.length, total = Math.ceil((len + 9) / 64) * 64;
  const m = new Uint8Array(total); m.set(bytes); m[len] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(total - 4, len * 8); dv.setUint32(total - 8, Math.floor(len / 0x20000000));
  const W = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = W[i - 15], b = W[i - 2]; W[i] = (W[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + W[i - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32); const ov = new DataView(out.buffer); H.forEach((v, i) => ov.setUint32(i * 4, v)); return out;
}
export const _sha256Hex = (str) => toHex(sha256(new TextEncoder().encode(str)));

export async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle) {
    // Alternativa: SHA-256 iterado com sal (sem a API do sistema).
    let h = new TextEncoder().encode(salt + ':' + password);
    for (let i = 0; i < 20000; i++) h = sha256(h);
    return 'js:' + toHex(h);
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(salt), iterations: 120000, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}
