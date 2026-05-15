import { useState, useEffect, useRef, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Platform, ActivityIndicator, Modal, FlatList,
  Animated, Pressable, TextInput, KeyboardAvoidingView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useNavigation } from '@react-navigation/native'
import { tripsApi, bookingsApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  COLORS, ORIGIN_CITIES, DESTINATION_CITIES,
  getDestinationSuggestions, SearchSuggestion,
} from '../../constants'
import { getSavedCity, saveCity, detectOriginCity, getNearestCity } from '../../lib/detectedCity'
import { VyaIcon } from '../../components/VyaLogo'

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
  { origin: 'Johannesburg', destination: 'Polokwane',   price: 380, duration: '3.5h' },
  { origin: 'Johannesburg', destination: 'Thohoyandou', price: 450, duration: '5.3h' },
  { origin: 'Johannesburg', destination: 'Tzaneen',     price: 420, duration: '4.5h' },
  { origin: 'Johannesburg', destination: 'Giyani',      price: 430, duration: '4.8h' },
  { origin: 'Pretoria',     destination: 'Polokwane',   price: 330, duration: '3h'   },
  { origin: 'Johannesburg', destination: 'Phalaborwa',  price: 480, duration: '5.5h' },
  { origin: 'Johannesburg', destination: 'Makhado',     price: 440, duration: '4.7h' },
  { origin: 'Johannesburg', destination: 'Mankweng',    price: 400, duration: '4h'   },
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

