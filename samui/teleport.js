// Окно телепортов (просил Влад): открывается круглой кнопкой с булавкой между мини-картой и спидометром (TELE_BTN в
// index.html). Нарисовано в кадре пиксельным шрифтом приборов, всё по-английски. Слева — группы, справа — места выбранной
// группы; у SHOPPING вместо мест — подпапки (ночные и дневные рынки, 7-Eleven, каннабис, MR DIY, заправки). Щелчок по
// месту — переход туда, окно закрывается; Esc, крестик или щелчок мимо — закрыть.
// Места — те же PLACES (index.html, названия внутри — русские, для кода и снимков); здесь у каждого английская подпись.
// Плюс переходы в центры посёлков, у которых своей точки нет (по refs/TOWNS_PLAN.md: лавки у дороги и переход в центр).
// Файл только объявляет; дерево групп собирается при первом открытии окна, когда все места уже на месте.

const TELE = { open: false, group: 0, sub: null, hover: null, tree: null };
// районы в названиях магазинов, рынков, заправок (как их пишут сборщик и stores.js)
const TELE_AREA = { 'БАН ТАЙ': 'BAN TAI', 'МАЕНАМ': 'MAENAM', 'ПЛАЙ ЛАЕМ': 'PLAI LAEM', 'БОПХУТ': 'BOPHUT', 'РАЙОН АЭРОПОРТА': 'AIRPORT AREA',
  'ЧАВЕНГ': 'CHAWENG', 'НАТОН': 'NATHON', 'ЛАНГ': 'LANG', 'ЛИПА НОЙ': 'LIPA NOI', 'ТАЛИНГ НГАМ': 'TALING NGAM', 'ЛАМАЙ': 'LAMAI',
  'НА МУАНГ': 'NA MUANG', 'ХУА ТАНОН': 'HUA THANON', 'БАНГ КАО': 'BANG KAO' };
