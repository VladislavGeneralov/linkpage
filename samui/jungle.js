// Джунгли, плантации и поля — растительность всего острова, кроме придорожной полосы (та — в основном скрипте).
// По refs/samui_jungle_plants и refs/coconut_plantation. Растения — скрещённые карточки с пиксельным рисунком из одного
// атласа: так на клетку 250 × 250 м уходит одна-две отрисовки, а не тысячи. Клетки строятся на лету вокруг машины
// и выгружаются, когда она уехала; расстановка задана координатами (а не случаем), поэтому лес всегда один и тот же.
//
// Где что растёт (по высоте земли и плавному шуму):
//   берег 1.5–3 м    — редкие наклонённые кокосовые пальмы;
//   низины           — поля с высокой травой, кокосовые плантации (пальмы через 8 м, под ними трава, пеньки, молодняк)
//                      и заросли (бананы, бамбук, пальмы «рыбий хвост», алоказии);
//   холмы от ~10 м   — лес: круглые и ярусные кроны, фикусы-душители с воздушными корнями, бамбук, рыбий хвост,
//                      над пологом — великаны янг-на; в подлеске алоказия, факельный имбирь, геликония, папоротник
//                      «птичье гнездо», дикий банан, подрост.
// У каждого вида свой разброс высоты и ширины, оттенка, наклона; карточки зеркалятся вразнобой.
// Стволы деревьев и пальм — разрушаемые (как придорожные пальмы), фикусы тоже (удар отнимает треть скорости);
// великаны янг-на — твёрдые; подлесок — насквозь.
//
// Файл подключается раньше основного скрипта: здесь только объявления; игра зовёт buildJungle() один раз
// и updateJungle() каждый кадр.

const JG = {
  CH: 250, TREE_S: 8.5, UNDER_S: 5.5,    // м — клетка; шаг сетки деревьев и подлеска
  SEEN: 950, UNDER_SEEN: 230,            // м — докуда рисуются деревья и подлесок
  ROAD: 19, ROAD_FULL: 34,               // м — от оси дороги лес начинается и входит в полную густоту
  chunks: new Map(), mat: null, last: null, built: 0, ms: 0, job: null,
};
// деревья (верхний ряд атласа, клетка 64 × 128): col — клетка, fill — какую долю высоты клетки занимает рисунок,
// h — высота растения, ws — разброс ширины, r — радиус ствола; solid — твёрдое (не ломается); loss — потеря скорости
// при ударе; top — клетка вида сверху, topY и topS — на какой высоте и какого размера она лежит; trunk — докуда ствол
const JG_TREES = {
  yang:     { col: 0, fill: 0.97, h: [21, 29], ws: [0.9, 1.2], r: 0.75, loss: 0.4, kind: 'tree', top: 0, topY: 0.82, topS: 0.95, sway: 0.2, trunk: 0.7, bark: '#a59a86', leaf: '#46682a' },
  ficus:    { col: 1, fill: 0.97, h: [12, 18], ws: [1.2, 1.6], r: 1.1, loss: 0.3, kind: 'tree', top: 0, topY: 0.72, topS: 1.1, sway: 0.18, trunk: 0.4, bark: '#8a7358', leaf: '#3b6a30' },
  round:    { col: 2, fill: 0.96, h: [9, 16], ws: [0.95, 1.35], r: 0.3, loss: 0.16, kind: 'tree', top: 0, topY: 0.72, topS: 1.3, sway: 0.3, trunk: 0.5, bark: '#7d6a54', leaf: '#4e8430' },
  layered:  { col: 3, fill: 0.96, h: [10, 15], ws: [0.95, 1.3], r: 0.26, loss: 0.14, kind: 'tree', top: 0, topY: 0.78, topS: 1.3, sway: 0.3, trunk: 0.8, bark: '#857662', leaf: '#5f9238' },
  bamboo:   { col: 4, fill: 0.96, h: [10, 15], ws: [1.0, 1.3], r: 0.7, loss: 0.1, kind: 'bamboo', top: 2, topY: 0.86, topS: 0.9, sway: 0.6, trunk: 0.7, bark: '#9aa84a', leaf: '#7f9f3e' },
  fishtail: { col: 5, fill: 0.96, h: [6.5, 10], ws: [1.0, 1.25], r: 0.35, loss: 0.1, kind: 'palm', top: 2, topY: 0.82, topS: 0.85, sway: 0.4, trunk: 0.75, bark: '#6f6454', leaf: '#3a6a2c' },
  cocoA:    { col: 6, fill: 0.97, h: [10, 14.5], ws: [1.0, 1.15], r: 0.28, loss: 0.2, kind: 'palm', top: 1, topY: 0.9, topS: 1.0, sway: 0.5, trunk: 0.86, bark: '#a99681', leaf: '#5e8a3a', nuts: true },
  cocoB:    { col: 7, fill: 0.97, h: [12.5, 17], ws: [0.9, 1.05], r: 0.28, loss: 0.2, kind: 'palm', top: 1, topY: 0.92, topS: 0.95, sway: 0.5, trunk: 0.88, bark: '#a99681', leaf: '#5e8a3a', nuts: true },
};
// подлесок (второй ряд, клетка 64 × 64)
const JG_UNDER = {
  alocasia:  { col: 0, fill: 0.9, h: [1.6, 3.0], ws: [0.9, 1.2], sway: 0.25 },
  ginger:    { col: 1, fill: 0.95, h: [2.6, 4.4], ws: [0.9, 1.2], sway: 0.3 },
  heliconia: { col: 2, fill: 0.92, h: [1.9, 3.0], ws: [0.9, 1.2], sway: 0.3 },
  fern:      { col: 3, fill: 0.55, h: [0.8, 1.5], ws: [1.0, 1.4], sway: 0.15 },
  banana:    { col: 4, fill: 0.97, h: [3.4, 5.0], ws: [0.9, 1.15], sway: 0.35 },
  sapling:   { col: 5, fill: 0.92, h: [2.4, 5.0], ws: [0.8, 1.2], sway: 0.3 },
  grass:     { col: 6, fill: 0.6, h: [0.7, 1.3], ws: [1.0, 1.6], sway: 0.25 },
  stump:     { col: 7, fill: 0.34, h: [0.5, 0.8], ws: [1.0, 1.2], sway: 0 },
};

