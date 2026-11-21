# LUMEN HEIST

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/c/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/uwillxlz/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/c/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/uwillxlz/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/c/best-stealth-game-20261121-1759)

An entry for [best-stealth-game-20261121-1759](https://make.fun/c/best-stealth-game-20261121-1759) ("Make the best stealth game").

A top-down stealth game for the make.fun **best-stealth-game-20261121-1759** bounty.
You are a thief in a night museum: slip past the wardens' lantern cones, pocket
the relics, and reach the green exit unseen — across three galleries.

## How to play

- **Move** — WASD / arrow keys, or click the floor to walk there
- **Sprint** — hold Shift. Fast — and loud: sprinting rings out, and wardens
  within earshot come to look.
- **Hide** — crates, hedges and display cases block sight. Dark **shadow tiles**
  fill a warden's suspicion half as fast.
- **Watch the cones** — a warden's suspicion fills while you are lit inside its
  cone. At full it raises the **alarm**: it chases your last-known spot and
  alerts nearby wardens. Break sight to cool down; if a chasing warden touches
  you, you are caught.
- **Win** — reach the green EXIT. Relics are optional but worth 250 points each.
- **P** pause · **M** mute · **R** retry the level · **Enter** start

## The wardens

Three kinds, one brain each: **patrollers** walk a loop, **sentries** stand and
sweep their lantern, **runners** are fast with a short cone. Every warden runs a
patrol → suspicious → chase → search → return state machine; they chase the
last place they saw you, never your live position, so a near miss is always
recoverable.

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

No build step, no network requests, no libraries — plain static files under
`game/`. Sounds are synthesized with WebAudio.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored `vendor/makefun-game.ts` library.

## Files

| File | Job |
|---|---|
| `game/src/config.js` | All tuning numbers, colours, guard kinds |
| `game/src/level.js` | The three hand-built levels, tile grid, blocking |
| `game/src/vision.js` | Line of sight and the sight-cone raycast |
| `game/src/guard.js` | The warden state machine (patrol / suspect / chase / search / return) |
| `game/src/world.js` | The simulation: player, noise, relics, exit, win / caught |
| `game/src/audio.js` | Synthesized WebAudio sounds |
| `game/src/render.js` | Canvas painter: floor, cones, darkness + light, HUD, screens |
| `game/src/shots.js` | Staged scenes for the screenshots |
| `game/src/input.js` | Keyboard + mouse |
| `game/src/random.js` | Seeded generator |
| `game/src/main.js` | Boot, fixed-step loop, screen flow |

Screenshots are real renders of the game's own code, staged with
`?shot=start|play|near|win&seed=7` (see `shots.json`).

## License

MIT — see `LICENSE`. An original game: its own idea, art, sounds and names.
