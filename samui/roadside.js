// Придорожное — то, из чего складывается улица самуйского посёлка (refs/thai_roadside, refs/coconut_plantation):
//   бетонные столбы с пучками чёрных проводов вдоль всех дорог (в посёлках — с фонарями, ночью они горят);
//   в посёлках — ряды лавок вплотную к дороге: под черепицей, сараи под ржавым листом, двухэтажные шопхаусы;
//     вывески, маркизы, стойки с бензином в бутылках, домики духов;
//   синие указатели перед примыканиями; у плантаций — хижина сборщика и вал кокосов.
// Посёлки — точки OSM (ISLAND.places, kind = village), прижатые к ближайшей дороге. Земля в 16 м от оси дороги ровная
// (так строит сборщик острова), поэтому лавки глубиной 6.6 м встают без подсыпки.
// Столбы, указатели и мелочь — разрушаемые; лавки — твёрдые. Всё склеено по участкам дороги: мало отрисовок.
//
// Файл подключается раньше основного скрипта: здесь только объявления; игра зовёт buildRoadside() один раз.

const RS = {
  POLE_STEP: 36, POLE_OFF: 8.9,          // м — шаг столбов и их отступ от оси дороги
  ROW_FRONT: 9.7, ROW_D: 6.6,            // м — фасад лавок от оси дороги и их глубина
  rows: [], poles: 0, signs: 0, camps: 0,
};
const RS_SIGNS = ['MASSAGE', 'MINI MART', 'PHARMACY', 'LAUNDRY', 'BAR', 'COFFEE', 'TAILOR', 'THAI FOOD', 'BIKE RENT', 'TATTOO', 'FRUIT SHAKE', 'TOUR', 'SEAFOOD',
  'EXCHANGE', 'BAKERY', 'MUAY THAI', 'DIVING', 'PAD THAI', 'OPTIC', 'BARBER', 'NOODLES', 'ICE CREAM', 'SPA', 'REGGAE BAR', 'GUESTHOUSE'];

// ---------- сборщик пачки предметов: одна геометрия, у каждого предмета свой кусок вершин ----------
function propBatch() {
  const pos = [], col = [], gpos = [], C = new THREE.Color(), items = [];
  let cur = null;
  const tri = (a, b, c) => { pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); for (let i = 0; i < 3; i++) col.push(C.r, C.g, C.b); };
  const B = {
    begin() { cur = { v0: pos.length / 3, g0: gpos.length / 3, boxes: [], also: [] }; return cur; },
    end(info) { cur.v1 = pos.length / 3; cur.g1 = gpos.length / 3; Object.assign(cur, info); items.push(cur); const it = cur; cur = null; return it; },
    quad(a, b, c, d, color) { C.set(color); tri(a, b, c); tri(a, c, d); },
    // коробка: центр, размеры, поворот вокруг вертикали; piece — давать ли из неё обломки; glow — светящаяся (ночной слой)
    box(cx, cy, cz, sx, sy, sz, yaw, color, piece = true, glow = false) {
      const c = Math.cos(yaw), s = Math.sin(yaw), P = [];
      for (const a of [-1, 1]) for (const b of [-1, 1]) for (const d of [-1, 1]) { const x = a * sx / 2, z = d * sz / 2; P.push([cx + x * c + z * s, cy + b * sy / 2, cz - x * s + z * c]); }
      C.set(color);
      for (const [i, j, k, l] of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) {
        if (glow) for (const q of [i, j, k, i, k, l]) gpos.push(P[q][0], P[q][1], P[q][2]); else { tri(P[i], P[j], P[k]); tri(P[i], P[k], P[l]); }
      }
      if (piece && cur && !glow) cur.boxes.push([cx, cy, cz, sx, sy, sz, yaw, C.getHex()]);
    },
    // готовые меши: дневной и ночной (светящиеся части); предметы становятся разрушаемыми
    finish(centre) {
      if (!pos.length) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const g = new THREE.Group(), mesh = new THREE.Mesh(geo, FENCE_MAT);
      g.add(mesh);
      let glow = null;
      if (gpos.length) {
        const gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
        glow = new THREE.Mesh(gg, RS.glowMat); glow.visible = false; g.add(glow); nightGlow.push(glow);
      }
      g.userData.c = new THREE.Vector3(centre[0], 0, centre[1]);
      scene.add(g); pierGroups.push(g);                               // вдали не рисуется — вместе с пирсами
      const hide = (it) => {
        collapseVerts(geo.attributes.position, it.v0, it.v1, it.x, -200, it.z);
        if (glow && it.g1 > it.g0) collapseVerts(glow.geometry.attributes.position, it.g0, it.g1, it.x, -200, it.z);
      };
      for (const it of items) if (it.kind) addBreakable({ kind: it.kind, mat: it.mat || 'metal', x: it.x, z: it.z, r: it.r, loss: it.loss || 0.05,
        hide() { hide(it); for (const o of it.also) if (!o.gone) { o.gone = true; hide(o); } },
        pieces(out) { const q = new THREE.Quaternion(); for (const [cx, cy, cz, sx, sy, sz, yaw, c] of it.boxes) shatter(out, cx, cy, cz, sx, sy, sz, q.setFromAxisAngle(V3(0, 1, 0), yaw).clone(), c, it.mat || 'metal'); } });
      return g;
    },
  };
  return B;
}

