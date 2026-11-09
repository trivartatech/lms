import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { isAxiosError, type AxiosInstance } from 'axios'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { SUPPORT_MESSAGE_MAX_LENGTH, type SupportMessagePage } from '@lms/shared'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

function lostAccess(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  return status === 401 || status === 403 || status === 404
}

const requestTimeout = 20_000

type Props = { client: AxiosInstance; path: string; title: string; openFromLink?: boolean; onDismiss?: () => void }

export function TicketChatButton({ client, path, title, openFromLink, onDismiss }: Props) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (openFromLink) setOpen(true) }, [openFromLink])

  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
      <MessageSquare className="mr-2 h-4 w-4" /> Ticket chat
    </Button>
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) onDismiss?.() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Ticket chat</DialogTitle>
          <DialogDescription>{title} · Replies are visible to school contacts and authorized staff.</DialogDescription>
        </DialogHeader>
        {open && <TicketConversation client={client} path={path} />}
      </DialogContent>
    </Dialog>
  </>
}

function TicketConversation({ client, path }: Pick<Props, 'client' | 'path'>) {
  const queryClient = useQueryClient()
  const sessionId = useId()
  const queryKey = ['ticket-chat', path, sessionId]
  const [draft, setDraft] = useState('')
  const request = useRef<{ text: string; requestId: string } | undefined>(undefined)
  const scroll = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const thread = useInfiniteQuery({
    queryKey,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => client.get<SupportMessagePage>(path, { params: { before: pageParam }, signal, timeout: requestTimeout }).then(r => r.data),
    getNextPageParam: page => page.nextBefore,
    refetchInterval: query => lostAccess(query.state.error) ? false : 8000,
    gcTime: 0,
    meta: { silent: true },
    retry: false,
  })
  const send = useMutation({
    mutationFn: (message: { text: string; requestId: string }) => client.post(path, message, { timeout: requestTimeout }),
    onSuccess: () => {
      setDraft('')
      request.current = undefined
      atBottom.current = true
      void queryClient.invalidateQueries({ queryKey })
      if (path.startsWith('/operations/')) void queryClient.invalidateQueries({ queryKey: ['operations'] })
    },
    retry: false,
    meta: { silent: true },
  })
  const latest = thread.data?.pages[0]?.messages[0]?.id
  const accessLost = lostAccess(thread.error)
  const messages = accessLost ? [] : thread.data?.pages.flatMap(page => page.messages).reverse() ?? []

  useEffect(() => {
    if (atBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [latest])

  function submit(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || send.isPending || thread.isError || !thread.isSuccess) return
    if (request.current?.text !== text) request.current = { text, requestId: crypto.randomUUID() }
    send.mutate(request.current)
  }

  return <form onSubmit={submit} className="space-y-3">
    <div ref={scroll} className="h-[min(40vh,22rem)] space-y-2 overflow-y-auto rounded-md border p-3"
      onScroll={e => { const area = e.currentTarget; atBottom.current = area.scrollHeight - area.scrollTop - area.clientHeight < 40 }}>
      {thread.hasNextPage && <Button type="button" size="sm" variant="outline" disabled={thread.isFetching}
        onClick={() => { atBottom.current = false; void thread.fetchNextPage() }}>Load older messages</Button>}
      {thread.isPending && <p className="text-sm text-muted-foreground">Loading conversation…</p>}
      {thread.isError && <div className="space-y-2 text-sm">
        <p role="alert">{accessLost ? 'This conversation is no longer available.' : 'Could not load the conversation.'}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void thread.refetch()}>Retry</Button>
      </div>}
      {thread.isSuccess && !messages.length && <p className="text-sm text-muted-foreground">No messages yet. Send the first reply below.</p>}
      {messages.map(message => <article key={message.id}
        className={'w-fit max-w-[90%] rounded-md p-2 ' + (message.mine ? 'ml-auto bg-primary/10' : 'bg-muted')}>
        <p className="text-xs font-medium text-muted-foreground">
          {message.mine ? 'You' : message.senderName} · {message.senderType === 'SCHOOL' ? 'School' : 'Staff'} · {new Date(message.createdAt).toLocaleString()}
        </p>
        <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
      </article>)}
    </div>
    <Textarea aria-label="Reply to this ticket" placeholder="Reply to this ticket" rows={3} maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
      value={draft} onChange={e => setDraft(e.target.value)} disabled={send.isPending} />
    {send.isError && <p role="alert" className="text-sm text-destructive">
      {isAxiosError(send.error) ? send.error.response?.data?.message ?? 'Could not send. Try again.' : 'Could not send. Try again.'}
    </p>}
    <Button type="submit" disabled={!draft.trim() || send.isPending || !thread.isSuccess}>
      {send.isPending ? 'Sending…' : 'Send reply'}
    </Button>
  </form>
}
