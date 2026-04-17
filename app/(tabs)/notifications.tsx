import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, RefreshControl, Platform, ActivityIndicator,
} from 'react-native'
import { usersApi } from '../../lib/api'
import { COLORS } from '../../constants'

const TYPE_ICONS: Record<string, string> = {
  booking_confirmed: '✅',
  payment_received: '💳',
  trip_starting: '🚐',
  driver_cancelled: '⚠️',
  compliance: '📋',
  announcement: '📣',
  general: '🔔',
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data } = await usersApi.getNotifications({ limit: 50 })
      setNotifications(data.data || [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    try {
      await usersApi.markNotificationRead(id)
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch {}
  }

  const onRefresh = () => { setRefreshing(true); load() }

  const renderItem = ({ item: n }: { item: any }) => (
    <TouchableOpacity
      style={[styles.item, !n.is_read && styles.itemUnread]}
      onPress={() => markRead(n.id)}
      activeOpacity={0.85}
    >
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{TYPE_ICONS[n.type] || TYPE_ICONS.general}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.itemTop}>
          <Text style={styles.itemTitle} numberOfLines={1}>{n.title}</Text>
          {!n.is_read && <View style={styles.dot} />}
        </View>
        <Text style={styles.itemBody} numberOfLines={3}>{n.message}</Text>
        <Text style={styles.itemTime}>
          {new Date(n.created_at).toLocaleDateString('en-ZA', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {notifications.some(n => !n.is_read) && (
          <TouchableOpacity onPress={async () => {
            await usersApi.markAllRead().catch(() => {})
            setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
          }}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.navy} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>No notifications yet</Text>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  markAll: { fontSize: 13, color: COLORS.gold, fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  item: {
    flexDirection: 'row', gap: 14, backgroundColor: COLORS.white,
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  itemUnread: { borderLeftWidth: 3, borderLeftColor: COLORS.navy },
  iconBox: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.navy },
  itemBody: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  itemTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary },
})
