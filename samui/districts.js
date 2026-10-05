// Недоработанные районы острова — refs/DISTRICTS_TZ.md (ресерч-сессия), объём по каждой зоне задал Влад:
//   1. северо-восток — несколько баров и пара лавок: пляжный бар у пирса Банграк, придорожный бар, сувенирные палатки и
//      киоски на площади Большого Будды (refs/bangrak_bars_shops); бары, ресторан с домиками, столы на песке, зонты и
//      оранжевый отель на пляже Чонг Мон (refs/choeng_mon_bars);
//   2. юг — полностью: Тонг Крут — рестораны морепродуктов на сваях вдоль берега, лодки, хостел, хижины на сваях
//      (refs/thong_krut_village); пляж Банг Као — водоросли, камни в воде, бунгало, вилла (refs/beach_bang_kao);
//      Талинг Нгам — ворота со слонами, пёстрые лавки, белые виллы ступенями по склону (refs/taling_ngam);
//      острова Five Islands, Ко Таен и Ко Мадсум насыпает сборщик острова;
//   3. кольцевая — Bangkok Hospital Samui и Big C с KFC (refs/bangkok_hospital_samui, refs/big_c_samui);
//   4. Чавенг Ной и Корал Ков — полностью: валуны, отели под тёмно-красными крышами, пляжные клубы, гидроциклы,
//      ступа на мысу; бухта между огромными валунами, бунгало на склоне, стоянка с вывеской
//      (refs/beach_chaweng_noi, refs/beach_coral_cove).
// Мелкое (зонты, столы, стулья, табуреты, палатки, шлагбаум) — разрушаемое, постройки и валуны — твёрдые; вывески — по-английски
// (тайская строка — thai_text.js). Пляжи кладёт сборщик (ISLAND.beaches), их убранство строит buildBeaches() — оттуда
// зовутся beachChawengNoi / beachCoralCove / beachBangKao; остальное — buildDistricts() после пляжей, до придорожных лавок.

// ---------- общее ----------
const DIST_ERR = [];                                                         // что не построилось (район пропущен, игра идёт)
const dW = (g, u, v) => g.localToWorld(new THREE.Vector3(u, 0, -v));
const dKeep = (x, z, r) => vegKeepOut.push(Object.assign(() => true, { c: [x, z, r] }));
const dSeen = (g, x, z) => { g.userData.c = new THREE.Vector3(x, 0, z); pierGroups.push(g); };
const dFree = (x, z, need = 4) => groundY(x, z) > 0.15 && !townBlocked(x, z) && roadDist(x, z) > need;
const dLit = () => TOWN.lit || (TOWN.lit = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
// соломенный зонт ⌀ ≈ 3 м со столиком и табуретами (сбивается); B — propBatch, координаты мировые
function dThatchUmbrella(B, x, y, z, rnd, stools = 3) {
  const it = B.begin();
  B.box(x, y + 1.25, z, 0.12, 2.5, 0.12, 0, '#7a5a3a');
  for (let k = 0; k < 10; k++) { const a0 = k / 10 * 6.283, a1 = (k + 1) / 10 * 6.283; B.quad([x, y + 3.0, z], [x + Math.cos(a0) * 1.6, y + 2.25, z + Math.sin(a0) * 1.6], [x + Math.cos(a1) * 1.6, y + 2.25, z + Math.sin(a1) * 1.6], [x, y + 3.0, z], k % 2 ? '#b89a5a' : '#a8884a'); }
  it.boxes.push([x, y + 2.5, z, 2.4, 0.2, 2.4, 0, 0xb89a5a]);
  B.box(x, y + 0.75, z, 1.0, 0.06, 1.0, 0, '#8a6a44'); B.box(x, y + 0.37, z, 0.1, 0.74, 0.1, 0, '#6a4a2e');
  for (let k = 0; k < stools; k++) { const a = k / stools * 6.283 + rnd(); B.box(x + Math.cos(a) * 1.05, y + 0.38, z + Math.sin(a) * 1.05, 0.36, 0.76, 0.36, 0, '#5a3a2a'); }
  B.end({ kind: 'small', mat: 'wood', x, z, r: 1.3, loss: 0.03 });
}
// бар под соломой ≈ 10 × 6 (стойка, навес на столбах): S — сборщик в осях группы, y — пол
function dThatchBar(S, y, W = 10, D = 6) {
  S.box(W, 0.3, D, 0, y + 0.15, 0, '#8a6a44');
  for (const x of [-W / 2 + 0.3, 0, W / 2 - 0.3]) for (const z of [-D / 2 + 0.3, D / 2 - 0.3]) S.box(0.22, 2.8, 0.22, x, y + 1.6, z, '#6a4a2e');
  S.gable(0, 0, W + 1.2, D / 2 + 0.9, y + 2.8, y + 4.6, '#b89a5a', '#a8884a', 'x');
  S.box(W * 0.6, 1.1, 0.8, 0, y + 0.85, -D / 2 + 1.4, '#5a3a2a'); S.box(W * 0.62, 0.08, 1.0, 0, y + 1.42, -D / 2 + 1.4, '#c8a878');
  for (let i = 0; i < 6; i++) S.box(0.3, 0.45, 0.25, -W * 0.25 + i * W * 0.1, y + 1.9, -D / 2 + 0.6, ['#e8c82a', '#3aa85a', '#d84a3a', '#f2f2ee'][i % 4]);
}
// оси места на пляже: f — точка кромки (t — вдоль берега, n — вглубь суши)
const dFrame = (Bc, i) => { const P = Bc.pts, N = P.length, [x, z, nx, nz] = P[Math.max(0, Math.min(N - 1, i))]; return { x, z, nx, nz, tx: nz, tz: -nx }; };
const dBW = (f, a, d) => [f.x + f.tx * a + f.nx * d, f.z + f.tz * a + f.nz * d];
const dBeachGroup = (f, a, d) => { const [x, z] = dBW(f, a, d), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-f.nx, -f.nz); scene.add(g); g.updateMatrixWorld(true); dSeen(g, x, z); return g; };   // +X — вдоль берега, +Z — к морю
// гранитный валун (у больших — стены); S — сборщик в мировых координатах
function dBoulder(S, x, z, r, rnd, GR = ['#c8c0b0', '#b8b0a2', '#d2cabc', '#bdb5a6']) {
  const y = Math.max(groundY(x, z), -1.5), ry = r * (0.55 + rnd() * 0.25);
  S.blob(x, y + ry * 0.35, z, r * (0.9 + rnd() * 0.3), ry, r * (0.8 + rnd() * 0.3), GR[(rnd() * GR.length) | 0], 9, 5);
  if (r > 0.9) { const h = r * 0.75; walls.push([x - h, z - h, x + h, z - h], [x + h, z - h, x + h, z + h], [x + h, z + h, x - h, z + h], [x - h, z + h, x - h, z - h]); solids.push([[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]]); }
  dKeep(x, z, r + 0.5);
}
// ближайшая к точке настоящая дорога (кольцевая в игре — несколько дорог 4169 / 4170 и др.; подъезды к пирсам и местам
// не в счёт): { r, R, q — проекция } или null
function dRoad(x, z) {
  let best = null;
  roads.forEach((R, r) => { if (/^(pier|spot) /.test(R.name || '')) return;
    for (let s = 0; s < R.len; s += 4) { const p = roadPoint(R, s, 0), d = Math.hypot(p[0] - x, p[1] - z); if (!best || d < best.d) best = { r, R, d, p }; } });
  if (!best) return null;
  const q = roadProj(best.r, best.p[0], best.p[1]);                   // точная проекция — уже от точки на самой дороге
  return q ? { r: best.r, R: best.R, q, d: best.d } : null;
}
// участок ряда (townLot) у дороги рядом с точкой: сдвиги вдоль дороги, стороны sides (+1 — справа по ходу)
function dLotNear(x, z, len, D, sides = [1, -1], o = {}) {
  const H = dRoad(x, z); if (!H) return null;
  for (const ds of [0, 12, -12, 24, -24, 40, -40, 60, -60]) for (const sd of sides) { const lot = townLot(H.R, H.r, H.q.s + ds, len, sd, 10.4, D, o); if (lot) return lot; }
  return null;
}

function buildDistricts() {
  const run = (f, name) => { try { f(); } catch (e) { console.warn('районы:', name, e); DIST_ERR.push(name + ': ' + e.message + ' ' + (e.stack || '').split('\n')[1]); } };      // один район не валит остальные
  run(buildBangrakBars, 'Банграк'); run(buildChoengMonBars, 'Чонг Мон'); run(buildThongKrut, 'Тонг Крут');
  run(buildTalingNgam, 'Талинг Нгам'); run(buildHospital, 'больница'); run(buildBigC, 'Big C');
}