// ---------- столбы и провода вдоль дороги ----------
function roadsidePoles(R, r, zones) {
  const CONC = '#b6ad91', CONC_D = '#8f8873', WIRE = '#191919';
  const inTown = (s) => zones.some(z => z.r === r && s > z.s0 - 20 && s < z.s1 + 20);
  const side = r % 2 ? 1 : -1, step = r ? 42 : RS.POLE_STEP, tall = r ? 8.5 : 10.5;
  let B = propBatch(), prev = null, segStart = 0, cx = 0, cz = 0, n = 0;
  const flush = () => { if (n) B.finish([cx / n, cz / n]); B = propBatch(); prev = null; cx = cz = n = 0; };
  for (let s = 12; s < R.len - 8; s += step) {
    if (s - segStart > 420) { flush(); segStart = s; }                   // пачка — участок дороги до 420 м
    const town = inTown(s), [x, z, tx, tz] = roadPoint(R, s, side * (town ? 7.75 : RS.POLE_OFF)), y = groundY(x, z), yaw = Math.atan2(-tz, tx);   // в посёлке — у самой обочины, перед лавками
    const other = roadAt(x, z, Infinity, r);
    if (y < 0.9 || (other && !other.end && other.d < halfS + 3) || jungleBlocked(x, z, y) || pierYAt(x, z) !== null) { prev = null; continue; }
    const it = B.begin();
    B.box(x, y + tall * 0.3, z, 0.26, tall * 0.6, 0.22, yaw, CONC_D); B.box(x, y + tall * 0.8, z, 0.2, tall * 0.4, 0.17, yaw, CONC);   // столб сужается кверху
    B.box(x, y + tall - 0.5, z, 0.1, 0.1, 1.9, yaw, CONC_D);             // траверса поперёк дороги
    for (const o of [-0.85, 0, 0.85]) B.box(x - Math.sin(yaw) * o, y + tall - 0.36, z - Math.cos(yaw) * o, 0.1, 0.18, 0.1, yaw, '#5a4a3c', false);   // изоляторы
    B.box(x, y + 5.9, z, 0.5, 0.12, 0.12, yaw, CONC_D, false);           // кронштейн пучка
    if ((s / step | 0) % 3 === 0) B.box(x + tx * 0.2, y + 5.2, z + tz * 0.2, 0.12, 0.8, 0.8, yaw, WIRE, false);   // моток запасного кабеля
    let lamp = null;
    if (town) {                                                          // фонарь на столбе: консоль к дороге и плафон
      const ax = -side * -tz, az = -side * tx;                           // к оси дороги
      B.box(x + ax * 1.3, y + 7.6, z + az * 1.3, 0.08, 0.08, 2.6, yaw, '#8a8e94');
      B.box(x + ax * 2.5, y + 7.5, z + az * 2.5, 0.3, 0.14, 0.8, yaw, '#d8dade', false);
      B.box(x + ax * 2.5, y + 7.4, z + az * 2.5, 0.24, 0.06, 0.7, yaw, '#fff2c0', false, true);
      lamp = [x + ax * 2.5, z + az * 2.5];
      RS.pools.push(lamp[0], surfaceY(lamp[0], lamp[1]) + 0.09, lamp[1]);
    }
    const P = B.end({ kind: 'pole', mat: 'stone', x, z, r: 0.16, loss: 0.07, y, yaw });
    RS.poles++; cx += x; cz += z; n++;
    posts.push([x, z]);
    if (prev && Math.hypot(prev.x - x, prev.z - z) < 85) {               // провода до предыдущего столба
      const span = B.begin(), N = 6, sag = 0.9, len = Math.hypot(prev.x - x, prev.z - z), wyaw = Math.atan2(-(z - prev.z), x - prev.x);
      for (let k = 0; k < N; k++) {
        const t0 = k / N, t1 = (k + 1) / N, tm = (t0 + t1) / 2, mx = prev.x + (x - prev.x) * tm, mz = prev.z + (z - prev.z) * tm;
        const yb = prev.y + (y - prev.y) * tm + 5.85 - sag * 4 * tm * (1 - tm);
        B.box(mx, yb, mz, len / N + 0.05, 0.2, 0.12, wyaw, WIRE, false); B.box(mx, yb - 0.3, mz, len / N + 0.05, 0.08, 0.08, wyaw, '#262626', false);   // пучок связи и отвисший кабель
        if (k % 2 === 0) for (const o of [-0.85, 0.85]) {                  // силовые провода наверху
          const t2 = (k + 2) / N, tq = (t0 + t2) / 2, qx = prev.x + (x - prev.x) * tq, qz = prev.z + (z - prev.z) * tq;
          B.box(qx - Math.sin(yaw) * o, prev.y + (y - prev.y) * tq + (r ? 8 : 10) - 0.5 * 4 * tq * (1 - tq), qz - Math.cos(yaw) * o, len * 2 / N + 0.05, 0.07, 0.07, wyaw, WIRE, false);
        }
      }
      const S = B.end({ x: (prev.x + x) / 2, z: (prev.z + z) / 2 });
      prev.also.push(S); P.also.push(S);                                 // упал столб — провода с обеих сторон пропадают
    }
    prev = P;
  }
  flush();
}

