
import { describeLeadDuplicates, type LeadDuplicateCheck } from '@lms/shared'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast-store'

export async function confirmLeadEntry(input: object | object[]) {
  try {
    const { data } = await api.post<LeadDuplicateCheck>('/leads/duplicates/check', input)
    if (!data.total) return true
    const action = Array.isArray(input) ? 'Import these leads anyway?' : 'Create this lead anyway?'
    return window.confirm('Possible duplicates:\n' + describeLeadDuplicates(data) + '\n\n' + action)
  } catch {
    toast.error('Duplicate check unavailable. Try again before saving.')
    return false
  }
}
