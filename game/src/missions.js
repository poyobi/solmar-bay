// Solmar Bay — the story: six errands that pull Nico Ferrer across the city, and the
// repeatable courier work that pays between them.
//
// A mission is a list of stages (go somewhere, collect things, run a checkpoint race, tail a
// car, survive an ambush, outrun the law). The giver stands at a fixed spot all day; walking
// up and pressing the talk key opens their dialogue, and finishing the last stage sends Nico
// back to them for the outro and the money. Side jobs come from Pipo at the promenade: pick
// a parcel up, drop it off, beat the clock, get paid, repeat forever.

import { TILE } from './config.js';
import { createPed } from './pedestrians.js';
import { createCar } from './vehicles.js';
import { dist, rrange } from './random.js';

/** A world point from tile coordinates (tile centres keep spots on the pavement). */
function spot(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

const PILAR = { name: 'Doña Pilar', ...spot(9, 28), shirt: '#e9c46a' };
const ELIAS = { name: 'Elías Roca', ...spot(18, 12), shirt: '#457b9d' };
const ROSA = { name: 'Captain Rosa', ...spot(9, 46), shirt: '#2a9d8f' };
const LUA = { name: 'Lúa Marín', ...spot(6, 20), shirt: '#ffafcc' };
const VERA = { name: 'Vera Nox', ...spot(36, 21), shirt: '#8338ec' };
const PIPO = { name: 'Pipo', ...spot(9, 12), shirt: '#f4a261' };

export const STORY = [
  {
    id: 'pastries',
    title: 'Warm Pastries, Cold City',
    giver: PILAR,
    reward: 120,
    intro: [
      'Nico! You walk like a man with no debts. I like that. I have three cafés waiting on this morning\'s pastries and my delivery boy has run off with a surf instructor.',
      'Take the crate. Three terraces, before they go cold. The addresses are in your pocket — follow the gold marker, and do not let the seagulls unionise against you.',
    ],
    outro: [
      'All three, still warm? Ay, the city still has honest legs. Here — and Nico, people are starting to ask about you. Good people. Mostly.',
    ],
    stages: [
      { kind: 'deliver', label: 'Deliver the pastries (3 terraces)', time: 170, points: [spot(27, 12), spot(45, 21), spot(18, 39)] },
    ],
  },
  {
    id: 'debt',
    title: 'The Mechanic\'s Debt',
    giver: ELIAS,
    reward: 200,
    intro: [
      'You are Pilar\'s runner? Good. I owe money to men who collect with their hands, and the part I sold to pay them sits in a crate at the south docks.',
      'Fetch it for me. And Nico — if anyone is standing near that crate looking unemployed and angry, they are not there for the view.',
    ],
    outro: [
      'The part! Intact! You have a future in this city, runner — assuming the city does not eat you first. Your cut, as promised.',
    ],
    stages: [
      { kind: 'pickup', label: 'Pick up the crate at the south docks', ...spot(8, 50) },
      { kind: 'fight', label: 'Deal with the ambush', count: 2, ...spot(8, 50) },
      { kind: 'goto', label: 'Bring the crate back to Elías', ...ELIAS },
    ],
  },
  {
    id: 'crates',
    title: 'Harbor Lights',
    giver: ROSA,
    reward: 180,
    intro: [
      'Ferrer. My harbour crew is on strike over a chess game, and four crates of lamp oil washed off the Rosa María last night. They are somewhere along my shore.',
      'Walk the beach, runner. Four crates. Mind the crabs — they have tenure.',
    ],
    outro: [
      'Four crates and no crab bites I can see. The harbour lights stay on another month, and so do you. Paid in full.',
    ],
    stages: [
      { kind: 'collect', label: 'Recover the lamp-oil crates', points: [spot(6, 14), spot(6, 34), spot(9, 42), spot(8, 52)] },
    ],
  },
  {
    id: 'race',
    title: 'Beach Run',
    giver: LUA,
    reward: 260,
    intro: [
      'You are the famous legs! I bet old Tomás you could not drive my checkpoint run before the light goes. He bet his bar. I do not even drink — I just want the bar.',
      'The gold rings, in order, against the clock. Borrow anything with wheels. Try not to rearrange the promenade.',
    ],
    outro: [
      'HA! Tomás is washing glasses in MY bar now. Your share of the glory, champion. The seagulls saw everything and they are impressed.',
    ],
    stages: [
      {
        kind: 'race', label: 'Run the checkpoints', time: 165,
        points: [spot(8, 6), spot(8, 23), spot(8, 41), spot(17, 53), spot(35, 53), spot(35, 8), spot(8, 6)],
      },
    ],
  },
  {
    id: 'ledger',
    title: 'Night Ledger',
    giver: VERA,
    reward: 340,
    intro: [
      'Sit down, runner. My accountant has been selling my club\'s ledger page by page to a man in a grey car. Tonight he drives the coast road.',
      'Follow him. Close enough to see, far enough to be weather. When he parks, take the ledger from the car and bring it home to me.',
    ],
    outro: [
      'Every page. You are wasted on errands, Nico Ferrer. Stay for a drink sometime — on the house, which is more than my accountant can say now.',
    ],
    stages: [
      { kind: 'tail', label: 'Tail the grey car — stay close, stay unseen', need: 40 },
      { kind: 'pickup', label: 'Take the ledger from the parked car', dynamic: 'tailcar' },
      { kind: 'goto', label: 'Bring the ledger to Vera', ...VERA },
    ],
  },
  {
    id: 'sendoff',
    title: 'Solmar Send-Off',
    giver: ROSA,
    reward: 600,
    intro: [
      'Last job, runner, and it is mine. A man on my boat needs to leave Solmar Bay tonight, and every policeman in the city has his photograph.',
      'I will make some noise at the port to draw them out. You get my passenger\'s bag to the marina steps at the south end of the coast road — then lose the law, properly, the way you have been practising.',
    ],
    outro: [
      'He is on the water and the city is quiet. You came here with forty coins and a borrowed name, Ferrer. You leave my dock a legend of the small streets. Spend it slowly.',
    ],
    stages: [
      { kind: 'escapeReach', label: 'Reach the marina steps — with the law watching', ...spot(8, 54) },
      { kind: 'lieLow', label: 'Lose the wanted level' },
    ],
  },
];

/** Fresh mission progress for a new game. */
export function createMissions() {
  return { index: 0, active: null, side: null, sideDone: 0, totalEarned: 0, failedNote: '' };
}

/** Put the current story giver (and Pipo) on their spots. Old givers step aside. */
export function placeGivers(G) {
  G.peds = G.peds.filter((p) => p.role !== 'giver');
  const addGiver = (who, tag) => {
    const ped = createPed(G.rng, who.x, who.y);
    ped.role = 'giver';
    ped.name = who.name;
    ped.shirt = who.shirt;
    ped.giverTag = tag;
    G.peds.push(ped);
    return ped;
  };
  if (G.missions.index < STORY.length) {
    addGiver(STORY[G.missions.index].giver, 'story');
  }
  addGiver(PIPO, 'side');
}

/** The giver ped for a tag ('story' or 'side'), if present. */
function giverPed(G, tag) {
  return G.peds.find((p) => p.role === 'giver' && p.giverTag === tag) ?? null;
}

/** Begin a mission's stage: spawn its dressing (thugs, the tail car) and set the marker. */
function beginStage(G, active) {
  const stage = active.def.stages[active.stageIdx];
  active.tLeft = stage.time ?? null;
  active.data = {};
  if (stage.kind === 'fight') {
    active.data.thugs = [];
    for (let i = 0; i < (stage.count ?? 2); i += 1) {
      const thug = G.spawnPed(stage.x + rrange(G.rng, -50, 50), stage.y + rrange(G.rng, -40, 40));
      if (thug) {
        thug.role = 'thug';
        thug.hostile = true;
        thug.aggro = true;
        thug.hp = 90;
        thug.shirt = '#343a40';
        active.data.thugs.push(thug);
      }
    }
  }
  if (stage.kind === 'tail') {
    const car = createCar(1056, 384, 0, '#8d9096', 'traffic');
    car.driver = 'ai';
    car.axis = 'h';
    car.dir = 1;
    car.target = null;
    G.cars.push(car);
    active.data.car = car;
    active.data.progress = 0;
    active.data.spotted = 0;
    active.data.lost = 0;
  }
  if (stage.kind === 'escapeReach') {
    G.wanted.heat = Math.max(G.wanted.heat, 4);
  }
  syncMarker(G, active);
}

/** Point the objective marker at whatever the current stage wants. */
function syncMarker(G, active) {
  const stage = active.def.stages[active.stageIdx];
  const M = G.missions;
  if (!stage) { M.marker = null; return; }
  if (stage.kind === 'collect' || stage.kind === 'deliver' || stage.kind === 'race') {
    const p = stage.points[active.data.next ?? 0];
    M.marker = p ? { x: p.x, y: p.y } : null;
  } else if (stage.kind === 'tail') {
    const car = active.data.car;
    M.marker = car ? { x: car.x, y: car.y } : null;
  } else if (stage.kind === 'pickup' && stage.dynamic === 'tailcar') {
    M.marker = active.data.parkedAt ?? M.lastTailPark ?? null;
  } else if (typeof stage.x === 'number') {
    M.marker = { x: stage.x, y: stage.y };
  } else {
    M.marker = null;
  }
}

/** Fail the active mission or side job: clean up its dressing and free the player. */
function failActive(G, which) {
  const M = G.missions;
  const active = which === 'side' ? M.side : M.active;
  if (!active) return;
  if (active.data?.thugs) {
    for (const thug of active.data.thugs) {
      thug.role = 'walker';
      thug.hostile = false;
      thug.aggro = false;
      thug.state = 'flee';
      thug.fleeCd = 2;
    }
  }
  if (which === 'side') M.side = null; else M.active = null;
  M.marker = null;
  G.notify('Job failed — the giver will offer it again', '#ef476f');
  G.audio.fail();
}

/** Complete the active story mission: pay out, advance the story, save. */
function completeStoryMission(G) {
  const M = G.missions;
  const def = M.active.def;
  G.player.cash += def.reward;
  M.totalEarned += def.reward;
  M.index += 1;
  M.active = null;
  M.marker = null;
  G.notify(`Mission passed — ${def.title} · +$${def.reward}`, '#ffc93c');
  G.audio.success();
  G.save();
  placeGivers(G);
}

/** Start the current stage list running (after the intro dialogue closes). */
function activateMission(G, def, isSide, plan) {
  const active = { def, stageIdx: 0, tLeft: null, data: {}, isSide, plan };
  if (isSide) G.missions.side = active; else G.missions.active = active;
  beginStage(G, active);
}

/**
 * The talk key near a giver: open the right conversation. Story first — a man with a
 * story job on the table does not take courier work.
 */
export function interactWithGiver(G, ped) {
  const M = G.missions;
  if (ped.giverTag === 'story') {
    const def = STORY[M.index];
    if (!def) return;
    if (M.active && M.active.stageIdx >= M.active.def.stages.length) {
      // Standing here with the job done: the outro, then the money.
      G.openDialogue(def.giver.name, def.outro, () => completeStoryMission(G));
      return;
    }
    if (M.active) {
      G.notify(`${def.giver.name} is waiting on: ${def.title}`, '#fdf6e3');
      return;
    }
    G.openDialogue(def.giver.name, def.intro, () => activateMission(G, def, false));
    return;
  }
  // Pipo and his endless parcels.
  if (M.side) {
    G.notify('Pipo is waiting on the parcel you already took', '#fdf6e3');
    return;
  }
  if (M.active) {
    G.notify('Finish the story job first — Pipo will wait', '#fdf6e3');
    return;
  }
  const pickupPt = { x: 384 + Math.floor(G.rng() * 6) * 48, y: 300 + G.rng() * 2000 };
  let dropPt = { x: 900 + G.rng() * 2200, y: 300 + G.rng() * 2000 };
  if (dist(pickupPt.x, pickupPt.y, dropPt.x, dropPt.y) < 700) dropPt = { x: 2600, y: 500 + G.rng() * 1600 };
  const pay = Math.round(70 + dist(pickupPt.x, pickupPt.y, dropPt.x, dropPt.y) / 14);
  const plan = { pickupPt, dropPt, pay };
  const def = {
    id: 'side',
    title: 'Pipo\'s Parcel',
    giver: PIPO,
    reward: pay,
    stages: [
      { kind: 'pickup', label: 'Pick up the parcel', x: pickupPt.x, y: pickupPt.y },
      { kind: 'goto', label: 'Deliver the parcel', x: dropPt.x, y: dropPt.y, time: Math.round(dist(pickupPt.x, pickupPt.y, dropPt.x, dropPt.y) / 9) },
    ],
  };
  G.openDialogue('Pipo', [
    `Parcel for the far side, runner — $${pay} if the clock likes you. Gold marker, quick feet, no questions about the smell.`,
  ], () => activateMission(G, def, true, plan));
}

/** Advance a stage list by one stage; past the end, a story mission waits for its outro. */
function advanceStage(G, active) {
  active.stageIdx += 1;
  if (active.stageIdx >= active.def.stages.length) {
    if (active.isSide) {
      const M = G.missions;
      G.player.cash += active.def.reward;
      M.totalEarned += active.def.reward;
      M.sideDone += 1;
      M.side = null;
      M.marker = null;
      G.notify(`Parcel delivered · +$${active.def.reward}`, '#ffc93c');
      G.audio.cash();
      G.save();
    } else {
      // The work is done; the giver has the money. Send Nico back to them.
      G.missions.marker = { x: active.def.giver.x, y: active.def.giver.y };
      G.notify('Job done — go back for your money', '#ffc93c');
    }
    return;
  }
  beginStage(G, active);
  G.audio.blip(660);
}

/** Run one stage of a stage list. Returns nothing; advances or fails as it goes. */
function updateStageList(G, active, dt) {
  const stage = active.def.stages[active.stageIdx];
  if (!stage) return;
  const which = active.isSide ? 'side' : 'story';
  if (active.tLeft !== null && active.tLeft !== undefined) {
    active.tLeft -= dt;
    if (active.tLeft <= 0) { failActive(G, which); return; }
  }
  const P = G.player;
  const reach = (x, y, r = 48) => dist(P.x, P.y, x, y) < r;

  switch (stage.kind) {
    case 'goto':
      if (reach(stage.x, stage.y, 52)) advanceStage(G, active);
      break;
    case 'pickup': {
      const at = stage.dynamic === 'tailcar' ? active.data.parkedAt ?? G.missions.lastTailPark : null;
      const target = at ?? stage;
      if (!P.inCar && reach(target.x, target.y, 44)) advanceStage(G, active);
      break;
    }
    case 'deliver':
    case 'race': {
      if (stage.kind === 'race' && !P.inCar) break;
      const next = active.data.next ?? 0;
      const p = stage.points[next];
      if (p && reach(p.x, p.y, stage.kind === 'race' ? 74 : 52)) {
        active.data.next = next + 1;
        G.audio.blip(760);
        if (active.data.next >= stage.points.length) advanceStage(G, active);
        else syncMarker(G, active);
      }
      break;
    }
    case 'collect': {
      const got = active.data.got ?? (active.data.got = new Set());
      for (let i = 0; i < stage.points.length; i += 1) {
        if (got.has(i)) continue;
        const p = stage.points[i];
        if (!P.inCar && reach(p.x, p.y, 46)) {
          got.add(i);
          G.audio.cash();
          G.notify(`Crate ${got.size} of ${stage.points.length}`, '#ffc93c');
        }
      }
      // Marker chases the nearest crate still out there.
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < stage.points.length; i += 1) {
        if (got.has(i)) continue;
        const d = dist(P.x, P.y, stage.points[i].x, stage.points[i].y);
        if (d < bestD) { bestD = d; best = stage.points[i]; }
      }
      G.missions.marker = best;
      if (got.size >= stage.points.length) advanceStage(G, active);
      break;
    }
    case 'fight': {
      const thugs = active.data.thugs ?? [];
      if (thugs.every((t) => t.down)) advanceStage(G, active);
      break;
    }
    case 'tail': {
      const car = active.data.car;
      if (!car || car.wrecked) { failActive(G, which); break; }
      const d = dist(P.x, P.y, car.x, car.y);
      G.missions.marker = { x: car.x, y: car.y };
      if (d < 58) {
        active.data.spotted += dt;
        if (active.data.spotted > 2.5) { failActive(G, which); break; }
      } else {
        active.data.spotted = Math.max(0, active.data.spotted - dt * 0.7);
      }
      if (d > 430) {
        active.data.lost += dt;
        if (active.data.lost > 8) { failActive(G, which); break; }
      } else {
        active.data.lost = 0;
      }
      if (d >= 58 && d <= 300) active.data.progress += dt;
      if (active.data.progress >= (stage.need ?? 40)) {
        // He parks up for the night; the ledger is in the car. The next stage (pickup)
        // needs the spot, so carry it across the stage change, which resets the data.
        car.driver = null;
        car.speed = 0;
        const parkedAt = { x: car.x, y: car.y };
        G.missions.lastTailPark = parkedAt;
        advanceStage(G, active);
        active.data.parkedAt = parkedAt;
        G.missions.marker = parkedAt;
      }
      break;
    }
    case 'escapeReach':
      G.wanted.heat = Math.max(G.wanted.heat, 2.4);
      if (reach(stage.x, stage.y, 64)) advanceStage(G, active);
      break;
    case 'lieLow':
      G.missions.marker = null;
      if (G.wanted.heat <= 0.4) advanceStage(G, active);
      break;
    default:
      break;
  }
}

