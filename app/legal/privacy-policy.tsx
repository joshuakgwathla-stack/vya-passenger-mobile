import { ScrollView, View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants'

const LAST_UPDATED = '23 June 2026'
const CONTACT_EMAIL = 'privacy@vya-gae.com'

const sections = [
  {
    heading: '1. Who We Are',
    body: `Vya is a long-distance shuttle booking platform operated by Vya (Pty) Ltd. We connect passengers with vetted drivers for scheduled door-to-door shuttles between Gauteng and Limpopo.\n\nWe are the Responsible Party for your personal information under the Protection of Personal Information Act 4 of 2013 (POPIA). Contact our Information Officer at ${CONTACT_EMAIL}.`,
  },
  {
    heading: '2. Information We Collect',
    body: `• Account info — name, email, phone number, password (hashed)\n• Booking info — pickup/drop-off addresses, travel dates, payment status\n• Driver info (drivers only) — ID, licence, vehicle registration, bank details, profile photo\n• Usage info — IP address, device type, page interactions\n• Location — shared by the driver during active trips only\n\nWe do not collect race, religion, health, biometric, or other special category information.`,
  },
  {
    heading: '3. Why We Collect Your Information',
    body: `• To provide our service — accounts, bookings, driver matching, confirmations\n• To process payments — required booking details passed to our payment processor\n• To pay drivers — EFT payouts using bank details on file\n• To communicate — OTP codes, booking confirmations, status updates via SMS and email\n• Safety — driver document verification, SOS incident logging\n• Legal compliance — records required by South African tax law\n\nLegal basis: your explicit consent at registration (POPIA s.11(1)(a)) and performance of our contract (s.11(1)(b)).`,
  },
  {
    heading: '4. How Long We Keep Your Information',
    body: `We retain your data while your account is active. On account deletion, personal details are anonymised within 30 days. Booking transaction records are retained for 5 years as required by SARS. Driver compliance documents are kept for 3 years after the relationship ends.`,
  },
  {
    heading: '5. Who We Share Your Information With',
    body: `We do not sell your personal information. We share it only where necessary:\n\n• Drivers — your first name, phone, and pickup address for your confirmed trip\n• Passengers (drivers only) — first names and pickup locations for their trips\n• Payment processors — Paystack, for transaction processing\n• SMS providers — Africa's Talking, for OTP codes and notifications\n• Cloud infrastructure — Railway (API/database) and Vercel (web app)\n• Legal authorities — only when required by court order or law`,
  },
  {
    heading: '6. How We Protect Your Information',
    body: `• Passwords hashed with bcrypt — never stored in plain text\n• All data in transit encrypted via TLS/HTTPS\n• Database access restricted via SSL\n• Access tokens expire after 15 minutes; refresh tokens after 7 days\n• Role-based access control limits data visibility\n• Driver documents stored in restricted Cloudinary environment`,
  },
  {
    heading: '7. Your Rights Under POPIA',
    body: `• Right to access — download all your data from Profile → Privacy & Data\n• Right to correction — update your details in Profile, or contact us\n• Right to erasure — delete your account from Profile → Privacy & Data\n• Right to object — unsubscribe from marketing at any time\n• Right to complain — lodge a complaint with the Information Regulator of South Africa at inforegulator.org.za`,
  },
  {
    heading: '8. Children',
    body: `Vya is not intended for persons under 18. We do not knowingly collect information from minors. If you believe a minor has registered, contact us at ${CONTACT_EMAIL}.`,
  },
  {
    heading: '9. Changes to This Policy',
    body: `We may update this policy and will notify you of material changes by email or in-app notice. The current version is always at vya-gae.com/privacy-policy.`,
  },
  {
    heading: '10. Contact Us',
    body: `Email: ${CONTACT_EMAIL}\nWebsite: vya-gae.com\n\nWe aim to respond within 5 business days.`,
  },
]

export default function PrivacyPolicyScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>LEGAL</Text>
          <Text style={styles.heroTitle}>Privacy Policy</Text>
          <Text style={styles.heroMeta}>Last updated: {LAST_UPDATED} · Version 1.0</Text>
        </View>

        {/* Intro card */}
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            Vya is committed to protecting your privacy in accordance with the{' '}
            <Text style={styles.bold}>Protection of Personal Information Act 4 of 2013 (POPIA)</Text>.
            This policy explains what personal information we collect, why we collect it, and what rights you have.
          </Text>
        </View>

        {/* Sections */}
        {sections.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionHeading}>{s.heading}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Questions about your data?</Text>
          <Text style={styles.footerEmail}>{CONTACT_EMAIL}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.navy,
    paddingTop: Platform.OS === 'android' ? 44 : 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { width: 60 },
  backText: { color: COLORS.goldLight, fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textInverse },
  scroll: { paddingBottom: 60 },
  hero: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  heroLabel: { fontSize: 10, letterSpacing: 2, color: COLORS.goldLight, marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: '700', color: COLORS.textInverse, marginBottom: 8 },
  heroMeta: { fontSize: 12, color: COLORS.textMuted },
  introCard: {
    margin: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  introText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  bold: { fontWeight: '700', color: COLORS.text },
  section: {
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionBody: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  footer: {
    margin: 16,
    marginTop: 24,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  footerText: { fontSize: 14, color: COLORS.textMuted },
  footerEmail: { fontSize: 15, fontWeight: '700', color: COLORS.goldLight },
})