// =====================================================================================================
// 1. СЕВЕРО-ВОСТОК
// =====================================================================================================
function buildBangrakBars() {
  const rnd = seededRandom(2069);
  // пляжный бар у пирса Банграк: стойка под соломой и соломенные зонты на песке (фото 01)
  const P = IS.piers && IS.piers.bangrak_a;
  if (P) {
    const a = [Math.cos(P.az), Math.sin(P.az)], n = [Math.sin(P.az), -Math.cos(P.az)];
    let spot = null;
    for (const v of [22, -22, 30, -30, 38, -38]) for (const u of [-3, -7, 1]) { const x = P.x + a[0] * u + n[0] * v, z = P.z + a[1] * u + n[1] * v; if (!spot && dFree(x, z, 8) && groundY(x, z) < 2.6) spot = [x, z]; }
    if (spot) {
      const g = townGroup(spot[0], spot[1], P.az), S = sculptor(), y = groundY(spot[0], spot[1]);   // u — к морю
      const bar = new THREE.Group(); bar.position.set(-2, 0, 0); g.add(bar); dThatchBar(S, y, 8, 5);
      { const m = hotelMesh(S); m.position.set(-2, 0, 0); g.add(m); } wallBox(g, -2, 0, 8, 5);
      const B = propBatch(); for (const [u, v] of [[4, -4], [4, 0], [4, 4], [7, -2], [7, 2.5]]) { const w = dW(g, u, v); if (dFree(w.x, w.z, 3)) dThatchUmbrella(B, w.x, groundY(w.x, w.z), w.z, rnd); }
      B.finish(spot); dSeen(g, spot[0], spot[1]); dKeep(spot[0], spot[1], 9);
      LANDMARKS.push({ name: 'БАР БАНГРАК', x: spot[0] - a[0] * 8, z: spot[1] - a[1] * 8, heading: Math.atan2(-a[0], -a[1]) });
    }
  }
  // придорожный бар под листом ≈ 15 × 6, перед ним — ряд скутеров (фото 02)
  { const lot = dLotNear(2182, 2069, 15, 6.5);
    if (lot) {
      const S = sculptor(), Gl = sculptor(), L = lot.len, F = lot.D / 2;
      S.box(L, 1.6, lot.D, 0, -0.6, 0, '#8f8b80'); S.box(L, 0.1, lot.D, 0, 0.25, 0, '#b8b2a4');
      for (const x of [-L / 2 + 0.3, -L / 6, L / 6, L / 2 - 0.3]) for (const z of [-F + 0.3, F - 0.3]) S.box(0.2, 3.2, 0.2, x, 1.85, z, '#7a7e84');
      S.quad([-L / 2 - 0.4, 3.5, -F - 0.5], [L / 2 + 0.4, 3.5, -F - 0.5], [L / 2 + 0.4, 3.1, F + 0.7], [-L / 2 - 0.4, 3.1, F + 0.7], '#9aa6ae');   // лист кровли с уклоном к дороге
      S.box(L * 0.45, 1.1, 0.8, -L * 0.2, 0.85, -F + 1.2, '#3a2a22'); S.box(L * 0.46, 0.06, 1.0, -L * 0.2, 1.42, -F + 1.2, '#c8a878');
      S.box(1.0, 2.0, 0.8, L / 2 - 1.2, 1.3, -F + 0.6, '#c8302a'); Gl.box(0.9, 1.6, 0.02, L / 2 - 1.2, 1.4, -F + 1.02, '#ffe2e2');   // холодильник
      { const px = 0.12; S.box(4.4, 0.9, 0.1, 0, 2.95, F + 0.65, '#1f4fa0'); S.text('BEER BAR', 0, 2.95 + px * 2.5, F + 0.72, px, '#f8f4e6', 1); Gl.box(4.2, 0.8, 0.02, 0, 2.95, F + 0.71, '#1f4fa0'); Gl.text('BEER BAR', 0, 2.95 + px * 2.5, F + 0.74, px, '#fff8e0', 1); }
      for (let k = 0; k < 6; k++) Gl.box(0.14, 0.14, 0.14, -L / 2 + 1 + k * (L - 2) / 5, 3.0, F + 0.5, ['#fff2c0', '#ffd0a0'][k % 2]);
      const B = propBatch(); for (const x of [-L / 2 + 2, 0.5, L / 2 - 2.5]) { const w = dW(lot.g, x, -(F - 2.2)); propTableSet(B, w.x, lot.y0 + 0.3, w.z, Math.atan2(lot.fx, lot.fz), rnd); } B.finish([lot.g.position.x, lot.g.position.z]);
      for (let k = 0; k < 6; k++) parkScooter(lot.g, 41 + k * 3, -L / 2 + 1.5 + k * 1.1, -(F + 2.0), -Math.PI / 2 + (rnd() - 0.5) * 0.3, 0.16);
      townWalk(lot, S, 2.7, '#2a2a2c'); townDone(lot, S, Gl, -F, F, 2.9);
    } }
  // у подножия Большого Будды: ряды сувенирных палаток 3 × 3 и два киоска под красными крышами (фото 03, 05, 06)
  if (IS.spots && IS.spots.big_buddha) {
    const g = spotGroup('big_buddha'), sp = g.userData.spot, y = sp.road.y - 0.06 + 0.07, B = propBatch(), S = sculptor();
    const TENT = ['#d83a2a', '#2a5ad8', '#f2c81e', '#2a9a4a', '#f2f2ee'];
    for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) {
      const u = 57 + k * 3.3, v = sd * 15.5, w = dW(g, u, v), col = TENT[(k + (sd > 0 ? 2 : 0)) % TENT.length], it = B.begin(), yaw = -sp.az;
      const c = (du, dv) => { const p = dW(g, u + du, v + dv); return [p.x, y, p.z]; };
      for (const [du, dv] of [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]]) { const p = dW(g, u + du, v + dv); B.box(p.x, y + 1.1, p.z, 0.06, 2.2, 0.06, yaw, '#c8ccd0'); }
      const A = c(0, 0); A[1] = y + 3.0; const Q = [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]].map(([du, dv]) => { const p = c(du, dv); p[1] = y + 2.2; return p; });
      for (let i = 0; i < 4; i++) B.quad(Q[i], Q[(i + 1) % 4], A, A, col);
      it.boxes.push([w.x, y + 2.5, w.z, 3, 0.1, 3, yaw, new THREE.Color(col).getHex()]);
      const t = dW(g, u, v - sd * 0.9); B.box(t.x, y + 0.42, t.z, 2.4, 0.84, 0.8, yaw, '#e8dcc0');
      for (let i = 0; i < 5; i++) { const p = dW(g, u - 0.9 + i * 0.45, v - sd * 0.9); B.box(p.x, y + 0.95, p.z, 0.3, 0.2 + rnd() * 0.3, 0.3, yaw, ['#e8c82a', '#d84a3a', '#2a8ad8', '#f2f2ee', '#3aa85a', '#b87a3a'][(rnd() * 6) | 0]); }
      B.end({ kind: 'tent', mat: 'metal', x: w.x, z: w.z, r: 1.5, loss: 0.04 });
    }
    for (const sd of [-1, 1]) { const u = 69, v = sd * 11.5;                                         // киоски под красной черепицей
      S.box(4, 2.6, 3, u, y + 1.3, -v, '#f2ecd8'); S.box(3.2, 1.0, 0.1, u, y + 1.4, -v + sd * 1.52, '#3e4858'); acZ(S, u + 1, y + 1.6, -v - sd * 1.5, -sd); S.hip(u, -v, 2.6, 2.1, y + 2.6, 0.4, 0.2, y + 3.8, (i) => i % 2 ? '#b8443a' : '#9a3830'); wallBox(g, u, v, 4, 3); }
    g.add(hotelMesh(S)); B.finish([sp.x, sp.z]);
  }
}
function buildChoengMonBars() {
  const Bc = (IS.beaches || []).find((b) => b.id === 'choeng_mon'); if (!Bc) return;
  const N = Bc.pts.length, rnd = seededRandom(2837), B = propBatch();
  const free = (f, a, d, r) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([da, dd]) => dFree(...dBW(f, a + da, d + dd), 3));
  // бар-хижина под соломой прямо на песке ≈ 10 × 6 (фото 01)
  { const f = dFrame(Bc, Math.round(N * 0.22)); if (free(f, 0, 12, 6)) { const g = dBeachGroup(f, 0, 12), S = sculptor(), y = groundY(...dBW(f, 0, 12)); dThatchBar(S, y); g.add(hotelMesh(S)); wallBox(g, 0, 0, 10, 6); dKeep(...dBW(f, 0, 12), 8); } }
  // ресторан: три деревянных домика под зелёными крышами и ряд шезлонгов перед ними (фото 02)
  { const f = dFrame(Bc, Math.round(N * 0.5));
    if (free(f, 0, 32, 10)) { const g = dBeachGroup(f, 0, 32), S = sculptor();
      for (const x of [-8, 0, 8]) { const w = dW(g, x, 0), y = groundY(w.x, w.z); S.box(5, 0.6, 5, x, y + 0.3, 0, '#8a6a44'); S.box(4.4, 2.6, 4, x, y + 1.9, -0.3, '#a07a52'); S.box(1.2, 2.0, 0.08, x, y + 1.6, 1.72, '#3a2a22'); for (const sd of [-1, 1]) { winX(S, x + sd * 2.2, y + 2.0, -0.3, 0.9, 1.0, sd, '#2a2420', '#6a4a2e'); for (const q of [-1, 1]) S.box(0.05, 1.0, 0.42, x + sd * 2.27, y + 2.0, -0.3 + q * 0.68, '#7a5a3a'); }   // окна со ставнями
        S.hip(x, 0, 2.9, 2.7, y + 3.2, 0.4, 0.3, y + 4.6, (i) => i % 2 ? '#3a7a4a' : '#2f6a3e'); wallBox(g, x, 0, 5, 5); }
      g.add(hotelMesh(S)); dKeep(...dBW(f, 0, 32), 14);
      for (let k = 0; k < 6; k++) { const [x, z] = dBW(f, (k - 2.5) * 2.6, 13), y = groundY(x, z), yaw = Math.atan2(-f.nz, f.nx); if (!dFree(x, z, 3)) continue;
        B.begin(); B.box(x, y + 0.3, z, 1.9, 0.08, 0.66, yaw, '#8a6a44'); B.box(x, y + 0.37, z, 1.5, 0.08, 0.58, yaw, '#f2f2ee'); B.box(x + f.nx * 0.8, y + 0.52, z + f.nz * 0.8, 0.5, 0.36, 0.6, yaw, '#f2f2ee'); B.end({ kind: 'small', mat: 'wood', x, z, r: 0.75, loss: 0.02 }); } } }
  // столы под белыми скатертями на песке (фото 03, 04)
  { const f = dFrame(Bc, Math.round(N * 0.36));
    for (let k = 0; k < 5; k++) { const [x, z] = dBW(f, (k - 2) * 3.2, 9 + (k % 2) * 2.5); if (!dFree(x, z, 3)) continue; const y = groundY(x, z);
      B.begin(); B.box(x, y + 0.38, z, 1.2, 0.76, 0.9, 0, '#f6f6f2'); B.box(x, y + 0.77, z, 1.3, 0.04, 1.0, 0, '#ffffff');
      for (const s of [-1, 1]) B.box(x + s * 0.95, y + 0.24, z, 0.42, 0.48, 0.42, 0, '#f2f2ee'); B.end({ kind: 'small', mat: 'wood', x, z, r: 1.0, loss: 0.02 }); } }
  // ряд красно-белых зонтов с лежаками (фото 06)
  { const f = dFrame(Bc, Math.round(N * 0.7));
    for (let k = 0; k < 6; k++) { const [x, z] = dBW(f, (k - 2.5) * 2.8, 10); if (!dFree(x, z, 3)) continue; const y = groundY(x, z), it = B.begin();
      B.box(x, y + 1.1, z, 0.07, 2.2, 0.07, 0, '#e8e4da');
      for (let q = 0; q < 8; q++) { const a0 = q / 8 * 6.283, a1 = (q + 1) / 8 * 6.283; B.quad([x, y + 2.45, z], [x + Math.cos(a0) * 1.2, y + 2.0, z + Math.sin(a0) * 1.2], [x + Math.cos(a1) * 1.2, y + 2.0, z + Math.sin(a1) * 1.2], [x, y + 2.45, z], q % 2 ? '#d42020' : '#f2f2ee'); }
      it.boxes.push([x, y + 2.2, z, 1.6, 0.06, 1.6, 0, 0xd42020]); B.end({ kind: 'small', mat: 'wood', x, z, r: 0.3, loss: 0.02 }); } }
  // оранжевый трёхэтажный корпус отеля на террасе (фото 07)
  { const f = dFrame(Bc, Math.round(N * 0.86));
    for (const d of [44, 40, 36]) if (free(f, 0, d, 12)) { const g = dBeachGroup(f, 0, d), S = sculptor(), y = groundY(...dBW(f, 0, d));
      S.box(22, 1.4, 10, 0, y - 0.6, 0, '#a89878'); S.box(22, 9.6, 9, 0, y + 4.8, 0, '#e8823a');
      for (let fl = 0; fl < 3; fl++) for (let x = -9; x <= 9; x += 3) { S.box(2.2, 1.6, 0.08, x, y + 1.6 + fl * 3.1, 4.52, '#3e4858'); S.box(2.6, 0.1, 1.0, x, y + 0.8 + fl * 3.1, 5.0, '#f2f2ee'); }
      blockBackSides(S, 22, 9, y, 3.1, 3, { balcony: true, ac: true, slab: '#f2e6d8', rail: '#f2e6d8' });
      S.box(22.6, 0.4, 9.6, 0, y + 9.8, 0, '#f2e6d8'); g.add(hotelMesh(S)); wallBox(g, 0, 0, 22, 9); dKeep(...dBW(f, 0, d), 14); break; } }
  B.finish(dBW(dFrame(Bc, N >> 1), 0, 10));
}

