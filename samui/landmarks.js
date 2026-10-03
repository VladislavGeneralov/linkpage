// Достопримечательности Самуи — по фото и обмерам из refs/<объект>/ (notes.md, plan.jpg).
// Где стоит каждое место, куда оно смотрит, какой под ним рельеф и где к нему подходит дорога — решает сборщик
// острова (island_src/build_island.py -> ISLAND.spots). Здесь — сами постройки: каждая собирается в один буфер
// с цветом в вершинах (сборщик shipyard из boats.js), плюс стены для столкновений и проезжие плиты.
// Оси места: u — куда оно смотрит (локальный +X), v — влево от u (локальный −Z), y — вверх.
// Постройки настоящего размера, расстояния между ними сжаты — как у пирсов и аэродрома.
// Файл подключается до основного скрипта и только объявляет функции; buildLandmarks() зовётся из игры.

const LANDMARKS = [];                    // для списка быстрых переходов: { name, x, z, heading }
const VEG_EXTRA = [];                    // посадки у построек: [x, z, вид] — их сажает блок растительности игры
const vegKeepOut = [];                   // участки, где придорожные растения не сажаются: функции (x, z) -> занято ли
let farmPlot = null;                     // каннабис-ферма: { g — её группа, u0, u1, hv — участок за частоколом } — там растут листья-бонусы

// ---------- общее ----------
function spotGroup(id) {
  const P = IS.spots[id], g = new THREE.Group();
  g.position.set(P.x, 0, P.z);
  g.rotation.y = -P.az;                  // локальный +X -> азимут az
  g.userData.spot = P;
  scene.add(g); g.updateMatrixWorld(true);
  return g;
}
// проезжая плита в осях места: u0..u1 по оси, полуширина hv вокруг v = vc; высоты y0 (у u0) и y1 (у u1)
function spotPlate(g, u0, u1, vc, hv, y0, y1 = y0, ramp = false) {
  const a = g.localToWorld(new THREE.Vector3(u0, 0, -vc)), b = g.localToWorld(new THREE.Vector3(u1, 0, -vc));
  const hu = Math.hypot(b.x - a.x, b.z - a.z) / 2;
  pierPlates[ramp ? 'unshift' : 'push']({ cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, ux: (b.x - a.x) / (2 * hu), uz: (b.z - a.z) / (2 * hu),
    hu, hv, hv1: hv, y0, y1, ramp, r: (hu + hv + 3) ** 2 });
}
// место в списке переходов: точка (u, v), носом по курсу (du, dv)
function spotPlace(name, g, u, v, du, dv) {
  const a = g.localToWorld(new THREE.Vector3(u, 0, -v)), b = g.localToWorld(new THREE.Vector3(u + du, 0, -(v + dv)));
  LANDMARKS.push({ name, x: a.x, z: a.z, heading: Math.atan2(-(b.x - a.x), -(b.z - a.z)) });
}
// Примыкание площадки к дороге: бетон не обрывается у обочины ровной кромкой, а заходит на неё и сходит на нет рваным
// краем у самого асфальта (как обочина в траву, только короче). g — группа площадки; u0 — её край со стороны дороги,
// v0..v1 — вдоль края; y — высота покрытия в осях группы; color — его цвет; dir — в какую сторону по u дорога (+1 / −1).
const apronMats = {};
let APRON_TEX = null;
function lotApron(g, u0, v0, v1, y, color, dir = 1, emissive = 0x1c1c1c) {
  const n = Math.max(1, Math.round(Math.abs(v1 - v0) / 2)), P = [];
  for (let i = 0; i <= n; i++) { const w = g.localToWorld(new THREE.Vector3(u0, 0, -(v0 + (v1 - v0) * i / n))); P.push([w.x, w.z]); }
  const a = g.localToWorld(new THREE.Vector3(0, 0, 0)), b = g.localToWorld(new THREE.Vector3(dir, 0, 0));
  roadApron(g, P, [b.x - a.x, b.z - a.z], g.position.y + y, color, emissive);
}
// То же в мировых координатах: P — точки [x, z] вдоль края площадки, to — куда дорога (единичный вектор), y — высота
// покрытия у края. Покрытие сплошь закрывает обочину и кончается ровно по кромке асфальта: на дорогу оно не заходит.
function roadApron(g, P, to, y, color, emissive = 0x1c1c1c) {
  if (!APRON_TEX) APRON_TEX = pixelTexture(32, 32, (c, w, h) => {
    const rnd = seededRandom(73), TAU = Math.PI * 2;
    for (let yy = 0; yy < h; yy++) {
      const edge = 0.6 + 0.1 * Math.sin(TAU * 2 * yy / h) + 0.07 * Math.sin(TAU * 5 * yy / h + 1.1);
      for (let x = 0; x < w; x++) {
        const t = x / (w - 1) + (rnd() - 0.5) * 0.22;
        if (t < edge || rnd() < 0.1 * (1 - t)) { const k = 242 + ((rnd() * 13) | 0); c.fillStyle = 'rgb(' + k + ',' + k + ',' + k + ')'; c.fillRect(x, yy, 1, 1); }
      }
    }
  });
  const key = color + '|' + emissive, mat = apronMats[key] || (apronMats[key] = lambert({ map: APRON_TEX, color, emissive, alphaTest: 0.5, side: THREE.DoubleSide }));
  if (P.length) later(P[0][0], P[0][1], g, () => apronMesh(g, P, to, y, mat));      // покрытие дальних площадок кладётся уже после старта (later — в основном скрипте)
}
function apronMesh(g, P, to, y, mat) {
  const pos = [], uv = [], idx = [], inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), put = (x, yy, z, t, s) => { const q = new THREE.Vector3(x, yy, z).applyMatrix4(inv); pos.push(q.x, q.y, q.z); uv.push(t, s); };
  let s = 0;
  P.forEach(([x, z], i) => {
    if (i) s += Math.hypot(x - P[i - 1][0], z - P[i - 1][1]);
    let d = 0, found = false;
    for (; d < 9; d += 0.25) { const h = roadAt(x + to[0] * d, z + to[1] * d); if (h && h.d < halfR) { found = true; break; } }
    put(x, y, z, 0, s / 4);
    if (found) {                                                     // до кромки асфальта — сплошь; край жёсткий
      const ex = x + to[0] * (d - 0.12), ez = z + to[1] * (d - 0.12), hx = x + to[0] * d * 0.5, hz = z + to[1] * d * 0.5;
      put(hx, (y + asphaltTop(ex, ez) + 0.016) / 2, hz, 0.15, s / 4); put(ex, asphaltTop(ex, ez) + 0.016, ez, 0.3, s / 4);
    } else { put(x + to[0] * 1.1, groundY(x + to[0] * 1.1, z + to[1] * 1.1) + 0.05, z + to[1] * 1.1, 0.3, s / 4); put(x + to[0] * 2.2, groundY(x + to[0] * 2.2, z + to[1] * 2.2) + 0.05, z + to[1] * 2.2, 1, s / 4); }
    if (i) { const b = (i - 1) * 3; idx.push(b, b + 1, b + 3, b + 1, b + 4, b + 3, b + 1, b + 2, b + 4, b + 2, b + 5, b + 4); }
  });
  g.add(meshFrom(pos, uv, idx, mat));
}
// Конец дороги, которая приводит на площадку: покрытие площадки заходит на асфальт и сходит на нет рваным краем — плавный
// переход (только здесь: площадки сбоку от дороги на асфальт не заходят). u0 — край площадки, dir — куда уходит дорога по u.
function padBlend(g, u0, dir, v0, v1, color, len = 3.6, emissive = 0x1c1c1c) {
  const key = color + '|' + emissive;
  if (!apronMats[key]) { lotApron(g, u0, 0, 0, 0, color, dir, emissive); }                         // (создаёт текстуру и материал)
  const mat = apronMats[key], pos = [], uv = [], idx = [], n = Math.max(1, Math.round(Math.abs(v1 - v0) / 1.5));
  for (let i = 0; i <= n; i++) {
    const v = v0 + (v1 - v0) * i / n;
    [[0, 0], [len * 0.3, 0.3], [len, 1]].forEach(([d, t]) => { const u = u0 + dir * d, w = g.localToWorld(new THREE.Vector3(u, 0, -v)); pos.push(u, surfaceY(w.x, w.z) + 0.045 - g.position.y, -v); uv.push(t, v / 4); });
    if (i) { const b = (i - 1) * 3; idx.push(b, b + 1, b + 3, b + 1, b + 4, b + 3, b + 1, b + 2, b + 4, b + 2, b + 5, b + 4); }
  }
  g.add(meshFrom(pos, uv, idx, mat));
}
// добавки к сборщику геометрии: тела вращения, эллипсоиды, конечности, двускатные крыши
function sculptor() {
  const S = shipyard(), TAU = Math.PI * 2;
  // тело вращения вокруг вертикали: profile — [[радиус, y], ...] снизу вверх; sx, sz — сплющивание по осям;
  // color — цвет или функция (номер грани по кругу, номер пояса) -> цвет
  S.lathe = (profile, cx, cz, color, n = 12, sx = 1, sz = 1, lean = 0) => {
    for (let k = 0; k < profile.length - 1; k++) {
      const [r0, y0] = profile[k], [r1, y1] = profile[k + 1];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, b = (i + 1) / n * TAU, c = typeof color === 'function' ? color(i, k) : color;
        const P = (r, y, t) => [cx + Math.cos(t) * r * sx + lean * y, y, cz + Math.sin(t) * r * sz];
        S.quad(P(r0, y0, a), P(r0, y0, b), P(r1, y1, b), P(r1, y1, a), c);
      }
    }
  };
  // эллипсоид: центр и полуоси
  S.blob = (cx, cy, cz, rx, ry, rz, color, n = 10, m = 6) => {
    for (let j = 0; j < m; j++) {
      const t0 = -Math.PI / 2 + j / m * Math.PI, t1 = -Math.PI / 2 + (j + 1) / m * Math.PI;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, b = (i + 1) / n * TAU;
        const P = (t, p) => [cx + Math.cos(t) * Math.cos(p) * rx, cy + Math.sin(t) * ry, cz + Math.cos(t) * Math.sin(p) * rz];
        S.quad(P(t0, a), P(t0, b), P(t1, b), P(t1, a), color);
      }
    }
  };
  // конечность: усечённый конус между двумя точками
  S.limb = (a, b, ra, rb, color, n = 8) => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const e1 = new THREE.Vector3(0, 1, 0).cross(d);
    if (e1.lengthSq() < 1e-4) e1.set(1, 0, 0);
    e1.normalize();
    const e2 = d.clone().cross(e1);
    const P = (c, r, t) => [c[0] + (e1.x * Math.cos(t) + e2.x * Math.sin(t)) * r, c[1] + (e1.y * Math.cos(t) + e2.y * Math.sin(t)) * r, c[2] + (e1.z * Math.cos(t) + e2.z * Math.sin(t)) * r];
    for (let i = 0; i < n; i++) {
      const t0 = i / n * TAU, t1 = (i + 1) / n * TAU;
      S.quad(P(a, ra, t0), P(a, ra, t1), P(b, rb, t1), P(b, rb, t0), color);
    }
  };
  // двускатная крыша: конёк вдоль x (along = 'x') или вдоль z; длина len, полуширина свеса hw, от y0 до конька y1;
  // торцы-фронтоны закрыты цветом gable
  S.gable = (cx, cz, len, hw, y0, y1, color, gable, along = 'x') => {
    const pt = (l, w, y) => along === 'x' ? [cx + l, y, cz + w] : [cx + w, y, cz + l];
    const h = len / 2;
    S.quad(pt(-h, -hw, y0), pt(h, -hw, y0), pt(h, 0, y1), pt(-h, 0, y1), color);
    S.quad(pt(-h, hw, y0), pt(h, hw, y0), pt(h, 0, y1), pt(-h, 0, y1), color);
    for (const s of [-1, 1]) S.tri(pt(s * h, -hw, y0), pt(s * h, hw, y0), pt(s * h, 0, y1), gable);
  };
  // пояс шатровой крыши: от прямоугольника ax × az (полуразмеры) на высоте y0 к bx × bz на высоте y1
  S.hip = (cx, cz, ax, az, y0, bx, bz, y1, color) => {
    const A = [[-ax, -az], [ax, -az], [ax, az], [-ax, az]], B = [[-bx, -bz], [bx, -bz], [bx, bz], [-bx, bz]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, c = typeof color === 'function' ? color(i) : color;
      S.quad([cx + A[i][0], y0, cz + A[i][1]], [cx + A[j][0], y0, cz + A[j][1]], [cx + B[j][0], y1, cz + B[j][1]], [cx + B[i][0], y1, cz + B[i][1]], c);
    }
  };
  // борт площадки: вертикальная кромка вокруг прямоугольника x0..x1 × z0..z1 от высоты y вниз на drop — приподнятая
  // плита не висит над землёй. skip — какие стороны не нужны: строка из букв 'a' (x0), 'b' (x1), 'c' (z0), 'd' (z1)
  S.skirt = (x0, x1, z0, z1, y, color, drop = 0.4, skip = '') => {
    const side = (ax, az, bx, bz) => S.quad([ax, y, az], [bx, y, bz], [bx, y - drop, bz], [ax, y - drop, az], color);
    if (!skip.includes('a')) side(x0, z0, x0, z1); if (!skip.includes('b')) side(x1, z0, x1, z1);
    if (!skip.includes('c')) side(x0, z0, x1, z0); if (!skip.includes('d')) side(x0, z1, x1, z1);
  };
  // Часть общей геометрии как отдельный разрушаемый предмет. Правило: всё, что меньше 2 × 2 × 2 м, твёрдым не бывает —
  // оно либо ломается, либо проезжается насквозь. draw() рисует предмет как обычно; при ударе его вершины убираются,
  // на их месте разлетаются обломки. g — группа, куда пойдёт меш (без своего сдвига), (u, v) — место предмета в её осях;
  // o: r — радиус, kind, mat, loss, color — цвет обломков (иначе — цвет первой грани).
  S.parts = [];
  S.part = (g, u, v, o, draw) => { const v0 = S.count(); draw(); S.parts.push(Object.assign({ g, u, v, v0, v1: S.count() }, o)); };
  const mesh0 = S.mesh;
  S.mesh = () => {
    const m = mesh0(), at = m.geometry.attributes.position, col = m.geometry.attributes.color;
    for (const p of S.parts) {
      const w = p.g.localToWorld(new THREE.Vector3(p.u, 0, -p.v)), bb = new THREE.Box3();
      for (let i = p.v0; i < p.v1; i++) bb.expandByPoint(new THREE.Vector3(at.getX(i), at.getY(i), at.getZ(i)));
      const c = p.color || new THREE.Color(col.getX(p.v0), col.getY(p.v0), col.getZ(p.v0)).getHex(), x0 = at.getX(p.v0), z0 = at.getZ(p.v0);
      posts.push([w.x, w.z]);
      addBreakable({ kind: p.kind || 'small', mat: p.mat || 'wood', x: w.x, z: w.z, r: p.r || 0.6, loss: p.loss || 0.03,
        hide() { collapseVerts(at, p.v0, p.v1, x0, -60, z0); },
        pieces(out) {
          m.updateWorldMatrix(true, false);
          const ctr = bb.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld), s = bb.getSize(new THREE.Vector3()), q = new THREE.Quaternion(); m.getWorldQuaternion(q);
          shatter(out, ctr.x, ctr.y, ctr.z, s.x, s.y, s.z, q, c, p.mat || 'wood');
        } });
    }
    S.parts.length = 0;
    return m;
  };
  return S;
}

