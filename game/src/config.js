// LUMEN HEIST — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. The top 64 px are the HUD;
// the tile grid below it is 20 columns by 10 rows of 64 px tiles.

export const FIELD = { width: 1280, height: 720, hudHeight: 64, tile: 64, cols: 20, rows: 10 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  walkSpeed: 150,
  sprintSpeed: 238,
  /** Sprinting is loud: guards hear it from this far away. */
  noiseRadius: 150,
  noiseInterval: 0.45,
};

export const GUARD_KIND = {
  /** Walks a waypoint loop, medium cone. */
  patroller: { speed: 105, chaseSpeed: 195, coneRange: 265, coneHalfAngle: 0.61, turnSpeed: 2.6 },
  /** Stands still and sweeps its lantern in a slow arc, long cone. */
  sentry: { speed: 0, chaseSpeed: 0, coneRange: 330, coneHalfAngle: 0.55, turnSpeed: 0.55 },
  /** Fast, nervous, short cone; patrols long straight runs. */
  runner: { speed: 165, chaseSpeed: 235, coneRange: 205, coneHalfAngle: 0.68, turnSpeed: 3.4 },
};

/** Suspicion 0..1 per guard. Rates are per second while the player is seen. */
export const SUSPICION = {
  /** Fill rate at point-blank range; it falls linearly to this at the cone's edge. */
  closeRate: 1.5,
  farRate: 0.28,
  /** Standing in a shadow tile halves the fill rate. */
  shadowFactor: 0.5,
  /** Sprinting in a cone fills suspicion faster. */
  sprintFactor: 1.45,
  /** Drain rate while unseen. */
  decayRate: 0.65,
  /** Above this the guard turns toward you and closes in. */
  suspectAt: 0.35,
  /** At this the alarm sounds and the guard chases. */
  alarmAt: 1,
  /** A guard that spots you alerts every guard within this distance. */
  alertRadius: 340,
  /** Seconds a chasing guard keeps hunting after losing sight. */
  chaseMemory: 2.5,
  /** Seconds a guard searches the last-known spot before giving up. */
  searchTime: 2.6,
};

export const NOISE = {
  /** A relic pickup pings this far; guards inside it come to look. */
  pickupRadius: 85,
  /** How long a noise ring stays visible, in seconds. */
  ringLife: 0.6,
};

export const RELIC_POINTS = 250;
export const EXIT_POINTS = 500;

export const PALETTE = {
  backdrop: '#070a12',
  floorA: '#232c42',
  floorB: '#1d2538',
  shadowFloorA: '#1a1430',
  shadowFloorB: '#151127',
  wall: '#2a3350',
  wallEdge: '#5a6a94',
  crate: '#6b4a2a',
  crateEdge: '#9a6b3a',
  hedge: '#1e4d2a',
  hedgeLight: '#2f7a42',
  caseFrame: '#4a5568',
  caseGlass: '#9fd8e8',
  exit: '#39d98a',
  exitGlow: '#7dffb0',
  relic: '#f2c94c',
  player: '#2dd4bf',
  playerDark: '#0f766e',
  guard: '#f59e0b',
  guardDark: '#92400e',
  cone: '#facc15',
  coneSuspicious: '#fb923c',
  coneAlarm: '#ef4444',
  darkness: 'rgba(3, 5, 12, 0.45)',
  panel: '#101827',
  panelEdge: '#2b3a55',
  text: '#eef1f5',
  muted: '#8b93a3',
  danger: '#f87171',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best clear time is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-heist.best-ms';
