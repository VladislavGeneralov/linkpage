// Машины на стоянках: пикапы с разными кузовами, фургон-закусочная и копии управляемых машин в другом цвете.
// Требование Влада: детализация не хуже, чем у управляемых машин и пожарной, — круглые колёса с дисками, кабина
// со стёклами, зеркалами, фарами и бамперами, колёсные арки; кузова у грузовичков разные, а не только цвет:
// сонгтео (крыша и лавки), пустой тент, тент с коробками, тент с кокосами, закрытый фургон.
// Каждая машина — один меш с цветом в вершинах (одна отрисовка), геометрия строится один раз на вид и цвет.
// Оси модели: нос — к +X, y — вверх от земли, z — борт. Все стоящие машины твёрдые (parkVehicle ставит стену).
// Файл только объявляет функции.

const vehCache = {};
let VEH_MAT = null;
const VEH_GLASS = '#1c2a36', VEH_DARK = '#1b1b1d', VEH_CHROME = '#c9cdd1';

// колесо с осью поперёк машины: протектор, боковина, утопленный диск со спицами, колпак. out — куда смотрит наружная сторона
function vehWheel(S, x, y, z, r, w, out, rim = VEH_CHROME) {
  const n = 14, zo = z + out * w / 2, zi = z - out * w / 2, zd = zo - out * 0.05, P = (t, k, zz) => [x + Math.cos(t) * r * k, y + Math.sin(t) * r * k, zz];
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.2832, b = (i + 1) / n * 6.2832;
    S.quad(P(a, 1, zi), P(b, 1, zi), P(b, 1, zo), P(a, 1, zo), '#19191b');                          // протектор
    S.quad(P(a, 1, zo), P(b, 1, zo), P(b, 0.66, zo), P(a, 0.66, zo), '#232325');                    // боковина
    S.quad(P(a, 0.66, zo), P(b, 0.66, zo), P(b, 0.6, zd), P(a, 0.6, zd), '#8e9296');                // закраина диска
    S.quad(P(a, 0.6, zd), P(b, 0.6, zd), P(b, 0.26, zd), P(a, 0.26, zd), rim);                      // диск
    S.tri(P(a, 0.26, zd), P(b, 0.26, zd), [x, y, zo - out * 0.005], '#a8acb0');                     // колпак
    S.tri([x, y, zi], P(a, 1, zi), P(b, 1, zi), '#151517');
  }
  for (let k = 0; k < 5; k++) { const t = k / 5 * 6.2832 + 0.3; S.tri(P(t - 0.2, 0.34, zd + out * 0.004), P(t + 0.2, 0.34, zd + out * 0.004), P(t, 0.56, zd + out * 0.004), '#3a3c40'); }   // прорези диска
}
// Кузов по боковому силуэту. prof — контур [[x, y], …] (замкнутый, обход любой); выдавливается на полуширину hw;
// выше пояса belt борта заваливаются внутрь (tumble — метров на метр высоты). color — цвет или функция (номер отрезка) -> цвет
// пояса обшивки между бортами; side — цвет бортов. c — точка внутри силуэта, от неё веером закрываются борта.
function vehBody(S, prof, hw, color, o = {}) {
  const belt = o.belt === undefined ? 1.0 : o.belt, tum = o.tumble === undefined ? 0.14 : o.tumble, Z = (y) => hw - Math.max(0, y - belt) * tum;
  const c = o.c || [prof.reduce((s, p) => s + p[0], 0) / prof.length, prof.reduce((s, p) => s + p[1], 0) / prof.length], side = o.side || (typeof color === 'function' ? color(-1) : color);
  for (let i = 0; i < prof.length; i++) {
    const a = prof[i], b = prof[(i + 1) % prof.length];
    S.quad([a[0], a[1], Z(a[1])], [b[0], b[1], Z(b[1])], [b[0], b[1], -Z(b[1])], [a[0], a[1], -Z(a[1])], typeof color === 'function' ? color(i) : color);
    for (const s of [-1, 1]) S.tri([c[0], c[1], s * Z(c[1])], [a[0], a[1], s * Z(a[1])], [b[0], b[1], s * Z(b[1])], side);
  }
  return Z;
}
// колёсная арка: тёмный полукруг на борту над колесом
function vehArch(S, x, y, z, r, out) {
  const n = 8; for (let i = 0; i < n; i++) { const a = i / n * Math.PI, b = (i + 1) / n * Math.PI; S.tri([x, y, z + out * 0.012], [x + Math.cos(a) * r, y + Math.sin(a) * r, z + out * 0.012], [x + Math.cos(b) * r, y + Math.sin(b) * r, z + out * 0.012], '#101012'); }
}

