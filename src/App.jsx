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
  const [reach, setReach] = useState(null)
  // loading, idle, busy, done, noStreet or building
  const [status, setStatus] = useState('loading')

  const worker = useRef(null)
  const lastRequest = useRef(0)

  useEffect(() => {
    loadKit()
      .then((k) => {
        setKit(k)
        setStatus('idle')
      })
      .catch((e) => setError(e.message))

    const w = new Worker(new URL('./lib/reach.worker.js', import.meta.url), { type: 'module' })
    w.onmessage = ({ data }) => {
      if (data.id !== lastRequest.current) return // an older click, already replaced by a newer one
      if (data.error) return setError(data.error)
      if (data.result.noStreet) {
        setReach(null)
        setStatus('noStreet')
      } else {
        setReach(data.result)
        setStatus('done')
      }
    }
    worker.current = w
    return () => w.terminate()
  }, [])

  const pick = useCallback((click) => {
    lastRequest.current += 1
    setStatus('busy')
    worker.current.postMessage({ id: lastRequest.current, click })
  }, [])

  const buildingClicked = useCallback(() => setStatus('building'), [])

  return (
    <div className="app">
      {kit && <CityScene kit={kit} reach={reach} onPick={pick} onBuildingClick={buildingClicked} />}
      <Panel status={status} reach={reach} error={error} />
      <Legend />
      <footer className="attribution">{ATTRIBUTION}</footer>
    </div>
  )
}
