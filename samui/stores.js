// Типовые магазины: MR.DIY и каннабис-шопы — refs/mr_diy, refs/cannabis_shop.
// Настоящих точек у них нет: места вдоль дорог подбирает сборщик острова (ISLAND.stores — у дороги, фасадом к ней,
// на площадке вровень с обочиной). MR.DIY — жёлтая коробка с красной надписью на жёлтом фризе, по одному в посёлке.
// Каннабис-шопы — четырёх видов, как на фото: стеклянный павильон с зелёным световым фризом, лавки в белом
// двухэтажном доме, ларёк с соломенным козырьком и барной стойкой, отдельное здание «ферма и диспансер».
// Названия шопов выдуманные. Вывески и неон светятся сами — и днём, и ночью; витрины загораются в темноте.
// Оси магазина: u — от здания к дороге (локальный +X), v — влево (локальный −Z), y — от уровня площадки.
// Файл подключается после temples.js (берёт оттуда templeProp) и только объявляет функции; игра зовёт buildStores().

const STORE = {                          // W — фасад, D — глубина, H — высота, PARK — площадка перед входом (как в сборщике)
  diy: { W: 22, D: 14, H: 5.2, PARK: 9 }, pavilion: { W: 10, D: 7, H: 3.8, PARK: 6.5 }, house: { W: 11, D: 9, H: 7.2, PARK: 6.5 },
  kiosk: { W: 6, D: 4, H: 3, PARK: 5.5 }, dispensary: { W: 24, D: 10, H: 7, PARK: 9 },
};
const WEED_NAMES = ['GREEN LEAF', 'HIGH TIDE', 'SAMUI WEED', 'GANJA HOUSE', 'ISLAND BUDS', 'KUSH CLUB', 'MARY JANE', 'HERB GARDEN', 'CHILL LEAF',
  '420 SHOP', 'BUD BAR', 'SATIVA', 'THAI STICK', 'COCO KUSH', 'HAPPY HERB', 'LAZY LEAF', 'SMOKE SPOT', 'INDICA'];
const NEON = '#5aff5a', LIME = '#b4f03c';
const LOT_Y = 0.08;                      // бетон площадки над началом осей постройки
const LOT_RISE = 0.09;                   // на столько вся постройка у дороги поднята над своей земляной площадкой: придорожная полоса земли
                                         // рисуется на 3 см выше асфальта (а он на 10–12 см выше площадки) — бетон должен лежать выше неё
let STORE_SIGN_MAT = null, STORE_GLOW_MAT = null;
const storeGlow = [];                    // витрины: светятся только ночью
const storeParts = {};                   // общая геометрия каждого вида — строится один раз

// ---------- детали вывесок (рисуются лицом к +Z, потом поворачиваются куда надо) ----------
// лист каннабиса: семь долей веером и черешок; (x, y) — основание, s — высота
function weedLeaf(S, x, y, z, s, color) {
  for (const [deg, len] of [[90, 1], [58, 0.86], [122, 0.86], [28, 0.62], [152, 0.62], [-8, 0.36], [188, 0.36]]) {
    const a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), L = len * s * 0.8, w = L * 0.13, P = (t, o) => [x + c * L * t - sn * w * o, y + s * 0.2 + sn * L * t + c * w * o, z];
    S.quad(P(0, 0), P(0.45, -1), P(1, 0), P(0.45, 1), color);
  }
  S.quad([x - s * 0.025, y + s * 0.2, z], [x + s * 0.025, y + s * 0.2, z], [x + s * 0.025, y, z], [x - s * 0.025, y, z], color);
}
// надпись с серединой в (x, y): пиксель px
const signText = (S, str, x, y, z, px, color) => S.text(str, x, y + 2.5 * px, z, px, color, 1);
// какой ширины выйдет надпись
const signWidth = (str, px) => hudWidth(hudText(str)) * px;
// прямоугольник-подложка
const signRect = (S, x, y, z, w, h, color) => S.quad([x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z], color);
// диск (многоугольник) в плоскости вывески
function signDisc(S, x, y, z, r, color, n = 12) { for (let i = 0; i < n; i++) { const a = i / n * 6.283, b = (i + 1) / n * 6.283; S.tri([x, y, z], [x + Math.cos(a) * r, y + Math.sin(a) * r, z], [x + Math.cos(b) * r, y + Math.sin(b) * r, z], color); } }
// готовую «плоскую» вывеску — на фасад (лицом к дороге, +X) или вдоль дороги (лицом к ±Z)
function signGeo(S, x, y, z, face = 'x') {
  const geo = S.mesh().geometry;
  if (face === 'x') geo.rotateY(Math.PI / 2); else if (face === '-z') geo.rotateY(Math.PI);
  geo.translate(x, y, z);
  return geo;
}
function mergeGeo(list) {                // склеить геометрии с цветом в вершинах в одну
  const pos = [], col = [];
  for (const g of list) { pos.push(...g.attributes.position.array); col.push(...g.attributes.color.array); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}
// ---------- общие детали построек ----------
// витрина: тёмное стекло в алюминиевых рамах во всю ширину w, с дверью посередине (или со сдвигом door)
function storeGlass(S, F, y0, h, w, n, glass = '#35505c', door = 0, alu = '#c3ccd2') {
  S.box(0.1, h, w, F + 0.03, y0 + h / 2, 0, glass);
  for (let i = 0; i <= n; i++) S.box(0.14, h + 0.1, 0.1, F + 0.05, y0 + h / 2, -w / 2 + w * i / n, alu);
  S.box(0.14, 0.1, w, F + 0.05, y0 + h, 0, alu); S.box(0.14, 0.12, w, F + 0.05, y0 + 0.06, 0, alu);
  S.box(0.13, Math.min(h - 0.2, 2.3), 1.9, F + 0.07, y0 + Math.min(h - 0.2, 2.3) / 2, door, '#24363e'); S.box(0.15, Math.min(h - 0.2, 2.3), 0.07, F + 0.08, y0 + Math.min(h - 0.2, 2.3) / 2, door, alu);
}
// товар за стеклом: пёстрые коробки на полках
function storeGoods(S, F, y0, y1, w, n, seed, pal, skip = 1.2) {
  const r = seededRandom(seed);
  for (let i = 0; i < n; i++) { const z = (r() - 0.5) * (w - 1), y = y0 + r() * (y1 - y0), a = 0.35 + r() * 0.6, b = 0.25 + r() * 0.45, c = pal[(r() * pal.length) | 0]; if (Math.abs(z) > skip) S.box(0.04, b, a, F + 0.1, y, z, c); }
}
// площадка перед магазином: бетон и линии стоянки
function storeLot(S, F, PARK, W, lines = true, color = '#a29f97') {
  const P0 = F + 0.3, P1 = F + PARK;
  S.quad([P0, LOT_Y, -W / 2 - 3], [P1, LOT_Y, -W / 2 - 3], [P1, LOT_Y, W / 2 + 3], [P0, LOT_Y, W / 2 + 3], color);
  S.skirt(P0, P1, -W / 2 - 3, W / 2 + 3, LOT_Y, '#8e8c86', 0.4, 'a');                             // борт: постройка поднята над землёй на LOT_RISE
  if (lines) for (let z = -W / 2 - 1; z <= W / 2 + 1.01; z += 2.6) S.quad([P1 - 4.2, LOT_Y + 0.01, z - 0.06], [P1 - 0.6, LOT_Y + 0.01, z - 0.06], [P1 - 0.6, LOT_Y + 0.01, z + 0.06], [P1 - 4.2, LOT_Y + 0.01, z + 0.06], '#e6e6e2');
}
// узкая парковка вдоль дороги (как у 7-Eleven, только в одну полосу): серый бетон, места размечены поперечными линиями —
// машины встают вдоль дороги. u0..u1 — от здания к дороге, hv — полуширина (кратна половине места BAY)
const BAY = 5.5, LOT_GREY = '#7c7b77';
// у каких каннабис-шопов есть парковка (около 40 %); у остальных площадки нет — трава до самого настила. У ларьков её нет никогда.
const WEED_PARKING = new Set(['INDICA', 'LAZY LEAF', 'HIGH TIDE', 'HERB GARDEN', 'THAI STICK', 'HAPPY HERB', 'ISLAND BUDS', 'BUD BAR']);
function storeStrip(S, u0, u1, hv) {
  S.quad([u0, LOT_Y, -hv], [u1, LOT_Y, -hv], [u1, LOT_Y, hv], [u0, LOT_Y, hv], LOT_GREY);
  S.skirt(u0, u1, -hv, hv, LOT_Y, '#6c6b67', 0.4, 'a');
  for (let z = -hv; z <= hv + 0.01; z += BAY) S.quad([u0 + 0.35, LOT_Y + 0.01, z - 0.07], [u1 - 0.35, LOT_Y + 0.01, z - 0.07], [u1 - 0.35, LOT_Y + 0.01, z + 0.07], [u0 + 0.35, LOT_Y + 0.01, z + 0.07], '#e6e6e2');
  S.quad([u0 + 0.3, LOT_Y + 0.01, -hv], [u0 + 0.44, LOT_Y + 0.01, -hv], [u0 + 0.44, LOT_Y + 0.01, hv], [u0 + 0.3, LOT_Y + 0.01, hv], '#e6e6e2');
  return [u0, u1, hv];
}
// пальма в кадке у входа
function potPalm(S, x, z, h = 1.5, pot = '#f2f0ea') {
  S.tube(x, 0.03, 0.55, z, 0.26, 0.34, pot, 7);
  for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + x, r = 0.55 + (k % 3) * 0.12; S.limb([x, 0.5, z], [x + Math.cos(a) * r * 0.5, 0.5 + h * (0.75 + (k % 2) * 0.25), z + Math.sin(a) * r * 0.5], 0.05, 0.03, '#2f7a34', 4);
    S.limb([x + Math.cos(a) * r * 0.5, 0.5 + h * (0.75 + (k % 2) * 0.25), z + Math.sin(a) * r * 0.5], [x + Math.cos(a) * r, 0.5 + h * 0.62, z + Math.sin(a) * r], 0.13, 0.02, k % 2 ? '#3d9a3a' : '#2f8a34', 4); }
}
// кондиционер на стене
const storeAC = (S, x, y, z, side = 1) => { S.box(0.9, 0.65, 0.34, x, y, z + side * 0.17, '#d8dade'); S.box(0.5, 0.45, 0.04, x - 0.1, y, z + side * 0.35, '#8e9296'); };

