// Сенсорное управление — надстройка над обычной игрой (решение Влада): клавиатура работает как раньше, поверх кадра —
// слой с джойстиками и педалями. Машина берёт от двух источников большее (drive() в index.html читает TOUCH).
// Слева, у края — два круглых джойстика:
//   нижний (руль, на нём нарисован руль): влево-вправо — руль, плавно; вверх до упора — малый ход вперёд (как на первой
//     передаче: разгон до ~30 км/ч), вниз до упора — малый ход назад; у середины мёртвая зона, чтобы большой палец,
//     гуляя при руле, не включал малый ход сам;
//   верхний (обзор, на нём глаз): повернуть камеру вокруг машины и поднять или опустить взгляд; отпустил — камера
//     плавно возвращается за машину. На компьютере то же самое — правой кнопкой мыши (в конце файла).
// Справа, у края — две педали одного размера: газ сверху, ручник под ним (раскладка Влада). Тормоз и задний ход —
// джойстиком руля вниз. Приборы игры (карта, спидометр, радио, выбор машины) остаются на своих местах.
// Всё нарисовано по точкам игры (просил Влад): отдельный холст 480 × 270 растянут без сглаживания, как кадр; надписи —
// пиксельным шрифтом приборов. Касания ловят невидимые области ровно над нарисованным.
// TOUCH_UI — есть ли слой вообще. Показан ли он — переключатель TOUCH на поле страницы снизу слева (просил Влад):
// по умолчанию на компьютере выключен, на телефоне включён (иначе нечем рулить); выбор запоминается в браузере.
const TOUCH_UI = true;
function touchPref() { try { const v = localStorage.getItem('samui.touch'); if (v !== null) return v === '1'; } catch (e) {} return typeof COARSE !== 'undefined' && COARSE; }
function touchSet(on) { touchShow(on); try { localStorage.setItem('samui.touch', on ? '1' : '0'); } catch (e) {} const t = document.getElementById('touchToggle'); if (t) t.classList.toggle('on', on); }
const TOUCH = { steer: 0, gas: 0, brake: 0, hand: false, crawl: 0, lookX: 0, lookY: 0, lookSpin: 0, el: null };   // lookSpin: −1/0/+1 — камера медленно кружит (обзор дожат до края)
const TOUCH_DEAD = 0.08, TOUCH_CRAWL = 0.6;   // мёртвая зона руля; на сколько хода вверх/вниз включается малый ход
// где что лежит, в точках игры: левый верхний угол и размер (джойстик — диаметр); отступ от края кадра — 5 точек
const TOUCH_AT = { look: [5, 43, 54], stick: [5, 112, 80], gas: [431, 50, 44, 72], hand: [431, 130, 44, 72] };
const TOUCH_COL = { fill: 'rgba(255,255,255,0.14)', ring: 'rgba(255,255,255,0.45)', fillOn: 'rgba(255,255,255,0.32)', ringOn: 'rgba(255,255,255,0.85)',
  knob: 'rgba(255,255,255,0.28)', knobRing: 'rgba(255,255,255,0.7)', mark: 'rgba(255,255,255,0.4)', icon: 'rgba(255,255,255,0.8)', text: 'rgba(255,255,255,0.85)' };   // всё белое полупрозрачное (просил Влад)

