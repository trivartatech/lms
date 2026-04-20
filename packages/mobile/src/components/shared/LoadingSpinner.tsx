import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { C } from '@/lib/colors'

export function LoadingSpinner() {
  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
})