/** The current objective line for the HUD, or '' when the day is free. */
export function objectiveText(G) {
  const M = G.missions;
  const active = M.active ?? M.side;
  if (!active) {
    if (M.index < STORY.length) return `See ${STORY[M.index].giver.name} — ${STORY[M.index].title}`;
    return 'Free day in Solmar Bay — Pipo always has parcels';
  }
  if (!active.isSide && active.stageIdx >= active.def.stages.length) {
    return `Collect your pay from ${active.def.giver.name}`;
  }
  const stage = active.def.stages[active.stageIdx];
  let text = stage.label;
  if (stage.kind === 'collect') {
    const got = active.data.got?.size ?? 0;
    text += ` · ${got}/${stage.points.length}`;
  }
  if (stage.kind === 'deliver' || stage.kind === 'race') {
    text += ` · ${(active.data.next ?? 0) + 1 > stage.points.length ? stage.points.length : (active.data.next ?? 0) + 1}/${stage.points.length}`;
  }
  if (stage.kind === 'tail') {
    text += ` · ${Math.min(99, Math.floor(((active.data.progress ?? 0) / (stage.need ?? 40)) * 100))}%`;
  }
  if (active.tLeft !== null && active.tLeft !== undefined) {
    text += ` · ${Math.max(0, Math.ceil(active.tLeft))}s`;
  }
  return text;
}

/** One step of missions, story and side work alike. */
export function updateMissions(G, dt) {
  if (G.missions.active) updateStageList(G, G.missions.active, dt);
  else if (G.missions.side) updateStageList(G, G.missions.side, dt);
  // Keep the marker honest for moving targets even between stage changes.
  const active = G.missions.active ?? G.missions.side;
  if (active && active.stageIdx < active.def.stages.length) {
    const stage = active.def.stages[active.stageIdx];
    if (stage.kind === 'tail' && active.data.car) {
      G.missions.marker = { x: active.data.car.x, y: active.data.car.y };
    }
  }
}