// ---------- лавки ----------
// Домик духов: тумба, столб, площадка, храмик под ярусной крышей со шпилем. Ставится в координатах ряда.
function spiritHouse(S, x, z, y0, big) {
  const k = big ? 1.3 : 1, W = '#e9ecec', G = '#d8b24a', R = '#b03a2a';
  S.box(1.1 * k, 0.14, 1.1 * k, x, y0 + 0.07, z, '#b9b4a8'); S.box(0.5 * k, 0.3, 0.5 * k, x, y0 + 0.29, z, W);
  S.tube(x, y0 + 0.44, y0 + 1.35 * k, z, 0.14 * k, 0.1 * k, W, 6); S.box(0.34 * k, 0.12, 0.34 * k, x, y0 + 1.38 * k, z, G);
  S.box(1.0 * k, 0.08, 1.0 * k, x, y0 + 1.48 * k, z, W);
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) S.box(0.05, 0.16, 0.05, x + dx * 0.46 * k, y0 + 1.6 * k, z + dz * 0.46 * k, G);
  const b = y0 + 1.52 * k;
  S.box(0.46 * k, 0.42 * k, 0.46 * k, x, b + 0.21 * k, z, W); S.box(0.2 * k, 0.26 * k, 0.48 * k, x, b + 0.16 * k, z, '#3a2a22'); S.box(0.48 * k, 0.26 * k, 0.2 * k, x, b + 0.16 * k, z, '#3a2a22');
  S.hip(x, z, 0.42 * k, 0.42 * k, b + 0.42 * k, 0.16 * k, 0.16 * k, b + 0.6 * k, R); S.hip(x, z, 0.26 * k, 0.26 * k, b + 0.6 * k, 0.05, 0.05, b + 0.82 * k, G);
  S.tube(x, b + 0.82 * k, b + 1.3 * k, z, 0.04, 0.005, G, 4);
  for (let i = 0; i < 5; i++) S.box(0.07, 0.07, 0.07, x - 0.3 * k + i * 0.15 * k, b - 0.02, z + 0.5 * k, i % 2 ? '#e8b82a' : '#d8792a');   // гирлянда бархатцев
}
// стойка с бензином в бутылках: этажерка под маленькой двускатной крышей, жёлтая табличка
function gasStand(S, x, z, y0) {
  for (const [dx, dz] of [[-0.5, -0.2], [0.5, -0.2], [-0.5, 0.2], [0.5, 0.2]]) S.box(0.05, 2.2, 0.05, x + dx, y0 + 1.1, z + dz, '#7a6248');
  for (let sh = 0; sh < 3; sh++) {
    S.box(1.05, 0.04, 0.42, x, y0 + 0.55 + sh * 0.45, z, '#9a8a6a');
    for (let i = 0; i < 6; i++) S.box(0.09, 0.3, 0.09, x - 0.42 + i * 0.17, y0 + 0.72 + sh * 0.45, z, (i + sh) % 2 ? '#e8c82a' : '#3aa85a');
  }
  S.gable(x, z, 1.9, 0.55, y0 + 2.2, y0 + 2.55, '#9b7659', '#7a5a44', 'x');
  S.box(1.3, 0.5, 0.05, x, y0 + 2.05, z + 0.3, '#f2d21e'); S.text('GASOLINE', x, y0 + 2.2, z + 0.34, 0.035, '#b01c1c', 1);
}
// ряд лавок: L — длина (секции по 4 м), kind: 'tile' — под черепицей, 'tin' — сараи под ржавым листом, 'house' — шопхаусы в два этажа
function shopRow(L, kind, rnd, y0) {
  const S = sculptor(), D = RS.ROW_D, F = D / 2, n = Math.round(L / 4), H = kind === 'house' ? 6.8 : 3.0, P = y0 + 0.42;
  const WALLS = ['#e9e4d6', '#dcd3c0', '#c9d8e0', '#e8d0c0', '#d8e0c0', '#f0e6c8'], pick = (a) => a[(rnd() * a.length) | 0];
  S.box(L + 0.5, 0.42, D + 2.0, 0, y0 + 0.21, 0.75, '#9f9784');                                 // площадка-цоколь с выносом к дороге
  S.box(L - 1, 0.2, 0.5, 0, y0 + 0.1, F + 1.95, '#8f8873');
  if (kind === 'tin') {
    // сарай: столбы, задняя стенка из брезента, односкатная ржавая крыша с выносом
    S.box(L, 2.6, 0.12, 0, P + 1.3, -F + 0.1, '#4f7a5a');
    for (let i = 0; i <= n; i++) { S.box(0.14, 2.9, 0.14, -L / 2 + i * 4, P + 1.45, F - 0.2, '#6a5a48'); S.box(0.14, 3.3, 0.14, -L / 2 + i * 4, P + 1.65, -F + 0.2, '#6a5a48'); }
    for (let i = 0; i < n; i++) {
      const xs = -L / 2 + 2 + i * 4, c = i % 3 === 1 ? '#8a6a52' : '#9b7659';
      S.quad([xs - 2, P + 3.35, -F - 0.2], [xs + 2, P + 3.35, -F - 0.2], [xs + 2, P + 2.6, F + 1.6], [xs - 2, P + 2.6, F + 1.6], c);
      if (rnd() < 0.5) S.box(0.1, 2.2, D - 1, xs + 1.95, P + 1.1, 0, rnd() < 0.5 ? '#3f6a8a' : '#4f7a5a');   // боковая штора из брезента
      // товар: ящики, бочка, верстак
      S.box(1.6, 0.8, 0.9, xs - 0.6, P + 0.4, 0.5 - rnd(), '#8a7250'); S.box(0.7, 0.5, 0.7, xs + 0.9, P + 0.25, 1 - rnd() * 2, pick(['#c8402c', '#2a5a9a', '#e8c82a']));
      if (rnd() < 0.5) S.tube(xs + 1.2, P, P + 0.9, -1.2, 0.3, 0.3, '#2a4a8a', 8);
      if (rnd() < 0.6) { S.box(2.6, 0.5, 0.06, xs, P + 2.35, F + 1.5, pick(['#f2f2ee', '#f2d21e', '#2a5a9a'])); S.text(pick(['REPAIR', 'TYRES', 'FRUITS', 'COCONUT', 'ICE', 'WELDING']), xs, P + 2.5, F + 1.54, 0.06, '#1a1a1a', 1); }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const xs = -L / 2 + 2 + i * 4, wall = pick(WALLS), front = rnd(), sign = pick(RS_SIGNS), sc = pick(['#c8302a', '#1f4fa0', '#2f7a4a', '#f2c81e', '#e8782a', '#7a2a8a', '#f2f2ee']);
      S.box(4, H, D, xs, P + H / 2, 0, wall);
      // первый этаж: открытый проём с товаром, рольставня или витрина
      if (front < 0.45) {
        S.box(3.5, 2.5, 0.1, xs, P + 1.25, F + 0.01, '#2a2622');
        for (let k = 0; k < 5; k++) S.box(0.5 + rnd() * 0.5, 0.4 + rnd() * 0.5, 0.3, xs - 1.4 + k * 0.7, P + 0.3 + rnd() * 1.3, F + 0.12, pick(['#e8c82a', '#d84a3a', '#f2f2ee', '#3a8ad8', '#e88a2a', '#5aa83a']));
      } else if (front < 0.65) {
        for (let k = 0; k < 9; k++) S.box(3.5, 0.26, 0.08, xs, P + 0.14 + k * 0.28, F + 0.02, k % 2 ? '#a9adb2' : '#bfc3c7');
      } else {
        S.box(3.5, 2.5, 0.1, xs, P + 1.25, F + 0.01, '#4a6a78');
        for (const dx of [-1.75, -0.6, 0.6, 1.75]) S.box(0.09, 2.5, 0.12, xs + dx, P + 1.25, F + 0.03, '#d8dade');
        S.box(3.5, 0.1, 0.12, xs, P + 2.1, F + 0.03, '#d8dade');
      }
      // вывеска-фриз и маркиза
      // (у части лавок вывеска по-тайски — выбор по месту, общий счётчик случайностей не трогается)
      const ink = sc === '#f2f2ee' || sc === '#f2c81e' ? '#1a1a1a' : '#f8f4e6', th = thaiOf(sign);
      S.box(3.7, 0.75, 0.12, xs, P + 2.98, F + 0.08, sc);
      if (th && hash2(Math.round(xs * 10) + 11, Math.round(F * 10) + i * 7) < 0.4) thaiText(S, th, xs, P + 2.98, F + 0.16, Math.min(0.045, 3.2 / hudWidth(hudText(th))), ink);
      else { const px = Math.min(0.1, 3.2 / hudWidth(hudText(sign))); S.text(sign, xs, P + 2.98 + px * 2.5, F + 0.16, px, ink, 1); }
      if (rnd() < 0.7) {
        const ac = pick(['#a4cadf', '#c8402c', '#2f7a4a', '#e8d8b0', '#1f4fa0']);
        for (let k = 0; k < 6; k++) S.quad([xs - 1.9 + k * 0.633, P + 2.6, F + 0.1], [xs - 1.9 + (k + 1) * 0.633, P + 2.6, F + 0.1], [xs - 1.9 + (k + 1) * 0.633, P + 2.15, F + 1.9], [xs - 1.9 + k * 0.633, P + 2.15, F + 1.9], k % 2 ? ac : '#f2f2ee');
        for (const dx of [-1.85, 1.85]) S.box(0.05, 2.15, 0.05, xs + dx, P + 1.08, F + 1.85, '#8a8e94');
      }
      if (kind === 'house') {                                                                  // второй этаж: балкон, окна, кондиционер, вывеска поперёк улицы
        S.box(4, 0.12, 1.1, xs, P + 3.5, F + 0.5, '#c9c5bb'); S.box(3.9, 0.06, 0.06, xs, P + 4.45, F + 1.0, '#8a8e94');
        for (let k = 0; k <= 6; k++) S.box(0.05, 0.9, 0.05, xs - 1.9 + k * 0.633, P + 4.0, F + 1.0, '#8a8e94');
        for (const dx of [-1, 1]) { S.box(1.2, 1.6, 0.08, xs + dx, P + 4.7, F + 0.02, '#3e4858'); S.box(1.3, 0.08, 0.1, xs + dx, P + 5.52, F + 0.03, '#d8dade'); }
        if (rnd() < 0.6) S.box(0.8, 0.55, 0.3, xs + 1.4, P + 6.0, F + 0.16, '#d8dade');
        if (rnd() < 0.55) { const bc = pick(['#c8302a', '#f2c81e', '#1f4fa0', '#2f7a4a']); S.box(0.16, 1.5, 0.95, xs - 1.9, P + 5.0, F + 1.7, bc); S.box(0.18, 0.4, 0.97, xs - 1.9, P + 5.3, F + 1.7, '#f2f2ee'); }
      }
    }
    if (kind === 'house') { S.box(L + 0.3, 0.5, D + 0.3, 0, P + H + 0.25, 0, '#c9c5bb'); for (let i = 0; i < n; i += 2) S.tube(-L / 2 + 2 + i * 4, P + H + 0.5, P + H + 1.7, -1, 0.5, 0.5, '#2f5f9a', 8); }   // парапет, баки с водой
    else S.gable(0, 0, L + 0.9, F + 0.8, P + H, P + H + 1.5, '#c2806d', '#b06a58', 'x');
    if (kind === 'tile') for (let x = -L / 2 + 2; x < L / 2; x += 4) S.box(0.06, 0.02, D + 1.6, x, P + H + 0.76, 0, '#a86a58');
  }
  return S;
}
// поставить ряд: R — дорога, s — начало по пути, len — длина, side — сторона. Возвращает true, если место подошло
function placeRow(R, r, s, len, side, kind, rnd) {
  if (townClaimed(r, s, s + len)) return false;                            // тут посёлок со своими домами (towns.js)
  const o = side * RS.ROW_FRONT, A = roadPoint(R, s, o), Bp = roadPoint(R, s + len, o), M = roadPoint(R, s + len / 2, o);
  const ux = (Bp[0] - A[0]) / len, uz = (Bp[1] - A[1]) / len, mx = (A[0] + Bp[0]) / 2, mz = (A[1] + Bp[1]) / 2;
  if (Math.abs(Math.hypot(Bp[0] - A[0], Bp[1] - A[1]) - len) > 0.6 || Math.hypot(M[0] - mx, M[1] - mz) > 0.7) return false;   // дорога тут гнётся — ряд не встанет ровно
  let fx = -M[3] * -side, fz = M[2] * -side;                               // к оси дороги (вправо от хода — (−tz, tx))
  const D = RS.ROW_D, cx = mx - fx * D / 2, cz = mz - fz * D / 2, y0 = R.fr[Math.max(0, Math.min(R.fr.length - 1, Math.round((s + len / 2) / R.len * (R.fr.length - 1))))].p.y - 0.12;
  for (const [a, b] of [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, 0.5]]) {
    const x = mx + ux * a * len / 2 - fx * D * b * 1.12, z = mz + uz * a * len / 2 - fz * D * b * 1.12, h = groundY(x, z);
    if (h < 1.0 || Math.abs(h - y0) > 0.55 || jungleBlocked(x, z, h) || pierYAt(x, z) !== null) return false;
    const other = roadAt(x, z, Infinity, r);
    if (other && !other.end && other.d < halfS + 2.5) return false;
    if (roadDist(x, z) < halfS + 0.6 && b > 0) return false;
  }
  if (RS.rows.some(q => Math.hypot(q[0] - cx, q[1] - cz) < q[2] + len / 2 + 2)) return false;
  // сами лавки: у дальних рядов строятся уже после старта. Сейчас — «сухой» прогон: случайные числа тянутся ровно как при
  // настоящей постройке (иначе сдвинулись бы все следующие ряды), а потом ряд строится с того же места ряда чисел
  const g = new THREE.Group(), st = rnd.state(), build = (r) => {
    const S = shopRow(len, kind, r, 0);
    if (r() < 0.3) gasStand(S, len / 2 - 1.2, D / 2 + 1.2, 0.42);
    if (r() < 0.3) spiritHouse(S, -len / 2 + 0.9, D / 2 + 1.35, 0.42, r() < 0.4);
    return S;
  };
  if (laterNear(cx, cz)) g.add(build(rnd).mesh());
  else { shipyard.dry = true; try { build(rnd); } finally { shipyard.dry = false; } later(cx, cz, g, () => g.add(build(seededRandom(st)).mesh())); }
  g.position.set(cx, y0, cz); g.rotation.y = Math.atan2(fx, fz);           // фасад (+Z) — к дороге
  scene.add(g); g.updateMatrixWorld(true);
  { const P = [], n = Math.max(1, Math.round(len / 2.5));               // от ступени лавок до асфальта — бетон вместо красной обочины
    for (let i = 0; i <= n; i++) { const w = g.localToWorld(new THREE.Vector3(-len / 2 + len * i / n, 0, D / 2 + 2.15)); P.push([w.x, w.z]); }
    roadApron(g, P, [fx, fz], y0 + 0.17, '#8f8873'); }
  wallBox(g, 0, 0, len, D);
  g.userData.c = new THREE.Vector3(cx, 0, cz); pierGroups.push(g);
  RS.rows.push([cx, cz, len / 2, kind]);
  const rad = len / 2 + 6;
  vegKeepOut.push(Object.assign((x, z) => (x - cx) ** 2 + (z - cz) ** 2 < rad * rad, { c: [cx, cz, rad] }));
  return g;
}

