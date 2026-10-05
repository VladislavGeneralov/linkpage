// Звук игры: мотор, шины, море. Правила — в engine_lab/ENGINE_SOUND_NOTES.md, проверка на слух — по
// engine_lab/SOUND_TEST_CHECKLIST.md (слышит звук только Влад).
//
// Мотор — гранулярный: запись одного разгона (engine_lab/data/*.js, вшита в base64 вместе с таблицей «время → частота
//   гармоники») режется на кусочки по 100 мс; играют те, чья высота отвечает текущим оборотам. Обороты считаются из
//   скорости машины и передачи, а не из педали. Кусочки собирает AudioWorklet в звуковом потоке — просадка кадров
//   на звук не влияет; если worklet недоступен, их планирует таймер (как в пробе engine_lab/index.html).
// Шины — петли из sound_data.js: визг в заносе и на ручнике, юз при торможении в пол, шорох на грунте и траве.
// Море — две петли прибоя: дальняя слышна за сотни метров от берега, ближняя — у воды и в воде. Всплеск — при въезде в воду.
// Разрушение — разовые звуки из engine_lab/breakables (нарезаны в sound_data.js): у каждого вида предмета свой набор
//   вариантов, плюс удар по кузову; упор в стену на малой скорости — тупой толчок.
// Громкость: «−» и «=»; выключить и включить звук — M. Музыка радио регулируется отдельно, своей ручкой.
//
// Записи: мотор Жука — Cinetony (CC0), Porsche 911 — jerry.berumen (CC BY 4.0, автора нужно указать при публикации),
// Lancia — TBolt930 (CC0); шины — nmarciniegasm, audible-edge, craigsmith, EverydaySounds (CC0); волны — felix.blume (CC0);
// разрушение, удары и всплески — только записи CC0 (список — в engine_lab/make_game_sounds.py).
//
// Файл подключается раньше основного скрипта: здесь только объявления; игра зовёт soundStart() при первом нажатии
// и soundUpdate(dt) каждый кадр.

const SOUND = {
  ctx: null, ready: false, starting: false, mode: '',     // mode: 'worklet' или 'timer'
  vol: 0.8, muted: false, note: null,                      // note — надпись о громкости на пару секунд: { text, until }
  rpm: 0.12, gear: 0, open: 0, carId: null, engines: {},   // обороты 0..1 по шкале записи, передача, газ открыт
  asphalt: 1, wasDry: true, hidden: false, test: null,     // test — для проверок: { rpm, open } подменяет расчёт
  shots: {}, lastBreak: {}, lastImpact: 0, lastSplash: 0, played: [],   // разовые звуки; played — что звучало (для проверок)
};
// машина в игре -> запись мотора (данные — engine_lab/data/*.js; новые три собирает engine_lab/make_engine_data.py)
const ENGINE_OF = { beetle: 'beetle', porsche: 'porsche911', lancia: 'lancia_fiat', wave: 'wave', dmax: 'dmax', city: 'city',
  evo: 'evo', impreza: 'impreza' };
const ENGINE_TRIM_DB = { beetle: -1.8, porsche911: 3.8, lancia_fiat: 25.2, wave: 1, dmax: 2.5, city: 0.5, evo: 6.1, impreza: 2.5 };   // Evo: вдвое громче выравнивания и на 15 % тише (подбирал Влад на слух)   // у Жука +3.5 дБ сверх выравнивания: в 1.5 раза громче (просил Влад)          // выравнивание громкости записей (к −23 LUFS)
const ENGINE_BRIGHT_DB = { beetle: 9 };                                                // подъём верхов глухой записи
const GEARS = [0.28, 0.5, 0.75, 1.0], RPM_IDLE = 0.12;     // верхние скорости передач в долях предельной; холостой ход
const GRAIN = 0.1;                                         // с — длина гранулы; перекрытие в три слоя
const MIX = { engine: 0.55, tires: 0.575, waves: 0.3, falls: 0.45, fx: 0.8, birds: 0.5, ambience: 0.12 };   // фон (ambience.js) — подложка: у моря на 6–7 дБ тише прибоя, тише птиц   // волны — тихим фоном; шины на 15 % громче исходного (просил Влад)
const FALL_FAR = 380, FALL_NEAR = 110;                     // м — с какого расстояния слышен гул водопада и с какого — сам водопад
const SEA_FAR = 350, SEA_NEAR = 80;                        // м — с какого расстояния до воды слышен дальний и ближний прибой

