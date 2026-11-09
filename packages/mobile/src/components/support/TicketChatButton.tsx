import { useEffect, useId, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { isAxiosError, type AxiosInstance } from 'axios'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SUPPORT_MESSAGE_MAX_LENGTH, type SupportMessage, type SupportMessagePage } from '@lms/shared'
import { C } from '@/lib/colors'
import { readTicketDraft, saveTicketDraft, type TicketDraft } from '@/lib/ticket-drafts'
import { useAuthStore } from '@/store/auth.store'
import { uuidv4 } from '@/lib/uuid'

function lostAccess(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  return status === 401 || status === 403 || status === 404
}

const requestTimeout = 20_000

type Props = { client: AxiosInstance; path: string; title: string; openFromLink?: boolean; onDismiss?: () => void; draftOwner?: string }

function ChatButton({ title, onPress, secondary, disabled }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[s.button, secondary && s.secondary, disabled && { opacity: 0.5 }]}>
    <Text style={[s.buttonText, secondary && { color: C.primary }]}>{title}</Text>
  </Pressable>
}

export function TicketChatButton({ client, path, title, openFromLink, onDismiss, draftOwner }: Props) {
  const staffId = useAuthStore(s => s.user?.id)
  const owner = draftOwner ?? (staffId ? 'staff-' + staffId : undefined)
  const draftKey = owner ? 'lms:ticket-draft:' + owner + ':' + path : undefined
  const [open, setOpen] = useState(false)
  useEffect(() => { if (openFromLink) setOpen(true) }, [openFromLink])

  function close() {
    setOpen(false)
    onDismiss?.()
  }

  return <>
    <ChatButton title="Ticket chat" secondary onPress={() => setOpen(true)} />
    {open && <Modal animationType="slide" onRequestClose={close}>
      <SafeAreaView style={s.screen}>
        <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.header}>
            <View style={s.heading}>
              <Text style={s.title}>Ticket chat</Text>
              <Text style={s.meta}>{title}</Text>
            </View>
            <ChatButton title="Close" secondary onPress={close} />
          </View>
          <Text style={s.description}>Replies are visible to school contacts and authorized staff.</Text>
          <TicketConversation key={draftKey ?? path} client={client} path={path} draftKey={draftKey} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>}
  </>
}

