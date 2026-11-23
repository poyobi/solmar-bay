// Solmar Bay — cars: the factory, the traffic that drives itself around the road grid, and
// the physics of the car the player is driving.
//
// Traffic follows the city's road centre lines lane by lane: each car runs toward the next
// intersection on its lane, then goes straight or turns, braking for whatever is ahead of
// it. The player's car is a simple arcade model — throttle, steering that bites harder at
// speed, a handbrake that lets the tail slide, and grip that bleeds off sideways velocity.

import { TILE, TUNING, CAR_PAINTS } from './config.js';
import { isRoadAt, collideCircle, randomRoadPoint } from './city.js';
import { pick, rrange, clamp, angleDelta, dist } from './random.js';

let nextCarId = 1;

/** A fresh car. kind is 'traffic', 'parked' or 'police'; driver is 'ai', 'player' or null. */
export function createCar(x, y, angle, color, kind) {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    vx: 0, vy: 0,
    color,
    kind,
    driver: kind === 'parked' ? null : 'ai',
    health: TUNING.carHealth,
    wrecked: false,
    axis: 'v',
    dir: 1,
    target: null,
    brake: 0,
    sirenPhase: Math.random() * Math.PI * 2,
    honkCd: 0,
    smokeCd: 0,
  };
}

/** Which lane coordinate a car on a vertical road with centre cx should hold, by direction. */
function laneForV(cx, dir) {
  return dir > 0 ? cx - TILE / 2 : cx + TILE / 2;
}

/** Which lane coordinate a car on a horizontal road with centre cy should hold, by direction. */
function laneForH(cy, dir) {
  return dir > 0 ? cy + TILE / 2 : cy - TILE / 2;
}

/** The next intersection coordinate ahead of a position along an axis, or the world's edge. */
function nextCrossing(lines, pos, dir, limit) {
  let best = dir > 0 ? limit : 0;
  for (const line of lines) {
    if (dir > 0 && line > pos + 4 && line < best) best = line;
    if (dir < 0 && line < pos - 4 && line > best) best = line;
  }
  return best;
}

/** Give a traffic car a route target: the crossing ahead, then a decision when it arrives. */
function planTarget(G, car) {
  const city = G.city;
  if (car.axis === 'v') {
    const cy = nextCrossing(city.hRoads, car.y, car.dir, city.height);
    car.target = { x: laneForV(nearestLine(city.vRoads, car.x), car.dir), y: cy, crossing: true };
  } else {
    const cx = nextCrossing(city.vRoads, car.x, car.dir, city.width);
    car.target = { x: cx, y: laneForH(nearestLine(city.hRoads, car.y), car.dir), crossing: true };
  }
}

/** The road centre line nearest a coordinate. */
function nearestLine(lines, pos) {
  let best = lines[0];
  let bestD = Infinity;
  for (const line of lines) {
    const d = Math.abs(line - pos);
    if (d < bestD) { bestD = d; best = line; }
  }
  return best;
}

/** At an intersection: mostly go straight, sometimes turn onto the crossing road. */
function decideAtCrossing(G, car) {
  const city = G.city;
  const roll = G.rng();
  if (car.axis === 'v') {
    const cx = nearestLine(city.vRoads, car.x);
    if (roll < 0.34) {
      car.axis = 'h';
      car.dir = roll < 0.17 ? 1 : -1;
      car.target = { x: nextCrossing(city.vRoads, car.x, car.dir, city.width), y: laneForH(nearestLine(city.hRoads, car.y), car.dir), crossing: true };
      return;
    }
    car.target = { x: laneForV(cx, car.dir), y: nextCrossing(city.hRoads, car.y, car.dir, city.height), crossing: true };
  } else {
    const cy = nearestLine(city.hRoads, car.y);
    if (roll < 0.34) {
      car.axis = 'v';
      car.dir = roll < 0.17 ? 1 : -1;
      car.target = { x: laneForV(nearestLine(city.vRoads, car.x), car.dir), y: nextCrossing(city.hRoads, car.y, car.dir, city.height), crossing: true };
      return;
    }
    car.target = { x: nextCrossing(city.vRoads, car.x, car.dir, city.width), y: laneForH(cy, car.dir), crossing: true };
  }
}

