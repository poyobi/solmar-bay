// Solmar Bay — the people on the pavements: neighbours out for a stroll, and how they scatter
// when the day's driving goes wrong.
//
// A pedestrian is a small state machine. Most walk between waypoints on the pavements and
// the beach; a scare (a punch, a crash, a car on the kerb) sends them fleeing; a few are
// fixed faces — the mission givers who stand at their spot all day, and the officers and
// thugs other systems dress them as. This file owns the walking and the fleeing.

import { TUNING } from './config.js';
import { isWalkableAt, collideCircle, randomWalkPoint } from './city.js';
import { makeRng, pick, rrange, clamp, dist } from './random.js';

const SHIRTS = ['#e76f51', '#2a9d8f', '#e9c46a', '#457b9d', '#f4a261', '#8338ec', '#ffafcc', '#90be6d', '#f9f7f7', '#577590'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const PANTS = ['#264653', '#6c757d', '#343a40', '#795548', '#1d3557', '#adb5bd'];

let nextPedId = 1;

/** A fresh pedestrian at a point, in everyday clothes. */
export function createPed(rng, x, y) {
  return {
    id: nextPedId++,
    x, y,
    angle: rrange(rng, 0, Math.PI * 2),
    speed: 0,
    hp: 60,
    role: 'walker',
    state: 'walk',
    tx: x, ty: y,
    waitCd: rrange(rng, 0, 2),
    fleeCd: 0,
    threatX: 0, threatY: 0,
    shirt: pick(rng, SHIRTS),
    skin: pick(rng, SKINS),
    pants: pick(rng, PANTS),
    name: null,
    down: false,
    downCd: 0,
    punchCd: 0,
    stepPhase: rrange(rng, 0, Math.PI * 2),
  };
}

/** Fill the pavements with the starting crowd. */
export function seedPeds(G) {
  for (let i = 0; i < TUNING.pedCount; i += 1) {
    const p = randomWalkPoint(G.rng, G.city, G.city.width / 2, G.city.height / 2, 1500);
    const ped = createPed(G.rng, p.x, p.y);
    ped.tx = p.x; ped.ty = p.y;
    G.peds.push(ped);
  }
}

/** Scare every walker near a point: they run from it, and some of them call it in. */
export function scarePeds(G, x, y, radius, crimeKind) {
  for (const ped of G.peds) {
    if (ped.role !== 'walker' || ped.down) continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.fleeCd = rrange(G.rng, 2.5, 4.5);
      ped.threatX = x;
      ped.threatY = y;
      if (crimeKind && G.rng() < 0.55 && G.reportCrime) G.reportCrime(crimeKind, x, y, 0.7);
    }
  }
}

/** Move one pedestrian one step, by its state. */
export function updatePed(G, ped, dt) {
  if (ped.down) {
    ped.downCd -= dt;
    return;
  }
  if (ped.role === 'giver') {
    // Givers hold their post; they turn to face the player when he is close.
    const d = dist(ped.x, ped.y, G.player.x, G.player.y);
    if (d < 130 && !G.player.inCar) {
      ped.angle = Math.atan2(G.player.y - ped.y, G.player.x - ped.x);
    }
    ped.speed = 0;
    return;
  }
  if (ped.role !== 'walker') return; // officers and thugs are driven by their own systems

  let moveX = 0;
  let moveY = 0;
  let speed = TUNING.pedSpeed;

  if (ped.state === 'flee') {
    ped.fleeCd -= dt;
    const dx = ped.x - ped.threatX;
    const dy = ped.y - ped.threatY;
    const d = Math.hypot(dx, dy) || 1;
    moveX = dx / d;
    moveY = dy / d;
    speed = 196;
    if (ped.fleeCd <= 0) {
      ped.state = 'walk';
      const p = randomWalkPoint(G.rng, G.city, ped.x, ped.y, 260);
      ped.tx = p.x; ped.ty = p.y;
    }
  } else {
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 10 || ped.waitCd > 0) {
      ped.waitCd -= dt;
      if (ped.waitCd <= -rrange(G.rng, 0.5, 2.4)) {
        const p = randomWalkPoint(G.rng, G.city, ped.x, ped.y, 420);
        ped.tx = p.x; ped.ty = p.y;
        ped.waitCd = 0;
      }
      speed = 0;
    } else {
      moveX = dx / d;
      moveY = dy / d;
    }
  }

  if (speed > 0 && (moveX !== 0 || moveY !== 0)) {
    ped.angle = Math.atan2(moveY, moveX);
    let nx = ped.x + moveX * speed * dt;
    let ny = ped.y + moveY * speed * dt;
    // Pavement sense: if the next step leaves walkable ground, slide along or give up.
    if (!isWalkableAt(G.city, nx, ny) && ped.state !== 'flee') {
      if (isWalkableAt(G.city, nx, ped.y)) ny = ped.y;
      else if (isWalkableAt(G.city, ped.x, ny)) nx = ped.x;
      else {
        const p = randomWalkPoint(G.rng, G.city, ped.x, ped.y, 300);
        ped.tx = p.x; ped.ty = p.y;
        nx = ped.x; ny = ped.y;
      }
    }
    const res = collideCircle(G.city, nx, ny, 11);
    ped.x = res.x;
    ped.y = res.y;
    ped.speed = speed;
    ped.stepPhase += dt * speed * 0.11;
  } else {
    ped.speed = 0;
  }

  // Keep the crowd near the action: anyone left far behind re-enters across town.
  const dp = dist(ped.x, ped.y, G.player.x, G.player.y);
  if (dp > 1450) {
    const p = randomWalkPoint(G.rng, G.city, G.player.x, G.player.y, 800);
    ped.x = p.x; ped.y = p.y; ped.tx = p.x; ped.ty = p.y;
    ped.state = 'walk';
  }
}

/** Knock a pedestrian down (they get up again after a while, wiser and angrier). */
export function knockDown(G, ped, fromAngle) {
  if (ped.down) return;
  ped.hp -= 30;
  ped.x += Math.cos(fromAngle) * 14;
  ped.y += Math.sin(fromAngle) * 14;
  if (ped.hp <= 0 || ped.role === 'walker') {
    ped.down = ped.hp <= 0;
    if (ped.down) ped.downCd = 9;
  }
  if (ped.role === 'walker' && !ped.down) {
    ped.state = 'flee';
    ped.fleeCd = 3.4;
    ped.threatX = ped.x - Math.cos(fromAngle) * 30;
    ped.threatY = ped.y - Math.sin(fromAngle) * 30;
  }
}

/** A tiny deterministic RNG for dressing crowds in screenshots, independent of the sim. */
export function dressRng(seed) {
  return makeRng(seed);
}
