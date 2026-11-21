// Staged scenes for screenshots (?shot=start|play|near|win with &seed=N).
// Each one poses the world deterministically — a real state of the real game,
// painted twice — and sets window.__shotReady when it is done, so a screenshot
// tool can wait for it. Nothing here edits the game; it only poses it.

import { FIELD } from './config.js';
import { tileCenter } from './level.js';
import { SCREEN_CAUGHT, SCREEN_LEVEL_DONE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Place a guard at a tile and aim its lantern at a target tile. */
function poseGuard(world, index, col, row, aimCol, aimRow, suspicion = 0, state = 'patrol') {
  const guard = world.state.guards[index];
  const at = tileCenter(col, row);
  const aim = tileCenter(aimCol, aimRow);
  guard.x = at.x;
  guard.y = at.y;
  guard.dir = Math.atan2(aim.y - at.y, aim.x - at.x);
  guard.suspicion = suspicion;
  guard.state = state;
  guard.stateTime = 0;
  if (suspicion >= 0.35) guard.lastKnown = { x: world.state.player.x, y: world.state.player.y };
}

function posePlayer(world, col, row, dir = 0) {
  const at = tileCenter(col, row);
  world.state.player.x = at.x;
  world.state.player.y = at.y;
  world.state.player.dir = dir;
}

export function stageShot(name, world) {
  const s = world.state;
  if (name === 'start') {
    world.loadLevel(0);
    return { screen: SCREEN_TITLE, best: null };
  }
  if (name === 'play') {
    world.loadLevel(0);
    s.time = 42;
    posePlayer(world, 10, 5, 0.6);
    poseGuard(world, 0, 8, 3, 8, 8);
    poseGuard(world, 1, 15, 5, 12, 5);
    s.relics[0].taken = true;
    s.relicsTaken = 1;
    s.totalRelics = 1;
    s.score = 250;
    return { screen: SCREEN_PLAY, best: null };
  }
  if (name === 'near') {
    // Level 2, one heartbeat from the alarm: the player is caught at the very
    // edge of a warden's cone, suspicion at 0.8, the "!" up, a second warden
    // closing in from the left.
    world.loadLevel(1);
    s.time = 96;
    posePlayer(world, 12, 3, Math.PI);
    poseGuard(world, 1, 13, 5, 12, 3, 0.8, 'suspect');
    poseGuard(world, 0, 6, 4, 9, 4, 0.2, 'suspect');
    poseGuard(world, 2, 8, 5, 11, 5, 0, 'patrol');
    s.maxSuspicion = 0.8;
    s.relics[0].taken = true;
    s.relicsTaken = 1;
    s.totalRelics = 3;
    s.score = 500;
    return { screen: SCREEN_PLAY, best: null };
  }
  if (name === 'win') {
    world.loadLevel(2);
    s.time = 38;
    s.totalTime = 214;
    s.totalRelics = 7;
    s.relicsTaken = 2;
    s.relics[0].taken = true;
    s.relics[1].taken = true;
    s.score = 2750;
    s.won = true;
    posePlayer(world, 17, 8, 0);
    poseGuard(world, 0, 5, 3, 5, 7);
    poseGuard(world, 1, 15, 3, 15, 7);
    poseGuard(world, 3, 9, 6, 12, 6);
    return { screen: SCREEN_WIN, best: 214000 };
  }
  if (name === 'caught') {
    world.loadLevel(0);
    s.time = 61;
    posePlayer(world, 8, 5, 0);
    poseGuard(world, 0, 8, 4, 8, 5, 1, 'chase');
    poseGuard(world, 1, 15, 5, 10, 5, 0.4, 'suspect');
    s.maxSuspicion = 1;
    s.alarm = true;
    s.caught = true;
    s.trauma = 0.8;
    return { screen: SCREEN_CAUGHT, best: null };
  }
  return { screen: SCREEN_TITLE, best: null };
}
