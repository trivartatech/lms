import { View, TextInput, Pressable, StyleSheet } from 'react-native'
import { Search, X } from 'lucide-react-native'
import { C } from '@/lib/colors'

interface Props {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChangeText, placeholder = 'Search…' }: Props) {
  return (
    <View style={s.container}>
      <Search size={16} color={C.textMuted} style={s.icon} />
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        clearButtonMode="never"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <X size={16} color={C.textMuted} />
        </Pressable>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  icon: { flexShrink: 0 },
  input: { flex: 1, fontSize: 14, color: C.text, padding: 0 },
})
