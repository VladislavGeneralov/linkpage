// Три посёлка со своим лицом — refs/nathon_town, refs/fishermans_village, refs/hua_thanon.
// Натон — бетонные шопхаусы в 2–4 этажа вдоль главной и набережной улиц, крытый рынок, старый деревянный дом.
// Рыбацкая деревня (Бопхут) — узкая бетонная улица вдоль пляжа между двумя рядами двухэтажных деревянных домов;
// у домов со стороны моря — террасы на сваях над песком; на въезде арка-вывеска.
// Хуа Танон — рыбацкая деревня: дощатые дома на сваях на пляже, расписные лодки, мечеть, набережная-причал, шопхаусы
// вдоль дороги. Типовые лавки из roadside.js на этих участках не ставятся (TOWN.claims).
// Дома настоящего размера, а улицы короче настоящих втрое — как и весь остров. Ряды домов ставятся вдоль дорог игры
// туда, где свободно (магазины, рынки, отели и пирсы уже стоят и остаются на местах).
// Ряд домов — одна геометрия; его оси: X — вдоль улицы, +Z — к улице, y — от уровня дороги.
// Файл подключается после hotels.js и только объявляет функции; игра зовёт buildTowns() раньше buildRoadside().

const TOWN = { claims: [], rows: 0, lit: null, groups: [], replay: false };   // replay — идёт отложенная постройка ряда (стены и участок уже отмечены)   // claims: [{ r, s0, s1 }] — участки дорог, занятые посёлками; groups — всё построенное
const townSeen = (g) => { pierGroups.push(g); TOWN.groups.push(g); };      // группа видна только вблизи (как пирсы)
function townClaimed(r, s0, s1) { return TOWN.claims.some((c) => c.r === r && s1 > c.s0 && s0 < c.s1); }
const TOWN_PIER_GAP = { nathon: 30, nathon_seatran: 30, nathon_old: 14, bophut: 13 };   // м — ближе к корню пирса дома не ставятся
function townBlocked(x, z) {
  for (const k of vegKeepOut) { const c = k.c; if (c) { if ((x - c[0]) ** 2 + (z - c[1]) ** 2 < c[2] * c[2] && k(x, z)) return true; } else if (k(x, z)) return true; }
  if (pierYAt(x, z) !== null) return true;
  for (const id in TOWN_PIER_GAP) { const P = IS.piers[id]; if (P && (x - P.x) ** 2 + (z - P.z) ** 2 < TOWN_PIER_GAP[id] ** 2) return true; }
  return false;
}
// Участок под ряд: R — дорога (r — её номер), s — начало по пути, len — длина, side — сторона (+1 — справа по ходу),
// FR — от оси дороги до фасада, D — глубина дома. o: back — сколько ещё места нужно за домом, minH — ниже этой высоты
// земля не годится (вода), drop / rise — на сколько земля может быть ниже / выше дороги. Возвращает { g — группа ряда, … } или null.
function townLot(R, r, s, len, side, FR, D, o = {}) {
  if (s < 2 || s + len > R.len - 2) return null;
  const A = roadPoint(R, s, side * FR), B = roadPoint(R, s + len, side * FR), M = roadPoint(R, s + len / 2, side * FR), C = roadPoint(R, s + len / 2, 0);
  const chord = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (Math.abs(chord - len) > (o.bend || 0.9)) return null;                    // дорога тут гнётся — ряд не встанет ровно
  const ux = (B[0] - A[0]) / chord, uz = (B[1] - A[1]) / chord, mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
  if (Math.hypot(M[0] - mx, M[1] - mz) > 1.0) return null;
  let fx = -uz, fz = ux;
  if (fx * (C[0] - mx) + fz * (C[1] - mz) < 0) { fx = -fx; fz = -fz; }          // к оси дороги
  const y0 = asphaltTop(C[0], C[1]) - 0.12, back = D + (o.back || 0), minH = o.minH === undefined ? 0.7 : o.minH;
  for (let a = -1; a <= 1.001; a += 0.2) for (const b of [0.04, 0.35, 0.7, 1]) {
    const x = mx + ux * a * (len / 2 - 0.15) - fx * back * b, z = mz + uz * a * (len / 2 - 0.15) - fz * back * b, h = groundY(x, z);
    if (h < minH || h - y0 > (o.rise || 0.7) || y0 - h > (o.drop || 2.0) || townBlocked(x, z)) return null;
    const other = roadAt(x, z, Infinity, r);
    if (other && !other.end && other.d < (other.road.lane ? LANE_HALF + 0.4 : halfS + 1.2)) return null;
  }
  const g = new THREE.Group();
  g.position.set(mx - fx * D / 2, y0, mz - fz * D / 2); g.rotation.y = Math.atan2(fx, fz);    // фасад (+Z) — к дороге
  scene.add(g); g.updateMatrixWorld(true);
  return { g, y0, len, D, fx, fz, R, r, s, side, FR };
}
// ряд построен: меши, ночной свет, стены, запрет на растения. z0..z1 — что твёрдое (в осях ряда); walk — ширина тротуара перед фасадом
function townDone(lot, S, Gl, z0, z1, walk = 0) {
  const g = lot.g, len = lot.len;
  if (shipyard.dry) return townMark(lot, z0, z1, walk);                    // «сухой» прогон: только стены и участок, дом — потом
  g.add(hotelMesh(S));
  if (Gl && Gl.count()) {
    if (!TOWN.lit) TOWN.lit = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
    const m = Gl.mesh(); m.material = TOWN.lit; m.visible = false; g.add(m); nightGlow.push(m);
  }
  return TOWN.replay ? g : townMark(lot, z0, z1, walk);
}
// стены ряда, запрет на растения, видимость вдали, место в списке рядов
function townMark(lot, z0, z1, walk) {
  const g = lot.g, len = lot.len;
  if (z1 > z0) wallBox(g, 0, -(z0 + z1) / 2, len, z1 - z0);
  const c = g.localToWorld(new THREE.Vector3(0, 0, 0)), zb = Math.min(z0, -lot.D / 2) - 0.6, zf = Math.max(z1, lot.D / 2 + walk);
  vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return Math.abs(p.x) < len / 2 + 0.25 && p.z > zb && p.z < zf; }, { c: [c.x, c.z, Math.hypot(len / 2, zf - zb) + 2] }));
  g.userData.c = new THREE.Vector3(c.x, 0, c.z); townSeen(g);
  RS.rows.push([c.x, c.z, len / 2, 'town']);                               // типовые лавки и стоянки сборщиков сюда не встанут
  TOWN.rows++;
  return g;
}
// тротуар от фасада до асфальта: плита, полосатый бордюр и бетон вместо красной обочины
function townWalk(lot, S, W, kerb) {
  const { len, D, g } = lot, F = D / 2;
  S.box(len, 1.3, W, 0, 0.16 - 0.65, F + W / 2, '#aaa69a');
  for (let i = 0, n = Math.round(len); i < n; i++) S.box(len / n, 0.2, 0.2, -len / 2 + (i + 0.5) * len / n, 0.1, F + W, i % 2 ? kerb : '#e8e6de');
  const P = [], n = Math.max(1, Math.round(len / 2.5));
  for (let i = 0; i <= n; i++) { const w = g.localToWorld(new THREE.Vector3(-len / 2 + len * i / n, 0, F + W + 0.1)); P.push([w.x, w.z]); }
  if (!TOWN.replay) roadApron(g, P, [lot.fx, lot.fz], lot.y0 + 0.12, '#7f7e7a');   // (при отложенной постройке покрытие уже заказано «сухим» прогоном)
}
// поставить ряд: вблизи старта — сразу; дальше — «сухой» прогон сейчас (стены, участок, ряд случайных чисел идёт как при
// настоящей постройке), а сам дом строится после старта с того же места ряда чисел (later — в основном скрипте)
function townMake(lot, rnd, make) {
  const p = lot.g.position;
  if (laterNear(p.x, p.z)) return make(lot, rnd);
  const st = rnd.state();
  shipyard.dry = true; try { make(lot, rnd); } finally { shipyard.dry = false; }
  later(p.x, p.z, lot.g, () => { TOWN.replay = true; try { make(lot, seededRandom(st)); } finally { TOWN.replay = false; } });
}
// вдоль дороги: пробовать ставить ряды разной длины, где помещаются. make(lot, rnd) строит ряд
function townStreet(R, r, s0, s1, side, FR, D, lens, gap, o, make, rnd) {
  let n = 0;
  for (let s = s0; s < s1 - lens[lens.length - 1];) {
    let done = false;
    for (const len of lens) {
      if (s + len > s1) continue;
      const lot = townLot(R, r, s, len, side, FR, D, o);
      if (lot) { townMake(lot, rnd, make); s += len + gap; n++; done = true; break; }
    }
    if (!done) s += 2.3;
  }
  return n;
}
const SIGNS_EN = ['GOLD', 'PHARMACY', 'OPTIC', 'TAILOR', 'BAKERY', 'MOBILE', 'HARDWARE', 'TRAVEL', 'NOODLES', 'COFFEE', 'TEXTILE', 'BANK', 'FOTO', 'WATCH', 'SHOES', 'TOYS', 'BOOKS', 'DENTAL', 'RICE', 'TEA'];

