/* Planner de Recetas — PWA sin dependencias.
   Persistencia aislada en `Store` para poder cambiarla por una nube más adelante. */
(() => {
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
const longDate = s => cap(parseYmd(s).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }));
const relDay = s => {
  const t = ymd(new Date());
  if (s === t) return 'Hoy';
  if (s === ymd(addDays(new Date(), 1))) return 'Mañana';
  if (s === ymd(addDays(new Date(), -1))) return 'Ayer';
  return cap(parseYmd(s).toLocaleDateString('es', { weekday: 'long', day: 'numeric' }));
};
const shortDay = s => parseYmd(s).toLocaleDateString('es', { weekday: 'short' }).replace('.', '');
const monthName = d => cap(d.toLocaleDateString('es', { month: 'long', year: 'numeric' }));
const nowHM = () => { const n = new Date(); return `${pad(n.getHours())}:${pad(n.getMinutes())}`; };

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ───────── iconos ───────── */
const IC = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  book: '<path d="M5 4h10a3 3 0 0 1 3 3v14H8a3 3 0 0 1-3-3z"/><path d="M5 18a3 3 0 0 1 3-3h10M9 8h5"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.5 12h12l2-8H6.2"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
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
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* ───────── catálogo de categorías / comidas ───────── */
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

/* ───────── estado ───────── */
const emptyState = () => ({ version: 2, updatedAt: 0, recipes: [], plan: {}, lists: [] });
let S = emptyState();

function normalizeState(d) {
  const s = emptyState();
  if (!d || typeof d !== 'object') return s;
  s.updatedAt = d.updatedAt || 0;
  s.recipes = Array.isArray(d.recipes) ? d.recipes.flatMap(r => {
    try { return [{ ...cleanRecipe(r), id: r.id || uid(), fav: !!r.fav, createdAt: r.createdAt || Date.now() }]; } catch { return []; }
  }) : [];
  if (d.plan && typeof d.plan === 'object') {
    for (const [date, items] of Object.entries(d.plan)) {
      if (!validDate(date) || !Array.isArray(items)) continue;
      const list = items.filter(i => i && i.recipeId).map(i => {
        const time = validTime(i.time) ? i.time : '13:00';
        return {
          id: i.id || uid(), recipeId: i.recipeId, time,
          meal: MEALS.includes(i.meal) ? i.meal : mealFromTime(time),
          servings: Math.round(num(i.servings, 0)) || 0, done: !!i.done,
        };
      });
      if (list.length) s.plan[date] = list;
    }
  }
  const normItem = i => ({
    id: i.id || uid(), name: String(i.name || '').trim(), qty: num(i.qty, 0), unit: String(i.unit || '').trim(),
    aisle: AISLE_NAMES.includes(i.aisle) ? i.aisle : aisleOf(i.name || ''), checked: !!i.checked,
    src: i.src === 'plan' ? 'plan' : 'manual', pkey: i.pkey || '', edited: !!i.edited, recipes: Array.isArray(i.recipes) ? i.recipes.map(String) : [],
  });
  if (Array.isArray(d.lists)) {
    s.lists = d.lists.filter(l => l && typeof l === 'object').map(l => ({
      id: l.id || uid(), name: String(l.name || '').trim() || 'Lista de compras', createdAt: l.createdAt || Date.now(),
      from: validDate(l.from) ? l.from : '', to: validDate(l.to) ? l.to : '',
      removed: Array.isArray(l.removed) ? l.removed.map(String) : [],
      items: Array.isArray(l.items) ? l.items.filter(i => i && i.name).map(normItem) : [],
    }));
  } else if (d.shop && Array.isArray(d.shop.extra) && d.shop.extra.length) {
    s.lists = [{ id: uid(), name: 'Mi lista', createdAt: Date.now(), from: '', to: '', removed: [], items: d.shop.extra.filter(e => e && e.name).map(e => normItem({ name: e.name, checked: e.checked })) }];
  }
  return s;
}
function save() { S.updatedAt = Date.now(); return Store.save(S); }

const getRecipe = id => S.recipes.find(r => r.id === id);
const totalMin = r => (r.prepMinutes || 0) + (r.cookMinutes || 0);
const dayItems = date => (S.plan[date] || []).slice().sort((a, b) => a.time.localeCompare(b.time));
const planCount = () => Object.values(S.plan).reduce((a, b) => a + b.length, 0);

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
    notes: String(r.notes ?? r.notas ?? '').trim(),
  };
}

/* ───────── recetas de ejemplo ───────── */
const I = (name, quantity, unit = '') => ({ name, quantity, unit });
const P = (text, timerMinutes = 0) => ({ text, timerMinutes });
const SAMPLES = [
  { name: 'Avena cremosa con frutas', emoji: '🥣', category: 'desayuno', difficulty: 'facil', servings: 2, prepMinutes: 5, cookMinutes: 8, tags: ['rápido', 'vegetariano'],
    description: 'Avena cocida en leche con plátano, frutos rojos y un toque de canela.',
    ingredients: [I('Avena en hojuelas', 1, 'taza'), I('Leche', 2, 'taza'), I('Plátano', 1, 'pieza'), I('Fresas', 100, 'g'), I('Miel', 1, 'cda'), I('Canela', 0)],
    steps: [P('Calienta la leche en una olla a fuego medio sin que llegue a hervir.'), P('Añade la avena y la canela; cocina removiendo.', 6), P('Corta el plátano y las fresas.'), P('Sirve la avena, cubre con fruta y termina con miel.')] },
  { name: 'Huevos rancheros', emoji: '🍳', category: 'desayuno', difficulty: 'facil', servings: 2, prepMinutes: 10, cookMinutes: 15, tags: ['mexicano'],
    description: 'Huevos estrellados sobre tortilla con salsa de tomate y chile.',
    ingredients: [I('Huevo', 4, 'pieza'), I('Tortilla de maíz', 4, 'pieza'), I('Tomate', 3, 'pieza'), I('Cebolla', 0.5, 'pieza'), I('Ajo', 1, 'diente'), I('Chile serrano', 1, 'pieza'), I('Aceite', 2, 'cda'), I('Sal', 0)],
    steps: [P('Hierve tomates, cebolla, ajo y chile.', 8), P('Licúa con sal hasta obtener una salsa lisa.'), P('Fríe la salsa en una sartén con un poco de aceite.', 5), P('Calienta las tortillas y fríe los huevos.', 4), P('Monta: tortilla, huevo y salsa encima.')] },
  { name: 'Panqueques esponjosos', emoji: '🥞', category: 'desayuno', difficulty: 'facil', servings: 4, prepMinutes: 10, cookMinutes: 15, tags: ['dulce', 'fin de semana'],
    description: 'Panqueques altos y suaves para un desayuno sin prisas.',
    ingredients: [I('Harina de trigo', 200, 'g'), I('Leche', 300, 'ml'), I('Huevo', 2, 'pieza'), I('Azúcar', 2, 'cda'), I('Polvo de hornear', 2, 'cdita'), I('Mantequilla', 30, 'g'), I('Sal', 0)],
    steps: [P('Mezcla harina, azúcar, polvo de hornear y sal.'), P('Bate huevos, leche y la mantequilla derretida.'), P('Une ambas mezclas sin batir de más y deja reposar.', 5), P('Cocina porciones en sartén caliente hasta ver burbujas, voltea.', 2), P('Sirve con fruta o miel.')] },
  { name: 'Arroz con pollo', emoji: '🍗', category: 'almuerzo', difficulty: 'media', servings: 4, prepMinutes: 15, cookMinutes: 40, tags: ['clásico', 'una olla'],
    description: 'Arroz amarillo con pollo, verduras y caldo, todo en una sola olla.',
    ingredients: [I('Muslos de pollo', 800, 'g'), I('Arroz', 2, 'taza'), I('Caldo de pollo', 4, 'taza'), I('Pimiento rojo', 1, 'pieza'), I('Cebolla', 1, 'pieza'), I('Ajo', 2, 'diente'), I('Guisantes', 1, 'taza'), I('Cúrcuma', 1, 'cdita'), I('Aceite', 2, 'cda'), I('Sal', 0)],
    steps: [P('Salpimienta el pollo y dóralo por ambos lados; reserva.', 10), P('Sofríe cebolla, ajo y pimiento picados.', 5), P('Añade el arroz y la cúrcuma; tuesta un par de minutos.', 2), P('Incorpora caldo y pollo; cuando hierva, baja el fuego y tapa.', 20), P('Agrega los guisantes y deja reposar tapado.', 5)] },
  { name: 'Lentejas guisadas', emoji: '🍲', category: 'almuerzo', difficulty: 'facil', servings: 4, prepMinutes: 15, cookMinutes: 35, tags: ['vegetariano', 'económico'],
    description: 'Guiso de lentejas con verduras, reconfortante y rendidor.',
    ingredients: [I('Lentejas', 300, 'g'), I('Zanahoria', 2, 'pieza'), I('Papa', 2, 'pieza'), I('Cebolla', 1, 'pieza'), I('Ajo', 2, 'diente'), I('Tomate', 2, 'pieza'), I('Pimentón', 1, 'cdita'), I('Comino', 0.5, 'cdita'), I('Aceite', 2, 'cda'), I('Sal', 0)],
    steps: [P('Enjuaga las lentejas.'), P('Sofríe cebolla, ajo y tomate picados.', 6), P('Añade pimentón y comino, remueve un momento.'), P('Agrega lentejas, zanahoria, papa en cubos y agua que cubra.'), P('Cocina a fuego medio-bajo hasta que estén tiernas.', 30), P('Ajusta de sal y sirve.')] },
  { name: 'Pasta al pomodoro', emoji: '🍝', category: 'almuerzo', difficulty: 'facil', servings: 2, prepMinutes: 5, cookMinutes: 20, tags: ['rápido', 'vegetariano'],
    description: 'Espaguetis con salsa de tomate, ajo y albahaca.',
    ingredients: [I('Espaguetis', 200, 'g'), I('Tomate triturado', 400, 'g'), I('Ajo', 2, 'diente'), I('Albahaca', 6, 'hoja'), I('Aceite de oliva', 3, 'cda'), I('Queso parmesano', 30, 'g'), I('Sal', 0)],
    steps: [P('Pon a hervir agua con sal.'), P('Dora el ajo laminado en aceite a fuego bajo.', 2), P('Añade el tomate y cocina la salsa.', 15), P('Cuece la pasta al dente.', 10), P('Mezcla pasta y salsa, añade albahaca y parmesano.')] },
  { name: 'Ensalada César con pollo', emoji: '🥗', category: 'cena', difficulty: 'facil', servings: 2, prepMinutes: 15, cookMinutes: 10, tags: ['ligero'],
    description: 'Lechuga crujiente, pollo a la plancha, crutones y aderezo César.',
    ingredients: [I('Pechuga de pollo', 300, 'g'), I('Lechuga romana', 1, 'pieza'), I('Pan', 2, 'rebanada'), I('Queso parmesano', 40, 'g'), I('Mayonesa', 3, 'cda'), I('Limón', 1, 'pieza'), I('Ajo', 1, 'diente'), I('Aceite de oliva', 2, 'cda')],
    steps: [P('Cocina el pollo a la plancha por ambos lados.', 8), P('Corta el pan en cubos y tuéstalo con aceite.', 4), P('Mezcla mayonesa, limón, ajo rallado y parmesano para el aderezo.'), P('Trocea la lechuga y el pollo; mezcla todo con el aderezo.')] },
  { name: 'Salmón al horno con verduras', emoji: '🐟', category: 'cena', difficulty: 'media', servings: 2, prepMinutes: 10, cookMinutes: 20, tags: ['horno', 'saludable'],
    description: 'Lomos de salmón y verduras asadas en la misma bandeja.',
    ingredients: [I('Salmón', 2, 'filete'), I('Brócoli', 1, 'pieza'), I('Zanahoria', 2, 'pieza'), I('Limón', 1, 'pieza'), I('Aceite de oliva', 2, 'cda'), I('Ajo en polvo', 1, 'cdita'), I('Sal', 0), I('Pimienta', 0)],
    steps: [P('Precalienta el horno a 200 °C.', 10), P('Corta las verduras, alíñalas y hornéalas.', 8), P('Añade el salmón sazonado con limón y ajo a la bandeja.'), P('Hornea hasta que el salmón se separe en láminas.', 12)] },
  { name: 'Tacos de pollo', emoji: '🌮', category: 'cena', difficulty: 'facil', servings: 3, prepMinutes: 15, cookMinutes: 15, tags: ['mexicano', 'para compartir'],
    description: 'Pollo especiado en tortillas con guacamole y cebolla morada.',
    ingredients: [I('Pechuga de pollo', 500, 'g'), I('Tortilla de maíz', 12, 'pieza'), I('Cebolla morada', 1, 'pieza'), I('Cilantro', 1, 'manojo'), I('Limón', 2, 'pieza'), I('Comino', 1, 'cdita'), I('Pimentón', 1, 'cdita'), I('Aceite', 1, 'cda')],
    steps: [P('Corta el pollo en tiras y sazona con comino, pimentón y sal.'), P('Saltéalo en sartén caliente.', 10), P('Pica cebolla y cilantro.'), P('Calienta las tortillas y arma los tacos con limón.')] },
  { name: 'Crema de calabaza', emoji: '🎃', category: 'cena', difficulty: 'facil', servings: 4, prepMinutes: 10, cookMinutes: 25, tags: ['vegetariano', 'sopa'],
    description: 'Crema suave de calabaza con un toque de jengibre.',
    ingredients: [I('Calabaza', 800, 'g'), I('Cebolla', 1, 'pieza'), I('Papa', 1, 'pieza'), I('Caldo de verduras', 4, 'taza'), I('Jengibre', 1, 'cdita'), I('Crema', 100, 'ml'), I('Sal', 0)],
    steps: [P('Sofríe la cebolla picada.', 5), P('Añade calabaza, papa en cubos, jengibre y caldo.'), P('Cocina hasta que todo esté tierno.', 20), P('Tritura hasta que quede lisa y agrega la crema.')] },
  { name: 'Guacamole con totopos', emoji: '🥑', category: 'merienda', difficulty: 'facil', servings: 4, prepMinutes: 10, cookMinutes: 0, tags: ['sin cocción', 'para compartir'],
    description: 'Aguacate machacado con tomate, cebolla, cilantro y limón.',
    ingredients: [I('Aguacate', 3, 'pieza'), I('Tomate', 1, 'pieza'), I('Cebolla', 0.5, 'pieza'), I('Cilantro', 0.5, 'manojo'), I('Limón', 1, 'pieza'), I('Totopos', 200, 'g'), I('Sal', 0)],
    steps: [P('Machaca los aguacates con jugo de limón y sal.'), P('Pica finamente tomate, cebolla y cilantro e incorpóralos.'), P('Sirve enseguida con los totopos.')] },
  { name: 'Brownies de chocolate', emoji: '🍫', category: 'postre', difficulty: 'media', servings: 9, prepMinutes: 15, cookMinutes: 25, tags: ['horno', 'dulce'],
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

/* ───────── estado de interfaz ───────── */
const today = new Date();
const ui = {
  view: 'today',
  month: new Date(today.getFullYear(), today.getMonth(), 1),
  day: ymd(today),
  q: '', cat: 'all', sort: 'name',
  recipeId: null, detailServ: null,
  draft: null, returnTo: 'book', pendingPlan: null,
  cook: null,
  listId: null, editItem: null, org: null, undo: null, nl: null, bookEdit: false, sel: new Set(),
  pick: null, pd: null,
};

/* ───────── temporizadores (anillo circular, estilo reloj) ───────── */
let timers = [];
try { timers = JSON.parse(localStorage.getItem('planner.timers') || '[]'); } catch { timers = []; }
const saveTimers = () => { try { localStorage.setItem('planner.timers', JSON.stringify(timers)); } catch {} };

let actx = null, alarmIv = null;
function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch {}
}
function beep() {
  if (!actx) return;
  const t0 = actx.currentTime;
  [0, 0.18].forEach((off, i) => {
    const o = actx.createOscillator(), g = actx.createGain(), t = t0 + off;
    o.type = 'sine'; o.frequency.value = i ? 1046 : 880;
    o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.start(t); o.stop(t + 0.32);
  });
}
function startAlarm() {
  if (alarmIv) return;
  let n = 0;
  const ring = () => { beep(); try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch {} if (++n > 40) stopAlarm(); };
  ring();
  alarmIv = setInterval(ring, 1500);
}
function stopAlarm() { clearInterval(alarmIv); alarmIv = null; }
const syncAlarm = () => { if (!timers.some(x => x.fired)) stopAlarm(); };

async function notify(title) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) reg.showNotification(title, { body: 'El temporizador terminó', vibrate: [300, 150, 300], tag: 'planner-timer', icon: 'icons/icon-192.png' });
    else new Notification(title);
  } catch {}
}

