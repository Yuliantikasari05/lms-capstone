/** Mengunduh baris data sebagai file CSV (pemisah titik koma agar terbaca Excel Indonesia). */
export function downloadCsv(lines: (string | number)[][], filename: string): void {
  const csv = lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
