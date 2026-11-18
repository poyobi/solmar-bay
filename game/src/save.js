// Solmar Bay — persistence.
// One localStorage key holds mission progress, cash, weapon reserves,
// position, hidden packages, side-activity counts and the mute setting.
// Autosave happens on every mission completion; the pause menu can save
// on demand, and the title screen offers Continue when a save exists.

// localStorage save: mission progress, cash, weapons, position, settings, completion.
import {
  SAVE_KEY
}
from './config.js';
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function writeSave(G) {
  try {
    const data = {
      missionIndex: G.missionIndex, cash: Math.floor(G.player.cash), weapons: G.player.weapons.map((w) => w.ammo),       weaponIdx: G.player.weaponIdx, x: Math.round(G.player.x), y: Math.round(G.player.y),       packages: G.packagesFound, racesWon: G.racesWon || 0, fares: G.fares || 0, muted: G.audio?.muted || false, storyDone: !!G.storyDone,
    }
    ;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
export function completionPct(G) {
  const story = Math.min(6, G.missionIndex) / 6 * 70;
  const pkg = (G.packagesFound / 10) * 15;
  const side = Math.min(1, ((G.racesWon || 0) + (G.fares || 0)) / 6) * 15;
  return Math.round(story + pkg + side);
}