// --- гранулярный мотор в звуковом потоке ---
const GRAIN_WORKLET = `
class GrainEngine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'rpm', defaultValue: 0.12, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
            { name: 'open', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }];
  }
  constructor() {
    super();
    this.eng = null; this.grains = []; this.wait = 0; this.last = null;
    this.port.onmessage = (e) => { this.eng = e.data; this.last = null; };
  }
  // частота отслеженной гармоники мотора в месте x записи
  fAt(L, x) {
    const t = L.t, n = t.length;
    if (x <= t[0]) return L.f[0];
    if (x >= t[n - 1]) return L.f[n - 1];
    const i = Math.min(n - 2, Math.floor(x / (t[1] - t[0]))), k = (x - t[i]) / (t[i + 1] - t[i]);
    return L.f[i] + (L.f[i + 1] - L.f[i]) * k;
  }
  // место записи с частотой около fT; окно выбора не уже 0.25 с — иначе гранулы ложатся в одну точку и звенят гребёнкой
  posFor(L, fT) {
    const t = L.t, f = L.f, n = f.length;
    let lo = Infinity, hi = -Infinity, best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const r = f[i] / fT;
      if (r > 0.99 && r < 1.01) { if (t[i] < lo) lo = t[i]; if (t[i] > hi) hi = t[i]; }
      const d = Math.abs(Math.log(r)); if (d < bd) { bd = d; best = i; }
    }
    if (lo > hi) lo = hi = t[best];
    const end = t[n - 1], minW = Math.max(0.25, end * 0.08);
    if (hi - lo < minW) {
      const c = (lo + hi) / 2; lo = c - minW / 2; hi = c + minW / 2;
      if (lo < 0) { hi -= lo; lo = 0; }
      if (hi > end) { lo -= hi - end; hi = end; }
    }
    return lo + Math.random() * (hi - lo);
  }
  spawn(rpm, open) {
    const e = this.eng, L = (!open && e.off) ? e.off : e.on, fT = e.fLo * Math.pow(e.fHi / e.fLo, rpm);
    let pos = this.posFor(L, fT);
    // фаза: новая гранула стартует на целое число периодов мотора от того места, где сейчас читает предыдущая
    const p = this.last;
    if (p && p.L === L) {
      const cont = p.p / L.sr, T = 1 / this.fAt(L, cont), snapped = cont + Math.round((pos - cont) / T) * T;
      if (Math.abs(snapped - pos) < T) pos = snapped;
    }
    let rate = fT / this.fAt(L, pos);
    const need = ${GRAIN} * rate;
    pos = Math.max(0.005, Math.min(L.dur - need - 0.02, pos));
    rate = fT / this.fAt(L, pos + need / 2);
    const g = { L, p: pos * L.sr, inc: rate * L.sr / sampleRate, n: 0, N: Math.round(${GRAIN} * sampleRate) };
    this.grains.push(g); this.last = g;
  }
  process(inputs, outputs, params) {
    const out = outputs[0], o = out[0];
    if (!this.eng) return true;
    const rpm = params.rpm[0], open = params.open[0] > 0.5, hop = Math.round(sampleRate * ${GRAIN} / 3);
    for (let i = 0; i < o.length; i++) {
      if (--this.wait <= 0) { this.spawn(rpm, open); this.wait = hop; }
      let s = 0;
      for (let k = this.grains.length - 1; k >= 0; k--) {
        const g = this.grains[k], d = g.L.data, j = g.p | 0;
        if (j + 1 < d.length) s += (d[j] + (d[j + 1] - d[j]) * (g.p - j)) * (0.5 - 0.5 * Math.cos(6.283185307 * g.n / g.N));   // окно Ханна
        g.p += g.inc;
        if (++g.n >= g.N) this.grains.splice(k, 1);
      }
      o[i] = s;
    }
    for (let c = 1; c < out.length; c++) out[c].set(o);
    return true;
  }
}
registerProcessor('grain-engine', GrainEngine);
`;

