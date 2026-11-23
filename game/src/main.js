// Solmar Bay — the game itself: state, the loop, and the wiring between every system.
//
// One fixed-step simulation (60 steps a second) drives the player, the traffic, the people,
// the law, the fighting and the story; the renderer and the HUD only read what it leaves
// behind. Screens are a thin layer on top: title, help, pause and the end of a run all
// freeze the world and show a menu, and the dialogue box does the same while someone talks.

import { STEP, START_CLOCK_MIN, CLOCK_RATE, TUNING } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer, enterExitCar } from './player.js';
import { seedVehicles, updateTrafficCar } from './vehicles.js';
import { createPed, seedPeds, updatePed } from './pedestrians.js';
import { createWanted, updatePolice, reportCrime } from './police.js';
import { tryPlayerPunch, updateCombat } from './combat.js';
import {
  createMissions, placeGivers, interactWithGiver, updateMissions, STORY,
} from './missions.js';
import { saveGame, loadSave, clearSave } from './save.js';
import { drawWorld, updateFx } from './render.js';
import { drawHUD, drawTitle, drawHelp, drawPause, drawOver, menuLayout } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

window.__gameErrors = [];
window.addEventListener('error', (event) => {
  window.__gameErrors.push(String(event.message ?? event.error ?? 'unknown error'));
  if (statusEl) statusEl.textContent = `error: ${window.__gameErrors[0]}`;
});

const CITY_SEED = 20261123;
const PLAYER_START = { x: 470, y: 1408 };

/** Build the whole game state. The city is fixed by seed; the day's life is not. */
function createGame(seed) {
  const G = {
    city: buildCity(CITY_SEED),
    rng: makeRng(seed),
    time: 0,
    clockMin: START_CLOCK_MIN,
    screen: 'title',
    view: { w: 1280, h: 720 },
    camera: { x: 0, y: 0 },
    cars: [],
    peds: [],
    particles: [],
    skids: [],
    fx: [],
    notes: [],
    dialogue: null,
    menu: null,
    overReason: null,
    helpReturn: 'title',
    input: createInput(canvas),
    audio: createAudio(),
    wanted: createWanted(),
    missions: createMissions(),
  };
  G.player = createPlayer(PLAYER_START.x, PLAYER_START.y);
  G.reportCrime = (kind, x, y, severity) => reportCrime(G, kind, x, y, severity);
  G.notify = (text, color = '#fdf6e3') => {
    G.notes.push({ text, color, t: G.time });
    if (G.notes.length > 4) G.notes.shift();
  };
  G.spawnPed = (x, y) => {
    if (G.peds.length > 110) return null;
    const ped = createPed(G.rng, x, y);
    G.peds.push(ped);
    return ped;
  };
  G.openDialogue = (speaker, lines, onDone) => {
    G.dialogue = { speaker, lines, i: 0, onDone };
  };
  G.save = () => saveGame(G);
  G.endRun = (reason) => endRun(G, reason);
  G.stepWorld = (dt) => stepWorld(G, dt);
  return G;
}

/** Fill a fresh world: traffic, parked cars, the crowd, the givers, a clean record. */
function populateWorld(G) {
  G.cars = [];
  G.peds = [];
  G.particles = [];
  G.skids = [];
  G.fx = [];
  seedVehicles(G);
  seedPeds(G);
  placeGivers(G);
}

/** Start a brand-new story: wipe the save, reset Nico, out into the sun. */
function startNewGame(G) {
  clearSave();
  G.missions = createMissions();
  G.wanted = createWanted();
  G.player = createPlayer(PLAYER_START.x, PLAYER_START.y);
  populateWorld(G);
  G.clockMin = START_CLOCK_MIN;
  G.screen = 'play';
  G.menu = null;
  G.notify('Solmar Bay — follow the gold beacon', '#ffc93c');
  G.save();
}

/** Continue from the save slot, if there is one worth continuing. */
function continueGame(G) {
  const data = loadSave();
  if (!data) { startNewGame(G); return; }
  G.missions = createMissions();
  G.missions.index = Math.min(data.missionIndex ?? 0, STORY.length);
  G.missions.sideDone = data.sideDone ?? 0;
  G.missions.totalEarned = data.totalEarned ?? 0;
  G.wanted = createWanted();
  G.player = createPlayer(data.x ?? PLAYER_START.x, data.y ?? PLAYER_START.y);
  G.player.cash = data.cash ?? 40;
  G.audio.setMuted(Boolean(data.muted));
  populateWorld(G);
  G.clockMin = START_CLOCK_MIN;
  G.screen = 'play';
  G.menu = null;
  G.notify('Welcome back to Solmar Bay', '#ffc93c');
}

