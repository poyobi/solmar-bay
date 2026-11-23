# solmar-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/poyobi/solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/poyobi/solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay** — *a small city with big debts.* An original 2D top-down open-world crime game that runs entirely in the browser: no build step, no network requests, no assets to download. You are Nico Ferrer, newly arrived in a sun-soaked bay city where everybody is owed money by somebody, and the quickest way to matter is to start running errands for the people doing the owing.

Walk the promenade, borrow a car (the owners rarely agree), weave through living traffic, and work a six-mission story from pastry deliveries to a midnight tail and one last escape across the bay road. The law keeps score with a five-star wanted level: patrol cars hunt you, officers pile out to make the arrest, and a filling BUSTED meter is the last thing you see before the city sends its bill. Between story jobs, Pipo at the marina always has a paying side run.

## Run it

```sh
node serve.ts
```

then open http://localhost:8080 in a desktop browser. (Any static file server pointed at `game/` works just as well — `serve.ts` is only a convenience.) To produce the scored hand-in instead:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## How to play

- **WASD / arrow keys** — walk, and drive when you are in a car
- **Shift** — run on foot · **Space** — handbrake
- **F** — get into the nearest car (or step out of yours)
- **E** — talk to the person with the gold **!**, advance conversations
- **J** or **mouse click** — throw a punch
- **Esc / P** — pause · **M** — mute

Follow the gold beacon and the objective line at the bottom of the screen. Stars fade when no officer or patrol car can see you — break line of sight and lie low. Progress, cash and sound preference are saved in your browser between visits.

## What's in the city

- A hand-laid bay city of pastel blocks, named cafés and workshops, parks, a fountain plaza, parking courts and a working marina district — generated from a fixed seed, so the city you learn is the city that stays
- Living traffic that follows lanes, turns at crossings and brakes for jaywalkers, plus parked cars on every court — every one of them stealable and drivable
- Pedestrians with their own errands, who scatter from danger and remember crimes long enough to report them
- A wanted system with patrol cars, foot officers and a bust meter; jacking, crashing, assaults and worse all feed the heat
- A six-mission story with dialogue, timers, deliveries, a brawl, a harbour pickup, a beach race, a tail you must not be spotted doing, and a finale — plus repeatable side jobs
- Fist combat, including two debt collectors who would like a word
- A full HUD: cash and health, wanted stars, the clock, the district you are standing in, an objective line, and a live minimap with police blips
- Title, help, pause and game-over screens; a golden-hour look with a soft vignette; and a soundtrack synthesized live with WebAudio — sea-wind pad chords, an engine that follows your speed, and a two-tone siren that gets louder as the law closes in. There are no audio files.

## Layout

- `game/` — the game itself: `index.html` plus small ES modules under `game/src/`, one job each (city, vehicles, pedestrians, police, combat, missions, render, hud, audio, save…)
- `main.ts` — the hand-in courier: validates the entry against the gate's caps, copies `game/` and `screenshots/` to the output directory and writes `dossier.json`
- `serve.ts` — a tiny local server for playing the game during development
- `screenshots/` — four real renders of the game, staged deterministically through `game/src/shots.js` (`?shot=cover|drive|chase|mission&seed=7`)

Everything — city, names, people, story, art and music — is original to this repository.

---
<sub>Entered on [make.fun](https://make.fun/?ref=sfcm9bvc&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
