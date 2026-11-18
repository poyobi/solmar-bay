// Solmar Bay — wanted & police.
// Crimes add heat only in proportion to how witnessed they were. Stars
// scale the response from two pursuit cars to roadblocks and foot
//  officers who bail out and shoot. Lose line of sight long enough and
// heat decays; get cornered while slow and the bust meter fills.

// Police & wanted: heat, stars, pursuit cars, foot officers, roadblocks, bust/wasted.
import {
  WANTED
}
from './config.js';
import {
  clamp, dist
}
from './random.js';
import {
  makeCar, updateCarPhysics, damageCar
}
from './vehicles.js';
import {
  hurtPlayer
}
from './player.js';
export function addHeat(G, amount, x, y) {
  // witnessed? a ped or cop within 260 makes it count fully, else partial
  let witnessed = false;
  for (const ped of G.peds) if (ped.alive && dist(ped.x, ped.y, x, y) < 260) {
    witnessed = true;
    break;
  }
  if (!witnessed) for (const cop of G.cops) if (cop.alive && dist(cop.x, cop.y, x, y) < 340) {
    witnessed = true;
    break;
  }
  G.heat = clamp(G.heat + amount * (witnessed ? 1 : 0.35), 0, 5.99);
  G.lastCrime = {
    x, y, t: G.time
  }
  ;
  G.seenT = 0;
}
export function starsOf(G) {
  return Math.floor(G.heat);
}
export function spawnCopCar(G, x, y) {
  const car = makeCar(10, x, y, 0, { police: true, driver: 'police', color: '#1b263b' });
  car.ai = {
    cop: true
  }
  ;
  G.cars.push(car);
  const cop = {
    x, y, hp: 60, alive: true, inCar: car, fireCd: 1.5, car
  }
  ;
  G.cops.push(cop);
  return car;
}
export function desiredCops(G) {
  const s = starsOf(G);
  return s === 0 ? 0 : [0, 2, 3, 4, 5, 6][s];
}
export function updatePolice(G, dt) {
  const p = G.player, s = starsOf(G);
  // line of sight tracking for decay
  let seen = false;
  for (const cop of G.cops) if (cop.alive && dist(cop.x, cop.y, p.x, p.y) < 520) seen = true;
  if (seen) G.seenT = 0; else G.seenT += dt;
  if (s > 0 && G.seenT > WANTED.decay) {
    G.heat = Math.max(0, G.heat - dt * 0.14);
    if (G.heat < s) G.prompt('You lost the heat… lay low', 1.6);
  }
  // spawn / despawn
  const want = desiredCops(G);
  const active = G.cops.filter((c) => c.alive);
  if (active.length < want && G.spawnCd <= 0) {
    G.spawnCd = 2.2;
    const a = G.rng() * Math.PI * 2, d = 620;
    spawnCopCar(G, clamp(p.x + Math.cos(a) * d, 60, 4740), clamp(p.y + Math.sin(a) * d, 60, 3540));
  }
  G.spawnCd -= dt;
  if (s === 0) {
    for (const cop of G.cops) {
      cop.alive = false;
      if (cop.car) {
        cop.car.driver = null;
        cop.car.police = false;
        cop.car.ai = null;
      }
    }
    G.cops = [];
    clearRoadblocks(G);
  }
  // roadblocks at 3+ stars
  if (s >= 3 && G.roadblocks.length === 0 && G.rng() < dt * 0.25) makeRoadblock(G);
  for (const cop of [...G.cops]) updateCop(G, cop, dt);
  G.cops = G.cops.filter((c) => c.alive || c.inCar);
  // arrest: cop close + player slow/on foot
  if (s > 0 && !p.car) {
    let near = false;
    for (const cop of G.cops) if (cop.alive && !cop.inCar && dist(cop.x, cop.y, p.x, p.y) < 44) near = true;
    if (near) {
      p.arrestT += dt;
      if (p.arrestT > 1.6) G.onBusted();
    } else p.arrestT = Math.max(0, p.arrestT - dt * 2);
  } else if (p.car && Math.abs(p.car.speed) < 14 && s > 0) {
    let near = false;
    for (const cop of G.cops) if (cop.alive && dist(cop.x, cop.y, p.x, p.y) < 90) near = true;
    if (near) {
      p.arrestT += dt;
      if (p.arrestT > 2) G.onBusted();
    } else p.arrestT = Math.max(0, p.arrestT - dt * 2);
  } else p.arrestT = 0;
}
function updateCop(G, cop, dt) {
  const p = G.player;
  if (!cop.alive) return;
  if (cop.inCar) {
    const car = cop.inCar;
    cop.x = car.x;
    cop.y = car.y;
    if (car.dead) {
      cop.inCar = null;
      car.driver = null;
      return;
    }
    const d = dist(car.x, car.y, p.x, p.y);
    const targetA = Math.atan2(p.y - car.y, p.x - car.x);
    let steer = clamp(((targetA - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1) * 1.6;
    const wantRam = d > 60;
    updateCarPhysics(G, car, dt, { throttle: wantRam ? 1 : -0.3, steer, brake: d < 46 });
    if (d < 120 && p.car && Math.abs(p.car.speed) < 20 && G.rng() < dt * 0.4) {
      cop.inCar = null;
      car.driver = null;
      car.speed = 0;
      cop.x = car.x + 30;
      cop.y = car.y;
    }
    if (d > 1500) {
      cop.alive = false;
      car.driver = null;
      G.cars = G.cars.filter((c) => c !== car);
    }
    return;
  }
  // on foot: chase and shoot at 2+ stars
  const d = dist(cop.x, cop.y, p.x, p.y);
  cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
  if (d > 54) {
    cop.x += Math.cos(cop.angle) * 172 * dt;
    cop.y += Math.sin(cop.angle) * 172 * dt;
  }
  cop.fireCd -= dt;
  if (starsOf(G) >= 2 && cop.fireCd <= 0 && d < 330 && d > 60) {
    cop.fireCd = 1.1 + G.rng() * 0.8;
    if (G.rng() < 0.42) hurtPlayer(G, 6);
    G.bullets.push({ x: cop.x, y: cop.y, vx: Math.cos(cop.angle) * 700, vy: Math.sin(cop.angle) * 700, life: 0.28, friendly: false,       dmg: 6 });
  }
  if (d > 1600) cop.alive = false;
}
function makeRoadblock(G) {
  const p = G.player;
  const bx = clamp(p.x + (G.rng() - 0.5) * 700, 200, 4600), by = clamp(p.y + (G.rng() - 0.5) * 500, 200, 3400);
  for (let i = 0; i < 3; i++) {
    const car = makeCar(10, bx + i * 46 - 46, by, Math.PI / 2, { police: true, parked: true, color: '#1b263b' });
    G.cars.push(car);
    G.roadblocks.push(car);
  }
  G.prompt('Roadblock ahead!', 1.8);
}
export function clearRoadblocks(G) {
  for (const c of G.roadblocks) {
    c.police = false;
  }
  G.roadblocks = [];
}
export function payGarage(G) {
  const cost = WANTED.garageCost;
  if (G.player.cash >= cost && G.heat > 0) {
    G.player.cash -= cost;
    G.heat = 0;
    G.prompt('Bay City Customs resprayed you — heat cleared', 2.2);
    return true;
  }
  G.prompt(G.heat <= 0 ? 'No heat to clear' : `Need $${cost} to clear heat`, 1.6);
  return false;
}
export {
  damageCar
}
;
