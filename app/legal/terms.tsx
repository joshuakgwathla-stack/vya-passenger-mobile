import { ScrollView, View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants'

const LAST_UPDATED = '23 June 2026'
const CONTACT_EMAIL = 'legal@vya-gae.com'

const sections = [
  {
    heading: '1. Acceptance of Terms',
    body: `By creating an account or using Vya, you agree to these Terms of Service. If you do not agree, do not use the Service.\n\nVya is operated by Vya (Pty) Ltd. We may update these Terms and will notify you of material changes by email or in-app notice.`,
  },
  {
    heading: '2. Eligibility',
    body: `You must be at least 18 years old to use Vya. Bookings for minors may be made by a parent or guardian who accepts full responsibility.\n\nYou may only hold one account. Creating duplicate accounts to circumvent suspensions is grounds for permanent ban.`,
  },
  {
    heading: '3. Your Account',
    body: `You are responsible for keeping your credentials confidential. Notify us at ${CONTACT_EMAIL} immediately if you suspect unauthorised access.\n\nYou agree to provide accurate, current information and keep your profile up to date.`,
  },
  {
    heading: '4. Booking & Cancellation',
    body: `Making a booking: Select a trip, choose seats, provide pickup/drop-off addresses, and pay the displayed fare. Booking is confirmed once payment is received.\n\nCancellation by passenger: Refund eligibility depends on the cancellation policy at time of booking. Cancellations less than 4 hours before departure are generally non-refundable.\n\nCancellation by driver: If a driver cancels, all affected passengers are notified and receive a full refund within 3–5 business days.\n\nNo-show: If you are not at the pickup point within 15 minutes of departure without prior notice, the driver may leave and no refund will be issued.\n\nUnpaid bookings: Unpaid bookings are automatically cancelled after 30 minutes.`,
  },
  {
    heading: '5. Payments',
    body: `All fares are in South African Rand (ZAR). Payments are processed by a third-party payment gateway — Vya does not store card details.\n\nPrices shown at checkout are final. Dynamic pricing may vary by demand and timing but will not change after confirmation.\n\nFor billing errors, contact ${CONTACT_EMAIL} within 7 days.`,
  },
  {
    heading: '6. Passenger Conduct',
    body: `You agree to:\n\n• Be ready on time at your confirmed pickup address\n• Treat drivers and other passengers respectfully\n• Not carry illegal substances, unlicensed firearms, or hazardous materials\n• Wear a seatbelt at all times (required by South African law)\n• Rate your trip after completion\n\nAbusive or threatening behaviour is grounds for immediate account termination.`,
  },
  {
    heading: '7. Safety',
    body: `Vya provides an in-app SOS button on active trip screens. Use it only in genuine emergencies — it shares your trip details with emergency services.\n\nBefore boarding, confirm the vehicle registration matches your booking. Report any safety concerns to ${CONTACT_EMAIL} immediately.`,
  },
  {
    heading: '8. Driver Terms',
    body: `Drivers additionally agree to:\n\n• Hold a valid South African driver's licence for the vehicle class operated\n• Keep all vehicle documents (registration, roadworthy, licence disk) current\n• Not accept walk-in passengers on Vya-booked trips\n• Honour claimed queue slots; repeated no-shows result in suspension\n• Cancel at least 4 hours before departure if unable to operate\n• Consent to background and document verification checks\n\nEarnings are paid by EFT approximately 1 hour before scheduled departure, less the Queue Marshall Fee.`,
  },
  {
    heading: '9. Limitation of Liability',
    body: `Vya is a booking platform, not a transport operator. To the maximum extent permitted by South African law, Vya is not liable for loss, injury, or damage arising from a trip booked through the platform.\n\nVya's total liability for any claim shall not exceed the fare paid for the trip in question.\n\nNothing excludes liability for death or personal injury caused by Vya's own negligence, or liability that cannot be excluded under the Consumer Protection Act 68 of 2008.`,
  },
  {
    heading: '10. Disputes',
    body: `Contact us at ${CONTACT_EMAIL} for disputes. We will investigate within 5 business days.\n\nThese Terms are governed by South African law. Unresolved consumer disputes may be referred to the National Consumer Commission at ncc.gov.za.`,
  },
  {
    heading: '11. Termination',
    body: `You may delete your account at any time from Profile → Privacy & Data. We may suspend or terminate access immediately for Terms violations or fraudulent activity.\n\nPending bookings on termination will be cancelled and refunded where applicable.`,
  },
  {
    heading: '12. Contact',
    body: `Email: ${CONTACT_EMAIL}\nWebsite: vya-gae.com\n\nFor privacy matters, see our Privacy Policy at vya-gae.com/privacy-policy.`,
  },
]

export default function TermsScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>LEGAL</Text>
          <Text style={styles.heroTitle}>Terms of Service</Text>
          <Text style={styles.heroMeta}>Last updated: {LAST_UPDATED} · Version 1.0</Text>
        </View>

        {/* Intro card */}
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            These Terms govern your use of the Vya shuttle booking platform.{' '}
            <Text style={styles.bold}>By using Vya you agree to these terms.</Text>{' '}
            If something is unclear, contact us at {CONTACT_EMAIL}.
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
          <Text style={styles.footerText}>Questions about these terms?</Text>
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
