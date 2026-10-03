// Дневные рынки — refs/fresh_market_lamai, refs/fresh_market_maenam (рынок Хуа Танона строит сам посёлок, towns.js).
// Места у дорог подбирает сборщик острова по точкам OSM (ISLAND.fresh). Рынок — ангар на стальных колоннах под двускатной
// крышей из профлиста, бока открыты, под крышей лампы дневного света; внутри ряды прилавков:
//   Ламай (фото 01–09) — серо-голубая кровля, низкие столы с синими и красными корзинами овощей и фруктов, над ними гроздья
//     бананов на перекладинах; рядом павильон под красной двухъярусной шатровой крышей (фото 09); у дороги — зонты и тенты
//     с готовой едой (фото 05, 07);
//   Маенам (фото 01, 04, 08, 10) — красно-коричневые фермы, ряды одинаковых белых кафельных прилавков: рыба и кальмары на
//     подносах, весы, тазы, овощи и фрукты; у входа — дуриан на подстилках (07), лавка еды под зонтом (05).
// Ангары, колонны, павильон — твёрдые; прилавки, столы, зонты, подстилки — разрушаемые (одна общая геометрия на рынок —
// propBatch из roadside.js). Вывески — по-английски. Рынки дневные: ночью огней нет.
// Оси рынка: u — от площадки к дороге, v — влево вдоль дороги, y — от уровня площадки.
// Файл подключается после nightmarket.js и только объявляет функции; игра зовёт buildFreshMarkets().

const FRESH = {
  lamai: { W: 46, D: 30, PARK: 4, sign: 'LAMAI FRESH MARKET', place: 'РЫНОК ЛАМАЙ' },
  maenam: { W: 50, D: 22, PARK: 4, sign: 'MAENAM MORNING MARKET', place: 'РЫНОК МАЕНАМ' },
};
const PRODUCE = ['#e8782a', '#3a9a3a', '#d83a2a', '#f2d23a', '#8ac83a', '#eef0d8', '#6a3a7a', '#c8642a', '#5aa83a', '#f0a03a'];   // морковь, зелень, перец, бананы, огурцы, капуста, баклажаны, лук…
const BASKETS = ['#2a6ad8', '#d83a3a', '#2a8ad8', '#2a9a5a', '#d83a3a'];

