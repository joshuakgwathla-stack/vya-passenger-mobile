import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl, Platform, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { bookingsApi } from '../../lib/api'
import { COLORS } from '../../constants'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: '#ecfdf5', text: '#059669' },
  pending:   { bg: '#fffbeb', text: '#d97706' },
  completed: { bg: '#eff6ff', text: '#1d4ed8' },
  cancelled: { bg: '#fef2f2', text: '#dc2626' },
}

const TABS = ['upcoming', 'completed', 'cancelled']

export default function BookingsScreen() {
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

  const renderBooking = ({ item: b }: { item: any }) => {
    const dep = new Date(b.departure_time)
    const sc = STATUS_COLORS[b.status] || { bg: '#f1f5f9', text: '#64748b' }
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/trip/${b.trip_id}?bookingId=${b.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.route}>{b.origin_city} → {b.destination_city}</Text>
            <Text style={styles.meta}>
              {dep.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}
              {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>
              {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
            </Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.seats}>{b.seats_booked} seat{b.seats_booked !== 1 ? 's' : ''}</Text>
          <Text style={styles.amount}>R{Number(b.total_price).toFixed(2)}</Text>
        </View>
        {b.payment_status === 'unpaid' && b.status !== 'cancelled' && (
          <View style={styles.payBanner}>
            <Text style={styles.payBannerText}>⚠️ Payment pending — tap to complete</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.navy} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={b => b.id}
          renderItem={renderBooking}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎫</Text>
              <Text style={styles.emptyText}>No {activeTab} bookings</Text>
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
    backgroundColor: COLORS.navy, padding: 24,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  tabs: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.navy },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.navy },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  route: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seats: { fontSize: 13, color: COLORS.textSecondary },
  amount: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  payBanner: {
    backgroundColor: '#fffbeb', borderRadius: 8, padding: 10, marginTop: 10,
    borderWidth: 1, borderColor: '#fde68a',
  },
  payBannerText: { fontSize: 12, color: '#92400e', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
})
