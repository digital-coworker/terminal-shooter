// Context creation and playback happen only inside an explicit user action.
export class Music {
  constructor(makeContext, loadWav) {
    this.makeContext = makeContext;
    this.loadWav = loadWav;
    this.context = null; this.buffer = null; this.source = null;
    this.enabled = false; this.busy = false;
  }
  async toggle() {
    if (this.busy) return this.enabled;
    if (this.enabled) {
      this.source.stop(); this.source = null; this.enabled = false;
      return false;
    }
    this.busy = true;
    try {
      this.context ??= this.makeContext();
      await this.context.resume();
      if (!this.buffer) {
        const bytes = await this.loadWav();
        this.buffer = await this.context.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      }
      const gain = this.context.createGain();
      gain.gain.value = .22;
      gain.connect(this.context.destination);
      this.source = this.context.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.loop = true;
      this.source.connect(gain);
      this.source.start();
      this.enabled = true;
      return true;
    } finally { this.busy = false; }
  }
}
