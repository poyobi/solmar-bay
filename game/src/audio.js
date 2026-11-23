// Solmar Bay — sound with no audio files: every note is synthesized with WebAudio when it
// is needed. A soft pad hangs over the city, an engine note follows the player's car, a
// two-tone siren fades in with the nearest police car, and the little events of the day —
// a punch, a till, a job done — each get a voice of their own.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  /** Start the context (needs a user gesture) and the standing voices. Idempotent. */
  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // The pad: a slow major-nine chord, barely there, like heat coming off the road.
    const padGain = ctx.createGain();
    padGain.gain.value = 0.016;
    padGain.connect(master);
    for (const freq of [130.81, 196.0, 246.94, 293.66]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (freq % 7) - 3;
      osc.connect(padGain);
      osc.start();
    }

    // The engine: a detuned saw through a lowpass, silent until the player drives.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();

    // The siren: one oscillator whose pitch the update flips between two tones.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 760;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
  }

  /** A one-shot tone with a quick envelope. */
  function tone(freq, dur, type = 'square', vol = 0.12, when = 0, slideTo = null) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  return {
    ensure,
    get muted() { return muted; },
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.03);
    },
    /** Per-frame: engine note from the player's speed, siren from the nearest police car. */
    update(G) {
      if (!ctx) return;
      const t = ctx.currentTime;
      if (G.player.inCar && G.screen === 'play') {
        const ratio = Math.min(1, Math.abs(G.player.car.speed) / 560);
        engineOsc.frequency.setTargetAtTime(52 + ratio * 165, t, 0.06);
        engineGain.gain.setTargetAtTime(0.028 + ratio * 0.05, t, 0.09);
      } else {
        engineGain.gain.setTargetAtTime(0, t, 0.08);
      }
      let nearest = Infinity;
      for (const car of G.cars) {
        if (car.kind !== 'police') continue;
        const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
        if (d < nearest) nearest = d;
      }
      if (nearest < 560 && G.screen === 'play') {
        sirenOsc.frequency.setTargetAtTime(Math.sin(t * 5.2) > 0 ? 715 : 955, t, 0.02);
        sirenGain.gain.setTargetAtTime(0.035 * (1 - nearest / 560), t, 0.1);
      } else {
        sirenGain.gain.setTargetAtTime(0, t, 0.1);
      }
    },
    blip(freq = 440) { tone(freq, 0.07, 'square', 0.07); },
    cash() { tone(880, 0.09, 'sine', 0.14); tone(1318, 0.14, 'sine', 0.12, 0.07); },
    success() {
      tone(523, 0.11, 'triangle', 0.13);
      tone(659, 0.11, 'triangle', 0.13, 0.09);
      tone(784, 0.11, 'triangle', 0.13, 0.18);
      tone(1046, 0.22, 'triangle', 0.13, 0.27);
    },
    fail() { tone(233, 0.16, 'sawtooth', 0.08, 0, 155); },
    punch() {
      if (!ctx) return;
      const dur = 0.09;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 480;
      const gain = ctx.createGain();
      gain.gain.value = 0.22;
      src.connect(filter).connect(gain).connect(master);
      src.start();
    },
    door() { tone(196, 0.08, 'square', 0.09, 0, 130); },
  };
}
