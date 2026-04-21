import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, LayoutList, Kanban, Search, X, PhoneCall, MessageCircle, Upload, Trash2, UserCheck, GitBranch, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { KanbanBoard } from '@/components/leads/KanbanBoard'
import { LeadFormDialog } from '@/components/leads/LeadFormDialog'
import { TableSkeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/auth.store'
import type { Lead, PaginatedLeads } from '@lms/shared'
import { waLink } from '@/lib/utils'
import { formatDate } from '@/lib/utils'

const PIPELINE_STAGES = ['NEW', 'QUALIFIED', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']

const statusVariant: Record<string, any> = {
  NEW: 'info', IN_PROGRESS: 'warning', CONVERTED: 'success', LOST: 'destructive',
}

const parseCSV = (text: string) => {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

const normalizeLeadRow = (row: Record<string, string>) => {
  const get = (keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase())
      if (found) return row[found]
    }
    return ''
  }
  return {
    schoolName: get(['School Name', 'schoolName']),
    contactPerson: get(['Contact Person', 'contactPerson']),
    phone: get(['Phone', 'phone']),
    email: get(['Email', 'email']),
    location: get(['Location', 'location']),
    notes: get(['Notes', 'notes']),
  }
}

export function LeadsPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'ADMIN'

  const [view, setView] = useState<'list' | 'kanban'>('kanban')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Bulk assign dialog
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [assignToUserId, setAssignToUserId] = useState<string>('')

  // Bulk stage dialog
  const [showStageDialog, setShowStageDialog] = useState(false)
  const [bulkStage, setBulkStage] = useState<string>('')

  // Delete confirm dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // CSV import
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importRows, setImportRows] = useState<Record<string, string>[]>([])
  const [importNormalized, setImportNormalized] = useState<ReturnType<typeof normalizeLeadRow>[]>([])
  const [importStatus, setImportStatus] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery<PaginatedLeads>({
    queryKey: ['leads', search],
    queryFn: () => api.get('/leads', { params: { search: search || undefined, limit: 100 } }).then((r) => r.data),
  })

  const { data: usersData } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
    enabled: showAssignDialog,
  })

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) =>
      api.put(`/leads/${id}`, { pipelineStage: stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  })

  const bulkMutation = useMutation({
    mutationFn: (body: object) => api.post('/leads/bulk', body),
    onSuccess: () => {
      setSelectedIds(new Set())
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setShowAssignDialog(false)
      setShowStageDialog(false)
      setShowDeleteDialog(false)
    },
  })

  const importMutation = useMutation({
    mutationFn: (rows: object[]) => api.post('/leads/import', rows),
    onSuccess: (res) => {
      setImportStatus(`Successfully imported ${res.data.imported} leads.`)
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: () => {
      setImportStatus('Import failed. Please check your file and try again.')
    },
  })

  const leads = data?.data ?? []

  const allSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id))
  const someSelected = selectedIds.size > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)))
    }
  }

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExportCSV = () => {
    const selectedLeads = leads.filter(l => selectedIds.has(l.id))
    const headers = ['School Name', 'Contact Person', 'Phone', 'Email', 'Location', 'Status', 'Pipeline Stage', 'Assigned To', 'Created At']
    const rows = selectedLeads.map(l => [
      l.schoolName ?? '',
      l.contactPerson ?? '',
      l.phone ?? '',
      (l as any).email ?? '',
      (l as any).location ?? '',
      l.status ?? '',
      l.pipelineStage ?? '',
      l.assignedTo?.name ?? '',
      l.createdAt ? new Date(l.createdAt).toISOString() : '',
    ])
    const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('')
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const parsed = parseCSV(text)
      setImportRows(parsed)
      setImportNormalized(parsed.map(normalizeLeadRow))
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    const validRows = importNormalized.filter(r => r.schoolName && r.phone)
    importMutation.mutate(validRows)
  }

  const handleCloseImport = () => {
    setShowImportDialog(false)
    setImportRows([])
    setImportNormalized([])
    setImportStatus('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads & Pipeline</h1>
          <p className="text-muted-foreground text-sm">{data?.total ?? 0} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setView('kanban')}
            >
              <Kanban className="h-3.5 w-3.5" /> Kanban
            </button>
            <button
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setView('list')}
            >
              <LayoutList className="h-3.5 w-3.5" /> List
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Lead
          </Button>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-8"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Floating bulk action bar */}
      {someSelected && view === 'list' && (
        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-md flex-wrap">
          <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { setAssignToUserId(''); setShowAssignDialog(true) }}>
              <UserCheck className="h-3.5 w-3.5 mr-1" /> Assign To
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setBulkStage(''); setShowStageDialog(true) }}>
              <GitBranch className="h-3.5 w-3.5 mr-1" /> Change Stage
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
            {isAdmin && (
              <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : view === 'kanban' ? (
        <KanbanBoard leads={leads} />
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-300 cursor-pointer"
                  />
                </th>
                {['School', 'Contact', 'Phone', 'Status', 'Stage', 'Assigned To', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((lead) => (
                <tr key={lead.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.has(lead.id) ? 'bg-primary/5' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleOne(lead.id)}
                      className="rounded border-gray-300 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                      {lead.schoolName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.contactPerson}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>{lead.phone}</span>
                      <a href={`tel:+91${lead.phone.replace(/\D/g, '')}`} title="Call" className="text-blue-600 hover:opacity-70">
                        <PhoneCall className="h-3.5 w-3.5" />
                      </a>
                      <a href={waLink(lead.phone)} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="text-green-600 hover:opacity-70">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[lead.status]}>{lead.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {lead.status === 'CONVERTED' || lead.status === 'LOST' ? (
                      <span className="text-muted-foreground text-sm">{lead.pipelineStage.replace('_', ' ')}</span>
                    ) : (
                      <Select
                        value={lead.pipelineStage}
                        onValueChange={(stage) => stageMutation.mutate({ id: lead.id, stage })}
                      >
                        <SelectTrigger className="h-7 text-xs w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PIPELINE_STAGES.filter((s) => s !== 'CLOSED_WON' && s !== 'CLOSED_LOST').map((stage) => (
                            <SelectItem key={stage} value={stage} className="text-xs">
                              {stage.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.assignedTo?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(lead.createdAt)}</td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    No leads found. Create your first lead!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selectedIds.size} lead(s) to</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Select value={assignToUserId} onValueChange={setAssignToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {(usersData ?? []).map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button
              disabled={!assignToUserId || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), action: 'assign', assignedToId: parseInt(assignToUserId) })}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Stage Dialog */}
      <Dialog open={showStageDialog} onOpenChange={setShowStageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change stage for {selectedIds.size} lead(s)</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Select value={bulkStage} onValueChange={setBulkStage}>
              <SelectTrigger>
                <SelectValue placeholder="Select a stage..." />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map(stage => (
                  <SelectItem key={stage} value={stage}>{stage.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageDialog(false)}>Cancel</Button>
            <Button
              disabled={!bulkStage || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), action: 'stage', pipelineStage: bulkStage })}
            >
              Update Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} lead(s)?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All selected leads will be permanently deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ ids: Array.from(selectedIds), action: 'delete' })}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={handleCloseImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Leads from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Upload a CSV file with columns: School Name, Contact Person, Phone, Email, Location, Notes.
                Rows missing School Name or Phone will be skipped.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>

            {importNormalized.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Preview ({Math.min(5, importNormalized.length)} of {importNormalized.length} rows):
                </p>
                <div className="rounded border overflow-auto max-h-52">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        {['School Name', 'Contact Person', 'Phone', 'Email', 'Location', 'Notes'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importNormalized.slice(0, 5).map((row, i) => (
                        <tr key={i} className={!row.schoolName || !row.phone ? 'opacity-50' : ''}>
                          <td className="px-3 py-2">{row.schoolName || <span className="text-destructive">missing</span>}</td>
                          <td className="px-3 py-2">{row.contactPerson}</td>
                          <td className="px-3 py-2">{row.phone || <span className="text-destructive">missing</span>}</td>
                          <td className="px-3 py-2">{row.email}</td>
                          <td className="px-3 py-2">{row.location}</td>
                          <td className="px-3 py-2">{row.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {importNormalized.filter(r => r.schoolName && r.phone).length} valid rows will be imported
                  {importNormalized.filter(r => !r.schoolName || !r.phone).length > 0 &&
                    ` (${importNormalized.filter(r => !r.schoolName || !r.phone).length} rows skipped due to missing required fields)`
                  }
                </p>
              </div>
            )}

            {importStatus && (
              <p className={`text-sm font-medium ${importStatus.startsWith('Successfully') ? 'text-green-600' : 'text-destructive'}`}>
                {importStatus}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseImport}>Close</Button>
            {importNormalized.length > 0 && !importStatus.startsWith('Successfully') && (
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending || importNormalized.filter(r => r.schoolName && r.phone).length === 0}
              >
                {importMutation.isPending ? 'Importing...' : `Import ${importNormalized.filter(r => r.schoolName && r.phone).length} leads`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['leads'] })
          setShowForm(false)
        }}
      />
    </div>
  )
}
