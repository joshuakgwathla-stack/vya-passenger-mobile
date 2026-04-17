import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Platform, ActivityIndicator, Alert, FlatList,
} from 'react-native'
import { useRouter } from 'expo-router'
import { tripsApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { COLORS, ORIGIN_CITIES, DESTINATION_CITIES } from '../../constants'

function CityPicker({ label, value, options, onSelect, placeholder }: {
  label: string
  value: string
  options: string[]
  onSelect: (v: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.picker} onPress={() => setOpen(!open)}>
        <Text style={value ? styles.pickerText : styles.pickerPlaceholder}>
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdown}>
          {options.map(o => (
            <TouchableOpacity
              key={o}
              style={[styles.option, value === o && styles.optionActive]}
              onPress={() => { onSelect(o); setOpen(false) }}
            >
              <Text style={[styles.optionText, value === o && styles.optionTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

function TripCard({ trip, onBook }: { trip: any; onBook: () => void }) {
  const dep = new Date(trip.departure_time)
  const timeStr = dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = dep.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
  const seatsLeft = trip.available_seats

  return (
    <View style={styles.tripCard}>
      <View style={styles.tripTop}>
        <View>
          <Text style={styles.tripRoute}>
            {trip.origin_city} → {trip.destination_city}
          </Text>
          <Text style={styles.tripMeta}>{dateStr} · {timeStr}</Text>
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.price}>R{Number(trip.price_per_seat).toFixed(0)}</Text>
          <Text style={styles.priceLabel}>per seat</Text>
        </View>
      </View>

      <View style={styles.tripBottom}>
        <View style={styles.driverInfo}>
          <View style={styles.avatar}>
            <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>
              {trip.driver_first?.[0]}{trip.driver_last?.[0]}
            </Text>
          </View>
          <View>
            <Text style={styles.driverName}>{trip.driver_first} {trip.driver_last}</Text>
            <Text style={styles.driverRating}>⭐ {Number(trip.driver_rating || 0).toFixed(1)} · {trip.vehicle_make} {trip.vehicle_model}</Text>
          </View>
        </View>
        <View style={styles.tripRight}>
          <Text style={[styles.seats, seatsLeft <= 2 && { color: COLORS.danger }]}>
            {seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left
          </Text>
          <TouchableOpacity style={styles.bookBtn} onPress={onBook}>
            <Text style={styles.bookBtnText}>Book</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default function SearchScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const DATE_OPTIONS = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })

  const handleSearch = async () => {
    if (!origin || !destination || !date) {
      Alert.alert('Missing details', 'Please select origin, destination and date')
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const { data } = await tripsApi.search({ origin, destination, date })
      setResults(data.data || [])
    } catch {
      Alert.alert('Error', 'Could not search trips. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.first_name} 👋</Text>
            <Text style={styles.subtitle}>Where are you travelling?</Text>
          </View>
        </View>

        {/* Search card */}
        <View style={styles.searchCard}>
          <CityPicker
            label="From"
            value={origin}
            options={ORIGIN_CITIES}
            onSelect={setOrigin}
            placeholder="Select city"
          />
          <CityPicker
            label="To"
            value={destination}
            options={DESTINATION_CITIES}
            onSelect={setDestination}
            placeholder="Select destination"
          />
          <View style={styles.field}>
            <Text style={styles.label}>Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
              {DATE_OPTIONS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.datePill, date === d && styles.datePillActive]}
                  onPress={() => setDate(d)}
                >
                  <Text style={[styles.datePillText, date === d && styles.datePillTextActive]}>
                    {formatDate(d)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={styles.searchBtnText}>Search Trips</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Results */}
        {searched && !loading && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>
              {results.length > 0 ? `${results.length} trip${results.length !== 1 ? 's' : ''} found` : 'No trips found'}
            </Text>
            {results.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No trips available for this route and date.</Text>
                <Text style={styles.emptyHint}>Try a different date or check back later.</Text>
              </View>
            ) : (
              results.map(trip => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onBook={() => router.push(`/booking/${trip.id}`)}
                />
              ))
            )}
          </View>
        )}

        {/* Empty state before search */}
        {!searched && (
          <View style={styles.howItWorks}>
            <Text style={styles.howTitle}>How it works</Text>
            {[
              { icon: '🔍', text: 'Search for your route and date' },
              { icon: '🎫', text: 'Choose a trip and book your seat' },
              { icon: '💳', text: 'Pay securely via PayFast' },
              { icon: '🚐', text: 'Show your boarding pass at pickup' },
            ].map(({ icon, text }) => (
              <View key={text} style={styles.step}>
                <Text style={styles.stepIcon}>{icon}</Text>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { flex: 1 },
  header: {
    backgroundColor: COLORS.navy, padding: 24,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  searchCard: {
    backgroundColor: COLORS.white, margin: 16, borderRadius: 16,
    padding: 20, gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  picker: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 14, backgroundColor: COLORS.offWhite,
  },
  pickerText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  pickerPlaceholder: { fontSize: 15, color: COLORS.textMuted },
  chevron: { fontSize: 11, color: COLORS.textMuted },
  dropdown: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    backgroundColor: COLORS.white, overflow: 'hidden', marginTop: 4,
  },
  option: { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optionActive: { backgroundColor: COLORS.navy },
  optionText: { fontSize: 14, color: COLORS.text },
  optionTextActive: { color: COLORS.white, fontWeight: '600' },
  datePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.offWhite, borderWidth: 1, borderColor: COLORS.border,
    marginRight: 8,
  },
  datePillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  datePillText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  datePillTextActive: { color: COLORS.white, fontWeight: '700' },
  searchBtn: {
    backgroundColor: COLORS.navy, borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  searchBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  results: { padding: 16, gap: 12 },
  resultsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  empty: { alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
  emptyHint: { fontSize: 13, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
  tripCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  tripTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  tripRoute: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  tripMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  price: { fontSize: 20, fontWeight: '800', color: COLORS.navy },
  priceLabel: { fontSize: 11, color: COLORS.textMuted },
  tripBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  driverName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  driverRating: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  tripRight: { alignItems: 'flex-end', gap: 6 },
  seats: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  bookBtn: {
    backgroundColor: COLORS.gold, borderRadius: 8,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  bookBtnText: { color: COLORS.navy, fontWeight: '700', fontSize: 13 },
  howItWorks: { margin: 16, gap: 16 },
  howTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepIcon: { fontSize: 24 },
  stepText: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
})
