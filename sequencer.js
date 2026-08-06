const ROWS = 7;
const STEPS = 16;
let TEMPO = 130; // BPM, 16th-note steps — live-adjustable via the bpm fader

/* mobile gets the rotated layout (see the matching @media block in
   style.css); desktop keeps the original horizontal one. Checked once at
   load — matches the breakpoint used in CSS. */
const IS_MOBILE = window.matchMedia("(max-width: 600px)").matches;

const ROW_LABELS = IS_MOBILE
  ? ["KK", "SN", "CL", "HH", "CY", "PQ", "FX"]
  : ["kick", "snar", "clap", "hhat", "cymb", "perc", "fx"];

const grid = document.getElementById("seq-grid");
const playBtn = document.getElementById("seq-play");

const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l16 8-16 8V4z"/></svg>';
const STOP_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14"/></svg>';
playBtn.innerHTML = PLAY_ICON;

const muteBtn = document.getElementById("seq-mute");
const SPEAKER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8 8 0 0 1 0 12"/></svg>';
const MUTED_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16 9l6 6"/><path d="M22 9l-6 6"/></svg>';
muteBtn.innerHTML = SPEAKER_ICON;
muteBtn.classList.add("is-unmuted"); // gold by default: sound is on

let masterMuted = false;
muteBtn.addEventListener("click", () => {
  masterMuted = !masterMuted;
  muteBtn.innerHTML = masterMuted ? MUTED_ICON : SPEAKER_ICON;
  muteBtn.setAttribute("aria-label", masterMuted ? "unmute" : "mute");
  muteBtn.classList.toggle("is-unmuted", !masterMuted); // gold when playing, grey when muted
  Instruments.setMasterMute(masterMuted);
});

/* default pattern, one row per ROW_LABELS entry, active step indices (0-15) */
const DEFAULT_PATTERN = [
  [0, 1, 2, 6, 9, 10],                             // kik
  [4, 12],                                         // snr
  [4, 7, 9, 12],                                   // clp
  [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],         // hat
  [2, 9],                                          // cym
  [0],                                             // prc
  [1],                                             // fx
];

/* pattern[row][step] -> is that instrument active on that step */
const pattern = Array.from({ length: ROWS }, (_, r) => {
  const row = Array(STEPS).fill(false);
  for (const s of DEFAULT_PATTERN[r]) row[s] = true;
  return row;
});

/* muted[row] -> instrument silenced regardless of its pattern */
const muted = Array(ROWS).fill(false);

/* cells grouped by column so the playhead can light up a whole step at once */
const columns = Array.from({ length: STEPS }, () => []);

/* per-row volume sliders, read back on play() to sync freshly-created audio nodes */
const volSliders = [];

/* visual left-to-right order. On mobile the panel is rotated 90deg, which
   flips DOM build-order into screen right-to-left — so build the rows
   fx-first/kick-last in the DOM there, so it still reads kick-first/fx-last
   on screen. Desktop isn't rotated, so the natural ascending order already
   reads correctly. Either way the actual instrument index (r) is untouched
   — pattern/mute/Instruments mapping stays exactly as before. */
const BUILD_ORDER = IS_MOBILE ? [6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6];

/* build the grid: one label + 16 step buttons per row (desktop only —
   mobile keeps instrument names out of the rotated grid entirely, see
   #seq-legend below, so they never need a counter-rotation/offset hack) */
for (const r of BUILD_ORDER) {
  if (!IS_MOBILE) {
    const label = document.createElement("div");
    label.className = "seq-label";
    label.textContent = ROW_LABELS[r];
    grid.appendChild(label);
  }

  for (let s = 0; s < STEPS; s++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "seq-step";
    if (s % 4 === 0) cell.classList.add("seq-step--beat");
    if (pattern[r][s]) cell.classList.add("is-active");

    cell.addEventListener("click", () => {
      pattern[r][s] = !pattern[r][s];
      cell.classList.toggle("is-active", pattern[r][s]);
    });

    grid.appendChild(cell);
    columns[s].push(cell);
  }

  const muteBtn = document.createElement("button");
  muteBtn.type = "button";
  muteBtn.className = "seq-mute is-active"; // filled = channel enabled (default)
  muteBtn.setAttribute("aria-label", `mute ${ROW_LABELS[r]}`);

  muteBtn.addEventListener("click", () => {
    muted[r] = !muted[r];
    muteBtn.classList.toggle("is-active", !muted[r]);
  });

  grid.appendChild(muteBtn);

  const volSlider = document.createElement("input");
  volSlider.type = "range";
  volSlider.className = "seq-vol";
  volSlider.min = "0";
  volSlider.max = "100";
  volSlider.step = "1";
  volSlider.value = "90"; // 90% of that channel's current volume by default
  volSlider.setAttribute("aria-label", `${ROW_LABELS[r]} volume`);

  const instrumentKey = Instruments.ROW_INSTRUMENTS[r];
  volSlider.addEventListener("input", () => {
    Instruments.setChannelVolume(instrumentKey, Number(volSlider.value));
  });

  volSliders[r] = volSlider; // indexed by instrument, not build order
  grid.appendChild(volSlider);
}

