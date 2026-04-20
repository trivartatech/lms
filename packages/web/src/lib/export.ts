/**
 * CSV export helpers. Excel opens these natively; we include a BOM so that
 * UTF-8 non-ASCII characters render correctly in Excel.
 */

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
): string {
  const header = columns.map((c) => cell(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => cell(row[c.key])).join(',')).join('\n')
  return `${header}\n${body}`
}

/** Trigger a download of arbitrary string content as a file. */
export function downloadFile(content: string, filename: string, mime = 'text/csv;charset=utf-8') {
  // BOM so Excel detects UTF-8 in CSVs.
  const blob = new Blob([mime.startsWith('text/csv') ? '\ufeff' + content : content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function exportRowsAsCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
) {
  downloadFile(toCSV(rows, columns), filename)
}
