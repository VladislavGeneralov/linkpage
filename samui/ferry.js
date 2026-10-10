// Паромы Самуи — Панган (refs/ferry_samui_phangan; задача Влада через ресерч-сессию, 2026-10-11 — «от каждого из пирсов,
// с логичным маршрутом»). У каждого из шести пирсов своя линия: судно, причал, манёвр у пирса и порт на Пангане
// (Тхонг Сала или Хаад Рин — за горизонтом).
// Расписание — по игровым часам (сутки = DAY_LEN с): 30 минут у пирса (решение Влада), затем отлучка — путь туда,
// стоянка на Пангане, путь обратно. Цикл у каждой линии свой: дальним пирсам (Тонг Крут, Липа Ной) плыть дольше,
// рейсов меньше; линии сдвинуты по времени, чтобы не отходили разом.
// Движение — настоящее по скорости и ускорениям (Влад: разгон, остановка, маршрут и особенно парковка — реалистичные):
//   у пирса — стоит бортом к пирсу, носом к берегу, чуть покачивается;
//   отход — отжимается от пирса на метр, задним ходом малым ходом выходит за торец, разворачивается на месте
//     и плавно разгоняется до крейсерской; дальше идёт по морю в обход берега и уходит в дымку;
//   возвращение — выходит из дымки, заранее начинает тормозить, по дуге выходит на линию причала, медленно
//     подходит вдоль пирса и без рывка прижимается бортом.
// Маршрут по морю — кратчайший путь по сетке 40 м, который держится не ближе ~350 м от берега (ближе — дороже),
// потом спрямлён и скруглён; обрывается там, где до берега Самуи больше SEA.vanish м (дальше — дымка, судно прячется).
// Видимые части пути заранее просчитаны по шагам (line.out, line.in); положение берётся по времени цикла — при
// перемотке часов паром не дёргается.
// Модели — из boats.js и lomprayah.js (нос по +X; если по −X — model.userData.bow = −1).

const FERRY_PORTS = { thongSala: [9.7116, 99.9968], haadRin: [9.6756, 100.0618] };
// причал — в осях пирса (как moor в piers.js): u — от берега, v — влево, если смотреть в море; судно носом к берегу.
// berth(L, B) — центр судна по его габаритам; out — до какого u отходит задним ходом; off — сдвиг расписания, игровые минуты
const FERRY_LINES = [
  { pier: 'maenam', to: 'thongSala', off: 0, cruise: 20,                          // Lomprayah, Маенам
    model: () => typeof boatLomprayah === 'function' ? boatLomprayah({ L: 30, B: 9 }) : boatCatamaran(),
    berth: (L, B) => [Math.max(43 - L / 2 + 8, 26 + L / 2), -(2.5 + B / 2)], out: (L) => 43 + L / 2 + 22 },
  { pier: 'nathon', to: 'thongSala', off: 45, cruise: 20,                         // Lomprayah, Натон: у северной стороны Т-головы
    model: () => typeof boatLomprayah === 'function' ? boatLomprayah({ L: 30, B: 9 }) : boatCatamaran(),
    berth: (L, B) => [130, 20.5 + B / 2], out: (L) => 136 + L / 2 + 25 },
  { pier: 'lipa_n', to: 'thongSala', off: 80, cruise: 9, acc: 0.25, dec: 0.2,      // автопаром Raja, Липа Ной: у аппарели
    model: () => boatCarFerry({ L: 22, B: 7 }),
    berth: () => [61, -1], out: (L) => 61 + L / 2 + 30 },
  { pier: 'bangrak_a', to: 'haadRin', off: 20, cruise: 18,                         // Seatran Discovery, Банграк: у правого борта головы
    model: () => boatFastFerry({ L: 20, B: 4.6, name: 'SEATRAN' }),
    berth: (L, B) => [54, -(4.5 + 0.5 + B / 2)], out: (L) => 61 + L / 2 + 25 },
  { pier: 'bophut', to: 'haadRin', off: 65, cruise: 18,                            // быстрый катер, Бопхут: у левого борта (справа на пути — лодка с пляжа)
    model: () => boatFastFerry({ L: 14, B: 3.6, hull: '#1f8a6a', bottom: '#0e3a2c', name: 'KOH PHANGAN', px: 0.22 }),
    berth: (L, B) => [22, 1.1 + 0.5 + B / 2], out: (L) => 18 + L / 2 + 25 },
  { pier: 'thong_krut', to: 'thongSala', off: 100, cruise: 22, acc: 0.9, dec: 0.7, // спидбот, Тонг Крут: у западного мола в устье канала
    model: () => boatSpeedboat(seededRandom(41)),
    berth: (L, B) => [146, 4.4 - 0.5 - B / 2], out: (L) => 182 },
];
const FERRY_DOCK = 30, FERRY_LAYOVER = 40;           // игровые минуты: у пирса Самуи; не меньше — «на Пангане»
const SEA = { cell: 40, shallow: -0.3,       /* у острова дно ровное, −0.6 м: суша — всё, что выше −0.3 */ keep: 350, vanish: 1200, field: null };
const FERRIES = [];

