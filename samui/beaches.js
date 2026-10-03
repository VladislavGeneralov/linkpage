// Пляжи-объекты: Чавенг и Ламай (refs/chaweng_beach, refs/lamai_beach).
// Где пляж и какая под ним земля — решает сборщик острова (ISLAND.beaches: точки кромки воды через 6 м с нормалью
// вглубь суши; песок 34 м, за ним ровная терраса). Здесь — то, что на нём стоит. Пляж делится на участки по 54 м,
// на каждом — что-то своё: бар или ресторан на террасе и два ряда шезлонгов с зонтами, бунгало под оранжевой черепицей,
// лодки-длиннохвостки, гидроциклы, либо просто песок.
//   Чавенг — почти белый песок, шезлонги с синими подушками, бары под белыми тентами, трёхэтажные корпуса отелей;
//   Ламай  — желтовато-бежевый песок, белые шезлонги с красными зонтами, рестораны под соломой, павильон-сала на сваях.
// Пальмы за пляжем вырастают сами (береговая зона в jungle.js). Шезлонги, зонты и гидроциклы — разрушаемые,
// постройки и лодки — твёрдые.
// Оси участка: +X — вдоль берега, +Z — к морю, y — вверх. Файл только объявляет функции; игра зовёт buildBeaches().

const BEACH_SAND = { chaweng: '#f4eedd', lamai: '#dccb9c', maenam: '#ead9a8', nathon: '#e2cf9e', bophut: '#e6d3a0', choeng_mon: '#f6f1e4', silver: '#f3eee2' };       // цвет песка (подмешивается в цвет земли)

