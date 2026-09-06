import test from 'node:test';
import assert from 'node:assert/strict';
test('music is lazy, decodes shared WAV once and toggles a looping source', async () => {
  const {Music} = await import('../web/music.js');
  let creates=0, decodes=0, starts=0, stops=0;
  const context = {state:'suspended',destination:{},resume:async()=>{}, decodeAudioData:async bytes=>{decodes++; assert.equal(bytes.byteLength,4); return {};}, createGain:()=>({gain:{value:0},connect(){}}), createBufferSource:()=>({connect(){},start(){starts++;},stop(){stops++;}})};
  const music = new Music(()=>{creates++;return context;},async()=>new Uint8Array([82,73,70,70]));
  assert.equal(creates,0);
  assert.equal(await music.toggle(),true);
  assert.equal(creates,1); assert.equal(decodes,1); assert.equal(starts,1);
  assert.equal(music.source.loop,true);
  assert.equal(await music.toggle(),false); assert.equal(stops,1);
  assert.equal(await music.toggle(),true); assert.equal(decodes,1); assert.equal(starts,2);
});
