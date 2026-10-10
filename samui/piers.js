// Пирсы Самуи — шесть настоящих причалов по обмерам из refs/pier_* (размеры, цвета и азимуты — из notes.md).
// Где стоит каждый пирс, куда смотрит и где к нему подходит дорога, решает сборщик острова
// (island_src/build_island.py -> ISLAND.piers, ISLAND.pads): он же подводит асфальт и ровняет землю.
// Плановые размеры взяты в масштабе острова (÷3), высоты и ширины — настоящие, чтобы машина ездила по широким
// настилам. Файл подключается до основного скрипта и только объявляет функции; buildPiers() зовётся из игры,
// когда готовы scene, рельеф и стены. По настилам можно ехать: pierYAt(x, z) встроен в surfaceY, с края — падение в воду.
//
// Оси объекта пирса: u — от берега в море (по азимуту из notes), v — влево от u, если смотреть в море.

const PIER_SCALE = 3;                    // плановые метры настоящие -> игровые
const pierPlates = [];                   // проезжие плиты: { cx, cz, ux, uz, hu, hv, hv1, y0, y1, r, ramp }: полуширина hv у ближнего по u края и hv1 у дальнего, высоты y0 и y1
const pierDecor = [];                    // (t) => {} — мигание маяка и прочее
const pierLights = [];                   // лампочки судов: { m, period, ph } — мигают только ночью
let pierGroups = null;                   // группы пирсов (для видимости вдали)

// широта/долгота -> игровые координаты (как в island_src/geo.py)
function pierXZ(lat, lon) {
  const R = 6371000, c = IS.center;
  return [(lat - c.lat) * Math.PI / 180 * R / IS.scale,
          (lon - c.lon) * Math.cos(c.lat * Math.PI / 180) * Math.PI / 180 * R / IS.scale];
}
// высота настила в точке (или null): плиты с уклоном вдоль u
function pierYAt(x, z) {
  for (const p of pierPlates) {
    const dx = x - p.cx, dz = z - p.cz;
    if (dx * dx + dz * dz > p.r) continue;
    const u = dx * p.ux + dz * p.uz, v = -dx * p.uz + dz * p.ux;
    const f = u / (2 * p.hu) + 0.5;                      // 0 — ближний край плиты, 1 — дальний
    if (Math.abs(u) > p.hu || Math.abs(v) > p.hv + (p.hv1 - p.hv) * f) continue;
    const y = p.y0 + (p.y1 - p.y0) * f;
    return p.ramp ? Math.max(y, groundY(x, z)) : y;      // низ въезда уходит в песок — там едем по земле
  }
  return null;
}

