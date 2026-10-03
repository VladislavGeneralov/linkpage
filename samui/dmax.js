// Модель взята из car_look/isuzu_dmax/buildDmax_draft.js (её ведёт отдельная сессия); при обновлении черновика —
// обновить копию: python island_src/sync_cars.py write. Файл только объявляет buildDmax(); зовёт её выбор машины и стоянки.
// ---------- Isuzu D-Max ----------
// Isuzu D-Max третьего поколения (RG), двойная кабина Hi-Lander, оранжевый. Устроен как Hilux, но профиль свой:
// база 3.125 м, передний свес короткий (0.905), нос тупой и почти вертикальный, капот высокий и плоский с
// «коробчатыми» боками (1.14 у носа, 1.29 у лобового), крыша 1.79, борт кузова 1.33. Кабина сдвинута назад: задняя дверь вырезана
// задней нишей, подоконник задней двери у стойки взлетает вверх, задняя кромка стекла почти вертикальна.
// По борту — ребро на уровне ручек (у Hilux оно ниже), отбортовки ниш — плоские, гранёные. Перед: торец обшивки —
// огромная шестигранная решётка от бампера до капота с двумя хромовыми «клыками», узкие фары-клинья сходятся к
// верхнему клыку и остриём заходят на крыло; под решёткой — губа бампера с номером, по бокам вертикальные ниши
// противотуманок. Корма: фонари на углах клином заходят на борт остриём вперёд-вверх, на торце — два светлых
// квадрата с красной серединой; бампер-ступенька с углами в цвет кузова; стоп-сигнал — над задним стеклом кабины.
// Мелочи: швы и ручки дверей, шильдики, серебристые подножки, брызговики, лючок бака, дворники, антенна, зеркала
// с повторителями, фаркоп, выхлопная труба; у колёс — светлый диск с шестью тёмными прорезями. Нос — к -Z.
const DMAX_L = 5.265, DMAX_WHEEL_R = 0.385, DMAX_AXLE = 1.5625;
function buildDmax() {
  const car = new THREE.Group(), body = new THREE.Group();        // body качается; колёса остаются на земле
  car.add(body);
  const paint = lambert({ color: 0xc8652a }), glass = lambert({ color: 0x2c3a4c });
  const chrome = lambert({ color: 0xd8dad6 }), dark = lambert({ color: 0x1a1a1a });
  const liner = lambert({ color: 0x2c2d30 }), rib = lambert({ color: 0x3e4044 }), seam = lambert({ color: 0x8a431a });
  const steel = lambert({ color: 0x9aa0a4 }), plate = lambert({ color: 0xe9e9e4 }), gun = lambert({ color: 0x3c3f43 }), pit = lambert({ color: 0x0c0c0c });
  const shine = lambert({ color: 0xf4f6f3 });                     // яркий хром «клыков»
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 }), tailMat = new THREE.MeshBasicMaterial({ color: 0xd42020 });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xf08a20 }), reflMat = new THREE.MeshBasicMaterial({ color: 0x5c1214 });
  const lampGlass = new THREE.MeshBasicMaterial({ color: 0xcdd8df });

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
  // [центр z, полуось по z, высота над осью]. Задняя ниша начинается ещё под кабиной и срезает угол задней двери.
  const R = DMAX_WHEEL_R, W = 0.905, PW = 2.6, ARCH_F = [-DMAX_AXLE, 0.50, 0.49], ARCH_R = [DMAX_AXLE, 0.49, 0.505];
  const archY = ([zc, a, b], z) => Math.abs(z - zc) < a ? R + b * (1 - Math.abs((z - zc) / a) ** PW) ** (1 / PW) : 0;
  const archZ = ([zc, a]) => [-1, -0.97, -0.88, -0.7, -0.4, 0, 0.4, 0.7, 0.88, 0.97, 1].map((u) => zc + a * u);

  // --- кабина с капотом. Полусечение снизу к оси: низ борта, плечо (ребро по борту), пояс, подоконник, верх окна,
  // угол крыши, край плоского верха, ось. У кабины стёкла завалены, крыша плоская; у капота бок почти отвесный,
  // сверху скруглён, за ребром — приподнятая плоская середина.
  const cabHalf = (Wz, M, h, F) => [[0.985 * Wz, M], [0.975 * Wz, M + 0.05 * h], [0.86 * Wz, M + 0.78 * h], [0.795 * Wz, M + 0.90 * h], [F, M + 0.985 * h]];
  const hoodHalf = (Wz, M, h, F) => [[0.985 * Wz, M], [0.975 * Wz, M + 0.45 * h], [0.93 * Wz, M + 0.76 * h], [F + 0.07, M + 0.86 * h], [F, M + h - 0.005]];
  const Z_COWL = -1.18, Z_WS0 = -1.10, Z_A = -0.90, Z_WS1 = -0.35, Z_B0 = 0.10, Z_B1 = 0.28, Z_C0 = 0.87, Z_C1 = 0.93, CAB_END = 1.13;
  //             z       полушир. плечо  пояс   верх   кабина низ  плоский полушир. завал  полушир.
  //                                                                верх    низа     назад  верха
  const SECT = [[-2.39,   0.56,  0.98,  1.105, 1.14,  0,   0.62, 0.34, 0.42,  0.10, 0.48],   //  0 решётка: торец-шестигранник
                [-2.33,   0.86,  0.90,  1.075, 1.15,  0,   0.50, 0.48, 0.84,  0.08, 0.86],   //  1 внешний край фары
                [-2.24,   0.90,  0.905, 1.072, 1.165, 0,   0.50, 0.52, 0.87,  0,    0.90],   //  2 угол кузова
                [-2.08,   W,     0.95,  1.065, 1.185, 0,   0.50, 0.58, 0.875, 0,    W],      //  3 остриё фары на крыле
                [-1.80,   W,     1.00,  1.11,  1.215, 0,   0.47, 0.62, 0.875, 0,    W],
                [-1.50,   W,     1.05,  1.16,  1.25,  0,   0.47, 0.66, 0.875, 0,    W],      //  4 капот над передней осью
                [Z_COWL,  W,     1.10,  1.215, 1.287, 0,   0.47, 0.68, 0.875, 0,    W],      //  5 задняя кромка капота
                [Z_WS0,   W,     1.115, 1.235, 1.295, 0.6, 0.47, 0.66, 0.875, 0,    W],      //  6 низ лобового
                [Z_A,     W,     1.13,  1.235, 1.44,  1,   0.47, 0.62, 0.875, 0,    W],      //  7 передний нижний угол дверного стекла
                [Z_WS1,   W,     1.13,  1.25,  1.755, 1,   0.47, 0.58, 0.875, 0,    W],      //  8 верх лобового
                [-0.15,   W,     1.13,  1.255, 1.78,  1,   0.47, 0.58, 0.875, 0,    W],      //  9 скругление крыши
                [Z_B0,    W,     1.13,  1.262, 1.788, 1,   0.47, 0.58, 0.875, 0,    W],      // 10-11 средняя стойка
                [Z_B1,    W,     1.13,  1.268, 1.79,  1,   0.47, 0.58, 0.875, 0,    W],
                [0.65,    W,     1.13,  1.285, 1.79,  1,   0.47, 0.58, 0.875, 0,    W],      // 12 отсюда подоконник взлетает вверх
                [Z_C0,    W,     1.14,  1.345, 1.787, 1,   0.47, 0.58, 0.875, 0,    W],      // 13 верх задней кромки стекла
                [Z_C1,    W,     1.15,  1.37,  1.786, 1,   0.47, 0.58, 0.875, 0,    W],      // 14 низ этой кромки; дальше — задняя стойка
                [CAB_END, W,     1.17,  1.35,  1.775, 1,   0.47, 0.58, 0.875, 0,    W]];     // 15 задняя стенка кабины
  // в сечения добавлены точки дуг ниш; низ всех сечений над колёсами поднят до дуги
  const rowAt = (z) => { const i = SECT.findIndex((s) => s[0] > z), a = SECT[i - 1], b = SECT[i]; return a.map((v, k) => v + (b[k] - v) * (z - a[0]) / (b[0] - a[0])); };
  const rows = [...SECT, ...[...archZ(ARCH_F), ...archZ(ARCH_R).filter((z) => z < CAB_END)].map(rowAt)].sort((p, q) => p[0] - q[0]);
  for (const r of rows) r[6] = Math.max(r[6], archY(ARCH_F, r[0]), archY(ARCH_R, r[0]));
  const rings = rows.map(([z, Wz, S, M, T, c, B, F, Wb, lean, Wu]) => {
    const cab = cabHalf(Wu, M, T - M, F), hood = hoodHalf(Wu, M, T - M, F);
    const half = [[Wb, B], [Wz, S], ...cab.map(([x, y], j) => [x * c + hood[j][0] * (1 - c), y * c + hood[j][1] * (1 - c)]), [0, T]];
    return [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [x, y, z - lean * Math.min(T - y, 0.5)]);
  });
  // точки контура: 0 низ, 1 плечо, 2 пояс, 3 подоконник, 4 верх окна, 5 угол крыши, 6 край плоского верха, 7 ось, дальше зеркально (8..14)
  const zs = rows.map((r) => r[0]), within = (i, a, b) => zs[i] > a - 1e-6 && zs[i] < b - 1e-6;
  skin(rings, [paint, glass, dark, lensMat, pit, lampGlass], (i, j) => {
    if (j === 14) return [4, 4];                                                   // днище и своды ниш — чёрные
    if (i === 0 && j === 1) return [3, 0, true];                                   // фара-клин: остриё у решётки,
    if (i === 0 && j === 12) return [0, 3];
    if (i === 1 && (j === 1 || j === 12)) return [5, 5];                           // стеклом огибает угол
    if (i === 2 && j === 1) return [0, 5, true];                                   // и сходит в остриё на крыле
    if (i === 2 && j === 12) return [5, 0];
    const top = j >= 5 && j <= 8, side = j === 3 || j === 10;
    if (top && within(i, Z_COWL, Z_WS0)) return [2, 2];                            // решётка под дворниками
    if (top && within(i, Z_WS0, Z_WS1)) return [1, 1];                             // лобовое стекло
    if (side && within(i, Z_A, Z_WS1)) return j === 3 ? [1, 0, true] : [0, 1];     // передний край дверного — косой, вдоль стойки
    if (side && (within(i, Z_WS1, Z_B0) || within(i, Z_B1, Z_C0))) return [1, 1];  // стёкла передней и задней дверей
    if (side && within(i, Z_B0, Z_B1)) return [2, 2];                              // чёрная средняя стойка
    if (side && within(i, Z_C0, Z_C1)) return j === 3 ? [1, 0] : [0, 1, true];     // задний край: низ дальше к корме
    return [0, 0];
  }, [2, 0]);                                                                      // передний торец — тёмная решётка

  // --- кузов. Борт — своя обшивка: наружная стенка в цвет кузова с дугой задней ниши и ребром под кромкой,
  // чёрная накладка по верху, тёмная внутренняя стенка. У кормы низ борта поднят над бампером, угол в плане срезан.
  const BED0 = 1.16, BED_END = 2.70, BED_TOP = 1.33, FLOOR = 0.84, IN = 0.805;
  //            z     полушир. низ
  const WALL = [[BED0, W,    0.47], [2.07, W, 0.50], [2.56, W, 0.50], [2.60, W, 0.79], [2.66, W, 0.79], [BED_END, 0.865, 0.79]];
  const wallAt = (z) => { const i = WALL.findIndex((s) => s[0] > z), a = WALL[i - 1], b = WALL[i]; return a.map((v, k) => v + (b[k] - v) * (z - a[0]) / (b[0] - a[0])); };
  const wall = [...WALL, ...archZ(ARCH_R).filter((z) => z > BED0).map(wallAt)].sort((p, q) => p[0] - q[0]);
  for (const r of wall) r[2] = Math.max(r[2], archY(ARCH_R, r[0]));
  for (const sx of [-1, 1]) {
    skin(wall.map(([z, Wz, B]) => [[Wz - 0.03, B], [Wz, 1.22], [Wz - 0.012, BED_TOP], [Wz - 0.02, BED_TOP + 0.015], [IN, BED_TOP + 0.015], [IN, 0.80]]
      .map(([x, y]) => [sx * x, y, z])), [paint, dark, liner], (i, j) => j < 3 ? [0, 0] : j === 3 ? [1, 1] : [2, 2]);
  }
  part(2 * IN, FLOOR - 0.80, BED_END - 0.05 - BED0, liner, 0, (FLOOR + 0.80) / 2, (BED0 + BED_END - 0.05) / 2);   // пол
  for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) part(0.06, 0.012, 1.36, rib, x, FLOOR + 0.006, 1.92);       // рёбра пола
  part(2 * IN, BED_TOP + 0.015 - FLOOR, 0.04, liner, 0, (BED_TOP + 0.015 + FLOOR) / 2, BED0 + 0.02);       // передняя стенка
  part(2 * W - 0.06, 0.80, 0.03, dark, 0, 0.90, (CAB_END + BED0) / 2);                                     // щель между кабиной и кузовом
  // задний борт — вертикальный, между фонарями, сверху козырёк; изнутри тёмный
  part(2 * IN, BED_TOP - 0.79, 0.05, paint, 0, (BED_TOP + 0.79) / 2, BED_END - 0.025);
  part(2 * IN, 0.035, 0.085, paint, 0, BED_TOP + 0.005, BED_END - 0.022);
  part(2 * IN, BED_TOP - FLOOR, 0.012, liner, 0, (BED_TOP + FLOOR) / 2, BED_END - 0.056);
  part(0.30, 0.09, 0.02, dark, 0, 1.175, BED_END + 0.006);                                                  // ручка в тёмной нише
  part(0.22, 0.045, 0.02, chrome, 0, 1.18, BED_END + 0.018);
  part(0.20, 0.04, 0.015, chrome, -0.54, 0.985, BED_END + 0.006);                                           // надписи: ISUZU и D-MAX слева,
  part(0.24, 0.05, 0.015, chrome, -0.52, 0.91, BED_END + 0.006);
  part(0.16, 0.04, 0.015, chrome, 0.50, 0.92, BED_END + 0.006);                                           // шильдик справа
  // тёмное нутро: рама и моторный отсек — закрывают просвет в нишах и под порогами
  part(1.2, 0.66, 1.0, pit, 0, 0.67, -1.52);
  part(1.2, 0.46, 3.18, pit, 0, 0.57, 0.57);
  part(0.9, 0.30, 0.42, pit, 0, 0.65, 2.37);

  // --- отбортовки ниш: гранёный наплыв вдоль дуги. Сечение: кромка ниши, плоская стенка, фаска, верх уходит в борт.
  // e — вылет наплыва по ходу дуги (от переднего конца к заднему): к концам сходит на нет.
  const flare = (arch, zlist, E) => {
    const [zc, a, b] = arch;
    for (const sx of [-1, 1]) {
      skin(zlist.map((z) => {
        const y = archY(arch, z), u = (z - zc) / a, nz = Math.sign(u) * Math.abs(u) ** (PW - 1) / a, ny = ((y - R) / b) ** (PW - 1) / b, n = Math.hypot(nz, ny);
        const t = (u + 1) / 2 * (E.length - 1), k = Math.min(E.length - 2, Math.floor(t));
        const e = 0.03 * (E[k] + (E[k + 1] - E[k]) * (t - k));
        return [[W - 0.03, 0], [W + e, 0], [W + e, 0.055], [W + e * 0.4, 0.085], [W - 0.004, 0.10], [W - 0.03, 0.10]]
          .map(([x, r]) => [sx * x, y + r * ny / n, z + r * nz / n]);
      }));
    }
  };
  flare(ARCH_F, zs.filter((z) => archY(ARCH_F, z) > 0.50), [1, 1, 1, 1, 0.9, 0.6, 0.2]);        // спереди сливается с углом бампера
  flare(ARCH_R, [...zs, ...wall.map((r) => r[0])].filter((z) => archY(ARCH_R, z) > 0.50), [0.2, 0.6, 0.9, 1, 1, 0.9, 0.7]);

  // --- бамперы: профиль в плоскости (z, y), протянутый поперёк машины; в плане выгнуты дугой.
  // Передний — только губа под решёткой: [x, нос z0, кромка полки]. Задняя стенка — передний край ниши, тёмная.
  const across = (half) => [...half.slice().reverse().map(([x, ...t]) => [-x, ...t]), ...half];
  const LIP = [[0.20, -2.4675, -2.44], [0.45, -2.455, -2.435], [0.70, -2.43, -2.40], [0.86, -2.37, -2.34], [0.92, -2.28, -2.25], [0.935, -2.20, -2.16]];
  skin(across(LIP).map(([x, z0, zl]) => [[-2.07, 0.55], [zl, 0.63], [z0, 0.585], [z0, 0.47], [z0 + 0.06, 0.42], [-2.07, 0.42]]
    .map(([z, y]) => [x, y, z])), [paint, pit], (i, j) => j >= 4 ? [1, 1] : [0, 0]);
  part(0.34, 0.11, 0.02, plate, 0, 0.527, -2.474);                                                         // передний номер
  // задний: углы в цвет кузова, середина утоплена и чёрная; сверху чёрная накладка-ступенька
  const RB = [[0.50, 2.755], [0.52, 2.7975], [0.80, 2.79], [0.90, 2.74], [0.935, 2.68]];
  skin(across(RB).map(([x, z0]) => [[2.60, 0.78], [z0 - 0.02, 0.78], [z0, 0.75], [z0, 0.57], [z0 - 0.04, 0.52], [2.57, 0.52]]
    .map(([z, y]) => [x, y, z])), [paint, dark], (i) => i >= 3 && i <= 5 ? [1, 1] : [0, 0]);
  part(1.62, 0.02, 0.14, dark, 0, 0.79, 2.72);
  part(0.34, 0.12, 0.02, plate, 0, 0.66, 2.765);                                                          // задний номер
  part(0.12, 0.09, 0.14, dark, 0, 0.45, 2.70);                                                             // фаркоп с шаром
  part(0.05, 0.06, 0.05, chrome, 0, 0.45, 2.772);

  // --- перед. На торце-решётке: надпись ISUZU под кромкой капота и два хромовых «клыка»; ниже — тёмные ламели
  const LEAN = Math.atan(0.10), face = (y) => -2.39 - 0.10 * (1.14 - y);          // z торца на высоте y
  const onFace = (w, h, d, mat, y) => { part(w, h, d, mat, 0, y, face(y) - d / 2 + 0.005).rotation.x = LEAN; };
  onFace(0.36, 0.045, 0.03, shine, 1.082);
  onFace(1.08, 0.05, 0.045, shine, 1.0);
  onFace(1.02, 0.05, 0.045, shine, 0.875);
  onFace(0.94, 0.02, 0.025, gun, 0.78);
  onFace(0.88, 0.02, 0.025, gun, 0.705);
  const mix = (a, b, k) => a.map((v, n) => v + (b[n] - v) * k), proud = (d) => ([x, y, z]) => [x, y, z - d];
  for (const sx of [-1, 1]) {
    // фара у решётки: накладка-четырёхугольник поверх клина (верхняя кромка почти горизонтальна), в ней тёмная линза
    const j = sx > 0 ? [1, 2] : [13, 12], A = rings[0], B = rings[1];
    const cell = (u, v) => mix(mix(A[j[0]], B[j[0]], u), mix(A[j[1]], B[j[1]], u), v);
    patch([A[j[0]], B[j[0]], B[j[1]], mix(A[j[0]], A[j[1]], 0.45)].map(proud(0.012)), lensMat, [0, 1, -1]);
    { const q = cell(0.62, 0.5); part(0.08, 0.07, 0.04, gun, q[0], q[1], q[2] - 0.024).rotation.y = -sx * 0.2; }   // линза
    // вертикальная ниша противотуманки на скошенном углу, в ней две лампы
    part(0.11, 0.22, 0.05, dark, sx * 0.745, 0.73, -2.372).rotation.y = -sx * 0.16;
    part(0.07, 0.07, 0.05, lensMat, sx * 0.745, 0.79, -2.385).rotation.y = -sx * 0.16;
    part(0.05, 0.05, 0.05, lensMat, sx * 0.745, 0.675, -2.385).rotation.y = -sx * 0.16;
    // задний фонарь: клин на углу кузова, на торце два светлых квадрата с красной серединой
    skin([0.835, 0.917].map((x) => [[2.52, 1.24], [2.715, 1.24], [2.715, 0.84], [2.66, 0.84], [2.62, 1.02]].map(([z, y]) => [sx * x, y, z])), [reflMat]);
    part(0.12, 0.40, 0.02, reflMat, sx * 0.78, 1.04, BED_END + 0.008);
    for (const y of [1.135, 0.945]) {
      part(0.14, 0.15, 0.02, lensMat, sx * 0.815, y, BED_END + 0.02);
      part(0.07, 0.08, 0.02, tailMat, sx * 0.815, y, BED_END + 0.032);
    }
    // зеркало на ножке у основания стойки, ручки дверей
    part(0.10, 0.06, 0.10, dark, sx * 0.92, 1.28, -0.90);
    const mir = part(0.21, 0.17, 0.14, paint, sx * 1.055, 1.33, -0.82);                        // корпус: сзади тёмное стекло,
    mir.rotation.y = sx * 0.3;                                                                 // спереди янтарный повторитель
    mir.add(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.14, 0.02), dark), new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.02), amberMat));
    mir.children[0].position.z = 0.071; mir.children[1].position.set(sx * 0.05, 0, -0.071);
    part(0.03, 0.045, 0.25, chrome, sx * 0.908, 1.115, -0.045);
    part(0.03, 0.045, 0.25, chrome, sx * 0.908, 1.14, 0.875);
    // швы дверей: передняя кромка передней двери, стык дверей, задняя кромка задней двери — огибает арку
    for (const [pts] of [[[[-0.98, 0.50], [-1.02, 0.90], [-1.0, 1.22]]], [[[0.15, 0.50], [0.17, 0.90], [0.19, 1.25]]],
                         [[[0.86, 0.50], [0.98, 0.72], [1.07, 0.98], [1.09, 1.32]]]]) {
      for (let k = 0; k + 1 < pts.length; k++) {
        const P = pts.slice(k, k + 2).map(([z, y]) => [sx * (y < 1.13 ? W - 0.03 * (1.13 - y) / 0.66 : W - 0.0135 * (y - 1.13) / 0.13), y, z]);
        rod(P[0], P[1], 0.02, 0.02, seam);
      }
    }
    part(0.13, 0.04, 1.96, steel, sx * 0.87, 0.385, 0.02);                                     // подножка
    part(0.10, 0.012, 1.80, dark, sx * 0.865, 0.409, 0.02);
    part(0.24, 0.30, 0.025, dark, sx * 0.78, 0.375, DMAX_AXLE + 0.525);                        // брызговики
    part(0.20, 0.20, 0.025, dark, sx * 0.79, 0.40, -DMAX_AXLE + 0.525);
    part(0.22, 0.12, 0.80, liner, sx * 0.695, FLOOR + 0.06, DMAX_AXLE);                        // надколёсный короб в кузове
  }
  // лючок бензобака — на левом борту кузова, рамкой
  for (const [a, b] of [[[1.27, 0.98], [1.45, 0.98]], [[1.45, 0.98], [1.45, 1.15]], [[1.45, 1.15], [1.27, 1.15]], [[1.27, 1.15], [1.27, 0.98]]])
    rod([-(W - 0.004), a[1], a[0]], [-(W - 0.004), b[1], b[0]], 0.02, 0.02, seam);
  // заднее стекло кабины в тёмной рамке, над ним стоп-сигнал; дворники, антенна, выхлопная труба
  part(1.38, 0.36, 0.02, dark, 0, 1.52, CAB_END + 0.004);
  part(1.32, 0.30, 0.02, glass, 0, 1.52, CAB_END + 0.016);
  part(0.30, 0.035, 0.03, tailMat, 0, 1.735, CAB_END + 0.008);
  rod([-0.64, 1.305, -1.095], [-0.12, 1.33, -1.065], 0.025, 0.02, dark);
  rod([0.0, 1.305, -1.095], [0.52, 1.33, -1.065], 0.025, 0.02, dark);
  rod([0.50, 1.75, -0.30], [0.50, 1.95, -0.14], 0.015, 0.015, dark);
  { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), steel);
    pipe.geometry.rotateX(Math.PI / 2); pipe.rotation.y = 0.5; pipe.position.set(0.68, 0.46, 2.30); body.add(pipe); }

  // колёса: шина, светлый диск с шестью тёмными прорезями и тёмной ступицей — видно, как крутится
  const TW = 0.26, tyreGeo = new THREE.CylinderGeometry(R, R, TW, 16); tyreGeo.rotateZ(Math.PI / 2);
  const disc = (r, n) => { const g = new THREE.CircleGeometry(r, n); g.rotateY(Math.PI / 2); return g; };   // лицом к +X
  const rimGeo = disc(0.245, 16), hubGeo = disc(0.075, 8), capGeo = disc(0.035, 6), slotGeo = new THREE.BoxGeometry(0.01, 0.40, 0.065);
  const front = [], spin = [];
  for (const z of [-DMAX_AXLE, DMAX_AXLE]) for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(), wheel = new THREE.Group(), faceG = new THREE.Group();
    pivot.position.set(sx * 0.76, R, z);
    const put = (geo, mat, x) => { const m = new THREE.Mesh(geo, mat); m.position.x = TW / 2 + x; faceG.add(m); return m; };
    put(rimGeo, chrome, 0.01); put(hubGeo, gun, 0.03); put(capGeo, chrome, 0.04);     // слои диска — по сантиметру друг над другом
    for (let k = 0; k < 3; k++) put(slotGeo, gun, 0.02).rotation.x = k * Math.PI / 3;
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