function soundB64(b64) {
  const s = atob(b64), a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a.buffer;
}
const soundDecode = (b64) => new Promise((ok, fail) => SOUND.ctx.decodeAudioData(soundB64(b64), ok, fail));
// Расшифровать в родной частоте записи, а не пересчитывать под звуковую карту (48 кГц): птицы записаны в 22 кГц, фон — в
// 32 кГц, и пересчёт при расшифровке раздувал их в памяти в 2,2 и 1,5 раза, ничего не добавляя к звуку. Под звуковую
// карту браузер пересчитывает такую запись сам, при воспроизведении. mono — сложить каналы в один (петли фона: решение
// Влада, память — вдвое меньше). Не вышло — обычная расшифровка.
function soundMp3Rate(ab) {                                     // частота записи по заголовку первого кадра MP3, 0 — не понять
  const b = new Uint8Array(ab, 0, Math.min(ab.byteLength, 65536));
  let i = b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 ? 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]) : 0;   // пропустить тег ID3
  for (; i < b.length - 4; i++) if (b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0) {
    const ver = (b[i + 1] >> 3) & 3, sr = (b[i + 2] >> 2) & 3, T = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }[ver];
    return T && sr < 3 ? T[sr] : 0;
  }
  return 0;
}
async function soundDecodeNative(b64, mono = false) {
  let buf = null;
  try { const ab = soundB64(b64), rate = soundMp3Rate(ab); if (rate) buf = await new OfflineAudioContext(1, 1, rate).decodeAudioData(ab); } catch (e) { buf = null; }
  if (!buf) buf = await soundDecode(b64);
  if (mono && buf.numberOfChannels > 1) {
    const m = SOUND.ctx.createBuffer(1, buf.length, buf.sampleRate), out = m.getChannelData(0), k = 1 / buf.numberOfChannels;
    for (let c = 0; c < buf.numberOfChannels; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < ch.length; i++) out[i] += ch[i] * k; }
    buf = m;
  }
  return buf;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// слой мотора: запись в моно и таблица «время → частота»
async function soundLayer(d) {
  const buf = await soundDecode(d.mp3), n = buf.length, data = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) { const ch = buf.getChannelData(c); for (let i = 0; i < n; i++) data[i] += ch[i] / buf.numberOfChannels; }
  return { buffer: buf, data, sr: buf.sampleRate, dur: buf.duration, t: d.table.map(p => p[0]), f: d.table.map(p => p[1]) };
}
// петля: крутится всё время, слышна настолько, насколько открыт её gain
function soundLoop(buf, loop, bus) {
  const src = SOUND.ctx.createBufferSource(), g = SOUND.ctx.createGain();
  src.buffer = buf; src.loop = true; src.loopStart = loop[0]; src.loopEnd = loop[1];
  g.gain.value = 0; src.connect(g); g.connect(bus);
  src.start(0, loop[0] + Math.random() * (loop[1] - loop[0]));
  return { src, gain: g.gain };
}

// расстояние до моря, м (0 — в воде): по сетке высот острова, один раз
function seaDistance(x, z) {
  const T = TERRAIN;
  if (!SOUND.sea) {
    const D = SOUND.sea = new Float32Array(T.nx * T.nz), nz = T.nz, far = 1e6, s = T.step, sd = s * Math.SQRT2;
    for (let i = 0; i < D.length; i++) D[i] = T.h[i] < 0 ? 0 : far;
    for (let ix = 0; ix < T.nx; ix++) for (let iz = 0; iz < nz; iz++) {              // два прохода: сверху вниз и обратно
      const i = ix * nz + iz; let d = D[i];
      if (ix > 0) { d = Math.min(d, D[i - nz] + s); if (iz > 0) d = Math.min(d, D[i - nz - 1] + sd); if (iz < nz - 1) d = Math.min(d, D[i - nz + 1] + sd); }
      if (iz > 0) d = Math.min(d, D[i - 1] + s);
      D[i] = d;
    }
    for (let ix = T.nx - 1; ix >= 0; ix--) for (let iz = nz - 1; iz >= 0; iz--) {
      const i = ix * nz + iz; let d = D[i];
      if (ix < T.nx - 1) { d = Math.min(d, D[i + nz] + s); if (iz > 0) d = Math.min(d, D[i + nz - 1] + sd); if (iz < nz - 1) d = Math.min(d, D[i + nz + 1] + sd); }
      if (iz < nz - 1) d = Math.min(d, D[i + 1] + s);
      D[i] = d;
    }
  }
  const fx = (x - T.x0) / T.step, fz = (z - T.z0) / T.step;
  if (!(fx >= 0 && fz >= 0 && fx < T.nx - 1 && fz < T.nz - 1)) return 0;               // за сеткой — открытое море
  const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz, i = ix * T.nz + iz, D = SOUND.sea;
  return (D[i] * (1 - u) + D[i + T.nz] * u) * (1 - v) + (D[i + 1] * (1 - u) + D[i + T.nz + 1] * u) * v;
}

