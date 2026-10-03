// Храмы Самуи — по фото и обмерам из refs/wat_plai_laem, wat_khunaram, khao_hua_jook, laem_sor_pagoda.
// Место, рельеф (озеро, холм, площадка) и подъездную дорогу каждого храма задаёт сборщик острова (ISLAND.spots);
// здесь — постройки и статуи. Постройки настоящего размера, расстояния между ними сжаты.
// Оси места: u — куда оно смотрит (локальный +X), v — влево от u (локальный −Z), y — вверх.
// Файл подключается после landmarks.js (берёт оттуда sculptor, spotGroup, spotPlate, spotPlace) и только объявляет
// функции; игра зовёт buildTemples().

const T_GOLD = '#d8b24a', T_GOLD_D = '#b0894a', T_GOLD_L = '#f2dc8a', T_WHITE = '#efece4';

// ---------- общие детали ----------
// Позолота: в тени под зелёным отсветом земли жёлтое уходит в болотный цвет — постройкам храмов даётся тёплая
// собственная подсветка. Ночью она же читается как мягкая подсветка храма.
let GILT_MAT = null;
function templeMesh(S) {
  const m = S.mesh();
  if (!GILT_MAT) GILT_MAT = lambert({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x34280e });
  m.material = GILT_MAT;
  return m;
}
// Мощение, уложенное по земле: сетка граней повторяет рельеф (площадка у дороги никогда не бывает идеально ровной).
// color — цвет или функция (i, j) -> цвет клетки. Колёса и следы шин идут по мощению (pavedAreas).
function drape(S, g, u0, u1, v0, v1, color, lift = 0.06, cell = 3, shape = null) {   // shape(u, v) — где мощение есть (иначе весь прямоугольник)
  const nu = Math.max(1, Math.ceil((u1 - u0) / cell)), nv = Math.max(1, Math.ceil((v1 - v0) / cell)), P = [];
  for (let i = 0; i <= nu; i++) {
    P.push([]);
    for (let j = 0; j <= nv; j++) {                                                               // высота узла — по самой высокой точке земли вокруг него: складки рельефа не протыкают мощение
      const u = u0 + (u1 - u0) * i / nu, v = v0 + (v1 - v0) * j / nv, hu = (u1 - u0) / nu / 2, hv = (v1 - v0) / nv / 2;
      let y = -1e9; for (const du of [-hu, 0, hu]) for (const dv of [-hv, 0, hv]) y = Math.max(y, spotGround(g, u + du, v + dv));
      P[i].push([u, y + lift, -v]);
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const c = typeof color === 'function' ? color(i, j, u0 + (u1 - u0) * (i + 0.5) / nu, v0 + (v1 - v0) * (j + 0.5) / nv) : color;
    if (c && (!shape || shape(u0 + (u1 - u0) * (i + 0.5) / nu, v0 + (v1 - v0) * (j + 0.5) / nv))) S.quad(P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1], c);
  }
  const c = g.localToWorld(new THREE.Vector3((u0 + u1) / 2, 0, -(v0 + v1) / 2));
  pavedAreas.push({ x: c.x, z: c.z, r2: ((u1 - u0) ** 2 + (v1 - v0) ** 2) / 4 + 4, lift,
    test: (x, z) => { const q = g.worldToLocal(new THREE.Vector3(x, 0, z)); return q.x > u0 && q.x < u1 && -q.z > v0 && -q.z < v1 && (!shape || shape(q.x, -q.z)); } });
}
// ограда, идущая по неровной земле: кусками по piece метров, каждый — на своей высоте
function fenceOnGround(g, u1, v1, u2, v2, spec, piece = 8) {
  const n = Math.max(1, Math.round(Math.hypot(u2 - u1, v2 - v1) / piece));
  for (let i = 0; i < n; i++) {
    const a = [u1 + (u2 - u1) * i / n, v1 + (v2 - v1) * i / n], b = [u1 + (u2 - u1) * (i + 1) / n, v1 + (v2 - v1) * (i + 1) / n];
    armFence(buildFence(g, [[a[0], a[1], b[0], b[1]]], Object.assign({}, spec, { y0: Math.min(spotGround(g, a[0], a[1]), spotGround(g, b[0], b[1])) - 0.05 })));
  }
}
// высота земли под точкой места
function spotGround(g, u, v) { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); return groundY(w.x, w.z); }
// Крутая тайская крыша ярусами, конёк вдоль X: нижние ярусы длиннее и ниже — на торцах выходит «лесенка» фронтонов.
// o: len — длина нижнего яруса, hw — полуширина, y0 — карниз, y1 — конёк верхнего яруса, tiers, step — на сколько каждый
// следующий ярус короче, drop — на сколько ниже; tile — два цвета черепицы; front — цвет фронтона; skirt — ширина
// пологого нижнего ската вдоль длинных сторон; spire — высота золотого шпиля на середине конька.
function thaiRoof(S, cx, cz, o) {
  const T = o.tiers || 3, step = o.step === undefined ? 3.4 : o.step, drop = o.drop || 1.2, tile = o.tile || ['#ad6c46', '#9a5c3a'];
  for (let j = 0; j < T; j++) {
    const up = T - 1 - j, len = o.len - j * step, y1 = o.y1 - up * drop, y0 = o.y0 - up * drop * 0.3, hw = o.hw + up * 0.35;
    S.gable(cx, cz, len, hw, y0, y1, tile[j % 2], o.front || T_GOLD_D, 'x');
    for (const e of [-1, 1]) {
      const x = cx + e * len / 2;
      for (const s of [-1, 1]) {
        S.rod([x, y0, cz + s * hw], [x, y1, cz], 0.3, T_GOLD);                                   // золотой ветровой брус
        S.limb([x, y0 + 0.1, cz + s * hw], [x + e * 0.5, y0 + 1.0, cz + s * (hw + 0.45)], 0.16, 0.03, T_GOLD, 5);   // «хвост» на углу карниза
      }
      S.limb([x, y1, cz], [x + e * 0.8, y1 + 2.1, cz], 0.2, 0.03, T_GOLD, 5);                    // чофа — рог на конце конька
    }
    S.box(len, 0.2, 0.2, cx, y1 + 0.05, cz, T_GOLD_D);
    if (o.trim !== false) for (const s of [-1, 1]) {                                              // кайма черепицы: тёмно-красная полоса по карнизу и торцам, зелёная нитка над ней
      const P = (l, t) => [cx + l, y0 + (y1 - y0) * t + 0.07, cz + s * (hw * (1 - t) + 0.05)], h = len / 2, tr = o.trim || '#8a2f24';
      S.quad(P(-h, 0), P(h, 0), P(h, 0.14), P(-h, 0.14), tr); S.quad(P(-h, 0.14), P(h, 0.14), P(h, 0.18), P(-h, 0.18), o.line || '#2f6a4a');
      for (const e of [-1, 1]) S.quad(P(e * h, 0.18), P(e * (h - 0.9), 0.18), P(e * (h - 0.9), 1), P(e * h, 1), tr);
    }
    if (j === 0) for (const e of [-1, 1]) {                                                       // фронтон: тёмное поле в золотой раме, медальон и розетки
      const x = cx + e * (len / 2 + 0.07), H = y1 - y0, F = (w, t) => [x, y0 + H * t, cz + w * hw];
      S.tri(F(-0.78, 0.07), F(0.78, 0.07), F(0, 0.85), o.field || '#1f4a5a');
      S.quad(F(-0.86, 0.02), F(0.86, 0.02), F(0.8, 0.09), F(-0.8, 0.09), T_GOLD_L);
      S.blob(x + e * 0.05, y0 + H * 0.36, cz, 0.12, H * 0.13, H * 0.13, T_GOLD_L, 8, 4);
      for (const w of [-0.42, 0.42]) S.blob(x + e * 0.05, y0 + H * 0.18, cz + w * hw, 0.1, H * 0.06, H * 0.06, T_GOLD, 6, 3);
      S.limb([x + e * 0.05, y0 + H * 0.5, cz], [x + e * 0.05, y0 + H * 0.74, cz], H * 0.035, 0.02, T_GOLD_L, 4);
    }
    if (j === 0 && o.skirt) for (const s of [-1, 1])                                            // пологий нижний скат
      S.quad([cx - len / 2, y0 + 0.25, cz + s * hw * 0.92], [cx + len / 2, y0 + 0.25, cz + s * hw * 0.92], [cx + len / 2, y0 - o.skirt * 0.5, cz + s * (hw + o.skirt)], [cx - len / 2, y0 - o.skirt * 0.5, cz + s * (hw + o.skirt)], tile[1]);
  }
  if (o.spire) { S.tube(cx, o.y1, o.y1 + o.spire * 0.3, cz, 0.45, 0.25, T_GOLD, 6); S.tube(cx, o.y1 + o.spire * 0.3, o.y1 + o.spire, cz, 0.22, 0.02, T_GOLD_L, 6); }
}
// окно или дверь в золотом наличнике с остроконечным верхом. face: 'z' — стена смотрит вдоль Z (ширина по X), 'x' — вдоль X
function thaiWindow(S, x, y, z, w, h, face, out, dark = '#3a2418') {
  const bx = face === 'z' ? [w, h, 0.14] : [0.14, h, w], fr = face === 'z' ? [w + 0.5, h + 0.4, 0.1] : [0.1, h + 0.4, w + 0.5];
  const ox = face === 'x' ? out * 0.06 : 0, oz = face === 'z' ? out * 0.06 : 0;
  S.box(fr[0], fr[1], fr[2], x, y, z, T_GOLD); S.box(bx[0], bx[1], bx[2], x + ox, y, z + oz, dark);
  const top = y + h / 2 + 0.2, pt = (a, yy) => face === 'z' ? [x + a, yy, z + oz * 2] : [x + ox * 2, yy, z + a];
  S.tri(pt(-w * 0.75, top), pt(w * 0.75, top), pt(0, top + w * 1.15), T_GOLD); S.tri(pt(-w * 0.4, top), pt(w * 0.4, top), pt(0, top + w * 1.9), T_GOLD_L);
}
// чеди: колокол на кольцевых уступах, «коробочка»-хармика, шпиль из сужающихся колец, игла. R — радиус у основания, H — высота
function chedi(S, x, y, z, R, H, n = 12, pal = [T_GOLD, '#e6c460', T_GOLD_D]) {
  const P = [[R * 1.18, 0], [R * 1.18, 0.05], [R * 1.05, 0.05], [R * 1.05, 0.09], [R * 0.95, 0.09], [R * 0.95, 0.13], [R * 0.86, 0.13], [R * 0.84, 0.17],
    [R * 0.74, 0.2], [R * 0.6, 0.3], [R * 0.44, 0.39], [R * 0.3, 0.44], [R * 0.36, 0.44], [R * 0.36, 0.5], [R * 0.24, 0.5]];
  for (let i = 0; i < 9; i++) { const r = R * 0.24 * (1 - i / 9.5), t = 0.5 + i * 0.038; P.push([r, t], [r * 1.12, t + 0.014], [r * 0.9, t + 0.038]); }
  P.push([R * 0.03, 0.86], [0.01, 1]);
  S.lathe(P.map(([r, t]) => [r, y + t * H]), x, z, (i, k) => pal[k < 8 ? (k % 2 ? 2 : 0) : (i + k) % 2], n);
}
// якша — страж у входа: коренастый великан в остроконечной короне, обе руки на рукояти булавы. Смотрит вдоль +X; h — рост
function yaksha(S, x, y, z, h, skin, cloth = ['#c8302a', '#1f4fa0', '#e8c82a']) {
  const k = h / 3.3, B = (cx, cy, cz, rx, ry, rz, c, n = 7, m = 4) => S.blob(x + cx * k, y + cy * k, z + cz * k, rx * k, ry * k, rz * k, c, n, m);
  S.box(1.0 * k, 0.25 * k, 1.4 * k, x, y + 0.12 * k, z, '#8f8f8b');
  for (const s of [-1, 1]) { S.limb([x, y + 0.3 * k, z + s * 0.35 * k], [x, y + 1.15 * k, z + s * 0.3 * k], 0.2 * k, 0.26 * k, cloth[2], 6); B(0.12, 0.34, s * 0.36, 0.3, 0.12, 0.2, cloth[0]); }
  S.lathe([[0.55 * k, y + 1.1 * k], [0.62 * k, y + 1.35 * k], [0.4 * k, y + 1.6 * k]], x, z, (i) => cloth[i % 3], 9);   // юбка ромбами
  S.lathe([[0.42 * k, y + 1.6 * k], [0.52 * k, y + 2.0 * k], [0.5 * k, y + 2.3 * k], [0.26 * k, y + 2.5 * k]], x, z, (i, j) => j === 1 ? cloth[1] : cloth[(i + j) % 2 ? 0 : 2], 9);
  for (const s of [-1, 1]) { B(0, 2.3, s * 0.55, 0.22, 0.22, 0.22, T_GOLD); S.limb([x, y + 2.25 * k, z + s * 0.58 * k], [x + 0.4 * k, y + 1.75 * k, z + s * 0.25 * k], 0.15 * k, 0.12 * k, skin, 5); }
  B(0.48, 1.72, 0, 0.16, 0.14, 0.24, skin);                                                       // кисти на рукояти
  S.tube(x + 0.5 * k, y + 0.25 * k, y + 1.7 * k, z, 0.1 * k, 0.07 * k, '#e8c82a', 6); B(0.5, 0.36, 0, 0.17, 0.2, 0.17, T_GOLD);   // булава
  B(0.02, 2.72, 0, 0.3, 0.3, 0.28, skin); B(0.22, 2.66, 0, 0.14, 0.1, 0.2, '#f2f2ee', 5, 3); B(0.24, 2.8, 0, 0.1, 0.06, 0.2, '#1a1a1a', 5, 3);   // голова, оскал, брови
  S.lathe([[0.33 * k, y + 2.9 * k], [0.24 * k, y + 3.05 * k], [0.1 * k, y + 3.2 * k], [0.01, y + 3.55 * k]], x, z, T_GOLD, 7);   // корона-шип
}
// сидящий золотой Будда (маленький, для ниш): h — высота
function smallBuddha(S, x, y, z, h, c = '#d3b740') {
  S.blob(x, y + h * 0.16, z, h * 0.34, h * 0.16, h * 0.42, c, 7, 3); S.lathe([[h * 0.22, y + h * 0.25], [h * 0.2, y + h * 0.6], [h * 0.09, y + h * 0.7]], x, z, c, 7);
  S.blob(x, y + h * 0.8, z, h * 0.12, h * 0.14, h * 0.12, c, 6, 4); S.tube(x, y + h * 0.92, y + h, z, h * 0.04, 0.005, c, 4);
}
// вода озера: своя текстура (серо-зелёная, с рябью), течёт медленно
let LAKE_MAT = null;
function lakeMaterial() {
  if (LAKE_MAT) return LAKE_MAT;
  const tex = pixelTexture(32, 32, (g, w, h) => {
    const rnd = seededRandom(91);
    g.fillStyle = '#4d7a72'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) { g.fillStyle = ['#588880', '#456e68', '#63948a', '#3e645e'][(rnd() * 4) | 0]; g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 2 + ((rnd() * 5) | 0), 1); }
    for (let i = 0; i < 5; i++) { g.fillStyle = '#a4c8be'; g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 2 + ((rnd() * 3) | 0), 1); }
  });
  airportAnim.push((t) => tex.offset.set((t * 0.012) % 1, (t * 0.02) % 1));
  return LAKE_MAT = lambert({ map: tex, transparent: true, opacity: 0.94, side: THREE.DoubleSide });
}
// перила-балюстрада (разрушаемые): runs — отрезки [u1, v1, u2, v2]
function templeRail(g, runs, y0, post = T_WHITE, bar = T_WHITE, h = 1.0) {
  armFence(buildFence(g, runs, { step: 2.2, y0, post: [0.22, h + 0.15, post], bars: [[h, 0.14, bar], [0.5, 0.08, bar], [0.12, 0.12, bar]], kind: 'parapet', loss: 0.05, mat: 'stone' }));
}
// отдельный разрушаемый предмет (фонарь, флагшток, колонна с птицей): свой маленький меш; build(S) рисует его вокруг
// начала координат (y — настоящая высота). o: kind, mat, r — радиус, loss, color — цвет обломков
function templeProp(g, u, v, build, o = {}) {
  const S = sculptor(); build(S);
  const m = o.gilt ? templeMesh(S) : S.mesh();
  m.position.set(u, 0, -v); g.add(m);
  const w = g.localToWorld(new THREE.Vector3(u, 0, -v));
  posts.push([w.x, w.z]);
  m.geometry.computeBoundingBox();
  const bb = m.geometry.boundingBox;
  addBreakable({ kind: o.kind || 'pole', mat: o.mat || 'metal', x: w.x, z: w.z, r: o.r || 0.25, loss: o.loss || 0.06,
    hide() { m.visible = false; },
    pieces(out) {
      m.updateWorldMatrix(true, false);
      const c = bb.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld), s = bb.getSize(new THREE.Vector3());
      shatter(out, c.x, c.y, c.z, Math.min(s.x, 0.6), s.y, Math.min(s.z, 0.6), new THREE.Quaternion(), o.color || '#d8d8d4', o.mat || 'metal');
      if (o.extra) o.extra(out, c);
    } });
  return m;
}
// фонарь на дворе храма: белый столб, золотое навершие, матовый шар
function templeLamp(g, u, v, y, h = 4.2) {
  templeProp(g, u, v, (S) => {
    S.tube(0, y, y + 0.5, 0, 0.2, 0.12, T_WHITE, 6); S.tube(0, y + 0.5, y + h, 0, 0.08, 0.06, T_WHITE, 6);
    S.blob(0, y + h + 0.25, 0, 0.26, 0.28, 0.26, '#fff6d0', 6, 4); S.tube(0, y + h + 0.5, y + h + 0.9, 0, 0.12, 0.01, T_GOLD, 5);
  }, { color: '#e8e4da' });
}
// Ворота храма: два столба «сапогом», перекладина, фронтон в языках пламени с двух сторон, шпиль. across — вдоль какой
// оси стоят столбы ('x' или 'z'); hw — полупролёт; pal: [столбы, пояса, перекладина, поле фронтона]. Возвращает места столбов.
function templeGate(S, cx, cz, y, across, hw, pal) {
  const P = (a, t) => across === 'x' ? [cx + a, cz + t] : [cx + t, cz + a], B = (wa, h, wt, a, yy, t, c) => { const [x, z] = P(a, t); S.box(across === 'x' ? wa : wt, h, across === 'x' ? wt : wa, x, yy, z, c); };
  const H = 5.2;
  for (const s of [-1, 1]) {
    B(1.7, 0.5, 1.7, s * hw, y + 0.25, 0, pal[2]); B(1.5, 1.3, 1.5, s * hw, y + 1.1, 0, pal[0]); B(1.25, 1.2, 1.25, s * hw, y + 2.3, 0, pal[0]); B(1.05, H - 2.9, 1.05, s * hw, y + 2.9 + (H - 2.9) / 2, 0, pal[0]);
    B(1.5, 0.4, 1.5, s * hw, y + H + 0.2, 0, pal[1]); B(1.3, 0.2, 1.3, s * hw, y + 1.8, 0, pal[1]);
    const [fx, fz] = P(s * hw, 0); S.tube(fx, y + H + 0.4, y + H + 1.7, fz, 0.3, 0.02, T_GOLD, 5);
  }
  B(2 * hw + 2.2, 0.9, 1.3, 0, y + H + 0.85, 0, pal[2]); B(2 * hw + 2.4, 0.3, 1.4, 0, y + H + 0.5, 0, pal[1]);
  const top = y + H + 1.3, apex = top + 3.1, W = hw + 1.2;
  for (const e of [-1, 1]) {
    const Q = (a, yy, d = 0) => { const [x, z] = P(a, e * (0.5 + d)); return [x, yy, z]; };
    S.tri(Q(-W, top), Q(W, top), Q(0, apex), pal[0]); S.tri(Q(-W * 0.72, top + 0.25, 0.05), Q(W * 0.72, top + 0.25, 0.05), Q(0, apex - 0.8, 0.05), pal[3]);
    const m = Q(0, top + 0.95, 0.12); S.blob(m[0], m[1], m[2], across === 'x' ? 0.55 : 0.1, 0.55, across === 'x' ? 0.1 : 0.55, T_GOLD_L, 8, 4);
  }
  for (let i = 0; i <= 8; i++) for (const s of [-1, 1]) {                                          // зубцы-пламя по скатам
    const t = i / 8, a = P(s * W * (1 - t), 0), b = P(s * (W * (1 - t) + 0.45 - t * 0.3), 0);
    S.limb([a[0], top + t * 3.1, a[1]], [b[0], top + 0.7 + t * 3.2, b[1]], 0.2, 0.03, i % 2 ? pal[0] : T_GOLD, 4);
  }
  S.tube(cx, apex, apex + 1.4, cz, 0.16, 0.01, T_GOLD, 5);
  return [-1, 1].map((s) => P(s * hw, 0));
}
// растения у храма: [u, v, вид]
function templePlants(g, list) { for (const [u, v, k] of list) { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); VEG_EXTRA.push([w.x, w.z, k]); } }
// участок храма: придорожное и лес сюда не заходят
function templeKeepOut(g, u0, u1, v0, v1) {
  const c = g.localToWorld(new THREE.Vector3((u0 + u1) / 2, 0, -(v0 + v1) / 2));
  vegKeepOut.push(Object.assign((x, z) => { const q = g.worldToLocal(new THREE.Vector3(x, 0, z)); return q.x > u0 && q.x < u1 && -q.z > v0 && -q.z < v1; }, { c: [c.x, c.z, Math.hypot(u1 - u0, v1 - v0) / 2 + 2] }));
}

