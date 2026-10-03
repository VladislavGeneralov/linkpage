// Центр Ламая — refs/lamai_center, план — refs/TOWNS_PLAN.md (ресерч-сессия), «делай все» — Влад.
//   Пляжная улица (дорога «Had Lamai»): лавки и бары в 1–2 этажа под черепицей, навесы, вывески (часть по-тайски),
//     скутеры у бордюра — по обе стороны, где есть место.
//   Ринг тайского бокса (ISLAND.malls, kind 'muay', фото 02, 04): ринг 6 × 6 на помосте с красными и синими углами и
//     трёхцветными канатами, навес ≈ 22 × 20 на колоннах, трибуны с трёх сторон, пластиковые стулья у ринга,
//     прожекторы (ночью горят), вывеска MUAY THAI с тайской строкой.
//   Lamai View Point (ISLAND.spots.lamai_vp, фото 09, 10): терраса на склоне над Ламаем, огромные белые буквы LAMAI
//     лицом к террасе (море — за ними), ресторанчик под соломой, канатная дорога вниз по склону с красной кабинкой.
//   Ват Ламай (ISLAND.malls, kind 'wat_lamai', фото 06): двор у кольцевой, у входа огромные золотые статуи — Гуаньинь на
//     лотосе, стоящий Будда с поднятой рукой, воин Гуань Юй с алебардой — и белая статуя поменьше; за ними зал под
//     красной двухъярусной тайской крышей на жёлтых колоннах, две золотые ступы, флаги, вывеска WAT LAMAI с тайской строкой.
// Постройки, ринг, трибуны, буквы — твёрдые; стулья и скутеры — разрушаемые. Файл подключается после towns.js;
// buildLamai() зовёт buildTowns().

const LAMAI_STYLE = { floors: [1, 2], roof: 'tile', balcony: 0.25, kerb: '#2a2a2c', thai: 0.35, scooters: 0.4,
  walls: ['#e8dcc0', '#f2e6c8', '#d8c8a8', '#c4dcd0', '#f0d8b8', '#e8c8b8', '#d6d8d0', '#f2efe6'],
  signs: ['BAR', 'BEACH BAR', 'MASSAGE', 'SEAFOOD', 'THAI FOOD', 'COFFEE', 'TATTOO', 'MINI MART', 'EXCHANGE', 'BIKE RENT', 'PAD THAI',
    'FRUIT SHAKE', 'TOURS', 'REGGAE BAR', 'GUESTHOUSE', 'SPA', 'ICE CREAM', 'PHARMACY', 'MUAY THAI'] };

function buildLamai() {
  const rnd = seededRandom(4685);
  for (const M of IS.malls || []) if (M.kind === 'muay') buildMuayThai(M);           // сначала ринг и храм: ряды лавок обходят их площадки
  for (const M of IS.malls || []) if (M.kind === 'wat_lamai') buildWatLamai(M);
  const r = roads.findIndex((q) => q.name === 'Had Lamai'), R = roads[r];
  if (R) {
    TOWN.claims.push({ r, s0: 0, s1: R.len });
    for (const side of [1, -1]) townStreet(R, r, 24, R.len - 24, side, 10.4, 11, [18, 14, 22, 10], 0.6, { drop: 2.4, rise: 2.4, bend: 1.3, minH: 0.6 }, (lot, q) => shophouseRow(lot, q, LAMAI_STYLE), rnd);
  }
  if (IS.spots && IS.spots.lamai_vp) buildLamaiViewPoint();
}