// первое нажатие клавиши или щелчок: браузер разрешает звук только после действия человека
async function soundStart() {
  const S = SOUND;
  if (S.ctx) { if (S.ctx.state === 'suspended') S.ctx.resume(); return; }
  if (S.starting || !window.ENGINE_DATA || !window.SOUND_DATA) return;
  S.starting = true;
  try {
    const ctx = S.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const v = parseFloat(store.get('tg_sfx')); if (v >= 0 && v <= 1) S.vol = v;
    S.muted = store.get('tg_sfx_off') === '1';
    S.master = ctx.createGain(); S.master.gain.value = S.muted ? 0 : S.vol; S.master.connect(ctx.destination);
    const lim = ctx.createDynamicsCompressor();                                         // ограничитель: усиленные записи не хрипят
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1; lim.connect(S.master); S.lim = lim;
    const bus = (g) => { const n = ctx.createGain(); n.gain.value = g; n.connect(lim); const a = ctx.createAnalyser(); a.fftSize = 16384; a.smoothingTimeConstant = 0; n.connect(a); n.meter = a; return n; };   // meter — для проверок уровня и высоты
    S.busEngine = bus(MIX.engine); S.busTires = bus(MIX.tires); S.busWaves = bus(MIX.waves); S.busFalls = bus(MIX.falls); S.busFx = bus(MIX.fx);
    // мотор: гранулы -> фильтр «без газа» -> громкость «без газа» -> подъём верхов -> выравнивание записи
    S.trim = ctx.createGain(); S.trim.connect(S.busEngine);
    S.shelf = ctx.createBiquadFilter(); S.shelf.type = 'highshelf'; S.shelf.frequency.value = 500; S.shelf.gain.value = 0; S.shelf.connect(S.trim);
    S.load = ctx.createGain(); S.load.connect(S.shelf);
    S.tone = ctx.createBiquadFilter(); S.tone.type = 'lowpass'; S.tone.Q.value = 0.5; S.tone.frequency.value = 9000; S.tone.connect(S.load);
    for (const [name, d] of Object.entries(window.ENGINE_DATA)) {
      const on = await soundLayer(d), off = d.off ? await soundLayer(d.off) : null;
      S.engines[name] = { on, off, fLo: on.f[0] * d.extLo, fHi: on.f[on.f.length - 1] * d.extHi };
    }
    try {                                                                               // (с диска, без сервера, модуль worklet грузится только из data-адреса)
      await ctx.audioWorklet.addModule('data:text/javascript;charset=utf-8,' + encodeURIComponent(GRAIN_WORKLET));
      S.node = new AudioWorkletNode(ctx, 'grain-engine', { numberOfInputs: 0, outputChannelCount: [1] });
      S.node.connect(S.tone);
      S.mode = 'worklet';
    } catch (err) {                                                                     // запасной путь: гранулы планирует таймер
      S.mode = 'timer'; S.nextGrain = ctx.currentTime + 0.05; S.prev = null;
      S.hann = new Float32Array(64); for (let i = 0; i < 64; i++) S.hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / 63);
      setInterval(soundGrains, 20);
    }
    // шины и море
    const D = window.SOUND_DATA;
    S.tires = {};
    for (const k of Object.keys(D.tires)) S.tires[k] = soundLoop(await soundDecode(D.tires[k].mp3), D.tires[k].loop, S.busTires);
    S.waves = {};
    for (const k of Object.keys(D.waves)) S.waves[k] = soundLoop(await soundDecode(D.waves[k].mp3), D.waves[k].loop, S.busWaves);
    S.falls = {};
    for (const k of Object.keys(D.falls || {})) S.falls[k] = soundLoop(await soundDecode(D.falls[k].mp3), D.falls[k].loop, S.busFalls);
    for (const [k, list] of Object.entries(D.breaks)) S.shots[k] = await Promise.all(list.map(o => soundDecode(o.mp3)));
    document.addEventListener('visibilitychange', () => {                               // вкладка свёрнута — звук стихает, а не висит на последней ноте
      S.hidden = document.hidden;
      S.master.gain.setTargetAtTime(S.hidden || S.muted ? 0 : S.vol, ctx.currentTime, 0.1);
    });
    S.ready = true;
    if (typeof birdsStart === 'function') birdsStart();                                // голоса птиц (birds.js) — декодируются уже после мотора
    if (typeof ambienceStart === 'function') ambienceStart();                          // тихий фон: цикады, джунгли, ветер, посёлок, рынок, гекконы (ambience.js)
  } catch (err) { console.warn('звук не запустился:', err); }
  S.starting = false;
}