// ---------- ряд бетонных шопхаусов ----------
// st: floors — [от, до] этажей; walls — цвета стен; roof: 'flat' — плоская за парапетом, 'tile' — двускатная серая черепица;
// balcony — доля секций с балконом на втором этаже; kerb — цвет полос бордюра
const NATHON_STYLE = { floors: [2, 4], roof: 'flat', balcony: 0.3, kerb: '#c8302a',
  walls: ['#f2efe6', '#f6e9d1', '#f4dc9c', '#e9c0a8', '#bcd8e0', '#c4e0c8', '#e8b4b0', '#dfe2e6', '#c9ccc8', '#f0d0a0', '#9fb8c8', '#f2efe6', '#e6e0c8'] };
const HUA_STYLE = { floors: [2, 2], roof: 'tile', balcony: 0.8, kerb: '#2a2a2c',
  walls: ['#d8d2c2', '#c9c5b8', '#b8c4c0', '#d6c8b4', '#c2b8a8', '#cfd4d2'] };
const AWNINGS = [['#2e917d', '#2e917d'], ['#2f5fa8', '#f2f2ee'], ['#c8302a', '#f2f2ee'], ['#c8302a', '#f2c81e'], ['#e8dcc0', '#e8dcc0'], ['#73ae97', '#73ae97']];
function shophouseRow(lot, rnd, st) {
  const { len: L, D } = lot, S = sculptor(), Gl = sculptor(), F = D / 2, n = Math.max(1, Math.round(L / 4.6)), w = L / n, P = 0.2, FL = 3.3;
  const pick = (a) => a[(rnd() * a.length) | 0], GLASS = '#3e4858', LIT = '#ffe7a6';
  S.box(L, 2.4, D, 0, P - 1.2, 0, '#8f8b80');                                                      // цоколь уходит в землю
  townWalk(lot, S, 2.7, st.kerb);
  let floors = st.floors[0] + ((rnd() * (st.floors[1] - st.floors[0] + 1)) | 0), top = 0;
  for (let i = 0; i < n; i++) {
    if (rnd() < 0.55) floors = st.floors[0] + ((rnd() * (st.floors[1] - st.floors[0] + 1)) | 0);
    const x = -L / 2 + (i + 0.5) * w, wd = w - 0.05, H = floors * FL + (st.roof === 'flat' ? 0.6 : 0), wall = pick(st.walls), front = rnd(), sign = pick(st.signs || SIGNS_EN);
    const sc = pick(['#c8302a', '#1f4fa0', '#2f7a4a', '#f2c81e', '#e8782a', '#7a2a8a', '#f2f2ee', '#1c1c1e']), ink = sc === '#f2f2ee' || sc === '#f2c81e' ? '#1a1a1a' : '#f8f4e6';
    top = Math.max(top, H);
    S.box(wd, H, D, x, P + H / 2, 0, wall);
    if (st.roof === 'flat') { S.box(wd + 0.04, 0.12, D + 0.06, x, P + H - 0.5, 0, '#b8b6ae'); if (rnd() < 0.4) S.tube(x + (rnd() - 0.5), P + H, P + H + 1.2, -1 - rnd() * 2, 0.5, 0.5, pick(['#2f5f9a', '#8ea2b4', '#e8e8e4']), 8); }
    // первый этаж: открытая лавка, рольставня или витрина
    if (front < 0.45) {
      S.box(wd - 0.7, 2.5, 0.1, x, P + 1.25, F + 0.01, '#2a2622');
      for (let k = 0; k < 5; k++) S.box(0.5 + rnd() * 0.5, 0.4 + rnd() * 0.5, 0.3, x - 1.4 + k * 0.7, P + 0.3 + rnd() * 1.3, F + 0.12, pick(['#e8c82a', '#d84a3a', '#f2f2ee', '#3a8ad8', '#e88a2a', '#5aa83a']));
      Gl.box(wd - 0.8, 1.0, 0.02, x, P + 2.0, F + 0.08, '#ffdf9a');
    } else if (front < 0.68) { for (let k = 0; k < 9; k++) S.box(wd - 0.7, 0.26, 0.08, x, P + 0.14 + k * 0.28, F + 0.02, k % 2 ? '#a9adb2' : '#bfc3c7'); }
    else {
      S.box(wd - 0.7, 2.5, 0.1, x, P + 1.25, F + 0.01, '#4a6a78');
      for (const dx of [-0.5, -0.17, 0.17, 0.5]) S.box(0.09, 2.5, 0.12, x + dx * (wd - 0.7), P + 1.25, F + 0.03, '#d8dade');
      Gl.box(wd - 0.9, 2.2, 0.02, x, P + 1.3, F + 0.07, '#ffe9b8');
    }
    // вывеска-фриз; ночью светится
    // (у части лавок вывеска по-тайски: Натон — тайский город; выбор — по месту, не по общему счётчику случайностей)
    { const th = thaiOf(sign), useTh = th && hash2(Math.round(x * 10) + 3, Math.round((F + P) * 10)) < (st.thai ?? 0.6);
      S.box(wd - 0.4, 0.72, 0.12, x, P + 2.98, F + 0.08, sc); Gl.box(wd - 0.4, 0.72, 0.02, x, P + 2.98, F + 0.15, sc);
      if (useTh) { const pt = Math.min(0.045, (wd - 1) / hudWidth(hudText(th))); thaiText(S, th, x, P + 2.98, F + 0.16, pt, ink); thaiText(Gl, th, x, P + 2.98, F + 0.18, pt, ink); }
      else { const px = Math.min(0.1, (wd - 1) / hudWidth(hudText(sign))); S.text(sign, x, P + 2.98 + px * 2.5, F + 0.16, px, ink, 1); Gl.text(sign, x, P + 2.98 + px * 2.5, F + 0.18, px, ink, 1); } }
    // навес над тротуаром: полосатая маркиза или бетонный козырёк
    if (rnd() < 0.7) {
      const [c1, c2] = pick(AWNINGS);
      for (let k = 0; k < 6; k++) S.quad([x - wd / 2 + k * wd / 6, P + 2.6, F + 0.1], [x - wd / 2 + (k + 1) * wd / 6, P + 2.6, F + 0.1], [x - wd / 2 + (k + 1) * wd / 6, P + 2.2, F + 2.25], [x - wd / 2 + k * wd / 6, P + 2.2, F + 2.25], k % 2 ? c1 : c2);
    } else { S.box(wd, 0.14, 2.3, x, P + 3.42, F + 1.15, '#d4d1c8'); for (const dx of [-1, 1]) S.box(0.22, 3.3, 0.22, x + dx * (wd / 2 - 0.15), P + 1.7, F + 2.15, '#c9c5bb'); }
    // верхние этажи: окна или лоджия с балюстрадой; кондиционеры; короб-вывеска поперёк улицы
    for (let k = 1; k < floors; k++) {
      const b = P + k * FL, bal = k === 1 ? rnd() < st.balcony : rnd() < st.balcony * 0.5;
      if (bal) {
        S.box(wd - 0.6, 2.3, 0.1, x, b + 1.45, F + 0.01, '#2c3038'); S.box(wd - 0.2, 0.12, 0.9, x, b + 0.22, F + 0.4, '#c9c5bb');
        S.box(wd - 0.3, 0.08, 0.08, x, b + 1.15, F + 0.8, '#f2f0ea'); for (let q = 0; q <= 8; q++) S.box(0.07, 0.86, 0.07, x - (wd - 0.4) / 2 + q * (wd - 0.4) / 8, b + 0.7, F + 0.8, '#f2f0ea');
        if (rnd() < 0.45) Gl.box(wd - 0.8, 1.9, 0.02, x, b + 1.45, F + 0.07, LIT);
      } else for (const dx of [-wd / 4, wd / 4]) {
        S.box(1.15, 1.5, 0.08, x + dx, b + 1.75, F + 0.02, GLASS); S.box(1.3, 0.09, 0.14, x + dx, b + 0.96, F + 0.05, '#d8dade'); S.box(0.06, 1.5, 0.1, x + dx, b + 1.75, F + 0.04, '#d8dade');
        if (rnd() < 0.35) Gl.box(1.05, 1.4, 0.02, x + dx, b + 1.75, F + 0.08, LIT);
      }
      if (rnd() < 0.45) S.box(0.8, 0.55, 0.3, x + wd / 2 - 0.6, b + 0.55, F + 0.16, '#d8dade');
      S.box(1.0, 1.2, 0.08, x, b + 1.7, -F - 0.02, GLASS);                                          // окно во двор
    }
    if (rnd() < 0.5) { const bc = pick(['#c8302a', '#f2c81e', '#1f4fa0', '#2f7a4a', '#f2f2ee']), by = P + FL + 1.7;
      S.box(0.18, 1.7, 1.0, x - wd / 2 + 0.1, by, F + 0.8, bc); S.box(0.2, 0.45, 1.02, x - wd / 2 + 0.1, by + 0.3, F + 0.8, '#f2f2ee');
      Gl.box(0.2, 1.7, 1.0, x - wd / 2 + 0.1, by, F + 0.8, bc); }
    if (st.roof === 'tile') {                                                                      // общая балконная плита и черепица
      S.gable(x, 0, w + 0.02, F + 0.9, P + H, P + H + 1.7, i % 2 ? '#84878a' : '#7c7f82', wall, 'x');
      for (const dz of [-1, 1]) S.box(w, 0.1, 0.12, x, P + H + 0.02, dz * (F + 0.85), '#6a6c6e');
    }
  }
  // st.scooters — доля секций со скутером у бордюра (Чавенг, Ламай); выбор — по месту, общий счётчик случайностей не трогается
  if (st.scooters && !shipyard.dry) for (let i = 0; i < n; i++) { const x = -L / 2 + (i + 0.5) * w;
    for (let k = 0; k < 2; k++) if (hash2(Math.round(x * 7) + k * 13, Math.round(L * 10)) < st.scooters) parkScooter(lot.g, (i * 3 + k + L) | 0, x - 0.8 + k * 1.6, -(F + 2.0), -Math.PI / 2 + (hash2(i, k) - 0.5) * 0.3, 0.16); }
  return townDone(lot, S, Gl, -F, F, 2.9);
}

