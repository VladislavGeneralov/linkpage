/*
  Synthesis engine for the sequencer — 7 voices ported from synthesis_runtime
  (kick, snare, clap, hat, cymbal, perc, blaster). Each row of the step
  grid triggers one of these through Instruments.trigger(row, time).
*/
const Instruments = (() => {
  let audioContext = null;
  let masterBus, fx1Send, delayNode, delayFeedback, delayHPF;
  let masterDrive, masterComp, masterFilter, masterMute;
  const channelNodes = {};

  const ROW_INSTRUMENTS = ["kick", "snare", "clap", "hat", "cymbal", "perc", "blaster"];

  /* per-channel routing: send1 = how much goes to the delay bus, in parallel with dry */
  // all channel volumes scaled to 60% of what they were
  const channels = {
    kick:    { send1: 0,   volume: 0.72 },
    snare:   { send1: 0,   volume: 0.45 },
    clap:    { send1: 0,   volume: 0.6 },
    hat:     { send1: 0,   volume: 1.02 },
    cymbal:  { send1: 0,   volume: 0.3 },  // no longer sent to the delay
    perc:    { send1: 0.8, volume: 0.6 },
    blaster: { send1: 0.8, volume: 1.2 },  // mostly routed into the delay
  };

  let bpm = 132;
  const delMult = 3; // 3/4-note-feel delay (matches synthesis_runtime's delay)
  const delHP = 600;
  const delFB = 0.6;

  function getDelayTime() {
    return (60 / bpm) * delMult / 4;
  }

  function setTempo(newBpm) {
    bpm = newBpm;
    if (delayNode) delayNode.delayTime.value = getDelayTime();
  }

  // ============================
  // MASTER DRIVE — saturation on the summed mix, with log-domain makeup-gain
  // compensation so pushing the drive doesn't just make everything louder.
  // ============================
  const MASTER_DRIVE_MAX = 22 * 0.6; // rescaled so the old 60%-fader amount is now the max (at 100%)
  const MASTER_MAKEUP_DB = 8;  // dB pulled back at full drive

  function masterDriveCurve(amount) {
    const n = 4096;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      // normalized so peak stays at +-1 regardless of amount (amount ~ 0 -> identity)
      curve[i] = amount > 0.01 ? Math.tanh(x * amount) / Math.tanh(amount) : x;
    }
    return curve;
  }

  function setMasterDrive(value) {
    // value: 0-100 from the UI fader
    if (!masterDrive || !masterComp) return;

    const t = Math.min(1, Math.max(0, value / 100));
    const amount = t * MASTER_DRIVE_MAX;
    masterDrive.curve = masterDriveCurve(amount);

    // tanh saturation raises perceived (RMS) loudness even though the peak is
    // normalized — pull the output back down along a log curve as drive increases,
    // so overall loudness stays roughly constant while the tone gets grittier.
    const db = -MASTER_MAKEUP_DB * Math.log(1 + 9 * t) / Math.log(10);
    masterComp.gain.value = Math.pow(10, db / 20);
  }

  // ============================
  // MASTER FILTER — one knob, two jobs: left half sweeps a lowpass down to
  // 50Hz, right half sweeps a highpass up to 4kHz. Center (50) = no cut.
  // ============================
  const MASTER_FILTER_Q = 2.2;
  const MASTER_FILTER_LOW_CUTOFF = 50;     // Hz at the far left (heaviest lowpass cut)
  const MASTER_FILTER_HIGH_CUTOFF = 4000;  // Hz at the far right (heaviest highpass cut)
  const MASTER_FILTER_NEUTRAL_LOW = 20000; // lowpass freq at center -> effectively no cut
  const MASTER_FILTER_NEUTRAL_HIGH = 20;   // highpass freq at center -> effectively no cut

  function setMasterFilter(value) {
    // value: 0-100 from the UI fader, 50 = bypass
    if (!masterFilter) return;

    const v = Math.min(100, Math.max(0, value));
    masterFilter.Q.value = MASTER_FILTER_Q;

    if (v <= 50) {
      const t = (50 - v) / 50; // 0 at center -> 1 at full left
      masterFilter.type = "lowpass";
      // exponential sweep (frequency perception is logarithmic, not linear)
      masterFilter.frequency.value =
        MASTER_FILTER_NEUTRAL_LOW * Math.pow(MASTER_FILTER_LOW_CUTOFF / MASTER_FILTER_NEUTRAL_LOW, t);
    } else {
      const t = (v - 50) / 50; // 0 at center -> 1 at full right
      masterFilter.type = "highpass";
      masterFilter.frequency.value =
        MASTER_FILTER_NEUTRAL_HIGH * Math.pow(MASTER_FILTER_HIGH_CUTOFF / MASTER_FILTER_NEUTRAL_HIGH, t);
    }
  }

  // ============================
  // MASTER MUTE
  // ============================
  function setMasterMute(muted) {
    if (!masterMute) return;
    const now = audioContext.currentTime;
    masterMute.gain.cancelScheduledValues(now);
    masterMute.gain.setValueAtTime(masterMute.gain.value, now);
    // short ramp instead of an instant jump, so toggling doesn't click/pop
    masterMute.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.01);
  }

  // per-instrument volume fader: percent (0-100) is scaled against that
  // channel's current configured volume, i.e. 100% = channels[name].volume
  function setChannelVolume(name, percent) {
    const node = channelNodes[name];
    if (!node) return;
    const t = Math.min(1, Math.max(0, percent / 100));
    node.volume.gain.value = channels[name].volume * t;
  }

  function createChannel() {
    const inputGain = audioContext.createGain();
    const send1 = audioContext.createGain();
    const volume = audioContext.createGain();

    inputGain.connect(send1);
    inputGain.connect(volume);
    volume.connect(masterBus);
    send1.connect(fx1Send);

    return { inputGain, send1, volume };
  }

  function init() {
    if (audioContext) {
      if (audioContext.state === "suspended") audioContext.resume();
      return audioContext;
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    masterBus = audioContext.createGain();
    masterBus.gain.value = 1;

    masterFilter = audioContext.createBiquadFilter();
    setMasterFilter(50); // centered = no cut

    masterDrive = audioContext.createWaveShaper();
    masterComp = audioContext.createGain();
    setMasterDrive(0); // clean by default

    masterMute = audioContext.createGain();
    masterMute.gain.value = 1; // unmuted by default

    masterBus.connect(masterDrive);
    masterDrive.connect(masterFilter);
    masterFilter.connect(masterComp);
    masterComp.connect(masterMute);
    masterMute.connect(audioContext.destination);

    fx1Send = audioContext.createGain();

    for (const name of ROW_INSTRUMENTS) {
      const node = createChannel();
      node.send1.gain.value = channels[name].send1;
      node.volume.gain.value = channels[name].volume * 0.9; // 90% of current volume by default
      channelNodes[name] = node;
    }

    delayNode = audioContext.createDelay(5.0);
    delayFeedback = audioContext.createGain();
    delayHPF = audioContext.createBiquadFilter();

    delayNode.delayTime.value = getDelayTime();
    delayFeedback.gain.value = delFB;
    delayHPF.type = "highpass";
    delayHPF.frequency.value = delHP;

    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayHPF);
    delayHPF.connect(delayNode);
    fx1Send.connect(delayNode);
    delayNode.connect(masterBus);

    return audioContext;
  }

  function makeCurve(amount, n = 4096) {
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(x * amount);
    }
    return curve;
  }

  function safeStop(node, t) {
    try { node.stop(t); } catch (e) {}
  }

  // ============================
  // KICK — medium length, very little drive
  // ============================
  const kickDur = 0.32;
  const kickDriveMix = 0.04;
  const kickCurve = makeCurve(26); // drive amount is fixed, so the curve is built once and reused

  function playKick(time) {
    const now = time ?? audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";

    osc.frequency.setValueAtTime(98, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + kickDur);

    gain.gain.setValueAtTime(1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + kickDur * 2);

    const dryGain = audioContext.createGain();
    dryGain.gain.value = 1 - kickDriveMix;
    osc.connect(dryGain);
    dryGain.connect(gain);

    const shaper = audioContext.createWaveShaper();
    shaper.curve = kickCurve;

    const wetHPF = audioContext.createBiquadFilter();
    wetHPF.type = "highpass";
    wetHPF.frequency.value = 60;

    const wetLPF = audioContext.createBiquadFilter();
    wetLPF.type = "lowpass";
    wetLPF.frequency.value = 400;

    const wetGain = audioContext.createGain();
    wetGain.gain.value = kickDriveMix;

    osc.connect(shaper);
    shaper.connect(wetHPF);
    wetHPF.connect(wetLPF);
    wetLPF.connect(wetGain);
    wetGain.connect(gain);

    gain.connect(channelNodes.kick.inputGain);

    osc.start(now);
    osc.stop(now + kickDur + 0.1);
  }

  // ============================
  // SNARE
  // ============================
  function playSnare(time) {
    const now = time ?? audioContext.currentTime;

    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.2, audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.setValueAtTime(1400, now);

    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    const osc = audioContext.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

    const oscGain = audioContext.createGain();
    oscGain.gain.setValueAtTime(0.1, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    osc.connect(oscGain);

    noiseGain.connect(channelNodes.snare.inputGain);
    oscGain.connect(channelNodes.snare.inputGain);

    noise.start(now);
    safeStop(noise, now + 0.2);
    osc.start(now);
    safeStop(osc, now + 0.15);
  }

  // ============================
  // CLAP
  // ============================
  function playClap(time) {
    const now = time ?? audioContext.currentTime;

    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.3, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;

    const bursts = [0.0, 0.012, 0.028, 0.045];

    for (let i = 0; i < bursts.length; i++) {
      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;

      const filter = audioContext.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1600 + i * 120, now);

      const gain = audioContext.createGain();
      const t = now + bursts[i];

      gain.gain.setValueAtTime(0.9 - i * 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(channelNodes.clap.inputGain);

      noise.start(t);
      safeStop(noise, t + 0.2);
    }
  }

  // ============================
  // HAT — noise buffer built once and reused (no per-hit recreation)
  // ============================
  let hatBuffer = null;
  function getHatBuffer() {
    if (!hatBuffer) {
      const size = audioContext.sampleRate * 0.05;
      hatBuffer = audioContext.createBuffer(1, size, audioContext.sampleRate);
      const data = hatBuffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    return hatBuffer;
  }

  function playHat(time) {
    const now = time ?? audioContext.currentTime;

    const noise = audioContext.createBufferSource();
    noise.buffer = getHatBuffer();

    const filter = audioContext.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(7000, now);

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(channelNodes.hat.inputGain);

    noise.start(now);
    safeStop(noise, now + 0.05);
  }

  // ============================
  // CYMBAL — same fix: buffer built once and reused
  // ============================
  let cymbalBuffer = null;
  function getCymbalBuffer() {
    if (!cymbalBuffer) {
      const dur = 0.9;
      cymbalBuffer = audioContext.createBuffer(1, audioContext.sampleRate * dur, audioContext.sampleRate);
      const data = cymbalBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return cymbalBuffer;
  }

  function playCymbal(time) {
    const now = time ?? audioContext.currentTime;
    const dur = 0.9;

    const noise = audioContext.createBufferSource();
    noise.buffer = getCymbalBuffer();

    const hpf = audioContext.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.setValueAtTime(6000, now);

    const lpf = audioContext.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.setValueAtTime(13000, now);

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(hpf);
    hpf.connect(lpf);
    lpf.connect(gain);
    gain.connect(channelNodes.cymbal.inputGain);

    noise.start(now);
    safeStop(noise, now + dur);
  }

  // ============================
  // PERC
  // ============================
  function playMidPerc(noteFreq, time) {
    const now = time ?? audioContext.currentTime;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    const filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(700, now);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(noteFreq, now);
    osc.frequency.exponentialRampToValueAtTime(noteFreq * 0.95, now + 0.05);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(channelNodes.perc.inputGain);

    osc.start(now);
    safeStop(osc, now + 0.35);
  }

  // ============================
  // BLASTER — routed mostly into the delay send (see channels.blaster.send1)
  // ============================
  function playBlaster(noteFreq, time) {
    const now = time ?? audioContext.currentTime;

    const osc = audioContext.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(noteFreq * 2.5, now);
    osc.frequency.exponentialRampToValueAtTime(noteFreq, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(noteFreq * 0.4, now + 0.15);

    const filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1624, now);
    filter.Q.value = 7;

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(channelNodes.blaster.inputGain);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  // ============================
  // DISPATCH — row index (0-6) -> voice, fixed pitch per melodic voice since
  // the grid is on/off only (no per-step pitch data)
  // ============================
  function trigger(row, time) {
    switch (row) {
      case 0: return playKick(time);
      case 1: return playSnare(time);
      case 2: return playClap(time);
      case 3: return playHat(time);
      case 4: return playCymbal(time);
      case 5: return playMidPerc(480, time);
      case 6: return playBlaster(222, time);
    }
  }

  return {
    init,
    trigger,
    setTempo,
    setMasterDrive,
    setMasterFilter,
    setMasterMute,
    setChannelVolume,
    get audioContext() { return audioContext; },
    ROW_INSTRUMENTS,
  };
})();