// другая машина — другая запись мотора; старые гранулы доигрывают, новые идут уже из новой записи — без щелчка
function soundCar(id) {
  const S = SOUND, name = ENGINE_OF[id] || 'beetle', e = S.engines[name];
  S.carId = id; S.engine = e; S.prev = null;
  if (!e) return;
  S.shelf.gain.value = ENGINE_BRIGHT_DB[name] || 0;
  S.trim.gain.value = Math.pow(10, (ENGINE_TRIM_DB[name] || 0) / 20);
  const lay = (L) => L && { data: L.data, sr: L.sr, dur: L.dur, t: L.t, f: L.f };
  if (S.node) S.node.port.postMessage({ on: lay(e.on), off: lay(e.off), fLo: e.fLo, fHi: e.fHi });
}

// запасной планировщик гранул (если нет AudioWorklet) — тот же алгоритм, что в пробе
function soundGrains() {
  const S = SOUND, ctx = S.ctx, e = S.engine;
  if (!e || !S.ready) return;
  const fAt = (L, x) => {
    const t = L.t, n = t.length;
    if (x <= t[0]) return L.f[0];
    if (x >= t[n - 1]) return L.f[n - 1];
    const i = Math.min(n - 2, Math.floor(x / (t[1] - t[0]))), k = (x - t[i]) / (t[i + 1] - t[i]);
    return L.f[i] + (L.f[i + 1] - L.f[i]) * k;
  };
  const L = (!S.open && e.off) ? e.off : e.on, hop = GRAIN / 3;
  while (S.nextGrain < ctx.currentTime + 0.12) {
    const fT = e.fLo * Math.pow(e.fHi / e.fLo, S.rpm), t = L.t, f = L.f, n = f.length;
    let lo = Infinity, hi = -Infinity, best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const r = f[i] / fT;
      if (r > 0.99 && r < 1.01) { if (t[i] < lo) lo = t[i]; if (t[i] > hi) hi = t[i]; }
      const d = Math.abs(Math.log(r)); if (d < bd) { bd = d; best = i; }
    }
    if (lo > hi) lo = hi = t[best];
    const end = t[n - 1], minW = Math.max(0.25, end * 0.08);
    if (hi - lo < minW) { const c = (lo + hi) / 2; lo = c - minW / 2; hi = c + minW / 2; if (lo < 0) { hi -= lo; lo = 0; } if (hi > end) { lo -= hi - end; hi = end; } }
    let pos = lo + Math.random() * (hi - lo);
    if (S.prev && S.prev.layer === L) {
      const cont = S.prev.pos + (S.nextGrain - S.prev.at) * S.prev.rate, T = 1 / fAt(L, cont), snapped = cont + Math.round((pos - cont) / T) * T;
      if (Math.abs(snapped - pos) < T) pos = snapped;
    }
    let rate = fT / fAt(L, pos);
    const need = GRAIN * rate;
    pos = Math.max(0.005, Math.min(L.dur - need - 0.02, pos));
    rate = fT / fAt(L, pos + need / 2);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = L.buffer; src.playbackRate.value = rate; g.gain.value = 0;
    g.gain.setValueCurveAtTime(S.hann, S.nextGrain, GRAIN);
    src.connect(g); g.connect(S.tone);
    src.start(S.nextGrain, pos, need + 0.02); src.stop(S.nextGrain + GRAIN + 0.01);
    S.prev = { layer: L, pos, rate, at: S.nextGrain };
    S.nextGrain += hop;
  }
  if (S.nextGrain < ctx.currentTime) { S.nextGrain = ctx.currentTime + 0.02; S.prev = null; }   // вкладка спала
}

