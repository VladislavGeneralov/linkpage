const canvas = document.getElementById("fx");
const ctx = canvas.getContext("2d");

let w, h;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

let bolts = [];

/* pick random point ON SCREEN EDGE */
function randomEdgePoint() {
  const side = Math.floor(Math.random() * 4);

  switch (side) {
    case 0: return { x: Math.random() * w, y: 0 };        // top
    case 1: return { x: w, y: Math.random() * h };        // right
    case 2: return { x: Math.random() * w, y: h };        // bottom
    case 3: return { x: 0, y: Math.random() * h };        // left
  }
}

/* midpoint displacement: recursively bends the segment a->b, offsetting
   each new midpoint perpendicular to the segment. displace shrinks each
   level, giving the classic self-similar jaggedness of a lightning channel.
   optionally spawns side-branches off the interior midpoints. */
function subdivide(a, b, displace, depth, points, state) {
  if (depth <= 0) {
    points.push(b);
    return;
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const offset = (Math.random() - 0.5) * displace;
  const mid = {
    x: (a.x + b.x) / 2 + nx * offset,
    y: (a.y + b.y) / 2 + ny * offset
  };

  subdivide(a, mid, displace * 0.55, depth - 1, points, state);

  if (state && state.remaining > 0 && depth > 1 && depth < state.maxDepth && Math.random() < 0.3) {
    state.remaining--;
    spawnBranch(mid, dx, dy, depth);
  }

  subdivide(mid, b, displace * 0.55, depth - 1, points, state);
}

function buildPath(a, b, displace, depth, allowBranches, maxBranches) {
  const points = [a];
  const state = allowBranches ? { remaining: maxBranches, maxDepth: depth } : null;
  subdivide(a, b, displace, depth, points, state);
  return points;
}

/* a shorter, dimmer, non-branching offshoot from a point on the main channel */
function spawnBranch(origin, dirX, dirY, parentDepth) {
  const baseLen = Math.hypot(dirX, dirY);
  const len = baseLen * (0.12 + Math.random() * 0.18);
  const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * (Math.PI / 1.6);
  const end = {
    x: origin.x + Math.cos(angle) * len,
    y: origin.y + Math.sin(angle) * len
  };

  const depth = Math.max(2, parentDepth - 2);
  const points = buildPath(origin, end, len * 0.45, depth, false, 0);

  bolts.push({
    points,
    life: 0.5 + Math.random() * 0.25,
    decay: 0.11,
    width: 0.9
  });
}

function strike(points, opts = {}) {
  bolts.push({
    points,
    life: opts.life ?? 1,
    decay: opts.decay ?? 0.065,
    width: opts.width ?? 1.8
  });
}

/* generate lightning */
function generateBolt(x, y) {
  const start = randomEdgePoint();
  const dist = Math.hypot(x - start.x, y - start.y);

  const depth = Math.min(6, Math.max(4, Math.round(Math.log2(dist / 25))));
  const displace = dist * 0.4;

  const points = buildPath(start, { x, y }, displace, depth, true, 3);

  strike(points);

  /* occasional restrike along the same channel, a fraction dimmer/faster */
  if (Math.random() < 0.5) {
    setTimeout(() => {
      strike(points, { life: 0.6, decay: 0.09, width: 1.1 });
    }, 60 + Math.random() * 90);
  }
}

/* trigger */
function trigger(e) {
  const x = e.clientX || (e.touches && e.touches[0].clientX);
  const y = e.clientY || (e.touches && e.touches[0].clientY);
  if (x == null || y == null) return;

  generateBolt(x, y);
}

window.addEventListener("mousedown", trigger);
window.addEventListener("touchstart", e => {
  if (e.cancelable) e.preventDefault();
  trigger(e);
}, { passive: false });

/* render */
function drawBolt(b) {
  const alpha = Math.max(0, Math.pow(b.life, 1.4));
  const points = b.points;

  /* BLUE GLOW: one stroke for the whole path keeps the shadow cheap */
  ctx.shadowBlur = 18;
  ctx.shadowColor = `rgba(120,200,255,${alpha})`;
  ctx.strokeStyle = `rgba(120,200,255,${alpha * 0.65})`;
  ctx.lineWidth = b.width;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  /* YELLOW CORE: drawn per-segment (no shadow, cheap) so it can taper */
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(255,235,160,${alpha})`;

  const n = points.length - 1;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    ctx.lineWidth = Math.max(0.4, b.width * 0.5 * (1 - t * 0.65));
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, w, h);

  bolts.forEach(b => {
    b.life -= b.decay;
    drawBolt(b);
  });

  bolts = bolts.filter(b => b.life > 0);

  requestAnimationFrame(draw);
}

draw();
