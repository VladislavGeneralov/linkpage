// Центр Чавенга — refs/chaweng_center, план — refs/TOWNS_PLAN.md (ресерч-сессия), «делай все» — Влад.
//   Beach Road — в игре это дорога «Haa Chaweng 1» вдоль пляжа: со стороны суши сплошной ряд шопхаусов в 2–3 этажа
//     с вывесками (туристические: бары, массаж, обмен, тату…; часть по-тайски), полосатыми маркизами и скутерами у бордюра.
//   Central Festival — торговый центр (ISLAND.malls, kind 'central'): двухуровневые галереи под тёмными козырьками,
//     красная вывеска CENTRAL, площадь с пальмами в кадках и белой стелой, стоянка. Настоящий ≈ 250 × 150 м в мир 1:3
//     не помещается — здесь 110 × 60 (площадку подбирает сборщик). Ночью светятся витрины и вывеска.
//   Soi Green Mango — ночной переулок (ISLAND.spots.green_mango, узкая улица): бары с неоновыми вывесками по обе стороны,
//     гирлянды поперёк, неоновая арка на входе. Днём — просто бары.
//   Озеро Чавенг — сборщик опустил низину под воду (ISLAND.lake); на восточном берегу — павильон-сала и сцена.
// Постройки твёрдые; кадки, столы, стулья, скутеры — разрушаемые. Файл подключается после towns.js; buildChaweng()
// зовёт buildTowns() (до придорожных лавок: участок улицы занят посёлком).

const CHAWENG_STYLE = { floors: [2, 3], roof: 'flat', balcony: 0.35, kerb: '#c8302a', thai: 0.25, scooters: 0.45,
  walls: ['#f2efe6', '#f6e9d1', '#f4dc9c', '#bcd8e0', '#e8b4b0', '#dfe2e6', '#f0d0a0', '#c4e0c8', '#f2efe6', '#e6e0c8'],
  signs: ['BAR', 'MASSAGE', 'EXCHANGE', 'TATTOO', 'SEAFOOD', 'THAI FOOD', 'COFFEE', 'TAILOR', 'MINI MART', 'SPA', 'PIZZA', 'BIKE RENT',
    'TOURS', 'ICE CREAM', 'PHARMACY', 'OPTIC', 'BURGER', 'DIVING', 'REGGAE BAR', 'MUAY THAI', 'FRUIT SHAKE', 'PAD THAI', 'GUESTHOUSE'] };
const GM_NEON = ['#ff4fb0', '#b04fff', '#4fb8ff', '#5aff7a', '#ffd84f', '#ff6a4f'];

function buildChaweng() {
  const rnd = seededRandom(5307);
  for (const M of IS.malls || []) if (M.kind === 'central') buildCentralFestival(M);   // сначала торговый центр и переулок: ряды домов их обходят
  if (IS.spots && IS.spots.green_mango) buildGreenMango();
  // ---------- Beach Road: ряд шопхаусов со стороны суши ----------
  const r = roads.findIndex((q) => q.name === 'Haa Chaweng 1'), R = roads[r];
  if (R) {
    const q0 = roadProj(r, 800, 2075), q1 = roadProj(r, 1262, 2440);                               // от южного края центра до севера (за Green Mango)
    if (q0 && q1) {
      const S0 = Math.min(q0.s, q1.s), S1 = Math.max(q0.s, q1.s), mid = (S0 + S1) / 2;
      // сторона суши: где вода дальше (у пляжа терраса бывает выше травы за дорогой, по высоте не понять)
      const wet = (sg) => { let n = 0; for (const t of [0.2, 0.4, 0.6, 0.8]) for (let d = 10; d < 150; d += 5) { const p = roadPoint(R, S0 + (S1 - S0) * t, sg * d); if (groundY(p[0], p[1]) < 0) { n += 150 - d; break; } } return n; };
      const land = wet(1) > wet(-1) ? -1 : 1;
      TOWN.claims.push({ r, s0: S0 - 10, s1: S1 + 10 });
      townStreet(R, r, S0, S1, land, 10.4, 12, [22, 18, 14, 26], 0.5, { drop: 2.4, rise: 2.6, bend: 1.2 }, (lot, q) => shophouseRow(lot, q, CHAWENG_STYLE), rnd);
    }
  }
  if (IS.lake) buildChawengLake();
}