// ---------- ринг тайского бокса ----------
function buildMuayThai(s) {
  const W = 28, D = 26, PARK = 4, U1 = D / 2 + PARK, Y = LOT_Y, rnd = seededRandom(4656);
  const g = new THREE.Group();
  g.position.set(s.x, s.y + LOT_RISE, s.z); g.rotation.y = -s.az;
  scene.add(g); g.updateMatrixWorld(true);
  const A = sculptor(), S = sculptor(), Gl = sculptor();
  A.quad([-D / 2 - 1, Y, -W / 2 - 1], [U1, Y, -W / 2 - 1], [U1, Y, W / 2 + 1], [-D / 2 - 1, Y, W / 2 + 1], '#938f85');
  A.skirt(-D / 2 - 1, U1, -W / 2 - 1, W / 2 + 1, Y, '#827f76');
  g.add(A.mesh()); lotApron(g, U1, -W / 2 - 1, W / 2 + 1, Y, '#938f85');
  // навес: колонны, фермы, двускатная красно-оранжевая кровля
  const HU = 10, HV = 11, EAVE = 6, RISE = 2.2, ROOF = '#d0582a', STEEL = '#8e9296';
  for (const u of [-HU, 0, HU]) for (const v of [-HV, HV]) { S.box(0.3, EAVE, 0.3, u, Y + EAVE / 2, -v, STEEL); wallBox(g, u, v, 0.4, 0.4); }
  for (const u of [-HU, 0, HU]) { S.box(0.18, 0.2, 2 * HV + 1, u, Y + EAVE, 0, STEEL); for (const sg of [-1, 1]) S.rod([u, Y + EAVE, -sg * (HV + 0.8)], [u, Y + EAVE + RISE, 0], 0.16, STEEL); }
  S.gable(0, 0, 2 * HU + 2, HV + 0.9, Y + EAVE - 0.1, Y + EAVE + RISE + 0.05, ROOF, ROOF, 'x');
  // ринг: помост, ковёр, угловые подушки, канаты
  const RH = 1.2, RS = 3.2;
  S.box(2 * RS + 0.6, RH, 2 * RS + 0.6, 0, Y + RH / 2, 0, '#2a2a2c'); S.box(2 * RS + 0.2, 0.06, 2 * RS + 0.2, 0, Y + RH + 0.03, 0, '#2a5ad8');
  S.box(2 * RS, 0.02, 2 * RS, 0, Y + RH + 0.07, 0, '#3a6ae8');
  for (const [a, b, c] of [[-1, -1, '#d42020'], [1, 1, '#2a4ad8'], [-1, 1, '#f2f2ee'], [1, -1, '#f2f2ee']]) { S.box(0.2, 1.4, 0.2, a * RS, Y + RH + 0.7, b * RS, '#c8ccd0'); S.box(0.3, 1.2, 0.3, a * (RS - 0.15), Y + RH + 0.7, b * (RS - 0.15), c); }
  [['#d42020', 0.5], ['#f2f2ee', 0.9], ['#2a4ad8', 1.3]].forEach(([c, h]) => { for (const sg of [-1, 1]) { S.box(2 * RS, 0.05, 0.05, 0, Y + RH + h, sg * RS, c); S.box(0.05, 0.05, 2 * RS, sg * RS, Y + RH + h, 0, c); } });
  S.box(0.6, 0.3, 1.2, RS + 0.9, Y + 0.15, 0, '#6a6a6e'); S.box(0.6, 0.3, 1.2, RS + 0.9, Y + 0.45, 0, '#6a6a6e');            // ступени
  wallBox(g, 0, 0, 2 * RS + 0.6, 2 * RS + 0.6);
  // трибуны с трёх сторон (сзади и по бокам): три ступени
  // (ступень k: выше и уже — прижата к внешнему краю, подальше от ринга)
  for (const [cu, cv, lu, lv, ou, ov] of [[-HU + 1.6, 0, 3.2, 2 * HV - 2, -1, 0], [0, -HV + 1.6, 2 * HU - 6, 3.2, 0, -1], [0, HV - 1.6, 2 * HU - 6, 3.2, 0, 1]]) {
    for (let k = 0; k < 3; k++) {
      const su = ou ? lu * (3 - k) / 3 : lu, sv = ov ? lv * (3 - k) / 3 : lv, u = cu + ou * (lu - su) / 2, v = cv + ov * (lv - sv) / 2, h = 0.45 * (k + 1);
      S.box(su, h, sv, u, Y + h / 2, -v, ['#8a6a44', '#9a7a52', '#7a5a3a'][k]);
    }
    wallBox(g, cu, cv, lu, lv);
  }
  // прожекторы над рингом; ночью горят
  for (const [u, v] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { S.box(0.5, 0.35, 0.5, u, Y + EAVE - 0.3, -v, '#2a2a2c'); Gl.box(0.42, 0.06, 0.42, u, Y + EAVE - 0.5, -v, '#fff6d8'); }
  // вывеска на передней ферме: тайская строка и MUAY THAI
  { const fh = signFit('MUAY THAI', 9, 0.16).h + 0.4, yc = Y + EAVE + RISE * 0.45, fu = HU + 0.3;
    S.box(0.15, fh, 10, fu, yc, 0, '#141418');
    for (const face of [1, -1]) for (const lit of [false, true]) { const T = sculptor(); signLines(T, 'MUAY THAI', 9, lit ? '#ffd84f' : '#e8c82a', 0.12, 0.16); const m = T.mesh();
      if (lit) { m.material = TOWN.lit || (TOWN.lit = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); m.visible = false; nightGlow.push(m); }
      m.rotation.y = face * Math.PI / 2; m.position.set(fu + (lit ? face * 0.02 : 0), yc, 0); g.add(m); } }
  g.add(hotelMesh(S));
  { const m = Gl.mesh(); m.material = TOWN.lit; m.visible = false; nightGlow.push(m); g.add(m); }
  // пластиковые стулья вокруг ринга (сбиваются)
  const B = propBatch(), c = Math.cos(s.az), sn = Math.sin(s.az), Wp = (u, v) => [s.x + c * u + sn * v, s.z + sn * u - c * v], Y0 = s.y + LOT_RISE + Y;
  for (const [u0, v0, du, dv, n] of [[RS + 2.2, -4, 0, 1.0, 9], [-RS - 2.0, -4, 0, 1.0, 9], [-4, RS + 2.2, 1.0, 0, 9], [-4, -RS - 2.2, 1.0, 0, 9]]) for (let i = 0; i < n; i++) {
    const [x, z] = Wp(u0 + du * i, v0 + dv * i), col = ['#d83a2a', '#2a5ad8', '#f2f2ee'][(i + n) % 3], yaw = -s.az + rnd() * 0.3;
    B.begin(); B.box(x, Y0 + 0.43, z, 0.45, 0.05, 0.45, yaw, col); B.box(x, Y0 + 0.21, z, 0.4, 0.42, 0.4, yaw, col, false); B.box(x, Y0 + 0.7, z, 0.06, 0.5, 0.45, yaw, col);
    B.end({ x, z, kind: 'small', mat: 'metal', r: 0.35, loss: 0.01 });
  }
  B.finish(Wp(0, 0));
  scooterRow(g, 91, 7, U1 - 1.6, -12, 0, 0.85, Math.PI, Y);
  vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 3 && p.x < U1 + 1 && Math.abs(p.z) < W / 2 + 3; }, { c: [s.x, s.z, 30] }));
  pavedAreas.push({ x: s.x, z: s.z, r2: 30 * 30, lift: LOT_Y + LOT_RISE, test: (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 1 && p.x < U1 && Math.abs(p.z) < W / 2 + 1; } });
  g.userData.c = new THREE.Vector3(s.x, 0, s.z); pierGroups.push(g);
  spotPlace('РИНГ ЛАМАЙ', g, U1 + 5, 0, -1, 0);
}

