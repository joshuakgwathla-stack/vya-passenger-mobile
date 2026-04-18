import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { tripsApi, bookingsApi, paymentsApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { COLORS } from '../../constants'

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
      Alert.alert('Pickup required', 'Please enter where the driver should pick you up.')
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
      {/* Top bar */}
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
        {/* Trip hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroRoute}>
            <View style={styles.heroCity}>
              <View style={styles.dotGreen} />
              <Text style={styles.heroCityText}>{trip.origin_city}</Text>
            </View>
            <View style={styles.heroLine} />
            <View style={styles.heroCity}>
              <View style={styles.dotNavy} />
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
          <Text style={styles.cardTitle}>Pickup & drop-off</Text>
          <View style={styles.addressBlock}>
            <View style={styles.addressRow}>
              <View style={styles.addressDotGreen} />
              <TextInput
                style={styles.addressInput}
                placeholder="Pickup address *"
                placeholderTextColor={COLORS.textMuted}
                value={pickup}
                onChangeText={setPickup}
                multiline
              />
            </View>
            <View style={styles.addressConnector} />
            <View style={styles.addressRow}>
              <View style={styles.addressDotNavy} />
              <TextInput
                style={styles.addressInput}
                placeholder="Drop-off (optional)"
                placeholderTextColor={COLORS.textMuted}
                value={dropoff}
                onChangeText={setDropoff}
                multiline
              />
            </View>
          </View>
          <Text style={styles.addressHint}>
            Your driver will confirm exact pickup once booked.
          </Text>
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

        {/* Spacer for sticky footer */}
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
          {booking || paying ? (
            <ActivityIndicator color={COLORS.navy} />
          ) : (
            <Text style={styles.payBtnText}>Pay with PayFast →</Text>
          )}
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

  // Hero card
  heroCard: {
    backgroundColor: COLORS.navy, borderRadius: 20, padding: 20, gap: 16,
  },
  heroRoute: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  heroCity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  heroCityText: { fontSize: 16, fontWeight: '800', color: COLORS.white },
  heroLine: { flex: 0, width: 20, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34d399' },
  dotNavy: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },

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

  // Shared card
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy, marginBottom: 14 },

  // Seats
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  seatBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  seatBtnDisabled: { backgroundColor: COLORS.border },
  seatBtnText: { fontSize: 22, color: 'white', fontWeight: '700', lineHeight: 26 },
  seatCountBox: { width: 52, alignItems: 'center' },
  seatCount: { fontSize: 28, fontWeight: '900', color: COLORS.navy },
  seatLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: -2 },
  pricePerSeat: { fontSize: 13, color: COLORS.textSecondary, marginLeft: 'auto' as any },

  // Address
  addressBlock: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, overflow: 'hidden',
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  addressConnector: { height: 1, backgroundColor: COLORS.border, marginLeft: 40 },
  addressDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34d399', marginTop: 5 },
  addressDotNavy: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.navy, marginTop: 5 },
  addressInput: { flex: 1, fontSize: 14, color: COLORS.text, minHeight: 40, paddingTop: 0 },
  addressHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 10, lineHeight: 18 },

  // Steps
  stepsCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 18, gap: 14,
  },
  stepsTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumText: { fontSize: 12, fontWeight: '700', color: COLORS.gold },
  stepText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, paddingTop: 2 },

  // Sticky pay bar
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