// ---------- Рыбацкая деревня: ряд деревянных шопхаусов ----------
const FV_WOOD = ['#3b3336', '#57442e', '#4c3639', '#3b3336', '#6a4a34'], FV_BRIGHT = ['#a3552f', '#a06807', '#79abb2', '#bec4c2', '#b8584e', '#d8b24a'];
const FV_ROOF = ['#bf858e', '#515459', '#8a6a5c', '#a8605a', '#5e6266'], FV_SIGNS = ['BAR', 'CAFE', 'THAI FOOD', 'MASSAGE', 'SEAFOOD', 'PIZZA', 'SILK', 'ART', 'TATTOO', 'DIVE', 'SPA', 'GELATO', 'TAILOR', 'JEWELS', 'BEACH BAR', 'TOURS'];
function fvRow(lot, rnd, sea) {
  const { len: L, D } = lot, S = sculptor(), Gl = sculptor(), F = D / 2, n = Math.max(1, Math.round(L / 5)), w = L / n, P = 0.35, V = 2.4, T = sea ? 3.6 : 0;
  const pick = (a) => a[(rnd() * a.length) | 0], dark = (c, k = 0.75) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  S.box(L, 1.9, D + V, 0, P - 0.95, V / 2, '#5a4a3c');                                             // цоколь под домом и верандой
  S.box(L, 0.18, 0.55, 0, 0.09, F + V + 0.27, '#b9b6ae');                                          // ступень к улице
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * w, wd = w - 0.05, wood = pick(FV_WOOD), up = rnd() < 0.42 ? pick(FV_BRIGHT) : wood, roof = pick(FV_ROOF), sign = pick(FV_SIGNS);
    S.box(wd, 3.1, D, x, P + 1.55, 0, wood); S.box(wd, 2.9, D, x, P + 4.55, 0, up); S.box(wd + 0.04, 0.14, D + 0.04, x, P + 3.12, 0, dark(wood));
    for (let k = 1; k < 7; k++) S.box(0.04, 2.8, 0.03, x - wd / 2 + k * wd / 7, P + 4.55, F + 0.016, dark(up, 0.82));   // доски второго этажа
    // первый этаж: открытый проём, сложенные двери по краям, товар или столики
    S.box(wd - 0.9, 2.6, 0.1, x, P + 1.3, F + 0.01, '#231c1a');
    for (const s of [-1, 1]) S.box(0.4, 2.6, 0.12, x + s * (wd / 2 - 0.6), P + 1.3, F + 0.06, dark(wood, 1.25));
    for (let k = 0; k < 3; k++) S.box(0.6, 0.5 + rnd() * 0.5, 0.3, x - 1 + k, P + 0.5 + rnd() * 0.6, F + 0.14, pick(['#e8c82a', '#d84a3a', '#f2f2ee', '#3a8ad8', '#e88a2a', '#5aa83a', '#d86aa8']));
    Gl.box(wd - 1.0, 1.1, 0.02, x, P + 2.0, F + 0.08, '#ffd98a');
    // веранда: столики или кадка с пальмой
    if (rnd() < 0.5) { S.box(0.8, 0.06, 0.8, x - 0.6, P + 0.75, F + 1.2, '#c9b48a'); S.box(0.1, 0.72, 0.1, x - 0.6, P + 0.38, F + 1.2, '#3a3a3c'); for (const s of [-1, 1]) S.box(0.4, 0.45, 0.4, x - 0.6 + s * 0.75, P + 0.24, F + 1.2, '#8a6a4a'); }
    else potPalm(S, x + 0.9, F + 1.5, 1.3, '#b85a3a');
    const balcony = rnd() < 0.3;
    if (balcony) {                                                                                 // балкон с перилами-крестами
      S.box(wd, 0.12, 1.4, x, P + 3.22, F + 0.7, wood); S.box(wd, 0.08, 0.08, x, P + 4.2, F + 1.35, wood);
      for (let k = 0; k < 3; k++) { const xa = x - wd / 2 + k * wd / 3, xb = xa + wd / 3; S.rod([xa, P + 3.3, F + 1.35], [xb, P + 4.2, F + 1.35], 0.05, wood); S.rod([xa, P + 4.2, F + 1.35], [xb, P + 3.3, F + 1.35], 0.05, wood); S.box(0.1, 0.95, 0.1, xa, P + 3.75, F + 1.35, wood); }
      for (const s of [-1, 1]) S.box(0.14, 3.2, 0.14, x + s * (wd / 2 - 0.1), P + 1.6, F + 1.3, wood);
      S.box(1.0, 2.0, 0.08, x, P + 4.3, F + 0.02, '#231c1a'); if (rnd() < 0.5) Gl.box(0.9, 1.9, 0.02, x, P + 4.3, F + 0.07, '#ffe7a6');
    } else {                                                                                       // окна со ставнями и навес над первым этажом
      const nw = wd > 5 ? 3 : 2, sh = pick(['#2f5f4a', '#7a2a2a', '#e8e0c8', '#2a4a6a', dark(up, 0.6)]);
      for (let k = 0; k < nw; k++) { const dx = (k - (nw - 1) / 2) * (wd / nw);
        S.box(0.8, 1.25, 0.06, x + dx, P + 4.7, F + 0.02, '#2c3440'); for (const s of [-1, 1]) S.box(0.36, 1.25, 0.05, x + dx + s * 0.6, P + 4.7, F + 0.05, sh);
        if (rnd() < 0.35) Gl.box(0.72, 1.15, 0.02, x + dx, P + 4.7, F + 0.06, '#ffe7a6'); }
      S.quad([x - w / 2, P + 3.3, F], [x + w / 2, P + 3.3, F], [x + w / 2, P + 2.8, F + V + 0.2], [x - w / 2, P + 2.8, F + V + 0.2], i % 2 ? '#7c8086' : '#8a6e60');
      for (const s of [-1, 1]) S.box(0.13, 2.8, 0.13, x + s * (w / 2 - 0.07), P + 1.4, F + V - 0.1, wood);
    }
    // вывеска под навесом и доска поперёк улицы
    { const sc = pick(['#f2ecd8', '#2a2a2c', '#7a2a2a', '#2f5f4a', '#d8b24a']), ink = sc === '#f2ecd8' || sc === '#d8b24a' ? '#2a2420' : '#f6ecd8', px = Math.min(0.085, 1.9 / hudWidth(hudText(sign)));
      S.box(2.3, 0.6, 0.08, x, P + 2.45, F + V - 0.25, sc); S.text(sign, x, P + 2.45 + px * 2.5, F + V - 0.2, px, ink, 1);
      Gl.box(2.3, 0.6, 0.02, x, P + 2.45, F + V - 0.2, sc); Gl.text(sign, x, P + 2.45 + px * 2.5, F + V - 0.18, px, ink, 1); }
    if (rnd() < 0.4) { S.box(0.1, 0.9, 0.9, x - wd / 2 + 0.2, P + 3.9, F + 0.9, pick(['#c8302a', '#f2ecd8', '#2a2a2c'])); Gl.box(0.12, 0.3, 0.3, x - wd / 2 + 0.2, P + 3.25, F + 0.9, '#ff5a3a'); }   // вывеска-консоль и красный фонарь
    // крыша: конёк вдоль улицы или фронтон на улицу
    if (rnd() < 0.72) S.gable(x, 0, w + 0.02, F + 0.7, P + 6.0, P + 8.1 + rnd() * 0.5, roof, up, 'x');
    else S.gable(x, 0, D + 1.2, w / 2 + 0.12, P + 6.0, P + 8.7, roof, up, 'z');
    if (sea) {                                                                                     // задняя стена открыта на террасу
      S.box(wd - 1.0, 2.5, 0.1, x, P + 1.25, -F - 0.01, '#231c1a'); Gl.box(wd - 1.2, 1.0, 0.02, x, P + 1.9, -F - 0.08, '#ffd98a');
      S.box(1.2, 1.2, 0.08, x, P + 4.6, -F - 0.02, '#2c3440');
    }
  }
  if (sea) {                                                                                       // терраса на сваях над песком: перила, столики, зонты, лестница на пляж
    const zt = -F - T / 2, WD = '#7a5a40', WD_D = '#4a3628', xs = (rnd() - 0.5) * (L - 6);
    S.box(L, 0.2, T, 0, P - 0.1, zt, WD);
    for (let x = -L / 2 + 0.3; x <= L / 2; x += Math.max(2.5, (L - 0.6) / Math.round(L / 3))) for (const z of [-F - 0.4, -F - T + 0.3]) S.box(0.22, 3.4, 0.22, x, P - 1.9, z, WD_D);
    for (const [a, b] of [[-L / 2, xs - 0.8], [xs + 0.8, L / 2]]) if (b > a) { S.box(b - a, 0.08, 0.08, (a + b) / 2, P + 0.95, -F - T + 0.1, WD_D); S.box(b - a, 0.06, 0.06, (a + b) / 2, P + 0.5, -F - T + 0.1, WD_D); for (let x = a; x <= b + 0.01; x += (b - a) / Math.max(1, Math.round((b - a) / 1.6))) S.box(0.09, 0.95, 0.09, x, P + 0.48, -F - T + 0.1, WD_D); }
    for (const s of [-1, 1]) { S.box(0.08, 0.08, T, s * (L / 2 - 0.08), P + 0.95, zt, WD_D); S.box(0.09, 0.95, 0.09, s * (L / 2 - 0.08), P + 0.48, -F - T / 2, WD_D); }
    for (let k = 0; k < 9; k++) S.box(1.4, 0.12, 0.34, xs, P - 0.2 - k * 0.3, -F - T - 0.15 - k * 0.32, WD);              // лестница
    for (const s of [-1, 1]) S.rod([xs + s * 0.75, P + 0.9, -F - T], [xs + s * 0.75, P - 1.9, -F - T - 3.0], 0.07, WD_D);
    for (let x = -L / 2 + 2; x < L / 2 - 1; x += 3.4) if (Math.abs(x - xs) > 1.6) {
      S.box(0.9, 0.06, 0.9, x, P + 0.75, zt, '#f2ecd8'); S.box(0.1, 0.72, 0.1, x, P + 0.38, zt, '#3a3a3c');
      for (const s of [-1, 1]) S.box(0.42, 0.45, 0.42, x + s * 0.8, P + 0.24, zt, '#8a6a4a');
      if (rnd() < 0.5) { const uc = pick(['#f2ecd8', '#c8302a', '#2f7a8a', '#e8a03a']); S.tube(x, P + 0.8, P + 2.5, zt, 0.04, 0.04, '#3a3a3c', 5); S.hip(x, zt, 1.3, 1.3, P + 2.35, 0.05, 0.05, P + 2.85, (q) => q % 2 ? uc : '#f2ecd8'); }
      Gl.box(0.18, 0.18, 0.18, x, P + 0.9, zt, '#ffe7a6');
    }
  }
  return townDone(lot, S, Gl, -F - T, F + V, V + 0.6);
}

