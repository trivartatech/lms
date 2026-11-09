
import { TicketChatButton } from '@/components/support/TicketChatButton'
import { useAuthStore } from '@/store/auth.store'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  SCHOOL_MODULES, SCHOOL_MODULE_LABELS, DOCUMENT_CATEGORIES, WORK_STATUSES,
  SCHOOL_FILE_MAX_BYTES, schoolDirections, matchesSupportQueue, SUPPORT_QUEUE_FILTERS, type SupportQueueFilter,
  type OperationsIndex, type OverdueInstalment, type SchoolFile, type SchoolFileUpload,
  type SchoolModule, type SchoolWork, type WorkUpdate,
} from '@lms/shared'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from '@/lib/toast-store'

const selectClass = 'h-10 rounded-md border bg-background px-3 text-sm'
const panelClass = 'rounded-lg border bg-card p-4 space-y-3'
const errorText = (err: unknown) => (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Unable to save. Please try again.'

async function filePayload(file: File): Promise<SchoolFileUpload> {
  if (file.size > SCHOOL_FILE_MAX_BYTES) throw new Error('File must be no larger than 5 MB')
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  return { name: file.name, mimeType: file.type, base64 }
}

async function download(file: SchoolFile) {
  try {
    const { data } = await api.get<Blob>('/operations/files/' + file.id, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    toast.error('Could not download the file')
  }
}

function FilePicker({ onPick, imagesOnly = false }: { onPick: (file: SchoolFileUpload) => void; imagesOnly?: boolean }) {
  return <Input type="file" accept={imagesOnly ? 'image/jpeg,image/png' : 'application/pdf,image/jpeg,image/png'}
    onChange={async event => {
      const file = event.target.files?.[0]
      if (!file) return
      try { onPick(await filePayload(file)) } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not read the file') }
    }} />
}

function WorkCard({ item, directory, openChat, dismissChat }: {
  item: SchoolWork; directory: OperationsIndex; openChat: boolean; dismissChat: () => void
}) {
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [version, setVersion] = useState(item.updatedAt)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [outcome, setOutcome] = useState(item.outcome ?? '')
  const [status, setStatus] = useState(item.status)
  const [assignedToId, setAssignedToId] = useState(item.assignedTo?.id?.toString() ?? '')
  const [dueAt, setDueAt] = useState('')
  const [followTitle, setFollowTitle] = useState('')
  const [followDate, setFollowDate] = useState('')
  const [photo, setPhoto] = useState<SchoolFileUpload>()
  const userId = useAuthStore(s => s.user?.id)
  const canHandoff = item.kind === 'support' && !!userId && item.assignedTo?.id === userId
  const supportStaff = directory.supportAssignees ?? []
  const assignees = item.kind !== 'support' ? directory.assignees :
    item.assignedTo && !supportStaff.some(person => person.id === item.assignedTo?.id) ? [item.assignedTo, ...supportStaff] : supportStaff
  const refresh = () => { void client.invalidateQueries({ queryKey: ['operations'] }); void client.invalidateQueries({ queryKey: ['tasks'] }); void client.invalidateQueries({ queryKey: ['workspace', 'inbox'] }) }
  const update = useMutation({
    mutationFn: (body: WorkUpdate) => api.patch('/operations/work/' + item.id, body),
    onSuccess: () => { refresh(); setEditing(false) },
    onError: () => { void client.invalidateQueries({ queryKey: ['operations'] }) },
  })
  const upload = useMutation({
    mutationFn: (file: SchoolFileUpload) => api.post('/operations/files', { ...file, schoolId: item.schoolId, workId: item.id }),
    onSuccess: () => { setPhoto(undefined); refresh() },
  })
  if (item.kind === 'collections') return null
  const directions = schoolDirections(item.school)
  const begin = () => {
    setVersion(item.updatedAt)
    setNotes(item.notes ?? '')
    setOutcome(item.outcome ?? '')
    setStatus(item.status)
    setAssignedToId(item.assignedTo?.id?.toString() ?? '')
    const due = item.dueAt ? new Date(item.dueAt) : null
    setDueAt(due ? new Date(due.getTime() - due.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '')
    setEditing(true)
  }
  const save = (event: FormEvent) => {
    event.preventDefault()
    update.mutate({
      expectedUpdatedAt: version, notes, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined, outcome: item.kind === 'visits' ? outcome : undefined,
      status: status === 'CHECKED_IN' ? undefined : status,
      assignedToId: (directory.canAssign || canHandoff) && assignedToId !== String(item.assignedTo?.id ?? '') ? Number(assignedToId) || null : undefined,
      followUp: followTitle.trim() && followDate ? { title: followTitle.trim(), dueAt: new Date(followDate).toISOString() } : undefined,
    })
  }
  return <article className={panelClass}>
    <div className="flex flex-wrap justify-between gap-3">
      <div><h3 className="font-semibold">{item.title}</h3><Link className="text-sm text-primary hover:underline" to={'/workspace?module=timeline&school=' + item.schoolId}>{item.school.name}</Link></div>
      <div className="text-right text-sm"><strong>{item.status.replace(/_/g, ' ')}</strong><div>{item.assignedTo?.name ?? 'Unassigned'}</div></div>
    </div>
    <div className="text-sm text-muted-foreground">
      {item.dueAt && <span>{item.kind === 'support' ? 'Response due ' : 'Scheduled '}{new Date(item.dueAt).toLocaleString()} · </span>}
      {item.supportCategory && <span>{item.supportCategory} · </span>}
      {matchesSupportQueue(item, 'waiting') && <span>Waiting for staff · </span>}
      {matchesSupportQueue(item, 'overdue') && <strong className="text-destructive">Response overdue · </strong>}
      {item.agreementId && <span>Agreement #{item.agreementId} · </span>}
      {item.checkedInAt && <span>Checked in {new Date(item.checkedInAt).toLocaleString()}</span>}
    </div>
    {item.notes && <p className="whitespace-pre-wrap text-sm">{item.notes}</p>}
    {item.outcome && <p className="whitespace-pre-wrap text-sm"><strong>Outcome</strong> {item.outcome}</p>}
    {item.followUpTaskId && <Link className="text-sm text-primary" to="/tasks">Follow-up task #{item.followUpTaskId}</Link>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={begin}>Update</Button>
      {item.kind === 'support' && <TicketChatButton client={api} path={'/operations/work/' + item.id + '/messages'}
        title={item.title} openFromLink={openChat} onDismiss={dismissChat} />}
      {item.kind === 'visits' && directions && <Button size="sm" variant="outline" asChild><a href={directions} target="_blank" rel="noreferrer">Directions</a></Button>}
      {item.kind === 'visits' && item.status === 'PLANNED' && <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ checkIn: true, checkedInAt: new Date().toISOString() })}>Check in</Button>}
    </div>
    {editing && <form onSubmit={save} className="space-y-3 border-t pt-3">
      <label className="block text-sm">Status <select className={selectClass} value={status} onChange={e => setStatus(e.target.value)}>
        {WORK_STATUSES[item.kind].filter(s => s !== 'CHECKED_IN' || item.status === 'CHECKED_IN').map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
      </select></label>
      {(directory.canAssign || canHandoff) && <label className="block text-sm">{directory.canAssign ? 'Assigned to' : 'Hand off to'} <select className={selectClass} value={assignedToId} onChange={e => setAssignedToId(e.target.value)}>
        {directory.canAssign && <option value="">Unassigned</option>}{assignees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>}
      {item.kind !== 'onboarding' && <label className="block text-sm">{item.kind === 'visits' ? 'Scheduled time' : 'Response deadline'}<Input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} required /></label>}
      <label className="block text-sm">{item.kind === 'support' ? 'Internal notes' : 'Notes or blockers'}<Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={4000} /></label>
      {item.kind === 'visits' && <>
        <label className="block text-sm">Visit outcome<Textarea value={outcome} onChange={e => setOutcome(e.target.value)} maxLength={4000} /></label>
        {!item.followUpTaskId && <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Follow-up task (optional)<Input value={followTitle} onChange={e => setFollowTitle(e.target.value)} required={!!followDate} maxLength={180} /></label>
          <label className="text-sm">Follow-up due<Input type="datetime-local" value={followDate} onChange={e => setFollowDate(e.target.value)} required={!!followTitle.trim()} /></label>
        </div>}
      </>}
      <div className="flex gap-2"><Button type="submit" disabled={update.isPending}>Save update</Button><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div>
    </form>}
    {update.isError && <p role="alert" className="text-sm text-destructive">{errorText(update.error)}</p>}
    {item.kind === 'support' && <div className="space-y-2 border-t pt-3">
      {!!item.events.length && <details className="text-sm"><summary>Ticket history</summary>
        {item.events.map(e => <p key={e.id}>{new Date(e.createdAt).toLocaleString()} · {e.status.replace(/_/g, ' ')}{e.notes ? ' · ' + e.notes : ''}</p>)}
      </details>}
      {item.files.map(f => <Button key={f.id} variant="outline" size="sm" onClick={() => download(f)}>{f.name}</Button>)}
      <label className="block text-sm">Attach a photo<FilePicker imagesOnly onPick={setPhoto} /></label>
      {photo && <Button size="sm" disabled={upload.isPending} onClick={() => upload.mutate(photo)}>Upload {photo.name}</Button>}
      {upload.isError && <p role="alert" className="text-sm text-destructive">{errorText(upload.error)}</p>}
    </div>}
  </article>
}

function CollectionCard({ payment }: { payment: OverdueInstalment }) {
  const [outcome, setOutcome] = useState('')
  const [due, setDue] = useState('')
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: () => api.post('/operations/collections/' + payment.id + '/follow-ups', { outcome, dueAt: due ? new Date(due).toISOString() : undefined }),
    onSuccess: () => { setOutcome(''); setDue(''); void client.invalidateQueries({ queryKey: ['operations'] }); void client.invalidateQueries({ queryKey: ['tasks'] }) },
  })
  return <article className={panelClass}>
    <div className="flex justify-between gap-2"><Link className="font-semibold text-primary" to={'/schools/' + payment.school.id}>{payment.school.name}</Link><strong>{formatCurrency(payment.amount)}</strong></div>
    <p className="text-sm">{payment.daysOverdue} days overdue · Due {formatDate(payment.dueDate)} · Agreement #{payment.agreementId}</p>
    {payment.followUps.map(f => <p key={f.id} className="text-sm text-muted-foreground">{formatDate(f.createdAt)} · {f.outcome}{f.dueAt && ' · Next follow-up ' + formatDate(f.dueAt)}</p>)}
    <form className="space-y-2" onSubmit={e => { e.preventDefault(); save.mutate() }}>
      <label className="block text-sm">Follow-up outcome<Textarea value={outcome} onChange={e => setOutcome(e.target.value)} required maxLength={4000} /></label>
      <label className="block text-sm">Next task due (optional)<Input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} /></label>
      <Button size="sm" disabled={save.isPending || !outcome.trim()}>Log follow-up</Button>
      {save.isError && <p role="alert" className="text-sm text-destructive">{errorText(save.error)}</p>}
    </form>
  </article>
}

