import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, CheckCircle2, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Addon, SchoolAddon } from '@lms/shared'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  schoolId?: number
  leadId?: number
}

interface ActivateForm {
  price: string
  startDate: string
}

export function AddOnsTab({ schoolId, leadId }: Props) {
  const queryClient = useQueryClient()

  // Determine endpoint prefix
  const entityPath = schoolId
    ? `/schools/${schoolId}`
    : `/leads/${leadId}`
  const cacheKey = schoolId
    ? ['schools', schoolId, 'addons']
    : ['leads', leadId, 'addons']

  // All catalog add-ons
  const { data: catalog = [] } = useQuery<Addon[]>({
    queryKey: ['addons'],
    queryFn: () => api.get('/addons').then((r) => r.data),
  })

  // This entity's active add-ons
  const { data: activeAddons = [] } = useQuery<SchoolAddon[]>({
    queryKey: cacheKey,
    queryFn: () => api.get(`${entityPath}/addons`).then((r) => r.data),
    enabled: !!(schoolId || leadId),
  })

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [forms, setForms] = useState<Record<number, ActivateForm>>({})

  const activateMutation = useMutation({
    mutationFn: ({ addonId, price, startDate }: { addonId: number; price: number; startDate: string }) =>
      api.post(`${entityPath}/addons`, { addonId, price, startDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKey })
      setExpandedId(null)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (addonId: number) => api.delete(`${entityPath}/addons/${addonId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cacheKey }),
  })

  // Map addonId → SchoolAddon for quick lookup
  const activeMap = new Map<number, SchoolAddon>()
  for (const sa of activeAddons) activeMap.set(sa.addonId, sa)

  function toggleExpand(addon: Addon) {
    if (expandedId === addon.id) { setExpandedId(null); return }
    setForms((prev) => ({
      ...prev,
      [addon.id]: {
        price: String(addon.price),
        startDate: new Date().toISOString().slice(0, 10),
      },
    }))
    setExpandedId(addon.id)
  }

  function handleActivate(addon: Addon) {
    const form = forms[addon.id]
    if (!form) return
    activateMutation.mutate({ addonId: addon.id, price: Number(form.price), startDate: form.startDate })
  }

  const erpItems = catalog.filter((a) => a.category === 'ERP')
  const addonItems = catalog.filter((a) => a.category === 'ADDON')

  if (catalog.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground border rounded-md bg-muted/20">
        No add-ons in catalog yet. Add some in Settings.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-sm">Add-Ons &amp; Services</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {activeMap.size} of {catalog.length} active
        </p>
      </div>

      {[{ label: 'ERP Packages', items: erpItems }, { label: 'Add-Ons', items: addonItems }].map(
        ({ label, items }) =>
          items.length > 0 && (
            <div key={label}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {label}
              </p>
              <div className="space-y-2">
                {items.map((addon) => {
                  const schoolAddon = activeMap.get(addon.id)
                  const isActive = !!schoolAddon
                  const isExpanded = expandedId === addon.id
                  const form = forms[addon.id]

                  return (
                    <div
                      key={addon.id}
                      className={cn(
                        'rounded-lg border transition-all',
                        isActive
                          ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                          : 'border-border bg-background',
                      )}
                    >
                      {/* Main row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div
                          className={cn(
                            'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0',
                            isActive ? 'bg-green-100 dark:bg-green-900' : 'bg-muted',
                          )}
                        >
                          {isActive
                            ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                            : <Package className="h-4 w-4 text-muted-foreground" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{addon.name}</p>
                            {isActive && (
                              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                                Active
                              </Badge>
                            )}
                          </div>
                          {isActive && schoolAddon ? (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(schoolAddon.price)} · Since {formatDate(schoolAddon.startDate)}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Default: {formatCurrency(addon.price)}
                              {addon.description ? ` · ${addon.description}` : ''}
                            </p>
                          )}
                        </div>

                        {isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                            title="Remove add-on"
                            disabled={removeMutation.isPending}
                            onClick={() => removeMutation.mutate(addon.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => toggleExpand(addon)}
                          >
                            {isExpanded
                              ? <><ChevronUp className="h-3.5 w-3.5" /> Cancel</>
                              : <><Plus className="h-3.5 w-3.5" /> Activate</>}
                          </Button>
                        )}
                      </div>

                      {/* Activate form */}
                      {isExpanded && !isActive && form && (
                        <div className="px-4 pb-4 pt-0 border-t bg-muted/30">
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Price (₹)</Label>
                              <Input
                                type="number"
                                value={form.price}
                                onChange={(e) =>
                                  setForms((prev) => ({ ...prev, [addon.id]: { ...prev[addon.id], price: e.target.value } }))
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Start Date</Label>
                              <Input
                                type="date"
                                value={form.startDate}
                                onChange={(e) =>
                                  setForms((prev) => ({ ...prev, [addon.id]: { ...prev[addon.id], startDate: e.target.value } }))
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end mt-3">
                            <Button
                              size="sm"
                              className="h-8"
                              disabled={activateMutation.isPending}
                              onClick={() => handleActivate(addon)}
                            >
                              {activateMutation.isPending ? 'Activating...' : 'Activate'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ),
      )}
    </div>
  )
}
