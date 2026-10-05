// Особые магазины острова — refs/SHOPS_TZ.md (ресерч-сессия, список выбрал Влад): три музыкальных магазина, портные
// «под Армани», тату-салоны — в секциях шопхаусов; воздушные змеи у обочины; прокат скутеров и прокат Harley под навесами.
// Бутики Рыбацкой деревни — в towns.js (fvRow). Книжный Coco Hut Влад делать не стал.
// Лавка в ряду: shophouseRow (towns.js) спрашивает specialAt — не стоит ли секция у точки особой лавки; если да, обычный
// первый этаж и вывеска уходят в пустой сборщик (ряд случайностей не меняется), а specialFront рисует свой. Где рядов
// рядом нет (портные, Rockestra, Samui Guitar Shop, Starcat), buildSpecialShops ставит у дороги короткий ряд и отдаёт
// лавке нужную секцию. Мелкое (змеи, щиты, мотоциклы) — разрушаемое, дома и навесы — как в рядах; вывески — по-английски.

const SPECIAL = { list: null };
function specialList() {
  if (SPECIAL.list) return SPECIAL.list;
  const at = (lat, lon) => pierXZ(lat, lon);
  const near = (name) => { const p = LANDMARKS.find((q) => q.name === name); return p ? [p.x, p.z] : null; };
  const vill = (name) => { const v = (IS.places || []).find((q) => q.name === name); return v ? [v.x, v.z] : null; };
  SPECIAL.list = [
    { kind: 'music', place: 'NATHON GUITAR SHOP', name: 'GUITAR SHOP', board: '#c8302a', ink: '#f8f4e6', p: at(9.53625, 99.93591), row: true, seed: 1, style: 'NATHON_STYLE' },
    { kind: 'music', place: 'ROCKESTRA MUSIC', name: 'ROCKESTRA', sub: 'MUSIC & REHEARSAL', board: '#1c1c1e', ink: '#f2c81e', p: vill('Baan Mae Nam'), seed: 2, style: 'NATHON_STYLE' },
    { kind: 'music', place: 'SAMUI GUITAR SHOP', name: 'SAMUI GUITAR', sub: 'SHOP', board: '#1f4fa0', ink: '#f8f4e6', p: near('7-ELEVEN НА МУАНГ 1'), seed: 3, style: 'HUA_STYLE' },
    { kind: 'tailor', place: 'ARMANI RICHY TAILOR', name: 'ARMANI RICHY', sub: 'INTERNATIONAL SUITS', glass: 'ARMANI', p: at(9.45397, 100.03766), group: 'lamai', seed: 4, style: 'LAMAI_STYLE' },
    { kind: 'tailor', place: 'ROYAL FASHION TAILOR', name: 'ROYAL FASHION', sub: 'CUSTOM TAILOR', glass: 'VERSACE', p: at(9.45397, 100.03766), group: 'lamai', seed: 5, style: 'LAMAI_STYLE' },
    { kind: 'tattoo', place: 'HOME ART TATTOO', name: 'HOME ART', p: at(9.46582, 100.04522), row: true, seed: 6, style: 'LAMAI_STYLE' },
    { kind: 'tattoo', place: 'STARCAT TATTOO', name: 'STARCAT', p: at(9.53084, 100.06167), row: true, r: 70, seed: 7, style: 'CHAWENG_STYLE' },
  ].filter((q) => q.p);
  return SPECIAL.list;
}
// секция x ряда lot (i — её номер): особая лавка, если она тут. Первая секция ряда ближе 30 м (или r) к точке лавки забирает её себе
// (или та, что отдана лавке нарочно: forceLot / forceI); ключ — мировая точка фасада, он же находит лавку при отложенной постройке
function specialAt(lot, x, F, i) {
  const L = specialList(), w = lot.g.localToWorld(new THREE.Vector3(x, 0, F)), key = Math.round(w.x) + ',' + Math.round(w.z);
  let sp = L.find((q) => q.key === key);
  if (sp) return sp;
  sp = L.find((q) => !q.key && (q.forceLot ? q.forceLot === lot && q.forceI === i : q.row && Math.hypot(q.p[0] - w.x, q.p[1] - w.z) < (q.r || 30)));
  if (!sp) return null;
  sp.key = key; sp.at = [w.x, w.z, lot.fx, lot.fz];                                         // (точка фасада и куда он смотрит — для проверки кадрами)
  const a = lot.g.localToWorld(new THREE.Vector3(x - 6, 0, F + lot.FR - 2.6)), b = lot.g.localToWorld(new THREE.Vector3(x - 5, 0, F + lot.FR - 2.6));
  LANDMARKS.push({ name: sp.place, x: a.x, z: a.z, heading: Math.atan2(-(b.x - a.x), -(b.z - a.z)) });   // переход — на улицу чуть раньше лавки, носом вдоль улицы
  return sp;
}
// вывеска лавки над входом: доска, название (и строка помельче), ночью светится
function specialBoard(S, Gl, x, wd, F, P, sp, board, ink) {
  const two = !!sp.sub, h = two ? 0.95 : 0.72, yc = P + 2.98 + (two ? 0.12 : 0), bw = wd - 0.4;
  S.box(bw, h, 0.12, x, yc, F + 0.08, board); Gl.box(bw, h, 0.02, x, yc, F + 0.15, board);
  const px = Math.min(two ? 0.085 : 0.1, (bw - 0.5) / hudWidth(hudText(sp.name))), ty = two ? yc + h / 2 - 0.08 : yc + px * 2.5;
  for (const [T, z] of [[S, F + 0.16], [Gl, F + 0.18]]) {
    T.text(sp.name, x, ty, z, px, ink, 1);
    if (two) { const ps = Math.min(0.035, (bw - 0.5) / hudWidth(hudText(sp.sub))); T.text(sp.sub, x, ty - px * 5 - 0.08, z, ps, ink, 1); }
  }
}
// первый этаж особой лавки (оси ряда: x — вдоль улицы, +Z — к улице, P — пол)
function specialFront(sp, S, Gl, lot, x, wd, F, P) {
  const wo = wd - 0.7;
  if (sp.kind === 'music') {                                                                  // гитары рядами на стене, барабаны, комбики, прилавок
    S.box(wo, 2.5, 0.1, x, P + 1.25, F + 0.01, '#2a2220'); Gl.box(wo - 0.1, 2.3, 0.02, x, P + 1.3, F + 0.04, '#ffe0a8');
    const GC = ['#c8945a', '#b8302a', '#1c1c1e', '#d8783a', '#e8d8b8', '#2a4a8a', '#7a2a1a'], ng = Math.max(3, Math.floor(wo / 0.5));
    for (let r = 0; r < 2; r++) for (let k = 0; k < ng; k++) {
      const gx = x - wo / 2 + 0.3 + k * (wo - 0.6) / (ng - 1), gy = P + 0.5 + r * 1.0, c = GC[(k * 3 + r * 5 + sp.seed) % GC.length];
      S.box(0.32, 0.3, 0.06, gx, gy, F + 0.08, c); S.box(0.24, 0.18, 0.06, gx, gy + 0.22, F + 0.08, c); S.box(0.08, 0.08, 0.07, gx, gy + 0.04, F + 0.1, '#1a1a1a');   // корпус и розетка
      S.box(0.05, 0.38, 0.05, gx, gy + 0.5, F + 0.09, '#5a3a22'); S.box(0.09, 0.12, 0.05, gx, gy + 0.74, F + 0.09, '#2a1a10');                                   // гриф и голова
    }
    const dx = x - wo / 2 + 0.75;                                                              // барабанная установка
    S.limb([dx, P + 0.32, F + 0.35], [dx, P + 0.32, F + 0.72], 0.3, 0.3, '#b8302a', 10); S.limb([dx, P + 0.32, F + 0.72], [dx, P + 0.32, F + 0.74], 0.28, 0.28, '#f2f2ee', 10);
    for (const [ox, h, c] of [[-0.3, 0.78, '#b8302a'], [0.3, 0.78, '#b8302a'], [0.55, 0.6, '#d8dade']]) S.tube(dx + ox, P + h - 0.14, P + h, F + 0.62, 0.15, 0.15, c, 8);
    for (const ox of [-0.5, 0.65]) { S.box(0.03, 1.1, 0.03, dx + ox, P + 0.55, F + 0.55, '#8e9296'); S.tube(dx + ox, P + 1.1, P + 1.12, F + 0.55, 0.26, 0.26, '#d8b24a', 10); }
    for (let k = 0; k < 2; k++) { const ax = x + 0.2 + k * 0.6; S.box(0.52, 0.55, 0.3, ax, P + 0.28, F + 0.3, '#1c1c1e'); S.box(0.42, 0.32, 0.02, ax, P + 0.24, F + 0.46, '#5a5a5c'); S.box(0.42, 0.05, 0.02, ax, P + 0.48, F + 0.46, '#d8b24a'); }   // комбики
    S.box(1.1, 0.85, 0.45, x + wo / 2 - 0.6, P + 0.43, F + 0.32, '#9ab8c8'); S.box(1.14, 0.05, 0.5, x + wo / 2 - 0.6, P + 0.87, F + 0.32, '#c8ccd0');   // стеклянный прилавок
    S.box(wo + 0.1, 0.2, 0.22, x, P + 2.42, F + 0.12, '#a9adb2');                              // короб рольставни
    specialBoard(S, Gl, x, wd, F, P, sp, sp.board, sp.ink);
  } else if (sp.kind === 'tailor') {                                                         // витрина во весь этаж: манекены в костюмах, цены на стекле
    S.box(wo + 0.2, 2.7, 0.08, x, P + 1.4, F + 0.01, '#ece6d8'); Gl.box(wo, 2.5, 0.02, x, P + 1.4, F + 0.05, '#fff4dc');
    const nm = Math.max(2, Math.round(wo / 1.0)), SUIT = ['#1c2433', '#3a3e44', '#2a2a2c', '#4a4038', '#1e2a44'];
    for (let k = 0; k < nm; k++) {
      const mx = x - wo / 2 + (k + 0.5) * wo / nm, suit = SUIT[(k + sp.seed) % SUIT.length], z = F + 0.3;
      S.box(0.45, 0.05, 0.32, mx, P + 0.03, z, '#c8ccd0'); S.box(0.05, 0.12, 0.05, mx, P + 0.1, z, '#c8ccd0');
      S.box(0.34, 0.95, 0.2, mx, P + 0.62, z, suit); S.box(0.5, 0.72, 0.26, mx, P + 1.45, z, suit);                                 // брюки, пиджак
      for (const s of [-1, 1]) S.box(0.1, 0.62, 0.18, mx + s * 0.3, P + 1.42, z, suit);
      S.box(0.13, 0.4, 0.02, mx, P + 1.6, z + 0.14, '#f4f4f0'); S.box(0.05, 0.34, 0.02, mx, P + 1.57, z + 0.155, ['#b8302a', '#2a4a8a', '#d8b24a'][k % 3]);   // рубашка, галстук
      S.box(0.09, 0.1, 0.09, mx, P + 1.86, z, '#e8d0b8'); S.blob(mx, P + 2.03, z, 0.11, 0.14, 0.11, '#e8d0b8', 7, 4);
    }
    const FR = '#c8b070';                                                                     // рама стекла
    for (const d of [-0.5, -0.17, 0.17, 0.5]) S.box(0.07, 2.7, 0.07, x + d * wo, P + 1.4, F + 0.6, FR);
    S.box(wo + 0.07, 0.08, 0.07, x, P + 2.75, F + 0.6, FR); S.box(wo + 0.07, 0.12, 0.07, x, P + 0.08, F + 0.6, FR); S.box(wo + 0.07, 0.04, 0.6, x, P + 2.79, F + 0.3, FR);
    { const cx = x - wo / 2 + 0.62; S.box(0.86, 1.0, 0.02, cx, P + 0.9, F + 0.64, '#f8f8f2');                                   // табличка с ценой
      [['1 SUIT', 0.032], ['1 SHIRT', 0.032], ['2 TIE', 0.032], ['45$', 0.05]].reduce((y, [t, px]) => { S.text(t, cx, y, F + 0.66, px, '#1a1a1a', 1); return y - px * 5 - 0.05; }, P + 1.33); }
    { const px = Math.min(0.045, (wo / 2) / hudWidth(hudText(sp.glass))); S.text(sp.glass, x + wo / 4, P + 2.5, F + 0.64, px, '#d8b24a', 1); }   // бренд на стекле
    // длинная вывеска: тёмно-синяя, золотые буквы, слева — «фото» мужчины в костюме
    const bw = wd - 0.2, yc = P + 3.08, L0 = x - bw / 2;
    S.box(bw, 1.0, 0.12, x, yc, F + 0.1, '#141c3a'); S.box(bw + 0.08, 1.08, 0.08, x, yc, F + 0.06, '#c8a050');
    S.box(0.7, 0.9, 0.02, L0 + 0.45, yc, F + 0.17, '#cfd8e0');                                // фон фото
    S.box(0.56, 0.36, 0.02, L0 + 0.45, yc - 0.26, F + 0.18, '#1c2433'); S.box(0.12, 0.26, 0.02, L0 + 0.45, yc - 0.22, F + 0.19, '#f4f4f0'); S.box(0.04, 0.24, 0.02, L0 + 0.45, yc - 0.23, F + 0.2, '#b8302a');
    S.box(0.22, 0.28, 0.02, L0 + 0.45, yc + 0.1, F + 0.18, '#e8c8a8'); S.box(0.24, 0.08, 0.02, L0 + 0.45, yc + 0.27, F + 0.19, '#2a1a10');
    const tw = bw - 1.0, tx = L0 + 0.85 + tw / 2, px = Math.min(0.085, (tw - 0.2) / hudWidth(hudText(sp.name))), ps = Math.min(0.032, (tw - 0.2) / hudWidth(hudText(sp.sub)));
    for (const [T, z] of [[S, F + 0.17], [Gl, F + 0.19]]) { T.text(sp.name, tx, yc + 0.32, z, px, '#e8c25a', 1); T.text(sp.sub, tx, yc + 0.32 - px * 5 - 0.1, z, ps, '#e8c25a', 1); }
  } else if (sp.kind === 'tattoo') {                                                         // яркие стены, эскизы в рамах, кушетка, краски; подвесная вывеска TATTOO
    S.box(wo / 2, 2.5, 0.1, x - wo / 4, P + 1.25, F + 0.01, '#b8302a'); S.box(wo / 2, 2.5, 0.1, x + wo / 4, P + 1.25, F + 0.01, '#2f7a4a');
    Gl.box(wo - 0.1, 2.3, 0.02, x, P + 1.3, F + 0.04, '#ffb8a0');
    const ART = ['#f2c81e', '#2a8ad8', '#f2f2ee', '#e8782a', '#8a3ab8', '#1c1c1e'];
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { const fx = x - wo / 2 + 0.35 + k * (wo - 0.7) / 3, fy = P + 1.45 + r * 0.6;
      S.box(0.4, 0.48, 0.04, fx, fy, F + 0.08, '#1a1a1a'); S.box(0.3, 0.38, 0.02, fx, fy, F + 0.11, ART[(k * 2 + r + sp.seed) % ART.length]); S.box(0.12, 0.16, 0.02, fx + 0.04, fy + 0.02, F + 0.125, ART[(k + r * 3 + 1) % ART.length]); }
    S.box(0.9, 0.05, 0.22, x - wo / 4, P + 0.95, F + 0.18, '#5a3a22'); for (let k = 0; k < 6; k++) S.box(0.09, 0.14, 0.09, x - wo / 4 - 0.35 + k * 0.14, P + 1.05, F + 0.2, ART[k % ART.length]);   // полка с красками
    S.box(1.5, 0.42, 0.6, x + wo / 4, P + 0.45, F + 0.42, '#1c1c1e'); S.box(0.5, 0.32, 0.6, x + wo / 4 - 0.55, P + 0.78, F + 0.42, '#1c1c1e'); S.box(0.1, 0.24, 0.1, x + wo / 4 + 0.5, P + 0.12, F + 0.42, '#8e9296');   // кушетка
    specialBoard(S, Gl, x, wd, F, P, sp, '#141414', '#ff7a2a');
    const hx = x - wd / 2 + 0.45;                                                             // подвесная вывеска на кронштейне
    S.box(0.06, 0.06, 1.6, hx, P + 3.85, F + 0.8, '#2a2a2c'); for (const dz of [0.4, 1.4]) S.box(0.03, 0.2, 0.03, hx, P + 3.72, F + dz, '#2a2a2c');
    S.box(0.05, 0.86, 1.36, hx, P + 3.2, F + 0.9, '#d8b24a'); S.box(0.07, 0.8, 1.3, hx, P + 3.2, F + 0.9, '#141414');
    if (!shipyard.dry) for (const sd of [-1, 1]) {
      const T = sculptor(), N = sculptor(); for (const [Q, c] of [[T, '#ff7a2a'], [N, '#ff5ab0']]) { Q.text('TATTOO', 0, 0.22, 0, 0.034, c, 1); Q.box(0.16, 0.16, 0.01, 0, -0.18, 0, c); Q.box(0.06, 0.3, 0.01, 0, -0.18, 0, c); }
      const m = T.mesh(), n = N.mesh(); n.material = TOWN.lit || (TOWN.lit = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); n.visible = false; nightGlow.push(n);
      for (const o of [m, n]) { o.rotation.y = sd * Math.PI / 2; o.position.set(hx + sd * (o === m ? 0.045 : 0.05), P + 3.2, F + 0.9); lot.g.add(o); }
    }
  }
}

