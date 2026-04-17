import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { bookingsApi, reviewsApi } from '../../lib/api'
import { COLORS } from '../../constants'

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
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [cancelPreview, setCancelPreview] = useState<any>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    if (!bookingId) return
    bookingsApi.getBooking(bookingId)
      .then(({ data }) => setBooking(data.data))
      .catch(() => Alert.alert('Error', 'Could not load booking'))
      .finally(() => setLoading(false))

    reviewsApi.getStatus(bookingId)
      .then(({ data }) => setReviewed(data.data?.reviewed))
      .catch(() => {})
  }, [bookingId])

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
  const isCompleted = booking.status === 'completed'
  const isCancellable = ['confirmed', 'pending'].includes(booking.status) && new Date() < dep

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
        </View>

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
            { label: 'Status', value: booking.status },
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

        {/* Review */}
        {isCompleted && !reviewed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rate your trip</Text>
            <StarRating value={reviewRating} onChange={setReviewRating} />
            <View style={styles.field}>
              <Text style={styles.label}>Comment (optional)</Text>
              <View style={styles.textArea}>
                <Text
                  style={styles.textAreaInput}
                  onPress={() => {}}
                >
                  {reviewComment || 'How was your experience?'}
                </Text>
              </View>
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
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  textArea: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 14, backgroundColor: COLORS.offWhite, minHeight: 80,
  },
  textAreaInput: { fontSize: 14, color: COLORS.textMuted },
  reviewBtn: {
    backgroundColor: COLORS.navy, borderRadius: 12, padding: 14, alignItems: 'center',
  },
  reviewBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  reviewedText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },
})
