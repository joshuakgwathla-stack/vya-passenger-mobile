import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Platform, ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { useAuth } from '../../lib/auth'
import { usersApi } from '../../lib/api'
import { COLORS } from '../../constants'

export default function ProfileScreen() {
  const { user, logout, refresh } = useAuth()
  const [tab, setTab] = useState<'info' | 'password'>('info')
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
  })
  const [passForm, setPassForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const setPass = (k: string) => (v: string) => setPassForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('first_name', form.first_name)
      fd.append('last_name', form.last_name)
      if (form.phone) fd.append('phone', form.phone)
      await usersApi.updateProfile(fd)
      await refresh()
      Alert.alert('Success', 'Profile updated!')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (passForm.new_password !== passForm.confirm) {
      Alert.alert('Error', 'Passwords do not match'); return
    }
    if (passForm.new_password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters'); return
    }
    setSaving(true)
    try {
      await usersApi.changePassword({
        current_password: passForm.current_password,
        new_password: passForm.new_password,
      })
      Alert.alert('Success', 'Password changed!')
      setPassForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Password change failed')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ])
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </Text>
          </View>
          <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['info', 'password'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'info' ? 'Personal Info' : 'Change Password'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.body}>
          {tab === 'info' ? (
            <View style={styles.card}>
              {[
                { k: 'first_name', label: 'First Name' },
                { k: 'last_name', label: 'Last Name' },
                { k: 'phone', label: 'Phone', keyboardType: 'phone-pad' as const },
              ].map(({ k, label, keyboardType }) => (
                <View key={k} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={(form as any)[k]}
                    onChangeText={set(k)}
                    keyboardType={keyboardType}
                    autoCapitalize={k === 'phone' ? 'none' : 'words'}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              {[
                { k: 'current_password', label: 'Current Password' },
                { k: 'new_password', label: 'New Password' },
                { k: 'confirm', label: 'Confirm New Password' },
              ].map(({ k, label }) => (
                <View key={k} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={(passForm as any)[k]}
                    onChangeText={setPass(k)}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.btn} onPress={handlePasswordChange} disabled={saving}>
                {saving ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    backgroundColor: COLORS.navy, padding: 32,
    paddingTop: Platform.OS === 'android' ? 52 : 24,
    alignItems: 'center',
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: COLORS.navy },
  name: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  tabs: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.navy },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.navy },
  body: { padding: 16, gap: 12 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14,
    padding: 20, gap: 16,
  },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 14, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.offWhite,
  },
  btn: {
    backgroundColor: COLORS.navy, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 4,
  },
  btnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  logoutBtn: {
    backgroundColor: COLORS.dangerLight, borderRadius: 12,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#fca5a5',
  },
  logoutText: { color: COLORS.danger, fontWeight: '700', fontSize: 15 },
})
