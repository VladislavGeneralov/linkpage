// Отели — refs/jinta_hotel, refs/lolita_bungalow, refs/bhundhari_residence. (Фото в refs взяты с Agoda и служат только
// образцом: в игру и в публикации они не попадают — здесь только геометрия, собранная по ним.)
// Место и рельеф каждого отеля задаёт сборщик острова (ISLAND.spots); здесь — постройки, бассейны, сад.
// Оси места: u — куда оно смотрит (локальный +X), v — влево от u (локальный −Z), y — вверх.
// Файл подключается после nightmarket.js (берёт sculptor и spotGroup из landmarks.js, drape, templeProp, templePlants,
// templeKeepOut, spotGround из temples.js, машины из vehicles.js) и только объявляет функции; игра зовёт buildHotels().

let HOTEL_MAT = null, POOL_WATER = null;
function hotelMesh(S) {
  const m = S.mesh();
  if (!HOTEL_MAT) HOTEL_MAT = lambert({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x26241f });   // светлые стены в тени не зеленеют
  m.material = HOTEL_MAT;
  return m;
}
// вода бассейна: бирюзовая, с бегущими бликами
function poolWater() {
  if (POOL_WATER) return POOL_WATER;
  const tex = pixelTexture(32, 32, (g, w, h) => {
    const rnd = seededRandom(133);
    g.fillStyle = '#3cc2d4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = ['#56d2e0', '#2fb2c8', '#6adcea', '#28a6c0'][(rnd() * 4) | 0]; g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 2 + ((rnd() * 5) | 0), 1); }
    for (let i = 0; i < 16; i++) { g.fillStyle = '#d8f8fc'; g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 2 + ((rnd() * 3) | 0), 1); }
  });
  airportAnim.push((t) => tex.offset.set((t * 0.018) % 1, (t * 0.011) % 1));
  return POOL_WATER = lambert({ map: tex, side: THREE.DoubleSide, emissive: 0x143438 });
}
// многоугольник воды в общий буфер (pts — точки [x, y, z] по контуру)
function waterPoly(Wb, pts) {
  const b = Wb.pos.length / 3, c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);
  Wb.pos.push(...c); Wb.uv.push(c[0] / 5, c[2] / 5);
  pts.forEach((p, i) => { Wb.pos.push(...p); Wb.uv.push(p[0] / 5, p[2] / 5); Wb.idx.push(b, b + 1 + i, b + 1 + (i + 1) % pts.length); });
}
// Бассейн на ровной площадке: бортик по контуру, вода чуть ниже его верха. pts — контур [[u, v], …]; y — уровень мощения.
// Бассейн твёрдый: машина в него не заезжает.
function hotelPool(g, S, Wb, pts, y, rim = '#e8e2d2', tile = '#7ad0dc') {
  const n = pts.length, cu = pts.reduce((s, p) => s + p[0], 0) / n, cv = pts.reduce((s, p) => s + p[1], 0) / n;
  const out = pts.map(([u, v]) => { const d = Math.hypot(u - cu, v - cv) || 1; return [u + (u - cu) / d * 0.5, v + (v - cv) / d * 0.5]; });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = pts[i], b = pts[j], A = out[i], B = out[j];
    S.quad([a[0], y + 0.16, -a[1]], [b[0], y + 0.16, -b[1]], [B[0], y + 0.16, -B[1]], [A[0], y + 0.16, -A[1]], rim);       // верх бортика
    S.quad([A[0], y + 0.16, -A[1]], [B[0], y + 0.16, -B[1]], [B[0], y - 0.1, -B[1]], [A[0], y - 0.1, -A[1]], '#d2ccbc');   // наружная грань
    S.quad([a[0], y + 0.16, -a[1]], [b[0], y + 0.16, -b[1]], [b[0], y - 0.05, -b[1]], [a[0], y - 0.05, -a[1]], tile);      // внутренняя — плитка
    wallLine(g, A[0], A[1], B[0], B[1]);
  }
  waterPoly(Wb, pts.map(([u, v]) => [u, y + 0.05, -v]));
}
// шезлонг — отдельный сбиваемый предмет; turn — куда смотрит изголовье: 0 — к +u, иначе поворот вокруг вертикали
function lounger(g, u, v, y, color = '#f2f2ee', turn = 0) {
  templeProp(g, u, v, (B) => {
    const c = Math.cos(turn), s = Math.sin(turn), at = (a, b) => [a * c - b * s, a * s + b * c];
    const seat = at(-0.25, 0), back = at(0.75, 0);
    B.box(1.3, 0.08, 0.62, seat[0], y + 0.32, seat[1], color, 0, turn); B.box(0.75, 0.08, 0.62, back[0], y + 0.52, back[1], color, 0.6, turn);
    for (const [a, b] of [[-0.8, 0.26], [-0.8, -0.26], [0.3, 0.26], [0.3, -0.26]]) { const p = at(a, b); B.box(0.06, 0.32, 0.06, p[0], y + 0.16, p[1], color); }
  }, { kind: 'small', mat: 'metal', color, r: 0.8, loss: 0.02 });
}
// где асфальт дороги вдоль оси u (идём от u0 шагом step): первая точка, где до оси дороги меньше половины полотна с обочиной
function roadEdgeU(g, u0, u1, v = 0) {
  const step = u1 > u0 ? 0.25 : -0.25;
  for (let u = u0; (u1 - u) * step > 0; u += step) { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)), h = roadAt(w.x, w.z); if (h && h.d < halfS + 0.3) return u; }
  return u1;
}
// щит с названием на двух столбах; face — куда смотрит лицо: вдоль u (+1 / −1); надпись с обеих сторон
function hotelSign(g, u, v, y, text, board = '#6a3a2e', ink = '#f6ecd8', w = 4.2) {
  const S = sculptor();
  for (const dv of [-w / 2 + 0.2, w / 2 - 0.2]) S.box(0.14, 2.2, 0.14, u, y + 1.1, -(v + dv), '#e8e2d2');
  S.box(0.12, 1.0, w, u, y + 1.75, -v, board);
  g.add(hotelMesh(S));
  for (const face of [1, -1]) { const T = sculptor(); T.text(text, 0, 0.2, 0.08, Math.min(0.15, (w - 0.5) / hudWidth(hudText(text))), ink, 1); const m = T.mesh(); m.rotation.y = face * Math.PI / 2; m.position.set(u, y + 1.75, -v); g.add(m); }
  for (const dv of [-w / 2 + 0.2, w / 2 - 0.2]) { const p = g.localToWorld(new THREE.Vector3(u, 0, -(v + dv))); posts.push([p.x, p.z]); }
}

