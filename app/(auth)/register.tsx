import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { COLORS } from '../../constants'
import { VyaIcon } from '../../components/VyaLogo'

export default function RegisterScreen() {
  const { register } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', password: '', confirm: '',
  })
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleRegister = async () => {
    const { first_name, last_name, email, phone, password, confirm } = form
    if (!first_name || !last_name || !email || !phone || !password) {
      Alert.alert('Error', 'Please fill in all fields'); return
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match'); return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters'); return
    }
    if (!consent) {
      Alert.alert('Consent required', 'Please accept the Privacy Policy and Terms of Service to continue.'); return
    }
    setLoading(true)
    try {
      await register({ first_name, last_name, email: email.trim().toLowerCase(), phone, password, consent: true })
      router.replace('/(tabs)')
    } catch (err: any) {
      Alert.alert('Registration failed', err.response?.data?.message || 'Please try again')
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { k: 'first_name', label: 'First Name', placeholder: 'John', autoCapitalize: 'words' as const },
    { k: 'last_name', label: 'Last Name', placeholder: 'Smith', autoCapitalize: 'words' as const },
    { k: 'email', label: 'Email', placeholder: 'you@example.com', keyboardType: 'email-address' as const, autoCapitalize: 'none' as const },
    { k: 'phone', label: 'Phone', placeholder: '+27 82 000 0000', keyboardType: 'phone-pad' as const },
    { k: 'password', label: 'Password', placeholder: '••••••••', secure: true },
    { k: 'confirm', label: 'Confirm Password', placeholder: '••••••••', secure: true },
  ]

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <VyaIcon size={56} />
          <Text style={styles.brandName}>vya</Text>
          <Text style={styles.tagline}>Create your account</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Get started</Text>
          <Text style={styles.subtitle}>Book your first shuttle in minutes</Text>

          <View style={styles.form}>
            <View style={styles.row}>
              {['first_name', 'last_name'].map(k => (
                <View key={k} style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>{k === 'first_name' ? 'First Name' : 'Last Name'}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={k === 'first_name' ? 'John' : 'Smith'}
                    placeholderTextColor={COLORS.textMuted}
                    value={(form as any)[k]}
                    onChangeText={set(k)}
                    autoCapitalize="words"
                  />
                </View>
              ))}
            </View>

            {fields.slice(2).map(({ k, label, placeholder, keyboardType, autoCapitalize, secure }) => (
              <View key={k} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  value={(form as any)[k]}
                  onChangeText={set(k)}
                  keyboardType={keyboardType}
                  autoCapitalize={autoCapitalize || 'none'}
                  secureTextEntry={secure}
                  autoCorrect={false}
                />
              </View>
            ))}

            {/* POPIA consent */}
            <TouchableOpacity style={styles.consentRow} onPress={() => setConsent(c => !c)} activeOpacity={0.7}>
              <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
                {consent && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.consentText}>
                I agree to Vya&apos;s{' '}
                <Text style={styles.consentLink} onPress={() => Linking.openURL('https://vya-gae.com/privacy-policy')}>Privacy Policy</Text>
                {' '}and{' '}
                <Text style={styles.consentLink} onPress={() => Linking.openURL('https://vya-gae.com/terms')}>Terms of Service</Text>
                . I consent to my personal information being used to facilitate shuttle bookings.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, !consent && { opacity: 0.5 }]} onPress={handleRegister} disabled={loading || !consent}>
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.btnText}>Create Account</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.navy },
  inner: { flexGrow: 1, padding: 24, paddingTop: 60 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  brandName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 38,
    fontWeight: '700',
    color: '#f5f0e6',
    letterSpacing: 6,
    marginTop: 12,
  },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 28 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.navy, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 28 },
  form: { gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 14, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.offWhite,
  },
  btn: {
    backgroundColor: COLORS.navy, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 4,
  },
  btnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: COLORS.textSecondary },
  footerLink: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  checkmark: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  consentText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  consentLink: { color: COLORS.navy, fontWeight: '700', textDecorationLine: 'underline' },
})
