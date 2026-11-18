// Solmar Bay — the player.
// On foot: WASD movement, sprint, mouse aim, car entry and theft (parked
// cars may be locked; moving cars are jacked and their drivers flee).
// In a car: the shared vehicle physics with handbrake and horn. Damage
// flows through armour first; hitting zero hands over to the Wasted flow.

// Player: on-foot movement, car entry/theft, driving controls, damage & respawn.
import {
  PLAYER_TUNE, WORLD
}
from './config.js';
import {
  keys, moveAxis, wasPressed
}
from './input.js';
import {
  clamp, dist
}
from './random.js';
import {
  collideBuildings, surfaceAt
}
from './city.js';
import {
  nearestCar, updateCarPhysics
}
from './vehicles.js';
export function createPlayer(x, y) {
  return {
    x, y, angle: 0, hp: PLAYER_TUNE.hp, armour: 0, cash: 120, car: null,     weapons: null, weaponIdx: 0, fireCd: 0, reloadT: 0, dead: false, arrestT: 0,     walkPhase: 0, hurtFlash: 0, godShot: false,
  }
  ;
}
export function weaponOf(p) {
  return p.weapons[p.weaponIdx];
}
export function hurtPlayer(G, dmg) {
  const p = G.player;
  if (p.dead || G.mode !== 'play') return;
  let rest = dmg;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, rest * 0.7);
    p.armour -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  p.hurtFlash = 0.35;
  G.shake = Math.max(G.shake, 3);
  G.audio?.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    G.onWasted();
  }
}
export function updatePlayer(G, dt) {
  const p = G.player;
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) finishReload(G);
  }
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
  if (p.car) {
    updateDriving(G, dt);
    return;
  }
  const ax = moveAxis();
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const spd = sprint ? PLAYER_TUNE.sprint : PLAYER_TUNE.speed;
  if (ax.active) {
    p.x += ax.x * spd * dt;
    p.y += ax.y * spd * dt;
    p.angle = Math.atan2(ax.y, ax.x);
    p.walkPhase += dt * (sprint ? 13 : 9);
    if (surfaceAt(p.x, p.y) === 'water') {
      p.x -= ax.x * spd * dt;
      p.y -= ax.y * spd * dt;
    }
  }
  collideBuildings(p, PLAYER_TUNE.radius, G.city);
  p.x = clamp(p.x, 16, WORLD.w - 16);
  p.y = clamp(p.y, 16, WORLD.h - 16);
  // aim follows mouse in world space
  p.aimAngle = Math.atan2(G.mouseWorld.y - p.y, G.mouseWorld.x - p.x);
  if (wasPressed('KeyE')) tryEnterCar(G);
  if (wasPressed('Digit1')) selectWeapon(G, 0);
  if (wasPressed('Digit2')) selectWeapon(G, 1);
  if (wasPressed('Digit3')) selectWeapon(G, 2);
  if (wasPressed('KeyR')) startReload(G);
}
function selectWeapon(G, i) {
  if (G.player.weapons[i]) {
    G.player.weaponIdx = i;
    G.player.reloadT = 0;
  }
}
export function startReload(G) {
  const p = G.player, w = weaponOf(p);
  if (!w || w.mag === Infinity || w.inMag >= w.mag || w.ammo <= 0 || p.reloadT > 0) return;
  p.reloadT = w.def.reload;
  G.audio?.cash();
}
export function finishReload(G) {
  const p = G.player, w = weaponOf(p);
  const need = w.def.mag - w.inMag, take = Math.min(need, w.ammo);
  w.inMag += take;
  w.ammo -= take;
}
export function tryEnterCar(G) {
  const p = G.player;
  const car = nearestCar(G, p.x, p.y, 62);
  if (!car) return;
  if (car.locked && car.parked) {
    G.prompt('Locked — find another ride', 1.4);
    G.audio?.thud();
    return;
  }
  if (car.driver === 'civilian' && !car.parked) {
    // yank driver out: they flee, heat if witnessed
    G.addHeat(0.5, car.x, car.y);
    for (const ped of G.peds) if (dist(ped.x, ped.y, car.x, car.y) < 60 && ped.alive) {
      ped.panic = 4;
    }
    car.driver = null;
    car.ai = null;
    G.prompt('Car jacked!', 1.2);
  } else if (car.parked) {
    if (G.rng() < 0.5) G.addHeat(0.3, car.x, car.y);
    car.parked = false;
  }
  car.driver = 'player';
  p.car = car;
  G.audio?.door?.();
  p.x = car.x;
  p.y = car.y;
  G.audio?.unlock();
}
export function exitCar(G) {
  const p = G.player, car = p.car;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  collideBuildings(p, PLAYER_TUNE.radius, G.city);
}
function updateDriving(G, dt) {
  const p = G.player, car = p.car;
  let steer = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
  let throttle = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) throttle = 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) throttle = -1;
  const brake = keys.has('Space');
  updateCarPhysics(G, car, dt, { throttle, steer, brake });
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.aimAngle = Math.atan2(G.mouseWorld.y - p.y, G.mouseWorld.x - p.x);
  if (wasPressed('KeyE')) exitCar(G);
  if (wasPressed('KeyH')) G.audio?.horn();
  if (Math.abs(car.speed) > 200 && G.rng() < dt * 0.5) G.audio?.update(0, Math.abs(car.speed), false, G.time);
}
