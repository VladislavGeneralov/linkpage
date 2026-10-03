// Модель взята из car_look/beetle/buildBeetle_draft.js (её ведёт отдельная сессия); при обновлении черновика —
// обновить копию: python island_src/sync_cars.py write. Файл только объявляет buildBeetle(); зовёт её выбор машины и стоянки.
// ---------- Жук ----------
// Volkswagen Käfer середины 60-х (1300, 1966), жёлтый. Размеры сняты с бокового фото (база 2.4 м = 1102 пикселя):
// длина 4.07 м по бамперам, передний свес кузова 0.63 м, задний 0.68; высота 1.5 м, макушка крыши чуть позади середины базы.
// Капот — высокий купол между крыльями: 1.05 м у лобового, 0.98 над передней осью, к носу загибается вниз языком.
// Лобовое — от 1.05 до 1.40 м, в плане выгнуто вперёд; стойка узкая, передняя кромка дверного стекла идёт вдоль неё.
// Крыша и корма — одна выпуклая дуга: 1.40 м над задним стеклом, 1.17 под ним, дальше полка с жалюзи и крышка мотора.
// Борт под окнами выпуклый: шире всего на 0.69 м от земли, к порогу подобран; пояс (хромовый молдинг) на 0.9 м.
// Кузов и крылья — обшивка по сечениям; стёкла — клетки той же обшивки. Крылья — отдельные наплывы с вырезами арок:
// гребень переднего 0.845 м над осью, нос — стакан наклонённой назад фары; заднее длиннее, на его скате фонарь
// (янтарный верх, красный низ). Хромовые бамперы-лезвия с клыками и дугой, подножки с хромовой кромкой.
// Всё, кроме колёс, сливается в одну сетку на материал. Оси колёс z = ±1.2. Нос — к -Z.
const BEETLE_FRONT = 1.96, BEETLE_REAR = 2.11, BEETLE_L = BEETLE_FRONT + BEETLE_REAR, BEETLE_WHEEL_R = 0.32;
function buildBeetle() {
  const beetle = new THREE.Group(), body = new THREE.Group();    // body качается; колёса остаются на земле
  beetle.add(body);
  const yellow = lambert({ color: 0xf2c418 }), glass = lambert({ color: 0x2c3a4c });
  const chrome = lambert({ color: 0xd8dad6 }), dark = lambert({ color: 0x1a1a1a });
  const seam = lambert({ color: 0x8a6c10 }), plate = lambert({ color: 0xe9e9e4 }), rubber = lambert({ color: 0x2b2c2e });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 }), tailMat = new THREE.MeshBasicMaterial({ color: 0xd42020 });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xf08a20 });
  const MATS = [yellow, glass, dark];                             // номера материалов для pick: кузов, стекло, чёрный
  const P = 0, G = 1, D = 2;

  // Треугольники копятся по материалам и в конце становятся одной сеткой на материал.
  const soup = new Map(), loose = [];
  const bin = (mat) => soup.get(mat) || soup.set(mat, []).get(mat);
  const mid = (r) => r.reduce((c, p) => [c[0] + p[0] / r.length, c[1] + p[1] / r.length, c[2] + p[2] / r.length], [0, 0, 0]);
  const tri = (dst, a, b, c, o) => {                              // обход выставляется наружу от точки o внутри тела
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
  // pick(i, j) -> [материал первого треугольника клетки, второго, другая диагональ]; диагонали зеркальны слева и справа.
  const loft = (rings, pick, sym = true) => {
    const cs = rings.map(mid), n = rings.length;
    for (let i = 0; i + 1 < n; i++) {
      const A = rings[i], B = rings[i + 1], o = mid([cs[i], cs[i + 1]]);
      for (let j = 0; j < A.length; j++) {
        const k = (j + 1) % A.length, [m0, m1, f] = pick ? pick(i, j) : [P, P];
        const flip = f !== undefined ? f : sym && j >= (A.length - 1) / 2;
        if (flip) { tri(bin(MATS[m0]), A[j], B[j], B[k], o); tri(bin(MATS[m1]), A[j], B[k], A[k], o); }
        else { tri(bin(MATS[m0]), A[j], B[j], A[k], o); tri(bin(MATS[m1]), B[j], B[k], A[k], o); }
      }
    }
    for (const [e, o] of [[0, cs[1]], [n - 1, cs[n - 2]]]) {     // торцы — веером от середины
      const R = rings[e];
      for (let j = 0; j < R.length; j++) tri(bin(yellow), cs[e], R[j], R[(j + 1) % R.length], o);
    }
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const tab = (T, x) => {                                         // кусочно-линейная таблица [x, значение]
    let i = 0;
    while (i < T.length - 2 && x > T[i + 1][0]) i++;
    return lerp(T[i][1], T[i + 1][1], Math.min(1, Math.max(0, (x - T[i][0]) / (T[i + 1][0] - T[i][0]))));
  };

  // --- кузов. Полусечение снизу вверх: низ, подбор к порогу, самое широкое место борта, пояс, дальше шесть точек до оси.
  // Капот и корма (c = 0): от пояса к оси — дуга эллипса. Кабина (c = 1): подоконник S, верх стекла Gy, карниз (We, E),
  // две точки крыши, ось T. Между ними — смесь. k — выпуклость борта под поясом.
  const DOME = [0, 1, 2, 3, 4, 5, 6].map((n) => [Math.cos(n * Math.PI / 12), Math.sin(n * Math.PI / 12)]);
  //             z      W     M      T      c    Wb    B     k      S      Gy     We    E
  const SECT = [[-1.835, 0.09, 0.50, 0.53,  0,   0.07, 0.45, 0],                              //  0 нос капота
                [-1.80, 0.19, 0.50, 0.62,  0,   0.16, 0.40, 0],
                [-1.72, 0.27, 0.55, 0.715, 0,   0.23, 0.36, 0],
                [-1.58, 0.34, 0.63, 0.82,  0,   0.29, 0.33, 0],
                [-1.42, 0.40, 0.70, 0.905, 0,   0.35, 0.31, 0],
                [-1.20, 0.46, 0.77, 0.98,  0,   0.40, 0.30, 0],                              //  5 над передней осью
                [-0.97, 0.54, 0.83, 1.03,  0,   0.48, 0.30, 0],
                [-0.76, 0.625, 0.885, 1.05, 0,  0.57, 0.30, 0.008],                           //  7 задняя кромка капота
                [-0.47, 0.665, 0.90, 1.055, 1,  0.61, 0.30, 0.018, 0.98, 1.02, 0.565, 1.0],    //  8 низ лобового (в плане выгнут вперёд)
                [-0.31, 0.67, 0.905, 1.40,  1,  0.61, 0.30, 0.018, 0.98, 1.294, 0.49, 1.33], //  9 верх лобового
                [-0.187, 0.67, 0.905, 1.452, 1, 0.61, 0.30, 0.018, 0.98, 1.294, 0.51, 1.34],  // 10 стойка форточки
                [ 0.02, 0.67, 0.905, 1.48,  1,  0.61, 0.30, 0.018, 0.98, 1.294, 0.515, 1.345],
                [ 0.20, 0.67, 0.905, 1.493, 1,  0.61, 0.30, 0.018, 0.98, 1.294, 0.515, 1.345], // 12 макушка крыши
                [ 0.317, 0.67, 0.905, 1.493, 1, 0.61, 0.30, 0.018, 0.98, 1.294, 0.515, 1.345], // 13-14 средняя стойка
                [ 0.425, 0.67, 0.905, 1.488, 1, 0.61, 0.30, 0.018, 0.98, 1.294, 0.515, 1.345],
                [ 0.60, 0.67, 0.905, 1.477, 1,  0.61, 0.30, 0.016, 0.98, 1.285, 0.515, 1.34],
                [ 0.75, 0.668, 0.90, 1.457, 1,  0.61, 0.30, 0.012, 0.98, 1.25, 0.51, 1.33],
                [ 0.90, 0.665, 0.90, 1.428, 1,  0.60, 0.30, 0.008, 0.98, 1.185, 0.505, 1.31],
                [ 1.00, 0.66, 0.895, 1.396, 1,  0.60, 0.30, 0.004, 0.98, 1.09, 0.50, 1.285],  // 18 верх заднего стекла
                [ 1.06, 0.655, 0.89, 1.37,  0.9, 0.59, 0.30, 0,    0.975, 0.99, 0.495, 1.265], // 19 задний угол бокового стекла
                [ 1.20, 0.64, 0.875, 1.285, 0.7, 0.58, 0.30, 0,    0.96, 0.97, 0.49, 1.195],
                [ 1.33, 0.615, 0.855, 1.175, 0.5, 0.56, 0.30, 0,   0.93, 0.94, 0.49, 1.10],   // 21 низ заднего стекла
                [ 1.43, 0.585, 0.82, 1.085, 0.25, 0.53, 0.31, 0,   0.89, 0.90, 0.48, 1.02],   // 22 полка с жалюзи
                [ 1.52, 0.55, 0.78, 1.01,  0,   0.50, 0.31, 0],                              // 23 верхняя кромка крышки мотора
                [ 1.62, 0.50, 0.72, 0.925, 0,   0.45, 0.31, 0],
                [ 1.70, 0.45, 0.65, 0.82,  0,   0.40, 0.32, 0],
                [ 1.76, 0.40, 0.58, 0.715, 0,   0.35, 0.33, 0],
                [ 1.81, 0.34, 0.52, 0.62,  0,   0.29, 0.35, 0],
                [ 1.85, 0.27, 0.47, 0.535, 0,   0.22, 0.38, 0],
                [ 1.875, 0.18, 0.43, 0.46, 0,   0.14, 0.40, 0]];                              // 29 корма
  const half = (s) => {
    const [, W, M, T, c, Wb, B, k] = s;
    const low = [[Wb, B], [lerp(Wb, W, 0.75) + k * 0.4, lerp(B, M, 0.3)], [W + k, lerp(B, M, 0.64)]];
    const dome = DOME.map(([u, v]) => [W * u, M + (T - M) * v]);
    if (!c) return [...low, ...dome];
    const [S, Gy, We, E] = s.slice(8), Ws = W - 0.03, t = (Gy - S) / (E - S);
    const cab = [[W, M], [Ws, S], [lerp(Ws, We, t), Gy], [We, E], [We * 0.84, lerp(E, T, 0.55)], [We * 0.45, lerp(E, T, 0.92)], [0, T]];
    return [...low, ...cab.map(([x, y], j) => [lerp(dome[j][0], x, c), lerp(dome[j][1], y, c)])];
  };
  const HALF = SECT.map(half);
  // сдвиг точек сечения по z: низ лобового выгнут вперёд, стойка лобового уже у крыши
  const DZ = { 8: [0, 0, 0, 0, 0, 0.02, -0.045, -0.09, -0.115, -0.125], 9: [0, 0, 0, 0, 0, 0, -0.025, -0.04, -0.048, -0.05],
               18: [0, 0, 0, 0, 0, 0, 0, -0.01, -0.03, -0.035], 21: [0, 0, 0, 0, 0, 0, 0, 0.01, 0.03, 0.035] };
  const rings = SECT.map((s, i) => {
    const h = HALF[i].map(([x, y], j) => [x, y, s[0] + (DZ[i] ? DZ[i][j] : 0)]);
    return [...h, ...h.slice(0, -1).reverse().map(([x, y, z]) => [-x, y, z])];
  });
  // точки контура: 0 низ, 1 подбор, 2 выпуклость, 3 пояс, 4 подоконник, 5 верх стекла, 6 карниз, 7-8 крыша, 9 ось, дальше зеркально
  loft(rings, (i, j) => {
    if (j === 18) return [D, D];                                                    // днище
    if (i === 8 && j >= 6 && j <= 11) return [G, G];                                // лобовое
    if (i >= 18 && i <= 20 && j >= 7 && j <= 10) return [G, G];                     // заднее стекло
    if ((j === 4 || j === 13) && ((i >= 8 && i <= 12) || (i >= 14 && i <= 18))) return [G, G];   // дверное и заднее боковое
    return [P, P];
  });
  const at = (z) => {                                             // полусечение на произвольном z (без сдвигов)
    let i = 0;
    while (i < SECT.length - 2 && z > SECT[i + 1][0]) i++;
    const t = Math.min(1, Math.max(0, (z - SECT[i][0]) / (SECT[i + 1][0] - SECT[i][0])));
    return HALF[i].map(([x, y], j) => [lerp(x, HALF[i + 1][j][0], t), lerp(y, HALF[i + 1][j][1], t)]);
  };
  const sideX = (y, z) => {                                       // полуширина кузова на высоте y
    const h = at(z);
    for (let j = 0; j < 9; j++) if (y <= h[j + 1][1]) return lerp(h[j][0], h[j + 1][0], Math.max(0, (y - h[j][1]) / (h[j + 1][1] - h[j][1] || 1)));
    return 0;
  };
  const topY = (x, z) => {                                        // высота верха кузова над точкой (x, z)
    const h = at(z), ax = Math.abs(x);
    for (let j = 3; j < 9; j++) if (ax >= h[j + 1][0]) return lerp(h[j][1], h[j + 1][1], Math.max(0, (h[j][0] - ax) / (h[j][0] - h[j + 1][0] || 1)));
    return h[9][1];
  };

  // --- крылья. Сечение — дуга от внешней кромки xo через гребень xc к внутреннему краю xi (утоплен в кузов),
  // снизу закрыта. Над колесом низ крыла поднят дугой — колёсная арка.
  const ARCH_R = 0.335, ARCH_K = [-1, -0.8, -0.42, 0, 0.42, 0.8, 1];
  const arch = (zc, ry, tops, xo, xc) => ARCH_K.map((k, n) => [zc + k * ARCH_R, BEETLE_WHEEL_R + ry * Math.sqrt(1 - k * k), tops[n], xo, 0.36, xc]);
  //              z      низ   верх   xo    xi    xc
  const FRONT = [[-1.725, 0.47, 0.60, 0.64, 0.46, 0.56],          // нос крыла — стакан фары
                 [-1.69, 0.42, 0.685, 0.705, 0.40, 0.565],
                 [-1.62, 0.385, 0.75, 0.75, 0.36, 0.58],
                 ...arch(-1.2, 0.38, [0.752, 0.785, 0.825, 0.845, 0.828, 0.79, 0.752], 0.775, 0.60),
                 [-0.80, 0.31, 0.70, 0.775, 0.40, 0.62],
                 [-0.70, 0.31, 0.57, 0.765, 0.45, 0.64],
                 [-0.64, 0.31, 0.42, 0.75, 0.50, 0.66],           // круто сходит в подножку у передней кромки двери
                 [-0.61, 0.30, 0.33, 0.74, 0.52, 0.66]];
  const REAR = [[0.74, 0.30, 0.34, 0.74, 0.52, 0.66],             // круто поднимается из подножки перед колесом
                [0.76, 0.31, 0.44, 0.755, 0.50, 0.65],
                [0.80, 0.31, 0.60, 0.77, 0.45, 0.63],
                ...arch(1.2, 0.345, [0.71, 0.775, 0.825, 0.833, 0.79, 0.715, 0.66], 0.775, 0.60),
                [1.62, 0.33, 0.575, 0.76, 0.34, 0.59],            // задний скат, на нём фонарь
                [1.70, 0.31, 0.47, 0.72, 0.32, 0.57],
                [1.76, 0.30, 0.38, 0.67, 0.30, 0.54],
                [1.80, 0.30, 0.33, 0.62, 0.30, 0.50]];            // хвост крыла подобран к корме
  for (const sx of [-1, 1]) for (const st of [FRONT, REAR]) {
    loft(st.map(([z, yb, yt, xo, xi, xc]) => {
      const r = [];
      for (let j = 0; j <= 6; j++) {
        const a = j * Math.PI / 6, co = Math.cos(a);
        r.push([sx * (xc + (co > 0 ? xo - xc : xc - xi) * co), yb + (yt - yb) * Math.pow(Math.sin(a), 0.62), z]);
      }
      return r;
    }), null, false);
  }

  // --- детали. part — брусок; rod — брусок сечением w × h между двумя точками; patch — плоская накладка-многоугольник
  const part = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); loose.push(m); return m; };
  const rod = (a, b, w, h, mat) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = part(w, h, A.distanceTo(B), mat, 0, 0, 0);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.sub(A).normalize());
    return m;
  };
  const patch = (pts, mat, o = [0, 0.6, 0]) => { for (let k = 1; k + 1 < pts.length; k++) tri(bin(mat), pts[0], pts[k], pts[k + 1], o); };
  const disc = (r, n, mat, x, y, z, rx, ry) => {                  // круглая накладка
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, n), mat);
    m.rotation.order = 'YXZ'; m.rotation.set(rx, ry, 0); m.position.set(x, y, z); loose.push(m); return m;
  };
  const sidePt = (sx, y, z, d = 0.012) => [sx * (sideX(y, z) + d), y, z];
  const sideLine = (sx, pts, w, h, mat, d) => { for (let k = 0; k + 1 < pts.length; k++) rod(sidePt(sx, ...pts[k], d), sidePt(sx, ...pts[k + 1], d), w, h, mat); };
  const topPt = (x, z, d = 0.012) => [x, topY(x, z) + d, z];

  for (const sx of [-1, 1]) {
    // фара: хромовый ободок в носу крыла, стекло наклонено назад
    const lamp = new THREE.Group(), rim = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.07, 12), chrome);
    rim.geometry.rotateX(Math.PI / 2);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.098, 12), lensMat);
    lens.rotation.y = Math.PI; lens.position.z = -0.036;
    lamp.add(rim, lens); lamp.position.set(sx * 0.565, 0.625, -1.685); lamp.rotation.x = 0.38; lamp.updateMatrixWorld(true);
    for (const m of [rim, lens]) { m.geometry = m.geometry.clone().applyMatrix4(m.matrixWorld); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); loose.push(m); }
    // поворотник на гребне крыла: хромовый корпус-капля, янтарное стекло
    part(0.05, 0.03, 0.13, chrome, sx * 0.60, 0.845, -1.36).rotation.x = -0.12;
    part(0.04, 0.026, 0.07, amberMat, sx * 0.60, 0.858, -1.375).rotation.x = -0.12;
    // задний фонарь: округлый корпус на скате крыла, верх янтарный, низ красный, хромовое основание
    const tail = new THREE.Group();
    tail.add(new THREE.Mesh(new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI * 0.42), amberMat),
             new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), tailMat));
    tail.scale.set(0.062, 0.09, 0.062); tail.position.set(sx * 0.585, 0.55, 1.705); tail.rotation.x = -0.45; tail.updateMatrixWorld(true);
    for (const m of tail.children) { m.geometry = m.geometry.clone().applyMatrix4(tail.matrixWorld); loose.push(m); }
    // подножка: чёрная резина, хромовая кромка
    part(0.15, 0.04, 1.36, rubber, sx * 0.70, 0.285, 0.065);
    part(0.02, 0.028, 1.36, chrome, sx * 0.782, 0.282, 0.065);
    // швы двери, молдинг по поясу, ручка, зеркало
    sideLine(sx, [[0.31, -0.59], [0.5, -0.59], [0.69, -0.59], [0.905, -0.59], [0.98, -0.575], [1.0, -0.56]], 0.012, 0.018, seam, 0.004);
    sideLine(sx, [[0.31, 0.375], [0.5, 0.375], [0.69, 0.375], [0.905, 0.375], [0.98, 0.375], [1.294, 0.375], [1.335, 0.375]], 0.012, 0.018, seam, 0.004);
    sideLine(sx, [[0.315, -0.59], [0.315, 0.375]], 0.012, 0.016, seam, 0.004);
    sideLine(sx, [[0.84, 1.19], [0.86, 1.0], [0.885, 0.75], [0.903, 0.40], [0.905, -0.58]], 0.022, 0.024, chrome);
    rod([sx * 0.675, 0.90, -0.62], [sx * 0.60, 0.875, -1.0], 0.022, 0.024, chrome);       // молдинг на боку капота
    rod([sx * 0.60, 0.875, -1.0], [sx * 0.555, 0.845, -1.20], 0.022, 0.024, chrome);
    part(0.03, 0.03, 0.19, chrome, sx * (sideX(0.845, 0.25) + 0.022), 0.845, 0.255);
    part(0.02, 0.05, 0.04, chrome, sx * (sideX(0.845, 0.33) + 0.014), 0.845, 0.335);
    rod([sx * 0.665, 0.955, -0.50], [sx * 0.73, 0.99, -0.48], 0.016, 0.016, chrome);
    disc(0.05, 8, chrome, sx * 0.745, 1.015, -0.47, 0, Math.PI).scale.y = 0.8;
    disc(0.05, 8, rubber, sx * 0.745, 1.015, -0.475, 0, 0).scale.y = 0.8;
    // стойка форточки, хромовые рамки стёкол
    const g = (i) => rings[i][sx > 0 ? 5 : 13], s4 = (i) => rings[i][sx > 0 ? 4 : 14];
    const out = (p, d = 0.008) => [p[0] + sx * d, p[1], p[2]];
    rod(out(s4(10)), out(g(10)), 0.014, 0.022, chrome);
    for (const [a, b] of [[9, 13], [14, 15]]) { rod(out(s4(a)), out(s4(b)), 0.012, 0.014, chrome); rod(out(g(a)), out(g(b)), 0.012, 0.014, chrome); }
    rod(out(s4(15)), out(s4(19)), 0.012, 0.014, chrome);
    for (let i = 15; i < 19; i++) rod(out(g(i)), out(g(i + 1)), 0.012, 0.014, chrome);
    rod(out(s4(8)), out(s4(9)), 0.012, 0.014, chrome); rod(out(g(8)), out(g(9)), 0.012, 0.014, chrome);
    for (const i of [13, 14]) rod(out(s4(i)), out(g(i)), 0.012, 0.014, chrome);
    // тёмные ниши арок
    for (const [zc, ry] of [[-1.2, 0.38], [1.2, 0.345]]) {
      const x = sx * 0.60;
      patch([[x, 0.30, zc - 0.33], ...ARCH_K.map((k) => [x, BEETLE_WHEEL_R + ry * Math.sqrt(1 - k * k) - 0.004, zc + k * 0.33]), [x, 0.30, zc + 0.33]], dark, [0, 0.4, zc]);
    }
    // сигнальные решётки под фарами
    disc(0.045, 8, dark, sx * 0.40, 0.50, -1.722, 0.1, Math.PI + sx * 0.5);
  }
  // бамперы: тонкий брус с загнутыми к крыльям концами, клыки, поверх клыков — дуга, спускающаяся к концам бруса
  for (const [z, dir, y] of [[-1.90, -1, 0.43], [2.085, 1, 0.41]]) {
    const zr = z + dir * 0.03;
    part(0.92, 0.075, 0.035, chrome, 0, y, z);
    rod([-0.31, y + 0.14, zr], [0.31, y + 0.14, zr], 0.03, 0.03, chrome);
    for (const sx of [-1, 1]) {
      rod([sx * 0.45, y, z], [sx * 0.66, y, z - dir * 0.09], 0.035, 0.075, chrome);
      rod([sx * 0.65, y, z - dir * 0.085], [sx * 0.76, y, z - dir * 0.25], 0.035, 0.075, chrome);
      part(0.05, 0.24, 0.05, chrome, sx * 0.31, y + 0.035, zr);
      rod([sx * 0.31, y + 0.14, zr], [sx * 0.64, y + 0.035, z - dir * 0.07], 0.03, 0.03, chrome);
    }
  }
  part(0.44, 0.11, 0.012, plate, 0, 0.43, -1.925);                                             // передний номер на бампере
  // капот: хромовый молдинг по оси, ручка у носа, эмблема, шов крышки
  const hoodC = [[-1.70, 0.74], [-1.58, 0.82], [-1.42, 0.905], [-1.20, 0.98], [-0.97, 1.03], [-0.80, 1.047]];
  for (let i = 0; i + 1 < hoodC.length; i++) rod([0, hoodC[i][1] + 0.01, hoodC[i][0]], [0, hoodC[i + 1][1] + 0.01, hoodC[i + 1][0]], 0.03, 0.02, chrome);
  part(0.13, 0.035, 0.045, chrome, 0, 0.60, -1.825);
  disc(0.055, 10, chrome, 0, 0.70, -1.748, 0.75, Math.PI);
  for (const sx of [-1, 1]) {
    const hs = [[0.07, -1.83], [0.265, -1.72], [0.335, -1.58], [0.395, -1.42], [0.45, -1.20], [0.52, -0.97], [0.55, -0.80]];
    for (let i = 0; i + 1 < hs.length; i++) rod(topPt(sx * hs[i][0], hs[i][1], 0.006), topPt(sx * hs[i + 1][0], hs[i + 1][1], 0.006), 0.014, 0.012, seam);
    // дворники
    rod([sx * 0.08 + 0.10, 1.075, -0.66], [sx * 0.08 + 0.42, 1.06, -0.60], 0.02, 0.016, dark);
  }
  rod(topPt(-0.55, -0.80, 0.006), topPt(0, -0.80, 0.006), 0.012, 0.014, seam); rod(topPt(0, -0.80, 0.006), topPt(0.55, -0.80, 0.006), 0.012, 0.014, seam);
  // корма: жалюзи под стеклом, шов крышки мотора, номер с плафоном, ручка, две выхлопные трубы
  for (const sx of [-1, 1]) for (let n = 0; n < 4; n++) {
    const x = sx * (0.08 + n * 0.07);
    rod(topPt(x, 1.395, 0.004), topPt(x, 1.475, 0.004), 0.016, 0.012, dark);
  }
  for (const sx of [-1, 1]) {
    const ls = [[0, 1.53], [0.30, 1.53], [0.42, 1.585], [0.435, 1.66], [0.40, 1.74], [0.33, 1.80], [0.24, 1.845]];
    for (let i = 0; i + 1 < ls.length; i++) rod(topPt(sx * ls[i][0], ls[i][1], 0.006), topPt(sx * ls[i + 1][0], ls[i + 1][1], 0.006), 0.014, 0.012, seam);
  }
  part(0.42, 0.012, 0.115, plate, 0, topY(0, 1.71) + 0.012, 1.715).rotation.x = 0.93;
  part(0.16, 0.035, 0.05, yellow, 0, 0.905, 1.652).rotation.x = 0.8;
  part(0.07, 0.025, 0.03, chrome, 0, 0.56, 1.845);
  const pipeGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.26, 8).rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(pipeGeo, chrome); p.position.set(sx * 0.21, 0.285, 1.935); loose.push(p); }

  for (const m of loose) {                                        // бруски вливаются в общие сетки своих материалов
    m.updateMatrix();
    bin(m.material).push(...m.geometry.toNonIndexed().applyMatrix4(m.matrix).attributes.position.array);
  }
  soup.forEach((v, mat) => body.add(new THREE.Mesh(geoOf(v), mat)));

  // колёса: шина с боковиной, крашеный диск, хромовый колпак и тёмные прорези — видно, как крутится. На колесо три сетки.
  const cyl = (r, w, n) => new THREE.CylinderGeometry(r, r, w, n).rotateZ(Math.PI / 2);
  const weld = (...geos) => {                                     // несколько геометрий в одну, нормали сохраняются
    const pos = [], nor = [];
    for (const q0 of geos) { const q = q0.toNonIndexed(); pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return geo;
  };
  const slot = (k) => new THREE.BoxGeometry(0.184, 0.035, 0.07).translate(0, 0, 0.155).rotateX(k * Math.PI / 2 + 0.4);
  const blackGeo = weld(cyl(BEETLE_WHEEL_R, 0.17, 14), slot(0), slot(1.3)), wallGeo = cyl(0.275, 0.174, 12);
  const rimGeo = cyl(0.205, 0.178, 12), capGeo = cyl(0.125, 0.19, 10);
  const rimMat = lambert({ color: 0xe8e2cc });
  const front = [], spin = [];
  for (const z of [-1.2, 1.2]) for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(), wheel = new THREE.Group();
    pivot.position.set(sx * 0.66, BEETLE_WHEEL_R, z);
    wheel.add(new THREE.Mesh(blackGeo, dark), new THREE.Mesh(wallGeo, rubber), new THREE.Mesh(rimGeo, rimMat), new THREE.Mesh(capGeo, chrome));
    pivot.add(wheel); beetle.add(pivot); spin.push(wheel);
    if (z < 0) front.push(pivot);
  }
  beetle.userData.frontWheels = front;
  beetle.userData.spin = spin;
  beetle.userData.body = body;
  return beetle;
}