// ---------- Хуа Танон: дощатый дом на сваях у пляжа (веранда — к морю, от улицы) ----------
function stiltRow(lot, rnd) {
  const { len: L, D } = lot, S = sculptor(), Gl = sculptor(), F = D / 2, P = 1.0, pick = (a) => a[(rnd() * a.length) | 0];
  const wall = pick(['#4f545e', '#6a6e74', '#4b6680', '#5c5a54', '#7a6a58']), roof = pick(['#89675e', '#7a5a50', '#96786a', '#6e6058']), n = Math.max(1, Math.round(L / 13)), w = L / n;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * w, wd = w - 1.2, Dh = D - 2.4, zc = 1.2;                         // дом: z от −F+2.4 (к морю — веранда) до F
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) S.box(0.2, P + 2.6, 0.2, x + a * (wd / 2 - 0.2), (P - 2.6) / 2, zc + b * (Dh / 2 - 0.2) - (b < 0 ? 2.0 : 0), '#5a4a3c');   // сваи (передний ряд — под верандой)
    S.box(wd, 0.16, D - 0.2, x, P - 0.08, 0, '#7a6a58');                                             // настил дома и веранды
    S.box(wd, 2.5, Dh, x, P + 1.25, zc, wall);
    for (let k = 1; k < 9; k++) S.box(0.04, 2.4, 0.03, x - wd / 2 + k * wd / 9, P + 1.25, zc - Dh / 2 - 0.016, '#3a3c42');
    S.box(0.9, 1.9, 0.08, x - wd / 4, P + 0.95, zc - Dh / 2 - 0.03, '#2a2622'); S.box(1.2, 0.9, 0.08, x + wd / 4, P + 1.5, zc - Dh / 2 - 0.03, '#2c3440');   // дверь и окно на веранду
    S.box(1.1, 0.9, 0.08, x, P + 1.5, zc + Dh / 2 + 0.03, '#2c3440');                               // окно на улицу
    Gl.box(1.0, 0.8, 0.02, x + wd / 4, P + 1.5, zc - Dh / 2 - 0.08, '#ffe2a0');
    // пологая ржавая крыша с выносом над верандой
    S.quad([x - w / 2 + 0.3, P + 2.5, -F - 0.3], [x + w / 2 - 0.3, P + 2.5, -F - 0.3], [x + w / 2 - 0.3, P + 3.9, zc], [x - w / 2 + 0.3, P + 3.9, zc], roof);
    S.quad([x - w / 2 + 0.3, P + 2.6, F + 0.5], [x + w / 2 - 0.3, P + 2.6, F + 0.5], [x + w / 2 - 0.3, P + 3.9, zc], [x - w / 2 + 0.3, P + 3.9, zc], rnd() < 0.5 ? roof : '#8a8c8e');
    for (const s of [-1, 1]) S.tri([x + s * wd / 2, P + 2.5, zc - Dh / 2], [x + s * wd / 2, P + 2.5, zc + Dh / 2], [x + s * wd / 2, P + 3.85, zc], wall);
    for (const s of [-1, 1]) S.box(0.12, 2.5, 0.12, x + s * (wd / 2 - 0.1), P + 1.25, -F + 0.2, '#5a4a3c');
    S.box(wd, 0.07, 0.07, x, P + 0.9, -F + 0.15, '#5a4a3c');                                         // перила веранды
    // лестница с улицы, синий тент, бочка и сети под домом
    for (let k = 0; k < 4; k++) S.box(1.0, 0.1, 0.3, x - wd / 2 + 0.8, P - 0.12 - k * 0.25, F - 0.2 + k * 0.3, '#7a6a58');
    if (rnd() < 0.6) S.quad([x - 1.5, P + 2.3, -F - 0.3], [x + 1.5, P + 2.3, -F - 0.3], [x + 1.5, P + 1.7, -F - 2.2], [x - 1.5, P + 1.7, -F - 2.2], '#124090');
    S.tube(x + wd / 2 - 0.8, P - 1.0, P - 0.1, -F + 1.2, 0.3, 0.3, '#2a4a8a', 7); S.box(1.6, 0.5, 1.0, x - 0.5, P - 0.85, 0.5, '#3a7a5a');
  }
  return townDone(lot, S, Gl, -F + 0.2, F, 0.8);
}

// лодка на песке или на воде: твёрдая. make — конструктор из boats.js
function townBoat(make, x, z, yaw, rnd, tilt = 0) {
  const boat = make(rnd), bb = new THREE.Box3().setFromObject(boat), y = groundY(x, z);
  boat.position.set(x, y > 0.05 ? y + 0.3 : 0, z); boat.rotation.y = yaw; boat.rotation.z = y > 0.05 ? tilt : 0;
  scene.add(boat); boat.updateMatrixWorld(true);
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, hl = (bb.max.x - bb.min.x) * 0.45, hw = (bb.max.z - bb.min.z) * 0.4;
  const P = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([u, v]) => boat.localToWorld(new THREE.Vector3(cx + u, 0, cz + v)));
  P.forEach((p, k) => { const q = P[(k + 1) % 4]; walls.push([p.x, p.z, q.x, q.z]); }); solids.push(P.map((p) => [p.x, p.z]));
  boat.userData.c = new THREE.Vector3(x, 0, z); townSeen(boat);
  vegKeepOut.push(Object.assign((px, pz) => (px - x) ** 2 + (pz - z) ** 2 < 30, { c: [x, z, 6] }));
}
// группа с осями «u — по азимуту az (рад), v — влево», стоящая на высоте моря
function townGroup(x, z, az) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -az; scene.add(g); g.updateMatrixWorld(true); g.userData.c = new THREE.Vector3(x, 0, z); townSeen(g); return g; }
// бетонный проезд по земле от точки (x0, z0) до точки (x1, z1) шириной wid; blend — конец у (x1, z1) плавно сходит на асфальт дороги
function townPath(x0, z0, x1, z1, wid, color = '#a29f96', blend = false) {
  const g = townGroup(x0, z0, Math.atan2(z1 - z0, x1 - x0)), S = sculptor(), len = Math.hypot(x1 - x0, z1 - z0);
  drape(S, g, 0, len, -wid / 2, wid / 2, (i) => i % 2 ? color : '#' + new THREE.Color(color).multiplyScalar(0.95).getHexString(), 0.07, 2);
  g.add(S.mesh());
  if (blend) padBlend(g, len, 1, -wid / 2, wid / 2, color, 3.0);
  const c = [(x0 + x1) / 2, (z0 + z1) / 2];
  vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -1 && p.x < len + 1 && Math.abs(p.z) < wid / 2 + 0.6; }, { c: [c[0], c[1], len / 2 + wid] }));
  return g;
}