// постройка на террасе: S — сборщик, y0 — уровень террасы. Возвращают [ширина, глубина] для стен
function beachTentBar(S, y0) {                                       // Чавенг: подиум, стойка, белый тент-мембрана, колонки
  const W = 13, D = 7.5, F = y0 + 0.5;
  S.box(W, 0.5, D, 0, y0 + 0.25, 0, '#8a6a4a'); for (let x = -W / 2 + 0.5; x < W / 2; x += 1) S.box(0.06, 0.02, D, x, F + 0.01, 0, '#6f543a');
  S.box(W - 3, 0.25, 0.9, 0, y0 + 0.12, D / 2 + 0.45, '#8a6a4a');                               // ступень к песку
  S.box(5.5, 1.1, 0.9, -2.5, F + 0.55, -2.2, '#3a2a22'); S.box(5.7, 0.08, 1.1, -2.5, F + 1.14, -2.2, '#d8c8a8');
  S.box(5.5, 2.2, 0.3, -2.5, F + 1.1, -3.4, '#2a2622'); for (let i = 0; i < 8; i++) S.box(0.22, 0.4, 0.2, -4.8 + i * 0.65, F + 1.5 + (i % 2) * 0.5, -3.2, ['#e8c82a', '#3aa85a', '#d84a3a', '#f2f2ee'][i % 4]);
  for (let i = 0; i < 4; i++) S.tube(-4.4 + i * 1.3, F, F + 0.75, -1.2, 0.18, 0.2, '#f2f2ee', 6);  // табуреты
  for (const [x, z] of [[-6, -3.3], [6, -3.3], [-6, 3.3], [6, 3.3], [0, -3.3], [0, 3.3]]) S.box(0.14, 3.6, 0.14, x, F + 1.8, z, '#d8dade');
  for (const cx of [-3.1, 3.1]) { S.hip(cx, 0, 3.6, 4.1, F + 3.3, 0.1, 0.1, F + 5.0, (i) => i % 2 ? '#f6f6f2' : '#e2e2dc'); }
  for (const x of [3.6, 5.2]) S.box(0.9, 1.5, 0.8, x, F + 0.75, -2.9, '#161618');                 // колонки
  for (const [x, z] of [[2.5, 0.8], [4.8, 1.6], [3.4, -0.8]]) { S.tube(x, F, F + 0.7, z, 0.45, 0.45, '#f2f2ee', 8); S.box(0.5, 0.45, 0.5, x + 0.9, F + 0.22, z, '#2b4998'); }
  return [W, D];
}
function beachThatchCafe(S, y0) {                                    // Ламай: терраса, столики, двухъярусная соломенная крыша
  const W = 12, D = 8, F = y0 + 0.6;
  S.box(W, 0.6, D, 0, y0 + 0.3, 0, '#b9a88a'); for (let i = 0; i < 3; i++) S.box(4, 0.2, 0.4, 0, y0 + 0.5 - i * 0.2, D / 2 + 0.2 + i * 0.4, '#a89878');
  for (const x of [-5.5, -1.8, 1.8, 5.5]) for (const z of [-3.5, 3.5]) S.box(0.2, 2.9, 0.2, x, F + 1.45, z, '#5a4030');
  for (let k = 0; k < 2; k++) S.hip(0, 0, W / 2 + 1.4 - k * 2.6, D / 2 + 1.4 - k * 1.9, F + 2.7 + k * 1.05, W / 2 - 1.2 - k * 2.2, D / 2 - 0.5 - k * 1.3, F + 3.75 + k * 0.95, (i) => ['#b09a6a', '#9f8a5c', '#bca676', '#a8925f'][(i + k) % 4]);
  S.hip(0, 0, 1.4, 1.2, F + 4.7, 0.2, 0.05, F + 5.6, '#8a7650');
  S.hip(0, 0, W / 2 + 1.4, D / 2 + 1.4, F + 2.5, W / 2 + 1.4, D / 2 + 1.4, F + 2.7, '#6f5f42');
  S.box(4, 1.1, 0.8, -3.5, F + 0.55, -3, '#5a4030'); S.box(4, 2.2, 0.3, -3.5, F + 1.1, -3.6, '#3a2a22');
  for (const [x, z] of [[-3.5, 1.2], [0, 0.4], [3.4, 1.4], [3.2, -1.8]]) { S.box(1.1, 0.07, 1.1, x, F + 0.75, z, '#d8c8a8'); S.box(0.1, 0.75, 0.1, x, F + 0.37, z, '#5a4030'); for (const dx of [-0.9, 0.9]) S.box(0.45, 0.45, 0.45, x + dx, F + 0.22, z, '#c8402c'); }
  return [W, D];
}
function beachBungalow(S, x, y0, wall) {                             // домик под оранжево-красной черепицей, с верандой
  S.box(6.4, 0.5, 6.6, x, y0 + 0.25, 0.3, '#b9b4a8');
  S.box(6, 2.8, 5, x, y0 + 1.9, -0.5, wall);
  S.box(1.0, 2.0, 0.08, x - 1.4, y0 + 1.5, 2.02, '#3a2a22'); S.box(1.6, 1.2, 0.08, x + 1.3, y0 + 1.9, 2.02, '#3e4858');
  for (const dx of [-2.9, 2.9]) S.box(0.14, 2.6, 0.14, x + dx, y0 + 1.8, 3.2, '#f2f2ee');
  S.hip(x, 0.3, 3.9, 4.1, y0 + 3.2, 1.9, 2.0, y0 + 4.3, (i) => i % 2 ? '#bd5d41' : '#a84e36'); S.hip(x, 0.3, 1.9, 2.0, y0 + 4.3, 0.3, 0.05, y0 + 5.1, (i) => i % 2 ? '#c96a4c' : '#b3573d');
}
function beachHotel(S, y0) {                                         // Чавенг: белый трёхэтажный корпус с балконами
  const W = 20, D = 9, Fh = 3.1;
  S.box(W, Fh * 3, D, 0, y0 + Fh * 1.5, 0, '#eef0ee'); S.box(W + 0.4, 0.4, D + 0.4, 0, y0 + Fh * 3 + 0.2, 0, '#d8dad6');
  for (let f = 0; f < 3; f++) {
    const y = y0 + f * Fh;
    S.box(W, 0.14, 1.3, 0, y + 0.07 + (f ? 0 : 0.2), D / 2 + 0.65, '#d8dad6');
    for (let i = 0; i < 5; i++) { const x = -W / 2 + 2 + i * 4; S.box(2.6, 2.1, 0.08, x, y + 1.3, D / 2 + 0.02, '#3e4858'); S.box(0.08, 2.1, 0.1, x, y + 1.3, D / 2 + 0.03, '#d8dade'); if (f) { S.box(3.6, 0.06, 0.06, x, y + 1.0, D / 2 + 1.25, '#9aa0a6'); S.box(3.6, 0.5, 0.04, x, y + 0.5, D / 2 + 1.25, '#bcd0d8'); } }
  }
  for (const x of [-6, 4]) S.tube(x, y0 + Fh * 3 + 0.4, y0 + Fh * 3 + 1.7, -2, 0.6, 0.6, '#2f5f9a', 8);
  return [W, D];
}
function beachSala(S, y0) {                                          // Ламай: павильон-сала на сваях под двухъярусной крышей
  const F = y0 + 0.9;
  for (const x of [-2.6, 0, 2.6]) for (const z of [-2.6, 0, 2.6]) S.box(0.28, 0.9, 0.28, x, y0 + 0.45, z, '#b4b1b0');
  S.box(6, 0.18, 6, 0, F, 0, '#c9c5bb');
  for (let i = 0; i < 5; i++) S.box(1.8, 0.18, 0.34, 0, F - 0.18 - i * 0.18, 3.2 + i * 0.34, '#b4b1b0');   // лестница к морю
  for (const [x0, z0, x1, z1] of [[-2.9, -2.9, 2.9, -2.9], [-2.9, -2.9, -2.9, 2.9], [2.9, -2.9, 2.9, 2.9], [-2.9, 2.9, -1.1, 2.9], [1.1, 2.9, 2.9, 2.9]]) {
    S.rod([x0, F + 0.95, z0], [x1, F + 0.95, z1], 0.1, '#f2f2ee');
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.5)); for (let i = 0; i <= n; i++) S.box(0.08, 0.9, 0.08, x0 + (x1 - x0) * i / n, F + 0.5, z0 + (z1 - z0) * i / n, '#f2f2ee');
  }
  for (const x of [-2.8, 2.8]) for (const z of [-2.8, 2.8]) S.box(0.24, 3, 0.24, x, F + 1.5, z, '#e8e4da');
  S.hip(0, 0, 4.4, 4.4, F + 2.9, 2.0, 2.0, F + 3.9, (i) => i % 2 ? '#8a4f4c' : '#7e4b49'); S.box(3.2, 0.5, 3.2, 0, F + 4.05, 0, '#e8e4da');
  S.hip(0, 0, 2.3, 2.3, F + 4.3, 0.1, 0.1, F + 5.6, (i) => i % 2 ? '#96585a' : '#7e4b49'); S.tube(0, F + 5.6, F + 6.5, 0, 0.08, 0.01, '#d8b24a', 5);
  return [6, 6];
}
function jetSki(color) {
  const S = sculptor();
  S.house(-1.5, 1.5, 0.15, 0.6, 0.55, 0.42, 0.9, 0.3, color); S.box(2.8, 0.2, 1.05, 0, 0.14, 0, '#f2f2ee');
  S.box(1.2, 0.2, 0.4, -0.4, 0.72, 0, '#1c1c1e'); S.box(0.3, 0.5, 0.5, 0.55, 0.85, 0, color); S.box(0.08, 0.08, 0.8, 0.6, 1.1, 0, '#2a2a2c');
  return S.mesh();
}