// ---------- Central Festival ----------
function buildCentralFestival(s) {
  const W = 110, D = 60, PARK = 16, U1 = D / 2 + PARK, rnd = seededRandom(6107);
  const g = new THREE.Group();
  g.position.set(s.x, s.y + LOT_RISE, s.z); g.rotation.y = -s.az;
  scene.add(g); g.updateMatrixWorld(true);
  const A = sculptor(), S = sculptor(), Gl = sculptor(), Y = LOT_Y;
  // площадка: асфальт стоянки, плитка площади; борт по краю, рваный край к дороге
  A.quad([-D / 2 - 1, Y, -W / 2 - 1], [U1, Y, -W / 2 - 1], [U1, Y, W / 2 + 1], [-D / 2 - 1, Y, W / 2 + 1], '#8f8b84');
  A.skirt(-D / 2 - 1, U1, -W / 2 - 1, W / 2 + 1, Y, '#827f76');
  for (let i = 0, u = 6; u < 30; u += 2, i++) for (let j = 0, v = -W / 2 + 2; v < W / 2 - 2; v += 2, j++) if ((i + j) % 2 === 0) A.quad([u, Y + 0.01, v], [u + 2, Y + 0.01, v], [u + 2, Y + 0.01, v + 2], [u, Y + 0.01, v + 2], '#c9c4b8');
  A.quad([6, Y + 0.005, -W / 2 + 2], [30, Y + 0.005, -W / 2 + 2], [30, Y + 0.005, W / 2 - 2], [6, Y + 0.005, W / 2 - 2], '#d6d1c4');   // плитка площади
  for (let v = -W / 2 + 0.5; v < W / 2; v += 5.5) A.box(5, 0.01, 0.12, 38, Y + 0.012, -v, '#e8e6de');                              // разметка стоянки: границы мест
  g.add(A.mesh());
  lotApron(g, U1, -W / 2 - 1, W / 2 + 1, Y, '#8f8b84');
  // корпус: два этажа галерей лицом к площади (u = 6), сзади — глухой объём
  const F = 6, B0 = -30, H1 = 5, H2 = 10, TOP = 12.5, GLASS = '#3e4858', WHITE = '#eceae4', GREY = '#b8bcc0', DARK = '#3a3e44';
  S.box(F - B0, TOP, W, (F + B0) / 2, Y + TOP / 2, 0, WHITE);                                                                    // объём
  S.box(F - B0 + 0.2, 0.5, W + 0.2, (F + B0) / 2, Y + TOP + 0.25, 0, GREY);                                                      // парапет
  for (let v = -W / 2 + 3; v < W / 2 - 2; v += 6) {                                                                              // витрины двух этажей
    for (const [y0, h] of [[0.2, 4.2], [H1 + 0.6, 3.8]]) { S.box(0.1, h, 5.2, F + 0.02, Y + y0 + h / 2, -(v + 2.8), GLASS); Gl.box(0.02, h - 0.4, 4.8, F + 0.09, Y + y0 + h / 2, -(v + 2.8), rnd() < 0.8 ? '#ffe9b8' : '#ffd0e0'); }
    S.box(0.6, TOP, 0.6, F + 0.3, Y + TOP / 2, -v, GREY);                                                                       // пилоны
  }
  S.box(3.2, 0.3, W, F + 1.6, Y + H1, 0, '#d8d6cf');                                                                            // галерея второго этажа
  S.box(0.08, 1.0, W, F + 3.15, Y + H1 + 0.65, 0, '#e8eef2'); S.box(0.12, 0.08, W, F + 3.15, Y + H1 + 1.15, 0, GREY);            // стеклянное ограждение и поручень
  for (let v = -W / 2 + 6; v < W / 2 - 3; v += 12) { S.box(0.25, H1, 0.25, F + 2.9, Y + H1 / 2, -v, GREY); wallBox(g, F + 2.9, v, 0.4, 0.4); }   // тонкие колонны
  // изогнутые козырьки: тёмные лепестки над галереей, каждый — две наклонные плиты
  for (let v = -W / 2 + 4; v < W / 2 - 3; v += 9) {
    const c = -(v + 4.5);
    S.quad([F, Y + H2 + 0.4, c - 4.2], [F, Y + H2 + 0.4, c + 4.2], [F + 2.4, Y + H2 + 1.2, c + 4.2], [F + 2.4, Y + H2 + 1.2, c - 4.2], DARK);
    S.quad([F + 2.4, Y + H2 + 1.2, c - 4.2], [F + 2.4, Y + H2 + 1.2, c + 4.2], [F + 5.0, Y + H2 + 0.7, c + 4.2], [F + 5.0, Y + H2 + 0.7, c - 4.2], DARK);
    S.box(0.15, 1.4, 0.15, F + 4.6, Y + H2 - 0.1, c, GREY);
  }
  // вывеска: белая панель над входом, красные буквы CENTRAL, ниже FESTIVAL; ночью светятся
  { const px = 0.42, cw = hudWidth(hudText('CENTRAL')) * px, yc = Y + TOP + 2.2;
    S.box(0.3, 3.4, cw + 3, F - 0.2, yc, 0, '#f6f6f2');
    const T = sculptor(); T.text('CENTRAL', 0, 1.5, 0.18, px, '#d81e2a', 1); T.text('FESTIVAL', 0, -0.8, 0.18, 0.16, '#2a2a2c', 1);   // строки: 1.5…−0.6 и −0.8…−1.6 на панели ±1.7
    const m = T.mesh(); m.rotation.y = Math.PI / 2; m.position.set(F - 0.05, yc, 0); g.add(m);
    const L = sculptor(); L.text('CENTRAL', 0, 1.5, 0.2, px, '#ff4a50', 1);
    const n = L.mesh(); n.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }); n.visible = false; nightGlow.push(n); n.rotation.y = Math.PI / 2; n.position.set(F - 0.05, yc, 0); g.add(n); }
  // белая стела у входа (фото 03)
  S.box(1.2, 7, 3.2, 20, Y + 3.5, -(-22), '#f6f6f2'); S.box(1.3, 0.6, 3.4, 20, Y + 0.3, 22, '#b8b6ae'); wallBox(g, 20, -22, 1.6, 3.6);
  g.add(hotelMesh(S));
  { const m = Gl.mesh(); m.material = TOWN.lit || (TOWN.lit = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); m.visible = false; nightGlow.push(m); g.add(m); }
  wallBox(g, (F + B0) / 2, 0, F - B0, W);
  // площадь: пальмы в кадках (кадки сбиваются), скамьи
  for (let v = -W / 2 + 8; v < W / 2 - 6; v += 11) for (const u of [13, 25]) {
    if (Math.abs(v + 22) < 4 && u === 25) continue;
    templeProp(g, u, v, (P) => { P.box(1.6, 0.8, 1.6, 0, Y + 0.4, 0, '#d8d4c8'); P.tube(0, Y + 0.8, Y + 6.5, 0, 0.2, 0.15, '#8a7a5a', 6);
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; P.quad([0, Y + 6.5, 0], [Math.cos(a) * 2.6, Y + 5.4, Math.sin(a) * 2.6], [Math.cos(a + 0.35) * 2.4, Y + 5.6, Math.sin(a + 0.35) * 2.4], [0, Y + 6.5, 0], k % 2 ? '#3a8a3a' : '#4fa04a'); } },
      { kind: 'small', mat: 'stone', color: '#d8d4c8', r: 0.9, loss: 0.03 });
  }
  // стоянка: машины и ряды скутеров у дороги
  for (let k = 0; k < 9; k++) { const v = -W / 2 + 6 + k * 11 + (rnd() - 0.5) * 2; if (Math.abs(v) > 6) parkVehicle(g, parkedCar(k + 3), 38, v, k % 2 ? 'u+' : 'u-', Y); }
  scooterRow(g, 61, 8, U1 - 2.5, -40, 0, 0.85, Math.PI, Y); scooterRow(g, 67, 8, U1 - 2.5, 34, 0, 0.85, Math.PI, Y);
  vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 4 && p.x < U1 + 1 && Math.abs(p.z) < W / 2 + 5; }, { c: [s.x, s.z, Math.hypot(W, D) / 2 + 12] }));
  pavedAreas.push({ x: s.x, z: s.z, r2: (Math.hypot(W, D) / 2 + 10) ** 2, lift: LOT_Y + LOT_RISE,
    test: (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 1 && p.x < U1 && Math.abs(p.z) < W / 2 + 1; } });
  g.userData.c = new THREE.Vector3(s.x, 0, s.z); pierGroups.push(g);
  spotPlace('CENTRAL FESTIVAL', g, U1 + 5, 0, -1, 0);
}

