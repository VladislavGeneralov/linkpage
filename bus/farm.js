// ---------- Каннабис-ферма (из tropicalgame, landmarks.js) ----------
// Участок в глубине острова (точка IS.spots.cannabis_farm), огороженный старым покосившимся частоколом из жердей;
// въезд — проём с распахнутыми внутрь створками. За проёмом — дорожка, по обе стороны кусты сативы 1–2 м плотной
// посадкой, кое-где бамбуковые колышки. В глубине слева — домик на сваях под волнистым листом, по оси — сушильный
// навес с пучками, бочки и бак с водой, уголок отдыха (столик с бонгом и бамбуковое кресло).
// Отличия от tropicalgame: ни пальм, ни бананов, ни кустов вокруг; всё собрано из простых мешей (без «скульптора»);
// кусты не колышутся; частокол не ломается. В режиме Y кусты — белые силуэты (своя текстура), прочее — как всё реальное.
// Оси участка: u — локальный +X (к воротам и дороге), v = −Z. Файл только объявляет buildCannabisFarm(spot).
function buildCannabisFarm(sp) {
  const g = new THREE.Group();
  g.position.set(sp.x, sp.y, sp.z);
  g.rotation.y = -sp.az;                 // локальный +X -> азимут az
  const U0 = -26, U1 = 22, HV = 19, GATE = 2.4;                 // участок 48 × 38 м; ворота — на стороне u = U1, проём 4.8 м
  const PATH = '#8f7354', PLANK = '#96816c', PLANK_D = '#6f5d4e', TIN = ['#7c868d', '#727c83', '#86909a'], RUST = '#6a4a3c';
  const rnd = seededRandom(1420);
  const mats = {}, mat = (c) => mats[c] || (mats[c] = lambert({ color: c, side: THREE.DoubleSide }));
  const add = (m) => { g.add(m); return m; };
  // коробка w × h × d с серединой в (u, y, v); tilt — наклон вбок, рад
  const box = (w, h, d, u, y, v, c, tilt = 0) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c))); m.position.set(u, y, -v); m.rotation.z = tilt; return m; };
  // цилиндр от y0 до y1 (радиусы снизу и сверху)
  const tube = (u, y0, y1, v, r0, r1, c, seg = 8) => { const m = add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), mat(c))); m.position.set(u, (y0 + y1) / 2, -v); return m; };
  // брусок между двумя точками [u, y, v]
  const rod = (a, b, t, c) => { const A = new THREE.Vector3(a[0], a[1], -a[2]), B = new THREE.Vector3(b[0], b[1], -b[2]), dir = B.clone().sub(A);
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(t, dir.length(), t), mat(c))); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); return m; };
  // четырёхугольник по четырём точкам [u, y, v] — скаты крыш
  const quad = (p, c) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap(([u, y, v]) => [u, y, -v]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals(); return add(new THREE.Mesh(geo, mat(c))); };
  const tri = (p, c) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap(([u, y, v]) => [u, y, -v]), 3));
    geo.setIndex([0, 1, 2]); geo.computeVertexNormals(); return add(new THREE.Mesh(geo, mat(c))); };
  // плоская полоса на земле
  const flat = (u0, u1, v0, v1, c, y = 0.03) => quad([[u0, y, v0], [u1, y, v0], [u1, y, v1], [u0, y, v1]], c);

  // ---------- земля: подъезд от конца дороги к воротам, дорожка по оси ----------
  { const tex = gravelTex.clone(); tex.needsUpdate = true; tex.repeat.set((sp.road.u + 1 - U1 + 1) / 4, 1.5);
    const m = add(new THREE.Mesh(new THREE.PlaneGeometry(sp.road.u + 2 - U1, 5.5), lambert({ map: tex })));
    m.rotation.x = -Math.PI / 2; m.position.set((U1 - 1 + sp.road.u + 1) / 2, 0.035, 0); tagFill(m, XR_BLUE.shoulder); }
  tagFill(flat(U0 + 5, U1 - 1, -1.6, 1.6, PATH), XR_BLUE.shoulder);

  // ---------- кусты: ряды через 1.9 м, кусты через метр, со сбоем и пропусками — грядки не читаются ----------
  const plants = { pos: [], uv: [], col: [], idx: [] };
  const rows = [];                                              // [v, u от, u до]
  for (let v = 3.7; v < HV - 1.5; v += 1.9) { rows.push([-v, U0 + 2.5, U1 - 2.5]); rows.push([v, -11, U1 - 2.5]); }   // слева в глубине место занято домиком
  for (const [v, u0, u1] of rows) for (let u = u0 + rnd() * 0.6; u < u1; u += 0.85 + rnd() * 0.3) {
    if (rnd() < 0.05) continue;
    const pu = u + (rnd() - 0.5) * 0.3, pv = v + (rnd() - 0.5) * 0.7;
    cannabisPlant(plants, rnd, pu, -pv);
    if (rnd() < 0.3) box(0.045, 0.75 + rnd() * 0.3, 0.045, pu + 0.12, 0.42, pv - 0.1, '#edbf9a', (rnd() - 0.5) * 0.12);   // бамбуковый колышек
  }
  { const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(plants.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(plants.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(plants.col, 3));
    geo.setIndex(plants.idx); geo.computeVertexNormals();
    const T = cannabisTextures();
    const m = add(new THREE.Mesh(geo, lambert({ map: T.tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide })));
    m.userData.xr = new THREE.MeshBasicMaterial({ map: T.white, alphaTest: 0.5, transparent: true, opacity: XR_OPACITY, side: THREE.DoubleSide, depthWrite: false });   // Y: белый силуэт
  }
  // бочки и бак с водой у навеса
  for (const [u, v, c] of [[U0 + 6.2, -3.4, '#2a5a9a'], [U0 + 7.1, -3.9, '#2a5a9a'], [U0 + 6.4, 3.3, '#3a3a3c']]) tube(u, 0, 0.9, v, 0.3, 0.3, c);
  box(1.1, 1.1, 1.0, U0 + 4.6, 0.75, -3.6, '#e8e8e2'); box(1.2, 0.2, 1.1, U0 + 4.6, 0.1, -3.6, PLANK_D);

  // ---------- сушильный навес: четыре столба, односкатная крыша, пучки на жерди ----------
  const su = U0 + 4.2, sw = 2.4, sd = 1.9;
  for (const du of [-sd, sd]) for (const dv of [-sw, sw]) box(0.14, du < 0 ? 2.1 : 2.7, 0.14, su + du, du < 0 ? 1.05 : 1.35, dv, '#838681');
  for (let i = 0; i < 6; i++) {                                 // волнистый лист полосами
    const v0 = -sw - 0.5 + i * (2 * sw + 1) / 6, v1 = v0 + (2 * sw + 1) / 6;
    quad([[su - sd - 0.5, 2.05, v0], [su + sd + 0.5, 2.85, v0], [su + sd + 0.5, 2.85, v1], [su - sd - 0.5, 2.05, v1]], i === 4 ? RUST : TIN[i % 3]);
  }
  box(0.07, 0.07, 2 * sw, su, 2.0, 0, PLANK_D);
  for (let i = 0; i < 9; i++) tube(su + (rnd() - 0.5) * 0.1, 1.25, 1.98, -sw + 0.35 + i * (2 * sw - 0.7) / 8, 0.17, 0.04, rnd() < 0.5 ? '#647148' : '#57683e', 6);   // сохнущие пучки

  // ---------- домик на сваях ----------
  const hu = U0 + 7.5, hv = 12, L = 5.2, D = 4.0, F = 0.8, WH = 2.2;      // пол на высоте 0.8 м
  for (const du of [-L / 2 + 0.2, 0, L / 2 - 0.2, L / 2 + 1.3]) for (const dv of [-D / 2 + 0.2, D / 2 - 0.2]) box(0.18, 0.8, 0.18, hu + du, 0.4, hv + dv, '#5b4a40');
  box(L + 1.7, 0.12, D + 0.2, hu + 0.85, F - 0.06, hv, PLANK_D);                                // пол с верандой
  box(0.08, WH, D, hu - L / 2, F + WH / 2, hv, PLANK); box(L, WH, 0.08, hu, F + WH / 2, hv - D / 2, PLANK); box(L, WH, 0.08, hu, F + WH / 2, hv + D / 2, PLANK);
  for (const dv of [-1.3, 1.3]) box(0.08, WH, 1.4, hu + L / 2, F + WH / 2, hv + dv, PLANK);    // передняя стена с дверным проёмом
  box(0.08, 0.4, 1.2, hu + L / 2, F + WH - 0.2, hv, PLANK); box(0.06, 1.75, 1.15, hu + L / 2 - 0.05, F + 0.9, hv, '#2a2420');
  for (let i = 1; i < 7; i++) box(L + 0.02, 0.03, 0.1, hu, F + i * 0.31, hv - D / 2 - 0.01, PLANK_D);   // швы досок на стене к грядкам
  box(1.0, 0.75, 0.1, hu - 0.6, F + 1.35, hv - D / 2 - 0.02, '#2a2420');                                   // окно
  for (const dv of [-D / 2 + 0.1, D / 2 - 0.1]) box(0.1, WH, 0.1, hu + L / 2 + 1.5, F + WH / 2, hv + dv, '#5b4a40');   // столбики веранды
  for (let i = 0; i < 3; i++) box(0.3, 0.06, 1.0, hu + L / 2 + 1.75 + i * 0.27, F - 0.2 - i * 0.24, hv, PLANK_D);       // ступени
  // крыша: два ската разной длины из волнистого листа, конёк вдоль u
  const RU0 = hu - L / 2 - 0.5, RU1 = hu + L / 2 + 2.0, EY = F + WH, RY = EY + 1.25, rz = hv + 0.6;
  for (let i = 0; i < 8; i++) {
    const a = RU0 + (RU1 - RU0) * i / 8, b = RU0 + (RU1 - RU0) * (i + 1) / 8;
    quad([[a, RY, rz], [b, RY, rz], [b, EY - 0.25, hv - D / 2 - 0.9], [a, EY - 0.25, hv - D / 2 - 0.9]], i === 2 || i === 6 ? RUST : TIN[i % 3]);   // длинный скат — к грядкам
    quad([[a, RY, rz], [b, RY, rz], [b, EY + 0.1, hv + D / 2 + 0.5], [a, EY + 0.1, hv + D / 2 + 0.5]], TIN[(i + 1) % 3]);
  }
  for (const u of [hu - L / 2, hu + L / 2]) tri([[u, EY, hv - D / 2], [u, EY, hv + D / 2], [u, RY - 0.05, rz]], PLANK);   // фронтоны

  // ---------- уголок отдыха: столик с бонгом и бамбуковое кресло — между домиком и дорожкой ----------
  { const tu = U0 + 11.2, tv = 5.6, BAM = '#d8b26a', BAM_D = '#a8823f', GLASS = '#6ec0b0', GLASS_L = '#c2ece2';
    tube(tu, 0.56, 0.62, tv, 0.42, 0.42, BAM, 10); tube(tu, 0.5, 0.56, tv, 0.44, 0.44, BAM_D, 10);   // столешница из плашек
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.4; rod([tu + Math.cos(a) * 0.12, 0.52, tv - Math.sin(a) * 0.12], [tu + Math.cos(a) * 0.36, 0, tv - Math.sin(a) * 0.36], 0.03, BAM_D); }
    const bx = tu + 0.06, bv = tv + 0.04, B0 = 0.62;                                               // бонг: колба с водой, трубка, чубук с чашкой
    { const m = add(new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 5), mat(GLASS))); m.position.set(bx, B0 + 0.1, -bv); m.scale.y = 0.95; }
    tube(bx, B0 + 0.16, B0 + 0.5, bv, 0.035, 0.035, GLASS, 7); tube(bx, B0 + 0.5, B0 + 0.53, bv, 0.048, 0.048, GLASS_L, 7);
    rod([bx + 0.04, B0 + 0.12, bv], [bx + 0.2, B0 + 0.3, bv - 0.03], 0.016, GLASS_L);
    tube(bx + 0.2, B0 + 0.29, B0 + 0.36, bv - 0.03, 0.02, 0.04, '#2a2a2c', 6);
    box(0.11, 0.025, 0.06, tu - 0.2, B0 + 0.013, tv - 0.16, '#d43a2a'); tube(tu - 0.12, B0, B0 + 0.03, tv + 0.2, 0.07, 0.08, '#8a8a84', 7);   // зажигалка, пепельница
    const cu = tu - 1.15, cv = tv + 0.15, S0 = 0.4;                                                // кресло смотрит на грядки
    for (const du of [-0.3, 0.3]) for (const dv of [-0.32, 0.32]) tube(cu + du, 0, du < 0 ? 1.05 : 0.62, cv + dv, 0.028, 0.028, BAM, 6);
    box(0.66, 0.05, 0.7, cu, S0, cv, BAM);
    for (let i = 0; i < 6; i++) box(0.03, 0.56, 0.05, cu - 0.3, S0 + 0.36, cv - 0.27 + i * 0.108, i % 2 ? BAM : BAM_D);   // рейки спинки
    rod([cu - 0.3, 1.05, cv - 0.34], [cu - 0.3, 1.05, cv + 0.34], 0.05, BAM_D);
    for (const dv of [-0.32, 0.32]) rod([cu - 0.3, 0.64, cv + dv], [cu + 0.33, 0.62, cv + dv], 0.05, BAM_D);   // подлокотники
    box(0.5, 0.08, 0.54, cu + 0.02, S0 + 0.06, cv, '#c9d2b4');                                     // подушка
  }

  // ---------- частокол: столбы через 2.2 м, две жерди, частые колья вкривь и вкось, местами выпали ----------
  const PICKET_COLS = ['#8a7d72', '#7a6e64', '#968a7c', '#6e635b', '#a09384'].map(c => new THREE.Color(c));
  const pick = [], fence = (runs, posts = true) => {
    for (const [u1, v1, u2, v2] of runs) {
      const len = Math.hypot(u2 - u1, v2 - v1), n = Math.max(1, Math.round(len / 2.2));
      if (posts) for (let i = 0; i <= n; i++) { const k = i / n; box(0.14, 1.2, 0.14, u1 + (u2 - u1) * k, 0.6, v1 + (v2 - v1) * k, '#6a5a52', (rnd() - 0.5) * 0.08); }
      for (const y of [0.3, 0.78]) rod([u1, y + (rnd() - 0.5) * 0.08, v1], [u2, y + (rnd() - 0.5) * 0.08, v2], 0.06, '#5b4f48');
      for (let d = 0.1; d < len; d += 0.24) {
        if (rnd() < 0.07) continue;                             // выпавший кол
        const k = d / len; pick.push([u1 + (u2 - u1) * k, v1 + (v2 - v1) * k, Math.atan2(-(v2 - v1), u2 - u1)]);
      }
    }
  };
  fence([[U1, -HV, U1, -GATE], [U1, GATE, U1, HV], [U1, HV, U0, HV], [U0, HV, U0, -HV], [U0, -HV, U1, -HV]]);
  fence([[U1, GATE, U1 - 1.5, GATE + 1.7], [U1, -GATE, U1 - 1.5, -GATE - 1.7]], false);   // створки распахнуты внутрь
  // колья — пять наборов по цвету. Не instanceColor: в режиме Y у всех один общий белый материал, и three.js r128
  // переносил программу с цветом экземпляров на наборы без него — рендер падал (null.isInterleavedBufferAttribute)
  { const geo = new THREE.BoxGeometry(0.065, 1.0, 0.065), o = new THREE.Object3D(), byCol = PICKET_COLS.map(() => []);
    for (const [u, v, a] of pick) {
      const h = 0.85 + rnd() * 0.3;
      o.position.set(u, h / 2, -v); o.rotation.set((rnd() - 0.5) * 0.12, a, (rnd() - 0.5) * 0.16); o.scale.set(1, h, 1); o.updateMatrix();
      byCol[(rnd() * 5) | 0].push(o.matrix.clone());
    }
    byCol.forEach((list, c) => {
      const m = add(new THREE.InstancedMesh(geo, lambert({ color: PICKET_COLS[c] }), list.length));
      list.forEach((mx, i) => m.setMatrixAt(i, mx));
    }); }
  scene.add(g);
  return g;
}

