
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { WORKSPACE_MODULES, workspaceModules, type WorkspaceDirectory, type WorkspaceModule, type WorkspacePage as Page } from '@lms/shared'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { WorkspaceView } from '@/components/workspace/WorkspaceView'

export function WorkspacePage() {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const role = useAuthStore(s => s.user?.role)
  const modules = workspaceModules(role)
  const requested = params.get('module') as WorkspaceModule
  const module = modules.includes(requested) ? requested : modules[0]
  const school = params.get('school') ?? ''
  const period = params.get('period') ?? ''
  const record = params.get('record') ?? ''
  const directory = useQuery<WorkspaceDirectory>({ queryKey: ['workspace', 'index'], queryFn: () => api.get('/workspace/index').then(r => r.data) })
  const page = useQuery<Page>({
    queryKey: ['workspace', module, school, period, record],
    queryFn: () => api.get('/workspace/' + module, { params: {
      schoolId: school || undefined, period: period || undefined, recordId: module === 'receipts' && /^\d+$/.test(record) ? record : undefined,
    } }).then(r => r.data),
  })
  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(params)
    next.set('module', module)
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete('record')
    setParams(next)
  }
  const refresh = () => {
    for (const key of ['workspace', 'operations', 'tasks', 'agreements', 'quotations', 'schools', 'activity']) {
      void client.invalidateQueries({ queryKey: [key] })
    }
  }
  return <div className="mx-auto max-w-5xl space-y-4">
    <nav aria-label="Account modules" className="flex flex-wrap gap-2">
      {modules.map(name => <Button key={name} size="sm" variant={module === name ? 'default' : 'outline'}
        onClick={() => setParams({ module: name, ...(school && name !== 'inbox' ? { school } : {}) })}>{WORKSPACE_MODULES[name]}</Button>)}
    </nav>
    <div className="flex flex-wrap items-center gap-3">
      {module !== 'inbox' && module !== 'targets' && <label className="flex items-center gap-2 text-sm">School
        <select className="h-9 max-w-xs rounded-md border bg-background px-3" value={school} onChange={e => setFilter('school', e.target.value)}>
          <option value="">{module === 'portal' || module === 'timeline' ? 'Choose school' : 'All schools'}</option>
          {directory.data?.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>}
      {module === 'targets' && <label className="flex items-center gap-2 text-sm">Month
        <input type="month" className="h-9 rounded-md border bg-background px-3" value={period} onChange={e => setFilter('period', e.target.value)} />
      </label>}
      {record && <Button variant="outline" size="sm" onClick={() => setFilter('record', '')}>Clear record focus</Button>}
    </div>
    {page.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
    {(page.isError || directory.isError) && <Button variant="outline" onClick={() => { void page.refetch(); void directory.refetch() }}>Retry loading</Button>}
    {page.data && <WorkspaceView key={module + school} page={page.data} api={api} record={record} onChange={refresh} />}
  </div>
}
