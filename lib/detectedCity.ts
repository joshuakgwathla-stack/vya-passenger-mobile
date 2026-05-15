import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'

const KEY = 'vya_origin_city'

export const getSavedCity = (): Promise<string | null> => AsyncStorage.getItem(KEY)
export const saveCity = (city: string): Promise<void> => AsyncStorage.setItem(KEY, city)

const CITY_CENTRES: Record<string, { lat: number; lng: number }> = {
  'Johannesburg':   { lat: -26.2041, lng: 28.0473 },
  'Midrand':        { lat: -25.9967, lng: 28.1280 },
  'Pretoria':       { lat: -25.7479, lng: 28.2293 },
  'Polokwane':      { lat: -23.9045, lng: 29.4689 },
  'Thohoyandou':    { lat: -22.9486, lng: 30.4865 },
  'Tzaneen':        { lat: -23.8304, lng: 30.1622 },
  'Burgersfort':    { lat: -24.6564, lng: 30.3345 },
  'Giyani':         { lat: -23.3028, lng: 30.7191 },
  'Mokopane':       { lat: -24.1953, lng: 29.0132 },
  'Makhado':        { lat: -23.0407, lng: 29.9045 },
  'Phalaborwa':     { lat: -23.9408, lng: 31.1432 },
  'Lebowakgomo':    { lat: -24.0035, lng: 29.4897 },
  'Hoedspruit':     { lat: -24.3506, lng: 30.9234 },
  'Mankweng':       { lat: -23.8756, lng: 29.7361 },
  'Musina':         { lat: -22.3440, lng: 30.0456 },
  'Bela-Bela':      { lat: -24.8929, lng: 28.2890 },
  'Modimolle':      { lat: -24.7003, lng: 28.4039 },
  'Mookgophong':    { lat: -24.5130, lng: 28.7500 },
  'Lephalale':      { lat: -23.6748, lng: 27.7135 },
  'Modjadjiskloof': { lat: -23.6700, lng: 30.1900 },
  'Letsitele':      { lat: -23.8830, lng: 30.3730 },
  'Marble Hall':    { lat: -24.9780, lng: 29.2890 },
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function getNearestCity(lat: number, lng: number, radiusKm = 50): { city: string; km: number } | null {
  let best: { city: string; km: number } | null = null
  for (const [city, c] of Object.entries(CITY_CENTRES)) {
    const d = haversineKm(lat, lng, c.lat, c.lng)
    if (d <= radiusKm && (!best || d < best.km)) best = { city, km: Math.round(d * 10) / 10 }
  }
  return best
}

/**
 * Request location permission and return the nearest corridor city.
 * Returns null if permission denied or no city within 50km.
 */
export const detectOriginCity = async (): Promise<string | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return null
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const result = getNearestCity(pos.coords.latitude, pos.coords.longitude)
    return result?.city ?? null
  } catch {
    return null
  }
}