// =====================================================================================================
// БОЛЬШОЙ БУДДА (Ват Пхра Яй) — refs/big_buddha
// Золотой сидящий Будда (настоящий — 12 м, в игре в 1.6 раза крупнее) на лотосовом постаменте, на вершине холма островка Ко Фан; смотрит на восток.
// За головой — нимб-колесо, по бокам ладьи с головами нагов, за спиной белый пилон. Вокруг — терраса с
// бирюзовой балюстрадой и П-образной галереей под красной черепицей. С террасы на площадь спускается
// широкая лестница (белая — красная — белая дорожки) с перилами-нагами; у её подножия два павильона
// с многоярусными крышами. К площади по дамбе подходит дорога. По лестнице можно въехать к статуе.
// =====================================================================================================
function buildBigBuddha() {
  const g = spotGroup('big_buddha'), sp = g.userData.spot;
  const P = sp.road.y - 0.06, T = P + 10;                   // уровни площади и террасы
  const TR = 15, ST0 = TR, ST1 = 36, PL1 = sp.road.u;       // полуразмер террасы; лестница u = 15..36; площадь до конца дороги
  const GOLD = '#e8b04a', GOLD_D = '#c8862c', WHITE = '#efece4', TILE = '#c8582c', TILE_D = '#a8421f', TEAL = '#4e8a84', PAVE = '#cdb09c';
  const NAGA = ['#2f7a6e', '#4f9a86'], RED = '#9a3a34';

  // ---------- площадь, терраса, лестница ----------
  const A = sculptor();
  A.box(PL1 - ST1, 0.5, 38, (ST1 + PL1) / 2, P - 0.19, 0, PAVE);                              // плитка площади
  for (let u = ST1 + 4; u < PL1; u += 8) A.box(0.5, 0.52, 38, u, P - 0.19, 0, '#b89a88');     // швы
  A.box(PL1 - ST1, 0.54, 0.6, (ST1 + PL1) / 2, P - 0.19, 18.7, '#a8897a'); A.box(PL1 - ST1, 0.54, 0.6, (ST1 + PL1) / 2, P - 0.19, -18.7, '#a8897a');
  A.box(TR * 2, 8, TR * 2, 0, T - 4, 0, WHITE);                                              // терраса: белые подпорные стены
  A.box(TR * 2 - 0.6, 0.12, TR * 2 - 0.6, 0, T + 0.01, 0, PAVE);
  // балюстрада: бирюзовые балясины под белым поручнем; на востоке проём под лестницу
  const balus = (x0, z0, x1, z1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.9));
    for (let i = 0; i <= n; i++) A.box(0.22, 0.75, 0.22, x0 + (x1 - x0) * i / n, T + 0.42, z0 + (z1 - z0) * i / n, TEAL);
    A.rod([x0, T + 0.88, z0], [x1, T + 0.88, z1], 0.2, WHITE); A.rod([x0, T + 0.1, z0], [x1, T + 0.1, z1], 0.24, WHITE);
  };
  const E = TR - 0.3;
  balus(-E, -E, E, -E); balus(-E, E, E, E); balus(-E, -E, -E, E); balus(E, -E, E, -4.6); balus(E, 4.6, E, E);
  for (const [x, z] of [[-E, -E], [-E, E], [E, -E], [E, E], [E, -4.6], [E, 4.6]]) { A.box(0.5, 1.3, 0.5, x, T + 0.65, z, WHITE); A.tube(x, T + 1.3, T + 1.8, z, 0.22, 0, GOLD, 6); }
  // лестница: три дорожки и жёлтые поручни между ними; ступени сплошные до земли
  const STEPS = 42, run = (ST1 - ST0) / STEPS, rise = (T - P) / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const x = ST0 + (i + 0.5) * run, top = T - (i + 1) * rise + 0.06, h = top - (P - 0.6);
    A.box(run, h, 2.5, x, top - h / 2, -2.75, '#ecebe6'); A.box(run, h, 3.0, x, top - h / 2, 0, RED); A.box(run, h, 2.5, x, top - h / 2, 2.75, '#ecebe6');
  }
  for (const z of [-1.5, 1.5]) {
    A.rod([ST0, T + 0.95, z], [ST1, P + 1.0, z], 0.1, '#d8b84a');
    for (let i = 0; i <= 7; i++) A.box(0.08, 0.95, 0.08, ST0 + (ST1 - ST0) * i / 7, T + (P - T) * i / 7 + 0.5, z, '#d8b84a');
  }
  // перила-наги: белая стенка с голубой волной и зелёное чешуйчатое тело волнами, у подножия — веер голов
  for (const s of [-1, 1]) {
    const z = s * 4.45, N = 54;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N, x = ST0 + (ST1 - ST0) * t, y = T + (P - T) * t, w = Math.sin(t * Math.PI * 11);
      A.box((ST1 - ST0) / N + 0.02, 1.0, 0.5, x, y + 0.2, z, WHITE);
      A.box((ST1 - ST0) / N + 0.02, 0.2, 0.52, x, y + 0.25 + 0.2 * w, z, '#7ab0d0');
      A.box((ST1 - ST0) / N + 0.06, 0.55, 0.62, x, y + 1.0 + 0.3 * w, z, NAGA[i % 2], -0.43);
      A.box((ST1 - ST0) / N + 0.06, 0.12, 0.64, x, y + 1.33 + 0.3 * w, z, GOLD_D, -0.43);
    }
    for (let k = -2; k <= 2; k++) {                                                            // головы: центральная выше
      const h = 2.3 - Math.abs(k) * 0.35;
      A.limb([ST1 + 0.3, P + 0.3, z + k * 0.2], [ST1 + 1.0 + Math.abs(k) * 0.1, P + h, z + k * 0.55], 0.3, 0.2, k % 2 ? NAGA[1] : NAGA[0], 6);
      A.tube(ST1 + 1.0 + Math.abs(k) * 0.1, P + h, P + h + 0.5, z + k * 0.55, 0.24, 0, GOLD, 5);
    }
  }
  g.add(A.mesh());

  // ---------- галерея вокруг статуи: П-образная, открыта на восток ----------
  const G = sculptor(), GW = 12, GH = 2.6;
  const wing = (cx, cz, len, along) => {
    const n = Math.round(len / 3);
    for (let i = 0; i <= n; i++) for (const o of [-1.5, 1.5]) {
      const l = -len / 2 + len * i / n;
      G.box(0.28, GH, 0.28, along === 'x' ? cx + l : cx + o, T + GH / 2, along === 'x' ? cz + o : cz + l, WHITE);
    }
    G.gable(cx, cz, len + 1.2, 2.5, T + GH, T + GH + 1.7, TILE, '#b02a22', along);
    const r = along === 'x' ? [[cx - len / 2 - 0.6, cz], [cx + len / 2 + 0.6, cz]] : [[cx, cz - len / 2 - 0.6], [cx, cz + len / 2 + 0.6]];
    G.rod([r[0][0], T + GH + 1.72, r[0][1]], [r[1][0], T + GH + 1.72, r[1][1]], 0.18, GOLD_D);
  };
  wing(-GW, 0, 2 * GW, 'z'); wing(0, GW, 2 * GW, 'x'); wing(0, -GW, 2 * GW, 'x');
  for (const [x, z] of [[-GW, -GW], [-GW, GW], [GW, -GW], [GW, GW]]) {                         // шпили по углам
    G.box(2.6, GH + 0.4, 2.6, x, T + (GH + 0.4) / 2, z, WHITE);
    G.tube(x, T + GH + 0.4, T + GH + 2.4, z, 1.9, 0.5, TILE_D, 4);
    G.tube(x, T + GH + 2.4, T + GH + 4.6, z, 0.45, 0, GOLD, 6);
  }
  g.add(G.mesh());

  // ---------- постамент, статуя, нимб ----------
  const B = sculptor(), Y0 = T + 4.5, PR = 1.3;                                               // Y0 — сиденье статуи; PR — постамент шире настоящего, под увеличенную статую
  B.lathe([[6.6, T], [6.6, T + 1.5]], 0, 0, '#1f6f8f', 20, PR, PR);                                   // сине-голубой цоколь
  B.lathe([[6.7, T + 1.5], [7.4, T + 2.2], [6.5, T + 3.0]], 0, 0, (i) => i % 2 ? '#e6cfca' : '#d2b0ac', 24, PR, PR);       // лепестки вниз
  B.lathe([[6.5, T + 3.0], [7.3, T + 3.5], [7.0, T + 4.3], [5.9, T + 4.5]], 0, 0, (i) => i % 2 ? '#ecd8d4' : '#d8b8b4', 24, PR, PR);   // лепестки вверх
  B.lathe([[6.72, T + 1.45], [6.72, T + 1.6]], 0, 0, GOLD_D, 24, PR, PR); B.lathe([[6.55, T + 2.95], [6.55, T + 3.08]], 0, 0, GOLD_D, 24, PR, PR);
  B.lathe([[5.9, T + 4.5], [0, T + 4.5]], 0, 0, GOLD_D, 24, PR, PR);
  B.box(0.5, 3.8, 3.6, 7.0 * PR, T + 2.1, 0, '#0a6b89');                                           // передняя панель с нишей
  for (const z of [-1.8, 1.8]) B.box(0.56, 3.9, 0.3, 7.0 * PR, T + 2.1, z, GOLD);
  B.box(0.56, 0.3, 3.9, 7.0 * PR, T + 4.0, 0, GOLD); B.tri([7.0 * PR + 0.3, T + 4.15, -1.95], [7.0 * PR + 0.3, T + 4.15, 1.95], [7.0 * PR + 0.3, T + 5.2, 0], GOLD);
  B.blob(7.0 * PR + 0.35, T + 1.6, 0, 0.3, 0.9, 0.5, GOLD, 6, 4); B.blob(7.0 * PR + 0.4, T + 2.75, 0, 0.26, 0.3, 0.28, GOLD, 6, 4);
  for (let i = -4; i <= 4; i++) if (i) {                                                      // золотые фигуры вокруг цоколя
    const a = i * 0.36;
    B.blob(Math.cos(a) * 7.6 * PR, T + 0.85, Math.sin(a) * 7.6 * PR, 0.28, 0.85, 0.28, GOLD, 6, 4);
    B.blob(Math.cos(a) * 7.6 * PR, T + 1.9, Math.sin(a) * 7.6 * PR, 0.2, 0.24, 0.2, GOLD, 6, 4);
  }
  g.add(B.mesh());

  // Статуя — отдельным буфером в своих координатах (y = 0 — сиденье, размеры настоящие: 12 м до кончика пламени),
  // в игре она крупнее настоящей в BIG раз — так решил Влад: издалека статуя должна царить над заливом.
  const Z = sculptor(), BIG = 1.6;
  // статуя: ноги со скрещёнными голенями, торс, руки (правая — на колене пальцами вниз, левая — на коленях), голова
  Z.blob(0.5, 1.25, 0, 3.3, 1.3, 5.0, GOLD, 14, 6);
  for (const s of [-1, 1]) Z.blob(1.2, 1.15, s * 3.9, 2.1, 1.15, 1.7, GOLD, 10, 5);        // колени
  Z.limb([2.6, 1.0, -3.2], [2.9, 1.1, 1.4], 0.75, 0.6, GOLD); Z.limb([2.3, 1.7, 3.2], [2.8, 1.75, -1.2], 0.7, 0.55, GOLD);   // голени
  Z.lathe([[2.75, 1.9], [2.3, 3.2], [2.35, 4.4], [2.7, 5.6], [2.9, 6.7], [1.7, 7.3], [0.85, 7.7], [0.8, 8.2]], -0.4, 0, GOLD, 14, 0.66, 1);
  for (const s of [-1, 1]) {
    Z.blob(-0.35, 6.55, s * 2.75, 1.0, 0.85, 0.9, GOLD, 8, 5);                            // плечо
    Z.limb([-0.35, 6.5, s * 2.95], [0.1, 4.0, s * 3.35], 0.72, 0.6, GOLD);           // плечевая часть руки
  }
  Z.limb([0.1, 4.0, -3.35], [2.5, 2.5, -3.7], 0.6, 0.48, GOLD); Z.blob(2.95, 2.0, -3.75, 0.5, 0.75, 0.45, GOLD, 6, 4);   // правая — на колене
  Z.limb([0.1, 4.0, 3.35], [1.9, 2.75, 0.9], 0.6, 0.48, GOLD); Z.blob(2.2, 2.6, 0.2, 0.75, 0.3, 0.9, GOLD, 6, 4);        // левая — в ладони на коленях
  Z.limb([-0.5, 6.9, 2.4], [1.45, 2.6, -1.6], 0.16, 0.16, GOLD_D, 5);                // складка одеяния через грудь
  Z.blob(-0.25, 9.1, 0, 0.98, 1.22, 0.95, GOLD, 12, 7);                                  // голова
  Z.blob(-0.4, 9.75, 0, 1.0, 0.75, 1.0, GOLD_D, 12, 5);                                  // волосы
  for (const s of [-1, 1]) Z.box(0.3, 1.25, 0.16, -0.3, 8.75, s * 1.0, GOLD);              // уши
  Z.lathe([[0.55, 10.3], [0.42, 10.95], [0.3, 11.2], [0, 12.0]], -0.4, 0, GOLD, 8);   // ушниша и пламя
  for (const s of [-1, 1]) { Z.box(0.06, 0.09, 0.42, 0.72, 9.3, s * 0.36, '#5a3a1a'); Z.box(0.06, 0.05, 0.5, 0.7, 9.52, s * 0.37, GOLD_D); }   // глаза и брови
  Z.box(0.06, 0.07, 0.4, 0.74, 8.62, 0, '#b0603a'); Z.box(0.2, 0.45, 0.16, 0.8, 9.0, 0, GOLD);   // рот, нос
  // пилон за спиной и нимб-колесо за головой
  Z.box(2.6, 5.6, 2.8, -3.1, 2.8, 0, WHITE);
  const hx = -1.75, hy = 9.0, HR = 4.0;
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    Z.box(0.5, 0.62, 0.95, hx, hy + sn * HR, c * HR, i % 2 ? '#d8962e' : '#c87a24', 0, 0);
    Z.box(0.52, 0.3, 0.5, hx, hy + sn * (HR - 0.55), c * (HR - 0.55), GOLD);
    if (i % 2 === 0) Z.box(0.4, 0.5, 0.36, hx, hy + sn * (HR + 0.45), c * (HR + 0.45), '#c8402c');
  }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; Z.limb([hx, hy + Math.sin(a) * 1.0, Math.cos(a) * 1.0], [hx, hy + Math.sin(a) * 3.5, Math.cos(a) * 3.5], 0.2, 0.13, '#e0a83c', 5); }
  Z.blob(hx, hy, 0, 0.3, 1.1, 1.1, '#d8962e', 10, 5);
  // ладьи с головами нагов по бокам нимба
  for (const s of [-1, 1]) {
    const pts = [[-2.6, 5.6, s * 1.4], [-2.4, 5.1, s * 3.6], [-2.2, 5.4, s * 5.4], [-2.0, 6.6, s * 6.7], [-1.9, 8.0, s * 7.2]];
    for (let i = 0; i < pts.length - 1; i++) Z.limb(pts[i], pts[i + 1], 0.5 - i * 0.07, 0.43 - i * 0.07, i % 2 ? '#d8962e' : GOLD_D, 6);
    Z.limb([-1.9, 8.0, s * 7.2], [-1.4, 8.5, s * 7.9], 0.22, 0.05, GOLD, 5);          // клюв
    Z.tube(-1.9, 8.1, 9.0, s * 7.1, 0.16, 0, '#c8402c', 5);                          // гребень
    Z.tube(-1.5, 6.4, 7.3, s * 4.5, 0.32, 0, GOLD, 6); Z.blob(-1.5, 6.2, s * 4.5, 0.36, 0.3, 0.36, '#3a3a40', 6, 4);   // колокол-шпиль
  }
  const statue = Z.mesh();
  statue.scale.setScalar(BIG); statue.position.y = Y0;
  g.add(statue);

  // ---------- павильоны у подножия лестницы ----------
  for (const s of [-1, 1]) {
    const V = sculptor(), cz = s * 13, cx = 46, L = 16, W = 4.4;
    V.box(L + 1.5, 0.8, 2 * W + 1.5, cx, P + 0.3, cz, '#e4dcd0');                              // цоколь
    for (let i = 0; i <= 5; i++) for (const o of [-W + 0.4, W - 0.4]) V.box(0.38, 3.6, 0.38, cx - L / 2 + 0.4 + (L - 0.8) * i / 5, P + 2.5, cz + o, '#b02a22');
    V.box(L - 0.6, 3.2, 0.25, cx, P + 2.3, cz + s * (W - 0.5), '#e9e2d2');                    // задняя стена
    V.box(L - 3, 0.5, 1.2, cx, P + 0.95, cz + s * (W - 1.4), '#b02a22');                      // помост с сидящими Буддами
    for (let i = 0; i < 7; i++) { V.blob(cx - 5.4 + i * 1.8, P + 1.55, cz + s * (W - 1.4), 0.42, 0.4, 0.5, GOLD, 6, 4); V.blob(cx - 5.4 + i * 1.8, P + 2.15, cz + s * (W - 1.5), 0.2, 0.3, 0.22, GOLD, 6, 4); }
    // крыша в три яруса: каждый выше и короче, фронтоны красные с золотом, на коньках — «рога» чофа
    for (const [len, hw, y0, y1] of [[L + 2.2, W + 1.5, P + 4.2, P + 6.3], [L - 2.5, W - 0.2, P + 5.6, P + 8.0], [L - 7, W - 1.6, P + 7.2, P + 9.6]]) {
      V.gable(cx, cz, len, hw, y0, y1, TILE, '#a82a22', 'x');
      for (const e of [-1, 1]) {
        V.rod([cx + e * len / 2, y0 + 0.05, cz - hw], [cx + e * len / 2, y1 + 0.05, cz], 0.2, GOLD); V.rod([cx + e * len / 2, y0 + 0.05, cz + hw], [cx + e * len / 2, y1 + 0.05, cz], 0.2, GOLD);
        V.limb([cx + e * len / 2, y1, cz], [cx + e * (len / 2 + 0.5), y1 + 1.3, cz], 0.14, 0.03, GOLD, 5);
      }
      V.box(len, 0.16, 0.16, cx, y1 + 0.04, cz, GOLD_D);
    }
    g.add(V.mesh());
    wallBox(g, cx, s * 13, L + 1.5, 2 * W + 1.5);
  }

  // ---------- проезд и столкновения ----------
  spotPlate(g, -TR, TR, 0, TR, T + 0.07);                                                      // терраса
  spotPlate(g, ST0, ST1, 0, 4.0, T + 0.07, P + 0.07, true);                                    // лестница — по ней можно въехать к статуе
  spotPlate(g, ST1, PL1, 0, 19, P + 0.07);                                                     // площадь
  wallBox(g, -1.5, 0, 22, 20);                                                                 // постамент с пилоном
  wallLine(g, -TR, -TR, TR, -TR); wallLine(g, -TR, TR, TR, TR); wallLine(g, -TR, -TR, -TR, TR);
  wallLine(g, TR, -TR, TR, -4.6); wallLine(g, TR, 4.6, TR, TR);
  for (const s of [-1, 1]) wallLine(g, ST0, s * 4.3, ST1 + 1, s * 4.3);                        // перила лестницы
  spotPlace('БОЛЬШОЙ БУДДА', g, PL1 + 14, 0, -1, 0);
  vegKeepOut.push(Object.assign(() => true, { c: [sp.x, sp.z, 80] }));                          // на островке лес не растёт — только посадки ниже
  // пальмы и кусты на островке — вокруг террасы, в стороне от лестницы, площади и дороги
  const rb = seededRandom(31);
  for (let i = 0; i < 60; i++) {
    const a = rb() * Math.PI * 2, d = 24 + rb() * 36, u = Math.cos(a) * d, v = Math.sin(a) * d, roll = rb();
    if (u > 8 && Math.abs(v) < 25) continue;
    const w = g.localToWorld(new THREE.Vector3(u, 0, -v));
    VEG_EXTRA.push([w.x, w.z, roll < 0.5 ? 'coconut' : roll < 0.7 ? 'areca' : roll < 0.8 ? 'fan' : 'bush']);
  }
}

