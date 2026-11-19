/* Nube: cuenta y sincronización con Supabase (PostgreSQL).
   La app sigue siendo offline-first: todo se guarda en el dispositivo y se sincroniza al haber conexión.
   Cada receta, día del plan, lista y ajustes es una "entidad"; se compara su huella con la última
   sincronizada para saber qué cambió en cada lado. Si cambió en los dos, gana la versión local. */
'use strict';

const CLOUD_CONFIG = {
  url: 'https://tqknwybunzucthlstgqb.supabase.co',
  key: 'sb_publishable_vXw8SrDk2oyaG7-3aDMDLA_aEkKpxex', // clave pública: el acceso a los datos lo protege RLS
};
const SYNC_KEY = 'planner.sync';
const TABLES = { r: 'recipes', p: 'plan_days', l: 'shopping_lists' };

/* huellas estables (orden de claves fijo) */
const sortKeys = v => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) if (v[k] !== undefined) o[k] = sortKeys(v[k]); return o; }
  return v;
};
const canon = v => JSON.stringify(sortKeys(v));
const fingerprint = v => { const s = canon(v); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '.' + s.length; };

/* entidades locales ↔ filas de la base */
const recipeEntity = r => ({ id: r.id, name: r.name, emoji: r.emoji, category: r.category, difficulty: r.difficulty, description: r.description || '', servings: r.servings, prepMinutes: r.prepMinutes || 0, cookMinutes: r.cookMinutes || 0, tags: r.tags || [], ingredients: (r.ingredients || []).map(i => ({ name: i.name, qty: i.qty || 0, unit: i.unit || '' })), steps: (r.steps || []).map(s => ({ text: s.text, timer: s.timer || 0 })), nutrition: r.nutrition || null, notes: r.notes || '', fav: !!r.fav, createdAt: r.createdAt || 0 });
const settingsEntity = () => ({ profile: S.profile || null, dayTips: S.dayTips || {} });
function localEntities() {
  const m = new Map();
  for (const r of S.recipes) m.set('r:' + r.id, recipeEntity(r));
  for (const [d, items] of Object.entries(S.plan)) m.set('p:' + d, items);
  for (const l of S.lists) m.set('l:' + l.id, { id: l.id, name: l.name, createdAt: l.createdAt || 0, from: l.from || '', to: l.to || '', removed: l.removed || [], items: l.items });
  m.set('s', settingsEntity());
  return m;
}
const toRow = {
  r: e => ({ id: e.id, name: e.name, emoji: e.emoji, category: e.category, difficulty: e.difficulty, description: e.description, servings: e.servings, prep_minutes: e.prepMinutes, cook_minutes: e.cookMinutes, tags: e.tags, ingredients: e.ingredients, steps: e.steps, nutrition: e.nutrition, notes: e.notes, fav: e.fav, created_at: new Date(e.createdAt || Date.now()).toISOString(), deleted: false }),
  p: (e, day) => ({ day, items: e, deleted: false }),
  l: e => ({ id: e.id, name: e.name, data: { createdAt: e.createdAt, from: e.from, to: e.to, removed: e.removed, items: e.items }, deleted: false }),
};
// Normaliza lo que viene de la base con las mismas reglas que los datos locales (también filas cargadas a mano)
const fromRow = {
  r: row => {
    const st = normalizeState({ recipes: [{ id: row.id, name: row.name, emoji: row.emoji, category: row.category, difficulty: row.difficulty, description: row.description, servings: row.servings, prepMinutes: row.prep_minutes, cookMinutes: row.cook_minutes, tags: row.tags, ingredients: row.ingredients, steps: row.steps, nutrition: row.nutrition, notes: row.notes, fav: row.fav, createdAt: Date.parse(row.created_at) || 0 }] });
    return st.recipes[0] ? recipeEntity(st.recipes[0]) : null;
  },
  p: row => normalizeState({ plan: { [row.day]: row.items || [] } }).plan[row.day] || null,
  l: row => { const d = row.data || {}; const l = normalizeState({ lists: [{ id: row.id, name: row.name, ...d }] }).lists[0]; return l ? { id: l.id, name: l.name, createdAt: d.createdAt || 0, from: l.from || '', to: l.to || '', removed: l.removed || [], items: l.items } : null; },
};
function applyEntity(key, e) {
  const kind = key[0], id = key.slice(2);
  if (kind === 'r') {
    const i = S.recipes.findIndex(r => r.id === id);
    if (!e) { if (i >= 0) S.recipes.splice(i, 1); return; }
    if (i >= 0) S.recipes[i] = { ...e }; else S.recipes.push({ ...e });
  } else if (kind === 'p') {
    if (!e || !e.length) delete S.plan[id]; else S.plan[id] = e;
  } else if (kind === 'l') {
    const i = S.lists.findIndex(l => l.id === id);
    if (!e) { if (i >= 0) S.lists.splice(i, 1); return; }
    if (i >= 0) S.lists[i] = { ...e }; else S.lists.push({ ...e });
  } else if (key === 's' && e) {
    if (e.profile) S.profile = e.profile;
    S.dayTips = e.dayTips || {};
  }
}

