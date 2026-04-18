import { useState, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Platform, ActivityIndicator, Modal, FlatList,
  Animated, Pressable,
} from 'react-native'
import { useRouter } from 'expo-router'
import { tripsApi, bookingsApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { COLORS, ORIGIN_CITIES, DESTINATION_CITIES } from '../../constants'

// ── Date helpers ──────────────────────────────────────────────────────────────
const DATES = Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  return {
    value: d.toISOString().split('T')[0],
    short: i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' }),
    full: d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }),
  }
})

const POPULAR_ROUTES = [
  { origin: 'Johannesburg', destination: 'Polokwane' },
  { origin: 'Johannesburg', destination: 'Thohoyandou' },
  { origin: 'Johannesburg', destination: 'Tzaneen' },
  { origin: 'Pretoria', destination: 'Polokwane' },
]

// ── City picker modal ─────────────────────────────────────────────────────────
function CityModal({
  visible, title, options, selected, onSelect, onClose,
}: {
  visible: boolean; title: string; options: string[]
  selected: string; onSelect: (v: string) => void; onClose: () => void
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modal.safe}>
        <View style={modal.header}>
          <Text style={modal.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Text style={modal.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={options}
          keyExtractor={i => i}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[modal.option, selected === item && modal.optionActive]}
              onPress={() => { onSelect(item); onClose() }}
            >
              <Text style={modal.optionIcon}>📍</Text>
              <Text style={[modal.optionText, selected === item && modal.optionTextActive]}>
                {item}
              </Text>
              {selected === item && <Text style={modal.check}>✓</Text>}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={modal.sep} />}
        />
      </SafeAreaView>
    </Modal>
  )
}

