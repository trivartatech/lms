import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Plus, Phone, PhoneCall, Mail, Pencil, Trash2, Star } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { Contact } from '@lms/shared'

interface Props {
  schoolId?: number
  leadId?: number
}

interface ContactForm {
  name: string
  phone: string
  email: string
  designation: string
  isPrimary: boolean
}

const blank = (): ContactForm => ({ name: '', phone: '', email: '', designation: '', isPrimary: false })

export function ContactsTab({ schoolId, leadId }: Props) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<ContactForm>(blank())

  const queryKey = schoolId ? ['contacts', 'school', schoolId] : ['contacts', 'lead', leadId]
  const endpoint = schoolId ? `/contacts/school/${schoolId}` : `/contacts/lead/${leadId}`

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey,
    queryFn: () => api.get(endpoint).then((r) => r.data),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const createMutation = useMutation({
    mutationFn: (data: ContactForm) =>
      api.post('/contacts', { ...data, schoolId, leadId }),
    onSuccess: () => { invalidate(); closeForm() },
  })

  const updateMutation = useMutation({
    mutationFn: (data: ContactForm) =>
      api.put(`/contacts/${editing!.id}`, data),
    onSuccess: () => { invalidate(); closeForm() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/contacts/${id}`),
    onSuccess: invalidate,
  })

  function openCreate() {
    setEditing(null)
    setForm(blank())
    setShowForm(true)
  }

  function openEdit(c: Contact) {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone, email: c.email ?? '', designation: c.designation ?? '', isPrimary: c.isPrimary })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setForm(blank())
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.phone.trim()) return
    if (editing) {
      updateMutation.mutate(form)
    } else {
      createMutation.mutate(form)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Contacts</h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Contact
        </Button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-md bg-muted/20 text-sm">
          No contacts yet
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm">{c.name}</span>
                      {c.isPrimary && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          <Star className="h-2.5 w-2.5 mr-0.5" />Primary
                        </Badge>
                      )}
                    </div>
                    {c.designation && (
                      <p className="text-xs text-muted-foreground">{c.designation}</p>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />{c.phone}
                      </span>
                      {c.email && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />{c.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={`tel:+91${c.phone.replace(/\D/g, '')}`}
                    title="Call"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                  >
                    <PhoneCall className="h-3.5 w-3.5" /> Call
                  </a>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(c.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(v) => !v && closeForm()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="e.g. Principal, Admin" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                className="rounded"
              />
              Primary contact
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving || !form.name.trim() || !form.phone.trim()}>
              {isSaving ? 'Saving...' : editing ? 'Update' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