// ---------- море для прокладки маршрута: сетка, где вода, и расстояние до берега ----------
function seaField() {
  if (SEA.field) return SEA.field;
  const C = SEA.cell, x0 = -4400, x1 = 8600, z0 = -4600, z1 = 4600;
  const nx = Math.ceil((x1 - x0) / C), nz = Math.ceil((z1 - z0) / C), N = nx * nz;
  const dist = new Float32Array(N), INF = 1e9;
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    let dry = false;                                                    // клетка — суша, если в ней есть хоть камень (шаг рельефа 10 м)
    for (let a = 0; a < 5 && !dry; a++) for (let b = 0; b < 5 && !dry; b++) dry = groundY(x0 + (i + a / 4) * C, z0 + (k + b / 4) * C) > SEA.shallow;
    dist[i * nz + k] = dry ? 0 : INF;
  }
  // расстояние до берега — двухпроходная фаска (почти евклидово)
  const D = C * Math.SQRT2, rel = (i, k, d) => { if (i >= 0 && k >= 0 && i < nx && k < nz) return dist[i * nz + k] + d; return INF; };
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { const j = i * nz + k; dist[j] = Math.min(dist[j], rel(i - 1, k, C), rel(i, k - 1, C), rel(i - 1, k - 1, D), rel(i - 1, k + 1, D)); }
  for (let i = nx - 1; i >= 0; i--) for (let k = nz - 1; k >= 0; k--) { const j = i * nz + k; dist[j] = Math.min(dist[j], rel(i + 1, k, C), rel(i, k + 1, C), rel(i + 1, k + 1, D), rel(i + 1, k - 1, D)); }
  const cellOf = (x, z) => [Math.max(0, Math.min(nx - 1, Math.floor((x - x0) / C))), Math.max(0, Math.min(nz - 1, Math.floor((z - z0) / C)))];
  const at = (x, z) => { const [i, k] = cellOf(x, z); return dist[i * nz + k]; };
  return SEA.field = { C, x0, z0, nx, nz, dist, cellOf, at, center: (i, k) => [x0 + (i + 0.5) * C, z0 + (k + 0.5) * C] };
}
// кратчайший путь по морю от точки a к точке b (у самих концов вода может быть мелкой — там можно)
function seaRoute(a, b) {
  const F = seaField(), { nx, nz, dist, C } = F, N = nx * nz;
  const [ai, ak] = F.cellOf(a[0], a[1]), [bi, bk] = F.cellOf(b[0], b[1]), start = ai * nz + ak, goal = bi * nz + bk;
  const near = (j, i0, k0) => Math.abs(((j / nz) | 0) - i0) <= 2 && Math.abs(j % nz - k0) <= 2;
  const open = (j) => dist[j] > 0 || near(j, ai, ak) || near(j, bi, bk);
  const step = (j) => 1 + 4 * Math.max(0, 1 - dist[j] / SEA.keep);               // у берега путь дороже
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
  const heap = [], push = (j, f) => { heap.push([f, j]); let n = heap.length - 1; while (n) { const p = (n - 1) >> 1; if (heap[p][0] <= heap[n][0]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; n = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let n = 0; for (;;) { const l = 2 * n + 1, r = l + 1; let m = n;
    if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; n = m; } } return top; };
  const hEst = (j) => Math.hypot(((j / nz) | 0) - bi, j % nz - bk) * C;
  g[start] = 0; push(start, hEst(start));
  while (heap.length) {
    const [, j] = pop(); if (shut[j]) continue; shut[j] = 1; if (j === goal) break;
    const i = (j / nz) | 0, k = j % nz;
    for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
      if (!di && !dk) continue; const ii = i + di, kk = k + dk; if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
      const n = ii * nz + kk; if (shut[n] || !open(n)) continue;
      const c = g[j] + (di && dk ? Math.SQRT2 : 1) * C * (step(j) + step(n)) / 2;
      if (c < g[n]) { g[n] = c; from[n] = j; push(n, c + hEst(n)); }
    }
  }
  if (from[goal] < 0) return null;
  const P = []; for (let j = goal; j >= 0; j = from[j]) P.push(F.center((j / nz) | 0, j % nz));
  P.reverse(); P[0] = a.slice(); P[P.length - 1] = b.slice();
  // спрямить: от точки — к самой дальней, до которой отрезок не подходит к берегу ближе, чем концы
  // (суша допустима только у самих концов пути — у пирса и у Пангана)
  const clear = (p, q) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), need = Math.min(SEA.keep * 0.7, F.at(p[0], p[1]) * 0.8, F.at(q[0], q[1]) * 0.8);
    for (let s = 0; s <= L; s += C / 4) { const t = s / L, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t, d = F.at(x, z);
      if (d < need || d === 0 && Math.hypot(x - a[0], z - a[1]) > C * 3 && Math.hypot(x - b[0], z - b[1]) > C * 3) return false; } return true; };
  const S = [P[0]];
  for (let i = 0; i < P.length - 1;) { let j = P.length - 1; while (j > i + 1 && !clear(P[i], P[j])) j--; S.push(P[j]); i = j; }
  // скруглить углы (Чайкин, концы на месте); срез у угла — не дальше 80 м, иначе дуга на длинных отрезках задевает берег
  let R = S;
  for (let it = 0; it < 3; it++) { const Q = [R[0]]; for (let i = 0; i < R.length - 1; i++) { const p = R[i], q = R[i + 1], t = Math.min(0.25, 80 / (Math.hypot(q[0] - p[0], q[1] - p[1]) || 1));
    if (i > 0) Q.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); if (i < R.length - 2) Q.push([q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t]); } Q.push(R[R.length - 1]); R = Q; }
  return R;
}
// путь до места, где Самуи скрывается в дымке (там судно прячется)
function seaCutAtHaze(P) {
  const F = seaField(), R = [P[0]];
  for (let i = 1; i < P.length; i++) {
    const p = P[i - 1], q = P[i], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    for (let s = 10; s < L; s += 10) { const x = p[0] + (q[0] - p[0]) * s / L, z = p[1] + (q[1] - p[1]) * s / L; if (F.at(x, z) >= SEA.vanish) { R.push([x, z]); return R; } }
    R.push(q);
  }
  return R;
}

