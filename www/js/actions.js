/* Acciones, cambios de formularios, gestos (pulsación larga, deslizar, arrastrar) e inicio. */
'use strict';

/* ───────── ayudas ───────── */
async function copyText(text, okMsg) {
  if (IS_NATIVE && NP.Clipboard) { try { await NP.Clipboard.write({ string: text }); toast(okMsg); return true; } catch {} }
  try { await navigator.clipboard.writeText(text); toast(okMsg); return true; }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove(); toast(ok ? okMsg : 'No se pudo copiar'); return ok;
  }
}
async function shareText(title, text) {
  if (IS_NATIVE && NP.Share) { try { await NP.Share.share({ title, text, dialogTitle: title }); return true; } catch { return false; } }
  if (navigator.share) { try { await navigator.share({ title, text }); return true; } catch (e) { if (e.name === 'AbortError') return true; } }
  return false;
}
function download(name, text) {
  if (IS_NATIVE && NP.Filesystem && NP.Share) { Native.saveFile(name, text).catch(() => toast('No se pudo exportar el archivo')); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const exportRecipe = r => ({ name: r.name, emoji: r.emoji, category: r.category, difficulty: r.difficulty, description: r.description, servings: r.servings, prepMinutes: r.prepMinutes, cookMinutes: r.cookMinutes, tags: r.tags, ingredients: r.ingredients.map(i => ({ name: i.name, quantity: i.qty, unit: i.unit })), steps: r.steps.map(s => ({ text: s.text, timerMinutes: s.timer })), nutrition: r.nutrition || undefined, notes: r.notes });
function addToPlan(date, recipeId, meal, time, servings) {
  const r = getRecipe(recipeId);
  (S.plan[date] = S.plan[date] || []).push({ id: uid(), recipeId, meal, time: validTime(time) ? time : CATS[meal].time, servings: servings || r.servings, done: false });
}
function startCook(recipeId, servings, ref) {
  const r = getRecipe(recipeId);
  if (!r) return;
  ui.cook = { recipeId, servings: servings || r.servings, step: 0, got: {}, ref, from: ui.view };
  requestWake(); go('cook');
}
async function moveItem(from, id, to, meal) {
  if (!validDate(to)) return toast('Elige un día válido');
  const it = findItem(from, id);
  if (!it) return closeDlg();
  if (meal && meal !== it.meal) { it.meal = meal; it.time = CATS[meal].time; }
  if (to !== from) {
    S.plan[from] = S.plan[from].filter(i => i.id !== id);
    if (!S.plan[from].length) delete S.plan[from];
    (S.plan[to] = S.plan[to] || []).push(it);
  }
  await save();
  ui.moving = null; ui.day = to;
  closeDlg(); render();
  toast(`Movido a ${relDay(to).toLowerCase()}${meal ? `, ${CATS[meal].name.toLowerCase()}` : ''}`);
}
const refreshSheet = () => { render(); if (ui.sheet && dlg.open) renderItemSheet(); };

/* ───────── acciones (data-act) ───────── */
const A = {
  nav: d => {
    if (d.view === 'month') { const x = parseYmd(ui.day); ui.month = new Date(x.getFullYear(), x.getMonth(), 1); }
    if (d.view === 'week') ui.weekStart = weekStartOf(ui.day);
    if (d.view === 'today') ui.day = todayStr();
    go(d.view);
  },
  weekShift: d => { ui.weekStart = ymd(addDays(parseYmd(ui.weekStart), 7 * Number(d.n))); ui.day = ymd(addDays(parseYmd(ui.day), 7 * Number(d.n))); render(); },
  weekToday: () => { ui.day = todayStr(); ui.weekStart = weekStartOf(ui.day); render(); },
  monthShift: d => { ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + Number(d.n), 1); render(); },
  monthToday: () => { const t = new Date(); ui.month = new Date(t.getFullYear(), t.getMonth(), 1); ui.day = ymd(t); render(); },
  selectDay: d => {
    ui.day = d.date; render();
    if (ui.view === 'month' && innerWidth < 1100) $('.day-panel')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  },
  openDay: d => { ui.day = d.date; ui.weekStart = weekStartOf(d.date); go('week'); },
  closeDlg,

  /* añadir rápido */
  quickAdd,
  qaDish: () => { const h = nowHM(); pickDlg(todayStr(), h > '21:30' ? 'desayuno' : mealFromTime(h)); },
  qaItem: () => quickItemDlg(),
  qiSave: async () => {
    const l = getList($('#qi-list').value), name = $('#qi-name').value.trim();
    if (!name) { toast('Escribe el artículo'); return $('#qi-name').focus(); }
    l.items.push({ id: uid(), name, qty: num($('#qi-qty').value, 0), unit: $('#qi-unit').value.trim(), aisle: aisleOf(name), checked: false, src: 'manual', pkey: '', edited: false, recipes: [] });
    ui.listId = l.id; await save(); closeDlg(); render(); toast(`${name}: añadido a ${l.name}`);
  },

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
    $('#pick-count').textContent = `${p.added.length} ${p.added.length === 1 ? 'añadida' : 'añadidas'}`;
    render();
    toast(`${getRecipe(d.id).name}: añadida a ${CATS[p.meal].name.toLowerCase()}`);
  },
  pickNew: () => { const p = ui.pick; ui.pendingPlan = { date: p.date, meal: p.meal, time: p.time }; A.newRecipe({ cat: p.meal }); },
  loadSamplesPick: async () => { addSamples(); await save(); renderPick(); },

  /* platillo planificado */
  itemSheet: d => itemSheet(d.date, d.id),
  toggleDoneBtn: async d => { const it = findItem(d.date, d.id); if (!it) return; it.done = !it.done; await save(); refreshSheet(); },
  sheetMeal: async d => { const it = findItem(ui.sheet.date, ui.sheet.id); it.meal = d.meal; it.time = CATS[d.meal].time; await save(); refreshSheet(); },
  sheetServ: async d => { const it = findItem(ui.sheet.date, ui.sheet.id), r = getRecipe(it.recipeId); it.servings = Math.max(1, (it.servings || r?.servings || 1) + Number(d.n)); await save(); refreshSheet(); },
  removeDish: async d => {
    S.plan[d.date] = (S.plan[d.date] || []).filter(i => i.id !== d.id);
    if (!S.plan[d.date].length) delete S.plan[d.date];
    await save(); closeDlg(); render(); toast('Quitado del día');
  },
  moveDish: d => moveDlg(d.date, d.id),
  moveTo: d => moveItem(d.from, d.id, d.date),
  moveToInput: d => moveItem(d.from, d.id, $('#mv-date').value),
  startMove: d => {
    ui.moving = { date: d.date, id: d.id }; ui.day = d.date; ui.weekStart = weekStartOf(d.date);
    closeDlg(); ui.view = 'week'; render(); window.scrollTo(0, 0);
  },
  cancelMove: () => { ui.moving = null; render(); },
  dropCell: d => { if (ui.moving) moveItem(ui.moving.date, ui.moving.id, d.date, d.meal); },
  shopDay: d => newListDlg({ name: `Compras de ${relDay(d.date).toLowerCase()}`, from: d.date, to: d.date, preset: '' }),

  /* nutrición con IA */
  nutriAi: d => nutriAiDlg(d.date, d.scope),
  naScope: d => { ui.na.scope = d.s; renderNutriAi(); },
  naToggle: () => { const t = $('#na-text').value; ui.na.show = !ui.na.show; renderNutriAi(); $('#na-text').value = t; },
  naCopy: () => copyText(nutriPrompt(ui.na), 'Prompt copiado. Pégalo en tu IA.'),
  naApply: async () => {
    try {
      const res = applyNutriAI($('#na-text').value, ui.na);
      await save(); closeDlg(); render();
      toast(`${res.updated ? `Datos aplicados a ${res.updated} ${res.updated === 1 ? 'receta' : 'recetas'}` : 'Sugerencia guardada'}${res.unknown.length ? `, ${res.unknown.length} sin coincidencia` : ''}`);
    } catch (e) { $('#na-msg').textContent = e.message; }
  },

  /* organizar días */
  orgDlg,
  orgMode: d => { ui.org.mode = d.mode; if (d.mode === 'auto') orgRefresh(); else renderOrg(); },
  orgPreset: d => { [ui.org.from, ui.org.to] = monthRange(d.p); ui.org.preset = d.p; if (ui.org.mode === 'auto') orgRefresh(); else renderOrgKeep(); },
  orgMeal: d => { const m = ui.org.meals; ui.org.meals = m.includes(d.meal) ? m.filter(x => x !== d.meal) : [...m, d.meal]; orgRefresh(); },
  orgSource: d => { ui.org.source = d.s; orgRefresh(); },
  orgShuffle: () => orgRefresh(),
  orgApply: async () => {
    const pv = ui.org.preview;
    if (!pv.length) return;
    snapshotPlan(`(${pv.length} añadidos)`);
    for (const p of pv) addToPlan(p.date, p.recipeId, p.meal, CATS[p.meal].time);
    await save(); closeDlg(); render();
    toast(`${pv.length} platillos añadidos`);
  },
  orgClear: async () => {
    const { from, to } = ui.org;
    const dates = Object.keys(S.plan).filter(d => d >= from && d <= to);
    const n = dates.reduce((a, d) => a + S.plan[d].length, 0);
    if (!n) return toast('No hay nada planificado en esas fechas');
    if (!confirm(`¿Quitar ${n} platillos planificados entre ${fmtShortDate(from)} y ${fmtShortDate(to)}? Las recetas no se borran.`)) return;
    snapshotPlan(`(${n} quitados)`);
    dates.forEach(d => delete S.plan[d]);
    await save(); orgRefresh(); render(); toast(`${n} platillos quitados`);
  },
  orgCopyPrompt: () => { readOrgExtra(); copyText(planPrompt(ui.org), 'Prompt copiado. Pégalo en tu IA.'); },
  orgTogglePrompt: () => { readOrgExtra(); ui.org.showPrompt = !ui.org.showPrompt; renderOrgKeep(); },
  orgImport: async () => {
    const txt = $('#og-text').value;
    try {
      const before = JSON.stringify(S.plan);
      let data;
      try { data = JSON.parse(extractJSON(txt)); } catch { data = null; }
      const hasRecipes = data && !Array.isArray(data) && Array.isArray(data.recipes) && data.recipes.length;
      if (hasRecipes && !ui.org.allowNew) throw new Error('La respuesta trae recetas nuevas. Activa «Permitir recetas nuevas» o impórtalas desde Recetario.');
      if (!hasRecipes && !(Array.isArray(data) || (data && Array.isArray(data.plan)))) throw new Error('El JSON no trae un "plan". Pide a la IA que responda con el formato del prompt.');
      const recipesBefore = S.recipes;
      const wrapped = Array.isArray(data) ? JSON.stringify({ plan: data }) : txt;
      const res = importAI(wrapped, false);
      if (!res.planned) {
        S.recipes = recipesBefore;
        throw new Error(res.skipped.length ? `Ninguna entrada del plan coincide con tus recetas (${res.skipped.slice(0, 3).join(', ')}…). Revisa que los nombres sean exactos.` : 'El JSON no trae entradas de plan.');
      }
      ui.undo = { plan: before, label: `(${res.planned} importados)` };
      await save(); closeDlg(); render();
      toast(`Calendario importado: ${res.planned} platillos${res.added ? `, ${res.added} recetas nuevas` : ''}${res.tips ? `, ${res.tips} sugerencias del día` : ''}${res.skipped.length ? `, ${res.skipped.length} omitidos` : ''}`);
    } catch (e) { $('#og-msg').textContent = e.message; }
  },
  undoPlan: async () => { if (!ui.undo) return; S.plan = JSON.parse(ui.undo.plan); ui.undo = null; await save(); render(); toast('Cambio deshecho'); },

  /* recetario */
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
  bookCat: d => { ui.cat = d.cat; render(); },
  clearFilters: () => { ui.cat = 'all'; ui.q = ''; render(); },
  openRecipe: d => { ui.recipeId = d.id; ui.detailServ = null; ui.rtab = 'ing'; go('recipe'); },
  rtab: d => { ui.rtab = d.k; render(); },
  recipeMenu: d => recipeMenu(d.id),
  copyRecipe: d => { copyText(JSON.stringify({ schema: 'planner/3', recipes: [exportRecipe(getRecipe(d.id))] }, null, 2), 'Receta copiada como JSON'); closeDlg(); },
  detailServ: d => { const r = getRecipe(ui.recipeId); ui.detailServ = Math.max(1, (ui.detailServ || r.servings) + Number(d.n)); render(); },
  toggleFav: async d => { const r = getRecipe(d.id); r.fav = !r.fav; await save(); if (ui.view === 'book') $('#bookGrid').innerHTML = bookGrid(); else render(); },
  loadSamples: async () => { const n = addSamples(); await save(); render(); toast(n ? `${n} recetas de ejemplo añadidas` : 'Ya tienes todas las recetas de ejemplo'); },

  newRecipe: d => {
    const cat = d && CATS[d.cat] ? d.cat : 'almuerzo';
    if (ui.view !== 'editor') ui.returnTo = ui.view;
    ui.draft = { name: '', emoji: CATS[cat].emoji, category: cat, difficulty: 'facil', description: '', servings: 2, prepMinutes: 0, cookMinutes: 0, tags: [], ingredients: [{ name: '', qty: 0, unit: '' }, { name: '', qty: 0, unit: '' }], steps: [{ text: '', timer: 0 }], nutrition: null, notes: '' };
    ui.emojiOpen = false; go('editor'); $('#e-name')?.focus();
  },
  editRecipe: d => {
    ui.pendingPlan = null; ui.draft = JSON.parse(JSON.stringify(getRecipe(d.id))); ui.returnTo = ui.view === 'cook' ? 'recipe' : ui.view; ui.recipeId = d.id; ui.emojiOpen = false;
    if (ui.cook) { ui.cook = null; releaseWake(); }
    go('editor');
  },
  dupRecipe: async d => { const r = JSON.parse(JSON.stringify(getRecipe(d.id))); r.id = uid(); r.name += ' (copia)'; r.createdAt = Date.now(); S.recipes.push(r); await save(); closeDlg(); if (ui.view === 'recipe') ui.recipeId = r.id; render(); toast('Receta duplicada'); },
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
  copyPrompt: () => copyText(aiPrompt(), 'Prompt copiado. Pégalo en tu IA.'),
  doImport: async () => {
    try {
      const res = importAI($('#imp-text').value, $('#imp-replace').checked);
      await save(); closeDlg(); render();
      const parts = [];
      if (res.added) parts.push(`${res.added} ${res.added === 1 ? 'receta nueva' : 'recetas nuevas'}`);
      if (res.updated) parts.push(`${res.updated} actualizadas`);
      if (res.planned) parts.push(`${res.planned} en el plan`);
      if (res.skipped.length) parts.push(`${res.skipped.length} del plan omitidas`);
      if (res.tips) parts.push(`${res.tips} ${res.tips === 1 ? 'sugerencia' : 'sugerencias'} del día`);
      toast('Importado: ' + (parts.join(', ') || 'nada nuevo'));
    } catch (e) { $('#imp-msg').textContent = e.message; }
  },
  exportAll: () => { download(`planner-respaldo-${todayStr()}.json`, JSON.stringify({ app: 'planner', ...S }, null, 2)); toast('Respaldo exportado'); },
  exportRecipes: () => { download(`recetas-${todayStr()}.json`, JSON.stringify({ schema: 'planner/3', recipes: S.recipes.map(exportRecipe) }, null, 2)); toast('Recetas exportadas'); },
  pickBackup: () => $('#backupFile').click(),
  askNotif: async () => { if (IS_NATIVE) { toast(await Native.askNotifications() ? 'Notificaciones activadas' : 'Activa las notificaciones en los ajustes de Android'); return; } try { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Notificaciones activadas' : 'El navegador no dio permiso'); } catch { toast('Este navegador no admite notificaciones'); } },
  cloudSync: () => Cloud.sync(),
  updCheck: () => Updates.check({ manual: true }),
  updInstall: () => Updates.install(),
  updLater: () => Updates.later(),
  updCopyCmd: () => copyText('git pull', 'Comando copiado'),
  cloudOut: async () => { if (!confirm('¿Cerrar sesión? Tus datos se quedan en este dispositivo y en tu cuenta.')) return; await Cloud.signOut(); render(); toast('Sesión cerrada'); },
  wipe: async () => { if (!confirm(Cloud.user ? '¿Borrar todas las recetas, el plan y las listas de este dispositivo y de tu cuenta en la nube?' : '¿Borrar todas las recetas, el plan y las listas de compras de este dispositivo?')) return; S = emptyState(); await save(); render(); toast('Datos borrados'); },

  /* listas de compras */
  newList: () => newListDlg(),
  quickWeekList: async () => { const [f, t] = shopPresetRange('week'); const l = createList(`Semana del ${fmtShortDate(f)}`, f, t, true); await save(); ui.listId = l.id; ui.editItem = null; go('list'); toast(`Lista creada con ${l.items.length} artículos`); },
  nlMode: d => { readNl(); ui.nl.mode = d.mode; renderNewList(); },
  nlPreset: d => { readNl(); [ui.nl.from, ui.nl.to] = shopPresetRange(d.p); ui.nl.preset = d.p; renderNewList(); },
  nlCreate: async () => { readNl(); const n = ui.nl; const l = createList(n.name, n.from, n.to, n.mode === 'plan'); await save(); ui.listId = l.id; ui.editItem = null; ui.aisle = 'all'; go('list'); toast('Lista creada'); },
  openList: d => { ui.listId = d.id; ui.editItem = null; ui.aisle = 'all'; go('list'); },
  aisleFilter: d => { ui.aisle = d.a; render(); },
  listRename: d => {
    const l = getList(d.id);
    openDlg(`${dlgHead('Renombrar lista')}<label for="rn-name">Nombre</label><input id="rn-name" value="${esc(l.name)}">
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
    if (await shareText(l.name, text)) return;
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
  cookItem: d => { const it = findItem(d.date, d.id); if (it) startCook(it.recipeId, it.servings, { date: d.date, id: d.id }); },
  cookRecipe: d => startCook(d.id, ui.view === 'recipe' ? ui.detailServ : 0),
  cookSheet: d => cookSheet(d.k),
  cookGo: d => { closeDlg(); ui.cook.step = Number(d.n); render(); window.scrollTo(0, 0); },
  cookPrev: () => { ui.cook.step = Math.max(0, ui.cook.step - 1); render(); window.scrollTo(0, 0); },
  cookNext: () => { const r = getRecipe(ui.cook.recipeId); ui.cook.step = Math.min(r.steps.length, ui.cook.step + 1); render(); window.scrollTo(0, 0); },
  cookServ: d => { ui.cook.servings = Math.max(1, ui.cook.servings + Number(d.n)); render(); },
  cookFinish: async () => { const ref = ui.cook.ref; if (ref) { const it = findItem(ref.date, ref.id); if (it) { it.done = true; await save(); } } A.cookExit(); toast('¡Buen provecho!'); },
  cookExit: () => { const from = ui.cook?.from; ui.cook = null; releaseWake(); go(from && from !== 'cook' && from !== 'editor' ? from : 'today'); },
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

/* ───────── cambios en formularios (data-chg) ───────── */
const C = {
  orgRange: () => {
    const f = $('#og-from').value, t = $('#og-to').value;
    if (validDate(f)) ui.org.from = f;
    if (validDate(t)) ui.org.to = t;
    if (ui.org.from > ui.org.to) ui.org.to = ui.org.from;
    ui.org.preset = '';
    if (ui.org.mode === 'auto') orgRefresh(); else renderOrgKeep();
  },
  orgOpt: (d, el) => { readOrgExtra(); ui.org[d.k] = el.checked; renderOrgKeep(); },
  rulesOn: async (d, el) => { readOrgExtra(); S.profile = { ...profile(), rulesOn: el.checked }; await save(); renderOrgKeep(); if (el.checked) $('#og-rules')?.focus(); },
  rulesText: async (d, el) => { S.profile = { ...profile(), rules: el.value }; await save(); if (ui.org?.showPrompt) renderOrgKeep(); },
  orgExtra: (d, el) => { ui.org.extra = el.value; if (ui.org.showPrompt) renderOrgKeep(); },
  profField: async (d, el) => {
    const p = profile();
    let v = el.value;
    if (d.k === 'age') v = Math.min(99, Math.max(14, Math.round(num(v, 22)) || 22));
    if (d.k === 'servings') v = Math.max(1, Math.round(num(v, 1)) || 1);
    if (d.k === 'weight') v = num(v, 0) ? String(num(v, 0)) : '';
    p[d.k] = v; S.profile = p; await save();
    if (ui.org && dlg.open) { readOrgExtra(); renderOrgKeep(); }
    else { const y = scrollY; render(); const det = $('.profile'); if (det) det.open = true; scrollTo(0, y); }
  },
  orgSkip: (d, el) => { ui.org.skipFilled = el.checked; orgRefresh(); },
  orgGap: (d, el) => { ui.org.gap = Number(el.value); orgRefresh(); },
  sheetTime: async (d, el) => { const it = findItem(ui.sheet.date, ui.sheet.id); if (validTime(el.value)) { it.time = el.value; await save(); render(); } },
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
let suppressClick = false;
document.addEventListener('click', e => {
  if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  unlockAudio();
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
}, true);
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
  const cf = e.target.closest('[data-form=cloud]');
  if (cf) {
    e.preventDefault();
    const email = $('#cl-email').value.trim(), pass = $('#cl-pass').value, up = e.submitter && e.submitter.value === 'up', msg = $('#cl-msg');
    msg.textContent = ''; $$('button', cf).forEach(b => { b.disabled = true; });
    try {
      if (up) {
        const pending = await Cloud.signUp(email, pass);
        if (pending) { msg.className = 'ok-msg'; msg.textContent = 'Cuenta creada. Revisa tu correo, confirma la cuenta y luego pulsa «Entrar».'; }
      } else await Cloud.signIn(email, pass);
    } catch (err) { msg.className = 'err'; msg.textContent = err.message; }
    finally { $$('button', cf).forEach(b => { b.disabled = false; }); }
    return;
  }
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
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (typing || e.ctrlKey || e.metaKey || e.altKey || dlg.open) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); quickAdd(); }
  else if (e.key === '/' && ui.view === 'book') { e.preventDefault(); $('#q')?.focus(); }
  else if (e.key === 'Escape' && ui.moving) A.cancelMove();
  else if (ui.view === 'cook' && e.key === 'ArrowRight') A.cookNext();
  else if (ui.view === 'cook' && e.key === 'ArrowLeft') A.cookPrev();
});

/* ───────── gestos ───────── */
// Pulsación larga: mover un platillo en la semana o empezar a seleccionar recetas
let lp = null;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-long]');
  if (!el || e.button > 0) return;
  const x = e.clientX, y = e.clientY;
  lp = { el, x, y, t: setTimeout(() => {
    lp = null; suppressClick = true;
    try { navigator.vibrate && navigator.vibrate(25); } catch {}
    if (el.dataset.long === 'moveDish') A.startMove(el.dataset);
    else if (el.dataset.long === 'selectRecipe') { ui.bookEdit = true; ui.sel = new Set([el.dataset.id]); render(); }
  }, 520) };
});
// El clic que sigue a una pulsación larga se descarta; si no llega (táctil), se libera al soltar
document.addEventListener('pointerup', () => { if (suppressClick) setTimeout(() => { suppressClick = false; }, 60); }, true);
const cancelLp = e => { if (lp && (!e || e.type !== 'pointermove' || Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10)) { clearTimeout(lp.t); lp = null; } };
['pointerup', 'pointercancel', 'pointermove', 'scroll'].forEach(t => document.addEventListener(t, cancelLp, { passive: true, capture: true }));
document.addEventListener('contextmenu', e => { if (e.target.closest('[data-long]')) e.preventDefault(); });

// Deslizar: artículo de compras a la derecha = comprado; paso al cocinar = anterior / siguiente
let sw = null;
document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  const li = e.target.closest('[data-swipe]'), step = e.target.closest('[data-swipe-step]');
  if (li) sw = { kind: 'item', el: li, x: e.clientX, y: e.clientY, dx: 0 };
  else if (step) sw = { kind: 'step', el: step, x: e.clientX, y: e.clientY, dx: 0 };
}, { passive: true });
document.addEventListener('pointermove', e => {
  if (!sw) return;
  sw.dx = e.clientX - sw.x; const dy = e.clientY - sw.y;
  if (Math.abs(dy) > Math.abs(sw.dx) && Math.abs(dy) > 12) { sw.el.style.transform = ''; sw = null; return; }
  if (sw.kind === 'item' && sw.dx > 0) { sw.el.style.transform = `translateX(${Math.min(sw.dx, 140)}px)`; sw.el.classList.toggle('swipe-ok', sw.dx > 90); }
}, { passive: true });
document.addEventListener('pointerup', async () => {
  if (!sw) return;
  const s = sw; sw = null;
  s.el.style.transform = ''; s.el.classList.remove('swipe-ok');
  if (s.kind === 'item' && s.dx > 90) {
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 60);
    const i = getList(ui.listId)?.items.find(x => x.id === s.el.dataset.swipe);
    if (i) { i.checked = !i.checked; await save(); render(); toast(i.checked ? `${i.name}: en el carrito` : `${i.name}: pendiente`); }
  } else if (s.kind === 'step' && Math.abs(s.dx) > 70) {
    if (s.dx < 0) A.cookNext(); else A.cookPrev();
  }
}, { passive: true });
document.addEventListener('pointercancel', () => { if (sw) { sw.el.style.transform = ''; sw = null; } }, { passive: true });

// Arrastrar y soltar en PC (semana)
document.addEventListener('dragstart', e => {
  const el = e.target.closest('.wg-dish[data-id]');
  if (!el) return;
  ui.dragging = { date: el.dataset.date, id: el.dataset.id };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', el.dataset.id);
  el.classList.add('moving');
});
document.addEventListener('dragover', e => {
  const cell = e.target.closest('[data-drop-date]');
  if (!cell || !ui.dragging) return;
  e.preventDefault();
  $$('.wg-cell.over').forEach(c => c !== cell && c.classList.remove('over'));
  cell.classList.add('over');
});
document.addEventListener('drop', e => {
  const cell = e.target.closest('[data-drop-date]');
  if (!cell || !ui.dragging) return;
  e.preventDefault();
  const dr = ui.dragging; ui.dragging = null;
  moveItem(dr.date, dr.id, cell.dataset.dropDate, cell.dataset.dropMeal);
});
document.addEventListener('dragend', () => { ui.dragging = null; $$('.wg-cell.over, .wg-dish.moving').forEach(c => c.classList.remove('over', 'moving')); });

/* pantalla encendida mientras se cocina */
let wake = null;
async function requestWake() { if (IS_NATIVE && NP.KeepAwake) { NP.KeepAwake.keepAwake().catch(() => {}); return; } try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch {} }
function releaseWake() { if (IS_NATIVE && NP.KeepAwake) { NP.KeepAwake.allowSleep().catch(() => {}); return; } try { wake && wake.release(); } catch {} wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (ui.cook) requestWake(); tick(); if (ui.view === 'today') render(); } });

/* ───────── inicio ───────── */
(async function init() {
  const raw = await Store.load();
  S = normalizeState(raw);
  if (!raw) { addSamples(); await save(); }
  render();
  tick();
  setInterval(tick, 250);
  Cloud.init().catch(() => {});
  Updates.init();
  setInterval(() => { if (ui.view === 'today' && !dlg.open && !document.hidden) render(); }, 60000); // refresca la cuenta regresiva
  if (!IS_NATIVE && 'serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (IS_NATIVE) {
    document.documentElement.classList.add('native');
    Native.syncTimers(timers);
    // Botón «atrás» de Android: cierra diálogos y vuelve a la pantalla anterior antes de salir
    NP.App && NP.App.addListener('backButton', () => {
      if (dlg.open) return closeDlg();
      if (ui.moving) return A.cancelMove();
      if (ui.view === 'cook') return A.cookExit();
      if (ui.view === 'editor') return A.cancelEdit();
      const parent = { recipe: 'book', list: 'shop', month: 'week', more: 'today' }[ui.view];
      if (parent) return go(parent);
      if (ui.view !== 'today') return A.nav({ view: 'today' });
      NP.App.minimizeApp ? NP.App.minimizeApp() : NP.App.exitApp();
    });
    // Al tocar la notificación de un temporizador, abrir el panel
    NP.LocalNotifications && NP.LocalNotifications.addListener('localNotificationActionPerformed', () => { tick(); timerSheet(); });
  }
})();
