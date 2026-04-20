import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Kanban, School as SchoolIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { PaginatedLeads, School as SchoolType } from '@lms/shared'

interface Props {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')
  const [query, setQuery] = useState('')

  // Inline debounce: update `query` 300ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(inputValue.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  // Reset input when the palette is closed
  useEffect(() => {
    if (!open) {
      setInputValue('')
      setQuery('')
    }
  }, [open])

  const enabled = query.length > 1

  const { data: leadsData, isFetching: leadsFetching } = useQuery<PaginatedLeads>({
    queryKey: ['global-search-leads', query],
    queryFn: () =>
      api.get('/leads', { params: { search: query, limit: 8 } }).then((r) => r.data),
    enabled,
    staleTime: 30_000,
  })

  const { data: schoolsData, isFetching: schoolsFetching } = useQuery<{ data: SchoolType[] }>({
    queryKey: ['global-search-schools', query],
    queryFn: () =>
      api.get('/schools', { params: { search: query, limit: 5 } }).then((r) => r.data),
    enabled,
    staleTime: 30_000,
  })

  const leads = leadsData?.data ?? []
  const schools = schoolsData?.data ?? []
  const isLoading = enabled && (leadsFetching || schoolsFetching)
  const hasResults = leads.length > 0 || schools.length > 0
  const showEmpty = enabled && !isLoading && !hasResults

  function handleLeadSelect(id: number) {
    navigate('/leads/' + id)
    onClose()
  }

  function handleSchoolSelect(id: number) {
    navigate('/schools/' + id)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
            placeholder="Search leads, schools..."
          />
          {isLoading && (
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {/* Empty hint when query is too short */}
          {!enabled && (
            <p className="text-center py-8 text-sm text-muted-foreground">
              Type to search leads and schools...
            </p>
          )}

          {/* No results */}
          {showEmpty && (
            <p className="text-center py-8 text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {/* Leads section */}
          {leads.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                Leads
              </p>
              {leads.map((lead) => (
                <button
                  key={lead.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left"
                  onClick={() => handleLeadSelect(lead.id)}
                >
                  <Kanban className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{lead.schoolName}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {lead.status.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Schools section */}
          {schools.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                Schools
              </p>
              {schools.map((school) => (
                <button
                  key={school.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left"
                  onClick={() => handleSchoolSelect(school.id)}
                >
                  <SchoolIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{school.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {school.location ?? school.contactPerson}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
