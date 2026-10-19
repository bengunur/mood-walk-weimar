// Runs the walk in the background, so the 3D view stays smooth while it is calculated (about a second).
// The worker loads its own copy of the kit; the browser has the files cached by then.
import { loadKit } from './data.js'
import { computeReach } from './reach.js'

const kitReady = loadKit()

self.onmessage = async ({ data }) => {
  try {
    const kit = await kitReady
    self.postMessage({ id: data.id, result: computeReach(kit, data.click) })
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message })
  }
}
