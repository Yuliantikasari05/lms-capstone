import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const rawBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

export const API_BASE_URL = rawBase.replace(/\/+$/, '')
/** Origin backend, dipakai untuk /sanctum/csrf-cookie (berada di luar prefix /api/v1). */
export const BACKEND_ORIGIN = new URL(API_BASE_URL).origin

/** Event global yang dikirim saat sesi berakhir (401) atau akun dinonaktifkan. */
export const AUTH_EVENT = 'lms:auth-unauthenticated'

export type ApiErrorKind =
  | 'network'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'unknown'

export class ApiError extends Error {
  kind: ApiErrorKind
  status: number | null
  code?: string
  fieldErrors: Record<string, string[]>

  constructor(
    message: string,
    kind: ApiErrorKind,
    status: number | null = null,
    code?: string,
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

interface ErrorBody {
  message?: string
  code?: string
  errors?: Record<string, string[]>
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorBody>

    if (!axiosError.response) {
      return new ApiError(
        'Tidak dapat menghubungi server. Pastikan backend berjalan dan VITE_API_BASE_URL sudah benar.',
        'network',
      )
    }

    const { status, data } = axiosError.response
    const serverMessage = typeof data?.message === 'string' ? data.message : undefined

    switch (status) {
      case 401:
        return new ApiError(serverMessage ?? 'Sesi Anda telah berakhir. Silakan login kembali.', 'unauthenticated', 401)
      case 403:
        return new ApiError(
          serverMessage ?? 'Anda tidak memiliki izin untuk mengakses sumber daya ini.',
          'forbidden',
          403,
          data?.code,
        )
      case 404:
        return new ApiError('Sumber daya yang diminta tidak ditemukan.', 'not_found', 404)
      case 422: {
        const fieldErrors = data?.errors ?? {}
        const first = Object.values(fieldErrors)[0]?.[0]
        return new ApiError(first ?? serverMessage ?? 'Data yang dikirim tidak valid.', 'validation', 422, undefined, fieldErrors)
      }
      case 429:
        return new ApiError('Terlalu banyak percobaan. Coba lagi beberapa saat lagi.', 'server', 429)
      default:
        if (status >= 500) {
          return new ApiError('Server mengalami masalah. Coba lagi nanti.', 'server', status)
        }
        return new ApiError(serverMessage ?? 'Permintaan gagal diproses.', 'unknown', status)
    }
  }

  return new ApiError('Terjadi kesalahan tak terduga.', 'unknown')
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // kirim cookie sesi Sanctum
  withXSRFToken: true, // salin cookie XSRF-TOKEN ke header X-XSRF-TOKEN (lintas origin)
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
})

/** Meminta cookie CSRF dari Sanctum. Wajib dipanggil sebelum login. */
export async function ensureCsrfCookie(): Promise<void> {
  try {
    await axios.get(`${BACKEND_ORIGIN}/sanctum/csrf-cookie`, { withCredentials: true })
  } catch (error) {
    throw toApiError(error)
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean }

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response as { status: number; data?: ErrorBody }
      const config = error.config as RetriableConfig | undefined

      // 419 = token CSRF kedaluwarsa: ambil cookie baru lalu ulangi satu kali.
      if (status === 419 && config && !config._csrfRetried) {
        config._csrfRetried = true
        await ensureCsrfCookie()
        return api.request(config)
      }

      const url = config?.url ?? ''
      const isAuthProbe = url.includes('/auth/login') || url.includes('/auth/me')

      if (status === 401 && !isAuthProbe) {
        window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { reason: 'expired' } }))
      } else if (status === 403 && data?.code === 'account_inactive') {
        window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { reason: 'inactive' } }))
      }
    }

    return Promise.reject(toApiError(error))
  },
)
