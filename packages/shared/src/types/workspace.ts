import type { SchoolFileUpload } from './school-operations'


export const WORKSPACE_MODULES = {
  renewals: 'Renewal desk', portal: 'School portal', orders: 'Orders & activation',
  receipts: 'Receipts & reconciliation', targets: 'Sales targets & territories',
  timeline: 'School timeline', inbox: 'Notification inbox',
} as const
export type WorkspaceModule = keyof typeof WORKSPACE_MODULES

export function workspaceModules(role?: string): WorkspaceModule[] {
  if (role === 'FINANCE') return ['receipts', 'inbox']
  if (role === 'SUPPORT') return ['timeline', 'inbox']
  return ['renewals', 'portal', 'orders', 'receipts', 'targets', 'timeline', 'inbox']
}

export interface WorkspaceField {
  name: string
  label: string
  kind: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'file'
  required?: boolean
  imagesOnly?: boolean
  value?: string
  options?: { value: string; label: string }[]
}

export interface WorkspaceAction {
  label: string
  path: string
  method?: 'POST' | 'PATCH' | 'DELETE'
  fields?: WorkspaceField[]
  confirm?: string
  requestId?: boolean
}

export interface WorkspaceLink {
  label: string
  path: string
  downloadName?: string
}

export interface WorkspaceCard {
  id: string
  title: string
  subtitle?: string
  lines?: string[]
  badge?: string
  actions?: WorkspaceAction[]
  links?: WorkspaceLink[]
  ticketChatPath?: string
}

export interface WorkspacePage {
  title: string
  description: string
  draftOwner?: string
  sections: { title: string; cards: WorkspaceCard[] }[]
}

export interface WorkspaceDirectory {
  schools: { id: number; name: string }[]
  modules: WorkspaceModule[]
}

export function initialWorkspaceFields(action: WorkspaceAction): Record<string, string> {
  return Object.fromEntries((action.fields ?? []).map(field => {
    const value = field.value ?? ''
    if (field.kind !== 'datetime' || !value) return [field.name, value]
    const date = new Date(value)
    return [field.name, new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)]
  }))
}

export function workspacePayload(action: WorkspaceAction, values: Record<string, string | SchoolFileUpload>) {
  const body: Record<string, string | SchoolFileUpload | null> = {}
  for (const field of action.fields ?? []) {
    const value = values[field.name]
    if (typeof value === 'object') { body[field.name] = value; continue }
    const text = value?.trim()
    if (!text) {
      if (field.required) throw new Error(field.label + ' is required')
      if (field.name === 'ownerId') body.ownerId = null
      continue
    }
    body[field.name] = field.kind === 'datetime' ? new Date(text).toISOString() : text
  }
  return body
}
