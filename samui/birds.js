// Голоса птиц — по ТЗ engine_lab/fauna/BIRDS_TZ.md. Не петля, а разовые голоса: каждые несколько секунд выбирается
// вид, который в этот час поёт в этом месте, и звучит один его фрагмент (1–6 с) в случайной точке вокруг машины,
// в 15–80 м, с панорамой и затуханием по расстоянию. Фрагменты нарезает engine_lab/make_bird_sounds.py -> birds_data.js.
// Время — dayTime игры (солнечное). Место — по точке машины: зоны jungleZone из jungle.js (поле, плантация, заросли,
// лес, берег) плюс посёлок (ряды лавок и домов из roadside.js и towns.js), у воды, пруд, холмы.
// Утром и вечером голосов в 2–3 раза больше, днём меньше, ночью — только ночные виды. На скорости голоса реже.
// Одновременно — не больше BIRD_MAX голосов; громкость — своя шина (MIX.birds в sound.js).
// Файл подключается после sound.js; sound.js зовёт birdsStart() и birdsUpdate(dt).

// вид, окна часов [от, до, множитель] (через полночь — «до» больше 24), где поёт, вес (3 — частый, 2 — средний, 1 — редкий), особенности:
// far — слышен дальше (во сколько раз), near — только рядом, sky — сверху, series — серия повторов [от, до], rest — пауза вида, с
const BIRDS = [
  ['common_myna', [[5.5, 19]], 'village field', 3],
  ['zebra_dove', [[6, 18.5]], 'village plantation field', 3],
  ['spotted_dove', [[6, 18]], 'plantation village', 2],
  ['yellow_vented_bulbul', [[5.75, 18.5]], 'village thicket', 3, { rest: 24 }],          // одна запись — реже
  ['stripe_throated_bulbul', [[6, 18]], 'thicket forest', 2],
  ['oriental_magpie_robin', [[5.25, 7.5], [17.5, 19]], 'village plantation', 3],
  ['asian_koel', [[4.75, 7], [17.5, 19.5]], 'village plantation thicket', 3, { far: 1.7 }],   // главный «тропический» голос, слышен издалека
  ['red_junglefowl', [[4.5, 7.5], [7.5, 17, 0.2]], 'village field', 2],                 // петух: на рассвете, днём изредка
  ['coppersmith_barbet', [[7, 17]], 'plantation village', 2, { series: [2, 4] }],       // монотонное «тонк-тонк» серией
  ['black_naped_oriole', [[6, 17.5]], 'thicket forest plantation', 2],
  ['racket_tailed_drongo', [[6, 18]], 'forest thicket', 2],
  ['green_billed_malkoha', [[7, 17]], 'forest thicket', 1],
  ['oriental_pied_hornbill', [[6.5, 10], [15.5, 18]], 'hills', 1, { far: 1.6 }],
  ['greater_coucal', [[5.5, 8], [17, 19]], 'thicket field', 2],
  ['dark_necked_tailorbird', [[6, 18]], 'plantation thicket village', 2],
  ['common_tailorbird', [[6, 18]], 'plantation thicket village', 2],
  ['olive_backed_sunbird', [[6.5, 17.5]], 'plantation village', 1, { near: true }],
  ['pink_necked_green_pigeon', [[6.5, 17]], 'plantation thicket', 1],
  ['scaly_breasted_munia', [[6.5, 17.5]], 'field', 1],
  ['tree_sparrow', [[6, 18.5]], 'village', 2],
  ['asian_glossy_starling', [[6, 18.5]], 'village', 2],
  ['large_billed_crow', [[6, 18.5]], 'village coast', 1],
  ['blue_tailed_bee_eater', [[7, 17.5]], 'field coast', 1],
  ['pacific_swallow', [[6.5, 18.5]], 'village coast', 1],
  ['brahminy_kite', [[8, 17]], 'coast', 2, { sky: true, far: 1.8 }],
  ['white_bellied_sea_eagle', [[8, 17]], 'coast', 1, { sky: true, far: 1.8 }],
  ['white_throated_kingfisher', [[6, 18]], 'water village', 2],
  ['indochinese_roller', [[6.5, 17.5]], 'field plantation coast', 1],                    // сизоворонка: открытые места, провода вдоль дорог
  ['collared_kingfisher', [[6, 18]], 'coast', 2],
  ['red_wattled_lapwing', [[0, 24]], 'field', 1],                                         // кричит и в темноте
  ['white_breasted_waterhen', [[5.5, 7.5], [17.5, 20]], 'pond water', 1],
  ['large_tailed_nightjar', [[18.5, 29.25]], 'field thicket plantation', 3],               // козодой: главный ночной голос
  ['barn_owl', [[19.5, 28.5]], 'village field', 1],
];
const BIRD_MAX = 4;                        // голосов одновременно
const BIRD_RATE = 0.42;                    // новых голосов в секунду днём; утром и вечером — в BIRD_DAWN раз больше
const BIRD_DAWN = 2.5, BIRD_NIGHT = 0.6;   // ночью темп ниже, а поют только ночные виды
const BIRD_EDGE = 0.4;                     // ч — на краях окна вес спадает плавно (25 мин)
const BIRDS_ST = { clips: {}, active: 0, last: {}, lastClip: '', zones: null, zonesAt: -1, log: [] };   // log — что звучало (для проверок)

