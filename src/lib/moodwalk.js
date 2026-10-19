// Mood Walk: a suggested walk from the clicked point, back to it where the network allows.
// It only knows the pedestrian network and the building uses. Nothing about greenery, noise, traffic or safety.
import { pointInPolygon, segmentDistance } from './geo.js'
import { BAND_WIDTH, MAX_START_DISTANCE, WALK_SPEED, nearestNode } from './reach.js'
import { USE_LABELS } from './palette.js'

// Durations are targets; the walks found come close to them, not exactly.
// The weights say how much each measure counts when the candidate walks are compared.
export const MOODS = {
  calm: { label: 'Calm', minutes: 15, summary: 'Shorter, with few turns', weights: { length: 2, repeated: 1.5, turns: 1.5 } },
  curious: { label: 'Curious', minutes: 30, summary: 'Many different streets and building uses', weights: { length: 2, repeated: 2, stretches: 0.8, uses: 0.8 } },
  energetic: { label: 'Energetic', minutes: 45, summary: 'Longer, further out', weights: { length: 3, repeated: 1.5 } },
}

export const TURN_ANGLE = 40 // degrees: a change of direction at a junction above this counts as a turn
// Share of the walk on streets walked twice, counting both times: up to this it is still called a loop,
// from the second figure on it is called an out-and-back walk, and in between a loop partly on the same streets.
export const LOOP_MAX_TWICE = 0.2
export const OUT_AND_BACK_MIN_TWICE = 0.8
const REUSE_PENALTY = 5 // on the way back, a street already walked counts as five times its length
const SUGGESTIONS = 5 // routes kept per start and mood for "Show another route"
const KNOWN_USES = Object.keys(USE_LABELS).filter((use) => use !== 'undefined')

const prepared = new WeakMap()

export function computeMoodWalk(kit, clickXY, mood, variant = 0) {
  const start = nearestNode(kit.network, clickXY)
  if (!start || start.distance > MAX_START_DISTANCE) return { noStreet: true, click: clickXY }

  if (!prepared.has(kit)) prepared.set(kit, prepare(kit))
  const extra = prepared.get(kit)
  const target = MOODS[mood].minutes * WALK_SPEED
  const startId = start.node.id

  const fromStart = shortestPaths(kit.network, startId, (edge) => edge.length)
  const random = seededRandom(hash(`${startId}/${mood}`))
  const candidates = []
  for (const waypoints of pickWaypoints(kit.network, startId, fromStart.dist, target, random)) {
    const steps = buildWalk(kit.network, startId, waypoints, fromStart)
    if (steps.length < 3) continue
    const measures = measure(kit, extra, steps)
    candidates.push({ steps, measures, score: score(measures, mood, target) })
  }
  if (candidates.length === 0) return { noRoute: true, click: clickXY }
  candidates.sort((a, b) => a.score - b.score)

  // The best walks that are clearly different from each other: at most 60 % of the way shared.
  const picks = []
  for (const candidate of candidates) {
    if (picks.every((pick) => sharedShare(candidate, pick) < 0.6)) picks.push(candidate)
    if (picks.length === SUGGESTIONS) break
  }
  const chosen = picks[variant % picks.length]
  const m = chosen.measures

  return {
    click: clickXY,
    start: { id: startId, xy: start.node.xy },
    startDistance: start.distance,
    mood,
    variant: variant % picks.length,
    variants: picks.length,
    target,
    ...m,
    minutes: Math.round(m.length / WALK_SPEED),
    kind: m.twice / m.length <= LOOP_MAX_TWICE ? 'loop' : m.twice / m.length < OUT_AND_BACK_MIN_TWICE ? 'partLoop' : 'outAndBack',
    path: walkLine(chosen.steps),
  }
}

