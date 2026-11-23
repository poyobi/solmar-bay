// Solmar Bay — the save slot: one JSON record in localStorage holding where Nico's story
// has got to. Cash, the next story mission, side-job count, lifetime earnings, the mute
// setting and where he was standing. Cars are not saved — in Solmar Bay, cars are borrowed.

import { SAVE_KEY } from './config.js';

/** Write the current run's progress. Quietly does nothing if storage is unavailable. */
export function saveGame(G) {
  try {
    const data = {
      cash: G.player.cash,
      missionIndex: G.missions.index,
      sideDone: G.missions.sideDone,
      totalEarned: G.missions.totalEarned,
      muted: G.audio.muted,
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // A private window or a full disk: the game goes on unsaved.
  }
}

/** Read the save slot, or null when there is nothing (or nothing readable) there. */
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Wipe the save slot (a new game does this before its first save). */
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to wipe, or nowhere to wipe it from.
  }
}
