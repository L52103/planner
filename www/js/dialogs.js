/* Diálogos y hojas: plan, recetario, IA, organizar el mes, listas, platillo, añadir rápido. */
'use strict';

const dlg = $('#dlg');
function openDlg(html) { dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); }
function closeDlg() { if (dlg.open) dlg.close(); }
dlg.addEventListener('click', e => { if (e.target === dlg) closeDlg(); });
// Al cerrar se limpia el estado del diálogo (salvo que otro se haya abierto enseguida)
dlg.addEventListener('close', () => { if (dlg.open) return; ui.pick = null; ui.pd = null; ui.nl = null; ui.org = null; ui.sheet = null; });
const dlgHead = (title, sub = '', lead = '') => `<div class="dlg-h">${lead}<div>${sub ? `<p class="muted">${sub}</p>` : ''}<h2>${title}</h2></div><button class="btn icon ghost" data-act="closeDlg" aria-label="Cerrar">${ic('x')}</button></div>`;

function dayChips(selected, act, extra = '') {
  const days = Array.from({ length: 8 }, (_, i) => ymd(addDays(new Date(), i)));
  return `<div class="chips scroll-x">${days.map(d => `<button class="chip${d === selected ? ' on' : ''}" data-act="${act}" data-date="${d}" ${extra} aria-pressed="${d === selected}">${d === days[0] ? 'Hoy' : d === days[1] ? 'Mañana' : `${cap(shortDay(d))} ${parseYmd(d).getDate()}`}</button>`).join('')}</div>`;
}
function mealSeg(selected, act) {
  return `<div class="seg" role="group" aria-label="Comida">${MEALS.map(m => `<button class="c-${m}${m === selected ? ' on' : ''}" data-act="${act}" data-meal="${m}" aria-pressed="${m === selected}"><i class="pip"></i>${CATS[m].name}</button>`).join('')}</div>`;
}

/* ───────── Añadir una receta a un día ───────── */
function planDlg(recipeId, date, meal) {
  const r = getRecipe(recipeId);
  if (!r) return;
  const m = meal || (MEALS.includes(r.category) ? r.category : 'almuerzo');
  ui.pd = ui.pd && ui.pd.recipeId === recipeId ? ui.pd : { recipeId, date: date || todayStr(), meal: m, time: CATS[m].time, servings: r.servings };
  renderPlanDlg();
}
function renderPlanDlg() {
  const p = ui.pd, r = getRecipe(p.recipeId);
  openDlg(`${dlgHead(esc(r.name), 'Añadir al plan', plate(r))}
  <span class="lbl">Día</span>${dayChips(p.date, 'pdDate')}
  <input id="pd-date" type="date" value="${p.date}" data-chg="pdDateInput" aria-label="Otra fecha">
  <span class="lbl">Comida</span>${mealSeg(p.meal, 'pdMeal')}
  <div class="grid2"><div><label for="pd-time">Hora prevista</label><input id="pd-time" type="time" value="${p.time}"></div>
  <div><span class="lbl">Porciones</span><span class="stepper"><button class="btn icon" data-act="pdServ" data-n="-1" aria-label="Menos porciones">${ic('minus')}</button><b id="pd-serv">${p.servings}</b><button class="btn icon" data-act="pdServ" data-n="1" aria-label="Más porciones">${ic('plus')}</button></span></div></div>
  <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="planSave">${ic('check')}Añadir a ${esc(relDay(p.date).toLowerCase())}</button></div>`);
}
const readPd = () => { if (ui.pd && $('#pd-time')) ui.pd.time = $('#pd-time').value || ui.pd.time; };

