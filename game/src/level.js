// The three hand-built levels. Each map is 20 columns by 10 rows of tiles:
//   # wall   . floor   s shadow floor (suspicion fills half as fast there)
//   C crate  H hedge  D display case — all three are cover: they block sight
//   P player start   E exit   R relic (optional, worth points)
// Guard patrols are waypoint lists in tile coordinates; a sentry has one waypoint
// and sweeps its lantern instead of walking. The maps were laid out so every
// relic and the exit are reachable, and every patrol leaves a gap to slip through.

import { FIELD } from './config.js';

export const LEVELS = [
  {
    name: 'I — The Quiet Gallery',
    hint: 'Watch the cones. Crates, hedges and cases block sight.',
    map: [
      '####################',
      '#P....C......R.....#',
      '#.....##....##.....#',
      '#.C.......D....C...#',
      '#..####...####.....#',
      '#.....D......H..#..#',
      '#.H.....C.....#....#',
      '#..##.....##......E#',
      '#....R...C....H...#',
      '####################',
    ],
    guards: [
      { kind: 'patroller', waypoints: [[8, 1], [8, 8]] },
      { kind: 'sentry', waypoints: [[15, 5]] },
    ],
  },
  {
    name: 'II — The Vault Wing',
    hint: 'Shadow tiles hide you — suspicion fills half as fast in the dark.',
    map: [
      '####################',
      '#P..C....R....C....#',
      '#.##..##...##..##..#',
      '#....H....D....H...#',
      '#.###..s...s..###..#',
      '#..D...s...s...D...#',
      '#.H....s...s....H..#',
      '#..##..C...C..##...#',
      '#....R....D....R..E#',
      '####################',
    ],
    guards: [
      { kind: 'patroller', waypoints: [[6, 1], [6, 6]] },
      { kind: 'patroller', waypoints: [[13, 1], [13, 8]] },
      { kind: 'runner', waypoints: [[4, 5], [15, 5]] },
    ],
  },
  {
    name: 'III — The Grand Hall',
    hint: 'Four wardens, one exit. Sprinting is fast — and loud.',
    map: [
      '####################',
      '#P..C.....R....C...#',
      '#.##..##....##..##.#',
      '#...H....D....H....#',
      '#.###..s....s..###.#',
      '#..D...s....s...D..#',
      '#.H....s....s....H.#',
      '#..##..C....C..##..#',
      '#...R....D....R...E#',
      '####################',
    ],
    guards: [
      { kind: 'patroller', waypoints: [[5, 1], [5, 8]] },
      { kind: 'patroller', waypoints: [[15, 1], [15, 8]] },
      { kind: 'sentry', waypoints: [[10, 4]] },
      { kind: 'runner', waypoints: [[3, 6], [16, 6]] },
    ],
  },
];

export function tileCenter(col, row) {
  const t = FIELD.tile;
  return { x: col * t + t / 2, y: FIELD.hudHeight + row * t + t / 2 };
}

export function tileAt(x, y) {
  const col = Math.floor(x / FIELD.tile);
  const row = Math.floor((y - FIELD.hudHeight) / FIELD.tile);
  return { col, row };
}

/** Parse one level definition into a grid plus the spawn points it names. */
export function parseLevel(def) {
  const grid = def.map.map((row) => row.split(''));
  let player = { x: 96, y: FIELD.hudHeight + 96 };
  let exit = { x: 0, y: 0 };
  const relics = [];
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      const cell = grid[row][col];
      if (cell === 'P') {
        player = tileCenter(col, row);
        grid[row][col] = '.';
      } else if (cell === 'E') {
        exit = tileCenter(col, row);
        grid[row][col] = '.';
      } else if (cell === 'R') {
        relics.push({ ...tileCenter(col, row), taken: false });
        grid[row][col] = '.';
      }
    }
  }
  return { grid, player, exit, relics, guards: def.guards };
}

export function inBounds(col, row) {
  return col >= 0 && col < FIELD.cols && row >= 0 && row < FIELD.rows;
}

export function cellAt(grid, col, row) {
  if (!inBounds(col, row)) return '#';
  return grid[row][col];
}

/** Walls, crates, hedges and display cases all block movement and sight. */
export function isBlocking(grid, col, row) {
  const cell = cellAt(grid, col, row);
  return cell === '#' || cell === 'C' || cell === 'H' || cell === 'D';
}

export function isShadow(grid, col, row) {
  return cellAt(grid, col, row) === 's';
}

/** True when the tile under a point blocks movement (a circle checks its edges). */
export function blockedAt(grid, x, y, radius) {
  const points = [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x - radius, y + radius],
    [x + radius, y + radius],
  ];
  return points.some(([px, py]) => {
    const { col, row } = tileAt(px, py);
    return isBlocking(grid, col, row);
  });
}
