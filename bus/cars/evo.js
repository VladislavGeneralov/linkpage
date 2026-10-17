// Модель взята из car_look/mitsubishi_evo/buildEvo_draft.js (её ведёт отдельная сессия); при обновлении черновика —
// обновить копию: python island_src/sync_cars.py write. Файл только объявляет buildEvo(); зовёт её выбор машины и стоянки.
// ---------- Mitsubishi Lancer Evolution VI ----------
// Lancer Evolution VI (CP9A), красный, на белых двенадцатиспицевых дисках. Кузов — обшивка по сечениям, как у Honda City;
// нос и корма — отдельные оболочки, набранные поперёк (станции вдоль X): фары, решётка, воздухозаборники и фонари —
// закрашенные клетки самих оболочек. Всё, кроме колёс, сливается в одну сетку на материал.
// Профиль снят с бокового фото Evolution V (тот же кузов; car_look/mitsubishi_evo/side_evo5_white.jpg) по подобранной
// камере: база 2.51 м, длина 4.35 (свесы 0.92 и 0.92), ширина 1.77 по аркам, крыша 1.415. Машина на фото занижена
// на 2 см — модель поднята до заводской высоты. Капот: кромка 0.725 м, 0.90 над осью, 0.96 у лобового, по оси выше
// крыльев на 3–5 см; лобовое под 34° (низ -0.80 м, верх -0.20), макушка крыши над средней стойкой, заднее стекло под 27°
// (0.97 → 1.555 м), крышка багажника 1.07 → 1.03. Подоконник поднимается к корме: 0.94 → 0.99, верх окон 1.355;
// швы дверей на -0.79, 0.275 и 1.225 м; стекло задней двери сходит в остриё, перед ним перегородка форточки.
// Арки: радиус 0.36 спереди и 0.345 сзади, наплывы шире всего у кромки. Бамперы выступают за фары на 7 см, за фонари на 12.
// Спереди (Evolution VI): узкие широкие фары с заходом на крылья, между ними решётка с ромбами; в бампере большой
// воздухозаборник с сеткой, по бокам малые проёмы и круглые противотуманки, номер сдвинут к левому борту, на углах — жабры,
// снизу губа. На капоте два выхода воздуха с козырьками и узкий воздухозаборник. Сзади: горизонтальные фонари
// (янтарная секция, белый задний ход, яркий стоп) с заходом на крылья, номер на крышке, большая труба слева,
// антикрыло в две плоскости на высоких шайбах (верх 1.335 м). Мелочи: швы и ручки дверей, чёрные рамки окон и средняя
// стойка, зеркала в цвет кузова, дворники, антенна, повторители, накладки порогов, лючок бака (справа), брызговики,
// шильдики. Накладки лежат на 0.4–1.2 см выше поверхности. Нос — к -Z.
const EVO_L = 4.35, EVO_WHEEL_R = 0.317, EVO_AXLE = 1.255;
function buildEvo(o = {}) {
  const car = new THREE.Group(), body = new THREE.Group();        // body качается; колёса остаются на земле
  car.add(body);
  const paint = lambert({ color: 0xc8242c }), glass = lambert({ color: 0x2c3a4c });
  const chrome = lambert({ color: 0xd8dad6 }), dark = lambert({ color: 0x1a1a1a });
  const seam = lambert({ color: 0x6e1016 }), plate = lambert({ color: 0xe9e9e4 }), mesh = lambert({ color: 0x2a2d31 });
  const badge = lambert({ color: 0xe8e8e8 }), flap = lambert({ color: 0x2b2c2e });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 }), tailMat = new THREE.MeshBasicMaterial({ color: 0x7a0a10 });
  const stopMat = new THREE.MeshBasicMaterial({ color: 0xff3a24 }), amberMat = new THREE.MeshBasicMaterial({ color: 0xf08a20 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xaab6bd });       // прозрачная фара с хромом внутри — светлая и на свету, и в тени
  const MATS = [paint, glass, dark, lampMat, tailMat, mesh];              // номера материалов для pick:
  const P = 0, G = 1, D = 2, LAMP = 3, RED = 4, MESH = 5;                 // кузов, стекло, чёрный, фара, фонарь, сетка воздухозаборника

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
      const A = rings[i], B = rings[i + 1], c = mid([cs[i], cs[i + 1]]);
      for (let j = 0; j < A.length; j++) {
        const k = (j + 1) % A.length, [m0, m1, f] = pick ? pick(i, j) : [P, P];
        const flip = f !== undefined ? f : sym === 1 ? i < (n - 1) / 2 : sym === 2 && j >= (A.length - 1) / 2;
        if (flip) { tri(bin(MATS[m0]), A[j], B[j], B[k], c); tri(bin(MATS[m1]), A[j], B[k], A[k], c); }
        else { tri(bin(MATS[m0]), A[j], B[j], A[k], c); tri(bin(MATS[m1]), B[j], B[k], A[k], c); }
      }
    }
    if (cap >= 0) for (const [e, c] of [[0, cs[1]], [n - 1, cs[n - 2]]]) {     // торцы — веером от середины
      const R = rings[e];
      for (let j = 0; j < R.length; j++) tri(bin(MATS[cap]), cs[e], R[j], R[(j + 1) % R.length], c);
    }
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const tab = (T, x) => {                                         // кусочно-линейная таблица [x, значение]
    let i = 0;
    while (i < T.length - 2 && x > T[i + 1][0]) i++;
    return lerp(T[i][1], T[i + 1][1], Math.min(1, Math.max(0, (x - T[i][0]) / (T[i + 1][0] - T[i][0]))));
  };

  // --- кузов. Полусечение снизу вверх: низ, порог, середина борта, ребро борта (самое широкое место), дальше пять точек до оси.
  // Капот и багажник: дуга от ребра к оси. HOOD — крыло с гранью и пологий капот, DOME — покатый нос, DECK — плоская
  // крышка багажника с круглым плечом; f = 0..1 — смесь HOOD и DOME, f = 2 — DECK.
  // Кабина: подоконник (Ws, S), верх окна (Wc, G), стойка, край верхнего стекла (Wg), ось (T).
  const HOOD = [[1, 0], [0.99, 0.55], [0.955, 0.80], [0.80, 0.90], [0.42, 0.985], [0, 1]];
  const DOME = [[1, 0], [0.975, 0.38], [0.91, 0.62], [0.72, 0.83], [0.40, 0.96], [0, 1]];
  const DECK = [[1, 0], [0.985, 0.50], [0.94, 0.84], [0.84, 0.96], [0.42, 1], [0, 1]];
  //              z     полушир. низ   ребро  верх  | f   или  Ws     S      Wc     G      Wg
  const NOSE_V = [[-2.12, 0.862, 0.25, 0.680, 0.690, 1],          // продолжение капота вперёд — только для оболочки носа
                  [-2.065, 0.862, 0.25, 0.695, 0.725, 1],
                  [-2.00, 0.862, 0.25, 0.700, 0.775, 1],
                  [-1.90, 0.860, 0.25, 0.705, 0.812, 0.9],
                  [-1.81, 0.860, 0.25, 0.715, 0.834, 0.75]];
  const BODY = [[-1.72, 0.858, 0.25, 0.725, 0.850, 0.6],          //  0 передний торец — внутри оболочки носа
                [-1.50, 0.858, 0.23, 0.74, 0.885, 0.3],
                [-1.255, 0.855, 0.21, 0.76, 0.918, 0],            //  2 над передней осью
                [-1.00, 0.850, 0.20, 0.78, 0.945, 0],
                [-0.86, 0.848, 0.20, 0.79, 0.958, 0],             //  4 задняя кромка капота (в плане выгнута вперёд)
                [-0.80, 0.845, 0.20, 0.795, 0.965, 0.82, 0.945, 0.80, 0.955, 0.72],   //  5 низ лобового (выгнут так же)
                [-0.65, 0.845, 0.20, 0.800, 1.066, 0.815, 0.938, 0.79, 0.985, 0.69],  //  6 передний угол дверного стекла
                [-0.42, 0.845, 0.20, 0.805, 1.222, 0.815, 0.942, 0.72, 1.177, 0.64],
                [-0.20, 0.845, 0.20, 0.810, 1.385, 0.815, 0.947, 0.645, 1.354, 0.57], //  8 верх лобового
                [ 0.10, 0.845, 0.20, 0.820, 1.408, 0.815, 0.955, 0.64, 1.356, 0.56],
                [ 0.24, 0.845, 0.20, 0.823, 1.414, 0.815, 0.959, 0.64, 1.356, 0.56],  // 10-11 средняя стойка; макушка крыши
                [ 0.31, 0.845, 0.20, 0.825, 1.415, 0.815, 0.961, 0.64, 1.356, 0.56],
                [ 0.77, 0.845, 0.20, 0.840, 1.411, 0.815, 0.975, 0.64, 1.352, 0.56],
                [ 0.90, 0.845, 0.20, 0.845, 1.400, 0.815, 0.979, 0.645, 1.342, 0.56], // 13 задний верхний угол стекла задней двери
                [ 0.97, 0.845, 0.20, 0.848, 1.383, 0.812, 0.982, 0.665, 1.295, 0.565],// 14 задняя кромка крыши (выгнута назад)
                [ 1.21, 0.845, 0.21, 0.860, 1.252, 0.805, 0.989, 0.79, 1.000, 0.60],  // 15 остриё стекла задней двери
                [ 1.555, 0.840, 0.26, 0.900, 1.076, 0.80, 1.00, 0.77, 1.030, 0.66],   // 16 низ заднего стекла (выгнут назад)
                [ 1.62, 0.840, 0.26, 0.905, 1.068, 2],
                [ 1.92, 0.836, 0.27, 0.945, 1.040, 2]];           // 18 задний торец — внутри оболочки кормы
  const TAIL_V = [[2.03, 0.835, 0.28, 0.95, 1.030, 2],            // продолжение крышки багажника — для оболочки кормы
                  [2.12, 0.83, 0.29, 0.95, 1.020, 2]];
  const half = (s) => {
    const [, W, B, C, T] = s, low = [[W - 0.04, B], [W - 0.006, B + 0.06], [W - 0.002, lerp(B, C, 0.55)]];
    if (s.length === 6) {
      const f = s[5], A = f === 2 ? DECK : HOOD, Bt = f === 2 ? DECK : DOME, t = f === 2 ? 0 : f;
      return [...low, ...A.map(([u, v], j) => [W * lerp(u, Bt[j][0], t), C + (T - C) * lerp(v, Bt[j][1], t)])];
    }
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
    for (let j = 3; j < 8; j++) if (ax >= h[j + 1][0]) return lerp(h[j][1], h[j + 1][1], Math.min(1, Math.max(0, (h[j][0] - ax) / (h[j][0] - h[j + 1][0] || 1))));
    return h[8][1];
  };
  const sideX = (y, z) => {                                       // полуширина борта на высоте y
    const h = at(z);
    for (let j = 1; j < 5; j++) if (y <= h[j + 1][1]) return lerp(h[j][0], h[j + 1][0], Math.max(0, (y - h[j][1]) / (h[j + 1][1] - h[j][1] || 1)));
    return h[5][0];
  };
  const widthAt = (z) => at(z)[3][0], creaseAt = (z) => at(z)[3][1];
  const BOW = { 4: -0.07, 5: -0.07, 14: 0.035, 16: 0.04 };        // сечения, выгнутые в плане: сдвиг середины по z
  const bowAt = (i, x) => (BOW[i] || 0) * (1 - (x / BODY[i][1]) ** 2);
  const rings = BODY.map((s, i) => { const h = half(s); return [...h, ...h.slice(0, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [x, y, s[0] + bowAt(i, x)]); });
  // точки контура: 0 низ, 1 порог, 2 борт, 3 ребро, 4 подоконник, 5 верх окна, 6 стойка, 7 край стекла, 8 ось, дальше зеркально (9..16)
  loft(rings, (i, j) => {
    if (j === 16) return [D, D];                                                    // днище
    if (i === 4 && j >= 6 && j <= 9) return [D, D];                                 // чёрная полка под дворниками
    if ((j === 7 || j === 8) && ((i >= 5 && i <= 7) || i === 14 || i === 15)) return [G, G];   // лобовое и заднее стёкла
    if (j === 4 || j === 11) {
      if (i === 6) return j === 4 ? [G, P, true] : [P, G];                          // передний угол дверного стекла — вдоль стойки
      if ((i >= 7 && i <= 9) || (i >= 11 && i <= 13)) return [G, G];                // стёкла дверей
      if (i === 10) return [D, D];                                                  // чёрная средняя стойка
      if (i === 14) return j === 4 ? [G, P] : [P, G, true];                         // стекло задней двери сходит в остриё
    }
    return [P, P];
  }, P, 2);

  // --- расширения арок. Вверху поверхность выходит из борта по касательной, шире всего у кромки арки (габарит 1.77 м);
  // внутренний край утоплен в кузов, снизу закрыто. Над колесом низ поднят полукругом — арка. К концам вылет сходит на нет.
  const ARCH_K = [-1, -0.8, -0.42, 0, 0.42, 0.8, 1], OUT = [0.030, 0.036, 0.040, 0.040, 0.040, 0.036, 0.030];
  const arch = (zc, r, tops) => ARCH_K.map((k, n) => [zc + k * r, EVO_WHEEL_R + (r + 0.005) * Math.sqrt(1 - k * k), tops[n], OUT[n]]);
  const RF = 0.36, RR = 0.345;
  //              z     низ   верх  вылет
  const FRONT = [[-1.80, 0.26, 0.50, 0],                          // вырастает из угла бампера
                 [-1.72, 0.25, 0.60, 0.016],
                 ...arch(-EVO_AXLE, RF, [0.70, 0.78, 0.83, 0.845, 0.83, 0.78, 0.70]),
                 [-0.82, 0.21, 0.60, 0.014],
                 [-0.74, 0.21, 0.50, 0]];                         // сходит на нет в передней двери
  const REAR = [[0.74, 0.21, 0.45, 0],                            // вырастает из задней двери
                [0.82, 0.21, 0.55, 0.014],
                ...arch(EVO_AXLE, RR, [0.66, 0.73, 0.775, 0.79, 0.775, 0.73, 0.66]),
                [1.68, 0.27, 0.60, 0.014],
                [1.76, 0.28, 0.52, 0]];                           // сходит на нет к корме
  for (const sx of [-1, 1]) for (const st of [FRONT, REAR]) {
    loft(st.map(([z, yb, yt, out]) => {
      const pt = (t) => { const y = lerp(yt, yb, t); return [sideX(y, z) - 0.003 + out * t * t, y]; };
      return [pt(1), pt(0.66), pt(0.33), pt(0), [widthAt(z) - 0.12, lerp(yt, yb, 0.5)], [widthAt(z) - 0.2, yb]].map(([x, y]) => [sx * x, y, z]);
    }));
  }

  // --- оболочки носа и кормы. Станции идут поперёк машины; контур станции — профиль сверху вниз, задние точки утоплены в кузов.
  // Таблицы по |x|: UP/LOW — насколько поверхность отступает назад от середины на уровне фар и на уровне бампера.
  const NX = [0, 0.13, 0.30, 0.37, 0.52, 0.64, 0.76, 0.83, 0.865];
  const UP = [[0, 0], [0.30, 0.012], [0.52, 0.04], [0.64, 0.075], [0.76, 0.13], [0.83, 0.20], [0.865, 0.30]];
  const LOW = [[0, 0], [0.30, 0.006], [0.52, 0.025], [0.64, 0.05], [0.76, 0.10], [0.83, 0.17], [0.865, 0.29]];
  const YE = [[0, 0.725], [0.30, 0.724], [0.52, 0.72], [0.64, 0.715], [0.76, 0.708], [0.865, 0.70]];      // кромка капота
  const YL = [[0, 0.60], [0.52, 0.60], [0.76, 0.605], [0.865, 0.615]];                                    // низ фар и решётки
  const NB = -1.625, NJ = -1.72, ZN = -2.065;                      // задняя плоскость оболочки (внутри кузова), стык с кузовом, кромка капота
  const noseRing = (x) => {
    const a = Math.abs(x), up = tab(UP, a), low = tab(LOW, a), zE = ZN + up, xin = a > 0.84 ? Math.sign(x) * (a - 0.035) : x;
    const hood = (f) => { const z = lerp(NJ, zE, f); return [x, topY(a, z), z]; };
    const yE = tab(YE, a), zb = -2.175 + low;
    return [[xin, topY(a, NB) - 0.03, NB], hood(0), hood(0.35), hood(0.62), hood(0.84),          //  0-4 капот
            [x, yE, zE], [x, yE - 0.02, zE - 0.012], [x, tab(YL, a), zE - 0.04],                //  5 кромка, 6 верх фары, 7 низ фары
            [x, 0.572, lerp(zE - 0.04, zb, 0.8)], [x, 0.485, zb],                               //  8 полка бампера, 9 низ бруса
            [x, 0.285, zb - 0.02], [x, 0.235, zb - 0.026],                                             // 10 низ воздухозаборника, 11 губа
            [x, 0.212, zb + 0.01], [xin, 0.24, NB]];
  };
  const mirrored = (X) => [...X.slice(1).reverse().map((x) => -x), ...X], n1 = NX.length - 1;
  loft(mirrored(NX).map(noseRing), (k, j) => {
    const right = k >= n1, m = right ? k - n1 : n1 - 1 - k;       // m — номер клетки от середины
    if (j === 6) return m <= 1 ? [D, D] : [LAMP, LAMP];           // решётка между фарами; фары до самых углов
    if (j === 9) return m <= 1 || m === 3 ? [MESH, MESH] : [P, P];        // большой воздухозаборник, стойка, малые проёмы
    if (j >= 11) return [D, D];                                   // низ губы
    return [P, P];
  }, P, 1);

  const TX = [0, 0.14, 0.30, 0.36, 0.52, 0.66, 0.76, 0.81, 0.84];
  const UPT = [[0, 0], [0.36, 0.008], [0.52, 0.018], [0.66, 0.03], [0.76, 0.045], [0.81, 0.065], [0.84, 0.11]];
  const LOWT = [[0, 0], [0.36, 0.015], [0.52, 0.035], [0.66, 0.07], [0.76, 0.095], [0.81, 0.14], [0.84, 0.22]];
  const YET = [[0, 1.03], [0.52, 1.025], [0.66, 1.015], [0.76, 1.0], [0.81, 0.985], [0.84, 0.965]];       // кромка крышки
  const TB = 1.86, TJ = 1.92, ZT = 2.035;
  const tailRing = (x) => {
    const a = Math.abs(x), up = tab(UPT, a), low = tab(LOWT, a), zE = ZT - up, xin = a > 0.82 ? Math.sign(x) * (a - 0.035) : x;
    const zm = lerp(TJ, zE, 0.55), zb = 2.175 - low, yE = tab(YET, a);
    return [[xin, topY(a, TB) - 0.03, TB], [x, topY(a, TJ), TJ], [x, topY(a, zm), zm], [x, yE, zE],   //  0-2 крышка, 3 кромка
            [x, Math.min(yE - 0.03, 0.955), zE + 0.014], [x, 0.765, zE + 0.035], [x, 0.675, zE + 0.045],          //  4 верх фонаря, 5 низ, 6 низ панели
            [x, 0.655, lerp(zE + 0.045, zb, 0.75)], [x, 0.56, zb], [x, 0.40, zb - 0.005],        //  7 полка бампера, 8-9 бампер
            [x, 0.265, zb - 0.04], [x, 0.275, lerp(TB, zb, 0.6)], [xin, 0.34, TB]];
  };
  const n2 = TX.length - 1;
  loft(mirrored(TX).map(tailRing), (k, j) => {
    const right = k >= n2, m = right ? k - n2 : n2 - 1 - k;
    if (j === 4) return m >= 3 ? [RED, RED] : [P, P];             // фонари от номера до углов
    if (j >= 10) return [D, D];
    return [P, P];
  }, P, 1);

  // --- детали. part — брусок; rod — брусок сечением w × h между двумя точками; patch — плоская накладка-многоугольник;
  // put — накладка на оболочке: брусок w × h на станции x между точками контура j и j+1 (доля t), повёрнут по поверхности.
  const part = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); loose.push(m); return m; };
  const rod = (a, b, w, h, mat) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = part(w, h, A.distanceTo(B), mat, 0, 0, 0);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.sub(A).normalize());
    return m;
  };
  const patch = (pts, mat, c = [0, 0.6, 0]) => { for (let k = 1; k + 1 < pts.length; k++) tri(bin(mat), pts[0], pts[k], pts[k + 1], c); };
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
  const onTop = (x, z, up = 0.006) => [x, topY(x, z) + up, z];
  const topLine = (x0, z0, x1, z1, n, mat, w = 0.014, up = 0.004) => {                        // брусок по верху кузова
    for (let k = 0; k < n; k++) rod(onTop(lerp(x0, x1, k / n), lerp(z0, z1, k / n), up), onTop(lerp(x0, x1, (k + 1) / n), lerp(z0, z1, (k + 1) / n), up), w, 0.012, mat);
  };
  const sidePt = (sx, y, z, d = 0.005) => [sx * (sideX(y, z) + d), y, z];
  const seamLine = (sx, pts, w = 0.016, mat = seam) => { for (let k = 0; k + 1 < pts.length; k++) rod(sidePt(sx, ...pts[k]), sidePt(sx, ...pts[k + 1]), 0.012, w, mat); };

  // перед: значок на решётке, стойки между решёткой и фарами, номер слева (со стороны водителя — справа), противотуманки
  put(noseRing, 0, 6, 0.13, 0.60, 0.035, paint, 0.004);                                      // рамка решётки сверху
  put(noseRing, 0, 6, 0.6, 0.07, 0.05, stopMat, 0.008);                                       // три ромба
  put(noseRing, -0.445, 9, 0.38, 0.30, 0.155, plate, 0.012);
  put(noseRing, 0, 10, 0.55, 0.50, 0.018, dark, 0.004);                                       // щель в губе
  for (const y of [0.34, 0.39, 0.44]) part(0.56, 0.012, 0.02, dark, 0, y, -2.172 - (0.485 - y) * 0.1);            // ламели интеркулера
  // капот: два выхода воздуха с сеткой, за каждым приподнятый козырёк; слева от оси — узкий воздухозаборник
  const slope = (x, z) => Math.atan2(topY(x, z + 0.05) - topY(x, z - 0.05), 0.1);
  for (const [x, w] of [[-0.19, 0.33], [0.19, 0.33]]) {
    const z = -1.50;
    part(w, 0.012, 0.21, mesh, x, topY(x, z) + 0.004, z).rotation.x = -slope(x, z);
    part(w + 0.03, 0.035, 0.04, paint, x, topY(x, z + 0.12) + 0.014, z + 0.12).rotation.x = -slope(x, z);
  }
  part(0.07, 0.012, 0.16, dark, -0.50, topY(0.50, -1.25) + 0.004, -1.25).rotation.x = -slope(0.5, -1.25);
  for (const sx of [-1, 1]) { topLine(sx * 0.70, -2.0, sx * 0.76, -0.90, 3, seam); topLine(sx * 0.63, 1.62, sx * 0.63, 2.0, 1, seam); }   // швы капота и крышки багажника
  // дворники на чёрной полке под лобовым; ws(x, t) — точка на стекле: t = 0 у нижней кромки, 1 — у верхней
  const ws = (x, t, up) => [x, lerp(topY(x, -0.80), topY(x, -0.20), t) + up, lerp(-0.80 + bowAt(5, x), -0.20, t)];
  rod(ws(0.56, 0.03, 0.016), ws(0.06, 0.10, 0.016), 0.022, 0.016, dark);
  rod(ws(-0.04, 0.03, 0.016), ws(-0.54, 0.10, 0.016), 0.022, 0.016, dark);
  rod([0.30, topY(0.30, 0.86) + 0.004, 0.86], [0.30, topY(0.30, 0.86) + 0.13, 0.97], 0.014, 0.014, dark);   // антенна на крыше

  // корма: номер на крышке между фонарями, значок над ним, шильдики, прорезь внизу бампера, выхлоп слева
  put(tailRing, 0, 4, 0.52, 0.40, 0.185, dark, 0.002);
  put(tailRing, 0, 4, 0.52, 0.33, 0.155, plate, 0.01);
  put(tailRing, 0, 3, 0.5, 0.07, 0.05, stopMat, 0.008);                                       // три ромба
  put(tailRing, 0.47, 3, 0.5, 0.15, 0.04, dark, 0.006);                                       // «Evolution VI»
  put(tailRing, 0.50, 5, 0.5, 0.11, 0.028, stopMat, 0.006);                                   // «Lancer»
  put(tailRing, 0, 9, 0.35, 0.80, 0.03, dark, 0.004);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.20, 10), chrome);
  pipe.geometry.rotateX(Math.PI / 2); pipe.position.set(-0.52, 0.27, 2.10); loose.push(pipe);
  const pipeIn = new THREE.Mesh(new THREE.CircleGeometry(0.038, 10), dark);
  pipeIn.position.set(-0.52, 0.27, 2.202); loose.push(pipeIn);

  // --- антикрыло: две высокие концевые шайбы, между ними верхняя плоскость; на крышке — нижняя плоскость клином
  // с приподнятой серединой и стоп-сигналом
  const WX = 0.705, deckY = (x, z) => topY(x, Math.min(z, 2.0));
  for (const sx of [-1, 1]) {
    const x0 = sx * (WX - 0.02), x1 = sx * (WX + 0.02);
    const prof = [[1.60, deckY(WX, 1.60) - 0.01], [1.80, 1.185], [1.97, 1.33], [2.10, 1.335], [2.085, 1.20], [1.99, deckY(WX, 1.97) - 0.04]];
    loft([prof.map(([z, y]) => [x0, y, z]), prof.map(([z, y]) => [x1, y, z])]);
  }
  const plane = (xs, prof) => loft(xs.map((x) => prof(Math.abs(x)).map(([z, y]) => [x, y, z])));
  plane([-WX + 0.02, WX - 0.02], () => [[1.90, 1.275], [1.96, 1.305], [2.09, 1.322], [2.095, 1.305], [1.96, 1.28]]);   // верхняя плоскость
  plane([-0.69, -0.36, -0.22, 0.22, 0.36, 0.69], (a) => {                                                   // нижняя, с горбом
    const h = a < 0.3 ? 0.045 : 0;
    return [[1.72, deckY(a, 1.72) - 0.01], [1.90, deckY(a, 1.90) + 0.055 + h * 0.5], [2.075, 1.115 + h], [2.08, 1.095 + h], [2.03, deckY(a, 2.03) - 0.02]];
  });
  part(0.36, 0.022, 0.012, stopMat, 0, 1.15, 2.084);

  const handle = (sx, y, z) => {                                  // ручка: тёмная выемка и брусок в цвет кузова
    part(0.02, 0.055, 0.19, dark, sx * (sideX(y, z) + 0.002), y, z);
    part(0.03, 0.028, 0.17, paint, sx * (sideX(y, z) + 0.014), y + 0.01, z);
  };
  const c = creaseAt;
  for (const sx of [-1, 1]) {
    // фары: тёмная перемычка у решётки, линза, поворотник у угла; фара клином заходит на крыло
    put(noseRing, sx * 0.315, 6, 0.5, 0.03, 0.11, paint, 0.004);
    put(noseRing, sx * 0.45, 6, 0.52, 0.16, 0.07, lensMat, 0.005);
    put(noseRing, sx * 0.64, 6, 0.5, 0.014, 0.09, mesh, 0.005);
    patch([[sx * 0.869, tab(YE, 0.865) - 0.02, ZN + 0.288], [sx * 0.869, tab(YL, 0.865), ZN + 0.262], [sx * (widthAt(-1.70) + 0.006), 0.672, -1.70]], lampMat);
    // противотуманка в круглой нише; жабры на углу бампера
    const fog = new THREE.Mesh(new THREE.CircleGeometry(0.088, 12), dark), lens = new THREE.Mesh(new THREE.CircleGeometry(0.062, 10), lensMat);
    for (const [m, d] of [[fog, 0.018], [lens, 0.024]]) {
      m.rotation.y = Math.PI - sx * 0.42; m.position.set(sx * (0.645 + d * 0.4), 0.385, -2.175 + tab(LOW, 0.645) - d); loose.push(m);
    }
    for (const y of [0.38, 0.44, 0.50]) part(0.02, 0.03, 0.10, dark, sx * 0.862, y, -1.80);
    // фонари: красные, у внешнего края янтарная секция и белый фонарь заднего хода, яркий стоп; клин на крыле
    put(tailRing, sx * 0.58, 4, 0.45, 0.18, 0.10, stopMat, 0.005);
    put(tailRing, sx * 0.755, 4, 0.30, 0.10, 0.07, amberMat, 0.005);
    put(tailRing, sx * 0.755, 4, 0.74, 0.10, 0.055, badge, 0.005);
    put(tailRing, sx * 0.345, 4, 0.5, 0.012, 0.19, seam, 0.004);
    patch([[sx * 0.844, 0.935, ZT - 0.095], [sx * 0.844, 0.765, ZT - 0.072], [sx * (widthAt(1.89) + 0.006), 0.87, 1.89]], tailMat);
    part(0.10, 0.03, 0.02, tailMat, sx * 0.62, 0.36, 2.17 - tab(LOWT, 0.62));                   // катафот в бампере
    // швы дверей, порог, ручки
    seamLine(sx, [[0.93, -0.79], [0.60, -0.80], [0.30, -0.79]]);
    seamLine(sx, [[0.955, 0.275], [0.30, 0.275]]);
    seamLine(sx, [[0.98, 1.225], [0.80, 1.23], [0.70, 1.19], [0.56, 1.02], [0.42, 0.93], [0.30, 0.89]]);
    seamLine(sx, [[0.305, -0.79], [0.305, 0.89]]);
    handle(sx, 0.83, 0.10);
    handle(sx, 0.85, 1.04);
    // рамки окон: чёрные подоконник и верх, перегородка форточки задней двери
    const frame = (a, b, k) => rod([sx * (BODY[a][k] + 0.004), BODY[a][k + 1], BODY[a][0]], [sx * (BODY[b][k] + 0.004), BODY[b][k + 1], BODY[b][0]], 0.012, 0.022, dark);
    frame(6, 10, 5); frame(10, 13, 5); frame(13, 15, 5); frame(8, 13, 7);
    rod([sx * (sideX(0.985, 0.93) + 0.004), 0.985, 0.93], [sx * (BODY[13][7] + 0.006), BODY[13][8] - 0.02, 0.89], 0.012, 0.03, dark);
    // зеркало в цвет кузова на чёрной ножке
    part(0.06, 0.05, 0.07, paint, sx * 0.835, 0.965, -0.57);
    part(0.155, 0.105, 0.075, paint, sx * 0.915, 0.99, -0.54).rotation.y = sx * -0.2;
    part(0.135, 0.085, 0.01, dark, sx * 0.918, 0.99, -0.498).rotation.y = sx * -0.2;
    part(0.02, 0.035, 0.07, amberMat, sx * (widthAt(-0.91) + 0.002), 0.71, -0.91);              // повторитель
    // накладка порога: выступает за борт между арками, сзади подрезана вверх
    loft([[-0.80, 0.215, 0.33, 0.0], [-0.72, 0.205, 0.325, 0.022], [0.70, 0.205, 0.325, 0.022], [0.80, 0.215, 0.33, 0.0]].map(([z, yb, yt, d]) =>
      [[sideX(yt, z) - 0.01, yt], [sideX(yt, z) + d, yt - 0.02], [sideX(yb, z) + d + 0.006, yb + 0.03], [sideX(yb, z) + d - 0.02, yb], [sideX(yb, z) - 0.06, yb]].map(([x, y]) => [sx * x, y, z])));
    // тёмные ниши арок — накладки по контуру арки, чуть меньше его; брызговики
    for (const [zc, r] of [[-EVO_AXLE, RF], [EVO_AXLE, RR]]) {
      const x = sx * (widthAt(zc) + 0.003), q = r * 0.985;
      patch([[x, 0.21, zc - q], ...ARCH_K.map((k) => [x, EVO_WHEEL_R + q * Math.sqrt(1 - k * k), zc + k * q]), [x, 0.21, zc + q]], dark);
      part(0.17, 0.13, 0.02, flap, sx * 0.785, 0.165, zc + r + 0.005);
    }
  }
  // лючок бензобака — на правом борту, над аркой
  for (const y of [0.80, 0.94]) seamLine(1, [[y, 1.42], [y, 1.57]], 0.012);
  for (const z of [1.42, 1.57]) seamLine(1, [[0.80, z], [0.94, z]], 0.012);

  for (const m of loose) {                                        // бруски вливаются в общие сетки своих материалов
    m.updateMatrix();
    bin(m.material).push(...m.geometry.toNonIndexed().applyMatrix4(m.matrix).attributes.position.array);
  }
  soup.forEach((v, mat) => body.add(new THREE.Mesh(geoOf(v), mat)));

  // колёса: шина с тонкой боковиной, белый обод, тёмное дно диска, двенадцать белых спиц и ступица; красная метка — видно, как крутится
  const cyl = (r, w, n) => new THREE.CylinderGeometry(r, r, w, n).rotateZ(Math.PI / 2);
  const weld = (...geos) => {                                     // несколько геометрий в одну, нормали сохраняются
    const pos = [], nor = [];
    for (const g of geos) { const q = g.toNonIndexed(); pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return geo;
  };
  const spoke = (k) => new THREE.BoxGeometry(0.232, 0.034, 0.42).rotateX(k * Math.PI / 6);
  const blackGeo = weld(cyl(EVO_WHEEL_R, 0.215, 14), cyl(0.205, 0.226, 12)), wallGeo = cyl(0.268, 0.218, 14);
  const rimGeo = weld(cyl(0.232, 0.221, 14), cyl(0.07, 0.238, 6), ...[0, 1, 2, 3, 4, 5].map(spoke));
  const markGeo = new THREE.BoxGeometry(0.242, 0.045, 0.045).translate(0, 0.14, 0);
  const rimMat = lambert({ color: 0xf0f0ec }), wallMat = lambert({ color: 0x2b2c2e }), markMat = lambert({ color: 0xd03a1c });
  const front = [], spin = [];
  for (const z of [-EVO_AXLE, EVO_AXLE]) for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(), wheel = new THREE.Group();
    pivot.position.set(sx * 0.762, EVO_WHEEL_R, z);
    wheel.add(new THREE.Mesh(blackGeo, dark), new THREE.Mesh(wallGeo, wallMat), new THREE.Mesh(rimGeo, rimMat), new THREE.Mesh(markGeo, markMat));
    pivot.add(wheel); car.add(pivot); spin.push(wheel);
    if (z < 0) front.push(pivot);
  }
  car.userData.frontWheels = front;
  car.userData.spin = spin;
  car.userData.body = body;
  return car;
}
