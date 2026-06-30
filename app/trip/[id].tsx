import { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Platform, TextInput,
  Dimensions,
} from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as ImagePicker from 'expo-image-picker'
import * as SecureStore from 'expo-secure-store'
import * as Location from 'expo-location'
import * as Linking from 'expo-linking'
import { io, Socket } from 'socket.io-client'
import { bookingsApi, paymentsApi, reviewsApi, tripsApi, safetyApi } from '../../lib/api'
import { COLORS, API_URL } from '../../constants'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange?.(i)} disabled={!onChange}>
          <Text style={{ fontSize: 28 }}>{i <= value ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default function TripDetailScreen() {
  const { id, bookingId } = useLocalSearchParams<{ id: string; bookingId: string }>()
  const router = useRouter()

  const [booking, setBooking] = useState<any>(null)
  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [cancelPreview, setCancelPreview] = useState<any>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [proofUri, setProofUri] = useState<string | null>(null)
  const [submittingProof, setSubmittingProof] = useState(false)
  const [payingCard, setPayingCard] = useState(false)
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number
    longitude: number
    heading?: number
  } | null>(null)
  const [panicSent, setPanicSent] = useState(false)

  const mapRef = useRef<MapView>(null)
  const socketRef = useRef<Socket | null>(null)

  // ── Load booking + trip ───────────────────────────────────────────────────

  useEffect(() => {
    if (!bookingId) return
    const p1 = bookingsApi.getBooking(bookingId)
      .then(({ data }) => setBooking(data.data))
      .catch(() => Alert.alert('Error', 'Could not load booking'))

    const p2 = id
      ? tripsApi.getTrip(id).then(({ data }) => setTrip(data.data)).catch(() => {})
      : Promise.resolve()

    const p3 = reviewsApi.getStatus(bookingId)
      .then(({ data }) => setReviewed(data.data?.reviewed))
      .catch(() => {})

    Promise.all([p1, p2, p3]).finally(() => setLoading(false))
  }, [bookingId, id])

  // ── Live tracking: connect socket when trip is active ─────────────────────

  useEffect(() => {
    if (!trip || trip.status !== 'active' || !id) return

    let socket: Socket

    const connect = async () => {
      const token = await SecureStore.getItemAsync('accessToken')
      if (!token) return

      socket = io(API_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      })
      socketRef.current = socket

      socket.on('connect', () => {
        socket.emit('passenger:join_trip', id)
      })

      socket.on('trip:location', (data: any) => {
        setDriverLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          heading: data.heading,
        })
        mapRef.current?.animateToRegion(
          {
            latitude: data.latitude,
            longitude: data.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          600
        )
      })
    }

    connect()

    return () => {
      socket?.disconnect()
      socketRef.current = null
    }
  }, [trip?.status, id])

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleCancel = async () => {
    setCancelling(true)
    try {
      if (!cancelPreview) {
        const { data } = await bookingsApi.cancelPreview(bookingId)
        setCancelPreview(data.data)
        setCancelling(false)
        return
      }
      await bookingsApi.cancel(bookingId)
      Alert.alert('Cancelled', 'Your booking has been cancelled.')
      router.replace('/(tabs)/bookings')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Cancellation failed')
      setCancelling(false)
    }
  }

  const handleReview = async () => {
    if (!reviewRating) { Alert.alert('Please select a rating'); return }
    setSubmittingReview(true)
    try {
      await reviewsApi.submit({ booking_id: bookingId, rating: reviewRating, comment: reviewComment || undefined })
      setReviewed(true)
      Alert.alert('Thank you!', 'Your review has been submitted.')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Review failed')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handlePayWithCard = async () => {
    setPayingCard(true)
    try {
      const payRes = await paymentsApi.initiate(bookingId)
      const payUrl = payRes.data.data?.redirect_url || payRes.data.data?.payment_url
      if (payUrl) {
        await WebBrowser.openBrowserAsync(payUrl)
        // Give Paystack webhook time to reach our backend before polling status
        let paid = false
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise(r => setTimeout(r, 2000))
          const statusRes = await paymentsApi.getStatus(bookingId)
          if (statusRes.data.data?.payment_status === 'paid') { paid = true; break }
        }
        if (paid) {
          const { data } = await bookingsApi.getBooking(bookingId)
          setBooking(data.data)
        } else {
          Alert.alert('Payment pending', 'Finish payment to confirm your seat.')
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not initiate payment')
    } finally {
      setPayingCard(false)
    }
  }

  const pickProofImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to upload proof of payment.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
    if (!result.canceled && result.assets?.[0]) setProofUri(result.assets[0].uri)
  }

  const submitEftProof = async () => {
    if (!proofUri) return
    setSubmittingProof(true)
    try {
      const filename = proofUri.split('/').pop() || 'proof.jpg'
      const mime = filename.endsWith('.png') ? 'image/png' : 'image/jpeg'
      const formData = new FormData()
      formData.append('proof_of_payment', { uri: proofUri, name: filename, type: mime } as any)
      await bookingsApi.submitEftProof(bookingId, formData)
      Alert.alert('✅ Proof submitted!', "We'll verify your payment and confirm your booking. You'll be notified once approved.")
      const { data } = await bookingsApi.getBooking(bookingId)
      setBooking(data.data)
      setProofUri(null)
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Upload failed')
    } finally {
      setSubmittingProof(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.navy} size="large" />
      </View>
    )
  }

  if (!booking) return null

  const dep = new Date(booking.departure_time || booking.trip?.departure_time)
  const isPaid = booking.payment_status === 'paid'
  const isEftPending = booking.payment_status === 'eft_pending'
  const isUnpaid = booking.payment_status === 'unpaid' && booking.status !== 'cancelled'
  const isCompleted = booking.status === 'completed'
  const isCancellable = ['confirmed', 'pending'].includes(booking.status) && new Date() < dep
  const isTripActive = trip?.status === 'active'

  const handlePanic = () => {
    Alert.alert(
      '🆘 Safety Alert',
      'This will immediately notify the Vya safety team with your location. Use only in a genuine emergency.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Alert',
          style: 'destructive',
          onPress: async () => {
            // Get location silently — don't block if permission denied
            let lat: number | undefined
            let lng: number | undefined
            try {
              const { status } = await Location.requestForegroundPermissionsAsync()
              if (status === 'granted') {
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                lat = pos.coords.latitude
                lng = pos.coords.longitude
              }
            } catch {}

            // Fire alert — fire-and-forget, never block the user
            safetyApi.panic({ trip_id: id, booking_id: bookingId, lat, lng }).catch(() => {})
            setPanicSent(true)

            Alert.alert(
              '✅ Alert Sent',
              'The Vya safety team has been notified. Do you also want to call emergency services?',
              [
                { text: 'Call 10111 (Police)', onPress: () => Linking.openURL('tel:10111') },
                { text: 'Call 112 (Emergency)', onPress: () => Linking.openURL('tel:112') },
                { text: 'No, I\'m OK', style: 'cancel' },
              ]
            )
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isTripActive ? 'Trip in Progress' : 'Booking Details'}
          </Text>
        </View>

        {/* ── Live tracking map ─────────────────────────────────────────────── */}
        {isTripActive && isPaid && (
          <View style={styles.mapCard}>
            <View style={styles.liveHeader}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>LIVE</Text>
              <Text style={styles.liveSubLabel}>Driver location</Text>
            </View>

            <MapView
              ref={mapRef}
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={{
                // Default: midpoint between Gauteng and Limpopo
                latitude: -25.0,
                longitude: 29.5,
                latitudeDelta: 5.0,
                longitudeDelta: 5.0,
              }}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {driverLocation && (
                <Marker
                  coordinate={driverLocation}
                  title={booking.driver_first ? `${booking.driver_first} ${booking.driver_last}` : 'Your driver'}
                  description={`${booking.vehicle_make || ''} ${booking.vehicle_model || ''} · ${booking.registration_number || ''}`.trim() || 'En route'}
                >
                  <View style={styles.driverMarker}>
                    <Text style={styles.driverMarkerIcon}>🚐</Text>
                  </View>
                </Marker>
              )}
            </MapView>

            {!driverLocation && (
              <View style={styles.waitingOverlay}>
                <ActivityIndicator color={COLORS.navy} size="small" />
                <Text style={styles.waitingText}>Waiting for driver location...</Text>
              </View>
            )}

            <Text style={styles.mapHint}>
              Driver is sharing their live location with you
            </Text>
          </View>
        )}

        {/* ── Panic / SOS button — only during active trip ─────────────────── */}
        {isTripActive && (
          <TouchableOpacity
            onPress={panicSent ? undefined : handlePanic}
            activeOpacity={panicSent ? 1 : 0.8}
            style={{
              marginHorizontal: 16, marginBottom: 12,
              backgroundColor: panicSent ? '#4b5563' : '#dc2626',
              borderRadius: 14, paddingVertical: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              opacity: panicSent ? 0.7 : 1,
            }}
          >
            <Text style={{ fontSize: 20 }}>🆘</Text>
            <View>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                {panicSent ? 'Alert Sent — Team Notified' : 'Safety Alert (SOS)'}
              </Text>
              {!panicSent && (
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 }}>
                  Tap to alert Vya safety team + call emergency services
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Boarding pass */}
        {isPaid && (
          <View style={styles.boardingPass}>
            <View style={styles.bpTop}>
              <Text style={styles.bpTitle}>Boarding Pass</Text>
              <View style={styles.codeBadge}>
                <Text style={styles.codeLabel}>CODE</Text>
                <Text style={styles.code}>{booking.pickup_code}</Text>
              </View>
            </View>
            <Text style={styles.bpRoute}>
              {booking.origin_city || booking.trip?.origin_city} → {booking.destination_city || booking.trip?.destination_city}
            </Text>
            <Text style={styles.bpMeta}>
              {dep.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Text>
            <Text style={styles.bpHint}>Show this code to your driver at pickup</Text>
          </View>
        )}

        {/* Booking info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking Info</Text>
          {[
            { label: 'Seats', value: `${booking.seats_booked} seat${booking.seats_booked !== 1 ? 's' : ''}` },
            { label: 'Amount', value: `R${Number(booking.total_price).toFixed(2)}` },
            { label: 'Payment', value: booking.payment_status },
            { label: 'Status', value: isTripActive ? 'In progress' : booking.status },
            { label: 'Pickup', value: booking.pickup_address || '—' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Driver info */}
        {booking.driver_first && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Driver</Text>
            <View style={styles.driverRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{booking.driver_first[0]}{booking.driver_last[0]}</Text>
              </View>
              <View>
                <Text style={styles.driverName}>{booking.driver_first} {booking.driver_last}</Text>
                <Text style={styles.driverMeta}>
                  ⭐ {Number(booking.driver_rating || 0).toFixed(1)} · {booking.vehicle_make} {booking.vehicle_model}
                </Text>
                <Text style={styles.driverMeta}>{booking.vehicle_color} · {booking.registration_number}</Text>
              </View>
            </View>
            {isPaid && (
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => router.push(`/messages/${bookingId}`)}
              >
                <Text style={styles.chatBtnText}>💬 Message Driver</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Cancel preview */}
        {cancelPreview && (
          <View style={styles.cancelCard}>
            <Text style={styles.cancelTitle}>Confirm Cancellation</Text>
            <Text style={styles.cancelPolicy}>{cancelPreview.policy_label}</Text>
            <View style={styles.refundRow}>
              <Text style={styles.refundLabel}>Refund amount</Text>
              <Text style={styles.refundAmount}>R{Number(cancelPreview.refund_amount || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.cancelBtns}>
              <TouchableOpacity style={styles.keepBtn} onPress={() => setCancelPreview(null)}>
                <Text style={styles.keepBtnText}>Keep booking</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={handleCancel} disabled={cancelling}>
                {cancelling
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={styles.confirmCancelText}>Yes, cancel</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Actions */}
        {isCancellable && !cancelPreview && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={cancelling}>
            {cancelling
              ? <ActivityIndicator color={COLORS.danger} />
              : <Text style={styles.cancelBtnText}>Cancel Booking</Text>
            }
          </TouchableOpacity>
        )}

        {/* EFT under review notice */}
        {isEftPending && (
          <View style={styles.eftPendingCard}>
            <Text style={styles.eftPendingTitle}>🕐 EFT under review</Text>
            <Text style={styles.eftPendingText}>Your proof of payment has been submitted. We'll verify and confirm your booking within a few hours.</Text>
          </View>
        )}

        {/* Payment required */}
        {isUnpaid && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Complete your payment</Text>
            <Text style={styles.paySubtext}>Your seat is held but not confirmed until payment is received.</Text>

            <TouchableOpacity style={styles.payCardBtn} onPress={handlePayWithCard} disabled={payingCard} activeOpacity={0.85}>
              {payingCard
                ? <ActivityIndicator color="white" />
                : <Text style={styles.payCardBtnText}>💳 Pay with Card / Instant EFT</Text>
              }
            </TouchableOpacity>

            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            <Text style={styles.eftUploadLabel}>Upload EFT proof of payment</Text>
            <TouchableOpacity style={styles.eftPickBtn} onPress={pickProofImage} activeOpacity={0.85}>
              {proofUri
                ? <Text style={styles.eftPickBtnText}>✅ Image selected — tap to change</Text>
                : <Text style={styles.eftPickBtnText}>📎 Choose image from gallery</Text>
              }
            </TouchableOpacity>
            {proofUri && (
              <TouchableOpacity
                style={[styles.eftSubmitBtn, submittingProof && { opacity: 0.5 }]}
                onPress={submitEftProof}
                disabled={submittingProof}
                activeOpacity={0.85}
              >
                {submittingProof
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.eftSubmitBtnText}>Submit Proof of Payment</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Review */}
        {isCompleted && !reviewed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rate your trip</Text>
            <StarRating value={reviewRating} onChange={setReviewRating} />
            <View style={styles.field}>
              <Text style={styles.label}>Comment (optional)</Text>
              <TextInput
                style={styles.textArea}
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="How was your experience?"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            <TouchableOpacity style={styles.reviewBtn} onPress={handleReview} disabled={submittingReview}>
              {submittingReview
                ? <ActivityIndicator color="white" />
                : <Text style={styles.reviewBtnText}>Submit Review</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {isCompleted && reviewed && (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 32 }}>⭐</Text>
            <Text style={styles.reviewedText}>Review submitted — thank you!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: Platform.OS === 'android' ? 28 : 0 },
  back: { padding: 4 },
  backText: { fontSize: 15, color: COLORS.navy, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy },

  // ── Live tracking map ──────────────────────────────────────────────────────
  mapCard: {
    backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  liveHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a',
  },
  liveLabel: { fontSize: 11, fontWeight: '800', color: '#16a34a', letterSpacing: 1 },
  liveSubLabel: { fontSize: 13, fontWeight: '600', color: COLORS.navy },
  map: { width: SCREEN_WIDTH - 40, height: 240 },
  waitingOverlay: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    gap: 8, paddingVertical: 10,
    backgroundColor: 'rgba(245,240,230,0.92)',
  },
  waitingText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  driverMarker: { alignItems: 'center', justifyContent: 'center' },
  driverMarkerIcon: { fontSize: 28 },
  mapHint: {
    fontSize: 11, color: COLORS.textMuted, textAlign: 'center',
    paddingVertical: 8, paddingHorizontal: 16,
  },

  // ── Boarding pass ──────────────────────────────────────────────────────────
  boardingPass: {
    backgroundColor: COLORS.navy, borderRadius: 20, padding: 22,
    gap: 6, overflow: 'hidden',
  },
  bpTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  bpTitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  codeBadge: { backgroundColor: COLORS.gold, borderRadius: 10, padding: 10, alignItems: 'center' },
  codeLabel: { fontSize: 9, fontWeight: '700', color: COLORS.navy, letterSpacing: 1 },
  code: { fontSize: 22, fontWeight: '900', color: COLORS.navy, letterSpacing: 3 },
  bpRoute: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  bpMeta: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  bpHint: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 },

  // ── Cards ──────────────────────────────────────────────────────────────────
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 18, gap: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, color: COLORS.textSecondary },
  rowValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  driverName: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  driverMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  chatBtn: {
    backgroundColor: COLORS.offWhite, borderRadius: 10, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  chatBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.navy },

  // ── Cancel ─────────────────────────────────────────────────────────────────
  cancelCard: {
    backgroundColor: COLORS.dangerLight, borderRadius: 14, padding: 18,
    gap: 10, borderWidth: 1, borderColor: '#fca5a5',
  },
  cancelTitle: { fontSize: 15, fontWeight: '700', color: COLORS.danger },
  cancelPolicy: { fontSize: 13, color: '#7f1d1d' },
  refundRow: { flexDirection: 'row', justifyContent: 'space-between' },
  refundLabel: { fontSize: 13, color: COLORS.textSecondary },
  refundAmount: { fontSize: 16, fontWeight: '700', color: COLORS.success },
  cancelBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  keepBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    backgroundColor: COLORS.white, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  keepBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  confirmCancelBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    backgroundColor: COLORS.danger, alignItems: 'center',
  },
  confirmCancelText: { fontSize: 14, fontWeight: '700', color: 'white' },
  cancelBtn: {
    padding: 16, borderRadius: 12, alignItems: 'center',
    backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: '#fca5a5',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.danger },

  // ── Review ─────────────────────────────────────────────────────────────────
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  textArea: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 14, backgroundColor: COLORS.offWhite, minHeight: 80,
    fontSize: 14, color: COLORS.text,
  },
  reviewBtn: {
    backgroundColor: COLORS.navy, borderRadius: 12, padding: 14, alignItems: 'center',
  },
  reviewBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  reviewedText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },

  // ── EFT pending ────────────────────────────────────────────────────────────
  eftPendingCard: {
    backgroundColor: '#fff7ed', borderRadius: 14, padding: 18, gap: 8,
    borderWidth: 1, borderColor: '#fed7aa',
  },
  eftPendingTitle: { fontSize: 15, fontWeight: '700', color: '#c2410c' },
  eftPendingText: { fontSize: 13, color: '#9a3412', lineHeight: 18 },

  // ── Payment required ───────────────────────────────────────────────────────
  paySubtext: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  payCardBtn: {
    backgroundColor: COLORS.navy, borderRadius: 12, padding: 14, alignItems: 'center',
  },
  payCardBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  eftUploadLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  eftPickBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, alignItems: 'center', backgroundColor: COLORS.offWhite,
    borderStyle: 'dashed',
  },
  eftPickBtnText: { fontSize: 14, color: COLORS.navy, fontWeight: '600' },
  eftSubmitBtn: {
    backgroundColor: COLORS.gold, borderRadius: 12, padding: 14, alignItems: 'center',
  },
  eftSubmitBtnText: { color: COLORS.navy, fontWeight: '800', fontSize: 14 },
})
