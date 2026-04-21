import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native'
import { Phone, MessageCircle, Mail } from 'lucide-react-native'
import { C } from '../../lib/colors'

/**
 * Shared contact quick-action buttons (Call / WhatsApp / Email) used anywhere
 * a phone or email shows up on mobile (lead/school detail, list cards, contact
 * rows, referrals). Mirrors the web pattern of PhoneCall + MessageCircle icons
 * next to the number.
 *
 * WhatsApp: try the native `whatsapp://send?phone=<n>` scheme first, fall back
 * to `https://wa.me/<n>` so the OS can route to whatever client is installed
 * (or browser/business app).
 */

/**
 * Strip non-digits and ensure a country-code prefix. WhatsApp requires a full
 * international number — a bare 10-digit Indian number like "9876543210" opens
 * wa.me to an error page. Default to India (91) when we see a 10-digit number
 * with no existing country code.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  // Already has country code (11+ digits, or starts with a known long prefix)
  if (digits.length >= 11) return digits
  if (digits.length === 10) return '91' + digits
  return digits
}

async function openWhatsApp(phone: string) {
  const digits = normalizePhone(phone)
  if (!digits) return
  const native = `whatsapp://send?phone=${digits}`
  try {
    if (await Linking.canOpenURL(native)) {
      await Linking.openURL(native)
      return
    }
  } catch {
    // fall through to web handoff
  }
  Linking.openURL(`https://wa.me/${digits}`).catch(() => {
    Alert.alert('WhatsApp unavailable', `Could not open WhatsApp for ${phone}.`)
  })
}

function openDialer(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() => {
    Alert.alert('Call failed', `Could not dial ${phone}.`)
  })
}

function openMail(address: string) {
  Linking.openURL(`mailto:${address}`).catch(() => {
    Alert.alert('Mail failed', `Could not open ${address}.`)
  })
}

interface Props {
  phone?: string | null
  email?: string | null
  size?: 'sm' | 'md'
  /** When true each button also renders its label. Compact (icon-only) otherwise. */
  showLabels?: boolean
  /** Override gap between buttons. */
  gap?: number
}

export function ContactActions({
  phone,
  email,
  size = 'md',
  showLabels = false,
  gap = 6,
}: Props) {
  const iconSize = size === 'sm' ? 14 : 16
  const btnStyle = [s.btn, size === 'sm' && s.btnSm]

  const buttons: React.ReactNode[] = []

  if (phone) {
    buttons.push(
      <Pressable
        key="call"
        onPress={() => openDialer(phone)}
        hitSlop={12}
        style={[btnStyle, { backgroundColor: C.infoLight }]}
        accessibilityLabel={`Call ${phone}`}
      >
        <Phone size={iconSize} color={C.infoText} />
      </Pressable>,
    )
    buttons.push(
      <Pressable
        key="wa"
        onPress={() => openWhatsApp(phone)}
        hitSlop={12}
        style={[btnStyle, { backgroundColor: C.successLight }]}
        accessibilityLabel={`WhatsApp ${phone}`}
      >
        <MessageCircle size={iconSize} color={C.successText} />
      </Pressable>,
    )
  }

  if (email) {
    buttons.push(
      <Pressable
        key="mail"
        onPress={() => openMail(email)}
        hitSlop={12}
        style={[btnStyle, { backgroundColor: C.purpleLight }]}
        accessibilityLabel={`Email ${email}`}
      >
        <Mail size={iconSize} color={C.purpleText} />
      </Pressable>,
    )
  }

  if (buttons.length === 0) return null

  return (
    <View style={[s.row, { gap }]}>
      {buttons}
    </View>
  )
}

/** Convenience: phone-only variant (no email). Same size/showLabels options. */
export function CallWhatsAppButtons(props: Omit<Props, 'email'>) {
  return <ContactActions {...props} />
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSm: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
})
