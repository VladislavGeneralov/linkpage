// Ночные рынки — refs/night_market (типовой объект). На Самуи рынки бывают в Бопхуте, Ламае, Маенаме, Чавенге и Натоне;
// места у дорог подбирает сборщик острова (ISLAND.markets). Рынок — площадка с рядами складных шатров 3 × 3 м
// (под каждым прилавок с противнями и меню-вывеской), пластиковыми столами и стульями посередине, тележками с едой,
// гирляндами ламп на шестах, растяжкой над входом и фургоном-закусочной. Днём рынок стоит без огней, ночью горят лампы,
// вывески и гирлянды. Всё, кроме фургона, — разрушаемое: шатры, прилавки, столы, тележки, шесты (одна общая геометрия
// на рынок — propBatch из roadside.js). Фургон твёрдый.
// Оси рынка: u — от площадки к дороге, v — влево вдоль дороги, y — от уровня площадки.
// Файл подключается после firestation.js и только объявляет функции; игра зовёт buildNightMarkets().

const MARKET = { W: 44, D: 22, PARK: 3 };               // вдоль дороги, вглубь, полоса перед входом — как в сборщике
const TENT_COLORS = ['#2a5ad8', '#2a9a4a', '#d83a2a', '#f2f2ee', '#e8c82a', '#7a3ad8', '#2aa8b8', '#e8782a'];
const CLOTH_COLORS = ['#c8302a', '#2a7a4a', '#2a4a9a', '#e8dcc0'];
const FOOD_COLORS = ['#e8a23a', '#c8642a', '#f2e8c0', '#7ab84a', '#d84a3a', '#f6d048'];

