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
import { getSavedCity, saveCity, detectOriginCity } from '../../lib/detectedCity'

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
  { origin: 'Johannesburg', destination: 'Polokwane',    price: 380, duration: '3.5h' },
  { origin: 'Johannesburg', destination: 'Thohoyandou',  price: 450, duration: '5.3h' },
  { origin: 'Johannesburg', destination: 'Tzaneen',      price: 420, duration: '4.5h' },
  { origin: 'Johannesburg', destination: 'Giyani',       price: 430, duration: '4.8h' },
  { origin: 'Pretoria',     destination: 'Polokwane',    price: 330, duration: '3h'   },
  { origin: 'Johannesburg', destination: 'Phalaborwa',   price: 480, duration: '5.5h' },
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
  const urgent = seatsLeft <= 2 && trip.driver_assigned !== false
  const isPhantom = trip.driver_assigned === false

  return (
    <TouchableOpacity style={card.wrap} onPress={onBook} activeOpacity={0.9}>
      {isPhantom && (
        <View style={card.phantomBanner}>
          <Text style={card.phantomBannerText}>🕐 Driver being assigned — seat guaranteed</Text>
        </View>
      )}
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
        {isPhantom ? (
          <View style={card.driverRow}>
            <View style={[card.avatar, { backgroundColor: '#e5e7eb' }]}>
              <Text style={{ fontSize: 18 }}>🚐</Text>
            </View>
            <View>
              <Text style={card.driverName}>Driver TBC</Text>
              <Text style={card.driverMeta}>A driver will be assigned before departure</Text>
            </View>
          </View>
        ) : (
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
        )}
        <View style={card.right}>
          {!isPhantom && (
            <Text style={[card.seats, urgent && card.seatsUrgent]}>
              {urgent ? `⚡ ${seatsLeft} left` : `${seatsLeft} seats`}
            </Text>
          )}
          <View style={[card.bookBtn, isPhantom && { backgroundColor: '#1e293b' }]}>
            <Text style={card.bookBtnText}>{isPhantom ? 'Secure →' : 'Book →'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ── Compact slot picker (shown after tapping a popular route) ─────────────────
function SlotPicker({
  trips, origin, destination, dateLabel, loading,
  onBook, onReset, onChangeDate, dateIdx, onDateIdx,
}: {
  trips: any[]; origin: string; destination: string; dateLabel: string; loading: boolean
  onBook: (id: string) => void; onReset: () => void
  onChangeDate: (idx: number) => void; dateIdx: number; onDateIdx: (i: number) => void
}) {
  return (
    <View style={slot.wrap}>
      {/* Header */}
      <View style={slot.header}>
        <View style={{ flex: 1 }}>
          <Text style={slot.route}>{origin} → {destination}</Text>
          <Text style={slot.dateLabel}>{dateLabel}</Text>
        </View>
        <TouchableOpacity onPress={onReset} style={slot.changeBtn}>
          <Text style={slot.changeText}>✕ Change</Text>
        </TouchableOpacity>
      </View>

      {/* Date strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={slot.dateRow}>
        {DATES.map((d, i) => (
          <TouchableOpacity
            key={d.value}
            style={[slot.datePill, dateIdx === i && slot.datePillActive]}
            onPress={() => { onDateIdx(i); onChangeDate(i) }}
          >
            <Text style={[slot.datePillText, dateIdx === i && slot.datePillTextActive]}>
              {d.short}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Slots */}
      {loading ? (
        <View style={slot.loadingRow}>
          <ActivityIndicator color={COLORS.navy} size="small" />
          <Text style={slot.loadingText}>Finding trips…</Text>
        </View>
      ) : trips.length === 0 ? (
        <View style={slot.empty}>
          <Text style={slot.emptyIcon}>📅</Text>
          <Text style={slot.emptyText}>All slots filled on {dateLabel}</Text>
          <Text style={slot.emptyHint}>These are the most popular travel days — try the next day for open seats</Text>
          <TouchableOpacity
            style={slot.tryTomorrowBtn}
            onPress={() => { const next = Math.min(dateIdx + 1, DATES.length - 1); onDateIdx(next); onChangeDate(next) }}
          >
            <Text style={slot.tryTomorrowText}>Try next day →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        trips.map(trip => {
          const dep = new Date(trip.departure_time)
          const time = dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })
          const isPhantom = trip.driver_assigned === false
          const isFullyBooked = trip.fully_booked === true
          const seatsLeft = trip.available_seats
          const urgent = seatsLeft <= 2 && !isPhantom && !isFullyBooked

          if (isFullyBooked) {
            return (
              <View key={trip.id} style={[slot.row, slot.rowFullyBooked]}>
                <Text style={slot.timeBooked}>{time}</Text>
                <View style={{ flex: 1 }} />
                <Text style={slot.fullyBookedLabel}>Fully booked</Text>
              </View>
            )
          }

          return (
            <TouchableOpacity
              key={trip.id}
              style={slot.row}
              onPress={() => onBook(trip.id)}
              activeOpacity={0.8}
            >
              {isPhantom && (
                <View style={slot.phantomDot} />
              )}
              <Text style={slot.time}>{time}</Text>
              <View style={{ flex: 1 }} />
              <Text style={slot.price}>R{Number(trip.price_per_seat).toFixed(0)}</Text>
              {!isPhantom && (
                <Text style={[slot.seats, urgent && slot.seatsUrgent]}>
                  {urgent ? `⚡${seatsLeft}` : `${seatsLeft} seats`}
                </Text>
              )}
              {isPhantom && (
                <Text style={slot.phantomLabel}>Driver TBC</Text>
              )}
              <View style={[slot.bookBtn, isPhantom && slot.bookBtnDark]}>
                <Text style={slot.bookBtnText}>{isPhantom ? 'Secure →' : 'Book →'}</Text>
              </View>
            </TouchableOpacity>
          )
        })
      )}
    </View>
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
  const [slotMode, setSlotMode] = useState(false)
  const [upcomingBooking, setUpcomingBooking] = useState<any>(null)
  const [lastBooking, setLastBooking] = useState<any>(null)
  const [showOriginPicker, setShowOriginPicker] = useState(false)
  const [showDestPicker, setShowDestPicker] = useState(false)
  const [detectingCity, setDetectingCity] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => { loadBookings(); initOriginCity() }, [])

  const initOriginCity = async () => {
    // 1 — use saved city if available (covers returning users)
    const saved = await getSavedCity()
    if (saved) { setOrigin(saved); return }

    // 2 — first launch: try GPS detection
    setDetectingCity(true)
    const detected = await detectOriginCity()
    setDetectingCity(false)
    if (detected) {
      setOrigin(detected)
      saveCity(detected)
    }
    // 3 — no match: keep default 'Johannesburg'
  }

  const loadBookings = async () => {
    try {
      const { data } = await bookingsApi.getMyBookings({ status: 'confirmed,pending', limit: 1 })
      const list = data.data || []
      if (list.length > 0) { setUpcomingBooking(list[0]); return }
      // No upcoming — check for last completed trip to show "Book Again"
      const { data: done } = await bookingsApi.getMyBookings({ status: 'completed', limit: 1 })
      const past = done.data || []
      if (past.length > 0) setLastBooking(past[0])
    } catch {}
  }

  const handleSearch = async (overrideOrigin?: string, overrideDest?: string, overrideDateIdx?: number) => {
    const o = overrideOrigin || origin
    const d = overrideDest || destination
    if (!o || !d) { setShowDestPicker(true); return }
    const idx = overrideDateIdx ?? dateIdx
    setLoading(true)
    setSearched(true)
    setResults([])
    try {
      const { data } = await tripsApi.search({ origin: o, destination: d, date: DATES[idx].value })
      setResults(data.data || [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100)
    }
  }

  const handlePopularRoute = (route: typeof POPULAR_ROUTES[0]) => {
    setOrigin(route.origin)
    setDestination(route.destination)
    setSlotMode(true)
    setSearched(false)
    handleSearch(route.origin, route.destination)
  }

  const handleSlotDateChange = (idx: number) => {
    setDateIdx(idx)
    handleSearch(origin, destination, idx)
  }

  const resetSlotMode = () => {
    setSlotMode(false)
    setSearched(false)
    setResults([])
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
        onSelect={v => { setOrigin(v); saveCity(v); setSearched(false) }}
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

        {/* Book Again shortcut — shown when no upcoming trip but has past trips */}
        {!upcomingBooking && lastBooking && !slotMode && (
          <TouchableOpacity
            style={styles.bookAgainCard}
            onPress={() => handlePopularRoute({
              origin: lastBooking.origin_city,
              destination: lastBooking.destination_city,
              price: 0,
              duration: '',
            })}
            activeOpacity={0.9}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.bookAgainLabel}>BOOK AGAIN</Text>
              <Text style={styles.bookAgainRoute}>
                {lastBooking.origin_city} → {lastBooking.destination_city}
              </Text>
              <Text style={styles.bookAgainMeta}>Your last trip · tap to see available slots</Text>
            </View>
            <Text style={styles.bookAgainArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Search card — hidden when slot picker is active */}
        {!slotMode && <View style={styles.searchCard}>
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
                {detectingCity
                  ? <View style={styles.detectingRow}>
                      <ActivityIndicator size="small" color={COLORS.navy} />
                      <Text style={styles.detectingText}>Detecting…</Text>
                    </View>
                  : <Text style={styles.cityFieldValue}>{origin || 'Select city'}</Text>
                }
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

          <View style={styles.hubHint}>
            <Text style={styles.hubHintText}>🏢 Save 10% by choosing a hub pickup when booking</Text>
          </View>
        </View>}

        {/* Inline slot picker — shown after tapping a popular route */}
        {slotMode && (
          <View style={{ paddingHorizontal: 16 }}>
            <SlotPicker
              trips={results}
              origin={origin}
              destination={destination}
              dateLabel={selectedDate.full}
              loading={loading}
              onBook={id => router.push(`/booking/${id}`)}
              onReset={resetSlotMode}
              onChangeDate={handleSlotDateChange}
              dateIdx={dateIdx}
              onDateIdx={setDateIdx}
            />
          </View>
        )}

        {/* Full results — shown after manual search */}
        {searched && !slotMode && !loading && (
          <View style={styles.results}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                {results.length > 0
                  ? `${results.length} trip${results.length !== 1 ? 's' : ''} · ${origin} → ${destination}`
                  : `${origin} → ${destination}`}
              </Text>
              <TouchableOpacity onPress={() => setSearched(false)}>
                <Text style={styles.clearSearch}>Change</Text>
              </TouchableOpacity>
            </View>
            {results.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyTitle}>All slots filled on {selectedDate.full}</Text>
                <Text style={styles.emptyHint}>This is a popular travel day — there are open seats on other dates. Try tomorrow or the day after.</Text>
                <TouchableOpacity
                  style={styles.tryAnotherBtn}
                  onPress={() => {
                    const next = Math.min(dateIdx + 1, DATES.length - 1)
                    setDateIdx(next)
                    handleSearch(origin, destination, next)
                  }}
                >
                  <Text style={styles.tryAnotherText}>Try next day →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSearched(false)}>
                  <Text style={styles.changeDateText}>Change date manually</Text>
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

        {/* Popular routes (hidden in slot mode or after manual search) */}
        {!slotMode && !searched && (
          <View style={styles.popular}>
            <View style={styles.popularHeader}>
              <Text style={styles.popularTitle}>Popular routes</Text>
              <Text style={styles.popularSub}>Picked up at your door</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.popularScroll}
            >
              {POPULAR_ROUTES.map(r => {
                const hubFrom = Math.round(r.price * 0.9)
                return (
                  <TouchableOpacity
                    key={`${r.origin}-${r.destination}`}
                    style={styles.popularCard}
                    onPress={() => handlePopularRoute(r)}
                    activeOpacity={0.85}
                  >
                    {/* Route */}
                    <View style={styles.popularRouteRow}>
                      <Text style={styles.popularOrigin} numberOfLines={1}>{r.origin}</Text>
                      <Text style={styles.popularArrow}>→</Text>
                      <Text style={styles.popularDest} numberOfLines={1}>{r.destination}</Text>
                    </View>

                    {/* Duration */}
                    <Text style={styles.popularDuration}>⏱ {r.duration} drive</Text>

                    {/* Price + CTA */}
                    <View style={styles.popularCardFooter}>
                      <View>
                        <Text style={styles.popularPriceLabel}>from</Text>
                        <Text style={styles.popularPrice}>R{r.price}</Text>
                      </View>
                      <View style={styles.popularBookBtn}>
                        <Text style={styles.popularBookBtnText}>Book →</Text>
                      </View>
                    </View>

                    {/* Hub teaser */}
                    <View style={styles.popularHubTeaser}>
                      <Text style={styles.popularHubTeaserText}>🏢 Hub pickup from R{hubFrom} · save 10%</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
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
  detectingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  detectingText: { fontSize: 14, color: COLORS.textMuted },
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
  changeDateText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, fontWeight: '600' },

  // Book Again card
  bookAgainCard: {
    margin: 16, marginBottom: 8, marginTop: 0,
    backgroundColor: COLORS.white, borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  bookAgainLabel: { fontSize: 10, fontWeight: '800', color: COLORS.gold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  bookAgainRoute: { fontSize: 17, fontWeight: '800', color: COLORS.navy },
  bookAgainMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  bookAgainArrow: { fontSize: 22, color: COLORS.gold, fontWeight: '800' },

  // Hub hint inside search card
  hubHint: {
    backgroundColor: COLORS.successLight, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 12,
    marginTop: -4,
  },
  hubHintText: { fontSize: 12, fontWeight: '600', color: COLORS.success, textAlign: 'center' },

  // Popular routes
  popular: { paddingTop: 8, paddingBottom: 4, gap: 12 },
  popularHeader: { paddingHorizontal: 16, gap: 2 },
  popularTitle: { fontSize: 14, fontWeight: '800', color: COLORS.navy },
  popularSub: { fontSize: 12, color: COLORS.textMuted },
  popularScroll: { paddingHorizontal: 16, gap: 12 },
  popularCard: {
    backgroundColor: COLORS.white, borderRadius: 18,
    width: 200, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  popularRouteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 14, paddingBottom: 6,
  },
  popularOrigin: { fontSize: 13, fontWeight: '800', color: COLORS.navy, flex: 1 },
  popularArrow: { fontSize: 13, color: COLORS.textMuted },
  popularDest: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, flex: 1, textAlign: 'right' },
  popularDuration: { fontSize: 11, color: COLORS.textMuted, paddingHorizontal: 14, marginBottom: 10 },
  popularCardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 14, paddingBottom: 12,
  },
  popularPriceLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  popularPrice: { fontSize: 22, fontWeight: '900', color: COLORS.navy, marginTop: 1 },
  popularBookBtn: {
    backgroundColor: COLORS.gold, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  popularBookBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.navy },
  popularHubTeaser: {
    backgroundColor: COLORS.successLight, paddingVertical: 7, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: '#d1fae5',
  },
  popularHubTeaserText: { fontSize: 11, fontWeight: '600', color: COLORS.success },
})

// ── Trip card styles ──────────────────────────────────────────────────────────
const card = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  phantomBanner: {
    backgroundColor: '#fffbeb', paddingVertical: 7, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  phantomBannerText: { fontSize: 12, color: '#92400e', fontWeight: '600' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 0 },
  timeBox: { alignItems: 'center', minWidth: 46 },
  time: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  duration: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  divider: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  line: { flex: 1, width: 1, backgroundColor: COLORS.border, minHeight: 16 },
  priceBox: { alignItems: 'flex-end' },
  price: { fontSize: 20, fontWeight: '900', color: COLORS.navy },
  perSeat: { fontSize: 11, color: COLORS.textMuted },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 10 },
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

// ── Slot picker styles ────────────────────────────────────────────────────────
const slot = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.navy,
  },
  route: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  dateLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  changeBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  changeText: { fontSize: 12, fontWeight: '700', color: COLORS.gold },
  dateRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  datePill: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: COLORS.offWhite, borderWidth: 1, borderColor: COLORS.border, marginRight: 7,
  },
  datePillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  datePillText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  datePillTextActive: { color: COLORS.white, fontWeight: '700' },
  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 24, justifyContent: 'center',
  },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  empty: { alignItems: 'center', padding: 28, gap: 6 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  emptyHint: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
  tryTomorrowBtn: {
    marginTop: 6, backgroundColor: COLORS.navy, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  tryTomorrowText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowFullyBooked: { backgroundColor: '#f9fafb', opacity: 0.7 },
  timeBooked: { fontSize: 18, fontWeight: '800', color: COLORS.textMuted, minWidth: 50 },
  fullyBookedLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    backgroundColor: COLORS.border, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  phantomDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b',
  },
  time: { fontSize: 18, fontWeight: '800', color: COLORS.navy, minWidth: 50 },
  price: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  seats: { fontSize: 12, color: COLORS.textSecondary, minWidth: 52 },
  seatsUrgent: { color: COLORS.danger, fontWeight: '700' },
  phantomLabel: { fontSize: 11, color: '#92400e', fontWeight: '600', minWidth: 52 },
  bookBtn: {
    backgroundColor: COLORS.gold, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  bookBtnDark: { backgroundColor: '#1e293b' },
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
