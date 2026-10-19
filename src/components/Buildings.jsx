import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BAND_COLORS, USE_COLORS } from '../lib/palette.js'

// All buildings as one mesh, so orbiting stays smooth. Each building keeps its own range of
// vertices, so a new walk only repaints colours and never rebuilds the shapes.
export default function Buildings({ buildings, levels, onClick }) {
  const { geometry, ranges } = useMemo(() => buildGeometry(buildings), [buildings])

  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const useColors = Object.fromEntries(Object.entries(USE_COLORS).map(([k, v]) => [k, new THREE.Color(v)]))
    const bandColors = BAND_COLORS.map((c) => new THREE.Color(c))
    const colors = geometry.attributes.color
    buildings.forEach((building, i) => {
      const level = levels ? levels[i] : 0
      const color = level > 0 ? bandColors[level - 1] : useColors[building.use] ?? useColors.undefined
      const [start, count] = ranges[i]
      for (let v = start; v < start + count; v++) colors.setXYZ(v, color.r, color.g, color.b)
    })
    colors.needsUpdate = true
  }, [buildings, geometry, ranges, levels])

  return (
    <mesh geometry={geometry} onClick={onClick}>
      <meshLambertMaterial vertexColors />
    </mesh>
  )
}

function buildGeometry(buildings) {
  const parts = []
  const ranges = []
  let offset = 0
  for (const building of buildings) {
    const shape = new THREE.Shape(building.rings[0].map(([x, y]) => new THREE.Vector2(x, y)))
    shape.holes = building.rings.slice(1).map((ring) => new THREE.Path(ring.map(([x, y]) => new THREE.Vector2(x, y))))
    // Extruded upwards from the ground to the building's height in metres.
    const part = new THREE.ExtrudeGeometry(shape, { depth: building.height, bevelEnabled: false })
    const count = part.attributes.position.count
    ranges.push([offset, count])
    offset += count
    parts.push(part)
  }
  const geometry = mergeGeometries(parts)
  parts.forEach((part) => part.dispose())
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(offset * 3), 3))
  return { geometry, ranges }
}
