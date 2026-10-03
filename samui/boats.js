// Суда и лодки Самуи — по фото из refs/pier_* и refs/hua_thanon.
// Корпус — не коробка: обводы натянуты на шпангоуты (острый нос с подъёмом и выносом, транец или острая корма,
// днище, ватерлиния, полоса по привальному брусу). Надстройки, мачты, моторы, тенты и надписи — тоже геометрией.
// Каждое судно собирается в один буфер с цветом в вершинах: одна отрисовка на судно.
// Оси модели: +x — нос, y — вверх (0 — уровень воды), z — борт. Плановые размеры — в масштабе острова.
// Файл подключается до основного скрипта и только объявляет функции.

let SHIP_MAT = null;
function shipyard() {
  // вершины и цвета пишутся сразу в типизированные массивы, которые растут вдвое (n — сколько чисел уже занято):
  // так собирается вся застройка острова, и обычные массивы с переводом в Float32 в конце обходились дороже
  let pos = new Float32Array(576), col = new Float32Array(576), n = 0;
  const C = new THREE.Color(), dry = shipyard.dry;      // dry — «сухой» прогон: только счёт вершин (см. later в основном скрипте)
  const tri = (a, b, c, color) => {
    if (dry) { n += 9; return; }
    C.set(color);
    if (n + 9 > pos.length) { const p = new Float32Array(pos.length * 2), q = new Float32Array(pos.length * 2); p.set(pos); q.set(col); pos = p; col = q; }
    pos[n] = a[0]; pos[n + 1] = a[1]; pos[n + 2] = a[2]; pos[n + 3] = b[0]; pos[n + 4] = b[1]; pos[n + 5] = b[2]; pos[n + 6] = c[0]; pos[n + 7] = c[1]; pos[n + 8] = c[2];
    const r = C.r, g = C.g, bl = C.b;
    col[n] = r; col[n + 1] = g; col[n + 2] = bl; col[n + 3] = r; col[n + 4] = g; col[n + 5] = bl; col[n + 6] = r; col[n + 7] = g; col[n + 8] = bl;
    n += 9;
  };
  const quad = (a, b, c, d, color) => { tri(a, b, c, color); tri(a, c, d, color); };
  // коробка: размеры по x, y, z; центр; поворот вокруг z (дифферент) и вокруг y (в плане)
  function box(w, h, d, x, y, z, color, rz = 0, ry = 0) {
    const cz = Math.cos(rz), sz = Math.sin(rz), cy = Math.cos(ry), sy = Math.sin(ry), P = [];
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) for (const s3 of [-1, 1]) {
      const px = s1 * w / 2, py = s2 * h / 2, pz = s3 * d / 2, qx = px * cz - py * sz, qy = px * sz + py * cz;
      P.push([x + qx * cy + pz * sy, y + qy, z - qx * sy + pz * cy]);
    }
    for (const [a, b, c, e] of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) quad(P[a], P[b], P[c], P[e], color);
  }
  // рубка-призма: низ x0..x1 × ±w0 на высоте y0, верх уже на rakeA с кормы и rakeF с носа, × ±w1 на высоте y1
  function house(x0, x1, y0, y1, w0, w1, rakeF, rakeA, color, zc = 0) {
    const a0 = x0 + rakeA, a1 = x1 - rakeF;
    const P = [[x0, y0, zc - w0], [x0, y0, zc + w0], [x1, y0, zc + w0], [x1, y0, zc - w0], [a0, y1, zc - w1], [a0, y1, zc + w1], [a1, y1, zc + w1], [a1, y1, zc - w1]];
    for (const [a, b, c, e] of [[4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [0, 1, 5, 4], [3, 7, 6, 2]]) quad(P[a], P[b], P[c], P[e], color);
  }
  // труба или толстая мачта: вертикальный усечённый конус
  function tube(x, y0, y1, z, r0, r1, color, n = 8, lean = 0) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, dx = lean * (y1 - y0);
      quad([x + Math.cos(a) * r0, y0, z + Math.sin(a) * r0], [x + Math.cos(b) * r0, y0, z + Math.sin(b) * r0],
        [x + dx + Math.cos(b) * r1, y1, z + Math.sin(b) * r1], [x + dx + Math.cos(a) * r1, y1, z + Math.sin(a) * r1], color);
      tri([x + dx, y1, z], [x + dx + Math.cos(a) * r1, y1, z + Math.sin(a) * r1], [x + dx + Math.cos(b) * r1, y1, z + Math.sin(b) * r1], color);
    }
  }
  // тонкая балка между двумя точками (мачты, реи, растяжки, леера)
  function rod(a, b, t, color) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    box(len, t, t, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, color, Math.asin(dy / len), Math.atan2(-dz, dx));
  }
  // леерное ограждение вдоль x: стойки и два прутка, на обоих бортах (z = ±hw) или на одном
  function rail(x0, x1, y, hw, color, h = 0.9, step = 1.6, sides = [-1, 1]) {
    const n = Math.max(1, Math.round((x1 - x0) / step));
    for (const s of sides) {
      for (let i = 0; i <= n; i++) box(0.06, h, 0.06, x0 + (x1 - x0) * i / n, y + h / 2, s * hw, color);
      box(x1 - x0, 0.05, 0.05, (x0 + x1) / 2, y + h, s * hw, color);
      box(x1 - x0, 0.04, 0.04, (x0 + x1) / 2, y + h * 0.5, s * hw, color);
    }
  }
  // полоса окон вокруг рубки: тёмная лента по бортам (и спереди), с белыми простенками
  function windows(x0, x1, y, h, hw, front = false, piers = 1.4, dark = '#1c2a36', light = '#f2f2ee') {
    for (const s of [-1, 1]) {
      box(x1 - x0, h, 0.06, (x0 + x1) / 2, y, s * (hw + 0.02), dark);
      if (piers) for (let x = x0 + piers; x < x1 - 0.3; x += piers) box(0.14, h + 0.02, 0.08, x, y, s * (hw + 0.03), light);
    }
    if (front) box(0.06, h, hw * 2, x1 + 0.02, y, 0, dark);
  }
  // надпись пиксельным шрифтом приборов по борту: sd = +1 правый борт (z+), −1 левый. z — либо число (плоская стенка),
  // либо функция (x, y) -> полуширина корпуса в этой точке: тогда надпись лежит на самой обшивке и повторяет её изгиб
  function text(str, xMid, y, z, px, color, sd) {
    const glyphs = hudText(str), w = hudWidth(glyphs) * px, zf = typeof z === 'function' ? (x, yy) => sd * (z(x, yy) + 0.03) : () => z;
    let u = -w / 2;
    for (const rows of glyphs) {
      rows.forEach((row, r) => [...row].forEach((b, i) => {
        if (b !== '1') return;
        const xa = xMid + sd * (u + i * px), xb = xMid + sd * (u + (i + 1) * px), ya = y - r * px, yb = y - (r + 1) * px;
        quad([xa, ya, zf(xa, ya)], [xb, ya, zf(xb, ya)], [xb, yb, zf(xb, yb)], [xa, yb, zf(xa, yb)], color);
      }));
      u += (rows[0].length + 1) * px;
    }
  }
  // Корпус по шпангоутам.
  //   L, B — длина и ширина; free — высота борта над водой на миделе; draft — осадка;
  //   full — полнота обводов: 0 — «V», 1 — коробка; bowFrom — с какой доли длины борта сходятся к носу;
  //   entry — острота носа (1.3 — нож, 2.6 — тупой); bowRise, rake — подъём и вынос носа;
  //   stern — ширина транца в долях B (0 — острая корма), sternTo — до какой доли длины корма сужается, sternRise — её подъём;
  //   wall — высота фальшборта над палубой; bootTop — верх ватерлинейной полосы; sheerH — ширина полосы по привальному брусу.
  // Возвращает: at(x) -> { half — полуширина палубы, rim — полуширина по верху борта, top — высота борта, deck — высота палубы };
  // side(x, y) — полуширина корпуса на высоте y; fit(x0, x1, запас) — какой полуширины надстройка помещается на палубе.
  function hull(o) {
    const N = o.n || 18, p = (1 - 0.75 * o.full) / (1 + 1.5 * o.full), st = [];
    const bands = [o.bottom, o.bottom, o.boot, o.side, o.side, o.sheer];
    for (let i = 0; i <= N; i++) {
      const s = i / N, tb = Math.max(0, (s - o.bowFrom) / (1 - o.bowFrom)), ts = Math.max(0, 1 - s / o.sternTo);
      const half = o.B / 2 * Math.max(0, Math.min(1 - Math.pow(tb, o.entry), o.stern + (1 - o.stern) * (1 - ts * ts)));
      const top = o.free + o.bowRise * Math.pow(Math.max(0, (s - 0.45) / 0.55), 2.2) + (o.sternRise || 0) * Math.pow(Math.max(0, 1 - s / 0.4), 2);
      const keel = -o.draft + (top + o.draft) * (0.85 * Math.pow(tb, 3) + (o.stern < 0.3 ? 0.6 * Math.pow(ts, 3) : 0.2 * ts * ts));
      const x = (s - 0.5) * o.L, rake = o.rake * Math.pow(tb, 1.6) - (o.sternRake || 0) * ts * ts, hgt = Math.max(1e-3, top - keel);
      const yS = top - (o.sheerH || 0.15), yB = o.bootTop || 0.25;
      const lev = [keel, (keel + 0.02) / 2, 0.02, Math.min(yB, yS), (Math.min(yB, yS) + yS) / 2, yS, top];
      for (let k = 1; k < lev.length; k++) lev[k] = Math.min(top, Math.max(lev[k], lev[k - 1]));
      const pt = (y) => { const t = (y - keel) / hgt; return [x + rake * t, y, half * Math.pow(t, p)]; };
      const yd = Math.max(keel, top - (o.wall || 0));
      st.push({ x, half, top, keel, hgt, pts: lev.map(pt), deck: pt(yd) });
    }
    const mir = (q) => [q[0], q[1], -q[2]];
    for (let i = 0; i < N; i++) {
      const A = st[i], Bt = st[i + 1];
      for (let k = 0; k < bands.length; k++) {
        quad(A.pts[k], A.pts[k + 1], Bt.pts[k + 1], Bt.pts[k], bands[k]);
        quad(mir(A.pts[k]), mir(Bt.pts[k]), mir(Bt.pts[k + 1]), mir(A.pts[k + 1]), bands[k]);
      }
      quad(mir(A.deck), A.deck, Bt.deck, mir(Bt.deck), o.deck);
    }
    if (st[0].half > 0.01) for (let k = 0; k < bands.length; k++) {         // транец
      const A = st[0];
      quad(mir(A.pts[k]), A.pts[k], A.pts[k + 1], mir(A.pts[k + 1]), k >= 3 ? (o.transom || bands[k]) : bands[k]);
    }
    const between = (x) => { const f = Math.max(0, Math.min(N - 1e-6, (x / o.L + 0.5) * N)), i = Math.floor(f); return [st[i], st[i + 1], f - i]; };
    const mix = (va, vb, u) => va + (vb - va) * u;
    return {
      at(x) {
        const [a, b, u] = between(x);
        return { half: mix(a.deck[2], b.deck[2], u), rim: mix(a.half, b.half, u), top: mix(a.top, b.top, u), deck: mix(a.deck[1], b.deck[1], u) };
      },
      side(x, y) {
        const [a, b, u] = between(x), z = (q) => q.half * Math.pow(Math.max(0, Math.min(1, (y - q.keel) / q.hgt)), p);
        return mix(z(a), z(b), u);
      },
      fit(x0, x1, margin = 0.12) { return Math.min(this.at(x0).half, this.at(x1).half, this.at((x0 + x1) / 2).half) - margin; },
      tip: st[N].pts[st[N].pts.length - 1],
    };
  }
  function mesh() {
    if (dry) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, n), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col.slice(0, n), 3));
    geo.computeVertexNormals();
    if (!SHIP_MAT) SHIP_MAT = lambert({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x1c1c1c });   // тени на белых бортах не проваливаются в серое
    return new THREE.Mesh(geo, SHIP_MAT);
  }
  return { tri, quad, box, house, tube, rod, rail, windows, text, hull, mesh, count: () => n / 3 };   // count — сколько вершин уже набрано
}
const pick = (rnd, list) => list[(rnd() * list.length) | 0];
// флаг Таиланда на флагштоке: пять полос
function thaiFlag(S, x, y, z, w = 0.7) {
  ['#c8202c', '#f2f2ee', '#24306e', '#24306e', '#f2f2ee', '#c8202c'].forEach((c, i) => S.box(w, 0.075, 0.03, x - w / 2, y - i * 0.075, z, c));
}
// покрышки-кранцы по борту
function tyres(S, xs, y, hw) {
  for (const x of xs) for (const s of [-1, 1]) { S.tube(x, y - 0.3, y + 0.3, s * (hw + 0.16), 0.3, 0.3, '#17171a', 6); }
}