// =====================================================================================================
// ТЕРМИНАЛ АЭРОПОРТА САМУИ — refs/airport_terminal
// Не одно здание, а «деревня» открытых павильонов без стен. Вдоль забора аэродрома в ряд стоят шесть круглых
// гейтов: низкая широкая «юбка» из пальмового листа, над ней сквозной пояс-фонарь и крутой красно-коричневый
// шатёр; внутри — кольцо колонн из стволов кокосовой пальмы на бетонных «колоколах». К югу от подъездной дороги —
// залы регистрации под двускатными крышами с соломенными юбками, фронтоном к кольцу высадки; на островке кольца —
// башня с часами. Между гейтами и забором — канал, вдоль гейтов — крытый переход, у дороги — лавки под шатровыми
// крышами и навес прилёта. Оси — аэродрома: u на север, v на запад (к полосе); подъезд идёт по u = −40.
// Настоящая линия гейтов — 220 м, здесь сжата до 150; сами павильоны настоящего размера.
// =====================================================================================================
function buildAirportTerminal() {
  const g = airportGroup;
  g.updateMatrixWorld(true);
  const THATCH = ['#8f8277', '#81756b', '#756a62'], EAVE = '#544c47', RED = ['#6e494e', '#5c3a41'], TRUNK = '#241e18', BELL = '#b7a482';
  const FLOOR = '#a89878', WOOD = '#3b2e23', STONE = '#aaa8a6', TAR = '#5e6062', LAWN = '#7fa03a', WALL = '#e4dccb', GLASS = '#7f98a2', BRONZE = '#7a6248';
  const TAU = Math.PI * 2, rnd = seededRandom(77), occ = [];   // occ — занятое: [u0, u1, v0, v1], там не сажаем
  const mix = (a, b, t) => a + (b - a) * t;
  // соломенный скат в n поясов: от прямоугольника ax × az (полуразмеры) на высоте y0 к bx × bz на y1
  const thatch = (S, cx, cz, ax, az, y0, bx, bz, y1, n = 2) => {
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      S.hip(cx, cz, mix(ax, bx, t0), mix(az, bz, t0), mix(y0, y1, t0), mix(ax, bx, t1), mix(az, bz, t1), mix(y0, y1, t1), (i) => THATCH[(i + k) % 3]);
    }
    S.hip(cx, cz, ax, az, y0 - 0.22, ax, az, y0, EAVE);                          // толщина свеса
  };
  // колонна — ствол пальмы на бетонном «колоколе»
  const column = (S, x, z, top, solid = true) => {
    S.lathe([[0.5, 0.04], [0.46, 0.5], [0.22, 1.15]], x, z, BELL, 8);
    S.tube(x, 1.15, top, z, 0.2, 0.17, TRUNK, 6);
    if (solid) wallBox(g, x, -z, 0.9, 0.9); else postAt(g, x, -z);
  };
  const pave = (S, u0, u1, v0, v1, color = STONE, y = 0.03) => {
    S.quad([u0, y, -v0], [u1, y, -v0], [u1, y, -v1], [u0, y, -v1], color);
    occ.push([u0, u1, v0, v1]);
  };

  // ---------- гейт: круглый открытый павильон ----------
  const gate = (S, u, v, R = 10) => {
    const x = u, z = -v;
    S.lathe([[R - 0.6, 0.05], [0, 0.05]], x, z, FLOOR, 20);
    S.lathe([[R + 0.7, 2.9], [R * 0.82, 4.15], [R * 0.62, 5.3], [R * 0.44, 6.3]], x, z, (i, k) => THATCH[(i + k) % 3], 20);   // юбка
    S.lathe([[R + 0.7, 2.68], [R + 0.7, 2.9]], x, z, EAVE, 20);
    for (let i = 0; i < 8; i++) {                                                // кольцо колонн и пояс-фонарь на них
      const a = (i + 0.5) / 8 * TAU, b = (i + 1.5) / 8 * TAU, r = R * 0.43;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, qx = x + Math.cos(b) * r, qz = z + Math.sin(b) * r;
      column(S, px, pz, 6.4);
      S.box(0.2, 1.7, 0.2, px, 7.1, pz, WOOD);
      S.rod([px, 6.3, pz], [qx, 7.9, qz], 0.1, WOOD); S.rod([px, 7.9, pz], [qx, 6.3, qz], 0.1, WOOD);
    }
    S.lathe([[R * 0.3, 6.3], [R * 0.3, 7.9]], x, z, '#d8cfb4', 8);                // световой фонарь внутри
    S.lathe([[R * 0.66, 7.75], [R * 0.34, 10.1], [0.12, 12.5]], x, z, (i, k) => RED[(i + k) % 2], 4);   // шатёр — углом к перрону
    S.lathe([[R * 0.66, 7.58], [R * 0.66, 7.75]], x, z, WOOD, 4);
    S.tube(x, 12.5, 13.6, z, 0.14, 0.02, WOOD, 4);
    for (let i = 0; i < 12; i++) {                                               // стойки под свесом
      const a = i / 12 * TAU, px = x + Math.cos(a) * (R - 1), pz = z + Math.sin(a) * (R - 1);
      S.tube(px, 0.05, 3.75, pz, 0.13, 0.13, TRUNK, 5); postAt(g, px, -pz);
    }
    for (let i = 0; i < 4; i++) {                                                // скамьи
      const a = (i + 0.5) / 4 * TAU;
      S.box(2.6, 0.45, 0.75, x + Math.cos(a) * R * 0.68, 0.3, z + Math.sin(a) * R * 0.68, '#6b5540', 0, -a + Math.PI / 2);
    }
    occ.push([u - R - 1.5, u + R + 1.5, v - R - 1.5, v + R + 1.5]);
  };

  // ---------- зал под двускатной крышей: конёк вдоль v, фронтон — на восток (к кольцу высадки) ----------
  const hall = (S, u, v, len, wid, o = {}) => {
    const { eave = 3.6, ridge = 9, skirt = true, sign = null, desks = 0 } = o;
    const x = u, z = -v, hl = len / 2, hw = wid / 2;
    S.box(wid + 1.6, 0.04, len + 1.6, x, 0.03, z, FLOOR);
    const n = Math.max(2, Math.round(len / 4.5));
    for (let i = 0; i <= n; i++) for (const s of [-1, 1]) column(S, x + s * (hw - 0.5), z - hl + 0.6 + (len - 1.2) * i / n, eave + 0.8);
    const ye = eave + 0.75, gw = skirt ? hw * 0.74 : hw + 1.3, gy = skirt ? ye - 0.12 : eave, gl = hl + (skirt ? 0.4 : 1.3);
    if (skirt) thatch(S, x, z, hw + 2.2, hl + 2.2, eave - 0.75, hw * 0.7, hl - 0.2, ye, 2);
    else S.hip(x, z, gw, gl, gy - 0.22, gw, gl, gy, EAVE);
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {                       // скаты — в три пояса
      const w0 = gw * (1 - k / 3), w1 = gw * (1 - (k + 1) / 3), y0 = mix(gy, ridge, k / 3), y1 = mix(gy, ridge, (k + 1) / 3);
      S.quad([x + s * w0, y0, z - gl], [x + s * w0, y0, z + gl], [x + s * w1, y1, z + gl], [x + s * w1, y1, z - gl], THATCH[(k + (s > 0 ? 1 : 0)) % 3]);
    }
    S.tri([x - gw, gy, z + gl - 0.25], [x + gw, gy, z + gl - 0.25], [x, ridge, z + gl - 0.25], GLASS);       // восточный фронтон — сквозной
    S.tri([x - gw, gy, z - gl + 0.25], [x + gw, gy, z - gl + 0.25], [x, ridge, z - gl + 0.25], WOOD);
    for (const e of [-1, 1]) {                                                   // стропила на торцах
      const zz = z + e * gl;
      for (const s of [-1, 1]) S.rod([x + s * gw, gy + 0.05, zz], [x, ridge + 0.05, zz], 0.26, WOOD);
      S.box(0.22, ridge - gy, 0.22, x, (ridge + gy) / 2, zz, WOOD);
      for (const s of [-1, 1]) S.box(0.16, (ridge - gy) / 2, 0.16, x + s * gw / 2, gy + (ridge - gy) / 4, zz, WOOD);
    }
    S.box(0.3, 0.3, 2 * gl + 0.4, x, ridge + 0.1, z, WOOD);                       // конёк
    if (sign) {                                                                  // вывеска под фронтоном (над английской надписью — тайская)
      const bh = signFit(sign, 2 * gw - 0.6, 0.17).h + 0.35, yc = gy + 0.15 - bh / 2;
      S.box(2 * gw + 0.2, bh, 0.2, x, yc, z + gl + 0.05, WOOD);
      signLines(S, sign, 2 * gw - 0.6, '#f0e6c8', z + gl + 0.17, 0.17, x, yc);
    }
    for (let i = 0; i < desks; i++) {                                            // стойки регистрации в глубине зала
      const dx = x - hw + 1.8 + (wid - 3.6) * (desks > 1 ? i / (desks - 1) : 0.5), dz = z - hl + 3.2;
      S.part(g, dx, -dz, { r: 0.75, kind: 'small', mat: 'wood' }, () => { S.box(1.5, 1.1, 0.8, dx, 0.6, dz, '#d8d2c2'); S.box(1.5, 0.08, 0.9, dx, 1.18, dz, WOOD); });   // стойка меньше 2 м — ломается
      S.box(1.2, 0.6, 0.08, dx, 2.5, dz - 0.9, '#2f6f9f');
    }
    occ.push([u - hw - 2.4, u + hw + 2.4, v - hl - 2.4, v + hl + 2.4]);
  };

  // ---------- лавка: квадратный домик под двухъярусной шатровой крышей ----------
  const kiosk = (S, u, v, w = 10, d = 10, door = '#2e3a40') => {
    const x = u, z = -v, hx = w / 2, hz = d / 2;
    S.box(w + 1.4, 0.04, d + 1.4, x, 0.03, z, STONE);
    S.box(w - 2.4, 3.0, d - 2.4, x, 1.55, z, WALL);
    S.box(w - 2.3, 1.2, d - 4.0, x, 1.85, z, door); S.box(w - 4.0, 1.2, d - 2.3, x, 1.85, z, door);        // окна лентой
    S.box(w - 2.2, 0.35, d - 2.2, x, 0.25, z, '#b7a482');
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) if (sx || sz) {
      const px = x + sx * (hx - 0.35), pz = z + sz * (hz - 0.35);
      S.tube(px, 0.05, 3.3, pz, 0.14, 0.14, TRUNK, 5); postAt(g, px, -pz);
    }
    thatch(S, x, z, hx + 1.2, hz + 1.2, 2.95, hx * 0.42, hz * 0.42, 5.0, 2);
    S.box(hx * 0.8, 0.5, hz * 0.8, x, 5.2, z, WOOD);
    S.hip(x, z, hx * 0.54, hz * 0.54, 5.4, 0, 0, 7.5, (i) => RED[i % 2]);
    wallBox(g, u, v, w - 2.4, d - 2.4);
    occ.push([u - hx - 1.5, u + hx + 1.5, v - hz - 1.5, v + hz + 1.5]);
  };

  // ---------- крытый переход: бронзовые стойки, светлый свод ----------
  const walkway = (S, u0, v0, u1, v1) => {
    const len = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(len / 5)), du = (u1 - u0) / len, dv = (v1 - v0) / len;
    const P = (t, w, y) => [u0 + du * t - dv * w, y, -(v0 + dv * t + du * w)];
    S.quad(P(0, -2.6, 0.035), P(len, -2.6, 0.035), P(len, 2.6, 0.035), P(0, 2.6, 0.035), STONE);
    for (let i = 0; i <= n; i++) for (const s of [-1, 1]) {
      const p = P(len * i / n, s * 2.2, 1.5);
      S.box(0.16, 3.0, 0.16, p[0], p[1], p[2], BRONZE); postAt(g, p[0], -p[2]);
    }
    for (const s of [-1, 1]) S.quad(P(0, s * 2.9, 2.85), P(len, s * 2.9, 2.85), P(len, s * 1.1, 3.45), P(0, s * 1.1, 3.45), s > 0 ? '#a9b4ac' : '#9aa69e');
    S.quad(P(0, -1.1, 3.45), P(len, -1.1, 3.45), P(len, 1.1, 3.45), P(0, 1.1, 3.45), '#bcc6bd');
    for (let i = 0; i <= n; i++) S.rod(P(len * i / n, -2.9, 2.8), P(len * i / n, 2.9, 2.8), 0.12, BRONZE);
    occ.push([Math.min(u0, u1) - 3, Math.max(u0, u1) + 3, Math.min(v0, v1) - 3, Math.max(v0, v1) + 3]);
  };

  // ---------- клумба с бугенвиллией ----------
  const bed = (S, u, v, r = 2.2) => {
    S.lathe([[r, 0], [r, 0.3], [r - 0.3, 0.3]], u, -v, '#c9c4b8', 10);
    S.blob(u, 0.5, -v, r - 0.3, 0.75, r - 0.3, '#4f8a34', 8, 4);
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU, d = rnd() * (r - 0.8);
      S.blob(u + Math.cos(a) * d, 0.95 + rnd() * 0.35, -v + Math.sin(a) * d, 0.6, 0.42, 0.6, rnd() < 0.7 ? '#c8327a' : '#e0569a', 6, 3);
    }
    occ.push([u - r, u + r, v - r, v + r]);
  };

  // ===== гейты, переход, канал =====
  const GATE_V = 130, GATES = [-14, 12, 40, 76, 102, 128];
  const A = sculptor();
  for (const u of GATES) gate(A, u, GATE_V);
  g.add(A.mesh());

  const B = sculptor();
  walkway(B, -30, 114, 134, 114);
  for (const u of GATES) pave(B, u - 2, u + 2, 116.6, GATE_V - 9.3);            // дорожки от перехода к гейтам
  // канал между гейтами и забором аэродрома: вода в каменных берегах, лотосы
  const CU0 = -26, CU1 = 140, CV0 = 142.6, CV1 = 147.6;
  B.box(CU1 - CU0 + 0.8, 0.32, CV1 - CV0 + 0.8, (CU0 + CU1) / 2, 0.13, -(CV0 + CV1) / 2, '#b9b6ae');
  B.quad([CU0, 0.3, -CV0], [CU1, 0.3, -CV0], [CU1, 0.3, -CV1], [CU0, 0.3, -CV1], '#3c8c96');
  for (let i = 0; i < 34; i++) {
    const u = mix(CU0 + 1, CU1 - 1, rnd()), v = mix(CV0 + 0.8, CV1 - 0.8, rnd());
    B.box(0.9, 0.04, 0.9, u, 0.32, -v, rnd() < 0.5 ? '#4f9a44' : '#3f8a3c', 0, rnd() * 3);
    if (rnd() < 0.4) B.box(0.3, 0.3, 0.3, u, 0.5, -v, '#e88ab0');
  }
  wallBox(g, (CU0 + CU1) / 2, (CV0 + CV1) / 2, CU1 - CU0 + 0.8, CV1 - CV0 + 0.8);
  occ.push([CU0 - 1, CU1 + 1, CV0 - 1, CV1 + 1]);
  // лавки и навес прилёта — вдоль дороги, перед гейтами
  for (const u of [-20, 6, 30, 92, 116]) kiosk(B, u, 101);
  hall(B, 58, 103, 17, 14, { skirt: false, eave: 4.6, ridge: 8.6 });
  pave(B, 49, 67, 111.4, 113);
  for (const [u, v] of [[-7, 124], [26, 123], [58, 126], [89, 123], [115, 123], [-27, 124]]) bed(B, u, v);
  g.add(B.mesh());

  // ===== регистрация: кольцо высадки с башней, залы =====
  const C = sculptor(), [RU, RV, RR, RI] = TERMINAL.ring;
  C.lathe([[RR, 0.035], [RI, 0.035]], RU, -RV, TAR, 28);                         // асфальт кольца
  C.lathe([[RI, 0], [RI, 0.3], [RI - 0.4, 0.3]], RU, -RV, (i) => i % 2 ? '#e2ded4' : '#b8382e', 24);   // бордюр — красно-белый
  C.lathe([[RI - 0.4, 0.3], [0, 0.38]], RU, -RV, LAWN, 24);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, b = (i + 1) / 8 * TAU;
    wallLine(g, RU + Math.cos(a) * RI, RV + Math.sin(a) * RI, RU + Math.cos(b) * RI, RV + Math.sin(b) * RI);
    C.blob(RU + Math.cos(a) * (RI - 1.6), 0.75, -RV + Math.sin(a) * (RI - 1.6), 0.9, 0.55, 0.9, i % 2 ? '#c8327a' : '#4f8a34', 6, 3);
  }
  {                                                                              // башня с часами
    const x = RU, z = -RV;
    C.box(4.4, 1.0, 4.4, x, 0.85, z, '#cfc8b8');
    C.box(3.4, 8.2, 3.4, x, 5.4, z, WALL);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) C.box(0.45, 8.2, 0.45, x + dx * 1.65, 5.4, z + dz * 1.65, WOOD);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const fx = x + dx * 1.74, fz = z + dz * 1.74, hx = x + dx * 1.82, hz = z + dz * 1.82;
      C.box(dx ? 0.06 : 2.8, 2.8, dz ? 0.06 : 2.8, fx - dx * 0.02, 7.6, fz - dz * 0.02, WOOD);            // рамка
      C.box(dx ? 0.1 : 2.3, 2.3, dz ? 0.1 : 2.3, fx, 7.6, fz, '#fbf8ee');
      C.box(dx ? 0.1 : 0.13, 0.95, dz ? 0.1 : 0.13, hx, 8.0, hz, '#1e1a16');                                 // минутная
      C.box(dx ? 0.1 : 0.7, 0.13, dz ? 0.1 : 0.7, hx + (dx ? 0 : 0.3), 7.6, hz + (dz ? 0 : 0.3), '#1e1a16');   // часовая
    }
    thatch(C, x, z, 3.2, 3.2, 9.5, 1.3, 1.3, 10.9, 2);
    C.box(2.2, 0.6, 2.2, x, 11.15, z, WOOD);
    C.hip(x, z, 1.9, 1.9, 11.4, 0, 0, 14.3, (i) => RED[i % 2]);
    C.tube(x, 14.3, 15.4, z, 0.1, 0.02, WOOD, 4);
    wallBox(g, RU, RV, 4.4, 4.4);
  }
  pave(C, -108, -47, RV + RR + 0.5, 147.5);                                      // мощение перед залами
  pave(C, -110, RU - RR - 0.5, 92, RV + RR + 0.5);
  hall(C, -59, 133, 24, 13, { ridge: 11.5, eave: 4.6, sign: 'SAMUI AIRPORT', desks: 4 });   // главный навес у подъезда
  hall(C, -78, 131, 20, 10, { desks: 3 });
  hall(C, -94, 129, 17, 11, { desks: 3 });
  hall(C, -88, 104, 16, 10, {});
  hall(C, -104, 104, 14, 10, { ridge: 8.4 });
  for (const [u, v] of [[-69, 121], [-86, 120], [-51, 121], [-79, 92.5]]) bed(C, u, v, 1.8);
  g.add(C.mesh());
  occ.push([RU - RR - 2, RU + RR + 2, RV - RR - 2, RV + RR + 2], [-49, -31, 0, 160]);   // кольцо; дорога с обочинами

  // ===== сад: пальмы и кусты там, где ничего не стоит =====
  const T = TERMINAL, KIND = ['coconut', 'coconut', 'coconut', 'coconut', 'areca', 'areca', 'fan', 'bush', 'bush', 'young'];
  for (let u = T.u0 + 3; u < T.u1 + 6; u += 8) for (let v = T.v0 - 6; v < T.v1 - 9; v += 8) {
    const pu = u + (rnd() - 0.5) * 6, pv = v + (rnd() - 0.5) * 6, kind = KIND[(rnd() * KIND.length) | 0];
    if (occ.some(([a, b, c, d]) => pu > a - 1 && pu < b + 1 && pv > c - 1 && pv < d + 1)) continue;
    const w = g.localToWorld(new THREE.Vector3(pu, 0, -pv));
    VEG_EXTRA.push([w.x, w.z, kind]);
  }
  spotPlace('ТЕРМИНАЛ', g, -37.5, 80, 0, 1);
}

