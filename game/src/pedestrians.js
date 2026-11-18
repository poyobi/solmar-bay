// Solmar Bay — pedestrians.
// A pooled crowd of thirty walkers wanders the sidewalks, beaches and
// dockyards. Nearby gunfire or a jacking sends them fleeing; a downed
// walker drops a cash pickup. Walkers far from the player are recycled
// to the player's neighbourhood so the streets never feel empty.

// Pedestrians: pooled sidewalk walkers who flee crime and drop cash when downed.
import {
  PED_COLORS
}
from './config.js';
import {
  rngPick, rngRange, clamp, dist
}
from './random.js';
import {
  surfaceAt, collideBuildings
}
from './city.js';
export function spawnPeds(G) {
  const peds = [];
  for (let i = 0; i < 30; i++) peds.push(makePed(G, G.player.x + rngRange(G.rng, -900, 900), G.player.y + rngRange(G.rng, -700, 700)));
  return peds;
}
export function makePed(G, x, y) {
  // nudge onto a sidewalk / walkable surface
  for (let tries = 0; tries < 12; tries++) {
    const s = surfaceAt(x, y);
    if (s === 'sidewalk' || s === 'sand' || s === 'grass' || s === 'dock') break;
    x += rngRange(G.rng, -90, 90);
    y += rngRange(G.rng, -90, 90);
  }
  return {
    x: clamp(x, 40, 4200), y: clamp(y, 40, 3560), angle: G.rng() * 6.28, speed: rngRange(G.rng, 42, 78),     color: rngPick(G.rng, PED_COLORS), hp: 30, alive: true, state: 'walk', panic: 0,
    kind: G.rng() < 0.18 ? 'jogger' : (G.rng() < 0.3 ? 'phone' : 'walker'),     tx: 0, ty: 0, retarget: 0, cashDropped: false, phase: G.rng() * 6.28,
  }
  ;
}
export function updatePed(G, p, dt) {
  if (!p.alive) return;
  p.phase += dt * (p.state === 'flee' ? 13 : 7);
  if (p.panic > 0) p.panic -= dt;
  const crimeNear = G.lastCrime && dist(p.x, p.y, G.lastCrime.x, G.lastCrime.y) < 300 && G.time - G.lastCrime.t < 4;
  if (crimeNear || p.panic > 0) p.state = 'flee'; else if (p.state === 'flee') p.state = 'walk';
  if (p.state === 'flee') {
    const src = G.lastCrime || G.player;
    p.angle = Math.atan2(p.y - src.y, p.x - src.x);
    p.x += Math.cos(p.angle) * 165 * dt;
    p.y += Math.sin(p.angle) * 165 * dt;
  } else {
    p.retarget -= dt;
    if (p.retarget <= 0) {
      p.retarget = rngRange(G.rng, 2, 5);
      p.tx = p.x + rngRange(G.rng, -260, 260);
      p.ty = p.y + rngRange(G.rng, -260, 260);
    }
    if (p.kind === 'jogger') p.speed = 128;
    if (p.kind === 'phone' && G.rng() < dt * 0.1) {
      // phone walkers stop, stare at the screen, then amble on
      p.retarget = Math.max(p.retarget, 0.8);
      return;
    }
    const d = dist(p.x, p.y, p.tx, p.ty);
    if (d > 12) {
      p.angle = Math.atan2(p.ty - p.y, p.tx - p.x);
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
    }
  }
  collideBuildings(p, 10, G.city);
  // run over check
  for (const c of G.cars) {
    if (Math.abs(c.speed) > 90 && dist(p.x, p.y, c.x, c.y) < c.w / 2) {
      hurtPed(G, p, 40, c.driver === 'player');
      break;
    }
  }
  // recycle far peds near the player
  if (dist(p.x, p.y, G.player.x, G.player.y) > 1500) {
    const np = makePed(G, G.player.x + rngRange(G.rng, -800, 800),     G.player.y + rngRange(G.rng, -600, 600));
    Object.assign(p, np);
  }
}
export function hurtPed(G, p, dmg, byPlayer) {
  if (!p.alive) return;
  p.hp -= dmg;
  p.panic = 3;
  if (p.hp <= 0) {
    p.alive = false;
    if (!p.cashDropped) {
      p.cashDropped = true;
      G.pickups.push({ kind: 'cash', x: p.x, y: p.y, amount: 8 + Math.floor(G.rng() * 30), t: 0 });
    }
    if (byPlayer) G.addHeat(0.6, p.x, p.y);
    G.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.4, max: 0.4, color: '#e63946', size: 6, kind: 'flash' });
  }
}
