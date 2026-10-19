import { useCallback, useEffect, useRef, useState } from 'react'
import CityScene from './components/CityScene.jsx'
import Legend from './components/Legend.jsx'
import Panel from './components/Panel.jsx'
import { loadKit } from './lib/data.js'

// Worded exactly as in public/data/SOURCES.md.
const ATTRIBUTION =
  'Buildings: 3D building models LoD2 © GDI-Th (dl-de/by-2-0). Land use and pedestrian network: Egor Gaydukov, InfAU, Bauhaus-Universität Weimar. Census grid: Zensus 2022, © Statistische Ämter des Bundes und der Länder (dl-de/by-2-0).'

export default function App() {
  const [kit, setKit] = useState(null)
  const [error, setError] = useState(null)
  // reach or mood: which of the two tools a click on the map goes to
  const [mode, setMode] = useState('reach')
  const [reach, setReach] = useState(null)
  // loading, idle, busy, done, noStreet or building
  const [status, setStatus] = useState('loading')
  const [mood, setMood] = useState('calm')
  const [walk, setWalk] = useState(null)
  // the same states as `status`, plus noRoute, for Mood Walk
  const [walkStatus, setWalkStatus] = useState('loading')

  const worker = useRef(null)
  const lastRequest = useRef({ reach: 0, mood: 0 })
  // The last Mood Walk request, so a new mood or "another route" can reuse its starting point.
  const walkRequest = useRef(null)

  useEffect(() => {
    loadKit()
      .then((k) => {
        setKit(k)
        setStatus('idle')
        setWalkStatus('idle')
      })
      .catch((e) => setError(e.message))

    const w = new Worker(new URL('./lib/reach.worker.js', import.meta.url), { type: 'module' })
    w.onmessage = ({ data }) => {
      if (data.id !== lastRequest.current[data.kind]) return // an older click, already replaced by a newer one
      if (data.error) return setError(data.error)
      const [setResult, setState] = data.kind === 'mood' ? [setWalk, setWalkStatus] : [setReach, setStatus]
      if (data.result.noStreet || data.result.noRoute) {
        setResult(null)
        setState(data.result.noStreet ? 'noStreet' : 'noRoute')
      } else {
        setResult(data.result)
        setState('done')
      }
    }
    worker.current = w
    return () => w.terminate()
  }, [])

  const send = useCallback((kind, message) => {
    lastRequest.current[kind] += 1
    worker.current.postMessage({ id: lastRequest.current[kind], kind, ...message })
  }, [])

  const requestWalk = useCallback(
    (request) => {
      walkRequest.current = request
      setWalkStatus('busy')
      send('mood', request)
    },
    [send],
  )

  const pick = useCallback(
    (click) => {
      if (mode === 'mood') return requestWalk({ click, mood, variant: 0 })
      setStatus('busy')
      send('reach', { click })
    },
    [mode, mood, requestWalk, send],
  )

  const buildingClicked = useCallback(() => (mode === 'mood' ? setWalkStatus('building') : setStatus('building')), [mode])

  // A new mood with a start already chosen finds a new route from the same start.
  const chooseMood = useCallback(
    (next) => {
      setMood(next)
      if (walkRequest.current) requestWalk({ ...walkRequest.current, mood: next, variant: 0 })
    },
    [requestWalk],
  )

  const anotherRoute = useCallback(() => {
    if (walk) requestWalk({ ...walkRequest.current, variant: walk.variant + 1 })
  }, [walk, requestWalk])

  return (
    <div className="app">
      {kit && (
        <CityScene
          kit={kit}
          reach={mode === 'reach' ? reach : null}
          walk={mode === 'mood' ? walk : null}
          onPick={pick}
          onBuildingClick={buildingClicked}
        />
      )}
      <Panel
        mode={mode}
        onMode={setMode}
        error={error}
        reachProps={{ status, reach }}
        moodProps={{ status: walkStatus, walk, mood, onMood: chooseMood, onAnother: anotherRoute }}
      />
      <Legend mode={mode} />
      <footer className="attribution">{ATTRIBUTION}</footer>
    </div>
  )
}