// ---------- MR.DIY ----------
function storeDiy() {
  const { W, D, H, PARK } = STORE.diy, F = D / 2, Y = '#f0b638', YD = '#dba208', RED = '#e4002b', A = sculptor();
  A.box(D + 0.6, 0.7, W + 0.6, 0, -0.05, 0, '#c9c5bb'); A.box(1.2, 0.15, 7, F + 0.9, 0.075, 0, '#c9c5bb');
  A.box(D, H, W, 0, 0.3 + H / 2, 0, '#f6e7b4'); A.box(0.14, H, W + 0.04, F + 0.02, 0.3 + H / 2, 0, Y);   // стены, жёлтый фасад
  A.box(D + 0.3, 0.3, W + 0.3, 0, 0.3 + H + 0.15, 0, YD);
  for (const z of [-W / 2 + 0.4, W / 2 - 0.4]) A.box(0.3, H, 0.8, F + 0.1, 0.3 + H / 2, z, Y);                   // пилоны по краям фасада
  storeGlass(A, F + 0.06, 0.3, 3.0, W - 2.6, 9, '#3a5460');
  storeGoods(A, F + 0.06, 0.7, 2.9, W - 3, 46, 301, ['#e8d24a', '#d84a3a', '#f2f2ee', '#3a8ad8', '#e88a2a', '#3a9a5a', '#d84a8a', '#8a5ad8']);
  A.box(0.5, 1.6, W - 1.2, F + 0.3, 0.3 + H - 0.95, 0, Y); A.box(0.54, 0.1, W - 1.2, F + 0.3, 0.3 + H - 1.78, 0, YD);   // фриз-короб
  A.box(0.3, 0.3, W - 3, F + 0.2, 0.3 + 3.25, 0, '#8e9296');                                                     // короб рольставен
  // у входа: стопки жёлтых корзин, вёдра, тележки с тазами
  for (let i = 0; i < 3; i++) A.box(0.5, 0.26, 0.4, F + 0.7, 0.45 + i * 0.27, 1.9, i % 2 ? '#f0c020' : '#e8b410');
  for (let i = 0; i < 4; i++) A.tube(F + 0.75 + (i % 2) * 0.5, 0.3, 0.75, -2.2 - Math.floor(i / 2) * 0.55, 0.2, 0.24, ['#2a6ad8', '#f2f2ee', '#d84a3a', '#2a6ad8'][i], 7);
  for (let i = 0; i < 4; i++) A.box(0.7, 0.1, 0.5, F + 0.8, 0.5 + i * 0.13, 4.6, ['#4ab85a', '#4a9ad8', '#e88a2a', '#4ab85a'][i]);
  A.box(0.75, 0.06, 0.55, F + 0.8, 0.4, 4.6, '#e86a1e'); for (const dz of [-0.2, 0.2]) A.box(0.04, 1.0, 0.04, F + 0.45, 0.85, 4.6 + dz, '#e86a1e');
  for (const x of [-3.5, 0.5, 3.5]) storeAC(A, x, 3.6, W / 2, 1);
  A.box(0.12, 3.4, 4.2, -F - 0.03, 0.3 + 1.7, -4, '#9aa0a4'); for (let y = 0.6; y < 3.4; y += 0.4) A.box(0.14, 0.04, 4.2, -F - 0.04, 0.3 + y, -4, '#7e868c');   // ворота склада сзади
  A.box(0.12, 2.1, 1.0, -F - 0.03, 0.3 + 1.05, 3, '#6a7278'); A.box(1.6, 1.2, 1.2, -F - 0.9, 0.9, 7, '#3a6a4a');                                        // дверь, мусорный бак
  // круглый знак на кронштейне у угла
  A.rod([F + 0.1, 4.3, -W / 2 + 0.6], [F + 1.5, 4.3, -W / 2 + 0.6], 0.08, '#8e9296');
  A.blob(F + 1.6, 3.7, -W / 2 + 0.6, 0.62, 0.62, 0.07, RED, 12, 4); A.blob(F + 1.6, 3.7, -W / 2 + 0.6, 0.52, 0.52, 0.09, Y, 12, 4); A.blob(F + 1.6, 3.8, -W / 2 + 0.6, 0.2, 0.24, 0.11, '#b87a3a', 8, 4);
  storeLot(A, F, PARK, W);
  const lot = [F + 0.3, F + PARK, W / 2 + 3];
  // надписи на фризе: красное «MR.D.I.Y.» и слоган
  const L = sculptor();
  signRect(L, 0, 0, 0, W - 1.2, 1.6, '#f4bc3a');
  signText(L, 'MR.D.I.Y.', -4.6, 0, 0.02, 0.2, RED); signText(L, 'MR.D.I.Y.', -4.57, -0.03, 0.01, 0.2, '#7a0018');
  signText(L, 'ALWAYS LOW PRICES', 4.0, -0.02, 0.02, 0.105, '#2a1a10');
  signDisc(L, -8.9, 0, 0.02, 0.55, RED); signDisc(L, -8.9, 0, 0.03, 0.44, '#f6d048'); signText(L, 'DIY', -8.9, 0, 0.04, 0.07, RED);
  const lit = signGeo(L, F + 0.57, 0.3 + H - 0.95, 0);
  // стела у дороги: жёлтый короб на столбе
  const P = sculptor(); P.tube(0, 0, 6.2, 0, 0.2, 0.16, '#d8d8d4', 8); P.box(2.6, 1.3, 0.34, 0, 6.9, 0, Y); P.box(2.7, 0.1, 0.38, 0, 7.58, 0, YD); P.box(2.7, 0.1, 0.38, 0, 6.22, 0, YD);
  const pl = ['z', '-z'].map((f) => { const T = sculptor(); signText(T, 'MR.DIY', 0, 0.12, 0.18, 0.12, RED); signText(T, 'LOW PRICES', 0, -0.36, 0.18, 0.045, '#2a1a10'); return signGeo(T, 0, 6.9, 0, f); });
  return { body: A.mesh().geometry, lit, pole: P.mesh().geometry, poleLit: mergeGeo(pl), glass: [W - 2.8, 2.8, 1.75], frieze: null, lot };
}

