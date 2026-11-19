// Cartography for the course atlas.
// One Robinson projection is used for the world plate and for every regional
// plate, so a seminar frame is literally a crop of the same drawing.

const KX = 0.8487;
const KY = 1.3523;

// Robinson coefficient table: latitude, x coefficient, y coefficient.
const TABLE = [
  [0, 1.0, 0.0], [5, 0.9986, 0.062], [10, 0.9954, 0.124],
  [15, 0.99, 0.186], [20, 0.9822, 0.248], [25, 0.973, 0.31],
  [30, 0.96, 0.372], [35, 0.9427, 0.434], [40, 0.9216, 0.4958],
  [45, 0.8962, 0.5571], [50, 0.8679, 0.6176], [55, 0.835, 0.6769],
  [60, 0.7986, 0.7346], [65, 0.7597, 0.7903], [70, 0.7186, 0.8435],
  [75, 0.6732, 0.8936], [80, 0.6213, 0.9394], [85, 0.5722, 0.9761],
  [90, 0.5322, 1.0],
];

function coeff(lat) {
  const a = Math.min(90, Math.abs(lat));
  const i = Math.min(TABLE.length - 2, Math.floor(a / 5));
  const [l0, x0, y0] = TABLE[i];
  const [l1, x1, y1] = TABLE[i + 1];
  const t = (a - l0) / (l1 - l0);
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

export const WORLD_W = 1000;
const S = WORLD_W / (2 * KX * Math.PI);
export const WORLD_H = 2 * KY * S;

export function project(lon, lat) {
  const [cx, cy] = coeff(lat);
  const x = KX * (lon * Math.PI) / 180 * cx;
  const y = KY * cy * (lat < 0 ? -1 : 1);
  return {
    x: WORLD_W / 2 + x * S,
    y: WORLD_H / 2 - y * S,
  };
}

// Inverse of the vertical Robinson term: which latitude sits at this y.
function latitudeAt(y) {
  const worldY = (WORLD_H / 2 - y) / S; // signed KY*cy
  const target = Math.min(KY, Math.abs(worldY));
  let lo = 0;
  let hi = 90;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (KY * coeff(mid)[1] < target) lo = mid;
    else hi = mid;
  }
  return worldY < 0 ? -(lo + hi) / 2 : (lo + hi) / 2;
}

export function loadRings(geojson) {
  const rings = [];
  for (const f of geojson.features || []) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      for (const ring of g.coordinates) rings.push(ring);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) for (const ring of poly) rings.push(ring);
    }
  }
  return rings;
}

