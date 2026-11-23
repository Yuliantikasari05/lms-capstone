const XP_FORMAT = new Intl.NumberFormat('id-ID')

export function formatXp(value: number): string {
  return XP_FORMAT.format(value)
}
