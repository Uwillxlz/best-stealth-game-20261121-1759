// Headless logic test for LUMEN HEIST (Node, no browser).
// Imports the game's own world/guard/vision modules and drives them directly.
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_LEVEL_DONE, EVENT_PICKUP } from '../game/src/world.js';
import { tileCenter, isBlocking } from '../game/src/level.js';
import { coneCloseness } from '../game/src/vision.js';

const STEP = 1 / 60;
let failures = 0;
function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures += 1;
}
const idleInput = { direction: () => [0, 0], sprinting: () => false, takeClickTarget: () => null };

function stepN(world, n, input = idleInput) {
  let events = 0;
  for (let i = 0; i < n; i += 1) events |= world.step(STEP, input);
  return events;
}

// --- Test A: a guard sees the player, suspicion fills, alarm fires, caught follows.
{
  const world = createWorld(7);
  const s = world.state;
  const guard = s.guards[0];
  // Put the player 120 px ahead of the patroller, in the open, in its cone,
  // and aim the patrol at the player so the guard keeps facing them.
  s.player.x = guard.x + 120;
  s.player.y = guard.y;
  guard.dir = 0;
  guard.waypoints = [{ x: s.player.x, y: s.player.y }];
  guard.waypointIndex = 0;
  const before = guard.suspicion;
  stepN(world, 30);
  check('A1 suspicion rises in cone', guard.suspicion > before, `suspicion=${guard.suspicion.toFixed(2)}`);
  let events = 0;
  for (let i = 0; i < 600 && !(events & EVENT_ALARM); i += 1) events |= world.step(STEP, idleInput);
  check('A2 alarm fires', Boolean(events & EVENT_ALARM));
  check('A3 guard chases', guard.state === 'chase', `state=${guard.state}`);
  events = 0;
  for (let i = 0; i < 600 && !(events & EVENT_CAUGHT); i += 1) events |= world.step(STEP, idleInput);
  check('A4 caught when the chaser touches the player', Boolean(events & EVENT_CAUGHT), `state.caught=${s.caught}`);
}

// --- Test B: cover blocks sight — same distance, behind a crate, no suspicion.
{
  const world = createWorld(7);
  const s = world.state;
  const guard = s.guards[0];
  // Crate at (6,1) in level 1. Guard left of it, player right of it, same row.
  guard.x = tileCenter(4, 1).x;
  guard.y = tileCenter(4, 1).y;
  guard.dir = 0;
  s.player.x = tileCenter(8, 1).x;
  s.player.y = tileCenter(8, 1).y;
  const close = coneCloseness(guard, s.player, s.grid);
  stepN(world, 60);
  check('B1 crate blocks line of sight', close === 0 && guard.suspicion === 0, `closeness=${close}`);
}

// --- Test C: shadow tiles halve the suspicion fill rate.
{
  const world = createWorld(7);
  world.loadLevel(1); // level 2 has a shadow field
  const s = world.state;
  const guard = s.guards[0];
  guard.x = tileCenter(7, 6).x;
  guard.y = tileCenter(7, 6).y;
  guard.dir = -Math.PI / 2;
  guard.waypoints = [{ x: guard.x, y: guard.y }];
  guard.waypointIndex = 0;
  s.player.x = tileCenter(7, 4).x;
  s.player.y = tileCenter(7, 4).y;
  stepN(world, 60);
  const shadowSuspicion = guard.suspicion;
  const guard2 = s.guards[1];
  guard2.x = tileCenter(13, 5).x;
  guard2.y = tileCenter(13, 5).y;
  guard2.dir = -Math.PI / 2;
  guard2.suspicion = 0;
  guard2.waypoints = [{ x: guard2.x, y: guard2.y }];
  guard2.waypointIndex = 0;
  s.player.x = tileCenter(13, 3).x;
  s.player.y = tileCenter(13, 3).y;
  stepN(world, 60);
  check('C1 shadow fills suspicion slower than open floor', shadowSuspicion < guard2.suspicion,
    `shadow=${shadowSuspicion.toFixed(2)} floor=${guard2.suspicion.toFixed(2)}`);
}

// --- Test D: sprinting rings out — a nearby guard leaves patrol to investigate.
{
  const world = createWorld(7);
  const s = world.state;
  const guard = s.guards[1]; // sentry at (15,5)
  s.player.x = tileCenter(15, 7).x;
  s.player.y = tileCenter(15, 7).y;
  const sprintInput = { direction: () => [1, 0], sprinting: () => true, takeClickTarget: () => null };
  let ringsSeen = 0;
  for (let i = 0; i < 40; i += 1) {
    world.step(STEP, sprintInput);
    if (s.noiseRings.length > 0) ringsSeen += 1;
  }
  check('D1 sprint emits a noise ring', ringsSeen > 0 || guard.investigate !== null,
    `ringsSeen=${ringsSeen} investigate=${JSON.stringify(guard.investigate)}`);
}

// --- Test E: a patient bot plays level 1 to the exit (BFS path + wait when seen).
{
  const world = createWorld(7);
  const s = world.state;
  function bfsPath() {
    const start = { col: 1, row: 1 };
    const goal = { col: 18, row: 7 };
    const key = (c, r) => `${c},${r}`;
    const prev = new Map([[key(1, 1), null]]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      if (cur.col === goal.col && cur.row === goal.row) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cur.col + dc;
        const nr = cur.row + dr;
        if (isBlocking(s.grid, nc, nr) || prev.has(key(nc, nr))) continue;
        prev.set(key(nc, nr), cur);
        queue.push({ col: nc, row: nr });
      }
    }
    if (!prev.has(key(18, 7))) return null;
    const path = [];
    let cur = goal;
    while (cur) {
      path.unshift(cur);
      cur = prev.get(key(cur.col, cur.row));
    }
    return path;
  }
  const path = bfsPath();
  check('E0 a walkable path to the exit exists', path !== null, `tiles=${path ? path.length : 0}`);
  let events = 0;
  let wp = 1;
  let waited = 0;
  for (let i = 0; i < 60 * 120 && !(events & (EVENT_LEVEL_DONE | EVENT_CAUGHT)); i += 1) {
    const target = path[Math.min(wp, path.length - 1)];
    const tc = tileCenter(target.col, target.row);
    const dx = tc.x - s.player.x;
    const dy = tc.y - s.player.y;
    const dist = Math.hypot(dx, dy);
    let input = idleInput;
    if (s.maxSuspicion > 0.55) {
      waited += 1;
    } else if (dist > 8) {
      input = { direction: () => [dx / dist, dy / dist], sprinting: () => false, takeClickTarget: () => null };
    } else if (wp < path.length - 1) {
      wp += 1;
    }
    events |= world.step(STEP, input);
  }
  check('E1 bot reaches the exit unseen', Boolean(events & EVENT_LEVEL_DONE),
    `caught=${s.caught} levelDone=${s.levelDone} time=${s.time.toFixed(1)}s waited=${waited} steps`);
}

// --- Test F: relic pickup scores and pings.
{
  const world = createWorld(7);
  const s = world.state;
  const relic = s.relics[0];
  s.player.x = relic.x;
  s.player.y = relic.y;
  const events = stepN(world, 1);
  check('F1 walking over a relic pockets it', Boolean(events & EVENT_PICKUP) && s.relicsTaken === 1,
    `score=${s.score}`);
}

console.log(failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
