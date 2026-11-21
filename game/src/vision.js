// Vision: line of sight and the guard's sight cone, both raycast against the
// tile grid so walls and cover really do hide the player. Cheap checks run
// first (distance, then cone angle); only a target inside the cone pays for a
// raycast. The cone is drawn as a polygon of short rays, so it wraps around
// corners instead of shining through walls.

import { FIELD } from './config.js';
import { cellAt, isBlocking, tileAt } from './level.js';

/** True when no blocking tile stands between two points (sampled every 4 px). */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const { col, row } = tileAt(x0 + dx * t, y0 + dy * t);
    if (isBlocking(grid, col, row)) return false;
  }
  return true;
}

/** Distance a ray from (x, y) along an angle travels before hitting a wall. */
export function castRay(grid, x, y, angle, maxDist) {
  const step = 6;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  let travelled = 0;
  while (travelled < maxDist) {
    px += dx;
    py += dy;
    travelled += step;
    const { col, row } = tileAt(px, py);
    if (cellAt(grid, col, row) === '#') return travelled;
    if (isBlocking(grid, col, row)) return travelled;
    if (px < 0 || px > FIELD.width || py < FIELD.hudHeight || py > FIELD.height) return travelled;
  }
  return maxDist;
}

/**
 * Is the player inside this guard's cone and visible? Returns 0 when unseen,
 * otherwise a closeness of 0..1 (1 at point-blank range) the suspicion rate uses.
 */
export function coneCloseness(guard, player, grid) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > guard.coneRange) return 0;
  const angleTo = Math.atan2(dy, dx);
  let diff = angleTo - guard.dir;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > guard.coneHalfAngle) return 0;
  if (!hasLineOfSight(grid, guard.x, guard.y, player.x, player.y)) return 0;
  return 1 - dist / guard.coneRange;
}

/** The cone as a polygon of ray endpoints, for drawing. */
export function conePolygon(guard, grid, rays = 26) {
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i += 1) {
    const angle = guard.dir - guard.coneHalfAngle + (2 * guard.coneHalfAngle * i) / rays;
    const dist = castRay(grid, guard.x, guard.y, angle, guard.coneRange);
    points.push({ x: guard.x + Math.cos(angle) * dist, y: guard.y + Math.sin(angle) * dist });
  }
  return points;
}