/** The day ends — wasted or busted — and the city presents its bill. */
function endRun(G, reason) {
  if (G.screen === 'over') return;
  G.screen = 'over';
  G.overReason = reason;
  if (reason === 'wasted') G.player.cash = Math.floor(G.player.cash * 0.9);
  else G.player.cash = Math.floor(G.player.cash * 0.75);
  G.audio.fail();
}

/** Wake up after a wasted/busted: full health, no heat, standing by the marina. */
function respawn(G) {
  const player = G.player;
  if (player.inCar && player.car) {
    player.car.driver = null;
    player.inCar = false;
    player.car = null;
  }
  player.hp = TUNING.playerMaxHp;
  player.x = 500;
  player.y = 2064;
  G.wanted = createWanted();
  for (const ped of G.peds) {
    if (ped.role === 'officer') { ped.role = 'walker'; ped.state = 'walk'; }
  }
  G.cars = G.cars.filter((c) => c.kind !== 'police');
  G.screen = 'play';
  G.save();
}

/** Put a menu on a screen. */
function setMenu(G, context, items) {
  G.menu = { context, items, selected: 0 };
}

function showTitle(G) {
  G.screen = 'title';
  const items = [{ id: 'new', label: 'New Game' }];
  if (loadSave()) items.push({ id: 'continue', label: 'Continue' });
  items.push({ id: 'help', label: 'How to Play' });
  items.push({ id: 'sound', label: G.audio.muted ? 'Sound: Off' : 'Sound: On' });
  setMenu(G, 'title', items);
}

function showPause(G) {
  G.screen = 'pause';
  setMenu(G, 'pause', [
    { id: 'resume', label: 'Back to the City' },
    { id: 'help', label: 'How to Play' },
    { id: 'sound', label: G.audio.muted ? 'Sound: Off' : 'Sound: On' },
    { id: 'title', label: 'Save & Title Screen' },
  ]);
}

/** Run the selected menu item. */
function activateMenuItem(G, id) {
  G.audio.ensure();
  G.audio.blip(540);
  if (id === 'new') startNewGame(G);
  else if (id === 'continue') continueGame(G);
  else if (id === 'resume') { G.screen = 'play'; G.menu = null; }
  else if (id === 'help') {
    G.helpReturn = G.screen === 'pause' ? 'pause' : 'title';
    G.screen = 'help';
  } else if (id === 'sound') {
    G.audio.setMuted(!G.audio.muted);
    const item = G.menu.items.find((i) => i.id === 'sound');
    if (item) item.label = G.audio.muted ? 'Sound: Off' : 'Sound: On';
    if (G.screen === 'play') G.save();
  } else if (id === 'title') {
    G.save();
    populateWorld(G);
    showTitle(G);
  }
}

/** Menu keys and clicks, for whichever screen is showing one. */
function handleMenuInput(G) {
  const menu = G.menu;
  if (!menu) return;
  const input = G.input;
  if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
    menu.selected = (menu.selected + menu.items.length - 1) % menu.items.length;
    G.audio.blip(300);
  }
  if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
    menu.selected = (menu.selected + 1) % menu.items.length;
    G.audio.blip(300);
  }
  if (input.wasPressed('Enter') || input.wasPressed('Space')) {
    activateMenuItem(G, menu.items[menu.selected].id);
    return;
  }
  if (input.mouse.clicked) {
    const layout = menuLayout(G);
    layout.forEach((item, i) => {
      const m = input.mouse;
      if (m.x >= item.x && m.x <= item.x + item.w && m.y >= item.y && m.y <= item.y + item.h) {
        menu.selected = i;
        activateMenuItem(G, item.id);
      }
    });
  }
}

/** One fixed simulation step of the living city (not menus, not dialogue). */
function stepWorld(G, dt) {
  G.time += dt;
  G.clockMin += dt * CLOCK_RATE;
  G.notes = G.notes.filter((n) => G.time - n.t < 3.2);

  // Talk first: a conversation freezes the street.
  if (G.dialogue) {
    if (G.input.wasPressed('KeyE') || G.input.wasPressed('Enter') || G.input.mouse.clicked) {
      G.input.consume('KeyE');
      G.input.consume('Enter');
      G.input.consumeClick();
      const d = G.dialogue;
      d.i += 1;
      G.audio.blip(500);
      if (d.i >= d.lines.length) {
        G.dialogue = null;
        if (d.onDone) d.onDone();
      }
    }
    updateFx(G, dt);
    return;
  }

  if (G.input.wasPressed('KeyF')) {
    G.input.consume('KeyF');
    enterExitCar(G);
  }
  if (G.input.wasPressed('KeyE') && !G.player.inCar) {
    G.input.consume('KeyE');
    const giver = G.peds.find((p) => p.role === 'giver'
      && Math.hypot(p.x - G.player.x, p.y - G.player.y) < 58);
    if (giver) interactWithGiver(G, giver);
  }
  if (G.input.wasPressed('KeyJ') || (G.input.mouse.clicked && !G.player.inCar)) {
    G.input.consume('KeyJ');
    G.input.consumeClick();
    tryPlayerPunch(G);
  }
  if (G.input.wasPressed('KeyM')) {
    G.input.consume('KeyM');
    G.audio.setMuted(!G.audio.muted);
    G.notify(G.audio.muted ? 'Sound off' : 'Sound on', '#fdf6e3');
  }

  updatePlayer(G, dt);
  for (const car of G.cars) {
    if (car.kind === 'traffic') updateTrafficCar(G, car, dt);
  }
  for (const ped of G.peds) updatePed(G, ped, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  updateMissions(G, dt);
  updateFx(G, dt);

  // The camera leans toward where Nico is heading.
  const focus = G.player;
  const tx = focus.x - G.view.w / 2;
  const ty = focus.y - G.view.h / 2;
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 6);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 6);
  G.camera.x = Math.max(0, Math.min(G.city.width - G.view.w, G.camera.x));
  G.camera.y = Math.max(0, Math.min(G.city.height - G.view.h, G.camera.y));
}

