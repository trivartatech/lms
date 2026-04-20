import { View, Text, StyleSheet } from 'react-native'
import { C } from '@/lib/colors'

interface Props {
  icon?: string
  title: string
  subtitle?: string
}

export function EmptyState({ title, subtitle }: Props) {
  return (
    <View style={s.container}>
      <Text style={s.emoji}>📭</Text>
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: C.text, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: C.textSecondary, textAlign: 'center' },
})
