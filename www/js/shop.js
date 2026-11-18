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
  return aggregate(from, to).map(e => ({ id: uid(), name: e.name, qty: e.qty, unit: e.unit, aisle: e.aisle, checked: false, src: 'plan', pkey: e.key, edited: false, recipes: [...e.from] }));
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
