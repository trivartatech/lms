import { View, Text, StyleSheet } from 'react-native'
import { C } from '../../lib/colors'

// Map each status to a palette slot; the actual hex lives in `C` so a theme
// tweak there flows everywhere. Each entry is a tuple of (bg, text) palette
// keys — keeping it declarative avoids duplicating the color values here.
type Swatch = { bg: string; text: string }

const INFO: Swatch    = { bg: C.infoLight,    text: C.infoText }
const WARN: Swatch    = { bg: C.warningLight, text: C.warningText }
const SUCCESS: Swatch = { bg: C.successLight, text: C.successText }
const ERROR: Swatch   = { bg: C.errorLight,   text: C.errorText }
const PURPLE: Swatch  = { bg: C.purpleLight,  text: C.purpleText }
const ORANGE: Swatch  = { bg: C.orangeLight,  text: C.orangeText }
const NEUTRAL: Swatch = { bg: C.grayLight,    text: C.grayText }

const colorMap: Record<string, Swatch> = {
  // Lead statuses
  NEW:         INFO,
  IN_PROGRESS: WARN,
  CONVERTED:   SUCCESS,
  LOST:        ERROR,
  QUALIFIED:   INFO,
  DEMO:        PURPLE,
  PROPOSAL:    WARN,
  NEGOTIATION: ORANGE,
  CLOSED_WON:  SUCCESS,
  CLOSED_LOST: ERROR,
  // Task / agreement / quotation states
  PENDING:         WARN,
  COMPLETED:       SUCCESS,
  CANCELLED:       ERROR,
  DRAFT:           NEUTRAL,
  SENT:            INFO,
  ACCEPTED:        SUCCESS,
  REJECTED:        ERROR,
  ACTIVE:          SUCCESS,
  EXPIRED:         ERROR,
  PENDING_RENEWAL: WARN,
  // Activity types
  CALL:     INFO,
  MEETING:  PURPLE,
  REMINDER: WARN,
  // Product types
  ERP:   INFO,
  ADDON: PURPLE,
  // Commission payout
  PAID:       SUCCESS,
  FIXED:      NEUTRAL,
  PERCENTAGE: WARN,
  // Roles
  ADMIN:           ERROR,
  SALES_MANAGER:   INFO,
  SALES_EXECUTIVE: SUCCESS,
}

interface Props {
  status: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const colors = colorMap[status] ?? NEUTRAL
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
