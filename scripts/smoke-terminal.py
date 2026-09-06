"""Exercise actual terminal lifecycle on Linux/macOS: python3 scripts/smoke-terminal.py."""
import fcntl
import os
from pathlib import Path
import pty
import select
import signal
import struct
import subprocess
import termios
import time

ROOT = Path(__file__).resolve().parents[1]


def drain(fd, duration):
    output = bytearray()
    until = time.monotonic() + duration
    while time.monotonic() < until:
        if select.select([fd], [], [], .02)[0]:
            output.extend(os.read(fd, 65536))
    return bytes(output)


def run(exit_method):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 36, 80, 0, 0))
    attributes = termios.tcgetattr(slave)
    process = subprocess.Popen(['node', 'bin/terminal-shooter.js'], cwd=ROOT,
                               stdin=slave, stdout=slave, stderr=slave,
                               env={**os.environ, 'TERM': 'xterm-256color'})
    output = bytearray()
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline and b'\x1b[' not in output:
        output.extend(drain(master, .05))
    assert b'\x1b[' in output, 'No ANSI rendering'
    assert termios.tcgetattr(slave) != attributes, 'Raw mode not enabled'
    os.write(master, b'adwsp')
    drain(master, .15)
    os.write(master, b'ptr ')
    drain(master, .15)
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 12, 30, 0, 0))
    process.send_signal(signal.SIGWINCH)
    small = drain(master, .2)
    assert small, 'Resize did not render'
    assert process.poll() is None, 'Resize crashed the game'
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 36, 80, 0, 0))
    process.send_signal(signal.SIGWINCH)
    drain(master, .2)
    if exit_method == 'q':
        os.write(master, b'q')
    elif exit_method == 'ctrl-c':
        os.write(master, b'\x03')
    else:
        process.send_signal(signal.SIGTERM)
    final = drain(master, .2)
    process.wait(timeout=4)
    final += drain(master, .1)
    assert termios.tcgetattr(slave) == attributes, f'{exit_method}: tty not restored'
    assert b'\x1b[?25h' in final, f'{exit_method}: cursor not restored'
    assert b'\x1b[?1049l' in final, f'{exit_method}: alternate screen not exited'
    os.close(master)
    os.close(slave)
    print(f'PASS {exit_method}: raw input, resize, controls, cursor + TTY restoration (exit {process.returncode})')


if __name__ == '__main__':
    for method in ['q', 'ctrl-c', 'sigterm']:
        run(method)