// ---------- длиннохвостая лодка ----------
// Узкий деревянный корпус, высоко задранный нос с гирляндой лент, тент на стойках, автомобильный мотор на
// поворотной стойке с длинным валом и винтом за кормой.
function boatLongtail(rnd = Math.random) {
  const S = shipyard();
  const [side, stripe, inside] = pick(rnd, [['#3a2e24', '#c8402c', '#2aa8a0'], ['#b8322a', '#f2f2ea', '#2a8fc8'], ['#2a5a9a', '#f0d040', '#d8d2c0'], ['#6a4a2c', '#f2f2ea', '#3a9a70'], ['#1f7a78', '#f2f2ea', '#c8402c']]);
  const H = S.hull({ L: 10.5, B: 1.75, free: 0.5, draft: 0.28, full: 0.35, bowFrom: 0.45, entry: 1.5, bowRise: 1.45, rake: 1.5, stern: 0.5, sternTo: 0.3, sternRise: 0.3,
    wall: 0.3, bottom: '#2a2420', boot: '#e8e4d8', side, sheer: stripe, deck: inside, bootTop: 0.16, sheerH: 0.12 });
  const [tx, ty] = H.tip;
  S.box(1.2, 0.13, 0.15, tx + 0.45, ty + 0.3, 0, side, 0.6);                               // «клюв» — продолжение форштевня
  ['#d8242c', '#f0d040', '#2aa050', '#e85aa0', '#2a6adb'].forEach((c, i) => {             // гирлянда: повязки и свисающие ленты
    S.box(0.2, 0.2, 0.24, tx - 0.15 + i * 0.22, ty - 0.02 + i * 0.13, 0, c, 0.6);
    S.box(0.05, 0.75, 0.2, tx - 0.2 + i * 0.22, ty - 0.5 + i * 0.1, 0, c);
  });
  for (const x of [-2.6, -1.2, 0.4, 2.0]) S.box(0.26, 0.06, 2 * H.side(x, 0.34), x, 0.34, 0, '#b89a6a');   // банки — от борта до борта
  const tent = pick(rnd, ['#2a6adb', '#e8e4d8', '#d8a020', '#2aa8a0']);
  for (const x of [-2.5, -0.3, 1.9]) for (const s of [-1, 1]) S.rod([x, H.at(x).top - 0.05, s * (H.at(x).rim - 0.05)], [x, 1.84, s * 0.8], 0.06, '#b8b8b4');   // стойки тента — от планширя
  S.box(4.9, 0.07, 1.85, -0.3, 1.86, 0, tent);
  for (const s of [-1, 1]) S.box(4.9, 0.14, 0.05, -0.3, 1.78, s * 0.92, '#f2f2ea');             // кайма тента
  S.tube(1.9, 1.2, 1.65, 0.78, 0.26, 0.26, '#e86a1a', 6);                                      // спасательный круг на стойке
  // мотор: блок на стойке, руль-рычаг вперёд, длинный вал с винтом назад и вниз
  S.box(0.12, 0.9, 0.12, -4.55, 0.85, 0, '#5a5a5c');
  S.box(1.0, 0.5, 0.5, -4.5, 1.35, 0, '#34363a');
  S.box(0.3, 0.2, 0.3, -4.3, 1.68, 0, '#8a2a22');
  S.rod([-4.1, 1.45, 0], [-2.7, 1.25, 0], 0.06, '#8a8a88');
  S.rod([-4.9, 1.2, 0], [-8.6, -0.05, 0], 0.08, '#8a8a88');
  S.box(0.06, 0.5, 0.5, -8.6, -0.05, 0, '#b8a04a', 0.3);
  S.box(0.05, 1.7, 0.05, -5.0, 1.45, 0.55, '#b8b8b4');
  thaiFlag(S, -5.0, 2.25, 0.55, 0.6);
  return S.mesh();
}