// =====================================================================================================
// ВАТ ПЛАЙ ЛАЕМ — озеро с тремя островами в ряд: 18-рукая Гуаньинь на драконе между двух китайских павильонов,
// храм-убосот на острове в лепестках лотоса и смеющийся Будда (Будай). Всё смотрит на берег с площадью (u > 14);
// к каждому острову ведёт свой мост. По мостам и платформам можно ездить; перила ломаются, в озере — вода.
// =====================================================================================================
function buildPlaiLaem() {
  const g = spotGroup('plai_laem'), sp = g.userData.spot, L = sp.y, WY = L - 0.5, D = L + 0.6;      // уровни: берег, вода, настил платформ
  const LU0 = -46, LU1 = 14, LV = 62;
  // вода: гладь и запись для физики (в озере машина вязнет, как в море)
  { const pos = [LU0 - 2, WY, -LV - 2, LU1 + 2, WY, -LV - 2, LU0 - 2, WY, LV + 2, LU1 + 2, WY, LV + 2], uv = [0, 0, 9, 0, 0, 18, 9, 18];
    g.add(meshFrom(pos, uv, [0, 2, 1, 1, 2, 3], lakeMaterial()));
    const c = g.localToWorld(new THREE.Vector3(-16, 0, 0));
    waterAreas.push({ x: c.x, z: c.z, r: 78, level: WY, test: (x, z) => { const q = g.worldToLocal(new THREE.Vector3(x, 0, z)); return q.x > LU0 - 3 && q.x < LU1 + 3 && Math.abs(q.z) < LV + 3; } }); }

  // ---------- платформы и мосты ----------
  const A = sculptor();
  const deck = (u0, u1, v0, v1, c, y = D) => { A.box(u1 - u0, y - (L - 2.1), v1 - v0, (u0 + u1) / 2, (y + L - 2.1) / 2, -(v0 + v1) / 2, '#b9b4a8'); A.quad([u0, y + 0.02, -v0], [u1, y + 0.02, -v0], [u1, y + 0.02, -v1], [u0, y + 0.02, -v1], c); };
  // мост: настил от берега (u = LU1 + 2) до платформы; первые 5 м — подъём с берега
  const bridge = (u0, vc, hw, c, stripe) => {
    deck(u0, LU1 - 3, vc - hw, vc + hw, c);
    A.quad([LU1 - 3, D + 0.02, -(vc - hw)], [LU1 + 2, L + 0.05, -(vc - hw)], [LU1 + 2, L + 0.05, -(vc + hw)], [LU1 - 3, D + 0.02, -(vc + hw)], c);
    if (stripe) A.quad([u0, D + 0.04, -(vc - hw * 0.3)], [LU1 + 2, D + 0.04, -(vc - hw * 0.3)], [LU1 + 2, D + 0.04, -(vc + hw * 0.3)], [u0, D + 0.04, -(vc + hw * 0.3)], stripe);
    spotPlate(g, u0, LU1 - 3, vc, hw, D + 0.04); spotPlate(g, LU1 - 3, LU1 + 2, vc, hw, D + 0.04, L + 0.05, true);
  };
  // Гуаньинь: платформа 24 × 24, мост 4 м
  const GU = -14, GV = 40;
  deck(GU - 12, GU + 12, GV - 12, GV + 12, '#c9c5bb'); spotPlate(g, GU - 12, GU + 12, GV, 12, D + 0.04);
  bridge(GU + 12, GV, 2.2, '#c9c5bb', '#d8c8b0');
  templeRail(g, [[GU + 12, GV - 12, GU - 12, GV - 12], [GU - 12, GV - 12, GU - 12, GV + 12], [GU - 12, GV + 12, GU + 12, GV + 12], [GU + 12, GV + 12, GU + 12, GV + 2.2], [GU + 12, GV - 2.2, GU + 12, GV - 12],
    [GU + 12, GV + 2.2, LU1 - 3, GV + 2.2], [GU + 12, GV - 2.2, LU1 - 3, GV - 2.2]], D);
  // Будай: платформа 22 × 22, мост 5 м с колоннами и золотыми птицами
  const BU = -14, BV = -40;
  deck(BU - 11, BU + 11, BV - 11, BV + 11, '#c9c5bb'); spotPlate(g, BU - 11, BU + 11, BV, 11, D + 0.04);
  bridge(BU + 11, BV, 2.7, '#748b7f', '#7f5145');
  templeRail(g, [[BU + 11, BV - 11, BU - 11, BV - 11], [BU - 11, BV - 11, BU - 11, BV + 11], [BU - 11, BV + 11, BU + 11, BV + 11], [BU + 11, BV + 11, BU + 11, BV + 2.7], [BU + 11, BV - 2.7, BU + 11, BV - 11]], D);
  armFence(buildFence(g, [[BU + 11, BV + 2.7, LU1 - 3, BV + 2.7], [BU + 11, BV - 2.7, LU1 - 3, BV - 2.7]], { step: 2.5, y0: D, bars: [[0.9, 0.1, '#1f4fa0'], [0.45, 0.08, '#1f4fa0']], kind: 'rail', loss: 0.04 }));
  for (let u = BU + 12; u < LU1 - 3; u += 2.5) for (const s of [-1, 1]) templeProp(g, u, BV + s * 2.7, (F) => {   // каннелированные колонны, на каждой — птица хонг
    F.tube(0, D, D + 0.4, 0, 0.34, 0.26, T_GOLD, 8); F.tube(0, D + 0.4, D + 2.1, 0, 0.2, 0.18, '#8a3a2a', 8); F.tube(0, D + 2.1, D + 2.4, 0, 0.2, 0.32, T_GOLD, 8);
    F.blob(0.1, D + 2.75, 0, 0.42, 0.3, 0.24, T_GOLD, 6, 4); F.limb([0.4, D + 2.85, 0], [0.55, D + 3.5, 0], 0.11, 0.07, T_GOLD, 5); F.blob(0.62, D + 3.56, 0, 0.14, 0.1, 0.1, T_GOLD_L, 5, 3);
    F.limb([-0.3, D + 2.85, 0], [-0.85, D + 3.4, 0], 0.16, 0.03, T_GOLD, 5);                       // хвост
  }, { gilt: true, color: '#b08a4a', mat: 'stone', r: 0.3 });
  // убосот: остров 42 × 26 в двух рядах розовых лепестков, горбатый мост 4 м
  const IU0 = -38, IU1 = 4, IV = 13;
  deck(IU0, IU1, -IV, IV, '#d8cfc0'); spotPlate(g, IU0, IU1, 0, IV, D + 0.04);
  deck(IU1, LU1 - 3, -2, 2, '#b9b4a8');
  A.quad([LU1 - 3, D + 0.02, 2], [LU1 + 2, L + 0.05, 2], [LU1 + 2, L + 0.05, -2], [LU1 - 3, D + 0.02, -2], '#b9b4a8');
  spotPlate(g, IU1, LU1 - 3, 0, 2, D + 0.04); spotPlate(g, LU1 - 3, LU1 + 2, 0, 2, D + 0.04, L + 0.05, true);
  armFence(buildFence(g, [[IU1, 2, LU1 - 3, 2], [IU1, -2, LU1 - 3, -2]], { step: 1.4, y0: D, post: [0.2, 0.95, '#2a4a9a'], bars: [[0.95, 0.16, '#d8cfc0'], [0.1, 0.14, '#d8cfc0']], kind: 'parapet', loss: 0.05, mat: 'stone' }));
  { const petal = (u, v, nu, nv, row) => {                                                         // лепесток: остриё вверх, отогнут наружу
      const w = 0.55, h = row ? 1.0 : 1.55, o = row ? 0.75 : 0.25, tu = -nv, tv = nu, c = row ? ((u + v) & 1 ? '#c38796' : '#d2a1b2') : ((u * 3 + v) & 1 ? '#c8607a' : '#b8506a');
      A.tri([u + nu * o - tu * w, D - 0.5, -(v + nv * o - tv * w)], [u + nu * o + tu * w, D - 0.5, -(v + nv * o + tv * w)], [u + nu * (o + 0.5), D - 0.5 + h, -(v + nv * (o + 0.5))], c);
    };
    for (const row of [0, 1]) {
      for (let u = IU0 + 0.5; u <= IU1; u += 1.05) { petal(u, IV, 0, 1, row); petal(u, -IV, 0, -1, row); }
      for (let v = -IV + 0.5; v <= IV; v += 1.05) { petal(IU0, v, -1, 0, row); if (Math.abs(v) > 2.6) petal(IU1, v, 1, 0, row); }
    }
    for (const [a, b, c, d] of [[IU0, IV, IU1, IV], [IU0, -IV, IU1, -IV], [IU0, -IV, IU0, IV], [IU1, 2.6, IU1, IV], [IU1, -IV, IU1, -2.6]]) wallLine(g, a, b, c, d); }
  g.add(A.mesh());

  // ---------- убосот: стены 28 × 12 × 7, окна в золотых наличниках, портики, крутая крыша в три яруса ----------
  const U = sculptor(), UC = -17, WH = 7;
  U.box(31, 0.6, 15, UC, D + 0.3, 0, '#e8dcc4'); U.box(28, WH, 12, UC, D + 0.6 + WH / 2, 0, '#d0c4b8');
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) thaiWindow(U, UC - 9.6 + i * 4.8, D + 3.6, s * 6.02, 1.2, 2.6, 'z', s);
  for (const e of [-1, 1]) {                                                                       // портики на колоннах с золотыми фронтонами
    for (const z of [-4.6, -1.6, 1.6, 4.6]) { U.box(0.55, WH, 0.55, UC + e * 16.2, D + 0.6 + WH / 2, z, '#e8dcc4'); U.box(0.75, 0.5, 0.75, UC + e * 16.2, D + 0.6 + WH - 0.25, z, T_GOLD); U.box(0.75, 0.6, 0.75, UC + e * 16.2, D + 0.9, z, T_GOLD); }
    thaiWindow(U, UC + e * 14.02, D + 2.6, 0, 2.0, 3.6, 'x', e, '#4a2418');
  }
  thaiRoof(U, UC, 0, { len: 35, hw: 7.6, y0: D + 0.6 + WH, y1: D + 17.4, tiers: 3, step: 5.5, drop: 1.6, skirt: 1.7, spire: 3.6, tile: ['#c8743e', '#ad6c46'], front: T_GOLD });
  g.add(templeMesh(U));
  wallBox(g, UC, 0, 29, 12.6);
  // стражи-якши у моста
  { const Y = sculptor(); yaksha(Y, IU1 - 1.6, D + 0.04, 3.6, 4.4, '#2e655b'); yaksha(Y, IU1 - 1.6, D + 0.04, -3.6, 4.4, '#e8e4da', ['#2f7a4a', '#c8302a', '#e8c82a']); g.add(templeMesh(Y));
    wallBox(g, IU1 - 1.6, 3.6, 1.4, 1.6); wallBox(g, IU1 - 1.6, -3.6, 1.4, 1.6); }

  // ---------- Гуаньинь: дракон, синий барабан, розовый лотос, сидящая фигура с веером из 18 рук ----------
  const Z = sculptor(), SKIN = '#ecd6cc', ROBE = '#d9c69a', ROBE_G = '#c8a04a';
  Z.lathe([[4.6, 0], [5.4, 0.8], [5.2, 1.7], [4.3, 2.0]], 0, 0, (i, k) => (i + k) % 2 ? '#5b8a3a' : '#7fa04a', 16);          // свернувшийся дракон
  Z.blob(5.6, 1.5, 0, 1.2, 0.8, 0.9, '#5b8a3a', 7, 4); Z.blob(6.5, 1.3, 0, 0.6, 0.4, 0.6, '#9c9958', 6, 3);
  for (const s of [-1, 1]) { Z.limb([5.4, 2.1, s * 0.5], [4.6, 3.2, s * 0.9], 0.14, 0.03, T_GOLD, 5); Z.blob(6.1, 1.75, s * 0.42, 0.14, 0.14, 0.1, '#f2f2ee', 5, 3); }
  Z.lathe([[3.9, 1.9], [4.2, 2.6], [4.0, 3.5]], 0, 0, (i, k) => (i + k) % 2 ? '#193a61' : '#24507f', 16); Z.lathe([[4.05, 3.45], [4.05, 3.65]], 0, 0, T_GOLD, 16);
  Z.lathe([[3.9, 3.6], [5.0, 4.3], [4.6, 5.1], [3.7, 5.2], [0, 5.2]], 0, 0, (i, k) => (i + k) % 2 ? '#c8607a' : '#dc8a9c', 20);   // лотос
  const SY = 5.2;                                                                                  // сиденье
  Z.blob(0.6, SY + 1.0, 0, 2.9, 1.1, 4.4, ROBE, 12, 5);                                           // скрещённые ноги под одеянием
  for (const s of [-1, 1]) Z.blob(1.4, SY + 0.9, s * 3.3, 1.7, 0.95, 1.5, ROBE, 8, 4);
  Z.lathe([[2.5, SY + 1.4], [2.2, SY + 3.0], [2.3, SY + 5.0], [2.6, SY + 6.4], [1.4, SY + 7.1], [0.75, SY + 7.5], [0.7, SY + 8.0]], -0.2, 0, (i, k) => k % 2 ? ROBE_G : ROBE, 12, 0.72, 1);   // торс в золотой чешуе
  Z.blob(0, SY + 8.9, 0, 1.15, 1.35, 1.1, SKIN, 10, 6);                                           // голова
  Z.blob(-0.25, SY + 9.6, 0, 1.2, 0.8, 1.15, '#1c1a1e', 10, 4); Z.lathe([[0.75, SY + 10.0], [0.9, SY + 10.6], [0.5, SY + 11.3], [0.05, SY + 12.0]], -0.1, 0, T_GOLD, 8);   // волосы, корона
  for (const s of [-1, 1]) { Z.box(0.08, 0.1, 0.4, 1.05, SY + 9.05, s * 0.4, '#2a1a1a'); Z.box(0.3, 1.3, 0.16, -0.1, SY + 8.6, s * 1.12, SKIN); }
  Z.box(0.08, 0.1, 0.34, 1.1, SY + 8.4, 0, '#c8302a');
  const HOLD = ['#e8c82a', '#c8302a', '#2a5a9a', '#f2f2ee', '#e88a2a', '#3a9a5a', '#d84a8a'];
  for (const s of [-1, 1]) {
    Z.blob(-0.2, SY + 6.3, s * 2.5, 0.9, 0.8, 0.85, ROBE_G, 7, 4);                                 // плечо
    for (let i = 0; i < 7; i++) {                                                                  // веер из семи рук
      const a = -0.75 + i * 0.36, r1 = 3.6, r2 = 6.6 + (i === 3 ? 0.5 : 0), sh = [-0.3, SY + 6.2, s * 2.6];
      const el = [-0.1 + i * 0.05, SY + 6.2 + Math.sin(a) * r1, s * (2.6 + Math.cos(a) * r1)], hd = [0.5, SY + 6.2 + Math.sin(a + 0.22) * r2, s * (2.6 + Math.cos(a + 0.22) * r2)];
      Z.limb(sh, el, 0.48, 0.38, SKIN, 6); Z.limb(el, hd, 0.38, 0.3, SKIN, 6); Z.blob(hd[0], hd[1], hd[2], 0.34, 0.42, 0.34, SKIN, 6, 3);
      Z.blob(el[0], el[1], el[2], 0.5, 0.2, 0.5, T_GOLD, 6, 3);                                    // браслет
      Z.blob(hd[0] + 0.25, hd[1] + 0.55, hd[2], 0.42, 0.42, 0.2, HOLD[(i + (s > 0 ? 0 : 3)) % 7], 6, 3);   // предмет в руке
    }
    Z.limb([-0.2, SY + 6.2, s * 2.5], [1.5, SY + 5.0, s * 1.5], 0.46, 0.36, SKIN, 6); Z.limb([1.5, SY + 5.0, s * 1.5], [1.9, SY + 6.1, s * 0.22], 0.34, 0.26, SKIN, 6);   // ладони у груди
    Z.limb([-0.3, SY + 6.6, s * 2.3], [-0.3, SY + 10.4, s * 3.0], 0.46, 0.36, SKIN, 6); Z.limb([-0.3, SY + 10.4, s * 3.0], [-0.1, SY + 12.8, s * 0.5], 0.34, 0.26, SKIN, 6);   // руки над головой
  }
  Z.blob(1.95, SY + 6.3, 0, 0.3, 0.6, 0.3, SKIN, 6, 3); smallBuddha(Z, -0.1, SY + 12.8, 0, 1.4);
  const guan = templeMesh(Z); guan.position.set(GU - 1, D, -GV); g.add(guan);
  wallBox(g, GU - 1, GV, 11, 11);
  // два китайских павильона по бокам: белые колонны, вогнутая красно-коричневая кровля с загнутыми углами
  const C = sculptor();
  for (const s of [-1, 1]) {
    const cu = GU + 5, cv = GV + s * 8.6, z = -cv;
    C.box(7.6, 0.3, 5.6, cu, D + 0.15, z, '#e8e4da');
    for (const du of [-3.3, 0, 3.3]) for (const dv of [-2.3, 2.3]) C.tube(cu + du, D + 0.3, D + 3.3, z + dv, 0.18, 0.18, T_WHITE, 6);
    C.hip(cu, z, 4.9, 3.9, D + 3.2, 3.4, 2.4, D + 4.0, (i) => i % 2 ? '#895b56' : '#7a4a46'); C.hip(cu, z, 3.4, 2.4, D + 4.0, 1.6, 0.1, D + 6.0, (i) => i % 2 ? '#96635c' : '#895b56');
    C.box(3.4, 0.3, 0.3, cu, D + 6.05, z, '#f2f2ee');
    for (const du of [-1, 1]) for (const dv of [-1, 1]) C.limb([cu + du * 4.7, D + 3.25, z + dv * 3.7], [cu + du * 5.6, D + 4.3, z + dv * 4.5], 0.2, 0.04, '#895b56', 5);   // загнутые углы
    for (const du of [-1, 1]) C.limb([cu + du * 1.7, D + 6.1, z], [cu + du * 2.5, D + 6.9, z], 0.16, 0.03, '#3a8a5a', 5);
  }
  g.add(templeMesh(C));

  // ---------- Будай: двухъярусный постамент, лотос, шар-живот, золотой диск за головой ----------
  const Bd = sculptor(), BS = '#e2d2b4', BR = '#6a2e27';
  Bd.box(9, 1.6, 9, 0, 0.8, 0, '#efe6d2'); Bd.box(7, 1.6, 7, 0, 2.4, 0, '#f6eedc');
  for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) Bd.box(du ? 0.2 : 3, 1.0, dv ? 0.2 : 3, du * 3.55, 2.5, dv * 3.55, T_GOLD);
  Bd.lathe([[3.3, 3.2], [4.2, 3.9], [3.8, 4.7], [3.0, 4.8], [0, 4.8]], 0, 0, (i, k) => (i + k) % 2 ? '#e8a8b8' : '#f2c4d0', 16);
  const BY = 4.8;
  Bd.blob(0.4, BY + 1.3, 0, 3.2, 1.4, 4.4, BR, 12, 5);                                             // ноги под красным одеянием
  Bd.blob(1.6, BY + 2.2, -2.6, 1.5, 1.6, 1.3, BR, 8, 4);                                           // поднятое колено
  Bd.blob(0.5, BY + 4.2, 0, 3.3, 3.3, 3.5, BS, 12, 8);                                             // живот-шар
  Bd.blob(-0.6, BY + 6.2, 0, 2.6, 2.2, 3.4, BR, 10, 5);                                            // плечи в одеянии
  Bd.blob(0.6, BY + 6.3, 0, 1.9, 1.6, 2.2, BS, 10, 5);                                             // грудь
  for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283; Bd.blob(0.7 + Math.sin(a) * 0.3, BY + 5.3 + Math.cos(a) * 1.5, Math.sin(a) * 2.9, 0.18, 0.18, 0.18, i % 3 ? T_GOLD : BR, 4, 3); }   // золотая сетка по краю одеяния
  Bd.blob(0.4, BY + 8.6, 0, 1.8, 1.95, 1.85, BS, 10, 7);                                           // голова
  for (const s of [-1, 1]) { Bd.blob(0.2, BY + 8.3, s * 1.85, 0.3, 0.8, 0.22, BS, 5, 4); Bd.box(0.1, 0.12, 0.6, 2.0, BY + 9.0, s * 0.7, '#2a1a1a', 0, s * 0.2); }
  Bd.box(0.14, 0.5, 1.5, 2.05, BY + 8.0, 0, '#7a1a1a'); Bd.box(0.16, 0.2, 1.3, 2.1, BY + 8.12, 0, '#f6f2ea');   // смех во весь рот
  Bd.blob(-1.4, BY + 9.5, 0, 0.25, 2.7, 2.7, T_GOLD, 14, 5);                                       // диск-веер за головой
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; Bd.limb([-1.3, BY + 9.5 + Math.sin(a) * 1.2, Math.cos(a) * 1.2], [-1.3, BY + 9.5 + Math.sin(a) * 2.9, Math.cos(a) * 2.9], 0.14, 0.08, T_GOLD_L, 4); }
  Bd.limb([-0.3, BY + 6.4, 3.2], [2.2, BY + 3.4, 3.6], 0.8, 0.6, BS, 7); Bd.blob(2.8, BY + 3.0, 3.6, 0.9, 1.1, 0.9, '#1f3f7f', 7, 5); Bd.tube(2.8, BY + 4.0, BY + 4.5, 3.6, 0.35, 0.5, '#1f3f7f', 7);   // правая рука с синим сосудом
  Bd.limb([-0.3, BY + 6.4, -3.2], [2.4, BY + 3.9, -2.9], 0.8, 0.6, BS, 7);
  for (let i = 0; i < 9; i++) Bd.blob(2.9, BY + 3.7 - i * 0.28, -2.9 + Math.sin(i * 0.7) * 0.2, 0.22, 0.22, 0.22, '#1a1a1c', 4, 3);   // чёрные чётки
  const budai = templeMesh(Bd); budai.position.set(BU - 1, D, -BV); g.add(budai);
  wallBox(g, BU - 1, BV, 9.4, 9.4);
  { const K = sculptor();                                                                          // ниши-киоски по углам платформы Будая
    for (const du of [-1, 1]) for (const dv of [-1, 1]) {
      const u = BU + du * 8.6, z = -(BV + dv * 8.6);
      K.box(1.8, 2.2, 1.8, u, D + 1.1, z, '#b8382e'); K.box(1.1, 1.5, 1.9, u, D + 1.0, z, '#f2e8d0'); K.box(1.9, 1.5, 1.1, u, D + 1.0, z, '#f2e8d0');
      K.hip(u, z, 1.2, 1.2, D + 2.2, 0.3, 0.3, D + 3.1, T_GOLD); K.tube(u, D + 3.1, D + 4.4, z, 0.16, 0.01, T_GOLD_L, 5); smallBuddha(K, u, D + 0.3, z, 1.1);
      wallBox(g, u, BV + dv * 8.6, 1.8, 1.8);
    }
    for (const k of [-1, 0, 1]) for (const s of [-1, 1]) {                                          // золотые шпили по краю платформы
      chedi(K, BU + k * 5.2, D, -(BV + s * 10.1), 0.3, 2.6, 6);
      if (s < 0 || k) chedi(K, BU + s * 10.1, D, -(BV + k * 5.2), 0.3, 2.6, 6);
    }
    g.add(templeMesh(K)); }

  // ---------- берег: набережная со стенкой, двор, стоянка у въезда, ворота, беседка над водой ----------
  const P = sculptor(), QU = LU1 + 2, QY = L + 0.06;                                               // QU — кромка набережной
  const QW = 11, QV = 72;                                                                          // плита набережной перекрывает пологий берег озера
  for (let v = -QV; v < QV; v += 6) P.quad([QU, QY, -v], [QU + QW, QY, -v], [QU + QW, QY, -(v + 6)], [QU, QY, -(v + 6)], (v / 6) & 1 ? '#bdb8ac' : '#b5b0a4');
  P.quad([QU, QY, QV], [QU, QY, -QV], [QU, L - 2.3, -QV], [QU, L - 2.3, QV], '#a09a8c');           // подпорная стенка
  for (const s of [-1, 1]) P.quad([QU, QY, s * QV], [QU + QW, QY, s * QV], [QU + QW, L - 2.3, s * QV], [QU, L - 2.3, s * QV], '#a09a8c');
  spotPlate(g, QU - 0.3, QU + QW, 0, QV, QY);
  templeRail(g, [[QU + 0.3, -62, QU + 0.3, -43], [QU + 0.3, -37, QU + 0.3, -2.3], [QU + 0.3, 2.3, QU + 0.3, 16.6], [QU + 0.3, 23.4, QU + 0.3, 37.5], [QU + 0.3, 42.5, QU + 0.3, 62]], QY);
  const lot = (u, v) => u > 27 && v > 46;                                                           // стоянка у въезда
  const ASPH = ['#6a6c6e', '#66686a'];                                                              // стоянка — тот же асфальт, что на подъездной дороге
  drape(P, g, QU + QW - 0.5, 46, -QV, 80, (i, j, u, v) => lot(u, v) ? ASPH[(i + j) % 2] : (i + j) % 2 ? '#c9bda8' : '#c2b6a0');
  // раструб: дорога (10 м) расширяется к стоянке (19 м) плавно, а не уступом
  drape(P, g, 27, 46, 80, 87, (i, j) => ASPH[(i + j) % 2], 0.06, 1, (u, v) => u > 27 + (v - 80) * 0.62 && u < 46 - (v - 80) * 0.76);
  const mark = (u0, u1, v0, v1) => { const y = Math.max(spotGround(g, u0, v0), spotGround(g, u1, v1)) + 0.1; P.quad([u0, y, -v0], [u1, y, -v0], [u1, y, -v1], [u0, y, -v1], '#e8e8e4'); };
  for (let v = 50; v <= 78; v += 4) mark(39.4, 45.4, v - 0.08, v + 0.08);                           // места справа от проезда
  for (let v = 50; v <= 74; v += 4) mark(27.8, 33.4, v - 0.08, v + 0.08);                           // и слева
  mark(27.35, 27.5, 46.4, 80); mark(27.35, 46, 46.3, 46.45); mark(45.5, 45.65, 46.4, 80);          // кромка стоянки
  { const su = LU1 + 1, sv = 20, z = -sv;                                                          // деревянная сала на сваях у воды
    for (const du of [-2.6, 2.6]) for (const dv of [-1.7, 1.7]) P.box(0.22, 4.2, 0.22, su + du, L + 1.2, z + dv, '#6a3a2a');
    P.box(6, 0.2, 4, su, L + 0.5, z, '#8a4a34');
    P.hip(su, z, 4.2, 3.2, L + 3.2, 2.2, 1.2, L + 4.4, (i) => i % 2 ? '#b8553a' : '#a04a30'); P.gable(su, z, 4.4, 1.2, L + 4.4, L + 5.6, '#b8553a', T_GOLD_D, 'x');
    for (const e of [-1, 1]) P.limb([su + e * 2.2, L + 5.6, z], [su + e * 2.8, L + 6.6, z], 0.12, 0.02, T_GOLD, 5);
    wallBox(g, su, sv, 6, 4); }
  [[-40, '#c8402c'], [-46, '#2f5f9a'], [-52, '#e8c82a']].forEach(([v, c]) => { fruitStall(P, 43.5, v, spotGround(g, 43.5, v), c); wallBox(g, 43.5, v, 2.4, 1.2); });   // лотки с кормом для рыб
  for (const v of [-60, 8, 38]) spiritHouse(P, 44.5, -v, spotGround(g, 44.5, v), v === 8);
  { const su = 25.6, sv = 85, sy = spotGround(g, su, sv);                                            // щит с названием — слева от ворот, лицом к подъезжающим (не на проезде)
    const T = sculptor(), th = signLines(T, 'WAT PLAI LAEM', 3.2, '#f4e8c8'), bh = Math.max(0.9, th + 0.36), yc = sy + 1.85 + bh / 2;   // над названием — тайское
    for (const du of [-1.6, 1.6]) P.box(0.1, yc - sy + bh / 2 - 0.15, 0.1, su + du, sy + (yc - sy + bh / 2 - 0.15) / 2, -sv, '#6a5a48');
    P.box(3.6, bh, 0.1, su, yc, -sv, '#6b4a2a');
    const m = T.mesh(); m.rotation.y = Math.PI; m.position.set(su, yc, -sv); m.userData.sign = 'WAT PLAI LAEM'; g.add(m); }
  g.add(P.mesh());
  for (const v of [-58, -22, -10, 10, 30, 58]) templeLamp(g, QU + 1.3, v, QY);
  parkVehicle(g, pickupGeo('songthaew', '#b8302a'), 42.3, 56, 'u+', spotGround(g, 42.3, 56) + 0.07);     // машины на стоянке (vehicles.js)
  parkVehicle(g, pickupGeo('empty', '#2f5f9a'), 42.3, 68, 'u-', spotGround(g, 42.3, 68) + 0.07);
  parkVehicle(g, parkedCar(1), 30.6, 60, 'u-', spotGround(g, 30.6, 60) + 0.07); parkVehicle(g, parkedCar(4), 30.6, 72, 'u+', spotGround(g, 30.6, 72) + 0.07);
  parkVehicle(g, parkedCar(8), 42.3, 76, 'u+', spotGround(g, 42.3, 76) + 0.07);
  scooterRow(g, 5, 5, 28.6, 52, 0.85, 0, Math.PI / 2, spotGround(g, 30, 52) + 0.07);
  { const Gt = sculptor(), gy = spotGround(g, 36, 82);                                              // ворота на въезде с дороги
    for (const [x, z] of templeGate(Gt, 36, -82, gy, 'x', 5.8, ['#f2ece0', '#b8382e', '#f2ece0', '#1f4a5a'])) wallBox(g, x, -z, 1.6, 1.6);
    g.add(templeMesh(Gt)); }
  templePlants(g, [[33, -52, 'fan'], [33, -30, 'areca'], [33, -8, 'fan'], [33, 14, 'areca'], [33, 34, 'fan'], [50, -66, 'coconut'], [52, -40, 'coconut'], [52, 12, 'areca'], [52, 40, 'coconut'],
    [-56, -50, 'coconut'], [-58, 0, 'coconut'], [-56, 48, 'coconut'], [-30, 70, 'areca'], [-30, -70, 'coconut'], [0, -70, 'fan'], [24, -72, 'coconut'], [22, 72, 'bush'], [50, -20, 'bush']]);
  templeKeepOut(g, -64, 50, -78, 92);
  spotPlace('ВАТ ПЛАЙ ЛАЕМ', g, 36, 66, 0, -1);
}

