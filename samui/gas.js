// Заправки Самуи — refs/gas_station. Семь настоящих точек OSM (selected.csv), пять сетей: PTT, Caltex, Esso, Shell, SUSCO.
// Место у дороги и поворот подбирает сборщик острова (ISLAND.gas). Станция: бетонная площадка, навес над островками
// с колонками (плоский — или три круглых «гриба», как у PTT на фото с Самуи), магазин позади, туалеты, стела с ценами.
// Оформление сетей — по фото из refs (PTT, Caltex, Esso, Shell); фото SUSCO нет — её цвета придуманы.
// Заправка взрывается (задание Влада): каждая колонка — как топливная колонка на аэродроме (шар 4 м), а следом рвёт
// всю станцию — GAS.BOOM: шар 20 м, навес разлетается, машину отбрасывает впятеро сильнее, чем от колонки.
// Оси станции: u — от магазина к дороге (локальный +X), v — влево (локальный −Z), y — от уровня площадки.
// Файл подключается после firestation.js (берёт signText, signGeo, mergeGeo, LOT_Y из stores.js, templeProp из temples.js).

const GAS = { W: 40, D: 24, PARK: 5, BOOM: 10 };         // вдоль дороги, вглубь, полоса у дороги — как в сборщике; радиус взрыва станции
const GAS_BRAND = {
  ptt:    { name: 'PTT',    fascia: '#f2f4f6', band: '#1d4f9c', line: '#e4202a', pump: '#1d5fb4', ink: '#1d4f9c', shop: 'CAFE AMAZON', shopCol: '#2f6a3a' },
  caltex: { name: 'CALTEX', fascia: '#f4f4f0', band: '#d8121c', line: '#0a5a6a', pump: '#c8141c', ink: '#0a5a6a', shop: 'STAR MART',   shopCol: '#d8121c' },
  esso:   { name: 'ESSO',   fascia: '#f6f6f2', band: '#e21a22', line: '#1a3f9a', pump: '#f0f0ec', ink: '#e21a22', shop: 'MINI MART',   shopCol: '#1a3f9a' },
  shell:  { name: 'SHELL',  fascia: '#f7d117', band: '#dd1d21', line: '#f2f2ee', pump: '#f2c81e', ink: '#dd1d21', shop: 'SELECT',      shopCol: '#dd1d21' },
  susco:  { name: 'SUSCO',  fascia: '#f4f2ec', band: '#e8451e', line: '#1c3f94', pump: '#e8451e', ink: '#1c3f94', shop: 'MINI MART',   shopCol: '#1c3f94' },
};
const gasNight = [];                                     // свет под навесами: [меш, станция]
const gasStations = [];                                  // { g, name, pumps, core, dead } — для проверок