const tLeft = t => t.paused ? t.remaining : (t.endAt - Date.now()) / 1000;
const tState = t => t.fired ? 'fired' : t.paused ? 'paused' : 'run';
const fmtSigned = sec => sec >= 0 ? fmtClock(sec) : '−' + fmtClock(Math.floor(-sec));

function addTimer(minutes, label) {
  if (!(minutes > 0)) return toast('Escribe una duración mayor que 0');
  const total = Math.round(minutes * 60);
  timers.push({ id: uid(), label, total, endAt: Date.now() + total * 1000, fired: false, paused: false, remaining: total, firedAt: 0 });
  saveTimers();
  unlockAudio();
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
  renderTimers();
  toast(`Temporizador de ${fmtMin(minutes)} iniciado`);
}

function tick() {
  let changed = false;
  const now = Date.now();
  for (const t of timers) {
    if (!t.fired && !t.paused && now >= t.endAt) { t.fired = true; t.firedAt = t.endAt; changed = true; startAlarm(); notify(t.label); }
  }
  if (changed) saveTimers();
  renderTimers();
}

const RING = cls => `<svg class="ring ${cls}" viewBox="0 0 120 120" aria-hidden="true"><circle class="trk" cx="60" cy="60" r="52"/><circle class="arc" cx="60" cy="60" r="52" pathLength="100"/></svg>`;
function ringCard(t) {
  const st = tState(t);
  const del = `<button class="btn icon sm" data-act="timerDel" data-id="${t.id}" aria-label="Eliminar temporizador">${ic('trash')}</button>`;
  const btns = st === 'fired'
    ? `<button class="btn sm" data-act="timerAdd" data-id="${t.id}">+1:00</button><button class="btn primary sm" data-act="timerDel" data-id="${t.id}">Detener</button>`
    : st === 'paused'
      ? `${del}<button class="btn sm" data-act="timerReset" data-id="${t.id}">Reiniciar</button><button class="btn primary sm" data-act="timerResume" data-id="${t.id}">${ic('play', 'fill')}Reanudar</button>`
      : `${del}<button class="btn sm" data-act="timerAdd" data-id="${t.id}">+1:00</button><button class="btn primary sm" data-act="timerPause" data-id="${t.id}">${ic('pause', 'fill')}Pausa</button>`;
  return `<div class="tring ${st}" data-tid="${t.id}" ${st === 'fired' ? 'role="alert"' : ''}>
    <div class="tring-dial">${RING('')}<div class="tring-c"><span class="tring-t">${fmtSigned(tLeft(t))}</span><span class="tring-l">${esc(t.label)}</span></div></div>
    <div class="tring-a">${btns}</div></div>`;
}
function miniBar(t) {
  const st = tState(t);
  const btn = st === 'fired' ? `<button class="tm-btn" data-act="timerDel" data-id="${t.id}">Detener</button>`
    : st === 'paused' ? `<button class="tm-btn icon" data-act="timerResume" data-id="${t.id}" aria-label="Reanudar">${ic('play', 'fill')}</button>`
      : `<button class="tm-btn icon" data-act="timerPause" data-id="${t.id}" aria-label="Pausar">${ic('pause', 'fill')}</button>`;
  return `<div class="tm ${st}" data-tid="${t.id}"><button class="tm-open" data-act="timerSheet" aria-label="Abrir temporizadores">${RING('mini')}<span class="l">${esc(t.label)}</span><span class="tring-t c">${fmtSigned(tLeft(t))}</span></button>${btn}</div>`;
}
function updateRings() {
  $$('[data-tid]').forEach(el => {
    const t = timers.find(x => x.id === el.dataset.tid);
    if (!t) return;
    const left = tLeft(t);
    const time = t.fired ? fmtSigned(-(Date.now() - t.firedAt) / 1000) : fmtSigned(left);
    const te = $('.tring-t', el); if (te && te.textContent !== time) te.textContent = time;
    const frac = t.fired ? 1 : Math.max(0, Math.min(1, left / t.total));
    $$('.arc', el).forEach(a => { a.style.strokeDashoffset = String(100 - frac * 100); });
  });
}
let timerSig = null;
function renderTimers() {
  const sig = timers.map(t => t.id + tState(t)).join(',');
  const hosts = $$('.ring-host');
  if (sig !== timerSig || hosts.some(h => h.dataset.sig !== sig)) {
    timerSig = sig;
    $('#timers').innerHTML = timers.map(miniBar).join('');
    hosts.forEach(h => { h.dataset.sig = sig; h.innerHTML = timers.map(ringCard).join(''); });
  }
  updateRings();
}
function timerSheet() {
  openDlg(`<div class="dlg-h"><div><h2>Temporizadores</h2></div><button class="btn icon ghost" data-act="closeDlg" aria-label="Cerrar">${ic('x')}</button></div>
  <div class="ring-host" data-empty="No hay temporizadores en marcha."></div>
  <h3 class="sub-h">Nuevo temporizador</h3>
  <div class="chips">${[1, 3, 5, 10, 15, 20, 30, 45, 60].map(m => `<button class="chip" data-act="quickTimer" data-min="${m}">${fmtMin(m)}</button>`).join('')}</div>
  <div class="nt-row"><label>Min<input id="nt-m" inputmode="numeric" placeholder="0"></label><label>Seg<input id="nt-s" inputmode="numeric" placeholder="00"></label><label class="grow">Nombre<input id="nt-l" placeholder="Ej. Horno"></label><button class="btn primary" data-act="newTimer">${ic('play', 'fill')}Iniciar</button></div>`);
  renderTimers();
}
function timerAct(id, fn) {
  const t = timers.find(x => x.id === id);
  if (!t) return;
  fn(t);
  saveTimers(); syncAlarm(); renderTimers();
}