function buildPiers() {
  const root = new THREE.Group();
  scene.add(root);
  pierGroups = [];

  // ---------- общие материалы и текстуры ----------
  const plankTex = pixelTexture(32, 32, (g, w, h) => {           // серое выветренное дерево, доски поперёк
    g.fillStyle = '#909192'; g.fillRect(0, 0, w, h);
    const rnd = seededRandom(55);
    for (let y = 0; y < h; y += 4) {
      g.fillStyle = ['#a8a7a7', '#86888a', '#979694', '#8d8f90'][(rnd() * 4) | 0];
      g.fillRect(0, y, w, 3);
      if (rnd() < 0.3) { g.fillStyle = '#6f7173'; g.fillRect((rnd() * w) | 0, y, 2 + rnd() * 6, 3); }   // выбитые доски
    }
  });
  const oldPlankTex = pixelTexture(32, 32, (g, w, h) => {        // бопхут: тёплое старое дерево
    g.fillStyle = '#a9917c'; g.fillRect(0, 0, w, h);
    const rnd = seededRandom(56);
    for (let y = 0; y < h; y += 3) {
      g.fillStyle = ['#9b8471', '#b29a84', '#8f7a68', '#756a65'][(rnd() * 4) | 0];
      g.fillRect(0, y, w, 2);
    }
  });
  const concTex = pixelTexture(32, 32, (g, w, h) => {            // бетон настила
    g.fillStyle = '#928a86'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, ['#9c948e', '#878078', '#8d8a84'], 160);
  });
  const pinkConcTex = pixelTexture(32, 32, (g, w, h) => {        // розоватый бетон Натона
    g.fillStyle = '#cf9c8e'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, ['#c49287', '#d8a697', '#bc8d82'], 140);
  });
  const sandTex = pixelTexture(32, 32, (g, w, h) => {            // молы Тонг Крута
    g.fillStyle = '#e2d5c5'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, ['#d4c5b2', '#aba099', '#e9ddcf', '#c2b4a4'], 220);
  });
  const M = {
    conc: lambert({ map: concTex }), pink: lambert({ map: pinkConcTex }),
    plank: lambert({ map: plankTex }), oldPlank: lambert({ map: oldPlankTex }),
    pile: lambert({ color: 0x303b3e }), woodPile: lambert({ color: 0x413833 }),
    rustPile: lambert({ color: 0x8a4a3c }), white: lambert({ color: 0xd2ccca }),
    blue: lambert({ color: 0x1b4b80 }), canopy: lambert({ color: 0x2a62c8, side: THREE.DoubleSide }),
    steel: lambert({ color: 0x73767a }), rope: lambert({ color: 0xcdbf9f }),
    redRail: lambert({ color: 0xd9501e }), sand: lambert({ map: sandTex }),
    kneht: lambert({ color: 0x372e27 }), tyre: lambert({ color: 0x19181e }),
    lampHead: new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
  };
  const bx = (parent, w, h, d, mat, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
    return m;
  };

  // ---------- каркас одного пирса ----------
  // g — группа с осями: x = u (в море), z = -v (вправо, если смотреть в море); y — вверх, 0 — уровень моря
  function pierGroup(id) {
    const P = IS.piers[id], g = new THREE.Group();
    g.position.set(P.x, 0, P.z);
    g.rotation.y = -P.az;                        // локальный +X -> азимут az (x_мира = cos az, z_мира = sin az)
    g.userData.id = id; g.userData.start = P.start || null;
    root.add(g); g.updateMatrixWorld(true);
    return g;
  }
  const toWorld = (g, u, v) => { const p = new THREE.Vector3(u, 0, -v); return g.localToWorld(p); };
  // проезжая плита u0..u1 × ±hv, высоты y0 (ближний край) .. y1
  function plate(g, u0, u1, hv, y0, y1 = y0, ramp = false, hv0 = hv) {
    const a = toWorld(g, u0, 0), b = toWorld(g, u1, 0);
    const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, hu = Math.hypot(b.x - a.x, b.z - a.z) / 2;
    const ux = (b.x - a.x) / (2 * hu), uz = (b.z - a.z) / (2 * hu);
    pierPlates[ramp ? 'unshift' : 'push']({ cx, cz, ux, uz, hu, hv: hv0, hv1: hv, y0, y1, ramp, r: (hu + Math.max(hv, hv0) + 3) ** 2 });   // въезд — первым: он главнее плиты настила
  }
  // стена в локальных координатах пирса
  const wallUV = (g, u1, v1, u2, v2) => {
    const a = toWorld(g, u1, v1), b = toWorld(g, u2, v2);
    walls.push([a.x, a.z, b.x, b.z]);
  };
  // настил на сваях: u0..u1, полуширина hv, верх настила y, толщина t; сваи парами с шагом step
  function deck(g, u0, u1, hv, y, mat, t = 0.5, pileMat = M.pile, step = 4, pileR = 0.18) {
    bx(g, u1 - u0, t, hv * 2, mat, (u0 + u1) / 2, y - t / 2, 0);
    const n = Math.max(1, Math.round((u1 - u0) / step)), geo = new THREE.BoxGeometry(pileR * 2, 1, pileR * 2);
    const rows = [];
    for (let i = 0; i <= n; i++) for (const s of [-1, 1]) rows.push([u0 + (u1 - u0) * i / n, s * (hv - 0.4)]);
    const inst = new THREE.InstancedMesh(geo, pileMat, rows.length);
    const d = new THREE.Object3D();
    rows.forEach(([u, v], i) => {
      const w = toWorld(g, u, v), bot = Math.min(groundY(w.x, w.z), y - t);
      d.position.set(u, (bot + y - t) / 2, -v); d.scale.y = Math.max(0.5, y - t - bot + 0.4); d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    });
    g.add(inst);
  }
  // Въезд на настил: клин до высоты настила Y, верхний край — у начала настила uDeck. Нижний край — там, где
  // кончается подведённая дорога или площадка (start: u и высота асфальта), вровень с ней; если это дорога,
  // въезд начинается во всю ширину её асфальта и раструбом сходится (или расходится) к ширине настила —
  // резкого обрыва широкой дороги перед узким пирсом нет. Если дороги нет — от земли: длина такая, чтобы уклон
  // был не круче 16%, нижний край утоплен в песок. Бока закрыты до земли: ни щелей, ни ступенек.
  // Там, где клин выше полуметра, его бока — стена для машины.
  function approach(g, uDeck, hv, Y, mat, start = g.userData.start) {
    const gy = (u, v) => { const w = toWorld(g, u, v); return groundY(w.x, w.z); };
    const h0 = start && start.w ? start.w : hv;                 // полуширина у нижнего края
    let u0, y0;
    if (start) { u0 = start.u; y0 = start.y + 0.03; }
    else {
      let L = 5;
      for (; L < 60; L++) {
        y0 = Math.min(gy(uDeck - L, -hv), gy(uDeck - L, 0), gy(uDeck - L, hv)) - 0.06;
        if ((Y - y0) / L <= 0.16) break;
      }
      u0 = uDeck - L;
    }
    const L = uDeck - u0, yb = Math.min(y0, gy(uDeck, 0), gy(u0, 0)) - 1.5, k = L / 12, pos = [], uv = [];
    const quad = (pts, uvs) => { for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...pts[i]); uv.push(...uvs[i]); } };
    quad([[u0, y0, -h0], [u0, y0, h0], [uDeck, Y, hv], [uDeck, Y, -hv]], [[0, 0], [0, 1], [k, 1], [k, 0]]);            // верх
    quad([[u0, y0, h0], [u0, yb, h0], [uDeck, yb, hv], [uDeck, Y, hv]], [[0, 0.5], [0, 0], [k, 0], [k, 0.5]]);        // бока
    quad([[u0, y0, -h0], [uDeck, Y, -hv], [uDeck, yb, -hv], [u0, yb, -h0]], [[0, 0.5], [k, 0.5], [k, 0], [0, 0]]);
    quad([[uDeck, Y, hv], [uDeck, yb, hv], [uDeck, yb, -hv], [uDeck, Y, -hv]], [[0, 0.5], [0, 0], [1, 0], [1, 0.5]]); // торец под настилом
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, mat));
    plate(g, u0, uDeck, hv, y0, Y, true, h0);
    const wAt = (u) => h0 + (hv - h0) * (u - u0) / L;
    for (const s of [-1, 1]) for (let u = u0; u < uDeck; u += 0.5) {
      if (y0 + (Y - y0) * (u - u0) / L - gy(u, s * wAt(u)) > 0.5) { wallUV(g, u, s * (wAt(u) + 0.1), uDeck, s * (hv + 0.1)); break; }
    }
  }
  // перила: стойки + продольные трубы; rails — высоты труб
  // (y — высота настила; rails — высоты труб или [высота, толщина, цвет]). Перила держат машину на малой скорости,
  // а на большой ломаются пролётами (buildFence в игре).
  function railing(g, u0, u1, v, mat, h = 1.05, rails = [0.55, 1.05], postStep = 2.5, y = 0) {
    const c = mat.color.getHex();
    armFence(buildFence(g, [[u0, v, u1, v]], { step: postStep, y0: y, post: [0.08, h, c], bars: rails.map(r => Array.isArray(r) ? r : [r, 0.05, c]), kind: 'rail', loss: 0.04, mat: mat === M.redRail ? 'wood' : 'metal' }));
  }
  // отдельный предмет на настиле (столбик, тумба, фонарь) — разрушаемый
  const breakAt = (g, objs, u, v, r, kind = 'small', loss = 0.03, mat = 'metal') => { const w = toWorld(g, u, v); breakableObjects(objs, w.x, w.z, r, kind, loss, mat); };
  // фонарь: столб + светящаяся головка
  function lamp(g, u, v, y, h, mat = M.white) {
    breakAt(g, [bx(g, 0.12, h, 0.12, mat, u, y + h / 2, -v), bx(g, 0.3, 0.18, 0.3, M.lampHead, u, y + h + 0.09, -v)], u, v, 0.12, 'pole', 0.05);
  }
  // синий П-портал аппарели Seatran/Raja: стойки, перекладина, будка с 4-скатной крышей, наклонный мост
  function portal(g, u, vC, width, y) {
    const h = 6.5;
    for (const s of [-1, 1]) bx(g, 0.5, h, 0.5, M.blue, u, y + h / 2, -(vC + s * width / 2));
    bx(g, 0.5, 0.5, width + 0.5, M.blue, u, y + h, -vC);
    bx(g, 1.6, 1.1, 2, M.white, u, y + h + 0.55, -vC);                     // будка лебёдки
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4), lambert({ color: 0x7a3b35 }));
    roof.rotation.y = Math.PI / 4; roof.position.set(u, y + h + 1.5, -vC); g.add(roof);
    const ramp = bx(g, 5, 0.2, width - 1.5, M.steel, u + 2.2, y - 0.5, -vC);
    ramp.rotation.z = 0.2;
  }
  // гирлянды покрышек-кранцев вдоль края v, с шагом step
  function fenders(g, u0, u1, v, y, step = 3) {
    const n = Math.max(1, Math.round((u1 - u0) / step));
    const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 8), M.tyre, n + 1);
    const d = new THREE.Object3D(); d.rotation.x = Math.PI / 2;
    for (let i = 0; i <= n; i++) { d.position.set(u0 + (u1 - u0) * i / n, y - 0.5, -v); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); }
    g.add(inst);
  }

  // ---------- суда ----------
  // суда и лодки — в boats.js
  const LIGHT_COLS = [0xff2a2a, 0x2aff5a, 0x2a6aff];
  const LIGHT_PERIODS = [1.31, 1.73, 2.17, 2.69, 3.11, 3.67, 4.23];      // некратные — мигают вразнобой
  let lightSeed = 1;
  const lampTex = pixelTexture(16, 16, (g) => {
    const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
  });
  const lampRay = new THREE.Raycaster(), lampDown = new THREE.Vector3(0, -1, 0);
  // 1–3 цветные лампочки на судне: где придётся — на рубке, мачте, навесе, борту (луч сверху находит, на что сесть).
  // Вызывается, пока судно ещё стоит в начале координат без поворота.
  function boatLights(ship) {
    const rnd = seededRandom(lightSeed += 7), n = 1 + ((rnd() * 3) | 0), lamps = [];
    ship.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(ship);
    for (let tries = 0; lamps.length < n && tries < 40; tries++) {
      const x = bb.min.x + (0.1 + 0.8 * rnd()) * (bb.max.x - bb.min.x), z = bb.min.z + (0.25 + 0.5 * rnd()) * (bb.max.z - bb.min.z);
      lampRay.set(new THREE.Vector3(x, bb.max.y + 1, z), lampDown);
      const hit = lampRay.intersectObject(ship, true)[0];
      if (!hit || lamps.some(l => Math.hypot(l.position.x - x, l.position.z - z) < 1)) continue;
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampTex, color: LIGHT_COLS[(rnd() * 3) | 0],
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
      m.scale.setScalar(1.3);
      m.position.set(x, hit.point.y + 0.4, z);
      m.visible = false;
      lamps.push(m);
      pierLights.push({ m, period: LIGHT_PERIODS[(rnd() * LIGHT_PERIODS.length) | 0], ph: rnd() * 10 });
    }
    for (const m of lamps) ship.add(m);
  }
  const moored = [];                     // суда у причалов: [судно, его габариты в своих осях] — стены ставятся в конце, когда готовы все настилы
  const moor = (g, ship, u, v, headingDeg = 0) => {
    boatLights(ship);
    moored.push([ship, new THREE.Box3().setFromObject(ship)]);
    ship.position.set(u, 0, -v); ship.rotation.y = headingDeg * Math.PI / 180; g.add(ship); return ship;
  };

  // =============================================================================================
  // 1. НАТОН — три бетонных пирса на запад (аз. 266°); главный порт
  // =============================================================================================
  {
    const g = pierGroup('nathon');
    const Y = 2.4, STEM1 = 72, PLAT0 = STEM1, PLAT1 = STEM1 + 37, HEAD0 = PLAT1 + 15, HEAD1 = HEAD0 + 12;
    // южный (пассажирский): ствол -> площадка-терминал (шире к северу) -> перемычка -> Т-голова
    deck(g, 6, STEM1, 5.5, Y, M.pink, 0.7);
    deck(g, PLAT0, PLAT1, 6, Y, M.pink, 0.7);
    bx(g, PLAT1 - PLAT0, 0.7, 6, M.pink, (PLAT0 + PLAT1) / 2, Y - 0.35, -8.5);          // выступ площадки к северу (v+)
    deck(g, PLAT1, HEAD1 + 0, 5.5, Y, M.pink, 0.7);
    bx(g, 12, 0.7, 40, M.pink, (HEAD0 + HEAD1) / 2, Y - 0.35, 0);                        // Т-голова 12 × 40 поперёк
    plate(g, 6, HEAD0, 5.5, Y); plate(g, PLAT0, PLAT1, 6, Y);
    spotPlate(g, PLAT0, PLAT1, 8.5, 3, Y);                                               // выступ площадки — тоже проезжий
    plate(g, HEAD0, HEAD1, 20, Y);
    const shoreY = Math.max(0.6, groundY(toWorld(g, -14, 0).x, toWorld(g, -14, 0).z));
    approach(g, 6, 5.5, Y, M.conc);                                                      // въезд: сюда закругляется набережная улица
    // галерея с синим сводом и парапет — южная сторона ствола; фонари — северная
    for (let u = 6; u < STEM1; u += 3) bx(g, 0.12, 2.6, 0.12, M.steel, u, Y + 1.3, 4.4);
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, STEM1 - 6, 10, 1, true, 0, Math.PI), M.canopy);
    vault.rotation.z = Math.PI / 2; vault.position.set((STEM1 + 6) / 2, Y + 2.6, 4.4); g.add(vault);
    armFence(buildFence(g, [[6, -5.4, STEM1, -5.4]], { step: 3, y0: Y, slab: [0, 0.9, 0.2, M.conc.color.getHex()], kind: 'parapet', loss: 0.12, mat: 'stone' }));   // парапет: держит машину, на скорости крошится
    for (let u = 10; u < HEAD0; u += 16) lamp(g, u, -5, Y, 5);                            // двухрожковые упрощены
    for (const du of [-14, 0, 14]) lamp(g, HEAD0 + 6, du, Y, 8);                          // мачты на голове
    fenders(g, HEAD1 - 1, HEAD1 - 1 + 0.01, 0, Y);                                        // точечный кранец на торце
    for (let v = -18; v <= 18; v += 4.5) bx(g, 0.5, 0.6, 0.5, M.kneht, HEAD1 - 1, Y + 0.3, -v);
    // косой причал для малых лодок — на юго-запад от площадки
    const spur = new THREE.Group(); spur.position.set(PLAT1 - 4, 0, 5.5); spur.rotation.y = -0.72; g.add(spur);
    bx(spur, 35, 0.4, 2.5, M.conc, 17.5, Y - 0.5, 0);
    g.updateMatrixWorld(true); spotPlate(spur, 0, 35, 0, 1.25, Y - 0.3);
    // зал Lomprayah у корня: колонны, вальмовая крыша, башенка
    {
      const hall = new THREE.Group(); hall.position.set(-7, 0, 19); g.add(hall);
      for (const du of [-5, 0, 5]) for (const dv of [-5, 0, 5]) bx(hall, 0.5, 4, 0.5, lambert({ color: 0xccd8de }), du, shoreY + 2, dv);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8.5, 2, 4), lambert({ color: 0x8a4038 }));
      roof.rotation.y = Math.PI / 4; roof.position.set(0, shoreY + 5, 0); hall.add(roof);
      bx(hall, 2.5, 1.6, 2.5, lambert({ color: 0xcab38c }), 0, shoreY + 6, 0);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 4), lambert({ color: 0x7a3b35 }));
      top.rotation.y = Math.PI / 4; top.position.set(0, shoreY + 7.3, 0); hall.add(top);
    }
    // северный пирс Seatran (автопаромный) — в 77 м к северу (230/3)
    const gn = pierGroup('nathon_seatran');
    // По снимку с воздуха (прислал Влад): длинная узкая эстакада с синей галереей по южной стороне выходит к широкой
    // площадке-голове, вытянутой вдоль оси и сдвинутой к югу; на ней склад под синей крышей, касса и стоянка грузовиков;
    // на конце — два причальных «пальца» с аппарелью между ними. Паром стоит бортом к концу пирса, у пальцев.
    const SN1 = 50, HN0 = SN1, HN1 = HN0 + 54, HVC = 5, HHV = 11;                        // эстакада до SN1; голова HN0..HN1, по v от −6 до +16
    deck(gn, 2, SN1, 5, Y, M.conc, 0.7);
    { const hd = new THREE.Group(); hd.position.z = -HVC; gn.add(hd); hd.updateMatrixWorld(true);
      deck(hd, HN0, HN1, HHV, Y, M.conc, 0.7, M.pile, 5, 0.22); }
    plate(gn, 2, SN1, 5, Y); spotPlate(gn, HN0, HN1, HVC, HHV, Y);
    for (const vc of [-4, 14]) {                                                         // причальные пальцы
      const f = new THREE.Group(); f.position.z = -vc; gn.add(f); f.updateMatrixWorld(true);
      deck(f, HN1, HN1 + 16, 1.6, Y, M.conc, 0.5, M.pile, 4, 0.2); spotPlate(gn, HN1, HN1 + 16, vc, 1.6, Y);
    }
    const shoreYN = Math.max(0.6, groundY(toWorld(gn, -12, 0).x, toWorld(gn, -12, 0).z));
    approach(gn, 2, 5, Y, M.conc);
    portal(gn, HN1 - 1, 5, 12, Y);                                                       // аппарель между пальцами
    for (let u = 8; u < SN1; u += 3) bx(gn, 0.12, 2.8, 0.12, M.steel, u, Y + 1.4, -4.2);
    bx(gn, SN1 - 8, 0.15, 2.6, M.canopy, (SN1 + 8) / 2, Y + 2.9, -3.6);                   // навес-галерея по южной стороне
    fenders(gn, HN0 + 1, HN1 - 1, HVC - HHV, Y, 4); fenders(gn, HN0 + 1, HN1 - 1, HVC + HHV, Y, 4);
    { const wh = lambert({ color: 0xe6e2d8 }), grey = lambert({ color: 0xb9bcc0 });
      bx(gn, 34, 4, 5, wh, 75, Y + 2, -13); bx(gn, 35, 0.3, 6, M.canopy, 75, Y + 4.15, -13);                // склад под синей крышей вдоль южного края
      for (let u = 61; u < 91; u += 6) bx(gn, 3.2, 2.8, 0.1, grey, u, Y + 1.4, -10.46);                     // ворота склада
      bx(gn, 10, 3.4, 6, wh, 62, Y + 1.7, -3.5); bx(gn, 10.6, 0.3, 6.6, M.canopy, 62, Y + 3.55, -3.5);      // касса и зал ожидания
      bx(gn, 0.1, 1.2, 4.4, lambert({ color: 0x2c424c }), 67.03, Y + 1.9, -3.5);
      { const ac = lambert({ color: 0xd8dade }); bx(gn, 0.32, 0.62, 0.9, ac, 56.84, Y + 2.4, -2.5); bx(gn, 0.32, 0.62, 0.9, ac, 56.84, Y + 2.4, -4.6); }   // кондиционеры на кассе
      wallBox(gn, 75, 13, 34, 5); wallBox(gn, 62, 3.5, 10, 6);
      parkVehicle(gn, pickupGeo('closed', '#e8e8e4'), 82, 6.5, 'u-', Y); parkVehicle(gn, pickupGeo('boxes', '#2f5f9a'), 90, 6.5, 'u-', Y);
      parkVehicle(gn, pickupGeo('empty', '#c8ccd0'), 98, 12.5, 'v-', Y);
      for (let u = HN0 + 4; u < HN1; u += 12) lamp(gn, u, HVC + HHV - 0.6, Y, 6); }
    bx(gn, 11, 5, 11, lambert({ color: 0xdcd8cc }), -8.5, shoreYN + 2.5, -17);            // терминал Seatran — сбоку от подъезда, между набережной и берегом
    bx(gn, 11.4, 0.4, 11.4, lambert({ color: 0x3e5a74 }), -8.5, shoreYN + 5.1, -17);
    { const gl = lambert({ color: 0x2c424c });                                            // немного окон по всем сторонам
      for (const d of [-3, 0, 3]) { for (const sx of [-14.05, -2.95]) bx(gn, 0.1, 1.2, 1.6, gl, sx, shoreYN + 2.9, -17 + d); for (const sz of [-22.55, -11.45]) bx(gn, 1.6, 1.2, 0.1, gl, -8.5 + d, shoreYN + 2.9, sz); }
      const ac = lambert({ color: 0xd8dade }); for (const d of [-1.5, 1.5]) { bx(gn, 0.32, 0.62, 0.9, ac, -14.17, shoreYN + 1.6, -17 + d); bx(gn, 0.9, 0.62, 0.32, ac, -8.5 + d, shoreYN + 1.6, -22.67); } }   // кондиционеры
    // старый узкий пирс южнее (корень 9.5353, 99.9347), фонари «гусиная шея» по северной стороне
    const go = pierGroup('nathon_old');
    const OL = 80;
    deck(go, 0, OL, 2.2, 1.6, M.conc, 0.35, M.pile, 5, 0.12);
    bx(go, 5, 0.35, 16, M.conc, OL + 2.5, 1.6 - 0.18, 0);                                 // площадка на конце
    plate(go, 0, OL + 5, 2.2, 1.6); plate(go, OL, OL + 5, 8, 1.6);
    approach(go, 0, 2.2, 1.6, M.conc);
    for (let u = 8; u < OL; u += 15) {
      breakAt(go, [bx(go, 0.08, 4.6, 0.08, lambert({ color: 0x0d0f1a }), u, 1.6 + 2.3, 1.7),
        bx(go, 0.5, 0.08, 0.08, lambert({ color: 0x0d0f1a }), u + 0.21, 1.6 + 4.56, 1.7),
        bx(go, 0.22, 0.14, 0.22, M.lampHead, u + 0.42, 1.6 + 4.45, 1.7)], u, -1.7, 0.1, 'pole', 0.05);
    }
    // суда: Seahorse у Т-головы, катер Songserm у площадки, автопаром у Seatran, сейнеры у старого
    moor(g, boatBigFerry({ L: 42, B: 8 }), HEAD1 + 7.5, -6, 90);
    moor(g, boatFastFerry({ L: 14, B: 3.6, hull: '#1c4fa8', bottom: '#10244a', name: 'ROYAL JET', px: 0.24 }), PLAT1 - 9, 14.2, 184);   // у края выступа площадки, снаружи
    // Seatran Ferry 10 (seatran_ferry.js): 60 м — не в масштабе острова, а почти в масштабе машин (настоящий — 84 м); стоит бортом
    // к концу пирса — поперёк его оси, у причальных пальцев (так велел Влад: не вдоль пирса и не кормой)
    moor(gn, boatSeatranFerry({ L: 60, B: 12, num: '10' }), HN1 + 16 + 7.4, HVC, 90);
    moor(go, boatTrawler('#c8322a'), OL - 6, 5.2, 8);
    moor(go, boatTrawler('#2a5a9a'), OL - 21, 5.4, 174);
    moor(go, boatTrawler('#2a8a6a'), OL - 12, -5.6, 2);
    moor(go, boatFisher(), OL - 34, -4, 186);
    pierGroups.push(g, gn, go);
  }

  // =============================================================================================
  // 2. ЛИПА НОЙ — автопаромный терминал Raja Ferry: два параллельных пирса (аз. 265°)
  // =============================================================================================
  {
    const Y = 2.3;
    const gN = pierGroup('lipa_n');                 // северный (сдвинут от узла на +44 м с.ш. /3)
    const gS = pierGroup('lipa_s');
    for (const [g, L, HW] of [[gN, 35, 4.2], [gS, 33, 5.2]]) {
      const H0 = L, H1 = L + 13;
      deck(g, 2, H0, 5, Y, M.conc, 0.7, lambert({ color: 0x5e3f22 }), 3.3, 0.3);
      deck(g, H0, H1, HW + 8, Y, M.conc, 0.7, lambert({ color: 0x5e3f22 }), 4, 0.3);
      plate(g, 2, H1, 5, Y); plate(g, H0, H1, HW + 8, Y);
      approach(g, 2, 5, Y, M.conc);
      railing(g, 2, H0, 4.6, M.white, 1.1, [0.5, 1.05], 3, Y);      // перила ствола держат машину; голова открыта
      railing(g, 2, H0, -4.6, M.white, 1.1, [0.5, 1.05], 3, Y);
      for (let u = 6; u < H0; u += 3.4) bx(g, 0.1, 2.6, 0.1, M.steel, u, Y + 1.3, 3.6);
      bx(g, H0 - 6, 0.12, 2.2, M.steel, (H0 + 6) / 2, Y + 2.65, 3.6);                     // крыша галереи
      portal(g, H1 - 1.5, 0, 8, Y);
      fenders(g, H0, H1, HW + 8 - 0.2, Y, 3); fenders(g, H0, H1, -(HW + 8 - 0.2), Y, 3);
    }
    // стальные мостки к палам: от северной головы на запад, от южной — ломаной на юго-запад
    bx(gN, 18, 0.25, 1.2, M.steel, 35 + 13 + 9, Y - 0.2, 0);
    for (let i = 0; i < 4; i++) bx(gN, 0.14, Y + 2, 0.14, M.rustPile, 35 + 13 + 4 + i * 5, Y / 2, 0.8);
    { const w = new THREE.Group(); w.position.set(33 + 13, 0, 3); w.rotation.y = -0.3; gS.add(w);
      bx(w, 40, 0.25, 1.2, M.steel, 20, Y - 0.2, 0);
      for (let i = 0; i < 8; i++) bx(w, 0.14, Y + 2, 0.14, M.rustPile, 2 + i * 5, Y / 2, 0.7); }
    // берег: три здания терминала, зелёная вывеска «Samui International Port» над подъездом
    const sh = Math.max(0.6, groundY(toWorld(gN, -16, -10).x, toWorld(gN, -16, -10).z));
    for (const [dz, len, h, col] of [[14, 6.5, 3, 0xe8e4da], [24.5, 9, 3.5, 0xdcd8cc], [38.5, 14, 3.5, 0xe8e4da]]) {
      bx(gN, 5, h, len, lambert({ color: col }), -19, sh + h / 2, dz);
      bx(gN, 5.4, 0.4, len + 0.5, lambert({ color: 0x7a3b35 }), -19, sh + h + 0.2, dz);
      const gl = lambert({ color: 0x2c424c }), n = Math.max(1, Math.floor(len / 3.2));       // немного окон с обеих длинных сторон
      for (let i = 0; i < n; i++) for (const sx of [-21.55, -16.45]) bx(gN, 0.1, 1.0, 1.3, gl, sx, sh + h * 0.55, dz - len / 2 + (i + 0.5) * len / n);
      bx(gN, 0.32, 0.62, 0.9, lambert({ color: 0xd8dade }), -21.67, sh + 0.7, dz);                          // кондиционер сзади
    }
    {                                                                                     // вывеска — над общим подъездом, до развилки к двум пирсам
      const w = toWorld(gN, -96, 0), gy = groundY(w.x, w.z);
      for (const s of [-1, 1]) bx(gN, 0.3, 6.5, 0.3, M.steel, -96, gy + 3.25, s * 8.2);
      bx(gN, 0.4, 2, 16.8, lambert({ color: 0x193135 }), -96, gy + 6, 0);
    }
    // паромы Raja: один у северной аппарели, один на отстое
    // (паром у северной аппарели ходит на Панган по расписанию: ferry.js)
    moor(gS, boatCarFerry({ L: 22, B: 7 }), 33 + 26, 14, 150);
    pierGroups.push(gN, gS);
  }

  // =============================================================================================
  // 3. БАНГРАК — четыре пирса в бухте Большого Будды
  // =============================================================================================
  {
    // A — бетонный Seatran (аз. 297°): тумбы-фонарики вместо перил, голова с кнехтами
    const g = pierGroup('bangrak_a');
    const Y = 1.9, L = 47, H1 = L + 14;
    deck(g, 1, L, 2.8, Y, M.conc, 0.6, M.pile, 4.5);
    deck(g, L, H1, 4.5, Y, M.conc, 0.6, M.pile, 4.5);
    plate(g, 1, H1, 2.8, Y); plate(g, L, H1, 4.5, Y);
    approach(g, 1, 2.8, Y, M.conc);
    for (let u = 4; u < L; u += 9) for (const s of [-1, 1]) {                             // тумбы с «шапочками»
      const post = bx(g, 0.3, 1.3, 0.3, M.conc, u, Y + 0.65, s * 2.5);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.3, 4), M.white);
      cap.rotation.y = Math.PI / 4; cap.position.set(u, Y + 1.45, s * 2.5); g.add(cap);
      breakAt(g, [post, cap], u, -s * 2.5, 0.2, 'small', 0.05, 'stone');
    }
    for (let v = -3.5; v <= 3.5; v += 1.4) {                                              // кнехты-«грибки» на голове
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.55, 8), M.kneht);
      k.position.set(H1 - 1, Y + 0.28, -v); g.add(k);
      bx(g, 0.5, 0.1, 0.5, M.kneht, H1 - 1, Y + 0.6, -v);
    }
    // (Seatran Discovery у головы ходит на Панган по расписанию: ferry.js)
    // B — тонкий стальной (аз. 323°): канатные перила, ржавые стойки
    const gb = pierGroup('bangrak_b');
    deck(gb, 1, 43, 1.1, 1.5, M.plank, 0.15, M.rustPile, 3.2, 0.08);
    plate(gb, 1, 43, 1.1, 1.5);
    approach(gb, 1, 1.1, 1.5, M.plank);
    railing(gb, 1, 43, 0.95, M.rustPile, 1, [0.9], 3.2, 1.5); railing(gb, 1, 43, -0.95, M.rustPile, 1, [0.9], 3.2, 1.5);
    bx(gb, 5, 0.12, 1.5, M.plank, 20, 1.5 - 0.55, -2);                                    // нижняя площадка
    // C — Phetcherat (аз. 332°): красно-оранжевые перила, Т-перекладина, беседки на конце
    const gc = pierGroup('bangrak_c');
    deck(gc, 1, 51, 1.5, 1.6, M.plank, 0.18, M.woodPile, 3, 0.1);
    bx(gc, 2.2, 0.18, 7.4, M.plank, 39, 1.6 - 0.09, 0);                                   // Т-перекладина
    plate(gc, 1, 51, 1.5, 1.6); plate(gc, 37.8, 40, 3.7, 1.6);
    approach(gc, 1, 1.5, 1.6, M.plank);
    railing(gc, 1, 51, 1.3, M.redRail, 1.05, [0.5, 1.0], 1.8, 1.6);
    railing(gc, 1, 51, -1.3, M.redRail, 1.05, [0.5, 1.0], 1.8, 1.6);
    for (const du of [47.5, 50]) {                                                         // беседки с шатровыми крышами
      for (const s of [-1, 1]) bx(gc, 0.12, 2.2, 0.12, M.white, du, 1.6 + 1.1, s * 1.1);
      const r = new THREE.Mesh(new THREE.ConeGeometry(2, 1, 4), lambert({ color: 0xb02a2a }));
      r.rotation.y = Math.PI / 4; r.position.set(du, 1.6 + 2.7, 0); gc.add(r);
    }
    breakAt(gc, [bx(gc, 0.14, 2.8, 0.14, lambert({ color: 0xf2f2ee }), 51.5, 1.6 + 1.4, 0),      // полосатый столбик-маяк
      bx(gc, 0.18, 0.4, 0.18, lambert({ color: 0xd9501e }), 51.5, 1.6 + 2.9, 0)], 51.5, 0, 0.1, 'pole', 0.04);
    // D — деревянный Haad Rin Queen (аз. 337°): низкие столбики, без перил
    const gd = pierGroup('bangrak_d');
    deck(gd, 1, 41, 1.5, 1.4, M.plank, 0.15, M.woodPile, 3, 0.11);
    plate(gd, 1, 41, 1.5, 1.4);
    approach(gd, 1, 1.5, 1.4, M.plank);
    for (let u = 2; u < 41; u += 3) for (const s of [-1, 1]) breakAt(gd, [bx(gd, 0.15, 0.6, 0.15, M.woodPile, u, 1.4 + 0.3, s * 1.3)], u, -s * 1.3, 0.1, 'small', 0.03, 'wood');
    moor(gd, boatTourBoat(), 46, 3.5, 25);
    for (const [du, dv, h] of [[18, 7, 40], [26, -8, 205], [33, 6, 10]]) moor(gb, boatSpeedboat(), du, dv, h);
    pierGroups.push(g, gb, gc, gd);
  }

  // =============================================================================================
  // 4. МАЕНАМ — деревянный пирс Lomprayah (аз. 61°), ворота с баннером и павильон-терминал
  // =============================================================================================
  {
    const g = pierGroup('maenam');
    const Y = 1.3, L = 43;
    deck(g, 0, L, 2, Y, M.plank, 0.18, M.pile, 2.8, 0.12);
    plate(g, 0, L, 2, Y);
    approach(g, 0, 2, Y, M.plank);
    railing(g, 0, L, 1.75, M.steel, 1.2, [[0.95, 0.045, M.rope.color.getHex()]], 2.8, Y);   // стойки с канатом
    railing(g, 0, L, -1.75, M.steel, 1.2, [[0.95, 0.045, M.rope.color.getHex()]], 2.8, Y);
    for (let u = 10; u < L; u += 16) lamp(g, u, 1.75, Y, 4.6, M.steel);
    for (const dv of [-1.2, 0, 1.2]) bx(g, 0.1, 1.6, 0.5, M.white, L + 0.1, Y - 0.3, dv);   // отбойные щиты торца
    fenders(g, L - 0.2, L - 0.19, 0, Y + 0.3, 1);
    // ворота-арка с баннером у корня
    for (const s of [-1, 1]) bx(g, 0.25, 4.6, 0.25, M.white, -2, 2.3, s * 3.6);          // стойки — по сторонам раструба въезда
    bx(g, 0.15, 1.1, 7.4, lambert({ color: 0x6db1e8 }), -2, 4.3, 0);
    // павильон-терминал с синей кромкой крыши — к западу от корня; длинное здание с тёмной крышей — к востоку
    const sh = Math.max(0.5, groundY(toWorld(g, -15, 15).x, toWorld(g, -15, 15).z));
    { const t = new THREE.Group(); t.position.set(-17, 0, -17); t.rotation.y = 0.5; g.add(t);
      for (const du of [-6, 0, 6]) for (const dv of [-3.5, 3.5]) bx(t, 0.22, 2.9, 0.22, M.steel, du, sh + 1.45, dv);
      bx(t, 15, 0.3, 9, lambert({ color: 0xe8e8e4 }), 0, sh + 3.1, 0);
      bx(t, 15.2, 0.25, 9.4, lambert({ color: 0x1f4fa0 }), 0, sh + 2.95, 0);              // синий кант
      bx(t, 4.5, 1.3, 1, lambert({ color: 0xf2f2f2 }), 0, sh + 1.3, 0);                   // стойка касс
      bx(t, 4.5, 0.5, 1.05, lambert({ color: 0x182e67 }), 0, sh + 0.5, 0); }
    { const b = new THREE.Group(); b.position.set(-13, 0, 13); b.rotation.y = 0.5; g.add(b);
      bx(b, 12, 2.2, 3, lambert({ color: 0xcab38c }), 0, sh + 1.1, 0);
      { const gl = lambert({ color: 0x2c424c }); for (const du of [-3.6, 0, 3.6]) for (const sz of [-1.55, 1.55]) bx(b, 1.3, 0.8, 0.1, gl, du, sh + 1.3, sz); bx(b, 0.9, 0.62, 0.32, lambert({ color: 0xd8dade }), 5.2, sh + 1.3, -1.67); }   // окошки на длинных сторонах
      const r = bx(b, 12.4, 1.6, 3.8, lambert({ color: 0x433532 }), 0, sh + 2.9, 0); r.scale.y = 0.9; }
    // (катамаран Lomprayah у этого пирса — паром по расписанию: ferry.js)
    pierGroups.push(g);
  }

  // =============================================================================================
  // 5. БОПХУТ — старый деревянный пирс Рыбацкой деревни (аз. 353°), без перил
  // =============================================================================================
  {
    const g = pierGroup('bophut');
    const Y = 1.2, L = 18;
    deck(g, 0, L, 1.1, Y, M.oldPlank, 0.12, M.woodPile, 2.5, 0.1);
    plate(g, 0, L, 1.1, Y);
    approach(g, 0, 1.3, Y, M.oldPlank);                                                   // сходни с пляжа
    // швартовые столбы из пальм разной высоты, гуще у конца; на двух — покрышки
    const rnd = seededRandom(77);
    for (let u = 3; u < L + 2; u += 1.6 + rnd() * 1.8) for (const s of [-1, 1]) {
      if (rnd() < 0.4) continue;
      const h = 0.8 + rnd() * 1.6;
      bx(g, 0.16 + rnd() * 0.1, h, 0.16 + rnd() * 0.1, M.woodPile, u, Y + h / 2 - 0.1, s * (1.0 + rnd() * 0.25));
    }
    for (const [du, dv] of [[L - 1, 1.1], [L - 3, -1.1]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 8), M.tyre);
      t.position.set(du, Y + 0.25, -dv); g.add(t);
    }
    // рекламный щит на двух жердях на 2/3 длины
    for (const s of [-1, 1]) bx(g, 0.1, 4.6, 0.1, M.woodPile, 12 + s * 1.4, Y + 2.3, 1.6);
    bx(g, 3, 1, 0.08, lambert({ color: 0xe8e4d8 }), 12, Y + 3.9, 1.6);
    // (катер на Панган у левого борта — по расписанию: ferry.js)
    moor(g, boatPatrol(), L + 2, -2.8, 175);             // полицейский катер (справа: слева причал катера на Панган)
    pierGroups.push(g);
  }

  // =============================================================================================
  // 6. ТОНГ КРУТ — гавань длиннохвостых лодок: два насыпных мола (аз. 228°), канал между ними
  // =============================================================================================
  {
    const g = pierGroup('thong_krut');
    const TOP = 1.3;
    const molo = (vOff, len, fed) => {                                                   // насыпь с отвесными боками: от дна до гребня; fed — к ней подведена дорога
      const m = new THREE.Group(); m.position.set(0, 0, -vOff); g.add(m);
      bx(m, len, 5.3, 4.2, M.sand, len / 2, TOP - 2.65, 0);
      m.updateMatrixWorld(true);
      plate(m, 0, len, 2.1, TOP);                                                        // гребень проезжий — ровно по верху насыпи
      approach(m, 0, 2.1, TOP, M.sand, fed ? g.userData.start : null);
      return m;
    };
    molo(6.5, 158, true);                                                                  // западный мол (канал слева, v−)
    molo(-6.5, 142, false);
    { const bend = new THREE.Group(); bend.position.set(142, 0, 6.5); bend.rotation.y = -0.9; g.add(bend);
      bx(bend, 70, 5.3, 3.6, M.sand, 35, TOP - 2.65, 0);
      bend.updateMatrixWorld(true);
      plate(bend, 0, 70, 1.8, TOP); }
    // длиннохвостые лодки в канале — вдоль западного мола, носом чуть к нему; ещё четыре вытащены на пляж
    const rnd = seededRandom(31);
    for (let i = 0; i < 9; i++) moor(g, boatLongtail(rnd), 18 + i * 13 + rnd() * 4, 2.7, 4 + rnd() * 9);
    for (let i = 0; i < 4; i++) {
      const u = -3 - rnd() * 4, v = -22 - i * 7, b = moor(g, boatLongtail(rnd), u, v, 20 + rnd() * 25), w = toWorld(g, u, v);
      b.position.y = groundY(w.x, w.z) + 0.2; b.rotation.z = (rnd() - 0.5) * 0.3;         // лежит на песке, завалившись на борт
    }
    moor(g, boatSpeedboat(), 60, -2.2, 4);
    moor(g, boatFisher(rnd), 96, -2.4, 184); moor(g, boatFisher(rnd), 124, -2.6, 2);
    // покрышки на гребне западного мола
    for (let u = 12; u < 150; u += 17) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 8), M.tyre); t.position.set(u, TOP - 0.25, -6.5 + 2.2); t.rotation.x = Math.PI / 2; g.add(t); }
    pierGroups.push(g);
  }

  // Суда твёрдые: прямоугольник по корпусу (нос и корма чуть короче габарита). Если он задевает настил пирса —
  // сужается, пока не отойдёт: по настилу машина должна ездить свободно.
  for (const [ship, bb] of moored) {
    ship.updateMatrixWorld(true);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, hl = (bb.max.x - bb.min.x) / 2 * 0.92;
    for (let k = 0.9; k > 0.35; k -= 0.08) {
      const hw = (bb.max.z - bb.min.z) / 2 * k;
      const P = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([x, z]) => ship.localToWorld(new THREE.Vector3(cx + x, 0, cz + z)));
      let free = true;
      for (let i = 0; i < 4 && free; i++) for (let j = 0; j <= 8; j++) {
        const a = P[i], b = P[(i + 1) % 4];
        if (pierYAt(a.x + (b.x - a.x) * j / 8, a.z + (b.z - a.z) * j / 8) !== null) { free = false; break; }
      }
      if (!free) continue;
      P.forEach((a, i) => { const b = P[(i + 1) % 4]; walls.push([a.x, a.z, b.x, b.z]); });
      solids.push(P.map(p => [p.x, p.z]));
      break;
    }
  }

  // дальние пирсы не рисуем (как куски растительности)
  for (const g of pierGroups) { g.userData.c = new THREE.Vector3(); g.getWorldPosition(g.userData.c); }
}
const PIER_SEEN = 1500;
const LIGHT_FLASH = 0.16;                // с — сколько длится вспышка огня на судне
function updatePiers(t) {
  if (!pierGroups) return;
  for (const g of pierGroups) {
    const far = g.userData.far || PIER_SEEN, on = (g.userData.c.x - camPos.x) ** 2 + (g.userData.c.z - camPos.z) ** 2 < far * far;   // far — своя дальность группы
    if (on !== g.visible) g.visible = on;
  }
  const night = skyNow.night > 0.25;
  // огонь на судне — короткая вспышка: загорается разом и гаснет за LIGHT_FLASH секунд, потом темно до следующей
  for (const L of pierLights) {
    const p = (t + L.ph) % L.period, on = night && p < LIGHT_FLASH;
    L.m.visible = on;
    if (on) L.m.material.opacity = (1 - p / LIGHT_FLASH) ** 2;
  }
}