// знак сети высотой s с серединой в (x, y) — в плоскости вывески (лицом к +Z)
function gasLogo(L, brand, x, y, z, s) {
  const B = GAS_BRAND[brand], r = s / 2;
  if (brand === 'ptt') { signDisc(L, x, y, z, r, '#1d4f9c', 14); signDisc(L, x - r * 0.12, y - r * 0.1, z + 0.01, r * 0.62, '#e4202a', 12); signDisc(L, x - r * 0.2, y - r * 0.2, z + 0.02, r * 0.3, '#f2f4f6', 10); }
  else if (brand === 'caltex') {
    signDisc(L, x, y, z, r, '#f4f4f0', 14);
    for (let k = 0; k < 5; k++) {
      const a = Math.PI / 2 + k * 1.2566, P = (t, q) => [x + Math.cos(t) * r * q, y + Math.sin(t) * r * q, z + 0.01];
      L.tri([x, y, z + 0.01], P(a - 0.6283, 0.36), P(a, 0.9), B.band); L.tri([x, y, z + 0.01], P(a, 0.9), P(a + 0.6283, 0.36), B.band);
    }
  } else if (brand === 'esso') { signRect(L, x, y, z, s * 1.7, s, '#1a3f9a'); signRect(L, x, y, z + 0.01, s * 1.55, s * 0.82, '#f6f6f2'); signText(L, 'ESSO', x, y, z + 0.02, s * 0.11, B.ink); }
  else if (brand === 'shell') {
    signDisc(L, x, y, z, r, '#dd1d21', 14); signDisc(L, x, y, z + 0.01, r * 0.84, '#f7d117', 14);
    for (let k = -2; k <= 2; k++) L.quad([x - 0.03 * s, y - r * 0.6, z + 0.02], [x + 0.03 * s, y - r * 0.6, z + 0.02], [x + k * r * 0.34 + 0.03 * s, y + r * 0.62, z + 0.02], [x + k * r * 0.34 - 0.03 * s, y + r * 0.62, z + 0.02], '#dd1d21');   // рёбра раковины
  } else { signRect(L, x, y, z, s, s, B.band); L.tri([x - r * 0.7, y - r * 0.6, z + 0.01], [x + r * 0.7, y - r * 0.6, z + 0.01], [x, y + r * 0.7, z + 0.01], '#f6d048'); L.tri([x - r * 0.3, y - r * 0.6, z + 0.02], [x + r * 0.3, y - r * 0.6, z + 0.02], [x, y - r * 0.05, z + 0.02], B.line); }
}
// колонка: коробка 0.5 × 1.0 × 2.0 в цвете сети, табло, пистолеты со шлангами с двух сторон. Стоит в начале координат.
function gasPump(brand) {
  const B = GAS_BRAND[brand], S = sculptor();
  S.box(0.6, 0.12, 1.1, 0, 0.06, 0, '#3a3a3c'); S.box(0.5, 1.25, 1.0, 0, 0.74, 0, B.pump); S.box(0.52, 0.5, 1.02, 0, 1.62, 0, '#f2f2ee'); S.box(0.56, 0.1, 1.06, 0, 1.92, 0, B.band);
  for (const s of [-1, 1]) {
    S.box(0.03, 0.3, 0.7, s * 0.27, 1.62, 0, '#16222a'); S.box(0.03, 0.08, 0.5, s * 0.275, 1.66, 0, '#9ae06a');     // табло с цифрами
    S.box(0.03, 0.34, 0.3, s * 0.265, 0.95, 0, B.line);                                                            // знак сети на дверце
    for (const z of [-0.36, 0.36]) { S.box(0.1, 0.3, 0.08, s * 0.3, 1.15, z, '#1c1c1e'); S.rod([s * 0.3, 1.02, z], [s * 0.36, 0.3, z * 0.6], 0.04, '#1c1c1e'); S.rod([s * 0.36, 0.3, z * 0.6], [s * 0.26, 0.8, 0], 0.04, '#1c1c1e'); }
  }
  return S;
}

