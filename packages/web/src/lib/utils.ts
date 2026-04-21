import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Build a wa.me link that works regardless of whether the stored phone has a
 * country-code prefix. The old approach (`wa.me/91${digits}`) double-prefixed
 * any number already saved as "+91XXXXXXXXXX", producing wa.me/9191XXXXX...
 * which WhatsApp rejects. We default to India (91) only for bare 10-digit
 * numbers.
 */
export function waLink(phone: string | null | undefined): string {
  if (!phone) return '#'
  const digits = phone.replace(/\D/g, '')
  if (!digits) return '#'
  const full = digits.length === 10 ? '91' + digits : digits
  return `https://wa.me/${full}`
}