// ---------- пикап: кабина, капот, кузов; kind — что в кузове ----------
// 'songthaew' — крыша на стойках и лавки (маршрутка), 'empty' — тент на дугах, кузов пустой, 'boxes' — тент, коробки,
// 'coconuts' — тент, гора кокосов, 'closed' — закрытый фургон. paint — цвет кабины.
function pickupGeo(kind, paint) {
  const key = 'pickup|' + kind + '|' + paint;
  if (vehCache[key]) return vehCache[key];
  const S = sculptor(), HW = 0.9, C = new THREE.Color(paint), shade = '#' + C.clone().multiplyScalar(0.78).getHexString(), R = 0.37;
  const FX = 1.72, RX = -1.5;                                                                       // оси
  // рама и подвеска
  S.box(4.9, 0.16, 0.9, -0.05, 0.5, 0, VEH_DARK); for (const x of [FX, RX]) S.box(0.14, 0.14, 1.56, x, R, 0, '#2a2a2c');
  for (const s of [-1, 1]) { vehWheel(S, FX, R, s * 0.8, R, 0.26, s); vehWheel(S, RX, R, s * 0.8, R, 0.26, s); }
  // кабина с капотом: силуэт от заднего низа по часовой стрелке
  const cab = [[0.1, 0.42], [0.1, 1.2], [0.1, 1.74], [0.28, 1.8], [1.0, 1.77], [1.52, 1.2], [2.46, 1.08], [2.6, 1.0], [2.63, 0.62], [2.52, 0.42]];
  const Z = vehBody(S, cab, HW, (i) => i === 1 ? VEH_GLASS : i === 4 ? VEH_GLASS : i === 3 ? shade : paint, { belt: 1.2, tumble: 0.2, c: [1.3, 0.75], side: paint });
  // стёкла дверей, стойка, шов двери, ручка, зеркало, молдинг
  for (const s of [-1, 1]) {
    const g = (x, y) => [x, y, s * (Z(y) + 0.008)];
    S.quad(g(1.42, 1.24), g(1.0, 1.7), g(0.62, 1.71), g(0.62, 1.24), VEH_GLASS); S.quad(g(0.54, 1.24), g(0.54, 1.71), g(0.22, 1.7), g(0.22, 1.24), VEH_GLASS);
    S.box(0.02, 0.78, 0.02, 0.58, 0.82, s * (HW + 0.006), shade); S.box(0.02, 0.8, 0.02, 1.5, 0.82, s * (HW + 0.006), shade);   // швы двери
    S.box(0.14, 0.035, 0.03, 0.72, 1.08, s * (HW + 0.015), VEH_DARK);                             // ручка
    S.box(0.06, 0.16, 0.22, 1.44, 1.32, s * (HW + 0.13), VEH_DARK); S.box(0.03, 0.03, 0.12, 1.44, 1.28, s * (HW + 0.03), VEH_DARK);   // зеркало
    S.box(2.3, 0.05, 0.02, 1.3, 0.72, s * (HW + 0.008), VEH_DARK);                                 // молдинг по борту
    vehArch(S, FX, R + 0.02, s * HW, R + 0.11, s);
    S.box(0.5, 0.04, 0.2, 0.7, 0.4, s * (HW + 0.06), '#3a3a3c');                                   // подножка
  }
  // морда: решётка, фары, поворотники, бампер, номер; дворники
  S.box(0.05, 0.24, 1.0, 2.635, 0.86, 0, VEH_DARK); for (let y = 0.78; y < 0.96; y += 0.07) S.box(0.06, 0.025, 0.96, 2.64, y, 0, VEH_CHROME);
  for (const s of [-1, 1]) { S.box(0.06, 0.2, 0.34, 2.625, 0.88, s * 0.7, '#f4f0d0'); S.box(0.06, 0.2, 0.09, 2.62, 0.88, s * 0.865, '#e8902a'); S.box(0.03, 0.02, 0.5, 1.6, 1.24, s * 0.4, VEH_DARK, 0, s * 0.25); }
  S.box(0.22, 0.2, 1.86, 2.6, 0.52, 0, '#2a2c2e'); S.box(0.04, 0.12, 0.44, 2.72, 0.52, 0, '#f2f2ee');
  S.box(0.9, 0.03, 1.5, 0.62, 1.8, 0, shade);                                                       // крыша
  // кузов: пол, борта, задний борт, фонари, бампер, брызговики
  const BX0 = -2.62, BX1 = 0.04, FL = 0.74, TOP = 1.26;
  S.box(BX1 - BX0, 0.08, 2 * HW - 0.08, (BX0 + BX1) / 2, FL, 0, '#3a3a3c');
  S.box(BX1 - BX0, 0.3, 2 * HW, (BX0 + BX1) / 2, 0.57, 0, paint);
  for (const s of [-1, 1]) { S.box(BX1 - BX0, TOP - FL, 0.06, (BX0 + BX1) / 2, (TOP + FL) / 2, s * (HW - 0.03), paint); S.box(BX1 - BX0, 0.05, 0.1, (BX0 + BX1) / 2, TOP + 0.02, s * (HW - 0.03), shade);
    vehArch(S, RX, R + 0.02, s * HW, R + 0.11, s);
    S.box(0.05, 0.3, 0.12, BX0 - 0.01, 0.98, s * (HW - 0.09), '#c8201c'); S.box(0.05, 0.1, 0.12, BX0 - 0.012, 0.76, s * (HW - 0.09), '#e8902a');   // фонари
    S.box(0.04, 0.3, 0.3, RX - R - 0.14, 0.34, s * 0.78, VEH_DARK); }                               // брызговики
  S.box(0.06, TOP - FL, 2 * HW - 0.1, BX0 + 0.03, (TOP + FL) / 2, 0, paint); S.box(0.07, 0.06, 0.5, BX0, 1.14, 0, shade); S.box(0.06, TOP - FL, 2 * HW - 0.1, BX1 - 0.03, (TOP + FL) / 2, 0, paint);
  S.box(0.2, 0.14, 1.84, BX0 - 0.08, 0.5, 0, '#8e9296'); S.box(0.03, 0.12, 0.4, BX0 - 0.19, 0.52, 0, '#f2f2ee');
  S.tube(BX0 + 0.2, 0.3, 0.42, 0.5, 0.035, 0.035, '#2f3236', 6);                                    // выхлоп
  const rnd = seededRandom(key.length * 13 + 5);
  if (kind === 'songthaew') {                                                                       // маршрутка: крыша на стойках, лавки, поручни, подножка
    for (const s of [-1, 1]) { for (const x of [BX0 + 0.08, -1.3, BX1 - 0.1]) S.box(0.05, 0.95, 0.05, x, TOP + 0.47, s * (HW - 0.05), paint);
      S.box(2.5, 0.05, 0.05, -1.3, 1.62, s * (HW - 0.05), '#e8c82a'); S.box(2.4, 0.06, 0.32, -1.3, 1.08, s * (HW - 0.24), '#3a3a3c'); S.box(2.4, 0.3, 0.05, -1.3, 1.3, s * (HW - 0.1), '#2a2a2c'); }
    S.box(2.9, 0.07, 2 * HW + 0.06, -1.24, TOP + 0.98, 0, '#f2f2ee'); S.box(2.92, 0.05, 2 * HW + 0.1, -1.24, TOP + 0.93, 0, paint);
    S.box(0.4, 0.05, 1.2, BX0 - 0.3, 0.42, 0, '#3a3a3c'); for (const s of [-1, 1]) S.box(0.04, 0.9, 0.04, BX0 - 0.06, 1.7, s * 0.3, '#e8c82a');
    S.box(0.06, 0.3, 1.3, 0.2, 2.2, 0, '#f6d048');                                                 // табличка маршрута над кабиной
  } else if (kind === 'closed') {                                                                   // закрытый фургон: белый короб с рёбрами, двери сзади
    const BH = 1.85, y0 = FL + 0.02;
    S.box(2.74, BH, 2 * HW + 0.1, -1.28, y0 + BH / 2, 0, '#eef0f0');
    for (let x = -2.4; x < 0; x += 0.45) for (const s of [-1, 1]) S.box(0.03, BH - 0.1, 0.02, x, y0 + BH / 2, s * (HW + 0.055), '#cfd4d6');
    S.box(2.78, 0.08, 2 * HW + 0.14, -1.28, y0 + BH + 0.02, 0, '#cfd4d6'); S.box(2.78, 0.1, 2 * HW + 0.14, -1.28, y0 + 0.05, 0, '#9aa0a4');
    for (const s of [-1, 1]) { S.box(2.5, 0.3, 0.012, -1.28, y0 + 1.15, s * (HW + 0.062), paint); }                                    // цветная полоса по борту
    S.box(0.03, BH - 0.14, 0.03, -2.655, y0 + BH / 2, 0, '#9aa0a4'); for (const s of [-1, 1]) { S.box(0.03, 0.9, 0.04, -2.67, y0 + 0.9, s * 0.12, '#6a7278'); for (const y of [0.3, 1.5]) S.box(0.03, 0.1, 0.16, -2.66, y0 + y, s * (HW - 0.05), '#6a7278'); }
  } else {                                                                                          // тент на дугах: открытые борта, двускатный брезент
    const TARP = kind === 'boxes' ? '#3a6ab8' : kind === 'coconuts' ? '#3a8a5a' : '#8a8f94', TY = 2.08;
    for (const x of [BX0 + 0.1, -1.3, BX1 - 0.12]) { for (const s of [-1, 1]) S.box(0.045, TY - TOP, 0.045, x, (TY + TOP) / 2, s * (HW - 0.05), '#b8bcc0'); S.box(0.045, 0.045, 2 * HW - 0.1, x, TY, 0, '#b8bcc0'); }
    for (const s of [-1, 1]) S.box(2.5, 0.04, 0.04, -1.3, 1.68, s * (HW - 0.05), '#b8bcc0');
    S.gable(-1.3, 0, 2.78, HW + 0.04, TY, TY + 0.3, TARP, TARP, 'x');
    for (const s of [-1, 1]) S.quad([BX0 - 0.08, TY, s * (HW + 0.04)], [BX1 + 0.06, TY, s * (HW + 0.04)], [BX1 + 0.06, TY - 0.2, s * (HW + 0.06)], [BX0 - 0.08, TY - 0.2, s * (HW + 0.06)], TARP);   // свес брезента
    if (kind === 'boxes') {                                                                         // картонные коробки штабелями
      const CB = ['#c8a06a', '#b89058', '#d4ac78'];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (let l = 0; l < (i === 0 ? 1 : 2 + ((i + j) % 2)); l++) {
        const w = 0.56 + rnd() * 0.06, h = 0.36 + rnd() * 0.06, x = BX0 + 0.42 + i * 0.6, z = (j ? 0.4 : -0.4) + (rnd() - 0.5) * 0.06;
        S.box(w, h, 0.7, x, FL + 0.05 + h / 2 + l * 0.42, z, CB[(i + j + l) % 3], 0, (rnd() - 0.5) * 0.1); S.box(w + 0.01, 0.04, 0.1, x, FL + 0.05 + h + l * 0.42, z, '#8a6a3a');
      }
    } else if (kind === 'coconuts') {                                                               // гора кокосов: зелёные и побуревшие
      const CC = ['#6a9a3a', '#7aa844', '#8a7a42', '#5a8a34', '#9a8a4e'];
      for (let l = 0; l < 3; l++) for (let i = 0; i < 9 - l * 2; i++) for (let j = 0; j < 5 - l * 2; j++) {
        const x = BX0 + 0.3 + l * 0.27 + i * 0.27 + (rnd() - 0.5) * 0.06, z = -0.54 + l * 0.27 + j * 0.27 + (rnd() - 0.5) * 0.06, r = 0.135 + rnd() * 0.03;
        S.blob(x, FL + 0.16 + l * 0.2, z, r, r * 1.12, r, CC[(rnd() * CC.length) | 0], 6, 4);
      }
    }
  }
  return vehCache[key] = { geo: S.mesh().geometry, len: 5.45, wid: 2.05, mass: VEH_MASS['pickup:' + kind] || VEH_MASS.pickup };
}