/* ───────── compras ───────── */
const AISLES = [
  ['Despensa', ['leche de coco', 'tomate triturado', 'pure de tomate', 'pasta de tomate', 'salsa', 'caldo', 'totopos', 'cacao', 'chocolate', 'polvo de hornear', 'levadura', 'harina', 'azucar', 'arroz', 'pasta', 'espagueti', 'fideo', 'macarron', 'lenteja', 'frijol', 'garbanzo', 'aceite', 'vinagre', 'miel', 'mayonesa', 'mostaza', 'atun', 'lata', 'avena', 'cereal', 'galleta', 'mermelada', 'cafe', 'te ']],
  ['Especias y condimentos', ['=sal', 'pimienta', 'comino', 'oregano', 'pimenton', 'paprika', 'curry', 'canela', 'laurel', 'especia', 'nuez moscada', 'vainilla', 'curcuma', 'ajo en polvo', 'tomillo', 'romero']],
  ['Carnes y pescados', ['pollo', 'pechuga', 'muslo', 'carne', 'res', 'cerdo', 'pavo', 'jamon', 'tocino', 'salmon', 'pescado', 'camaron', 'gamba', 'chorizo', 'salchicha', 'molida', 'filete', 'lomo']],
  ['Lácteos y huevos', ['leche', 'queso', 'yogur', 'mantequilla', 'crema', 'nata', 'huevo', 'parmesano']],
  ['Panadería', ['pan', 'tortilla', 'bollo', 'baguette']],
  ['Frutas y verduras', ['tomate', 'cebolla', 'ajo', 'zanahoria', 'papa', 'patata', 'lechuga', 'pimiento', 'pepino', 'calabac', 'calabaza', 'espinaca', 'brocoli', 'apio', 'cilantro', 'perejil', 'limon', 'lima', 'manzana', 'platano', 'banana', 'fresa', 'frutos rojos', 'aguacate', 'palta', 'champi', 'hongo', 'maiz', 'choclo', 'jengibre', 'fruta', 'naranja', 'chile', 'jalapeno', 'albahaca', 'puerro', 'berenjena', 'repollo', '=col', 'rucula', 'arveja', 'guisante', 'ejote', 'verdura', 'hierba', 'menta']],
];
const AISLE_NAMES = [...AISLES.map(a => a[0]), 'Otros'];
const UNITS = ['g', 'kg', 'ml', 'l', 'taza', 'cda', 'cdita', 'pieza', 'diente', 'pizca', 'lata', 'manojo', 'rebanada', 'filete', 'hoja', 'paquete', 'botella'];
function aisleOf(name) {
  const f = ' ' + fold(name) + ' ';
  for (const [aisle, words] of AISLES) {
    for (const w of words) {
      if (w.startsWith('=')) { if (new RegExp(`\\s${w.slice(1)}\\s`).test(f)) return aisle; }
      else if (f.includes(' ' + w)) return aisle;
    }
  }
  return 'Otros';
}
const unitKey = u => { const f = fold(u); return f.length > 3 ? f.replace(/e?s$/, '') : f; };
function aggregate(from, to) {
  const map = new Map();
  for (const [date, items] of Object.entries(S.plan)) {
    if (date < from || date > to) continue;
    for (const it of items) {
      const r = getRecipe(it.recipeId);
      if (!r) continue;
      const f = (it.servings || r.servings || 1) / (r.servings || 1);
      for (const ing of r.ingredients) {
        const key = fold(ing.name) + '|' + unitKey(ing.unit || '');
        let e = map.get(key);
        if (!e) { e = { key, name: ing.name.trim(), unit: ing.unit || '', qty: 0, from: new Set(), aisle: aisleOf(ing.name) }; map.set(key, e); }
        if (ing.qty > 0) e.qty += ing.qty * f;
        e.from.add(r.name);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
const shopLine = e => `${e.qty > 0 ? fmtQty(e.qty) + (e.unit ? ' ' + e.unit : '') + ' ' : ''}${e.name}`;
function shopPresetRange(p) {
  const t = new Date();
  if (p === 'today') return [ymd(t), ymd(t)];
  if (p === 'week') { const off = (t.getDay() + 6) % 7; return [ymd(addDays(t, -off)), ymd(addDays(t, 6 - off))]; }
  if (p === 'month') return [ymd(new Date(t.getFullYear(), t.getMonth(), 1)), ymd(new Date(t.getFullYear(), t.getMonth() + 1, 0))];
  return [ymd(t), ymd(addDays(t, 6))];
}

/* ───────── componentes ───────── */
const scaled = (i, f) => `${i.qty ? `<b>${fmtQty(i.qty * f)}${i.unit ? ' ' + esc(i.unit) : ''}</b> ` : ''}${esc(i.name)}`;
const chips = r => `${totalMin(r) ? `<span class="meta">${ic('clock')}${fmtMin(totalMin(r))}</span>` : ''}<span class="meta">${ic('users')}${r.servings}</span><span class="meta">${ic('flame')}${DIFF[r.difficulty]}</span>`;

function dishRow(date, it) {
  const r = getRecipe(it.recipeId);
  if (!r) return `<div class="dish missing"><span class="muted">Esta receta ya no existe.</span><button class="btn ghost danger sm" data-act="removeDish" data-date="${date}" data-id="${it.id}">Quitar</button></div>`;
  const sv = it.servings || r.servings, f = sv / r.servings;
  return `<div class="dish${it.done ? ' done' : ''}">
    <label class="done-box" title="Marcar como hecho"><input type="checkbox" ${it.done ? 'checked' : ''} data-chg="toggleDone" data-date="${date}" data-id="${it.id}"><span class="sr">Hecho</span></label>
    ${plate(r)}
    <div class="dish-main">
      <button class="dish-name" data-act="openRecipe" data-id="${r.id}">${esc(r.name)}</button>
      <div class="dish-meta">${totalMin(r) ? `<span class="meta">${ic('clock')}${fmtMin(totalMin(r))}</span>` : ''}<span class="meta">${ic('users')}${sv} porc.</span><span class="meta">${r.ingredients.length} ingredientes</span></div>
      <details class="dish-more"><summary>Detalles</summary>
        <div class="dish-edit">
          <label>Hora<input type="time" value="${esc(it.time)}" data-chg="itemTime" data-date="${date}" data-id="${it.id}"></label>
          <label>Comida<select data-chg="itemMeal" data-date="${date}" data-id="${it.id}">${MEALS.map(m => `<option value="${m}" ${m === it.meal ? 'selected' : ''}>${CATS[m].name}</option>`).join('')}</select></label>
          <label>Porciones<span class="stepper"><button class="btn icon sm" data-act="itemServ" data-n="-1" data-date="${date}" data-id="${it.id}" aria-label="Menos porciones">${ic('minus')}</button><b>${sv}</b><button class="btn icon sm" data-act="itemServ" data-n="1" data-date="${date}" data-id="${it.id}" aria-label="Más porciones">${ic('plus')}</button></span></label>
        </div>
        <ul class="ing-list">${r.ingredients.map(i => `<li>${scaled(i, f)}</li>`).join('') || '<li class="muted">Sin ingredientes</li>'}</ul>
        <div class="row"><button class="btn sm" data-act="moveDish" data-date="${date}" data-id="${it.id}">${ic('cal')}Cambiar de día</button><button class="btn ghost danger sm" data-act="removeDish" data-date="${date}" data-id="${it.id}">${ic('trash')}Quitar del día</button></div>
      </details>
    </div>
    <div class="dish-side"><span class="dish-time">${esc(it.time)}</span><button class="btn primary sm" data-act="cookItem" data-date="${date}" data-id="${it.id}" aria-label="Cocinar ${esc(r.name)}">${ic('play', 'fill')}Cocinar</button></div>
  </div>`;
}

function dayPanel(date) {
  const items = dayItems(date);
  const mins = items.reduce((a, it) => a + (getRecipe(it.recipeId) ? totalMin(getRecipe(it.recipeId)) : 0), 0);
  const done = items.filter(i => i.done).length;
  const slots = MEALS.map(m => {
    const list = items.filter(i => i.meal === m);
    return `<section class="slot c-${m}">
      <header class="slot-h"><span class="slot-dot"></span><h3>${CATS[m].name}</h3><span class="muted">${list.length ? list.length + (list.length === 1 ? ' platillo' : ' platillos') : CATS[m].time}</span>
        <button class="btn ghost sm add-slot" data-act="pick" data-date="${date}" data-meal="${m}" aria-label="Añadir a ${CATS[m].name}">${ic('plus')}Añadir</button></header>
      ${list.map(it => dishRow(date, it)).join('') || `<button class="slot-empty" data-act="pick" data-date="${date}" data-meal="${m}">Elegir del recetario o crear una receta</button>`}
    </section>`;
  }).join('');
  return `<div class="day-panel">
    <div class="day-head"><div><h2>${esc(relDay(date))}</h2><p class="muted">${esc(longDate(date))}</p></div>
      <div class="day-stats">${items.length ? `<span class="meta">${ic('list')}${done}/${items.length} hechos</span><span class="meta">${ic('clock')}${fmtMin(mins)} en cocina</span>` : ''}</div></div>
    ${slots}
    ${items.length ? `<div class="row"><button class="btn" data-act="shopDay" data-date="${date}">${ic('cart')}Compras de este día</button></div>` : ''}
  </div>`;
}

/* ───────── vistas ───────── */
function viewToday() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  const t = ymd(new Date());
  // próximo platillo
  let next = null;
  for (let i = 0; i < 14 && !next; i++) {
    const d = ymd(addDays(new Date(), i));
    const it = dayItems(d).find(x => !x.done && getRecipe(x.recipeId) && (i > 0 || x.time >= nowHM()));
    if (it) next = { date: d, it };
  }
  let nextHtml;
  if (next) {
    const r = getRecipe(next.it.recipeId);
    const at = parseYmd(next.date); const [hh, mm] = next.it.time.split(':').map(Number); at.setHours(hh, mm);
    const diff = Math.round((at - Date.now()) / 60000);
    const when = diff <= 0 ? 'Ahora' : diff < 60 * 24 ? `En ${fmtMin(diff)}` : `${relDay(next.date)}, ${next.it.time}`;
    const startBy = totalMin(r) ? new Date(at - totalMin(r) * 60000) : null;
    nextHtml = `<div class="next c-${next.it.meal}">
      ${plate(r, 'xl')}
      <div class="next-body"><p class="next-when">${esc(when)} <span>${CATS[next.it.meal].name} a las ${esc(next.it.time)}</span></p>
        <h2>${esc(r.name)}</h2>
        <div class="dish-meta">${chips(r)}</div>
        ${startBy && diff > 0 ? `<p class="muted">Para tenerlo a tiempo, empieza a las ${pad(startBy.getHours())}:${pad(startBy.getMinutes())}.</p>` : ''}
        <div class="row"><button class="btn primary" data-act="cookItem" data-date="${next.date}" data-id="${next.it.id}">${ic('play', 'fill')}Empezar a cocinar</button><button class="btn" data-act="openRecipe" data-id="${r.id}">Ver receta</button></div></div></div>`;
  } else {
    nextHtml = `<div class="next empty-next">${ic('chef', 'big')}<div class="next-body"><h2>No hay nada planificado</h2><p class="muted">Elige platillos del recetario para los próximos días y aquí verás el siguiente.</p>
      <div class="row"><button class="btn primary" data-act="pick" data-date="${t}" data-meal="${mealFromTime(nowHM())}">${ic('plus')}Planificar hoy</button><button class="btn" data-act="nav" data-view="book">Abrir recetario</button></div></div></div>`;
  }
  // semana
  const off = (new Date().getDay() + 6) % 7;
  const week = Array.from({ length: 7 }, (_, i) => ymd(addDays(new Date(), i - off)));
  const weekHtml = week.map(d => {
    const items = dayItems(d);
    return `<button class="wk${d === t ? ' on' : ''}" data-act="openDay" data-date="${d}" aria-label="${esc(longDate(d))}: ${items.length} platillos"><span class="wk-d">${esc(shortDay(d))}</span><span class="wk-n">${parseYmd(d).getDate()}</span><span class="pips">${items.slice(0, 4).map(i => `<i class="pip c-${i.meal}"></i>`).join('')}</span></button>`;
  }).join('');
  const weekCount = week.reduce((a, d) => a + dayItems(d).length, 0);
  const pending = S.lists.reduce((a, l) => a + l.items.filter(i => !i.checked).length, 0);
  return `<header class="page-h"><div><p class="muted">${esc(longDate(t))}</p><h1>${greet}</h1></div><button class="btn" data-act="timerSheet">${ic('timer')}Temporizador</button></header>
  ${nextHtml}
  <div class="week-wrap"><div class="sec-h"><h2>Esta semana</h2><button class="btn ghost sm" data-act="nav" data-view="month">Ver mes</button></div><div class="week">${weekHtml}</div></div>
  <div class="stats">
    <button class="stat" data-act="nav" data-view="book"><b>${S.recipes.length}</b><span>recetas</span></button>
    <button class="stat" data-act="nav" data-view="month"><b>${weekCount}</b><span>platillos esta semana</span></button>
    <button class="stat" data-act="shopWeek"><b>${pending}</b><span>por comprar</span></button>
  </div>
  <div class="today-day">${dayPanel(t)}</div>`;
}

function viewMonth() {
  const m = ui.month, y = m.getFullYear(), mo = m.getMonth();
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7;
  const days = new Date(y, mo + 1, 0).getDate();
  const t = ymd(new Date());
  let cells = '', total = 0;
  for (let i = 0; i < offset; i++) cells += '<div class="blank"></div>';
  for (let d = 1; d <= days; d++) {
    const date = `${y}-${pad(mo + 1)}-${pad(d)}`;
    const items = dayItems(date);
    total += items.length;
    const names = items.slice(0, 3).map(i => { const r = getRecipe(i.recipeId); return r ? `<span class="nm c-${i.meal}">${esc(r.emoji)} ${esc(r.name)}</span>` : ''; }).join('');
    cells += `<button class="day${date === t ? ' today' : ''}${date === ui.day ? ' sel' : ''}${date < t ? ' past' : ''}" data-act="selectDay" data-date="${date}" aria-label="${esc(longDate(date))}: ${items.length} platillos" aria-pressed="${date === ui.day}">
      <span class="n">${d}</span><span class="pips">${items.slice(0, 5).map(i => `<i class="pip c-${i.meal}"></i>`).join('')}</span>${names}${items.length > 3 ? `<span class="nm more">y ${items.length - 3} más</span>` : ''}</button>`;
  }
  return `<header class="page-h"><div><h1>${esc(monthName(m))}</h1><p class="muted">${total ? `${total} ${total === 1 ? 'platillo planificado' : 'platillos planificados'}` : 'Mes sin planificar todavía'}</p></div>
    <div class="row">${ui.undo ? `<button class="btn ghost" data-act="undoPlan">Deshacer: ${esc(ui.undo.label)}</button>` : ''}<button class="btn primary" data-act="orgDlg">${ic('spark')}Organizar el mes</button><button class="btn icon" data-act="monthShift" data-n="-1" aria-label="Mes anterior">${ic('left')}</button><button class="btn" data-act="monthToday">Hoy</button><button class="btn icon" data-act="monthShift" data-n="1" aria-label="Mes siguiente">${ic('right')}</button></div></header>
  <div class="month-layout">
    <div class="cal-wrap"><div class="cal">${['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(x => `<div class="dow">${x}</div>`).join('')}${cells}</div>
      <div class="legend">${MEALS.map(x => `<span><i class="pip c-${x}"></i>${CATS[x].name}</span>`).join('')}</div></div>
    ${dayPanel(ui.day)}
  </div>`;
}

function filteredRecipes() {
  const q = fold(ui.q);
  let list = S.recipes.filter(r => {
    if (ui.cat === 'fav' && !r.fav) return false;
    if (ui.cat !== 'all' && ui.cat !== 'fav' && r.category !== ui.cat) return false;
    return !q || fold(r.name + ' ' + r.tags.join(' ') + ' ' + r.ingredients.map(i => i.name).join(' ') + ' ' + r.description).includes(q);
  });
  const sorters = { name: (a, b) => a.name.localeCompare(b.name, 'es'), time: (a, b) => totalMin(a) - totalMin(b), new: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) };
  return list.sort(sorters[ui.sort] || sorters.name);
}
function catChips(active, act, cls = '') {
  const all = [['all', 'Todas'], ['fav', 'Favoritas'], ...Object.entries(CATS).map(([k, v]) => [k, v.name])];
  return `<div class="chips ${cls}" role="group" aria-label="Filtrar por categoría">${all.map(([k, n]) => `<button class="chip${k === active ? ' on' : ''}${CATS[k] ? ' c-' + k : ''}" data-act="${act}" data-cat="${k}" aria-pressed="${k === active}">${k === 'fav' ? ic('star', 'fill') : CATS[k] ? '<i class="pip c-' + k + '"></i>' : ''}${n}</button>`).join('')}</div>`;
}
function bookGrid() {
  const list = filteredRecipes();
  if (!list.length) {
    if (!S.recipes.length) return `<div class="empty">${ic('book', 'big')}<h3>Tu recetario está vacío</h3><p>Crea tu primera receta, pide varias a una IA o empieza con 12 recetas de ejemplo que puedes editar.</p>
      <div class="row center"><button class="btn primary" data-act="newRecipe">${ic('plus')}Crear receta</button><button class="btn" data-act="loadSamples">Cargar recetas de ejemplo</button><button class="btn" data-act="importDlg">${ic('spark')}Importar con IA</button></div></div>`;
    return `<div class="empty"><h3>Nada coincide</h3><p>Prueba con otra palabra o quita el filtro.</p><button class="btn" data-act="clearFilters">Quitar filtros</button></div>`;
  }
  const ed = ui.bookEdit, n = ui.sel.size, dis = n ? '' : 'disabled';
  const bar = ed ? `<div class="bulk" role="toolbar" aria-label="Acciones sobre la selección">
      <button class="btn sm" data-act="selAll">${list.every(r => ui.sel.has(r.id)) ? 'Quitar selección' : 'Seleccionar todas'}</button>
      <span class="bulk-n">${n ? `${n} ${n === 1 ? 'seleccionada' : 'seleccionadas'}` : 'Toca las recetas para seleccionarlas'}</span>
      <select data-chg="bulkCat" aria-label="Cambiar categoría" ${dis}><option value="">Cambiar categoría</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>
      <button class="btn sm" data-act="bulkFav" ${dis}>${ic('star')}Favoritas</button>
      <button class="btn sm danger" data-act="bulkDel" ${dis}>${ic('trash')}Eliminar</button></div>` : '';
  return bar + `<div class="book-grid${ed ? ' editing' : ''}">${list.map(r => {
    const sel = ui.sel.has(r.id);
    return `<article class="rcard c-${r.category}${sel ? ' sel' : ''}">
    <button class="rcard-open" data-act="${ed ? 'selToggle' : 'openRecipe'}" data-id="${r.id}" aria-label="${ed ? (sel ? 'Quitar de la selección: ' : 'Seleccionar: ') : 'Abrir '}${esc(r.name)}" ${ed ? `aria-pressed="${sel}"` : ''}></button>
    <div class="rcard-top">${plate(r, 'lg')}${ed ? `<span class="selbox" aria-hidden="true">${sel ? ic('check') : ''}</span>`
      : `<div class="rcard-tools"><button class="fav${r.fav ? ' on' : ''}" data-act="toggleFav" data-id="${r.id}" aria-label="${r.fav ? 'Quitar de favoritas' : 'Marcar como favorita'}" aria-pressed="${r.fav}">${ic('star', r.fav ? 'fill' : '')}</button><button class="fav" data-act="editRecipe" data-id="${r.id}" aria-label="Editar ${esc(r.name)}">${ic('edit')}</button></div>`}</div>
    <span class="rcat">${CATS[r.category].name}</span>
    <h3>${esc(r.name)}</h3>
    ${r.description ? `<p class="rdesc">${esc(r.description)}</p>` : ''}
    <div class="dish-meta">${chips(r)}</div>
    ${ed ? `<div class="row rcard-ed"><button class="btn sm" data-act="editRecipe" data-id="${r.id}">${ic('edit')}Editar</button><button class="btn sm" data-act="dupRecipe" data-id="${r.id}">${ic('copy')}Duplicar</button><button class="btn icon sm danger" data-act="delRecipe" data-id="${r.id}" aria-label="Eliminar ${esc(r.name)}">${ic('trash')}</button></div>`
      : `<button class="btn primary sm rcard-plan" data-act="planDlg" data-recipe="${r.id}">${ic('cal')}Añadir a un día</button>`}
  </article>`;
  }).join('')}</div>`;
}
function viewBook() {
  return `<header class="page-h"><div><h1>Recetario</h1><p class="muted">${S.recipes.length} ${S.recipes.length === 1 ? 'receta' : 'recetas'}. ${ui.bookEdit ? 'Selecciona varias para cambiarlas a la vez, o edita cada una.' : 'Toca una para verla o añádela a un día.'}</p></div>
    <div class="row"><button class="btn${ui.bookEdit ? ' primary' : ''}" data-act="bookEdit" aria-pressed="${ui.bookEdit}">${ic(ui.bookEdit ? 'check' : 'edit')}${ui.bookEdit ? 'Terminar' : 'Organizar'}</button>
    ${ui.bookEdit ? '' : `<button class="btn" data-act="importDlg">${ic('spark')}Importar con IA</button><button class="btn primary" data-act="newRecipe">${ic('plus')}Nueva receta</button>`}</div></header>
  <div class="toolbar"><label class="search">${ic('search')}<input id="q" type="search" placeholder="Busca por nombre, ingrediente o etiqueta" value="${esc(ui.q)}" aria-label="Buscar recetas"></label>
    <select id="sort" data-chg="sort" aria-label="Ordenar"><option value="name" ${ui.sort === 'name' ? 'selected' : ''}>Nombre</option><option value="time" ${ui.sort === 'time' ? 'selected' : ''}>Más rápidas</option><option value="new" ${ui.sort === 'new' ? 'selected' : ''}>Recientes</option></select></div>
  ${catChips(ui.cat, 'bookCat')}
  <div id="bookGrid">${bookGrid()}</div>`;
}

function detectMin(text) {
  const m = String(text).match(/(\d+(?:[.,]\d+)?)\s*(?:a\s*\d+\s*)?(minutos?|min|horas?|h)\b/i);
  if (!m) return 0;
  const v = num(m[1], 0);
  return /^h/i.test(m[2]) ? v * 60 : v;
}

function viewRecipe() {
  const r = getRecipe(ui.recipeId);
  if (!r) { ui.view = 'book'; return viewBook(); }
  const sv = ui.detailServ || r.servings, f = sv / r.servings;
  const t = ymd(new Date());
  const upcoming = Object.entries(S.plan).flatMap(([d, items]) => items.filter(i => i.recipeId === r.id && d >= t).map(i => ({ d, i }))).sort((a, b) => (a.d + a.i.time).localeCompare(b.d + b.i.time));
  return `<div class="rhero c-${r.category}">
    <button class="btn ghost sm back" data-act="nav" data-view="book">${ic('left')}Recetario</button>
    <div class="rhero-body">${plate(r, 'xxl')}
      <div><span class="rcat">${CATS[r.category].name}</span><h1>${esc(r.name)}</h1>
      ${r.description ? `<p class="lead">${esc(r.description)}</p>` : ''}
      <div class="facts">${r.prepMinutes ? `<div><b>${fmtMin(r.prepMinutes)}</b><span>preparación</span></div>` : ''}${r.cookMinutes ? `<div><b>${fmtMin(r.cookMinutes)}</b><span>cocción</span></div>` : ''}${totalMin(r) ? `<div><b>${fmtMin(totalMin(r))}</b><span>en total</span></div>` : ''}<div><b>${r.servings}</b><span>porciones</span></div><div><b>${DIFF[r.difficulty]}</b><span>dificultad</span></div></div>
      ${r.tags.length ? `<div class="tags">${r.tags.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}
      </div></div>
    <div class="row actions"><button class="btn primary" data-act="planDlg" data-recipe="${r.id}">${ic('cal')}Añadir a un día</button><button class="btn" data-act="cookRecipe" data-id="${r.id}">${ic('play', 'fill')}Cocinar ahora</button>
      <button class="btn icon fav${r.fav ? ' on' : ''}" data-act="toggleFav" data-id="${r.id}" aria-label="Favorita" aria-pressed="${r.fav}">${ic('star', r.fav ? 'fill' : '')}</button>
      <button class="btn" data-act="editRecipe" data-id="${r.id}">${ic('edit')}Editar</button><button class="btn" data-act="dupRecipe" data-id="${r.id}">${ic('copy')}Duplicar</button><button class="btn ghost danger" data-act="delRecipe" data-id="${r.id}">${ic('trash')}Eliminar</button></div>
  </div>
  <div class="rcols">
    <section class="panel"><div class="sec-h"><h2>Ingredientes</h2><span class="stepper"><button class="btn icon sm" data-act="detailServ" data-n="-1" aria-label="Menos porciones">${ic('minus')}</button><b>${sv} porc.</b><button class="btn icon sm" data-act="detailServ" data-n="1" aria-label="Más porciones">${ic('plus')}</button></span></div>
      <ul class="ing-list big">${r.ingredients.map(i => `<li>${scaled(i, f)}</li>`).join('') || '<li class="muted">Sin ingredientes</li>'}</ul></section>
    <section class="panel"><div class="sec-h"><h2>Preparación</h2><span class="muted">${r.steps.length} pasos</span></div>
      <ol class="steps">${r.steps.map(s => `<li><p>${esc(s.text)}</p>${s.timer ? `<span class="meta timer-badge">${ic('timer')}${fmtMin(s.timer)}</span>` : ''}</li>`).join('') || '<li class="muted">Sin pasos todavía. Edita la receta para añadirlos.</li>'}</ol>
      ${r.notes ? `<div class="notes"><h3>Notas</h3><p>${esc(r.notes)}</p></div>` : ''}</section>
  </div>
  <section class="panel"><div class="sec-h"><h2>En tu plan</h2></div>
    ${upcoming.length ? `<ul class="upcoming">${upcoming.slice(0, 8).map(({ d, i }) => `<li><button class="link" data-act="openDay" data-date="${d}"><i class="pip c-${i.meal}"></i>${esc(relDay(d))}, ${CATS[i.meal].name.toLowerCase()} a las ${esc(i.time)}</button></li>`).join('')}</ul>` : '<p class="muted">Esta receta no está en ningún día próximo.</p>'}</section>`;
}

/* editor */
function editorRows() {
  const d = ui.draft;
  return {
    ings: d.ingredients.map((i, n) => `<div class="edrow"><input class="i-name" placeholder="Ingrediente" aria-label="Ingrediente ${n + 1}" value="${esc(i.name)}"><input class="i-qty" inputmode="decimal" placeholder="Cant." aria-label="Cantidad" value="${i.qty || ''}"><input class="i-unit" placeholder="Unidad" aria-label="Unidad" value="${esc(i.unit)}" list="units"><button class="btn icon ghost danger" data-act="delIng" data-n="${n}" aria-label="Quitar ingrediente">${ic('x')}</button></div>`).join(''),
    steps: d.steps.map((s, n) => `<div class="edstep"><span class="stepn">${n + 1}</span><textarea class="s-text" placeholder="Describe el paso ${n + 1}" aria-label="Paso ${n + 1}">${esc(s.text)}</textarea>
      <div class="edstep-side"><label class="mini">${ic('timer')}<input class="s-timer" inputmode="decimal" placeholder="min" aria-label="Minutos de temporizador" value="${s.timer || ''}"></label>
      <div class="row nowrap"><button class="btn icon ghost sm" data-act="moveStep" data-n="${n}" data-d="-1" aria-label="Subir paso">${ic('up')}</button><button class="btn icon ghost sm" data-act="moveStep" data-n="${n}" data-d="1" aria-label="Bajar paso">${ic('down')}</button><button class="btn icon ghost danger sm" data-act="delStep" data-n="${n}" aria-label="Quitar paso">${ic('x')}</button></div></div></div>`).join(''),
  };
}
function viewEditor() {
  const d = ui.draft, rows = editorRows();
  return `<header class="page-h sticky-h"><div><h1>${d.id ? 'Editar receta' : 'Nueva receta'}</h1>${ui.pendingPlan ? `<p class="muted">Se añadirá a ${esc(relDay(ui.pendingPlan.date).toLowerCase())}, ${CATS[ui.pendingPlan.meal].name.toLowerCase()}, al guardarla.</p>` : ''}</div>
    <div class="row"><button class="btn" data-act="cancelEdit">Cancelar</button><button class="btn primary" data-act="saveRecipe">${ic('check')}Guardar receta</button></div></header>
  <div class="editor">
  <section class="panel">
    <div class="ed-top">
      <div class="emoji-pick"><button class="plate xl c-${d.category}" data-act="toggleEmoji" aria-label="Cambiar icono" aria-expanded="${!!ui.emojiOpen}">${esc(d.emoji)}</button>
      ${ui.emojiOpen ? `<div class="emoji-grid">${EMOJIS.map(e => `<button data-act="setEmoji" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div>` : ''}</div>
      <div class="grow"><label for="e-name">Nombre</label><input id="e-name" value="${esc(d.name)}" placeholder="Ej. Lentejas con verduras" autocomplete="off">
      <label for="e-desc">Descripción corta</label><input id="e-desc" value="${esc(d.description)}" placeholder="Qué es y por qué te gusta"></div>
    </div>
    <div class="grid2">
      <div><label for="e-cat">Categoría</label><select id="e-cat" data-chg="edCat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === d.category ? 'selected' : ''}>${v.name}</option>`).join('')}</select></div>
      <div><span class="lbl">Dificultad</span><div class="seg" role="radiogroup" aria-label="Dificultad">${Object.entries(DIFF).map(([k, v]) => `<label><input type="radio" name="e-diff" value="${k}" ${k === d.difficulty ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
    </div>
    <div class="grid3">
      <div><label for="e-serv">Porciones</label><input id="e-serv" type="number" min="1" value="${d.servings}"></div>
      <div><label for="e-prep">Preparación (min)</label><input id="e-prep" inputmode="decimal" value="${d.prepMinutes || ''}" placeholder="0"></div>
      <div><label for="e-cook">Cocción (min)</label><input id="e-cook" inputmode="decimal" value="${d.cookMinutes || ''}" placeholder="0"></div>
    </div>
    <label for="e-tags">Etiquetas, separadas por comas</label><input id="e-tags" value="${esc(d.tags.join(', '))}" placeholder="rápido, vegetariano, horno">
  </section>
  <section class="panel"><div class="sec-h"><h2>Ingredientes</h2><span class="muted">Usa siempre la misma unidad para que la lista de compras sume bien.</span></div>
    <div id="ings">${rows.ings}</div><button class="btn" data-act="addIng">${ic('plus')}Añadir ingrediente</button></section>
  <section class="panel"><div class="sec-h"><h2>Pasos</h2><span class="muted">Pon minutos en un paso para tener su temporizador al cocinar.</span></div>
    <div id="steps">${rows.steps}</div><button class="btn" data-act="addStep">${ic('plus')}Añadir paso</button></section>
  <section class="panel"><label for="e-notes"><h2>Notas</h2></label><textarea id="e-notes" placeholder="Variaciones, trucos, dónde la encontraste">${esc(d.notes)}</textarea></section>
  <div class="row end">${d.id ? `<button class="btn ghost danger push-left" data-act="delRecipe" data-id="${d.id}">${ic('trash')}Eliminar receta</button>` : ''}<button class="btn" data-act="cancelEdit">Cancelar</button><button class="btn primary" data-act="saveRecipe">${ic('check')}Guardar receta</button></div>
  </div>
  <datalist id="units">${['g', 'kg', 'ml', 'l', 'taza', 'cda', 'cdita', 'pieza', 'diente', 'pizca', 'lata', 'manojo', 'rebanada', 'filete', 'hoja'].map(u => `<option value="${u}">`).join('')}</datalist>`;
}
function readEditor() {
  const d = ui.draft;
  if (!$('#e-name')) return;
  d.name = $('#e-name').value; d.description = $('#e-desc').value;
  d.category = $('#e-cat').value;
  d.difficulty = ($('input[name=e-diff]:checked') || {}).value || 'facil';
  d.servings = Math.max(1, Math.round(num($('#e-serv').value, 2)) || 2);
  d.prepMinutes = num($('#e-prep').value, 0); d.cookMinutes = num($('#e-cook').value, 0);
  d.tags = $('#e-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  d.notes = $('#e-notes').value;
  d.ingredients = $$('#ings .edrow').map(r => ({ name: $('.i-name', r).value, qty: num($('.i-qty', r).value, 0), unit: $('.i-unit', r).value }));
  d.steps = $$('#steps .edstep').map(r => ({ text: $('.s-text', r).value, timer: num($('.s-timer', r).value, 0) }));
}
function refreshEditorRows() { const rows = editorRows(); $('#ings').innerHTML = rows.ings; $('#steps').innerHTML = rows.steps; }

/* compras: varias listas editables */
const fmtShortDate = s => parseYmd(s).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '');
const fmtRange = (f, t) => f === t ? relDay(f) : `${fmtShortDate(f)} a ${fmtShortDate(t)}`;
const getList = id => S.lists.find(l => l.id === id);
const listStats = l => ({ total: l.items.length, got: l.items.filter(i => i.checked).length });
const itemLine = i => `${i.qty > 0 ? fmtQty(i.qty) + (i.unit ? ' ' + i.unit : '') + ' ' : ''}${i.name}`;
function planToItems(from, to) {
  return aggregate(from, to).map(e => ({ id: uid(), name: e.name, qty: e.qty, unit: e.unit, aisle: e.aisle, checked: false, src: 'plan', pkey: e.key, edited: false, recipes: [...e.from] }));
}
function createList(name, from, to, fromPlan) {
  const l = { id: uid(), name: name.trim() || 'Lista de compras', createdAt: Date.now(), from: fromPlan ? from : '', to: fromPlan ? to : '', items: fromPlan ? planToItems(from, to) : [] };
  S.lists.unshift(l);
  return l;
}
function syncList(l) {
  const res = { added: 0, updated: 0, removed: 0 };
  if (!l.from) return res;
  const agg = aggregate(l.from, l.to), seen = new Set();
  for (const e of agg) {
    seen.add(e.key);
    if ((l.removed || []).includes(e.key)) continue;
    const it = l.items.find(i => i.src === 'plan' && i.pkey === e.key);
    if (it) {
      if (!it.edited && Math.abs(it.qty - e.qty) > 1e-9) { it.qty = e.qty; res.updated++; }
      it.recipes = [...e.from];
    } else {
      l.items.push({ id: uid(), name: e.name, qty: e.qty, unit: e.unit, aisle: e.aisle, checked: false, src: 'plan', pkey: e.key, edited: false, recipes: [...e.from] });
      res.added++;
    }
  }
  const before = l.items.length;
  l.items = l.items.filter(i => !(i.src === 'plan' && !i.edited && !i.checked && !seen.has(i.pkey)));
  res.removed = before - l.items.length;
  return res;
}
function listText(l, onlyPending = true) {
  const groups = {};
  for (const i of l.items) if (!onlyPending || !i.checked) (groups[i.aisle] = groups[i.aisle] || []).push('- ' + itemLine(i));
  const keys = AISLE_NAMES.filter(a => groups[a]);
  return keys.length ? `${l.name}\n\n` + keys.map(k => `${k}\n${groups[k].join('\n')}`).join('\n\n') : '';
}

function viewShop() {
  const lists = S.lists;
  if (!lists.length) {
    return `<header class="page-h"><div><h1>Listas de compras</h1><p class="muted">Crea listas desde lo que planificaste o desde cero, y edítalas a tu gusto.</p></div></header>
    <div class="empty">${ic('cart', 'big')}<h3>Aún no tienes listas</h3><p>La forma más rápida: una lista con los ingredientes de lo que planificaste esta semana. Después puedes editar, quitar o añadir lo que quieras.</p>
      <div class="row center"><button class="btn primary" data-act="quickWeekList">${ic('cal')}Crear lista de esta semana</button><button class="btn" data-act="newList">${ic('plus')}Otra lista</button></div></div>`;
  }
  return `<header class="page-h"><div><h1>Listas de compras</h1><p class="muted">${lists.length} ${lists.length === 1 ? 'lista' : 'listas'}</p></div>
    <button class="btn primary" data-act="newList">${ic('plus')}Nueva lista</button></header>
  <div class="lists-grid">${lists.map(l => {
    const { total, got } = listStats(l);
    const done = total && got === total;
    return `<article class="lcard${done ? ' done' : ''}">
      <button class="rcard-open" data-act="openList" data-id="${l.id}" aria-label="Abrir ${esc(l.name)}"></button>
      <div class="lcard-h">${ic('cart')}<div class="grow"><h3>${esc(l.name)}</h3><p class="muted">${l.from ? `Del plan: ${esc(fmtRange(l.from, l.to))}` : 'Lista libre'}</p></div></div>
      <div class="progress"><div class="bar"><i style="width:${total ? (got / total) * 100 : 0}%"></i></div><span>${done ? 'Completa' : `${got} de ${total}`}</span></div>
      <p class="lprev">${esc(l.items.filter(i => !i.checked).slice(0, 5).map(i => i.name).join(', ')) || '<span class="muted">Sin artículos pendientes</span>'}</p>
      <div class="row lcard-a"><button class="btn sm" data-act="listDup" data-id="${l.id}">${ic('copy')}Duplicar</button><button class="btn ghost danger sm" data-act="listDelete" data-id="${l.id}">${ic('trash')}Eliminar</button></div>
    </article>`;
  }).join('')}</div>`;
}

const aisleSelect = (id, val, withAuto) => `<select id="${id}" aria-label="Pasillo">${withAuto ? `<option value="auto">Pasillo automático</option>` : ''}${AISLE_NAMES.map(a => `<option ${a === val ? 'selected' : ''}>${a}</option>`).join('')}</select>`;
function itemRow(l, i) {
  if (ui.editItem === i.id) {
    return `<li class="item-edit"><div class="ie-grid">
      <label class="ie-name">Artículo<input id="ie-name" value="${esc(i.name)}"></label>
      <label>Cantidad<input id="ie-qty" inputmode="decimal" value="${i.qty || ''}" placeholder="0"></label>
      <label>Unidad<input id="ie-unit" value="${esc(i.unit)}" list="units"></label>
      <label class="ie-aisle">Pasillo${aisleSelect('ie-aisle', i.aisle)}</label></div>
      <div class="row"><button class="btn primary sm" data-act="itemSave" data-id="${i.id}">${ic('check')}Guardar</button><button class="btn sm" data-act="itemCancel">Cancelar</button><button class="btn ghost danger sm" data-act="itemDel" data-id="${i.id}">${ic('trash')}Eliminar</button></div></li>`;
  }
  const src = i.recipes && i.recipes.length ? i.recipes.join(', ') : i.src === 'plan' ? '' : 'Añadido a mano';
  return `<li class="${i.checked ? 'chk' : ''}"><label><input type="checkbox" ${i.checked ? 'checked' : ''} data-chg="itemCheck" data-id="${i.id}"><span class="t">${i.qty > 0 ? `<b>${fmtQty(i.qty)}${i.unit ? ' ' + esc(i.unit) : ''}</b> ` : ''}${esc(i.name)}${src ? `<span class="src">${esc(src)}${i.edited ? ' (editado)' : ''}</span>` : ''}</span></label>
    <button class="btn icon ghost sm" data-act="itemEdit" data-id="${i.id}" aria-label="Editar ${esc(i.name)}">${ic('edit')}</button></li>`;
}
function viewList() {
  const l = getList(ui.listId);
  if (!l) { ui.view = 'shop'; return viewShop(); }
  const { total, got } = listStats(l);
  const pending = l.items.filter(i => !i.checked), cart = l.items.filter(i => i.checked);
  const groups = {};
  for (const i of pending) (groups[i.aisle] = groups[i.aisle] || []).push(i);
  return `<header class="page-h"><div><button class="btn ghost sm back" data-act="nav" data-view="shop">${ic('left')}Listas</button>
      <h1 class="editable"><button class="title-btn" data-act="listRename" data-id="${l.id}" aria-label="Renombrar lista">${esc(l.name)}${ic('edit')}</button></h1>
      <p class="muted">${l.from ? `Ingredientes del plan: ${esc(fmtRange(l.from, l.to))}` : 'Lista libre'}</p></div>
    <div class="row">${l.from ? `<button class="btn" data-act="listSync" data-id="${l.id}" title="Añade lo nuevo del plan y ajusta cantidades sin tocar lo que editaste">${ic('spark')}Actualizar desde el plan</button>` : ''}
      <button class="btn" data-act="listShare" data-id="${l.id}">${ic('share')}Compartir</button></div></header>
  <div class="panel">
    <form class="add-item" data-form="item">
      <label class="ai-name">Añadir artículo<input id="ni-name" placeholder="Ej. Papel de cocina" autocomplete="off"></label>
      <label>Cantidad<input id="ni-qty" inputmode="decimal" placeholder="0"></label>
      <label>Unidad<input id="ni-unit" list="units" placeholder="pieza"></label>
      <label class="ai-aisle">Pasillo${aisleSelect('ni-aisle', '', true)}</label>
      <button class="btn primary">${ic('plus')}Añadir</button>
    </form>
    ${total ? `<div class="progress"><div class="bar"><i style="width:${(got / total) * 100}%"></i></div><span>${got} de ${total} en el carrito</span></div>` : ''}
  </div>
  ${AISLE_NAMES.filter(a => groups[a]).map(a => `<section class="panel aisle"><h2>${a}<span class="muted">${groups[a].length}</span></h2><ul class="shop">${groups[a].map(i => itemRow(l, i)).join('')}</ul></section>`).join('')
    || (total ? `<div class="empty small">${ic('check', 'big')}<h3>Todo en el carrito</h3></div>` : `<div class="empty small"><p>La lista está vacía. Añade artículos arriba${l.from ? ' o actualízala desde el plan' : ''}.</p></div>`)}
  ${cart.length ? `<section class="panel aisle cart"><h2>En el carrito<span class="muted">${cart.length}</span></h2><ul class="shop">${cart.map(i => itemRow(l, i)).join('')}</ul></section>` : ''}
  <div class="row list-tools"><button class="btn sm" data-act="listUncheck" data-id="${l.id}">Desmarcar todo</button><button class="btn sm" data-act="listClearChecked" data-id="${l.id}">Quitar lo comprado</button>
    <button class="btn sm" data-act="listDup" data-id="${l.id}">${ic('copy')}Duplicar lista</button><button class="btn ghost danger sm" data-act="listDelete" data-id="${l.id}">${ic('trash')}Eliminar lista</button></div>
  <datalist id="units">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist>`;
}

/* nueva lista */
function newListDlg(opts = {}) {
  const [wf, wt] = shopPresetRange('week');
  ui.nl = { name: opts.name || `Semana del ${fmtShortDate(wf)}`, mode: opts.mode || 'plan', preset: opts.preset ?? 'week', from: opts.from || wf, to: opts.to || wt };
  renderNewList();
}
function renderNewList() {
  const n = ui.nl;
  const presets = [['today', 'Hoy'], ['week', 'Esta semana'], ['next', 'Próximos 7 días'], ['month', 'Este mes']];
  const items = n.mode === 'plan' ? aggregate(n.from, n.to).length : 0;
  const dishes = Object.entries(S.plan).filter(([d]) => d >= n.from && d <= n.to).reduce((a, [, v]) => a + v.length, 0);
  openDlg(`<div class="dlg-h"><div><p class="muted">Compras</p><h2>Nueva lista</h2></div><button class="btn icon ghost" data-act="closeDlg" aria-label="Cerrar">${ic('x')}</button></div>
  <label for="nl-name">Nombre</label><input id="nl-name" value="${esc(n.name)}">
  <span class="lbl">Empezar con</span>
  <div class="seg" role="group"><button class="${n.mode === 'plan' ? 'on' : ''}" data-act="nlMode" data-mode="plan" aria-pressed="${n.mode === 'plan'}">${ic('cal')}Ingredientes del plan</button><button class="${n.mode === 'empty' ? 'on' : ''}" data-act="nlMode" data-mode="empty" aria-pressed="${n.mode === 'empty'}">${ic('list')}Lista vacía</button></div>
  ${n.mode === 'plan' ? `<div class="chips">${presets.map(([k, t]) => `<button class="chip${n.preset === k ? ' on' : ''}" data-act="nlPreset" data-p="${k}" aria-pressed="${n.preset === k}">${t}</button>`).join('')}</div>
  <div class="grid2"><div><label for="nl-from">Desde</label><input id="nl-from" type="date" value="${n.from}" data-chg="nlRange"></div><div><label for="nl-to">Hasta</label><input id="nl-to" type="date" value="${n.to}" data-chg="nlRange"></div></div>
  <p class="preview">${dishes ? `Incluirá <b>${items} ingredientes</b> de ${dishes} ${dishes === 1 ? 'platillo planificado' : 'platillos planificados'}, ya sumados y ajustados a las porciones.` : 'No hay platillos planificados en esas fechas: la lista empezará vacía, pero podrás actualizarla cuando planifiques.'}</p>` : '<p class="preview">Una lista en blanco para lo que necesites: limpieza, despensa, una fiesta…</p>'}
  <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="nlCreate">${ic('check')}Crear lista</button></div>`);
}
const readNl = () => { if (ui.nl && $('#nl-name')) ui.nl.name = $('#nl-name').value; };

/* cocinar */
function viewCook() {
  const c = ui.cook, r = getRecipe(c.recipeId);
  if (!r) { ui.cook = null; return viewToday(); }
  const f = c.servings / r.servings, n = r.steps.length, step = r.steps[c.step];
  const label = `${r.name}, paso ${c.step + 1}`;
  const side = `<aside class="cook-side">
    <section class="panel"><div class="sec-h"><h2>Ingredientes</h2><span class="stepper"><button class="btn icon sm" data-act="cookServ" data-n="-1" aria-label="Menos porciones">${ic('minus')}</button><b>${c.servings} porc.</b><button class="btn icon sm" data-act="cookServ" data-n="1" aria-label="Más porciones">${ic('plus')}</button></span></div>
      <ul class="checklist">${r.ingredients.map((i, k) => `<li class="${c.got[k] ? 'chk' : ''}"><label><input type="checkbox" ${c.got[k] ? 'checked' : ''} data-chg="cookGot" data-k="${k}"><span>${scaled(i, f)}</span></label></li>`).join('')}</ul></section>
    <section class="panel"><h2>Pasos</h2><ol class="steplist">${r.steps.map((s, k) => `<li class="${k < c.step ? 'past' : k === c.step ? 'now' : ''}"><button data-act="cookGo" data-n="${k}"><span class="stepn">${k < c.step ? ic('check') : k + 1}</span><span>${esc(s.text)}</span></button></li>`).join('')}</ol></section>
  </aside>`;
  let main;
  if (!n) main = `<div class="panel empty">Esta receta no tiene pasos. <button class="btn" data-act="editRecipe" data-id="${r.id}">Añadir pasos</button></div>`;
  else if (c.step >= n) main = `<div class="stepcard finish">${plate(r, 'xxl')}<h2>Listo, a la mesa</h2><p class="muted">Terminaste ${esc(r.name)}.</p>
      <div class="nav2"><button class="btn lg" data-act="cookPrev">${ic('left')}Volver al último paso</button><button class="btn primary lg" data-act="cookFinish">${ic('check')}Marcar como hecho y salir</button></div></div>`;
  else {
    const sugg = !step.timer ? detectMin(step.text) : 0;
    main = `<div class="stepcard">
      <div class="progress"><div class="bar"><i style="width:${(c.step / n) * 100}%"></i></div><span>Paso ${c.step + 1} de ${n}</span></div>
      <p class="steptext">${esc(step.text)}</p>
      ${step.timer ? `<button class="btn primary lg wide" data-act="startTimer" data-min="${step.timer}" data-label="${esc(label)}">${ic('timer')}Iniciar temporizador de ${fmtMin(step.timer)}</button>` : ''}
      ${sugg ? `<button class="btn lg wide" data-act="startTimer" data-min="${sugg}" data-label="${esc(label)}">${ic('timer')}El paso menciona ${fmtMin(sugg)}: iniciar temporizador</button>` : ''}
      <div class="row nowrap custom-t"><input id="ct-min" inputmode="decimal" placeholder="Otro tiempo, en minutos" aria-label="Minutos del temporizador"><button class="btn" data-act="customTimer" data-label="${esc(label)}">${ic('timer')}Iniciar</button></div>
      <div class="nav2"><button class="btn lg" data-act="cookPrev" ${c.step === 0 ? 'disabled' : ''}>${ic('left')}Anterior</button><button class="btn primary lg" data-act="cookNext">${c.step === n - 1 ? 'Terminar' : 'Siguiente'}${ic(c.step === n - 1 ? 'check' : 'right')}</button></div>
    </div>`;
  }
  return `<header class="page-h cook-h"><div class="row nowrap">${plate(r)}<div><p class="muted">Cocinando</p><h1>${esc(r.name)}</h1></div></div><button class="btn" data-act="cookExit">${ic('x')}Salir</button></header>
  <div class="cook-grid"><div class="cook-main">${main}<div class="ring-host cook-rings"></div></div>${side}</div>`;
}

/* más */
function viewMore() {
  return `<header class="page-h"><div><h1>Más</h1><p class="muted">IA, respaldo y ajustes.</p></div></header>
  <div class="more-grid">
  <section class="panel"><h2>${ic('spark')}Recetas con IA</h2><p>Copia el prompt, pégalo en tu IA (ChatGPT, Claude, Gemini…) y describe lo que quieres. Pega aquí su respuesta. La IA también puede organizar tu mes.</p>
    <div class="row"><button class="btn primary" data-act="importDlg">Importar respuesta de la IA</button><button class="btn" data-act="copyPrompt">${ic('copy')}Copiar prompt</button></div></section>
  <section class="panel"><h2>${ic('book')}Recetas de ejemplo</h2><p>Añade 12 recetas variadas (desayunos, almuerzos, cenas, merienda y postre) para empezar. No duplica las que ya tengas.</p>
    <button class="btn" data-act="loadSamples">Cargar recetas de ejemplo</button></section>
  <section class="panel"><h2>${ic('down')}Respaldo</h2><p>Todo se guarda solo en este dispositivo. Exporta un respaldo para guardarlo o pasarlo a tu otro dispositivo.</p>
    <div class="row"><button class="btn primary" data-act="exportAll">${ic('down')}Exportar respaldo</button><button class="btn" data-act="pickBackup">${ic('up')}Importar respaldo</button><button class="btn" data-act="exportRecipes">Exportar solo recetas</button></div>
    <input id="backupFile" type="file" accept="application/json,.json" hidden></section>
  <section class="panel"><h2>${ic('bell')}Avisos del temporizador</h2><p>Permite notificaciones para que el temporizador te avise aunque cambies de app.</p>
    <button class="btn" data-act="askNotif">Activar notificaciones</button></section>
  <section class="panel"><h2>${ic('trash')}Borrar datos</h2><p>Elimina todas las recetas, el plan y la lista de compras de este dispositivo.</p><button class="btn danger" data-act="wipe">Borrar todo</button></section>
  </div>
  <p class="muted center">${S.recipes.length} recetas, ${planCount()} platillos planificados.</p>`;
}

/* ───────── render ───────── */
const VIEWS = { today: viewToday, month: viewMonth, book: viewBook, recipe: viewRecipe, editor: viewEditor, shop: viewShop, list: viewList, cook: viewCook, more: viewMore };
const NAV_OF = { today: 'today', month: 'month', book: 'book', recipe: 'book', editor: 'book', shop: 'shop', list: 'shop', more: 'more', cook: '' };
function render() {
  document.body.dataset.view = ui.view;
  $('#view').innerHTML = VIEWS[ui.view]();
  $$('#nav [data-view]').forEach(b => { const on = b.dataset.view === NAV_OF[ui.view]; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  renderTimers();
}
function go(view) { ui.view = view; render(); window.scrollTo(0, 0); }

/* ───────── diálogos ───────── */
const dlg = $('#dlg');
function openDlg(html) { dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); }
function closeDlg() { if (dlg.open) dlg.close(); ui.pick = null; ui.pd = null; ui.nl = null; ui.org = null; }
dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(); });
dlg.addEventListener('close', () => { ui.pick = null; ui.pd = null; });

function dayChips(selected, act) {
  const days = Array.from({ length: 8 }, (_, i) => ymd(addDays(new Date(), i)));
  return `<div class="chips scroll">${days.map(d => `<button class="chip${d === selected ? ' on' : ''}" data-act="${act}" data-date="${d}" aria-pressed="${d === selected}">${d === days[0] ? 'Hoy' : d === days[1] ? 'Mañana' : `${cap(shortDay(d))} ${parseYmd(d).getDate()}`}</button>`).join('')}</div>`;
}
function mealSeg(selected, act) {
  return `<div class="seg" role="group" aria-label="Comida">${MEALS.map(m => `<button class="c-${m}${m === selected ? ' on' : ''}" data-act="${act}" data-meal="${m}" aria-pressed="${m === selected}"><i class="pip c-${m}"></i>${CATS[m].name}</button>`).join('')}</div>`;
}

/* Añadir una receta a un día (desde el recetario) */
function planDlg(recipeId, date, meal) {
  const r = getRecipe(recipeId);
  if (!r) return;
  const m = meal || (MEALS.includes(r.category) ? r.category : 'almuerzo');
  ui.pd = ui.pd && ui.pd.recipeId === recipeId ? ui.pd : { recipeId, date: date || ymd(new Date()), meal: m, time: CATS[m].time, servings: r.servings };
  renderPlanDlg();
}
function renderPlanDlg() {
  const p = ui.pd, r = getRecipe(p.recipeId);
  openDlg(`<div class="dlg-h">${plate(r)}<div><p class="muted">Añadir al plan</p><h2>${esc(r.name)}</h2></div><button class="btn icon ghost" data-act="closeDlg" aria-label="Cerrar">${ic('x')}</button></div>
  <span class="lbl">Día</span>${dayChips(p.date, 'pdDate')}
  <input id="pd-date" type="date" value="${p.date}" data-chg="pdDateInput" aria-label="Otra fecha">
  <span class="lbl">Comida</span>${mealSeg(p.meal, 'pdMeal')}
  <div class="grid2"><div><label for="pd-time">Hora prevista</label><input id="pd-time" type="time" value="${p.time}"></div>
  <div><span class="lbl">Porciones</span><span class="stepper"><button class="btn icon" data-act="pdServ" data-n="-1" aria-label="Menos porciones">${ic('minus')}</button><b id="pd-serv">${p.servings}</b><button class="btn icon" data-act="pdServ" data-n="1" aria-label="Más porciones">${ic('plus')}</button></span></div></div>
  <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="planSave">${ic('check')}Añadir a ${esc(relDay(p.date).toLowerCase())}</button></div>`);
}
const readPd = () => { if (ui.pd && $('#pd-time')) ui.pd.time = $('#pd-time').value || ui.pd.time; };

/* Elegir del recetario para un día (desde el día) */
function pickDlg(date, meal) {
  ui.pick = { date, meal, time: CATS[meal].time, q: '', cat: 'all', added: [] };
  renderPick();
}
function pickList() {
  const p = ui.pick, q = fold(p.q);
  const list = S.recipes.filter(r => (p.cat === 'all' || (p.cat === 'fav' ? r.fav : r.category === p.cat)) && (!q || fold(r.name + ' ' + r.tags.join(' ') + ' ' + r.ingredients.map(i => i.name).join(' ')).includes(q)))
    .sort((a, b) => (b.category === p.meal) - (a.category === p.meal) || (b.fav - a.fav) || a.name.localeCompare(b.name, 'es'));
  if (!S.recipes.length) return `<div class="empty small"><p>Tu recetario está vacío.</p><button class="btn" data-act="loadSamplesPick">Cargar recetas de ejemplo</button></div>`;
  if (!list.length) return `<div class="empty small"><p>Ninguna receta coincide.</p></div>`;
  return list.map(r => {
    const n = p.added.filter(x => x === r.id).length;
    return `<div class="pick-row c-${r.category}">${plate(r)}<div class="grow"><b>${esc(r.name)}</b><div class="dish-meta">${chips(r)}</div></div>
      <button class="btn ${n ? 'ok' : 'primary'} sm" data-act="pickAdd" data-id="${r.id}">${n ? ic('check') + (n > 1 ? `Añadida ×${n}` : 'Añadida') : ic('plus') + 'Añadir'}</button></div>`;
  }).join('');
}
function renderPick() {
  const p = ui.pick;
  openDlg(`<div class="dlg-h"><div><p class="muted">${esc(longDate(p.date))}</p><h2>Añadir a ${CATS[p.meal].name.toLowerCase()}</h2></div><button class="btn icon ghost" data-act="closeDlg" aria-label="Cerrar">${ic('x')}</button></div>
  ${mealSeg(p.meal, 'pickMeal')}
  <div class="grid2"><div><label for="pk-date">Día</label><input id="pk-date" type="date" value="${p.date}" data-chg="pickDate"></div><div><label for="pk-time">Hora</label><input id="pk-time" type="time" value="${p.time}" data-chg="pickTime"></div></div>
  <button class="create-new" data-act="pickNew">${ic('plus')}<span><b>Crear una receta nueva</b><span class="muted">Empieza de cero; se añadirá a este día al guardarla.</span></span></button>
  <label class="search">${ic('search')}<input id="pk-q" type="search" placeholder="Busca en tu recetario" value="${esc(p.q)}" aria-label="Buscar en el recetario"></label>
  ${catChips(p.cat, 'pickCat', 'scroll-sm')}
  <div id="pickList" class="pick-list">${pickList()}</div>
  <div class="dlg-f"><span class="muted">${p.added.length ? `${p.added.length} ${p.added.length === 1 ? 'añadida' : 'añadidas'}` : ''}</span><button class="btn primary" data-act="closeDlg">Listo</button></div>`);
}

const AI_PROMPT = `Eres un asistente de cocina. Responde ÚNICAMENTE con un JSON válido (sin texto adicional; puede ir dentro de un bloque \`\`\`json) con este formato:

{
  "schema": "planner/2",
  "recipes": [
    {
      "name": "Nombre de la receta",
      "emoji": "🍲",
      "category": "almuerzo",
      "difficulty": "facil",
      "description": "Descripción breve",
      "servings": 4,
      "prepMinutes": 15,
      "cookMinutes": 30,
      "tags": ["vegetariano", "económico"],
      "ingredients": [
        { "name": "Lentejas", "quantity": 300, "unit": "g" },
        { "name": "Sal", "quantity": 0, "unit": "" }
      ],
      "steps": [
        { "text": "Enjuaga las lentejas.", "timerMinutes": 0 },
        { "text": "Cocina a fuego medio hasta que estén tiernas.", "timerMinutes": 25 }
      ],
      "notes": "Opcional"
    }
  ],
  "plan": [
    { "date": "2026-11-20", "recipe": "Nombre de la receta", "meal": "almuerzo", "time": "13:30", "servings": 4 }
  ]
}

Reglas:
- "category": desayuno, almuerzo, merienda, cena, postre u otro. "difficulty": facil, media o dificil. "emoji": un solo emoji de comida.
- "quantity" es un número (0 si es "al gusto"). "unit" corta: g, kg, ml, l, taza, cda, cdita, pieza, diente, lata…
- "timerMinutes" solo si el paso requiere esperar; si no, 0. Un paso = una acción clara.
- "plan" es opcional. "recipe" debe coincidir exactamente con un "name" de "recipes" (o con una receta que ya tengo). "meal": desayuno, almuerzo, merienda o cena. Fechas AAAA-MM-DD, horas HH:MM (24 h).
- Usa nombres de ingredientes y unidades consistentes entre recetas para que la lista de compras sume bien.

Lo que quiero: [DESCRIBE AQUÍ: tipo de comida, porciones, restricciones, presupuesto, cuántos días o semanas planificar…]`;

function importDlg() {
  openDlg(`<div class="dlg-h"><div><p class="muted">Recetas con IA</p><h2>Importar respuesta de la IA</h2></div><button class="btn icon ghost" data-act="closeDlg" aria-label="Cerrar">${ic('x')}</button></div>
  <ol class="howto"><li>Copia el prompt y pégalo en tu IA, describiendo lo que quieres al final.</li><li>Copia su respuesta completa.</li><li>Pégala aquí abajo e importa.</li></ol>
  <div class="row"><button class="btn" data-act="copyPrompt">${ic('copy')}Copiar prompt</button><button class="btn ghost" data-act="togglePrompt">Ver prompt</button></div>
  <pre class="prompt" id="promptPre" hidden>${esc(AI_PROMPT)}</pre>
  <label for="imp-text">Respuesta de la IA</label><textarea id="imp-text" placeholder='{"recipes": [ … ]}' style="min-height:170px"></textarea>
  <div class="row"><label class="btn ghost sm file">${ic('up')}Elegir archivo .json<input id="imp-file" type="file" accept="application/json,.json,.txt" hidden></label>
    <label class="check"><input type="checkbox" id="imp-replace"> Reemplazar recetas con el mismo nombre</label></div>
  <p id="imp-msg" class="err" role="alert"></p>
  <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="doImport">${ic('check')}Importar</button></div>`);
}

function moveDlg(date, id) {
  openDlg(`<div class="dlg-h"><div><h2>Cambiar de día</h2></div><button class="btn icon ghost" data-act="closeDlg" aria-label="Cerrar">${ic('x')}</button></div>
  ${dayChips(date, 'moveTo').replace(/data-act="moveTo"/g, `data-act="moveTo" data-from="${date}" data-id="${id}"`)}
  <label for="mv-date">Otra fecha</label><input id="mv-date" type="date" value="${date}">
  <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="moveToInput" data-from="${date}" data-id="${id}">Mover</button></div>`);
}

function extractJSON(text) {
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.search(/[\[{]/);
  if (a < 0) throw new Error('no encontré JSON en el texto pegado');
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  return t.slice(a, end + 1);
}
function importAI(text, replace) {
  if (!String(text).trim()) throw new Error('Pega primero la respuesta de la IA.');
  let data;
  try { data = JSON.parse(extractJSON(text)); } catch (e) { throw new Error('El JSON no es válido (' + e.message + '). Pide a la IA que responda solo con el JSON.'); }
  const rawRecipes = Array.isArray(data) ? data : Array.isArray(data.recipes ?? data.recetas) ? (data.recipes ?? data.recetas) : (data.name || data.nombre) ? [data] : [];
  const rawPlan = !Array.isArray(data) && Array.isArray(data.plan) ? data.plan : [];
  if (!rawRecipes.length && !rawPlan.length) throw new Error('El JSON no trae recetas ni plan.');
  const cleaned = rawRecipes.map((r, i) => { try { return cleanRecipe(r); } catch (e) { throw new Error(`Receta ${i + 1}: ${e.message}.`); } });
  let added = 0, updated = 0;
  const staged = S.recipes.map(r => ({ ...r }));
  const nameMap = new Map();
  for (const c of cleaned) {
    const ex = staged.find(r => fold(r.name) === fold(c.name));
    if (ex && replace) { Object.assign(ex, c); updated++; nameMap.set(fold(c.name), ex.id); }
    else {
      let name = c.name;
      if (ex) { let k = 2; while (staged.some(r => fold(r.name) === fold(`${c.name} (${k})`))) k++; name = `${c.name} (${k})`; }
      const id = uid();
      staged.push({ ...c, name, id, fav: false, createdAt: Date.now() }); added++;
      nameMap.set(fold(c.name), id);
    }
  }
  let planned = 0; const skipped = []; const adds = [];
  for (const p of rawPlan) {
    const date = String(p?.date ?? p?.fecha ?? '');
    const rname = fold(p?.recipe ?? p?.receta ?? '');
    const id = nameMap.get(rname) || staged.find(r => fold(r.name) === rname)?.id;
    if (!validDate(date) || !id) { skipped.push(rname || date || '?'); continue; }
    const time = validTime(p.time ?? p.hora) ? (p.time ?? p.hora) : null;
    const meal = MEALS.includes(fold(p.meal ?? p.comida ?? '')) ? fold(p.meal ?? p.comida) : time ? mealFromTime(time) : 'almuerzo';
    adds.push({ date, item: { id: uid(), recipeId: id, meal, time: time || CATS[meal].time, servings: Math.round(num(p.servings ?? p.porciones, 0)) || 0, done: false } });
  }
  S.recipes = staged;
  for (const { date, item } of adds) { (S.plan[date] = S.plan[date] || []).push(item); planned++; }
  return { added, updated, planned, skipped };
}

/* ───────── organizar el mes con el recetario ───────── */
function monthRange(p) {
  const m = ui.month, y = m.getFullYear(), mo = m.getMonth();
  const first = ymd(new Date(y, mo, 1)), last = ymd(new Date(y, mo + 1, 0)), t = ymd(new Date());
  if (p === 'rest') return [t > first && t <= last ? t : first, last];
  if (p === 'next') return shopPresetRange('next');
  return [first, last];
}
const MEAL_FALLBACK = { desayuno: ['desayuno'], almuerzo: ['almuerzo', 'cena', 'otro'], cena: ['cena', 'almuerzo', 'otro'], merienda: ['merienda', 'postre', 'otro'] };
function candidatesFor(meal, pool) {
  const exact = pool.filter(r => r.category === meal);
  return exact.length ? exact : pool.filter(r => MEAL_FALLBACK[meal].includes(r.category));
}
function buildPlan(o) {
  const pool = S.recipes.filter(r => o.source !== 'fav' || r.fav);
  const out = [], last = new Map();
  let day = parseYmd(o.from), idx = 0;
  while (ymd(day) <= o.to && idx < 400) {
    const d = ymd(day);
    for (const meal of MEALS) {
      if (!o.meals.includes(meal)) continue;
      const existing = (S.plan[d] || []).filter(i => i.meal === meal);
      existing.forEach(i => last.set(i.recipeId, idx));
      if (existing.length && o.skipFilled) continue;
      const c = candidatesFor(meal, pool);
      if (!c.length) continue;
      const since = r => last.has(r.id) ? idx - last.get(r.id) : 9999;
      const fresh = c.filter(r => since(r) > o.gap);
      const choices = fresh.length ? fresh : c;
      const best = Math.max(...choices.map(since));
      const top = choices.filter(r => since(r) === best);
      const r = top[Math.floor(Math.random() * top.length)];
      last.set(r.id, idx);
      out.push({ date: d, meal, recipeId: r.id });
    }
    day = addDays(day, 1); idx++;
  }
  return out;
}
function orgDlg() {
  const [f, t] = monthRange('rest');
  ui.org = { mode: 'auto', preset: 'rest', from: f, to: t, meals: ['almuerzo', 'cena'], source: 'all', skipFilled: true, gap: 4, preview: [] };
  orgRefresh();
}
function orgRefresh() { ui.org.preview = buildPlan(ui.org); renderOrg(); }
const planPrompt = o => `Organiza mi menú usando SOLO recetas de esta lista (son las de mi recetario):
${S.recipes.map(r => `- ${r.name} (${CATS[r.category].name.toLowerCase()})`).join('\n')}

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, con este formato:
{
  "plan": [
    { "date": "${o.from}", "recipe": "Nombre exacto de la lista", "meal": "almuerzo", "time": "13:30", "servings": 2 }
  ]
}

Reglas:
- "recipe" debe ser exactamente uno de los nombres de la lista.
- "meal": desayuno, almuerzo, merienda o cena. "time" en HH:MM (24 h). "servings" es opcional.
- Fechas en formato AAAA-MM-DD, entre ${o.from} y ${o.to}.
- Evita repetir la misma receta en días seguidos.

Lo que quiero: [DESCRIBE AQUÍ: qué comidas planificar, qué días, para cuántas personas, preferencias…]`;
function renderOrg() {
  const o = ui.org;
  const presets = [['rest', 'Resto del mes'], ['month', 'Todo el mes'], ['next', 'Próximos 7 días']];
  let body;
  if (o.mode === 'auto') {
    const byDay = {};
    for (const p of o.preview) (byDay[p.date] = byDay[p.date] || []).push(p);
    const days = Object.keys(byDay).sort();
    const pool = S.recipes.filter(r => o.source !== 'fav' || r.fav);
    const missing = o.meals.filter(m => !candidatesFor(m, pool).length);
    body = `<span class="lbl">Fechas</span>
    <div class="chips">${presets.map(([k, n]) => `<button class="chip${o.preset === k ? ' on' : ''}" data-act="orgPreset" data-p="${k}" aria-pressed="${o.preset === k}">${n}</button>`).join('')}</div>
    <div class="grid2"><div><label for="og-from">Desde</label><input id="og-from" type="date" value="${o.from}" data-chg="orgRange"></div><div><label for="og-to">Hasta</label><input id="og-to" type="date" value="${o.to}" data-chg="orgRange"></div></div>
    <span class="lbl">Comidas a llenar</span>
    <div class="chips">${MEALS.map(m => `<button class="chip c-${m}${o.meals.includes(m) ? ' on' : ''}" data-act="orgMeal" data-meal="${m}" aria-pressed="${o.meals.includes(m)}"><i class="pip c-${m}"></i>${CATS[m].name}</button>`).join('')}</div>
    <div class="grid2"><div><span class="lbl">Recetas</span><div class="seg" role="group"><button class="${o.source === 'all' ? 'on' : ''}" data-act="orgSource" data-s="all" aria-pressed="${o.source === 'all'}">Todo el recetario</button><button class="${o.source === 'fav' ? 'on' : ''}" data-act="orgSource" data-s="fav" aria-pressed="${o.source === 'fav'}">${ic('star', 'fill')}Favoritas</button></div></div>
      <div><label for="og-gap">No repetir una receta en</label><select id="og-gap" data-chg="orgGap">${[1, 2, 3, 4, 5, 7].map(g => `<option value="${g}" ${g === o.gap ? 'selected' : ''}>${g} ${g === 1 ? 'día' : 'días'}</option>`).join('')}</select></div></div>
    <label class="check og-skip"><input type="checkbox" id="og-skip" data-chg="orgSkip" ${o.skipFilled ? 'checked' : ''}> Respetar las comidas que ya planifiqué</label>
    ${missing.length ? `<p class="warn">No hay recetas de ${missing.map(m => CATS[m].name.toLowerCase()).join(' ni ')} ${o.source === 'fav' ? 'entre tus favoritas' : 'en el recetario'}; esas comidas quedarán vacías.</p>` : ''}
    <div class="org-prev"><div class="sec-h"><h3>${o.preview.length ? `${o.preview.length} platillos en ${days.length} ${days.length === 1 ? 'día' : 'días'}` : 'Nada que añadir'}</h3>${o.preview.length ? `<button class="btn ghost sm" data-act="orgShuffle">${ic('spark')}Mezclar otra vez</button>` : ''}</div>
      ${days.length ? `<ul class="org-list">${days.slice(0, 10).map(d => `<li><b>${esc(cap(shortDay(d)))} ${parseYmd(d).getDate()}</b><span>${byDay[d].map(p => { const r = getRecipe(p.recipeId); return `<span class="org-it c-${p.meal}"><i class="pip c-${p.meal}"></i>${esc(r.emoji)} ${esc(r.name)}</span>`; }).join('')}</span></li>`).join('')}</ul>${days.length > 10 ? `<p class="muted">y ${days.length - 10} días más.</p>` : ''}`
        : `<p class="muted">${o.meals.length ? 'Esas comidas ya están planificadas en estas fechas, o no hay recetas que encajen.' : 'Elige al menos una comida.'}</p>`}</div>
    <button class="link danger-link" data-act="orgClear">Quitar todo lo planificado entre estas fechas</button>
    <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="orgApply" ${o.preview.length ? '' : 'disabled'}>${ic('check')}Añadir ${o.preview.length} al calendario</button></div>`;
  } else {
    body = `<ol class="howto"><li>Copia el prompt: ya incluye los nombres de tus ${S.recipes.length} recetas.</li><li>Pégalo en tu IA y dile cómo quieres organizar el mes.</li><li>Pega aquí su respuesta. Solo se usan recetas de tu recetario.</li></ol>
    <div class="grid2"><div><label for="og-from">Desde</label><input id="og-from" type="date" value="${o.from}" data-chg="orgRange"></div><div><label for="og-to">Hasta</label><input id="og-to" type="date" value="${o.to}" data-chg="orgRange"></div></div>
    <div class="row" style="margin-top:12px"><button class="btn" data-act="orgCopyPrompt">${ic('copy')}Copiar prompt</button></div>
    <label for="og-text">Calendario en JSON</label><textarea id="og-text" placeholder='{"plan": [{"date": "${o.from}", "recipe": "…", "meal": "cena"}]}' style="min-height:150px"></textarea>
    <label class="btn ghost sm file">${ic('up')}Elegir archivo .json<input id="og-file" type="file" accept="application/json,.json,.txt" hidden></label>
    <p id="og-msg" class="err" role="alert"></p>
    <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="orgImport">${ic('check')}Importar calendario</button></div>`;
  }
  openDlg(`<div class="dlg-h"><div><p class="muted">${esc(monthName(ui.month))}</p><h2>Organizar el mes</h2></div><button class="btn icon ghost" data-act="closeDlg" aria-label="Cerrar">${ic('x')}</button></div>
  <div class="seg" role="group"><button class="${o.mode === 'auto' ? 'on' : ''}" data-act="orgMode" data-mode="auto" aria-pressed="${o.mode === 'auto'}">${ic('book')}Armar con mi recetario</button><button class="${o.mode === 'import' ? 'on' : ''}" data-act="orgMode" data-mode="import" aria-pressed="${o.mode === 'import'}">${ic('up')}Importar calendario</button></div>
  ${body}`);
}
const snapshotPlan = label => { ui.undo = { plan: JSON.stringify(S.plan), label }; };

/* ───────── ayudas ───────── */
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); return true; }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove(); toast(ok ? okMsg : 'No se pudo copiar'); return ok;
  }
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const exportRecipe = r => ({ name: r.name, emoji: r.emoji, category: r.category, difficulty: r.difficulty, description: r.description, servings: r.servings, prepMinutes: r.prepMinutes, cookMinutes: r.cookMinutes, tags: r.tags, ingredients: r.ingredients.map(i => ({ name: i.name, quantity: i.qty, unit: i.unit })), steps: r.steps.map(s => ({ text: s.text, timerMinutes: s.timer })), notes: r.notes });
const findItem = (date, id) => (S.plan[date] || []).find(i => i.id === id);
function addToPlan(date, recipeId, meal, time, servings) {
  const r = getRecipe(recipeId);
  (S.plan[date] = S.plan[date] || []).push({ id: uid(), recipeId, meal, time: validTime(time) ? time : CATS[meal].time, servings: servings || r.servings, done: false });
}
function startCook(recipeId, servings, ref) {
  const r = getRecipe(recipeId);
  ui.cook = { recipeId, servings: servings || r.servings, step: 0, got: {}, ref };
  requestWake(); go('cook');
}

/* ───────── acciones ───────── */
const A = {
  nav: d => { if (d.view === 'month') ui.month = new Date(parseYmd(ui.day).getFullYear(), parseYmd(ui.day).getMonth(), 1); go(d.view); },
  monthShift: d => { ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + Number(d.n), 1); render(); },
  monthToday: () => { const t = new Date(); ui.month = new Date(t.getFullYear(), t.getMonth(), 1); ui.day = ymd(t); render(); },
  selectDay: d => { ui.day = d.date; render(); if (innerWidth < 1100) $('.day-panel')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); },
  openDay: d => { closeDlg(); ui.day = d.date; const x = parseYmd(d.date); ui.month = new Date(x.getFullYear(), x.getMonth(), 1); go('month'); },
  closeDlg,

  /* plan desde receta */
  planDlg: d => { ui.pd = null; planDlg(d.recipe); },
  pdDate: d => { readPd(); ui.pd.date = d.date; renderPlanDlg(); },
  pdMeal: d => { readPd(); ui.pd.meal = d.meal; ui.pd.time = CATS[d.meal].time; renderPlanDlg(); },
  pdServ: d => { readPd(); ui.pd.servings = Math.max(1, ui.pd.servings + Number(d.n)); renderPlanDlg(); },
  planSave: async () => {
    readPd();
    const p = ui.pd;
    if (!validDate(p.date)) return toast('Elige un día válido');
    addToPlan(p.date, p.recipeId, p.meal, p.time, p.servings);
    await save();
    const r = getRecipe(p.recipeId);
    closeDlg(); render();
    toast(`${r.name}: añadida a ${relDay(p.date).toLowerCase()}, ${CATS[p.meal].name.toLowerCase()}`);
  },

  /* elegir del recetario */
  pick: d => pickDlg(d.date, d.meal),
  pickMeal: d => { ui.pick.meal = d.meal; ui.pick.time = CATS[d.meal].time; renderPick(); },
  pickCat: d => { ui.pick.cat = d.cat; renderPick(); },
  pickAdd: async d => {
    const p = ui.pick;
    if (!validDate(p.date)) return toast('Elige un día válido');
    addToPlan(p.date, d.id, p.meal, p.time);
    p.added.push(d.id);
    await save();
    $('#pickList').innerHTML = pickList();
    $('.dlg-f .muted').textContent = `${p.added.length} ${p.added.length === 1 ? 'añadida' : 'añadidas'}`;
    render();
    toast(`${getRecipe(d.id).name}: añadida a ${CATS[p.meal].name.toLowerCase()}`);
  },
  pickNew: () => { const p = ui.pick; ui.pendingPlan = { date: p.date, meal: p.meal, time: p.time }; closeDlg(); A.newRecipe({ cat: p.meal }); },
  loadSamplesPick: async () => { addSamples(); await save(); renderPick(); },

  removeDish: async d => {
    S.plan[d.date] = (S.plan[d.date] || []).filter(i => i.id !== d.id);
    if (!S.plan[d.date].length) delete S.plan[d.date];
    await save(); render(); toast('Quitado del día');
  },
  itemServ: async d => { const it = findItem(d.date, d.id), r = getRecipe(it.recipeId); it.servings = Math.max(1, (it.servings || r.servings) + Number(d.n)); await save(); keepOpen(() => render()); },
  moveDish: d => moveDlg(d.date, d.id),
  moveTo: async d => moveItem(d.from, d.id, d.date),
  moveToInput: async d => moveItem(d.from, d.id, $('#mv-date').value),
  shopDay: d => newListDlg({ name: `Compras de ${relDay(d.date).toLowerCase()}`, from: d.date, to: d.date, preset: '' }),
  shopWeek: () => go('shop'),

  /* organizar el mes */
  orgDlg,
  orgMode: d => { ui.org.mode = d.mode; if (d.mode === 'auto') orgRefresh(); else renderOrg(); },
  orgPreset: d => { [ui.org.from, ui.org.to] = monthRange(d.p); ui.org.preset = d.p; orgRefresh(); },
  orgMeal: d => { const m = ui.org.meals; ui.org.meals = m.includes(d.meal) ? m.filter(x => x !== d.meal) : [...m, d.meal]; orgRefresh(); },
  orgSource: d => { ui.org.source = d.s; orgRefresh(); },
  orgShuffle: () => orgRefresh(),
  orgApply: async () => {
    const pv = ui.org.preview;
    if (!pv.length) return;
    snapshotPlan(`añadir ${pv.length} platillos`);
    for (const p of pv) addToPlan(p.date, p.recipeId, p.meal, CATS[p.meal].time);
    await save(); closeDlg(); render();
    toast(`${pv.length} platillos añadidos al calendario`);
  },
  orgClear: async () => {
    const { from, to } = ui.org;
    const dates = Object.keys(S.plan).filter(d => d >= from && d <= to);
    const n = dates.reduce((a, d) => a + S.plan[d].length, 0);
    if (!n) return toast('No hay nada planificado en esas fechas');
    if (!confirm(`¿Quitar ${n} platillos planificados entre ${fmtShortDate(from)} y ${fmtShortDate(to)}? Las recetas no se borran.`)) return;
    snapshotPlan(`quitar ${n} platillos`);
    dates.forEach(d => delete S.plan[d]);
    await save(); orgRefresh(); render(); toast(`${n} platillos quitados`);
  },
  orgCopyPrompt: () => copyText(planPrompt(ui.org), 'Prompt copiado. Pégalo en tu IA.'),
  orgImport: async () => {
    const txt = $('#og-text').value;
    try {
      const before = JSON.stringify(S.plan);
      let data;
      try { data = JSON.parse(extractJSON(txt)); } catch { data = null; }
      if (data && !Array.isArray(data) && Array.isArray(data.recipes) && data.recipes.length) throw new Error('Este JSON trae recetas nuevas. Impórtalo desde Recetario, «Importar con IA».');
      const wrapped = Array.isArray(data) ? JSON.stringify({ plan: data }) : txt;
      const res = importAI(wrapped, false);
      if (!res.planned) throw new Error(res.skipped.length ? `Ninguna entrada coincide con tu recetario (${res.skipped.slice(0, 3).join(', ')}…). Revisa que los nombres sean exactos.` : 'El JSON no trae entradas de plan.');
      ui.undo = { plan: before, label: `importar ${res.planned} platillos` };
      await save(); closeDlg(); render();
      toast(`Calendario importado: ${res.planned} platillos${res.skipped.length ? `, ${res.skipped.length} omitidos` : ''}`);
    } catch (e) { $('#og-msg').textContent = e.message; }
  },
  undoPlan: async () => { if (!ui.undo) return; S.plan = JSON.parse(ui.undo.plan); ui.undo = null; await save(); render(); toast('Cambio deshecho'); },

  /* organizar recetario */
  bookEdit: () => { ui.bookEdit = !ui.bookEdit; ui.sel = new Set(); render(); },
  selToggle: d => { if (ui.sel.has(d.id)) ui.sel.delete(d.id); else ui.sel.add(d.id); $('#bookGrid').innerHTML = bookGrid(); },
  selAll: () => { const ids = filteredRecipes().map(r => r.id); ui.sel = new Set(ids.every(id => ui.sel.has(id)) ? [] : ids); $('#bookGrid').innerHTML = bookGrid(); },
  bulkFav: async () => { const rs = S.recipes.filter(r => ui.sel.has(r.id)); const on = !rs.every(r => r.fav); rs.forEach(r => { r.fav = on; }); await save(); $('#bookGrid').innerHTML = bookGrid(); toast(on ? 'Marcadas como favoritas' : 'Quitadas de favoritas'); },
  bulkDel: async () => {
    const n = ui.sel.size;
    if (!n || !confirm(`¿Eliminar ${n} ${n === 1 ? 'receta' : 'recetas'}? También se quitarán de los días donde estén planificadas.`)) return;
    S.recipes = S.recipes.filter(r => !ui.sel.has(r.id));
    for (const [date, items] of Object.entries(S.plan)) { S.plan[date] = items.filter(i => !ui.sel.has(i.recipeId)); if (!S.plan[date].length) delete S.plan[date]; }
    ui.sel = new Set(); await save(); render(); toast(`${n} ${n === 1 ? 'receta eliminada' : 'recetas eliminadas'}`);
  },

  /* recetario */
  bookCat: d => { ui.cat = d.cat; render(); },
  clearFilters: () => { ui.cat = 'all'; ui.q = ''; render(); },
  openRecipe: d => { closeDlg(); ui.recipeId = d.id; ui.detailServ = null; go('recipe'); },
  detailServ: d => { const r = getRecipe(ui.recipeId); ui.detailServ = Math.max(1, (ui.detailServ || r.servings) + Number(d.n)); render(); },
  toggleFav: async d => { const r = getRecipe(d.id); r.fav = !r.fav; await save(); if (ui.view === 'book') $('#bookGrid').innerHTML = bookGrid(); else render(); },
  loadSamples: async () => { const n = addSamples(); await save(); render(); toast(n ? `${n} recetas de ejemplo añadidas` : 'Ya tienes todas las recetas de ejemplo'); },

  newRecipe: d => {
    const cat = d && CATS[d.cat] ? d.cat : 'almuerzo';
    if (!ui.pendingPlan || ui.view !== 'editor') ui.returnTo = ui.view === 'editor' ? 'book' : ui.view;
    ui.draft = { name: '', emoji: CATS[cat].emoji, category: cat, difficulty: 'facil', description: '', servings: 2, prepMinutes: 0, cookMinutes: 0, tags: [], ingredients: [{ name: '', qty: 0, unit: '' }, { name: '', qty: 0, unit: '' }], steps: [{ text: '', timer: 0 }], notes: '' };
    ui.emojiOpen = false; go('editor'); $('#e-name')?.focus();
  },
  editRecipe: d => { ui.pendingPlan = null; ui.draft = JSON.parse(JSON.stringify(getRecipe(d.id))); ui.returnTo = ui.view === 'cook' ? 'recipe' : ui.view; ui.recipeId = d.id; ui.emojiOpen = false; if (ui.cook) { ui.cook = null; releaseWake(); } go('editor'); },
  dupRecipe: async d => { const r = JSON.parse(JSON.stringify(getRecipe(d.id))); r.id = uid(); r.name += ' (copia)'; r.createdAt = Date.now(); S.recipes.push(r); await save(); ui.recipeId = r.id; render(); toast('Receta duplicada'); },
  delRecipe: async d => {
    const r = getRecipe(d.id);
    const used = Object.values(S.plan).flat().filter(i => i.recipeId === d.id).length;
    if (!confirm(`¿Eliminar «${r.name}»?${used ? `\nTambién se quitará de ${used} ${used === 1 ? 'día' : 'días'} del plan.` : ''}`)) return;
    S.recipes = S.recipes.filter(x => x.id !== d.id);
    for (const [date, items] of Object.entries(S.plan)) { S.plan[date] = items.filter(i => i.recipeId !== d.id); if (!S.plan[date].length) delete S.plan[date]; }
    ui.draft = null; ui.sel.delete(d.id);
    await save(); go('book'); toast('Receta eliminada');
  },
  toggleEmoji: () => { readEditor(); ui.emojiOpen = !ui.emojiOpen; render(); },
  setEmoji: d => { readEditor(); ui.draft.emoji = d.e; ui.emojiOpen = false; render(); },
  cancelEdit: () => { ui.draft = null; ui.pendingPlan = null; go(ui.returnTo || 'book'); },
  addIng: () => { readEditor(); ui.draft.ingredients.push({ name: '', qty: 0, unit: '' }); refreshEditorRows(); $$('#ings .i-name').pop()?.focus(); },
  delIng: d => { readEditor(); ui.draft.ingredients.splice(Number(d.n), 1); refreshEditorRows(); },
  addStep: () => { readEditor(); ui.draft.steps.push({ text: '', timer: 0 }); refreshEditorRows(); $$('#steps .s-text').pop()?.focus(); },
  delStep: d => { readEditor(); ui.draft.steps.splice(Number(d.n), 1); refreshEditorRows(); },
  moveStep: d => { readEditor(); const n = Number(d.n), m = n + Number(d.d), s = ui.draft.steps; if (m < 0 || m >= s.length) return; [s[n], s[m]] = [s[m], s[n]]; refreshEditorRows(); },
  saveRecipe: async () => {
    readEditor();
    const d = ui.draft;
    if (!d.name.trim()) { toast('Escribe el nombre de la receta'); return $('#e-name').focus(); }
    const c = cleanRecipe(d);
    let id = d.id;
    if (id) { const i = S.recipes.findIndex(r => r.id === id); S.recipes[i] = { ...S.recipes[i], ...c, id }; }
    else { id = uid(); S.recipes.push({ ...c, id, fav: false, createdAt: Date.now() }); }
    let msg = 'Receta guardada';
    const pp = ui.pendingPlan;
    if (pp) { addToPlan(pp.date, id, pp.meal, pp.time); msg = `Receta guardada y añadida a ${relDay(pp.date).toLowerCase()}`; ui.day = pp.date; }
    await save();
    ui.draft = null; ui.pendingPlan = null;
    toast(msg);
    if (!pp && (ui.returnTo === 'book' || ui.returnTo === 'recipe')) { ui.recipeId = id; ui.detailServ = null; go('recipe'); }
    else go(ui.returnTo || 'book');
  },

  /* IA y datos */
  importDlg,
  togglePrompt: () => { const p = $('#promptPre'); p.hidden = !p.hidden; },
  copyPrompt: () => copyText(AI_PROMPT, 'Prompt copiado. Pégalo en tu IA.'),
  doImport: async () => {
    try {
      const res = importAI($('#imp-text').value, $('#imp-replace').checked);
      await save(); closeDlg(); render();
      const parts = [];
      if (res.added) parts.push(`${res.added} ${res.added === 1 ? 'receta nueva' : 'recetas nuevas'}`);
      if (res.updated) parts.push(`${res.updated} actualizadas`);
      if (res.planned) parts.push(`${res.planned} en el plan`);
      if (res.skipped.length) parts.push(`${res.skipped.length} del plan omitidas`);
      toast('Importado: ' + (parts.join(', ') || 'nada nuevo'));
    } catch (e) { $('#imp-msg').textContent = e.message; }
  },
  exportAll: () => { download(`planner-respaldo-${ymd(new Date())}.json`, JSON.stringify({ app: 'planner', ...S }, null, 2)); toast('Respaldo exportado'); },
  exportRecipes: () => { download(`recetas-${ymd(new Date())}.json`, JSON.stringify({ schema: 'planner/2', recipes: S.recipes.map(exportRecipe) }, null, 2)); toast('Recetas exportadas'); },
  pickBackup: () => $('#backupFile').click(),
  askNotif: async () => { try { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Notificaciones activadas' : 'El navegador no dio permiso'); } catch { toast('Este navegador no admite notificaciones'); } },
  wipe: async () => { if (!confirm('¿Borrar todas las recetas, el plan y la lista de compras de este dispositivo?')) return; S = emptyState(); await save(); render(); toast('Datos borrados'); },

  /* listas de compras */
  newList: () => newListDlg(),
  quickWeekList: async () => { const [f, t] = shopPresetRange('week'); const l = createList(`Semana del ${fmtShortDate(f)}`, f, t, true); await save(); ui.listId = l.id; ui.editItem = null; go('list'); toast(`Lista creada con ${l.items.length} artículos`); },
  nlMode: d => { readNl(); ui.nl.mode = d.mode; renderNewList(); },
  nlPreset: d => { readNl(); [ui.nl.from, ui.nl.to] = shopPresetRange(d.p); ui.nl.preset = d.p; renderNewList(); },
  nlCreate: async () => { readNl(); const n = ui.nl; const l = createList(n.name, n.from, n.to, n.mode === 'plan'); await save(); closeDlg(); ui.listId = l.id; ui.editItem = null; go('list'); toast('Lista creada'); },
  openList: d => { ui.listId = d.id; ui.editItem = null; go('list'); },
  listRename: d => {
    const l = getList(d.id);
    openDlg(`<div class="dlg-h"><div><h2>Renombrar lista</h2></div><button class="btn icon ghost" data-act="closeDlg" aria-label="Cerrar">${ic('x')}</button></div>
      <label for="rn-name">Nombre</label><input id="rn-name" value="${esc(l.name)}">
      <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="listRenameSave" data-id="${l.id}">${ic('check')}Guardar</button></div>`);
    $('#rn-name').select();
  },
  listRenameSave: async d => { const v = $('#rn-name').value.trim(); if (!v) return toast('Escribe un nombre'); getList(d.id).name = v; await save(); closeDlg(); render(); toast('Lista renombrada'); },
  listSync: async d => {
    const r = syncList(getList(d.id)); await save(); render();
    toast(r.added || r.updated || r.removed ? `Actualizada: ${r.added} nuevos, ${r.updated} cantidades ajustadas${r.removed ? `, ${r.removed} quitados` : ''}` : 'La lista ya estaba al día con el plan');
  },
  listShare: async d => {
    const l = getList(d.id), text = listText(l);
    if (!text) return toast('No queda nada por comprar');
    if (navigator.share) { try { await navigator.share({ title: l.name, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    copyText(text, 'Lista copiada');
  },
  listUncheck: async d => { getList(d.id).items.forEach(i => { i.checked = false; }); await save(); render(); },
  listClearChecked: async d => {
    const l = getList(d.id), gone = l.items.filter(i => i.checked);
    if (!gone.length) return toast('No hay nada marcado');
    l.removed = [...new Set([...(l.removed || []), ...gone.filter(i => i.pkey).map(i => i.pkey)])];
    l.items = l.items.filter(i => !i.checked); await save(); render(); toast(`${gone.length} quitados de la lista`);
  },
  listDup: async d => {
    const l = getList(d.id), c = JSON.parse(JSON.stringify(l));
    c.id = uid(); c.name = l.name + ' (copia)'; c.createdAt = Date.now(); c.items.forEach(i => { i.id = uid(); i.checked = false; });
    S.lists.splice(S.lists.indexOf(l) + 1, 0, c); await save(); render(); toast('Lista duplicada');
  },
  listDelete: async d => { const l = getList(d.id); if (!confirm(`¿Eliminar la lista «${l.name}»?`)) return; S.lists = S.lists.filter(x => x.id !== d.id); await save(); go('shop'); toast('Lista eliminada'); },
  itemEdit: d => { ui.editItem = d.id; render(); $('#ie-name')?.focus(); },
  itemCancel: () => { ui.editItem = null; render(); },
  itemSave: async d => {
    const i = getList(ui.listId).items.find(x => x.id === d.id);
    const name = $('#ie-name').value.trim();
    if (!name) return toast('El artículo necesita un nombre');
    const nv = { name, qty: num($('#ie-qty').value, 0), unit: $('#ie-unit').value.trim(), aisle: $('#ie-aisle').value };
    if (nv.name !== i.name || nv.qty !== i.qty || nv.unit !== i.unit || nv.aisle !== i.aisle) { Object.assign(i, nv); i.edited = true; }
    ui.editItem = null; await save(); render(); toast('Artículo guardado');
  },
  itemDel: async d => {
    const l = getList(ui.listId), i = l.items.find(x => x.id === d.id);
    if (i && i.pkey) l.removed = [...new Set([...(l.removed || []), i.pkey])];
    l.items = l.items.filter(x => x.id !== d.id); ui.editItem = null; await save(); render(); toast('Artículo eliminado');
  },

  /* cocinar */
  cookItem: d => { const it = findItem(d.date, d.id); startCook(it.recipeId, it.servings, { date: d.date, id: d.id }); },
  cookRecipe: d => startCook(d.id, ui.view === 'recipe' ? ui.detailServ : 0),
  cookGo: d => { ui.cook.step = Number(d.n); render(); },
  cookPrev: () => { ui.cook.step = Math.max(0, ui.cook.step - 1); render(); },
  cookNext: () => { const r = getRecipe(ui.cook.recipeId); ui.cook.step = Math.min(r.steps.length, ui.cook.step + 1); render(); window.scrollTo(0, 0); },
  cookServ: d => { ui.cook.servings = Math.max(1, ui.cook.servings + Number(d.n)); render(); },
  cookFinish: async () => { const ref = ui.cook.ref; if (ref) { const it = findItem(ref.date, ref.id); if (it) { it.done = true; await save(); } } A.cookExit(); toast('¡Buen provecho!'); },
  cookExit: () => { const back = ui.cook?.ref ? 'today' : 'recipe'; ui.cook = null; releaseWake(); go(back === 'recipe' && ui.recipeId ? 'recipe' : 'today'); },
  startTimer: d => addTimer(Number(d.min), d.label),
  customTimer: d => { const v = num($('#ct-min').value, 0); addTimer(v, d.label); if (v > 0) $('#ct-min').value = ''; },
  timerSheet,
  quickTimer: d => addTimer(Number(d.min), `Temporizador de ${fmtMin(Number(d.min))}`),
  newTimer: () => {
    const min = num($('#nt-m').value, 0) + num($('#nt-s').value, 0) / 60;
    if (!(min > 0)) return toast('Escribe minutos o segundos');
    addTimer(min, $('#nt-l').value.trim() || `Temporizador de ${fmtClock(min * 60)}`);
    $('#nt-m').value = ''; $('#nt-s').value = ''; $('#nt-l').value = '';
  },
  timerPause: d => timerAct(d.id, t => { t.remaining = Math.max(0, tLeft(t)); t.paused = true; }),
  timerResume: d => timerAct(d.id, t => { unlockAudio(); t.endAt = Date.now() + t.remaining * 1000; t.paused = false; }),
  timerReset: d => timerAct(d.id, t => { t.paused = true; t.fired = false; t.remaining = t.total; }),
  timerAdd: d => timerAct(d.id, t => {
    if (t.fired) { t.fired = false; t.paused = false; t.total = 60; t.endAt = Date.now() + 60000; }
    else if (t.paused) { t.remaining += 60; t.total = Math.max(t.total, t.remaining); }
    else { t.endAt += 60000; t.total = Math.max(t.total, tLeft(t)); }
  }),
  timerDel: d => { timers = timers.filter(x => x.id !== d.id); saveTimers(); syncAlarm(); renderTimers(); },
};

async function moveItem(from, id, to) {
  if (!validDate(to)) return toast('Elige un día válido');
  const it = findItem(from, id);
  if (!it) return closeDlg();
  if (to !== from) {
    S.plan[from] = S.plan[from].filter(i => i.id !== id);
    if (!S.plan[from].length) delete S.plan[from];
    (S.plan[to] = S.plan[to] || []).push(it);
    await save();
  }
  closeDlg(); render(); toast(`Movido a ${relDay(to).toLowerCase()}`);
}
// re-renderiza manteniendo abiertos los <details> que lo estaban
function keepOpen(fn) {
  const open = $$('details[open]').map(d => d.closest('.dish')?.querySelector('[data-chg=toggleDone]')?.dataset.id).filter(Boolean);
  fn();
  open.forEach(id => { const el = $(`[data-chg=toggleDone][data-id="${id}"]`)?.closest('.dish')?.querySelector('details'); if (el) el.open = true; });
}

const C = {
  orgRange: () => {
    const f = $('#og-from').value, t = $('#og-to').value;
    if (validDate(f)) ui.org.from = f;
    if (validDate(t)) ui.org.to = t;
    if (ui.org.from > ui.org.to) ui.org.to = ui.org.from;
    ui.org.preset = '';
    if (ui.org.mode === 'auto') orgRefresh(); else renderOrg();
  },
  orgSkip: (d, el) => { ui.org.skipFilled = el.checked; orgRefresh(); },
  orgGap: (d, el) => { ui.org.gap = Number(el.value); orgRefresh(); },
  toggleDone: async (d, el) => { const it = findItem(d.date, d.id); it.done = el.checked; await save(); keepOpen(render); },
  itemTime: async (d, el) => { const it = findItem(d.date, d.id); if (validTime(el.value)) { it.time = el.value; await save(); keepOpen(render); } },
  itemMeal: async (d, el) => { const it = findItem(d.date, d.id); it.meal = el.value; await save(); render(); },
  pdDateInput: (d, el) => { if (validDate(el.value)) { readPd(); ui.pd.date = el.value; renderPlanDlg(); } },
  pickDate: (d, el) => { if (validDate(el.value)) ui.pick.date = el.value; renderPick(); },
  pickTime: (d, el) => { if (validTime(el.value)) ui.pick.time = el.value; },
  sort: (d, el) => { ui.sort = el.value; $('#bookGrid').innerHTML = bookGrid(); },
  edCat: (d, el) => { readEditor(); const old = ui.draft; if (Object.values(CATS).some(c => c.emoji === old.emoji)) old.emoji = CATS[el.value].emoji; render(); },
  itemCheck: async (d, el) => { const i = getList(ui.listId).items.find(x => x.id === d.id); i.checked = el.checked; await save(); render(); },
  nlRange: () => {
    readNl();
    const f = $('#nl-from').value, t = $('#nl-to').value;
    if (validDate(f)) ui.nl.from = f;
    if (validDate(t)) ui.nl.to = t;
    if (ui.nl.from > ui.nl.to) ui.nl.to = ui.nl.from;
    ui.nl.preset = ''; renderNewList();
  },
  bulkCat: async (d, el) => {
    const c = el.value;
    if (!CATS[c]) return;
    S.recipes.forEach(r => { if (ui.sel.has(r.id)) { if (r.emoji === CATS[r.category].emoji) r.emoji = CATS[c].emoji; r.category = c; } });
    await save(); $('#bookGrid').innerHTML = bookGrid(); toast(`Movidas a ${CATS[c].name}`);
  },
  cookGot: (d, el) => { ui.cook.got[d.k] = el.checked; el.closest('li').classList.toggle('chk', el.checked); },
};

/* ───────── eventos ───────── */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  unlockAudio();
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-chg]');
  if (el && C[el.dataset.chg]) C[el.dataset.chg](el.dataset, el);
  if (e.target.id === 'og-file' && e.target.files[0]) e.target.files[0].text().then(t => { $('#og-text').value = t; });
  if (e.target.id === 'imp-file' && e.target.files[0]) e.target.files[0].text().then(t => { $('#imp-text').value = t; });
  if (e.target.id === 'backupFile' && e.target.files[0]) {
    const f = e.target.files[0]; e.target.value = '';
    f.text().then(async t => {
      try {
        const d = JSON.parse(t);
        if (!d || !Array.isArray(d.recipes) || typeof d.plan !== 'object' || Array.isArray(d.plan)) throw new Error('Este archivo no es un respaldo del planner. Para recetas sueltas usa «Importar respuesta de la IA».');
        if (!confirm('El respaldo reemplazará los datos de este dispositivo. ¿Continuar?')) return;
        S = normalizeState(d); await save(); render(); toast('Respaldo importado');
      } catch (err) { toast(err.message); }
    });
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { ui.q = e.target.value; $('#bookGrid').innerHTML = bookGrid(); }
  if (e.target.id === 'pk-q' && ui.pick) { ui.pick.q = e.target.value; $('#pickList').innerHTML = pickList(); }
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form=item]');
  if (!f) return;
  e.preventDefault();
  const name = $('#ni-name').value.trim();
  if (!name) return $('#ni-name').focus();
  const a = $('#ni-aisle').value;
  getList(ui.listId).items.push({ id: uid(), name, qty: num($('#ni-qty').value, 0), unit: $('#ni-unit').value.trim(), aisle: a === 'auto' ? aisleOf(name) : a, checked: false, src: 'manual', pkey: '', edited: false, recipes: [] });
  await save(); render(); $('#ni-name').focus();
  toast(`${name}: añadido`);
});

/* pantalla encendida mientras se cocina */
let wake = null;
async function requestWake() { try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch {} }
function releaseWake() { try { wake && wake.release(); } catch {} wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (ui.cook) requestWake(); tick(); } });

/* ───────── inicio ───────── */
(async function init() {
  const raw = await Store.load();
  S = normalizeState(raw);
  if (!raw) { addSamples(); await save(); }
  render();
  tick();
  setInterval(tick, 250);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
})();