// =====================================================================================================
// JINTA HOTEL — Натон, у кольцевой дороги со стороны джунглей; через дорогу — пляж. Зелёный штакетник вдоль дороги,
// двор со стоянкой, сразу за ним бассейн-«фасоль» (с него видно море через дорогу), по сторонам — длинный двухэтажный
// корпус с галереями и трёхэтажный с розово-оранжевыми поясами, в саду бунгало под красными шатровыми крышами.
// =====================================================================================================
function buildJinta() {
  const g = spotGroup('jinta'), sp = g.userData.spot, L = sp.y, S = sculptor(), Wb = waterBuf();
  const RD = roadEdgeU(g, 10, 40), GU = RD - 1.4;                                                   // край дороги и линия ограды
  const CREAM = '#e8e0c8', CREAM_D = '#d6cdb2', GLASS = '#2c3a4c', WHITE = '#f4f2ea', PINK = '#e08a6a', LILAC = '#cbc8d4';
  // ---------- мощение: двор со стоянкой у дороги, проезд, площадка бассейна сразу за стоянкой, дорожки в сад ----------
  { const Pv = sculptor();
    drape(Pv, g, 9, GU + 0.6, -11, 11, (i, j) => (i + j) % 2 ? '#828280' : '#7d7d7a', 0.06, 3);
    drape(Pv, g, GU + 0.6, RD + 0.6, -4, 4, '#828280', 0.07, 2);
    drape(Pv, g, -7.5, 9, -12.5, 12.5, (i, j) => (i + j) % 2 ? '#cdbb9c' : '#c4b08e', 0.06, 2.2);
    drape(Pv, g, -10, -7.5, -1, 1, '#d8d0bc', 0.06, 2); drape(Pv, g, -11.6, -10, -26, 27, '#d8d0bc', 0.055, 2);   // дорожки: от бассейна вглубь и вдоль корпусов
    for (const v of [-7.4, -2.5, 2.5, 7.4]) { const y = spotGround(g, 15, v) + 0.1; Pv.quad([12.5, y, -v - 0.06], [GU - 0.6, y, -v - 0.06], [GU - 0.6, y, -v + 0.06], [12.5, y, -v + 0.06], '#e8e8e4'); }
    g.add(Pv.mesh()); }
  // ---------- трёхэтажный корпус (20 × 9 × 9.8) сбоку от сада: сиренево-серые стены, розово-оранжевые пояса, стеклянные двери в сад ----------
  { const u0 = -14, u1 = 6, v0 = 27, v1 = 36, H = 9.8, cu = (u0 + u1) / 2, len = u1 - u0, z = -(v0 + v1) / 2, zf = -v0, zb = -v1;   // фасад — к саду (v0)
    S.box(len + 0.3, 0.5, v1 - v0 + 0.3, cu, L, z, '#c9c5bb'); S.box(len, H, v1 - v0, cu, L + H / 2, z, LILAC);
    for (const k of [1, 2, 3]) S.box(len + 0.7, 0.85, v1 - v0 + 0.7, cu, L + k * 3.2 - 0.2, z, PINK);
    S.box(len + 0.9, 0.16, v1 - v0 + 0.9, cu, L + H + 0.2, z, '#b8b4ae');
    for (let i = 0; i < 4; i++) {
      const x = cu - 7.5 + i * 5;
      S.box(2.8, 2.3, 0.1, x, L + 1.4, zf + 0.03, GLASS); for (const d of [-1.4, 0, 1.4]) S.box(0.1, 2.4, 0.14, x + d, L + 1.4, zf + 0.05, WHITE); S.box(2.9, 0.1, 0.14, x, L + 2.58, zf + 0.05, WHITE);
      for (const k of [1, 2]) for (const [zz, sg] of [[zf + 0.03, 1], [zb - 0.03, -1]]) { S.box(2.2, 1.3, 0.1, x, L + k * 3.2 + 1.5, zz, GLASS); S.box(0.08, 1.4, 0.14, x, L + k * 3.2 + 1.5, zz + sg * 0.02, WHITE); }
      S.box(1.6, 1.2, 0.1, x, L + 1.6, zb - 0.03, GLASS); S.box(0.85, 0.6, 0.34, x + 1.5, L + 2.9, zb - 0.2, '#d8dade');           // сзади: окна и кондиционеры
    }
    for (const k of [0, 1, 2]) for (const x of [u0 - 0.03, u1 + 0.03]) S.box(0.1, 1.3, 2.0, x, L + k * 3.2 + 1.6, z, GLASS);       // торцы
    S.box(1.4, 0.08, 0.5, cu + 3, L + 0.5, zf + 1.0, '#6a4a3a'); S.box(1.4, 0.5, 0.08, cu + 3, L + 0.75, zf + 0.8, '#6a4a3a');       // скамья у входа
    S.tube(cu - 5, L + H + 0.3, L + H + 1.7, z, 0.7, 0.7, '#8ea2b4', 8);
    wallBox(g, cu, (v0 + v1) / 2, len + 0.4, v1 - v0 + 0.4); }
  // ---------- длинный двухэтажный корпус (25 × 11 × 7) с другой стороны сада: открытые галереи на тонких столбах, белые балясины ----------
  { const u0 = -21, u1 = 4, vb = -37, vf = -26, cu = (u0 + u1) / 2, len = u1 - u0, H = 7, zg = -(vf - 1.1);
    const body0 = vb, body1 = vf - 2.2, zc = -(body0 + body1) / 2, dep = body1 - body0;                 // стена номеров и галерея 2.2 м перед ней
    S.box(len + 0.3, 0.5, vf - vb + 0.3, cu, L, -(vb + vf) / 2, '#c9c5bb');
    S.box(len, H, dep, cu, L + H / 2, zc, CREAM);
    S.box(len, 0.22, 2.3, cu, L + 3.4, zg, CREAM_D); S.box(len + 0.8, 0.26, vf - vb + 0.9, cu, L + H + 0.13, -(vb + vf) / 2, '#d2ccba');   // плита галереи и крыша со свесом
    for (let i = 0; i <= 7; i++) { const x = u0 + 0.25 + i * (len - 0.5) / 7; S.box(0.34, H, 0.34, x, L + H / 2, -(vf - 0.2), WHITE); }
    S.box(len, 0.09, 0.12, cu, L + 4.4, -(vf - 0.15), WHITE); S.box(len, 0.09, 0.12, cu, L + 3.62, -(vf - 0.15), WHITE);
    for (let x = u0 + 0.4; x < u1; x += 0.42) S.box(0.09, 0.72, 0.09, x, L + 4.0, -(vf - 0.15), WHITE);            // балясины
    for (let i = 0; i < 7; i++) {
      const x = u0 + 0.25 + (i + 0.5) * (len - 0.5) / 7, zw = -(body1 + 0.03);
      if (i === 3) {                                                                                 // лестница посередине
        for (let k = 0; k < 9; k++) S.box(1.3, 0.2, 0.26, x, L + 0.2 + k * 0.37, -(vf - 0.2 - k * 0.22), '#b4ae9c');
        S.box(1.4, 3.3, 0.1, x, L + 5.1, zw, '#3a5a7a'); continue;
      }
      for (const fl of [0, 3.4]) { S.box(0.9, 2.05, 0.08, x - 0.9, L + fl + 1.25, zw, '#4a342a'); S.box(1.3, 1.1, 0.08, x + 0.75, L + fl + 1.7, zw, GLASS); S.box(1.4, 0.08, 0.1, x + 0.75, L + fl + 1.1, zw - 0.02, WHITE); }
      for (const fl of [0, 3.4]) { S.box(1.2, 1.0, 0.08, x, L + fl + 1.9, -(body0 - 0.03), GLASS); S.box(0.8, 0.55, 0.3, x + 1.2, L + fl + 1.2, -(body0 - 0.18), '#d8dade'); }   // задняя стена
    }
    for (const [xe, sd] of [[u0, -1], [u1, 1]]) {                                                 // торцы: окна и балкон второго этажа (просил Влад)
      winX(S, xe, L + 1.7, zc + 2, 1.2, 1.1, sd, GLASS, WHITE);
      winX(S, xe, L + 3.4 + 1.25, zc - 0.8, 0.9, 2.05, sd, '#4a342a', WHITE); winX(S, xe, L + 3.4 + 1.7, zc + 2, 1.2, 1.1, sd, GLASS, WHITE);
      S.box(1.3, 0.16, 3.6, xe + sd * 0.65, L + 3.4, zc + 0.3, CREAM_D);
      S.box(0.08, 0.09, 3.6, xe + sd * 1.26, L + 4.4, zc + 0.3, WHITE); for (const dz of [-1.75, 1.75]) S.box(1.2, 0.09, 0.08, xe + sd * 0.65, L + 4.4, zc + 0.3 + dz, WHITE);
      for (let k = 0; k <= 8; k++) S.box(0.08, 0.9, 0.08, xe + sd * 1.26, L + 3.95, zc + 0.3 - 1.75 + k * 3.5 / 8, WHITE);
      acZ(S, xe + sd * 0.6, L + 3.8, zc + 0.3 - 1.75, -1);
    }
    wallBox(g, cu, (vb + vf) / 2, len + 0.3, vf - vb + 0.2); }
  // ---------- бунгало (7 × 7): кремовые стены, большие окна, высокая красная шатровая крыша со свесом ----------
  const bungalow = (cu, cv) => {
    const z = -cv, R1 = '#dc5a44', R2 = '#c84c38';
    S.box(7.2, 0.5, 7.2, cu, L + 0.05, z, '#c9c5bb'); S.box(6.2, 2.7, 6.2, cu, L + 1.65, z, CREAM);
    for (const [dx, dz, w, d] of [[3.12, 0, 0.08, 3.6], [-3.12, 0, 0.08, 3.6], [0, 3.12, 3.6, 0.08], [0, -3.12, 3.6, 0.08]]) { S.box(w, 1.7, d, cu + dx, L + 1.75, z + dz, '#f0d8a8'); S.box(w ? w + 0.04 : 0, 1.8, d ? 0.1 : d, cu + dx, L + 1.75, z + dz, WHITE); }
    S.box(0.1, 2.1, 1.0, cu + 3.13, L + 1.35, z + 2.2, '#4a342a'); acX(S, cu - 3.1, L + 0.9, z - 2.5, -1);   // кондиционер сзади
    S.hip(cu, z, 4.5, 4.5, L + 2.95, 2.2, 2.2, L + 4.5, (i) => i % 2 ? R1 : R2); S.hip(cu, z, 2.2, 2.2, L + 4.5, 0.15, 0.15, L + 5.6, (i) => i % 2 ? R2 : R1);
    S.quad([cu - 4.5, L + 2.95, z - 4.5], [cu + 4.5, L + 2.95, z - 4.5], [cu + 4.5, L + 2.95, z + 4.5], [cu - 4.5, L + 2.95, z + 4.5], '#e8dcc0');   // подшивка свеса
    wallBox(g, cu, cv, 6.4, 6.4);
  };
  bungalow(0, -19); bungalow(0, 19.5); bungalow(-18, 8);
  // ---------- бассейн-«фасоль» сразу за стоянкой ----------
  { const pts = []; for (let i = 0; i < 18; i++) { const t = i / 18 * 6.2832, cs = Math.cos(t); pts.push([0.4 + 3.1 * Math.sin(t) + 1.5 * cs * cs, 7.2 * cs]); }
    hotelPool(g, S, Wb, pts, L + 0.06); }
  // ---------- вывеска на каменной тумбе у въезда ----------
  { const u = GU - 2.2, v = 7.6, y = spotGround(g, u, v), TXT = 'JINTA HOTEL';
    S.box(1.0, 0.8, 4.2, u, y + 0.4, -v, '#8a8478'); for (let i = 0; i < 7; i++) S.box(1.04, 0.22, 0.5, u, y + 0.2 + (i % 2) * 0.36, -(v - 1.7 + i * 0.56), i % 2 ? '#7a756a' : '#9a9488');
    S.box(0.14, 0.95, 3.8, u, y + 1.35, -v, '#6a2e2a');
    for (const face of [1, -1]) { const T = sculptor(); T.text(TXT, 0, 0.2, 0.08, Math.min(0.08, 3.3 / hudWidth(hudText(TXT))), '#f6ecd8', 1); const m = T.mesh(); m.rotation.y = face * Math.PI / 2; m.position.set(u, y + 1.32, -v); g.add(m); }
    wallBox(g, u, v, 1.0, 4.2); }
  g.add(hotelMesh(S), meshFrom(Wb.pos, Wb.uv, Wb.idx, poolWater()));
  // ---------- зелёный штакетник вдоль дороги, проём въезда ----------
  { const spec = { step: 2.4, post: [0.12, 1.15, '#1f8f7c'], bars: [[0.3, 0.07, '#27a892'], [0.85, 0.07, '#27a892']], pickets: [0.24, 0.1, 1.05, ['#2ab89e', '#27a892', '#30c2a8']], kind: 'fence', loss: 0.04, mat: 'wood' };
    for (const s of [-1, 1]) fenceOnGround(g, GU, s * 5.2, GU, s * 39.4, spec, 9.6); }
  // шезлонги у бассейна — лицом к дороге и морю; машина на стоянке
  for (let i = 0; i < 6; i++) lounger(g, -4.6, -6.5 + i * 2.6, L + 0.06, '#f4f4f0', Math.PI);
  parkVehicle(g, pickupGeo('empty', '#e8e8e4'), 15.4, -5, 'u+', spotGround(g, 15.4, -5) + 0.07);
  parkVehicle(g, parkedCar(3), 15.4, 5, 'u-', spotGround(g, 15.4, 5) + 0.07); parkVehicle(g, parkedCar(10), 15.4, -9.6, 'u-', spotGround(g, 15.4, -9.6) + 0.07);
  scooterRow(g, 6, 3, 10.4, 9.8, 0.85, 0, Math.PI / 2, spotGround(g, 11, 9.8) + 0.07);
  templePlants(g, [[-6, -10.5, 'coconut'], [-6, 10.5, 'coconut'], [7.5, -11.5, 'coconut'], [7.5, 11.5, 'coconut'], [-13, -3, 'coconut'], [-14, -16, 'coconut'], [-9, 22, 'coconut'], [-22, 20, 'coconut'], [-24, -8, 'coconut'],
    [-23, 0, 'areca'], [-13, -22, 'areca'], [5, 24, 'fan'], [-8.5, 4, 'bush'], [-8.5, -5, 'bush'], [8, -14, 'bush'], [8, 14.5, 'bush'], [17, 13, 'bush'], [17, -13, 'bush'], [-26, 28, 'coconut'], [-26, -24, 'fan']]);
  templeKeepOut(g, -30, RD - 0.5, -42, 42);
  spotPlace('ОТЕЛЬ ДЖИНТА', g, RD + 1.2, 0, -1, 0);                                               // переход — на въезд у дороги, а не на стоянку
}