// ---------- фургон-закусочная: микроавтобус с открытым бортом, прилавком и козырьком (окно — на правом борту, z > 0) ----------
function foodVanGeo(paint = '#b4d83c') {
  const key = 'van|' + paint;
  if (vehCache[key]) return vehCache[key];
  const S = sculptor(), HW = 0.92, R = 0.34, WHITE = '#f2f2ee';
  S.box(4.3, 0.14, 0.9, 0, 0.46, 0, VEH_DARK);
  for (const s of [-1, 1]) { vehWheel(S, 1.45, R, s * 0.8, R, 0.24, s, WHITE); vehWheel(S, -1.35, R, s * 0.8, R, 0.24, s, WHITE); }
  const prof = [[-2.25, 0.4], [-2.3, 0.75], [-2.28, 1.9], [-2.1, 2.08], [1.3, 2.08], [1.62, 1.95], [2.12, 1.25], [2.3, 1.05], [2.32, 0.6], [2.2, 0.4]];
  const Z = vehBody(S, prof, HW, (i) => i === 5 ? VEH_GLASS : i === 1 ? WHITE : WHITE, { belt: 1.25, tumble: 0.1, c: [0, 1.0], side: WHITE });
  for (const s of [-1, 1]) {
    S.quad([-2.29, 0.42, s * (HW + 0.006)], [2.3, 0.42, s * (HW + 0.006)], [2.31, 1.0, s * (HW + 0.006)], [-2.3, 1.0, s * (HW + 0.006)], paint);   // цветной низ
    const g = (x, y) => [x, y, s * (Z(y) + 0.008)];
    S.quad(g(2.02, 1.3), g(1.6, 1.9), g(1.05, 1.92), g(1.05, 1.3), VEH_GLASS);                      // стекло двери кабины
    S.box(0.02, 1.3, 0.02, 0.98, 1.15, s * (HW + 0.006), '#c8ccd0'); S.box(0.14, 0.035, 0.03, 1.16, 1.18, s * (HW + 0.015), VEH_DARK);
    S.box(0.06, 0.2, 0.22, 1.95, 1.45, s * (HW + 0.13), VEH_DARK);
    vehArch(S, 1.45, R + 0.02, s * HW, R + 0.1, s); vehArch(S, -1.35, R + 0.02, s * HW, R + 0.1, s);
  }
  S.quad([-2.0, 1.3, -(Z(1.3) + 0.008)], [0.7, 1.3, -(Z(1.3) + 0.008)], [0.7, 1.9, -(Z(1.9) + 0.008)], [-2.0, 1.9, -(Z(1.9) + 0.008)], VEH_GLASS);   // окна левого борта
  for (const x of [-1.1, -0.2]) S.box(0.05, 0.62, 0.02, x, 1.6, -(HW - 0.03), WHITE);
  // правый борт: раздаточное окно, прилавок, козырёк на подкосах, меню
  S.quad([-1.9, 1.15, HW + 0.01], [0.6, 1.15, HW + 0.01], [0.6, 1.92, HW - 0.09], [-1.9, 1.92, HW - 0.09], '#2a2420');
  S.box(2.6, 0.05, 0.42, -0.65, 1.14, HW + 0.2, '#c8ccd0'); for (const x of [-1.8, 0.5]) S.rod([x, 0.9, HW + 0.02], [x, 1.12, HW + 0.36], 0.03, '#8e9296');
  S.quad([-2.0, 2.02, HW - 0.08], [0.7, 2.02, HW - 0.08], [0.7, 2.25, HW + 0.95], [-2.0, 2.25, HW + 0.95], paint); for (const x of [-1.9, 0.6]) S.rod([x, 1.75, HW - 0.05], [x, 2.22, HW + 0.85], 0.03, '#8e9296');
  for (let i = 0; i < 5; i++) S.box(0.3, 0.18 + (i % 2) * 0.06, 0.26, -1.65 + i * 0.5, 1.26, HW + 0.2, ['#e8a23a', '#c8642a', '#f2e8c0', '#7ab84a', '#d84a3a'][i]);
  S.box(1.0, 0.5, 0.03, 0.05, 0.72, HW + 0.02, '#2a2420'); for (let i = 0; i < 3; i++) S.box(0.8, 0.05, 0.035, 0.05, 0.6 + i * 0.12, HW + 0.025, ['#f6d048', '#f2f2ee', '#e8782a'][i]);
  // морда и корма
  S.box(0.05, 0.22, 1.0, 2.33, 0.8, 0, VEH_DARK); for (const s of [-1, 1]) { S.blob(2.33, 0.82, s * 0.66, 0.04, 0.13, 0.13, '#f4f0d0', 8, 4); S.box(0.05, 0.1, 0.12, 2.33, 0.62, s * 0.7, '#e8902a');
    S.box(0.05, 0.36, 0.12, -2.31, 1.0, s * (HW - 0.1), '#c8201c'); S.box(0.03, 0.02, 0.5, 2.0, 1.3, s * 0.4, VEH_DARK, 0, s * 0.25); }
  S.box(0.18, 0.18, 1.86, 2.3, 0.48, 0, '#8e9296'); S.box(0.16, 0.16, 1.84, -2.28, 0.48, 0, '#8e9296'); S.box(0.03, 0.12, 0.4, 2.4, 0.48, 0, WHITE);
  S.quad([-2.31, 1.25, -0.7], [-2.31, 1.25, 0.7], [-2.29, 1.85, 0.66], [-2.29, 1.85, -0.66], VEH_GLASS); S.box(0.03, 1.4, 0.03, -2.31, 1.15, 0, '#c8ccd0');
  S.box(1.4, 0.08, 1.0, -0.6, 2.13, 0, '#d8dcde'); S.tube(-1.5, 2.08, 2.35, -0.3, 0.12, 0.12, '#8e9296', 6);   // люк и вытяжка на крыше
  return vehCache[key] = { geo: S.mesh().geometry, len: 4.75, wid: 2.1, mass: VEH_MASS.foodvan, hatch: [-0.65, 1.55, HW + 0.012, 2.4, 0.72] };
}

