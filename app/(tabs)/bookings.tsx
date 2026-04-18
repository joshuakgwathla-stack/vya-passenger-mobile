import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl, Platform, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { bookingsApi } from '../../lib/api'
import { COLORS } from '../../constants'

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: '#ecfdf5', text: '#059669', label: 'Confirmed' },
  pending:   { bg: '#fffbeb', text: '#d97706', label: 'Pending payment' },
  completed: { bg: '#eff6ff', text: '#1d4ed8', label: 'Completed' },
  cancelled: { bg: '#fef2f2', text: '#dc2626', label: 'Cancelled' },
}

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
]

function BoardingPass({ b, onPress }: { b: any; onPress: () => void }) {
  const dep = new Date(b.departure_time)
  const sc = STATUS_CONFIG[b.status] || { bg: '#f1f5f9', text: '#64748b', label: b.status }
  const isUnpaid = b.payment_status === 'unpaid' && b.status !== 'cancelled'
  const isCompleted = b.status === 'completed'

  const todayMs = new Date().setHours(0, 0, 0, 0)
  const depMs = new Date(dep).setHours(0, 0, 0, 0)
  const diffDays = Math.round((depMs - todayMs) / 86400000)

  const dayLabel = (() => {
    if (depMs === todayMs) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays > 0) return `In ${diffDays} days`
    return dep.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
  })()

  return (
    <TouchableOpacity style={styles.pass} onPress={onPress} activeOpacity={0.88}>
      {/* Tear line at top */}
      {isUnpaid && (
        <View style={styles.urgentBanner}>
          <Text style={styles.urgentText}>⚠️  Complete payment to confirm your seat</Text>
        </View>
      )}

      <View style={styles.passBody}>
        {/* Left: time block */}
        <View style={styles.passLeft}>
          <Text style={styles.passTime}>
            {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </Text>
          <Text style={styles.passDay}>{dayLabel}</Text>
        </View>

        {/* Divider with dots */}
        <View style={styles.passDividerCol}>
          <View style={styles.passDot} />
          <View style={styles.passDividerLine} />
          <View style={styles.passDot} />
        </View>

        {/* Middle: route */}
        <View style={styles.passMiddle}>
          <Text style={styles.passCity}>{b.origin_city}</Text>
          <Text style={styles.passCitySmall}>to</Text>
          <Text style={styles.passCity}>{b.destination_city}</Text>
        </View>

        {/* Right: seats + price */}
        <View style={styles.passRight}>
          <Text style={styles.passSeats}>{b.seats_booked}</Text>
          <Text style={styles.passSeatLabel}>{b.seats_booked === 1 ? 'seat' : 'seats'}</Text>
          <Text style={styles.passPrice}>R{Number(b.total_price).toFixed(0)}</Text>
        </View>
      </View>

      {/* Perforated separator */}
      <View style={styles.perfRow}>
        <View style={styles.perfLeft} />
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={styles.perfDash} />
        ))}
        <View style={styles.perfRight} />
      </View>

      {/* Footer */}
      <View style={styles.passFooter}>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
        </View>
        {b.booking_code && (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>CODE</Text>
            <Text style={styles.codeValue}>{b.booking_code}</Text>
          </View>
        )}
        {!isCompleted && !isUnpaid && (
          <Text style={styles.tapHint}>Tap for details →</Text>
        )}
        {isUnpaid && (
          <TouchableOpacity style={styles.payNowBtn} onPress={onPress}>
            <Text style={styles.payNowText}>Pay now</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default function MyTripsScreen() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('upcoming')

  const load = useCallback(async () => {
    try {
      const params = activeTab === 'upcoming'
        ? { status: 'confirmed,pending' }
        : { status: activeTab }
      const { data } = await bookingsApi.getMyBookings(params)
      setBookings(data.data || [])
    } catch {
      setBookings([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab])

  useEffect(() => { setLoading(true); load() }, [activeTab])

  const onRefresh = () => { setRefreshing(true); load() }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Trips</Text>
        <Text style={styles.subtitle}>Your upcoming and past bookings</Text>
      </View>

      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, activeTab === t.key && styles.tabItemActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.navy} size="large" />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={b => b.id}
          renderItem={({ item: b }) => (
            <BoardingPass
              b={b}
              onPress={() => router.push(`/trip/${b.trip_id}?bookingId=${b.id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.navy} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎫</Text>
              <Text style={styles.emptyTitle}>No {activeTab} trips</Text>
              <Text style={styles.emptyText}>
                {activeTab === 'upcoming' ? 'Book a trip from the Home tab to get started.' : 'Nothing here yet.'}
              </Text>
              {activeTab === 'upcoming' && (
                <TouchableOpacity style={styles.bookCta} onPress={() => router.push('/(tabs)/')}>
                  <Text style={styles.bookCtaText}>Find a trip →</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    backgroundColor: COLORS.navy, paddingHorizontal: 20, paddingBottom: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.white },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: COLORS.navy },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.navy },

  list: { padding: 16, gap: 14, paddingBottom: 32 },

  // Boarding pass
  pass: {
    backgroundColor: COLORS.white, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    overflow: 'hidden',
  },
  urgentBanner: {
    backgroundColor: '#fffbeb', paddingVertical: 8, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  urgentText: { fontSize: 12, color: '#92400e', fontWeight: '600' },

  passBody: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 0 },

  passLeft: { alignItems: 'center', width: 68 },
  passTime: { fontSize: 22, fontWeight: '900', color: COLORS.navy },
  passDay: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginTop: 2 },

  passDividerCol: { alignItems: 'center', width: 32, gap: 4 },
  passDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  passDividerLine: { width: 1, flex: 1, minHeight: 20, backgroundColor: COLORS.border },

  passMiddle: { flex: 1, gap: 1 },
  passCity: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  passCitySmall: { fontSize: 11, color: COLORS.textMuted },

  passRight: { alignItems: 'flex-end', minWidth: 56 },
  passSeats: { fontSize: 26, fontWeight: '900', color: COLORS.navy },
  passSeatLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: -2 },
  passPrice: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginTop: 4 },

  // Perforated tear line
  perfRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -1 },
  perfLeft: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.offWhite, marginLeft: -6 },
  perfDash: { flex: 1, height: 1, backgroundColor: COLORS.border, marginHorizontal: 2 },
  perfRight: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.offWhite, marginRight: -6 },

  passFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 12, gap: 10,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' as any },
  codeLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  codeValue: { fontSize: 13, fontWeight: '900', color: COLORS.navy, letterSpacing: 1 },
  tapHint: { fontSize: 12, color: COLORS.textMuted, marginLeft: 'auto' as any },
  payNowBtn: {
    marginLeft: 'auto' as any, backgroundColor: COLORS.gold,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  payNowText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.navy, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  bookCta: {
    marginTop: 20, backgroundColor: COLORS.navy,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14,
  },
  bookCtaText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
})
