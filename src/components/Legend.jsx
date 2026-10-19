import { useState } from 'react'
import { MOODS } from '../lib/moodwalk.js'
import { MOOD_COLORS, USE_COLORS, USE_LABELS } from '../lib/palette.js'

export default function Legend({ mode }) {
  // Folded at first on narrow screens, so the map stays visible; one tap opens it.
  const [startOpen] = useState(() => !window.matchMedia('(max-width: 720px)').matches)
  return (
    <details className="legend" open={startOpen}>
      <summary>Building use</summary>
      <ul>
        {Object.entries(USE_COLORS).map(([use, color]) => (
          <li key={use}>
            <span className="swatch" style={{ background: color }} />
            {USE_LABELS[use]}
          </li>
        ))}
      </ul>
      {mode === 'mood' ? (
        <>
          <p className="legend-heading">Mood Walk route</p>
          <ul className="legend-moods">
            {Object.entries(MOODS).map(([id, m]) => (
              <li key={id}>
                <span className="route-swatch" style={{ background: MOOD_COLORS[id] }} />
                {m.label}
              </li>
            ))}
          </ul>
          <p className="legend-note">The route takes the colour of its mood; the arrows show the direction.</p>
        </>
      ) : (
        <p className="legend-note">Buildings reached on foot take the colour of their walking time.</p>
      )}
    </details>
  )
}