// ---------- копия нарисованной машины или скутера в другом цвете: модель из многих деталей запекается в один меш ----------
// id — 'beetle', 'porsche', 'lancia', 'dmax', 'city', 'hilux' или 'scooter:<вид>' (click, scoopy, wave, pcx, nmax, aerox);
// paint — новый цвет кузова (null — родной). Модели смотрят носом к −Z — копия разворачивается носом к +X.
// Скутер запекается стоящим на боковой подножке: руль повёрнут, сам наклонён влево.
const CAR_SRC = {
  beetle: [() => buildBeetle(), 0xf2c418], lancia: [() => buildLancia({ stripes: false }), 0xe9e9e4], porsche: [() => buildPorsche(), 0x6fa6d2],
  dmax: [() => buildDmax(), 0xc8652a], city: [() => buildCity(), 0x666b72], hilux: [() => buildHilux(), 0xb4babf],
  evo: [() => buildEvo(), 0xc8242c], impreza: [() => buildImpreza(), 0x1f47a8],
};
// Модель запекается один раз на вид (vehBase): положения и нормали вершин у всех расцветок общие, у расцветки свои только цвета
// (кузов — в свой цвет, остальное — как у модели). Раньше модель строилась заново для каждой расцветки.
const vehBase = {};
function bakedCarGeo(id, paint = null) {
  const key = 'car|' + id + '|' + paint;
  if (vehCache[key]) return vehCache[key];
  const bike = id.startsWith('scooter:') ? id.slice(8) : null, SRC = bike ? [() => buildScooter(SCOOTERS[bike]), SCOOTERS[bike].paint] : CAR_SRC[id];
  let B = vehBase[id];
  if (!B) {
    const root = SRC[0](), pos = [], col = [], body = [], v = new THREE.Vector3();
    if (bike) root.userData.frontWheels[0].rotation.y = 0.5;
    root.rotation.y = -Math.PI / 2; root.updateMatrixWorld(true);
    root.traverse((m) => {
      if (!m.isMesh) return;
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, p = g.attributes.position, mat = Array.isArray(m.material) ? m.material[0] : m.material;
      const own = mat.color && mat.color.getHex() !== SRC[1] ? mat.color : null;                       // null — кузов: красится в цвет расцветки
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); pos.push(v.x, v.y, v.z); if (own) col.push(own.r, own.g, own.b); else col.push(0, 0, 0); body.push(own ? 0 : 1); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (bike) geo.rotateX(-0.17);                                                                     // на подножке — с наклоном
    geo.computeVertexNormals(); geo.computeBoundingBox();
    B = vehBase[id] = { position: geo.attributes.position, normal: geo.attributes.normal, bb: geo.boundingBox, col: new Float32Array(col), body };
  }
  const to = new THREE.Color(paint === null ? SRC[1] : paint), col = B.col.slice(), geo = new THREE.BufferGeometry();
  for (let i = 0; i < B.body.length; i++) if (B.body[i]) { col[i * 3] = to.r; col[i * 3 + 1] = to.g; col[i * 3 + 2] = to.b; }
  geo.setAttribute('position', B.position); geo.setAttribute('normal', B.normal); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.boundingBox = B.bb.clone();
  const bb = geo.boundingBox;
  return vehCache[key] = { geo, len: bb.max.x - bb.min.x, wid: bb.max.z - bb.min.z, cx: (bb.max.x + bb.min.x) / 2, paint: '#' + to.getHexString(), mass: VEH_MASS[id] || (bike ? VEH_MASS.scooter : 1200) };
}
// что стоит на парковках: машины (вид, цвет) и скутеры (вид, цвет или null — родной)
const PARK_CARS = [['hilux', '#b4babf'], ['city', '#e8e8e4'], ['dmax', '#c8652a'], ['city', '#666b72'], ['hilux', '#e8e8e4'], ['dmax', '#27408a'], ['city', '#a8201c'], ['hilux', '#1b1b1d'],
  ['dmax', '#e8e8e4'], ['city', '#1b1b1d'], ['hilux', '#6a4a3a'], ['dmax', '#8e9296']];
const PARK_SCOOTERS = [['click', null], ['scoopy', null], ['wave', null], ['pcx', null], ['nmax', null], ['aerox', null], ['click', '#c8302a'], ['scoopy', '#7ab8c8'], ['wave', '#1f3fb0'],
  ['pcx', '#e8e8e4'], ['scoopy', '#e8a8b8'], ['click', '#1b1b1d'], ['wave', '#1b1b1d'], ['nmax', '#8a2a2a'], ['aerox', '#e8c82a']];
const parkedCar = (n) => bakedCarGeo(...PARK_CARS[((n % PARK_CARS.length) + PARK_CARS.length) % PARK_CARS.length]);
// ---------- стоящие машины и скутеры: удар, отскок, взрыв ----------
// Массы, кг — снаряжённые, без водителя; список дала сессия моделей транспорта по просьбе Влада (точность ±5 %, Влад может менять).
// Поменять числа здесь — остальное считается само.
// Ключ — id машины игрока (CARS) или вид стоящей: 'pickup' — пикапы из pickupGeo, 'scooter' — любой скутер без своей строки.
const VEH_MASS = { beetle: 800, porsche: 1300, lancia: 1300, city: 1120, hilux: 2000, dmax: 1900, evo: 1360, impreza: 1470, wave: 100,
  scooter: 115, 'scooter:wave': 100, 'scooter:click': 117, 'scooter:scoopy': 95, 'scooter:pcx': 132, 'scooter:nmax': 131, 'scooter:aerox': 126,
  pickup: 1900, 'pickup:songthaew': 1850, 'pickup:empty': 1700, 'pickup:boxes': 2000, 'pickup:coconuts': 2300, 'pickup:closed': 1950, foodvan: 1800 };
const VEH_MASS_DEFAULT = 1200;           // кг — машина, которой нет в таблице
const VEH_BOUNCE = 0.35;                 // упругость удара: 0 — слиплись, 1 — разлетелись как бильярдные шары
const VEH_FRICTION = { car: 9, bike: 6 };// м/с² — как быстро останавливается то, что скользит по земле после удара
const parkedVehicles = [];               // всё стоящее: { m, mass, bike, len, wid, cx, fly } — пока стоит, у него есть стены (машина) и «бамперы» для удара
const tossed = [];                       // то, что сейчас летит или скользит
// Поставить на место: машина — четыре стены и твёрдый прямоугольник (на малой скорости в неё упираешься) плюс те же четыре
// отрезка как предметы для удара; скутер — один круглый предмет. Считается по тому, где и как модель стоит сейчас.
function vehPark(P) {
  const m = P.m, w = m.getWorldPosition(new THREE.Vector3()), d = new THREE.Vector3(1, 0, 0).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));
  const l = Math.hypot(d.x, d.z) || 1, ax = d.x / l, az = d.z / l, bump = () => vehBump(P);
  if (P.bike) { P.hits = [addBreakable({ kind: 'scooter', mat: 'metal', x: w.x, z: w.z, r: 0.6, loss: 0, bump })]; P.walls = []; P.solid = null; return; }
  const cx = w.x + ax * P.cx, cz = w.z + az * P.cx, hl = P.len / 2, hw = P.wid / 2;
  const C = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([a, b]) => [cx + ax * a - az * b, cz + az * a + ax * b]);
  P.walls = C.map((p, i) => [p[0], p[1], C[(i + 1) % 4][0], C[(i + 1) % 4][1]]); P.solid = C;
  walls.push(...P.walls); solids.push(P.solid);
  P.hits = P.walls.map((seg) => addBreakable({ kind: 'car', mat: 'metal', seg, loss: 0, bump }));
}
// снять с места: стены и предметы для удара убираются, модель переходит в сцену и дальше движется сама
function vehUnpark(P) {
  for (const q of P.walls) { const i = walls.indexOf(q); if (i >= 0) walls.splice(i, 1); }
  if (P.solid) { const i = solids.indexOf(P.solid); if (i >= 0) solids.splice(i, 1); }
  dropBreakables(P.hits); P.hits = [];
  scene.attach(P.m); P.m.rotation.reorder('YXZ'); tossed.push(P);
}
// Удар машины игрока в стоящую. Стоящая отлетает по закону сохранения импульса: v2 = (1 + e)·m1 / (m1 + m2)·v, упругость
// VEH_BOUNCE: лёгкий скутер улетает далеко, тяжёлый пикап едва сдвигается. Стоящее не разбивается: отлетает, скользит,
// останавливается и снова стоит.
// Машина игрока — не по физике, а «мы доминируем» (задание Влада): останавливается и откатывается назад (carRecoil в
// index.html) на долю m2 / (m1 + m2) отката от стены при той же скорости и прямоте удара, но всегда меньше, чем сдвинется
// стоящая (не больше VEH_RECOIL_SHARE её пути). Даже наш скутер, врезавшись в пикап, откатывается меньше, чем тот сдвигается.
const VEH_RECOIL_SHARE = 0.6;
// сколько пройдёт отлетевшее со скоростью sp (м/с): полёт (как в vehBump) и скольжение с трением (как в updateTossed)
function vehTravel(P, sp) {
  const vy = P.bike ? 1.8 + sp * 0.22 : Math.min(3.5, sp * 0.1), mu = VEH_FRICTION[P.bike ? 'bike' : 'car'];
  return sp * 2 * vy / 16 + Math.max(0, sp * sp - 0.16) / (2 * mu);
}
function vehBump(P) {
  if (P.fly) return;
  const m1 = VEH_MASS[CAR.id] || VEH_MASS_DEFAULT, m2 = P.mass, v = car.speed, e = VEH_BOUNCE;
  const v2 = (1 + e) * m1 / (m1 + m2) * v, sp = Math.abs(v2), sg = v >= 0 ? 1 : -1;
  const fx = -Math.sin(car.course) * sg, fz = -Math.cos(car.course) * sg;                         // куда ехала машина
  const w = P.m.getWorldPosition(new THREE.Vector3()); let tx = w.x - car.x, tz = w.z - car.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
  const c = Math.abs(fx * tx + fz * tz), s2 = vehTravel(P, sp), d1 = Math.min(recoilDist(Math.abs(v), c) * m2 / (m1 + m2), VEH_RECOIL_SHARE * s2);
  const v1 = v * (1 - c) * (1 - c);                                                              // в лоб — стоп; вскользь — почти без потери хода
  let dx = fx * 0.65 + tx * 0.35, dz = fz * 0.65 + tz * 0.35; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;   // удар не по центру — уводит в сторону
  const side = fx * tz - fz * tx;                                                                   // с какой стороны от пути была середина: туда и закрутит
  vehUnpark(P);
  P.fly = { vx: dx * sp, vz: dz * sp, vy: P.bike ? 1.8 + sp * 0.22 : Math.min(3.5, sp * 0.1), wx: P.bike ? (Math.random() < 0.5 ? -1 : 1) * (2 + sp * 0.5) : 0, wz: P.bike ? (Math.random() - 0.5) * 4 : 0,
    wy: side * (P.bike ? 6 : 2.2) * Math.min(1, sp / 8), k: 0 };
  car.speed = v1; car.slip = 0; car.kick = null; carRecoil(-fx, -fz, d1);                         // стоп и откат назад, против хода
  soundShot('carHit', Math.min(1, 0.45 + Math.abs(v) / 25)); if (P.bike) soundShot('pipe', 0.5, 0.05);
  breakLog.push({ kind: P.bike ? 'scooter' : 'car', x: car.x, z: car.z, t: performance.now(), pieces: 0, v0: v, v1, v2, m1, m2, d1, s2 });
  if (breakLog.length > 60) breakLog.shift();
}
// Взрыв в (x, z) радиуса r: стоящие рядом машины и скутеры подлетают и отлетают прочь, кувыркаясь.
function blastParked(x, z, r) {
  const reach = r * 1.6 + 2;
  for (const P of parkedVehicles) {
    const w = P.m.getWorldPosition(new THREE.Vector3()), dx = w.x - x, dz = w.z - z, d = Math.hypot(dx, dz), k = 1 - d / reach;
    if (k < 0.06 || (P.fly && P.fly.k >= k * r)) continue;                 // уже летит от взрыва не слабее этого
    if (!P.fly) vehUnpark(P);
    const light = P.bike ? 1.7 : Math.min(1.4, Math.sqrt(1500 / P.mass));  // лёгкое летит дальше
    const sp = 3.2 * r * k * light, vy = (3 + 2.6 * r * k) * Math.min(1.3, light), T = 2 * vy / 16, n = Math.round(k * 2.2), R = Math.random;   // ближе к середине — выше и с кувырком
    P.fly = { vx: dx / (d || 1) * sp, vz: dz / (d || 1) * sp, vy, wx: (R() < 0.5 ? -1 : 1) * 6.283 * n / T, wz: (R() - 0.5) * 2.4, wy: (R() - 0.5) * 3, k: k * r };
  }
}
// полёт, затем скольжение по земле с трением; остановившись, машина снова твёрдая, скутер остаётся лежать на боку
function updateTossed(dt) {
  for (let i = tossed.length - 1; i >= 0; i--) {
    const P = tossed[i], f = P.fly, m = P.m, y = Math.max(0, surfaceY(m.position.x, m.position.z));
    m.position.x += f.vx * dt; m.position.z += f.vz * dt; m.rotation.y += f.wy * dt;
    if (!f.ground) {
      f.vy -= 16 * dt; m.position.y += f.vy * dt; m.rotation.x += f.wx * dt; m.rotation.z += f.wz * dt;
      if (f.vy < 0 && m.position.y <= y) {                                  // упала: машина встаёт на колёса, скутер ложится на бок
        f.ground = true; m.position.y = y; m.rotation.z = 0; m.rotation.x = P.bike ? (Math.sin(m.rotation.x) >= 0 ? 1.36 : -1.36) : 0;
        if (f.vy < -3) { soundShot('thud', Math.min(0.8, -f.vy / 14)); if (!P.bike) soundShot('carHit', 0.5); }
      }
    } else {
      m.position.y = y;
      const sp = Math.hypot(f.vx, f.vz), ns = Math.max(0, sp - VEH_FRICTION[P.bike ? 'bike' : 'car'] * dt);
      f.vx *= sp ? ns / sp : 0; f.vz *= sp ? ns / sp : 0; f.wy *= Math.exp(-dt * 3);
      if (ns < 0.4) { P.fly = null; tossed.splice(i, 1); vehPark(P); }
    }
  }
}
// Скутер на стоянке: (u, v) — место в группе g, ang — поворот в её осях (0 — носом к +u), y — высота площадки.
// Скутер не твёрдый и не разбивается: от удара отлетает (см. vehBump), на малой скорости в него упираешься.
function parkScooter(g, n, u, v, ang, y = 0) {
  const [kind, paint] = PARK_SCOOTERS[((n % PARK_SCOOTERS.length) + PARK_SCOOTERS.length) % PARK_SCOOTERS.length], V = bakedCarGeo('scooter:' + kind, paint);
  if (!VEH_MAT) VEH_MAT = lambert({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x1c1c1c });
  const m = new THREE.Mesh(V.geo, VEH_MAT);
  m.rotation.y = ang; m.position.set(u, y, -v); g.add(m); g.updateMatrixWorld(true);
  const w = g.localToWorld(new THREE.Vector3(u, y, -v));
  posts.push([w.x, w.z]);
  const P = { m, bike: true, mass: VEH_MASS['scooter:' + kind] || VEH_MASS.scooter, len: V.len, wid: V.wid, cx: 0, fly: null };
  parkedVehicles.push(P); vehPark(P);
  return m;
}
// ряд из n скутеров: первый в (u, v), дальше с шагом (du, dv); seed — с какого вида начать
function scooterRow(g, seed, n, u, v, du, dv, ang, y = 0) {
  for (let i = 0; i < n; i++) parkScooter(g, seed * 7 + i * 5 + (i * i) % 3, u + du * i, v + dv * i, ang + (hash2(seed + i, 17) - 0.5) * 0.3, y);
}

// Поставить машину в группу g: (u, v) — место, dir — куда смотрит нос: 'u+', 'u-', 'v+', 'v-'; y — высота площадки.
// Машина твёрдая, пока в неё не въехали на скорости или рядом не рвануло. Возвращает меш.
function parkVehicle(g, V, u, v, dir, y = 0) {
  if (!VEH_MAT) VEH_MAT = lambert({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x1c1c1c });
  const m = new THREE.Mesh(V.geo, VEH_MAT);
  m.rotation.y = { 'u+': 0, 'u-': Math.PI, 'v+': Math.PI / 2, 'v-': -Math.PI / 2 }[dir];
  m.position.set(u, y, -v); g.add(m); g.updateMatrixWorld(true);
  const P = { m, bike: false, mass: V.mass || VEH_MASS.pickup, len: V.len, wid: V.wid, cx: V.cx || 0, fly: null };
  parkedVehicles.push(P); vehPark(P);
  return m;
}
