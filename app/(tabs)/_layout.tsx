import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { Home, Ticket, Bell, User } from 'lucide-react-native'
import { COLORS } from '../../constants'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.navy,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 86 : 66,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 0,
        },
        tabBarActiveBackgroundColor: 'transparent',
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size ?? 22} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'My Trips',
          tabBarIcon: ({ color, size }) => <Ticket color={color} size={size ?? 22} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size ?? 22} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size ?? 22} strokeWidth={2} />,
        }}
      />
    </Tabs>
  )
}
