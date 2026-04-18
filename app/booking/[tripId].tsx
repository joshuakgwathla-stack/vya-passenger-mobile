import { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
  Platform, FlatList, Keyboard,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Location from 'expo-location'
import axios from 'axios'
import { tripsApi, bookingsApi, paymentsApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { COLORS } from '../../constants'

const PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || ''

// Autocomplete suggestions from Google Places
async function fetchSuggestions(input: string): Promise<any[]> {
  if (input.length < 3) return []
  try {
    const { data } = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      {
        params: {
          input,
          key: PLACES_KEY,
          components: 'country:za',       // South Africa only
          types: 'geocode|establishment',  // addresses + named places
          language: 'en',
        },
      }
    )
    return data.predictions || []
  } catch {
    return []
  }
}

// Get full formatted address for a place_id
async function fetchPlaceDetail(placeId: string): Promise<string> {
  try {
    const { data } = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id: placeId,
          key: PLACES_KEY,
          fields: 'formatted_address',
        },
      }
    )
    return data.result?.formatted_address || ''
  } catch {
    return ''
  }
}

// ------------------------------------------------------------------
// AddressInput — GPS auto-detect + Google Places autocomplete dropdown
// ------------------------------------------------------------------
function AddressInput({
  value,
  onChange,
  placeholder,
  autoDetect = false,
  dotColor,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoDetect?: boolean
  dotColor: string
}) {
  const [inputText, setInputText] = useState(value)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-detect GPS on mount (pickup only)
  useEffect(() => {
    if (!autoDetect) return
    detectGPS()
  }, [])

  // Keep inputText in sync when value changes externally
  useEffect(() => {
    setInputText(value)
  }, [value])

  const detectGPS = async () => {
    setDetecting(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { setDetecting(false); return }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })

      // Try Google reverse geocode first (more precise than expo-location's)
      try {
        const { data } = await axios.get(
          'https://maps.googleapis.com/maps/api/geocode/json',
          {
            params: {
              latlng: `${pos.coords.latitude},${pos.coords.longitude}`,
              key: PLACES_KEY,
              result_type: 'street_address|subpremise|premise',
              language: 'en',
            },
          }
        )
        const addr = data.results?.[0]?.formatted_address
        if (addr) {
          // Strip country suffix — "22 Rivonia Rd, Sandton, 2196, South Africa" → "22 Rivonia Rd, Sandton, 2196"
          const clean = addr.replace(/, South Africa$/, '')
          setInputText(clean)
          onChange(clean)
          setDetected(true)
          setDetecting(false)
          return
        }
      } catch {}

      // Fallback to expo-location reverse geocode
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      if (place) {
        const parts = [
          place.streetNumber && place.street ? `${place.streetNumber} ${place.street}` : place.street,
          place.district || place.subregion || place.city,
          place.region,
        ].filter(Boolean)
        const label = parts.join(', ')
        setInputText(label)
        onChange(label)
        setDetected(true)
      }
    } catch {}
    finally { setDetecting(false) }
  }

  const handleChangeText = (text: string) => {
    setInputText(text)
    onChange(text)
    setDetected(false)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.length < 3) { setSuggestions([]); setShowDropdown(false); return }

    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(text)
      setSuggestions(results)
      setShowDropdown(results.length > 0)
    }, 350)
  }

  const handleSelect = async (prediction: any) => {
    Keyboard.dismiss()
    setShowDropdown(false)
    setSuggestions([])
    // Show the main_text immediately, then resolve full address
    const quick = prediction.description
    setInputText(quick)
    onChange(quick)
    // Fetch precise formatted address
    const full = await fetchPlaceDetail(prediction.place_id)
    if (full) {
      const clean = full.replace(/, South Africa$/, '')
      setInputText(clean)
      onChange(clean)
    }
  }

  return (
    <View>
      <View style={styles.addressRow}>
        <View style={[styles.addressDot, { backgroundColor: dotColor }]} />
        <View style={{ flex: 1 }}>
          {detecting ? (
            <View style={styles.detectingRow}>
              <ActivityIndicator color={COLORS.navy} size="small" />
              <Text style={styles.detectingText}>Detecting your location…</Text>
            </View>
          ) : (
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.addressInput, detected && styles.addressInputDetected]}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textMuted}
                value={inputText}
                onChangeText={handleChangeText}
                onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                multiline={false}
                returnKeyType="done"
              />
              {detected && (
                <View style={styles.gpsTag}>
                  <Text style={styles.gpsTagText}>📍 GPS</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Autocomplete dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.slice(0, 5).map((p, i) => (
            <TouchableOpacity
              key={p.place_id}
              style={[styles.dropdownItem, i < suggestions.length - 1 && styles.dropdownItemBorder]}
              onPress={() => handleSelect(p)}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownMain} numberOfLines={1}>
                  {p.structured_formatting?.main_text || p.description}
                </Text>
                <Text style={styles.dropdownSub} numberOfLines={1}>
                  {p.structured_formatting?.secondary_text || ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

// ------------------------------------------------------------------
// Main Booking Screen
// ------------------------------------------------------------------
export default function BookingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [seats, setSeats] = useState(1)
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [booking, setBooking] = useState(false)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    tripsApi.getTrip(tripId)
      .then(({ data }) => setTrip(data.data))
      .catch(() => Alert.alert('Error', 'Could not load trip details'))
      .finally(() => setLoading(false))
  }, [tripId])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.navy} size="large" />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </View>
    )
  }

  if (!trip) return null

  const dep = new Date(trip.departure_time)
  const pricePerSeat = Number(trip.price_per_seat)
  const total = (pricePerSeat * seats).toFixed(2)
  const availableSeats = trip.available_seats ?? 0

  const handleBook = async () => {
    if (!pickup.trim()) {
      Alert.alert('Pickup required', 'Enter your pickup address so your driver can find you.')
      return
    }
    setBooking(true)
    try {
      const { data } = await bookingsApi.create({
        trip_id: tripId,
        seats_booked: seats,
        pickup_address: pickup,
        dropoff_address: dropoff,
        passengers: [{
          name: `${user?.first_name} ${user?.last_name}`,
          email: user?.email,
          phone: user?.phone,
          is_account_holder: true,
        }],
      })
      const bookingId = data.data.id
      setPaying(true)
      const payRes = await paymentsApi.initiate(bookingId)
      const payUrl = payRes.data.data?.redirect_url || payRes.data.data?.payment_url
      if (payUrl) {
        await WebBrowser.openBrowserAsync(payUrl)
        const statusRes = await paymentsApi.getStatus(bookingId)
        const status = statusRes.data.data?.payment_status
        if (status === 'paid') {
          Alert.alert('Booking confirmed!', 'Your seat is secured. Check My Trips for details.')
          router.replace(`/trip/${trip.id}?bookingId=${bookingId}`)
        } else {
          Alert.alert('Payment pending', 'Finish payment to confirm your seat.', [
            { text: 'View Trip', onPress: () => router.replace(`/trip/${trip.id}?bookingId=${bookingId}`) },
          ])
        }
      } else {
        router.replace(`/trip/${trip.id}?bookingId=${bookingId}`)
      }
    } catch (err: any) {
      Alert.alert('Booking failed', err.response?.data?.message || 'Please try again.')
    } finally {
      setBooking(false)
      setPaying(false)
    }
  }

  const dayLabel = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const d = new Date(dep); d.setHours(0, 0, 0, 0)
    if (d.getTime() === today.getTime()) return 'Today'
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'
    return dep.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })
  })()

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Book your seat</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Trip hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroRoute}>
            <View style={styles.heroCity}>
              <View style={styles.dotGreen} />
              <Text style={styles.heroCityText}>{trip.origin_city}</Text>
            </View>
            <View style={styles.heroLine} />
            <View style={styles.heroCity}>
              <View style={styles.dotGold} />
              <Text style={styles.heroCityText}>{trip.destination_city}</Text>
            </View>
          </View>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Date</Text>
              <Text style={styles.heroMetaValue}>{dayLabel}</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Departs</Text>
              <Text style={styles.heroMetaValue}>
                {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Available</Text>
              <Text style={[styles.heroMetaValue, availableSeats <= 2 && { color: '#f59e0b' }]}>
                {availableSeats} seat{availableSeats !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <View style={styles.driverRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{trip.driver_first?.[0]}{trip.driver_last?.[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{trip.driver_first} {trip.driver_last}</Text>
              <Text style={styles.driverMeta}>
                ⭐ {Number(trip.driver_rating || 0).toFixed(1)} · {trip.vehicle_make} {trip.vehicle_model}
                {trip.vehicle_color ? ` · ${trip.vehicle_color}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Seats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How many seats?</Text>
          <View style={styles.seatRow}>
            <TouchableOpacity
              style={[styles.seatBtn, seats <= 1 && styles.seatBtnDisabled]}
              onPress={() => setSeats(s => Math.max(1, s - 1))}
              disabled={seats <= 1}
            >
              <Text style={styles.seatBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.seatCountBox}>
              <Text style={styles.seatCount}>{seats}</Text>
              <Text style={styles.seatLabel}>{seats === 1 ? 'seat' : 'seats'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.seatBtn, seats >= availableSeats && styles.seatBtnDisabled]}
              onPress={() => setSeats(s => Math.min(availableSeats, s + 1))}
              disabled={seats >= availableSeats}
            >
              <Text style={styles.seatBtnText}>+</Text>
            </TouchableOpacity>
            <Text style={styles.pricePerSeat}>R{pricePerSeat.toFixed(0)} / seat</Text>
          </View>
        </View>

        {/* Pickup & drop-off */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Where should your driver find you?</Text>
          <Text style={styles.cardSubtitle}>Your driver comes to your door — no taxi rank needed.</Text>

          <View style={styles.addressBlock}>
            {/* Pickup — GPS auto-detect + autocomplete */}
            <AddressInput
              value={pickup}
              onChange={setPickup}
              placeholder="Your pickup address *"
              autoDetect
              dotColor="#34d399"
            />

            <View style={styles.addressConnector} />

            {/* Drop-off — autocomplete only */}
            <AddressInput
              value={dropoff}
              onChange={setDropoff}
              placeholder={`Drop-off in ${trip.destination_city} (optional)`}
              dotColor={COLORS.navy}
            />
          </View>
        </View>

        {/* What happens next */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>What happens next</Text>
          <View style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <Text style={styles.stepText}>Pay securely via PayFast — your seat is held for 30 min</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <Text style={styles.stepText}>Get a booking code to show your driver at pickup</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <Text style={styles.stepText}>Track your driver live on the day of travel</Text>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky pay bar */}
      <View style={styles.payBar}>
        <View style={styles.payBarLeft}>
          <Text style={styles.payBarLabel}>{seats} seat{seats !== 1 ? 's' : ''}</Text>
          <Text style={styles.payBarTotal}>R{total}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, (booking || paying) && styles.payBtnBusy]}
          onPress={handleBook}
          disabled={booking || paying}
          activeOpacity={0.85}
        >
          {booking || paying
            ? <ActivityIndicator color={COLORS.navy} />
            : <Text style={styles.payBtnText}>Pay with PayFast →</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: COLORS.offWhite },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? 44 : 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: COLORS.navy, fontWeight: '600' },
  topTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navy },

  scroll: { padding: 16, gap: 14 },

  heroCard: { backgroundColor: COLORS.navy, borderRadius: 20, padding: 20, gap: 16 },
  heroRoute: { flexDirection: 'row', alignItems: 'center' },
  heroCity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  heroCityText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  heroLine: { width: 20, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34d399' },
  dotGold: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },

  heroMeta: { flexDirection: 'row', alignItems: 'center' },
  heroMetaItem: { flex: 1, alignItems: 'center' },
  heroMetaLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroMetaValue: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  heroMetaDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  driverName: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  driverMeta: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  cardSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: -4 },

  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  seatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  seatBtnDisabled: { backgroundColor: COLORS.border },
  seatBtnText: { fontSize: 22, color: 'white', fontWeight: '700', lineHeight: 26 },
  seatCountBox: { width: 52, alignItems: 'center' },
  seatCount: { fontSize: 28, fontWeight: '900', color: COLORS.navy },
  seatLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: -2 },
  pricePerSeat: { fontSize: 13, color: COLORS.textSecondary, marginLeft: 'auto' as any },

  // Address block
  addressBlock: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, overflow: 'visible',
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  addressConnector: { height: 1, backgroundColor: COLORS.border, marginLeft: 40 },
  addressDot: { width: 10, height: 10, borderRadius: 5, marginTop: 14, flexShrink: 0 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 8 },
  addressInputDetected: { color: COLORS.navy, fontWeight: '600' },
  gpsTag: {
    backgroundColor: '#ecfdf5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  gpsTagText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  detectingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  detectingText: { fontSize: 14, color: COLORS.textSecondary },

  // Dropdown
  dropdown: {
    marginHorizontal: 14, marginTop: 2,
    backgroundColor: COLORS.white, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
    zIndex: 999,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropdownIcon: { fontSize: 14 },
  dropdownMain: { fontSize: 14, fontWeight: '600', color: COLORS.navy },
  dropdownSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  stepsCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, gap: 14 },
  stepsTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText: { fontSize: 12, fontWeight: '700', color: COLORS.gold },
  stepText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, paddingTop: 2 },

  payBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 16,
  },
  payBarLeft: { flex: 1 },
  payBarLabel: { fontSize: 12, color: COLORS.textMuted },
  payBarTotal: { fontSize: 24, fontWeight: '900', color: COLORS.navy },
  payBtn: {
    backgroundColor: COLORS.gold, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center', minWidth: 160,
  },
  payBtnBusy: { opacity: 0.7 },
  payBtnText: { color: COLORS.navy, fontWeight: '800', fontSize: 15 },
})