// Подпорная стенка у пляжа, где дорога выше песка (Натон): вдоль кольцевой со стороны моря — бетонный тротуар на уровне
// дороги и вертикальные плиты, уходящие вниз, в песок. Стенка твёрдая; по тротуару можно ехать.
function beachSeawall(Bc) {
  const R = roads[0], pts = Bc.pts, N = pts.length, CUT = 8;                          // без 48 м у концов пляжа: там он сходит на нет
  const sAt = (i) => { const [x, z, nx, nz, dr] = pts[i], q = roadProj(0, x + nx * (dr + 3), z + nz * (dr + 3)); return q ? q.s : null; };
  const sA = sAt(CUT), sB = sAt(N - 1 - CUT);
  if (sA === null || sB === null || Math.abs(sB - sA) > 400) return;
  const mid = pts[N >> 1], sM = (sA + sB) / 2, pr = roadPoint(R, sM, 9), pl = roadPoint(R, sM, -9);
  const side = Math.hypot(pr[0] - mid[0], pr[1] - mid[1]) < Math.hypot(pl[0] - mid[0], pl[1] - mid[1]) ? 1 : -1;      // с какой стороны от оси море
  const S = sculptor(), SLAB = 2.5, n = Math.max(2, Math.round(Math.abs(sB - sA) / SLAB)), O0 = halfR + 0.05, O1 = 10.2, O2 = 10.55, TOP = 0.55;   // тротуар — от самой кромки асфальта
  const WALK = ['#a6a299', '#9c988f'], PLATE = ['#b4b0a6', '#a9a59b', '#bcb8ae'];
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const s = Math.min(sA, sB) + Math.abs(sB - sA) * i / n, at = (o) => { const p = roadPoint(R, s, side * o); return [p[0], p[1]]; };
    const c = at(0), y = asphaltTop(c[0], c[1]) + 0.02, a = at(O0), b = at(O1), w = at(O2), low = Math.min(groundY(...at(O2 + 0.4)), groundY(...at(O2 + 2)), groundY(...at(O2 + 4))) - 0.6;
    const cur = { a: [a[0], y, a[1]], b: [b[0], y, b[1]], bt: [b[0], y + TOP, b[1]], wt: [w[0], y + TOP, w[1]], wl: [w[0], low, w[1]], w, b2: b };
    if (prev) {
      S.quad(prev.a, cur.a, cur.b, prev.b, WALK[i % 2]);                                // тротуар
      { const k = 0.45 / (O1 - O0), ka = (q) => [q.a[0] + (q.b[0] - q.a[0]) * k, q.a[1] + 0.012, q.a[2] + (q.b[2] - q.a[2]) * k], ya = (q) => [q.a[0], q.a[1] + 0.012, q.a[2]];
        S.quad(ya(prev), ya(cur), ka(cur), ka(prev), i % 2 ? '#d8d6cf' : '#c8302a'); }               // бордюр: бело-красный, как на набережной
      S.quad(prev.b, cur.b, cur.bt, prev.bt, '#b0aca2'); S.quad(prev.bt, cur.bt, cur.wt, prev.wt, '#c4c0b6');      // парапет: внутренняя грань и верх
      S.quad(prev.wt, cur.wt, cur.wl, prev.wl, PLATE[i % 3]);                           // плита — лицом к морю
      S.quad([cur.w[0], y + TOP, cur.w[1]], [cur.w[0] + 0.001, y + TOP, cur.w[1] + 0.001], [prev.w[0] * 0.03 + cur.w[0] * 0.97, low, prev.w[1] * 0.03 + cur.w[1] * 0.97], cur.wl, '#77746c');   // шов между плитами
      walls.push([prev.b2[0], prev.b2[1], cur.b2[0], cur.b2[1]]);
      // тротуар проезжий: плита на уровне дороги между обочиной и парапетом
      const m0 = [(prev.a[0] + prev.b[0]) / 2, (prev.a[2] + prev.b[2]) / 2], m1 = [(cur.a[0] + cur.b[0]) / 2, (cur.a[2] + cur.b[2]) / 2], L = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]) || 1;
      const hu = L / 2 + 0.25, hv = (O1 - O0) / 2 + 0.1;
      pierPlates.push({ cx: (m0[0] + m1[0]) / 2, cz: (m0[1] + m1[1]) / 2, ux: (m1[0] - m0[0]) / L, uz: (m1[1] - m0[1]) / L, hu, hv, hv1: hv, y0: prev.a[1], y1: y, ramp: false, r: (hu + hv + 3) ** 2 });
    } else { S.quad(cur.b, cur.bt, cur.wt, [w[0], y, w[1]], '#b0aca2'); S.quad([w[0], y, w[1]], cur.wt, cur.wl, [b[0], low, b[1]], '#9c988f'); }      // торец
    prev = cur;
  }
  S.quad(prev.b, prev.bt, prev.wt, [prev.w[0], prev.b[1], prev.w[1]], '#b0aca2');
  scene.add(S.mesh());
}
function buildBeaches() {
  if (!IS.beaches) return;
  for (const Bc of IS.beaches) {
    if (Bc.full) {                                                      // песок до самой дороги: ни травы, ни кустов, ни леса — только то, что посажено нарочно
      const m = Bc.pts[Bc.pts.length >> 1], r = Bc.pts.length * 3 + 180;
      vegKeepOut.push(Object.assign((x, z) => !!beachSand.full(x, z), { c: [m[0], m[1], r] }));
    }
    if (Bc.wall) beachSeawall(Bc);
    if (Bc.plain && Bc.full) {                                          // редкие кокосовые пальмы на песке
      const rnd = seededRandom(977);
      Bc.pts.forEach(([x, z, nx, nz, dr], i) => { if (i % 3 === 1 && dr > 34) { const d = 12 + rnd() * (dr - 28), a = (rnd() - 0.5) * 8; VEG_EXTRA.push([x + nx * d - nz * a, z + nz * d + nx * a, 'coconut']); } });
    }
    if (Bc.plain) { if (Bc.id === 'bophut' || Bc.id === 'maenam') beachLight(Bc); continue; }   // простой пляж: песок; у Бопхута и Маенама — подушки, бары, лодки
    if (Bc.id === 'silver') { beachSilver(Bc); continue; }               // Силвер-бич: валуны и немного шезлонгов
    // Чонг Мон — как Чавенг: белый песок, курорты, шезлонги с синими подушками (refs/beach_choeng_mon)
    const pts = Bc.pts, N = pts.length, chaweng = Bc.id === 'chaweng' || Bc.id === 'choeng_mon', rnd = seededRandom({ chaweng: 2307, lamai: 1858, choeng_mon: 3109 }[Bc.id] || 1858);
    const frame = (i) => { const [x, z, nx, nz] = pts[Math.max(0, Math.min(N - 1, i))]; return { x, z, nx, nz, tx: nz, tz: -nx }; };   // t — вдоль берега, n — вглубь суши
    const W = (f, a, d) => [f.x + f.tx * a + f.nx * d, f.z + f.tz * a + f.nz * d];
    // группа участка: +X — вдоль берега, +Z — к морю
    const groupAt = (f, d) => { const [x, z] = W(f, 0, d), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-f.nx, -f.nz); scene.add(g); g.updateMatrixWorld(true); g.userData.c = new THREE.Vector3(x, 0, z); pierGroups.push(g); return g; };
    const solid = (f, d, S, dims, r) => {                                 // постройка на террасе: стены и запрет для леса
      S.box(dims[0], 1.4, dims[1], 0, groundY(...W(f, 0, d)) - 0.68, 0, '#a89878');   // фундамент: под постройкой земля может идти под уклон
      const g = groupAt(f, d); g.add(S.mesh()); wallBox(g, 0, 0, dims[0], dims[1]);
      const [x, z] = W(f, 0, d); vegKeepOut.push(Object.assign(() => true, { c: [x, z, r] }));
    };
    let salaDone = chaweng;
    for (let i = 9; i + 9 < N - 8; i += 9) {
      const f = frame(i + 4), roll = rnd(), B = propBatch();
      // сколько места до дороги: где дорога подходит к воде близко, постройка сдвигается к песку или не ставится вовсе
      let room = 99; for (let d = 18; d < 74; d += 2) { const q = W(f, 0, d); if (roadDist(q[0], q[1]) < halfS + 2) { room = d; break; } }
      const bd = Math.min(50, room - 13), canBuild = bd >= 33, y50 = groundY(...W(f, 0, bd));
      const lounger = (a, d, cushion, frameCol) => {                      // шезлонг ногами к морю
        const [x, z] = W(f, a, d), y = groundY(x, z), yaw = Math.atan2(-f.nz, f.nx), it = B.begin();   // длинная ось — по нормали к берегу
        B.box(x, y + 0.3, z, 1.9, 0.08, 0.66, yaw, frameCol); B.box(x - f.nx * 0.1, y + 0.37, z - f.nz * 0.1, 1.5, 0.08, 0.58, yaw, cushion);
        B.box(x + f.nx * 0.8, y + 0.52, z + f.nz * 0.8, 0.5, 0.36, 0.6, yaw, cushion);            // поднятая спинка
        for (const k of [-0.75, 0.75]) B.box(x + f.nx * k, y + 0.15, z + f.nz * k, 0.08, 0.3, 0.6, yaw, frameCol, false);
        B.end({ kind: 'small', mat: 'wood', x, z, r: 0.75, loss: 0.02 });
      };
      const umbrella = (a, d, color) => {
        const [x, z] = W(f, a, d), y = groundY(x, z), it = B.begin();
        B.box(x, y + 1.1, z, 0.07, 2.2, 0.07, 0, '#e8e4da');
        for (let k = 0; k < 8; k++) { const a0 = k / 8 * 6.283, a1 = (k + 1) / 8 * 6.283; B.quad([x, y + 2.45, z], [x + Math.cos(a0) * 1.2, y + 2.0, z + Math.sin(a0) * 1.2], [x + Math.cos(a1) * 1.2, y + 2.0, z + Math.sin(a1) * 1.2], [x, y + 2.45, z], k % 2 ? color : (chaweng ? '#f2f2ee' : color)); }
        it.boxes.push([x, y + 2.2, z, 1.6, 0.06, 1.6, 0, new THREE.Color(color).getHex()]);
        B.end({ kind: 'small', mat: 'wood', x, z, r: 0.2, loss: 0.02 });
      };
      const rows = (n, ds) => { for (const d of ds) if (groundY(...W(f, 0, d)) < 1.25 && d < room - 9) for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * 2.5; lounger(a, d, chaweng ? '#2b4998' : '#f2f2ee', chaweng ? '#4a3626' : '#e8e8e4'); if (k % 2 === 0 && d === ds[0]) umbrella(a + 1.25, d + 2, chaweng ? '#2b4998' : '#b8323e'); } };
      if (!salaDone && i > N * 0.62 && canBuild) {                        // сала — в северной части Ламая
        salaDone = true; const S = sculptor(); solid(f, bd - 3, S, beachSala(S, groundY(...W(f, 0, bd - 3))), 7);
      } else if (roll < 0.42) {                                           // бар или ресторан и два ряда шезлонгов
        if (canBuild) { const S = sculptor(); solid(f, bd, S, chaweng ? beachTentBar(S, y50) : beachThatchCafe(S, y50), 11);
          const q = seededRandom(i * 31 + N), yaw = Math.atan2(-f.nz, f.nx);                       // у бара — мусорки, изредка столик на песке
          for (const sg of [-1, 1]) if (q() < 0.55) { const p = W(f, sg * 7.6, bd + 1); propBin(B, p[0], groundY(...p), p[1], yaw, q); }
          if (q() < 0.3) { const p = W(f, (q() - 0.5) * 6, bd - 6.5); propTableSet(B, p[0], groundY(...p), p[1], yaw, q); } }
        rows(7, [11, 16]);
      } else if (roll < 0.57 && chaweng) {                                // корпус отеля (где до дороги хватает места) и шезлонги
        if (room > 68) { const S = sculptor(); solid(f, 55, S, beachHotel(S, groundY(...W(f, 0, 55))), 14); }
        else if (canBuild) { const S = sculptor(); solid(f, bd, S, beachTentBar(S, y50), 11); }
        rows(8, [12, 17]);
      } else if (roll < 0.72) {                                           // три бунгало и ряд шезлонгов
        if (canBuild) {
          const g = groupAt(f, bd), S = sculptor(), y0 = groundY(...W(f, 0, bd));
          [-9, 0, 9].forEach((x, k) => { beachBungalow(S, x, y0, ['#efe8d8', '#e6d8c0', '#f2f0e8'][k]); S.box(6.4, 1.4, 6.6, x, y0 - 0.68, 0.3, '#a89878'); wallBox(g, x, 0.5, 6, 5); });
          g.add(S.mesh()); const c = W(f, 0, bd); vegKeepOut.push(Object.assign(() => true, { c: [c[0], c[1], 15] }));
        }
        rows(5, [13]);
      } else if (roll < 0.84) {                                           // лодки-длиннохвостки: одна на воде, одна вытащена на песок
        for (const [a, d, tilt] of [[-6, -7, 0], [7, 2.5, 0.22]]) {
          const boat = boatLongtail(rnd), bb = new THREE.Box3().setFromObject(boat), [x, z] = W(f, a, d);
          boat.position.set(x, d > 0 ? groundY(x, z) + 0.25 : 0, z); boat.rotation.y = Math.atan2(-f.nx, -f.nz) + Math.PI / 2 + (rnd() - 0.5) * 0.5; boat.rotation.z = tilt;
          scene.add(boat); boat.updateMatrixWorld(true);
          const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, hl = (bb.max.x - bb.min.x) * 0.45, hw = (bb.max.z - bb.min.z) * 0.4;
          const P = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => boat.localToWorld(new THREE.Vector3(cx + u, 0, cz + v)));
          P.forEach((p, k) => { const q = P[(k + 1) % 4]; walls.push([p.x, p.z, q.x, q.z]); }); solids.push(P.map(p => [p.x, p.z]));
          boat.userData.c = new THREE.Vector3(x, 0, z); pierGroups.push(boat);
        }
      } else if (roll < 0.93 && chaweng) {                                // гидроциклы у воды
        for (let k = 0; k < 3; k++) { const [x, z] = W(f, -4 + k * 3.6, 3 + rnd() * 2), m = jetSki(['#e8c82a', '#d42020', '#2b4998'][k]); m.position.set(x, groundY(x, z) + 0.05, z); m.rotation.y = Math.atan2(-f.nx, -f.nz) - Math.PI / 2 + (rnd() - 0.5) * 0.4; scene.add(m); breakableObjects([m], x, z, 1.1, 'small', 0.05, 'metal'); }
        umbrella(6, 6, '#d42020');
      } else rows(3, [14]);
      B.finish(W(f, 0, 14));
    }
    // быстрый переход — на песок в середине пляжа, носом вдоль берега
    const m = frame(N >> 1), p = W(m, 0, 12);
    LANDMARKS.push({ name: 'ПЛЯЖ ' + Bc.name, x: p[0], z: p[1], heading: Math.atan2(-m.tx, -m.tz) });
  }
}

