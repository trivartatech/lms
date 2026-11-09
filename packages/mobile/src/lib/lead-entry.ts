
import { Alert } from 'react-native'
import { describeLeadDuplicates, type LeadDuplicateCheck } from '@lms/shared'
import { api } from '@/lib/api'

export async function confirmLeadEntry(input: object | object[]) {
  try {
    const { data } = await api.post<LeadDuplicateCheck>('/leads/duplicates/check', input)
    if (!data.total) return true
    return await new Promise<boolean>(resolve => Alert.alert('Possible duplicates', describeLeadDuplicates(data), [
      { text: 'Review', style: 'cancel', onPress: () => resolve(false) },
      { text: Array.isArray(input) ? 'Import anyway' : 'Create anyway', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }))
  } catch {
    Alert.alert('Duplicate check unavailable', 'Try again before saving.')
    return false
  }
}