// шаги движения: [x, z, курс носа (рад, 0 — +X мира, по часовой к +Z), скорость]
function ferrySampler(dt) {
  const S = [];
  return {
    S,
    push(x, z, h, v) { S.push([x, z, h, v]); },
    // ход по ломаной P (точки мира) от скорости v0 до v1, не быстрее vmax, ускорения acc / dec; back — кормой вперёд
    along(P, v0, v1, vmax, acc, dec, back = false) {
      const seg = []; let L = 0; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(l); L += l; }
      let s = 0, v = v0;
      const at = (s) => { let i = 0, a = s; while (i < seg.length - 1 && a > seg[i]) { a -= seg[i]; i++; } const t = Math.min(1, a / (seg[i] || 1)), p = P[i], q = P[i + 1];
        return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, Math.atan2(q[1] - p[1], q[0] - p[0])]; };
      while (s < L - 1e-3) {
        const left = L - s, need = (v * v - v1 * v1) / (2 * dec);                                    // пора тормозить?
        v = left <= need ? Math.max(v1, v - dec * dt) : Math.min(vmax, v + acc * dt);
        v = Math.max(v, 0.05); s = Math.min(L, s + v * dt);
        const [x, z, h] = at(s); S.push([x, z, back ? h + Math.PI : h, back ? -v : v]);
      }
    },
    // разворот на месте от курса h0 к h1 (кратчайшим путём), с плавным началом и концом
    turn(x, z, h0, h1, rate) {
      let d = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)); const T = Math.abs(d) / rate;
      for (let t = 0; t < T; t += dt) { const k = t / T, e = k * k * (3 - 2 * k); S.push([x, z, h0 + d * e, 0]); }
    },
    // боковой сдвиг на месте (отжаться от пирса / прижаться к нему) за время T
    slide(a, b, h, T) { for (let t = 0; t < T; t += dt) { const k = t / T, e = k * k * (3 - 2 * k); S.push([a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, h, 0]); } },
    // курс по ломаной меняется скачками на её стыках — сглаживается окном в 1 с (корпус поворачивает плавно)
    smoothHeading(win = 10) {
      const H = [S[0][2]]; for (let i = 1; i < S.length; i++) H.push(H[i - 1] + Math.atan2(Math.sin(S[i][2] - H[i - 1]), Math.cos(S[i][2] - H[i - 1])));
      for (let i = 0; i < S.length; i++) { let sum = 0, n = 0; for (let j = Math.max(0, i - win); j <= Math.min(S.length - 1, i + win); j++) { sum += H[j]; n++; } S[i][2] = sum / n; }
    },
  };
}
function buildFerry() {
  for (const spec of FERRY_LINES) {
    try { const f = buildFerryLine(spec); if (f) FERRIES.push(f); }
    catch (e) { console.warn('паром ' + spec.pier + ':', e); }
  }
  if (FERRIES.length) airportAnim.push(updateFerry);
}
function buildFerryLine(spec) {
  const P = IS.piers && IS.piers[spec.pier]; if (!P) return null;
  const ship = spec.model(), bow = ship.userData.bow || 1;
  const bb = new THREE.Box3().setFromObject(ship), Lb = bb.max.x - bb.min.x, Bb = bb.max.z - bb.min.z;
  const cruise = spec.cruise, acc = spec.acc || 0.6, dec = spec.dec || 0.45;
  // оси пирса: u — от берега в море, v — влево (как в piers.js)
  const a = [Math.cos(P.az), Math.sin(P.az)], n = [Math.sin(P.az), -Math.cos(P.az)];
  const W = (u, v) => [P.x + a[0] * u + n[0] * v, P.z + a[1] * u + n[1] * v];
  const shore = Math.atan2(-a[1], -a[0]);                                                         // нос к берегу
  const [uB, vB] = spec.berth(Lb, Bb), push = vB < 0 ? -1.2 : 1.2, uOut = spec.out(Lb);
  const B = W(uB, vB), B1 = W(uB, vB + push), R = W(uOut, vB + push), A = W(uOut + 60, vB + push);   // у пирса; отжался; вышел за торец; точка захода
  const port = pierXZ(...FERRY_PORTS[spec.to]);
  const routeOut = seaRoute(R, port), routeIn = seaRoute(A, port);
  if (!routeOut || !routeIn) { console.warn('паром ' + spec.pier + ': нет пути по морю'); return null; }
  const dt = 0.05, f = { spec, ship, bow, dt, berth: [B[0], B[1], shore] };
  // туда: отжаться, задним ходом за торец, разворот по ходу, разгон и уход в дымку
  { const T = ferrySampler(dt), way = seaCutAtHaze(routeOut);
    const h1 = Math.atan2(way[Math.min(way.length - 1, 3)][1] - R[1], way[Math.min(way.length - 1, 3)][0] - R[0]);
    T.slide(B, B1, shore, 6);
    T.along([B1, R], 0, 0, 1.8, 0.15, 0.15, true);
    T.turn(R[0], R[1], shore, h1, 0.12);
    T.along(way, 0, cruise, cruise, acc, dec);
    T.smoothHeading(); f.out = T.S; }
  // обратно: из дымки, торможение заранее, дуга на линию причала, медленно вдоль пирса, прижаться бортом
  { const T = ferrySampler(dt), way = seaCutAtHaze(routeIn).reverse();
    // хвост пути (последние ~250 м до точки захода) заменяется дугой, которая выходит на линию причала по ходу к берегу
    let s = 0, k = way.length - 1; while (k > 1 && s < 250) { s += Math.hypot(way[k][0] - way[k - 1][0], way[k][1] - way[k - 1][1]); k--; }
    const V = way[k], d = [way[k][0] - way[k - 1][0], way[k][1] - way[k - 1][1]], dl = Math.hypot(...d) || 1;
    const C1 = [V[0] + d[0] / dl * 90, V[1] + d[1] / dl * 90], C2 = [A[0] + a[0] * 120, A[1] + a[1] * 120], arc = [];
    for (let j = 0; j <= 40; j++) { const t = j / 40, m = 1 - t; arc.push([m * m * m * V[0] + 3 * m * m * t * C1[0] + 3 * m * t * t * C2[0] + t * t * t * A[0], m * m * m * V[1] + 3 * m * m * t * C1[1] + 3 * m * t * t * C2[1] + t * t * t * A[1]]); }
    T.along(way.slice(0, k).concat(arc), cruise, 2.0, cruise, acc, dec);
    T.along([A, B1], 2.0, 0, 2.0, 0.05, 0.05);
    T.slide(B1, B, shore, 7);
    T.smoothHeading(); f.in = T.S; }
  f.tOut = f.out.length * dt; f.tIn = f.in.length * dt;
  // цикл: стоянка + оба видимых пути + стоянка на Пангане, с округлением до получаса
  const sec2min = 1440 / DAY_LEN;
  f.dock = FERRY_DOCK;
  f.cycle = Math.max(120, Math.ceil((FERRY_DOCK + (f.tOut + f.tIn) * sec2min + FERRY_LAYOVER) / 30) * 30);
  f.win = (f.cycle - f.dock) / sec2min;
  // кильватер: две пенные полосы за кормой, видны на ходу
  { const mat = new THREE.MeshBasicMaterial({ color: 0xf4f8f8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), w = new THREE.Group(), wide = Math.min(1.4, Bb * 0.16);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(geo, mat); m.position.set(-bow * (Lb / 2 + 12), 0.06, s * Bb * 0.32); m.scale.set(24, 1, wide); m.rotation.y = s * 0.05; w.add(m); }
    ship.add(w); f.wake = { w, mat, Lb }; }
  scene.add(ship);
  return f;
}
// где паром сейчас: по игровым часам
function ferryState(f) {
  const min = (dayTime * 60 + f.spec.off) % f.cycle;                                                 // минута цикла
  if (min < f.dock) return { x: f.berth[0], z: f.berth[1], h: f.berth[2], v: 0, docked: true };
  const t = (min - f.dock) * DAY_LEN / 1440;                                                          // с отлучки, настоящие секунды
  const pick = (S, t) => { const i = Math.min(S.length - 1, Math.max(0, t / f.dt)), i0 = Math.floor(i), i1 = Math.min(S.length - 1, i0 + 1), k = i - i0, p = S[i0], q = S[i1];
    const dh = Math.atan2(Math.sin(q[2] - p[2]), Math.cos(q[2] - p[2])); return { x: p[0] + (q[0] - p[0]) * k, z: p[1] + (q[1] - p[1]) * k, h: p[2] + dh * k, v: p[3] + (q[3] - p[3]) * k }; };
  if (t < f.tOut) return pick(f.out, t);
  if (t > f.win - f.tIn) return pick(f.in, t - (f.win - f.tIn));
  return null;                                                                                        // на Пангане
}
function updateFerry(now) {
  for (const f of FERRIES) {
    const st = ferryState(f), ship = f.ship;
    if (!st) { ship.visible = false; continue; }
    ship.visible = true;
    const ph = f.spec.off * 0.37, bob = Math.sin(now * 1.3 + ph) * 0.06 + Math.sin(now * 0.7 + 1 + ph) * 0.04, sp = Math.abs(st.v);
    ship.position.set(st.x, bob + Math.min(0.35, sp * 0.015), st.z);                                  // на ходу корпус приподнимается
    ship.rotation.set(0, -(st.h + (f.bow < 0 ? Math.PI : 0)), 0);
    ship.rotateZ(f.bow * (Math.min(0.05, sp * 0.0025) + Math.sin(now * 0.9 + ph) * 0.008));             // нос чуть выше на скорости, лёгкая качка
    ship.rotateX(Math.sin(now * 1.1 + 2 + ph) * 0.012);
    const w = f.wake; w.mat.opacity = Math.min(0.55, Math.max(0, (sp - 2) / 14) * 0.55);
    for (const m of w.w.children) m.scale.x = 8 + sp * 1.4, m.position.x = -f.bow * (w.Lb / 2 + (8 + sp * 1.4) / 2);
  }
}