// ---------- скоростной катер (спидбот) ----------
// Белый глиссирующий корпус с цветными полосами, жёсткая крыша на наклонных стойках, тёмное ветровое стекло,
// оранжевые жилеты на сиденьях, два-три чёрных подвесных мотора.
function boatSpeedboat(rnd = Math.random) {
  const S = shipyard();
  const [stripe, roof] = pick(rnd, [['#28a040', '#f4f4f0'], ['#1c4fa8', '#1c2c5a'], ['#d0242c', '#f4f4f0'], ['#e06a10', '#1c2c5a']]);
  const H = S.hull({ L: 10, B: 2.9, free: 1.0, draft: 0.4, full: 0.3, bowFrom: 0.5, entry: 2.0, bowRise: 0.5, rake: 1.3, stern: 0.92, sternTo: 0.2,
    wall: 0.5, bottom: '#1a1c22', boot: stripe, side: '#f4f4f0', sheer: stripe, deck: '#e6e4de', bootTop: 0.32, sheerH: 0.14 });
  const ws = H.fit(1.0, 2.5, 0.08);
  S.house(1.0, 2.5, 1.0, 1.85, ws, ws - 0.15, 0.7, 0.1, '#1c2a36');                          // ветровое стекло — во всю ширину палубы
  S.box(1.2, 0.5, 2 * H.fit(-0.1, 1.1, 0.2), 0.5, 0.85, 0, '#e6e4de');                       // пульт
  for (const x of [-3.2, -2.2, -1.2, -0.2]) for (const z of [-0.75, 0.75]) S.box(0.5, 0.55, 0.9, x, 0.85, z, '#e87a1a');   // жилеты на сиденьях
  for (const [x, lean] of [[2.2, -0.35], [-0.6, 0], [-3.4, 0.12]]) for (const s of [-1, 1]) S.rod([x, 0.95, s * (H.at(x).rim - 0.1)], [x + lean, 2.55, s * 1.25], 0.09, '#d8d8d4');
  S.box(6.4, 0.12, 2.75, -0.9, 2.6, 0, roof);
  S.box(6.5, 0.1, 2.85, -0.9, 2.52, 0, stripe);
  for (const z of [-0.85, 0, 0.85]) {                                                         // подвесные моторы
    S.box(0.8, 0.62, 0.46, -5.35, 1.15, z, '#15171b');
    S.box(0.82, 0.1, 0.48, -5.35, 1.0, z, '#d8d8d4');
    S.box(0.26, 1.15, 0.2, -5.5, 0.35, z, '#2a2c30');
  }
  for (const s of [-1, 1]) S.rod([4.9, 1.6, 0], [2.6, 1.35, s * (H.at(2.6).rim - 0.05)], 0.05, '#c8c8c4');   // носовой релинг
  S.box(0.04, 2.6, 0.04, -1.5, 3.9, 0.6, '#d8d8d4');                                          // антенна
  return S.mesh();
}

