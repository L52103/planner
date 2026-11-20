/* Vistas (rediseño): Hoy, Semana, Mes, Recetario, Receta, Editor, Compras, Cocinar y Más. */
'use strict';

/* ───────── piezas comunes ───────── */
const gearBtn = () => `<button class="btn icon ghost m-only" data-act="nav" data-view="more" aria-label="Más opciones">${ic('gear')}</button>`;
function appBar(title, sub, actions = '', opts = {}) {
  return `<header class="appbar${opts.cls ? ' ' + opts.cls : ''}">
    ${opts.back ? `<button class="btn icon ghost ab-back" data-act="nav" data-view="${opts.back}" aria-label="Volver">${ic('left')}</button>` : ''}
    <div class="ab-t">${sub ? `<p class="ab-sub">${sub}</p>` : ''}<h1>${title}</h1></div>
    <div class="ab-a">${actions}${syncBadge()}${opts.noGear ? '' : gearBtn()}</div></header>`;
}
const scaled = (i, f) => `${i.qty ? `<b>${fmtQty(i.qty * f)}${i.unit ? ' ' + esc(i.unit) : ''}</b> ` : ''}${esc(i.name)}`;
const metaSpans = arr => `<span class="meta-row">${arr.filter(Boolean).map(x => `<span>${x}</span>`).join('')}</span>`;
const recipeMeta = r => metaSpans([totalMin(r) ? fmtMin(totalMin(r)) : '', DIFF[r.difficulty], hasNutr(r) ? `${fmtNum(r.nutrition.kcal)} kcal` : '']);

/* Línea de tiempo de un día: comidas en orden, con marca de "ahora" si es hoy */
const nowLine = () => `<div class="now" aria-hidden="true"><span>${nowHM()}</span><i></i></div>`;
function tiCard(date, it) {
  const r = getRecipe(it.recipeId);
  if (!r) return `<div class="ti"><time>${esc(it.time)}</time><div class="ti-card missing"><span>Esta receta ya no existe</span><button class="btn ghost sm danger" data-act="removeDish" data-date="${date}" data-id="${it.id}">Quitar</button></div></div>`;
  const sv = it.servings || r.servings;
  return `<div class="ti c-${it.meal}${it.done ? ' done' : ''}">
    <time>${esc(it.time)}</time>
    <div class="ti-card">
      <button class="ti-open" data-act="itemSheet" data-date="${date}" data-id="${it.id}" aria-label="Opciones de ${esc(r.name)}"></button>
      ${plate(r, 'sm')}
      <div class="ti-txt"><b>${esc(r.name)}</b>${metaSpans([it.lo ? '<span class="lo-tag">Sobras</span>' : '', `${sv} porc.`, !it.lo && totalMin(r) ? fmtMin(totalMin(r)) : '', hasNutr(r) ? `${fmtNum(r.nutrition.kcal)} kcal` : ''])}</div>
      <button class="ti-check" data-act="toggleDoneBtn" data-date="${date}" data-id="${it.id}" aria-pressed="${it.done}" aria-label="${it.done ? 'Marcar como pendiente' : 'Marcar como hecho'}">${ic('check')}</button>
      <button class="ti-cook" data-act="cookItem" data-date="${date}" data-id="${it.id}" aria-label="Cocinar ${esc(r.name)}">${ic('play', 'fill')}</button>
    </div></div>`;
}
function dayTimeline(date) {
  const items = dayItems(date), isToday = date === todayStr(), now = nowHM();
  let out = '', nowDone = !isToday;
  for (const m of MEALS) {
    const list = items.filter(i => i.meal === m);
    if (!list.length) {
      if (!nowDone && CATS[m].time > now) { out += nowLine(); nowDone = true; }
      out += `<div class="ti c-${m} ti-empty"><time>${CATS[m].time}</time><button class="ti-add" data-act="pick" data-date="${date}" data-meal="${m}">${ic('plus')}<span>${CATS[m].name}: elegir del recetario</span></button></div>`;
      continue;
    }
    for (const it of list) {
      if (!nowDone && it.time > now) { out += nowLine(); nowDone = true; }
      out += tiCard(date, it);
    }
  }
  if (!nowDone) out += nowLine();
  return `<div class="timeline">${out}</div>`;
}

/* Resumen nutricional del día frente a las metas del perfil */
function rings(vals) {
  const R = [33, 23, 13];
  return `<svg viewBox="0 0 76 76" aria-hidden="true">${vals.map((v, i) => `<circle cx="38" cy="38" r="${R[i]}" class="rg-trk"/><circle cx="38" cy="38" r="${R[i]}" class="rg-${i}" pathLength="100" stroke-dasharray="${Math.max(0.1, Math.min(100, v))} 100"/>`).join('')}</svg>`;
}
function nutriCard(date) {
  const items = (S.plan[date] || []).filter(i => getRecipe(i.recipeId)), g = dailyGoals();
  if (!items.length) {
    return `<section class="nutri none">${ic('leaf')}<div><b>Tu meta para este día</b><p>${fmtNum(g.kcal)} kcal, ${g.protein} g de proteína, ${g.iron} mg de hierro y ${fmtNum(g.calcium)} mg de calcio. Añade platillos y verás cuánto cubren.</p></div></section>`;
  }
  const { tot, withData, without } = dayNutrition(date), tip = S.dayTips[date];
  const aiBtn = `<button class="btn sm" data-act="nutriAi" data-date="${date}">${ic('spark')}${without ? 'Estimar con IA' : 'Revisar con IA'}</button>`;
  const tipHtml = tip ? `<p class="ntip">${ic('spark')}<span>${esc(tip)}</span></p>` : '';
  if (!withData) {
    return `<section class="nutri none">${ic('leaf')}<div><b>Sin datos nutricionales</b><p>Pide a la IA un estimado de los ${items.length === 1 ? 'platillo' : `${items.length} platillos`} de este día y verás cuánto cubren de tu meta.</p>${tipHtml}${aiBtn}</div></section>`;
  }
  const pct = k => Math.round((tot[k] / g[k]) * 100);
  const bar = (k, label, unit, cls) => `<div class="nbar"><span>${label}</span><i><b class="${cls}" style="width:${Math.min(100, pct(k))}%"></b></i><span>${fmtNum(tot[k], k === 'iron' ? 1 : 0)}/${fmtNum(g[k])} ${unit}</span></div>`;
  const dishes = items.slice().sort((x, y) => x.time.localeCompare(y.time)).map(it => {
    const r = getRecipe(it.recipeId), n = r.nutrition;
    return `<li><i class="pip c-${it.meal}"></i><span>${esc(r.name)}</span><b>${hasNutr(r) ? `${fmtNum(n.kcal)} kcal${n.protein ? `, ${fmtNum(n.protein)} g prot.` : ''}` : '<em>sin datos</em>'}</b></li>`;
  }).join('');
  return `<section class="nutri">
    <div class="rings">${rings([pct('kcal'), pct('protein'), pct('iron')])}</div>
    <div class="nutri-b"><h3>Lo planificado cubre</h3>
      ${bar('kcal', 'Energía', 'kcal', 'rg-0')}${bar('protein', 'Proteína', 'g', 'rg-1')}${bar('iron', 'Hierro', 'mg', 'rg-2')}
      <details class="nmore"><summary>Fibra, calcio y detalle por platillo</summary>${bar('fiber', 'Fibra', 'g', 'rg-f')}${bar('calcium', 'Calcio', 'mg', 'rg-c')}<ul class="ndish">${dishes}</ul></details>
    </div>
    ${tipHtml ? `<div class="nutri-tip">${tipHtml}</div>` : ''}
    <div class="nutri-f">${without ? `<span class="muted small">${without} ${without === 1 ? 'platillo sin datos' : 'platillos sin datos'}, no cuentan en la suma</span>` : '<span class="muted small">Una porción de cada platillo, valores aproximados</span>'}${aiBtn}</div>
  </section>`;
}