// Plain sentences built from the measured numbers, for the panel.
export function explainWalk(walk) {
  const km = (walk.length / 1000).toFixed(1)
  const kindWords = { loop: 'loop', partLoop: 'loop, partly on the same streets,', outAndBack: 'out-and-back walk' }[walk.kind]
  const sentences = [`A ${km} km ${kindWords} of about ${walk.minutes} minutes, for a target of ${MOODS[walk.mood].minutes}.`]

  if (walk.mood === 'calm') {
    sentences.push(`It turns ${walk.turns} times at junctions; among the walks compared from here, those with fewer turns were preferred.`)
  } else if (walk.mood === 'curious') {
    sentences.push(
      `It covers ${walk.stretches} different street stretches and passes ${walk.junctions} junctions. Within 25 m of it are buildings of ${walk.uses.length} different uses.`,
    )
  } else {
    sentences.push(`At its farthest point it is ${round10(walk.farthest)} m from the start in a straight line.`)
  }

  if (walk.kind === 'outAndBack') {
    sentences.push(`No loop of about this length was found from here, so you come back along the same streets for most of the way.`)
  } else if (walk.repeated >= 10) {
    sentences.push(`On the way, ${round10(walk.repeated)} m go back along streets already walked.`)
  } else {
    sentences.push('It comes back to the start without walking any street twice.')
  }
  return sentences
}

const round10 = (n) => Math.round(n / 10) * 10

// Done once per kit: which edges form one street stretch, and which buildings lie along each edge.
function prepare(kit) {
  return { stretchOf: stretches(kit.network), buildingsNear: buildingsByEdge(kit) }
}

// A stretch runs from one junction (or dead end) to the next: edges joined at nodes with exactly two edges.
function stretches(network) {
  const stretchOf = new Map()
  let next = 0
  for (const first of network.edges) {
    if (stretchOf.has(first)) continue
    const queue = [first]
    stretchOf.set(first, next)
    while (queue.length > 0) {
      const edge = queue.pop()
      for (const id of [edge.from, edge.to]) {
        const node = network.nodes.get(id)
        if (node.edges.length !== 2) continue
        for (const other of node.edges) {
          if (stretchOf.has(other)) continue
          stretchOf.set(other, next)
          queue.push(other)
        }
      }
    }
    next++
  }
  return stretchOf
}

const GRID = 50 // metres

// For every edge, the buildings whose footprint comes within 25 m of it, as in the reach.
function buildingsByEdge(kit) {
  const cells = new Map()
  for (const edge of kit.network.edges) {
    for (let i = 0; i < edge.xy.length - 1; i++) {
      const a = edge.xy[i]
      const b = edge.xy[i + 1]
      for (let x = Math.floor((Math.min(a[0], b[0]) - BAND_WIDTH) / GRID); x <= Math.floor((Math.max(a[0], b[0]) + BAND_WIDTH) / GRID); x++) {
        for (let y = Math.floor((Math.min(a[1], b[1]) - BAND_WIDTH) / GRID); y <= Math.floor((Math.max(a[1], b[1]) + BAND_WIDTH) / GRID); y++) {
          const key = `${x},${y}`
          if (!cells.has(key)) cells.set(key, [])
          cells.get(key).push([a, b, edge])
        }
      }
    }
  }

  const near = new Map(kit.network.edges.map((edge) => [edge, []]))
  kit.buildings.forEach((building, i) => {
    const found = new Set()
    const [minX, minY, maxX, maxY] = building.bbox
    for (let x = Math.floor(minX / GRID); x <= Math.floor(maxX / GRID); x++) {
      for (let y = Math.floor(minY / GRID); y <= Math.floor(maxY / GRID); y++) {
        for (const [a, b, edge] of cells.get(`${x},${y}`) ?? []) {
          if (!found.has(edge) && segmentTouches(building, a, b)) found.add(edge)
        }
      }
    }
    for (const edge of found) near.get(edge).push(i)
  })
  return near
}

function segmentTouches(building, a, b) {
  if (pointInPolygon(a, building.rings)) return true
  for (const ring of building.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (segmentDistance(a, b, ring[j], ring[i]) <= BAND_WIDTH) return true
    }
  }
  return false
}

