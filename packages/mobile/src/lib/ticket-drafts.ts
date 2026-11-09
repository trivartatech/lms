import AsyncStorage from '@react-native-async-storage/async-storage'

export type TicketDraft = { text: string; requestId?: string }
const writes = new Map<string, Promise<void>>()

export async function readTicketDraft(key?: string): Promise<TicketDraft> {
  if (!key) return { text: '' }
  await writes.get(key)?.catch(() => {})
  const value = await AsyncStorage.getItem(key)
  if (!value) return { text: '' }
  const draft = JSON.parse(value) as TicketDraft
  return typeof draft.text === 'string' ? draft : { text: '' }
}

export function saveTicketDraft(key: string | undefined, draft: TicketDraft, onlyIfRequestId?: string): Promise<void> {
  if (!key) return Promise.resolve()
  const write = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    if (onlyIfRequestId) {
      const value = await AsyncStorage.getItem(key)
      if (!value || JSON.parse(value).requestId !== onlyIfRequestId) return
    }
    if (draft.text) await AsyncStorage.setItem(key, JSON.stringify(draft))
    else await AsyncStorage.removeItem(key)
  })
  writes.set(key, write)
  const clear = () => { if (writes.get(key) === write) writes.delete(key) }
  void write.then(clear, clear)
  return write
}
