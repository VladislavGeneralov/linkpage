// TLS: фон «горы» из videotext/PROJECTOR/final.html (genMountains), облегчённый для телефона.
// - Чистый WebGL, без three.js и постобработки (bloom/afterimage убраны).
// - Без звука: скорость полёта и высоту гор качают два медленных LFO.
// - Вся математика частиц — в вершинном шейдере. Буфер частиц грузится в GPU один раз,
//   за кадр процессор меняет только 4 числа (uniform). 30 кадров/с, DPR не выше 1.5.
// - Пауза в фоне вкладки (requestAnimationFrame сам), «уменьшить движение» = один статичный кадр.
// Подключение: <script src="mountains.js" defer></script>. Холст встаёт за страницей (z-index:-1),
// поэтому у <html> не должно быть своего фона (фон body при этом можно).
// «Стекло»: частицы за <main> рисуются крупными мягкими пятнами (расфокус) прямо в шейдере —
// без backdrop-filter и лишних проходов, цена ≈ ноль.
// Для проверки: ?fps — счётчик кадров, ?n=3000 — частиц, ?size=1.8, ?dim=1 — яркость.
(() => {
  "use strict";
  const Q = new URLSearchParams(location.search);
  const num = (k, d) => { const v = parseFloat(Q.get(k)); return Number.isFinite(v) ? v : d; };

  // ---------- настройки ----------
  const N = Math.round(Math.min(20000, Math.max(200, num("n", 3000))));
  const FPS = 30;
  const DPR_MAX = 1.5;
  const SIZE = num("size", 1.8);          // размер точек
  const DIM = num("dim", 1);              // общая яркость (под формой, может, 0.6–0.8)
  const DEPTH = 40;                       // длина «конвейера» гор в мировых единицах
  const LFO_A = { sec: 47, amt: 0.25 };   // «энергия»: скорость + высота
  const LFO_B = { sec: 29, amt: 0.20 };   // «бас»: добавка к тому же
  const GLASS = { size: 1.8, alpha: 1.0 }; // расфокус за плашкой: во сколько крупнее; яркость пятна
  const TAN = Math.tan(25 * Math.PI / 180); // камера как в оригинале: fov 50°, z = 20

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;height:100lvh;" +
    "z-index:-1;pointer-events:none;display:block;background:#000";
  const opts = { alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "low-power" };
  const gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
  if (!gl) return;                        // нет WebGL — остаётся чёрный фон страницы
  (document.body || document.documentElement).prepend(canvas);

  const VS = `
    attribute vec4 aA;   // x, zBase, jitterX, jitterY
    attribute vec4 aB;   // jitterZ, phase + 8*kind, bright, sizeJ
    uniform vec4 uF;     // time, flight, amp, dim
    uniform vec4 uV;     // aspect, pxScale, focal
    uniform vec4 uP;     // плашка: левый и правый край в NDC, ширина перехода
    varying vec3 vCol;
    varying float vBlur;
    const float D = ${DEPTH.toFixed(1)};
    float terrain(float x, float z) {
      return 1.5*sin(x*0.15 + z*0.10) + 0.9*sin(x*0.07 - z*0.18 + 1.3)
           + 0.5*sin(x*0.31 + z*0.05 + 2.1) + 0.3*sin(x*0.5 - z*0.4);
    }
    void main() {
      float kind = floor(aB.y / 8.0);            // 0 хребет, 1 дальний хребет, 2 эхо, 3 пыль
      float ph = aB.y - kind * 8.0;
      float g = float(kind > 0.5 && kind < 1.5);
      float e = float(kind > 1.5 && kind < 2.5);
      float s = float(kind > 2.5);
      float wob = mix(1.0, 0.5 + 0.5*sin(uF.x*0.35 + ph), s);
      float zB = aA.y + g * D * 0.5;
      float rz = mod(zB - uF.y * mix(1.0, 0.6, g), D) - D * 0.75;
      float nx = mix(aA.x, aA.x * 0.8 + 6.0, g);
      float h = terrain(nx, zB) * uF.z * mix(1.0, 0.8, g) + aA.w * wob;
      float x = aA.x + aA.z * wob;
      float z = rz + aB.x * wob;
      vec3 p = e > 0.5 ? vec3(x * 1.6, -h * 1.6 + 11.0, z * 1.6 - 10.0)
                       : vec3(x, h - 4.2, z - g * 3.5);

      float nh = clamp((h + 3.0) / 6.0, 0.0, 1.0);
      vec3 c = nh < 0.5 ? mix(vec3(0.07, 0.07, 0.08), vec3(0.55, 0.55, 0.57), nh * 2.0)
                        : mix(vec3(0.55, 0.55, 0.57), vec3(0.82, 0.83, 0.85), nh * 2.0 - 1.0);
      float et = clamp((rz + D * 0.75) / (D * 0.22), 0.0, 1.0);
      float fog = et * et * (3.0 - 2.0 * et) * clamp(1.0 + rz / (D * 0.9), 0.05, 1.0) * mix(1.0, 0.45, g);

      // медленный дрейф оттенка у трети частиц: тёплый → белый → голубой (циклы 9–35 мин)
      float on = step(fract(ph * 7.13), 0.35);
      float sn = 0.5 + 0.5 * sin(uF.x * (0.003 + 0.009 * fract(ph * 3.7)) + ph);
      vec3 seg = sn < 0.5 ? mix(vec3(1.18, 1.06, 0.72), vec3(1.0), sn * 2.0)
                          : mix(vec3(1.0), vec3(0.80, 0.94, 1.20), sn * 2.0 - 1.0);
      vec3 tint = 1.0 + (seg - 1.0) * (0.25 + 0.75 * fract(ph * 5.3)) * on;

      vCol = c * tint * fog * aB.z * mix(1.0, 0.55, e) * uF.w;
      float d = 20.0 - p.z;                      // расстояние до камеры
      float size = (1.7 * fog + 0.3) * aB.w * mix(1.0, 0.8, g) * mix(1.0, 1.35, e);
      gl_Position = d > 0.5 ? vec4(p.x * uV.z / uV.x, p.y * uV.z, 0.0, d) : vec4(2.0, 2.0, 2.0, 1.0);
      float sx = p.x * uV.z / uV.x / d;          // x на экране, -1..1
      vBlur = smoothstep(uP.x - uP.z, uP.x + uP.z, sx) * (1.0 - smoothstep(uP.y - uP.z, uP.y + uP.z, sx));
      gl_PointSize = d > 0.5 ? min(size * 33.0 / d, 5.25) * uV.y * (1.0 + vBlur * ${(GLASS.size - 1).toFixed(2)}) : 0.0;
    }`;
  const FS = `
    precision mediump float;
    varying vec3 vCol;
    varying float vBlur;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float soft = smoothstep(0.5, 0.0, d) * ${GLASS.alpha.toFixed(2)};   // мягкое пятно, света столько же, сколько у резкой точки
      gl_FragColor = vec4(vCol, mix(smoothstep(0.5, 0.36, d), soft, vBlur));
    }`;

  let prog, buf, uF, uV, uP, aspect = 0, raf = 0, last = 0, t = 0, flight = 0;
  let frames = 0, fpsT = 0, fpsEl = null;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }

  function init() {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, "aA");
    gl.bindAttribLocation(prog, 1, "aB");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return false; }
    gl.useProgram(prog);
    uF = gl.getUniformLocation(prog, "uF");
    uV = gl.getUniformLocation(prog, "uV");
    uP = gl.getUniformLocation(prog, "uP");
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 1);
    aspect = 0;
    resize();
    return true;
  }

  // Сетка частиц под текущие пропорции экрана: ширина = то, что камера видит на дальнем краю.
  // На телефоне (узкий экран) сетка выходит плотнее, на широком — шире и реже.
  function build(asp) {
    const rand = (a, b) => a + Math.random() * (b - a);
    const spanX = 2 * (20 + DEPTH * 0.75) * TAN * asp * 1.05;
    const gw = Math.max(8, Math.round(Math.sqrt(N * spanX / DEPTH)));
    const gh = Math.ceil(N / gw);
    const sx = spanX / gw / 0.46, sz = DEPTH / gh / 0.46;  // шаг относительно оригинала (0.46)
    const a = new Float32Array(N * 8);
    for (let i = 0; i < N; i++) {
      const o = i * 8, dust = Math.random() < 0.30;
      let kind = 3;
      if (!dust) { const r = Math.random(); kind = r < 0.4 ? 1 : r < 0.55 ? 2 : 0; }
      a[o]     = ((i % gw) + 0.5) / gw * spanX - spanX / 2;
      a[o + 1] = Math.floor(i / gw) / gh * DEPTH;
      a[o + 2] = dust ? rand(-5.5, 5.5) : rand(-0.35, 0.35) * sx;
      a[o + 3] = dust ? rand(-3.6, 3.6) : rand(-0.3, 0.3);
      a[o + 4] = dust ? rand(-4.2, 4.2) : rand(-0.35, 0.35) * sz;
      a[o + 5] = rand(0, 6.283) + 8 * kind;
      a[o + 6] = dust ? rand(0.30, 0.65) : rand(0.6, 1.4);
      a[o + 7] = dust ? rand(0.4, 0.8) : rand(0.7, 1.5);
    }
    gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW);  // массив дальше не нужен, его заберёт GC
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    const asp = w / h;
    // сетку пересобираем только при заметной смене пропорций (поворот), не от прыжков адресной строки
    if (!aspect || Math.abs(asp / aspect - 1) > 0.15) { aspect = asp; build(asp); }
    gl.uniform4f(uV, asp, h / 2160 * SIZE * 1.1, 1 / TAN, 0);
    panel();
  }

  // где плашка (<main>) по горизонтали — в координатах -1..1; нет плашки — расфокуса нет
  function panel() {
    const m = document.querySelector("main"), cw = canvas.clientWidth || 1;
    if (!m) { gl.uniform4f(uP, 9, 9, 0.01, 0); return; }
    const r = m.getBoundingClientRect(), c = canvas.getBoundingClientRect();
    gl.uniform4f(uP, (r.left - c.left) / cw * 2 - 1, (r.right - c.left) / cw * 2 - 1, 12 / cw * 2, 0);
  }

  function draw(dt) {
    t += dt;
    const ea = LFO_A.amt * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / LFO_A.sec));
    const eb = LFO_B.amt * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / LFO_B.sec + 1.7));
    flight += (0.5 + ea * 2.2 + eb * 1.3) * dt;
    if (flight > DEPTH * 5) flight -= DEPTH * 5;   // кратно D и 0.6·D — без скачка, без потери точности
    gl.uniform4f(uF, t, flight, 1 + ea * 1.8 + eb, DIM);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, N);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / FPS - 4) return;
    const dt = Math.min(0.1, (now - last) / 1000);  // после возврата во вкладку — без рывка
    last = now;
    draw(dt);
    if (fpsEl) {
      frames++;
      if (now - fpsT >= 1000) { fpsEl.textContent = `${frames} fps · ${N} частиц · ${canvas.width}×${canvas.height}`; frames = 0; fpsT = now; }
    }
  }

  function start() {
    if (!init()) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { flight = DEPTH * 0.3; draw(0); return; }
    last = fpsT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  if (Q.has("fps")) {
    fpsEl = document.createElement("div");
    fpsEl.style.cssText = "position:fixed;right:8px;bottom:8px;font:12px monospace;color:#0f0;z-index:9;pointer-events:none";
    document.body.appendChild(fpsEl);
  }
  window.addEventListener("resize", () => { if (prog) resize(); });
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); cancelAnimationFrame(raf); prog = null; });
  canvas.addEventListener("webglcontextrestored", start);
  start();
})();
