/* Compras: pasillos, agregación de ingredientes del plan y lógica de listas. */
'use strict';

const AISLES = [
  ['Despensa', ['leche de coco', 'tomate triturado', 'pure de tomate', 'pasta de tomate', 'salsa', 'caldo', 'totopos', 'cacao', 'chocolate', 'polvo de hornear', 'levadura', 'harina', 'azucar', 'arroz', 'pasta', 'espagueti', 'fideo', 'macarron', 'lenteja', 'frijol', 'garbanzo', 'quinoa', 'aceite', 'vinagre', 'miel', 'mayonesa', 'mostaza', 'atun', 'lata', 'avena', 'cereal', 'galleta', 'mermelada', 'cafe', 'te ', 'chia', 'linaza', 'nuez', 'nueces', 'almendra']],
  ['Especias y condimentos', ['=sal', 'pimienta', 'comino', 'oregano', 'pimenton', 'paprika', 'curry', 'canela', 'laurel', 'especia', 'nuez moscada', 'vainilla', 'curcuma', 'ajo en polvo', 'tomillo', 'romero']],
  ['Carnes y pescados', ['pollo', 'pechuga', 'muslo', 'carne', 'res', 'cerdo', 'pavo', 'jamon', 'tocino', 'salmon', 'pescado', 'sardina', 'camaron', 'gamba', 'chorizo', 'salchicha', 'molida', 'filete', 'lomo']],
  ['Lácteos y huevos', ['leche', 'queso', 'yogur', 'mantequilla', 'crema', 'nata', 'huevo', 'parmesano', 'tofu']],
  ['Panadería', ['pan', 'tortilla', 'bollo', 'baguette']],
  ['Frutas y verduras', ['tomate', 'cebolla', 'ajo', 'zanahoria', 'papa', 'patata', 'lechuga', 'pimiento', 'pepino', 'calabac', 'calabaza', 'espinaca', 'brocoli', 'apio', 'cilantro', 'perejil', 'limon', 'lima', 'manzana', 'platano', 'banana', 'fresa', 'frutos rojos', 'aguacate', 'palta', 'champi', 'hongo', 'maiz', 'choclo', 'jengibre', 'fruta', 'naranja', 'chile', 'jalapeno', 'albahaca', 'puerro', 'berenjena', 'repollo', '=col', 'rucula', 'arveja', 'guisante', 'ejote', 'verdura', 'hierba', 'menta', 'kiwi', 'pera', 'uva']],
];
const AISLE_NAMES = [...AISLES.map(a => a[0]), 'Otros'];
const AISLE_SHORT = { 'Despensa': 'Despensa', 'Especias y condimentos': 'Especias', 'Carnes y pescados': 'Carnes', 'Lácteos y huevos': 'Lácteos', 'Panadería': 'Panadería', 'Frutas y verduras': 'Verdulería', 'Otros': 'Otros' };
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
function aggregate(from, to, skipDone = false) {
  const map = new Map();
  for (const [date, items] of Object.entries(S.plan)) {
    if (date < from || date > to) continue;
    for (const it of items) {
      if (it.lo) continue; // sobras: ya están cocinadas, no se compran
      if (skipDone && it.done) continue; // ya cocinado: sus ingredientes ya salieron de la despensa
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
function shopPresetRange(p) {
  const t = new Date();
  if (p === 'today') return [ymd(t), ymd(t)];
  if (p === 'week') { const off = (t.getDay() + 6) % 7; return [ymd(addDays(t, -off)), ymd(addDays(t, 6 - off))]; }
  if (p === 'month') return [ymd(new Date(t.getFullYear(), t.getMonth(), 1)), ymd(new Date(t.getFullYear(), t.getMonth() + 1, 0))];
  return [ymd(t), ymd(addDays(t, 6))];
}

const getList = id => S.lists.find(l => l.id === id);
const listStats = l => ({ total: l.items.length, got: l.items.filter(i => i.checked).length });
const itemLine = i => `${i.qty > 0 ? fmtQty(i.qty) + (i.unit ? ' ' + i.unit : '') + ' ' : ''}${i.name}`;
function planToItems(from, to) {
  return needFromPlan(from, to).map(e => withPrice({ id: uid(), name: e.name, qty: e.qty, unit: e.unit, aisle: e.aisle, checked: false, src: 'plan', pkey: e.key, edited: false, recipes: [...e.from], ...(e.have ? { have: e.have } : {}) }));
}
function createList(name, from, to, fromPlan) {
  const l = { id: uid(), name: name.trim() || 'Lista de compras', createdAt: Date.now(), from: fromPlan ? from : '', to: fromPlan ? to : '', removed: [], items: fromPlan ? planToItems(from, to) : [] };
  S.lists.unshift(l);
  return l;
}
// Actualiza desde el plan sin pisar lo editado ni recuperar lo que se borró a mano
function syncList(l) {
  const res = { added: 0, updated: 0, removed: 0 };
  if (!l.from) return res;
  const agg = needFromPlan(l.from, l.to), seen = new Set();
  for (const e of agg) {
    seen.add(e.key);
    if ((l.removed || []).includes(e.key)) continue;
    const it = l.items.find(i => i.src === 'plan' && i.pkey === e.key);
    if (it) {
      if (!it.edited && Math.abs(it.qty - e.qty) > 1e-9) { it.qty = e.qty; res.updated++; withPrice(it, true); }
      it.recipes = [...e.from];
      if (e.have) it.have = e.have; else delete it.have;
    } else {
      l.items.push(withPrice({ id: uid(), name: e.name, qty: e.qty, unit: e.unit, aisle: e.aisle, checked: false, src: 'plan', pkey: e.key, edited: false, recipes: [...e.from], ...(e.have ? { have: e.have } : {}) }));
      res.added++;
    }
  }
  const before = l.items.length;
  l.items = l.items.filter(i => !(i.src === 'plan' && !i.edited && !i.checked && !seen.has(i.pkey)));
  res.removed = before - l.items.length;
  return res;
}
/* ── despensa: lo que ya tienes en casa ── */
const pantryKey = (name, unit) => fold(name) + '|' + unitKey(unit || '');
const pantryFind = (name, unit) => S.pantry.find(p => pantryKey(p.name, p.unit) === pantryKey(name, unit)) || S.pantry.find(p => !p.qty && fold(p.name) === fold(name));
// Lo que falta comprar para el plan, descontando la despensa (qty 0 en la despensa = "siempre hay")
function needFromPlan(from, to) {
  const out = [];
  for (const e of aggregate(from, to, true)) {
    const p = pantryFind(e.name, e.unit);
    if (!p) { out.push(e); continue; }
    if (!p.qty) continue; // siempre en casa
    const need = e.qty - p.qty;
    if (e.qty > 0 && need <= 1e-9) continue;
    out.push({ ...e, qty: e.qty > 0 ? need : e.qty, have: `${fmtQty(p.qty)}${p.unit ? ' ' + p.unit : ''} en la despensa` });
  }
  return out;
}
// Al cocinar, se descuenta de la despensa lo que usa la receta
function useFromPantry(r, servings) {
  const f = (servings || r.servings) / (r.servings || 1);
  for (const ing of r.ingredients) {
    const p = S.pantry.find(x => x.qty > 0 && pantryKey(x.name, x.unit) === pantryKey(ing.name, ing.unit));
    if (!p || !(ing.qty > 0)) continue;
    p.qty = Math.max(0, +(p.qty - ing.qty * f).toFixed(3));
    if (p.qty <= 0) S.pantry = S.pantry.filter(x => x !== p);
  }
}
function addToPantry(name, qty, unit) {
  const p = S.pantry.find(x => pantryKey(x.name, x.unit) === pantryKey(name, unit));
  if (p) { if (p.qty || qty) p.qty = +(p.qty + qty).toFixed(3); p.at = Date.now(); return p; }
  const n = { id: uid(), name: name.trim(), qty, unit: unit || '', at: Date.now() };
  S.pantry.push(n); return n;
}

/* ── presupuesto: precios recordados por artículo y unidad ── */
const priceKey = i => fold(i.name) + '|' + unitKey(i.unit || '');
// Precio estimado de la línea a partir del último precio unitario pagado
function withPrice(i, force) {
  const u = S.prices[priceKey(i)];
  if (u && (force || !i.price)) { const p = +(i.qty > 0 ? u * i.qty : u).toFixed(2); if (p > 0) { i.price = p; i.est = true; } }
  return i;
}
function rememberPrice(i) { if (i.price > 0) S.prices[priceKey(i)] = +(i.qty > 0 ? i.price / i.qty : i.price).toFixed(4); }
const money = n => (S.prefs.currency || '$') + (n || 0).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const listCost = l => l.items.reduce((a, i) => a + (i.price || 0), 0);
function weekSpend(ws = weekStartOf(todayStr())) {
  const a = parseYmd(ws).getTime(), b = addDays(parseYmd(ws), 7).getTime();
  return num((S.prefs.spent || {})[ws], 0) + S.lists.reduce((t, l) => t + l.items.reduce((s, i) => s + (i.checked && i.price && i.at >= a && i.at < b ? i.price : 0), 0), 0);
}
// Antes de quitar artículos comprados de una lista, su gasto queda registrado en su semana
function bankSpend(items) {
  const sp = { ...(S.prefs.spent || {}) };
  for (const i of items) if (i.checked && i.price && i.at) { const w = weekStartOf(ymd(new Date(i.at))); sp[w] = +(num(sp[w], 0) + i.price).toFixed(2); }
  const keep = ymd(addDays(new Date(), -7 * 26));
  for (const k of Object.keys(sp)) if (k < keep) delete sp[k];
  S.prefs.spent = sp;
}

function listText(l, onlyPending = true) {
  const groups = {};
  for (const i of l.items) if (!onlyPending || !i.checked) (groups[i.aisle] = groups[i.aisle] || []).push('- ' + itemLine(i));
  const keys = AISLE_NAMES.filter(a => groups[a]);
  return keys.length ? `${l.name}\n\n` + keys.map(k => `${k}\n${groups[k].join('\n')}`).join('\n\n') : '';
}
