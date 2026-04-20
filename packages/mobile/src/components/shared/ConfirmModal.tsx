import { Modal, View, Text, Pressable, StyleSheet } from 'react-native'
import { C } from '@/lib/colors'

interface Props {
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.box}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <View style={s.row}>
            <Pressable style={[s.btn, s.cancel]} onPress={onCancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.btn, s.confirm, destructive && s.destructive]}
              onPress={onConfirm}
            >
              <Text style={s.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8 },
  message: { fontSize: 14, color: C.textSecondary, marginBottom: 20, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancel: { backgroundColor: C.grayLight, borderWidth: 1, borderColor: C.border },
  confirm: { backgroundColor: C.primary },
  destructive: { backgroundColor: C.error },
  cancelText: { fontSize: 14, fontWeight: '600', color: C.text },
  confirmText: { fontSize: 14, fontWeight: '600', color: '#fff' },
})