/** Spawn the parked cars in the city's car parks and the first wave of traffic. */
export function seedVehicles(G) {
  for (const spot of G.city.parkingSpots) {
    if (G.rng() < 0.55) {
      spot.taken = true;
      const car = createCar(spot.x, spot.y, spot.angle, pick(G.rng, CAR_PAINTS), 'parked');
      car.spot = spot;
      G.cars.push(car);
    }
  }
  for (let i = 0; i < TUNING.trafficCount; i += 1) spawnTrafficCar(G, true);
}

/** Add one traffic car on a random road, routed and ready. */
export function spawnTrafficCar(G, anywhere = false) {
  const city = G.city;
  let point = randomRoadPoint(G.rng, city);
  if (!anywhere) {
    for (let tries = 0; tries < 10; tries += 1) {
      const p = randomRoadPoint(G.rng, city);
      const d = dist(p.x, p.y, G.player.x, G.player.y);
      if (d > 640 && d < 1250) { point = p; break; }
    }
  }
  const car = createCar(point.x, point.y, 0, pick(G.rng, CAR_PAINTS), 'traffic');
  // Decide which road it is on by whichever centre line it sits near.
  const vx = nearestLine(city.vRoads, point.x);
  const hy = nearestLine(city.hRoads, point.y);
  if (Math.abs(point.x - vx) < Math.abs(point.y - hy)) {
    car.axis = 'v';
    car.dir = point.x < vx ? -1 : 1;
    car.x = laneForV(vx, car.dir);
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.axis = 'h';
    car.dir = point.y < hy ? 1 : -1;
    car.y = laneForH(hy, car.dir);
    car.angle = car.dir > 0 ? 0 : Math.PI;
  }
  car.speed = TUNING.trafficSpeed * rrange(G.rng, 0.75, 1);
  planTarget(G, car);
  G.cars.push(car);
  return car;
}

/** Is there something solid just ahead of this car? Returns a 0..1 braking urge. */
function obstacleAhead(G, car, lookDist) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let urge = 0;
  const test = (ox, oy, radius) => {
    const dx = ox - car.x;
    const dy = oy - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 6 || ahead > lookDist) return;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < radius + 16) urge = Math.max(urge, 1 - ahead / lookDist);
  };
  for (const other of G.cars) {
    if (other === car) continue;
    test(other.x, other.y, 24);
  }
  if (!G.player.inCar) test(G.player.x, G.player.y, 14);
  else if (G.player.car !== car) test(G.player.car.x, G.player.car.y, 24);
  for (const ped of G.peds) test(ped.x, ped.y, 12);
  return urge;
}

/** Move one AI-driven car (traffic rules; police drive themselves in police.js). */
export function updateTrafficCar(G, car, dt) {
  if (car.wrecked || car.driver !== 'ai') return;
  const city = G.city;
  if (!car.target) planTarget(G, car);
  const t = car.target;
  const reached = car.axis === 'v' ? Math.abs(car.y - t.y) < 26 : Math.abs(car.x - t.x) < 26;
  if (reached && t.crossing) decideAtCrossing(G, car);

  // Aim at a look-ahead point on the lane so turns swing wide and smooth.
  const look = 74;
  let goalX = t.x;
  let goalY = t.y;
  if (car.axis === 'v') { goalX = t.x; goalY = car.y + car.dir * look; }
  else { goalX = car.x + car.dir * look; goalY = t.y; }
  const wanted = Math.atan2(goalY - car.y, goalX - car.x);
  const delta = angleDelta(car.angle, wanted);
  car.angle += clamp(delta, -2.4 * dt, 2.4 * dt);

  const urge = obstacleAhead(G, car, 96);
  const cruise = TUNING.trafficSpeed * (car.kind === 'traffic' ? 1 : 1);
  let targetSpeed = cruise * (1 - clamp(Math.abs(delta) * 1.4, 0, 0.55));
  if (urge > 0) targetSpeed = Math.min(targetSpeed, cruise * (1 - urge) * 0.4);
  car.brake = urge;
  car.speed += clamp(targetSpeed - car.speed, -420 * dt, 190 * dt);
  if (car.speed < 0) car.speed = 0;

  moveCar(G, car, dt);

  // Keep the streets near the player populated: far traffic quietly re-enters elsewhere.
  const d = dist(car.x, car.y, G.player.x, G.player.y);
  if (d > 1500) {
    const p = randomRoadPoint(G.rng, city);
    const nd = dist(p.x, p.y, G.player.x, G.player.y);
    if (nd > 640 && nd < 1250) {
      car.x = p.x; car.y = p.y;
      const vx = nearestLine(city.vRoads, car.x);
      const hy = nearestLine(city.hRoads, car.y);
      if (Math.abs(car.x - vx) < Math.abs(car.y - hy)) {
        car.axis = 'v'; car.dir = car.x < vx ? -1 : 1; car.x = laneForV(vx, car.dir);
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.axis = 'h'; car.dir = car.y < hy ? 1 : -1; car.y = laneForH(hy, car.dir);
        car.angle = car.dir > 0 ? 0 : Math.PI;
      }
      planTarget(G, car);
    }
  }
}

