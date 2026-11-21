// Keyboard and mouse, read once a frame. Movement keys give a direction vector;
// confirm / pause are edge-triggered actions the loop consumes with takeActions().
// Clicking the floor sets a walk target (click-to-move); any movement key cancels it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RETRY = 8;

const MOVE_KEYS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let clickTarget = null;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    } else if (event.code === 'KeyR') {
      actions |= ACTION_RETRY;
    }
    if (MOVE_KEYS[event.code]) clickTarget = null;
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    clickTarget = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    /** Normalised movement direction from held keys, or [0, 0]. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const d = MOVE_KEYS[code];
        if (d) {
          x += d[0];
          y += d[1];
        }
      }
      if (x === 0 && y === 0) return [0, 0];
      const len = Math.hypot(x, y);
      return [x / len, y / len];
    },
    sprinting() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** The current click-to-move target in logical pixels, or null. */
    takeClickTarget() {
      const target = clickTarget;
      clickTarget = null;
      return target;
    },
    /** Actions queued since the last call; the call clears them. */
    takeActions() {
      const value = actions;
      actions = 0;
      return value;
    },
  };
}