// ---------- лавки там, где рядов нет: короткий ряд у дороги, лавке — нужная секция ----------
function specialRows() {
  const L = specialList(), groups = {};
  for (const sp of L) if (!sp.key) (groups[sp.group || sp.place] = groups[sp.group || sp.place] || []).push(sp);
  for (const k in groups) {
    const G = groups[k], n = G.length + 1, len = 4.6 * n, [x, z] = G[0].p;
    const lot = dLotNear(x, z, len, 10);
    if (!lot) { console.warn('особая лавка не встала:', k); continue; }
    G.forEach((sp, i) => { sp.forceLot = lot; sp.forceI = i; });
    const st0 = specialStyle(G[0].style), st = Object.assign({}, st0, { floors: [2, Math.max(2, st0.floors[1])] });   // не меньше двух этажей: вывеска не упрётся в крышу
    townMake(lot, seededRandom(Math.round(Math.abs(x * 7 + z * 13))), (l, q) => shophouseRow(l, q, st));
  }
}
function specialStyle(name) { return { NATHON_STYLE, HUA_STYLE, LAMAI_STYLE, CHAWENG_STYLE }[name] || NATHON_STYLE; }

// ---------- воздушные змеи у обочины: пучок бамбуковых шестов, на нём десятки змеев с лентами; колышутся, разрушаются ----------
function buildKiteStand() {
  const [kx, kz] = pierXZ(9.4328, 100.0131), H = dRoad(kx, kz); if (!H) return;
  let at = null, atS = 0;
  for (const ds of [0, 8, -8, 16, -16, 26, -26]) for (const sd of [1, -1]) { const p = roadPoint(H.R, H.q.s + ds, sd * (halfS + 3.2)); if (!at && groundY(p[0], p[1]) > 0.5 && !townBlocked(p[0], p[1]) && roadDist(p[0], p[1]) > halfS + 1.5) { at = p; atS = H.q.s + ds; } }
  if (!at) return;
  const [x, z, tx, tz] = at, y = groundY(x, z), g = townGroup(x, z, Math.atan2(tz, tx)), rnd = seededRandom(4328);   // +X — вдоль дороги
  const S = sculptor(), BAMBOO = '#c8b070';
  const tops = [];
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283, b = [Math.cos(a) * 0.6, y, Math.sin(a) * 0.6], t = [Math.cos(a) * (1.6 + rnd() * 0.8), y + 4.2 + rnd() * 1.8, Math.sin(a) * (1.2 + rnd() * 0.6)];
    S.limb(b, t, 0.06, 0.035, BAMBOO, 5); tops.push(t); }
  S.limb([-2.2, y + 3.4, 0], [2.2, y + 3.6, 0], 0.04, 0.04, BAMBOO, 5); S.limb([0, y + 2.6, -1.4], [0, y + 2.8, 1.4], 0.04, 0.04, BAMBOO, 5);
  const poles = hotelMesh(S); g.add(poles);
  const COL = ['#e8382a', '#f2c81e', '#2aa84a', '#2a6ad8', '#e8388a', '#f28a1e', '#8a3ab8', '#2ac8c8'], kites = [];
  const hang = tops.concat([[-2, y + 3.5, 0], [-1, y + 3.55, 0], [1, y + 3.6, 0], [2, y + 3.6, 0], [0, y + 2.7, -1.2], [0, y + 2.75, 1.2]]);
  for (let k = 0; k < 26; k++) {
    const h = hang[k % hang.length], K = sculptor(), c1 = COL[(k * 3) % COL.length], c2 = COL[(k * 5 + 2) % COL.length], bird = k % 3 === 0, s = 0.55 + rnd() * 0.4;
    if (bird) {                                                                               // змей-птица: крылья, тело, хвост
      for (const sd of [-1, 1]) { K.tri([0, 0, 0], [sd * 1.2 * s, 0.25 * s, 0], [sd * 0.4 * s, -0.35 * s, 0], c1); K.tri([0, 0, 0.01], [sd * 0.9 * s, 0.12 * s, 0.01], [sd * 0.45 * s, -0.2 * s, 0.01], c2); }
      K.box(0.12 * s, 0.7 * s, 0.05, 0, -0.1 * s, 0.01, c2);
    } else { K.quad([0, 0.6 * s, 0], [0.42 * s, 0, 0], [0, -0.75 * s, 0], [-0.42 * s, 0, 0], c1); K.quad([0, 0.6 * s, 0.01], [0.42 * s, 0, 0.01], [0, -0.1 * s, 0.01], [-0.42 * s, 0, 0.01], c2); }   // ромб в два цвета
    for (let r = 0; r < 2; r++) { const len = 1.8 + rnd() * 1.2, ox = (r - 0.5) * 0.12, c = COL[(k + r * 4 + 1) % COL.length];        // хвосты-ленты, чуть изогнуты
      for (let q = 0; q < 6; q++) { const t0 = q / 6, t1 = (q + 1) / 6; K.quad([ox + Math.sin(t0 * 5 + r) * 0.15, -0.6 * s - t0 * len, 0.02], [ox + 0.07 + Math.sin(t0 * 5 + r) * 0.15, -0.6 * s - t0 * len, 0.02], [ox + 0.07 + Math.sin(t1 * 5 + r) * 0.15, -0.6 * s - t1 * len, 0.02], [ox + Math.sin(t1 * 5 + r) * 0.15, -0.6 * s - t1 * len, 0.02], c); } }
    const m = hotelMesh(K); m.position.set(h[0] + (rnd() - 0.5) * 0.8, h[1] - rnd() * 1.2, h[2] + (rnd() - 0.5) * 0.6); m.rotation.y = rnd() * 6.283; m.userData.ph = rnd() * 6.283; m.userData.ry = m.rotation.y;
    g.add(m); kites.push(m);
  }
  // ветер: змеи колышутся на шестах; сбитые машиной — отрываются и плавно уходят по ветру вверх, пока не растают в небе
  const WIND = [0.86, 0.5];                                                                    // куда дует (мир), как и качание растений — к +X
  let flying = 0;
  airportAnim.push((t) => {
    if (!g.visible && !flying) return;
    for (const m of kites) {
      const p = m.userData.ph, F = m.userData.fly;
      if (!F) { m.rotation.z = Math.sin(t * 1.7 + p) * 0.22; m.rotation.x = Math.sin(t * 1.1 + p * 1.3) * 0.12; m.rotation.y = m.userData.ry + Math.sin(t * 0.6 + p) * 0.35; continue; }
      if (F.done) continue;
      if (F.t0 === null) F.t0 = t;
      const a = t - F.t0, k = Math.min(1, a / 2.5), up = F.vy * a * k + 0.04 * a * a, run = F.vh * a * k + 0.06 * a * a;   // разгон первые секунды, дальше ветер уносит всё быстрее
      m.position.set(F.x + WIND[0] * run + F.side[0] * Math.sin(a * 0.7 + p) * 2.5, F.y + up + Math.sin(a * 1.9 + p) * 0.6, F.z + WIND[1] * run + F.side[1] * Math.sin(a * 0.7 + p) * 2.5);
      m.rotation.z = Math.sin(a * 2.3 + p) * 0.6; m.rotation.x = Math.sin(a * 1.7 + p) * 0.4; m.rotation.y = F.ry + a * F.spin;
      m.material.opacity = Math.max(0, 1 - Math.max(0, a - 14) / 8);                            // тает к концу полёта
      if (a > 22) { F.done = true; m.visible = false; scene.remove(m); m.material.dispose(); flying--; }
    }
  });
  addBreakable({ kind: 'small', mat: 'wood', x, z, r: 2.4, loss: 0.06,
    hide() { poles.visible = false;
      for (const m of kites) { const w = m.getWorldPosition(new THREE.Vector3()); scene.attach(m); m.material = m.material.clone(); m.material.transparent = true;
        m.userData.fly = { t0: null, x: w.x, y: w.y, z: w.z, vy: 0.9 + Math.random() * 1.2, vh: 1.5 + Math.random() * 2, spin: (Math.random() - 0.5) * 1.2, ry: m.rotation.y, side: [-WIND[1] * (Math.random() - 0.5), WIND[0] * (Math.random() - 0.5)] };
        flying++; } },
    pieces(out) { meshPieces(out, poles, 'wood'); } });
  { const B = propBatch(), w = g.localToWorld(new THREE.Vector3(3.6, 0, 1.2)); propTableSet(B, w.x, groundY(w.x, w.z), w.z, Math.atan2(tz, tx), rnd); B.finish([x, z]); }   // столик продавца
  dKeep(x, z, 4.5);
  { const p = roadPoint(H.R, atS - 14, 0); LANDMARKS.push({ name: 'KITE SHOP', x: p[0], z: p[1], heading: Math.atan2(-p[2], -p[3]) }); }   // на дороге, не доезжая, носом к змеям
}

