// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, caught, level-done and win. `?seed=N` fixes the run's randomness;
// `?shot=start|play|near|win|caught` (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady.
//
// For automated play-testing the world is exposed as window.__lumen (state,
// the world API, and the screen setter) — it changes nothing about the game.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_LEVEL_DONE, EVENT_PICKUP, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RETRY, createInput } from './input.js';
import {
  createRenderer,
  SCREEN_CAUGHT,
  SCREEN_LEVEL_DONE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';
import {
  isMuted,
  playAlarm,
  playCaught,
  playClick,
  playFootstep,
  playPickup,
  playWin,
  setMuted,
  unlockAudio,
} from './audio.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || null;
  } catch {
    return null;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stepSoundTimer = 0;
  let levelDoneTimer = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    unlockAudio();
    playClick();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing ${world.state.levelName}. Reach the green exit unseen.`);
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) playPickup();
    if (events & EVENT_ALARM) playAlarm();
    if (events & EVENT_CAUGHT) {
      playCaught();
      screen = SCREEN_CAUGHT;
      announce('Caught! Press R to try the level again.');
    } else if (events & EVENT_WIN) {
      playWin(true);
      screen = SCREEN_WIN;
      const totalMs = Math.round(world.state.totalTime * 1000);
      if (!best || totalMs < best) {
        best = totalMs;
        saveBest(best);
      }
      announce(`Clean getaway in ${renderer.formatTime(world.state.totalTime)}. Score ${world.state.score}.`);
    } else if (events & EVENT_LEVEL_DONE) {
      playWin(false);
      screen = SCREEN_LEVEL_DONE;
      levelDoneTimer = 0;
      announce(`${world.state.levelName} cleared. Next gallery loading.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      setMuted(!isMuted());
      announce(isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      unlockAudio();
      if (screen === SCREEN_TITLE || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_RETRY && (screen === SCREEN_CAUGHT || screen === SCREEN_PLAY)) {
      playClick();
      world.loadLevel(world.state.levelIndex);
      screen = SCREEN_PLAY;
      announce(`Retrying ${world.state.levelName}.`);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    if (screen === SCREEN_LEVEL_DONE) {
      levelDoneTimer += STEP;
      if (levelDoneTimer > 1.6) {
        world.nextLevel();
        screen = SCREEN_PLAY;
        announce(`Playing ${world.state.levelName}. Reach the green exit unseen.`);
      }
      return;
    }
    const events = world.step(STEP, input);
    handleEvents(events);
    // Footsteps: the nearest moving warden ticks, louder the closer it is,
    // so the player hears a patrol coming before seeing the cone.
    stepSoundTimer -= STEP;
    if (stepSoundTimer <= 0) {
      let nearest = Infinity;
      for (const guard of world.state.guards) {
        if (guard.kind === 'sentry') continue;
        nearest = Math.min(nearest, Math.hypot(guard.x - world.state.player.x, guard.y - world.state.player.y));
      }
      if (nearest < 340) {
        playFootstep(nearest);
        stepSoundTimer = 0.42;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY || screen === SCREEN_LEVEL_DONE) {
      while (accumulator >= STEP && (screen === SCREEN_PLAY || screen === SCREEN_LEVEL_DONE)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world.state.time);
  }

  // Leaving the tab pauses a running game rather than letting wardens walk unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  window.__lumen = {
    world,
    get screen() {
      return screen;
    },
    startGame,
  };

  announce('Lumen Heist. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
