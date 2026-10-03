// Модель взята из car_look/honda_city/buildCity_draft.js (её ведёт отдельная сессия); при обновлении черновика —
// обновить копию: python island_src/sync_cars.py write. Файл только объявляет buildCity(); зовёт её выбор машины и стоянки.
// ---------- Honda City ----------
// Honda City седьмого поколения (GN), седан в исполнении RS, тёмно-серый. Кузов — обшивка по сечениям, как у остальных машин;
// нос и корма — отдельные оболочки, набранные поперёк (по станциям вдоль X): они скруглены в плане, а фары, решётка,
// фонари и чёрный низ бамперов — это закрашенные клетки самих оболочек. Всё, кроме колёс, сливается в одну сетку на материал.
// Размеры сняты с бокового фото (база 2.6 м = 982 пикселя). Свесы 0.96 и 0.99 м. Капот горбатый, к носу загибается вниз:
// 0.74 м у кромки, 0.99 над передней осью, 1.02 у лобового; бампер выступает на 10 см дальше кромки капота, губа — ещё на 7.
// Лобовое завалено на 25°, крыша — одна дуга с вершиной 1.45 м над передними сиденьями, заднее стекло пологое (24°),
// багажник короткий и высокий (1.07 → 1.01 м), корма завалена вперёд: кромка крышки на 16 см ближе к оси, чем бампер.
// По борту — ребро от кончика фары до фонаря (0.83 → 0.92 м), над ним светлое плечо до подоконника (1.0 м), под ним
// узкий тёмный подрез. Арки — едва заметные наплывы, шире всего у кромки (габарит 1.74 м без зеркал).
// Спереди: тёмная планка между узкими тёмными фарами (сверху белая полоска ходовых огней, фары клином заходят на крылья),
// под ней решётка с хромовым «H», в бампере воздухозаборник и угловые ниши с противотуманками, снизу губа.
// Сзади: чёрный спойлер на кромке багажника, горизонтальные фонари с заходом на крылья, номер на крышке,
// чёрный низ бампера и вертикальные катафоты по углам. База 2.6 м. Нос — к -Z.
const CITY_L = 4.55, CITY_WHEEL_R = 0.305, CITY_AXLE = 1.3;
function buildCity() {
  const car = new THREE.Group(), body = new THREE.Group();        // body качается; колёса остаются на земле
  car.add(body);
  const paint = lambert({ color: 0x666b72 }), glass = lambert({ color: 0x2c3a4c });
  const chrome = lambert({ color: 0xd8dad6 }), dark = lambert({ color: 0x1a1a1a });
  const seam = lambert({ color: 0x34383d }), plate = lambert({ color: 0xe9e9e4 });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 }), tailMat = new THREE.MeshBasicMaterial({ color: 0xd42020 });
  const drlMat = new THREE.MeshBasicMaterial({ color: 0xffffff }), reflMat = new THREE.MeshBasicMaterial({ color: 0xa81818 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x2c3742 });       // тёмное стекло фары — одинаковое на свету и в тени
  const MATS = [paint, glass, dark, lampMat, drlMat, tailMat, lambert({ color: 0x24282d })];      // номера материалов для pick:
  const P = 0, G = 1, D = 2, LAMP = 3, DRL = 4, RED = 5, GLOSS = 6;       // кузов, стекло, чёрный, фара, ходовые огни, фонарь, чёрный глянец

  // Треугольники копятся по материалам и в конце становятся одной сеткой на материал.
  const soup = new Map(), loose = [];
  const bin = (mat) => soup.get(mat) || soup.set(mat, []).get(mat);
  // грань-треугольник в список; обход выставляется наружу от точки o внутри тела
  const mid = (r) => r.reduce((c, p) => [c[0] + p[0] / r.length, c[1] + p[1] / r.length, c[2] + p[2] / r.length], [0, 0, 0]);
  const tri = (dst, a, b, c, o) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const g = mid([a, b, c]);
    const outward = (uy * vz - uz * vy) * (g[0] - o[0]) + (uz * vx - ux * vz) * (g[1] - o[1]) + (ux * vy - uy * vx) * (g[2] - o[2]);
    dst.push(...a, ...(outward < 0 ? c : b), ...(outward < 0 ? b : c));
  };
  const geoOf = (v) => {                                          // у граней нет общих вершин — освещение гранёное
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.computeVertexNormals();
    return geo;
  };
  // обшивка: rings[i] — замкнутый контур точек [x, y, z]; клетка (i, j) — между сечениями i, i+1 и точками j, j+1.
  // pick(i, j) -> [материал первого треугольника клетки, второго, другая диагональ]; cap — материал торцов (-1 — без них).
  // sym: диагонали клеток зеркальны слева и справа — 1: зеркало поперёк станций (оболочки), 2: поперёк контура (кузов).
  const loft = (rings, pick, cap = P, sym = 0) => {
    const cs = rings.map(mid), n = rings.length;
    for (let i = 0; i + 1 < n; i++) {
      const A = rings[i], B = rings[i + 1], o = mid([cs[i], cs[i + 1]]);
      for (let j = 0; j < A.length; j++) {
        const k = (j + 1) % A.length, [m0, m1, f] = pick ? pick(i, j) : [P, P];
        const flip = f !== undefined ? f : sym === 1 ? i < (n - 1) / 2 : sym === 2 && j >= (A.length - 1) / 2;
        if (flip) { tri(bin(MATS[m0]), A[j], B[j], B[k], o); tri(bin(MATS[m1]), A[j], B[k], A[k], o); }
        else { tri(bin(MATS[m0]), A[j], B[j], A[k], o); tri(bin(MATS[m1]), B[j], B[k], A[k], o); }
      }
    }
    if (cap >= 0) for (const [e, o] of [[0, cs[1]], [n - 1, cs[n - 2]]]) {     // торцы — веером от середины
      const R = rings[e];
      for (let j = 0; j < R.length; j++) tri(bin(MATS[cap]), cs[e], R[j], R[(j + 1) % R.length], o);
    }
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const tab = (T, x) => {                                         // кусочно-линейная таблица [x, значение]
    let i = 0;
    while (i < T.length - 2 && x > T[i + 1][0]) i++;
    return lerp(T[i][1], T[i + 1][1], Math.min(1, Math.max(0, (x - T[i][0]) / (T[i + 1][0] - T[i][0]))));
  };

  // --- кузов. Полусечение снизу вверх: низ, порог, подрез, ребро борта, дальше пять точек до оси.
  // Капот и багажник: дуга от ребра к оси — HOOD (скаты от горба к крыльям) или DECK (плоский верх, круглое плечо), f — их смесь.
  // Кабина: подоконник (Ws, S), верх окна (Wc, G), стойка, край верхнего стекла (Wg), ось (T).
  const HOOD = [[1, 0], [0.93, 0.20], [0.82, 0.36], [0.68, 0.62], [0.42, 0.93], [0, 1]];
  const DECK = [[1, 0], [0.958, 0.50], [0.862, 0.85], [0.743, 0.97], [0.407, 1], [0, 1]];
  //              z     полушир. низ   ребро  верх  | f   или  Ws     S      Wc     G      Wg
  const NOSE_V = [[-2.10, 0.860, 0.25, 0.735, 0.737, 0],          // продолжение капота вперёд — только для оболочки носа
                  [-2.00, 0.860, 0.25, 0.760, 0.800, 0],
                  [-1.91, 0.858, 0.25, 0.785, 0.846, 0],
                  [-1.80, 0.855, 0.24, 0.812, 0.889, 0]];
  const BODY = [[-1.72, 0.835, 0.24, 0.826, 0.913, 0],            //  0 передний торец — внутри оболочки носа
                [-1.50, 0.845, 0.22, 0.843, 0.960, 0],
                [-1.25, 0.850, 0.21, 0.853, 1.000, 0.3],
                [-1.10, 0.850, 0.20, 0.861, 1.012, 1],            //  3 задняя кромка капота (в плане выгнута вперёд)
                [-1.04, 0.850, 0.20, 0.864, 1.024, 0.805, 0.955, 0.775, 0.985, 0.70],   //  4 низ лобового (выгнут так же)
                [-0.87, 0.850, 0.20, 0.872, 1.135, 0.805, 1.000, 0.795, 1.004, 0.69],   //  5 передний угол дверного стекла
                [-0.63, 0.850, 0.20, 0.880, 1.247, 0.805, 1.010, 0.722, 1.158, 0.64],
                [-0.41, 0.850, 0.20, 0.886, 1.334, 0.805, 1.011, 0.667, 1.262, 0.585],
                [-0.19, 0.850, 0.20, 0.892, 1.402, 0.805, 1.012, 0.636, 1.322, 0.55],   //  8 верх лобового
                [ 0.03, 0.850, 0.20, 0.898, 1.438, 0.805, 1.013, 0.622, 1.349, 0.535],
                [ 0.17, 0.850, 0.20, 0.902, 1.449, 0.805, 1.014, 0.620, 1.355, 0.535],  // 10-11 средняя стойка; макушка крыши
                [ 0.37, 0.850, 0.20, 0.905, 1.450, 0.805, 1.015, 0.620, 1.352, 0.535],
                [ 0.70, 0.850, 0.20, 0.909, 1.434, 0.805, 1.019, 0.622, 1.339, 0.53],
                [ 1.00, 0.850, 0.21, 0.911, 1.412, 0.805, 1.024, 0.650, 1.275, 0.525],  // 13 задняя кромка стекла задней двери
                [ 1.24, 0.850, 0.22, 0.913, 1.345, 0.78, 1.125, 0.765, 1.140, 0.53],    // 14 острый угол форточки, верх заднего стекла
                [ 1.50, 0.848, 0.24, 0.915, 1.232, 0.79, 1.070, 0.750, 1.105, 0.565],
                [ 1.85, 0.832, 0.27, 0.917, 1.070, 0.795, 0.987, 0.720, 1.040, 0.62],   // 16 низ заднего стекла (выгнут назад)
                [ 1.92, 0.825, 0.28, 0.917, 1.056, 1]];           // 17 задний торец — внутри оболочки кормы
  const TAIL_V = [[2.05, 0.81, 0.29, 0.915, 1.030, 1],            // продолжение крышки багажника — для оболочки кормы
                  [2.14, 0.79, 0.30, 0.912, 1.011, 1]];
  const half = (s) => {
    const [, W, B, C, T] = s, low = [[W - 0.05, B], [W - 0.004, B + 0.07], [W - 0.014, C - 0.035]];
    if (s.length === 6) return [...low, ...HOOD.map(([u, v], j) => [W * lerp(u, DECK[j][0], s[5]), C + (T - C) * lerp(v, DECK[j][1], s[5])])];
    const [Ws, S, Wc, Gy, Wg] = s.slice(5), R = T - 0.015;
    return [...low, [W, C], [Ws, S], [Wc, Gy], [lerp(Wg, Wc, 0.6), lerp(Gy, R, 0.62)], [Wg, R], [0, T]];
  };
  const SECT = [...NOSE_V, ...BODY, ...TAIL_V], HALF = SECT.map(half);
  const at = (z) => {                                             // полусечение на произвольном z
    let i = 0;
    while (i < SECT.length - 2 && z > SECT[i + 1][0]) i++;
    const t = Math.min(1, Math.max(0, (z - SECT[i][0]) / (SECT[i + 1][0] - SECT[i][0])));
    return HALF[i].map(([x, y], j) => [lerp(x, HALF[i + 1][j][0], t), lerp(y, HALF[i + 1][j][1], t)]);
  };
  const topY = (x, z) => {                                        // высота верха кузова над точкой (x, z)
    const h = at(z), ax = Math.abs(x);
    for (let j = 3; j < 8; j++) if (ax >= h[j + 1][0]) return lerp(h[j][1], h[j + 1][1], Math.max(0, (h[j][0] - ax) / (h[j][0] - h[j + 1][0] || 1)));
    return h[8][1];
  };
  const sideX = (y, z) => {                                       // полуширина борта на высоте y
    const h = at(z);
    for (let j = 1; j < 5; j++) if (y <= h[j + 1][1]) return lerp(h[j][0], h[j + 1][0], Math.max(0, (y - h[j][1]) / (h[j + 1][1] - h[j][1] || 1)));
    return h[5][0];
  };
  const widthAt = (z) => at(z)[3][0], creaseAt = (z) => at(z)[3][1];
  const BOW = { 3: -0.07, 4: -0.07, 16: 0.04 };                   // сечения, выгнутые в плане: сдвиг середины по z
  const bowAt = (i, x) => (BOW[i] || 0) * (1 - (x / BODY[i][1]) ** 2);
  const rings = BODY.map((s, i) => { const h = half(s); return [...h, ...h.slice(0, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [x, y, s[0] + bowAt(i, x)]); });
  // точки контура: 0 низ, 1 порог, 2 подрез, 3 ребро, 4 подоконник, 5 верх окна, 6 стойка, 7 край стекла, 8 ось, дальше зеркально (9..16)
  loft(rings, (i, j) => {
    if (j === 16) return [D, D];                                                    // днище
    if ((j === 7 || j === 8) && ((i >= 4 && i <= 7) || i === 14 || i === 15)) return [G, G];   // лобовое и заднее стёкла
    if (j === 4 || j === 11) {
      if (i === 5) return j === 4 ? [G, P, true] : [P, G];                          // передний угол дверного стекла — вдоль стойки
      if ((i >= 6 && i <= 9) || i === 11 || i === 12) return [G, G];                // стёкла дверей
      if (i === 10) return [GLOSS, GLOSS];                                          // чёрная средняя стойка
      if (i === 13) return j === 4 ? [G, P] : [P, G, true];                         // форточка сходит в точку у задней стойки
    }
    return [P, P];
  }, P, 2);

  // --- расширения арок: едва заметные наплывы. Вверху поверхность выходит из борта по касательной, шире всего
  // у кромки арки; внутренний край утоплен в кузов, снизу закрыто. Над колесом низ поднят полукругом — арка.
  // К обоим концам вылет сходит на нет.
  const ARCH_R = 0.35, ARCH_K = [-1, -0.8, -0.42, 0, 0.42, 0.8, 1], OUT = [0.026, 0.032, 0.036, 0.036, 0.036, 0.032, 0.026];
  const arch = (zc, ry, tops) => ARCH_K.map((k, n) => [zc + k * ARCH_R, CITY_WHEEL_R + ry * Math.sqrt(1 - k * k), tops[n], OUT[n]]);
  //              z     низ   верх  вылет
  const FRONT = [[-1.76, 0.27, 0.45, 0],                          // вырастает из угла бампера
                 [-1.70, 0.26, 0.52, 0.012],
                 ...arch(-CITY_AXLE, 0.35, [0.60, 0.70, 0.775, 0.795, 0.775, 0.70, 0.60]),
                 [-0.90, 0.21, 0.52, 0.012],
                 [-0.85, 0.21, 0.45, 0]];                         // сходит на нет у передней двери
  const REAR = [[0.85, 0.21, 0.45, 0],                            // вырастает из задней двери
                [0.90, 0.21, 0.52, 0.012],
                ...arch(CITY_AXLE, 0.335, [0.62, 0.73, 0.81, 0.84, 0.81, 0.73, 0.62]),
                [1.70, 0.26, 0.52, 0.012],
                [1.77, 0.28, 0.45, 0]];                           // сходит на нет к корме
  for (const sx of [-1, 1]) for (const st of [FRONT, REAR]) {
    loft(st.map(([z, yb, yt, out]) => {
      const pt = (t) => { const y = lerp(yt, yb, t); return [sideX(y, z) - 0.003 + out * t * t, y]; };
      return [pt(1), pt(0.66), pt(0.33), pt(0), [widthAt(z) - 0.12, lerp(yt, yb, 0.5)], [widthAt(z) - 0.2, yb]].map(([x, y]) => [sx * x, y, z]);
    }));
  }

  // --- оболочки носа и кормы. Станции идут поперёк машины; контур станции — профиль сверху вниз, задние точки утоплены в кузов.
  // Таблицы по |x|: UP/LOW — насколько поверхность отступает назад от середины на уровне фар и на уровне бампера.
  const NX = [0, 0.065, 0.20, 0.36, 0.46, 0.58, 0.70, 0.79, 0.845];
  const UP = [[0, 0], [0.20, 0.012], [0.36, 0.038], [0.46, 0.06], [0.58, 0.10], [0.70, 0.16], [0.79, 0.24], [0.845, 0.33]];
  const LOW = [[0, 0], [0.20, 0.009], [0.36, 0.03], [0.46, 0.048], [0.58, 0.08], [0.70, 0.125], [0.79, 0.20], [0.845, 0.34]];
  const YE = [[0, 0.735], [0.36, 0.742], [0.46, 0.748], [0.58, 0.762], [0.70, 0.782], [0.79, 0.803], [0.845, 0.822]];   // кромка капота
  const YL = [[0, 0.675], [0.36, 0.682], [0.46, 0.69], [0.58, 0.685], [0.70, 0.682], [0.79, 0.688], [0.845, 0.70]];     // низ планки и фар
  const YG = [[0, 0.535], [0.36, 0.535], [0.46, 0.565], [0.58, 0.59], [0.70, 0.61], [0.79, 0.625], [0.845, 0.635]];       // низ решётки
  const LIP = [[0, 0.072], [0.58, 0.072], [0.79, 0.03], [0.845, 0]];                                                   // вылет губы
  const NB = -1.66, NJ = -1.72;                                   // задняя плоскость оболочки (внутри кузова) и стык с кузовом
  const noseRing = (x) => {
    const a = Math.abs(x), up = tab(UP, a), low = tab(LOW, a), zE = -2.09 + up, xin = a > 0.84 ? Math.sign(x) * (a - 0.035) : x;
    const hood = (f) => { const z = lerp(NJ, zE, f); return [x, topY(a, z), z]; };
    const yE = tab(YE, a), lip = tab(LIP, a), k = lip / 0.072;
    return [[xin, topY(a, NB) - 0.03, NB], hood(0), hood(0.35), hood(0.62), hood(0.84),          //  0-4 капот
            [x, yE, zE], [x, yE - 0.026, zE - 0.012], [x, tab(YL, a), zE - 0.05],               //  5 кромка, 6 низ ходовых огней, 7 низ фары
            [x, tab(YG, a), -2.185 + lerp(up, low, 0.8)], [x, 0.455, -2.19 + low],              //  8 низ решётки, 9 пояс бампера
            [x, 0.36, -2.195 + low], [x, 0.265, -2.19 + low],                                   // 10-11 воздухозаборник
            [x, lerp(0.262, 0.25, k), -2.19 - lip + low], [x, lerp(0.245, 0.20, k), -2.17 + low], [xin, 0.24, NB]];   // 12 губа
  };
  const mirrored = (X) => [...X.slice(1).reverse().map((x) => -x), ...X], n1 = NX.length - 1;
  loft(mirrored(NX).map(noseRing), (k, j) => {
    const right = k >= n1, m = right ? k - n1 : n1 - 1 - k;       // m — номер клетки от середины
    if (j === 5) return m <= 3 ? [GLOSS, GLOSS] : [DRL, DRL];     // планка между фарами; полоска ходовых огней
    if (j === 6) return m <= 3 ? [GLOSS, GLOSS] : [LAMP, LAMP];   // планка; фара
    if (j === 7) return m <= 2 ? [D, D] : m === 3 ? [D, P, !right] : [P, P];              // решётка — трапеция
    if (j === 9) return m === 6 ? [D, D] : [P, P];                // угловая ниша: стойка у края,
    if (j === 10) return m <= 3 || m === 6 ? [D, D] : m === 5 ? [P, D, !right] : [P, P];  // воздухозаборник; низ ниши — остриём к середине
    if (j >= 12) return [D, D];                                   // низ губы
    return [P, P];
  }, P, 1);

  const TX = [0, 0.06, 0.18, 0.34, 0.50, 0.62, 0.72, 0.80, 0.836];
  const UPT = [[0, 0], [0.34, 0.017], [0.5, 0.036], [0.62, 0.055], [0.72, 0.08], [0.80, 0.14], [0.836, 0.24]];
  const LOWT = [[0, 0], [0.34, 0.02], [0.5, 0.042], [0.62, 0.065], [0.72, 0.095], [0.80, 0.17], [0.836, 0.35]];
  const YET = [[0, 1.012], [0.34, 1.01], [0.5, 1.005], [0.62, 0.995], [0.72, 0.98], [0.80, 0.955], [0.836, 0.935]];     // кромка крышки
  const YLB = [[0, 0.85], [0.34, 0.85], [0.5, 0.82], [0.62, 0.80], [0.72, 0.79], [0.836, 0.785]];                       // низ фонаря
  const YBOT = [[0, 0.315], [0.62, 0.31], [0.836, 0.275]];                                                             // низ бампера
  const TB = 1.86, TJ = 1.92;
  const tailRing = (x) => {
    const a = Math.abs(x), up = tab(UPT, a), low = tab(LOWT, a), zE = 2.13 - up, xin = a > 0.83 ? Math.sign(x) * (a - 0.035) : x;
    const zm = lerp(TJ, zE, 0.55), yb = tab(YBOT, a);
    return [[xin, topY(a, TB) - 0.03, TB], [x, topY(a, TJ), TJ], [x, topY(a, zm), zm], [x, tab(YET, a), zE],   //  0-2 крышка, 3 кромка
            [x, Math.min(0.927, tab(YET, a)), 2.175 - up], [x, tab(YLB, a), 2.19 - up],                        //  4 верх фонаря, 5 низ
            [x, 0.64, 2.235 - lerp(up, low, 0.7)], [x, 0.61, 2.265 - low], [x, 0.45, 2.29 - low],              //  6 стык с бампером
            [x, yb, 2.275 - low], [x, yb + 0.01, lerp(TB, 2.275 - low, 0.7)], [xin, 0.34, TB]];
  };
  const n2 = TX.length - 1;
  loft(mirrored(TX).map(tailRing), (k, j) => {
    const right = k >= n2, m = right ? k - n2 : n2 - 1 - k;
    if (j === 4) return m >= 4 ? [RED, RED] : m === 3 ? [RED, P, right] : [P, P];     // фонарь: внутренний конец скошен
    if (j === 7) return m === 6 ? [D, D] : [P, P];                // чёрная ниша катафота
    if (j === 8) return m <= 6 ? [D, D] : [P, P];                 // чёрный низ бампера
    if (j >= 9) return [D, D];
    return [P, P];
  }, P, 1);
  // чёрный спойлер на кромке багажника: идёт по той же дуге, что и кромка
  loft(mirrored([0, 0.34, 0.5, 0.62, 0.70]).map((x) => {
    const a = Math.abs(x), zE = 2.13 - tab(UPT, a), yE = tab(YET, a);
    return [[x, topY(a, zE - 0.10) + 0.012, zE - 0.10], [x, yE + 0.024, zE - 0.02], [x, yE + 0.035, zE + 0.07], [x, yE + 0.018, zE + 0.068],
            [x, yE - 0.06, zE - 0.01], [x, yE - 0.06, zE - 0.11]];
  }), () => [D, D], D, 1);
  // плавник антенны перед задним стеклом
  loft([[1.04, 0.012, 0.004], [1.12, 0.03, 0.045], [1.19, 0.028, 0.07], [1.215, 0.014, 0.062]].map(([z, w, h]) => {
    const y = topY(0, z);
    return [[w, y - 0.02], [w * 0.45, y + h], [-w * 0.45, y + h], [-w, y - 0.02]].map(([x, yy]) => [x, yy, z]);
  }), () => [D, D], D);

  // --- детали. part — брусок; rod — брусок сечением w × h между двумя точками; patch — плоская накладка-многоугольник;
  // put — накладка на оболочке: брусок w × h на станции x между точками контура j и j+1 (доля t), повёрнут по поверхности.
  const part = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); loose.push(m); return m; };
  const rod = (a, b, w, h, mat) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = part(w, h, A.distanceTo(B), mat, 0, 0, 0);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.sub(A).normalize());
    return m;
  };
  const patch = (pts, mat) => { for (let k = 1; k + 1 < pts.length; k++) tri(bin(mat), pts[0], pts[k], pts[k + 1], [0, 0.6, 0]); };
  const put = (ring, x, j, t, w, h, mat, d = 0.004) => {
    const at3 = (xx) => { const r = ring(xx); return new THREE.Vector3(...r[j]).lerp(new THREE.Vector3(...r[j + 1]), t); };
    const p = at3(x), r = ring(x), ex = at3(x + 0.01).sub(at3(x - 0.01)).normalize();
    const ey = new THREE.Vector3(...r[j]).sub(new THREE.Vector3(...r[j + 1])).normalize(), ez = new THREE.Vector3().crossVectors(ex, ey).normalize();
    if (ez.x * p.x + ez.z * p.z < 0) { ez.negate(); ex.negate(); }                            // наружу от оси машины
    ey.crossVectors(ez, ex);
    const m = part(w, h, 0.02, mat, 0, 0, 0);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
    m.position.copy(p).addScaledVector(ez, d);
    return m;
  };

  // перед: хромовый «H» на решётке, её перекладины, номер
  put(noseRing, 0, 7, 0.52, 0.12, 0.09, chrome);
  put(noseRing, 0, 7, 0.3, 0.78, 0.016, seam, 0);
  put(noseRing, 0, 7, 0.72, 0.7, 0.016, seam, 0);
  put(noseRing, 0, 9, 0.1, 0.36, 0.11, plate);
  // корма: «H» под спойлером, номер на крышке
  put(tailRing, 0, 3, 0.55, 0.09, 0.07, chrome);
  put(tailRing, 0, 5, 0.37, 0.36, 0.115, plate);
  // дворники на чёрной полке под лобовым; ws(x, t) — точка на стекле: t = 0 у нижней кромки, 1 — у переднего угла двери
  const ws = (x, t, up) => [x, lerp(topY(x, -1.04), topY(x, -0.87), t) + up, lerp(-1.04 + bowAt(4, x), -0.87, t)];
  for (const sx of [-1, 1]) for (const [xa, xb] of [[0, 0.35], [0.35, 0.66]]) rod(ws(sx * xa, -0.12, 0.004), ws(sx * xb, -0.12, 0.004), 0.05, 0.012, dark);
  for (const [xa, xb] of [[-0.56, -0.02], [0.04, 0.58]]) rod(ws(xa, 0.1, 0.014), ws(xb, 0.28, 0.014), 0.022, 0.016, dark);
  part(0.2, 0.016, 0.03, reflMat, 0, topY(0, 1.80) + 0.006, 1.83).rotation.x = 0.42;             // стоп-сигнал за задним стеклом

  const sidePt = (sx, y, z, d = 0.004) => [sx * (sideX(y, z) + d), y, z];
  const seamLine = (sx, pts, w = 0.02) => { for (let k = 0; k + 1 < pts.length; k++) rod(sidePt(sx, ...pts[k]), sidePt(sx, ...pts[k + 1]), 0.014, w, seam); };
  const handle = (sx, y, z) => {                                  // ручка: тёмная выемка и брусок в цвет кузова
    part(0.02, 0.05, 0.21, dark, sx * (sideX(y, z) + 0.002), y, z);
    part(0.03, 0.026, 0.19, paint, sx * (sideX(y, z) + 0.016), y + 0.008, z);
  };
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xf2d6c8 }), c = creaseAt;
  for (const sx of [-1, 1]) {
    // фара заходит на крыло клином до самого ребра борта; сверху — полоска ходовых огней
    const hl = [[sx * 0.853, tab(YE, 0.845) - 0.026, -1.772], [sx * 0.853, tab(YL, 0.845), -1.81], [sx * (widthAt(-1.551) + 0.008), 0.84, -1.551]];
    patch(hl, lampMat);
    patch([[sx * 0.853, tab(YE, 0.845), -1.76], hl[0], hl[2]], drlMat);
    put(noseRing, sx * 0.64, 6, 0.55, 0.075, 0.045, lensMat);                                   // линзы в фаре
    put(noseRing, sx * 0.75, 6, 0.55, 0.06, 0.05, lensMat);
    put(noseRing, sx * 0.745, 9, 0.8, 0.06, 0.04, lensMat);                                     // противотуманка в нише
    // фонарь заходит на крыло клином; на крышке багажника — светлая вставка
    patch([[sx * 0.844, 0.927, 1.935], [sx * 0.844, tab(YLB, 0.836), 1.945], [sx * (widthAt(1.70) + 0.008), 0.918, 1.70]], tailMat);
    put(tailRing, sx * 0.55, 4, 0.5, 0.15, 0.035, stripMat);
    put(tailRing, sx * 0.76, 7, 0.5, 0.03, 0.15, reflMat);                                      // вертикальный катафот
    // швы дверей, ручки, лючок бензобака (слева)
    seamLine(sx, [[1.0, -0.885], [c(-0.885), -0.885], [c(-0.885) - 0.035, -0.885], [0.28, -0.875]]);
    seamLine(sx, [[1.012, 0.25], [c(0.25), 0.245], [c(0.25) - 0.035, 0.243], [0.28, 0.21]]);
    seamLine(sx, [[0.285, -0.875], [0.285, 0.93]]);                                             // низ дверей над порогом
    seamLine(sx, [[1.04, 1.305], [0.99, 1.295], [c(1.27), 1.27], [c(1.27) - 0.035, 1.255], [0.74, 1.165]]);
    rod([sx * (BODY[13][5] + 0.004), BODY[13][6], 1.0], [sx * (BODY[13][7] + 0.004), BODY[13][8], 1.0], 0.014, 0.026, dark);   // стойка форточки
    handle(sx, 0.815, 0.045);
    handle(sx, 0.84, 1.02);
    if (sx < 0) {
      for (const y of [0.862, 0.995]) seamLine(sx, [[y, 1.34], [y, 1.55]], 0.012);
      for (const z of [1.34, 1.55]) seamLine(sx, [[0.862, z], [c(z) - 0.035, z], [c(z), z], [0.995, z]], 0.012);
    }
    // зеркало на ножке, чёрное
    part(0.17, 0.105, 0.11, dark, sx * 0.905, 1.05, -0.60).rotation.y = sx * -0.3;
    part(0.09, 0.05, 0.07, dark, sx * 0.835, 0.975, -0.61);
    part(0.04, 0.035, 1.7, dark, sx * 0.805, 0.19, 0);                                          // тень под порогом
    // тёмные ниши арок — накладки по контуру арки, чуть меньше его
    for (const [zc, ry] of [[-CITY_AXLE, 0.35], [CITY_AXLE, 0.335]]) {
      const x = sx * 0.854;
      patch([[x, 0.21, zc - 0.34], ...ARCH_K.map((k) => [x, CITY_WHEEL_R + 0.975 * ry * Math.sqrt(1 - k * k), zc + 0.975 * k * ARCH_R]), [x, 0.21, zc + 0.34]], dark);
    }
  }
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.12, 8), lambert({ color: 0x2f3236 }));   // выхлопная труба — едва видна
  pipe.geometry.rotateX(Math.PI / 2); pipe.position.set(0.42, 0.29, 2.17); loose.push(pipe);

  for (const m of loose) {                                        // бруски вливаются в общие сетки своих материалов
    m.updateMatrix();
    bin(m.material).push(...m.geometry.toNonIndexed().applyMatrix4(m.matrix).attributes.position.array);
  }
  soup.forEach((v, mat) => body.add(new THREE.Mesh(geoOf(v), mat)));

  // колёса: шина с боковиной, обод, тёмное дно диска и пять спиц — видно, как крутится. На колесо три сетки.
  const cyl = (r, w, n) => new THREE.CylinderGeometry(r, r, w, n).rotateZ(Math.PI / 2);
  const weld = (...geos) => {                                     // несколько геометрий в одну, нормали сохраняются
    const pos = [], nor = [];
    for (const g of geos) { const q = g.toNonIndexed(); pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return geo;
  };
  const spoke = (k) => new THREE.BoxGeometry(0.201, 0.05, 0.17).translate(0, 0, 0.105).rotateX(k * Math.PI * 0.4);
  const blackGeo = weld(cyl(CITY_WHEEL_R, 0.19, 14), cyl(0.188, 0.198, 12)), wallGeo = cyl(0.272, 0.194, 14);
  const rimGeo = weld(cyl(0.222, 0.196, 12), cyl(0.055, 0.204, 8), ...[0, 1, 2, 3, 4].map(spoke));
  const rimMat = lambert({ color: 0x8f9499 }), wallMat = lambert({ color: 0x2b2c2e });
  const front = [], spin = [];
  for (const z of [-CITY_AXLE, CITY_AXLE]) for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(), wheel = new THREE.Group();
    pivot.position.set(sx * 0.768, CITY_WHEEL_R, z);
    wheel.add(new THREE.Mesh(blackGeo, dark), new THREE.Mesh(wallGeo, wallMat), new THREE.Mesh(rimGeo, rimMat));
    pivot.add(wheel); car.add(pivot); spin.push(wheel);
    if (z < 0) front.push(pivot);
  }
  car.userData.frontWheels = front;
  car.userData.spin = spin;
  car.userData.body = body;
  return car;
}
