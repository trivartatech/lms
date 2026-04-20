export interface Contact {
  id: number
  name: string
  phone: string
  email?: string
  designation?: string
  isPrimary: boolean
  schoolId?: number
  leadId?: number
  createdAt: string
  updatedAt: string
}