// ---------- Lamai View Point ----------
function buildLamaiViewPoint() {
  const g = spotGroup('lamai_vp'), sp = IS.spots.lamai_vp, L = sp.y, S = sculptor();
  // терраса: плита, ограждение по краю обрыва (u = 12) и по бокам
  S.box(20, 0.9, 30, 2, L - 0.15, 0, '#c9c5bb'); S.skirt(-8, 12, -15, 15, L + 0.3, '#a8a59c', 3);
  for (let v = -14.5; v <= 14.5; v += 1.45) S.box(0.08, 1.0, 0.08, 12, L + 0.8, -v, '#e8eef2');
  S.box(0.1, 0.08, 29.2, 12, L + 1.3, 0, '#b8bcc0'); S.box(0.06, 0.9, 29, 12.03, L + 0.75, 0, '#cfe4ee');
  for (const sg of [-1, 1]) { S.box(20, 0.08, 0.1, 2, L + 1.3, -sg * 15, '#b8bcc0'); for (let u = -8; u <= 12; u += 1.45) S.box(0.08, 1.0, 0.08, u, L + 0.8, -sg * 15, '#e8eef2'); }
  wallBox(g, 12, 0, 0.3, 30); for (const sg of [-1, 1]) wallBox(g, 2, sg * 15, 20, 0.3);
  // ресторанчик на краю террасы (фото 09): дощатый настил, столбы, плоская тёмная крыша, стойка; белые перила с розовыми
  // цветами (бугенвиллея) по краю настила; на крыше — огромные белые буквы LAMAI VIEW POINT лицом к подъезжающим (к −u)
  { const U0 = 3, U1 = 11, V = 11.5, RH = 3.0, WOOD = '#8a6a44', y = L + 0.3;
    S.box(U1 - U0, 0.25, 2 * V, (U0 + U1) / 2, y + 0.12, 0, WOOD); for (let v = -V + 0.5; v < V; v += 1) S.box(U1 - U0, 0.02, 0.05, (U0 + U1) / 2, y + 0.26, -v, '#6f543a');
    for (const u of [U0 + 0.2, U1 - 0.2]) for (let v = -V + 0.2; v <= V; v += (2 * V - 0.4) / 4) S.box(0.22, RH, 0.22, u, y + RH / 2, -v, '#6a4a2e');
    S.box(U1 - U0 + 0.8, 0.3, 2 * V + 0.8, (U0 + U1) / 2, y + RH + 0.15, 0, '#3a3a3c'); S.box(0.15, 0.4, 2 * V + 0.8, U0 - 0.4, y + RH + 0.1, 0, '#6a4a2e');
    S.box(1.0, 1.1, 8, U1 - 2.2, y + 0.8, 0, '#5a3a2a'); S.box(1.2, 0.06, 8.2, U1 - 2.2, y + 1.38, 0, '#c8a878');                    // стойка бара
    for (let v = -9; v <= 9; v += 4.5) if (Math.abs(v) > 3) { S.tube(U0 + 2.2, y + 0.26, y + 1.0, -v, 0.4, 0.4, '#3a2a22', 8); for (const dv of [-0.8, 0.8]) S.tube(U0 + 2.2, y + 0.26, y + 0.7, -(v + dv), 0.22, 0.24, '#2a2a2c', 6); }
    for (const sg of [-1, 1]) {                                                                                               // перила с цветами вдоль настила к подъезду
      for (let u = U0 - 4; u <= U1; u += 1.2) S.box(0.07, 1.0, 0.07, u, y + 0.5, -sg * (V + 0.6), '#f6f6f2');
      S.box(U1 - U0 + 4, 0.08, 0.1, (U0 + U1 - 4) / 2, y + 1.0, -sg * (V + 0.6), '#f6f6f2'); S.box(U1 - U0 + 4, 0.06, 0.08, (U0 + U1 - 4) / 2, y + 0.55, -sg * (V + 0.6), '#f6f6f2');
      for (let u = U0 - 3.6; u <= U1; u += 0.9) S.blob(u, y + 0.35, -sg * (V + 1.1), 0.45, 0.35, 0.45, ['#e8408a', '#f05a9a', '#d82a78', '#4a8a3a'][((u * 3) | 0) & 3], 6, 3);
    }
    wallBox(g, (U0 + U1) / 2, 0, U1 - U0, 2 * V);
    const px = 0.3, glyphs = hudText('LAMAI VIEW POINT'), w = hudWidth(glyphs) * px; let x0 = -w / 2;
    for (const rows of glyphs) { rows.forEach((row, ri) => [...row].forEach((b, i) => { if (b === '1') S.box(0.35, px, px, U0 + 0.4, y + RH + 0.35 + (4 - ri) * px + px / 2, x0 + (i + 0.5) * px, '#f8f8f4'); })); x0 += (rows[0].length + 1) * px; }
    for (let k = 0; k < 6; k++) S.box(0.12, 0.6, 0.12, U0 + 0.7, y + RH + 0.5, -w / 2 + k * w / 5, '#6a6e72');                   // крепления букв
  }
  // соломенная хижина у подъезда (остаётся)
  thatchHut(S, -4, -10, L + 0.3, 5, 4, '#9a8a6a'); wallBox(g, -4, -10, 5, 4);
  // канатная дорога вниз по склону: две опоры, трос, красная кабинка
  { const topU = 10, topV = 12, dn = 70, bu = topU + dn, bv = topV + 6, by = spotGround(g, bu, bv);
    S.box(0.5, 6, 0.5, topU, L + 3.3, -topV, '#7a7e84'); S.box(1.4, 0.3, 0.5, topU, L + 6.2, -topV, '#7a7e84'); wallBox(g, topU, topV, 0.6, 0.6);
    S.box(0.5, 5, 0.5, bu, by + 2.5, -bv, '#7a7e84'); S.box(1.4, 0.3, 0.5, bu, by + 5.0, -bv, '#7a7e84');
    S.rod([topU, L + 6.1, -topV], [bu, by + 4.9, -bv], 0.05, '#1c1c1e');
    const t = 0.42, cu = topU + (bu - topU) * t, cv = topV + (bv - topV) * t, cy = L + 6.1 + (by + 4.9 - L - 6.1) * t - 0.3;
    S.box(0.06, 0.9, 0.06, cu, cy - 0.45, -cv, '#3a3a3c'); S.box(1.6, 1.4, 1.2, cu, cy - 1.6, -cv, '#d42020'); S.box(1.4, 0.6, 1.25, cu, cy - 1.4, -cv, '#cfe4ee'); }
  g.add(spotSign(S, -6, 13, L + 0.3, 'LAMAI VIEW POINT', 1));
  g.add(hotelMesh(S));
  scooterRow(g, 97, 5, -6, 8, 0, -0.85, Math.PI / 2, L + 0.3);
  vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -10 && p.x < 13 && Math.abs(p.z) < 16; }, { c: [sp.x, sp.z, 30] }));
  g.userData.c = new THREE.Vector3(sp.x, 0, sp.z); pierGroups.push(g);
  spotPlace('СМОТРОВАЯ ЛАМАЙ', g, -4, 4, 1, 0);
}

