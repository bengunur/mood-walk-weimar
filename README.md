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

## Data sources

The city kit in `public/data/` covers central Weimar, about 1.3 × 2 km. `public/data/SOURCES.md` lists every file, its source, licence and fields.

Buildings: 3D building models LoD2 © GDI-Th (dl-de/by-2-0). Land use and pedestrian network: Egor Gaydukov, InfAU, Bauhaus-Universität Weimar. Census grid: Zensus 2022, © Statistische Ämter des Bundes und der Länder (dl-de/by-2-0).

## How this was made

1. Tools: Claude Code, with the model Claude Opus 5.5.
2. I decided:
3. The agent did: built the 3D walking map from the starter prompt (data loading, the walk along the network, the 25 m areas, the building and resident counts, the panel, legend and this README) and checked the numbers against a second calculation.
4. I checked:
