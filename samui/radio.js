// Радио в машине: панель внизу экрана и живой поток SoundCloud.
//
// Два источника звука:
//   local  — встроенный track.mp3 с заранее посчитанным track_data.js (как было; работает без сети);
//   stream — трек или плейлист SoundCloud живым потоком. Кузов качается по живому анализу звука:
//            он наполняет те же данные, что читает musicPose (бас, бочки, доли).
// Поток идёт через свой <audio crossOrigin> и Web Audio: источник -> анализ напрямую, а в колонки — через
// задержку STREAM_DELAY. Анализ слышит музыку раньше слушателя, поэтому упреждение AUDIO_LOOKAHEAD сохраняется.
// Ссылки SoundCloud превращает в треки и потоки прокси из проекта SCDJ (worker.js / server.js).
// Этот файл подключается раньше основного скрипта: здесь только объявления, запуск — radioInit() оттуда.

// ---------- Настройки ----------
// ссылка SoundCloud по умолчанию (трек или плейлист): грузится и играет сама; '' — встроенный трек
const RADIO_PLAYLIST = 'https://soundcloud.com/ueberlingen-deemkeyne/sets/dub-techno-deep-tech';
const RADIO_API = 'https://scdj-proxy.ptntonesix.workers.dev';    // прокси к API SoundCloud
const RADIO_CLIENT_ID = 'dkevB9EsY4jIoSm8RfddPNUKyn6hurXF';       // запасной: ключ подставляет сам прокси (см. radioApi)
const STREAM_DELAY = 0.2;                  // с — задержка звука до колонок (анализ опережает слух)
const LIVE_HOP = 512;                      // сэмплов в шаге анализа (~11 мс)
const LIVE_N = 1024;                       // шагов в кольцевых буферах (~11 с)
const LIVE_KICK_SHIFT = 0;                 // с — поправка времени бочки (подгоняется сверкой с track_data.js)

