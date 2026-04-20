import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Alert } from 'react-native'

/**
 * CSV export helpers for mobile. Mirrors the shape of packages/web/src/lib/export.ts
 * so both apps emit identical CSVs. Prepends a UTF-8 BOM so Excel on Windows
 * opens Unicode rows correctly.
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

/**
 * Write CSV to the cache dir and hand it to the OS share sheet. On iOS this
 * opens Files/Mail/etc; on Android it routes through the system intent chooser.
 */
export async function exportRowsAsCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
): Promise<void> {
  try {
    if (rows.length === 0) {
      Alert.alert('Nothing to export', 'There are no rows in this report yet.')
      return
    }
    const csv = '\ufeff' + toCSV(rows, columns)
    const path = `${FileSystem.cacheDirectory}${filename}`
    await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 })

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', `CSV saved to ${path}`)
      return
    }
    await Sharing.shareAsync(path, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: filename,
    })
  } catch (err) {
    console.warn('[export] CSV export failed:', err)
    Alert.alert('Export failed', 'Could not generate CSV. Please try again.')
  }
}