// =====================================================================================================
// LOLITA BUNGALOW — пляж Маенам: ряды деревянных домиков на сваях (крутые двускатные крыши — зелёные и красные,
// кремовые фронтоны с «солнцем», веранды с перилами из косых реек), ресторан под соломой на песке, вывеска на пляже.
// =====================================================================================================
// домик: (cu, cv) — середина переднего края веранды; dir — куда смотрит веранда (+1 — к +v); pal — [крыша, крыша2, дерево]
function lolitaBungalow(S, cu, cv, dir, y0, pal) {
  const [R1, R2, WOOD] = pal, CR = '#efe6d2', DARK = '#4a2a1e';
  const P = (a, y, b) => [cu + a, y0 + y, -(cv - dir * b)];
  const B = (wa, h, wb, a, y, b, c) => S.box(wa, h, wb, cu + a, y0 + y, -(cv - dir * b), c);
  for (const a of [-2.45, 2.45]) for (const b of [0.25, 3.7, 7.2]) B(0.22, 1.0, 0.22, a, 0.5, b, '#8a8478');       // сваи
  B(5.6, 0.16, 7.5, 0, 1.0, 3.75, WOOD);                                                                          // пол
  B(5.2, 2.5, 5.3, 0, 2.33, 4.75, CR); B(5.24, 0.9, 5.34, 0, 1.53, 4.75, WOOD);                                    // стены: кремовый верх, деревянный низ
  B(0.9, 2.0, 0.08, -1.0, 2.1, 2.07, DARK); B(1.3, 1.1, 0.08, 1.2, 2.5, 2.07, '#2c3a4c');                            // дверь и окно на веранду
  if (hash2(Math.round(cu * 10), Math.round(cv * 10)) < 0.5) { B(0.9, 0.62, 0.32, 1.2, 1.9, 7.57, '#d8dade'); B(0.5, 0.44, 0.04, 1.08, 1.9, 7.74, '#8e9296'); }   // кондиционер сзади — у части домиков
  for (const s of [-1, 1]) { B(0.3, 1.2, 0.1, 1.2 + s * 0.82, 2.5, 2.05, WOOD); B(0.08, 1.0, 1.2, s * 2.62, 2.5, 4.9, '#2c3a4c'); B(0.1, 1.1, 0.12, s * 2.64, 2.5, 4.2, WOOD); }
  // веранда: стойки, перила из косых реек, проём у лестницы
  for (const a of [-2.65, -0.75, 0.75, 2.65]) B(0.14, 2.5, 0.14, a, 2.33, 0.08, WOOD);
  for (const s of [-1, 1]) {
    B(1.9, 0.08, 0.08, s * 1.7, 1.95, 0.06, WOOD); B(1.9, 0.08, 0.08, s * 1.7, 1.2, 0.06, WOOD);
    S.rod(P(s * 0.8, 1.2, 0.06), P(s * 2.6, 1.95, 0.06), 0.06, WOOD); S.rod(P(s * 0.8, 1.95, 0.06), P(s * 2.6, 1.2, 0.06), 0.06, WOOD);
    B(0.08, 0.08, 2.0, s * 2.7, 1.95, 1.05, WOOD); B(0.08, 0.08, 2.0, s * 2.7, 1.2, 1.05, WOOD);
    S.rod(P(s * 2.7, 1.2, 0.1), P(s * 2.7, 1.95, 2.0), 0.06, WOOD); S.rod(P(s * 2.7, 1.95, 0.1), P(s * 2.7, 1.2, 2.0), 0.06, WOOD);
    S.rod(P(s * 0.68, 1.75, 0), P(s * 0.68, 0.75, -1.35), 0.07, WOOD);                                               // поручень лестницы
  }
  for (let i = 0; i < 5; i++) B(1.25, 0.2, 0.3, 0, 0.9 - i * 0.2, -(i + 0.5) * 0.28, '#b9b2a2');                    // лестница
  // крутая крыша: конёк вдоль дома, вынос над верандой; кремовый фронтон с «солнцем»
  const E = 3.5, T = 6.0, HW = 3.35, F0 = -0.55, F1 = 7.95;
  S.quad(P(-HW, E, F0), P(-HW, E, F1), P(0, T, F1), P(0, T, F0), R1); S.quad(P(HW, E, F0), P(HW, E, F1), P(0, T, F1), P(0, T, F0), R2);
  S.tri(P(-2.95, E + 0.3, 0.02), P(2.95, E + 0.3, 0.02), P(0, T - 0.28, 0.02), CR); S.tri(P(-2.95, E + 0.3, 7.42), P(2.95, E + 0.3, 7.42), P(0, T - 0.28, 7.42), CR);
  B(5.9, 0.16, 0.14, 0, E + 0.28, 0.0, WOOD);
  for (let k = 1; k < 8; k++) { const t = k / 8, e = t < 0.5 ? [-2.9 + t * 2 * 2.9 * 0.999, E + 0.3 + t * 2 * (T - E - 0.6)] : [(t - 0.5) * 2 * 2.9, T - 0.3 - (t - 0.5) * 2 * (T - E - 0.6)]; S.rod(P(0, E + 0.36, -0.03), P(e[0] * 0.92, e[1] - 0.06, -0.03), 0.05, WOOD); }
  for (const s of [-1, 1]) { S.rod(P(s * HW, E, F0), P(0, T, F0), 0.16, WOOD); S.rod(P(s * HW, E, F1), P(0, T, F1), 0.16, WOOD); }
}
function buildLolita() {
  const g = spotGroup('lolita'), sp = g.userData.spot, L = sp.y, S = sculptor(), G = (u, v) => spotGround(g, u, v);
  const RD = roadEdgeU(g, -30, -70), GREEN = ['#3f9a6a', '#368a5e', '#a85a34'], RED = ['#b8453a', '#a63c32', '#7a2a24'];
  // ---------- дорожки, стоянка у въезда ----------
  { const Pv = sculptor();
    drape(Pv, g, RD - 0.6, -43, -4, 4, '#a69f90', 0.07, 2);
    drape(Pv, g, -43, -31, -9, 9, (i, j) => (i + j) % 2 ? '#aaa394' : '#a29b8c', 0.06, 3);
    drape(Pv, g, -31, 6, -0.75, 0.75, '#d6cfbe', 0.06, 2);                                           // центральная дорожка между рядами
    for (const v of [13.9, -13.9]) drape(Pv, g, -29, 4, v - 0.6, v + 0.6, '#d6cfbe', 0.055, 2);
    // у пляжа бетон кончается не обрезом: плитка редеет, дальше — утоптанная песчаная тропа до самого песка
    const DIRT = ['#b89468', '#ad8a5e', '#c29e72'];
    const fade = (u0, u1, vc, hw) => drape(Pv, g, u0, u1, vc - 1.5, vc + 1.5, (i, j, u) => hash2(i * 3 + 7, j * 5 + vc) < (u - u0) / 7 ? DIRT[(hash2(i, j + 2) * 3) | 0] : '#d6cfbe', 0.055, 0.75,
      (u, v) => Math.abs(v - vc + Math.sin(u * 0.35 + vc) * Math.min(0.6, Math.max(0, u - u0 - 6) * 0.08)) < (u < u0 + 7 ? hw : hw * (0.75 + 0.6 * hash2(Math.floor(u * 1.3), 3 + vc))));
    fade(6, 31, 0, 0.75); fade(4, 16, 13.9, 0.6); fade(4, 16, -13.9, 0.6);
    drape(Pv, g, -29.6, -28.4, -14.5, 14.5, '#d6cfbe', 0.052, 2);
    g.add(Pv.mesh()); }
  // ---------- четыре ряда домиков: внутренние под зелёными крышами смотрят на центральную дорожку, внешние — под красными ----------
  for (let i = 0; i < 4; i++) {
    const u = -23.5 + i * 8.6;
    lolitaBungalow(S, u, 3.3, -1, G(u, 6), GREEN); wallBox(g, u, 7.05, 5.7, 7.5);
    lolitaBungalow(S, u, -3.3, 1, G(u, -6), GREEN); wallBox(g, u, -7.05, 5.7, 7.5);
    lolitaBungalow(S, u, 17, -1, G(u, 20), RED); wallBox(g, u, 20.75, 5.7, 7.5);
    lolitaBungalow(S, u, -17, 1, G(u, -20), RED); wallBox(g, u, -20.75, 5.7, 7.5);
  }
  // ---------- контора у въезда ----------
  { const u = -37, v = -17, y = G(u, v), z = -v;
    S.box(7.3, 0.4, 5.3, u, y + 0.1, z, '#c9c5bb'); S.box(7, 2.8, 5, u, y + 1.7, z, '#efe6d2'); S.box(7.04, 0.9, 5.04, u, y + 0.75, z, '#a85a34');
    S.box(2.2, 1.2, 0.08, u - 1, y + 2.0, z - 2.52, '#2c3a4c'); S.box(0.9, 2.0, 0.08, u + 2.2, y + 1.3, z - 2.52, '#4a2a1e');
    for (const x of [-1.8, 1.8]) winZ(S, u + x, y + 2.0, z + 2.5, 1.4, 1.1, 1, '#2c3a4c', '#a85a34'); acZ(S, u, y + 2.4, z + 2.5, 1);   // сзади окна и кондиционер
    for (const sd of [-1, 1]) { winX(S, u + sd * 3.5, y + 2.0, z, 1.4, 1.1, sd, '#2c3a4c', '#a85a34');                                       // на торцах окно, в фронтоне — дверь на балкончик
      winX(S, u + sd * 4.06, y + 3.85, z, 0.8, 1.3, sd, '#4a2a1e', '#a85a34');
      S.box(0.9, 0.12, 2.0, u + sd * 4.5, y + 3.15, z, '#a85a34'); S.box(0.06, 0.08, 2.0, u + sd * 4.92, y + 3.95, z, '#efe6d2');
      for (let k = 0; k <= 5; k++) S.box(0.06, 0.8, 0.06, u + sd * 4.92, y + 3.55, z - 1 + k * 0.4, '#efe6d2'); for (const dz of [-1, 1]) S.box(0.9, 0.08, 0.06, u + sd * 4.5, y + 3.95, z + dz, '#efe6d2'); }
    S.gable(u, z, 8.2, 3.4, y + 3.1, y + 5.0, '#b8453a', '#efe6d2', 'x'); wallBox(g, u, v, 7, 5); }
  // ---------- ресторан на пляже: навес на столбах под соломой, плетёная ограда, стойка ----------
  { const u = 30, v = -15, y = G(u, v) - 0.1, z = -v, TH = ['#8a7a5a', '#7a6a4c', '#9a8a66'];
    for (const du of [-3.7, 0, 3.7]) for (const dv of [-2.7, 2.7]) S.box(0.2, 2.9, 0.2, u + du, y + 1.45, z + dv, '#6a4a2e');
    S.hip(u, z, 5.0, 4.0, y + 2.7, 2.6, 0.4, y + 4.4, (i) => TH[i % 3]); S.box(5.3, 0.14, 0.9, u, y + 4.42, z, TH[1]);
    for (const [du, dv, w, d] of [[0, -2.75, 7.6, 0.12], [-3.75, 0, 0.12, 5.4], [3.75, 1.6, 0.12, 2.2]]) S.box(w, 0.8, d, u + du, y + 0.4, z + dv, '#b8a47a');
    S.box(3.2, 1.0, 0.7, u - 1.6, y + 0.5, z - 1.6, '#6a4a2e'); S.box(3.3, 0.06, 0.8, u - 1.6, y + 1.03, z - 1.6, '#c9b48a');
    wallBox(g, u, v, 7.6, 5.6); }
  g.add(hotelMesh(S));
  // столики на песке (сбиваются), шезлонги, вывеска на пляже
  for (const [u, v] of [[38, -21], [39.5, -15], [38.5, -9], [43, -18], [43.5, -12]]) templeProp(g, u, v, (B) => {
    const y = G(u, v); B.box(0.9, 0.05, 0.9, 0, y + 0.74, 0, '#f2f2ee'); B.box(0.08, 0.72, 0.08, 0, y + 0.37, 0, '#6a4a2e');
    for (const [a, b] of [[0.75, 0], [-0.75, 0]]) { B.box(0.42, 0.06, 0.42, a, y + 0.45, b, '#8a5a34'); B.box(0.06, 0.5, 0.42, a + Math.sign(a) * 0.2, y + 0.7, b, '#8a5a34'); B.box(0.36, 0.42, 0.06, a, y + 0.21, b, '#6a4a2e'); }
  }, { kind: 'small', mat: 'wood', color: '#8a5a34', r: 1.0, loss: 0.02 });
  for (const v of [6, 9, 18, 21, -3, -27]) lounger(g, 48, v, G(48, v), ['#e8a03a', '#3a8ad8'][Math.abs(Math.round(v / 3)) & 1], Math.PI);
  hotelSign(g, 22, 9, G(22, 9), 'LOLITA BUNGALOWS', '#c8785a', '#fff4e0', 4.6);
  hotelSign(g, -44.5, 8.5, G(-44.5, 8.5), 'LOLITA BUNGALOWS', '#c8785a', '#fff4e0', 4.6);
  parkVehicle(g, pickupGeo('songthaew', '#2f5f9a'), -37, 5, 'v-', G(-37, 5) + 0.07);
  parkVehicle(g, parkedCar(9), -34, -5.5, 'v+', G(-34, -5.5) + 0.07);
  scooterRow(g, 8, 3, -41.8, 6.5, 0.85, 0, Math.PI / 2, G(-41, 6.5) + 0.07);
  templePlants(g, [[10, 5, 'coconut'], [13, 22, 'coconut'], [9, -6, 'coconut'], [20, 26, 'coconut'], [22, -27, 'coconut'], [26, 4, 'coconut'], [30, 20, 'coconut'], [34, -4, 'coconut'], [36, 28, 'coconut'], [8, 28, 'areca'],
    [-27, 12.2, 'areca'], [-10, 12.2, 'areca'], [-19, -12.2, 'areca'], [-2, -12.2, 'areca'], [-27, -12.4, 'bush'], [-14.5, 12.4, 'bush'], [-6, -12.4, 'bush'], [3, 12.4, 'bush'],
    [-33, 14, 'bush'], [-33, -8, 'bush'], [-41, 20, 'coconut'], [-40, -26, 'coconut'], [-30, 30, 'coconut'], [-6, 30.5, 'fan'], [-18, -30.5, 'fan'], [6, -29, 'coconut']]);
  templeKeepOut(g, RD + 0.5, 52, -33, 33);
  spotPlace('БУНГАЛО ЛОЛИТА', g, -39, 0, 1, 0);
}