const radio = {
  mode: 'local', queue: [], idx: -1, gen: 0, volume: 1, wantPlay: false, status: '', listTitle: '',
  pending: false,                          // ссылка ещё превращается в поток: встроенный трек пока не включаем
  el: null, ctx: null, gain: null, anLow: null, anFull: null,
  resumeAt: 0, lastTime: 0, retries: 0, retryFrom: 0, fails: 0, dir: 1, menuOpen: false, drag: null,
  scroll: 0, hover: null, vu: 0, vuAt: 0,
};
const store = {                            // localStorage может быть недоступен — тогда просто не запоминаем
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
// ---------- Очередь и воспроизведение ----------
// client_id прокси находит сам; шлём его, только если игрок вписал свой в меню.
// 400 (старый прокси без ключа не работает) или 401 (ключ отвергнут) — один повтор с RADIO_CLIENT_ID
async function radioApi(path, params) {
  const own = store.get('tg_client_id') || '';
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 12000);   // прокси молчит — не ждём вечно
  const ask = (cid) => fetch(RADIO_API + path + '?' + Object.entries(cid ? { ...params, client_id: cid } : params)
    .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&'), { signal: stop.signal });
  try {
    let r = await ask(own);
    if ((r.status === 400 || r.status === 401) && own !== RADIO_CLIENT_ID) r = await ask(RADIO_CLIENT_ID);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    throw e.name === 'AbortError' ? new Error('no response') : e;
  } finally {
    clearTimeout(timer);
  }
}
const radioProgressive = (t) => t.media && t.media.transcodings && t.media.transcodings.find(x => x.format && x.format.protocol === 'progressive');
// только 30-секундный отрывок: трек SoundCloud Go+ (policy SNIP) — без подписки целиком не отдаётся; такие в очередь не берём
const radioPreview = (t) => t.policy === 'SNIP' || (radioProgressive(t) || {}).snipped === true || (t.full_duration && t.duration && t.duration < t.full_duration - 1000);
function radioStatus(text) { radio.status = text; }

// ссылка на трек или плейлист -> очередь -> играть с первого трека.
// remember — ссылку вставил игрок: она запоминается и в следующий раз грузится вместо плейлиста по умолчанию;
// shuffle — начать со случайного трека (так при запуске игры: каждый раз играет что-то другое)
async function radioLoad(url, remember = false, shuffle = false) {
  const gen = ++radio.gen;
  radio.pending = radio.mode !== 'stream';
  radioStatus('loading…');
  try {
    const res = await radioApi('/api/resolve', { url });
    let tracks = res.kind === 'playlist' ? (res.tracks || []) : res.kind === 'track' ? [res] : null;
    if (!tracks || !tracks.length) throw new Error('no track or playlist at this link');
    const stubs = tracks.filter(t => !t.media);          // большой плейлист приходит усечённым: у части треков только id
    for (let i = 0; i < stubs.length; i += 50) {
      const full = await radioApi('/api/tracks', { ids: stubs.slice(i, i + 50).map(t => t.id).join(',') }).catch(() => []);
      const byId = {};
      for (const t of (Array.isArray(full) ? full : full.collection || [])) byId[t.id] = t;
      tracks = tracks.map(t => byId[t.id] || t);
    }
    if (gen !== radio.gen) return;
    const direct = tracks.filter(radioProgressive);        // треки только с HLS пока пропускаем
    const playable = direct.filter(t => !radioPreview(t));  // и те, у которых без подписки есть только отрывок 0:30
    if (!playable.length) throw new Error(direct.length ? 'only 30 s previews here (SoundCloud Go+)' : 'no tracks with a direct stream');
    radio.queue = playable; radio.listTitle = res.kind === 'playlist' ? (res.title || '') : '';
    radio.fails = 0; radio.dir = 1;
    if (remember) store.set('tg_radio_url', url);
    await radioPlayIndex(shuffle ? Math.floor(Math.random() * playable.length) : 0);
    if (tracks.length > direct.length) radioStatus(radio.status + ' (skipped, no direct stream: ' + (tracks.length - direct.length) + ')');
    if (direct.length > playable.length) radioStatus(radio.status + ' (skipped, 30 s previews: ' + (direct.length - playable.length) + ')');
  } catch (e) {
    if (gen !== radio.gen) return;
    if (radio.mode === 'stream' && radio.queue.length) {   // новая ссылка не загрузилась — прежний список остаётся
      radioStatus('failed: ' + e.message + ' - previous list playing');
      if (radio.wantPlay && radio.el.src) radioStart();
    } else {
      radioStatus('failed: ' + e.message + ' - built-in track playing');
      radioLocal();
    }
  }
}
// поставить трек очереди; at — с какой секунды (для продолжения после протухшей ссылки)
async function radioPlayIndex(i, at = 0) {
  const gen = ++radio.gen, n = radio.queue.length;
  if (!n) return radioLocal();
  radio.idx = ((i % n) + n) % n;
  const track = radio.queue[radio.idx];
  try {
    const m = await radioApi('/api/media', { url: radioProgressive(track).url });
    if (gen !== radio.gen) return;
    if (!m.url) throw new Error('no stream link');
    const playing = radio.wantPlay || (radio.mode !== 'stream' && !music.paused);
    music.pause();
    radio.mode = 'stream'; radio.pending = false; radio.resumeAt = at; radio.lastTime = at; radio.wantPlay = playing;
    radio.el.src = m.url;
    liveReset();
    radioStatus((track.user ? track.user.username + ' - ' : '') + (track.title || 'untitled'));
    if (playing) radioStart();
  } catch (e) {                                            // не загрузился — пропускаем; если так со всей очередью — встроенный трек
    if (gen !== radio.gen) return;
    // а если это было продолжение посреди трека (ссылка протухла) — сбой, скорее всего, разовый: ещё раз тот же трек через 2 с,
    // а не следующий (раньше трек обрывался, если обновление ссылки один раз не удалось)
    if (at > 0 && radio.retries++ < 4) { console.info('радио: ссылка не обновилась (' + e.message + '), повтор'); setTimeout(() => { if (gen === radio.gen) radioPlayIndex(radio.idx, at); }, 2000); return; }
    console.info('радио: трек пропущен (' + e.message + ')');
    if (++radio.fails >= Math.min(n, 6)) { radioStatus('stream unavailable (' + e.message + ') - built-in track playing'); return radioLocal(); }
    return radioPlayIndex(radio.idx + radio.dir);
  }
}
function radioLocal() {                                    // запасной режим: встроенный трек, как раньше
  const playing = radio.mode === 'stream' || radio.pending ? radio.wantPlay : !music.paused;
  radio.gen++; radio.mode = 'local'; radio.pending = false;
  if (radio.el) radio.el.pause();
  if (playing && !userPaused) music.play().catch(() => {});
}
// запуск звука — только после действия пользователя (так требует браузер)
function radioStart() {
  if (userPaused) return;
  if (radio.mode !== 'stream') {
    // ссылка ещё грузится: встроенный трек не включаем (иначе он звучит первые секунды) — поток заиграет сам
    if (radio.pending) { radio.wantPlay = true; radioAudio(); radio.ctx.resume(); return; }
    if (music.paused) music.play().catch(() => {});
    return;
  }
  radio.wantPlay = true;
  radioAudio();
  radio.ctx.resume();
  if (radio.el.src && radio.el.paused) radio.el.play().catch(() => {});
}
function radioToggle() {                                   // пауза / продолжить
  const el = radio.mode === 'stream' ? radio.el : music;
  userPaused = !el.paused;
  if (userPaused) { el.pause(); radio.wantPlay = false; } else radioStart();
}
function radioNext() { radio.dir = 1; if (radio.mode === 'stream') radioPlayIndex(radio.idx + 1); else seekMusic(0); }
function radioPrev() {                                     // в начале трека — предыдущий, иначе — к началу этого
  radio.dir = -1;
  if (radio.mode !== 'stream') return seekMusic(0);
  if (radio.el.currentTime > 4) radioSeek(0); else radioPlayIndex(radio.idx - 1);
}
const radioPos = () => radio.mode === 'stream' ? radio.el.currentTime : music.currentTime;
function radioDur() {
  if (radio.mode !== 'stream') return isFinite(music.duration) ? music.duration : 0;
  const t = radio.queue[radio.idx];
  return isFinite(radio.el.duration) && radio.el.duration > 0 ? radio.el.duration : t ? t.duration / 1000 : 0;
}
function radioSeek(t) {
  const d = radioDur();
  if (!d) return;
  t = Math.max(0, Math.min(d - 0.5, t));
  if (radio.mode === 'stream') { radio.lastTime = t; radio.el.currentTime = t; liveReset(); } else music.currentTime = t;
}
function radioVolume(v) {
  radio.volume = Math.max(0, Math.min(1, v));
  music.volume = radio.volume;
  if (radio.gain) radio.gain.gain.value = radio.volume;     // у потока громкость — после анализа, чтобы анализ её не видел
  store.set('tg_volume', radio.volume.toFixed(3));
}
// клавиши музыки: Q/E — ±5 с (с Shift ±30 с), 1..9/0 — к 10..90% / в начало, P — пауза, < и > — предыдущий / следующий трек
function radioKeys(e) {
  const step = e.shiftKey ? 30 : 5;
  if (e.code === 'KeyQ') radioSeek(radioPos() - step);
  else if (e.code === 'KeyE') radioSeek(radioPos() + step);
  else if (/^Digit\d$/.test(e.code)) radioSeek(radioDur() * Number(e.code[5]) / 10);
  else if (e.code === 'Period') radioNext();
  else if (e.code === 'Comma') radioPrev();
  else if (e.code === 'KeyP') { radioToggle(); return true; }
  return false;
}

// ---------- Звуковой граф ----------
function radioAudio() {
  if (radio.ctx) return;
  const ctx = radio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaElementSource(radio.el);
  const lp1 = ctx.createBiquadFilter(), lp2 = ctx.createBiquadFilter();     // низ до 150 Гц — для баса и бочек
  for (const f of [lp1, lp2]) { f.type = 'lowpass'; f.frequency.value = 150; f.Q.value = 0.71; }
  radio.anLow = ctx.createAnalyser(); radio.anFull = ctx.createAnalyser();
  radio.anLow.fftSize = radio.anFull.fftSize = 8192;                         // окно ~0.18 с: хватает на паузу между кадрами
  src.connect(lp1); lp1.connect(lp2); lp2.connect(radio.anLow);
  src.connect(radio.anFull);
  const delay = ctx.createDelay(1);
  delay.delayTime.value = STREAM_DELAY;
  radio.gain = ctx.createGain(); radio.gain.gain.value = radio.volume;
  src.connect(delay); delay.connect(radio.gain); radio.gain.connect(ctx.destination);
  live.bufL = new Float32Array(8192); live.bufF = new Float32Array(8192);
}

// ---------- Живой анализ ----------
// Шаг за шагом (LIVE_HOP сэмплов) считается энергия низа и всей полосы. Из них:
//   bass  — огибающая низа, нормированная по скользящему максимуму;
//   kicks — всплески роста низа над скользящим порогом, не чаще 0.15 с: [время, сила];
//   beats — трекер темпа: период по автокорреляции онсетов за ~8 с (0.35–0.95 с), фаза подстраивается по онсетам,
//           доли предсказываются вперёд. Пока ритм не пойман, сила долей — ноль (крен уходит в ноль).
//           Любой скачок фазы или периода делается только когда крен уже погашен: сторона крена не прыгает.
const live = {
  hop: -1, validFrom: 0, bufL: null, bufF: null,
  bass: new Float32Array(LIVE_N), on: new Float32Array(LIVE_N), fl: new Float32Array(LIVE_N),
  dbL: [-70, -70], dbF: [-70, -70], bassMax: 1e-4, flMean: 0, kickRef: 1e-3, lastKick: -9,
  kicks: [], beats: [], period: 0, t0: 0, n0: 0, locked: false, conf: 0, strength: 0, pending: null,
  alt: 0, altP: 0, off: 0, lost: 0, evalAt: 0, last: 0, hopDur: LIVE_HOP / 44100, level: 0,
};
function liveReset() {                                     // смена трека, перемотка: ритм ловится заново
  live.validFrom = live.hop + 1; live.locked = false; live.conf = 0; live.pending = null;
  live.kicks.length = 0; live.alt = live.off = live.lost = 0;
}
function liveAnalyse() {
  const ctx = radio.ctx;
  if (!ctx || radio.mode !== 'stream' || radio.el.paused) return;
  const sr = ctx.sampleRate, hopDur = live.hopDur = LIVE_HOP / sr, len = radio.anLow.fftSize;
  const end = Math.round(ctx.currentTime * sr);            // номер сэмпла у конца буфера анализатора
  const hEnd = Math.floor(end / LIVE_HOP) - 1;             // последний целиком готовый шаг
  if (hEnd > live.hop) {
    radio.anLow.getFloatTimeDomainData(live.bufL); radio.anFull.getFloatTimeDomainData(live.bufF);
    let h = live.hop + 1;
    const first = Math.ceil((end - len) / LIVE_HOP);
    if (h < first) { h = first; live.validFrom = Math.max(live.validFrom, first); }   // был провал (вкладка спала) — данных за это время нет
    for (; h <= hEnd; h++) {
      const i0 = len - (end - h * LIVE_HOP);
      let eL = 0, eF = 0;
      for (let i = i0; i < i0 + LIVE_HOP; i++) { eL += live.bufL[i] * live.bufL[i]; eF += live.bufF[i] * live.bufF[i]; }
      liveHop(h, eL / LIVE_HOP, eF / LIVE_HOP, hopDur);
    }
    live.hop = hEnd;
  }
  const now = ctx.currentTime;
  if (now >= live.evalAt) { live.evalAt = now + 0.4; liveTempo(hopDur); }
  liveBeats(now);
}
function liveHop(h, eL, eF, hopDur) {
  const j = h % LIVE_N, a = Math.sqrt(eL);
  live.bassMax = Math.max(live.bassMax * Math.exp(-hopDur / 8), a, 1e-4);
  live.bass[j] = Math.min(1, a / live.bassMax);
  const dbL = Math.max(-70, 10 * Math.log10(eL + 1e-12)), dbF = Math.max(-70, 10 * Math.log10(eF + 1e-12));
  const fl = Math.max(0, dbL - live.dbL[1]), ff = Math.max(0, dbF - live.dbF[1]);   // рост за два шага
  live.dbL[1] = live.dbL[0]; live.dbL[0] = dbL; live.dbF[1] = live.dbF[0]; live.dbF[0] = dbF;
  live.fl[j] = fl; live.on[j] = fl + 0.6 * ff;
  live.level = Math.min(1, Math.max(0, (dbF + 38) / 34));    // −38…−4 дБ -> 0…1
  live.flMean += (fl - live.flMean) * Math.min(1, hopDur / 1.5);
  live.kickRef *= Math.exp(-hopDur / 6);
  // бочка: шаг c = h − 3 — локальный максимум роста низа (соседи с обеих сторон уже известны)
  const c = h - 3, fc = live.fl[((c % LIVE_N) + LIVE_N) % LIVE_N], tc = c * hopDur + LIVE_KICK_SHIFT;
  if (c < live.validFrom + 6 || fc < Math.max(6, live.flMean * 2.5 + 3) || tc - live.lastKick < 0.15) return;
  for (let d = -3; d <= 3; d++) if (d && live.fl[(((c + d) % LIVE_N) + LIVE_N) % LIVE_N] > fc) return;
  live.kickRef = Math.max(live.kickRef, fc);
  const s = Math.min(1.1, fc / live.kickRef);              // мягче, чем у запечённого трека: живой нормируется по максимуму
  live.lastKick = tc;
  if (s > 0.35) live.kicks.push([tc, Math.round(s * 100) / 100]);
  while (live.kicks.length && live.kicks[0][0] < tc - 4) live.kicks.shift();
}
// темп и фаза: раз в 0.4 с по онсетам за последние ~8 с
function liveTempo(hopDur) {
  const fps = 1 / hopDur, W = Math.min(Math.round(8 * fps), live.hop - live.validFrom, LIVE_N - 8);
  if (W < 4 * fps) { live.conf = 0; live.locked = false; return; }
  const x = new Float32Array(W);
  let mean = 0;
  for (let i = 0; i < W; i++) { x[i] = live.on[(live.hop - W + 1 + i) % LIVE_N]; mean += x[i]; }
  mean /= W;
  let ac0 = 0;
  for (let i = 0; i < W; i++) { x[i] -= mean; ac0 += x[i] * x[i]; }
  if (ac0 < 1e-3) { live.conf = 0; return; }
  const l0 = Math.round(0.35 * fps), l1 = Math.round(0.95 * fps), ac = new Float32Array(l1 + 2);
  let best = l0;
  for (let lag = l0 - 1; lag <= l1 + 1; lag++) {
    let sum = 0;
    for (let i = lag; i < W; i++) sum += x[i] * x[i - lag];
    ac[lag] = sum / ac0 * W / (W - lag);
    if (lag >= l0 && lag <= l1 && ac[lag] > ac[best]) best = lag;
  }
  const den = ac[best - 1] - 2 * ac[best] + ac[best + 1];
  const P = (best + (den < 0 ? 0.5 * (ac[best - 1] - ac[best + 1]) / den : 0)) * hopDur;   // вершина — по параболе
  const conf = live.conf = ac[best];
  // фаза: гребёнка с шагом period, сдвиг — где онсеты за окно сильнее всего
  const phase = (period) => {
    const step = period / hopDur, n = Math.floor(step);
    let bestOff = 0, bestSum = -1e9;
    for (let off = 0; off < n; off++) {
      let sum = 0, cnt = 0;
      for (let k = 0; ; k++) { const i = W - 1 - off - Math.round(k * step); if (i < 0) break; sum += x[i]; cnt++; }
      if (sum / cnt > bestSum) { bestSum = sum / cnt; bestOff = off; }
    }
    return (live.hop - bestOff) * hopDur;                  // время последней доли
  };
  if (!live.locked) {
    if (conf > 0.12 && !live.pending) { live.pending = { period: P, t0: phase(P) }; live.locked = true; live.alt = live.off = live.lost = 0; }
    return;
  }
  if (live.pending) return;
  live.lost = conf < 0.06 ? live.lost + 1 : 0;
  if (live.lost >= 5) { live.locked = false; return; }      // ритма нет уже 2 с — отпускаем
  if (Math.abs(P - live.period) / live.period < 0.06) { live.period += 0.3 * (P - live.period); live.alt = 0; }
  else {                                                   // другой темп (или кратный): переходим, только если он устойчиво сильнее
    const cur = ac[Math.max(l0, Math.min(l1, Math.round(live.period * fps)))];
    live.alt = conf > cur * 1.15 + 0.02 && Math.abs(P - live.altP) / P < 0.06 ? live.alt + 1 : 1;
    live.altP = P;
    if (live.alt >= 4) { live.pending = { period: P, t0: phase(P) }; live.alt = 0; return; }
  }
  const tb = phase(live.period);
  let d = (tb - live.t0) % live.period;
  if (d > live.period / 2) d -= live.period; else if (d < -live.period / 2) d += live.period;
  if (Math.abs(d) < 0.18 * live.period) { live.t0 += 0.35 * d; live.off = 0; }       // мелкая подстройка — плавно
  else if (++live.off >= 3) { live.pending = { t0: tb }; live.off = 0; }              // фаза ушла — перезахват (когда крен погаснет)
}
// каждый кадр: якорь идёт вперёд доля за долей, сила долей плавно растёт и гаснет, список долей — вокруг «сейчас»
function liveBeats(now) {
  const dt = Math.min(0.1, Math.max(0, now - live.last));
  live.last = now;
  const target = live.locked && !live.pending ? Math.min(1, Math.max(0, (live.conf - 0.08) / 0.2)) : 0;
  live.strength += Math.max(-dt / 0.5, Math.min(dt / 1.5, target - live.strength));
  if (live.pending && live.strength < 0.03) {              // крен погашен — можно скачком сменить период и фазу
    if (live.pending.period) live.period = live.pending.period;
    live.t0 = live.pending.t0; live.pending = null;
  }
  live.beats.length = 0;
  if (!live.period) return;
  while (live.t0 + live.period <= now) { live.t0 += live.period; live.n0++; }
  while (live.t0 > now) { live.t0 -= live.period; live.n0--; }
  for (let m = live.n0 % 2 ? -5 : -4; m <= 5; m++) live.beats.push([live.t0 + m * live.period, live.strength]);   // с чётной доли: сторона крена не скачет
}
const LIVE_DATA = {
  beats: live.beats, kicks: live.kicks,
  bassAt(t) {                                              // огибающая баса вокруг t, сглаженная в обе стороны
    const h = Math.floor(t / live.hopDur);
    let sum = 0, n = 0;
    for (let k = h - 3; k <= h + 3; k++) if (k <= live.hop && k >= live.validFrom && k > live.hop - LIVE_N) { sum += live.bass[((k % LIVE_N) + LIVE_N) % LIVE_N]; n++; }
    return n ? sum / n : 0;
  },
};
// что и в какой момент читает musicPose
function musicNow() {
  return radio.mode === 'stream' && radio.ctx ? radio.ctx.currentTime - STREAM_DELAY + AUDIO_LOOKAHEAD : music.currentTime + AUDIO_LOOKAHEAD;
}
// громкость музыки сейчас, 0..1 — для стрелки индикатора (у встроенного трека — по записанным басу и бочкам)
function musicLevel() {
  if (radio.mode === 'stream') return radio.ctx && !radio.el.paused ? live.level : 0;
  if (!TD || music.paused) return 0;
  const t = music.currentTime, i = lastBefore(TD.kicks, t);
  const kick = i >= 0 ? TD.kicks[i][1] * Math.exp(-(t - TD.kicks[i][0]) / 0.1) : 0;
  return Math.min(1, 0.3 + 0.38 * (bassEnv[Math.min(bassEnv.length - 1, Math.floor(t * TD.fps))] || 0) + 0.3 * kick);
}
function musicData() {
  if (radio.mode === 'stream') return radio.ctx && !radio.el.paused ? LIVE_DATA : null;
  return TD && !music.paused ? TD : null;
}

// ---------- Панель на экране ----------
// На экране от радио остаются кнопка SoundCloud и громкость; предыдущий/следующий трек, пауза и перемотка — внутри
// меню SoundCloud (просил Влад), меню открывается прямо над кнопкой.
// Громкость музыки — вертикальный слайдер у правого края экрана, самый правый элемент (просил Влад вместо ручки);
// в его полосу встроен линейный индикатор уровня — столбик из сегментов, зелёных, выше жёлтых и красных.
const RADIO_UI = { sc: 448 };                                 // кнопка SoundCloud — слева от слайдера громкости, с небольшим зазором
const VOL_X = () => RES_W - 8, VOL_Y0 = () => RES_H - 44, VOL_Y1 = () => RES_H - 7;   // слайдер: ось x, верх и низ хода
const RADIO_ICON = {
  prev: ['1000001', '1000011', '1000111', '1001111', '1000111', '1000011', '1000001'],
  next: ['1000001', '1100001', '1110001', '1111001', '1110001', '1100001', '1000001'],
  play: ['1000000', '1110000', '1111100', '1111111', '1111100', '1110000', '1000000'],
  pause: ['0110110', '0110110', '0110110', '0110110', '0110110', '0110110', '0110110'],
  sc: ['000000000111100', '000000011111110', '001010111111111', '101010111111111', '101010111111111', '101010111111111', '101010111111110'],
};
// кнопки треков и полоса перемотки: x0, y — левый край и верх ряда, w — его ширина; сюда же — их места для попаданий
function drawTransport(x0, y, w, hover) {
  const g = fx2d, el = radio.mode === 'stream' ? radio.el : music, T = MENU.tr = { prev: x0, play: x0 + 11, next: x0 + 22, seek0: x0 + 36, seek1: x0 + w - 44, y };
  for (const [k, icon] of [['prev', RADIO_ICON.prev], ['play', el.paused ? RADIO_ICON.play : RADIO_ICON.pause], ['next', RADIO_ICON.next]]) hudGlyphs([icon], T[k], y, hover === k ? HUD_YELLOW : HUD_WHITE, false);
  const d = radioDur(), sw = T.seek1 - T.seek0, f = radio.drag && radio.drag.kind === 'seek' ? radio.drag.f : d ? Math.min(1, radioPos() / d) : 0;
  const sx = Math.round(T.seek0 + f * sw), sy = y + 3;
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(T.seek0, sy, sw + 1, 1);
  g.fillStyle = HUD_WHITE; g.fillRect(T.seek0, sy, sx - T.seek0, 1);
  g.fillStyle = hover === 'seek' || (radio.drag && radio.drag.kind === 'seek') ? HUD_YELLOW : HUD_WHITE; g.fillRect(sx - 1, sy - 3, 3, 7);
  const mmss = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  hudGlyphs(hudText(mmss(f * d) + '/' + mmss(d || 0)), T.seek1 + 6, y + 1, MENU_COL.grey, false);
}
function drawRadio() {
  const g = fx2d, y = RES_H - 11, U = RADIO_UI;
  // громкость: вертикальный слайдер с встроенным индикатором уровня
  { const x = VOL_X(), y0 = VOL_Y0(), y1 = VOL_Y1(), H = y1 - y0, vy = Math.round(y1 - radio.volume * H), hot = radio.drag && radio.drag.kind === 'vol';
    const now = performance.now() / 1000, dt = Math.min(0.1, Math.max(0, now - radio.vuAt)), lv = musicLevel();   // столбик взлетает быстро, опадает лениво
    radio.vuAt = now; radio.vu += (lv - radio.vu) * (1 - Math.exp(-dt / (lv > radio.vu ? 0.04 : 0.22)));
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x - 3, y0 - 1, 7, H + 3);                                    // полоса
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x - 1, vy, 3, y1 - vy + 1);                           // ход громкости — до ползунка
    const top = y1 - radio.vu * radio.volume * H;                                                          // уровень на выходе: музыка × громкость
    for (let sy = y1; sy >= y0 && sy > top; sy -= 3) {                                                     // сегменты по 2 точки через одну
      const f = (y1 - sy) / H; g.fillStyle = f > 0.86 ? 'rgba(255,70,50,1)' : f > 0.68 ? HUD_YELLOW : 'rgba(90,230,110,1)';
      g.fillRect(x - 2, sy - 1, 5, 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x - 3, vy - 1, 8, 3);
    g.fillStyle = hot ? HUD_YELLOW : HUD_WHITE; g.fillRect(x - 4, vy - 2, 9, 2); }
  hudGlyphs([RADIO_ICON.sc], U.sc, y, HUD_WHITE);
}
// во что попал указатель (координаты — в пикселях игры)
function radioHit(x, y) {
  const U = RADIO_UI;
  if (Math.abs(x - VOL_X()) <= 5 && y >= VOL_Y0() - 3 && y <= VOL_Y1() + 3) return 'vol';
  if (y < RES_H - 16 || y > RES_H - 1) return null;
  if (x >= U.sc - 1 && x < U.sc + 16) return 'sc';
  return null;
}
function radioPointerDown(e) {
  const [x, y] = clockAt(e);
  if (radio.menuOpen) return radioMenuClick(x, y);
  const hit = radioHit(x, y);
  if (!hit) return;
  if (hit === 'sc') radioMenu(true);
  else if (hit === 'vol') { radio.drag = { kind: 'vol' }; radioVolume((VOL_Y1() - y) / (VOL_Y1() - VOL_Y0())); }   // щелчок — сразу на этот уровень
}
function radioPointerMove(e) {
  const [x, y] = clockAt(e), dr = radio.drag;
  if (radio.menuOpen) {
    if (dr && dr.kind === 'seek') { dr.f = seekAt(x); return; }
    radio.hover = radioMenuHit(x, y);
    document.body.style.cursor = ['close', 'add', 'local', 'row', 'prev', 'play', 'next', 'seek'].includes(radio.hover.kind) ? 'pointer' : '';
    return;
  }
  document.body.style.cursor = dr || radioHit(x, y) || teleHit(x, y) || carPickHit(x, y) !== null || teleBtnHit(x, y) ? 'pointer' : '';
  if (!dr) return;
  if (dr.kind === 'vol') radioVolume((VOL_Y1() - y) / (VOL_Y1() - VOL_Y0()));   // ползунок идёт за указателем
}
function radioPointerUp() {
  if (radio.drag && radio.drag.kind === 'seek') radioSeek(radio.drag.f * radioDur());
  radio.drag = null;
}

