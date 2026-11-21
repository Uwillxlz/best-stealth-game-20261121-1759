// The simulation: player movement and noise, relics, the exit, the alarm, and
// the win/caught/level-done outcomes. Pure logic — no DOM, no canvas — so the
// same file runs in the browser and in a headless Node test. The renderer only
// reads `state`; the loop only calls `step`.

import {
  EXIT_POINTS,
  FIELD,
  NOISE,
  PLAYER,
  RELIC_POINTS,
  STEP,
} from './config.js';
import { createRandom } from './random.js';
import { LEVELS, blockedAt, isShadow, parseLevel, tileAt } from './level.js';
import { createGuard, updateGuard } from './guard.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_ALARM = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL_DONE = 8;
export const EVENT_WIN = 16;

export function createWorld(seed) {
  const random = createRandom(seed);
  const state = {
    levelIndex: 0,
    levelName: '',
    levelHint: '',
    player: { x: 0, y: 0, dir: 0, sprinting: false, moving: false, stepTimer: 0 },
    guards: [],
    relics: [],
    exit: { x: 0, y: 0 },
    grid: [],
    time: 0,
    totalTime: 0,
    relicsTaken: 0,
    relicsTotal: 0,
    totalRelics: 0,
    score: 0,
    alarm: false,
    alarmTime: 0,
    noiseRings: [],
    particles: [],
    trauma: 0,
    caught: false,
    levelDone: false,
    levelDoneTime: 0,
    won: false,
    bestMs: null,
    /** The highest suspicion of any guard, 0..1 — the HUD bar reads this. */
    maxSuspicion: 0,
    walkTarget: null,
  };

  function loadLevel(index) {
    const def = LEVELS[index];
    const parsed = parseLevel(def);
    state.levelIndex = index;
    state.levelName = def.name;
    state.levelHint = def.hint;
    state.grid = parsed.grid;
    state.player.x = parsed.player.x;
    state.player.y = parsed.player.y;
    state.player.dir = 0;
    state.player.walkTarget = null;
    state.walkTarget = null;
    state.exit = parsed.exit;
    state.relics = parsed.relics;
    state.relicsTotal = parsed.relics.length;
    state.relicsTaken = 0;
    state.guards = parsed.guards.map((def2) => createGuard(def2, random));
    state.noiseRings = [];
    state.particles = [];
    state.alarm = false;
    state.alarmTime = 0;
    state.maxSuspicion = 0;
    state.caught = false;
    state.levelDone = false;
    state.levelDoneTime = 0;
  }

  function burst(x, y, color, count, speed = 120) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.next() * Math.PI * 2;
      const v = speed * (0.4 + random.next() * 0.8);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 0.5 + random.next() * 0.3,
        maxLife: 0.8,
        color,
        size: 2 + random.next() * 3,
      });
    }
  }

  function emitNoise(x, y, radius) {
    state.noiseRings.push({ x, y, radius, life: NOISE.ringLife, maxLife: NOISE.ringLife, fresh: true });
  }

  function movePlayer(dx, dy, dt) {
    const speed = state.player.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const nx = dx / len;
    const ny = dy / len;
    const p = state.player;
    p.dir = Math.atan2(ny, nx);
    p.moving = true;
    const stepX = nx * speed * dt;
    const stepY = ny * speed * dt;
    if (!blockedAt(state.grid, p.x + stepX, p.y, PLAYER.radius)) p.x += stepX;
    if (!blockedAt(state.grid, p.x, p.y + stepY, PLAYER.radius)) p.y += stepY;
    p.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, p.x));
    p.y = Math.max(FIELD.hudHeight + PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, p.y));

    // Footsteps: the player's own are silent to the guards, but a sprint
    // rings out — a visible ring the wardens can hear.
    p.stepTimer -= dt;
    if (p.sprinting && p.stepTimer <= 0) {
      p.stepTimer = PLAYER.noiseInterval;
      emitNoise(p.x, p.y, PLAYER.noiseRadius);
    }
  }

  function step(dt, input) {
    let events = EVENT_NONE;
    if (state.caught || state.won) return events;
    if (state.levelDone) {
      state.levelDoneTime += dt;
      return events;
    }
    state.time += dt;
    state.totalTime += dt;
    state.trauma = Math.max(0, state.trauma - 1.6 * dt);

    // --- Player input: keys first, click-to-move second. ---
    const [ix, iy] = input.direction();
    state.player.sprinting = input.sprinting();
    state.player.moving = false;
    if (ix !== 0 || iy !== 0) {
      state.walkTarget = null;
      movePlayer(ix, iy, dt);
    } else if (state.walkTarget) {
      const dx = state.walkTarget.x - state.player.x;
      const dy = state.walkTarget.y - state.player.y;
      if (Math.hypot(dx, dy) < 10) {
        state.walkTarget = null;
      } else {
        movePlayer(dx, dy, dt);
      }
    }
    const click = input.takeClickTarget ? input.takeClickTarget() : null;
    if (click && click.y > FIELD.hudHeight) state.walkTarget = click;

    // --- Guards: perceive, decide, act. ---
    const guardEvents = [];
    let maxSuspicion = 0;
    for (const guard of state.guards) {
      const raised = updateGuard(guard, dt, state, guardEvents);
      if (raised) {
        state.alarm = true;
        state.alarmTime = 0;
        state.trauma = Math.min(1, state.trauma + 0.55);
        events |= EVENT_ALARM;
      }
      maxSuspicion = Math.max(maxSuspicion, guard.suspicion);
    }
    state.maxSuspicion = maxSuspicion;
    if (state.alarm) state.alarmTime += dt;
    if (maxSuspicion < 0.05 && state.alarmTime > 1) state.alarm = false;

    // Noise rings age out; only the first step of their life alerts guards.
    for (const ring of state.noiseRings) ring.life -= dt;
    state.noiseRings = state.noiseRings.filter((ring) => ring.life > 0);
    for (const ring of state.noiseRings) ring.fresh = false;

    // --- Relics: pocket one by walking over it; the clink carries a little. ---
    for (const relic of state.relics) {
      if (relic.taken) continue;
      if (Math.hypot(relic.x - state.player.x, relic.y - state.player.y) < 30) {
        relic.taken = true;
        state.relicsTaken += 1;
        state.totalRelics += 1;
        state.score += RELIC_POINTS;
        burst(relic.x, relic.y, '#f2c94c', 14);
        emitNoise(relic.x, relic.y, NOISE.pickupRadius);
        events |= EVENT_PICKUP;
      }
    }

    // --- Exit: reach the green door unseen to clear the level. ---
    if (Math.hypot(state.exit.x - state.player.x, state.exit.y - state.player.y) < 34) {
      state.score += EXIT_POINTS;
      if (state.levelIndex >= LEVELS.length - 1) {
        state.won = true;
        events |= EVENT_WIN;
      } else {
        state.levelDone = true;
        state.levelDoneTime = 0;
        events |= EVENT_LEVEL_DONE;
      }
      return events;
    }

    // --- Caught: a chasing warden touches the player. ---
    for (const guard of state.guards) {
      if (guard.state === 'chase' && Math.hypot(guard.x - state.player.x, guard.y - state.player.y) < 28) {
        state.caught = true;
        state.trauma = 1;
        burst(state.player.x, state.player.y, '#ef4444', 26, 180);
        events |= EVENT_CAUGHT;
        break;
      }
    }

    // Particles fade.
    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.92;
      particle.vy *= 0.92;
    }
    state.particles = state.particles.filter((p) => p.life > 0);

    state.guardEvents = guardEvents;
    return events;
  }

  const api = {
    state,
    loadLevel,
    step,
    nextLevel() {
      loadLevel(state.levelIndex + 1);
    },
    reset() {
      state.time = 0;
      state.totalTime = 0;
      state.totalRelics = 0;
      state.score = 0;
      state.won = false;
      loadLevel(0);
    },
  };
  // The guards read this through the state object passed to updateGuard.
  state.inShadowAt = (x, y) => {
    const { col, row } = tileAt(x, y);
    return isShadow(state.grid, col, row);
  };
  loadLevel(0);
  return api;
}
