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
        // Only redirect away from auth/onboarding — allow booking, trip, messages screens
        if (seg === '(auth)' || seg === '(onboarding)') router.replace('/(tabs)')
      } else if (!seen) {
        if (seg !== '(onboarding)') router.replace('/(onboarding)')
      } else {
        if (seg !== '(auth)') router.replace('/(auth)/welcome')
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
