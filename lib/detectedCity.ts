import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { ORIGIN_CITIES } from '../constants'

const KEY = 'vya_origin_city'

export const getSavedCity = (): Promise<string | null> => AsyncStorage.getItem(KEY)
export const saveCity = (city: string): Promise<void> => AsyncStorage.setItem(KEY, city)

/**
 * Province → city map.
 * When we add Limpopo → Gauteng return routes, add Limpopo cities
 * to ORIGIN_CITIES in constants and add an entry here.
 */
const PROVINCE_MAP: Record<string, { cities: string[]; default: string }> = {
  Gauteng: {
    cities: ['Pretoria', 'Midrand', 'Johannesburg'],
    default: 'Johannesburg',
  },
  Limpopo: {
    cities: ['Polokwane', 'Thohoyandou', 'Tzaneen'],
    default: 'Polokwane',
  },
  // Add more provinces here as routes expand
}

/** Keywords used to resolve a sub-city within a province */
const CITY_KEYWORDS: Record<string, string[]> = {
  Pretoria:     ['pretoria', 'tshwane', 'centurion', 'soshanguve', 'mamelodi', 'hatfield'],
  Midrand:      ['midrand', 'halfway house', 'kyalami'],
  Johannesburg: ['johannesburg', 'joburg', 'soweto', 'sandton', 'randburg',
                 'roodepoort', 'germiston', 'boksburg', 'benoni', 'alberton',
                 'edenvale', 'kempton', 'fourways', 'alexandra', 'bedfordview'],
  Polokwane:    ['polokwane', 'pietersburg'],
  Thohoyandou:  ['thohoyandou', 'venda', 'vhembe'],
  Tzaneen:      ['tzaneen', 'letaba'],
}

function resolveCity(region: string, subregion: string, city: string): string | null {
  const loc = `${region} ${subregion} ${city}`.toLowerCase()

  // Step 1 — identify province
  const province = Object.keys(PROVINCE_MAP).find(p => loc.includes(p.toLowerCase()))
  if (!province) return null

  // Step 2 — resolve sub-city within province using keywords
  const { cities, default: fallback } = PROVINCE_MAP[province]
  for (const candidate of cities) {
    const keywords = CITY_KEYWORDS[candidate] || [candidate.toLowerCase()]
    if (keywords.some(kw => loc.includes(kw)) && ORIGIN_CITIES.includes(candidate)) {
      return candidate
    }
  }

  // Step 3 — fall back to province default if it's a valid origin
  return ORIGIN_CITIES.includes(fallback) ? fallback : null
}

/**
 * Request location permission, reverse-geocode, and return the
 * closest origin city. Returns null if permission denied or no match.
 */
export const detectOriginCity = async (): Promise<string | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return null

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })
    const [place] = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    })
    if (!place) return null

    return resolveCity(place.region || '', place.subregion || '', place.city || '')
  } catch {
    return null
  }
}