// Телега, полная кокосов: дощатый кузов на двух больших колёсах, оглобли, гора зелёных кокосов, пара вскрытых с соломинкой,
// дощечка с ценой. Строится вдоль X (оглобли — к +X), y — уровень площадки. Сбивается; кокосы раскатываются.
function coconutCart(S, y, seed) {
  const WOOD = '#8a6a44', WOOD_D = '#6a4e30', rnd = seededRandom(seed), CC = ['#6a9a3a', '#7aa844', '#5a8a34', '#86b24c', '#8a8a42'];
  for (const s of [-1, 1]) { vehWheel(S, -0.1, y + 0.46, s * 0.62, 0.46, 0.08, s, '#a88458'); S.box(0.9, 0.06, 0.06, 1.45, y + 0.86, s * 0.42, WOOD_D); }   // колёса, оглобли
  S.box(1.2, 0.06, 0.06, -0.1, y + 0.46, 0, WOOD_D);                                              // ось
  S.box(1.9, 0.08, 1.05, 0, y + 0.74, 0, WOOD);                                                   // дно
  for (const s of [-1, 1]) S.box(1.9, 0.3, 0.05, 0, y + 0.92, s * 0.52, WOOD); S.box(0.05, 0.3, 1.05, -0.95, y + 0.92, 0, WOOD); S.box(0.05, 0.3, 1.05, 0.95, y + 0.92, 0, WOOD);
  for (const x of [-0.6, 0.6]) for (const s of [-1, 1]) S.box(0.06, 0.34, 0.07, x, y + 0.92, s * 0.55, WOOD_D);
  S.box(0.07, 0.72, 0.07, 1.6, y + 0.4, 0, WOOD_D); S.box(0.07, 0.07, 0.9, 1.88, y + 0.86, 0, WOOD_D);   // упор и поперечина оглобель
  for (let l = 0; l < 4; l++) for (let i = 0; i < 6 - l; i++) for (let j = 0; j < 3 - (l > 1 ? 1 : 0) - (l > 2 ? 1 : 0); j++) {     // гора кокосов
    const r = 0.15 + rnd() * 0.03, x = -0.75 + l * 0.14 + i * 0.3 + (rnd() - 0.5) * 0.06, z = -0.3 + (l > 1 ? 0.15 : 0) + (l > 2 ? 0.15 : 0) + j * 0.3 + (rnd() - 0.5) * 0.06;
    S.blob(x, y + 0.95 + l * 0.23, z, r, r * 1.12, r, CC[(rnd() * CC.length) | 0], 6, 4);
  }
  for (const [x, z] of [[0.7, -0.62], [0.35, -0.64]]) { S.blob(x, y + 1.2, z, 0.14, 0.15, 0.14, '#7aa844', 6, 4); S.tube(x, y + 1.3, y + 1.36, z, 0.09, 0.09, '#f4f0e0', 6); S.box(0.02, 0.22, 0.02, x + 0.03, y + 1.45, z, '#e8482a', 0.3); }   // вскрытые, с соломинкой
  S.box(0.7, 0.34, 0.04, -0.3, y + 0.5, 0.6, '#f6f0d8');                                           // дощечка с ценой
  S.text('COCO 40', -0.3, y + 0.58, 0.63, 0.032, '#2a7a3a', 1);
}
function buildNightMarket(s, k) {
  const { W, D, PARK } = MARKET, c = Math.cos(s.az), sn = Math.sin(s.az), yaw = -s.az, rnd = seededRandom(900 + k * 17);
  const Wp = (u, v) => [s.x + c * u + sn * v, s.z + sn * u - c * v];
  const Y0 = s.y + LOT_RISE + LOT_Y;                                                              // уровень бетона площадки
  RS.glowMat = RS.glowMat || new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false });
  const B = propBatch(), cartsToAdd = [];
  // коробка в осях рынка: размеры su (вдоль u), sy, sv (вдоль v); turn — поворот в плане (0 — как рынок)
  const box = (u, y, v, su, sy, sv, color, piece = true, glow = false, turn = 0) => { const p = Wp(u, v); B.box(p[0], Y0 + y, p[1], su, sy, sv, yaw + turn, color, piece, glow); };
  const P3 = (u, y, v) => { const p = Wp(u, v); return [p[0], Y0 + y, p[1]]; };
  const item = (u, v, info) => { const p = Wp(u, v); return Object.assign({ x: p[0], z: p[1] }, info); };

  // шатёр 3 × 3 с прилавком; (du, dv) — куда смотрит прилавок
  const tent = (u, v, du, dv) => {
    const col = TENT_COLORS[(rnd() * TENT_COLORS.length) | 0], it = B.begin(), h = 2.25;
    for (const a of [-1.45, 1.45]) for (const b of [-1.45, 1.45]) box(u + a, h / 2, v + b, 0.05, h, 0.05, '#c8ccd0');
    for (const [a, b, su, sv] of [[1.5, 0, 0.04, 3.1], [-1.5, 0, 0.04, 3.1], [0, 1.5, 3.1, 0.04], [0, -1.5, 3.1, 0.04]]) box(u + a, h - 0.1, v + b, su, 0.3, sv, col);
    const A = P3(u, h + 0.85, v), Q = [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]].map(([a, b]) => P3(u + a, h + 0.05, v + b));
    for (let i = 0; i < 4; i++) B.quad(Q[i], Q[(i + 1) % 4], A, A, col);                            // крыша-пирамида
    { const p = Wp(u, v); it.boxes.push([p[0], Y0 + h + 0.3, p[1], 3, 0.05, 3, yaw, new THREE.Color(col).getHex()]); }   // и её обломки
    // меню-вывеска под козырьком и лампа: днём — щит, ночью светятся
    const mu = u + du * 1.48, mv = v + dv * 1.48, sign = ['#f6e27a', '#f8f4e0', '#f6c84a'][(rnd() * 3) | 0];
    box(mu, 1.92, mv, du ? 0.05 : 2.2, 0.42, du ? 2.2 : 0.05, sign);
    box(mu + du * 0.03, 1.92, mv + dv * 0.03, du ? 0.02 : 2.1, 0.36, du ? 2.1 : 0.02, sign, false, true);
    for (let i = 0; i < 4; i++) box(mu + du * 0.04 + (du ? 0 : -0.75 + i * 0.5), 1.92, mv + dv * 0.04 + (du ? -0.75 + i * 0.5 : 0), du ? 0.02 : 0.3, 0.14, du ? 0.3 : 0.02, ['#c8302a', '#2a7a4a', '#2a4a9a', '#c8302a'][i], false);
    box(u, h - 0.25, v, 0.16, 0.16, 0.16, '#fff8d8', false, true);
    B.end(item(u, v, { kind: 'tent', mat: 'metal', r: 1.45, loss: 0.05 }));
    // прилавок: стол под скатертью, противни с едой, стеклянная витрина
    B.begin();
    const cu = u + du * 0.95, cv = v + dv * 0.95, cloth = CLOTH_COLORS[(rnd() * CLOTH_COLORS.length) | 0], L = du ? [0.75, 2.3] : [2.3, 0.75];
    box(cu, 0.43, cv, L[0], 0.86, L[1], cloth); box(cu, 0.88, cv, L[0] + 0.06, 0.04, L[1] + 0.06, '#f2f2ee');
    for (let i = 0; i < 3; i++) { const o = -0.75 + i * 0.6; box(cu + (du ? 0 : o), 0.95, cv + (du ? o : 0), 0.5, 0.1, 0.5, FOOD_COLORS[(rnd() * FOOD_COLORS.length) | 0]); }
    box(cu + (du ? 0 : 0.85), 1.15, cv + (du ? 0.85 : 0), 0.45, 0.5, 0.45, '#b8dce8');
    B.end(item(cu, cv, { kind: 'small', mat: 'wood', r: 1.0, loss: 0.03 }));
  };
  // стол и четыре пластиковых стула
  const table = (u, v) => {
    const col = ['#d83a2a', '#2a5ad8', '#f2f2ee', '#2a5ad8'][(rnd() * 4) | 0], t = rnd() * 0.6;
    B.begin();
    box(u, 0.72, v, 0.85, 0.04, 0.85, '#e8e8e4', true, false, t); box(u, 0.36, v, 0.08, 0.7, 0.08, '#8e9296', true, false, t);
    for (let i = 0; i < 4; i++) {
      const a = t + i * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), x = u + ca * 0.75, z = v + sa * 0.75;
      box(x, 0.43, z, 0.42, 0.05, 0.42, col, true, false, a); box(x + ca * 0.2, 0.66, z + sa * 0.2, 0.05, 0.42, 0.42, col, true, false, a);
      box(x, 0.21, z, 0.34, 0.42, 0.05, col, false, false, a); box(x, 0.21, z, 0.05, 0.42, 0.34, col, false, false, a);
    }
    B.end(item(u, v, { kind: 'small', mat: 'metal', r: 0.95, loss: 0.02 }));
  };
  // тележка с едой: короб из нержавейки на двух колёсах, рама с навесом и световой вывеской
  const cart = (u, v, along) => {
    const col = ['#d83a2a', '#2a5ad8', '#2a9a4a'][(rnd() * 3) | 0], L = along ? [0.85, 1.8] : [1.8, 0.85];
    B.begin();
    box(u, 0.82, v, L[0], 0.7, L[1], '#c8ccd0'); box(u, 1.2, v, L[0] + 0.1, 0.05, L[1] + 0.1, '#e4e8ec');
    for (const e of [-1, 1]) { box(u + (along ? e * 0.46 : 0), 0.33, v + (along ? 0 : e * 0.46), along ? 0.07 : 0.62, 0.62, along ? 0.62 : 0.07, '#1c1c1e'); }
    for (const a of [-1, 1]) for (const b of [-1, 1]) box(u + a * L[0] / 2, 1.75, v + b * L[1] / 2, 0.04, 1.1, 0.04, col);
    box(u, 2.32, v, L[0] + 0.3, 0.06, L[1] + 0.3, col);
    box(u, 2.05, v, along ? 0.06 : 1.7, 0.42, along ? 1.7 : 0.06, '#f8f4e0'); box(u + (along ? 0.04 : 0), 2.05, v + (along ? 0 : 0.04), along ? 0.02 : 1.6, 0.36, along ? 1.6 : 0.02, '#f8f4e0', false, true);
    for (let i = 0; i < 3; i++) box(u + (along ? 0 : -0.5 + i * 0.5), 1.33, v + (along ? -0.5 + i * 0.5 : 0), 0.34, 0.22, 0.34, FOOD_COLORS[(rnd() * FOOD_COLORS.length) | 0]);
    box(u, 1.55, v, 0.12, 0.12, 0.12, '#fff8d8', false, true);
    B.end(item(u, v, { kind: 'small', mat: 'metal', r: 1.0, loss: 0.03 }));
  };
  // шест с гирляндой до следующего шеста
  const pole = (u, v, u2, v2) => {
    B.begin();
    box(u, 2.2, v, 0.08, 4.4, 0.08, '#8e9296');
    if (u2 !== undefined) {
      const a = Wp(u, v), b = Wp(u2, v2), len = Math.hypot(b[0] - a[0], b[1] - a[1]), wy = Math.atan2(-(b[1] - a[1]), b[0] - a[0]), n = Math.round(len / 1.4);
      B.box((a[0] + b[0]) / 2, Y0 + 4.0, (a[1] + b[1]) / 2, len, 0.025, 0.025, wy, '#1c1c1e', false);
      for (let i = 1; i < n; i++) { const t = i / n, sag = Math.sin(t * Math.PI) * 0.35; B.box(a[0] + (b[0] - a[0]) * t, Y0 + 3.92 - sag, a[1] + (b[1] - a[1]) * t, 0.13, 0.13, 0.13, 0, ['#fff2c0', '#fff2c0', '#ffd0a0'][i % 3], false, true);
        B.box(a[0] + (b[0] - a[0]) * t, Y0 + 3.92 - sag, a[1] + (b[1] - a[1]) * t, 0.07, 0.1, 0.07, 0, '#e8e4d8', false); }
    }
    B.end(item(u, v, { kind: 'pole', mat: 'metal', r: 0.18, loss: 0.04 }));
  };

  // ---------- расстановка ----------
  for (let v = -19.8; v <= 19.81; v += 3.3) tent(-8.6, v, 1, 0);                                   // задний ряд, лицом к дороге
  for (const u of [-5.3, -2.0, 1.3, 4.6]) tent(u, -19.8, 0, 1);                                    // боковые ряды, лицом внутрь
  for (const u of [-5.3, -2.0, 1.3]) tent(u, 19.8, 0, -1);
  for (const v of [-13.2, -9.9, -6.6, 6.6, 9.9, 13.2]) tent(8.2, v, -1, 0);                        // у дороги, по обе стороны от входа
  for (const u of [-3.2, 0.4, 4.0]) for (const v of [-13.5, -9, -4.5, 4.5, 9, 13.5]) table(u + (rnd() - 0.5) * 0.8, v + (rnd() - 0.5) * 0.8);
  cart(5.4, -2.6, true); cart(5.4, 2.6, true); cart(-4.6, -16.2, false); cart(-1.0, 0.2, false);
  // (у правого бокового ряда за шатрами стоит грузовичок торговца — столы туда не ставятся)
  // телеги, полные кокосов: по сторонам от входа и одна в глубине
  for (const [cu, cv, rot] of [[9.6, 3.6, 0.5], [9.4, -3.5, -2.4], [-5.4, -12.2 + (k % 2) * 3, 1.3]])
    cartsToAdd.push([cu, cv, rot]);
  const PV = [-17, -8.5, 0, 8.5, 17];
  for (const u of [-6.4, 6.4]) PV.forEach((v, i) => pole(u, v, i < PV.length - 1 ? u : undefined, PV[i + 1]));
  for (const v of [-17, 0, 17]) pole(-6.2, v + 0.4, 6.2, v + 0.4);
  const cc = Wp(0, 0);
  B.finish(cc);

  // ---------- неразрушаемое: покрытие площадки, фургон-закусочная; растяжка над входом — ломается вместе со столбами ----------
  const g = new THREE.Group();
  g.position.set(s.x, s.y + LOT_RISE, s.z); g.rotation.y = -s.az;
  scene.add(g); g.updateMatrixWorld(true);
  const A = sculptor(), U1 = D / 2 + PARK;
  A.quad([-D / 2 - 1, LOT_Y, -W / 2 - 1], [U1, LOT_Y, -W / 2 - 1], [U1, LOT_Y, W / 2 + 1], [-D / 2 - 1, LOT_Y, W / 2 + 1], '#938f85');
  A.skirt(-D / 2 - 1, U1, -W / 2 - 1, W / 2 + 1, LOT_Y, '#827f76');                               // борт: площадка поднята над землёй на LOT_RISE
  for (let i = 0; i < 14; i++) { const u = -9 + rnd() * 18, z = -20 + rnd() * 40, r = 0.6 + rnd() * 1.4; A.quad([u - r, LOT_Y + 0.006, z - r * 0.7], [u + r, LOT_Y + 0.006, z - r * 0.5], [u + r * 0.8, LOT_Y + 0.006, z + r * 0.7], [u - r * 0.9, LOT_Y + 0.006, z + r * 0.6], i % 2 ? '#8a867c' : '#9c988c'); }   // пятна на асфальте
  // фургон-закусочная (vehicles.js): справа от входа, раздаточным окном к столам
  const van = foodVanGeo(), VU = 7.7, VV = 18.4;
  const mesh = A.mesh(); g.add(mesh);
  lotApron(g, U1, -W / 2 - 1, W / 2 + 1, LOT_Y, '#938f85');
  parkVehicle(g, van, VU, VV, 'v-', LOT_Y);
  cartsToAdd.forEach(([cu, cv, rot], i) => {
    const m = templeProp(g, cu, cv, (C) => coconutCart(C, LOT_Y, 40 + k * 7 + i), { kind: 'small', mat: 'wood', color: '#8a6a44', r: 1.0, loss: 0.04,
      extra: (out, c) => { for (let n = 0; n < 14; n++) out.push({ shape: 2, x: c.x + (Math.random() - 0.5) * 1.4, y: c.y + Math.random() * 0.6, z: c.z + (Math.random() - 0.5) * 1.0, sx: 0.3, sy: 0.3, sz: 0.3, q: null, c: new THREE.Color(n % 3 ? '#6a9a3a' : '#86b24c') }); } });
    m.rotation.y = rot;
  });
  { const [hx, hy, hz, hw, hh] = van.hatch, glow = new THREE.Mesh(new THREE.PlaneGeometry(hw, hh).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff0c8, side: THREE.DoubleSide }));   // ночью в окне горит свет
    glow.position.set(VU - hz - 0.02, hy + LOT_Y, -VV + hx); glow.visible = false; g.add(glow); nightGlow.push(glow); }
  scooterRow(g, k + 3, 5 + k % 3, D / 2 + 1.7, 6.6, 0, 0.85, Math.PI, LOT_Y);                      // ряд скутеров у входа
  scooterRow(g, k + 11, 2 + k % 2, D / 2 + 1.7, -8.2, 0, -0.85, Math.PI, LOT_Y);
  parkVehicle(g, pickupGeo(['boxes', 'coconuts', 'empty'][k % 3], ['#e8e8e4', '#3a8a5a', '#2f5f9a'][k % 3]), -4.2, 16.6, 'v+', LOT_Y);   // грузовичок торговца за рядами
  // растяжка над входом: два столба и полотнище с надписью
  { const S = sculptor(), bu = D / 2 + 0.6;
    const faces = [sculptor(), sculptor()]; let th = 0; for (const T of faces) th = signLines(T, 'NIGHT MARKET', 9.2, '#fff8e0', 0.05, 0.12);   // над английской — тайская строка
    const bh = th + 0.4, yc = 3.72 + bh / 2;
    for (const z of [-5.2, 5.2]) S.tube(bu, 0, yc + bh / 2 + 0.12, z, 0.09, 0.07, '#8e9296', 6);
    S.box(0.06, bh, 10.4, bu, yc, 0, '#c8302a'); S.box(0.07, 0.08, 10.4, bu, yc + bh / 2, 0, '#f6d048'); S.box(0.07, 0.08, 10.4, bu, yc - bh / 2, 0, '#f6d048');
    const m = S.mesh(), parts = [m];
    faces.forEach((T, i) => { const t = T.mesh(); t.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }); t.rotation.y = (i ? -1 : 1) * Math.PI / 2; t.position.set(bu, yc, 0); parts.push(t); });
    for (const p of parts) g.add(p);
    const pair = [];
    for (const z of [-5.2, 5.2]) { const w = g.localToWorld(new THREE.Vector3(bu, 0, z)); posts.push([w.x, w.z]);
      pair.push(addBreakable({ kind: 'pole', mat: 'metal', x: w.x, z: w.z, r: 0.2, loss: 0.05,
        hide() { for (const p of parts) p.visible = false; dropBreakables(pair); },
        pieces(out) { meshPieces(out, m, 'metal'); } })); } }
  vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 4 && p.x < U1 + 1 && Math.abs(p.z) < W / 2 + 5; }, { c: [s.x, s.z, 32] }));
  pavedAreas.push({ x: s.x, z: s.z, r2: 34 * 34, lift: LOT_Y + LOT_RISE,
    test: (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 1 && p.x < U1 && Math.abs(p.z) < W / 2 + 1; } });
  g.userData.c = new THREE.Vector3(s.x, 0, s.z); pierGroups.push(g);
  spotPlace('НОЧНОЙ РЫНОК ' + s.name.toUpperCase(), g, U1 + 5, 0, -1, 0);
}
function buildNightMarkets() {
  if (!IS.markets || !IS.markets.length) return;
  IS.markets.forEach(buildNightMarket);
}
