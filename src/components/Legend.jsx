import { USE_COLORS, USE_LABELS } from '../lib/palette.js'

export default function Legend() {
  return (
    <details className="legend" open>
      <summary>Building use</summary>
      <ul>
        {Object.entries(USE_COLORS).map(([use, color]) => (
          <li key={use}>
            <span className="swatch" style={{ background: color }} />
            {USE_LABELS[use]}
          </li>
        ))}
      </ul>
      <p className="legend-note">Buildings reached on foot take the colour of their walking time.</p>
    </details>
  )
}