// ---------- синий указатель перед примыканием ----------
// Как на настоящих указателях Таиланда: над английским названием — тайское (если оно есть в thai_text.js), тогда
// табличка выше.
function roadSign(x, z, yaw, lines) {
  const S = sculptor(), BLUE = '#0a6fce', W = 3.0; (RS.signAt || (RS.signAt = [])).push([x, z, yaw, lines.join(' / ')]);   // (где стоят — для снимков)
  const rows = lines.map((txt) => ({ txt, th: thaiOf(txt.replace(/^[<|] | >$/g, '')) })), hs = rows.map((r) => r.th ? 1.4 : 0.8), H = hs.reduce((a, b) => a + b, 0) + 0.15;
  for (const dx of [-1.1, 1.1]) S.box(0.09, H + 2.3, 0.09, dx, (H + 2.3) / 2, -0.06, '#9aa0a6');
  let top = 2.3 + H - 0.05;
  rows.forEach(({ txt, th }, i) => {
    const h = hs[i], y = top - h / 2, px = Math.min(0.085, (W - 0.4) / hudWidth(hudText(txt))); top -= h;
    S.box(W, h - 0.08, 0.06, 0, y, 0, BLUE); S.box(W + 0.08, h - 0.04, 0.03, 0, y, -0.03, '#f2f2ee');
    if (!th) { S.text(txt, 0, y + px * 2.5, 0.04, px, '#f8f8f4', 1); return; }
    thaiText(S, th, 0, y + 0.3, 0.04, Math.min(0.042, (W - 0.4) / hudWidth(hudText(th))), '#f8f8f4');
    S.text(txt, 0, y - 0.33 + px * 2.5, 0.04, px, '#f8f8f4', 1);
  });
  const m = S.mesh();
  m.position.set(x, groundY(x, z), z); m.rotation.y = yaw;
  scene.add(m);
  breakableObjects([m], x, z, 0.5, 'small', 0.04, 'metal');
  posts.push([x, z]);
  RS.signs++;
}