// каждый кадр: обороты, шины, море
function soundUpdate(dt) {
  const S = SOUND;
  if (!S.ready) return;
  const now = S.ctx.currentTime, sp = Math.abs(car.speed);
  if (S.carId !== CAR.id) soundCar(CAR.id);

  // --- мотор: обороты — от скорости и передачи; инерцию несёт машина, а не мотор ---
  const s = Math.min(1, sp / CAR.maxSpeed);
  let r = s / GEARS[S.gear];
  if (r > 0.9 && S.gear < GEARS.length - 1) S.gear++;
  else if (r < 0.42 && S.gear > 0) S.gear--;
  r = Math.max(RPM_IDLE, Math.min(1, s / GEARS[S.gear]));              // у нуля — холостой ход (сцепление буксует)
  S.rpm += (r - S.rpm) * Math.min(1, dt * 9);                          // переключение — быстрый «съезд», а не щелчок
  S.open = car.gas > 0.08 || (car.speed < 0.3 && car.brake > 0.08) ? 1 : 0;   // газ; задним ходом едут на «тормозе»
  if (S.test) { S.rpm = S.test.rpm; S.open = S.test.open; }
  if (S.node) { S.node.parameters.get('rpm').value = S.rpm; S.node.parameters.get('open').value = S.open; }
  // без газа: своя запись сброса — естественный тон; у кого её нет — разгон, притушенный фильтром
  const own = S.engine && S.engine.off;
  S.tone.frequency.setTargetAtTime(S.open || own ? 9000 : 1800, now, 0.08);
  S.load.gain.setTargetAtTime(S.open ? 1 : own ? 0.8 : 0.55, now, 0.08);

  // --- шины ---
  const depth = waterDepth(car.x, car.z), wet = depth > 0.1, gate = clamp01((sp - 3) / 7);        // тише 3 м/с — молчат
  const hand = (keys.Space || (typeof TOUCH !== 'undefined' && TOUCH.hand)) ? 1 : 0;   // ручник — клавишей или с сенсорного слоя
  const side = clamp01((Math.abs(car.slip) - 0.1) / 0.5), brake = car.speed > 0 ? clamp01((car.brake - 0.8) / 0.2) : 0;
  const slide = wet ? 0 : Math.max(side * 0.65, hand) * gate, skid = wet ? 0 : brake * gate;
  S.asphalt += ((surfaceLoss(car.x, car.z) ? 0 : 1) - S.asphalt) * Math.min(1, dt / 0.12);        // покрытие меняется плавно
  const T = S.tires, a = S.asphalt, tc = 0.06;
  T.squeal.gain.setTargetAtTime(slide * a, now, tc);
  T.spin.gain.setTargetAtTime(hand * gate * a * 0.45 * (wet ? 0 : 1), now, tc);
  T.brake.gain.setTargetAtTime(skid * a, now, tc);
  T.dirt.gain.setTargetAtTime(Math.max(slide, skid) * (1 - a) * 0.9, now, tc);
  const pitch = 0.92 + 0.14 * Math.min(1, sp / 30) + 0.02 * Math.sin(now * 0.9);                  // визг чуть «гуляет» — не сирена
  T.squeal.src.playbackRate.setTargetAtTime(pitch, now, 0.1);
  T.brake.src.playbackRate.setTargetAtTime(0.9 + 0.2 * Math.min(1, sp / 30), now, 0.1);

  // --- море: дальний прибой слышен издалека, ближний — у самой воды и в воде ---
  const d = seaDistance(car.x, car.z);
  S.waves.far.gain.setTargetAtTime(0.55 * clamp01(1 - (d - 20) / SEA_FAR) ** 2, now, 0.4);
  S.waves.near.gain.setTargetAtTime(clamp01(1 - d / SEA_NEAR) ** 1.5, now, 0.4);
  // --- водопады: издалека — гул, вблизи — сам водопад (большой или малый), у больших ещё джунгли с цикадами; у русла — ручей ---
  if (S.falls && S.falls.far && typeof fallSounds !== 'undefined') {
    const g = { far: 0, big: 0, small: 0, jungle: 0, stream: 0 };
    for (const f of fallSounds) {
      const df = Math.hypot(car.x - f.x, car.z - f.z);
      if (df > FALL_FAR + 60) continue;
      const near = clamp01(1 - df / FALL_NEAR);
      g.far = Math.max(g.far, 0.7 * clamp01(1 - (df - 40) / FALL_FAR) ** 2 * (1 - 0.75 * near));
      g[f.kind] = Math.max(g[f.kind], near ** 1.5);
      if (f.kind === 'big') g.jungle = Math.max(g.jungle, 0.5 * clamp01(1 - df / 240));
      for (const st of fallStreams) if (st.id === f.id) for (let i = 0; i < st.pts.length; i += 2) {      // ручей слышно в 30 м от русла
        const ds = Math.hypot(car.x - st.pts[i][0], car.z - st.pts[i][1]);
        if (ds < 30) g.stream = Math.max(g.stream, 0.6 * (1 - ds / 30) ** 1.5);
      }
    }
    for (const k in g) if (S.falls[k]) S.falls[k].gain.setTargetAtTime(g[k], now, 0.4);
  }
  // всплеск: въехал в воду на скорости
  if (depth > 0.25 && S.wasDry && sp > 4) soundShot('splashBig', 0.4 + 0.6 * Math.min(1, sp / 18));
  if (depth > 0.25) S.wasDry = false; else if (depth < 0.05) S.wasDry = true;
  if (typeof birdsUpdate === 'function') birdsUpdate(dt);                              // птицы (birds.js)
  if (typeof ambienceUpdate === 'function') ambienceUpdate(dt);                        // фон (ambience.js)
}

