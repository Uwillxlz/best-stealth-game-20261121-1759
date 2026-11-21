"""Real-browser play-test + screenshots for LUMEN HEIST.

1. Serves game/ with the repo's own serve.ts.
2. Captures the 4 staged screenshots from shots.json.
3. Plays level 1 in the real browser with real keyboard events (steered by
   reading the player position), expecting LEVEL DONE.
4. Plays into a patrolling warden's path, expecting ALARM then CAUGHT.
Fails loudly on console errors or on a missing outcome.
"""
import json
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

REPO = '/home/hatch/workspace/makefun/best-stealth-game-20261121-1759'
PORT = 8091
BASE = f'http://localhost:{PORT}'

shots = json.load(open(f'{REPO}/shots.json'))
failures = []


def check(name, cond, extra=''):
    print(f"{'PASS' if cond else 'FAIL'}  {name} {extra}")
    if not cond:
        failures.append(name)


def wait_for_clear(page, col, row, radius=260, timeout_s=30):
    """Wait until no warden is within `radius` of a tile — time the crossing."""
    tx, ty = tile_xy(col, row)
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        near = page.evaluate(
            f"""() => window.__lumen.world.state.guards.some(g =>
                Math.hypot(g.x - {tx}, g.y - {ty}) < {radius})""")
        if not near:
            return True
        page.wait_for_timeout(200)
    return False


