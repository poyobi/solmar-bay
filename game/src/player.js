// Solmar Bay — Nico Ferrer, the player: walking the pavements, wading at the beach, getting
// in and out of other people's cars, and staying alive.
//
// On foot he is a circle that collides with the city; in a car the car is the body and this
// file just keeps his position glued to it and hands the driving to vehicles.js. Getting
// into a car that already has a driver is a jacking — the driver is thrown out and the
// street notices.

import { TILE, TUNING } from './config.js';
import { surfaceAt, collideCircle } from './city.js';
import { dist } from './random.js';
import { updatePlayerCar } from './vehicles.js';
import { scarePeds } from './pedestrians.js';

/** A fresh player at a start point. */
export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    hp: TUNING.playerMaxHp,
    cash: 40,
    inCar: false,
    car: null,
    punchCd: 0,
    hurtAgo: 99,
    stepPhase: 0,
    moving: false,
  };
}

/** The nearest car the player could get into, or null. */
export function nearestEnterableCar(G, maxDist = 52) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    const d = dist(G.player.x, G.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Get into a car (or out of the current one). Called on the interact key's edge. */
export function enterExitCar(G) {
  const player = G.player;
  if (player.inCar) {
    const car = player.car;
    if (Math.abs(car.speed) > 46) return; // not at speed — bail-outs are for films
    car.driver = null;
    player.inCar = false;
    player.car = null;
    // Step out on the left side of the car.
    const side = car.angle - Math.PI / 2;
    const res = collideCircle(G.city, car.x + Math.cos(side) * 34, car.y + Math.sin(side) * 34, TUNING.playerRadius);
    player.x = res.x;
    player.y = res.y;
    player.angle = car.angle;
    G.audio.blip(320);
    return;
  }
  const car = nearestEnterableCar(G);
  if (!car) return;
  if (car.driver === 'ai' && car.kind === 'traffic') {
    // A jacking: the driver comes out the hard way and the street sees it.
    const ejected = G.spawnPed(car.x + 20, car.y + 10);
    if (ejected) {
      ejected.state = 'flee';
      ejected.fleeCd = 4;
      ejected.threatX = player.x;
      ejected.threatY = player.y;
    }
    scarePeds(G, car.x, car.y, 190, 'jack');
    if (G.reportCrime) G.reportCrime('jack', car.x, car.y, 1);
    G.audio.blip(140);
  } else if (car.kind === 'police') {
    if (G.reportCrime) G.reportCrime('jack', car.x, car.y, 1.4);
  }
  if (car.spot) {
    car.spot.taken = false;
    car.spot = null;
  }
  car.driver = 'player';
  player.inCar = true;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  G.audio.blip(520);
}

/** Hurt the player; at zero he is wasted and the run ends. */
export function hurtPlayer(G, amount) {
  const player = G.player;
  if (player.hp <= 0) return;
  player.hp -= amount;
  player.hurtAgo = 0;
  G.fx.push({ kind: 'burst', x: player.x, y: player.y, color: '#ef476f', n: 6 });
  if (player.hp <= 0) {
    player.hp = 0;
    G.endRun('wasted');
  }
}

/** One simulation step for the player, on foot or behind the wheel. */
export function updatePlayer(G, dt) {
  const player = G.player;
  player.punchCd = Math.max(0, player.punchCd - dt);
  player.hurtAgo += dt;
  if (player.hp > 0 && player.hp < TUNING.playerMaxHp && player.hurtAgo > 6) {
    player.hp = Math.min(TUNING.playerMaxHp, player.hp + 2.2 * dt);
  }

  if (player.inCar) {
    updatePlayerCar(G, dt);
    player.x = player.car.x;
    player.y = player.car.y;
    player.angle = player.car.angle;
    player.moving = Math.abs(player.car.speed) > 12;
    return;
  }

  const axes = G.input.axes();
  const running = G.input.isDown('ShiftLeft') || G.input.isDown('ShiftRight');
  let speed = running ? TUNING.playerRunSpeed : TUNING.playerWalkSpeed;
  const surface = surfaceAt(G.city, player.x, player.y);
  if (surface === 'water') speed *= 0.45;
  if (surface === 'sand') speed *= 0.8;

  player.moving = axes.x !== 0 || axes.y !== 0;
  if (player.moving) {
    const len = Math.hypot(axes.x, axes.y) || 1;
    const mx = axes.x / len;
    const my = axes.y / len;
    player.angle = Math.atan2(my, mx);
    let nx = player.x + mx * speed * dt;
    let ny = player.y + my * speed * dt;
    // Deep water stops him: the bay is for boats.
    if (Math.floor(nx / TILE) < 3) nx = player.x;
    if (Math.floor(player.x / TILE) < 3 && Math.floor(nx / TILE) >= 3) nx = player.x;
    const res = collideCircle(G.city, nx, ny, TUNING.playerRadius);
    player.x = res.x;
    player.y = res.y;
    player.stepPhase += dt * speed * 0.075;
  }

  // Cars are solid to a man on foot: walking into one pushes him out, not through.
  for (const car of G.cars) {
    const d = dist(player.x, player.y, car.x, car.y);
    const min = 30;
    if (d < min && d > 0.01) {
      const push = min - d;
      player.x += ((player.x - car.x) / d) * push;
      player.y += ((player.y - car.y) / d) * push;
      if (Math.abs(car.speed) > 150) hurtPlayer(G, 9);
    }
  }
}