/* ───────── Elegir del recetario para un día ───────── */
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
    return `<div class="pick-row">${plate(r)}<div class="grow"><b>${esc(r.name)}</b>${recipeMeta(r)}</div>
      <button class="btn ${n ? 'ok' : 'primary'} sm" data-act="pickAdd" data-id="${r.id}">${n ? ic('check') + (n > 1 ? `×${n}` : 'Añadida') : ic('plus') + 'Añadir'}</button></div>`;
  }).join('');
}
function renderPick() {
  const p = ui.pick;
  openDlg(`${dlgHead(`Añadir a ${CATS[p.meal].name.toLowerCase()}`, esc(longDate(p.date)))}
  ${mealSeg(p.meal, 'pickMeal')}
  <div class="grid2"><div><label for="pk-date">Día</label><input id="pk-date" type="date" value="${p.date}" data-chg="pickDate"></div><div><label for="pk-time">Hora</label><input id="pk-time" type="time" value="${p.time}" data-chg="pickTime"></div></div>
  <button class="create-new" data-act="pickNew">${ic('plus')}<span><b>Crear una receta nueva</b><span class="muted">Empieza de cero; se añadirá a este día al guardarla.</span></span></button>
  <label class="search">${ic('search')}<input id="pk-q" type="search" placeholder="Busca en tu recetario" value="${esc(p.q)}" aria-label="Buscar en el recetario"></label>
  ${catChips(p.cat, 'pickCat', 'scroll-x')}
  <div id="pickList" class="pick-list">${pickList()}</div>
  <div class="dlg-f"><span class="muted" id="pick-count">${p.added.length ? `${p.added.length} ${p.added.length === 1 ? 'añadida' : 'añadidas'}` : ''}</span><button class="btn primary" data-act="closeDlg">Listo</button></div>`);
}

/* ───────── Platillo planificado (hoja de opciones) ───────── */
function itemSheet(date, id) { ui.sheet = { date, id }; renderItemSheet(); }
function renderItemSheet() {
  if (!ui.sheet) return;
  const { date, id } = ui.sheet, it = findItem(date, id);
  if (!it) return closeDlg();
  const r = getRecipe(it.recipeId), sv = it.servings || r?.servings || 1, f = r ? sv / r.servings : 1;
  openDlg(`${dlgHead(r ? esc(r.name) : 'Receta eliminada', `${esc(relDay(date))}, ${CATS[it.meal].name.toLowerCase()}`, r ? plate(r) : '')}
  <div class="sheet-actions">
    ${r ? `<button class="btn primary" data-act="cookItem" data-date="${date}" data-id="${id}">${ic('play', 'fill')}Cocinar</button><button class="btn" data-act="openRecipe" data-id="${r.id}">Ver receta</button>` : ''}
    <button class="btn${it.done ? ' ok' : ''}" data-act="toggleDoneBtn" data-date="${date}" data-id="${id}" aria-pressed="${it.done}">${ic('check')}${it.done ? 'Hecho' : 'Marcar hecho'}</button></div>
  <span class="lbl">Comida</span>${mealSeg(it.meal, 'sheetMeal')}
  <div class="grid2"><div><label for="is-time">Hora</label><input id="is-time" type="time" value="${esc(it.time)}" data-chg="sheetTime"></div>
    <div><span class="lbl">Porciones</span><span class="stepper"><button class="btn icon" data-act="sheetServ" data-n="-1" aria-label="Menos porciones">${ic('minus')}</button><b>${sv}</b><button class="btn icon" data-act="sheetServ" data-n="1" aria-label="Más porciones">${ic('plus')}</button></span></div></div>
  ${r ? `<details class="sheet-ings"><summary>Ingredientes para ${sv} ${sv === 1 ? 'porción' : 'porciones'}</summary><ul class="ings">${r.ingredients.map(i => `<li><span>${esc(i.name)}</span><b>${i.qty ? `${fmtQty(i.qty * f)}${i.unit ? ' ' + esc(i.unit) : ''}` : ''}</b></li>`).join('')}</ul></details>` : ''}
  <div class="dlg-f wrap"><button class="btn ghost danger push-left" data-act="removeDish" data-date="${date}" data-id="${id}">${ic('trash')}Quitar</button><button class="btn" data-act="moveDish" data-date="${date}" data-id="${id}">${ic('cal')}Otro día</button><button class="btn" data-act="startMove" data-date="${date}" data-id="${id}">${ic('move')}Mover en la semana</button></div>`);
}

