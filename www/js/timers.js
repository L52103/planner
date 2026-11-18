/* Temporizadores: anillo circular estilo reloj, alarma, notificaciones y alarmas nativas. */
'use strict';

let timers = [];
try { timers = JSON.parse(localStorage.getItem('planner.timers') || '[]'); } catch { timers = []; }
const saveTimers = () => { try { localStorage.setItem('planner.timers', JSON.stringify(timers)); } catch {} if (IS_NATIVE) Native.syncTimers(timers); };

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
  if (IS_NATIVE) return; // la notificación nativa ya está programada
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
  if (IS_NATIVE) Native.askNotifications();
  else try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {}
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
// Un "host" muestra anillos; data-only / data-except filtran por etiqueta (el paso actual al cocinar)
const hostTimers = h => timers.filter(t => (!h.dataset.only || t.label === h.dataset.only) && (!h.dataset.except || t.label !== h.dataset.except));
let timerSig = null;
function renderTimers() {
  const sig = timers.map(t => t.id + tState(t)).join(',');
  const hosts = $$('.ring-host');
  if (sig !== timerSig) { timerSig = sig; $('#timers').innerHTML = timers.map(miniBar).join(''); }
  hosts.forEach(h => {
    const list = hostTimers(h), hs = list.map(t => t.id + tState(t)).join(',');
    if (h.dataset.sig !== hs || !h.dataset.sig && !h.dataset.done) {
      h.dataset.sig = hs; h.dataset.done = '1';
      h.innerHTML = list.map(ringCard).join('');
      h.classList.toggle('has', list.length > 0);
      if (h.dataset.onchange === 'cook' && ui.view === 'cook') updateCookTimerZone(list.length > 0);
    }
  });
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
