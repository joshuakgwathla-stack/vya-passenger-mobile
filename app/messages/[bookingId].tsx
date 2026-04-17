import { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { messagesApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { COLORS } from '../../constants'

export default function MessagesScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const load = async () => {
    try {
      const { data } = await messagesApi.getMessages(bookingId)
      setMessages(data.data || [])
    } catch {}
    finally { setLoading(false) }
  }

  const send = async () => {
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    setSending(true)
    try {
      await messagesApi.sendMessage(bookingId, content)
      await load()
      listRef.current?.scrollToEnd({ animated: true })
    } catch {}
    finally { setSending(false) }
  }

  const renderMsg = ({ item: m }: { item: any }) => {
    const isMe = m.sender_id === user?.id
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {!isMe && <Text style={styles.senderName}>{m.sender_first} {m.sender_last}</Text>}
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{m.content}</Text>
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
          {new Date(m.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Driver Chat</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.navy} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={renderMsg}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No messages yet. Say hi to your driver!</Text>
              </View>
            }
          />
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={500}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending || !text.trim()}>
              {sending
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={styles.sendIcon}>➤</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    backgroundColor: COLORS.navy, flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingTop: Platform.OS === 'android' ? 44 : 16, gap: 14,
  },
  back: { padding: 4 },
  backText: { fontSize: 20, color: COLORS.white },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12, gap: 4 },
  bubbleMe: { backgroundColor: COLORS.navy, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: COLORS.white, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  bubbleText: { fontSize: 14, color: COLORS.text },
  bubbleTextMe: { color: COLORS.white },
  bubbleTime: { fontSize: 10, color: COLORS.textMuted, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.5)' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  inputRow: {
    flexDirection: 'row', gap: 10, padding: 12,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.offWhite, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { fontSize: 16, color: 'white' },
})
