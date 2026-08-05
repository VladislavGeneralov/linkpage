const ROWS = 8;
const STEPS = 16;
let TEMPO = 130; // BPM, 16th-note steps — live-adjustable via the bpm fader
const ROW_LABELS = ["kick", "snar", "clap", "hhat", "cymb", "perc", "303", "fx"];

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
  [0, 6, 10],                                     // kik
  [4, 12],                                        // snr
  [4, 7, 9, 12, 14],                               // clp
  [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],         // hat
  [14],                                            // cym
  [1],                                             // prc
  [0,1,3,4,6,7,9,10,12,13,14,15],                  // 303
  [0, 12],                                         // bls
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

/* build the grid: one label + 16 step buttons per row */
for (let r = 0; r < ROWS; r++) {
  const label = document.createElement("div");
  label.className = "seq-label";
  label.textContent = ROW_LABELS[r];
  grid.appendChild(label);

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

function play() {
  audioCtx = Instruments.init();
  Instruments.setTempo(TEMPO);
  Instruments.setMasterDrive(Number(driveSlider.value));
  Instruments.setMasterFilter(Number(filterSlider.value));
  Instruments.setMasterMute(masterMuted);

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
  Instruments.setMasterFilter(value);
});

const filterResetBtn = document.getElementById("seq-filter-reset");

filterResetBtn.addEventListener("click", () => {
  const start = Number(filterSlider.value);
  const target = 50;
  if (start === target) return;

  const duration = 100; // ms
  const startTime = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const value = start + (target - start) * t;

    filterSlider.value = value;
    filterValue.textContent = Math.round(value);
    Instruments.setMasterFilter(value);

    if (t < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
});
