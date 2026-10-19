import { useEffect, useRef } from 'react'
import { BAND_WIDTH, MAX_START_DISTANCE, WALK_SPEED } from '../lib/reach.js'
import { LOOP_MAX_TWICE, MOODS, OUT_AND_BACK_MIN_TWICE, TURN_ANGLE, explainWalk } from '../lib/moodwalk.js'
import { MOOD_COLORS, USE_LABELS } from '../lib/palette.js'

const MESSAGES = {
  loading: 'Loading the city kit…',
  idle: 'Click on the ground near a street. The walk starts and ends there.',
  busy: 'Finding a route…',
  noStreet: `No walkable street within ${MAX_START_DISTANCE} m of this point. Click closer to a street.`,
  noRoute: 'No walk could be found from this point. Try a point a little further in.',
  building: 'That is a building. Click on the ground next to it.',
}

const KIND_LABELS = { loop: 'Loop', partLoop: 'Loop, partly on the same streets', outAndBack: 'Out and back' }
const KIND_ICONS = { loop: '↻', partLoop: '↻', outAndBack: '⇄' }

const percent = (share) => `${Math.round(share * 100)} %`

export default function MoodWalkPanel({ status, walk, mood, onMood, onAnother, error }) {
  const statusRef = useRef(null)
  const cardRef = useRef(null)

  // On a small screen the panel scrolls; bring the new message or route into view, so a click on the map
  // never seems to do nothing.
  useEffect(() => {
    if (status === 'loading' || status === 'idle') return
    const target = status === 'done' && cardRef.current ? cardRef.current : statusRef.current
    target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [status, walk])

  const message = error
    ? `Something went wrong: ${error}`
    : status === 'done'
      ? `The walk starts and ends at the street node ${Math.round(walk.startDistance)} m from your click. Click elsewhere to move it.`
      : MESSAGES[status]

  return (
    <>
      <h1>Mood Walk</h1>
      <p className="subtitle">A suggested walk through central Weimar that starts and ends where you click.</p>

      <section className="step">
        <h2 className="step-title">
          <span className="step-number">1</span>Choose a mood
        </h2>
        <div className="moods" role="group" aria-label="Mood">
          {Object.entries(MOODS).map(([id, m]) => {
            const selected = mood === id
            return (
              <button
                key={id}
                type="button"
                className="mood"
                style={{ '--mood': MOOD_COLORS[id] }}
                aria-pressed={selected}
                onClick={() => onMood(id)}
              >
                <span className="mood-name">{m.label}</span>
                <span className="mood-time">≈ {m.minutes} min</span>
                <span className="mood-summary">{m.summary}</span>
                {selected && (
                  <span className="mood-selected">
                    <span className="mood-check" aria-hidden="true">
                      ✓
                    </span>
                    Selected
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="step">
        <h2 className="step-title">
          <span className="step-number">2</span>Click the map
        </h2>
        <p ref={statusRef} className={`status status-${error ? 'error' : status}`} role="status">
          {message}
        </p>
      </section>

      {walk && (
        <section className="step">
          <h2 className="step-title">
            <span className="step-number">3</span>Your route
          </h2>
          <div
            ref={cardRef}
            className={`walk-card${status === 'busy' ? ' is-busy' : ''}`}
            style={{ '--mood': MOOD_COLORS[walk.mood] }}
            aria-label="Suggested route"
          >
            <div className="walk-head">
              <span className="mood-tag">{MOODS[walk.mood].label}</span>
              <span className={`walk-kind kind-${walk.kind}`}>
                <span aria-hidden="true">{KIND_ICONS[walk.kind]}</span> {KIND_LABELS[walk.kind]}
              </span>
            </div>
            <dl className="walk-figures">
              <div>
                <dt>Distance</dt>
                <dd>{(walk.length / 1000).toFixed(1)} km</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>≈ {walk.minutes} min</dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>{MOODS[walk.mood].minutes} min</dd>
              </div>
            </dl>
            <div className="walk-text">
              {explainWalk(walk).map((sentence) => (
                <p key={sentence}>{sentence}</p>
              ))}
              {walk.mood === 'curious' && (
                <p className="walk-uses">
                  Building uses along the way: {walk.uses.map((use) => USE_LABELS[use].toLowerCase()).join(', ')}. The
                  mix of uses is a rough stand-in for urban variety; it does not measure how interesting a street is.
                </p>
              )}
            </div>
            <button type="button" className="another" onClick={onAnother} disabled={walk.variants < 2 || status === 'busy'}>
              Show another route <span className="another-count">{walk.variant + 1} of {walk.variants}</span>
            </button>
          </div>
        </section>
      )}

      <section className="about">
        <h2 className="about-title">About the route</h2>
        <details className="method">
          <summary>How the route is chosen</summary>
          <ul>
            <li>
              The walk starts and ends at the network node nearest to your click, if one is within {MAX_START_DISTANCE}{' '}
              m. Durations assume {(WALK_SPEED * 60) / 1000} km/h, which is {WALK_SPEED} m per minute. The targets of 15,
              30 and 45 minutes are approximate.
            </li>
            <li>
              About 60 candidate walks go out to one or two points on the network and come back, each part along the
              shortest way. On the way back, streets already walked count as five times their length, so the walk prefers
              other streets and forms a loop.
            </li>
            <li>
              <strong>Calm</strong> prefers walks close to 15 minutes with few turns. A turn is a change of direction of
              more than {TURN_ANGLE}° at a junction, where three or more street segments meet.
            </li>
            <li>
              <strong>Curious</strong> prefers walks close to 30 minutes that cover many different street stretches, from
              one junction to the next, and pass buildings of many different uses within {BAND_WIDTH} m. The building
              uses come from the kit; their mix stands in for urban variety and does not measure how interesting a place
              is.
            </li>
            <li>
              <strong>Energetic</strong> prefers walks close to 45 minutes.
            </li>
            <li>
              For every mood, walking the same street twice counts against a walk. It is called a loop when at most{' '}
              {percent(LOOP_MAX_TWICE)} of it is on streets walked twice, and an out-and-back walk from{' '}
              {percent(OUT_AND_BACK_MIN_TWICE)}.
            </li>
          </ul>
        </details>

        <details className="method">
          <summary>What the route does not know</summary>
          <p className="method-text">
            The kit has no data on greenery, noise, traffic, safety, lighting, slopes or steps, surfaces or opening
            hours. The moods are names for the length and shape of a walk. They do not say that a walk is safe, quiet,
            green or good for how you feel.
          </p>
        </details>
      </section>
    </>
  )
}