/** Fit the canvas to the window; the world is drawn in CSS pixels. */
function resize(G) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  G.view.w = w;
  G.view.h = h;
}

// --- Boot -----------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') ?? 7);

const G = createGame(Number.isFinite(seedParam) ? seedParam : 7);
resize(G);
window.addEventListener('resize', () => resize(G));
populateWorld(G);
G.camera.x = G.player.x - G.view.w / 2;
G.camera.y = G.player.y - G.view.h / 2;

if (shotName) {
  G.screen = 'play';
  stageShot(G, shotName);
  drawWorld(ctx, G);
  drawHUD(ctx, G);
  window.__shotReady = true;
  // Keep the staged frame on screen for the capture; the world stays frozen.
  const holdFrame = () => {
    drawWorld(ctx, G);
    if (G.screen === 'play') drawHUD(ctx, G);
    requestAnimationFrame(holdFrame);
  };
  requestAnimationFrame(holdFrame);
} else {
  showTitle(G);
  let last = performance.now();
  let acc = 0;
  let titlePan = 0;
  const frame = (now) => {
    const dtReal = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dtReal;

    if (G.screen === 'title') {
      // The city lives behind the title: traffic rolls, people stroll, the camera drifts.
      while (acc >= STEP) {
        acc -= STEP;
        G.time += STEP;
        titlePan += STEP;
        for (const car of G.cars) if (car.kind === 'traffic') updateTrafficCar(G, car, STEP);
        for (const ped of G.peds) updatePed(G, ped, STEP);
        updateFx(G, STEP);
        G.camera.x = 1050 + Math.sin(titlePan * 0.05) * 420 - G.view.w / 2 + 700;
        G.camera.y = 900 + Math.cos(titlePan * 0.037) * 300 - G.view.h / 2 + 500;
        G.camera.x = Math.max(0, Math.min(G.city.width - G.view.w, G.camera.x));
        G.camera.y = Math.max(0, Math.min(G.city.height - G.view.h, G.camera.y));
      }
      handleMenuInput(G);
      drawWorld(ctx, G);
      drawTitle(ctx, G);
    } else if (G.screen === 'help') {
      if (G.input.wasPressed('Escape') || G.input.wasPressed('Enter')) {
        G.screen = G.helpReturn;
        if (G.screen === 'title') showTitle(G);
        else if (G.screen === 'pause') showPause(G);
      }
      drawWorld(ctx, G);
      if (G.helpReturn === 'pause') drawHUD(ctx, G);
      drawHelp(ctx, G);
    } else if (G.screen === 'pause') {
      handleMenuInput(G);
      if (G.input.wasPressed('Escape') || G.input.wasPressed('KeyP')) {
        G.screen = 'play';
        G.menu = null;
      }
      drawWorld(ctx, G);
      drawHUD(ctx, G);
      drawPause(ctx, G);
    } else if (G.screen === 'over') {
      drawWorld(ctx, G);
      drawOver(ctx, G);
      if (G.input.wasPressed('Enter')) respawn(G);
    } else {
      // Playing.
      if (G.input.wasPressed('Escape') || G.input.wasPressed('KeyP')) {
        if (G.dialogue) {
          // Esc does not interrupt a conversation.
        } else {
          showPause(G);
          G.save();
        }
      }
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        acc -= STEP;
        steps += 1;
        stepWorld(G, STEP);
        if (G.screen !== 'play') break;
      }
      if (steps === 5) acc = 0;
      G.audio.update(G);
      drawWorld(ctx, G);
      drawHUD(ctx, G);
    }
    G.input.clearFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

window.__SOLMAR = G;
