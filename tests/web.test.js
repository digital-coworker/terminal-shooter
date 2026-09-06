import test from 'node:test';
import assert from 'node:assert/strict';

const load = () => import('../web/controller.js');
test('high score persists only records and tolerates blocked or corrupt storage', async () => {
  const {HighScore} = await load();
  const values = new Map();
  const storage = {getItem:k=>values.get(k), setItem:(k,v)=>values.set(k,v)};
  const best = new HighScore(storage);
  assert.equal(best.value, 0);
  best.record(120); best.record(10);
  assert.equal(new HighScore(storage).value, 120);
  const blocked = new HighScore({getItem(){throw Error();},setItem(){throw Error();}});
  assert.doesNotThrow(()=>blocked.record(90));
  assert.equal(blocked.value, 90);
  assert.equal(new HighScore({getItem:()=>'-90'}).value, 0);
});
test('touch drag supplies directional input and clearing releases movement', async () => {
  const {FlightControls} = await load();
  const controls = new FlightControls();
  controls.drag(20, -15);
  assert.equal(controls.input().right, true);
  assert.equal(controls.input().up, true);
  controls.toggleFire();
  assert.equal(controls.input().fire, false);
  controls.clear();
  assert.equal(controls.input().right, false);
  assert.equal(controls.input().up, false);
});
test('flight input defaults to autofire and maps both keyboard layouts', async () => {
  const {FlightControls} = await load();
  const controls = new FlightControls();
  assert.deepEqual(controls.input(), {left:false,right:false,up:false,down:false,fire:true});
  controls.key('ArrowLeft', true);
  controls.key('w', true);
  assert.equal(controls.input().left, true);
  assert.equal(controls.input().up, true);
  controls.key('ArrowLeft', false);
  assert.equal(controls.input().left, false);
});
