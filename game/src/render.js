// Solmar Bay — world rendering.
// Canvas 2D, camera-centred: district ground tints, roads with lane
// dashes, sidewalks and zebra crossings, shadowed buildings with lit
// windows, props, pickups, checkpoint rings, cars (with police livery,
// smoke and night headlights), walkers, tracers, particles and floaters.
// At night a tint and light pools are laid over the whole scene.

// World rendering: ground, roads, buildings, props, cars, people, effects. Signature first.
import { WORLD, ROADS, VIEW } from './config.js';
import { clamp, dist } from './random.js';
import { surfaceAt, districtAt } from './city.js';

export function renderWorld(ctx, G) {
  const cam = G.camera;
  ctx.fillStyle = '#79a86b'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  const x0 = Math.max(0, cam.x - 40), y0 = Math.max(0, cam.y - 40), x1 = cam.x + VIEW.w + 40, y1 = cam.y + VIEW.h + 40;
  // district ground tints in big tiles
  const T = 320;
  for (let gx = Math.floor(x0 / T) * T; gx < x1; gx += T) for (let gy = Math.floor(y0 / T) * T; gy < y1; gy += T) {
    const s = surfaceAt(gx + T / 2, gy + T / 2);
    ctx.fillStyle = s === 'water' ? '#2a7f9e' : s === 'sand' ? '#e6cf8f' : s === 'dock' ? '#8a8f7a' : districtAt(gx,
      gy) === 'Downtown' ? '#8f9779' : '#7fae72';
    ctx.fillRect(gx - cam.x, gy - cam.y, T + 1, T + 1);
  }
  drawRoads(ctx, G, x0, y0, x1, y1);
  drawCrosswalks(ctx, G, x0, y0, x1, y1);
  drawSkids(ctx, G);
  // beach water shimmer
  if (x1 > 4440) { ctx.fillStyle = 'rgba(70,170,200,0.5)';
  ctx.fillRect(4440 - cam.x, 0, WORLD.w - 4440, VIEW.h);
  }
  for (const b of G.city.buildings) { if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue; drawBuilding(ctx, G, b); }
  drawDistrictSigns(ctx, G);
  for (const pr of G.city.props) { if (pr.x < x0 || pr.x > x1 || pr.y < y0 || pr.y > y1) continue; drawProp(ctx, G, pr); }
  for (const pk of G.pickups) drawPickup(ctx, G, pk);
  if (G.taxi?.stage === 'drop') ring(ctx, G, G.taxi.x, G.taxi.y, '#ffd60a');
  if (G.race) { const cp = G.race.cps[G.race.idx]; if (cp) ring(ctx, G, cp.x, cp.y, '#00f5d4'); }
  const target = G.objectiveTarget?.();
  if (target && G.mode === 'play') ring(ctx, G, target.x, target.y, '#ffd166');
  for (const c of G.cars) { if (c.x < x0 - 80 || c.x > x1 + 80 || c.y < y0 - 80 || c.y > y1 + 80) continue; drawCar(ctx, G, c); }
  for (const ped of G.peds) drawPerson(ctx, G, ped.x, ped.y, ped.color, ped.angle, ped.phase, ped.alive, 'PED');
  if (G.mission?.escort?.alive) drawPerson(ctx, G, G.mission.escort.x, G.mission.escort.y, '#f15bb5', 0, G.time * 8, true, 'KIKI');
  for (const e of G.enemies) drawPerson(ctx, G, e.x, e.y, e.color, e.angle, G.time * 9, e.alive, 'VIPER');
  for (const cop of G.cops) if (!cop.inCar) drawPerson(ctx, G, cop.x, cop.y, '#274690', cop.angle || 0, G.time * 9, cop.alive, 'PD');
  if (!G.player.car) drawPlayer(ctx, G);
  // bullets / particles / floaters
  ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
  for (const b of G.bullets) { ctx.beginPath(); ctx.moveTo(b.x - cam.x, b.y - cam.y); ctx.lineTo(b.x - cam.x - b.vx * 0.018,
    b.y - cam.y - b.vy * 0.018); ctx.stroke(); }
  for (const pt of G.particles) { ctx.globalAlpha = clamp(pt.life / pt.max, 0,
    1); ctx.fillStyle = pt.color; ctx.fillRect(pt.x - cam.x - pt.size / 2, pt.y - cam.y - pt.size / 2, pt.size, pt.size); }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
  for (const f of G.floaters) { ctx.globalAlpha = 1 - f.t; ctx.fillStyle = f.color; ctx.fillText(f.text, f.x - cam.x, f.y - cam.y); }
  ctx.globalAlpha = 1;
  drawAmbient(ctx, G);
  if (G.night) {
    ctx.fillStyle = 'rgba(16,20,60,0.34)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    drawHeadlights(ctx, G);
  }
}
function ring(ctx, G, x, y, color) {
  const cam = G.camera, sx = x - cam.x, sy = y - cam.y, r = 34 + Math.sin(G.time * 4) * 5;
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.29); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(sx, sy - r - 26);
  ctx.lineTo(sx - 9, sy - r - 8);
  ctx.lineTo(sx + 9, sy - r - 8);
  ctx.fill();
}
function drawRoads(ctx, G, x0, y0, x1, y1) {
  const cam = G.camera;
  for (const vx of ROADS.vx) {
    if (vx + 90 < x0 || vx - 90 > x1) continue;
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(vx - ROADS.vw / 2 - ROADS.sidewalk - cam.x, 0, ROADS.vw + ROADS.sidewalk * 2, VIEW.h);
    ctx.fillStyle = '#3c4043'; ctx.fillRect(vx - ROADS.vw / 2 - cam.x, 0, ROADS.vw, VIEW.h);
    ctx.fillStyle = '#e8c547';
    for (let y = Math.floor(y0 / 64) * 64; y < y1; y += 64) ctx.fillRect(vx - 2 - cam.x, y - cam.y, 4, 34);
  }
  for (const hy of ROADS.hy) {
    if (hy + 84 < y0 || hy - 84 > y1) continue;
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(0, hy - ROADS.hw / 2 - ROADS.sidewalk - cam.y, VIEW.w, ROADS.hw + ROADS.sidewalk * 2);
    ctx.fillStyle = '#3c4043'; ctx.fillRect(0, hy - ROADS.hw / 2 - cam.y, VIEW.w, ROADS.hw);
    ctx.fillStyle = '#e8c547';
    for (let x = Math.floor(x0 / 64) * 64; x < x1; x += 64) ctx.fillRect(x - cam.x, hy - 2 - cam.y, 34, 4);
  }
}
function drawBuilding(ctx, G, b) {
  const cam = G.camera, x = b.x - cam.x, y = b.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 7, y + 9, b.w, b.h);
  ctx.fillStyle = b.color; ctx.fillRect(x, y, b.w, b.h);
  ctx.fillStyle = b.roof; ctx.fillRect(x + 5, y + 5, b.w - 10, b.h - 10);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  const cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 24));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (((i * 7 + j * 13 + b.id) % 3) !== 0) ctx.fillRect(x + 10 + i * 22,
    y + 10 + j * 20, 9, 7);
  if (b.name) { ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(b.name, x + b.w / 2, y + b.h / 2 + 4);
  }
}
function drawProp(ctx, G, pr) {
  const x = pr.x - G.camera.x, y = pr.y - G.camera.y;
  if (pr.kind === 'palm') { ctx.strokeStyle = '#6a4c2f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 3, y - 18);
  ctx.stroke();
  ctx.strokeStyle = '#2e9e4f';
  ctx.lineWidth = 3;
  for (let i = 0;
  i < 5;
  i++) { const a = (i / 5) * 6.28;
  ctx.beginPath();
  ctx.moveTo(x + 3, y - 18);
  ctx.lineTo(x + 3 + Math.cos(a) * 17, y - 18 + Math.sin(a) * 8 - 4);
  ctx.stroke();
  } }
  else if (pr.kind === 'lamp') { ctx.fillStyle = '#2b2d42';
  ctx.fillRect(x - 2, y - 14, 4, 14);
  ctx.fillStyle = G.night ? '#ffe66d' : '#ced4da';
  ctx.beginPath();
  ctx.arc(x, y - 16, 4, 0, 6.29);
  ctx.fill();
  if (G.night) { ctx.fillStyle = 'rgba(255,230,109,0.14)';
  ctx.beginPath();
  ctx.arc(x, y - 16, 26, 0, 6.29);
  ctx.fill();
  } }
  else if (pr.kind === 'crate') { ctx.fillStyle = '#9c6644';
  ctx.fillRect(x - 10, y - 10, 20, 20);
  ctx.strokeStyle = '#6f4518';
  ctx.strokeRect(x - 10, y - 10, 20, 20);
  }
  else if (pr.kind === 'bench') {
    ctx.fillStyle = '#7f5539';
    ctx.fillRect(x - 13, y - 4, 26, 6);
    ctx.fillRect(x - 13, y - 11, 26, 4);
  }
  else if (pr.kind === 'sign') {
    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(x - 2, y - 16, 4, 16);
    ctx.fillStyle = '#ffd60a';
    ctx.fillRect(x - 10, y - 22, 20, 10);
  }
  else if (pr.kind === 'barrel') {
    ctx.fillStyle = '#457b9d';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = '#1d3557';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 6.29);
    ctx.fill();
  }
  else { ctx.fillStyle = pr.kind === 'hydrant' ? '#e63946' : '#495057'; ctx.fillRect(x - 4, y - 7, 8, 12); }
}
function drawPickup(ctx, G, pk) {
  const x = pk.x - G.camera.x, y = pk.y - G.camera.y + Math.sin(G.time * 3 + pk.x) * 3;
  const colors = { cash: '#7bf1a8', ammo: '#ffd166', health: '#ffffff', armour: '#8ecae6', package: '#f15bb5' };
  ctx.fillStyle = colors[pk.kind] || '#fff'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#14213d'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : pk.kind === 'package' ? '?' : '•', x, y + 3);
}
export function drawCar(ctx, G, c) {
  const x = c.x - G.camera.x, y = c.y - G.camera.y;
  ctx.save(); ctx.translate(x, y); ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-c.w / 2 + 4, -c.h / 2 + 6, c.w, c.h);
  ctx.fillStyle = c.dead ? '#22252a' : c.color; roundRect(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 8); ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, -c.w * 0.12, -c.h * 0.36, c.w * 0.34, c.h * 0.72, 5);
  ctx.fill();
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(c.w / 2 - 7, -c.h / 2 + 4, 4, 7);
  ctx.fillRect(c.w / 2 - 7, c.h / 2 - 11, 4, 7);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 4, 4, 7);
  ctx.fillRect(-c.w / 2 + 3, c.h / 2 - 11, 4, 7);
  ctx.fillStyle = '#15181d';
  for (const [wx, wy] of [[-c.w / 2 + 12, -c.h / 2 - 2], [c.w / 2 - 12, -c.h / 2 - 2], [-c.w / 2 + 12, c.h / 2 - 4], [c.w / 2 - 12,
    c.h / 2 - 4]]) ctx.fillRect(wx - 6, wy, 12, 5);
  if (c.police) { ctx.fillStyle = '#fff';
  roundRect(ctx, -c.w * 0.3, -c.h * 0.3, c.w * 0.6, c.h * 0.6, 4);
  ctx.fill();
  ctx.fillStyle = '#1b263b';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('PD', 0, 3);
  const flash = Math.sin(G.time * 10 + c.sirenPhase) > 0;
  ctx.fillStyle = flash ? '#ff2e4d' : '#2e9bff';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, 6.29);
  ctx.fill();
  }
  if (c.smoke > 0.35) { ctx.fillStyle = `rgba(60,60,60,${0.35 + Math.random() * 0.2})`;
  ctx.beginPath();
  ctx.arc(c.w * 0.3, 0, 9 + Math.random() * 7, 0, 6.29);
  ctx.fill();
  }
  if (c.dead) { ctx.strokeStyle = '#ff9f1c';
  ctx.beginPath();
  ctx.moveTo(-14, -8);
  ctx.lineTo(10, 6);
  ctx.stroke();
  }
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath();
ctx.moveTo(x + r, y);
ctx.arcTo(x + w, y, x + w, y + h, r);
ctx.arcTo(x + w, y + h, x, y + h, r);
ctx.arcTo(x, y + h, x, y, r);
ctx.arcTo(x, y, x + w, y, r);
ctx.closePath();
}
export function drawPerson(ctx, G, x, y, color, angle, phase, alive, tag) {
  const sx = x - G.camera.x, sy = y - G.camera.y;
  if (sx < -30 || sx > 1310 || sy < -30 || sy > 750) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + 8, 10, 5, 0, 0, 6.29); ctx.fill();
  if (!alive) { ctx.fillStyle = color;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(1.2);
  ctx.fillRect(-11, -4, 22, 8);
  ctx.restore();
  return;
  }
  const bob = Math.sin(phase) * 2;
  ctx.strokeStyle = '#22223a'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + Math.cos(angle + 2.6) * 9, sy + Math.sin(angle + 2.6) * 9 + Math.abs(bob));
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + Math.cos(angle - 2.6) * 9, sy + Math.sin(angle - 2.6) * 9 - Math.abs(bob));
  ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy + bob * 0.3, 9, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#f2c29b';
  ctx.beginPath();
  ctx.arc(sx + Math.cos(angle) * 3, sy + Math.sin(angle) * 3 + bob * 0.3, 5.5, 0, 6.29);
  ctx.fill();
  if (tag === 'PD') { ctx.fillStyle = '#ffd166'; ctx.fillRect(sx - 4, sy - 6 + bob * 0.3, 8, 3); }
  void dist;
}
function drawPlayer(ctx, G) {
  const p = G.player;
  drawPerson(ctx, G, p.x, p.y, '#ffb703', p.aimAngle, p.walkPhase, true, 'YOU');
  // gun in hand
  if (p.weaponIdx > 0) { const sx = p.x - G.camera.x, sy = p.y - G.camera.y;
  ctx.strokeStyle = '#212529';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + Math.cos(p.aimAngle) * (p.weaponIdx === 2 ? 24 : 19), sy + Math.sin(p.aimAngle) * (p.weaponIdx === 2 ? 24 : 19));
  ctx.stroke();
  }
  if (p.arrestT > 0) { ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('BUSTED?', p.x - G.camera.x, p.y - G.camera.y - 30);
  }
}