// ---------- каннабис-шоп: стеклянный павильон с зелёным световым фризом ----------
function storePavilion() {
  const { W, D, H, PARK } = STORE.pavilion, F = D / 2, A = sculptor();
  A.box(D + 0.4, 0.65, W + 0.4, 0, -0.075, 0, '#c9c5bb'); A.box(2.6, 0.6, W + 1.6, F + 1.3, -0.1, 0, '#785a40');        // цоколь, дощатая терраса (уходят в землю)
  A.box(D, H, W, 0, 0.25 + H / 2, 0, '#f2f0ea'); A.box(D + 0.2, 0.2, W + 0.2, 0, 0.25 + H + 0.1, 0, '#dcdad2');
  storeGlass(A, F + 0.02, 0.25, 2.6, W - 0.8, 5, '#2c424c', 1.6);
  storeGoods(A, F + 0.02, 0.6, 2.4, W - 1.4, 16, 77, ['#e8a23a', '#d8c84a', '#4a9a5a', '#f2f2ee', '#c85a8a'], 0);
  A.box(0.5, 1.1, W + 0.5, F + 0.22, 0.25 + H - 0.4, 0, '#3aa83e'); A.box(D * 0.55, 1.1, 0.4, F - D * 0.27, 0.25 + H - 0.4, -W / 2 - 0.05, '#3aa83e');   // короб фриза по фасаду и углу
  A.rod([F + 0.2, 0.25 + H + 0.9, W / 2 - 0.5], [F + 1.3, 0.25 + H + 0.9, W / 2 - 0.5], 0.07, '#2a2a2c'); A.blob(F + 1.3, 0.25 + H + 0.35, W / 2 - 0.5, 0.52, 0.52, 0.08, '#f2f0ea', 12, 4);   // круглая вывеска на кронштейне
  for (const z of [-W / 2 + 0.3, -1.6, 3.6, W / 2 - 0.2]) potPalm(A, F + 1.9, z, 1.3 + (z > 0 ? 0.3 : 0));
  A.box(0.9, 0.7, 0.9, F + 0.9, 0.55, -3.9, '#7a5a3a'); for (const dz of [-0.9, 0.9]) A.box(0.5, 0.45, 0.5, F + 0.9, 0.42, -3.9 + dz, '#2a2a2c');    // столик и табуреты на террасе
  storeAC(A, -1, 2.6, W / 2, 1);
  const Lt = sculptor(), lot = storeStrip(Lt, F + 2.6, F + PARK, BAY);                            // узкая парковка на два места вдоль дороги — отдельной геометрией: она есть не у всех
  return { body: A.mesh().geometry, glass: [W - 1, 2.4, 1.5], frieze: null, lot, lotGeo: Lt.mesh().geometry,
    lit(name) {                                                       // свой для каждого шопа: название на фризе
      const L = sculptor(), wv = W + 0.5;
      signRect(L, 0, 0, 0, wv, 1.1, LIME);
      const px = Math.min(0.13, (wv - 3.2) / hudWidth(hudText(name)));
      signText(L, name, 0, 0.02, 0.02, px, '#0a5a8a'); weedLeaf(L, -wv / 2 + 0.75, -0.42, 0.02, 0.85, '#1a8a2a'); weedLeaf(L, wv / 2 - 0.75, -0.42, 0.02, 0.85, '#1a8a2a');
      const front = signGeo(L, F + 0.48, 0.25 + H - 0.4, 0);
      const N = sculptor(); weedLeaf(N, 0, -0.5, 0, 1.15, NEON); const leaf = signGeo(N, F + 0.1, 1.7, 2.6 - 4.2);      // неоновый лист в окне
      const O = sculptor(); signText(O, 'OPEN', 0, 0, 0, 0.07, '#ff5ab0'); for (const [x, y, w, h] of [[0, 0.3, 1.5, 0.04], [0, -0.3, 1.5, 0.04], [-0.75, 0, 0.04, 0.64], [0.75, 0, 0.04, 0.64]]) signRect(O, x, y, 0, w, h, '#4aa8ff');
      const open = signGeo(O, F + 0.1, 2.25, -3.2);
      const out = [front, leaf, open];
      for (const f of ['z', '-z']) { const R = sculptor(); signDisc(R, 0, 0, 0.1, 0.46, '#f8f8f0'); weedLeaf(R, 0, -0.34, 0.11, 0.68, '#1a8a2a'); out.push(signGeo(R, F + 1.3, 0.25 + H + 0.35, W / 2 - 0.5, f)); }
      return mergeGeo(out);
    } };
}

