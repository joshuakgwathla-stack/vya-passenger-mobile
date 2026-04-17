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
      </View>
    )
  }

  if (!trip) return null

  const dep = new Date(trip.departure_time)
  const total = (Number(trip.price_per_seat) * seats).toFixed(2)

  const handleBook = async () => {
    if (!pickup.trim()) { Alert.alert('Required', 'Please enter your pickup address'); return }
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
      // Initiate PayFast payment
      const payRes = await paymentsApi.initiate(bookingId)
      const payUrl = payRes.data.data?.redirect_url || payRes.data.data?.payment_url
      if (payUrl) {
        const result = await WebBrowser.openBrowserAsync(payUrl)
        // Check payment status after browser closes
        const statusRes = await paymentsApi.getStatus(bookingId)
        const status = statusRes.data.data?.payment_status
        if (status === 'paid') {
          Alert.alert('Booking confirmed! 🎉', 'Your seat is booked. Check your bookings tab.')
          router.replace(`/trip/${trip.id}?bookingId=${bookingId}`)
        } else {
          Alert.alert('Payment pending', 'Complete your payment to confirm the booking.', [
            { text: 'View Booking', onPress: () => router.replace(`/trip/${trip.id}?bookingId=${bookingId}`) },
          ])
        }
      } else {
        router.replace(`/trip/${trip.id}?bookingId=${bookingId}`)
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Booking failed. Please try again.')
    } finally {
      setBooking(false)
      setPaying(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Trip</Text>
        </View>

        {/* Trip summary */}
        <View style={styles.tripCard}>
          <Text style={styles.route}>{trip.origin_city} → {trip.destination_city}</Text>
          <Text style={styles.tripMeta}>
            {dep.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}
            {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </Text>
          <View style={styles.driverRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{trip.driver_first?.[0]}{trip.driver_last?.[0]}</Text>
            </View>
            <View>
              <Text style={styles.driverName}>{trip.driver_first} {trip.driver_last}</Text>
              <Text style={styles.driverMeta}>⭐ {Number(trip.driver_rating || 0).toFixed(1)} · {trip.vehicle_make} {trip.vehicle_model} ({trip.vehicle_color})</Text>
            </View>
          </View>
        </View>

        {/* Seats selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Number of Seats</Text>
          <View style={styles.seatRow}>
            <TouchableOpacity
              style={styles.seatBtn}
              onPress={() => setSeats(s => Math.max(1, s - 1))}
            >
              <Text style={styles.seatBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.seatCount}>{seats}</Text>
            <TouchableOpacity
              style={styles.seatBtn}
              onPress={() => setSeats(s => Math.min(trip.available_seats, s + 1))}
            >
              <Text style={styles.seatBtnText}>+</Text>
            </TouchableOpacity>
            <Text style={styles.seatAvail}>{trip.available_seats} available</Text>
          </View>
        </View>

        {/* Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup & Drop-off</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Pickup address *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10 Main St, Johannesburg"
              placeholderTextColor={COLORS.textMuted}
              value={pickup}
              onChangeText={setPickup}
              multiline
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Drop-off address (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Polokwane CBD"
              placeholderTextColor={COLORS.textMuted}
              value={dropoff}
              onChangeText={setDropoff}
              multiline
            />
          </View>
        </View>

        {/* Price summary */}
        <View style={styles.priceSummary}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>R{Number(trip.price_per_seat).toFixed(2)} × {seats} seat{seats !== 1 ? 's' : ''}</Text>
            <Text style={styles.priceValue}>R{total}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>R{total}</Text>
          </View>
        </View>

        {/* Book button */}
        <TouchableOpacity
          style={[styles.bookBtn, (booking || paying) && { opacity: 0.7 }]}
          onPress={handleBook}
          disabled={booking || paying}
        >
          {booking || paying
            ? <ActivityIndicator color="white" />
            : <Text style={styles.bookBtnText}>
                {paying ? 'Opening payment...' : `Pay R${total} with PayFast`}
              </Text>
          }
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Your seat is held for 30 minutes after booking. Complete payment to confirm.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite },
  scroll: { padding: 20, gap: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: Platform.OS === 'android' ? 28 : 0 },
  back: { padding: 4 },
  backText: { fontSize: 15, color: COLORS.navy, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  tripCard: {
    backgroundColor: COLORS.navy, borderRadius: 16, padding: 20, gap: 8,
  },
  route: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  tripMeta: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  driverName: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  driverMeta: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  section: { backgroundColor: COLORS.white, borderRadius: 14, padding: 18, gap: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  seatBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  seatBtnText: { fontSize: 20, color: 'white', fontWeight: '700', lineHeight: 24 },
  seatCount: { fontSize: 24, fontWeight: '800', color: COLORS.navy, minWidth: 32, textAlign: 'center' },
  seatAvail: { fontSize: 13, color: COLORS.textMuted },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 14, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.offWhite,
    minHeight: 48,
  },
  priceSummary: { backgroundColor: COLORS.white, borderRadius: 14, padding: 18, gap: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontSize: 14, color: COLORS.textSecondary },
  priceValue: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  bookBtn: {
    backgroundColor: COLORS.navy, borderRadius: 14,
    padding: 18, alignItems: 'center',
  },
  bookBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  disclaimer: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 },
})
