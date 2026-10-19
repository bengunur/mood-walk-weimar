// Small geometry helpers. Everything here works in metres on a flat plane.

const EARTH_RADIUS = 6371008.8 // metres
const RAD = Math.PI / 180

// Turns longitude/latitude into metres east (x) and north (y) of a centre point, and back.
// Over the 2 km of the kit, the error of this flat approximation is far below 1 %.
export function makeProjection([lon0, lat0]) {
  const kx = RAD * EARTH_RADIUS * Math.cos(lat0 * RAD)
  const ky = RAD * EARTH_RADIUS
  return {
    toXY: ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky],
    toLonLat: ([x, y]) => [x / kx + lon0, y / ky + lat0],
  }
}

// GeoJSON rings repeat their first point at the end; three.js and the tests below don't want that.
export function openRing(ring) {
  const a = ring[0]
  const b = ring[ring.length - 1]
  return a[0] === b[0] && a[1] === b[1] ? ring.slice(0, -1) : ring
}

export function polylineLength(points) {
  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  }
  return length
}

// The part of a polyline between distance `from` and distance `to` along it.
export function slicePolyline(points, from, to) {
  const out = []
  let walked = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const start = walked
    walked += len
    if (len === 0 || walked < from || start > to) continue
    const t0 = Math.max(0, (from - start) / len)
    const t1 = Math.min(1, (to - start) / len)
    if (out.length === 0) out.push(lerp(a, b, t0))
    out.push(lerp(a, b, t1))
  }
  return out
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

export function pointSegmentDistance(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

function segmentsCross(a, b, c, d) {
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

// Shortest distance between segment a–b and segment c–d.
export function segmentDistance(a, b, c, d) {
  if (segmentsCross(a, b, c, d)) return 0
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  )
}

export function pointInRing(p, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// Inside the outer ring and not inside any hole.
export function pointInPolygon(p, rings) {
  if (!pointInRing(p, rings[0])) return false
  for (let i = 1; i < rings.length; i++) if (pointInRing(p, rings[i])) return false
  return true
}

export function ringsBBox(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return [minX, minY, maxX, maxY]
}
