/* Planner de Recetas — PWA sin dependencias.
   Persistencia aislada en `Store` para poder cambiarla por una nube más adelante. */
(() => {
'use strict';

/* ───────── utilidades ───────── */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseYmd(s)) === s;
const validTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
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
const longDate = s => parseYmd(s).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
const monthName = d => d.toLocaleDateString('es', { month: 'long', year: 'numeric' });

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ───────── almacenamiento (reemplazable por nube) ───────── */
const Store = {
  key: 'planner.v1',
  async load() {
    try { const r = localStorage.getItem(this.key); return r ? JSON.parse(r) : null; } catch { return null; }
  },
  async save(data) {
    try { localStorage.setItem(this.key, JSON.stringify(data)); return true; }
    catch { toast('⚠️ No se pudo guardar (almacenamiento lleno o bloqueado)'); return false; }
  },
};

/* ───────── estado ───────── */
const emptyState = () => ({ version: 1, updatedAt: 0, recipes: [], plan: {}, shop: { checked: {}, extra: [] } });
let S = emptyState();

function normalizeState(d) {
  const s = emptyState();
  if (!d || typeof d !== 'object') return s;
  s.updatedAt = d.updatedAt || 0;
  s.recipes = Array.isArray(d.recipes) ? d.recipes.flatMap(r => { try { return [{ ...cleanRecipe(r), id: r.id || uid() }]; } catch { return []; } }) : [];
  if (d.plan && typeof d.plan === 'object') {
    for (const [date, items] of Object.entries(d.plan)) {
      if (!validDate(date) || !Array.isArray(items)) continue;
      const list = items.filter(i => i && i.recipeId).map(i => ({
        id: i.id || uid(), recipeId: i.recipeId, time: validTime(i.time) ? i.time : '13:00',
        servings: num(i.servings, 0) || 0, done: !!i.done,
      }));
      if (list.length) s.plan[date] = list;
    }
  }
  if (d.shop) {
    s.shop.checked = d.shop.checked && typeof d.shop.checked === 'object' ? d.shop.checked : {};
    s.shop.extra = Array.isArray(d.shop.extra) ? d.shop.extra.filter(e => e && e.name).map(e => ({ id: e.id || uid(), name: String(e.name), checked: !!e.checked })) : [];
  }
  return s;
}
function save() { S.updatedAt = Date.now(); return Store.save(S); }

const getRecipe = id => S.recipes.find(r => r.id === id);
const totalMin = r => (r.prepMinutes || 0) + (r.cookMinutes || 0);
const dayItems = date => (S.plan[date] || []).slice().sort((a, b) => a.time.localeCompare(b.time));

/* ───────── limpieza / validación de recetas ───────── */
function cleanRecipe(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('Una receta no es un objeto válido');
  const name = String(r.name ?? r.nombre ?? '').trim();
  if (!name) throw new Error('Hay una receta sin nombre');
  const ingsRaw = r.ingredients ?? r.ingredientes ?? [];
  const stepsRaw = r.steps ?? r.pasos ?? [];
  const ingredients = (Array.isArray(ingsRaw) ? ingsRaw : []).map(i => {
    if (typeof i === 'string') return { name: i.trim(), qty: 0, unit: '' };
    if (!i || typeof i !== 'object') return null;
    return {
      name: String(i.name ?? i.nombre ?? '').trim(),
      qty: num(i.quantity ?? i.qty ?? i.cantidad, 0),
      unit: String(i.unit ?? i.unidad ?? '').trim(),
    };
  }).filter(i => i && i.name);
  const steps = (Array.isArray(stepsRaw) ? stepsRaw : []).map(p => {
    if (typeof p === 'string') return { text: p.trim(), timer: 0 };
    if (!p || typeof p !== 'object') return null;
    return {
      text: String(p.text ?? p.texto ?? p.descripcion ?? '').trim(),
      timer: num(p.timerMinutes ?? p.timer ?? p.temporizador, 0),
    };
  }).filter(p => p && p.text);
  const tagsRaw = r.tags ?? r.etiquetas ?? [];
  const tags = (Array.isArray(tagsRaw) ? tagsRaw : String(tagsRaw).split(',')).map(t => String(t).trim()).filter(Boolean);
  return {
    name,
    description: String(r.description ?? r.descripcion ?? '').trim(),
    servings: Math.max(1, Math.round(num(r.servings ?? r.porciones, 2)) || 2),
    prepMinutes: num(r.prepMinutes ?? r.prepTime ?? r.preparacion, 0),
    cookMinutes: num(r.cookMinutes ?? r.cookTime ?? r.coccion, 0),
    tags, ingredients, steps,
    notes: String(r.notes ?? r.notas ?? '').trim(),
  };
}

/* ───────── interfaz: estado ───────── */
const today = new Date();
const ui = {
  view: 'calendar',
  month: new Date(today.getFullYear(), today.getMonth(), 1),
  day: ymd(today),
  q: '',
  draft: null,
  cook: null,
  shopFrom: ymd(today),
  shopTo: ymd(addDays(today, 6)),
};

/* ───────── temporizadores ───────── */
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
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.type = 'sine'; o.frequency.value = 880;
  o.connect(g); g.connect(actx.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.start(t); o.stop(t + 0.45);
}
function startAlarm() {
  if (alarmIv) return;
  let n = 0;
  const ring = () => { beep(); try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch {} if (++n > 40) stopAlarm(); };
  ring();
  alarmIv = setInterval(ring, 1500);
}
function stopAlarm() { clearInterval(alarmIv); alarmIv = null; }

async function notify(title) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) reg.showNotification(title, { body: 'Temporizador terminado', vibrate: [300, 150, 300], tag: 'planner-timer' });
    else new Notification(title);
  } catch {}
}