// =====================================================================================================
// КАННАБИС-ФЕРМА — refs/cannabis_farm
// Типовой участок (настоящего адреса у него нет): поляна в глубине Талинг Нгама, огороженная частоколом из жердей.
// Частокол низкий, старый и покосившийся; въезд — просто проём с распахнутыми внутрь створками, без арки и вывески.
// За проёмом — дорожка, по обе стороны
// от неё кусты сативы 1–2 м плотной посадкой прямо в траве (грядки не выделены), кое-где бамбуковые колышки.
// В глубине слева — домик на сваях под крышей из волнистого листа, по оси — сушильный навес с подвешенными пучками,
// бочки и бак с водой. Частокол и ворота разрушаемые, кусты — как все кусты, насквозь.
// =====================================================================================================
function buildCannabisFarm() {
  const g = spotGroup('cannabis_farm'), sp = g.userData.spot, Y = sp.y;
  const U0 = -26, U1 = 22, HV = 19, GATE = 2.4;                 // участок 48 × 38 м; ворота — на стороне u = U1, проём 4.8 м
  const SOIL = '#6b5a4c', PATH = '#8f7354', PLANK = '#96816c', PLANK_D = '#6f5d4e', TIN = ['#7c868d', '#727c83', '#86909a'], RUST = '#6a4a3c', POST = '#734e47';
  const rnd = seededRandom(1420), W = (u, v) => g.localToWorld(new THREE.Vector3(u, 0, -v));
  const inside = (x, z, m) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > U0 - m && p.x < U1 + m && -p.z > -HV - m && -p.z < HV + m; };
  vegKeepOut.push(Object.assign((x, z) => inside(x, z, 3), { c: [W(-2, 0).x, W(-2, 0).z, 46] }));   // c — круг, вне которого проверять незачем
  farmPlot = { g, u0: U0, u1: U1, hv: HV };

  // ---------- земля: площадка у ворот, дорожка, грядки, шланги, колышки ----------
  const A = sculptor(), flat = (u0, u1, v0, v1, c, y = 0.03) => A.quad([u0, Y + y, -v0], [u1, Y + y, -v0], [u1, Y + y, -v1], [u0, Y + y, -v1], c);
  { const u0 = U1 - 1, u1 = sp.road.u + 1, hw = DIRT_HALF;       // от конца грунтовой дороги до ворот — та же колея, без площадки
    g.add(meshFrom([u0, Y + 0.035, hw, u0, Y + 0.035, -hw, u1, Y + 0.035, hw, u1, Y + 0.035, -hw], [0, 0, 1, 0, 0, (u1 - u0) / 6, 1, (u1 - u0) / 6], [0, 2, 1, 1, 2, 3], DIRT_ROAD_MAT)); }
  flat(U0 + 5, U1 - 1, -1.6, 1.6, PATH);                        // дорожка по оси
  // посадка плотная и неровная: ряды через 1.9 м, кусты через метр, со сбоем и пропусками — грядки не читаются
  const rows = [];                                              // [v, u от, u до]
  for (let v = 3.7; v < HV - 1.5; v += 1.9) { rows.push([-v, U0 + 2.5, U1 - 2.5]); rows.push([v, -11, U1 - 2.5]); }   // слева в глубине место занято домиком
  for (const [v, u0, u1] of rows) for (let u = u0 + rnd() * 0.6; u < u1; u += 0.85 + rnd() * 0.3) {
    if (rnd() < 0.05) continue;
    const pu = u + (rnd() - 0.5) * 0.3, pv = v + (rnd() - 0.5) * 0.7, w = W(pu, pv);
    VEG_EXTRA.push([w.x, w.z, 'cannabis']);
    if (rnd() < 0.3) A.box(0.045, 0.75 + rnd() * 0.3, 0.045, pu + 0.12, Y + 0.42, -(pv - 0.1), '#edbf9a', (rnd() - 0.5) * 0.12);   // бамбуковый колышек
  }
  // бочки и бак с водой у навеса
  for (const [u, v, c] of [[U0 + 6.2, -3.4, '#2a5a9a'], [U0 + 7.1, -3.9, '#2a5a9a'], [U0 + 6.4, 3.3, '#3a3a3c']]) A.tube(u, Y, Y + 0.9, -v, 0.3, 0.3, c, 8);
  A.box(1.1, 1.1, 1.0, U0 + 4.6, Y + 0.75, 3.6, '#e8e8e2'); A.box(1.2, 0.2, 1.1, U0 + 4.6, Y + 0.1, 3.6, PLANK_D);

  // ---------- сушильный навес: четыре столба, односкатная крыша, пучки на жерди ----------
  const su = U0 + 4.2, sw = 2.4, sd = 1.9;
  for (const du of [-sd, sd]) for (const dv of [-sw, sw]) { A.box(0.14, du < 0 ? 2.1 : 2.7, 0.14, su + du, Y + (du < 0 ? 1.05 : 1.35), -dv, '#838681'); postAt(g, su + du, dv); }
  for (let i = 0; i < 6; i++) {                                 // волнистый лист полосами
    const v0 = -sw - 0.5 + i * (2 * sw + 1) / 6, v1 = v0 + (2 * sw + 1) / 6;
    A.quad([su - sd - 0.5, Y + 2.05, -v0], [su + sd + 0.5, Y + 2.85, -v0], [su + sd + 0.5, Y + 2.85, -v1], [su - sd - 0.5, Y + 2.05, -v1], i === 4 ? RUST : TIN[i % 3]);
  }
  A.box(0.07, 0.07, 2 * sw, su, Y + 2.0, 0, PLANK_D);
  for (let i = 0; i < 9; i++) A.tube(su + (rnd() - 0.5) * 0.1, Y + 1.25, Y + 1.98, -(-sw + 0.35 + i * (2 * sw - 0.7) / 8), 0.17, 0.04, rnd() < 0.5 ? '#647148' : '#57683e', 6);   // сохнущие пучки
  g.add(A.mesh());

  // ---------- домик на сваях ----------
  const H = sculptor(), hu = U0 + 7.5, hv = 12, L = 5.2, D = 4.0, F = Y + 0.8, WH = 2.2;      // пол на высоте 0.8 м
  for (const du of [-L / 2 + 0.2, 0, L / 2 - 0.2, L / 2 + 1.3]) for (const dv of [-D / 2 + 0.2, D / 2 - 0.2]) H.box(0.18, 0.8, 0.18, hu + du, Y + 0.4, -(hv + dv), '#5b4a40');
  H.box(L + 1.7, 0.12, D + 0.2, hu + 0.85, F - 0.06, -hv, PLANK_D);                            // пол с верандой
  H.box(0.08, WH, D, hu - L / 2, F + WH / 2, -hv, PLANK); H.box(L, WH, 0.08, hu, F + WH / 2, -(hv - D / 2), PLANK); H.box(L, WH, 0.08, hu, F + WH / 2, -(hv + D / 2), PLANK);
  for (const [dv, w] of [[-1.3, 1.4], [1.3, 1.4]]) H.box(0.08, WH, w, hu + L / 2, F + WH / 2, -(hv + dv), PLANK);   // передняя стена с дверным проёмом
  H.box(0.08, 0.4, 1.2, hu + L / 2, F + WH - 0.2, -hv, PLANK); H.box(0.06, 1.75, 1.15, hu + L / 2 - 0.05, F + 0.9, -hv, '#2a2420');
  for (let i = 1; i < 7; i++) H.box(L + 0.02, 0.03, 0.1, hu, F + i * 0.31, -(hv - D / 2 - 0.01), PLANK_D);          // швы досок на стене к грядкам
  H.box(1.0, 0.75, 0.1, hu - 0.6, F + 1.35, -(hv - D / 2 - 0.02), '#2a2420');                                       // окно
  for (const du of [L / 2 + 1.5]) for (const dv of [-D / 2 + 0.1, D / 2 - 0.1]) H.box(0.1, WH, 0.1, hu + du, F + WH / 2, -(hv + dv), '#5b4a40');   // столбики веранды
  for (let i = 0; i < 3; i++) H.box(0.3, 0.06, 1.0, hu + L / 2 + 1.75 + i * 0.27, F - 0.2 - i * 0.24, -hv, PLANK_D);   // ступени
  // крыша: два ската разной длины из волнистого листа, конёк вдоль u
  const RU0 = hu - L / 2 - 0.5, RU1 = hu + L / 2 + 2.0, EY = F + WH, RY = EY + 1.25, rz = hv + 0.6;
  for (let i = 0; i < 8; i++) {
    const a = RU0 + (RU1 - RU0) * i / 8, b = RU0 + (RU1 - RU0) * (i + 1) / 8;
    H.quad([a, RY, -rz], [b, RY, -rz], [b, EY - 0.25, -(hv - D / 2 - 0.9)], [a, EY - 0.25, -(hv - D / 2 - 0.9)], i === 2 || i === 6 ? RUST : TIN[i % 3]);   // длинный скат — к грядкам
    H.quad([a, RY, -rz], [b, RY, -rz], [b, EY + 0.1, -(hv + D / 2 + 0.5)], [a, EY + 0.1, -(hv + D / 2 + 0.5)], TIN[(i + 1) % 3]);
  }
  for (const u of [hu - L / 2, hu + L / 2]) H.tri([u, EY, -(hv - D / 2)], [u, EY, -(hv + D / 2)], [u, RY - 0.05, -rz], PLANK);   // фронтоны
  g.add(H.mesh());
  wallBox(g, hu + 0.75, hv, L + 1.9, D + 0.2);

  // ---------- уголок отдыха: столик с бонгом и бамбуковое кресло — между домиком и дорожкой ----------
  {
    const T = sculptor(), tu = U0 + 11.2, tv = 5.6, BAM = '#d8b26a', BAM_D = '#a8823f', GLASS = '#6ec0b0', GLASS_L = '#c2ece2';
    // столик: круглая столешница из бамбуковых плашек на трёх ножках
    T.tube(tu, Y + 0.56, Y + 0.62, -tv, 0.42, 0.42, BAM, 10); T.tube(tu, Y + 0.5, Y + 0.56, -tv, 0.44, 0.44, BAM_D, 10);
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.4; T.limb([tu + Math.cos(a) * 0.12, Y + 0.52, -tv + Math.sin(a) * 0.12], [tu + Math.cos(a) * 0.36, Y, -tv + Math.sin(a) * 0.36], 0.03, 0.03, BAM_D, 5); }
    // бонг: колба с водой, длинная трубка, скошенный чубук с чашкой
    const bx = tu + 0.06, bz = -tv - 0.04, B0 = Y + 0.62;
    T.blob(bx, B0 + 0.1, bz, 0.105, 0.1, 0.105, GLASS, 8, 5); T.blob(bx, B0 + 0.07, bz, 0.085, 0.05, 0.085, '#3f8f86', 8, 3);   // вода в колбе
    T.tube(bx, B0 + 0.16, B0 + 0.5, bz, 0.035, 0.035, GLASS, 7); T.tube(bx, B0 + 0.5, B0 + 0.53, bz, 0.048, 0.048, GLASS_L, 7);   // трубка и ободок мундштука
    T.limb([bx + 0.04, B0 + 0.12, bz], [bx + 0.2, B0 + 0.3, bz + 0.03], 0.016, 0.016, GLASS_L, 5);                               // чубук
    T.tube(bx + 0.2, B0 + 0.29, B0 + 0.36, bz + 0.03, 0.02, 0.04, '#2a2a2c', 6);                                                 // чашка
    T.box(0.11, 0.025, 0.06, tu - 0.2, B0 + 0.013, -tv + 0.16, '#d43a2a'); T.tube(tu - 0.12, B0, B0 + 0.03, -tv - 0.2, 0.07, 0.08, '#8a8a84', 7);   // зажигалка, пепельница
    // кресло: рама из бамбука, сиденье и спинка из реек, подлокотники; смотрит на грядки
    const cu = tu - 1.15, cv = tv + 0.15, S0 = Y + 0.4;
    for (const du of [-0.3, 0.3]) for (const dv of [-0.32, 0.32]) T.tube(cu + du, Y, du < 0 ? Y + 1.05 : Y + 0.62, -(cv + dv), 0.028, 0.028, BAM, 6);   // ножки; задние — выше, в спинку
    T.box(0.66, 0.05, 0.7, cu, S0, -cv, BAM);                                                     // сиденье
    for (let i = 0; i < 6; i++) T.box(0.03, 0.56, 0.05, cu - 0.3, S0 + 0.36, -(cv - 0.27 + i * 0.108), i % 2 ? BAM : BAM_D);   // рейки спинки
    T.rod([cu - 0.3, Y + 1.05, -(cv - 0.34)], [cu - 0.3, Y + 1.05, -(cv + 0.34)], 0.05, BAM_D);
    for (const dv of [-0.32, 0.32]) T.rod([cu - 0.3, Y + 0.64, -(cv + dv)], [cu + 0.33, Y + 0.62, -(cv + dv)], 0.05, BAM_D);     // подлокотники
    T.box(0.5, 0.08, 0.54, cu + 0.02, S0 + 0.06, -cv, '#c9d2b4');                                 // подушка
    const lounge = T.mesh();
    g.add(lounge);
    const w = W((tu + cu) / 2, (tv + cv) / 2);
    breakableObjects([lounge], w.x, w.z, 0.85, 'small', 0.03, 'wood');
  }

  // ---------- частокол и створки ворот — разрушаемые ----------
  const PICKET = { step: 2.2, y0: Y, post: [0.14, 1.2, '#6a5a52'], bars: [[0.3, 0.06, '#5b4f48'], [0.78, 0.06, '#5b4f48']], old: 1,   // old — жерди вкривь и вкось, местами выпали
    pickets: [0.17, 0.065, 1.0, ['#8a7d72', '#7a6e64', '#968a7c', '#6e635b', '#a09384']], kind: 'woodfence', loss: 0.03, mat: 'wood' };
  armFence(buildFence(g, [[U1, -HV, U1, -GATE], [U1, GATE, U1, HV], [U1, HV, U0, HV], [U0, HV, U0, -HV], [U0, -HV, U1, -HV]], PICKET));
  armFence(buildFence(g, [[U1, GATE, U1 - 1.5, GATE + 1.7], [U1, -GATE, U1 - 1.5, -GATE - 1.7]], { ...PICKET, step: 3, post: null, kind: 'gate' }));   // створки распахнуты внутрь

  // ---------- вокруг: бананы, пальмы, кусты ----------
  for (let i = 0; i < 70; i++) {
    const u = U0 - 14 + rnd() * (U1 - U0 + 28), v = -HV - 14 + rnd() * (2 * HV + 28), roll = rnd(), w = W(u, v);
    if ((u > U0 - 2.5 && u < U1 + 2.5 && Math.abs(v) < HV + 2.5) || (u > U1 && Math.abs(v) < 9)) continue;      // не на участке и не на подъезде
    VEG_EXTRA.push([w.x, w.z, roll < 0.4 ? 'banana' : roll < 0.6 ? 'coconut' : roll < 0.72 ? 'areca' : roll < 0.84 ? 'clump' : 'bush']);
  }
  spotPlace('ФЕРМА КАННАБИСА', g, sp.road.u + 8, 0, -1, 0);
}