// ---------- расписная рыбацкая лодка (Хуа Танон) ----------
// Стройный корпус с высоким острым носом и приподнятой кормой, борта в цветную полоску, жерди с фонарями,
// сети и поплавки на палубе.
function boatFisher(rnd = Math.random) {
  const S = shipyard();
  const [side, boot, sheer] = pick(rnd, [['#1f8a8c', '#f2f2ea', '#e07a1a'], ['#2a5a9a', '#f2f2ea', '#c8402c'], ['#f2f2ea', '#2a8fc8', '#6a3a22'], ['#2a9a5a', '#f0d040', '#c8402c']]);
  const H = S.hull({ L: 9.5, B: 2.1, free: 0.7, draft: 0.35, full: 0.4, bowFrom: 0.4, entry: 1.5, bowRise: 1.2, rake: 1.3, stern: 0.22, sternTo: 0.35, sternRise: 0.65, sternRake: 0.5,
    wall: 0.3, bottom: '#3a2a22', boot, side, sheer, deck: '#a88a62', bootTop: 0.3, sheerH: 0.2 });
  const [tx, ty] = H.tip;
  S.box(0.9, 0.12, 0.14, tx + 0.3, ty + 0.25, 0, sheer, 0.7);
  ['#f0d040', '#d8242c', '#2aa050'].forEach((c, i) => S.box(0.05, 0.7, 0.18, tx - 0.25 + i * 0.2, ty - 0.45 + i * 0.08, 0, c));
  S.box(1.5, 0.9, 1.3, -2.3, 0.95, 0, '#d8d2c2');                                            // будка рулевого
  S.box(1.7, 0.08, 1.5, -2.3, 1.44, 0, sheer);
  S.box(0.9, 0.3, 0.05, -2.3, 1.1, 0.67, '#1c2a36'); S.box(0.9, 0.3, 0.05, -2.3, 1.1, -0.67, '#1c2a36');
  for (const [x, h] of [[0.6, 3.6], [-1.0, 3.0], [2.4, 2.6]]) {                               // жерди с фонарями для ночного лова
    S.box(0.07, h, 0.07, x, 0.6 + h / 2, 0.3, '#6a5a48');
    S.box(0.22, 0.24, 0.22, x, 0.6 + h - 0.2, 0.3, '#e88a1a');
    S.box(0.22, 0.24, 0.22, x, 0.6 + h - 0.65, 0.3, '#e88a1a');
  }
  S.rod([0.6, 4.1, 0.3], [3.6, 1.9, 0], 0.035, '#6a5a48'); S.rod([0.6, 4.1, 0.3], [-3.6, 1.6, 0], 0.035, '#6a5a48');
  S.box(1.6, 0.35, 1.2, 1.4, 0.72, 0, '#2a8a80'); S.box(0.9, 0.3, 0.9, 2.6, 0.75, 0.1, '#3a6a9a');   // сети
  for (let i = 0; i < 5; i++) S.box(0.24, 0.24, 0.24, 0.9 + i * 0.3, 0.98, -0.5 + (i % 2) * 0.25, i % 2 ? '#f2f2ea' : '#e86a1a');
  S.box(0.5, 0.4, 0.35, -4.2, 0.85, 0, '#34363a'); S.rod([-4.4, 0.8, 0], [-6.6, -0.1, 0], 0.07, '#8a8a88');   // мотор с валом
  S.box(0.05, 1.5, 0.05, -3.6, 1.7, -0.4, '#6a5a48');
  S.box(0.5, 0.36, 0.03, -3.85, 2.25, -0.4, '#f0d040');
  return S.mesh();
}

// ---------- рыболовный сейнер (Натон) ----------
// Пузатый деревянный корпус с высоким развалистым носом, борт в три цвета, двухъярусная рубка ближе к корме
// с леерами, мачты с грузовой стрелой и растяжками, гирлянда ламп, покрышки по бортам.
function boatTrawler(color = '#c8322a', rnd = Math.random) {
  const S = shipyard();
  const H = S.hull({ L: 13, B: 4.2, free: 1.5, draft: 0.9, full: 0.62, bowFrom: 0.5, entry: 1.9, bowRise: 1.5, rake: 1.3, stern: 0.72, sternTo: 0.25, sternRise: 0.4,
    wall: 0.55, bottom: '#5a1e1a', boot: '#f2f2ea', side: color, sheer: '#f2f2ea', deck: '#9a8464', bootTop: 0.34, sheerH: 0.3 });
  const d = H.at(-2.5).deck;
  S.box(13 * 0.72, 0.12, 0.06, -0.6, 1.02, 2.08, '#e07a1a'); S.box(13 * 0.72, 0.12, 0.06, -0.6, 1.02, -2.08, '#e07a1a');   // оранжевый пояс
  // рубка: нижний ярус с окнами, верхний — ходовая, с козырьком и леерами
  S.house(-5.2, -0.9, d, d + 2.0, 1.55, 1.5, 0.15, 0, '#e8e4d8');
  S.windows(-5.0, -1.1, d + 1.25, 0.5, 1.52, true, 1.0, '#22323e', '#3a8ac8');
  S.box(4.9, 0.1, 3.5, -3.1, d + 2.05, 0, '#3a8ac8');
  S.house(-4.4, -1.6, d + 2.1, d + 3.9, 1.2, 1.15, 0.25, 0, '#f2f2ea');
  S.windows(-4.3, -1.75, d + 3.2, 0.55, 1.18, true, 0.85);
  S.box(3.4, 0.1, 2.9, -3.0, d + 3.95, 0, color);
  S.rail(-5.3, -0.8, d + 2.1, 1.65, '#f2f2ea', 0.85, 1.1);
  // мачты, стрела, растяжки
  const top = d + 8.2;
  S.box(0.16, 6.2, 0.16, 1.6, d + 3.1, 0, '#c8402c'); S.box(0.12, 4.4, 0.12, -3.0, d + 6.1, 0, '#c8402c');
  S.rod([1.6, d + 1.2, 0], [5.4, d + 4.6, 0], 0.13, '#c8402c');                              // грузовая стрела
  S.rod([1.6, d + 6.2, 0], [5.4, d + 4.6, 0], 0.03, '#2a2a2a'); S.rod([1.6, d + 6.2, 0], [-3.0, top, 0], 0.03, '#2a2a2a');
  S.rod([-3.0, top, 0], [-6.3, d + 1.0, 0], 0.03, '#2a2a2a'); S.rod([1.6, d + 6.2, 0], [6.6, H.tip[1], 0], 0.03, '#2a2a2a');
  for (let i = 0; i < 7; i++) {                                                               // гирлянда ламп между мачтами
    const u = (i + 0.5) / 7;
    S.box(0.2, 0.26, 0.2, 1.6 + (-3.0 - 1.6) * u, d + 6.2 + (top - d - 6.2) * u - 0.2, 0, i % 2 ? '#f0e8c0' : '#58c070');
  }
  S.box(0.5, 0.36, 0.03, -3.3, top + 0.05, 0, '#f0d040'); S.box(0.05, 0.9, 0.05, -3.0, top + 0.15, 0, '#c8402c');
  S.box(1.6, 0.9, 1.2, 3.0, d + 0.45, 0, '#6a8a9a'); S.box(1.2, 0.5, 2.4, 0.2, d + 0.25, 0, '#2a8a80');   // лебёдка, сети
  S.box(0.5, 1.6, 0.5, -4.9, d + 4.7, 0.6, '#2a2a2c');                                        // труба
  tyres(S, [-3.6, -1.2, 1.2, 3.4], 0.9, 2.05);
  return S.mesh();
}

// ---------- автомобильный паром (Raja, Seatran) ----------
// Коробчатый белый корпус с чёрным днищем, открытая автомобильная палуба с проёмами в бортах, над ней два
// пассажирских яруса с окнами и леерами, рубка впереди наверху, труба и мачта, носовая аппарель поднята.
function boatCarFerry(o = {}) {
  const S = shipyard(), L = o.L || 22, B = o.B || 7, raja = o.livery !== 'seatran';
  const accent = raja ? '#b3202a' : '#1b4b80';
  S.hull({ L, B, free: 1.3, draft: 1.0, full: 0.88, bowFrom: 0.87, entry: 2.6, bowRise: 0.25, rake: 0.5, stern: 0.96, sternTo: 0.12,
    wall: 0, bottom: '#19181e', boot: accent, side: '#e9ebee', sheer: '#e9ebee', deck: '#6a7078', bootTop: 0.45, sheerH: 0.1 });
  const hw = B / 2, x0 = -L / 2 + 0.6, x1 = L / 2 - 2.6, car = 1.3;
  // борта автомобильной палубы: стенка с прямоугольными проёмами
  for (const s of [-1, 1]) {
    S.box(x1 - x0, 0.5, 0.2, (x0 + x1) / 2, car + 0.25, s * (hw - 0.1), '#e9ebee');
    S.box(x1 - x0, 0.45, 0.2, (x0 + x1) / 2, car + 2.3, s * (hw - 0.1), '#e9ebee');
    for (let x = x0; x <= x1 + 0.01; x += 2.2) S.box(0.5, 2.4, 0.2, x, car + 1.2, s * (hw - 0.1), '#e9ebee');
    S.box(x1 - x0, 1.6, 0.05, (x0 + x1) / 2, car + 1.3, s * (hw - 0.45), '#2a3038');           // тень внутри палубы
  }
  const d1 = car + 2.55, a0 = x0 + 0.5, a1 = x1 - 1.2;
  S.box(x1 - x0 + 0.6, 0.14, B + 0.3, (x0 + x1) / 2, d1 - 0.05, 0, '#d8dade');                  // палуба над машинами
  // первый пассажирский ярус
  S.house(a0 + 2.2, a1, d1, d1 + 2.0, hw - 0.9, hw - 0.9, 0.3, 0, '#f2f2ee');
  S.windows(a0 + 2.6, a1 - 0.5, d1 + 1.25, 0.6, hw - 0.9, true, 1.3);
  S.rail(a0, a1 + 0.8, d1, hw - 0.1, '#f2f2ee', 1.0, 1.4);
  S.box(a1 - a0 + 0.8, 0.12, B - 0.4, (a0 + a1) / 2 + 0.2, d1 + 2.06, 0, '#d8dade');
  // второй ярус и рубка
  const d2 = d1 + 2.12;
  S.house(a0 + 4.6, a1 - 2.2, d2, d2 + 1.9, hw - 1.6, hw - 1.6, 0.2, 0, '#f2f2ee');
  S.windows(a0 + 4.9, a1 - 2.6, d2 + 1.2, 0.55, hw - 1.6, false, 1.2);
  S.rail(a0 + 1.2, a1 + 0.2, d2, hw - 0.5, '#f2f2ee', 1.0, 1.4);
  S.house(a1 - 2.4, a1 + 0.3, d2, d2 + 2.1, hw - 0.7, hw - 0.9, 0.5, 0.1, '#f2f2ee');          // ходовая рубка с крыльями
  S.windows(a1 - 2.2, a1 - 0.25, d2 + 1.35, 0.6, hw - 0.82, true, 0.7);
  S.box(3.2, 0.12, B - 1.0, a1 - 1.1, d2 + 2.15, 0, '#d8dade');
  S.box(0.14, 3.2, 0.14, a1 - 1.3, d2 + 3.7, 0, '#e9ebee'); S.box(0.1, 0.1, 2.0, a1 - 1.3, d2 + 4.4, 0, '#e9ebee');   // мачта с реем
  S.box(0.5, 0.3, 0.9, a1 - 1.3, d2 + 3.0, 0, '#d8dade');                                      // радар
  // труба
  S.tube(a0 + 2.6, d2, d2 + 2.6, 0, 0.75, 0.6, '#16161a', 8, 0.12);
  S.tube(a0 + 2.6 + 0.2, d2 + 1.5, d2 + 2.1, 0, 0.69, 0.65, accent, 8, 0.12);
  S.box(0.16, 4.2, 0.16, a0 + 0.9, d2 + 2.1, 0, '#3a3a3c');                                    // высокая кормовая мачта
  for (const x of [a0 + 6.5, a0 + 9.5]) for (const s of [-1, 1]) S.tube(x, d1 + 0.7, d1 + 1.3, s * (hw - 0.15), 0.32, 0.32, '#e86a1a', 6);   // круги
  // аппарели: носовая поднята, кормовая — щит
  S.box(0.25, 3.4, B - 1.8, L / 2 - 0.9, car + 1.4, 0, '#8a9098', -0.42);
  S.box(0.2, 1.9, B - 1.6, -L / 2 + 0.25, car + 0.95, 0, '#8a9098');
  if (raja) {                                                                                 // красный осьминог по борту: голова у носа, щупальца волнами к корме
    for (const s of [-1, 1]) {
      const z = s * (hw + 0.03), hx = L * 0.3;
      S.box(2.0, 1.5, 0.05, hx, car + 1.25, z, accent); S.box(1.5, 0.5, 0.05, hx, car + 2.2, z, accent); S.box(1.2, 0.4, 0.05, hx + 0.1, car + 0.35, z, accent);
      S.box(0.34, 0.34, 0.06, hx + 0.5, car + 1.6, z, '#f2f2ee');
      for (const [y0, amp, ph] of [[car + 0.3, 0.14, 0], [car + 2.3, 0.12, 2]]) for (let i = 0; i < 40; i++) {
        const u = i / 39, x = hx - 1 - u * L * 0.55;
        S.box(0.36, 0.22 * (1.25 - u), 0.05, x, y0 + amp * Math.sin(u * 14 + ph), z, accent, -amp * 14 / (L * 0.55) * Math.cos(u * 14 + ph));
      }
      S.text('RAJA', -L * 0.2, d2 - 0.25, s * (hw - 0.86), 0.26, accent, s);
    }
  } else {
    for (const s of [-1, 1]) {
      S.box(L * 0.7, 0.3, 0.05, -0.6, 0.95, s * (hw + 0.03), accent);
      S.text('SEATRAN', -L * 0.12, d2 - 0.25, s * (hw - 0.86), 0.26, accent, s);
    }
  }
  return S.mesh();
}