function addTimer(minutes, label) {
  if (!(minutes > 0)) return toast('Indica una duración mayor a 0');
  const total = Math.round(minutes * 60);
  timers.push({ id: uid(), label, total, endAt: Date.now() + total * 1000, fired: false });
  saveTimers();
  unlockAudio();
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
  renderTimers();
}

function tick() {
  let changed = false;
  const now = Date.now();
  for (const t of timers) {
    if (!t.fired && now >= t.endAt) {
      t.fired = true; changed = true;
      startAlarm();
      notify(`⏰ ${t.label}`);
    }
  }
  if (changed) saveTimers();
  if (timers.length) renderTimers();
}

let timerSig = '';
function renderTimers() {
  const box = $('#timers');
  const sig = timers.map(t => t.id + (t.fired ? 'f' : '')).join(',');
  if (sig === timerSig && timers.length) {
    // misma estructura: solo actualiza los relojes (no reconstruye, para no perder clics)
    box.querySelectorAll('.tm').forEach((el, i) => {
      const t = timers[i];
      if (t && !t.fired) $('.c', el).textContent = fmtClock((t.endAt - Date.now()) / 1000);
    });
    return;
  }
  timerSig = sig;
  if (!timers.length) { box.innerHTML = ''; return; }
  box.innerHTML = timers.map(t => {
    const left = (t.endAt - Date.now()) / 1000;
    return t.fired
      ? `<div class="tm fired"><span class="l">⏰ ${esc(t.label)}</span><span class="c">¡Listo!</span><button data-act="timerDel" data-id="${t.id}">Detener</button></div>`
      : `<div class="tm"><span class="l">⏱ ${esc(t.label)}</span><span class="c">${fmtClock(left)}</span><button data-act="timerAdd" data-id="${t.id}" aria-label="Sumar un minuto">+1</button><button data-act="timerDel" data-id="${t.id}" aria-label="Cancelar temporizador">✕</button></div>`;
  }).join('');
}