// английские подписи остальных мест
const TELE_EN = {
  'СТАРТ': 'START', 'ФЕРМА КАННАБИСА': 'CANNABIS FARM', 'ПЛАНТАЦИЯ': 'PLANTATION', 'ДОРОГА НА КАО ПОМ': 'KHAO POM ROAD',
  'ХИН ТА И ХИН ЯЙ': 'HIN TA & HIN YAI', 'СМОТРОВАЯ ЛАД КО': 'LAD KOH VIEWPOINT', 'ВЕРШИНА КАО ПОМ': 'KHAO POM SUMMIT',
  'ПЛЯЖ ЧАВЕНГ': 'CHAWENG', 'ПЛЯЖ ЛАМАЙ': 'LAMAI', 'ПЛЯЖ ЧОНГ МОН': 'CHOENG MON', 'ПЛЯЖ СИЛВЕР': 'SILVER BEACH', 'ПЛЯЖ БОПХУТ': 'BOPHUT', 'ПЛЯЖ МАЕНАМ': 'MAENAM',
  'ЛАВКИ LAMAI': 'LAMAI STALLS', 'ОЗЕРО ЧАВЕНГ': 'CHAWENG LAKE', 'РИНГ ЛАМАЙ': 'LAMAI MUAY THAI', 'СМОТРОВАЯ ЛАМАЙ': 'LAMAI VIEW POINT', 'ВАТ ЛАМАЙ': 'WAT LAMAI',
  'НАТОН': 'NATHON', 'РЫБАЦКАЯ ДЕРЕВНЯ': "FISHERMAN'S VILLAGE", 'ХУА ТАНОН': 'HUA THANON', 'ЧАЙНАТАУН МАЕНАМ': 'MAENAM CHINATOWN',
  'БОЛЬШОЙ БУДДА': 'BIG BUDDHA', 'ВАТ ПЛАЙ ЛАЕМ': 'WAT PLAI LAEM', 'ВАТ КХУНАРАМ': 'WAT KHUNARAM', 'ВАТ НА ПХРА ЛАН': 'WAT NA PHRA LAN',
  'ПАГОДА КХАО ХУА ДЖУК': 'KHAO HUA JOOK PAGODA', 'ПАГОДА ЛАЕМ СОР': 'LAEM SOR PAGODA', 'КИТАЙСКИЙ ХРАМ МАЕНАМ': 'MAENAM CHINESE TEMPLE',
  'ВОДОПАД НА МУАНГ 1': 'NA MUANG WATERFALL 1', 'ВОДОПАД НА МУАНГ 2': 'NA MUANG WATERFALL 2', 'ВОДОПАД ХИН ЛАД': 'HIN LAD WATERFALL',
  'АЭРОПОРТ': 'AIRPORT', 'ТЕРМИНАЛ': 'TERMINAL', 'АНГАР': 'HANGAR', 'ПОЛОСА': 'RUNWAY', 'ТОПЛИВНАЯ КОЛОНКА': 'FUEL PUMP',
  'ПИРС НАТОН': 'NATHON PIER', 'ПИРС SEATRAN': 'SEATRAN PIER', 'ПИРС ЛИПА НОЙ': 'LIPA NOI PIER', 'ПИРС БАНГРАК': 'BANG RAK PIER',
  'ПИРС МАЕНАМ': 'MAENAM PIER', 'ПИРС БОПХУТ': 'BOPHUT PIER', 'ПИРС ТОНГ КРУТ': 'THONG KRUT PIER',
  'ЛОКАТОР 1': 'RADAR 1', 'ЛОКАТОР 2': 'RADAR 2', 'ПОЖАРНАЯ ЧАВЕНГ': 'FIRE STATION CHAWENG', 'ПОЖАРНАЯ НАТОН': 'FIRE STATION NATHON',
  'ПЛЯЖ ЧАВЕНГ НОЙ': 'CHAWENG NOI', 'ПЛЯЖ КОРАЛ КОВ': 'CORAL COVE', 'ПЛЯЖ БАНГ КАО': 'BANG KAO', 'ВОРОТА СО СЛОНАМИ': 'ELEPHANT GATE',
  'ТОНГ КРУТ РЕСТОРАНЫ': 'THONG KRUT SEAFOOD', 'БАР БАНГРАК': 'BANG RAK BEACH BAR', 'БОЛЬНИЦА': 'BANGKOK HOSPITAL',
  'ОТЕЛЬ ДЖИНТА': 'JINTA HOTEL', 'БУНГАЛО ЛОЛИТА': 'LOLITA BUNGALOW', 'БХУНДАРИ РЕЗИДЕНС': 'BHUNDHARI RESIDENCE',
};
// на всякий случай: русских букв в окне не бывает — незнакомое название пишется латиницей
const TELE_LAT = { А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'E', Ж: 'ZH', З: 'Z', И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S',
  Т: 'T', У: 'U', Ф: 'F', Х: 'KH', Ц: 'TS', Ч: 'CH', Ш: 'SH', Щ: 'SHCH', Ъ: '', Ы: 'Y', Ь: '', Э: 'E', Ю: 'YU', Я: 'YA' };