// Candidate walks: out to one or two waypoints and back. The waypoints are street nodes at a walking
// distance from the start that makes the whole walk come out near the target length.
function pickWaypoints(network, startId, dist, target, random) {
  const startXY = network.nodes.get(startId).xy
  const nodesBetween = (lo, hi) => {
    const out = []
    for (const [id, d] of dist) {
      // Dead ends are left out as waypoints, so no walk goes into one only to turn round.
      if (id !== startId && d >= lo * target && d <= hi * target && network.nodes.get(id).edges.length >= 2) out.push(id)
    }
    return out
  }
  const direction = (id) => {
    const [x, y] = network.nodes.get(id).xy
    return Math.atan2(y - startXY[1], x - startXY[0])
  }
  const choose = (list) => list[Math.floor(random() * list.length)]
  const sets = []

  // Two waypoints, 40° to 140° apart as seen from the start: the walk goes round a triangle.
  const near = nodesBetween(0.2, 0.4)
  for (let tries = 0; tries < 400 && sets.length < 40 && near.length > 1; tries++) {
    const a = choose(near)
    const b = choose(near)
    let angle = Math.abs(direction(a) - direction(b)) * (180 / Math.PI)
    if (angle > 180) angle = 360 - angle
    if (angle >= 40 && angle <= 140) sets.push([a, b])
  }

  // One waypoint: out one way, back another where the network allows.
  const far = nodesBetween(0.3, 0.5)
  for (let i = 0; i < 20 && far.length > 0; i++) sets.push([choose(far)])

  // A start at the edge of the kit may have no nodes that far: then the farthest ones it has.
  if (sets.length === 0) {
    const farthest = [...dist.keys()].filter((id) => id !== startId).sort((a, b) => dist.get(b) - dist.get(a))
    for (const id of farthest.slice(0, 10)) sets.push([id])
  }
  return sets
}

// The walk as a list of steps along edges, each with the node it leaves from and the node it arrives at.
// Each leg takes the shortest way, but streets already walked count as longer, so the way back takes others.
function buildWalk(network, startId, waypoints, fromStart) {
  const steps = pathTo(fromStart.via, startId, waypoints[0])
  const used = new Set(steps.map((step) => step.edge))
  let at = waypoints[0]
  for (const next of [...waypoints.slice(1), startId]) {
    const { via } = shortestPaths(network, at, (edge) => (used.has(edge) ? edge.length * REUSE_PENALTY : edge.length), next)
    const leg = pathTo(via, at, next)
    for (const step of leg) used.add(step.edge)
    steps.push(...leg)
    at = next
  }
  return steps
}

function measure(kit, extra, steps) {
  const { nodes } = kit.network
  const startXY = nodes.get(steps[0].from).xy
  const timesWalked = new Map()
  let length = 0
  let repeated = 0
  let turns = 0
  let junctions = 0
  let farthest = 0
  const stretchesSeen = new Set()
  const buildings = new Set()

  steps.forEach((step, i) => {
    const times = (timesWalked.get(step.edge) ?? 0) + 1
    timesWalked.set(step.edge, times)
    length += step.edge.length
    if (times > 1) repeated += step.edge.length
    stretchesSeen.add(extra.stretchOf.get(step.edge))
    for (const b of extra.buildingsNear.get(step.edge)) buildings.add(b)

    const xy = nodes.get(step.to).xy
    farthest = Math.max(farthest, Math.hypot(xy[0] - startXY[0], xy[1] - startXY[1]))

    // A junction is a node where three or more streets meet; the start itself is not counted.
    if (i > 0 && nodes.get(step.from).edges.length >= 3) {
      junctions++
      if (turnAngle(steps[i - 1], step) > TURN_ANGLE) turns++
    }
  })

  let twice = 0
  for (const [edge, times] of timesWalked) if (times > 1) twice += edge.length * times

  const uses = new Set()
  for (const b of buildings) if (KNOWN_USES.includes(kit.buildings[b].use)) uses.add(kit.buildings[b].use)

  return {
    length,
    repeated, // metres walked a second time
    twice, // metres on streets walked more than once, every time counted
    turns,
    junctions,
    farthest,
    stretches: stretchesSeen.size,
    buildings: buildings.size,
    uses: KNOWN_USES.filter((use) => uses.has(use)), // in the legend's order
    edges: timesWalked,
  }
}

