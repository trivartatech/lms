import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { C } from '@/lib/colors'

interface Props {
  /** Override the screen-reader announcement. Defaults to "Loading". */
  label?: string
}

export function LoadingSpinner({ label = 'Loading' }: Props = {}) {
  return (
    <View style={s.container} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={C.primary} accessibilityLabel={label} />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
})
