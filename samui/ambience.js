// Тихий фон — по ТЗ engine_lab/ambience/AMBIENCE_TZ.md: петли цикад, джунглей, ветра, посёлка и ночного рынка плюс
// разовые голоса гекконов. Записи нарезает engine_lab/make_ambience_sounds.py -> ambience_data.js (отрезки без голосов
// и машин, у посёлка и рынка срезан верх — речь в неразборчивый гул, всё приведено к −23 LUFS).
// Главное требование Влада: фон отдалённый и очень тихий — подложка, а не событие. Его слышно на стоянке и на малой
// скорости, на ходу он уходит под мотор. Общая громкость — шина MIX.ambience (тише волн и птиц).
// Время — dayTime игры; место — те же зоны, что у птиц (birdZones в birds.js). Переходы — плавные, за 2–4 с.
// Файл подключается после birds.js; sound.js зовёт ambienceStart() и ambienceUpdate(dt).

const AMB = { loops: {}, data: {}, quiet: {}, loading: {}, shots: {}, next: { tokay: 0, house_gecko: 0 }, active: 0, zones: null, zonesAt: -1, env: null, marks: null, log: [] };   // env — место машины: высота, дорога, рынок, открытость (раз в 1,5 с)
// насколько слышна каждая петля в зоне (берётся наибольшее по зонам, где стоит машина)
const AMB_ZONE = {
  cicada: { forest: 1, thicket: 0.85, plantation: 0.45, field: 0.35, village: 0.22, coast: 0.18 },
  jungle: { forest: 1, thicket: 0.8, plantation: 0.35, field: 0.2, village: 0.12, coast: 0.1 },
};
const AMB_LEVEL = { cicada_dusk: 0.9, cicada_noon: 0.55, jungle_day: 0.8, jungle_night: 0.85, wind: 0.5, village: 0.75, market: 0.8 };   // предел каждой петли

