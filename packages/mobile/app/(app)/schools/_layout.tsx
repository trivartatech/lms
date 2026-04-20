import { Stack } from 'expo-router'
import { C } from '@/lib/colors'

export default function SchoolsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'School Detail' }} />
    </Stack>
  )
}
