// Solmar Bay — drawing the world: the bay, the sand, the pastel blocks, and everything that
// moves on top of them, all from one camera that follows Nico.
//
// The order is the depth: water and streets first, then skid marks, building shadows, the
// buildings themselves with their window grids, palms and fountains, cars, people, the
// player, particles, and the gold objective beacon last so it is never hidden. Everything
// is culled to the camera's view; the city is far bigger than the screen.

import { TILE, COLS, ROWS, COLORS } from './config.js';
import { rawTile, surfaceAt } from './city.js';

/** Spawn the particles a system asked for, age them, and age the skid marks. */
export function updateFx(G, dt) {
  for (const req of G.fx) {
    if (req.kind === 'burst') {
      for (let i = 0; i < (req.n ?? 8); i += 1) {
        const a = G.rng() * Math.PI * 2;
        const sp = 30 + G.rng() * 130;
        G.particles.push({
          x: req.x, y: req.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
          life: 0, max: 0.4 + G.rng() * 0.4, color: req.color, size: 2 + G.rng() * 3, grav: 160,
        });
      }
    } else if (req.kind === 'skid') {
      G.skids.push({ x: req.x, y: req.y, angle: G.player.car ? G.player.car.angle : 0, life: 0, max: 5 });
      if (G.skids.length > 240) G.skids.splice(0, G.skids.length - 240);
    } else if (req.kind === 'dust') {
      G.particles.push({
        x: req.x, y: req.y, vx: (G.rng() - 0.5) * 22, vy: -12 - G.rng() * 18,
        life: 0, max: 0.7, color: 'rgba(219,205,175,0.42)', size: 2.5 + G.rng() * 3.5, grav: -12,
      });
    }
  }
  G.fx.length = 0;

  for (const car of G.cars) {
    if (!car.wrecked) continue;
    car.smokeCd -= dt;
    if (car.smokeCd <= 0) {
      car.smokeCd = 0.14;
      G.particles.push({
        x: car.x + (G.rng() - 0.5) * 14, y: car.y - 6, vx: (G.rng() - 0.5) * 10, vy: -34 - G.rng() * 22,
        life: 0, max: 1.15, color: 'rgba(70,70,70,0.45)', size: 6 + G.rng() * 7, grav: -20,
      });
    }
  }

  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const p = G.particles[i];
    p.life += dt;
    if (p.life >= p.max) { G.particles.splice(i, 1); continue; }
    p.vy += (p.grav ?? 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = G.skids.length - 1; i >= 0; i -= 1) {
    G.skids[i].life += dt;
    if (G.skids[i].life >= G.skids[i].max) G.skids.splice(i, 1);
  }
}

/** A deterministic 0..1 hash of a position, for window patterns that must not flicker. */
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/** Draw one car: shadow, body, glass, lights; a light bar and a stripe for the law. */
function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(30,25,20,0.30)';
  ctx.beginPath();
  ctx.ellipse(3, 6, 27, 14, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  ctx.beginPath();
  ctx.roundRect(-23, -11.5, 46, 23, 6);
  ctx.fillStyle = car.kind === 'police' ? '#eef2f3' : car.color;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(20,20,25,0.45)';
  ctx.stroke();
  if (car.kind === 'police') {
    ctx.fillStyle = COLORS.policeBlue;
    ctx.fillRect(-23, -3.4, 46, 6.8);
    const phase = Math.sin(car.sirenPhase) > 0;
    ctx.fillStyle = phase ? COLORS.policeLightA : '#7a1620';
    ctx.fillRect(-3, -7.5, 6, 5.5);
    ctx.fillStyle = phase ? '#1d5f7a' : COLORS.policeLightB;
    ctx.fillRect(-3, 2, 6, 5.5);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 6.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICIA', 0, 1.6);
  }
  // Cabin and glass.
  ctx.fillStyle = 'rgba(24,34,44,0.88)';
  ctx.beginPath();
  ctx.roundRect(-9, -9, 15, 18, 3.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,190,215,0.55)';
  ctx.fillRect(4.5, -8, 3.4, 16);
  ctx.fillRect(-12.5, -8, 2.6, 16);
  // Lights: headlights ahead, tail lights behind.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(21.6, -8.6, 2.2, 4.6);
  ctx.fillRect(21.6, 4, 2.2, 4.6);
  ctx.fillStyle = '#d64550';
  ctx.fillRect(-23.4, -8.6, 2, 4.6);
  ctx.fillRect(-23.4, 4, 2, 4.6);
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(25,22,20,0.42)';
    ctx.beginPath();
    ctx.roundRect(-23, -11.5, 46, 23, 6);
    ctx.fill();
  }
  ctx.restore();
  void time;
}