// ---------- каннабис-шоп: две лавки в белом двухэтажном доме ----------
function storeHouse() {
  const { W, D, H, PARK } = STORE.house, F = D / 2, A = sculptor(), WH = '#f1efe8';
  A.box(D + 0.4, 0.65, W + 0.4, 0, -0.075, 0, '#c9c5bb'); A.box(2.4, 0.6, W + 0.4, F + 1.2, -0.1, 0, '#a8a398');
  A.box(D, H, W, 0, 0.25 + H / 2, 0, WH); A.box(D + 0.3, 0.25, W + 0.3, 0, 0.25 + H + 0.12, 0, '#d9d6cf');
  // первый этаж: две лавки со стеклянными дверями
  for (const s of [-1, 1]) {
    const zc = s * W / 4;
    A.box(0.1, 2.5, W / 2 - 0.9, F + 0.03, 0.25 + 1.3, zc, s > 0 ? '#2c3c44' : '#3a4a3a');
    for (const dz of [-(W / 4 - 0.45), -0.6, 0.6, W / 4 - 0.45]) A.box(0.14, 2.6, 0.08, F + 0.05, 0.25 + 1.3, zc + dz, '#e8e8e4');
    A.box(0.14, 0.1, W / 2 - 0.9, F + 0.05, 0.25 + 2.55, zc, '#e8e8e4');
  }
  A.box(0.3, 3.2, 0.5, F + 0.05, 0.25 + 1.6, 0, WH);                                                                       // простенок между лавками
  storeGoods(A, F + 0.02, 0.7, 2.3, W - 1.6, 14, 55, ['#d8c84a', '#4a9a5a', '#f2f2ee', '#e88a2a'], 0.4);
  // козырёк на столбах, второй этаж с окнами
  A.box(2.6, 0.22, W + 0.3, F + 1.3, 0.25 + 3.45, 0, WH); for (const z of [-W / 2 + 0.3, 0, W / 2 - 0.3]) A.box(0.26, 3.3, 0.26, F + 2.4, 0.25 + 1.7, z, '#6a5a4a');
  for (const z of [-3.4, 0, 3.4]) { A.box(0.1, 1.5, 1.7, F + 0.03, 0.25 + 5.3, z, '#3c5560'); A.box(0.14, 1.6, 0.08, F + 0.05, 0.25 + 5.3, z, '#e8e8e4'); A.box(0.16, 0.1, 1.9, F + 0.06, 0.25 + 4.5, z, '#d9d6cf'); }
  A.box(0.08, 0.9, W, F + 2.55, 0.25 + 4.0, 0, '#d9d6cf');                                                                  // парапет над козырьком
  for (const x of [-2, 1.5]) storeAC(A, x, 5.0, W / 2, 1);
  A.tube(-1.5, 0.25 + H + 0.25, 0.25 + H + 1.5, -2, 0.6, 0.6, '#8ea2b4', 8);
  A.box(0.1, 2.1, 1.0, -F - 0.03, 0.25 + 1.05, 2.5, '#6a5a4a'); for (const z of [-3, 0.5, 3.4]) { A.box(0.1, 1.2, 1.2, -F - 0.03, 0.25 + 5.3, z, '#3c5560'); A.box(0.14, 0.1, 1.4, -F - 0.05, 0.25 + 4.65, z, '#d9d6cf'); }   // задняя стена: дверь, окна                                                 // бак с водой на крыше
  // вывески-коробы над лавками (сами надписи — в светящейся части)
  A.box(0.3, 1.1, W / 2 - 0.5, F + 2.7, 0.25 + 4.05, W / 4, '#e8782a'); A.box(0.3, 1.1, W / 2 - 0.5, F + 2.7, 0.25 + 4.05, -W / 4, '#f4f4f0');
  // пальмы в кадках, штендер, ряд зелёных пластиковых кресел
  potPalm(A, F + 1.9, -W / 2 + 0.6, 1.2, '#b85a3a'); potPalm(A, F + 1.9, 0.5, 1.5, '#b85a3a');
  for (let i = 0; i < 4; i++) { const z = 2.0 + i * 0.75; A.box(0.5, 0.08, 0.55, F + 1.5, 0.62, z, '#2a9a5a'); A.box(0.08, 0.6, 0.55, F + 1.26, 0.9, z, '#2a9a5a'); for (const dx of [-0.2, 0.2]) A.box(0.05, 0.42, 0.5, F + 1.5 + dx, 0.41, z, '#3a3a3c'); }
  const Lt = sculptor(), lot = storeStrip(Lt, F + 2.4, F + PARK, BAY);
  return { body: A.mesh().geometry, glass: [W - 1.2, 2.3, 1.5], frieze: null, lot, lotGeo: Lt.mesh().geometry,
    lit(name) {
      const hw = W / 2 - 0.5, O = sculptor();
      signRect(O, 0, 0, 0, hw, 1.1, '#f08a2a'); signText(O, name, 0.3, 0.05, 0.02, Math.min(0.1, (hw - 1.3) / hudWidth(hudText(name))), '#fff8e0'); weedLeaf(O, -hw / 2 + 0.5, -0.4, 0.02, 0.8, '#1a7a2a');
      const B = sculptor();
      signRect(B, 0, 0, 0, hw, 1.1, '#fafaf4'); signText(B, 'CANNABIS', 0.3, 0.22, 0.02, 0.085, '#1a6a2a'); signText(B, 'GANJA WEED HEMP', 0.3, -0.3, 0.02, 0.038, '#3a3a3a');
      signDisc(B, -hw / 2 + 0.55, 0, 0.02, 0.42, '#1a7a2a'); weedLeaf(B, -hw / 2 + 0.55, -0.3, 0.03, 0.6, '#fafaf4');
      const N = sculptor(); weedLeaf(N, 0, -0.45, 0, 1.0, NEON);
      const out = [signGeo(O, F + 2.86, 0.25 + 4.05, W / 4), signGeo(B, F + 2.86, 0.25 + 4.05, -W / 4), signGeo(N, F + 0.1, 1.7, -W / 4 - 1.4)];
      const C = sculptor(); signRect(C, 0, 0, 0, 0.3, 0.9, '#3ad24a'); signRect(C, 0, 0, 0, 0.9, 0.3, '#3ad24a'); out.push(signGeo(C, F + 0.1, 5.3 + 0.25, 1.7));   // зелёный крест на втором этаже, между окнами
      return mergeGeo(out);
    } };
}