function moveDlg(date, id) {
  openDlg(`${dlgHead('Cambiar de día')}
  ${dayChips(date, 'moveTo', `data-from="${date}" data-id="${id}"`)}
  <label for="mv-date">Otra fecha</label><input id="mv-date" type="date" value="${date}">
  <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="moveToInput" data-from="${date}" data-id="${id}">Mover</button></div>`);
}

/* ───────── Añadir rápido (botón +) ───────── */
function quickAdd() {
  const opt = (act, icon, title, sub) => `<button class="qa-opt" data-act="${act}">${ic(icon)}<b>${title}</b><span>${sub}</span></button>`;
  openDlg(`${dlgHead('Añadir')}
  <div class="qa">
    ${opt('qaDish', 'calPlus', 'Platillo a un día', 'Desde tu recetario')}
    ${opt('newRecipe', 'book', 'Nueva receta', 'Desde cero')}
    ${opt('timerSheet', 'timer', 'Temporizador', '1, 5, 10 min o a medida')}
    ${opt('qaItem', 'cart', 'A la lista', 'Artículo de compras')}
    ${opt('importDlg', 'spark', 'Recetas con IA', 'Pega la respuesta de tu IA')}
    ${opt('orgDlg', 'cal', 'Completar días', 'Con recetario o IA')}
  </div>`);
}
function quickItemDlg() {
  if (!S.lists.length) return newListDlg({ mode: 'empty', name: 'Mi lista' });
  const cur = getList(ui.listId) ? ui.listId : S.lists[0].id;
  openDlg(`${dlgHead('Añadir a la lista')}
  <label for="qi-list">Lista</label><select id="qi-list">${S.lists.map(l => `<option value="${l.id}" ${l.id === cur ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
  <label for="qi-name">Artículo</label><input id="qi-name" placeholder="Ej. Yogur natural" autocomplete="off">
  <div class="grid2"><div><label for="qi-qty">Cantidad</label><input id="qi-qty" inputmode="decimal" placeholder="0"></div><div><label for="qi-unit">Unidad</label><input id="qi-unit" list="qi-units" placeholder="pieza"></div></div>
  <datalist id="qi-units">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist>
  <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="qiSave">${ic('plus')}Añadir</button></div>`);
  $('#qi-name').focus();
}
function recipeMenu(id) {
  const r = getRecipe(id);
  openDlg(`${dlgHead(esc(r.name), 'Receta', plate(r))}
  <div class="menu-list">
    <button data-act="editRecipe" data-id="${id}">${ic('edit')}Editar receta</button>
    <button data-act="planDlg" data-recipe="${id}">${ic('calPlus')}Añadir a un día</button>
    <button data-act="dupRecipe" data-id="${id}">${ic('copy')}Duplicar</button>
    <button data-act="copyRecipe" data-id="${id}">${ic('share')}Copiar como JSON</button>
    <button class="danger" data-act="delRecipe" data-id="${id}">${ic('trash')}Eliminar</button>
  </div>`);
}
function cookSheet(k) {
  const c = ui.cook, r = getRecipe(c.recipeId), lists = cookLists(r, c, c.servings / r.servings);
  openDlg(`${dlgHead(k === 'ing' ? 'Ingredientes' : 'Todos los pasos', `${esc(r.name)}, ${c.servings} porc.`)}${k === 'ing' ? lists.ing : lists.steps}`);
}

/* ───────── Recetas con IA ───────── */
const NUTR_JSON = '"nutrition": { "kcal": 450, "protein": 22, "carbs": 60, "fat": 12, "fiber": 9, "iron": 6, "calcium": 120 }';
const AI_PROMPT = `Eres un asistente de cocina. Responde ÚNICAMENTE con un JSON válido (sin texto adicional; puede ir dentro de un bloque \`\`\`json) con este formato:

{
  "schema": "planner/3",
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
      ${NUTR_JSON},
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
- "nutrition" es POR PORCIÓN y aproximado: kcal, protein (g), carbs (g), fat (g), fiber (g), iron (mg), calcium (mg).
- "plan" es opcional. "recipe" debe coincidir exactamente con un "name" de "recipes" (o con una receta que ya tengo). "meal": desayuno, almuerzo, merienda o cena. Fechas AAAA-MM-DD, horas HH:MM (24 h).
- Usa nombres de ingredientes y unidades consistentes entre recetas para que la lista de compras sume bien.

Lo que quiero: [DESCRIBE AQUÍ: tipo de comida, porciones, restricciones, presupuesto, cuántos días o semanas planificar…]`;

function importDlg() {
  openDlg(`${dlgHead('Importar respuesta de la IA', 'Recetas con IA')}
  <ol class="howto"><li>Copia el prompt y pégalo en tu IA, describiendo lo que quieres al final.</li><li>Copia su respuesta completa.</li><li>Pégala aquí abajo e importa.</li></ol>
  <div class="row"><button class="btn" data-act="copyPrompt">${ic('copy')}Copiar prompt</button><button class="btn ghost" data-act="togglePrompt">Ver prompt</button></div>
  <pre class="prompt" id="promptPre" hidden>${esc(AI_PROMPT)}</pre>
  <label for="imp-text">Respuesta de la IA</label><textarea id="imp-text" placeholder='{"recipes": [ … ]}' style="min-height:170px"></textarea>
  <div class="row"><label class="btn ghost sm file">${ic('up')}Elegir archivo .json<input id="imp-file" type="file" accept="application/json,.json,.txt" hidden></label>
    <label class="check"><input type="checkbox" id="imp-replace"> Reemplazar recetas con el mismo nombre</label></div>
  <p id="imp-msg" class="err" role="alert"></p>
  <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="doImport">${ic('check')}Importar</button></div>`);
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

/* ───────── Organizar días (recetario o IA) ───────── */
function monthRange(p) {
  const m = ui.month, y = m.getFullYear(), mo = m.getMonth();
  const first = ymd(new Date(y, mo, 1)), last = ymd(new Date(y, mo + 1, 0)), t = todayStr();
  if (p === 'week') { const d = weekDays(ui.weekStart); return [d[0] < t && d[6] >= t ? t : d[0], d[6]]; }
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
  const preset = ui.view === 'week' ? 'week' : 'rest';
  const [f, t] = monthRange(preset);
  ui.org = { mode: 'auto', preset, from: f, to: t, meals: ['almuerzo', 'cena'], source: 'all', skipFilled: true, gap: 4, preview: [], nutri: true, allowNew: true, extra: '', showPrompt: false };
  orgRefresh();
}
function orgRefresh() { ui.org.preview = buildPlan(ui.org); renderOrg(); }

// Metas en texto para el prompt nutricional (ingestas de referencia, orientativas)
function nutriTargets(p) {
  const w = p.sex === 'mujer';
  const kcal = { mujer: { sedentaria: '1800–2000', moderada: '2000–2200', activa: '2200–2400' }, hombre: { sedentaria: '2200–2400', moderada: '2400–2800', activa: '2800–3000' } }[w ? 'mujer' : 'hombre'][p.activity];
  const kg = num(p.weight, 0);
  const protPerKg = p.goal === 'musculo' ? '1,4–1,8' : p.activity === 'activa' ? '1,2–1,6' : '1,0–1,2';
  const prot = kg ? `${protPerKg} g por kg (unos ${Math.round(kg * parseFloat(protPerKg.replace(',', '.')))}–${Math.round(kg * parseFloat(protPerKg.split('–')[1].replace(',', '.')))} g)` : `al menos ${w ? 46 : 56} g (mejor ${protPerKg} g por kg de peso)`;
  const goalLine = { energia: 'mantener la energía estable: comidas regulares, carbohidratos complejos en cada comida y meriendas con proteína', mantener: 'equilibrio entre lo que como y lo que gasto', bajar: 'un déficit suave (unas 300–500 kcal menos), sin bajar de 1600 kcal ni saltar comidas, y mucha saciedad (proteína y fibra)', musculo: 'un pequeño superávit (unas 200–300 kcal más) y proteína repartida en 4 tomas' }[p.goal];
  return [
    `Energía: ${kcal} kcal al día${p.goal === 'bajar' ? ' como referencia de mantenimiento' : ''}, repartidas en desayuno, almuerzo, merienda y cena. Objetivo: ${goalLine}.`,
    `Proteína: ${prot}, repartida en todas las comidas (huevo, lácteos, legumbres, pollo, pescado, tofu).`,
    `Carbohidratos de calidad y fibra: ${w ? '25–28' : '30–34'} g de fibra (cereales integrales, avena, legumbres, verduras, fruta).`,
    `Hierro: ${w ? '18' : '8'} mg (legumbres, carne roja magra, espinaca, frutos secos), acompañado de vitamina C (cítricos, pimiento, tomate) para absorberlo mejor.`,
    'Calcio: 1000 mg (lácteos, bebidas vegetales fortificadas, sardinas, tofu, almendras) y vitamina D: 15 µg (600 UI) (pescado azul, huevo, lácteos fortificados).',
    `Ácido fólico: 400 µg (hojas verdes, legumbres, cítricos, aguacate)${w ? ', especialmente importante para mujeres en edad fértil' : ''}.`,
    `Vitamina B12: 2,4 µg; magnesio: ${w ? '310' : '400'} mg; zinc: ${w ? '8' : '11'} mg; omega-3: pescado azul unas 2 veces por semana, nueces, chía o linaza.`,
    'Variedad: al menos 5 porciones de frutas y verduras de colores distintos al día; grasas saludables (aceite de oliva, aguacate, frutos secos).',
    'Hidratación: recuerda unos 2,7 L de líquidos al día (no hace falta incluirlo en el JSON).',
    'Limita ultraprocesados, frituras y azúcares añadidos; porciones realistas y recetas sencillas de cocinar entre semana.',
  ];
}
const RECIPE_FORMAT = `    {
      "name": "Nombre de la receta",
      "emoji": "🥗",
      "category": "almuerzo",
      "difficulty": "facil",
      "description": "Descripción breve",
      "servings": 1,
      "prepMinutes": 10,
      "cookMinutes": 20,
      "tags": ["alto en hierro", "rico en fibra"],
      "ingredients": [{ "name": "Lentejas", "quantity": 80, "unit": "g" }],
      "steps": [{ "text": "Cocina las lentejas.", "timerMinutes": 25 }],
      ${NUTR_JSON}
    }`;
function planPrompt(o) {
  const p = profile();
  const recipes = S.recipes.map(r => `- ${r.name} (${CATS[r.category].name.toLowerCase()}${hasNutr(r) ? `, ${fmtNum(r.nutrition.kcal)} kcal, ${fmtNum(r.nutrition.protein || 0)} g proteína, ${fmtNum(r.nutrition.iron || 0, 1)} mg hierro por porción` : r.tags.length ? ', ' + r.tags.slice(0, 3).join(', ') : ''})`).join('\n');
  const who = `${p.sex === 'mujer' ? 'Mujer' : 'Hombre'} de ${p.age} años${num(p.weight, 0) ? `, ${num(p.weight, 0)} kg` : ''}. Actividad: ${ACTIVITY[p.activity].toLowerCase()}.`;
  const nutri = o.nutri, out = [];
  out.push(nutri
    ? `Actúa como nutricionista y planificador de menús. Organiza mi menú del ${o.from} al ${o.to} priorizando que cubra mis necesidades nutricionales para tener energía y rendir bien cada día.`
    : `Organiza mi menú del ${o.from} al ${o.to}.`);
  if (nutri) {
    out.push(`## Mi perfil\n- ${who}\n- Objetivo: ${GOALS[p.goal]}.\n- Restricciones, alergias o cosas que no como: ${String(p.restrictions).trim() || 'ninguna'}.\n- Porciones por comida: ${p.servings}.`);
    out.push(`## Prioridad nutricional (metas diarias de referencia para mi perfil${p.age < 19 || p.age > 30 ? '; ajústalas a mi edad' : ''})\n${nutriTargets(p).map(x => '- ' + x).join('\n')}\n\nCada día debe sumar estas metas entre todas sus comidas. No te saltes el desayuno y equilibra cada plato (verdura + proteína + carbohidrato integral).`);
  }
  out.push(`## Recetas de mi recetario (usa el nombre exacto)\n${recipes || '- (todavía no tengo recetas)'}\n\n${o.allowNew
    ? `Usa primero estas recetas. Si con ellas no se cubren bien ${nutri ? 'las metas nutricionales' : 'todas las comidas'} o se repiten demasiado, propón recetas nuevas${nutri ? ' equilibradas' : ''} en "recipes", completas con ingredientes, pasos y "nutrition" por porción.`
    : 'Usa SOLO recetas de esta lista.'}`);
  out.push(`## Formato de respuesta\nResponde ÚNICAMENTE con un JSON válido, sin texto antes ni después (puede ir dentro de un bloque \`\`\`json):\n{\n${o.allowNew ? `  "recipes": [\n${RECIPE_FORMAT}\n  ],\n` : ''}  "plan": [\n    { "date": "${o.from}", "recipe": "Nombre exacto", "meal": "desayuno", "time": "08:00", "servings": ${p.servings} }\n  ]${nutri ? ',\n  "nutritionNotes": "Resumen breve de cómo el plan cubre las metas"' : ''}\n}\n\nReglas:\n- "recipe" debe coincidir exactamente con un nombre de mi recetario${o.allowNew ? ' o de "recipes"' : ''}.\n- "meal": desayuno, almuerzo, merienda o cena. "time" en HH:MM (24 h).\n- Fechas AAAA-MM-DD entre ${o.from} y ${o.to}${nutri ? ', con las 4 comidas de cada día' : ''}.\n- Evita repetir la misma receta en días seguidos.${o.allowNew ? '\n- En recetas nuevas: "category" (desayuno, almuerzo, merienda, cena, postre u otro), "difficulty" (facil, media o dificil), "quantity" numérica (0 si es al gusto), unidades cortas (g, ml, taza, cda, pieza…) y "nutrition" por porción (kcal, protein, carbs, fat, fiber en g; iron y calcium en mg).' : ''}`);
  out.push(`## Lo que quiero\n${o.extra.trim() || '[Añade aquí detalles: días que como fuera, presupuesto, gustos, tiempo para cocinar…]'}`);
  return out.join('\n\n');
}
function renderOrg() {
  const o = ui.org;
  const presets = [['week', 'Esta semana'], ['rest', 'Resto del mes'], ['month', 'Todo el mes'], ['next', 'Próximos 7 días']];
  const dates = `<div class="chips scroll-x">${presets.map(([k, n]) => `<button class="chip${o.preset === k ? ' on' : ''}" data-act="orgPreset" data-p="${k}" aria-pressed="${o.preset === k}">${n}</button>`).join('')}</div>
    <div class="grid2"><div><label for="og-from">Desde</label><input id="og-from" type="date" value="${o.from}" data-chg="orgRange"></div><div><label for="og-to">Hasta</label><input id="og-to" type="date" value="${o.to}" data-chg="orgRange"></div></div>`;
  let body;
  if (o.mode === 'auto') {
    const byDay = {};
    for (const p of o.preview) (byDay[p.date] = byDay[p.date] || []).push(p);
    const days = Object.keys(byDay).sort();
    const pool = S.recipes.filter(r => o.source !== 'fav' || r.fav);
    const missing = o.meals.filter(m => !candidatesFor(m, pool).length);
    body = `<span class="lbl">Fechas</span>${dates}
    <span class="lbl">Comidas a llenar</span>
    <div class="chips">${MEALS.map(m => `<button class="chip c-${m}${o.meals.includes(m) ? ' on' : ''}" data-act="orgMeal" data-meal="${m}" aria-pressed="${o.meals.includes(m)}"><i class="pip"></i>${CATS[m].name}</button>`).join('')}</div>
    <div class="grid2"><div><span class="lbl">Recetas</span><div class="seg" role="group"><button class="${o.source === 'all' ? 'on' : ''}" data-act="orgSource" data-s="all" aria-pressed="${o.source === 'all'}">Todas</button><button class="${o.source === 'fav' ? 'on' : ''}" data-act="orgSource" data-s="fav" aria-pressed="${o.source === 'fav'}">${ic('star', 'fill')}Favoritas</button></div></div>
      <div><label for="og-gap">No repetir una receta en</label><select id="og-gap" data-chg="orgGap">${[1, 2, 3, 4, 5, 7].map(g => `<option value="${g}" ${g === o.gap ? 'selected' : ''}>${g} ${g === 1 ? 'día' : 'días'}</option>`).join('')}</select></div></div>
    <label class="check og-skip"><input type="checkbox" id="og-skip" data-chg="orgSkip" ${o.skipFilled ? 'checked' : ''}> Respetar las comidas que ya planifiqué</label>
    ${missing.length ? `<p class="warn">No hay recetas de ${missing.map(m => CATS[m].name.toLowerCase()).join(' ni ')} ${o.source === 'fav' ? 'entre tus favoritas' : 'en el recetario'}; esas comidas quedarán vacías.</p>` : ''}
    <div class="org-prev"><div class="sec-h"><h3>${o.preview.length ? `${o.preview.length} platillos en ${days.length} ${days.length === 1 ? 'día' : 'días'}` : 'Nada que añadir'}</h3>${o.preview.length ? `<button class="btn ghost sm" data-act="orgShuffle">${ic('spark')}Mezclar otra vez</button>` : ''}</div>
      ${days.length ? `<ul class="org-list">${days.slice(0, 10).map(d => `<li><b>${esc(cap(shortDay(d)))} ${parseYmd(d).getDate()}</b><span>${byDay[d].map(p => { const r = getRecipe(p.recipeId); return `<span class="org-it c-${p.meal}"><i class="pip"></i>${esc(r.emoji)} ${esc(r.name)}</span>`; }).join('')}</span></li>`).join('')}</ul>${days.length > 10 ? `<p class="muted">y ${days.length - 10} días más.</p>` : ''}`
        : `<p class="muted">${o.meals.length ? 'Esas comidas ya están planificadas en estas fechas, o no hay recetas que encajen.' : 'Elige al menos una comida.'}</p>`}</div>
    <button class="link danger-link" data-act="orgClear">Quitar todo lo planificado entre estas fechas</button>
    <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="orgApply" ${o.preview.length ? '' : 'disabled'}>${ic('check')}Añadir ${o.preview.length}</button></div>`;
  } else {
    body = `<ol class="howto"><li>Ajusta las opciones y copia el prompt: ya va con formato, tu perfil y tus ${S.recipes.length} recetas.</li><li>Pégalo en tu IA (ChatGPT, Claude, Gemini…).</li><li>Pega aquí su respuesta y pulsa «Importar calendario».</li></ol>
    <span class="lbl">Fechas</span>${dates}
    <div class="opt-box">
      <label class="check"><input type="checkbox" data-chg="orgOpt" data-k="nutri" ${o.nutri ? 'checked' : ''}> <span><b>Priorizar mi nutrición</b><span class="muted">Energía, proteína, hierro, calcio, vitaminas y fibra que necesito cada día.</span></span></label>
      ${o.nutri ? profileFields(true) : ''}
      <label class="check"><input type="checkbox" data-chg="orgOpt" data-k="allowNew" ${o.allowNew ? 'checked' : ''}> <span><b>Permitir recetas nuevas</b><span class="muted">Si las tuyas no bastan, la IA puede proponer otras; se añadirán a tu recetario.</span></span></label>
    </div>
    <label for="og-extra">Algo más que quieras pedir</label><input id="og-extra" value="${esc(o.extra)}" placeholder="Ej. como fuera los sábados, presupuesto ajustado, me gusta lo picante" data-chg="orgExtra">
    <div class="row" style="margin-top:12px"><button class="btn primary" data-act="orgCopyPrompt">${ic('copy')}Copiar prompt</button><button class="btn ghost" data-act="orgTogglePrompt" aria-expanded="${o.showPrompt}">${o.showPrompt ? 'Ocultar prompt' : 'Ver prompt'}</button></div>
    ${o.showPrompt ? `<pre class="prompt big">${esc(planPrompt(o))}</pre>` : ''}
    <label for="og-text">Respuesta de la IA (JSON)</label><textarea id="og-text" placeholder='{"plan": [{"date": "${o.from}", "recipe": "…", "meal": "cena"}]}' style="min-height:150px"></textarea>
    <label class="btn ghost sm file">${ic('up')}Elegir archivo .json<input id="og-file" type="file" accept="application/json,.json,.txt" hidden></label>
    <p id="og-msg" class="err" role="alert"></p>
    <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="orgImport">${ic('check')}Importar calendario</button></div>`;
  }
  openDlg(`${dlgHead('Completar días', 'Organizar')}
  <div class="seg" role="group"><button class="${o.mode === 'auto' ? 'on' : ''}" data-act="orgMode" data-mode="auto" aria-pressed="${o.mode === 'auto'}">${ic('book')}Con mi recetario</button><button class="${o.mode === 'import' ? 'on' : ''}" data-act="orgMode" data-mode="import" aria-pressed="${o.mode === 'import'}">${ic('spark')}Con IA</button></div>
  ${body}`);
}
const readOrgExtra = () => { if (ui.org && $('#og-extra')) ui.org.extra = $('#og-extra').value; };
function renderOrgKeep() {
  const txt = $('#og-text') ? $('#og-text').value : '', top = dlg.scrollTop;
  renderOrg();
  if ($('#og-text')) $('#og-text').value = txt;
  dlg.scrollTop = top;
}
const snapshotPlan = label => { ui.undo = { plan: JSON.stringify(S.plan), label }; };

/* ───────── Nueva lista de compras ───────── */
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
  openDlg(`${dlgHead('Nueva lista', 'Compras')}
  <label for="nl-name">Nombre</label><input id="nl-name" value="${esc(n.name)}">
  <span class="lbl">Empezar con</span>
  <div class="seg" role="group"><button class="${n.mode === 'plan' ? 'on' : ''}" data-act="nlMode" data-mode="plan" aria-pressed="${n.mode === 'plan'}">${ic('cal')}Ingredientes del plan</button><button class="${n.mode === 'empty' ? 'on' : ''}" data-act="nlMode" data-mode="empty" aria-pressed="${n.mode === 'empty'}">${ic('list')}Lista vacía</button></div>
  ${n.mode === 'plan' ? `<div class="chips scroll-x">${presets.map(([k, t]) => `<button class="chip${n.preset === k ? ' on' : ''}" data-act="nlPreset" data-p="${k}" aria-pressed="${n.preset === k}">${t}</button>`).join('')}</div>
  <div class="grid2"><div><label for="nl-from">Desde</label><input id="nl-from" type="date" value="${n.from}" data-chg="nlRange"></div><div><label for="nl-to">Hasta</label><input id="nl-to" type="date" value="${n.to}" data-chg="nlRange"></div></div>
  <p class="preview">${dishes ? `Incluirá <b>${items} ingredientes</b> de ${dishes} ${dishes === 1 ? 'platillo planificado' : 'platillos planificados'}, ya sumados y ajustados a las porciones.` : 'No hay platillos planificados en esas fechas: la lista empezará vacía, pero podrás actualizarla cuando planifiques.'}</p>` : '<p class="preview">Una lista en blanco para lo que necesites: limpieza, despensa, una fiesta…</p>'}
  <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="nlCreate">${ic('check')}Crear lista</button></div>`);
}
const readNl = () => { if (ui.nl && $('#nl-name')) ui.nl.name = $('#nl-name').value; };
