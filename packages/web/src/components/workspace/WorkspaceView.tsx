
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AxiosInstance } from 'axios'
import type { SchoolFileUpload, WorkspaceAction, WorkspaceField, WorkspacePage } from '@lms/shared'
import { initialWorkspaceFields, workspacePayload, SCHOOL_FILE_MAX_BYTES } from '@lms/shared'
import { TicketChatButton } from '@/components/support/TicketChatButton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/toast-store'

type FieldValue = string | SchoolFileUpload
const message = (error: unknown) => {
  const e = error as { response?: { data?: { message?: string } }; message?: string }
  return e.response?.data?.message ?? e.message ?? 'Please try again'
}

async function readFile(file: File): Promise<SchoolFileUpload> {
  if (file.size > SCHOOL_FILE_MAX_BYTES) throw new Error('The file must be 5 MB or smaller')
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
  return { name: file.name, mimeType: file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg'), base64 }
}

function FormField({ definition, value, set, disabled, onFileBusy }: {
  definition: WorkspaceField; value: FieldValue; set: (v: FieldValue) => void; disabled: boolean; onFileBusy: (busy: boolean) => void
}) {
  const f = definition
  const text = typeof value === 'string' ? value : ''
  return <label className="block space-y-1.5 text-sm font-medium">
    <span>{f.label}{f.required ? ' *' : ''}</span>
    {f.kind === 'select' ? <select required={f.required} disabled={disabled} value={text} onChange={e => set(e.target.value)}
      className="block h-10 w-full rounded-md border bg-background px-3 text-sm">
      {!f.options?.some(o => o.value === '') && <option value="">Choose an option</option>}
      {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select> : f.kind === 'textarea' ? <Textarea value={text} disabled={disabled} required={f.required} maxLength={4000} onChange={e => set(e.target.value)} />
      : f.kind === 'file' ? <>
        <Input type="file" disabled={disabled} required={f.required} accept={f.imagesOnly ? 'image/jpeg,image/png' : 'application/pdf,image/jpeg,image/png'} onChange={e => {
          const selected = e.target.files?.[0]
          if (!selected) { set(''); return }
          onFileBusy(true)
          void readFile(selected).then(set).catch(error => { set(''); toast.error(message(error)) }).finally(() => onFileBusy(false))
        }} />
        {typeof value !== 'string' && <span className="block text-xs text-muted-foreground">{value.name}</span>}
      </> : <Input type={f.kind === 'datetime' ? 'datetime-local' : f.kind} step={f.kind === 'number' ? 'any' : undefined}
        required={f.required} disabled={disabled} value={text} onChange={e => set(e.target.value)} />}
  </label>
}

export function WorkspaceView({ page, api, onChange, record, openTicket, onChatDismiss }: {
  page: WorkspacePage; api: AxiosInstance; onChange: () => void; record?: string; openTicket?: string; onChatDismiss?: () => void
}) {
  const [active, setActive] = useState<WorkspaceAction>()
  const [fields, setFields] = useState<Record<string, FieldValue>>({})
  const [busy, setBusy] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [error, setError] = useState('')
  const [secret, setSecret] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  useEffect(() => {
    if (record) document.getElementById('workspace-record-' + record)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [record, page])

  function begin(action: WorkspaceAction) {
    setError('')
    setFields(initialWorkspaceFields(action))
    setRequestId(action.requestId ? crypto.randomUUID() : '')
    setActive(action)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!active || busy || fileBusy) return
    setError('')
    setBusy(true)
    try {
      const response = await api.request<{ secret?: string; expiresAt?: string; message?: string }>({
        url: active.path, method: active.method ?? 'POST', data: { ...workspacePayload(active, fields), ...(requestId ? { requestId } : {}) }, timeout: 60000,
      })
      setActive(undefined)
      if (response.data.secret) {
        setSecret(response.data.secret)
        setExpiresAt(response.data.expiresAt ?? '')
      } else toast.success(response.data.message ?? 'Saved')
      onChange()
    } catch (e) { setError(message(e)) }
    finally { setBusy(false) }
  }

  async function download(path: string, filename: string) {
    try {
      const { data } = await api.get<Blob>(path, { responseType: 'blob', timeout: 60000 })
      const url = URL.createObjectURL(data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { toast.error('Could not download this file') }
  }

  const portalLink = secret ? window.location.origin + '/portal#access=' + encodeURIComponent(secret) : ''
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">{page.title}</h1><p className="mt-1 text-sm text-muted-foreground">{page.description}</p></div>
    {page.sections.map(section => <section key={section.title} className="space-y-3">
      <h2 className="text-base font-semibold">{section.title}</h2>
      {!section.cards.length && <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">No records here.</p>}
      {section.cards.map(card => <article key={card.id} id={'workspace-record-' + card.id}
        className={'space-y-2 rounded-lg border bg-card p-4 ' + (record === card.id ? 'ring-2 ring-primary' : '')}>
        <div className="flex flex-wrap justify-between gap-2">
          <div><h3 className="font-semibold">{card.title}</h3>{card.subtitle && <p className="text-sm text-muted-foreground">{card.subtitle}</p>}</div>
          {card.badge && <span className="self-start rounded bg-muted px-2 py-1 text-xs font-medium">{card.badge}</span>}
        </div>
        {card.lines?.map((line, index) => <p className="whitespace-pre-wrap text-sm" key={index}>{line}</p>)}
        {card.ticketChatPath && <TicketChatButton client={api} path={card.ticketChatPath} title={card.title}
          openFromLink={!!openTicket && card.id === 'ticket-' + openTicket} onDismiss={onChatDismiss} />}
        {(!!card.links?.length || !!card.actions?.length) && <div className="flex flex-wrap gap-2 pt-1">
          {card.links?.map(link => link.downloadName
            ? <Button key={link.path} size="sm" variant="outline" onClick={() => void download(link.path, link.downloadName!)}>{link.label}</Button>
            : <Button key={link.path} asChild size="sm" variant="outline"><Link to={link.path}>{link.label}</Link></Button>)}
          {card.actions?.map(a => <Button key={a.path + a.label} size="sm" onClick={() => begin(a)}>{a.label}</Button>)}
        </div>}
      </article>)}
    </section>)}
    <Dialog open={!!active} onOpenChange={open => { if (!open && !busy && !fileBusy) setActive(undefined) }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{active?.label}</DialogTitle></DialogHeader>
        {active && <form className="space-y-4" onSubmit={submit}>
          {active.confirm && <p className="text-sm text-muted-foreground">{active.confirm}</p>}
          {active.fields?.map(f => <FormField key={f.name} definition={f} value={fields[f.name] ?? ''} set={v => setFields(prev => ({ ...prev, [f.name]: v }))} disabled={busy || fileBusy} onFileBusy={setFileBusy} />)}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy || fileBusy} onClick={() => setActive(undefined)}>Cancel</Button>
            <Button type="submit" disabled={busy || fileBusy}>{busy ? 'Saving…' : active.label}</Button>
          </div>
        </form>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!secret} onOpenChange={open => { if (!open) setSecret('') }}>
      <DialogContent>
        <DialogHeader><DialogTitle>School contact access</DialogTitle></DialogHeader>
        <p className="text-sm">Copy the code now and share it with the named school contact. It expires {expiresAt ? new Date(expiresAt).toLocaleDateString('en-IN') : 'on the selected date'}.</p>
        <label className="block text-sm">Access code<Input readOnly value={secret} onFocus={e => e.currentTarget.select()} /></label>
        <label className="block text-sm">School portal link<Input readOnly value={portalLink} onFocus={e => e.currentTarget.select()} /></label>
        <Button onClick={() => void navigator.clipboard.writeText(portalLink).then(() => toast.success('Portal link copied')).catch(() => toast.error('Select the link and copy it'))}>Copy portal link</Button>
      </DialogContent>
    </Dialog>
  </div>
}
