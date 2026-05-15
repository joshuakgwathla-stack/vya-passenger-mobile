import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { VyaIcon } from '../../components/VyaLogo'
import { COLORS } from '../../constants'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Brand mark */}
      <View style={styles.brand}>
        <VyaIcon size={72} />
        <Text style={styles.brandName}>vya</Text>
        <Text style={styles.headline}>We'll get you{'\n'}home.</Text>
        <Text style={styles.tagline}>
          Scheduled long-distance shuttles between{'\n'}
          Gauteng and Limpopo — picked up at home.
        </Text>
      </View>

      {/* CTAs */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push('/(auth)/register')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnSecondaryText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            await AsyncStorage.setItem('vya_onboarding_seen', 'true')
            router.replace('/(tabs)')
          }}
          activeOpacity={0.7}
          style={{ paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={styles.browseText}>Browse trips without signing in →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 100,
    paddingBottom: 56,
  },
  brand: {
    alignItems: 'center',
    gap: 16,
  },
  brandName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.textInverse,
    letterSpacing: 6,
    marginTop: 4,
  },
  headline: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.textInverse,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginTop: 16,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(245,240,230,0.5)',
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 4,
  },
  actions: {
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,240,230,0.15)',
  },
  btnSecondaryText: {
    color: 'rgba(245,240,230,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  browseText: {
    color: 'rgba(245,240,230,0.35)',
    fontSize: 13,
    fontWeight: '500',
  },
})
