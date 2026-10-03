// Пять мест Самуи — по фото и обмерам из refs/hin_ta_hin_yai, lad_koh_viewpoint, khao_pom_summit,
// maenam_walking_street + maenam_chinese_temple, wat_na_phra_lan.
// Место, рельеф (скальные купола, поднятый мыс, площадки) и подъездные дороги задаёт сборщик острова (ISLAND.spots);
// здесь — постройки. Оси места: u — куда оно смотрит (локальный +X), v — влево от u (локальный −Z), y — вверх.
// Файл подключается после towns.js (берёт sculptor, spotGroup, spotPlate, spotPlace, boulder, spotSign из landmarks.js;
// drape, templeProp, templeGate, thaiRoof, chedi, smallBuddha из temples.js; townLot, townStreet, shophouseRow, townGroup
// из towns.js) и только объявляет функции; игра зовёт buildSights().

const ROCK_PAL = ['#cacabd', '#c2c1b4', '#d2c2b0', '#c6beb2', '#bcb6ac'], ROCK_DARK = ['#a8a096', '#9a9288', '#8a7a6a'];
// гранитная «кожа» на насыпанном сборщиком куполе: грани лежат по земле; по ней ездят колёса. Низ у воды — тёмный, мокрый.
function rockSkin(g, cu, cv, ru, rv, seed, o = {}) {
  const S = sculptor(), wet = o.wet === undefined ? 0.22 : o.wet;
  drape(S, g, cu - ru, cu + ru, cv - rv, cv + rv, (i, j, u, v) => {
    const h = hash2(i * 3 + seed, j * 7 + 1), y = spotGround(g, u, v);
    if (y < wet) return ['#6a625a', '#7a7168', '#5c544e'][(h * 3) | 0];
    if (o.green && h > 0.72 && y > o.green) return ['#4e6d15', '#5d7a24', '#3f5a14'][(h * 97 | 0) % 3];   // трава и кусты на макушке
    return h > 0.94 ? ROCK_DARK[(h * 31 | 0) % 3] : ROCK_PAL[(h * 53 | 0) % ROCK_PAL.length];
  }, 0.07, o.cell || 2.1, (u, v) => ((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2 < 1.3 && spotGround(g, u, v) > -0.5);
  const m = S.mesh(); g.add(m); return m;
}
// соломенная хижина на столбах (Rock Bar, лавки): крыша из выгоревшего пальмового листа
function thatchHut(S, u, v, y, w = 4, d = 3, roof = '#8a8078') {
  for (const a of [-1, 1]) for (const b of [-1, 1]) S.box(0.16, 2.5, 0.16, u + a * (w / 2 - 0.2), y + 1.25, -(v + b * (d / 2 - 0.2)), '#6a5a48');
  S.box(w, 0.14, d, u, y + 0.3, -v, '#7a6850'); S.gable(u, -v, w + 1.2, d / 2 + 0.8, y + 2.4, y + 4.0, roof, '#968e8b', 'x');
  S.box(w * 0.7, 0.9, 0.5, u, y + 0.85, -(v + d / 2 - 0.4), '#6b4a2a');                             // стойка бара
}

// =====================================================================================================
// ХИН ТА И ХИН ЯЙ — гранитный мыс на южном конце Ламая: низкий голый купол, высокий купол с деревьями и перилами,
// груда валунов со столбом Хин Та («Дедушка») на макушке, балансирующий валун на плите, расщелина Хин Яй («Бабушка»)
// на покатой плите у воды, скальные островки в море. В глубине суши — конец дороги, ряд сувенирных лавок, хижина бара.
// =====================================================================================================
function buildHinTa() {
  const g = spotGroup('hin_ta'), sp = g.userData.spot, L = sp.y, S = sculptor(), G = (u, v) => spotGround(g, u, v), rnd = seededRandom(452);
  // скала поверх куполов, насыпанных сборщиком
  rockSkin(g, 6, -4, 17, 15, 3); rockSkin(g, 2, 30, 26, 22, 7, { green: 7.2 }); rockSkin(g, 14, -26, 13, 11, 11);
  rockSkin(g, 30, 2, 10, 16, 5); rockSkin(g, 52, -22, 9, 11, 9); rockSkin(g, 60, 26, 8, 6, 13);
  // Хин Та: наклонённый столб с косой бороздой под «шапкой», на макушке груды
  { const u = 14, v = -26, y = G(u, v) - 0.3, C = '#7c6853', D = '#6f5d49';
    S.lathe([[1.2, y], [1.25, y + 1.3], [1.1, y + 2.6], [1.0, y + 3.25], [0.9, y + 3.32], [1.02, y + 3.45], [0.92, y + 4.1], [0.55, y + 4.6], [0.06, y + 4.8]], u, -v, (i, k) => k === 4 ? '#3a3531' : (i + k) % 3 ? C : D, 9, 1, 0.9, 0.1);
    S.blob(u + 1.9, y + 0.7, -(v - 0.6), 0.8, 0.75, 0.8, '#8a7a66', 7, 5);                          // валун-«шар» у основания
    wallBox(g, u + 0.25, v, 2.4, 2.2); }
  // груда под столбом: караваи 2–5 м и один большой покатый, с бурыми потёками
  for (let i = 0; i < 15; i++) { const a = i / 15 * 6.283 + rnd(), d = 4.2 + rnd() * 5.5, r = 1.2 + rnd() * 1.5; boulder(S, g, 14 + Math.cos(a) * d, -26 + Math.sin(a) * d * 0.85, 0, r, rnd() < 0.3 ? '#968e85' : ROCK_PAL[(rnd() * 5) | 0], 0.6 + rnd() * 0.25); }
  { const y = G(9, -19); S.blob(9, y + 1.2, 19, 5.6, 2.3, 2.4, '#bbbbae', 9, 5); S.blob(9.5, y + 2.0, 19.4, 2.2, 1.2, 0.6, '#65564a', 6, 3); wallBox(g, 9, -19, 9.5, 4); }   // большой покатый
  // плоская глыба-стол и балансирующий на ней валун
  { const y = G(24, -15); S.box(8, 1.5, 4, 24, y + 0.6, 15, '#b4aca4', 0.05, 0.3); S.blob(24.6, y + 2.6, 15.2, 1.45, 1.3, 1.4, '#cacabd', 8, 5); wallBox(g, 24, -15, 7.6, 3.8, 0.3); }
  // Хин Яй: два выпуклых валика на покатой плите, между ними тёмная расщелина в рыжих потёках, уходит к воде
  { const u = 30, v = 2; for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const uu = u - 3 + k * 2.1, y = G(uu, v); S.blob(uu, y + 0.18, -(v + s * 0.62), 1.35, 0.62 - k * 0.05, 0.6, k % 2 ? '#c8b7a4' : '#d7c1ac', 7, 4); }
    for (let k = 0; k < 6; k++) { const uu = u - 3.6 + k * 1.4, y = G(uu, v); S.box(1.45, 0.5, 0.26, uu, y + 0.36, -v, k % 2 ? '#3a2a22' : '#784d24'); } }
  // высокий купол: перила смотровой на макушке, плиты-«пальцы» у подножия со стороны моря
  fenceOnGround(g, -4, 26, 8, 26, { step: 2, post: [0.08, 1.1, '#8e9296'], bars: [[1.05, 0.06, '#8e9296'], [0.55, 0.05, '#8e9296']], kind: 'rail', loss: 0.04 }, 4);
  fenceOnGround(g, 8, 26, 8, 36, { step: 2, post: [0.08, 1.1, '#8e9296'], bars: [[1.05, 0.06, '#8e9296'], [0.55, 0.05, '#8e9296']], kind: 'rail', loss: 0.04 }, 4);
  for (let i = 0; i < 7; i++) { const v = 16 + i * 4.2, u = 25 + Math.sin(i * 1.7) * 2.5, y = G(u, v), h = 4 + (i % 3) * 0.9; S.box(1.3, h, 2.6, u, y + h / 2 - 0.5, -v, i % 2 ? '#a8a29f' : '#bbbbae', 0.1 - (i % 3) * 0.09, 0.3 * (i % 2 ? 1 : -1)); wallBox(g, u, v, 1.6, 2.8); }
  // россыпь по берегу и камни в воде
  for (let i = 0; i < 26; i++) { const u = -8 + rnd() * 62, v = -40 + rnd() * 84, y = G(u, v); if (y > 2.4 || y < -0.5 || (u < -2 && y > 0.9)) continue; boulder(S, g, u, v, 0, 0.8 + rnd() * 1.5, y < 0.3 ? '#4a4440' : ROCK_PAL[(rnd() * 5) | 0], 0.6 + rnd() * 0.3); }
  // конец дороги: ряд сувенирных лавок под маркизами, стоянка, хижина бара у скал
  { const u0 = -52, v0 = -12.2, z = -v0, F = z + 2.5;
    S.box(25, 0.5, 5.4, u0, L - 0.05, z, '#b9b4a8'); S.box(24, 3.2, 5, u0, L + 1.8, z, '#e2dcce'); S.box(24.6, 0.25, 5.6, u0, L + 3.5, z, '#c8c2b4');
    for (let i = 0; i < 6; i++) { const x = u0 - 10 + i * 4;
      S.box(3.4, 2.5, 0.12, x, L + 1.45, F + 0.02, '#2a2622');                                      // открытый проём лавки
      for (let k = 0; k < 6; k++) S.box(0.42, 0.7 + ((i + k) % 3) * 0.25, 0.1, x - 1.3 + k * 0.52, L + 2.0 - ((i + k) % 3) * 0.12, F + 0.14, ['#e8482a', '#f2c81e', '#2a8ad8', '#f2f2ee', '#e86aa8', '#3aa85a'][(i * 2 + k) % 6]);   // купальники, шляпы, сумки
      for (let k = 0; k < 4; k++) S.quad([x - 1.9 + k * 0.95, L + 2.9, F + 0.1], [x - 0.95 + k * 0.95, L + 2.9, F + 0.1], [x - 0.95 + k * 0.95, L + 2.3, F + 2.0], [x - 1.9 + k * 0.95, L + 2.3, F + 2.0], (i + k) % 2 ? '#f2f2ee' : ['#2f5fa8', '#c8302a', '#2e917d'][i % 3]);
      for (const dx of [-1.9, 1.9]) S.box(0.06, 2.3, 0.06, x + dx, L + 1.15, F + 2.0, '#8e9296');
    }
    wallBox(g, u0, v0, 24, 5);
    if (G(-22, -4) > 0.8) { thatchHut(S, -22, -4, G(-22, -4) - 0.1, 4.5, 3.4); wallBox(g, -22, -4, 4.3, 3.2);
      for (const [du, dv] of [[3.2, -1], [3.4, 1.2]]) templeProp(g, -22 + du, -4 + dv, (B) => { const y = G(-22 + du, -4 + dv); B.tube(0, y, y + 0.7, 0, 0.05, 0.05, '#3a3a3c', 5); B.tube(0, y + 0.7, y + 0.78, 0, 0.45, 0.45, '#7a5a3a', 8); }, { kind: 'small', mat: 'wood', color: '#7a5a3a', r: 0.4, loss: 0.02 }); }
    g.add(spotSign(S, -34, -15.5, L, 'HIN TA HIN YAI')); }
  g.add(S.mesh());
  parkVehicle(g, parkedCar(4), -56, -36.6, 'u+', G(-56, -36.6) + 0.04); parkVehicle(g, pickupGeo('songthaew', '#b8302a'), -46, -36.8, 'u-', G(-46, -36.8) + 0.04);
  scooterRow(g, 9, 4, -62, -17.2, 0.9, 0, 0, G(-62, -17.2) + 0.03);
  templePlants(g, [[-30, -8, 'coconut'], [-36, 4, 'coconut'], [-26, 10, 'coconut'], [-14, 18, 'fan'], [-68, -8, 'coconut'], [-70, -40, 'coconut'], [-30, -42, 'bush'], [0, 30, 'bush'], [4, 34, 'areca'], [-2, 26, 'bush'], [-18, -22, 'coconut']]);
  templeKeepOut(g, -72, 70, -46, 56);
  spotPlace('ХИН ТА И ХИН ЯЙ', g, -52, -26, 1, 0);
}

// =====================================================================================================
// СМОТРОВАЯ ЛАД КО — на кольцевой между Чавенг-Ной и Ламаем. Вдоль дороги — мощёный променад с белыми пилонами
// и перилами; от него мостик и пандус спускаются на нижнюю бетонную площадку на столбах, там белая беседка под
// двухъярусной шатровой крышей; внизу — гранитные плиты у воды. Рядом с дорогой — стоянка из газонной решётки.
// Мыс поднят сборщиком вместе с дорогой. По пандусу на площадку можно съехать.
// =====================================================================================================
function buildLadKoh() {
  const sp = IS.spots.lad_koh, R = roads[0], q = roadProj(0, sp.x, sp.z);
  if (!q) return;
  const s0 = q.s, p0 = roadPoint(R, s0, 0), pr = roadPoint(R, s0, 40), pl = roadPoint(R, s0, -40), side = groundY(pr[0], pr[1]) < groundY(pl[0], pl[1]) ? 1 : -1;   // с какой стороны море
  const WHITE = '#f4f4f0', TILE = ['#c4c3bd', '#b9b8b2'], W = sculptor(), wg = new THREE.Group(); scene.add(wg);
  const yAt = (s) => { const c = roadPoint(R, s, 0); return asphaltTop(c[0], c[1]) + 0.1; }, A0 = halfS + 0.5, A1 = halfS + 3.6;
  // променад: плитка вдоль дороги, бордюр-подпорная стенка со стороны асфальта, скамьи
  for (let s = s0 - 20; s < s0 + 20; s += 2) {
    const c = roadPoint(R, s + 1, side * (A0 + A1) / 2), ry = Math.atan2(-c[3], c[2]), y = yAt(s + 1);
    W.box(2.06, 0.5, A1 - A0, c[0], y - 0.2, c[1], TILE[Math.round(s / 2) & 1], 0, ry);
    const k = roadPoint(R, s + 1, side * A0); W.box(2.06, 0.34, 0.3, k[0], y + 0.02, k[1], '#e2d9ca', 0, ry);
    if (Math.round((s - s0) / 2) % 4 === 1) { const b = roadPoint(R, s + 1, side * (A0 + 0.75)); W.box(1.3, 0.12, 0.42, b[0], y + 0.5, b[1], WHITE, 0, ry); for (const e of [-0.5, 0.5]) { const f = roadPoint(R, s + 1 + e, side * (A0 + 0.75)); W.box(0.16, 0.45, 0.4, f[0], y + 0.27, f[1], WHITE, 0, ry); } }
  }
  { const m = hotelMesh(W); wg.add(m); wg.userData.c = new THREE.Vector3(p0[0], 0, p0[1]); townSeen(wg); }
  // пилоны (белая усечённая пирамида с поясом и шапкой) через 5 м и перила между ними; в середине — проход на мостик.
  // Ограда тянется и дальше променада, метров на 200 в обе стороны — пока дорога идёт над морем (просил Влад): там она
  // стоит по кромке обочины, а у стоянки обходит её с моря. Где до воды далеко, стоит постройка или примыкает дорога — её нет.
  const FAR = 200, offAt = (s) => Math.abs(s - s0) <= 20.01 ? A1 + 0.1 : s > s0 + 24 && s < s0 + 44 ? halfS + 7.4 : halfS + 0.9;
  const fits = (s) => {
    if (Math.abs(s - s0) <= 20.01) return true;
    const c = roadPoint(R, s, side * offAt(s)), sea = roadPoint(R, s, side * 48), o = roadAt(c[0], c[1], Infinity, 0);
    return groundY(sea[0], sea[1]) < 0.5 && groundY(c[0], c[1]) > 1.2 && !inSolid(c[0], c[1]) && !(o && o.d < halfS + 3) && !vegKeepOut.some((k) => { const q = k.c; return (!q || (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2 < q[2] * q[2]) && k(c[0], c[1]); });
  };
  let prev = null;
  for (let s = s0 - FAR; s <= s0 + FAR + 0.01; s += 5) {
    if (!fits(s) || Math.abs(s - s0) < 1) { prev = null; if (Math.abs(s - s0) < 1) prev = null; continue; }
    const c = roadPoint(R, s, side * offAt(s)), y = Math.abs(s - s0) <= 20.01 ? yAt(s) : groundY(c[0], c[1]) - 0.05;
    templeProp(wg, c[0], -c[1], (B) => { B.tube(0, y, y + 2.0, 0, 0.66, 0.5, WHITE, 4); B.box(1.0, 0.16, 1.0, 0, y + 2.08, 0, WHITE, 0, 0.785); B.tube(0, y + 2.16, y + 2.5, 0, 0.6, 0.32, WHITE, 4); B.tube(0, y + 2.5, y + 2.85, 0, 0.3, 0.02, WHITE, 4); },
      { kind: 'parapet', mat: 'stone', color: WHITE, r: 0.6, loss: 0.08 });
    if (prev && s - prev.s < 5.1) { const k = 0.6 / Math.hypot(c[0] - prev.c[0], c[1] - prev.c[1]), ax = prev.c[0] + (c[0] - prev.c[0]) * k, az2 = prev.c[1] + (c[1] - prev.c[1]) * k, bx2 = c[0] - (c[0] - prev.c[0]) * k, bz2 = c[1] - (c[1] - prev.c[1]) * k;
      armFence(buildFence(wg, [[ax, -az2, bx2, -bz2]], { step: 1.3, y0: Math.min(y, prev.y), post: [0.05, 1.05, '#9aa0a4'], bars: [[1.08, 0.09, '#523628'], [0.6, 0.04, '#9aa0a4'], [0.2, 0.04, '#9aa0a4']], kind: 'rail', loss: 0.04 })); }
    prev = { s, c, y };
  }
  for (const ds of [-14, 14]) { const c = roadPoint(R, s0 + ds, side * (A0 + 0.3)), y = yAt(s0 + ds);                   // чёрные фонари «под старину»
    templeProp(wg, c[0], -c[1], (B) => { B.tube(0, y, y + 0.5, 0, 0.16, 0.1, '#1c1c1e', 6); B.tube(0, y + 0.5, y + 3.7, 0, 0.06, 0.05, '#1c1c1e', 6); B.box(0.42, 0.5, 0.42, 0, y + 3.95, 0, '#fff2c0'); B.tube(0, y + 4.2, y + 4.5, 0, 0.3, 0.02, '#1c1c1e', 4); }, { color: '#1c1c1e', r: 0.15 }); }
  // мостик, пандус и нижняя площадка — в осях: u — от оси дороги к морю
  const sv = roadPoint(R, s0, side), az = Math.atan2(sv[1] - p0[1], sv[0] - p0[0]), g = townGroup(p0[0], p0[1], az), S = sculptor(), Y = yAt(s0), PL = Y - 2.7, U0 = 34, U1 = 46, HV = 6.5;
  const G = (u, v) => spotGround(g, u, v);
  S.box(20.4 - A1, 0.4, 4, (A1 + 20.4) / 2, Y - 0.2, 0, '#e2d9ca'); S.box(Math.hypot(U0 - 20, Y - PL) + 0.3, 0.3, 4, (20 + U0) / 2, (Y + PL) / 2 - 0.15, 0, '#d8cfc0', -Math.atan2(Y - PL, U0 - 20));
  S.box(U1 - U0, 0.45, 2 * HV, (U0 + U1) / 2, PL - 0.22, 0, '#e2d9ca');
  for (const u of [U0 + 0.6, (U0 + U1) / 2, U1 - 0.6]) for (const v of [-HV + 0.6, 0, HV - 0.6]) { const b = Math.min(G(u, v), PL - 0.6) - 0.5; S.box(0.5, PL - 0.4 - b, 0.5, u, (PL - 0.4 + b) / 2, -v, '#cfc6b6'); }
  for (const u of [22, 27, 31]) for (const v of [-1.6, 1.6]) { const t = Y - (Y - PL) * (u - 20) / (U0 - 20) - 0.3, b = Math.min(G(u, v), t - 0.3) - 0.4; S.box(0.4, t - b, 0.4, u, (t + b) / 2, -v, '#cfc6b6'); }
  spotPlate(g, A1 - 0.3, 20.2, 0, 2, Y); spotPlate(g, 20, U0, 0, 2, Y, PL, true); spotPlate(g, U0, U1, 0, HV, PL);
  // беседка: четыре сужающихся белых колонны, балочный пояс, двухъярусная шатровая крыша из серого гонта, П-образная скамья
  { const cu = (U0 + U1) / 2 + 1, F = PL + 0.35;
    S.box(7.2, 0.35, 6.4, cu, PL + 0.17, 0, '#ece4d6'); S.box(7.8, 0.17, 7.0, cu, PL + 0.08, 0, '#e2d9ca');
    for (const a of [-1, 1]) for (const b of [-1, 1]) { S.tube(cu + a * 2.7, F, F + 3.2, b * 2.3, 0.5, 0.34, WHITE, 4); wallBox(g, cu + a * 2.7, -b * 2.3, 0.8, 0.8); }
    S.box(6.4, 0.4, 5.6, cu, F + 3.4, 0, WHITE);
    S.hip(cu, 0, 4.4, 3.9, F + 3.45, 2.3, 2.0, F + 4.7, (i) => i % 2 ? '#9f8d80' : '#ad9b8d'); S.hip(cu, 0, 2.3, 2.0, F + 4.7, 0.12, 0.12, F + 6.9, (i) => i % 2 ? '#b8a898' : '#cebfb3');
    S.tube(cu, F + 6.9, F + 7.5, 0, 0.12, 0.02, '#9f8d80', 5);
    S.box(0.5, 0.45, 3.4, cu + 2.3, F + 0.22, 0, WHITE); for (const b of [-1, 1]) S.box(3.6, 0.45, 0.5, cu + 0.6, F + 0.22, b * 1.8, WHITE); }
  for (const [u, v] of [[U0, -HV], [U0, HV], [U1, -HV], [U1, HV]]) { S.tube(u, PL, PL + 2.0, -v, 0.6, 0.46, WHITE, 4); S.tube(u, PL + 2.0, PL + 2.6, -v, 0.56, 0.04, WHITE, 4); wallBox(g, u, v, 0.9, 0.9); }
  armFence(buildFence(g, [[U0, -HV, U1, -HV], [U1, -HV, U1, HV], [U1, HV, U0, HV], [U0, HV, U0, 2.3], [U0, -2.3, U0, -HV]], { step: 1.4, y0: PL, post: [0.05, 1.05, '#9aa0a4'], bars: [[1.08, 0.09, '#523628'], [0.6, 0.04, '#9aa0a4'], [0.2, 0.04, '#9aa0a4']], kind: 'rail', loss: 0.04 }));
  // гранитные плиты и валуны под площадкой и у воды
  const rnd = seededRandom(4988);
  for (let i = 0; i < 22; i++) { const u = 30 + rnd() * 34, v = -30 + rnd() * 60, y = G(u, v); if (y < -0.5 || y > 6.2) continue; boulder(S, g, u, v, 0, 1.2 + rnd() * 2.2, y < 0.4 ? '#72655d' : ['#a29282', '#b4a696', '#8f8172'][(rnd() * 3) | 0], 0.45 + rnd() * 0.25); }
  g.add(hotelMesh(S));
  // стоянка: тёмная газонная решётка с бетонными полосами, севернее променада
  { const c = roadPoint(R, s0 + 34, side * (halfS + 3.6)), k = roadPoint(R, s0 + 34, side * (halfS + 4.6)), pk = townGroup(c[0], c[1], Math.atan2(k[1] - c[1], k[0] - c[0])), P = sculptor(), y = yAt(s0 + 34) - 0.02;
    P.box(6.4, 0.3, 17, 0, y - 0.1, 0, '#373732'); for (let i = 0; i < 6; i++) P.box(6.4, 0.31, 0.25, 0, y - 0.1, -8.5 + i * 3.4, '#b9b4a8');
    pk.add(hotelMesh(P));
    parkVehicle(pk, parkedCar(2), 0.2, 3.4, 'u-', y + 0.06); scooterRow(pk, 3, 3, 0.4, -5.6, 0, 0.9, Math.PI, y + 0.06); }
  vegKeepOut.push(Object.assign((x, z) => { const w = g.worldToLocal(new THREE.Vector3(x, 0, z)); return w.x > halfS - 1 && w.x < 66 && Math.abs(w.z) < 34; }, { c: [p0[0], p0[1], 75] }));
  for (const [u, v, k] of [[A1 + 2.5, -24, 'fan'], [A1 + 3, 26, 'coconut'], [A1 + 6, -30, 'bush'], [22, -12, 'bush'], [24, 13, 'bush']]) { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); VEG_EXTRA.push([w.x, w.z, k]); }
  const tp = roadPoint(R, s0 - side * 45, side * halfR / 2);
  LANDMARKS.push({ name: 'СМОТРОВАЯ ЛАД КО', x: tp[0], z: tp[1], heading: Math.atan2(-tp[2] * side, -tp[3] * side) });
}

// =====================================================================================================
// ВЕРШИНА КАО ПОМ — высшая точка острова: закрытая радиолокационная станция. Белый шар-радом на гранёном основании,
// две решётчатые красно-белые вышки связи, аппаратная, дизельная с цистерной (взрывается), будка у ворот, ограда.
// Открытых фото с самой вершины нет (только шар и мачта издалека) — постройки станции придуманы по типовым.
// Наверх ведёт извилистая грунтовка от подъезда к водопаду На Муанг 2.
// =====================================================================================================
function buildKhaoPom() {
  const g = spotGroup('khao_pom'), sp = g.userData.spot, L = sp.y, S = sculptor(), G = (u, v) => spotGround(g, u, v);
  { const Pv = sculptor(); drape(Pv, g, -29, 35, -27, 27, (i, j) => (i * 7 + j * 3) % 5 ? '#a7a39a' : '#9c988e', 0.06, 3.2); g.add(Pv.mesh()); }
  padBlend(g, 35, 1, -4, 4, '#a7a39a');
  // радом: шар из панелей на восьмигранном двухэтажном основании с обходной площадкой
  { const cu = -8, cv = 6, R = 7.2, cy = L + 6.6 + R * 0.86, P = [];
    S.tube(cu, L, L + 6.6, -cv, 6.0, 5.6, '#d8d6cc', 8); S.tube(cu, L + 6.0, L + 6.6, -cv, 6.9, 6.9, '#c2c0b6', 8);
    for (let k = 0; k <= 9; k++) { const a = (-58 + k * 148 / 9) * Math.PI / 180; P.push([Math.max(0.05, R * Math.cos(a)), cy + R * Math.sin(a)]); }
    S.lathe(P, cu, -cv, (i, k) => (i + k) % 2 ? '#f2f1ea' : '#e4e3da', 14);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; S.box(0.08, 1.0, 0.08, cu + Math.cos(a) * 6.8, L + 7.1, -cv + Math.sin(a) * 6.8, '#8e9296'); }
    S.box(0.1, 2.1, 1.1, cu + 5.7, L + 1.05, -cv, '#4a5a66'); for (const y of [2.2, 4.6]) for (const a of [1.2, 2.6, 4.0, 5.3]) S.box(0.9, 0.9, 0.1, cu + Math.cos(a) * 5.7, L + y, -cv + Math.sin(a) * 5.7, '#3c5560', 0, -a + 1.571);
    wallBox(g, cu, cv, 11.4, 11.4); }
  // аппаратная и дизельная
  S.box(14, 3.8, 7, 14, L + 1.9, 18, '#dcd8cc'); S.box(14.4, 0.3, 7.4, 14, L + 3.95, 18, '#b8b4a8'); S.box(9, 0.9, 0.1, 13, L + 2.5, 14.45, '#3e4858'); S.box(1.1, 2.1, 0.1, 19.5, L + 1.05, 14.45, '#4a4a48');
  for (const x of [10, 16]) S.box(1.4, 0.9, 1.0, x, L + 4.5, 19, '#9a9a96');
  wallBox(g, 14, -18, 14, 7);
  S.box(6, 3, 4.4, -18, L + 1.5, -19, '#b9b4a8'); S.gable(-18, -19, 6.6, 2.6, L + 3, L + 4.0, '#7e868c', '#b9b4a8', 'x'); S.box(0.1, 2.0, 1.4, -14.96, L + 1.0, -19, '#6a7278'); wallBox(g, -18, 19, 6, 4.4);
  S.tube(-20, L + 4.0, L + 5.6, -18, 0.16, 0.16, '#2a2a2c', 6);                                      // выхлопная труба дизеля
  // будка у ворот, шлагбаум, щит
  S.box(2.6, 2.5, 2.6, 30, L + 1.25, -8.5, '#e8e4d8'); S.hip(30, -8.5, 1.9, 1.9, L + 2.5, 0.2, 0.2, L + 3.3, (i) => i % 2 ? '#7a3b35' : '#8a4a40'); S.box(0.1, 0.9, 1.4, 31.31, L + 1.6, -8.5, '#3c5560'); wallBox(g, 30, 8.5, 2.6, 2.6);
  { const T = sculptor(); T.box(0.1, 1.3, 3.2, 0, 2.2, 0, '#f2f2ee'); T.box(0.12, 0.3, 3.2, 0, 2.7, 0, '#c8201c'); for (const d of [-1.3, 1.3]) T.box(0.1, 2.9, 0.1, 0, 1.45, d, '#8e9296');
    const m = T.mesh(); m.position.set(33.5, L, 9.5); g.add(m); const A = sculptor(); A.text('RESTRICTED', 0, 0.42, 0.08, 0.07, '#1c1c1e', 1); A.text('AREA', 0, -0.05, 0.08, 0.07, '#c8201c', 1); const t = A.mesh(); t.rotation.y = Math.PI / 2; t.position.set(33.5, L + 2.05, 9.5); g.add(t);
    const w = g.localToWorld(new THREE.Vector3(33.5, 0, 9.5)); breakableObjects([m, t], w.x, w.z, 0.5, 'pole', 0.05, 'metal'); posts.push([w.x, w.z]); }
  templeProp(g, 33.4, 0, (B) => { B.box(0.3, 1.1, 0.3, 0, L + 0.55, -3.4, '#f2f2ee'); for (let k = 0; k < 7; k++) B.box(0.12, 0.12, 0.95, 0, L + 1.0, -2.9 + k * 0.95, k % 2 ? '#f2f2ee' : '#c8201c'); }, { kind: 'barrier', mat: 'wood', color: '#c8201c', r: 3.2, loss: 0.05 });
  g.add(S.mesh());
  // цистерна с дизелем — взрывается, как цистерны у колонки на аэродроме
  { const T = sculptor(), z = -12; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, b = (i + 1) / 10 * 6.283, P = (x, t) => [x, L + 1.75 + Math.sin(t) * 1.1, z + Math.cos(t) * 1.1];
      T.quad(P(-21, a), P(-21, b), P(-15, b), P(-15, a), i % 2 ? '#c8ccd0' : '#b8bcc0'); T.tri([-21, L + 1.75, z], P(-21, a), P(-21, b), '#a8acb0'); T.tri([-15, L + 1.75, z], P(-15, a), P(-15, b), '#a8acb0'); }
    for (const x of [-19.6, -16.4]) T.box(0.5, 0.7, 2.0, x, L + 0.35, z, '#8a8680'); T.box(1.0, 0.05, 0.6, -18, L + 2.2, z + 1.12, '#e8632a');
    const m = T.mesh(); g.add(m); boomBox(g, -18, 12, 6, 2.3, [m], 5); }
  // вышки связи: высокая красно-белая и пониже
  for (const [u, v, H] of [[-20, -3, 44], [8, -19, 32]]) { const t = buildTelecomTower(H); t.position.set(u, L, -v); g.add(t); t.updateMatrixWorld(true);
    wallBox(t, 0, 0, 7.4, 7.4); wallBox(t, 6.2, 1.5, 2.4, 1.6); wallBox(t, -6, -0.5, 1.2, 1.2); postAt(t, 6.2, -1.6, 'small'); armFence(t.userData.fence); }
  // ограда станции: сетка на столбах с тремя нитями колючки, проём ворот со стороны дороги
  const FN = { step: 3, post: [0.1, 2.4, '#9a9a96'], bars: [[0.6, 0.04, '#b8b8b4'], [1.3, 0.04, '#b8b8b4'], [2.0, 0.04, '#b8b8b4'], [2.3, 0.03, '#6a6a68']], kind: 'fence', loss: 0.05 };
  for (const [a, b, c, d] of [[34.5, 4.2, 34.5, 26.5], [34.5, 26.5, -28.5, 26.5], [-28.5, 26.5, -28.5, -26.5], [-28.5, -26.5, 34.5, -26.5], [34.5, -26.5, 34.5, -4.2]]) fenceOnGround(g, a, b, c, d, FN, 9);
  for (const [u, v] of [[26, 22], [-22, 22], [-24, -22], [24, -22]]) templeProp(g, u, v, (B) => { B.tube(0, L, L + 8, 0, 0.09, 0.06, '#8a8a84', 6); B.box(0.9, 0.2, 0.4, 0.4, L + 8, 0, '#e8e4c8'); }, { color: '#8a8a84', r: 0.15 });
  templeKeepOut(g, -31, 37, -29, 29);
  spotPlace('ВЕРШИНА КАО ПОМ', g, 46, 0, -1, 0);
  // начало серпантина — второй переход: с подъезда к водопаду, носом в гору
  const R = roads.find((q) => q.name === 'spot khao_pom');
  if (R) { const p = roadPoint(R, 40, 0); LANDMARKS.push({ name: 'ДОРОГА НА КАО ПОМ', x: p[0], z: p[1], heading: Math.atan2(-p[2], -p[3]) }); }
}

