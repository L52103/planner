/* Actualizaciones: consulta latest.json (publicado con scripts/release.mjs) y avisa si hay una versión nueva.
   Android: descarga el APK nuevo (se instala encima, misma firma). PC/web: indica cómo actualizar. */
'use strict';

const UPDATE_KEY = 'planner.update';
const Updates = {
  url: `${CLOUD_CONFIG.url}/storage/v1/object/public/releases/latest.json`,
  latest: null, checking: false, error: '', lastCheck: 0, dismissed: 0,
  load() {
    try { const s = JSON.parse(localStorage.getItem(UPDATE_KEY)) || {}; this.latest = s.latest || null; this.lastCheck = s.lastCheck || 0; this.dismissed = s.dismissed || 0; } catch {}
  },
  store() { try { localStorage.setItem(UPDATE_KEY, JSON.stringify({ latest: this.latest, lastCheck: this.lastCheck, dismissed: this.dismissed })); } catch {} },
  available() { return !!(this.latest && this.latest.versionCode > APP_VERSION.code); },
  showBanner() { return this.available() && this.dismissed !== this.latest.versionCode; },

  async check({ manual = false } = {}) {
    if (this.checking) return;
    this.checking = true; this.error = '';
    if (manual) this.refresh();
    try {
      const r = await fetch(`${this.url}?t=${Date.now()}`, { cache: 'no-store' });
      if (r.status === 400 || r.status === 404) { this.latest = null; }
      else if (!r.ok) throw new Error('HTTP ' + r.status);
      else {
        const m = await r.json();
        if (!m || !Number.isInteger(m.versionCode) || !m.versionName) throw new Error('respuesta no válida');
        this.latest = m;
      }
      this.lastCheck = Date.now(); this.store();
      if (manual) toast(this.available() ? `Hay una versión nueva: ${this.latest.versionName}` : 'Tienes la última versión');
    } catch (e) {
      this.error = navigator.onLine === false ? 'sin internet' : String(e.message || e);
      if (manual) toast('No se pudo buscar actualizaciones: ' + this.error);
    } finally {
      this.checking = false;
      this.refresh();
    }
  },
  // Revisa al abrir y luego cada 6 horas (y al volver a la app si pasó ese tiempo)
  init() {
    this.load();
    const due = () => Date.now() - this.lastCheck > 6 * 3600 * 1000;
    setTimeout(() => this.check(), 2500);
    setInterval(() => { if (document.visibilityState === 'visible' && due()) this.check(); }, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && due()) this.check(); });
  },
  later() { if (this.latest) { this.dismissed = this.latest.versionCode; this.store(); } this.refresh(); },

  async install() {
    const m = this.latest;
    if (!m) return;
    if (IS_NATIVE) {
      const url = m.android?.url;
      if (!url) return toast('Esta versión no trae APK para Android');
      try {
        if (NP.Browser) await NP.Browser.open({ url });
        else window.open(url, '_system');
        toast('Descargando la actualización. Al terminar, ábrela para instalarla.');
      } catch { toast('No se pudo abrir la descarga'); }
      return;
    }
    openDlg(`${dlgHead(`Actualizar a la versión ${esc(m.versionName)}`, 'Actualizaciones')}
      ${notesList(m)}
      <h3 class="sub-h">En el PC</h3>
      <ol class="howto"><li>Abre una terminal en la carpeta <b>planner</b>.</li><li>Trae la versión nueva:</li></ol>
      <pre class="prompt">git pull</pre>
      <ol class="howto" start="3"><li>Reinicia el servidor y recarga con Ctrl + Shift + R.</li></ol>
      <div class="row"><button class="btn" data-act="updCopyCmd">${ic('copy')}Copiar comando</button>${m.android?.url ? `<a class="btn ghost" href="${esc(m.android.url)}" download>${ic('down')}Descargar APK para Android</a>` : ''}</div>
      <div class="dlg-f"><button class="btn primary" data-act="closeDlg">Cerrar</button></div>`);
  },
  statusText() {
    if (this.checking) return 'Buscando actualizaciones…';
    if (this.error) return `No se pudo comprobar (${this.error}).`;
    if (this.available()) return `Hay una versión nueva: ${this.latest.versionName}.`;
    if (this.lastCheck) { const m = Math.round((Date.now() - this.lastCheck) / 60000); return `Tienes la última versión. Comprobado ${m < 1 ? 'ahora mismo' : `hace ${fmtMin(m)}`}.`; }
    return 'Aún no se ha comprobado.';
  },
  refresh() {
    const st = $('#upd-status'); if (st) st.textContent = this.statusText();
    const host = $('#upd-banner-host'); if (host) host.innerHTML = updateBanner();
    const dot = $('#nav [data-view=more] .pill'); if (dot) dot.classList.toggle('has-update', this.available());
    const gear = $('.appbar [data-view=more]'); if (gear) gear.classList.toggle('has-update', this.available());
  },
};
function notesList(m) {
  const lines = String(m.notes || '').split('\n').map(x => x.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
  return lines.length ? `<ul class="upd-notes">${lines.slice(0, 8).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
}
function updateBanner() {
  if (!Updates.showBanner()) return '';
  const m = Updates.latest;
  return `<section class="upd-banner" role="status">${ic('spark')}
    <div class="grow"><b>Nueva versión ${esc(m.versionName)}</b>${notesList(m)}</div>
    <div class="row"><button class="btn primary sm" data-act="updInstall">${ic('down')}Actualizar</button><button class="btn ghost sm" data-act="updLater">Más tarde</button></div></section>`;
}
