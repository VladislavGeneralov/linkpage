// Модель взята из car_look/toyota_hilux_revo/buildHilux_draft.js (её ведёт отдельная сессия); при обновлении черновика —
// обновить копию: python island_src/sync_cars.py write. Файл только объявляет buildHilux(); ездить на ней нельзя — она стоит на парковках.
// ---------- Toyota Hilux ----------
// Toyota Hilux Revo (AN120), двойная кабина, серебристый. Размеры сняты с бокового фото: база 3.085 м, передний свес 1.01,
// задний 1.24, крыша 1.815, капот от 1.10 у носа до 1.32 у лобового, линия окон поднимается к корме (1.25 → 1.32),
// борт кузова 1.325. Кабина с капотом — обшивка по сечениям; в ней же вырезаны колёсные ниши (низ сечения поднят
// дугой), вокруг ниш — узкие наплывы-отбортовки. Нос завален назад и скошен в плане: торец обшивки — трапеция решётки
// с толстой хромовой планкой, от неё назад уходят широкие фары и заходят на крыло острым хвостом. Бамперы — профиль,
// протянутый поперёк машины: передний в цвет кузова выступает дальше решётки, в нём трапеция воздухозаборника и
// противотуманки; задний — хромовая ступенька с чёрной серединой. Кузов открытый: борта — обшивка с чёрной накладкой
// по верху, внутри тёмный пол с рёбрами и надколёсные короба. Фонари — высокие, на углах, клином заходят на борт
// (остриё вперёд-вниз). Заднее стекло двери скошено: верх дальше к корме, чем низ. Мелочи: швы и ручки дверей,
// шильдики, подножки, брызговики, лючок бака, дворники, антенна, зеркала с повторителями, фаркоп, выхлопная труба;
// у колёс — обод, тёмный диск и шесть светлых спиц. Накладки лежат на 1–1.5 см выше поверхности. Нос — к -Z.
const HILUX_L = 5.33, HILUX_WHEEL_R = 0.38, HILUX_AXLE = 1.5425;
function buildHilux() {
  const car = new THREE.Group(), body = new THREE.Group();        // body качается; колёса остаются на земле
  car.add(body);
  const paint = lambert({ color: 0xb4babf }), glass = lambert({ color: 0x2c3a4c });
  const chrome = lambert({ color: 0xd8dad6 }), dark = lambert({ color: 0x1a1a1a });
  const liner = lambert({ color: 0x2c2d30 }), rib = lambert({ color: 0x3e4044 }), seam = lambert({ color: 0x7c8388 });
  const steel = lambert({ color: 0x9aa0a4 }), plate = lambert({ color: 0xe9e9e4 }), gun = lambert({ color: 0x4a4e52 }), pit = lambert({ color: 0x0c0c0c });
  const shine = lambert({ color: 0xf4f6f3 });                     // хром на решётке: светлее серебристой краски
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 }), tailMat = new THREE.MeshBasicMaterial({ color: 0xd42020 });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xf08a20 }), lampGlass = new THREE.MeshBasicMaterial({ color: 0xcdd8df });

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
  // pick(i, j) -> [материал первого треугольника клетки, второго, другая диагональ]; caps — материалы торцов (-1 — без торца).
  const loft = (rings, pick, caps = [0, 0]) => {
    const lists = [], put = (m) => lists[m] || (lists[m] = []), cs = rings.map(mid), n = rings.length;
    for (let i = 0; i + 1 < n; i++) {
      const A = rings[i], B = rings[i + 1], o = mid([cs[i], cs[i + 1]]);
      for (let j = 0; j < A.length; j++) {
        const k = (j + 1) % A.length, [m0, m1, flip] = pick ? pick(i, j) : [0, 0];
        if (flip) { tri(put(m0), A[j], B[j], B[k], o); tri(put(m1), A[j], B[k], A[k], o); }
        else { tri(put(m0), A[j], B[j], A[k], o); tri(put(m1), B[j], B[k], A[k], o); }
      }
    }
    [[0, cs[1]], [n - 1, cs[n - 2]]].forEach(([e, o], q) => {    // торцы — веером от середины
      const R = rings[e];
      if (caps[q] >= 0) for (let j = 0; j < R.length; j++) tri(put(caps[q]), cs[e], R[j], R[(j + 1) % R.length], o);
    });
    return lists;
  };
  const skin = (rings, mats = [paint], pick, caps) => loft(rings, pick, caps).forEach((v, m) => body.add(new THREE.Mesh(geoOf(v), mats[m])));
  // плоская накладка-многоугольник (веер от первой точки), лицом наружу от точки o
  const patch = (pts, mat, o = [0, 0.9, 0]) => {
    const v = [];
    for (let k = 1; k + 1 < pts.length; k++) tri(v, pts[0], pts[k], pts[k + 1], o);
    body.add(new THREE.Mesh(geoOf(v), mat));
  };
  // деталь-брусок с заданным материалом; rod — брусок сечением w × h между двумя точками
  const part = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); body.add(m); return m; };
  const rod = (a, b, w, h, mat) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = part(w, h, A.distanceTo(B), mat, 0, 0, 0);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.sub(A).normalize());
    return m;
  };

  // --- колёсные ниши: проём — половина суперэллипса над осью колеса (верх площе, чем у круга)
  // [центр z, полуось по z, высота над осью]. Задняя ниша выше передней: пустой пикап стоит кормой вверх.
  const R = HILUX_WHEEL_R, W = 0.90, PW = 2.6, ARCH_F = [-HILUX_AXLE, 0.49, 0.48], ARCH_R = [HILUX_AXLE, 0.475, 0.54];
  const archY = ([zc, a, b], z) => Math.abs(z - zc) < a ? R + b * (1 - Math.abs((z - zc) / a) ** PW) ** (1 / PW) : 0;
  const archZ = ([zc, a]) => [-1, -0.97, -0.88, -0.7, -0.4, 0, 0.4, 0.7, 0.88, 0.97, 1].map((u) => zc + a * u);

  // --- кабина с капотом. Полусечение снизу к оси: низ борта, плечо (самое широкое место), пояс, подоконник,
  // верх окна, угол крыши, край плоского верха, ось. У кабины стёкла завалены, крыша плоская; у капота от кромки
  // крыла пологий подъём к ребру, за ребром — приподнятая плоская середина.
  const cabHalf = (Wz, M, h, F) => [[0.985 * Wz, M], [0.975 * Wz, M + 0.05 * h], [0.855 * Wz, M + 0.78 * h], [0.79 * Wz, M + 0.90 * h], [F, M + 0.985 * h]];
  const hoodHalf = (Wz, M, h, F) => [[0.985 * Wz, M], [0.97 * Wz, M + 0.25 * h], [0.92 * Wz, M + 0.5 * h], [F + 0.06, M + 0.7 * h], [F, M + h - 0.006]];
  const Z_COWL = -1.20, Z_WS0 = -1.12, Z_A = -0.92, Z_WS1 = -0.40, Z_B0 = -0.05, Z_B1 = 0.13, Z_C0 = 0.70, Z_C1 = 0.84, CAB_END = 1.03;
  //             z       полушир. плечо пояс  верх   кабина низ  плоский полушир. завал полушир.
  //                                                              верх    низа     назад верха
  const SECT = [[-2.42,   0.43,  0.95, 1.075, 1.10,  0,   0.80, 0.30,  0.33,  0.28, 0.515],  //  0 решётка: торец-трапеция, завален назад
                [-2.27,   0.865, 0.93, 1.10,  1.135, 0,   0.45, 0.42,  0.84,  0.25, 0.865],  //  1 внешний угол фары
                [-2.10,   0.895, 0.95, 1.10,  1.165, 0,   0.45, 0.46,  0.865, 0,    0.895],  //  2 угол кузова, фара ушла на борт
                [-1.83,   W,     0.96, 1.125, 1.21,  0,   0.47, 0.50,  0.87,  0,    W],      //  3 остриё фары на крыле
                [-1.50,   W,     0.97, 1.18,  1.265, 0,   0.47, 0.56,  0.87,  0,    W],      //  4 капот над передней осью
                [Z_COWL,  W,     0.98, 1.235, 1.315, 0,   0.47, 0.62,  0.87,  0,    W],      //  5 задняя кромка капота
                [Z_WS0,   W,     0.98, 1.255, 1.325, 0.6, 0.47, 0.62,  0.87,  0,    W],      //  6 низ лобового
                [Z_A,     W,     0.98, 1.24,  1.47,  1,   0.47, 0.60,  0.87,  0,    W],      //  7 передний нижний угол дверного стекла
                [Z_WS1,   W,     0.98, 1.25,  1.775, 1,   0.47, 0.56,  0.87,  0,    W],      //  8 верх лобового
                [-0.22,   W,     0.98, 1.258, 1.803, 1,   0.47, 0.56,  0.87,  0,    W],      //  9 скругление крыши
                [Z_B0,    W,     0.98, 1.265, 1.812, 1,   0.47, 0.56,  0.87,  0,    W],      // 10-11 средняя стойка
                [Z_B1,    W,     0.98, 1.272, 1.815, 1,   0.47, 0.56,  0.87,  0,    W],
                [Z_C0,    W,     0.98, 1.293, 1.812, 1,   0.47, 0.56,  0.87,  0,    W],      // 12 низ задней кромки стекла задней двери
                [Z_C1,    W,     0.98, 1.297, 1.808, 1,   0.47, 0.56,  0.87,  0,    W],      // 13 верх этой кромки; дальше — задняя стойка
                [CAB_END, W,     0.98, 1.30,  1.795, 1,   0.47, 0.56,  0.87,  0,    W]];     // 14 задняя стенка кабины
  // в сечения добавлены точки дуги передней ниши; низ всех сечений над колесом поднят до дуги
  const rowAt = (z) => { const i = SECT.findIndex((s) => s[0] > z), a = SECT[i - 1], b = SECT[i]; return a.map((v, k) => v + (b[k] - v) * (z - a[0]) / (b[0] - a[0])); };
  const rows = [...SECT, ...archZ(ARCH_F).map(rowAt)].sort((p, q) => p[0] - q[0]);
  for (const r of rows) r[6] = Math.max(r[6], archY(ARCH_F, r[0]));
  const rings = rows.map(([z, Wz, S, M, T, c, B, F, Wb, lean, Wu]) => {
    const cab = cabHalf(Wu, M, T - M, F), hood = hoodHalf(Wu, M, T - M, F);
    const half = [[Wb, B], [Wz, S], ...cab.map(([x, y], j) => [x * c + hood[j][0] * (1 - c), y * c + hood[j][1] * (1 - c)]), [0, T]];
    return [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [x, y, z - lean * Math.min(T - y, 0.3)]);
  });
  // точки контура: 0 низ, 1 плечо, 2 пояс, 3 подоконник, 4 верх окна, 5 угол крыши, 6 край плоского верха, 7 ось, дальше зеркально (8..14)
  const zs = rows.map((r) => r[0]), within = (i, a, b) => zs[i] > a - 1e-6 && zs[i] < b - 1e-6;
  skin(rings, [paint, glass, dark, lampGlass, pit], (i, j) => {
    if (j === 14) return [4, 4];                                                   // днище и своды ниш — чёрные
    if (i < 2 && (j === 1 || j === 12)) return [3, 3];                             // стекло фар: от решётки до угла и за угол, на борт
    const top = j >= 5 && j <= 8, side = j === 3 || j === 10;
    if (top && within(i, Z_COWL, Z_WS0)) return [2, 2];                            // решётка под дворниками
    if (top && within(i, Z_WS0, Z_WS1)) return [1, 1];                             // лобовое стекло
    if (side && within(i, Z_A, Z_WS1)) return j === 3 ? [1, 0, true] : [0, 1];     // передний край дверного — косой, вдоль стойки
    if (side && (within(i, Z_WS1, Z_B0) || within(i, Z_B1, Z_C0))) return [1, 1];  // стёкла передней и задней дверей
    if (side && within(i, Z_B0, Z_B1)) return [2, 2];                              // чёрная средняя стойка
    if (side && within(i, Z_C0, Z_C1)) return j === 3 ? [0, 1, true] : [1, 0];     // задний край: верх дальше к корме
    return [0, 0];
  }, [2, 0]);                                                                      // передний торец — тёмная решётка

  // --- кузов. Борт — своя обшивка: наружная стенка в цвет кузова с дугой задней ниши, чёрная накладка по верху,
  // тёмная внутренняя стенка. К корме низ борта поднимается, угол в плане срезан.
  const BED0 = 1.06, BED_END = 2.65, BED_TOP = 1.325, FLOOR = 0.86, IN = 0.80;
  //            z     полушир. низ
  const WALL = [[BED0, W,    0.47], [2.06, W, 0.52], [2.46, W, 0.60], [2.58, W, 0.80], [2.60, W, 0.80], [BED_END, 0.86, 0.80]];
  const wallAt = (z) => { const i = WALL.findIndex((s) => s[0] > z), a = WALL[i - 1], b = WALL[i]; return a.map((v, k) => v + (b[k] - v) * (z - a[0]) / (b[0] - a[0])); };
  const wall = [...WALL, ...archZ(ARCH_R).map(wallAt)].sort((p, q) => p[0] - q[0]);
  for (const r of wall) r[2] = Math.max(r[2], archY(ARCH_R, r[0]));
  for (const sx of [-1, 1]) {
    skin(wall.map(([z, Wz, B]) => [[Wz - 0.03, B], [Wz, 0.98], [Wz - 0.012, BED_TOP], [Wz - 0.02, BED_TOP + 0.015], [IN, BED_TOP + 0.015], [IN, 0.80]]
      .map(([x, y]) => [sx * x, y, z])), [paint, dark, liner], (i, j) => j < 3 ? [0, 0] : j === 3 ? [1, 1] : [2, 2]);
  }
  part(2 * IN, FLOOR - 0.80, BED_END - 0.05 - BED0, liner, 0, (FLOOR + 0.80) / 2, (BED0 + BED_END - 0.05) / 2);   // пол
  for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) part(0.06, 0.012, 1.44, rib, x, FLOOR + 0.006, 1.86);       // рёбра пола
  part(2 * IN, BED_TOP + 0.015 - FLOOR, 0.04, liner, 0, (BED_TOP + 0.015 + FLOOR) / 2, BED0 + 0.02);       // передняя стенка
  part(2 * W - 0.06, 0.82, 0.03, dark, 0, 0.90, (CAB_END + BED0) / 2);                                     // щель между кабиной и кузовом
  // задний борт — вертикальный, между фонарями; изнутри тёмный
  part(2 * IN, BED_TOP + 0.01 - 0.80, 0.05, paint, 0, (BED_TOP + 0.01 + 0.80) / 2, BED_END - 0.025);
  part(2 * IN, 0.035, 0.08, paint, 0, BED_TOP + 0.003, BED_END - 0.022);                                   // козырёк по верху
  part(2 * IN, BED_TOP - FLOOR, 0.012, liner, 0, (BED_TOP + FLOOR) / 2, BED_END - 0.056);
  part(0.36, 0.08, 0.02, dark, 0, 1.165, BED_END + 0.008);                                                 // ручка
  part(0.26, 0.03, 0.02, tailMat, 0, 1.27, BED_END + 0.008);                                               // третий стоп-сигнал
  part(0.20, 0.035, 0.015, chrome, -0.50, 1.21, BED_END + 0.006);                                          // надписи: TOYOTA слева,
  part(0.22, 0.05, 0.015, chrome, 0.42, 1.20, BED_END + 0.006);                                            // HILUX справа
  // тёмное нутро: рама и моторный отсек — закрывают просвет в нишах и под порогами
  part(1.2, 0.66, 1.0, pit, 0, 0.67, -1.5);
  part(1.2, 0.46, 3.12, pit, 0, 0.57, 0.56);
  part(0.9, 0.32, 0.46, pit, 0, 0.64, 2.35);

  // --- отбортовки ниш: узкий наплыв вдоль дуги. Сечение: кромка ниши, стенка, скруглённое плечо, верх уходит в борт.
  // e — вылет наплыва по ходу дуги (от переднего конца к заднему): к концам сходит на нет.
  const flare = (arch, zlist, E) => {
    const [zc, a, b] = arch;
    for (const sx of [-1, 1]) {
      skin(zlist.map((z) => {
        const y = archY(arch, z), u = (z - zc) / a, nz = Math.sign(u) * Math.abs(u) ** (PW - 1) / a, ny = ((y - R) / b) ** (PW - 1) / b, n = Math.hypot(nz, ny);
        const t = (u + 1) / 2 * (E.length - 1), k = Math.min(E.length - 2, Math.floor(t));
        const e = 0.0275 * (E[k] + (E[k + 1] - E[k]) * (t - k));
        return [[W - 0.03, 0], [W + e, 0], [W + e * 0.9, 0.04], [W + e * 0.45, 0.08], [W - 0.004, 0.105], [W - 0.03, 0.105]]
          .map(([x, r]) => [sx * x, y + r * ny / n, z + r * nz / n]);
      }));
    }
  };
  flare(ARCH_F, zs.filter((z) => archY(ARCH_F, z) > 0.47), [1, 1, 1, 1, 0.9, 0.6, 0.2]);        // спереди сливается с углом бампера
  flare(ARCH_R, wall.map((r) => r[0]).filter((z) => archY(ARCH_R, z) > 0.47), [0.2, 0.6, 0.9, 1, 1, 0.9, 0.6]);

  // --- бамперы: профиль в плоскости (z, y), протянутый поперёк машины; в плане бампер выгнут дугой.
  // Передний: [x, нос z0, верх, кромка полки под фарой]; под решёткой в верхней кромке вырез. Задняя стенка — тёмная.
  const FB = [[0.18, -2.535, 0.82, -2.49], [0.36, -2.513, 0.82, -2.49], [0.43, -2.50, 0.93, -2.455], [0.58, -2.465, 0.93, -2.415],
              [0.82, -2.39, 0.93, -2.325], [0.90, -2.30, 0.93, -2.25], [0.9275, -2.20, 0.93, -2.12]];
  const across = (half) => [...half.slice().reverse().map(([x, ...t]) => [-x, ...t]), ...half];
  const fz = (x) => {                                             // z передней грани бампера на полуширине x, с зазором под накладку
    const i = Math.max(1, FB.findIndex((t) => t[0] >= Math.abs(x))), a = FB[i - 1], b = FB[i];
    return a[1] + (b[1] - a[1]) * Math.max(0, (Math.abs(x) - a[0]) / (b[0] - a[0])) - 0.012;
  };
  skin(across(FB).map(([x, z0, yt, zl]) => [[-2.03, yt - 0.10], [zl, yt], [z0 + 0.01, Math.min(0.86, yt - 0.03)],
    [z0, 0.78], [z0, 0.52], [z0 + 0.07, 0.45], [-2.03, 0.45]].map(([z, y]) => [x, y, z])), [paint, pit], (i, j) => j >= 5 ? [1, 1] : [0, 0]);
  // задний: хромовые углы, середина утоплена и чёрная; сверху чёрная накладка-ступенька
  const RB = [[0.44, 2.735], [0.46, 2.78], [0.78, 2.77], [0.89, 2.72], [0.9275, 2.66]];
  skin(across(RB).map(([x, z0]) => [[2.58, 0.77], [z0 - 0.02, 0.77], [z0, 0.74], [z0, 0.60], [z0 - 0.05, 0.55], [2.46, 0.55]]
    .map(([z, y]) => [x, y, z])), [chrome, dark], (i) => i >= 3 && i <= 5 ? [1, 1] : [0, 0]);
  part(1.60, 0.02, 0.15, dark, 0, 0.78, 2.695);
  part(0.34, 0.13, 0.02, plate, 0, 0.665, 2.745);                                                          // задний номер
  part(0.12, 0.09, 0.14, dark, 0, 0.50, 2.69);                                                             // фаркоп с шаром
  part(0.05, 0.06, 0.05, chrome, 0, 0.50, 2.755);

  // --- перед. Решётка лежит на заваленном торце: толстая хромовая планка сверху (её концы упираются в фары),
  // под ней две ламели потоньше и эмблема
  const LEAN = Math.atan(0.28), face = (y) => -2.42 - 0.28 * (1.10 - y);          // z торца на высоте y
  const onFace = (w, h, d, mat, y) => { part(w, h, d, mat, 0, y, face(y) - d / 2 + 0.005).rotation.x = LEAN; };
  onFace(1.03, 0.06, 0.035, shine, 1.052);
  onFace(0.88, 0.03, 0.03, steel, 0.972);
  onFace(0.77, 0.03, 0.03, steel, 0.895);
  onFace(0.14, 0.10, 0.045, shine, 0.965);
  // начинка фары поверх стекла: светлый отражатель ближе к углу, янтарный поворотник у решётки
  const mix = (a, b, k) => a.map((v, n) => v + (b[n] - v) * k);
  const lampPt = (sx, u, v) => {                                  // u — от решётки к углу, v — снизу вверх
    const j = sx > 0 ? [1, 2] : [13, 12], q = mix(mix(rings[0][j[0]], rings[1][j[0]], u), mix(rings[0][j[1]], rings[1][j[1]], u), v);
    return [q[0], q[1], q[2] - 0.014];
  };
  const lampPatch = (sx, u0, u1, v0, v1, mat) => patch([lampPt(sx, u0, v0), lampPt(sx, u1, v0), lampPt(sx, u1, v1), lampPt(sx, u0, v1)], mat, [0, 1, -1]);
  // передний бампер: трапеция воздухозаборника, в ней номер
  for (const [a, b] of [[-0.36, -0.18], [-0.18, 0.18], [0.18, 0.36]]) patch([[a, 0.75, fz(a)], [b, 0.75, fz(b)], [b, 0.54, fz(b)], [a, 0.54, fz(a)]], dark);
  part(0.34, 0.13, 0.02, plate, 0, 0.635, fz(0) - 0.002);
  for (const sx of [-1, 1]) {
    // хвост фары на крыле: остриё вверх-назад, вдоль кромки капота
    patch([[sx * 0.907, 0.955, -2.10], [sx * 0.894, 1.098, -2.10], [sx * 0.899, 1.122, -1.84]], lampGlass, [0, 1, -2]);
    lampPatch(sx, 0.40, 0.93, 0.14, 0.86, lensMat);
    lampPatch(sx, 0.07, 0.30, 0.10, 0.52, amberMat);
    // скошенные края воздухозаборника
    patch([[sx * 0.36, 0.75, fz(0.36)], [sx * 0.43, 0.683, fz(0.43)], [sx * 0.43, 0.54, fz(0.43)], [sx * 0.36, 0.54, fz(0.36)]], dark);
    patch([[sx * 0.43, 0.683, fz(0.43)], [sx * 0.58, 0.54, fz(0.58)], [sx * 0.43, 0.54, fz(0.43)]], dark);
    // ниша противотуманки на скошенной грани бампера и круглая фара в ней
    patch([[sx * 0.63, 0.74, fz(0.63)], [sx * 0.82, 0.72, fz(0.82)], [sx * 0.82, 0.60, fz(0.82)], [sx * 0.68, 0.57, fz(0.68)]], dark, [0, 0.65, 0]);
    { const fog = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), lensMat);
      fog.rotation.y = Math.PI - sx * 0.28; fog.position.set(sx * 0.74, 0.655, fz(0.74) - 0.012); body.add(fog); }
    // задний фонарь: клин на углу кузова, красный; внутренняя часть лежит на заднем борту, снизу светлая секция
    skin([0.83, 0.912].map((x) => [[2.58, 1.26], [2.665, 1.26], [2.665, 0.87], [2.53, 0.87], [2.41, 0.94]].map(([z, y]) => [sx * x, y, z])), [tailMat]);
    part(0.13, 0.27, 0.02, tailMat, sx * 0.765, 1.125, BED_END + 0.008);
    part(0.13, 0.12, 0.02, lensMat, sx * 0.765, 0.93, BED_END + 0.008);
    // зеркало на ножке у основания стойки, ручки дверей
    part(0.10, 0.06, 0.10, dark, sx * 0.915, 1.30, -0.92);
    const mir = part(0.20, 0.15, 0.13, paint, sx * 1.04, 1.345, -0.84);                        // корпус: сзади тёмное стекло,
    mir.rotation.y = sx * 0.35;                                                                // спереди янтарный повторитель
    mir.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.02), dark), new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.02), amberMat));
    mir.children[0].position.z = 0.066; mir.children[1].position.set(sx * 0.045, 0, -0.066);
    part(0.02, 0.035, 0.20, chrome, sx * 0.901, 1.07, -0.88);                                  // шильдик на передней двери
    part(0.03, 0.045, 0.24, chrome, sx * 0.903, 1.135, -0.13);
    part(0.03, 0.045, 0.24, chrome, sx * 0.903, 1.16, 0.755);
    // швы дверей: передняя кромка передней двери, стык дверей, задняя кромка задней двери — огибает арку
    for (const [pts] of [[[[-0.99, 0.50], [-1.05, 0.90], [-1.0, 1.24]]], [[[0.03, 0.50], [0.03, 0.98], [0.03, 1.27]]],
                         [[[0.72, 0.50], [0.86, 0.72], [0.94, 0.98], [0.94, 1.29]]]]) {
      for (let k = 0; k + 1 < pts.length; k++) {
        const P = pts.slice(k, k + 2).map(([z, y]) => [sx * (y < 0.98 ? W - 0.03 * (0.98 - y) / 0.51 : W - 0.0135 * (y - 0.98) / 0.3), y, z]);
        rod(P[0], P[1], 0.02, 0.02, seam);
      }
    }
    part(0.10, 0.035, 1.92, dark, sx * 0.875, 0.40, 0);                                        // подножка
    part(0.24, 0.30, 0.025, dark, sx * 0.78, 0.37, HILUX_AXLE + 0.51);                         // брызговики
    part(0.20, 0.20, 0.025, dark, sx * 0.79, 0.40, -HILUX_AXLE + 0.51);
    part(0.22, 0.12, 0.80, liner, sx * 0.69, FLOOR + 0.06, HILUX_AXLE);                        // надколёсный короб в кузове
  }
  // лючок бензобака — на левом борту кузова, рамкой
  for (const [a, b] of [[[1.20, 1.05], [1.38, 1.05]], [[1.38, 1.05], [1.38, 1.22]], [[1.38, 1.22], [1.20, 1.22]], [[1.20, 1.22], [1.20, 1.05]]])
    rod([-(W - 0.004), a[1], a[0]], [-(W - 0.004), b[1], b[0]], 0.02, 0.02, seam);
  // заднее стекло кабины в тёмной рамке, дворники, антенна, выхлопная труба
  part(1.38, 0.36, 0.02, dark, 0, 1.545, CAB_END + 0.004);
  part(1.32, 0.30, 0.02, glass, 0, 1.545, CAB_END + 0.016);
  rod([-0.62, 1.335, -1.115], [-0.10, 1.36, -1.085], 0.025, 0.02, dark);
  rod([0.02, 1.335, -1.115], [0.54, 1.36, -1.085], 0.025, 0.02, dark);
  rod([0.52, 1.77, -0.36], [0.52, 1.98, -0.20], 0.015, 0.015, dark);
  { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), steel);
    pipe.geometry.rotateX(Math.PI / 2); pipe.rotation.y = 0.5; pipe.position.set(0.68, 0.50, 2.27); body.add(pipe); }

  // колёса: шина, светлый обод, тёмный диск с шестью светлыми спицами и колпачком — видно, как крутится
  const TW = 0.26, tyreGeo = new THREE.CylinderGeometry(R, R, TW, 16); tyreGeo.rotateZ(Math.PI / 2);
  const disc = (r, n) => { const g = new THREE.CircleGeometry(r, n); g.rotateY(Math.PI / 2); return g; };   // лицом к +X
  const rimGeo = disc(0.245, 16), wellGeo = disc(0.205, 12), hubGeo = disc(0.06, 8), spokeGeo = new THREE.BoxGeometry(0.01, 0.41, 0.05);
  const front = [], spin = [];
  for (const z of [-HILUX_AXLE, HILUX_AXLE]) for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(), wheel = new THREE.Group(), faceG = new THREE.Group();
    pivot.position.set(sx * 0.755, R, z);
    const put = (geo, mat, x) => { const m = new THREE.Mesh(geo, mat); m.position.x = TW / 2 + x; faceG.add(m); return m; };
    put(rimGeo, chrome, 0.01); put(wellGeo, gun, 0.02); put(hubGeo, chrome, 0.045);   // слои диска — по сантиметру друг над другом
    for (let k = 0; k < 3; k++) put(spokeGeo, chrome, 0.03).rotation.x = k * Math.PI / 3;
    if (sx < 0) faceG.rotation.y = Math.PI;
    wheel.add(new THREE.Mesh(tyreGeo, dark), faceG);
    pivot.add(wheel); car.add(pivot); spin.push(wheel);
    if (z < 0) front.push(pivot);
  }
  car.userData.frontWheels = front;
  car.userData.spin = spin;
  car.userData.body = body;
  return car;
}
