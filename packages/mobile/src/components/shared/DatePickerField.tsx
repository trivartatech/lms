import { useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { Calendar } from 'lucide-react-native'
import { C } from '../../lib/colors'

interface Props {
  /** ISO date string 'YYYY-MM-DD' or '' when empty. */
  value: string
  /** Fires with an ISO 'YYYY-MM-DD' string when the user picks a date. */
  onChange: (iso: string) => void
  placeholder?: string
  disabled?: boolean
  minimumDate?: Date
  maximumDate?: Date
  style?: StyleProp<ViewStyle>
  /** Optional accessibility label. */
  accessibilityLabel?: string
}

/** Parse 'YYYY-MM-DD' → Date at local midnight. Invalid/empty → today. */
function parseIso(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso?.trim() ?? '')
  if (!m) return new Date()
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? new Date() : d
}

/** Format a Date as local 'YYYY-MM-DD' (timezone-safe — no UTC shift). */
function formatIso(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

/** Pretty-print for the trigger button: '15 Jun 2024'. */
function formatDisplay(iso: string): string {
  if (!iso) return ''
  const d = parseIso(iso)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Tappable date field that opens the OS's native calendar picker.
 * Stores/emits plain 'YYYY-MM-DD' so backend contracts stay unchanged.
 *
 * Android: opens the built-in modal calendar immediately on tap.
 * iOS: opens a centered sheet with an inline calendar + Done button.
 */
export function DatePickerField({
  value,
  onChange,
  placeholder = 'Select date',
  disabled,
  minimumDate,
  maximumDate,
  style,
  accessibilityLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  // Keep a scratch Date so iOS spinner edits don't commit on every tick.
  const [draft, setDraft] = useState<Date | null>(null)

  const handleAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Android fires once and closes itself; we must set open=false ourselves.
    setOpen(false)
    if (event.type === 'dismissed') return
    if (selected) onChange(formatIso(selected))
  }

  const handleIosChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) setDraft(selected)
  }

  const commitIos = () => {
    if (draft) onChange(formatIso(draft))
    setDraft(null)
    setOpen(false)
  }

  const cancelIos = () => {
    setDraft(null)
    setOpen(false)
  }

  const display = value ? formatDisplay(value) : placeholder
  const initial = draft ?? parseIso(value)

  return (
    <>
      <Pressable
        style={[styles.trigger, disabled && styles.triggerDisabled, style]}
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text style={[styles.triggerText, !value && styles.placeholder]}>
          {display}
        </Text>
        <Calendar size={16} color={C.textSecondary} />
      </Pressable>

      {/* Android: native dialog — render only while open, no wrapper Modal. */}
      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={parseIso(value)}
          mode="date"
          display="default"
          onChange={handleAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}

      {/* iOS: centered sheet with inline calendar + explicit Done/Cancel. */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={cancelIos}
        >
          <Pressable style={styles.backdrop} onPress={cancelIos}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <DateTimePicker
                value={initial}
                mode="date"
                display="inline"
                onChange={handleIosChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                style={styles.iosPicker}
              />
              <View style={styles.sheetActions}>
                <Pressable onPress={cancelIos} style={styles.sheetBtn} hitSlop={8}>
                  <Text style={styles.sheetBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={commitIos}
                  style={[styles.sheetBtn, styles.sheetBtnPrimary]}
                  hitSlop={8}
                >
                  <Text style={[styles.sheetBtnText, styles.sheetBtnTextPrimary]}>
                    Done
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.surface,
    minHeight: 42,
  },
  triggerDisabled: {
    backgroundColor: C.grayLight,
    opacity: 0.7,
  },
  triggerText: {
    fontSize: 14,
    color: C.text,
    flex: 1,
  },
  placeholder: {
    color: C.textMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
    width: '100%',
    maxWidth: 360,
  },
  iosPicker: {
    alignSelf: 'center',
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  sheetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  sheetBtnPrimary: {
    backgroundColor: C.primary,
  },
  sheetBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textSecondary,
  },
  sheetBtnTextPrimary: {
    color: '#ffffff',
  },
})
