import { useState } from 'react'
import { View, Text, Pressable, Modal, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { C } from '@/lib/colors'

export function TimePickerField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const date = new Date()
  const [hour, minute] = value.split(':').map(Number)
  date.setHours(hour, minute, 0, 0)
  const picker = <DateTimePicker mode="time" value={date} is24Hour display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, selected) => {
    if (Platform.OS !== 'ios') setOpen(false)
    if (selected) onChange(`${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`)
  }} />
  return <View>
    <Text style={{ color: C.textSecondary, marginBottom: 8 }}>Time (local)</Text>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ padding: 12, borderWidth: 1, borderColor: C.border, borderRadius: 8 }}><Text>{value}</Text></Pressable>
    {open && (Platform.OS === 'ios' ? <Modal transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0005' }}><View style={{ backgroundColor: '#fff', padding: 24 }}>{picker}<Pressable onPress={() => setOpen(false)}><Text style={{ color: C.primary }}>Done</Text></Pressable></View></View></Modal> : picker)}
  </View>
}