// --- pass-two polish: crosswalks, skid marks, headlights -------------------
function drawCrosswalks(ctx, G, x0, y0, x1, y1) {
  const cam = G.camera;
  ctx.fillStyle = 'rgba(240,240,240,0.5)';
  for (const vx of ROADS.vx) {
    for (const hy of ROADS.hy) {
      if (vx < x0 - 90 || vx > x1 + 90 || hy < y0 - 90 || hy > y1 + 90) continue;
      const cx = vx - cam.x;
      const cy = hy - cam.y;
      // zebra stripes on all four approaches
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        ctx.fillRect(cx + i * 22 - 8, cy - ROADS.hw / 2 - 14, 15, 9);
        ctx.fillRect(cx + i * 22 - 8, cy + ROADS.hw / 2 + 5, 15, 9);
        ctx.fillRect(cx - ROADS.vw / 2 - 14, cy + i * 20 - 7, 9, 13);
        ctx.fillRect(cx + ROADS.vw / 2 + 5, cy + i * 20 - 7, 9, 13);
      }
    }
  }
}
function drawSkids(ctx, G) {
  if (!G.skids || G.skids.length === 0) return;
  const cam = G.camera;
  ctx.strokeStyle = 'rgba(20,20,20,0.4)';
  ctx.lineWidth = 4;
  for (const sk of G.skids) {
    ctx.globalAlpha = Math.max(0, sk.life / 14);
    ctx.beginPath();
    ctx.moveTo(sk.x1 - cam.x, sk.y1 - cam.y);
    ctx.lineTo(sk.x2 - cam.x, sk.y2 - cam.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawHeadlights(ctx, G) {
  const cam = G.camera;
  for (const c of G.cars) {
    if (c.dead) continue;
    const sx = c.x - cam.x;
    const sy = c.y - cam.y;
    if (sx < -260 || sx > 1540 || sy < -260 || sy > 980) continue;
    const grad = ctx.createRadialGradient(
      sx + Math.cos(c.angle) * 40, sy + Math.sin(c.angle) * 40, 8,
      sx + Math.cos(c.angle) * 90, sy + Math.sin(c.angle) * 90, 130,
    );
    grad.addColorStop(0, 'rgba(255,240,180,0.20)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx + Math.cos(c.angle) * 90, sy + Math.sin(c.angle) * 90, 130, 0, 6.29);
    ctx.fill();
  }
  // the player's own pool of light on foot
  if (!G.player.car) {
    const sx = G.player.x - cam.x;
    const sy = G.player.y - cam.y;
    const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, 120);
    grad.addColorStop(0, 'rgba(255,244,200,0.13)');
    grad.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, 120, 0, 6.29);
    ctx.fill();
  }
}

// District name signs at the gateways into each neighbourhood.
const DISTRICT_SIGNS = [
  { text: 'DOWNTOWN', x: 1600, y: 800 },
  { text: 'SOLMAR BEACH', x: 4160, y: 1250 },
  { text: 'PORTSIDE DOCKS', x: 960, y: 2760 },
  { text: 'NORTH HILLS', x: 960, y: 330 },
  { text: 'MIDTOWN', x: 2880, y: 2280 },
];
function drawDistrictSigns(ctx, G) {
  const cam = G.camera;
  ctx.textAlign = 'center';
  for (const sign of DISTRICT_SIGNS) {
    const sx = sign.x - cam.x;
    const sy = sign.y - cam.y;
    if (sx < -160 || sx > 1440 || sy < -60 || sy > 780) continue;
    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(sx - 4, sy, 8, 34);
    ctx.fillStyle = '#173f35';
    const w = ctx.measureText(sign.text).width + 70;
    ctx.beginPath();
    ctx.roundRect(sx - w / 2, sy - 26, w, 26, 5);
    ctx.fill();
    ctx.fillStyle = '#e9f5ec';
    ctx.font = 'bold 13px system-ui';
    ctx.fillText(sign.text, sx, sy - 8);
  }
}

// Ambient life: drifting cloud shadows by day, gulls over the beach.
const GULLS = [];
for (let i = 0; i < 7; i++) {
  GULLS.push({
    off: i * 173,
    speed: 22 + (i % 3) * 9,
    lane: 120 + i * 130,
    flap: i * 1.7,
  });
}
function drawAmbient(ctx, G) {
  const cam = G.camera;
  if (!G.night) {
    // two soft cloud shadows sweeping the city
    ctx.fillStyle = 'rgba(30,50,40,0.10)';
    for (let i = 0; i < 2; i++) {
      const cx = ((G.time * (14 + i * 6) + i * 900) % 6200) - 700 - cam.x;
      const cy = 200 + i * 260 + Math.sin(G.time * 0.1 + i) * 30 - (cam.y % 300);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 260, 90, 0, 0, 6.29);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 150, cy + 26, 170, 60, 0, 0, 6.29);
      ctx.fill();
    }
  }
  // gulls: small double-arcs gliding along the shoreline
  ctx.strokeStyle = G.night ? 'rgba(220,230,255,0.5)' : 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  for (const g of GULLS) {
    const gx = 4380 + Math.sin(G.time * 0.07 + g.off) * 60 - cam.x;
    const gy = ((G.time * g.speed + g.off * 10) % (3600 + 200)) - 100 - cam.y + g.lane * 0.1;
    if (gx < -40 || gx > 1330 || gy < -30 || gy > 760) continue;
    const f = Math.sin(G.time * 6 + g.flap) * 4;
    ctx.beginPath();
    ctx.moveTo(gx - 9, gy - f);
    ctx.quadraticCurveTo(gx - 3, gy + 3, gx, gy);
    ctx.quadraticCurveTo(gx + 3, gy + 3, gx + 9, gy - f);
    ctx.stroke();
  }
}
