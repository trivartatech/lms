import { create } from 'zustand'
import type { ToastProps } from '@/components/ui/toast'

export interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: ToastProps['variant']
  duration?: number
}

interface ToastStore {
  toasts: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => string
  dismiss: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

/**
 * Imperative API — usable from non-React code (e.g. mutation onError handlers).
 */
export const toast = {
  show: (params: Omit<ToastItem, 'id'>) => useToastStore.getState().push(params),
  success: (description: string, title = 'Success') =>
    useToastStore.getState().push({ title, description, variant: 'success' }),
  error: (description: string, title = 'Something went wrong') =>
    useToastStore.getState().push({ title, description, variant: 'destructive' }),
  info: (description: string, title?: string) =>
    useToastStore.getState().push({ title, description }),
}