const teleLatin = (s) => [...s.toUpperCase()].map(c => TELE_LAT[c] ?? c).join('');
function teleArea(s) { return TELE_AREA[s] || teleLatin(s); }
// место -> английская подпись внутри своей группы
function teleLabel(name) {
  if (TELE_EN[name]) return TELE_EN[name];
  let m;
  if ((m = name.match(/^НОЧНОЙ РЫНОК (.+)$/)) || (m = name.match(/^РЫНОК (.+)$/))) return teleArea(m[1]);
  if ((m = name.match(/^(?:КАННАБИС|MR DIY|7-ELEVEN) (.+?)( \d+)?$/))) return teleArea(m[1]) + (m[2] || '');
  if ((m = name.match(/^ЗАПРАВКА (.+) ([A-Z]+)$/))) return teleArea(m[1]) + ' ' + m[2];
  return teleLatin(name);
}
// переход в центр посёлка: ближайшая к точке (x, z) дорога, носом вдоль неё
function teleOnRoad(x, z) {
  let best = null;
  roads.forEach((R, r) => { const q = roadProj(r, x, z); if (!q) return; const p = roadPoint(R, q.s, 0), d = Math.hypot(p[0] - x, p[1] - z); if (!best || d < best[0]) best = [d, p]; });
  return best ? { x: best[1][0], z: best[1][1], heading: Math.atan2(-best[1][2], -best[1][3]) } : null;
}
function teleTree() {
  const byName = new Map(PLACES.map(p => [p.name, p])), used = new Set();
  const item = (p) => { used.add(p); return { label: teleLabel(p.name), p }; };
  const pick = (names) => names.map(n => byName.get(n)).filter(Boolean).map(item);
  const match = (re) => PLACES.filter(p => re.test(p.name) && !used.has(p)).map(item);
  const village = (name) => { const v = (IS.places || []).find(q => q.name === name); return v ? [v.x, v.z] : null; };
  // (если от точки посёлка дорога далеко — переход к его 7-Eleven)
  const centre = (label, at, alt) => { const p = (at && teleOnRoad(at[0], at[1])) || (alt && teleOnRoad(alt[0], alt[1])); return p ? { label, p: Object.assign({ name: label }, p) } : null; };
  const near = (name) => { const p = byName.get(name); return p ? [p.x, p.z] : null; };
  const towns = [
    byName.get('НАТОН') && item(byName.get('НАТОН')), centre('LIPA NOI', village('Baan Lipa Noi')), centre('TALING NGAM', village('Baan Taling Ngam'), near('7-ELEVEN ТАЛИНГ НГАМ')),
    centre('THONG KRUT', village('Baan Thong Krut'), near('ПИРС ТОНГ КРУТ')), centre('BANG KAO', village('Ban Bang Khao'), near('7-ELEVEN БАНГ КАО')), byName.get('ХУА ТАНОН') && item(byName.get('ХУА ТАНОН')),
    centre('LAMAI', [-1210, 1685]), centre('NA MUANG', near('7-ELEVEN НА МУАНГ 1')), centre('BAN TAI', village('Baan Tai'), near('7-ELEVEN БАН ТАЙ 1')),
    centre('CHAWENG', [1070, 2142]), centre('BANG RAK', village('Baan Bang Rak')),
    byName.get('РЫБАЦКАЯ ДЕРЕВНЯ') && item(byName.get('РЫБАЦКАЯ ДЕРЕВНЯ')), byName.get('ЧАЙНАТАУН МАЕНАМ') && item(byName.get('ЧАЙНАТАУН МАЕНАМ')),
  ].filter(Boolean);
  const groups = [
    { title: 'TOWNS', items: towns },
    { title: 'SIGHTS', items: pick(['CENTRAL FESTIVAL', 'SOI GREEN MANGO', 'ОЗЕРО ЧАВЕНГ', 'РИНГ ЛАМАЙ', 'СМОТРОВАЯ ЛАМАЙ', 'БОЛЬШОЙ БУДДА', 'ВАТ ПЛАЙ ЛАЕМ', 'ВАТ КХУНАРАМ', 'ВАТ НА ПХРА ЛАН', 'ВАТ ЛАМАЙ', 'ВОРОТА СО СЛОНАМИ', 'ТОНГ КРУТ РЕСТОРАНЫ', 'ПАГОДА КХАО ХУА ДЖУК', 'ПАГОДА ЛАЕМ СОР', 'КИТАЙСКИЙ ХРАМ МАЕНАМ',
      'ХИН ТА И ХИН ЯЙ', 'СМОТРОВАЯ ЛАД КО', 'ВЕРШИНА КАО ПОМ', 'ВОДОПАД НА МУАНГ 1', 'ВОДОПАД НА МУАНГ 2', 'ВОДОПАД ХИН ЛАД']) },
    { title: 'BEACHES', items: pick(['ПЛЯЖ ЧАВЕНГ', 'ПЛЯЖ ЛАМАЙ', 'ПЛЯЖ ЧОНГ МОН', 'ПЛЯЖ СИЛВЕР', 'ПЛЯЖ БОПХУТ', 'ПЛЯЖ МАЕНАМ', 'ПЛЯЖ ЧАВЕНГ НОЙ', 'ПЛЯЖ КОРАЛ КОВ', 'ПЛЯЖ БАНГ КАО']).concat(match(/^ПЛЯЖ /)) },
    { title: 'SHOPPING', subs: [
      { title: 'MALLS', items: pick(['CENTRAL FESTIVAL', 'BIG C']) },                       // (Central Festival — и в SIGHTS)
      { title: 'SPECIAL SHOPS', items: pick(['NATHON GUITAR SHOP', 'ROCKESTRA MUSIC', 'SAMUI GUITAR SHOP', 'ARMANI RICHY TAILOR', 'ROYAL FASHION TAILOR', 'HOME ART TATTOO', 'STARCAT TATTOO', 'KITE SHOP', 'MOTORBIKE RENTAL', 'HARLEY RENTAL']) },   // specialshops.js
      { title: 'NIGHT MARKETS', items: match(/^НОЧНОЙ РЫНОК /) },
      { title: 'MARKETS', items: match(/^(РЫНОК |ЛАВКИ )/) },
      { title: '7-ELEVEN', items: match(/^7-ELEVEN /) },
      { title: 'CANNABIS', items: match(/^КАННАБИС /) },
      { title: 'MR DIY', items: match(/^MR DIY /) },
      { title: 'GAS STATIONS', items: match(/^ЗАПРАВКА /) },
    ].filter(s => s.items.length).map(s => (s.items.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })), s)) },   // магазины — по алфавиту районов
    { title: 'PIERS & AIRPORT', items: pick(['АЭРОПОРТ', 'ТЕРМИНАЛ', 'АНГАР', 'ПОЛОСА', 'ТОПЛИВНАЯ КОЛОНКА']).concat(match(/^ПИРС /)) },
    { title: 'HOTELS & RESIDENCES', items: pick(['ОТЕЛЬ ДЖИНТА', 'БУНГАЛО ЛОЛИТА', 'БХУНДАРИ РЕЗИДЕНС']).concat(match(/^(ОТЕЛЬ |БУНГАЛО )/)) },
  ];
  groups.push({ title: 'OTHER', items: PLACES.filter(p => !used.has(p)).map(item) });              // всё, что не попало никуда
  return groups;
}

