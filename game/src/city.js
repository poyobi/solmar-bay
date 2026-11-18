// Solmar Bay — the city itself.
// A seeded generator lays buildings into the blocks between avenues and
// streets, plants lamps, palms, crates and benches, and names five landmark
// buildings that gameplay hangs off: safehouse, garage, gun shop, hospital
// and police station. surfaceAt() is the one query traffic, pedestrians
// and the minimap all agree on.

// City generation: seeded road grid, buildings, props, landmarks, surface queries.
import {
  WORLD, ROADS, LANDMARKS, BUILDING_COLORS, ROOF_COLORS
}
from './config.js';
import {
  mulberry32, rngPick, rngRange, clamp
}
from './random.js';
export function nearestRoadX(x) {
  let best = ROADS.vx[0], bd = 1e9;
  for (const v of ROADS.vx) {
    const d = Math.abs(v - x);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}
export function nearestRoadY(y) {
  let best = ROADS.hy[0], bd = 1e9;
  for (const v of ROADS.hy) {
    const d = Math.abs(v - y);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}
export function onVerticalRoad(x) {
  return ROADS.vx.some((v) => Math.abs(x - v) <= ROADS.vw / 2);
}
export function onHorizontalRoad(y) {
  return ROADS.hy.some((v) => Math.abs(y - v) <= ROADS.hw / 2);
}
export function surfaceAt(x, y) {
  if (x < 0 || y < 0 || x >= WORLD.w || y >= WORLD.h) return 'void';
  if (x >= 4440) return 'water';
  if (x >= 4240) return 'sand';
  const vr = onVerticalRoad(x), hr = onHorizontalRoad(y);
  if (vr || hr) return 'road';
  const vs = ROADS.vx.some((v) => Math.abs(x - v) <= ROADS.vw / 2 + ROADS.sidewalk);
  const hs = ROADS.hy.some((v) => Math.abs(y - v) <= ROADS.hw / 2 + ROADS.sidewalk);
  if (vs || hs) return 'sidewalk';
  if (y >= 3060 && x < 4240) return 'dock';
  return 'grass';
}
export function districtAt(x, y) {
  if (x >= 4240) return 'Solmar Beach';
  if (y >= 2700) return 'Portside Docks';
  if (y <= 780) return 'North Hills';
  if (x >= 1300 && x <= 3300 && y >= 700 && y <= 2400) return 'Downtown';
  return 'Midtown';
}
export function buildCity(seed) {
  const rng = mulberry32(seed * 7919 + 13);
  const buildings = [], props = [];
  const xs = [0, ...ROADS.vx.flatMap((v) => [v - ROADS.vw / 2 - ROADS.sidewalk, v + ROADS.vw / 2 + ROADS.sidewalk]), 4240];
  const ys = [0, ...ROADS.hy.flatMap((v) => [v - ROADS.hw / 2 - ROADS.sidewalk, v + ROADS.hw / 2 + ROADS.sidewalk]), WORLD.h];
  const blocks = [];
  for (let i = 0; i + 1 < xs.length; i += 2) for (let j = 0; j + 1 < ys.length; j += 2) {
    const bx = xs[i], by = ys[j], bw = xs[i + 1] - xs[i], bh = ys[j + 1] - ys[j];
    if (bw < 90 || bh < 90) continue;
    blocks.push({ x: bx, y: by, w: bw, h: bh });
  }
  let id = 0;
  for (const b of blocks) {
    const downtown = b.x > 1200 && b.x < 3400 && b.y > 600 && b.y < 2500;
    const n = downtown ? 2 : (rng() < 0.6 ? 1 : 2);
    for (let k = 0; k < n; k++) {
      const pad = 14;
      const bw = n === 1 ? b.w - pad * 2 : (b.w / 2) - pad - 4;
      const bx = n === 1 ? b.x + pad : b.x + pad + k * (b.w / 2);
      const bh = b.h - pad * 2 - rngRange(rng, 0, Math.min(60, b.h * 0.25));
      const by = b.y + pad + rngRange(rng, 0, Math.max(0, b.h - pad * 2 - bh));
      if (bw < 60 || bh < 60) continue;
      buildings.push({         id: id++, x: bx, y: by, w: bw, h: bh,         color: rngPick(rng, BUILDING_COLORS), roof: rngPick(rng, ROOF_COLORS),         floors: downtown ? 6 + Math.floor(rng() * 10) : 2 + Math.floor(rng() * 4),         name: '', seed: rng(),       });
    }
    // sidewalk props along block edges
    const propCount = 2 + Math.floor(rng() * 3);
    for (let p = 0; p < propCount; p++) {
      props.push({ kind: rngPick(rng, ['lamp', 'crate', 'hydrant', 'bin']), x: b.x + rngRange(rng, 6, b.w - 6), y: b.y + 4, r: 5 });
      props.push({ kind: 'lamp', x: b.x + rngRange(rng, 6, b.w - 6), y: b.y + b.h - 4, r: 5 });
    }
  }
  // palms along the beach and marina
  for (let y = 60; y < WORLD.h - 60; y += 130) props.push({ kind: 'palm', x: 4270 + rngRange(rng, 0, 90), y: y + rngRange(rng, -20, 20),     r: 9 });
  for (let x = 200; x < 4100; x += 420) props.push({ kind: 'crate', x: x + rngRange(rng, -30, 30), y: 3320 + rngRange(rng, -40, 40),     r: 10 });
  // beach benches and boardwalk signs
  for (let y = 140; y < WORLD.h - 100; y += 260) {
    props.push({ kind: 'bench', x: 4232, y, r: 7 });
    props.push({ kind: 'sign', x: 4252, y: y + 60, r: 5 });
  }
  // extra dock clutter: stacked crates and barrels near the water
  for (let x = 260; x < 4000; x += 300) {
    props.push({ kind: 'crate', x: x + rngRange(rng, -20, 20), y: 3440 + rngRange(rng, -24, 24), r: 10 });
    props.push({ kind: 'barrel', x: x + 34, y: 3462 + rngRange(rng, -16, 16), r: 6 });
  }
  // landmark buildings get named + distinct roofs, colliders included
  for (const lm of LANDMARKS) {
    buildings.push({ id: id++, x: lm.x - 70, y: lm.y - 55, w: 140, h: 110, color: '#3b4a5a', roof: lm.color, floors: 3, name: lm.name,       seed: 0.5, landmark: lm.id });
  }
  return {
    buildings, props, blocks, landmarks: LANDMARKS
  }
  ;
}
export function collideBuildings(p, r, city) {
  for (const b of city.buildings) {
    const nx = clamp(p.x, b.x, b.x + b.w), ny = clamp(p.y, b.y, b.y + b.h);
    const dx = p.x - nx, dy = p.y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * r;
        p.y = ny + (dy / d) * r;
      } else {
        // centre inside: push out via smallest exit
        const exits = [p.x - (b.x - r), (b.x + b.w + r) - p.x, p.y - (b.y - r), (b.y + b.h + r) - p.y];
        const m = Math.min(...exits);
        if (m === exits[0]) p.x = b.x - r; else if (m === exits[1]) p.x = b.x + b.w + r; else if (m === exits[2]) p.y = b.y - r; else p.y = b.y + b.h + r;
      }
    }
  }
  p.x = clamp(p.x, r, WORLD.w - r);
  p.y = clamp(p.y, r, WORLD.h - r);
}
export function rectHitsBuilding(rect, city) {
  for (const b of city.buildings) if (rect.x < b.x + b.w && rect.x + rect.w > b.x && rect.y < b.y + b.h && rect.y + rect.h > b.y) return b;
  return null;
}

// Find a road point at least minD from (x, y): used when a system needs a
// believable street spawn without landing inside a building.
export function roadPointNear(rng, x, y, minD) {
  for (let tries = 0; tries < 16; tries++) {
    const vertical = rng() < 0.5;
    let px;
    let py;
    if (vertical) {
      px = ROADS.vx[Math.floor(rng() * ROADS.vx.length)];
      py = clamp(y + (rng() - 0.5) * 1600, 80, WORLD.h - 80);
    } else {
      py = ROADS.hy[Math.floor(rng() * ROADS.hy.length)];
      px = clamp(x + (rng() - 0.5) * 1600, 80, 4150);
    }
    const d = Math.hypot(px - x, py - y);
    if (d >= minD) return { x: px, y: py };
  }
  return { x: ROADS.vx[0], y: ROADS.hy[0] };
}

// The five landmark positions by id, for prompts, markers and respawns.
export function landmarkById(id) {
  for (const lm of LANDMARKS) if (lm.id === id) return lm;
  return null;
}