// ---------- прокат: навес на колоннах под профлистом, ряды машин, щит у дороги ----------
function rentalShed(lot, roof, kerb) {                                                          // навес на всю длину участка; возвращает сборщик
  const S = sculptor(), L = lot.len, F = lot.D / 2;
  S.box(L, 1.6, lot.D, 0, -0.6, 0, '#8f8b80'); S.box(L, 0.08, lot.D, 0, 0.22, 0, '#a29f96');
  for (const xx of [-L / 2 + 0.3, -L / 6, L / 6, L / 2 - 0.3]) for (const zz of [-F + 0.3, F - 0.3]) { S.box(0.18, 3.3, 0.18, xx, 1.9, zz, '#7a7e84'); const w = lot.g.localToWorld(new THREE.Vector3(xx, 0, zz)); posts.push([w.x, w.z]); }
  S.quad([-L / 2 - 0.4, 3.75, -F - 0.4], [L / 2 + 0.4, 3.75, -F - 0.4], [L / 2 + 0.4, 3.45, F + 0.6], [-L / 2 - 0.4, 3.45, F + 0.6], roof);
  for (let k = 0; k <= Math.round(L / 1.2); k++) S.box(0.04, 0.04, lot.D + 1, -L / 2 - 0.4 + k * (L + 0.8) / Math.round(L / 1.2), 3.62, 0.1, '#7a8288');   // волны профлиста
  S.box(L, 2.6, 0.1, 0, 1.5, -F + 0.05, '#e8e4da');                                          // задняя стенка-перегородка
  townWalk(lot, S, 2.7, kerb);
  return S;
}
function rentalSign(g, u, v, y, lines, bg, ink) {                                              // щит на двух ногах у дороги (разрушаемый), читается с улицы
  templeProp(g, u, v, (P) => {
    for (const d of [-0.9, 0.9]) P.box(0.08, 1.2, 0.08, d, y + 0.6, 0, '#8e9296');
    P.box(2.3, 1.3, 0.08, 0, y + 1.85, 0, bg); P.box(2.4, 1.4, 0.06, 0, y + 1.85, -0.02, ink);
    lines.reduce((yy, [t, px]) => { for (const sd of [1, -1]) P.text(t, 0, yy, sd * 0.05, px, ink, sd); return yy - px * 5 - 0.1; }, y + 2.38);
  }, { kind: 'pole', mat: 'metal', color: bg, r: 0.9, loss: 0.04 });
}
function buildScooterRental() {
  const [x, z] = pierXZ(9.55729, 100.05500), lot = dLotNear(x, z, 18, 8); if (!lot) return;
  const S = rentalShed(lot, '#9aa6ae', '#2a2a2c'), F = lot.D / 2;
  scooterRow(lot.g, 301, 12, -lot.len / 2 + 1.2, 1.2, 1.15, 0, -Math.PI / 2, 0.26); scooterRow(lot.g, 313, 12, -lot.len / 2 + 1.2, -1.6, 1.15, 0, -Math.PI / 2, 0.26);
  for (const u of [5.5, 7.2]) templeProp(lot.g, u, -(F - 1.4), (P) => dirtBike(P, 0.26, u > 6 ? '#e8782a' : '#2a8a3a'), { kind: 'small', mat: 'metal', color: '#2a2a2c', r: 0.9, loss: 0.03 });
  rentalSign(lot.g, -lot.len / 2 + 1.6, -(F + 1.6), 0.26, [['MOTORBIKE', 0.07], ['FOR RENT', 0.07], ['150 BAHT / DAY', 0.035]], '#f2c81e', '#d42020');
  townDone(lot, S, null, 0, 0, 2.9);                                                          // навес не стена: под ним проезжают
  const a = lot.g.localToWorld(new THREE.Vector3(-12, 0, F + lot.FR - 2.6)), b = lot.g.localToWorld(new THREE.Vector3(-11, 0, F + lot.FR - 2.6));
  LANDMARKS.push({ name: 'MOTORBIKE RENTAL', x: a.x, z: a.z, heading: Math.atan2(-(b.x - a.x), -(b.z - a.z)) });
}
function buildHarleyRental() {
  // кольцевая у Чавенга: точка дороги 4169, ближайшая к центру Чавенга
  let best = null; roads.forEach((R, r) => { if (R.name !== '4169') return; for (let s = 0; s < R.len; s += 4) { const p = roadPoint(R, s, 0), d = Math.hypot(p[0] - 1070, p[1] - 2142); if (!best || d < best[0]) best = [d, p]; } });
  if (!best) return;
  const lot = dLotNear(best[1][0], best[1][1], 14, 8); if (!lot) return;
  const S = rentalShed(lot, '#3a3a3c', '#d8782a'), F = lot.D / 2;
  S.box(lot.len - 0.4, 0.8, 0.12, 0, 3.0, F + 0.62, '#1c1c1e'); S.box(lot.len - 0.4, 0.1, 0.13, 0, 2.62, F + 0.62, '#e8782a');   // фриз
  { const px = Math.min(0.12, (lot.len - 2) / hudWidth(hudText('HARLEY RENTAL'))); S.text('HARLEY RENTAL', 0, 3.0 + px * 2.5, F + 0.7, px, '#e8782a', 1); }
  const COLS = ['#b8202a', '#5a6a3a', '#e8782a', '#1c1c1e', '#2a4a8a'];
  COLS.forEach((c, k) => { const u = -lot.len / 2 + 1.8 + k * 2.6; templeProp(lot.g, u, 0.2, (P) => harley(P, 0.26, c, k % 2 === 0), { kind: 'small', mat: 'metal', color: c, r: 1.0, loss: 0.03 }); });
  rentalSign(lot.g, lot.len / 2 - 1.4, -(F + 1.6), 0.26, [['BIG BIKES', 0.06], ['FOR RENT', 0.06], ['DAY / WEEK', 0.035]], '#1c1c1e', '#e8782a');
  townDone(lot, S, null, 0, 0, 2.9);
  const a = lot.g.localToWorld(new THREE.Vector3(-10, 0, F + lot.FR - 2.6)), b = lot.g.localToWorld(new THREE.Vector3(-9, 0, F + lot.FR - 2.6));
  LANDMARKS.push({ name: 'HARLEY RENTAL', x: a.x, z: a.z, heading: Math.atan2(-(b.x - a.x), -(b.z - a.z)) });
}
// большой круизер вдоль местной оси Z (нос — к улице): колёса, бак, сиденье, кофры, хром; fairing — обтекатель «Road Glide»
function harley(P, y, c, fairing) {
  const R = 0.34, C = '#d8dade';
  for (const zz of [-1.0, 0.95]) { P.limb([-0.09, y + R, zz], [0.09, y + R, zz], R, R, '#1c1c1e', 12); P.limb([-0.1, y + R, zz], [0.1, y + R, zz], 0.16, 0.16, C, 8); }
  P.box(0.16, 0.12, 1.7, 0, y + 0.42, 0, '#2a2a2c');                                          // рама
  P.box(0.4, 0.45, 0.5, 0, y + 0.55, 0.05, '#3a3c3e'); for (const s of [-1, 1]) P.box(0.08, 0.32, 0.32, s * 0.22, y + 0.6, 0.05, C);   // мотор
  P.blob(0, y + 0.95, 0.35, 0.24, 0.16, 0.36, c, 9, 4);                                       // бак
  P.box(0.32, 0.12, 0.6, 0, y + 0.88, -0.25, '#1a1a1a');                                      // сиденье
  for (const s of [-1, 1]) { P.box(0.2, 0.36, 0.5, s * 0.3, y + 0.68, -0.75, c); P.limb([s * 0.2, y + 0.3, 0.1], [s * 0.22, y + 0.38, -1.2], 0.05, 0.05, C, 6); }   // кофры, выхлоп
  P.limb([0, y + R, 0.95], [0, y + 1.05, 0.75], 0.04, 0.04, C, 5); P.box(0.8, 0.04, 0.04, 0, y + 1.1, 0.72, C);   // вилка, руль
  P.box(0.4, 0.06, 0.4, 0, y + 0.72, 1.0, c);                                                 // крыло
  if (fairing) { P.blob(0, y + 1.05, 0.95, 0.42, 0.24, 0.16, c, 9, 4); P.box(0.5, 0.18, 0.04, 0, y + 1.32, 0.9, '#9ab8c8'); }
  else P.blob(0, y + 0.98, 1.0, 0.1, 0.1, 0.06, '#f2f2d8', 6, 3);                             // фара
}
// кроссовый мотоцикл: высокий, узкий, зубастые колёса
function dirtBike(P, y, c) {
  for (const zz of [-0.7, 0.75]) P.limb([-0.06, y + 0.36, zz], [0.06, y + 0.36, zz], 0.36, 0.36, '#2a2a2c', 10);
  P.box(0.12, 0.1, 1.2, 0, y + 0.55, 0, '#3a3c3e'); P.box(0.26, 0.3, 0.5, 0, y + 0.82, 0.15, c); P.box(0.2, 0.08, 0.6, 0, y + 0.92, -0.3, '#1c1c1e');
  P.limb([0, y + 0.36, 0.75], [0, y + 1.0, 0.55], 0.035, 0.035, '#d8dade', 5); P.box(0.7, 0.04, 0.04, 0, y + 1.05, 0.55, '#2a2a2c'); P.box(0.24, 0.05, 0.3, 0, y + 0.82, 0.78, c);
}

function buildSpecialShops() {
  const run = (f, name) => { try { f(); } catch (e) { console.warn('особые магазины:', name, e); DIST_ERR.push(name + ': ' + e.message + ' ' + (e.stack || '').split('\n')[1]); } };
  run(specialRows, 'лавки у дороги'); run(buildKiteStand, 'змеи'); run(buildScooterRental, 'прокат скутеров'); run(buildHarleyRental, 'прокат Harley');
}
