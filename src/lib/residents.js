// Residents in an area, from the 100 m census cells of Zensus 2022.
// Works in metres: the area and each cell are first turned into x/y with the kit's projection.

// For every cell that overlaps the area: its population times the share of the cell's area inside.
// Cells with no published figure (population null) are not zero: they are left out and counted.
export function countResidents(areaXY, cells) {
  const [west, south, east, north] = polygonsBBox(areaXY)
  let sum = 0
  let cellsWithoutFigure = 0
  for (const cell of cells) {
    const [w, s, e, n] = cell.bbox
    if (e < west || w > east || n < south || s > north) continue
    const inside = overlapArea(areaXY, cell.ring)
    if (inside <= 0.01) continue // m²: the cell only touches the area's edge
    if (cell.population === null || cell.population === undefined) {
      cellsWithoutFigure++
      continue
    }
    sum += cell.population * (inside / cell.area)
  }
  return { residents: Math.round(sum / 10) * 10, residentsExact: sum, cellsWithoutFigure }
}

// Area in m² of the part of the area (polygons with holes) inside one cell.
// A census cell is a convex four-sided shape, so each ring can be clipped against its four sides
// one after another (Sutherland–Hodgman); the clipped rings give the overlap exactly.
function overlapArea(polygons, cellRing) {
  let total = 0
  for (const rings of polygons) {
    rings.forEach((ring, i) => {
      const a = Math.abs(ringArea(clipToConvex(ring, cellRing)))
      total += i === 0 ? a : -a // the first ring is the outline, the others are holes
    })
  }
  return total
}

function clipToConvex(subject, clip) {
  let output = subject
  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const a = clip[i]
    const b = clip[(i + 1) % clip.length]
    const input = output
    output = []
    for (let j = 0; j < input.length; j++) {
      const p = input[j]
      const q = input[(j + 1) % input.length]
      const pIn = side(a, b, p) >= 0
      const qIn = side(a, b, q) >= 0
      if (pIn) output.push(p)
      if (pIn !== qIn) output.push(crossing(a, b, p, q))
    }
  }
  return output
}

// Positive when p lies to the left of the line from a to b (inside, for a counter-clockwise cell).
function side(a, b, p) {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
}

function crossing(a, b, p, q) {
  const sp = side(a, b, p)
  const sq = side(a, b, q)
  const t = sp / (sp - sq)
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
}

// Signed area (shoelace formula): positive for counter-clockwise rings.
export function ringArea(ring) {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1])
  }
  return sum / 2
}

function polygonsBBox(polygons) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const rings of polygons) {
    for (const [x, y] of rings[0]) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return [minX, minY, maxX, maxY]
}
