// Solmar Bay — everything drawn over the world: the HUD (cash, health, wanted stars, the
// clock, the district), the minimap with its blips, the objective line, dialogue boxes,
// notifications, and the full-screen states — title, help, pause, and the two ways a day
// ends. The game loop owns the state; this file only reads it and draws.

import { COLORS, GAME_NAME, GAME_SUBTITLE } from './config.js';
import { districtAt } from './city.js';
import { wantedLevel } from './police.js';
import { objectiveText } from './missions.js';
import { nearestEnterableCar } from './player.js';

/** Wrap a line of text to a pixel width, returning the lines. */
function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A five-pointed star path centred at (x, y). */
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** The in-play HUD. */
export function drawHUD(ctx, G) {
  const { w } = G.view;
  const P = G.player;

  // Top-left: cash and health in a soft panel.
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(14, 14, 208, 74, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 25px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${Math.floor(P.cash)}`, 28, 47);
  ctx.fillStyle = 'rgba(253,246,227,0.75)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`earned $${Math.floor(G.missions.totalEarned)} in Solmar Bay`, 28, 63);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(28, 70, 180, 7);
  ctx.fillStyle = P.hp > 30 ? '#7bc96f' : COLORS.danger;
  ctx.fillRect(28, 70, 180 * Math.max(0, P.hp / 100), 7);

  // Top-right: wanted stars, the clock, the district.
  const level = wantedLevel(G);
  for (let i = 0; i < 5; i += 1) {
    const x = w - 34 - (4 - i) * 30;
    star(ctx, x, 32, 12.5);
    ctx.fillStyle = i < level ? COLORS.gold : 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,20,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const hh = String(Math.floor(G.clockMin / 60) % 24).padStart(2, '0');
  const mm = String(Math.floor(G.clockMin % 60)).padStart(2, '0');
  ctx.fillStyle = COLORS.hudInk;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${hh}:${mm}`, w - 22, 66);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(253,246,227,0.8)';
  ctx.fillText(districtAt(G.city, P.x, P.y), w - 22, 84);

  // The bust meter, when the law has its hands nearly on him.
  if (G.wanted.bust > 0.02) {
    const bw = 260;
    ctx.fillStyle = COLORS.hudPanel;
    ctx.beginPath();
    ctx.roundRect(w / 2 - bw / 2, 18, bw, 26, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.danger;
    ctx.fillRect(w / 2 - bw / 2 + 4, 22, (bw - 8) * G.wanted.bust, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', w / 2, 35);
  }

  // A conversation owns the bottom of the screen — the map steps aside for it.
  if (!G.dialogue) drawMinimap(ctx, G);

  // Objective, bottom centre — or the dialogue that replaces it.
  if (G.dialogue) drawDialogue(ctx, G);
  else {
    const text = objectiveText(G);
    if (text) {
      ctx.font = '14.5px system-ui, sans-serif';
      const lines = wrap(ctx, text, 520);
      const bw = Math.min(560, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 30);
      const bh = lines.length * 19 + 16;
      ctx.fillStyle = COLORS.hudPanel;
      ctx.beginPath();
      ctx.roundRect(w / 2 - bw / 2, G.view.h - bh - 14, bw, bh, 9);
      ctx.fill();
      ctx.fillStyle = COLORS.hudInk;
      ctx.textAlign = 'center';
      lines.forEach((line, i) => ctx.fillText(line, w / 2, G.view.h - bh + 8 + (i + 1) * 19 - 14 + 14));
    }
  }

  // Interact prompts.
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  if (!G.dialogue) {
    if (P.inCar && Math.abs(P.car.speed) < 46) {
      prompt(ctx, G, 'F — get out');
    } else if (!P.inCar) {
      const giver = G.peds.find((p) => p.role === 'giver' && Math.hypot(p.x - P.x, p.y - P.y) < 58);
      if (giver) prompt(ctx, G, `E — talk to ${giver.name}`);
      else if (nearestEnterableCar(G)) prompt(ctx, G, 'F — get in the car');
    }
  }

  // Speed, when driving.
  if (P.inCar) {
    ctx.fillStyle = COLORS.hudInk;
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(P.car.speed) * 0.32)} km/h`, w - 24, G.view.h - 178);
  }

  // Notifications stack, top centre, fading.
  ctx.textAlign = 'center';
  G.notes.forEach((note, i) => {
    const age = G.time - note.t;
    const alpha = age < 2.4 ? 1 : Math.max(0, 1 - (age - 2.4) / 0.6);
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 16.5px system-ui, sans-serif';
    const tw = ctx.measureText(note.text).width + 28;
    ctx.fillStyle = COLORS.hudPanel;
    ctx.beginPath();
    ctx.roundRect(G.view.w / 2 - tw / 2, 100 + i * 34, tw, 27, 8);
    ctx.fill();
    ctx.fillStyle = note.color;
    ctx.fillText(note.text, G.view.w / 2, 119 + i * 34);
    ctx.globalAlpha = 1;
  });

  // A whisper of controls, bottom-left.
  ctx.fillStyle = 'rgba(253,246,227,0.5)';
  ctx.font = '11.5px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move · F car · E talk · J punch · Space handbrake · Esc pause · M mute', 16, G.view.h - 12);
}

/** A little pill prompt above the player's head. */
function prompt(ctx, G, text) {
  ctx.font = 'bold 14px system-ui, sans-serif';
  const tw = ctx.measureText(text).width + 22;
  const sx = G.player.x - G.camera.x;
  const sy = G.player.y - G.camera.y;
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(sx - tw / 2, sy - 74, tw, 24, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.hudInk;
  ctx.fillText(text, sx, sy - 57);
}

/** The dialogue box: speaker, the current line, and the way onward. */
function drawDialogue(ctx, G) {
  const { w, h } = G.view;
  const d = G.dialogue;
  const bh = 108;
  ctx.fillStyle = 'rgba(16,19,26,0.88)';
  ctx.beginPath();
  ctx.roundRect(24, h - bh - 18, w - 48, bh, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,201,60,0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(d.speaker, 44, h - bh + 12);
  ctx.fillStyle = COLORS.hudInk;
  ctx.font = '16.5px system-ui, sans-serif';
  const lines = wrap(ctx, d.lines[d.i], w - 96);
  lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, 44, h - bh + 38 + i * 22));
  ctx.fillStyle = 'rgba(253,246,227,0.65)';
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(d.i < d.lines.length - 1 ? 'E — next ▸' : 'E — done ▸', w - 44, h - 30);
}

/** The minimap: the whole bay in a corner, with everyone who matters as a blip. */
export function drawMinimap(ctx, G) {
  const mw = 198;
  const mh = 146;
  const mx = G.view.w - mw - 14;
  const my = G.view.h - mh - 14;
  const sx = mw / G.city.width;
  const sy = mh / G.city.height;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 9);
  ctx.clip();
  ctx.fillStyle = '#256a75';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(mx + 5 * (48 * sx), my, 2 * 48 * sx, mh);
  for (const b of G.city.blocks) {
    ctx.fillStyle = b.kind === 'park' ? '#6d9c4e' : b.kind === 'parking' ? '#5a5e63' : b.kind === 'plaza' ? '#d8c9a8' : '#cbbfa5';
    ctx.fillRect(mx + b.x * sx, my + b.y * sy, b.size * sx, b.size * sy);
  }
  ctx.strokeStyle = 'rgba(40,42,48,0.85)';
  ctx.lineWidth = 2.6;
  for (const cx of G.city.vRoads) {
    ctx.beginPath(); ctx.moveTo(mx + cx * sx, my); ctx.lineTo(mx + cx * sx, my + mh); ctx.stroke();
  }
  for (const cy of G.city.hRoads) {
    ctx.beginPath(); ctx.moveTo(mx, my + cy * sy); ctx.lineTo(mx + mw, my + cy * sy); ctx.stroke();
  }
  const dot = (x, y, color, r = 2.6) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const car of G.cars) {
    if (car.kind === 'police') dot(car.x, car.y, Math.sin(car.sirenPhase) > 0 ? '#ff5964' : '#4cc9f0', 3);
  }
  for (const ped of G.peds) if (ped.role === 'giver') dot(ped.x, ped.y, '#7bc96f', 3);
  if (G.missions.marker) {
    const pulse = 3.4 + Math.sin(G.time * 5) * 1.1;
    dot(G.missions.marker.x, G.missions.marker.y, '#ffc93c', pulse);
  }
  // The player: a white arrow that turns with him.
  const px = mx + G.player.x * sx;
  const py = my + G.player.y * sy;
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(6.4, 0);
  ctx.lineTo(-4.4, -3.8);
  ctx.lineTo(-4.4, 3.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(253,246,227,0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 9);
  ctx.stroke();
}

/** Layout of the current menu's rows, shared by the drawing and the mouse. */
export function menuLayout(G) {
  const items = G.menu?.items ?? [];
  const startY = G.view.h * 0.52;
  return items.map((item, i) => ({
    ...item,
    x: G.view.w / 2 - 150,
    y: startY + i * 46,
    w: 300,
    h: 38,
  }));
}

function drawMenu(ctx, G) {
  const layout = menuLayout(G);
  layout.forEach((item, i) => {
    const selected = G.menu.selected === i;
    ctx.fillStyle = selected ? 'rgba(255,201,60,0.92)' : 'rgba(16,19,26,0.66)';
    ctx.beginPath();
    ctx.roundRect(item.x, item.y, item.w, item.h, 9);
    ctx.fill();
    ctx.fillStyle = selected ? '#23202a' : COLORS.hudInk;
    ctx.font = 'bold 16.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.label, item.x + item.w / 2, item.y + 25);
  });
}

/** The title screen, over the slowly panning city. */
export function drawTitle(ctx, G) {
  const { w, h } = G.view;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(24,16,32,0.62)');
  grad.addColorStop(0.55, 'rgba(24,16,32,0.28)');
  grad.addColorStop(1, 'rgba(24,16,32,0.66)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('· S O L M A R ·', w / 2, h * 0.2);
  const titleGrad = ctx.createLinearGradient(0, h * 0.24, 0, h * 0.4);
  titleGrad.addColorStop(0, '#ffe9a8');
  titleGrad.addColorStop(0.6, '#ffc93c');
  titleGrad.addColorStop(1, '#f4842c');
  ctx.fillStyle = titleGrad;
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillText(GAME_NAME, w / 2, h * 0.37);
  ctx.fillStyle = 'rgba(253,246,227,0.92)';
  ctx.font = 'italic 17px system-ui, sans-serif';
  ctx.fillText(GAME_SUBTITLE, w / 2, h * 0.43);
  drawMenu(ctx, G);
  ctx.fillStyle = 'rgba(253,246,227,0.6)';
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.fillText('WASD / arrows · mouse or ↑ ↓ + Enter · an original city, an original story', w / 2, h - 26);
}

/** The help screen: what Nico does all day, and the keys that do it. */
export function drawHelp(ctx, G) {
  const { w, h } = G.view;
  ctx.fillStyle = 'rgba(14,16,22,0.82)';
  ctx.fillRect(0, 0, w, h);
  const pw = Math.min(620, w - 60);
  const ph = 430;
  const px = w / 2 - pw / 2;
  const py = h / 2 - ph / 2;
  ctx.fillStyle = 'rgba(24,28,38,0.97)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,201,60,0.55)';
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 23px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOW A DAY WORKS IN SOLMAR BAY', w / 2, py + 42);
  ctx.fillStyle = COLORS.hudInk;
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const lines = [
    'Follow the gold beacon. Talk to people with the gold ! — they have work,',
    'and work is money, and money is the whole point of Nico Ferrer.',
    '',
    'WASD / arrows — walk and drive        Shift — run',
    'F — get in / out of a car (any car…)   E — talk, advance dialogue',
    'J or click — punch                       Space — handbrake',
    'Esc / P — pause                          M — sound on / off',
    '',
    'Crime raises your stars. Stars bring police. Police close and slow',
    'means BUSTED; a wreck or a beating means WASTED. Lose the stars by',
    'staying out of sight, and the city forgets — eventually.',
    '',
    'Progress saves itself after every job. Come back any time.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, px + 36, py + 82 + i * 23));
  ctx.fillStyle = 'rgba(253,246,227,0.65)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Esc — back', w / 2, py + ph - 20);
}

/** The pause screen. */
export function drawPause(ctx, G) {
  const { w, h } = G.view;
  ctx.fillStyle = 'rgba(14,16,22,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLORS.hudInk;
  ctx.font = '900 46px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', w / 2, h * 0.34);
  ctx.font = 'italic 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(253,246,227,0.75)';
  ctx.fillText('the city holds its breath', w / 2, h * 0.34 + 28);
  drawMenu(ctx, G);
}

/** WASTED or BUSTED: the day ends, the city sends its bill. */
export function drawOver(ctx, G) {
  const { w, h } = G.view;
  ctx.fillStyle = G.overReason === 'busted' ? 'rgba(18,26,44,0.72)' : 'rgba(44,14,18,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = G.overReason === 'busted' ? '#9fd1ff' : '#ff8fa3';
  ctx.font = '900 72px system-ui, sans-serif';
  ctx.fillText(G.overReason === 'busted' ? 'BUSTED' : 'WASTED', w / 2, h * 0.4);
  ctx.fillStyle = COLORS.hudInk;
  ctx.font = '17px system-ui, sans-serif';
  const flavor = G.overReason === 'busted'
    ? 'The station coffee is terrible, and the fine is worse: a quarter of your cash.'
    : 'The hospital by the marina patches you up and bills a tenth of your cash.';
  ctx.fillText(flavor, w / 2, h * 0.4 + 36);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(253,246,227,0.8)';
  ctx.fillText(`You keep $${Math.floor(G.player.cash)} · the story waits where you left it`, w / 2, h * 0.4 + 66);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText('Enter — wake up and walk out', w / 2, h * 0.62);
}