function CreateForm({ module, directory, selectedSchool }: { module: SchoolModule; directory: OperationsIndex; selectedSchool: string }) {
  const client = useQueryClient()
  const [schoolId, setSchoolId] = useState(selectedSchool)
  const [assignee, setAssignee] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [agreementId, setAgreementId] = useState('')
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0])
  const [file, setFile] = useState<SchoolFileUpload>()
  const agreements = useQuery<{ id: number; startDate: string; endDate: string }[]>({
    queryKey: ['operations', 'agreements', schoolId],
    enabled: module === 'onboarding' && !!schoolId,
    queryFn: () => api.get('/operations/agreements/' + schoolId).then(r => r.data),
  })
  const create = useMutation({
    mutationFn: async () => {
      if (module === 'onboarding') return api.post('/operations/onboarding', { schoolId: Number(schoolId), agreementId: Number(agreementId) })
      if (module === 'documents') return api.post('/operations/files', { ...file, schoolId: Number(schoolId), category })
      return api.post('/operations/work/' + module, {
        schoolId: Number(schoolId), title, notes, dueAt: new Date(dueAt).toISOString(), assignedToId: Number(assignee) || undefined,
      })
    },
    onSuccess: () => {
      setTitle(''); setNotes(''); setDueAt(''); setFile(undefined)
      void client.invalidateQueries({ queryKey: ['operations'] })
      toast.success(module === 'onboarding' ? 'Checklist ready' : 'Saved')
    },
  })
  if (module === 'collections') return null
  const action = module === 'onboarding' ? 'Create checklist' : module === 'documents' ? 'Upload document' : module === 'visits' ? 'Schedule visit' : 'Open ticket'
  return <form className={panelClass} onSubmit={e => { e.preventDefault(); create.mutate() }}>
    <h2 className="font-semibold">{action}</h2>
    <label className="block text-sm">School <select required className={selectClass} value={schoolId} onChange={e => { setSchoolId(e.target.value); setAgreementId('') }}>
      <option value="">Choose school</option>{directory.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>
    {module === 'onboarding' && <label className="block text-sm">Signed agreement <select required className={selectClass} value={agreementId} onChange={e => setAgreementId(e.target.value)}>
      <option value="">{agreements.isLoading && schoolId ? 'Loading…' : 'Choose an active agreement'}</option>
      {agreements.data?.map(a => <option key={a.id} value={a.id}>#{a.id} · {formatDate(a.startDate)} to {formatDate(a.endDate)}</option>)}
    </select></label>}
    {module === 'documents' && <>
      <label className="block text-sm">Category <select className={selectClass} value={category} onChange={e => setCategory(e.target.value)}>
        {DOCUMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
      </select></label>
      <label className="block text-sm">PDF, JPEG or PNG up to 5 MB<FilePicker onPick={setFile} /></label>
      {file && <p className="text-sm">{file.name}</p>}
    </>}
    {(module === 'visits' || module === 'support') && <>
      <label className="block text-sm">Title<Input value={title} onChange={e => setTitle(e.target.value)} required maxLength={180} /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">{module === 'support' ? 'Response deadline' : 'Visit date and time'}<Input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} required /></label>
        {directory.canAssign && <label className="text-sm">Assigned to <select className={selectClass} value={assignee} onChange={e => setAssignee(e.target.value)}>
          <option value="">School owner</option>{(module === 'support' ? directory.supportAssignees ?? [] : directory.assignees).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select></label>}
      </div>
      <label className="block text-sm">Notes<Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={4000} /></label>
    </>}
    <Button disabled={create.isPending || !schoolId || (module === 'documents' && !file) || (module === 'onboarding' && !agreementId)}>{action}</Button>
    {create.isError && <p role="alert" className="text-sm text-destructive">{errorText(create.error)}</p>}
  </form>
}

export function SchoolOperationsPage() {
  const [params, setParams] = useSearchParams()
  const role = useAuthStore(s => s.user?.role)
  const modules = role === 'FINANCE' ? ['collections'] as const : role === 'SUPPORT' ? ['support'] as const : SCHOOL_MODULES
  const module = modules.find(m => m === params.get('module')) ?? modules[0]
  const record = params.get('record')
  const school = params.get('school') ?? ''
  const [assignee, setAssignee] = useState('')
  const [age, setAge] = useState('')
  const [supportFilter, setSupportFilter] = useState<SupportQueueFilter>('all')
  const [showCreate, setShowCreate] = useState(false)
  const directory = useQuery<OperationsIndex>({ queryKey: ['operations', 'index'], queryFn: () => api.get('/operations/index').then(r => r.data) })
  const endpoint = module === 'collections' ? '/collections' : module === 'documents' ? '/files' : '/work/' + module
  const list = useQuery<(SchoolWork | SchoolFile | OverdueInstalment)[]>({
    queryKey: ['operations', module, school, assignee, record],
    refetchInterval: module === 'support' ? 30_000 : false,
    queryFn: () => api.get('/operations' + endpoint, { params: { schoolId: school || undefined, assignedToId: record ? undefined : assignee || undefined } }).then(r => r.data),
  })
  const visible = (list.data ?? []).filter(row => {
    if (record) return String(row.id) === record
    if ('kind' in row && row.kind === 'support') return matchesSupportQueue(row, supportFilter)
    return !('daysOverdue' in row) || !age || (age === '30' ? row.daysOverdue >= 30 : row.daysOverdue < 30)
  })
  const groups = Object.entries(visible.reduce<Record<string, typeof visible>>((all, row) => {
    const group = 'daysOverdue' in row ? (row.school.assignedTo?.name ?? 'Unassigned') + ' · ' + (row.daysOverdue <= 7 ? '1–7 days overdue' : row.daysOverdue <= 30 ? '8–30 days overdue' : '31+ days overdue') : 'Records'
    ;(all[group] ??= []).push(row)
    return all
  }, {}))
  return <div className="mx-auto max-w-5xl space-y-5">
    <h1 className="text-2xl font-bold">School operations</h1>
    <nav aria-label="School modules" className="flex flex-wrap gap-2">{modules.map(m =>
      <Button key={m} variant={module === m ? 'default' : 'outline'} onClick={() => { setParams({ module: m, ...(school ? { school } : {}) }); setShowCreate(false); setAssignee('') }}>{SCHOOL_MODULE_LABELS[m]}</Button>
    )}</nav>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Filter by school" className={selectClass} value={school} onChange={e => setParams({ module, ...(e.target.value ? { school: e.target.value } : {}) })}>
        <option value="">All schools</option>{directory.data?.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {module !== 'documents' && directory.data?.canAssign && <select aria-label="Filter by salesperson" className={selectClass} value={assignee} onChange={e => setAssignee(e.target.value)}>
        <option value="">All assignees</option>{directory.data.assignees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>}
      {module === 'support' && directory.data?.canAssign && !record && <select aria-label="Support queue" className={selectClass}
        value={supportFilter} onChange={e => setSupportFilter(e.target.value as SupportQueueFilter)}>
        {Object.entries(SUPPORT_QUEUE_FILTERS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>}
      {module === 'collections' && <select aria-label="Days overdue" className={selectClass} value={age} onChange={e => setAge(e.target.value)}>
        <option value="">All overdue</option><option value="under30">1–29 days</option><option value="30">30+ days</option>
      </select>}
      {record && <Button variant="outline" onClick={() => setParams({ module, ...(school ? { school } : {}) })}>Show all records</Button>}
      {role !== 'SUPPORT' && module !== 'collections' && <Button onClick={() => setShowCreate(v => !v)}>{showCreate ? 'Hide form' : 'Add ' + ({ visits: 'visit', onboarding: 'checklist', support: 'ticket', documents: 'document' }[module])}</Button>}
    </div>
    {role !== 'SUPPORT' && showCreate && directory.data && <CreateForm key={module + school} module={module} directory={directory.data} selectedSchool={school} />}
    {(list.isLoading || directory.isLoading) && <p>Loading…</p>}
    {(list.isError || directory.isError) && <p role="alert">Could not load school operations. <Button variant="outline" onClick={() => { void list.refetch(); void directory.refetch() }}>Retry</Button></p>}
    {list.isSuccess && !visible.length && <p className="rounded-lg border p-5 text-muted-foreground">{module === 'collections' ? 'No overdue instalments in this view.' : 'No records in this view yet.'}</p>}
    {directory.data && groups.map(([group, records]) => <section key={group} className="space-y-3">
      {module === 'collections' && <h2 className="font-semibold">{group}</h2>}
      {records.map(row => 'daysOverdue' in row ? <CollectionCard key={row.id} payment={row} /> : 'mimeType' in row ?
        <article key={row.id} className={panelClass}><h3 className="font-semibold">{row.name}</h3><p className="text-sm text-muted-foreground">{row.school.name} · {row.category} · {formatDate(row.createdAt)}</p><Button variant="outline" onClick={() => download(row)}>Download</Button></article>
        : <WorkCard key={row.id} item={row} directory={directory.data!} openChat={record === String(row.id) && params.get('chat') === '1'}
          dismissChat={() => {
            if (!params.has('chat')) return
            const next = new URLSearchParams(params)
            next.delete('chat')
            setParams(next, { replace: true })
          }} />)}
    </section>)}
  </div>
}
