// Solmar Bay — heads-up display.
// Health and armour bars, cash, weapon and ammo, wanted stars with a
// heat meter, the current objective, centre prompts, mission banners,
// dialogue boxes and a live minimap (roads, buildings, water, police
// dots, the objective marker and a north-up player arrow). Title, help,
// pause and end screens are drawn here too.

// HUD: bars, cash, weapon, stars, objective, prompts, banners, dialogue, minimap.
import {
  VIEW, WORLD, ROADS
}
from './config.js';
import {
  clamp
}
from './random.js';
import {
  starsOf
}
from './police.js';
import {
  objectiveText
}
from './missions.js';
import {
  completionPct
}
from './save.js';
import {
  districtAt
}
from './city.js';
export function drawHUD(ctx, G) {
  const p = G.player;
  // top-left panel
  panel(ctx, 14, 14, 252, 104);
  bar(ctx, 26, 28, 160, 13, p.hp / 100, '#57cc5e', 'HP');
  bar(ctx, 26, 48, 160, 10, p.armour / 100, '#6ea8fe', 'ARM');
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 21px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(`$${Math.floor(p.cash)}`, 26, 88);
  ctx.fillStyle = '#aeb8c4';
  ctx.font = '12px system-ui';
  ctx.fillText(`${districtAt(p.x, p.y)}  •  ${completionPct(G)}% complete`, 108, 88);
  // weapon box
  panel(ctx, VIEW.w - 196, 14, 182, 62);
  const w = p.weapons[p.weaponIdx];
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px system-ui';
  ctx.fillText(w.def.name.toUpperCase(), VIEW.w - 182, 40);
  ctx.fillStyle = '#ffd166';
  ctx.font = '14px system-ui';
  ctx.fillText(w.def.mag === Infinity ? '—' : `${w.inMag} / ${w.ammo === Infinity ? '∞' : w.ammo}${p.reloadT > 0 ? '  RELOADING…' : ''}`,     VIEW.w - 182, 62);
  // stars
  const s = starsOf(G);
  ctx.font = '24px system-ui';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < s ? '#ffd60a' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★',     VIEW.w - 24 - (4 - i) * 28, 108);
  }
  if (p.arrestT > 0) {
    ctx.fillStyle = '#e63946';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText('BUSTED METER', VIEW.w - 24, 132);
    bar(ctx, VIEW.w - 184, 138, 160, 8, p.arrestT / 1.6, '#e63946', '');
  }
  // objective
  panel(ctx, VIEW.w / 2 - 300, 14, 600, 40);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 14px system-ui';
  ctx.textAlign = 'center';
  const obj = objectiveText(G);
  ctx.fillText(G.mission ? `▸ ${G.mission.def.title}: ${obj}` : obj, VIEW.w / 2, 40);
  if (G.mission?.def.time && G.mission.state !== 'dialogue') {
    ctx.fillStyle = G.mission.timer < 15 ? '#ff5964' : '#fff';
    ctx.fillText(`${Math.max(0, G.mission.timer).toFixed(0)}s`, VIEW.w / 2, 70);
  }
  if (G.race) {
    ctx.fillStyle = '#00f5d4';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(`RACE checkpoint ${G.race.idx + 1}/5 — ${G.race.t.toFixed(0)}s`, VIEW.w / 2, 70);
  }
  drawCompass(ctx, G);
  drawMinimap(ctx, G);
  // wanted meter: a thin heat bar under the stars so decay is readable
  if (G.heat > 0) {
    const frac = (G.heat - Math.floor(G.heat));
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(VIEW.w - 152, 116, 128, 5);
    ctx.fillStyle = G.seenT > 3 ? '#57cc5e' : '#e63946';
    ctx.fillRect(VIEW.w - 152, 116, 128 * (frac || 1), 5);
  }
  // prompt centre-bottom
  if (G.promptT > 0 && G.promptText) {
    ctx.globalAlpha = clamp(G.promptT, 0, 1);
    panel(ctx, VIEW.w / 2 - 240, VIEW.h - 118, 480, 36);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(G.promptText, VIEW.w / 2, VIEW.h - 94);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(p.car ? 'WASD drive • SPACE handbrake • E exit • N mute' : 'WASD move • SHIFT sprint • E enter car • F melee • CLICK shoot • 1/2/3 weapons', VIEW.w / 2, VIEW.h - 12);
  if (G.banner) drawBanner(ctx, G);
  if (G.mission?.state === 'dialogue') drawDialogue(ctx, G);
  // damage vignette
  if (p.hurtFlash > 0) {
    const g = ctx.createRadialGradient(640, 360, 240, 640, 360, 720);
    g.addColorStop(0, 'rgba(200,0,0,0)');
    g.addColorStop(1, `rgba(200,0,0,${p.hurtFlash * 0.8})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
  if (G.heat > 0.4 && G.seenT > 3) {
    ctx.fillStyle = '#8ecae6';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('BREAK LINE OF SIGHT TO LOSE HEAT', VIEW.w / 2, 128);
  }
}
function drawCompass(ctx, G) {
  // a slim compass ribbon: N/E/S/W slide past as the aim (or car) turns
  const a = G.player.car ? G.player.car.angle : (G.player.aimAngle || 0);
  const cx = VIEW.w / 2;
  const y = 62;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 110, y - 11, 220, 20);
  ctx.clip();
  ctx.fillStyle = 'rgba(10,14,22,0.55)';
  ctx.fillRect(cx - 110, y - 11, 220, 20);
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  const pts = [['N', -Math.PI / 2], ['E', 0], ['S', Math.PI / 2], ['W', Math.PI]];
  for (const [label, ang] of pts) {
    for (let k = -1; k <= 1; k++) {
      let rel = ang + k * Math.PI * 2 - a;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      const sx = cx + rel * 64;
      ctx.fillStyle = label === 'N' ? '#ff5964' : '#e8ecf1';
      ctx.fillText(label, sx, y + 4);
    }
  }
  ctx.fillStyle = '#ffd60a';
  ctx.fillRect(cx - 1, y - 11, 2, 6);
  ctx.restore();
}
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,14,22,0.68)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.stroke();
}
function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 4, y + h - 2);
  }
}
function drawBanner(ctx, G) {
  const b = G.banner, a = clamp(b.t < 0.4 ? b.t / 0.4 : b.t > 3 ? Math.max(0, 1 - (b.t - 3)) : 1, 0, 1);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8,10,18,0.82)';
  ctx.fillRect(0, 250, VIEW.w, 120);
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 44px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(b.title, VIEW.w / 2, 302);
  ctx.fillStyle = '#e8ecf1';
  ctx.font = '18px system-ui';
  ctx.fillText(b.sub || '', VIEW.w / 2, 336);
  ctx.globalAlpha = 1;
}
function drawDialogue(ctx, G) {
  const step = G.mission.def.steps[G.mission.stepIdx];
  const line = step.lines[Math.min(G.mission.lineIdx, step.lines.length - 1)];
  panel(ctx, 190, VIEW.h - 190, 900, 120);
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 17px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(line[0], 214, VIEW.h - 152);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui';
  wrapText(ctx, line[1], 214, VIEW.h - 122, 850, 22);
  ctx.fillStyle = '#aeb8c4';
  ctx.font = '13px system-ui';
  ctx.fillText('ENTER ▸', 1000, VIEW.h - 84);
}
function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW) {
      ctx.fillText(line, x, yy);
      yy += lh;
      line = '';
    }
    line += w + ' ';
  }
  ctx.fillText(line, x, yy);
}
export function drawMinimap(ctx, G) {
  const S = 172, X = VIEW.w - S - 14, Y = VIEW.h - S - 34;
  const sx = S / WORLD.w, sy = S / WORLD.h;
  ctx.save();
  panel(ctx, X - 4, Y - 4, S + 8, S + 8);
  ctx.fillStyle = '#31572c';
  ctx.fillRect(X, Y, S, S);
  ctx.fillStyle = '#2a7f9e';
  ctx.fillRect(X + 4440 * sx, Y, (WORLD.w - 4440) * sx, S);
  ctx.fillStyle = '#e6cf8f';
  ctx.fillRect(X + 4240 * sx, Y, 200 * sx, S);
  ctx.strokeStyle = '#565b60';
  ctx.lineWidth = 3;
  for (const vx of ROADS.vx) {
    ctx.beginPath();
    ctx.moveTo(X + vx * sx, Y);
    ctx.lineTo(X + vx * sx, Y + S);
    ctx.stroke();
  }
  for (const hy of ROADS.hy) {
    ctx.beginPath();
    ctx.moveTo(X, Y + hy * sy);
    ctx.lineTo(X + S, Y + hy * sy);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(220,225,235,0.5)';
  for (const b of G.city.buildings) ctx.fillRect(X + b.x * sx, Y + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  const dot = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(X + x * sx, Y + y * sy, r, 0, 6.29);
    ctx.fill();
  }
  ;
  for (const cop of G.cops) if (cop.alive) dot(cop.x, cop.y, Math.sin(G.time * 8) > 0 ? '#ff2e4d' : '#2e9bff', 2.6);
  const t = G.objectiveTarget?.();
  if (t) dot(t.x, t.y, '#ffd60a', 4);
  if (G.taxi?.stage === 'drop') dot(G.taxi.x, G.taxi.y, '#ffd60a', 3.5);
  // player arrow
  const px = X + G.player.x * sx, py = Y + G.player.y * sy, a = G.player.car ? G.player.car.angle : G.player.aimAngle || 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(a);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('N', X + S / 2, Y - 8 + 10);
  ctx.restore();
}
export function drawTitle(ctx, G) {
  ctx.fillStyle = 'rgba(7,10,20,0.55)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd60a';
  ctx.font = '900 84px system-ui';
  ctx.fillText('SOLMAR BAY', 640, 215);
  ctx.fillStyle = '#e8ecf1';
  ctx.font = '20px system-ui';
  ctx.fillText('One bay. Five stars. Your tide to catch.', 640, 252);
  const items = G.titleItems;
  items.forEach((it, i) => { const y = 330 + i * 54;
    const sel = i === G.titleSel;
    ctx.fillStyle = sel ? '#ffd60a' : 'rgba(10,14,22,0.7)';
    ctx.beginPath();
    ctx.roundRect(490, y - 32, 300, 44, 9);
    ctx.fill();
    ctx.fillStyle = sel ? '#14213d' : '#fff';
    ctx.font = 'bold 19px system-ui';
    ctx.fillText(it, 640, y);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '13px system-ui';
  ctx.fillText('↑↓ / W S to choose • ENTER to confirm • Sound: ' + (G.audio.muted ? 'OFF' : 'ON'), 640, 590);
  if (G.showHelp) drawHelp(ctx);
}
export function drawHelp(ctx) {
  panel(ctx, 290, 120, 700, 470);
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 26px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('HOW TO PLAY', 640, 168);
  ctx.fillStyle = '#e8ecf1';
  ctx.font = '15px system-ui';
  ctx.textAlign = 'left';
  const lines = ['WASD / Arrows — move & drive        SHIFT — sprint', 'E — enter / steal / exit car        SPACE — handbrake',     'Mouse — aim, Click — shoot          F — melee', '1 / 2 / 3 — Fists / Pistol / SMG    R — reload', 'P / Esc — pause                     N — mute', '', 'Crimes raise your wanted stars when witnessed.', 'Lose police line of sight to cool down, or pay', 'Bay City Customs $150 to clear your heat.', 'Busted = respawn at Solmar PD, lose cash.', 'Wasted = respawn at St. Alba Hospital, pay the fee.', 'Follow the gold ring & minimap marker to work.', 'Visit Iron Rose Arms (walk in) to buy ammo & armour.'];
  lines.forEach((l, i) => ctx.fillText(l, 340, 208 + i * 26));
  ctx.textAlign = 'center';
  ctx.fillStyle = '#aeb8c4';
  ctx.fillText('ENTER / ESC to go back', 640, 566);
}
export function drawPause(ctx, G) {
  ctx.fillStyle = 'rgba(5,8,14,0.72)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', 640, 250);
  ctx.font = '19px system-ui';
  ctx.fillStyle = '#ffd60a';
  ctx.fillText('ENTER — resume', 640, 320);
  ctx.fillText('S — save game', 640, 356);
  ctx.fillText('M — toggle sound', 640, 392);
  ctx.fillStyle = '#aeb8c4';
  ctx.font = '15px system-ui';
  ctx.fillText(`Completion ${completionPct(G)}% • Packages ${G.packagesFound}/10 • Fares ${G.fares || 0} • Races ${G.racesWon || 0}`,     640, 450);
}
export function drawEndScreen(ctx, G, title, sub, color) {
  ctx.fillStyle = 'rgba(5,8,14,0.8)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.fillStyle = color;
  ctx.font = '900 64px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(title, 640, 300);
  ctx.fillStyle = '#e8ecf1';
  ctx.font = '19px system-ui';
  ctx.fillText(sub, 640, 344);
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 17px system-ui';
  ctx.fillText('Press ENTER to keep rolling', 640, 410);
}
