// Colours for the page. The walking areas use one accent, blue, in three shades from navy to light blue.
// The building uses stay in warm, muted tones without any blue, so reached buildings stand out.

export const NAVY = '#16263f'
export const TEAL = '#3e8a86' // the start marker and small highlights in the panel
export const GROUND = '#efede7'
export const BACKGROUND = '#e3e9ef'
export const STREET = '#7d8794'
// Mood Walk: one accent per mood, for the route, its arrows, the start marker and the panel.
// The route gets a navy edge, so even the light sage stands out on the pale ground and next to the buildings.
export const MOOD_COLORS = {
  calm: '#80b8a5',
  curious: '#e5ad65',
  energetic: '#ef7968',
}

// 5, 10 and 15 minutes
export const BAND_COLORS = ['#1f3c66', '#4f86c0', '#b4d3ec']

export const USE_COLORS = {
  residential: '#e7dfcf',
  service: '#cbb99b',
  office: '#a69c90',
  retail: '#e1ad80',
  food_and_drink: '#c98b6d',
  accommodation: '#d6a1ad',
  entertainment: '#b5869f',
  culture: '#8d6d8f',
  education: '#ddc46f',
  civic: '#a7b27a',
  health: '#c4757a',
  sport: '#8cae86',
  transport: '#666a70',
  light_industrial: '#977860',
  undefined: '#cfcfcc',
}

export const USE_LABELS = {
  residential: 'Residential',
  service: 'Service',
  office: 'Office',
  retail: 'Retail',
  food_and_drink: 'Food and drink',
  accommodation: 'Accommodation',
  entertainment: 'Entertainment',
  culture: 'Culture',
  education: 'Education',
  civic: 'Civic',
  health: 'Health',
  sport: 'Sport',
  transport: 'Transport',
  light_industrial: 'Light industrial',
  undefined: 'Use not known',
}

// The areas on the ground use a lighter mix of the same shades, so the reached buildings stand out on top of them.
export const AREA_COLORS = BAND_COLORS.map((color) => mix(color, GROUND, 0.3))

function mix(a, b, share) {
  const channel = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)
  const parts = [0, 1, 2].map((i) => Math.round(channel(a, i) * (1 - share) + channel(b, i) * share))
  return `#${parts.map((p) => p.toString(16).padStart(2, '0')).join('')}`
}