// =====================================================================================================
// МАГАЗИНЫ 7-ELEVEN — refs/seven_eleven
// Типовой придорожный магазин: белая коробка 14 × 11 × 4.2 м, фасад к дороге — сплошное стекло под фризом с тремя
// полосами (оранжевая, зелёная, красная) и квадратом с семёркой, навес над входом, банкоматы у двери, у дороги —
// высокая стела с тем же знаком (скутеры на площадке пока убраны: к ним вернёмся отдельно, геометрия оставлена). Ночью светятся витрина, фриз и стела. Где стоят магазины —
// решает сборщик острова (ISLAND.shops: настоящие точки OSM, прижатые к дорогам игры и прореженные).
// Оси магазина: u — от здания к дороге (локальный +X), v — влево. Здание твёрдое; стела — разрушаемая.
// =====================================================================================================
const SHOP = { W: 14, D: 11, H: 4.2, PARK: 7.5 };
const nightGlow = [];                    // что светится только ночью (витрины, вывески)
let shopParts = null;                    // общая геометрия всех магазинов — строится один раз
function buildShopParts() {
  const { W, D, H } = SHOP, F = D / 2, ORANGE = '#f4811f', GREEN = '#008060', RED = '#c22a2e', WHITE = '#f4f2ec', ALU = '#c3ccd2', GLASS = '#456a78';
  // знак: белый квадрат в зелёной рамке, цифра 7 и слово ELEVEN поперёк. Рисуется лицом к +Z, потом поворачивается куда надо
  const logo = (S, size) => {
    S.box(size, size, 0.06, 0, 0, 0, WHITE);
    for (const [w, h, x, y] of [[size, 0.07, 0, size / 2 - 0.035], [size, 0.07, 0, -size / 2 + 0.035], [0.07, size, -size / 2 + 0.035, 0], [0.07, size, size / 2 - 0.035, 0]]) S.box(w, h, 0.07, x, y, 0, GREEN);
    const px = size * 0.15;
    S.text('7', 0, px * 2.5, 0.04, px, RED, 1);
    S.box(px * 3.1, px * 1.02, 0.02, 0, px * 2.0, 0.045, ORANGE);                 // верх семёрки — оранжевый
    S.box(size * 0.86, px * 1.25, 0.02, 0, -px * 0.4, 0.05, WHITE); S.text('ELEVEN', 0, -px * 0.4 + size * 0.085, 0.065, size * 0.034, GREEN, 1);
  };
  const A = sculptor();
  A.box(D + 0.6, 0.7, W + 0.6, 0, -0.05, 0, '#c9c5bb');                            // цоколь (уходит в землю: магазин поднят над площадкой на 9 см)
  A.box(1.1, 0.15, 5, F + 0.85, 0.075, 0, '#c9c5bb');                              // ступень у входа
  A.box(D, H, W, 0, 0.3 + H / 2, 0, WHITE); A.box(D + 0.3, 0.22, W + 0.3, 0, 0.3 + H + 0.11, 0, '#d9d6cf');   // стены и парапет
  A.box(0.1, 2.5, W - 1.2, F + 0.03, 0.3 + 1.3, 0, GLASS);                         // витрина во весь фасад
  for (let z = -W / 2 + 0.6; z <= W / 2 - 0.59; z += (W - 1.2) / 6) A.box(0.14, 2.6, 0.1, F + 0.05, 0.3 + 1.3, z, ALU);
  A.box(0.14, 0.1, W - 1.2, F + 0.05, 0.3 + 2.55, 0, ALU); A.box(0.14, 0.12, W - 1.2, F + 0.05, 0.36, 0, ALU);
  A.box(0.13, 2.25, 1.9, F + 0.07, 0.3 + 1.12, 0, '#2f4a56'); A.box(0.15, 2.3, 0.07, F + 0.08, 0.3 + 1.15, 0, ALU);   // раздвижные двери
  const rp = seededRandom(711);
  for (let i = 0; i < 9; i++) {                                                  // объявления и товары за стеклом
    const z = -W / 2 + 1.2 + rp() * (W - 2.4); if (Math.abs(z) < 1.2) continue;
    A.box(0.04, 0.4 + rp() * 0.5, 0.5 + rp() * 0.6, F + 0.1, 0.8 + rp() * 1.3, z, ['#e8d24a', '#d84a3a', '#f2f2ee', '#3a8ad8', '#e88a2a'][(rp() * 5) | 0]);
  }
  // фриз: белые панели, три полосы; над входом — квадрат со знаком
  A.box(0.3, 1.05, W, F + 0.16, 0.3 + 3.45, 0, WHITE);
  for (const [h, y, c] of [[0.17, 0.33, ORANGE], [0.3, 0.03, GREEN], [0.17, -0.27, RED]]) A.box(0.32, h, W - 0.3, F + 0.17, 0.3 + 3.45 + y, 0, c);
  for (let z = -W / 2 + W / 6; z < W / 2 - 0.1; z += W / 6) if (Math.abs(z) > 0.9) A.box(0.34, 1.05, 0.08, F + 0.17, 0.3 + 3.45, z, WHITE);
  // навес над входом на стойках; банкоматы; урна; кондиционеры на боковой стене
  A.box(2.7, 0.1, W - 2, F + 1.4, 0.3 + 2.85, 0, '#e6eaee');
  for (const z of [-W / 2 + 1.2, -2.2, 2.2, W / 2 - 1.2]) A.box(0.09, 2.85, 0.09, F + 2.6, 0.3 + 1.42, z, '#9da9b1');
  [['#f2b21e', '#3a2a10'], ['#1f4fa0', '#f2f2ee'], ['#5a2d8a', '#f2c81e']].forEach(([c, c2], i) => {
    const z = W / 2 - 1.0 - i * 0.85;
    A.box(0.62, 1.75, 0.68, F + 0.5, 0.3 + 0.875, z, c); A.box(0.05, 0.4, 0.42, F + 0.82, 0.3 + 1.2, z, '#1a2a3a'); A.box(0.05, 0.22, 0.5, F + 0.82, 0.3 + 1.6, z, c2);
  });
  A.box(0.45, 0.8, 0.45, F + 0.55, 0.3 + 0.4, -W / 2 + 0.9, '#2f7a4a');
  for (const x of [-2.5, 0.5]) A.box(0.9, 0.7, 0.35, x, 3.2, W / 2 + 0.18, '#d8dade');
  // площадка перед магазином: бетон, белые линии стоянки
  const P0 = F + 0.3, P1 = F + SHOP.PARK;
  A.quad([P0, 0.08, -W / 2 - 3], [P1, 0.08, -W / 2 - 3], [P1, 0.08, W / 2 + 3], [P0, 0.08, W / 2 + 3], '#a29f97');   // выше придорожной полосы земли (та — на 3 см над землёй)
  A.skirt(P0, P1, -W / 2 - 3, W / 2 + 3, 0.08, '#9c9a92', 0.4, 'a');
  for (let z = -W / 2 - 1; z <= W / 2 + 1.01; z += 2.6) A.quad([P0 + 3.4, 0.09, z - 0.06], [P1 - 0.6, 0.09, z - 0.06], [P1 - 0.6, 0.09, z + 0.06], [P0 + 3.4, 0.09, z + 0.06], '#e6e6e2');
  const building = A.mesh().geometry;
  { const L = sculptor(); logo(L, 1.4); const m = L.mesh().geometry; m.rotateY(Math.PI / 2); m.translate(F + 0.36, 0.3 + 3.6, 0); shopParts = { logoFront: m }; }
  // стела: белый столб и куб со знаком на четырёх гранях
  const P = sculptor();
  P.tube(0, 0, 7.6, 0, 0.2, 0.16, WHITE, 8); P.box(1.45, 1.45, 1.45, 0, 8.3, 0, WHITE);
  const pole = P.mesh().geometry, cubeLogos = [];
  for (let k = 0; k < 4; k++) { const L = sculptor(); logo(L, 1.4); const m = L.mesh().geometry; m.translate(0, 0, 0.73); m.rotateY(k * Math.PI / 2); m.translate(0, 8.3, 0); cubeLogos.push(m); }
  // скутер: сиденье, щиток, руль, два колеса
  const scooter = (color) => {
    const S = sculptor();
    S.box(1.0, 0.3, 0.34, 0, 0.5, 0, color); S.box(0.62, 0.12, 0.3, -0.22, 0.72, 0, '#1c1c1e');           // корпус, сиденье
    S.box(0.14, 0.75, 0.36, 0.52, 0.7, 0, color, -0.25); S.box(0.08, 0.08, 0.6, 0.6, 1.08, 0, '#2a2a2c');  // щиток, руль
    S.box(0.06, 0.16, 0.2, 0.66, 0.92, 0, '#f0f0d8');
    for (const x of [-0.5, 0.62]) S.tube(x, 0, 0.5, 0, 0.0, 0.0, '#111', 3), S.box(0.46, 0.46, 0.12, x, 0.23, 0, '#151517');
    return S.mesh().geometry;
  };
  // крыша с черепицей — у части магазинов
  const R = sculptor();
  R.hip(0, 0, D / 2 + 0.7, W / 2 + 0.7, 0.3 + H + 0.2, D / 2 - 3.4, W / 2 - 3.4, 0.3 + H + 2.2, (i) => i % 2 ? '#d19685' : '#c4877a');
  R.hip(0, 0, D / 2 - 3.4, W / 2 - 3.4, 0.3 + H + 2.2, 0.01, W / 2 - 5.2, 0.3 + H + 3.0, (i) => i % 2 ? '#d9a092' : '#c98d80');
  Object.assign(shopParts, { building, pole, cubeLogos, scooters: ['#c8302a', '#2a4a9a', '#1e1e20', '#e8e4da'].map(scooter), roof: R.mesh().geometry });
}
function buildShops() {
  buildShopParts();
  const { W, D, PARK } = SHOP, F = D / 2, P = shopParts;
  const SIGN_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });       // знак светится сам — и днём, и ночью
  const GLOW_MAT = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const FRIEZE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  const glassGeo = new THREE.PlaneGeometry(W - 1.4, 2.4).rotateY(Math.PI / 2), friezeGeo = new THREE.PlaneGeometry(W, 1.05).rotateY(Math.PI / 2);
  const seen = {};                                                   // сколько магазинов района уже названо
  IS.shops.forEach((s, k) => {
    const g = new THREE.Group();
    g.position.set(s.x, s.y + 0.09, s.z); g.rotation.y = -s.az;        // поднят на 9 см: бетон площадки — выше придорожной полосы земли (см. LOT_RISE в stores.js)
    scene.add(g);
    const flip = k % 2 ? -1 : 1, body = new THREE.Group();          // через один — зеркально: банкоматы и стела с другой стороны
    body.scale.z = flip; g.add(body);
    body.add(new THREE.Mesh(P.building, SHIP_MAT));
    g.add(new THREE.Mesh(P.logoFront, SIGN_MAT));                  // знак — вне зеркалимой части, иначе надпись читается задом наперёд
    if (k % 3 === 0) body.add(new THREE.Mesh(P.roof, SHIP_MAT));
    const glass = new THREE.Mesh(glassGeo, GLOW_MAT), frieze = new THREE.Mesh(friezeGeo, FRIEZE_MAT);
    glass.position.set(F + 0.12, 1.6, 0); frieze.position.set(F + 0.36, 3.75, 0); glass.visible = frieze.visible = false;
    body.add(glass, frieze); nightGlow.push(glass, frieze);
    g.updateMatrixWorld(true);
    const W3 = (u, v) => g.localToWorld(new THREE.Vector3(u, 0, -v));
    // стела у дороги
    const pole = new THREE.Group(), pu = F + PARK - 1.2, pv = -flip * (W / 2 + 2.2);
    pole.add(new THREE.Mesh(P.pole, SHIP_MAT), ...P.cubeLogos.map(m => new THREE.Mesh(m, SIGN_MAT)));
    pole.position.set(pu, 0, -pv); g.add(pole);
    { const w = W3(pu, pv); breakableObjects([pole], w.x, w.z, 0.22, 'pole', 0.08, 'metal'); }
    g.updateMatrixWorld(true);
    lotApron(g, F + PARK, -W / 2 - 3, W / 2 + 3, 0.08, '#a29f97');                                  // бетон сходит к асфальту рваным краем
    if (k === 0) parkVehicle(g, bakedCarGeo('lancia', '#9ad8c0'), F + PARK - 2.3, -3.7, 'u-', 0.08);              // мятная Lancia Delta
    else if (k % 4 === 1) parkVehicle(g, pickupGeo(['boxes', 'empty', 'coconuts', 'closed', 'songthaew'][(k >> 2) % 5], ['#e8e8e4', '#2f5f9a', '#6a6e72', '#b8302a', '#1c1c1e'][(k >> 2) % 5]), F + PARK - 3.0, -3.7, 'u-', 0.08);
    else if (k % 4 === 3) parkVehicle(g, parkedCar(k), F + PARK - 2.9, -3.7, k % 8 === 3 ? 'u-' : 'u+', 0.08);   // Hilux, D-Max, City
    if (k % 5 === 2) parkVehicle(g, parkedCar(k + 5), F + PARK - 2.9, -7.4, 'u-', 0.08);
    scooterRow(g, k, 1 + (k * 3) % 4, F + 3.5, 2.4, 0, 0.85, Math.PI, 0.08);                                        // скутеры у входа, носом к магазину
    if (k % 3 !== 1) {                                                                               // у двух магазинов из трёх — мусорки у фасада (по другую сторону от скутеров)
      const B = propBatch(), q = seededRandom(k * 17 + 3);
      for (let i = 0, n = k % 4 === 0 ? 2 : 1; i < n; i++) { const w = W3(F + 0.7, -(W / 2 - 0.9 - i * 0.75)); propBin(B, w.x, s.y + 0.17, w.z, -s.az, q); }
      B.finish([s.x, s.z]);
    }
    wallBox(g, 0, 0, D + 0.4, W + 0.4);
    const lot = (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -F - 4 && p.x < F + PARK + 1 && Math.abs(p.z) < W / 2 + 5; };
    vegKeepOut.push(Object.assign(lot, { c: [s.x, s.z, 26] }));
    pavedAreas.push({ x: s.x, z: s.z, r2: 26 * 26, lift: 0.17,                                      // колёса и следы шин — по бетону площадки
      test: (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > F + 0.3 && p.x < F + PARK && Math.abs(p.z) < W / 2 + 3; } });
    g.userData.c = new THREE.Vector3(s.x, 0, s.z); pierGroups.push(g);          // вдали не рисуется — вместе с пирсами
    // у каждого магазина — свой быстрый переход: «7-ELEVEN район N»
    const area = s.area.replace(/\s*[\/(].*$/, '').toUpperCase();
    seen[area] = (seen[area] || 0) + 1;
    spotPlace('7-ELEVEN ' + area + (IS.shops.filter(o => o.area.replace(/\s*[\/(].*$/, '').toUpperCase() === area).length > 1 ? ' ' + seen[area] : ''), g, F + PARK + 4, 0, -1, 0);
    LANDMARKS[LANDMARKS.length - 1].shop = true;
  });
  airportAnim.push(() => { const on = skyNow.night > 0.3; for (const m of nightGlow) if (m.visible !== on) m.visible = on; });
}

// =====================================================================================================
// ВОДОПАДЫ — refs/namuang_waterfall_1, namuang_waterfall_2, hin_lad_waterfall
// Площадку с чашей, уступы склона за ней и подъездную дорогу делает сборщик острова (ISLAND.spots). Здесь — скалы
// (сетка граней с неровностями, цвет по влажности), вода и всё вокруг. Вода течёт по-настоящему: по скале лежат ленты,
// по ним сверху вниз бежит полосатая текстура струй; так же течёт ручей из чаши, в чаше ходит рябь, у подножия
// струй поднимаются брызги. Оси места: u — куда смотрит водопад (вниз по склону), v — влево, уровень площадки — P.y.
// =====================================================================================================
let FALL_TEX = null, FALL_MAT = null, POOL_TEX = null, POOL_MAT = null, STREAM_TEX = null, STREAM_MAT = null;
const fallSounds = [];                   // откуда шумит водопад: { id, x, z, kind: 'big' | 'small' } — для звука (sound.js)
const fallStreams = [];                  // ручьи: { id, pts: [[x, z], ...], ys: высота воды в каждой точке } — для проверок
const fallSprays = [];                   // подножия струй в мире: [x, y, z, ширина] — там поднимаются брызги
function fallMaterials() {
  if (FALL_MAT) return;
  FALL_TEX = pixelTexture(32, 64, (g, w, h) => {                    // струи: белые полосы разной длины, между ними просветы
    const rnd = seededRandom(77);
    for (let x = 0; x < w; x++) {
      const dens = 0.55 + 0.45 * Math.abs(Math.sin(x * 0.83));
      for (let y = (rnd() * 12) | 0; y < h;) {
        const len = 5 + ((rnd() * 20) | 0);
        for (let i = 0; i < len; i++) { const a = Math.sin(Math.PI * (i + 0.5) / len); g.fillStyle = 'rgba(' + (228 + 27 * a | 0) + ',' + (240 + 15 * a | 0) + ',255,' + ((0.3 + 0.65 * a) * dens).toFixed(2) + ')'; g.fillRect(x, (y + i) % h, 1, 1); }
        y += len + 2 + ((rnd() * 9) | 0);
      }
    }
  });
  FALL_MAT = lambert({ map: FALL_TEX, transparent: true, depthWrite: false, side: THREE.DoubleSide, emissive: 0x2a3236 });
  POOL_TEX = pixelTexture(32, 32, (g, w, h) => {                    // вода в чаше: мутно-зелёная, со светлой рябью
    const rnd = seededRandom(78);
    g.fillStyle = '#6f7d52'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = ['#7f8f5e', '#62704a', '#8b9a6a', '#56653f'][(rnd() * 4) | 0]; g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 2 + ((rnd() * 4) | 0), 1); }
    for (let i = 0; i < 14; i++) { g.fillStyle = '#c4d2b4'; g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 2 + ((rnd() * 3) | 0), 1); }
  });
  POOL_MAT = lambert({ map: POOL_TEX, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  STREAM_TEX = pixelTexture(32, 32, (g, w, h) => {                  // вода ручья: светлее и синее чаши — на траве её должно быть видно
    const rnd = seededRandom(79);
    g.fillStyle = '#5b9290'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = ['#6aa39d', '#4f8482', '#78b0a8', '#467876'][(rnd() * 4) | 0]; g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1, 2 + ((rnd() * 5) | 0)); }
    for (let i = 0; i < 12; i++) { g.fillStyle = '#d4ece6'; g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1, 2 + ((rnd() * 3) | 0)); }
  });
  STREAM_MAT = lambert({ map: STREAM_TEX, side: THREE.DoubleSide, emissive: 0x101c1c });
  let last = 0;
  airportAnim.push((t) => {
    const dt = Math.min(0.05, Math.max(0, t - last)); last = t;
    FALL_TEX.offset.y = (t * 0.85) % 1;                             // струи бегут вниз
    POOL_TEX.offset.set((t * 0.02) % 1, (t * 0.035) % 1);
    STREAM_TEX.offset.y = (t * 0.22) % 1;                           // ручей течёт вдоль русла
    for (const [x, y, z, w] of fallSprays) {                        // брызги у подножия: видны, когда машина рядом
      if ((x - camPos.x) ** 2 + (z - camPos.z) ** 2 > 170 * 170) continue;
      for (let n = dt * 16 * w + Math.random(); n >= 1; n--) {
        if (dust.length >= DUST_MAX) dust.shift();
        const a = Math.random() * 6.283, r = Math.random() * w * 0.5;
        dust.push({ x: x + Math.cos(a) * r, y: y + 0.2, z: z + Math.sin(a) * r, col: SPRAY_COL, vx: Math.cos(a) * 1.4, vy: 1.6 + Math.random() * 2.4, vz: Math.sin(a) * 1.4,
          age: 0, life: 0.7 + Math.random() * 0.8, size: 0.5 + Math.random() * 0.5, shade: 1 });
      }
    }
  });
}
const SPRAY_COL = new THREE.Color('#eef4f6');
// накопитель водяных лент: все ленты места — одна геометрия
function waterBuf() { return { pos: [], uv: [], idx: [] }; }
// Скала-уступ. o: u0 — подножие, y0 — его высота, H — высота уступа, run — насколько верх отступает (пологость),
// half — полуширина стенки, wing — ширина крыльев (уходят назад в склон), back — глубина «шапки» наверху, vc — середина по v,
// bulge — выпуклость к зрителю, rough — неровность, pal — цвета сухого камня, wetPal — мокрого, wet(a, t) — где мокро (0..1).
// Возвращает surf(a, t) — точку поверхности (a — поперёк, t = 0..1 снизу вверх): по ней ложится вода.
function rockFace(S, o) {
  const gy = (u, z) => { const w = o.g.localToWorld(new THREE.Vector3(u, 0, z)); return groundY(w.x, w.z); };   // высота земли под точкой места
  const na = o.na || 16, nt = o.nt || 9, A = o.half + o.wing, vc = o.vc || 0, rough = o.rough === undefined ? 1 : o.rough, P = [];
  for (let i = 0; i <= na; i++) {
    P.push([]);
    for (let j = 0; j <= nt; j++) {
      const a = -A + 2 * A * i / na, t = j / nt, wf = Math.max(0, (Math.abs(a) - o.half) / o.wing), inner = i > 0 && i < na ? 1 : 0;
      const n1 = hash2(i * 7 + o.seed, j * 13 + 5) - 0.5, n2 = hash2(i * 3 + 11, j * 5 + o.seed) - 0.5;
      const u = o.u0 - o.run * (o.lin ? t : Math.pow(t, 0.9)) + (o.bulge === undefined ? 1.5 : o.bulge) * Math.cos(Math.min(1, Math.abs(a) / o.half) * Math.PI / 2) - wf * wf * o.wing * 0.9 + n1 * 1.5 * rough * inner * (j ? 1 : 0.3);
      let y = o.y0 + o.H * t * (1 - 0.45 * wf) + (j ? n2 * 0.9 * rough * inner : -0.5);
      if (!inner) y = Math.min(y, gy(u, -(vc + a)) + 0.25);           // крайние столбцы уходят в склон — не висят над землёй
      P[i].push([u, y, -(vc + a)]);
    }
  }
  const pal = o.pal, wetPal = o.wetPal || ['#2e3c44', '#1c1a1b', '#3f3e3a', '#784d24'];
  for (let i = 0; i < na; i++) for (let j = 0; j < nt; j++) {
    const a = -A + 2 * A * (i + 0.5) / na, t = (j + 0.5) / nt, w = o.wet ? o.wet(a, t) : 0, r = hash2(i * 5 + o.seed, j * 9 + 1);
    const c = w > 0.55 ? wetPal[(r * wetPal.length) | 0] : w > 0.25 && r < 0.5 ? wetPal[wetPal.length - 1] : r > 0.9 && o.moss ? o.moss : pal[(r * pal.length) | 0];
    S.quad(P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1], c);
  }
  // «шапка»: от кромки назад двумя поясами; дальний край лежит на земле (или чуть ниже неё) — сзади и сбоку просветов нет
  const cap = (k, r) => {
    const T = P[k][nt], u = T[0] - o.back * r / 2;
    return r === 0 ? T : [u + (hash2(k * 5, o.seed + r) - 0.5) * 1.2, r === 2 ? Math.min(T[1] + 0.3, gy(u, T[2]) + 0.12) : T[1] + 0.15 + (hash2(k * 3, o.seed) - 0.5) * 0.35, T[2]];
  };
  for (let i = 0; i < na; i++) for (let r = 0; r < 2; r++) {
    const h = hash2(i * 7 + r * 3, o.seed + 9);
    S.quad(cap(i, r), cap(i + 1, r), cap(i + 1, r + 1), cap(i, r + 1), h < 0.16 ? (o.moss || '#4a6a34') : pal[(h * 37 | 0) % pal.length]);
  }
  return (a, t) => {                                                // билинейно по сетке — вода ложится точно на грани
    const fi = Math.max(0, Math.min(na - 1e-6, (a + A) / (2 * A) * na)), fj = Math.max(0, Math.min(nt - 1e-6, t * nt)), i = fi | 0, j = fj | 0, x = fi - i, y = fj - j;
    const m = (k) => (P[i][j][k] * (1 - x) + P[i + 1][j][k] * x) * (1 - y) + (P[i][j + 1][k] * (1 - x) + P[i + 1][j + 1][k] * x) * y;
    return [m(0), m(1), m(2)];
  };
}
// Струя по скале: path — точки [a, t] снизу вверх; width — ширина (м, внизу и вверху); speed — во сколько раз быстрее обычного.
function fallStrand(Wb, surf, path, w0, w1, speed = 1, lift = 0.22) {
  const u0 = Math.random(), base = Wb.pos.length / 3; let len = 0, prev = null;
  path.forEach(([a, t], k) => {
    const w = w0 + (w1 - w0) * k / (path.length - 1), L = surf(a - w / 2, t), R = surf(a + w / 2, t), c = surf(a, t);
    if (prev) len += Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]);
    prev = c;
    Wb.pos.push(L[0] + lift, L[1] + lift * 0.4, L[2], R[0] + lift, R[1] + lift * 0.4, R[2]);
    Wb.uv.push(u0, len / (7 * speed), u0 + w / 8, len / (7 * speed));
    if (k) { const b = base + (k - 1) * 2; Wb.idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  });
}
// чаша: водная гладь-эллипс; возвращает меш
function fallPool(g, cu, cv, ru, rv, y) {
  const pos = [cu, y, -cv], uv = [cu / 7, cv / 7], idx = [], N = 18;
  for (let i = 0; i < N; i++) { const a = i / N * 6.283, u = cu + Math.cos(a) * ru, v = cv + Math.sin(a) * rv; pos.push(u, y, -v); uv.push(u / 7, v / 7); idx.push(0, 1 + i, 1 + (i + 1) % N); }
  g.add(meshFrom(pos, uv, idx, POOL_MAT));
}
// Ручей из чаши. Вода уходит только вниз, а площадка водопада врезана в склон: вбок от неё — откос, на который ручью
// не подняться. Поэтому русло идёт по краю площадки (в полосе band — по одну сторону от оси, там, где ниже земля),
// а за ней — вниз вдоль подъездной дороги, в стороне от обочины: дорога спускается от водопада по дну лощины, и земля
// рядом с ней лежит на её уровне. Уровень воды считается с конца: в каждой точке он не ниже любой точки русла ниже по
// течению — вода нигде не течёт вверх, перед бугорком стоит плёсом. Русло обрывается заводью там, где дальше земля
// поднимается больше чем на 0.45 м, у другой дороги или через maxLen метров. На стоянку вода не попадает: стоянка —
// по другую сторону от русла. Ручей может впадать в другую воду: tail — точки [x, z] в мире, которыми русло заканчивается
// (дорогу ручей провожает, пока не подойдёт к первой из них); заводи в конце тогда нет.
// o: out — исток на кромке чаши [u, v]; side — с какой стороны от оси идёт русло (+1 — v > 0);
// inner — ближе чего к оси русло не подходит (число или функция от u: у чаши ровное место узкое), outer — дальше чего; width; maxLen.
// Возвращает уровень воды у истока — на нём стоит чаша.
function fallStream(g, id, o) {
  const SP = g.userData.spot, L = SP.y, R = roads.find((r) => r.name === 'spot ' + id), W = (u, v) => g.localToWorld(new THREE.Vector3(u, 0, -v));
  const side = o.side, inner = typeof o.inner === 'function' ? o.inner : () => o.inner, b1 = o.outer;
  const width = o.width || 2.6, line = [W(o.out[0], o.out[1])], uEnd = SP.road ? SP.road.u : o.out[0] + 40;
  // куда сдвинуться вбок: туда, где земля ниже (при равных — прямо)
  const pick = (cur, lo, hi, ground) => { let best = cur, bg = Infinity; for (const d of [0, -1.2, 1.2, -2.4, 2.4]) { const c = Math.max(lo, Math.min(hi, cur + d)), y = ground(c) + Math.abs(d) * 0.03; if (y < bg) { bg = y; best = c; } } return best; };
  let v = Math.abs(o.out[1]);
  for (let u = o.out[0] + 4; u < uEnd - 1; u += 4) {
    const b0 = inner(u);
    v = v < b0 ? Math.min(b0, v + 3.2) : pick(v, b0, b1, (c) => spotGround(g, u, side * c));
    line.push(W(u, side * v));
  }
  if (R && SP.road) {
    const e = W(SP.road.u, SP.road.v), a = roadPoint(R, 0, 0), b = roadPoint(R, R.len, 0);
    const s0 = Math.hypot(a[0] - e.x, a[1] - e.z) < Math.hypot(b[0] - e.x, b[1] - e.z) ? 0 : R.len, dir = s0 ? -1 : 1, ri = roads.indexOf(R);
    const pr = roadPoint(R, s0 + dir * 4, 10), q = g.worldToLocal(new THREE.Vector3(pr[0], 0, pr[1])), sg = Math.sign(-q.z) === side ? 1 : -1;   // с какой стороны от оси дороги наша сторона
    let off = v;
    for (let t = 2; t < Math.min(o.maxLen || 240, R.len - 45); t += 6) {
      const at = (c) => roadPoint(R, s0 + dir * t, sg * c);
      off = pick(off, halfS + 3.4, 24, (c) => { const p = at(c); return groundY(p[0], p[1]); });
      const p = at(off), other = roadAt(p[0], p[1], Infinity, ri);
      if (groundY(p[0], p[1]) < 0.4 || (t > 45 && other && other.d < halfS + 8)) break;
      if (o.tail && Math.hypot(p[0] - o.tail[0][0], p[1] - o.tail[0][1]) < 15) break;                // дальше — к месту слияния
      line.push(new THREE.Vector3(p[0], 0, p[1]));
    }
  }
  if (o.tail) for (const [x, z] of o.tail) line.push(new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(line, false, 'centripetal'), LEN = curve.getLength(), N0 = Math.max(4, Math.round(LEN / 2.5)), P = curve.getSpacedPoints(N0);
  // где кончить: дальше земля выше уже пройденной больше чем на 0.45 м (площадку считаем не ниже её уровня: исток — в чаше)
  const gr = P.map((p, k) => { const y = groundY(p.x, p.z); return k * LEN / N0 < 20 ? Math.max(y, L - 0.05) : y; });
  let N = N0, low = Infinity;
  for (let k = 0; k <= N0; k++) { if (gr[k] - low > 0.45) { N = k - 1; break; } low = Math.min(low, gr[k]); }
  const ys = new Array(N + 1); let hi = -Infinity;
  for (let k = N; k >= 0; k--) { hi = Math.max(hi, gr[k] + 0.06); ys[k] = hi; }
  const pos = [], uv = [], idx = [], pos2 = [], uv2 = [], pts = [], St = sculptor(), rnd = seededRandom(31 + id.length * 7);
  const ROCK = ['#8a8a80', '#a8a49b', '#78766a', '#bfb29b'];
  let bed = null;
  for (let k = 0; k <= N; k++) {
    const p = P[k], a = P[Math.max(0, k - 1)], b = P[Math.min(N, k + 1)], dl = Math.hypot(b.x - a.x, b.z - a.z) || 1, dx = (b.x - a.x) / dl, dz = (b.z - a.z) / dl;
    const w = width * (0.8 + 0.4 * hash2(k, 5)), nx = -dz * w / 2, nz = dx * w / 2, s = k * LEN / N0, y = ys[k];
    pos.push(p.x - nx, y, p.z - nz, p.x + nx, y, p.z + nz); uv.push(0, -s / 5, 0.5, -s / 5);
    { const e = 1 + 1.5 / w, bl = [p.x - nx * e, 0, p.z - nz * e], br = [p.x + nx * e, 0, p.z + nz * e];      // галечное ложе шире воды
      bl[1] = Math.min(groundY(bl[0], bl[2]) + 0.035, y - 0.02); br[1] = Math.min(groundY(br[0], br[2]) + 0.035, y - 0.02);
      if (bed) St.quad(bed[0], bed[1], br, bl, k % 2 ? '#8d8468' : '#857c60');
      bed = [bl, br]; }
    pos2.push(p.x - nx * 0.45, y + 0.03, p.z - nz * 0.45, p.x + nx * 0.45, y + 0.03, p.z + nz * 0.45); uv2.push(0.1, -s / 9, 0.1 + width / 22, -s / 9);   // по стрежню — редкие светлые струи
    if (k) { const i = (k - 1) * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    pts.push([p.x, p.z]);
    if (k > 1) for (const sd of [-1, 1]) if (rnd() < 0.6) {                                        // камни по берегам: кромка воды не висит над землёй
      const r = 0.3 + rnd() * 0.5, d = w / 2 + r * 0.35 + rnd() * 0.3, bx = p.x - sd * dz * d, bz = p.z + sd * dx * d;
      St.blob(bx, Math.max(groundY(bx, bz), y - r * 0.2) + r * 0.2, bz, r, r * 0.62, r * (0.8 + rnd() * 0.4), ROCK[(rnd() * ROCK.length) | 0], 6, 4);
    }
  }
  if (!o.tail || N < N0) { const e = P[N], y = ys[N], n = 12, b = pos.length / 3; pos.push(e.x, y, e.z); uv.push(0.2, LEN / 6);      // заводь в конце: дальше вода уходит в землю
    for (let i = 0; i < n; i++) { const a = i / n * 6.283, r = 3.2 + hash2(i, 9) * 1.2; pos.push(e.x + Math.cos(a) * r, y, e.z + Math.sin(a) * r); uv.push(0.2 + Math.cos(a) * 0.3, LEN / 6 + Math.sin(a) * 0.6); idx.push(b, b + 1 + i, b + 1 + (i + 1) % n);
      const br = 0.5 + hash2(i, 3) * 0.6, bx = e.x + Math.cos(a) * (r + 0.3), bz = e.z + Math.sin(a) * (r + 0.3); if (i % 6 !== 3) St.blob(bx, groundY(bx, bz) + br * 0.3, bz, br, br * 0.65, br, ROCK[i % ROCK.length], 6, 4); } }
  scene.add(meshFrom(pos, uv, idx, STREAM_MAT), meshFrom(pos2, uv2, idx.slice(0, N * 6), FALL_MAT), St.mesh());
  const mid = P[N >> 1];
  fallStreams.push({ id, pts, ys });
  vegKeepOut.push(Object.assign((px, pz) => pts.some(([sx, sz]) => (px - sx) ** 2 + (pz - sz) ** 2 < 12), { c: [mid.x, mid.z, LEN / 2 + 12] }));
  return Math.max(L + 0.06, ys[0]);
}
// камни по кромке чаши (кроме стороны скалы): вода не висит над берегом
function poolRim(S, g, cu, cv, ru, rv, pal) {
  for (let a = -2.0, i = 0; a < 2.0; a += 0.13, i++) {
    const r = 0.45 + hash2(i, cu) * 0.4, k = 1.02 + hash2(i, 7) * 0.06;
    boulder(S, g, cu + Math.cos(a) * ru * k, cv + Math.sin(a) * rv * k, 0, r, pal[i % pal.length], 0.75);
  }
}
// Двор водопада: не прямоугольник, а утоптанная поляна с неровным краем. От дороги — асфальтовый проезд с разворотным
// кругом, сбоку от него карманы стоянки с разметкой, колесоотбойниками и красно-белым бордюром; у въезда арка с названием
// и будка кассира; от круга к чаше — дорожка из каменных плит; скамьи, фонари, урны. Русло ручья (stream — с какой
// стороны, inner — на каком расстоянии от оси оно начинается) остаётся в траве. o: u0, u1 — двор вдоль оси, hv — полуширина,
// lot: [ua, ub] — карманы стоянки вдоль u, lotSide — с какой стороны, pool — до какого u доходит чаша, name.
function fallYard(g, S, L, o) {
  const SP = g.userData.spot, ru = SP.road ? SP.road.u : o.u1, G = (u, v) => spotGround(g, u, v);
  const [ua, ub] = o.lot, ls = o.lotSide, uc = (o.u0 + o.u1) / 2, hu = (o.u1 - o.u0) / 2 + 1;
  const wet = (u, v) => !!o.stream && v * o.stream > (typeof o.inner === 'function' ? o.inner(u) : o.inner) - 2.7;   // полоса ручья с берегами: ни асфальт, ни земля двора туда не заходят
  const asph = (u, v) => !wet(u, v) && ((Math.abs(v) < 5 && u > ua) || Math.hypot(u - ua, v) < 8.6 || (u > ua && u < ub && v * ls > 0 && Math.abs(v) < 10.8));
  const inYard = (u, v) => {
    if (wet(u, v)) return false;
    if (asph(u, v)) return true;
    const e = Math.pow(Math.abs(u - uc) / hu, 4) + Math.pow(Math.abs(v) / (o.hv + 1), 4);
    return e < 0.86 + 0.3 * hash2(Math.floor(u / 4), Math.floor(v / 4));
  };
  const DIRT = ['#a8734e', '#9f6b47', '#b07c56', '#a67250'];
  const Y = sculptor();
  drape(Y, g, o.u0 - 2, Math.max(o.u1, ru) + 2, -o.hv - 2, o.hv + 2, (i, j, u, v) => asph(u, v) ? ((i + j) % 2 ? '#828280' : '#7d7d7a') : DIRT[(hash2(i, j) * 4) | 0], 0.06, 2, inYard);
  padBlend(g, Math.max(o.u1, ru) + 2, 1, -5, 5, '#828280');                                        // асфальт двора плавно переходит в подъездную дорогу
  // разметка карманов, колесоотбойники, красно-белый бордюр
  for (let u = ua + 1; u <= ub - 0.5; u += 3) {
    const y = G(u, ls * 8) + 0.1; Y.quad([u - 0.07, y, -ls * 5.2], [u + 0.07, y, -ls * 5.2], [u + 0.07, y, -ls * 10.4], [u - 0.07, y, -ls * 10.4], '#e8e8e4');
    if (u + 3 <= ub - 0.5) Y.box(1.7, 0.16, 0.22, u + 1.5, G(u + 1.5, ls * 9.9) + 0.14, -ls * 9.9, '#d8c83a');
  }
  for (let u = ua, i = 0; u < ub; u += 1.5, i++) Y.box(1.5, 0.22, 0.3, u + 0.75, G(u + 0.75, ls * 11) + 0.12, -ls * 11, i % 2 ? '#c8302a' : '#f2f2ee');
  // дорожка из каменных плит от разворотного круга к чаше
  for (let u = o.pool + 1.5, i = 0; u < ua - 9; u += 1.45, i++) { const v = (hash2(i, 31) - 0.5) * 0.9; Y.box(1.15, 0.1, 1.5 + hash2(i, 8) * 0.7, u, G(u, v) + 0.1, -v, ['#b4b0a6', '#a39f96', '#c2beb4'][i % 3], 0, (hash2(i, 4) - 0.5) * 0.5); }
  g.add(Y.mesh());
  // арка на въезде: два бревенчатых столба, перекладина, доска с названием (читается с дороги)
  { const au = ru + (o.arch || 4), y = G(au, 0);
    for (const s of [-1, 1]) { S.tube(au, G(au, s * 6.6) - 0.1, y + 5.4, -s * 6.6, 0.24, 0.19, '#6a4a2e', 7); wallBox(g, au, s * 6.6, 0.6, 0.6); S.rod([au, y + 4.0, -s * 6.6], [au, y + 5.1, -s * 5.2], 0.14, '#6a4a2e'); }
    const faces = [sculptor(), sculptor()]; let th = 0; for (const T of faces) th = signLines(T, o.name, 8.0, '#f4e8c8', 0.09, 0.14);   // над названием — тайское
    const bh = Math.max(1.15, th + 0.4), yc = y + 5.08 - bh / 2;                                          // доска висит под перекладиной
    S.box(0.26, 0.26, 14.2, au, y + 5.25, 0, '#6a4a2e'); S.box(0.14, bh, 9, au, yc, 0, '#5a3a22'); S.box(0.3, 0.1, 9.6, au, y + 5.52, 0, '#8a6a3a');
    for (const s of [-1, 1]) S.box(0.06, 0.4, 0.06, au, y + 5.1, s * 4.2, '#2a2a2c');
    faces.forEach((T, i) => { const m = T.mesh(); m.rotation.y = (i ? -1 : 1) * Math.PI / 2; m.position.set(au, yc, 0); m.userData.sign = o.name; g.add(m); }); }
  // будка кассира у въезда (со стороны, противоположной стоянке)
  { const bu = o.booth ? o.booth[0] : ru - 2.5, bv = o.booth ? o.booth[1] : -ls * 8.6, y = G(bu, bv);
    S.box(2.8, 0.25, 2.8, bu, y + 0.12, -bv, '#b9b4a8'); S.box(2.4, 2.3, 2.4, bu, y + 1.35, -bv, '#e8dcc0'); S.box(1.3, 0.8, 0.08, bu, y + 1.6, -bv + Math.sign(bv) * 1.22, '#1c2a36'); S.box(1.6, 0.1, 0.5, bu, y + 1.15, -bv + Math.sign(bv) * 1.4, '#8a6a3a');
    S.hip(bu, -bv, 1.9, 1.9, y + 2.5, 0.3, 0.3, y + 3.4, (i) => i % 2 ? '#b3573d' : '#a04a30'); wallBox(g, bu, bv, 2.4, 2.4); }
  // скамьи вдоль дорожки, урны, фонари — отдельные разрушаемые предметы
  for (const [u, v] of o.benches || [[o.pool + 5, -3.4], [o.pool + 10, 3.4]]) templeProp(g, u, v, (F) => {
    const y = G(u, v); F.box(1.9, 0.08, 0.5, 0, y + 0.48, 0, '#8a6a3a'); F.box(1.9, 0.4, 0.08, 0, y + 0.8, Math.sign(v) * -0.24, '#8a6a3a'); for (const dx of [-0.8, 0.8]) F.box(0.1, 0.48, 0.46, dx, y + 0.24, 0, '#4a4a4c');
  }, { kind: 'small', mat: 'wood', color: '#8a6a3a', r: 0.9, loss: 0.03 });
  for (const [u, v] of [[ua - 9.5, 4.2], [ub + 1.5, ls * 9]]) templeProp(g, u, v, (F) => { const y = G(u, v); F.tube(0, y, y + 0.9, 0, 0.32, 0.36, '#2f5f9a', 8); F.tube(0, y + 0.9, y + 0.96, 0, 0.38, 0.38, '#1c1c1e', 8); }, { kind: 'small', color: '#2f5f9a', r: 0.4, loss: 0.03 });
  for (const [u, v] of [[ua - 1, ls * 11.8], [ub + 1, ls * 11.8], [o.pool + 3, 4.6], [ua - 6, -ls * 9.5]]) templeProp(g, u, v, (F) => {
    const y = G(u, v); F.tube(0, y, y + 4.3, 0, 0.12, 0.09, '#5a4632', 6); F.box(0.5, 0.12, 0.5, 0, y + 4.36, 0, '#3a3a3c'); F.box(0.34, 0.4, 0.34, 0, y + 4.08, 0, '#fff0b8'); F.hip(0, 0, 0.42, 0.42, y + 4.42, 0.05, 0.05, y + 4.75, '#3a3a3c');
  }, { mat: 'wood', color: '#5a4632', r: 0.2 });
  // машины на стоянке (vehicles.js): [номер кармана, машина]; носом к проезду
  for (const [bay, V] of o.cars || [[1, pickupGeo('songthaew', '#b8302a')]]) { const u = ua + 2.5 + 3 * bay; parkVehicle(g, V, u, ls * 7.9, ls > 0 ? 'v-' : 'v+', G(u, ls * 7.9) + 0.07); }
  { const nb = Math.floor((ub - ua) / 3); scooterRow(g, o.name.length, 2 + o.name.length % 3, ua + 3 * (nb - 1) + 1.3, ls * 6.6, 0.85, 0, -ls * Math.PI / 2, G(ua + 3 * (nb - 1) + 2, ls * 6.6) + 0.07); }   // скутеры — в последнем кармане
  // зелень по краям двора
  for (const [u, v, k] of [[ua - 2.5, ls * 12.6, 'bush'], [ub + 2.5, ls * 12.4, 'bush'], [(ua + ub) / 2, ls * 13, 'clump'], [o.pool + 2, -6.5, 'fern'], [o.pool + 8, 6.4, 'bush'], [ru + 6, -ls * 10, 'fan'], [ru + 7, ls * 11, 'areca']])
    { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); if (roadDist(w.x, w.z) > halfS + 1.5) VEG_EXTRA.push([w.x, w.z, k]); }
}
// валуны: приплюснутые глыбы; большие — твёрдые
function boulder(S, g, u, v, y, r, color, squash = 0.7) {
  const w = g.localToWorld(new THREE.Vector3(u, 0, -v));
  y = groundY(w.x, w.z) - r * 0.15;                                 // всегда на земле, чуть утоплен — не висит и не торчит на ножке
  S.blob(u, y + r * squash * 0.55, -v, r, r * squash, r * (0.8 + hash2(u, v) * 0.3), color, 7, 5);
  if (r > 1.4) wallBox(g, u, v, r * 1.5, r * 1.4);
}
// торговый лоток под тентом (у входа на водопад): стол с фруктами
function fruitStall(S, u, v, y, tent) {
  for (const [du, dv] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) S.box(0.07, 2.3, 0.07, u + du, y + 1.15, -(v + dv), '#8a8e94');
  S.hip(u, -v, 1.9, 1.5, y + 2.2, 0.2, 0.15, y + 2.9, (i) => i % 2 ? tent : '#f2f2ee');
  S.box(2.4, 0.08, 1.2, u, y + 0.85, -v, '#c9b48a'); for (const du of [-1.1, 1.1]) S.box(0.08, 0.85, 1.1, u + du, y + 0.42, -v, '#8a7250');
  S.box(2.42, 0.5, 0.04, u, y + 0.62, -(v - 0.61), '#3a8a5a');
  const F = ['#f2c81e', '#5a2a5a', '#e8782a', '#7fae3a', '#d84a3a', '#e8d8a0'];
  for (let i = 0; i < 6; i++) S.box(0.32, 0.22 + (i % 3) * 0.08, 0.4, u - 0.95 + i * 0.38, y + 1.0, -(v + (i % 2 ? 0.25 : -0.2)), F[i]);
}
// щит с названием у конца дороги
function spotSign(S, u, v, y, text, face = 1) {                                // (над английской надписью — тайская, если есть)
  const T = sculptor(), th = signLines(T, text, 3.0, '#f4e8c8'), bh = Math.max(0.9, th + 0.36), yc = y + 1.85 + bh / 2;
  for (const dv of [-1.5, 1.5]) S.box(0.1, yc - y + bh / 2 - 0.15, 0.1, u, y + (yc - y + bh / 2 - 0.15) / 2, -(v + dv), '#6a5a48');
  S.box(0.1, bh, 3.4, u, yc, -v, '#6b4a2a');
  const m = T.mesh(); m.rotation.y = face * Math.PI / 2; m.position.set(u, yc, -v); m.userData.sign = text;
  return m;
}

// ---------- На Муанг 1: одна стена 19 м, веер струй, большая зелёная чаша, пальмы на гребне ----------
function buildNamuang1() {
  fallMaterials();
  const g = spotGroup('namuang_1'), sp = g.userData.spot, L = sp.y, S = sculptor(), Wb = waterBuf();
  const fanC = 2, wet = (a, t) => Math.max(1 - Math.abs(a - fanC) / (2.5 + (1 - t) * 6), 1 - Math.abs(a + 9) / 1.6);
  const surf = rockFace(S, { g, u0: -1.5, y0: L - 1.4, H: 20.6, run: 9.5, half: 14, wing: 10, back: 9, seed: 11, wet, moss: '#496645',
    pal: ['#c8bdb5', '#aca098', '#b8aaa0', '#877d78', '#9a8c84'], wetPal: ['#2e3c44', '#1c1a1b', '#3a3634', '#784d24', '#75533f'] });
  for (let k = 0; k < 8; k++) {                                     // веер: узкий у кромки, широкий у воды
    const b = -5 + k * 13 / 7, tp = fanC - 1.5 + k * 3 / 7;
    fallStrand(Wb, surf, [0, 0.12, 0.3, 0.5, 0.7, 0.86, 1].map((t, i) => [b + (tp - b) * t + Math.sin(i * 1.7 + k) * 0.35, t]), 1.5, 0.9);
  }
  fallStrand(Wb, surf, [0, 0.2, 0.45, 0.72].map((t, i) => [-9 + Math.sin(i * 2) * 0.4, t]), 0.9, 0.6);   // тонкая боковая струя слева
  for (let k = 0; k < 3; k++) fallStrand(Wb, (a, t) => [surf(a, 1)[0] - t * 6, surf(a, 1)[1] + 0.6, surf(a, 1)[2]], [[fanC - 1.2 + k * 1.2, 0], [fanC - 1.2 + k * 1.2, 1]], 1.1, 1.1, 0.5, 0);   // ручей на гребне, к кромке
  { const w = g.localToWorld(new THREE.Vector3(2, 0, 0)); fallSounds.push({ id: 'namuang_1', x: w.x, z: w.z, kind: 'big' }); }
  const WL = fallStream(g, 'namuang_1', { out: [16.3, -7.8], side: -1, inner: 12.6, outer: 21, width: 2.6 });   // уровень чаши — по ручью, который из неё вытекает
  fallPool(g, 9, 0, 10, 11.5, WL);
  poolRim(S, g, 9, 0, 10, 11.5, ['#ccd2bf', '#bdc1ab', '#aeb39c']);
  // валуны: светлые по берегу чаши, тёмные глыбы ниже по руслу; светлый блок на гребне слева
  const rb = seededRandom(5);
  for (let i = 0; i < 16; i++) { const a = -1.1 + i * 0.16 + rb() * 0.1, r = 0.7 + rb() * 1.1; if (Math.abs(a) < 0.34) continue; boulder(S, g, 10 + Math.cos(a) * (11 + rb() * 2.5), Math.sin(a) * (12.5 + rb() * 2), L - 0.2, r, rb() < 0.5 ? '#ccd2bf' : '#bdc1ab'); }
  for (const [u, v, r] of [[23, -13, 2.3], [27, -9.5, 1.8], [20, 13.5, 2.1], [3, -13.5, 2.4], [2, 13, 1.9]]) boulder(S, g, u, v, L - 0.3, r, '#6e6a68', 0.75);
  { const gy = (u, v) => { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); return groundY(w.x, w.z); };
    S.box(5.5, 4.4, 3.4, -13, gy(-13, 10.5) + 1.6, -10.5, '#d8d2c8', 0.12, 0.3); S.box(3, 3.0, 2.6, -11.5, gy(-11.5, 7) + 1.0, -7, '#c8c0b6', -0.1, 0.8); }
  // двор: поляна с проездом и стоянкой, лотки с фруктами, домик духов; ручей уходит по другому краю, мимо стоянки
  fallYard(g, S, L, { u0: 20, u1: 60, hv: 15, lot: [36, 54], lotSide: -1, pool: 19.5, stream: -1, inner: 12.6, name: 'NA MUANG 1', booth: [44, 11.5], arch: 14,
    cars: [[1, pickupGeo('songthaew', '#b8302a')], [3, bakedCarGeo('beetle', '#e8782a')], [4, parkedCar(0)]] });           // маршрутка и оранжевый жук
  [[24, '#c8402c'], [28.5, '#2f5f9a'], [33, '#e8c82a']].forEach(([u, c]) => { fruitStall(S, u, 12.6, spotGround(g, u, 12.6), c); wallBox(g, u, 12.6, 2.4, 1.2); });
  spiritHouse(S, 22.5, -9.5, spotGround(g, 22.5, 9.5), true);
  g.add(S.mesh(), meshFrom(Wb.pos, Wb.uv, Wb.idx, FALL_MAT));
  for (const a of [-4, 0, 4, 8]) { const p = g.localToWorld(new THREE.Vector3(surf(a, 0)[0] + 1, 0, surf(a, 0)[2])); fallSprays.push([p.x, WL, p.z, 3.5]); }
  // стены: к подножию скалы не проехать сквозь камень; крылья уходят в склон
  wallLine(g, -0.5, -15, -0.5, 15); wallLine(g, -0.5, -15, -9, -24); wallLine(g, -0.5, 15, -9, 24);
  // гребень: кокосовые пальмы и панданусы над кромкой
  for (const [u, v, k] of [[-17, -11, 'coconut'], [-19, -4, 'coconut'], [-16, 3, 'coconut'], [-20, 9, 'coconut'], [-24, -8, 'coconut'], [-23, 4, 'coconut'], [-18, 15, 'coconut'], [-15, -16, 'fan'], [-21, 13, 'fan'], [-26, 0, 'areca']]) { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); VEG_EXTRA.push([w.x, w.z, k]); }
  const c = g.localToWorld(new THREE.Vector3(22, 0, 0));
  vegKeepOut.push(Object.assign((x, z) => { const q = g.worldToLocal(new THREE.Vector3(x, 0, z)); return q.x > -30 && q.x < 64 && Math.abs(q.z) < 27; }, { c: [c.x, c.z, 62] }));
  spotPlace('ВОДОПАД НА МУАНГ 1', g, 46, 0, -1, 0);
}