const Cloud = {
  client: null, user: null, status: 'off', error: '', syncing: false, again: false, timer: null, firstDone: false,
  available() { return !!(window.supabase && window.supabase.createClient); },
  loadState() { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch { return {}; } },
  saveState(st) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(st)); } catch {} },

  async init() {
    if (!this.available()) { this.status = 'unavailable'; return; }
    this.client = window.supabase.createClient(CLOUD_CONFIG.url, CLOUD_CONFIG.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'planner.auth' },
    });
    this.client.auth.onAuthStateChange((ev, session) => {
      const u = session?.user || null;
      const changed = (u?.id || null) !== (this.user?.id || null);
      this.user = u;
      this.status = u ? (this.status === 'off' ? 'idle' : this.status) : 'off';
      if (changed) { this.refreshUI(); if (u) setTimeout(() => this.sync(), 0); }
    });
    const { data } = await this.client.auth.getSession();
    this.user = data.session?.user || null;
    this.status = this.user ? 'idle' : 'off';
    window.addEventListener('online', () => this.sync());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.sync(); });
    setInterval(() => { if (document.visibilityState === 'visible') this.sync({ quiet: true }); }, 120000);
    if (this.user) this.sync();
  },

  // Tras cada guardado local: sube los cambios unos segundos después (agrupa ediciones seguidas)
  schedule() {
    if (!this.user) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync({ quiet: true }), 2500);
  },

  async signIn(email, password) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this.msg(error));
  },
  async signUp(email, password) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw new Error(this.msg(error));
    return !data.session; // true si falta confirmar el correo
  },
  async signOut() {
    await this.client.auth.signOut();
    this.user = null; this.status = 'off';
    localStorage.removeItem(SYNC_KEY);
    this.refreshUI();
  },
  msg(e) {
    const m = String(e?.message || e);
    if (/invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/not confirmed/i.test(m)) return 'Falta confirmar tu correo: abre el enlace que te enviamos y vuelve a entrar.';
    if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene cuenta. Usa «Entrar».';
    if (/password.*(6|characters)/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
    if (/fetch|network|failed to/i.test(m)) return 'Sin conexión con la nube. Revisa tu internet.';
    return m;
  },

  async pull(table, since) {
    const rows = [];
    for (let page = 0; page < 50; page++) {
      let q = this.client.from(table).select('*').order('updated_at', { ascending: true }).range(page * 1000, page * 1000 + 999);
      if (since) q = q.gte('updated_at', since);
      const { data, error } = await q;
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return rows;
  },

  async sync({ quiet = false } = {}) {
    if (!this.user || !this.client) return;
    if (this.syncing) { this.again = true; return; }
    if (navigator.onLine === false) { this.status = 'offline'; this.refreshUI(); return; }
    this.syncing = true; this.status = 'syncing'; this.refreshUI();
    try {
      let st = this.loadState();
      if (st.uid !== this.user.id) st = { uid: this.user.id, lastPull: {}, base: {}, first: true };
      const base = st.base;

      /* 1. Traer lo cambiado en la nube */
      let cur = localEntities(), curFp = new Map([...cur].map(([k, v]) => [k, fingerprint(v)]));
      let localChanged = false;
      const consider = (key, remote) => {
        const rf = remote ? fingerprint(remote) : null, lf = curFp.get(key) ?? null, bf = base[key] ?? null;
        if (lf === bf) { // sin cambios locales: se aplica lo remoto
          if (rf !== lf) { applyEntity(key, remote); localChanged = true; }
          if (rf) base[key] = rf; else delete base[key];
        } else if (lf === rf) { if (rf) base[key] = rf; else delete base[key]; } // ya coincide
        // si no: cambió en los dos lados; se conserva lo local y se sube después
      };
      for (const kind of ['r', 'p', 'l']) {
        const rows = await this.pull(TABLES[kind], st.lastPull[kind]);
        for (const row of rows) {
          const key = kind + ':' + (kind === 'p' ? row.day : row.id);
          consider(key, row.deleted ? null : fromRow[kind](row));
          if (!st.lastPull[kind] || row.updated_at > st.lastPull[kind]) st.lastPull[kind] = row.updated_at;
        }
      }
      {
        const { data, error } = await this.client.from('user_settings').select('*').maybeSingle();
        if (error) throw error;
        if (data && data.updated_at !== st.lastPull.s) { consider('s', { profile: data.profile || null, dayTips: data.day_tips || {} }); st.lastPull.s = data.updated_at; }
      }

      /* 2. Primera sincronización en este dispositivo: evita recetas duplicadas (mismo nombre y contenido) */
      if (st.first) {
        const strip = e => canon({ ...e, id: '', createdAt: 0, fav: false });
        for (const r of S.recipes.slice()) {
          if (base['r:' + r.id]) continue;
          const twin = S.recipes.find(x => x !== r && base['r:' + x.id] && fold(x.name) === fold(r.name) && strip(recipeEntity(x)) === strip(recipeEntity(r)));
          if (!twin) continue;
          S.recipes.splice(S.recipes.indexOf(r), 1);
          for (const items of Object.values(S.plan)) items.forEach(i => { if (i.recipeId === r.id) i.recipeId = twin.id; });
          localChanged = true;
        }
      }
      if (localChanged) { await Store.save(S); render(); }

      /* 3. Subir lo cambiado aquí */
      cur = localEntities(); curFp = new Map([...cur].map(([k, v]) => [k, fingerprint(v)]));
      const up = { r: [], p: [], l: [] }, del = { r: [], p: [], l: [] }, upKeys = [];
      for (const [key, fp] of curFp) {
        if (base[key] === fp) continue;
        if (key === 's') continue;
        const kind = key[0];
        up[kind].push(toRow[kind](cur.get(key), key.slice(2)));
        upKeys.push([key, fp]);
      }
      for (const key of Object.keys(base)) if (key !== 's' && !curFp.has(key)) del[key[0]].push(key.slice(2));
      for (const kind of ['r', 'p', 'l']) {
        const table = TABLES[kind], conflict = kind === 'p' ? 'user_id,day' : 'user_id,id', col = kind === 'p' ? 'day' : 'id';
        for (let i = 0; i < up[kind].length; i += 200) {
          const { error } = await this.client.from(table).upsert(up[kind].slice(i, i + 200), { onConflict: conflict });
          if (error) throw error;
        }
        for (let i = 0; i < del[kind].length; i += 200) {
          const { error } = await this.client.from(table).update({ deleted: true }).in(col, del[kind].slice(i, i + 200));
          if (error) throw error;
        }
      }
      if (base.s !== curFp.get('s')) {
        const e = cur.get('s');
        const { error } = await this.client.from('user_settings').upsert({ user_id: this.user.id, profile: e.profile, day_tips: e.dayTips }, { onConflict: 'user_id' });
        if (error) throw error;
        base.s = curFp.get('s');
      }
      for (const [key, fp] of upKeys) base[key] = fp;
      for (const kind of ['r', 'p', 'l']) for (const id of del[kind]) delete base[kind + ':' + id];

      const wasFirst = st.first;
      st.first = false; st.lastSync = Date.now();
      this.saveState(st);
      this.status = 'ok'; this.error = '';
      if (wasFirst && !quiet) toast(`Sincronizado con la nube: ${S.recipes.length} recetas`);
    } catch (e) {
      this.status = 'error'; this.error = this.msg(e);
      if (!quiet) toast('No se pudo sincronizar: ' + this.error);
    } finally {
      this.syncing = false;
      this.refreshUI();
      if (this.again) { this.again = false; setTimeout(() => this.sync({ quiet: true }), 300); }
    }
  },

  statusText() {
    const st = this.loadState();
    if (this.status === 'unavailable') return 'La nube no está disponible en este dispositivo.';
    if (!this.user) return 'Sin conectar: los datos solo están en este dispositivo.';
    if (this.status === 'syncing') return 'Sincronizando…';
    if (this.status === 'offline') return 'Sin internet: se sincronizará al volver la conexión.';
    if (this.status === 'error') return `Error al sincronizar: ${this.error}`;
    if (st.lastSync) {
      const m = Math.round((Date.now() - st.lastSync) / 60000);
      return m < 1 ? 'Sincronizado ahora mismo.' : `Sincronizado hace ${fmtMin(m)}.`;
    }
    return 'Conectado. Pendiente de la primera sincronización.';
  },
  refreshUI() {
    const el = $('#cloud-status');
    if (el) { el.textContent = this.statusText(); el.dataset.state = this.status; }
    const dot = $('#nav .cloud-dot');
    if (dot) dot.dataset.state = this.user ? this.status : 'off';
    if (ui.view === 'more' && !dlg.open && !document.activeElement?.closest('.cloud-form')) {
      const panel = $('#cloud-panel');
      if (panel && panel.dataset.user !== (this.user?.id || '')) render();
    }
  },
};
