import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Platform, ScrollView, TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { usersApi, authApi } from '../../lib/api'
import { COLORS } from '../../constants'
import { getSavedAddress, setSavedAddress, clearSavedAddress } from '../../lib/savedAddress'

export default function ProfileScreen() {
  const router = useRouter()
  const { user, logout, refresh } = useAuth()

  if (!user) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <Text style={{ fontSize: 36, marginBottom: 16 }}>👤</Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' }}>Your profile</Text>
      <Text style={{ fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 28 }}>Sign in to manage your account, saved addresses, and preferences.</Text>
      <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={{ backgroundColor: COLORS.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 }}>
        <Text style={{ color: COLORS.navy, fontSize: 15, fontWeight: '800' }}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={{ marginTop: 12 }}>
        <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>New to Vya? <Text style={{ color: COLORS.brass, fontWeight: '700' }}>Create account</Text></Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
  const [tab, setTab] = useState<'info' | 'password'>('info')
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
  })
  const [passForm, setPassForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [homeAddress, setHomeAddress] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  // Phone verification
  const [otpModal, setOtpModal] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpChannel, setOtpChannel] = useState<'sms' | 'email' | null>(null)
  const [otpEmail, setOtpEmail] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)

  useEffect(() => {
    getSavedAddress().then(a => { if (a) setHomeAddress(a) })
  }, [])

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

  const handleSaveAddress = async () => {
    if (!homeAddress.trim()) {
      Alert.alert('Empty address', 'Enter an address or tap Clear to remove the saved one.')
      return
    }
    setSavingAddress(true)
    await setSavedAddress(homeAddress.trim())
    setSavingAddress(false)
    Alert.alert('Saved', 'Your pickup address has been saved. It will be pre-filled on your next booking.')
  }

  const handleClearAddress = () => {
    Alert.alert('Clear address', 'Remove your saved pickup address?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await clearSavedAddress()
        setHomeAddress('')
      }},
    ])
  }

  const handleSendOtp = async () => {
    if (!user?.phone) {
      Alert.alert('No phone', 'Add a phone number to your profile first.')
      return
    }
    setOtpSending(true)
    try {
      const { data } = await authApi.sendPhoneOtp(user.phone)
      setOtpChannel(data.data?.channel || 'sms')
      setOtpEmail(data.data?.email || '')
      setOtpCode('')
      setOtpModal(true)
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not send OTP. Try again.')
    } finally {
      setOtpSending(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      Alert.alert('Invalid code', 'Enter the 6-digit code.')
      return
    }
    setOtpVerifying(true)
    try {
      await authApi.verifyPhoneOtp(user!.phone, otpCode)
      await refresh()
      setOtpModal(false)
      Alert.alert('Verified!', 'Your phone number has been verified.')
    } catch (err: any) {
      Alert.alert('Wrong code', err.response?.data?.message || 'Invalid or expired code. Try again.')
    } finally {
      setOtpVerifying(false)
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

        {/* Phone verification banner */}
        {!user?.is_verified && (
          <TouchableOpacity style={styles.verifyBanner} onPress={handleSendOtp} disabled={otpSending}>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyBannerTitle}>Verify your phone number</Text>
              <Text style={styles.verifyBannerSub}>Required to make bookings</Text>
            </View>
            {otpSending
              ? <ActivityIndicator color={COLORS.navy} size="small" />
              : <Text style={styles.verifyBannerCta}>Verify →</Text>
            }
          </TouchableOpacity>
        )}

        {/* OTP modal */}
        <Modal visible={otpModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOtpModal(false)}>
          <SafeAreaView style={styles.otpSafe}>
            <View style={styles.otpContent}>
              <Text style={styles.otpTitle}>Enter verification code</Text>
              <Text style={styles.otpSub}>
                {otpChannel === 'email'
                  ? `We couldn't reach your phone via SMS, so we sent the code to ${otpEmail}`
                  : `A 6-digit code was sent to ${user?.phone}`
                }
              </Text>
              <TextInput
                style={styles.otpInput}
                value={otpCode}
                onChangeText={t => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="000000"
                placeholderTextColor={COLORS.textMuted}
                maxLength={6}
                autoFocus
              />
              <TouchableOpacity style={styles.btn} onPress={handleVerifyOtp} disabled={otpVerifying}>
                {otpVerifying
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.btnText}>Verify</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.otpResend} onPress={handleSendOtp} disabled={otpSending}>
                <Text style={styles.otpResendText}>
                  {otpSending ? 'Sending...' : 'Resend code'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOtpModal(false)}>
                <Text style={styles.otpCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>

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

          ) : null}

          {tab === 'info' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>🏠 Saved Pickup Address</Text>
              <Text style={styles.sectionHint}>Pre-filled on every booking — no need to type your address each time</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Your home / pickup address</Text>
                <TextInput
                  style={styles.input}
                  value={homeAddress}
                  onChangeText={setHomeAddress}
                  placeholder="e.g. 12 Main Street, Sandton"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  multiline
                />
              </View>
              <TouchableOpacity style={styles.btn} onPress={handleSaveAddress} disabled={savingAddress}>
                {savingAddress ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Save Address</Text>}
              </TouchableOpacity>
              {homeAddress.length > 0 && (
                <TouchableOpacity onPress={handleClearAddress}>
                  <Text style={styles.clearText}>Clear saved address</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {tab === 'password' && (
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
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  sectionHint: { fontSize: 12, color: COLORS.textMuted, marginTop: -8, lineHeight: 17 },
  clearText: { fontSize: 13, color: COLORS.danger, fontWeight: '600', textAlign: 'center', paddingTop: 4 },

  // Phone verification
  verifyBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fffbeb', borderBottomWidth: 1, borderBottomColor: '#fde68a',
    padding: 16, gap: 12,
  },
  verifyBannerTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  verifyBannerSub: { fontSize: 12, color: '#b45309', marginTop: 1 },
  verifyBannerCta: { fontSize: 14, fontWeight: '800', color: '#92400e' },

  otpSafe: { flex: 1, backgroundColor: COLORS.white },
  otpContent: { flex: 1, padding: 32, gap: 16 },
  otpTitle: { fontSize: 22, fontWeight: '900', color: COLORS.navy, marginTop: 16 },
  otpSub: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  otpInput: {
    borderWidth: 2, borderColor: COLORS.navy, borderRadius: 14,
    padding: 18, fontSize: 32, fontWeight: '900', color: COLORS.navy,
    letterSpacing: 14, textAlign: 'center', marginVertical: 8,
  },
  otpResend: { alignItems: 'center', paddingVertical: 8 },
  otpResendText: { fontSize: 14, color: COLORS.navy, fontWeight: '600', textDecorationLine: 'underline' },
  otpCancel: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 8 },
})
