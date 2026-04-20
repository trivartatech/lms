import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Users, Package, Pencil, Server, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { User, Addon, PricingTier } from '@lms/shared'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'

const DEFAULT_TIERS: PricingTier[] = [
  { label: 'Small (<300 students)',  maxStudents: 299,    price: 75000  },
  { label: 'Medium (300–700)',        maxStudents: 700,    price: 120000 },
  { label: 'Large (701–1500)',        maxStudents: 1500,   price: 175000 },
  { label: 'Enterprise (1500+)',      maxStudents: 999999, price: 300000 },
]

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(6, 'Min 6 characters'),
  confirmPassword: z.string().min(1, 'Required'),
}).refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] })
type PwForm = z.infer<typeof pwSchema>

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE']),
})
type UserForm = z.infer<typeof userSchema>

const productSchema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Must be >= 0'),
})
type ProductForm = z.infer<typeof productSchema>

type EditingAddon = Addon | null

// ─── Tier Editor (inline per ERP product) ────────────────────────────────────
function TierEditor({ addon }: { addon: Addon }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [tiers, setTiers] = useState<PricingTier[]>(() => addon.tiers ?? DEFAULT_TIERS)

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/addons/${addon.id}`, { tiers }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addons'] })
      setOpen(false)
    },
  })

  // Sync when addon prop changes (e.g. after save)
  const handleOpen = () => {
    setTiers(addon.tiers ?? DEFAULT_TIERS)
    setOpen(true)
  }

  return (
    <>
      <button
        className="text-xs text-primary hover:underline flex items-center gap-0.5"
        onClick={handleOpen}
      >
        <span>Pricing Tiers</span>
        {addon.tiers ? (
          <span className="ml-1 text-[10px] text-green-600 font-medium">✓ custom</span>
        ) : (
          <span className="ml-1 text-[10px] text-muted-foreground">(default)</span>
        )}
      </button>

      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pricing Tiers — {addon.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            Set prices per student count range. Auto-suggested in quotation builder.
          </p>
          <div className="space-y-3 pt-1">
            {tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-44 shrink-0">{tier.label}</span>
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs text-muted-foreground shrink-0">₹</span>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    value={tier.price}
                    onChange={(e) => {
                      const updated = tiers.map((t, j) =>
                        j === i ? { ...t, price: parseInt(e.target.value) || 0 } : t
                      )
                      setTiers(updated)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 flex-row justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setTiers(DEFAULT_TIERS)}
            >
              Reset to Defaults
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? 'Saving...' : 'Save Tiers'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [showUserForm, setShowUserForm] = useState(false)
  const [showErpForm, setShowErpForm] = useState(false)
  const [showAddonForm, setShowAddonForm] = useState(false)
  const [editingErp, setEditingErp] = useState<EditingAddon>(null)
  const [editingAddon, setEditingAddon] = useState<EditingAddon>(null)

  const { data: users } = useQuery<User[]>({ queryKey: ['users'], queryFn: () => api.get('/users').then((r) => r.data) })
  const { data: allAddons } = useQuery<Addon[]>({ queryKey: ['addons'], queryFn: () => api.get('/addons').then((r) => r.data) })

  const erpProducts  = allAddons?.filter((a) => a.category === 'ERP')   ?? []
  const addOnServices = allAddons?.filter((a) => a.category !== 'ERP') ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/addons/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addons'] }),
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id?: number; data: ProductForm & { category: string } }) =>
      id ? api.put(`/addons/${id}`, data) : api.post('/addons', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addons'] })
      setShowErpForm(false)
      setShowAddonForm(false)
      setEditingErp(null)
      setEditingAddon(null)
    },
  })

  const [pwSuccess, setPwSuccess] = useState('')
  const [pwError, setPwError] = useState('')

  const userForm  = useForm<UserForm>({ resolver: zodResolver(userSchema), defaultValues: { role: 'SALES_EXECUTIVE' } })
  const erpForm   = useForm<ProductForm>({ resolver: zodResolver(productSchema) })
  const addonForm = useForm<ProductForm>({ resolver: zodResolver(productSchema) })
  const pwForm    = useForm<PwForm>({ resolver: zodResolver(pwSchema) })

  const changePwMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.put('/users/me/password', data),
    onSuccess: () => { setPwSuccess('Password changed successfully'); setPwError(''); pwForm.reset() },
    onError: (err: any) => { setPwError(err?.response?.data?.message ?? 'Failed to change password'); setPwSuccess('') },
  })

  const openErpEdit = (item: Addon) => {
    setEditingErp(item)
    erpForm.reset({ name: item.name, description: item.description ?? '', price: item.price })
    setShowErpForm(true)
  }
  const openAddonEdit = (item: Addon) => {
    setEditingAddon(item)
    addonForm.reset({ name: item.name, description: item.description ?? '', price: item.price })
    setShowAddonForm(true)
  }

  const onAddUser = async (data: UserForm) => {
    await api.post('/users', data)
    queryClient.invalidateQueries({ queryKey: ['users'] })
    userForm.reset()
    setShowUserForm(false)
  }

  const roleVariant: Record<string, any> = { ADMIN: 'destructive', SALES_MANAGER: 'warning', SALES_EXECUTIVE: 'info' }
  const isAdmin = currentUser?.role === 'ADMIN'

  const ProductDialog = ({
    open, onClose, form, category, editing,
  }: {
    open: boolean; onClose: () => void
    form: ReturnType<typeof useForm<ProductForm>>
    category: 'ERP' | 'ADDON'; editing: EditingAddon
  }) => (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); form.reset() } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit' : 'Add'} {category === 'ERP' ? 'ERP Product' : 'Add-On Service'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((data) =>
            saveMutation.mutate({ id: editing?.id, data: { ...data, category } })
          )}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input {...form.register('name')} placeholder={category === 'ERP' ? 'e.g. School ERP Pro' : 'e.g. SMS Alerts'} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input {...form.register('description')} placeholder="Brief description" />
          </div>
          <div className="space-y-1.5">
            <Label>Base Price (₹) *</Label>
            <Input {...form.register('price')} type="number" min={0} placeholder="0" />
            <p className="text-xs text-muted-foreground">Used as fallback when no tier matches.</p>
            {form.formState.errors.price && <p className="text-xs text-destructive">{form.formState.errors.price.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onClose(); form.reset() }}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {editing ? 'Save Changes' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Users</CardTitle>
          {isAdmin && <Button size="sm" onClick={() => setShowUserForm(true)}><Plus className="h-4 w-4 mr-1" /> Add User</Button>}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users?.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Badge variant={roleVariant[u.role]}>{u.role.replace('_', ' ')}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ERP Products — with inline tier pricing */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" /> ERP Products
          </CardTitle>
          <Button size="sm" onClick={() => { setEditingErp(null); erpForm.reset(); setShowErpForm(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Add ERP Product
          </Button>
        </CardHeader>
        <CardContent>
          {erpProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No ERP products defined yet.</p>
          ) : (
            <div className="space-y-2">
              {erpProducts.map((item) => (
                <div key={item.id} className="border rounded-lg overflow-hidden">
                  {/* Product row */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {item.description && (
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        )}
                        <TierEditor addon={item} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{formatCurrency(item.price)}</span>
                      <button className="text-muted-foreground hover:text-foreground" onClick={() => openErpEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      {isAdmin && (
                        <button className="text-destructive hover:opacity-70" onClick={() => deleteMutation.mutate(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tier preview bar */}
                  {item.tiers && (
                    <div className="grid grid-cols-4 border-t bg-muted/30">
                      {item.tiers.map((tier, i) => (
                        <div key={i} className="px-3 py-2 border-r last:border-r-0 text-center">
                          <p className="text-[10px] text-muted-foreground leading-tight">{tier.label}</p>
                          <p className="text-xs font-semibold mt-0.5">{formatCurrency(tier.price)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add-On Services */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" /> Add-On Services
          </CardTitle>
          <Button size="sm" onClick={() => { setEditingAddon(null); addonForm.reset(); setShowAddonForm(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Add Service
          </Button>
        </CardHeader>
        <CardContent>
          {addOnServices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No add-on services defined yet.</p>
          ) : (
            <div className="space-y-2">
              {addOnServices.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{formatCurrency(item.price)}</span>
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => openAddonEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    {isAdmin && (
                      <button className="text-destructive hover:opacity-70" onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showUserForm} onOpenChange={(v) => !v && setShowUserForm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <form onSubmit={userForm.handleSubmit(onAddUser)} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...userForm.register('name')} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...userForm.register('email')} type="email" placeholder="email@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input {...userForm.register('password')} type="password" placeholder="Min 6 chars" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select defaultValue="SALES_EXECUTIVE" onValueChange={(v) => userForm.setValue('role', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SALES_MANAGER">Sales Manager</SelectItem>
                  <SelectItem value="SALES_EXECUTIVE">Sales Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowUserForm(false)}>Cancel</Button>
              <Button type="submit" disabled={userForm.formState.isSubmitting}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ProductDialog open={showErpForm} onClose={() => { setShowErpForm(false); setEditingErp(null) }} form={erpForm} category="ERP" editing={editingErp} />
      <ProductDialog open={showAddonForm} onClose={() => { setShowAddonForm(false); setEditingAddon(null) }} form={addonForm} category="ADDON" editing={editingAddon} />

      {/* Change Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={pwForm.handleSubmit((data) =>
              changePwMutation.mutate({ currentPassword: data.currentPassword, newPassword: data.newPassword })
            )}
            className="space-y-3 max-w-sm"
          >
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input {...pwForm.register('currentPassword')} type="password" placeholder="••••••" />
              {pwForm.formState.errors.currentPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.currentPassword.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input {...pwForm.register('newPassword')} type="password" placeholder="Min 6 chars" />
              {pwForm.formState.errors.newPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.newPassword.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input {...pwForm.register('confirmPassword')} type="password" placeholder="Repeat new password" />
              {pwForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.confirmPassword.message}</p>}
            </div>
            {pwSuccess && <p className="text-sm text-green-600">{pwSuccess}</p>}
            {pwError && <p className="text-sm text-destructive">{pwError}</p>}
            <Button type="submit" size="sm" disabled={changePwMutation.isPending}>
              {changePwMutation.isPending ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