// ---------- Ват Ламай ----------
// статуи стоят лицом к +X (к дороге); h — высота без постамента
function statueGuanyin(S, x, y, z, h) {                                   // Гуаньинь в золотом покрывале на розовом лотосе
  const k = h / 6;
  S.lathe([[1.0 * k, y], [1.15 * k, y + 0.3 * k], [0.75 * k, y + 0.62 * k]], x, z, (i) => i % 2 ? '#e88ab0' : '#f4b0cc', 12);
  S.lathe([[0.78 * k, y + 0.6 * k], [0.66 * k, y + 2.4 * k], [0.48 * k, y + 4.2 * k], [0.4 * k, y + 4.75 * k]], x, z, T_GOLD, 12);
  S.blob(x, y + 4.8 * k, z, 0.48 * k, 0.3 * k, 0.55 * k, T_GOLD, 8, 4);
  S.lathe([[0.36 * k, y + 4.95 * k], [0.38 * k, y + 5.45 * k], [0.2 * k, y + 5.9 * k], [0.02, y + 6.05 * k]], x, z, T_GOLD_L, 9);   // покрывало
  S.blob(x + 0.2 * k, y + 5.35 * k, z, 0.2 * k, 0.28 * k, 0.22 * k, '#f2e8d8', 7, 4);                                                   // белое лицо
  S.limb([x + 0.1 * k, y + 4.6 * k, z + 0.45 * k], [x + 0.55 * k, y + 3.9 * k, z + 0.25 * k], 0.14 * k, 0.11 * k, T_GOLD, 6);       // руки
  S.limb([x + 0.1 * k, y + 4.6 * k, z - 0.45 * k], [x + 0.5 * k, y + 4.3 * k, z - 0.3 * k], 0.14 * k, 0.11 * k, T_GOLD, 6);
  S.blob(x + 0.6 * k, y + 4.35 * k, z - 0.3 * k, 0.12 * k, 0.2 * k, 0.1 * k, T_GOLD_L, 5, 3);                                         // ладонь
}
function statueBuddhaUp(S, x, y, z, h) {                                  // стоящий золотой Будда, правая рука поднята, палец вверх
  const k = h / 6.5;
  for (const sg of [-1, 1]) S.blob(x + 0.15 * k, y + 0.12 * k, z + sg * 0.22 * k, 0.28 * k, 0.12 * k, 0.16 * k, T_GOLD_D, 6, 3);
  S.lathe([[0.42 * k, y + 0.2 * k], [0.46 * k, y + 1.6 * k], [0.4 * k, y + 3.4 * k], [0.5 * k, y + 4.6 * k], [0.32 * k, y + 5.0 * k]], x, z, T_GOLD, 10);
  S.blob(x + 0.04 * k, y + 5.4 * k, z, 0.3 * k, 0.36 * k, 0.3 * k, T_GOLD, 8, 5); S.blob(x, y + 5.85 * k, z, 0.17 * k, 0.16 * k, 0.17 * k, T_GOLD_D, 6, 3);   // голова, ушниша
  S.limb([x, y + 4.75 * k, z - 0.48 * k], [x + 0.2 * k, y + 5.6 * k, z - 0.62 * k], 0.12 * k, 0.1 * k, T_GOLD, 6);                // правая рука вверх
  S.limb([x + 0.2 * k, y + 5.6 * k, z - 0.62 * k], [x + 0.22 * k, y + 6.4 * k, z - 0.6 * k], 0.1 * k, 0.05 * k, T_GOLD, 5);
  S.limb([x, y + 4.75 * k, z + 0.48 * k], [x + 0.1 * k, y + 3.3 * k, z + 0.5 * k], 0.12 * k, 0.1 * k, T_GOLD, 6);
}
function statueGuanYu(S, x, y, z, h) {                                    // воин Гуань Юй: тёмные доспехи с золотом, борода, алебарда
  const k = h / 5.5, AR = '#3e3a32', GD = T_GOLD;
  for (const sg of [-1, 1]) S.limb([x, y, z + sg * 0.32 * k], [x, y + 2.0 * k, z + sg * 0.26 * k], 0.24 * k, 0.28 * k, AR, 6);
  S.lathe([[0.62 * k, y + 1.4 * k], [0.55 * k, y + 2.1 * k], [0.5 * k, y + 3.6 * k], [0.62 * k, y + 4.0 * k], [0.3 * k, y + 4.25 * k]], x, z, (i, j) => j === 1 ? GD : AR, 10);
  S.blob(x, y + 4.0 * k, z, 0.4 * k, 0.18 * k, 0.75 * k, GD, 7, 3);                                                                    // наплечники
  S.blob(x + 0.04 * k, y + 4.6 * k, z, 0.27 * k, 0.32 * k, 0.26 * k, '#4a3428', 7, 4);                                                // лицо
  S.blob(x + 0.22 * k, y + 4.2 * k, z, 0.1 * k, 0.4 * k, 0.16 * k, '#141414', 5, 3);                                                   // борода
  S.lathe([[0.32 * k, y + 4.8 * k], [0.3 * k, y + 5.15 * k], [0.12 * k, y + 5.4 * k], [0.02, y + 5.5 * k]], x, z, GD, 8);               // шлем
  S.limb([x, y + 3.8 * k, z - 0.7 * k], [x + 0.5 * k, y + 3.0 * k, z - 0.85 * k], 0.15 * k, 0.12 * k, AR, 6);
  S.tube(x + 0.55 * k, y, y + 6.2 * k, z - 0.9 * k, 0.06 * k, 0.05 * k, '#6a4a2e', 5);                                                 // древко
  S.box(0.08 * k, 1.0 * k, 0.5 * k, x + 0.55 * k, y + 6.0 * k, z - 1.05 * k, '#c8ccd0');                                              // лезвие
}
function buildWatLamai(s) {
  const W = 40, D = 34, PARK = 6, U1 = D / 2 + PARK, Y = LOT_Y;
  const g = new THREE.Group();
  g.position.set(s.x, s.y + LOT_RISE, s.z); g.rotation.y = -s.az;
  scene.add(g); g.updateMatrixWorld(true);
  const A = sculptor(), S = sculptor(), Gd = sculptor();
  A.quad([-D / 2 - 1, Y, -W / 2 - 1], [U1, Y, -W / 2 - 1], [U1, Y, W / 2 + 1], [-D / 2 - 1, Y, W / 2 + 1], '#c9c2b0');
  A.skirt(-D / 2 - 1, U1, -W / 2 - 1, W / 2 + 1, Y, '#a8a090');
  for (let u = -D / 2; u < D / 2; u += 2) for (let v = -W / 2; v < W / 2; v += 2) if (((u + v) / 2) % 2 === 0) A.quad([u, Y + 0.01, v], [u + 2, Y + 0.01, v], [u + 2, Y + 0.01, v + 2], [u, Y + 0.01, v + 2], '#d6cfbc');
  g.add(A.mesh()); lotApron(g, U1, -W / 2 - 1, W / 2 + 1, Y, '#c9c2b0');
  // зал: белые стены, жёлтые колонны по фасаду и бокам, красная двухъярусная крыша, позолота фронтона
  const HU = -9, HL = 16, HW = 10, WH = 5.2;
  S.box(HL, 0.8, HW + 1.6, HU, Y + 0.4, 0, '#d8d0bc'); S.box(HL - 2, WH, HW - 1.4, HU - 1, Y + 0.8 + WH / 2, 0, '#f2e8c8');
  for (let u = HU - HL / 2 + 0.6; u <= HU + HL / 2; u += (HL - 1.2) / 5) for (const sg of [-1, 1]) S.box(0.45, WH, 0.45, u, Y + 0.8 + WH / 2, sg * (HW / 2 + 0.2), '#e8b830');
  for (const sg of [-1, 1]) S.box(0.45, WH, 0.45, HU + HL / 2 - 0.3, Y + 0.8 + WH / 2, sg * 1.6, '#e8b830');
  for (const v of [-2.6, 0, 2.6]) S.box(0.08, 2.6, 1.4, HU + HL / 2 - 2.05, Y + 2.1, v, '#7a2a1a');                                     // двери
  thaiRoof(Gd, HU, 0, { len: HL + 1.6, hw: HW / 2 + 0.9, y0: Y + 0.8 + WH, y1: Y + 0.8 + WH + 6.2, tiers: 2, step: 3.2, drop: 1.2, skirt: 1.2, tile: ['#b8443a', '#9a3830'], front: T_GOLD });
  wallBox(g, HU, 0, HL, HW + 1.6);
  // две золотые ступы перед залом по сторонам
  for (const sg of [-1, 1]) { S.box(3.6, 0.6, 3.6, -1, Y + 0.3, sg * 12, '#d8d0bc'); chedi(Gd, -1, Y + 0.6, sg * 12, 1.5, 8.5); wallBox(g, -1, sg * 12, 3.6, 3.6); }
  // статуи у входа на постаментах, перед ними — ряды цветных ведёрок-подношений
  const row = [[-8, statueGuanyin, 6.2], [0, statueBuddhaUp, 6.8], [8, statueGuanYu, 5.6]];
  for (const [v, make, h] of row) { S.box(3.0, 1.2, 3.0, 7, Y + 0.6, -v, '#d8d0bc'); make(Gd, 7, Y + 1.2, -v, h); wallBox(g, 7, v, 3.0, 3.0);
    for (let i = 0; i < 6; i++) S.box(0.32, 0.36, 0.32, 9.2, Y + 0.18, -(v - 1.25 + i * 0.5), ['#e8c82a', '#2a8ad8', '#e8482a', '#3aa85a', '#f2f2ee', '#e88ab0'][(i + 6 + v) % 6]); }
  { const v = -4, y = Y; S.box(1.2, 0.8, 1.2, 9, y + 0.4, -v, '#d8d0bc'); S.lathe([[0.35, y + 0.8], [0.3, y + 2.0], [0.16, y + 2.6], [0.02, y + 2.75]], 9, -v, '#f2f0ea', 8); S.blob(9.12, y + 2.55, -v, 0.13, 0.16, 0.13, '#f2f0ea', 6, 3); }
  // флаги: тайский и жёлтый буддийский
  for (const [v, cols] of [[15, ['#c8302a', '#f2f2ee', '#2a3a8a', '#f2f2ee', '#c8302a']], [17, ['#f2c81e', '#f2c81e', '#f2c81e', '#f2c81e', '#f2c81e']]]) {
    S.tube(14, Y, Y + 8, -v, 0.06, 0.05, '#c8ccd0', 5); cols.forEach((c, i) => S.box(0.04, 0.16, 1.4, 14, Y + 7.6 - i * 0.16, -(v + 0.75), c)); }
  g.add(hotelMesh(S)); g.add(templeMesh(Gd));
  // вывеска у дороги: тайская строка и WAT LAMAI
  { const Sg = sculptor(); g.add(spotSign(Sg, U1 - 3, -15, Y, 'WAT LAMAI', 1)); g.add(hotelMesh(Sg)); }
  templePlants(g, [[-14, 17, 'clump'], [2, 18, 'clump'], [-16, -17, 'clump'], [12, -18, 'coconut'], [-4, -18, 'areca']]);
  scooterRow(g, 107, 4, U1 - 1.8, 6, 0, 0.85, Math.PI, Y);
  vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 3 && p.x < U1 + 1 && Math.abs(p.z) < W / 2 + 2; }, { c: [s.x, s.z, 36] }));
  pavedAreas.push({ x: s.x, z: s.z, r2: 36 * 36, lift: LOT_Y + LOT_RISE, test: (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 1 && p.x < U1 && Math.abs(p.z) < W / 2 + 1; } });
  g.userData.c = new THREE.Vector3(s.x, 0, s.z); pierGroups.push(g);
  spotPlace('ВАТ ЛАМАЙ', g, U1 + 5, 0, -1, 0);
}
