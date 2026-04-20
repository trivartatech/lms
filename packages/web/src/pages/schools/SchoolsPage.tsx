import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, X, School, GitBranch, PhoneCall, MessageCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { SchoolFormDialog } from '@/components/schools/SchoolFormDialog'
import type { School as SchoolType } from '@lms/shared'
import { formatDate } from '@/lib/utils'

interface PaginatedSchools { data: SchoolType[]; total: number }

export function SchoolsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery<PaginatedSchools>({
    queryKey: ['schools', search],
    queryFn: () => api.get('/schools', { params: { search: search || undefined } }).then((r) => r.data),
  })

  const schools = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schools</h1>
          <p className="text-muted-foreground text-sm">{data?.total ?? 0} clients</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add School
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search schools..."
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

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading schools...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schools.map((school) => (
            <Link key={school.id} to={`/schools/${school.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <School className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{school.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{school.contactPerson}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{school.phone}</span>
                        <a href={`tel:+91${school.phone.replace(/\D/g, '')}`} title="Call" className="text-blue-600 hover:opacity-70" onClick={(e) => e.stopPropagation()}>
                          <PhoneCall className="h-3 w-3" />
                        </a>
                        <a href={`https://wa.me/91${school.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="text-green-600 hover:opacity-70" onClick={(e) => e.stopPropagation()}>
                          <MessageCircle className="h-3 w-3" />
                        </a>
                      </div>
                      {school.location && <p className="text-xs text-muted-foreground">{school.location}</p>}
                      {school.referredBySchool && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-purple-600">
                          <GitBranch className="h-3 w-3" />
                          <span>Referred by {school.referredBySchool.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Added {formatDate(school.createdAt)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {schools.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground">
              No schools yet. Convert a lead or add manually.
            </div>
          )}
        </div>
      )}

      <SchoolFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['schools'] })
          setShowForm(false)
        }}
      />
    </div>
  )
}