// Постройки станции: body — площадка, островки, магазин, туалеты (остаются после взрыва); top — навес со столбами
// (разлетается); ruin — что от него остаётся; lit / topLit — светящиеся вывески. Возвращает и места колонок и столбов.
function gasStationParts(brand, kind) {
  const { W, D, PARK } = GAS, B = GAS_BRAND[brand], A = sculptor(), C = sculptor(), R = sculptor(), CONC = '#b4b2ab';
  const U0 = -D / 2 - 0.5, U1 = D / 2 + PARK, HV = W / 2 + 1, SH = 4.0, SF = -4, CH = 5.2;      // SF — фасад магазина; CH — низ навеса
  // площадка, борт, разметка проездов, люки подземных цистерн
  A.quad([U0, LOT_Y, -HV], [U1, LOT_Y, -HV], [U1, LOT_Y, HV], [U0, LOT_Y, HV], CONC);
  A.skirt(U0, U1, -HV, HV, LOT_Y, '#8e8c86', 0.4, 'b');
  for (let i = 0; i < 7; i++) { const u = U0 + 1 + i * (U1 - U0 - 2) / 6; A.quad([u, LOT_Y + 0.005, -HV], [u + 0.05, LOT_Y + 0.005, -HV], [u + 0.05, LOT_Y + 0.005, HV], [u, LOT_Y + 0.005, HV], '#a09e97'); }   // швы плит
  for (const [u, v] of [[-1.2, 15.5], [0.6, 15.5], [-1.2, 17.6]]) { A.tube(u, LOT_Y, LOT_Y + 0.03, -v, 0.55, 0.55, '#6a6c6e', 10); A.tube(u, LOT_Y + 0.03, LOT_Y + 0.05, -v, 0.2, 0.2, ['#d8281e', '#2a8a3a', '#e8c82a'][Math.round(u + v) % 3], 6); }
  // бордюр вдоль дороги между двумя въездами: красно-белый, за ним газон со стрижеными кустами (всё низкое — переезжается)
  for (let i = 0; i < 18; i++) A.box(0.3, 0.16, 1.0, U1 - 0.4, LOT_Y + 0.08, -8.5 + i, i % 2 ? '#f2f2ee' : '#d8281e');
  A.box(1.5, 0.12, 17.4, U1 - 1.3, LOT_Y + 0.06, 0, '#4f7a34');
  for (const v of [-6.5, -3.2, 0, 3.2, 6.5]) A.blob(U1 - 1.3, LOT_Y + 0.42, v, 0.55, 0.42, 0.75, v % 2 ? '#3d8a3a' : '#2f7a34', 7, 4);
  // магазин: стеклянный фасад, цветной фриз, козырёк; сбоку — холодильник со льдом и баллоны
  A.box(8.4, 0.6, 18.4, -8, -0.05, 0, '#c9c5bb'); A.box(8, SH, 18, -8, 0.25 + SH / 2, 0, '#eeebe2'); A.box(8.3, 0.25, 18.3, -8, 0.25 + SH + 0.12, 0, '#d2cfc6');
  storeGlass(A, SF + 0.02, 0.25, 2.7, 16, 8, '#35505c', 0);
  storeGoods(A, SF + 0.02, 0.6, 2.6, 15, 34, B.name.length * 31, ['#e8d24a', '#d84a3a', '#f2f2ee', '#3a8ad8', '#e88a2a', '#3a9a5a']);
  A.box(0.5, 1.0, 18.2, SF + 0.25, 0.25 + SH - 0.5, 0, B.shopCol); A.box(2.2, 0.12, 18.2, SF + 1.1, 0.25 + 3.0, 0, '#dcdad2');
  for (const v of [-8.6, 8.6]) A.box(0.14, 2.95, 0.14, SF + 2.1, 0.25 + 1.5, v, '#c3ccd2');
  A.box(0.8, 1.9, 1.5, SF + 0.6, 1.2, -6.5, '#e8eef4'); A.box(0.05, 0.5, 1.2, SF + 1.01, 1.7, -6.5, '#2a6ad8');
  for (const x of [-10, -7]) storeAC(A, x, 3.5, 9, 1);
  A.tube(-9, 0.25 + SH + 0.25, 0.25 + SH + 1.7, 4, 0.7, 0.7, '#8ea2b4', 8);
  // туалеты: отдельный домик слева, двери синяя и розовая
  A.box(4, 3.0, 4, -10, 1.75, -16, '#e4e0d6'); A.hip(-10, -16, 2.5, 2.5, 3.25, 0.3, 0.3, 4.1, (i) => i % 2 ? '#a85a40' : '#b8684a');
  A.box(0.08, 2.0, 0.9, -7.98, 1.25, -15, '#2a6ad8'); A.box(0.08, 2.0, 0.9, -7.98, 1.25, -17, '#d85a8a'); A.box(4.2, 0.5, 4.2, -10, 0, -16, '#c9c5bb');
  // островки с колонками: высокий бордюр в красно-белую полоску
  const isles = kind === 'mushroom' ? [[7, -10.5], [7, 0], [7, 10.5]] : [[4.5, -7], [4.5, 7], [9.5, -7], [9.5, 7]];
  const pumps = [], cols = [];
  for (const [u, v] of isles) {
    A.box(1.3, 0.2, 5.6, u, LOT_Y + 0.1, -v, '#d6d4cc');
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) A.box(0.06, 0.2, 0.93, u + s * 0.66, LOT_Y + 0.1, -v - 2.33 + i * 0.933, i % 2 ? '#f2f2ee' : '#d8281e');
    for (const e of [-1, 1]) { A.box(0.1, 0.9, 0.1, u - 0.4, LOT_Y + 0.65, -v + e * 2.6, '#e8c82a'); A.box(0.1, 0.9, 0.1, u + 0.4, LOT_Y + 0.65, -v + e * 2.6, '#e8c82a'); A.box(0.9, 0.1, 0.1, u, LOT_Y + 1.1, -v + e * 2.6, '#e8c82a'); }   // отбойные дуги
    pumps.push([u, v - 1.6], [u, v + 1.6]); cols.push([u, v]);
    R.box(1.2, 0.05, 5.4, u, LOT_Y + 0.22, -v, '#1c1a18');                                                         // гарь на островке
  }
  // навес
  const TL = [];
  if (kind === 'mushroom') {
    for (const [u, v] of cols) {
      C.tube(u, LOT_Y + 0.2, CH, -v, 0.42, 0.42, '#f2f4f6', 10); C.tube(u, LOT_Y + 0.2, LOT_Y + 1.4, -v, 0.46, 0.46, B.band, 10);
      C.lathe([[0.42, CH - 0.6], [1.4, CH - 0.1], [4.8, CH + 0.25], [4.8, CH + 0.5]], u, -v, '#e3ebf3', 16);
      C.lathe([[4.8, CH + 0.5], [4.85, CH + 0.5], [4.85, CH + 1.15], [4.8, CH + 1.15]], u, -v, B.band, 16); C.lathe([[4.86, CH + 0.56], [4.86, CH + 0.7]], u, -v, B.line, 16);
      C.lathe([[4.8, CH + 1.15], [0.05, CH + 1.3]], u, -v, '#c8ced4', 16);
      R.tube(u, LOT_Y + 0.2, LOT_Y + 1.3, -v, 0.42, 0.3, '#2a2624', 8);
    }
  } else {
    const cu = 7, hu = 6, hv = 14;
    C.box(2 * hu, 0.9, 2 * hv, cu, CH + 0.45, 0, B.fascia); C.box(2 * hu - 0.3, 0.06, 2 * hv - 0.3, cu, CH - 0.02, 0, '#e8e8e4');
    C.box(2 * hu + 0.08, 0.26, 2 * hv + 0.08, cu, CH + 0.2, 0, B.band); C.box(2 * hu + 0.1, 0.06, 2 * hv + 0.1, cu, CH + 0.4, 0, B.line);
    C.box(2 * hu + 0.1, 0.08, 2 * hv + 0.1, cu, CH + 0.94, 0, '#c8ced4');
    for (const [u, v] of cols) {
      C.box(0.5, CH - LOT_Y - 0.2, 0.5, u, (CH + LOT_Y + 0.2) / 2, -v, '#f2f2ee'); C.box(0.54, 1.2, 0.54, u, LOT_Y + 0.8, -v, B.band);
      for (const dv of [-3.5, 3.5]) C.box(0.9, 0.1, 1.6, u, CH - 0.07, -v + dv, '#fbfbf2');                          // светильники
      R.box(0.5, 0.8 + (u + v) % 0.7, 0.5, u, LOT_Y + 0.6, -v, '#2a2624', 0.1, 0.4);
    }
    // вывески на кромке навеса: к дороге и на оба торца
    { const T = sculptor(); gasLogo(T, brand, -7.2, 0, 0.02, 0.62); signText(T, B.name, -7.2 + 0.6 + signWidth(B.name, 0.11) / 2, 0, 0.02, 0.11, B.ink);
      gasLogo(T, brand, 7.2, 0, 0.02, 0.62); TL.push(signGeo(T, cu + hu + 0.06, CH + 0.62, 0, 'x')); }
    for (const f of ['z', '-z']) { const T = sculptor(); gasLogo(T, brand, -1.6, 0, 0.02, 0.62); signText(T, B.name, 0.8, 0, 0.02, 0.11, B.ink); TL.push(signGeo(T, cu, CH + 0.62, f === 'z' ? hv + 0.06 : -hv - 0.06, f)); }
  }
  // вывеска магазина
  { const T = sculptor(); signText(T, B.shop, 0, 0, 0.02, 0.13, '#f6f6f0'); gasLogo(T, brand, -7.6, 0, 0.02, 0.7); var shopLit = signGeo(T, SF + 0.52, 0.25 + SH - 0.5, 0, 'x'); }
  // стела с ценами (отдельный предмет): знак сети сверху, четыре строки цен
  const P = sculptor(), PL = [];
  for (const du of [-0.9, 0.9]) P.box(0.3, 3.2, 0.3, du, 1.6, 0, '#d8d8d4');
  P.box(2.5, 5.2, 0.44, 0, 5.6, 0, '#f2f2ee'); P.box(2.6, 0.2, 0.5, 0, 8.3, 0, B.band); P.box(2.6, 1.9, 0.48, 0, 7.2, 0, B.fascia); P.box(2.6, 0.14, 0.5, 0, 6.2, 0, B.band);
  for (const f of ['z', '-z']) {
    const T = sculptor(); gasLogo(T, brand, 0, 1.75, 0.02, 1.25); signText(T, B.name, 0, 0.82, 0.02, 0.075, B.ink);
    [['95', '38.45', '#e4202a'], ['91', '36.08', '#2a8a3a'], ['E20', '33.74', '#e8862a'], ['B7', '32.94', '#1d4f9c']].forEach(([n, p, c], i) => {
      const y = 0.1 - i * 0.66; signRect(T, -0.72, y, 0.02, 0.86, 0.5, c); signText(T, n, -0.72, y, 0.03, 0.062, '#f6f6f0'); signRect(T, 0.5, y, 0.02, 1.36, 0.5, '#16181c'); signText(T, p, 0.5, y, 0.03, 0.062, '#ffd84a');
    });
    PL.push(signGeo(T, 0, 5.45, f === 'z' ? 0.25 : -0.25, f));
  }
  return { body: A.mesh().geometry, top: C.mesh().geometry, ruin: R.mesh().geometry, topLit: TL.length ? mergeGeo(TL) : null, lit: shopLit,
    pole: P.mesh().geometry, poleLit: mergeGeo(PL), pumps, cols, kind, CH, lot: [U0, U1, HV] };
}