let prevStep = null;
function setPlayheadStep(step) {
  if (prevStep !== null) {
    columns[prevStep].forEach(c => c.classList.remove("is-playhead"));
  }
  columns[step].forEach(c => c.classList.add("is-playhead"));
  prevStep = step;
}

function clearPlayhead() {
  if (prevStep !== null) {
    columns[prevStep].forEach(c => c.classList.remove("is-playhead"));
  }
  prevStep = null;
}

/*
  Timing runs off the AudioContext's own clock, not setInterval — a plain
  JS timer drifts (throttled background tabs, event-loop jitter). Instead
  we look ahead a short window and schedule exact step times against
  audioCtx.currentTime, then just poll to see what's already due.
  ("A Tale of Two Clocks" scheduling pattern.)
*/
let audioCtx = null;
let isPlaying = false;
let currentStep = 0;
let nextStepTime = 0;
let timerID = null;

const lookahead = 25; // ms, how often the scheduler wakes up
const scheduleAheadTime = 0.1; // seconds, how far ahead notes get scheduled
const stepQueue = []; // { step, time } already scheduled, waiting to be shown

function secondsPerStep() {
  return 60 / TEMPO / 4; // 16th note
}

function scheduleStep(step, time) {
  stepQueue.push({ step, time });

  for (let r = 0; r < ROWS; r++) {
    if (pattern[r][step] && !muted[r]) Instruments.trigger(r, time);
  }
}

function advanceStep() {
  nextStepTime += secondsPerStep();
  currentStep = (currentStep + 1) % STEPS;
}

function scheduler() {
  while (nextStepTime < audioCtx.currentTime + scheduleAheadTime) {
    scheduleStep(currentStep, nextStepTime);
    advanceStep();
  }
  timerID = setTimeout(scheduler, lookahead);
}

/* separate from scheduling: just watches the clock and paints whichever
   step just became due, so the UI stays in sync with the audio clock */
function drawLoop() {
  if (isPlaying) {
    const now = audioCtx.currentTime;
    while (stepQueue.length && stepQueue[0].time <= now) {
      const note = stepQueue.shift();
      setPlayheadStep(note.step);
    }
  }
  requestAnimationFrame(drawLoop);
}
drawLoop();

/* the filter fader is displayed as -100..100 (0 = center/bypass) but the
   audio engine still expects its original 0..100 scale — convert only,
   the underlying filter behavior is unchanged */
function filterDisplayToInternal(displayValue) {
  return (displayValue + 100) / 2;
}

/* syncs the audio engine's live settings to whatever the UI currently
   shows — used both when starting playback and for the one-off bolt preview */
function syncAudioSettings() {
  Instruments.setTempo(TEMPO);
  Instruments.setMasterDrive(Number(driveSlider.value));
  Instruments.setMasterFilter(filterDisplayToInternal(Number(filterSlider.value)));
  Instruments.setMasterMute(masterMuted);

  for (let r = 0; r < ROWS; r++) {
    Instruments.setChannelVolume(Instruments.ROW_INSTRUMENTS[r], Number(volSliders[r].value));
  }
}

function play() {
  audioCtx = Instruments.init();
  syncAudioSettings();

  isPlaying = true;
  currentStep = 0;
  nextStepTime = audioCtx.currentTime + 0.05;
  stepQueue.length = 0;

  playBtn.innerHTML = STOP_ICON;
  playBtn.setAttribute("aria-label", "stop");
  playBtn.classList.add("is-playing");

  scheduler();
}

function stop() {
  isPlaying = false;
  clearTimeout(timerID);
  stepQueue.length = 0;
  clearPlayhead();

  playBtn.innerHTML = PLAY_ICON;
  playBtn.setAttribute("aria-label", "play");
  playBtn.classList.remove("is-playing");
}

playBtn.addEventListener("click", () => {
  if (isPlaying) stop();
  else play();
});

// ============================
// TOPBAR FADERS
// ============================
const bpmSlider = document.getElementById("seq-bpm");
const bpmValue = document.getElementById("seq-bpm-value");

bpmSlider.addEventListener("input", () => {
  TEMPO = Number(bpmSlider.value);
  bpmValue.textContent = TEMPO;
  if (isPlaying) Instruments.setTempo(TEMPO);
});

const driveSlider = document.getElementById("seq-drive");
const driveValue = document.getElementById("seq-drive-value");

driveSlider.addEventListener("input", () => {
  const value = Number(driveSlider.value);
  driveValue.textContent = value;
  Instruments.setMasterDrive(value);
});

