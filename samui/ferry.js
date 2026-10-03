// Паром Самуи — Панган (refs/ferry_samui_phangan; задача Влада через ресерч-сессию): скоростной катамаран Lomprayah ходит
// от пирса Маенам (Lomprayah / Пралан) на север, к Тхонг Сала на Пангане (за горизонтом).
// Расписание — по игровым часам (сутки = DAY_LEN с): цикл 2 игровых часа — 30 минут у пирса (решение Влада), затем
// 90 минут в отлучке (≈ 30 минут туда, стоянка на Пангане, ≈ 30 минут обратно).
// Движение — настоящее по скорости и ускорениям (Влад: разгон, остановка, маршрут и особенно парковка — реалистичные):
//   у пирса — стоит бортом к пирсу, носом к берегу, чуть покачивается;
//   отход — отжимается от пирса на метр, задним ходом малым ходом выходит за торец пирса, разворачивается на месте
//     носом на север и плавно разгоняется до крейсерских ≈ 20 м/с (≈ 39 узлов), уходит в дымку;
//   возвращение — выходит из дымки с севера, заранее начинает тормозить, по дуге выходит на линию пирса, медленно
//     подходит вдоль него и без рывка прижимается бортом.
// Видимые части пути заранее просчитаны по шагам (FERRY.out, FERRY.in); положение берётся по времени цикла — при
// перемотке часов паром не дёргается. В отлучке между ними паром спрятан (он «на Пангане»).
// Модель: пока — катамаран из boats.js; когда сессия транспорта сделает Lomprayah, ставится FERRY_MODEL = её функция
// (нос модели — по +X; если по −X — model.userData.bow = −1).

const FERRY = {
  pier: 'maenam', pierLen: 43, pierHalf: 2,            // пирс Маенам из piers.js: длина настила и полуширина
  bowMin: 26,                                           // м от берега: ближе нос не встаёт (дальше 19 м — уже вода, у пирса мелко)
  cycle: 120, dock: 30,                                 // игровые минуты: весь цикл и стоянка у пирса
  cruise: 20, acc: 0.6, dec: 0.45,                      // м/с, м/с²: крейсерская, разгон, торможение
  far: 550,                                             // м — куда (на север) паром уходит в дымку
  ship: null, out: null, in: null, wake: null,
};
// модель — катамаран Lomprayah от сессии транспорта (lomprayah.js, копия car_look/lomprayah_catamaran: 30 × 9 м, нос +X);
// без файла — старый маленький катамаран из boats.js
let FERRY_MODEL = typeof boatLomprayah === 'function' ? () => boatLomprayah({ L: 30, B: 9 }) : null;