async function ambienceStart() {
  const S = SOUND, D = window.AMBIENCE_DATA;
  if (!D || !S.ctx) return;
  S.busAmb = S.ctx.createGain(); S.busAmb.gain.value = MIX.ambience; S.busAmb.connect(S.lim);
  { const a = S.ctx.createAnalyser(); a.fftSize = 16384; S.busAmb.connect(a); S.busAmb.meter = a; }   // для проверок уровня
  // Петля расшифровывается (в несжатый звук, это десятки МБ на петлю), только когда её должно быть слышно, и уходит из
  // памяти, когда её не слышно уже AMB_FREE секунд (ambLoopNeed). Раньше все петли расшифровывались сразу — около 144 МБ.
  // Ветер слышен всегда — он сразу.
  AMB.data = D.loops;
  if (D.loops.wind) { try { AMB.loops.wind = soundLoop(await soundDecodeNative(D.loops.wind.mp3, true), [0, D.loops.wind.dur], S.busAmb); } catch (e) { /* без ветра */ } }   // петли — моно и в родной частоте (32 кГц): решение Влада
  for (const [k, d] of Object.entries(D.shots)) { try { AMB.shots[k] = { buf: await soundDecodeNative(d.mp3), clips: d.clips }; } catch (e) { /* без этого голоса */ } }
  const now = S.ctx.currentTime; AMB.next.tokay = now + 20 + Math.random() * 60; AMB.next.house_gecko = now + 8 + Math.random() * 20;
}
const AMB_FREE = 30;                     // с — столько петля должна молчать, чтобы уйти из памяти (снова понадобится — расшифруется за доли секунды)
// петля k должна звучать с громкостью v: нет её в памяти — расшифровать и запустить (громкость поднимется плавно, как и
// раньше: петля начинает с нуля); молчит дольше AMB_FREE — остановить и забыть
function ambLoopNeed(k, v, now) {
  const L = AMB.loops, d = AMB.data[k];
  if (v > 0.002) {
    AMB.quiet[k] = now;
    if (!L[k] && d && !AMB.loading[k]) {
      AMB.loading[k] = true;
      soundDecodeNative(d.mp3, true).then((buf) => { L[k] = soundLoop(buf, [0, d.dur], SOUND.busAmb); }).catch(() => { AMB.data[k] = null; }).finally(() => { AMB.loading[k] = false; });
    }
  } else if (L[k] && k !== 'wind' && now - (AMB.quiet[k] || 0) > AMB_FREE) {
    try { L[k].src.stop(); } catch (e) {}
    L[k].src.disconnect(); delete L[k];
  }
}
const ambZone = (tbl) => { let k = 0; for (const z of AMB.zones) if (tbl[z] > k) k = tbl[z]; return k; };
// разовый голос в точке вокруг машины: d — расстояние, м
function ambShot(key, dMin, dMax, level) {
  const S = SOUND, C = AMB.shots[key];
  if (!C || AMB.active >= 2) return;
  const [t0, dur] = C.clips[(Math.random() * C.clips.length) | 0], d = dMin + Math.random() * (dMax - dMin), a = Math.random() * 6.283;
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), g = S.ctx.createGain(), lp = S.ctx.createBiquadFilter(), p = S.ctx.createStereoPanner(), src = S.ctx.createBufferSource();
  lp.type = 'lowpass'; lp.frequency.value = 2000 + 12000 * Math.exp(-d / 50);
  g.gain.value = level / (1 + Math.pow(d / 20, 1.3)); p.pan.value = Math.max(-0.85, Math.min(0.85, Math.cos(a) * -fz + Math.sin(a) * fx));
  src.buffer = C.buf; src.playbackRate.value = 0.97 + Math.random() * 0.06;
  src.connect(g); g.connect(lp); lp.connect(p); p.connect(S.busAmb); src.start(S.ctx.currentTime + 0.02, t0, dur);
  AMB.active++; setTimeout(() => { AMB.active--; g.disconnect(); }, dur * 1050 + 200);
  AMB.log.push({ key, h: +(((dayTime % 24) + 24) % 24).toFixed(2), d: Math.round(d) }); if (AMB.log.length > 40) AMB.log.shift();
}
function ambienceUpdate(dt) {
  const S = SOUND, L = AMB.loops;
  if (!S.busAmb || !L.wind || typeof dayTime === 'undefined' || typeof birdZones !== 'function') return;
  const now = S.ctx.currentTime, h = ((dayTime % 24) + 24) % 24, kmh = Math.abs(car.speed) * 3.6;
  // зоны и место — раз в 1,5 с (зоны берутся у птиц, если те посчитали их только что), а не каждый кадр
  if (now - AMB.zonesAt > 1.5 || !AMB.zones || !AMB.env) {
    const B = typeof BIRDS_ST !== 'undefined' ? BIRDS_ST : null;
    AMB.zones = B && B.zones && now - B.zonesAt < 1.5 && now >= B.zonesAt ? B.zones : birdZones(car.x, car.z); AMB.zonesAt = now;
    if (!AMB.marks) {                                                                         // ночные рынки и чайнатаун Маенама
      AMB.marks = (IS.markets || []).map((m) => [m.x, m.z]);
      if (IS.spots && IS.spots.maenam_china) AMB.marks.push([IS.spots.maenam_china.x, IS.spots.maenam_china.z]);
    }
    let mk = 0;                                                                               // рынок: в 60–150 м от него
    for (const [x, z] of AMB.marks) mk = Math.max(mk, Math.min(1, Math.max(0, (150 - Math.hypot(car.x - x, car.z - z)) / 90)));
    const Z = AMB.zones;
    AMB.env = { gy: groundY(car.x, car.z), road: roadDist(car.x, car.z) < 18 ? 0.7 : 1, mk,   // у самой дороги джунгли тише
      open: Z.has('coast') || Z.has('field') || Z.has('hills') || pierYAt(car.x, car.z) !== null };
  }
  const Z = AMB.zones, W = (win) => birdHourWeight(win, h), move = Math.max(0.4, 1 - kmh / 120);   // на ходу фон уходит под мотор
  const { gy, road, mk, open } = AMB.env;
  const g = {
    cicada_dusk: W([[17.5, 19, 1], [5.25, 6.5, 0.7]]) * ambZone(AMB_ZONE.cicada) * (Z.has('hills') ? 1.25 : 1),
    cicada_noon: W([[11, 15, 1]]) * ambZone(AMB_ZONE.cicada) * (Z.has('hills') ? 1.2 : 1),
    jungle_day: W([[7, 17.5, 1]]) * ambZone(AMB_ZONE.jungle) * road,
    jungle_night: W([[19, 29, 1]]) * ambZone(AMB_ZONE.jungle) * road,
    wind: (0.45 + (open ? 0.35 : 0) + Math.min(0.25, gy / 160 * 0.25)) * (h > 19 || h < 5 ? 0.8 : 1),
    village: Z.has('village') ? W([[5.5, 19.5, 1]]) : 0,
    market: W([[17.5, 23, 1]]) * mk,
  };
  for (const k in g) { const v = Math.min(1, g[k]) * AMB_LEVEL[k] * move; ambLoopNeed(k, v, now); if (L[k]) L[k].gain.setTargetAtTime(v, now, 1.0); }
  // гекконы: токи — раз в 1–4 мин ночью у построек (в лесу реже), домовый — тихое «чк-чк» вечером и ночью у освещённых построек
  if (now > AMB.next.tokay) {
    const k = W([[19.5, 29, 1]]) * (Z.has('village') ? 1 : Z.has('forest') || Z.has('thicket') ? 0.25 : 0);
    if (k > 0.3 && Math.random() < k) ambShot('tokay', 18, 55, 0.8);
    AMB.next.tokay = now + 60 + Math.random() * 180;
  }
  if (now > AMB.next.house_gecko) {
    if (Z.has('village') && W([[18.5, 29.5, 1]]) > 0.5) ambShot('house_gecko', 5, 15, 0.45);
    AMB.next.house_gecko = now + 12 + Math.random() * 23;
  }
}