/* ───────── agregación de compras ───────── */
function aggregate(from, to) {
  const map = new Map();
  for (const [date, items] of Object.entries(S.plan)) {
    if (date < from || date > to) continue;
    for (const it of items) {
      const r = getRecipe(it.recipeId);
      if (!r) continue;
      const f = (it.servings || r.servings || 1) / (r.servings || 1);
      for (const ing of r.ingredients) {
        const key = ing.name.trim().toLowerCase() + '|' + (ing.unit || '').trim().toLowerCase();
        let e = map.get(key);
        if (!e) { e = { key, name: ing.name.trim(), unit: ing.unit || '', qty: 0, from: new Set() }; map.set(key, e); }
        if (ing.qty > 0) e.qty += ing.qty * f;
        e.from.add(r.name);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
const shopLine = e => `${e.qty > 0 ? fmtQty(e.qty) + (e.unit ? ' ' + e.unit : '') + ' ' : ''}${e.name}`;

/* ───────── vistas ───────── */
function viewCalendar() {
  const m = ui.month, y = m.getFullYear(), mo = m.getMonth();
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7;
  const days = new Date(y, mo + 1, 0).getDate();
  const todayS = ymd(new Date());
  let cells = '', total = 0;
  for (let i = 0; i < offset; i++) cells += '<div class="blank"></div>';
  for (let d = 1; d <= days; d++) {
    const date = `${y}-${pad(mo + 1)}-${pad(d)}`;
    const items = dayItems(date);
    total += items.length;
    const names = items.slice(0, 2).map(i => { const r = getRecipe(i.recipeId); return r ? `<span class="nm">${esc(i.time)} ${esc(r.name)}</span>` : ''; }).join('');
    cells += `<button class="day${date === todayS ? ' today' : ''}${items.length ? ' has' : ''}" data-act="openDay" data-date="${date}" aria-label="${esc(longDate(date))}, ${items.length} platillos"><span class="n">${d}</span>${items.length ? `<span class="dot">● ${items.length}</span>` : ''}${names}</button>`;
  }
  return `
  <div class="hdr"><h1>${esc(monthName(m))}</h1>
    <div class="row"><button class="icon" data-act="monthShift" data-n="-1" aria-label="Mes anterior">‹</button>
    <button data-act="monthToday">Hoy</button>
    <button class="icon" data-act="monthShift" data-n="1" aria-label="Mes siguiente">›</button></div></div>
  <div class="cal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<div class="dow">${x}</div>`).join('')}${cells}</div>
  <p class="muted">${total} platillo${total === 1 ? '' : 's'} planificado${total === 1 ? '' : 's'} este mes. Toca un día para planificarlo.</p>
  ${S.recipes.length ? '' : `<div class="card"><b>Empieza creando recetas</b><p class="muted">Ve a <b>Recetas</b> para crear una o importar varias con IA.</p><button class="primary" data-act="nav" data-view="recipes">Ir a recetas</button></div>`}`;
}

function viewDay() {
  const date = ui.day, items = dayItems(date);
  let mins = 0;
  const list = items.map(it => {
    const r = getRecipe(it.recipeId);
    if (!r) return `<div class="card"><span class="muted">Receta eliminada</span> <button class="danger" data-act="removeDish" data-date="${date}" data-id="${it.id}">Quitar</button></div>`;
    mins += totalMin(r);
    const sv = it.servings || r.servings, f = sv / r.servings;
    return `<div class="card dish${it.done ? ' done' : ''}">
      <div class="top">
        <input type="checkbox" ${it.done ? 'checked' : ''} data-chg="toggleDone" data-date="${date}" data-id="${it.id}" aria-label="Hecho">
        <div class="grow" style="flex:1;min-width:0"><div class="nm">${esc(r.name)}</div>
          <div class="muted">⏱ ${fmtMin(totalMin(r))}${r.prepMinutes ? ` (prep ${fmtMin(r.prepMinutes)}${r.cookMinutes ? `, cocción ${fmtMin(r.cookMinutes)}` : ''})` : ''}</div></div>
        <input class="time" type="time" value="${esc(it.time)}" data-chg="itemTime" data-date="${date}" data-id="${it.id}" aria-label="Hora">
      </div>
      <div class="row"><label style="margin:0">Porciones</label><input type="number" min="1" style="width:84px" value="${sv}" data-chg="itemServings" data-date="${date}" data-id="${it.id}"></div>
      <details><summary>Ingredientes (${r.ingredients.length})</summary><ul class="plain">${r.ingredients.map(i => `<li>${i.qty ? fmtQty(i.qty * f) + (i.unit ? ' ' + esc(i.unit) : '') + ' ' : ''}${esc(i.name)}</li>`).join('') || '<li class="muted">Sin ingredientes</li>'}</ul></details>
      <div class="row"><button class="primary" data-act="cookItem" data-date="${date}" data-id="${it.id}">▶ Cocinar</button>
        <button data-act="editRecipe" data-id="${r.id}">Editar receta</button>
        <button class="danger ghost" data-act="removeDish" data-date="${date}" data-id="${it.id}">Quitar</button></div>
    </div>`;
  }).join('');
  return `
  <div class="hdr"><div class="row"><button class="icon" data-act="nav" data-view="calendar" aria-label="Volver al mes">←</button><h1>${esc(longDate(date))}</h1></div>
    <div class="row"><button class="icon" data-act="dayShift" data-n="-1" aria-label="Día anterior">‹</button><button class="icon" data-act="dayShift" data-n="1" aria-label="Día siguiente">›</button></div></div>
  ${items.length ? `<p class="muted">${items.length} platillo${items.length === 1 ? '' : 's'} · tiempo total ${fmtMin(mins)}</p>` : '<div class="empty">Aún no hay platillos este día.</div>'}
  ${list}
  <div class="row"><button class="primary" data-act="planDlg" data-date="${date}">+ Añadir platillo</button>
    ${items.length ? `<button data-act="shopDay" data-date="${date}">🛒 Compras de este día</button>` : ''}</div>`;
}

function recipeCards() {
  const q = ui.q.trim().toLowerCase();
  const list = S.recipes.filter(r => !q || (r.name + ' ' + r.tags.join(' ') + ' ' + r.ingredients.map(i => i.name).join(' ')).toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (!list.length) return `<div class="empty">${S.recipes.length ? 'Sin resultados.' : 'No tienes recetas todavía.'}</div>`;
  return list.map(r => `<div class="card">
    <div class="row"><div style="flex:1;min-width:0"><b>${esc(r.name)}</b>
      <div class="muted">⏱ ${fmtMin(totalMin(r))} · ${r.servings} porc. · ${r.ingredients.length} ingredientes · ${r.steps.length} pasos</div>
      <div>${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div></div>
    <div class="spacer"></div>
    <div class="row"><button class="primary" data-act="planDlg" data-recipe="${r.id}">📅 Planificar</button>
      <button data-act="cookRecipe" data-id="${r.id}">▶ Cocinar</button>
      <button data-act="editRecipe" data-id="${r.id}">Editar</button>
      <button data-act="dupRecipe" data-id="${r.id}">Duplicar</button>
      <button class="danger ghost" data-act="delRecipe" data-id="${r.id}">Eliminar</button></div></div>`).join('');
}

function viewRecipes() {
  return `<div class="hdr"><h1>Recetas</h1><div class="row"><button data-act="importDlg">🤖 Importar con IA</button><button class="primary" data-act="newRecipe">+ Nueva</button></div></div>
  <input id="q" type="search" placeholder="Buscar por nombre, etiqueta o ingrediente…" value="${esc(ui.q)}" aria-label="Buscar">
  <div class="spacer"></div><div id="recipeList">${recipeCards()}</div>`;
}

/* editor */
function editorRows() {
  const d = ui.draft;
  return {
    ings: d.ingredients.map((i, n) => `<div class="edrow"><input class="i-name" placeholder="Ingrediente" value="${esc(i.name)}"><input class="i-qty" inputmode="decimal" placeholder="Cant." value="${i.qty || ''}"><input class="i-unit" placeholder="Unidad" value="${esc(i.unit)}"><button class="icon danger" data-act="delIng" data-n="${n}" aria-label="Quitar ingrediente">✕</button></div>`).join(''),
    steps: d.steps.map((s, n) => `<div class="edstep"><textarea class="s-text" placeholder="Paso ${n + 1}">${esc(s.text)}</textarea><input class="s-timer" inputmode="decimal" placeholder="min ⏱" title="Temporizador en minutos (opcional)" value="${s.timer || ''}"><div class="row" style="flex-direction:column;gap:2px"><button class="icon" data-act="moveStep" data-n="${n}" data-d="-1" aria-label="Subir">↑</button><button class="icon" data-act="moveStep" data-n="${n}" data-d="1" aria-label="Bajar">↓</button><button class="icon danger" data-act="delStep" data-n="${n}" aria-label="Quitar paso">✕</button></div></div>`).join(''),
  };
}
function viewEditor() {
  const d = ui.draft, rows = editorRows();
  return `<div class="hdr"><h1>${d.id ? 'Editar receta' : 'Nueva receta'}</h1><div class="row"><button data-act="cancelEdit">Cancelar</button><button class="primary" data-act="saveRecipe">Guardar</button></div></div>
  <div class="card">
    <label for="e-name">Nombre</label><input id="e-name" value="${esc(d.name)}" placeholder="Ej. Lentejas con verduras">
    <div class="spacer"></div><label for="e-desc">Descripción (opcional)</label><input id="e-desc" value="${esc(d.description)}">
    <div class="spacer"></div>
    <div class="grid2">
      <div><label for="e-serv">Porciones</label><input id="e-serv" type="number" min="1" value="${d.servings}"></div>
      <div><label for="e-prep">Preparación (min)</label><input id="e-prep" inputmode="decimal" value="${d.prepMinutes || ''}"></div>
      <div><label for="e-cook">Cocción (min)</label><input id="e-cook" inputmode="decimal" value="${d.cookMinutes || ''}"></div>
    </div>
    <div class="spacer"></div><label for="e-tags">Etiquetas (separadas por coma)</label><input id="e-tags" value="${esc(d.tags.join(', '))}" placeholder="cena, vegetariano">
  </div>
  <h2>Ingredientes</h2><div class="card"><div id="ings">${rows.ings}</div><button data-act="addIng">+ Ingrediente</button></div>
  <h2>Pasos</h2><div class="card"><p class="muted">Si un paso lleva tiempo, añade los minutos y en modo cocinar aparecerá un botón de temporizador.</p><div id="steps">${rows.steps}</div><button data-act="addStep">+ Paso</button></div>
  <h2>Notas</h2><div class="card"><textarea id="e-notes">${esc(d.notes)}</textarea></div>
  <div class="row"><button class="primary" data-act="saveRecipe">Guardar</button><button data-act="cancelEdit">Cancelar</button></div>`;
}
function readEditor() {
  const d = ui.draft;
  d.name = $('#e-name').value; d.description = $('#e-desc').value;
  d.servings = Math.max(1, Math.round(num($('#e-serv').value, 2)) || 2);
  d.prepMinutes = num($('#e-prep').value, 0); d.cookMinutes = num($('#e-cook').value, 0);
  d.tags = $('#e-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  d.notes = $('#e-notes').value;
  d.ingredients = [...document.querySelectorAll('#ings .edrow')].map(r => ({ name: $('.i-name', r).value, qty: num($('.i-qty', r).value, 0), unit: $('.i-unit', r).value }));
  d.steps = [...document.querySelectorAll('#steps .edstep')].map(r => ({ text: $('.s-text', r).value, timer: num($('.s-timer', r).value, 0) }));
}
function refreshEditorRows() {
  const rows = editorRows();
  $('#ings').innerHTML = rows.ings; $('#steps').innerHTML = rows.steps;
}

/* compras */
function viewShop() {
  const items = aggregate(ui.shopFrom, ui.shopTo);
  const ck = S.shop.checked;
  const extra = S.shop.extra;
  const list = items.map(e => `<li class="${ck[e.key] ? 'chk' : ''}"><input type="checkbox" ${ck[e.key] ? 'checked' : ''} data-chg="toggleShop" data-key="${esc(e.key)}" aria-label="${esc(e.name)}"><span class="t">${esc(shopLine(e))}<span class="src">${esc([...e.from].join(', '))}</span></span></li>`).join('');
  const ex = extra.map(e => `<li class="${e.checked ? 'chk' : ''}"><input type="checkbox" ${e.checked ? 'checked' : ''} data-chg="toggleExtra" data-id="${e.id}" aria-label="${esc(e.name)}"><span class="t">${esc(e.name)}</span><button class="icon ghost danger" data-act="delExtra" data-id="${e.id}" aria-label="Quitar">✕</button></li>`).join('');
  return `<div class="hdr"><h1>Lista de compras</h1><div class="row"><button data-act="shopCopy">📋 Copiar</button><button data-act="shopClear">Limpiar marcas</button></div></div>
  <div class="card"><div class="grid2"><div><label for="s-from">Desde</label><input id="s-from" type="date" value="${ui.shopFrom}" data-chg="shopRange"></div><div><label for="s-to">Hasta</label><input id="s-to" type="date" value="${ui.shopTo}" data-chg="shopRange"></div></div>
  <div class="row" style="margin-top:8px"><button data-act="shopPreset" data-p="week">Esta semana</button><button data-act="shopPreset" data-p="next">Próx. 7 días</button><button data-act="shopPreset" data-p="month">Este mes</button></div></div>
  <h2>Ingredientes de lo planificado</h2>
  <ul class="plain shop">${list || '<li class="muted">No hay platillos planificados en este rango.</li>'}</ul>
  <h2>Otros artículos</h2>
  <ul class="plain shop">${ex}</ul>
  <form class="row" data-form="extra"><input id="x-name" class="grow" placeholder="Añadir artículo (ej. papel de cocina)" style="flex:1"><button class="primary">Añadir</button></form>`;
}

/* cocinar */
function viewCook() {
  const c = ui.cook, r = getRecipe(c.recipeId);
  if (!r) { ui.cook = null; return viewCalendar(); }
  const f = c.servings / r.servings, step = r.steps[c.step], n = r.steps.length;
  const ings = `<details ${c.step === 0 ? 'open' : ''}><summary>Ingredientes (${c.servings} porc.)</summary><ul class="plain">${r.ingredients.map(i => `<li>${i.qty ? fmtQty(i.qty * f) + (i.unit ? ' ' + esc(i.unit) : '') + ' ' : ''}${esc(i.name)}</li>`).join('')}</ul></details>`;
  let body;
  if (!n) body = `<div class="card empty">Esta receta no tiene pasos. Edítala para añadirlos.</div>`;
  else {
    const done = c.step >= n;
    body = done ? `<div class="card stepbox">🎉 ¡Listo! Buen provecho.</div>
      <div class="nav3"><button data-act="cookPrev">← Atrás</button><button class="primary" data-act="cookExit">Terminar</button></div>`
      : `<div class="bar"><i style="width:${(c.step / n) * 100}%"></i></div>
      <div class="muted">Paso ${c.step + 1} de ${n}</div>
      <div class="card stepbox">${esc(step.text)}</div>
      ${step.timer ? `<button class="primary tbtn" data-act="startTimer" data-min="${step.timer}" data-label="${esc(r.name)} · paso ${c.step + 1}">⏱ Iniciar temporizador ${fmtMin(step.timer)}</button>` : ''}
      <div class="row" style="margin-top:10px"><input id="ct-min" inputmode="decimal" placeholder="Otro temporizador (min)" style="flex:1"><button data-act="customTimer" data-label="${esc(r.name)} · paso ${c.step + 1}">Iniciar</button></div>
      <div class="nav3"><button data-act="cookPrev" ${c.step === 0 ? 'disabled' : ''}>← Anterior</button><button class="primary" data-act="cookNext">${c.step === n - 1 ? 'Finalizar ✓' : 'Siguiente →'}</button></div>`;
  }
  return `<div class="cook"><div class="hdr"><h1>${esc(r.name)}</h1><div class="row"><button data-act="cookServ" data-n="-1" aria-label="Menos porciones">−</button><span>${c.servings} porc.</span><button data-act="cookServ" data-n="1" aria-label="Más porciones">+</button><button class="danger" data-act="cookExit">Salir</button></div></div>${ings}${body}${r.notes ? `<details><summary>Notas</summary><p>${esc(r.notes)}</p></details>` : ''}</div>`;
}

/* datos */
function viewData() {
  return `<div class="hdr"><h1>Datos y IA</h1></div>
  <div class="card"><b>Usar una IA para crear recetas</b><p class="muted">Copia el prompt, pégalo en tu IA favorita (describiendo lo que quieres), y pega aquí la respuesta JSON. También puede proponerte el plan del mes.</p>
    <div class="row"><button class="primary" data-act="importDlg">🤖 Importar JSON de IA</button><button data-act="copyPrompt">Copiar prompt</button></div></div>
  <div class="card"><b>Respaldo</b><p class="muted">Todo se guarda solo en este dispositivo. Exporta un respaldo para pasar tus datos a otro dispositivo o guardarlos.</p>
    <div class="row"><button class="primary" data-act="exportAll">⬇ Exportar respaldo</button><button data-act="exportRecipes">Exportar solo recetas</button>
    <button data-act="pickBackup">⬆ Importar respaldo</button><input id="backupFile" type="file" accept="application/json,.json" hidden></div></div>
  <div class="card"><b>Notificaciones</b><p class="muted">Permite avisos para que el temporizador suene aunque estés en otra app (según el navegador).</p>
    <button data-act="askNotif">Activar notificaciones</button></div>
  <div class="card"><b>Borrar todo</b><p class="muted">Elimina recetas y plan de este dispositivo.</p><button class="danger" data-act="wipe">Borrar todos los datos</button></div>
  <p class="muted">${S.recipes.length} recetas · ${Object.values(S.plan).reduce((a, b) => a + b.length, 0)} platillos planificados</p>`;
}

/* ───────── render ───────── */
const VIEWS = { calendar: viewCalendar, day: viewDay, recipes: viewRecipes, editor: viewEditor, shop: viewShop, cook: viewCook, data: viewData };
function render() {
  document.body.dataset.view = ui.view;
  $('#view').innerHTML = VIEWS[ui.view]();
  const group = { calendar: 'calendar', day: 'calendar', recipes: 'recipes', editor: 'recipes', shop: 'shop', data: 'data', cook: '' }[ui.view];
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === group));
  renderTimers();
}
function go(view) { ui.view = view; render(); window.scrollTo(0, 0); }

/* ───────── diálogos ───────── */
const dlg = $('#dlg');
function openDlg(html) { dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); }
function closeDlg() { if (dlg.open) dlg.close(); }
dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(); });

function planDlg(date, recipeId) {
  if (!S.recipes.length) { toast('Primero crea o importa una receta'); return go('recipes'); }
  const sorted = S.recipes.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const sel = recipeId || sorted[0].id, r = getRecipe(sel);
  openDlg(`<h2 style="margin-top:0">Añadir al plan</h2>
  <label for="pd-date">Día</label><input id="pd-date" type="date" value="${date || ui.day}">
  <div class="spacer"></div><label for="pd-recipe">Receta</label>
  <select id="pd-recipe" data-chg="pdRecipe">${sorted.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
  <div class="spacer"></div><div class="grid2"><div><label for="pd-time">Hora prevista</label><input id="pd-time" type="time" value="13:00"></div>
  <div><label for="pd-serv">Porciones</label><input id="pd-serv" type="number" min="1" value="${r.servings}"></div></div>
  <div class="spacer"></div><div class="row"><button class="primary" data-act="planSave">Añadir</button><button data-act="closeDlg">Cancelar</button></div>`);
}

const AI_PROMPT = `Eres un asistente de cocina. Responde ÚNICAMENTE con un JSON válido (sin texto extra ni explicaciones, puede ir dentro de un bloque \`\`\`json) con este formato exacto:

{
  "schema": "planner/1",
  "recipes": [
    {
      "name": "Nombre de la receta",
      "description": "Descripción breve",
      "servings": 4,
      "prepMinutes": 15,
      "cookMinutes": 30,
      "tags": ["almuerzo", "vegetariano"],
      "ingredients": [
        { "name": "Lentejas", "quantity": 300, "unit": "g" },
        { "name": "Sal", "quantity": 0, "unit": "" }
      ],
      "steps": [
        { "text": "Remoja las lentejas.", "timerMinutes": 0 },
        { "text": "Cocina a fuego medio.", "timerMinutes": 25 }
      ],
      "notes": "Opcional"
    }
  ],
  "plan": [
    { "date": "2026-11-20", "recipe": "Nombre de la receta", "time": "13:30", "servings": 4 }
  ]
}

Reglas:
- "quantity" es un número (usa 0 si es "al gusto"). "unit" en texto corto (g, kg, ml, l, taza, cda, cdita, pieza...).
- "timerMinutes" solo si el paso requiere esperar (si no, 0). Un paso = una acción clara.
- "plan" es opcional; "recipe" debe coincidir exactamente con un "name" de "recipes". Fechas en formato AAAA-MM-DD y horas en HH:MM (24 h).
- Usa unidades y nombres de ingredientes consistentes (para que la lista de compras sume bien).

Lo que quiero: [DESCRIBE AQUÍ: tipo de comida, número de porciones, restricciones, cuántos días/semanas planificar, etc.]`;

function importDlg() {
  openDlg(`<h2 style="margin-top:0">Importar recetas con IA</h2>
  <p class="muted">1) Copia el prompt y pégalo en tu IA. 2) Pega aquí su respuesta JSON.</p>
  <div class="row"><button data-act="copyPrompt">📋 Copiar prompt para la IA</button><button data-act="togglePrompt">Ver prompt</button></div>
  <pre class="prompt" id="promptPre" hidden>${esc(AI_PROMPT)}</pre>
  <div class="spacer"></div><label for="imp-text">JSON de la IA</label><textarea id="imp-text" placeholder='{"recipes":[…]}' style="min-height:160px"></textarea>
  <div class="row" style="margin:8px 0"><input id="imp-file" type="file" accept="application/json,.json,.txt"><label style="margin:0;display:flex;gap:8px;align-items:center"><input type="checkbox" id="imp-replace" style="width:20px"> Reemplazar recetas con el mismo nombre</label></div>
  <div id="imp-msg" class="muted" role="alert"></div>
  <div class="row"><button class="primary" data-act="doImport">Importar</button><button data-act="closeDlg">Cancelar</button></div>`);
}

function extractJSON(text) {
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.search(/[\[{]/);
  if (a < 0) throw new Error('No se encontró JSON en el texto');
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  return t.slice(a, end + 1);
}

function importAI(text, replace) {
  let data;
  try { data = JSON.parse(extractJSON(text)); } catch (e) { throw new Error('JSON inválido: ' + e.message); }
  const rawRecipes = Array.isArray(data) ? data : Array.isArray(data.recipes ?? data.recetas) ? (data.recipes ?? data.recetas) : (data.name || data.nombre) ? [data] : [];
  const rawPlan = !Array.isArray(data) && Array.isArray(data.plan) ? data.plan : [];
  if (!rawRecipes.length && !rawPlan.length) throw new Error('No hay recetas ni plan en el JSON');
  const cleaned = rawRecipes.map((r, i) => { try { return cleanRecipe(r); } catch (e) { throw new Error(`Receta ${i + 1}: ${e.message}`); } });
  const byName = n => S.recipes.find(r => r.name.toLowerCase() === n.toLowerCase());
  let added = 0, updated = 0;
  const staged = [...S.recipes];
  for (const c of cleaned) {
    const ex = staged.find(r => r.name.toLowerCase() === c.name.toLowerCase());
    if (ex && replace) { Object.assign(ex, c); updated++; }
    else {
      let name = c.name;
      if (ex) { let k = 2; while (staged.some(r => r.name.toLowerCase() === `${c.name} (${k})`.toLowerCase())) k++; name = `${c.name} (${k})`; }
      staged.push({ ...c, name, id: uid() }); added++;
    }
  }
  // plan
  let planned = 0; const skipped = [];
  const planAdds = [];
  for (const p of rawPlan) {
    const date = String(p?.date ?? p?.fecha ?? '');
    const rname = String(p?.recipe ?? p?.receta ?? '').trim();
    const rec = staged.find(r => r.name.toLowerCase() === rname.toLowerCase())
      || staged.find(r => cleaned.some(c => c.name.toLowerCase() === rname.toLowerCase() && r.name.toLowerCase().startsWith(rname.toLowerCase())));
    if (!validDate(date) || !rec) { skipped.push(rname || date || '?'); continue; }
    planAdds.push({ date, item: { id: uid(), recipeId: rec.id, time: validTime(p.time ?? p.hora) ? (p.time ?? p.hora) : '13:00', servings: Math.round(num(p.servings ?? p.porciones, 0)) || 0, done: false } });
  }
  // aplicar
  S.recipes = staged;
  for (const { date, item } of planAdds) { (S.plan[date] = S.plan[date] || []).push(item); planned++; }
  return { added, updated, planned, skipped, byName };
}

/* ───────── prompt/export helpers ───────── */
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
const exportRecipe = r => ({ name: r.name, description: r.description, servings: r.servings, prepMinutes: r.prepMinutes, cookMinutes: r.cookMinutes, tags: r.tags, ingredients: r.ingredients.map(i => ({ name: i.name, quantity: i.qty, unit: i.unit })), steps: r.steps.map(s => ({ text: s.text, timerMinutes: s.timer })), notes: r.notes });

/* ───────── acciones ───────── */
const A = {
  nav: d => { if (d.view === 'calendar') ui.month = new Date(parseYmd(ui.day).getFullYear(), parseYmd(ui.day).getMonth(), 1); go(d.view); },
  monthShift: d => { ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + Number(d.n), 1); render(); },
  monthToday: () => { const t = new Date(); ui.month = new Date(t.getFullYear(), t.getMonth(), 1); render(); },
  openDay: d => { ui.day = d.date; go('day'); },
  dayShift: d => { ui.day = ymd(addDays(parseYmd(ui.day), Number(d.n))); render(); },
  closeDlg,
  planDlg: d => planDlg(d.date, d.recipe),
  planSave: async () => {
    const date = $('#pd-date').value, rid = $('#pd-recipe').value, time = $('#pd-time').value;
    if (!validDate(date)) return toast('Elige un día válido');
    const sv = Math.max(1, Math.round(num($('#pd-serv').value, 1)) || 1);
    (S.plan[date] = S.plan[date] || []).push({ id: uid(), recipeId: rid, time: validTime(time) ? time : '13:00', servings: sv, done: false });
    await save(); closeDlg(); ui.day = date;
    if (ui.view === 'recipes') toast('Añadido al plan ✓'); else { ui.view = 'day'; render(); }
  },
  removeDish: async d => {
    S.plan[d.date] = (S.plan[d.date] || []).filter(i => i.id !== d.id);
    if (!S.plan[d.date].length) delete S.plan[d.date];
    await save(); render();
  },
  shopDay: d => { ui.shopFrom = ui.shopTo = d.date; go('shop'); },

  newRecipe: () => { ui.draft = { name: '', description: '', servings: 2, prepMinutes: 0, cookMinutes: 0, tags: [], ingredients: [{ name: '', qty: 0, unit: '' }], steps: [{ text: '', timer: 0 }], notes: '' }; ui.returnTo = ui.view === 'day' ? 'day' : 'recipes'; go('editor'); },
  editRecipe: d => { const r = getRecipe(d.id); ui.draft = JSON.parse(JSON.stringify(r)); ui.returnTo = ui.view === 'day' ? 'day' : 'recipes'; go('editor'); },
  dupRecipe: async d => { const r = JSON.parse(JSON.stringify(getRecipe(d.id))); r.id = uid(); r.name += ' (copia)'; S.recipes.push(r); await save(); render(); toast('Receta duplicada'); },
  delRecipe: async d => {
    const r = getRecipe(d.id);
    const used = Object.values(S.plan).flat().filter(i => i.recipeId === d.id).length;
    if (!confirm(`¿Eliminar "${r.name}"?${used ? `\nSe quitará también de ${used} día(s) del plan.` : ''}`)) return;
    S.recipes = S.recipes.filter(x => x.id !== d.id);
    for (const [date, items] of Object.entries(S.plan)) { S.plan[date] = items.filter(i => i.recipeId !== d.id); if (!S.plan[date].length) delete S.plan[date]; }
    await save(); render();
  },
  cancelEdit: () => { ui.draft = null; go(ui.returnTo || 'recipes'); },
  addIng: () => { readEditor(); ui.draft.ingredients.push({ name: '', qty: 0, unit: '' }); refreshEditorRows(); const l = document.querySelectorAll('#ings .i-name'); l[l.length - 1]?.focus(); },
  delIng: d => { readEditor(); ui.draft.ingredients.splice(Number(d.n), 1); refreshEditorRows(); },
  addStep: () => { readEditor(); ui.draft.steps.push({ text: '', timer: 0 }); refreshEditorRows(); const l = document.querySelectorAll('#steps .s-text'); l[l.length - 1]?.focus(); },
  delStep: d => { readEditor(); ui.draft.steps.splice(Number(d.n), 1); refreshEditorRows(); },
  moveStep: d => { readEditor(); const n = Number(d.n), m = n + Number(d.d), s = ui.draft.steps; if (m < 0 || m >= s.length) return; [s[n], s[m]] = [s[m], s[n]]; refreshEditorRows(); },
  saveRecipe: async () => {
    readEditor();
    const d = ui.draft;
    if (!d.name.trim()) { toast('Ponle un nombre a la receta'); return $('#e-name').focus(); }
    const c = cleanRecipe(d);
    if (d.id) { const i = S.recipes.findIndex(r => r.id === d.id); S.recipes[i] = { ...c, id: d.id }; }
    else S.recipes.push({ ...c, id: uid() });
    await save(); ui.draft = null; toast('Receta guardada ✓'); go(ui.returnTo || 'recipes');
  },

  importDlg,
  togglePrompt: () => { const p = $('#promptPre'); p.hidden = !p.hidden; },
  copyPrompt: () => copyText(AI_PROMPT, 'Prompt copiado ✓'),
  doImport: async () => {
    const msg = $('#imp-msg');
    try {
      const res = importAI($('#imp-text').value, $('#imp-replace').checked);
      await save();
      closeDlg(); render();
      toast(`Importado: ${res.added} nueva(s), ${res.updated} actualizada(s), ${res.planned} en el plan${res.skipped.length ? `, ${res.skipped.length} omitida(s)` : ''}`);
    } catch (e) { msg.style.color = 'var(--danger)'; msg.textContent = '⚠️ ' + e.message; }
  },
  exportAll: () => { download(`planner-respaldo-${ymd(new Date())}.json`, JSON.stringify({ app: 'planner', ...S }, null, 2)); },
  exportRecipes: () => { download(`recetas-${ymd(new Date())}.json`, JSON.stringify({ schema: 'planner/1', recipes: S.recipes.map(exportRecipe) }, null, 2)); },
  pickBackup: () => $('#backupFile').click(),
  askNotif: async () => { try { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Notificaciones activadas ✓' : 'Permiso no concedido'); } catch { toast('Este navegador no soporta notificaciones'); } },
  wipe: async () => { if (!confirm('¿Borrar TODAS las recetas y el plan de este dispositivo?')) return; S = emptyState(); await save(); render(); toast('Datos borrados'); },

  shopPreset: d => {
    const t = new Date();
    if (d.p === 'week') { const off = (t.getDay() + 6) % 7; ui.shopFrom = ymd(addDays(t, -off)); ui.shopTo = ymd(addDays(t, 6 - off)); }
    else if (d.p === 'next') { ui.shopFrom = ymd(t); ui.shopTo = ymd(addDays(t, 6)); }
    else { ui.shopFrom = ymd(new Date(t.getFullYear(), t.getMonth(), 1)); ui.shopTo = ymd(new Date(t.getFullYear(), t.getMonth() + 1, 0)); }
    render();
  },
  shopCopy: () => {
    const items = aggregate(ui.shopFrom, ui.shopTo).filter(e => !S.shop.checked[e.key]).map(e => '• ' + shopLine(e));
    const ex = S.shop.extra.filter(e => !e.checked).map(e => '• ' + e.name);
    const all = [...items, ...ex];
    if (!all.length) return toast('La lista está vacía');
    copyText(`Lista de compras (${ui.shopFrom} → ${ui.shopTo})\n${all.join('\n')}`, 'Lista copiada ✓');
  },
  shopClear: async () => { S.shop.checked = {}; S.shop.extra.forEach(e => e.checked = false); await save(); render(); },
  delExtra: async d => { S.shop.extra = S.shop.extra.filter(e => e.id !== d.id); await save(); render(); },

  cookItem: d => { const it = (S.plan[d.date] || []).find(i => i.id === d.id), r = getRecipe(it.recipeId); ui.cook = { recipeId: r.id, servings: it.servings || r.servings, step: 0 }; requestWake(); go('cook'); },
  cookRecipe: d => { const r = getRecipe(d.id); ui.cook = { recipeId: r.id, servings: r.servings, step: 0 }; requestWake(); go('cook'); },
  cookPrev: () => { ui.cook.step = Math.max(0, ui.cook.step - 1); render(); },
  cookNext: () => { const r = getRecipe(ui.cook.recipeId); ui.cook.step = Math.min(r.steps.length, ui.cook.step + 1); render(); window.scrollTo(0, 0); },
  cookServ: d => { ui.cook.servings = Math.max(1, ui.cook.servings + Number(d.n)); render(); },
  cookExit: () => { ui.cook = null; releaseWake(); go(ui.day && Object.keys(S.plan).length ? 'calendar' : 'recipes'); },
  startTimer: d => addTimer(Number(d.min), d.label),
  customTimer: d => { const v = num($('#ct-min').value, 0); addTimer(v, d.label + ' (manual)'); $('#ct-min').value = ''; },
  timerAdd: d => { const t = timers.find(x => x.id === d.id); if (t) { t.endAt += 60000; saveTimers(); renderTimers(); } },
  timerDel: d => {
    timers = timers.filter(x => x.id !== d.id); saveTimers();
    if (!timers.some(x => x.fired)) stopAlarm();
    renderTimers();
  },
};

const C = {
  toggleDone: async d => { const it = S.plan[d.date].find(i => i.id === d.id); it.done = !it.done; await save(); render(); },
  itemTime: async (d, el) => { const it = S.plan[d.date].find(i => i.id === d.id); if (validTime(el.value)) { it.time = el.value; await save(); render(); } },
  itemServings: async (d, el) => { const it = S.plan[d.date].find(i => i.id === d.id); it.servings = Math.max(1, Math.round(num(el.value, 1)) || 1); await save(); render(); },
  pdRecipe: (d, el) => { const r = getRecipe(el.value); if (r) $('#pd-serv').value = r.servings; },
  toggleShop: async (d, el) => { if (el.checked) S.shop.checked[d.key] = true; else delete S.shop.checked[d.key]; await save(); render(); },
  toggleExtra: async (d, el) => { const e = S.shop.extra.find(x => x.id === d.id); e.checked = el.checked; await save(); render(); },
  shopRange: () => {
    const f = $('#s-from').value, t = $('#s-to').value;
    if (validDate(f)) ui.shopFrom = f;
    if (validDate(t)) ui.shopTo = t;
    if (ui.shopFrom > ui.shopTo) ui.shopTo = ui.shopFrom;
    render();
  },
};

/* ───────── eventos ───────── */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  unlockAudio();
  const fn = A[el.dataset.act];
  if (fn) fn(el.dataset, el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-chg]');
  if (el && C[el.dataset.chg]) C[el.dataset.chg](el.dataset, el);
  if (e.target.id === 'imp-file' && e.target.files[0]) {
    e.target.files[0].text().then(t => { $('#imp-text').value = t; });
  }
  if (e.target.id === 'backupFile' && e.target.files[0]) {
    const f = e.target.files[0]; e.target.value = '';
    f.text().then(async t => {
      try {
        const d = JSON.parse(t);
        if (!d || !Array.isArray(d.recipes) || typeof d.plan !== 'object' || Array.isArray(d.plan)) throw new Error('No parece un respaldo del planner (usa "Importar con IA" para recetas sueltas)');
        if (!confirm('Esto reemplazará los datos actuales de este dispositivo. ¿Continuar?')) return;
        S = normalizeState(d); await save(); render(); toast('Respaldo importado ✓');
      } catch (err) { toast('⚠️ ' + err.message); }
    });
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { ui.q = e.target.value; $('#recipeList').innerHTML = recipeCards(); }
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form=extra]');
  if (!f) return;
  e.preventDefault();
  const name = $('#x-name').value.trim();
  if (!name) return;
  S.shop.extra.push({ id: uid(), name, checked: false });
  await save(); render(); $('#x-name').focus();
});

/* pantalla encendida en modo cocinar */
let wake = null;
async function requestWake() { try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch {} }
function releaseWake() { try { wake && wake.release(); } catch {} wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (ui.cook) requestWake(); tick(); } });

/* ───────── inicio ───────── */
(async function init() {
  S = normalizeState(await Store.load());
  render();
  tick();
  setInterval(tick, 500);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
})();