// --- разовые звуки: разрушение, удары, всплески ---
// один из вариантов звука key: громкость gain, через delay секунд; высота чуть гуляет, чтобы повторы не звучали одинаково
function soundShot(key, gain = 1, delay = 0, vary = true) {
  const S = SOUND, list = S.shots[key];
  if (!S.ready || !list || !list.length || gain <= 0.01) return;
  const src = S.ctx.createBufferSource(), g = S.ctx.createGain();
  src.buffer = list[(Math.random() * list.length) | 0];
  if (vary) src.playbackRate.value = 0.92 + Math.random() * 0.16;
  g.gain.value = Math.min(1.2, gain);
  src.connect(g); g.connect(S.busFx);
  src.start(S.ctx.currentTime + delay);
  S.played.push(key); if (S.played.length > 40) S.played.shift();
}
// машина что-то сломала: kind — вид предмета, mat — из чего он, speed — её скорость, м/с
function soundBreak(kind, mat, speed) {
  const S = SOUND;
  if (!S.ready) return;
  const now = S.ctx.currentTime, last = S.lastBreak[kind] || -9;
  if (now - last < 0.07) return;                                   // пролёты забора подряд: не чаще раза в 70 мс и тише
  S.lastBreak[kind] = now;
  const k = now - last < 0.35 ? 0.55 : 1, g = clamp01(0.35 + speed / 28) * k, R = Math.random;
  if (kind === 'bamboo') { soundShot('wood', g); soundShot('leaves', g * 0.8, 0.1); soundShot('debrisWood', g * 0.6, 0.4 + R() * 0.3); }   // бамбук: сухой треск
  else if (kind === 'palm' || kind === 'tree') {                    // треск ствола, шелест кроны, обломки, кокосы
    soundShot('palm', g); soundShot('leaves', g * 0.8, 0.15); soundShot('debrisWood', g * 0.6, 0.6 + R() * 0.3);
    for (let i = 2 + ((R() * 3) | 0); i > 0; i--) soundShot('thud', g * 0.45, 0.6 + R() * 0.9);
  } else if (kind === 'banana') { soundShot('leaves', g); soundShot('wood', g * 0.45); soundShot('thud', g * 0.4, 0.4 + R() * 0.3); }   // мягкий ствол: шелест и хруст
  else if (kind === 'pole' && mat === 'stone') { soundShot('stone', g); soundShot('crumble', g * 0.8, 0.1); soundShot('fence', g * 0.5, 0.15); }   // бетонный столб: удар, крошка, звон проводов
  else if (kind === 'pole') { soundShot('pole', g); soundShot('pipe', g * 0.7, 0.45 + R() * 0.3); }
  else if (kind === 'scooter') { soundShot('carHit', g * 0.7); soundShot('pipe', g * 0.6, 0.3 + R() * 0.2); }    // скутер: удар по железу, грохот
  else if (kind === 'tent') { soundShot('cloth', g); soundShot('pipe', g * 0.6, 0.25 + R() * 0.2); }      // шатёр: хлопок тента и звон трубок
  else if (kind === 'windsock') { soundShot('pole', g); soundShot('cloth', g * 0.9, 0.05); soundShot('pipe', g * 0.6, 0.6); }
  else if (kind === 'barrel') { soundShot('barrel', g); soundShot('roll', g * 0.5, 0.25); }
  else if (kind === 'barrier') soundShot('wood', g);
  else if ((kind === 'fence' || kind === 'gate') && mat !== 'wood') soundShot('fence', g);
  else if (kind === 'parapet' || mat === 'stone') { soundShot('stone', g); soundShot('crumble', g * 0.8, 0.08); }
  else if (mat === 'wood') { soundShot('wood', g); soundShot('debrisWood', g * 0.5, 0.5); }
  else if (kind === 'rail') { soundShot('rail', g); soundShot('pipe', g * 0.4, 0.5); }
  else soundShot('small', g);
  const light = kind === 'small' || kind === 'fence' || kind === 'gate' || kind === 'rail' || kind === 'woodfence' || kind === 'banana';
  if (speed > 6) soundShot('carHit', clamp01((speed - 6) / 30) * (light ? 0.35 : 0.7) * k);   // удар по кузову — от скорости
}
// упор во что-то твёрдое: v — скорость сближения, м/с. Медленно — тупой толчок, быстро — ещё и удар по кузову
function soundImpact(v) {
  const S = SOUND;
  if (!S.ready || v < 0.8 || S.ctx.currentTime - S.lastImpact < 0.3) return;
  S.lastImpact = S.ctx.currentTime;
  soundShot('bump', clamp01(0.3 + v / 6));
  if (v > 5) soundShot('carHit', clamp01(v / 22));
}
// собран банан или кокос — у каждого свой «дзиньк» (без гуляния высоты: это сигнал, а не шум)
function soundPickup(coco, leaf) { soundShot(leaf ? 'leaf' : coco ? 'coconut' : 'banana', coco ? 0.69 : 0.6, 0, false); }   // кокос на 15 % громче (просил Влад)
// обломок упал в воду
function soundPlop() {
  const S = SOUND;
  if (!S.ready || S.ctx.currentTime - S.lastSplash < 0.25) return;
  S.lastSplash = S.ctx.currentTime;
  soundShot('splashSmall', 0.35);
}

// громкость и выключение: «−», «=», M. Возвращает true, если клавиша была про звук
function soundKeys(e) {
  const S = SOUND;
  if (e.code === 'KeyM') S.muted = !S.muted;
  else if (e.code === 'Minus' || e.code === 'NumpadSubtract') { S.vol = Math.max(0, Math.round((S.vol - 0.1) * 10) / 10); S.muted = false; }
  else if (e.code === 'Equal' || e.code === 'NumpadAdd') { S.vol = Math.min(1, Math.round((S.vol + 0.1) * 10) / 10); S.muted = false; }
  else return false;
  store.set('tg_sfx', S.vol.toFixed(2)); store.set('tg_sfx_off', S.muted ? '1' : '0');
  if (S.master) S.master.gain.setTargetAtTime(S.muted ? 0 : S.vol, S.ctx.currentTime, 0.05);
  S.note = { text: S.muted ? 'SOUND OFF' : 'SOUND ' + Math.round(S.vol * 100), until: performance.now() + 1800 };
  return true;
}