// ---------- окно ----------
const TELE_UI = { W: 300, H: 206, row: 9, gRow: 12, left: 96 };
function teleRects() {
  const U = TELE_UI, x = Math.round((RES_W - U.W) / 2), y = 30;
  return { x, y, w: U.W, h: U.H, close: { x: x + U.W - 14, y: y + 4, w: 9, h: 9 }, gx: x + 6, gy: y + 22, ix: x + U.left + 6, iy: y + 22, iw: U.W - U.left - 12 };
}
// что сейчас справа: места или подпапки; при многих — в две колонки
function teleList() {
  const G = TELE.tree[TELE.group];
  if (G.subs && TELE.sub === null) return { rows: G.subs.map((s, i) => ({ label: s.title, count: s.items.length, sub: i })), back: false };
  const items = G.subs ? G.subs[TELE.sub].items : G.items;
  return { rows: items.map(it => ({ label: it.label, p: it.p })), back: !!G.subs, title: G.subs ? G.subs[TELE.sub].title : null };
}
function teleLayout() {
  const R = teleRects(), L = teleList(), top = R.iy + (L.back ? TELE_UI.row + 3 : 0), fit = Math.floor((R.y + R.h - 6 - top) / TELE_UI.row);
  const cols = L.rows.length > fit ? 2 : 1, cw = Math.floor(R.iw / cols);
  return { R, L, top, fit, cols, cw, cell: (i) => ({ x: R.ix + Math.floor(i / fit) * cw, y: top + (i % fit) * TELE_UI.row, w: cw - 2, h: TELE_UI.row }) };
}
// что под указателем: { kind: 'close' | 'group' | 'back' | 'row' | 'panel', i } или null (мимо окна)
function teleHit(x, y) {
  if (!TELE.open || !TELE.tree) return null;
  const Y = teleLayout(), R = Y.R;
  if (!inRect(R, x, y)) return null;
  if (inRect(R.close, x, y)) return { kind: 'close' };
  if (inRect(Object.assign({}, teleCredits(), { w: 30, h: 9 }), x, y - 2)) return { kind: 'credits' };
  for (let i = 0; i < TELE.tree.length; i++) if (inRect({ x: R.gx - 2, y: R.gy + i * TELE_UI.gRow - 2, w: TELE_UI.left - 6, h: TELE_UI.gRow - 1 }, x, y)) return { kind: 'group', i };
  if (Y.L.back && inRect({ x: R.ix - 2, y: R.iy - 2, w: R.iw, h: TELE_UI.row }, x, y)) return { kind: 'back' };
  for (let i = 0; i < Y.L.rows.length; i++) { const c = Y.cell(i); if (inRect({ x: c.x - 2, y: c.y - 2, w: c.w, h: c.h }, x, y)) return { kind: 'row', i }; }
  return { kind: 'panel' };
}
const teleCredits = () => { const R = teleRects(); return { x: R.gx, y: R.y + R.h - 12 }; };
function teleToggle(open = !TELE.open) {
  TELE.open = open; TELE.hover = null;
  if (open && !TELE.tree) TELE.tree = teleTree();
}
function drawTele() {
  if (!TELE.open) return;
  const g = fx2d, C = MENU_COL, Y = teleLayout(), R = Y.R, H = TELE.hover, U = TELE_UI;
  g.fillStyle = C.panel; g.fillRect(R.x, R.y, R.w, R.h);
  g.fillStyle = C.edge; g.fillRect(R.x, R.y, R.w, 1); g.fillRect(R.x, R.y + R.h - 1, R.w, 1); g.fillRect(R.x, R.y, 1, R.h); g.fillRect(R.x + R.w - 1, R.y, 1, R.h);
  g.fillRect(R.x + U.left, R.y + 17, 1, R.h - 21);                                                 // черта между группами и местами
  g.fillStyle = HUD_WHITE; TELE_BTN.pin.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') g.fillRect(R.x + 7 + x, R.y + 4 + y, 1, 1); }));
  hudGlyphs(hudText('TELEPORT'), R.x + 18, R.y + 7, HUD_WHITE, false);
  { const c = R.close, on = H && H.kind === 'close'; g.fillStyle = on ? '#3a4a60' : C.ghost; g.fillRect(c.x, c.y, c.w, c.h); hudGlyphs(hudText('X'), c.x + 3, c.y + 2, on ? HUD_YELLOW : HUD_WHITE, false); }
  TELE.tree.forEach((G, i) => {                                                                  // группы
    const y = R.gy + i * U.gRow, sel = i === TELE.group, hov = H && H.kind === 'group' && H.i === i;
    if (sel || hov) { g.fillStyle = sel ? C.on : C.hover; g.fillRect(R.gx - 2, y - 3, U.left - 6, U.gRow - 1); }
    hudGlyphs(hudFit(hudText(G.title), U.left - 10), R.gx, y, sel ? C.gold : hov ? HUD_YELLOW : HUD_WHITE, false);
  });
  { const c = teleCredits(), hov = H && H.kind === 'credits';                                   // авторы записей и данных (credits.html)
    hudGlyphs(hudText('CREDITS'), c.x, c.y, hov ? HUD_YELLOW : MENU_COL.grey, false); }
  if (Y.L.back) {                                                                                // в подпапке: строка «назад»
    const hov = H && H.kind === 'back';
    if (hov) { g.fillStyle = C.hover; g.fillRect(R.ix - 2, R.iy - 2, R.iw, U.row); }
    hudGlyphs(hudFit(hudText('< ' + Y.L.title), R.iw - 4), R.ix, R.iy, hov ? HUD_YELLOW : C.gold, false);
  }
  Y.L.rows.forEach((row, i) => {
    const c = Y.cell(i), hov = H && H.kind === 'row' && H.i === i;
    if (hov) { g.fillStyle = C.hover; g.fillRect(c.x - 2, c.y - 2, c.w, c.h); }
    if (row.sub !== undefined) {                                                                  // подпапка: название, число мест, стрелка
      const n = hudText(String(row.count));
      hudGlyphs(hudFit(hudText(row.label), c.w - 26), c.x, c.y, hov ? HUD_YELLOW : HUD_WHITE, false);
      hudGlyphs(n, c.x + c.w - 12 - hudWidth(n), c.y, C.grey, false); hudGlyphs(hudText('>'), c.x + c.w - 8, c.y, hov ? HUD_YELLOW : C.grey, false);
    } else hudGlyphs(hudFit(hudText(row.label), c.w - 4), c.x, c.y, hov ? HUD_YELLOW : HUD_WHITE, false);
  });
}
addEventListener('pointerdown', (e) => {
  if (!TELE.open || radio.menuOpen || e.button !== 0) return;                                    // правая кнопка мыши — обзор, окна не касается
  const [x, y] = clockAt(e), h = teleHit(x, y);
  if (teleBtnHit(x, y)) return;                                                                  // кнопка сама откроет / закроет
  if (!h) { teleToggle(false); return; }                                                         // мимо окна — закрыть
  if (h.kind === 'close') teleToggle(false);
  else if (h.kind === 'credits') window.open('credits.html', '_blank');
  else if (h.kind === 'group') { TELE.group = h.i; TELE.sub = null; }
  else if (h.kind === 'back') TELE.sub = null;
  else if (h.kind === 'row') { const row = teleList().rows[h.i]; if (row.sub !== undefined) TELE.sub = row.sub; else { teleport(row.p); teleToggle(false); } }
  TELE.hover = teleHit(x, y);
});
addEventListener('pointermove', (e) => { if (TELE.open) TELE.hover = teleHit(...clockAt(e)); });
addEventListener('keydown', (e) => { if (e.code === 'Escape' && TELE.open) teleToggle(false); });