// =====================================================================================================
// НАТОН
// =====================================================================================================
function buildNathon() {
  const R = roads[0], W = roads.find((q) => /ชลวิถี/.test(q.name)), wi = roads.indexOf(W), rnd = seededRandom(9534);
  const [nx, nz] = pierXZ(9.5345, 99.9360), q0 = roadProj(0, nx, nz);
  if (!q0) return;
  const S0 = q0.s - 248, S1 = q0.s + 44;                                                             // главная улица: от северного въезда до пляжа
  TOWN.claims.push({ r: 0, s0: S0 - 10, s1: S1 + 6 });
  // --- переулки между главной улицей и набережной (в них ряды не ставятся) ---
  if (W) for (const ds of [-212, -148]) {
    const a = roadPoint(R, q0.s + ds, halfR + 0.2), b = roadPoint(R, q0.s + ds, 100), pj = roadProj(wi, b[0], b[1]);
    let d = halfR + 2; while (d < 100) { const p = roadPoint(R, q0.s + ds, d), h = roadAt(p[0], p[1], Infinity, 0); if (h && h.d < halfR) break; d += 0.5; }
    if (d < 99) { const e = roadPoint(R, q0.s + ds, d - 0.2); townPath(a[0], a[1], e[0], e[1], 5.5, '#8f8c84'); }
  }
  // --- крытый рынок (вид придуман: фото снаружи нет): длинный ангар под двускатной крышей, по бокам открытые ряды ---
  { const lot = townLot(R, 0, q0.s - 20, 44, 1, 10.4, 18, { drop: 2.4 });
    if (lot) {
      const { len: L, D } = lot, S = sculptor(), Gl = sculptor(), F = D / 2, P = 0.2;
      S.box(L, 2.4, D, 0, P - 1.2, 0, '#8f8b80'); townWalk(lot, S, 2.7, '#2a2a2c');
      S.box(L, 1.1, D, 0, P + 0.55, 0, '#e6e2d6'); for (let x = -L / 2; x <= L / 2 + 0.01; x += L / 10) for (const z of [-F + 0.2, F - 0.2]) S.box(0.36, 4.2, 0.36, x, P + 2.1, z, '#d8d4c8');
      for (let x = -L / 2 + L / 20; x < L / 2; x += L / 10) { S.box(L / 10 - 0.6, 1.6, 0.08, x, P + 1.9, F - 0.25, '#2a2622'); for (let k = 0; k < 3; k++) S.box(0.9, 0.5, 0.5, x - 1 + k, P + 1.3, F - 0.6, ['#e8c82a', '#5aa83a', '#d84a3a', '#e88a2a'][(k + (x | 0) + 40) % 4]); Gl.box(L / 10 - 0.8, 0.9, 0.02, x, P + 2.6, F - 0.2, '#ffdf9a'); }
      S.box(L, 0.5, D, 0, P + 4.2, 0, '#c9c5bb');
      S.gable(0, 0, L + 1.6, F + 1.4, P + 4.4, P + 7.4, '#73ae97', '#e6e2d6', 'x'); S.gable(0, 0, L * 0.86, 2.2, P + 7.0, P + 8.3, '#5e9a84', '#e6e2d6', 'x');   // зелёная кровля с фонарём-продухом
      for (let x = -L / 2 + 2; x < L / 2; x += 4) S.box(0.07, 0.03, D + 2.6, x, P + 5.95, 0, '#5e9a84');
      for (const z of [F + 0.05, -F - 0.05]) for (let k = 0; k < 8; k++) S.quad([-L / 2 + k * L / 8, P + 3.4, z], [-L / 2 + (k + 1) * L / 8, P + 3.4, z], [-L / 2 + (k + 1) * L / 8, P + 2.7, z + Math.sign(z) * 2.3], [-L / 2 + k * L / 8, P + 2.7, z + Math.sign(z) * 2.3], k % 2 ? '#73ae97' : '#f2f2ee');   // маркизы над рядами
      { const zs = F + 2.55, bh = signFit('NATHON MARKET', 13, 0.15).h + 0.5, yc = P + 4.6 + bh / 2;   // над английской — тайская строка
        S.box(14.4, bh, 0.24, 0, yc, zs, '#2e917d'); S.box(14.8, 0.14, 0.34, 0, yc + bh / 2 + 0.07, zs, '#f2f2ee'); S.box(14.8, 0.14, 0.34, 0, yc - bh / 2 - 0.07, zs, '#f2f2ee');
        signLines(S, 'NATHON MARKET', 13, '#f8f4e6', zs + 0.14, 0.15, 0, yc);
        Gl.box(14.4, bh, 0.02, 0, yc, zs + 0.13, '#2e917d'); signLines(Gl, 'NATHON MARKET', 13, '#fff8e0', zs + 0.16, 0.15, 0, yc);
        for (const x of [-6.9, 6.9]) S.box(0.5, 6.5, 0.5, x, P + 3.05, zs, '#e6e2d6'); }
      townDone(lot, S, Gl, -F, F, 2.9);
    } }
  // --- старый деревянный дом под красной черепицей: фронтон на улицу и вальмовое крыло, резной подзор, шпили на коньках ---
  { let lot = null; for (let ds = -34; ds < 30 && !lot; ds += 3) lot = townLot(R, 0, q0.s + ds, 13, -1, 10.4, 9);
    if (lot) {
      const S = sculptor(), Gl = sculptor(), F = 4.5, P = 0.4, WD = '#48262b', DOOR = '#9d7863', TILE = ['#844b56', '#8f525c'];
      S.box(13, 2.2, 9, 0, P - 1.1, 0, '#8f8b80'); townWalk(lot, S, 2.7, '#c8302a');
      S.box(6.2, 3.0, 9, -3.3, P + 1.5, 0, WD); S.box(6.4, 3.0, 8.4, 3.2, P + 1.5, -0.3, WD);
      for (const [x, n] of [[-3.3, 3], [3.2, 3]]) for (let k = 0; k < n; k++) { const dx = x + (k - 1) * 1.8; S.box(1.3, 2.3, 0.08, dx, P + 1.2, (x < 0 ? F : F - 0.6) + 0.03, DOOR); S.box(0.06, 2.3, 0.1, dx, P + 1.2, (x < 0 ? F : F - 0.6) + 0.05, WD); S.box(1.1, 0.7, 0.03, dx, P + 1.8, (x < 0 ? F : F - 0.6) + 0.08, '#3a4450'); }
      Gl.box(1.0, 0.6, 0.02, -3.3, P + 1.8, F + 0.1, '#ffe2a0');
      S.gable(-3.3, 0.3, 10.4, 3.7, P + 3.0, P + 5.6, TILE[0], WD, 'z');                               // фронтон на улицу
      S.hip(3.2, -0.3, 3.8, 5.0, P + 3.0, 0.3, 1.6, P + 5.3, (i) => TILE[i % 2]);                       // вальмовое крыло
      for (let k = 0; k < 14; k++) S.box(0.3, 0.3 + (k % 2) * 0.12, 0.05, -6.6 + k * 0.5, P + 2.85, F + 0.75, '#e8dcc0');   // резной подзор
      for (const [x, y, z] of [[-3.3, P + 5.6, 5.5], [-3.3, P + 5.6, -4.9], [3.2, P + 5.3, 1.3], [3.2, P + 5.3, -1.9]]) S.tube(x, y, y + 0.7, z, 0.1, 0.01, '#e8dcc0', 5);   // шпили-«рожки»
      for (const x of [-6.2, -0.4, 0.2, 6.2]) S.box(0.18, 2.9, 0.18, x, P + 1.45, F + 0.7, WD);
      S.quad([-6.5, P + 3.0, F], [6.5, P + 3.0, F], [6.5, P + 2.6, F + 1.1], [-6.5, P + 2.6, F + 1.1], TILE[1]);
      townDone(lot, S, Gl, -F, F, 2.9);
    } }
  // --- ряды шопхаусов: главная улица с обеих сторон, набережная — со стороны города ---
  const make = (lot, r) => shophouseRow(lot, r, NATHON_STYLE), LENS = [27.6, 23, 18.4, 13.8, 9.2];
  for (const side of [1, -1]) townStreet(R, 0, S0, S1, side, 10.4, 12, LENS, 0.5, { drop: 2.4 }, make, rnd);
  if (W) {
    TOWN.claims.push({ r: wi, s0: 0, s1: W.len });
    townStreet(W, wi, 34, W.len - 8, 1, 10.4, 11, LENS, 0.5, { drop: 2.4, rise: 2.6, bend: 1.3, minH: 0.35 }, make, rnd);
    // набережная: зонты торговцев и скамьи со стороны моря — сбиваются; деревья
    const g = new THREE.Group(); scene.add(g);
    for (let s = 52, i = 0; s < W.len - 14; s += 13, i++) {
      const p = roadPoint(W, s, -(halfS + 1.6)), y = groundY(p[0], p[1]);
      if (y < 0.5 || townBlocked(p[0], p[1])) continue;
      if (i % 3 === 2) { VEG_EXTRA.push([p[0], p[1], i % 2 ? 'areca' : 'coconut']); continue; }
      const uc = ['#c8302a', '#2f7a8a', '#e8a03a', '#f2ecd8', '#2f5fa8'][i % 5];
      templeProp(g, p[0], -p[1], (B) => {
        if (i % 3 === 0) { B.tube(0, y, y + 2.3, 0, 0.04, 0.04, '#3a3a3c', 5); B.hip(0, 0, 1.4, 1.4, y + 2.15, 0.05, 0.05, y + 2.7, (q) => q % 2 ? uc : '#f2ecd8'); B.box(1.3, 0.75, 0.7, 0.3, y + 0.38, 0.2, '#c9b48a'); for (let k = 0; k < 3; k++) B.box(0.34, 0.2, 0.34, -0.1 + k * 0.4, y + 0.86, 0.2, ['#e8c82a', '#5aa83a', '#e88a2a'][k]); }
        else { B.box(1.8, 0.08, 0.5, 0, y + 0.46, 0, '#8a6a3a'); B.box(1.8, 0.4, 0.08, 0, y + 0.78, 0.22, '#8a6a3a'); for (const dx of [-0.75, 0.75]) B.box(0.1, 0.46, 0.44, dx, y + 0.23, 0, '#4a4a4c'); }
      }, { kind: 'small', mat: 'wood', color: i % 3 ? '#8a6a3a' : uc, r: 0.9, loss: 0.03 });
    }
    g.userData.c = new THREE.Vector3(nx + 150, 0, nz - 80); townSeen(g);
  }
  const tp = roadPoint(R, S0 + 16, 2.5);
  LANDMARKS.push({ name: 'НАТОН', x: tp[0], z: tp[1], heading: Math.atan2(-tp[2], -tp[3]) });
}

