// Модель взята из car_look/lancia/buildLancia_draft.js (её ведёт отдельная сессия); при обновлении черновика —
// обновить копию: python island_src/sync_cars.py write. Файл только объявляет buildLancia(); зовёт её выбор машины и стоянки.
// ---------- Lancia ----------
// Lancia Delta HF Integrale, белая, с двумя полосами — зелёной и красной — по капоту, крыше, козырьку и двери багажника;
// полосы идут не по оси, а правее центра. buildLancia({ stripes: false }) — та же машина без полос (для стоящих копий).
// Размеры сняты с бокового фото (car_look/lancia/side_16v.jpg, база 2.48 м): длина 3.91, свесы 0.76 и 0.67, крыша 1.365.
// Капот плоский, поднимается к лобовому на 9° (0.70 м у носа, 0.87 у лобового), посередине — приподнятая площадка;
// лобовое под 37°, крыша плоская от -0.25 до 1.13 м с козырьком-спойлером, заднее стекло под 33° в окрашенной рамке.
// Подоконник 0.875 м, верх окон 1.25, средняя стойка чёрная, форточка сходит в остриё, за ней чёрная решётка стойки.
// Корма: задняя панель строго вертикальна. Бампер выступает дальше панели, по нему чёрная лента, огибающая углы;
// низ бампера прямой линией поднимается от задней арки к корме. Фонари — трапеции по углам панели (шире книзу,
// янтарный верх, красный низ), между ними номер в тёмной рамке; под бампером справа — две чёрные выхлопные трубы.
// Колёсные арки расширены (габарит 1.75 м): невысокие наплывы со скруглённым плечом, верх — пологая дуга на 0.70 м.
// Спереди — чёрная панель с четырьмя круглыми фарами в хромовых ободках и решёткой в красной рамке; в бампере чёрная
// лента с поворотниками и номером, ниже воздухозаборник и противотуманки. Мелочи: швы и ручки дверей, рамки окон,
// водостоки, чёрный порог, зеркала, дворники, повторители, лючок бака, брызговики, шильдики; колёса белые,
// десятиспицевые, с красной меткой. Накладки лежат на 0.5–1.2 см выше поверхности. База 2.48 м. Нос — к -Z.
const LANCIA_L = 3.93, LANCIA_WHEEL_R = 0.3, LANCIA_AXLE = 1.24;
function buildLancia(o = {}) {
  const car = new THREE.Group(), body = new THREE.Group();        // body качается; колёса остаются на земле
  car.add(body);
  const paint = lambert({ color: 0xe9e9e4 }), glass = lambert({ color: 0x2c3a4c });
  const chrome = lambert({ color: 0xd8dad6 }), dark = lambert({ color: 0x1a1a1a });
  const green = lambert({ color: 0x1e8a46 }), red = lambert({ color: 0xcc2222 });
  const seam = lambert({ color: 0x8e908a }), slat = lambert({ color: 0x3a3d42 }), badge = lambert({ color: 0xe0b020 });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 }), tailMat = new THREE.MeshBasicMaterial({ color: 0xd42020 });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xf08a20 });
  const MATS = [paint, glass, dark], P = 0, G = 1, D = 2;         // номера материалов для pick: кузов, стекло, чёрный

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
  // pick(i, j) -> [материал первого треугольника клетки, второго, другая диагональ]; без третьего числа диагонали
  // клеток зеркальны слева и справа. cap — материал торцов.
  const loft = (rings, pick, cap = paint) => {
    const cs = rings.map(mid), n = rings.length;
    for (let i = 0; i + 1 < n; i++) {
      const A = rings[i], B = rings[i + 1], c = mid([cs[i], cs[i + 1]]);
      for (let j = 0; j < A.length; j++) {
        const k = (j + 1) % A.length, [m0, m1, f] = pick ? pick(i, j) : [paint, paint];
        if (f !== undefined ? f : j >= (A.length - 1) / 2) { tri(bin(m0), A[j], B[j], B[k], c); tri(bin(m1), A[j], B[k], A[k], c); }
        else { tri(bin(m0), A[j], B[j], A[k], c); tri(bin(m1), B[j], B[k], A[k], c); }
      }
    }
    for (const [e, c] of [[0, cs[1]], [n - 1, cs[n - 2]]]) {     // торцы — веером от середины
      const R = rings[e];
      for (let j = 0; j < R.length; j++) tri(bin(cap), cs[e], R[j], R[(j + 1) % R.length], c);
    }
  };
  const skin = (rings, mat = paint) => loft(rings, () => [mat, mat], mat);
  const lerp = (a, b, t) => a + (b - a) * t;

  // --- кузов. Полусечение снизу к оси: низ, пояс, подоконник, верх окна, угол крыши, край плоского верха,
  // край площадки, ось. Кабина (c = 1): стёкла завалены, крыша плоская. Капот и корма (c = 0): плоский верх со
  // скошенным краем; b — высота площадки посередине капота. E — полуширина плоского верха (у заднего стекла — его край).
  // Верх плоский по всей длине хотя бы до |x| = 0.47 — на нём лежат полосы.
  //             z     полушир. пояс   верх   кабина низ   E      b      выгиб вперёд
  const SECT = [[-1.90, 0.70,  0.672, 0.700, 0,    0.50, 0.56,  0.010, 0],      //  0 передняя панель: фары и решётка
                [-1.84, 0.775, 0.690, 0.718, 0,    0.36, 0.56,  0.022, 0],
                [-1.55, 0.79,  0.738, 0.768, 0,    0.32, 0.56,  0.024, 0],
                [-1.24, 0.80,  0.787, 0.817, 0,    0.30, 0.56,  0.024, 0],      //  3 капот над передней осью
                [-0.93, 0.80,  0.836, 0.866, 0,    0.22, 0.56,  0.022, -0.05],  //  4 задняя кромка капота
                [-0.84, 0.80,  0.850, 0.888, 1,    0.19, 0.53,  0,     -0.05],  //  5 низ лобового
                [-0.55, 0.80,  0.855, 1.108, 1,    0.17, 0.53,  0,     0],      //  6 передний угол дверного стекла
                [-0.25, 0.80,  0.855, 1.335, 1,    0.17, 0.53,  0,     0],      //  7 верх лобового
                [-0.02, 0.80,  0.855, 1.360, 1,    0.17, 0.53,  0,     0],
                [ 0.23, 0.80,  0.855, 1.365, 1,    0.17, 0.53,  0,     0],      //  9-10 средняя стойка
                [ 0.31, 0.80,  0.855, 1.365, 1,    0.17, 0.53,  0,     0],
                [ 0.87, 0.80,  0.857, 1.357, 1,    0.17, 0.53,  0,     0],      // 11 задняя кромка стекла задней двери
                [ 1.13, 0.80,  0.860, 1.335, 1,    0.24, 0.53,  0,     0],      // 12 остриё форточки; задний край крыши
                [ 1.19, 0.798, 0.860, 1.296, 1,    0.26, 0.53,  0,     0],      // 13 верх заднего стекла
                [ 1.44, 0.793, 0.861, 1.131, 1,    0.30, 0.56,  0,     0],
                [ 1.68, 0.784, 0.862, 0.974, 0.6,  0.36, 0.585, 0,     0],      // 15 низ заднего стекла
                [ 1.80, 0.775, 0.865, 0.895, 0,    0.38, 0.60,  0,     0]];     // 16 корма: торец — вертикальная задняя панель
  const half = ([, W, M, T, c, B, E, b]) => {
    const h = T - M;
    const hood = [[W, M], [0.995 * W, M + 0.45 * h], [0.97 * W, M + 0.85 * h], [0.92 * W, T], [E, T], [E - 0.06, T + b], [0, T + b]];
    const cab = [[W, M], [0.985 * W, M + 0.04 * h], [0.79 * W, M + 0.775 * h], [0.735 * W, M + 0.93 * h], [E, T], [E - 0.06, T], [0, T]];
    return [[W - 0.02, B], ...hood.map(([x, y], j) => [lerp(x, cab[j][0], c), lerp(y, cab[j][1], c)])];
  };
  const HALF = SECT.map(half);
  const at = (z) => {                                             // полусечение на произвольном z
    let i = 0;
    while (i < SECT.length - 2 && z > SECT[i + 1][0]) i++;
    const t = Math.min(1, Math.max(0, (z - SECT[i][0]) / (SECT[i + 1][0] - SECT[i][0])));
    return HALF[i].map(([x, y], j) => [lerp(x, HALF[i + 1][j][0], t), lerp(y, HALF[i + 1][j][1], t)]);
  };
  const sideX = (y, z) => {                                       // полуширина борта на высоте y
    const h = at(z);
    for (let j = 0; j < 3; j++) if (y <= h[j + 1][1]) return lerp(h[j][0], h[j + 1][0], Math.max(0, (y - h[j][1]) / (h[j + 1][1] - h[j][1] || 1)));
    return h[3][0];
  };
  const widthAt = (z) => at(z)[1][0];
  const rings = SECT.map((s, i) => {
    const h = HALF[i];
    return [...h, ...h.slice(0, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [x, y, s[0] + s[8] * (1 - (x / s[1]) ** 2)]);
  });
  // точки контура: 0 низ, 1 пояс, 2 подоконник, 3 верх окна, 4 угол крыши, 5 край плоского верха, 6 край площадки, 7 ось,
  // дальше зеркально (8..14)
  loft(rings, (i, j) => {
    if (j === 14) return [dark, dark];                                              // днище
    const top = j >= 4 && j <= 9, side = j === 2 || j === 11;
    if (i === 4 && top) return [dark, dark];                                        // чёрная полка под дворниками
    if ((i === 5 || i === 6) && top) return [glass, glass];                         // лобовое стекло
    if ((i === 13 || i === 14) && j >= 5 && j <= 8) return [glass, glass];          // заднее стекло в окрашенной рамке
    if (side) {
      if (i === 6) return j === 2 ? [glass, paint, true] : [paint, glass, false];   // передний край дверного — косой, вдоль стойки
      if (i === 7 || i === 8 || i === 10) return [glass, glass];                    // стёкла передней и задней дверей
      if (i === 9) return [dark, dark];                                             // чёрная средняя стойка
      if (i === 11) return j === 2 ? [glass, paint, false] : [paint, glass, true];  // форточка: задний край параллелен заднему стеклу
    }
    return [paint, paint];
  });

  // --- расширения арок. Сечение: от кромки на борту кузова (верх) скруглённым плечом наружу к стенке xo
  // и вниз до кромки арки; внутренний край утоплен в кузов, снизу закрыто. Верхняя кромка идёт пологой дугой —
  // выше всего над осью; к концам расширение плавно сходит на нет. Над колесом низ поднят полукругом — арка.
  const ARCH_R = 0.32, ARCH_K = [-1, -0.8, -0.42, 0, 0.42, 0.8, 1];
  const arch = (zc, tops) => ARCH_K.map((k, n) => [zc + k * ARCH_R, LANCIA_WHEEL_R + ARCH_R * Math.sqrt(1 - k * k), tops[n], 0.875]);
  //              z     низ   верх   xo
  const FRONT = [[-1.80, 0.30, 0.50,  0.835],                     // вырастает из угла бампера
                 [-1.68, 0.28, 0.645, 0.862],
                 ...arch(-LANCIA_AXLE, [0.675, 0.688, 0.698, 0.70, 0.698, 0.688, 0.675]),
                 [-0.80, 0.24, 0.645, 0.86],
                 [-0.62, 0.24, 0.50,  0.803]];                    // сходит на нет в передней двери
  const REAR = [[0.62, 0.22, 0.50,  0.803],                       // вырастает из задней двери
                [0.80, 0.22, 0.65,  0.86],
                ...arch(LANCIA_AXLE, [0.688, 0.702, 0.712, 0.715, 0.712, 0.702, 0.688]),
                [1.66, 0.29, 0.66,  0.868],
                [1.76, 0.33, 0.56,  0.84]];                       // уходит в задний бампер
  for (const sx of [-1, 1]) for (const st of [FRONT, REAR]) {
    skin(st.map(([z, yb, yt, xo]) => {
      const r = [], xc = widthAt(z);
      for (let j = 0; j <= 6; j++) {
        const a = j * Math.PI / 6, co = Math.cos(a);
        r.push([sx * (xc + (co > 0 ? xo - xc : xc - 0.6) * co), yb + (yt - yb) * Math.pow(Math.sin(a), 0.45), z]);
      }
      return r;
    }));
  }

  // --- бамперы и спойлер — плиты со скошенными рёбрами; к концу сужаются, углы в плане срезаны
  const slab = ([z, W, yb, yt], r = 0.04) =>
    [[W, yb + r], [W, yt - r], [W - r, yt], [-W + r, yt], [-W, yt - r], [-W, yb + r], [-W + r, yb], [W - r, yb]].map(([x, y]) => [x, y, z]);
  skin([[-1.99, 0.66, 0.26, 0.50], [-1.94, 0.795, 0.24, 0.52], [-1.78, 0.835, 0.24, 0.52]].map((s) => slab(s)));          // передний бампер
  skin([[-1.997, 0.665, 0.425, 0.502], [-1.947, 0.805, 0.425, 0.505], [-1.80, 0.842, 0.425, 0.505]].map((s) => slab(s, 0.02)), dark);   // чёрная лента
  // задний бампер выступает дальше панели; его низ прямой линией поднимается от арки к корме
  skin([[1.60, 0.835, 0.27, 0.56], [1.74, 0.84, 0.335, 0.56], [1.865, 0.825, 0.40, 0.56], [1.905, 0.73, 0.42, 0.55]].map((s) => slab(s)));
  skin([[1.61, 0.845, 0.445, 0.535], [1.872, 0.835, 0.445, 0.535], [1.915, 0.735, 0.45, 0.53]].map((s) => slab(s, 0.02)), dark);       // чёрная лента по нему
  const SPOILER = [[1.05, 0.56, 1.325, 1.358], [1.27, 0.60, 1.335, 1.385]];
  skin(SPOILER.map((s) => slab(s, 0.012)));                                                                             // козырёк над задним стеклом

  // --- полосы: ленты на 1.2 см над плоским верхом кузова, правее оси (+X — правый борт); на стёклах полос нет
  const TAIL = 1.80, UP = 0.012;
  if (o.stripes !== false) {
    const top = (a, b) => SECT.slice(a, b).map(([z, , , T, , , , bb]) => [T + bb + UP, z]);
    const PATHS = [[[0.69, -1.90 - UP], ...top(0, 4), [0.866 + 0.022 + UP, -0.965]],                    // капот
                   [...top(7, 12), [1.343 + UP, 1.06]],                             // крыша
                   SPOILER.map(([z, , , yt]) => [yt + UP, z]),                      // козырёк
                   [[0.974 + UP, 1.68], [0.895 + UP, TAIL + UP], [0.57, TAIL + UP]]];   // полка под стеклом и задняя панель
    for (const [x0, x1, mat] of [[0.22, 0.33, green], [0.36, 0.47, red]]) {
      for (const path of PATHS) for (let k = 0; k + 1 < path.length; k++) {
        const [ya, za] = path[k], [yb, zb] = path[k + 1];
        tri(bin(mat), [x0, ya, za], [x1, ya, za], [x1, yb, zb], [0.28, 0.6, 0]);
        tri(bin(mat), [x0, ya, za], [x1, yb, zb], [x0, yb, zb], [0.28, 0.6, 0]);
      }
    }
  }

  // --- детали. part — брусок; rod — брусок сечением w × h между двумя точками; patch — плоская накладка-многоугольник
  const part = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); loose.push(m); return m; };
  const rod = (a, b, w, h, mat) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = part(w, h, A.distanceTo(B), mat, 0, 0, 0);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.sub(A).normalize());
    return m;
  };
  const patch = (pts, mat, c = [0, 0.6, 0]) => { for (let k = 1; k + 1 < pts.length; k++) tri(bin(mat), pts[0], pts[k], pts[k + 1], c); };
  const disc = (r, mat, x, y, z, n = 12) => {                     // круг лицом вперёд
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, n), mat);
    m.rotation.y = Math.PI; m.position.set(x, y, z); loose.push(m);
  };
  const sidePt = (sx, y, z, d = 0.005) => [sx * (sideX(y, z) + d), y, z];
  const line = (sx, j, a, b, mat, w = 0.012, h = 0.022, d = 0.005) => {       // брусок вдоль точки контура j от сечения a до b
    for (let i = a; i < b; i++) rod([sx * (HALF[i][j][0] + d), HALF[i][j][1], SECT[i][0]], [sx * (HALF[i + 1][j][0] + d), HALF[i + 1][j][1], SECT[i + 1][0]], w, h, mat);
  };

  // перед: чёрная панель во всю ширину, в ней решётка в красной рамке и четыре круглые фары в хромовых ободках
  const NOSE = -1.90;
  part(1.38, 0.155, 0.02, dark, 0, 0.61, NOSE - 0.002);
  for (const y of [0.675, 0.545]) part(0.72, 0.016, 0.02, red, 0, y, NOSE - 0.012);
  for (const x of [-0.36, 0.36]) part(0.016, 0.146, 0.02, red, x, 0.61, NOSE - 0.012);
  for (const y of [0.578, 0.61, 0.642]) part(0.68, 0.012, 0.02, slat, 0, y, NOSE - 0.008);     // ламели решётки
  part(0.05, 0.13, 0.02, chrome, 0, 0.61, NOSE - 0.016);                                      // щиток Lancia
  part(0.07, 0.035, 0.02, badge, 0.24, 0.585, NOSE - 0.016);                                  // шильдик HF
  // передний бампер: в ленте номер и поворотники по краям, ниже — воздухозаборник и противотуманки
  const BUMP = -1.99;
  part(0.40, 0.095, 0.02, chrome, 0, 0.462, BUMP - 0.014);
  part(0.76, 0.10, 0.02, dark, 0, 0.335, BUMP - 0.004);
  for (const y of [0.31, 0.36]) part(0.74, 0.012, 0.02, paint, 0, y, BUMP - 0.008);            // рёбра воздухозаборника
  part(0.04, 0.035, 0.03, red, -0.44, 0.285, BUMP - 0.008);                                   // буксирная проушина
  // капот: две чёрные прорези слева от полос
  part(0.5, 0.012, 0.07, dark, -0.2, 0.886, -1.0).rotation.x = -0.157;
  part(0.3, 0.012, 0.06, dark, -0.31, 0.829, -1.38).rotation.x = -0.157;
  // дворники: лобовое — между сечениями 5 и 7, заднее стекло — между 13 и 15
  const ws = (x, t) => [x, lerp(0.888, 1.335, t) + 0.014, lerp(-0.84 - 0.05 * (1 - (x / 0.8) ** 2), -0.25, t) - 0.008];
  rod(ws(0.50, 0.035), ws(0.04, 0.15), 0.022, 0.016, dark);
  rod(ws(-0.06, 0.035), ws(-0.52, 0.15), 0.022, 0.016, dark);
  const rg = (x, t) => [x, lerp(1.296, 0.974, t) + 0.014, lerp(1.19, 1.68, t) + 0.008];
  rod(rg(-0.02, 0.95), rg(0.34, 0.80), 0.022, 0.016, dark);
  // корма: номер в тёмной рамке между фонарями, под ним ручка; эмблема на полке под стеклом, шильдики на панели
  const onPanel = (x, y) => [x, y, TAIL + UP];
  part(0.50, 0.135, 0.02, dark, 0, 0.72, TAIL + 0.004);
  part(0.43, 0.095, 0.02, chrome, 0, 0.72, TAIL + 0.012);
  part(0.12, 0.03, 0.02, dark, 0, 0.615, TAIL + 0.006);
  part(0.05, 0.012, 0.05, slat, 0, 0.936 + 0.008, 1.74).rotation.x = 0.58;
  part(0.13, 0.03, 0.02, slat, -0.36, 0.61, TAIL + 0.004);                                    // «HF integrale» слева
  part(0.05, 0.03, 0.02, badge, -0.25, 0.61, TAIL + 0.004);
  part(0.14, 0.035, 0.02, tailMat, -0.45, 0.365, 1.868);                                      // задний противотуманный фонарь
  // фонарь-трапеция на панели: внутренний край вертикален, внешний идёт вдоль угла кузова
  const lampPatch = (mat, xa, ya, xb, yb, sx) => patch([onPanel(sx * 0.5, ya), onPanel(sx * xa, ya), onPanel(sx * xb, yb), onPanel(sx * 0.5, yb)], mat);
  for (const sx of [-1, 1]) {
    for (const [x, r] of [[0.60, 0.066], [0.455, 0.055]]) {                                    // фары: внешняя крупнее
      disc(r + 0.013, chrome, sx * x, 0.61, NOSE - 0.013);
      disc(r, lensMat, sx * x, 0.61, NOSE - 0.018);
    }
    part(0.15, 0.05, 0.03, amberMat, sx * 0.55, 0.465, BUMP - 0.002);                          // поворотник в бампере
    part(0.12, 0.06, 0.02, lensMat, sx * 0.53, 0.335, BUMP - 0.004);                           // противотуманка
    lampPatch(amberMat, 0.70, 0.855, 0.717, 0.75, sx);                                         // задний фонарь: янтарный верх,
    lampPatch(tailMat, 0.717, 0.75, 0.745, 0.585, sx);                                         // красный низ
    // тёмные ниши арок — накладки по контуру арки, чуть меньше его
    for (const zc of [-LANCIA_AXLE, LANCIA_AXLE]) {
      const x = sx * (widthAt(zc) + 0.004), r = ARCH_R - 0.006;
      patch([[x, 0.17, zc - r], ...ARCH_K.map((k) => [x, LANCIA_WHEEL_R + r * Math.sqrt(1 - k * k), zc + k * r]), [x, 0.17, zc + r]], dark);
      part(0.17, 0.11, 0.02, dark, sx * 0.76, 0.20, zc + 0.34);                             // брызговик
    }
    // рамки окон: подоконник, верх, передняя и задняя кромки, стойка форточки; за форточкой — чёрная решётка стойки
    line(sx, 2, 6, 12, dark);
    line(sx, 3, 7, 11, dark);
    rod([sx * (HALF[6][2][0] + 0.005), HALF[6][2][1], -0.55], [sx * (HALF[7][3][0] + 0.005), HALF[7][3][1], -0.25], 0.012, 0.03, dark);
    rod([sx * (HALF[11][2][0] + 0.006), HALF[11][2][1], 0.87], [sx * (HALF[11][3][0] + 0.006), HALF[11][3][1], 0.87], 0.012, 0.03, dark);
    patch([sidePt(sx, 1.24, 0.875, 0.008), sidePt(sx, 1.24, 0.98, 0.008), sidePt(sx, 0.885, 1.27, 0.008), sidePt(sx, 0.885, 1.115, 0.008)], dark);
    line(sx, 4, 7, 12, seam, 0.012, 0.014, 0.004);                                             // водосток по краю крыши
    line(sx, 4, 12, 15, seam, 0.012, 0.014, 0.004);                                            // шов двери багажника
    // швы дверей, ручки, повторитель, порог, зеркало
    for (const [z, y0, y1] of [[-0.80, 0.26, 0.845], [0.24, 0.26, 0.85], [1.21, 0.72, 0.855]]) rod(sidePt(sx, y0, z, 0.003), sidePt(sx, y1, z, 0.003), 0.012, 0.016, seam);
    part(0.02, 0.05, 0.15, dark, sx * 0.806, 0.77, 0.10);
    part(0.02, 0.05, 0.15, dark, sx * 0.806, 0.795, 1.05);
    part(0.02, 0.035, 0.05, amberMat, sx * 0.806, 0.735, -0.90);
    part(0.03, 0.085, 1.66, dark, sx * 0.80, 0.212, 0.02);
    part(0.07, 0.04, 0.05, dark, sx * 0.83, 0.905, -0.60);
    part(0.06, 0.10, 0.15, dark, sx * 0.875, 0.93, -0.62).rotation.y = sx * 0.25;
  }
  // лючок бензобака — на левом борту, над аркой
  patch([sidePt(-1, 0.75, 1.42, 0.004), sidePt(-1, 0.75, 1.55, 0.004), sidePt(-1, 0.85, 1.55, 0.004), sidePt(-1, 0.85, 1.42, 0.004)], seam);
  patch([sidePt(-1, 0.762, 1.432, 0.008), sidePt(-1, 0.762, 1.538, 0.008), sidePt(-1, 0.838, 1.538, 0.008), sidePt(-1, 0.838, 1.432, 0.008)], paint);
  for (const x of [0.43, 0.53]) {                                                             // две выхлопные трубы рядом, тёмный графит
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), slat);
    pipe.geometry.rotateX(Math.PI / 2); pipe.position.set(x, 0.34, 1.835); loose.push(pipe);
  }

  for (const m of loose) {                                        // бруски вливаются в общие сетки своих материалов
    m.updateMatrix();
    bin(m.material).push(...m.geometry.toNonIndexed().applyMatrix4(m.matrix).attributes.position.array);
  }
  soup.forEach((v, mat) => body.add(new THREE.Mesh(geoOf(v), mat)));

  // колёса: шина с боковиной, белый обод, тёмное дно диска, десять белых спиц и ступица; красная метка — видно, как крутится
  const cyl = (r, w, n) => new THREE.CylinderGeometry(r, r, w, n).rotateZ(Math.PI / 2);
  const weld = (...geos) => {                                     // несколько геометрий в одну, нормали сохраняются
    const pos = [], nor = [];
    for (const g of geos) { const q = g.toNonIndexed(); pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return geo;
  };
  const spoke = (k) => new THREE.BoxGeometry(0.218, 0.05, 0.38).rotateX(k * Math.PI / 5);
  const blackGeo = weld(cyl(LANCIA_WHEEL_R, 0.20, 16), cyl(0.188, 0.212, 12)), wallGeo = cyl(0.262, 0.203, 16);
  const rimGeo = weld(cyl(0.214, 0.206, 14), cyl(0.075, 0.224, 8), ...[0, 1, 2, 3, 4].map(spoke));
  const markGeo = new THREE.BoxGeometry(0.228, 0.05, 0.05).translate(0, 0.125, 0);
  const rimMat = lambert({ color: 0xf0f0ec }), wallMat = lambert({ color: 0x2b2c2e });
  const front = [], spin = [];
  for (const z of [-LANCIA_AXLE, LANCIA_AXLE]) for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(), wheel = new THREE.Group();
    pivot.position.set(sx * 0.75, LANCIA_WHEEL_R, z);
    wheel.add(new THREE.Mesh(blackGeo, dark), new THREE.Mesh(wallGeo, wallMat), new THREE.Mesh(rimGeo, rimMat), new THREE.Mesh(markGeo, red));
    pivot.add(wheel); car.add(pivot); spin.push(wheel);
    if (z < 0) front.push(pivot);
  }
  car.userData.frontWheels = front;
  car.userData.spin = spin;
  car.userData.body = body;
  return car;
}
