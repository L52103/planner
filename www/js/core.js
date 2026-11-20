/* Planner de Recetas — núcleo: utilidades, datos, almacenamiento y capa nativa.
   Los scripts de www/js comparten el ámbito global de scripts (sin módulos ni bundler). */
'use strict';

/* ───────── utilidades ───────── */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseYmd(s)) === s;
const validTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const num = (v, def = 0) => {
  if (typeof v === 'string') v = v.replace(',', '.');
  const n = parseFloat(v);
  return isFinite(n) && n >= 0 ? n : def;
};
const fmtQty = n => n.toLocaleString('es', { maximumFractionDigits: 2 });
const fmtNum = (n, d = 0) => n.toLocaleString('es', { maximumFractionDigits: d });
const fmtMin = m => {
  if (m > 0 && m < 1) return `${Math.round(m * 60)} s`;
  m = Math.round(m);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`;
};
const fmtClock = sec => {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const todayStr = () => ymd(new Date());
const longDate = s => cap(parseYmd(s).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }));
const relDay = s => {
  if (s === todayStr()) return 'Hoy';
  if (s === ymd(addDays(new Date(), 1))) return 'Mañana';
  if (s === ymd(addDays(new Date(), -1))) return 'Ayer';
  return cap(parseYmd(s).toLocaleDateString('es', { weekday: 'long', day: 'numeric' }));
};
const shortDay = s => parseYmd(s).toLocaleDateString('es', { weekday: 'short' }).replace('.', '');
const monthName = d => cap(d.toLocaleDateString('es', { month: 'long', year: 'numeric' }));
const fmtShortDate = s => parseYmd(s).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
const fmtRange = (f, t) => f === t ? relDay(f) : `${fmtShortDate(f)} a ${fmtShortDate(t)}`;
const nowHM = () => { const n = new Date(); return `${pad(n.getHours())}:${pad(n.getMinutes())}`; };
const weekStartOf = s => { const d = parseYmd(s); return ymd(addDays(d, -((d.getDay() + 6) % 7))); };
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let toastT;
// Aviso breve; con `action` muestra un botón (p. ej. Deshacer) y dura más
function toast(msg, action) {
  const t = $('#toast');
  t.textContent = '';
  const span = document.createElement('span'); span.textContent = msg; t.appendChild(span);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast-act'; b.textContent = action.label;
    b.addEventListener('click', ev => { ev.stopPropagation(); t.classList.remove('show', 'has-action'); action.run(); });
    t.appendChild(b);
  }
  t.classList.toggle('has-action', !!action);
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show', 'has-action'), action ? 7000 : 2800);
}

/* ───────── iconos ───────── */
const IC = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  calPlus: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
  week: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M9 9v12M15 9v12"/>',
  book: '<path d="M5 4h10a3 3 0 0 1 3 3v14H8a3 3 0 0 1-3-3z"/><path d="M5 18a3 3 0 0 1 3-3h10M9 8h5"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.5 12h12l2-8H6.2"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  flame: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 2 3 4 1-2 1-5 1-8z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  down: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
  up: '<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  chef: '<path d="M7 14a4 4 0 0 1-1-7.9A5 5 0 0 1 15.6 5 4 4 0 1 1 17 14v6H7z"/><path d="M7 17h10"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l8-8"/>',
  move: '<path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.5 4.5 4.5 0 0 0 7 18z"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* ───────── categorías y comidas ───────── */
const CATS = {
  desayuno: { name: 'Desayuno', emoji: '🥣', time: '08:00' },
  almuerzo: { name: 'Almuerzo', emoji: '🍲', time: '13:30' },
  merienda: { name: 'Merienda', emoji: '🥪', time: '17:00' },
  cena: { name: 'Cena', emoji: '🍽️', time: '20:30' },
  postre: { name: 'Postre', emoji: '🍰' },
  otro: { name: 'Otro', emoji: '🍴' },
};
const MEALS = ['desayuno', 'almuerzo', 'merienda', 'cena'];
const DIFF = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };
const mealFromTime = t => t < '11:00' ? 'desayuno' : t < '16:00' ? 'almuerzo' : t < '19:00' ? 'merienda' : 'cena';
const EMOJIS = '🥣 🍳 🥞 🧇 🥐 🥪 🌮 🌯 🥗 🍲 🍝 🍜 🍛 🍚 🍗 🍖 🥩 🐟 🍤 🥘 🍕 🍔 🥙 🧆 🥑 🎃 🥦 🥕 🍅 🌽 🍄 🍰 🍫 🍪 🍮 🍓 🍌 🍎 🥤 ☕ 🍵 🍽️ 🍴'.split(' ');
const UNITS = ['g', 'kg', 'ml', 'l', 'taza', 'cda', 'cdita', 'pieza', 'diente', 'pizca', 'lata', 'manojo', 'rebanada', 'filete', 'hoja', 'paquete', 'botella'];

function normCat(v) {
  const f = fold(v || '');
  if (!f) return 'otro';
  if (CATS[f]) return f;
  const map = { breakfast: 'desayuno', lunch: 'almuerzo', comida: 'almuerzo', snack: 'merienda', 'media tarde': 'merienda', onces: 'merienda', dinner: 'cena', supper: 'cena', dessert: 'postre', dulce: 'postre' };
  return map[f] || 'otro';
}
function normDiff(v) {
  const f = fold(v || '');
  if (['media', 'medio', 'intermedia', 'medium', 'normal'].includes(f)) return 'media';
  if (['dificil', 'hard', 'avanzada', 'alta'].includes(f)) return 'dificil';
  return 'facil';
}
const plate = (r, size = '') => `<span class="plate c-${esc(r.category)} ${size}" aria-hidden="true">${esc(r.emoji || CATS[r.category]?.emoji || '🍴')}</span>`;

/* ───────── nutrición (por porción) ───────── */
const NUTR = [
  ['kcal', 'Energía', 'kcal', ['kcal', 'calories', 'calorias', 'energia', 'energy']],
  ['protein', 'Proteína', 'g', ['protein', 'proteina', 'proteinas']],
  ['carbs', 'Carbohidratos', 'g', ['carbs', 'carbohidratos', 'hidratos', 'carbohydrates']],
  ['fat', 'Grasas', 'g', ['fat', 'grasa', 'grasas', 'fats']],
  ['fiber', 'Fibra', 'g', ['fiber', 'fibre', 'fibra']],
  ['iron', 'Hierro', 'mg', ['iron', 'hierro']],
  ['calcium', 'Calcio', 'mg', ['calcium', 'calcio']],
];
const NUTR_BY = Object.fromEntries(NUTR.map(n => [n[0], n]));
function cleanNutrition(src) {
  if (!src || typeof src !== 'object') return null;
  const flat = {};
  for (const [k, v] of Object.entries(src)) flat[fold(k).replace(/[^a-z]/g, '')] = v;
  const out = {};
  let any = false;
  for (const [key, , , aliases] of NUTR) {
    const hit = aliases.find(a => flat[a.replace(/[^a-z]/g, '')] !== undefined);
    const v = hit ? num(flat[hit.replace(/[^a-z]/g, '')], NaN) : NaN;
    if (isFinite(v)) { out[key] = v; any = true; }
  }
  return any ? out : null;
}
const hasNutr = r => !!(r && r.nutrition && r.nutrition.kcal > 0);
// Nutriente que más destaca por porción (para mostrar en fichas)
function highlightNutr(r) {
  const n = r.nutrition;
  if (!n) return '';
  if (n.iron >= 5) return 'Alto en hierro';
  if (n.protein >= 30) return 'Alto en proteína';
  if (n.fiber >= 8) return 'Rico en fibra';
  if (n.calcium >= 300) return 'Rico en calcio';
  return '';
}

/* ───────── perfil nutricional y metas ───────── */
const PROFILE_DEFAULT = { sex: 'mujer', age: 22, activity: 'moderada', weight: '', goal: 'energia', restrictions: '', servings: 1, rules: '', rulesOn: false };
const ACTIVITY = { sedentaria: 'Sedentaria (poco movimiento)', moderada: 'Moderada (camino o hago ejercicio algunos días)', activa: 'Activa (ejercicio casi todos los días)' };
const GOALS = { energia: 'Tener energía y rendir bien en el día a día', mantener: 'Mantener mi peso comiendo equilibrado', bajar: 'Bajar de peso de forma saludable', musculo: 'Ganar masa muscular' };
const ACT_SHORT = { sedentaria: 'Sedentaria', moderada: 'Moderada (ejercicio algunos días)', activa: 'Activa (casi a diario)' };
const GOAL_SHORT = { energia: 'Energía y rendimiento', mantener: 'Mantener mi peso', bajar: 'Bajar de peso', musculo: 'Ganar músculo' };
const profile = () => ({ ...PROFILE_DEFAULT, ...(S.profile || {}) });

// Metas numéricas diarias (orientativas) para las barras de "lo planificado cubre"
function dailyGoals(p = profile()) {
  const w = p.sex === 'mujer';
  let kcal = (w ? { sedentaria: 1900, moderada: 2100, activa: 2300 } : { sedentaria: 2300, moderada: 2600, activa: 2900 })[p.activity] || (w ? 2100 : 2600);
  if (p.goal === 'bajar') kcal -= 400;
  if (p.goal === 'musculo') kcal += 250;
  const kg = num(p.weight, 0);
  const perKg = p.goal === 'musculo' ? 1.6 : p.activity === 'activa' ? 1.4 : 1.1;
  return { kcal, protein: Math.round(kg ? kg * perKg : (w ? 55 : 65)), fiber: w ? 25 : 30, iron: w ? 18 : 8, calcium: 1000 };
}

/* ───────── almacenamiento (reemplazable por nube) ───────── */
const Store = {
  key: 'planner.v1',
  async load() {
    try { const r = localStorage.getItem(this.key); return r ? JSON.parse(r) : null; } catch { return null; }
  },
  async save(data) {
    try { localStorage.setItem(this.key, JSON.stringify(data)); return true; }
    catch { toast('No se pudo guardar: el almacenamiento está lleno o bloqueado'); return false; }
  },
};

/* ───────── capa nativa (app Android con Capacitor) ───────── */
const CAP = window.Capacitor;
const IS_NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
const NP = IS_NATIVE ? CAP.Plugins : {};
const Native = {
  // Id numérico estable a partir del id del temporizador (las notificaciones nativas usan enteros)
  nid: id => { let h = 7; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2000000000 + 1; },
  channelReady: null,
  async ensureChannel() {
    if (!NP.LocalNotifications) return;
    this.channelReady = this.channelReady || NP.LocalNotifications.createChannel({ id: 'timers', name: 'Temporizadores', description: 'Avisos cuando termina un temporizador de cocina', importance: 5, visibility: 1, vibration: true }).catch(() => {});
    return this.channelReady;
  },
  async askNotifications() {
    if (!NP.LocalNotifications) return false;
    try { const p = await NP.LocalNotifications.requestPermissions(); return p.display === 'granted'; } catch { return false; }
  },
  // Reprograma las alarmas nativas para que suenen aunque la app esté cerrada o la pantalla apagada
  async syncTimers(list) {
    const LN = NP.LocalNotifications;
    if (!LN) return;
    try {
      await this.ensureChannel();
      const pend = await LN.getPending();
      const mine = pend.notifications.filter(n => !n.extra || n.extra.kind !== 'rem');
      if (mine.length) await LN.cancel({ notifications: mine.map(n => ({ id: n.id })) });
      const now = Date.now();
      const due = list.filter(t => !t.fired && !t.paused && t.endAt > now + 500);
      if (due.length) await LN.schedule({ notifications: due.map(t => ({ id: this.nid(t.id), title: t.label, body: 'El temporizador terminó', channelId: 'timers', smallIcon: 'ic_stat_timer', extra: { kind: 'timer' }, schedule: { at: new Date(t.endAt), allowWhileIdle: true } })) });
    } catch {}
  },
  async saveFile(name, text) {
    const r = await NP.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    await NP.Share.share({ title: name, files: [r.uri], dialogTitle: 'Guardar o enviar el respaldo' });
  },
};

/* ───────── estado ───────── */
const emptyState = () => ({ version: 4, updatedAt: 0, recipes: [], plan: {}, lists: [], profile: null, dayTips: {}, pantry: [], prices: {}, history: [], leftovers: [], prefs: {} });
let S = emptyState();

function normalizeState(d) {
  const s = emptyState();
  if (!d || typeof d !== 'object') return s;
  s.updatedAt = d.updatedAt || 0;
  s.recipes = Array.isArray(d.recipes) ? d.recipes.flatMap(r => {
    try { return [{ ...cleanRecipe(r), id: r.id || uid(), fav: !!r.fav, createdAt: r.createdAt || Date.now() }]; } catch { return []; }
  }) : [];
  // Recetas de ejemplo guardadas antes de tener datos nutricionales: se completan
  for (const r of s.recipes) {
    if (r.nutrition) continue;
    const sample = SAMPLES.find(x => fold(x.name) === fold(r.name));
    if (sample) r.nutrition = cleanNutrition(sample.nutrition);
  }
  if (d.plan && typeof d.plan === 'object') {
    for (const [date, items] of Object.entries(d.plan)) {
      if (!validDate(date) || !Array.isArray(items)) continue;
      const list = items.filter(i => i && i.recipeId).map(i => {
        const time = validTime(i.time) ? i.time : '13:00';
        return { id: i.id || uid(), recipeId: i.recipeId, time, meal: MEALS.includes(i.meal) ? i.meal : mealFromTime(time), servings: Math.round(num(i.servings, 0)) || 0, done: !!i.done, ...(i.lo ? { lo: true } : {}) };
      });
      if (list.length) s.plan[date] = list;
    }
  }
  const normItem = i => ({
    id: i.id || uid(), name: String(i.name || '').trim(), qty: num(i.qty, 0), unit: String(i.unit || '').trim(),
    aisle: AISLE_NAMES.includes(i.aisle) ? i.aisle : aisleOf(i.name || ''), checked: !!i.checked,
    src: i.src === 'plan' ? 'plan' : 'manual', pkey: i.pkey || '', edited: !!i.edited, recipes: Array.isArray(i.recipes) ? i.recipes.map(String) : [],
    ...(num(i.price, 0) > 0 ? { price: num(i.price, 0) } : {}), ...(i.at ? { at: Number(i.at) || 0 } : {}), ...(i.have ? { have: String(i.have) } : {}), ...(i.est && num(i.price, 0) > 0 ? { est: true } : {}),
  });
  if (Array.isArray(d.lists)) {
    s.lists = d.lists.filter(l => l && typeof l === 'object').map(l => ({
      id: l.id || uid(), name: String(l.name || '').trim() || 'Lista de compras', createdAt: l.createdAt || Date.now(),
      from: validDate(l.from) ? l.from : '', to: validDate(l.to) ? l.to : '',
      removed: Array.isArray(l.removed) ? l.removed.map(String) : [],
      items: Array.isArray(l.items) ? l.items.filter(i => i && i.name).map(normItem) : [],
      ...(l.share && l.share.id ? { share: { id: String(l.share.id), code: String(l.share.code || '') } } : {}),
    }));
  } else if (d.shop && Array.isArray(d.shop.extra) && d.shop.extra.length) {
    s.lists = [{ id: uid(), name: 'Mi lista', createdAt: Date.now(), from: '', to: '', removed: [], items: d.shop.extra.filter(e => e && e.name).map(e => normItem({ name: e.name, checked: e.checked })) }];
  }
  if (d.profile && typeof d.profile === 'object') s.profile = { ...d.profile };
  if (d.dayTips && typeof d.dayTips === 'object') for (const [k, v] of Object.entries(d.dayTips)) if (validDate(k) && v) s.dayTips[k] = String(v).slice(0, 600);
  Object.assign(s, normalizeExtra(d));
  return s;
}
// Despensa, precios recordados, historial de cocina, sobras y preferencias
function normalizeExtra(d) {
  const o = { pantry: [], prices: {}, history: [], leftovers: [], prefs: {} };
  if (Array.isArray(d.pantry)) o.pantry = d.pantry.filter(p => p && p.name).map(p => ({ id: p.id || uid(), name: String(p.name).trim(), qty: num(p.qty, 0), unit: String(p.unit || '').trim(), at: Number(p.at) || Date.now() }));
  if (d.prices && typeof d.prices === 'object') for (const [k, v] of Object.entries(d.prices)) if (num(v, 0) > 0) o.prices[k] = num(v, 0);
  if (Array.isArray(d.history)) o.history = d.history.filter(h => h && h.recipeId && validDate(h.date)).map(h => ({ id: h.id || uid(), recipeId: String(h.recipeId), date: h.date, rating: Math.max(0, Math.min(5, Math.round(num(h.rating, 0)))), src: h.src ? String(h.src) : '', at: Number(h.at) || Date.now(), ...(Array.isArray(h.used) && h.used.length ? { used: h.used.filter(u => u && u.name).map(u => ({ name: String(u.name), unit: String(u.unit || ''), qty: num(u.qty, 0) })) } : {}) })).slice(-500);
  if (Array.isArray(d.leftovers)) o.leftovers = d.leftovers.filter(l => l && l.recipeId && validDate(l.date) && num(l.portions, 0) > 0).map(l => ({ id: l.id || uid(), recipeId: String(l.recipeId), portions: Math.round(num(l.portions, 1)), date: l.date, until: validDate(l.until) ? l.until : ymd(addDays(parseYmd(l.date), 3)), src: l.src ? String(l.src) : '' }));
  if (d.prefs && typeof d.prefs === 'object') o.prefs = { ...d.prefs };
  return o;
}
function save() { S.updatedAt = Date.now(); const r = Store.save(S); Cloud.schedule(); if (typeof afterSave === 'function') afterSave(); return r; }

const getRecipe = id => S.recipes.find(r => r.id === id);
const totalMin = r => (r.prepMinutes || 0) + (r.cookMinutes || 0);
const dayItems = date => (S.plan[date] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
const planCount = () => Object.values(S.plan).reduce((a, b) => a + b.length, 0);
const findItem = (date, id) => (S.plan[date] || []).find(i => i.id === id);

// Suma nutricional de un día: una porción de cada platillo planificado (lo que come una persona)
function dayNutrition(date) {
  const tot = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, iron: 0, calcium: 0 };
  let withData = 0, without = 0;
  for (const it of S.plan[date] || []) {
    const r = getRecipe(it.recipeId);
    if (!r) continue;
    if (!hasNutr(r)) { without++; continue; }
    withData++;
    for (const k in tot) tot[k] += r.nutrition[k] || 0;
  }
  return { tot, withData, without };
}

/* ───────── limpieza / validación de recetas ───────── */
function cleanRecipe(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('una receta no tiene el formato de objeto');
  const name = String(r.name ?? r.nombre ?? '').trim();
  if (!name) throw new Error('falta el nombre de una receta');
  const ingsRaw = r.ingredients ?? r.ingredientes ?? [];
  const stepsRaw = r.steps ?? r.pasos ?? [];
  const ingredients = (Array.isArray(ingsRaw) ? ingsRaw : []).map(i => {
    if (typeof i === 'string') return { name: i.trim(), qty: 0, unit: '' };
    if (!i || typeof i !== 'object') return null;
    return { name: String(i.name ?? i.nombre ?? '').trim(), qty: num(i.quantity ?? i.qty ?? i.cantidad, 0), unit: String(i.unit ?? i.unidad ?? '').trim() };
  }).filter(i => i && i.name);
  const steps = (Array.isArray(stepsRaw) ? stepsRaw : []).map(p => {
    if (typeof p === 'string') return { text: p.trim(), timer: 0 };
    if (!p || typeof p !== 'object') return null;
    return { text: String(p.text ?? p.texto ?? p.descripcion ?? '').trim(), timer: num(p.timerMinutes ?? p.timer ?? p.temporizador, 0) };
  }).filter(p => p && p.text);
  const tagsRaw = r.tags ?? r.etiquetas ?? [];
  const tags = (Array.isArray(tagsRaw) ? tagsRaw : String(tagsRaw).split(',')).map(t => String(t).trim()).filter(Boolean);
  const category = normCat(r.category ?? r.categoria);
  const emoji = String(r.emoji ?? '').trim().slice(0, 4) || CATS[category].emoji;
  return {
    name, emoji, category,
    difficulty: normDiff(r.difficulty ?? r.dificultad),
    description: String(r.description ?? r.descripcion ?? '').trim(),
    servings: Math.max(1, Math.round(num(r.servings ?? r.porciones, 2)) || 2),
    prepMinutes: num(r.prepMinutes ?? r.prepTime ?? r.preparacion, 0),
    cookMinutes: num(r.cookMinutes ?? r.cookTime ?? r.coccion, 0),
    tags, ingredients, steps,
    nutrition: cleanNutrition(r.nutrition ?? r.nutricion ?? r.nutrients),
    notes: String(r.notes ?? r.notas ?? '').trim(),
  };
}

/* ───────── recetas de ejemplo (nutrición aproximada por porción) ───────── */
const I = (name, quantity, unit = '') => ({ name, quantity, unit });
const P = (text, timerMinutes = 0) => ({ text, timerMinutes });
const N = (kcal, protein, carbs, fat, fiber, iron, calcium) => ({ kcal, protein, carbs, fat, fiber, iron, calcium });
const SAMPLES = [
  { name: 'Avena cremosa con frutas', emoji: '🥣', category: 'desayuno', difficulty: 'facil', servings: 2, prepMinutes: 5, cookMinutes: 8, tags: ['rápido', 'vegetariano'], nutrition: N(390, 14, 62, 9, 7, 2.5, 330),
    description: 'Avena cocida en leche con plátano, frutos rojos y un toque de canela.',
    ingredients: [I('Avena en hojuelas', 1, 'taza'), I('Leche', 2, 'taza'), I('Plátano', 1, 'pieza'), I('Fresas', 100, 'g'), I('Miel', 1, 'cda'), I('Canela', 0)],
    steps: [P('Calienta la leche en una olla a fuego medio sin que llegue a hervir.'), P('Añade la avena y la canela; cocina removiendo.', 6), P('Corta el plátano y las fresas.'), P('Sirve la avena, cubre con fruta y termina con miel.')] },
  { name: 'Huevos rancheros', emoji: '🍳', category: 'desayuno', difficulty: 'facil', servings: 2, prepMinutes: 10, cookMinutes: 15, tags: ['mexicano'], nutrition: N(420, 20, 34, 22, 6, 3.2, 120),
    description: 'Huevos estrellados sobre tortilla con salsa de tomate y chile.',
    ingredients: [I('Huevo', 4, 'pieza'), I('Tortilla de maíz', 4, 'pieza'), I('Tomate', 3, 'pieza'), I('Cebolla', 0.5, 'pieza'), I('Ajo', 1, 'diente'), I('Chile serrano', 1, 'pieza'), I('Aceite', 2, 'cda'), I('Sal', 0)],
    steps: [P('Hierve tomates, cebolla, ajo y chile.', 8), P('Licúa con sal hasta obtener una salsa lisa.'), P('Fríe la salsa en una sartén con un poco de aceite.', 5), P('Calienta las tortillas y fríe los huevos.', 4), P('Monta: tortilla, huevo y salsa encima.')] },
  { name: 'Panqueques esponjosos', emoji: '🥞', category: 'desayuno', difficulty: 'facil', servings: 4, prepMinutes: 10, cookMinutes: 15, tags: ['dulce', 'fin de semana'], nutrition: N(360, 11, 48, 13, 1.5, 2, 160),
    description: 'Panqueques altos y suaves para un desayuno sin prisas.',
    ingredients: [I('Harina de trigo', 200, 'g'), I('Leche', 300, 'ml'), I('Huevo', 2, 'pieza'), I('Azúcar', 2, 'cda'), I('Polvo de hornear', 2, 'cdita'), I('Mantequilla', 30, 'g'), I('Sal', 0)],
    steps: [P('Mezcla harina, azúcar, polvo de hornear y sal.'), P('Bate huevos, leche y la mantequilla derretida.'), P('Une ambas mezclas sin batir de más y deja reposar.', 5), P('Cocina porciones en sartén caliente hasta ver burbujas, voltea.', 2), P('Sirve con fruta o miel.')] },
  { name: 'Arroz con pollo', emoji: '🍗', category: 'almuerzo', difficulty: 'media', servings: 4, prepMinutes: 15, cookMinutes: 40, tags: ['clásico', 'una olla'], nutrition: N(610, 38, 72, 17, 4, 3.5, 60),
    description: 'Arroz amarillo con pollo, verduras y caldo, todo en una sola olla.',
    ingredients: [I('Muslos de pollo', 800, 'g'), I('Arroz', 2, 'taza'), I('Caldo de pollo', 4, 'taza'), I('Pimiento rojo', 1, 'pieza'), I('Cebolla', 1, 'pieza'), I('Ajo', 2, 'diente'), I('Guisantes', 1, 'taza'), I('Cúrcuma', 1, 'cdita'), I('Aceite', 2, 'cda'), I('Sal', 0)],
    steps: [P('Salpimienta el pollo y dóralo por ambos lados; reserva.', 10), P('Sofríe cebolla, ajo y pimiento picados.', 5), P('Añade el arroz y la cúrcuma; tuesta un par de minutos.', 2), P('Incorpora caldo y pollo; cuando hierva, baja el fuego y tapa.', 20), P('Agrega los guisantes y deja reposar tapado.', 5)] },
  { name: 'Lentejas guisadas', emoji: '🍲', category: 'almuerzo', difficulty: 'facil', servings: 4, prepMinutes: 15, cookMinutes: 35, tags: ['vegetariano', 'económico'], nutrition: N(420, 22, 68, 8, 15, 7, 70),
    description: 'Guiso de lentejas con verduras, reconfortante y rendidor.',
    ingredients: [I('Lentejas', 300, 'g'), I('Zanahoria', 2, 'pieza'), I('Papa', 2, 'pieza'), I('Cebolla', 1, 'pieza'), I('Ajo', 2, 'diente'), I('Tomate', 2, 'pieza'), I('Pimentón', 1, 'cdita'), I('Comino', 0.5, 'cdita'), I('Aceite', 2, 'cda'), I('Sal', 0)],
    steps: [P('Enjuaga las lentejas.'), P('Sofríe cebolla, ajo y tomate picados.', 6), P('Añade pimentón y comino, remueve un momento.'), P('Agrega lentejas, zanahoria, papa en cubos y agua que cubra.'), P('Cocina a fuego medio-bajo hasta que estén tiernas.', 30), P('Ajusta de sal y sirve.')] },
  { name: 'Pasta al pomodoro', emoji: '🍝', category: 'almuerzo', difficulty: 'facil', servings: 2, prepMinutes: 5, cookMinutes: 20, tags: ['rápido', 'vegetariano'], nutrition: N(560, 19, 88, 15, 6, 3.5, 210),
    description: 'Espaguetis con salsa de tomate, ajo y albahaca.',
    ingredients: [I('Espaguetis', 200, 'g'), I('Tomate triturado', 400, 'g'), I('Ajo', 2, 'diente'), I('Albahaca', 6, 'hoja'), I('Aceite de oliva', 3, 'cda'), I('Queso parmesano', 30, 'g'), I('Sal', 0)],
    steps: [P('Pon a hervir agua con sal.'), P('Dora el ajo laminado en aceite a fuego bajo.', 2), P('Añade el tomate y cocina la salsa.', 15), P('Cuece la pasta al dente.', 10), P('Mezcla pasta y salsa, añade albahaca y parmesano.')] },
  { name: 'Ensalada César con pollo', emoji: '🥗', category: 'cena', difficulty: 'facil', servings: 2, prepMinutes: 15, cookMinutes: 10, tags: ['ligero'], nutrition: N(470, 40, 16, 27, 3, 2, 260),
    description: 'Lechuga crujiente, pollo a la plancha, crutones y aderezo César.',
    ingredients: [I('Pechuga de pollo', 300, 'g'), I('Lechuga romana', 1, 'pieza'), I('Pan', 2, 'rebanada'), I('Queso parmesano', 40, 'g'), I('Mayonesa', 3, 'cda'), I('Limón', 1, 'pieza'), I('Ajo', 1, 'diente'), I('Aceite de oliva', 2, 'cda')],
    steps: [P('Cocina el pollo a la plancha por ambos lados.', 8), P('Corta el pan en cubos y tuéstalo con aceite.', 4), P('Mezcla mayonesa, limón, ajo rallado y parmesano para el aderezo.'), P('Trocea la lechuga y el pollo; mezcla todo con el aderezo.')] },
  { name: 'Salmón al horno con verduras', emoji: '🐟', category: 'cena', difficulty: 'media', servings: 2, prepMinutes: 10, cookMinutes: 20, tags: ['horno', 'saludable', 'omega-3'], nutrition: N(520, 38, 18, 32, 7, 2, 110),
    description: 'Lomos de salmón y verduras asadas en la misma bandeja.',
    ingredients: [I('Salmón', 2, 'filete'), I('Brócoli', 1, 'pieza'), I('Zanahoria', 2, 'pieza'), I('Limón', 1, 'pieza'), I('Aceite de oliva', 2, 'cda'), I('Ajo en polvo', 1, 'cdita'), I('Sal', 0), I('Pimienta', 0)],
    steps: [P('Precalienta el horno a 200 °C.', 10), P('Corta las verduras, alíñalas y hornéalas.', 8), P('Añade el salmón sazonado con limón y ajo a la bandeja.'), P('Hornea hasta que el salmón se separe en láminas.', 12)] },
  { name: 'Tacos de pollo', emoji: '🌮', category: 'cena', difficulty: 'facil', servings: 3, prepMinutes: 15, cookMinutes: 15, tags: ['mexicano', 'para compartir'], nutrition: N(540, 45, 52, 14, 7, 3, 120),
    description: 'Pollo especiado en tortillas con cebolla morada, cilantro y limón.',
    ingredients: [I('Pechuga de pollo', 500, 'g'), I('Tortilla de maíz', 12, 'pieza'), I('Cebolla morada', 1, 'pieza'), I('Cilantro', 1, 'manojo'), I('Limón', 2, 'pieza'), I('Comino', 1, 'cdita'), I('Pimentón', 1, 'cdita'), I('Aceite', 1, 'cda')],
    steps: [P('Corta el pollo en tiras y sazona con comino, pimentón y sal.'), P('Saltéalo en sartén caliente.', 10), P('Pica cebolla y cilantro.'), P('Calienta las tortillas y arma los tacos con limón.')] },
  { name: 'Crema de calabaza', emoji: '🎃', category: 'cena', difficulty: 'facil', servings: 4, prepMinutes: 10, cookMinutes: 25, tags: ['vegetariano', 'sopa'], nutrition: N(210, 5, 30, 8, 5, 1.6, 90),
    description: 'Crema suave de calabaza con un toque de jengibre.',
    ingredients: [I('Calabaza', 800, 'g'), I('Cebolla', 1, 'pieza'), I('Papa', 1, 'pieza'), I('Caldo de verduras', 4, 'taza'), I('Jengibre', 1, 'cdita'), I('Crema', 100, 'ml'), I('Sal', 0)],
    steps: [P('Sofríe la cebolla picada.', 5), P('Añade calabaza, papa en cubos, jengibre y caldo.'), P('Cocina hasta que todo esté tierno.', 20), P('Tritura hasta que quede lisa y agrega la crema.')] },
  { name: 'Guacamole con totopos', emoji: '🥑', category: 'merienda', difficulty: 'facil', servings: 4, prepMinutes: 10, cookMinutes: 0, tags: ['sin cocción', 'para compartir'], nutrition: N(380, 5, 34, 26, 11, 1.2, 60),
    description: 'Aguacate machacado con tomate, cebolla, cilantro y limón.',
    ingredients: [I('Aguacate', 3, 'pieza'), I('Tomate', 1, 'pieza'), I('Cebolla', 0.5, 'pieza'), I('Cilantro', 0.5, 'manojo'), I('Limón', 1, 'pieza'), I('Totopos', 200, 'g'), I('Sal', 0)],
    steps: [P('Machaca los aguacates con jugo de limón y sal.'), P('Pica finamente tomate, cebolla y cilantro e incorpóralos.'), P('Sirve enseguida con los totopos.')] },
  { name: 'Brownies de chocolate', emoji: '🍫', category: 'postre', difficulty: 'media', servings: 9, prepMinutes: 15, cookMinutes: 25, tags: ['horno', 'dulce'], nutrition: N(330, 4.5, 35, 20, 2.5, 2.5, 25),
    description: 'Brownies húmedos con corteza crujiente.',
    ingredients: [I('Chocolate amargo', 200, 'g'), I('Mantequilla', 120, 'g'), I('Azúcar', 200, 'g'), I('Huevo', 3, 'pieza'), I('Harina de trigo', 80, 'g'), I('Cacao en polvo', 2, 'cda'), I('Sal', 0)],
    steps: [P('Precalienta el horno a 180 °C y engrasa un molde.', 10), P('Derrite chocolate y mantequilla a baño maría.', 5), P('Bate huevos y azúcar; une con el chocolate.'), P('Incorpora harina, cacao y sal con espátula.'), P('Hornea.', 25), P('Deja enfriar antes de cortar.', 20)] },
];
function addSamples() {
  const have = new Set(S.recipes.map(r => fold(r.name)));
  let n = 0;
  for (const s of SAMPLES) if (!have.has(fold(s.name))) { S.recipes.push({ ...cleanRecipe(s), id: uid(), fav: false, createdAt: Date.now() }); n++; }
  return n;
}

/* ───────── borrador del editor de recetas ───────── */
const Drafts = {
  key: 'planner.draft',
  save(d) { try { localStorage.setItem(this.key, JSON.stringify({ draft: d, pendingPlan: ui.pendingPlan, returnTo: ui.returnTo, at: Date.now() })); } catch {} },
  get() { try { return JSON.parse(localStorage.getItem(this.key)); } catch { return null; } },
  clear() { try { localStorage.removeItem(this.key); } catch {} },
};

/* ───────── estado de interfaz ───────── */
const ui = {
  view: 'today',
  month: (() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); })(),
  day: todayStr(),
  weekStart: weekStartOf(todayStr()),
  q: '', cat: 'all', sort: 'name',
  recipeId: null, detailServ: null, rtab: 'ing',
  draft: null, returnTo: 'book', pendingPlan: null, emojiOpen: false,
  cook: null,
  listId: null, editItem: null, aisle: 'all', org: null, undo: null, nl: null, bookEdit: false, sel: new Set(),
  pick: null, pd: null, moving: null, sheet: null,
};