// ---------- атлас: все растения на одном холсте ----------
function jungleAtlas() {
  return pixelTexture(512, 256, (g) => {
    const rnd = seededRandom(9001);
    let X0 = 0, YB = 127, CHH = 128;                                   // текущая клетка: левый край, нижняя строка, высота
    const cell = (col, row) => { X0 = col * 64; YB = row === 0 ? 127 : row === 1 ? 191 : 255; CHH = row === 0 ? 128 : 64; };
    const P = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || x > 63 || y < 0 || y >= CHH) return; g.fillStyle = c; g.fillRect(X0 + x, YB - y, 1, 1); };   // y — вверх от земли
    const line = (x0, y0, x1, y1, c) => { const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.4) || 1; for (let i = 0; i <= n; i++) P(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); };
    // ствол: полоса от (x0, y0) до (x1, y1), ширина w0 -> w1; слева светлее
    const stem = (x0, y0, x1, y1, w0, w1, light, dark, rings = 0) => {
      const n = Math.ceil(Math.abs(y1 - y0) * 1.2) || 1;
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, w = w0 + (w1 - w0) * t;
        for (let k = 0; k < w; k++) P(x - w / 2 + k + 0.5, y, rings && Math.round(y) % rings === 0 ? dark : k < w * 0.45 ? light : dark);
      }
    };
    // крона — объединение кругов [x, y, r]; свет сверху слева; край рваный
    const crown = (balls, pal, ragged = 0.3) => {
      let xa = 64, xb = 0, ya = CHH, yb = 0;
      for (const [x, y, r] of balls) { xa = Math.min(xa, x - r); xb = Math.max(xb, x + r); ya = Math.min(ya, y - r); yb = Math.max(yb, y + r); }
      for (let y = Math.floor(ya); y <= yb; y++) for (let x = Math.floor(xa); x <= xb; x++) {
        let inside = false, lit = -9, deep = false;
        for (const [bx, by, r] of balls) {
          const d = Math.hypot(x - bx, y - by);
          if (d < r) { inside = true; if (d < r - 1.5) deep = true; lit = Math.max(lit, (y - by) / r + (bx - x) / r * 0.55); }
        }
        if (!inside || (!deep && rnd() < ragged)) continue;
        const k = lit > 0.55 ? 0 : lit > 0.05 ? 1 : lit > -0.45 ? 2 : 3;
        P(x, y, pal[Math.min(3, k + (rnd() < 0.22 ? 1 : 0))]);
      }
    };
    // вайя пальмы сбоку: дуга из (x, y) под углом a длиной L, провисает на droop; листочки висят вниз
    const frond = (x, y, a, L, droop, pal, leaf = 5) => {
      const n = Math.ceil(L * 1.4);
      for (let i = 0; i <= n; i++) {
        const t = i / n, fx = x + Math.cos(a) * L * t, fy = y + Math.sin(a) * L * t - droop * L * t * t;
        const ll = leaf * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), 0.6);
        for (let k = 1; k <= ll; k++) if ((i + k) % 2 || k < 2) P(fx - Math.cos(a) * k * 0.25, fy - k, k > ll * 0.6 ? pal[2] : pal[1]);
        if (Math.sin(a) > 0.5) for (let k = 1; k <= ll * 0.5; k++) P(fx + (Math.cos(a) > 0 ? -1 : 1) * k * 0.7, fy + k * 0.3, pal[1]);   // у торчащих вверх — и по другую сторону
        P(fx, fy, pal[0]);
      }
    };
    // лист-лопасть: вытянутый овал от (x, y) под углом a; светлая жилка
    const blade = (x, y, a, L, W, pal, droop = 0) => {
      const n = Math.ceil(L * 1.5);
      for (let i = 0; i <= n; i++) {
        const t = i / n, cx = x + Math.cos(a) * L * t, cy = y + Math.sin(a) * L * t - droop * L * t * t, w = W * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)), 0.7);
        for (let k = -w / 2; k <= w / 2; k += 0.6) P(cx - Math.sin(a) * k, cy + Math.cos(a) * k, Math.abs(k) < 0.4 ? pal[0] : k > 0 === Math.cos(a) > 0 ? pal[1] : pal[2]);
      }
    };
    const R = (a, b) => a + rnd() * (b - a);
    const DEEP = ['#5d7a2c', '#46682a', '#33541f', '#243f1a'], GLOSS = ['#4f7f38', '#3b6a30', '#2a5226', '#1c3d1d'];
    const MIDG = ['#6a9a3a', '#4e8430', '#386a28', '#27501f'], LIME = ['#7fae45', '#5f9238', '#447628', '#2f5a20'];
    const PALM = ['#8fa860', '#5e8a3a', '#34552c'], TAIL = ['#5f8a3e', '#3a6a2c', '#234a20'];

    // ===== деревья =====
    // 0. янг-на: голый прямой ствол, наверху — отдельные «облака» листвы на сучьях
    cell(0, 0);
    stem(32, 0, 32, 100, 5, 3, '#b8ac96', '#8f8470');
    for (const [bx, by] of [[16, 92], [47, 96], [24, 108], [41, 112], [32, 118], [11, 104], [53, 108]]) line(32, by - 16, bx, by - 3, '#8f8470');
    crown([[16, 94, 8], [47, 98, 9], [24, 110, 9]], DEEP); crown([[41, 113, 9], [32, 119, 7], [10, 106, 6], [54, 109, 6]], DEEP);
    // 1. фикус-душитель: решётка корней вместо ствола, широкий купол, с краёв свисают воздушные корни
    cell(1, 0);
    stem(32, 0, 32, 60, 4.5, 3.5, '#8f775a', '#5e4c3a');                                           // ствол дерева-хозяина
    for (const [bx, tx, ph] of [[22, 29, 0], [27, 31, 2], [37, 33, 4], [42, 35, 1]]) for (let y = 0; y <= 58; y++) {   // корни-душители: отдельные жгуты, между ними просветы
      const t = y / 58, x = bx + (tx - bx) * Math.pow(t, 0.7) + Math.sin(y * 0.22 + ph) * 0.8;
      P(x, y, '#a48a68'); P(x + 1, y, '#6a5642');
    }
    for (const [y0, d] of [[14, 1], [27, -1], [40, 1]]) for (let k = -6; k <= 6; k++) P(32 + k, y0 + k * d * 0.7, '#6a5642');   // перехваты поперёк ствола
    for (const [x, len] of [[10, 30], [16, 40], [49, 38], [55, 28]]) for (let y = 62; y > 62 - len; y--) if (y % 4) P(x + Math.sin(y * 0.3) * 0.6, y, '#7a6650');   // воздушные корни с кроны
    crown([[32, 92, 30], [14, 82, 15], [50, 82, 15], [32, 106, 20], [10, 96, 9], [54, 96, 9]], GLOSS, 0.25);
    // 2. круглая крона: ствол с петлёй лианы и розеткой папоротника в развилке
    cell(2, 0);
    stem(32, 0, 32, 64, 4.5, 3, '#8f7a60', '#6a5844');
    for (let y = 4; y < 60; y++) P(32 + Math.sin(y * 0.33) * 3.2, y, '#3d3324');                        // лиана вокруг ствола
    for (let k = -4; k <= 4; k++) line(32, 44, 32 + k * 2.2, 50 - Math.abs(k) * 0.8, k % 2 ? '#9fcf52' : '#7cae3e');   // папоротник-гнездо
    line(32, 56, 20, 70, '#6a5844'); line(32, 58, 45, 72, '#6a5844');
    crown([[32, 96, 22], [17, 86, 13], [47, 86, 14], [30, 110, 14], [44, 104, 12], [20, 104, 11]], MIDG);
    for (let y = 78; y > 40; y--) if (y % 4) P(52 + Math.sin(y * 0.2), y, '#3d3324');                    // свисающая лиана
    // 3. ярусная крона: тонкий ствол, плоские этажи листвы
    cell(3, 0);
    stem(32, 0, 32, 112, 3.5, 2, '#9a8a72', '#746450');
    for (const [y, rx] of [[52, 22], [70, 26], [88, 22], [104, 16], [116, 9]]) {
      line(32, y - 3, 32 - rx * 0.8, y, '#746450'); line(32, y - 3, 32 + rx * 0.8, y, '#746450');
      crown([[32, y, 6], [32 - rx * 0.45, y + 1, 5.5], [32 + rx * 0.45, y + 1, 5.5], [32 - rx * 0.82, y - 0.5, 4.5], [32 + rx * 0.82, y - 0.5, 4.5]], LIME, 0.35);
    }
    // 4. бамбук: пучок стеблей из одной точки, верхушки расходятся и свисают
    cell(4, 0);
    for (let i = 0; i < 15; i++) {
      const bx = 28 + rnd() * 8, dx = (i - 7) * 3.6 + R(-1.5, 1.5), H = R(92, 120), c = i % 2 ? '#a8b050' : '#8a9440';
      for (let y = 0; y < H; y++) {
        const t = y / H, x = bx + dx * Math.pow(t, 2.3), yy = y - Math.max(0, t - 0.82) * H * 0.9 * (t - 0.82) * 6;   // верхушка клонится
        P(x, yy, y % 8 === 0 ? '#5f6a2c' : c);
        if (t > 0.42 && rnd() < 0.55) { const s = rnd() < 0.5 ? -1 : 1, l = R(2, 5); line(x, yy, x + s * l, yy + R(-2, 1.5), rnd() < 0.5 ? '#8fb04a' : '#6f953a'); }
      }
    }
    // 5. пальма «рыбий хвост»: куртина стволов разной высоты, листья ярусами
    cell(5, 0);
    for (const [bx, tx, H] of [[30, 28, 118], [34, 38, 96], [27, 20, 80], [37, 45, 66], [31, 31, 50]]) {
      stem(bx, 0, tx, H, 2.4, 1.8, '#8a7e6a', '#5e5444', 6);
      for (let y = H; y > H * 0.42; y -= R(9, 13)) for (const s of [-1, 1]) {
        const x = bx + (tx - bx) * y / H, L = R(11, 17);
        for (let i = 0; i <= L; i++) { const fx = x + s * i, fy = y + 2 - i * i * 0.022; P(fx, fy, TAIL[0]); for (let k = 1; k <= (i % 3 === 0 ? 5 : 3) && i > 1; k++) P(fx + s * (k % 2) * 0.6, fy - k, k > 3 ? TAIL[2] : TAIL[1]); }
      }
    }
    // 6, 7. кокосовая пальма: ствол в кольцах, шар кроны, под ней гроздь орехов
    for (const [col, H, n, L] of [[6, 100, 14, 29], [7, 110, 13, 26]]) {
      cell(col, 0);
      stem(32, 0, 32, 8, 6, 4.5, '#b2a08a', '#7c6c5c'); stem(32, 8, 32, H, 3.6, 2.6, '#b2a08a', '#7c6c5c', 5);
      for (let i = 0; i < n; i++) {                                        // вайи: от свисающих до торчащих вверх
        const t = i / (n - 1), a0 = -0.75 + t * 1.95 + R(-0.08, 0.08);
        for (const s of [-1, 1]) frond(32, H, s > 0 ? a0 : Math.PI - a0, L * (0.82 + 0.3 * Math.sin(Math.PI * t)) * R(0.92, 1.08), 0.5 - 0.3 * t, PALM, 6);
      }
      for (let i = 0; i < 6; i++) { const nx = 32 + R(-3.5, 3.5), ny = H - 2 - rnd() * 3.5; for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1]]) P(nx + dx, ny + dy, i % 3 ? '#9dac66' : '#67743b'); }
      for (const s of [-1, 1]) for (let y = H - 2; y > H - 16; y--) if (y % 3) P(32 + s * (1.5 + (H - y) * 0.12), y, '#8a7a5a');   // сухие листья вдоль ствола
    }

    // ===== подлесок =====
    // 0. алоказия: листья-стрелы на длинных черешках
    cell(0, 1);
    for (const [a, L, s] of [[1.95, 34, 11], [1.2, 38, 12], [2.45, 26, 9], [0.7, 28, 10], [1.57, 44, 12], [2.8, 16, 8], [0.35, 18, 8]]) {
      const tx = 32 + Math.cos(a) * L, ty = Math.sin(a) * L;
      line(32, 0, tx, ty, '#6f9a4a');
      blade(tx - Math.cos(a + 0.3) * s * 0.3, ty - s * 0.25, Math.PI / 2 + (a - 1.57) * 0.5, s * 1.3, s * 0.85, ['#b8dc7a', '#4f9a3a', '#2f6e2a']);
    }
    // 1. факельный имбирь: сноп стеблей с двурядными листьями, у земли красные «факелы»
    cell(1, 1);
    for (let i = 0; i < 10; i++) {
      const a = 1.0 + i * 0.125 + R(-0.04, 0.04), L = R(44, 60), bend = (a - 1.57) * 0.25;
      for (let k = 0; k <= L; k++) {
        const t = k / L, x = 32 + Math.cos(a) * k - bend * k * t * 0.6, y = Math.sin(a) * k;
        P(x, y, t < 0.25 ? '#8a3a34' : '#5a8a3a');
        if (t > 0.3 && k % 4 === 0) { const s = (k / 4) % 2 ? 1 : -1; line(x, y, x + s * 6, y + 3, s > 0 ? '#5f9e3c' : '#3f7a2c'); line(x, y + 1, x + s * 5, y + 4, '#7cb84a'); }
      }
    }
    for (const [x, y] of [[22, 12], [41, 9], [31, 16]]) { line(x, 0, x, y - 3, '#8a3a34'); crown([[x, y, 3.6]], ['#f58ca6', '#e2485e', '#c22a44', '#8a1c30'], 0.15); }
    // 2. геликония: листья-вёсла, свисающие красно-жёлтые «клешни»
    cell(2, 1);
    for (const [a, L] of [[1.75, 50], [1.35, 54], [2.1, 40], [1.0, 42], [1.57, 58]]) { line(32, 0, 32 + Math.cos(a) * L * 0.35, Math.sin(a) * L * 0.35, '#5a8a3a'); blade(32 + Math.cos(a) * L * 0.33, Math.sin(a) * L * 0.33, a, L * 0.66, 9, ['#a8d06a', '#4a9a38', '#2e6e2a'], 0.12); }
    for (const [x, y, n] of [[19, 38, 6], [45, 34, 5]]) { line(32, 20, x, y, '#8a2a2a'); for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1, yy = y - i * 3.4; for (let k = 0; k < 4; k++) P(x + s * k, yy - k * 0.5, k === 3 ? '#f2d24a' : '#e02a2a'); P(x, yy, '#b01c1c'); } }
    // 3. папоротник «птичье гнездо»: воронка из ремневидных вай
    cell(3, 1);
    for (let i = 0; i < 17; i++) { const a = 0.18 + i * 0.174, L = R(22, 32) * (0.75 + 0.25 * Math.sin(a)); blade(32, 2, a, L, 3.4, ['#2c4a1c', i % 2 ? '#9fcf52' : '#86b944', '#6a9e38'], Math.abs(Math.cos(a)) * 0.35); }
    // 4. дикий банан: ложный ствол, веер больших листьев
    cell(4, 1);
    stem(32, 0, 32, 30, 4.5, 3.2, '#b2c06a', '#869a48');
    for (const [a, L] of [[2.5, 26], [0.64, 27], [2.05, 30], [1.1, 31], [1.75, 30], [1.4, 31], [2.9, 20], [0.25, 21]]) blade(32, 29, a, L, 8.5, ['#c8e08a', '#5aa63c', '#3a7e30'], a > 2.3 || a < 0.8 ? 0.5 : 0.22);
    for (const s of [-1, 1]) for (let y = 26; y > 12; y--) if (y % 3) P(32 + s * 3, y, '#a89a6a');
    // 5. подрост: тонкое деревце
    cell(5, 1);
    stem(32, 0, 31, 44, 2, 1.4, '#8f7a60', '#6a5844');
    line(31, 24, 22, 33, '#6a5844'); line(31, 30, 41, 38, '#6a5844');
    crown([[31, 48, 11], [21, 36, 6], [42, 41, 7], [36, 54, 6]], LIME, 0.4);
    // 6. высокая трава
    cell(6, 1);
    for (let i = 0; i < 34; i++) { const bx = 32 + R(-5, 5), tx = 32 + R(-26, 26), ty = R(18, 37), c = ['#9ab850', '#7ea83e', '#b8c468', '#5e8a30'][(rnd() * 4) | 0]; for (let k = 0; k <= 24; k++) { const t = k / 24; P(bx + (tx - bx) * t * t, ty * t, c); } }
    // 7. пенёк срубленной пальмы и сухая вайя на земле
    cell(7, 1);
    stem(24, 0, 24, 13, 9, 8, '#a08a70', '#6a5a48', 4); for (let x = 20; x <= 28; x++) P(x, 14, '#c8b494');
    for (let k = 0; k < 30; k++) { const x = 30 + k, y = 2 + Math.sin(k * 0.12) * 3; P(x, y, '#8a7250'); if (k % 2) { P(x, y + 1 + (k % 3), '#a08a5a'); P(x, y - 1, '#6f5a3c'); } }

    // ===== виды сверху =====
    cell(0, 2); crown([[32, 32, 20], [18, 22, 11], [46, 22, 11], [18, 44, 11], [46, 44, 11], [32, 14, 9], [32, 50, 9]], MIDG, 0.4);
    cell(1, 2); for (let i = 0; i < 11; i++) { const a = i / 11 * 6.283 + 0.2; for (let k = 2; k <= 29; k++) { const x = 32 + Math.cos(a) * k, y = 32 + Math.sin(a) * k, w = 3.6 * Math.sin(Math.PI * k / 30); P(x, y, PALM[0]); for (let q = 1; q <= w; q++) if ((k + q) % 2) { P(x - Math.sin(a) * q, y + Math.cos(a) * q, PALM[1]); P(x + Math.sin(a) * q, y - Math.cos(a) * q, PALM[2]); } } }
    cell(2, 2); for (let i = 0; i < 60; i++) { const a = rnd() * 6.283, d = R(3, 24), l = R(4, 8); line(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 32 + Math.cos(a) * (d + l), 32 + Math.sin(a) * (d + l) + R(-2, 2), ['#8fb04a', '#6f953a', '#4a7a30'][(rnd() * 3) | 0]); }
    cell(3, 2); for (let i = 0; i < 7; i++) blade(32, 32, i / 7 * 6.283 + 0.4, 26, 10, ['#b8dc7a', '#4f9a3a', '#2f6e2a']);
  });
}