function TicketConversation({ client, path, draftKey }: Pick<Props, 'client' | 'path'> & { draftKey?: string }) {
  const queryClient = useQueryClient()
  const sessionId = useId()
  const queryKey = ['ticket-chat', path, sessionId]
  const [draft, setDraft] = useState<TicketDraft>({ text: '' })
  const sending = useRef(false)
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    let active = true
    void readTicketDraft(draftKey).then(value => { if (active) setDraft(value) })
      .catch(() => { if (active) setStorageError(true) })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [draftKey])
  const list = useRef<FlatList<SupportMessage>>(null)
  const thread = useInfiniteQuery({
    queryKey,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => client.get<SupportMessagePage>(path, { params: { before: pageParam }, signal, timeout: requestTimeout }).then(r => r.data),
    getNextPageParam: page => page.nextBefore,
    refetchInterval: query => lostAccess(query.state.error) ? false : 8000,
    gcTime: 0,
    retry: false,
    meta: { skipPersist: true },
  })
  const send = useMutation({
    mutationFn: async (message: { text: string; requestId: string }) => {
      try { await saveTicketDraft(draftKey, message) }
      catch { throw new Error('Could not save the reply on this device. Try again.') }
      return client.post(path, message, { timeout: requestTimeout })
    },
    onSuccess: async (_result, sent) => {
      setDraft({ text: '' })
      await saveTicketDraft(draftKey, { text: '' }, sent.requestId).then(() => setStorageError(false), () => setStorageError(true))
      if (path.startsWith('/operations/')) void queryClient.invalidateQueries({ queryKey: ['operations'] })
      await queryClient.invalidateQueries({ queryKey })
      list.current?.scrollToOffset({ offset: 0 })
    },
    onSettled: () => { sending.current = false },
    retry: false,
    networkMode: 'always',
  })
  const accessLost = lostAccess(thread.error)
  const messages = accessLost ? [] : thread.data?.pages.flatMap(page => page.messages) ?? []

  function changeDraft(text: string) {
    const next = { text, requestId: text.trim() === draft.text.trim() ? draft.requestId : undefined }
    setDraft(next)
    if (send.isError) send.reset()
    void saveTicketDraft(draftKey, next).then(() => setStorageError(false), () => setStorageError(true))
  }

  function submit() {
    const text = draft.text.trim()
    if (!ready || !text || sending.current || accessLost) return
    sending.current = true
    const message = { text, requestId: draft.requestId ?? uuidv4() }
    setDraft(message)
    send.mutate(message)
  }

  return <>
    {thread.isPending && <ActivityIndicator color={C.primary} />}
    {thread.isError && <View style={s.problem}>
      <Text accessibilityLiveRegion="polite" style={s.error}>{accessLost ? 'This conversation is no longer available.' : 'Could not load the conversation.'}</Text>
      <ChatButton title="Retry" secondary onPress={() => void thread.refetch()} />
    </View>}
    {thread.isSuccess && !messages.length && <Text style={s.description}>No messages yet. Send the first reply below.</Text>}
    <FlatList ref={list} inverted data={messages} keyExtractor={message => String(message.id)}
      keyboardShouldPersistTaps="handled" contentContainerStyle={s.messages}
      ListFooterComponent={thread.hasNextPage ? <ChatButton title="Load older messages" secondary
        disabled={thread.isFetching} onPress={() => void thread.fetchNextPage()} /> : null}
      renderItem={({ item: message }) => <View style={[s.message, message.mine && s.mine]}>
        <Text style={s.meta}>{message.mine ? 'You' : message.senderName} · {message.senderType === 'SCHOOL' ? 'School' : 'Staff'} · {new Date(message.createdAt).toLocaleString()}</Text>
        <Text selectable style={s.text}>{message.text}</Text>
      </View>} />
    <View style={s.composer}>
      <TextInput accessibilityLabel="Reply to this ticket" placeholder="Reply to this ticket" multiline
        maxLength={SUPPORT_MESSAGE_MAX_LENGTH} value={draft.text} onChangeText={changeDraft} editable={ready && !send.isPending && !accessLost} style={s.input} />
      {storageError && <Text style={s.error}>Draft storage is unavailable on this device.</Text>}
      {!send.isPending && draft.requestId && !send.isError && <Text style={s.meta}>Reply saved for retry.</Text>}
      {send.isError && <Text accessibilityLiveRegion="polite" style={s.error}>
        {isAxiosError(send.error) ? send.error.response?.data?.message ?? 'Reply saved. Retry when you are connected.' : send.error instanceof Error ? send.error.message : 'Could not send. Try again.'}
      </Text>}
      <ChatButton title={send.isPending ? 'Sending…' : draft.requestId ? 'Retry reply' : 'Send reply'} disabled={!ready || !draft.text.trim() || send.isPending || accessLost} onPress={submit} />
    </View>
  </>
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderColor: C.border },
  heading: { flex: 1, gap: 4 }, title: { color: C.text, fontWeight: '700', fontSize: 21 },
  description: { color: C.textSecondary, marginHorizontal: 16, marginVertical: 8, fontSize: 13 },
  meta: { color: C.textSecondary, fontSize: 12 }, text: { color: C.text, fontSize: 15 },
  messages: { padding: 16, gap: 10 },
  message: { alignSelf: 'flex-start', maxWidth: '88%', padding: 10, gap: 4, backgroundColor: C.bg, borderRadius: 8, borderColor: C.border, borderWidth: 1 },
  mine: { alignSelf: 'flex-end', borderColor: C.primary },
  button: { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.primary, backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8 },
  secondary: { backgroundColor: C.surface, borderColor: C.border }, buttonText: { color: '#fff', fontWeight: '600' },
  composer: { borderTopWidth: 1, borderColor: C.border, padding: 12, gap: 8 },
  input: { color: C.text, borderColor: C.border, borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 44, maxHeight: 120, textAlignVertical: 'top' },
  error: { color: C.error, fontSize: 13 }, problem: { gap: 8, paddingHorizontal: 16 },
})
