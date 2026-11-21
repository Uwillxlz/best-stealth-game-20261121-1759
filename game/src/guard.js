// The warden: a small finite-state machine — patrol, suspicious, chase, search,
// return — driven by one perception write per step (see vision.js) and by the
// noise the player makes. Guards chase the last-known position, never the
// player's live one, and a guard that raises the alarm alerts nearby wardens.
// A sentry never walks; it sweeps its lantern and calls the others.

import { GUARD_KIND, SUSPICION } from './config.js';
import { tileCenter } from './level.js';
import { coneCloseness } from './vision.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPECT = 'suspect';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

function angleLerp(from, to, maxStep) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return to;
  return from + Math.sign(diff) * maxStep;
}

export function createGuard(def, random) {
  const kind = GUARD_KIND[def.kind];
  const start = tileCenter(def.waypoints[0][0], def.waypoints[0][1]);
  const next = def.waypoints[1]
    ? tileCenter(def.waypoints[1][0], def.waypoints[1][1])
    : start;
  return {
    kind: def.kind,
    x: start.x,
    y: start.y,
    dir: Math.atan2(next.y - start.y, next.x - start.x),
    speed: kind.speed,
    chaseSpeed: kind.chaseSpeed,
    coneRange: kind.coneRange,
    coneHalfAngle: kind.coneHalfAngle,
    turnSpeed: kind.turnSpeed,
    waypoints: def.waypoints.map(([col, row]) => tileCenter(col, row)),
    waypointIndex: 1 % def.waypoints.length,
    state: GUARD_PATROL,
    stateTime: 0,
    pauseTime: 0,
    suspicion: 0,
    lastKnown: null,
    investigate: null,
    sweepDir: random.next() < 0.5 ? 1 : -1,
    sweepAngle: 0,
    heardAt: null,
  };
}

/** A guard that raises the alarm pulls every warden within earshot into the hunt. */
export function alertNearbyGuards(guards, source) {
  for (const other of guards) {
    if (other === source || other.state === GUARD_CHASE) continue;
    if (Math.hypot(other.x - source.x, other.y - source.y) > SUSPICION.alertRadius) continue;
    other.suspicion = 1;
    other.lastKnown = { ...source.lastKnown };
    other.state = GUARD_CHASE;
    other.stateTime = 0;
  }
}

function moveToward(guard, target, speed, dt) {
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.dir = angleLerp(guard.dir, Math.atan2(dy, dx), guard.turnSpeed * dt * 2);
  return dist - step < 2;
}

/**
 * One guard, one step. `world` carries the player, the grid, the clock and the
 * noise rings; `events` collects the sounds the guard should make this step.
 * Returns 'alarm' the step this guard first raises it, else null.
 */
