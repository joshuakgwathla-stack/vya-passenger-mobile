import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from '../lib/auth'
import { useRouter, useSegments } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { COLORS } from '../constants'
import { VyaIcon } from '../components/VyaLogo'
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display'
import AsyncStorage from '@react-native-async-storage/async-storage'

function RootNavigator() {
  const { user, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const [fontsLoaded] = useFonts({ PlayfairDisplay_700Bold })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loading || !fontsLoaded) return

    // Re-read on every segment change so completing onboarding is reflected immediately
    AsyncStorage.getItem('vya_onboarding_seen').then(val => {
      const seen = val === 'true'
      if (!ready) setReady(true)

      const seg = segments[0]
      if (user) {
        // Logged in — redirect away from auth/onboarding screens only
        if (seg === '(auth)' || seg === '(onboarding)') router.replace('/(tabs)')
      } else if (!seen) {
        // First install — show onboarding
        if (seg !== '(onboarding)') router.replace('/(onboarding)')
      } else {
        // Seen onboarding, not logged in — allow guest browsing in tabs
        // Only bounce off the onboarding screen (already completed)
        if (seg === '(onboarding)') router.replace('/(tabs)')
        // (auth) screens are fine — user may be voluntarily signing in
        // (tabs), booking, trip, messages all allowed for guests
      }
    })
  }, [user, loading, fontsLoaded, segments])

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, backgroundColor: COLORS.navy }}>
        <VyaIcon size={80} />
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="booking/[tripId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip/[id]" />
      <Stack.Screen name="messages/[bookingId]" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  )
}