// Ангар в группе g (оси группы: x — u, z — −v): колонны по краям и посередине, фермы, двускатная крыша, прогоны, лампы.
// o: u0..u1 × v0..v1 — колонны; eave — высота карниза; rise — до конька; step — шаг колонн; roof, truss, col — цвета.
function freshHangar(g, S, o) {
  const { u0, u1, v0, v1, eave, rise } = o, uc = (u0 + u1) / 2, hw = (u1 - u0) / 2, Y = LOT_Y, OV = 0.9, len = v1 - v0 + 1.4;
  const nv = Math.max(1, Math.round((v1 - v0) / o.step));
  for (let i = 0; i <= nv; i++) {
    const v = v0 + (v1 - v0) * i / nv;
    for (const u of [u0, uc, u1]) { const top = u === uc ? eave + rise : eave; S.box(0.28, top, 0.28, u, Y + top / 2, -v, o.col); wallBox(g, u, v, 0.4, 0.4); }
    S.box(u1 - u0 + 2 * OV, 0.16, 0.12, uc, Y + eave - 0.04, -v, o.truss);                                   // затяжка
    for (const s of [-1, 1]) {
      S.rod([uc + s * (hw + OV), Y + eave - OV * rise / hw, -v], [uc, Y + eave + rise, -v], 0.16, o.truss);   // стропило
      for (const f of [0.33, 0.66]) S.rod([uc + s * hw * f, Y + eave, -v], [uc + s * hw * (f + 0.17), Y + eave + rise * (1 - f - 0.17), -v], 0.08, o.truss);   // раскосы
    }
  }
  const yr = (u) => Y + eave + rise * (1 - Math.abs(u - uc) / hw);                                             // высота кровли над точкой u
  S.gable(uc, -(v0 + v1) / 2, len, hw + OV, Y + eave - OV * rise / hw, Y + eave + rise + 0.04, o.roof, o.roof, 'z');
  for (const f of [-0.75, -0.4, 0.4, 0.75]) S.box(0.08, 0.1, len, uc + f * hw, yr(uc + f * hw) - 0.12, -(v0 + v1) / 2, o.truss);   // прогоны
  for (let i = 0; i < nv; i++) for (const f of [-0.45, 0.45]) {                                              // лампы дневного света
    const v = v0 + (v1 - v0) * (i + 0.5) / nv;
    S.box(0.1, 0.06, 1.3, uc + f * hw, Y + eave - 0.25, -v, '#f4f8ff'); S.box(0.02, 0.3, 0.02, uc + f * hw, Y + eave - 0.08, -v, '#3a3a3c');
  }
  S.quad([u0 - 0.5, Y + 0.012, -(v0 - 0.5)], [u1 + 0.5, Y + 0.012, -(v0 - 0.5)], [u1 + 0.5, Y + 0.012, -(v1 + 0.5)], [u0 - 0.5, Y + 0.012, -(v1 + 0.5)], '#a9a69e');   // гладкий пол под крышей
}
// Павильон под красной двухъярусной шатровой крышей (Ламай, фото 09): центр (u, v), полуразмер a
function freshPavilion(g, S, u, v, a) {
  const Y = LOT_Y, RED = ['#b8443a', '#a83c34'], k = a - 0.5;
  for (const x of [-k, 0, k]) for (const z of [-k, 0, k]) if (x || z) { S.box(0.3, 3.4, 0.3, u + x, Y + 1.7, -(v + z), '#e8e4da'); wallBox(g, u + x, v + z, 0.4, 0.4); }
  for (const s of [-1, 1]) { S.box(2 * k, 0.3, 0.2, u, Y + 3.3, -(v + s * k), '#e8e4da'); S.box(0.2, 0.3, 2 * k, u + s * k, Y + 3.3, -v, '#e8e4da'); }   // обвязка
  S.hip(u, -v, a + 1.0, a + 1.0, Y + 3.25, a * 0.48, a * 0.48, Y + 5.3, (i) => RED[i % 2]);                // нижний ярус
  for (const x of [-1, 1]) for (const z of [-1, 1]) S.box(0.16, 0.7, 0.16, u + x * a * 0.46, Y + 5.6, -(v + z * a * 0.46), '#e8e4da');   // просвет между ярусами
  S.hip(u, -v, a * 0.64, a * 0.64, Y + 5.9, 0.35, 0.35, Y + 7.7, (i) => RED[(i + 1) % 2]);                   // верхний ярус
  S.box(0.8, 0.3, 0.8, u, Y + 7.8, -v, '#8a2e28');
  S.quad([u - a, Y + 0.012, -(v - a)], [u + a, Y + 0.012, -(v - a)], [u + a, Y + 0.012, -(v + a)], [u - a, Y + 0.012, -(v + a)], '#a9a69e');
}

