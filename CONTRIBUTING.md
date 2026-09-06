# Developing

No runtime packages, bundler, or remote fonts. Node.js 20+ runs the terminal
edition and tests; any static HTTP server runs the browser edition.

```sh
npm test
python3 scripts/smoke-terminal.py
python3 -m http.server 8080
```

Open `http://localhost:8080`. ES modules require HTTP, not `file://`.

## Layout

- `src/engine.js` — shared deterministic simulation; seconds in, game state out.
- `src/render.js` — shared character-cell framebuffer and theme palettes.
- `src/audio.js` — original synthesized WAV soundtrack, generated at runtime.
- `bin/terminal-shooter.js` — raw TTY input, ANSI output, optional system audio.
- `web/` — browser input, rendering, Web Audio, and presentation.
- `tests/` — Node's built-in test runner; no testing framework required.
- `scripts/smoke-terminal.py` — real PTY lifecycle/resize checks.
- `scripts/capture-terminal.py` — runs the CLI in a real PTY and captures its
  output in xterm.js using Playwright, rather than drawing fictional gameplay.

For screenshot capture only, install Python Playwright and its Chromium browser
in your preferred development environment, then:

```sh
npm install --prefix /tmp/terminal-shooter-qa @xterm/xterm@5.5.0
python3 scripts/capture-terminal.py
```

## CI and Pages

`docs/ci-example.yml` is a ready-to-use Linux/macOS, Node 20/22 test matrix.
To activate it, copy it to `.github/workflows/test.yml` with a GitHub credential
that has workflow-write permission. It is not active by default: the publishing
credential used for this repository cannot create workflows.

GitHub Pages can serve the repository directly: **Settings → Pages → Deploy
from a branch → main → / (root) → Save**. No build step is needed. Relative
module and stylesheet URLs support the `/terminal-shooter/` project path.

## Portability

The CLI targets Linux and macOS ANSI-compatible terminals with truecolor support.
The terminal smoke test uses POSIX PTYs and runs on either OS. A headless CI test
cannot verify physical speakers, and a Linux run is not a macOS runtime test.
Music is optional; missing audio tools must never prevent gameplay.

Keep changes small. Add a failing regression test, implement the fix, and run
all tests plus the PTY smoke check before submitting a pull request.
