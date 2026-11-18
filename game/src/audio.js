// Solmar Bay — synthesised audio.
// No audio files: WebAudio oscillators and filtered noise make the engine
// hum, siren, gunshots, thuds, pickups, horn and win/lose jingles, over a
// slow two-note music loop. The context is created on the first user
// gesture, as browsers require, and N mutes everything.

// WebAudio synth only: engine hum, sirens, shots, pickups, jingles, soft music loop.
export function createAudio() {
  let ctx = null, master = null, muted = false, engineOsc = null, engineGain = null, musicTimer = 0, sirenOsc = null, sirenGain = null;
  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
    return !!ctx;
  }
  function tone(freq, dur, type = 'square', vol = 0.16, slide = 0) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }
  function noise(dur, vol = 0.2) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    s.connect(g);
    g.connect(master);
    s.start();
  }
  return {
    unlock() {
      ensure();
    }
    ,     get muted() {
      return muted;
    }
    ,     toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    }
    ,     shot(kind) {
      if (kind === 'smg') {
        noise(0.07, 0.16);
        tone(190, 0.06, 'square', 0.1, -90);
      } else {
        noise(0.12, 0.24);
        tone(140, 0.1, 'square', 0.14, -70);
      }
    }
    ,     melee() {
      noise(0.06, 0.14);
    }
    ,     thud() {
      tone(70, 0.14, 'sine', 0.3, -30);
      noise(0.08, 0.1);
    }
    ,     horn() {
      tone(392, 0.16, 'square', 0.1);
      tone(330, 0.16, 'square', 0.08);
    }
    ,     door() {
      tone(180, 0.07, 'sine', 0.12, -60);
    }
    ,     pickup() {
      tone(880, 0.08, 'sine', 0.14);
      setTimeout(() => tone(1320, 0.1, 'sine', 0.12), 50);
    }
    ,     cash() {
      tone(1040, 0.07, 'triangle', 0.14);
    }
    ,     hurt() {
      tone(220, 0.12, 'sawtooth', 0.12, -80);
    }
    ,     jingle(win) {
      const notes = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
      notes.forEach((n, i) => setTimeout(() => tone(n, 0.22, 'triangle', 0.16), i * 110));
    }
    ,     siren(on, t) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.value = muted ? 0 : (on ? 0.028 : 0);
      if (on && sirenOsc) sirenOsc.frequency.value = 650 + Math.sin(t * 5) * 180;
    }
    ,     update(dt, speed, policeNear, t) {
      if (!ctx) return;
      if (engineGain) {
        const target = speed > 4 ? 0.035 : 0;
        engineGain.gain.value += (target - engineGain.gain.value) * 0.2;
        if (engineOsc) engineOsc.frequency.value = 50 + Math.abs(speed) * 0.35;
      }
      this.siren(policeNear, t);
      musicTimer -= dt;
      if (musicTimer <= 0 && !muted) {
        musicTimer = 2.4;
        const bass = [110, 110, 131, 98][Math.floor(t / 2.4) % 4];
        tone(bass, 1.6, 'sine', 0.05);
        tone(bass * 2, 0.8, 'triangle', 0.022);
      }
    }
    ,
  }
  ;
}