// ---------- На Муанг 2: каскад — чаша, пологая «горка» (по ней можно въехать), крутая ступень в две струи, верхний слив ----------
function buildNamuang2() {
  fallMaterials();
  const g = spotGroup('namuang_2'), sp = g.userData.spot, L = sp.y, S = sculptor(), Wb = waterBuf();
  const DRY = ['#aa998c', '#917e76', '#9c8a80', '#b4a498'], WET = ['#4b4f4c', '#585e5d', '#544f54', '#72656b'];
  // горка: широкая выпуклая плита, вода расходится по ней рукавами
  const slide = rockFace(S, { g, u0: -1, y0: L - 1.3, H: 10.5, run: 37, half: 11, wing: 7, back: 5, seed: 23, bulge: 0.5, rough: 0.3, lin: true, na: 14, nt: 12, pal: DRY, wetPal: WET,
    wet: (a, t) => 0.9 - Math.min(Math.abs(a + 5 - t * 3), Math.abs(a - 1), Math.abs(a - 6 + t * 2)) / 2.2 });
  for (const [a0, a1] of [[-5, -2], [1, 1], [6, 4], [-1.5, -0.5]]) fallStrand(Wb, slide, [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].map((t, i) => [a0 + (a1 - a0) * t + Math.sin(i * 1.3 + a0) * 0.7, t]), 2.2, 1.4, 0.55, 0.18);
  // крутая ступень: округлая глыба наверху, вода обтекает её двумя струями; между струями — замшелая глыба
  const step = rockFace(S, { g, u0: -40.5, y0: L + 8.6, H: 16.3, run: 7.5, half: 7, wing: 9, back: 12, seed: 37, pal: ['#72656b', '#77635f', '#585e5d', '#6a6468'], wetPal: WET, moss: '#3e5e1d',
    wet: (a, t) => 1 - Math.min(Math.abs(a + 2.6), Math.abs(a - 2.8)) / 1.8 });
  fallStrand(Wb, step, [0, 0.15, 0.32, 0.5, 0.68, 0.85, 1].map((t, i) => [-2.6 - Math.sin(t * 3) * 0.8, t]), 2.4, 1.3);
  fallStrand(Wb, step, [0, 0.15, 0.32, 0.5, 0.68, 0.85, 1].map((t, i) => [2.8 + Math.sin(t * 3 + 1) * 0.7, t]), 2.0, 1.2);
  S.blob(-43.5, L + 15.1, 0, 2.3, 2.0, 2.4, '#315312', 7, 5); S.blob(-47.8, L + 25.0, 0.2, 2.0, 1.5, 2.2, '#585e5d', 7, 5);
  // полка над ступенью и верхний слив
  const top = rockFace(S, { g, u0: -74, y0: L + 25, H: 14.4, run: 10, half: 7, wing: 9, back: 9, seed: 51, pal: DRY, wetPal: WET, moss: '#3e5e1d', wet: (a, t) => 1 - Math.abs(a) / (1.5 + (1 - t) * 3) });
  for (let k = 0; k < 4; k++) fallStrand(Wb, top, [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => [(-3 + k * 2) * (1 - t * 0.6), t]), 1.5, 0.9);
  for (const [u0, u1, y, a] of [[-74, -47, L + 25.6, 0], [-40.3, -37, L + 9.55, 0]]) {      // ручей по полкам между уступами
    const b = Wb.pos.length / 3; Wb.pos.push(u0, y, 2.2 + a, u0, y, -2.2 + a, u1, y, 2.6 + a, u1, y, -2.6 + a); Wb.uv.push(0, (u1 - u0) / 4, 0.55, (u1 - u0) / 4, 0, 0, 0.55, 0); Wb.idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  S.quad([-73.5, L + 25.06, 11], [-60, L + 25.06, 11], [-60, L + 25.06, -11], [-73.5, L + 25.06, -11], '#917e76');   // плита полки — там, где под ней ровный уступ
  // Ручей уходит слева от дороги (если ехать к водопаду), спускается вдоль неё к На Муанг 1 и там по краю двора впадает
  // в его чашу — дальше обе воды текут одним руслом. У чаши ровное дно лощины узкое: русло жмётся к оси.
  const inner = (u) => u < 28 ? 8.2 : u < 39 ? 7.0 : 11.8;
  const N1 = IS.spots.namuang_1, c1 = Math.cos(N1.az), s1 = Math.sin(N1.az), J = (u, v) => [N1.x + c1 * u + s1 * v, N1.z + s1 * u - c1 * v];   // точка в осях На Муанг 1
  { const w = g.localToWorld(new THREE.Vector3(-8, 0, 0)); fallSounds.push({ id: 'namuang_2', x: w.x, z: w.z, kind: 'big' }); }
  const WL = fallStream(g, 'namuang_2', { out: [11.5, -5.4], side: -1, inner, outer: 19, width: 2.2, maxLen: 300,
    tail: N1 ? [J(46, 22), J(36, 17.6), J(25, 17.4), J(17, 14.2), J(13.2, 10.6)] : null });
  fallPool(g, 7, 0, 6.5, 7.5, WL);
  poolRim(S, g, 7, 0, 6.5, 7.5, ['#c4b8ac', '#aa998c', '#b4a498']);
  S.box(3.6, 1.0, 1.9, 8, L + 0.2, 4.6, '#b4a498', 0, 0.5);                                // плоский валун в чаше
  const rb = seededRandom(9);
  for (let i = 0; i < 11; i++) { const a = -1.2 + i * 0.24, r = 0.8 + rb() * 1.0; if (Math.abs(a) < 0.5) continue; boulder(S, g, 8 + Math.cos(a) * (7.5 + rb() * 2), Math.sin(a) * (8.5 + rb() * 2), L - 0.2, r, rb() < 0.5 ? '#c4b8ac' : '#aa998c'); }
  for (const [u, v, r] of [[-78, 6, 1.6], [-82, -5, 1.3], [-90, 2, 1.8]]) boulder(S, g, u, v, L + 39, r, '#aa998c');
  // двор: поляна с проездом и стоянкой, лоток; ручей уходит по другому краю
  fallYard(g, S, L, { u0: 16, u1: 52, hv: 13, lot: [36, 48], lotSide: 1, pool: 14.5, stream: -1, inner, name: 'NA MUANG 2', cars: [[2, pickupGeo('coconuts', '#2f5f9a')], [0, parkedCar(3)]] });
  fruitStall(S, 27.5, 10.6, spotGround(g, 27.5, 10.6), '#2f7a4a'); wallBox(g, 27.5, 10.6, 2.4, 1.2);
  g.add(S.mesh(), meshFrom(Wb.pos, Wb.uv, Wb.idx, FALL_MAT));
  for (const [su, sy, sv, w] of [[1, WL, 0, 5], [-40, L + 9.3, 2.6, 2.5], [-40, L + 9.3, -2.8, 2.5], [-73, L + 25.2, 0, 3.5]]) { const p = g.localToWorld(new THREE.Vector3(su, 0, -sv)); fallSprays.push([p.x, sy, p.z, w]); }
  // по горке можно въехать до подножия крутой ступени
  spotPlate(g, -37.6, -0.6, 0, 9.5, L + 9.36, L - 1.14, true);                       // плита лежит на камне горки: от дна чаши до полки
  spotPlate(g, -40.5, -37.6, 0, 9.5, L + 9.36);
  wallLine(g, -40.3, -14, -40.3, 14);
  for (const [u, v, k] of [[-46, -10, 'fan'], [-49, -12.5, 'fan'], [-44, 11, 'coconut'], [-30, 14.5, 'coconut'], [-18, 15, 'areca'], [-52, 13, 'coconut'], [-84, -11, 'fan'], [-88, 12, 'coconut']]) { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); VEG_EXTRA.push([w.x, w.z, k]); }
  const c = g.localToWorld(new THREE.Vector3(-30, 0, 0));
  vegKeepOut.push(Object.assign((x, z) => { const q = g.worldToLocal(new THREE.Vector3(x, 0, z)); return q.x > -100 && q.x < 56 && Math.abs(q.z) < 21; }, { c: [c.x, c.z, 95] }));
  spotPlace('ВОДОПАД НА МУАНГ 2', g, 40, 0, -1, 0);
}

