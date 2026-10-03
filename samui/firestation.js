// Пожарные станции Самуи — refs/fire_station. В OSM их две: в Чавенге и у Натона; фото самих зданий на Самуи нет,
// вид взят с типовых тайских станций: навес-гараж на три машины на столбах в красно-белую полоску, над въездом
// красный фриз с надписью, за гаражом трёхэтажное здание, сбоку каланча с красными поясами и флагом.
// У каждой станции стоят две пожарные машины (задание Влада): красная трёхосная автоцистерна — такая на Самуи
// на самом деле (фото 01, 02) — и жёлто-зелёная машина с отсеками за шторками и лестницей на крыше (фото 05).
// Машины твёрдые. Место станции у дороги подбирает сборщик острова (ISLAND.stations).
// Оси станции: u — от здания к дороге (локальный +X), v — влево (локальный −Z), y — от уровня площадки.
// Файл подключается после stores.js (берёт оттуда signText, signGeo, mergeGeo, LOT_Y) и только объявляет функции.

const FIRE = { W: 26, D: 20, PARK: 10 };               // фасад, глубина (гараж 10 + здание 10), площадка перед гаражом — как в сборщике
const fireBeacons = [];                                  // мигалки машин: [красная, синяя]
let fireParts = null;

// колесо: цилиндр с осью поперёк машины (вдоль Z), тёмная шина и светлый диск
function fireWheel(S, x, y, z, r, w, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283, b = (i + 1) / n * 6.283, P = (t, zz, k = 1) => [x + Math.cos(t) * r * k, y + Math.sin(t) * r * k, zz];
    S.quad(P(a, z - w / 2), P(b, z - w / 2), P(b, z + w / 2), P(a, z + w / 2), '#161618');
    for (const s of [-1, 1]) { S.tri([x, y, z + s * w / 2], P(a, z + s * w / 2), P(b, z + s * w / 2), '#1c1c1e'); S.tri([x, y, z + s * (w / 2 + 0.01)], P(a, z + s * (w / 2 + 0.01), 0.5), P(b, z + s * (w / 2 + 0.01), 0.5), '#b8b8b4'); }
  }
}
// цистерна: лежачий эллиптический цилиндр вдоль X
function fireTank(S, x0, x1, y, ry, rz, color, n = 12) {
  const P = (x, t, k = 1) => [x, y + Math.sin(t) * ry * k, Math.cos(t) * rz * k];
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283, b = (i + 1) / n * 6.283;
    S.quad(P(x0, a), P(x0, b), P(x1, b), P(x1, a), color);
    for (const [x, d] of [[x0, -0.25], [x1, 0.25]]) { S.quad(P(x, a), P(x, b), P(x + d, b, 0.8), P(x + d, a, 0.8), color); S.tri([x + d, y, 0], P(x + d, a, 0.8), P(x + d, b, 0.8), color); }
  }
}
// шторка отсека: серый ребристый щит на борту
function fireShutterBox(S, x, y, w, h, z) { S.box(w, h, 0.05, x, y, z, '#b4b8bc'); for (let k = 0.12; k < h; k += 0.18) S.box(w, 0.04, 0.07, x, y - h / 2 + k, z, '#8e9296'); S.box(w * 0.3, 0.05, 0.09, x, y - h / 2 + 0.1, z, '#2a2a2c'); }