// ---------- скоростной пассажирский паром (Seatran Discovery, Songserm Royal Jet) ----------
// Длинный острый корпус с выносом носа, цветной борт с надписью, белая обтекаемая надстройка в два яруса
// с лентами окон, мачта с радаром, открытый бак с леерами.
function boatFastFerry(o = {}) {
  const S = shipyard(), L = o.L || 20, B = o.B || 4.6, hullC = o.hull || '#c8141c', k = L / 20;
  const H = S.hull({ L, B, free: 1.5, draft: 0.7, full: 0.45, bowFrom: 0.7, entry: 1.5, bowRise: 0.9, rake: 2.6 * k, stern: 0.86, sternTo: 0.15,
    wall: 0.25, bottom: o.bottom || '#5a0e12', boot: hullC, side: hullC, sheer: '#f2f2ee', deck: '#c8cace', bootTop: 0.3, sheerH: 0.28 });
  const hw = B / 2, d = H.at(0).deck, a0 = -L / 2 + 1.2 * k, a1 = L * 0.24;
  S.house(a0, a1, d, d + 2.0, hw - 0.25, hw - 0.4, 2.6 * k, 0.2, '#f4f4f0');                   // главный салон, нос скошен
  S.windows(a0 + 0.6, a1 - 2.4 * k, d + 1.15, 0.6, hw - 0.3, false, 0);
  S.house(a1 - 2.3 * k, a1 - 0.9 * k, d + 0.75, d + 1.6, hw - 0.5, hw - 0.6, 0.9 * k, 0, '#1c2a36');   // скошенные носовые окна
  const d2 = d + 2.05;
  S.house(a0 + 2.2 * k, a1 - 4.2 * k, d2, d2 + 1.8, hw - 0.9, hw - 1.0, 1.2 * k, 0.3, '#f4f4f0');   // второй ярус
  S.windows(a0 + 2.8 * k, a1 - 6.2 * k, d2 + 1.05, 0.55, hw - 0.95, false, 1.7 * k);
  S.house(a1 - 5.4 * k, a1 - 3.9 * k, d2 + 0.7, d2 + 1.5, hw - 1.1, hw - 1.2, 0.7 * k, 0, '#1c2a36');
  S.box((a1 - a0) * 0.62, 0.1, B - 1.7, a0 + (a1 - a0) * 0.42, d2 + 1.85, 0, '#e2e4e8');
  S.rail(a0, a0 + 2.2 * k, d2, hw - 0.5, '#f2f2ee', 0.95, 1.1);                               // кормовая прогулочная палуба
  // мачта-арка с радаром и антеннами
  const mx = a0 + (a1 - a0) * 0.55, my = d2 + 1.9;
  S.rod([mx - 0.9, my, 0.8], [mx, my + 1.5, 0], 0.12, '#f2f2ee'); S.rod([mx - 0.9, my, -0.8], [mx, my + 1.5, 0], 0.12, '#f2f2ee');
  S.box(0.12, 1.6, 0.12, mx, my + 2.2, 0, '#f2f2ee'); S.box(0.9, 0.16, 0.3, mx + 0.1, my + 1.75, 0, '#d0d2d6');
  S.box(0.03, 1.6, 0.03, mx - 0.5, my + 0.9, 0.5, '#d0d2d6');
  // бак: леера, брашпиль, флагшток
  S.rail(a1 + 0.4, L / 2 + 1.2 * k, H.at(L * 0.4).deck, 0.2, '#e2e4e8', 0.9, 1.2, [0]);
  for (const s of [-1, 1]) S.rod([a1 + 0.2, d + 0.95, s * (hw - 0.5)], [L / 2 + 1.0 * k, H.at(L * 0.46).deck + 0.9, s * 0.3], 0.05, '#e2e4e8');
  S.box(1.1, 0.6, 1.4, a1 + 2.4 * k, d + 0.5, 0, '#8a9098');
  S.box(0.05, 1.5, 0.05, -L / 2 + 0.3, d + 1.0, 0, '#d0d2d6'); thaiFlag(S, -L / 2 + 0.3, d + 1.75, 0, 0.75);
  for (const x of [a0 + 3, a0 + 7 * k]) for (const s of [-1, 1]) S.tube(x, d + 0.35, d + 0.9, s * (hw - 0.2), 0.3, 0.3, '#e86a1a', 6);
  if (o.name) for (const s of [-1, 1]) S.text(o.name, -L * 0.12, 1.3, (x, y) => H.side(x, y), o.px || 0.3 * k, '#f4f4f0', s);
  return S.mesh();
}

