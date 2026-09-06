"""Real Chromium integration: python3 tests/web-browser.py (requires Playwright).
Serves the repository at an ephemeral local port. No runtime dependencies added.
"""
import functools
import http.server
from pathlib import Path
import threading
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1280, 'height':1000})
        errors = []
        if os.environ.get('WEB_CONTRACT') == '1':
            # Isolates the browser adapter while the shared renderer is being built.
            page.route('**/src/render.js', lambda route: route.fulfill(content_type='text/javascript', body="export const palettes={dark:{bg:'#0b0f10',text:'#dce3e2'},light:{bg:'#fafaf5',text:'#243333'}};export function render(){return Array.from({length:30},()=>Array.from({length:64},()=>({ch:'.',role:'text'})))}"))
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url + '?test=1')
        page.wait_for_function('!!window.__game', timeout=5000)
        assert page.locator('#overlay').is_visible()
        assert page.evaluate('__game.time') == 0
        page.locator('#play').click()
        page.wait_for_function('__game.time > 0.05')
        assert not page.locator('#overlay').is_visible()
        page.keyboard.press('p')
        assert page.evaluate('__game.state') == 'paused'
        page.locator('#play').click()
        assert page.evaluate('__game.state') == 'playing'
        x = page.evaluate('__game.player.x')
        page.keyboard.down('ArrowRight')
        page.wait_for_timeout(180)
        page.keyboard.up('ArrowRight')
        assert page.evaluate('__game.player.x') > x
        page.keyboard.press('Space')
        assert page.locator('#fire').get_attribute('aria-pressed') == 'false'
        page.keyboard.press('t')
        assert page.locator('html').get_attribute('data-theme') == 'light'
        page.evaluate('window.dispatchEvent(new Event("blur"))')
        assert page.evaluate('__game.state') == 'paused'
        page.keyboard.press('r')
        assert page.evaluate('__game.state') == 'playing'
        assert page.evaluate('__game.time') < .1
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        x = page.evaluate('__game.player.x')
        button = page.locator('[data-key="arrowleft"]').bounding_box()
        page.mouse.move(button['x']+button['width']/2, button['y']+button['height']/2)
        page.mouse.down()
        page.wait_for_timeout(150)
        page.mouse.up()
        assert page.evaluate('__game.player.x') < x
        box = page.locator('#screen').bounding_box()
        x = page.evaluate('__game.player.x')
        page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2)
        page.mouse.down()
        page.mouse.move(box['x']+box['width']/2+60, box['y']+box['height']/2)
        page.wait_for_timeout(150)
        page.mouse.up()
        assert page.evaluate('__game.player.x') > x
        page.locator('#music').click()
        page.wait_for_function('document.querySelector("#music").getAttribute("aria-pressed") === "true"')
        page.locator('#music').click()
        assert page.locator('#music').get_attribute('aria-pressed') == 'false'
        assert not errors, errors
        browser.close()
        print('PASS: real browser launch, live frame updates, pause and resume')
finally:
    server.shutdown()