// =====================================================================================================
// 2. ЮГ
// =====================================================================================================
// Тонг Крут: береговая улица — это кольцевая; с моря вдоль неё — рестораны морепродуктов на сваях над песком и водой
// (фото 06–09), у берега — длиннохвостки рядами (01, 04, 16) и рыбацкая лодка с гирляндой (15), хижины на сваях (10);
// со стороны суши — двухэтажный бело-голубой хостел с баком на крыше (03) и дома посёлка
function buildThongKrut() {
  const H = dRoad(-3007, -1568); if (!H) return;
  const { R, r: RI, q: q0 } = H;
  const rnd = seededRandom(1568), pier = IS.piers && IS.piers.thong_krut;
  const wet = (sg) => { let n = 0; for (const t of [-120, -40, 40, 120]) for (let d = 8; d < 90; d += 3) { const p = roadPoint(R, q0.s + t, sg * d); if (groundY(p[0], p[1]) < 0) { n += 90 - d; break; } } return n; };
  const sea = wet(1) > wet(-1) ? 1 : -1, S0 = R.ring ? q0.s - 210 : Math.max(4, q0.s - 210), S1 = R.ring ? q0.s + 210 : Math.min(R.len - 4, q0.s + 210);
  TOWN.claims.push({ r: RI, s0: S0 - 10, s1: S1 + 10 });
  const NAMES = ['THONG KRUT SEAFOOD', 'SEAFOOD', 'KOH TAN VIEW', 'CAPTAIN', 'FISHERMAN', 'SEA BREEZE', 'BAAN THONG KRUT', 'BLUE SEA', 'GRILL', 'SUNSET'];
  let k = 0, last = -1e9;
  for (let s = S0; s < S1; s += 6) {
    if (s - last < 38) continue;
    const pr = roadPoint(R, s, 0); if (pier && Math.hypot(pr[0] - pier.x, pr[1] - pier.z) < 60) continue;
    let d0 = 0; for (let d = 8; d < 70; d += 1) { const p = roadPoint(R, s, sea * d); if (groundY(p[0], p[1]) < 0.3) { d0 = d; break; } }
    if (!d0 || d0 < 9) continue;
    const c = roadPoint(R, s, sea * (d0 + 2)), m = roadPoint(R, s, sea * (d0 - 3)), toSea = Math.atan2(c[1] - pr[1], c[0] - pr[0]);
    if (townBlocked(c[0], c[1]) || townBlocked(m[0], m[1]) || pierYAt(c[0], c[1]) !== null) continue;
    last = s; buildStiltRestaurant(c[0], c[1], toSea, NAMES[k % NAMES.length], rnd, k);
    k++;
  }
  // со стороны суши — дома посёлка и хостел
  townStreet(R, RI, S0, S1, -sea, 10.4, 10, [16, 12, 20], 0.5, {}, (lot, q) => shophouseRow(lot, q, Object.assign({}, HUA_STYLE, { signs: ['SEAFOOD', 'MINI MART', 'COFFEE', 'TOURS', 'BIKE RENT', 'GUESTHOUSE', 'NOODLES', 'MASSAGE'], thai: 0.5, scooters: 0.3 })), rnd);
  { const lot = dLotNear(-3007, -1568, 12, 9, [-sea]);
    if (lot) { const S = sculptor(), Gl = sculptor(), L = lot.len, F = lot.D / 2, H = 6.6;                  // хостел
      S.box(L, 1.6, lot.D, 0, -0.6, 0, '#8f8b80'); S.box(L - 0.4, H, lot.D - 0.4, 0, 0.2 + H / 2, 0, '#f4f4f0');
      for (const y of [0.2 + 3.3, 0.2 + H]) S.box(L - 0.2, 0.25, lot.D - 0.2, 0, y, 0, '#3a8ac8');
      for (let x = -L / 2 + 1.5; x < L / 2 - 1; x += 2.2) for (const y of [1.7, 5.0]) { S.box(1.2, 1.3, 0.08, x, y, F - 0.17, '#3e4858'); if (rnd() < 0.4) Gl.box(1.1, 1.2, 0.02, x, y, F - 0.1, '#ffe7a6'); }
      blockBackSides(S, L - 0.4, lot.D - 0.4, 0.2, 3.3, 2, { ac: true, step: 3 });                         // окна по периметру (просил Влад)
      for (let x = -L / 2 + 2.6; x < L / 2 - 1; x += 4.4) acZ(S, x, 6.1, F - 0.2, 1);
      S.tube(L / 2 - 2, 0.2 + H + 0.2, 0.2 + H + 1.8, -1, 0.7, 0.7, '#3a7ad8', 10);                       // бак на крыше
      { const px = 0.1; S.box(3.4, 0.7, 0.1, 0, 2.9, F - 0.12, '#3a8ac8'); S.text('HOSTEL', 0, 2.9 + px * 2.5, F - 0.05, px, '#ffffff', 1); }
      townWalk(lot, S, 2.7, '#2a2a2c'); townDone(lot, S, Gl, -F, F, 2.9); } }
  // хижины на сваях у воды и рыбацкая лодка с гирляндой ламп
  { const s = q0.s + 150, p = roadPoint(R, s, 0);
    for (let j = 0; j < 3; j++) { let d0 = 0; for (let d = 8; d < 70; d++) { const q = roadPoint(R, s + j * 9, sea * d); if (groundY(q[0], q[1]) < 0.2) { d0 = d; break; } } if (!d0) continue;
      const c = roadPoint(R, s + j * 9, sea * (d0 + 4)); if (townBlocked(c[0], c[1])) continue;
      const g = townGroup(c[0], c[1], Math.atan2(c[1] - p[1], c[0] - p[0])), S = sculptor(), y = 1.8;
      for (const u of [-1.6, 1.6]) for (const v of [-1.6, 1.6]) S.box(0.16, y + 1.5, 0.16, u, y / 2 - 0.5, -v, '#5a4a38');
      S.box(4, 0.2, 4, 0, y, 0, '#7a6a52'); S.box(3.4, 2.2, 3.2, 0, y + 1.2, 0, '#8a7a5e'); S.box(0.06, 0.9, 1.2, 1.71, y + 1.4, 0, '#2a2420'); S.gable(0, 0, 4.4, 2.3, y + 2.3, y + 3.4, '#9a8a6a', '#7a6a52', 'x');
      g.add(hotelMesh(S)); wallBox(g, 0, 0, 4, 4); dSeen(g, c[0], c[1]); }
    const b = roadPoint(R, q0.s - 60, sea * 1), bp = (() => { for (let d = 10; d < 120; d += 2) { const q = roadPoint(R, q0.s - 60, sea * d); if (groundY(q[0], q[1]) < -1.0) return q; } return null; })();
    if (bp) { const boat = boatFisher(rnd); boat.position.set(bp[0], 0, bp[1]); boat.rotation.y = rnd() * 6; scene.add(boat); dSeen(boat, bp[0], bp[1]);
      const Gl = sculptor(), Sb = sculptor(); for (let i = 0; i < 12; i++) { const t = i / 11, x = -4 + t * 8, y = 3.2 - Math.sin(t * Math.PI) * 0.5; Sb.box(0.16, 0.16, 0.16, x, y, 0, '#e8e4d8'); Gl.box(0.18, 0.18, 0.18, x, y, 0, '#fff2c0'); }
      boat.add(Sb.mesh()); const gm = Gl.mesh(); gm.material = dLit(); gm.visible = false; nightGlow.push(gm); boat.add(gm); } }
}
// ресторан морепродуктов на сваях: настил над песком и водой, крыша, перила, столы с белыми стульями, вывеска к дороге
function buildStiltRestaurant(x, z, toSea, name, rnd, k) {
  const g = townGroup(x, z, toSea), S = sculptor(), Gl = sculptor(), Wd = 12 + (k % 3) * 2, D = 9;    // u — к морю, v — вдоль дороги
  const land = groundY(...(() => { const w = dW(g, -D / 2, 0); return [w.x, w.z]; })()), y = Math.max(land, 0.6) + 0.9;
  for (let u = -D / 2 + 0.3; u <= D / 2; u += D / 3) for (let v = -Wd / 2 + 0.3; v <= Wd / 2; v += Wd / 4) { const w = dW(g, u, v), gy = Math.max(groundY(w.x, w.z), -2.5); S.box(0.24, y - gy + 0.1, 0.24, u, (y + gy) / 2, -v, '#6a5a48'); }
  S.box(D, 0.25, Wd, 0, y, 0, '#8a6a44'); for (let v = -Wd / 2 + 0.4; v < Wd / 2; v += 0.6) S.box(D, 0.02, 0.06, 0, y + 0.13, -v, '#6f543a');
  for (const u of [-D / 2 + 0.2, D / 2 - 0.2]) for (const v of [-Wd / 2 + 0.2, 0, Wd / 2 - 0.2]) S.box(0.18, 3.0, 0.18, u, y + 1.6, -v, '#6a4a2e');
  const roof = k % 2 ? ['#b89a5a', '#a8884a'] : ['#8e9aa0', '#7e8a90'];                                   // солома или жесть
  S.gable(0, 0, Wd + 1.0, D / 2 + 1.0, y + 3.0, y + 4.6, roof[0], roof[1], 'z');
  S.box(0.08, 0.9, Wd, D / 2, y + 0.55, 0, '#f2f2ee'); for (const sg of [-1, 1]) S.box(D, 0.9, 0.08, 0, y + 0.55, sg * Wd / 2, '#f2f2ee');   // перила
  { const A = sculptor(), f = signFit(name, 6, 0.1), bh = f.h + 0.35;                                                     // вывеска со стороны дороги
    S.box(0.1, bh, 7, -D / 2 - 0.1, y + 3.4, 0, '#1f4fa0'); signLines(A, name, 6, '#f8f4e6', 0.06, 0.1); const m = A.mesh(); m.rotation.y = -Math.PI / 2; m.position.set(-D / 2 - 0.16, y + 3.4, 0); g.add(m); }
  for (let v = -Wd / 2 + 1.2; v < Wd / 2 - 1; v += 2.4) Gl.box(0.16, 0.16, 0.16, D / 2 - 0.4, y + 2.8, -v, '#fff2c0');
  g.add(hotelMesh(S)); { const m = Gl.mesh(); m.material = dLit(); m.visible = false; nightGlow.push(m); g.add(m); }
  wallBox(g, 0, 0, D, Wd); dSeen(g, x, z); dKeep(x, z, Math.max(D, Wd) / 2 + 2);
  const B = propBatch(); for (let u = -D / 2 + 2; u < D / 2 - 1; u += 2.6) for (let v = -Wd / 2 + 2; v < Wd / 2 - 1; v += 3) { const w = dW(g, u, v);
    B.begin(); B.box(w.x, y + 0.85, w.z, 0.9, 0.05, 0.9, 0, '#f2f2ee'); B.box(w.x, y + 0.5, w.z, 0.08, 0.7, 0.08, 0, '#c8ccd0');
    for (const s of [-1, 1]) B.box(w.x + s * 0.7, y + 0.55, w.z, 0.42, 0.06, 0.42, 0, '#f6f6f2'); B.end({ kind: 'small', mat: 'metal', x: w.x, z: w.z, r: 0.9, loss: 0.01 }); }
  B.finish([x, z]);
  for (let j = 0; j < 2; j++) { const w = dW(g, D / 2 + 9 + j * 6, (j ? -1 : 1) * (3 + rnd() * 3)); if (groundY(w.x, w.z) < -0.4) townBoat(boatLongtail, w.x, w.z, -toSea + Math.PI / 2 + (rnd() - 0.5) * 0.6, rnd); }
  if (k === 0) LANDMARKS.push({ name: 'ТОНГ КРУТ РЕСТОРАНЫ', x: dW(g, -D / 2 - 9, 0).x, z: dW(g, -D / 2 - 9, 0).z, heading: Math.atan2(-Math.cos(toSea) * -1, -Math.sin(toSea) * -1) });
}
// пляж Банг Као: полосы бурых водорослей на песке, камни на мелководье, длиннохвостки на якоре, бунгало под
// красно-оранжевой черепицей, вилла с белой балюстрадой над подпорной стенкой
function beachBangKao(Bc) {
  const K = beachKit(Bc, 7713), rnd = seededRandom(855), N = Bc.pts.length, S = sculptor();
  for (let i = 2; i < N - 2; i++) { if (rnd() < 0.35) continue; const f = dFrame(Bc, i), d = 1.5 + rnd() * 3, a = (rnd() - 0.5) * 4, l = 2 + rnd() * 4;   // водоросли
    const p = (aa, dd) => { const [x, z] = dBW(f, aa, dd); return [x, groundY(x, z) + 0.03, z]; };
    S.quad(p(a - l / 2, d), p(a + l / 2, d), p(a + l / 2, d + 0.5 + rnd() * 0.5), p(a - l / 2, d + 0.4), rnd() < 0.5 ? '#6a5a3a' : '#7a6a42'); }
  for (let j = 0; j < 12; j++) { const f = dFrame(Bc, 3 + ((rnd() * (N - 6)) | 0)), [x, z] = dBW(f, (rnd() - 0.5) * 8, -3 - rnd() * 10); dBoulder(S, x, z, 0.5 + rnd() * 1.2, rnd, ['#6e6a62', '#7e786c', '#5e5a54']); }
  scene.add(S.mesh());
  for (let i = 8; i < N - 8; i += 9) { if (rnd() < 0.5) K.anchored(K.frame(i), (rnd() - 0.5) * 8, -12 - rnd() * 14, boatLongtail); }
  for (let i = 10; i < N - 10; i += 19) {                                                        // бунгало по два-три на террасе
    const f = dFrame(Bc, i), d = 36; if (![-9, 0, 9].every((a) => dFree(...dBW(f, a, d), 6))) continue;
    const g = dBeachGroup(f, 0, d), T = sculptor(), y0 = groundY(...dBW(f, 0, d));
    [-9, 0, 9].forEach((x, q) => { if (q === 1 && rnd() < 0.4) return; beachBungalow(T, x, y0, ['#efe8d8', '#e6d8c0', '#f2f0e8'][q]); T.box(6.4, 1.4, 6.6, x, y0 - 0.68, 0.3, '#a89878'); wallBox(g, x, 0.5, 6, 5); });
    g.add(hotelMesh(T)); dKeep(...dBW(f, 0, d), 15);
    K.lounger(f, -2, 12, '#f2f2ee', '#e8e8e4'); K.lounger(f, 2, 12, '#f2f2ee', '#e8e8e4'); K.umbrella(f, 0, 14, '#e8782a');
  }
  { const f = dFrame(Bc, Math.round(N * 0.62)), d = 46;                                             // вилла над подпорной стенкой
    if ([-8, 0, 8].every((a) => dFree(...dBW(f, a, d), 6))) { const g = dBeachGroup(f, 0, d), T = sculptor(), y = groundY(...dBW(f, 0, d)) + 1.2;
      T.box(18, 2.6, 1.0, 0, y - 1.2, 6, '#a8a090'); T.box(18, 2.4, 12, 0, y - 1.2, 0, '#b8b0a0');
      T.box(14, 3.2, 8, 0, y + 1.6, -1.5, '#f6f4ee'); T.box(14.4, 0.3, 8.4, 0, y + 3.3, -1.5, '#e8e4dc'); T.box(10, 2.8, 6.5, 0, y + 4.8, -2, '#f6f4ee'); T.box(10.4, 0.3, 6.9, 0, y + 6.3, -2, '#e8e4dc');
      acX(T, 7, y + 0.9, -3.8, 1); acX(T, 7, y + 0.9, -2.4, 1); acX(T, 5, y + 3.95, -3.5, 1);   // кондиционеры сбоку
      for (let x = -8.5; x <= 8.5; x += 0.55) T.box(0.14, 0.8, 0.14, x, y + 0.5, 5.4, '#f8f8f4'); T.box(17.6, 0.12, 0.25, 0, y + 0.95, 5.4, '#f8f8f4');
      for (let x = -5; x <= 5; x += 2.5) T.box(1.6, 2.0, 0.08, x, y + 1.4, 2.55, '#3e4858');
      g.add(hotelMesh(T)); wallBox(g, 0, 0, 18, 12); dKeep(...dBW(f, 0, d), 13); } }
  K.B.finish(K.W(K.frame(N >> 1), 0, 10));
  K.place(Bc.name);
}
// Талинг Нгам: ворота со слонами на въезде к Wat Khiri Wongkaram (главный ориентир), пёстрые лавки на кольцевой,
// белые виллы ступенями по склону у мыса Лаем Хин Ком
function dElephant(S, x, y, z, face, sc = 1) {                             // серый слон с красно-жёлтой попоной, хобот поднят; смотрит на +X·face; sc — масштаб
  const k = face * sc, G = '#8e8c88', GD = '#7a7874', Y = (h) => y + h * sc;
  for (const dz of [-0.55, 0.55]) for (const dx of [-0.75, 0.75]) S.limb([x + dx * k, y, z + dz * sc], [x + dx * k, Y(1.5), z + dz * sc], 0.32 * sc, 0.3 * sc, G, 7);
  S.blob(x, Y(2.2), z, 1.35 * sc, 0.95 * sc, 0.9 * sc, G, 10, 6);                                // туловище
  S.blob(x, Y(2.75), z, 1.05 * sc, 0.25 * sc, 0.95 * sc, '#c8302a', 9, 3); S.box(1.6 * sc, 0.08, 1.95 * sc, x, Y(2.6), z, '#e8c82a');   // попона
  S.blob(x + 1.35 * k, Y(2.75), z, 0.62 * sc, 0.62 * sc, 0.58 * sc, G, 9, 5);                    // голова
  for (const s of [-1, 1]) S.blob(x + 1.2 * k, Y(2.75), z + s * 0.7 * sc, 0.12 * sc, 0.62 * sc, 0.5 * sc, GD, 6, 4);   // уши
  S.limb([x + 1.85 * k, Y(2.6), z], [x + 2.1 * k, Y(3.4), z], 0.22 * sc, 0.17 * sc, G, 6); S.limb([x + 2.1 * k, Y(3.4), z], [x + 2.0 * k, Y(4.3), z], 0.17 * sc, 0.12 * sc, G, 6);   // хобот вверх, к балке
  for (const s of [-1, 1]) S.limb([x + 1.75 * k, Y(2.45), z + s * 0.28 * sc], [x + 2.2 * k, Y(2.3), z + s * 0.32 * sc], 0.07 * sc, 0.03 * sc, '#f2ecd8', 5);   // бивни
}
function buildTalingNgam() {
  const rnd = seededRandom(2354);
  if (IS.spots && IS.spots.taling_gate) {
    const g = spotGroup('taling_gate'), sp = g.userData.spot, S = sculptor(), Gd = sculptor(), U = 12, y = spotGround(g, U, 0);
    const PV = halfS + 2.2, EL = 1.4, BU = U + 1.4, BY = y + 1.55 + 4.3 * EL + 0.55;              // тумбы — за обочиной; балка лежит на поднятых хоботах
    for (const sd of [-1, 1]) { const v = sd * PV; S.box(3.2, 1.4, 3.6, U, y + 0.7, -v, '#3ab8b0'); S.box(3.4, 0.15, 3.8, U, y + 1.47, -v, '#e8dcc0'); dElephant(S, U - 1.4, y + 1.55, -v, 1, EL); wallBox(g, U, v, 3.4, 3.8); }
    const BL = 2 * PV + 3.8;
    S.box(1.0, 1.5, BL, BU, BY, 0, '#efe4c8'); S.box(1.2, 0.25, BL + 0.6, BU, BY + 0.85, 0, '#c8a868'); S.box(1.2, 0.25, BL + 0.6, BU, BY - 0.85, 0, '#c8a868');   // кремовая балка
    for (const face of [1, -1]) { const A = sculptor(); signLines(A, 'WAT KHIRI WONGKARAM', BL - 3, '#8a2a1a', 0.06, 0.09); const m = A.mesh(); m.rotation.y = face * Math.PI / 2; m.position.set(BU + face * 0.51, BY, 0); g.add(m); }
    // во дворе храма: небольшой зал и ступа
    const yy = spotGround(g, -20, 0); S.box(10, 0.8, 7, -22, yy + 0.4, 6, '#d8d0bc'); S.box(8, 3.4, 5.4, -22, yy + 2.5, 6, '#f2e8c8');
    for (const e of [-1, 1]) for (const z of [4.8, 7.2]) thaiWindow(Gd, -22 + e * 4.02, yy + 2.1, z, 0.7, 1.5, 'x', e); for (const x of [-24.4, -22, -19.6]) thaiWindow(Gd, x, yy + 2.1, 8.72, 0.7, 1.5, 'z', 1);   // окна по бокам и сзади
    S.box(1.6, 2.4, 0.1, -22, yy + 2.0, 3.27, '#5a3a22'); S.box(2.0, 0.2, 0.12, -22, yy + 3.3, 3.25, T_GOLD);   // дверь
    thaiRoof(Gd, -22, 6, { len: 10.4, hw: 3.6, y0: yy + 4.2, y1: yy + 8.2, tiers: 2, step: 2.4, drop: 0.9, skirt: 1.0, tile: ['#b8443a', '#9a3830'], front: T_GOLD }); wallBox(g, -22, -6, 10, 7);
    S.box(3.4, 0.6, 3.4, -22, yy + 0.3, -8, '#d8d0bc'); chedi(Gd, -22, yy + 0.6, -8, 1.4, 7.5); wallBox(g, -22, 8, 3.4, 3.4);
    g.add(hotelMesh(S)); g.add(templeMesh(Gd)); dSeen(g, sp.x, sp.z);
    spotPlace('ВОРОТА СО СЛОНАМИ', g, 28, 0, -1, 0);
  }
  // пёстрые лавки на кольцевой (фото 04)
  { const H = dRoad(-1573, -2274), q = H && H.q;
    if (q) { const TALING = { floors: [1, 1], roof: 'tile', balcony: 0, kerb: '#2a2a2c', thai: 0.6, scooters: 0.35,
        walls: ['#f2c81e', '#3aa8c8', '#e8782a', '#8ac83a', '#e86a8a', '#f2efe6', '#4a8ad8'], signs: ['MINI MART', 'FRUIT SHAKE', 'COFFEE', 'NOODLES', 'SEAFOOD', 'BIKE RENT', 'MASSAGE', 'THAI FOOD'] };
      TOWN.claims.push({ r: H.r, s0: q.s - 100, s1: q.s + 100 });
      for (const sd of [1, -1]) townStreet(H.R, H.r, Math.max(4, q.s - 90), Math.min(H.R.len - 4, q.s + 90), sd, 10.4, 8, [12, 16, 8], 0.8, {}, (lot, qq) => shophouseRow(lot, qq, TALING), rnd); } }
  // белые виллы отелей ступенями по склону у мыса (фото 10, 11): смотрят на море (на запад)
  { const cx = -1850, cz = -2250, placed = [];                                              // холмы к западу от посёлка
    for (let i = 0; i < 900 && placed.length < 9; i++) {
      const x = cx + (rnd() - 0.5) * 500, z = cz + (rnd() - 0.5) * 500, y = groundY(x, z);
      if (y < 5 || y > 45 || Math.hypot(x + 1599, z + 2299) < 50 || roadDist(x, z) < 12 || townBlocked(x, z) || placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 24)) continue;
      const lo = Math.min(groundY(x - 5, z - 4), groundY(x + 5, z - 4), groundY(x - 5, z + 4), groundY(x + 5, z + 4)), hi = Math.max(groundY(x - 5, z - 4), groundY(x + 5, z - 4), groundY(x - 5, z + 4), groundY(x + 5, z + 4));
      if (hi - lo > 6) continue;
      placed.push([x, z]);
      const g = townGroup(x, z, -Math.PI / 2), S = sculptor();                                   // u — на запад, к морю
      S.box(10, hi - lo + 1.5, 8, 0, lo + (hi - lo) / 2 - 0.5, 0, '#d8d2c4');                   // цоколь до земли
      S.box(10, 3.4, 8, 0, hi + 1.7, 0, '#f8f6f0'); S.box(10.4, 0.3, 8.4, 0, hi + 3.5, 0, '#e8e4dc');
      S.box(0.08, 2.4, 6, 5.02, hi + 1.5, 0, '#3e4858');
      for (const sd of [-1, 1]) for (const x of [-2.6, 1.6]) winZ(S, x, hi + 1.9, sd * 4, 1.4, 1.2, sd, '#3e4858', '#e8e4dc');   // как у настоящих: окна на боках, сзади — дверь, окошки, кондиционеры
      winX(S, -5, hi + 1.2, 1.8, 0.9, 2.1, -1, '#6a5a48', '#e8e4dc'); for (const z of [-2.8, -0.6]) winX(S, -5, hi + 2.4, z, 0.8, 0.5, -1, '#3e4858', '#e8e4dc');
      acX(S, -5, hi + 0.6, -1.6, -1); acX(S, -5, hi + 0.6, -3.0, -1); S.box(3, 0.1, 8, 6.5, hi + 0.05, 0, '#e8e4dc'); S.box(2.6, 0.12, 5, 6.5, hi + 0.08, 0, '#3cc2d4');   // стеклянный фасад, терраса, бассейн
      g.add(hotelMesh(S)); wallBox(g, 0, 0, 10, 8); dSeen(g, x, z); dKeep(x, z, 9);
    } }
}