// ---------- Меню SoundCloud ----------
// Нарисовано тем же пиксельным шрифтом, что и приборы. Настоящие поля ввода лежат поверх невидимыми: они
// принимают клавиши, вставку и выделение, а их текст и курсор рисует игра.
// Открывается над кнопкой SoundCloud: правым краем к ней, низом — чуть выше нижних приборов. Под заголовком — ссылка,
// кнопки «играть», ряд управления (предыдущий, пауза, следующий, перемотка со временем), строка состояния, список треков.
const MENU = { w: 288, h: 201, rowH: 8 };
function menuPlace() {
  const M = MENU;
  M.x = Math.max(4, Math.min(RES_W - M.w - 4, RADIO_UI.sc + 16 - M.w)); M.y = RES_H - 16 - M.h;
  M.close = { x: M.x + M.w - 15, y: M.y + 5, w: 9, h: 9 };
  M.url = { x: M.x + 8, y: M.y + 19, w: M.w - 16, h: 11 };
  M.add = { x: M.x + 8, y: M.y + 35, w: 35, h: 11 };
  M.local = { x: M.x + 47, y: M.y + 35, w: 71, h: 11 };
  M.trY = M.y + 51;
  M.list = { x: M.x + 8, y: M.y + 75, w: M.w - 16, h: 13 * M.rowH, rows: 13 };
  M.cid = { x: M.x + 93, y: M.y + M.h - 16, w: M.w - 101, h: 11 };    // слева подпись CLIENT ID (OPTIONAL)
}
const seekAt = (x) => { const T = MENU.tr; return T ? Math.min(1, Math.max(0, (x - T.seek0) / (T.seek1 - T.seek0))) : 0; };
const MENU_COL = { panel: 'rgba(16,22,34,0.95)', edge: '#3a4a60', field: '#0a0e16', orange: '#ff5500', ghost: '#26334a',
  grey: 'rgba(138,154,180,1)', gold: 'rgba(255,210,122,1)', on: '#2a3a52', hover: '#1e2a3c', pick: '#2a4a8a' };