/** Draw one person: legs mid-stride when moving, a shirt, a head, a shadow underneath. */
function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(30,25,20,0.26)';
  ctx.beginPath();
  ctx.ellipse(1.5, 4, 9.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.down) {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 6.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(14.5, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const stride = ped.speed > 4 ? Math.sin(ped.stepPhase * 6) * 4.4 : 0;
  ctx.rotate(ped.angle);
  ctx.strokeStyle = ped.pants;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-3.4 + stride * 0.4, -4.6);
  ctx.moveTo(0, 0);
  ctx.lineTo(-3.4 - stride * 0.4, 4.6);
  ctx.stroke();
  ctx.rotate(-ped.angle);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(1.6, 0, 4.7, 0, Math.PI * 2);
  ctx.fill();
  if (ped.role === 'officer') {
    ctx.fillStyle = COLORS.policeBlue;
    ctx.beginPath();
    ctx.arc(1.6, 0, 5.4, Math.PI * 0.85, Math.PI * 1.9);
    ctx.fill();
  }
  if (ped.role === 'thug') {
    ctx.fillStyle = '#c1121f';
    ctx.fillRect(-4.5, -5.4, 9, 3);
  }
  ctx.restore();

  if (ped.role === 'giver') {
    const bob = Math.sin(performance.now() / 380) * 2.4;
    ctx.save();
    ctx.translate(ped.x, ped.y - 30 + bob);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, 0);
    ctx.restore();
  }
}

