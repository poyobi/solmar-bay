// Solmar Bay — the screenshot scenes behind ?shot=cover|drive|chase|mission&seed=n.
//
// Each scene is staged from a freshly built world and then played forward with the real
// simulation for a fixed number of steps — the cover is a lived-in street corner, the drive
// and the chase are genuinely driven by the game's own input path with a stub keyboard, and
// the mission scene stops mid-conversation with a giver. Same seed, same frame, every time:
// these are the game's own renders, never arranged by hand in an editor.

import { createCar } from './vehicles.js';
import { STORY } from './missions.js';

/** A keyboard that holds the given keys down and never presses anything. */
function stubInput(downCodes) {
  return {
    mouse: { x: 0, y: 0, down: false, clicked: false },
    isDown: (code) => downCodes.includes(code),
    wasPressed: () => false,
    anyDown: (codes) => codes.some((c) => downCodes.includes(c)),
    anyPressed: () => false,
    axes: () => ({ x: 0, y: 0 }),
    consume() {},
    consumeClick() {},
    clearFrame() {},
  };
}

/** Run the world forward n fixed steps under a stub keyboard, then give the real one back. */
function playSteps(G, steps, downCodes = []) {
  const real = G.input;
  G.input = stubInput(downCodes);
  for (let i = 0; i < steps; i += 1) G.stepWorld(1 / 60);
  G.input = real;
}

/** Snap the camera onto the player, the way the game's own camera settles. */
function snapCamera(G) {
  G.camera.x = Math.max(0, Math.min(G.city.width - G.view.w, G.player.x - G.view.w / 2));
  G.camera.y = Math.max(0, Math.min(G.city.height - G.view.h, G.player.y - G.view.h / 2));
}

/** Put the player behind the wheel of a fresh hero car at a place, facing a way. */
function putInCar(G, x, y, angle, color, speed) {
  const car = createCar(x, y, angle, color, 'traffic');
  car.driver = 'player';
  car.speed = speed;
  G.cars.push(car);
  G.player.inCar = true;
  G.player.car = car;
  G.player.x = x;
  G.player.y = y;
  return car;
}

/**
 * Stage the named scene in a built world. Any name the game does not know is the cover.
 * The caller renders afterwards; nothing here draws.
 */
export function stageShot(G, name) {
  const player = G.player;
  if (name === 'drive') {
    // Southbound on the coast road, late sun, traffic ahead and the bay on the right.
    putInCar(G, 360, 1120, Math.PI / 2, '#c0392b', 305);
    playSteps(G, 52, ['KeyW']);
  } else if (name === 'chase') {
    // Three stars on the Centro avenue: two patrol cars already on his tail.
    putInCar(G, 1210, 840, 0, '#2874a6', 395);
    G.wanted.heat = 3.3;
    const copA = createCar(1064, 840, 0, '#f4f6f7', 'police');
    copA.speed = 380;
    const copB = createCar(940, 812, 0, '#f4f6f7', 'police');
    copB.speed = 372;
    G.cars.push(copA, copB);
    playSteps(G, 62, ['KeyW']);
  } else if (name === 'mission') {
    // Mid-errand: Nico stands with Doña Pilar outside the café, her pitch half-heard.
    player.x = 505;
    player.y = 1352;
    player.angle = Math.PI;
    playSteps(G, 26, []);
    const def = STORY[0];
    G.openDialogue(def.giver.name, def.intro, null);
    G.missions.marker = { x: def.giver.x, y: def.giver.y };
  } else {
    // The cover: the fountain plaza at golden hour — neighbours strolling, a borrowed car
    // holding up the avenue, the bay at the frame's edge and the beacon on the minimap.
    player.x = 950;
    player.y = 1100;
    player.angle = -0.5;
    const hero = createCar(1010, 1224, Math.PI, '#f39c12', 'parked');
    G.cars.push(hero);
    for (let i = 0; i < 6; i += 1) {
      G.spawnPed(850 + G.rng() * 300, 900 + G.rng() * 280);
    }
    G.missions.marker = { x: 888, y: 600 };
    playSteps(G, 85, []);
  }
  snapCamera(G);
}