// ── Smart destination search modal ───────────────────────────────────────────
// Replaces the flat city picker — shows node resolution ("Served via X") so
// passengers understand how their destination maps onto the Vya network.
function DestinationSearchModal({
  visible, origin, onSelect, onClose,
}: {
  visible: boolean
  origin: string
  onSelect: (node: string, display: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const suggestions = useMemo(() => getDestinationSuggestions(query), [query])

  // Reset input each time modal opens
  useEffect(() => { if (visible) setQuery('') }, [visible])

  const handleSelect = (s: SearchSuggestion) => {
    onSelect(s.node, s.display)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={dst.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Search panel */}
        <View style={dst.panel}>
          {/* From pill — shows context */}
          <View style={dst.fromPill}>
            <View style={dst.fromDot} />
            <Text style={dst.fromPillText}>From <Text style={{ fontWeight: '800' }}>{origin}</Text></Text>
          </View>

          {/* Search input row */}
          <View style={dst.inputRow}>
            <View style={dst.toDot} />
            <TextInput
              style={dst.input}
              placeholder="City, town, campus…"
              placeholderTextColor={COLORS.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
            />
            <TouchableOpacity onPress={onClose} style={dst.cancelBtn}>
              <Text style={dst.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Suggestions */}
          <FlatList
            data={suggestions}
            keyExtractor={(_, i) => String(i)}
            keyboardShouldPersistTaps="always"
            style={dst.list}
            ItemSeparatorComponent={() => <View style={dst.sep} />}
            ListHeaderComponent={
              !query ? (
                <Text style={dst.sectionLabel}>Popular destinations</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={dst.row} onPress={() => handleSelect(item)} activeOpacity={0.7}>
                <View style={[dst.nodePin, item.subtitle === 'Direct stop' ? dst.nodePinDirect : dst.nodePinAlias]} />
                <View style={dst.rowText}>
                  <Text style={dst.rowDisplay}>{item.display}</Text>
                  <Text style={[dst.rowSubtitle, item.subtitle !== 'Direct stop' && dst.rowSubtitleAlias]}>
                    {item.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Backdrop — tap to dismiss */}
        <TouchableOpacity style={dst.backdrop} onPress={onClose} activeOpacity={1} />
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Smart origin search modal ─────────────────────────────────────────────────
function OriginSearchModal({
  visible, onSelect, onClose,
}: {
  visible: boolean
  onSelect: (node: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const suggestions = useMemo(() => getDestinationSuggestions(query), [query])

  useEffect(() => { if (visible) setQuery('') }, [visible])

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={dst.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={dst.panel}>
          <View style={dst.inputRow}>
            <View style={[dst.fromDot, { backgroundColor: COLORS.gold }]} />
            <TextInput
              style={dst.input}
              placeholder="City, suburb, township…"
              placeholderTextColor={COLORS.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
            />
            <TouchableOpacity onPress={onClose} style={dst.cancelBtn}>
              <Text style={dst.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={suggestions}
            keyExtractor={(_, i) => String(i)}
            keyboardShouldPersistTaps="always"
            style={dst.list}
            ItemSeparatorComponent={() => <View style={dst.sep} />}
            ListHeaderComponent={!query ? <Text style={dst.sectionLabel}>Your departure city</Text> : null}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={dst.row}
                onPress={() => { onSelect(item.node); onClose() }}
                activeOpacity={0.7}
              >
                <View style={[dst.nodePin, dst.nodePinDirect]} />
                <View style={dst.rowText}>
                  <Text style={dst.rowDisplay}>{item.display}</Text>
                  <Text style={dst.rowSubtitle}>{item.subtitle}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
        <TouchableOpacity style={dst.backdrop} onPress={onClose} activeOpacity={1} />
      </KeyboardAvoidingView>
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
            <Text style={[card.bookBtnText, isPhantom && { color: COLORS.gold }]}>{isPhantom ? 'Secure →' : 'Book →'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ── Compact slot picker ────────────────────────────────────────────────────────
function SlotPicker({
  trips, origin, destination, dateLabel, loading,
  onBook, onReset, onChangeDate, dateIdx, onDateIdx,
  onNotifyMe, notifyMeLoading, notifyMeRequested,
}: {
  trips: any[]; origin: string; destination: string; dateLabel: string; loading: boolean
  onBook: (id: string) => void; onReset: () => void
  onChangeDate: (idx: number) => void; dateIdx: number; onDateIdx: (i: number) => void
  onNotifyMe: () => void; notifyMeLoading: boolean; notifyMeRequested: boolean
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
          {notifyMeRequested ? (
            <>
              <Text style={slot.emptyIcon}>✅</Text>
              <Text style={slot.emptyText}>We'll let you know!</Text>
              <Text style={slot.emptyHint}>
                You're on the list for {origin} → {destination}.{'\n'}
                We'll notify you the moment trips become available.
              </Text>
            </>
          ) : (
            <>
              <Text style={slot.emptyIcon}>🛣️</Text>
              <Text style={slot.emptyText}>Not on Vya yet</Text>
              <Text style={slot.emptyHint}>
                We don't cover {origin} → {destination} yet.{'\n'}
                Want us to notify you when we launch this route?
              </Text>
              <TouchableOpacity
                style={[slot.notifyBtn, notifyMeLoading && { opacity: 0.6 }]}
                onPress={onNotifyMe}
                disabled={notifyMeLoading}
                activeOpacity={0.8}
              >
                {notifyMeLoading
                  ? <ActivityIndicator color={COLORS.white} size="small" />
                  : <Text style={slot.notifyBtnText}>Notify me when available</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={slot.tryTomorrowBtn}
                onPress={() => { const next = Math.min(dateIdx + 1, DATES.length - 1); onDateIdx(next); onChangeDate(next) }}
              >
                <Text style={slot.tryTomorrowText}>Try a different date →</Text>
              </TouchableOpacity>
            </>
          )}
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
                <Text style={[slot.bookBtnText, isPhantom && slot.bookBtnTextDark]}>{isPhantom ? 'Secure →' : 'Book →'}</Text>
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
  const navigation = useNavigation()

  const [origin, setOrigin] = useState('Johannesburg')
  const [destination, setDestination] = useState('')
  const [dateIdx, setDateIdx] = useState(0)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showSlots, setShowSlots] = useState(false)
  const [upcomingBooking, setUpcomingBooking] = useState<any>(null)
  const [lastBooking, setLastBooking] = useState<any>(null)
  const [showOriginPicker, setShowOriginPicker] = useState(false)
  const [showDestSearch, setShowDestSearch] = useState(false)
  const [detectingCity, setDetectingCity] = useState(false)
  const [notifyMeLoading, setNotifyMeLoading] = useState(false)
  const [notifyMeRequested, setNotifyMeRequested] = useState(false)
  const [gpsSuggestedCity, setGpsSuggestedCity] = useState('')
  const [gpsState, setGpsState] = useState<'idle' | 'suggested'>('idle')
  const [showOriginSearch, setShowOriginSearch] = useState(false)
  // Return trip
  const [returnDateIdx, setReturnDateIdx] = useState(1)
  const [returnResults, setReturnResults] = useState<any[]>([])
  const [returnLoading, setReturnLoading] = useState(false)
  const [returnExpanded, setReturnExpanded] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => { loadBookings(); initOriginCity() }, [])

  // Auto-load last route's slots so returning users skip the search step
  useEffect(() => {
    if (lastBooking && !showSlots) {
      const o = lastBooking.origin_city
      const d = lastBooking.destination_city
      if (o && d) {
        setOrigin(o)
        setDestination(d)
        const nextReturnIdx = Math.min(1, DATES.length - 1)
        setReturnDateIdx(nextReturnIdx)
        handleSearch(o, d, 0)
        handleReturnSearch(nextReturnIdx)
      }
    }
  }, [lastBooking])

  // Pressing the Home tab when already on it resets search state
  useEffect(() => {
    const unsub = navigation.addListener('tabPress' as any, () => {
      setShowSlots(false)
      setResults([])
      setReturnExpanded(false)
      setReturnResults([])
      setDestination('')
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    })
    return unsub
  }, [navigation])

  const initOriginCity = async () => {
    // 1 — use saved city if available (covers returning users)
    const saved = await getSavedCity()
    if (saved) { setOrigin(saved); return }

    // 2 — first launch: try GPS detection — show soft suggestion, don't silently set
    setDetectingCity(true)
    const detected = await detectOriginCity()
    setDetectingCity(false)
    if (detected) {
      setGpsSuggestedCity(detected)
      setGpsState('suggested')
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
    if (!o || !d) { setShowDestSearch(true); return }
    const idx = overrideDateIdx ?? dateIdx
    setLoading(true)
    setShowSlots(true)
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

  const handleReturnSearch = async (overrideIdx?: number) => {
    const idx = overrideIdx ?? returnDateIdx
    setReturnLoading(true)
    setReturnResults([])
    try {
      const { data } = await tripsApi.search({ origin: destination, destination: origin, date: DATES[idx].value })
      setReturnResults(data.data || [])
    } catch {
      setReturnResults([])
    } finally {
      setReturnLoading(false)
    }
  }

  const handlePopularRoute = (route: typeof POPULAR_ROUTES[0]) => {
    setOrigin(route.origin)
    setDestination(route.destination)
    setShowSlots(true)
    const nextReturnIdx = Math.min(dateIdx + 1, DATES.length - 1)
    setReturnDateIdx(nextReturnIdx)
    handleSearch(route.origin, route.destination)
    handleReturnSearch(nextReturnIdx)
  }

  const handleSlotDateChange = (idx: number) => {
    setDateIdx(idx)
    handleSearch(origin, destination, idx)
    // Push return date to at least the day after outbound
    const newReturnIdx = Math.max(returnDateIdx, idx + 1)
    if (newReturnIdx !== returnDateIdx) {
      setReturnDateIdx(newReturnIdx)
      handleReturnSearch(newReturnIdx)
    }
  }

  const resetSlotMode = () => {
    setShowSlots(false)
    setResults([])
    setReturnResults([])
    setDestination('')
    setNotifyMeRequested(false)
  }

  const handleNotifyMe = async () => {
    setNotifyMeLoading(true)
    try {
      await tripsApi.notifyMe(origin, destination)
      setNotifyMeRequested(true)
    } catch {
      // Even on error, give positive feedback — the request likely went through
      setNotifyMeRequested(true)
    } finally {
      setNotifyMeLoading(false)
    }
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
        onSelect={v => { setOrigin(v); saveCity(v); setShowSlots(false) }}
        onClose={() => setShowOriginPicker(false)}
      />
      <DestinationSearchModal
        visible={showDestSearch}
        origin={origin}
        onSelect={(node, display) => {
          setDestination(node)
          setNotifyMeRequested(false)
          const nextReturnIdx = Math.min(dateIdx + 1, DATES.length - 1)
          setReturnDateIdx(nextReturnIdx)
          handleSearch(origin, node)
          handleReturnSearch(nextReturnIdx)
        }}
        onClose={() => setShowDestSearch(false)}
      />
      <OriginSearchModal
        visible={showOriginSearch}
        onSelect={(node) => { setOrigin(node); saveCity(node); setGpsState('idle') }}
        onClose={() => setShowOriginSearch(false)}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <VyaIcon size={28} />
            <Text style={styles.greeting}>Hello, {user?.first_name}</Text>
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
        {!upcomingBooking && lastBooking && !showSlots && (
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

        {/* GPS soft suggestion */}
        {gpsState === 'suggested' && !showSlots && (
          <View style={{
            backgroundColor: COLORS.navyMid, borderRadius: 12, padding: 14,
            marginBottom: 10, borderWidth: 1, borderColor: 'rgba(201,169,110,0.25)',
            flexDirection: 'row', alignItems: 'center', gap: 10,
          }}>
            <Text style={{ fontSize: 20 }}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: COLORS.textInverse, fontWeight: '600' }}>
                Looks like you&apos;re near{' '}
                <Text style={{ color: COLORS.goldLight }}>{gpsSuggestedCity}</Text>
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                Departing from there?
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => { setOrigin(gpsSuggestedCity); saveCity(gpsSuggestedCity); setGpsState('idle') }}
              style={{ backgroundColor: COLORS.goldLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.navy }}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setGpsState('idle'); setShowOriginSearch(true) }}
              style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(245,240,230,0.15)' }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.textMuted }}>Change</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search card — hidden when slot picker is active */}
        {!showSlots && <View style={styles.searchCard}>
          <Text style={styles.searchTitle}>Book a trip</Text>

          {/* Origin */}
          <View style={styles.routeRow}>
            <View style={styles.routeIcons}>
              <View style={styles.dotGreen} />
              <View style={styles.routeLine} />
              <View style={styles.dotNavy} />
            </View>
            <View style={styles.routeFields}>
              <TouchableOpacity style={styles.cityField} onPress={() => setShowOriginSearch(true)}>
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
              <TouchableOpacity style={styles.cityField} onPress={() => setShowDestSearch(true)}>
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
                onPress={() => {
                  setDateIdx(i)
                  if (destination) handleSearch(origin, destination, i)
                }}
              >
                <Text style={[styles.datePillText, dateIdx === i && styles.datePillTextActive]}>
                  {d.short}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {!destination ? (
            <TouchableOpacity style={styles.searchBtn} onPress={() => setShowDestSearch(true)}>
              <Text style={styles.searchBtnText}>📍  Where are you going?</Text>
            </TouchableOpacity>
          ) : loading ? (
            <View style={[styles.searchBtn, styles.searchBtnLoading]}>
              <ActivityIndicator color={COLORS.navy} />
            </View>
          ) : null}

          <View style={styles.hubHint}>
            <Text style={styles.hubHintText}>🏢 Save 10% by choosing a hub pickup when booking</Text>
          </View>
        </View>}

        {/* Slot picker — shown once destination is selected */}
        {showSlots && (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
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
              onNotifyMe={handleNotifyMe}
              notifyMeLoading={notifyMeLoading}
              notifyMeRequested={notifyMeRequested}
            />

            {/* Return trip — separate card, collapsed by default */}
            <View style={styles.returnCard}>
              <TouchableOpacity
                style={styles.returnCardHeader}
                onPress={() => {
                  setReturnExpanded(e => !e)
                  if (!returnExpanded && returnResults.length === 0) handleReturnSearch()
                }}
                activeOpacity={0.85}
              >
                <View style={styles.returnCardLeft}>
                  <Text style={styles.returnCardIcon}>🔄</Text>
                  <View>
                    <Text style={styles.returnCardTitle}>Book your return trip</Text>
                    <Text style={styles.returnCardSub}>{destination} → {origin}</Text>
                  </View>
                </View>
                <Text style={styles.returnCardChevron}>{returnExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {returnExpanded && (
                <View style={styles.returnCardBody}>
                  <View style={styles.returnRoutePill}>
                    <Text style={styles.returnRoutePillText}>
                      {destination}  →  {origin}  ·  {DATES[returnDateIdx]?.short}
                    </Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={slot.dateRow}>
                    {DATES.map((d, i) => i >= dateIdx && (
                      <TouchableOpacity
                        key={d.value}
                        style={[slot.datePill, returnDateIdx === i && slot.datePillActive]}
                        onPress={() => { setReturnDateIdx(i); handleReturnSearch(i) }}
                      >
                        <Text style={[slot.datePillText, returnDateIdx === i && slot.datePillTextActive]}>
                          {d.short}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {returnLoading ? (
                    <View style={slot.loadingRow}>
                      <ActivityIndicator color={COLORS.navy} size="small" />
                      <Text style={slot.loadingText}>Finding return trips…</Text>
                    </View>
                  ) : returnResults.length === 0 ? (
                    <View style={slot.empty}>
                      <Text style={slot.emptyIcon}>📅</Text>
                      <Text style={slot.emptyText}>No slots on this date</Text>
                      <Text style={slot.emptyHint}>Try another day</Text>
                    </View>
                  ) : (
                    returnResults.map(trip => {
                      const dep = new Date(trip.departure_time)
                      const time = dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })
                      const isPhantom = trip.driver_assigned === false
                      const isFullyBooked = trip.fully_booked === true
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
                          onPress={() => router.push(`/booking/${trip.id}`)}
                          activeOpacity={0.8}
                        >
                          {isPhantom && <View style={slot.phantomDot} />}
                          <Text style={slot.time}>{time}</Text>
                          <View style={{ flex: 1 }} />
                          <Text style={slot.price}>R{Number(trip.price_per_seat).toFixed(0)}</Text>
                          {isPhantom
                            ? <Text style={slot.phantomLabel}>Driver TBC</Text>
                            : <Text style={slot.seats}>{trip.available_seats} seats</Text>
                          }
                          <View style={[slot.bookBtn, isPhantom && slot.bookBtnDark]}>
                            <Text style={[slot.bookBtnText, isPhantom && slot.bookBtnTextDark]}>{isPhantom ? 'Secure →' : 'Book →'}</Text>
                          </View>
                        </TouchableOpacity>
                      )
                    })
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Popular routes — hidden once slots are shown */}
        {!showSlots && (
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: 20, fontWeight: '800', color: COLORS.white },
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

  // Return trip card
  returnCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20, borderWidth: 1, borderColor: '#fde68a',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  returnCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fffbeb',
  },
  returnCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  returnCardIcon: { fontSize: 24 },
  returnCardTitle: { fontSize: 15, fontWeight: '800', color: '#92400e' },
  returnCardSub: { fontSize: 12, color: '#b45309', fontWeight: '600', marginTop: 2 },
  returnCardChevron: { fontSize: 12, color: '#b45309', fontWeight: '700' },
  returnCardBody: { borderTopWidth: 1, borderTopColor: '#fde68a' },
  returnRoutePill: {
    backgroundColor: '#fffbeb', marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1, borderColor: '#fde68a',
    alignSelf: 'flex-start',
  },
  returnRoutePillText: { fontSize: 13, fontWeight: '700', color: '#92400e' },

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
  notifyBtn: {
    marginTop: 8, backgroundColor: COLORS.gold, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 13, minWidth: 220, alignItems: 'center',
  },
  notifyBtnText: { color: COLORS.navy, fontWeight: '800', fontSize: 14 },
  tryTomorrowBtn: {
    marginTop: 6, paddingVertical: 8,
  },
  tryTomorrowText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 13 },
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
  bookBtnTextDark: { color: COLORS.gold },

})

// ── Destination search modal styles ──────────────────────────────────────────
const dst = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26,24,20,0.65)',
    justifyContent: 'flex-start',
  },
  panel: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
    maxHeight: '75%',
  },
  fromPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingBottom: 12,
  },
  fromDot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: COLORS.success,
    borderWidth: 2, borderColor: COLORS.successLight,
  },
  fromPillText: { fontSize: 13, color: COLORS.textSecondary },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingBottom: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingTop: 4,
  },
  toDot: {
    width: 9, height: 9, borderRadius: 2,
    backgroundColor: COLORS.navy,
  },
  input: {
    flex: 1, fontSize: 17, fontWeight: '600', color: COLORS.text,
    paddingVertical: 10,
  },
  cancelBtn: { paddingVertical: 8, paddingLeft: 4 },
  cancelText: { fontSize: 14, fontWeight: '700', color: COLORS.gold },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6,
  },
  list: { maxHeight: 380 },
  sep: { height: 1, backgroundColor: COLORS.border, marginLeft: 52 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  nodePin: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2,
  },
  nodePinDirect: {
    backgroundColor: COLORS.navy, borderColor: COLORS.navy + '44',
  },
  nodePinAlias: {
    backgroundColor: 'transparent', borderColor: COLORS.gold,
  },
  rowText: { flex: 1, gap: 2 },
  rowDisplay: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  rowSubtitle: { fontSize: 12, color: COLORS.textMuted },
  rowSubtitleAlias: { color: COLORS.gold, fontWeight: '600' },
  backdrop: { flex: 1 },
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
