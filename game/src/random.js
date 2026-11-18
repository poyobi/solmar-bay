// Solmar Bay — deterministic helpers.
// mulberry32 gives every system the same seeded stream, so a city built
// from seed N is the same city on every machine and in every screenshot.
// The geometry helpers (distance, angle wrapping, circle-vs-rect) are the
// shared vocabulary of physics, AI and rendering.

// Deterministic RNG (mulberry32) plus small helpers shared by every system.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  ;
}
export function rngRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}
export function rngInt(rng, lo, hi) {
  return Math.floor(rngRange(rng, lo, hi + 1));
}
export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function circleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w), ny = clamp(cy, rect.y, rect.y + rect.h);
  return dist2(cx, cy, nx, ny) < r * r;
}
export function resolveCircleRect(p, r, rect) {
  const nx = clamp(p.x, rect.x, rect.x + rect.w), ny = clamp(p.y, rect.y, rect.y + rect.h);
  const dx = p.x - nx, dy = p.y - ny, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.001) {
    const d = Math.sqrt(d2);
    p.x = nx + (dx / d) * r;
    p.y = ny + (dy / d) * r;
  } else {
    p.x = rect.x - r;
  }
  return true;
}