// =====================================================================================================
// ЧАЙНАТАУН МАЕНАМА — улица от кольцевой к пляжу: китайские ворота с вывеской «CHINATOWN MAENAM» и драконами на коньке,
// двухэтажные шопхаусы, гирлянды красных фонарей поперёк улицы; в конце, у самого пляжа — китайский храм: красные стены,
// крыша в три яруса с загнутыми углами и драконами, четыре колонны с драконами, два каменных льва, сквозной проём на море.
// Улица в игре короткая (≈ 40 м: от кольцевой до пляжа тут всего 55 м), ширина домов настоящая.
// =====================================================================================================
const CHINA_STYLE = { floors: [2, 2], roof: 'tile', balcony: 0.6, kerb: '#c8302a', walls: ['#e8dcc8', '#d8c8b0', '#c8b8a8', '#e6d2b4', '#b8a898', '#dfd6c6'] };
function chinaRoof(S, cx, cz, len, hw, y0, y1, tile, along = 'z') {       // двускатная китайская крыша: конёк с загнутыми вверх концами, углы карниза подняты
  S.gable(cx, cz, len, hw, y0, y1, tile, '#7a1418', along);
  const P = (l, w, y) => along === 'x' ? [cx + l, y, cz + w] : [cx + w, y, cz + l], h = len / 2;
  S.rod(P(-h, 0, y1 + 0.12), P(h, 0, y1 + 0.12), 0.3, '#2f6a4a');
  for (const e of [-1, 1]) { S.limb(P(e * h, 0, y1 + 0.1), P(e * (h + 0.9), 0, y1 + 1.1), 0.2, 0.03, '#d8b24a', 5);
    for (const s of [-1, 1]) { S.rod(P(e * h, s * hw, y0), P(e * h, 0, y1), 0.22, '#d8b24a'); S.limb(P(e * h, s * hw, y0 + 0.05), P(e * (h + 0.5), s * (hw + 0.7), y0 + 0.95), 0.16, 0.03, '#d8b24a', 5); } }
}
function chinaDragon(S, P, len, col = '#2f8a4a') {                         // дракон на коньке: волнистое тело, голова с гривой; P(l, y) — точка вдоль конька
  for (let k = 0; k < 6; k++) S.limb(P(len * k / 6, 0.25 + (k % 2) * 0.4), P(len * (k + 1) / 6, 0.25 + ((k + 1) % 2) * 0.4), 0.16, 0.14, k % 2 ? col : '#e8c82a', 5);
  const h = P(0, 0.75); S.blob(h[0], h[1], h[2], 0.3, 0.26, 0.3, col, 6, 4); const t = P(-0.35, 1.05); S.limb(h, t, 0.1, 0.02, '#c8302a', 4);
}
function buildMaenamChina() {
  const R = roads.find((q) => q.name === 'spot maenam_china'), r = roads.indexOf(R);
  if (!R || !IS.spots.maenam_china) return;
  const g = spotGroup('maenam_china'), sp = g.userData.spot, L = sp.y, rnd = seededRandom(5697), RED = '#b01c20', GOLD = '#e8c05a';
  const lit = () => TOWN.lit || (TOWN.lit = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
  // ворота: четыре красных круглых столба, балка с вывеской, двухъярусная крыша с драконами
  { const s = 15, p = roadPoint(R, s, 0), y = asphaltTop(p[0], p[1]), ag = new THREE.Group(), S = sculptor(), Gl = sculptor();
    ag.position.set(p[0], y, p[1]); ag.rotation.y = Math.atan2(p[2], p[3]); scene.add(ag); ag.updateMatrixWorld(true);   // локальная +Z — вдоль улицы
    for (const sx of [-1, 1]) for (const dz of [-0.9, 0.9]) { S.tube(sx * 5.1, 0, 5.4, dz, 0.3, 0.28, RED, 8); S.tube(sx * 5.1, 0, 0.5, dz, 0.42, 0.36, '#8a8478', 8); S.tube(sx * 5.1, 4.9, 5.4, dz, 0.3, 0.42, GOLD, 8); }
    for (const sx of [-1, 1]) wallBox(ag, sx * 5.1, 0, 0.9, 2.6);
    S.box(11.6, 0.5, 2.6, 0, 5.65, 0, RED); S.box(6.4, 1.3, 0.3, 0, 6.6, 0, '#6e0607'); S.box(6.7, 0.14, 0.4, 0, 7.3, 0, GOLD); S.box(6.7, 0.14, 0.4, 0, 5.92, 0, GOLD);
    for (const sx of [-1, 1]) { S.box(2.2, 1.0, 2.4, sx * 4.6, 6.4, 0, RED); chinaRoof(S, sx * 4.4, 0, 3.6, 2.0, 6.9, 7.8, sx > 0 ? '#c98a3a' : '#c0813a', 'x'); }
    chinaRoof(S, 0, 0, 8.4, 2.2, 7.4, 8.9, '#d0913e', 'x');
    for (const e of [-1, 1]) chinaDragon(S, (l, yy) => [e * (0.7 + l), 8.95 + yy, 0], 3.0, e > 0 ? '#2f8a4a' : '#2a6ab8');
    S.blob(0, 9.6, 0, 0.3, 0.3, 0.3, '#f2c81e', 7, 4);                                                // жемчужина между драконами
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) { S.rod([sx * (2.2 + k * 1.3), 5.4, 0], [sx * (2.2 + k * 1.3), 4.9, 0], 0.03, '#1c1c1e'); S.blob(sx * (2.2 + k * 1.3), 4.6, 0, 0.26, 0.3, 0.26, '#d3261c', 7, 4); Gl.blob(sx * (2.2 + k * 1.3), 4.6, 0, 0.3, 0.34, 0.3, '#ff5a3a', 6, 3); }
    for (const face of [1, -1]) for (const [T, c] of [[S, GOLD], [Gl, '#ffe9a0']]) {
      const A = sculptor(); A.text('CHINATOWN', 0, 0.52, 0.17, 0.1, c, 1); A.text('MAENAM', 0, -0.08, 0.17, 0.1, c, 1);
      const m = T === S ? hotelMesh(A) : A.mesh(); if (T !== S) { m.material = lit(); m.visible = false; nightGlow.push(m); m.position.z = face * 0.012; }
      m.rotation.y = face > 0 ? 0 : Math.PI; m.position.y = 6.6; ag.add(m);
    }
    const gm = Gl.mesh(); gm.material = lit(); gm.visible = false; nightGlow.push(gm);
    ag.add(hotelMesh(S), gm); ag.userData.c = new THREE.Vector3(p[0], 0, p[1]); townSeen(ag);
    vegKeepOut.push(Object.assign((x, z) => (x - p[0]) ** 2 + (z - p[1]) ** 2 < 64, { c: [p[0], p[1], 8] })); }
  // шопхаусы по обеим сторонам улицы — там, где свободно (рядом стоят MR.DIY и ночной рынок)
  const END = R.len - 3, make = (lot, q) => shophouseRow(lot, q, CHINA_STYLE);
  for (const side of [1, -1]) townStreet(R, r, 21, END, side, LANE_HALF + 2.9, 9, [13.8, 9.2, 4.6], 0.3, { drop: 2.6, rise: 1.0, minH: 0.6 }, make, rnd);
  // гирлянды красных фонарей поперёк улицы
  { const S = sculptor(), Gl = sculptor(), c = roadPoint(R, R.len / 2, 0), sg = new THREE.Group(); scene.add(sg);
    for (let s = 22; s < END; s += 6.5) {
      const a = roadPoint(R, s, 5.8), b = roadPoint(R, s, -5.8), q = roadPoint(R, s, 0), y = asphaltTop(q[0], q[1]) + 6.3;
      S.rod([a[0], y, a[1]], [b[0], y, b[1]], 0.03, '#1c1c1e');
      for (let k = 1; k < 9; k++) { const t = k / 9, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, yy = y - Math.sin(t * Math.PI) * 0.5 - 0.28; S.blob(x, yy, z, 0.2, 0.22, 0.2, '#d3261c', 6, 4); S.box(0.1, 0.06, 0.1, x, yy - 0.26, z, '#e8c05a'); Gl.blob(x, yy, z, 0.24, 0.26, 0.24, '#ff5a3a', 6, 3); }
    }
    const m = hotelMesh(S), gm = Gl.mesh(); gm.material = lit(); gm.visible = false; nightGlow.push(gm);
    sg.add(m, gm); sg.userData.c = new THREE.Vector3(c[0], 0, c[1]); townSeen(sg); }
  // --- храм: фасад смотрит на улицу (−u), за спиной море ---
  const S = sculptor(), Gl = sculptor(), CU = 52, HU = 5.5, HV = 6, F = CU - HU, P = L + 0.5;
  { const Pv = sculptor(); drape(Pv, g, 38, 66, -13, 13, (i, j) => (i + j) % 2 ? '#8f8b82' : '#868279', 0.06, 3); g.add(Pv.mesh()); }
  padBlend(g, 38, -1, -4, 4, '#8f8b82');
  S.box(2 * HU + 1.6, 1.4, 2 * HV + 1.6, CU, P - 0.7, 0, '#9a9488'); for (let k = 0; k < 3; k++) S.box(0.4, 0.5 - k * 0.167, 5, F - 1.0 - k * 0.4, L + (0.5 - k * 0.167) / 2, 0, '#a8a296');
  // стены: задняя с проёмом на море, боковые; фасад открыт между колоннами
  S.box(0.4, 4.2, 2 * HV, CU + HU - 0.2, P + 2.1, 0, RED); S.box(0.5, 3.0, 3.2, CU + HU - 0.2, P + 1.5, 0, '#5ab0c8');   // сквозной проём: за ним море
  for (const s of [-1, 1]) { S.box(2 * HU, 4.2, 0.4, CU, P + 2.1, s * (HV - 0.2), RED); S.box(0.1, 1.5, 1.5, CU, P + 2.4, s * (HV + 0.02), '#e8c05a'); S.blob(CU, P + 2.4, s * (HV + 0.08), 0.5, 0.5, 0.06, RED, 8, 3);   // круглые окна
    S.box(0.4, 4.2, 2.2, F + 0.2, P + 2.1, s * (HV - 1.1), RED); }
  S.box(2 * HU - 0.6, 0.1, 2 * HV - 0.6, CU, P + 0.05, 0, '#c8a868'); for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2) S.box(1.9, 0.02, 2.1, CU - 4 + i * 2, P + 0.11, -4.4 + j * 2.2, '#8a2a2a');   // расписной пол
  S.box(1.6, 1.0, 3.0, CU + 2.6, P + 0.6, 0, '#6e0607'); S.blob(CU + 2.6, P + 1.7, 0, 0.5, 0.6, 0.5, GOLD, 7, 4); S.blob(CU + 2.6, P + 2.5, 0, 0.26, 0.3, 0.26, GOLD, 6, 4);   // алтарь с золотой фигурой
  // четыре колонны с драконами у входа
  for (const v of [-4.4, -1.6, 1.6, 4.4]) { S.tube(F + 0.3, P, P + 4.0, -v, 0.28, 0.26, RED, 8); S.tube(F + 0.3, P, P + 0.4, -v, 0.4, 0.34, '#8a8478', 8);
    for (let k = 0; k < 7; k++) { const a = k * 1.1 + v, b = a + 1.1; S.limb([F + 0.3 + Math.cos(a) * 0.36, P + 0.6 + k * 0.45, -v + Math.sin(a) * 0.36], [F + 0.3 + Math.cos(b) * 0.36, P + 1.05 + k * 0.45, -v + Math.sin(b) * 0.36], 0.11, 0.1, k % 2 ? GOLD : '#2f8a4a', 4); }
    wallBox(g, F + 0.3, v, 0.7, 0.7); }
  // красная доска с золотыми знаками над входом, фонари
  S.box(0.2, 0.9, 4.4, F - 0.05, P + 3.55, 0, '#7a1418'); for (let k = 0; k < 4; k++) { S.box(0.06, 0.5, 0.5, F - 0.18, P + 3.55, -1.35 + k * 0.9, GOLD); S.box(0.07, 0.16, 0.3, F - 0.19, P + 3.55, -1.35 + k * 0.9, '#7a1418'); }
  for (const v of [-3, 3]) { S.rod([F - 0.4, P + 4.1, -v], [F - 0.4, P + 3.4, -v], 0.03, '#1c1c1e'); S.blob(F - 0.4, P + 3.0, -v, 0.34, 0.4, 0.34, '#d3261c', 7, 4); Gl.blob(F - 0.4, P + 3.0, -v, 0.38, 0.44, 0.38, '#ff5a3a', 6, 3); }
  // крыша в три яруса по фасаду: высокий средний и два пониженных боковых; на коньках — драконы и жемчужина
  S.box(2 * HU + 0.4, 0.3, 2 * HV + 0.4, CU, P + 4.3, 0, '#7a1418');
  for (const s of [-1, 1]) { chinaRoof(S, CU, s * 4.3, 3.8, HU + 1.5, P + 4.4, P + 6.8, '#8a3a1e'); chinaDragon(S, (l, yy) => [CU, P + 6.85 + yy, s * (2.7 + l)], 2.6, s > 0 ? '#2a6ab8' : '#2f8a4a'); }
  S.box(2 * HU - 1, 1.3, 5.2, CU, P + 5.0, 0, RED); chinaRoof(S, CU, 0, 5.6, HU + 1.7, P + 5.6, P + 8.8, '#9a4222');
  for (const e of [-1, 1]) chinaDragon(S, (l, yy) => [CU, P + 8.9 + yy, e * (0.55 + l)], 1.9, e > 0 ? '#2f8a4a' : '#e8782a');
  S.blob(CU, P + 9.5, 0, 0.3, 0.3, 0.3, '#f2f2ee', 7, 4);
  wallBox(g, CU + HU - 0.2, 0, 0.6, 2 * HV); for (const s of [-1, 1]) { wallBox(g, CU, s * (HV - 0.2), 2 * HU, 0.6); wallBox(g, F + 0.2, s * (HV - 1.1), 0.6, 2.2); }
  spotPlate(g, F - 2.2, F, 0, 2.5, L + 0.05, P, true); spotPlate(g, F, CU + HU - 0.5, 0, HV - 0.5, P);   // в храм можно въехать по ступеням
  // каменные львы у входа, дракон на постаменте, курильница — мелочь, сбивается
  for (const v of [-3.2, 3.2]) S.part(g, F - 3.0, v, { kind: 'small', mat: 'stone', r: 0.7, loss: 0.05, color: '#b8b4aa' }, () => {
    S.box(1.0, 0.6, 0.8, F - 3.0, L + 0.3, -v, '#9a968c'); S.blob(F - 3.0, L + 1.0, -v, 0.5, 0.42, 0.34, '#b8b4aa', 7, 4); S.blob(F - 3.3, L + 1.45, -v, 0.3, 0.3, 0.28, '#c4c0b6', 6, 4); S.limb([F - 3.25, L + 0.6, -v + 0.2], [F - 3.3, L + 1.0, -v + 0.2], 0.1, 0.1, '#b8b4aa', 4); });
  S.part(g, 42, 0, { kind: 'small', mat: 'metal', r: 0.6, loss: 0.04, color: '#8a6a2a' }, () => { S.tube(42, L, L + 0.7, 0, 0.3, 0.42, '#8a6a2a', 8); S.tube(42, L + 0.7, L + 1.0, 0, 0.5, 0.5, '#a8842e', 8); for (const d of [-0.2, 0, 0.2]) S.box(0.03, 0.5, 0.03, 42 + d, L + 1.25, d, '#c8302a'); });
  { const y = L; S.box(1.6, 0.9, 1.6, 44, y + 0.45, 9, '#9a968c'); const D = (l, yy) => [44 - 0.6 + l * 0.5, y + 0.9 + yy, 9 + Math.sin(l * 2.2) * 0.4]; chinaDragon(S, D, 2.4, GOLD); wallBox(g, 44, -9, 1.6, 1.6); }
  // белая башенка-маяк на пляже за храмом
  { const u = 66, v = -10, y = Math.max(0.3, spotGround(g, u, v)); S.tube(u, y, y + 6.5, -v, 1.1, 0.75, '#f2f2ee', 8); S.tube(u, y + 6.5, y + 6.8, -v, 1.1, 1.1, '#c8302a', 8); S.tube(u, y + 6.8, y + 7.9, -v, 0.6, 0.6, '#dfe8ea', 8); Gl.tube(u, y + 6.85, y + 7.85, -v, 0.62, 0.62, '#fff2c0', 8); S.tube(u, y + 7.9, y + 8.7, -v, 0.8, 0.02, '#c8302a', 8); wallBox(g, u, v, 2.2, 2.2); }
  { const gm = Gl.mesh(); gm.material = lit(); gm.visible = false; nightGlow.push(gm); g.add(templeMesh(S), gm); }
  templePlants(g, [[40, 16, 'coconut'], [47, -16, 'coconut'], [60, 15, 'coconut'], [62, -17, 'areca'], [70, 6, 'coconut']]);
  templeKeepOut(g, 37, 68, -14, 14);
  g.userData.c = new THREE.Vector3(g.localToWorld(new THREE.Vector3(CU, 0, 0)).x, 0, g.localToWorld(new THREE.Vector3(CU, 0, 0)).z); townSeen(g);
  const tp = roadPoint(R, 5, 0);
  spotPlace('КИТАЙСКИЙ ХРАМ МАЕНАМ', g, 39, 0, 1, 0);                                              // на площадке перед храмом, носом к входу
  LANDMARKS.push({ name: 'ЧАЙНАТАУН МАЕНАМ', x: tp[0], z: tp[1], heading: Math.atan2(-tp[2], -tp[3]) });
}