// ---------- Хин Лад: ручей среди огромных валунов — наклонный слив у круглой глыбы, плита-горка выше; у входа храм и Будда под нагой ----------
function buildHinLad() {
  fallMaterials();
  const g = spotGroup('hin_lad'), sp = g.userData.spot, L = sp.y, S = sculptor(), Wb = waterBuf();
  const DRY = ['#d0d2c6', '#acaca6', '#bfb29b', '#a8a49b'], WET = ['#303231', '#3f3e3a', '#4a4844', '#5d4319'];
  const chute = rockFace(S, { g, u0: -1.5, y0: L - 1.3, H: 8.3, run: 7.5, half: 9, wing: 10, back: 9, seed: 61, pal: DRY, wetPal: WET, moss: '#459f1d', wet: (a, t) => 1 - Math.abs(a + 1.5) / 2.2 });
  fallStrand(Wb, chute, [0, 0.14, 0.3, 0.48, 0.66, 0.84, 1].map((t) => [-1.5 + Math.sin(t * 4) * 0.5, t]), 2.6, 1.8);
  // высокая светлая скала слева от слива
  for (const [u, y, v, rx, ry, rz, c] of [[-7.5, 5, 11, 4.2, 6.2, 4.6, '#d0d2c6'], [-5.5, 9.5, 12.5, 3.2, 4.2, 3.4, '#c4c6ba'], [-9, 3, 15, 3.6, 4, 3.4, '#acaca6'], [-4.5, 13.2, 11, 2.6, 1.3, 2.8, '#459f1d'], [-10, 9.6, 14, 2.2, 1.0, 2.4, '#338710']]) { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); S.blob(u, Math.min(L + y, groundY(w.x, w.z) + y * 0.85), -v, rx, ry, rz, c, 7, 5); }
  // плита-горка выше по ручью
  const slab = rockFace(S, { g, u0: -27, y0: L + 7.0, H: 7.8, run: 14, half: 7, wing: 8, back: 8, seed: 73, bulge: 0.4, rough: 0.4, nt: 8, pal: DRY, wetPal: WET, moss: '#338710', wet: (a, t) => 0.9 - Math.abs(a - 1 + t) / 2.6 });
  fallStrand(Wb, slab, [0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => [1 - t + Math.sin(i) * 0.5, t]), 3.2, 2.0, 0.6, 0.18);
  { const b = Wb.pos.length / 3, y = L + 7.7; Wb.pos.push(-27, y, 2.2, -27, y, -0.4, -8.6, y, 3.0, -8.6, y, 0.2); Wb.uv.push(0, 4, 0.4, 4, 0, 0, 0.4, 0); Wb.idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }   // ручей по полке к сливу
  S.quad([-26.5, L + 7.26, 11], [-15, L + 7.26, 11], [-15, L + 7.26, -11], [-26.5, L + 7.26, -11], '#a8a49b');   // плита полки — на ровном уступе
  { const w = g.localToWorld(new THREE.Vector3(1, 0, 1.5)); fallSounds.push({ id: 'hin_lad', x: w.x, z: w.z, kind: 'small' }); }
  const WL = fallStream(g, 'hin_lad', { out: [11.9, -6.1], side: -1, inner: 19.4, outer: 26, width: 3 });
  fallPool(g, 7, 0, 7, 8.5, WL);
  poolRim(S, g, 7, 0, 7, 8.5, ['#bfb29b', '#d4c9b2', '#a8a49b']);
  // круглая глыба под сливом, плоская плита в воде, глыбы по берегам и у тропы
  S.blob(4.5, L + 1.2, 4.8, 2.0, 1.6, 1.95, '#3f3e3a', 8, 6); S.blob(4.5, L + 2.1, 4.8, 1.5, 0.8, 1.45, '#8e7d5c', 8, 4); wallBox(g, 4.5, -4.8, 3.4, 3.4);
  S.box(3.2, 0.9, 2.1, 10, L + 0.25, 2.5, '#acaca6', 0, 0.4);
  const rb = seededRandom(13);
  for (let i = 0; i < 12; i++) { const a = -1.3 + i * 0.24, r = 0.8 + rb() * 1.3; if (Math.abs(a) < 0.45) continue; boulder(S, g, 8 + Math.cos(a) * (8 + rb() * 2.5), Math.sin(a) * (9.5 + rb() * 2.5), L - 0.2, r, rb() < 0.4 ? '#bfb29b' : rb() < 0.6 ? '#d4c9b2' : '#78766a'); }
  for (const [u, v, r] of [[24, -18, 2.6], [29, -15.5, 2.0], [19, 19, 2.4], [-3, -17, 2.8], [-16, 9, 2.2], [-18, -8, 1.9]]) boulder(S, g, u, v, u < 0 ? L + 7.2 : L - 0.3, r, '#8a8a80', 0.85);
  // навес из жердей под пальмовым листом у воды
  for (const [du, dv] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) S.box(0.1, 2.3, 0.1, 21 + du, L + 1.15, -13 + dv, '#7a6248');
  S.gable(21, -13, 4.6, 1.9, L + 2.2, L + 3.0, '#9a8a5a', '#8a7a4e', 'x'); S.box(3.2, 0.08, 1.0, 21, L + 0.8, -13.6, '#96816c');
  // вход: храм Ват Хин Лад и белый Будда под семиглавой нагой на террасе с перилами
  const tu = 44, tv = 13.5;
  S.box(16.6, 0.5, 10.6, tu, L + 0.25, -tv, '#c9c5bb'); S.box(16, 3.6, 10, tu, L + 2.3, -tv, '#f0ead8');
  for (let i = 0; i < 5; i++) { S.box(1.5, 2.0, 0.08, tu - 6 + i * 3, L + 2.2, -tv + 5.02, '#5a3a22'); S.box(1.7, 0.1, 0.1, tu - 6 + i * 3, L + 3.3, -tv + 5.04, '#d8b24a'); }
  S.gable(tu, -tv, 18, 6.4, L + 4.1, L + 6.6, '#b3573d', '#f0ead8', 'x'); S.gable(tu, -tv, 12, 4.4, L + 5.6, L + 7.9, '#bd5d41', '#d8b24a', 'x');
  for (const e of [-1, 1]) S.limb([tu + e * 9, L + 6.6, -tv], [tu + e * 9.6, L + 8.0, -tv], 0.14, 0.03, '#d8b24a', 5);
  wallBox(g, tu, tv, 16, 10);
  const bu = 38, bv = -14.5, B0 = L + 1.3, WH = '#f7f1e3', WS = '#d0c5b2';
  S.box(7, 0.5, 6, bu, L + 0.25, -bv, '#c9c5bb'); S.box(2.8, 0.8, 2.6, bu, L + 0.9, -bv, WS);
  for (let k = 0; k < 3; k++) S.blob(bu - 0.3, L + 1.5 + k * 0.42, -bv, 1.5 - k * 0.2, 0.26, 1.4 - k * 0.18, k % 2 ? WS : WH, 10, 3);   // кольца наги — сиденье
  const Y0 = L + 2.55;
  S.blob(bu + 0.15, Y0 + 0.35, -bv, 0.95, 0.38, 1.25, WH, 10, 4); S.lathe([[0.62, Y0 + 0.5], [0.55, Y0 + 1.1], [0.62, Y0 + 1.6], [0.3, Y0 + 1.85]], bu - 0.1, -bv, WH, 9, 0.75, 1);
  S.blob(bu - 0.05, Y0 + 2.15, -bv, 0.3, 0.36, 0.29, WH, 8, 5); S.tube(bu - 0.08, Y0 + 2.45, Y0 + 2.8, -bv, 0.12, 0.01, WH, 5);
  for (const s of [-1, 1]) S.limb([bu - 0.1, Y0 + 1.5, -bv + s * 0.72], [bu + 0.45, Y0 + 0.6, -bv + s * 0.5], 0.17, 0.13, WH, 5);
  for (let k = -3; k <= 3; k++) {                                   // капюшон наги: семь голов веером над Буддой
    const h = 3.75 - Math.abs(k) * 0.3, z = -bv + k * 0.5, lean = Math.abs(k) * 0.16;
    S.limb([bu - 0.75, Y0 + 0.4, -bv + k * 0.22], [bu - 0.7, Y0 + h - 0.7, z], 0.26, 0.22, k % 2 ? WS : WH, 6);
    S.limb([bu - 0.7, Y0 + h - 0.7, z], [bu - 0.1, Y0 + h, z + Math.sign(k) * lean], 0.3, 0.16, WH, 6); S.tube(bu - 0.1, Y0 + h, Y0 + h + 0.45, z + Math.sign(k) * lean, 0.1, 0.01, WH, 4);
  }
  for (const [x0, z0, x1, z1] of [[bu - 3.4, -bv - 2.9, bu + 3.4, -bv - 2.9], [bu - 3.4, -bv + 2.9, bu + 3.4, -bv + 2.9], [bu - 3.4, -bv - 2.9, bu - 3.4, -bv + 2.9]]) {   // перила из нержавейки
    S.rod([x0, L + 1.45, z0], [x1, L + 1.45, z1], 0.07, '#d8dce0'); S.rod([x0, L + 0.95, z0], [x1, L + 0.95, z1], 0.05, '#c8ccd0');
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.7); for (let i = 0; i <= n; i++) S.box(0.07, 0.95, 0.07, x0 + (x1 - x0) * i / n, L + 0.97, z0 + (z1 - z0) * i / n, '#d8dce0');
  }
  wallBox(g, bu - 0.3, bv, 3.0, 2.8);
  // двор: поляна с проездом и стоянкой; ручей уходит по дальнему от храма краю, за террасой Будды
  fallYard(g, S, L, { u0: 17, u1: 66, hv: 19, lot: [50, 62], lotSide: -1, pool: 15.5, stream: -1, inner: 19.4, name: 'HIN LAD', benches: [[22, 3.6], [29, -3.6]], cars: [[0, pickupGeo('empty', '#c8ccd0')], [2, pickupGeo('boxes', '#e8e8e4')], [1, parkedCar(6)]] });
  g.add(S.mesh(), meshFrom(Wb.pos, Wb.uv, Wb.idx, FALL_MAT));
  for (const [su, sy, sv, w] of [[0.5, WL, -1.5, 3.5], [-26.5, L + 7.4, 1, 3]]) { const p = g.localToWorld(new THREE.Vector3(su, 0, -sv)); fallSprays.push([p.x, sy, p.z, w]); }
  wallLine(g, -0.5, -11, -0.5, 11); wallLine(g, -0.5, -11, -8, -20); wallLine(g, -0.5, 11, -8, 20);
  for (const [u, v, k] of [[-14, 14, 'coconut'], [-20, -15, 'areca'], [-34, 12, 'fan'], [-6, 18, 'clump'], [14, -19, 'clump'], [30, 19, 'coconut'], [58, -17, 'coconut'], [60, 17, 'areca']]) { const w = g.localToWorld(new THREE.Vector3(u, 0, -v)); VEG_EXTRA.push([w.x, w.z, k]); }
  const c = g.localToWorld(new THREE.Vector3(12, 0, 0));
  vegKeepOut.push(Object.assign((x, z) => { const q = g.worldToLocal(new THREE.Vector3(x, 0, z)); return q.x > -48 && q.x < 70 && Math.abs(q.z) < 25; }, { c: [c.x, c.z, 75] }));
  spotPlace('ВОДОПАД ХИН ЛАД', g, 56, 0, -1, 0);
}

function buildLandmarks() {
  if (IS.spots && IS.spots.big_buddha) buildBigBuddha();
  if (airportGroup) buildAirportTerminal();
  if (IS.spots && IS.spots.cannabis_farm) buildCannabisFarm();
  if (IS.shops && IS.shops.length) buildShops();
  if (IS.spots && IS.spots.namuang_1) buildNamuang1();
  if (IS.spots && IS.spots.namuang_2) buildNamuang2();
  if (IS.spots && IS.spots.hin_lad) buildHinLad();
}
