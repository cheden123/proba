// Синтезированный звук: никаких внешних ассетов, только WebAudio.
const midiToFreq = (n) => 440 * Math.pow(2, (n - 69) / 12);

const SONGS = {
  level: {
    bpm: 140,
    bass: [45, 0, 45, 0, 52, 0, 45, 0, 43, 0, 43, 0, 50, 0, 43, 0],
    lead: [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 81, 79, 76, 74],
  },
  canyon: {
    bpm: 146,
    bass: [41, 0, 41, 0, 48, 0, 41, 0, 43, 0, 43, 0, 50, 0, 43, 0],
    lead: [77, 72, 77, 79, 81, 77, 72, 69, 70, 74, 77, 74, 72, 69, 65, 69],
  },
  boss: {
    bpm: 172,
    bass: [40, 40, 52, 40, 39, 39, 51, 39, 38, 38, 50, 38, 41, 41, 53, 41],
    lead: [64, 67, 71, 67, 63, 67, 70, 67, 62, 66, 69, 74, 65, 69, 72, 77],
  },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.muted = false;
    this.timer = null;
    this.step = 0;
    this.nextNoteTime = 0;
    this.song = null;
    this.songName = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    }
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.55;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.26;
    this.musicBus.connect(this.master);
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // ------- примитивы -------

  tone({ freq = 440, dur = 0.12, type = "square", vol = 0.2, slideTo = 0, delay = 0, bus = null }) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.1, vol = 0.15, freq = 1200, delay = 0, type = "lowpass" }) {
    if (!this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start(t0);
  }

  // ------- эффекты -------

  jump() {
    this.tone({ freq: 300, dur: 0.13, type: "square", vol: 0.16, slideTo: 660 });
    this.noise({ dur: 0.05, vol: 0.05, freq: 900 });
  }

  shoot() {
    this.tone({ freq: 900, dur: 0.07, type: "triangle", vol: 0.16, slideTo: 380 });
    this.noise({ dur: 0.06, vol: 0.07, freq: 2600, type: "highpass" });
  }

  coin() {
    this.tone({ freq: midiToFreq(88), dur: 0.06, type: "square", vol: 0.12 });
    this.tone({ freq: midiToFreq(95), dur: 0.12, type: "square", vol: 0.12, delay: 0.055 });
  }

  stomp() {
    this.tone({ freq: 220, dur: 0.11, type: "sawtooth", vol: 0.18, slideTo: 90 });
    this.noise({ dur: 0.09, vol: 0.12, freq: 700 });
  }

  hurt() {
    this.tone({ freq: 320, dur: 0.28, type: "sawtooth", vol: 0.2, slideTo: 70 });
    this.noise({ dur: 0.2, vol: 0.1, freq: 500 });
  }

  pop() {
    this.noise({ dur: 0.12, vol: 0.16, freq: 1600, type: "bandpass" });
    this.tone({ freq: 180, dur: 0.1, type: "square", vol: 0.1, slideTo: 60 });
  }

  heal() {
    [72, 76, 79, 84].forEach((n, i) =>
      this.tone({ freq: midiToFreq(n), dur: 0.16, type: "triangle", vol: 0.15, delay: i * 0.06 })
    );
  }

  checkpoint() {
    [67, 71, 74].forEach((n, i) =>
      this.tone({ freq: midiToFreq(n), dur: 0.18, type: "square", vol: 0.12, delay: i * 0.07 })
    );
  }

  levelClear() {
    [72, 76, 79, 84, 88, 91].forEach((n, i) =>
      this.tone({ freq: midiToFreq(n), dur: 0.24, type: "square", vol: 0.14, delay: i * 0.1 })
    );
  }

  bossHit() {
    this.tone({ freq: 150, dur: 0.2, type: "sawtooth", vol: 0.22, slideTo: 60 });
    this.noise({ dur: 0.16, vol: 0.14, freq: 900 });
  }

  victory() {
    const notes = [72, 72, 72, 76, 74, 76, 79, 84];
    notes.forEach((n, i) =>
      this.tone({ freq: midiToFreq(n), dur: 0.22, type: "square", vol: 0.15, delay: i * 0.13 })
    );
  }

  gameOver() {
    [72, 68, 64, 60, 55].forEach((n, i) =>
      this.tone({ freq: midiToFreq(n), dur: 0.35, type: "sawtooth", vol: 0.14, delay: i * 0.19 })
    );
  }

  ui() {
    this.tone({ freq: 660, dur: 0.05, type: "square", vol: 0.1 });
  }

  // ------- музыка -------

  playSong(name) {
    if (!this.ensure()) return;
    if (this.songName === name && this.timer) return;
    this.stopMusic();
    this.song = SONGS[name] || SONGS.level;
    this.songName = name;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  schedule() {
    if (!this.ctx || !this.song) return;
    const stepDur = 60 / this.song.bpm / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
      const s = this.step % 16;
      const t = this.nextNoteTime - this.ctx.currentTime;
      const bass = this.song.bass[s];
      const lead = this.song.lead[s];
      if (bass) this.tone({ freq: midiToFreq(bass), dur: stepDur * 1.8, type: "triangle", vol: 0.13, delay: t, bus: this.musicBus });
      if (lead) this.tone({ freq: midiToFreq(lead), dur: stepDur * 1.15, type: "square", vol: 0.055, delay: t, bus: this.musicBus });
      if (s % 4 === 0) this.kick(t);
      if (s % 4 === 2) this.hat(t);
      this.step++;
      this.nextNoteTime += stepDur;
    }
  }

  kick(delay) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
    gain.gain.setValueAtTime(0.24, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    osc.connect(gain).connect(this.musicBus);
    osc.start(t0);
    osc.stop(t0 + 0.18);
  }

  hat(delay) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * 0.04);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    src.connect(filter).connect(gain).connect(this.musicBus);
    src.start(t0);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song = null;
    this.songName = null;
  }
}