// Lower is better. Each measure is scaled so that 1 is a large difference.
function score(m, mood, target) {
  const w = MOODS[mood].weights
  const km = m.length / 1000
  let s = (w.length * Math.abs(m.length - target)) / target + (w.repeated * m.repeated) / m.length
  if (w.turns) s += (w.turns * m.turns) / km / 10 // ten turns per kilometre count as 1
  if (w.stretches) s -= w.stretches * Math.min(1, m.stretches / km / 12) // twelve stretches per kilometre count as 1
  if (w.uses) s -= (w.uses * m.uses.length) / KNOWN_USES.length
  return s
}

// The change of direction, in degrees, from one step to the next where they meet.
function turnAngle(before, after) {
  const a = orientedLine(before)
  const b = orientedLine(after)
  const p = a[a.length - 2]
  const q = a[a.length - 1]
  const r = b[1]
  const inAngle = Math.atan2(q[1] - p[1], q[0] - p[0])
  const outAngle = Math.atan2(r[1] - q[1], r[0] - q[0])
  let angle = Math.abs(outAngle - inAngle) * (180 / Math.PI)
  if (angle > 180) angle = 360 - angle
  return angle
}

function orientedLine(step) {
  return step.from === step.edge.from ? step.edge.xy : [...step.edge.xy].reverse()
}

// The whole walk as one line in metres, for drawing.
function walkLine(steps) {
  const line = []
  for (const step of steps) {
    const part = orientedLine(step)
    line.push(...(line.length === 0 ? part : part.slice(1)))
  }
  return line
}

// The share of a's length that it shares with b.
function sharedShare(a, b) {
  let shared = 0
  for (const edge of a.measures.edges.keys()) if (b.measures.edges.has(edge)) shared += edge.length
  return shared / a.measures.length
}

// Shortest walking distances from one node (Dijkstra), with the edge used to reach each node.
// Stops early once `stopAt` is reached, if given.
function shortestPaths(network, fromId, cost, stopAt) {
  const dist = new Map([[fromId, 0]])
  const via = new Map()
  const heap = [[0, fromId]]
  while (heap.length > 0) {
    const [d, id] = heapPop(heap)
    if (d > dist.get(id)) continue
    if (id === stopAt) break
    for (const edge of network.nodes.get(id).edges) {
      const other = edge.from === id ? edge.to : edge.from
      const next = d + cost(edge)
      if (next < (dist.get(other) ?? Infinity)) {
        dist.set(other, next)
        via.set(other, edge)
        heapPush(heap, [next, other])
      }
    }
  }
  return { dist, via }
}

function pathTo(via, fromId, toId) {
  const steps = []
  let id = toId
  while (id !== fromId) {
    const edge = via.get(id)
    const previous = edge.from === id ? edge.to : edge.from
    steps.push({ edge, from: previous, to: id })
    id = previous
  }
  return steps.reverse()
}

// A small binary heap of [distance, node id], closest first.
function heapPush(heap, item) {
  heap.push(item)
  let i = heap.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (heap[parent][0] <= heap[i][0]) break
    ;[heap[parent], heap[i]] = [heap[i], heap[parent]]
    i = parent
  }
}

function heapPop(heap) {
  const top = heap[0]
  const last = heap.pop()
  if (heap.length > 0) {
    heap[0] = last
    let i = 0
    for (;;) {
      const l = 2 * i + 1
      const r = l + 1
      let smallest = i
      if (l < heap.length && heap[l][0] < heap[smallest][0]) smallest = l
      if (r < heap.length && heap[r][0] < heap[smallest][0]) smallest = r
      if (smallest === i) break
      ;[heap[smallest], heap[i]] = [heap[i], heap[smallest]]
      i = smallest
    }
  }
  return top
}

// The same start and mood always give the same suggestions.
function seededRandom(seed) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h
}
