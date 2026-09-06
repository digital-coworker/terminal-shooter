import {Game} from '../src/engine.js';
import {render, palettes} from '../src/render.js';
import {FlightControls, HighScore} from './controller.js';
import {Music} from './music.js';
const music = new Music(
  () => new (window.AudioContext || window.webkitAudioContext)(),
  async () => (await import('../src/audio.js')).createWav()
);

const $ = id => document.getElementById(id);
const game = new Game();
const controls = new FlightControls();
let storage;
try { storage = window.localStorage; } catch { /* Storage is optional. */ }
const best = new HighScore(storage);
const screen = $('screen');
const context = screen.getContext('2d');
let started = false;
let lastTime = 0;
let previousState = '';
let theme = 'dark';
if (new URLSearchParams(location.search).get('test') === '1') window.__game = game;

function paint() {
  const palette = palettes[theme];
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  if (screen.width !== 1024 * ratio || screen.height !== 600 * ratio) {
    screen.width = 1024 * ratio; screen.height = 600 * ratio;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = palette.bg;
  context.fillRect(0, 0, 1024, 600);
  context.font = '17px "SFMono-Regular", Consolas, "Liberation Mono", monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const cells = render(game);
  cells.forEach((row, y) => row.forEach((cell, x) => {
    if (cell.ch === ' ') return;
    context.fillStyle = palette[cell.role] || palette.text;
    context.fillText(cell.ch, x * 16 + 8, y * 20 + 10);
  }));
}
function sync() {
  const state = started ? game.state : 'ready';
  $('best').textContent = String(best.value).padStart(6, '0');
  if (state === previousState) return;
  previousState = state;
  $('overlay').hidden = state === 'playing';
  $('status').textContent = {ready:'SYSTEM READY',playing:'RUN ACTIVE',paused:'RUN PAUSED',gameover:'SIGNAL LOST'}[state] || state.toUpperCase();
  $('flight-note').textContent = state === 'playing' ? 'KEEP MOVING / STAY ALIVE' : state === 'ready' ? 'AWAITING PILOT' : 'FLIGHT RECORDER SAVED';
  $('pause').innerHTML = `<kbd>P</kbd> ${state === 'paused' ? 'Resume' : 'Pause'}`;
  if (state === 'paused' || state === 'gameover') {
    $('overlay-kicker').textContent = state === 'paused' ? 'FLIGHT ON HOLD' : 'TRANSMISSION ENDED';
    $('overlay-title').textContent = state === 'paused' ? 'Take a breath.' : 'One more run?';
    $('overlay-copy').textContent = state === 'paused' ? 'Your ship is safe. Resume when ready.' : `Score ${game.score} / Level ${game.level}. The next run is yours.`;
    $('play').innerHTML = `${state === 'paused' ? 'Resume run' : 'Try again'} <span aria-hidden="true">↵</span>`;
  }
}
function launch() {
  if (game.state === 'gameover') game.reset();
  if (game.state === 'paused') game.togglePause();
  started = true;
  controls.clear();
  lastTime = performance.now();
  sync(); screen.focus({preventScroll:true});
}
function pause() {
  if (!started || game.state === 'gameover') return;
  game.togglePause(); controls.clear(); sync();
}
function restart() { best.record(game.score); game.reset(); launch(); }
function toggleFire() {
  controls.toggleFire();
  $('fire').setAttribute('aria-pressed', String(controls.autofire));
  $('fire').querySelector('.value').textContent = controls.autofire ? 'on' : 'off';
}
function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  $('theme').setAttribute('aria-pressed', String(theme === 'light'));
  $('theme').innerHTML = `<kbd>T</kbd> ${theme === 'dark' ? 'Light' : 'Dark'}`;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#101415' : '#f0f0e9';
  paint();
}
function unfocus() {
  controls.clear();
  if (started && game.state === 'playing') pause();
}
$('play').addEventListener('click', launch);
$('pause').addEventListener('click', pause);
$('restart').addEventListener('click', restart);
$('fire').addEventListener('click', toggleFire);
$('theme').addEventListener('click', toggleTheme);
async function toggleMusic() {
  try {
    await music.toggle();
    $('music').setAttribute('aria-pressed', String(music.enabled));
    $('music').querySelector('.value').textContent = music.enabled ? 'on' : 'off';
  } catch {
    $('music').querySelector('.value').textContent = 'unavailable';
    $('music').setAttribute('aria-pressed', 'false');
    $('music').title = 'Audio is unavailable in this browser. The game still works.';
  }
}
$('music').addEventListener('click', toggleMusic);
const actions = {p:pause,r:restart,' ':toggleFire,t:toggleTheme,m:toggleMusic};
const movementKeys = new Set(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown']);
window.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();
  // Native button keyboard activation must remain usable.
  if ((key === ' ' || key === 'enter') && event.target.closest?.('button')) return;
  if (movementKeys.has(key)) { event.preventDefault(); controls.key(key, true); }
  if (actions[key]) { event.preventDefault(); if (!event.repeat) actions[key](); }
  if (key === 'enter' && !event.repeat && (!started || game.state !== 'playing')) launch();
});
window.addEventListener('keyup', event => controls.key(event.key, false));
window.addEventListener('blur', unfocus);
document.addEventListener('visibilitychange', () => { if (document.hidden) unfocus(); });
let dragOrigin = null;
screen.addEventListener('pointerdown', event => {
  if (!started || game.state !== 'playing') return;
  event.preventDefault();
  screen.setPointerCapture(event.pointerId);
  dragOrigin = {x:event.clientX,y:event.clientY,id:event.pointerId};
  screen.focus({preventScroll:true});
});
screen.addEventListener('pointermove', event => {
  if (dragOrigin?.id === event.pointerId) controls.drag(event.clientX - dragOrigin.x, event.clientY - dragOrigin.y);
});
for (const name of ['pointerup','pointercancel','lostpointercapture']) screen.addEventListener(name, () => { dragOrigin = null; controls.clear(); });
for (const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    controls.key(button.dataset.key, true);
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name, () => controls.key(button.dataset.key, false));
}
function frame(now) {
  const dt = Math.min(Math.max((now - lastTime) / 1000, 0), .05);
  lastTime = now;
  if (started && game.state === 'playing') game.update(dt, controls.input());
  best.record(game.score); sync(); paint();
  requestAnimationFrame(frame);
}
sync();
requestAnimationFrame(frame);