// декодировать записи — после того, как запустился звук машины (птицы не задерживают мотор)
async function birdsStart() {
  const S = SOUND, D = window.BIRD_DATA;
  if (!D || !S.ctx) return;
  S.busBirds = S.ctx.createGain(); S.busBirds.gain.value = MIX.birds; S.busBirds.connect(S.lim);
  { const a = S.ctx.createAnalyser(); a.fftSize = 16384; S.busBirds.connect(a); S.busBirds.meter = a; }   // для проверок уровня
  for (const [id, d] of Object.entries(D)) {
    try { BIRDS_ST.clips[id] = { buf: await soundDecode(d.mp3), clips: d.clips }; } catch (e) { /* битая запись — вида просто не будет */ }
  }
}
// где машина: набор зон (пересчитывается раз в полторы секунды)
function birdZones(x, z) {
  const Z = new Set(), h = groundY(x, z), sea = seaDistance(x, z);
  if (typeof jungleZone === 'function') Z.add(['field', 'plantation', 'thicket', 'forest', 'coast'][jungleZone(x, z, h, 0.5)]);
  if (sea < 120) Z.add('coast');
  if (sea < 60) Z.add('water');
  if (h > 40) Z.add('hills');
  for (const w of (typeof waterAreas !== 'undefined' ? waterAreas : [])) if (Math.hypot(w.x - x, w.z - z) < (w.r || 60) + 60) { Z.add('pond'); Z.add('water'); }
  if (typeof fallSounds !== 'undefined') for (const f of fallSounds) if (Math.hypot(f.x - x, f.z - z) < 110) { Z.add('pond'); Z.add('water'); }
  const near = (list, r) => list && list.some((p) => Math.hypot(p[0] - x, p[1] - z) < r);
  if ((typeof RS !== 'undefined' && near(RS.rows, 75)) || near((IS.shops || []).map((s) => [s.x, s.z]), 90) || near((IS.stores || []).map((s) => [s.x, s.z]), 90)) Z.add('village');
  return Z;
}
// вес вида в час h: окна с плавными краями; через полночь — окно до 24+
function birdHourWeight(W, h) {
  let best = 0;
  for (const [a, b, k = 1] of W) for (const hh of [h, h + 24]) {
    const w = Math.min(1, Math.max(0, (hh - a) / BIRD_EDGE + 0.5)) * Math.min(1, Math.max(0, (b - hh) / BIRD_EDGE + 0.5)) * k;
    if (w > best) best = w;
  }
  return best;
}
function birdsUpdate(dt) {
  const S = SOUND, B = BIRDS_ST;
  if (!S.busBirds || !Object.keys(B.clips).length || typeof dayTime === 'undefined') return;
  const now = S.ctx.currentTime, h = ((dayTime % 24) + 24) % 24;
  if (now - B.zonesAt > 1.5) { B.zones = birdZones(car.x, car.z); B.zonesAt = now; }
  // темп: утро и вечер — гуще, ночь — реже; на скорости голоса реже (их и так не слышно за мотором и ветром)
  const dawn = (h > 5 && h < 8.5) || (h > 17 && h < 18.75), night = h > 19.5 || h < 4.5, kmh = Math.abs(car.speed) * 3.6;
  const rate = BIRD_RATE * (dawn ? BIRD_DAWN : night ? BIRD_NIGHT : 1) * Math.max(0.25, Math.min(1, 1 - (kmh - 60) / 60));
  if (B.active >= BIRD_MAX || Math.random() > rate * dt) return;
  // кто сейчас поёт здесь
  const cand = [];
  let sum = 0;
  for (const [id, W, where, w, o = {}] of BIRDS) {
    const C = B.clips[id];
    if (!C || now - (B.last[id] || -99) < (o.rest || (C.clips.length > 1 ? 7 : 20))) continue;
    if (!where.split(' ').some((z) => B.zones.has(z))) continue;
    const k = w * birdHourWeight(W, h);
    if (k > 0.02) { cand.push([id, k, o, C]); sum += k; }
  }
  if (!cand.length) return;
  let r = Math.random() * sum, pick = cand[0];
  for (const c of cand) { r -= c[1]; if (r <= 0) { pick = c; break; } }
  const [id, , o, C] = pick;
  let n = (Math.random() * C.clips.length) | 0;
  if (C.clips.length > 1 && id + n === B.lastClip) n = (n + 1) % C.clips.length;      // тот же фрагмент подряд не звучит
  B.lastClip = id + n; B.last[id] = now;
  // где: случайная точка вокруг машины; у дальних голосов дальше, у тихих — рядом
  const d = o.near ? 8 + Math.random() * 22 : (15 + Math.random() * 65) * (o.far ? 0.8 + Math.random() * (o.far - 0.8) : 1), a = Math.random() * 6.283;
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), dx = Math.cos(a), dz = Math.sin(a);
  const pan = Math.max(-0.9, Math.min(0.9, dx * -fz + dz * fx));                      // вправо от взгляда камеры — правее
  const gain = 1 / (1 + Math.pow(d / 22, 1.3)) * (o.sky ? 1.2 : 1);
  const [t0, dur] = C.clips[n], reps = o.series ? o.series[0] + ((Math.random() * (o.series[1] - o.series[0] + 1)) | 0) : 1;
  const g = S.ctx.createGain(), lp = S.ctx.createBiquadFilter(), p = S.ctx.createStereoPanner();
  lp.type = 'lowpass'; lp.frequency.value = 1800 + 12000 * Math.exp(-d / 70);          // издалека — глуше
  g.gain.value = gain; p.pan.value = pan;
  g.connect(lp); lp.connect(p); p.connect(S.busBirds);
  const rate2 = 0.96 + Math.random() * 0.08;
  let at = now + 0.02;
  for (let i = 0; i < reps; i++) {
    const src = S.ctx.createBufferSource(); src.buffer = C.buf; src.playbackRate.value = rate2;
    src.connect(g); src.start(at, t0, dur); at += dur / rate2 + 0.12 + Math.random() * 0.4;
  }
  B.active++;
  setTimeout(() => { B.active--; g.disconnect(); }, (at - now) * 1000 + 100);
  B.log.push({ id, h: +h.toFixed(2), d: Math.round(d), zones: [...B.zones].join(' ') }); if (B.log.length > 80) B.log.shift();
}
