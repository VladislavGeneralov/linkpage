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
    perc:    { send1: 0.8, volume: 0.8 },
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

  // ============================
  // BOLT NOISE — white noise (highpass 320 / lowpass 2600), separate from
  // the sequencer's own instruments. Runs for as long as a bolt is held
  // down, only while the sequencer is playing. 0.1 dry, 0.1 to delay.
  // ============================
  let boltNoiseBuffer = null;
  let boltNoiseSource = null;

  function getBoltNoiseBuffer() {
    if (!boltNoiseBuffer) {
      const dur = 2; // seconds, looped for however long the bolt is held
      boltNoiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * dur, audioContext.sampleRate);
      const data = boltNoiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return boltNoiseBuffer;
  }

  function startBoltNoise() {
    if (boltNoiseSource) return; // already sounding

    const source = audioContext.createBufferSource();
    source.buffer = getBoltNoiseBuffer();
    source.loop = true;

    const hpf = audioContext.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 320;

    const lpf = audioContext.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 2600;

    const dryGain = audioContext.createGain();
    dryGain.gain.value = 0.09;

    const sendGain = audioContext.createGain();
    sendGain.gain.value = 0.09;

    source.connect(hpf);
    hpf.connect(lpf);
    lpf.connect(dryGain);
    lpf.connect(sendGain);
    dryGain.connect(masterBus);
    sendGain.connect(fx1Send);

    // stashed so stopBoltNoise() can disconnect the whole chain once it ends
    source._hpf = hpf;
    source._lpf = lpf;
    source._dryGain = dryGain;
    source._sendGain = sendGain;

    source.start();
    boltNoiseSource = source;
  }

  function stopBoltNoise() {
    if (!boltNoiseSource) return;
    const source = boltNoiseSource;
    try { source.stop(); } catch (e) {}
    // onended fires async after stop(); disconnect the whole chain then so
    // it doesn't linger in the graph waiting on GC
    source.onended = () => {
      source.disconnect();
      if (source._hpf) source._hpf.disconnect();
      if (source._lpf) source._lpf.disconnect();
      if (source._dryGain) source._dryGain.disconnect();
      if (source._sendGain) source._sendGain.disconnect();
    };
    boltNoiseSource = null;
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

    inputGain.connect(volume);
    volume.connect(send1);
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
  const kickDur = 0.4;
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

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      dryGain.disconnect();
      shaper.disconnect();
      wetHPF.disconnect();
      wetLPF.disconnect();
      wetGain.disconnect();
    };
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

    noise.onended = () => {
      noise.disconnect();
      noiseFilter.disconnect();
      noiseGain.disconnect();
    };
    osc.onended = () => {
      osc.disconnect();
      oscGain.disconnect();
    };
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

      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    }
  }

  // ============================
  // HAT — noise buffer built once and reused (no per-hit recreation)
  // ============================
  let hatBuffer = null;
  function getHatBuffer() {
    if (!hatBuffer) {
      const size = audioContext.sampleRate * 0.08;
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
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(channelNodes.hat.inputGain);

    noise.start(now);
    safeStop(noise, now + 0.08);

    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
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

    noise.onended = () => {
      noise.disconnect();
      hpf.disconnect();
      lpf.disconnect();
      gain.disconnect();
    };
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

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
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

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
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
    startBoltNoise,
    stopBoltNoise,
    get audioContext() { return audioContext; },
    ROW_INSTRUMENTS,
  };
})();