// ---------- скоростной катамаран (Lomprayah) ----------
// Два узких корпуса, между ними широкий салон с тёмной лентой окон и скошенным носом, наверху открытая палуба
// с леерами и ходовой мостик; по бортам — синяя и красная «волна».
function boatCatamaran() {
  const S = shipyard(), L = 13, hz = 1.75;
  for (const s of [-1, 1]) {                                                                  // два корпуса: сдвигаем готовый буфер нельзя — строим дважды
    const T = shipyard();
    T.hull({ L, B: 1.5, free: 1.25, draft: 0.5, full: 0.5, bowFrom: 0.4, entry: 1.4, bowRise: 0.5, rake: 1.2, stern: 0.9, sternTo: 0.15,
      wall: 0, bottom: '#1a2a5a', boot: '#23308f', side: '#fbfbf8', sheer: '#fbfbf8', deck: '#e2e4e8', bootTop: 0.3, sheerH: 0.1 });
    const m = T.mesh(), p = m.geometry.attributes.position, c = m.geometry.attributes.color;
    for (let i = 0; i < p.count; i += 3) {
      const v = [0, 1, 2].map(k => [p.getX(i + k), p.getY(i + k), p.getZ(i + k) + s * hz]);
      S.tri(v[0], v[1], v[2], new THREE.Color(c.getX(i), c.getY(i), c.getZ(i)));
    }
    for (let i = 0; i < 14; i++) {                                                            // красная «волна» поверх синей
      const u = i / 13, x = -L * 0.36 + u * L * 0.7;
      S.box(0.72, 0.16, 0.04, x, 0.62 + 0.22 * Math.sin(u * 5.2), s * (hz + 0.74), '#b12036', 0.35 * Math.cos(u * 5.2));
    }
  }
  const d = 1.25, hw = hz + 0.7;
  S.box(L * 0.82, 0.3, hw * 2, -0.5, d - 0.1, 0, '#fbfbf8');                                   // мост между корпусами
  S.house(-L / 2 + 0.6, L * 0.3, d, d + 2.0, hw - 0.05, hw - 0.25, 2.6, 0.1, '#fbfbf8');       // салон
  S.windows(-L / 2 + 1.2, L * 0.3 - 2.4, d + 1.15, 0.75, hw - 0.12, false, 0);
  S.house(L * 0.3 - 2.5, L * 0.3 - 0.7, d + 0.7, d + 1.7, hw - 0.3, hw - 0.5, 1.3, 0, '#16222e');   // панорамный нос
  const d2 = d + 2.05;
  S.rail(-L / 2 + 0.7, 1.2, d2, hw - 0.3, '#e8eaee', 1.0, 1.1);
  S.box(0.06, 1.0, (hw - 0.3) * 2, -L / 2 + 0.7, d2 + 0.5, 0, '#e8eaee');
  for (const x of [-4.4, -3.2, -2.0, -0.8]) for (const z of [-1.2, 0, 1.2]) S.box(0.5, 0.45, 0.9, x, d2 + 0.25, z, '#3a6ab0');   // сиденья
  S.house(0.6, 2.8, d2, d2 + 1.5, 1.5, 1.35, 0.6, 0.1, '#fbfbf8');                             // мостик
  S.windows(0.8, 2.2, d2 + 0.95, 0.5, 1.45, true, 0);
  S.box(2.6, 0.1, 3.2, 1.5, d2 + 1.55, 0, '#e2e4e8');
  S.box(0.1, 1.6, 0.1, 1.2, d2 + 2.4, 0, '#e8eaee'); S.box(0.8, 0.15, 0.28, 1.3, d2 + 2.0, 0, '#d0d2d6');
  S.box(0.05, 1.3, 0.05, -L / 2 + 0.9, d2 + 1.5, 1.4, '#d0d2d6'); thaiFlag(S, -L / 2 + 0.9, d2 + 2.15, 1.4, 0.7);
  for (const s of [-1, 1]) {                                                                  // растяжка с названием на леерах
    S.box(8.2, 0.95, 0.04, -2.6, d2 + 0.52, s * (hw - 0.26), '#fbfbf8');
    S.text('LOMPRAYAH', -2.6, d2 + 0.93, s * (hw - 0.22), 0.2, '#23308f', s);
  }
  return S.mesh();
}

// ---------- большой паром (Seahorse «Blue Dolphin») ----------
// Белый высокий корпус с синей полосой, длинная надстройка в два-три яруса с рядами окон, мостик с крыльями,
// труба с синей эмблемой, мачта, кормовые ворота для машин.
function boatBigFerry(o = {}) {
  const S = shipyard(), L = o.L || 42, B = o.B || 8, navy = '#1f2a55';
  const H = S.hull({ L, B, free: 3.0, draft: 1.3, full: 0.8, bowFrom: 0.76, entry: 1.9, bowRise: 0.9, rake: 2.6, stern: 0.95, sternTo: 0.1, n: 22,
    wall: 0.6, bottom: '#1a1c24', boot: '#8a1a1e', side: '#eef0f2', sheer: '#eef0f2', deck: '#aab0b8', bootTop: 0.4, sheerH: 0.2 });
  const hw = B / 2, d = H.at(0).deck, a0 = -L / 2 + 1.5, a1 = L * 0.3;
  for (const s of [-1, 1]) {
    S.box(L * 0.7, 0.3, 0.05, -L * 0.08, 1.95, s * (hw - 0.02), navy);                          // синяя полоса
    for (let x = a0 + 2; x < a1; x += 2.4) S.box(0.9, 0.5, 0.05, x, 2.45, s * (H.side(x, 2.45) + 0.02), '#22303c');   // окна в борту
    S.text('SEAHORSE', -L * 0.22, 1.45, (x, y) => H.side(x, y), 0.4, navy, s);
  }
  S.house(a0, a1, d, d + 2.3, hw - 0.5, hw - 0.5, 1.2, 0.2, '#f4f4f2');
  S.windows(a0 + 1, a1 - 1.6, d + 1.35, 0.7, hw - 0.5, false, 2.0);
  S.rail(a0 - 0.6, a1 + 3, d, hw - 0.15, '#f4f4f2', 1.0, 2.0);
  const d2 = d + 2.4;
  S.box(a1 - a0 + 1.2, 0.14, B - 0.4, (a0 + a1) / 2, d2 - 0.05, 0, '#d8dade');
  S.house(a0 + 3, a1 - 2.5, d2, d2 + 2.2, hw - 1.3, hw - 1.3, 0.5, 0.3, '#f4f4f2');
  S.windows(a0 + 4, a1 - 3.6, d2 + 1.3, 0.65, hw - 1.3, false, 1.9);
  S.rail(a0 + 0.5, a1 - 1, d2, hw - 0.4, '#f4f4f2', 1.0, 2.0);
  const d3 = d2 + 2.3;
  S.house(a1 - 7.5, a1 - 2.2, d3, d3 + 2.2, hw - 0.6, hw - 0.9, 0.9, 0.2, '#f4f4f2');           // мостик с крыльями
  S.windows(a1 - 7.0, a1 - 3.2, d3 + 1.35, 0.7, hw - 0.75, true, 0.9);
  S.box(6.4, 0.14, B - 0.6, a1 - 5, d3 + 2.25, 0, '#d8dade');
  S.box(0.2, 4.4, 0.2, a1 - 5.5, d3 + 4.4, 0, '#eef0f2'); S.box(0.12, 0.12, 2.6, a1 - 5.5, d3 + 5.4, 0, '#eef0f2');
  S.box(1.2, 0.2, 0.36, a1 - 5.3, d3 + 3.4, 0, '#d0d2d6'); S.box(0.7, 0.5, 0.7, a1 - 5.5, d3 + 2.7, 0, '#d8dade');
  // труба с синей эмблемой и солнечная палуба на корме
  S.tube(a0 + 6, d2 + 2.2, d2 + 5.6, 0, 1.5, 1.1, '#f4f4f2', 10, 0.18);
  S.tube(a0 + 6.35, d2 + 4.1, d2 + 5.2, 0, 1.27, 1.14, navy, 10, 0.18);
  S.tube(a0 + 6.62, d2 + 5.6, d2 + 5.9, 0, 0.8, 0.75, '#1a1c24', 8, 0.18);
  for (let x = a0 + 9; x < a1 - 9; x += 2.4) for (const s of [-1, 1]) S.box(0.14, 1.9, 0.14, x, d3 + 0.95, s * (hw - 1.6), '#6a5a48');
  S.box(a1 - a0 - 20, 0.14, B - 2.8, (a0 + a1) / 2 + 0.5, d3 + 1.95, 0, '#8a6a48');             // навес из жердей
  S.box(0.3, 3.2, B - 2.4, -L / 2 + 0.35, 1.9, 0, '#2a3038');                                  // кормовые ворота
  for (const x of [a0 + 12, a0 + 18, a0 + 24]) for (const s of [-1, 1]) S.box(1.6, 0.7, 0.8, x, d2 + 0.5, s * (hw - 0.75), '#e86a1a');   // шлюпки
  S.box(0.06, 2.0, 0.06, L / 2 + 1.6, H.at(L * 0.47).deck + 1.4, 0, '#d0d2d6');
  return S.mesh();
}

