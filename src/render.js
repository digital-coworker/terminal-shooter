export const palettes = {
  dark: { bg:'#080e19', text:'#e1e9f5', muted:'#60748c', player:'#67e8f9', enemy:'#ffb86b', bullet:'#b6f779', danger:'#ff647c', power:'#d4a1ff', border:'#344961' },
  light: { bg:'#f3f0e7', text:'#172b42', muted:'#74818e', player:'#006b83', enemy:'#9a4a0b', bullet:'#3e6b14', danger:'#b51e42', power:'#7340a0', border:'#9aa7ae' }
};

/** A platform-independent, fixed-size ASCII framebuffer. Rendering never mutates the game. */
export function render(game) {
  const rows = Array.from({length:30},()=>Array.from({length:64},()=>({ch:' ',role:'bg'})));
  const put=(x,y,ch,role='text')=> {if(x>=0 && x<64 && y>=0 && y<30) rows[y][x]={ch,role};};
  const text=(x,y,s,role='text')=>{[...s].forEach((ch,i)=>put(x+i,y,ch,role));};
  const sprite=(x,y,s,role)=>{
    const left=Math.round(x)+2-Math.floor(s.length/2), row=Math.round(y)+1;
    if(row<1||row>28)return;
    [...s].forEach((ch,i)=>{if(left+i>=2&&left+i<=61)put(left+i,row,ch,role);});
  };
  for(let i=0;i<72;i++) {
    const x=(i*37+game.seed*7)%60;
    const y=((i*19)%28+game.time*(i%3===0?2.8:1.1))%28;
    sprite(x,y,i%11===0?'+':'.','muted');
  }
  for(const p of game.particles) sprite(p.x,p.y,p.life>0.4?'*':'.',p.role || 'danger');
  for(const p of game.powerups) sprite(p.x,p.y,p.kind==='health'?'[+]':'[S]','power');
  for(const e of game.enemies) sprite(e.x,e.y,e.kind==='tank'?'[W]':e.kind==='weaver'?'<x>':'\\v/','enemy');
  for(const b of game.bullets) sprite(b.x,b.y,b.owner==='player'?'|':'o',b.owner==='player'?'bullet':'danger');
  if(game.state!=='gameover' && !(game.invulnerable>0 && Math.floor(game.time*12)%2)) {
    sprite(game.player.x,game.player.y-1,'^','player');sprite(game.player.x,game.player.y,'/A\\','player');
    sprite(game.player.x,game.player.y+1,Math.floor(game.time*15)%2?'"':':','bullet');
  }
  for(let x=0;x<64;x++){put(x,0,'-','border');put(x,29,'-','border');}
  for(let y=0;y<30;y++){put(0,y,'|','border');put(63,y,'|','border');}
  for(const x of [0,63])for(const y of [0,29])put(x,y,'+','border');
  text(2,0,` SCORE ${String(game.score).padStart(6,'0')} `);
  text(23,0,` WAVE ${String(game.level).padStart(2,'0')} `,'enemy');
  text(39,0,` HULL ${'+'.repeat(Math.max(0,Math.min(5,game.lives))).padEnd(5,'-')} `,'player');
  text(54,0,` ${Math.floor(game.time)}s `.slice(0,8),'muted');
  text(2,29,game.spread>0?` SPREAD ${Math.ceil(game.spread)}s `:' SECTOR / ENDLESS ','power');
  text(37,29,' [+] REPAIR  [S] SPREAD ','muted');
  if(game.state!=='playing') {
    const title=game.state==='paused'?'PAUSED':'GAME OVER';
    const message=game.state==='paused'?'P / ESC TO RESUME':'R TO RESTART';
    const lines=['+------------------------------+',`|${title.padStart(15+Math.ceil(title.length/2)).padEnd(30)}|`,'|                              |',`|${message.padStart(15+Math.ceil(message.length/2)).padEnd(30)}|`,'+------------------------------+'];
    lines.forEach((line,i)=>text(16,11+i,line,i===1?'player':'text'));
  }
  return rows;
}
