// Solmar Bay — missions & side content.
// A six-mission story chain (First Wheels, Hot Package, Safe Passage,
// Three Stars, Portside Score, Renzo's Wake) with named characters and
// Enter-advanced dialogue, plus taxi fares, a five-checkpoint race and
// ten hidden packages feeding the completion percentage. Failing any
// mission offers an immediate retry from the same giver.

// Missions: 6-mission story chain with dialogue, checkpoints, plus side content.
import { dist } from './random.js';
import { spawnEnemy } from './combat.js';
import { makeCar } from './vehicles.js';
import { writeSave } from './save.js';

export const CHARACTERS = { marisol: 'Marisol Vega', dex: 'Dex Malone', padre: 'Padre Tomas', kiki: 'Kiki Sol', renzo: 'Renzo Falco' };
export const MISSIONS = [
  { id: 'wheels', title: 'First Wheels', giver: 'marisol', reward: 150, steps: [
    { kind: 'dialogue', lines: [['Marisol Vega', 'You drive, you earn. Simple as the tide, kid.'], ['You', 'Name the job.'],
      ['Marisol Vega', 'Lift that teal Roadster by the marina and bring it to Bay City Customs. No scratches you cannot explain.'], ['Marisol Vega', 'And kid — the bay provides. Just do not drown in it.']] },
    { kind: 'steal', carType: 6, x: 3980, y: 1740, label: 'Steal the teal Roadster' },
    { kind: 'deliverCar', x: 1180, y: 900, label: 'Deliver it to Bay City Customs' } ] },
  { id: 'courier', title: 'Hot Package', giver: 'dex', reward: 220, time: 95, steps: [
    { kind: 'dialogue', lines: [['Dex Malone', 'Package. Docks. Ninety seconds of fame if you are late.'], ['You', 'And if I am on time?'],
      ['Dex Malone', 'Then you are my favourite tide.'], ['You', 'Ninety seconds. Watch me.']] },
    { kind: 'goto', x: 900, y: 3260, label: 'Pick up the package at the docks' },
    { kind: 'goto', x: 2560, y: 1320, label: 'Deliver to the PD back lot — quietly', timed: true } ] },
  { id: 'escort', title: 'Safe Passage', giver: 'padre', reward: 300, steps: [
    { kind: 'dialogue', lines: [['Padre Tomas', 'Kiki sings tonight. The Vipers want her silent.'], ['Kiki Sol', 'I am not scared. Much.'],
      ['Padre Tomas', 'Walk her to the beach stage, child. Keep her breathing.'], ['Kiki Sol', 'Stay close and I will sing at your wedding. Deal?']] },
    { kind: 'escort', x: 4480, y: 1750, fromX: 2400, fromY: 2300, label: 'Escort Kiki to the beach stage' } ] },
  { id: 'escape', title: 'Three Stars', giver: 'marisol', reward: 350, steps: [
    { kind: 'dialogue', lines: [['Marisol Vega', 'The drop went loud. Every badge in Solmar is awake.'], ['You', 'So I run.'],
      ['Marisol Vega', 'So you vanish. Lose the heat, then come home.'], ['You', 'Home. Right. The place with the armed welcome.']] },
    { kind: 'escape', stars: 3, label: 'Lose the 3-star heat, then reach the safehouse', x: 3920, y: 1560 } ] },
  { id: 'heist', title: 'Portside Score', giver: 'dex', reward: 600, steps: [
    { kind: 'dialogue', lines: [['Dex Malone', 'Armoured truck route: docks, downtown vault, marina. Three stops.'], ['You',
      'And roadblocks?'], ['Dex Malone', 'Consider them punctuation.'], ['You', 'Full stops hurt at speed, Dex.'], ['Dex Malone', 'Then do not stop.']] },
    { kind: 'goto', x: 700, y: 3300, label: 'Hit stop 1: dockyard cash cage' },
    { kind: 'goto', x: 2240, y: 1260, label: 'Hit stop 2: downtown vault' },
    { kind: 'goto', x: 3920, y: 1560, label: 'Hit stop 3: marina safehouse', heist: true } ] },
  { id: 'finale', title: 'Renzo’s Wake', giver: 'marisol', reward: 900, steps: [
    { kind: 'dialogue', lines: [['Marisol Vega', 'Renzo Falco stole our pier, our name, our tide.'], ['Renzo Falco',
      'Catch me, little wave!'], ['Marisol Vega', 'Wreck his wagon, then bring yourself home.'], ['You', 'For the bay.'], ['Marisol Vega', 'For the bay.']] },
    { kind: 'chase', label: 'Wreck Renzo’s gang wagon' },
    { kind: 'goto', x: 3920, y: 1560, label: 'Return to the safehouse' } ] },
];
export function currentMission(G) { return MISSIONS[G.missionIndex] || null; }
export function startMission(G, idx) {
  const m = MISSIONS[idx]; if (!m) return;
  G.mission = { def: m, stepIdx: 0, state: 'dialogue', lineIdx: 0, timer: m.time || 0, escort: null, chaseCar: null, failed: false };
  G.banner = { title: m.title, sub: `A job from ${CHARACTERS[m.giver]}`, t: 0 };
  G.audio?.jingle(true);
  beginCurrentStep(G);
}
export function beginCurrentStep(G) {
  const ms = G.mission; if (!ms) return;
  const step = ms.def.steps[ms.stepIdx];
  if (!step) { completeMission(G); return; }
  ms.state = step.kind;
  if (step.kind === 'steal') {
    const car = makeCar(step.carType, step.x, step.y, -Math.PI / 2, { parked: true, color: '#00f5d4' });
    G.cars.push(car); ms.targetCar = car;
  }
  if (step.kind === 'escort') {
    ms.escort = { x: step.fromX, y: step.fromY, hp: 80, alive: true, name: 'Kiki Sol' };
    for (let i = 0; i < 3; i++) spawnEnemy(G, step.fromX + 260 + i * 60, step.fromY + 120, {});
    G.prompt('Protect Kiki — Vipers incoming!', 2.5);
  }
  if (step.kind === 'escape') { G.heat = Math.max(G.heat, 3.05); G.prompt('Lose the heat!', 2); }
  if (step.kind === 'chase') {
    const car = makeCar(11, G.player.x + 420, G.player.y - 200, 0, { gang: true, driver: 'gang', color: '#6a040f' });
    car.ai = { flee: true }; G.cars.push(car); ms.chaseCar = car;
    spawnEnemy(G, car.x + 40, car.y + 60, { name: 'Renzo Falco', hp: 90 });
  }
  if (step.timed || ms.def.time) ms.timer = ms.def.time || ms.timer;
}
export function advanceStep(G) { const ms = G.mission;
if (!ms) return;
ms.stepIdx++;
G.audio?.pickup();
beginCurrentStep(G);
}
export function objectiveText(G) {
  const ms = G.mission;
  if (!ms) return G.storyDone ? 'Story complete — free roam Solmar Bay' : 'Find Marisol at the safehouse for work';
  const step = ms.def.steps[ms.stepIdx];
  if (ms.state === 'dialogue') return 'Press ENTER to talk';
  return step?.label || '';
}
export function objectiveTarget(G) {
  const ms = G.mission; if (!ms) return { x: 3920, y: 1560 };
  const step = ms.def.steps[ms.stepIdx]; if (!step) return null;
  if (step.kind === 'steal') return { x: step.x, y: step.y };
  if (step.kind === 'deliverCar' || step.kind === 'goto' || step.kind === 'escape') return { x: step.x, y: step.y };
  if (step.kind === 'escort') return ms.escort && dist(G.player.x, G.player.y, ms.escort.x, ms.escort.y) > 90 ? { x: ms.escort.x,
    y: ms.escort.y } : { x: step.x, y: step.y };
  if (step.kind === 'chase') return ms.chaseCar ? { x: ms.chaseCar.x, y: ms.chaseCar.y } : null;
  return null;
}
export function updateMissions(G, dt) {
  const ms = G.mission; if (!ms) return;
  const step = ms.def.steps[ms.stepIdx]; if (!step) return;
  if (ms.def.time && ms.state !== 'dialogue') { ms.timer -= dt;
  if (ms.timer <= 0) return failMission(G, 'Out of time');
  }
  const p = G.player;
  if (ms.state === 'dialogue') return; // advanced via Enter in main
  if (ms.state === 'steal') { if (p.car === ms.targetCar) advanceStep(G); }
  else if (ms.state === 'deliverCar') { if (p.car && dist(p.x, p.y, step.x, step.y) < 95) advanceStep(G); }
  else if (ms.state === 'goto') { if (dist(p.x, p.y, step.x, step.y) < (p.car ? 95 : 55)) advanceStep(G); }
  else if (ms.state === 'escort') {
    const e = ms.escort; if (!e) return;
    if (!e.alive) return failMission(G, 'Kiki went down');
    if (dist(e.x, e.y, p.x, p.y) > 46) { const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.x += Math.cos(a) * 196 * dt;
    e.y += Math.sin(a) * 196 * dt;
    }
    for (const en of G.enemies) if (en.alive && dist(en.x, en.y, e.x,
      e.y) < 150 && G.rng() < dt * 0.25) { e.hp -= 9 * dt * 4; if (e.hp <= 0) e.alive = false; }
    if (dist(e.x, e.y, step.x, step.y) < 70 && dist(p.x, p.y, step.x, step.y) < 130) advanceStep(G);
  }
  else if (ms.state === 'escape') { if (G.heat < 0.5 && dist(p.x, p.y, step.x, step.y) < 95) advanceStep(G); }
  else if (ms.state === 'chase') {
    const car = ms.chaseCar;
    if (car) { // flee AI
      const a = Math.atan2(car.y - p.y, car.x - p.x);
      car.angle += (((a - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * dt * 1.4;
      car.speed = Math.min(330, (car.speed || 0) + 180 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt; car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.dead) advanceStep(G);
    }
  }
}
export function failMission(G, why) {
  if (!G.mission || G.mission.failed) return;
  G.mission.failed = true; G.banner = { title: 'MISSION FAILED', sub: why + ' — press ENTER to retry', t: 0 };
  G.audio?.jingle(false);
}
export function retryMission(G) { const idx = G.missionIndex;
G.mission = null;
G.enemies = [];
startMission(G, idx);
}
function completeMission(G) {
  const m = G.mission.def;
  G.player.cash += m.reward;
  G.banner = { title: 'MISSION PASSED', sub: `${m.title}  •  +$${m.reward}`, t: 0 };
  G.audio?.jingle(true);
  if (m.id === 'wheels') G.player.weapons[1].ammo += 24;
  if (m.id === 'courier') G.player.weapons[2].ammo += 60;
  if (m.id === 'heist') G.player.armour = 100;
  G.mission = null; G.missionIndex++;
  if (G.missionIndex >= MISSIONS.length) { G.storyDone = true; G.mode = 'complete'; }
  writeSave(G);
}
// Side content helpers -------------------------------------------------------
export function updateSide(G, dt) {
  // taxi fare: pick up a flagged ped, drop at marker
  if (!G.taxi) {
    if (G.rng() < dt * 0.02 && G.player.car) { const ped = G.peds.find((x) => x.alive);
    if (ped) G.taxi = { ped, x: 600 + G.rng() * 3400, y: 300 + G.rng() * 2800, stage: 'pickup' };
    }
  } else if (G.taxi.stage === 'pickup' && G.player.car && dist(G.player.x, G.player.y, G.taxi.ped.x,
    G.taxi.ped.y) < 70) { G.taxi.stage = 'drop';
  G.prompt('Fare aboard — follow the yellow marker', 2);
  }
  else if (G.taxi?.stage === 'drop' && dist(G.player.x, G.player.y, G.taxi.x,
    G.taxi.y) < 90) { const fare = 40 + Math.floor(G.rng() * 50);
  G.player.cash += fare;
  G.fares = (G.fares || 0) + 1;
  G.floaters.push({ x: G.player.x, y: G.player.y - 24, text: `FARE +$${fare}`, t: 0, color: '#ffd60a' });
  G.taxi = null;
  }
  // checkpoint race
  if (G.race) {
    G.race.t -= dt;
    const cp = G.race.cps[G.race.idx];
    if (cp && dist(G.player.x, G.player.y, cp.x, cp.y) < 100) { G.race.idx++;
    G.audio?.pickup();
    if (G.race.idx >= G.race.cps.length) { G.player.cash += 200;
    G.racesWon = (G.racesWon || 0) + 1;
    G.banner = { title: 'RACE WON', sub: '+$200', t: 0 };
    G.race = null;
    } }
    else if (G.race && G.race.t <= 0) { G.prompt('Race timed out', 1.6); G.race = null; }
  }
}
export function startRace(G) {
  const cps = []; let x = G.player.x, y = G.player.y;
  for (let i = 0; i < 5; i++) { x += (G.rng() - 0.3) * 900; y += (G.rng() - 0.5) * 800; x = Math.max(200, Math.min(4400,
    x)); y = Math.max(200, Math.min(3400, y)); cps.push({ x, y }); }
  G.race = { cps, idx: 0, t: 75 };
}