// красная трёхосная автоцистерна Самуи: нос — к +X, длина ≈ 8.6 м
function fireTanker() {
  const S = sculptor(), R = '#c81e1e', RD = '#9c1616', L = sculptor();
  S.box(8.3, 0.28, 1.1, -0.1, 0.95, 0, '#232325');                                                 // рама
  for (const s of [-1, 1]) { vehWheel(S, 2.75, 0.56, s * 1.03, 0.56, 0.36, s, '#e8e8e4'); for (const x of [-1.75, -3.05]) vehWheel(S, x, 0.56, s * 0.9, 0.56, 0.62, s, '#e8e8e4'); }
  S.box(2.0, 2.0, 2.45, 3.15, 2.1, 0, R); S.box(2.04, 0.5, 2.5, 3.15, 1.3, 0, RD);                   // кабина
  S.box(0.06, 0.85, 2.05, 4.17, 2.45, 0, '#1c2a36'); S.box(1.0, 0.75, 2.49, 3.45, 2.5, 0, '#1c2a36'); S.box(0.08, 0.85, 0.08, 4.17, 2.45, 0, R);   // лобовое в две половины, боковые окна
  S.box(0.3, 0.38, 2.55, 4.25, 0.98, 0, '#e8e8e4'); S.box(0.06, 0.5, 1.5, 4.18, 1.55, 0, '#2a2a2c');   // бампер, решётка
  for (const s of [-1, 1]) { S.box(0.07, 0.24, 0.34, 4.19, 1.55, s * 0.98, '#f6f0c8'); S.box(0.1, 0.5, 0.3, 3.9, 2.75, s * 1.38, '#232325'); S.box(0.5, 0.06, 0.4, 2.4, 0.6, s * 1.1, '#3a3a3c'); }   // фары, зеркала, подножки
  S.box(0.5, 0.2, 1.5, 3.2, 3.2, 0, '#e8e8e4');                                                      // балка мигалок
  fireTank(S, -4.0, 1.95, 2.3, 0.98, 1.2, R);                                                       // цистерна
  S.box(6.0, 0.55, 2.42, -1.0, 1.32, 0, RD); for (const s of [-1, 1]) for (const x of [-3.3, -1.4, 0.6]) S.box(1.5, 0.4, 0.05, x, 1.32, s * 1.22, '#232325');   // рундуки под цистерной
  S.box(5.6, 0.07, 0.9, -1.0, 3.32, 0, '#8e9296'); for (const s of [-1, 1]) { S.box(5.6, 0.05, 0.05, -1.0, 3.75, s * 0.45, R); for (let x = -3.7; x <= 1.7; x += 0.9) S.box(0.05, 0.42, 0.05, x, 3.54, s * 0.45, R); }   // мостик с леерами
  S.tube(-0.4, 3.3, 3.55, 0, 0.3, 0.3, '#8e9296', 8);                                               // горловина
  for (const s of [-1, 1]) { S.box(0.05, 2.2, 0.05, -3.6, 2.4, s * 1.28, R); S.box(0.05, 2.2, 0.05, -3.2, 2.4, s * 1.28, R); for (let y = 1.5; y < 3.4; y += 0.32) S.box(0.42, 0.04, 0.05, -3.4, y, s * 1.28, R); }   // лестницы у кормы
  S.box(0.5, 1.3, 2.3, -4.3, 1.75, 0, '#b4b8bc'); for (const z of [-0.7, 0, 0.7]) S.tube(-4.58, 1.5, 1.8, z, 0.14, 0.14, '#2a2a2c', 6);   // насосный щит с вентилями
  for (const s of [-1, 1]) S.box(0.06, 0.2, 0.3, -4.56, 1.1, s * 1.0, '#e84a2a');
  // надписи белым по цистерне и дверям — с обоих бортов
  // надписи лежат на самой бочке (повторяют её изгиб), белая полоса — тоже
  const tankHalf = (x, y) => 1.2 * Math.sqrt(Math.max(0.05, 1 - ((y - 2.3) / 0.98) ** 2));
  for (const s of [-1, 1]) { L.text('SAMUI FIRE', -0.75, 2.78, tankHalf, 0.12, '#f6f6f0', s); L.text('199', 3.1, 1.95, s * 1.235, 0.07, '#f6f6f0', s);
    for (let x = -3.9; x < 1.9; x += 0.29) L.quad([x, 2.0, s * (tankHalf(0, 2.0) + 0.02)], [x + 0.29, 2.0, s * (tankHalf(0, 2.0) + 0.02)], [x + 0.29, 1.9, s * (tankHalf(0, 1.9) + 0.02)], [x, 1.9, s * (tankHalf(0, 1.9) + 0.02)], '#f6f6f0'); }
  return { body: S.mesh().geometry, lit: L.mesh().geometry, len: 8.7, wid: 2.7, beacon: [3.2, 3.42, 0.42] };
}
// жёлто-зелёная пожарная машина: большая кабина, кузов с отсеками за шторками, красный пояс с надписью, лестница на крыше
function fireEngine() {
  const S = sculptor(), L = sculptor(), Y = '#c9d83c', YD = '#a8b62e', RED = '#d8281e', WHITE = '#f2f2ee', DARK = '#232325', HW = 1.24, R = 0.52;
  S.box(7.4, 0.28, 1.1, -0.1, 0.9, 0, DARK);
  for (const s of [-1, 1]) {
    vehWheel(S, 2.55, R, s * 1.0, R, 0.36, s); vehWheel(S, -2.2, R, s * 0.95, R, 0.5, s);
    vehArch(S, 2.55, R + 0.04, s * (HW + 0.012), R + 0.15, s); vehArch(S, -2.2, R + 0.04, s * (HW + 0.012), R + 0.15, s);
  }
  // кабина
  S.box(2.1, 2.3, 2 * HW, 2.85, 2.15, 0, Y); S.box(2.14, 0.4, 2 * HW + 0.04, 2.85, 1.2, 0, WHITE);
  S.box(0.06, 1.0, 2.1, 3.92, 2.62, 0, VEH_GLASS); S.box(0.08, 1.0, 0.07, 3.93, 2.62, 0, Y);
  for (const s of [-1, 1]) {
    S.box(1.25, 0.85, 0.05, 3.02, 2.64, s * (HW + 0.01), VEH_GLASS);                               // боковое окно
    S.box(0.03, 1.95, 0.03, 2.28, 2.0, s * (HW + 0.015), YD); S.box(0.03, 1.95, 0.03, 3.78, 2.0, s * (HW + 0.015), YD);   // швы двери
    S.box(0.18, 0.045, 0.04, 2.5, 1.85, s * (HW + 0.025), DARK);                                    // ручка
    S.box(0.1, 0.5, 0.26, 3.8, 2.95, s * (HW + 0.22), DARK); S.box(0.04, 0.04, 0.24, 3.8, 2.8, s * (HW + 0.1), DARK);      // зеркало
    S.box(0.6, 0.06, 0.34, 2.95, 0.62, s * (HW + 0.02), '#3a3a3c');                                 // подножка
    S.box(0.03, 0.025, 0.6, 3.96, 2.2, s * 0.5, DARK, 0, s * 0.3);                                  // дворник
  }
  // морда: решётка, по бокам от неё крупные фары с поворотниками, белый бампер с противотуманками и номером
  S.box(0.06, 0.66, 1.3, 3.93, 1.68, 0, DARK); for (let y = 1.42; y < 1.98; y += 0.13) S.box(0.07, 0.04, 1.24, 3.95, y, 0, '#77777a');
  for (const s of [-1, 1]) {
    S.box(0.06, 0.5, 0.5, 3.93, 1.62, s * 0.92, '#8e9296');                                         // корпус фары
    S.box(0.07, 0.3, 0.42, 3.955, 1.7, s * 0.92, '#fbf6d6'); S.box(0.07, 0.12, 0.42, 3.955, 1.44, s * 0.92, '#f09a2a');   // фара и поворотник
    S.box(0.05, 0.14, 0.3, 4.15, 0.98, s * 0.82, '#fbf6d6');                                        // противотуманка
  }
  S.box(0.34, 0.36, 2.56, 3.97, 0.95, 0, WHITE); S.box(0.04, 0.14, 0.5, 4.15, 0.86, 0, '#e8e8e4');
  S.box(0.5, 0.2, 1.7, 2.9, 3.4, 0, RED);                                                           // балка мигалок
  // кузов: шторки отсеков, красный пояс под крышей, бело-красные шашки по низу
  S.box(5.4, 2.3, 2 * HW, -1.15, 2.15, 0, Y); S.box(5.44, 0.34, 2 * HW + 0.04, -1.15, 1.17, 0, YD);
  S.box(5.42, 0.5, 2 * HW + 0.03, -1.15, 3.05, 0, RED);
  for (const s of [-1, 1]) {
    for (const x of [-3.0, -1.15, 0.7]) fireShutterBox(S, x, 2.04, 1.6, 1.4, s * (HW + 0.015));
    for (let i = 0; i < 12; i++) S.box(0.45, 0.16, 0.02, -3.62 + i * 0.45, 1.17, s * (HW + 0.03), i % 2 ? RED : WHITE);
    S.box(5.0, 0.07, 0.07, -1.2, 3.62, s * 0.42, '#d8d8d4'); S.box(5.0, 0.06, 0.2, -1.2, 3.34, s * 1.0, '#8a3a2a');   // лестница и рукава на крыше
    S.box(0.06, 0.3, 0.16, -3.88, 1.55, s * 1.0, '#c8201c'); S.box(0.06, 0.14, 0.16, -3.88, 1.3, s * 1.0, '#f09a2a');   // задние фонари
    S.box(0.04, 0.34, 0.3, -2.9, 0.36, s * 0.95, DARK);                                             // брызговики
  }
  for (let x = -3.5; x <= 1.1; x += 0.5) S.box(0.06, 0.06, 0.84, x, 3.62, 0, '#d8d8d4');
  S.box(0.3, 1.3, 2.2, -3.95, 1.9, 0, '#b4b8bc'); S.tube(-4.15, 1.45, 2.25, 0, 0.42, 0.42, '#c81e1e', 8, 0);      // корма: насосный щит, катушка рукава
  S.box(0.4, 0.08, 2.2, -4.05, 0.75, 0, '#3a3a3c');                                                 // задняя подножка
  // надписи: белым по красному поясу, номер и «199» на двери — с обоих бортов
  for (const s of [-1, 1]) {
    L.text('FIRE RESCUE', -1.15, 3.05 + 0.2, s * (HW + 0.035), 0.08, WHITE, s);
    L.text('199', 3.02, 2.02, s * (HW + 0.03), 0.07, RED, s); L.text('14-1', 3.02, 1.34, s * (HW + 0.04), 0.045, DARK, s);
  }
  return { body: S.mesh().geometry, lit: L.mesh().geometry, len: 8.2, wid: 2.7, beacon: [2.9, 3.62, 0.5] };
}

