import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,spawn} from 'node:child_process';
import {createWav} from '../src/audio.js';
import {startTerminal, Music} from '../bin/terminal-shooter.js';
import {existsSync} from 'node:fs';
import {PassThrough} from 'node:stream';

function terminalHarness() {
 const stdin=new PassThrough(),stdout=new PassThrough();let output='';stdout.on('data',b=>output+=b);
 stdin.isTTY=true;stdin.isRaw=false;stdin.setRawMode=v=>{stdin.isRaw=v;};stdout.isTTY=true;stdout.columns=80;stdout.rows=40;
 const app=startTerminal({stdin,stdout,theme:'light'});
 return {app,stdin,stdout,output:()=>output,key:name=>stdin.emit('keypress','',{name})};
}
test('terminal enters raw alternate screen, renders, routes controls and cleans up',()=>{
 const h=terminalHarness();try {
 assert.equal(h.stdin.isRaw,true);assert.ok(h.output().includes('\x1b[?1049h'));assert.ok(h.output().includes('SCORE'));
 assert.equal(h.app.autoFire,true);h.key('space');assert.equal(h.app.autoFire,false);
 h.key('p');assert.equal(h.app.game.state,'paused');h.key('p');assert.equal(h.app.game.state,'playing');
 h.key('t');assert.equal(h.app.theme,'dark');h.app.game.score=30;h.key('r');assert.equal(h.app.game.score,0);
 h.key('a');h.app.tick(0.03);assert.ok(h.app.game.player.x<30);
 h.key('q');assert.equal(h.stdin.isRaw,false);assert.ok(h.output().includes('\x1b[?1049l'));assert.equal(h.stdin.listenerCount('keypress'),0);
 } finally {h.app.stop();}
});

const cli = new URL('../bin/terminal-shooter.js',import.meta.url);
test('CLI help works without a TTY and documents every control',()=>{
 const result=spawnSync(process.execPath,[cli.pathname,'--help'],{encoding:'utf8'});
 assert.equal(result.status,0);for(const word of ['WASD','space','pause','restart','music','theme','quit','64x34'])assert.ok(result.stdout.includes(word),word);
});

test('resize suspends simulation below 64x34 and resumes without resetting',()=>{
 const h=terminalHarness();try {
 h.stdout.columns=63;h.stdout.rows=33;h.stdout.emit('resize');const t=h.app.game.time;h.app.tick(0.1);
 assert.equal(h.app.game.time,t);assert.match(h.output(),/64x34/);
 h.stdout.columns=64;h.stdout.rows=34;h.stdout.emit('resize');h.app.tick(0.1);assert.ok(h.app.game.time>t);
 h.key('p');h.stdout.emit('resize');assert.equal(h.app.game.state,'paused');
 }finally{h.app.stop();}
});

test('SIGINT and SIGTERM restore terminal and unregister handlers',()=>{
 for(const signal of ['SIGINT','SIGTERM']) {
  const before=process.listenerCount(signal),h=terminalHarness();
  try {assert.equal(process.listenerCount(signal),before+1);process.emit(signal);assert.equal(h.stdin.isRaw,false);assert.equal(process.listenerCount(signal),before);}
  finally {h.app.stop();}
 }
});

test('CLI rejects bad themes, unknown flags and non-interactive play',()=>{
 for(const args of [['--theme','sepia'],['--wat'],[]]) {
  const r=spawnSync(process.execPath,[cli.pathname,...args],{encoding:'utf8'});assert.equal(r.status,1);
  assert.match(r.stderr,args.length?/theme|Unknown/:/interactive/);assert.ok(!r.stdout.includes('\x1b'));
 }
});

test('missing music player reports unavailable without crashing',async()=>{
 const music=new Music({platform:'linux',spawnProcess:(cmd,args)=>spawn(cmd,args,{env:{PATH:''},stdio:'ignore'})});
 music.toggle();await new Promise(resolve=>setTimeout(resolve,40));
 assert.equal(music.status,'unavailable');music.stop();
});

test('macOS player loops after natural exit and stop deletes temporary audio',async()=>{
 let calls=0;const music=new Music({platform:'darwin',spawnProcess:()=>{calls++;return spawn(process.execPath,['-e',calls===1?'':'setTimeout(()=>{},5000)'],{stdio:'ignore'});}});
 music.toggle();const dir=music.directory;
 try {for(let i=0;i<300&&calls<2;i++)await new Promise(r=>setTimeout(r,20));assert.equal(calls,2);assert.equal(music.status,'on');assert.ok(existsSync(music.file));}
 finally {music.stop();}
 assert.equal(existsSync(dir),false);
});

test('original loop is deterministic valid non-silent mono PCM WAV',()=>{
 const wav=createWav();assert.ok(wav instanceof Uint8Array);assert.deepEqual(wav,createWav());
 const v=new DataView(wav.buffer,wav.byteOffset,wav.byteLength), ascii=(a,b)=>String.fromCharCode(...wav.slice(a,b));
 assert.equal(ascii(0,4),'RIFF');assert.equal(ascii(8,12),'WAVE');assert.equal(v.getUint32(4,true),wav.length-8);
 assert.equal(v.getUint16(22,true),1);assert.equal(v.getUint32(24,true),22050);assert.equal(v.getUint16(34,true),16);
 assert.equal(v.getUint32(40,true),wav.length-44);assert.ok(wav.length>22050*8);assert.ok(wav.slice(44).some(x=>x!==0));
 assert.equal(v.getInt16(44,true),0);assert.equal(v.getInt16(wav.length-2,true),0);
});