// ── Trip result card ──────────────────────────────────────────────────────────
function TripCard({ trip, onBook }: { trip: any; onBook: () => void }) {
  const dep = new Date(trip.departure_time)
  const seatsLeft = trip.available_seats
  const urgent = seatsLeft <= 2

  return (
    <TouchableOpacity style={card.wrap} onPress={onBook} activeOpacity={0.9}>
      <View style={card.top}>
        <View style={card.timeBox}>
          <Text style={card.time}>
            {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </Text>
          <Text style={card.duration}>{trip.estimated_duration_minutes ? `${Math.round(trip.estimated_duration_minutes / 60)}h` : ''}</Text>
        </View>
        <View style={card.divider}>
          <View style={card.dot} />
          <View style={card.line} />
          <View style={card.dot} />
        </View>
        <View style={card.priceBox}>
          <Text style={card.price}>R{Number(trip.price_per_seat).toFixed(0)}</Text>
          <Text style={card.perSeat}>per seat</Text>
        </View>
      </View>

      <View style={card.bottom}>
        <View style={card.driverRow}>
          <View style={card.avatar}>
            <Text style={card.avatarText}>{trip.first_name?.[0]}{trip.last_name?.[0]}</Text>
          </View>
          <View>
            <Text style={card.driverName}>{trip.first_name} {trip.last_name}</Text>
            <Text style={card.driverMeta}>
              ⭐ {Number(trip.rating || 0).toFixed(1)} · {trip.make} {trip.model}
            </Text>
          </View>
        </View>
        <View style={card.right}>
          <Text style={[card.seats, urgent && card.seatsUrgent]}>
            {urgent ? `⚡ ${seatsLeft} left` : `${seatsLeft} seats`}
          </Text>
          <View style={card.bookBtn}>
            <Text style={card.bookBtnText}>Book →</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user } = useAuth()
  const router = useRouter()

  const [origin, setOrigin] = useState('Johannesburg')
  const [destination, setDestination] = useState('')
  const [dateIdx, setDateIdx] = useState(0)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [upcomingBooking, setUpcomingBooking] = useState<any>(null)
  const [showOriginPicker, setShowOriginPicker] = useState(false)
  const [showDestPicker, setShowDestPicker] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => { loadUpcoming() }, [])

  const loadUpcoming = async () => {
    try {
      const { data } = await bookingsApi.getMyBookings({ status: 'confirmed,pending', limit: 1 })
      const list = data.data || []
      if (list.length > 0) setUpcomingBooking(list[0])
    } catch {}
  }

  const handleSearch = async (overrideOrigin?: string, overrideDest?: string) => {
    const o = overrideOrigin || origin
    const d = overrideDest || destination
    if (!o || !d) {
      setShowDestPicker(true)
      return
    }
    setLoading(true)
    setSearched(true)
    setResults([])
    try {
      const { data } = await tripsApi.search({ origin: o, destination: d, date: DATES[dateIdx].value })
      setResults(data.data || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
      // Scroll to results
      setTimeout(() => scrollRef.current?.scrollTo({ y: upcomingBooking ? 420 : 300, animated: true }), 100)
    }
  }

  const handlePopularRoute = (route: typeof POPULAR_ROUTES[0]) => {
    setOrigin(route.origin)
    setDestination(route.destination)
    setSearched(false)
    handleSearch(route.origin, route.destination)
  }

  const selectedDate = DATES[dateIdx]
  const daysUntilTrip = upcomingBooking
    ? Math.ceil((new Date(upcomingBooking.departure_time).getTime() - Date.now()) / 86400000)
    : null

  return (
    <SafeAreaView style={styles.safe}>
      <CityModal
        visible={showOriginPicker}
        title="Travelling from"
        options={ORIGIN_CITIES}
        selected={origin}
        onSelect={v => { setOrigin(v); setSearched(false) }}
        onClose={() => setShowOriginPicker(false)}
      />
      <CityModal
        visible={showDestPicker}
        title="Travelling to"
        options={DESTINATION_CITIES}
        selected={destination}
        onSelect={v => { setDestination(v); setSearched(false) }}
        onClose={() => setShowDestPicker(false)}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>VYA</Text>
            <Text style={styles.greeting}>
              Hello, {user?.first_name} 👋
            </Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.profileInitial}>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming trip card */}
        {upcomingBooking && (
          <TouchableOpacity
            style={styles.upcomingCard}
            onPress={() => router.push(`/trip/${upcomingBooking.trip_id}?bookingId=${upcomingBooking.id}`)}
            activeOpacity={0.9}
          >
            <View style={styles.upcomingPill}>
              <Text style={styles.upcomingPillText}>
                {daysUntilTrip === 0 ? '🚐 TODAY' : daysUntilTrip === 1 ? '📅 TOMORROW' : `📅 IN ${daysUntilTrip} DAYS`}
              </Text>
            </View>
            <Text style={styles.upcomingRoute}>
              {upcomingBooking.origin_city} → {upcomingBooking.destination_city}
            </Text>
            <Text style={styles.upcomingMeta}>
              {new Date(upcomingBooking.departure_time).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
              {' · '}
              {upcomingBooking.seats_booked} seat{upcomingBooking.seats_booked !== 1 ? 's' : ''}
              {upcomingBooking.payment_status === 'paid' ? ' · ✓ Paid' : ' · ⚠️ Payment pending'}
            </Text>
            <Text style={styles.upcomingCta}>View boarding pass →</Text>
          </TouchableOpacity>
        )}

        {/* Search card */}
        <View style={styles.searchCard}>
          <Text style={styles.searchTitle}>Book a trip</Text>

          {/* Origin */}
          <View style={styles.routeRow}>
            <View style={styles.routeIcons}>
              <View style={styles.dotGreen} />
              <View style={styles.routeLine} />
              <View style={styles.dotNavy} />
            </View>
            <View style={styles.routeFields}>
              <TouchableOpacity style={styles.cityField} onPress={() => setShowOriginPicker(true)}>
                <Text style={styles.cityFieldLabel}>From</Text>
                <Text style={styles.cityFieldValue}>{origin || 'Select city'}</Text>
              </TouchableOpacity>
              <View style={styles.fieldDivider} />
              <TouchableOpacity style={styles.cityField} onPress={() => setShowDestPicker(true)}>
                <Text style={styles.cityFieldLabel}>To</Text>
                <Text style={[styles.cityFieldValue, !destination && styles.cityFieldPlaceholder]}>
                  {destination || 'Where to?'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
            {DATES.map((d, i) => (
              <TouchableOpacity
                key={d.value}
                style={[styles.datePill, dateIdx === i && styles.datePillActive]}
                onPress={() => { setDateIdx(i); setSearched(false) }}
              >
                <Text style={[styles.datePillText, dateIdx === i && styles.datePillTextActive]}>
                  {d.short}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.searchBtnLoading]}
            onPress={() => handleSearch()}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={COLORS.navy} />
              : <Text style={styles.searchBtnText}>
                  🔍  Find Trips · {selectedDate.short}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Results */}
        {searched && !loading && (
          <View style={styles.results}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                {results.length > 0
                  ? `${results.length} trip${results.length !== 1 ? 's' : ''} · ${origin} → ${destination}`
                  : `No trips · ${origin} → ${destination}`}
              </Text>
              <TouchableOpacity onPress={() => setSearched(false)}>
                <Text style={styles.clearSearch}>Change</Text>
              </TouchableOpacity>
            </View>

            {results.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🛣️</Text>
                <Text style={styles.emptyTitle}>No trips on {selectedDate.full}</Text>
                <Text style={styles.emptyHint}>Try a different date — drivers post trips 1-3 days ahead.</Text>
                <TouchableOpacity style={styles.tryAnotherBtn} onPress={() => setSearched(false)}>
                  <Text style={styles.tryAnotherText}>Try another date</Text>
                </TouchableOpacity>
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

        {/* Popular routes (shown when not searched) */}
        {!searched && (
          <View style={styles.popular}>
            <Text style={styles.popularTitle}>Popular routes</Text>
            <View style={styles.popularGrid}>
              {POPULAR_ROUTES.map(r => (
                <TouchableOpacity
                  key={`${r.origin}-${r.destination}`}
                  style={styles.popularCard}
                  onPress={() => handlePopularRoute(r)}
                >
                  <Text style={styles.popularFrom}>{r.origin}</Text>
                  <Text style={styles.popularArrow}>→</Text>
                  <Text style={styles.popularTo}>{r.destination}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { flex: 1 },

  // Header
  header: {
    backgroundColor: COLORS.navy,
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 44 : 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: { fontSize: 11, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  greeting: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginTop: 2 },
  profileBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
  },
  profileInitial: { fontSize: 15, fontWeight: '800', color: COLORS.navy },

  // Upcoming trip
  upcomingCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: COLORS.navy,
    borderRadius: 18,
    padding: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.gold + '55',
  },
  upcomingPill: {
    backgroundColor: COLORS.gold + '22',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  upcomingPillText: { fontSize: 11, fontWeight: '800', color: COLORS.gold, letterSpacing: 0.5 },
  upcomingRoute: { fontSize: 19, fontWeight: '800', color: COLORS.white },
  upcomingMeta: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  upcomingCta: { fontSize: 13, fontWeight: '700', color: COLORS.gold, marginTop: 4 },

  // Search card
  searchCard: {
    backgroundColor: COLORS.white,
    margin: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  searchTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navy },

  // Route input row
  routeRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  routeIcons: { alignItems: 'center', paddingTop: 16, gap: 0 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },
  routeLine: { width: 2, height: 30, backgroundColor: COLORS.border, marginVertical: 4 },
  dotNavy: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.navy },
  routeFields: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, overflow: 'hidden',
  },
  cityField: { padding: 14, gap: 2 },
  cityFieldLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  cityFieldValue: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cityFieldPlaceholder: { color: COLORS.textMuted, fontWeight: '500' },
  fieldDivider: { height: 1, backgroundColor: COLORS.border },

  // Date
  dateRow: { marginHorizontal: -2 },
  datePill: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: COLORS.offWhite, borderWidth: 1, borderColor: COLORS.border, marginRight: 8,
  },
  datePillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  datePillText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  datePillTextActive: { color: COLORS.white, fontWeight: '700' },

  // Search button
  searchBtn: {
    backgroundColor: COLORS.gold, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  searchBtnLoading: { backgroundColor: COLORS.gold + 'aa' },
  searchBtnText: { color: COLORS.navy, fontWeight: '800', fontSize: 15 },

  // Results
  results: { paddingHorizontal: 16, gap: 10 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy, flex: 1 },
  clearSearch: { fontSize: 13, fontWeight: '600', color: COLORS.gold },

  // Empty state
  emptyState: { alignItems: 'center', padding: 32, gap: 8 },
  emptyIcon: { fontSize: 44, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  emptyHint: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },
  tryAnotherBtn: {
    marginTop: 8, backgroundColor: COLORS.navy, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  tryAnotherText: { color: 'white', fontWeight: '700', fontSize: 14 },

  // Popular routes
  popular: { padding: 16, gap: 12 },
  popularTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  popularGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  popularCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.border, width: '47%',
  },
  popularFrom: { fontSize: 12, fontWeight: '700', color: COLORS.navy, flex: 1 },
  popularArrow: { fontSize: 12, color: COLORS.textMuted },
  popularTo: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, flex: 1, textAlign: 'right' },
})

// ── Trip card styles ──────────────────────────────────────────────────────────
const card = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
    gap: 14,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeBox: { alignItems: 'center', minWidth: 46 },
  time: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  duration: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  divider: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  line: { flex: 1, width: 1, backgroundColor: COLORS.border, minHeight: 16 },
  priceBox: { alignItems: 'flex-end' },
  price: { fontSize: 20, fontWeight: '900', color: COLORS.navy },
  perSeat: { fontSize: 11, color: COLORS.textMuted },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  driverName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  driverMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 6 },
  seats: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  seatsUrgent: { color: COLORS.danger },
  bookBtn: {
    backgroundColor: COLORS.gold, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  bookBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.navy },
})

// ── Modal styles ──────────────────────────────────────────────────────────────
const modal = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  closeBtn: { padding: 8 },
  closeText: { fontSize: 18, color: COLORS.textSecondary },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, paddingHorizontal: 20,
  },
  optionActive: { backgroundColor: COLORS.navy + '08' },
  optionIcon: { fontSize: 18 },
  optionText: { flex: 1, fontSize: 16, fontWeight: '500', color: COLORS.text },
  optionTextActive: { fontWeight: '700', color: COLORS.navy },
  check: { fontSize: 16, color: COLORS.success, fontWeight: '700' },
  sep: { height: 1, backgroundColor: COLORS.border, marginLeft: 52 },
})
