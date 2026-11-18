// Solmar Bay — screenshot staging.
// Support for the entry's screenshots: ?shot=<key>&seed=N builds one
// deterministic scene (cover, chase, mission, finale) from the game's own
// systems — real traffic, real police, real missions — then raises
// window.__shotReady once the scene has settled for a few frames.

// Deterministic screenshot staging: ?shot=<key>&seed=N builds a scene, then flags readiness.
import {
  makeCar
}
from './vehicles.js';
import {
  spawnCopCar
}
from './police.js';
import {
  spawnEnemy
}
from './combat.js';
import {
  startMission, beginCurrentStep
}
from './missions.js';
export function shotKey() {
  return new URLSearchParams(location.search).get('shot');
}
export function applyShot(G, key) {
  const p = G.player;
  if (key === 'cover') {
    p.x = 2310;
    p.y = 1335;
    p.car = null;
    p.aimAngle = -0.6;
    startMission(G, 0);
    G.mission.lineIdx = 99;
    advanceDialogueShot(G);
    ensureCrowd(G, p.x, p.y);
  } else if (key === 'chase') {
    const car = makeCar(13, 2240, 1748, 0, { color: '#00bbf9' });
    car.driver = 'player';
    car.speed = 330;
    G.cars.push(car);
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    G.heat = 3.3;
    spawnCopCar(G, car.x - 190, car.y - 60);
    spawnCopCar(G, car.x - 320, car.y + 90);
    spawnCopCar(G, car.x + 260, car.y + 40);
    for (const c of G.cops) if (c.car) {
      c.car.speed = 300;
      c.car.angle = 0;
    }
    ensureCrowd(G, p.x, p.y);
    G.promptText = 'You jacked a Street Racer!';
    G.promptT = 9;
  } else if (key === 'mission') {
    p.x = 2420;
    p.y = 2090;
    p.car = null;
    p.weaponIdx = 2;
    p.aimAngle = 0.4;
    startMission(G, 2);
    G.mission.lineIdx = 99;
    advanceDialogueShot(G);
    spawnEnemy(G, p.x + 150, p.y + 40, {});
    spawnEnemy(G, p.x + 210, p.y - 70, {});
    G.enemies[0].hp = 20;
    G.bullets.push({ x: p.x + 30, y: p.y + 12, vx: 800, vy: 330, life: 0.3, friendly: true, dmg: 10 });
    ensureCrowd(G, p.x, p.y);
  } else if (key === 'finale') {
    G.night = true;
    p.x = 3840;
    p.y = 1620;
    p.car = null;
    p.aimAngle = 2.6;
    G.heat = 2.2;
    G.missionIndex = 4;
    startMission(G, 4);
    G.mission.stepIdx = 3;
    G.mission.state = 'goto';
    // final delivery leg of the heist
    G.banner = {
      title: 'MISSION PASSED', sub: 'Portside Score  •  +$600', t: 1.2
    }
    ;
    for (let i = 0; i < 3; i++) {
      const rb = makeCar(10, 3660 + i * 48, 1740, Math.PI / 2, { police: true, parked: true,       color: '#1b263b' });
      G.cars.push(rb);
      G.roadblocks.push(rb);
    }
    spawnCopCar(G, 3560, 1500);
    ensureCrowd(G, p.x, p.y);
  } else return false;
  G.mode = 'play';
  G.camera.x = Math.max(0, Math.min(4800 - 1280, p.x - 640));
  G.camera.y = Math.max(0, Math.min(3600 - 720, p.y - 360));
  let frames = 0;
  G.shotTick = () => {
    frames++;
    if (frames > 14) window.__shotReady = true;
  }
  ;
  return true;
}
function advanceDialogueShot(G) {
  // skip dialogue into the first action step, with its real setup
  if (G.mission && G.mission.state === 'dialogue') {
    G.mission.stepIdx = 1;
    G.mission.lineIdx = 0;
    beginCurrentStep(G);
  }
}
function ensureCrowd(G, x, y) {
  for (const ped of G.peds.slice(0, 8)) {
    ped.x = x + (G.rng() - 0.5) * 520;
    ped.y = y + (G.rng() - 0.5) * 380;
    ped.alive = true;
  }
  let placed = 0;
  for (const c of G.cars) {
    if (placed >= 5) break;
    if (!c.parked && c.driver === 'civilian') {
      c.x = x + (G.rng() - 0.5) * 700;
      c.y = y + (G.rng() - 0.5) * 120;
      placed++;
    }
  }
}
