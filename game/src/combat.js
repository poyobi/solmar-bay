// Solmar Bay — combat.
// Melee arcs, hitscan pistol and SMG fire with tracer visuals, spread,
// magazines and reloads. Gang enemies seek, keep their distance and fire
// back; everything that falls drops something worth picking up. Particles,
// floaters and screen shake are spawned here and rendered by render.js.

// Combat: melee, hitscan guns with tracers, gang enemies, pickups, particles.
import {
  WEAPONS
}
from './config.js';
import {
  mouse, wasPressed, keys
}
from './input.js';
import {
  clamp, dist, angleTo
}
from './random.js';
import {
  hurtPlayer, weaponOf, startReload
}
from './player.js';
import {
  hurtPed
}
from './pedestrians.js';
import {
  damageCar
}
from './vehicles.js';
export function giveWeapons() {
  return WEAPONS.map((def) => ({ def, ammo: def.ammo === Infinity ? Infinity : def.ammo,     inMag: def.mag === Infinity ? Infinity : def.mag }));
}
export function updateCombat(G, dt) {
  const p = G.player;
  for (const b of G.bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
  for (const pt of G.particles) {
    pt.life -= dt;
    pt.x += (pt.vx || 0) * dt;
    pt.y += (pt.vy || 0) * dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 14);
  updatePickups(G, dt);
  for (const e of G.enemies) updateEnemy(G, e, dt);
  G.enemies = G.enemies.filter((e) => e.alive || e.deathT > -1.2);
  if (p.car) return;
  // shooting from cars is out of scope; driving is the weapon
  if (wasPressed('KeyF')) melee(G);
  const w = weaponOf(p);
  if (!w || w.def.id === 'fists') return;
  const wantFire = w.def.auto ? mouse.down : mouse.clicked;
  if (wantFire && p.fireCd <= 0 && p.reloadT <= 0) fireGun(G);
  if (w.inMag === 0 && wantFire) startReload(G);
}
function melee(G) {
  const p = G.player;
  if (p.fireCd > 0) return;
  p.fireCd = weaponOf(p).def.rate;
  G.audio?.melee();
  const range = 48;
  const tx = p.x + Math.cos(p.aimAngle) * range, ty = p.y + Math.sin(p.aimAngle) * range;
  let hit = false;
  for (const ped of G.peds) if (ped.alive && dist(tx, ty, ped.x, ped.y) < 30) {
    hurtPed(G, ped, 16, true);
    hit = true;
  }
  for (const e of G.enemies) if (e.alive && dist(tx, ty, e.x, e.y) < 32) {
    hurtEnemy(G, e, 16, true);
    hit = true;
  }
  for (const cop of G.cops) if (cop.alive && !cop.inCar && dist(tx, ty, cop.x, cop.y) < 32) {
    hurtCop(G, cop, 16);
    hit = true;
  }
  if (hit) {
    G.addHeat(0.3, p.x, p.y);
    burst(G, tx, ty, '#ffd166', 4);
  }
}
function fireGun(G) {
  const p = G.player, w = weaponOf(p);
  if (w.inMag <= 0) {
    startReload(G);
    return;
  }
  w.inMag--;
  p.fireCd = w.def.rate;
  G.audio?.shot(w.def.id);
  G.shake = Math.max(G.shake, w.def.id === 'smg' ? 1.4 : 2.2);
  G.lastCrime = {
    x: p.x, y: p.y, t: G.time
  }
  ;
  const spread = (G.rng() - 0.5) * 2 * w.def.spread;
  const a = p.aimAngle + spread;
  const bullet = {
    x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * w.def.speed, vy: Math.sin(a) * w.def.speed,     life: w.def.range / w.def.speed, friendly: true, dmg: w.def.dmg
  }
  ;
  // instant hit resolution along the ray (hitscan with tracer visual)
  const hit = rayHit(G, bullet, a, w.def.range, true);
  bullet.life = Math.min(bullet.life, (hit ? hit.d : w.def.range) / w.def.speed);
  G.bullets.push(bullet);
  burst(G, bullet.x, bullet.y, '#ffe08a', 2);
  ejectCasing(G, p.x, p.y, a);
}
export function rayHit(G, bullet, angle, range, friendly) {
  let best = null;
  const consider = (x, y, target, kind) => {
    const d = dist(bullet.x, bullet.y, x, y);
    if (d > range) return;
    const da = Math.abs(Math.atan2(Math.sin(angleTo(bullet.x, bullet.y, x, y) - angle), Math.cos(angleTo(bullet.x, bullet.y, x,       y) - angle)));
    if (da < 0.09 && (!best || d < best.d)) best = {
      d, target, kind, x, y
    }
    ;
  }
  ;
  if (friendly) {
    for (const e of G.enemies) if (e.alive) consider(e.x, e.y, e, 'enemy');
    for (const ped of G.peds) if (ped.alive) consider(ped.x, ped.y, ped, 'ped');
    for (const cop of G.cops) if (cop.alive && !cop.inCar) consider(cop.x, cop.y, cop, 'cop');
    for (const c of G.cars) if (!c.dead) consider(c.x, c.y, c, 'car');
  } else {
    consider(G.player.x, G.player.y, G.player, 'player');
    if (G.player.car) consider(G.player.car.x, G.player.car.y, G.player.car, 'car');
  }
  if (best) {
    if (best.kind === 'enemy') hurtEnemy(G, best.target, bullet.dmg, friendly); else if (best.kind === 'ped') hurtPed(G, best.target, bullet.dmg, friendly); else if (best.kind === 'cop') hurtCop(G, best.target, bullet.dmg); else if (best.kind === 'player') hurtPlayer(G, bullet.dmg); else if (best.kind === 'car') damageCar(G, best.target, bullet.dmg * 0.6, 'shot');
    burst(G, best.x, best.y, '#ff5964', 5);
  }
  return best;
}
export function ejectCasing(G, x, y, angle) {
  // a little brass arc beside the shooter; purely cosmetic, pooled in particles
  const side = angle + Math.PI / 2;
  G.particles.push({
    x, y,
    vx: Math.cos(side) * (40 + G.rng() * 40),
    vy: Math.sin(side) * (40 + G.rng() * 40) - 30,
    life: 0.5, max: 0.5, color: '#e9c46a', size: 2, kind: 'casing',
  });
  // muzzle smoke puff drifting up
  G.particles.push({
    x: x + Math.cos(angle) * 22,
    y: y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * 26,
    vy: Math.sin(angle) * 26 - 14,
    life: 0.45, max: 0.45, color: 'rgba(200,200,200,0.7)', size: 5, kind: 'smoke',
  });
}
export function burst(G, x, y, color, n) {
  for (let i = 0;
  i < n;
  i++) G.particles.push({ x, y, vx: (G.rng() - 0.5) * 190, vy: (G.rng() - 0.5) * 190, life: 0.32, max: 0.32, color, size: 3,   kind: 'spark' });
}
export function spawnEnemy(G, x, y, opts = {}) {
  const e = {
    x, y, angle: 0, hp: opts.hp || 55, alive: true, deathT: 0, fireCd: 1 + G.rng(), color: opts.color || '#6a040f',     name: opts.name || 'Vipers', speed: 148, burstN: 0
  }
  ;
  G.enemies.push(e);
  return e;
}
function updateEnemy(G, e, dt) {
  if (!e.alive) {
    e.deathT -= dt;
    return;
  }
  const p = G.player;
  const d = dist(e.x, e.y, p.x, p.y);
  e.angle = Math.atan2(p.y - e.y, p.x - e.x);
  if (d > 210) {
    e.x += Math.cos(e.angle) * e.speed * dt;
    e.y += Math.sin(e.angle) * e.speed * dt;
  } else if (d < 110) {
    e.x -= Math.cos(e.angle) * e.speed * 0.6 * dt;
    e.y -= Math.sin(e.angle) * e.speed * 0.6 * dt;
  }
  e.fireCd -= dt;
  if (e.fireCd <= 0 && d < 380) {
    e.fireCd = 0.85 + G.rng() * 0.7;
    const a = e.angle + (G.rng() - 0.5) * 0.16;
    const b = {
      x: e.x, y: e.y, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, life: 0.45, friendly: false, dmg: 7
    }
    ;
    rayHit(G, b, a, 360, false);
    G.bullets.push({ ...b, life: 0.3 });
    G.audio?.shot('pistol');
  }
  for (const c of G.cars) if (Math.abs(c.speed) > 110 && dist(e.x, e.y, c.x, c.y) < c.w / 2) hurtEnemy(G, e, 50, c.driver === 'player');
}
export function hurtEnemy(G, e, dmg, byPlayer) {
  if (!e.alive) return;
  e.hp -= dmg;
  burst(G, e.x, e.y, '#e63946', 3);
  if (e.hp <= 0) {
    e.alive = false;
    e.deathT = 0;
    G.pickups.push({ kind: 'cash', x: e.x, y: e.y, amount: 20 + Math.floor(G.rng() * 45), t: 0 });
    if (G.rng() < 0.3) G.pickups.push({ kind: 'ammo', x: e.x + 14, y: e.y, amount: 18, t: 0 });
    if (byPlayer) {
      G.addHeat(0.45, e.x, e.y);
      G.onEnemyDown?.(e);
    }
  }
}
export function hurtCop(G, cop, dmg) {
  cop.hp -= dmg;
  if (cop.hp <= 0 && cop.alive) {
    cop.alive = false;
    G.addHeat(1, cop.x, cop.y);
    G.pickups.push({ kind: 'cash', x: cop.x, y: cop.y, amount: 5, t: 0 });
  }
}
function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    pk.t += dt;
    if (dist(pk.x, pk.y, p.x, p.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        p.cash += pk.amount;
        G.floaters.push({ x: pk.x, y: pk.y - 18, text: `+$${pk.amount}`, t: 0, color: '#7bf1a8' });
        G.audio?.cash();
      } else if (pk.kind === 'ammo') {
        const smg = p.weapons[2];
        if (smg) smg.ammo += pk.amount;
        G.floaters.push({ x: pk.x, y: pk.y - 18, text: '+AMMO', t: 0, color: '#ffd166' });
        G.audio?.pickup();
      } else if (pk.kind === 'health') {
        p.hp = clamp(p.hp + 35, 0, 100);
        G.audio?.pickup();
      } else if (pk.kind === 'armour') {
        p.armour = 100;
        G.audio?.pickup();
      } else if (pk.kind === 'package') {
        G.packagesFound++;
        G.floaters.push({ x: pk.x, y: pk.y - 18, text: `PACKAGE ${G.packagesFound}/10`, t: 0, color: '#f15bb5' });
        G.audio?.jingle(true);
      }
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.taken && pk.t < 90);
  for (const f of G.floaters) {
    f.t += dt;
    f.y -= 32 * dt;
  }
  G.floaters = G.floaters.filter((f) => f.t < 1.1);
  void keys;
}
