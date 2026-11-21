// Beatability check for levels 2 and 3: a careful bot — Dijkstra path that
// avoids guard patrol corridors, then walk it, retreating when suspicion rises.
import { createWorld, EVENT_CAUGHT, EVENT_LEVEL_DONE, EVENT_WIN } from '/home/hatch/workspace/makefun/best-stealth-game-20261121-1759/game/src/world.js';
import { tileCenter, isBlocking, tileAt } from '/home/hatch/workspace/makefun/best-stealth-game-20261121-1759/game/src/level.js';
import { LEVELS } from '/home/hatch/workspace/makefun/best-stealth-game-20261121-1759/game/src/level.js';

const STEP = 1 / 60;
const idleInput = { direction: () => [0, 0], sprinting: () => false, takeClickTarget: () => null };

function patrolTiles(levelIndex) {
  const hot = new Set();
  for (const g of LEVELS[levelIndex].guards) {
    const wps = g.waypoints;
    for (let i = 0; i < wps.length; i += 1) {
      const a = wps[i];
      const b = wps[(i + 1) % wps.length];
      const dc = Math.sign(b[0] - a[0]);
      const dr = Math.sign(b[1] - a[1]);
      let c = a[0];
      let r = a[1];
      while (true) {
        hot.add(`${c},${r}`);
        if (c === b[0] && r === b[1]) break;
        c += dc;
        r += dr;
      }
    }
  }
  return hot;
}

function playLevel(world, levelIndex) {
  world.loadLevel(levelIndex);
  const s = world.state;
  const hot = patrolTiles(levelIndex);
  const start = tileAt(s.player.x, s.player.y);
  const goal = tileAt(s.exit.x, s.exit.y);
  const key = (c, r) => `${c},${r}`;
  // Dijkstra: patrol-corridor tiles cost 8, their neighbours 2, open floor 1.
  const cost = new Map([[key(start.col, start.row), 0]]);
  const prev = new Map([[key(start.col, start.row), null]]);
  const open = [{ col: start.col, row: start.row }];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (cost.get(key(open[i].col, open[i].row)) < cost.get(key(open[bi].col, open[bi].row))) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    if (cur.col === goal.col && cur.row === goal.row) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (isBlocking(s.grid, nc, nr)) continue;
      let w = 1;
      if (hot.has(key(nc, nr))) w = 8;
      else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => hot.has(key(nc + a, nr + b)))) w = 2;
      const nk = key(nc, nr);
      const nc2 = cost.get(key(cur.col, cur.row)) + w;
      if (!cost.has(nk) || nc2 < cost.get(nk)) {
        cost.set(nk, nc2);
        prev.set(nk, cur);
        open.push({ col: nc, row: nr });
      }
    }
  }
  if (!prev.has(key(goal.col, goal.row))) return { ok: false, why: 'no path' };
  const path = [];
  let cur = goal;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(key(cur.col, cur.row));
  }
  let events = 0;
  let wp = 1;
  let waited = 0;
  for (let i = 0; i < 60 * 240 && !(events & (EVENT_LEVEL_DONE | EVENT_CAUGHT | EVENT_WIN)); i += 1) {
    const target = path[Math.min(wp, path.length - 1)];
    const tc = tileCenter(target.col, target.row);
    const dx = tc.x - s.player.x;
    const dy = tc.y - s.player.y;
    const dist = Math.hypot(dx, dy);
    let input = idleInput;
    if (s.maxSuspicion > 0.55) {
      waited += 1;
      const back = path[Math.max(1, wp - 3)];
      const bc = tileCenter(back.col, back.row);
      const bdx = bc.x - s.player.x;
      const bdy = bc.y - s.player.y;
      const bd = Math.hypot(bdx, bdy);
      if (bd > 8) input = { direction: () => [bdx / bd, bdy / bd], sprinting: () => false, takeClickTarget: () => null };
    } else if (dist > 8) input = { direction: () => [dx / dist, dy / dist], sprinting: () => false, takeClickTarget: () => null };
    else if (wp < path.length - 1) wp += 1;
    events |= world.step(STEP, input);
  }
  return { ok: Boolean(events & (EVENT_LEVEL_DONE | EVENT_WIN)), caught: s.caught, time: s.time.toFixed(1), waited, pathLen: path.length, path: path.map((p) => `(${p.col},${p.row})`).join(' ') };
}

const world = createWorld(7);
let fail = 0;
for (const level of [1, 2]) {
  const r = playLevel(world, level);
  console.log(`Level ${level + 1}: ${r.ok ? 'PASS beatable' : 'FAIL'} — time=${r.time}s waited=${r.waited} caught=${r.caught} pathLen=${r.pathLen}`);
  console.log(`  path: ${r.path}`);
  if (!r.ok) fail = 1;
}
console.log(fail ? 'SOME LEVELS NOT BEATABLE' : 'LEVELS 2+3 BEATABLE');
process.exit(fail);