/** Integrate a car's velocity and settle collisions with buildings and other cars. */
export function moveCar(G, car, dt) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  // Velocity is mostly along the nose; a little lateral slide keeps turns feeling alive.
  car.vx = fx * car.speed;
  car.vy = fy * car.speed;
  let nx = car.x + car.vx * dt;
  let ny = car.y + car.vy * dt;

  // Water is a wall for cars: the bay takes no vehicles.
  const tileAhead = Math.floor(nx / TILE);
  if (tileAhead < 6) { nx = car.x; car.speed *= 0.6; }
  const res = collideCircle(G.city, nx, ny, TUNING.carRadius);
  if (res.hit && Math.abs(car.speed) > 130) {
    hurtCar(G, car, Math.abs(car.speed) * 0.03, true);
    car.speed *= -0.18;
  } else if (res.hit) {
    car.speed *= 0.82;
  }
  car.x = res.x;
  car.y = res.y;

  // Car-to-car: soft push-apart with a crunch when the closing speed is high.
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const d2 = dx * dx + dy * dy;
    const min = 46;
    if (d2 < min * min && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      car.x += ux * push;
      car.y += uy * push;
      other.x -= ux * push;
      other.y -= uy * push;
      const closing = Math.abs(car.speed - other.speed);
      if (closing > 120) {
        hurtCar(G, car, closing * 0.02, car.driver === 'player');
        hurtCar(G, other, closing * 0.02, other.driver === 'player');
        car.speed *= 0.55;
        other.speed *= 0.55;
      }
    }
  }

  // Off-road drag: sand and grass are slow going.
  const surface = isRoadAt(G.city, car.x, car.y) ? 'road' : 'off';
  if (surface === 'off' && car.driver === 'player') car.speed -= car.speed * 0.55 * dt;
}

/** Damage a car; at zero health it is a wreck that smokes and stops. */
export function hurtCar(G, car, amount, byPlayer) {
  if (car.wrecked) return;
  car.health -= amount;
  if (byPlayer && amount > 2.4 && G.reportCrime) G.reportCrime('crash', car.x, car.y, 0.5);
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    G.fx.push({ kind: 'burst', x: car.x, y: car.y, color: '#ffb347', n: 14 });
  }
}

/** Drive the player's car from the input: throttle, steering, handbrake, the lot. */
export function updatePlayerCar(G, dt) {
  const car = G.player.car;
  if (!car) return;
  const input = G.input;
  const T = TUNING;
  const forward = input.isDown('KeyW') || input.isDown('ArrowUp');
  const back = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  const hand = input.isDown('Space');

  if (forward) car.speed += T.carAccel * dt;
  if (back) {
    car.speed -= (car.speed > 8 ? 460 : T.carReverseAccel) * dt;
  }
  car.speed -= car.speed * (hand ? 1.4 : 0.35) * dt; // rolling drag
  car.speed = clamp(car.speed, -T.carMaxReverse, T.carMaxSpeed);

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const speedFactor = clamp(Math.abs(car.speed) / 130, 0, 1);
  const grip = hand ? 0.45 : 1;
  car.angle += steer * T.carTurnRate * speedFactor * grip * dt * (car.speed < 0 ? -1 : 1);
  if (hand && Math.abs(car.speed) > 200 && Math.abs(steer) > 0) {
    G.fx.push({ kind: 'skid', x: car.x - Math.cos(car.angle) * 18, y: car.y - Math.sin(car.angle) * 18 });
  }
  moveCar(G, car, dt);
  if (Math.abs(car.speed) > 60 && G.rng() < 0.3) {
    G.fx.push({ kind: 'dust', x: car.x - Math.cos(car.angle) * 26, y: car.y - Math.sin(car.angle) * 26 });
  }
}