// шаги движения: [x, z, курс носа (рад, 0 — +X мира, по часовой к +Z), скорость]
function ferrySampler(dt) {
  const S = [];
  return {
    S,
    push(x, z, h, v) { S.push([x, z, h, v]); },
    // ход по ломаной P (точки мира) от скорости v0 до v1, не быстрее vmax, ускорения acc / dec; back — кормой вперёд
    along(P, v0, v1, vmax, acc, dec, back = false) {
      const seg = []; let L = 0; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(l); L += l; }
      let s = 0, v = v0;
      const at = (s) => { let i = 0, a = s; while (i < seg.length - 1 && a > seg[i]) { a -= seg[i]; i++; } const t = Math.min(1, a / (seg[i] || 1)), p = P[i], q = P[i + 1];
        return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, Math.atan2(q[1] - p[1], q[0] - p[0])]; };
      while (s < L - 1e-3) {
        const left = L - s, need = (v * v - v1 * v1) / (2 * dec);                                    // пора тормозить?
        v = left <= need ? Math.max(v1, v - dec * dt) : Math.min(vmax, v + acc * dt);
        v = Math.max(v, 0.05); s = Math.min(L, s + v * dt);
        const [x, z, h] = at(s); S.push([x, z, back ? h + Math.PI : h, back ? -v : v]);
      }
    },
    // разворот на месте от курса h0 к h1 (кратчайшим путём), с плавным началом и концом
    turn(x, z, h0, h1, rate) {
      let d = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)); const T = Math.abs(d) / rate;
      for (let t = 0; t < T; t += dt) { const k = t / T, e = k * k * (3 - 2 * k); S.push([x, z, h0 + d * e, 0]); }
    },
    // боковой сдвиг на месте (отжаться от пирса / прижаться к нему) за время T
    slide(a, b, h, T) { for (let t = 0; t < T; t += dt) { const k = t / T, e = k * k * (3 - 2 * k); S.push([a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, h, 0]); } },
    // курс по ломаной меняется скачками на её стыках — сглаживается окном в 1 с (корпус поворачивает плавно)
    smoothHeading(win = 10) {
      const H = [S[0][2]]; for (let i = 1; i < S.length; i++) H.push(H[i - 1] + Math.atan2(Math.sin(S[i][2] - H[i - 1]), Math.cos(S[i][2] - H[i - 1])));
      for (let i = 0; i < S.length; i++) { let sum = 0, n = 0; for (let j = Math.max(0, i - win); j <= Math.min(S.length - 1, i + win); j++) { sum += H[j]; n++; } S[i][2] = sum / n; }
    },
  };
}
function buildFerry() {
  const P = IS.piers && IS.piers[FERRY.pier]; if (!P) return;
  const ship = FERRY_MODEL ? FERRY_MODEL() : boatCatamaran(), bow = ship.userData.bow || 1;
  const bb = new THREE.Box3().setFromObject(ship), Lb = bb.max.x - bb.min.x, Bb = bb.max.z - bb.min.z;
  scene.add(ship); FERRY.ship = ship; FERRY.bow = bow;
  // оси пирса: u — от берега в море, v — влево (как в piers.js)
  const a = [Math.cos(P.az), Math.sin(P.az)], n = [Math.sin(P.az), -Math.cos(P.az)];
  const W = (u, v) => [P.x + a[0] * u + n[0] * v, P.z + a[1] * u + n[1] * v];
  const shore = Math.atan2(-a[1], -a[0]), north = 0;                                               // нос к берегу; курс на Панган — на север (+X)
  const uB = Math.max(FERRY.pierLen - Lb / 2 + 8, FERRY.bowMin + Lb / 2), vB = -(FERRY.pierHalf + 0.5 + Bb / 2);                     // у правого борта пирса, корма чуть за торцом
  const B = W(uB, vB), B1 = W(uB, vB - 1.2), R = W(FERRY.pierLen + Lb / 2 + 22, vB - 1.2);          // у пирса; отжался; вышел за торец
  FERRY.berth = [B[0], B[1], shore];
  const dt = 0.05;
  // туда: отжаться, задним ходом за торец, разворот на север, разгон и уход в дымку
  { const T = ferrySampler(dt);
    T.slide(B, B1, shore, 6);
    T.along([B1, R], 0, 0, 1.8, 0.15, 0.15, true);
    T.turn(R[0], R[1], shore, north, 0.12);
    T.along([R, [R[0] + FERRY.far, R[1]]], 0, FERRY.cruise, FERRY.cruise, FERRY.acc, FERRY.dec);
    T.smoothHeading(); FERRY.out = T.S; }
  // обратно: из дымки с севера, торможение заранее, дуга на линию пирса, медленно вдоль пирса, прижаться бортом
  { const T = ferrySampler(dt), A = W(FERRY.pierLen + Lb / 2 + 40, vB - 1.2), V = [R[0] + FERRY.far, R[1]];
    const C1 = [V[0] - (V[0] - A[0]) * 0.55, V[1]], C2 = [A[0] + a[0] * 120, A[1] + a[1] * 120], arc = [];
    for (let k = 0; k <= 40; k++) { const t = k / 40, m = 1 - t; arc.push([m * m * m * V[0] + 3 * m * m * t * C1[0] + 3 * m * t * t * C2[0] + t * t * t * A[0], m * m * m * V[1] + 3 * m * m * t * C1[1] + 3 * m * t * t * C2[1] + t * t * t * A[1]]); }
    T.along(arc, FERRY.cruise, 2.0, FERRY.cruise, FERRY.acc, FERRY.dec);
    T.along([A, B1], 2.0, 0, 2.0, 0.05, 0.05);
    T.slide(B1, B, shore, 7);
    T.smoothHeading(); FERRY.in = T.S; }
  FERRY.dt = dt;
  // кильватер: две пенные полосы за кормой, видны на ходу
  { const mat = new THREE.MeshBasicMaterial({ color: 0xf4f8f8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), w = new THREE.Group();
    for (const s of [-1, 1]) { const m = new THREE.Mesh(geo, mat); m.position.set(-bow * (Lb / 2 + 12), 0.06, s * Bb * 0.32); m.scale.set(24, 1, 1.4); m.rotation.y = s * 0.05; w.add(m); }
    ship.add(w); FERRY.wake = { w, mat, Lb }; }
  airportAnim.push(updateFerry);
  const away = FERRY.cycle - FERRY.dock, win = away * DAY_LEN / 1440, tOut = FERRY.out.length * dt, tIn = FERRY.in.length * dt;
  FERRY.win = win; FERRY.tOut = tOut; FERRY.tIn = tIn;
  if (tOut + tIn > win) console.warn('паром: видимые части пути длиннее отлучки', tOut.toFixed(0), tIn.toFixed(0), win.toFixed(0));
}
// где паром сейчас: по игровым часам
function ferryState() {
  const F = FERRY, min = (dayTime * 60) % F.cycle;                                                    // минута цикла
  if (min < F.dock) return { x: F.berth[0], z: F.berth[1], h: F.berth[2], v: 0, docked: true };
  const t = (min - F.dock) * DAY_LEN / 1440;                                                          // с отлучки, настоящие секунды
  const pick = (S, t) => { const i = Math.min(S.length - 1, Math.max(0, t / F.dt)), i0 = Math.floor(i), i1 = Math.min(S.length - 1, i0 + 1), k = i - i0, p = S[i0], q = S[i1];
    const dh = Math.atan2(Math.sin(q[2] - p[2]), Math.cos(q[2] - p[2])); return { x: p[0] + (q[0] - p[0]) * k, z: p[1] + (q[1] - p[1]) * k, h: p[2] + dh * k, v: p[3] + (q[3] - p[3]) * k }; };
  if (t < F.tOut) return pick(F.out, t);
  if (t > F.win - F.tIn) return pick(F.in, t - (F.win - F.tIn));
  return null;                                                                                        // на Пангане
}
function updateFerry(now) {
  const F = FERRY, st = ferryState(), ship = F.ship;
  if (!st) { ship.visible = false; return; }
  ship.visible = true;
  const bob = Math.sin(now * 1.3) * 0.06 + Math.sin(now * 0.7 + 1) * 0.04, sp = Math.abs(st.v);
  ship.position.set(st.x, bob + Math.min(0.35, sp * 0.015), st.z);                                    // на ходу корпус приподнимается
  ship.rotation.set(0, -(st.h + (F.bow < 0 ? Math.PI : 0)), 0);
  ship.rotateZ(F.bow * (Math.min(0.05, sp * 0.0025) + Math.sin(now * 0.9) * 0.008));                    // нос чуть выше на скорости, лёгкая качка
  ship.rotateX(Math.sin(now * 1.1 + 2) * 0.012);
  const w = F.wake; w.mat.opacity = Math.min(0.55, Math.max(0, (sp - 2) / 14) * 0.55);
  for (const m of w.w.children) m.scale.x = 8 + sp * 1.4, m.position.x = -F.bow * (w.Lb / 2 + (8 + sp * 1.4) / 2);
}
