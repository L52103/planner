/* Versión 2.5: sincronización visible, bienvenida, modo cocina con voz, despensa, sobras, recordatorios,
   importar desde enlace o foto, resumen semanal, presupuesto, historial con valoraciones y listas
   compartidas en tiempo real. Las acciones (XA) y cambios (XC) se suman a A y C en actions.js. */
'use strict';

const XA = {}, XC = {};
const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const peopleCount = () => Math.max(1, Math.round(num(profile().servings, 1)) || 1);

// Tras cada guardado: recordatorios y listas compartidas
let afterT;
function afterSave() { clearTimeout(afterT); afterT = setTimeout(() => { Reminders.sync(); Shared.schedule(); }, 800); }

/* ═════════ Indicador de sincronización (barra superior) ═════════ */
const syncState = () => !Cloud.available() ? 'off' : Cloud.user ? (Cloud.status === 'idle' ? 'ok' : Cloud.status) : 'off';
const syncLabel = () => Cloud.user ? Cloud.statusText().replace(/\.$/, '') : 'Nube sin conectar: los datos solo están aquí. Toca para conectar';
const syncBadge = () => `<button class="btn icon ghost sync-badge" data-act="syncBadge" data-state="${syncState()}" aria-label="${esc(syncLabel())}">${ic('cloud')}<i aria-hidden="true"></i></button>`;
function refreshSyncBadges() { $$('.sync-badge').forEach(b => { b.dataset.state = syncState(); b.setAttribute('aria-label', syncLabel()); }); }
XA.syncBadge = async () => {
  if (!Cloud.user) { go('more'); setTimeout(() => $('#cl-email')?.focus(), 50); return; }
  await Cloud.sync();
  if (Cloud.status === 'ok') toast('Todo sincronizado');
};

