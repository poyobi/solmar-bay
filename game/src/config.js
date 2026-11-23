// Solmar Bay — shared constants: world geometry, palette and tuning.
//
// Everything else in game/src reads its numbers from here, so the city size, the tile size,
// the sun-soaked palette and the feel of the driving and the chase live in exactly one place.

/** Edge of one city tile, in world pixels. */
export const TILE = 48;
/** City grid width and height, in tiles. The bay itself fills the western columns. */
export const COLS = 76;
export const ROWS = 56;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;

/** Fixed simulation step, in seconds: the game is deterministic at this rate. */
export const STEP = 1 / 60;

/** First tile column that is dry land; columns west of the beach are open water. */
export const BEACH_TX = 5;
/** Tile columns whose residue mod PITCH is a road band (two lanes wide). */
export const PITCH = 9;
export const ROAD_A = 7;
export const ROAD_B = 8;

/** The palette: late-afternoon sun over a pastel coastal city. */
export const COLORS = {
  water: '#2e7f86',
  waterDeep: '#2a7680',
  sand: '#ecd9a0',
  sandWet: '#e7d29a',
  road: '#43474e',
  roadEdge: '#35383e',
  lane: '#e8e3d0',
  walk: '#c2bba6',
  walkEdge: '#a89f88',
  grass: '#7fae5c',
  grassDark: '#77a656',
  plaza: '#d8c9a8',
  parking: '#5a5e63',
  roofShadow: 'rgba(46, 32, 20, 0.28)',
  buildingShade: 'rgba(60, 40, 30, 0.18)',
  windowLit: '#ffe9a8',
  windowDark: '#5d6a72',
  palmTrunk: '#8a6b48',
  palmLeaf: '#3f7d3a',
  playerShirt: '#e4572e',
  playerSkin: '#c98d64',
  playerPants: '#2e4057',
  hudInk: '#fdf6e3',
  hudPanel: 'rgba(20, 24, 32, 0.72)',
  gold: '#ffc93c',
  danger: '#ef476f',
  policeBlue: '#26547c',
  policeLightA: '#ff5964',
  policeLightB: '#4cc9f0',
};

/** Building paint, chosen per lot by the city generator. */
export const BUILDING_PAINTS = [
  '#f4e1c1', '#f2b8a0', '#e88ca0', '#a8d5ba', '#f7d08a', '#b8c9e8',
  '#efe6da', '#f0a868', '#9fd1c9', '#e5b8d0', '#d9e6a3', '#f4f0e6',
];

/** Car paint for traffic and parked cars. */
export const CAR_PAINTS = [
  '#c0392b', '#2874a6', '#f39c12', '#27ae60', '#8e44ad', '#ecf0f1',
  '#e67e22', '#16a085', '#d35400', '#7f8c8d', '#f1c40f', '#2e86c1',
];

/** Feel and balance numbers for the simulation. */
export const TUNING = {
  playerWalkSpeed: 168,
  playerRunSpeed: 262,
  playerRadius: 13,
  playerMaxHp: 100,
  punchRange: 40,
  punchDamage: 34,
  punchCooldown: 0.34,
  carAccel: 340,
  carReverseAccel: 190,
  carMaxSpeed: 560,
  carMaxReverse: 170,
  carGrip: 7.5,
  carTurnRate: 2.6,
  carRadius: 25,
  carHealth: 100,
  trafficSpeed: 215,
  trafficCount: 26,
  pedCount: 42,
  pedSpeed: 62,
  copCarSpeed: 585,
  bustFillTime: 2.6,
  bustDrainTime: 3.5,
  wantedDecayPerSec: 0.011,
  heatPerCrime: 0.34,
  cashPerSideJob: 120,
};

/** In-game clock: minutes since midnight at the start of a new game (17:40, golden hour). */
export const START_CLOCK_MIN = 17 * 60 + 40;
/** One real second is one in-game minute. */
export const CLOCK_RATE = 1;

/** localStorage key for the save slot. */
export const SAVE_KEY = 'solmar-bay-save-v2';

/** The name of the city and the story's lead, used by the title screen and the HUD. */
export const GAME_NAME = 'SOLMAR BAY';
export const GAME_SUBTITLE = 'a small city with big debts';
export const HERO_NAME = 'Nico Ferrer';