// ---------- стоянка сборщиков у плантации: хижина, вал кокосов, зонт ----------
function plantationCamp(R, r, s, side) {
  const [x, z, tx, tz] = roadPoint(R, s, side * 12.6), y0 = groundY(x, z);
  for (const d of [-8, 0, 8]) { const p = roadPoint(R, s + d, side * 15), h = groundY(p[0], p[1]); if (h < 1.2 || Math.abs(h - y0) > 0.5 || jungleBlocked(p[0], p[1], h)) return false; }
  if (RS.rows.some(q => Math.hypot(q[0] - x, q[1] - z) < q[2] + 14)) return false;
  const g = new THREE.Group();
  later(x, z, g, () => {                                                     // хижина и вал орехов дальних стоянок строятся уже после старта
  const S = sculptor(), rnd = seededRandom(Math.round(x * 7 + z));
  // вал орехов: длинная округлая насыпь (не плита), вся в орехах — бурых в кожуре, зелёных свежих и светлых очищенных
  const MX = -2.8, ML = 4.4, MH = 1.25, MW = 1.7;                                                // середина, полудлина, высота, полуширина
  const heap = (u, ph, k = 1) => { const r = Math.sqrt(Math.max(0, 1 - u * u)); return [MX + ML * u, MH * r * Math.sin(ph) * k, MW * r * Math.cos(ph) * k]; };   // точка на насыпи
  for (let i = 0; i < 9; i++) for (let j = 0; j < 6; j++) {                                      // сама насыпь — тёмная, орехи лежат поверх
    const u0 = -1 + i * 2 / 9, u1 = u0 + 2 / 9, p0 = j * Math.PI / 6, p1 = p0 + Math.PI / 6;
    S.quad(heap(u0, p0, 0.9), heap(u1, p0, 0.9), heap(u1, p1, 0.9), heap(u0, p1, 0.9), (i + j) % 2 ? '#5e5046' : '#6a5a4e');
  }
  for (let i = 0; i < 190; i++) {
    const u = -0.97 + rnd() * 1.94, ph = 0.06 + rnd() * (Math.PI - 0.12), p = heap(u, ph), c = rnd();
    S.blob(p[0], Math.max(0.13, p[1]), p[2], 0.2, 0.17, 0.18, c < 0.42 ? '#8b786c' : c < 0.66 ? '#7a6a5a' : c < 0.8 ? '#9aa86a' : c < 0.9 ? '#6f7f46' : '#c2b4a6', 5, 3);
  }
  for (let i = 0; i < 14; i++) S.blob(MX + (rnd() - 0.5) * 10.5, 0.13, (rnd() < 0.5 ? -1 : 1) * (MW + 0.2 + rnd() * 0.9), 0.2, 0.17, 0.18, rnd() < 0.5 ? '#8b786c' : '#9aa86a', 5, 3);   // раскатившиеся
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {                                      // синий брезент наброшен на часть вала с одной стороны и свисает до земли
    const u0 = -0.62 + i * 0.15, u1 = u0 + 0.15, p0 = 0.02 + j * 0.2, p1 = p0 + 0.2, lift = (u, ph) => { const q = heap(u, ph, 1.14); return [q[0], q[1] + 0.06, q[2]]; };
    S.quad(lift(u0, p0 * Math.PI), lift(u1, p0 * Math.PI), lift(u1, p1 * Math.PI), lift(u0, p1 * Math.PI), (i + j) % 2 ? '#2f5f9a' : '#3a6cab');
  }
  S.tube(3.6, 0, 2.1, -1.2, 0.03, 0.03, '#d8d8d4', 5); S.tube(3.6, 1.9, 2.3, -1.2, 1.25, 0.05, '#c8402c', 8);   // пляжный зонт
  // хижина сборщика: помост на сваях, стены из плетёного бамбука, крыша — пальмовый лист и лист профнастила
  const hx = 6.6, hz = 0.6;
  for (const [dx, dz] of [[-1.4, -1.1], [1.4, -1.1], [-1.4, 1.1], [1.4, 1.1]]) S.box(0.12, 2.5, 0.12, hx + dx, 1.25, hz + dz, '#7a6248');
  S.box(3.1, 0.1, 2.5, hx, 0.5, hz, '#96816c');
  S.box(3.0, 1.5, 0.06, hx, 1.3, hz - 1.15, '#b89a62'); S.box(0.06, 1.5, 2.3, hx + 1.45, 1.3, hz, '#a88a56');
  S.gable(hx, hz, 3.9, 1.7, 2.45, 3.25, '#8a7d5a', '#a88a56', 'x'); S.quad([hx - 1.9, 2.5, hz + 1.72], [hx + 0.2, 2.5, hz + 1.72], [hx + 0.2, 3.0, hz + 0.6], [hx - 1.9, 3.0, hz + 0.6], '#7c868d');
  S.rod([hx - 2.6, 1.5, hz + 1.8], [hx - 0.8, 1.5, hz + 1.8], 0.06, '#7a6248');                   // жердь с подвешенными орехами
  for (let i = 0; i < 4; i++) S.blob(hx - 2.4 + i * 0.5, 1.25, hz + 1.8, 0.13, 0.15, 0.13, '#95b084', 5, 3);
  g.add(S.mesh());
  });
  g.position.set(x, y0, z); g.rotation.y = Math.atan2(-tz, tx);            // вал — вдоль дороги
  scene.add(g); g.updateMatrixWorld(true);
  wallBox(g, 6.6, -0.6, 3.1, 2.5); wallBox(g, -2.8, 0, 7.6, 2.4);
  g.userData.c = new THREE.Vector3(x, 0, z); pierGroups.push(g);
  RS.rows.push([x, z, 9, 'camp']);
  vegKeepOut.push(Object.assign((px, pz) => (px - x) ** 2 + (pz - z) ** 2 < 144, { c: [x, z, 12] }));
  if (!RS.camps++) { const p = roadPoint(R, s - 16, LANE_SIDE * 2.5); LANDMARKS.push({ name: 'ПЛАНТАЦИЯ', x: p[0], z: p[1], heading: Math.atan2(-p[2], -p[3]) }); }
  return true;
}
const LANE_SIDE = 1;