def steer_to(page, tx, ty, timeout_s=60, stop_when=None, retreat_to=None, sprint=False):
    """Hold movement keys toward a tile target, using the live player position."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        st = page.evaluate("() => { const s = window.__lumen.world.state; return {x: s.player.x, y: s.player.y, caught: s.caught, levelDone: s.levelDone, won: s.won, alarm: s.alarm, suspicion: s.maxSuspicion}; }")
        if stop_when and stop_when(st):
            return st
        if st['suspicion'] > 0.45 and retreat_to and not sprint:
            # On a sprint leg the thief pushes through: a one-second brush
            # with the cone's edge cannot fill the meter before they are out.
            # A patient thief falls back to the last safe spot when spotted.
            for k in ('KeyW', 'KeyA', 'KeyS', 'KeyD'):
                page.keyboard.up(k)
            rx, ry = retreat_to
            if abs(rx - st['x']) > 10 or abs(ry - st['y']) > 10:
                dx, dy = rx - st['x'], ry - st['y']
                d = max(1, abs(dx) + abs(dy))
                if dx > 10:
                    page.keyboard.down('KeyD')
                elif dx < -10:
                    page.keyboard.down('KeyA')
                if dy > 10:
                    page.keyboard.down('KeyS')
                elif dy < -10:
                    page.keyboard.down('KeyW')
                page.wait_for_timeout(120)
            else:
                page.wait_for_timeout(300)
            continue
        dx = tx - st['x']
        dy = ty - st['y']
        if abs(dx) < 10 and abs(dy) < 10:
            for k in ('KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'):
                page.keyboard.up(k)
            return st
        # Release all movement keys, then hold the ones needed this tick.
        for k in ('KeyW', 'KeyA', 'KeyS', 'KeyD'):
            page.keyboard.up(k)
        if sprint:
            page.keyboard.down('ShiftLeft')
        if dx > 10:
            page.keyboard.down('KeyD')
        elif dx < -10:
            page.keyboard.down('KeyA')
        if dy > 10:
            page.keyboard.down('KeyS')
        elif dy < -10:
            page.keyboard.down('KeyW')
        page.wait_for_timeout(90)
    for k in ('KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'):
        page.keyboard.up(k)
    return page.evaluate("() => { const s = window.__lumen.world.state; return {x: s.player.x, y: s.player.y, caught: s.caught, levelDone: s.levelDone, won: s.won, alarm: s.alarm, suspicion: s.maxSuspicion}; }")


def tile_xy(col, row):
    return (col * 64 + 32, 64 + row * 64 + 32)


server = subprocess.Popen(['node', 'serve.ts', '--port', str(PORT)], cwd=REPO,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        errors = []
        page = browser.new_page(viewport={'width': 1280, 'height': 720})
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))

        # --- Staged screenshots ---
        for shot in shots:
            page.goto(f"{BASE}/?shot={shot['query'].split('?shot=')[1]}")
            page.wait_for_function('window.__shotReady === true', timeout=15000)
            path = f"{REPO}/screenshots/{shot['name']}"
            page.screenshot(path=path, type='jpeg', quality=82)
            print(f"shot {shot['name']} saved")

        # --- Play level 1 to the exit with real keys ---
        page.goto(BASE)
        page.wait_for_timeout(600)
        page.keyboard.press('Enter')
        page.wait_for_timeout(400)
        # The level's walkable route (same BFS path the headless bot proved):
        # across the top, down the middle, then along row 7 to the exit. The
        # (9,3) step crosses the col-8 patroller's line, so wait until that
        # warden is far from the crossing before stepping across.
        route = [(5, 1), (5, 3), (9, 3), (9, 5), (12, 5), (13, 7), (18, 7)]
        final = None
        prev_xy = tile_xy(1, 1)
        for col, row in route:
            sprint_leg = False
            if (col, row) == (9, 3):
                wait_for_clear(page, 8, 3, radius=300, timeout_s=30)
            x, y = tile_xy(col, row)
            final = steer_to(page, x, y, timeout_s=40,
                             stop_when=lambda st: st['levelDone'] or st['caught'],
                             retreat_to=prev_xy, sprint=sprint_leg)
            prev_xy = (x, y)
            if final['levelDone'] or final['caught']:
                break
        check('play level 1 reaches the exit (real keys)', final and final['levelDone'],
              f"caught={final and final['caught']} pos=({final and round(final['x'])},{final and round(final['y'])})")
        screen = page.evaluate("() => window.__lumen.screen")
        check('screen is level-done after exit', screen == 'level-done', f'screen={screen}')

        # --- Walk into the patroller: expect alarm, then caught ---
        page.goto(BASE)
        page.wait_for_timeout(600)
        page.keyboard.press('Enter')
        page.wait_for_timeout(400)
        # Walk right along row 1, then straight down the patroller's column
        # and wait there: the warden must come back up the corridor, spot the
        # player head-on, raise the alarm and catch them.
        steer_to(page, *tile_xy(8, 1), timeout_s=30)
        steer_to(page, *tile_xy(8, 5), timeout_s=30)
        seen = None
        deadline = time.time() + 25
        while time.time() < deadline:
            seen = page.evaluate("() => { const s = window.__lumen.world.state; return {x: s.player.x, y: s.player.y, caught: s.caught, levelDone: s.levelDone, won: s.won, alarm: s.alarm, suspicion: s.maxSuspicion}; }")
            if seen['caught']:
                break
            page.wait_for_timeout(200)
        check('walking into the patrol raises the alarm', seen['alarm'] or seen['caught'],
              f"alarm={seen['alarm']} caught={seen['caught']}")
        check('the chaser catches the player', seen['caught'],
              f"caught={seen['caught']}")
        screen = page.evaluate("() => window.__lumen.screen")
        check('screen is caught after being touched', screen == 'caught', f'screen={screen}')
        # Retry with R, back to playing.
        page.keyboard.press('KeyR')
        page.wait_for_timeout(400)
        screen = page.evaluate("() => window.__lumen.screen")
        check('R retries the level', screen == 'play', f'screen={screen}')

        check('no console/page errors during the whole session', len(errors) == 0, str(errors[:3]))
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=5)

print('ALL BROWSER TESTS PASSED' if not failures else f"{len(failures)} BROWSER TEST(S) FAILED: {failures}")
sys.exit(0 if not failures else 1)
