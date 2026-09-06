"""Capture the real CLI in a PTY and photograph its xterm.js rendering.

Dev-only prerequisites: Python playwright + Chromium, and
npm install --prefix /tmp/terminal-shooter-qa @xterm/xterm@5.5.0
Run: python3 scripts/capture-terminal.py
"""
import fcntl
import json
import os
from pathlib import Path
import pty
import select
import struct
import subprocess
import termios
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
XTERM = Path('/tmp/terminal-shooter-qa/node_modules/@xterm/xterm')


def capture(theme):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 36, 80, 0, 0))
    before = termios.tcgetattr(slave)
    process = subprocess.Popen(['node', 'bin/terminal-shooter.js', '--theme', theme],
                               cwd=ROOT, stdin=slave, stdout=slave, stderr=slave,
                               env={**os.environ, 'TERM': 'xterm-256color'})
    output = bytearray()
    deadline = time.monotonic() + 9
    while time.monotonic() < deadline:
        if select.select([master], [], [], .05)[0]:
            output.extend(os.read(master, 65536))
    # Freeze the captured stream, not the game: show an actual playing frame.
    frame = output.decode('utf-8', errors='replace')
    os.write(master, b'q')
    process.wait(timeout=4)
    assert process.returncode == 0, process.returncode
    assert termios.tcgetattr(slave) == before, 'Terminal attributes not restored'
    os.close(master)
    os.close(slave)
    assert len(frame) > 1000, 'No terminal frames produced'
    return frame


def main():
    target = ROOT / 'docs' / 'screenshots'
    target.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox'])
        for theme in ['dark', 'light']:
            frame = capture(theme)
            bg, fg = ('#090f16', '#d6e4ef') if theme == 'dark' else ('#ffffff', '#182b3b')
            page = browser.new_page(viewport={'width': 1120, 'height': 820}, device_scale_factor=1)
            page.set_content(f'''<!doctype html><style>
              html,body{{margin:0;background:{bg};color:{fg};font:14px monospace}}
              header{{height:48px;box-sizing:border-box;padding:16px 28px;border-bottom:1px solid {fg}33;display:flex;justify-content:space-between}}
              #terminal{{padding:20px 28px}}
              </style><header><span>terminal-shooter</span><span>node bin/terminal-shooter.js --theme {theme}</span></header><div id="terminal"></div>''')
            page.add_style_tag(path=str(XTERM / 'css' / 'xterm.css'))
            page.add_script_tag(path=str(XTERM / 'lib' / 'xterm.js'))
            page.evaluate('''({frame,bg,fg}) => new Promise(resolve => {
              window.term = new Terminal({cols:80,rows:36,fontSize:20,lineHeight:1.02,
                fontFamily:'"DejaVu Sans Mono", monospace',cursorBlink:false,
                theme:{background:bg,foreground:fg},allowTransparency:false});
              term.open(document.querySelector('#terminal'));
              term.write(frame,resolve);
            })''', {'frame': frame, 'bg': bg, 'fg': fg})
            page.screenshot(path=str(target / f'terminal-{theme}.png'), full_page=True)
            print(json.dumps({'theme': theme, 'pty_bytes': len(frame), 'exit': 0,
                              'terminal_restored': True, 'screenshot': str(target / f'terminal-{theme}.png')}))
            page.close()
        browser.close()


if __name__ == '__main__':
    main()
