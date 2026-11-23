// Solmar Bay — the law: a wanted level that rises with witnessed crime, police cars that
// hunt in proportion to it, officers who pile out when the chase slows down, and the bust
// meter that ends a run when the law is close and the player is slow.
//
// Heat is measured in stars (0 to 5, fractional). Crimes reported through reportCrime add
// heat; hiding from every police unit lets it bleed away. The number of hunting cars is the
// whole-star level, so the city answers a joyrider with one car and a rampage with five.

import { TUNING } from './config.js';
import { randomRoadPoint } from './city.js';
import { createCar, moveCar } from './vehicles.js';
import { clamp, angleDelta, dist } from './random.js';

/** A fresh wanted state: a clean record. */
export function createWanted() {
  return { heat: 0, bust: 0, spawnCd: 0, seenAgo: 99 };
}

/** The whole-star wanted level the HUD draws and the spawner obeys. */
export function wantedLevel(G) {
  return Math.min(5, Math.floor(G.wanted.heat + 0.0001));
}

/**
 * Report a crime at a place. severity is roughly "stars' worth at severity 1"; the caller
 * has already decided a witness was plausible (a scared crowd, a watching officer).
 */
export function reportCrime(G, kind, x, y, severity = 1) {
  const base = { jack: 0.9, crash: 0.3, assault: 0.55, runover: 1.2, shot: 0.8, mission: 0.7 }[kind] ?? 0.4;
  G.wanted.heat = clamp(G.wanted.heat + base * severity, 0, 5.6);
  G.wanted.seenAgo = 0;
  void x; void y;
}

/** Spawn one police car on a road a good way from the player, lights already flashing. */
function spawnCopCar(G) {
  let point = null;
  for (let tries = 0; tries < 12; tries += 1) {
    const p = randomRoadPoint(G.rng, G.city);
    const d = dist(p.x, p.y, G.player.x, G.player.y);
    if (d > 620 && d < 1150) { point = p; break; }
    point = p;
  }
  const car = createCar(point.x, point.y, 0, '#f4f6f7', 'police');
  car.angle = Math.atan2(G.player.y - car.y, G.player.x - car.x);
  G.cars.push(car);
  return car;
}

/** All live police cars. */
export function copCars(G) {
  return G.cars.filter((c) => c.kind === 'police' && !c.wrecked);
}

/** Steer one police car at the player and move it. */
function driveCopCar(G, car, dt) {
  const target = G.player.inCar ? G.player.car : G.player;
  const lead = clamp(dist(car.x, car.y, target.x, target.y) / 300, 0, 0.6);
  const tx = target.x + Math.cos(target.angle ?? 0) * (target.speed ?? 0) * lead * 0.4;
  const ty = target.y + Math.sin(target.angle ?? 0) * (target.speed ?? 0) * lead * 0.4;
  const wanted = Math.atan2(ty - car.y, tx - car.x);
  const delta = angleDelta(car.angle, wanted);
  car.angle += clamp(delta, -2.9 * dt, 2.9 * dt);
  const d = dist(car.x, car.y, target.x, target.y);
  let desired = TUNING.copCarSpeed;
  if (d < 90) desired = Math.max(Math.abs(G.player.inCar ? G.player.car.speed : 0), 120);
  if (Math.abs(delta) > 1.9) desired = 150; // swung wide: slow down and come around
  car.speed += clamp(desired - car.speed, -640 * dt, 420 * dt);
  car.sirenPhase += dt * 11;
  moveCar(G, car, dt);
}

/** One step of the whole law system. */
export function updatePolice(G, dt) {
  const W = G.wanted;
  const level = wantedLevel(G);
  const cops = copCars(G);
  const playerSpeed = G.player.inCar ? Math.abs(G.player.car.speed) : (G.player.moving ? 150 : 0);

  // Being seen keeps the heat on; hiding lets it bleed away.
  let nearestCop = Infinity;
  for (const c of cops) nearestCop = Math.min(nearestCop, dist(c.x, c.y, G.player.x, G.player.y));
  for (const ped of G.peds) {
    if (ped.role === 'officer') nearestCop = Math.min(nearestCop, dist(ped.x, ped.y, G.player.x, G.player.y));
  }
  if (nearestCop < 470) W.seenAgo = 0; else W.seenAgo += dt;
  if (W.seenAgo > 2.5 && W.heat > 0) {
    W.heat = Math.max(0, W.heat - TUNING.wantedDecayPerSec * dt * 3.2);
  }

  // Reinforcements arrive in proportion to the level; when it clears, the hunt is called off.
  W.spawnCd -= dt;
  if (level > 0 && cops.length < level && W.spawnCd <= 0) {
    spawnCopCar(G);
    W.spawnCd = 1.6;
  }
  if (level === 0) {
    for (const c of cops) {
      if (dist(c.x, c.y, G.player.x, G.player.y) > 420) {
        G.cars.splice(G.cars.indexOf(c), 1);
      } else {
        // Called off: they slow down and roll away from the player.
        c.kind = 'traffic';
        c.driver = 'ai';
        c.target = null;
      }
    }
  }

  for (const c of copCars(G)) driveCopCar(G, c, dt);

  // Officers pile out when their car is close and the player is on foot or crawling.
  const officers = G.peds.filter((p) => p.role === 'officer' && !p.down);
  if (!G.player.inCar && level >= 2 && officers.length < 2) {
    const near = copCars(G).find((c) => dist(c.x, c.y, G.player.x, G.player.y) < 150);
    if (near && Math.abs(near.speed) < 190) {
      const officer = G.spawnPed(near.x + 24, near.y + 14);
      if (officer) {
        officer.role = 'officer';
        officer.shirt = '#26547c';
        officer.pants = '#1b2631';
        officer.hp = 90;
      }
    }
  }
  for (const officer of officers) updateOfficer(G, officer, dt);

  // The bust meter: close law plus a slow player is a collar.
  let pressure = 0;
  if (!G.player.inCar) {
    for (const o of officers) if (dist(o.x, o.y, G.player.x, G.player.y) < 34) pressure = 1;
  }
  for (const c of copCars(G)) {
    if (dist(c.x, c.y, G.player.x, G.player.y) < 96 && playerSpeed < 42) pressure = 1;
  }
  if (pressure) W.bust = Math.min(1, W.bust + dt / TUNING.bustFillTime);
  else W.bust = Math.max(0, W.bust - dt / TUNING.bustDrainTime);
  if (W.bust >= 1) G.endRun('busted');
}

/** Chase on foot, grab distance respected, and never volunteer to be run over. */
function updateOfficer(G, officer, dt) {
  const p = G.player;
  const d = dist(officer.x, officer.y, p.x, p.y);
  if (d > 620 || wantedLevel(G) === 0) {
    // The moment has passed: the officer melts back into the crowd.
    officer.role = 'walker';
    officer.state = 'walk';
    officer.shirt = '#577590';
    return;
  }
  if (p.inCar && Math.abs(p.car.speed) > 130 && d < 90) {
    // Step aside from a moving car.
    officer.x -= Math.cos(p.car.angle) * 120 * dt;
    officer.y -= Math.sin(p.car.angle) * 120 * dt;
    return;
  }
  const speed = p.inCar ? 60 : 224;
  const a = Math.atan2(p.y - officer.y, p.x - officer.x);
  officer.angle = a;
  if (d > 24) {
    officer.x += Math.cos(a) * speed * dt;
    officer.y += Math.sin(a) * speed * dt;
    officer.stepPhase += dt * speed * 0.1;
  }
}