function buildGasStations() {
  if (!IS.gas || !IS.gas.length) return;
  const { W, D, PARK, BOOM } = GAS;
  const BODY = lambert({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a2824 }), SIGN = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const GLOW = new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const SHOPGLOW = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
  const pumpGeo = {};
  IS.gas.forEach((s, k) => {
    const P = gasStationParts(s.brand, s.kind), Bd = GAS_BRAND[s.brand], g = new THREE.Group(), ST = { g, name: s.name, pumps: [], core: null, dead: false };
    g.position.set(s.x, s.y + LOT_RISE, s.z); g.rotation.y = -s.az;
    scene.add(g);
    const top = new THREE.Group(), ruin = new THREE.Mesh(P.ruin, BODY);
    top.add(new THREE.Mesh(P.top, BODY)); if (P.topLit) top.add(new THREE.Mesh(P.topLit, SIGN));
    ruin.visible = false;
    g.add(new THREE.Mesh(P.body, BODY), new THREE.Mesh(P.lit, SIGN), top, ruin);
    // ночью: свет под навесом и в витрине магазина
    const lamp = (geo, x, y, z, mat, underTop) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.visible = false; g.add(m); gasNight.push([m, underTop ? ST : null]); };
    if (P.kind === 'mushroom') for (const [u, v] of P.cols) lamp(new THREE.LatheGeometry([[0.5, -0.67], [1.4, -0.17], [4.7, 0.18]].map(([r, y]) => new THREE.Vector2(r, y)), 16), u, P.CH, -v, GLOW, true);   // светится испод «гриба»
    else lamp(new THREE.PlaneGeometry(11.4, 27.4).rotateX(Math.PI / 2), 7, P.CH - 0.06, 0, GLOW, true);
    lamp(new THREE.PlaneGeometry(15.8, 2.6).rotateY(Math.PI / 2), -3.84, 1.6, 0, SHOPGLOW, false);
    g.updateMatrixWorld(true);
    const W3 = (u, v) => g.localToWorld(new THREE.Vector3(u, 0, -v));
    lotApron(g, P.lot[1], -P.lot[2], P.lot[2], LOT_Y, '#b4b2ab', 1, 0x2a2824);
    // твёрдое: магазин, туалеты; столбы навеса — пока навес цел
    wallBox(g, -8, 0, 8, 18); wallBox(g, -10, 16, 4, 4);
    const w0 = walls.length, s0 = solids.length;
    for (const [u, v] of P.cols) wallBox(g, u, v, P.kind === 'mushroom' ? 0.9 : 0.6, P.kind === 'mushroom' ? 0.9 : 0.6);
    const colWalls = walls.slice(w0), colSolids = solids.slice(s0);
    // колонки: каждая — разрушаемая и взрывается, как колонка на аэродроме
    const pg = pumpGeo[s.brand] || (pumpGeo[s.brand] = gasPump(s.brand).mesh().geometry);
    for (const [u, v] of P.pumps) {
      const m = new THREE.Mesh(pg, BODY), w = W3(u, v);
      m.position.set(u, LOT_Y + 0.2, -v); g.add(m); posts.push([w.x, w.z]);
      ST.pumps.push(addBreakable({ kind: 'small', mat: 'metal', x: w.x, z: w.z, r: 0.55, loss: 0.03, boom: 2,
        hide() { m.visible = false; },
        pieces(out) { const q = new THREE.Quaternion(); m.getWorldQuaternion(q); shatter(out, w.x, s.y + 1.2, w.z, 0.5, 2.0, 1.0, q, Bd.pump, 'metal', 1.6, 1.3); } }));
    }
    // станция целиком: рвётся следом за любой своей колонкой. Машина на неё не натыкается — в сетку столкновений она не входит.
    { const c = W3(7, 0), q = new THREE.Quaternion(); g.getWorldQuaternion(q);
      ST.core = { kind: 'tank', mat: 'metal', alive: true, keys: [], boom: BOOM, x: c.x, z: c.z, walls: colWalls,
        hide() {
          ST.dead = true; top.visible = false; ruin.visible = true;
          for (const sq of colSolids) { const i = solids.indexOf(sq); if (i >= 0) solids.splice(i, 1); }
          for (const [m, st] of gasNight) if (st === ST) m.visible = false;
        },
        pieces(out) {
          const y = s.y + P.CH + 0.5;
          if (P.kind === 'mushroom') for (const [u, v] of P.cols) { const w = W3(u, v); shatter(out, w.x, y, w.z, 9, 0.7, 9, q, Bd.fascia, 'metal', 2.5, 3); shatter(out, w.x, s.y + 2.6, w.z, 0.8, 5, 0.8, q, '#f2f4f6', 'metal', 1, 2); }
          else {
            for (const dv of [-9.5, -3.2, 3.2, 9.5]) { const w = W3(7, dv); shatter(out, w.x, y, w.z, 12, 0.9, 6.4, q, dv * dv > 40 ? Bd.band : Bd.fascia, 'metal', 2.5, 3.2); }
            for (const [u, v] of P.cols) { const w = W3(u, v); shatter(out, w.x, s.y + 2.6, w.z, 0.5, 5, 0.5, q, '#f2f2ee', 'metal', 1, 2); }
          }
        } };
      breakables.push(ST.core); }
    // стела с ценами у въезда — сбивается
    { const pole = new THREE.Group(), pu = P.lot[1] - 1.6, pv = (k % 2 ? 1 : -1) * (W / 2 - 1.2);
      pole.add(new THREE.Mesh(P.pole, BODY), new THREE.Mesh(P.poleLit, SIGN)); pole.position.set(pu, LOT_Y, -pv); g.add(pole);
      const w = W3(pu, pv); breakableObjects([pole], w.x, w.z, 1.0, 'pole', 0.1, 'metal'); posts.push([w.x, w.z]); }
    // мелочь: компрессор «воздух — вода», урны, конусы — разрушаемые
    templeProp(g, 14.5, (k % 2 ? -1 : 1) * 17.5, (S) => { S.box(0.5, 1.5, 0.6, 0, LOT_Y + 0.75, 0, '#2a6ad8'); S.box(0.52, 0.3, 0.62, 0, LOT_Y + 1.25, 0, '#f2f2ee'); S.tube(0.3, LOT_Y + 0.4, LOT_Y + 1.0, 0.2, 0.16, 0.16, '#1c1c1e', 6); }, { kind: 'small', color: '#2a6ad8', r: 0.4, loss: 0.03 });
    for (const v of [-9.8, 9.8]) templeProp(g, -3.3, v, (S) => { S.tube(0, LOT_Y, LOT_Y + 0.9, 0, 0.26, 0.3, '#3a6a4a', 7); }, { kind: 'small', color: '#3a6a4a', r: 0.3, loss: 0.02 });
    for (const [u, v] of P.kind === 'mushroom' ? [[7, 5.2], [7, -5.2]] : [[7, 0.9], [7, -0.9]]) templeProp(g, u, v, (S) => { S.box(0.42, 0.05, 0.42, 0, LOT_Y + 0.03, 0, '#e8632a'); S.tube(0, LOT_Y + 0.05, LOT_Y + 0.7, 0, 0.17, 0.03, '#e8632a', 6); S.tube(0, LOT_Y + 0.33, LOT_Y + 0.45, 0, 0.11, 0.09, '#f2f2ee', 6); }, { kind: 'small', color: '#e8632a', r: 0.25, loss: 0.02 });
    // машина у колонки и скутеры у магазина
    const sn = Math.round(Math.abs(s.x) + Math.abs(s.z));
    if (P.kind === 'mushroom') parkVehicle(g, parkedCar(sn), 4.4, 10.5, 'v+', LOT_Y);
    else parkVehicle(g, sn % 2 ? pickupGeo('empty', '#c8ccd0') : parkedCar(sn), 7, 7, sn % 4 < 2 ? 'v+' : 'v-', LOT_Y);
    scooterRow(g, sn, 2 + sn % 3, -2.6, 4.5, 0, 0.85, Math.PI, LOT_Y);
    vegKeepOut.push(Object.assign((x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > P.lot[0] - 4 && p.x < P.lot[1] + 1 && Math.abs(p.z) < P.lot[2] + 4; }, { c: [s.x, s.z, 40] }));
    pavedAreas.push({ x: s.x, z: s.z, r2: 40 * 40, lift: LOT_Y + LOT_RISE,
      test: (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > P.lot[0] && p.x < P.lot[1] && Math.abs(p.z) < P.lot[2]; } });
    g.userData.c = new THREE.Vector3(s.x, 0, s.z); pierGroups.push(g);
    const pv0 = P.pumps[P.pumps.length - 1];
    spotPlace('ЗАПРАВКА ' + s.name.toUpperCase() + ' ' + Bd.name, g, P.lot[1] + 4, pv0[1], -1, 0);     // с дороги, носом на колонку
    gasStations.push(ST);
  });
  airportAnim.push(() => { const on = skyNow.night > 0.3; for (const [m, st] of gasNight) { const v = on && !(st && st.dead); if (m.visible !== v) m.visible = v; } });
}
