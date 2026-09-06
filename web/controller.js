export class HighScore {
  constructor(storage) {
    this.storage = storage; this.value = 0;
    try {
      const value = Number(storage?.getItem('terminal-shooter.best'));
      if (Number.isFinite(value) && value > 0) this.value = Math.floor(value);
    } catch { /* Private browsing may deny storage. */ }
  }
  record(score) {
    if (!Number.isFinite(score) || score <= this.value) return;
    this.value = Math.floor(score);
    try { this.storage?.setItem('terminal-shooter.best', String(this.value)); } catch { /* Keep session best. */ }
  }
}

export class FlightControls {
  constructor() { this.keys = new Set(); this.autofire = true; }
  key(key, pressed) {
    key = key.toLowerCase();
    if (pressed) this.keys.add(key); else this.keys.delete(key);
  }
  toggleFire() { this.autofire = !this.autofire; }
  clear() { this.keys.clear(); }
  drag(dx, dy) {
    this.key('arrowleft', dx < -5); this.key('arrowright', dx > 5);
    this.key('arrowup', dy < -5); this.key('arrowdown', dy > 5);
  }
  input() {
    const has = (...keys) => keys.some(key => this.keys.has(key));
    return {left:has('a','arrowleft'),right:has('d','arrowright'),up:has('w','arrowup'),down:has('s','arrowdown'),fire:this.autofire};
  }
}