// ---------- где что растёт ----------
// зона точки: 0 — поле, 1 — плантация, 2 — заросли, 3 — лес, 4 — берег; r — случайное число точки (0..1)
function jungleZone(x, z, h, r) {
  if (h < 3.2) return 4;
  if (r < Math.min(1, Math.max(0, (h - 7) / 9))) return 3;
  const n = vnoise(x / 210 + 40.3, z / 210 + 17.7, 4096);
  return n < 0.43 ? 0 : n < 0.62 ? 1 : 2;
}
// сюда лес не заходит: аэродром и терминал, станции локаторов, участки построек, островок Будды, настилы пирсов
function jungleBlocked(x, z, h) {
  const A = IS.airport, ax = x - A.x, az = z - A.z, u = ax * A.ux + az * A.uz, v = ax * A.uz - az * A.ux;
  if (u > A.af_u0 - 25 && u < A.af_u1 + 25 && v > A.af_v0 - 30 && v < A.af_v1 + 25) return true;
  if (u > TERMINAL.u0 - 12 && u < TERMINAL.u1 + 12 && v > TERMINAL.v0 - 12 && v < TERMINAL.v1) return true;
  for (const s of IS.sites) {
    const dx = x - s.x, dz = z - s.z;
    if (dx * dx + dz * dz > 25600) continue;
    const lu = dx * s.tx + dz * s.tz, lv = dx * s.tz - dz * s.tx;
    if (Math.abs(lu) < 92 && lv > -4 && lv < 126) return true;
  }
  if (vegKept(x, z)) return true;
  if (h < 5 && pierYAt(x, z) !== null) return true;
  if (h < 6) for (const id in IS.piers) { const P = IS.piers[id]; if ((x - P.x) ** 2 + (z - P.z) ** 2 < 2500) return true; }   // у корня пирса — кассы и навесы
  return false;
}
// расстояние до дороги для леса: к грунтовке (дорога на Као Пом, подъезд к ферме) лес подходит вплотную — на 12 м ближе, чем к асфальту
function jungleRoadDist(x, z) { const h = roadAt(x, z); return h ? h.d + (h.road.dirt ? 12 : 0) : Infinity; }
// что вырастет в узле (i, j) сетки деревьев: null или { kind, x, z, y, H, ws, lean… }. Одни и те же числа — всегда одно и то же
function jungleTreeAt(i, j) {
  const S = JG.TREE_S, r = (k) => hash2(i * 7 + k * 131, j * 13 + k * 17);
  const x = (i + 0.15 + 0.7 * r(1)) * S, z = (j + 0.15 + 0.7 * r(2)) * S, h = groundY(x, z);
  if (h < 1.5) return null;
  const rd = jungleRoadDist(x, z);
  if (rd < JG.ROAD || (rd < JG.ROAD_FULL && r(3) > (rd - JG.ROAD) / (JG.ROAD_FULL - JG.ROAD))) return null;
  const zone = jungleZone(x, z, h, r(4)), p = r(5), q = r(6);
  let kind = null;
  if (zone === 4) { if (p < 0.3) kind = q < 0.5 ? 'cocoA' : 'cocoB'; }
  else if (zone === 0) { if (p < 0.035) kind = q < 0.5 ? 'round' : q < 0.8 ? 'cocoA' : 'layered'; }
  else if (zone === 1) {                                                   // плантация: ряды через 8.5 м, местами прогалы
    if (p < 0.88) kind = q < 0.55 ? 'cocoA' : 'cocoB';
  } else if (zone === 2) { if (p < 0.72) kind = q < 0.3 ? 'round' : q < 0.5 ? 'layered' : q < 0.68 ? 'fishtail' : q < 0.82 ? 'bamboo' : q < 0.95 ? 'cocoA' : 'ficus'; }
  else {
    const dense = 0.74 + 0.24 * vnoise(x / 60, z / 60, 4096);
    if (p < dense) kind = q < 0.42 ? 'round' : q < 0.68 ? 'layered' : q < 0.78 ? 'fishtail' : q < 0.85 ? 'bamboo' : q < 0.92 ? 'ficus' : q < 0.97 ? 'yang' : 'cocoB';
  }
  if (!kind || jungleBlocked(x, z, h)) return null;
  const K = JG_TREES[kind], la = r(9) * 6.283, lean = (zone === 4 ? 0.12 + 0.2 * r(10) : K.kind === 'palm' ? 0.03 + 0.12 * r(10) : 0.04 * r(10));
  return { kind, K, x, z, y: h, H: K.h[0] + (K.h[1] - K.h[0]) * r(7), ws: K.ws[0] + (K.ws[1] - K.ws[0]) * r(8), lx: Math.cos(la) * lean, lz: Math.sin(la) * lean,
    ang: r(11) * Math.PI, flip: r(12) < 0.5, tint: [0.8 + 0.3 * r(13), 0.82 + 0.26 * r(14), 0.74 + 0.3 * r(15)], ph: r(16) * 6.28 };
}
function jungleUnderAt(i, j) {
  const S = JG.UNDER_S, r = (k) => hash2(i * 11 + k * 71 + 3, j * 5 + k * 29 + 9);
  const x = (i + 0.1 + 0.8 * r(1)) * S, z = (j + 0.1 + 0.8 * r(2)) * S, h = groundY(x, z);
  if (h < 1.5) return null;
  const rd = jungleRoadDist(x, z);
  if (rd < JG.ROAD - 3) return null;
  const zone = jungleZone(x, z, h, r(4)), p = r(5), q = r(6);
  let kind = null;
  if (zone === 4) { if (p < 0.12) kind = 'grass'; }
  else if (zone === 0) { if (p < 0.42) kind = q < 0.86 ? 'grass' : q < 0.95 ? 'sapling' : 'banana'; }
  else if (zone === 1) { if (p < 0.3) kind = q < 0.72 ? 'grass' : q < 0.82 ? 'stump' : q < 0.92 ? 'sapling' : 'banana'; }
  else if (zone === 2) { if (p < 0.62) kind = q < 0.3 ? 'banana' : q < 0.5 ? 'alocasia' : q < 0.64 ? 'sapling' : q < 0.76 ? 'heliconia' : q < 0.88 ? 'ginger' : 'fern'; }
  else if (p < 0.5) kind = q < 0.26 ? 'alocasia' : q < 0.46 ? 'sapling' : q < 0.62 ? 'fern' : q < 0.78 ? 'ginger' : q < 0.9 ? 'banana' : 'heliconia';
  if (!kind || jungleBlocked(x, z, h)) return null;
  const K = JG_UNDER[kind];
  return { kind, K, x, z, y: h, H: K.h[0] + (K.h[1] - K.h[0]) * r(7), ws: K.ws[0] + (K.ws[1] - K.ws[0]) * r(8), ang: r(11) * Math.PI, flip: r(12) < 0.5,
    tint: [0.8 + 0.3 * r(13), 0.84 + 0.24 * r(14), 0.74 + 0.3 * r(15)], ph: r(16) * 6.28 };
}