// =====================================================================================================
// РЫБАЦКАЯ ДЕРЕВНЯ (БОПХУТ)
// =====================================================================================================
function buildFishermansVillage() {
  const R = roads.find((q) => q.name === 'spot fishermans_village'), r = roads.indexOf(R);
  if (!R || !IS.spots.fishermans_village) return;
  const g = spotGroup('fishermans_village'), rnd = seededRandom(5599), FR = 5.9, D = 12;
  // где улица поворачивает вдоль берега: конец въезда — там, где курс дороги сравнялся с осью u
  let sTurn = 0; for (let s = 20; s < R.len; s += 2) { const p = roadPoint(R, s, 0), q = g.worldToLocal(new THREE.Vector3(p[0], 0, p[1])); if (-q.z < 9) { sTurn = s; break; } }
  // дорожка от перекрёстка к пирсу и песчаный спуск — дома её не занимают
  const P = IS.piers.bophut, pl = P ? g.worldToLocal(new THREE.Vector3(P.x, 0, P.z)) : null;
  if (pl) { const a = g.localToWorld(new THREE.Vector3(pl.x, 0, -7.5)), b = g.localToWorld(new THREE.Vector3(pl.x, 0, pl.z + 2)); townPath(a.x, a.z, b.x, b.z, 4.2, '#b4b2aa'); }
  // въездная арка-вывеска поперёк дороги: пролёт 10 м, щит на высоте 4.5–6.5 м
  { const s = Math.max(24, sTurn - 58), p = roadPoint(R, s, 0), y = asphaltTop(p[0], p[1]), ag = new THREE.Group(), S = sculptor(), Gl = sculptor();
    ag.position.set(p[0], y, p[1]); ag.rotation.y = Math.atan2(p[2], p[3]); scene.add(ag); ag.updateMatrixWorld(true);   // локальная +Z — вдоль дороги
    for (const sx of [-1, 1]) { S.box(0.6, 6.9, 0.6, sx * 5.2, 3.2, 0, '#6a4a2e'); S.box(1.1, 0.5, 1.1, sx * 5.2, 0.15, 0, '#8a8478'); S.rod([sx * 5.2, 3.6, 0], [sx * 3.6, 4.6, 0], 0.22, '#6a4a2e'); wallBox(ag, sx * 5.2, 0, 0.8, 0.8); }
    S.box(11.6, 0.3, 0.5, 0, 6.75, 0, '#6a4a2e'); S.box(10.2, 1.9, 0.22, 0, 5.55, 0, '#f2ecd8'); S.box(10.4, 0.16, 0.3, 0, 4.55, 0, '#6a4a2e');
    S.gable(0, 0, 12.6, 0.7, 6.9, 7.5, '#8a6a5c', '#6a4a2e', 'x');
    for (const face of [1, -1]) for (const [T, c] of [[S, '#7a2a2a'], [Gl, '#fff4d8']]) {
      const A = sculptor(); A.text("FISHERMAN'S", 0, 0.82, 0.13, 0.13, c, 1); A.text('VILLAGE', 0, -0.06, 0.13, 0.13, c, 1);
      const m = T === S ? hotelMesh(A) : A.mesh(); if (T !== S) { m.material = TOWN.lit || (TOWN.lit = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); m.visible = false; nightGlow.push(m); }
      m.rotation.y = face > 0 ? 0 : Math.PI; m.position.set(0, 5.55, 0); if (T !== S) m.position.z = face * 0.012; ag.add(m);
    }
    ag.add(hotelMesh(S)); ag.userData.c = new THREE.Vector3(p[0], 0, p[1]); townSeen(ag);
    vegKeepOut.push(Object.assign((x, z) => (x - p[0]) ** 2 + (z - p[1]) ** 2 < 49, { c: [p[0], p[1], 7] })); }
  // ряды домов: вдоль пляжа с обеих сторон (со стороны моря — с террасами на сваях), и по въездной улице
  const LENS = [25, 20, 15, 10];
  const seaSide = (() => { const p = roadPoint(R, R.len - 40, 14), q = roadPoint(R, R.len - 40, -14); return groundY(p[0], p[1]) < groundY(q[0], q[1]) ? 1 : -1; })();
  townStreet(R, r, sTurn + 6, R.len - 3, seaSide, FR, D, LENS, 0.3, { back: 3.8, minH: 0.25, drop: 2.6 }, (lot, q) => fvRow(lot, q, true), rnd);
  townStreet(R, r, sTurn + 14, R.len - 3, -seaSide, FR, D, LENS, 0.3, {}, (lot, q) => fvRow(lot, q, false), rnd);
  for (const side of [1, -1]) townStreet(R, r, Math.max(30, sTurn - 50), sTurn - 12, side, FR, D, LENS, 0.3, {}, (lot, q) => fvRow(lot, q, false), rnd);
  // гирлянды лампочек через улицу и скутеры у веранд
  { const S = sculptor(), Gl = sculptor(), c = roadPoint(R, (sTurn + R.len) / 2, 0), sg = new THREE.Group(); scene.add(sg);
    for (let s = sTurn + 12, i = 0; s < R.len - 6; s += 11, i++) {
      const a = roadPoint(R, s, 5.7), b = roadPoint(R, s + (i % 2 ? 3 : -3), -5.7), y = asphaltTop(...roadPoint(R, s, 0).slice(0, 2)) + 5.0;
      S.rod([a[0], y, a[1]], [b[0], y, b[1]], 0.03, '#1c1c1e');
      for (let k = 1; k < 10; k++) { const t = k / 10, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, yy = y - Math.sin(t * Math.PI) * 0.45; S.box(0.1, 0.14, 0.1, x, yy - 0.08, z, '#e8e4d8'); Gl.box(0.16, 0.18, 0.16, x, yy - 0.08, z, ['#fff2c0', '#ffd0a0', '#ff9a8a'][k % 3]); }
      if (i % 3 === 1) parkScooter(sg, i * 7 + 3, roadPoint(R, s + 4, (i % 2 ? 1 : -1) * 3.25)[0], -roadPoint(R, s + 4, (i % 2 ? 1 : -1) * 3.25)[1], Math.atan2(-roadPoint(R, s, 0)[3], roadPoint(R, s, 0)[2]) + 0.35, y - 5.0 + 0.02);
    }
    const m = hotelMesh(S), gm = Gl.mesh(); gm.material = TOWN.lit || (TOWN.lit = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); gm.visible = false; nightGlow.push(gm);
    sg.add(m, gm); sg.userData.c = new THREE.Vector3(c[0], 0, c[1]); townSeen(sg); }
  const tp = roadPoint(R, Math.max(8, sTurn - 78), 0);
  LANDMARKS.push({ name: 'РЫБАЦКАЯ ДЕРЕВНЯ', x: tp[0], z: tp[1], heading: Math.atan2(-tp[2], -tp[3]) });
}