// =====================================================================================================
// 3. КОЛЬЦЕВАЯ: больница и гипермаркет
// =====================================================================================================
function dLot(s, W, D, PARK, color) {                                       // площадка у дороги (как у рынков): группа, бетон, борт, край к дороге
  const g = new THREE.Group(); g.position.set(s.x, s.y + LOT_RISE, s.z); g.rotation.y = -s.az; scene.add(g); g.updateMatrixWorld(true);
  const A = sculptor(), U1 = D / 2 + PARK;
  A.quad([-D / 2 - 1, LOT_Y, -W / 2 - 1], [U1, LOT_Y, -W / 2 - 1], [U1, LOT_Y, W / 2 + 1], [-D / 2 - 1, LOT_Y, W / 2 + 1], color); A.skirt(-D / 2 - 1, U1, -W / 2 - 1, W / 2 + 1, LOT_Y, '#827f76');
  g.add(A.mesh()); lotApron(g, U1, -W / 2 - 1, W / 2 + 1, LOT_Y, color);
  vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 4 && p.x < U1 + 1 && Math.abs(p.z) < W / 2 + 4; }, { c: [s.x, s.z, Math.hypot(W, D) / 2 + 14] }));
  pavedAreas.push({ x: s.x, z: s.z, r2: (Math.hypot(W, D) / 2 + 12) ** 2, lift: LOT_Y + LOT_RISE, test: (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 1 && p.x < U1 && Math.abs(p.z) < W / 2 + 1; } });
  dSeen(g, s.x, s.z);
  return { g, U1 };
}
// Bangkok Hospital Samui: три белых корпуса под крутыми шатровыми крышами, стеклянный вход под средним, над ним —
// красно-золотая Гаруда; цоколь из бежевого камня, газон; у въезда — белая стела с красным крестом и синей плашкой, шлагбаум
function buildHospital() {
  const s = (IS.malls || []).find((m) => m.kind === 'hospital'); if (!s) return;
  const W = 96, D = 64, Y = LOT_Y, { g, U1 } = dLot(s, W, D, 18, '#9a968c'), S = sculptor(), Gl = sculptor(), rnd = seededRandom(1754);
  S.quad([-D / 2, Y + 0.01, -W / 2], [D / 2 - 2, Y + 0.01, -W / 2], [D / 2 - 2, Y + 0.01, W / 2], [-D / 2, Y + 0.01, W / 2], '#5a9a4a');   // газон
  const pav = (cu, cv, L, Wd, H) => {
    S.box(L + 1.2, 1.0, Wd + 1.2, cu, Y + 0.5, -cv, '#d8c8a8');                                        // цоколь из бежевого камня
    S.box(L, H, Wd, cu, Y + 1 + H / 2, -cv, '#f6f6f2');
    for (let fl = 0; fl < 2; fl++) { const wy = Y + 2.4 + fl * 3.4;                                    // окна двух этажей по всему периметру
      for (const sg of [-1, 1]) {
        for (let v = -Wd / 2 + 1.5; v < Wd / 2 - 1; v += 2.2) { S.box(0.08, 1.4, 1.5, cu + sg * (L / 2 + 0.02), wy, -(cv + v), '#3e4858'); if (rnd() < 0.5) Gl.box(0.02, 1.3, 1.4, cu + sg * (L / 2 + 0.08), wy, -(cv + v), '#fff2d0'); }
        for (let u = -L / 2 + 1.5; u < L / 2 - 1; u += 2.2) { S.box(1.5, 1.4, 0.08, cu + u, wy, -cv + sg * (Wd / 2 + 0.02), '#3e4858'); if (rnd() < 0.5) Gl.box(1.4, 1.3, 0.02, cu + u, wy, -cv + sg * (Wd / 2 + 0.08), '#fff2d0'); }
      } }
    const RF = ['#f4f4f0', '#cfd2d6', '#e4e4e0', '#bfc2c6'];                                          // грани крыши разного тона — иначе белое пятно
    S.hip(cu, -cv, L / 2 + 1.2, Wd / 2 + 1.2, Y + 1 + H, L / 4, Wd / 4, Y + 1 + H + 6.5, (i) => RF[i]);
    S.hip(cu, -cv, L / 4 + 0.3, Wd / 4 + 0.3, Y + 1 + H + 6.0, 0.3, 0.3, Y + 1 + H + 10.5, (i) => RF[i]);
    wallBox(g, cu, cv, L + 1.2, Wd + 1.2);
  };
  pav(-8, 0, 26, 22, 7.6); pav(-12, -31, 22, 18, 7.2); pav(-12, 31, 22, 18, 7.2);
  for (const [cu, cv, L] of [[-8, 0, 26], [-12, -31, 22], [-12, 31, 22]]) for (let v = -6; v <= 6; v += 3) acX(S, cu - L / 2, Y + 1.35, -(cv + v), -1);   // ряд кондиционеров у задних стен
  S.box(4, 3.6, 10, 7, Y + 1.8, 0, '#cfe4ee'); S.box(7, 0.3, 12, 8.5, Y + 3.8, 0, '#f2f2ee'); wallBox(g, 7, 0, 4, 10);   // стеклянный вход под козырьком
  S.blob(5.2, Y + 11.2, 0, 0.3, 0.9, 0.6, '#c8302a', 7, 4); for (const sg of [-1, 1]) S.box(0.2, 0.5, 2.0, 5.2, Y + 11.5, sg * 1.2, '#e8b830');   // Гаруда
  // стела у въезда
  { const su = U1 - 4, sv = 24; S.box(1.4, 8, 3, su, Y + 4, -sv, '#f8f8f4'); S.box(0.1, 1.8, 0.5, su + 0.72, Y + 6.6, -sv, '#d42020'); S.box(0.1, 0.5, 1.8, su + 0.72, Y + 6.6, -sv, '#d42020');
    S.box(0.1, 2.0, 2.8, su + 0.72, Y + 3.4, -sv, '#1f4fa0'); wallBox(g, su, sv, 1.4, 3);
    const A = sculptor(); signLines(A, 'BANGKOK HOSPITAL SAMUI', 2.5, '#ffffff', 0.04, 0.05); const m = A.mesh(); m.rotation.y = Math.PI / 2; m.position.set(su + 0.78, Y + 3.4, -sv); g.add(m); }
  templeProp(g, U1 - 7, -4, (P) => { P.box(0.4, 1.0, 0.4, 0, Y + 0.5, 0, '#e8e4dc'); P.box(0.12, 0.12, 6, 0, Y + 1.0, -3.2, '#d42020'); for (let i = 0; i < 6; i++) P.box(0.13, 0.13, 0.5, 0, Y + 1.0, -0.8 - i, '#f2f2ee'); },   // шлагбаум
    { kind: 'pole', mat: 'metal', color: '#d42020', r: 0.4, loss: 0.03 });
  g.add(hotelMesh(S)); { const m = Gl.mesh(); m.material = dLit(); m.visible = false; nightGlow.push(m); g.add(m); }
  for (let k = 0; k < 7; k++) parkVehicle(g, k === 3 ? pickupGeo('closed', '#f2f2ee') : parkedCar(k + 11), D / 2 + 9, -40 + k * 9, k % 2 ? 'u+' : 'u-', Y);
  scooterRow(g, 151, 8, U1 - 2, 30, 0, 0.85, Math.PI, Y);
  spotPlace('БОЛЬНИЦА', g, U1 + 5, 0, -1, 0);
}
// логотип Big C на стене, смотрящей на +X: зелёная плашка, красный квадрат, белая буква C; z — центр, a — сторона
function dLogoC(S, x, y, z, a) {
  S.box(0.1, a, a, x, y, z, '#3aa83a'); S.box(0.1, a * 0.78, a * 0.78, x + 0.04, y, z, '#d42020');
  const t = a * 0.12, h = a * 0.5;
  S.box(0.06, h, t, x + 0.1, y, z + h / 2 - t / 2, '#ffffff');
  for (const s of [-1, 1]) S.box(0.06, t, h * 0.8, x + 0.1, y + s * (h / 2 - t / 2), z + h * 0.1, '#ffffff');
}
// Big C: большой корпус с красной полосой и вывеской (логотип C, тайская строка), вдоль дороги — ряд деревянных
// навесов-арок с логотипом C (фото 01, 02), рядом KFC, стоянка перед фасадом
function buildBigC() {
  const s = (IS.malls || []).find((m) => m.kind === 'bigc'); if (!s) return;
  const W = 104, D = 70, Y = LOT_Y, { g, U1 } = dLot(s, W, D, 30, '#8f8b84'), S = sculptor(), Gl = sculptor(), rnd = seededRandom(1430);
  const B0 = -35, F = 2, H = 11;
  S.box(F - B0, H, 96, (F + B0) / 2, Y + H / 2, 0, '#e8e8e4'); S.box(F - B0 + 0.3, 1.6, 96.3, (F + B0) / 2, Y + H - 0.8, 0, '#d42020'); S.box(F - B0 + 0.1, 0.2, 96.1, (F + B0) / 2, Y + H + 0.05, 0, '#b8bcc0');   // красная полоса по верху, серая кровля
  S.box(1.4, 3.6, 24, F + 0.7, Y + 1.8, 0, '#cfe4ee'); S.box(6, 0.3, 28, F + 3, Y + 4.0, 0, '#f2f2ee');   // вход под козырьком
  for (let v = -44; v <= 44; v += 8) if (Math.abs(v) > 14) { S.box(0.1, 2.4, 6, F + 0.02, Y + 1.6, -v, '#3e4858'); Gl.box(0.02, 2.2, 5.8, F + 0.08, Y + 1.6, -v, '#fff2d0'); }
  { const sh = signFit('BIG C', 9, 0.5).h + 0.6, yc = Y + H + sh / 2 - 0.4;                              // вывеска: красная доска, белые буквы, логотип C
    S.box(0.4, sh, 16, F - 0.2, yc, 0, '#d42020'); dLogoC(S, F + 0.02, yc, 6.4, 2.4);
    const A = sculptor(); signLines(A, 'BIG C', 9, '#ffffff', 0.25, 0.5); const m = A.mesh(); m.rotation.y = Math.PI / 2; m.position.set(F, yc, 0); g.add(m);
    const L = sculptor(); signLines(L, 'BIG C', 9, '#ffffff', 0.27, 0.5); const n = L.mesh(); n.material = dLit(); n.visible = false; nightGlow.push(n); n.rotation.y = Math.PI / 2; n.position.set(F, yc, 0); g.add(n); }
  for (const sd of [-1, 1]) for (let x = -31; x < -1; x += 4.2) { winZ(S, x + 2, Y + 4.2, sd * 48, 3.0, 1.8, sd, '#3e4858', '#c8ccd0'); if (rnd() < 0.5) Gl.box(2.8, 1.6, 0.02, x + 2, Y + 4.2, sd * 48.1, '#fff2d0'); }   // окна на торцах
  for (const [x, z] of [[-26, -30], [-26, -14], [-26, 14], [-26, 30], [-12, -22], [-12, 22]]) roofChiller(S, x, Y + H + 0.15, z, 'z');   // чиллеры на крыше
  wallBox(g, (F + B0) / 2, 0, F - B0, 96);
  for (let v = -40; v <= 40; v += 10) { const u = U1 - 5;                                               // навесы-арки вдоль дороги
    for (const dv of [-1.6, 1.6]) for (const du of [-1.2, 1.2]) S.box(0.18, 2.6, 0.18, u + du, Y + 1.3, -(v + dv), '#7a5a3a');
    for (let q = 0; q < 6; q++) { const a0 = q / 6 * Math.PI, a1 = (q + 1) / 6 * Math.PI; S.quad([u - 1.6, Y + 2.6 + Math.sin(a0) * 0.9, -(v - 2 + 4 * q / 6)], [u + 1.6, Y + 2.6 + Math.sin(a0) * 0.9, -(v - 2 + 4 * q / 6)], [u + 1.6, Y + 2.6 + Math.sin(a1) * 0.9, -(v - 2 + 4 * (q + 1) / 6)], [u - 1.6, Y + 2.6 + Math.sin(a1) * 0.9, -(v - 2 + 4 * (q + 1) / 6)], '#8a5a3a'); }
    dLogoC(S, u + 1.62, Y + 3.4, -v, 0.9); S.box(2.6, 0.9, 0.7, u, Y + 0.45, -v, '#a07a52'); wallBox(g, u, v, 2.6, 3.4); }
  { const ku = 22, kv = 44, kh = 4.4;                                                                    // KFC
    S.box(12, kh, 9, ku, Y + kh / 2, -kv, '#f6f6f2'); S.box(12.1, 0.35, 9.1, ku, Y + kh - 0.4, -kv, '#d42020');
    for (let i = 0; i < 6; i++) S.box(0.6, 0.5, 9.1, ku - 5.4 + i * 2.15, Y + kh + 0.25, -kv, i % 2 ? '#f6f6f2' : '#d42020');
    S.box(0.1, 2.2, 5, ku + 6.02, Y + 1.4, -kv, '#3e4858'); for (const sd of [-1, 1]) for (const x of [-3.6, 0, 3.6]) winZ(S, ku + x, Y + 1.7, -kv + sd * 4.5, 2.4, 1.6, sd, '#3e4858', '#d42020'); { const px = 0.22; S.text('KFC', ku + 6.1, Y + kh - 0.4 + px * 2.5 + 0.2, -kv, px, '#ffffff', 1); }
    roofChiller(S, ku - 2.5, Y + kh, -kv, 'z'); acZ(S, ku - 3, Y + 2.8, -kv - 4.5, -1);
    wallBox(g, ku, kv, 12, 9); }
  g.add(hotelMesh(S)); { const m = Gl.mesh(); m.material = dLit(); m.visible = false; nightGlow.push(m); g.add(m); }
  for (let row = 0; row < 2; row++) for (let k = 0; k < 9; k++) { if (rnd() < 0.3) continue; parkVehicle(g, parkedCar(k * 3 + row + 21), 12 + row * 9, -40 + k * 9.5, row ? 'u+' : 'u-', Y); }
  scooterRow(g, 171, 10, F + 6, 18, 0, 0.85, 0, Y); scooterRow(g, 177, 10, F + 6, -26, 0, 0.85, 0, Y);
  spotPlace('BIG C', g, U1 + 5, 0, -1, 0);
}