const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const menuFields = () => [[document.getElementById('scUrl'), MENU.url], [document.getElementById('scCid'), MENU.cid]];

function radioMenu(open) {
  radio.menuOpen = open; radio.hover = null;
  document.getElementById('scMenu').hidden = !open;
  document.body.style.cursor = '';
  for (const c in keys) keys[c] = false;
  if (!open) return;
  menuPlace(); radioMenuLayout();
  radio.scroll = Math.max(0, Math.min(radioMenuItems().length - MENU.list.rows, radio.idx - 3));   // играющий трек — на виду
  const inp = document.getElementById('scUrl'); inp.focus(); inp.select();
}
// невидимые поля ввода — точно поверх нарисованных
function radioMenuLayout() {
  const r = flareCanvas.getBoundingClientRect(), s = r.width / RES_W;
  for (const [inp, f] of menuFields()) {
    Object.assign(inp.style, { left: r.left + f.x * s + 'px', top: r.top + f.y * s + 'px', width: f.w * s + 'px', height: f.h * s + 'px' });
  }
}
// строки списка: заголовок плейлиста и треки
function radioMenuItems() {
  const items = radio.listTitle ? [{ text: radio.listTitle }] : [];
  radio.queue.forEach((t, i) => {
    const secs = Math.floor(t.duration / 1000);
    items.push({ i, text: (t.user ? t.user.username + ' - ' : '') + (t.title || ''), dur: Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0') });
  });
  return items;
}
function radioMenuHit(x, y) {
  if (!inRect(MENU, x, y)) return { kind: 'out' };
  for (const kind of ['close', 'add', 'local']) if (inRect(MENU[kind], x, y)) return { kind };
  const T = MENU.tr;
  if (T && y >= T.y - 3 && y < T.y + 10) {                                   // ряд управления треками
    for (const k of ['prev', 'play', 'next']) if (x >= T[k] - 1 && x < T[k] + 9) return { kind: k };
    if (x >= T.seek0 - 3 && x <= T.seek1 + 3) return { kind: 'seek' };
  }
  if (inRect(MENU.list, x, y)) {
    const it = radioMenuItems()[radio.scroll + Math.floor((y - MENU.list.y) / MENU.rowH)];
    if (it && it.i !== undefined) return { kind: 'row', i: it.i };
  }
  return { kind: 'panel' };
}
function radioMenuClick(x, y) {
  const hit = radioMenuHit(x, y);
  if (hit.kind === 'out' || hit.kind === 'close') radioMenu(false);
  else if (hit.kind === 'add') radioSubmit();
  else if (hit.kind === 'local') { radio.status = ''; radioLocal(); }
  else if (hit.kind === 'prev') radioPrev();
  else if (hit.kind === 'next') radioNext();
  else if (hit.kind === 'play') radioToggle();
  else if (hit.kind === 'seek') radio.drag = { kind: 'seek', f: seekAt(x) };
  else if (hit.kind === 'row') { radio.dir = 1; radio.wantPlay = true; userPaused = false; radioAudio(); radio.ctx.resume(); radioPlayIndex(hit.i); }
}
// знаки, пока помещаются в ширину w; не поместилось — в конце многоточие
function hudFit(glyphs, w) {
  let sum = -1, n = 0;
  for (const gl of glyphs) { if (sum + gl[0].length + 1 > w) break; sum += gl[0].length + 1; n++; }
  if (n === glyphs.length) return glyphs;
  while (n > 0 && sum + 6 > w) { n--; sum -= glyphs[n][0].length + 1; }
  return [...glyphs.slice(0, n), HUD_GLYPH['…']];
}
function drawRadioMenu() {
  const g = fx2d, M = MENU, C = MENU_COL, hover = radio.hover ? radio.hover.kind : '';
  const frame = (r, col) => { g.fillStyle = col; g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y + r.h - 1, r.w, 1); g.fillRect(r.x, r.y, 1, r.h); g.fillRect(r.x + r.w - 1, r.y, 1, r.h); };
  const button = (r, label, col, kind) => {
    g.fillStyle = col; g.fillRect(r.x, r.y, r.w, r.h);
    if (hover === kind) frame(r, HUD_WHITE);
    const t = hudText(label);
    hudGlyphs(t, r.x + ((r.w - hudWidth(t)) >> 1), r.y + 3, HUD_WHITE, false);
  };
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, RES_W, RES_H);          // игра под меню притушена
  g.fillStyle = C.panel; g.fillRect(M.x, M.y, M.w, M.h);
  frame(M, C.edge);
  hudGlyphs([RADIO_ICON.sc], M.x + 8, M.y + 7, HUD_WHITE, false);                     // низ облачка — на одной линии с низом букв заголовка
  hudGlyphs(hudText('SOUNDCLOUD RADIO'), M.x + 28, M.y + 7, HUD_WHITE, false);
  button(M.close, 'X', C.ghost, 'close');
  // поля ввода
  const field = (inp, f, hint) => {
    const focus = document.activeElement === inp;
    g.fillStyle = C.field; g.fillRect(f.x, f.y, f.w, f.h);
    frame(f, focus ? C.orange : C.edge);
    const glyphs = inp.value.split('').map(ch => HUD_GLYPH[ch] || HUD_GLYPH[ch.toUpperCase()] || HUD_GLYPH['?']), W = [0];
    for (const gl of glyphs) W.push(W[W.length - 1] + gl[0].length + 1);
    const room = f.w - 7, caret = focus ? inp.selectionEnd : 0;
    let s0 = 0, e0;
    while (W[caret] - W[s0] > room) s0++;                                    // окно текста: курсор всегда виден
    for (e0 = s0; e0 < glyphs.length && W[e0 + 1] - W[s0] <= room;) e0++;
    if (!glyphs.length) hudGlyphs(hudFit(hudText(hint), room), f.x + 3, f.y + 3, C.grey, false);
    if (focus && inp.selectionStart !== inp.selectionEnd) {                  // выделенное
      const a = Math.max(s0, inp.selectionStart), b = Math.min(e0, inp.selectionEnd);
      if (b > a) { g.fillStyle = C.pick; g.fillRect(f.x + 2 + W[a] - W[s0], f.y + 2, W[b] - W[a] + 1, 7); }
    }
    hudGlyphs(glyphs.slice(s0, e0), f.x + 3, f.y + 3, HUD_WHITE, false);
    if (focus && performance.now() % 1000 < 550) { g.fillStyle = HUD_WHITE; g.fillRect(f.x + 2 + W[caret] - W[s0], f.y + 2, 1, 7); }
  };
  const [[url, fu], [cid, fc]] = menuFields();
  field(url, fu, 'SOUNDCLOUD.COM TRACK OR PLAYLIST LINK');
  button(M.add, 'PLAY', C.orange, 'add');
  button(M.local, 'BUILT-IN TRACK', C.ghost, 'local');
  hudGlyphs(hudText('CTRL+V - PASTE, ENTER - PLAY'), M.local.x + M.local.w + 6, M.y + 38, C.grey, false);
  drawTransport(M.x + 8, M.trY, M.w - 16, hover);
  const status = radio.status || (radio.mode === 'stream' ? '' : 'NOW PLAYING: BUILT-IN TRACK');
  hudGlyphs(hudFit(hudText(status), M.w - 16), M.x + 8, M.y + 64, C.gold, false);
  // список: играющий трек подсвечен, справа — длительность
  const L = M.list, items = radioMenuItems(), maxScroll = Math.max(0, items.length - L.rows);
  radio.scroll = Math.max(0, Math.min(maxScroll, radio.scroll));
  for (let r = 0; r < L.rows; r++) {
    const it = items[radio.scroll + r], y = L.y + r * M.rowH;
    if (!it) break;
    const on = it.i !== undefined && radio.mode === 'stream' && it.i === radio.idx;
    const over = radio.hover && radio.hover.kind === 'row' && radio.hover.i === it.i;
    if (on || over) { g.fillStyle = on ? C.on : C.hover; g.fillRect(L.x, y, L.w - 4, M.rowH); }
    const dur = it.dur ? hudText(it.dur) : [], dw = it.dur ? hudWidth(dur) + 6 : 0;
    hudGlyphs(hudFit(hudText(it.text), L.w - 10 - dw), L.x + 2, y + 1, it.i === undefined ? C.grey : on ? C.gold : HUD_WHITE, false);
    if (it.dur) hudGlyphs(dur, L.x + L.w - 6 - hudWidth(dur), y + 1, on ? C.gold : C.grey, false);
  }
  if (maxScroll) {                                                           // полоса прокрутки
    const bh = Math.max(6, Math.round(L.h * L.rows / items.length)), by = L.y + Math.round((L.h - bh) * radio.scroll / maxScroll);
    g.fillStyle = C.hover; g.fillRect(L.x + L.w - 2, L.y, 2, L.h);
    g.fillStyle = C.grey; g.fillRect(L.x + L.w - 2, by, 2, bh);
  }
  hudGlyphs(hudText('CLIENT ID (OPTIONAL)'), M.x + 8, fc.y + 3, C.grey, false);
  field(cid, fc, 'EMPTY = AUTOMATIC');
}
function radioSubmit() {
  const url = document.getElementById('scUrl').value.trim(), cid = document.getElementById('scCid').value.trim();
  if (cid) store.set('tg_client_id', cid); else store.del('tg_client_id');   // пустое поле — ключ снова подставляет прокси
  const back = !url && RADIO_PLAYLIST;                      // пустое поле — вернуть плейлист по умолчанию
  if (!back && !/^https?:\/\/([a-z0-9-]+\.)?soundcloud\.com\/.+/i.test(url)) return radioStatus('need a link like https://soundcloud.com/…');
  userPaused = false; radio.wantPlay = true;
  radioAudio(); radio.ctx.resume();                         // нажатие кнопки — то самое действие пользователя, после которого можно звук
  if (back) { store.del('tg_radio_url'); document.getElementById('scUrl').value = RADIO_PLAYLIST; radioLoad(RADIO_PLAYLIST); }
  else radioLoad(url, url !== RADIO_PLAYLIST);
}

