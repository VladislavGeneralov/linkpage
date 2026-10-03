// Модель взята из car_look/scooters/buildScooter_draft.js (её ведёт отдельная сессия); при обновлении черновика —
// скопировать сюда заново, без пробного вызова в конце. Файл только объявляет SCOOTERS и buildScooter(P); ездить можно на Wave, остальные стоят на парковках и у обочин.
// ---------- Скутеры ----------
// Шесть самых ходовых скутеров Самуи из одного каркаса: buildScooter(SCOOTERS.click) и т.д.
// Размеры — паспортные: база wb, длина L, радиусы и ширина шин, высота сиденья, клиренс; высота руля взята
// так, чтобы верх зеркал совпал с паспортной высотой. Компоновка снята с боковых фото: нос щитка нависает
// над передним колесом, пол начинается сразу за шиной и короткий, подседельный объём занимает заднюю половину
// базы и толстой массой накрывает заднее колесо. В таблицах сечений z считается от передней оси назад.
// Скутер: щиток с носом-фарой, его задняя стенка наклонена по колонке; пол (у макси — тоннель между ног);
// подседельный объём, ступенчатое сиденье, хвост с фонарём и поручнем. Под сиденьем тёмный обтекатель мотора;
// слева у заднего колеса кожух вариатора с воздушным фильтром и амортизатор, справа глушитель с экраном.
// Wave — андербон: вместо пола хребет от рулевой колонки к сиденью, щитки-крылья для ног, под хребтом
// горизонтальный мотор, цепь слева, два задних амортизатора, фара в кожухе руля.
// Передняя часть (колесо с диском, крыло, вилка, колонка, руль, зеркала) сидит в шарнире, наклонённом
// по оси рулевой колонки: игра меняет ему только rotation.y, наклон rotation.x трогать нельзя. Нос — к -Z.
//   rF, rR, twF, twR — радиусы и ширина шин; seatH, pillionH — места водителя и пассажира; tailH — верх хвоста;
//   floorY — пол; belly — клиренс; floorW, bodyW, shieldW — полуширины пола, подседельного объёма и щитка;
//   legroom — длина пола; overWheel — низ бортов над задней осью; tunnel: [высота у щитка, у сиденья] или нет;
//   noseZ, noseY, noseH, noseW — нос щитка: вынос, высота, полувысота и полуширина; shieldTop — верх щитка;
//   barY — руль; head — фары: 'wide' полоса во весь нос, 'twin' две, 'round' большая круглая, 'bar' в кожухе руля;
//   screen — высота ветрового стекла; trim — цвет бортов пола.
const SCOOTERS = {
  // Honda Click 160 — узкий спортивный, плоский пол, острый нос, белый с чёрным низом
  click:  { wb: 1.278, L: 1.929, rF: 0.258, rR: 0.262, twF: 0.10, twR: 0.12, seatH: 0.778, pillionH: 0.82, tailH: 0.88,
            floorY: 0.30, belly: 0.14, floorW: 0.19, bodyW: 0.17, shieldW: 0.19, legroom: 0.28, overWheel: 0.56,
            noseZ: -0.08, noseY: 0.72, noseH: 0.05, noseW: 0.09, shieldTop: 0.87, barY: 0.95, head: 'wide', screen: 0,
            paint: 0xe9e9e4, trim: 0x2e2e31, seat: 0x1c1c1e, wheel: 0x2a2a2c, fork: 0xc4c6c8, decal: 0x8a9096 },
  // Honda Scoopy — маленькие колёса, круглые ретро-формы, большая фара в щитке, кремовый с коричневым сиденьем
  scoopy: { wb: 1.251, L: 1.864, rF: 0.243, rR: 0.25, twF: 0.10, twR: 0.11, seatH: 0.746, pillionH: 0.765, tailH: 0.79,
            floorY: 0.29, belly: 0.145, floorW: 0.20, bodyW: 0.19, shieldW: 0.20, legroom: 0.26, overWheel: 0.46,
            noseZ: 0.0, noseY: 0.77, noseH: 0.12, noseW: 0.10, shieldTop: 0.89, barY: 0.94, head: 'round', screen: 0, round: 0.075,
            paint: 0xe2d6bc, trim: 0xe2d6bc, seat: 0x6a4630, wheel: 0xa8935c, fork: 0x2a2a2c, decal: 0xd8dad6 },
  // Honda Wave 110i — андербон на больших тонких колёсах, красный с серебристой полосой
  wave:   { underbone: true, wb: 1.227, L: 1.919, rF: 0.279, rR: 0.288, twF: 0.07, twR: 0.08, seatH: 0.76, tailH: 0.86,
            barY: 0.94, head: 'bar', paint: 0xb8242a, seat: 0x1c1c1e, wheel: 0x2a2a2c, fork: 0xc4c6c8, decal: 0xc4c6c8 },
  // Honda PCX 160 — длинный низкий макси: широкий нос с фарой-полосой, тоннель, короткое стекло, матово-серый
  pcx:    { wb: 1.313, L: 1.936, rF: 0.255, rR: 0.256, twF: 0.11, twR: 0.13, seatH: 0.764, pillionH: 0.83, tailH: 0.87,
            floorY: 0.30, belly: 0.135, floorW: 0.24, bodyW: 0.21, shieldW: 0.23, legroom: 0.36, overWheel: 0.50, tunnel: [0.50, 0.44],
            noseZ: -0.14, noseY: 0.72, noseH: 0.045, noseW: 0.15, shieldTop: 0.90, barY: 0.97, head: 'wide', screen: 0.17,
            paint: 0x6c7076, trim: 0x6c7076, seat: 0x1c1c1e, wheel: 0x2a2a2c, fork: 0x2a2a2c, decal: 0x9aa0a6 },
  // Yamaha NMAX 155 — коренастый макси на толстых 13-дюймовых колёсах, высокое стекло, две фары, тёмно-синий
  nmax:   { wb: 1.34, L: 1.935, rF: 0.242, rR: 0.256, twF: 0.11, twR: 0.13, seatH: 0.765, pillionH: 0.84, tailH: 0.89,
            floorY: 0.31, belly: 0.125, floorW: 0.24, bodyW: 0.22, shieldW: 0.24, legroom: 0.36, overWheel: 0.52, tunnel: [0.54, 0.47],
            noseZ: -0.10, noseY: 0.68, noseH: 0.06, noseW: 0.14, shieldTop: 0.93, barY: 1.0, head: 'twin', screen: 0.22,
            paint: 0x27365a, trim: 0x27365a, seat: 0x1c1c1e, wheel: 0x2a2a2c, fork: 0x2a2a2c, decal: 0x9aa0a6, shock: 0xb89a3c },
  // Yamaha Aerox 155 — спортивный: острый нос с двумя фарами, высокий хребет между ног, задранный хвост, синий
  aerox:  { wb: 1.35, L: 1.98, rF: 0.266, rR: 0.276, twF: 0.11, twR: 0.14, seatH: 0.79, pillionH: 0.88, tailH: 0.96,
            floorY: 0.33, belly: 0.143, floorW: 0.19, bodyW: 0.19, shieldW: 0.20, legroom: 0.32, overWheel: 0.60, tunnel: [0.70, 0.60],
            noseZ: -0.16, noseY: 0.70, noseH: 0.045, noseW: 0.08, shieldTop: 0.90, barY: 0.99, head: 'twin', screen: 0.12,
            paint: 0x1f3fb0, trim: 0x1f3fb0, seat: 0x1c1c1e, wheel: 0x2a2a2c, fork: 0x2a2a2c, decal: 0xc4c6c8 },
};
function buildScooter(P) {
  const bike = new THREE.Group(), body = new THREE.Group();       // body качается; колёса остаются на земле
  bike.add(body);
  const paint = lambert({ color: P.paint }), trim = lambert({ color: P.trim || P.paint }), seatMat = lambert({ color: P.seat });
  const chrome = lambert({ color: 0xd8dad6 }), dark = lambert({ color: 0x1a1a1a }), glass = lambert({ color: 0x2c3a4c });
  const steel = lambert({ color: 0x8c8e90 }), decal = lambert({ color: P.decal }), forkMat = lambert({ color: P.fork });
  const cowl = lambert({ color: 0x2e2e31 }), plate = lambert({ color: 0xe9e9e4 });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 }), tailMat = new THREE.MeshBasicMaterial({ color: 0xd42020 });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xf08a20 });

  // грань-треугольник в список; обход выставляется наружу от точки o внутри тела
  const mid = (r) => r.reduce((c, p) => [c[0] + p[0] / r.length, c[1] + p[1] / r.length, c[2] + p[2] / r.length], [0, 0, 0]);
  const tri = (dst, a, b, c, o) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const g = mid([a, b, c]);
    const outward = (uy * vz - uz * vy) * (g[0] - o[0]) + (uz * vx - ux * vz) * (g[1] - o[1]) + (ux * vy - uy * vx) * (g[2] - o[2]);
    dst.push(...a, ...(outward < 0 ? c : b), ...(outward < 0 ? b : c));
  };
  const zf = -P.wb / 2, zr = P.wb / 2;                            // оси колёс
  // обшивка по сечениям [z от передней оси, полуширина, низ, верх, полуширина верха, сдвиг по X]: каждое —
  // восьмиугольник со скошенными углами; торцы закрыты. У граней нет общих вершин — освещение гранёное.
  const skin = (sects, mat, parent = body, z0 = zf) => {
    const rings = sects.map(([z, W, yb, yt, Wt = W, cx = 0]) => {
      const r = Math.min(P.round || 0.04, W * 0.45, Wt * 0.45, (yt - yb) * 0.35);
      return [[W, yb + r], [Wt, yt - r], [Wt - r, yt], [-Wt + r, yt], [-Wt, yt - r], [-W, yb + r], [-W + r, yb], [W - r, yb]].map(([x, y]) => [cx + x, y, z0 + z]);
    });
    const v = [], cs = rings.map(mid), n = rings.length;
    for (let i = 0; i + 1 < n; i++) {
      const A = rings[i], B = rings[i + 1], o = mid([cs[i], cs[i + 1]]);
      for (let j = 0; j < 8; j++) { const k = (j + 1) % 8; tri(v, A[j], B[j], A[k], o); tri(v, B[j], B[k], A[k], o); }
    }
    for (const [e, o] of [[0, cs[1]], [n - 1, cs[n - 2]]]) for (let j = 0; j < 8; j++) tri(v, cs[e], rings[e][j], rings[e][(j + 1) % 8], o);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); parent.add(m); return m;
  };
  // детали: брусок, брусок между двумя точками, цилиндр вдоль оси X; координаты — в метрах от середины базы
  const part = (w, h, d, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const rod = (a, b, w, h, mat, parent = body) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = part(w, h, A.distanceTo(B), mat, 0, 0, 0, parent);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), B.sub(A).normalize());
    return m;
  };
  const drum = (r, w, mat, seg = 12) => { const g = new THREE.CylinderGeometry(r, r, w, seg); g.rotateZ(Math.PI / 2); return new THREE.Mesh(g, mat); };

  const RAKE = 0.43;                                              // наклон рулевой колонки, ~25°
  const rearEnd = P.L - P.wb - P.rF, tailLen = rearEnd - 0.05;    // вылет за заднюю ось: номер и кончик хвоста
  const barYr = P.barY - P.rF, barZ = barYr * Math.tan(RAKE);     // руль — на оси колонки (от передней оси)
  const pillionH = P.pillionH || P.seatH + 0.02, overWheel = P.overWheel || 2 * P.rR + 0.04;
  const side = P.twR / 2 + 0.075;                                 // вынос кожуха вариатора и глушителя от оси байка

  if (!P.underbone) {
    const wheelBack = P.rF + 0.045;                               // сразу за шиной корпус опускается до клиренса
    const over = (z) => P.rF + Math.sqrt(Math.max(0, wheelBack ** 2 - z * z));   // низ щитка над передней шиной
    const topZ = Math.min(barZ - 0.09, wheelBack - 0.05), noseTop = P.noseY + P.noseH;
    const apronTop = (z) => noseTop + (P.shieldTop - noseTop) * Math.min(1, Math.max(0, (z - P.noseZ) / (topZ - P.noseZ)));   // передний скат щитка
    const apronBot = (z) => Math.max(over(z), P.noseY - P.noseH - 1.2 * (z - P.noseZ));
    const z1 = P.noseZ + 0.08, z2 = Math.max(z1 + 0.05, 0.13);
    const wallZ = wheelBack + 0.025, wallTopZ = barZ + 0.09;      // задняя стенка щитка: низ и верх
    const boxF = wheelBack + 0.03 + P.legroom;                    // передняя стенка подседельного объёма
    // --- щиток: нос с фарой, скат к рулю, низ огибает колесо, задняя стенка наклонена по колонке
    skin([[P.noseZ, P.noseW, P.noseY - P.noseH, noseTop, P.noseW * 0.8],
          [z1, (P.noseW + P.shieldW) / 2, apronBot(z1), apronTop(z1), P.shieldW * 0.5],
          [z2, P.shieldW, apronBot(z2), apronTop(z2), P.shieldW * 0.62],
          [topZ, P.shieldW, apronBot(topZ), P.shieldTop, P.shieldW * 0.62],
          [wheelBack - 0.015, P.shieldW, apronBot(wheelBack - 0.015), P.shieldTop, P.shieldW * 0.62],
          [wallZ, P.shieldW, P.belly + 0.02, P.shieldTop, P.shieldW * 0.62],
          [wallTopZ, P.shieldW * 0.9, P.shieldTop - 0.07, P.shieldTop - 0.02, P.shieldW * 0.62]], paint);
    { const wall = (y) => wallZ + (wallTopZ - wallZ) * (y - P.belly - 0.02) / (P.shieldTop - 0.09 - P.belly);       // тёмная изнанка щитка
      rod([0, P.floorY + 0.04, zf + wall(P.floorY + 0.04) + 0.012], [0, P.shieldTop - 0.13, zf + wall(P.shieldTop - 0.13) + 0.012], P.shieldW * 1.5, 0.012, dark); }
    // --- пол; у макси по оси тоннель между ног, у остальных коврик
    skin([[wheelBack, P.floorW, P.belly, P.floorY], [boxF + 0.03, P.floorW, P.belly, P.floorY]], trim);
    if (P.tunnel) skin([[wheelBack + 0.03, 0.095, P.floorY - 0.04, P.tunnel[0]],
                        [boxF - 0.14, 0.10, P.floorY - 0.04, P.tunnel[1]],
                        [boxF + 0.03, 0.10, P.floorY - 0.04, P.tunnel[1] + 0.05]], paint);
    else part(2 * P.floorW - 0.07, 0.012, P.legroom - 0.06, dark, 0, P.floorY + 0.006, zf + (wallZ + boxF) / 2 + 0.02);
    // --- подседельный объём: борта накрывают заднее колесо, хвост толстый; под ним тёмный обтекатель мотора
    skin([[boxF - 0.02, P.bodyW * 0.95, P.belly, 0.42], [P.wb - P.rR - 0.03, P.bodyW * 0.9, P.belly + 0.07, 0.44]], cowl);
    skin([[boxF - 0.03, P.bodyW * 0.75, P.floorY - 0.01, P.seatH - 0.15],
          [boxF + 0.07, P.bodyW, 0.40, P.seatH - 0.08],
          [P.wb - P.rR - 0.03, P.bodyW, 0.42, P.seatH - 0.06],
          [P.wb, P.bodyW * 0.95, overWheel, pillionH - 0.06],
          [P.wb + tailLen * 0.6, P.bodyW * 0.75, P.tailH - 0.22, P.tailH - 0.04],
          [P.wb + tailLen, 0.07, P.tailH - 0.12, P.tailH - 0.02]], paint);
    for (const sx of [-1, 1]) rod([sx * (P.bodyW + 0.004), 0.5, zf + boxF + 0.1], [sx * (P.bodyW + 0.004), 0.6, zf + P.wb - P.rR - 0.05], 0.012, 0.05, decal);   // полоса по борту, где он ровный
    // --- сиденье: нос, седло водителя, ступенька, место пассажира
    skin([[boxF - 0.07, P.bodyW * 0.5, P.seatH - 0.12, P.seatH - 0.06],
          [boxF + 0.10, P.bodyW * 0.95, P.seatH - 0.09, P.seatH],
          [boxF + 0.40, P.bodyW * 0.95, P.seatH - 0.07, P.seatH],
          [boxF + 0.47, P.bodyW * 0.9, P.seatH - 0.05, pillionH],
          [P.wb + 0.10, P.bodyW * 0.75, pillionH - 0.06, pillionH + 0.005]], seatMat);
    // --- мотор: блок под сиденьем, слева кожух вариатора с воздушным фильтром и амортизатор
    part(P.bodyW * 1.3, 0.2, 0.26, dark, 0, P.rR + 0.02, zr - P.rR - 0.18);
    part(0.09, 0.17, 0.52, cowl, -side, P.rR + 0.01, zr - 0.2);
    part(0.085, 0.11, 0.28, dark, -side - 0.005, P.rR + 0.17, zr - 0.1);
    rod([-side, P.rR + 0.09, zr], [-(P.bodyW - 0.02), overWheel + 0.06, zr - 0.1], 0.04, 0.04, lambert({ color: P.shock || 0x8c8e90 }));
    // --- нос: фары, поворотники, эмблема на скате, стекло
    const nz = zf + P.noseZ - 0.009;
    if (P.head === 'wide') {
      part(P.noseW * 1.5, P.noseH * 1.1, 0.02, lensMat, 0, P.noseY, nz);
      for (const sx of [-1, 1]) rod([sx * P.noseW * 0.9, P.noseY + P.noseH * 0.4, nz + 0.02], [sx * P.shieldW * 0.78, apronTop(z2) - 0.07, zf + z2 - 0.01], 0.02, 0.035, lensMat);   // ходовые огни на скулах
    } else if (P.head === 'twin') {
      for (const sx of [-1, 1]) part(P.noseW * 0.62, P.noseH * 1.1, 0.02, lensMat, sx * P.noseW * 0.5, P.noseY, nz);
      part(P.noseW * 0.3, P.noseH * 1.3, 0.022, dark, 0, P.noseY, nz);
    } else if (P.head === 'round') {                                                              // большая овальная фара в хромовом ободке
      const rim = drum(0.105, 0.03, chrome, 14); rim.geometry.rotateY(Math.PI / 2); rim.scale.set(0.9, 1.15, 1);
      rim.position.set(0, P.noseY + 0.01, zf + P.noseZ - 0.005); body.add(rim);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.086, 14), lensMat);
      lens.scale.set(0.9, 1.15, 1); lens.rotation.y = Math.PI; lens.position.set(0, P.noseY + 0.01, zf + P.noseZ - 0.022); body.add(lens);
    }
    for (const sx of [-1, 1]) part(0.025, 0.045, 0.07, amberMat, sx * (P.shieldW + 0.004), apronBot(z2) + 0.1, zf + z2 + 0.04);   // передние поворотники
    { const ez = (P.noseZ + topZ) / 2, slope = Math.atan2(P.shieldTop - noseTop, topZ - P.noseZ);
      part(0.06, 0.012, 0.045, chrome, 0, apronTop(ez) + 0.008, zf + ez).rotation.x = -slope; }                      // эмблема
    if (P.screen) part(P.shieldW * 1.15, P.screen, 0.015, glass, 0, P.shieldTop + P.screen * 0.42, zf + topZ + 0.02).rotation.x = 0.5;   // ветровое стекло
    // --- поручень пассажира
    for (const sx of [-1, 1]) rod([sx * P.bodyW * 0.62, pillionH - 0.03, zr - 0.02], [sx * P.bodyW * 0.5, P.tailH + 0.03, zr + tailLen * 0.75], 0.025, 0.025, dark);
    part(P.bodyW + 0.02, 0.025, 0.03, dark, 0, P.tailH + 0.03, zr + tailLen * 0.75);
    // --- глушитель справа: банка с экраном и срезом, задран назад
    const pipe = new THREE.Group();
    { const can = drum(0.065, 0.46, dark, 10); can.geometry.rotateY(Math.PI / 2); pipe.add(can); }
    part(0.02, 0.1, 0.32, cowl, 0.06, 0.005, 0.0, pipe);
    part(0.05, 0.05, 0.02, steel, 0, 0, 0.235, pipe);
    pipe.position.set(side + 0.04, P.rR + 0.06, zr + 0.02); pipe.rotation.x = -0.22; body.add(pipe);
  } else {
    // --- андербон: кожух колонки, щитки-крылья, хребет, подседельный объём до хвоста
    skin([[0.10, 0.07, 0.64, 0.70], [0.20, 0.09, 0.57, 0.80], [0.32, 0.10, 0.44, 0.84], [0.42, 0.09, 0.42, 0.80]], paint);
    for (const sx of [-1, 1]) skin([[0.25, 0.04, 0.54, 0.74, 0.04, sx * 0.15], [0.35, 0.06, 0.36, 0.82, 0.06, sx * 0.16], [0.46, 0.04, 0.33, 0.72, 0.04, sx * 0.155]], paint);
    skin([[0.40, 0.075, 0.44, 0.78], [0.55, 0.08, 0.42, 0.64], [0.72, 0.085, 0.44, 0.60]], paint);
    skin([[0.66, 0.10, 0.46, 0.64], [0.86, 0.135, 0.48, 0.70], [P.wb - 0.10, 0.135, 0.60, 0.74],
          [P.wb + 0.22, 0.10, 0.70, 0.82], [P.wb + tailLen, 0.05, 0.78, 0.86]], paint);
    for (const sx of [-1, 1]) rod([sx * 0.139, 0.6, zf + 0.87], [sx * 0.139, 0.685, zf + P.wb - 0.11], 0.012, 0.045, decal);   // серебристая полоса по борту, где он ровный
    skin([[0.60, 0.06, 0.62, 0.70], [0.74, 0.12, 0.66, P.seatH], [1.02, 0.13, 0.70, P.seatH + 0.01],
          [P.wb + 0.06, 0.125, 0.73, 0.80], [P.wb + 0.22, 0.08, 0.79, 0.84]], seatMat);
    // --- мотор под хребтом: цилиндр вперёд, блок, крышки; подножки; маятник, кожух цепи слева, два амортизатора
    part(0.13, 0.13, 0.18, steel, 0, 0.36, zf + 0.50);
    part(0.24, 0.20, 0.30, dark, 0, 0.34, zf + 0.69);
    for (const sx of [-1, 1]) {
      part(0.02, 0.14, 0.16, steel, sx * 0.125, 0.33, zf + 0.69);
      rod([sx * 0.10, 0.30, zf + 0.84], [sx * 0.10, P.rR, zr], 0.035, 0.05, dark);
      rod([sx * 0.125, P.rR + 0.03, zr - 0.02], [sx * 0.135, 0.66, zr - 0.17], 0.04, 0.04, steel);
    }
    part(0.50, 0.03, 0.04, dark, 0, 0.27, zf + 0.76);
    rod([-0.125, 0.33, zf + 0.80], [-0.125, 0.3, zr - 0.02], 0.03, 0.09, dark);
    skin([-0.5, 0.2, 0.8, 1.25].map((a) => [P.wb + Math.sin(a) * (P.rR + 0.03), P.twR / 2 + 0.03,
      P.rR + Math.cos(a) * (P.rR + 0.03) - 0.012, P.rR + Math.cos(a) * (P.rR + 0.03) + 0.025]), dark);              // заднее крыло над колесом
    for (const sx of [-1, 1]) rod([sx * 0.11, 0.8, zr + 0.02], [sx * 0.1, P.tailH + 0.01, zr + tailLen * 0.75], 0.025, 0.025, dark);   // поручень
    part(0.22, 0.025, 0.03, dark, 0, P.tailH + 0.01, zr + tailLen * 0.75);
    // --- длинный глушитель справа с блестящим экраном
    const pipe = new THREE.Group();
    { const can = drum(0.05, 0.62, dark, 10); can.geometry.rotateY(Math.PI / 2); pipe.add(can); }
    part(0.02, 0.07, 0.4, steel, 0.045, 0.005, 0.0, pipe);
    pipe.position.set(0.17, 0.36, zr - 0.02); pipe.rotation.x = -0.12; body.add(pipe);
  }

  // --- корма: фонарь с поворотниками, брызговик с номером и катафотом
  part(0.13, 0.05, 0.05, tailMat, 0, P.tailH - 0.07, zr + tailLen);
  for (const sx of [-1, 1]) part(0.035, 0.035, 0.05, amberMat, sx * 0.095, P.tailH - 0.09, zr + tailLen - 0.03);
  rod([0, overWheel, zr + 0.14], [0, P.rR + 0.2, zr + rearEnd - 0.01], 0.13, 0.025, dark);
  part(0.16, 0.1, 0.012, plate, 0, P.rR + 0.19, zr + rearEnd).rotation.x = -0.3;
  part(0.05, 0.025, 0.012, tailMat, 0, P.rR + 0.11, zr + rearEnd - 0.03);

  // --- колёса: шина, обод в цвет диска, контрастные спицы — видно, как крутится; спереди тормозной диск
  const wheelMat = lambert({ color: P.wheel }), spokeColor = P.wheel < 0x808080 ? 0xc4c6c8 : 0x1a1a1a;
  const wheelOf = (r, w, brake) => {
    const g = new THREE.Group();
    g.add(drum(r, w, dark, 14), drum(r * 0.72, w + 0.01, wheelMat));
    for (let k = 0; k < 3; k++) { const s = box(w + 0.02, 0.028, r * 1.36, spokeColor, 0, 0, 0); s.rotation.x = k * Math.PI / 3; g.add(s); }
    g.add(drum(r * 0.2, w + 0.03, wheelMat, 8));
    if (brake) { const d = drum(r * 0.48, 0.012, steel); d.position.x = w / 2 + 0.02; g.add(d); }
    return g;
  };
  // --- передняя часть в шарнире: ось поворота наклонена по колонке, внутри — обычные координаты от оси колеса
  const pivot = new THREE.Group(), front = new THREE.Group(), frontWheel = wheelOf(P.rF, P.twF, true);
  pivot.position.set(0, P.rF, zf); pivot.rotation.x = RAKE;
  front.rotation.x = -RAKE; pivot.add(front); front.add(frontWheel);
  const fenderR = P.rF + 0.03, fenderW = P.twF / 2 + (P.underbone ? 0.035 : 0.025);
  skin((P.underbone ? [-1.15, -0.6, 0, 0.5, 0.95] : [-0.95, -0.3, 0.3, 0.95]).map((a) =>
    [Math.sin(a) * fenderR, fenderW, Math.cos(a) * fenderR - 0.012, Math.cos(a) * fenderR + 0.03]), paint, front, 0);   // крыло
  for (const sx of [-1, 1]) {
    rod([sx * (P.twF / 2 + 0.035), 0, 0], [sx * 0.07, 0.36, 0.36 * Math.tan(RAKE)], 0.035, 0.035, forkMat, front);   // вилка
    rod([sx * 0.2, barYr + 0.01, barZ], [sx * 0.26, barYr + 0.12, barZ - 0.02], 0.018, 0.018, dark, front);       // зеркало на ножке
    part(0.085, 0.05, 0.02, dark, sx * 0.265, barYr + 0.13, barZ - 0.02, front);
    part(0.11, 0.04, 0.045, dark, sx * 0.28, barYr, barZ + 0.02, front);                                           // ручка
  }
  part(0.58, 0.028, 0.035, steel, 0, barYr, barZ + 0.02, front);                                                   // руль
  if (P.head === 'bar') {                                                                                          // кожух руля с фарой и поворотниками
    skin([[barZ - 0.19, 0.07, barYr - 0.11, barYr - 0.03], [barZ - 0.08, 0.14, barYr - 0.12, barYr + 0.04], [barZ + 0.06, 0.12, barYr - 0.06, barYr + 0.05]], paint, front, 0);
    part(0.11, 0.065, 0.02, lensMat, 0, barYr - 0.07, barZ - 0.196, front);
    for (const sx of [-1, 1]) part(0.05, 0.04, 0.05, amberMat, sx * 0.125, barYr - 0.07, barZ - 0.11, front);
    part(0.12, 0.012, 0.07, dark, 0, barYr + 0.052, barZ - 0.01, front);
  } else {
    const colY = P.shieldTop - P.rF - 0.06;                                                                        // колонка от щитка к рулю
    rod([0, colY, colY * Math.tan(RAKE)], [0, barYr - 0.02, barZ - 0.01], 0.1, 0.1, dark, front);
    part(0.24, 0.085, 0.17, paint, 0, barYr - 0.005, barZ, front);                                                 // накладка руля с приборами
    part(0.14, 0.012, 0.09, dark, 0, barYr + 0.04, barZ + 0.01, front);
  }
  bike.add(pivot);

  const rearWheel = wheelOf(P.rR, P.twR, false);
  rearWheel.position.set(0, P.rR, zr);
  bike.add(rearWheel);

  bike.userData.frontWheels = [pivot];
  bike.userData.spin = [frontWheel, rearWheel];
  bike.userData.body = body;
  return bike;
}
