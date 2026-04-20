import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Users } from 'lucide-react'
import { api } from '@/lib/api'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import type { Addon, SchoolAddon } from '@lms/shared'

interface LineItem {
  addonId?: number       // set when picked from catalog
  isCustom?: boolean     // true when user enters a custom name
  name: string
  type: 'ERP' | 'ADDON'
  quantity: number
  unitPrice: number
  useStrength?: boolean  // qty locked to school student count
  tierLabel?: string     // which pricing tier was applied
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  defaultLeadId?: number
  defaultSchoolId?: number
  totalStudents?: number
  defaultAddons?: SchoolAddon[]   // pre-fill from active add-ons (ignored when editing)
  quotation?: import('@lms/shared').Quotation  // when provided → edit mode
}

const blankItem = (): LineItem => ({
  addonId: undefined,
  isCustom: false,
  name: '',
  type: 'ADDON',
  quantity: 1,
  unitPrice: 0,
})

function addonToLineItem(sa: SchoolAddon): LineItem {
  return {
    addonId: sa.addonId,
    isCustom: false,
    name: sa.addon.name,
    type: sa.addon.category as 'ERP' | 'ADDON',
    quantity: 1,
    unitPrice: Number(sa.price),
    useStrength: false,
  }
}

export function QuotationFormDialog({ open, onClose, onSuccess, defaultLeadId, defaultSchoolId, totalStudents, defaultAddons, quotation }: Props) {
  const isEditMode = !!quotation

  const makeInitialItems = (): LineItem[] => {
    if (quotation?.items?.length) {
      return quotation.items.map((item) => ({
        addonId: undefined,
        isCustom: true,
        name: item.name,
        type: item.type,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    }
    return defaultAddons && defaultAddons.length > 0
      ? defaultAddons.map(addonToLineItem)
      : [blankItem()]
  }

  const [items, setItems] = useState<LineItem[]>(makeInitialItems)
  const [discount, setDiscount] = useState(quotation?.discount ?? 0)
  const [tax, setTax] = useState(quotation?.tax ?? 0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [studentCount, setStudentCount] = useState<number | ''>(totalStudents ?? '')

  // Stable key representing which addons are active — changes when addons load or change.
  const addonsKey = defaultAddons?.map((a) => a.addonId).join(',') ?? ''

  // Reset whenever the dialog opens OR when addons arrive after the dialog is already open.
  useEffect(() => {
    if (!open) return
    setItems(makeInitialItems())
    setDiscount(quotation?.discount ?? 0)
    setTax(quotation?.tax ?? 0)
    setStudentCount(totalStudents ?? '')
  }, [open, addonsKey, quotation?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: addons = [] } = useQuery<Addon[]>({
    queryKey: ['addons'],
    queryFn: () => api.get('/addons').then((r) => r.data),
    enabled: open,
  })

  const erpProducts = addons.filter((a) => a.category === 'ERP')
  const addonServices = addons.filter((a) => a.category === 'ADDON')

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  const total = subtotal - discount + tax

  // ── item updaters ────────────────────────────────────────────────────────────

  // Pick the right tier price based on student count
  const resolveTierPrice = (addon: Addon): { price: number; tierLabel?: string } => {
    if (addon.tiers && addon.tiers.length > 0 && studentCount) {
      const tier = addon.tiers.find((t) => (studentCount as number) <= t.maxStudents)
        ?? addon.tiers[addon.tiers.length - 1]
      return { price: tier.price, tierLabel: tier.label }
    }
    return { price: addon.price }
  }

  const selectCatalogItem = (rowIdx: number, addonIdStr: string) => {
    if (addonIdStr === 'custom') {
      setItems((prev) =>
        prev.map((it, i) =>
          i === rowIdx
            ? { ...it, addonId: undefined, isCustom: true, name: '', type: 'ADDON', unitPrice: 0, tierLabel: undefined }
            : it,
        ),
      )
      return
    }
    const addon = addons.find((a) => a.id === parseInt(addonIdStr))
    if (!addon) return
    const { price, tierLabel } = resolveTierPrice(addon)
    setItems((prev) =>
      prev.map((it, i) =>
        i === rowIdx
          ? {
              addonId: addon.id,
              isCustom: false,
              name: addon.name,
              type: addon.category as 'ERP' | 'ADDON',
              quantity: it.quantity,
              unitPrice: price,
              tierLabel,
            }
          : it,
      ),
    )
  }

  const updateItem = <K extends keyof LineItem>(rowIdx: number, field: K, value: LineItem[K]) => {
    setItems((prev) => prev.map((it, i) => (i === rowIdx ? { ...it, [field]: value } : it)))
  }

  const addItem = () => setItems((prev) => [...prev, blankItem()])
  const removeItem = (rowIdx: number) => setItems((prev) => prev.filter((_, i) => i !== rowIdx))

  const applyStudentCountToAll = () => {
    if (!studentCount) return
    const newItems = items.map((it) => ({ ...it, quantity: studentCount as number, useStrength: true }))
    setItems(newItems)
    // Recalculate tax at same rate if tax was already set
    if (tax > 0) {
      const newSubtotal = newItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
      const newTaxable  = newSubtotal - discount
      const rate = subtotal > 0 ? tax / (subtotal - discount) : 0
      setTax(Math.round(newTaxable * rate))
    }
  }

  const switchToCustom = (rowIdx: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === rowIdx ? { ...it, addonId: undefined, isCustom: true } : it,
      ),
    )
  }

  // ── submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (items.some((i) => !i.name.trim() || i.unitPrice <= 0)) return
    setIsSubmitting(true)
    try {
      const payload = {
        discount,
        tax,
        items: items.map(({ name, type, quantity, unitPrice }) => ({ name, type, quantity, unitPrice })),
      }
      if (isEditMode) {
        await api.put(`/quotations/${quotation!.id}`, payload)
      } else {
        await api.post('/quotations', { leadId: defaultLeadId, schoolId: defaultSchoolId, ...payload })
      }
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  // ── select value helper ──────────────────────────────────────────────────────

  const selectValue = (item: LineItem) => {
    if (item.isCustom) return 'custom'
    if (item.addonId) return item.addonId.toString()
    return ''
  }

  const noCatalog = erpProducts.length === 0 && addonServices.length === 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? `Edit Quotation #${quotation!.id}` : 'New Quotation'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Line items table ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Line Items</Label>
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="number"
                    min={1}
                    placeholder="Student count"
                    value={studentCount}
                    onChange={(e) => setStudentCount(e.target.value ? parseInt(e.target.value) : '')}
                    className="h-7 w-32 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                    disabled={!studentCount}
                    onClick={applyStudentCountToAll}
                    title="Set all quantities to student count"
                  >
                    Apply to all
                  </Button>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                </Button>
              </div>
            </div>

            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-64">Product / Service</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">
                      Qty
                      {!!studentCount && (
                        <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                          ({(studentCount as number).toLocaleString()} students)
                        </span>
                      )}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Unit Price (₹)</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, idx) => (
                    <tr key={idx} className="align-middle">

                      {/* Product picker or custom text */}
                      <td className="px-3 py-2">
                        {item.isCustom ? (
                          <Input
                            value={item.name}
                            onChange={(e) => updateItem(idx, 'name', e.target.value)}
                            placeholder="Enter item name..."
                            className="h-8 text-sm"
                            autoFocus
                          />
                        ) : (
                          <Select
                            value={selectValue(item)}
                            onValueChange={(v) => selectCatalogItem(idx, v)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Pick from catalog…" />
                            </SelectTrigger>
                            <SelectContent>
                              {noCatalog ? (
                                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                                  No products in catalog yet.<br />
                                  Add them in Settings.
                                </div>
                              ) : (
                                <>
                                  {erpProducts.length > 0 && (
                                    <SelectGroup>
                                      <SelectLabel>ERP Products</SelectLabel>
                                      {erpProducts.map((p) => {
                                        const { price, tierLabel } = resolveTierPrice(p)
                                        return (
                                          <SelectItem key={p.id} value={p.id.toString()}>
                                            <span>{p.name}</span>
                                            <span className="ml-2 text-muted-foreground text-xs">
                                              {formatCurrency(price)}
                                              {tierLabel && ` (${tierLabel})`}
                                            </span>
                                          </SelectItem>
                                        )
                                      })}
                                    </SelectGroup>
                                  )}
                                  {addonServices.length > 0 && (
                                    <SelectGroup>
                                      <SelectLabel>Add-On Services</SelectLabel>
                                      {addonServices.map((a) => (
                                        <SelectItem key={a.id} value={a.id.toString()}>
                                          <span>{a.name}</span>
                                          <span className="ml-2 text-muted-foreground text-xs">{formatCurrency(a.price)}</span>
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  )}
                                </>
                              )}
                              <Separator className="my-1" />
                              <SelectItem value="custom">
                                <span className="flex items-center gap-1.5">
                                  <Pencil className="h-3 w-3" /> Custom item...
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>

                      {/* Type badge — auto-set from catalog, editable for custom */}
                      <td className="px-3 py-2">
                        <Select
                          value={item.type}
                          onValueChange={(v) => updateItem(idx, 'type', v as 'ERP' | 'ADDON')}
                        >
                          <SelectTrigger className="h-8 text-sm w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ERP">ERP</SelectItem>
                            <SelectItem value="ADDON">Add-On</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Qty + optional student-strength toggle */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => {
                              // If user manually edits, turn off strength lock
                              updateItem(idx, 'useStrength', false)
                              updateItem(idx, 'quantity', parseInt(e.target.value) || 1)
                            }}
                            className={`h-8 text-sm w-16 ${item.useStrength ? 'border-blue-400 bg-blue-50 dark:bg-blue-950' : ''}`}
                            readOnly={item.useStrength}
                          />
                          {!!studentCount && (
                            <button
                              type="button"
                              title={item.useStrength ? 'Using student strength — click to unlock' : `Set qty to student count (${(studentCount as number).toLocaleString()})`}
                              onClick={() => {
                                const next = !item.useStrength
                                setItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx
                                      ? { ...it, useStrength: next, quantity: next ? (studentCount as number) : 1 }
                                      : it,
                                  ),
                                )
                              }}
                              className={`flex-shrink-0 rounded-md p-1 border transition-colors ${
                                item.useStrength
                                  ? 'bg-blue-500 border-blue-500 text-white'
                                  : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-blue-400'
                              }`}
                            >
                              <Users className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Unit price — editable even after catalog pick */}
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) => {
                            updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)
                            updateItem(idx, 'tierLabel', undefined)
                          }}
                          className="h-8 text-sm"
                        />
                        {item.tierLabel && (
                          <p className="text-[10px] text-blue-600 mt-0.5 leading-tight truncate" title={item.tierLabel}>
                            📊 {item.tierLabel}
                          </p>
                        )}
                      </td>

                      {/* Row total */}
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </td>

                      {/* Remove */}
                      <td className="px-3 py-2">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-destructive hover:opacity-70"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Summary ── */}
          <div className="flex justify-end">
            <div className="space-y-2 min-w-52">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm gap-4">
                <span className="text-muted-foreground">Discount (₹)</span>
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="h-7 w-28 text-sm text-right"
                />
              </div>
              <div className="flex items-center justify-between text-sm gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">GST / Tax (₹)</span>
                  <button
                    type="button"
                    title="Apply GST 18%"
                    onClick={() => setTax(Math.round((subtotal - discount) * 0.18))}
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-orange-300 text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    GST 18%
                  </button>
                  {tax > 0 && (
                    <button
                      type="button"
                      onClick={() => setTax(0)}
                      className="text-[10px] text-muted-foreground hover:text-destructive"
                      title="Clear tax"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  min={0}
                  value={tax}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                  className="h-7 w-28 text-sm text-right"
                />
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || items.some((i) => !i.name.trim() || i.unitPrice <= 0)}
          >
            {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Quotation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
