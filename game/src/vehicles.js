// Solmar Bay — vehicles.
// One arcade physics step serves the player, traffic, police and the finale
// target: throttle, brake/reverse, speed-sensitive steering, handbrake
// drift with skid marks, building and car-to-car collision, and a damage
// model that smokes, then wrecks. Traffic adds lane keeping, obstacle
// braking, panic flight and intersection turns on top of the same step.

// Vehicles: catalogue spawning, arcade physics, traffic lane AI, damage.
import {
  CAR_TYPES, ROADS, WORLD
}
from './config.js';
import {
  mulberry32, rngPick, rngRange, clamp, wrapAngle, dist
}
from './random.js';
import {
  nearestRoadX, nearestRoadY, collideBuildings
}
from './city.js';
export function makeCar(typeIdx, x, y, angle, opts = {}) {
  const t = CAR_TYPES[typeIdx];
  return {
    type: typeIdx, name: t.name, w: t.w, h: t.h, x, y, angle, speed: 0,     color: opts.color || t.colors[0], hp: t.hp, maxHp: t.hp, driver: opts.driver ?? null,     parked: !!opts.parked, locked: !!opts.locked, police: !!opts.police, gang: !!opts.gang,     ai: opts.ai || null, steer: 0, smoke: 0, dead: false, doorOpen: 0, sirenPhase: Math.random() * 6,
  }
  ;
}
export function carCorners(c) {
  const cos = Math.cos(c.angle), sin = Math.sin(c.angle), hw = c.w / 2, hh = c.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([lx, ly]) => ({ x: c.x + lx * cos - ly * sin,     y: c.y + lx * sin + ly * cos }));
}
export function pointInCar(px, py, c) {
  const cos = Math.cos(-c.angle), sin = Math.sin(-c.angle);
  const dx = px - c.x, dy = py - c.y;
  const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
  return Math.abs(lx) <= c.w / 2 && Math.abs(ly) <= c.h / 2;
}
export function spawnTraffic(G) {
  const rng = G.rng;
  const cars = [];
  const target = 22;
  for (let i = 0; i < target; i++) {
    const vertical = rng() < 0.5;
    const typeIdx = Math.floor(rng() * 10);
    // civilian types only
    let x, y, angle, dir;
    if (vertical) {
      const cx = rngPick(rng, ROADS.vx);
      dir = rng() < 0.5 ? 1 : -1;
      x = cx + (dir > 0 ? -22 : 22);
      y = rngRange(rng, 100, WORLD.h - 100);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const cy = rngPick(rng, ROADS.hy);
      dir = rng() < 0.5 ? 1 : -1;
      y = cy + (dir > 0 ? 22 : -22);
      x = rngRange(rng, 100, 4100);
      angle = dir > 0 ? 0 : Math.PI;
    }
    const c = makeCar(typeIdx, x, y, angle, { driver: 'civilian', color: rngPick(rng, CAR_TYPES[typeIdx].colors), ai: { vertical, dir,       lane: 22, cruise: rngRange(rng, 120, 200), panic: 0 } });
    c.speed = c.ai.cruise * 0.7;
    cars.push(c);
  }
  // parked cars along roads
  for (let i = 0; i < 26; i++) {
    const typeIdx = Math.floor(rng() * CAR_TYPES.length - 0.01) % 10;
    const onV = rng() < 0.5;
    let x, y, angle;
    if (onV) {
      const cx = rngPick(rng, ROADS.vx);
      x = cx + (rng() < 0.5 ? -52 : 52);
      y = rngRange(rng, 120, WORLD.h - 120);
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const cy = rngPick(rng, ROADS.hy);
      y = cy + (rng() < 0.5 ? -48 : 48);
      x = rngRange(rng, 120, 4100);
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    cars.push(makeCar(typeIdx, x, y, angle, { parked: true, locked: rng() < 0.3, color: rngPick(rng, CAR_TYPES[typeIdx].colors) }));
  }
  return cars;
}
export function damageCar(G, car, amount, cause) {
  if (car.dead) return;
  car.hp -= amount;
  car.smoke = clamp(1 - car.hp / car.maxHp, 0, 1);
  if (car.hp <= 0) {
    car.dead = true;
    car.speed = 0;
    spawnWreckFx(G, car);
  }
}
function spawnWreckFx(G, car) {
  for (let i = 0;
  i < 14;
  i++) G.particles.push({ x: car.x, y: car.y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.7, max: 0.7,   color: '#ff9f1c', size: 4, kind: 'spark' });
}
export function emitSkid(G, car) {
  if (!G.skids) G.skids = [];
  const back = 0.36;
  for (const side of [-1, 1]) {
    const lx = -car.w * back;
    const ly = side * car.h * 0.42;
    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    const wx = car.x + lx * cos - ly * sin;
    const wy = car.y + lx * sin + ly * cos;
    const prev = car._skid?.[side + 1];
    if (prev) {
      G.skids.push({ x1: prev.x, y1: prev.y, x2: wx, y2: wy, life: 14 });
      if (G.skids.length > 240) G.skids.splice(0, G.skids.length - 240);
    }
    if (!car._skid) car._skid = {
    }
    ;
    car._skid[side + 1] = {
      x: wx, y: wy
    }
    ;
  }
}
export function updateCarPhysics(G, car, dt, ctrl) {
  const t = CAR_TYPES[car.type];
  if (car.dead) {
    car.speed = 0;
    return;
  }
  if (ctrl.throttle > 0) car.speed += t.accel * dt * ctrl.throttle; else if (ctrl.throttle < 0) car.speed -= (car.speed > 10 ? 420 : t.accel * 0.6) * dt;
  car.speed -= car.speed * 0.55 * dt;
  // drag
  if (ctrl.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 500 * dt);
  const maxRev = -t.top * 0.35;
  car.speed = clamp(car.speed, maxRev, t.top);
  const sf = clamp(car.speed / 160, -1.6, 1.6);
  car.angle += ctrl.steer * t.grip * 0.62 * dt * sf * (ctrl.brake ? 1.35 : 1);
  const drifting = ctrl.brake && Math.abs(car.speed) > 150;
  if (drifting || (Math.abs(ctrl.steer) > 0.8 && Math.abs(car.speed) > 260)) emitSkid(G, car); else car._skid = null;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const probe = {
    x: nx, y: ny
  }
  ;
  const before = {
    x: car.x, y: car.y
  }
  ;
  car.x = nx;
  car.y = ny;
  collideBuildings(car, car.w / 2.4, G.city);
  if (Math.abs(car.x - nx) > 1 || Math.abs(car.y - ny) > 1) {
    if (Math.abs(car.speed) > 130) {
      damageCar(G, car, 8, 'crash');
      G.shake = Math.max(G.shake, 5);
      G.audio?.thud();
    }
    car.speed *= -0.25;
  }
  void probe;
  void before;
  // car-car soft collision
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    const min = (car.w + o.w) / 2.6;
    if (d > 0 && d < min) {
      const push = (min - d) / 2, ux = (car.x - o.x) / d, uy = (car.y - o.y) / d;
      car.x += ux * push;
      car.y += uy * push;
      o.x -= ux * push;
      o.y -= uy * push;
      if (Math.abs(car.speed) > 160) {
        damageCar(G, o, 6, 'crash');
        if (car.driver === 'player') G.addHeat(0.34, car.x, car.y);
      }
      car.speed *= 0.82;
    }
  }
}
export function updateTrafficCar(G, car, dt) {
  if (car.parked || car.dead || !car.ai) return;
  const ai = car.ai;
  if (ai.panic > 0) ai.panic -= dt;
  // obstacle scan ahead
  const ax = car.x + Math.cos(car.angle) * 95, ay = car.y + Math.sin(car.angle) * 95;
  let blocked = false;
  for (const o of G.cars) {
    if (o !== car && dist(ax, ay, o.x, o.y) < 52) {
      blocked = true;
      break;
    }
  }
  if (!blocked) for (const p of G.peds) {
    if (p.alive && dist(ax, ay, p.x, p.y) < 42) {
      blocked = true;
      break;
    }
  }
  if (!blocked && G.player.car !== car && !G.player.car && dist(ax, ay, G.player.x, G.player.y) < 42) blocked = true;
  const want = ai.panic > 0 ? CAR_TYPES[car.type].top * 0.95 : ai.cruise;
  const ctrl = {
    throttle: 0, steer: 0, brake: false
  }
  ;
  if (blocked) {
    ctrl.brake = car.speed > 20;
    ctrl.throttle = -0.4;
  } else ctrl.throttle = car.speed < want ? 0.75 : 0;
  // lane keeping: steer toward lane centre line
  if (ai.vertical) {
    const cx = nearestRoadX(car.x);
    const targetX = cx + (ai.dir > 0 ? -22 : 22);
    const err = targetX - car.x;
    ctrl.steer = clamp(err * 0.02, -0.7, 0.7) * ai.dir;
    // turn at intersections occasionally
    const cy = nearestRoadY(car.y);
    if (Math.abs(car.y - cy) < 26 && Math.abs(car.x - cx) < 70 && G.rng() < 0.003) {
      ai.vertical = false;
      ai.dir = G.rng() < 0.5 ? 1 : -1;
      car.angle = ai.dir > 0 ? 0 : Math.PI;
      car.y = cy + (ai.dir > 0 ? 22 : -22);
    }
  } else {
    const cy = nearestRoadY(car.y);
    const targetY = cy + (ai.dir > 0 ? 22 : -22);
    const err = targetY - car.y;
    ctrl.steer = clamp(err * 0.02, -0.7, 0.7) * ai.dir;
    const cx = nearestRoadX(car.x);
    if (Math.abs(car.x - cx) < 26 && Math.abs(car.y - cy) < 60 && G.rng() < 0.003) {
      ai.vertical = true;
      ai.dir = G.rng() < 0.5 ? 1 : -1;
      car.angle = ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x = cx + (ai.dir > 0 ? -22 : 22);
    }
  }
  updateCarPhysics(G, car, dt, ctrl);
  // wrap despawn far from player, respawn near
  const pd = dist(car.x, car.y, G.player.x, G.player.y);
  if (pd > 2400) {
    const cx = nearestRoadX(G.player.x), cy = nearestRoadY(G.player.y);
    car.x = clamp(cx + (G.rng() - 0.5) * 1400, 80, 4150);
    car.y = clamp(cy + (G.rng() - 0.5) * 1000, 80, WORLD.h - 80);
    car.x = nearestRoadX(car.x) - 22;
    car.angle = Math.PI / 2;
    ai.vertical = true;
    ai.dir = 1;
  }
}
export function nearestCar(G, x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    const d = dist(x, y, c.x, c.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
