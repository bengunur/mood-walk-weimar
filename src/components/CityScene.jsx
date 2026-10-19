import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Buildings from './Buildings.jsx'
import { AREA_COLORS, BACKGROUND, GROUND, MOOD_COLORS, NAVY, STREET, TEAL } from '../lib/palette.js'

// A click only counts if the mouse moved less than this many pixels, so turning the view never starts a walk.
const CLICK_TOLERANCE = 5

// Heights in metres above the ground for the flat layers, so they don't flicker into each other.
const LAYER_HEIGHT = { areas: [0.9, 0.6, 0.3], streets: 1.2, route: 2.5 }

export default function CityScene({ kit, reach, walk, onPick, onBuildingClick }) {
  return (
    // `flat` turns off tone mapping, so the colours on screen match the legend.
    <Canvas flat camera={{ position: [350, 1500, 1550], fov: 40, near: 5, far: 20000 }}>
      <color attach="background" args={[BACKGROUND]} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[-700, 900, 1000]} intensity={2.6} />
      <OrbitControls makeDefault enableDamping zoomToCursor minDistance={80} maxDistance={4500} maxPolarAngle={Math.PI * 0.46} />

      {/* The kit is drawn in metres: x to the east, y to the north, z up. Turning the group puts z up on screen. */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Ground
          bounds={kit.bounds}
          onClick={(e) => {
            if (e.delta > CLICK_TOLERANCE) return
            onPick([e.point.x, -e.point.z])
          }}
        />
        <Buildings
          buildings={kit.buildings}
          levels={reach?.levels}
          onClick={(e) => {
            // Stops the click from also reaching the ground behind the building.
            e.stopPropagation()
            if (e.delta > CLICK_TOLERANCE) return
            onBuildingClick()
          }}
        />
        <Streets lines={kit.streetLines} />
        {reach && <ReachAreas bands={reach.bands} />}
        {reach && <StartMarker xy={reach.start.xy} />}
        {walk && <Route path={walk.path} color={MOOD_COLORS[walk.mood]} />}
        {walk && <StartMarker xy={walk.start.xy} color={MOOD_COLORS[walk.mood]} stemColor={NAVY} ringColor={NAVY} />}
      </group>
    </Canvas>
  )
}

function Ground({ bounds, onClick }) {
  const margin = 60
  const width = bounds.maxX - bounds.minX + 2 * margin
  const depth = bounds.maxY - bounds.minY + 2 * margin
  const center = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0]
  return (
    <mesh position={center} onClick={onClick}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color={GROUND} />
    </mesh>
  )
}

function Streets({ lines }) {
  const geometry = useMemo(() => {
    const points = []
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        points.push(line[i][0], line[i][1], LAYER_HEIGHT.streets, line[i + 1][0], line[i + 1][1], LAYER_HEIGHT.streets)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return g
  }, [lines])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={STREET} />
    </lineSegments>
  )
}

// The three areas, flat on the ground, the 15-minute one lowest so the shorter walks lie on top of it.
function ReachAreas({ bands }) {
  return [...bands].reverse().map((band) => {
    const index = bands.indexOf(band)
    return <AreaLayer key={band.minutes} polygons={band.area} color={AREA_COLORS[index]} height={LAYER_HEIGHT.areas[index]} />
  })
}

function AreaLayer({ polygons, color, height }) {
  const { fill, outline } = useMemo(() => {
    const toVectors = (ring) => ring.map(([x, y]) => new THREE.Vector2(x, y))
    const shapes = polygons.map((rings) => {
      const shape = new THREE.Shape(toVectors(rings[0]))
      shape.holes = rings.slice(1).map((ring) => new THREE.Path(toVectors(ring)))
      return shape
    })
    const points = []
    for (const rings of polygons) {
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i]
          const b = ring[(i + 1) % ring.length]
          points.push(a[0], a[1], 0.05, b[0], b[1], 0.05)
        }
      }
    }
    const lines = new THREE.BufferGeometry()
    lines.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return { fill: new THREE.ShapeGeometry(shapes), outline: lines }
  }, [polygons])

  useEffect(
    () => () => {
      fill.dispose()
      outline.dispose()
    },
    [fill, outline],
  )

  return (
    <group position={[0, 0, height]}>
      <mesh geometry={fill}>
        <meshBasicMaterial color={color} />
      </mesh>
      {/* A thin white edge keeps neighbouring shades apart. */}
      <lineSegments geometry={outline}>
        <lineBasicMaterial color="#ffffff" />
      </lineSegments>
    </group>
  )
}

// The Mood Walk route as a thick line just above the streets, with an arrow every 120 m for the direction.
const ARROW_SPACING = 120 // metres
// An arrowhead 24 m long and 20 m wide, pointing along +x, and a larger one under it for its navy edge.
const arrowShape = (size) =>
  new THREE.Shape([[12, 0], [-12, 10], [-6, 0], [-12, -10]].map(([x, y]) => new THREE.Vector2(x * size, y * size)))
const ARROW_SHAPE = arrowShape(1)
const ARROW_EDGE_SHAPE = arrowShape(1.4)

// The route in the colour of its mood, on a navy edge that keeps it readable over the ground, streets and buildings.
function Route({ path, color }) {
  const points = useMemo(() => path.map(([x, y]) => [x, y, LAYER_HEIGHT.route]), [path])
  const arrows = useMemo(() => {
    const out = []
    let next = ARROW_SPACING / 2
    let walked = 0
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i]
      const [bx, by] = path[i + 1]
      const len = Math.hypot(bx - ax, by - ay)
      while (len > 0 && next <= walked + len) {
        const t = (next - walked) / len
        out.push({ xy: [ax + (bx - ax) * t, ay + (by - ay) * t], angle: Math.atan2(by - ay, bx - ax) })
        next += ARROW_SPACING
      }
      walked += len
    }
    return out
  }, [path])

  return (
    <group>
      <Line points={points} color={NAVY} lineWidth={8} />
      <Line points={points} color={color} lineWidth={4.5} position={[0, 0, 0.3]} />
      {arrows.map(({ xy, angle }, i) => (
        // A flat arrowhead in the mood colour with a navy edge, pointing along the walk.
        <group key={i} position={[xy[0], xy[1], LAYER_HEIGHT.route + 1]} rotation={[0, 0, angle]}>
          <mesh position={[-1.5, 0, 0]}>
            <shapeGeometry args={[ARROW_EDGE_SHAPE]} />
            <meshBasicMaterial color={NAVY} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.5]}>
            <shapeGeometry args={[ARROW_SHAPE]} />
            <meshBasicMaterial color={color} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// A pin at the street node where the walk starts: teal for the reach; for a Mood Walk the mood colour
// on a navy stem, with a navy ring round the ball so it stands out when seen from above.
function StartMarker({ xy, color = TEAL, stemColor = TEAL, ringColor }) {
  const height = 60
  return (
    <group position={[xy[0], xy[1], 0]}>
      <mesh position={[0, 0, height / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3, 3, height, 12]} />
        <meshLambertMaterial color={stemColor} />
      </mesh>
      <mesh position={[0, 0, height]}>
        <sphereGeometry args={[12, 24, 16]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {ringColor && (
        <mesh position={[0, 0, height]}>
          <torusGeometry args={[12.5, 2.5, 8, 32]} />
          <meshBasicMaterial color={ringColor} />
        </mesh>
      )}
    </group>
  )
}
