import { AppError } from '../middleware/error.middleware'

export function validateQuotation(data: { items: { quantity: number; unitPrice: number; name: string }[]; discount?: number; tax?: number }) {
  if (!Array.isArray(data.items) || data.items.length === 0 || data.items.some(item =>
    !item || typeof item.name !== 'string' || !item.name.trim() || !Number.isInteger(item.quantity) || item.quantity <= 0 ||
    typeof item.unitPrice !== 'number' || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
    throw new AppError(400, 'Quotation needs named items with positive whole quantities and non-negative prices')
  }
  const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const discount = data.discount ?? 0
  const tax = data.tax ?? 0
  if (!Number.isFinite(subtotal) || typeof discount !== 'number' || !Number.isFinite(discount) || discount < 0 || discount > subtotal ||
      typeof tax !== 'number' || !Number.isFinite(tax) || tax < 0) {
    throw new AppError(400, 'Invalid discount or tax amount')
  }
}