// =====================================================================================================
// ХУА ТАНОН
// =====================================================================================================
function buildHuaThanon() {
  const R = roads[0], rnd = seededRandom(9444), [hx, hz] = pierXZ(9.4440, 100.0245), q0 = roadProj(0, hx, hz);
  if (!q0) return;
  const S0 = q0.s - 182, S1 = q0.s + 262;                                                            // вдоль кольцевой: от западного въезда до северного края деревни
  TOWN.claims.push({ r: 0, s0: S0 - 8, s1: S1 + 8 });
  // где море: у поворота дорога идёт вдоль самого берега
  const sea = (() => { const p = roadPoint(R, q0.s + 60, 26), q = roadPoint(R, q0.s + 60, -26); return groundY(p[0], p[1]) < groundY(q[0], q[1]) ? 1 : -1; })();
  // --- набережная-причал с беседкой, бетонный проезд к ней от дороги, рыбный рынок у корня причала (refs/fresh_market_hua_thanon) ---
  { let root = null;                                                                                // корень причала: берег в 45–75 м южнее поворота
    for (let d = 40; d < 90 && !root; d += 2) for (let e = -60; e < 40; e += 1) { const x = hx - d, z = hz + e; if (groundY(x, z) > 0.35 && groundY(x, z + 3) < 0.2 && groundY(x, z + 14) < -0.2 && !townBlocked(x, z) && d > 52) { root = [x, z]; break; } }
    if (root) {
      const az = 1.75, g = townGroup(root[0], root[1], az), S = sculptor(), Y = 1.25, LQ = 52, HW = 3.6, PW = 6.5;   // ось причала — на восток-юго-восток
      S.box(LQ + 10, 0.5, 2 * HW, LQ / 2 - 5, Y - 0.25, 0, '#a8a59c'); S.box(2 * PW, 0.5, 2 * PW, LQ + PW, Y - 0.25, 0, '#a8a59c');
      for (let u = 2; u < LQ + 2 * PW; u += 7) for (const s of [-1, 1]) S.tube(u, -2.5, Y - 0.4, s * (u > LQ ? PW - 0.6 : HW - 0.5), 0.3, 0.3, '#8a877e', 7);
      for (let u = -6; u < LQ; u += 4) S.box(0.08, 0.03, 2 * HW, u, Y + 0.012, 0, '#8e8b82');
      // беседка на площадке
      for (const a of [-1, 1]) for (const b of [-1, 1]) S.box(0.24, 3.0, 0.24, LQ + PW + a * 2.4, Y + 1.5, b * 2.4, '#f2f0ea');
      S.hip(LQ + PW, 0, 3.4, 3.4, Y + 2.9, 0.2, 0.2, Y + 4.4, (i) => i % 2 ? '#51724c' : '#5e8258'); S.tube(LQ + PW, Y + 4.4, Y + 5.0, 0, 0.1, 0.01, '#d8b24a', 5);
      S.box(3.6, 0.1, 0.5, LQ + PW, Y + 0.5, 2.0, '#8a6a3a'); S.box(3.6, 0.1, 0.5, LQ + PW, Y + 0.5, -2.0, '#8a6a3a');
      g.add(hotelMesh(S));
      spotPlate(g, -9, 0, 0, HW, groundY(...[g.localToWorld(new THREE.Vector3(-9, 0, 0))].map((w) => [w.x, w.z])[0]) + 0.05, Y + 0.02, true); spotPlate(g, 0, LQ, 0, HW, Y + 0.02); spotPlate(g, LQ, LQ + 2 * PW, 0, PW, Y + 0.02);
      armFence(buildFence(g, [[2, HW - 0.15, LQ, HW - 0.15], [LQ, HW - 0.15, LQ, PW - 0.15], [LQ, PW - 0.15, LQ + 2 * PW - 0.15, PW - 0.15], [LQ + 2 * PW - 0.15, PW - 0.15, LQ + 2 * PW - 0.15, -PW + 0.15], [LQ + 2 * PW - 0.15, -PW + 0.15, LQ, -PW + 0.15], [LQ, -PW + 0.15, LQ, -HW + 0.15], [LQ, -HW + 0.15, 2, -HW + 0.15]],
        { step: 2.4, y0: Y, post: [0.14, 1.0, '#e8e6de'], bars: [[0.95, 0.09, '#2f5f9a'], [0.5, 0.07, '#2f5f9a']], kind: 'rail', loss: 0.04 }));
      // проезд от дороги к причалу
      { let best = null; for (let s = q0.s - 60; s < q0.s + 20; s += 2) { const p = roadPoint(R, s, sea * (halfR + 0.4)), d = Math.hypot(p[0] - root[0], p[1] - root[1]); let free = true; for (let t = 0.1; t < 1; t += 0.1) if (townBlocked(root[0] + (p[0] - root[0]) * t, root[1] + (p[1] - root[1]) * t) || groundY(root[0] + (p[0] - root[0]) * t, root[1] + (p[1] - root[1]) * t) < 0.3) free = false; if (free && (!best || d < best[0])) best = [d, p]; }
        const w0 = g.localToWorld(new THREE.Vector3(-8, 0, 0));
        if (best) townPath(w0.x, w0.z, best[1][0], best[1][1], 5, '#a29f96', true); }
      // рыбный рынок (фото 03, 04): длинный низкий зал на деревянных фермах под профлистом, бока открыты; внутри два ряда
      // бетонных прилавков с алюминиевыми подносами рыбы и ракушек, весами-циферблатами, синими и зелёными корзинами.
      // По OSM корпус 27 × 9 м; если столько места у причала нет — зал короче. Колонны твёрдые, прилавки сбиваются.
      // Место — у корня причала, ближе всего к точке OSM (u −22, v 13); рядом 7-Eleven, и зал обходит его площадку.
      { const fits = (mu, mv, L) => [-1, -0.5, 0, 0.5, 1].every(a => [-1, 0, 1].every(b => { const q = g.localToWorld(new THREE.Vector3(mu + a * (L / 2 + 0.5), 0, -(mv + b * 5))); return groundY(q.x, q.z) > 0.5 && !townBlocked(q.x, q.z); }));
        let best = null;
        for (const L of [24, 20, 16]) { for (let mu = -12; mu >= -60; mu -= 2) for (let mv = -30; mv <= 34; mv += 2) { const d = Math.hypot(mu + 22, mv - 13); if ((!best || d < best.d) && d < 40 && fits(mu, mv, L)) best = { mu, mv, L, d }; } if (best) break; }
        const { mu, mv, L } = best || { mu: 0, mv: 0, L: 0 }, w = g.localToWorld(new THREE.Vector3(mu, 0, -mv)), y = groundY(w.x, w.z), M = sculptor();
        if (best) {
          const WOOD = '#7a5a3c', ROOF = '#8e9aa0', EAVE = 3.2, RIDGE = 4.7, n = Math.round(L / 4);
          for (let i = 0; i <= n; i++) {
            const a = -L / 2 + L * i / n;
            for (const b of [-4.3, 4.3]) { M.box(0.26, EAVE, 0.26, mu + a, y + EAVE / 2, -(mv + b), WOOD); wallBox(g, mu + a, mv + b, 0.36, 0.36); }
            M.box(0.14, 0.18, 10.2, mu + a, y + EAVE, -mv, WOOD);                                                             // затяжка
            for (const sg of [-1, 1]) M.rod([mu + a, y + EAVE - 0.1, -(mv + sg * 5.1)], [mu + a, y + RIDGE, -mv], 0.16, WOOD);   // стропила
            M.box(0.12, RIDGE - EAVE, 0.12, mu + a, y + (EAVE + RIDGE) / 2, -mv, WOOD);
          }
          M.gable(mu, -mv, L + 1.2, 5.3, y + EAVE - 0.12, y + RIDGE + 0.04, ROOF, ROOF, 'x');
          for (const f of [-0.6, 0.6]) M.box(L + 1.2, 0.1, 0.08, mu, y + EAVE + (RIDGE - EAVE) * (1 - Math.abs(f)) - 0.12, -(mv + f * 5.1), WOOD);   // прогоны
          for (let a = -L / 2 + 2; a < L / 2 - 1; a += 4) M.box(1.2, 0.06, 0.1, mu + a, y + EAVE - 0.2, -mv, '#f4f8ff');       // лампы
          M.quad([mu - L / 2 - 0.5, y + 0.05, -mv - 5], [mu + L / 2 + 0.5, y + 0.05, -mv - 5], [mu + L / 2 + 0.5, y + 0.05, -mv + 5], [mu - L / 2 - 0.5, y + 0.05, -mv + 5], '#a8a59c');
          // вывеска на торце со стороны дороги: тайская строка и английская (как у других рынков)
          { const bu = mu - L / 2 - 0.8, faces = [sculptor(), sculptor()]; let th = 0; for (const T of faces) th = signLines(T, 'HUA THANON MARKET', 6.4, '#fff8e0', 0.08, 0.09);
            const bh = th + 0.4, by = y + EAVE + 0.1 + bh / 2;
            M.box(0.12, bh, 7.2, bu, by, -mv, '#2e5a8a'); for (const z of [-3.2, 3.2]) M.box(0.12, by - y, 0.12, bu, y + (by - y) / 2, -mv + z, WOOD);
            faces.forEach((T, i) => { const t = T.mesh(); t.rotation.y = (i ? -1 : 1) * Math.PI / 2; t.position.set(bu, by, -mv); t.userData.sign = 'HUA THANON MARKET'; g.add(t); }); }
          g.add(hotelMesh(M));
          const FISH = ['#aeb8c2', '#c8b8c0', '#8e9aa6', '#d8c8c8', '#9a8a7a'];
          let k = 0;
          for (let a = -L / 2 + 2; a <= L / 2 - 2 + 0.01; a += 2.8) for (const b of [-2.2, 2.2]) {
            const kind = k++ % 5;
            templeProp(g, mu + a, mv + b, (B) => {
              B.box(2.4, 0.8, 1.0, 0, y + 0.4, 0, '#d8d6cf'); B.box(2.44, 0.04, 1.04, 0, y + 0.82, 0, '#c8d4d8');               // бетон, кафельная полка
              for (const t of [-0.65, 0.05]) { B.box(0.62, 0.05, 0.62, t, y + 0.87, 0, '#c8ccd0'); for (let i = 0; i < 3; i++) B.box(0.38, 0.05, 0.1, t + (i - 1) * 0.12, y + 0.92, (i - 1) * 0.15, FISH[(i + kind) % 5]); }
              if (kind === 2) { B.blob(-0.4, y + 0.97, 0.05, 0.12, 0.1, 0.07, '#b8865a', 6, 3); B.blob(-0.15, y + 0.97, -0.1, 0.11, 0.09, 0.07, '#d8b088', 6, 3); }   // ракушки
              B.box(0.24, 0.28, 0.2, 0.75, y + 0.98, 0.2, '#e8e4d8'); B.box(0.2, 0.18, 0.21, 0.75, y + 1.1, 0.2, '#f6f6f2');            // весы-циферблат
              B.box(0.4, 0.22, 0.34, 0.75, y + 0.96, -0.22, ['#2a8ad8', '#3aa85a'][kind % 2]);                                        // корзина
            }, { kind: 'small', mat: 'stone', color: '#d8d6cf', r: 1.25, loss: 0.03 });
          }
          vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return Math.abs(p.x - mu) < L / 2 + 2 && Math.abs(p.z + mv) < 7; }, { c: [w.x, w.z, L / 2 + 6] }));
          { const q = roadProj(0, w.x, w.z), p = q && roadPoint(R, q.s, 0);                                   // переход — на дороге напротив зала, носом к нему
            if (p) LANDMARKS.push({ name: 'РЫНОК ХУА ТАНОН', x: p[0], z: p[1], heading: Math.atan2(-(w.x - p[0]), -(w.z - p[1])) }); }
        } }
      // лодки у причала
      for (const [u, v, a] of [[14, 9, 0.3], [27, -9.5, 2.9], [40, 10, 0.1], [50, -12, 3.3], [22, 22, 0.6]]) { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); if (groundY(w.x, w.z) < 0) townBoat(boatFisher, w.x, w.z, -az + a, rnd); }
      vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -12 && p.x < LQ + 2 * PW + 2 && Math.abs(p.z) < PW + 2; }, { c: [root[0], root[1], LQ + 20] }));
    } }
  // --- мечеть у главной дороги (где она на плане, по фото не установить): белый объём с арочными окнами, зелёный купол, минарет ---
  { let lot = null; for (let ds = 70; ds < 150 && !lot; ds += 3) lot = townLot(R, 0, q0.s + ds, 24, -sea, 12.5, 16);
    if (lot) {
      const S = sculptor(), Gl = sculptor(), F = 8, P = 0.5, WH = '#d1d0cd', GR = '#51724c';
      S.box(24, 2.4, 16, 0, P - 1.2, 0, '#a8a59c'); townWalk(lot, S, 3.0, '#51724c');
      S.box(18, 7.6, 14, -2.5, P + 3.8, -0.6, WH); S.box(18.4, 0.3, 14.4, -2.5, P + 3.9, -0.6, '#bdbcb8');
      for (let x = -10.5; x <= 5.6; x += 2.3) for (const y of [1.9, 5.7]) { S.box(1.1, 1.7, 0.08, x, P + y, 6.43, '#2c3440'); S.blob(x, P + y + 0.85, 6.43, 0.55, 0.55, 0.05, '#2c3440', 8, 3); if ((x + y) % 2 > 1) Gl.box(1.0, 1.6, 0.02, x, P + y, 6.5, '#e8f0c8'); }
      for (let x = -11.3; x <= 6.4; x += 1.1) S.box(0.14, 0.7, 0.14, x, P + 7.95, 6.3, WH); S.box(18, 0.1, 0.16, -2.5, P + 8.3, 6.3, WH);   // балюстрада по крыше
      S.lathe([[2.2, P + 7.6], [2.3, P + 8.4]], -2.5, -0.6, WH, 12); S.lathe([[2.3, P + 8.4], [2.75, P + 9.6], [2.3, P + 10.9], [1.0, P + 11.9], [0.1, P + 12.5]], -2.5, -0.6, GR, 12);   // купол-луковица
      S.tube(-2.5, P + 12.5, P + 13.6, -0.6, 0.07, 0.03, '#d8b24a', 5); S.blob(-2.5, P + 13.7, -0.6, 0.3, 0.3, 0.06, '#d8b24a', 8, 3);
      // минарет
      S.box(2.6, 9.6, 2.6, 9.6, P + 4.8, 4.6, WH); S.box(3.3, 0.3, 3.3, 9.6, P + 9.7, 4.6, '#bdbcb8'); for (const [a, b] of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]]) S.box(a ? 0.12 : 3.1, 0.8, b ? 0.12 : 3.1, 9.6 + a, P + 10.2, 4.6 + b, WH);
      S.tube(9.6, P + 9.8, P + 12.2, 4.6, 0.95, 0.95, WH, 8); S.lathe([[1.1, P + 12.2], [1.25, P + 12.9], [0.6, P + 13.7], [0.05, P + 14.3]], 9.6, 4.6, GR, 8); S.tube(9.6, P + 14.3, P + 15.1, 4.6, 0.05, 0.02, '#d8b24a', 5);
      for (const y of [2.5, 6.0]) S.box(0.7, 1.4, 0.08, 9.6, P + y, 5.93, '#2c3440');
      // павильон у входа: тонкие колонны, серый купол с полумесяцем
      for (const a of [-2.2, 2.2]) for (const b of [0, 3.6]) S.box(0.22, 3.4, 0.22, -2.5 + a, P + 1.7, 7.0 + b, WH);
      S.box(5.2, 0.3, 4.4, -2.5, P + 3.5, 8.8, WH); S.lathe([[1.6, P + 3.65], [1.5, P + 4.5], [0.8, P + 5.1], [0.05, P + 5.4]], -2.5, 8.8, '#8e9296', 10); S.blob(-2.5, P + 5.75, 8.8, 0.22, 0.22, 0.05, '#d8b24a', 8, 3);
      S.box(2.0, 2.6, 0.1, -2.5, P + 1.3, 6.44, '#4a342a'); for (let k = 0; k < 3; k++) S.box(5.2, 0.16, 0.4, -2.5, P - 0.08 - k * 0.16, 11.2 + k * 0.4, '#bdbcb8');
      townDone(lot, S, Gl, -7.6, 6.4, 3.2); wallBox(lot.g, 9.6, -4.6, 2.6, 2.6);
    } }
  // --- дома на сваях на пляже, между ними лодки на песке и сушильные столы ---
  { const pg = new THREE.Group(); scene.add(pg); let i = 0;
    for (let s = q0.s - 14; s < S1 - 16;) {
      const lot = i % 4 !== 3 ? townLot(R, 0, s, 13, sea, 9.4, 8.8, { minH: -0.3, drop: 3.4 }) : null;
      if (lot) { stiltRow(lot, rnd); s += 14.5; i++; continue; }
      // свободный участок: лодка на песке носом к воде, сушильный стол
      const p = roadPoint(R, s + 6, sea * 15.5), y = groundY(p[0], p[1]);
      if (y > 0.25 && y < 1.4 && !townBlocked(p[0], p[1])) {
        townBoat(boatFisher, p[0], p[1], Math.atan2(-p[2] * sea, -p[3] * -sea) + (rnd() - 0.5) * 0.5, rnd, (rnd() - 0.5) * 0.24);
        const t = roadPoint(R, s + 12.5, sea * 12);
        if (groundY(t[0], t[1]) > 0.3 && !townBlocked(t[0], t[1])) templeProp(pg, t[0], -t[1], (B) => { const yy = groundY(t[0], t[1]); for (const a of [-2.2, 2.2]) for (const b of [-0.5, 0.5]) B.box(0.08, 1.2, 0.08, a, yy + 0.6, b, '#7a6a58'); B.box(5, 0.06, 1.2, 0, yy + 1.2, 0, '#8a7a5a'); for (let k = 0; k < 9; k++) B.box(0.4, 0.04, 0.9, -2 + k * 0.5, yy + 1.25, 0, k % 2 ? '#c8c0a8' : '#b4a890'); }, { kind: 'small', mat: 'wood', color: '#8a7a5a', r: 1.6, loss: 0.02 });
      }
      s += 14; i++;
    }
    // лодки на воде напротив пляжа
    for (let s = q0.s + 4; s < S1 - 10; s += 23) { const p = roadPoint(R, s, sea * (34 + rnd() * 14)); if (groundY(p[0], p[1]) < -0.15) townBoat(boatFisher, p[0], p[1], rnd() * 6.28, rnd); }
    const c = roadPoint(R, q0.s + 120, 0); pg.userData.c = new THREE.Vector3(c[0], 0, c[1]); townSeen(pg); }
  // --- шопхаусы вдоль дороги ---
  const make = (lot, q) => shophouseRow(lot, q, HUA_STYLE), LENS = [23, 18.4, 13.8, 9.2];
  townStreet(R, 0, S0, S1, -sea, 10.4, 10, LENS, 0.5, {}, make, rnd);
  townStreet(R, 0, S0, q0.s - 30, sea, 10.4, 10, LENS, 0.5, {}, make, rnd);
  const tp = roadPoint(R, q0.s - 60, 2.5);
  LANDMARKS.push({ name: 'ХУА ТАНОН', x: tp[0], z: tp[1], heading: Math.atan2(-tp[2], -tp[3]) });
}

function buildTowns() {
  buildNathon();
  buildFishermansVillage();
  buildHuaThanon();
  if (typeof buildChaweng === 'function') buildChaweng();                 // центр Чавенга (chaweng.js)
  if (typeof buildLamai === 'function') buildLamai();                     // центр Ламая (lamai.js)
}