// ---------- геометрия клетки ----------
function jungleBuf() { return { pos: [], uv: [], col: [], sway: [], phase: [], idx: [] }; }
// две скрещённые карточки растения; row — ряд атласа (0 — деревья, 1 — подлесок)
function jungleCards(b, p, row) {
  const K = p.K, ch = p.H / K.fill, cw = ch * (row === 0 ? 0.5 : 1) * p.ws;
  const u0 = (K.col * 64 + 0.5) / 512, u1 = (K.col * 64 + 63.5) / 512, v0 = row === 0 ? 0.5 + 0.5 / 256 : 0.25 + 0.5 / 256, v1 = row === 0 ? 1 - 0.5 / 256 : 0.5 - 0.5 / 256;
  const sw = K.sway * (0.5 + ch * 0.05), tx = (p.lx || 0) * ch, tz = (p.lz || 0) * ch;
  for (let k = 0; k < 2; k++) {
    const a = p.ang + k * Math.PI / 2, dx = Math.cos(a) * cw / 2, dz = Math.sin(a) * cw / 2, base = b.pos.length / 3, f = p.flip !== (k === 1);
    b.pos.push(p.x - dx, p.y - 0.05, p.z - dz, p.x + dx, p.y - 0.05, p.z + dz, p.x - dx + tx, p.y + ch, p.z - dz + tz, p.x + dx + tx, p.y + ch, p.z + dz + tz);
    b.uv.push(f ? u1 : u0, v0, f ? u0 : u1, v0, f ? u1 : u0, v1, f ? u0 : u1, v1);
    for (let q = 0; q < 4; q++) { b.col.push(p.tint[0], p.tint[1], p.tint[2]); b.sway.push(q < 2 ? 0 : sw); b.phase.push(p.ph); }
    b.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  if (row === 0) {                                                       // вид сверху: карточка плашмя в кроне
    const s = cw * K.topS / 2, y = p.y + p.H * K.topY, cx = p.x + (p.lx || 0) * p.H * K.topY, cz = p.z + (p.lz || 0) * p.H * K.topY, base = b.pos.length / 3;
    const c = Math.cos(p.ang) * s, sn = Math.sin(p.ang) * s, tu0 = (K.top * 64 + 0.5) / 512, tu1 = (K.top * 64 + 63.5) / 512;
    b.pos.push(cx - c + sn, y, cz - sn - c, cx + c + sn, y, cz + sn - c, cx - c - sn, y + 0.1, cz - sn + c, cx + c - sn, y + 0.1, cz + sn + c);
    b.uv.push(tu0, 0.5 / 256, tu1, 0.5 / 256, tu0, 0.25 - 0.5 / 256, tu1, 0.25 - 0.5 / 256);
    for (let q = 0; q < 4; q++) { b.col.push(p.tint[0], p.tint[1], p.tint[2]); b.sway.push(sw); b.phase.push(p.ph); }
    b.idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
}
function jungleMesh(b) {
  const geo = new THREE.BufferGeometry(), n = b.pos.length / 3, up = new Float32Array(n * 3);
  for (let i = 1; i < up.length; i += 3) up[i] = 1;                     // нормали — вверх: растение освещено ровно, с какой стороны ни смотри
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(up, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  geo.setAttribute('aSway', new THREE.Float32BufferAttribute(b.sway, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(b.phase, 1));
  geo.setIndex(b.idx);
  return new THREE.Mesh(geo, JG.mat);
}
// обломки сломанного дерева: ствол — в щепу, крона — в лоскуты листвы, у кокосовых пальм — орехи
// Дерево выше TALL_TREE ломается в два приёма: ствол сразу разлетается крупной щепой, а крона отваливается, падает целиком
// и рассыпается уже на земле — на листву и древесную щепу вперемешку (jungleCrown). Низкие — как раньше, сразу целиком.
function junglePieces(out, p, crown = true) {
  const K = p.K, th = p.H * K.trunk, n = Math.max(3, Math.min(7, Math.round(th / 1.8))), up = new THREE.Quaternion();
  const bark = new THREE.Color(K.bark), tall = p.H > TALL_TREE;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, y = p.y + th * t, w = Math.min(0.6, p.K.r * 1.7) * (1 - 0.35 * t);
    shatter(out, p.x + p.lx * th * t, y, p.z + p.lz * th * t, w, th / n, w, up, bark, 'wood', K.kind === 'bamboo' ? 1.2 : 1.8, tall ? 1.9 : 1);
  }
  if (crown) jungleCrown(out, p, 0, 0, 0, false);
}
// обломки кроны; (hx, hy, hz) — на сколько она сместилась, пока падала; mixed — с древесной щепой веток
function jungleCrown(out, p, hx, hy, hz, mixed) {
  const K = p.K, bark = new THREE.Color(K.bark), leaf = new THREE.Color(K.leaf).multiply(new THREE.Color(p.tint[0], p.tint[1], p.tint[2])), R = Math.random;
  const cw = p.H / K.fill * 0.5 * p.ws * 0.5, cx = p.x + p.lx * p.H + hx, cz = p.z + p.lz * p.H + hz, gy = groundY(cx, cz);
  const cy = Math.max(gy + p.H * (K.topY - K.trunk) * 0.5 + 0.3, p.y + p.H * K.topY + hy);
  if (mixed) for (let k = 0; k < 5; k++) {                                // ветки — щепой
    const a = R() * 6.283, d = R() * cw * 0.6;
    shatter(out, cx + Math.cos(a) * d, gy + 0.4 + R() * (cy - gy), cz + Math.sin(a) * d, 0.2, cw * (0.5 + R() * 0.5), 0.2, new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 3, a, R() * 3)), bark, 'wood', 0.6, 1.4);
  }
  for (let k = 0; k < 26; k++) {
    const a = R() * 6.283, d = R() * cw, len = cw * (0.25 + R() * 0.5);
    out.push({ shape: 3, x: cx + Math.cos(a) * d, y: cy + (R() - 0.4) * p.H * 0.25, z: cz + Math.sin(a) * d, sx: len, sy: 0.25 + R() * 0.3, sz: 0.3 + R() * 0.5,
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, (R() - 0.5) * 0.8, 'YZX')), c: leaf.clone().multiplyScalar(0.8 + R() * 0.35) });
  }
  if (K.nuts) for (let k = 0; k < 5; k++) out.push({ shape: 2, x: cx + (R() - 0.5), y: cy - 0.5, z: cz + (R() - 0.5), sx: 0.3, sy: 0.3, sz: 0.3, q: null, c: new THREE.Color(k % 2 ? '#9dac66' : '#67743b') });
}
// ствол убран, крона падает: карточки дерева обрезаются снизу до кроны (и картинка на них тоже) и отдаются в падение
function jungleFall(chunk, p, v0, v1) {
  const K = p.K, geo = chunk.trees.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, th = p.H * K.trunk, ch = p.H / K.fill, f = th / ch;
  const A = pos.array, U = uv.array;
  for (let k = 0; k < 2; k++) for (let q = 0; q < 2; q++) {              // нижние вершины двух скрещённых карточек
    const i = v0 + k * 4 + q, top = i + 2;
    A[i * 3] += (A[top * 3] - A[i * 3]) * f; A[i * 3 + 1] = p.y + th; A[i * 3 + 2] += (A[top * 3 + 2] - A[i * 3 + 2]) * f;
    U[i * 2 + 1] += (U[top * 2 + 1] - U[i * 2 + 1]) * f;
  }
  uv.updateRange.offset = 0; uv.updateRange.count = -1; uv.needsUpdate = true;
  const px = p.x + p.lx * th, pz = p.z + p.lz * th;
  addFaller({ parts: [[pos, v0, v1]], px, py: p.y + th, pz, drop: th - 0.3,
    land: (hx, hy, hz) => { const out = []; jungleCrown(out, p, hx, hy, hz, true); burstDebris(out, p.x + p.lx * p.H + hx, p.z + p.lz * p.H + hz, 2.5 + p.H * 0.12); } });
}
// Клетка строится по частям: jungleStart заводит работу, jungleStep продвигает её ряд за рядом, пока не выйдет время
// (until — отметка performance.now()), и возвращает, готова ли клетка. Так подгрузка леса на ходу не даёт рывков:
// раньше клетка целиком строилась в одном кадре (15–55 мс). jungleChunk — клетка сразу целиком (после переноса машины).
function jungleStart(cx, cz) {
  const CH = JG.CH, x0 = cx * CH, z0 = cz * CH;
  return { key: cx + ',' + cz, x0, z0, T: jungleBuf(), U: jungleBuf(), row: 0, i: Math.ceil(x0 / JG.TREE_S), ms: 0,
    chunk: { cx, cz, x: x0 + CH / 2, z: z0 + CH / 2, trees: null, under: null, breaks: [] } };
}
function jungleStep(job, until) {
  const t0 = performance.now(), CH = JG.CH, { x0, z0, T, U, chunk } = job, breaks = chunk.breaks;
  for (; job.row < 2; job.row++, job.i = Math.ceil(x0 / JG.UNDER_S)) {
    const S = job.row ? JG.UNDER_S : JG.TREE_S;
    while (job.i * S < x0 + CH) {
      const i = job.i++;
      for (let j = Math.ceil(z0 / S); j * S < z0 + CH; j++) {
        if (job.row) { const p = jungleUnderAt(i, j); if (p) jungleCards(U, p, 1); continue; }
        const p = jungleTreeAt(i, j);
        if (!p) continue;
        const v0 = T.pos.length / 3;
        jungleCards(T, p, 0);
        const v1 = T.pos.length / 3, K = p.K;
        if (K.solid) for (const f of bananas) if (Math.abs(f.x - p.x) < K.r + 1.2 && Math.abs(f.z - p.z) < K.r + 1.2) { f.x += K.r + 2.2; seatBanana(f); }   // плод не должен оказаться в твёрдом стволе
        breaks.push(addBreakable({ kind: K.kind || 'tree', mat: 'wood', x: p.x, z: p.z, r: K.r, loss: K.loss || 0, solid: !!K.solid,
          hide() { if (!chunk.trees) return; if (p.H > TALL_TREE && K.trunk > 0.15) jungleFall(chunk, p, v0, v1); else collapseVerts(chunk.trees.geometry.attributes.position, v0, v1, p.x, -200, p.z); },
          pieces(out) { junglePieces(out, p, !(p.H > TALL_TREE && K.trunk > 0.15)); } }, false));
      }
      if (performance.now() >= until && (job.row < 1 || job.i * S < x0 + CH)) { job.ms += performance.now() - t0; return false; }
    }
  }
  if (T.idx.length) { chunk.trees = jungleMesh(T); scene.add(chunk.trees); }
  if (U.idx.length) { chunk.under = jungleMesh(U); scene.add(chunk.under); }
  JG.built++; JG.ms += job.ms + performance.now() - t0;
  return true;
}
function jungleChunk(cx, cz) { const job = jungleStart(cx, cz); jungleStep(job, Infinity); return job.chunk; }
function jungleDrop(chunk) {
  for (const m of [chunk.trees, chunk.under]) if (m) { scene.remove(m); m.geometry.dispose(); }
  dropBreakables(chunk.breaks);
}

