"""Real Chromium integration checks. Requires Python playwright + Chromium.
Run against a running static server: python3 scripts/smoke-browser.py [URL]
"""
import json
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8080/'
ROOT = Path(__file__).resolve().parents[1]

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1280, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL + ('&' if '?' in URL else '?') + 'test=1')
    page.wait_for_function('!!window.__game')
    page.click('#play')
    page.wait_for_function('window.__game.time > 0.2')
    start_x = page.evaluate('window.__game.player.x')
    page.keyboard.down('ArrowLeft')
    page.wait_for_timeout(250)
    page.keyboard.up('ArrowLeft')
    assert page.evaluate('window.__game.player.x') < start_x, 'Arrow input failed'
    page.keyboard.press('p')
    page.wait_for_function('window.__game.state === "paused"')
    frozen = page.evaluate('window.__game.time')
    page.wait_for_timeout(200)
    assert page.evaluate('window.__game.time') == frozen, 'Pause does not freeze simulation'
    page.click('#theme')
    assert page.locator('html').get_attribute('data-theme') == 'light'
    page.click('#theme')
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    page.click('#fire')
    assert page.locator('#fire').get_attribute('aria-pressed') == 'false'
    page.click('#fire')
    page.click('#music')
    page.wait_for_function('document.querySelector("#music").getAttribute("aria-pressed") === "true"')
    page.click('#music')
    page.click('#restart')
    page.wait_for_function('window.__game.state === "playing"')
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    page.wait_for_function('window.__game.state === "paused"')
    page.click('#restart')
    page.evaluate('window.__game.lives=0; window.__game.state="gameover"')
    page.wait_for_function('!document.querySelector("#overlay").hidden')
    page.click('#play')
    page.wait_for_function('window.__game.state === "playing" && window.__game.lives === 3')
    page.wait_for_timeout(1500)
    screenshots = ROOT / 'docs' / 'screenshots'
    screenshots.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(screenshots / 'browser-dark.png'), full_page=True)
    page.click('#theme')
    page.screenshot(path=str(screenshots / 'browser-light.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(100)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile horizontal overflow'
    button = page.locator('[data-key="arrowright"]')
    assert button.is_visible(), 'Touch movement unavailable'
    page.screenshot(path=str(screenshots / 'browser-mobile.png'), full_page=True)
    assert not errors, errors
    page.goto(URL)
    page.wait_for_timeout(300)
    assert page.evaluate('typeof window.__game') == 'undefined', 'Debug state exposed outside test mode'
    print(json.dumps({'result':'PASS', 'browser':browser.version,
        'checks':['launch','movement','pause','themes','autofire','Web Audio start/stop',
                  'restart','blur pause','gameover restart','mobile layout','debug gate'],
        'page_errors':errors}))
    browser.close()
