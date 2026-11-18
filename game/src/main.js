// Solmar Bay — boot & game loop.
// Creates the shared game state, wires every system together, and runs a
// fixed-step simulation (60 Hz) decoupled from the display rate. Owns the
// screen modes (title, play, pause, busted/wasted, story complete), the
// camera, landmark interactions (gun shop, garage, hospital, safehouse),
// the day/night cycle and screenshot-mode staging.

import {
  WORLD, VIEW, STEP, LANDMARKS
}
from './config.js';
import {
  mulberry32, clamp, dist
}
from './random.js';
import {
  initInput, keys, wasPressed, mouse, endFrameInput
}
from './input.js';
import {
  buildCity, districtAt
}
from './city.js';
import {
  createAudio
}
from './audio.js';
import {
  createPlayer
}
from './player.js';
import {
  updatePlayer, exitCar
}
from './player.js';
import {
  spawnTraffic, updateTrafficCar
}
from './vehicles.js';
import {
  spawnPeds, updatePed
}
from './pedestrians.js';
import {
  giveWeapons, updateCombat
}
from './combat.js';
import {
  addHeat, starsOf, updatePolice, payGarage
}
from './police.js';
import {
  startMission, updateMissions, objectiveTarget, retryMission, updateSide, startRace, beginCurrentStep,   MISSIONS
}
from './missions.js';
import {
  renderWorld
}
from './render.js';
import {
  drawHUD, drawTitle, drawHelp, drawPause, drawEndScreen
}
from './hud.js';
import {
  loadSave, writeSave, clearSave
}
from './save.js';
import {
  shotKey, applyShot
}
from './shots.js';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.w;
canvas.height = VIEW.h;
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1) || 1;
export function createGame() {
  const rng = mulberry32(seed * 1000 + 77);
  const G = {
    rng, seed, time: 0, mode: 'title', city: buildCity(seed), cars: [], peds: [], cops: [], enemies: [],     bullets: [], particles: [], pickups: [], floaters: [], roadblocks: [], skids: [],     player: createPlayer(3920, 1680), camera: {
      x: 3280, y: 1320
    }
    , mouseWorld: {
      x: 0, y: 0
    }
    ,     heat: 0, seenT: 0, spawnCd: 0, lastCrime: null, shake: 0, night: false,     missionIndex: 0, mission: null, banner: null, promptText: '', promptT: 0,     packagesFound: 0, racesWon: 0, fares: 0, taxi: null, race: null, storyDone: false,     titleSel: 0, titleItems: ['Continue', 'New Game', 'How to Play'], showHelp: false,     overKind: null, audio: createAudio(), shotMode: false, shotTick: null,     addHeat(amount, x, y) {
      addHeat(this, amount, x, y);
    }
    ,     prompt(text, t) {
      this.promptText = text;
      this.promptT = t;
    }
    ,     objectiveTarget() {
      return objectiveTarget(this);
    }
    ,     onEnemyDown() {
    }
    ,     onBusted() {
      if (this.mode === 'play') {
        this.overKind = 'BUSTED';
        this.mode = 'over';
        this.audio.jingle(false);
      }
    }
    ,     onWasted() {
      if (this.mode === 'play') {
        this.overKind = 'WASTED';
        this.mode = 'over';
        this.audio.jingle(false);
      }
    }
    ,
  }
  ;
  G.player.weapons = giveWeapons();
  G.cars = spawnTraffic(G);
  G.peds = spawnPeds(G);
  // hidden packages: 10 fixed seeded spots
  const spots = [[500, 500], [1500, 2500], [2900, 600], [4300, 900], [800, 3350], [2100, 3350], [3400, 2900], [1200, 1500], [2600, 2100],     [4500, 2600]];
  for (const [x, y] of spots) G.pickups.push({ kind: 'package', x, y, amount: 0, t: -1e9 });
  return G;
}
const G = createGame();
window.__game = G;
initInput(canvas);
function applySaveData(data) {
  if (!data) return false;
  G.missionIndex = clamp(data.missionIndex || 0, 0, MISSIONS.length);
  G.player.cash = data.cash ?? 120;
  if (Array.isArray(data.weapons)) data.weapons.forEach((a,     i) => { if (G.player.weapons[i] && a !== null && a !== undefined) G.player.weapons[i].ammo = a;
  });
  G.player.weaponIdx = data.weaponIdx || 0;
  G.player.x = data.x || G.player.x;
  G.player.y = data.y || G.player.y;
  G.packagesFound = data.packages || 0;
  G.racesWon = data.racesWon || 0;
  G.fares = data.fares || 0;
  G.storyDone = !!data.storyDone;
  G.pickups = G.pickups.filter((pk) => pk.kind !== 'package' || G.rng() > -1);
  // packages stay collectable per save count display
  return true;
}
const saved = loadSave();
const hasSave = !!saved;
if (!hasSave) G.titleItems = ['New Game', 'How to Play'];
function startPlay(fromSave) {
  if (fromSave) applySaveData(saved);
  G.mode = 'play';
  G.audio.unlock();
  G.prompt(fromSave ? 'Welcome back to Solmar Bay' : 'Find Marisol at the Marina Safehouse', 2.6);
}
function respawn() {
  const p = G.player;
  if (G.overKind === 'BUSTED') {
    p.x = 2560;
    p.y = 1330;
    p.cash = Math.max(0, p.cash - 75);
    G.prompt('Released. $75 in fees & fines.', 2.4);
  } else {
    p.x = 700;
    p.y = 2520;
    const fee = Math.min(p.cash, 60);
    p.cash -= fee;
    G.prompt(`St. Alba patched you up. -$${fee}`, 2.4);
  }
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  p.hp = 100;
  p.dead = false;
  p.arrestT = 0;
  G.heat = 0;
  G.cops = [];
  G.mode = 'play';
}
function landmarkNear() {
  for (const lm of LANDMARKS) if (dist(G.player.x, G.player.y, lm.x, lm.y) < 105) return lm;
  return null;
}
function updateLandmarks() {
  const lm = landmarkNear();
  if (!lm) return;
  const p = G.player;
  if (lm.id === 'gunshop' && !p.car) {
    G.prompt('IRON ROSE ARMS — B: ammo $40 • V: armour $100', 0.25);
    if (wasPressed('KeyB')) {
      if (p.cash >= 40) {
        p.cash -= 40;
        p.weapons[1].ammo += 36;
        p.weapons[2].ammo += 60;
        G.prompt('Ammo stocked', 1.4);
        G.audio.pickup();
      } else G.prompt('Not enough cash', 1.2);
    }
    if (wasPressed('KeyV')) {
      if (p.cash >= 100) {
        p.cash -= 100;
        p.armour = 100;
        G.prompt('Armour fitted', 1.4);
        G.audio.pickup();
      } else G.prompt('Not enough cash', 1.2);
    }
  }
  if (lm.id === 'garage') {
    G.prompt('BAY CITY CUSTOMS — B: clear heat $150', 0.25);
    if (wasPressed('KeyB')) payGarage(G);
  }
  if (lm.id === 'hospital' && p.hp < 100) {
    G.prompt('ST. ALBA — B: heal $30', 0.25);
    if (wasPressed('KeyB') && p.cash >= 30) {
      p.cash -= 30;
      p.hp = 100;
      G.prompt('Patched up', 1.4);
    }
  }
  if (lm.id === 'safehouse' && !G.mission && !G.storyDone) G.prompt('Press ENTER for work', 0.25);
}
function updatePlay(dt) {
  G.time += dt;
  // day / night cycle: roughly every five minutes the bay goes dark for a stretch
  if (!G.shotMode) G.night = (G.time % 300) > 215;
  if (G.skids.length) {
    for (const sk of G.skids) sk.life -= dt;
    G.skids = G.skids.filter((sk) => sk.life > 0);
  }
  updatePlayer(G, dt);
  G.mouseWorld.x = G.camera.x + mouse.x;
  G.mouseWorld.y = G.camera.y + mouse.y;
  for (const c of G.cars) {
    if (c.driver === 'civilian') updateTrafficCar(G, c, dt);
  }
  for (const ped of G.peds) updatePed(G, ped, dt);
  updateCombat(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateSide(G, dt);
  updateLandmarks();
  // mission start / dialogue / retry / banner timers
  if (G.banner) {
    G.banner.t += dt;
    if (G.banner.t > 3.6) G.banner = null;
  }
  if (G.promptT > 0) G.promptT -= dt;
  if (wasPressed('Enter')) {
    if (G.mission?.failed) retryMission(G); else if (G.mission?.state === 'dialogue') {
      const step = G.mission.def.steps[G.mission.stepIdx];
      G.mission.lineIdx++;
      if (G.mission.lineIdx >= step.lines.length) {
        G.mission.lineIdx = 0;
        G.mission.stepIdx++;
        beginCurrentStep(G);
      }
    } else if (!G.mission && !G.storyDone) {
      const lm = landmarkNear();
      if (lm?.id === 'safehouse' || dist(G.player.x, G.player.y, 3920, 1560) < 130) startMission(G, G.missionIndex);
    }
  }
  if (wasPressed('KeyT') && G.player.car && !G.race) {
    startRace(G);
    G.prompt('Race on — hit the teal rings!', 2);
  }
  if (wasPressed('KeyN')) {
    const m = G.audio.toggleMute();
    G.prompt(m ? 'Sound off' : 'Sound on', 1);
  }
  if (wasPressed('KeyP', 'Escape')) G.mode = 'pause';
  // camera follows player with lookahead
  const tx = clamp(G.player.x - VIEW.w / 2, 0, WORLD.w - VIEW.w), ty = clamp(G.player.y - VIEW.h / 2, 0, WORLD.h - VIEW.h);
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);
  if (G.shake > 0) {
    G.camera.x += (G.rng() - 0.5) * G.shake;
    G.camera.y += (G.rng() - 0.5) * G.shake;
  }
  const speed = G.player.car ? Math.abs(G.player.car.speed) : 0;
  G.audio.update(dt, speed, starsOf(G) > 0 && G.cops.length > 0, G.time);
  void districtAt;
}
function updateTitle(dt) {
  G.time += dt;
  G.camera.x = 1400 + Math.sin(G.time * 0.05) * 900;
  G.camera.y = 900 + Math.cos(G.time * 0.037) * 500;
  for (const c of G.cars) if (c.driver === 'civilian') updateTrafficCar(G, c, dt);
  for (const ped of G.peds) updatePed(G, ped, dt);
  if (G.showHelp) {
    if (wasPressed('Enter', 'Escape')) G.showHelp = false;
    return;
  }
  if (wasPressed('ArrowUp', 'KeyW')) G.titleSel = (G.titleSel + G.titleItems.length - 1) % G.titleItems.length;
  if (wasPressed('ArrowDown', 'KeyS')) G.titleSel = (G.titleSel + 1) % G.titleItems.length;
  if (wasPressed('KeyN')) G.audio.toggleMute();
  if (wasPressed('Enter')) {
    const choice = G.titleItems[G.titleSel];
    G.audio.unlock();
    if (choice === 'Continue') startPlay(true); else if (choice === 'New Game') {
      clearSave();
      const fresh = createGame();
      Object.assign(G.player, fresh.player);
      G.player.weapons = giveWeapons();
      G.missionIndex = 0;
      G.storyDone = false;
      G.packagesFound = 0;
      startPlay(false);
    } else if (choice === 'How to Play') G.showHelp = true;
  }
}
function updatePause() {
  if (wasPressed('Enter', 'KeyP', 'Escape')) G.mode = 'play';
  if (wasPressed('KeyS')) {
    writeSave(G);
    G.prompt('Saved', 1.2);
    G.mode = 'play';
  }
  if (wasPressed('KeyM')) G.audio.toggleMute();
}
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  while (acc >= STEP) {
    acc -= STEP;
    if (G.shotMode) {
      G.time += STEP;
      if (G.shotTick) G.shotTick();
    } else if (G.mode === 'title') updateTitle(STEP); else if (G.mode === 'play') updatePlay(STEP); else if (G.mode === 'pause') updatePause(); else if (G.mode === 'over') {
      if (wasPressed('Enter')) respawn();
    } else if (G.mode === 'complete') {
      if (wasPressed('Enter')) {
        G.mode = 'play';
        G.prompt('Solmar Bay is yours — free roam', 2.4);
      }
    }
    endFrameInput();
  }
  ctx.save();
  renderWorld(ctx, G);
  ctx.restore();
  if (G.mode === 'title') {
    renderWorld(ctx, G);
    drawTitle(ctx, G);
  } else if (G.mode === 'pause') {
    drawHUD(ctx, G);
    drawPause(ctx, G);
  } else if (G.mode === 'over') {
    drawHUD(ctx, G);
    drawEndScreen(ctx, G, G.overKind,     G.overKind === 'BUSTED' ? 'Solmar PD got you. Fees paid on release.' : 'St. Alba Hospital patched you up.', '#e63946');
  } else if (G.mode === 'complete') {
    drawHUD(ctx, G);
    drawEndScreen(ctx, G, 'STORY COMPLETE', 'Renzo is done. The bay is yours — free roam, fares & races remain.', '#57cc5e');
  } else drawHUD(ctx, G);
  document.getElementById('status').textContent = `${districtAt(G.player.x, G.player.y)} — $${Math.floor(G.player.cash)} — ${starsOf(G)} stars`;
}
// screenshot staging last, so scenes override the title state
const sk = shotKey();
if (sk) {
  G.shotMode = true;
  G.audio = createAudio();
  applyShot(G, sk);
}
requestAnimationFrame(frame);
void keys;