function buildFreshMarket(s, k) {
  const F = FRESH[s.kind]; if (!F) return;
  const { W, D, PARK } = F, c = Math.cos(s.az), sn = Math.sin(s.az), yaw = -s.az, rnd = seededRandom(1300 + k * 29);
  const Wp = (u, v) => [s.x + c * u + sn * v, s.z + sn * u - c * v];
  const Y0 = s.y + LOT_RISE + LOT_Y;
  const B = propBatch(), pick = (a) => a[(rnd() * a.length) | 0];
  // коробка в осях рынка (как в nightmarket.js): размеры su (вдоль u), sy, sv (вдоль v); turn — поворот в плане
  const box = (u, y, v, su, sy, sv, color, piece = true, turn = 0) => { const p = Wp(u, v); B.box(p[0], Y0 + y, p[1], su, sy, sv, yaw + turn, color, piece); };
  const P3 = (u, y, v) => { const p = Wp(u, v); return [p[0], Y0 + y, p[1]]; };
  const item = (u, v, info) => { const p = Wp(u, v); return Object.assign({ x: p[0], z: p[1] }, info); };
  // по оси прилавка: along — прилавок вытянут вдоль v (иначе вдоль u); o — смещение вдоль длинной стороны
  const at = (u, v, along, o, side = 0) => along ? [u + side, v + o] : [u + o, v + side];
  const sz = (along, l, w) => along ? [w, l] : [l, w];

  // корзина, полная товара
  const basket = (u, v, col) => { box(u, 0.93, v, 0.55, 0.24, 0.48, pick(BASKETS)); box(u, 1.07, v, 0.48, 0.12, 0.42, col); for (let i = 0; i < 3; i++) box(u + (rnd() - 0.5) * 0.3, 1.15, v + (rnd() - 0.5) * 0.25, 0.14, 0.1, 0.14, col, false); };
  // Ламай: низкий стол под клеёнкой, корзины с овощами; у части — рама с гроздьями бананов (фото 01, 08)
  const vegTable = (u, v, along, bananas) => {
    B.begin();
    const [a, b] = sz(along, 2.4, 0.95), cloth = pick(['#d8483a', '#2a6ad8', '#e8dcc0', '#3a8a5a']);
    box(u, 0.4, v, a, 0.8, b, '#7a5a3c'); box(u, 0.81, v, a + 0.05, 0.03, b + 0.05, cloth);
    for (const o of [-0.8, 0, 0.8]) { const [x, z] = at(u, v, along, o); basket(x, z, pick(PRODUCE)); }
    if (bananas) {
      for (const e of [-1.15, 1.15]) { const [x, z] = at(u, v, along, e, -0.35); box(x, 1.05, z, 0.05, 2.1, 0.05, '#8e9296'); }
      { const [x, z] = at(u, v, along, 0, -0.35); const [l, w] = sz(along, 2.35, 0.05); box(x, 2.08, z, l, 0.05, w, '#8e9296'); }
      for (const o of [-0.75, -0.25, 0.25, 0.75]) { const [x, z] = at(u, v, along, o, -0.35); box(x, 1.75, z, 0.26, 0.5, 0.26, rnd() < 0.7 ? '#e8cc3a' : '#9ab83a'); box(x, 2.02, z, 0.03, 0.06, 0.03, '#3a3a3c', false); }
    }
    B.end(item(u, v, { kind: 'small', mat: 'wood', r: 1.3, loss: 0.03 }));
  };
  // Маенам: белый кафельный прилавок-блок (фото 01, 03, 10); товар — рыба на подносах, весы, тазы или корзины с овощами
  const tileCounter = (u, v, along, goods) => {
    B.begin();
    const [a, b] = sz(along, 2.0, 1.0);
    box(u, 0.4, v, a, 0.8, b, '#eceae4'); box(u, 0.82, v, a + 0.04, 0.04, b + 0.04, '#e2c6bc');
    if (goods === 'fish') {
      for (const o of [-0.5, 0.5]) { const [x, z] = at(u, v, along, o); box(x, 0.87, z, 0.62, 0.05, 0.62, '#c8ccd0'); for (let i = 0; i < 3; i++) { const t = (rnd() - 0.5) * 1.2; box(x + (rnd() - 0.5) * 0.25, 0.92, z + (rnd() - 0.5) * 0.25, 0.4, 0.05, 0.11, pick(['#aeb8c2', '#c8b8c0', '#8e9aa6', '#d8c8c8']), false, t); } }
      { const [x, z] = at(u, v, along, 0.85, 0.25); box(x, 0.98, z, 0.24, 0.28, 0.2, '#e8e4d8'); box(x, 1.1, z, 0.2, 0.18, 0.21, '#f6f6f2'); }   // весы-циферблат
      { const [x, z] = at(u, v, along, -0.85, 0.25); box(x, 0.95, z, 0.36, 0.2, 0.36, pick(['#2a8ad8', '#3aa85a', '#e8e4d8'])); }              // таз
    } else for (const o of [-0.6, 0.1, 0.7]) { const [x, z] = at(u, v, along, o); basket(x, z, pick(PRODUCE)); }
    B.end(item(u, v, { kind: 'small', mat: 'stone', r: 1.1, loss: 0.03 }));
  };
  // зонт с прилавком еды (фото 05, 07 Ламай, 05 Маенам): шест, купол-пирамида, стол с подносами и тазами
  const umbrella = (u, v, col) => {
    const it = B.begin();
    box(u, 1.2, v, 0.05, 2.4, 0.05, '#c8ccd0');
    const A = P3(u, 2.75, v), Q = [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]].map(([a, b]) => P3(u + a, 2.2, v + b));
    for (let i = 0; i < 4; i++) B.quad(Q[i], Q[(i + 1) % 4], A, A, i % 2 ? col : '#f2f2ee');
    { const p = Wp(u, v); it.boxes.push([p[0], Y0 + 2.4, p[1], 2.4, 0.05, 2.4, yaw, new THREE.Color(col).getHex()]); }   // и обломки купола
    box(u + 0.4, 0.38, v, 0.8, 0.76, 1.6, '#e8e8e4'); box(u + 0.4, 0.78, v, 0.84, 0.04, 1.64, pick(['#d8483a', '#2a6ad8', '#f2e8c0']));
    for (const o of [-0.5, 0, 0.5]) box(u + 0.4, 0.84, v + o, 0.5, 0.08, 0.42, pick(['#e8a23a', '#c8642a', '#f2e8c0', '#d84a3a', '#7ab84a']));
    box(u - 0.2, 0.9, v + 0.5, 0.4, 0.22, 0.4, '#c8ccd0');                                                // таз с карри
    B.end(item(u, v, { kind: 'tent', mat: 'metal', r: 1.3, loss: 0.04 }));
  };
  // дуриан и лонгконг на подстилке у входа (Маенам, фото 07)
  const durianMat = (u, v) => {
    B.begin();
    box(u, 0.01, v, 1.4, 0.02, 2.2, pick(['#3a6ad8', '#2a8a7a']));
    for (let i = 0; i < 9; i++) box(u + (rnd() - 0.5) * 1.0, 0.16, v + (rnd() - 0.5) * 1.8, 0.3, 0.28, 0.3, pick(['#8a8a3a', '#9a8e44', '#7a7a34']), true, rnd());
    for (let i = 0; i < 5; i++) box(u + 0.45, 0.06, v - 0.7 + i * 0.3, 0.18, 0.1, 0.18, '#d8b84a', false);
    B.end(item(u, v, { kind: 'small', mat: 'wood', r: 1.1, loss: 0.02 }));
  };

  const g = new THREE.Group();
  g.position.set(s.x, s.y + LOT_RISE, s.z); g.rotation.y = -s.az;
  scene.add(g); g.updateMatrixWorld(true);
  const S = sculptor(), A = sculptor(), U1 = D / 2 + PARK;
  // площадка: бетон с пятнами, борт по краю, к дороге — рваный край покрытия
  A.quad([-D / 2 - 1, LOT_Y, -W / 2 - 1], [U1, LOT_Y, -W / 2 - 1], [U1, LOT_Y, W / 2 + 1], [-D / 2 - 1, LOT_Y, W / 2 + 1], '#938f85');
  A.skirt(-D / 2 - 1, U1, -W / 2 - 1, W / 2 + 1, LOT_Y, '#827f76');
  for (let i = 0; i < 12; i++) { const u = -D / 2 + rnd() * D, z = -W / 2 + rnd() * W, r = 0.6 + rnd() * 1.4; A.quad([u - r, LOT_Y + 0.006, z - r * 0.7], [u + r, LOT_Y + 0.006, z - r * 0.5], [u + r * 0.8, LOT_Y + 0.006, z + r * 0.7], [u - r * 0.9, LOT_Y + 0.006, z + r * 0.6], i % 2 ? '#8a867c' : '#9c988c'); }
  g.add(A.mesh());
  lotApron(g, U1, -W / 2 - 1, W / 2 + 1, LOT_Y, '#938f85');

  let front;                                                                                           // край крыши со стороны дороги — там вывеска
  if (s.kind === 'lamai') {
    // ангар 27 × 17 в глубине площадки, павильон под красной крышей рядом, у дороги — зонты и тенты с едой
    const H = { u0: -13, u1: 3, v0: -21, v1: 5, eave: 3.6, rise: 2.0, step: 4.33, roof: '#8a9aa6', truss: '#8e959c', col: '#9aa0a6' };
    freshHangar(g, S, H); front = { u: H.u1 + 1.0, v: (H.v0 + H.v1) / 2, y: H.eave };
    freshPavilion(g, S, -6, 15, 6.5);
    for (const v of [-18.5, -13.5, -8.5, -3.5, 1.5]) for (const u of [-10.2, -7.6, -2.4, 0.2]) vegTable(u, v + (rnd() - 0.5) * 0.4, true, rnd() < 0.6);
    for (const [u, v] of [[-8.6, 12.6], [-8.6, 17.4], [-3.4, 12.6], [-3.4, 17.4]]) vegTable(u, v, false, rnd() < 0.5);
    for (const v of [-15.5, -12, 9.5, 13, 16.5, 20]) umbrella(7.5 + (rnd() - 0.5) * 0.6, v, pick(['#2a5ad8', '#2a9a4a', '#d83a2a', '#2aa8b8', '#e8782a']));
    scooterRow(g, k + 21, 6, D / 2 + 1.8, -6, 0, 0.85, Math.PI, LOT_Y);
    parkVehicle(g, pickupGeo('boxes', '#e8e8e4'), 11, -20, 'v+', LOT_Y);
  } else {
    // ангар 46 × 15 вдоль дороги, ряды кафельных прилавков; у входа — дуриан на подстилках и лавка еды под зонтом
    const H = { u0: -10, u1: 5, v0: -23, v1: 23, eave: 4.0, rise: 2.0, step: 4.6, roof: '#9aa0a4', truss: '#7a3a2a', col: '#8e9296' };
    freshHangar(g, S, H); front = { u: H.u1 + 1.0, v: 0, y: H.eave };
    for (const v of [-20.5, -17.6, -14.7, -8.9, -6.0, -3.1, 3.1, 6.0, 8.9, 14.7, 17.6, 20.5]) {
      const fish = Math.abs(v) > 12 ? v < 0 : v > 0;                                                  // рыбные ряды — в одном конце, овощные — в другом
      for (const u of [-7.1, -6.0]) tileCounter(u, v, true, fish ? 'fish' : 'veg');
      for (const u of [-1.4, -0.3]) tileCounter(u, v, true, fish ? 'veg' : 'fish');
    }
    for (const v of [-12, 12]) for (const u of [-6.55, -0.85]) tileCounter(u, v, false, 'veg');
    for (const v of [-6, -3.2, 4]) durianMat(7.6, v);
    umbrella(8.0, -17, '#d83a2a'); umbrella(8.0, 17, '#2a5ad8');
    scooterRow(g, k + 31, 7, D / 2 + 1.8, 8, 0, 0.85, Math.PI, LOT_Y);
    parkVehicle(g, pickupGeo('coconuts', '#3a8a5a'), 8.6, -21.5, 'v+', LOT_Y);
  }
  g.add(hotelMesh(S));
  B.finish(Wp(0, 0));
  // вывеска над краем крыши со стороны дороги: доска и надпись (с обеих сторон)
  // (над английской надписью — тайская, thai_text.js)
  { const T0 = sculptor(), len = 12, faces = [sculptor(), sculptor()];
    let th = 0; for (const T of faces) th = signLines(T, F.sign, len - 1.2, '#fff8e0', 0.08, 0.12);
    const bh = th + 0.5, yc = LOT_Y + front.y - 0.3 + bh / 2;
    T0.box(0.12, bh, len, front.u, yc, -front.v, '#2e6a4a'); T0.box(0.14, 0.08, len, front.u, yc + bh / 2 - 0.04, -front.v, '#f6d048'); T0.box(0.14, 0.08, len, front.u, yc - bh / 2 + 0.04, -front.v, '#f6d048');
    for (const z of [-len / 2 + 0.5, len / 2 - 0.5]) T0.box(0.1, 0.7, 0.1, front.u - 0.3, LOT_Y + front.y - 0.1, -front.v + z, '#3a3a3c');
    g.add(T0.mesh());
    faces.forEach((T, i) => { const t = T.mesh(); t.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }); t.rotation.y = (i ? -1 : 1) * Math.PI / 2; t.position.set(front.u, yc, -front.v); g.add(t); }); }
  vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 4 && p.x < U1 + 1 && Math.abs(p.z) < W / 2 + 5; }, { c: [s.x, s.z, Math.hypot(W, D) / 2 + 6] }));
  pavedAreas.push({ x: s.x, z: s.z, r2: (Math.hypot(W, D) / 2 + 4) ** 2, lift: LOT_Y + LOT_RISE,
    test: (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 1 && p.x < U1 && Math.abs(p.z) < W / 2 + 1; } });
  g.userData.c = new THREE.Vector3(s.x, 0, s.z); pierGroups.push(g);
  spotPlace(F.place, g, U1 + 5, 0, -1, 0);
}
function buildFreshMarkets() {
  if (!IS.fresh || !IS.fresh.length) return;
  IS.fresh.forEach(buildFreshMarket);
}