// ---------- Запуск ----------
function radioInit() {
  const v = parseFloat(store.get('tg_volume'));
  radioVolume(isFinite(v) ? v : 1);
  const el = radio.el = new Audio();
  el.crossOrigin = 'anonymous'; el.preload = 'auto';
  el.addEventListener('loadedmetadata', () => { if (radio.resumeAt > 0) el.currentTime = radio.resumeAt; });
  el.addEventListener('timeupdate', () => {
    if (el.seeking || !el.currentTime) return;
    if (radio.retries && el.currentTime > radio.retryFrom + 8) radio.retries = 0;   // 8 с ровной игры — счёт попыток заново
    radio.lastTime = el.currentTime; radio.fails = 0;
  });
  el.addEventListener('ended', () => {
    // поток мог оборваться раньше конца (ссылка протухла посреди скачивания — браузер принимает обрыв за конец):
    // если до конца трека по данным SoundCloud ещё больше 5 с — это не конец, берём новую ссылку и продолжаем с того же места
    const t = radio.queue[radio.idx], full = t && t.duration ? t.duration / 1000 : 0;
    if (radio.mode === 'stream' && full && radio.lastTime < full - 5 && radio.retries++ < 4) {
      console.info('радио: поток оборвался на ' + Math.round(radio.lastTime) + ' из ' + Math.round(full) + ' с, продолжаю');
      radio.retryFrom = radio.lastTime; return radioPlayIndex(radio.idx, radio.lastTime);
    }
    radio.dir = 1; radioPlayIndex(radio.idx + 1);                                          // после последнего — сначала
  });
  el.addEventListener('error', () => {
    if (radio.mode !== 'stream' || !el.src) return;
    // ссылка на поток живёт считанные минуты: посреди длинного микса берём новую и продолжаем с того же места
    if (radio.retries++ < 4) { radio.retryFrom = radio.lastTime; radioPlayIndex(radio.idx, radio.lastTime); }
    else { console.info('радио: трек пропущен (поток не играет после 4 попыток)'); radio.retries = 0; radio.fails++; radioPlayIndex(radio.idx + radio.dir); }
  });
  addEventListener('pointerdown', radioPointerDown);
  addEventListener('pointermove', radioPointerMove);
  for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, radioPointerUp);
  // щелчок по нарисованному меню не должен отнимать фокус у поля ввода
  addEventListener('mousedown', (e) => { if (radio.menuOpen && e.target.tagName !== 'INPUT') e.preventDefault(); });
  addEventListener('resize', () => { if (radio.menuOpen) radioMenuLayout(); });
  addEventListener('wheel', (e) => {
    const [x, y] = clockAt(e);
    if (radio.menuOpen) { if (inRect(MENU, x, y)) radio.scroll += Math.sign(e.deltaY) * 2; }
    else if (radioHit(x, y) === 'vol') radioVolume(radio.volume - Math.sign(e.deltaY) * 0.05);
  }, { passive: true });
  for (const [inp] of menuFields()) inp.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'NumpadEnter') radioSubmit(); });
  document.getElementById('scCid').value = store.get('tg_client_id') || '';
  const saved = store.get('tg_radio_url') || RADIO_PLAYLIST;
  if (saved) { document.getElementById('scUrl').value = saved; radio.wantPlay = false; radioLoad(saved, false, true); }
}