function buildRoadside() {
  RS.glowMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false });
  RS.pools = [];
  const main = roads.map((R, r) => [R, r]).filter(([R]) => R.half === halfS && !/^(pier|spot) /.test(R.name) && R.name !== 'airport');
  // --- посёлки: точка OSM -> участок ближайшей дороги ---
  const zones = [], TOWNS = /Nathon|Chaweng$|Lamai|Bo Phut|Mae Nam|Hua Thanon/;
  for (const p of IS.places) {
    if (p.kind !== 'village') continue;
    let best = null;
    for (const [R, r] of main) R.fr.forEach((f, i) => { const d = (f.p.x - p.x) ** 2 + (f.p.z - p.z) ** 2; if (!best || d < best[0]) best = [d, r, i]; });
    if (!best || best[0] > 350 * 350) continue;
    const R = roads[best[1]], s = best[2] * R.len / (R.fr.length - 1), town = TOWNS.test(p.name), half = town ? 190 : 120;
    zones.push({ r: best[1], s0: s - half, s1: s + half, town, name: p.name });
  }
  RS.zones = zones;
  // --- столбы и провода ---
  for (const [R, r] of main) roadsidePoles(R, r, zones);
  // --- лавки ---
  const rnd = seededRandom(4169);
  for (const Z of zones) {
    const R = roads[Z.r];
    for (const side of [-1, 1]) for (let s = Math.max(14, Z.s0); s < Math.min(R.len - 14, Z.s1);) {
      const len = 4 * (3 + ((rnd() * 7) | 0)), roll = rnd();
      const kind = Z.town ? (roll < 0.55 ? 'house' : roll < 0.9 ? 'tile' : 'tin') : (roll < 0.55 ? 'tile' : roll < 0.9 ? 'tin' : 'house');
      const ss = R.ring ? ((s % R.len) + R.len) % R.len : s;
      if (ss + len < R.len - 6 && placeRow(R, Z.r, ss, len, side, kind, rnd)) { if (!Z.done) { Z.done = true; const p = roadPoint(R, Math.max(4, ss - 18), 2.5); Z.at = { x: p[0], z: p[1], heading: Math.atan2(-p[2], -p[3]) }; } s += len + 5 + rnd() * 14; }
      else s += 7;
    }
  }
  // --- скутеры у обочин: изредка, только в посёлках; стоят на краю обочины вдоль дороги ---
  RS.scooters = 0;
  zones.forEach((Z, zi) => {
    const R = roads[Z.r], g = new THREE.Group(), mid = roadPoint(R, R.ring ? (((Z.s0 + Z.s1) / 2 % R.len) + R.len) % R.len : Math.max(0, Math.min(R.len, (Z.s0 + Z.s1) / 2)));
    scene.add(g);
    for (let s = Math.max(12, Z.s0); s < Math.min(R.len - 12, Z.s1); s += 26) for (const side of [-1, 1]) {
      if (rnd() > (Z.town ? 0.15 : 0.08)) continue;                                              // изредка
      const ss = R.ring ? ((s % R.len) + R.len) % R.len : s, n = 1 + ((rnd() * 2.4) | 0);
      for (let i = 0; i < n; i++) {
        const p = roadPoint(R, ss + i * 0.9, side * (halfS - 0.45 + rnd() * 0.5)), other = roadAt(p[0], p[1], Infinity, Z.r);
        if (groundY(p[0], p[1]) < 1.1 || pierYAt(p[0], p[1]) !== null || (other && other.d < halfS + 4) || beachSand.full(p[0], p[1])) break;
        parkScooter(g, zi * 13 + ((s / 26) | 0) * 3 + i, p[0], -p[1], Math.atan2(-p[3], p[2]) + (side > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 0.5, surfaceY(p[0], p[1]) + 0.03);
        RS.scooters++;
      }
    }
    g.userData.c = new THREE.Vector3(mid[0], 0, mid[1]); g.userData.far = 420; pierGroups.push(g);
  });
  const first = zones.find(z => z.town && z.at) || zones.find(z => z.at);
  if (first) LANDMARKS.push({ name: 'ЛАВКИ ' + first.name.replace(/^Baan /, '').toUpperCase(), ...first.at });
  // --- домики духов на крутых поворотах кольцевой ---
  {
    const R = roads[0], B = sculptor(), spots = [];
    for (let s = 60; s < R.len - 60 && spots.length < 14; s += 30) {
      const a = roadPoint(R, s - 25), b = roadPoint(R, s + 25);
      let d = Math.atan2(b[3], b[2]) - Math.atan2(a[3], a[2]); d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.42) continue;
      const side = d > 0 ? -1 : 1, p = roadPoint(R, s, side * 10.2), h = groundY(p[0], p[1]);      // с внешней стороны поворота
      if (h < 1.2 || jungleBlocked(p[0], p[1], h) || spots.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 500) || RS.rows.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < q[2] + 6)) continue;
      spots.push(p); spiritHouse(B, p[0], p[1], h, true);
      const w = [p[0], p[1]]; walls.push([w[0] - 0.5, w[1], w[0] + 0.5, w[1]], [w[0], w[1] - 0.5, w[0], w[1] + 0.5]);
      s += 200;
    }
    if (spots.length) scene.add(B.mesh());
    RS.spirits = spots.length;
  }
  // свет фонарей на земле: одно пятно под каждым, видно только ночью
  if (RS.pools.length) {
    const pos = [], uv = [], idx = [], P = RS.pools, rr = 7;
    for (let i = 0; i < P.length; i += 3) { const b = pos.length / 3; pos.push(P[i] - rr, P[i + 1], P[i + 2] - rr, P[i] + rr, P[i + 1], P[i + 2] - rr, P[i] - rr, P[i + 1], P[i + 2] + rr, P[i] + rr, P[i + 1], P[i + 2] + rr); uv.push(0, 0, 1, 0, 0, 1, 1, 1); idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    const tex = pixelTexture(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,226,150,0.5)'); gr.addColorStop(0.5, 'rgba(255,206,120,0.2)'); gr.addColorStop(1, 'rgba(255,190,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
    const m = meshFrom(pos, uv, idx, new THREE.MeshBasicMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    m.visible = false; m.frustumCulled = false; scene.add(m); nightGlow.push(m);
  }
  // --- синие указатели перед примыканиями ---
  const named = IS.places.filter(p => (p.kind === 'village' || p.kind === 'beach') && /^[\x20-\x7e]+$/.test(p.name));
  const nearName = (x, z, not) => { let b = null; for (const p of named) { const d = Math.hypot(p.x - x, p.z - z); if (p.name !== not && (!b || d < b[0])) b = [d, p.name]; } return b ? b[1].replace(/^Baan /, '').replace(/ Beach$/, '').toUpperCase().slice(0, 14) : ''; };
  for (const J of JUNCTIONS) {
    if (!J.info || !J.info.length || /^(pier|spot) /.test(roads[J.minor].name)) continue;
    const a = J.info[0], M = roads[a.q], m = roads[J.minor], far = roadPoint(m, J.e ? Math.max(0, m.len - 420) : Math.min(m.len, 420)), sideName = nearName(far[0], far[1], '');
    for (const dir of [-1, 1]) {                                           // с обеих сторон главной дороги
      const s = dir < 0 ? a.sa - 46 : a.sb + 46;
      if (!M.ring && (s < 20 || s > M.len - 20)) continue;
      const p = roadPoint(M, s, dir < 0 ? -9.4 : 9.4), h = groundY(p[0], p[1]);                  // слева по ходу — как при левостороннем движении
      if (h < 1.1 || jungleBlocked(p[0], p[1], h) || RS.rows.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < q[2] + 3)) continue;
      const ahead = roadPoint(M, s + dir * -700), aheadName = nearName(ahead[0], ahead[1], sideName), turnRight = (a.side === 1) === (dir < 0);
      roadSign(p[0], p[1], Math.atan2(p[2] * dir, p[3] * dir), [turnRight ? sideName + ' >' : '< ' + sideName, '| ' + aheadName]);
    }
  }
  // --- стоянки сборщиков у плантаций ---
  for (const [R, r] of main) for (let s = 80; s < R.len - 80; s += 55) {
    const side = (s / 55 | 0) % 2 ? 1 : -1, q = roadPoint(R, s, side * 45), h = groundY(q[0], q[1]);
    if (h < 3.2 || h > 9 || jungleZone(q[0], q[1], h, 0.99) !== 1 || zones.some(z => z.r === r && s > z.s0 - 60 && s < z.s1 + 60)) continue;
    if (RS.rows.some(c => c[3] === 'camp' && Math.hypot(c[0] - q[0], c[1] - q[1]) < 900)) continue;
    plantationCamp(R, r, s, side);
  }
  airportAnim.push(() => { const on = skyNow.night > 0.3; for (const m of nightGlow) if (m.visible !== on) m.visible = on; });
}

// ---------- мелочь у баров: мусорка и столик с табуретами (разрушаемые; B — propBatch, координаты мировые) ----------
// Мусорка — зелёный или синий пластиковый бак на колёсиках с крышкой; столик — пластиковый, круглый, два табурета.
function propBin(B, x, y, z, yaw, rnd) {
  const col = ['#2a7a3a', '#2a5a9a', '#2a7a3a', '#6a6e72'][(rnd() * 4) | 0];
  B.begin();
  B.box(x, y + 0.48, z, 0.55, 0.9, 0.6, yaw, col); B.box(x, y + 0.96, z, 0.6, 0.07, 0.66, yaw, col);
  B.box(x - Math.cos(yaw) * 0.22, y + 0.08, z + Math.sin(yaw) * 0.22, 0.12, 0.16, 0.62, yaw, '#1c1c1e', false);   // колёсики
  B.end({ kind: 'small', mat: 'metal', x, z, r: 0.35, loss: 0.01 });
}
function propTableSet(B, x, y, z, yaw, rnd) {
  const col = ['#d83a2a', '#2a5ad8', '#f2f2ee', '#e8c82a'][(rnd() * 4) | 0], c = Math.cos(yaw), s = Math.sin(yaw);
  B.begin();
  B.box(x, y + 0.72, z, 0.7, 0.04, 0.7, yaw, col); B.box(x, y + 0.36, z, 0.07, 0.7, 0.07, yaw, '#8e9296');
  for (const sg of [-1, 1]) { const sx = x + c * 0.65 * sg, sz = z - s * 0.65 * sg; B.box(sx, y + 0.44, sz, 0.36, 0.05, 0.36, yaw, col); B.box(sx, y + 0.21, sz, 0.3, 0.42, 0.3, yaw, col, false); }
  B.end({ kind: 'small', mat: 'metal', x, z, r: 0.95, loss: 0.02 });
}