function fireStationParts() {
  const { W, D, PARK } = FIRE, A = sculptor(), CR = '#ece6d6', RED = '#c82420', GH = 5.0, GD = 10, GW = 18;   // GH — высота проёма гаража, GD — глубина, GW — ширина
  // площадка и пол гаража
  A.quad([0, LOT_Y, -W / 2 - 1], [D / 2 + PARK, LOT_Y, -W / 2 - 1], [D / 2 + PARK, LOT_Y, W / 2 + 1], [0, LOT_Y, W / 2 + 1], '#a29f97');
  A.skirt(0, D / 2 + PARK, -W / 2 - 1, W / 2 + 1, LOT_Y, '#8e8c86', 0.4, 'a');                   // борт площадки: станция поднята над землёй на LOT_RISE
  A.box(10.3, 0.6, GW + 0.3, -5, -0.1, 0, '#c9c5bb'); A.box(4.3, 0.6, 4.3, -6, -0.1, -(GW / 2 + 3.2), '#c9c5bb');   // цоколи здания и каланчи уходят в землю
  A.quad([-0.2, LOT_Y + 0.01, -GW / 2], [GD, LOT_Y + 0.01, -GW / 2], [GD, LOT_Y + 0.01, GW / 2], [-0.2, LOT_Y + 0.01, GW / 2], '#928e86');
  for (const z of [-3, 3]) A.quad([0.5, LOT_Y + 0.02, z - 0.07], [GD + 6, LOT_Y + 0.02, z - 0.07], [GD + 6, LOT_Y + 0.02, z + 0.07], [0.5, LOT_Y + 0.02, z + 0.07], '#e8c82a');   // жёлтые линии между постами
  for (let z = -GW / 2; z < GW / 2 - 0.5; z += 1.2) A.quad([GD + 6.4, LOT_Y + 0.02, z], [GD + 7.0, LOT_Y + 0.02, z], [GD + 7.0, LOT_Y + 0.02, z + 0.6], [GD + 6.4, LOT_Y + 0.02, z + 0.6], '#e8c82a');   // «не занимать выезд»
  // навес гаража: плита на столбах; низ столбов — в красно-белую полоску
  A.box(GD + 1.2, 0.4, GW + 1.2, GD / 2 + 0.2, GH + 0.2, 0, '#dcd8cc'); A.box(GD + 1.3, 0.12, GW + 1.3, GD / 2 + 0.2, GH + 0.46, 0, '#9aa0a4');
  for (const u of [0.4, GD - 0.4]) for (const z of [-GW / 2, -3, 3, GW / 2]) {
    A.box(0.5, GH, 0.5, u, GH / 2, z, '#f2f0ea');
    for (let k = 0; k < 5; k++) A.box(0.54, 0.4, 0.54, u, 0.2 + k * 0.4, z, k % 2 ? '#f2f0ea' : RED);
  }
  A.box(0.4, 1.3, GW + 1.2, GD + 0.7, GH - 0.15, 0, RED);                                           // красный фриз над въездом
  for (const z of [-6, 0, 6]) { A.box(0.3, 0.12, 1.4, GD - 2, GH - 0.1, z, '#f4f4ea'); A.box(0.3, 0.12, 1.4, 3, GH - 0.1, z, '#f4f4ea'); }   // светильники под навесом
  // здание за гаражом: три этажа, ленты окон, красный пояс под крышей; в стене гаража — двери и ворота склада
  const BH = 10.4;
  A.box(10, BH, GW, -5, BH / 2, 0, CR); A.box(10.5, 0.3, GW + 0.5, -5, BH + 0.15, 0, '#d9d6cf'); A.box(10.2, 0.7, GW + 0.2, -5, BH - 0.6, 0, RED);
  for (const y of [5.9, 8.5]) { A.box(0.1, 1.3, GW - 2, 0.03, y, 0, '#3c5560'); for (let z = -GW / 2 + 1; z <= GW / 2 - 0.99; z += 2) A.box(0.14, 1.4, 0.1, 0.05, y, z, '#f4f4f0'); A.box(0.5, 0.12, GW - 1.4, 0.3, y - 0.75, 0, '#d9d6cf'); }
  for (const z of [-6, 6]) { A.box(0.1, 2.2, 1.1, 0.03, 1.1 + LOT_Y, z, '#6a5a4a'); A.box(0.1, 1.0, 1.6, 0.03, 2.2, z - Math.sign(z) * 1.9, '#3c5560'); }
  A.box(0.1, 3.0, 3.4, 0.03, 1.5 + LOT_Y, 0, '#9aa0a4'); for (let y = 0.4; y < 3; y += 0.35) A.box(0.12, 0.04, 3.4, 0.05, y, 0, '#7e868c');
  for (const s of [-1, 1]) for (const y of [2.4, 5.9, 8.5]) for (const u of [-7.5, -4.5, -1.8]) { A.box(1.5, 1.2, 0.1, u, y, s * (GW / 2 + 0.03), '#3c5560'); A.box(1.7, 0.1, 0.16, u, y - 0.68, s * (GW / 2 + 0.05), '#d9d6cf'); }
  for (const y of [2.4, 5.9, 8.5]) for (const z of [-6, -2, 2, 6]) { A.box(0.1, 1.2, 1.6, -10.03, y, z, '#3c5560'); A.box(0.16, 0.1, 1.8, -10.05, y - 0.68, z, '#d9d6cf'); }   // задняя стена
  A.box(0.1, 2.1, 1.1, -10.03, 1.05, 4, '#6a5a4a');
  for (const [u, z] of [[-3, 0], [-7, -4]]) { A.box(0.9, 0.65, 0.9, u, BH + 0.6, z, '#d8dade'); }   // кондиционеры на крыше
  A.tube(-6, BH + 0.3, BH + 1.9, 5, 0.7, 0.7, '#8ea2b4', 8);                                        // бак с водой
  // каланча: квадратная башня с красными поясами, красная кабина с окнами, шатёр, флагшток с флагом
  const TU = -6, TZ = -(GW / 2 + 3.2), TH = 17;
  A.box(4, TH, 4, TU, TH / 2, TZ, CR);
  for (const y of [4.2, 8.4, 12.6]) { A.box(4.1, 0.5, 4.1, TU, y, TZ, RED); for (const [dx, dz, w, d] of [[2.03, 0, 0.1, 1.0], [-2.03, 0, 0.1, 1.0], [0, 2.03, 1.0, 0.1], [0, -2.03, 1.0, 0.1]]) A.box(w, 1.4, d, TU + dx, y + 1.9, TZ + dz, '#3c5560'); }
  A.box(4.8, 0.3, 4.8, TU, TH + 0.15, TZ, '#d9d6cf'); A.box(4.3, 2.8, 4.3, TU, TH + 1.7, TZ, RED);
  for (const [dx, dz, w, d] of [[2.16, 0, 0.1, 3.2], [-2.16, 0, 0.1, 3.2], [0, 2.16, 3.2, 0.1], [0, -2.16, 3.2, 0.1]]) A.box(w, 1.3, d, TU + dx, TH + 1.9, TZ + dz, '#2c424c');
  A.hip(TU, TZ, 2.7, 2.7, TH + 3.1, 0.2, 0.2, TH + 4.3, (i) => i % 2 ? '#9c1616' : '#b01c1c');
  A.tube(TU, TH + 4.3, TH + 8.3, TZ, 0.07, 0.05, '#d8d8d4', 5); thaiFlag(A, TU + 1.2, TH + 8.1, TZ, 1.2);
  A.box(0.1, 2.1, 1.0, TU + 2.03, 1.05, TZ, '#6a5a4a');
  // у гаража: сушилка для рукавов, щит с вёдрами и багром
  for (const z of [GW / 2 + 2.2, GW / 2 + 4.6]) A.box(0.12, 3.4, 0.12, 3, 1.7, z, '#8e9296'); A.box(0.1, 0.1, 2.6, 3, 3.4, GW / 2 + 3.4, '#8e9296');
  for (let i = 0; i < 5; i++) A.box(0.06, 2.6 - (i % 2) * 0.5, 0.16, 3, 2.05 + (i % 2) * 0.25, GW / 2 + 2.5 + i * 0.45, i % 2 ? '#d84a2a' : '#e8dcc0');
  // надписи: фриз над въездом и «199» на башне — светятся сами
  const L = sculptor();
  signText(L, 'FIRE STATION', -1.6, 0, 0.02, 0.15, '#f6f6f0'); signText(L, '199', 6.4, 0, 0.02, 0.17, '#f6e040');
  signDisc(L, -7.6, 0, 0.02, 0.5, '#f6f6f0'); signDisc(L, -7.6, 0, 0.03, 0.38, RED); signText(L, 'F', -7.6, 0, 0.04, 0.07, '#f6f6f0');
  const lit = [signGeo(L, GD + 0.92, GH - 0.15, 0)];
  for (const f of ['x', 'z', '-z']) { const T = sculptor(); signText(T, '199', 0, 0, 0, 0.16, '#f6f6f0'); lit.push(signGeo(T, TU + (f === 'x' ? 2.17 : 0), TH + 0.78, TZ + (f === 'z' ? 2.17 : f === '-z' ? -2.17 : 0), f)); }
  return { body: A.mesh().geometry, lit: mergeGeo(lit), GD, GW, GH, tower: [TU, TZ, TH] };
}