// Бренды ларьков: архитектура одна, оформление разное (просил Влад) — где «аптечное» (белое или бирюзовое, зелёный
// крест), где яркое рекламное; щит у дороги у каждого своей формы. board — фон щита у ларька, ink — буквы,
// accent — лист или крест, sub — подпись, pylon — форма щита у дороги, sign — его цвета [фон, рисунок], flag — флаг.
const KIOSK_BRAND = {
  'SAMUI WEED': { med: true, board: '#2f6a70', ink: '#e8f4f0', accent: '#8af0b0', sub: 'PREMIUM CANNABIS', pylon: 'board', flag: ['#f4f4ee', '#2a9a3a'] },
  'MARY JANE': { board: '#e8388a', ink: '#ffe640', accent: '#ffffff', sub: 'GOOD VIBES ONLY', pylon: 'disc', sign: ['#ffe640', '#e8388a'], flag: ['#e8388a', '#ffe640'] },
  '420 SHOP': { rasta: true, board: '#1c1c1e', ink: '#f6d048', accent: '#3ad24a', sub: 'HAPPY HOUR 4:20', pylon: 'tall', sign: ['#1c1c1e', '#f6d048'], flag: ['#2a9a3a', '#f6d048'] },
  'COCO KUSH': { med: true, board: '#f6f6f0', ink: '#1a6a2a', accent: '#2aa84a', sub: 'MEDICAL CANNABIS', pylon: 'cross', flag: ['#f4f4ee', '#2aa84a'] },
  'SMOKE SPOT': { board: '#6a2ab8', ink: '#ff9a2a', accent: '#40e0d0', sub: 'BEST BUDS 200 BAHT', pylon: 'arrow', sign: ['#ff8a1e', '#6a2ab8'], flag: ['#ff8a1e', '#6a2ab8'] },
};
const kioskBrand = (name) => KIOSK_BRAND[name] || KIOSK_BRAND['SAMUI WEED'];
// щит ларька у дороги: столб и знак своей формы (читается с обеих сторон дороги)
const kioskPylons = {};
function kioskPylon(name) {
  if (kioskPylons[name]) return kioskPylons[name];
  const Bd = kioskBrand(name), P = sculptor(), POLE = '#8e9296';
  if (Bd.pylon === 'board') return kioskPylons[name] = weedPylon();
  const two = (draw) => mergeGeo(['z', '-z'].map((f) => { const T = sculptor(); draw(T); return signGeo(T, 0, 0, 0, f); }));
  let lit;
  if (Bd.pylon === 'cross') {                                          // «аптека»: белый квадрат с зелёным крестом
    P.tube(0, 0, 3.4, 0, 0.09, 0.07, POLE, 6); P.box(1.5, 1.5, 0.16, 0, 3.9, 0, '#f8f8f2'); P.box(1.6, 0.08, 0.2, 0, 4.68, 0, '#2aa84a'); P.box(1.6, 0.08, 0.2, 0, 3.12, 0, '#2aa84a');
    lit = two((T) => { signRect(T, 0, 4.05, 0.09, 0.36, 0.95, '#2aa84a'); signRect(T, 0, 4.05, 0.09, 0.95, 0.36, '#2aa84a'); weedLeaf(T, 0, 3.86, 0.1, 0.4, '#f8f8f2'); signText(T, 'MEDICAL', 0, 3.32, 0.09, 0.04, '#1a6a2a'); });
  } else if (Bd.pylon === 'disc') {                                    // круглая вывеска
    P.tube(0, 0, 3.2, 0, 0.09, 0.07, POLE, 6); P.blob(0, 4.0, 0, 0.95, 0.95, 0.09, Bd.sign[1], 14, 4);
    lit = two((T) => { signDisc(T, 0, 4.0, 0.1, 0.84, Bd.sign[0], 16); weedLeaf(T, 0, 3.85, 0.11, 0.62, Bd.sign[1]); signText(T, name, 0, 3.62, 0.11, Math.min(0.045, 1.2 / hudWidth(hudText(name))), Bd.sign[1]); });
  } else if (Bd.pylon === 'tall') {                                    // высокий узкий короб: цифры столбиком, растаманские полосы
    P.tube(0, 0, 1.6, 0, 0.1, 0.08, POLE, 6); P.box(1.0, 3.0, 0.2, 0, 3.1, 0, Bd.sign[0]);
    lit = two((T) => { [...'420'].forEach((ch, i) => signText(T, ch, 0, 3.7 - i * 0.62, 0.11, 0.1, Bd.sign[1]));
      for (const [y, c] of [[4.42, '#e8382a'], [4.28, '#f6d048'], [4.14, '#2a9a3a'], [1.78, '#2a9a3a'], [1.92, '#f6d048'], [2.06, '#e8382a']]) signRect(T, 0, y, 0.11, 0.9, 0.13, c); });
  } else {                                                             // стрела, указывающая на ларёк
    P.tube(0, 0, 3.0, 0, 0.09, 0.07, POLE, 6); P.box(2.0, 0.9, 0.16, 0.25, 3.45, 0, Bd.sign[0]);
    for (const z of [-0.08, 0.08]) P.tri([-0.75, 4.15, z], [-0.75, 2.75, z], [-1.6, 3.45, z], Bd.sign[0]);
    for (const [a, b] of [[4.15, 3.45], [2.75, 3.45]]) P.quad([-0.75, a, -0.08], [-0.75, a, 0.08], [-1.6, b, 0.08], [-1.6, b, -0.08], Bd.sign[0]);
    lit = mergeGeo(['z', '-z'].map((f) => { const T = sculptor(), sx = f === 'z' ? 1 : -1; signText(T, name, sx * 0.3, 3.56, 0.09, Math.min(0.055, 1.8 / hudWidth(hudText(name))), Bd.sign[1]); signText(T, 'OPEN', sx * 0.3, 3.2, 0.09, 0.04, '#fff4e0'); return signGeo(T, 0, 0, 0, f); }));
  }
  return kioskPylons[name] = { pole: P.mesh().geometry, poleLit: lit };
}

// ---------- каннабис-шоп: ларёк с соломенным козырьком и барной стойкой ----------
function storeKiosk() {
  const { W, D, H, PARK } = STORE.kiosk, F = D / 2, Dk = sculptor(), A = sculptor(), WOOD = '#6a4a2e', TH = ['#b89858', '#a88848', '#c8a868'];
  Dk.box(D + 1.6, 0.58, W + 0.6, 0.6, -0.11, 0, '#785a40');                                                                  // дощатый настил (уходит в землю) — он остаётся, когда ларёк разнесён
  A.box(2.0, 2.7, 3.0, -0.6, 0.18 + 1.35, 1.2, '#efe6d2'); A.box(2.1, 0.12, 3.1, -0.6, 2.95, 1.2, WOOD);                    // будка
  A.box(0.1, 1.5, 2.6, 0.42, 1.9, 1.2, '#2a2420');                                                                           // проём с полками
  for (let r = 0; r < 3; r++) { A.box(0.2, 0.05, 2.5, 0.32, 1.35 + r * 0.42, 1.2, WOOD); for (let i = 0; i < 6; i++) A.tube(0.34, 1.38 + r * 0.42, 1.62 + r * 0.42, 0.15 + i * 0.4, 0.09, 0.09, ['#d8c84a', '#8ab84a', '#c8a03a'][(i + r) % 3], 5); }
  A.box(0.6, 0.1, 3.2, 0.75, 1.15, 1.2, WOOD); A.box(0.1, 1.0, 3.1, 0.5, 0.65, 1.2, '#8a6a4a');                             // стойка
  // соломенный козырёк: два ряда лохматой кровли
  for (let i = 0; i < 9; i++) { const z = -0.3 + i * 0.38, k = i % 3;
    A.quad([0.4, 3.0, z], [0.4, 3.0, z + 0.4], [1.9, 2.35 - k * 0.04, z + 0.4], [1.9, 2.35 - k * 0.04, z], TH[k]); A.quad([1.2, 2.72, z], [1.2, 2.72, z + 0.4], [2.2, 2.2 - k * 0.06, z + 0.4], [2.2, 2.2 - k * 0.06, z], TH[(k + 1) % 3]); }
  for (const z of [-0.3, 3.1]) A.box(0.1, 2.4, 0.1, 1.8, 1.2, z, WOOD);
  // щит-экран слева: тёмно-бирюзовый, название — в светящейся части
  A.box(0.16, 2.3, 2.7, -0.2, 0.18 + 1.75, -1.75, '#274a4e'); for (const z of [-3.0, -0.5]) A.box(0.12, 3.0, 0.12, -0.2, 1.5, z, '#2a2a2c');
  potPalm(Dk, 1.4, -2.6, 1.3, '#3a3a3c');
  return { body: Dk.mesh().geometry, stall: A.mesh().geometry, glass: null, frieze: null, kiosk: true, lot: null,   // бетонной площадки у ларька нет — только дощатый настил
    lit(name) {
      const Bd = kioskBrand(name), L = sculptor(); signRect(L, 0, 0, 0, 2.5, 2.1, Bd.board);
      const px = Math.min(0.085, 2.1 / hudWidth(hudText(name)));
      if (Bd.med) { signRect(L, 0, 0.66, 0.02, 0.17, 0.5, Bd.accent); signRect(L, 0, 0.66, 0.02, 0.5, 0.17, Bd.accent); } else weedLeaf(L, 0, 0.44, 0.02, 0.56, Bd.accent);
      signText(L, name, 0, 0.2, 0.02, px, Bd.ink); signRect(L, 0, -0.06, 0.02, 1.9, 0.025, Bd.ink);
      signText(L, Bd.sub, 0, -0.28, 0.02, Math.min(0.034, 2.2 / hudWidth(hudText(Bd.sub))), Bd.ink);
      if (Bd.rasta) for (const [y, c] of [[-0.62, '#e8382a'], [-0.78, '#f6d048'], [-0.94, '#2a9a3a']]) signRect(L, 0, y, 0.02, 2.5, 0.16, c);
      else signText(L, Bd.med ? 'OPEN DAILY' : 'OPEN 24/7', 0, -0.62, 0.02, 0.04, Bd.accent);
      const out = [signGeo(L, -0.1, 0.18 + 1.75, -1.75)];
      const B = sculptor(); for (let i = 0; i < 10; i++) signRect(B, -1.6 + i * 0.36, (i % 2) * 0.05, 0, 0.1, 0.12, i % 3 ? '#ffe9a0' : '#ff8ad0'); out.push(signGeo(B, 2.22, 2.12, 1.4));   // гирлянда лампочек по краю козырька
      const N = sculptor(); weedLeaf(N, 0, -0.3, 0, 0.7, NEON); out.push(signGeo(N, 0.5, 2.45, 2.2));
      return mergeGeo(out);
    } };
}