/* ───────── Hoy ───────── */
function nextHero() {
  const t = todayStr();
  let next = null;
  for (let i = 0; i < 14 && !next; i++) {
    const d = ymd(addDays(new Date(), i));
    const it = dayItems(d).find(x => !x.done && getRecipe(x.recipeId) && (i > 0 || x.time >= nowHM()));
    if (it) next = { date: d, it };
  }
  if (!next) {
    return `<section class="hero-next empty">${ic('chef', 'big')}<h2>Nada pendiente por ahora</h2><p>Elige platillos del recetario para los próximos días y aquí verás el siguiente, con la hora para empezar.</p>
      <div class="row"><button class="btn primary" data-act="pick" data-date="${t}" data-meal="${mealFromTime(nowHM())}">${ic('plus')}Planificar hoy</button><button class="btn" data-act="nav" data-view="week">Ver la semana</button></div></section>`;
  }
  const r = getRecipe(next.it.recipeId);
  const at = parseYmd(next.date); const [hh, mm] = next.it.time.split(':').map(Number); at.setHours(hh, mm);
  const diff = Math.round((at - Date.now()) / 60000);
  const big = diff <= 0 ? 'Ahora' : diff < 60 * 24 ? fmtMin(diff) : relDay(next.date);
  const small = diff <= 0 ? CATS[next.it.meal].name.toLowerCase() : diff < 60 * 24 ? `para ${{ desayuno: 'el desayuno', almuerzo: 'el almuerzo', merienda: 'la merienda', cena: 'la cena' }[next.it.meal]}` : `${CATS[next.it.meal].name.toLowerCase()} a las ${next.it.time}`;
  const startBy = totalMin(r) && diff > 0 ? new Date(at - totalMin(r) * 60000) : null;
  return `<section class="hero-next c-${next.it.meal}">
    ${plate(r, 'hero-plate')}
    <p class="hn-when"><b>${esc(big)}</b><span>${esc(small)}</span></p>
    <h2>${esc(r.name)}</h2>
    <p class="hn-sub">${[totalMin(r) ? fmtMin(totalMin(r)) : '', startBy ? `empieza a las ${pad(startBy.getHours())}:${pad(startBy.getMinutes())}` : '', hasNutr(r) ? `${fmtNum(r.nutrition.kcal)} kcal` : ''].filter(Boolean).map(esc).join(', ')}</p>
    <div class="row"><button class="btn ink" data-act="cookItem" data-date="${next.date}" data-id="${next.it.id}">${ic('play', 'fill')}Cocinar</button><button class="btn veil" data-act="openRecipe" data-id="${r.id}">Ver receta</button></div>
  </section>`;
}
function viewToday() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  const t = todayStr(), items = dayItems(t), done = items.filter(i => i.done).length;
  const pending = S.lists.reduce((a, l) => a + l.items.filter(i => !i.checked).length, 0);
  return `${appBar(greet, esc(longDate(t)), `<button class="btn icon ghost" data-act="timerSheet" aria-label="Temporizadores">${ic('timer')}</button>`)}
  <div id="upd-banner-host">${updateBanner()}</div>
  ${remBanner()}
  <div class="today-grid">
    <div class="tg-main">${nextHero()}${nutriCard(t)}${leftoversCard()}</div>
    <section class="tg-day"><div class="sec-h"><h2>Tu día</h2><span class="muted">${items.length ? `${done} de ${items.length} hechos` : ''}</span></div>${dayTimeline(t)}
      ${pending ? `<button class="shortcut" data-act="nav" data-view="shop">${ic('cart')}<span><b>${pending} ${pending === 1 ? 'cosa' : 'cosas'} por comprar</b><span>En tus listas de compras</span></span>${ic('right')}</button>` : ''}</section>
  </div>`;
}