const filterSlider = document.getElementById("seq-filter");
const filterValue = document.getElementById("seq-filter-value");

filterSlider.addEventListener("input", () => {
  const value = Number(filterSlider.value);
  filterValue.textContent = value;
  Instruments.setMasterFilter(filterDisplayToInternal(value));
});

const filterResetBtn = document.getElementById("seq-filter-reset");

filterResetBtn.addEventListener("click", () => {
  const start = Number(filterSlider.value);
  const target = 0;
  if (start === target) return;

  const duration = 200; // ms (2x slower than before)
  const startTime = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const value = start + (target - start) * t;

    filterSlider.value = value;
    filterValue.textContent = Math.round(value);
    Instruments.setMasterFilter(filterDisplayToInternal(value));

    if (t < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
});

// ============================
// BOLTS (top + bottom) — both behave identically:
// 1) if the sequencer isn't playing, a click previews step 0 of the pattern
//    once (whatever's programmed there, muted rows excluded)
// 2) while the sequencer IS playing, holding one down (mouse or touch)
//    sounds a white noise source for as long as it's held
// Listeners sit on the <img> itself (not the wrapping .top-bolt div, which
// is a full-width row) so the clickable area matches the visible icon.
// ============================
const boltImgs = document.querySelectorAll(".top-bolt img");

boltImgs.forEach(bolt => {
  bolt.addEventListener("click", () => {
    if (isPlaying) return;

    audioCtx = Instruments.init();
    syncAudioSettings();

    const now = audioCtx.currentTime;
    for (let r = 0; r < ROWS; r++) {
      if (pattern[r][0] && !muted[r]) Instruments.trigger(r, now);
    }
  });

  bolt.addEventListener("mousedown", () => {
    if (!isPlaying) return;
    audioCtx = Instruments.init();
    Instruments.startBoltNoise();
  });

  bolt.addEventListener("touchstart", () => {
    if (!isPlaying) return;
    audioCtx = Instruments.init();
    Instruments.startBoltNoise();
  }, { passive: true });
});

// released anywhere on the page, not just on the bolt itself, so a drag-off
// doesn't leave the noise stuck on
window.addEventListener("mouseup", () => Instruments.stopBoltNoise());
window.addEventListener("touchend", () => Instruments.stopBoltNoise());
window.addEventListener("touchcancel", () => Instruments.stopBoltNoise());

// ============================
// ROTATED LAYOUT (mobile only) — .seq-panel is rotated 90deg via CSS.
// `transform` never affects how much space an element reserves in normal
// flow, so the wrapper gets its width/height set explicitly here, measured
// straight off the already-rotated panel (getBoundingClientRect reflects
// the transform). Desktop isn't rotated, so it needs none of this.
//
// Measured more than once on purpose: the very first measurement can run
// before the web font (Adventor, font-display:swap) has finished loading,
// so it's taken against fallback-font metrics. Once the real font swaps
// in the panel's actual size can shift slightly, leaving the wrapper's
// reserved space stale — which is what let the bottom bolt creep up onto
// the panel. Re-measuring after fonts/full load are ready corrects that.
// ============================
if (IS_MOBILE) {
  const rotateWrap = document.querySelector(".seq-rotate-wrap");
  const seqPanelEl = document.querySelector(".seq-panel");
  const legendEl = document.getElementById("seq-legend");

  // instrument-name legend: built once, in the same left-to-right order the
  // rotated columns actually appear on screen (which is ROW_LABELS' own
  // order — kick..fx — since that already matches BUILD_ORDER's result)
  if (legendEl) {
    for (let r = 0; r < ROWS; r++) {
      const span = document.createElement("span");
      span.textContent = ROW_LABELS[r];
      legendEl.appendChild(span);
    }
  }

  function measureRotatedPanel() {
    if (!rotateWrap || !seqPanelEl) return;

    // reserve room above the panel for the legend, inside the same frame
    // (the frame itself now lives on .seq-rotate-wrap, see style.css), so
    // the border/background wraps both instead of cutting through the text
    const gap = 6;
    const topPad = 15; // space between the frame's top border and the legend text
    const legendHeight = legendEl ? legendEl.offsetHeight : 0;
    const marginTop = legendEl ? legendHeight + gap + topPad : 0;
    seqPanelEl.style.marginTop = marginTop + "px";

    const rect = seqPanelEl.getBoundingClientRect();
    rotateWrap.style.width = rect.width + "px";
    rotateWrap.style.height = (rect.height + marginTop) + "px";

    // position the legend from real measured coordinates of the grid it
    // labels, instead of a guessed transform offset
    if (legendEl) {
      const wrapRect = rotateWrap.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      legendEl.style.left = (gridRect.left - wrapRect.left - 16) + "px";
      legendEl.style.top = topPad + "px";
    }
  }

  measureRotatedPanel();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measureRotatedPanel);
  }

  window.addEventListener("load", measureRotatedPanel);
}