// ---------- каннабис-шоп: отдельное здание «ферма и диспансер» ----------
function storeDispensary(grey) {                                     // grey — бетон площадки серый, как асфальт парковки (иначе светлый)
  const { W, D, H, PARK } = STORE.dispensary, F = D / 2, A = sculptor(), CR = '#ece4d0', BAND = '#5d7a5c', CONC = grey ? LOT_GREY : '#a29f97';
  A.box(D + 0.4, 0.7, W + 0.4, 0, -0.05, 0, '#c9c5bb');
  A.skirt(F + 0.4, F + PARK, -W / 2 - 3, W / 2 + 3, LOT_Y, '#8e8c86', 0.4, 'a');
  A.box(D, H, W, 0, 0.3 + H / 2, 0, CR); A.box(D + 0.8, 0.14, W + 0.8, -0.1, 0.3 + H + 0.25, 0, '#9aa0a4', 0.03);          // стены, пологая металлическая крыша
  A.box(0.5, 0.95, W + 0.3, F + 0.2, 0.3 + 3.75, 0, BAND);                                                                    // зелёный пояс с надписями
  // первый этаж: слева глухая стена с двумя окошками, дальше — остекление с белыми жалюзи, дверь по центру
  for (const z of [9.2, 7.2]) { A.box(0.1, 0.9, 1.1, F + 0.03, 0.3 + 1.7, z, '#3c5560'); A.box(0.14, 1.0, 0.07, F + 0.05, 0.3 + 1.7, z, '#f4f4f0'); }
  for (const [zc, w] of [[4.2, 4.4], [-3.0, 4.4], [-8.6, 4.6]]) {
    A.box(0.1, 2.6, w, F + 0.03, 0.3 + 1.4, zc, '#e4e8ea'); for (let y = 0.5; y < 2.6; y += 0.22) A.box(0.12, 0.05, w, F + 0.05, 0.3 + y, zc, '#c4ccd0');
    for (let i = 0; i <= Math.round(w / 1.2); i++) A.box(0.14, 2.7, 0.07, F + 0.06, 0.3 + 1.4, zc - w / 2 + w * i / Math.round(w / 1.2), '#f4f4f0');
  }
  A.box(0.12, 2.4, 1.8, F + 0.05, 0.3 + 1.2, 0.6, '#24363e'); A.box(0.14, 2.4, 0.07, F + 0.07, 0.3 + 1.2, 0.6, '#f4f4f0');
  for (const z of [-7, -1, 5]) { A.box(0.34, 0.65, 0.9, F + 0.17, 0.3 + 5.6, z, '#d8dade'); A.box(0.04, 0.45, 0.5, F + 0.35, 0.3 + 5.6, z - 0.1, '#8e9296'); }   // кондиционеры на стене второго этажа
  // перед зданием: искусственный газон, дорожка, столик со стульями, стела со стрелкой и знак «P»
  A.quad([F + 0.4, LOT_Y + 0.005, -9.5], [F + 5.6, LOT_Y + 0.005, -9.5], [F + 5.6, LOT_Y + 0.005, 3.5], [F + 0.4, LOT_Y + 0.005, 3.5], '#4aa83a');
  A.quad([F + 0.4, LOT_Y + 0.01, -0.3], [F + 5.6, LOT_Y + 0.01, -0.3], [F + 5.6, LOT_Y + 0.01, 1.5], [F + 0.4, LOT_Y + 0.01, 1.5], '#cfc9bb');
  A.box(0.7, 0.72, 0.7, F + 1.6, 0.36, 9.6, '#2a2a2c'); for (const dz of [-0.8, 0.8]) A.box(0.45, 0.8, 0.45, F + 1.6, 0.4, 9.6 + dz, '#2a2a2c');
  A.box(0.3, 2.6, 0.9, F + 6.2, 1.3, -4.2, '#24303a'); A.box(0.08, 1.0, 0.08, F + 6.2, 0.5, -6.4, '#8e9296'); A.box(0.06, 0.6, 0.6, F + 6.2, 1.3, -6.4, '#2a5ad8');
  storeLot(A, F + 5.2, PARK - 5.2, W, false, CONC);
  A.quad([F + 0.4, LOT_Y + 0.005, 3.6], [F + PARK, LOT_Y + 0.005, 3.6], [F + PARK, LOT_Y + 0.005, W / 2 + 3], [F + 0.4, LOT_Y + 0.005, W / 2 + 3], grey ? LOT_GREY : '#9a9a94');     // стоянка справа от газона
  for (let z = 5; z < W / 2 + 2; z += 2.7) A.quad([F + 1, LOT_Y + 0.015, z - 0.06], [F + 5.5, LOT_Y + 0.015, z - 0.06], [F + 5.5, LOT_Y + 0.015, z + 0.06], [F + 1, LOT_Y + 0.015, z + 0.06], '#e6e6e2');
  A.quad([F + 0.4, LOT_Y, -W / 2 - 3], [F + 5.6, LOT_Y, -W / 2 - 3], [F + 5.6, LOT_Y, -9.5], [F + 0.4, LOT_Y, -9.5], CONC);
  return { body: A.mesh().geometry, glass: [15, 2.4, 1.55, -2.4], frieze: null, lot: [F + 0.4, F + PARK, W / 2 + 3],
    lit(name) {
      const L = sculptor();
      signText(L, 'GROWING FARM', -8.0, 0, 0.02, 0.135, '#f6f6f0'); signText(L, 'DISPENSARY', 8.0, 0, 0.02, 0.135, '#f6f6f0');
      signRect(L, -1.2, 0, 0.02, 1.5, 0.6, '#f6f6f0'); signText(L, 'LAB', -1.2, 0, 0.03, 0.06, '#3a5a3a'); signText(L, name, 2.4, 0, 0.02, Math.min(0.05, 3.4 / hudWidth(hudText(name))), '#f6f6f0');
      const out = [signGeo(L, F + 0.47, 0.3 + 3.75, 0)];
      const T = sculptor(); signText(T, 'OG', 0, 0.7, 0.02, 0.06, '#f6f6f0'); signRect(T, 0, 0, 0.02, 0.5, 0.1, '#f6f6f0'); T.tri([-0.3, 0, 0.02], [-0.05, 0.2, 0.02], [-0.05, -0.2, 0.02], '#f6f6f0');
      out.push(signGeo(T, F + 6.37, 1.6, -4.2)); const P = sculptor(); signText(P, 'P', 0, 0, 0.02, 0.07, '#f6f6f0'); out.push(signGeo(P, F + 6.24, 1.3, -6.4));
      return mergeGeo(out);
    } };
}

