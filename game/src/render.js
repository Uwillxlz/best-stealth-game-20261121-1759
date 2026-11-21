// The painter: floor, walls and cover, then the guards' sight cones, then the
// people and pickups, then a darkness layer with light punched out around the
// player, the wardens, the exit and the relics — lighting that shows what is
// safe. The HUD and the title / caught / win screens are drawn here too, so
// every screenshot is one canvas, readable at a glance when shrunk.

import { FIELD, PALETTE, FONT } from './config.js';
import { cellAt, isShadow } from './level.js';
import { conePolygon } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LEVEL_DONE = 'level-done';
export const SCREEN_WIN = 'win';

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = FIELD.width;
  const H = FIELD.height;
  const T = FIELD.tile;
  // The night layer: darkness is painted here and light punched out of it,
  // then the whole layer is drawn over the scene in one image.
  const lightCanvas = document.createElement('canvas');
  lightCanvas.width = W;
  lightCanvas.height = H;
  const lightCtx = lightCanvas.getContext('2d');

  function drawFloor(state) {
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 20; col += 1) {
        const cell = cellAt(state.grid, col, row);
        const x = col * T;
        const y = FIELD.hudHeight + row * T;
        const shadow = isShadow(state.grid, col, row);
        if (cell === '#') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, T, T);
          ctx.fillStyle = PALETTE.wallEdge;
          ctx.fillRect(x, y, T, 3);
          continue;
        }
        const even = (col + row) % 2 === 0;
        ctx.fillStyle = shadow
          ? even ? PALETTE.shadowFloorA : PALETTE.shadowFloorB
          : even ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, T, T);
        if (shadow) {
          ctx.fillStyle = 'rgba(120, 90, 220, 0.10)';
          ctx.fillRect(x + 6, y + 6, T - 12, T - 12);
        }
        if (cell === 'C') {
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(x + 7, y + 7, T - 14, T - 14);
          ctx.strokeStyle = PALETTE.crateEdge;
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 7, y + 7, T - 14, T - 14);
          ctx.beginPath();
          ctx.moveTo(x + 7, y + 7);
          ctx.lineTo(x + T - 7, y + T - 7);
          ctx.moveTo(x + T - 7, y + 7);
          ctx.lineTo(x + 7, y + T - 7);
          ctx.stroke();
        } else if (cell === 'H') {
          ctx.fillStyle = PALETTE.hedge;
          ctx.beginPath();
          ctx.arc(x + T / 2, y + T / 2, 26, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.hedgeLight;
          ctx.beginPath();
          ctx.arc(x + T / 2 - 8, y + T / 2 - 8, 12, 0, Math.PI * 2);
          ctx.arc(x + T / 2 + 10, y + T / 2 + 6, 9, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === 'D') {
          ctx.fillStyle = PALETTE.caseFrame;
          ctx.fillRect(x + 10, y + 10, T - 20, T - 20);
          ctx.fillStyle = '#1d2f45';
          ctx.fillRect(x + 14, y + 14, T - 28, T - 28);
          ctx.strokeStyle = PALETTE.caseGlass;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 18, y + T - 18);
          ctx.lineTo(x + T - 22, y + 20);
          ctx.stroke();
          ctx.fillStyle = PALETTE.relic;
          ctx.beginPath();
          ctx.arc(x + T / 2, y + T / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawExit(state, time) {
    const { x, y } = state.exit;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 110);
    glow.addColorStop(0, `rgba(57, 217, 138, ${0.75 * pulse})`);
    glow.addColorStop(1, 'rgba(57, 217, 138, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 110, y - 110, 220, 220);
    ctx.fillStyle = PALETTE.exit;
    ctx.fillRect(x - 24, y - 28, 48, 56);
    ctx.fillStyle = '#06281a';
    ctx.fillRect(x - 16, y - 20, 32, 40);
    ctx.fillStyle = PALETTE.exitGlow;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', x, y - 36);
    ctx.strokeStyle = `rgba(125, 255, 176, ${0.4 + 0.4 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 34 + 4 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawRelics(state, time) {
    for (const relic of state.relics) {
      if (relic.taken) continue;
      const bob = Math.sin(time * 2 + relic.x) * 3;
      const glow = ctx.createRadialGradient(relic.x, relic.y + bob, 2, relic.x, relic.y + bob, 34);
      glow.addColorStop(0, 'rgba(242, 201, 76, 0.55)');
      glow.addColorStop(1, 'rgba(242, 201, 76, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(relic.x - 34, relic.y + bob - 34, 68, 68);
      ctx.fillStyle = PALETTE.relic;
      ctx.beginPath();
      ctx.moveTo(relic.x, relic.y + bob - 12);
      ctx.lineTo(relic.x + 9, relic.y + bob);
      ctx.lineTo(relic.x, relic.y + bob + 12);
      ctx.lineTo(relic.x - 9, relic.y + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff7d6';
      ctx.beginPath();
      ctx.moveTo(relic.x, relic.y + bob - 6);
      ctx.lineTo(relic.x + 4, relic.y + bob);
      ctx.lineTo(relic.x, relic.y + bob + 6);
      ctx.lineTo(relic.x - 4, relic.y + bob);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const polygon = conePolygon(guard, state.grid);
      let color = PALETTE.cone;
      let alpha = 0.26;
      if (guard.state === 'chase') {
        color = PALETTE.coneAlarm;
        alpha = 0.34;
      } else if (guard.suspicion > 0.35 || guard.state === 'suspect') {
        color = PALETTE.coneSuspicious;
        alpha = 0.3;
      }
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawNoiseRings(state) {
    for (const ring of state.noiseRings) {
      const progress = 1 - ring.life / ring.maxLife;
      const radius = ring.radius * (0.3 + 0.7 * progress);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * (1 - progress)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawGuard(guard) {
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 10, 0, Math.PI * 2);
    ctx.fill();
    // Lantern dot and facing tick: the warden reads as a person, not a blob.
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.dir) * 17, guard.y + Math.sin(guard.dir) * 17, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.guard;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.dir) * 24, guard.y + Math.sin(guard.dir) * 24);
    ctx.stroke();
    if (guard.state === 'suspect' || guard.suspicion > 0.35) {
      ctx.fillStyle = '#fb923c';
      ctx.font = `bold 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - 26);
    } else if (guard.state === 'search' || guard.state === 'chase') {
      ctx.fillStyle = guard.state === 'chase' ? '#ef4444' : '#facc15';
      ctx.font = `bold 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(guard.state === 'chase' ? '!' : '?', guard.x, guard.y - 26);
    }
    if (guard.suspicion > 0.05 && guard.suspicion < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(guard.x - 18, guard.y - 40, 36, 6);
      ctx.fillStyle = guard.suspicion > 0.6 ? '#ef4444' : '#fb923c';
      ctx.fillRect(guard.x - 18, guard.y - 40, 36 * guard.suspicion, 6);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.dir) * 20, p.y + Math.sin(p.dir) * 20);
    ctx.lineTo(p.x + Math.cos(p.dir + 2.5) * 12, p.y + Math.sin(p.dir + 2.5) * 12);
    ctx.lineTo(p.x + Math.cos(p.dir - 2.5) * 12, p.y + Math.sin(p.dir - 2.5) * 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ccfbf1';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (state.walkTarget) {
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.walkTarget.x, state.walkTarget.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawDarkness(state) {
    // The night is painted on its own layer and the light is punched out of
    // THAT layer, so the floor beneath stays intact where the light falls —
    // punching holes in the main canvas would erase the floor itself.
    lightCtx.clearRect(0, 0, W, H);
    lightCtx.fillStyle = PALETTE.darkness;
    lightCtx.fillRect(0, FIELD.hudHeight, W, H - FIELD.hudHeight);
    lightCtx.globalCompositeOperation = 'destination-out';
    const holes = [
      { x: state.player.x, y: state.player.y, r: 300 },
      { x: state.exit.x, y: state.exit.y, r: 180 },
      ...state.guards.map((g) => ({ x: g.x, y: g.y, r: 200 })),
      ...state.relics.filter((r) => !r.taken).map((r) => ({ x: r.x, y: r.y, r: 95 })),
    ];
    for (const hole of holes) {
      const gradient = lightCtx.createRadialGradient(hole.x, hole.y, 10, hole.x, hole.y, hole.r);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      lightCtx.fillStyle = gradient;
      lightCtx.beginPath();
      lightCtx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
      lightCtx.fill();
    }
    lightCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCanvas, 0, 0);
  }

  function drawHud(state, screen, bestMs) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, W, FIELD.hudHeight);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, FIELD.hudHeight - 2, W, 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('LUMEN HEIST', 18, 28);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `14px ${FONT}`;
    ctx.fillText(state.levelName, 18, 50);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(`◆ ${state.relicsTaken}/${state.relicsTotal}`, W / 2 - 130, 38);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`TIME ${formatTime(state.time)}`, W / 2 + 40, 38);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(bestMs ? `BEST ${formatTime(bestMs / 1000)}` : 'NO BEST YET', W / 2 + 40, 56);
    if (state.alarm) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText('⚠ ALARM', W - 180, 38);
    } else if (state.maxSuspicion > 0.05) {
      ctx.fillStyle = '#fb923c';
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillText('SUSPICION', W - 180, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(W - 250, 38, 140, 8);
      ctx.fillStyle = state.maxSuspicion > 0.6 ? '#ef4444' : '#fb923c';
      ctx.fillRect(W - 250, 38, 140 * state.maxSuspicion, 8);
    } else {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `14px ${FONT}`;
      ctx.fillText('UNSEEN', W - 180, 38);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('WASD move · Shift sprint (loud!) · Click to walk · P pause · M mute', W - 14, H - 6);
    if (screen === SCREEN_PLAY) {
      ctx.fillStyle = 'rgba(238, 241, 245, 0.75)';
      ctx.font = `13px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(state.levelHint, 18, H - 6);
    }
  }

  function drawOverlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(4, 6, 14, 0.72)';
    ctx.fillRect(0, FIELD.hudHeight, W, H - FIELD.hudHeight);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `bold 54px ${FONT}`;
    ctx.fillText(title, W / 2, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 350 + i * 34));
  }

  function draw(state, screen, bestMs, time) {
    const shake = state.trauma * state.trauma;
    const ox = shake * 10 * Math.sin(time * 61);
    const oy = shake * 8 * Math.sin(time * 53);
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, W, H);
    ctx.translate(ox, oy);
    drawFloor(state);
    drawExit(state, time);
    drawRelics(state, time);
    drawDarkness(state);
    drawCones(state);
    drawNoiseRings(state);
    for (const guard of state.guards) drawGuard(guard);
    drawPlayer(state);
    drawParticles(state);
    ctx.restore();
    drawHud(state, screen, bestMs);
    if (screen === SCREEN_TITLE) {
      drawOverlay('LUMEN HEIST', [
        'Pocket the relics. One green door.',
        'Slip past the wardens — their lantern cones see everything lit.',
        'Crates, hedges and cases block sight. Shadow tiles hide you.',
        'Sprint is fast and loud. Getting caught ends the run.',
        '',
        'Press Enter or click to begin',
      ], PALETTE.gold);
    } else if (screen === SCREEN_PAUSED) {
      drawOverlay('PAUSED', ['Press P or Enter to keep sneaking.'], PALETTE.text);
    } else if (screen === SCREEN_CAUGHT) {
      drawOverlay('CAUGHT!', [
        'A warden laid a hand on your shoulder.',
        `Level ${state.levelIndex + 1} — press R to try it again.`,
      ], PALETTE.danger);
    } else if (screen === SCREEN_LEVEL_DONE) {
      drawOverlay('CLEAN!', [
        `${state.levelName} cleared unseen.`,
        `Score ${state.score} — the next gallery awaits…`,
      ], PALETTE.exit);
    } else if (screen === SCREEN_WIN) {
      drawOverlay('CLEAN GETAWAY', [
        `All three galleries cleared in ${formatTime(state.totalTime)}.`,
        `Relics ◆ ${state.totalRelics}/${state.totalRelicsAll}  ·  Score ${state.score}`,
        bestMs ? `Best getaway: ${formatTime(bestMs / 1000)}` : '',
        'Press Enter to steal again.',
      ], PALETTE.exitGlow);
    }
  }

  return { draw, formatTime };
}
