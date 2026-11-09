
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import type { WorkspacePage } from '@lms/shared'
import { WorkspaceView } from '@/components/workspace/WorkspaceView'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SchoolPortalPage() {
  const [params, setParams] = useSearchParams()
  const ticket = params.get('ticket') ?? undefined
  const [code, setCode] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('access') ?? '')
  const [token, setToken] = useState(code)
  const [session, setSession] = useState(0)
  const client = useMemo(() => axios.create({ baseURL: '/api', headers: { Authorization: 'Bearer ' + token } }), [token])
  const page = useQuery<WorkspacePage>({
    queryKey: ['school-portal-session', session], enabled: !!token,
    queryFn: () => client.get('/portal').then(r => r.data), retry: false, gcTime: 0, refetchInterval: 30_000,
  })
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])
  function submit(event: FormEvent) {
    event.preventDefault()
    setToken(code.trim())
    setSession(v => v + 1)
  }
  const accessStatus = axios.isAxiosError(page.error) ? page.error.response?.status : undefined
  const signedIn = !!token && !!page.data && accessStatus !== 401 && accessStatus !== 403
  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-5 py-8">
    <div className="flex items-center justify-between gap-3">
      <strong className="text-lg">LMS School Portal</strong>
      {signedIn ? <Button variant="outline" onClick={() => { setToken(''); setCode(''); setSession(v => v + 1); setParams({}) }}>Sign out</Button>
        : <Link className="text-sm text-primary underline" to="/login">Staff sign-in</Link>}
    </div>
    {page.isFetching && !signedIn && <p>Checking school access…</p>}
    {!signedIn && <form onSubmit={submit} className="max-w-lg space-y-3 rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">Enter the access code issued to your school contact.</p>
      <label className="block text-sm font-medium">School access code<Input value={code} onChange={e => setCode(e.target.value)} type="password" autoComplete="off" required /></label>
      {page.isError && <p role="alert" className="text-sm text-destructive">Could not open school access. Check the code or contact your school representative.</p>}
      <Button disabled={page.isFetching || !code.trim()}>Open school portal</Button>
    </form>}
    {signedIn && page.data && <WorkspaceView page={page.data} api={client} onChange={() => void page.refetch()}
      record={ticket ? 'ticket-' + ticket : undefined} openTicket={ticket}
      onChatDismiss={() => { if (ticket) setParams({}, { replace: true }) }} />}
  </main>
}