// =====================================================================================================
// ВАТ КХУНАРАМ — монастырь на кольцевой дороге: ворота у самого асфальта, убосот на голубой террасе с лестницей и
// нагами, открытый павильон с мумией монаха Луанг Пхо Дэнга (сидит в стеклянной витрине, в оранжевой рясе и тёмных очках).
// =====================================================================================================
function buildKhunaram() {
  const g = spotGroup('khunaram'), sp = g.userData.spot, L = sp.y;
  // где дорога: ворота ставятся у обочины кольцевой
  let RD = 70; for (let u = 30; u < 110; u += 0.5) { const w = g.localToWorld(new THREE.Vector3(u, 0, 0)), h = roadAt(w.x, w.z); if (h && h.road.ring && h.d < halfS + 0.4) { RD = u; break; } }
  const GU = RD - 3.5;                                                                            // линия ворот и ограды
  const S = sculptor();
  // ---------- двор и проезд от дороги ----------
  { const Pv = sculptor();
    drape(Pv, g, 16, GU + 1.5, -19, 19, (i, j) => (i + j) % 2 ? '#dfcaaf' : '#d6c0a4');
    drape(Pv, g, GU + 1.5, RD - 0.2, -4.6, 4.6, '#a29f96', 0.07);
    g.add(Pv.mesh()); }
  // ---------- ворота: оранжевые столбы «сапогом», фронтон в языках пламени, боковые крылья ----------
  const gy = spotGround(g, GU, 0);
  for (const [x, z] of templeGate(S, GU, 0, gy, 'z', 3.4, ['#dc4a11', '#628e38', '#cfe3e6', '#8ec86a'])) wallBox(g, x, -z, 1.6, 1.6);
  for (const s of [-1, 1]) { S.box(1.2, 3.2, 2.4, GU, gy + 1.6, s * 5.9, '#cfe3e6'); S.gable(GU, s * 5.9, 3.0, 1.0, gy + 3.2, gy + 4.1, '#c8302a', '#628e38', 'z'); wallBox(g, GU, s * 5.9, 1.2, 2.4); }
  // ограда вдоль дороги: красные бетонные решётки с колесом дхармы
  const FSPEC = { step: 2.5, post: [0.4, 1.6, '#9e483c'], bars: [[1.3, 0.16, '#9e483c'], [0.2, 0.2, '#9e483c']], slab: [0.3, 1.2, 0.1, '#b85a4c'], kind: 'parapet', loss: 0.06, mat: 'stone' };
  for (const s of [-1, 1]) {
    fenceOnGround(g, GU, s * 7.2, GU, s * 42.2, FSPEC, 10);
    for (let v = 8.45; v < 42; v += 2.5) S.blob(GU, spotGround(g, GU, s * v) + 0.7, -s * v, 0.1, 0.36, 0.36, '#7a3028', 8, 4);   // колесо дхармы в каждом пролёте
  }

  // ---------- терраса убосота: голубая стенка, столбики с луковками, лестница с нагами ----------
  const TY = L + 2.3, TU = 14.5, TV = 9;
  S.box(2 * TU, 2.3, 2 * TV, 0, L + 1.15, 0, '#8ebbc6'); S.box(2 * TU + 0.4, 0.25, 2 * TV + 0.4, 0, TY - 0.05, 0, '#e8f0f0'); S.box(2 * TU + 0.3, 0.3, 2 * TV + 0.3, 0, L + 0.15, 0, '#6a98a4');
  S.quad([-TU, TY + 0.09, -TV], [TU, TY + 0.09, -TV], [TU, TY + 0.09, TV], [-TU, TY + 0.09, TV], '#d8d0c0');
  for (const [u, v] of [[-TU, -TV], [-TU, TV], [TU, -TV], [TU, TV], [0, -TV], [0, TV], [-TU, 0], [TU, -3.4], [TU, 3.4], [-7, TV], [7, TV], [-7, -TV], [7, -TV]]) {
    S.box(0.5, 1.1, 0.5, u, TY + 0.55, -v, '#e8f0f0'); S.lathe([[0.3, TY + 1.1], [0.36, TY + 1.4], [0.12, TY + 1.7], [0.01, TY + 2.0]], u, -v, '#8ebbc6', 6);
  }
  templeRail(g, [[TU, 3.4, TU, TV], [TU, TV, -TU, TV], [-TU, TV, -TU, -TV], [-TU, -TV, TU, -TV], [TU, -TV, TU, -3.4]], TY, '#e8f0f0', '#8ebbc6', 0.8);
  const NS = 13, run2 = 6.2 / NS, rise = 2.3 / NS;
  for (let i = 0; i < NS; i++) { const top = TY - (i + 1) * rise + rise, wdt = 3 + 2.2 * (i / NS); S.box(run2, top - L + 0.3, wdt, TU + (i + 0.5) * run2, (top + L - 0.3) / 2, 0, i % 2 ? '#a49a81' : '#b0a68c'); }
  for (const s of [-1, 1]) {                                                                       // наги-перила: волнистое зелёно-золотое тело, поднятая голова с гребнем
    const N = 14, zz = s * 2.15;
    for (let i = 0; i < N; i++) { const t = (i + 0.5) / N, x = TU + t * 6.2, y = TY + 0.5 - t * 2.3 + Math.sin(t * 13) * 0.18; S.box(6.2 / N + 0.05, 0.5, 0.42, x, y, zz + s * t * 0.9, i % 2 ? '#d8b24a' : '#6aa84a', -0.36); }
    S.limb([TU + 6.0, L + 0.5, zz + s * 0.9], [TU + 7.0, L + 1.9, zz + s * 1.0], 0.3, 0.22, '#d8b24a', 6); S.blob(TU + 7.25, L + 2.05, zz + s * 1.0, 0.4, 0.26, 0.24, '#6aa84a', 6, 4);
    for (let k = 0; k < 3; k++) S.limb([TU + 6.8 + k * 0.15, L + 2.1, zz + s * 1.0], [TU + 6.5 + k * 0.2, L + 2.9 - k * 0.2, zz + s * 1.0], 0.1, 0.02, '#dc4a11', 4);
  }
  // убосот: 19 × 7.5 × 7, четыре колонны по торцу, двери и окна в золотых наличниках, синие фронтоны с золотом
  const WH = 7, BY = TY + 0.1;
  S.box(19, WH, 7.5, 0, BY + WH / 2, 0, '#e4e2d6');
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) thaiWindow(S, -7.9 + i * 3.16, BY + 3.3, s * 3.77, 0.95, 2.4, 'z', s);
  for (const e of [-1, 1]) {
    for (const z of [-3.2, -1.1, 1.1, 3.2]) { S.box(0.5, WH, 0.5, e * 11.2, BY + WH / 2, z, T_WHITE); S.box(0.7, 0.45, 0.7, e * 11.2, BY + WH - 0.22, z, T_GOLD); }
    for (const z of [-2.1, 2.1]) thaiWindow(S, e * 9.52, BY + 1.7, z, 1.1, 2.8, 'x', e, '#4a2418');
    S.box(0.2, 1.3, 7.6, e * 11.3, BY + WH - 0.65, 0, T_GOLD_D);
  }
  thaiRoof(S, 0, 0, { len: 24.5, hw: 4.7, y0: BY + WH, y1: BY + 15.2, tiers: 3, step: 3.6, drop: 1.3, skirt: 1.3, tile: ['#5a3a3a', '#413332'], front: '#1f3a6a' });
  for (const e of [-1, 1]) { const x = e * 12.3; S.tri([x, BY + 7.6, -2.6], [x, BY + 7.6, 2.6], [x, BY + 11.6, 0], T_GOLD); S.tri([x + e * 0.02, BY + 8.0, -1.5], [x + e * 0.02, BY + 8.0, 1.5], [x + e * 0.02, BY + 10.4, 0], '#1f3a6a'); }
  // киоты-«сема» вокруг убосота
  for (const [u, v] of [[-18, -12], [-18, 0], [-18, 12], [0, -12.5], [0, 12.5], [12, -12.5], [12, 12.5], [-9, 12.5], [-9, -12.5]]) { S.box(1, 1.2, 1, u, L + 0.6, -v, '#f2ecd8'); S.hip(u, -v, 0.7, 0.7, L + 1.2, 0.1, 0.1, L + 2.3, T_GOLD); const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); posts.push([w.x, w.z]); }
  g.add(templeMesh(S));
  for (const [a, b, c, d] of [[TU, 3.0, TU, TV], [TU, TV, -TU, TV], [-TU, TV, -TU, -TV], [-TU, -TV, TU, -TV], [TU, -TV, TU, -3.0]]) wallLine(g, a, b, c, d);   // с земли на террасу — только по лестнице
  wallBox(g, 0, 0, 23, 7.9);
  for (const s of [-1, 1]) wallLine(g, TU, s * 3.0, TU + 6.4, s * 3.6);                           // по лестнице можно въехать на террасу
  spotPlate(g, TU, TU + 6.3, 0, 2.6, TY + 0.1, L + 0.05, true); spotPlate(g, -TU, TU, 0, TV, TY + 0.1);

  // ---------- павильон мумии: открытый зал 18 × 8, бордовый фронтон с золотой маской Раху ----------
  const M = sculptor(), MU = 38, MV = 27, FL = L + 0.45;                                           // длинная ось — вдоль v, вход — со стороны проезда (v меньше)
  M.box(9, 0.45, 19, MU, L + 0.22, -MV, '#3a3a40');
  for (let i = 0; i < 5; i++) for (const du of [-3.6, 3.6]) { const v = MV - 8.4 + i * 4.2; M.box(0.4, 3.0, 0.4, MU + du, FL + 1.5, -v, T_WHITE); const w = g.localToWorld(new THREE.Vector3(MU + du, 0, -v)); posts.push([w.x, w.z]); }
  for (const du of [-1.3, 1.3]) M.box(0.4, 3.0, 0.4, MU + du, FL + 1.5, -(MV - 8.4), T_WHITE);
  M.box(8.2, 0.3, 18.6, MU, FL + 3.1, -MV, '#703331');                                             // красный потолок
  M.gable(MU, -MV, 19.6, 5.2, FL + 3.2, FL + 6.4, '#8a4a44', '#472525', 'z'); M.gable(MU, -MV, 14, 3.6, FL + 4.6, FL + 7.6, '#96524a', '#472525', 'z');
  for (const e of [-1, 1]) {
    const zz = -(MV + e * 9.8);
    for (const s of [-1, 1]) M.rod([MU + s * 5.2, FL + 3.2, zz], [MU, FL + 6.4, zz], 0.26, T_GOLD);
    M.limb([MU, FL + 6.4, zz], [MU, FL + 7.9, zz + e * -0.6], 0.16, 0.03, T_GOLD, 5);
    for (let i = 0; i < 9; i++) M.blob(MU - 4.4 + i * 1.1, FL + 3.1, zz, 0.22, 0.22, 0.1, T_GOLD, 5, 3);   // золотые диски по карнизу
  }
  { const zz = -(MV - 9.85), my = FL + 4.5;                                                         // золочёный медальон в лучах на фронтоне со стороны входа
    M.blob(MU, my, zz, 0.9, 0.9, 0.14, T_GOLD_L, 10, 4); M.blob(MU, my, zz + 0.1, 0.5, 0.5, 0.12, '#8b2a34', 8, 3);
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; M.limb([MU + Math.cos(a) * 0.9, my + Math.sin(a) * 0.9, zz], [MU + Math.cos(a) * 1.5, my + Math.sin(a) * 1.5, zz], 0.14, 0.03, T_GOLD, 4); }
    for (const s of [-1, 1]) M.limb([MU + s * 2.0, FL + 3.9, zz], [MU + s * 3.7, FL + 3.7, zz], 0.2, 0.06, T_GOLD, 5); }
  // трон с витриной: ступенчатый постамент, стеклянный ящик, монах в оранжевой рясе и тёмных очках, золочёная арка, красно-золотой веер
  const TVv = MV + 6.2, tz = -TVv;
  M.box(2.6, 0.5, 2.6, MU, FL + 0.25, tz, '#8b2a34'); M.box(2.2, 0.5, 2.2, MU, FL + 0.75, tz, T_GOLD); M.box(1.8, 0.45, 1.8, MU, FL + 1.2, tz, '#8b2a34');
  M.blob(MU, FL + 1.75, tz, 0.42, 0.3, 0.38, '#d07041', 7, 3); M.lathe([[0.3, FL + 1.8], [0.27, FL + 2.3], [0.14, FL + 2.45]], MU, tz, '#d07041', 7); M.blob(MU, FL + 2.62, tz, 0.16, 0.19, 0.16, '#6a5a4a', 6, 4);
  M.box(0.3, 0.07, 0.06, MU, FL + 2.66, tz + 0.15, '#0a0a0c');                                     // тёмные очки
  for (const [du, dz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) M.box(0.06, 1.7, 0.06, MU + du, FL + 2.3, tz + dz, T_GOLD);
  M.box(1.2, 0.06, 1.2, MU, FL + 3.15, tz, T_GOLD); M.box(1.12, 1.66, 0.03, MU, FL + 2.3, tz - 0.55, '#bcd4dc');
  for (const s of [-1, 1]) M.box(0.16, 2.6, 0.16, MU + s * 0.85, FL + 2.7, tz + 0.1, T_GOLD);
  M.hip(MU, tz + 0.1, 1.0, 0.3, FL + 4.0, 0.1, 0.05, FL + 4.9, T_GOLD); M.blob(MU, FL + 2.6, tz - 1.1, 1.5, 1.5, 0.12, '#a8302a', 12, 4);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; M.limb([MU + Math.cos(a) * 0.4, FL + 2.6 + Math.sin(a) * 0.4, tz - 1.0], [MU + Math.cos(a) * 1.45, FL + 2.6 + Math.sin(a) * 1.45, tz - 1.0], 0.07, 0.04, T_GOLD, 4); }
  M.blob(MU, FL + 0.55, tz + 2.2, 0.3, 0.2, 0.34, T_GOLD, 6, 3); M.lathe([[0.24, FL + 0.6], [0.2, FL + 1.1], [0.1, FL + 1.2]], MU, tz + 2.2, T_GOLD, 6); M.blob(MU, FL + 1.34, tz + 2.2, 0.13, 0.15, 0.13, T_GOLD, 6, 3);   // золотая статуя монаха
  M.box(2.4, 0.5, 0.8, MU, FL + 0.25, tz + 3.2, '#c8302a');                                        // стол с подношениями
  for (let i = 0; i < 5; i++) M.box(0.22, 0.3, 0.22, MU - 0.9 + i * 0.45, FL + 0.65, tz + 3.2, ['#e8c82a', '#f2f2ee', '#e88a2a'][i % 3]);
  // фонарные столбы с птицами перед входом
  for (const s of [-1, 1]) templeProp(g, MU + s * 5.2, MV - 11, (F) => {
    F.tube(0, L, L + 3.6, 0, 0.16, 0.12, '#8a3a2a', 6); F.blob(0, L + 3.9, 0, 0.36, 0.26, 0.2, '#8a3a2a', 5, 3); F.limb([0, L + 3.9, 0], [0.1, L + 4.6, -0.3], 0.1, 0.05, '#8a3a2a', 4);
  }, { color: '#8a3a2a', mat: 'wood', r: 0.2 });
  g.add(templeMesh(M));
  wallBox(g, MU, TVv, 2.6, 2.6); wallLine(g, MU - 4.3, MV + 9.3, MU + 4.3, MV + 9.3);

  // ---------- большой зал с красной крышей, статуи тхеваду, низкая белая стенка, домик духов ----------
  const E = sculptor();
  E.box(22, 4.2, 11, -2, L + 2.1, -30, '#e8e0d0'); for (let i = 0; i < 6; i++) E.box(1.6, 2.2, 0.1, -10.5 + i * 3.4, L + 2.0, -24.45, '#5a3a22');
  E.gable(-2, -30, 24, 7.2, L + 4.2, L + 7.4, '#a8453a', '#e8e0d0', 'x'); E.gable(-2, -30, 17, 4.8, L + 5.8, L + 8.6, '#b3573d', T_GOLD_D, 'x');
  for (const s of [-1, 1]) {                                                                       // тхеваду на тумбах: белая коленопреклонённая фигура, ладони сложены
    const u = 22, z = -s * 15;
    E.box(1.6, 1.2, 1.2, u, L + 0.6, z, T_WHITE); E.blob(u, L + 1.6, z, 0.6, 0.42, 0.5, T_WHITE, 7, 3); E.lathe([[0.4, L + 1.8], [0.36, L + 2.5], [0.18, L + 2.7]], u, z, T_WHITE, 7);
    E.blob(u + 0.05, L + 2.95, z, 0.22, 0.26, 0.22, T_WHITE, 6, 4); E.lathe([[0.2, L + 3.15], [0.12, L + 3.4], [0.01, L + 3.8]], u, z, T_WHITE, 6); E.blob(u + 0.36, L + 2.35, z, 0.12, 0.26, 0.12, T_WHITE, 5, 3);
    wallBox(g, u, s * 15, 1.6, 1.2);
  }
  spiritHouse(E, GU - 5, -11, L, true);
  g.add(templeMesh(E));
  wallBox(g, -2, 30, 22, 11);
  armFence(buildFence(g, [[22, 14.4, 22, 6], [22, -6, 22, -14.4], [22, 15.6, 50, 17.5], [22, -15.6, 50, -17.5]], { step: 2.4, y0: L, post: [0.3, 1.0, T_WHITE], slab: [0, 0.8, 0.16, '#f2ecdc'], kind: 'parapet', loss: 0.05, mat: 'stone' }));
  templePlants(g, [[30, -30, 'coconut'], [46, -34, 'coconut'], [-20, -22, 'coconut'], [-26, 14, 'areca'], [-28, -6, 'fan'], [14, 34, 'coconut'], [52, 36, 'areca'], [24, 20, 'bush'], [24, -20, 'bush'], [-30, 36, 'coconut'], [10, -18, 'bush']]);
  templeKeepOut(g, -38, RD - 1, -44, 44); templeKeepOut(g, RD - 1.5, RD + 2.5, -7, 7);   // и столбы у въезда не ставятся
  parkVehicle(g, parkedCar(2), GU - 8, -13, 'v+', spotGround(g, GU - 8, -13) + 0.07);
  scooterRow(g, 9, 3, GU - 7, 12.5, 0.85, 0, -Math.PI / 2, spotGround(g, GU - 6, 12.5) + 0.07);
  spotPlace('ВАТ КХУНАРАМ', g, GU - 12, 0, -1, 0);
}