// =====================================================================================================
// BHUNDHARI RESIDENCE — курорт на склоне холма: открытый павильон лобби и общий бассейн на нижней террасе, выше — два
// ряда вилл (белый первый этаж, тёмное дерево второго, тёмные двухъярусные крыши с загнутыми коньками), у каждой свой
// бассейн на настиле над склоном. От дороги — крутой подъём; у въезда ворота-навес и белая нага на лужайке.
// Рельеф у террас неровный (сетка высот 10 м), поэтому каждая постройка стоит на своём цоколе по земле под ней.
// =====================================================================================================
const BH_ROOF = ['#3a3840', '#44424a'], BH_WOOD = '#3c2a22', BH_WHITE = '#e8e6de';
// тёмная двухъярусная крыша с загнутыми коньками; конёк вдоль X
function lannaRoof(S, cx, cz, len, hw, y0, y1) {
  const mid = y0 + (y1 - y0) * 0.5;
  S.gable(cx, cz, len, hw, y0, mid + 0.5, BH_ROOF[0], BH_WOOD, 'x'); S.gable(cx, cz, len * 0.84, hw * 0.62, mid, y1, BH_ROOF[1], BH_WOOD, 'x');
  for (const e of [-1, 1]) {
    for (const s of [-1, 1]) { S.rod([cx + e * len / 2, y0, cz + s * hw], [cx + e * len / 2, mid + 0.5, cz], 0.2, BH_WOOD); S.rod([cx + e * len * 0.42, mid, cz + s * hw * 0.62], [cx + e * len * 0.42, y1, cz], 0.2, BH_WOOD); }
    S.limb([cx + e * len * 0.42, y1, cz], [cx + e * (len * 0.42 + 0.9), y1 + 1.3, cz], 0.2, 0.03, BH_WOOD, 5);     // загнутый конёк
    S.limb([cx + e * len / 2, mid + 0.5, cz], [cx + e * (len / 2 + 0.6), mid + 1.2, cz], 0.14, 0.02, BH_WOOD, 5);
  }
}
function buildBhundhari() {
  const g = spotGroup('bhundhari'), sp = g.userData.spot, L = sp.y, S = sculptor(), Wb = waterBuf(), G = (u, v) => spotGround(g, u, v);
  const RD = roadEdgeU(g, 70, 125);
  // самая низкая и самая высокая точки земли под прямоугольником
  const seat = (u0, u1, v0, v1) => { let lo = 1e9, hi = -1e9; for (let u = u0; u <= u1 + 0.01; u += (u1 - u0) / 5) for (let v = v0; v <= v1 + 0.01; v += (v1 - v0) / 5) { const y = G(u, v); lo = Math.min(lo, y); hi = Math.max(hi, y); } return [lo, hi]; };
  // ---------- подъём от дороги, площадка у лобби, лестницы к виллам, мощение у бассейна ----------
  { const Pv = sculptor();
    drape(Pv, g, 46, RD + 0.6, -3.6, 3.6, (i) => i % 2 ? '#828280' : '#7d7d7a', 0.07, 2);
    drape(Pv, g, 37.5, 47, -14, 5.5, (i, j) => (i + j) % 2 ? '#828280' : '#7d7d7a', 0.06, 2.5);
    drape(Pv, g, -2, 16.5, -8.4, 8.4, (i, j) => (i + j) % 2 ? '#c8a878' : '#bd9c6c', 0.06, 1.6);    // настил вокруг общего бассейна — между виллами нижнего ряда
    for (const v of [-10.4, 10.4]) drape(Pv, g, -8, 24, v - 0.9, v + 0.9, (i) => i % 2 ? '#a8a49a' : '#98948a', 0.06, 1.2);   // лестницы-дорожки вверх по склону
    drape(Pv, g, -5.4, -3.8, -26, 26, '#a8a49a', 0.055, 2);                                         // дорожка между рядами вилл
    g.add(Pv.mesh()); }
  // ---------- виллы: два ряда по три ----------
  const villa = (uc, vc, purple) => {
    const z = -vc, [lo, hi] = seat(uc - 4.5, uc + 9.6, vc - 4, vc + 4), F = seat(uc - 4.5, uc + 4, vc - 4, vc + 4)[1] + 0.2;
    S.box(8.7, F - lo + 0.4, 8.2, uc - 0.25, (F + lo - 0.4) / 2, z, '#8a8580');                                    // каменный цоколь
    S.box(8.5, 3.0, 8, uc - 0.25, F + 1.5, z, BH_WHITE);
    S.box(0.1, 2.3, 5.8, uc + 4.03, F + 1.25, z, '#2c3a4c'); for (const d of [-2.9, -1, 1, 2.9]) S.box(0.14, 2.4, 0.12, uc + 4.05, F + 1.25, z + d, BH_WOOD);   // стеклянные двери на террасу
    S.box(8.7, 0.3, 8.3, uc - 0.25, F + 3.05, z, BH_WOOD);
    S.box(8.5, 2.7, 8, uc - 0.25, F + 4.55, z, BH_WOOD); S.box(0.1, 1.9, 5.0, uc + 4.03, F + 4.3, z, '#241a16');
    for (const s of [-1, 1]) { for (const dx of [-2.5, 1]) { S.box(1.6, 1.2, 0.1, uc + dx, F + 4.5, z + s * 4.03, '#2c3a4c'); S.box(1.4, 1.1, 0.1, uc + dx, F + 1.6, z + s * 4.03, '#2c3a4c'); } }
    if (purple) S.box(0.12, 2.9, 2.2, uc - 4.53, F + 1.5, z + 1.5, '#95256a');                                     // пурпурная стена у входа
    S.box(0.1, 2.1, 1.0, uc - 4.53, F + 1.1, z - 1.5, BH_WOOD); acX(S, uc - 4.5, F + 0.5, z + 3.3, -1); acX(S, uc - 4.5, F + 3.7, z - 2.6, -1);   // кондиционеры сзади
    S.box(1.7, 0.16, 8.2, uc + 4.9, F + 3.1, z, BH_WOOD);                                                           // балкон
    S.box(0.08, 0.08, 8.2, uc + 5.7, F + 4.1, z, BH_WOOD); for (let d = -4; d <= 4.01; d += 0.8) S.box(0.08, 1.0, 0.08, uc + 5.7, F + 3.6, z + d, BH_WOOD);
    lannaRoof(S, uc + 0.2, z, 11.6, 5.3, F + 5.8, F + 9.0);
    // крыльцо-настил над склоном: кресла и столики (бассейнов у вилл нет — общий стоит между виллами)
    const du = uc + 6.9;
    S.box(5.4, 0.22, 8.0, du, F - 0.1, z, '#6a4a3a');
    for (const a of [-2.4, 2.4]) for (const b of [-3.6, 3.6]) { const gy = G(du + a, vc - b); S.box(0.24, Math.max(0.3, F - gy + 0.3), 0.24, du + a, (F + gy - 0.3) / 2, z + b, BH_WOOD); }
    for (const b of [1.4]) {                                                                        // столик и одно-два кресла, лицом к склону
      S.tube(du + 0.9, F + 0.02, F + 0.5, z + b, 0.08, 0.08, BH_WOOD, 6); S.tube(du + 0.9, F + 0.5, F + 0.56, z + b, 0.45, 0.45, '#8a6a4a', 8);
      for (const s of (purple ? [-1, 1] : [1])) { const cz = z + b + s * 1.0;
        S.box(0.7, 0.14, 0.7, du + 0.6, F + 0.42, cz, '#e8dcc0'); S.box(0.12, 0.7, 0.7, du + 0.22, F + 0.7, cz, BH_WOOD); S.box(0.7, 0.42, 0.08, du + 0.6, F + 0.21, cz - 0.31, BH_WOOD); S.box(0.7, 0.42, 0.08, du + 0.6, F + 0.21, cz + 0.31, BH_WOOD);
        S.box(0.7, 0.08, 0.1, du + 0.6, F + 0.66, cz - 0.33, BH_WOOD); S.box(0.7, 0.08, 0.1, du + 0.6, F + 0.66, cz + 0.33, BH_WOOD); }
    }
    S.tube(du - 1.6, F + 0.02, F + 0.6, z + 3.2, 0.3, 0.38, '#8a8580', 7); S.blob(du - 1.6, F + 1.0, z + 3.2, 0.5, 0.5, 0.5, '#3f8a34', 6, 4);          // кадка с кустом
    S.box(0.08, 0.08, 8.0, du + 2.66, F + 1.0, z, BH_WOOD); for (let d = -4; d <= 4.01; d += 1) S.box(0.08, 1.0, 0.08, du + 2.66, F + 0.5, z + d, BH_WOOD);   // перила над склоном
    wallBox(g, uc + 2.5, vc, 14.2, 8.3);
  };
  for (const [uc, row] of [[6, 0], [-18, 1]]) for (const vc of [-20, 0, 20]) if (row || vc) villa(uc, vc, (vc + row * 20) % 40 === 0);   // посередине нижнего ряда — общий бассейн
  // ---------- лобби: открытый павильон 12 × 12 на круглых столбах под высокой крышей ----------
  { const uc = 28.5, [lo, hi] = seat(uc - 6.5, uc + 6.5, -6.5, 6.5), F = hi + 0.25;
    S.box(13, F - lo + 0.4, 13, uc, (F + lo - 0.4) / 2, 0, '#8a8580'); S.box(12.6, 0.12, 12.6, uc, F + 0.03, 0, '#6a4a3a');
    for (const a of [-5.4, -1.8, 1.8, 5.4]) for (const b of [-5.4, -1.8, 1.8, 5.4]) if (Math.abs(a) > 5 || Math.abs(b) > 5) { S.tube(uc + a, F, F + 4.4, b, 0.34, 0.3, '#5a2e22', 8); S.tube(uc + a, F, F + 0.5, b, 0.42, 0.4, '#3a2a22', 8); }
    S.hip(uc, 0, 8.4, 8.4, F + 4.2, 5.0, 5.0, F + 6.4, (i) => BH_ROOF[i % 2]);
    lannaRoof(S, uc, 0, 12.4, 5.0, F + 6.2, F + 10.6);
    S.box(0.3, 3.4, 5.4, uc - 5.0, F + 1.8, 0, BH_WOOD); S.blob(uc - 4.78, F + 2.1, 0, 0.1, 1.25, 1.25, '#b8202a', 14, 4); S.blob(uc - 4.7, F + 2.1, 0, 0.08, 0.55, 0.55, '#d8b24a', 10, 3);   // панно с красным кругом
    for (const [a, b, c] of [[1.5, -3, '#2a8ab8'], [1.5, 3, '#2a8ab8'], [-1.5, -3.2, '#d84a8a'], [-1.5, 3.2, '#2a8ab8']]) { S.box(1.8, 0.45, 1.0, uc + a, F + 0.3, b, c); S.box(0.3, 0.5, 1.0, uc + a - 0.75, F + 0.7, b, c); }
    S.box(1.2, 0.35, 1.2, uc + 0.5, F + 0.24, 0, '#f2f2ee');
    for (let k = 0; k < 4; k++) S.box(0.5, 0.2, 5, uc + 6.7 + k * 0.5, F - 0.1 - k * 0.2, 0, '#98948a');             // ступени к площадке
    wallBox(g, uc, 0, 12.8, 12.8); }
  // ---------- общий бассейн: чаша над склоном, вода до краёв ----------
  { const u0 = 1, u1 = 14, v0 = -3.6, v1 = 3.6, [lo, hi] = seat(u0, u1, v0, v1), F = hi + 0.35;
    S.box(u1 - u0 + 0.8, F - lo + 0.5, v1 - v0 + 0.8, (u0 + u1) / 2, (F + lo - 0.5) / 2, -(v0 + v1) / 2, '#4a6a6a'); S.box(u1 - u0 + 0.9, 0.1, v1 - v0 + 0.9, (u0 + u1) / 2, F - 0.02, -(v0 + v1) / 2, '#d8d2c2');
    waterPoly(Wb, [[u0, F + 0.04, -v0], [u1, F + 0.04, -v0], [u1, F + 0.04, -v1], [u0, F + 0.04, -v1]]);
    wallBox(g, (u0 + u1) / 2, (v0 + v1) / 2, u1 - u0 + 0.8, v1 - v0 + 0.8); }
  // ---------- ворота-навес у дороги, стенка с названием, белая нага на лужайке ----------
  { const gu = RD - 6, gy = G(gu, 0);
    for (const a of [-1.3, 1.3]) for (const b of [-4.3, 4.3]) { const y = G(gu + a, b); S.box(0.42, 4.6, 0.42, gu + a, y + 2.2, b, BH_WOOD); wallBox(g, gu + a, -b, 0.6, 0.6); }
    S.box(0.3, 0.3, 9.4, gu - 1.3, gy + 4.2, 0, BH_WOOD); S.box(0.3, 0.3, 9.4, gu + 1.3, gy + 4.2, 0, BH_WOOD);
    S.gable(gu, 0, 10.6, 2.9, gy + 4.3, gy + 5.9, BH_ROOF[0], BH_WOOD, 'z');
    for (const e of [-1, 1]) S.limb([gu, gy + 5.9, e * 5.3], [gu, gy + 6.9, e * 6.0], 0.16, 0.02, BH_WOOD, 5);
    const wu = RD - 4.5, wv = 9.5, wy = G(wu, wv);
    S.box(0.5, 1.5, 6.4, wu, wy + 0.6, -wv, BH_WHITE); S.box(0.56, 0.2, 6.6, wu, wy + 1.42, -wv, '#8a8580'); S.box(0.52, 0.9, 4.6, wu, wy + 0.75, -wv, '#95256a');
    for (const face of [1, -1]) { const T = sculptor(); T.text('BHUNDHARI', 0, 0.22, 0.28, 0.105, '#fff4e0', 1); const m = T.mesh(); m.rotation.y = face * Math.PI / 2; m.position.set(wu, wy + 0.75, -wv); g.add(m); }
    wallBox(g, wu, wv, 0.6, 6.4);
    // нага: белое волнистое тело вдоль склона, поднятая голова с золотым гребнем
    const nu = RD - 16, N = 16; let prev = null;
    for (let i = 0; i <= N; i++) { const t = i / N, v = -9 - t * 12.5, u = nu + Math.sin(t * 9) * 0.5, y = G(u, v) + 0.55 + Math.abs(Math.sin(t * 9.5)) * 1.1 + (i === N ? 0.9 : 0), p = [u, y, -v];
      if (prev) S.limb(prev, p, 0.42 - t * 0.12, 0.4 - t * 0.12, i % 4 === 0 ? '#e8d28a' : '#f6f4ee', 7);
      prev = p; }
    { const hv = -21.5, hy = G(nu, hv); S.limb(prev, [nu + 0.9, hy + 3.0, -hv + 0.2], 0.3, 0.26, '#f6f4ee', 7); S.blob(nu + 1.3, hy + 3.1, -hv + 0.2, 0.55, 0.32, 0.3, '#f6f4ee', 7, 4);
      for (let k = 0; k < 3; k++) S.limb([nu + 0.8 + k * 0.2, hy + 3.3, -hv + 0.2], [nu + 0.4 + k * 0.25, hy + 4.2 - k * 0.2, -hv + 0.2], 0.12, 0.02, '#d8b24a', 4); }
    wallBox(g, nu, -15.3, 1.6, 13); }
  g.add(hotelMesh(S), meshFrom(Wb.pos, Wb.uv, Wb.idx, poolWater()));
  // шезлонги у общего бассейна, машина у лобби
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) lounger(g, 2.6 + i * 2.5, s * 6.4, G(2.6 + i * 2.5, s * 6.4) + 0.06, '#f2a81e', s * Math.PI / 2);   // шезлонги по обе стороны бассейна
  parkVehicle(g, pickupGeo('closed', '#1c1c1e'), 42.5, -9.5, 'v+', G(42.5, -9.5) + 0.07);
  parkVehicle(g, parkedCar(11), 39.4, -9.5, 'v+', G(39.4, -9.5) + 0.07);
  scooterRow(g, 12, 2, 45.4, -12, 0, 0.85, Math.PI, G(45.4, -11.5) + 0.07);
  templePlants(g, [[34, -20, 'coconut'], [47, -18, 'coconut'], [48, 24, 'coconut'], [40, 14, 'coconut'], [38, 22, 'fan'], [33, 28, 'areca'], [20, -12.5, 'fan'], [20, 12.5, 'fan'], [14, -30, 'coconut'], [14, 30, 'coconut'], [-8, -31, 'coconut'], [-8, 31, 'coconut'],
    [-4, -9, 'bush'], [-4, 9, 'bush'], [17, 8, 'bush'], [17, -8, 'bush'], [-28, -12, 'areca'], [-28, 12, 'areca'], [RD - 9, -8, 'fan'], [RD - 20, 6, 'bush'], [RD - 26, -7, 'bush'], [56, 9, 'coconut'], [60, -10, 'coconut']]);
  templeKeepOut(g, -34, RD - 1, -34, 34);
  spotPlace('БХУНДАРИ РЕЗИДЕНС', g, 43, -3, -1, 0);
}

function buildHotels() {
  const SP = IS.spots || {};
  if (SP.jinta) buildJinta();
  if (SP.lolita) buildLolita();
  if (SP.bhundhari) buildBhundhari();
}
