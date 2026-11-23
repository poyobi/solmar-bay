// Solmar Bay — fists: the player's punch, the thugs who punch back, and what happens when
// two tons of car meet a pedestrian at speed.
//
// Combat is deliberately small and physical: a short-range arc on foot, knockback, a health
// number, and witnesses who mind. Mission muscle (role 'thug') fights with the same rules —
// they chase, they swing on a cooldown, they go down and stay down.

import { TUNING } from './config.js';
import { collideCircle } from './city.js';
import { knockDown, scarePeds } from './pedestrians.js';
import { hurtPlayer } from './player.js';
import { dist } from './random.js';

/** Swing a punch, if the cooldown allows. Hits every ped in the arc in front of Nico. */
export function tryPlayerPunch(G) {
  const player = G.player;
  if (player.inCar || player.punchCd > 0 || player.hp <= 0) return;
  player.punchCd = TUNING.punchCooldown;
  G.audio.punch();
  let hitAny = false;
  for (const ped of G.peds) {
    if (ped.down || ped.role === 'giver') continue;
    const d = dist(player.x, player.y, ped.x, ped.y);
    if (d > TUNING.punchRange + 12) continue;
    const a = Math.atan2(ped.y - player.y, ped.x - player.x);
    let diff = Math.abs(a - player.angle) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 1.15) continue;
    hitAny = true;
    ped.hp -= TUNING.punchDamage;
    G.fx.push({ kind: 'burst', x: ped.x, y: ped.y - 6, color: '#ffd166', n: 5 });
    if (ped.role === 'thug') {
      ped.aggro = true;
      if (ped.hp <= 0) knockDown(G, ped, a);
      else {
        ped.x += Math.cos(a) * 10;
        ped.y += Math.sin(a) * 10;
      }
    } else {
      knockDown(G, ped, a);
      if (G.reportCrime) G.reportCrime('assault', ped.x, ped.y, 1);
    }
  }
  if (hitAny) scarePeds(G, player.x, player.y, 170, null);
}

/** The thugs' half of the fight, plus cars meeting pedestrians. One step. */
export function updateCombat(G, dt) {
  const player = G.player;

  for (const ped of G.peds) {
    if (ped.role !== 'thug' || ped.down) continue;
    ped.punchCd = Math.max(0, ped.punchCd - dt);
    const d = dist(ped.x, ped.y, player.x, player.y);
    const hostile = ped.aggro || (ped.hostile && d < 190);
    if (!hostile || player.hp <= 0) continue;
    const a = Math.atan2(player.y - ped.y, player.x - ped.x);
    ped.angle = a;
    if (d > 30) {
      const speed = 178;
      const res = collideCircle(G.city, ped.x + Math.cos(a) * speed * dt, ped.y + Math.sin(a) * speed * dt, 11);
      ped.x = res.x;
      ped.y = res.y;
      ped.stepPhase += dt * speed * 0.1;
    } else if (ped.punchCd <= 0 && !player.inCar) {
      ped.punchCd = 0.85;
      hurtPlayer(G, 7);
      G.audio.punch();
    }
  }

  // Cars and people: a fast car knocks a pedestrian down, whoever is driving.
  for (const car of G.cars) {
    if (Math.abs(car.speed) < 130) continue;
    for (const ped of G.peds) {
      if (ped.down || ped.role === 'giver') continue;
      const d = dist(car.x, car.y, ped.x, ped.y);
      if (d < 27) {
        const a = Math.atan2(ped.y - car.y, ped.x - car.x);
        ped.hp -= 55;
        knockDown(G, ped, a);
        G.fx.push({ kind: 'burst', x: ped.x, y: ped.y, color: '#e0e0e0', n: 8 });
        if (car.driver === 'player') {
          if (G.reportCrime) G.reportCrime('runover', ped.x, ped.y, 1);
          scarePeds(G, ped.x, ped.y, 220, null);
          car.speed *= 0.72;
        }
      }
    }
  }
}