// =====================================================================================================
// ПАГОДА КХАО ХУА ДЖУК — золотая чеди на охристом здании-основании, на вершине отдельного холма над аэропортом.
// =====================================================================================================
function buildHuaJook() {
  const g = spotGroup('hua_jook'), sp = g.userData.spot, L = sp.y - 0.15, S = sculptor();   // вершина чуть покатая: постройки сидят по её нижнему краю
  const CU = -6, HW = 8.5, HV = 8, WALL = 4.6, TOP = L + 1.0 + WALL;                               // здание 17 × 16 на подиуме 1 м
  { const Pv = sculptor(); drape(Pv, g, -22, 26, -19, 19, (i, j) => (i + j) % 2 ? '#a29d9a' : '#9c9793'); g.add(Pv.mesh()); }   // площадка из мытого бетона
  padBlend(g, 26, 1, -7.5, 7.5, '#a29d9a');                                                        // дорога приводит на площадку — переход плавный
  S.box(2 * HW + 5, 1.0, 2 * HV + 5, CU, L + 0.5, 0, '#989991'); S.box(2 * HW, WALL, 2 * HV, CU, L + 1.0 + WALL / 2, 0, '#cfad70'); S.box(2 * HW + 0.1, 0.6, 2 * HV + 0.1, CU, L + 1.3, 0, '#d6d6cd');
  for (let i = 0; i < 5; i++) {                                                                    // проёмы в золотых наличниках; в середине фасада — дверь
    for (const s of [-1, 1]) { thaiWindow(S, CU - 6 + i * 3, L + 3.1, s * (HV + 0.02), 1.1, 1.8, 'z', s, '#30150e'); if (i !== 2) thaiWindow(S, CU + s * (HW + 0.02), L + 3.1, -5.6 + i * 2.8, 1.1, 1.8, 'x', s, '#30150e'); }
    for (const s of [-1, 1]) S.box(0.3, 0.5, 0.3, CU - 7.5 + i * 3.75, TOP - 0.4, s * (HV + 0.15), T_GOLD);
  }
  thaiWindow(S, CU + HW + 0.02, L + 2.5, 0, 1.3, 2.6, 'x', 1, '#30150e');
  S.box(2 * HW + 1.4, 0.4, 2 * HV + 1.4, CU, TOP + 0.2, 0, '#d6d6cd');                              // карниз-терраса
  for (const [a, b, c, d] of [[-HW, -HV, HW, -HV], [HW, -HV, HW, HV], [HW, HV, -HW, HV], [-HW, HV, -HW, -HV]]) {   // белая балюстрада из пузатых балясин
    const n = 12; for (let i = 0; i <= n; i++) S.lathe([[0.14, TOP + 0.4], [0.24, TOP + 0.8], [0.12, TOP + 1.2]], CU + a + (c - a) * i / n + Math.sign(a + c) * 0.5, b + (d - b) * i / n + Math.sign(b + d) * 0.5, '#e6e6de', 5);
    S.rod([CU + a + Math.sign(a + c) * 0.5, TOP + 1.3, b + Math.sign(b + d) * 0.5], [CU + c + Math.sign(a + c) * 0.5, TOP + 1.3, d + Math.sign(b + d) * 0.5], 0.22, '#e6e6de');
  }
  S.box(11, 0.7, 11, CU, TOP + 0.75, 0, '#e6dcc0'); S.box(9.4, 0.7, 9.4, CU, TOP + 1.45, 0, T_GOLD);   // двухступенчатый цоколь чеди
  chedi(S, CU, TOP + 1.8, 0, 4.2, 15.5, 14);
  for (const du of [-1, 1]) for (const dv of [-1, 1]) chedi(S, CU + du * (HW - 1), TOP + 0.4, dv * (HV - 1), 0.42, 3.0, 6);
  S.box(0.5, 2.4, 2.6, CU + 5.6, TOP + 1.6, 0, '#f2e8d0'); S.box(0.1, 1.7, 1.2, CU + 5.88, TOP + 1.4, 0, '#30150e'); S.tri([CU + 5.9, TOP + 2.8, -1.7], [CU + 5.9, TOP + 2.8, 1.7], [CU + 5.9, TOP + 4.8, 0], '#b8302a'); S.limb([CU + 5.9, TOP + 4.8, 0], [CU + 6.3, TOP + 5.8, 0], 0.1, 0.02, T_GOLD, 4);   // ниша с фронтоном у чеди
  // парадная лестница с бордовыми балясинами, белые статуи у двери
  for (let i = 0; i < 6; i++) S.box(0.5, 1.0 - i * 0.167, 4, CU + HW + 2.75 + i * 0.5, L + (1.0 - i * 0.167) / 2, 0, i % 2 ? '#a29d9a' : '#989991');
  for (const s of [-1, 1]) { S.rod([CU + HW + 2.6, L + 1.9, s * 2.1], [CU + HW + 5.6, L + 0.95, s * 2.1], 0.14, '#d6d6cd'); for (let i = 0; i < 5; i++) S.box(0.14, 0.8, 0.14, CU + HW + 2.8 + i * 0.7, L + 1.45 - i * 0.22, s * 2.1, '#6a2a2a');
    S.lathe([[0.3, L + 1.0], [0.26, L + 2.0], [0.14, L + 2.2]], CU + HW + 1.5, s * 1.9, T_WHITE, 6); S.blob(CU + HW + 1.5, L + 2.4, s * 1.9, 0.16, 0.19, 0.16, T_WHITE, 5, 3); }
  // флагштоки с жёлтыми буддийскими флагами вдоль обходной дорожки
  [[CU + 13, 12], [CU + 13, -12], [CU - 12, 12], [CU - 12, -12], [22, 16], [22, -16]].forEach(([u, v], i) => templeProp(g, u, v, (F) => {
    F.tube(0, L, L + 6.5, 0, 0.07, 0.04, '#d8d8d4', 5); F.box(1.3, 0.8, 0.03, 0.7, L + 6.0, 0, i % 2 ? '#f2c81e' : '#c8302a');
  }, { r: 0.15 }));
  // две монастырские постройки под красной черепицей и решётчатая антенная мачта
  for (const [u, v, a, b] of [[-17, 12, 9, 6], [-17, -12, 8, 6]]) { S.box(a, 3.6, b, u, L + 1.2, -v, '#efe6d2'); S.gable(u, -v, a + 1.2, b / 2 + 0.8, L + 3, L + 5.0, '#b3573d', '#efe6d2', 'x'); S.box(1.0, 2.0, 0.1, u + 1, L + 1.0, -v + (v > 0 ? b / 2 : -b / 2), '#30150e'); wallBox(g, u, v, a, b); }
  { const mu = -20, mv = 0; for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) S.rod([mu + x * 1.1, L - 0.6, mv + z * 1.1], [mu + x * 0.25, L + 15, mv + z * 0.25], 0.14, '#8e9296');
    for (let y = 2.5; y < 15; y += 2.5) { const w = 1.1 - 0.85 * y / 15; S.box(w * 2, 0.08, 0.08, mu, L + y, mv + w, '#8e9296'); S.box(w * 2, 0.08, 0.08, mu, L + y, mv - w, '#8e9296'); S.box(0.08, 0.08, w * 2, mu + w, L + y, mv, '#8e9296'); S.box(0.08, 0.08, w * 2, mu - w, L + y, mv, '#8e9296'); }
    S.box(0.5, 1.4, 0.2, mu + 0.4, L + 14, mv, '#e8e8e4'); wallBox(g, mu, mv, 2.4, 2.4); }
  g.add(spotSign(S, 21, 13, L, 'KHAO HUA JOOK'));
  g.add(templeMesh(S));
  wallBox(g, CU, 0, 2 * HW, 2 * HV);
  templePlants(g, [[-24, 22, 'coconut'], [-26, -20, 'coconut'], [4, 23, 'areca'], [6, -23, 'coconut'], [26, 22, 'fan'], [28, -21, 'coconut'], [-30, 4, 'coconut'], [14, 20, 'bush'], [14, -20, 'bush']]);
  templeKeepOut(g, -26, 30, -22, 22);
  parkVehicle(g, parkedCar(7), 15, -15.5, 'u+', spotGround(g, 15, -15.5) + 0.07);
  scooterRow(g, 2, 2, 13, 15.5, 0.85, 0, -Math.PI / 2, spotGround(g, 13.5, 15.5) + 0.07);
  spotPlace('ПАГОДА КХАО ХУА ДЖУК', g, 20, 0, -1, 0);
}