// =====================================================================================================
// 4. ЧАВЕНГ НОЙ И КОРАЛ КОВ
// =====================================================================================================
// Чавенг Ной: валуны по краям, отели — длинные двухэтажные корпуса под тёмно-красными ступенчатыми крышами, пляжные
// клубы на настилах с белой мебелью и бирюзовыми зонтами, гидроциклы; на северном мысу — золотая ступа на холме
function beachChawengNoi(Bc) {
  const K = beachKit(Bc, 2014), rnd = seededRandom(1997), N = Bc.pts.length, S = sculptor();
  for (const [end, sg] of [[2, 1], [N - 3, -1]]) { const f = dFrame(Bc, end); for (let k = 0; k < 10; k++) dBoulder(S, ...dBW(f, sg * (rnd() * 14 - 3), -6 + rnd() * 18), 1.0 + rnd() * 2.6, rnd); }
  scene.add(S.mesh());
  for (const i of [Math.round(N * 0.3), Math.round(N * 0.62)]) {                                    // отели
    const f = dFrame(Bc, i), d = 28; if (![-12, 0, 12].every((a) => dFree(...dBW(f, a, d), 11) && dFree(...dBW(f, a, d + 5), 6))) continue;   // корпус 28 × 9 — не на обочине
    const g = dBeachGroup(f, 0, d), T = sculptor(), y = groundY(...dBW(f, 0, d));
    T.box(28, 1.4, 9, 0, y - 0.6, 0, '#a89878'); T.box(26, 6.4, 7.5, 0, y + 3.2, 0, '#f2ece0');
    for (let fl = 0; fl < 2; fl++) for (let x = -11.5; x <= 11.5; x += 2.9) { T.box(2.0, 1.5, 0.08, x, y + 1.5 + fl * 3.1, 3.78, '#3e4858'); T.box(2.6, 0.1, 1.0, x, y + 0.8 + fl * 3.1, 4.2, '#c8b89a'); }
    blockBackSides(T, 26, 7.5, y, 3.1, 2, { balcony: true, ac: true, slab: '#c8b89a', rail: '#c8b89a' });
    T.hip(0, 0, 13.8, 4.6, y + 6.4, 11.5, 2.6, y + 7.6, (q) => q % 2 ? '#7a2a24' : '#6a2420'); T.hip(0, 0, 11, 2.4, y + 7.9, 8.5, 0.3, y + 9.0, (q) => q % 2 ? '#7a2a24' : '#6a2420');   // ступенчатая крыша
    g.add(hotelMesh(T)); wallBox(g, 0, 0, 28, 9); dKeep(...dBW(f, 0, d), 16);
    for (let k = 0; k < 6; k++) { K.lounger(f, (k - 2.5) * 2.6, 11, '#f2f2ee', '#c8a878'); if (k % 2 === 0) K.umbrella(f, (k - 2.5) * 2.6 + 1.3, 13, '#2ab8b0'); }
  }
  for (const i of [Math.round(N * 0.14), Math.round(N * 0.82)]) {                                   // пляжные клубы на настилах
    const f = dFrame(Bc, i), d = 12; if (![-5, 0, 5].every((a) => dFree(...dBW(f, a, d), 4))) continue;
    const g = dBeachGroup(f, 0, d), T = sculptor(), y = groundY(...dBW(f, 0, d)) + 0.6;
    for (const x of [-4.6, 0, 4.6]) for (const z of [-3.6, 3.6]) T.box(0.2, 1.2, 0.2, x, y - 0.6, z, '#5a4a38');
    T.box(10, 0.2, 8, 0, y, 0, '#9a7a52'); for (let x = -4.8; x < 5; x += 0.5) T.box(0.04, 0.02, 8, x, y + 0.11, 0, '#7a5a3a');
    g.add(hotelMesh(T)); wallBox(g, 0, 0, 10, 8); dKeep(...dBW(f, 0, d), 7);
    for (const [a, z] of [[-3, -2], [0, 1.5], [3, -2]]) { const [x, zz] = dBW(f, a, d + z), it = K.B.begin();      // белые диваны и бирюзовые зонты
      K.B.box(x, y + 0.45, zz, 1.8, 0.4, 0.8, 0, '#f6f6f2'); K.B.box(x, y + 0.8, zz - 0.35, 1.8, 0.5, 0.15, 0, '#f6f6f2'); K.B.box(x, y + 1.3, zz + 1.2, 0.06, 2.4, 0.06, 0, '#e8e4da');
      for (let q = 0; q < 8; q++) { const a0 = q / 8 * 6.283, a1 = (q + 1) / 8 * 6.283; K.B.quad([x, y + 2.7, zz + 1.2], [x + Math.cos(a0) * 1.3, y + 2.25, zz + 1.2 + Math.sin(a0) * 1.3], [x + Math.cos(a1) * 1.3, y + 2.25, zz + 1.2 + Math.sin(a1) * 1.3], [x, y + 2.7, zz + 1.2], '#2ab8b0'); }
      it.boxes.push([x, y + 2.4, zz + 1.2, 1.8, 0.06, 1.8, 0, 0x2ab8b0]); K.B.end({ kind: 'small', mat: 'wood', x, z: zz, r: 1.0, loss: 0.02 }); }
  }
  { const f = dFrame(Bc, N >> 1); for (let k = 0; k < 3; k++) { const [x, z] = dBW(f, -4 + k * 3.6, 3 + rnd() * 2), m = jetSki(['#e8c82a', '#d42020', '#2b4998'][k]); m.position.set(x, groundY(x, z) + 0.05, z); m.rotation.y = Math.atan2(-f.nx, -f.nz) - Math.PI / 2 + (rnd() - 0.5) * 0.4; scene.add(m); breakableObjects([m], x, z, 1.1, 'small', 0.05, 'metal'); } }
  // золотая ступа на холме северного мыса: самая высокая точка в 150 м от северного края пляжа, не на дороге
  { const fe = dFrame(Bc, N - 1), fs = dFrame(Bc, 0), f = fe.x > fs.x ? fe : fs; let best = null;
    for (let i = 0; i < 260; i++) { const x = f.x + (rnd() - 0.3) * 150, z = f.z + (rnd() - 0.5) * 150, y = groundY(x, z); if (y > 4 && roadDist(x, z) > 10 && !townBlocked(x, z) && (!best || y > best[2])) best = [x, z, y]; }
    if (best) { const [x, z, y] = best, T = sculptor(); T.box(5, 1.0, 5, x, y + 0.2, z, '#e8e0cc'); chedi(T, x, y + 0.7, z, 1.6, 9); const m = templeMesh(T); scene.add(m); dSeen(m, x, z);
      walls.push([x - 2.5, z - 2.5, x + 2.5, z - 2.5], [x + 2.5, z - 2.5, x + 2.5, z + 2.5], [x + 2.5, z + 2.5, x - 2.5, z + 2.5], [x - 2.5, z + 2.5, x - 2.5, z - 2.5]); solids.push([[x - 2.5, z - 2.5], [x + 2.5, z - 2.5], [x + 2.5, z + 2.5], [x - 2.5, z + 2.5]]); dKeep(x, z, 4); } }
  K.B.finish(K.W(K.frame(N >> 1), 0, 10));
  K.place(Bc.name);
}
// Корал Ков: бухта между огромными гранитными валунами 2–8 м (и в воде), бунгало под тёмно-красными крышами на склоне,
// стоянка у кольцевой с вывеской
function beachCoralCove(Bc) {
  const K = beachKit(Bc, 2204), rnd = seededRandom(2212), N = Bc.pts.length, S = sculptor();
  for (const [end, sg] of [[1, 1], [N - 2, -1]]) { const f = dFrame(Bc, end); for (let k = 0; k < 9; k++) dBoulder(S, ...dBW(f, sg * (rnd() * 12 - 4), -8 + rnd() * 20), 1.5 + rnd() * 3.2, rnd); }
  for (let k = 0; k < 5; k++) { const f = dFrame(Bc, 2 + ((rnd() * (N - 4)) | 0)); dBoulder(S, ...dBW(f, (rnd() - 0.5) * 6, -6 - rnd() * 12), 1.0 + rnd() * 2.0, rnd); }
  scene.add(S.mesh());
  const mid = dFrame(Bc, N >> 1);
  for (let k = 0; k < 4; k++) { K.lounger(mid, (k - 1.5) * 2.6, 8, '#f2f2ee', '#c8a878'); if (k % 2 === 0) K.umbrella(mid, (k - 1.5) * 2.6 + 1.3, 10, '#d42020'); }
  let placed = 0;                                                                                     // бунгало на склоне над пляжем
  for (let i = 0; i < 120 && placed < 4; i++) { const a = (rnd() - 0.5) * 70, d = 16 + rnd() * 30, [x, z] = dBW(mid, a, d), y = groundY(x, z);
    if (y < 2 || y > 18 || roadDist(x, z) < 12 || townBlocked(x, z)) continue;
    const g = townGroup(x, z, Math.atan2(-mid.nz, -mid.nx)), T = sculptor();
    T.box(6.4, 3, 6.6, 0, y - 1.2, 0, '#a89878'); T.box(6, 2.8, 5, 0, y + 1.6, -0.5, '#f2ece0'); T.box(1.6, 1.2, 0.08, 1.3, y + 1.8, 2.02, '#3e4858'); for (const sd of [-1, 1]) winX(T, sd * 3, y + 1.8, -0.8, 1.3, 1.1, sd, '#3e4858', '#f2f2ee'); acZ(T, 1.6, y + 0.9, -3, -1);
    T.hip(0, 0.3, 3.9, 4.1, y + 3.0, 1.9, 2.0, y + 4.1, (q) => q % 2 ? '#7a2a24' : '#6a2420'); T.hip(0, 0.3, 1.9, 2.0, y + 4.1, 0.3, 0.05, y + 4.9, (q) => q % 2 ? '#8a3028' : '#7a2a24');
    g.add(hotelMesh(T)); wallBox(g, 0, 0, 6.4, 6.6); dSeen(g, x, z); dKeep(x, z, 6); placed++; }
  { const lot = dLotNear(mid.x + mid.nx * 40, mid.z + mid.nz * 40, 14, 9);                             // стоянка у кольцевой с вывеской
    if (lot) { const T = sculptor(), F = lot.D / 2; T.box(lot.len, 1.6, lot.D, 0, -0.6, 0, '#8f8b80'); T.box(lot.len, 0.08, lot.D, 0, 0.22, 0, '#a29f96');
      lot.g.add(spotSign(T, 2, -(F + 1.5), 0.2, 'CORAL COVE', -1)); scooterRow(lot.g, 211, 6, -lot.len / 2 + 2, -(F - 1.5), 1.2, 0, -Math.PI / 2, 0.26);
      lot.g.add(hotelMesh(T)); townMark(lot, -F, -F, 0); } }
  K.B.finish(K.W(mid, 0, 8));
  K.place(Bc.name);
}
