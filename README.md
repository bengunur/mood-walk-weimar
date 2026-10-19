# How far can you walk? Central Weimar

A 3D map of central Weimar that shows how far you can walk in 5, 10 and 15 minutes from any point you click, how many buildings you reach, and about how many people live there.

Buildings are drawn to their real height and coloured by their main use. Click on the ground: the walk starts at the nearest street node, three nested areas grow along the streets, the buildings they touch turn the matching shade of blue, and a panel lists buildings and residents for each walking time.

## Run it

```
npm install     install the packages
npm run dev     start the app at http://localhost:5173
```

Drag to orbit, right-drag to pan, scroll to zoom. Every push to `main` publishes the app to `https://<your-username>.github.io/<repo>/` through the workflow in `.github/workflows/`.

## Method

- **Walking speed.** 4.8 km/h, which is 80 m per minute, along the pedestrian network in `streets.graph.json`, using the length of each street segment in metres. 5, 10 and 15 minutes are 400, 800 and 1,200 m.
- **Start.** The walk starts at the network node nearest to the click. If no walkable node is within 100 m, the app says so and draws nothing.
- **Areas.** Each area is the street segments reached in that time, including the reachable part of the last segment, with a band of 25 m on each side, joined into one shape. It is not a circle and not a convex hull.
- **Buildings.** A building is counted when its footprint touches the area. It is coloured in the shade of the shortest walk that reaches it.
- **Residents.** From the 100 m cells of Zensus 2022. For every cell that overlaps the area, its population is multiplied by the share of the cell's area that lies inside. The sum is rounded to the nearest 10.
- **Cells without a figure.** A cell whose population is `null` has no published figure. It is not zero: it is left out of the sum, and the panel shows how many such cells overlap each area.

## Limits

- The network ends at the edge of the kit, so walks that start near the edge come out smaller than they would be in reality.
- The walk starts at the nearest node, not at the exact point clicked. The few metres between the two are not counted.
- Everyone walks at the same speed. Slopes, steps, crossings, traffic lights and opening times are not taken into account.
- Residents are assumed to be spread evenly over each 100 m cell, which is rarely true. The census also changes small counts slightly at random to protect privacy, so the figures are approximate.
- Building uses are the use with the largest floor area, and floor areas are estimates.

## Mood Walk

Switch the panel to **Mood Walk**, choose a mood and click on the ground. The app suggests a walk from that point, drawn in the colour of its mood (sage for Calm, amber for Curious, coral for Energetic) with arrows for the direction, and shows its distance, duration and a short explanation built from the measured numbers. "Show another route" gives up to five clearly different suggestions.

| Mood | Target | What it prefers |
| --- | --- | --- |
| Calm | about 15 min, 1,200 m | few turns at junctions |
| Curious | about 30 min, 2,400 m | many different street stretches, and buildings of many different uses within 25 m |
| Energetic | about 45 min, 3,600 m | the longer target length |

- **Candidates.** About 60 walks go out to one or two points on the network and come back, each part along the shortest way. On the way back, streets already walked count as five times their length, so the walk takes other streets where it can. Each candidate is scored for the mood, and walking a street twice counts against it for every mood.
- **Measures.** A turn is a change of direction of more than 40° at a junction, a node where three or more street segments meet. A street stretch runs from one junction to the next. Building uses come from `buildings.geojson`; their mix is a rough stand-in for urban variety, not a measure of how interesting a street is.
- **Loop or out and back.** A walk is called a loop when at most 20 % of it lies on streets walked twice, and an out-and-back walk from 80 %. In tests from 600 random points and from every dead end in the kit, all but one walk were loops; the one exception was a Calm walk partly on the same streets. Calm walks took 13 to 18 minutes, Curious 28 to 32 and Energetic 44 to 46.
- **Limits.** Durations are approximate targets at 4.8 km/h. The kit has no data on greenery, noise, traffic, safety, lighting, slopes, steps or opening hours, so the moods describe only the length and shape of a walk. They don't say that a walk is safe, quiet, green or good for how you feel.

## Data sources

The city kit in `public/data/` covers central Weimar, about 1.3 × 2 km. `public/data/SOURCES.md` lists every file, its source, licence and fields.

Buildings: 3D building models LoD2 © GDI-Th (dl-de/by-2-0). Land use and pedestrian network: Egor Gaydukov, InfAU, Bauhaus-Universität Weimar. Census grid: Zensus 2022, © Statistische Ämter des Bundes und der Länder (dl-de/by-2-0).

## How this was made

1. Tools: Claude Code, with the model Claude Opus 5.5.
2. I decided: I transformed the original walking accessibility map into Mood Walk, an interactive experience that suggests different walking routes based on three moods: Calm, Curious, and Energetic. I chose distinct visual identities for each mood and used measurable street-network characteristics instead of making unsupported claims about how a place feels.
3. The agent did: built the 3D walking map from the starter prompt (data loading, the walk along the network, the 25 m areas, the building and resident counts, the panel, legend and this README) and checked the numbers against a second calculation.
4. I checked: I tested all three moods on the local and published websites, verified that the suggested routes and walking durations worked as expected, and confirmed that the original Reach functionality was preserved.