// =====================================================================================================
// ПАГОДА ЛАЕМ СОР — золотисто-жёлтая ступа в мелкой плитке на гранитной платформе у самой воды: три уступа с нишами
// и золотыми Буддами, угловые башенки, «луковица» в лотосовых лепестках, гранёный конус, шпиль. Вход стерегут два якши.
// =====================================================================================================
function buildLaemSor() {
  const g = spotGroup('laem_sor'), sp = g.userData.spot, L = sp.y, S = sculptor();
  const TILE = ['#c4ab57', '#b89c48', '#a6873c'], tile = (i, k) => TILE[(i + k) % 3];
  { const Pv = sculptor(); drape(Pv, g, -22, 36, -24, 24, (i, j) => (i + j) % 2 ? '#a39f90' : '#9d998a'); g.add(Pv.mesh()); }   // бетонная площадка
  padBlend(g, 36, 1, -7.5, 7.5, '#a39f90');                                                        // дорога приводит на площадку — переход плавный
  S.box(18, 0.5, 18, 0, L + 0.25, 0, '#8f8f8b'); S.box(12.4, 0.7, 12.4, 0, L + 0.85, 0, '#7c7e7c');   // гранитная платформа в два яруса
  for (let i = 0; i < 3; i++) S.box(0.5, 0.5 - i * 0.167, 4, 9.25 + i * 0.5, L + (0.5 - i * 0.167) / 2, 0, '#8f8f8b');
  for (let i = 0; i < 4; i++) S.box(0.4, 0.7 - i * 0.175, 2.6, 6.4 + i * 0.4, L + 0.5 + (0.7 - i * 0.175) / 2, 0, '#7c7e7c');
  const Y0 = L + 1.2;
  // уступ: квадрат с «переломленными» углами (крест из двух коробок), валики, портики с острым фронтоном, ниши с Буддами, башенки
  const tier = (y, w, h, standing) => {
    S.box(w, h, w * 0.8, 0, y + h / 2, 0, TILE[0]); S.box(w * 0.8, h, w, 0, y + h / 2, 0, TILE[1]);
    S.box(w + 0.3, 0.25, w * 0.8 + 0.3, 0, y + 0.12, 0, TILE[2]); S.box(w * 0.8 + 0.3, 0.25, w + 0.3, 0, y + 0.12, 0, TILE[2]);
    S.box(w + 0.3, 0.3, w * 0.8 + 0.3, 0, y + h - 0.15, 0, TILE[2]); S.box(w * 0.8 + 0.3, 0.3, w + 0.3, 0, y + h - 0.15, 0, TILE[2]);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const px = dx * (w / 2 + 0.25), pz = dz * (w / 2 + 0.25), pw = w * 0.22;
      S.box(dx ? 0.7 : pw, h * 0.72, dz ? 0.7 : pw, px, y + h * 0.36, pz, TILE[1]);                // портик
      S.box(dx ? 0.1 : pw * 0.5, h * 0.5, dz ? 0.1 : pw * 0.5, px + dx * 0.33, y + h * 0.27, pz + dz * 0.33, dx > 0 && !standing ? '#16120e' : '#6e5f1d');   // проём (открытая дверь — только на фасаде)
      const a = (t, yy) => [px + dx * 0.36 + (dz ? t : 0), yy, pz + dz * 0.36 + (dx ? t : 0)];
      S.tri(a(-pw * 0.62, y + h * 0.72), a(pw * 0.62, y + h * 0.72), a(0, y + h * 0.72 + pw * 0.95), TILE[0]); S.tube(px, y + h * 0.72 + pw * 0.8, y + h * 0.72 + pw * 0.8 + 1.5, pz, 0.22, 0.01, '#dfc071', 5);
      for (const s of [-1, 1]) {                                                                   // ниши с Буддами по сторонам портика
        const nx = px - dx * 0.2 + (dz ? s * w * 0.27 : 0), nz = pz - dz * 0.2 + (dx ? s * w * 0.27 : 0);
        S.box(dx ? 0.2 : 1.1, h * 0.5, dz ? 0.2 : 1.1, nx, y + h * 0.42, nz, '#6e5f1d');
        if (standing) { S.lathe([[0.2, y + h * 0.2], [0.18, y + h * 0.2 + 1.2], [0.1, y + h * 0.2 + 1.35]], nx + dx * 0.25, nz + dz * 0.25, '#d3b740', 6); S.blob(nx + dx * 0.25, y + h * 0.2 + 1.5, nz + dz * 0.25, 0.12, 0.15, 0.12, '#f5ea8f', 5, 3); }
        else smallBuddha(S, nx + dx * 0.25, y + h * 0.2, nz + dz * 0.25, 1.0);
      }
    }
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) chedi(S, dx * (w * 0.4 + 0.25), y + h, dz * (w * 0.4 + 0.25), 0.42, 2.5, 6, ['#dfc071', '#c4ab57', '#a6873c']);   // угловые башенки
  };
  S.box(10.8, 0.5, 10.8 * 0.8, 0, Y0 + 0.25, 0, TILE[2]); S.box(10.8 * 0.8, 0.5, 10.8, 0, Y0 + 0.25, 0, TILE[2]);   // цоколь
  tier(Y0 + 0.5, 10, 4, false); tier(Y0 + 4.5, 7, 3, true);
  S.box(5.6, 1.0, 5.6, 0, Y0 + 8.0, 0, TILE[1]); for (const dx of [-1, 1]) for (const dz of [-1, 1]) chedi(S, dx * 2.5, Y0 + 8.5, dz * 2.5, 0.34, 2.0, 6, ['#dfc071', '#c4ab57', '#a6873c']);
  S.lathe([[2.2, Y0 + 8.5], [2.7, Y0 + 9.4], [2.6, Y0 + 10.4], [2.0, Y0 + 11.5]], 0, 0, (i, k) => (i + k) % 2 ? '#d0b862' : '#b89c48', 16);   // «луковица» в лепестках
  S.lathe([[2.1, Y0 + 11.5], [2.1, Y0 + 11.9], [1.9, Y0 + 11.9], [1.9, Y0 + 12.3], [1.7, Y0 + 12.3], [0.55, Y0 + 14.6]], 0, 0, (i, k) => TILE[(i + k) % 2], 8);   // гранёный конус
  for (let i = 0; i < 5; i++) S.lathe([[0.62 - i * 0.08, Y0 + 14.6 + i * 0.3], [0.7 - i * 0.08, Y0 + 14.72 + i * 0.3], [0.56 - i * 0.08, Y0 + 14.9 + i * 0.3]], 0, 0, i % 2 ? '#dfc071' : '#c4ab57', 8);
  S.tube(0, Y0 + 16.1, Y0 + 18.6, 0, 0.16, 0.02, '#dfc071', 6); S.blob(0, Y0 + 18.0, 0, 0.3, 0.06, 0.3, '#dfc071', 6, 3);
  // якши у входа
  yaksha(S, 7.4, L + 0.5, 2.6, 3.4, '#2e7a6a'); yaksha(S, 7.4, L + 0.5, -2.6, 3.4, '#2e7a6a', ['#1f4fa0', '#c8302a', '#e8c82a']);
  // два павильона под оранжевой черепицей с синими стенами, фонарный столб, щит
  for (const s of [-1, 1]) { const u = 24, z = -s * 17; S.box(9, 0.3, 6, u, L + 0.15, z, '#b9b4a8'); S.box(8, 3, 5, u, L + 1.8, z, '#1f3f7f'); for (let i = 0; i < 3; i++) S.box(1.4, 1.5, 0.1, u - 2.6 + i * 2.6, L + 2.0, z + s * 2.52, '#f2ecd8');
    S.hip(u, z, 5.4, 3.9, L + 3.2, 2.6, 0.6, L + 5.0, (i) => i % 2 ? '#e5a47e' : '#ba8359'); wallBox(g, u, s * 17, 8, 5); }
  S.tube(14, L, L + 9, 20, 0.14, 0.09, '#8e9296', 6); S.box(2.4, 0.1, 0.1, 13, L + 8.9, 20, '#8e9296'); S.box(0.8, 0.14, 0.3, 12, L + 8.8, 20, '#e8e8e4');
  g.add(spotSign(S, 31, -8, L, 'LAEM SOR'));
  g.add(templeMesh(S));
  wallBox(g, 0, 0, 12.4, 12.4); wallBox(g, 7.4, 2.6, 1.2, 1.4); wallBox(g, 7.4, -2.6, 1.2, 1.4);
  { const w = g.localToWorld(new THREE.Vector3(14, 0, 20)); posts.push([w.x, w.z]); }
  // ограждение у моря: белые бетонные столбики с красно-коричневыми перилами
  armFence(buildFence(g, [[30, 23.5, -21.5, 23.5], [-21.5, 23.5, -21.5, -23.5], [-21.5, -23.5, 30, -23.5]], { step: 2.5, y0: L, post: [0.3, 1.0, T_WHITE], bars: [[0.85, 0.1, '#8a4a34'], [0.45, 0.1, '#8a4a34']], kind: 'parapet', loss: 0.05, mat: 'stone' }));
  templePlants(g, [[34, 26, 'coconut'], [20, 28, 'coconut'], [4, 28, 'areca'], [34, -27, 'coconut'], [44, 14, 'coconut'], [46, -12, 'fan'], [12, -28, 'coconut'], [40, 28, 'bush'], [40, -28, 'bush']]);
  templeKeepOut(g, -26, 38, -27, 27);
  parkVehicle(g, parkedCar(5), 31, 7, 'u-', spotGround(g, 31, 7) + 0.07);
  scooterRow(g, 4, 3, 30.5, -6.5, 0.85, 0, Math.PI / 2, spotGround(g, 31, -6.5) + 0.07);
  spotPlace('ПАГОДА ЛАЕМ СОР', g, 30, 0, -1, 0);
}

function buildTemples() {
  const SP = IS.spots || {};
  if (SP.plai_laem) buildPlaiLaem();
  if (SP.khunaram) buildKhunaram();
  if (SP.hua_jook) buildHuaJook();
  if (SP.laem_sor) buildLaemSor();
}