export function updateGuard(guard, dt, world, events) {
  const { player, grid } = world;
  guard.stateTime += dt;
  let raisedAlarm = null;

  // --- Perceive: one cone + line-of-sight check per step. ---
  const closeness = coneCloseness(guard, player, grid);
  const seen = closeness > 0;
  if (seen) {
    const inShadow = world.inShadowAt(player.x, player.y);
    let rate = SUSPICION.farRate + (SUSPICION.closeRate - SUSPICION.farRate) * closeness;
    if (inShadow) rate *= SUSPICION.shadowFactor;
    if (player.sprinting) rate *= SUSPICION.sprintFactor;
    guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
    guard.lastKnown = { x: player.x, y: player.y };
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION.decayRate * dt);
  }

  // --- Hear: a noise ring inside its radius pulls a calm guard to look. ---
  if (world.noiseRings.length > 0 && guard.state !== GUARD_CHASE) {
    for (const ring of world.noiseRings) {
      if (ring.fresh && Math.hypot(ring.x - guard.x, ring.y - guard.y) <= ring.radius) {
        guard.investigate = { x: ring.x, y: ring.y };
        if (guard.state === GUARD_PATROL) {
          guard.state = GUARD_SEARCH;
          guard.stateTime = 0;
        }
      }
    }
  }

  // --- Decide: suspicion crosses thresholds, states change. ---
  if (guard.suspicion >= SUSPICION.alarmAt && guard.state !== GUARD_CHASE) {
    guard.state = GUARD_CHASE;
    guard.stateTime = 0;
    raisedAlarm = 'alarm';
    alertNearbyGuards(world.guards, guard);
  } else if (
    guard.suspicion >= SUSPICION.suspectAt &&
    (guard.state === GUARD_PATROL || guard.state === GUARD_RETURN)
  ) {
    guard.state = GUARD_SUSPECT;
    guard.stateTime = 0;
  }

  // --- Act: one behaviour per state. ---
  if (guard.state === GUARD_PATROL) {
    if (guard.kind === 'sentry') {
      guard.sweepAngle += guard.turnSpeed * guard.sweepDir * dt;
      if (Math.abs(guard.sweepAngle) > 1.1) guard.sweepDir *= -1;
      guard.dir += guard.turnSpeed * guard.sweepDir * dt;
    } else {
      if (guard.pauseTime > 0) {
        guard.pauseTime -= dt;
        guard.dir += Math.sin(world.time * 2 + guard.x) * 0.4 * dt;
      } else {
        const target = guard.waypoints[guard.waypointIndex];
        if (moveToward(guard, target, guard.speed, dt)) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.pauseTime = 0.7;
        }
      }
    }
  } else if (guard.state === GUARD_SUSPECT) {
    if (guard.lastKnown) {
      guard.dir = angleLerp(guard.dir, Math.atan2(guard.lastKnown.y - guard.y, guard.lastKnown.x - guard.x), guard.turnSpeed * dt);
      if (guard.kind !== 'sentry') {
        moveToward(guard, guard.lastKnown, guard.speed * 0.45, dt);
      }
    }
    if (guard.suspicion < 0.15) {
      guard.state = GUARD_RETURN;
      guard.stateTime = 0;
    }
  } else if (guard.state === GUARD_CHASE) {
    if (guard.kind === 'sentry') {
      // A sentry holds its post and keeps the lantern on the last-known spot.
      if (guard.lastKnown) {
        guard.dir = angleLerp(guard.dir, Math.atan2(guard.lastKnown.y - guard.y, guard.lastKnown.x - guard.x), guard.turnSpeed * 2 * dt);
      }
    } else if (guard.lastKnown) {
      moveToward(guard, guard.lastKnown, guard.chaseSpeed, dt);
    }
    if (!seen && guard.stateTime > SUSPICION.chaseMemory) {
      guard.state = GUARD_SEARCH;
      guard.stateTime = 0;
    }
  } else if (guard.state === GUARD_SEARCH) {
    const target = guard.investigate ?? guard.lastKnown;
    if (target && guard.kind !== 'sentry') {
      if (!moveToward(guard, target, guard.speed * 0.8, dt)) {
        // Still walking to the spot.
      } else if (guard.stateTime > 1) {
        guard.dir += guard.turnSpeed * dt;
      }
    } else {
      guard.dir += guard.turnSpeed * dt;
    }
    if (guard.stateTime > SUSPICION.searchTime) {
      guard.investigate = null;
      guard.state = GUARD_RETURN;
      guard.stateTime = 0;
    }
  } else if (guard.state === GUARD_RETURN) {
    if (guard.kind === 'sentry') {
      guard.state = GUARD_PATROL;
      guard.stateTime = 0;
    } else {
      // Walk back to the nearest waypoint, then resume the patrol loop.
      let nearest = 0;
      let nearestDist = Infinity;
      guard.waypoints.forEach((point, i) => {
        const d = Math.hypot(point.x - guard.x, point.y - guard.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = i;
        }
      });
      if (moveToward(guard, guard.waypoints[nearest], guard.speed, dt)) {
        guard.waypointIndex = (nearest + 1) % guard.waypoints.length;
        guard.state = GUARD_PATROL;
        guard.stateTime = 0;
      }
    }
  }

  if (raisedAlarm) events.push('alarm');
  return raisedAlarm;
}