/* ═════════ Bienvenida en 3 pasos ═════════ */
const ONB_KEY = 'planner.onboarded';
const needsOnboarding = () => !lsGet(ONB_KEY, false);
const markOnboarded = () => lsSet(ONB_KEY, true);
function onboard() { ui.onb = { step: 1 }; renderOnb(); }
function renderOnb() {
  const s = ui.onb.step, p = profile(), g = dailyGoals(p);
  const dots = `<div class="onb-dots" aria-label="Paso ${s} de 3">${[1, 2, 3].map(n => `<i class="${n <= s ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (s === 1) body = `<h2>Cuéntanos de ti</h2><p class="muted">Con esto calculamos tus metas diarias de energía y nutrientes. Puedes cambiarlo cuando quieras en Más.</p>
    <div class="grid3"><div><label for="ob-sex">Sexo</label><select id="ob-sex"><option value="mujer" ${p.sex === 'mujer' ? 'selected' : ''}>Mujer</option><option value="hombre" ${p.sex === 'hombre' ? 'selected' : ''}>Hombre</option></select></div>
      <div><label for="ob-age">Edad</label><input id="ob-age" type="number" min="14" max="99" value="${esc(p.age)}"></div>
      <div><label for="ob-weight">Peso (kg)</label><input id="ob-weight" inputmode="decimal" placeholder="Opcional" value="${esc(p.weight)}"></div></div>
    <label for="ob-act">Actividad física</label><select id="ob-act">${Object.entries(ACTIVITY).map(([k, v]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  else if (s === 2) body = `<h2>Tus metas</h2><p class="muted">Tu meta ahora: ${fmtNum(g.kcal)} kcal, ${g.protein} g de proteína y ${g.iron} mg de hierro al día.</p>
    <fieldset class="onb-goals"><legend>¿Qué buscas al comer?</legend>${Object.entries(GOALS).map(([k, v]) => `<label class="opt"><input type="radio" name="ob-goal" value="${k}" ${p.goal === k ? 'checked' : ''}><span><b>${GOAL_SHORT[k]}</b><small>${v}</small></span></label>`).join('')}</fieldset>
    <div class="grid2"><div><label for="ob-rest">Restricciones o alergias</label><input id="ob-rest" placeholder="Ej. sin lactosa" value="${esc(p.restrictions)}"></div>
      <div><label for="ob-serv">¿Para cuántas personas cocinas?</label><input id="ob-serv" type="number" min="1" max="20" value="${esc(p.servings)}"></div></div>`;
  else body = `<h2>¿Cómo quieres empezar?</h2><p class="muted">Elige una opción; las demás siguen disponibles después.</p>
    <div class="onb-start">
      ${[['samples', 'book', 'Con recetas de ejemplo', `${S.recipes.length ? 'Ya tienes 12 recetas variadas con nutrición; edítalas o bórralas.' : '12 recetas variadas con datos de nutrición.'}`],
        ['ai', 'spark', 'Pidiendo recetas a mi IA', 'Copia un prompt con tu perfil, pégalo en ChatGPT, Claude o Gemini y trae su respuesta.'],
        ['link', 'down', 'Desde un enlace o una foto', 'Pega el enlace de una web de recetas o usa la foto de un recetario.'],
        ['cloud', 'cloud', 'Entrar a mi cuenta', 'Trae tus recetas, plan y listas desde la nube.'],
        ['empty', 'plus', 'Con el recetario vacío', 'Empiezas de cero y creas tus propias recetas.']]
        .map(([k, icn, t, d]) => `<button class="onb-opt" data-act="onbStart" data-k="${k}">${ic(icn)}<span><b>${t}</b><small>${d}</small></span>${ic('right')}</button>`).join('')}
    </div>`;
  openDlg(`<div class="onb">${dots}<p class="onb-step">Paso ${s} de 3</p>${body}
    <div class="dlg-f">${s > 1 ? '<button class="btn" data-act="onbBack">Atrás</button>' : '<button class="btn ghost" data-act="onbSkip">Saltar</button>'}${s < 3 ? `<button class="btn primary" data-act="onbNext">Siguiente${ic('right')}</button>` : ''}</div></div>`);
  setTimeout(() => (s < 3 ? $('dialog .onb input, dialog .onb select') : $('dialog .onb-opt'))?.focus(), 30);
}
function readOnb() {
  const p = { ...profile() }, v = id => $('#' + id)?.value;
  if (ui.onb.step === 1) Object.assign(p, { sex: v('ob-sex'), age: Math.round(num(v('ob-age'), p.age)) || p.age, weight: v('ob-weight').trim(), activity: v('ob-act') });
  if (ui.onb.step === 2) Object.assign(p, { goal: $('[name=ob-goal]:checked')?.value || p.goal, restrictions: v('ob-rest').trim(), servings: Math.max(1, Math.round(num(v('ob-serv'), 1))) });
  S.profile = p;
}
XA.onboard = () => onboard();
XA.onbNext = async () => { readOnb(); await save(); ui.onb.step++; renderOnb(); };
XA.onbBack = () => { ui.onb.step--; renderOnb(); };
XA.onbSkip = () => { markOnboarded(); ui.onb = null; closeDlg(); };
XA.onbStart = async d => {
  markOnboarded(); ui.onb = null; closeDlg();
  if (d.k === 'samples') { addSamples(); await save(); go('book'); toast('Listo: estas son tus recetas'); }
  else if (d.k === 'ai') { importDlg(); copyText(aiPrompt(), 'Prompt copiado. Pégalo en tu IA.'); }
  else if (d.k === 'link') importMenu();
  else if (d.k === 'cloud') { go('more'); setTimeout(() => $('#cl-email')?.focus(), 50); }
  else if (d.k === 'empty') {
    const names = new Set(SAMPLES.map(x => fold(x.name))), used = new Set(Object.values(S.plan).flat().map(i => i.recipeId));
    S.recipes = S.recipes.filter(r => !names.has(fold(r.name)) || used.has(r.id));
    await save(); go('book');
  }
};
dlg.addEventListener('close', () => { if (ui.onb) { markOnboarded(); ui.onb = null; } });

/* ═════════ Historial, valoraciones y sobras ═════════ */
function recipeStats(id) {
  const h = S.history.filter(x => x.recipeId === id).sort((a, b) => b.at - a.at), rated = h.filter(x => x.rating);
  return { count: h.length, last: h[0] || null, avg: rated.length ? rated.reduce((a, x) => a + x.rating, 0) / rated.length : 0, list: h };
}
const stars = n => `<span class="stars" aria-label="${n} de 5 estrellas">${[1, 2, 3, 4, 5].map(k => ic('star', k <= Math.round(n) ? 'fill' : '')).join('')}</span>`;
// Marca un platillo como hecho / pendiente: historial, despensa y sobras
function onDishDone(date, it, done) {
  const r = getRecipe(it.recipeId);
  if (!r) return {};
  if (!done) {
    for (const h of S.history.filter(x => x.src === it.id)) for (const u of h.used || []) addToPantry(u.name, u.qty, u.unit);
    S.history = S.history.filter(h => h.src !== it.id);
    S.leftovers = S.leftovers.filter(l => l.src !== it.id);
    return { r };
  }
  return logCooked(r, it.servings || r.servings, date, it.id, !!it.lo);
}
function logCooked(r, servings, date, src = '', isLeftover = false) {
  const before = S.pantry.map(p => ({ id: p.id, name: p.name, unit: p.unit, qty: p.qty }));
  if (!isLeftover) useFromPantry(r, servings);
  const used = before.map(b => { const p = S.pantry.find(x => x.id === b.id), diff = b.qty - (p ? p.qty : 0); return diff > 1e-9 ? { name: b.name, unit: b.unit, qty: +diff.toFixed(3) } : null; }).filter(Boolean);
  const h = { id: uid(), recipeId: r.id, date, rating: 0, src, at: Date.now(), ...(used.length ? { used } : {}) };
  S.history.push(h);
  let left = 0;
  if (!isLeftover && servings > peopleCount()) {
    left = servings - peopleCount();
    S.leftovers.push({ id: uid(), recipeId: r.id, portions: left, date, until: ymd(addDays(parseYmd(date), 3)), src });
  }
  return { r, h, left };
}
function doneToast(res) {
  if (!res || !res.h) return;
  const msg = res.left ? `Hecho. Te sobran ${res.left} ${res.left === 1 ? 'porción' : 'porciones'} de ${res.r.name}` : `${res.r.name}: hecho`;
  toast(msg, { label: 'Valorar', run: () => rateDlg(res.h.id) });
}
function rateDlg(hid) {
  const h = S.history.find(x => x.id === hid), r = h && getRecipe(h.recipeId);
  if (!r) return;
  openDlg(`${dlgHead(`¿Qué tal quedó ${esc(r.name)}?`, 'Tu valoración')}
    <p class="muted">Las recetas mejor valoradas y tus favoritas salen antes al completar el plan.</p>
    <div class="rate-row" role="group" aria-label="Valoración">${[1, 2, 3, 4, 5].map(n => `<button class="rate-star${n <= h.rating ? ' on' : ''}" data-act="rateSet" data-h="${h.id}" data-n="${n}" aria-label="${n} ${n === 1 ? 'estrella' : 'estrellas'}">${ic('star', n <= h.rating ? 'fill' : '')}</button>`).join('')}</div>
    <div class="dlg-f"><button class="btn" data-act="closeDlg">Ahora no</button></div>`);
}
XA.rateDlg = d => rateDlg(d.h);
XA.rateSet = async d => {
  const h = S.history.find(x => x.id === d.h); if (!h) return;
  h.rating = Number(d.n); await save(); closeDlg(); render(); toast(`Valoración guardada: ${h.rating} de 5`);
};
// Puntuación para elegir recetas al completar el plan (favoritas y mejor valoradas primero)
function recipeScore(r) {
  const st = recipeStats(r.id);
  return (r.fav ? 1.5 : 0) + (st.avg ? (st.avg - 3) * 0.75 : 0);
}
function historySection(r) {
  const st = recipeStats(r.id);
  if (!st.count) return `<section class="upcoming-s"><h2>Tu historial</h2><p class="muted">Aún no la has cocinado. Al marcarla como hecha podrás valorarla.</p></section>`;
  return `<section class="upcoming-s"><h2>Tu historial</h2>
    <p class="hist-sum">${st.avg ? `${stars(st.avg)}<b>${fmtNum(st.avg, 1)}</b>` : ''}<span>Cocinada ${st.count} ${st.count === 1 ? 'vez' : 'veces'}, la última ${esc(relDay(st.last.date).toLowerCase())}</span></p>
    <ul class="hist">${st.list.slice(0, 5).map(h => `<li><span>${esc(longDate(h.date))}</span><button class="btn sm ghost" data-act="rateDlg" data-h="${h.id}">${h.rating ? stars(h.rating) : 'Valorar'}</button></li>`).join('')}</ul></section>`;
}

/* sobras en la nevera */
function leftoversCard() {
  const t = todayStr(), list = S.leftovers.filter(l => getRecipe(l.recipeId) && l.until >= ymd(addDays(new Date(), -2)));
  if (!list.length) return '';
  return `<section class="panel lo-card"><div class="sec-h"><h2>${ic('leaf')}Sobras en la nevera</h2></div><ul class="lo-list">${list.map(l => {
    const r = getRecipe(l.recipeId), daysLeft = Math.round((parseYmd(l.until) - parseYmd(t)) / 864e5);
    const when = daysLeft < 0 ? '<b class="warn">Revisa si sigue bien antes de comerla</b>' : daysLeft === 0 ? 'Mejor comerla hoy' : `Aguanta ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} más`;
    return `<li>${plate(r, 'sm')}<div><b>${l.portions} ${l.portions === 1 ? 'porción' : 'porciones'} de ${esc(r.name)}</b><span class="muted small">Cocinada ${esc(relDay(l.date).toLowerCase())}. ${when}</span></div>
      <div class="row nowrap"><button class="btn sm" data-act="loPlan" data-id="${l.id}" data-when="today">Hoy</button><button class="btn sm" data-act="loPlan" data-id="${l.id}" data-when="tomorrow">Mañana</button><button class="btn icon sm ghost" data-act="loGone" data-id="${l.id}" aria-label="Ya no quedan sobras de ${esc(r.name)}">${ic('x')}</button></div></li>`;
  }).join('')}</ul></section>`;
}
XA.loPlan = async d => {
  const l = S.leftovers.find(x => x.id === d.id); if (!l) return;
  const now = nowHM(), date = d.when === 'today' ? todayStr() : ymd(addDays(new Date(), 1));
  const meal = d.when === 'today' ? (now < '13:00' ? 'almuerzo' : now < '16:30' ? 'merienda' : 'cena') : 'almuerzo';
  const sv = Math.min(l.portions, peopleCount());
  (S.plan[date] = S.plan[date] || []).push({ id: uid(), recipeId: l.recipeId, meal, time: CATS[meal].time, servings: sv, done: false, lo: true });
  l.portions -= sv;
  if (l.portions <= 0) S.leftovers = S.leftovers.filter(x => x !== l);
  await save(); render(); toast(`Sobras planificadas: ${relDay(date).toLowerCase()}, ${CATS[meal].name.toLowerCase()}`);
};
XA.loGone = async d => { await withUndo('Sobras quitadas', () => { S.leftovers = S.leftovers.filter(x => x.id !== d.id); }); };

/* ═════════ Recordatorios: empezar a cocinar y descongelar ═════════ */
const remPrefs = () => ({ cook: true, defrost: true, defrostAt: '21:00', ...(S.prefs.rem || {}) });
const atOf = (date, hm) => { const d = parseYmd(date); const [h, m] = hm.split(':').map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };
function upcomingReminders(days = 3) {
  const p = remPrefs(), out = [];
  for (let i = 0; i <= days; i++) {
    const d = ymd(addDays(new Date(), i));
    for (const it of dayItems(d)) {
      const r = getRecipe(it.recipeId);
      if (!r || it.done) continue;
      const meal = atOf(d, it.time);
      if (p.cook && !it.lo) {
        const lead = (totalMin(r) || 5) + 10;
        out.push({ key: `c:${it.id}:${d}${it.time}`, kind: 'cook', date: d, at: meal - lead * 60000, until: meal, title: `Hora de cocinar: ${r.name}`, body: `${totalMin(r) ? `Tarda ${fmtMin(totalMin(r))}. ` : ''}${CATS[it.meal].name} a las ${it.time}.` });
      }
      if (p.defrost && !it.lo) {
        const frozen = r.ingredients.filter(x => aisleOf(x.name) === 'Carnes y pescados').map(x => x.name.toLowerCase());
        if (frozen.length) {
          const eve = atOf(ymd(addDays(parseYmd(d), -1)), validTime(p.defrostAt) ? p.defrostAt : '21:00');
          out.push({ key: `d:${it.id}:${d}`, kind: 'defrost', date: d, at: eve, until: meal, title: `Descongela para ${relDay(d).toLowerCase()}`, body: `${r.name}: pasa ${[...new Set(frozen)].join(', ')} del congelador a la nevera.` });
        }
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
const Reminders = {
  fired: () => lsGet('planner.remFired', {}),
  async sync() {
    const LN = NP.LocalNotifications;
    if (!LN) return;
    try {
      await LN.createChannel({ id: 'reminders', name: 'Recordatorios', description: 'Empezar a cocinar y descongelar', importance: 4, visibility: 1 }).catch(() => {});
      const pend = await LN.getPending();
      const mine = pend.notifications.filter(n => n.extra && n.extra.kind === 'rem');
      if (mine.length) await LN.cancel({ notifications: mine.map(n => ({ id: n.id })) });
      const now = Date.now(), due = upcomingReminders().filter(x => x.at > now + 30000).slice(0, 40);
      if (due.length) await LN.schedule({ notifications: due.map(x => ({ id: Native.nid('rem:' + x.key), title: x.title, body: x.body, channelId: 'reminders', smallIcon: 'ic_stat_timer', extra: { kind: 'rem', date: x.date }, schedule: { at: new Date(x.at), allowWhileIdle: true } })) });
    } catch {}
  },
  // En PC / navegador: avisa mientras la app está abierta
  tick() {
    if (IS_NATIVE) return;
    const now = Date.now(), f = this.fired();
    let changed = false;
    for (const x of upcomingReminders(1)) {
      if (f[x.key] || x.at > now || x.at < now - 15 * 60000) continue;
      f[x.key] = now; changed = true;
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification(x.title, { body: x.body, icon: 'icons/icon-192.png', tag: x.key }); } catch {}
      if (!document.hidden) toast(`${x.title}. ${x.body}`);
    }
    if (changed) { for (const k of Object.keys(f)) if (f[k] < now - 3 * 864e5) delete f[k]; lsSet('planner.remFired', f); }
  },
};
function remBanner() {
  const now = Date.now(), act = upcomingReminders(1).filter(x => x.at <= now && x.until > now);
  if (!act.length) return '';
  return `<div class="rem-list" role="status">${act.map(x => `<p class="rem rem-${x.kind}">${ic(x.kind === 'cook' ? 'timer' : 'bell')}<span><b>${esc(x.title)}</b>${esc(x.body)}</span></p>`).join('')}</div>`;
}
function remPanel() {
  const p = remPrefs();
  return `<section class="panel"><h2>${ic('bell')}Recordatorios</h2><p>Avisos ${IS_NATIVE ? 'en el teléfono, aunque la app esté cerrada' : 'mientras la app está abierta (en el teléfono llegan aunque esté cerrada)'}.</p>
    <label class="check"><input type="checkbox" data-chg="remPref" data-k="cook" ${p.cook ? 'checked' : ''}> <span><b>Empezar a cocinar</b><span class="muted">Según lo que tarda la receta y la hora de la comida.</span></span></label>
    <label class="check"><input type="checkbox" data-chg="remPref" data-k="defrost" ${p.defrost ? 'checked' : ''}> <span><b>Descongelar la noche anterior</b><span class="muted">Si la receta lleva carne o pescado.</span></span></label>
    <label for="rem-at">Hora del aviso para descongelar</label><input id="rem-at" type="time" value="${esc(p.defrostAt)}" data-chg="remPref" data-k="defrostAt" style="max-width:160px"></section>`;
}
XC.remPref = async (d, el) => {
  S.prefs.rem = { ...remPrefs(), [d.k]: el.type === 'checkbox' ? el.checked : el.value };
  await save();
  if (el.checked && IS_NATIVE) Native.askNotifications();
  if (el.checked && !IS_NATIVE && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  toast('Recordatorios actualizados');
};

/* ═════════ Importar desde enlace o foto ═════════ */
const FRAC = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125 };
const UNIT_ALIASES = [
  ['kg', /^(kg|kilos?|kilogramos?)$/], ['g', /^(g|gr|grs|gramos?|grams?)$/], ['ml', /^(ml|mililitros?)$/], ['l', /^(l|lt|litros?|liters?|litres?)$/],
  ['taza', /^(tazas?|cups?|c)$/], ['cda', /^(cdas?|cucharadas?|tbsp|tablespoons?)$/], ['cdita', /^(cditas?|cucharaditas?|tsp|teaspoons?)$/],
  ['pieza', /^(piezas?|unidad(es)?|pcs?)$/], ['diente', /^(dientes?|cloves?)$/], ['lata', /^(latas?|cans?)$/], ['pizca', /^(pizcas?|pinch(es)?)$/],
  ['manojo', /^(manojos?|bunch(es)?)$/], ['rebanada', /^(rebanadas?|slices?)$/], ['filete', /^(filetes?|fillets?)$/], ['hoja', /^(hojas?|leaves|leaf)$/],
  ['paquete', /^(paquetes?|packs?|packages?)$/], ['oz', /^(oz|onzas?|ounces?)$/], ['lb', /^(lb|lbs|libras?|pounds?)$/],
];
function parseIngredientLine(line) {
  let s = String(line).replace(/\s+/g, ' ').trim();
  for (const [k, v] of Object.entries(FRAC)) s = s.replace(new RegExp(`(\\d+)?\\s*${k}`), (_, d) => ` ${(d ? Number(d) : 0) + v} `).trim();
  const m = s.match(/^(\d+(?:[.,]\d+)?)(?:\s+(\d+)\/(\d+)|\/(\d+))?\s*(.*)$/);
  let qty = 0, rest = s;
  if (m) {
    qty = num(m[1], 0);
    if (m[2] && Number(m[3]) > 0) qty += Number(m[2]) / Number(m[3]);
    if (m[4] && Number(m[4]) > 0) qty = Number(m[1]) / Number(m[4]);
    rest = m[5];
  }
  let unit = '';
  const w = rest.match(/^([a-záéíóúñ.]+)\s*(.*)$/i);
  if (qty && w) {
    const word = fold(w[1].replace(/\.$/, ''));
    const hit = UNIT_ALIASES.find(([, re]) => re.test(word));
    if (hit) { unit = hit[0]; rest = w[2]; }
  }
  rest = rest.replace(/^(de|of)\s+/i, '').trim();
  return { name: cap(rest || s), qty: +qty.toFixed(3), unit };
}
function guessCat(text) {
  const f = fold(text);
  if (/desayun|breakfast|brunch|panqueque|pancake|avena/.test(f)) return 'desayuno';
  if (/postre|dessert|pastel|cake|galleta|cookie|brownie|flan/.test(f)) return 'postre';
  if (/merienda|snack|aperitivo|botana/.test(f)) return 'merienda';
  if (/cena|dinner/.test(f)) return 'cena';
  return 'almuerzo';
}
function recipeFromWeb(w) {
  const cat = guessCat(`${w.category || ''} ${w.name || ''}`);
  const r = cleanRecipe({
    name: w.name, category: cat, description: w.description, servings: w.servings, prepMinutes: w.prepMinutes, cookMinutes: w.cookMinutes, tags: w.tags,
    ingredients: (w.ingredients || []).map(parseIngredientLine).map(i => ({ name: i.name, quantity: i.qty, unit: i.unit })),
    steps: (w.steps || []).map(t => ({ text: t, timerMinutes: 0 })),
    nutrition: w.nutrition && w.nutrition.kcal ? w.nutrition : null,
    notes: w.source ? `Fuente: ${w.source}` : '',
  });
  r.steps.forEach(s => { s.timer = detectMin(s.text) || 0; });
  return r;
}
function importMenu() {
  openDlg(`${dlgHead('Importar recetas', 'Recetario')}
    <div class="menu-list">
      <button data-act="linkImportDlg">${ic('down')}<span><b>Desde un enlace</b><small>Pega la dirección de una web de recetas.</small></span></button>
      <button data-act="photoImportDlg">${ic('spark')}<span><b>Desde una foto</b><small>De un recetario o una nota: tu IA la transcribe.</small></span></button>
      <button data-act="importDlg">${ic('copy')}<span><b>Pegar respuesta de la IA</b><small>Recetas y planes que pediste con el prompt.</small></span></button>
    </div>`);
}
XA.importMenu = importMenu;
XA.linkImportDlg = () => {
  openDlg(`${dlgHead('Importar desde un enlace', 'Recetario')}
    <form data-form="link"><label for="lk-url">Dirección de la receta</label><input id="lk-url" type="url" inputmode="url" placeholder="https://…" autocomplete="off" required>
    <p class="muted small">Funciona con la mayoría de webs de recetas. La revisas en el editor antes de guardarla.</p>
    <p id="lk-msg" class="err" role="alert"></p><div id="lk-more"></div>
    <div class="dlg-f"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" id="lk-go">${ic('down')}Importar receta</button></div></form>`);
  setTimeout(() => $('#lk-url')?.focus(), 30);
};
async function importLink(url) {
  const res = await fetch(`${CLOUD_CONFIG.url}/functions/v1/import-recipe`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CLOUD_CONFIG.key }, body: JSON.stringify({ url }) });
  return res.json();
}
const LINK_ERR = { blocked: 'Esa dirección no está permitida.', bad_url: 'La dirección no es válida. Cópiala completa, con https://.', http_403: 'La web no deja que otras apps lean la receta.', http_404: 'La página no existe. Revisa la dirección.' };
async function submitLink(form) {
  const url = $('#lk-url').value.trim(), msg = $('#lk-msg'), btn = $('#lk-go');
  msg.textContent = ''; $('#lk-more').innerHTML = '';
  if (!/^https?:\/\//i.test(url)) { msg.textContent = LINK_ERR.bad_url; return; }
  btn.disabled = true; btn.innerHTML = `${ic('down')}Leyendo la página…`;
  try {
    const d = await importLink(url);
    if (d.recipe) { openDraft(recipeFromWeb(d.recipe)); toast('Receta importada: revísala y guárdala'); return; }
    if (d.error === 'no_recipe') {
      msg.textContent = 'La página no trae la receta en un formato que podamos leer.';
      ui.linkText = d;
      $('#lk-more').innerHTML = `<p>Tu IA puede leerla por ti: copia el prompt con el texto de la página, pégalo en tu IA y trae su respuesta.</p>
        <div class="row"><button type="button" class="btn primary" data-act="copyPagePrompt">${ic('copy')}Copiar prompt con la página</button><button type="button" class="btn" data-act="importDlg">Pegar respuesta</button></div>`;
    } else msg.textContent = LINK_ERR[d.error] || (String(d.error || '').startsWith('http_') ? 'La web no respondió bien. Prueba más tarde.' : 'No se pudo leer la página. Revisa la dirección o tu conexión.');
  } catch { msg.textContent = 'Sin conexión con el importador. Revisa tu internet.'; }
  finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = `${ic('down')}Importar receta`; } }
}
function openDraft(r) {
  ui.returnTo = ui.view === 'editor' ? 'book' : ui.view; ui.pendingPlan = null; ui.emojiOpen = false; ui.draftRestored = false;
  ui.draft = { ...r, id: undefined };
  delete ui.draft.id;
  go('editor');
}
const transcribeTail = `\n\n## Lo que quiero\nTranscribe la receta (una o varias) del material que te paso, en el formato de arriba. Respeta cantidades y pasos; estima "nutrition" por porción. No organices días ("plan" vacío).`;
XA.copyPagePrompt = () => {
  const d = ui.linkText || {};
  copyText(aiPrompt().replace(/\n\n## Lo que quiero[\s\S]*$/, '') + transcribeTail + `\n\n## Texto de la página ${d.url || ''}\n${String(d.text || '').slice(0, 7000)}`, 'Prompt copiado. Pégalo en tu IA.');
};
XA.photoImportDlg = () => {
  openDlg(`${dlgHead('Importar desde una foto', 'Recetario')}
    <ol class="howto"><li>Copia el prompt.</li><li>Abre tu IA (ChatGPT, Claude, Gemini…), pega el prompt y adjunta la foto de la receta.</li><li>Copia su respuesta y pégala en «Pegar respuesta».</li></ol>
    <div class="dlg-f"><button class="btn" data-act="importDlg">Pegar respuesta</button><button class="btn primary" data-act="copyPhotoPrompt">${ic('copy')}Copiar prompt</button></div>`);
};
XA.copyPhotoPrompt = () => copyText(aiPrompt().replace(/\n\n## Lo que quiero[\s\S]*$/, '') + transcribeTail + '\n\nLa receta está en la foto adjunta.', 'Prompt copiado. Pégalo en tu IA junto con la foto.');
document.addEventListener('submit', e => { const f = e.target.closest('[data-form=link]'); if (f) { e.preventDefault(); submitLink(f); } });

/* ═════════ Resumen nutricional de la semana ═════════ */
const NUTRI_TIPS = {
  iron: 'Suma lentejas, garbanzos, espinaca o carne roja, con algo de vitamina C (limón, pimiento) para absorber mejor el hierro.',
  calcium: 'Añade lácteos, yogur, queso, tofu firme o almendras.',
  fiber: 'Más legumbres, avena, verduras y fruta con piel.',
  protein: 'Incluye huevo, legumbres, pollo, pescado o yogur griego en cada comida.',
};
function weekNutrition(ws) {
  const days = weekDays(ws), keys = ['kcal', 'protein', 'fiber', 'iron', 'calcium'];
  const per = days.map(d => ({ d, ...dayNutrition(d), n: (S.plan[d] || []).length, done: (S.plan[d] || []).filter(i => i.done).length }));
  const withData = per.filter(x => x.withData);
  const avg = Object.fromEntries(keys.map(k => [k, withData.length ? withData.reduce((a, x) => a + x.tot[k], 0) / withData.length : 0]));
  return { per, avg, nDays: withData.length, dishes: per.reduce((a, x) => a + x.n, 0), done: per.reduce((a, x) => a + x.done, 0) };
}
function weekSummaryDlg(ws) {
  const g = dailyGoals(), cur = weekNutrition(ws), prev = weekNutrition(ymd(addDays(parseYmd(ws), -7)));
  const days = weekDays(ws);
  if (!cur.nDays) {
    openDlg(`${dlgHead('Resumen nutricional', weekTitle(days))}<div class="empty small">${ic('leaf', 'big')}<p>Esta semana aún no tiene platillos con datos de nutrición. Planifica comidas o pide a la IA un estimado de tus recetas.</p></div>
      <div class="dlg-f"><button class="btn" data-act="closeDlg">Cerrar</button></div>`);
    return;
  }
  const rows = [['kcal', 'Energía', 'kcal'], ['protein', 'Proteína', 'g'], ['fiber', 'Fibra', 'g'], ['iron', 'Hierro', 'mg'], ['calcium', 'Calcio', 'mg']];
  const pct = k => Math.round(cur.avg[k] / g[k] * 100);
  const trend = k => {
    if (!prev.nDays || !prev.avg[k]) return '<span class="tr muted">sin datos de la semana anterior</span>';
    const dlt = Math.round((cur.avg[k] - prev.avg[k]) / prev.avg[k] * 100);
    return Math.abs(dlt) < 3 ? '<span class="tr">igual que la semana pasada</span>' : `<span class="tr ${dlt > 0 ? 'up' : 'down'}">${dlt > 0 ? '▲' : '▼'} ${Math.abs(dlt)}% frente a la semana pasada</span>`;
  };
  const maxK = Math.max(g.kcal * 1.2, ...cur.per.map(x => x.tot.kcal));
  const low = rows.slice(1).map(([k]) => k).filter(k => pct(k) < 85).sort((a, b) => pct(a) - pct(b));
  const kp = pct('kcal');
  const tips = [
    kp < 85 ? 'Te quedas corta de energía: añade una merienda o porciones algo mayores.' : kp > 115 ? 'Pasas tu meta de energía: prueba porciones más pequeñas o cenas más ligeras.' : '',
    ...low.slice(0, 2).map(k => `${rows.find(r => r[0] === k)[1]} baja (${pct(k)}%). ${NUTRI_TIPS[k]}`),
  ].filter(Boolean);
  openDlg(`${dlgHead('Resumen nutricional', weekTitle(days))}
    <p class="muted small">Promedio por día con datos (${cur.nDays} de 7). ${cur.done} de ${cur.dishes} platillos marcados como hechos.</p>
    <div class="wk-bars" style="--goal:${Math.round(g.kcal / maxK * 100)}%" role="img" aria-label="Energía por día frente a la meta de ${fmtNum(g.kcal)} kcal (línea punteada)">
      ${cur.per.map(x => `<div class="wk-bar"><div class="wk-track"><i style="height:${Math.round(x.tot.kcal / maxK * 100)}%" class="${!x.tot.kcal ? 'none' : x.tot.kcal > g.kcal * 1.15 ? 'over' : x.tot.kcal < g.kcal * .85 ? 'under' : ''}"></i></div><span>${esc(shortDay(x.d))}</span><small>${x.tot.kcal ? fmtNum(x.tot.kcal) : '–'}</small></div>`).join('')}
    </div>
    <p class="wk-legend"><i class="lg-ok"></i>Cerca de la meta <i class="lg-over"></i>Por encima <i class="lg-under"></i>Por debajo <i class="lg-goal"></i>Meta</p>
    <ul class="wk-rows">${rows.map(([k, label, unit]) => `<li><span>${label}</span><i class="pbar"><b style="width:${Math.min(100, pct(k))}%" class="${pct(k) < 85 ? 'low' : ''}"></b></i><b>${pct(k)}%</b><small>${fmtNum(cur.avg[k], k === 'iron' ? 1 : 0)} de ${fmtNum(g[k])} ${unit} al día. ${trend(k)}</small></li>`).join('')}</ul>
    ${tips.length ? `<h3>Para mejorar</h3><ul class="wk-tips">${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="ok-msg">Vas muy bien: tu semana cubre tus metas principales.</p>'}
    <div class="dlg-f"><button class="btn" data-act="closeDlg">Cerrar</button></div>`);
}
XA.weekSummary = () => weekSummaryDlg(ui.view === 'month' ? weekStartOf(ui.day) : ui.weekStart);

/* ═════════ Despensa y presupuesto (vista Compras) ═════════ */
function shopTabs() {
  const t = ui.shopTab || 'lists';
  return `<div class="shop-bar"><div class="seg shop-tabs" role="tablist" aria-label="Compras">
    <button role="tab" class="${t === 'lists' ? 'on' : ''}" aria-selected="${t === 'lists'}" data-act="shopTab" data-k="lists">${ic('cart')}Listas</button>
    <button role="tab" class="${t === 'pantry' ? 'on' : ''}" aria-selected="${t === 'pantry'}" data-act="shopTab" data-k="pantry">${ic('leaf')}Despensa${S.pantry.length ? `<small>${S.pantry.length}</small>` : ''}</button></div>
    <button class="btn ghost" data-act="joinDlg">${ic('users')}Unirme a una lista</button></div>`;
}
XA.shopTab = d => { ui.shopTab = d.k; render(); };
function budgetCard() {
  const b = num(S.prefs.budget, 0), spent = weekSpend(), pending = S.lists.reduce((a, l) => a + l.items.filter(i => !i.checked).reduce((s, i) => s + (i.price || 0), 0), 0);
  const anyPrice = S.lists.some(l => l.items.some(i => i.price));
  if (!b && !anyPrice) return `<section class="budget hint-card">${ic('cart')}<p><b>¿Cuánto gastas en comida?</b> Añade el precio al editar un artículo y lo recordaremos para tus próximas listas.</p><button class="btn sm" data-act="budgetEdit">Fijar presupuesto semanal</button></section>`;
  const pc = b ? Math.min(100, Math.round(spent / b * 100)) : 0;
  return `<section class="budget"><div class="bd-h"><div><p class="ab-sub">Esta semana</p><p class="bd-n"><b>${money(spent)}</b>${b ? ` de ${money(b)}` : ' gastado'}</p></div>
      <button class="btn sm ghost" data-act="budgetEdit">${b ? 'Cambiar presupuesto' : 'Fijar presupuesto'}</button></div>
    ${b ? `<div class="pbar big${spent > b ? ' over' : ''}"><b style="width:${pc}%"></b></div>` : ''}
    <p class="muted small">${pending ? `Falta por comprar unos ${money(pending)} según tus listas. ` : ''}${b && spent > b ? `Te pasaste ${money(spent - b)}.` : b ? `Te quedan ${money(b - spent)}.` : ''}</p></section>`;
}
XA.budgetEdit = () => {
  openDlg(`${dlgHead('Presupuesto semanal', 'Compras')}
    <div class="grid2"><div><label for="bd-amount">Monto por semana</label><input id="bd-amount" inputmode="decimal" value="${num(S.prefs.budget, 0) || ''}" placeholder="Ej. 1500"></div>
    <div><label for="bd-cur">Moneda</label><input id="bd-cur" value="${esc(S.prefs.currency || '$')}" maxlength="4"></div></div>
    <p class="muted small">El gasto suma el precio de lo que marcas como comprado de lunes a domingo. Déjalo vacío para no usar presupuesto.</p>
    <div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="budgetSave">${ic('check')}Guardar presupuesto</button></div>`);
};
XA.budgetSave = async () => { S.prefs.budget = num($('#bd-amount').value, 0); S.prefs.currency = $('#bd-cur').value.trim() || '$'; await save(); closeDlg(); render(); toast('Presupuesto guardado'); };
function listMoney(l) {
  const est = listCost(l), cart = l.items.filter(i => i.checked).reduce((a, i) => a + (i.price || 0), 0);
  return est ? `<p class="list-money">${ic('cart')}<span>Estimado <b>${money(est)}</b></span><span>En el carrito <b>${money(cart)}</b></span></p>` : '';
}
function viewPantry() {
  const groups = {};
  for (const p of S.pantry.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'))) (groups[aisleOf(p.name)] = groups[aisleOf(p.name)] || []).push(p);
  return `<p class="muted">Lo que ya tienes en casa. Las listas del plan piden solo lo que falta y, al cocinar, se descuenta lo que usa la receta.</p>
  <form class="add-item pantry-add" data-form="pantry">
    <label class="ai-name">Producto<input id="pa-name" placeholder="Ej. arroz" autocomplete="off" list="ing-names"></label>
    <label>Cantidad<input id="pa-qty" inputmode="decimal" placeholder="Siempre hay"></label>
    <label>Unidad<input id="pa-unit" list="units" placeholder="g"></label>
    <button class="btn primary">${ic('plus')}<span>Añadir a la despensa</span></button>
  </form>
  <datalist id="units">${UNITS.map(u => `<option value="${u}">`).join('')}</datalist>
  <datalist id="ing-names">${[...new Set(S.recipes.flatMap(r => r.ingredients.map(i => i.name)))].slice(0, 300).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
  ${S.pantry.length ? AISLE_NAMES.filter(a => groups[a]).map(a => `<section class="aisle"><h3>${a}<span>${groups[a].length}</span></h3><ul class="items">${groups[a].map(p => `<li class="it pantry-it">
      <span class="it-t">${esc(p.name)}<small>${p.qty ? 'Se descuenta al cocinar' : 'Siempre hay: no se pide en las listas'}</small></span>
      <label class="pq"><span class="sr">Cantidad de ${esc(p.name)}</span><input inputmode="decimal" value="${p.qty || ''}" placeholder="∞" data-chg="pantryQty" data-id="${p.id}"></label><span class="pu">${esc(p.unit)}</span>
      <button class="btn icon ghost sm" data-act="pantryDel" data-id="${p.id}" aria-label="Quitar ${esc(p.name)} de la despensa">${ic('trash')}</button></li>`).join('')}</ul></section>`).join('')
    : `<div class="empty small">${ic('leaf', 'big')}<h3>Tu despensa está vacía</h3><p>Añade lo que tienes, o en una lista usa «Guardar lo comprado en la despensa».</p></div>`}`;
}
XC.pantryQty = async (d, el) => { const p = S.pantry.find(x => x.id === d.id); if (!p) return; p.qty = num(el.value, 0); p.at = Date.now(); await save(); toast(`${p.name}: ${p.qty ? fmtQty(p.qty) + (p.unit ? ' ' + p.unit : '') : 'siempre hay'}`); };
XA.pantryDel = async d => { const p = S.pantry.find(x => x.id === d.id); await withUndo(`${p ? p.name : 'Producto'}: quitado de la despensa`, () => { S.pantry = S.pantry.filter(x => x.id !== d.id); }); };
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form=pantry]');
  if (!f) return;
  e.preventDefault();
  const name = $('#pa-name').value.trim();
  if (!name) return $('#pa-name').focus();
  addToPantry(name, num($('#pa-qty').value, 0), $('#pa-unit').value.trim());
  await save(); render(); $('#pa-name')?.focus(); toast(`${name}: en la despensa`);
});
XA.listToPantry = async d => {
  const l = getList(d.id), got = l.items.filter(i => i.checked);
  if (!got.length) return toast('Marca primero lo que compraste');
  await withUndo(`${got.length} ${got.length === 1 ? 'producto guardado' : 'productos guardados'} en la despensa`, () => {
    bankSpend(got);
    for (const i of got) { addToPantry(i.name, i.qty, i.unit); rememberPrice(i); }
    l.removed = [...new Set([...(l.removed || []), ...got.filter(i => i.pkey).map(i => i.pkey)])];
    l.items = l.items.filter(i => !i.checked);
  });
};

/* ═════════ Listas compartidas en tiempo real ═════════ */
const SHARE_META = 'planner.shares';
const itemCanon = i => { const { u, ...rest } = i; return canon(rest); };
const snapOf = items => Object.fromEntries(items.map(i => [i.id, itemCanon(i)]));
function mergeShared(remote, delta, now = Date.now()) {
  const items = new Map((remote.items || []).map(i => [i.id, i])), dels = { ...(remote.dels || {}) };
  for (const id of delta.dels) { dels[id] = now; items.delete(id); }
  for (const it of delta.changed) {
    if (dels[it.id] && dels[it.id] >= (it.u || 0)) continue;
    const r = items.get(it.id);
    if (!r || (r.u || 0) <= it.u) items.set(it.id, it);
  }
  for (const [id, ts] of Object.entries(dels)) { const it = items.get(id); if (it && (it.u || 0) <= ts) items.delete(id); if (ts < now - 30 * 864e5) delete dels[id]; }
  return { name: delta.name || remote.name, items: [...items.values()], dels };
}
const Shared = {
  ch: new Map(), timer: null, started: false, busy: new Set(),
  meta() { return lsGet(SHARE_META, {}); },
  setMeta(id, m) { const all = this.meta(); if (m) all[id] = m; else delete all[id]; lsSet(SHARE_META, all); },
  delta(l) {
    if (!l.share) return { changed: [], dels: [], name: '' };
    const m = this.meta()[l.share.id] || { snap: {} }, now = Date.now(), snap = m.snap || {};
    const changed = l.items.filter(i => snap[i.id] !== itemCanon(i)).map(i => ({ ...i, u: now }));
    const dels = Object.keys(snap).filter(id => !l.items.some(i => i.id === id));
    return { changed, dels, name: m.name !== l.name ? l.name : '' };
  },
  norm(l, data) {
    const n = normalizeState({ lists: [{ id: l.id, name: data.name || l.name, items: (data.items || []).map(i => ({ ...i })) }] }).lists[0];
    const byId = new Map((data.items || []).map(i => [i.id, i]));
    return { name: n.name, items: n.items.map(i => (byId.get(i.id)?.u ? { ...i, u: byId.get(i.id).u } : i)) };
  },
  // snapFrom: lo que ya está en la nube (lo que no coincida con eso se sigue considerando cambio local pendiente)
  apply(l, data, version, snapFrom) {
    if (!l.share) return;
    const n = this.norm(l, data);
    l.items = n.items; l.name = n.name;
    const base = snapFrom ? this.norm(l, snapFrom) : n;
    this.setMeta(l.share.id, { v: version, snap: snapOf(base.items), name: base.name });
  },
  async create(l) {
    const A2 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const now = Date.now();
    for (let tries = 0; tries < 4; tries++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => A2[b % A2.length]).join('');
      const data = { name: l.name, items: l.items.map(i => ({ ...i, u: now })), dels: {} };
      const { data: row, error } = await Cloud.client.from('shared_lists').insert({ code, name: l.name, data }).select().single();
      if (error && /duplicate|unique/i.test(error.message)) continue;
      if (error) throw error;
      l.share = { id: row.id, code: row.code };
      this.setMeta(row.id, { v: row.version, snap: snapOf(l.items), name: l.name });
      await save(); this.subscribe(l);
      return row;
    }
    throw new Error('No se pudo crear el código');
  },
  async join(code) {
    const { data: row, error } = await Cloud.client.rpc('join_shared_list', { p_code: code.trim().toUpperCase() });
    if (error) throw new Error(/code_not_found/.test(error.message) ? 'No hay ninguna lista con ese código.' : Cloud.msg(error));
    let l = S.lists.find(x => x.share && x.share.id === row.id);
    if (!l) { l = { id: uid(), name: row.name, createdAt: Date.now(), from: '', to: '', removed: [], items: [], share: { id: row.id, code: row.code } }; S.lists.unshift(l); }
    this.apply(l, row.data || {}, row.version);
    await save(); this.subscribe(l);
    return l;
  },
  async push(l) {
    if (!Cloud.user || !l.share || this.busy.has(l.id)) return;
    // Lista llegada por la nube sin historial local: primero se adopta lo que hay en la nube (no se pisa con una copia vieja)
    if (!this.meta()[l.share.id]) return this.pull(l);
    this.busy.add(l.id);
    try {
      for (let i = 0; i < 5; i++) {
        if (!l.share) return;
        const delta = this.delta(l);
        if (!delta.changed.length && !delta.dels.length && !delta.name) return;
        const sent = new Map(l.items.map(x => [x.id, itemCanon(x)])), sentName = l.name;
        const { data: row, error } = await Cloud.client.from('shared_lists').select('data,version,name').eq('id', l.share.id).maybeSingle();
        if (error) throw error;
        if (!l.share) return;
        if (!row) return this.lost(l);
        const merged = mergeShared({ ...row.data, name: row.name }, delta);
        const { data: up, error: e2 } = await Cloud.client.from('shared_lists').update({ data: merged, name: merged.name || l.name, version: row.version + 1 }).eq('id', l.share.id).eq('version', row.version).select('version');
        if (e2) throw e2;
        if (up && up.length) {
          // Lo que el usuario cambió mientras viajaba la petición se conserva como pendiente (no se pisa)
          const cur = new Map(l.items.map(x => [x.id, x])), late = new Set(l.items.filter(x => sent.get(x.id) !== itemCanon(x)).map(x => x.id));
          const inMerged = new Set(merged.items.map(x => x.id));
          const items = merged.items.filter(x => cur.has(x.id) || !sent.has(x.id)).map(x => (late.has(x.id) ? cur.get(x.id) : x)).concat(l.items.filter(x => late.has(x.id) && !inMerged.has(x.id)));
          this.apply(l, { name: l.name !== sentName ? l.name : merged.name, items }, up[0].version, merged);
          await Store.save(S); if (ui.view === 'list' && ui.listId === l.id && !document.activeElement?.closest('.add-item, .it-edit')) render(); continue; }
      }
    } catch {} finally { this.busy.delete(l.id); }
  },
  async pull(l) {
    if (!Cloud.user || !l.share) return;
    const { data: row, error } = await Cloud.client.from('shared_lists').select('data,version,name').eq('id', l.share.id).maybeSingle();
    if (error) return;
    if (!row) return this.lost(l);
    this.onRemote(l, row);
  },
  onRemote(l, row) {
    if (!l.share) return;
    const m = this.meta()[l.share.id] || {};
    if (m.v && row.version <= m.v) return;
    const delta = m.v ? this.delta(l) : { changed: [], dels: [], name: '' };
    const remote = { ...(row.data || {}), name: row.name };
    this.apply(l, mergeShared(remote, delta), row.version, remote);
    Store.save(S); Cloud.schedule();
    if (delta.changed.length || delta.dels.length) this.push(l);
    if ((ui.view === 'list' && ui.listId === l.id && !document.activeElement?.closest('.add-item, .it-edit, .title-edit')) || ui.view === 'shop') render();
  },
  async lost(l) { if (!l.share) return; const id = l.share.id; this.unsubscribe(id); delete l.share; this.setMeta(id, null); await save(); render(); toast(`«${l.name}» ya no está compartida`); },
  subscribe(l) {
    if (!Cloud.client || this.ch.has(l.share.id)) return;
    const id = l.share.id;
    const ch = Cloud.client.channel('sl:' + id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shared_lists', filter: `id=eq.${id}` }, p => {
      const cur = S.lists.find(x => x.share && x.share.id === id); if (cur) this.onRemote(cur, p.new);
    }).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shared_lists', filter: `id=eq.${id}` }, () => {
      const cur = S.lists.find(x => x.share && x.share.id === id); if (cur) this.lost(cur);
    }).subscribe();
    this.ch.set(id, ch);
  },
  unsubscribe(id) { const ch = this.ch.get(id); if (ch) { Cloud.client.removeChannel(ch); this.ch.delete(id); } },
  start() {
    if (!Cloud.user) return;
    for (const l of S.lists) if (l.share) { this.subscribe(l); if (!this.started) this.pull(l); }
    this.started = true;
  },
  schedule() { clearTimeout(this.timer); if (Cloud.user) this.timer = setTimeout(() => { for (const l of S.lists) if (l.share) this.push(l); }, 600); },
  async stop(l) {
    const id = l.share.id;
    const { data: row } = await Cloud.client.from('shared_lists').select('owner').eq('id', id).maybeSingle();
    if (row && row.owner === Cloud.user.id) await Cloud.client.from('shared_lists').delete().eq('id', id);
    else await Cloud.client.from('shared_list_members').delete().eq('list_id', id).eq('user_id', Cloud.user.id);
    this.unsubscribe(id); delete l.share; this.setMeta(id, null); await save();
  },
};
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Cloud.user) for (const l of S.lists) if (l.share) Shared.pull(l); });

function shareDlg(l) {
  const live = l.share ? `<div class="share-code"><p class="muted">Código para unirse</p><b>${esc(l.share.code)}</b></div>
      <p class="muted small">Quien tenga este código y su propia cuenta ve y edita esta lista al momento: lo que marcas en el súper le aparece al instante.</p>
      <div class="row"><button class="btn primary" data-act="shareInvite" data-id="${l.id}">${ic('share')}Enviar invitación</button><button class="btn" data-act="shareCopyCode" data-id="${l.id}">${ic('copy')}Copiar código</button></div>
      <button class="btn ghost danger sm" data-act="shareStop" data-id="${l.id}">Dejar de compartir</button>`
    : Cloud.user ? `<p>Comparte la lista con otra persona y editen juntas en tiempo real.</p><button class="btn primary" data-act="shareStart" data-id="${l.id}">${ic('users')}Compartir en vivo</button>`
      : `<p>Para compartir en vivo, las dos personas necesitan entrar a su cuenta.</p><button class="btn" data-act="nav" data-view="more">${ic('cloud')}Conectar mi cuenta</button>`;
  openDlg(`${dlgHead(`Compartir «${esc(l.name)}»`, 'Lista de compras')}
    <section class="share-s"><h3>${ic('users')}En tiempo real</h3>${live}</section>
    <section class="share-s"><h3>${ic('list')}Como texto</h3><p class="muted small">Envía lo que falta por comprar por WhatsApp, correo o donde quieras.</p><button class="btn" data-act="listShareText" data-id="${l.id}">Enviar como texto</button></section>`);
}
XA.listShare = d => shareDlg(getList(d.id));
XA.listShareText = async d => {
  const l = getList(d.id), text = listText(l);
  if (!text) return toast('No queda nada por comprar');
  if (await shareText(l.name, text)) return;
  copyText(text, 'Lista copiada');
};
XA.shareStart = async (d, el) => {
  const l = getList(d.id); el.disabled = true;
  try { await Shared.create(l); shareDlg(l); render(); toast('Lista compartida'); } catch (e) { el.disabled = false; toast('No se pudo compartir: ' + Cloud.msg(e)); }
};
const inviteText = l => `Únete a mi lista de compras «${l.name}» en Planner de Recetas: en Compras, toca «Unirme a una lista» y escribe el código ${l.share.code}`;
XA.shareInvite = async d => { const l = getList(d.id); if (!(await shareText('Lista de compras compartida', inviteText(l)))) copyText(inviteText(l), 'Invitación copiada'); };
XA.shareCopyCode = d => copyText(getList(d.id).share.code, 'Código copiado');
XA.shareStop = async d => {
  const l = getList(d.id);
  if (!await confirmDlg({ title: `Dejar de compartir «${esc(l.name)}»`, text: 'La lista se queda en tu dispositivo, pero dejará de actualizarse con la otra persona.', ok: 'Dejar de compartir' })) return shareDlg(l);
  try { await Shared.stop(l); closeDlg(); render(); toast('Ya no se comparte'); } catch (e) { toast('No se pudo: ' + Cloud.msg(e)); }
};
XA.joinDlg = () => {
  if (!Cloud.user) {
    openDlg(`${dlgHead('Unirme a una lista', 'Compras')}<p>Para unirte a una lista compartida, entra primero a tu cuenta.</p><div class="dlg-f"><button class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" data-act="nav" data-view="more">${ic('cloud')}Conectar mi cuenta</button></div>`);
    return;
  }
  openDlg(`${dlgHead('Unirme a una lista', 'Compras')}<form data-form="join"><label for="jn-code">Código de la lista</label><input id="jn-code" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="Ej. K7PQ2M" required style="text-transform:uppercase;letter-spacing:.15em">
    <p id="jn-msg" class="err" role="alert"></p><div class="dlg-f"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary">${ic('users')}Unirme</button></div></form>`);
  setTimeout(() => $('#jn-code')?.focus(), 30);
};
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form=join]');
  if (!f) return;
  e.preventDefault();
  const btn = $('button.primary', f); btn.disabled = true;
  try { const l = await Shared.join($('#jn-code').value); closeDlg(); ui.listId = l.id; go('list'); toast(`Te uniste a «${l.name}»`); }
  catch (err) { $('#jn-msg').textContent = err.message; btn.disabled = false; }
});

/* ═════════ Modo cocina: letra, toque para avanzar y voz ═════════ */
const cookFont = () => Math.min(1.6, Math.max(.8, num(lsGet('planner.cookFont', 1), 1)));
XA.cookFont = d => { lsSet('planner.cookFont', +(cookFont() + Number(d.n) * .15).toFixed(2)); $('.cook')?.style.setProperty('--ck-fs', cookFont()); };
XA.cookTap = (d, el, e) => {
  if (e.target.closest('button, a, input, label')) return;
  const r = el.getBoundingClientRect();
  if (e.clientX - r.left < r.width * .3) A.cookPrev(); else A.cookNext();
};
const Voice = {
  speakOn: lsGet('planner.cookSpeak', false), listenOn: false, rec: null, speaking: false, sid: 0, lastKey: '', handled: false,
  canSpeak: () => !!(NP.TextToSpeech || window.speechSynthesis),
  canListen: () => !!(NP.SpeechRecognition || window.SpeechRecognition || window.webkitSpeechRecognition),
  async speak(text) {
    this.stopSpeak(); this.speaking = true;
    const id = ++this.sid;
    try {
      if (NP.TextToSpeech) await NP.TextToSpeech.speak({ text, lang: 'es-ES', rate: 1, pitch: 1, volume: 1, category: 'playback' });
      else await new Promise(res => { const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES'; u.rate = 1; u.onend = u.onerror = res; speechSynthesis.speak(u); setTimeout(res, 60000); });
    } catch {}
    if (this.sid === id) this.speaking = false; // una lectura cancelada no apaga la que ya empezó
  },
  stopSpeak() { this.sid++; try { if (NP.TextToSpeech) NP.TextToSpeech.stop(); else if (window.speechSynthesis) speechSynthesis.cancel(); } catch {} this.speaking = false; },
  stepText() {
    const c = ui.cook, r = c && getRecipe(c.recipeId);
    if (!r) return '';
    if (c.step >= r.steps.length) return 'Listo, a la mesa. Buen provecho.';
    return `Paso ${c.step + 1} de ${r.steps.length}. ${r.steps[c.step].text}`;
  },
  afterRender() {
    if (ui.view !== 'cook' || !ui.cook) return;
    $('.cook')?.style.setProperty('--ck-fs', cookFont());
    const key = ui.cook.recipeId + ':' + ui.cook.step;
    if (this.speakOn && key !== this.lastKey) { this.lastKey = key; this.speak(this.stepText()); }
  },
  command(t) {
    const f = fold(t);
    if (/siguiente|proximo|avanza|adelante|sigue|listo/.test(f)) A.cookNext();
    else if (/atras|anterior|regresa|vuelve/.test(f)) A.cookPrev();
    else if (/repite|repetir|otra vez|lee|leer/.test(f)) { this.lastKey = ''; this.speak(this.stepText()); }
    else if (/temporizador|cronometro|inicia|empieza/.test(f)) { const b = $('.ck-timer-btn'); if (b) b.click(); else return false; }
    else return false;
    toast(`Entendido: «${t.trim()}»`);
    return true;
  },
  async startListen() {
    if (NP.SpeechRecognition) {
      const SR = NP.SpeechRecognition;
      try {
        const av = await SR.available();
        if (!av.available) { toast('El reconocimiento de voz no está disponible en este teléfono'); return false; }
        const perm = await SR.requestPermissions();
        if ((perm.speechRecognition || perm.permission) !== 'granted') { toast('Da permiso al micrófono para usar órdenes por voz'); return false; }
        await SR.removeAllListeners();
        await SR.addListener('partialResults', d => { const t = (d.matches || [])[0]; if (t && !this.handled && !this.speaking && this.command(t)) { this.handled = true; SR.stop().catch(() => {}); } });
        await SR.addListener('listeningState', d => { if (d.status === 'stopped' && this.listenOn && ui.view === 'cook') setTimeout(() => this.loopNative(), 250); });
        this.listenOn = true; this.loopNative(); return true;
      } catch { toast('No se pudo activar el micrófono'); return false; }
    }
    const SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SRC) return false;
    const rec = new SRC(); this.rec = rec;
    rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => { const t = e.results[e.results.length - 1][0].transcript; if (!this.speaking) this.command(t); };
    rec.onend = () => { if (this.listenOn && ui.view === 'cook' && this.rec === rec) { try { rec.start(); } catch {} } };
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.listenOn = false; this.rec = null; toast('Sin permiso para el micrófono'); render(); } };
    try { rec.start(); this.listenOn = true; return true; } catch { return false; }
  },
  loopNative() { if (!this.listenOn) return; this.handled = false; NP.SpeechRecognition.start({ language: 'es-ES', maxResults: 3, partialResults: true, popup: false }).catch(() => {}); },
  stopListen() {
    this.listenOn = false;
    if (NP.SpeechRecognition) { NP.SpeechRecognition.stop().catch(() => {}); NP.SpeechRecognition.removeAllListeners().catch(() => {}); }
    if (this.rec) { const r = this.rec; this.rec = null; try { r.stop(); } catch {} }
  },
  stopAll() { this.stopListen(); this.stopSpeak(); this.lastKey = ''; },
};
function cookOptions() {
  return `<div class="ck-opts" role="toolbar" aria-label="Opciones de lectura">
    <button class="ck-btn" data-act="cookFont" data-n="-1" aria-label="Letra más pequeña">A−</button><button class="ck-btn" data-act="cookFont" data-n="1" aria-label="Letra más grande">A+</button>
    ${Voice.canSpeak() ? `<button class="ck-btn wide${Voice.speakOn ? ' on' : ''}" data-act="cookSpeak" aria-pressed="${Voice.speakOn}">${ic('speaker')}Leer en voz alta</button>` : ''}
    ${Voice.canListen() ? `<button class="ck-btn wide${Voice.listenOn ? ' on' : ''}" data-act="cookListen" aria-pressed="${Voice.listenOn}">${ic('mic')}Manos libres</button>` : ''}
  </div>${Voice.listenOn ? '<p class="ck-voice-hint" role="status">Di «siguiente», «atrás», «repite» o «temporizador».</p>' : ''}`;
}
XA.cookSpeak = () => { Voice.speakOn = !Voice.speakOn; lsSet('planner.cookSpeak', Voice.speakOn); if (Voice.speakOn) { Voice.lastKey = ''; } else Voice.stopSpeak(); render(); };
XA.cookListen = async () => { if (Voice.listenOn) Voice.stopListen(); else await Voice.startListen(); render(); };