// =====================================================================================================
// ВАТ НА ПХРА ЛАН — тихий монастырь у пирса Lomprayah: убосот на высоком цоколе с красно-золотым фронтоном, старая
// чеди, ряд серых ступ-усыпальниц вдоль побелённой стены, домики духов под баньяном, кельи на сваях, павильон с
// сидящим Буддой под красным навесом, памятник Раме V. Двор песчаный, с кокосовыми пальмами. Ворота — к дороге на пирс.
// =====================================================================================================
function buildPhraLan() {
  const g = spotGroup('phra_lan'), sp = g.userData.spot, L = sp.y, S = sculptor(), GREY = ['#8a888c', '#77757a', '#9a989c'], CREAM = '#efe6d2';
  { const Pv = sculptor(); drape(Pv, g, -30, 30, -25, 30, (i, j) => ['#d2bf9c', '#c9b590', '#d8c6a4', '#c4b08a'][(i * 5 + j * 3) % 4], 0.05, 4); g.add(Pv.mesh()); }
  padBlend(g, 30, 1, -4.5, 4.5, '#c9b590');
  // ворота и побелённая стена вдоль дороги; вдоль стены внутри — ряд серых ступ
  for (const [x, z] of templeGate(S, 29, 0, L, 'z', 4.4, [T_WHITE, T_GOLD, '#8a2030', '#551923'])) wallBox(g, x, -z, 1.6, 1.6);
  const WALL = { step: 3, y0: L, slab: [0, 1.7, 0.3, '#eeeae0'], post: [0.42, 2.0, '#e2ded4'], kind: 'parapet', loss: 0.14, mat: 'stone' };
  armFence(buildFence(g, [[29, 6.2, 29, 29], [29, 29, 4, 29]], WALL)); armFence(buildFence(g, [[29, -6.2, 29, -24.5], [29, -24.5, 10, -24.5]], WALL));
  for (let i = 0; i < 9; i++) { const u = 26.6, v = 8.5 + i * 2.3, h = 1.6 + (i * 7 % 5) * 0.22;
    S.part(g, u, v, { kind: 'small', mat: 'stone', r: 0.55, loss: 0.05, color: GREY[0] }, () => { S.box(0.9, 0.3, 0.9, u, L + 0.15, -v, GREY[1]); chedi(S, u, L + 0.3, -v, 0.42, h, 6, GREY); }); }
  // старая чеди
  S.box(3.2, 0.9, 3.2, 17, L + 0.45, 19, '#c9c5bb'); S.box(2.6, 0.7, 2.6, 17, L + 1.25, 19, '#b8b4aa'); chedi(S, 17, L + 1.6, 19, 1.3, 6.2, 8, ['#c9c5bb', '#b8b4aa', '#a8a49a']); wallBox(g, 17, -19, 3.2, 3.2);
  // убосот: высокий цоколь с лестницей на восток (к морю), портик, крутая трёхъярусная крыша, фронтон — золото на красном
  { const cu = -4, cv = 8, P = L + 1.3, H = 5.2;
    S.box(13, 1.3, 11, cu, L + 0.65, -cv, '#d9d6cf'); for (let k = 0; k < 5; k++) S.box(0.42, 1.3 - k * 0.26, 4, cu - 6.7 - k * 0.42, L + (1.3 - k * 0.26) / 2, -cv, '#c9c5bb');
    S.box(8.4, H, 7.4, cu + 0.6, P + H / 2, -cv, CREAM); S.box(8.7, 0.5, 7.7, cu + 0.6, P + 0.25, -cv, '#d6d6cd');
    for (const s of [-1, 1]) { for (let i = 0; i < 3; i++) thaiWindow(S, cu - 2 + i * 2.6, P + 2.5, -cv + s * 3.72, 0.9, 1.6, 'z', s, '#30150e'); S.tube(cu - 4.6, P, P + H, -cv + s * 2.6, 0.32, 0.26, T_WHITE, 8); S.tube(cu - 4.6, P + H - 0.5, P + H, -cv + s * 2.6, 0.3, 0.42, T_GOLD, 8); }
    thaiWindow(S, cu - 3.62, P + 1.9, -cv, 1.2, 2.5, 'x', -1, '#30150e');
    thaiRoof(S, cu, -cv, { len: 12.4, hw: 4.6, y0: P + H, y1: P + H + 5.0, tiers: 3, step: 2.6, drop: 1.1, tile: ['#c4683a', '#a8502c'], front: T_GOLD_D, field: '#551923', skirt: 1.3 });
    templeRail(g, [[cu - 6.4, cv - 5.4, cu + 6.4, cv - 5.4], [cu + 6.4, cv - 5.4, cu + 6.4, cv + 5.4], [cu + 6.4, cv + 5.4, cu - 6.4, cv + 5.4], [cu - 6.4, cv + 5.4, cu - 6.4, cv + 2.2], [cu - 6.4, cv - 2.2, cu - 6.4, cv - 5.4]], P, T_WHITE, T_WHITE, 0.8);
    wallBox(g, cu + 0.6, cv, 8.4, 7.4); spotPlate(g, cu - 8.8, cu - 6.5, cv, 2, L + 0.05, P, true); spotPlate(g, cu - 6.5, cu + 6.5, cv, 5.5, P); }
  // павильон с сидящим Буддой под красным навесом
  { const cu = -16, cv = -16; S.box(9, 0.4, 7, cu, L + 0.2, -cv, '#d9d6cf'); for (const a of [-1, 0, 1]) for (const b of [-1, 1]) S.box(0.24, 3.6, 0.24, cu + a * 4, L + 2.2, -cv + b * 3, T_WHITE);
    S.hip(cu, -cv, 5.4, 4.3, L + 3.9, 2.2, 0.4, L + 5.6, (i) => i % 2 ? '#b8302a' : '#a02820');
    S.box(2.4, 1.0, 2.4, cu + 1.5, L + 0.9, -cv, '#f2ecd8'); smallBuddha(S, cu + 1.5, L + 1.4, -cv, 2.3); wallBox(g, cu + 1.5, cv, 2.4, 2.4); }
  // кельи монахов на сваях
  for (const [u, v, c] of [[8, -19, '#8a6a48'], [-4, -20.5, '#7a5a3e']]) { for (const a of [-1, 1]) for (const b of [-1, 1]) S.box(0.2, 1.3, 0.2, u + a * 2.2, L + 0.65, -v + b * 1.7, '#5a4a3c');
    S.box(5, 0.2, 4, u, L + 1.3, -v, '#8a6a4a'); S.box(4.4, 2.3, 3.4, u, L + 2.55, -v, c); S.gable(u, -v, 5.6, 2.5, L + 3.7, L + 5.0, '#8a6a5c', c, 'x'); S.box(0.1, 1.8, 0.9, u + 2.22, L + 2.3, -v, '#30150e');
    for (let k = 0; k < 4; k++) S.box(0.35, 0.08, 1.0, u + 2.75 + k * 0.35, L + 1.2 - k * 0.3, -v, '#8a6a4a'); S.box(0.9, 0.5, 0.06, u - 0.6, L + 2.9, -v + 1.72, '#e8871e'); wallBox(g, u, v, 5, 4); }
  // баньян: толстый ствол с воздушными корнями, раскидистая крона; под ним домики духов и фигурки зверей
  { const u = 12, v = 6, y = L; S.tube(u, y, y + 4.2, -v, 1.3, 0.9, '#6a5a4a', 9); for (let k = 0; k < 9; k++) { const a = k * 0.7; S.limb([u + Math.cos(a) * 2.6, y, -v + Math.sin(a) * 2.6], [u + Math.cos(a) * 1.4, y + 4.4, -v + Math.sin(a) * 1.4], 0.12, 0.09, '#7a6a58', 4); }
    for (const [du, dy, dv, r] of [[0, 6.2, 0, 4.6], [3.4, 5.4, 1.5, 3.2], [-3.2, 5.6, -1.6, 3.4], [0.8, 5.2, -3.8, 3.0], [-1, 5.4, 3.6, 3.1]]) S.blob(u + du, y + dy, -v - dv, r, r * 0.6, r, ['#2f6a2a', '#3a7a30', '#28602a'][(r * 10 | 0) % 3], 8, 5);
    wallBox(g, u, v, 2.4, 2.4);
    [[4.2, 1.5, true], [3.6, -2.6, false], [-3.9, 2.2, false], [-3.2, -3.0, true]].forEach(([du, dv, big]) => S.part(g, u + du, v + dv, { kind: 'small', mat: 'wood', r: 0.6, loss: 0.03, color: '#b03a2a' }, () => spiritHouse(S, u + du, -(v + dv), y, big)));
    for (const [du, dv, c] of [[4.9, -0.6, '#e8e4d8'], [5.2, 0.3, '#d8b24a'], [-4.6, 0.2, '#c8c4b8']]) S.part(g, u + du, v + dv, { kind: 'small', mat: 'stone', r: 0.3, loss: 0.02, color: c }, () => { S.blob(u + du, y + 0.3, -(v + dv), 0.3, 0.22, 0.18, c, 6, 3); S.blob(u + du + 0.26, y + 0.5, -(v + dv), 0.14, 0.14, 0.12, c, 5, 3); }); }
  // памятник Раме V: тёмная бронза на светлом постаменте
  { const u = 19, v = -12; S.box(2.2, 0.4, 2.2, u, L + 0.2, -v, '#d9d6cf'); S.box(1.5, 1.7, 1.5, u, L + 1.25, -v, '#efece4'); S.tube(u, L + 2.1, L + 3.5, -v, 0.34, 0.28, '#3a3028', 7); S.blob(u, L + 3.72, -v, 0.2, 0.24, 0.2, '#3a3028', 6, 4); for (const s of [-1, 1]) S.limb([u, L + 3.3, -v + s * 0.34], [u + 0.1, L + 2.6, -v + s * 0.42], 0.1, 0.08, '#3a3028', 4); wallBox(g, u, v, 2.2, 2.2); }
  g.add(spotSign(S, 34, 9, L, 'WAT NA PHRA LAN'));
  g.add(templeMesh(S));
  parkVehicle(g, parkedCar(6), 21, 2.5, 'u-', L + 0.07); scooterRow(g, 5, 2, 23, -4, 0, -0.9, Math.PI / 2, L + 0.07);
  templePlants(g, [[24, -21, 'coconut'], [-10, 24, 'coconut'], [-24, 20, 'coconut'], [-26, 2, 'coconut'], [-8, -6, 'coconut'], [4, -10, 'coconut'], [-24, -22, 'coconut'], [22, 25, 'areca'], [-28, -10, 'fan'], [2, 22, 'bush'], [34, -10, 'coconut'], [34, 16, 'coconut']]);
  templeKeepOut(g, -33, 33, -33, 33);
  spotPlace('ВАТ НА ПХРА ЛАН', g, 42, 0, -1, 0);
}

function buildSights() {
  const SP = IS.spots || {};
  if (SP.hin_ta) buildHinTa();
  if (SP.lad_koh) buildLadKoh();
  if (SP.khao_pom) buildKhaoPom();
  if (SP.maenam_china) buildMaenamChina();
  if (SP.phra_lan) buildPhraLan();
}