// ---------- лёгкое оформление простых пляжей и Силвер-бич ----------
// Общее: оси участка (t — вдоль берега, n — вглубь суши), шезлонг, зонт, подушки, лодка на якоре, бар под соломой.
function beachKit(Bc, seed) {
  const pts = Bc.pts, N = pts.length, rnd = seededRandom(seed), B = propBatch();
  const frame = (i) => { const [x, z, nx, nz] = pts[Math.max(0, Math.min(N - 1, i))]; return { x, z, nx, nz, tx: nz, tz: -nx }; };
  const W = (f, a, d) => [f.x + f.tx * a + f.nx * d, f.z + f.tz * a + f.nz * d];
  const free = (x, z, need = 4) => groundY(x, z) > 0.15 && !townBlocked(x, z) && roadDist(x, z) > need;
  const lounger = (f, a, d, cushion, frameCol) => {
    const [x, z] = W(f, a, d), y = groundY(x, z), yaw = Math.atan2(-f.nz, f.nx);
    if (!free(x, z)) return;
    B.begin(); B.box(x, y + 0.3, z, 1.9, 0.08, 0.66, yaw, frameCol); B.box(x - f.nx * 0.1, y + 0.37, z - f.nz * 0.1, 1.5, 0.08, 0.58, yaw, cushion);
    B.box(x + f.nx * 0.8, y + 0.52, z + f.nz * 0.8, 0.5, 0.36, 0.6, yaw, cushion); B.end({ kind: 'small', mat: 'wood', x, z, r: 0.75, loss: 0.02 });
  };
  const umbrella = (f, a, d, color) => {
    const [x, z] = W(f, a, d), y = groundY(x, z); if (!free(x, z)) return;
    const it = B.begin(); B.box(x, y + 1.1, z, 0.07, 2.2, 0.07, 0, '#e8e4da');
    for (let k = 0; k < 8; k++) { const a0 = k / 8 * 6.283, a1 = (k + 1) / 8 * 6.283; B.quad([x, y + 2.45, z], [x + Math.cos(a0) * 1.2, y + 2.0, z + Math.sin(a0) * 1.2], [x + Math.cos(a1) * 1.2, y + 2.0, z + Math.sin(a1) * 1.2], [x, y + 2.45, z], k % 2 ? color : '#f2f2ee'); }
    it.boxes.push([x, y + 2.2, z, 1.6, 0.06, 1.6, 0, new THREE.Color(color).getHex()]); B.end({ kind: 'small', mat: 'wood', x, z, r: 0.2, loss: 0.02 });
  };
  // подушки-мешки вокруг низкого столика с фонариком (Бопхут, фото 02)
  const beanbags = (f, a, d) => {
    const [x, z] = W(f, a, d), y = groundY(x, z); if (!free(x, z)) return;
    B.begin(); B.box(x, y + 0.2, z, 0.6, 0.4, 0.6, 0, '#7a5a3c'); B.box(x, y + 0.48, z, 0.14, 0.16, 0.14, 0, '#f2e6c0');
    for (let k = 0; k < 4; k++) { const ang = k * 1.571 + 0.4, px = x + Math.cos(ang) * 1.0, pz = z + Math.sin(ang) * 1.0; B.box(px, y + 0.22, pz, 1.0, 0.44, 0.75, -ang, ['#2b4998', '#8a8e94', '#d8c8a8', '#3a6ab8'][(k + Math.abs(Math.round(a))) & 3]); }
    B.end({ kind: 'small', mat: 'wood', x, z, r: 1.3, loss: 0.02 });
  };
  const anchored = (f, a, d, make) => {                                // лодка на якоре: твёрдая
    const [x, z] = W(f, a, d); if (groundY(x, z) > -0.4) return;
    const boat = make(rnd), bb = new THREE.Box3().setFromObject(boat);
    boat.position.set(x, 0, z); boat.rotation.y = Math.atan2(-f.nx, -f.nz) + (rnd() - 0.5) * 0.8; scene.add(boat); boat.updateMatrixWorld(true);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, hl = (bb.max.x - bb.min.x) * 0.45, hw = (bb.max.z - bb.min.z) * 0.4;
    const P = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => boat.localToWorld(new THREE.Vector3(cx + u, 0, cz + v)));
    P.forEach((p, k) => { const q = P[(k + 1) % 4]; walls.push([p.x, p.z, q.x, q.z]); }); solids.push(P.map(p => [p.x, p.z]));
    boat.userData.c = new THREE.Vector3(x, 0, z); pierGroups.push(boat);
  };
  const thatchBar = (f, a, d) => {                                     // бар под соломой ≈ 3 × 3 (Бопхут, фото 07)
    const [x, z] = W(f, a, d); if (!free(x, z, 6) || !free(...W(f, a + 2, d), 6) || !free(...W(f, a - 2, d), 6)) return;
    const g = new THREE.Group(), y = groundY(x, z), S = sculptor(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-f.nx, -f.nz); scene.add(g); g.updateMatrixWorld(true);
    S.box(3.4, 1.0, 3.4, 0, y - 0.35, 0, '#a89878'); thatchHut(S, 0, 0, y, 3.2, 3.0, '#a8946a');
    g.add(hotelMesh(S)); wallBox(g, 0, 0, 3.4, 3.4); g.userData.c = new THREE.Vector3(x, 0, z); pierGroups.push(g);
    vegKeepOut.push(Object.assign(() => true, { c: [x, z, 3] }));
    const yaw = Math.atan2(-f.nz, f.nx);                                // мусорка сбоку, изредка столик перед баром
    if (rnd() < 0.7) { const p = W(f, a + 2.6, d + 0.6); propBin(B, p[0], groundY(...p), p[1], yaw, rnd); }
    if (rnd() < 0.4) { const p = W(f, a + (rnd() - 0.5) * 2, d - 3.4); if (free(...p, 3)) propTableSet(B, p[0], groundY(...p), p[1], yaw, rnd); }
  };
  // переход — на свободный песок ближе к середине пляжа (у Бопхута на песке стоит Рыбацкая деревня), носом вдоль берега
  const place = (name) => { for (let k = 0; k < N; k++) { const i = (N >> 1) + (k % 2 ? 1 : -1) * ((k + 1) >> 1), m = frame(i);
    for (const d of [10, 7, 13, 5]) { const p = W(m, 0, d), q = W(m, 6, d), r = W(m, -6, d); if (free(...p, 3) && free(...q, 3) && free(...r, 3)) { LANDMARKS.push({ name: 'ПЛЯЖ ' + name, x: p[0], z: p[1], heading: Math.atan2(-m.tx, -m.tz) }); return; } } } };
  return { N, rnd, B, frame, W, lounger, umbrella, beanbags, anchored, thatchBar, place };
}
// Бопхут (refs/beach_bophut) и Маенам (refs/beach_maenam): песок уже лежит; на нём — подушки со столиками или шезлонги,
// пара баров под соломой; в воде — лодки на якоре (Бопхут — длиннохвостки, Маенам — белые катера). Пальмы растут сами.
function beachLight(Bc) {
  const bophut = Bc.id === 'bophut', K = beachKit(Bc, bophut ? 4417 : 5523);
  for (let i = 4; i < K.N - 4; i += 6) {
    const f = K.frame(i), roll = K.rnd();
    if (roll < 0.35) { if (bophut) { K.beanbags(f, -2, 8); K.beanbags(f, 3, 9); } else for (let k = 0; k < 3; k++) { K.lounger(f, (k - 1) * 2.5, 9, '#f2f2ee', '#e8e8e4'); if (k !== 1) K.umbrella(f, (k - 1) * 2.5 + 1.2, 11, '#2a8a7a'); } }
    else if (roll < 0.5) K.thatchBar(f, 0, 14);
    if (K.rnd() < 0.55) K.anchored(f, (K.rnd() - 0.5) * 10, -14 - K.rnd() * 14, bophut ? boatLongtail : boatSpeedboat);
  }
  K.B.finish(K.W(K.frame(K.N >> 1), 0, 10));
  K.place(Bc.name);
}
// Силвер-бич (refs/beach_silver): маленькая бухта между мысами, огромные гладкие гранитные валуны на песке у краёв и на
// мелководье (твёрдые), посередине — немного шезлонгов с зонтами и бар под соломой.
function beachSilver(Bc) {
  const K = beachKit(Bc, 6670), S = sculptor(), GR = ['#c8c0b0', '#b8b0a2', '#d2cabc', '#bdb5a6'];
  const boulder = (f, a, d, r) => {
    const [x, z] = K.W(f, a, d), y = Math.max(groundY(x, z), -1.2), ry = r * (0.55 + K.rnd() * 0.25);
    S.blob(x, y + ry * 0.35, z, r * (0.9 + K.rnd() * 0.3), ry, r * (0.8 + K.rnd() * 0.3), GR[(K.rnd() * GR.length) | 0], 9, 5);
    if (r > 0.9) { const h = r * 0.75; walls.push([x - h, z - h, x + h, z - h], [x + h, z - h, x + h, z + h], [x + h, z + h, x - h, z + h], [x - h, z + h, x - h, z - h]); solids.push([[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]]); }
    vegKeepOut.push(Object.assign(() => true, { c: [x, z, r + 0.5] }));
  };
  for (const [end, sg] of [[2, 1], [K.N - 3, -1]]) {                    // груды у мысов
    const f = K.frame(end);
    for (let k = 0; k < 8; k++) boulder(f, sg * (K.rnd() * 10 - 2), -8 + K.rnd() * 22, 1.2 + K.rnd() * 2.8);
  }
  for (let k = 0; k < 6; k++) { const f = K.frame(4 + ((K.rnd() * (K.N - 8)) | 0)); boulder(f, (K.rnd() - 0.5) * 6, -6 - K.rnd() * 14, 0.8 + K.rnd() * 1.8); }   // по одному на мелководье
  const mesh = S.mesh(); scene.add(mesh);
  const mid = K.frame(K.N >> 1);
  for (let k = 0; k < 4; k++) { K.lounger(mid, (k - 1.5) * 2.6, 9, '#f2f2ee', '#c8a878'); if (k % 2 === 0) K.umbrella(mid, (k - 1.5) * 2.6 + 1.3, 11, '#e8782a'); }
  K.thatchBar(K.frame((K.N >> 1) + 5), 0, 16);
  K.B.finish(K.W(mid, 0, 10));
  K.place(Bc.name);
}