function buildFireStations() {
  if (!IS.stations || !IS.stations.length) return;
  const { W, D, PARK } = FIRE, P = fireParts = fireStationParts(), trucks = [fireTanker(), fireEngine()];
  const BODY = lambert({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a2824 }), SIGN = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const GLOW = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const RED = new THREE.MeshBasicMaterial({ color: 0xff2a1a }), BLUE = new THREE.MeshBasicMaterial({ color: 0x2a6aff }), LAMP = new THREE.MeshBasicMaterial({ color: 0xff2414, fog: false });
  const night = [];
  IS.stations.forEach((s, k) => {
    const g = new THREE.Group();
    g.position.set(s.x, s.y + LOT_RISE, s.z); g.rotation.y = -s.az;
    scene.add(g);
    g.add(new THREE.Mesh(P.body, BODY), new THREE.Mesh(P.lit, SIGN));
    // ночью под навесом горит свет; на каланче — красный огонь
    { const m = new THREE.Mesh(new THREE.PlaneGeometry(P.GD - 1, P.GW - 1).rotateX(Math.PI / 2), GLOW); m.position.set(P.GD / 2, P.GH - 0.2, 0); m.visible = false; g.add(m); night.push(m);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), LAMP); l.position.set(P.tower[0], P.tower[2] + 8.5, P.tower[1]); g.add(l); towerLamps.push(l); }
    g.updateMatrixWorld(true);
    lotApron(g, D / 2 + PARK, -W / 2 - 1, W / 2 + 1, LOT_Y, '#a29f97', 1, 0x2a2824);
    // две пожарные машины под навесом, носом к дороге; у станций они стоят на разных постах
    trucks.forEach((T, i) => {
      const v = (k % 2 ? [6, 0] : [-6, 0])[i], u = P.GD / 2 + 0.2 + (i ? 0.5 : 0), t = new THREE.Group();
      t.add(new THREE.Mesh(T.body, BODY), new THREE.Mesh(T.lit, SIGN));
      const lr = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.4), RED), lb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.4), BLUE);
      lr.position.set(T.beacon[0], T.beacon[1], -T.beacon[2]); lb.position.set(T.beacon[0], T.beacon[1], T.beacon[2]); t.add(lr, lb); fireBeacons.push([lr, lb]);
      t.position.set(u, LOT_Y + 0.01, -v); g.add(t);
      wallBox(g, u, v, T.len, T.wid);                                                             // машины твёрдые
    });
    // твёрдое: здание, каланча, столбы навеса
    wallBox(g, -5, 0, 10, P.GW); wallBox(g, P.tower[0], -P.tower[1], 4, 4);
    for (const u of [0.4, P.GD - 0.4]) for (const v of [-P.GW / 2, -3, 3, P.GW / 2]) wallBox(g, u, v, 0.6, 0.6);
    // мелочь у выезда — разрушаемая: гидрант, конусы
    templeProp(g, P.GD + 2.5, -(P.GW / 2 + 1.5), (B) => { B.tube(0, 0, 0.75, 0, 0.16, 0.14, '#c81e1e', 7); B.blob(0, 0.82, 0, 0.17, 0.12, 0.17, '#c81e1e', 6, 3); B.box(0.5, 0.14, 0.14, 0, 0.5, 0, '#e8e8e4'); }, { kind: 'small', color: '#c81e1e', r: 0.25, loss: 0.03 });
    for (const v of [-8.5, 8.5]) templeProp(g, P.GD + 6.6, v, (B) => { B.box(0.42, 0.05, 0.42, 0, 0.1, 0, '#e8632a'); B.tube(0, 0.1, 0.75, 0, 0.17, 0.03, '#e8632a', 6); B.tube(0, 0.4, 0.52, 0, 0.11, 0.09, '#f2f2ee', 6); }, { kind: 'small', color: '#e8632a', r: 0.25, loss: 0.02 });
    const lot = (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > -D / 2 - 5 && p.x < D / 2 + PARK + 1 && Math.abs(p.z) < W / 2 + 6; };
    vegKeepOut.push(Object.assign(lot, { c: [s.x, s.z, 34] }));
    pavedAreas.push({ x: s.x, z: s.z, r2: 34 * 34, lift: LOT_Y + LOT_RISE,
      test: (x, z) => { const p = g.worldToLocal(new THREE.Vector3(x, 0, z)); return p.x > 0 && p.x < D / 2 + PARK && Math.abs(p.z) < W / 2 + 1; } });
    g.userData.c = new THREE.Vector3(s.x, 0, s.z); pierGroups.push(g);
    spotPlace('ПОЖАРНАЯ ' + s.name.toUpperCase(), g, D / 2 + PARK + 4, 0, -1, 0);
  });
  airportAnim.push((t) => {
    const on = skyNow.night > 0.3; for (const m of night) if (m.visible !== on) m.visible = on;
    const b = Math.floor(t * 4) % 2; for (const [lr, lb] of fireBeacons) { lr.visible = !!b; lb.visible = !b; }
  });
}