// ---------- Soi Green Mango ----------
function buildGreenMango() {
  const g = spotGroup('green_mango'), rnd = seededRandom(7741), NAMES = ['GREEN MANGO', 'SOUND CLUB', 'THE ISLAND', 'REGGAE BAR', 'LASER BAR', 'TROPICAL', 'BAR 99', 'SHOTS',
    'BOOM BOOM', 'KARAOKE', 'NEON', 'BEER BAR', 'BLUE MOON', 'PARADISE', 'COCO BAR', 'ROCK BAR'];
  const SIDE = LANE_HALF + 1.4, D = 7.5, LIT = TOWN.lit || (TOWN.lit = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
  let k = 0;
  const bars = [];                                                                                 // (для мусорок и столиков)
  for (const sd of [1, -1]) for (let u = 12; u < 70; k++) {
    const w = 7 + ((rnd() * 3) | 0), cu = u + w / 2, cv = sd * (SIDE + D / 2), y = spotGround(g, cu, sd * SIDE) + 0.15, fl = rnd() < 0.45 ? 2 : 1, H = fl * 3.4, neon = GM_NEON[(rnd() * GM_NEON.length) | 0], name = NAMES[k % NAMES.length];
    // бар: фасад (+Z в своих осях) смотрит на переулок
    const S = sculptor(), Gl = sculptor(), F = D / 2;
    S.box(w - 0.1, 1.4, D, 0, y - 0.7, 0, '#8f8b80'); S.box(w - 0.1, H, D, 0, y + H / 2, 0, ['#2a2630', '#30283a', '#3a3a40', '#26303a', '#f0e8d8'][(rnd() * 5) | 0]);
    S.box(w - 0.9, 2.6, 0.1, 0, y + 1.3, F + 0.02, '#141418'); S.box(w - 1.4, 1.0, 0.7, 0, y + 0.5, F - 0.6, '#5a3a2a'); S.box(w - 1.3, 0.06, 0.8, 0, y + 1.03, F - 0.6, '#c8a878');   // открытый зал, стойка
    for (let q = 0; q < 4; q++) S.tube(-w / 2 + 1.2 + q * (w - 2.4) / 3, y, y + 0.75, F + 0.4, 0.18, 0.2, '#2a2a2c', 6);                   // табуреты на тротуаре
    if (fl === 2) { S.box(w - 0.6, 0.12, 1.2, 0, y + 3.4, F + 0.6, '#3a3a40'); for (const dx of [-w / 4, w / 4]) S.box(1.6, 1.6, 0.08, dx, y + 5.0, F + 0.03, '#141418'); }
    // неоновая вывеска над входом: днём — тёмная доска с цветными буквами, ночью светится
    const px = Math.min(0.12, (w - 1.4) / hudWidth(hudText(name))), sy = y + 3.0;
    S.box(w - 0.6, 0.8, 0.12, 0, sy, F + 0.1, '#16161a'); S.text(name, 0, sy + px * 2.5, F + 0.18, px, neon, 1);
    Gl.box(w - 0.8, 0.06, 0.02, 0, sy + 0.42, F + 0.17, neon); Gl.box(w - 0.8, 0.06, 0.02, 0, sy - 0.42, F + 0.17, neon); Gl.text(name, 0, sy + px * 2.5, F + 0.2, px, neon, 1);
    Gl.box(w - 1.0, 2.2, 0.02, 0, y + 1.3, F + 0.05, ['#ff8ad0', '#b07aff', '#7ac8ff'][(rnd() * 3) | 0]);                                     // свет из зала
    const m = hotelMesh(S), n = Gl.mesh(); n.material = LIT; n.visible = false; nightGlow.push(n);
    for (const o of [m, n]) { o.position.set(cu, 0, -cv); o.rotation.y = sd > 0 ? 0 : Math.PI; g.add(o); }
    wallBox(g, cu, cv, w - 0.1, D);
    bars.push([cu, w, sd]);
    u += w + 0.15;
  }
  // у баров: мусорки по краям фасадов, изредка столик с табуретами на краю переулка (всё сбивается)
  { const B = propBatch(), q = seededRandom(7743), at = (u, v) => g.localToWorld(new THREE.Vector3(u, 0, -v)), yaw = -IS.spots.green_mango.az;
    for (const [cu, w, sd] of bars) {
      if (q() < 0.6) { const p = at(cu + (q() < 0.5 ? -1 : 1) * (w / 2 - 0.45), sd * (SIDE - 0.45)); propBin(B, p.x, groundY(p.x, p.z) + 0.15, p.z, yaw, q); }
      if (q() < 0.25) { const p = at(cu + (q() - 0.5) * 2, sd * (LANE_HALF - 0.5)); propTableSet(B, p.x, groundY(p.x, p.z) + 0.05, p.z, yaw, q); }
    }
    const c = at(40, 0); B.finish([c.x, c.z]); }
  // гирлянды поперёк переулка и неоновая арка на входе
  { const S = sculptor(), Gl = sculptor(), y0 = spotGround(g, 8, 0);
    for (let u = 16; u < 68; u += 8) { const y = spotGround(g, u, 0) + 5.2; S.rod([u, y, -(SIDE + 0.3)], [u, y, SIDE + 0.3], 0.03, '#1c1c1e');
      for (let t = -SIDE; t <= SIDE; t += 0.9) { const c = GM_NEON[((u + t * 3) | 0) % GM_NEON.length]; S.box(0.12, 0.14, 0.12, u, y - 0.25 - 0.2 * Math.cos(t / SIDE * 1.57), -t, '#e8e4d8'); Gl.box(0.14, 0.16, 0.14, u, y - 0.25 - 0.2 * Math.cos(t / SIDE * 1.57), -t, c); } }
    for (const sd of [-1, 1]) { S.box(0.4, 7.6, 0.4, 7, y0 + 3.8, -sd * (SIDE + 0.2), '#2a2a2c'); wallBox(g, 7, sd * (SIDE + 0.2), 0.5, 0.5); }
    const ah = signFit('SOI GREEN MANGO', 2 * SIDE - 0.4, 0.11).h + 0.35;                         // доска — по высоте двух строк
    S.box(0.3, ah, 2 * SIDE + 1, 7, y0 + 5.7 + ah / 2, 0, '#141418');
    for (const [T, c] of [[S, '#5aff7a'], [Gl, '#7aff9a']]) for (const face of [1, -1]) { const A = sculptor(); signLines(A, 'SOI GREEN MANGO', 2 * SIDE - 0.4, c, 0.17, 0.11); const mm = T === S ? A.mesh() : A.mesh(); if (T === Gl) { mm.material = LIT; mm.visible = false; nightGlow.push(mm); } mm.rotation.y = face * Math.PI / 2; mm.position.set(7 + (T === Gl ? face * 0.02 : 0), y0 + 5.7 + ah / 2, 0); g.add(mm); }
    g.add(hotelMesh(S)); const n = Gl.mesh(); n.material = LIT; n.visible = false; nightGlow.push(n); g.add(n); }
  scooterRow(g, 83, 3, 8.8, -(SIDE - 0.6), 1.0, 0, Math.PI / 2, spotGround(g, 9, 0) + 0.1);           // между аркой и первым баром
  g.userData.c = new THREE.Vector3(IS.spots.green_mango.x, 0, IS.spots.green_mango.z); pierGroups.push(g);
  vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > 0 && p.x < 78 && Math.abs(p.z) < SIDE + D + 2; }, { c: [IS.spots.green_mango.x, IS.spots.green_mango.z, 90] }));
  spotPlace('SOI GREEN MANGO', g, 2, 0, 1, 0);
}

