#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWav} from '../src/audio.js';
import {emitKeypressEvents} from 'node:readline';
import {Game} from '../src/engine.js';
import {render,palettes} from '../src/render.js';

export class Music {
  constructor({platform=process.platform,spawnProcess=spawn}={}) {
    this.platform=platform;this.spawnProcess=spawnProcess;this.status='off';this.child=null;this.directory=null;
  }
  toggle() {
    if(this.status==='on'){this.stop();return;}
    this.status='on';
    try {
      if(!['linux','darwin'].includes(this.platform))throw new Error('Unsupported audio platform');
      this.directory=mkdtempSync(join(tmpdir(),'terminal-shooter-'));
      this.file=join(this.directory,'orbital-relay.wav');writeFileSync(this.file,createWav());
      this.play();
    } catch {this.stop();this.status='unavailable';}
  }
  play() {
    try {
      const command=this.platform==='darwin'?'afplay':'ffplay';
      const args=this.platform==='darwin'?[this.file]:['-nodisp','-autoexit','-loglevel','quiet','-loop','0',this.file];
      this.child=this.spawnProcess(command,args,{stdio:'ignore'});
      const child=this.child;
      child.once('error',()=>{if(this.child===child){this.stop();this.status='unavailable';}});
      child.once('exit',code=>{
        if(this.child!==child || this.status!=='on')return;
        this.child=null;
        if(code===0 && this.platform==='darwin')this.play();
        else {this.stop();this.status='unavailable';}
      });
    } catch {this.stop();this.status='unavailable';}
  }
  stop() {
    this.status='off';
    if(this.child){this.child.kill();this.child=null;}
    if(this.directory){rmSync(this.directory,{recursive:true,force:true});this.directory=null;}
  }
}

const esc='\x1b[';
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(';');
export function startTerminal({stdin=process.stdin,stdout=process.stdout,theme='dark'}={}) {
  const game=new Game({seed:Date.now()}), held={}, music=new Music();
  const originalRaw=!!stdin.isRaw;
  let autoFire=true, stopped=false, last=performance.now(), timer;
  const tooSmall=()=>!(stdout.columns>=64 && stdout.rows>=34);
  function resize(){last=performance.now();stdout.write(esc+'2J');draw();}
  function draw() {
    if(tooSmall()){stdout.write(esc+'H'+esc+'0m'+`Resize terminal to at least 64x34 (now ${stdout.columns}x${stdout.rows}).`.slice(0,Math.max(1,stdout.columns-1)));return;}
    const palette=palettes[theme];let frame=esc+'H'+esc+'48;2;'+rgb(palette.bg)+'m';
    const top=Math.max(0,Math.floor((stdout.rows-34)/2)), left=Math.max(0,Math.floor((stdout.columns-64)/2));
    for(const [i,row] of render(game).entries()) {
      frame+=`${esc}${top+i+1};${left+1}H`;let previous='';
      for(const c of row) {if(c.role!==previous){frame+=esc+'38;2;'+rgb(palette[c.role])+'m';previous=c.role;}frame+=c.ch;}
    }
    const lines=['WASD / arrows move   SPACE auto-fire   P pause   R restart',`M music: ${music.status}   T theme: ${theme}   Q quit   FIRE ${autoFire?'ON':'OFF'}`];
    lines.forEach((line,i)=>{frame+=`${esc}${top+32+i};${left+1}H${esc}38;2;${rgb(palette.muted)}m${line.padEnd(64)}`;});
    stdout.write(frame+esc+'0m');
  }
  function tick(dt) {
    if(stopped)return;
    const now=performance.now(),input={fire:autoFire};
    for(const key of ['left','right','up','down'])input[key]=(held[key]||0)>now;
    if(!tooSmall())game.update(dt,input);draw();
  }
  function keypress(_,key={}) {
    if((key.ctrl&&key.name==='c')||key.name==='q')return stop();
    const movement={a:'left',d:'right',w:'up',s:'down',left:'left',right:'right',up:'up',down:'down'}[key.name];
    if(movement)held[movement]=performance.now()+140;
    else if(key.name==='space')autoFire=!autoFire;
    else if(key.name==='p'||key.name==='escape')game.togglePause();
    else if(key.name==='r'){game.reset();for(const k of Object.keys(held))delete held[k];}
    else if(key.name==='m')music.toggle();
    else if(key.name==='t'){theme=theme==='dark'?'light':'dark';stdout.write(esc+'2J');}
    draw();
  }
  function stop() {
    if(stopped)return;stopped=true;clearInterval(timer);music.stop();
    for(const signal of ['SIGINT','SIGTERM','SIGHUP','exit','uncaughtExceptionMonitor'])process.off(signal,stop);
    stdin.off('end',stop);
    stdout.off('resize',resize);
    stdin.off('keypress',keypress);stdin.setRawMode(originalRaw);stdin.pause();
    stdout.write(esc+'0m'+esc+'?25h'+esc+'?7h'+esc+'?1049l');
  }
  for(const signal of ['SIGINT','SIGTERM','SIGHUP','exit','uncaughtExceptionMonitor'])process.on(signal,stop);
  stdin.on('end',stop);
  stdout.on('resize',resize);
  emitKeypressEvents(stdin);stdin.on('keypress',keypress);stdin.setRawMode(true);stdin.resume();
  stdout.write(esc+'?1049h'+esc+'?25l'+esc+'?7l'+esc+'2J');draw();
  timer=setInterval(()=>{const now=performance.now();tick((now-last)/1000);last=now;},1000/30);
  return {game,tick,stop,music,get autoFire(){return autoFire;},get theme(){return theme;}};
}


export const HELP = `terminal-shooter - an endless ASCII orbital defense

Usage: terminal-shooter [--theme dark|light] [--help]
Requires Node >=20 and an interactive ANSI terminal, at least 64x34.

WASD / arrows  Move (hold or tap; terminal key-repeat applies)
space          Toggle auto-fire (on by default)
p / escape     Toggle pause
r              restart
m              Toggle original 8-bit music (off by default)
t              Toggle dark/light theme
q / Ctrl+C     quit

Music uses ffplay on Linux or afplay on macOS, if available.
`;
export function main(args=process.argv.slice(2)) {
  if(args.includes('--help') || args.includes('-h')) {process.stdout.write(HELP);return;}
  let theme='dark';
  try {
    for(let i=0;i<args.length;i++) {
      if(args[i]==='--theme') theme=args[++i];
      else if(args[i].startsWith('--theme=')) theme=args[i].slice(8);
      else throw new Error(`Unknown option: ${args[i]}`);
    }
    if(!['dark','light'].includes(theme)) throw new Error('--theme must be dark or light');
    if(!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Play requires an interactive terminal (TTY); use --help for controls.');
  } catch(error) {process.stderr.write(`${error.message}\n`);process.exitCode=1;return;}
  return startTerminal({theme});
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main();
