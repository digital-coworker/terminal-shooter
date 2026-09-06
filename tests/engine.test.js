import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import {render, palettes} from '../src/render.js';

test('render is a pure 64 by 30 ASCII role grid with scoreboard and stars', () => {
 const g=new Game();const before=JSON.stringify(g);const grid=render(g);
 assert.equal(grid.length,30);for(const row of grid){assert.equal(row.length,64);for(const c of row){assert.match(c.ch,/^[\x20-\x7e]$/);assert.ok(c.role in palettes.dark);}}
 assert.equal(JSON.stringify(g),before);const text=grid.map(r=>r.map(c=>c.ch).join('')).join('\n');
 assert.match(text,/SCORE/);assert.match(text,/WAVE/);assert.match(text,/HULL/);assert.ok(grid.flat().some(c=>c.role==='player'));assert.ok(grid.flat().some(c=>c.ch==='.'));
 for(const palette of Object.values(palettes))for(const color of Object.values(palette))assert.match(color,/^#[a-fA-F0-9]{6}$/);
 g.togglePause();assert.match(render(g).flat().map(c=>c.ch).join(''),/PAUSED/);
 g.state='gameover';assert.match(render(g).flat().map(c=>c.ch).join(''),/GAME OVER/);
});

test('movement is bounded, pause freezes time and invalid deltas do nothing', () => {
  const g = new Game(); g.update(0.1, {left:true, up:true});
  assert.ok(g.player.x < 30 && g.player.y < 24);
  for (let i=0;i<100;i++) g.update(0.1,{left:true,up:true});
  assert.ok(g.player.x >= 2 && g.player.y >= 14);
  g.togglePause(); const snapshot = JSON.stringify(g); g.update(1,{right:true});
  assert.equal(JSON.stringify(g),snapshot); g.togglePause();
  const time = g.time; g.update(NaN); g.update(-1); assert.equal(g.time,time);
});

test('survival spawns seeded enemy variety with progressively faster waves', () => {
  const a=new Game({seed:9}), b=new Game({seed:9}); const kinds=new Set();
  let early=0, late=0;
  for(let i=0;i<1000;i++) {
    for(const g of [a,b]) {g.lives=99;g.update(0.1);}
    a.enemies.forEach(e=>kinds.add(e.kind));
    if(i===100) early=a.spawnInterval;
    if(i===999) late=a.spawnInterval;
  }
  assert.deepEqual(a,b); assert.ok(kinds.size>=3); assert.ok(a.level>=5); assert.ok(late<early);
  a.reset(); b.reset(); assert.deepEqual(a,b);
});

test('shots destroy enemies, score hits and leave fading particles', () => {
 const g=new Game(); g.enemies.push({x:30,y:20,kind:'scout',hp:1,speed:0,age:0,shot:10});
 for(let i=0;i<10;i++)g.update(0.02,{fire:true});
 assert.equal(g.enemies.length,0); assert.equal(g.score,100); assert.ok(g.particles.length>0);
 for(let i=0;i<60;i++)g.update(0.02);
 assert.equal(g.particles.length,0);
});

test('damage grants invulnerability and last hit ends the game until reset', () => {
 const g=new Game(); const hit=()=>{g.bullets.push({x:g.player.x,y:g.player.y-0.1,vy:1,owner:'enemy'});g.update(0.02);};
 hit(); assert.equal(g.lives,2); hit();assert.equal(g.lives,2);
 for(let i=0;i<2;i++){g.invulnerable=0;hit();}
 assert.equal(g.state,'gameover'); const time=g.time;g.update(0.1);g.togglePause();assert.equal(g.time,time);assert.equal(g.state,'gameover');
 g.reset();assert.equal(g.invulnerable,0);assert.equal(g.lives,3);
});

test('enemies fire and contact damages the ship', () => {
 const g=new Game();g.enemies.push({x:30,y:4,kind:'tank',hp:3,speed:0,age:0,shot:0});g.update(0.02);
 assert.ok(g.bullets.some(b=>b.owner==='enemy'));
 g.enemies.push({x:30,y:24,kind:'scout',hp:1,speed:0,age:0,shot:10});g.update(0.02);assert.equal(g.lives,2);
});

test('supply drops heal or grant temporary spread fire', () => {
 const g=new Game();g.lives=1;g.powerups.push({x:30,y:24,kind:'health'});g.update(0.02);assert.equal(g.lives,2);assert.equal(g.powerups.length,0);
 g.powerups.push({x:30,y:24,kind:'spread'});g.update(0.02,{fire:true});assert.equal(g.bullets.filter(b=>b.owner==='player').length,3);
 assert.ok(g.spread>0);g.supplyTimer=0;g.update(0.02);assert.equal(g.powerups.length,1);
});

test('a quarter-second stall uses substeps so fast enemies cannot tunnel', () => {
 const g=new Game();g.enemies.push({x:30,y:20,kind:'scout',hp:1,speed:32,age:0,shot:10});g.update(0.25);
 assert.equal(g.lives,2);assert.ok(Math.abs(g.time-0.25)<1e-9);
 const t=g.time;g.update(100);assert.ok(g.time-t<=0.251);
});

test('lower-half flight and aimed fire prevent safe top-corner camping',()=>{
 const g=new Game();for(let i=0;i<100;i++)g.update(0.02,{up:true,left:true});
 assert.equal(g.player.y,14);assert.equal(g.player.x,2);
 g.enemies=[{x:12,y:3,kind:'scout',hp:1,speed:0,age:0,shot:0}];g.bullets=[];g.update(0.02);
 assert.ok(g.bullets[0].vx<0);const hull=g.lives;
 for(let i=0;i<100;i++)g.update(0.02);assert.ok(g.lives<hull);
});

test('game starts with the shared contract and reset restores it', () => {
  const g = new Game({seed: 7});
  assert.equal(g.width, 60); assert.equal(g.height, 28);
  assert.equal(g.state, 'playing'); assert.equal(g.score, 0); assert.equal(g.lives, 3);
  for (const name of ['enemies','bullets','particles','powerups']) assert.ok(Array.isArray(g[name]));
  g.score = 99; g.reset(); assert.equal(g.score, 0); assert.equal(g.time, 0);
});
