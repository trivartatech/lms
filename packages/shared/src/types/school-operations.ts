
export const SCHOOL_MODULES = ['visits', 'onboarding', 'support', 'documents', 'collections'] as const
export type SchoolModule = typeof SCHOOL_MODULES[number]
export const SCHOOL_MODULE_LABELS: Record<SchoolModule, string> = {
  visits: 'School visits', onboarding: 'Onboarding', support: 'Support tickets',
  documents: 'Documents', collections: 'Collections',
}
export const DOCUMENT_CATEGORIES = ['Signed agreement', 'Purchase order', 'Payment receipt', 'Other'] as const
export const WORK_STATUSES = {
  visits: ['PLANNED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED'],
  onboarding: ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'],
  support: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
} as const

export const SUPPORT_CATEGORIES = ['Access & login', 'Setup & training', 'Product issue', 'Billing', 'Other'] as const
export const SUPPORT_QUEUE_FILTERS = { all: 'All tickets', unassigned: 'Unassigned', waiting: 'Waiting for staff', overdue: 'Overdue' } as const
export type SupportQueueFilter = keyof typeof SUPPORT_QUEUE_FILTERS

export function matchesSupportQueue(ticket: SchoolWork, filter: SupportQueueFilter, now = Date.now()) {
  if (filter === 'all') return true
  if (ticket.kind !== 'support' || !['OPEN', 'IN_PROGRESS'].includes(ticket.status)) return false
  if (filter === 'unassigned') return !ticket.assignedTo
  if (filter === 'waiting') return ticket.waitingForStaff === true
  return !!ticket.dueAt && Date.parse(ticket.dueAt) < now && ticket.waitingForStaff !== false
}

export const SUPPORT_MESSAGE_MAX_LENGTH = 4000

export interface SupportMessage {
  id: number
  senderType: 'STAFF' | 'SCHOOL'
  senderName: string
  text: string
  createdAt: string
  mine: boolean
}

export interface SupportMessagePage {
  messages: SupportMessage[]
  nextBefore: number | null
}

export interface OperationsSchool {
  id: number
  name: string
  location: string | null
  latitude: number | null
  longitude: number | null
  assignedTo: { id: number; name: string } | null
}

export interface SchoolWork {
  id: number
  schoolId: number
  school: OperationsSchool
  kind: 'visits' | 'onboarding' | 'support' | 'collections'
  status: string
  title: string
  notes: string | null
  outcome: string | null
  supportCategory?: string | null
  waitingForStaff?: boolean
  dueAt: string | null
  checkedInAt: string | null
  assignedTo: { id: number; name: string } | null
  agreementId: number | null
  paymentId: number | null
  followUpTaskId: number | null
  createdAt: string
  updatedAt: string
  files: SchoolFile[]
  events: { id: number; status: string; notes: string | null; createdAt: string }[]
}

export interface SchoolFile {
  id: number
  schoolId: number
  workId: number | null
  school: OperationsSchool
  name: string
  category: string
  mimeType: string
  size: number
  createdAt: string
}

export interface OverdueInstalment {
  id: number
  agreementId: number
  amount: number
  dueDate: string
  daysOverdue: number
  school: OperationsSchool
  followUps: SchoolWork[]
}

export interface OperationsIndex {
  schools: OperationsSchool[]
  assignees: { id: number; name: string }[]
  canAssign: boolean
  supportAssignees?: { id: number; name: string }[]
}

export interface WorkUpdate {
  expectedUpdatedAt?: string
  status?: string
  notes?: string
  outcome?: string
  dueAt?: string | null
  assignedToId?: number | null
  checkIn?: boolean
  checkedInAt?: string
  latitude?: number
  longitude?: number
  followUp?: { title: string; dueAt: string }
}

export interface SchoolFileUpload {
  name: string
  mimeType: string
  base64: string
}

export const SCHOOL_FILE_MAX_BYTES = 5 * 1024 * 1024

export function schoolDirections(school: Pick<OperationsSchool, 'latitude' | 'longitude' | 'location' | 'name'>) {
  const query = school.latitude != null && school.longitude != null
    ? `${school.latitude},${school.longitude}`
    : school.location?.trim() ? school.name + ', ' + school.location.trim() : null
  return query ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query) : null
}
