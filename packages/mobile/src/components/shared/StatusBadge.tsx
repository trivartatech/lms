import { View, Text, StyleSheet } from 'react-native'

const colorMap: Record<string, { bg: string; text: string }> = {
  NEW: { bg: '#dbeafe', text: '#1d4ed8' },
  IN_PROGRESS: { bg: '#fef3c7', text: '#b45309' },
  CONVERTED: { bg: '#dcfce7', text: '#15803d' },
  LOST: { bg: '#fee2e2', text: '#b91c1c' },
  QUALIFIED: { bg: '#dbeafe', text: '#1d4ed8' },
  DEMO: { bg: '#ede9fe', text: '#6d28d9' },
  PROPOSAL: { bg: '#fef3c7', text: '#b45309' },
  NEGOTIATION: { bg: '#ffedd5', text: '#c2410c' },
  CLOSED_WON: { bg: '#dcfce7', text: '#15803d' },
  CLOSED_LOST: { bg: '#fee2e2', text: '#b91c1c' },
  PENDING: { bg: '#fef3c7', text: '#b45309' },
  COMPLETED: { bg: '#dcfce7', text: '#15803d' },
  CANCELLED: { bg: '#fee2e2', text: '#b91c1c' },
  DRAFT: { bg: '#f3f4f6', text: '#374151' },
  SENT: { bg: '#dbeafe', text: '#1d4ed8' },
  ACCEPTED: { bg: '#dcfce7', text: '#15803d' },
  REJECTED: { bg: '#fee2e2', text: '#b91c1c' },
  ACTIVE: { bg: '#dcfce7', text: '#15803d' },
  EXPIRED: { bg: '#fee2e2', text: '#b91c1c' },
  PENDING_RENEWAL: { bg: '#fef3c7', text: '#b45309' },
  CALL: { bg: '#dbeafe', text: '#1d4ed8' },
  MEETING: { bg: '#ede9fe', text: '#6d28d9' },
  REMINDER: { bg: '#fef3c7', text: '#b45309' },
  ERP: { bg: '#dbeafe', text: '#1d4ed8' },
  ADDON: { bg: '#ede9fe', text: '#6d28d9' },
  PAID: { bg: '#dcfce7', text: '#15803d' },
  FIXED: { bg: '#f3f4f6', text: '#374151' },
  PERCENTAGE: { bg: '#fef3c7', text: '#b45309' },
  ADMIN: { bg: '#fee2e2', text: '#b91c1c' },
  SALES_MANAGER: { bg: '#dbeafe', text: '#1d4ed8' },
  SALES_EXECUTIVE: { bg: '#dcfce7', text: '#15803d' },
}

interface Props {
  status: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const colors = colorMap[status] ?? { bg: '#f3f4f6', text: '#374151' }
  const label = status.replace(/_/g, ' ')
  return (
    <View style={[s.badge, { backgroundColor: colors.bg }, size === 'sm' && s.badgeSm]}>
      <Text style={[s.text, { color: colors.text }, size === 'sm' && s.textSm]}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start' },
  badgeSm: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: 12, fontWeight: '600' },
  textSm: { fontSize: 10 },
})
