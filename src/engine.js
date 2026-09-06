export class Game {
  constructor({ seed = 1 } = {}) { this.seed = seed >>> 0; this.width = 60; this.height = 28; this.reset(); }
  togglePause() {
    if (this.state !== 'gameover') this.state = this.state === 'playing' ? 'paused' : 'playing';
  }
  update(dt, input = {}) {
    if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    // Clamp resumed/background tabs, then substep to keep collision tests reliable.
    let remaining = Math.min(dt, 0.25);
    while(remaining > 1e-9 && this.state === 'playing') {
      const step = Math.min(remaining, 1/60); this.step(step,input); remaining -= step;
    }
  }
  step(dt,input) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.time += dt;
    this.level = 1 + Math.floor(this.time / 20);
    this.spawnInterval = Math.max(0.22, 1.1 - (this.level - 1) * 0.12);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer += this.spawnInterval;
      const kind = ['scout', 'weaver', 'tank'][Math.floor(this.random() * 3)];
      const x = 4 + this.random() * 51;
      this.enemies.push({x, baseX:x, y:0, kind, hp:kind === 'tank' ? 3 : 1,
        speed:(kind === 'tank' ? 2 : 3.5) + this.level * 0.45, age:0, shot:1.5 + this.random()*2});
    }
    for (const e of this.enemies) {
      e.age += dt; e.y += e.speed * dt; e.shot -= dt;
      if(e.shot<=0 && e.y<this.player.y-3) {
        e.shot = Math.max(0.8, 3.2-this.level*0.18) + this.random();
        const vy=8+Math.min(this.level,12)*0.5;
        const aim=Math.max(-12,Math.min(12,(this.player.x-e.x)*vy/(this.player.y-e.y-1)));
        for(const vx of (e.kind==='tank'?[-3,0,3]:[aim]))
          this.bullets.push({x:e.x,y:e.y+1,vx,vy,owner:'enemy'});
      }
      if(Math.abs(e.x-this.player.x)<2 && Math.abs(e.y-this.player.y)<1.3) {e.hp=0;this.damage();}
      if(e.kind === 'weaver') e.x = Math.max(2, Math.min(57, e.baseX + Math.sin(e.age * 2.8) * 7));
    }
    this.enemies = this.enemies.filter(e => e.y < 29);
    const dx = Number(!!input.right) - Number(!!input.left);
    const dy = Number(!!input.down) - Number(!!input.up);
    const speed = 22 / (dx && dy ? Math.SQRT2 : 1);
    this.player.x = Math.max(2, Math.min(57, this.player.x + dx * speed * dt));
    // The lower-half flight zone keeps incoming waves readable and prevents spawn-line camping.
    this.player.y = Math.max(14, Math.min(26, this.player.y + dy * speed * dt));
    this.spread = Math.max(0,this.spread-dt); this.supplyTimer -= dt;
    if(this.supplyTimer<=0) {this.supplyTimer=12;this.powerups.push({x:5+this.random()*50,y:1,kind:this.lives<3?'health':'spread'});}
    for(const p of this.powerups) {
      p.y+=2.2*dt;
      if(Math.abs(p.x-this.player.x)<2 && Math.abs(p.y-this.player.y)<1.5) {
        p.dead=true;
        if(p.kind==='health') this.lives=Math.min(5,this.lives+1); else this.spread=10;
        this.burst(p.x,p.y,'power');
      }
    }
    this.powerups=this.powerups.filter(p=>!p.dead && p.y<29);
    this.cooldown -= dt;
    if (input.fire && this.cooldown <= 0) {
      this.cooldown = 0.16;
      for(const vx of (this.spread>0?[-7,0,7]:[0]))
        this.bullets.push({x:this.player.x,y:this.player.y-1,vy:-32,vx,owner:'player'});
    }
    for (const b of this.bullets) {
      const oldY=b.y; b.y += b.vy * dt; b.x += (b.vx || 0) * dt;
      if(b.owner !== 'player') {
        if(Math.abs(b.x-this.player.x)<1.2 && this.player.y>=oldY-1 && this.player.y<=b.y+1) {b.dead=true;this.damage();}
        continue;
      }
      const e=this.enemies.find(e=>e.hp>0 && Math.abs(e.x-b.x)<1.8 && e.y>=b.y-1 && e.y<=oldY+1);
      if(e) {b.dead=true; e.hp--; if(e.hp<=0) {this.score += e.kind==='tank'?300:100; this.burst(e.x,e.y,'enemy');}}
    }
    this.enemies=this.enemies.filter(e=>e.hp>0);
    this.bullets=this.bullets.filter(b=>!b.dead && b.y>-2 && b.y<30 && b.x>=0 && b.x<60);
    for(const p of this.particles) {p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}
    this.particles=this.particles.filter(p=>p.life>0);
  }
  damage() {
    if(this.invulnerable>0 || this.state!=='playing') return;
    this.lives--;this.invulnerable=2;this.burst(this.player.x,this.player.y,'danger');
    if(this.lives<=0) this.state='gameover';
  }
  burst(x,y,role) {
    for(let i=0;i<12;i++) {const a=this.random()*Math.PI*2, speed=2+this.random()*7;
      this.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:0.3+this.random()*0.5,role});}
  }
  random() { this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0; return this.rng / 4294967296; }
  reset() {
    this.cooldown = 0; this.invulnerable = 0; this.spread=0; this.supplyTimer=8;
    this.spawnTimer = 0.6; this.spawnInterval = 1.1;
    this.rng = this.seed; this.state = 'playing'; this.time = 0; this.level = 1; this.score = 0; this.lives = 3;
    this.player = { x: 30, y: 24 }; this.enemies = []; this.bullets = []; this.particles = []; this.powerups = [];
  }
}