// щит на столбе у дороги: «CANNABIS», зелёный крест с листом — читается с обеих сторон дороги
function weedPylon() {
  const P = sculptor(); P.tube(0, 0, 3.9, 0, 0.09, 0.07, '#8e9296', 6); P.box(2.0, 1.05, 0.14, 0, 3.3, 0, '#f8f8f2'); P.box(2.1, 0.07, 0.18, 0, 3.86, 0, '#2a2a2c');
  const lit = ['z', '-z'].map((f) => { const T = sculptor(); signText(T, 'CANNABIS', -0.28, 0.14, 0.08, 0.05, '#1c1c1e'); signText(T, 'OPEN', -0.28, -0.26, 0.08, 0.045, '#e8482a');
    signRect(T, 0.72, 0, 0.08, 0.2, 0.62, '#2aa84a'); signRect(T, 0.72, 0, 0.08, 0.62, 0.2, '#2aa84a'); weedLeaf(T, 0.72, -0.2, 0.09, 0.36, '#f8f8f2'); return signGeo(T, 0, 3.3, 0, f); });
  return { pole: P.mesh().geometry, poleLit: mergeGeo(lit) };
}

// Ларёк ломается целиком: три отрезка-«стены» (стойка, задняя стена, щит) — один разрушаемый предмет. На малой скорости
// в них упираешься, на большой — будка, стойка, соломенный козырёк и щит разлетаются.
function kioskBreakable(g, meshes, board) {
  const q = new THREE.Quaternion(); g.getWorldQuaternion(q);
  const W3 = (u, v) => g.localToWorld(new THREE.Vector3(u, 0, -v)), st = { done: false }, pair = [];
  const parts = [[-0.6, 1.5, -1.2, 2.0, 2.7, 3.0, '#efe6d2', 'wood', 1.6], [0.75, 0.7, -1.2, 0.6, 1.1, 3.2, '#6a4a2e', 'wood', 1], [1.3, 2.6, -1.4, 1.9, 0.25, 3.4, '#b89858', 'leaf', 2.5],
    [-0.2, 1.95, 1.75, 0.16, 2.3, 2.7, board, 'wood', 1.4], [1.8, 1.2, 0.3, 0.1, 2.4, 0.1, '#6a4a2e', 'wood', 1], [1.8, 1.2, -3.1, 0.1, 2.4, 0.1, '#6a4a2e', 'wood', 1]];
  for (const [u0, v0, u1, v1] of [[1.0, -2.8, 1.0, 0.4], [-1.7, -2.8, -1.7, 3.1], [-0.2, 0.4, -0.2, 3.1]]) {
    const a = W3(u0, v0), b = W3(u1, v1), wall = [a.x, a.z, b.x, b.z];
    walls.push(wall);
    pair.push(addBreakable({ kind: 'stall', mat: 'wood', seg: wall, walls: [wall], loss: 0.08,
      hide() {
        for (const m of meshes) if (m) m.visible = false;
        for (const o of pair) for (const w of o.walls) { const i = walls.indexOf(w); if (i >= 0) walls.splice(i, 1); }
        dropBreakables(pair);
      },
      pieces(out) {
        if (st.done) return; st.done = true;
        for (const [u, y, v, su, sy, sv, col, mat, amount] of parts) { const w = g.localToWorld(new THREE.Vector3(u, y, -v)); shatter(out, w.x, w.y, w.z, su, sy, sv, q, col, mat, amount, 1.3); }
      } }));
  }
}
// высота земли под точкой группы (u, v) — в мире
function spotGroundLocal(g, u, v) { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); return groundY(w.x, w.z); }
function buildStores() {
  if (!IS.stores || !IS.stores.length) return;
  STORE_SIGN_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });       // вывески и неон светятся сами
  const BODY_MAT = lambert({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2e2c26 });       // стены в тени не уходят в болотный цвет
  STORE_GLOW_MAT = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
  const GREEN_GLOW = new THREE.MeshBasicMaterial({ color: 0x8aff9a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  const FRIEZE_GLOW = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  const make = { diy: storeDiy, pavilion: storePavilion, house: storeHouse, kiosk: storeKiosk, dispensary: storeDispensary, dispensaryGrey: () => storeDispensary(true) };
  const pylon = weedPylon(), seen = {};
  let seenDiy = 0;
  let weedN = 0;
  IS.stores.forEach((s) => {
    const weed = s.type === 'weed', name = weed ? WEED_NAMES[weedN++ % WEED_NAMES.length] : 'MR.DIY';
    const part = s.kind === 'dispensary' && name !== 'ISLAND BUDS' ? 'dispensaryGrey' : s.kind;    // «Ланг 2» — как был; у второго диспансера бетон серый
    const K = STORE[s.kind], P = storeParts[part] || (storeParts[part] = make[part]()), F = K.D / 2;
    const hasLot = !!P.lot && (!weed || WEED_PARKING.has(name));
    const g = new THREE.Group();
    g.position.set(s.x, s.y + LOT_RISE, s.z); g.rotation.y = -s.az;
    scene.add(g);
    g.add(new THREE.Mesh(P.body, BODY_MAT));
    if (hasLot && P.lotGeo) g.add(new THREE.Mesh(P.lotGeo, SHIP_MAT));
    const litMesh = new THREE.Mesh(typeof P.lit === 'function' ? P.lit(name) : P.lit, STORE_SIGN_MAT), stallMesh = P.stall ? new THREE.Mesh(P.stall, BODY_MAT) : null;
    g.add(litMesh); if (stallMesh) g.add(stallMesh);
    // ночной свет: витрина и фриз
    const glow = (w, h, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(Math.PI / 2), mat); m.position.set(x, y, z); m.visible = false; g.add(m); storeGlow.push(m); };
    if (P.glass) glow(P.glass[0], P.glass[1], F + 0.14, P.glass[2] + 0.3, P.glass[3] || 0, weed && s.kind === 'pavilion' ? GREEN_GLOW : STORE_GLOW_MAT);
    if (P.glass && weed && s.kind === 'pavilion') glow(P.glass[0], P.glass[1], F + 0.13, P.glass[2] + 0.3, 0, STORE_GLOW_MAT);
    if (P.frieze) glow(P.frieze[0], P.frieze[1], F + P.frieze[3] + 0.02, P.frieze[2], 0, FRIEZE_GLOW);
    g.updateMatrixWorld(true);
    const W3 = (u, v) => g.localToWorld(new THREE.Vector3(u, 0, -v));
    // стела или щит у дороги — разрушаемые
    { const pp = weed ? (s.kind === 'kiosk' ? kioskPylon(name) : pylon) : P, pole = new THREE.Group(), pu = F + K.PARK - 0.9, pv = (weedN % 2 ? 1 : -1) * (K.W / 2 + 2.2);
      pole.add(new THREE.Mesh(pp.pole, SHIP_MAT), new THREE.Mesh(pp.poleLit, STORE_SIGN_MAT));
      pole.position.set(pu, 0, -pv); g.add(pole);
      const w = W3(pu, pv); breakableObjects([pole], w.x, w.z, 0.2, 'pole', weed ? 0.05 : 0.08, 'metal'); posts.push([w.x, w.z]); }
    // штендер у входа каннабис-шопа — мелочь, сбивается
    if (weed) templeProp(g, F + (s.kind === 'kiosk' ? 2.6 : hasLot ? 2.9 : 2.0), s.kind === 'dispensary' ? -3 : 0.4, (B) => {
      B.box(0.5, 1.0, 0.06, 0, 0.55, 0.16, '#2a2a2c', 0, 0); B.box(0.5, 1.0, 0.06, 0, 0.55, -0.16, '#2a2a2c'); B.box(0.36, 0.5, 0.02, 0, 0.62, 0.2, '#e8f0e8');
    }, { kind: 'small', mat: 'wood', color: '#2a2a2c', r: 0.4, loss: 0.02 });
    if (s.kind === 'kiosk') {                                                                     // у ларька: табуреты у стойки и флаг с листом
      for (const v of [-0.3, -1.2, -2.1]) templeProp(g, 1.45, v, (B) => { B.tube(0, 0.18, 0.85, 0, 0.05, 0.05, '#3a3a3c', 5); B.tube(0, 0.85, 0.93, 0, 0.2, 0.2, '#6a4a2e', 7); B.tube(0, 0.18, 0.22, 0, 0.2, 0.2, '#3a3a3c', 6); }, { kind: 'small', color: '#6a4a2e', mat: 'wood', r: 0.25, loss: 0.02 });
      { const fl = kioskBrand(name).flag, rasta = kioskBrand(name).rasta;                          // флаг в цветах бренда
        templeProp(g, 2.3, 3.4, (B) => { B.tube(0, 0, 4.2, 0, 0.05, 0.04, '#d8d8d4', 5); B.box(0.04, 1.3, 0.9, 0, 3.5, -0.5, fl[0]);
          if (rasta) { B.box(0.06, 0.4, 0.9, 0, 3.95, -0.5, '#e8382a'); B.box(0.06, 0.4, 0.9, 0, 3.05, -0.5, '#2a9a3a'); B.box(0.06, 0.46, 0.9, 0, 3.5, -0.5, '#f6d048'); }
          else { B.box(0.06, 0.6, 0.42, 0, 3.55, -0.5, fl[1]); B.box(0.07, 0.3, 0.7, 0, 3.6, -0.5, fl[1]); } }, { r: 0.12, loss: 0.02 }); }
      kioskBreakable(g, [stallMesh, litMesh], kioskBrand(name).board);                    // ларёк целиком разрушаемый (просил Влад); настил остаётся
    } else wallBox(g, 0, 0, K.D + 0.4, K.W + 0.4);
    if (s.kind === 'diy') {                                           // машины у MR.DIY стоят по-разному: другой грузовик, другое место, носом к дороге
      const u = F + K.PARK - 3.0;
      [() => parkVehicle(g, pickupGeo('closed', '#2f5f9a'), u, 5.5, 'u-', LOT_Y),                                     // фургон с товаром
        () => parkVehicle(g, pickupGeo('songthaew', '#b8302a'), u, -7.5, 'u-', LOT_Y),                                 // красная маршрутка — как у водопада
        () => { parkVehicle(g, pickupGeo('closed', '#3a8a5a'), u, 8.1, 'u+', LOT_Y); parkVehicle(g, bakedCarGeo('lancia', '#1b1b1d'), u + 0.5, -4.9, 'u-', LOT_Y); },   // фургон носом к дороге и чёрная Lancia
        () => parkVehicle(g, pickupGeo('boxes', '#e8e8e4'), u, 2.9, 'u+', LOT_Y)][seenDiy++ % 4]();                   // пикап с коробками у самого входа
    }
    if (s.kind === 'dispensary') parkVehicle(g, pickupGeo('empty', '#c8ccd0'), F + 3.7, -6.35, 'u-', LOT_Y);
    if (name === 'LAZY LEAF') parkVehicle(g, bakedCarGeo('porsche', '#d4a62a'), P.lot[0] + 1.9, BAY / 2, 'v+', LOT_Y);   // золотой Porsche на парковке (просил Влад)
    // остальные машины и скутеры: на узких парковках шопов — машина в одном месте и скутеры в другом; где парковки нет — пара скутеров у настила
    const sn = Math.round(Math.abs(s.x) + Math.abs(s.z));
    if (s.kind === 'diy') scooterRow(g, sn, 2 + sn % 2, F + 2.0, -10.6, 0, 0.85, Math.PI, LOT_Y);
    else if (s.kind === 'dispensary') { parkVehicle(g, parkedCar(sn), F + 3.7, -9.4, 'u-', LOT_Y); scooterRow(g, sn, 2, F + 2.0, -12.2, 0, 0.8, Math.PI, LOT_Y); }
    else if (hasLot) {
      if (name !== 'LAZY LEAF' && sn % 3) parkVehicle(g, parkedCar(sn), P.lot[0] + 1.9, (sn % 2 ? 1 : -1) * BAY / 2, sn % 4 < 2 ? 'v+' : 'v-', LOT_Y);
      scooterRow(g, sn, 1 + sn % 3, P.lot[0] + 1.9, -(sn % 2 ? 1 : -1) * (BAY / 2 - 1.2), 0, -(sn % 2 ? 1 : -1) * 0.85, Math.PI, LOT_Y);
    } else if (sn % 3 !== 1) scooterRow(g, sn, 1 + sn % 2, F + (s.kind === 'kiosk' ? 3.4 : 3.6), s.kind === 'kiosk' ? -2.6 : -3.0, 0.2, -0.85, Math.PI + 0.3, spotGroundLocal(g, F + 3.5, -3) - s.y - LOT_RISE + 0.03);
    const lot = (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -F - 4 && p.x < F + K.PARK + 1 && Math.abs(p.z) < K.W / 2 + 5; };
    vegKeepOut.push(Object.assign(lot, { c: [s.x, s.z, K.W / 2 + 18] }));
    if (hasLot) lotApron(g, P.lot[1], -P.lot[2], P.lot[2], LOT_Y, s.kind === 'pavilion' || s.kind === 'house' || part === 'dispensaryGrey' ? LOT_GREY : '#a29f97', 1, s.kind === 'pavilion' || s.kind === 'house' ? 0x1c1c1c : 0x2e2c26);
    if (hasLot) pavedAreas.push({ x: s.x, z: s.z, r2: (K.W / 2 + F + K.PARK + 4) ** 2, lift: LOT_Y + LOT_RISE,           // колёса и следы шин — по бетону площадки
      test: (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > P.lot[0] && p.x < P.lot[1] && Math.abs(p.z) < P.lot[2]; } });
    g.userData.c = new THREE.Vector3(s.x, 0, s.z); pierGroups.push(g);                              // вдали не рисуется — вместе с пирсами
    // быстрый переход к каждому магазину
    const area = (s.area || '').replace(/\s*[\/(].*$/, '').toUpperCase(), key = (weed ? 'КАННАБИС ' : 'MR DIY ') + area;
    seen[key] = (seen[key] || 0) + 1;
    const many = IS.stores.filter((o) => (o.type === 'weed') === weed && (o.area || '').replace(/\s*[\/(].*$/, '').toUpperCase() === area).length > 1;
    spotPlace(key + (many ? ' ' + seen[key] : ''), g, F + K.PARK + 4, 0, -1, 0);
    LANDMARKS[LANDMARKS.length - 1].shop = true;
  });
  airportAnim.push(() => { const on = skyNow.night > 0.3; for (const m of storeGlow) if (m.visible !== on) m.visible = on; });
}
