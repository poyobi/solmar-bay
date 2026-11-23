// Solmar Bay — the city itself: a seeded grid of pastel blocks between a beach and the hills.
//
// The bay fills the western columns. East of the sand, two-lane road bands run every nine
// tiles, and the 7x7 blocks between them are sidewalks around an interior that the generator
// fills with buildings, a park, a car park or a plaza. Everything the other systems need is
// answered here: what surface a point stands on, what a circle collides with, where the road
// centre lines run, and which named district a point belongs to.

import {
  BEACH_TX, COLS, ROWS, TILE, PITCH, ROAD_A, ROAD_B,
  BUILDING_PAINTS,
} from './config.js';
import { makeRng, pick, rint, rrange, clamp } from './random.js';

/** Is this tile column part of a vertical road band? */
function isRoadCol(tx) {
  const r = tx % PITCH;
  return tx >= BEACH_TX + 2 && (r === ROAD_A || r === ROAD_B);
}

/** Is this tile row part of a horizontal road band? (Roads stop at the beach.) */
function isRoadRow(tx, ty) {
  const r = ty % PITCH;
  return tx >= BEACH_TX + 2 && (r === ROAD_A || r === ROAD_B);
}

/** The raw kind of a tile before lots are laid out: water, sand, road, or block. */
export function rawTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return 'water';
  if (tx < BEACH_TX) return 'water';
  if (tx < BEACH_TX + 2) return 'sand';
  if (isRoadCol(tx) || isRoadRow(tx, ty)) return 'road';
  return 'block';
}

/** Block coordinates of a tile: blocks are the PITCH-sized cells roads run between. */
function blockOf(tx, ty) {
  return { bx: Math.floor(tx / PITCH), by: Math.floor(ty / PITCH) };
}

/** Is this block tile on the block's edge ring (a sidewalk) rather than its interior? */
function isEdgeTile(tx, ty) {
  const lx = tx % PITCH;
  const ly = ty % PITCH;
  return lx === 0 || ly === 0 || lx === PITCH - 1 || ly === PITCH - 1;
}

const SHOP_NAMES = [
  'Café Brisa', 'Taller Sol', 'Hotel Miramar', 'Farmacia Luz', 'Club Nocturna',
  'Pescadería Rosa', 'Banco del Puerto', 'Librería Marea', 'Bar El Ancla',
  'Heladería Lúa', 'Joyas Cordero', 'Teatro Alba', 'Gimnasio Ola', 'Panadería Trigo',
];

/**
 * Grow the whole city from a seed. The returned object is plain data plus query closures;
 * it never changes after it is built.
 */
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const fountains = [];
  const parkingSpots = [];
  const blocks = [];
  let shopIndex = 0;

  for (let by = 0; by * PITCH < ROWS; by += 1) {
    for (let bx = 0; bx * PITCH < COLS; bx += 1) {
      const x0 = bx * PITCH;
      const y0 = by * PITCH;
      if (rawTile(x0 + 3, y0 + 3) !== 'block') continue;
      const roll = rng();
      const kind = roll < 0.62 ? 'buildings' : roll < 0.78 ? 'park' : roll < 0.9 ? 'parking' : 'plaza';
      const block = { bx, by, kind, x: x0 * TILE, y: y0 * TILE, size: PITCH * TILE };
      blocks.push(block);
      const ix = (x0 + 1) * TILE; // interior origin: the 5x5 tiles inside the sidewalk ring
      const iy = (y0 + 1) * TILE;
      const inner = 5 * TILE;

      if (kind === 'buildings') {
        const pattern = rint(rng, 0, 2);
        const lots = [];
        if (pattern === 0) {
          lots.push({ x: ix + 14, y: iy + 14, w: inner - 28, h: inner - 28 });
        } else if (pattern === 1) {
          const split = inner / 2;
          lots.push({ x: ix + 10, y: iy + 12, w: split - 20, h: inner - 24 });
          lots.push({ x: ix + split + 10, y: iy + 12, w: split - 20, h: inner - 24 });
        } else {
          const half = inner / 2;
          for (const ox of [0, half]) {
            for (const oy of [0, half]) {
              lots.push({ x: ix + ox + 9, y: iy + oy + 9, w: half - 18, h: half - 18 });
            }
          }
        }
        for (const lot of lots) {
          const named = rng() < 0.16 && shopIndex < SHOP_NAMES.length;
          buildings.push({
            ...lot,
            floors: rint(rng, 1, 6),
            paint: pick(rng, BUILDING_PAINTS),
            name: named ? SHOP_NAMES[shopIndex++] : null,
          });
        }
      } else if (kind === 'park') {
        const count = rint(rng, 4, 8);
        for (let i = 0; i < count; i += 1) {
          palms.push({ x: ix + rrange(rng, 18, inner - 18), y: iy + rrange(rng, 18, inner - 18), r: 7 });
        }
      } else if (kind === 'parking') {
        for (let row = 0; row < 2; row += 1) {
          for (let col = 0; col < 4; col += 1) {
            parkingSpots.push({
              x: ix + 34 + col * 52,
              y: iy + 52 + row * 108,
              angle: Math.PI / 2,
              taken: false,
            });
          }
        }
      } else {
        fountains.push({ x: ix + inner / 2, y: iy + inner / 2, r: 30 });
        palms.push({ x: ix + 22, y: iy + 22, r: 7 }, { x: ix + inner - 22, y: iy + inner - 22, r: 7 });
      }
    }
  }

  // Palms along the beach, on the sand just above the water line.
  for (let ty = 1; ty < ROWS - 1; ty += 3) {
    if (rng() < 0.75) {
      palms.push({ x: (BEACH_TX + 1) * TILE + rrange(rng, -8, 8), y: ty * TILE + rrange(rng, 4, 40), r: 7 });
    }
  }

  // Road centre lines: vertical bands run the city's height, horizontal bands stop at the sand.
  const vRoads = [];
  for (let k = 0; (k * PITCH + ROAD_B) < COLS; k += 1) vRoads.push((k * PITCH + PITCH) * TILE);
  const hRoads = [];
  for (let k = 0; (k * PITCH + ROAD_B) < ROWS; k += 1) hRoads.push((k * PITCH + PITCH) * TILE);

  const city = {
    seed,
    buildings,
    palms,
    fountains,
    parkingSpots,
    blocks,
    vRoads,
    hRoads,
    width: COLS * TILE,
    height: ROWS * TILE,
  };
  return city;
}