/* ───────── Semana (tabla de menú) y Mes ───────── */
const weekDays = ws => Array.from({ length: 7 }, (_, i) => ymd(addDays(parseYmd(ws), i)));
function weekTitle(days) {
  const a = parseYmd(days[0]), b = parseYmd(days[6]);
  return a.getMonth() === b.getMonth() ? `${a.getDate()} al ${fmtShortDate(days[6])}` : `${fmtShortDate(days[0])} al ${fmtShortDate(days[6])}`;
}
function planTools(mode) {
  return `<div class="plan-tools">
    <div class="seg small" role="group" aria-label="Vista"><button class="${mode === 'week' ? 'on' : ''}" data-act="nav" data-view="week" aria-pressed="${mode === 'week'}">Semana</button><button class="${mode === 'month' ? 'on' : ''}" data-act="nav" data-view="month" aria-pressed="${mode === 'month'}">Mes</button></div>
    <div class="pt-nav"><button class="btn icon" data-act="${mode}Shift" data-n="-1" aria-label="Anterior">${ic('left')}</button><button class="btn" data-act="${mode}Today">Hoy</button><button class="btn icon" data-act="${mode}Shift" data-n="1" aria-label="Siguiente">${ic('right')}</button></div>
    ${ui.undo ? `<button class="btn ghost" data-act="undoPlan">Deshacer ${esc(ui.undo.label)}</button>` : ''}
    <button class="btn primary" data-act="orgDlg">${ic('spark')}Completar</button></div>`;
}
function wgDish(d, it) {
  const r = getRecipe(it.recipeId);
  if (!r) return '';
  return `<button class="wg-dish${it.done ? ' done' : ''}${ui.moving && ui.moving.id === it.id ? ' moving' : ''}" data-act="itemSheet" data-date="${d}" data-id="${it.id}" data-long="moveDish" draggable="true" title="${esc(r.name)}">${plate(r, 'sm')}<span>${esc(r.name)}</span></button>`;
}
function wgCell(d, m) {
  const list = dayItems(d).filter(i => i.meal === m);
  const sel = d === ui.day ? ' selcol' : '';
  if (ui.moving) return `<button class="wg-cell drop${sel}" data-act="dropCell" data-date="${d}" data-meal="${m}" aria-label="Mover a ${CATS[m].name.toLowerCase()}, ${esc(longDate(d))}">${list.map(it => { const r = getRecipe(it.recipeId); return r ? `<span class="wg-dish ghosted">${plate(r, 'sm')}<span>${esc(r.name)}</span></span>` : ''; }).join('')}<span class="drop-hint">${ic('plus')}</span></button>`;
  return `<div class="wg-cell${list.length ? '' : ' empty'}${sel}" data-drop-date="${d}" data-drop-meal="${m}">${list.map(it => wgDish(d, it)).join('')}<button class="wg-add" data-act="pick" data-date="${d}" data-meal="${m}" aria-label="Añadir a ${CATS[m].name.toLowerCase()}, ${esc(longDate(d))}">${ic('plus')}</button></div>`;
}
function dayPanel(date) {
  const items = dayItems(date);
  return `<section class="day-panel">
    <div class="dp-h"><div><p class="ab-sub">${esc(longDate(date))}</p><h2>${esc(relDay(date))}</h2></div>
      ${items.length ? `<button class="btn sm" data-act="shopDay" data-date="${date}">${ic('cart')}Compras del día</button>` : ''}</div>
    ${nutriCard(date)}
    ${dayTimeline(date)}
  </section>`;
}
function viewWeek() {
  const days = weekDays(ui.weekStart), t = todayStr();
  if (!days.includes(ui.day)) ui.day = days.includes(t) ? t : days[0];
  const moving = ui.moving && getRecipe(findItem(ui.moving.date, ui.moving.id)?.recipeId);
  return `${appBar(weekTitle(days), 'Semana', `<button class="btn ghost" data-act="weekSummary" aria-label="Resumen nutricional de la semana">${ic('leaf')}<span class="d-inline">Resumen</span></button>`)}
  ${planTools('week')}
  ${moving ? `<div class="move-banner" role="status">${ic('move')}<span>Moviendo <b>${esc(moving.name)}</b>. Toca la casilla de destino.</span><button class="btn sm" data-act="cancelMove">Cancelar</button></div>` : ''}
  <div class="week-layout">
    <div class="wgrid-wrap"><div class="wgrid${ui.moving ? ' moving' : ''}">
      <div class="wg-corner"></div>
      ${days.map(d => { const k = dayNutrition(d).tot.kcal; return `<button class="wg-day${d === t ? ' today' : ''}${d === ui.day ? ' sel' : ''}" data-act="selectDay" data-date="${d}" aria-pressed="${d === ui.day}"><small>${esc(shortDay(d))}</small><b>${parseYmd(d).getDate()}</b><span>${k ? `${fmtNum(k)} kcal` : ''}</span></button>`; }).join('')}
      ${MEALS.map(m => `<div class="wg-meal c-${m}"><i></i><span>${CATS[m].name}</span></div>${days.map(d => wgCell(d, m)).join('')}`).join('')}
    </div></div>
    ${dayPanel(ui.day)}
  </div>
  <p class="hint">${ic('move')}Mantén pulsado un platillo (o arrástralo en PC) para moverlo a otra casilla.</p>`;
}
function viewMonth() {
  const m = ui.month, y = m.getFullYear(), mo = m.getMonth();
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate(), t = todayStr();
  let cells = '', total = 0;
  for (let i = 0; i < offset; i++) cells += '<div class="blank"></div>';
  for (let d = 1; d <= days; d++) {
    const date = `${y}-${pad(mo + 1)}-${pad(d)}`, items = dayItems(date);
    total += items.length;
    const names = items.slice(0, 3).map(i => { const r = getRecipe(i.recipeId); return r ? `<span class="nm c-${i.meal}">${esc(r.emoji)} ${esc(r.name)}</span>` : ''; }).join('');
    cells += `<button class="mday${date === t ? ' today' : ''}${date === ui.day ? ' sel' : ''}${date < t ? ' past' : ''}" data-act="selectDay" data-date="${date}" aria-label="${esc(longDate(date))}: ${items.length} platillos" aria-pressed="${date === ui.day}">
      <span class="n">${d}</span><span class="pips">${items.slice(0, 5).map(i => `<i class="pip c-${i.meal}"></i>`).join('')}</span>${names}${items.length > 3 ? `<span class="nm more">y ${items.length - 3} más</span>` : ''}</button>`;
  }
  return `${appBar(esc(monthName(m)), total ? `${total} ${total === 1 ? 'platillo planificado' : 'platillos planificados'}` : 'Mes sin planificar', `<button class="btn ghost" data-act="weekSummary" aria-label="Resumen nutricional de la semana">${ic('leaf')}<span class="d-inline">Resumen de la semana</span></button>`)}
  ${planTools('month')}
  <div class="week-layout">
    <div><div class="mcal">${['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(x => `<div class="dow">${x}</div>`).join('')}${cells}</div>
      <div class="legend">${MEALS.map(x => `<span><i class="pip c-${x}"></i>${CATS[x].name}</span>`).join('')}</div></div>
    ${dayPanel(ui.day)}
  </div>`;
}