const r1 = (n) => {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

function pathFromPoints(pts) {
  if (!pts.length) return "";
  let d = `M${r1(pts[0].x)} ${r1(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) d += `L${r1(pts[i].x)} ${r1(pts[i].y)}`;
  return d + "Z";
}

// Douglas–Peucker on projected points.
function simplify(points, tol) {
  if (points.length < 4) return points;
  const sq = tol * tol;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const p = points[a];
    const q = points[b];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    let best = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const r = points[i];
      const d = Math.abs(dy * (r.x - p.x) - dx * (r.y - p.y)) / len;
      const dd = d * d;
      if (dd > best) { best = dd; at = i; }
    }
    if (best > sq && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function worldLandPath(rings, tol = 0.5) {
  let d = "";
  for (const ring of rings) {
    const pts = ring.map(([lon, lat]) => project(lon, lat));
    // GeoJSON rings repeat the first vertex at the end. Drop it before
    // simplification: a zero-length baseline would collapse the ring.
    if (pts.length > 2 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) {
      pts.pop();
    }
    const simple = simplify(pts, tol);
    if (simple.length < 3) continue;
    d += pathFromPoints(simple);
  }
  return d;
}

export function horizonPath() {
  const pts = [];
  for (let lat = -90; lat <= 90; lat += 1) pts.push(project(180, lat));
  for (let lat = 90; lat >= -90; lat -= 1) pts.push(project(-180, lat));
  return pathFromPoints(pts);
}

export function worldGraticule(step = 30) {
  let d = "";
  for (let lon = -180; lon < 180; lon += step) {
    d += `M`;
    for (let lat = -88; lat <= 88; lat += 2) {
      const p = project(lon, lat);
      d += `${lat === -88 ? "" : "L"}${r1(p.x)} ${r1(p.y)}`;
    }
  }
  for (let lat = -60; lat <= 60; lat += step) {
    d += `M`;
    for (let lon = -180; lon <= 180; lon += 2) {
      const p = project(lon, lat);
      d += `${lon === -180 ? "" : "L"}${r1(p.x)} ${r1(p.y)}`;
    }
  }
  return d;
}

// Clip a lon/lat ring against a geographic rectangle (Sutherland–Hodgman).
function clipRing(ring, [w, s, e, n]) {
  const edges = [
    [(p) => p[0] >= w, (a, b) => [w, a[1] + ((b[1] - a[1]) * (w - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= e, (a, b) => [e, a[1] + ((b[1] - a[1]) * (e - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= s, (a, b) => [a[0] + ((b[0] - a[0]) * (s - a[1])) / (b[1] - a[1]), s]],
    [(p) => p[1] <= n, (a, b) => [a[0] + ((b[0] - a[0]) * (n - a[1])) / (b[1] - a[1]), n]],
  ];
  let out = ring.slice();
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    if (!input.length) break;
    let prev = input[input.length - 1];
    let prevIn = inside(prev);
    for (const cur of input) {
      const curIn = inside(cur);
      if (curIn) {
        if (!prevIn) out.push(cut(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(cut(prev, cur));
      }
      prev = cur;
      prevIn = curIn;
    }
  }
  return out;
}

function framePoints([w, s, e, n]) {
  const pts = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const lon = w + ((e - w) * i) / steps;
    pts.push(project(lon, s));
  }
  for (let i = 1; i <= steps; i++) {
    const lat = s + ((n - s) * i) / steps;
    pts.push(project(e, lat));
  }
  for (let i = 1; i <= steps; i++) {
    const lon = e - ((e - w) * i) / steps;
    pts.push(project(lon, n));
  }
  for (let i = 1; i <= steps; i++) {
    const lat = n - ((n - s) * i) / steps;
    pts.push(project(w, lat));
  }
  return pts;
}

function projectedBounds(bbox) {
  const fp = framePoints(bbox);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of fp) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function niceStep(span, target = 5) {
  const raw = span / target;
  const steps = [1, 2, 5, 10, 15, 20, 30, 45, 60];
  for (const s of steps) if (s >= raw) return s;
  return 60;
}

const LAT_LIMIT = 85;
const LON_LIMIT = 179.4;

export function normalizeBbox(seminar) {
  let [w, s, e, n] = seminar.bbox;
  const [lon, lat] = seminar.marker;
  const ok = (a, b, c, d) => a < c && b < d && lon >= a && lon <= c && lat >= b && lat <= d;
  if (ok(w, s, e, n)) return { bbox: [w, s, e, n], fixed: false };
  // content.json has one frame whose west and south values are transposed.
  // The marker is the authority: swap them rather than invent a new place.
  if (ok(s, w, e, n)) return { bbox: [s, w, e, n], fixed: true };
  return {
    bbox: [Math.min(w, lon), Math.min(s, lat), Math.max(e, lon), Math.max(n, lat)],
    fixed: true,
  };
}

// Every regional plate is a crop of the world drawing. Frames differ in
// extent, so the shorter side is opened up until the plate reaches the
// course's plate ratio. Near-global frames are capped at the map edge and
// keep their wider shape instead of being stretched.
export function fitFrame(bbox, marker, aspect = 4 / 3) {
  let [w, s, e, n] = bbox;
  const originalBounds = projectedBounds([w, s, e, n]);
  let bounds = originalBounds;
  const mp = project(marker[0], marker[1]);

  // Frames come in every extent. Open the shorter side until the plate
  // reaches the course ratio; if that would more than double the frame,
  // trim the longer side around the site instead. A frame never loses its
  // point and never grows past the world edge.
  for (let i = 0; i < 8; i++) {
    const ratio = bounds.width / bounds.height;
    if (Math.abs(ratio - aspect) < 0.004) break;

    if (ratio < aspect) {
      const targetW = bounds.height * aspect;
      if (targetW / bounds.width <= 2) {
        const k = targetW / bounds.width;
        const cx = (w + e) / 2;
        const lonSpan = Math.min((e - w) * k, LON_LIMIT * 2);
        w = Math.max(-LON_LIMIT, cx - lonSpan / 2);
        e = Math.min(LON_LIMIT, cx + lonSpan / 2);
      } else {
        const targetH = bounds.width / aspect;
        let top = mp.y - targetH / 2;
        let bottom = mp.y + targetH / 2;
        if (top < bounds.minY) { bottom += bounds.minY - top; top = bounds.minY; }
        if (bottom > bounds.maxY) { top -= bottom - bounds.maxY; bottom = bounds.maxY; }
        s = Math.max(s, latitudeAt(bottom));
        n = Math.min(n, latitudeAt(top));
      }
    } else {
      const targetH = bounds.width / aspect;
      if (targetH / bounds.height <= 2) {
        const cy = (bounds.minY + bounds.maxY) / 2;
        s = Math.max(-LAT_LIMIT, latitudeAt(cy + targetH / 2));
        n = Math.min(LAT_LIMIT, latitudeAt(cy - targetH / 2));
        if (s > n) [s, n] = [n, s];
      } else {
        const targetW = bounds.height * aspect;
        let left = mp.x - targetW / 2;
        let right = mp.x + targetW / 2;
        if (left < bounds.minX) { right += bounds.minX - left; left = bounds.minX; }
        if (right > bounds.maxX) { left -= right - bounds.maxX; right = bounds.maxX; }
        const k = (right - left) / bounds.width;
        const lonSpan = (e - w) * k;
        w = Math.max(w, marker[0] - lonSpan / 2);
        e = Math.min(e, marker[0] + lonSpan / 2);
      }
    }
    bounds = projectedBounds([w, s, e, n]);
    if (s >= n || w >= e) break;
  }

  return {
    bbox: [w, s, e, n].map((v) => Math.round(v * 10) / 10),
    bounds,
    ratio: bounds.width / bounds.height,
    adjusted:
      Math.abs(bounds.width - originalBounds.width) > 0.1 ||
      Math.abs(bounds.height - originalBounds.height) > 0.1,
  };
}

function landPathFor(rings, bbox, tol) {
  let land = "";
  for (const ring of rings) {
    const clipped = clipRing(ring, bbox);
    if (clipped.length < 3) continue;
    if (clipped[0][0] === clipped[clipped.length - 1][0] && clipped[0][1] === clipped[clipped.length - 1][1]) {
      clipped.pop();
    }
    const pts = clipped.map(([lon, lat]) => project(lon, lat));
    const simple = simplify(pts, tol);
    if (simple.length < 3) continue;
    land += pathFromPoints(simple);
  }
  return land;
}

export function regionalPlate(rings, bbox, marker, opts = {}) {
  const [w, s, e, n] = bbox;
  const bounds = projectedBounds(bbox);
  const land = landPathFor(rings, bbox, opts.tol || 0.6);

  const lonStep = niceStep(e - w, 5);
  const latStep = niceStep(n - s, 4);
  let grat = "";
  for (let lon = Math.ceil(w / lonStep) * lonStep; lon <= e; lon += lonStep) {
    grat += "M";
    for (let i = 0; i <= 24; i++) {
      const p = project(lon, s + ((n - s) * i) / 24);
      grat += `${i === 0 ? "" : "L"}${r1(p.x)} ${r1(p.y)}`;
    }
  }
  for (let lat = Math.ceil(s / latStep) * latStep; lat <= n; lat += latStep) {
    grat += "M";
    for (let i = 0; i <= 48; i++) {
      const p = project(w + ((e - w) * i) / 48, lat);
      grat += `${i === 0 ? "" : "L"}${r1(p.x)} ${r1(p.y)}`;
    }
  }

  const frame = pathFromPoints(framePoints(bbox));
  const mp = project(marker[0], marker[1]);
  return {
    land,
    grat,
    frame,
    viewBox: `${r1(bounds.minX)} ${r1(bounds.minY)} ${r1(bounds.width)} ${r1(bounds.height)}`,
    ratio: bounds.width / bounds.height,
    marker: {
      x: ((mp.x - bounds.minX) / bounds.width) * 100,
      y: ((mp.y - bounds.minY) / bounds.height) * 100,
    },
    lonStep,
    latStep,
  };
}

// A card-sized copy: land and the site only, no graticule. Drawn once per
// page as a symbol and reused, so eight thumbnails do not cost eight paths.
export function miniPlate(rings, bbox, marker) {
  const [w, s, e, n] = bbox;
  const bounds = projectedBounds(bbox);
  const land = landPathFor(rings, bbox, 0.9);
  const mp = project(marker[0], marker[1]);
  const box = `${r1(bounds.minX)} ${r1(bounds.minY)} ${r1(bounds.width)} ${r1(bounds.height)}`;
  return {
    land,
    viewBox: box,
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height,
    marker: {
      x: ((mp.x - bounds.minX) / bounds.width) * 100,
      y: ((mp.y - bounds.minY) / bounds.height) * 100,
      px: mp.x,
      py: mp.y,
    },
  };
}

export function worldMarkers(seminars) {
  return seminars.map((s) => {
    const p = project(s.marker[0], s.marker[1]);
    return {
      n: s.n,
      slug: s.slug,
      x: (p.x / WORLD_W) * 100,
      y: (p.y / WORLD_H) * 100,
    };
  });
}

const hemi = (value, pos, neg) => (Math.abs(value) < 0.05 ? "" : value > 0 ? pos : neg);

function range(a, b, pos, neg) {
  const ha = hemi(a, pos, neg);
  const hb = hemi(b, pos, neg);
  if (Math.abs(a) < 0.05) return `0° – ${Math.abs(b)}° ${hb}`;
  if (ha === hb) return `${Math.abs(a)}°–${Math.abs(b)}° ${hb}`;
  return `${Math.abs(a)}° ${ha} – ${Math.abs(b)}° ${hb}`;
}

export function formatBounds([w, s, e, n]) {
  return `${range(w, e, "в.д.", "з.д.")} · ${range(s, n, "с.ш.", "ю.ш.")}`;
}

export function formatPoint([lon, lat]) {
  const l = `${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? "в.д." : "з.д."}`;
  const b = `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "с.ш." : "ю.ш."}`;
  return `${b}, ${l}`;
}
