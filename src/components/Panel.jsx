import { BAND_MINUTES, BAND_WIDTH, MAX_START_DISTANCE, WALK_SPEED } from '../lib/reach.js'
import { BAND_COLORS } from '../lib/palette.js'

const format = (n) => n.toLocaleString('en-GB')

const MESSAGES = {
  loading: 'Loading the city kit…',
  idle: 'Click on the ground to start a walk.',
  busy: 'Calculating the walk…',
  noStreet: `No walkable street within ${MAX_START_DISTANCE} m of this point. Click closer to a street.`,
  building: 'That is a building. Click on the ground next to it.',
}

export default function Panel({ status, reach, error }) {
  const message = error ? `Something went wrong: ${error}` : status === 'done' ? startText(reach) : MESSAGES[status]

  return (
    <aside className="panel">
      <h1>How far can you walk?</h1>
      <p className="subtitle">Central Weimar, on foot, from any point you click.</p>

      <p className={`status status-${error ? 'error' : status}`} role="status">
        {message}
      </p>

      <table className={`results${status === 'busy' ? ' is-busy' : ''}`}>
        <thead>
          <tr>
            <th scope="col">Walk</th>
            <th scope="col">Buildings</th>
            <th scope="col">Residents</th>
            <th scope="col" title="Census cells in the area with no published resident figure">
              Cells without figure
            </th>
          </tr>
        </thead>
        <tbody>
          {BAND_MINUTES.map((minutes, i) => {
            const band = reach ? reach.bands[i] : null
            return (
              <tr key={minutes}>
                <th scope="row">
                  <span className="swatch" style={{ background: BAND_COLORS[i] }} />
                  {minutes} min
                </th>
                <td>{band ? format(band.buildings) : '–'}</td>
                <td>{band ? `≈ ${format(band.residents)}` : '–'}</td>
                <td>{band ? band.cellsWithoutFigure : '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <details className="method" open>
        <summary>How it is calculated</summary>
        <ul>
          <li>
            Walking speed {(WALK_SPEED * 60) / 1000} km/h, which is {WALK_SPEED} m per minute, along the pedestrian
            network. The walk starts at the network node nearest to your click, if one is within {MAX_START_DISTANCE} m.
          </li>
          <li>
            Each area is the street segments reached in that time, including the reachable part of the last segment,
            with a band of {BAND_WIDTH} m on each side, joined into one shape.
          </li>
          <li>A building is counted when its footprint touches the area.</li>
          <li>
            Residents come from the 100 m cells of Zensus 2022. For every cell that overlaps the area, its population is
            multiplied by the share of the cell's area that lies inside. The sum is rounded to the nearest 10.
          </li>
          <li>
            Cells without a published figure are not zero. They are left out of the sum, and the table shows how many
            of them overlap each area.
          </li>
        </ul>
      </details>

      <p className="controls">Drag to orbit · right-drag to pan · scroll to zoom</p>
    </aside>
  )
}

function startText(reach) {
  return `Walk starts at the street node ${Math.round(reach.startDistance)} m from your click.`
}
