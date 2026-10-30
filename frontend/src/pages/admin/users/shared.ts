import { STATUS_LABEL } from '../../../lib/format'

export const STATUS_TONE = { active: 'success', inactive: 'neutral', suspended: 'danger' } as const

export const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))

function randomInt(max: number): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] % max
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz' // tanpa huruf yang mirip (I, l, O)
const DIGITS = '23456789' // tanpa 0, 1

/** Kata sandi acak yang memenuhi aturan backend (min. 12 karakter, ada huruf dan angka). */
export function generatePassword(length = 14): string {
  const all = LETTERS + DIGITS
  const chars = [LETTERS[randomInt(LETTERS.length)], DIGITS[randomInt(DIGITS.length)]]
  while (chars.length < length) chars.push(all[randomInt(all.length)])

  // Acak urutan (Fisher-Yates) agar huruf dan angka wajib tidak selalu di depan.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