function touchShow(on) {                      // спрятать или показать весь слой; спрятанный — ничего не нажато
  if (!TOUCH.el) return;
  TOUCH.el.hidden = !on;
  if (!on) Object.assign(TOUCH, { steer: 0, gas: 0, brake: 0, hand: false, crawl: 0, lookX: 0, lookY: 0 });
}
function touchInit() {
  if (TOUCH.el) return;
  const css = document.createElement('style');
  css.textContent = `
  #touch { position: absolute; inset: 0; pointer-events: none; user-select: none; -webkit-user-select: none; }
  #touch[hidden] { display: none; }
  #touch canvas { position: absolute; inset: 0; margin: auto; image-rendering: pixelated; image-rendering: crisp-edges; pointer-events: none; }
  #touch.under .t { pointer-events: none; }
  #touch .t { position: absolute; pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent; }
  #touch .t.round { border-radius: 50%; }`;
  document.head.appendChild(css);
  // слой лежит между кадром игры и холстом приборов: меню выбора машины и меню радио, нарисованные на холсте приборов,
  // оказываются поверх джойстиков и педалей; пока меню открыто, слой не ловит касания (они идут в меню)
  const root = TOUCH.el = document.createElement('div'); root.id = 'touch';
  document.getElementById('flare').before(root);
  const cv = TOUCH.cv = document.createElement('canvas'); cv.width = RES_W; cv.height = RES_H; root.appendChild(cv);
  TOUCH.g = cv.getContext('2d');
  const watch = () => {
    const menu = (typeof radio !== 'undefined' && radio.menuOpen) || (typeof CAR_PICK !== 'undefined' && CAR_PICK.open) || (typeof TELE !== 'undefined' && TELE.open);
    if (menu !== root.classList.contains('under')) { root.classList.toggle('under', menu); if (menu) { for (const el of Object.values(TOUCH.parts || {})) el.reset && el.reset(); Object.assign(TOUCH, { steer: 0, gas: 0, brake: 0, hand: false, crawl: 0, lookX: 0, lookY: 0, lookSpin: 0 }); } }
    touchDraw();
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
  const add = (cls) => { const d = document.createElement('div'); d.className = 't ' + cls; root.appendChild(d); return d; };
  // джойстик: палец ведёт ручку; on(dx, dy) получает её смещение −1…1 (вправо и вниз — плюс); отпустил — ручка в центре
  const joystick = (cls, on) => {
    const base = add('round ' + cls); base.kx = base.ky = 0;
    let id = null;
    const move = (e) => {
      const r = base.getBoundingClientRect(), R = r.width / 2;
      let dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      base.kx = dx; base.ky = dy;
      on(dx, dy, base);
    };
    base.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); id = e.pointerId; base.setPointerCapture(id); move(e); touchWake(); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === id) { e.stopPropagation(); move(e); } });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) base.addEventListener(ev, (e) => { if (e.pointerId === id) { id = null; base.kx = base.ky = 0; base.on = false; on(0, 0, base); } });
    base.reset = () => { if (id !== null && base.hasPointerCapture(id)) base.releasePointerCapture(id); id = null; base.kx = base.ky = 0; base.on = false; on(0, 0, base); };
    return base;
  };
  const stick = joystick('stick', (dx, dy, base) => {
    TOUCH.steer = Math.abs(dx) < TOUCH_DEAD ? 0 : -Math.sign(dx) * (Math.abs(dx) - TOUCH_DEAD) / (1 - TOUCH_DEAD);   // + — влево, как у клавиш
    TOUCH.crawl = Math.abs(dy) > TOUCH_CRAWL && Math.abs(dy) > Math.abs(dx) ? -Math.sign(dy) : 0;                     // вверх — вперёд
    base.on = TOUCH.crawl !== 0;
  });
  const look = joystick('look', (dx, dy) => { TOUCH.lookX = dx; TOUCH.lookY = dy; TOUCH.lookSpin = Math.abs(dx) > 0.93 ? Math.sign(dx) : 0; });   // дожал до края — кружит
  const gas = add('gas'), hand = add('hand');
  TOUCH.parts = { stick, look, gas, hand };
  // педали: пока держишь — нажато (несколько пальцев сразу — можно)
  const hold = (el, on, off) => {
    let id = null;
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); id = e.pointerId; el.setPointerCapture(id); el.on = true; on(); touchWake(); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, (e) => { if (e.pointerId === id) { id = null; el.on = false; off(); } });
    el.reset = () => { if (id !== null && el.hasPointerCapture(id)) el.releasePointerCapture(id); id = null; el.on = false; off(); };
  };
  hold(gas, () => { TOUCH.gas = 1; }, () => { TOUCH.gas = 0; });
  hold(hand, () => { TOUCH.hand = true; }, () => { TOUCH.hand = false; });
  for (const el of Object.values(TOUCH.parts)) el.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('resize', touchLayout); touchLayout();
  addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') touchWake(); });          // жест для браузера — отпускание пальца
  touchShow(TOUCH_UI && touchPref());
  { const t = document.getElementById('touchToggle'); if (t) { t.classList.toggle('on', !TOUCH.el.hidden); t.addEventListener('click', () => touchSet(TOUCH.el.hidden)); } }
}
// первое касание включает звук и музыку, как первое нажатие клавиши
// и на телефоне — во весь экран, горизонтально (Android; iPhone так не умеет — там «На экран Домой», manifest.json)
function touchWake() {
  if (typeof startMusic === 'function') startMusic(); if (typeof soundStart === 'function') soundStart();
  const d = document.documentElement;
  if (typeof COARSE !== 'undefined' && COARSE && !TOUCH.fs && !document.fullscreenElement && d.requestFullscreen) {   // (один раз: вышел сам — не тащим обратно)
    TOUCH.fs = true;
    d.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => { TOUCH.fs = false; });
  }
}
// холст слоя — того же размера на экране, что кадр; невидимые области касаний — ровно над нарисованным (TOUCH_AT)
function touchLayout() {
  const P = TOUCH.parts; if (!P) return;
  const fl = document.getElementById('flare');
  Object.assign(TOUCH.cv.style, { width: fl.style.width, height: fl.style.height });
  const r = fl.getBoundingClientRect(), s = r.height / RES_H;
  for (const [k, [x, y, w, h = w]] of Object.entries(TOUCH_AT))
    Object.assign(P[k].style, { left: r.left + x * s + 'px', top: r.top + y * s + 'px', width: w * s + 'px', height: h * s + 'px' });
}
// рисунок слоя по точкам; перерисовывается, только когда что-то сдвинулось или нажалось
function touchDraw() {
  const P = TOUCH.parts; if (!P || TOUCH.el.hidden) return;
  const key = [P.look.kx, P.look.ky, P.stick.kx, P.stick.ky, P.stick.on, P.gas.on, P.hand.on].join();
  if (key === TOUCH.drawn) return;
  TOUCH.drawn = key;
  const g = TOUCH.g, C = TOUCH_COL; g.clearRect(0, 0, RES_W, RES_H);
  // фигура по точкам: в каждой точке рамки (x0, y0, w, h) col(u, v) — цвет или ничего; u, v — от середины рамки до
  // середины точки
  const shape = (x0, y0, w, h, col) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = col(x + 0.5 - w / 2, y + 0.5 - h / 2); if (c) { g.fillStyle = c; g.fillRect(x0 + x, y0 + y, 1, 1); } }
  };
  const disc = (x0, y0, d, fill, ring) => shape(x0, y0, d, d, (u, v) => { const l = Math.hypot(u, v) - d / 2; return l > 0 ? null : l > -1 ? ring : fill; });
  const ICON = {
    wheel: (u, v, R) => { const l = Math.hypot(u, v);                     // руль: обод, ступица, три спицы
      return (l <= R && l > R - 1.6) || l <= R * 0.26 || (Math.abs(v + R * 0.07) < 0.8 && Math.abs(u) < R) || (Math.abs(u) < 0.8 && v > 0 && v < R); },
    eye: (u, v, R) => { const t = u / R, edge = 0.62 * R * (1 - t * t), t2 = u / (R - 1.4), in2 = Math.abs(t2) < 1 && Math.abs(v) < 0.62 * (R - 1.4) * (1 - t2 * t2) - 0.9;
      return (Math.abs(t) <= 1 && Math.abs(v) <= edge && !in2) || Math.hypot(u, v) <= R * 0.3; },   // глаз: веко и зрачок
  };
  const stickDraw = (el, [x, y, d], icon, ticks) => {
    disc(x, y, d, el.on ? C.fillOn : C.fill, el.on ? C.ringOn : C.ring);
    if (ticks) for (const ty of [Math.round(d * 0.2), Math.round(d * 0.8) - 1]) { g.fillStyle = C.mark; g.fillRect(x + Math.round(d * 0.41), y + ty, Math.round(d * 0.18), 1); }   // метки «малый ход»
    const kd = Math.round(d * 0.42), kx = x + Math.round((d - kd) / 2 + el.kx * d / 2), ky = y + Math.round((d - kd) / 2 + el.ky * d / 2), R = kd * 0.36;
    disc(kx, ky, kd, C.knob, C.knobRing);
    shape(kx, ky, kd, kd, (u, v) => ICON[icon](u, v, R) ? C.icon : null);
  };
  stickDraw(P.look, TOUCH_AT.look, 'eye', false);
  stickDraw(P.stick, TOUCH_AT.stick, 'wheel', true);
  // педаль: площадка со скруглёнными углами, рифли сверху и снизу, посередине подпись пиксельным шрифтом приборов
  const pedalDraw = (el, [x, y, w, h], text) => {
    const rr = 6, inside = (u, v, k) => { const ax = Math.abs(u) - (w / 2 - k - rr), ay = Math.abs(v) - (h / 2 - k - rr);
      return ax <= 0 || ay <= 0 ? ax <= rr && ay <= rr : Math.hypot(ax, ay) <= rr; };
    shape(x, y, w, h, (u, v) => !inside(u, v, 0) ? null : inside(u, v, 1) ? (el.on ? C.fillOn : C.fill) : (el.on ? C.ringOn : C.ring));
    const cy = y + h / 2, rw = Math.round(w * 0.62);
    g.fillStyle = C.mark;
    for (let k = 0; k < 4; k++) for (const sg of [-1, 1]) g.fillRect(x + (w - rw) / 2, Math.round(cy + sg * (8 + k * 6) - (sg < 0 ? 2 : 0)), rw, 2);
    const t = hudText(text);
    hudGlyphs(t, x + Math.round((w - hudWidth(t)) / 2), Math.round(cy - 2.5), el.on ? HUD_WHITE : C.text, false, g);
  };
  pedalDraw(P.gas, TOUCH_AT.gas, 'GAS');
  pedalDraw(P.hand, TOUCH_AT.hand, 'HANDBRAKE');
}
addEventListener('load', touchInit);
// На компьютере тот же обзор — правой кнопкой мыши: зажал и ведёшь (вбок — камера обходит машину, вверх-вниз — выше
// или ниже), отпустил — камера возвращается за машину. Ход на треть экрана — до упора, как у джойстика с глазом; дальше
// упора — камера медленно кружит вокруг машины, пока держишь (как джойстик, дожатый до края).
{
  let from = null;
  addEventListener('pointerdown', (e) => { if (e.button === 2 && e.pointerType === 'mouse') { from = [e.clientX, e.clientY]; e.preventDefault(); } });
  addEventListener('pointermove', (e) => {
    if (!from) return;
    const x = (e.clientX - from[0]) / (innerWidth * 0.33);
    TOUCH.lookX = Math.max(-1, Math.min(1, x)); TOUCH.lookSpin = Math.abs(x) > 1.1 ? Math.sign(x) : 0;   // увёл дальше упора — камера кружит
    TOUCH.lookY = Math.max(-1, Math.min(1, (e.clientY - from[1]) / (innerHeight * 0.33)));
  });
  const stop = () => { if (from) { from = null; TOUCH.lookX = 0; TOUCH.lookY = 0; TOUCH.lookSpin = 0; } };
  addEventListener('pointerup', (e) => { if (e.button === 2) stop(); });
  addEventListener('blur', stop);
  addEventListener('contextmenu', (e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); });   // меню браузера по правой кнопке не всплывает (в полях ввода — как обычно)
}