// ---------- деревянное экскурсионное судно ----------
// Синий дощатый корпус с белой полосой, два открытых яруса на стойках с перилами, плоская крыша, мачта с флагом.
function boatTourBoat(rnd = Math.random) {
  const S = shipyard(), side = pick(rnd, ['#26466c', '#2a5a9a', '#1f6a78']);
  const H = S.hull({ L: 11, B: 3.1, free: 1.1, draft: 0.7, full: 0.55, bowFrom: 0.64, entry: 1.7, bowRise: 0.9, rake: 1.2, stern: 0.82, sternTo: 0.25, sternRise: 0.35,
    wall: 0.35, bottom: '#3a1e1a', boot: '#f2f2ea', side, sheer: '#f2f2ea', deck: '#a88a62', bootTop: 0.3, sheerH: 0.18 });
  const d = H.at(-1).deck, x0 = -4.5, x1 = 2.4, hw = H.fit(x0, x1, 0.1);
  for (const dk of [0, 1]) {                                                                  // два яруса: стойки, перила, настил
    const y = d + dk * 2.1;
    for (let x = x0; x <= x1 + 0.01; x += 1.2) for (const s of [-1, 1]) S.box(0.1, 2.1, 0.1, x, y + 1.05, s * hw, '#f2f2ea');
    S.rail(x0, x1, y, hw, '#3a8ac8', 0.85, 1.2);
    S.box(x1 - x0 + 0.5, 0.12, hw * 2 + 0.4, (x0 + x1) / 2, y + 2.14, 0, dk ? '#e8e4d8' : '#a88a62');
    S.box(x1 - x0 + 0.5, 0.2, 0.06, (x0 + x1) / 2, y + 2.05, hw + 0.2, '#3a8ac8'); S.box(x1 - x0 + 0.5, 0.2, 0.06, (x0 + x1) / 2, y + 2.05, -hw - 0.2, '#3a8ac8');
  }
  S.house(0.6, 2.4, d, d + 2.0, hw - 0.2, hw - 0.25, 0.2, 0, '#e8e4d8');                       // рубка на нижнем ярусе
  S.windows(0.8, 2.2, d + 1.3, 0.5, hw - 0.22, true, 0.7);
  S.box(1.6, 1.4, 1.6, -3.4, d + 0.7, 0, '#d8d2c2');                                           // камбуз на корме
  for (const x of [-2.2, -1.0, 0.2]) for (const z of [-0.6, 0.6]) S.box(0.5, 0.4, 0.9, x, d + 2.5, z, '#c8402c');   // скамьи наверху
  S.box(0.12, 3.4, 0.12, 2.2, d + 5.9, 0, '#b02a2a'); S.box(0.1, 2.4, 0.1, -3.2, d + 5.4, 0, '#b02a2a');
  S.rod([2.2, d + 7.5, 0], [5.0, H.tip[1] + 0.2, 0], 0.03, '#2a2a2a'); S.rod([2.2, d + 7.5, 0], [-3.2, d + 6.5, 0], 0.03, '#2a2a2a');
  thaiFlag(S, -3.2, d + 6.6, 0, 0.7);
  tyres(S, [-2.5, 0, 2.2], 0.6, H.side(0, 0.6) - 0.05);
  return S.mesh();
}

// ---------- полицейский катер ----------
function boatPatrol() {
  const S = shipyard();
  const H = S.hull({ L: 7, B: 2.3, free: 0.85, draft: 0.35, full: 0.4, bowFrom: 0.52, entry: 1.8, bowRise: 0.4, rake: 0.9, stern: 0.92, sternTo: 0.2,
    wall: 0.2, bottom: '#2a2c30', boot: '#1c2c5a', side: '#9aa4ac', sheer: '#1c2c5a', deck: '#7a848c', bootTop: 0.28, sheerH: 0.12 });
  const d = H.at(0).deck, cw = H.fit(-1.3, 1.3, 0.2);                                         // рубка у́же палубы: по бортам остаётся проход
  S.house(-1.3, 1.3, d, d + 1.45, cw, cw - 0.08, 0.55, 0.1, '#e8eaee');
  S.windows(-1.1, 0.55, d + 0.95, 0.42, cw - 0.04, false, 0);
  S.house(0.62, 1.2, d + 0.65, d + 1.3, cw - 0.1, cw - 0.16, 0.42, 0, '#1c2a36');             // ветровое стекло
  S.box(1.9, 0.08, 2 * cw + 0.1, -0.1, d + 1.5, 0, '#d0d2d6');
  S.box(1.0, 0.1, 0.2, -0.1, d + 1.6, 0, '#2a4ad8'); S.box(0.3, 0.12, 0.22, 0.2, d + 1.61, 0, '#d8242c');   // маячки
  S.box(0.05, 1.2, 0.05, -0.7, d + 2.1, 0, '#d0d2d6');
  for (const z of [-0.45, 0.45]) { S.box(0.6, 0.5, 0.38, -3.7, 0.95, z, '#15171b'); S.box(0.2, 0.9, 0.16, -3.8, 0.3, z, '#2a2c30'); }
  S.rail(1.5, 2.9, H.at(2.2).deck, H.fit(1.5, 2.9, 0.06), '#d0d2d6', 0.55, 0.7);
  for (const s of [-1, 1]) S.text('POLICE', -0.5, 0.8, (x, y) => H.side(x, y), 0.12, '#14204a', s);
  return S.mesh();
}
