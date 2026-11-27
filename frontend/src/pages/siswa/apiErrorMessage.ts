/** Pesan galat yang aman ditampilkan (ApiError sudah berisi pesan Bahasa Indonesia dari backend). */
export function apiErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message
  }

  return 'Terjadi kesalahan. Coba lagi.'
}
