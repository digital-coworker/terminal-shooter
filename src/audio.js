/** Original 8-bar chiptune, "Orbital Relay". Pure PCM generation; no assets or dependencies. */
export function createWav() {
  const rate=22050, beat=0.4, duration=32*beat, count=Math.round(rate*duration);
  const bytes=new Uint8Array(44+count*2), view=new DataView(bytes.buffer);
  const tag=(at,s)=>[...s].forEach((ch,i)=>bytes[at+i]=ch.charCodeAt(0));
  tag(0,'RIFF');view.setUint32(4,bytes.length-8,true);tag(8,'WAVE');tag(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  tag(36,'data');view.setUint32(40,count*2,true);
  const melody=[76,79,83,79,74,78,81,78,72,76,79,83,74,78,81,86,
    76,83,79,88,74,81,78,86,72,79,76,84,74,78,83,81];
  const roots=[40,38,36,38,40,38,36,38];
  const frequency=n=>440*2**((n-69)/12);
  let noise=12345;
  for(let i=0;i<count;i++) {
    const t=i/rate, step=Math.floor(t/(beat/2))%64, phase=t%(beat/2), bp=t%beat;
    const note=melody[Math.floor(step/2)] + (step%2?12:0);
    const envelope=Math.min(1,phase/0.006)*Math.max(0,1-phase/(beat/2));
    const lead=(Math.sin(2*Math.PI*frequency(note)*t)>0?1:-1)*0.13*envelope;
    const f=frequency(roots[Math.floor(t/(4*beat))%8]);
    const bass=(2/Math.PI)*Math.asin(Math.sin(2*Math.PI*f*t))*0.19*Math.exp(-bp*5);
    const kick=Math.sin(2*Math.PI*(45*bp+7*(1-Math.exp(-bp*25))))*Math.exp(-bp*30)*0.23;
    noise=(Math.imul(noise,1664525)+1013904223)>>>0;
    const hat=(noise/2147483648-1)*Math.exp(-phase*100)*0.055;
    const fade=Math.min(1,t/0.01,(count-1-i)/rate/0.015);
    view.setInt16(44+i*2,Math.round((lead+bass+kick+hat)*fade*32767),true);
  }
  return bytes;
}