// ---------- Озеро Чавенг: сала и сцена на восточном берегу ----------
function buildChawengLake() {
  const L = IS.lake.pts, a = L[1], b = L[3], tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz), ux = tx / tl, uz = tz / tl;
  let nx = -uz, nz = ux; { const m = [(a[0] + b[0]) / 2 + nx * 30, (a[1] + b[1]) / 2 + nz * 30]; if (roadDist(m[0], m[1]) > roadDist((a[0] + b[0]) / 2 - nx * 30, (a[1] + b[1]) / 2 - nz * 30)) { nx = -nx; nz = -nz; } }   // к дороге — восточный берег
  const placeAt = (t, need) => { for (let d = IS.lake.r + 4; d < IS.lake.r + 30; d += 1.5) { const x = a[0] + ux * t + nx * d, z = a[1] + uz * t + nz * d; if (groundY(x, z) > 0.5 && !townBlocked(x, z) && roadDist(x, z) > need) return [x, z, d]; } return null; };
  const yaw = Math.atan2(-nx, -nz);                                                                                // +Z группы — к воде
  const make = (p, build, dims) => { const g = new THREE.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = yaw; scene.add(g); g.updateMatrixWorld(true);
    const S = sculptor(); build(S, groundY(p[0], p[1])); g.add(hotelMesh(S)); wallBox(g, 0, 0, dims[0], dims[1]); g.userData.c = new THREE.Vector3(p[0], 0, p[1]); pierGroups.push(g);
    vegKeepOut.push(Object.assign(() => true, { c: [p[0], p[1], Math.max(...dims) / 2 + 3] })); return g; };
  const sp = placeAt(tl * 0.35, 9);
  let sala = null;
  if (sp) sala = make(sp, (S, y) => beachSala(S, y), [9, 9]);
  const st = placeAt(tl * 0.75, 9);
  if (st) make(st, (S, y) => {                                                                                    // сцена: помост, ферма с прожекторами, колонки
    S.box(10, 1.6, 6, 0, y - 0.1, 0, '#3a3a40'); S.box(10.2, 0.1, 6.2, 0, y + 0.72, 0, '#2a2a2c');
    for (const x of [-5, 5]) for (const z of [-3, 3]) S.box(0.25, 6, 0.25, x, y + 3.7, z, '#8e9296');
    S.box(10.4, 0.3, 0.3, 0, y + 6.6, 3, '#8e9296'); S.box(10.4, 0.3, 0.3, 0, y + 6.6, -3, '#8e9296'); S.box(0.3, 0.3, 6.4, -5, y + 6.6, 0, '#8e9296'); S.box(0.3, 0.3, 6.4, 5, y + 6.6, 0, '#8e9296');
    S.box(10, 4.6, 0.1, 0, y + 3.1, 2.9, '#1c1c22'); for (const x of [-4.2, 4.2]) S.box(1.0, 2.0, 0.9, x, y + 1.7, -2.2, '#161618');   // задник — к воде, сцена — к дороге
    for (let i = 0; i < 6; i++) S.box(0.3, 0.3, 0.4, -3.5 + i * 1.4, y + 6.3, -2.6, ['#f2f2ee', '#e8c82a'][i % 2]);
  }, [10, 6]);
  // щит у сала: тайская и английская строки
  if (sp) { const S = sculptor(), y = groundY(sp[0], sp[1]), gs = new THREE.Group(); gs.rotation.y = Math.PI / 2; gs.position.set(5, 0, -7); sala.add(gs);   // щит — у дороги, лицом к ней (−Z группы)
    gs.add(spotSign(S, 0, 0, y, 'CHAWENG LAKE', 1)); gs.add(hotelMesh(S)); }
  // кусты по урезу: вдоль линии озера через 3 м с обеих сторон ищется, где кончается вода, и там — куст или куртина
  { const q = seededRandom(7751), P = IS.lake.pts;
    for (let k = 0; k + 1 < P.length; k++) {
      const [x0, z0] = P[k], [x1, z1] = P[k + 1], len = Math.hypot(x1 - x0, z1 - z0), ex = (x1 - x0) / len, ez = (z1 - z0) / len;
      for (let t = 0; t < len; t += 3) for (const sg of [-1, 1]) {
        let d = 4; while (d < IS.lake.r + 22 && groundY(x0 + ex * t - ez * sg * d, z0 + ez * t + ex * sg * d) < 0.1) d += 0.5;
        for (const extra of [0.4 + q() * 0.8, 2 + q() * 2]) {                                       // у самой воды и чуть выше по склону
          const dd = d + extra, x = x0 + ex * t - ez * sg * dd, z = z0 + ez * t + ex * sg * dd;
          if (d < IS.lake.r + 22 && q() < 0.85 && roadDist(x, z) > halfS + 3 && !townBlocked(x, z)) VEG_EXTRA.push([x, z, q() < 0.7 ? 'bankbush' : 'bankfern']);
        }
      }
    } }
  const p = sp || st; if (p) LANDMARKS.push({ name: 'ОЗЕРО ЧАВЕНГ', x: p[0] + nx * 10, z: p[1] + nz * 10, heading: Math.atan2(nx, nz) });   // на берегу, носом к воде
}