/** The whole world, one frame. */
export function drawWorld(ctx, G) {
  const { w, h } = G.view;
  const cam = G.camera;
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const x1 = Math.min(COLS - 1, Math.ceil((cam.x + w) / TILE) + 1);
  const y1 = Math.min(ROWS - 1, Math.ceil((cam.y + h) / TILE) + 1);

  ctx.fillStyle = COLORS.waterDeep;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // Ground tiles.
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      const raw = rawTile(tx, ty);
      const px = tx * TILE;
      const py = ty * TILE;
      if (raw === 'water') {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.water : COLORS.waterDeep;
        ctx.fillRect(px, py, TILE, TILE);
      } else if (raw === 'sand') {
        ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.sand : COLORS.sandWet;
        ctx.fillRect(px, py, TILE, TILE);
      } else if (raw === 'road') {
        ctx.fillStyle = COLORS.road;
        ctx.fillRect(px, py, TILE, TILE);
      } else {
        const s = surfaceAt(G.city, px + TILE / 2, py + TILE / 2);
        ctx.fillStyle = s === 'grass' ? ((tx + ty) % 2 === 0 ? COLORS.grass : COLORS.grassDark)
          : s === 'asphalt' ? COLORS.parking
            : s === 'plaza' ? COLORS.plaza
              : COLORS.walk;
        ctx.fillRect(px, py, TILE, TILE);
        if (s === 'walk') {
          ctx.strokeStyle = 'rgba(120,110,90,0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
      }
    }
  }

  // Lane paint: edge lines and dashed centres along every road band in view.
  ctx.strokeStyle = 'rgba(240,238,225,0.65)';
  ctx.lineWidth = 2;
  for (const cx of G.city.vRoads) {
    if (cx < cam.x - TILE || cx > cam.x + w + TILE) continue;
    ctx.beginPath();
    ctx.moveTo(cx - TILE, cam.y - 8);
    ctx.lineTo(cx - TILE, cam.y + h + 8);
    ctx.moveTo(cx + TILE, cam.y - 8);
    ctx.lineTo(cx + TILE, cam.y + h + 8);
    ctx.stroke();
    ctx.setLineDash([16, 18]);
    ctx.beginPath();
    ctx.moveTo(cx, cam.y - 8);
    ctx.lineTo(cx, cam.y + h + 8);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const cy of G.city.hRoads) {
    if (cy < cam.y - TILE || cy > cam.y + h + TILE) continue;
    ctx.beginPath();
    ctx.moveTo(cam.x - 8, cy - TILE);
    ctx.lineTo(cam.x + w + 8, cy - TILE);
    ctx.moveTo(cam.x - 8, cy + TILE);
    ctx.lineTo(cam.x + w + 8, cy + TILE);
    ctx.stroke();
    ctx.setLineDash([16, 18]);
    ctx.beginPath();
    ctx.moveTo(cam.x - 8, cy);
    ctx.lineTo(cam.x + w + 8, cy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Skid marks under everything that moves.
  for (const skid of G.skids) {
    ctx.save();
    ctx.translate(skid.x, skid.y);
    ctx.rotate(skid.angle);
    ctx.fillStyle = `rgba(25,22,20,${0.34 * (1 - skid.life / skid.max)})`;
    ctx.fillRect(-7, -2.4, 14, 4.8);
    ctx.restore();
  }

  // Buildings: shadow, pastel body, a lighter roof inset, a grid of windows.
  for (const b of G.city.buildings) {
    if (b.x + b.w < cam.x || b.x > cam.x + w || b.y + b.h < cam.y || b.y > cam.y + h) continue;
    ctx.fillStyle = COLORS.roofShadow;
    ctx.fillRect(b.x + 9, b.y + 13, b.w, b.h);
    ctx.fillStyle = b.paint;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = COLORS.buildingShade;
    ctx.fillRect(b.x, b.y + b.h * 0.62, b.w, b.h * 0.38);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.strokeStyle = 'rgba(90,70,55,0.5)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    const cols = Math.max(2, Math.floor(b.w / 21));
    const rowsW = Math.max(2, b.floors + 1);
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rowsW; j += 1) {
        const wx = b.x + 10 + (i + 0.5) * ((b.w - 20) / cols) - 3;
        const wy = b.y + 10 + (j + 0.5) * ((b.h - 20) / rowsW) - 2.4;
        ctx.fillStyle = hash2(Math.round(b.x) + i * 7, Math.round(b.y) + j * 13) > 0.42 ? COLORS.windowLit : COLORS.windowDark;
        ctx.fillRect(wx, wy, 6, 4.6);
      }
    }
    if (b.name) {
      ctx.fillStyle = 'rgba(30,28,26,0.78)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(b.name).width + 12;
      ctx.fillRect(b.x + b.w / 2 - tw / 2, b.y + b.h - 19, tw, 15);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h - 8);
    }
  }

  // Fountains and palms.
  for (const f of G.city.fountains) {
    if (f.x < cam.x - 60 || f.x > cam.x + w + 60 || f.y < cam.y - 60 || f.y > cam.y + h + 60) continue;
    ctx.fillStyle = '#9db8ad';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.water;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(f.x, f.y, 4.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of G.city.palms) {
    if (p.x < cam.x - 30 || p.x > cam.x + w + 30 || p.y < cam.y - 30 || p.y > cam.y + h + 30) continue;
    ctx.strokeStyle = COLORS.palmTrunk;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 3, p.y - 7);
    ctx.stroke();
    ctx.strokeStyle = COLORS.palmLeaf;
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x + 3, p.y - 7);
      ctx.quadraticCurveTo(
        p.x + 3 + Math.cos(a) * 10, p.y - 7 + Math.sin(a) * 8 - 3,
        p.x + 3 + Math.cos(a) * 16, p.y - 7 + Math.sin(a) * 12 + 3,
      );
      ctx.stroke();
    }
  }

  // Vehicles, people, the player.
  for (const car of G.cars) {
    if (car.x < cam.x - 60 || car.x > cam.x + w + 60 || car.y < cam.y - 60 || car.y > cam.y + h + 60) continue;
    drawCar(ctx, car, G.time);
  }
  for (const ped of G.peds) {
    if (ped.x < cam.x - 30 || ped.x > cam.x + w + 30 || ped.y < cam.y - 30 || ped.y > cam.y + h + 30) continue;
    drawPed(ctx, ped);
  }
  if (!G.player.inCar) {
    drawPed(ctx, { ...G.player, role: 'player', shirt: COLORS.playerShirt ?? '#e4572e', skin: '#c98d64', pants: '#2e4057', down: false, speed: G.player.moving ? 120 : 0 });
    // The hero marker: a small gold chevron that always finds Nico.
    const bob = Math.sin(G.time * 4) * 3;
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.moveTo(G.player.x, G.player.y - 26 + bob);
    ctx.lineTo(G.player.x - 6, G.player.y - 35 + bob);
    ctx.lineTo(G.player.x + 6, G.player.y - 35 + bob);
    ctx.closePath();
    ctx.fill();
  }

  // Particles.
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The objective beacon: a pillar of gold light that can be seen across the city.
  const marker = G.missions.marker;
  if (marker && G.screen === 'play') {
    const pulse = 0.65 + Math.sin(G.time * 5) * 0.2;
    const grad = ctx.createLinearGradient(marker.x, marker.y - 190, marker.x, marker.y);
    grad.addColorStop(0, 'rgba(255,201,60,0)');
    grad.addColorStop(1, `rgba(255,201,60,${0.4 * pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(marker.x - 13, marker.y - 190, 26, 190);
    ctx.strokeStyle = `rgba(255,201,60,${pulse})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(marker.x, marker.y, 21 + Math.sin(G.time * 5) * 3.4, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // Golden-hour wash and a soft vignette over the whole frame.
  ctx.fillStyle = 'rgba(255,166,66,0.055)';
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vg.addColorStop(0, 'rgba(20,10,0,0)');
  vg.addColorStop(1, 'rgba(20,10,0,0.30)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  if (G.player.hurtAgo < 0.3) {
    ctx.fillStyle = `rgba(239,71,111,${0.22 * (1 - G.player.hurtAgo / 0.3)})`;
    ctx.fillRect(0, 0, w, h);
  }
}