/** What surface is under a world point: water, sand, road, walk, grass, asphalt, plaza, roof. */
export function surfaceAt(city, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const raw = rawTile(tx, ty);
  if (raw !== 'block') return raw;
  if (!isEdgeTile(tx, ty)) {
    const { bx, by } = blockOf(tx, ty);
    const block = city.blocks.find((b) => b.bx === bx && b.by === by);
    if (block) {
      if (block.kind === 'park') return 'grass';
      if (block.kind === 'parking') return 'asphalt';
      if (block.kind === 'plaza') return 'plaza';
      for (const b of city.buildings) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return 'roof';
      }
      return 'walk'; // the gaps between a block's buildings are paved yards
    }
  }
  return 'walk';
}

/** Is a world point on a road (where cars belong)? */
export function isRoadAt(city, x, y) {
  return surfaceAt(city, x, y) === 'road';
}

/** Can a pedestrian stand here? Sidewalks, sand, grass and plazas; not water, roads or roofs. */
export function isWalkableAt(city, x, y) {
  const s = surfaceAt(city, x, y);
  return s === 'walk' || s === 'sand' || s === 'grass' || s === 'plaza' || s === 'asphalt';
}

/**
 * Push a circle out of every building, fountain and palm trunk, and keep it inside the
 * world. Returns the resolved position and whether anything was hit.
 */
export function collideCircle(city, x, y, r) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // Centre inside the box: leave by the shallowest side.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  for (const f of city.fountains) {
    const dx = x - f.x;
    const dy = y - f.y;
    const rr = r + f.r;
    const d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = f.x + (dx / d) * rr;
      y = f.y + (dy / d) * rr;
      hit = true;
    }
  }
  for (const p of city.palms) {
    const dx = x - p.x;
    const dy = y - p.y;
    const rr = r + p.r;
    const d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = p.x + (dx / d) * rr;
      y = p.y + (dy / d) * rr;
      hit = true;
    }
  }
  const cx = clamp(x, r, city.width - r);
  const cy = clamp(y, r, city.height - r);
  if (cx !== x || cy !== y) hit = true;
  return { x: cx, y: cy, hit };
}

/** The named district a world point belongs to, for the HUD's location line. */
export function districtAt(city, x, y) {
  const tx = x / TILE;
  const ty = y / TILE;
  if (tx < BEACH_TX + 2) return 'Playa Serena';
  if (tx >= 58) return 'Colinas del Sol';
  if (ty < 12) return 'Barrio Alto';
  if (tx < 22 && ty >= 30) return 'Muelle Sur';
  if (tx < 22) return 'Puerto Norte';
  if (ty >= 44) return 'Barrio del Faro';
  return 'Centro Cívico';
}

/** A random point on a road, for spawning traffic away from the player. */
export function randomRoadPoint(rng, city) {
  const vertical = rng() < 0.5;
  if (vertical) {
    const cx = city.vRoads[Math.floor(rng() * city.vRoads.length)];
    return { x: cx + (rng() < 0.5 ? -TILE / 2 : TILE / 2), y: rrange(rng, TILE, city.height - TILE) };
  }
  const cy = city.hRoads[Math.floor(rng() * city.hRoads.length)];
  return { x: rrange(rng, (BEACH_TX + 2) * TILE, city.width - TILE), y: cy + (rng() < 0.5 ? -TILE / 2 : TILE / 2) };
}

/** A random walkable point near a centre, for pedestrians and mission dressing. */
export function randomWalkPoint(rng, city, cx, cy, radius) {
  for (let tries = 0; tries < 24; tries += 1) {
    const x = cx + rrange(rng, -radius, radius);
    const y = cy + rrange(rng, -radius, radius);
    if (x > 8 && y > 8 && x < city.width - 8 && y < city.height - 8 && isWalkableAt(city, x, y)) {
      return { x, y };
    }
  }
  return { x: cx, y: cy };
}
