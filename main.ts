// Solmar Bay — hand-in program for the make.fun gta6-01 bounty (Node 22, standard library only).
//
// The game itself is the game/ folder beside this file: plain static files (an index.html and
// its ES modules) that a desktop browser plays offline, with no build step and no network
// request. This program is only the courier: it copies game/ and screenshots/ into the output
// directory and writes dossier.json there with the vendored make.fun library, exactly the
// summary the scorer and the judge read.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR naming the destination:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// With no MAKEFUN_OUTPUT_DIR it writes to /output, the grader's own mount.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, mirrored from the kit's gate reference so this program refuses nothing
// the scorer would accept and accepts nothing it would refuse: at most 4 screenshots of at
// most 256 KiB each, at most 993 files and 48 MiB under game/, no game/ path over 1,000
// bytes, and the dossier's source text shaped to at most 160 KiB.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Pre-flight: walk a folder and total its files and bytes, so a hand-in that would break
// the scorer's caps fails here — loudly, at the author's desk — instead of at the gate.
function survey(dir) {
  let files = 0;
  let bytes = 0;
  let longestPath = 0;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) {
        files += 1;
        bytes += statSync(p).size;
        longestPath = Math.max(longestPath, Buffer.byteLength(relative(dir, p)));
      }
    }
  };
  walk(dir);
  return { files, bytes, longestPath };
}

function refuse(problem) {
  console.error(`Solmar Bay hand-in refused: ${problem}`);
  process.exit(1);
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) refuse('game/index.html is missing');
const gameSurvey = survey(gameDir);
if (gameSurvey.files > DOSSIER_LIMITS.game_max_files) {
  refuse(`game/ holds ${gameSurvey.files} files, over the ${DOSSIER_LIMITS.game_max_files} cap`);
}
if (gameSurvey.bytes > DOSSIER_LIMITS.game_max_bytes) {
  refuse(`game/ weighs ${gameSurvey.bytes} bytes, over the ${DOSSIER_LIMITS.game_max_bytes} cap`);
}
if (gameSurvey.longestPath > DOSSIER_LIMITS.game_path_max_bytes) {
  refuse(`a game/ path runs ${gameSurvey.longestPath} bytes, over the ${DOSSIER_LIMITS.game_path_max_bytes} cap`);
}
const shotNames = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((n) => /\.(png|jpe?g)$/i.test(n)).sort()
  : [];
if (shotNames.length < 3 || shotNames.length > DOSSIER_LIMITS.screenshots.max) {
  refuse(`screenshots/ holds ${shotNames.length} images; the gate wants 3 to ${DOSSIER_LIMITS.screenshots.max}`);
}
for (const name of shotNames) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > DOSSIER_LIMITS.screenshots.max_bytes) {
    refuse(`${name} weighs ${size} bytes, over the ${DOSSIER_LIMITS.screenshots.max_bytes} cap`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(out, DOSSIER_LIMITS);
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(
  `Solmar Bay handed in: ${gameSurvey.files} game files (${gameSurvey.bytes} bytes), `
  + `${shotNames.length} screenshots, dossier.json ${Buffer.byteLength(dossier)} bytes — all in ${out}`,
);
