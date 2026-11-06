export function localDateInput(value: string | Date): string {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function rescheduleTaskDate(original: string, day: string): string {
  const d = new Date(original)
  const [year, month, date] = day.split('-').map(Number)
  d.setFullYear(year, month - 1, date)
  if (!Number.isFinite(d.getTime()) || localDateInput(d) !== day) throw new Error('Invalid due date')
  return d.toISOString()
}

export type TaskView = 'ALL' | 'PENDING' | 'COMPLETED' | 'TODAY' | 'OVERDUE' | 'UPCOMING'
export function matchesTaskView(task: { status: string; dueDate: string }, view: TaskView, now = new Date()): boolean {
  if (view === 'ALL') return true
  if (view === 'PENDING' || view === 'COMPLETED') return task.status === view
  if (task.status !== 'PENDING') return false
  const day = localDateInput(task.dueDate)
  const today = localDateInput(now)
  return view === 'TODAY' ? day === today : view === 'OVERDUE' ? day < today : day > today
}