/* ───────── Recetario ───────── */
function filteredRecipes() {
  const q = fold(ui.q);
  const list = S.recipes.filter(r => {
    if (ui.cat === 'fav' && !r.fav) return false;
    if (ui.cat !== 'all' && ui.cat !== 'fav' && r.category !== ui.cat) return false;
    return !q || fold(r.name + ' ' + r.tags.join(' ') + ' ' + r.ingredients.map(i => i.name).join(' ') + ' ' + r.description).includes(q);
  });
  const sorters = { name: (a, b) => a.name.localeCompare(b.name, 'es'), time: (a, b) => totalMin(a) - totalMin(b), new: (a, b) => (b.createdAt || 0) - (a.createdAt || 0), kcal: (a, b) => (a.nutrition?.kcal ?? 1e9) - (b.nutrition?.kcal ?? 1e9) };
  return list.sort(sorters[ui.sort] || sorters.name);
}
function catChips(active, act, cls = '') {
  const all = [['all', 'Todas'], ['fav', 'Favoritas'], ...Object.entries(CATS).map(([k, v]) => [k, v.name])];
  return `<div class="chips ${cls}" role="group" aria-label="Filtrar por categoría">${all.map(([k, n]) => `<button class="chip${k === active ? ' on' : ''}${CATS[k] ? ' c-' + k : ''}" data-act="${act}" data-cat="${k}" aria-pressed="${k === active}">${k === 'fav' ? ic('star', 'fill') : CATS[k] ? '<i class="pip"></i>' : ''}${n}</button>`).join('')}</div>`;
}
function tile(r) {
  const ed = ui.bookEdit, sel = ui.sel.has(r.id), hl = highlightNutr(r);
  return `<article class="tile c-${r.category}${sel ? ' sel' : ''}">
    <button class="tile-open" data-act="${ed ? 'selToggle' : 'openRecipe'}" data-id="${r.id}" data-long="selectRecipe" aria-label="${ed ? (sel ? 'Quitar de la selección: ' : 'Seleccionar: ') : 'Abrir '}${esc(r.name)}" ${ed ? `aria-pressed="${sel}"` : ''}></button>
    ${hasNutr(r) ? `<span class="kc">${fmtNum(r.nutrition.kcal)} kcal</span>` : ''}
    ${ed ? `<span class="selbox" aria-hidden="true">${sel ? ic('check') : ''}</span>` : `<button class="tile-fav${r.fav ? ' on' : ''}" data-act="toggleFav" data-id="${r.id}" aria-label="${r.fav ? 'Quitar de favoritas' : 'Marcar como favorita'}" aria-pressed="${r.fav}">${ic('star', r.fav ? 'fill' : '')}</button>`}
    ${plate(r, 'tile-plate')}
    <b class="tile-name">${esc(r.name)}</b>
    ${metaSpans([(st => st.avg ? `★ ${fmtNum(st.avg, 1)}` : '')(recipeStats(r.id)), totalMin(r) ? fmtMin(totalMin(r)) : '', DIFF[r.difficulty], hl])}
    ${ed ? '' : `<button class="tile-plan" data-act="planDlg" data-recipe="${r.id}" aria-label="Añadir ${esc(r.name)} a un día">${ic('calPlus')}</button>`}
  </article>`;
}
function bookGrid() {
  const list = filteredRecipes();
  if (!list.length) {
    if (!S.recipes.length) return `<div class="empty">${ic('book', 'big')}<h3>Tu recetario está vacío</h3><p>Crea tu primera receta, pide varias a una IA o empieza con 12 recetas de ejemplo que puedes editar.</p>
      <div class="row center"><button class="btn primary" data-act="newRecipe">${ic('plus')}Crear receta</button><button class="btn" data-act="loadSamples">Cargar recetas de ejemplo</button><button class="btn" data-act="importDlg">${ic('spark')}Importar con IA</button></div></div>`;
    return `<div class="empty"><h3>Nada coincide</h3><p>Prueba con otra palabra o quita el filtro.</p><button class="btn" data-act="clearFilters">Quitar filtros</button></div>`;
  }
  const n = ui.sel.size, dis = n ? '' : 'disabled';
  const bar = ui.bookEdit ? `<div class="bulk" role="toolbar" aria-label="Acciones sobre la selección">
      <span class="bulk-n">${n ? `${n} ${n === 1 ? 'seleccionada' : 'seleccionadas'}` : 'Toca las recetas para seleccionarlas'}</span>
      <button class="btn sm" data-act="selAll">${list.every(r => ui.sel.has(r.id)) ? 'Quitar selección' : 'Todas'}</button>
      <select data-chg="bulkCat" aria-label="Cambiar categoría" ${dis}><option value="">Categoría</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>
      <button class="btn sm" data-act="bulkFav" ${dis}>${ic('star')}Favoritas</button>
      <button class="btn sm danger" data-act="bulkDel" ${dis}>${ic('trash')}Eliminar</button></div>` : '';
  return bar + `<div class="tiles${ui.bookEdit ? ' editing' : ''}">${list.map(tile).join('')}</div>`;
}
function viewBook() {
  return `${appBar('Recetario', `${S.recipes.length} ${S.recipes.length === 1 ? 'receta' : 'recetas'}`, `
    <button class="btn icon ghost" data-act="importMenu" aria-label="Importar recetas: enlace, foto o IA">${ic('down')}</button>
    <button class="btn${ui.bookEdit ? ' primary' : ' ghost'}" data-act="bookEdit" aria-pressed="${ui.bookEdit}">${ui.bookEdit ? ic('check') + 'Terminar' : 'Organizar'}</button>
    ${ui.bookEdit ? '' : `<button class="btn primary d-only" data-act="newRecipe">${ic('plus')}Nueva receta</button>`}`)}
  <label class="search-name" for="q">Buscar recetas</label>
  <div class="toolbar"><label class="search">${ic('search')}<input id="q" type="search" placeholder="Nombre, ingrediente o etiqueta" value="${esc(ui.q)}" aria-label="Buscar recetas"></label>
    <select id="sort" data-chg="sort" aria-label="Ordenar">${[['name', 'Nombre'], ['time', 'Más rápidas'], ['kcal', 'Menos calorías'], ['new', 'Recientes']].map(([k, v]) => `<option value="${k}" ${ui.sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  ${catChips(ui.cat, 'bookCat', 'scroll-x')}
  <div id="bookGrid">${bookGrid()}</div>`;
}

/* ───────── Receta ───────── */
function nutrTable(r, f = 1) {
  if (!hasNutr(r)) return `<div class="empty small">${ic('leaf', 'big')}<p>Esta receta aún no tiene datos nutricionales.</p>
    <div class="row center"><button class="btn" data-act="editRecipe" data-id="${r.id}">${ic('edit')}Añadir datos</button></div>
    <p class="muted small">Si la pides a la IA, el prompt ya incluye calorías, proteína, hierro y calcio por porción.</p></div>`;
  const g = dailyGoals(), p = profile();
  return `<ul class="ntable">${NUTR.map(([k, label, unit]) => {
    const v = r.nutrition[k];
    if (v === undefined) return '';
    const pc = g[k] ? Math.round((v / g[k]) * 100) : null;
    return `<li><span>${label}</span><b>${fmtNum(v, unit === 'g' || k === 'iron' ? 1 : 0)} ${unit}</b>${pc !== null ? `<i class="pbar"><b style="width:${Math.min(100, pc)}%"></b></i><span class="pc">${pc}%</span>` : '<i></i><span></span>'}</li>`;
  }).join('')}</ul>
  <p class="muted small">Por porción. El porcentaje es de tu meta diaria (${p.sex}, ${esc(p.age)} años, actividad ${esc(p.activity)}). Valores aproximados.</p>`;
}
function viewRecipe() {
  const r = getRecipe(ui.recipeId);
  if (!r) { ui.view = 'book'; return viewBook(); }
  const sv = ui.detailServ || r.servings, f = sv / r.servings, t = todayStr();
  const upcoming = Object.entries(S.plan).flatMap(([d, items]) => items.filter(i => i.recipeId === r.id && d >= t).map(i => ({ d, i }))).sort((a, b) => (a.d + a.i.time).localeCompare(b.d + b.i.time));
  const tab = ui.rtab, hl = highlightNutr(r);
  const facts = [
    totalMin(r) ? [fmtMin(totalMin(r)), 'en total'] : null, [DIFF[r.difficulty], 'dificultad'], [r.servings, 'porciones'],
    hasNutr(r) ? [fmtNum(r.nutrition.kcal), 'kcal/porción'] : null,
    hasNutr(r) && r.nutrition.iron ? [`${fmtNum(r.nutrition.iron, 1)} mg`, 'hierro'] : null,
  ].filter(Boolean);
  return `<div class="rhero c-${r.category}">
    <div class="rh-nav"><button class="rh-btn" data-act="nav" data-view="book" aria-label="Volver al recetario">${ic('left')}</button>
      <div class="row nowrap"><button class="rh-btn${r.fav ? ' on' : ''}" data-act="toggleFav" data-id="${r.id}" aria-label="Favorita" aria-pressed="${r.fav}">${ic('star', r.fav ? 'fill' : '')}</button><button class="rh-btn" data-act="recipeMenu" data-id="${r.id}" aria-label="Más acciones">${ic('more')}</button></div></div>
    <div class="rh-body">${plate(r, 'hero-plate')}
      <div class="rh-txt"><span class="rh-cat">${CATS[r.category].name}${hl ? `, ${hl.toLowerCase()}` : ''}</span><h1>${esc(r.name)}</h1>
      ${r.description ? `<p class="rh-desc">${esc(r.description)}</p>` : ''}
      <div class="facts">${facts.map(([a, b]) => `<div><b>${esc(a)}</b><span>${b}</span></div>`).join('')}</div></div></div>
  </div>
  <div class="rtabs" role="tablist">${[['ing', 'Ingredientes'], ['steps', 'Pasos'], ['nutr', 'Nutrición']].map(([k, v]) => `<button role="tab" class="${tab === k ? 'on' : ''}" data-act="rtab" data-k="${k}" aria-selected="${tab === k}">${v}</button>`).join('')}</div>
  <div class="rpanels">
    <section class="rpanel${tab === 'ing' ? ' on' : ''}"><div class="sec-h"><h2>Ingredientes</h2><span class="stepper"><button class="btn icon sm" data-act="detailServ" data-n="-1" aria-label="Menos porciones">${ic('minus')}</button><b>${sv} porc.</b><button class="btn icon sm" data-act="detailServ" data-n="1" aria-label="Más porciones">${ic('plus')}</button></span></div>
      <ul class="ings">${r.ingredients.map(i => `<li><span>${esc(i.name)}</span><b>${i.qty ? `${fmtQty(i.qty * f)}${i.unit ? ' ' + esc(i.unit) : ''}` : '<span class="muted">al gusto</span>'}</b></li>`).join('') || '<li class="muted">Sin ingredientes</li>'}</ul>
      ${r.tags.length ? `<div class="tags">${r.tags.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}</section>
    <section class="rpanel${tab === 'steps' ? ' on' : ''}"><div class="sec-h"><h2>Pasos</h2><span class="muted">${r.steps.length} pasos</span></div>
      <ol class="steps">${r.steps.map(s => `<li><p>${esc(s.text)}</p>${s.timer ? `<span class="timer-badge">${ic('timer')}${fmtMin(s.timer)}</span>` : ''}</li>`).join('') || '<li class="muted">Sin pasos todavía. Edita la receta para añadirlos.</li>'}</ol>
      ${r.notes ? `<div class="notes"><h3>Notas</h3><p>${esc(r.notes)}</p></div>` : ''}</section>
    <section class="rpanel${tab === 'nutr' ? ' on' : ''}"><div class="sec-h"><h2>Nutrición</h2></div>${nutrTable(r)}</section>
  </div>
  <section class="upcoming-s"><h2>En tu plan</h2>
    ${upcoming.length ? `<ul class="upcoming">${upcoming.slice(0, 8).map(({ d, i }) => `<li><button class="link" data-act="openDay" data-date="${d}"><i class="pip c-${i.meal}"></i>${esc(relDay(d))}, ${CATS[i.meal].name.toLowerCase()} a las ${esc(i.time)}</button></li>`).join('')}</ul>` : '<p class="muted">No está en ningún día próximo.</p>'}</section>
  ${historySection(r)}
  <div class="actbar"><button class="btn lg" data-act="planDlg" data-recipe="${r.id}">${ic('calPlus')}Añadir a un día</button><button class="btn primary lg" data-act="cookRecipe" data-id="${r.id}">${ic('play', 'fill')}Cocinar</button></div>`;
}

/* ───────── Editor ───────── */
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
  const d = ui.draft, rows = editorRows(), nu = d.nutrition || {};
  return `<header class="appbar sticky">
    <button class="btn icon ghost ab-back" data-act="cancelEdit" aria-label="Cancelar">${ic('x')}</button>
    <div class="ab-t">${ui.pendingPlan ? `<p class="ab-sub">Se añadirá a ${esc(relDay(ui.pendingPlan.date).toLowerCase())}, ${CATS[ui.pendingPlan.meal].name.toLowerCase()}</p>` : ''}<h1>${d.id ? 'Editar receta' : 'Nueva receta'}</h1></div>
    <div class="ab-a"><button class="btn primary" data-act="saveRecipe">${ic('check')}Guardar</button></div></header>
  <div class="editor">
  ${ui.draftRestored ? `<div class="draft-note" role="status">${ic('edit')}<span>Recuperamos los cambios que no habías guardado.</span><button class="btn sm ghost" data-act="discardDraft">Descartar cambios</button></div>` : ''}
  <section class="panel">
    <div class="ed-top">
      <div class="emoji-pick"><button class="plate xl c-${d.category}" data-act="toggleEmoji" aria-label="Cambiar icono" aria-expanded="${!!ui.emojiOpen}">${esc(d.emoji)}</button>
      ${ui.emojiOpen ? `<div class="emoji-grid">${EMOJIS.map(e => `<button data-act="setEmoji" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div>` : ''}</div>
      <div class="grow"><label for="e-name">Nombre</label><input id="e-name" value="${esc(d.name)}" placeholder="Ej. Lentejas con verduras" autocomplete="off" aria-describedby="e-name-err" data-blur="reqName">
      <p id="e-name-err" class="field-err" role="alert"></p>
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
  <section class="panel"><div class="sec-h"><h2>Ingredientes</h2><span class="muted">Misma unidad siempre, para que la lista de compras sume bien.</span></div>
    <div id="ings">${rows.ings}</div><button class="btn" data-act="addIng">${ic('plus')}Añadir ingrediente</button></section>
  <section class="panel"><div class="sec-h"><h2>Pasos</h2><span class="muted">Con minutos, el paso tendrá su temporizador al cocinar.</span></div>
    <div id="steps">${rows.steps}</div><button class="btn" data-act="addStep">${ic('plus')}Añadir paso</button></section>
  <section class="panel"><div class="sec-h"><h2>Nutrición por porción</h2><span class="muted">Opcional. Alimenta el resumen de tu día.</span></div>
    <div class="nutr-grid">${NUTR.map(([k, l, u]) => `<label>${l} <span class="muted">(${u})</span><input id="n-${k}" inputmode="decimal" value="${nu[k] ?? ''}" placeholder="—"></label>`).join('')}</div></section>
  <section class="panel"><label for="e-notes"><h2>Notas</h2></label><textarea id="e-notes" placeholder="Variaciones, trucos, dónde la encontraste">${esc(d.notes)}</textarea></section>
  <div class="row end">${d.id ? `<button class="btn ghost danger push-left" data-act="delRecipe" data-id="${d.id}">${ic('trash')}Eliminar receta</button>` : ''}<button class="btn" data-act="cancelEdit">Cancelar</button><button class="btn primary" data-act="saveRecipe">${ic('check')}Guardar receta</button></div>
  </div>
  <datalist id="units">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist>`;
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
  d.nutrition = cleanNutrition(Object.fromEntries(NUTR.map(([k]) => [k, $('#n-' + k).value])));
}
function refreshEditorRows() { const rows = editorRows(); $('#ings').innerHTML = rows.ings; $('#steps').innerHTML = rows.steps; }

/* ───────── Compras ───────── */
function viewShop() {
  const lists = S.lists;
  if (ui.shopTab === 'pantry') return `${appBar('Compras', 'Despensa')}${shopTabs()}${viewPantry()}`;
  if (!lists.length) {
    return `${appBar('Compras', 'Listas de compras')}${shopTabs()}
    <div class="empty">${ic('cart', 'big')}<h3>Aún no tienes listas</h3><p>Lo más rápido: una lista con los ingredientes de lo que planificaste esta semana, ya sumados. Luego la editas a tu gusto.</p>
      <div class="row center"><button class="btn primary" data-act="quickWeekList">${ic('cal')}Lista de esta semana</button><button class="btn" data-act="newList">${ic('plus')}Otra lista</button></div></div>`;
  }
  return `${appBar('Compras', `${lists.length} ${lists.length === 1 ? 'lista' : 'listas'}`, `<button class="btn primary" data-act="newList">${ic('plus')}Nueva lista</button>`)}
  ${shopTabs()}${budgetCard()}
  <div class="lists-grid">${lists.map(l => {
    const { total, got } = listStats(l), done = total && got === total;
    return `<article class="lcard${done ? ' done' : ''}">
      <button class="tile-open" data-act="openList" data-id="${l.id}" aria-label="Abrir ${esc(l.name)}"></button>
      <div class="lc-top"><div><h3>${esc(l.name)}${l.share ? ' <span class="live-chip">En vivo</span>' : ''}</h3><p class="muted">${l.from ? `Del plan, ${esc(fmtRange(l.from, l.to))}` : 'Lista libre'}${listCost(l) ? `, ${money(listCost(l))}` : ''}</p></div><span class="lc-count"><b>${got}</b>/${total}</span></div>
      <div class="pbar"><b style="width:${total ? (got / total) * 100 : 0}%"></b></div>
      <p class="lprev">${esc(l.items.filter(i => !i.checked).slice(0, 6).map(i => i.name).join(', ')) || (done ? 'Todo comprado' : 'Sin artículos')}</p>
      <div class="row lc-a"><button class="btn sm ghost" data-act="listDup" data-id="${l.id}">${ic('copy')}Duplicar</button><button class="btn sm ghost danger" data-act="listDelete" data-id="${l.id}">${ic('trash')}Eliminar</button></div>
    </article>`;
  }).join('')}</div>`;
}
const aisleSelect = (id, val, withAuto) => `<select id="${id}" aria-label="Pasillo">${withAuto ? '<option value="auto">Pasillo automático</option>' : ''}${AISLE_NAMES.map(a => `<option ${a === val ? 'selected' : ''}>${a}</option>`).join('')}</select>`;
function itemRow(i) {
  if (ui.editItem === i.id) {
    return `<li class="it-edit"><div class="ie-grid">
      <label class="ie-name">Artículo<input id="ie-name" value="${esc(i.name)}"></label>
      <label>Cantidad<input id="ie-qty" inputmode="decimal" value="${i.qty || ''}" placeholder="0"></label>
      <label>Unidad<input id="ie-unit" value="${esc(i.unit)}" list="units"></label>
      <label>Precio${i.est ? ' (estimado)' : ''}<input id="ie-price" inputmode="decimal" value="${i.price || ''}" placeholder="${esc(S.prefs.currency || '$')}"></label>
      <label class="ie-aisle">Pasillo${aisleSelect('ie-aisle', i.aisle)}</label></div>
      <div class="row"><button class="btn primary sm" data-act="itemSave" data-id="${i.id}">${ic('check')}Guardar</button><button class="btn sm" data-act="itemCancel">Cancelar</button><button class="btn ghost danger sm" data-act="itemDel" data-id="${i.id}">${ic('trash')}Eliminar</button></div></li>`;
  }
  const src = [i.recipes && i.recipes.length ? i.recipes.join(', ') : i.src === 'plan' ? '' : 'Añadido a mano', i.have ? `ya tienes ${i.have}` : ''].filter(Boolean).join('; ');
  return `<li class="it${i.checked ? ' chk' : ''}" data-swipe="${i.id}">
    <label class="it-l"><input type="checkbox" class="sr" ${i.checked ? 'checked' : ''} data-chg="itemCheck" data-id="${i.id}"><span class="cb">${ic('check')}</span>
      <span class="it-t">${esc(i.name)}${src ? `<small>${esc(src)}${i.edited ? ', editado' : ''}</small>` : ''}</span></label>
    <span class="it-q">${i.qty > 0 ? `${fmtQty(i.qty)}${i.unit ? ' ' + esc(i.unit) : ''}` : ''}${i.price ? `<small>${i.est ? '≈ ' : ''}${money(i.price)}</small>` : ''}</span>
    <button class="btn icon ghost sm" data-act="itemEdit" data-id="${i.id}" aria-label="Editar ${esc(i.name)}">${ic('edit')}</button></li>`;
}
function viewList() {
  const l = getList(ui.listId);
  if (!l) { ui.view = 'shop'; return viewShop(); }
  const { total, got } = listStats(l);
  const present = AISLE_NAMES.filter(a => l.items.some(i => i.aisle === a && !i.checked));
  if (ui.aisle !== 'all' && !present.includes(ui.aisle)) ui.aisle = 'all';
  const pending = l.items.filter(i => !i.checked && (ui.aisle === 'all' || i.aisle === ui.aisle)), cart = l.items.filter(i => i.checked);
  const groups = {};
  for (const i of pending) (groups[i.aisle] = groups[i.aisle] || []).push(i);
  return `${appBar(`<button class="title-btn" data-act="listRename" data-id="${l.id}" aria-label="Renombrar lista">${esc(l.name)}${ic('edit')}</button>`, `${l.share ? '<span class="live-chip">En vivo</span> ' : ''}${l.from ? `Del plan, ${esc(fmtRange(l.from, l.to))}` : 'Lista libre'}`,
    `${l.from ? `<button class="btn icon ghost" data-act="listSync" data-id="${l.id}" aria-label="Actualizar desde el plan" title="Actualizar desde el plan">${ic('spark')}</button>` : ''}<button class="btn icon ghost" data-act="listShare" data-id="${l.id}" aria-label="Compartir lista">${ic('share')}</button>`, { back: 'shop', noGear: true })}
  <div class="lh-prog"><div class="pbar big"><b style="width:${total ? (got / total) * 100 : 0}%"></b></div><span><b>${got}</b>/${total}</span></div>
  ${listMoney(l)}
  ${present.length > 1 ? `<div class="chips scroll-x">${['all', ...present].map(a => `<button class="chip${ui.aisle === a ? ' on' : ''}" data-act="aisleFilter" data-a="${esc(a)}" aria-pressed="${ui.aisle === a}">${a === 'all' ? 'Todo' : AISLE_SHORT[a]}</button>`).join('')}</div>` : ''}
  <form class="add-item" data-form="item">
    <label class="ai-name">Artículo<input id="ni-name" placeholder="Ej. papel de cocina" autocomplete="off"></label>
    <label>Cantidad<input id="ni-qty" inputmode="decimal" placeholder="0"></label>
    <label>Unidad<input id="ni-unit" list="units" placeholder="pieza"></label>
    <label class="ai-aisle">Pasillo${aisleSelect('ni-aisle', '', true)}</label>
    <button class="btn primary">${ic('plus')}<span>Añadir artículo</span></button>
  </form>
  ${AISLE_NAMES.filter(a => groups[a]).map(a => `<section class="aisle"><h3>${a}<span>${groups[a].length}</span></h3><ul class="items">${groups[a].map(itemRow).join('')}</ul></section>`).join('')
    || (total ? `<div class="empty small">${ic('check', 'big')}<h3>${got === total ? 'Todo en el carrito' : 'Nada en este pasillo'}</h3></div>` : `<div class="empty small"><p>La lista está vacía. Añade artículos arriba${l.from ? ' o actualízala desde el plan' : ''}.</p></div>`)}
  ${cart.length ? `<section class="aisle cart"><h3>En el carrito<span>${cart.length}</span></h3><ul class="items">${cart.map(itemRow).join('')}</ul></section>` : ''}
  <p class="hint">Desliza un artículo hacia la derecha para marcarlo como comprado.</p>
  <div class="row list-tools"><button class="btn sm" data-act="listToPantry" data-id="${l.id}">${ic('leaf')}Guardar lo comprado en la despensa</button><button class="btn sm" data-act="listUncheck" data-id="${l.id}">Desmarcar todo</button><button class="btn sm" data-act="listClearChecked" data-id="${l.id}">Quitar lo comprado</button>
    <button class="btn sm" data-act="listDup" data-id="${l.id}">${ic('copy')}Duplicar</button><button class="btn ghost danger sm" data-act="listDelete" data-id="${l.id}">${ic('trash')}Eliminar lista</button></div>
  <datalist id="units">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist>`;
}

/* ───────── Cocinar (pantalla completa, oscura) ───────── */
function detectMin(text) {
  const m = String(text).match(/(\d+(?:[.,]\d+)?)\s*(?:a\s*\d+\s*)?(minutos?|min|horas?|h)\b/i);
  if (!m) return 0;
  const v = num(m[1], 0);
  return /^h/i.test(m[2]) ? v * 60 : v;
}
// Ingredientes que el texto del paso menciona (por raíz de palabra)
function stepIngredients(r, text) {
  const t = ' ' + fold(text) + ' ';
  return r.ingredients.filter(i => fold(i.name).split(/\s+/).filter(w => w.length >= 4).some(w => t.includes(w.slice(0, Math.max(4, w.length - 2)))));
}
const cookLabel = (r, step) => `${r.name}, paso ${step + 1}`;
function cookLists(r, c, f) {
  return {
    ing: `<ul class="checklist">${r.ingredients.map((i, k) => `<li class="${c.got[k] ? 'chk' : ''}"><label><input type="checkbox" ${c.got[k] ? 'checked' : ''} data-chg="cookGot" data-k="${k}"><span>${scaled(i, f)}</span></label></li>`).join('')}</ul>`,
    steps: `<ol class="steplist">${r.steps.map((s, k) => `<li class="${k < c.step ? 'past' : k === c.step ? 'now' : ''}"><button data-act="cookGo" data-n="${k}"><span class="stepn">${k < c.step ? ic('check') : k + 1}</span><span>${esc(s.text)}</span></button></li>`).join('')}</ol>`,
  };
}
function viewCook() {
  const c = ui.cook, r = getRecipe(c.recipeId);
  if (!r) { ui.cook = null; ui.view = 'today'; return viewToday(); }
  const f = c.servings / r.servings, n = r.steps.length, step = r.steps[c.step], lists = cookLists(r, c, f);
  const top = `<header class="ck-top"><button class="ck-btn" data-act="cookExit" aria-label="Salir de cocinar">${ic('x')}</button>
    <div class="ck-title"><small>Cocinando</small><b>${esc(r.name)}</b></div>
    <span class="stepper dark"><button class="ck-btn sm" data-act="cookServ" data-n="-1" aria-label="Menos porciones">${ic('minus')}</button><b>${c.servings} porc.</b><button class="ck-btn sm" data-act="cookServ" data-n="1" aria-label="Más porciones">${ic('plus')}</button></span></header>
  ${n ? `<div class="ck-prog">${r.steps.map((s, k) => `<button class="${k < c.step ? 'd' : k === c.step ? 'n' : ''}" data-act="cookGo" data-n="${k}" aria-label="Ir al paso ${k + 1}"></button>`).join('')}</div>` : ''}
  ${n ? cookOptions() : ''}`;
  let main;
  if (!n) main = `<div class="ck-step"><p class="steptext">Esta receta no tiene pasos.</p><button class="btn" data-act="editRecipe" data-id="${r.id}">Añadir pasos</button></div>`;
  else if (c.step >= n) main = `<div class="ck-step finish">${plate(r, 'hero-plate')}<p class="steptext">Listo, a la mesa.</p><p class="ck-muted">Terminaste ${esc(r.name)}.</p></div>`;
  else {
    const label = cookLabel(r, c.step), sugg = !step.timer ? detectMin(step.text) : 0, mins = step.timer || sugg;
    const ings = stepIngredients(r, step.text);
    main = `<div class="ck-step" data-swipe-step="1">
      <div class="ck-tap" data-act="cookTap"><small class="ck-n">Paso ${c.step + 1} de ${n}</small>
      <p class="steptext">${esc(step.text)}</p>
      ${ings.length ? `<div class="ck-ing">${ings.map(i => `<span>${scaled(i, f)}</span>`).join('')}</div>` : ''}
      <p class="ck-taphint">Toca el texto para avanzar; a la izquierda, para volver.</p></div>
      <div class="ring-host ck-ring" data-only="${esc(label)}" data-onchange="cook"></div>
      <div class="ck-start">
        ${mins ? `<button class="ck-timer-btn" data-act="startTimer" data-min="${mins}" data-label="${esc(label)}">${ic('timer')}<span><b>${fmtClock(mins * 60)}</b>${step.timer ? 'Iniciar temporizador del paso' : 'El paso menciona este tiempo: iniciar'}</span></button>` : ''}
        <div class="ck-custom"><input id="ct-min" inputmode="decimal" placeholder="Otro tiempo (min)" aria-label="Minutos del temporizador"><button class="ck-btn wide" data-act="customTimer" data-label="${esc(label)}">${ic('timer')}Iniciar</button></div>
      </div>
      <div class="ring-host ck-others" data-except="${esc(label)}"></div>
    </div>`;
  }
  const nav = !n ? '' : c.step >= n
    ? `<nav class="ck-nav"><button class="ck-nb" data-act="cookPrev">Atrás</button><button class="ck-nb p" data-act="cookFinish">${ic('check')}Marcar hecho y salir</button></nav>`
    : `<nav class="ck-nav"><button class="ck-nb" data-act="cookPrev" ${c.step === 0 ? 'disabled' : ''}>Atrás</button><button class="ck-nb p" data-act="cookNext">${c.step === n - 1 ? 'Terminar' : 'Siguiente paso'}</button></nav>`;
  return `<div class="cook">${top}
    <div class="ck-grid"><div class="ck-main">${main}
      <div class="ck-tools m-only"><button class="ck-btn wide" data-act="cookSheet" data-k="ing">${ic('list')}Ingredientes</button><button class="ck-btn wide" data-act="cookSheet" data-k="steps">${ic('book')}Pasos</button></div></div>
      <aside class="ck-side d-only"><section><h2>Ingredientes</h2>${lists.ing}</section><section><h2>Pasos</h2>${lists.steps}</section></aside></div>
    ${nav}</div>`;
}
function updateCookTimerZone(has) { const z = $('.ck-start'); if (z) z.hidden = has; }

/* ───────── Más ───────── */
function profileFields(open = true) {
  const p = profile();
  return `<details class="profile" ${open ? 'open' : ''}><summary>Tu perfil: ${p.sex === 'mujer' ? 'mujer' : 'hombre'}, ${esc(p.age)} años, actividad ${esc(p.activity)}</summary>
    <div class="grid3">
      <div><label for="pf-sex">Sexo</label><select id="pf-sex" data-chg="profField" data-k="sex"><option value="mujer" ${p.sex === 'mujer' ? 'selected' : ''}>Mujer</option><option value="hombre" ${p.sex === 'hombre' ? 'selected' : ''}>Hombre</option></select></div>
      <div><label for="pf-age">Edad</label><input id="pf-age" type="number" min="14" max="99" value="${esc(p.age)}" data-chg="profField" data-k="age"></div>
      <div><label for="pf-weight">Peso (kg)</label><input id="pf-weight" inputmode="decimal" placeholder="Opcional" value="${esc(p.weight)}" data-chg="profField" data-k="weight"></div>
    </div>
    <div class="grid2">
      <div><label for="pf-act">Actividad física</label><select id="pf-act" data-chg="profField" data-k="activity">${Object.entries(ACT_SHORT).map(([k, v]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label for="pf-goal">Objetivo</label><select id="pf-goal" data-chg="profField" data-k="goal">${Object.entries(GOAL_SHORT).map(([k, v]) => `<option value="${k}" ${p.goal === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>
    <div class="grid2">
      <div><label for="pf-rest">Restricciones o alergias</label><input id="pf-rest" placeholder="Ej. sin lactosa, no como cerdo" value="${esc(p.restrictions)}" data-chg="profField" data-k="restrictions"></div>
      <div><label for="pf-serv">Porciones por comida</label><input id="pf-serv" type="number" min="1" value="${esc(p.servings)}" data-chg="profField" data-k="servings"></div>
    </div>
    <ul class="targets">${nutriTargets(p).slice(0, 7).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="muted small">Valores orientativos de referencia; no sustituyen la consulta con un nutricionista.</p>
  </details>`;
}
function cloudPanel() {
  const u = Cloud.user;
  if (!Cloud.available()) return `<section class="panel span2" id="cloud-panel" data-user=""><h2>${ic('cloud')}Nube</h2><p class="muted">No se pudo cargar el módulo de la nube. Tus datos siguen guardados en este dispositivo.</p></section>`;
  if (!u) return `<section class="panel span2 cloud" id="cloud-panel" data-user="">
    <h2>${ic('cloud')}Tu base de datos en la nube</h2>
    <p class="muted">Guarda tus recetas, el plan, las listas y tu perfil en tu base de datos, y úsalos igual en el teléfono y en el PC. Sin cuenta, todo sigue funcionando solo en este dispositivo.</p>
    <form class="cloud-form" data-form="cloud">
      <div class="grid2"><div><label for="cl-email">Correo</label><input id="cl-email" type="email" autocomplete="email" required></div>
      <div><label for="cl-pass">Contraseña</label><input id="cl-pass" type="password" autocomplete="current-password" minlength="6" required></div></div>
      <p id="cl-msg" class="err" role="alert"></p>
      <div class="row"><button class="btn primary" name="mode" value="in">${ic('cloud')}Entrar</button><button class="btn" name="mode" value="up">Crear cuenta</button></div>
    </form>
    <p class="muted small">Al crear la cuenta te llega un correo de confirmación: ábrelo y luego pulsa «Entrar». Lo que ya tienes en este dispositivo se sube a tu cuenta.</p></section>`;
  return `<section class="panel span2 cloud" id="cloud-panel" data-user="${esc(u.id)}"><h2>${ic('cloud')}Nube conectada</h2>
    <p>Conectado como <b>${esc(u.email || '')}</b>.</p>
    <p id="cloud-status" class="cloud-status" data-state="${esc(Cloud.status)}">${esc(Cloud.statusText())}</p>
    <p class="muted small">Recetas, plan, listas y perfil se guardan en tu base de datos y se sincronizan solos cada vez que cambias algo. Sin internet sigues usando la app y se sincroniza al volver la conexión.</p>
    <div class="row"><button class="btn primary" data-act="cloudSync">${ic('cloud')}Sincronizar ahora</button><button class="btn ghost" data-act="cloudOut">Cerrar sesión</button></div></section>`;
}
function viewMore() {
  const g = dailyGoals();
  return `${appBar('Más', 'Perfil, IA y datos', '', { noGear: true })}
  <div id="upd-banner-host">${updateBanner()}</div>
  <div class="more-grid">
    ${cloudPanel()}
    <section class="panel span2"><h2>${ic('user')}Perfil nutricional</h2><p class="muted">Define tus metas diarias: ${fmtNum(g.kcal)} kcal, ${g.protein} g de proteína, ${g.iron} mg de hierro y ${g.calcium} mg de calcio. Se usan en el resumen de cada día y en el prompt para la IA.</p>${profileFields(false)}</section>
    <section class="panel"><h2>${ic('spark')}Recetas con IA</h2><p>Copia el prompt, pégalo en tu IA (ChatGPT, Claude, Gemini…) y describe lo que quieres. Luego pega aquí su respuesta.</p>
      <div class="row"><button class="btn primary" data-act="importDlg">Importar respuesta</button><button class="btn" data-act="copyPrompt">${ic('copy')}Copiar prompt</button></div></section>
    <section class="panel"><h2>${ic('leaf')}Nutrición con IA</h2><p>Pide a tu IA un estimado de calorías y nutrientes de las recetas que aún no los tienen (${S.recipes.filter(r => !hasNutr(r)).length} ahora).</p><button class="btn" data-act="nutriAi" data-date="${todayStr()}" data-scope="book">${ic('spark')}Estimar recetario</button></section>
    <section class="panel"><h2>${ic('cal')}Organizar el mes</h2><p>Llena tus días con el recetario o con un prompt nutricional para tu IA.</p><button class="btn" data-act="orgDlg">${ic('spark')}Abrir</button></section>
    <section class="panel"><h2>${ic('down')}Respaldo</h2><p>Todo se guarda en este dispositivo. Exporta un respaldo para guardarlo o pasarlo a tu otro dispositivo.</p>
      <div class="row"><button class="btn primary" data-act="exportAll">${ic('down')}Exportar</button><button class="btn" data-act="pickBackup">${ic('up')}Importar</button><button class="btn ghost" data-act="exportRecipes">Solo recetas</button></div>
      <input id="backupFile" type="file" accept="application/json,.json" hidden></section>
    <section class="panel"><h2>${ic('bell')}Avisos del temporizador</h2><p>${IS_NATIVE ? 'La app usa alarmas de Android: suenan aunque la cierres. Revisa que tenga permiso de notificaciones.' : 'Permite notificaciones para que el temporizador avise aunque cambies de pestaña.'}</p>
      <button class="btn" data-act="askNotif">Activar notificaciones</button></section>
    ${remPanel()}
    <section class="panel"><h2>${ic('user')}Bienvenida</h2><p>Vuelve a ver los tres pasos iniciales: perfil, metas y cómo empezar.</p><button class="btn" data-act="onboard">Ver la bienvenida</button></section>
    <section class="panel"><h2>${ic('book')}Recetas de ejemplo</h2><p>12 recetas variadas con datos nutricionales. No duplica las que ya tengas.</p><button class="btn" data-act="loadSamples">Cargar ejemplos</button></section>
    <section class="panel"><h2>${ic('down')}Actualizaciones</h2><p>Versión instalada: <b>${esc(APP_VERSION.name)}</b>${IS_NATIVE ? ' (Android)' : ''}.</p>
      <p id="upd-status" class="muted">${esc(Updates.statusText())}</p>
      <div class="row"><button class="btn" data-act="updCheck">Buscar actualizaciones</button>${Updates.available() ? `<button class="btn primary" data-act="updInstall">${ic('down')}Actualizar a ${esc(Updates.latest.versionName)}</button>` : ''}</div></section>
    <section class="panel"><h2>${ic('trash')}Borrar datos</h2><p>Elimina recetas, plan y listas de este dispositivo${Cloud.user ? ' y de tu cuenta en la nube' : ''}.</p><button class="btn danger" data-act="wipe">Borrar todo</button></section>
  </div>
  <p class="muted center small">${S.recipes.length} recetas, ${planCount()} platillos planificados, ${S.lists.length} listas.</p>`;
}

/* ───────── render ───────── */
const VIEWS = { today: viewToday, week: viewWeek, month: viewMonth, book: viewBook, recipe: viewRecipe, editor: viewEditor, shop: viewShop, list: viewList, cook: viewCook, more: viewMore };
const NAV_OF = { today: 'today', week: 'week', month: 'week', book: 'book', recipe: 'book', editor: 'book', shop: 'shop', list: 'shop', more: 'more', cook: '' };
function render() {
  document.body.dataset.view = ui.view;
  $('#view').innerHTML = VIEWS[ui.view]();
  $$('#nav [data-view]').forEach(b => { const on = b.dataset.view === NAV_OF[ui.view]; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  renderTimers();
  Updates.refresh();
  Voice.afterRender();
  if (ui.view === 'week') {
    const wrap = $('.wgrid-wrap'), sel = $('.wg-day.sel');
    if (wrap && sel && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = Math.max(0, sel.offsetLeft - 76);
  }
}
function go(view) { closeDlg(); ui.view = view; ui.moving = null; render(); window.scrollTo(0, 0); }