// Куст сативы — три скрещённые карточки с пиксельным рисунком плюс две розетки листьев плашмя (читается и сверху).
// Три склада куста: высокий, раскидистый «канделябр», средний несимметричный. b — буферы { pos, uv, col, idx }.
const CANNABIS_FILL = [122 / 128, 84 / 128, 106 / 128];             // какую долю высоты карточки занимает куст каждого склада
function cannabisPlant(b, rnd, x, z) {
  const kind = (rnd() * 3) | 0, H = kind === 0 ? 1.6 + rnd() * 0.5 : kind === 1 ? 1.0 + rnd() * 0.4 : 1.3 + rnd() * 0.5;
  const ch = H / CANNABIS_FILL[kind], cw = ch * 0.5;
  const t = [(0.88 + rnd() * 0.18) * 0.95, (0.88 + rnd() * 0.18) * 1.05, (0.85 + rnd() * 0.12) * 0.9], a0 = rnd() * Math.PI;
  const vert = (x, y, z, u, v) => { b.pos.push(x, y, z); b.uv.push(u, v); b.col.push(...t); };
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * Math.PI / 3, dx = Math.cos(a) * cw / 2, dz = Math.sin(a) * cw / 2, base = b.pos.length / 3;
    const flip = rnd() < 0.5, u0 = (kind + (flip ? 1 : 0)) / 4 + (flip ? -0.002 : 0.002), u1 = (kind + (flip ? 0 : 1)) / 4 + (flip ? 0.002 : -0.002);   // карточки зеркалятся вразнобой
    vert(x - dx, -0.03, z - dz, u0, 0); vert(x + dx, -0.03, z + dz, u1, 0);
    vert(x - dx, ch, z - dz, u0, 1); vert(x + dx, ch, z + dz, u1, 1);
    b.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  for (const [fy, fs, v0, v1] of [[0.42, 1.0, 0.002, 0.498], [0.8, 0.55, 0.502, 0.998]]) {     // розетки плашмя: листья внизу, верхушка
    const s = cw * fs * (kind === 1 ? 1 : 0.85) / 2, y = H * fy, a = rnd() * 6.28, c = Math.cos(a) * s, sn = Math.sin(a) * s, base = b.pos.length / 3;
    vert(x - c + sn, y, z - sn - c, 0.752, v0); vert(x + c + sn, y, z + sn - c, 0.998, v0);
    vert(x - c - sn, y + 0.05, z - sn + c, 0.752, v1); vert(x + c - sn, y + 0.05, z + sn + c, 0.998, v1);
    b.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
}
// Рисунок куста (из tropicalgame): три склада сбоку и две розетки сверху; плюс белый силуэт того же рисунка — для режима Y
let _cannabisTex = null;
function cannabisTextures() {
  if (_cannabisTex) return _cannabisTex;
  const tex = pixelTexture(256, 128, (g, w, h) => {
    const rnd = seededRandom(420), DARK = '#2c5a24', MID = '#3f7f2e', LIT = '#5fa23a', TIP = '#9acb58', STEM = '#6c9646';
    const BUD = ['#7f9f46', '#9ab85a', '#b6cc72', '#d8e2ae', '#c0904e'];     // шишка: жёлто-зелёная, со светлыми и рыжими волосками
    let X0 = 0, X1 = 64, Y0 = 0, Y1 = h;                                // окно, в котором сейчас рисуем
    const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= X0 && x < X1 && y >= Y0 && y < Y1) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } };
    const line = (x0, y0, x1, y1, c) => { const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.5) || 1; for (let i = 0; i <= n; i++) px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); };
    const finger = (x0, y0, x1, y1, c, edge) => {                       // листочек-«палец»: узкий, с острым светлым концом
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, n = Math.ceil(len * 1.5);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = x0 + dx * t, y = y0 + dy * t;
        px(x, y, t > 0.82 ? TIP : c);
        if (len > 5 && t > 0.15 && t < 0.72) px(x + nx * 0.9, y + ny * 0.9, edge);
      }
    };
    const fan = (x, y, dir, size, droop = 0.18) => {                    // веерный лист на черешке: семь пальцев
      const bx = x + Math.cos(dir) * size * 0.3, by = y - Math.sin(dir) * size * 0.3;
      line(x, y, bx, by, STEM);
      for (const k of [-3, 3, -2, 2, -1, 1, 0]) {
        const a = dir + k * 0.36, len = size * (1 - Math.abs(k) * 0.16);
        finger(bx, by, bx + Math.cos(a) * len, by - Math.sin(a) * len + len * droop, k % 2 ? LIT : MID, k % 2 ? MID : DARK);
      }
    };
    const bud = (x, y, r) => {                                          // шишка: плотный ком с торчащими листочками
      for (let i = 0; i < 7 + r * 2; i++) { const a = rnd() * 6.283, len = r * (0.9 + rnd() * 0.7); line(x, y, x + Math.cos(a) * len, y - Math.sin(a) * len * (Math.sin(a) > 0 ? 1.2 : 0.8), rnd() < 0.5 ? MID : LIT); }
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy * 0.8 <= r * r * 0.62 && rnd() < 0.9) px(x + dx, y + dy, BUD[rnd() < 0.1 ? 4 : rnd() < 0.2 ? 3 : (rnd() * 3) | 0]);
    };
    const cola = (x, yb, yt, r0, dx = 0) => {                           // кола: шишки одна над другой, кверху мельче
      const n = Math.max(2, Math.round((yb - yt) / (r0 * 0.95)));
      for (let i = 0; i <= n; i++) { const t = i / n; bud(x + dx * t + (rnd() - 0.5), yb + (yt - yb) * t, Math.max(1.3, r0 * (1 - 0.6 * t) * (0.9 + rnd() * 0.2))); }
    };
    const plant = (cell, top, colaR, arms, fans) => {                   // куст сбоку
      X0 = cell * 64; X1 = X0 + 64; Y0 = 0; Y1 = h;
      const cx = X0 + 32, base = h - 1, at = (f) => base - (base - top) * f;
      line(cx, base, cx, top + 4, STEM); line(cx + 1, base, cx + 1, at(0.5), '#55803a');
      for (let i = 0; i < fans; i++) {
        const f = 0.06 + 0.84 * i / (fans - 1), side = i % 2 ? 1 : -1, up = -0.25 + 0.75 * f + (rnd() - 0.5) * 0.3;
        fan(cx, at(f), side > 0 ? up : Math.PI - up, (23 - 11 * f) * (0.85 + rnd() * 0.3), 0.22 - 0.2 * f);
      }
      for (const [f, side, reach, rise, r] of arms) {
        const y0 = at(f), ex = cx + side * reach, ey = y0 - rise;
        line(cx, y0, ex, ey, STEM);
        fan(cx + side * reach * 0.5, y0 - rise * 0.5, side > 0 ? -0.2 : Math.PI + 0.2, 11, 0.2);
        fan(ex, ey, side > 0 ? 0.5 : Math.PI - 0.5, 9, 0.05);
        cola(cx + side * reach * 0.7, y0 - rise * 0.7, ey - r * 2.6, r, side * (reach * 0.3 + 1.5));
      }
      cola(cx, at(0.52), top + colaR * 0.5, colaR);
    };
    plant(0, 6, 4.6, [[0.42, -1, 13, 16, 3.0], [0.5, 1, 11, 15, 2.8], [0.3, 1, 16, 14, 3.0]], 11);
    plant(1, 44, 4.0, [[0.25, -1, 20, 20, 3.2], [0.3, 1, 19, 19, 3.2], [0.45, -1, 12, 18, 3.0], [0.5, 1, 13, 18, 3.0], [0.15, -1, 23, 12, 2.8], [0.18, 1, 23, 11, 2.8]], 8);
    plant(2, 22, 4.4, [[0.35, -1, 15, 18, 3.0], [0.45, 1, 10, 16, 2.8], [0.28, 1, 18, 13, 3.0]], 10);
    X0 = 192; X1 = 256;                                                  // вид сверху: розетки веерных листьев
    Y0 = 64; Y1 = 128; for (let i = 0; i < 7; i++) fan(224, 96, i / 7 * 6.283 + 0.3, 22, 0); bud(224, 96, 4);
    Y0 = 0; Y1 = 64; for (let i = 0; i < 6; i++) fan(224, 32, i / 6 * 6.283 + 0.9, 17, 0); bud(224, 32, 5);
  });
  // белый силуэт: тот же рисунок, все непрозрачные точки — белые
  const src = tex.image, white = pixelTexture(src.width, src.height, (g, w, h) => {
    g.drawImage(src, 0, 0);
    const im = g.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) d[i] = d[i + 1] = d[i + 2] = 255;
    g.putImageData(im, 0, 0);
  });
  return _cannabisTex = { tex, white };
}