// ---------- запуск и обновление ----------
function buildJungle() {
  const mat = lambert({ map: jungleAtlas(), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
  JG.mat = windy(mat);
  const wind = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh) => {                                         // обе стороны карточки освещены одинаково
    wind(sh);
    sh.fragmentShader = sh.fragmentShader.replace('( gl_FrontFacing ) ? vIndirectFront : vIndirectBack', 'vIndirectFront').replace('( gl_FrontFacing ) ? vLightFront : vLightBack', 'vLightFront');
  };
  // кокосы и бананы растут и в глубине острова: под плантациями и в зарослях (точки — из той же расстановки)
  const T = TERRAIN, rnd = seededRandom(515);
  for (let n = 0; n < 9000 && (cocoPalms.length < 1400 || bananaPlants.length < 1100); n++) {
    const x = T.x0 + rnd() * (T.nx - 1) * T.step, z = T.z0 + rnd() * (T.nz - 1) * T.step, h = groundY(x, z);
    if (h < 3.2 || roadDist(x, z) < JG.ROAD) continue;
    const zone = jungleZone(x, z, h, rnd());
    if (zone === 1 && !jungleBlocked(x, z, h)) cocoPalms.push([x, z]); else if (zone === 2 && rnd() < 0.5 && !jungleBlocked(x, z, h)) bananaPlants.push([x, z]);
  }
}
function updateJungle() {
  if (!JG.mat) return;
  const CH = JG.CH, px = camPos.x, pz = camPos.z, R = JG.SEEN + CH * 0.71, t0 = performance.now();
  const jump = !JG.last || Math.hypot(px - JG.last[0], pz - JG.last[1]) > 150;   // перенеслись — ближние клетки строим сразу
  JG.last = [px, pz];
  const want = [];
  for (let cx = Math.floor((px - R) / CH); cx <= Math.floor((px + R) / CH); cx++) for (let cz = Math.floor((pz - R) / CH); cz <= Math.floor((pz + R) / CH); cz++) {
    const d = Math.hypot((cx + 0.5) * CH - px, (cz + 0.5) * CH - pz);
    if (d < R && !JG.chunks.has(cx + ',' + cz)) want.push([d, cx, cz]);
  }
  want.sort((a, b) => a[0] - b[0]);
  if (JG.job && Math.hypot(JG.job.chunk.x - px, JG.job.chunk.z - pz) > R + CH) { dropBreakables(JG.job.chunk.breaks); JG.job = null; }   // начатая клетка осталась далеко позади
  const until = Math.min(t0 + 4, STILL.until);                            // на подгрузку леса — не больше 4 мс кадра (и общий срок подгрузки)
  for (const [d, cx, cz] of want) {
    const key = cx + ',' + cz, near = jump && d < 420;
    if (!near && performance.now() >= until) break;                       // остальные — в следующих кадрах
    if (JG.job && JG.job.key !== key && !near) { if (!jungleStep(JG.job, until)) break; JG.chunks.set(JG.job.key, JG.job.chunk); JG.job = null; }   // сначала — начатая
    if (JG.chunks.has(key)) continue;
    const job = JG.job && JG.job.key === key ? JG.job : jungleStart(cx, cz);
    if (jungleStep(job, near ? Infinity : until)) { JG.chunks.set(key, job.chunk); if (JG.job === job) JG.job = null; }
    else JG.job = job;
  }
  if (JG.job && !want.length) { if (jungleStep(JG.job, until)) { JG.chunks.set(JG.job.key, JG.job.chunk); JG.job = null; } }
  for (const [key, c] of JG.chunks) {
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d > R + CH) { jungleDrop(c); JG.chunks.delete(key); continue; }
    if (c.under) c.under.visible = d < JG.UNDER_SEEN + CH * 0.71;
  }
}
