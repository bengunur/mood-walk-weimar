// Loads the city kit from public/data/ and prepares it once, in metres, for drawing and for the walk.
import { makeProjection, openRing, polylineLength, ringsBBox } from './geo.js'
import { ringArea } from './residents.js'

async function fetchJson(name) {
  // BASE_URL is "/" on localhost and "/<repo>/" on GitHub Pages.
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}`)
  if (!response.ok) throw new Error(`data/${name}: ${response.status}`)
  return response.json()
}

export async function loadKit() {
  const [kit, buildings, streets, graph, zensus] = await Promise.all([
    fetchJson('kit.json'),
    fetchJson('buildings.geojson'),
    fetchJson('streets.geojson'),
    fetchJson('streets.graph.json'),
    fetchJson('zensus.geojson'),
  ])
  return prepareKit({ kit, buildings, streets, graph, zensus })
}

// Also used by the check script, which reads the same files from disk.
export function prepareKit({ kit, buildings, streets, graph, zensus }) {
  const proj = makeProjection(kit.center)
  const [west, south, east, north] = kit.bbox
  const [minX, minY] = proj.toXY([west, south])
  const [maxX, maxY] = proj.toXY([east, north])

  return {
    label: kit.label,
    proj,
    bounds: { minX, minY, maxX, maxY },
    buildings: prepareBuildings(buildings, proj),
    streetLines: streets.features.map((f) => f.geometry.coordinates.map(proj.toXY)),
    network: prepareNetwork(graph, proj),
    cells: prepareCells(zensus, proj),
  }
}

function prepareBuildings(collection, proj) {
  return collection.features.map((f) => {
    const rings = f.geometry.coordinates.map((ring) => openRing(ring).map(proj.toXY))
    return {
      id: f.properties.id,
      // One building in the kit has no use; it is shown with the buildings whose use is unknown.
      use: f.properties.use ?? 'undefined',
      height: f.properties.height,
      rings,
      bbox: ringsBBox(rings),
    }
  })
}

function prepareNetwork(graph, proj) {
  const nodes = new Map()
  for (const n of graph.nodes) nodes.set(n.id, { id: n.id, xy: proj.toXY([n.lon, n.lat]), edges: [] })

  const edges = []
  for (const e of graph.edges) {
    if (!e.walkable) continue
    const xy = e.coords.map(proj.toXY)
    const edge = { id: e.id, from: e.from, to: e.to, length: e.length, xy, drawnLength: polylineLength(xy) }
    edges.push(edge)
    nodes.get(e.from).edges.push(edge)
    nodes.get(e.to).edges.push(edge)
  }
  return { nodes, edges }
}

function prepareCells(collection, proj) {
  return collection.features.map((f) => {
    let ring = openRing(f.geometry.coordinates[0]).map(proj.toXY)
    if (ringArea(ring) < 0) ring = ring.reverse() // counter-clockwise, as the clipping expects
    return {
      id: f.properties.id,
      population: f.properties.population,
      ring,
      bbox: ringsBBox([ring]),
      area: ringArea(ring),
    }
  })
}
