// Runs the walks in the background, so the 3D view stays smooth while they are calculated (about a second).
// The worker loads its own copy of the kit; the browser has the files cached by then.
// Each message says its kind: "reach" for the 5, 10 and 15-minute areas, "mood" for a Mood Walk route.
import { loadKit } from './data.js'
import { computeReach } from './reach.js'
import { computeMoodWalk } from './moodwalk.js'

const kitReady = loadKit()

self.onmessage = async ({ data }) => {
  try {
    const kit = await kitReady
    const result = data.kind === 'mood' ? computeMoodWalk(kit, data.click, data.mood, data.variant) : computeReach(kit, data.click)
    self.postMessage({ id: data.id, kind: data.kind, result })
  } catch (error) {
    self.postMessage({ id: data.id, kind: data.kind, error: error.message })
  }
}
