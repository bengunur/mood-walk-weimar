// The walk: from the clicked point to the nearest street node, then along the network for 5, 10 and 15 minutes.
import { buffer, multiLineString } from '@turf/turf'
import { openRing, pointInPolygon, segmentDistance, slicePolyline } from './geo.js'
import { countResidents } from './residents.js'

export const WALK_SPEED = 80 // metres per minute, which is 4.8 km/h
export const BAND_MINUTES = [5, 10, 15]
export const BAND_WIDTH = 25 // metres on each side of a reached street
export const MAX_START_DISTANCE = 100 // metres from the click to the nearest walkable node

export function computeReach(kit, clickXY) {
  const start = nearestNode(kit.network, clickXY)
  if (!start || start.distance > MAX_START_DISTANCE) return { noStreet: true, click: clickXY }

  const longest = Math.max(...BAND_MINUTES) * WALK_SPEED
  const dist = walkDistances(kit.network, start.node.id, longest)

  const bands = BAND_MINUTES.map((minutes) => {
    const budget = minutes * WALK_SPEED
    const pieces = reachedPieces(kit.network, dist, budget)
    const area = bandArea(pieces, kit.proj)
    return { minutes, budget, pieces, area }
  })

  // levels[i] is 1, 2 or 3 for the shortest band (5, 10, 15 min) whose area touches building i, else 0.
  const levels = buildingLevels(kit.buildings, bands)

  for (let b = 0; b < bands.length; b++) {
    let count = 0
    for (const level of levels) if (level > 0 && level <= b + 1) count++
    bands[b].buildings = count
    Object.assign(bands[b], countResidents(bands[b].area, kit.cells))
  }

  return {
    click: clickXY,
    start: { id: start.node.id, xy: start.node.xy },
    startDistance: start.distance,
    bands: bands.map(({ pieces, ...band }) => band), // the pieces were only needed for the building test
    levels,
  }
}

export function nearestNode(network, xy) {
  let best = null
  for (const node of network.nodes.values()) {
    if (node.edges.length === 0) continue
    const d = Math.hypot(node.xy[0] - xy[0], node.xy[1] - xy[1])
    if (!best || d < best.distance) best = { node, distance: d }
  }
  return best
}

// Shortest walking distance in metres from the start to every node, up to `limit` (Dijkstra).
// With under a thousand nodes, picking the closest open node by a plain scan is fast enough.
export function walkDistances(network, startId, limit) {
  const dist = new Map([[startId, 0]])
  const done = new Set()
  const open = new Set([startId])
  while (open.size > 0) {
    let current = null
    for (const id of open) if (current === null || dist.get(id) < dist.get(current)) current = id
    open.delete(current)
    done.add(current)
    const d = dist.get(current)
    for (const edge of network.nodes.get(current).edges) {
      const other = edge.from === current ? edge.to : edge.from
      if (done.has(other)) continue
      const next = d + edge.length
      if (next <= limit && next < (dist.get(other) ?? Infinity)) {
        dist.set(other, next)
        open.add(other)
      }
    }
  }
  return dist
}

// The street lines reached within `budget` metres, including the reachable part of the last segment.
// A segment can be entered from either end; if the two parts meet, the whole segment is reached.
export function reachedPieces(network, dist, budget) {
  const pieces = []
  for (const edge of network.edges) {
    const fromLeft = budget - (dist.get(edge.from) ?? Infinity) // metres still to walk at the `from` end
    const toLeft = budget - (dist.get(edge.to) ?? Infinity)
    if (fromLeft <= 0 && toLeft <= 0) continue
    if (Math.max(fromLeft, 0) + Math.max(toLeft, 0) >= edge.length) {
      pieces.push(edge.xy)
      continue
    }
    // `length` is the network's length in metres; the drawn line is cut at the same share of its own length.
    const scale = edge.drawnLength / edge.length
    if (fromLeft > 0) pieces.push(slicePolyline(edge.xy, 0, fromLeft * scale))
    if (toLeft > 0) pieces.push(slicePolyline(edge.xy, edge.drawnLength - toLeft * scale, edge.drawnLength))
  }
  return pieces.filter((p) => p.length >= 2)
}

// The reached lines with a 25 m band on each side, joined into one shape.
// Returned in metres as a list of polygons, each a list of rings: the outline first, then any holes.
function bandArea(pieces, proj) {
  const lines = multiLineString(pieces.map((piece) => piece.map(proj.toLonLat)))
  const { geometry } = buffer(lines, BAND_WIDTH, { units: 'meters', steps: 8 })
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  return polygons.map((rings) => rings.map((ring) => openRing(ring).map(proj.toXY)))
}

// A building touches an area when its footprint comes within 25 m of a reached street line,
// which is the same as touching the 25 m band around it.
function buildingLevels(buildings, bands) {
  const grids = bands.map((band) => segmentGrid(band.pieces))
  const levels = new Uint8Array(buildings.length)
  buildings.forEach((building, i) => {
    // The bands are nested, so test the widest first and stop as soon as one misses.
    for (let b = bands.length - 1; b >= 0; b--) {
      if (!touches(building, grids[b])) break
      levels[i] = b + 1
    }
  })
  return levels
}

const GRID = 50 // metres

// Sorts the short straight pieces of the street lines into 50 m squares, so each building only checks those nearby.
function segmentGrid(pieces) {
  const cells = new Map()
  for (const piece of pieces) {
    for (let i = 0; i < piece.length - 1; i++) {
      const a = piece[i]
      const b = piece[i + 1]
      const x0 = Math.floor((Math.min(a[0], b[0]) - BAND_WIDTH) / GRID)
      const x1 = Math.floor((Math.max(a[0], b[0]) + BAND_WIDTH) / GRID)
      const y0 = Math.floor((Math.min(a[1], b[1]) - BAND_WIDTH) / GRID)
      const y1 = Math.floor((Math.max(a[1], b[1]) + BAND_WIDTH) / GRID)
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const key = `${x},${y}`
          if (!cells.has(key)) cells.set(key, [])
          cells.get(key).push([a, b])
        }
      }
    }
  }
  return cells
}

function touches(building, grid) {
  const [minX, minY, maxX, maxY] = building.bbox
  for (let x = Math.floor(minX / GRID); x <= Math.floor(maxX / GRID); x++) {
    for (let y = Math.floor(minY / GRID); y <= Math.floor(maxY / GRID); y++) {
      const segments = grid.get(`${x},${y}`)
      if (!segments) continue
      for (const [a, b] of segments) {
        if (pointInPolygon(a, building.rings)) return true
        for (const ring of building.rings) {
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            if (segmentDistance(a, b, ring[j], ring[i]) <= BAND_WIDTH) return true
          }
        }
      }
    }
  }
  return false
}
