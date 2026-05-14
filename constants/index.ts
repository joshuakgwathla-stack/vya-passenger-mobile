// ─── Colour palette ───────────────────────────────────────────────────────────
// Aligned to the web app (vya-passenger/app/globals.css).
// Web uses CSS variables; these are the resolved values for React Native.
// When the web palette changes, update both files together.

export const COLORS = {
  // Dark surfaces (navbar, auth screens, dark cards)
  navy:         '#1a1814',   // --bg-dark
  navyMid:      '#252118',   // --bg-dark-2
  navyDeep:     '#302c24',   // --bg-dark-3

  // Light surfaces (main content, cards)
  offWhite:     '#f5f0e6',   // --bg-base  (warm cream — main background)
  raised:       '#ede7d9',   // --bg-raised
  white:        '#ffffff',   // --bg-card

  // Gold / brass
  gold:         '#9c7a3c',   // --brass
  goldLight:    '#c9a96e',   // --brass-light
  goldDark:     '#7a5e28',   // --brass-dark

  // Borders
  border:       'rgba(26,24,20,0.09)',   // --border
  borderMid:    'rgba(26,24,20,0.15)',   // --border-mid
  borderDark:   'rgba(245,240,230,0.08)', // --border-dark (on dark surfaces)

  // Typography
  text:          '#1a1814',  // --text-primary
  textSecondary: '#6b6358',  // --text-secondary
  textMuted:     '#a09788',  // --text-muted
  textInverse:   '#f5f0e6',  // --text-inverse (light text on dark bg)

  // Semantic
  success:      '#3d6b4a',
  successLight: 'rgba(61,107,74,0.1)',
  danger:       '#8b3a35',
  dangerLight:  'rgba(139,58,53,0.1)',
  warning:      '#9c7a3c',   // same as brass on web
  warningLight: 'rgba(156,122,60,0.1)',
}

export const FONTS = {
  regular: 'System',
  medium:  'System',
  bold:    'System',
}

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://vya-backend-production.up.railway.app'

export const ORIGIN_CITIES = ['Johannesburg', 'Pretoria', 'Midrand']

// All canonical corridor nodes — the direct stops Vya serves
export const DESTINATION_CITIES = [
  'Polokwane', 'Thohoyandou', 'Tzaneen', 'Giyani',
  'Burgersfort', 'Mokopane', 'Makhado',
  'Phalaborwa', 'Lebowakgomo', 'Hoedspruit',
  'Mankweng', 'Bela-Bela', 'Modimolle', 'Mookgophong',
  'Lephalale', 'Musina', 'Modjadjiskloof', 'Letsitele',
  'Marble Hall',
]

// Aliases passengers might type → resolves to a canonical node + subtitle shown in dropdown
// Keep in sync with CITY_ALIASES in trips.controller.js
export type SearchSuggestion = {
  display: string   // What to show in the list (user-friendly label)
  node: string      // Canonical corridor node to pass to the search API
  subtitle: string  // "Direct stop" or "Served via X" — explains the resolution
}

export const SEARCH_ALIASES: Record<string, { node: string; display: string }> = {
  // University / campus names
  'turfloop':              { node: 'Mankweng',       display: 'Turfloop' },
  'university of limpopo': { node: 'Mankweng',       display: 'University of Limpopo' },
  'ul campus':             { node: 'Mankweng',       display: 'UL Campus' },
  'univen':                { node: 'Thohoyandou',    display: 'Univen (University of Venda)' },
  // Vhembe informal names
  'venda':                 { node: 'Thohoyandou',    display: 'Venda' },
  'sibasa':                { node: 'Thohoyandou',    display: 'Sibasa' },
  // Apartheid-era names still in everyday use
  'pietersburg':           { node: 'Polokwane',      display: 'Pietersburg' },
  'seshego':               { node: 'Polokwane',      display: 'Seshego' },
  'polokwane city':        { node: 'Polokwane',      display: 'Polokwane City' },
  'louis trichardt':       { node: 'Makhado',        display: 'Louis Trichardt' },
  'messina':               { node: 'Musina',         display: 'Messina' },
  'warmbaths':             { node: 'Bela-Bela',      display: 'Warmbaths' },
  'nylstroom':             { node: 'Modimolle',      display: 'Nylstroom' },
  'naboomspruit':          { node: 'Mookgophong',    display: 'Naboomspruit' },
  'potgietersrus':         { node: 'Mokopane',       display: 'Potgietersrus' },
  'duiwelskloof':          { node: 'Modjadjiskloof', display: 'Duiwelskloof' },
  // Border / landmark references
  'beitbridge':            { node: 'Musina',         display: 'Beitbridge area' },
  'zimbabwe border':       { node: 'Musina',         display: 'Zimbabwe border crossing' },
  // Shorthand
  'lbk':                   { node: 'Lebowakgomo',    display: 'LBK' },
}

// Builds autocomplete suggestions for the destination search input.
// Runs entirely on-device — no network round-trip needed.
export function getDestinationSuggestions(query: string): SearchSuggestion[] {
  const q = query.toLowerCase().trim()

  // Empty query — show curated popular list
  if (!q) {
    return [
      { display: 'Polokwane',    node: 'Polokwane',    subtitle: 'Direct stop' },
      { display: 'Thohoyandou', node: 'Thohoyandou',  subtitle: 'Direct stop · Vhembe' },
      { display: 'Tzaneen',     node: 'Tzaneen',      subtitle: 'Direct stop · Lowveld' },
      { display: 'Mankweng',    node: 'Mankweng',      subtitle: 'Direct stop · UL campus area' },
      { display: 'Giyani',      node: 'Giyani',        subtitle: 'Direct stop' },
      { display: 'Phalaborwa',  node: 'Phalaborwa',    subtitle: 'Direct stop · near Kruger Park' },
      { display: 'Musina',      node: 'Musina',        subtitle: 'Direct stop · Beitbridge border' },
    ]
  }

  const results: SearchSuggestion[] = []
  const seen = new Set<string>()

  // 1. Direct node matches (starts-with ranked above contains)
  const startsWithNodes = DESTINATION_CITIES.filter(c => c.toLowerCase().startsWith(q))
  const containsNodes   = DESTINATION_CITIES.filter(c => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q))
  for (const node of [...startsWithNodes, ...containsNodes]) {
    if (!seen.has(node)) {
      seen.add(node)
      results.push({ display: node, node, subtitle: 'Direct stop' })
    }
  }

  // 2. Alias matches
  for (const [alias, { node, display }] of Object.entries(SEARCH_ALIASES)) {
    if (alias.startsWith(q) || alias.includes(q) || display.toLowerCase().includes(q)) {
      const key = `${display}::${node}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({ display, node, subtitle: `Served via ${node}` })
      }
    }
  }

  return results.slice(0, 7)
}

export const TIME_SLOTS = ['10:00', '12:00', '15:00', '17:00', '19:00', '21:00']
